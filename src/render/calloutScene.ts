import { containsPoint } from "@/geometry/polygon";
import type { Vec2 } from "@/geometry/vec";
import { outlineGeometry, type CalloutGeometry } from "./callouts";
import { localOf, worldOf, type SceneModel } from "./prepare";
import type { Box } from "./view";

/**
 * Geometria das chamadas de uma cena: as peças visíveis que contam como
 * obstáculo. A camada 1 é a própria folha (identidade, "Camadas"): as peças
 * fixas dela são o fundo do desenho, então os números podem ficar sobre
 * elas e as linhas podem cruzá-las. Numa cena de uma camada só, tudo conta.
 */
export function calloutGeometry(model: SceneModel): { geo: Required<CalloutGeometry>; bounds: Box } {
  const sheetIsGround = model.layers.length > 1;
  const list = model.partList.filter(
    (m) => model.layers[m.layer]?.layer.visible !== false && !(sheetIsGround && m.layer === 0 && !m.dynamic),
  );
  const rings = list.map((m) =>
    m.outline.flatMap((sh) => [sh.outer, ...sh.holes].map((r) => r.map((q) => worldOf(m.part, q)))),
  );
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const grow = (p: Vec2) => {
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  };
  for (const shape of rings) for (const q of shape[0] ?? []) grow(q);
  for (const l of model.links) grow(l.world);
  const bounds: Box = Number.isFinite(x0)
    ? [x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)]
    : model.bounds;
  const geo = outlineGeometry(rings, (i, q) => {
    const m = list[i]!;
    return m.outline.some((sh) => containsPoint(sh, localOf(m.part, q)));
  });
  return { geo, bounds };
}
