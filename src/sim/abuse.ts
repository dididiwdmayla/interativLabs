import { FIXED_STEP } from "@/engine/common";
import { buildPlan } from "@/engine/plan";
import { springStroke } from "@/engine/runtime";
import type { EngineAdapter, EngineProbe, Snapshot } from "@/engine/types";
import { PI, dcos, dhypot, dsin } from "@/geometry/dmath";
import type { Vec2 } from "@/geometry/vec";
import { shapeOutline } from "@/geometry/outline";
import type { Id, Scene } from "@/model/types";
import { Pacer, SPEED_MODES } from "./pacing";

/**
 * Teste de abuso (Fase 1 · Parte F, item 14.4): o dedo maltrata cada peça
 * móvel de uma cena, nas três velocidades, como a pessoa faria no celular,
 * e cada passo confere os invariantes da física.
 *
 * Manobras (em tempo de tela, quadros de 60 Hz, o tempo simulado anda pela
 * velocidade, como no app):
 * - "fora": arrasto rápido até 3 vezes o tamanho da cena para fora e volta
 *   (0,5 s indo, 0,5 s voltando), solta;
 * - "sacudida": círculo de 8 Hz com raio de ¼ da cena por 1 s, solta;
 * - "soltura": arrasto rápido para fora, solto no meio do movimento.
 * Depois de soltar, 2 s simulados parados.
 */

export type Maneuver = "out" | "shake" | "release";
export const MANEUVERS: { id: Maneuver; name: string }[] = [
  { id: "out", name: "fora e volta" },
  { id: "shake", name: "sacudida 8 Hz" },
  { id: "release", name: "soltura no meio" },
];

export type InvariantId =
  "joint" | "cable" | "mount" | "pinHole" | "penetration" | "speed" | "energy" | "nan";

export const INVARIANTS: { id: InvariantId; label: string; unit: string }[] = [
  { id: "joint", label: "eixo, haste, trilho, rasgo em junta e solda rígida abrem ≤ 0,5 mm", unit: "mm" },
  { id: "cable", label: "cabo ≤ comprimento + 0,5 mm", unit: "mm" },
  { id: "mount", label: "suporte elástico ≤ 5 × deflexão estática + 2 mm", unit: "mm" },
  { id: "pinHole", label: "pino em rasgo por contato não sai do furo", unit: "mm" },
  { id: "penetration", label: "penetração entre peças < 0,3 mm", unit: "mm" },
  { id: "speed", label: "velocidade ≤ 2 000 mm/s (fora de gás e bala; peças dentro da cena)", unit: "mm/s" },
  { id: "energy", label: "energia sem fonte não cresce mais de 2% em 1 s", unit: "%" },
  { id: "nan", label: "sem NaN", unit: "" },
];

export const LIMITS = {
  joint: 0.5,
  cable: 0.5,
  penetration: 0.3,
  speed: 2000,
  energy: 2,
};

export interface InvariantResult {
  /** pior valor medido (para "mount", a razão entre o medido e o limite da ligação; para "pinHole", quanto o centro passou da parede, mm) */
  worst: number;
  /** limite (no "mount", 1) */
  limit: number;
  pass: boolean;
  /** não se aplica à cena (sem a ligação, ou cena de gás/bala) */
  na: boolean;
  /** onde foi o pior: peça, velocidade, manobra, instante */
  where: string;
}

export interface SceneAbuse {
  id: string;
  /** peças abusadas e se foi uma amostra */
  parts: number;
  sampled: boolean;
  results: Record<InvariantId, InvariantResult>;
  /**
   * Penetração que dura dois passos seguidos (a do invariante inclui a
   * sobreposição de um passo só, no impacto rápido entre peças móveis), mm.
   */
  lasting: { worst: number; where: string };
  runs: number;
  steps: number;
}

