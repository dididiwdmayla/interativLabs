import type { Id } from "@/model/types";
import type { Vec2 } from "@/geometry/vec";
import { ChamberSim, exchange, type ChamberGeometry, type PlanChamber } from "./chamber";
import type { Plan, PlanBody, PlanSensor, PlanSpring } from "./plan";
import { N } from "@/model/units";
import type { EngineEvent, EngineProbe, LinkState, PartPose, Snapshot } from "./types";
import { PI, dcos, dhypot, dsin } from "@/geometry/dmath";

/**
 * Parte comum da simulação, igual em todos os motores e em unidades da cena
 * (mm, g, s, rad): mola de torção, mola de retorno do trilho, mola entre
 * pontos, câmara de pressão, sensor e arrasto. O adaptador só lê e escreve
 * nos corpos por `BodyIO`, convertendo a escala.
 */

export interface BodyState {
  /** centro de massa (= origem do corpo), mm */
  x: number;
  y: number;
  angle: number;
  /** mm/s */
  vx: number;
  vy: number;
  /** rad/s */
  w: number;
}

export interface RuntimeOptions {
  /** ligações que o motor resolve sozinho (mola de torção e do trilho nativas): o runtime não aplica força */
  native?: Set<Id>;
  /** força de reação de uma junta nativa, g·mm/s² no mundo (quando o motor sabe) */
  jointForce?: (linkId: Id) => Vec2 | null;
  /** torque do motor (ou do atrito) de um eixo, g·mm²/s² */
  jointTorque?: (linkId: Id) => number | null;
  /**
   * Força do gás resolvida pelo motor: a cada passo, rigidez (g/s²) e força
   * atual (g·mm/s², para fora) da câmara de índice `chamber`, com a geometria.
   */
  gasSpring?: (chamber: number, stiffness: number, force: number, g: ChamberGeometry) => boolean;
}

export interface BodyIO {
  read(body: number, out: BodyState): void;
  /** força no ponto (mundo, mm), g·mm/s² */
  applyForce(body: number, fx: number, fy: number, px: number, py: number): void;
  /** g·mm²/s² */
  applyTorque(body: number, t: number): void;
  /** g·mm/s, no ponto (mundo, mm) */
  applyImpulse(body: number, jx: number, jy: number, px: number, py: number): void;
}

/**
 * Arrasto de reserva (bancada: Planck e Rapier): mola amortecida resolvida
 * como restrição suave (como a junta de mouse), com os 6 Hz e a força
 * máxima de (600·m + 400) g·(10 mm)/s² do protótipo, escalados pela
 * gravidade. O motor do app usa a mão (`handLimits`, abaixo).
 */
const DRAG_HZ = 6;
const DRAG_HZ_MAX = 30;
const DRAG_DAMPING = 0.9;
const DRAG_G_REF = 100;
const DRAG_FORCE_PER_GRAM = 6000;
const DRAG_FORCE_BASE = 4000;

interface SensorState {
  p: PlanSensor;
  count: number;
}

/** Distância com sinal de p ao contorno (positiva dentro). Só operações exatas. */
export function ringSignedDistance(ring: Vec2[], p: Vec2): number {
  let inside = false;
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j]!;
    const b = ring[i]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const l2 = ex * ex + ey * ey;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / l2)) : 0;
    const qx = a[0] + t * ex - p[0];
    const qy = a[1] + t * ey - p[1];
    best = Math.min(best, qx * qx + qy * qy);
  }
  const d = Math.sqrt(best);
  return inside ? d : -d;
}

/**
 * Mola do arrasto de reserva (bancada): frequência e força máxima, escaladas
 * pela gravidade da cena a partir das do protótipo (6 Hz e
 * (600·m + 400) g·(10 mm)/s² com 100 mm/s²).
 */
export function dragParams(mass: number, gravity: Vec2): { hertz: number; maxForce: number } {
  const gs = Math.max(1, dhypot(gravity[0], gravity[1]) / DRAG_G_REF);
  return {
    hertz: Math.min(DRAG_HZ_MAX, DRAG_HZ * Math.sqrt(gs)),
    maxForce: (DRAG_FORCE_PER_GRAM * mass + DRAG_FORCE_BASE) * gs,
  };
}

/**
 * A mão (Fase 1 · Parte F, item 14.3): o arrasto do app é uma ação física,
 * não uma força ilimitada. Ver docs/arquitetura.md §4, "Arrasto".
 *
 * - A peça é puxada por uma mola (com amortecimento crítico) até um alvo
 *   que persegue o dedo a no máximo `speed` mm/s de tempo simulado; em
 *   Lento o dedo andando 100 mm/s na tela não vira 2 000 mm/s. Quando o
 *   dedo para, o alvo para.
 * - A força da mola é limitada: `weight` vezes o peso da peça (gravidade de
 *   pelo menos 9 810 mm/s², para que a mão funcione igual sem gravidade),
 *   entre `minForce` e `maxForce`, mais a força de mola no fim do curso
 *   normal (a soma das molas da peça, ou a mola mais forte ao alcance dela,
 *   `reach`, o que for maior: puxar o ferrolho contra a mola de retorno,
 *   puxar o gatilho que, pela barra, empurra o retém contra a mola dele).
 *   Nunca mais que o que
 *   abre uma junta da peça `jointSink` mm, nem o que deforma um suporte
 *   elástico além da faixa dele.
 * - Ao soltar, o ponto agarrado fica com no máximo `release` mm/s.
 * - Atravessar: o alvo anda no máximo 2,5 mm por passo; contra peças fixas
 *   vale a colisão contínua do Box2D.
 */
