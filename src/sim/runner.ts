import { FIXED_STEP } from "@/engine/common";
import type { EngineAdapter, LinkState, Snapshot } from "@/engine/types";
import { dcos, dhypot, dpow, dsin } from "@/geometry/dmath";
import type { Vec2 } from "@/geometry/vec";
import type { Id, Link, Scene } from "@/model/types";
import type { FixtureScript, Quantity, ScriptAssertion, ScriptInput, ScriptRun } from "./script";

/**
 * Executor dos roteiros das cenas de teste, sem DOM (Node, Vitest e
 * navegador). Cada passo monta o snapshot, alimenta as afirmações e, a cada
 * 60 passos, o hash das poses (determinismo entre plataformas).
 */

export const fmt = (n: number, d = 3) => (Number.isFinite(n) ? n.toFixed(d).replace(".", ",") : "—");

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

export interface AssertionResult {
  label: string;
  run: string;
  pass: boolean;
  /** valor medido, em português */
  value: string;
  expectedFailure?: string;
}

export interface RunResult {
  name: string;
  assertions: AssertionResult[];
  steps: number;
  /** ms por passo (só step()) */
  stepMedian: number;
  stepP95: number;
  maxDepth: number;
  warnings: string[];
}

export interface FixtureResult {
  id: string;
  runs: RunResult[];
  hash: string;
  pass: boolean;
}

// ——— grandezas ———

interface QCtx {
  scene: Scene;
  initial: Snapshot;
  links: Map<Id, Link>;
}

function localToWorld(s: Snapshot, part: Id | null, at: Vec2): Vec2 | null {
  if (part === null) return at;
  const p = s.parts[part];
  if (!p) return null;
  const c = dcos(p.angle);
  const n = dsin(p.angle);
  return [p.x + at[0] * c - at[1] * n, p.y + at[0] * n + at[1] * c];
}

function field(st: LinkState | undefined, path: string): number {
  let v: unknown = st;
  for (const k of path.split(".")) {
    if (v === null || v === undefined) return NaN;
    v = (v as Record<string, unknown>)[k];
  }
  return typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : NaN;
}

export function measure(q: Quantity, s: Snapshot, ctx: QCtx): number {
  if ("pv" in q) {
    const st = s.links[q.pv];
    return (st?.pressure ?? NaN) * dpow(st?.volume ?? NaN, q.gamma);
  }
  if ("gasForce" in q) {
    const st = s.links[q.gasForce];
    const l = ctx.links.get(q.gasForce);
    if (!st || !l || l.kind !== "chamber") return NaN;
    const A = (Math.PI * l.bore * l.bore) / 4;
    const expected = ((st.pressure ?? NaN) - q.p0) * A * 1e-3;
    return (st.walls?.[q.wall]?.force ?? NaN) / expected;
  }
  if ("dist" in q) {
    const a = localToWorld(s, q.dist[0].part, q.dist[0].at);
    const b = localToWorld(s, q.dist[1].part, q.dist[1].at);
    return a && b ? dhypot(b[0] - a[0], b[1] - a[1]) : NaN;
  }
  if ("link" in q) return field(s.links[q.link], q.field);
  if ("field" in q) return s.parts[q.part]?.[q.field] ?? NaN;
  const at = q.at ?? [0, 0];
  const p = localToWorld(s, q.part, at);
  const p0 = localToWorld(ctx.initial, q.part, at);
  if (!p || !p0) return NaN;
  if ("disp" in q) return dhypot(p[0] - p0[0], p[1] - p0[1]);
  const l = dhypot(q.along[0], q.along[1]);
  return ((p[0] - p0[0]) * q.along[0] + (p[1] - p0[1]) * q.along[1]) / l;
}

// ——— afirmações ———

interface Evaluator {
  step(t: number, s: Snapshot, depth: number): void;
  result(): { pass: boolean; value: string };
}

const inWin = (t: number, from = -Infinity, to = Infinity) => t >= from - 1e-9 && t <= to + 1e-9;
const within = (v: number, min?: number, max?: number) =>
  Number.isFinite(v) && (min === undefined || v >= min) && (max === undefined || v <= max);
const matches = (e: Record<string, unknown>, kind: string, m?: Record<string, string | number>) =>
  e.kind === kind && (!m || Object.entries(m).every(([k, v]) => e[k] === v));

