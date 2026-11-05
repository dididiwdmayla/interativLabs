import type { Vec2 } from "@/geometry/vec";
import type { Part } from "@/model/types";
import { paramsOf, type Params } from "@/parts";
import type { PartModel } from "@/render/prepare";

/**
 * Alças da peça selecionada (identidade, "Seleção e edição"): girar (arco
 * acima da peça) e esticar. Nas paramétricas, cada alça ajusta um parâmetro
 * principal (comprimento, largura, raio, dentes); nas outras, escala por
 * eixo (laterais) e uniforme (canto). Posições no espaço local da peça, mm.
 */

export interface Handle {
  id: string;
  kind: "rotate" | "stretch";
  local: Vec2;
  /** eixo do esticar: x, y ou uniforme */
  axis?: "x" | "y" | "xy";
  /** parâmetro do gerador (peça paramétrica) */
  param?: string;
}

export interface LocalBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function localBox(m: PartModel): LocalBox {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of m.outline)
    for (const [x, y] of s.outer) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : { x0: -1, y0: -1, x1: 1, y1: 1 };
}

/** @param px mm por px de tela (a alça de girar fica a 26 px da peça) */
export function handlesFor(m: PartModel, px: number): Handle[] {
  const b = localBox(m);
  const out: Handle[] = [{ id: "rotate", kind: "rotate", local: [0, b.y0 - 26 * px] }];
  const pp = paramsOf(m.part);
  if (pp) {
    for (const h of pp.g.handles) {
      const d = h.dist(pp.params);
      out.push({
        id: `p:${h.param}:${h.axis}`,
        kind: "stretch",
        local: h.axis === "x" ? [d, 0] : [0, d],
        axis: h.axis,
        param: h.param,
      });
    }
    return out;
  }
  const kind = m.part.shape.kind;
  if (kind === "circle" || kind === "gear") {
    out.push({ id: "s:xy", kind: "stretch", local: [b.x1, 0], axis: "xy" });
    return out;
  }
  const cy = (b.y0 + b.y1) / 2;
  const cx = (b.x0 + b.x1) / 2;
  out.push(
    { id: "s:x", kind: "stretch", local: [b.x1, cy], axis: "x" },
    { id: "s:y", kind: "stretch", local: [cx, b.y1], axis: "y" },
    { id: "s:xy", kind: "stretch", local: [b.x1, b.y1], axis: "xy" },
  );
  return out;
}

export type StretchResult = { kind: "params"; params: Params } | { kind: "scale"; sx: number; sy: number };

/** Resultado de arrastar a alça de esticar até o ponto (local da peça). */
export function stretchTo(part: Part, h: Handle, p: Vec2): StretchResult | null {
  if (h.kind !== "stretch") return null;
  const pp = paramsOf(part);
  if (pp && h.param) {
    const def = pp.g.handles.find((x) => x.param === h.param && x.axis === h.axis);
    if (!def) return null;
    const d = Math.max(0.25, Math.abs(h.axis === "x" ? p[0] : p[1]));
    return { kind: "params", params: { [h.param]: def.value(d, pp.params) } };
  }
  const k = (a: number, b: number) => Math.max(0.05, Math.abs(b) > 1e-9 ? a / b : 1);
  if (h.axis === "x") return { kind: "scale", sx: k(p[0], h.local[0]), sy: 1 };
  if (h.axis === "y") return { kind: "scale", sx: 1, sy: k(p[1], h.local[1]) };
  // uniforme: projeção na diagonal da alça
  const L2 = h.local[0] ** 2 + h.local[1] ** 2;
  const s = L2 > 0 ? (p[0] * h.local[0] + p[1] * h.local[1]) / L2 : 1;
  return { kind: "scale", sx: Math.max(0.05, s), sy: Math.max(0.05, s) };
}