export const HAND = {
  /**
   * mola da mão: rígida o bastante para chegar à força máxima com a peça
   * `reach` mm atrás do alvo, entre `hertzMin` e `hertzMax` Hz (as juntas
   * ficam em 960 Hz)
   */
  reach: 4,
  hertzMin: 30,
  hertzMax: 120,
  /** força máxima pelo peso: vezes m·g */
  weight: 10,
  /** piso e teto da parte do peso, g·mm/s² (0,02 N e 5 N) */
  minForce: 0.02 * N,
  maxForce: 5 * N,
  /** velocidade máxima do alvo, mm/s de tempo simulado */
  speed: 600,
  /** velocidade máxima do ponto agarrado ao soltar, mm/s */
  release: 750,
  /** suporte elástico: a mão leva o ponto até `mountRange` vezes a deflexão pelo peso + `mountMargin` mm… */
  mountRange: 4,
  mountMargin: 1.5,
  /** …contando a sobrelevação da resposta (ζ ≈ 0,2 dá ~1,5) */
  mountOvershoot: 1.6,
  /** gravidade mínima da conta do peso, mm/s² */
  gMin: 9810,
  /** abertura máxima que a força da mão causa numa junta da peça (rígida, 960 Hz), mm */
  jointSink: 0.25,
};

export interface HandLimits {
  hertz: number;
  /** força máxima, g·mm/s² */
  maxForce: number;
  /** parcelas, para documentação e testes */
  weight: number;
  springs: number;
  /** teto pelos suportes elásticos (Infinity sem suporte) */
  mountCap: number;
  /** teto pelas juntas da peça (Infinity sem junta) */
  jointCap: number;
}

/** Massa efetiva inversa (matriz K = M⁻¹ no ponto) de um ou dois corpos, como nas juntas do Box2D. */
function pointK(bodies: { body: PlanBody; r: Vec2 }[]): { k11: number; k12: number; k22: number } {
  let k11 = 0;
  let k12 = 0;
  let k22 = 0;
  for (const { body, r } of bodies) {
    if (body.static || !(body.mass > 0)) continue;
    k11 += 1 / body.mass + (r[1] * r[1]) / body.inertia;
    k12 -= (r[0] * r[1]) / body.inertia;
    k22 += 1 / body.mass + (r[0] * r[0]) / body.inertia;
  }
  return { k11, k12, k22 };
}

/** Limites da mão para o corpo `body`, na pose desenhada. */
/**
 * Força de cada mola no fim do curso normal, g·mm/s²: as do corpo (número),
 * as de um conjunto de corpos, ou todas (null).
 */
export function springStroke(plan: Plan, body: number | null | Set<number>): number[] {
  const out: number[] = [];
  const mine = (a: number, b: number) =>
    body === null || (typeof body === "number" ? a === body || b === body : body.has(a) || body.has(b));
  for (const s of plan.springs) {
    if (!mine(s.a, s.b)) continue;
    const stroke = s.mode === "tension" ? s.freeLength : s.freeLength - s.solidLength;
    out.push(s.k * Math.max(0, stroke));
  }
  for (const s of plan.sliders) {
    if (!s.spring || !mine(s.a, s.b)) continue;
    out.push(s.spring.k * Math.max(Math.abs(s.lower - s.spring.rest), Math.abs(s.upper - s.spring.rest)));
  }
  for (const a of plan.axles) {
    if (!a.torsion || !mine(a.a, a.b)) continue;
    const range = a.limit
      ? Math.max(Math.abs(a.limit.lower - a.torsion.rest), Math.abs(a.limit.upper - a.torsion.rest))
      : PI / 2;
    // braço: do eixo ao centro da peça que gira (no mínimo 5 mm)
    const bd = plan.bodies[a.b]!;
    const arm = Math.max(5, dhypot(bd.position[0] - a.anchor[0], bd.position[1] - a.anchor[1]));
    out.push((a.torsion.k * range) / arm);
  }
  return out;
}

/** Caixa de cada forma no mundo, na pose desenhada (o corpo começa com ângulo 0). */
function fixtureBoxes(plan: Plan): { body: number; bits: number; box: [number, number, number, number] }[] {
  const out: { body: number; bits: number; box: [number, number, number, number] }[] = [];
  for (const b of plan.bodies) {
    if (b.index === 0) continue;
    for (const f of b.fixtures) {
      if (f.sensor) continue;
      const pts: Vec2[] =
        f.piece.kind === "circle"
          ? [
              [f.piece.c[0] - f.piece.r, f.piece.c[1] - f.piece.r],
              [f.piece.c[0] + f.piece.r, f.piece.c[1] + f.piece.r],
            ]
          : f.piece.points;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const q of pts) {
        x0 = Math.min(x0, q[0]);
        y0 = Math.min(y0, q[1]);
        x1 = Math.max(x1, q[0]);
        y1 = Math.max(y1, q[1]);
      }
      const [px, py] = b.position;
      out.push({ body: b.index, bits: f.bits, box: [x0 + px, y0 + py, x1 + px, y1 + py] });
    }
  }
  return out;
}

/**
 * Corpos ao alcance da peça: até `depth` passos por ligação (eixo, trilho,
 * haste, cabo, mola, rasgo, suporte) ou por contato possível (camada em
 * comum e formas a menos de `gap` mm na pose desenhada), sem atravessar as
 * peças fixas. O gatilho alcança a barra, e a barra, pelo pino entre
 * camadas, o retém.
 */
