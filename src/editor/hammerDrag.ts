import { buildPlan } from "@/engine/plan";
import { principalAxis } from "@/geometry/slot";
import type { Ring } from "@/geometry/polygon";
import { nextRef } from "@/model/ids";
import { P_ATM } from "@/model/units";
import type { ChamberLink, Link, SensorAction, Vec2 } from "@/model/types";
import { localOf, worldOf, type SceneModel } from "@/render/prepare";
import { idsFor, type Command } from "./commands";
import { type HammerPoint, type HammerTool } from "./hammer";
import { effective, frequencyPreset, SPRING_HZ } from "./linkPresets";
import { LINK_LABEL } from "./names";
import { snapAngle } from "./snap";

export function insertLink(link: Link): Command {
  return {
    label: `Cravar ${LINK_LABEL[link.kind].toLocaleLowerCase("pt-BR")} ${link.ref}`,
    recipe: (d) => {
      d.links.push(link);
    },
  };
}

/** Signed positions where a line crosses a closed ring, in world coordinates. */
function crossings(ring: Ring, origin: Vec2, u: Vec2): number[] {
  const out: number[] = [];
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length];
    if (!q) return;
    const x = p[0] - origin[0],
      y = p[1] - origin[1];
    const a = x * -u[1] + y * u[0];
    const b = (q[0] - origin[0]) * -u[1] + (q[1] - origin[1]) * u[0];
    if (a > 0 === b > 0 || Math.abs(a - b) < 1e-12) return;
    const t = a / (a - b);
    out.push((x + t * (q[0] - p[0])) * u[0] + (y + t * (q[1] - p[1])) * u[1]);
  });
  return out.sort((a, b) => a - b);
}

export interface DragLink {
  link: Link;
  warning?: string;
}
export function dragLink(
  model: SceneModel,
  tool: HammerTool,
  start: HammerPoint,
  end: HammerPoint,
  active: number,
): DragLink | null {
  const scene = model.scene,
    id = idsFor(scene).next("link"),
    ref = nextRef(scene);
  const dx = end.point[0] - start.point[0],
    dy = end.point[1] - start.point[1];
  const length = Math.hypot(dx, dy);
  if (length < 0.2) return null;
  if (tool === "spring" || tool === "rod" || tool === "cable") {
    const a = start.b?.part.id ?? null,
      b = end.b?.part.id ?? null;
    if (a === b) return null;
    const base = {
      id,
      ref,
      a,
      b,
      atA: localOf(start.b?.part, start.point),
      atB: localOf(end.b?.part, end.point),
    };
    if (tool === "rod") return { link: { ...base, kind: "rod" } };
    if (tool === "cable") return { link: { ...base, kind: "cable", maxLength: length } };
    const outerD = Math.max(1, Math.min(8, length / 5));
    return {
      link: {
        ...base,
        kind: "spring",
        ...frequencyPreset(effective(scene, a, b), SPRING_HZ.medium),
        freeLength: length,
        mode: "fixed",
        coil: { outerD, wireD: outerD / 12, turns: Math.max(3, Math.min(24, (length / outerD) * 1.5)) },
      },
    };
  }
  if (tool === "slider" && start.b) {
    let angle = snapAngle(Math.atan2(dy, dx)).angle;
    const axis = principalAxis(start.b.outline[0]?.outer ?? []);
    if (axis) {
      const a = Math.atan2(axis.u[1], axis.u[0]) + start.b.part.angle;
      const along = a + Math.round((angle - a) / Math.PI) * Math.PI;
      if (Math.abs(angle - along) < Math.PI / 45) angle = along;
    }
    return {
      link: {
        id,
        ref,
        kind: "slider",
        a: start.a?.part.id ?? null,
        b: start.b.part.id,
        at: localOf(start.b.part, start.point),
        dir: angle - start.b.part.angle,
        travel: [0, length],
      },
    };
  }
  if (tool !== "chamber") return null;
  const u: Vec2 = [dx / length, dy / length],
    normal: Vec2 = [-u[1], u[0]];
  const layer = start.b?.layer ?? active;
  const middle: Vec2 = [(start.point[0] + end.point[0]) / 2, (start.point[1] + end.point[1]) / 2];
  const plan = buildPlan(scene);
  const bodyIndex = start.b ? plan.partRel.get(start.b.part.id)?.body : 0;
  const candidates: { id: string; index: number; front: number }[] = [];
  const edges: number[] = [];
  for (const m of model.partList) {
    if (m.layer !== layer) continue;
    const index = plan.partRel.get(m.part.id)?.body;
    const dynamic = index !== undefined && !plan.bodies[index]?.static;
    const hits = m.outline.flatMap((s) =>
      crossings(
        s.outer.map((p) => worldOf(m.part, p)),
        start.point,
        u,
      ),
    );
    if (
      dynamic &&
      index !== bodyIndex &&
      index !== undefined &&
      hits.some((t) => t >= -0.2 && t <= length + 0.2)
    )
      candidates.push({ id: m.part.id, index, front: Math.max(...hits) });
    if (!dynamic || m.part.id === start.b?.part.id)
      for (const s of m.outline)
        for (const ring of [s.outer, ...s.holes])
          edges.push(
            ...crossings(
              ring.map((p) => worldOf(m.part, p)),
              middle,
              normal,
            ),
          );
  }
  const seen = new Set<number>();
  const walls = candidates
    .sort((a, b) => b.front - a.front)
    .filter((c) => {
      if (seen.has(c.index)) return false;
      seen.add(c.index);
      return true;
    })
    .slice(0, 2)
    .map((c) => ({ part: c.id, seal: length }));
  const up = Math.max(...edges.filter((v) => v < -0.01));
  const down = Math.min(...edges.filter((v) => v > 0.01));
  const detected = Number.isFinite(up) && Number.isFinite(down);
  const body = start.b?.part ?? null;
  const link: ChamberLink = {
    id,
    ref,
    kind: "chamber",
    body: body?.id ?? null,
    at: localOf(body, start.point),
    dir: Math.atan2(dy, dx) - (body?.angle ?? 0),
    bore: detected ? down - up : 6,
    length,
    walls,
    vents: [],
    ports: [],
    gas: { model: "adiabatic", gamma: 1.4, p0: P_ATM, charge: { amount: 0.5, burnMs: 1, shots: 1 } },
  };
  return {
    link,
    warning: !walls.length
      ? "Toque na parede"
      : !detected
        ? "Diâmetro não detectado; confira no cartão"
        : undefined,
  };
}

export function sensorLink(
  model: SceneModel,
  hit: HammerPoint,
  actions: SensorAction[] = [],
  active?: number,
): Link | null {
  const host = hit.b;
  if (!host) return null;
  const layer = active === undefined ? host.part.layer : (model.scene.layers[active]?.id ?? host.part.layer);
  return {
    id: idsFor(model.scene).next("link"),
    ref: nextRef(model.scene),
    kind: "sensor",
    host: host.part.id,
    at: localOf(host.part, hit.point),
    r: 2,
    layers: [layer, layer],
    minSpeed: 0,
    actions,
  };
}