export interface AbuseOptions {
  /** velocidades (padrão: as três) */
  speeds?: number[];
  maneuvers?: Maneuver[];
  /** no máximo tantas peças (as mais pesadas primeiro); padrão: todas */
  maxParts?: number;
  /**
   * cenas com mais peças móveis que isto usam uma amostra desse tamanho,
   * espalhada da mais pesada à mais leve (pilha de 200 caixas, cena de 150
   * peças, corrente de 40 elos)
   */
  sample?: number;
  /** s simulados parados depois de soltar (padrão 2) */
  rest?: number;
  /** a cena tem gás ou bala: velocidade não se aplica */
  fastScene?: boolean;
  /** só estas peças (ids ou nomes) */
  only?: string[];
  /** a cada passo (depuração) */
  trace?: (t: number, s: Snapshot, probe: EngineProbe | undefined, depth: number, held: boolean) => void;
}

const H = FIXED_STEP;
const FRAME = 1 / 60;

interface Ctx {
  scene: Scene;
  rodLength: Map<Id, number>;
  cables: Map<Id, number>;
  mounts: Map<Id, { limit: number; rigid: boolean }>;
  pins: Map<Id, number>;
  hasSource: boolean;
  /** energia de mover 0,05 mm contra o peso de todas as peças móveis e contra as molas (piso de ruído), mJ */
  floor: number;
}

/**
 * Caixa da cena desenhada, o centro e o tamanho. `region` é a caixa com
 * meio tamanho de margem: uma peça solta arrastada para fora e largada cai
 * para sempre (não há chão fora da cena); a velocidade dela é a da queda
 * livre e não conta.
 */
function sceneSize(scene: Scene): { center: Vec2; size: number; region: [number, number, number, number] } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of scene.parts) {
    const o = shapeOutline(p.shape);
    if (!o.ok) continue;
    const c = dcos(p.angle);
    const s = dsin(p.angle);
    for (const poly of o.value.outline)
      for (const q of poly.outer) {
        const x = p.x + q[0] * c - q[1] * s;
        const y = p.y + q[0] * s + q[1] * c;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  }
  if (!Number.isFinite(x0)) return { center: [0, 0], size: 100, region: [-100, -100, 100, 100] };
  const size = Math.max(x1 - x0, y1 - y0);
  const m = size / 2;
  return {
    center: [(x0 + x1) / 2, (y0 + y1) / 2],
    size,
    region: [x0 - m, y0 - m, x1 + m, y1 + m],
  };
}

/** Uma peça por corpo móvel (a primeira do corpo), as mais pesadas primeiro. */
export function movableParts(scene: Scene): Id[] {
  const plan = buildPlan(scene);
  const out: { id: Id; mass: number }[] = [];
  for (const b of plan.bodies) {
    if (b.static || b.index === 0 || !b.parts.length) continue;
    out.push({ id: b.parts[0]!, mass: b.mass });
  }
  return out.sort((a, b) => b.mass - a.mass || a.id.localeCompare(b.id)).map((x) => x.id);
}

/** Onde está o dedo (mundo) no instante de tela τ da manobra; null depois de soltar. */
function fingerAt(m: Maneuver, tau: number, p0: Vec2, u: Vec2, D: number, A: number): Vec2 | null {
  if (m === "out") {
    if (tau >= 1) return null;
    const k = tau < 0.5 ? tau / 0.5 : (1 - tau) / 0.5;
    return [p0[0] + u[0] * D * k, p0[1] + u[1] * D * k];
  }
  if (m === "shake") {
    if (tau >= 1) return null;
    const w = 2 * PI * 8 * tau;
    return [p0[0] + A * dsin(w), p0[1] + A * (dcos(w) - 1)];
  }
  if (tau >= 0.15) return null;
  const k = tau / 0.3;
  return [p0[0] + u[0] * D * k, p0[1] + u[1] * D * k];
}