export function reach(plan: Plan, body: number, depth = 2, gap = 2): Set<number> {
  const boxes = fixtureBoxes(plan);
  const near = new Map<number, Set<number>>();
  const add = (a: number, b: number) => {
    if (a === b) return;
    if (!near.has(a)) near.set(a, new Set());
    if (!near.has(b)) near.set(b, new Set());
    near.get(a)!.add(b);
    near.get(b)!.add(a);
  };
  for (const l of [
    ...plan.axles,
    ...plan.sliders,
    ...plan.distances,
    ...plan.mounts,
    ...plan.slots,
    ...plan.springs,
  ])
    add(l.a, l.b);
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const p = boxes[i]!;
      const q = boxes[j]!;
      if (p.body === q.body || !(p.bits & q.bits)) continue;
      if (p.box[0] - gap > q.box[2] || q.box[0] - gap > p.box[2]) continue;
      if (p.box[1] - gap > q.box[3] || q.box[1] - gap > p.box[3]) continue;
      add(p.body, q.body);
    }
  const out = new Set([body]);
  let front = [body];
  for (let d = 0; d < depth; d++) {
    const next: number[] = [];
    for (const i of front)
      for (const j of near.get(i) ?? []) {
        if (out.has(j) || j === 0 || plan.bodies[j]!.static) continue;
        out.add(j);
        next.push(j);
      }
    front = next;
  }
  return out;
}

/** Maior autovalor de K (a direção mais macia) de uma junta entre os corpos a e b no ponto. */
function jointCompliance(plan: Plan, a: number, b: number, at: Vec2, hertz: number): number {
  const ends = [a, b].map((i) => {
    const bd = plan.bodies[i]!;
    return { body: bd, r: [at[0] - bd.position[0], at[1] - bd.position[1]] as Vec2 };
  });
  const { k11, k12, k22 } = pointK(ends);
  const tr = (k11 + k22) / 2;
  const lmax = tr + Math.sqrt(Math.max(0, ((k11 - k22) / 2) ** 2 + k12 * k12));
  const w = 2 * PI * hertz;
  return lmax / (w * w);
}

/**
 * Limites da mão para o corpo `body`, na pose desenhada (`jointHertz`: a
 * rigidez das juntas no motor).
 */
export function handLimits(plan: Plan, body: number, jointHertz = 960): HandLimits {
  const b = plan.bodies[body]!;
  const gReal = dhypot(plan.gravity[0], plan.gravity[1]);
  const g = Math.max(gReal, HAND.gMin);
  const weight = Math.min(HAND.maxForce, Math.max(HAND.minForce, HAND.weight * b.mass * g));
  // as molas da peça somadas, ou a mola mais forte ao alcance dela (puxar um
  // gatilho que, pela barra, empurra o retém contra a mola dele), o que for maior
  const own = springStroke(plan, body).reduce((x, y) => x + y, 0);
  const any = springStroke(plan, reach(plan, body)).reduce((x, y) => Math.max(x, y), 0);
  const springs = Math.max(own, any);
  let mountCap = Infinity;
  for (const m of plan.mounts) {
    if ((m.a !== body && m.b !== body) || !(m.linearHz > 0)) continue;
    const c = jointCompliance(plan, m.a, m.b, m.anchor, m.linearHz);
    if (!(c > 0)) continue;
    mountCap = Math.min(
      mountCap,
      (HAND.mountRange * b.mass * gReal + HAND.mountMargin / c) / HAND.mountOvershoot,
    );
  }
  // juntas da peça: a força da mão nunca abre uma delas mais que `jointSink`
  let jointCap = Infinity;
  const joint = (a: number, c: number, at: Vec2) => {
    if (a !== body && c !== body) return;
    const k = jointCompliance(plan, a, c, at, jointHertz);
    if (k > 0) jointCap = Math.min(jointCap, HAND.jointSink / k);
  };
  for (const a of plan.axles) joint(a.a, a.b, a.anchor);
  for (const s of plan.sliders) joint(s.a, s.b, s.anchor);
  for (const s of plan.slots) joint(s.a, s.b, s.anchor);
  for (const d of plan.distances) if (d.kind === "rod") joint(d.a, d.b, d.anchorB);
  for (const m of plan.mounts) if (!(m.linearHz > 0)) joint(m.a, m.b, m.anchor);
  const maxForce = Math.min(weight + springs, mountCap, jointCap);
  const w = Math.sqrt(maxForce / (HAND.reach * b.mass));
  return {
    hertz: Math.min(HAND.hertzMax, Math.max(HAND.hertzMin, w / (2 * PI))),
    maxForce,
    weight,
    springs,
    mountCap,
    jointCap,
  };
}

/** O alvo da mão anda até o dedo, no máximo `maxStep` mm por passo. */
export function chase(target: Vec2, finger: Vec2, maxStep: number): Vec2 {
  const dx = finger[0] - target[0];
  const dy = finger[1] - target[1];
  const d = dhypot(dx, dy);
  if (d <= maxStep) return [finger[0], finger[1]];
  return [target[0] + (dx * maxStep) / d, target[1] + (dy * maxStep) / d];
}

export class Runtime {
  readonly plan: Plan;
  private io: BodyIO;
  private st: BodyState[];
  private fresh: boolean[];
  private pre: BodyState[];
  private chambers: ChamberSim[];
  private chamberById = new Map<Id, ChamberSim>();
  private chamberGeo: ChamberGeometry[] = [];
  private gasSpring: RuntimeOptions["gasSpring"];
  private sensors = new Map<Id, SensorState>();
  private pending: { sensor: Id; part: Id; speed: number }[] = [];
  private events: EngineEvent[] = [];
  private drag: { body: number; local: Vec2; target: Vec2 } | null = null;
  private forces = new Map<number, { f: Vec2; local: Vec2 }>();
  private native: Set<Id>;
  private jointForce: (linkId: Id) => Vec2 | null;
  private jointTorque: (linkId: Id) => number | null;
  time = 0;
  steps = 0;

