import type { Vec2 } from "@/geometry/vec";
import type { Plan } from "./plan";

/** Passo fixo da simulação, s. */
export const FIXED_STEP = 1 / 240;

/**
 * Limite de velocidade linear comum a todos os motores, mm/s (40 m/s).
 * O Planck limita a translação por passo e o Box2D v3 a velocidade; os dois
 * são ajustados para este valor na escala escolhida.
 */
export const SPEED_LIMIT = 40_000;

/** Amortecimento angular dos corpos (o mesmo do protótipo). */
export const ANGULAR_DAMPING = 0.02;

/** Ângulo contínuo a partir de um ângulo lido entre −π e π. */
export function unwrapAngle(prev: number, raw: number): number {
  let d = raw - prev;
  d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
  return prev + d;
}

/** Corpos que precisam de ângulo contínuo (ligados por eixo, trilho, mola ou câmara). */
export function trackedBodies(plan: Plan): number[] {
  const s = new Set<number>();
  for (const a of plan.axles) s.add(a.a).add(a.b);
  for (const a of plan.sliders) s.add(a.a).add(a.b);
  for (const a of plan.distances) s.add(a.a).add(a.b);
  for (const a of plan.mounts) s.add(a.a).add(a.b);
  for (const a of plan.springs) {
    s.add(a.a).add(a.b);
    if (a.guide) s.add(a.guide.body);
  }
  for (const a of plan.chambers) {
    s.add(a.a);
    if (a.b > 0) s.add(a.b);
  }
  s.delete(0);
  return [...s].filter((i) => i >= 0 && !plan.bodies[i]!.static).sort((a, b) => a - b);
}

/** Escala uniforme de pontos mm → unidades do motor. */
export function scalePts(pts: Vec2[], unitMm: number): Vec2[] {
  return pts.map(([x, y]) => [x / unitMm, y / unitMm]);
}
