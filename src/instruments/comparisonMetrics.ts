import type { EventTick } from "./events";
import type { Series } from "./sampling";
/** Cycle: ignition to first return within 0.5 mm of the drawn pose after maximum recoil. */
export function launcherMetrics(series: Series[], events: EventTick[]) {
  const fired = events.find((e) => e.kind === "chamber-fired")?.step;
  const points =
    series
      .find((s) => s.probe.id === "bolt-position")
      ?.points.filter((p) => fired !== undefined && p.step >= fired && p.value !== null) ?? [];
  const peak = points.reduce<(typeof points)[number] | undefined>(
    (a, b) => (!a || Math.abs(b.value ?? 0) > Math.abs(a.value ?? 0) ? b : a),
    undefined,
  );
  const returned =
    peak && Math.abs(peak.value ?? 0) > 0.5
      ? points.find((p) => p.step > peak.step && Math.abs(p.value ?? 0) <= 0.5)
      : undefined;
  return {
    recoil: peak ? Math.abs(peak.value ?? 0) : null,
    cycle: returned && fired !== undefined ? (returned.step - fired) / 240 : null,
  };
}
