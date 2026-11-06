import type { Id, Link, SensorAction, Vec2 } from "@/model/types";
import { distToSegment } from "@/geometry/vec";
import { partHit } from "@/render/hit";
import { drawnFrame } from "@/render/nodes";
import { worldOf, type SceneModel } from "@/render/prepare";

export interface CardPick {
  kind: "guide" | "wall" | "vent" | "port" | "action";
  link: Id;
  action?: SensorAction["do"];
}
export const PICK_PHRASE: Record<CardPick["kind"], string> = {
  guide: "Toque na peça-guia",
  wall: "Toque na parede",
  vent: "Toque na linha do furo para pôr o respiro",
  port: "Toque na outra câmara",
  action: "Toque no alvo da ação",
};

export function pickLinkEdit(
  model: SceneModel,
  pick: CardPick,
  point: Vec2,
  px: number,
): { link?: Link; error?: string } {
  const original = model.linkById.get(pick.link)?.link;
  if (!original) return { error: "A ligação não está mais na cena" };
  const link = structuredClone(original);
  const m = partHit(model, drawnFrame(model), point, { tol: 4 * px, dynamicOnly: pick.kind === "wall" });
  if (pick.kind === "guide" && link.kind === "spring")
    return m ? { link: { ...link, guide: m.part.id } } : { error: "Toque na peça-guia" };
  if (pick.kind === "wall" && link.kind === "chamber") {
    if (!m || m.part.id === link.body || link.walls.some((w) => w.part === m.part.id))
      return { error: "Escolha uma parede móvel diferente" };
    if (link.walls.length >= 2) return { error: "A câmara já tem duas paredes" };
    link.walls.push({ part: m.part.id, seal: link.length });
    return { link };
  }
  const chamberAt = (l: Extract<Link, { kind: "chamber" }>) => {
    const pose = l.body ? model.drawn.get(l.body) : null,
      a = worldOf(pose, l.at),
      angle = (pose?.angle ?? 0) + l.dir,
      u: Vec2 = [Math.cos(angle), Math.sin(angle)];
    const t = (point[0] - a[0]) * u[0] + (point[1] - a[1]) * u[1];
    return { a, u, t, distance: distToSegment(point, a, [a[0] + u[0] * l.length, a[1] + u[1] * l.length]) };
  };
  if (pick.kind === "vent" && link.kind === "chamber") {
    const geo = chamberAt(link);
    if (geo.distance > 22 * px) return { error: "Toque na linha do furo" };
    link.vents.push({ at: Math.max(0, Math.min(link.length, geo.t)), d: 1, open: true });
    return { link };
  }
  const targets = model.links
    .filter((m) => m.link.kind === "chamber" || m.link.kind === "lock")
    .map((m) => ({
      link: m.link,
      d:
        m.link.kind === "chamber"
          ? chamberAt(m.link).distance
          : Math.hypot(m.world[0] - point[0], m.world[1] - point[1]),
    }))
    .filter((m) => m.d <= 22 * px)
    .sort((a, b) => a.d - b.d);
  if (pick.kind === "port" && link.kind === "chamber") {
    const target = targets.find((m) => m.link.kind === "chamber" && m.link.id !== link.id)?.link;
    if (!target) return { error: "Toque em outra câmara" };
    link.ports.push({ to: target.id, at: Math.max(0, Math.min(link.length, chamberAt(link).t)), d: 1 });
    return { link };
  }
  if (pick.kind === "action" && link.kind === "sensor") {
    const action = pick.action ?? "ignite";
    const target = targets.find((m) =>
      action === "release" ? m.link.kind === "lock" : m.link.kind === "chamber",
    )?.link;
    if (!target) return { error: action === "release" ? "Toque numa trava" : "Toque numa câmara" };
    if (action === "open" || action === "close") {
      if (target.kind !== "chamber" || !target.vents.length) return { error: "Essa câmara não tem respiros" };
      const t = chamberAt(target).t;
      const vent =
        target.vents.map((v, i) => ({ i, d: Math.abs(v.at - t) })).sort((a, b) => a.d - b.d)[0]?.i ?? 0;
      link.actions.push({ do: action, target: target.id, vent });
    } else link.actions.push({ do: action, target: target.id });
    return { link };
  }
  return { error: "Escolha um alvo válido" };
}
