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
