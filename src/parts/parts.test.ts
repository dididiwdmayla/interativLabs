import { describe, expect, it } from "vitest";
import { shapeGeometry } from "@/geometry/shape";
import { shapeOutline } from "@/geometry/outline";
import type { Scene } from "@/model/types";
import { validateScene } from "@/model/scene";
import { GENERATORS, buildPart, clampParams, defaults, mirroredShape, paramsOf, regenerate } from "./index";
import { run } from "@/editor/history";

const blank: Scene = {
  version: 3,
  meta: { title: "t", createdAt: "", updatedAt: "" },
  settings: { gravity: { on: true, g: 9810 }, snap: { grid: 2, on: true } },
  layers: [
    { id: "L1", name: "Fundo", visible: true, locked: false, thickness: 3 },
    { id: "L2", name: "Meio", visible: true, locked: false, thickness: 3 },
  ],
  parts: [],
  links: [],
};

/** área analítica esperada de cada peça com os parâmetros padrão (mm²), com tolerância */
const AREA: Record<string, [number, number]> = {
  plate: [60 * 40 - (4 - Math.PI) * 9, 0.01],
  bar: [(80 - 8) * 8 + Math.PI * 16, 0.01],
  disc: [Math.PI * 225, 0.002],
  block: [400, 0.001],
  lever: [(60 - 10) * 10 + Math.PI * 25 - 2 * Math.PI * 4, 0.01],
  ball: [Math.PI * 9, 0.002],
  "plate-hole": [40 * 30 - (4 - Math.PI) * 4 - Math.PI * 9, 0.01],
  "plate-slot": [40 * 16 - (4 - Math.PI) * 4 - (16 * 4 + Math.PI * 4), 0.01],
};

describe("peças prontas", () => {
  it("são onze, com nome, parâmetros com faixa e unidade, e padrões dentro da faixa", () => {
    expect(GENERATORS.map((g) => g.id)).toEqual([
      "plate",
      "bar",
      "disc",
      "block",
      "lever",
      "ball",
      "gear",
      "ratchet",
      "rack",
      "plate-hole",
      "plate-slot",
    ]);
    for (const g of GENERATORS) {
      expect(g.name.length).toBeGreaterThan(2);
      for (const p of g.params) {
        expect(p.min).toBeLessThan(p.max);
        expect(p.default).toBeGreaterThanOrEqual(p.min);
        expect(p.default).toBeLessThanOrEqual(p.max);
      }
      for (const k of g.main) expect(g.params.some((p) => p.key === k)).toBe(true);
    }
  });

  for (const g of GENERATORS)
    it(`${g.name}: forma válida no padrão e nos limites dos parâmetros, com área coerente`, () => {
      const cases = [defaults(g)];
      for (const p of g.params) {
        cases.push(clampParams(g, { ...defaults(g), [p.key]: p.min }));
        cases.push(clampParams(g, { ...defaults(g), [p.key]: p.max }));
      }
      for (const params of cases) {
        const shape = g.build(params);
        const o = shapeOutline(shape);
        expect(o.ok, `${g.id} ${JSON.stringify(params)}`).toBe(true);
        const geo = shapeGeometry(shape);
        expect(geo.ok, `${g.id} decomposição ${JSON.stringify(params)}`).toBe(true);
        if (o.ok) expect(o.value.mass.area).toBeGreaterThan(0);
      }
      const exp = AREA[g.id];
      if (exp) {
        const o = shapeOutline(g.build(defaults(g)));
        if (!o.ok) throw new Error("forma");
        expect(Math.abs(o.value.mass.area - exp[0]) / exp[0]).toBeLessThan(exp[1]);
      }
      // espelhada também vale
      const part = buildPart(blank, g.id, { x: 0, y: 0, layer: "L2" });
      const m = mirroredShape(part);
      if (m) expect(shapeOutline(m).ok).toBe(true);
    });

  it("peça nova: próximo número de chamada, nome com número, fixa só na camada 1", () => {
    const a = buildPart(blank, "bar", { x: 0, y: 0, layer: "L1" });
    expect(a.fixed).toBe(true);
    expect(a.name).toBe("Barra 1");
    const s1 = { ...blank, parts: [a] };
    const b = buildPart(s1, "bar", { x: 0, y: 0, layer: "L2" });
    expect(b.fixed).toBe(false);
    expect(b.name).toBe("Barra 2");
    expect(b.ref).toBe(a.ref + 1);
    expect(b.source?.generator).toBe("bar");
    expect(validateScene({ ...s1, parts: [a, b] }).ok).toBe(true);
  });

  it("mudar o tamanho refaz a forma pelos parâmetros", () => {
    const a = buildPart(blank, "bar", { x: 0, y: 0, layer: "L2" });
    const s = { ...blank, parts: [a] };
    const cmd = regenerate(s, a.id, { l: 120 })!;
    const next = run(s, cmd.label, cmd.recipe)!.scene;
    expect(paramsOf(next.parts[0]!)!.params.l).toBe(120);
    const o = shapeOutline(next.parts[0]!.shape);
    if (!o.ok) throw new Error("forma");
    expect(o.value.mass.area).toBeCloseTo((120 - 8) * 8 + Math.PI * 16, 0);
    expect(regenerate(next, a.id, { l: 120 })).toBeNull();
  });
});
