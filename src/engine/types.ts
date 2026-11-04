import type { Id, Scene } from "@/model/types";
import type { Vec2 } from "@/geometry/vec";

/**
 * Interface comum dos motores de física (docs/arquitetura.md §2).
 *
 * Tudo que entra e sai está nas unidades da cena: mm, g, s, rad. Só o
 * adaptador conhece a escala interna do motor (`unitMm` = mm por unidade).
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

export interface LinkState {
  kind: string;
  /** eixo: ângulo relativo à pose desenhada (rad) e velocidade (rad/s) */
  angle?: number;
  speed?: number;
  /** trilho: deslocamento ao longo do eixo (mm) */
  translation?: number;
  /** mola: comprimento atual (mm) */
  length?: number;
  /** câmara: gás (g·mm²/s²), pressão (g/(mm·s²)), disparada, gás escapou */
  gas?: number;
  pressure?: number;
  fired?: boolean;
  vented?: boolean;
  /** sensor: quantas vezes disparou */
  count?: number;
  /** distância entre os dois pontos da junta (mm) — mede a abertura do eixo */
  gap?: number;
}

export type EngineEvent =
  | { kind: "sensor"; sensor: Id; part: Id; speed: number; time: number }
  | { kind: "chamber-fired"; chamber: Id; time: number }
  | { kind: "chamber-vented"; chamber: Id; exitSpeed: number; time: number };

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
  /** Muda a velocidade-alvo do motor de um eixo (rad/s). */
  setMotorSpeed(linkId: Id, speed: number): void;
  /** Impõe velocidade a uma peça (mm/s, rad/s). Usado por roteiros de teste. */
  setVelocity(partId: Id, v: Vec2, omega: number): void;
  dispose(): void;
}

/** Entrada do registro de motores: carregamento sob demanda. */
export interface EngineEntry {
  id: string;
  label: string;
  load(): Promise<() => EngineAdapter>;
}
