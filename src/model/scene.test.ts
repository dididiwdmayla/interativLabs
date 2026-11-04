import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createIdGenerator, nextRef, seededRandom } from "./ids";
import { loadScene, parseSceneJson, serializeScene, validateScene } from "./scene";
import type { Scene } from "./types";
import { DEG, MM_PER_PX } from "./units";
import type { V0Scene } from "./v0";

const NOW = "2026-11-03T00:00:00.000Z";
const V0_FILES = ["lancador", "trava", "engrenagens"] as const;

function readV0(name: string): V0Scene {
  return JSON.parse(readFileSync(`reference/prototype-v0/scenes/${name}.json`, "utf8")) as V0Scene;
}

function mustLoad(data: unknown): Scene {
  const r = loadScene(data, { now: NOW });
  if (!r.ok) throw new Error(JSON.stringify(r.issues, null, 2));
  return r.scene;
}

describe("migração v0 → v1", () => {
  for (const name of V0_FILES) {
    describe(name, () => {
      const v0 = readV0(name);
      const scene = mustLoad(v0);

      it("migra e passa no schema", () => {
        expect(scene.version).toBe(1);
        expect(scene.layers).toHaveLength(v0.layers.length);
        expect(scene.parts).toHaveLength(v0.parts.length);
        expect(scene.links).toHaveLength(v0.links.length);
        expect(scene.meta.title).toBe(v0.title);
      });

      it("ida e volta em JSON é igual", () => {
        const text = serializeScene(scene);
        const again = parseSceneJson(text, { now: NOW });
        expect(again.ok).toBe(true);
        if (!again.ok) return;
        expect(again.migratedFrom).toBeNull();
        expect(again.scene).toEqual(scene);
        expect(serializeScene(again.scene)).toBe(text);
      });

      it("não perde geometria: cada coordenada volta ao px original", () => {
        v0.parts.forEach((p, i) => {
          const q = scene.parts[i]!;
          expect(q.id).toBe(p.id);
          expect(q.x / MM_PER_PX).toBeCloseTo(p.x, 9);
          expect(q.y / MM_PER_PX).toBeCloseTo(p.y, 9);
          expect(q.angle).toBe(p.angle ?? 0);
          expect(q.fixed).toBe(!!p.fixed);
          expect(q.fast).toBe(!!p.bullet);
          if (p.shape.type === "poly" && q.shape.kind === "poly") {
            q.shape.outer.forEach((pt, j) => {
              const src = (p.shape as { pts: [number, number][] }).pts[j]!;
              expect(pt[0] / MM_PER_PX).toBeCloseTo(src[0], 9);
              expect(pt[1] / MM_PER_PX).toBeCloseTo(src[1], 9);
            });
          }
          if (p.shape.type === "gear" && q.shape.kind === "gear") {
            expect((q.shape.module * q.shape.teeth) / 2 / MM_PER_PX).toBeCloseTo(p.shape.r, 9);
            expect(q.shape.profile).toBe(p.shape.style === "serra" ? "ratchet" : "involute");
          }
        });
      });

      it("números de chamada únicos e sequenciais", () => {
        const refs = [...scene.parts, ...scene.links].map((x) => x.ref);
        expect(refs).toEqual(refs.map((_, i) => i + 1));
        expect(nextRef(scene)).toBe(refs.length + 1);
      });
    });
  }

  it("converte as ligações com as unidades certas (trava)", () => {
    const scene = mustLoad(readV0("trava"));
    const slider = scene.links.find((l) => l.kind === "slider");
    const axle = scene.links.find((l) => l.kind === "axle");
    const pin = scene.links.find((l) => l.kind === "pin");
    expect(slider?.kind === "slider" && slider.travel).toEqual([0, 70 * MM_PER_PX]);
    if (slider?.kind === "slider") {
      expect(slider.dir).toBeCloseTo(Math.PI, 12);
      expect(slider.spring).toEqual({ k: 120, rest: -12 * MM_PER_PX, damping: 1 });
    }
    if (axle?.kind === "axle") {
      expect(axle.limit?.lower).toBeCloseTo(-30 * DEG, 12);
      expect(axle.limit?.upper).toBe(0);
      expect(axle.torsion?.k).toBeCloseTo(120 * 100, 9);
      expect(axle.torsion?.rest).toBeCloseTo(20 * DEG, 12);
      expect(axle.motor).toBeUndefined();
    }
    expect(pin?.kind === "pin" && pin.layers).toEqual(["L2", "L3"]);
    expect(scene.settings.gravity).toEqual({ on: true, g: 100 });
  });

  it("converte câmara, sensor e mola (lançador)", () => {
    const scene = mustLoad(readV0("lancador"));
    const chamber = scene.links.find((l) => l.kind === "chamber");
    const sensor = scene.links.find((l) => l.kind === "sensor");
    const spring = scene.links.find((l) => l.kind === "spring");
    if (chamber?.kind !== "chamber" || sensor?.kind !== "sensor" || spring?.kind !== "spring")
      throw new Error("faltam ligações");
    expect(chamber.bore).toBeCloseTo(24 * MM_PER_PX, 12);
    expect(chamber.length).toBeCloseTo(412 * MM_PER_PX, 12);
    expect(chamber.burn).toBeCloseTo(0.002, 12);
    expect(chamber.charge).toBeCloseTo(150 * 100, 9);
    expect(sensor.triggers).toEqual([chamber.id]);
    expect(sensor.minSpeed).toBeCloseTo(100 * MM_PER_PX, 12);
    // a mola do protótipo tinha comprimento livre de 260% do desenhado
    expect(spring.freeLength).toBeGreaterThan(0);
  });

  it("motor da engrenagem: rpm → rad/s e torque", () => {
    const scene = mustLoad(readV0("engrenagens"));
    const motor = scene.links.find((l) => l.kind === "axle" && l.motor);
    if (motor?.kind !== "axle" || !motor.motor) throw new Error("sem motor");
    expect(motor.motor.speed).toBeCloseTo((-12 * 2 * Math.PI) / 60, 12);
    expect(motor.motor.maxTorque).toBeCloseTo(400 * 100, 9);
    expect(scene.settings.gravity.on).toBe(false);
  });
});

