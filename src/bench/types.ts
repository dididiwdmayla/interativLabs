import type { Vec2 } from "@/geometry/vec";
import type { Id } from "@/model/types";

/**
 * Roteiro de medição (`scenes/fixtures/bench/NN-nome.bench.json`).
 * Tempos em s, a partir da compilação; pontos em mm; ângulos em rad.
 */

export type BenchInput =
  /** arrasta o ponto `from` da peça até `to` entre t0 e t1; solta em `release` */
  | { kind: "drag"; part: Id; from: Vec2; to: Vec2; t0: number; t1: number; release: number }
  /** muda a velocidade-alvo do motor de um eixo */
  | { kind: "motor"; link: Id; t: number; speed: number }
  /** impõe velocidade a uma peça */
  | { kind: "velocity"; part: Id; t: number; v: Vec2; omega: number };

export type BenchAssertion =
  /** nenhuma das peças se afasta mais que `max` mm da posição em `from` até `to` */
  | { kind: "maxDisplacement"; label: string; parts: Id[] | "dynamic"; from: number; to: number; max: number }
  /** o sensor disparou exatamente `equals` vezes no fim */
  | { kind: "sensorCount"; label: string; sensor: Id; equals: number }
  /** a peça passa de `value` mm ao longo de `axis` em até `within` s depois do 1º disparo do sensor */
  | {
      kind: "crossAfterSensor";
      label: string;
      part: Id;
      sensor: Id;
      axis: Vec2;
      value: number;
      within: number;
    }
  /** valor de uma ligação no instante `at` dentro de [min, max] */
  | {
      kind: "linkAt";
      label: string;
      link: Id;
      field: "angle" | "translation";
      at: number;
      min?: number;
      max?: number;
    }
  /** a peça está a até `tol` mm da posição inicial no instante `at` */
  | { kind: "returnsTo"; label: string; part: Id; at: number; tol: number }
  /** razão entre giros de eixos em janelas de [from, to], erro relativo máximo */
  | {
      kind: "ratio";
      label: string;
      base: Id;
      links: { link: Id; ratio: number }[];
      from: number;
      to: number;
      windows: number;
      maxError: number;
    }
  /** o eixo não gira mais que `max` rad a partir de `from` */
  | { kind: "maxRotation"; label: string; link: Id; from: number; to: number; max: number }
  /** nenhum eixo abre mais que `max` mm */
  | { kind: "jointGap"; label: string; links: Id[] | "axles"; max: number }
  /** maior penetração entre peças abaixo de `max` mm */
  | { kind: "maxPenetration"; label: string; max: number }
  /** a peça nunca passa do plano (ponto, normal): (p − ponto)·normal ≤ 0 */
  | { kind: "neverCrosses"; label: string; part: Id; point: Vec2; normal: Vec2 }
  /** pinhão e cremalheira: em cada trecho entre trocas de motor, deslocamento = raio × ângulo */
  | {
      kind: "rackFollows";
      label: string;
      axle: Id;
      slider: Id;
      radius: number;
      motor: Id;
      maxError: number;
      /** fração mínima do giro comandado em cada trecho (não trava) */
      minTurn: number;
    }
  /** tremor (RMS em torno da média) das peças na janela, mm */
  | { kind: "jitter"; label: string; parts: Id[] | "dynamic"; from: number; to: number; max: number };

export interface BenchRun {
  name: string;
  duration: number;
  /** muda a posição inicial de peças antes de compilar */
  override?: Record<Id, { x?: number; y?: number; angle?: number }>;
  inputs: BenchInput[];
  assertions: BenchAssertion[];
}

export interface BenchScript {
  id: string;
  title: string;
  /** arquivo da cena v1, ao lado */
  scene: string;
  runs: BenchRun[];
  /** peças que deveriam estar paradas, para o tremor (run 0) */
  still?: { run: number; parts: Id[] | "dynamic"; from: number; to: number };
  /** escalas extras (mm por unidade) em que a cena também roda */
  extraScales?: number[];
  notes?: string;
}

export interface AssertionResult {
  label: string;
  pass: boolean;
  /** valor medido, para o relatório */
  value: string;
  run: string;
}

export interface SceneResult {
  scene: string;
  title: string;
  engine: string;
  unitMm: number;
  pass: boolean;
  failed: string[];
  assertions: AssertionResult[];
  steps: number;
  /** ms por passo */
  stepMedian: number;
  stepP95: number;
  timing: "passo" | "lote de 10";
  /** mm */
  maxDepth: number;
  /** mm, RMS; null quando a cena não tem peças paradas */
  jitter: number | null;
  hash: string;
  hashRepeat: string;
  deterministic: boolean;
  warnings: string[];
  /** expectedFailure do teste, se marcada */
  wallMs: number;
}

export interface BenchReport {
  createdAt: string;
  environment: {
    kind: "node" | "browser";
    userAgent: string;
    hardwareConcurrency: number | null;
    timerResolutionUs: number;
  };
  unitMm: number;
  engines: { id: string; name: string; version: string; iterations: string }[];
  results: SceneResult[];
  /** tamanho dos pacotes, quando medido no build */
  bundle?: Record<string, { js: number; wasm: number; gzip: number }>;
}