  constructor(plan: Plan, io: BodyIO, options: RuntimeOptions = {}) {
    this.plan = plan;
    this.io = io;
    this.native = options.native ?? new Set();
    this.jointForce = options.jointForce ?? (() => null);
    this.jointTorque = options.jointTorque ?? (() => null);
    this.st = plan.bodies.map((b) => ({ x: b.position[0], y: b.position[1], angle: 0, vx: 0, vy: 0, w: 0 }));
    this.fresh = plan.bodies.map(() => false);
    this.pre = this.st.map((b) => ({ ...b }));
    this.gasSpring = options.gasSpring;
    this.chambers = plan.chambers.map((p) => new ChamberSim(p));
    for (const c of this.chambers) this.chamberById.set(c.p.id, c);
    for (const s of plan.sensors) this.sensors.set(s.id, { p: s, count: 0 });
  }

  /** Estado do corpo (lido do motor uma vez por passo). Estáticos ficam na origem. */
  body(i: number): BodyState {
    const s = this.st[i]!;
    if (this.plan.bodies[i]!.static) return s;
    if (!this.fresh[i]) {
      this.io.read(i, s);
      this.fresh[i] = true;
    }
    return s;
  }

  /** Ponto do espaço do corpo → mundo. */
  world(i: number, p: Vec2): Vec2 {
    const s = this.body(i);
    const c = dcos(s.angle);
    const n = dsin(s.angle);
    return [s.x + p[0] * c - p[1] * n, s.y + p[0] * n + p[1] * c];
  }

  private pointVel(i: number, px: number, py: number): Vec2 {
    if (this.plan.bodies[i]!.static) return [0, 0];
    const s = this.body(i);
    return [s.vx - s.w * (py - s.y), s.vy + s.w * (px - s.x)];
  }

  private dyn(i: number): boolean {
    return i > 0 && !this.plan.bodies[i]!.static;
  }

  /** Forças customizadas, aplicadas antes de cada passo do motor. */
  beforeStep(h: number): void {
    this.fresh.fill(false);
    this.events = [];
    const io = this.io;
    // estado antes do passo (velocidade de aproximação dos sensores)
    if (this.plan.sensors.length)
      for (let i = 1; i < this.st.length; i++) if (this.dyn(i)) Object.assign(this.pre[i]!, this.body(i));
    for (const a of this.plan.axles) {
      if (!a.torsion || this.native.has(a.id)) continue;
      const A = this.body(a.a);
      const B = this.body(a.b);
      const tau = -a.torsion.k * (B.angle - A.angle - a.torsion.rest) - a.torsion.damping * (B.w - A.w);
      if (this.dyn(a.b)) io.applyTorque(a.b, tau);
      if (this.dyn(a.a)) io.applyTorque(a.a, -tau);
    }
    for (const s of this.plan.sliders) {
      if (!s.spring || this.native.has(s.id)) continue;
      const A = this.body(s.a);
      const B = this.body(s.b);
      const ca = dcos(A.angle);
      const sa = dsin(A.angle);
      const ux = s.axis[0] * ca - s.axis[1] * sa;
      const uy = s.axis[0] * sa + s.axis[1] * ca;
      const t = this.sliderTranslation(s.id);
      const pa = this.world(s.a, this.localOf(s.a, s.anchor));
      const pb = this.world(s.b, this.localOf(s.b, s.anchor));
      const va = this.pointVel(s.a, pa[0], pa[1]);
      const vb = this.pointVel(s.b, pb[0], pb[1]);
      const sp = (vb[0] - va[0]) * ux + (vb[1] - va[1]) * uy;
      const F = -s.spring.k * (t - s.spring.rest) - s.spring.damping * sp;
      if (this.dyn(s.b)) io.applyForce(s.b, ux * F, uy * F, B.x, B.y);
      if (this.dyn(s.a)) io.applyForce(s.a, -ux * F, -uy * F, A.x, A.y);
    }
    for (const s of this.plan.springs) {
      if (this.native.has(s.id)) continue;
      const f = this.springForce(s);
      if (f.F === 0) continue;
      if (this.dyn(s.a)) io.applyForce(s.a, f.ux * f.F, f.uy * f.F, f.pa[0], f.pa[1]);
      if (this.dyn(s.b)) io.applyForce(s.b, -f.ux * f.F, -f.uy * f.F, f.pb[0], f.pb[1]);
    }
    this.chambersStep(h);
    for (const [b, f] of this.forces) {
      const p = this.world(b, f.local);
      io.applyForce(b, f.f[0], f.f[1], p[0], p[1]);
    }
    this.dragImpulse(h);
  }