describe("validação com caminho do campo", () => {
  const base = () => mustLoad(readV0("trava"));

  it("raio negativo aponta parts[i].shape.r", () => {
    const s = structuredClone(mustLoad(readV0("lancador"))) as unknown as {
      parts: { shape: { kind: string; r?: number } }[];
    };
    const i = s.parts.findIndex((p) => p.shape.kind === "circle");
    s.parts[i]!.shape.r = -3;
    const r = validateScene(s);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues).toContainEqual({
      path: `parts[${i}].shape.r`,
      message: "O raio precisa ser maior que zero",
    });
  });

  it("tipo errado vem em português, com caminho", () => {
    const s = structuredClone(base()) as unknown as { parts: { x: unknown }[] };
    s.parts[2]!.x = "doze";
    const r = validateScene(s);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const issue = r.issues.find((i) => i.path === "parts[2].x");
    expect(issue?.message).toMatch(/esperava um número/);
  });

  it("material desconhecido", () => {
    const s = structuredClone(base()) as unknown as { parts: { material: string }[] };
    s.parts[0]!.material = "ouro";
    const r = validateScene(s);
    expect(!r.ok && r.issues[0]).toMatchObject({
      path: "parts[0].material",
      message: expect.stringMatching(/^Material inválido/),
    });
  });

  it("campo desconhecido é rejeitado", () => {
    const s = structuredClone(base()) as unknown as { links: Record<string, unknown>[] };
    s.links[0]!.cor = "azul";
    const r = validateScene(s);
    expect(!r.ok && r.issues[0]).toMatchObject({ path: "links[0]", message: expect.stringMatching(/cor/) });
  });

  it("referência a peça inexistente", () => {
    const s = structuredClone(base());
    const pin = s.links.find((l) => l.kind === "pin");
    if (pin?.kind === "pin") pin.host = "p999";
    const i = s.links.findIndex((l) => l.kind === "pin");
    const r = validateScene(s);
    expect(!r.ok && r.issues).toContainEqual({ path: `links[${i}].host`, message: "Peça inexistente: p999" });
  });

  it("número de chamada repetido", () => {
    const s = structuredClone(base());
    s.links[0]!.ref = s.parts[0]!.ref;
    const r = validateScene(s);
    expect(!r.ok && r.issues[0]?.path).toBe("links[0].ref");
  });

  it("batente invertido", () => {
    const s = structuredClone(base());
    const i = s.links.findIndex((l) => l.kind === "axle");
    const ax = s.links[i];
    if (ax?.kind === "axle") ax.limit = { lower: 1, upper: -1 };
    const r = validateScene(s);
    expect(!r.ok && r.issues[0]?.path).toBe(`links[${i}].limit.lower`);
  });

  it("JSON quebrado e versão futura", () => {
    const a = parseSceneJson("{ nada");
    expect(!a.ok && a.issues[0]?.message).toMatch(/^JSON inválido/);
    const b = loadScene({ version: 9 });
    expect(!b.ok && b.issues[0]?.path).toBe("version");
  });
});

describe("ids", () => {
  it("são únicos, com prefixo e sem colidir com os usados", () => {
    const gen = createIdGenerator(["pAAAA"], seededRandom(7));
    const ids = new Set<string>();
    for (let i = 0; i < 2000; i++) ids.add(gen.next(i % 3 === 0 ? "part" : i % 3 === 1 ? "link" : "layer"));
    expect(ids.size).toBe(2000);
    for (const id of ids) expect(id).toMatch(/^[pkL][0-9a-z]{8}$/);
  });

  it("determinísticos com semente", () => {
    const a = createIdGenerator([], seededRandom(1));
    const b = createIdGenerator([], seededRandom(1));
    expect([a.next("part"), a.next("link")]).toEqual([b.next("part"), b.next("link")]);
  });
});
