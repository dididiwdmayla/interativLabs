import { FIXED_STEP } from "@/engine/common";
import type { EngineAdapter, Snapshot } from "@/engine/types";
import type { Vec2 } from "@/geometry/vec";
import type { Id, Scene } from "@/model/types";
import type { AssertionResult, BenchAssertion, BenchRun, BenchScript, SceneResult } from "./types";

/**
 * Executor da bancada, sem DOM: roda no Node, no Web Worker e no Vitest.
 * Cada roteiro roda duas vezes; a primeira mede, a segunda só refaz o hash
 * das poses para conferir o determinismo.
 */

const fmt = (n: number, d = 3) => (Number.isFinite(n) ? n.toFixed(d).replace(".", ",") : "—");
const deg = (r: number) => `${fmt((r * 180) / Math.PI, 1)}°`;

/** Hash FNV-1a de 64 bits (duas metades de 32) sobre inteiros. */
export class PoseHash {
  private a = 0x811c9dc5;
  private b = 0xcbf29ce4;
  private mix(v: number) {
    const lo = v >>> 0;
    const hi = Math.floor(v / 4294967296) >>> 0;
    for (const w of [lo, hi]) {
      for (let k = 0; k < 4; k++) {
        const byte = (w >>> (8 * k)) & 0xff;
        this.a = Math.imul(this.a ^ byte, 0x01000193) >>> 0;
        this.b = Math.imul(this.b ^ byte, 0x0100019d) >>> 0;
      }
    }
  }
  /** Poses arredondadas a 1e-6 mm (e 1e-6 rad). */
  addSnapshot(s: Snapshot, ids: Id[]): void {
    for (const id of ids) {
      const p = s.parts[id];
      if (!p) continue;
      this.mix(Math.round(p.x * 1e6));
      this.mix(Math.round(p.y * 1e6));
      this.mix(Math.round(p.angle * 1e6));
    }
  }
  digest(): string {
    return this.a.toString(16).padStart(8, "0") + this.b.toString(16).padStart(8, "0");
  }
}

interface Ctx {
  run: BenchRun;
  scene: Scene;
  dynamicParts: Id[];
  initial: Snapshot;
}

interface Evaluator {
  label: string;
  step(t: number, s: Snapshot, depth: number): void;
  result(final: Snapshot): { pass: boolean; value: string };
}

