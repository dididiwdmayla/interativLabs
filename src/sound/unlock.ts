/**
 * O primeiro gesto e o grafo de áudio mínimo que ele precisa criar na hora.
 *
 * Os navegadores (o Safari do iPhone, sobretudo) só liberam o áudio a um
 * gesto: o contexto e os tocadores da música são criados e "acordados"
 * aqui, dentro do manipulador do gesto, e só então o motor (`engine.ts`)
 * chega por `import()` dinâmico. Antes do gesto nada é criado e nenhum
 * arquivo de /audio/ é pedido.
 *
 * Fora de `src/sound/` não existe `<audio>`, `new Audio()` nem
 * `AudioContext`.
 */

/** WAV mudo de 0 amostras: acorda o tocador no gesto sem pedir nada à rede. */
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export interface Deck {
  el: HTMLAudioElement;
  gain: GainNode;
}

export interface AudioGraph {
  ctx: AudioContext;
  /** tudo passa por aqui; o motor liga e desliga o som inteiro */
  master: GainNode;
  /** barramentos de música e de efeitos sob o master */
  musicBus: GainNode;
  effectsBus: GainNode;
  /** os dois tocadores da música, que se revezam na emenda do laço */
  decks: [Deck, Deck];
}

type AudioContextCtor = typeof AudioContext;

function contextClass(): AudioContextCtor | null {
  const w = globalThis as typeof globalThis & { webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Cria o contexto, os barramentos e os dois tocadores; a chamada precisa estar num gesto. */
export function createGraph(): AudioGraph | null {
  const Ctor = contextClass();
  if (!Ctor) return null;
  try {
    const ctx = new Ctor({ latencyHint: "interactive" });
    void ctx.resume().catch(() => {});
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const musicBus = ctx.createGain();
    const effectsBus = ctx.createGain();
    musicBus.connect(master);
    effectsBus.connect(master);
    const deck = (): Deck => {
      const el = document.createElement("audio");
      el.preload = "none";
      el.loop = false;
      // acorda o tocador no gesto (o Safari só deixa tocar de novo um tocador já tocado)
      el.muted = true;
      el.src = SILENT_WAV;
      void el.play()?.catch(() => {});
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(gain);
      gain.connect(musicBus);
      return { el, gain };
    };
    return { ctx, master, musicBus, effectsBus, decks: [deck(), deck()] };
  } catch {
    return null;
  }
}

const EVENTS = ["pointerdown", "touchend", "keydown", "click"] as const;

/** Chama `onGesture` uma vez, no primeiro gesto da pessoa. Devolve o cancelamento. */
export function onFirstGesture(onGesture: () => void): () => void {
  let done = false;
  const stop = () => {
    for (const e of EVENTS) window.removeEventListener(e, handler, true);
  };
  const handler = () => {
    if (done) return;
    done = true;
    stop();
    onGesture();
  };
  for (const e of EVENTS) window.addEventListener(e, handler, { capture: true, passive: true });
  return () => {
    done = true;
    stop();
  };
}
