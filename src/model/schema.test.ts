import { describe, expect, it } from "vitest";
import { arcPoints, slotRing } from "@/geometry/primitives";
import { straightSlot } from "@/geometry/slot";
import type { Vec2 } from "@/geometry/vec";
import { validateScene } from "./scene";
import type { Link, Part, Scene } from "./types";

/** Integridade referencial da v2: um caso de erro por regra nova. */

const NOW = "2026-11-04T00:00:00.000Z";

/** Rasgo em arco: faixa de largura w em torno de um arco de raio R, de a0 a a1. */
function arcSlot(R: number, w: number, a0: number, a1: number): Vec2[] {
  const outer = arcPoints([0, 0], R + w / 2, a0, a1);
  const capB = arcPoints([R * Math.cos(a1), R * Math.sin(a1)], w / 2, a1, a1 + Math.PI).slice(1, -1);
  const inner = arcPoints([0, 0], R - w / 2, a1, a0);
  const capA = arcPoints([R * Math.cos(a0), R * Math.sin(a0)], w / 2, a0 + Math.PI, a0 + 2 * Math.PI).slice(
    1,
    -1,
  );
  return [...outer, ...capB, ...inner, ...capA];
}

const plate = (id: string, ref: number, holes: Vec2[][], extra: Partial<Part> = {}): Part => ({
  id,
  ref,
  name: id,
  layer: "L1",
  x: 0,
  y: 0,
  angle: 0,
  fixed: true,
  fast: false,
  material: "steel",
  shape: {
    kind: "poly",
    outer: [
      [-40, -40],
      [40, -40],
      [40, 40],
      [-40, 40],
    ],
    holes,
  },
  ...extra,
});

function base(): Scene {
  return {
    version: 4,
    meta: { title: "t", createdAt: NOW, updatedAt: NOW },
    settings: { gravity: { on: true, g: 9810 }, snap: { grid: 1, on: true } },
    layers: [
      { id: "L1", name: "Fundo", visible: true, locked: false, thickness: 3 },
      { id: "L2", name: "Meio", visible: true, locked: false, thickness: 3 },
      { id: "L3", name: "Frente", visible: true, locked: false, thickness: 3 },
    ],
    parts: [
      plate("p1", 1, [slotRing([-10, 0], [10, 0], 4.2), arcSlot(20, 4.2, 0, Math.PI / 2)]),
      { ...plate("p2", 2, [], { fixed: false, layer: "L2" }) },
      { ...plate("p3", 3, [], { fixed: false, layer: "L2", x: 100 }) },
    ],
    links: [
      { id: "k1", ref: 11, kind: "pin", host: "p2", at: [0, 0], r: 2, layers: ["L1", "L2"] },
      { id: "k2", ref: 12, kind: "slot", pin: "k1", guide: "p1", hole: 0, mode: "joint" },
      {
        id: "k3",
        ref: 13,
        kind: "chamber",
        body: "p1",
        at: [0, 0],
        dir: 0,
        bore: 8,
        length: 40,
        walls: [{ part: "p2", seal: 30 }],
        vents: [{ at: 40, d: 8, open: true }],
        ports: [],
        gas: { model: "isothermal", gamma: 1.4, p0: 101.325, charge: { amount: 0.1, burnMs: 1 } },
      },
      {
        id: "k4",
        ref: 14,
        kind: "sensor",
        host: "p1",
        at: [0, 0],
        r: 3,
        layers: ["L2", "L2"],
        minSpeed: 100,
        actions: [
          { do: "ignite", target: "k3" },
          { do: "open", target: "k3", vent: 0 },
        ],
      },
    ],
  };
}

function issues(mut: (s: Scene) => void) {
  const s = base();
  mut(s);
  const r = validateScene(s);
  return r.ok ? [] : r.issues;
}

const link = <K extends Link["kind"]>(s: Scene, id: string) =>
  s.links.find((l) => l.id === id) as Extract<Link, { kind: K }>;