function prepare(scene: Scene, initial: Snapshot, staticOffsets: Map<Id, number>): Ctx {
  const rodLength = new Map<Id, number>();
  const cables = new Map<Id, number>();
  const mounts = new Map<Id, { limit: number; rigid: boolean }>();
  const pins = new Map<Id, number>();
  const pinR = new Map(scene.links.flatMap((l) => (l.kind === "pin" ? [[l.id, l.r] as const] : [])));
  for (const l of scene.links) {
    if (l.kind === "rod") rodLength.set(l.id, initial.links[l.id]?.length ?? 0);
    else if (l.kind === "cable") cables.set(l.id, l.maxLength);
    else if (l.kind === "mount") {
      const rigid = l.linearHz <= 0;
      mounts.set(l.id, { limit: rigid ? LIMITS.joint : 5 * (staticOffsets.get(l.id) ?? 0) + 2, rigid });
    } else if (l.kind === "slot" && l.mode === "contact") pins.set(l.id, pinR.get(l.pin) ?? 0);
  }
  const plan = buildPlan(scene);
  let mass = 0;
  for (const b of plan.bodies) if (!b.static && b.index > 0) mass += b.mass;
  const g = dhypot(plan.gravity[0], plan.gravity[1]);
  const hasSource = scene.links.some(
    (l) => l.kind === "chamber" || (l.kind === "axle" && l.motor !== undefined),
  );
  // piso de ruído: 0,05 mm de movimento contra o peso de tudo e contra as molas
  const springs = springStroke(plan, null).reduce((x, y) => x + y, 0);
  return { scene, rodLength, cables, mounts, pins, hasSource, floor: (mass * g + springs) * 0.05 * 1e-6 };
}

/** Deflexão estática de cada suporte elástico: 2 s sem entrada, média dos últimos 0,5 s. */
function staticMounts(make: () => EngineAdapter, scene: Scene): Map<Id, number> {
  const ids = scene.links.filter((l) => l.kind === "mount").map((l) => l.id);
  const out = new Map<Id, number>();
  if (!ids.length) return out;
  const a = make();
  a.compile(scene, { unitMm: 1 });
  const sums = new Map<Id, number>(ids.map((id) => [id, 0]));
  const n = Math.round(2 / H);
  const from = Math.round(1.5 / H);
  for (let i = 0; i < n; i++) {
    a.step(H);
    if (i < from) continue;
    const s = a.snapshot();
    for (const id of ids) sums.set(id, sums.get(id)! + (s.links[id]?.offset ?? 0));
  }
  a.dispose();
  for (const id of ids) out.set(id, sums.get(id)! / (n - from));
  return out;
}

interface Worst {
  v: number;
  where: string;
}

