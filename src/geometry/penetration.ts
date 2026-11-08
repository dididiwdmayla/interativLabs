import { dhypot } from "./dmath";
import type { Vec2 } from "./vec";

/** A convex piece in world coordinates: a circle or a polygon (any winding). */
export type WorldPiece = { kind: "circle"; c: Vec2; r: number } | { kind: "poly"; points: Vec2[] };

const signedArea = (p: Vec2[]): number => {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i]!;
    const n = p[(i + 1) % p.length]!;
    a += q[0] * n[1] - n[0] * q[1];
  }
  return a / 2;
};

/** Edge normals (unit, pointing out) of a convex polygon, with a point on each edge. */
function edges(p: Vec2[]): { n: Vec2; o: Vec2 }[] {
  const out = signedArea(p) >= 0 ? 1 : -1;
  return p.map((q, i) => {
    const next = p[(i + 1) % p.length]!;
    const dx = next[0] - q[0];
    const dy = next[1] - q[1];
    const l = dhypot(dx, dy) || 1;
    return { n: [(dy / l) * out, (-dx / l) * out] as Vec2, o: q };
  });
}

/** Largest separation of polygon `b` from the faces of polygon `a` (negative when `b` is behind them all). */
function maxSeparation(a: Vec2[], b: Vec2[]): number {
  let best = -Infinity;
  for (const { n, o } of edges(a)) {
    let min = Infinity;
    for (const v of b) min = Math.min(min, n[0] * (v[0] - o[0]) + n[1] * (v[1] - o[1]));
    best = Math.max(best, min);
  }
  return best;
}

/**
 * Signed separation between two convex pieces, mm: positive is the gap, negative is the
 * penetration depth along the axis of least overlap (the same quantity as the `separation`
 * of a Box2D polygon manifold). Used where the engine produces no contact: two fixed
 * parts, or any pair before the first step.
 */
export function pieceSeparation(a: WorldPiece, b: WorldPiece): number {
  if (a.kind === "circle" && b.kind === "circle") return dhypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) - a.r - b.r;
  if (a.kind === "circle" && b.kind === "poly") return pieceSeparation(b, a);
  if (a.kind === "poly" && b.kind === "circle") {
    let best = -Infinity;
    for (const { n, o } of edges(a.points))
      best = Math.max(best, n[0] * (b.c[0] - o[0]) + n[1] * (b.c[1] - o[1]));
    return best - b.r;
  }
  if (a.kind === "poly" && b.kind === "poly")
    return Math.max(maxSeparation(a.points, b.points), maxSeparation(b.points, a.points));
  return Infinity;
}