describe("v2: integridade referencial", () => {
  it("a cena base é válida", () => {
    expect(issues(() => {})).toEqual([]);
  });

  it("o rasgo reto é reconhecido; o arco não", () => {
    const s = base();
    const holes = s.parts[0]!.shape.kind === "poly" ? s.parts[0]!.shape.holes : [];
    const st = straightSlot(holes[0]!);
    expect(st).not.toBeNull();
    expect(st!.length).toBeCloseTo(20, 2);
    expect(st!.r).toBeCloseTo(2.1, 2);
    expect(straightSlot(holes[1]!)).toBeNull();
  });

  it("slot.pin precisa ser uma ligação pin", () => {
    expect(issues((s) => (link<"slot">(s, "k2").pin = "k3"))).toContainEqual({
      path: "links[1].pin",
      message: "O rasgo precisa apontar para um pino",
    });
    expect(issues((s) => (link<"slot">(s, "k2").pin = "k99"))).toContainEqual({
      path: "links[1].pin",
      message: "Ligação inexistente: k99",
    });
  });

  it("slot.hole precisa existir em shape.holes da guia", () => {
    expect(issues((s) => (link<"slot">(s, "k2").hole = 5))).toContainEqual({
      path: "links[1].hole",
      message: "Furo inexistente na peça 1: 5",
    });
  });

  it("modo joint exige rasgo reto", () => {
    expect(issues((s) => (link<"slot">(s, "k2").hole = 1))).toContainEqual({
      path: "links[1].mode",
      message: "Rasgo curvo: use o modo contato",
    });
    // em modo contato o arco vale
    expect(
      issues((s) => {
        const l = link<"slot">(s, "k2");
        l.hole = 1;
        l.mode = "contact";
      }),
    ).toEqual([]);
  });

  it("o pino precisa ocupar a camada da guia", () => {
    expect(issues((s) => (link<"pin">(s, "k1").layers = ["L2", "L3"]))).toContainEqual({
      path: "links[1].pin",
      message: "O pino precisa ocupar a camada da peça-guia",
    });
  });

  it("chamber.walls com 1 ou 2 peças móveis", () => {
    expect(issues((s) => (link<"chamber">(s, "k3").walls = []))).toContainEqual({
      path: "links[2].walls",
      message: "A câmara precisa de 1 ou 2 paredes móveis",
    });
    expect(
      issues(
        (s) =>
          (link<"chamber">(s, "k3").walls = [
            { part: "p2", seal: 1 },
            { part: "p3", seal: 1 },
            { part: "p3", seal: 1 },
          ]),
      ),
    ).toContainEqual({ path: "links[2].walls", message: "A câmara precisa de 1 ou 2 paredes móveis" });
    expect(issues((s) => (s.parts[1]!.fixed = true))).toContainEqual({
      path: "links[2].walls[0].part",
      message: "A parede da câmara precisa ser uma peça móvel",
    });
    expect(
      issues((s) => s.links.push({ id: "k9", ref: 19, kind: "screw", a: null, b: "p2", at: [0, 0] })),
    ).toContainEqual({
      path: "links[2].walls[0].part",
      message: "A parede da câmara precisa ser uma peça móvel",
    });
  });

  it("charge.shots é opcional, inteiro e pelo menos 1", () => {
    expect(issues(() => {})).toEqual([]);
    expect(issues((s) => (link<"chamber">(s, "k3").gas.charge!.shots = 7))).toEqual([]);
    expect(issues((s) => (link<"chamber">(s, "k3").gas.charge!.shots = 0))).toContainEqual({
      path: "links[2].gas.charge.shots",
      message: "O número de cargas precisa ser pelo menos 1",
    });
    expect(issues((s) => (link<"chamber">(s, "k3").gas.charge!.shots = 1.5))).toContainEqual({
      path: "links[2].gas.charge.shots",
      message: "O número de cargas precisa ser inteiro",
    });
  });

  it("chamber.ports aponta para outra câmara", () => {
    expect(issues((s) => (link<"chamber">(s, "k3").ports = [{ to: "k1", at: 10, d: 2 }]))).toContainEqual({
      path: "links[2].ports[0].to",
      message: "A porta precisa levar a outra câmara",
    });
    expect(issues((s) => (link<"chamber">(s, "k3").ports = [{ to: "k3", at: 10, d: 2 }]))).toContainEqual({
      path: "links[2].ports[0].to",
      message: "A porta não pode levar à própria câmara",
    });
  });

  it("ações do sensor apontam para câmaras e respiros existentes", () => {
    expect(issues((s) => (link<"sensor">(s, "k4").actions[0]!.target = "k1"))).toContainEqual({
      path: "links[3].actions[0].target",
      message: "O sensor só age sobre câmaras",
    });
    expect(issues((s) => (link<"sensor">(s, "k4").actions[1]!.vent = 3))).toContainEqual({
      path: "links[3].actions[1].vent",
      message: "Respiro inexistente na câmara 13: 3",
    });
    expect(issues((s) => delete link<"sensor">(s, "k4").actions[1]!.vent)).toContainEqual({
      path: "links[3].actions[1].vent",
      message: "Abrir ou fechar precisa do índice do respiro",
    });
  });

  it("mola: guia existente, sólido ≤ livre, espiras coerentes", () => {
    const spring: Link = {
      id: "k8",
      ref: 18,
      kind: "spring",
      a: null,
      b: "p2",
      atA: [0, 0],
      atB: [0, 0],
      k: 0.1,
      damping: 0,
      freeLength: 20,
      mode: "seated",
      guide: "p77",
      solidLength: 30,
      coil: { outerD: 4, wireD: 3, turns: 6 },
    };
    const got = issues((s) => s.links.push(spring));
    expect(got).toContainEqual({ path: "links[4].guide", message: "Peça-guia inexistente: p77" });
    expect(got).toContainEqual({
      path: "links[4].solidLength",
      message: "O comprimento sólido precisa ser menor ou igual ao comprimento livre",
    });
    expect(got).toContainEqual({
      path: "links[4].coil.wireD",
      message: "O arame precisa ser mais fino que metade do diâmetro externo",
    });
  });
});