  /**
   * Força de Hooke com amortecimento, g·mm/s², positiva = tração (puxa B para A).
   * Sem guia, ao longo da reta entre as pontas; com guia, ao longo do eixo da
   * peça-guia (o comprimento é a projeção nesse eixo). Apoiada só empurra;
   * só tração só puxa. O batente das espiras encostadas é uma junta do motor.
   */
  springForce(s: PlanSpring): { F: number; L: number; ux: number; uy: number; pa: Vec2; pb: Vec2 } {
    const pa = this.world(s.a, s.localA);
    const pb = this.world(s.b, s.localB);
    const dx = pb[0] - pa[0];
    const dy = pb[1] - pa[1];
    let ux: number;
    let uy: number;
    let L: number;
    if (s.guide) {
      const g = this.body(s.guide.body);
      const c = dcos(g.angle);
      const n = dsin(g.angle);
      ux = s.guide.axis[0] * c - s.guide.axis[1] * n;
      uy = s.guide.axis[0] * n + s.guide.axis[1] * c;
      L = dx * ux + dy * uy;
    } else {
      L = dhypot(dx, dy);
      if (L < 1e-9) return { F: 0, L, ux: 1, uy: 0, pa, pb };
      ux = dx / L;
      uy = dy / L;
    }
    const va = this.pointVel(s.a, pa[0], pa[1]);
    const vb = this.pointVel(s.b, pb[0], pb[1]);
    const vr = (vb[0] - va[0]) * ux + (vb[1] - va[1]) * uy;
    let F = s.k * (L - s.freeLength) + s.damping * vr;
    // Apoiada: só age encostada (abaixo do comprimento livre) e só empurra.
    // Só tração: só age esticada e só puxa. O amortecimento não cola a ponta solta.
    if (s.mode === "seated") F = L < s.freeLength ? Math.min(F, 0) : 0;
    else if (s.mode === "tension") F = L > s.freeLength ? Math.max(F, 0) : 0;
    return { F, L, ux, uy, pa, pb };
  }

  /** Força externa constante (roteiros de teste), N no mundo, no ponto local da peça. */
  setForce(partId: Id, force: Vec2 | null, at: Vec2 = [0, 0]): void {
    const r = this.plan.partRel.get(partId);
    if (!r || !this.dyn(r.body)) return;
    if (!force) {
      this.forces.delete(r.body);
      return;
    }
    const c = dcos(r.angle);
    const s = dsin(r.angle);
    const local: Vec2 = [r.x + at[0] * c - at[1] * s, r.y + at[0] * s + at[1] * c];
    this.forces.set(r.body, { f: [force[0] * N, force[1] * N], local });
  }

  /** Geometria da câmara lida dos corpos: fundo, eixo e posição de cada face. */
  private chamberGeometry(p: PlanChamber): ChamberGeometry {
    const base = this.world(p.body, p.base);
    const A = this.body(p.body);
    const c = dcos(A.angle);
    const n = dsin(A.angle);
    const axis: Vec2 = [p.axis[0] * c - p.axis[1] * n, p.axis[0] * n + p.axis[1] * c];
    const faces = p.walls.map((w) => this.world(w.body, w.face));
    const s = faces.map((f) => (f[0] - base[0]) * axis[0] + (f[1] - base[1]) * axis[1]);
    const lat = faces.map((f) => Math.abs((f[0] - base[0]) * axis[1] - (f[1] - base[1]) * axis[0]));
    return { base, axis, s, faces, lat };
  }

  /** Gás de todas as câmaras: volume, queima, escape, portas e forças. */
  private chambersStep(h: number): void {
    if (!this.chambers.length) return;
    this.chamberGeo = this.chambers.map((ch) => this.chamberGeometry(ch.p));
    this.chambers.forEach((ch, i) => ch.update(this.chamberGeo[i]!, h, this.time, this.events));
    this.chambers.forEach((ch, i) => {
      ch.ports(this.chamberGeo[i]!, this.time, this.events);
      ch.p.ports.forEach((pt, k) => {
        const other = this.chambers[pt.to];
        if (other) exchange(ch, other, ch.portExposed[k]! * pt.area, h);
      });
    });
    this.chambers.forEach((ch, ci) => {
      const g = this.chamberGeo[ci]!;
      const F = ch.gasForce();
      // O motor pode resolver a força do gás como mola linearizada dentro do solver.
      if (this.gasSpring?.(ci, ch.stiffness(h), F, g)) return;
      let rx = 0;
      let ry = 0;
      ch.p.walls.forEach((w, i) => {
        const fx = w.side * F * g.axis[0];
        const fy = w.side * F * g.axis[1];
        if (this.dyn(w.body)) this.io.applyForce(w.body, fx, fy, g.faces[i]![0], g.faces[i]![1]);
        rx -= fx;
        ry -= fy;
        ch.record(i, F, h);
      });
      if (this.dyn(ch.p.body) && (rx !== 0 || ry !== 0))
        this.io.applyForce(ch.p.body, rx, ry, g.base[0], g.base[1]);
    });
  }

  /** Força do gás que o motor aplicou no passo (mola nativa), g·mm/s² para fora. */
  recordGasForce(chamber: number, force: number, h: number): void {
    const ch = this.chambers[chamber];
    if (!ch) return;
    ch.p.walls.forEach((_, i) => ch.record(i, force, h));
  }

  /** Massa efetiva inversa ao longo do eixo entre dois pontos de dois corpos, 1/g. */
  invMassAlong(a: number, pa: Vec2, b: number, pb: Vec2, u: Vec2): number {
    let K = 0;
    for (const [i, p] of [
      [a, pa],
      [b, pb],
    ] as const) {
      if (!this.dyn(i)) continue;
      const s = this.body(i);
      const bd = this.plan.bodies[i]!;
      const c = (p[0] - s.x) * u[1] - (p[1] - s.y) * u[0];
      K += 1 / bd.mass + (c * c) / bd.inertia;
    }
    return K;
  }

  ignite(id: Id): boolean {
    const ch = this.chamberById.get(id);
    return ch ? ch.ignite(this.time, this.events) : false;
  }

