import { audio, sfxIds, type AudioEntry, type SfxId } from "@/assets/audio-registry";
import { equalPowerCurve, pickVariant, planStream, ventSegment } from "./loop";
import type { SoundPrefs } from "./prefs";
import type { AudioGraph, Deck } from "./unlock";

/**
 * Motor de som enxuto (versão pequena do motor do interativMind): dois
 * barramentos, música e efeitos, sob um master. Chega por `import()` dinâmico
 * só depois do primeiro gesto (src/sound/index.ts).
 *
 * - Música: dois `<audio>` que se revezam. A primeira passada vai do começo
 *   do arquivo ao fim do trecho de laço; depois só o trecho repete, com
 *   crossfade de potência constante na emenda.
 * - Efeitos: buffers decodificados, uma voz por toque, variações sorteadas
 *   sem repetir a anterior, tom em centésimos de semitom.
 * - Vazão de gás: o chiado em laço (segmentos sobrepostos com crossfade de
 *   20 ms), volume pela vazão e 0,1 s de fade ao parar.
 * - Aba fora de foco: o master cai, tudo pausa e o contexto suspende.
 */

export type SfxChoice = SfxId | readonly SfxId[];

export interface PlayOpts {
  /** volume de 0 a 1 (multiplica o ganho fino do registro) */
  gain?: number;
  /** tom, em centésimos de semitom */
  cents?: number;
}

export const MUSIC_ID = "music-bench";
export const VENT_ID: SfxId = "sfx-vent-loop";
/** efeitos que só têm uma voz de cada vez (a nova toma o lugar da antiga) */
export const SINGLE_VOICE: ReadonlySet<SfxId> = new Set<SfxId>(["sfx-mode"]);
export const MAX_VOICES = 24;
/** entrada da música no primeiro gesto, s */
export const MUSIC_FADE_IN = 2;
export const BUS_RAMP = 0.15;
/** o master cai/sobe quando a aba sai/volta, s */
export const HIDE_FADE = 0.25;
export const SHOW_FADE = 0.6;
export const VENT_STOP_FADE = 0.1;
export const VENT_START_FADE = 0.04;
const TICK_MS = 250;
/** o próximo tocador se prepara este tempo antes da emenda, s */
const PREPARE_LEAD = 4;
/** e começa a tocar este tempo antes (latência do play), s */
const START_LEAD = 0.35;
const LOAD_DELAY_MS = 400;

export interface PlayedRecord {
  id: SfxId;
  gain: number;
  cents: number;
  at: number;
}

export interface EngineDebug {
  state: AudioContextState;
  hidden: boolean;
  prefs: SoundPrefs;
  music: { playing: boolean; time: number; crossfading: boolean; started: boolean };
  vent: { on: boolean; level: number };
  voices: number;
  voicesOf: Record<string, number>;
  loaded: SfxId[];
  played: PlayedRecord[];
}

export interface Engine {
  setPrefs(prefs: SoundPrefs): void;
  setHidden(hidden: boolean): void;
  play(choice: SfxChoice, opts?: PlayOpts): void;
  /** volume do chiado da vazão de 0 a 1 (0 para) */
  setVent(level: number): void;
  debug(): EngineDebug;
  dispose(): void;
}