/** Uma manobra numa peça, numa velocidade: o pior de cada invariante. */
function runCase(
  make: () => EngineAdapter,
  ctx: Ctx,
  part: Id,
  speed: number,
  m: Maneuver,
  opts: Required<Pick<AbuseOptions, "rest">> & Pick<AbuseOptions, "trace">,
  geo: { center: Vec2; size: number; region: [number, number, number, number] },
  worst: Record<InvariantId, Worst>,
  worstLasting: Worst,
): number {
  const a = make();
  a.compile(ctx.scene, { unitMm: 1 });
  const name = ctx.scene.parts.find((p) => p.id === part)?.name ?? part;
  const sp = SPEED_MODES.find((x) => x.factor === speed)?.name ?? `${speed}`;
  const partName = (id: Id) => ctx.scene.parts.find((p) => p.id === id)?.name ?? id;
  let extra = "";
  const tag = (t: number) =>
    `${name} · ${sp} · ${MANEUVERS.find((x) => x.id === m)?.name} · t = ${t.toFixed(3)} s${extra}`;
  const bump = (k: InvariantId, v: number, t: number) => {
    if (v > worst[k].v || (Number.isNaN(v) && !Number.isNaN(worst[k].v))) worst[k] = { v, where: tag(t) };
  };
  let steps = 0;
  let t = 0;
  let holding = false;
  let prevDepth = 0;
  const step = () => {
    a.step(H);
    steps++;
    t += H;
    const s = a.snapshot();
    const pr: EngineProbe | undefined = a.probe?.(geo.region);
    let joint = 0;
    for (const [id, st] of Object.entries(s.links)) {
      if (st.kind === "axle" || (st.kind === "lock" && !st.released)) joint = Math.max(joint, st.gap ?? 0);
      else if (st.kind === "slot" && st.deviation !== undefined)
        joint = Math.max(joint, Math.abs(st.deviation));
      else if (st.kind === "rod")
        joint = Math.max(joint, Math.abs((st.length ?? 0) - (ctx.rodLength.get(id) ?? 0)));
      else if (st.kind === "cable") bump("cable", (st.length ?? 0) - (ctx.cables.get(id) ?? Infinity), t);
      else if (st.kind === "mount") {
        const mm = ctx.mounts.get(id);
        if (mm?.rigid) joint = Math.max(joint, st.offset ?? 0);
        else if (mm) bump("mount", (st.offset ?? 0) / mm.limit, t);
      } else if (st.kind === "slot" && st.clearance !== undefined) {
        // o centro do pino passa da parede quando a folga fica abaixo de −r
        bump("pinHole", -(st.clearance + (ctx.pins.get(id) ?? 0)), t);
      }
    }
    if (pr) joint = Math.max(joint, pr.railGap, pr.railOver);
    bump("joint", joint, t);
    const depth = a.contactsDepthMax();
    if (depth > worst.penetration.v || depth > worstLasting.v) {
      const d = a.contactsDeepest?.();
      extra = d ? ` · entre ${partName(d.a)} e ${partName(d.b)}` : "";
    }
    bump("penetration", depth, t);
    const lasting = Math.min(depth, prevDepth);
    if (lasting > worstLasting.v) {
      worstLasting.v = lasting;
      worstLasting.where = tag(t);
    }
    prevDepth = depth;
    extra = "";
    opts.trace?.(t, s, pr, depth, holding);
    if (pr) {
      bump("speed", pr.maxSpeed, t);
      if (pr.nan) bump("nan", 1, t);
    }
    for (const p of Object.values(s.parts)) if (!Number.isFinite(p.x + p.y + p.angle)) bump("nan", 1, t);
    return pr ? { e: pr.kinetic + pr.potential, pe: pr.potential } : { e: NaN, pe: NaN };
  };

  // acomoda 0,2 s antes do dedo
  for (let i = 0; i < Math.round(0.2 / H); i++) step();
  const pose = a.pose(part);
  if (!pose) {
    a.dispose();
    return steps;
  }
  const p0: Vec2 = [pose.x, pose.y];
  let u: Vec2 = [p0[0] - geo.center[0], p0[1] - geo.center[1]];
  const ul = dhypot(u[0], u[1]);
  u = ul > 1e-6 ? [u[0] / ul, u[1] / ul] : [1, 0];
  const D = 3 * geo.size;
  const A = 0.25 * geo.size;
  const pacer = new Pacer(H, { lookahead: 0 });
  holding = a.dragStart(part, p0);
  let frame = 0;
  while (holding) {
    const tau = frame * FRAME;
    const f = fingerAt(m, tau, p0, u, D, A);
    if (!f) {
      a.dragEnd();
      holding = false;
      break;
    }
    a.dragMove(f);
    pacer.advance(FRAME, speed);
    const n = pacer.take();
    for (let i = 0; i < n; i++) step();
    frame++;
  }
  // parado: energia sem fonte, janela de 1 s
  const series: { t: number; e: number }[] = [];
  // referência: a menor energia potencial vista parado (o fundo do balanço);
  // o crescimento é relativo à energia acima dela
  let ground = Infinity;
  for (let i = 0; i < Math.round(opts.rest / H); i++) {
    const { e, pe } = step();
    series.push({ t, e });
    ground = Math.min(ground, pe);
  }
  a.dispose();
  if (!ctx.hasSource && series.length) {
    // mínimo da janela de 1 s antes de cada instante (fila monotônica)
    const q: number[] = [];
    let head = 0;
    for (let i = 0; i < series.length; i++) {
      const cur = series[i]!;
      while (q.length > head && series[q[q.length - 1]!]!.e >= cur.e) q.pop();
      q.push(i);
      while (series[q[head]!]!.t < cur.t - 1 - 1e-9) head++;
      const lo = series[q[head]!]!.e;
      const growth = ((cur.e - lo) / (lo - ground + ctx.floor)) * 100;
      bump("energy", growth, cur.t);
    }
  }
  return steps;
}

