import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Scene } from "@/model/types";
import { BOX2D_WASM_VERSION } from "./box2d/box2dAdapter";
import { unwrapAngle } from "./common";
import { buildPlan, layerBitsSpan } from "./plan";
import { PLANCK_VERSION } from "./planck/planckAdapter";
import { RAPIER_VERSION } from "./rapier/rapierAdapter";
import { ENGINES } from "./registry";

const pkg = (name: string) => JSON.parse(readFileSync(`node_modules/${name}/package.json`, "utf8")).version;

const NOW = "2026-11-04T00:00:00.000Z";
function scene(parts: Scene["parts"], links: Scene["links"]): Scene {
  return {
    version: 1,
    meta: { title: "t", createdAt: NOW, updatedAt: NOW },
    settings: { gravity: { on: true, g: 100 }, snap: { grid: 1, on: true } },
    layers: [
      { id: "L1", name: "a", visible: true, locked: false },
      { id: "L2", name: "b", visible: true, locked: false },
      { id: "L3", name: "c", visible: true, locked: false },
    ],
    parts,
    links,
  };
}
const box = (id: string, x: number, layer = "L1", fixed = false): Scene["parts"][number] => ({
  id,
  ref: Number(id.slice(1)),
  name: id,
  layer,
  x,
  y: 0,
  angle: 0,
  fixed,
  fast: false,
  material: "steel",
  shape: {
    kind: "poly",
    outer: [
      [-5, -5],
      [5, -5],
      [5, 5],
      [-5, 5],
    ],
    holes: [],
  },
});

describe("adaptadores", () => {
  it("versões registradas batem com as instaladas", () => {
    expect(PLANCK_VERSION).toBe(pkg("planck"));
    expect(RAPIER_VERSION).toBe(pkg("@dimforge/rapier2d-compat"));
    expect(RAPIER_VERSION).toBe(pkg("@dimforge/rapier2d-deterministic-compat"));
    expect(BOX2D_WASM_VERSION).toBe(pkg("box2d3-wasm"));
  });

  it("ângulo contínuo a partir de leituras entre −π e π", () => {
    let a = 0;
    for (let k = 1; k <= 100; k++) {
      const real = k * 0.3;
      a = unwrapAngle(a, Math.atan2(Math.sin(real), Math.cos(real)));
    }
    expect(a).toBeCloseTo(30, 9);
  });

  it("faixa de camadas vira a soma dos bits", () => {
    const order = new Map([
      ["L1", 0],
      ["L2", 1],
      ["L3", 2],
    ]);
    expect(layerBitsSpan(order, "L1", "L3")).toBe(0b111);
    expect(layerBitsSpan(order, "L3", "L2")).toBe(0b110);
  });

  it("parafusos viram corpo composto; grupo fixo é estático e próprio", () => {
    const p = buildPlan(
      scene(
        [box("p1", 0), box("p2", 10), box("p3", 40, "L1", true), box("p4", 60)],
        [
          { id: "k5", ref: 5, kind: "screw", a: "p1", b: "p2", at: [0, 0] },
          { id: "k6", ref: 6, kind: "screw", a: null, b: "p4", at: [0, 0] },
        ],
      ),
    );
    const bodyOf = (id: string) => p.partRel.get(id)!.body;
    expect(bodyOf("p1")).toBe(bodyOf("p2"));
    const composite = p.bodies[bodyOf("p1")]!;
    expect(composite.static).toBe(false);
    expect(composite.position[0]).toBeCloseTo(5, 9);
    // 2 caixas de aço de 100 mm² × 10 mm
    expect(composite.mass).toBeCloseTo(2 * 7.8 * 100 * 10 * 1e-3, 9);
    expect(p.bodies[bodyOf("p3")]!.static).toBe(true);
    expect(p.bodies[bodyOf("p4")]!.static).toBe(true);
    expect(bodyOf("p3")).not.toBe(bodyOf("p4"));
  });

  for (const e of ENGINES) {
    it(`${e.label}: peças só colidem na mesma camada`, async () => {
      const a = (await e.load())();
      const s = scene(
        [box("p1", 0, "L1", true), { ...box("p2", 0, "L2"), y: -12 }, { ...box("p3", 30, "L1"), y: -12 }],
        [],
      );
      s.parts[0]!.shape = {
        kind: "poly",
        outer: [
          [-50, -5],
          [50, -5],
          [50, 5],
          [-50, 5],
        ],
        holes: [],
      };
      s.settings.gravity.g = 2000;
      a.compile(s, { unitMm: 1 });
      for (let i = 0; i < 240; i++) a.step(1 / 240);
      // p2 (camada 2) atravessa o chão (camada 1); p3 (camada 1) fica em cima
      expect(a.pose("p2")!.y).toBeGreaterThan(50);
      expect(a.pose("p3")!.y).toBeLessThan(-9);
      a.dispose();
    });
  }
});
