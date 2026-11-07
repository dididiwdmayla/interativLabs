import { dexp, dpow } from "@/geometry/dmath";
import type { Vec2 } from "@/geometry/vec";
import type { Id } from "@/model/types";
import { GAS_RT, KPA_MM2, N } from "@/model/units";
import type { EngineEvent, LinkState } from "./types";

/**
 * Câmara de gás 2.0 (docs/arquitetura.md §4), igual em todos os motores.
 *
 * Gás ideal entre as faces internas das paredes (ou entre o fundo e a parede,
 * com uma só): V = A·L. Estado: gás n (mmol) e, no modelo adiabático, a
 * energia interna U (kPa·mm³). Isotérmico: P = n·R·T/V. Adiabático: entre um
 * passo e outro sem troca de gás, U·V^(γ−1) fica constante (P·V^γ constante),
 * e P = (γ−1)·U/V. Força em cada parede: F = (P − p0)·A, para fora; a soma das
 * reações vai ao corpo. p0 é a pressão inicial e a do ambiente (respiros).
 *
 * Escape e portas: fluxo pelo orifício proporcional à área e à diferença de
 * pressão, dn/dt = −K·A_o·(P − P_fora), com K = 0,05 mmol/(s·mm²·kPa): o
 * fluxo estrangulado do ar a 20 °C (0,0814 mmol/(s·mm²·kPa) × P) com
 * coeficiente de descarga 0,62, aplicado à diferença de pressão. Com
 * orifícios de milímetros a constante de tempo é de microssegundos, menor que
 * o passo: o fluxo é integrado de forma exata (relaxação exponencial do gás
 * para o equilíbrio), não por Euler.
 */

/** mmol/(s·mm²·kPa) */
export const ORIFICE_K = 0.05;
/** menor distância entre as faces, mm (o gás não some) */
const L_MIN = 0.05;

export interface PlanWall {
  part: Id;
  body: number;
  /** +1: a pressão empurra no sentido do eixo (parede da frente); −1: contra (parede de trás) */
  side: 1 | -1;
  /** ponto da face interna sobre o eixo, no espaço do corpo da parede */
  face: Vec2;
  /** posição inicial da face ao longo do eixo, mm do fundo */
  s0: number;
  seal: number;
}

export interface PlanChamber {
  id: Id;
  ref: number;
  /** corpo do cilindro (0 = fundo) */
  body: number;
  /** fundo e eixo (unitário) no espaço do corpo do cilindro */
  base: Vec2;
  axis: Vec2;
  /** mm² */
  area: number;
  length: number;
  walls: PlanWall[];
  vents: { at: number; d: number; area: number; open: boolean }[];
  /** to = índice da outra câmara no plano (−1 se ficou de fora) */
  ports: { to: number; toId: Id; at: number; d: number; area: number }[];
  model: "isothermal" | "adiabatic";
  gamma: number;
  /** kPa */
  p0: number;
  /** mmol */
  charge: number;
  /** s */
  burn: number;
  /** quantas vezes a carga acende */
  shots: number;
}

/** Geometria lida dos corpos a cada passo. */
export interface ChamberGeometry {
  /** fundo no mundo e eixo no mundo */
  base: Vec2;
  axis: Vec2;
  /** posição de cada face ao longo do eixo, mm do fundo, e o ponto no mundo */
  s: number[];
  faces: Vec2[];
  /** distância de cada face até a linha do eixo, mm (fora do furo: a parede saiu do cilindro) */
  lat?: number[];
}

/** Uma parede com a face a mais de 1,5 raio da linha do eixo saiu do cilindro. */
const OUT_OF_BORE = 1.5;

interface WallSim {
  travel: number;
  sealed: boolean;
  work: number;
  impulse: number;
  /** força aplicada no último passo, g·mm/s² (positiva = para fora) */
  force: number;
  sPrev: number;
}

