import { containsPoint } from "@/geometry/polygon";
import { distToSegment, type Vec2 } from "@/geometry/vec";
import type { Id } from "@/model/types";
import type { FrameSource } from "./nodes";
import { localOf, type PartModel, type SceneModel } from "./prepare";

/**
 * Teste de toque: a peça mais alta sob o dedo (camada mais alta primeiro;
 * na mesma camada, a última do array, que é desenhada por cima). Primeiro
 * procura quem contém o ponto; se ninguém contém, aceita a peça cuja borda
 * passa a menos de `tol` mm (peças finas no celular).
 */
export interface HitOptions {
  /** só peças que se movem (arrasto na simulação) */
  dynamicOnly?: boolean;
  /** camadas consideradas (padrão: as visíveis) */
  layer?: (index: number) => boolean;
  /** tolerância de borda, mm */
  tol?: number;
}

export function partHit(
  model: SceneModel,
  frame: FrameSource,
  p: Vec2,
  opts: HitOptions = {},
): PartModel | null {
  const layerOk = opts.layer ?? ((i: number) => model.layers[i]?.layer.visible !== false);
  const list = model.partList.filter((m) => (!opts.dynamicOnly || m.dynamic) && layerOk(m.layer));
  const locals = list.map((m) => localOf(frame.pose(m.part.id), p));
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i]!;
    if (m.outline.some((s) => containsPoint(s, locals[i]!))) return m;
  }
  const tol = opts.tol ?? 0;
  if (tol <= 0) return null;
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i]!;
    const q = locals[i]!;
    for (const s of m.outline) {
      const r = s.outer;
      for (let k = 0; k < r.length; k++) if (distToSegment(q, r[k]!, r[(k + 1) % r.length]!) <= tol) return m;
    }
  }
  return null;
}

/** Ligação cujo ponto de desenho está a menos de `tol` mm (a mais próxima). */
export function linkAt(model: SceneModel, p: Vec2, tol: number): Id | null {
  let best: Id | null = null;
  let bd = tol;
  for (const lm of model.links) {
    if (lm.link.kind === "slot") continue;
    const d = Math.hypot(lm.world[0] - p[0], lm.world[1] - p[1]);
    if (d <= bd) {
      bd = d;
      best = lm.link.id;
    }
  }
  return best;
}

export function partAt(model: SceneModel, frame: FrameSource, p: Vec2, opts: HitOptions = {}): Id | null {
  return partHit(model, frame, p, opts)?.part.id ?? null;
}
