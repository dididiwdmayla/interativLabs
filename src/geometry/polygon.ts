import { distToSegment, type Vec2 } from "./vec";
import { dcos, dhypot, dsin } from "./dmath";

/** Contorno fechado (o último ponto não repete o primeiro). */
export type Ring = Vec2[];

/** Forma plana: contorno externo anti-horário e furos horários, em mm. */
export interface PolyWithHoles {
  outer: Ring;
  holes: Ring[];
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Tolerâncias de limpeza (mm). */
export const DUPLICATE_TOL = 0.01;
export const COLLINEAR_TOL = 0.005;
/** Tolerância de "na borda" para teste de ponto (mm). */
export const BOUNDARY_TOL = 1e-6;

/** Área com sinal (positiva = anti-horário). */
export function signedArea(ring: Ring): number {
  let s = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % n]!;
    s += p[0] * q[1] - q[0] * p[1];
  }
  return s / 2;
}

/** Área da forma: |externo| − Σ|furos|. */
export function area(shape: PolyWithHoles): number {
  let a = Math.abs(signedArea(shape.outer));
  for (const h of shape.holes) a -= Math.abs(signedArea(h));
  return a;
}

interface Moments {
  a: number;
  sx: number;
  sy: number;
  /** ∫(x² + y²) dA em torno da origem de referência */
  j: number;
}

/** Momentos de um contorno em relação a (ox, oy), com sinal normalizado para positivo. */
function ringMoments(ring: Ring, ox: number, oy: number): Moments {
  let a = 0;
  let sx = 0;
  let sy = 0;
  let ixx = 0;
  let iyy = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % n]!;
    const x0 = p[0] - ox;
    const y0 = p[1] - oy;
    const x1 = q[0] - ox;
    const y1 = q[1] - oy;
    const c = x0 * y1 - x1 * y0;
    a += c;
    sx += (x0 + x1) * c;
    sy += (y0 + y1) * c;
    iyy += (x0 * x0 + x0 * x1 + x1 * x1) * c;
    ixx += (y0 * y0 + y0 * y1 + y1 * y1) * c;
  }
  const sign = a < 0 ? -1 : 1;
  return { a: (sign * a) / 2, sx: (sign * sx) / 6, sy: (sign * sy) / 6, j: (sign * (ixx + iyy)) / 12 };
}

export interface MassProps {
  /** mm² */
  area: number;
  /** mm, no espaço da forma */
  centroid: Vec2;
  /** ∫ r² dA em torno do centroide (mm⁴): inércia polar por unidade de densidade de área */
  inertia: number;
}

/** Área, centroide e momento polar de inércia em torno do centroide, com furos. */
export function massProps(shape: PolyWithHoles): MassProps {
  const ref = shape.outer[0] ?? [0, 0];
  const ox = ref[0];
  const oy = ref[1];
  const m = ringMoments(shape.outer, ox, oy);
  for (const h of shape.holes) {
    const hm = ringMoments(h, ox, oy);
    m.a -= hm.a;
    m.sx -= hm.sx;
    m.sy -= hm.sy;
    m.j -= hm.j;
  }
  if (Math.abs(m.a) < 1e-15) return { area: 0, centroid: [ox, oy], inertia: 0 };
  const cx = m.sx / m.a;
  const cy = m.sy / m.a;
  return { area: m.a, centroid: [cx + ox, cy + oy], inertia: m.j - m.a * (cx * cx + cy * cy) };
}

export function centroid(shape: PolyWithHoles): Vec2 {
  return massProps(shape).centroid;
}

export function polarInertia(shape: PolyWithHoles): number {
  return massProps(shape).inertia;
}

export function ringBounds(ring: Ring): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Caixa envolvente (os furos ficam dentro do externo). */
export function bounds(shape: PolyWithHoles): Bounds {
  return ringBounds(shape.outer);
}

export type PointLocation = "inside" | "outside" | "boundary";

/** Posição de um ponto em relação a um contorno simples. */
export function locateInRing(pt: Vec2, ring: Ring, tol = BOUNDARY_TOL): PointLocation {
  const n = ring.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = ring[j]!;
    const b = ring[i]!;
    if (distToSegment(pt, a, b) <= tol) return "boundary";
    if (b[1] > pt[1] !== a[1] > pt[1]) {
      const x = ((a[0] - b[0]) * (pt[1] - b[1])) / (a[1] - b[1]) + b[0];
      if (pt[0] < x) inside = !inside;
    }
  }
  return inside ? "inside" : "outside";
}

