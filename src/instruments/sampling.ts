import type { EngineAdapter, Snapshot } from "@/engine/types";
import { sample, type Probe } from "./model";
export interface Sample {
  step: number;
  value: number | null;
  angle?: number;
}
export interface Series {
  probe: Probe;
  points: Sample[];
  cursor: Sample | null;
  crossings: number;
  clicks?: number;
}
/** Exact samples stay in the worker; chronological extrema preserve narrow peaks. */
export class Samples {
  probes: Probe[] = [];
  private data = new Map<string, Sample[]>();
  configure(probes: Probe[]) {
    this.probes = probes.slice(0, 4);
    for (const p of this.probes) if (!this.data.has(p.id)) this.data.set(p.id, []);
    for (const id of this.data.keys()) if (!this.probes.some((p) => p.id === id)) this.data.delete(id);
  }
  record(step: number, snapshot: Snapshot, engine: EngineAdapter) {
    for (const p of this.probes)
      this.data.get(p.id)?.push({
        step,
        value: sample(p, snapshot, engine),
        ...(p.countDrops ? { angle: snapshot.links[p.target]?.angle } : {}),
      });
  }
  truncate(step: number) {
    for (const [id, points] of this.data)
      this.data.set(
        id,
        points.filter((p) => p.step <= step),
      );
  }
  clear() {
    this.data.clear();
    this.configure(this.probes);
  }
  series(cursor: number, buckets = 240): Series[] {
    return this.probes.map((probe) => {
      const all = this.data.get(probe.id) ?? [];
      const size = Math.max(1, Math.ceil(all.length / buckets));
      const points: Sample[] = [];
      for (let i = 0; i < all.length; i += size) {
        const group = all.slice(i, i + size);
        const first = group[0],
          last = group.at(-1);
        if (!first || !last) continue;
        const valid = group.filter((p): p is Sample & { value: number } => p.value !== null);
        if (!valid.length) {
          points.push(first);
          continue;
        }
        const min = valid.reduce((a, b) => (a.value < b.value ? a : b));
        const max = valid.reduce((a, b) => (a.value > b.value ? a : b));
        points.push(
          ...[first, min, max, last].filter((p, j, a) => a.indexOf(p) === j).sort((a, b) => a.step - b.step),
        );
      }
      const threshold = probe.threshold;
      const crossings =
        threshold === undefined
          ? 0
          : all.reduce((n, p, i) => {
              const prev = all[i - 1]?.value;
              return (
                n + (prev != null && p.value != null && prev < threshold && p.value >= threshold ? 1 : 0)
              );
            }, 0);
      let clicks = 0,
        rising = false;
      for (let i = 1; i < all.length; i++) {
        const a = all[i - 1]?.angle,
          b = all[i]?.angle;
        if (a === undefined || b === undefined) continue;
        if (b - a > 0.002) rising = true;
        else if (rising && b - a < -0.002) {
          if ((all[i]?.step ?? 0) > 24) clicks++;
          rising = false;
        }
      }
      return {
        probe,
        points,
        clicks: probe.countDrops ? clicks : undefined,
        cursor: all.find((p) => p.step === cursor) ?? null,
        crossings,
      };
    });
  }
}