function evaluator(a: ScriptAssertion, ctx: QCtx): Evaluator {
  switch (a.kind) {
    case "range": {
      let lo = Infinity;
      let hi = -Infinity;
      return {
        step(t, s) {
          if (!inWin(t, a.from, a.to)) return;
          const v = measure(a.q, s, ctx);
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
          if (Number.isNaN(v)) lo = hi = NaN;
        },
        result: () => ({
          pass: within(lo, a.min, a.max) && within(hi, a.min, a.max),
          value: `de ${fmt(lo, 4)} a ${fmt(hi, 4)}`,
        }),
      };
    }
    case "at": {
      let v: number | null = null;
      return {
        step(t, s) {
          if (v === null && t >= a.t - 1e-9) v = measure(a.q, s, ctx);
        },
        result: () =>
          v === null
            ? { pass: false, value: "sem leitura" }
            : { pass: within(v, a.min, a.max), value: fmt(v, 4) },
      };
    }
    case "mean": {
      let sum = 0;
      let n = 0;
      return {
        step(t, s) {
          if (!inWin(t, a.from, a.to)) return;
          sum += measure(a.q, s, ctx);
          n++;
        },
        result: () => {
          const m = n ? sum / n : NaN;
          return { pass: within(m, a.min, a.max), value: fmt(m, 4) };
        },
      };
    }
    case "span":
    case "relSpan": {
      let lo = Infinity;
      let hi = -Infinity;
      let sum = 0;
      let n = 0;
      return {
        step(t, s) {
          if (!inWin(t, a.from, a.to)) return;
          const v = measure(a.q, s, ctx);
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
          sum += v;
          n++;
        },
        result: () => {
          const span = hi - lo;
          if (a.kind === "span") return { pass: within(span, a.min, a.max), value: fmt(span, 4) };
          const rel = span / Math.abs(sum / n);
          return { pass: within(rel, undefined, a.max), value: `${fmt(rel * 100, 3)}%` };
        },
      };
    }
    case "period":
    case "decays": {
      const samples: [number, number][] = [];
      return {
        step(t, s) {
          if (inWin(t, a.from, a.to)) samples.push([t, measure(a.q, s, ctx)]);
        },
        result: () => {
          if (samples.length < 4) return { pass: false, value: "sem leitura" };
          const mean = samples.reduce((acc, x) => acc + x[1], 0) / samples.length;
          if (a.kind === "period") {
            const ups: number[] = [];
            for (let i = 1; i < samples.length; i++) {
              const [t0, v0] = samples[i - 1]!;
              const [t1, v1] = samples[i]!;
              if (v0 < mean && v1 >= mean) ups.push(t0 + ((mean - v0) / (v1 - v0)) * (t1 - t0));
            }
            if (ups.length < 2) return { pass: false, value: "não oscilou" };
            const T = (ups[ups.length - 1]! - ups[0]!) / (ups.length - 1);
            const err = T / a.expected - 1;
            return {
              pass: Math.abs(err) <= a.tol,
              value: `${fmt(T, 4)} s (esperado ${fmt(a.expected, 4)} s, erro ${fmt(err * 100, 2)}%)`,
            };
          }
          // amplitude de cada meio ciclo: extremos entre passagens pela posição final
          const rest = samples[samples.length - 1]![1];
          const peaks: number[] = [];
          let cur = 0;
          let sign = 0;
          for (const [, v] of samples) {
            const d = v - rest;
            const sg = d > 0 ? 1 : d < 0 ? -1 : 0;
            if (sg !== 0 && sg !== sign) {
              if (sign !== 0) peaks.push(cur);
              sign = sg;
              cur = 0;
            }
            cur = Math.max(cur, Math.abs(d));
          }
          const big = peaks.filter((p) => p > a.final);
          let ok = big.length >= 2;
          for (let i = 1; i < big.length; i++) if (big[i]! >= big[i - 1]!) ok = false;
          const tail = samples.slice(-Math.max(2, Math.floor(samples.length / 20)));
          const end = Math.max(...tail.map((x) => Math.abs(x[1] - rest)));
          ok &&= end <= a.final;
          return {
            pass: ok,
            value: `${big.length} meios ciclos decrescentes (${big
              .slice(0, 4)
              .map((p) => fmt(p, 3))
              .join(" → ")}…), no fim ${fmt(end, 4)}`,
          };
        },
      };
    }
    case "compare": {
      let v: number | null = null;
      return {
        step(t, s) {
          if (v !== null || t < a.t - 1e-9) return;
          const x = measure(a.a, s, ctx);
          const y = measure(a.b, s, ctx);
          v = a.op === "ratio" ? x / y : (x + y) / Math.abs(x);
        },
        result: () =>
          v === null
            ? { pass: false, value: "sem leitura" }
            : { pass: within(v, a.min, a.max), value: a.op === "ratio" ? fmt(v, 5) : `${fmt(v * 100, 3)}%` },
      };
    }
    case "events": {
      let n = 0;
      return {
        step(_t, s) {
          for (const e of s.events) if (matches(e as never, a.event, a.match)) n++;
        },
        result: () => ({ pass: within(n, a.min, a.max), value: `${n} evento${n === 1 ? "" : "s"}` }),
      };
    }
    case "onlyAfter": {
      let tEvent = -1;
      let tMove = -1;
      let q0: number | null = null;
      return {
        step(t, s) {
          const v = measure(a.q, s, ctx);
          q0 ??= v;
          if (tEvent < 0 && s.events.some((e) => matches(e as never, a.event, a.match))) tEvent = t;
          if (tMove < 0 && Math.abs(v - q0) > a.threshold) tMove = t;
        },
        result: () => {
          if (tEvent < 0) return { pass: false, value: "o evento não aconteceu" };
          if (tMove < 0) return { pass: false, value: `evento em ${fmt(tEvent, 4)} s; não se moveu` };
          return {
            pass: tMove >= tEvent - 1e-9,
            value: `evento em ${fmt(tEvent * 1000, 1)} ms, movimento em ${fmt(tMove * 1000, 1)} ms`,
          };
        },
      };
    }
    case "dropsAfter": {
      let peak = -Infinity;
      let tEvent = -1;
      let tDrop = -1;
      return {
        step(t, s) {
          const v = measure(a.q, s, ctx);
          if (tEvent < 0) {
            peak = Math.max(peak, v);
            if (s.events.some((e) => matches(e as never, a.event, a.match))) tEvent = t;
          }
          if (tEvent >= 0 && tDrop < 0 && v < a.fraction * peak) tDrop = t;
        },
        result: () => {
          if (tEvent < 0) return { pass: false, value: "o evento não aconteceu" };
          if (tDrop < 0) return { pass: false, value: "não caiu" };
          const dt = tDrop - tEvent;
          return {
            pass: dt <= a.within + 1e-9,
            value: `caiu em ${fmt(dt * 1000, 1)} ms (pico ${fmt(peak, 1)})`,
          };
        },
      };
    }
    case "maxDisp": {
      const ids =
        a.parts === "dynamic"
          ? ctx.scene.parts
              .filter(
                (p) =>
                  !p.fixed &&
                  !ctx.scene.links.some((l) => l.kind === "screw" && l.a === null && l.b === p.id),
              )
              .map((p) => p.id)
          : a.parts;
      let base: Snapshot | null = null;
      let max = 0;
      return {
        step(t, s) {
          if (!inWin(t, a.from, a.to)) return;
          base ??= a.from === undefined ? ctx.initial : s;
          for (const id of ids) {
            const p = s.parts[id];
            const q = base.parts[id];
            if (p && q) max = Math.max(max, dhypot(p.x - q.x, p.y - q.y));
          }
        },
        result: () => ({ pass: max <= a.max, value: `${fmt(max, 4)} mm` }),
      };
    }
    case "maxField": {
      const ids =
        a.links === "axles" ? ctx.scene.links.filter((l) => l.kind === "axle").map((l) => l.id) : a.links;
      let max = 0;
      return {
        step(_t, s) {
          for (const id of ids) max = Math.max(max, field(s.links[id], a.field));
        },
        result: () => ({ pass: max <= a.max, value: fmt(max, 4) }),
      };
    }
    case "maxPenetration": {
      let max = 0;
      return {
        step(t, _s, depth) {
          if (inWin(t, a.from)) max = Math.max(max, depth);
        },
        result: () => ({ pass: max < a.max, value: `${fmt(max, 4)} mm` }),
      };
    }
  }
}

