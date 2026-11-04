import type { Id } from "@/model/types";
import type { Vec2 } from "@/geometry/vec";
import type { Plan, PlanChamber, PlanSensor } from "./plan";
import type { EngineEvent, LinkState, PartPose, Snapshot } from "./types";

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

export interface BodyIO {
  read(body: number, out: BodyState): void;
  /** força no ponto (mundo, mm), g·mm/s² */
  applyForce(body: number, fx: number, fy: number, px: number, py: number): void;
  /** g·mm²/s² */
  applyTorque(body: number, t: number): void;
  /** g·mm/s, no ponto (mundo, mm) */
  applyImpulse(body: number, jx: number, jy: number, px: number, py: number): void;
}

/** Arrasto: mola amortecida resolvida como restrição suave (como a junta de mouse). */
const DRAG_HZ = 6;
const DRAG_DAMPING = 0.9;
/** Força máxima do arrasto: (600·m + 400) em g·(10 mm)/s² no protótipo → mm. */
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
  time = 0;
  steps = 0;

  constructor(plan: Plan, io: BodyIO) {
    this.plan = plan;
    this.io = io;
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
    const c = Math.cos(s.angle);
    const n = Math.sin(s.angle);
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
      if (!a.torsion) continue;
      const A = this.body(a.a);
      const B = this.body(a.b);
      const tau = -a.torsion.k * (B.angle - A.angle - a.torsion.rest) - a.torsion.damping * (B.w - A.w);
      if (this.dyn(a.b)) io.applyTorque(a.b, tau);
      if (this.dyn(a.a)) io.applyTorque(a.a, -tau);
    }
    for (const s of this.plan.sliders) {
      if (!s.spring) continue;
      const A = this.body(s.a);
      const B = this.body(s.b);
      const ca = Math.cos(A.angle);
      const sa = Math.sin(A.angle);
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
      const pa = this.world(s.a, s.localA);
      const pb = this.world(s.b, s.localB);
      const dx = pb[0] - pa[0];
      const dy = pb[1] - pa[1];
      const L = Math.hypot(dx, dy) || 1e-9;
      const nx = dx / L;
      const ny = dy / L;
      const va = this.pointVel(s.a, pa[0], pa[1]);
      const vb = this.pointVel(s.b, pb[0], pb[1]);
      const vr = (vb[0] - va[0]) * nx + (vb[1] - va[1]) * ny;
      const F = s.k * (L - s.freeLength) + s.damping * vr;
      if (this.dyn(s.a)) io.applyForce(s.a, nx * F, ny * F, pa[0], pa[1]);
      if (this.dyn(s.b)) io.applyForce(s.b, -nx * F, -ny * F, pb[0], pb[1]);
    }
    for (const ch of this.chambers) this.chamberForce(ch, h);
    this.dragImpulse(h);
  }

  private chamberForce(ch: ChamberState, h: number): void {
    const p = ch.p;
    if (p.b < 0) return;
    const base = this.world(p.a, p.base);
    const A = this.body(p.a);
    const ca = Math.cos(A.angle);
    const sa = Math.sin(A.angle);
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
      ch.exitSpeed = Math.hypot(B.vx, B.vy);
      this.events.push({ kind: "chamber-vented", chamber: p.id, exitSpeed: ch.exitSpeed, time: this.time });
    }
    if (ch.vented) ch.gas *= Math.exp(-h / VENT_TAU);
    ch.gas *= Math.exp(-h / LEAK_TAU);
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
    const speed = Math.hypot(v1[0] - v0[0], v1[1] - v0[1]);
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
    const c = Math.cos(-s.angle);
    const n = Math.sin(-s.angle);
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
    const omega = 2 * Math.PI * DRAG_HZ;
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
    const maxJ = (DRAG_FORCE_PER_GRAM * m + DRAG_FORCE_BASE) * h;
    const jl = Math.hypot(jx, jy);
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
    return { angle: B.angle - A.angle, speed: B.w - A.w, gap: Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) };
  }

  sliderTranslation(id: Id): number {
    const s = this.plan.sliders.find((x) => x.id === id)!;
    const A = this.body(s.a);
    const ca = Math.cos(A.angle);
    const sa = Math.sin(A.angle);
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
    const c = Math.cos(s.angle);
    const n = Math.sin(s.angle);
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
      links[a.id] = { kind: "axle", angle: s.angle, speed: s.speed, gap: s.gap };
    });
    for (const s of this.plan.sliders)
      links[s.id] = { kind: "slider", translation: this.sliderTranslation(s.id) };
    for (const s of this.plan.springs) {
      const pa = this.world(s.a, s.localA);
      const pb = this.world(s.b, s.localB);
      links[s.id] = { kind: "spring", length: Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) };
    }
    for (const c of this.chambers)
      links[c.p.id] = { kind: "chamber", gas: c.gas, pressure: c.pressure, fired: c.fired, vented: c.vented };
    for (const s of this.sensors.values()) links[s.p.id] = { kind: "sensor", count: s.count };
    return { time: this.time, steps: this.steps, parts, links, events: this.events.slice() };
  }

  sensorCount(id: Id): number {
    return this.sensors.get(id)?.count ?? 0;
  }
}
