import type { Link, LinkKind, Scene } from "@/model/types";
import { worldOf } from "@/render/prepare";
import { effective, frequencyPreset, MOUNT_HZ, SPRING_HZ, weightFriction } from "./linkPresets";

export function switchLink(scene: Scene, link: Link, kind: LinkKind): Link | null {
  if (link.kind === kind) return link;
  const base = { id: link.id, ref: link.ref };
  if (
    (link.kind === "screw" || link.kind === "mount" || link.kind === "lock") &&
    (kind === "screw" || kind === "mount" || kind === "lock")
  ) {
    const ends = { ...base, a: link.a, b: link.b, at: link.at };
    return kind === "mount"
      ? { ...ends, kind, linearHz: MOUNT_HZ.firm, angularHz: MOUNT_HZ.firm, damping: 0.1 }
      : { ...ends, kind };
  }
  if (
    (link.kind === "rod" || link.kind === "cable" || link.kind === "spring") &&
    (kind === "rod" || kind === "cable" || kind === "spring")
  ) {
    const ends = { ...base, a: link.a, b: link.b, atA: link.atA, atB: link.atB };
    const a = worldOf(
        scene.parts.find((p) => p.id === link.a),
        link.atA,
      ),
      b = worldOf(
        scene.parts.find((p) => p.id === link.b),
        link.atB,
      );
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (kind === "rod") return { ...ends, kind };
    if (kind === "cable") return { ...ends, kind, maxLength: Math.max(0.01, length) };
    const outerD = Math.max(1, Math.min(8, length / 5));
    return {
      ...ends,
      kind,
      ...frequencyPreset(effective(scene, link.a, link.b, false, undefined, link.id), SPRING_HZ.medium),
      freeLength: length,
      mode: "fixed",
      coil: { outerD, wireD: outerD / 12, turns: Math.max(3, Math.min(24, (length / outerD) * 1.5)) },
    };
  }
  return null;
}

export function elasticPreset(scene: Scene, link: Link, strength: keyof typeof SPRING_HZ): Link {
  if (link.kind === "spring" || link.kind === "slider") {
    const p = frequencyPreset(
      effective(scene, link.a, link.b, false, undefined, link.id),
      SPRING_HZ[strength],
    );
    return link.kind === "spring"
      ? { ...link, ...p }
      : { ...link, spring: { ...p, rest: link.spring?.rest ?? 0 } };
  }
  if (link.kind === "axle") {
    const at = worldOf(
      scene.parts.find((p) => p.id === link.b),
      link.at,
    );
    const p = frequencyPreset(effective(scene, link.a, link.b, true, at, link.id), SPRING_HZ[strength]);
    return { ...link, torsion: { ...p, rest: link.torsion?.rest ?? 0 } };
  }
  return link;
}

export function frictionPreset(scene: Scene, link: Link, level: "none" | "low" | "high"): Link {
  if (link.kind !== "axle" && link.kind !== "slider") return link;
  const mass = effective(scene, link.a, link.b, false, undefined, link.id);
  const force = level === "none" ? 0 : weightFriction(mass, level, scene.settings.gravity.g);
  if (link.kind === "slider") return { ...link, friction: force };
  const part = scene.parts.find((p) => p.id === link.b);
  const radius =
    part?.shape.kind === "circle"
      ? part.shape.r
      : part?.shape.kind === "gear"
        ? (part.shape.teeth * part.shape.module) / 2
        : 10;
  return { ...link, friction: force * radius };
}
