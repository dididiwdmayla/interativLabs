import { describe, expect, it } from "vitest";
import { CLIP_SCALE, cut, difference, intersection, makeShape, repairShape, union } from "./clip";
import { area, isConvex, signedArea, type PolyWithHoles } from "./polygon";
import { circleRing, rectRing, slotRing } from "./primitives";

const total = (s: PolyWithHoles[]) => s.reduce((a, p) => a + area(p), 0);
const plate = (w = 20, h = 20): PolyWithHoles => ({ outer: rectRing(0, 0, w, h), holes: [] });

describe("contorno que cruza a si mesmo", () => {
  it("oito vira 2 peças com aviso, sem exceção", () => {
    const r = makeShape([
      [0, 0],
      [10, 10],
      [10, 0],
      [0, 10],
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(2);
    expect(r.warnings).toEqual(["O contorno cruzava a si mesmo e virou 2 peças"]);
    expect(total(r.value)).toBeCloseTo(50, 6);
    for (const p of r.value) expect(signedArea(p.outer)).toBeGreaterThan(0);
  });

  it("forma minúscula dá erro tipado", () => {
    const r = makeShape(rectRing(0, 0, 0.2, 0.2));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toEqual({ code: "too-small", message: "A forma é pequena demais" });
  });

  it("entradas ruins não lançam exceção", () => {
    expect(makeShape([]).ok).toBe(false);
    expect(
      makeShape([
        [0, 0],
        [1, 1],
      ]).ok,
    ).toBe(false);
    expect(
      makeShape([
        [0, 0],
        [NaN, 1],
        [2, 2],
      ]).ok,
    ).toBe(false);
    expect(
      makeShape([
        [0, 0],
        [1e15, 1],
        [2, 2],
      ]).ok,
    ).toBe(false);
    expect(
      makeShape([
        [0, 0],
        [1, 1],
        [2, 2],
      ]).ok,
    ).toBe(false);
  });
});

describe("booleanos", () => {
  it("união, diferença e interseção", () => {
    const a = plate(10, 10);
    const b: PolyWithHoles = { outer: rectRing(5, 5, 15, 15), holes: [] };
    const u = union(a, b);
    const d = difference(a, b);
    const i = intersection(a, b);
    expect(u.ok && d.ok && i.ok).toBe(true);
    if (!u.ok || !d.ok || !i.ok) return;
    expect(total(u.value)).toBeCloseTo(175, 6);
    expect(total(d.value)).toBeCloseTo(75, 6);
    expect(total(i.value)).toBeCloseTo(25, 6);
  });

  it("escala inteira de 10 000 por mm", () => {
    expect(CLIP_SCALE).toBe(10_000);
    const r = union({ outer: rectRing(0, 0, 0.00012, 1), holes: [] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(total(r.value)).toBeCloseTo(0.0001, 9);
  });

  it("união de várias formas mantém furos e ilhas", () => {
    const ring: PolyWithHoles = { outer: circleRing([0, 0], 10), holes: [circleRing([0, 0], 6).reverse()] };
    const island: PolyWithHoles = { outer: circleRing([0, 0], 3), holes: [] };
    const r = union([ring, island]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(2);
    expect(r.value[0]!.holes).toHaveLength(1);
  });
});

describe("furo e rasgo", () => {
  it("furo encostado na borda (tangente): resultado válido", () => {
    const r = cut(plate(), circleRing([5, 10], 5));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(1);
    expect(r.warnings).toEqual([]);
    expect(total(r.value)).toBeCloseTo(400 - Math.abs(signedArea(circleRing([5, 10], 5))), 2);
  });

  it("furo que vaza a borda vira um recorte, sem exceção", () => {
    const hole = circleRing([0, 10], 5);
    const r = cut(plate(), hole);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(1);
    expect(r.value[0]!.holes).toHaveLength(0);
    expect(total(r.value)).toBeCloseTo(400 - Math.abs(signedArea(hole)) / 2, 3);
    const viaRepair = repairShape({ outer: rectRing(0, 0, 20, 20), holes: [hole] });
    expect(viaRepair.ok).toBe(true);
    if (viaRepair.ok) expect(total(viaRepair.value)).toBeCloseTo(total(r.value), 6);
  });

  it("rasgo que corta a peça em duas: 2 peças com aviso", () => {
    const r = cut(plate(20, 10), slotRing([10, -5], [10, 15], 2));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(2);
    expect(r.warnings).toContain("O corte dividiu a peça em 2 partes");
    expect(total(r.value)).toBeCloseTo(180, 6);
    for (const p of r.value) expect(isConvex(p.outer)).toBe(true);
  });

  it("corte que remove tudo dá erro tipado", () => {
    const r = cut(plate(2, 2), rectRing(-1, -1, 3, 3));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("empty");
  });
});