  /**
   * O adaptador avisa que algo tocou um sensor. A velocidade relativa no centro
   * do sensor decide se conta. Pode ser chamado durante ou depois do passo.
   */
  sensorTouch(sensorId: Id, otherBody: number, otherPart: Id): void {
    const s = this.sensors.get(sensorId);
    if (!s) return;
    if (otherBody === s.p.body) return;
    // velocidade relativa no centro do sensor antes e depois do passo: vale a
    // maior (um batente rígido pode parar a peça dentro do passo do toque)
    const rel = (st: (i: number) => BodyState) => {
      const at = (i: number, px: number, py: number): Vec2 => {
        if (!this.dyn(i)) return [0, 0];
        const b = st(i);
        return [b.vx - b.w * (py - b.y), b.vy + b.w * (px - b.x)];
      };
      const c = this.world(s.p.body, s.p.center);
      const v1 = at(otherBody, c[0], c[1]);
      const v0 = at(s.p.body, c[0], c[1]);
      return dhypot(v1[0] - v0[0], v1[1] - v0[1]);
    };
    const before = rel((i) => this.pre[i]!);
    this.fresh[otherBody] = false;
    this.fresh[s.p.body] = false;
    const speed = Math.max(
      before,
      rel((i) => this.body(i)),
    );
    if (speed + 1e-9 >= s.p.minSpeed) this.pending.push({ sensor: sensorId, part: otherPart, speed });
  }

  /** Depois de cada passo do motor. */
  afterStep(h: number): void {
    this.time += h;
    this.steps++;
    this.fresh.fill(false);
    while (this.pending.length) {
      const e = this.pending.shift()!;
      const s = this.sensors.get(e.sensor)!;
      s.count++;
      this.events.push({ kind: "sensor", sensor: e.sensor, part: e.part, speed: e.speed, time: this.time });
      for (const a of s.p.actions) {
        if (a.do === "ignite") this.ignite(a.target);
        else if (a.vent !== undefined) this.setVent(a.target, a.vent, a.do === "open");
      }
    }
  }

  dragStart(body: number, point: Vec2): boolean {
    if (!this.dyn(body)) return false;
    const s = this.body(body);
    const c = dcos(-s.angle);
    const n = dsin(-s.angle);
    const dx = point[0] - s.x;
    const dy = point[1] - s.y;
    this.drag = { body, local: [dx * c - dy * n, dx * n + dy * c], target: [point[0], point[1]] };
    return true;
  }

  dragMove(point: Vec2): void {
    if (this.drag) this.drag.target = [point[0], point[1]];
  }

  dragEnd(): void {
    this.drag = null;
  }

  private dragImpulse(h: number): void {
    const d = this.drag;
    if (!d) return;
    const b = this.plan.bodies[d.body]!;
    const m = b.mass;
    const I = b.inertia;
    const s = this.body(d.body);
    const p = this.world(d.body, d.local);
    const rx = p[0] - s.x;
    const ry = p[1] - s.y;
    const dp = dragParams(m, this.plan.gravity);
    const omega = 2 * PI * dp.hertz;
    const k = m * omega * omega;
    const c = 2 * m * DRAG_DAMPING * omega;
    const gamma = 1 / (h * (c + h * k));
    const beta = h * k * gamma;
    // K = M⁻¹ efetiva no ponto + γ·I
    const k11 = 1 / m + (ry * ry) / I + gamma;
    const k12 = -(rx * ry) / I;
    const k22 = 1 / m + (rx * rx) / I + gamma;
    const det = k11 * k22 - k12 * k12;
    const vx = s.vx - s.w * ry;
    const vy = s.vy + s.w * rx;
    const bx = -(vx + beta * (p[0] - d.target[0]));
    const by = -(vy + beta * (p[1] - d.target[1]));
    let jx = (k22 * bx - k12 * by) / det;
    let jy = (k11 * by - k12 * bx) / det;
    const maxJ = dp.maxForce * h;
    const jl = dhypot(jx, jy);
    if (jl > maxJ) {
      jx *= maxJ / jl;
      jy *= maxJ / jl;
    }
    this.io.applyImpulse(d.body, jx, jy, p[0], p[1]);
  }

  /** Ponto do mundo (pose desenhada) → espaço do corpo. */
  localOf(body: number, w: Vec2): Vec2 {
    const b = this.plan.bodies[body]!;
    return [w[0] - b.position[0], w[1] - b.position[1]];
  }

  axleAngle(i: number): { angle: number; speed: number; gap: number } {
    const a = this.plan.axles[i]!;
    const A = this.body(a.a);
    const B = this.body(a.b);
    const pa = this.world(a.a, this.localOf(a.a, a.anchor));
    const pb = this.world(a.b, this.localOf(a.b, a.anchor));
    return { angle: B.angle - A.angle, speed: B.w - A.w, gap: dhypot(pb[0] - pa[0], pb[1] - pa[1]) };
  }

  sliderTranslation(id: Id): number {
    const s = this.plan.sliders.find((x) => x.id === id)!;
    const A = this.body(s.a);
    const ca = dcos(A.angle);
    const sa = dsin(A.angle);
    const ux = s.axis[0] * ca - s.axis[1] * sa;
    const uy = s.axis[0] * sa + s.axis[1] * ca;
    const pa = this.world(s.a, this.localOf(s.a, s.anchor));
    const pb = this.world(s.b, this.localOf(s.b, s.anchor));
    return (pb[0] - pa[0]) * ux + (pb[1] - pa[1]) * uy;
  }

  pose(partId: Id): PartPose | null {
    const r = this.plan.partRel.get(partId);
    if (!r) return null;
    const s = this.body(r.body);
    const c = dcos(s.angle);
    const n = dsin(s.angle);
    return { x: s.x + r.x * c - r.y * n, y: s.y + r.x * n + r.y * c, angle: s.angle + r.angle };
  }

