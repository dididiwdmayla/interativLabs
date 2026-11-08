import type { Link, Vec2 } from "@/model/types";
import { worldOf, type SceneModel } from "@/render/prepare";

export interface LinkHandle {
  id: string;
  field: "lower" | "upper" | "travel0" | "travel1" | "freeLength" | "radius" | "seat";
  point: Vec2;
  origin: Vec2;
  axis: Vec2;
  radius?: number;
  angle?: number;
  startAngle?: number;
}
export function linkHandles(model: SceneModel, link: Link, px: number): LinkHandle[] {
  const out: LinkHandle[] = [];
  const make = (
    field: LinkHandle["field"],
    origin: Vec2,
    axis: Vec2,
    length: number,
    extra: Partial<LinkHandle> = {},
  ) =>
    out.push({
      id: `${link.id}-${field}`,
      field,
      origin,
      axis,
      point: [origin[0] + axis[0] * length, origin[1] + axis[1] * length],
      ...extra,
    });
  if (link.kind === "axle" && link.limit) {
    const pose = model.drawn.get(link.b),
      center = worldOf(pose, link.at);
    for (const field of ["lower", "upper"] as const) {
      const a = (pose?.angle ?? 0) + link.limit[field],
        r = (field === "lower" ? 34 : 50) * px;
      make(field, center, [Math.cos(a), Math.sin(a)], r, {
        radius: r,
        angle: a,
        startAngle: pose?.angle ?? 0,
      });
    }
  } else if (link.kind === "slider") {
    const pose = model.drawn.get(link.b),
      at = worldOf(pose, link.at),
      angle = (pose?.angle ?? 0) + link.dir,
      u: Vec2 = [Math.cos(angle), Math.sin(angle)];
    make("travel0", at, u, link.travel[0]);
    make("travel1", at, u, link.travel[1]);
  } else if (link.kind === "spring") {
    const a = worldOf(link.a ? model.drawn.get(link.a) : null, link.atA),
      b = worldOf(link.b ? model.drawn.get(link.b) : null, link.atB),
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    make("freeLength", a, len > 0 ? [(b[0] - a[0]) / len, (b[1] - a[1]) / len] : [1, 0], link.freeLength);
  } else if (link.kind === "sensor")
    make("radius", worldOf(model.drawn.get(link.host), link.at), [1, 0], link.r);
  else if (link.kind === "chamber" && link.mode === "capsule") {
    // assento da câmara de cápsula: do fundo da câmara ao longo do eixo
    const pose = link.body === null ? null : model.drawn.get(link.body);
    const angle = (pose?.angle ?? 0) + link.dir;
    make("seat", worldOf(pose, link.at), [Math.cos(angle), Math.sin(angle)], link.seat ?? 1);
  }
  return out;
}

/** Only the field represented by the handle changes; commit once at pointer-up. */
export function adjustLinkHandle(model: SceneModel, link: Link, h: LinkHandle, point: Vec2): Link {
  const next = structuredClone(link),
    dx = point[0] - h.origin[0],
    dy = point[1] - h.origin[1];
  if (next.kind === "axle" && next.limit && (h.field === "lower" || h.field === "upper")) {
    const a = Math.atan2(dy, dx) - (model.drawn.get(next.b)?.angle ?? 0),
      step = Math.PI / 36;
    const angle = Math.round(a / step) * step;
    next.limit[h.field] =
      h.field === "lower" ? Math.min(angle, next.limit.upper) : Math.max(angle, next.limit.lower);
  } else if (next.kind === "slider" && (h.field === "travel0" || h.field === "travel1")) {
    const value = dx * h.axis[0] + dy * h.axis[1];
    if (h.field === "travel0") next.travel[0] = Math.min(value, next.travel[1]);
    else next.travel[1] = Math.max(value, next.travel[0]);
  } else if (next.kind === "spring" && h.field === "freeLength")
    next.freeLength = Math.max(next.solidLength ?? 0, dx * h.axis[0] + dy * h.axis[1]);
  else if (next.kind === "sensor" && h.field === "radius") next.r = Math.max(0.05, Math.hypot(dx, dy));
  else if (next.kind === "chamber" && h.field === "seat")
    next.seat = Math.round(Math.max(0, dx * h.axis[0] + dy * h.axis[1]) * 10) / 10;
  return next;
}
