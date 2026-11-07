import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signedArea } from "@/geometry/polygon";
import type { Vec2 } from "@/geometry/vec";
import { validateScene } from "@/model/scene";
import type { Part, Scene } from "@/model/types";
import { buildPart } from "@/parts";
import { prepareScene } from "@/render/prepare";
import { profilesScene } from "../../scripts/fixtures/multicamada";
import { emptyHistory, push, redo, run, undo } from "./history";
import { commitPlan, DEFAULT_PENCIL, FREEFORM_NOTICE, pencilPlan, type PencilTool } from "./pencil";

/** Item 15.4: forma livre, perfil da camada ativa e a física das formas novas. */

const hash = (s: unknown) => createHash("sha256").update(JSON.stringify(s)).digest("hex");
const PX = 0.2;

function noise(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32 - 0.5;
  };
}
const loop = (c: Vec2, r: number, amp = 0, seed = 1, n = 90): Vec2[] => {
  const rnd = noise(seed);
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    const rr = r + amp * rnd();
    return [c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)] as Vec2;
  });
};

function apply(
  scene: Scene,
  tool: Partial<PencilTool>,
  points: Vec2[],
  layer: number,
  opts: { selected?: string; separate?: boolean; tap?: boolean } = {},
) {
  const plan = pencilPlan(
    prepareScene(scene),
    { ...DEFAULT_PENCIL, ...tool },
    { points, tap: !!opts.tap, px: PX },
    layer,
    opts.selected ?? null,
  );
  if (plan.kind === "none") return { plan, commit: null, scene };
  const commit = commitPlan(scene, plan, scene.layers[layer]!.id, { separate: opts.separate });
  if (commit.kind !== "command") return { plan, commit, scene };
  const r = run(scene, commit.command.label, commit.command.recipe)!;
  expect(validateScene(r.scene).ok).toBe(true);
  const back = undo(r.scene, push(emptyHistory(), r.entry))!;
  expect(hash(back.scene)).toBe(hash(scene));
  expect(hash(redo(back.scene, back.history)!.scene)).toBe(hash(r.scene));
  return { plan, commit, scene: r.scene, back: back.scene };
}

function gearScene(): Scene {
  const s: Scene = {
    version: 3,
    meta: { title: "G", createdAt: "2026-11-07T00:00:00.000Z", updatedAt: "2026-11-07T00:00:00.000Z" },
    settings: { gravity: { on: false, g: 9810 }, snap: { grid: 1, on: false } },
    layers: [{ id: "L1", name: "Peças", visible: true, locked: false, thickness: 3 }],
    parts: [],
    links: [],
  };
  s.parts.push(buildPart(s, "gear", { layer: "L1", x: 0, y: 0, params: {} }));
  s.parts.push(buildPart(s, "disc", { layer: "L1", x: 60, y: 0, params: {} }));
  return s;
}

describe("forma livre", () => {
  it("engrenagem que passa pelo Lápis vira polígono, com aviso; desfazer volta os parâmetros", () => {
    const s = gearScene();
    const gear = s.parts[0]!;
    expect(gear.shape.kind).toBe("gear");
    // fora do furo central (Ø 4), no miolo da engrenagem
    const r = apply(s, { form: "stroke", op: "cut", width: 2 }, [[4.5, 0]], 0, {
      selected: gear.id,
      tap: true,
    });
    expect(r.commit?.kind).toBe("command");
    if (r.commit?.kind !== "command") return;
    expect(r.commit.command.notice).toBe(FREEFORM_NOTICE);
    const cut = r.scene.parts[0]!;
    expect(cut.shape.kind).toBe("poly");
    expect(cut.source).toBeUndefined();
    expect(r.back!.parts[0]).toEqual(gear);
  });
  it("disco vira polígono", () => {
    const s = gearScene();
    const disc = s.parts[1]!;
    const r = apply(s, { form: "contour", op: "cut" }, loop([60, 0], 2), 0, { selected: disc.id });
    expect(r.scene.parts[1]!.shape.kind).toBe("poly");
    expect(r.back!.parts[1]).toEqual(disc);
  });
});

