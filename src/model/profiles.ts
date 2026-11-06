import type { Id, Link, Part, Scene, Shape } from "./types";

/** Each surface shares the part's local origin, pose and physical body. */
export function surfaces(part: Part) {
  return [
    { id: part.id, layer: part.layer, shape: part.shape, material: part.material, source: part.source },
    ...(part.profiles ?? []).map((p) => ({ ...p, material: p.material ?? part.material })),
  ];
}

export function surfaceAt(part: Part, layer: Id) {
  return (
    surfaces(part).find((p) => p.layer === layer) ?? {
      id: part.id,
      layer: part.layer,
      shape: part.shape,
      material: part.material,
      source: part.source,
    }
  );
}

/** Links have no stored layer: use the highest primary endpoint, or the host/body layer. */
export function linkLayer(scene: Scene, link: Link): Id {
  const part = (id: Id | null) => scene.parts.find((p) => p.id === id);
  if (link.kind === "slot") {
    const guide = part(link.guide);
    return (
      guide?.profiles?.find((p) => p.id === link.profile)?.layer ?? guide?.layer ?? scene.layers[0]?.id ?? ""
    );
  }
  if ("host" in link) return part(link.host)?.layer ?? scene.layers[0]?.id ?? "";
  if (link.kind === "chamber")
    return part(link.body)?.layer ?? part(link.walls[0]?.part ?? null)?.layer ?? scene.layers[0]?.id ?? "";
  const layers = [part(link.a)?.layer, part(link.b)?.layer];
  return scene.layers.filter((l) => layers.includes(l.id)).at(-1)?.id ?? scene.layers[0]?.id ?? "";
}

export function geometryForLink(scene: Scene, link: Link, part: Part): Shape {
  if (link.kind === "slot") return part.profiles?.find((p) => p.id === link.profile)?.shape ?? part.shape;
  return surfaceAt(part, linkLayer(scene, link)).shape;
}
