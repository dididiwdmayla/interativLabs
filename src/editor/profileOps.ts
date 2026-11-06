import type { Draft } from "immer";
import type { Part, Scene } from "@/model/types";

/** Remove one surface, promoting the first surviving profile without changing its material. */
export function removeSurface(d: Draft<Scene>, partId: string, layer: string) {
  const p = d.parts.find((p) => p.id === partId);
  if (!p) return;
  const oldPrimary = p.layer === layer;
  const removed = oldPrimary ? p.id : p.profiles?.find((s) => s.layer === layer)?.id;
  const rest = (p.profiles ?? []).filter((s) => s.layer !== layer);
  const promoted = oldPrimary ? rest.shift() : undefined;
  d.links = d.links.filter(
    (l) => !(l.kind === "slot" && l.guide === p.id && (oldPrimary ? !l.profile : l.profile === removed)),
  );
  if (promoted) {
    // Resolve inherited materials before changing the primary material.
    for (const s of rest) s.material ??= p.material;
    p.layer = promoted.layer;
    p.shape = promoted.shape;
    p.material = promoted.material ?? p.material;
    p.source = promoted.source;
    for (const l of d.links)
      if (l.kind === "slot" && l.guide === p.id && l.profile === promoted.id) delete l.profile;
  }
  if (rest.length) p.profiles = rest;
  else delete p.profiles;
}

export function projectedPart(p: Part, layer?: string): Part {
  const s = p.profiles?.find((s) => s.layer === layer);
  return s
    ? { ...p, layer: s.layer, shape: s.shape, source: s.source, material: s.material ?? p.material }
    : p;
}
