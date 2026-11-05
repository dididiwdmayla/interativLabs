import type { Ring } from "@/geometry/polygon";
import type { Vec2 } from "@/geometry/vec";
import type { PartModel, SceneModel } from "@/render/prepare";
import { worldOf } from "@/render/prepare";
import type { SnapFeature, SnapTargets } from "./snap";

/** Vértices demais (engrenagens, arcos finos) não viram alvo de vértice nem de borda. */
const MAX_VERTICES = 24;
const MAX_EDGES = 64;

const ringCenter = (r: Ring): Vec2 => {
  let x = 0;
  let y = 0;
  for (const p of r) {
    x += p[0];
    y += p[1];
  }
  return [x / r.length, y / r.length];
};

/** Pontos da peça que se move: a origem, os centros dos furos e, em peças simples, os vértices. */
export function snapFeatures(m: PartModel): SnapFeature[] {
  const out: SnapFeature[] = [{ local: [0, 0], kind: "origin" }];
  for (const s of m.outline) {
    for (const h of s.holes) out.push({ local: ringCenter(h), kind: "center" });
    if (m.part.shape.kind === "poly" && s.outer.length <= MAX_VERTICES)
      for (const v of s.outer) out.push({ local: v, kind: "vertex" });
  }
  return out;
}

/** Alvos de encaixe: as outras peças visíveis e as ligações. */
export function snapTargets(model: SceneModel, movingId: string): SnapTargets {
  const points: SnapTargets["points"] = [];
  const edges: SnapTargets["edges"] = [];
  const lines: SnapTargets["lines"] = [];
  for (const m of model.partList) {
    if (m.part.id === movingId || model.layers[m.layer]?.layer.visible === false) continue;
    const w = (q: Vec2) => worldOf(m.part, q);
    points.push({ p: [m.part.x, m.part.y], kind: "center" });
    for (const s of m.outline) {
      for (const h of s.holes) points.push({ p: w(ringCenter(h)), kind: "center" });
      if (m.part.shape.kind === "poly" && s.outer.length <= MAX_VERTICES)
        for (const v of s.outer) points.push({ p: w(v), kind: "vertex" });
      if (s.outer.length <= MAX_EDGES)
        s.outer.forEach((v, i) => edges.push([w(v), w(s.outer[(i + 1) % s.outer.length] ?? v)]));
    }
  }
  for (const lm of model.links) {
    if (lm.link.kind === "slot") continue;
    const l = lm.link;
    // ligações presas à peça que se move andam junto: não servem de alvo
    if ("b" in l && l.b === movingId) continue;
    if ("host" in l && l.host === movingId) continue;
    points.push({ p: lm.world, kind: "link" });
    lines.push({ p: lm.world, u: [1, 0] }, { p: lm.world, u: [0, 1] });
    if (l.kind === "slider") {
      const b = model.drawn.get(l.b);
      const a = (b?.angle ?? 0) + l.dir;
      lines.push({ p: lm.world, u: [Math.cos(a), Math.sin(a)] });
    }
  }
  const snap = model.scene.settings.snap;
  return { points, edges, lines, grid: { on: snap.on, step: snap.grid } };
}
