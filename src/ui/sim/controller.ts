import { Ghost } from "@/render/ghost";
import { runs, runKey, useComparison } from "../instruments/comparison";
import type { Series } from "@/instruments/sampling";
import { instrumentPreset } from "@/instruments/presets";
import { useUiStore } from "@/editor/useUiStore";
import { useInstruments } from "../instruments/store";
import { FIXED_STEP } from "@/engine/common";
import type { Vec2 } from "@/geometry/vec";
import type { Id } from "@/model/types";
import { partAt } from "@/render/hit";
import type { StageNodes } from "@/render/nodes";
import { localOf, worldOf } from "@/render/prepare";
import { Pacer, blendAt } from "@/sim/pacing";
import { Recorder, type FrameView, type PendingInput, type SimEvent, type SoundEvent } from "@/sim/session";
import { sound } from "@/sound";
import { PhysicsSound } from "@/sound/physics";
import type { SimReply, SimRequest } from "./sim.worker";
import { Trail } from "./trail";
import { useSimStore, type SimControl, type SimPick, type Speed, type TimelineState } from "./simStore";

/**
 * Controlador do modo Simular, carregado sob demanda. A física roda num
 * Web Worker (src/ui/sim/sim.worker.ts) com a SimSession; aqui ficam o
 * laço de quadros com acumulador (câmera lenta reduz o tempo simulado por
 * quadro, não o passo; `Pacer`), o espelho da gravação dos últimos 10 s, o
 * arrasto, a linha do tempo e o desenho. Um pedido de passos por vez: o
 * worker calcula enquanto o thread principal desenha.
 *
 * O desenho mistura o passo anterior com o atual a cada quadro (posição
 * linear, ângulo pelo menor arco, pressão linear; molas, cabos e chamadas
 * saem das poses misturadas): em Lento a cena anda em todo quadro, não a
 * cada quinto. Os eventos aparecem no quadro em que o desenho chega ao
 * passo deles.
 */
/** "recalculando" aparece se a reexecução passar disto */
const RECALC_NOTICE_MS = 150;
const CAPACITY = Math.round(10 / FIXED_STEP);

export interface FrameStats {
  /** intervalo desde o quadro anterior, ms */
  interval: number;
  /** física no worker (passos + snapshots) recebida neste quadro, ms */
  physics: number;
  /** escrita no SVG, ms (inclui a mistura) */
  draw: number;
  /** mistura dos dois passos (interpolação), ms */
  mix: number;
  steps: number;
}

export interface ControllerOptions {
  /** estatísticas por quadro (página /#perf) */
  onStats?: (s: FrameStats) => void;
}

class Controller implements SimControl {
  private worker: Worker;
  private comparing = false;
  private otherRec: Recorder | null = null;
  private otherMix = new Float32Array(0);
  private ghost: Ghost | null = null;
  private comparisonSeries: Series[] = [];
  private otherSeries: Series[] = [];
  private recordingKey = runKey();
  private unsubscribeProbes: () => void;
  private rec: Recorder;
  private nodes: StageNodes;
  private h = FIXED_STEP;
  private step = 0;
  private events: SimEvent[] = [];
  private raf = 0;
  private last = 0;
  private pacer = new Pacer(FIXED_STEP);
  /** quadro misturado (buffer reaproveitado) */
  private mix: Float32Array;
  /** posição do último desenho (passos), para não redesenhar o mesmo quadro */
  private drawnAt = -1;
  /** eventos que já chegaram mas o desenho ainda não alcançou */
  private due: SimEvent[] = [];
  /** o mesmo para o som: tocam quando o desenho chega ao passo deles, só para a frente */
  private dueSound: SoundEvent[] = [];
  private physicsSound: PhysicsSound;
  /** muda a cada reinício ou volta: respostas antigas são ignoradas */
  private epoch = 0;
  private inflight = false;
  private queue: PendingInput[] = [];
  private shownStep: number | null = null;
  private rewinding: { timer: number } | null = null;
  private dragging: { part: Id; local: Vec2 } | null = null;
  private finger: Vec2 = [0, 0];
  private dirty = true;
  private recvPhysics = 0;
  private mixMs = 0;
  private recvSteps = 0;
  private flash = new Map<Id, number>();
  private opts: ControllerOptions;
  private onFrame: ((t: TimelineState) => void) | null = null;
  private trail: Trail;

