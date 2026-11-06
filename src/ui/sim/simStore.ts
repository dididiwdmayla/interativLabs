import { create } from "zustand";
import type { Vec2 } from "@/geometry/vec";
import type { Id } from "@/model/types";
import { DEFAULT_SPEED, type Speed } from "@/sim/pacing";

/**
 * Estado da simulação visível na interface. O laço e o motor ficam no
 * controlador (src/ui/sim/controller.ts), carregado só ao entrar no Simular.
 */

export { SPEEDS, type Speed } from "@/sim/pacing";

export interface TimelineState {
  /** s: início e fim da janela gravada */
  oldest: number;
  latest: number;
  /** instante mostrado (cabeça de leitura) */
  shown: number;
  /** marcas em brasa: instantes (s) */
  events: number[];
}

export interface SimControl {
  togglePause(): void;
  stepOnce(): void;
  setSpeed(s: Speed): void;
  restart(): void;
  /** o dedo na peça (mundo, mm); devolve se pegou */
  dragAt(p: Vec2): Id | null;
  releaseAt(p: Vec2): boolean;
  dragMove(p: Vec2): void;
  dragEnd(): void;
  /** arrastar a régua: mostra o quadro gravado do instante t (s) */
  scrub(t: number): void;
  /** mostra o quadro misturado de um instante qualquer (fração de passo), parado (capturas) */
  preview(t: number): void;
  timeline(): TimelineState;
  /** ouvinte chamado a cada quadro desenhado (null tira) */
  setFrameListener(fn: ((t: TimelineState) => void) | null): void;
  /** volta a desenhar o quadro atual (depois de remontar a cena) */
  redraw(): void;
  dispose(): void;
}

interface SimState {
  status: "off" | "loading" | "ready" | "error";
  error: string | null;
  paused: boolean;
  speed: Speed;
  /** reexecução que passou de 150 ms */
  recalculating: boolean;
  /** a cabeça de leitura está fora do fim (a régua foi arrastada) */
  scrubbed: boolean;
  ctl: SimControl | null;
  set(p: Partial<Omit<SimState, "set">>): void;
}

export const useSimStore = create<SimState>()((set) => ({
  status: "off",
  error: null,
  paused: false,
  speed: DEFAULT_SPEED,
  recalculating: false,
  scrubbed: false,
  ctl: null,
  set: (p) => set(p),
}));
