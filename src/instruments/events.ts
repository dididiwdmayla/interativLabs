import type { EngineEvent } from "@/engine/types";
export const STRONG_IMPACT = 600;
export type TickKind =
  "sensor" | "chamber-fired" | "impact" | "lock-released" | "vent-opened" | "vent-closed" | "wall-unsealed";
export interface EventTick {
  step: number;
  kind: TickKind;
  id: string;
}
export const eventNames: Record<TickKind, string> = {
  sensor: "Sensor acionado",
  "chamber-fired": "Câmara acendeu",
  impact: "Impacto forte",
  "lock-released": "Trava soltou",
  "vent-opened": "Respiro abriu",
  "vent-closed": "Respiro fechou",
  "wall-unsealed": "Parede saiu do furo",
};
export const eventIcons: Record<TickKind, string> = {
  sensor: "M-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M-6 0H6M0-6V6",
  "chamber-fired": "M0-6L-4 1L0 5L4 1Z",
  impact: "M-5-5L5 5M-5 5L5-5M0-6V6",
  "lock-released": "M-4 0H4V5H-4ZM-3 0V-3Q-3-6 1-5",
  "vent-opened": "M-5 0H-1M1 0H5M-2-4L2 0L-2 4",
  "vent-closed": "M-5 0H5M0-5V5",
  "wall-unsealed": "M-5 4H5M0 4V-5M-3-2L0-5L3-2",
};
export function eventTick(e: EngineEvent, step: number): EventTick | null {
  if (e.kind === "impact") return e.speed >= STRONG_IMPACT ? { step, kind: e.kind, id: e.a } : null;
  if (e.kind === "sensor") return { step, kind: e.kind, id: e.sensor };
  if (e.kind === "lock-released") return { step, kind: e.kind, id: e.lock };
  if (
    e.kind === "chamber-fired" ||
    e.kind === "vent-opened" ||
    e.kind === "vent-closed" ||
    e.kind === "wall-unsealed"
  )
    return { step, kind: e.kind, id: e.chamber };
  return null;
}

/** Ticks closer than this (px on the ruler) become one marker with a count. */
export const GROUP_PX = 18;
export interface TickGroup {
  /** seconds, of the first tick */
  t: number;
  events: EventTick[];
}

/**
 * Groups ticks (in time order) that would sit closer than `gap` px on a ruler of `pxPerSecond`,
 * from second `from` on. A group of one is a plain tick; more than one opens a list when tapped.
 */
export function groupTicks(events: EventTick[], pxPerSecond: number, from = 0, gap = GROUP_PX): TickGroup[] {
  const list: TickGroup[] = [];
  for (const event of events) {
    const t = event.step / 240;
    if (t < from) continue;
    const group = list.at(-1);
    if (group && (t - group.t) * pxPerSecond < gap) group.events.push(event);
    else list.push({ t, events: [event] });
  }
  return list;
}