export class ChamberSim {
  readonly p: PlanChamber;
  n = 0;
  U = 0;
  V = 0;
  P = 0;
  fired = false;
  /** acendimentos até agora */
  shotsFired = 0;
  burning = false;
  private tBurn = 0;
  private first = true;
  walls: WallSim[];
  ventOpen: boolean[];
  ventExposed: number[];
  portExposed: number[];
  /** área total de escape para o ambiente no passo (mm²) */
  private outArea = 0;
  /** parte dela que sai por respiros abertos (mm²) */
  private ventArea = 0;
  /** vazão por respiros e portas no passo, mmol/s (só leitura: alimenta o som) */
  flow = 0;
  /** alguma parede saiu do furo (de lado): o cilindro está aberto e o gás não empurra */
  breached = false;

  constructor(p: PlanChamber) {
    this.p = p;
    // antes do primeiro passo, a pressão do ambiente (o quadro 0 mostra p0, não 0)
    this.P = p.p0;
    this.walls = p.walls.map((w) => ({
      travel: 0,
      sealed: true,
      work: 0,
      impulse: 0,
      force: 0,
      sPrev: w.s0,
    }));
    this.ventOpen = p.vents.map((v) => v.open);
    this.ventExposed = p.vents.map(() => 0);
    this.portExposed = p.ports.map(() => 0);
  }

  private get rt0(): number {
    return GAS_RT;
  }

  /** Faces: frente e trás (o fundo, com uma parede só). */
  private span(g: ChamberGeometry): [number, number] {
    let front = Infinity;
    let rear = 0;
    let hasRear = false;
    this.p.walls.forEach((w, i) => {
      if (w.side > 0) front = Math.min(front, g.s[i]!);
      else {
        rear = hasRear ? Math.max(rear, g.s[i]!) : g.s[i]!;
        hasRear = true;
      }
    });
    if (!Number.isFinite(front)) front = rear + L_MIN;
    return [front, rear];
  }

  /** Fração descoberta de um orifício de diâmetro d na posição x do eixo. */
  private exposure(x: number, d: number, front: number, rear: number): number {
    const a = Math.max(0, Math.min(1, (front - (x - d / 2)) / d));
    const b = Math.max(0, Math.min(1, (x + d / 2 - rear) / d));
    return a * b;
  }

  /**
   * Avança o gás um passo: volume pelas paredes, queima, escape pelos respiros
   * e pelas paredes que desvedaram. As portas são feitas depois, aos pares.
   */
  update(g: ChamberGeometry, h: number, time: number, events: EngineEvent[]): void {
    const p = this.p;
    this.flow = 0;
    const [front, rear] = this.span(g);
    const L = Math.max(front - rear, L_MIN);
    const V = p.area * L;
    if (this.first) {
      this.first = false;
      this.V = V;
      this.n = (p.p0 * V) / this.rt0;
      this.U = (p.p0 * V) / (p.gamma - 1 || 1);
    }
    // trabalho do último passo: força aplicada × deslocamento da face para fora
    p.walls.forEach((w, i) => {
      const ws = this.walls[i]!;
      const s = g.s[i]!;
      ws.work += (ws.force * w.side * (s - ws.sPrev)) / N;
      ws.sPrev = s;
      ws.travel = w.side * (s - w.s0);
      const sealed = ws.travel <= w.seal;
      if (ws.sealed && !sealed) events.push({ kind: "wall-unsealed", chamber: p.id, part: w.part, time });
      ws.sealed = sealed;
    });
    // expansão ou compressão sem troca de gás
    if (p.model === "adiabatic" && this.V > 0) this.U *= dpow(this.V / V, p.gamma - 1);
    this.V = V;
    // queima: o gás entra na temperatura de referência
    if (this.burning) {
      const dt = p.burn > 0 ? Math.min(h, p.burn - this.tBurn) : 0;
      const dn = p.burn > 0 ? (p.charge * Math.max(0, dt)) / p.burn : 0;
      this.n += dn;
      this.U += (dn * this.rt0) / (p.gamma - 1 || 1);
      this.tBurn += h;
      if (this.tBurn >= p.burn - 1e-12) this.burning = false;
    }
    // escape para o ambiente: respiros descobertos e abertos, paredes desvedadas
    let area = 0;
    p.vents.forEach((v, i) => {
      const e = this.exposure(v.at, v.d, front, rear);
      if (this.ventOpen[i] && e > 0 && !(this.ventExposed[i]! > 0))
        events.push({ kind: "vent-opened", chamber: p.id, vent: i, by: "wall", time });
      this.ventExposed[i] = e;
      if (this.ventOpen[i]) area += e * v.area;
    });
    this.ventArea = area;
    this.walls.forEach((ws) => {
      if (!ws.sealed) area += p.area;
    });
    // boca do cilindro: a parede da frente que passa do comprimento abre o furo inteiro
    if (front > p.length) area += Math.min(1, (front - p.length) / p.length + 0.5) * p.area;
    // parede que saiu do furo de lado (arrancada, caída): o cilindro fica aberto
    const r = Math.sqrt(p.area / Math.PI);
    this.breached = !!g.lat?.some((l) => l > OUT_OF_BORE * r);
    if (this.breached) area += 4 * p.area;
    this.outArea = area;
    if (area > 0) this.relaxTo(p.p0, area, h);
    this.pressure();
  }

