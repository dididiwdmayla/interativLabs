import type { Ring } from "./polygon";
import type { Vec2 } from "./vec";
import { dacos, datan2, dcos, dhypot, dsin } from "./dmath";

/** Tolerância de corda dos arcos, mm. */
export const CHORD_TOL = 0.02;
/** Mínimo de segmentos numa volta inteira. */
export const MIN_SEGMENTS_PER_TURN = 12;

/** Número de segmentos de um arco de raio r e abertura `sweep` (rad). */
export function arcSegments(r: number, sweep: number, tol = CHORD_TOL): number {
  const s = Math.abs(sweep);
  if (!(r > 0) || !(s > 0)) return 1;
  const byChord = tol < r ? Math.ceil(s / (2 * dacos(1 - tol / r))) : 1;
  const byMin = Math.ceil((MIN_SEGMENTS_PER_TURN * s) / (2 * Math.PI) - 1e-9);
  return Math.max(1, byChord, byMin);
}

/** Pontos de um arco de a0 a a1 (rad), com as duas pontas. */
export function arcPoints(c: Vec2, r: number, a0: number, a1: number, tol = CHORD_TOL): Vec2[] {
  const n = arcSegments(r, a1 - a0, tol);
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([c[0] + r * dcos(a), c[1] + r * dsin(a)]);
  }
  return out;
}

/** Círculo discretizado, anti-horário. */
export function circleRing(c: Vec2, r: number, tol = CHORD_TOL): Ring {
  const n = arcSegments(r, 2 * Math.PI, tol);
  const out: Ring = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    out.push([c[0] + r * dcos(a), c[1] + r * dsin(a)]);
  }
  return out;
}

/**
 * Rasgo (estádio): retângulo de p1 a p2 com pontas semicirculares, largura
 * total `width`. Anti-horário. Com p1 = p2 vira um círculo.
 */
export function slotRing(p1: Vec2, p2: Vec2, width: number, tol = CHORD_TOL): Ring {
  const r = width / 2;
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  if (dhypot(dx, dy) < 1e-9) return circleRing(p1, r, tol);
  const a = datan2(dy, dx);
  const end2 = arcPoints(p2, r, a - Math.PI / 2, a + Math.PI / 2, tol);
  const end1 = arcPoints(p1, r, a + Math.PI / 2, a + (3 * Math.PI) / 2, tol);
  return [...end2, ...end1];
}

/** Retângulo alinhado, anti-horário. */
export function rectRing(x0: number, y0: number, x1: number, y1: number): Ring {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}
