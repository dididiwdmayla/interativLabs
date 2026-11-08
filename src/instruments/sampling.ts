import type { EngineAdapter, Snapshot } from "@/engine/types";
import { eventTick, type TickKind } from "./events";
import { sample, type Probe, type ProbeEvent } from "./model";

export interface Sample {
  step: number;
  value: number | null;
  angle?: number;
  /** Pawl drops counted up to this step, and whether the angle was rising (see `Probe.countDrops`). */
  drops?: number;
  rising?: boolean;
}
/** A reading taken at an event (see `Probe.at`). */
export interface Mark {
  step: number;
  value: number | null;
}
export interface Series {
  probe: Probe;
  points: Sample[];
  cursor: Sample | null;
  crossings: number;
  clicks?: number;
  /** Readings at each occurrence of the probe's event, oldest first. */
  marks?: Mark[];
}

/**
 * The last ten seconds of every probe stay exact: the stage can only show those poses, so the
 * cursor can only land there. Older samples are folded into a min/max envelope, so no peak is
 * lost, and the envelope is thinned again past OLD_LIMIT points. Memory per probe is bounded
 * (about 8 700 samples) however long the run is.
 */
export const EXACT_STEPS = 2401;
const CHUNK = 240;
const BUCKET = 12;
const OLD_LIMIT = 6000;
const MARK_LIMIT = 400;
const LOG_LIMIT = 2000;
/** The first steps are settling; a pawl drop there is not a click. */
const SETTLE_STEPS = 24;
const DROP_EPSILON = 0.002;

/** Keeps the lowest and the highest sample of each `size` consecutive ones, in time order. */
function envelope(points: Sample[], size: number): Sample[] {
  const out: Sample[] = [];
  for (let i = 0; i < points.length; i += size) {
    const group = points.slice(i, i + size);
    const valid = group.filter((p): p is Sample & { value: number } => p.value !== null);
    const first = group[0];
    if (!valid.length) {
      if (first) out.push(first);
      continue;
    }
    const min = valid.reduce((a, b) => (a.value <= b.value ? a : b));
    const max = valid.reduce((a, b) => (a.value >= b.value ? a : b));
    out.push(...(min === max ? [min] : min.step < max.step ? [min, max] : [max, min]));
  }
  return out;
}

class Track {
  old: Sample[] = [];
  recent: Sample[] = [];
  push(s: Sample) {
    this.recent.push(s);
    if (this.recent.length > EXACT_STEPS + CHUNK) {
      this.old.push(...envelope(this.recent.splice(0, CHUNK), BUCKET));
      if (this.old.length > OLD_LIMIT) this.old = envelope(this.old, 4);
    }
  }
  all(): Sample[] {
    return this.old.length ? [...this.old, ...this.recent] : this.recent;
  }
  last(): Sample | undefined {
    return this.recent.at(-1);
  }
  /** The sample at `step`, exact only inside the recent window. */
  at(step: number): Sample | undefined {
    const first = this.recent[0]?.step;
    return first === undefined
      ? undefined
      : this.recent[step - first]?.step === step
        ? this.recent[step - first]
        : undefined;
  }
  /** The latest retained sample not after `step`. */
  near(step: number): Sample | undefined {
    const all = this.all();
    let found: Sample | undefined;
    for (const s of all) {
      if (s.step > step) break;
      found = s;
    }
    return found;
  }
  truncate(step: number) {
    this.recent = this.recent.filter((p) => p.step <= step);
    this.old = this.old.filter((p) => p.step <= step);
  }
  get size() {
    return this.old.length + this.recent.length;
  }
}

/** Exact samples stay in the worker; chronological extrema preserve narrow peaks. */
export class Samples {
  probes: Probe[] = [];
  private origin: Snapshot["parts"] = {};
  private tracks = new Map<string, Track>();
  private marks = new Map<string, Mark[]>();
  /** For a crossing event, the watched reading at each step (index = step). */
  private watched = new Map<string, (number | null)[]>();
  private log: { step: number; kind: TickKind }[] = [];

