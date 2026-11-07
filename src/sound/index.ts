import { create } from "zustand";
import type { Engine, EngineDebug, PlayOpts, SfxChoice } from "./engine";
import { loadPrefs, savePrefs, type SoundPrefs } from "./prefs";
import { createGraph, onFirstGesture } from "./unlock";

/**
 * A porta de entrada do som para o resto do app (leve, carregada junto com a
 * interface). O motor de verdade (`engine.ts`, Web Audio) só chega por
 * `import()` dinâmico depois do primeiro gesto; até lá, e sem o motor, tudo
 * aqui é silêncio e não pede nenhum arquivo de /audio/.
 */

export type { PlayOpts, SfxChoice } from "./engine";
export type { SoundPrefs } from "./prefs";

/** O que a física e as ferramentas precisam para tocar (e o que os testes trocam por um espião). */
export interface SoundPlayer {
  play(choice: SfxChoice, opts?: PlayOpts): void;
  /** volume do chiado da vazão (0 a 1; 0 para) */
  setVent(level: number): void;
}

interface PrefsState {
  prefs: SoundPrefs;
  setPrefs(patch: Partial<SoundPrefs>): void;
}

/** Preferências de som, salvas no aparelho. */
export const useSoundPrefs = create<PrefsState>()((set, get) => ({
  prefs: loadPrefs(),
  setPrefs: (patch) => {
    const prefs = { ...get().prefs, ...patch };
    savePrefs(prefs);
    set({ prefs });
  },
}));

let engine: Engine | null = null;
let installed = false;
let cancelGesture: (() => void) | null = null;

function visibilityHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function onVisibility() {
  engine?.setHidden(visibilityHidden());
}

async function boot() {
  // o contexto e os tocadores nascem aqui, no gesto; o motor chega depois
  const graph = createGraph();
  if (!graph) return;
  const mod = await import("./engine");
  engine = mod.createEngine(graph, { prefs: useSoundPrefs.getState().prefs, hidden: visibilityHidden() });
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onVisibility);
}

export const sound: SoundPlayer & {
  /** liga a escuta do primeiro gesto (uma vez) */
  install(): void;
  /** o motor já chegou */
  readonly ready: boolean;
  debug(): EngineDebug | null;
  /** só para testes: troca o motor por outro */
  _use(e: Engine | null): void;
} = {
  install() {
    if (installed || typeof window === "undefined") return;
    installed = true;
    cancelGesture = onFirstGesture(() => {
      cancelGesture = null;
      void boot();
    });
  },
  play(choice, opts) {
    engine?.play(choice, opts);
  },
  setVent(level) {
    engine?.setVent(level);
  },
  get ready() {
    return engine !== null;
  },
  debug() {
    return engine?.debug() ?? null;
  },
  _use(e) {
    engine = e;
  },
};

// preferências → motor (música e efeitos ligam e desligam na hora)
useSoundPrefs.subscribe((s, prev) => {
  if (s.prefs !== prev.prefs) engine?.setPrefs(s.prefs);
});

export function _resetSoundForTests() {
  cancelGesture?.();
  cancelGesture = null;
  installed = false;
  engine = null;
}
