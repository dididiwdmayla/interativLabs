import type { Vec2 } from "@/geometry/vec";

/**
 * Vista do palco: zoom e deslocamento. Escala de tela de 5 px por mm no
 * zoom 1 (docs/arquitetura.md §4), zoom de 0,15× a 8×.
 * Tela = mundo · (5 · zoom) + (tx, ty), em px CSS.
 */

export const PX_PER_MM = 5;
export const ZOOM_MIN = 0.15;
export const ZOOM_MAX = 8;

export interface View {
  zoom: number;
  tx: number;
  ty: number;
}

export type Box = [x: number, y: number, w: number, h: number];

export const scaleOf = (v: View) => PX_PER_MM * v.zoom;
/** mm de cena por px de tela */
export const mmPerPx = (zoom: number) => 1 / (PX_PER_MM * zoom);

export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export function toWorld(v: View, sx: number, sy: number): Vec2 {
  const s = scaleOf(v);
  return [(sx - v.tx) / s, (sy - v.ty) / s];
}

export function toScreen(v: View, p: Vec2): Vec2 {
  const s = scaleOf(v);
  return [p[0] * s + v.tx, p[1] * s + v.ty];
}

/** Matriz do grupo do mundo. */
export function viewMatrix(v: View): string {
  const s = scaleOf(v);
  return `matrix(${s} 0 0 ${s} ${v.tx} ${v.ty})`;
}

/** Enquadra a caixa (mm) na área de w × h px, com margens em px (cima, direita, baixo, esquerda). */
export function fitView(box: Box, w: number, h: number, pad: [number, number, number, number]): View {
  const [top, right, bottom, left] = pad;
  const aw = Math.max(40, w - left - right);
  const ah = Math.max(40, h - top - bottom);
  const zoom = clampZoom(Math.min(aw / box[2], ah / box[3]) / PX_PER_MM);
  const s = PX_PER_MM * zoom;
  return {
    zoom,
    tx: left + aw / 2 - (box[0] + box[2] / 2) * s,
    ty: top + ah / 2 - (box[1] + box[3] / 2) * s,
  };
}

/** Retângulo de tela, px. */
export interface ScreenRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Enquadra a caixa (mm) na área de w × h px desviando dos controles que
 * flutuam sobre a prancha (cantos, título, abas, faixa do Testar): a maior
 * escala em que a caixa, com `gap` px de folga, não encosta em nenhum
 * obstáculo nem passa da borda `edge` (cima, direita, baixo, esquerda: as
 * áreas seguras). Prova alguns centros perto do meio da tela. Só desconta o
 * espaço que os controles cobrem: uma caixa estreita sobe entre os cantos,
 * uma larga passa entre as abas.
 */
export function fitAround(
  box: Box,
  w: number,
  h: number,
  obstacles: ScreenRect[],
  edge: [number, number, number, number],
  gap = 8,
): View {
  const [top, right, bottom, left] = edge;
  const ax0 = left;
  const ay0 = top;
  const ax1 = w - right;
  const ay1 = h - bottom;
  const obs = obstacles.map((o) => ({ x0: o.x0 - gap, y0: o.y0 - gap, x1: o.x1 + gap, y1: o.y1 + gap }));
  const aspect = box[2] / Math.max(1e-6, box[3]);
  const free = (cx: number, cy: number, hw: number) => {
    const hh = hw / aspect;
    const x0 = cx - hw;
    const x1 = cx + hw;
    const y0 = cy - hh;
    const y1 = cy + hh;
    if (x0 < ax0 || x1 > ax1 || y0 < ay0 || y1 > ay1) return false;
    return obs.every((o) => o.x1 <= x0 || o.x0 >= x1 || o.y1 <= y0 || o.y0 >= y1);
  };
  const mx = (ax0 + ax1) / 2;
  const my = (ay0 + ay1) / 2;
  let best = { hw: 0, cx: mx, cy: my };
  for (const fy of [0, -0.03, 0.03, -0.06, 0.06, -0.1, 0.1])
    for (const fx of [0, -0.03, 0.03]) {
      const cx = mx + fx * w;
      const cy = my + fy * h;
      let lo = 0;
      let hi = (ax1 - ax0) / 2;
      if (!free(cx, cy, 1)) continue;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (free(cx, cy, mid)) lo = mid;
        else hi = mid;
      }
      if (lo > best.hw + 0.5) best = { hw: lo, cx, cy };
    }
  if (best.hw <= 0) return fitView(box, w, h, [top, right, bottom, left]);
  const zoom = clampZoom((2 * best.hw) / box[2] / PX_PER_MM);
  const s = PX_PER_MM * zoom;
  return {
    zoom,
    tx: best.cx - (box[0] + box[2] / 2) * s,
    ty: best.cy - (box[1] + box[3] / 2) * s,
  };
}

/** Zoom multiplicado por `factor` em torno do ponto de tela (sx, sy). */
export function zoomAt(v: View, factor: number, sx: number, sy: number): View {
  const zoom = clampZoom(v.zoom * factor);
  const k = zoom / v.zoom;
  return { zoom, tx: sx - (sx - v.tx) * k, ty: sy - (sy - v.ty) * k };
}

export const panBy = (v: View, dx: number, dy: number): View => ({ ...v, tx: v.tx + dx, ty: v.ty + dy });

/**
 * Degrau da hachura: a escala da textura é 2ᵏ, para o passo entre linhas
 * ficar perto do de base na tela (fator zoom · 2ᵏ entre 0,71 e 1,41).
 */
export function hatchStep(zoom: number): number {
  return Math.round(-Math.log2(zoom));
}
