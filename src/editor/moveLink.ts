import { locateInRing } from "@/geometry/polygon";
import type { Vec2 } from "@/model/types";
import { localOf, worldOf, type SceneModel } from "@/render/prepare";
import { setLink, type Command } from "./commands";
import { linkName } from "./names";

/** Move the hardware without changing its connected parts. */
export function moveLink(model: SceneModel, id: string, point: Vec2): Command | null {
  const lm = model.linkById.get(id);
  if (!lm || lm.link.kind === "slot") return null;
  const link = structuredClone(lm.link);
  const shift = (id: string | null, local: Vec2): Vec2 => {
    const pose = id ? model.drawn.get(id) : null;
    const p = worldOf(pose, local);
    return localOf(pose, [p[0] + point[0] - lm.world[0], p[1] + point[1] - lm.world[1]]);
  };
  if (link.kind === "spring" || link.kind === "rod" || link.kind === "cable") {
    link.atA = shift(link.a, link.atA);
    link.atB = shift(link.b, link.atB);
  } else if (link.kind === "chamber") link.at = shift(link.body, link.at);
  else if (link.kind === "sensor" || link.kind === "pin") link.at = shift(link.host, link.at);
  else link.at = shift(link.b, link.at);
  const cmd = setLink(model.scene, id, link);
  if (!cmd) return null;
  cmd.label = `Mover ${linkName(link)}`;
  const anchors =
    "atA" in link
      ? [
          { id: link.a, at: link.atA },
          { id: link.b, at: link.atB },
        ]
      : "host" in link
        ? [{ id: link.host, at: link.at }]
        : link.kind === "chamber"
          ? [{ id: link.body, at: link.at }]
          : [{ id: link.b, at: link.at }];
  for (const a of anchors)
    if (
      a.id &&
      !model.partList.some(
        (m) => m.part.id === a.id && m.outline.some((s) => locateInRing(a.at, s.outer) !== "outside"),
      )
    )
      cmd.warning = "O ponto saiu da peça; as peças ligadas foram mantidas.";
  return cmd;
}
