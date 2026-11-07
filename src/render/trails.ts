import type { Vec2 } from "@/model/types";

export interface TrailSample {
  t: number;
  p: Vec2;
}
export const TRAIL_SLOTS = 12;
export const TRAIL_BANDS = 8;
const WINDOW = 0.5;

/** Short simulation-time history, independent of frame rate and playback speed. */
export class TrailHistory {
  samples = new Map<string, TrailSample[]>();
  private last = -Infinity;
  clear() {
    this.samples.clear();
    this.last = -Infinity;
  }
  update(time: number, points: ReadonlyMap<string, Vec2>, selected: string | null): string[] {
    if (time < this.last) this.clear();
    for (const id of this.samples.keys()) if (!points.has(id)) this.samples.delete(id);
    for (const [id, p] of points) {
      const samples = this.samples.get(id) ?? [];
      while (samples.length && samples[0]!.t < time - WINDOW) samples.shift();
      if (!samples.length || time - samples[samples.length - 1]!.t >= 1 / 120) samples.push({ t: time, p });
      // Bound memory even when redraw runs faster than the simulation.
      if (samples.length > 256) samples.splice(0, samples.length - 256);
      this.samples.set(id, samples);
    }
    this.last = time;
    const moving = [...this.samples]
      .filter(([, samples]) => {
        let distance = 0;
        for (let i = 1; i < samples.length; i++)
          distance += Math.hypot(
            samples[i]!.p[0] - samples[i - 1]!.p[0],
            samples[i]!.p[1] - samples[i - 1]!.p[1],
          );
        return distance > 2;
      })
      .map(([id]) => id);
    return [...new Set([...(selected && points.has(selected) ? [selected] : []), ...moving])].slice(
      0,
      TRAIL_SLOTS,
    );
  }
  path(id: string, band: number, time: number, offset: Vec2 = [0, 0]): string {
    const samples = this.samples.get(id) ?? [];
    let d = "";
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1]!,
        b = samples[i]!;
      const age = Math.min(TRAIL_BANDS - 1, Math.floor(((time - b.t) / WINDOW) * TRAIL_BANDS));
      if (age !== band) continue;
      const xy = (p: Vec2) => `${(p[0] + offset[0]).toFixed(2)} ${(p[1] + offset[1]).toFixed(2)}`;
      d += `M${xy(a.p)}L${xy(b.p)}`;
    }
    return d;
  }
}