  constructor(
    worker: Worker,
    ready: Extract<SimReply, { t: "ready" }>,
    nodes: StageNodes,
    opts: ControllerOptions,
  ) {
    this.worker = worker;
    useInstruments.getState().setSeries([]);
    this.unsubscribeProbes = useUiStore.subscribe((s, prev) => {
      if (s.probes !== prev.probes) this.post({ t: "samples", id: this.epoch, probes: s.probes });
    });
    this.post({
      t: "samples",
      id: this.epoch,
      probes: useUiStore.getState().probes.length
        ? useUiStore.getState().probes
        : instrumentPreset(nodes.model.scene),
    });
    this.nodes = nodes;
    this.opts = opts;
    this.physicsSound = new PhysicsSound(nodes.model.scene, sound);
    this.rec = new Recorder(ready.partIds, ready.chamberIds, CAPACITY, ready.lockIds);
    this.rec.recordRaw(0, ready.frame, 0);
    this.mix = new Float32Array(this.rec.stride);
    worker.onmessage = (e: MessageEvent<SimReply>) => this.onReply(e.data);
    nodes.resetPeaks();
    this.trail = new Trail(this.rec, nodes, this.h);
    nodes.trail = this.trail;
    document.addEventListener("visibilitychange", this.onVisibility);
    this.drawCurrent();
    const comparison = useComparison.getState().request;
    if (comparison) {
      this.comparing = true;
      this.post({
        t: "compare",
        id: this.epoch,
        scene: comparison.b.scene,
        ...comparison.run,
        probes: useUiStore.getState().probes,
      });
    }
    this.start();
  }

  private get state() {
    return useSimStore.getState();
  }

  private post(m: SimRequest) {
    this.worker.postMessage(m);
  }

  private onReply(m: SimReply) {
    if (m.t === "error") {
      useSimStore.getState().set({ status: "error", error: m.message });
      return;
    }
    if (m.t === "ready") return;
    if (m.id !== this.epoch) return;
    if (m.t === "compared") {
      const mirror = (r: typeof m.a) => {
        const rec = new Recorder(r.parts, r.chambers, Math.max(CAPACITY, r.steps), r.locks);
        for (let i = 0; i <= r.steps; i++) rec.recordRaw(i, r.data, i * rec.stride);
        return rec;
      };
      this.rec = mirror(m.a);
      this.mix = new Float32Array(this.rec.stride);
      this.otherRec = mirror(m.b);
      this.otherMix = new Float32Array(this.otherRec.stride);
      this.step = m.a.steps;
      this.events = m.a.events;
      this.comparisonSeries = m.a.series;
      this.otherSeries = m.b.series;
      const request = useComparison.getState().request;
      if (request) this.ghost = new Ghost(this.nodes, request.b.scene);
      useComparison.setState({ series: m.b.series, ticks: m.b.events, ready: true });
      this.pacer.reset(0);
      this.state.set({ paused: false });
      this.dirty = true;
      return;
    }
    if (m.t === "samples") {
      if (this.comparing) return;
      useInstruments.getState().setSeries(m.series);
      return;
    }
    if (m.t === "frames") {
      if (this.comparing) return;
      runs.set(this.recordingKey, { inputs: m.inputs, steps: Math.max(this.step, m.from + m.count - 1) });
      const stride = this.rec.stride;
      for (let i = 0; i < m.count; i++) this.rec.recordRaw(m.from + i, m.data, i * stride);
      if (m.count) this.step = m.from + m.count - 1;
      if (m.events.length) {
        this.events.push(...m.events);
        this.due.push(...m.events);
      }
      if (m.sound?.length) this.dueSound.push(...m.sound);
      this.recvPhysics += m.physics;
      this.recvSteps += m.count;
      this.inflight = false;
      this.dirty = true;
      this.send();
    } else if (m.t === "rewound") {
      if (this.rewinding) window.clearTimeout(this.rewinding.timer);
      this.rewinding = null;
      this.rec.truncate(m.step);
      this.step = m.step;
      this.events = this.events.filter((e) => e.step <= m.step);
      this.shownStep = null;
      this.pacer.reset(m.step);
      this.due = [];
      this.dueSound = [];
      this.physicsSound.reset();
      this.dirty = true;
      useSimStore.getState().set({ recalculating: false, scrubbed: false, paused: false });
    }
  }