  /** Pressão do estado atual, kPa. */
  pressure(): number {
    const p = this.p;
    this.P = p.model === "isothermal" ? (this.n * this.rt0) / this.V : ((p.gamma - 1) * this.U) / this.V;
    return this.P;
  }

  /** Temperatura relativa (R·T atual). */
  private rtNow(): number {
    return this.p.model === "isothermal" || this.n <= 0 ? this.rt0 : (this.pressure() * this.V) / this.n;
  }

  /** Gás escapa (ou entra) pelo orifício até a pressão de fora, exato no passo. */
  private relaxTo(pOut: number, area: number, h: number): void {
    const rt = this.rtNow();
    const nEq = (pOut * this.V) / rt;
    const tau = this.V / (ORIFICE_K * area * rt);
    const n0 = this.n;
    const n1 = nEq + (this.n - nEq) * dexp(-h / tau);
    this.setGas(n1, this.rt0);
    // só o que passa pelos respiros conta como vazão (a boca aberta é o tiro, não o chiado)
    if (h > 0) this.flow += (Math.abs(n0 - n1) / h) * (this.ventArea / area);
  }

  /** Muda a quantidade de gás: saída expande o que fica (isentrópico); entrada traz gás a R·T. */
  setGas(n1: number, rtIn: number): void {
    const p = this.p;
    if (p.model === "adiabatic") {
      if (n1 < this.n && this.n > 0) this.U *= dpow(Math.max(n1, 0) / this.n, p.gamma);
      else this.U += ((n1 - this.n) * p.gamma * rtIn) / (p.gamma - 1);
    }
    this.n = Math.max(n1, 0);
  }

  /** Fração descoberta das portas (chamar depois de update). */
  ports(g: ChamberGeometry, time: number, events: EngineEvent[]): void {
    const [front, rear] = this.span(g);
    this.p.ports.forEach((pt, i) => {
      const e = this.exposure(pt.at, pt.d, front, rear);
      if (e > 0 && !(this.portExposed[i]! > 0))
        events.push({ kind: "port-opened", chamber: this.p.id, port: i, time });
      this.portExposed[i] = e;
    });
  }

  /** Força do gás em cada parede, g·mm/s² (positiva = para fora); zero com o cilindro arrombado. */
  gasForce(): number {
    if (this.breached) return 0;
    return (this.P - this.p.p0) * this.p.area * KPA_MM2;
  }

