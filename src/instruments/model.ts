import type { EngineAdapter, Snapshot } from "@/engine/types";
import type { LinkKind } from "@/model/types";
import type { TickKind } from "./events";

export const quantities = {
  x: ["Deslocamento x", "mm"],
  absoluteX: ["Posição absoluta x", "mm"],
  y: ["Deslocamento y", "mm"],
  absoluteY: ["Posição absoluta y", "mm"],
  angle: ["Ângulo", "°"],
  speed: ["Velocidade", "mm/s"],
  velocity: ["Velocidade", "m/s"],
  angular: ["Velocidade angular", "°/s"],
  rpm: ["Rotação", "rpm"],
  relative: ["Ângulo relativo", "°"],
  torque: ["Torque", "N·mm"],
  force: ["Força", "N"],
  translation: ["Posição no curso", "mm"],
  length: ["Comprimento", "mm"],
  pressure: ["Pressão · gás didático", "kPa"],
  volume: ["Volume", "mm³"],
  clearance: ["Folga", "mm"],
} as const;
export type Quantity = keyof typeof quantities;
/**
 * An instant the probe also reads its own value at ("valor no evento"): every time the ruler shows
 * this kind of tick, or every time another reading rises past a value (the ball passing the
 * muzzle). Reading it never changes the simulation.
 */
export type ProbeEvent =
  | { kind: "tick"; tick: TickKind }
  | { kind: "crossing"; target: string; quantity: Quantity; threshold: number };
export interface Probe {
  id: string;
  target: string;
  quantity: Quantity;
  name: string;
  other?: string;
  limit?: number;
  threshold?: number;
  /** Also read the value at this event, labelled `atLabel` ("na saída"). */
  at?: ProbeEvent;
  atLabel?: string;
  /** Count a pawl dropping after each tooth, from the relative joint angle. */
  countDrops?: boolean;
}
export function available(kind: LinkKind | "part"): Quantity[] {
  if (kind === "part")
    return ["x", "y", "absoluteX", "absoluteY", "angle", "speed", "velocity", "angular", "rpm"];
  if (kind === "axle") return ["relative", "torque"];
  if (kind === "chamber") return ["pressure", "volume"];
  if (kind === "spring") return ["force", "length"];
  if (kind === "slider") return ["force", "translation"];
  // A screw welds its parts into one body: there is no force between them to read.
  return kind === "sensor" || kind === "screw" ? [] : ["force"];
}
/** Why a link has nothing to read, for the places that would otherwise show a bare dash. */
export const noReadingReason: Partial<Record<LinkKind, string>> = {
  screw: "Une as peças num corpo só: sem força entre elas.",
};

export function sample(probe: Probe, s: Snapshot, engine: EngineAdapter): number | null {
  const { target, quantity: q } = probe;
  const p = s.parts[target];
  const l = s.links[target];
  const deg = 180 / Math.PI;
  if (q === "clearance") return engine.clearance?.(target, probe.other ?? "") ?? null;
  if (q === "absoluteX") return p?.x ?? null;
  if (q === "absoluteY") return p?.y ?? null;
  if (q === "x" || q === "y") return p?.[q] ?? null;
  if (q === "angle") return p ? p.angle * deg : null;
  if (["speed", "velocity", "angular", "rpm"].includes(q)) {
    const v = engine.velocity?.(target);
    if (!v) return null;
    if (q === "angular") return v.omega * deg;
    if (q === "rpm") return (v.omega * 60) / (2 * Math.PI);
    return Math.hypot(v.x, v.y) / (q === "velocity" ? 1000 : 1);
  }
  if (q === "relative") return l?.angle === undefined ? null : l.angle * deg;
  if (q === "force" && l?.kind !== "spring") return engine.reaction?.(target)?.force ?? l?.force ?? null;
  if (q === "torque") {
    // motor + stops (the joint's constraint torque) + the torsion spring by its own law
    const joint = engine.reaction?.(target)?.torque ?? l?.torque;
    if (joint === undefined && l?.torsionTorque === undefined) return null;
    return (joint ?? 0) + (l?.torsionTorque ?? 0);
  }
  return l?.[q as "force" | "translation" | "length" | "pressure" | "volume"] ?? null;
}