  /** Pede ao worker os passos acumulados (um pedido por vez). */
  private send(force = 0) {
    if (this.comparing || this.inflight || this.rewinding) return;
    let n = force;
    if (force) this.pacer.push(force);
    else if (!this.state.paused && this.shownStep === null) n = this.pacer.take();
    if (n === 0 && this.queue.length === 0) return;
    const inputs = this.queue;
    this.queue = [];
    this.inflight = n > 0;
    this.post({ t: "run", id: this.epoch, steps: n, inputs });
  }

  private onVisibility = () => {
    if (document.visibilityState === "visible") this.start();
    else cancelAnimationFrame(this.raf);
  };

  private start() {
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    if (document.visibilityState === "visible") this.raf = requestAnimationFrame(this.frame);
  }

  private view(step: number): FrameView | null {
    return this.rec.view(step, this.h);
  }

  private drawCurrent() {
    const f = this.view(this.shownStep ?? this.step);
    if (f) this.draw(f);
    this.drawnAt = -1;
  }

  /** Posição do desenho agora (passos, fracionária). */
  private displayPos(): number {
    if (this.shownStep !== null) return this.shownStep;
    if (this.state.paused || this.rewinding) return this.step;
    return Math.min(this.step, this.pacer.display());
  }

  /** Desenha a posição atual, misturando dois passos; false se nada mudou. */
  private drawBlend(): boolean {
    const d = this.displayPos();
    if (d === this.drawnAt) return false;
    const { step, alpha } = blendAt(d, this.rec.oldest, this.step);
    const m0 = performance.now();
    const f = this.rec.blend(step, alpha, this.h, this.mix);
    this.mixMs = performance.now() - m0;
    if (!f) return false;
    this.draw(f);
    this.drawnAt = d;
    if (this.due.length) {
      const reached = this.due.filter((e) => e.step <= d + 1e-6);
      if (reached.length) {
        this.due = this.due.filter((e) => e.step > d + 1e-6);
        this.sensorFlash(reached);
      }
    }
    if (this.dueSound.length) {
      const reached = this.dueSound.filter((e) => e.step <= d + 1e-6);
      if (reached.length) {
        this.dueSound = this.dueSound.filter((e) => e.step > d + 1e-6);
        // só na execução para a frente: voltar ou arrastar a régua não toca nada
        if (this.shownStep === null && !this.rewinding) this.physicsSound.play(reached, performance.now());
      }
    }
    return true;
  }

  private draw(f: FrameView) {
    this.nodes.setDrag(
      this.dragging && this.shownStep === null
        ? { part: this.dragging.part, local: this.dragging.local, finger: this.finger }
        : null,
    );
    this.nodes.write(f, false);
    if (this.comparing && this.otherRec) {
      const step = Math.floor(f.time / this.h);
      const frame = this.otherRec.blend(step, f.time / this.h - step, this.h, this.otherMix);
      const state = useComparison.getState();
      if (frame) this.ghost?.write(frame, state.ghost, useUiStore.getState().hidden);
      const at = (series: Series[]) =>
        series.map((s) => ({ ...s, cursor: s.points.find((p) => p.step === step) ?? null }));
      useInstruments.getState().setSeries(at(this.comparisonSeries));
      useComparison.setState({ series: at(this.otherSeries) });
    }
    this.onFrame?.(this.timeline());
    useInstruments.getState().setTime(f.time, this.step * this.h, this.events);
  }