/** Abuso de uma cena: todas as peças móveis, velocidades e manobras pedidas. */
export function abuseScene(
  make: () => EngineAdapter,
  id: string,
  scene: Scene,
  opts: AbuseOptions = {},
): SceneAbuse {
  const speeds = opts.speeds ?? SPEED_MODES.map((s) => s.factor);
  const maneuvers = opts.maneuvers ?? MANEUVERS.map((m) => m.id);
  const names = new Map(scene.parts.map((p) => [p.id, p.name] as const));
  let parts = movableParts(scene)
    .filter((id) => !opts.only || opts.only.includes(id) || opts.only.includes(names.get(id) ?? ""))
    .slice(0, opts.maxParts ?? Infinity);
  const sampled = opts.sample !== undefined && parts.length > opts.sample;
  if (sampled) {
    const all = parts;
    const k = opts.sample!;
    parts = Array.from({ length: k }, (_, i) => all[Math.round((i * (all.length - 1)) / (k - 1))]!);
  }
  const a0 = make();
  a0.compile(scene, { unitMm: 1 });
  const initial = a0.snapshot();
  a0.dispose();
  const ctx = prepare(scene, initial, staticMounts(make, scene));
  const geo = sceneSize(scene);
  const worst = Object.fromEntries(INVARIANTS.map((i) => [i.id, { v: 0, where: "" }])) as Record<
    InvariantId,
    Worst
  >;
  const lasting: Worst = { v: 0, where: "" };
  let runs = 0;
  let steps = 0;
  for (const part of parts)
    for (const speed of speeds)
      for (const m of maneuvers) {
        steps += runCase(
          make,
          ctx,
          part,
          speed,
          m,
          { rest: opts.rest ?? 2, trace: opts.trace },
          geo,
          worst,
          lasting,
        );
        runs++;
      }
  const has = {
    joint: scene.links.some(
      (l) =>
        l.kind === "axle" ||
        l.kind === "lock" ||
        l.kind === "rod" ||
        l.kind === "slider" ||
        (l.kind === "slot" && l.mode === "joint") ||
        (l.kind === "mount" && l.linearHz <= 0),
    ),
    cable: ctx.cables.size > 0,
    mount: [...ctx.mounts.values()].some((m) => !m.rigid),
    pinHole: ctx.pins.size > 0,
  };
  const res = (k: InvariantId, limit: number, na: boolean): InvariantResult => {
    const w = worst[k];
    return { worst: w.v, limit, pass: na || (Number.isFinite(w.v) && w.v <= limit), na, where: w.where };
  };
  return {
    id,
    runs,
    steps,
    parts: parts.length,
    sampled,
    lasting: { worst: lasting.v, where: lasting.where },
    results: {
      joint: res("joint", LIMITS.joint, !has.joint),
      cable: res("cable", LIMITS.cable, !has.cable),
      mount: res("mount", 1, !has.mount),
      pinHole: res("pinHole", 0, !has.pinHole),
      penetration: {
        ...res("penetration", LIMITS.penetration, false),
        pass: worst.penetration.v < LIMITS.penetration,
      },
      speed: res("speed", LIMITS.speed, !!opts.fastScene),
      energy: res("energy", LIMITS.energy, ctx.hasSource),
      nan: res("nan", 0, false),
    },
  };
}

/** Cenas com gás ou bala: a velocidade acima de 2 m/s é delas. */
export function isFastScene(id: string, scene: Scene): boolean {
  return id.includes("bala") || scene.links.some((l) => l.kind === "chamber");
}