  configure(probes: Probe[]) {
    const before = new Map(this.probes.map((p) => [p.id, JSON.stringify(p.at ?? null)]));
    this.probes = probes.slice(0, 4);
    for (const p of this.probes) {
      if (!this.tracks.has(p.id)) this.tracks.set(p.id, new Track());
      // A new event on a probe that already has history can only be rebuilt for the kinds the log knows.
      if (before.has(p.id) && before.get(p.id) !== JSON.stringify(p.at ?? null)) this.rebuild(p);
    }
    for (const id of this.tracks.keys())
      if (!this.probes.some((p) => p.id === id)) {
        this.tracks.delete(id);
        this.marks.delete(id);
        this.watched.delete(id);
      }
  }

  private rebuild(p: Probe) {
    this.watched.delete(p.id);
    const track = this.tracks.get(p.id);
    const at = p.at;
    this.marks.set(
      p.id,
      at?.kind === "tick" && track
        ? this.log
            .filter((e) => e.kind === at.tick)
            .map((e) => ({ step: e.step, value: track.near(e.step)?.value ?? null }))
        : [],
    );
  }

  record(step: number, snapshot: Snapshot, engine: EngineAdapter) {
    if (step === 0) this.origin = snapshot.parts;
    for (const e of snapshot.events) {
      const tick = eventTick(e, step);
      if (tick) this.log.push({ step, kind: tick.kind });
    }
    if (this.log.length > LOG_LIMIT) this.log.splice(0, this.log.length - LOG_LIMIT);
    for (const p of this.probes) {
      const track = this.tracks.get(p.id);
      if (!track) continue;
      const value = this.value(p, snapshot, engine);
      const next: Sample = { step, value };
      if (p.countDrops) {
        const angle = snapshot.links[p.target]?.angle;
        const prev = track.last();
        let drops = prev?.drops ?? 0;
        let rising = prev?.rising ?? false;
        if (angle !== undefined && prev?.angle !== undefined) {
          const d = angle - prev.angle;
          if (d > DROP_EPSILON) rising = true;
          else if (rising && d < -DROP_EPSILON) {
            if (step > SETTLE_STEPS) drops++;
            rising = false;
          }
        }
        Object.assign(next, { angle, drops, rising });
      }
      track.push(next);
      if (p.at && this.happened(p, p.at, step, snapshot, engine)) {
        const marks = this.marks.get(p.id) ?? [];
        marks.push({ step, value });
        if (marks.length > MARK_LIMIT) marks.shift();
        this.marks.set(p.id, marks);
      }
    }
  }

  /** Did the probe's event occur at this step? */
  private happened(p: Probe, at: ProbeEvent, step: number, snapshot: Snapshot, engine: EngineAdapter) {
    if (at.kind === "tick") return snapshot.events.some((e) => eventTick(e, step)?.kind === at.tick);
    const reading = sample({ id: "", name: "", target: at.target, quantity: at.quantity }, snapshot, engine);
    const watched = this.watched.get(p.id) ?? [];
    watched[step] = reading;
    this.watched.set(p.id, watched);
    const before = watched[step - 1];
    return before != null && reading != null && before < at.threshold && reading >= at.threshold;
  }

  private value(p: Probe, snapshot: Snapshot, engine: EngineAdapter) {
    const value = sample(p, snapshot, engine);
    if (value === null || (p.quantity !== "x" && p.quantity !== "y")) return value;
    const origin = this.origin[p.target]?.[p.quantity];
    return origin === undefined ? null : value - origin;
  }

  truncate(step: number) {
    for (const track of this.tracks.values()) track.truncate(step);
    for (const [id, marks] of this.marks)
      this.marks.set(
        id,
        marks.filter((m) => m.step <= step),
      );
    for (const watched of this.watched.values()) watched.length = Math.min(watched.length, step + 1);
    this.log = this.log.filter((e) => e.step <= step);
  }

  clear() {
    this.tracks.clear();
    this.marks.clear();
    this.watched.clear();
    this.log = [];
    this.configure(this.probes);
  }

  /** Samples retained for each probe (memory bound check). */
  stored(): number {
    let n = 0;
    for (const t of this.tracks.values()) n += t.size;
    return n;
  }

  series(cursor: number, buckets = 240): Series[] {
    return this.probes.map((probe) => {
      const track = this.tracks.get(probe.id);
      const all = track?.all() ?? [];
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
      const marks = this.marks.get(probe.id);
      return {
        probe,
        points,
        clicks: probe.countDrops ? (track?.last()?.drops ?? 0) : undefined,
        cursor: track?.at(cursor) ?? null,
        crossings,
        ...(probe.at ? { marks: marks?.slice() ?? [] } : {}),
      };
    });
  }
}
