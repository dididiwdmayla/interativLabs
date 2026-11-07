import type { EngineAdapter, Snapshot } from "@/engine/types";
import type { LinkKind } from "@/model/types";

export const quantities = {
  x: ["Posição x", "mm"],
  y: ["Posição y", "mm"],
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
export interface Probe {
  id: string;
  target: string;
  quantity: Quantity;
  name: string;
  other?: string;
  limit?: number;
  threshold?: number;
  /** Count a pawl dropping after each tooth, from the relative joint angle. */
  countDrops?: boolean;
}
export function available(kind: LinkKind | "part"): Quantity[] {
  if (kind === "part") return ["x", "y", "angle", "speed", "velocity", "angular", "rpm"];
  if (kind === "axle") return ["relative", "torque"];
  if (kind === "chamber") return ["pressure", "volume"];
  if (kind === "spring") return ["force", "length"];
  if (kind === "slider") return ["force", "translation"];
  return kind === "sensor" ? [] : ["force"];
}
export function sample(probe: Probe, s: Snapshot, engine: EngineAdapter): number | null {
  const { target, quantity: q } = probe;
  const p = s.parts[target];
  const l = s.links[target];
  const deg = 180 / Math.PI;
  if (q === "clearance") return engine.clearance?.(target, probe.other ?? "") ?? null;
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
  if (q === "torque") return engine.reaction?.(target)?.torque ?? null;
  return l?.[q as "force" | "translation" | "length" | "pressure" | "volume"] ?? null;
}