// ——— execução ———

export function applyRunChanges(scene: Scene, run: Pick<ScriptRun, "override" | "patch">): Scene {
  if (!run.override && !run.patch) return scene;
  const s: Scene = structuredClone(scene);
  for (const p of s.parts) {
    const o = run.override?.[p.id];
    if (!o) continue;
    if (o.x !== undefined) p.x = o.x;
    if (o.y !== undefined) p.y = o.y;
    if (o.angle !== undefined) p.angle = o.angle;
  }
  for (const l of s.links) {
    const patch = run.patch?.[l.id];
    if (patch) Object.assign(l, patch);
  }
  return s;
}

/** Aplica as entradas do roteiro que caem no passo que começa em t. */
export function applyInputs(adapter: EngineAdapter, inputs: ScriptInput[], t: number, h: number): void {
  const now = (x: number) => x >= t - 1e-9 && x < t + h - 1e-9;
  for (const inp of inputs) {
    switch (inp.kind) {
      case "motor":
        if (now(inp.t)) adapter.setMotorSpeed(inp.link, inp.speed);
        break;
      case "velocity":
        if (now(inp.t)) adapter.setVelocity(inp.part, inp.v, inp.omega);
        break;
      case "ignite":
        if (now(inp.t)) adapter.ignite(inp.link);
        break;
      case "vent":
        if (now(inp.t)) adapter.setVent(inp.link, inp.vent, inp.open);
        break;
      case "force":
        if (now(inp.t0)) adapter.setForce(inp.part, inp.f, inp.at);
        if (now(inp.t1)) adapter.setForce(inp.part, null);
        break;
      case "drag":
      case "dragPath": {
        const path = inp.kind === "drag" ? [inp.from, inp.to] : inp.path;
        if (now(inp.t0)) adapter.dragStart(inp.part, path[0]!);
        if (t > inp.t0 && t <= inp.t1 + 1e-9) {
          const u = Math.min(1, (t - inp.t0) / (inp.t1 - inp.t0)) * (path.length - 1);
          const i = Math.min(path.length - 2, Math.floor(u));
          const f = u - i;
          const a = path[i]!;
          const b = path[i + 1]!;
          adapter.dragMove([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
        }
        if (now(inp.release)) adapter.dragEnd();
        break;
      }
    }
  }
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[i]!;
}

export interface RunFixtureOptions {
  unitMm?: number;
  now?: () => number;
  /** relógio grosso (navegador): mede o tempo em lotes de 10 passos */
  coarseTimer?: boolean;
  /** cede a vez entre execuções */
  yieldEvery?: () => Promise<void>;
}

/** Roda todas as execuções de uma cena de teste num adaptador novo (compila de novo a cada uma). */
export async function runFixture(
  adapter: EngineAdapter,
  script: FixtureScript,
  scene: Scene,
  opts: RunFixtureOptions = {},
): Promise<FixtureResult> {
  const h = FIXED_STEP;
  const now = opts.now ?? (() => 0);
  const hash = new PoseHash();
  const ids = scene.parts.map((p) => p.id);
  const runs: RunResult[] = [];
  for (const run of script.runs) {
    const sc = applyRunChanges(scene, run);
    const report = adapter.compile(sc, { unitMm: opts.unitMm ?? 1 });
    const initial = adapter.snapshot();
    const ctx: QCtx = { scene: sc, initial, links: new Map(sc.links.map((l) => [l.id, l] as const)) };
    const evals = run.assertions.map((a) => evaluator(a, ctx));
    const n = Math.round(run.duration / h);
    const times: number[] = [];
    let batch = 0;
    let batchN = 0;
    let maxDepth = 0;
    for (let i = 0; i < n; i++) {
      applyInputs(adapter, run.inputs, i * h, h);
      const t0 = now();
      adapter.step(h);
      const dt = now() - t0;
      if (opts.coarseTimer) {
        batch += dt;
        if (++batchN === 10) {
          times.push(batch / 10);
          batch = 0;
          batchN = 0;
        }
      } else times.push(dt);
      const s = adapter.snapshot();
      const depth = adapter.contactsDepthMax();
      maxDepth = Math.max(maxDepth, depth);
      const t = (i + 1) * h;
      for (const e of evals) e.step(t, s, depth);
      if ((i + 1) % 60 === 0 || i === n - 1) hash.addSnapshot(s, ids);
    }
    const sorted = times.slice().sort((a, b) => a - b);
    runs.push({
      name: run.name,
      assertions: run.assertions.map((a, k) => {
        const r = evals[k]!.result();
        return {
          label: a.label,
          run: run.name,
          ...r,
          ...(a.expectedFailure ? { expectedFailure: a.expectedFailure } : {}),
        };
      }),
      steps: n,
      stepMedian: quantile(sorted, 0.5),
      stepP95: quantile(sorted, 0.95),
      maxDepth,
      warnings: report.warnings,
    });
    await opts.yieldEvery?.();
  }
  adapter.dispose();
  return {
    id: script.id,
    runs,
    hash: hash.digest(),
    pass: runs.every((r) => r.assertions.every((a) => a.pass || !!a.expectedFailure)),
  };
}