  snapshot(): Snapshot {
    const parts: Record<Id, PartPose> = {};
    for (const id of this.plan.partIds) {
      const p = this.pose(id);
      if (p) parts[id] = p;
    }
    const links: Record<Id, LinkState> = {};
    this.plan.axles.forEach((a, i) => {
      const s = this.axleAngle(i);
      const st: LinkState = { kind: "axle", angle: s.angle, speed: s.speed, gap: s.gap };
      const tq = this.jointTorque(a.id);
      if (tq !== null) st.torque = tq / N;
      links[a.id] = st;
    });
    for (const d of this.plan.distances) {
      const pa = this.world(d.a, this.localOf(d.a, d.anchorA));
      const pb = this.world(d.b, this.localOf(d.b, d.anchorB));
      const L = dhypot(pb[0] - pa[0], pb[1] - pa[1]);
      const st: LinkState = { kind: d.kind, length: L };
      if (d.kind === "cable") st.slack = d.length - L;
      const f = this.jointForce(d.id);
      if (f && L > 1e-9) st.force = -(f[0] * (pb[0] - pa[0]) + f[1] * (pb[1] - pa[1])) / L / N;
      links[d.id] = st;
    }
    for (const sl of this.plan.slots) {
      const A = this.body(sl.a);
      const c = dcos(A.angle);
      const n = dsin(A.angle);
      const ux = sl.axis[0] * c - sl.axis[1] * n;
      const uy = sl.axis[0] * n + sl.axis[1] * c;
      const pa = this.world(sl.a, this.localOf(sl.a, sl.anchor));
      const pb = this.world(sl.b, this.localOf(sl.b, sl.anchor));
      const dx = pb[0] - pa[0];
      const dy = pb[1] - pa[1];
      links[sl.id] = { kind: "slot", position: dx * ux + dy * uy - sl.mid, deviation: dx * uy - dy * ux };
    }
    for (const sc of this.plan.slotContacts) {
      // folga do pino até a parede do furo (positiva = livre; negativa = penetrando ou fora)
      const p = this.world(sc.pinBody, sc.pinLocal);
      const ring = sc.hole.map((q) => this.world(sc.guideBody, q));
      links[sc.id] = { kind: "slot", clearance: ringSignedDistance(ring, p) - sc.r };
    }
    for (const m of this.plan.mounts) {
      const pa = this.world(m.a, this.localOf(m.a, m.anchor));
      const pb = this.world(m.b, this.localOf(m.b, m.anchor));
      links[m.id] = {
        kind: "mount",
        offset: dhypot(pb[0] - pa[0], pb[1] - pa[1]),
        angle: this.body(m.b).angle - this.body(m.a).angle,
      };
    }
    for (const s of this.plan.sliders) {
      const st: LinkState = { kind: "slider", translation: this.sliderTranslation(s.id) };
      const A = this.body(s.a);
      const ca = dcos(A.angle);
      const sa = dsin(A.angle);
      const ux = s.axis[0] * ca - s.axis[1] * sa;
      const uy = s.axis[0] * sa + s.axis[1] * ca;
      // força ao longo do eixo sobre a peça do trilho: reação da junta (batentes, atrito) + mola de retorno
      let F = 0;
      const f = this.jointForce(s.id);
      if (f) F += (f[0] * ux + f[1] * uy) / N;
      if (s.spring) {
        const pa = this.world(s.a, this.localOf(s.a, s.anchor));
        const pb = this.world(s.b, this.localOf(s.b, s.anchor));
        const va = this.pointVel(s.a, pa[0], pa[1]);
        const vb = this.pointVel(s.b, pb[0], pb[1]);
        const v = (vb[0] - va[0]) * ux + (vb[1] - va[1]) * uy;
        F += (-s.spring.k * ((st.translation ?? 0) - s.spring.rest) - s.spring.damping * v) / N;
      }
      if (f || s.spring) st.force = F;
      links[s.id] = st;
    }
    for (const s of this.plan.springs) {
      const pa = this.world(s.a, s.localA);
      const pb = this.world(s.b, s.localB);
      const dx = pb[0] - pa[0];
      const dy = pb[1] - pa[1];
      const len = dhypot(dx, dy);
      // força do motor (mola nativa e batente das espiras), positiva = empurra
      const jf = this.jointForce(s.id);
      const stop = jf && len > 1e-9 ? (jf[0] * dx + jf[1] * dy) / len / N : 0;
      const st: LinkState = { kind: "spring", length: len };
      if (this.native.has(s.id)) st.force = stop;
      else {
        // força da mola no estado atual (a mesma que o próximo passo aplica)
        const f = this.springForce(s);
        const F = -f.F / N;
        st.force = F + stop;
        st.stopForce = stop;
        if (s.guide) {
          // componente da força aplicada transversal ao eixo da guia
          const g = this.body(s.guide.body);
          const c = dcos(g.angle);
          const n = dsin(g.angle);
          const gx = s.guide.axis[0] * c - s.guide.axis[1] * n;
          const gy = s.guide.axis[0] * n + s.guide.axis[1] * c;
          st.sideForce = Math.abs(f.ux * gy - f.uy * gx) * Math.abs(F);
          st.length = dx * gx + dy * gy;
        }
      }
      links[s.id] = st;
    }
    for (const c of this.chambers) links[c.p.id] = c.state();
    for (const s of this.sensors.values()) links[s.p.id] = { kind: "sensor", count: s.count };
    return { time: this.time, steps: this.steps, parts, links, events: this.events.slice() };
  }

  /** Eventos que o adaptador colhe do motor (impactos), somados aos do passo. */
  pushEvents(list: EngineEvent[]): void {
    for (const e of list) this.events.push(e);
  }

  /** Abre ou fecha a válvula de um respiro. */
  setVent(id: Id, vent: number, open: boolean): void {
    this.chamberById.get(id)?.setVent(vent, open, this.time, this.events);
  }

