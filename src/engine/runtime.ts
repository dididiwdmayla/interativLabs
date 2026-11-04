import type { Id } from "@/model/types";
import type { Vec2 } from "@/geometry/vec";
import type { Plan, PlanChamber, PlanSensor, PlanSpring } from "./plan";
import { N } from "@/model/units";
import type { EngineEvent, LinkState, PartPose, Snapshot } from "./types";
import { PI, dcos, dexp, dhypot, dsin } from "@/geometry/dmath";

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
 * Arrasto: mola amortecida resolvida como restrição suave (como a junta de
 * mouse). No protótipo (gravidade de 100 mm/s²): 6 Hz e força máxima de
 * (600·m + 400) g·(10 mm)/s². Aqui a frequência e a força escalam com a
 * gravidade da cena (√g e g), para que com gravidade real o dedo ainda
 * levante a peça sem que ela fique pendurada vários mm abaixo do dedo.
 */
const DRAG_HZ = 6;
const DRAG_HZ_MAX = 30;
const DRAG_DAMPING = 0.9;
const DRAG_G_REF = 100;
const DRAG_FORCE_PER_GRAM = 6000;
const DRAG_FORCE_BASE = 4000;

/** Câmara (docs/arquitetura.md §4). Valores do protótipo convertidos para mm. */
const VENT_TAU = 0.004;
const LEAK_TAU = 1.5;
const BORE_MARGIN = 1.5;
const BACK_MARGIN = 3;
const MIN_GAP = 0.5;

interface ChamberState {
  p: PlanChamber;
  gas: number;
  t: number;
  burning: boolean;
  fired: boolean;
  vented: boolean;
  pressure: number;
  s: number;
  exitSpeed: number | null;
}

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
 * Mola do arrasto (o dedo): frequência e força máxima, escaladas pela
 * gravidade da cena a partir das do protótipo (6 Hz e (600·m + 400) g·(10 mm)/s²
 * com 100 mm/s²).
 */
export function dragParams(mass: number, gravity: Vec2): { hertz: number; maxForce: number } {
  const gs = Math.max(1, dhypot(gravity[0], gravity[1]) / DRAG_G_REF);
  return {
    hertz: Math.min(DRAG_HZ_MAX, DRAG_HZ * Math.sqrt(gs)),
    maxForce: (DRAG_FORCE_PER_GRAM * mass + DRAG_FORCE_BASE) * gs,
  };
}

export class Runtime {
  readonly plan: Plan;
  private io: BodyIO;
  private st: BodyState[];
  private fresh: boolean[];
  private chambers: ChamberState[];
  private chamberById = new Map<Id, ChamberState>();
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
    this.chambers = plan.chambers.map((p) => ({
      p,
      gas: 0,
      t: 0,
      burning: false,
      fired: false,
      vented: false,
      pressure: 0,
      s: 0,
      exitSpeed: null,
    }));
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
    for (const ch of this.chambers) this.chamberForce(ch, h);
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

  private chamberForce(ch: ChamberState, h: number): void {
    const p = ch.p;
    if (p.b < 0) return;
    const base = this.world(p.a, p.base);
    const A = this.body(p.a);
    const ca = dcos(A.angle);
    const sa = dsin(A.angle);
    const ux = p.axis[0] * ca - p.axis[1] * sa;
    const uy = p.axis[0] * sa + p.axis[1] * ca;
    const B = this.body(p.b);
    const rx = B.x - base[0];
    const ry = B.y - base[1];
    const s = rx * ux + ry * uy - p.rearOffset;
    const perp = Math.abs(rx * uy - ry * ux);
    ch.s = s;
    if (ch.burning) {
      const dtb = Math.min(h, p.burn - ch.t);
      if (dtb > 0) ch.gas += (p.charge * dtb) / p.burn;
      ch.t += h;
      if (ch.t >= p.burn) ch.burning = false;
    }
    const inBore = perp < p.bore / 2 + BORE_MARGIN && s > -BACK_MARGIN && s < p.length;
    if (ch.fired && !ch.vented && !inBore) {
      ch.vented = true;
      ch.exitSpeed = dhypot(B.vx, B.vy);
      this.events.push({ kind: "vent-opened", chamber: p.id, vent: 0, by: "wall", time: this.time });
    }
    if (ch.vented) ch.gas *= dexp(-h / VENT_TAU);
    ch.gas *= dexp(-h / LEAK_TAU);
    const gap = Math.max(s, MIN_GAP);
    ch.pressure = ch.gas / (gap * p.bore);
    if (!ch.vented && ch.gas > 1e-9) {
      const F = ch.gas / gap;
      this.io.applyForce(p.b, ux * F, uy * F, B.x, B.y);
      if (this.dyn(p.a)) this.io.applyForce(p.a, -ux * F, -uy * F, base[0], base[1]);
    }
  }

  ignite(id: Id): boolean {
    const ch = this.chamberById.get(id);
    if (!ch || ch.fired || ch.p.b < 0) return false;
    ch.fired = true;
    ch.burning = true;
    ch.t = 0;
    if (ch.p.burn <= 0) {
      ch.gas = ch.p.charge;
      ch.burning = false;
    }
    this.events.push({ kind: "chamber-fired", chamber: id, time: this.time });
    return true;
  }

  /**
   * O adaptador avisa que algo tocou um sensor. A velocidade relativa no centro
   * do sensor decide se conta. Pode ser chamado durante ou depois do passo.
   */
  sensorTouch(sensorId: Id, otherBody: number, otherPart: Id): void {
    const s = this.sensors.get(sensorId);
    if (!s) return;
    if (otherBody === s.p.body) return;
    this.fresh[otherBody] = false;
    this.fresh[s.p.body] = false;
    const c = this.world(s.p.body, s.p.center);
    const v1 = this.pointVel(otherBody, c[0], c[1]);
    const v0 = this.pointVel(s.p.body, c[0], c[1]);
    const speed = dhypot(v1[0] - v0[0], v1[1] - v0[1]);
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
      for (const t of s.p.triggers) this.ignite(t);
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
      const f = this.jointForce(s.id);
      if (f) {
        const A = this.body(s.a);
        const ca = dcos(A.angle);
        const sa = dsin(A.angle);
        const ux = s.axis[0] * ca - s.axis[1] * sa;
        const uy = s.axis[0] * sa + s.axis[1] * ca;
        st.force = (f[0] * ux + f[1] * uy) / N;
      }
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
    for (const c of this.chambers)
      links[c.p.id] = {
        kind: "chamber",
        gas: c.gas,
        pressure: c.pressure,
        fired: c.fired,
        burning: c.burning,
      };
    for (const s of this.sensors.values()) links[s.p.id] = { kind: "sensor", count: s.count };
    return { time: this.time, steps: this.steps, parts, links, events: this.events.slice() };
  }

  /** Eventos que o adaptador colhe do motor (impactos), somados aos do passo. */
  pushEvents(list: EngineEvent[]): void {
    for (const e of list) this.events.push(e);
  }

  /** Abre ou fecha a válvula de um respiro (gás 2.0, item 5.6; a câmara provisória não tem respiro). */
  setVent(id: Id, vent: number, open: boolean): void {
    void [id, vent, open];
  }

  sensorCount(id: Id): number {
    return this.sensors.get(id)?.count ?? 0;
  }
}
