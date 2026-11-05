import { FIXED_STEP } from "@/engine/common";
import type { LinkState, PartPose, Snapshot } from "@/engine/types";

/**
 * Ritmo da simulação na tela (sem DOM). A física é sempre em tempo real e
 * em unidades reais, com passo fixo de 1/240 s; a velocidade da interface
 * só diz quanto tempo simulado cabe em cada segundo de tela.
 *
 * O desenho fica um passo atrás do último passo pedido e mistura o passo
 * anterior com o atual (`alpha = acumulador / passo`), para a câmera lenta
 * andar a cada quadro em vez de aos saltos.
 */

export interface SpeedMode {
  /** fração do tempo real */
  factor: number;
  /** nome no botão */
  name: string;
  /** fração escrita embaixo do nome */
  frac: string;
}

/** Lento, Normal e Real, nesta ordem (o botão do celular troca nesta ordem). */
export const SPEED_MODES: readonly SpeedMode[] = [
  { factor: 0.05, name: "Lento", frac: "1/20" },
  { factor: 0.25, name: "Normal", frac: "¼" },
  { factor: 1, name: "Real", frac: "1×" },
];

export const SPEEDS = [0.05, 0.25, 1] as const;
export type Speed = (typeof SPEEDS)[number];
/** Normal: o padrão ao entrar em Testar e ao abrir uma cena no laboratório */
export const DEFAULT_SPEED: Speed = 0.25;
export const REAL_SPEED: Speed = 1;

export function speedMode(s: number): SpeedMode {
  return SPEED_MODES.find((m) => m.factor === s) ?? SPEED_MODES[1]!;
}

/** Frase da primeira vez que a pessoa toca em Real. */
export const REAL_NOTICE = "Tempo real: peças pequenas se movem rápido de verdade.";
/** chave da preferência no aparelho: a frase já foi mostrada */
export const REAL_NOTICE_KEY = "interativlabs:real-notice";

/** no máximo isto de passos por pedido (Real a 6 qps); o resto do tempo é descartado */
export const MAX_STEPS = 40;
/** quadro de tela mais longo que conta (aba voltando, engasgo) */
const MAX_FRAME = 0.1;

/**
 * Relógio da tela em passos. `t` é a posição do desenho (fracionária); os
 * pedidos ficam sempre um passo à frente dela (`ceil(t) + 1`), para que o
 * passo que o próximo quadro precisa misturar já tenha chegado do worker
 * em Lento e em Normal. Em Real (4 passos por quadro) quem desenha limita
 * ao último passo que chegou.
 */
export class Pacer {
  readonly h: number;
  readonly maxSteps: number;
  /** passos pedidos além da posição do desenho (0 quando os passos são síncronos, no laboratório) */
  readonly lookahead: number;
  /** posição do desenho, em passos */
  t = 0;
  /** último passo pedido */
  requested = 0;

  constructor(h = FIXED_STEP, opts: { maxSteps?: number; lookahead?: number } = {}) {
    this.h = h;
    this.maxSteps = opts.maxSteps ?? MAX_STEPS;
    this.lookahead = opts.lookahead ?? 1;
  }

  /** Soma o intervalo de tela `dt` (s) na velocidade `speed`. */
  advance(dt: number, speed: number): void {
    this.t += (Math.max(0, Math.min(MAX_FRAME, dt)) * speed) / this.h;
  }

  /** Passos a pedir agora para cobrir o desenho e um passo adiante. */
  take(): number {
    const need = Math.ceil(this.t - 1e-9) + this.lookahead;
    const n = Math.max(0, Math.min(this.maxSteps, need - this.requested));
    this.requested += n;
    // o que passou do limite de passos por pedido é descartado
    if (this.t > this.requested) this.t = this.requested;
    return n;
  }

  /** Passos pedidos fora do relógio (o botão de um passo): o desenho vai junto. */
  push(n: number): void {
    this.requested += n;
    this.t = this.requested;
  }

  /** Posição do desenho, em passos (fracionária). */
  display(): number {
    return this.t;
  }

  /** Tempo simulado que o relógio já cobriu, s. */
  simTime(): number {
    return this.t * this.h;
  }

  /** Recomeça com o desenho no passo `step`, que já foi calculado. */
  reset(step = 0): void {
    this.t = step;
    this.requested = step;
  }
}

/** Passo inteiro e fração da posição de desenho, limitada ao que já chegou. */
export function blendAt(display: number, oldest: number, latest: number): { step: number; alpha: number } {
  const d = Math.max(oldest, Math.min(latest, display));
  const step = Math.floor(d + 1e-9);
  const alpha = step >= latest ? 0 : d - step;
  return { step, alpha: alpha < 1e-6 ? 0 : alpha };
}

const TAU = 2 * Math.PI;

/** Ângulo de a para b pelo menor arco (desenho; não entra na física). */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  d -= TAU * Math.round(d / TAU);
  return a + d * t;
}

export function lerpPose(a: PartPose, b: PartPose, t: number): PartPose {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: lerpAngle(a.angle, b.angle, t) };
}

function lerpLink(a: LinkState | undefined, b: LinkState, t: number): LinkState {
  if (!a || a.kind !== b.kind) return b;
  const out: Record<string, unknown> = { ...b };
  for (const [k, v] of Object.entries(b)) {
    const u = (a as unknown as Record<string, unknown>)[k];
    if (typeof v === "number" && typeof u === "number") out[k] = u + (v - u) * t;
  }
  if (b.walls && a.walls)
    out.walls = b.walls.map((w, i) => {
      const p = a.walls![i];
      return p
        ? { ...w, travel: p.travel + (w.travel - p.travel) * t, force: p.force + (w.force - p.force) * t }
        : w;
    });
  return out as unknown as LinkState;
}

/**
 * Snapshot entre dois passos seguidos (laboratório): poses, molas, cabos e
 * gás interpolados; os eventos são os do passo `b` (quem desenha decide
 * quando mostrar).
 */
export function lerpSnapshot(a: Snapshot, b: Snapshot, t: number): Snapshot {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const parts: Record<string, PartPose> = {};
  for (const [id, p] of Object.entries(b.parts)) {
    const q = a.parts[id];
    parts[id] = q ? lerpPose(q, p, t) : p;
  }
  const links: Record<string, LinkState> = {};
  for (const [id, l] of Object.entries(b.links)) links[id] = lerpLink(a.links[id], l, t);
  return { time: a.time + (b.time - a.time) * t, steps: b.steps, parts, links, events: b.events };
}
