import { containsPoint, locateInRing } from "@/geometry/polygon";
import { straightSlot } from "@/geometry/slot";
import { distToSegment } from "@/geometry/vec";
import { nextRef } from "@/model/ids";
import type { Link, Vec2 } from "@/model/types";
import { localOf, worldOf, type PartModel, type SceneModel } from "@/render/prepare";
import { idsFor, type Command } from "./commands";
import { LINK_LABEL, partName } from "./names";
import { snapMove, type SnapGuide } from "./snap";
import { snapTargets } from "./snapScene";

export type HammerTool =
  "screw" | "axle" | "pin" | "lock" | "spring" | "rod" | "cable" | "slider" | "chamber" | "sensor";
export const HAMMER_GROUPS: { name: string; tools: HammerTool[] }[] = [
  { name: "Fixar", tools: ["screw", "axle", "pin", "lock"] },
  { name: "Ligar", tools: ["spring", "rod", "cable"] },
  { name: "Guiar", tools: ["slider"] },
  { name: "Gás", tools: ["chamber", "sensor"] },
];
export interface HammerPoint {
  point: Vec2;
  a: PartModel | null;
  b: PartModel | null;
  guides: SnapGuide[];
  phrase: string;
}

/** Visible surfaces in drawing order; holes can be targeted by fasteners. */
export function hammerStack(model: SceneModel, point: Vec2, active: number, holes = false): PartModel[] {
  const seen = new Set<string>();
  return model.partList
    .slice()
    .reverse()
    .filter((m) => {
      if (m.layer > active || model.layers[m.layer]?.layer.visible === false || seen.has(m.part.id))
        return false;
      const p = localOf(m.part, point);
      const hit = m.outline.some((s) =>
        holes ? locateInRing(p, s.outer) !== "outside" : containsPoint(s, p),
      );
      if (hit) seen.add(m.part.id);
      return hit;
    });
}

export function hammerPoint(
  model: SceneModel,
  tool: HammerTool,
  point: Vec2,
  active: number,
  px: number,
): HammerPoint {
  let at: Vec2;
  let guides: SnapGuide[];
  const solid = tool === "screw" || tool === "axle" || tool === "lock" || tool === "chamber";
  const candidate = hammerStack(model, point, active, solid)[0];
  let center: Vec2 | undefined;
  if (candidate && (tool === "screw" || tool === "axle")) {
    const shape = candidate.part.shape;
    const centers: { p: Vec2; r: number }[] = [];
    if (shape.kind === "circle" || shape.kind === "gear")
      centers.push({ p: [0, 0], r: shape.kind === "circle" ? shape.r : (shape.module * shape.teeth) / 2 });
    for (const s of candidate.outline)
      for (const h of s.holes) {
        const c: Vec2 = [
          h.reduce((n, v) => n + v[0], 0) / h.length,
          h.reduce((n, v) => n + v[1], 0) / h.length,
        ];
        const radii = h.map((v) => Math.hypot(v[0] - c[0], v[1] - c[1]));
        const r = Math.max(...radii);
        if (Math.min(...radii) >= r * 0.97) centers.push({ p: c, r });
      }
    let best = Infinity;
    for (const c of centers) {
      const w = worldOf(candidate.part, c.p),
        d = Math.hypot(w[0] - point[0], w[1] - point[1]);
      if (d <= Math.max(c.r * 0.3, 24 * px) + 0.75 * px && d < best) {
        center = w;
        best = d;
      }
    }
  }
  if (center) {
    at = center;
    guides = [{ kind: "point", at, target: "center" }];
  } else {
    const snap = snapMove(
      { x: point[0], y: point[1], angle: 0 },
      [{ local: [0, 0], kind: "center" }],
      snapTargets(model, ""),
      10 * px,
    );
    at = [snap.x, snap.y];
    guides = snap.guides;
  }
  const stack = hammerStack(model, at, active, solid);
  const b = stack[0] ?? null,
    a = stack[1] ?? null;
  const name = LINK_LABEL[tool];
  return {
    point: at,
    a,
    b,
    guides,
    phrase: b
      ? `${name}: ${partName(b.part)} ${tool === "axle" ? "gira sobre" : "liga a"} ${a ? partName(a.part) : "o fundo"}`
      : "Toque sobre uma peça",
  };
}

export interface HammerStamp {
  command: Command;
  id: string;
  warning?: string;
}

/** One atomic stamp, including an automatically detected slot. */
export function hammerFix(model: SceneModel, tool: HammerTool, hit: HammerPoint): HammerStamp | null {
  if (!hit.b || !["screw", "axle", "pin", "lock"].includes(tool)) return null;
  const scene = model.scene,
    ids = idsFor(scene),
    id = ids.next("link"),
    ref = nextRef(scene);
  const host = hit.b,
    at = localOf(host.part, hit.point),
    links: Link[] = [];
  let warning: string | undefined;
  if (tool === "pin") {
    let end = host.layer;
    let r = 1;
    let slot: Link | undefined;
    for (const m of model.partList.slice().reverse()) {
      if (
        m.part.id === host.part.id ||
        m.layer === host.layer ||
        model.layers[m.layer]?.layer.visible === false
      )
        continue;
      const p = localOf(m.part, hit.point);
      const holes = m.part.shape.kind === "gear" ? [] : m.part.shape.holes;
      const index = holes.findIndex((h) => locateInRing(p, h) !== "outside");
      const hole = holes[index];
      if (!hole) continue;
      const straight = straightSlot(hole);
      const clearance = Math.min(
        ...hole.map((v, i) => distToSegment(p, v, hole[(i + 1) % hole.length] ?? v)),
      );
      r = Math.max(0.05, Math.min(1, clearance * 0.95));
      end = m.layer;
      slot = {
        kind: "slot",
        id: ids.next("link"),
        ref: ref + 1,
        pin: id,
        guide: m.part.id,
        hole: index,
        mode: straight ? "joint" : "contact",
        ...(m.profile ? { profile: m.profile } : {}),
      };
      break;
    }
    if (!slot) {
      const choices = [host.layer - 1, host.layer + 1].filter((i) => i >= 0 && i < model.layers.length);
      end =
        choices.find(
          (i) =>
            !model.partList.some(
              (m) =>
                m.layer === i &&
                m.part.id !== host.part.id &&
                m.outline.some((s) => containsPoint(s, localOf(m.part, hit.point))),
            ),
        ) ??
        choices[0] ??
        host.layer;
    }
    const lo = Math.min(host.layer, end),
      hi = Math.max(host.layer, end);
    for (const m of model.partList) {
      if (m.part.id === host.part.id || m.layer < lo || m.layer > hi) continue;
      const p = localOf(m.part, hit.point);
      if (m.outline.some((s) => containsPoint(s, p)))
        warning = "O pino nasceria dentro de material. Mova o ponto para um furo ou rasgo.";
    }
    const first = scene.layers[lo],
      last = scene.layers[hi];
    if (!first || !last) return null;
    links.push({ kind: "pin", id, ref, host: host.part.id, at, r, layers: [first.id, last.id] });
    if (slot) links.push(slot);
  } else if (tool === "screw" || tool === "axle" || tool === "lock") {
    links.push({ kind: tool, id, ref, a: hit.a?.part.id ?? null, b: host.part.id, at });
  }
  return {
    id,
    warning,
    command: {
      label: `Cravar ${LINK_LABEL[tool].toLocaleLowerCase("pt-BR")} ${ref}`,
      warning,
      recipe: (d) => {
        d.links.push(...links);
      },
    },
  };
}