  /**
   * Rigidez do gás, g/s²: −dF/dL. Isotérmico: P·A/L; adiabático: γ·P·A/L.
   * Usada pela mola nativa que leva a força do gás para dentro do solver.
   */
  stiffness(h: number): number {
    if (this.breached) return 0;
    const L = this.V / this.p.area;
    const g = this.p.model === "isothermal" ? 1 : this.p.gamma;
    const k = (g * this.P * this.p.area * KPA_MM2) / L;
    // Aberta para o ambiente, a câmara não guarda a compressão: o escape
    // (constante de tempo τ) leva a pressão a p0 antes de o passo acabar.
    if (this.outArea <= 0) return k;
    const tau = this.V / (ORIFICE_K * this.outArea * this.rtNow());
    return k * (tau / (tau + h));
  }

  /** Registra a força aplicada no passo (para trabalho e impulso). */
  record(wall: number, force: number, h: number): void {
    const ws = this.walls[wall]!;
    ws.force = force;
    ws.impulse += (this.p.walls[wall]!.side * force * h) / N;
  }

  /**
   * Acende uma dose da carga. Com `shots` = 1 (o padrão), uma vez só; com mais,
   * de novo a cada acendimento enquanto houver dose, mas nunca durante uma
   * queima (o gás da dose anterior ainda está entrando).
   */
  ignite(time: number, events: EngineEvent[]): boolean {
    if (this.burning || this.shotsFired >= this.p.shots) return false;
    this.fired = true;
    this.shotsFired++;
    this.burning = this.p.burn > 0;
    this.tBurn = 0;
    if (this.p.burn <= 0) {
      this.n += this.p.charge;
      this.U += (this.p.charge * this.rt0) / (this.p.gamma - 1 || 1);
    }
    events.push({ kind: "chamber-fired", chamber: this.p.id, charge: this.p.charge, time });
    return true;
  }

  setVent(i: number, open: boolean, time: number, events: EngineEvent[]): void {
    if (i < 0 || i >= this.ventOpen.length || this.ventOpen[i] === open) return;
    this.ventOpen[i] = open;
    events.push(
      open
        ? { kind: "vent-opened", chamber: this.p.id, vent: i, by: "sensor", time }
        : { kind: "vent-closed", chamber: this.p.id, vent: i, time },
    );
  }

  get escaping(): number {
    return this.outArea;
  }

  state(): LinkState {
    return {
      kind: "chamber",
      pressure: this.P,
      volume: this.V,
      gas: this.n,
      fired: this.fired,
      shots: this.shotsFired,
      flow: this.flow,
      burning: this.burning,
      walls: this.p.walls.map((w, i) => {
        const ws = this.walls[i]!;
        return {
          part: w.part,
          force: ws.force / N,
          impulse: ws.impulse,
          work: ws.work,
          travel: ws.travel,
          sealed: ws.sealed,
        };
      }),
      vents: this.p.vents.map((_, i) => ({ open: this.ventOpen[i]!, exposed: this.ventExposed[i]! })),
      ports: this.p.ports.map((_, i) => ({ exposed: this.portExposed[i]! })),
    };
  }
}

/**
 * Troca de gás por uma porta entre duas câmaras, exata no passo: a diferença
 * n/V entre as duas decai com taxa K·A·R·T·(1/V₁ + 1/V₂). O gás que passa
 * leva a temperatura de quem cede.
 */
export function exchange(a: ChamberSim, b: ChamberSim, area: number, h: number): void {
  if (area <= 0 || a.V <= 0 || b.V <= 0) return;
  a.pressure();
  b.pressure();
  const src = a.P >= b.P ? a : b;
  const rt = src.n > 0 ? (src.P * src.V) / src.n : GAS_RT;
  const total = a.n + b.n;
  // equilíbrio de pressão com a mesma temperatura: n proporcional a V
  const aEq = (total * a.V) / (a.V + b.V);
  const rate = ORIFICE_K * area * rt * (1 / a.V + 1 / b.V);
  const aBefore = a.n;
  const a1 = aEq + (a.n - aEq) * dexp(-rate * h);
  const b1 = total - a1;
  a.setGas(a1, rt);
  b.setGas(b1, rt);
  if (h > 0) {
    const f = Math.abs(a.n - aBefore) / h;
    a.flow += f;
    b.flow += f;
  }
  a.pressure();
  b.pressure();
}
