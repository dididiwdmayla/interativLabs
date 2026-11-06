import type { Draft } from "immer";
import { intersection } from "@/geometry/clip";
import { shapeOutline } from "@/geometry/outline";
import { shapeGeometry } from "@/geometry/shape";
import { surfaces, linkLayer, surfaceAt } from "@/model/profiles";
import { nextRef } from "@/model/ids";
import type { Link, Part, Profile, Scene, Shape, Vec2 } from "@/model/types";
import { localOf, worldOf } from "@/render/prepare";
import { buildPart } from "@/parts";
import { addLayer, idsFor, type Command } from "./commands";
import { removeSurface } from "./profileOps";

export type ProfileForm = "copy" | "disc" | "gear" | "ratchet" | "cam" | "lever";

export function extendProfile(
  scene: Scene,
  id: string,
  from: string,
  target: string,
  form: ProfileForm,
): { command: Command; layer: string } | null {
  const part = scene.parts.find((p) => p.id === id);
  if (!part) return null;
  const at = scene.layers.findIndex((l) => l.id === from);
  const added =
    target === "above" || target === "below"
      ? addLayer(scene, { above: at - (target === "below" ? 1 : 0) })
      : null;
  if ((target === "above" || target === "below") && !added) return null;
  const layer = added?.id ?? target;
  if (surfaces(part).some((s) => s.layer === layer) || (!added && !scene.layers.some((l) => l.id === layer)))
    return null;
  const src = surfaceAt(part, from),
    ids = idsFor(scene);
  if (added) ids.reserve(added.id);
  const profile: Profile = {
    id: ids.next("part"),
    layer,
    shape: structuredClone(src.shape),
    material: src.material,
    ...(src.source ? { source: structuredClone(src.source) } : {}),
  };
  if (form !== "copy") {
    const geo = shapeOutline(src.shape);
    const r = geo.ok
      ? Math.max(...geo.value.outline.flatMap((s) => s.outer.map(([x, y]) => Math.hypot(x, y))))
      : 15;
    const generated = buildPart(scene, form, {
      layer: from,
      x: 0,
      y: 0,
      params: { d: 2 * r, D: 2 * r, l: 2 * r, module: (2 * r) / 26 },
    });
    profile.shape = generated.shape;
    profile.source = generated.source;
  }
  return {
    layer,
    command: {
      label: `Estender ${part.name} para outra camada`,
      recipe: (d) => {
        added?.command.recipe(d);
        const p = d.parts.find((p) => p.id === id);
        if (!p) return;
        (p.profiles ??= []).push(profile);
      },
    },
  };
}

export function removeProfile(scene: Scene, id: string, layer: string): Command | null {
  const part = scene.parts.find((p) => p.id === id);
  if (!part?.profiles?.length || !surfaces(part).some((s) => s.layer === layer)) return null;
  return { label: `Tirar ${part.name} desta camada`, recipe: (d) => removeSurface(d, id, layer) };
}

/** Retarget references and transform stored anchors to the new local coordinates. */
function retarget(link: Draft<Link>, old: Part, next: Part, profile?: string) {
  const point = (p: Vec2) => localOf(next, worldOf(old, p));
  const angle = old.angle - next.angle;
  switch (link.kind) {
    case "pin":
    case "sensor":
      if (link.host === old.id) {
        link.host = next.id;
        link.at = point(link.at);
      }
      break;
    case "slot":
      if (link.guide === old.id) {
        link.guide = next.id;
        if (profile) link.profile = profile;
        else delete link.profile;
      }
      break;
    case "chamber":
      if (link.body === old.id) {
        link.body = next.id;
        link.at = point(link.at);
        link.dir += angle;
      }
      for (const w of link.walls) if (w.part === old.id) w.part = next.id;
      break;
    case "spring":
    case "rod":
    case "cable":
      if (link.a === old.id) {
        link.a = next.id;
        link.atA = point(link.atA);
      }
      if (link.b === old.id) {
        link.b = next.id;
        link.atB = point(link.atB);
      }
      if (link.kind === "spring" && link.guide === old.id) link.guide = next.id;
      break;
    default:
      if (link.a === old.id) link.a = next.id;
      if (link.b === old.id) {
        link.b = next.id;
        link.at = point(link.at);
        if (link.kind === "slider") link.dir += angle;
      }
  }
}