/** Ponto dentro da forma: num furo = fora; na borda (externa ou de furo) = dentro. */
export function containsPoint(shape: PolyWithHoles, pt: Vec2, tol = BOUNDARY_TOL): boolean {
  const o = locateInRing(pt, shape.outer, tol);
  if (o === "outside") return false;
  if (o === "boundary") return true;
  for (const h of shape.holes) {
    if (locateInRing(pt, h, tol) === "inside") return false;
  }
  return true;
}

/** Contorno com a orientação pedida (ccw = área positiva). */
export function orientRing(ring: Ring, ccw: boolean): Ring {
  const a = signedArea(ring);
  return a >= 0 === ccw ? ring.slice() : ring.slice().reverse();
}

/** Externo anti-horário, furos horários. */
export function normalize(shape: PolyWithHoles): PolyWithHoles {
  return { outer: orientRing(shape.outer, true), holes: shape.holes.map((h) => orientRing(h, false)) };
}

/**
 * Limpeza de um contorno: tira vértices repetidos (mais perto que `dupTol`,
 * inclusive o último contra o primeiro) e pontos colineares cujo desvio da
 * reta dos vizinhos é menor que `colTol`. Repete até estabilizar.
 */
export function cleanRing(ring: Ring, dupTol = DUPLICATE_TOL, colTol = COLLINEAR_TOL): Ring {
  let pts = ring.slice();
  let changed = true;
  while (changed && pts.length >= 3) {
    changed = false;
    const out: Ring = [];
    for (const p of pts) {
      const last = out[out.length - 1];
      if (last && dhypot(p[0] - last[0], p[1] - last[1]) < dupTol) {
        changed = true;
        continue;
      }
      out.push(p);
    }
    while (out.length > 1) {
      const a = out[0]!;
      const b = out[out.length - 1]!;
      if (dhypot(a[0] - b[0], a[1] - b[1]) < dupTol) {
        out.pop();
        changed = true;
      } else break;
    }
    pts = out;
    if (pts.length < 3) break;
    for (let i = 0; i < pts.length && pts.length > 3; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length]!;
      const b = pts[i]!;
      const c = pts[(i + 1) % pts.length]!;
      if (distToSegment(b, a, c) < colTol) {
        pts.splice(i, 1);
        i--;
        changed = true;
      }
    }
  }
  return pts;
}

/** Limpa externo e furos; furos degenerados (menos de 3 pontos) saem. */
export function cleanShape(
  shape: PolyWithHoles,
  dupTol = DUPLICATE_TOL,
  colTol = COLLINEAR_TOL,
): PolyWithHoles {
  return {
    outer: cleanRing(shape.outer, dupTol, colTol),
    holes: shape.holes.map((h) => cleanRing(h, dupTol, colTol)).filter((h) => h.length >= 3),
  };
}

/** Contorno convexo (aceita colinearidade), em qualquer orientação. */
export function isConvex(ring: Ring, eps = 1e-9): boolean {
  const n = ring.length;
  if (n < 3) return false;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    const c = ring[(i + 2) % n]!;
    const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    const l = dhypot(b[0] - a[0], b[1] - a[1]) * dhypot(c[0] - b[0], c[1] - b[1]);
    if (Math.abs(z) <= eps * Math.max(l, 1e-30)) continue;
    const s = z > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
}

/** Fecho convexo (cadeia monótona), anti-horário, sem colineares. */
export function convexHull(points: Vec2[]): Ring {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lower: Vec2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && orient2(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0)
      lower.pop();
    lower.push(q);
  }
  const upper: Vec2[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (upper.length >= 2 && orient2(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0)
      upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function orient2(a: Vec2, b: Vec2, c: Vec2): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Aplica pose (translação + rotação) a uma forma. */
export function transformShape(shape: PolyWithHoles, x: number, y: number, angle: number): PolyWithHoles {
  const c = dcos(angle);
  const s = dsin(angle);
  const t = (r: Ring): Ring => r.map(([px, py]) => [px * c - py * s + x, px * s + py * c + y]);
  return { outer: t(shape.outer), holes: shape.holes.map(t) };
}
