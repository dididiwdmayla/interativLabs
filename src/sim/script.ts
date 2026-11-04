import type { Vec2 } from "@/geometry/vec";
import type { Id } from "@/model/types";

/**
 * Roteiro de uma cena de teste (`scenes/fixtures/<grupo>/<nome>.test.json`):
 * execuções com entradas no tempo e afirmações sobre o que a física fez.
 * Tempos em s a partir da compilação; pontos em mm; ângulos em rad; forças em N.
 */

export type ScriptInput =
  /** arrasta o ponto `from` (mundo) da peça até `to` entre t0 e t1; solta em `release` */
  | { kind: "drag"; part: Id; from: Vec2; to: Vec2; t0: number; t1: number; release: number }
  /** arrasta por uma sequência de pontos, com tempo igual entre eles */
  | { kind: "dragPath"; part: Id; path: Vec2[]; t0: number; t1: number; release: number }
  /** muda a velocidade-alvo do motor de um eixo */
  | { kind: "motor"; link: Id; t: number; speed: number }
  /** impõe velocidade a uma peça */
  | { kind: "velocity"; part: Id; t: number; v: Vec2; omega: number }
  /** força constante (N, mundo) no ponto local `at`, de t0 a t1 */
  | { kind: "force"; part: Id; t0: number; t1: number; f: Vec2; at?: Vec2 }
  /** acende a câmara */
  | { kind: "ignite"; link: Id; t: number }
  /** abre ou fecha a válvula de um respiro */
  | { kind: "vent"; link: Id; vent: number; t: number; open: boolean };

/** Grandeza medida a cada passo. */
export type Quantity =
  /** coordenada da pose da peça (mm, rad) */
  | { part: Id; field: "x" | "y" | "angle" }
  /** deslocamento de um ponto local da peça desde o início, projetado no eixo `along` (mundo) */
  | { part: Id; along: Vec2; at?: Vec2 }
  /** distância de um ponto local da peça até onde ele estava no início */
  | { part: Id; disp: true; at?: Vec2 }
  /** campo numérico do estado da ligação, com caminho (ex.: "walls.0.impulse") */
  | { link: Id; field: string }
  /** distância entre dois pontos (peça null = mundo) */
  | { dist: [{ part: Id | null; at: Vec2 }, { part: Id | null; at: Vec2 }] }
  /** P·V^γ da câmara (kPa·mm³^γ) */
  | { pv: Id; gamma: number }
  /** força do gás na parede (N) dividida por (P − p0)·A da câmara: 1 quando bate */
  | { gasForce: Id; wall: number; p0: number }
  /** razão entre duas grandezas */
  | { div: [Quantity, Quantity] }
  /** valor absoluto */
  | { abs: Quantity };

interface Base {
  label: string;
  /** falha esperada: o motivo, com os números (o teste fica marcado) */
  expectedFailure?: string;
}

export type ScriptAssertion = Base &
  (
    | { kind: "range"; q: Quantity; from?: number; to?: number; min?: number; max?: number }
    | { kind: "at"; q: Quantity; t: number; min?: number; max?: number }
    | { kind: "mean"; q: Quantity; from: number; to: number; min?: number; max?: number }
    | { kind: "span"; q: Quantity; from?: number; to?: number; min?: number; max?: number }
    /** (máx − mín) / |média| na janela */
    | { kind: "relSpan"; q: Quantity; from?: number; to?: number; max: number }
    /** período médio das passagens pela média, com erro relativo */
    | { kind: "period"; q: Quantity; from: number; to: number; expected: number; tol: number }
    /** a amplitude de cada ciclo cai em relação à anterior; termina abaixo de `final` */
    | { kind: "decays"; q: Quantity; from: number; to: number; final: number }
    /** razão a/b no instante t, ou soma a+b relativa a |a| */
    | {
        kind: "compare";
        a: Quantity;
        b: Quantity;
        t: number;
        op: "ratio" | "sumRel";
        min?: number;
        max?: number;
      }
    /** quantos eventos do tipo, com o campo `match` igual */
    | { kind: "events"; event: string; match?: Record<string, string | number>; min?: number; max?: number }
    /** a grandeza só muda (|q − q₀| > limiar) depois do primeiro evento */
    | {
        kind: "onlyAfter";
        q: Quantity;
        threshold: number;
        event: string;
        match?: Record<string, string | number>;
      }
    /** depois do evento, a grandeza cai abaixo de `fraction` do pico em até `within` s */
    | {
        kind: "dropsAfter";
        q: Quantity;
        event: string;
        match?: Record<string, string | number>;
        fraction: number;
        within: number;
      }
    | { kind: "maxPenetration"; max: number; from?: number }
    /** enquanto a condição vale (pelo menos `minSteps` passos), q fica entre min e max */
    | {
        kind: "while";
        cond: Quantity;
        condMin?: number;
        condMax?: number;
        q: Quantity;
        min?: number;
        max?: number;
        minSteps?: number;
        from?: number;
        to?: number;
      }
    /** nenhuma das peças se afasta mais que `max` mm da posição inicial na janela */
    | { kind: "maxDisp"; parts: Id[] | "dynamic"; max: number; from?: number; to?: number }
    /** o campo de nenhuma das ligações passa de `max` (ex.: abertura dos eixos) */
    | { kind: "maxField"; links: Id[] | "axles"; field: string; max: number }
  );

export interface ScriptRun {
  name: string;
  duration: number;
  /** muda a posição inicial de peças antes de compilar */
  override?: Record<Id, { x?: number; y?: number; angle?: number }>;
  /** muda campos de ligações antes de compilar (ex.: o modo de uma mola) */
  patch?: Record<Id, Record<string, unknown>>;
  inputs: ScriptInput[];
  assertions: ScriptAssertion[];
}

export interface FixtureScript {
  id: string;
  title: string;
  /** grupo da lista do laboratório */
  group: string;
  /** arquivo da cena v2, ao lado */
  scene: string;
  notes?: string;
  runs: ScriptRun[];
  /** execução mostrada no laboratório (padrão 0) */
  labRun?: number;
  /** enquadramento no laboratório: [x, y, largura, altura] em mm */
  view?: [number, number, number, number];
}
