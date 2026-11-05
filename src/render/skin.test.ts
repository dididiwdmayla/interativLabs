import { describe, expect, it } from "vitest";
import { offsetShapes } from "@/geometry/clip";
import { area, containsPoint, type PolyWithHoles } from "@/geometry/polygon";
import { circleRing, rectRing, slotRing } from "@/geometry/primitives";
import type { Scene } from "@/model/types";
import { HATCHES, hatchScale } from "./hatch";
import { prepareScene } from "./prepare";
import { BEVEL, partSkin } from "./skin";
import { hatchStep, mmPerPx } from "./view";

const NOW = "2026-11-04T00:00:00.000Z";

/** Placa 40 × 20 mm com um furo redondo e um rasgo. */
const holed: PolyWithHoles = {
  outer: rectRing(-20, -10, 20, 10),
  holes: [circleRing([-10, 0], 3).reverse(), slotRing([4, 0], [14, 0], 4).reverse()],
};

function sceneWith(shape: PolyWithHoles, fixed = false): Scene {
  return {
    version: 3,
    meta: { title: "t", createdAt: NOW, updatedAt: NOW },
    settings: { gravity: { on: true, g: 9810 }, snap: { grid: 1, on: true } },
    layers: [{ id: "L1", name: "a", visible: true, locked: false, thickness: 3 }],
    parts: [
      {
        id: "p1",
        ref: 1,
        name: "placa",
        layer: "L1",
        x: 0,
        y: 0,
        angle: 0,
        shape: { kind: "poly", outer: shape.outer, holes: shape.holes },
        material: "steel",
        fixed,
        fast: false,
      },
    ],
    links: [],
  };
}

const rings = (d: string) => (d.match(/M/g) ?? []).length;

describe("chanfro por offsets (Clipper2)", () => {
  it("encolhe o contorno e faz os furos e o rasgo crescerem", () => {
    const d = 0.8;
    const o = offsetShapes([holed], -d);
    expect(o).toHaveLength(1);
    const s = o[0]!;
    expect(s.holes).toHaveLength(2);
    // ponto logo dentro da borda externa: fora do offset
    expect(containsPoint(s, [19.6, 0])).toBe(false);
    // ponto logo fora do furo redondo (raio 3): agora dentro do furo crescido
    expect(containsPoint(s, [-10 + 3.5, 0])).toBe(false);
    // ponto logo fora da ponta do rasgo (vai até 16): idem
    expect(containsPoint(s, [16.5, 0])).toBe(false);
    // miolo continua dentro
    expect(containsPoint(s, [0, 7])).toBe(true);
    // área perdida ≈ perímetro × d (externo 120 mm, furo 18,8, rasgo 32,6)
    const lost = area(holed) - area(s);
    expect(lost).toBeGreaterThan(0.9 * (120 + 18.8 + 32.6) * d);
    expect(lost).toBeLessThan(1.1 * (120 + 18.8 + 32.6) * d);
  });

  it("monta as faixas do chanfro com contorno externo, furo e rasgo", () => {
    const model = prepareScene(sceneWith(holed));
    const m = model.parts.get("p1")!;
    const skin = partSkin(m, 1);
    expect(skin.tiny).toBe(false);
    // cada faixa evenodd = dois offsets de 3 anéis (externo, furo, rasgo)
    expect(rings(skin.light)).toBe(6);
    expect(rings(skin.faint)).toBe(6);
    expect(rings(skin.inner)).toBe(3);
    expect(skin.core).toBe("");
  });

  it("corpo fixo ganha o miolo do pautado, 8 px para dentro da hachura", () => {
    const model = prepareScene(sceneWith(holed, true));
    const m = model.parts.get("p1")!;
    expect(m.body).toBe(true);
    // no zoom 4, 12 px = 0,6 mm: o rasgo ainda não encosta na borda
    const skin = partSkin(m, 4);
    expect(rings(skin.core)).toBe(3);
    const core = offsetShapes(m.outline, -BEVEL.body * mmPerPx(4));
    const inner = offsetShapes(m.outline, -BEVEL.faint * mmPerPx(4));
    expect(area(inner[0]!) - area(core[0]!)).toBeGreaterThan(0);
  });

  it("peça pequena na tela vira tom liso, sem chanfro", () => {
    const tiny: PolyWithHoles = { outer: rectRing(-2, -2, 2, 2), holes: [] };
    const m = prepareScene(sceneWith(tiny)).parts.get("p1")!;
    expect(partSkin(m, 1).tiny).toBe(true); // 4 mm × 5 px = 20 px < 24
    expect(partSkin(m, 2).tiny).toBe(false);
  });
});

describe("hachura por degraus de 2ᵏ", () => {
  it("o passo na tela fica entre 0,7 e 1,42 do de base em todo o zoom", () => {
    for (let z = 0.15; z <= 8; z *= 1.07) {
      const k = hatchStep(z);
      // px de tela por px base do padrão
      const factor = (hatchScale(k) / 0.2) * z;
      expect(factor).toBeGreaterThanOrEqual(0.7);
      expect(factor).toBeLessThanOrEqual(1.42);
      // aço: um par a cada 6 px base → entre 4,2 e 8,5 px de tela
      const steel = HATCHES.steel.w * factor;
      expect(steel).toBeGreaterThan(4);
      expect(steel).toBeLessThan(8.6);
    }
  });
});
