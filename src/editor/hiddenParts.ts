import type { Link, Scene } from "@/model/types";
import { linkParts } from "./names";

export function hiddenLinkState(link: Link, hidden: readonly string[], scene: Scene): "visible" | "partial" | "hidden" {
  const ids = linkParts(link).filter((id): id is string => id !== null);
  if (link.kind === "slot") {
    const pin = scene.links.find((l) => l.id === link.pin);
    if (pin?.kind === "pin") ids.push(pin.host);
  }
  const count = ids.filter((id) => hidden.includes(id)).length;
  return count && count === ids.length ? "hidden" : count ? "partial" : "visible";
}