describe("multicamada", () => {
  it("o Lápis recorta o perfil da camada 3 sem mudar o da camada 1 nem a peça", () => {
    const { scene, piece } = profilesScene();
    const before = structuredClone(scene.parts.find((p) => p.id === piece.id)!);
    const r = apply(scene, { form: "stroke", op: "cut", width: 1 }, [[8, 0]], 2, {
      selected: piece.id,
      tap: true,
    });
    const after = r.scene.parts.find((p) => p.id === piece.id)!;
    expect(after.shape).toEqual(before.shape);
    expect(after.layer).toBe(before.layer);
    const front = after.profiles![0]!;
    expect(front.shape.kind).toBe("poly");
    if (front.shape.kind === "poly") expect(front.shape.holes).toHaveLength(1);
    expect(front.material).toBe("brass");
  });
  it("cortar o perfil em duas partes soltas oferece Separar em peça", () => {
    const { scene, piece } = profilesScene();
    const band: Vec2[] = [
      [7.5, -4],
      [8.5, -4],
      [8.5, 4],
      [7.5, 4],
      [7.5, -4],
    ];
    const offer = apply(scene, { form: "contour", op: "cut" }, band, 2, { selected: piece.id });
    expect(offer.commit?.kind).toBe("offer");
    const sep = apply(scene, { form: "contour", op: "cut" }, band, 2, { selected: piece.id, separate: true });
    expect(sep.commit?.kind).toBe("command");
    const made = sep.scene.parts.filter((p) => p.layer === scene.layers[2]!.id && p.id !== piece.id);
    expect(made.some((p) => p.name.startsWith("Peça multicamada (parte 2)"))).toBe(true);
    // a peça original guarda a camada principal intacta
    expect(sep.scene.parts.find((p) => p.id === piece.id)!.shape).toEqual(piece.shape);
  });
});

describe("física das formas novas", () => {
  /** Formas tremidas, como o dedo: cortes, somas, pincel e peça nova; nenhuma pode dar aviso no motor. */
  const cases: { name: string; tool: Partial<PencilTool>; pts: Vec2[]; tap?: boolean }[] = [
    { name: "laço tremido recortado", tool: { form: "contour", op: "cut" }, pts: loop([3, 1], 4, 0.6, 2) },
    { name: "laço grande somado", tool: { form: "contour", op: "add" }, pts: loop([18, 6], 7, 0.8, 3) },
    { name: "peça nova no vazio", tool: { form: "contour", op: "add" }, pts: loop([60, 30], 6, 0.7, 4) },
    {
      name: "borracha em zigue-zague",
      tool: { form: "stroke", op: "cut", width: 2 },
      pts: Array.from(
        { length: 50 },
        (_, i) => [-15 + i * 0.6, 3 * Math.sin(i / 3) + 0.3 * noise(i)()] as Vec2,
      ),
    },
    {
      name: "pincel tremido",
      tool: { form: "stroke", op: "add", width: 3 },
      pts: Array.from(
        { length: 50 },
        (_, i) => [-35 + i * 0.4, -18 + i * 0.25 + 0.4 * Math.sin(i * 2.1)] as Vec2,
      ),
    },
    { name: "furos de toque", tool: { form: "stroke", op: "cut", width: 3 }, pts: [[-12, 5]], tap: true },
  ];
  for (const c of cases)
    it(`${c.name}: sem lasca, sem aviso de compilação, massa recalculada`, async () => {
      const s = gearScene();
      s.parts = [
        {
          id: "plate",
          ref: 1,
          name: "Placa 1",
          layer: "L1",
          x: 0,
          y: 0,
          angle: 0.3,
          shape: {
            kind: "poly",
            outer: [
              [-20, -10],
              [20, -10],
              [20, 10],
              [-20, 10],
            ],
            holes: [],
          },
          material: "steel",
          fixed: false,
          fast: false,
        } as Part,
      ];
      const r = apply(s, c.tool, c.pts, 0, { tap: c.tap });
      expect(r.commit?.kind).toBe("command");
      const model = prepareScene(r.scene);
      for (const p of r.scene.parts) {
        const m = model.parts.get(p.id)!;
        expect(m.mass).toBeGreaterThan(0);
        if (p.shape.kind === "poly") expect(Math.abs(signedArea(p.shape.outer))).toBeGreaterThan(0.05);
      }
      const { loadBox2d } = await import("@/engine/box2d/load");
      const engine = (await loadBox2d())();
      const report = engine.compile(
        { ...r.scene, settings: { ...r.scene.settings, gravity: { on: true, g: 9810 } } },
        { unitMm: 1 },
      );
      expect(report.warnings).toEqual([]);
      for (let i = 0; i < 60; i++) engine.step(1 / 240);
      for (const p of r.scene.parts) expect(engine.snapshot().parts[p.id]!.y).toBeGreaterThan(p.y);
      engine.dispose();
    });
});
