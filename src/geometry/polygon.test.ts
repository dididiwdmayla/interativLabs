import { describe, expect, it } from "vitest";
import {
  area,
  bounds,
  cleanRing,
  containsPoint,
  massProps,
  normalize,
  signedArea,
  type PolyWithHoles,
  type Ring,
} from "./polygon";
import { circleRing, rectRing, slotRing, arcSegments } from "./primitives";

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);
const square: Ring = rectRing(0, 0, 10, 10);
const L: Ring = [
  [0, 0],
  [20, 0],
  [20, 5],
  [5, 5],
  [5, 20],
  [0, 20],
];

describe("área, centroide e inércia", () => {
  it("quadrado", () => {
    const m = massProps({ outer: square, holes: [] });
    expect(rel(m.area, 100)).toBeLessThan(1e-3);
    expect(m.centroid[0]).toBeCloseTo(5, 9);
    expect(m.centroid[1]).toBeCloseTo(5, 9);
    expect(rel(m.inertia, 10 ** 4 / 6)).toBeLessThan(1e-3);
  });

  it("círculo discretizado: fórmulas do polígono regular e o círculo real", () => {
    const r = 10;
    const ring = circleRing([3, -4], r, 0.002);
    const n = ring.length;
    const m = massProps({ outer: ring, holes: [] });
    const t = (2 * Math.PI) / n;
    expect(rel(m.area, (n / 2) * r * r * Math.sin(t))).toBeLessThan(1e-9);
    expect(rel(m.inertia, ((n * r ** 4) / 12) * Math.sin(t) * (2 + Math.cos(t)))).toBeLessThan(1e-9);
    expect(rel(m.area, Math.PI * r * r)).toBeLessThan(1e-3);
    expect(rel(m.inertia, (Math.PI * r ** 4) / 2)).toBeLessThan(1e-3);
    expect(m.centroid[0]).toBeCloseTo(3, 9);
    expect(m.centroid[1]).toBeCloseTo(-4, 9);
  });

  it("L contra a soma de dois retângulos", () => {
    const rects = [
      { a: 100, c: [10, 2.5], w: 20, h: 5 },
      { a: 75, c: [2.5, 12.5], w: 5, h: 15 },
    ];
    const A = 175;
    const cx = (100 * 10 + 75 * 2.5) / A;
    const cy = (100 * 2.5 + 75 * 12.5) / A;
    const J = rects.reduce(
      (s, r) => s + (r.a * (r.w ** 2 + r.h ** 2)) / 12 + r.a * ((r.c[0]! - cx) ** 2 + (r.c[1]! - cy) ** 2),
      0,
    );
    const m = massProps({ outer: L, holes: [] });
    expect(rel(m.area, A)).toBeLessThan(1e-3);
    expect(rel(m.centroid[0], cx)).toBeLessThan(1e-3);
    expect(rel(m.centroid[1], cy)).toBeLessThan(1e-3);
    expect(rel(m.inertia, J)).toBeLessThan(1e-3);
  });

  it("orientação não muda o resultado; furo desconta área e inércia", () => {
    const hole = rectRing(4, 4, 6, 6);
    const a = massProps({ outer: square.slice().reverse(), holes: [hole] });
    const b = massProps({ outer: square, holes: [hole.slice().reverse()] });
    expect(a.area).toBeCloseTo(96, 9);
    expect(b.area).toBeCloseTo(96, 9);
    expect(a.inertia).toBeCloseTo(10 ** 4 / 6 - 2 ** 4 / 6, 6);
    expect(area({ outer: square, holes: [hole] })).toBeCloseTo(96, 9);
  });

  it("caixa envolvente", () => {
    expect(bounds({ outer: L, holes: [] })).toEqual({ minX: 0, minY: 0, maxX: 20, maxY: 20 });
  });
});

describe("ponto dentro da forma", () => {
  const plate: PolyWithHoles = { outer: rectRing(0, 0, 20, 20), holes: [circleRing([10, 10], 3)] };
  it("dentro, fora, no furo e nas bordas", () => {
    expect(containsPoint(plate, [2, 2])).toBe(true);
    expect(containsPoint(plate, [-1, 5])).toBe(false);
    expect(containsPoint(plate, [10, 10])).toBe(false);
    expect(containsPoint(plate, [0, 7])).toBe(true);
    expect(containsPoint(plate, [20, 20])).toBe(true);
    expect(containsPoint(plate, [13, 10])).toBe(true);
    expect(containsPoint(plate, [12.9, 10])).toBe(false);
  });
});

describe("normalização e limpeza", () => {
  it("externo anti-horário, furos horários", () => {
    const n = normalize({ outer: square.slice().reverse(), holes: [rectRing(2, 2, 3, 3)] });
    expect(signedArea(n.outer)).toBeGreaterThan(0);
    expect(signedArea(n.holes[0]!)).toBeLessThan(0);
  });

  it("tira repetidos (< 0,01 mm) e colineares (< 0,005 mm)", () => {
    const dirty: Ring = [
      [0, 0],
      [0.004, 0],
      [5, 0.003],
      [10, 0],
      [10, 10],
      [10, 10.009],
      [0, 10],
      [0.001, 0.002],
    ];
    expect(cleanRing(dirty)).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]);
    const keep: Ring = [
      [0, 0],
      [5, 0.02],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    expect(cleanRing(keep)).toHaveLength(5);
  });
});

describe("furo e rasgo", () => {
  it("arcos: tolerância de corda de 0,02 mm e no mínimo 12 segmentos por volta", () => {
    expect(arcSegments(0.5, 2 * Math.PI)).toBe(12);
    const r = 50;
    const n = arcSegments(r, 2 * Math.PI);
    expect(r * (1 - Math.cos(Math.PI / n))).toBeLessThanOrEqual(0.02 + 1e-12);
    expect(r * (1 - Math.cos(Math.PI / (n - 1)))).toBeGreaterThan(0.02);
  });

  it("rasgo é um estádio anti-horário com a área certa", () => {
    const s = slotRing([0, 0], [10, 0], 4, 0.001);
    expect(signedArea(s)).toBeGreaterThan(0);
    expect(rel(signedArea(s), 10 * 4 + Math.PI * 4)).toBeLessThan(1e-3);
  });
});