export function separateProfile(
  scene: Scene,
  id: string,
  layer: string,
): { command: Command; newId: string } | null {
  const part = scene.parts.find((p) => p.id === id);
  if (!part?.profiles?.length) return null;
  const src = surfaces(part).find((s) => s.layer === layer);
  if (!src) return null;
  const ids = idsFor(scene),
    newId = ids.next("part");
  const separated: Part = {
    ...structuredClone(part),
    id: newId,
    ref: nextRef(scene),
    name: `${part.name} · perfil`,
    layer: src.layer,
    shape: structuredClone(src.shape),
    material: src.material,
    source: src.source,
  };
  delete separated.profiles;
  const g = shapeGeometry(src.shape),
    outline = shapeOutline(src.shape);
  let point: Vec2 = g.ok ? g.value.mass.centroid : [0, 0],
    common = false;
  if (outline.ok)
    for (const s of surfaces(part).filter((s) => s.layer !== layer)) {
      const other = shapeOutline(s.shape);
      if (!other.ok) continue;
      const joined = intersection(outline.value.outline, other.value.outline);
      // A vertex belongs to both contours even for a concave intersection.
      if (joined.ok && joined.value[0]?.outer[0]) {
        point = joined.value[0].outer[0];
        common = true;
        break;
      }
    }
  const screw: Link = {
    id: ids.next("link"),
    ref: separated.ref + 1,
    kind: "screw",
    a: id,
    b: newId,
    at: point,
  };
  const moved = new Set(
    scene.links
      .filter((l) =>
        l.kind === "slot" ? l.guide === id && (l.profile ?? id) === src.id : linkLayer(scene, l) === layer,
      )
      .map((l) => l.id),
  );
  return {
    newId,
    command: {
      label: `Separar perfil de ${part.name}`,
      warning: common ? undefined : "Sem ponto comum: parafuso colocado no centroide do perfil",
      recipe: (d) => {
        // Move slot references before removing/promoting the surface.
        for (const l of d.links) if (moved.has(l.id)) retarget(l, part, separated);
        removeSurface(d, id, layer);
        d.parts.push(separated);
        d.links.push(screw);
      },
    },
  };
}

export function mergeCandidates(scene: Scene, id: string): { parts: Part[]; reason?: string } {
  const connected = new Set([id]);
  for (let changed = true; changed;) {
    changed = false;
    for (const l of scene.links)
      if (l.kind === "screw" && l.a && (connected.has(l.a) || connected.has(l.b))) {
        if (!connected.has(l.a) || !connected.has(l.b)) changed = true;
        connected.add(l.a);
        connected.add(l.b);
      }
  }
  const parts = scene.parts.filter((p) => connected.has(p.id));
  if (parts.length < 2) return { parts, reason: "A peça precisa estar aparafusada a outra" };
  const layers = parts.flatMap((p) => surfaces(p).map((s) => s.layer));
  if (new Set(layers).size !== layers.length) return { parts, reason: "Duas formas ocupam a mesma camada" };
  if (
    scene.links.some(
      (l) => l.kind !== "screw" && "a" in l && l.a && l.b && connected.has(l.a) && connected.has(l.b),
    )
  )
    return { parts, reason: "Retire as outras ligações entre essas peças antes de fundir" };
  return { parts };
}

function transformedShape(shape: Shape, from: Part, to: Part): Shape {
  if (from.x === to.x && from.y === to.y && from.angle === to.angle) return structuredClone(shape);
  const map = (p: Vec2) => localOf(to, worldOf(from, p));
  // An offset circle/gear needs a polygon because those primitives are origin-centred.
  const geo = shapeOutline(shape);
  if (!geo.ok || !geo.value.outline[0]) throw new Error("Não foi possível transformar o perfil");
  const poly = geo.value.outline[0];
  return { kind: "poly", outer: poly.outer.map(map), holes: poly.holes.map((r) => r.map(map)) };
}

export function mergeProfiles(scene: Scene, id: string): Command | null {
  const { parts, reason } = mergeCandidates(scene, id),
    base = parts.find((p) => p.id === id);
  if (reason || !base) return null;
  const ids = idsFor(scene),
    members = new Set(parts.map((p) => p.id));
  const profiles = new Map<string, Profile[]>();
  for (const p of parts)
    if (p.id !== id)
      profiles.set(
        p.id,
        surfaces(p).map((s) => ({
          id: ids.next("part"),
          layer: s.layer,
          shape: transformedShape(s.shape, p, base),
          material: s.material,
          ...(p.x === base.x && p.y === base.y && p.angle === base.angle && s.source
            ? { source: structuredClone(s.source) }
            : {}),
        })),
      );
  return {
    label: `Fundir peças aparafusadas em ${base.name}`,
    recipe: (d) => {
      const target = d.parts.find((p) => p.id === id);
      if (!target) return;
      target.fixed = parts.some((p) => p.fixed);
      target.fast = parts.some((p) => p.fast);
      target.profiles = [...(target.profiles ?? []), ...[...profiles.values()].flat()];
      d.links = d.links.filter((l) => !(l.kind === "screw" && l.a && members.has(l.a) && members.has(l.b)));
      for (const l of d.links)
        for (const p of parts)
          if (p.id !== id) {
            const oldSurface =
              l.kind === "slot" ? surfaces(p).find((s) => s.id === (l.profile ?? p.id)) : undefined;
            const profile = profiles.get(p.id)?.find((s) => s.layer === oldSurface?.layer)?.id;
            retarget(l, p, base, profile);
          }
      d.parts = d.parts.filter((p) => p.id === id || !members.has(p.id));
    },
  };
}
