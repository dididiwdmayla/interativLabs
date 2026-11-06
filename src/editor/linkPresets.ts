import { buildPlan } from "@/engine/plan";
import type { Id, Scene, Vec2 } from "@/model/types";
import { N, G_REAL } from "@/model/units";

export const SPRING_HZ = { soft: 4, medium: 10, hard: 25 } as const;
export const MOUNT_HZ = { firm: 60, soft: 15 } as const;
export const DAMPING_RATIO = 0.1;
export const FRICTION_WEIGHT = { low: 0.05, high: 0.3 } as const;

/** Reduced mass/inertia of distinct bodies, excluding the edited connection. */
export function effective(
  scene: Scene,
  a: Id | null,
  b: Id | null,
  angular = false,
  at?: Vec2,
  exclude?: Id,
): number {
  const plan = buildPlan({ ...scene, links: scene.links.filter((l) => l.id !== exclude) });
  const seen = new Set<number>();
  let inverse = 0;
  for (const id of [a, b]) {
    const index = id === null ? 0 : plan.partRel.get(id)?.body;
    const body = index === undefined ? undefined : plan.bodies[index];
    if (!body || body.static || seen.has(body.index)) continue;
    seen.add(body.index);
    const value = angular
      ? body.inertia +
        body.mass * (at ? (body.position[0] - at[0]) ** 2 + (body.position[1] - at[1]) ** 2 : 0)
      : body.mass;
    if (value > 0) inverse += 1 / value;
  }
  return inverse > 0 ? 1 / inverse : 1;
}

/** Scene units: N/mm or N·mm/rad; damping is 10% of critical. */
export function frequencyPreset(mass: number, hz: number, ratio = DAMPING_RATIO) {
  const omega = 2 * Math.PI * hz;
  return { k: (mass * omega * omega) / N, damping: (2 * ratio * mass * omega) / N };
}

export function weightFriction(mass: number, level: keyof typeof FRICTION_WEIGHT, gravity = G_REAL) {
  return (mass * gravity * FRICTION_WEIGHT[level]) / N;
}
