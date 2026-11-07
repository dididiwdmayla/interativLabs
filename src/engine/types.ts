import type { Id, LinkKind, Scene } from "@/model/types";
import type { Vec2 } from "@/geometry/vec";

/**
 * Interface comum dos motores de física (docs/arquitetura.md §2).
 *
 * Entra a cena v2 (mm, g, s, N, kPa, rad). Sai o snapshot: poses em mm e rad;
 * forças em N; torques em N·mm; pressão em kPa; gás em mmol; trabalho em mJ
 * (N·mm). Só o adaptador conhece a escala interna do motor
 * (`unitMm` = mm por unidade).
 */

export interface CompileOptions {
  /** mm por unidade interna do motor */
  unitMm: number;
}

export interface CompileReport {
  /** avisos em português (ligações ignoradas, peças sem forma válida…) */
  warnings: string[];
  bodies: number;
  fixtures: number;
  joints: number;
}

export interface PartPose {
  /** mm */
  x: number;
  y: number;
  /** rad */
  angle: number;
}

export interface WallState {
  part: Id;
  /** força do gás na parede, N (positiva = para fora da câmara) */
  force: number;
  /** impulso recebido ao longo do eixo da câmara, N·s (com sinal) */
  impulse: number;
  /** trabalho feito pelo gás na parede, mJ */
  work: number;
  /** curso desde a pose desenhada, mm (positivo = para fora) */
  travel: number;
  sealed: boolean;
}

export interface LinkState {
  kind: LinkKind;
  released?: boolean;
  releasedAt?: number;
  /** eixo: ângulo relativo à pose desenhada (rad), velocidade (rad/s), abertura entre os dois pontos (mm) */
  angle?: number;
  speed?: number;
  gap?: number;
  /** eixo: torque do motor ou do atrito (N·mm) */
  torque?: number;
  /** trilho: deslocamento ao longo do eixo (mm) */
  translation?: number;
  /** força ao longo da ligação, N: trilho (reação ao longo do eixo), mola (+ empurra), haste e cabo (+ puxa) */
  force?: number;
  /** mola: parte da força que vem do batente das espiras encostadas, N */
  stopForce?: number;
  /** força transversal ao eixo da mola, N (mola com guia) */
  sideForce?: number;
  /** mola, haste, cabo: comprimento atual (mm) */
  length?: number;
  /** cabo: folga (comprimento máximo − atual, mm; > 0 = frouxo) */
  slack?: number;
  /** suporte elástico: deslocamento do ponto (mm) e giro (rad) */
  offset?: number;
  /** rasgo reto (junta): posição do pino ao longo do rasgo (mm, a partir do meio) e desvio transversal (mm) */
  position?: number;
  deviation?: number;
  /** rasgo por contato: folga entre o pino e a parede do furo (mm; negativa = penetrando ou fora) */
  clearance?: number;
  /** câmara: pressão absoluta (kPa), volume (mm³), gás (mmol), acesa, queimando */
  pressure?: number;
  volume?: number;
  gas?: number;
  fired?: boolean;
  /** câmara: quantas doses da carga já acenderam */
  shots?: number;
  burning?: boolean;
  walls?: WallState[];
  /** câmara: respiros (aberto e fração descoberta) */
  vents?: { open: boolean; exposed: number }[];
  /** câmara: portas (fração descoberta) */
  ports?: { exposed: number }[];
  /** sensor: quantas vezes disparou */
  count?: number;
}

export type EngineEvent =
  | { kind: "lock-released"; lock: Id; by: "touch" | "sensor" | "force"; force: number; time: number }
  | { kind: "sensor"; sensor: Id; part: Id; speed: number; time: number }
  | { kind: "chamber-fired"; chamber: Id; time: number }
  | { kind: "wall-unsealed"; chamber: Id; part: Id; time: number }
  | { kind: "vent-opened"; chamber: Id; vent: number; by: "wall" | "sensor"; time: number }
  | { kind: "vent-closed"; chamber: Id; vent: number; time: number }
  | { kind: "port-opened"; chamber: Id; port: number; time: number }
  /** choque entre duas peças com velocidade de aproximação acima do limiar (som e faíscas, mm/s) */
  | { kind: "impact"; a: Id; b: Id; speed: number; point: Vec2; time: number };

