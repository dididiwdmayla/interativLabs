import { distToSegment, type Vec2 } from "./vec";
import type { Ring } from "./polygon";

/**
 * Reconhece um rasgo reto (estádio: retângulo com pontas semicirculares) num
 * contorno de furo, pela geometria, com tolerância. Usado pelo rasgo em modo
 * `joint` (o pino corre na linha de centro, entre as pontas).
 *
 * Método: eixo principal pelos momentos de área do contorno; extensão ao
 * longo do eixo e na transversal dão o raio (meia largura) e a linha de
 * centro; depois cada vértice e cada ponto médio de aresta precisa ficar à
 * distância "raio" da linha de centro, dentro da tolerância. Só usa
 * operações exatas do IEEE (+, −, ×, ÷, raiz), então dá o mesmo resultado em
 * qualquer plataforma.
 */

export interface StraightSlot {
  /** centros das pontas semicirculares, no espaço do contorno (mm) */
  p1: Vec2;
  p2: Vec2;
  /** meia largura, mm */
  r: number;
  /** comprimento da linha de centro, mm */
  length: number;
}

/** Linha de centro mínima para contar como rasgo (abaixo disso é furo redondo). */
export const MIN_SLOT_TRAVEL = 0.1;

/** Centroide e eixo principal (maior momento de área) de um contorno. */
export function principalAxis(ring: Ring): { c: Vec2; u: Vec2 } | null {
  const n = ring.length;
  if (n < 3) return null;
  // Momentos de área (fórmula do laço), em torno da origem.
  let A = 0;
  let cx = 0;
  let cy = 0;
  let ixx = 0;
  let iyy = 0;
  let ixy = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = ring[i]!;
    const [x1, y1] = ring[(i + 1) % n]!;
    const c = x0 * y1 - x1 * y0;
    A += c;
    cx += (x0 + x1) * c;
    cy += (y0 + y1) * c;
    ixx += (y0 * y0 + y0 * y1 + y1 * y1) * c;
    iyy += (x0 * x0 + x0 * x1 + x1 * x1) * c;
    ixy += (x0 * y1 + 2 * x0 * y0 + 2 * x1 * y1 + x1 * y0) * c;
  }
  A /= 2;
  if (Math.abs(A) < 1e-9) return null;
  cx /= 6 * A;
  cy /= 6 * A;
  // Segundos momentos em torno do centroide (o sinal de A cancela).
  const sxx = iyy / (12 * A) - cx * cx; // ∫x² / A
  const syy = ixx / (12 * A) - cy * cy; // ∫y² / A
  const sxy = ixy / (24 * A) - cx * cy; // ∫xy / A
  // Autovetor do maior autovalor de [[sxx, sxy], [sxy, syy]].
  const half = (sxx - syy) / 2;
  const root = Math.sqrt(half * half + sxy * sxy);
  let ux: number;
  let uy: number;
  if (root < 1e-12) {
    ux = 1;
    uy = 0;
  } else if (half >= 0) {
    ux = half + root;
    uy = sxy;
  } else {
    ux = sxy;
    uy = -half + root;
  }
  const ul = Math.sqrt(ux * ux + uy * uy);
  return { c: [cx, cy], u: [ux / ul, uy / ul] };
}

export function straightSlot(ring: Ring, tolMm = 0.05, tolRel = 0.03): StraightSlot | null {
  const n = ring.length;
  if (n < 4) return null;
  const pa = principalAxis(ring);
  if (!pa) return null;
  const [cx, cy] = pa.c;
  const [ux, uy] = pa.u;
  let tmin = Infinity;
  let tmax = -Infinity;
  let smin = Infinity;
  let smax = -Infinity;
  for (const [x, y] of ring) {
    const dx = x - cx;
    const dy = y - cy;
    const t = dx * ux + dy * uy;
    const s = -dx * uy + dy * ux;
    tmin = Math.min(tmin, t);
    tmax = Math.max(tmax, t);
    smin = Math.min(smin, s);
    smax = Math.max(smax, s);
  }
  const r = (smax - smin) / 2;
  const hl = (tmax - tmin) / 2 - r;
  if (!(r > 0) || hl * 2 < MIN_SLOT_TRAVEL) return null;
  const tm = (tmin + tmax) / 2;
  const sm = (smin + smax) / 2;
  const ox = cx - uy * sm;
  const oy = cy + ux * sm;
  const p1: Vec2 = [ox + ux * (tm - hl), oy + uy * (tm - hl)];
  const p2: Vec2 = [ox + ux * (tm + hl), oy + uy * (tm + hl)];
  const tol = Math.max(tolMm, tolRel * r);
  for (let i = 0; i < n; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    if (Math.abs(distToSegment(a, p1, p2) - r) > tol) return null;
    const m: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (Math.abs(distToSegment(m, p1, p2) - r) > tol) return null;
  }
  return { p1, p2, r, length: 2 * hl };
}
