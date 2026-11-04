import { describe, expect, it } from "vitest";
import { intersection, union } from "./clip";
import { MAX_POLY_VERTICES, piecesArea, type Piece } from "./decompose";
import { involuteGear, rack, ratchet, type GearGeometry } from "./gear";
import { area, isConvex, signedArea, transformShape, type PolyWithHoles } from "./polygon";
import { circleRing } from "./primitives";
import { ratchetFromGearShape } from "./shape";
import { segmentDistance, type Vec2 } from "./vec";

const must = <T>(r: { ok: true; value: T } | { ok: false; error: { message: string } }): T => {
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

type Seg = readonly [Vec2, Vec2];
const segs = (s: PolyWithHoles, keep: (p: Vec2) => boolean): Seg[] =>
  s.outer.flatMap((p, i) => {
    const q = s.outer[(i + 1) % s.outer.length]!;
    return keep(p) || keep(q) ? [[p, q] as const] : [];
  });

function minDistance(a: Seg[], b: Seg[]): number {
  let m = Infinity;
  for (const [p, q] of a) for (const [r, s] of b) m = Math.min(m, segmentDistance(p, q, r, s));
  return m;
}

const interArea = (a: PolyWithHoles, b: PolyWithHoles) => {
  const r = must(intersection(a, b));
  return r.reduce((s, p) => s + area(p), 0);
};

describe("malha de engrenagens evolventes (módulo 1)", () => {
  for (const [z1, z2] of [
    [12, 24],
    [14, 32],
    [20, 20],
  ] as const) {
    it(`${z1} × ${z2}: 360 posições sem interferência e engrenadas`, () => {
      const m = 1;
      const g1 = must(involuteGear({ module: m, teeth: z1 }));
      const g2 = must(involuteGear({ module: m, teeth: z2 }));
      const C = (m * (z1 + z2)) / 2;
      // Pinhão com um vão em 0 rad; a coroa põe um dente em π.
      const phase2 = Math.PI - Math.PI / z2;
      let maxInter = 0;
      let maxDist = 0;
      for (let i = 0; i < 360; i++) {
        const th = (i * Math.PI) / 180;
        const A = transformShape(g1.outline, 0, 0, th);
        const B = transformShape(g2.outline, C, 0, phase2 - (th * z1) / z2);
        maxInter = Math.max(maxInter, interArea(A, B));
        const near = (c: Vec2, r: number) => (p: Vec2) => Math.hypot(p[0] - c[0], p[1] - c[1]) < r + 0.5 * m;
        const d = minDistance(segs(A, near([C, 0], g2.tipRadius)), segs(B, near([0, 0], g1.tipRadius)));
        maxDist = Math.max(maxDist, d);
      }
      expect(maxInter).toBeLessThan(1e-4);
      expect(maxDist).toBeLessThan(0.1 * m);
    });
  }

  it("pinhão de 12 dentes contra cremalheira: 360 posições", () => {
    const m = 1;
    const z = 12;
    const g = must(involuteGear({ module: m, teeth: z }));
    const rk = must(rack({ module: m, teeth: 24, bodyHeight: 3 }));
    const r = (m * z) / 2;
    const x0 = 18.5 * Math.PI * m;
    let maxInter = 0;
    let maxDist = 0;
    for (let i = 0; i < 360; i++) {
      const th = (i * Math.PI) / 180;
      const P = transformShape(g.outline, x0, r, th);
      const R = transformShape(rk.outline, r * th, 0, 0);
      maxInter = Math.max(maxInter, interArea(P, R));
      const d = minDistance(
        segs(P, (p) => p[1] < m + 0.5 * m),
        segs(R, (p) => Math.hypot(p[0] - x0, p[1] - r) < g.tipRadius + 0.5 * m),
      );
      maxDist = Math.max(maxDist, d);
    }
    expect(maxInter).toBeLessThan(1e-4);
    expect(maxDist).toBeLessThan(0.1 * m);
  });

  it("pelo menos 8 pontos por flanco e dentes de 8 a 200", () => {
    for (const z of [8, 12, 40, 200]) {
      const g = must(involuteGear({ module: 1, teeth: z }));
      // pontos acima do círculo de base num dente (os dois flancos)
      const pitch = (2 * Math.PI) / z;
      const flank = g.outline.outer.filter((p) => {
        const a = Math.atan2(p[1], p[0]);
        const rr = Math.hypot(p[0], p[1]);
        const da = Math.abs(((a - 0.5 * pitch + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
        return da < pitch / 2 && rr > Math.max(g.baseRadius, g.rootRadius) + 1e-6 && rr < g.tipRadius - 1e-6;
      });
      expect(flank.length).toBeGreaterThanOrEqual(16);
    }
    expect(involuteGear({ module: 1, teeth: 7 }).ok).toBe(false);
    expect(involuteGear({ module: 1, teeth: 201 }).ok).toBe(false);
    expect(involuteGear({ module: 0, teeth: 20 }).ok).toBe(false);
  });
});

function checkShape(outline: PolyWithHoles) {
  const u = must(union(outline));
  expect(u).toHaveLength(1);
  expect(Math.abs(area(u[0]!) - area(outline)) / area(outline)).toBeLessThan(1e-4);
}

function checkPieces(g: GearGeometry, coverMin: number) {
  const polys: PolyWithHoles[] = g.pieces.map((p: Piece) =>
    p.kind === "circle" ? { outer: circleRing(p.c, p.r), holes: [] } : { outer: p.points, holes: [] },
  );
  for (const p of g.pieces) {
    if (p.kind === "poly") {
      expect(isConvex(p.points)).toBe(true);
      expect(signedArea(p.points)).toBeGreaterThan(0.05);
      expect(p.points.length).toBeLessThanOrEqual(MAX_POLY_VERTICES);
    } else expect(p.r).toBeGreaterThan(0);
  }
  const all = must(union(polys));
  const covered = all.reduce((s, p) => s + area(p), 0);
  const inside = must(intersection(all, g.outline)).reduce((s, p) => s + area(p), 0);
  const A = area(g.outline);
  expect(inside / A).toBeGreaterThan(coverMin);
  // o que passa da forma (fecho sobre o rebaixo, cordas do furo) é desprezível
  expect((covered - inside) / A).toBeLessThan(0.005);
  expect(piecesArea(g.pieces)).toBeGreaterThan(0);
}

describe("formas e decomposição de engrenagem e catraca", () => {
  it("engrenagem com furo central", () => {
    const g = must(involuteGear({ module: 1.5, teeth: 18, bore: 6 }));
    expect(g.outline.holes).toHaveLength(1);
    checkShape(g.outline);
    // O pé do dente, abaixo da profundidade de trabalho (r − m), fica fora da
    // forma de colisão: nenhuma vizinha chega lá. A massa usa o contorno inteiro.
    checkPieces(g, 0.9);
    expect(g.pieces.filter((p) => p.kind === "poly").length).toBeGreaterThan(18);
  });

  it("engrenagem sem furo: núcleo circular + um polígono por dente", () => {
    const g = must(involuteGear({ module: 1, teeth: 12 }));
    expect(g.pieces[0]).toEqual({ kind: "circle", c: [0, 0], r: g.rootRadius });
    expect(g.pieces).toHaveLength(13);
    checkShape(g.outline);
    checkPieces(g, 0.9);
  });

  it("catraca com e sem furo", () => {
    for (const bore of [0, 4]) {
      const r = must(ratchet({ teeth: 14, outerRadius: 12, depth: 2.4, bore }));
      expect(r.outline.holes).toHaveLength(bore ? 1 : 0);
      checkShape(r.outline);
      checkPieces(r, 0.97);
    }
  });

  it("catraca da cena migrada (módulo do v1) mantém as proporções do protótipo", () => {
    const m = (2 * 10.4) / 14;
    const r = must(ratchetFromGearShape(m, 14, 0));
    expect(r.tipRadius).toBeCloseTo(10.4 + 0.4 * ((Math.PI * 10.4) / 14), 9);
    expect(r.rootRadius).toBeCloseTo(10.4 - 0.6 * ((Math.PI * 10.4) / 14), 9);
  });

  it("cremalheira: forma e peças válidas", () => {
    const rk = must(rack({ module: 1, teeth: 10, bodyHeight: 3 }));
    checkShape(rk.outline);
    expect(rk.length).toBeCloseTo(10 * Math.PI, 9);
    const polys = rk.pieces.map((p) => (p.kind === "poly" ? p.points : []));
    expect(polys.every((p) => isConvex(p) && p.length <= 8)).toBe(true);
    expect(Math.abs(piecesArea(rk.pieces) - area(rk.outline)) / area(rk.outline)).toBeLessThan(1e-9);
  });

  it("entradas inválidas devolvem erro, sem exceção", () => {
    expect(ratchet({ teeth: 2, outerRadius: 10, depth: 1 }).ok).toBe(false);
    expect(ratchet({ teeth: 10, outerRadius: 10, depth: 12 }).ok).toBe(false);
    expect(involuteGear({ module: 1, teeth: 20, bore: 30 }).ok).toBe(false);
    expect(rack({ module: 1, teeth: 0, bodyHeight: 2 }).ok).toBe(false);
  });
});