function dynamicParts(scene: Scene): Id[] {
  const screwed = new Set(scene.links.flatMap((l) => (l.kind === "screw" && l.a === null ? [l.b] : [])));
  return scene.parts.filter((p) => !p.fixed && !screwed.has(p.id)).map((p) => p.id);
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

class JitterAcc {
  private ref = new Map<Id, Vec2>();
  private acc = new Map<Id, { n: number; sx: number; sy: number; sxx: number; syy: number }>();
  private parts: Id[];
  private from: number;
  private to: number;
  constructor(parts: Id[], from: number, to: number) {
    this.parts = parts;
    this.from = from;
    this.to = to;
  }
  step(t: number, s: Snapshot) {
    if (t < this.from - 1e-9 || t > this.to + 1e-9) return;
    for (const id of this.parts) {
      const p = s.parts[id];
      if (!p) continue;
      let r = this.ref.get(id);
      if (!r) {
        r = [p.x, p.y];
        this.ref.set(id, r);
      }
      const dx = p.x - r[0];
      const dy = p.y - r[1];
      const a = this.acc.get(id) ?? { n: 0, sx: 0, sy: 0, sxx: 0, syy: 0 };
      a.n++;
      a.sx += dx;
      a.sy += dy;
      a.sxx += dx * dx;
      a.syy += dy * dy;
      this.acc.set(id, a);
    }
  }
  /** RMS do deslocamento em torno da posição média, mm. */
  rms(): number {
    let sum = 0;
    let n = 0;
    for (const a of this.acc.values()) {
      if (a.n < 2) continue;
      const vx = a.sxx / a.n - (a.sx / a.n) ** 2;
      const vy = a.syy / a.n - (a.sy / a.n) ** 2;
      sum += Math.max(0, vx + vy);
      n++;
    }
    return n ? Math.sqrt(sum / n) : 0;
  }
}

function evaluator(a: BenchAssertion, ctx: Ctx): Evaluator {
  const label = a.label;
  switch (a.kind) {
    case "maxDisplacement": {
      const ids = a.parts === "dynamic" ? ctx.dynamicParts : a.parts;
      let base: Snapshot | null = null;
      let max = 0;
      return {
        label,
        step(t, s) {
          if (t < a.from - 1e-9 || t > a.to + 1e-9) return;
          if (!base) base = s;
          for (const id of ids) {
            const p = s.parts[id];
            const q = base.parts[id];
            if (p && q) max = Math.max(max, dist(p, q));
          }
        },
        result: () => ({ pass: max <= a.max, value: `${fmt(max)} mm` }),
      };
    }
    case "sensorCount":
      return {
        label,
        step() {},
        result(f) {
          const n = f.links[a.sensor]?.count ?? 0;
          return { pass: n === a.equals, value: `${n} disparo${n === 1 ? "" : "s"}` };
        },
      };
    case "crossAfterSensor": {
      let ts = -1;
      let tc = -1;
      return {
        label,
        step(t, s) {
          if (ts < 0 && s.events.some((e) => e.kind === "sensor" && e.sensor === a.sensor)) ts = t;
          const p = s.parts[a.part];
          if (ts >= 0 && tc < 0 && p && p.x * a.axis[0] + p.y * a.axis[1] > a.value) tc = t;
        },
        result() {
          if (ts < 0) return { pass: false, value: "sensor não disparou" };
          if (tc < 0) return { pass: false, value: "não saiu do cano" };
          return { pass: tc - ts <= a.within + 1e-9, value: `${fmt(tc - ts)} s` };
        },
      };
    }
    case "linkAt": {
      let v: number | null = null;
      return {
        label,
        step(t, s) {
          if (v === null && t >= a.at - 1e-9) v = s.links[a.link]?.[a.field] ?? null;
        },
        result() {
          if (v === null) return { pass: false, value: "sem leitura" };
          const ok = (a.min === undefined || v >= a.min) && (a.max === undefined || v <= a.max);
          return { pass: ok, value: a.field === "angle" ? deg(v) : `${fmt(v, 2)} mm` };
        },
      };
    }
    case "returnsTo": {
      let d: number | null = null;
      return {
        label,
        step(t, s) {
          const p = s.parts[a.part];
          const q = ctx.initial.parts[a.part];
          if (d === null && t >= a.at - 1e-9 && p && q) d = dist(p, q);
        },
        result: () =>
          d === null ? { pass: false, value: "sem leitura" } : { pass: d <= a.tol, value: `${fmt(d)} mm` },
      };
    }
    case "ratio": {
      const marks: number[] = [];
      for (let i = 0; i <= a.windows; i++) marks.push(a.from + ((a.to - a.from) * i) / a.windows);
      const rows: Record<Id, number>[] = [];
      return {
        label,
        step(t, s) {
          const k = rows.length;
          if (k < marks.length && t >= marks[k]! - 1e-9) {
            const row: Record<Id, number> = { base: s.links[a.base]?.angle ?? NaN };
            for (const l of a.links) row[l.link] = s.links[l.link]?.angle ?? NaN;
            rows.push(row);
          }
        },
        result() {
          if (rows.length < marks.length) return { pass: false, value: "sem leitura" };
          let worst = 0;
          for (let i = 1; i < rows.length; i++) {
            const db = rows[i]!.base! - rows[i - 1]!.base!;
            for (const l of a.links) {
              const r = (rows[i]![l.link]! - rows[i - 1]![l.link]!) / db;
              worst = Math.max(worst, Math.abs(r / l.ratio - 1));
            }
          }
          if (!Number.isFinite(worst)) return { pass: false, value: "engrenagens paradas" };
          return { pass: worst < a.maxError, value: `erro máx. ${fmt(worst * 100, 2)}%` };
        },
      };
    }
    case "maxRotation": {
      let a0: number | null = null;
      let max = 0;
      return {
        label,
        step(t, s) {
          if (t < a.from - 1e-9 || t > a.to + 1e-9) return;
          const v = s.links[a.link]?.angle;
          if (v === undefined) return;
          if (a0 === null) a0 = v;
          max = Math.max(max, Math.abs(v - a0));
        },
        result: () => ({ pass: max < a.max, value: deg(max) }),
      };
    }
    case "jointGap": {
      const ids =
        a.links === "axles" ? ctx.scene.links.filter((l) => l.kind === "axle").map((l) => l.id) : a.links;
      let max = 0;
      return {
        label,
        step(_t, s) {
          for (const id of ids) max = Math.max(max, s.links[id]?.gap ?? 0);
        },
        result: () => ({ pass: max <= a.max, value: `${fmt(max)} mm` }),
      };
    }
    case "maxPenetration": {
      let max = 0;
      return {
        label,
        step(_t, _s, depth) {
          max = Math.max(max, depth);
        },
        result: () => ({ pass: max < a.max, value: `${fmt(max, 4)} mm` }),
      };
    }
    case "neverCrosses": {
      let max = -Infinity;
      return {
        label,
        step(_t, s) {
          const p = s.parts[a.part];
          if (p) max = Math.max(max, (p.x - a.point[0]) * a.normal[0] + (p.y - a.point[1]) * a.normal[1]);
        },
        result: () => ({
          pass: max <= 0,
          value: max <= 0 ? `folga ${fmt(-max, 2)} mm` : `passou ${fmt(max, 2)} mm`,
        }),
      };
    }
    case "rackFollows": {
      const times = ctx.run.inputs
        .filter((i) => i.kind === "motor" && i.link === a.motor)
        .map((i) => (i.kind === "motor" ? i.t : 0));
      const speeds = ctx.run.inputs.filter((i) => i.kind === "motor" && i.link === a.motor);
      const marks = [0, ...times, ctx.run.duration].filter((v, i, arr) => i === 0 || v > arr[i - 1]!);
      const rows: { th: number; x: number }[] = [];
      return {
        label,
        step(t, s) {
          if (rows.length < marks.length && t >= marks[rows.length]! - 1e-9) {
            rows.push({ th: s.links[a.axle]?.angle ?? NaN, x: s.links[a.slider]?.translation ?? NaN });
          }
        },
        result(f) {
          if (rows.length < marks.length - 1) return { pass: false, value: "sem leitura" };
          if (rows.length < marks.length)
            rows.push({ th: f.links[a.axle]?.angle ?? NaN, x: f.links[a.slider]?.translation ?? NaN });
          let worst = 0;
          let minTurn = Infinity;
          const sc = ctx.scene.links.find((l) => l.id === a.motor);
          const sp0 = sc && sc.kind === "axle" ? Math.abs(sc.motor?.speed ?? 0) : 0;
          for (let i = 1; i < rows.length; i++) {
            const dth = rows[i]!.th - rows[i - 1]!.th;
            const dx = rows[i]!.x - rows[i - 1]!.x;
            const ideal = a.radius * Math.abs(dth);
            worst = Math.max(worst, ideal > 0 ? Math.abs(Math.abs(dx) - ideal) / ideal : Infinity);
            const sp =
              i === 1 ? sp0 : Math.abs((speeds[i - 2] as { speed: number } | undefined)?.speed ?? sp0);
            const cmd = sp * (marks[i]! - marks[i - 1]!);
            if (cmd > 0) minTurn = Math.min(minTurn, Math.abs(dth) / cmd);
          }
          const ok = worst < a.maxError && minTurn >= a.minTurn;
          return {
            pass: ok,
            value: `erro máx. ${fmt(worst * 100, 2)}%, giro mín. ${fmt(minTurn * 100, 0)}%`,
          };
        },
      };
    }
    case "jitter": {
      const ids = a.parts === "dynamic" ? ctx.dynamicParts : a.parts;
      const acc = new JitterAcc(ids, a.from, a.to);
      return {
        label,
        step(t, s) {
          acc.step(t, s);
        },
        result: () => {
          const r = acc.rms();
          return { pass: r < a.max, value: `${fmt(r, 4)} mm` };
        },
      };
    }
  }
}

function applyOverride(scene: Scene, run: BenchRun): Scene {
  if (!run.override) return scene;
  const s: Scene = { ...scene, parts: scene.parts.map((p) => ({ ...p })) };
  for (const p of s.parts) {
    const o = run.override[p.id];
    if (!o) continue;
    if (o.x !== undefined) p.x = o.x;
    if (o.y !== undefined) p.y = o.y;
    if (o.angle !== undefined) p.angle = o.angle;
  }
  return s;
}

export interface RunOptions {
  unitMm: number;
  now: () => number;
  /** relógio grosso (navegador): mede em lotes de 10 passos */
  coarseTimer: boolean;
  /** cede a vez para a interface entre execuções (worker) */
  yieldEvery?: () => Promise<void>;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[i]!;
}

/** Roda um roteiro inteiro (todas as execuções, duas vezes) num adaptador. */
export async function runScript(
  adapter: EngineAdapter,
  script: BenchScript,
  scene: Scene,
  opts: RunOptions,
): Promise<SceneResult> {
  const h = FIXED_STEP;
  const wall0 = opts.now();
  const times: number[] = [];
  let maxDepth = 0;
  let jitter: number | null = null;
  const warnings = new Set<string>();
  const byLabel = new Map<string, { pass: boolean; values: string[]; failRuns: string[] }>();
  const hashes = [new PoseHash(), new PoseHash()];
  const allIds = scene.parts.map((p) => p.id);
  const dyn = dynamicParts(scene);

  for (let rep = 0; rep < 2; rep++) {
    for (let ri = 0; ri < script.runs.length; ri++) {
      const run = script.runs[ri]!;
      const sc = applyOverride(scene, run);
      const report = adapter.compile(sc, { unitMm: opts.unitMm });
      if (rep === 0) for (const w of report.warnings) warnings.add(w);
      const initial = adapter.snapshot();
      const ctx: Ctx = { run, scene: sc, dynamicParts: dyn, initial };
      const evals = rep === 0 ? run.assertions.map((a) => evaluator(a, ctx)) : [];
      const still = rep === 0 && script.still && script.still.run === ri ? script.still : null;
      const stillAcc = still
        ? new JitterAcc(still.parts === "dynamic" ? dyn : still.parts, still.from, still.to)
        : null;
      const n = Math.round(run.duration / h);
      const drags = run.inputs.filter((i) => i.kind === "drag");
      let batch = 0;
      let batchN = 0;
      for (let i = 0; i < n; i++) {
        const t = i * h;
        for (const inp of run.inputs) {
          if (inp.kind === "motor" && inp.t >= t - 1e-9 && inp.t < t + h - 1e-9)
            adapter.setMotorSpeed(inp.link, inp.speed);
          if (inp.kind === "velocity" && inp.t >= t - 1e-9 && inp.t < t + h - 1e-9)
            adapter.setVelocity(inp.part, inp.v, inp.omega);
        }
        for (const d of drags) {
          if (d.kind !== "drag") continue;
          if (d.t0 >= t - 1e-9 && d.t0 < t + h - 1e-9) adapter.dragStart(d.part, d.from);
          if (t > d.t0 && t <= d.t1 + 1e-9) {
            const u = Math.min(1, (t - d.t0) / (d.t1 - d.t0));
            adapter.dragMove([d.from[0] + (d.to[0] - d.from[0]) * u, d.from[1] + (d.to[1] - d.from[1]) * u]);
          }
          if (d.release >= t - 1e-9 && d.release < t + h - 1e-9) adapter.dragEnd();
        }
        const t0 = opts.now();
        adapter.step(h);
        const dt = opts.now() - t0;
        const s = adapter.snapshot();
        const tt = (i + 1) * h;
        if (rep === 0) {
          if (opts.coarseTimer) {
            batch += dt;
            if (++batchN === 10) {
              times.push(batch / 10);
              batch = 0;
              batchN = 0;
            }
          } else times.push(dt);
          const depth = adapter.contactsDepthMax();
          maxDepth = Math.max(maxDepth, depth);
          for (const e of evals) e.step(tt, s, depth);
          stillAcc?.step(tt, s);
        }
        if ((i + 1) % 60 === 0 || i === n - 1) hashes[rep]!.addSnapshot(s, allIds);
      }
      if (rep === 0) {
        const f = adapter.snapshot();
        for (const e of evals) {
          const r = e.result(f);
          const cur = byLabel.get(e.label) ?? { pass: true, values: [], failRuns: [] };
          cur.pass &&= r.pass;
          cur.values.push(r.value);
          if (!r.pass) cur.failRuns.push(run.name);
          byLabel.set(e.label, cur);
        }
        if (stillAcc) jitter = stillAcc.rms();
      }
      await opts.yieldEvery?.();
    }
  }
  adapter.dispose();

  const assertions: AssertionResult[] = [];
  for (const [label, r] of byLabel) {
    const multi = r.values.length > 1;
    const value = multi
      ? r.pass
        ? `${r.values.length} de ${r.values.length} ok`
        : `${r.failRuns.length} de ${r.values.length} falharam (${r.failRuns.slice(0, 3).join(", ")}${r.failRuns.length > 3 ? "…" : ""})`
      : r.values[0]!;
    assertions.push({ label, pass: r.pass, value, run: multi ? "todas" : (script.runs[0]?.name ?? "") });
  }
  const sorted = times.slice().sort((a, b) => a - b);
  const hash = hashes[0]!.digest();
  const hashRepeat = hashes[1]!.digest();
  return {
    scene: script.id,
    title: script.title,
    engine: adapter.meta.id,
    unitMm: opts.unitMm,
    pass: assertions.every((a) => a.pass),
    failed: assertions.filter((a) => !a.pass).map((a) => a.label),
    assertions,
    steps: times.length * (opts.coarseTimer ? 10 : 1),
    stepMedian: quantile(sorted, 0.5),
    stepP95: quantile(sorted, 0.95),
    timing: opts.coarseTimer ? "lote de 10" : "passo",
    maxDepth,
    jitter,
    hash,
    hashRepeat,
    deterministic: hash === hashRepeat,
    warnings: [...warnings],
    wallMs: opts.now() - wall0,
  };
}

/** Resolução do relógio, µs (menor intervalo não nulo observado). */
export function timerResolutionUs(now: () => number): number {
  let min = Infinity;
  let last = now();
  for (let i = 0; i < 20000 && min > 0.0005; i++) {
    const t = now();
    if (t > last) {
      min = Math.min(min, t - last);
      last = t;
    }
  }
  return Number.isFinite(min) ? min * 1000 : 1000;
}
