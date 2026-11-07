import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { audio } from "@/assets/audio-registry";
import { createEngine, type Engine } from "./engine";
import { planStream } from "./loop";
import type { AudioGraph } from "./unlock";

/** Web Audio de mentira: só o que o motor usa, com a conta do que foi tocado. */
class Param {
  value = 0;
  setValueAtTime(v: number) {
    this.value = v;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
  }
  setValueCurveAtTime(curve: Float32Array) {
    this.value = curve[curve.length - 1]!;
  }
  cancelScheduledValues() {}
}
class Node {
  gain = new Param();
  detune = new Param();
  connect() {}
  disconnect() {}
}
class Source extends Node {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  started = 0;
  stopped = false;
  start() {
    this.started++;
  }
  stop() {
    this.stopped = true;
  }
}
class Ctx {
  currentTime = 0;
  state: AudioContextState = "running";
  destination = new Node();
  sources: Source[] = [];
  suspends = 0;
  resumes = 0;
  createGain() {
    return new Node();
  }
  createBufferSource() {
    const s = new Source();
    this.sources.push(s);
    return s;
  }
  decodeAudioData() {
    return Promise.resolve({ duration: 1 });
  }
  resume() {
    this.resumes++;
    this.state = "running";
    return Promise.resolve();
  }
  suspend() {
    this.suspends++;
    this.state = "suspended";
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}
class El {
  src = "";
  currentTime = 0;
  paused = true;
  muted = false;
  preload = "";
  plays = 0;
  play() {
    this.paused = false;
    this.plays++;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

function setup(prefs = { music: true, effects: true }, hidden = false) {
  const ctx = new Ctx();
  const decks = [
    { el: new El(), gain: new Node() },
    { el: new El(), gain: new Node() },
  ];
  const graph = {
    ctx,
    master: new Node(),
    musicBus: new Node(),
    effectsBus: new Node(),
    decks,
  } as unknown as AudioGraph;
  const requested: string[] = [];
  const engine = createEngine(graph, {
    prefs,
    hidden,
    fetchAudio: (src) => {
      requested.push(src);
      return Promise.resolve(new ArrayBuffer(8));
    },
  });
  return { ctx, decks, engine, requested };
}

let e: Engine | null = null;
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  e?.dispose();
  e = null;
  vi.useRealTimers();
});

async function loaded(prefs?: { music: boolean; effects: boolean }, hidden = false) {
  const s = setup(prefs, hidden);
  e = s.engine;
  await vi.advanceTimersByTimeAsync(3000);
  return s;
}

describe("motor de som", () => {
  it("a música começa do começo do arquivo e só os efeitos da Parte S são carregados", async () => {
    const s = await loaded();
    expect(s.decks[0]!.el.src.endsWith(audio["music-bench"].src)).toBe(true);
    expect(s.decks[0]!.el.currentTime).toBe(0);
    expect(s.decks[0]!.el.paused).toBe(false);
    const wanted = Object.values(audio).filter((a) => a.kind === "sfx" && a.on === "S").length;
    expect(s.requested).toHaveLength(wanted);
    expect(s.requested).not.toContain("/audio/sfx-case-drop-1.wav");
    expect(s.engine.debug().loaded).toHaveLength(wanted);
  });

  it("com a música desligada ela não toca; ligando, entra", async () => {
    const s = await loaded({ music: false, effects: true });
    expect(s.decks[0]!.el.paused).toBe(true);
    s.engine.setPrefs({ music: true, effects: true });
    expect(s.decks[0]!.el.paused).toBe(false);
    s.engine.setPrefs({ music: false, effects: true });
    await vi.advanceTimersByTimeAsync(500);
    expect(s.decks[0]!.el.paused).toBe(true);
  });

  it("a emenda do laço: o outro tocador entra 2 s antes do início, quando o primeiro chega a fim − 2 s", async () => {
    const s = await loaded();
    const plan = planStream(audio["music-bench"])!;
    const main = s.decks[0]!.el;
    main.currentTime = plan.fadeAt - 0.3;
    await vi.advanceTimersByTimeAsync(300);
    expect(s.decks[1]!.el.currentTime).toBeCloseTo(plan.entryAt, 3);
    await vi.advanceTimersByTimeAsync(1500);
    expect(s.decks[1]!.el.paused).toBe(false);
    await vi.advanceTimersByTimeAsync(3500);
    expect(main.paused).toBe(true);
    expect(s.engine.debug().music.crossfading).toBe(false);
    // na volta seguinte o papel se inverte
    s.decks[1]!.el.currentTime = plan.fadeAt - 0.3;
    await vi.advanceTimersByTimeAsync(300);
    expect(main.currentTime).toBeCloseTo(plan.entryAt, 3);
  });

  it("variações sorteadas nunca repetem a anterior", async () => {
    const s = await loaded();
    const ids = ["sfx-impact-1", "sfx-impact-2", "sfx-impact-3"] as const;
    for (let i = 0; i < 200; i++) s.engine.play(ids);
    const played = s.engine.debug().played.map((p) => p.id);
    expect(played.length).toBeGreaterThan(100);
    for (let i = 1; i < played.length; i++) expect(played[i]).not.toBe(played[i - 1]);
  });

  it("alternar Montar/Testar dez vezes seguidas não acumula sons (uma voz de sfx-mode por vez)", async () => {
    const s = await loaded();
    for (let i = 0; i < 10; i++) {
      s.engine.play("sfx-mode");
      expect(s.engine.debug().voicesOf["sfx-mode"] ?? 0).toBeLessThanOrEqual(1);
    }
    expect(s.engine.debug().played.filter((p) => p.id === "sfx-mode")).toHaveLength(10);
  });

  it("efeitos desligados não tocam; voltam quando ligados", async () => {
    const s = await loaded({ music: true, effects: false });
    s.engine.play("sfx-stamp");
    expect(s.engine.debug().played).toHaveLength(0);
    s.engine.setPrefs({ music: true, effects: true });
    s.engine.play("sfx-stamp");
    expect(s.engine.debug().played.map((p) => p.id)).toEqual(["sfx-stamp"]);
  });

  it("volume e tom pedidos chegam ao efeito, multiplicados pelo ganho fino do registro", async () => {
    const s = await loaded();
    s.engine.play("sfx-gas", { gain: 0.5, cents: -40 });
    const p = s.engine.debug().played[0]!;
    expect(p.gain).toBeCloseTo(0.5 * audio["sfx-gas"].gain, 5);
    expect(p.cents).toBe(-40);
  });

  it("a aba escondida cala tudo e suspende o contexto; a volta retoma", async () => {
    const s = await loaded();
    s.engine.setHidden(true);
    await vi.advanceTimersByTimeAsync(400);
    expect(s.ctx.suspends).toBe(1);
    expect(s.ctx.state).toBe("suspended");
    expect(s.decks[0]!.el.paused).toBe(true);
    s.engine.play("sfx-stamp");
    expect(s.engine.debug().played).toHaveLength(0);
    s.engine.setHidden(false);
    await vi.advanceTimersByTimeAsync(50);
    expect(s.ctx.state).toBe("running");
    expect(s.decks[0]!.el.paused).toBe(false);
    s.engine.play("sfx-stamp");
    expect(s.engine.debug().played).toHaveLength(1);
  });

  it("o chiado da vazão liga com a vazão, acompanha o volume e para", async () => {
    const s = await loaded();
    s.engine.setVent(0.5);
    expect(s.engine.debug().vent).toMatchObject({ on: true });
    const before = s.ctx.sources.length;
    expect(before).toBeGreaterThan(0);
    s.engine.setVent(1);
    expect(s.engine.debug().vent.level).toBeCloseTo(audio["sfx-vent-loop"].gain, 5);
    s.engine.setVent(0);
    expect(s.engine.debug().vent.on).toBe(false);
    await vi.advanceTimersByTimeAsync(300);
    expect(s.ctx.sources.every((src) => src.stopped || src.started > 0)).toBe(true);
  });
});