  sensorCount(id: Id): number {
    return this.sensors.get(id)?.count ?? 0;
  }

  /**
   * Diagnóstico do estado (teste de abuso): energia cinética e potencial
   * (gravidade e molas), maior velocidade de peça (só dentro de `region`,
   * se dada: as que caíram da cena estão em queda livre), folgas de trilho
   * e de rasgo em junta. A energia das molas segue o que o motor aplica: Hooke
   * com o modo da mola, a mola de retorno do trilho, a mola de torção e,
   * no suporte elástico, a mola macia da junta soldada do Box2D (massa
   * efetiva K⁻¹ no ponto, ω² pela frequência).
   */
  probe(region?: [number, number, number, number]): EngineProbe {
    const { plan } = this;
    const g = plan.gravity;
    let kin = 0;
    let pot = 0;
    let maxSpeed = 0;
    let outside = 0;
    let nan = false;
    for (let i = 1; i < plan.bodies.length; i++) {
      if (!this.dyn(i)) continue;
      const b = plan.bodies[i]!;
      const s = this.body(i);
      if (![s.x, s.y, s.angle, s.vx, s.vy, s.w].every(Number.isFinite)) nan = true;
      kin += 0.5 * b.mass * (s.vx * s.vx + s.vy * s.vy) + 0.5 * b.inertia * s.w * s.w;
      // relativa à pose desenhada (o centro de massa começa em b.position)
      pot -= b.mass * (g[0] * (s.x - b.position[0]) + g[1] * (s.y - b.position[1]));
      if (region && (s.x < region[0] || s.y < region[1] || s.x > region[2] || s.y > region[3])) outside++;
      else maxSpeed = Math.max(maxSpeed, dhypot(s.vx, s.vy));
    }
    for (const sp of plan.springs) {
      const f = this.springForce(sp);
      const d = f.L - sp.freeLength;
      if (sp.mode === "fixed" || (sp.mode === "seated" && d < 0) || (sp.mode === "tension" && d > 0))
        pot += 0.5 * sp.k * d * d;
    }
    let railGap = 0;
    let railOver = 0;
    for (const sl of plan.sliders) {
      const A = this.body(sl.a);
      const c = dcos(A.angle);
      const n = dsin(A.angle);
      const ux = sl.axis[0] * c - sl.axis[1] * n;
      const uy = sl.axis[0] * n + sl.axis[1] * c;
      const pa = this.world(sl.a, this.localOf(sl.a, sl.anchor));
      const pb = this.world(sl.b, this.localOf(sl.b, sl.anchor));
      const dx = pb[0] - pa[0];
      const dy = pb[1] - pa[1];
      const t = dx * ux + dy * uy;
      railGap = Math.max(railGap, Math.abs(dx * uy - dy * ux));
      railOver = Math.max(railOver, sl.lower - t, t - sl.upper);
      if (sl.spring) pot += 0.5 * sl.spring.k * (t - sl.spring.rest) ** 2;
    }
    for (const sl of plan.slots) {
      const A = this.body(sl.a);
      const c = dcos(A.angle);
      const n = dsin(A.angle);
      const ux = sl.axis[0] * c - sl.axis[1] * n;
      const uy = sl.axis[0] * n + sl.axis[1] * c;
      const pa = this.world(sl.a, this.localOf(sl.a, sl.anchor));
      const pb = this.world(sl.b, this.localOf(sl.b, sl.anchor));
      const dx = pb[0] - pa[0];
      const dy = pb[1] - pa[1];
      const t = dx * ux + dy * uy;
      railGap = Math.max(railGap, Math.abs(dx * uy - dy * ux));
      railOver = Math.max(railOver, sl.lower - t, t - sl.upper);
    }
    for (const a of plan.axles) {
      if (!a.torsion) continue;
      const d = this.body(a.b).angle - this.body(a.a).angle - a.torsion.rest;
      pot += 0.5 * a.torsion.k * d * d;
    }
    for (const m of plan.mounts) {
      const pa = this.world(m.a, this.localOf(m.a, m.anchor));
      const pb = this.world(m.b, this.localOf(m.b, m.anchor));
      const cx = pb[0] - pa[0];
      const cy = pb[1] - pa[1];
      // K = M⁻¹ efetiva no ponto (como a junta soldada do Box2D); energia ½·ω²·Cᵀ·K⁻¹·C
      let k11 = 0;
      let k12 = 0;
      let k22 = 0;
      let iSum = 0;
      for (const [bi, p] of [
        [m.a, pa],
        [m.b, pb],
      ] as const) {
        if (!this.dyn(bi)) continue;
        const bd = plan.bodies[bi]!;
        const s = this.body(bi);
        const rx = p[0] - s.x;
        const ry = p[1] - s.y;
        k11 += 1 / bd.mass + (ry * ry) / bd.inertia;
        k12 -= (rx * ry) / bd.inertia;
        k22 += 1 / bd.mass + (rx * rx) / bd.inertia;
        iSum += 1 / bd.inertia;
      }
      const det = k11 * k22 - k12 * k12;
      const wl = 2 * PI * m.linearHz;
      if (det > 0 && m.linearHz > 0)
        pot += (0.5 * wl * wl * (k22 * cx * cx - 2 * k12 * cx * cy + k11 * cy * cy)) / det;
      const wa = 2 * PI * m.angularHz;
      const th = this.body(m.b).angle - this.body(m.a).angle;
      if (iSum > 0 && m.angularHz > 0) pot += (0.5 * wa * wa * th * th) / iSum;
    }
    return { kinetic: kin * 1e-6, potential: pot * 1e-6, maxSpeed, outside, railGap, railOver, nan };
  }
}