  private frame = (now: number) => {
    const interval = now - this.last;
    const dt = Math.min(0.1, interval / 1000);
    this.last = now;
    if (!this.rewinding && !this.state.paused && this.shownStep === null) {
      this.pacer.advance(dt, this.state.speed);
      this.send();
    }
    // pausada, na régua ou voltando: o chiado da vazão para (volta sozinho quando o fluxo segue)
    if (this.state.paused || this.shownStep !== null || this.rewinding) this.physicsSound.silence();
    const t1 = performance.now();
    this.mixMs = 0;
    if (this.dirty) this.drawnAt = -1;
    this.dirty = false;
    if (!this.drawBlend() && this.dragging) this.nodes.writeDrag();
    const t2 = performance.now();
    this.opts.onStats?.({
      interval,
      physics: this.recvPhysics,
      draw: t2 - t1,
      mix: this.mixMs,
      steps: this.recvSteps,
    });
    this.recvPhysics = 0;
    this.recvSteps = 0;
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Sensor acionado: anel e tiques em brasa por 280 ms. */
  private sensorFlash(list: SimEvent[]) {
    const now = performance.now();
    for (const e of list) {
      if (e.kind !== "sensor") continue;
      const el = this.nodes.world?.querySelector(`[data-link="${CSS.escape(e.id)}"]`);
      if (!el) continue;
      el.classList.add("is-hit");
      this.flash.set(e.id, now);
      window.setTimeout(() => {
        if (performance.now() - (this.flash.get(e.id) ?? 0) >= 270) el.classList.remove("is-hit");
      }, 280);
    }
  }

  setFrameListener(fn: ((t: TimelineState) => void) | null) {
    this.onFrame = fn;
  }

  togglePause() {
    const st = this.state;
    if (this.comparing) {
      const position = this.shownStep ?? Math.min(this.step, this.pacer.display());
      this.shownStep = st.paused ? null : Math.floor(position);
      this.pacer.reset(position >= this.step ? 0 : position);
      st.set({ paused: !st.paused });
      this.dirty = true;
      return;
    }
    if (st.paused && this.shownStep !== null && this.shownStep !== this.step) {
      this.resumeFrom(this.shownStep);
      return;
    }
    this.shownStep = null;
    // continua do passo mostrado, sem pular o acumulado
    this.pacer.reset(this.step);
    st.set({ paused: !st.paused, scrubbed: false });
    this.dirty = true;
  }

  /** Continua de um quadro gravado: o worker reexecuta até ele e segue dali. */
  private resumeFrom(step: number) {
    this.endDrag();
    this.queue = [];
    this.epoch++;
    this.inflight = false;
    const timer = window.setTimeout(() => {
      if (this.rewinding) useSimStore.getState().set({ recalculating: true });
    }, RECALC_NOTICE_MS);
    this.rewinding = { timer };
    this.post({ t: "rewind", id: this.epoch, step });
  }

  stepOnce() {
    if (this.comparing) {
      this.scrub(((this.shownStep ?? this.displayPos()) + 1) * this.h);
      return;
    }
    if (this.rewinding) return;
    if (this.shownStep !== null && this.shownStep !== this.step) {
      this.resumeFrom(this.shownStep);
      return;
    }
    this.state.set({ paused: true });
    if (!this.inflight) this.send(1);
  }

  setSpeed(s: Speed) {
    this.state.set({ speed: s });
  }

  restart() {
    if (this.comparing) {
      this.shownStep = 0;
      this.pacer.reset(0);
      this.dirty = true;
      this.state.set({ paused: true });
      return;
    }
    if (this.rewinding) window.clearTimeout(this.rewinding.timer);
    this.rewinding = null;
    this.endDrag();
    this.queue = [];
    this.epoch++;
    this.inflight = false;
    this.step = 0;
    this.events = [];
    this.rec.truncate(0);
    this.rec.oldest = 0;
    this.shownStep = null;
    this.pacer.reset(0);
    this.due = [];
    this.dueSound = [];
    this.physicsSound.reset();
    this.nodes.resetPeaks();
    this.trail.reset();
    this.state.set({ scrubbed: false, recalculating: false });
    this.post({ t: "restart", id: this.epoch });
  }

  releaseAt(p: Vec2, pick: SimPick = {}): boolean {
    if (this.comparing || this.rewinding || this.shownStep !== null) return false;
    const frame = this.nodes.frame;
    for (const lm of this.nodes.model.links) {
      if (
        lm.link.kind !== "lock" ||
        frame.lock?.(lm.link.id) ||
        this.nodes.model.layers[lm.layer]?.layer.visible === false ||
        (pick.layer !== undefined && lm.layer !== pick.layer) ||
        (pick.exclude?.has(lm.link.b) && (lm.link.a === null || pick.exclude.has(lm.link.a)))
      )
        continue;
      const at = worldOf(frame.pose(lm.link.b), lm.link.at);
      if (Math.hypot(at[0] - p[0], at[1] - p[1]) > 22 * this.nodes.ctx.px) continue;
      this.queue.push({ kind: "release", link: lm.link.id });
      if (this.state.paused) this.send();
      return true;
    }
    return false;
  }

  dragAt(p: Vec2, pick: SimPick = {}): Id | null {
    if (this.comparing || this.rewinding || this.shownStep !== null) return null;
    const f = this.view(this.step);
    if (!f) return null;
    const model = this.nodes.model;
    const id = partAt(model, f, p, {
      dynamicOnly: true,
      tol: 10 * this.nodes.ctx.px,
      layer: (i) =>
        model.layers[i]?.layer.visible !== false && (pick.layer === undefined || i === pick.layer),
      exclude: pick.exclude,
    });
    if (!id) return null;
    this.dragging = { part: id, local: localOf(f.pose(id), p) };
    this.finger = p;
    this.queue.push({ kind: "start", part: id, p: [p[0], p[1]] });
    this.nodes.setDrag({ part: id, local: this.dragging.local, finger: p });
    this.nodes.writeDrag();
    return id;
  }

  dragMove(p: Vec2) {
    if (!this.dragging) return;
    this.finger = p;
    const q = this.queue[this.queue.length - 1];
    if (q && q.kind === "move") q.p = [p[0], p[1]];
    else this.queue.push({ kind: "move", p: [p[0], p[1]] });
    if (this.nodes.dragState) this.nodes.dragState.finger = p;
  }

  dragEnd() {
    if (!this.dragging) return;
    this.queue.push({ kind: "end" });
    this.endDrag();
    if (this.state.paused) this.send();
  }

  private endDrag() {
    this.dragging = null;
    this.nodes.setDrag(null);
    this.nodes.writeDrag();
  }

  scrub(t: number) {
    if (this.rewinding) return;
    const step = Math.max(this.rec.oldest, Math.min(this.rec.latest, Math.round(t / this.h)));
    if (this.dragging) this.dragEnd();
    this.shownStep = step === this.step ? null : step;
    this.post({ t: "samples", id: this.epoch, cursor: step });
    this.state.set({ paused: true, scrubbed: this.shownStep !== null });
    const f = this.view(step);
    if (f) this.draw(f);
  }

  preview(t: number) {
    if (this.rewinding) return;
    if (this.dragging) this.dragEnd();
    const d = Math.max(this.rec.oldest, Math.min(this.rec.latest, t / this.h));
    this.shownStep = Math.floor(d);
    this.post({ t: "samples", id: this.epoch, cursor: this.shownStep });
    this.state.set({ paused: true, scrubbed: true });
    const { step, alpha } = blendAt(d, this.rec.oldest, this.rec.latest);
    const f = this.rec.blend(step, alpha, this.h, this.mix);
    if (f) this.draw(f);
    this.drawnAt = this.shownStep;
  }

  timeline(): TimelineState {
    const h = this.h;
    return {
      oldest: this.rec.oldest * h,
      latest: this.rec.latest * h,
      shown: (this.shownStep ?? this.step) * h,
      events: this.events.map((e) => e.step * h),
      ticks: this.events,
    };
  }

  redraw() {
    this.drawCurrent();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    if (this.rewinding) window.clearTimeout(this.rewinding.timer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.unsubscribeProbes();
    this.physicsSound.silence();
    this.worker.terminate();
    this.ghost?.dispose();
    this.nodes.setDrag(null);
    if (this.nodes.trail === this.trail) this.nodes.trail = null;
  }
}

/** Cria o worker da física, compila a cena montada em `nodes` e devolve o controlador. */
export async function createController(nodes: StageNodes, opts: ControllerOptions = {}): Promise<SimControl> {
  const worker = new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" });
  const ready = await new Promise<Extract<SimReply, { t: "ready" }>>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<SimReply>) => {
      if (e.data.t === "ready") resolve(e.data);
      else if (e.data.t === "error") reject(new Error(e.data.message));
    };
    worker.onerror = (e) => reject(new Error(e.message || "Falha ao carregar o motor"));
    worker.postMessage({ t: "init", scene: nodes.model.scene } satisfies SimRequest);
  });
  return new Controller(worker, ready, nodes, opts);
}