export interface Snapshot {
  /** s simulados desde a compilação */
  time: number;
  steps: number;
  parts: Record<Id, PartPose>;
  links: Record<Id, LinkState>;
  /** eventos do último passo */
  events: EngineEvent[];
}

export interface EngineMeta {
  /** id curto: planck, rapier, rapier-det, box2d */
  id: string;
  name: string;
  version: string;
  /** como o motor itera cada passo (registrado no comparativo) */
  iterations: string;
}

/** Diagnóstico de um passo (teste de abuso), unidades da cena. */
export interface EngineProbe {
  /** energia cinética das peças móveis, mJ */
  kinetic: number;
  /** energia potencial: gravidade (relativa à pose desenhada) e molas (mola, trilho, torção, suporte elástico), mJ */
  potential: number;
  /** maior velocidade do centro de massa de uma peça móvel, mm/s (com `region`, só das que estão dentro dela) */
  maxSpeed: number;
  /** peças móveis com o centro fora de `region` (caíram da cena) */
  outside: number;
  /** maior desvio transversal de um trilho ou de um rasgo em junta, mm */
  railGap: number;
  /** maior passagem de um trilho ou rasgo em junta além do curso, mm */
  railOver: number;
  /** algum valor de corpo não finito */
  nan: boolean;
}

export interface EngineAdapter {
  readonly meta: EngineMeta;
  compile(scene: Scene, options: CompileOptions): CompileReport;
  /** Avança `dt` segundos num passo só (o passo fixo de 1/240 s fica em src/sim). */
  step(dt: number): void;
  snapshot(): Snapshot;
  /** Pose de uma peça, sem montar o snapshot inteiro. */
  pose(partId: Id): PartPose | null;
  dragStart(partId: Id, pointMm: Vec2): boolean;
  dragMove(pointMm: Vec2): void;
  dragEnd(): void;
  /** Maior penetração entre peças no último passo, mm. */
  contactsDepthMax(): number;
  /** Active contact pairs and their layer masks (diagnostics only). */
  contactPairs?(): { a: Id; b: Id; bitsA: number; bitsB: number }[];
  /** O contato mais fundo do último passo e as duas peças (diagnóstico; só o motor do app). */
  contactsDeepest?(): { depth: number; a: Id; b: Id } | null;
  /** Muda a velocidade-alvo do motor de um eixo (rad/s). */
  setMotorSpeed(linkId: Id, speed: number): void;
  /** Impõe velocidade a uma peça (mm/s, rad/s). Usado por roteiros de teste. */
  setVelocity(partId: Id, v: Vec2, omega: number): void;
  /** Força constante numa peça (N, no mundo), aplicada no ponto local `at` até ser trocada; null tira. */
  setForce(partId: Id, force: Vec2 | null, at?: Vec2): void;
  /** Acende uma câmara (como o sensor). */
  ignite(linkId: Id): boolean;
  release?(linkId: Id): void;
  /** Abre ou fecha a válvula de um respiro. */
  setVent(linkId: Id, vent: number, open: boolean): void;
  /** Diagnóstico do estado atual (energia, folgas, velocidade); só o motor do app. */
  probe?(region?: [number, number, number, number]): EngineProbe;
  velocity?(part: Id): { x: number; y: number; omega: number } | null;
  reaction?(link: Id): { force: number; torque: number } | null;
  clearance?(a: Id, b: Id): number | null;
  dispose(): void;
}

/** Entrada do registro de motores: carregamento sob demanda. */
export interface EngineEntry {
  id: string;
  label: string;
  load(): Promise<() => EngineAdapter>;
}