interface Voice {
  id: SfxId;
  src: AudioBufferSourceNode;
  gain: GainNode;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function scaled(curve: Float32Array, k: number): Float32Array {
  const out = new Float32Array(curve.length);
  for (let i = 0; i < curve.length; i++) out[i] = (curve[i] ?? 0) * k;
  return out;
}

export function createEngine(
  graph: AudioGraph,
  init: { prefs: SoundPrefs; hidden: boolean; fetchAudio?: (src: string) => Promise<ArrayBuffer> },
): Engine {
  const { ctx, master, musicBus, effectsBus } = graph;
  const fetchAudio =
    init.fetchAudio ??
    (async (src: string) => {
      const res = await fetch(src);
      if (!res.ok) throw new Error(String(res.status));
      return res.arrayBuffer();
    });
  let prefs = init.prefs;
  let hidden = init.hidden;
  let disposed = false;

  // ── barramentos ───────────────────────────────────────────────────────────
  const ramp = (g: GainNode, to: number, dur: number) => {
    const now = ctx.currentTime;
    try {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      if (dur > 0) g.gain.linearRampToValueAtTime(to, now + dur);
      else g.gain.setValueAtTime(to, now);
    } catch {
      g.gain.value = to;
    }
  };
  musicBus.gain.value = prefs.music ? 1 : 0;
  effectsBus.gain.value = prefs.effects ? 1 : 0;
  const quiet = () => hidden;

  // ── música ────────────────────────────────────────────────────────────────
  const musicEntry: AudioEntry = audio[MUSIC_ID];
  const plan = planStream(musicEntry);
  let main: Deck | null = null;
  let prepared: Deck | null = null;
  let crossfading = false;
  let musicStarted = false;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let tick: ReturnType<typeof setInterval> | null = null;
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, Math.max(0, ms)));
  const other = (d: Deck) => (d === graph.decks[0] ? graph.decks[1] : graph.decks[0]);
  const safePlay = (d: Deck) => {
    try {
      void d.el.play()?.catch(() => {});
    } catch {
      // sem permissão ou sem fonte: este trecho fica mudo
    }
  };
  const load = (d: Deck, at: number) => {
    d.el.muted = false;
    if (!d.el.src.endsWith(musicEntry.src)) d.el.src = musicEntry.src;
    d.el.preload = "auto";
    try {
      d.el.currentTime = at;
    } catch {
      // antes dos metadados o navegador guarda a posição pedida
    }
  };
  const curve = (d: Deck, kind: "in" | "out", at: number, dur: number) => {
    try {
      d.gain.gain.setValueCurveAtTime(scaled(equalPowerCurve(kind), musicEntry.gain), at, dur);
    } catch {
      d.gain.gain.value = kind === "in" ? musicEntry.gain : 0;
    }
  };
  const holdAt = (d: Deck, v: number) => {
    const now = ctx.currentTime;
    d.gain.gain.cancelScheduledValues(now);
    d.gain.gain.setValueAtTime(v, now);
  };

  function startMusic() {
    if (musicStarted || disposed) return;
    musicStarted = true;
    main = graph.decks[0];
    load(main, 0);
    holdAt(main, 0);
    curve(main, "in", ctx.currentTime, MUSIC_FADE_IN);
    safePlay(main);
  }

  function settle() {
    // termina uma emenda em andamento antes de pausar ou voltar
    timers.forEach(clearTimeout);
    timers = [];
    if (crossfading && main && prepared) {
      try {
        main.el.pause();
      } catch {
        // nada tocando
      }
      holdAt(main, 0);
      main = prepared;
      holdAt(main, musicEntry.gain);
    }
    crossfading = false;
    prepared = null;
  }

  function musicTick() {
    if (!plan || !main || crossfading || quiet() || !prefs.music) return;
    const deck = main;
    if (deck.el.paused) return;
    const pos = deck.el.currentTime;
    if (!Number.isFinite(pos)) return;
    const next = other(deck);
    if (pos >= plan.fadeAt - PREPARE_LEAD && prepared !== next) {
      load(next, plan.entryAt);
      holdAt(next, 0);
      prepared = next;
    }
    if (pos < plan.fadeAt - START_LEAD || prepared !== next) return;
    const delay = Math.max(0, plan.fadeAt - pos);
    const at = ctx.currentTime + delay;
    crossfading = true;
    holdAt(deck, musicEntry.gain);
    curve(next, "in", at, plan.crossfade);
    curve(deck, "out", at, plan.crossfade);
    later(delay * 1000 - 20, () => safePlay(next));
    later((delay + plan.crossfade) * 1000 + 80, () => {
      try {
        deck.el.pause();
      } catch {
        // já parado
      }
      main = next;
      prepared = null;
      crossfading = false;
    });
  }

  function pauseMusic() {
    settle();
    for (const d of graph.decks) {
      try {
        d.el.pause();
      } catch {
        // nada tocando
      }
    }
  }

  function resumeMusic() {
    if (!musicStarted) startMusic();
    else if (main) safePlay(main);
  }

  let musicPauseTimer: ReturnType<typeof setTimeout> | null = null;
  function applyMusicPref(on: boolean) {
    if (musicPauseTimer) clearTimeout(musicPauseTimer);
    musicPauseTimer = null;
    ramp(musicBus, on ? 1 : 0, BUS_RAMP);
    if (on) {
      if (!quiet()) resumeMusic();
    } else {
      musicPauseTimer = setTimeout(
        () => {
          if (!prefs.music) pauseMusic();
        },
        BUS_RAMP * 1000 + 60,
      );
    }
  }

  // ── efeitos ───────────────────────────────────────────────────────────────
  const buffers = new Map<SfxId, AudioBuffer>();
  const voices: Voice[] = [];
  const lastVariant = new Map<string, number>();
  const played: PlayedRecord[] = [];
  let loadStarted = false;

  function loadEffects() {
    if (loadStarted) return;
    loadStarted = true;
    const queue = sfxIds.filter((id) => audio[id].on === "S");
    const idle = (cb: () => void) => {
      const w = globalThis as typeof globalThis & { requestIdleCallback?: (cb: () => void) => number };
      if (w.requestIdleCallback) w.requestIdleCallback(cb);
      else setTimeout(cb, 30);
    };
    const next = () => {
      if (disposed) return;
      const id = queue.shift();
      if (!id) return;
      fetchAudio(audio[id].src)
        .then((data) => ctx.decodeAudioData(data))
        .then((buffer) => buffers.set(id, buffer))
        .catch(() => {
          // ausente ou ilegível: este efeito fica mudo
        })
        .finally(() => idle(next));
    };
    setTimeout(() => idle(next), LOAD_DELAY_MS);
  }

  const canPlayEffects = () => !disposed && !quiet() && prefs.effects && ctx.state === "running";

  function stopVoice(v: Voice, fade = 0.03) {
    const i = voices.indexOf(v);
    if (i >= 0) voices.splice(i, 1);
    try {
      const now = ctx.currentTime;
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(v.gain.gain.value, now);
      v.gain.gain.linearRampToValueAtTime(0, now + fade);
      v.src.stop(now + fade + 0.01);
    } catch {
      // já terminou
    }
  }

  function play(choice: SfxChoice, opts: PlayOpts = {}) {
    if (!canPlayEffects()) return;
    let id: SfxId;
    if (typeof choice === "string") id = choice;
    else {
      const key = choice.join("|");
      const i = pickVariant(choice.length, lastVariant.get(key) ?? null);
      lastVariant.set(key, i);
      const picked = choice[i];
      if (!picked) return;
      id = picked;
    }
    const buffer = buffers.get(id);
    if (!buffer) return;
    if (SINGLE_VOICE.has(id)) for (const v of voices.filter((x) => x.id === id)) stopVoice(v);
    const oldest = voices[0];
    if (oldest && voices.length >= MAX_VOICES) stopVoice(oldest, 0.01);
    const level = clamp01(opts.gain ?? 1) * audio[id].gain;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      if (opts.cents) src.detune.value = opts.cents;
      const gain = ctx.createGain();
      gain.gain.value = level;
      src.connect(gain);
      gain.connect(effectsBus);
      const voice: Voice = { id, src, gain };
      voices.push(voice);
      src.onended = () => {
        const i = voices.indexOf(voice);
        if (i >= 0) voices.splice(i, 1);
        src.disconnect();
        gain.disconnect();
      };
      src.start();
      played.push({ id, gain: level, cents: opts.cents ?? 0, at: ctx.currentTime });
      if (played.length > 200) played.shift();
    } catch {
      // um efeito que falha nunca derruba o fluxo
    }
  }

  // ── vazão de gás ──────────────────────────────────────────────────────────
  interface Vent {
    gain: GainNode;
    level: number;
    nextAt: number;
    timer: ReturnType<typeof setInterval> | null;
    sources: AudioBufferSourceNode[];
  }
  let vent: Vent | null = null;
  const ventLoop = audio[VENT_ID].loop;

  function scheduleSegment(v: Vent, at: number) {
    const buffer = buffers.get(VENT_ID);
    if (!buffer || !ventLoop) return;
    const seg = ventSegment(ventLoop);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    try {
      g.gain.setValueCurveAtTime(equalPowerCurve("in", 16), at, seg.crossfade);
      g.gain.setValueCurveAtTime(equalPowerCurve("out", 16), at + seg.cycle, seg.crossfade);
    } catch {
      g.gain.value = 1;
    }
    src.connect(g);
    g.connect(v.gain);
    src.start(at, seg.offset, seg.duration);
    v.sources.push(src);
    src.onended = () => {
      const i = v.sources.indexOf(src);
      if (i >= 0) v.sources.splice(i, 1);
      src.disconnect();
      g.disconnect();
    };
  }

  function stopVent(fade = VENT_STOP_FADE) {
    const v = vent;
    if (!v) return;
    vent = null;
    if (v.timer) clearInterval(v.timer);
    const now = ctx.currentTime;
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(v.level, now);
      v.gain.gain.linearRampToValueAtTime(0, now + fade);
    } catch {
      v.gain.gain.value = 0;
    }
    setTimeout(
      () => {
        for (const s of v.sources) {
          try {
            s.stop();
          } catch {
            // já terminou
          }
        }
        v.gain.disconnect();
      },
      fade * 1000 + 40,
    );
  }

  function setVent(level: number) {
    const lv = clamp01(level);
    if (lv <= 0 || !canPlayEffects()) {
      stopVent();
      return;
    }
    const target = lv * audio[VENT_ID].gain;
    if (vent) {
      const now = ctx.currentTime;
      try {
        vent.gain.gain.cancelScheduledValues(now);
        vent.gain.gain.setValueAtTime(vent.level, now);
        vent.gain.gain.linearRampToValueAtTime(target, now + 0.08);
      } catch {
        vent.gain.gain.value = target;
      }
      vent.level = target;
      return;
    }
    if (!buffers.has(VENT_ID)) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(effectsBus);
    const v: Vent = { gain, level: target, nextAt: ctx.currentTime + 0.02, timer: null, sources: [] };
    const cycle = ventLoop ? ventSegment(ventLoop).cycle : 1;
    const pump = () => {
      while (v.nextAt < ctx.currentTime + 0.4) {
        scheduleSegment(v, v.nextAt);
        v.nextAt += cycle;
      }
    };
    pump();
    v.timer = setInterval(pump, 100);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(target, now + VENT_START_FADE);
    vent = v;
  }

  // ── aba fora de foco ──────────────────────────────────────────────────────
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  function setHidden(h: boolean) {
    if (h === hidden || disposed) return;
    hidden = h;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    if (h) {
      stopVent(0.05);
      ramp(master, 0, HIDE_FADE);
      hideTimer = setTimeout(
        () => {
          hideTimer = null;
          if (!hidden) return;
          pauseMusic();
          void ctx.suspend().catch(() => {});
        },
        HIDE_FADE * 1000 + 30,
      );
    } else {
      void ctx.resume().catch(() => {});
      if (prefs.music) resumeMusic();
      ramp(master, 1, SHOW_FADE);
    }
  }

  // ── início ────────────────────────────────────────────────────────────────
  tick = setInterval(musicTick, TICK_MS);
  loadEffects();
  if (!hidden) {
    ramp(master, 1, 0.05);
    if (prefs.music) startMusic();
  } else {
    void ctx.suspend().catch(() => {});
  }

  return {
    setPrefs(next) {
      const before = prefs;
      prefs = next;
      if (next.effects !== before.effects) {
        ramp(effectsBus, next.effects ? 1 : 0, BUS_RAMP);
        if (!next.effects) stopVent();
      }
      if (next.music !== before.music) applyMusicPref(next.music);
    },
    setHidden,
    play,
    setVent,
    debug() {
      const voicesOf: Record<string, number> = {};
      for (const v of voices) voicesOf[v.id] = (voicesOf[v.id] ?? 0) + 1;
      return {
        state: ctx.state,
        hidden,
        prefs,
        music: {
          playing: !!main && !main.el.paused,
          time: main?.el.currentTime ?? 0,
          crossfading,
          started: musicStarted,
        },
        vent: { on: !!vent, level: vent?.level ?? 0 },
        voices: voices.length,
        voicesOf,
        loaded: [...buffers.keys()],
        played: played.slice(),
      };
    },
    dispose() {
      disposed = true;
      if (tick) clearInterval(tick);
      if (hideTimer) clearTimeout(hideTimer);
      if (musicPauseTimer) clearTimeout(musicPauseTimer);
      stopVent(0);
      pauseMusic();
      for (const v of [...voices]) stopVoice(v, 0);
      void ctx.close().catch(() => {});
    },
  };
}
