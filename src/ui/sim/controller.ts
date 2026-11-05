import { FIXED_STEP } from "@/engine/common";
import type { Vec2 } from "@/geometry/vec";
import type { Id } from "@/model/types";
import { partAt } from "@/render/hit";
import type { StageNodes } from "@/render/nodes";
import { localOf } from "@/render/prepare";
import { Pacer, blendAt } from "@/sim/pacing";
import { Recorder, type FrameView, type PendingInput, type SimEvent } from "@/sim/session";
import type { SimReply, SimRequest } from "./sim.worker";
import { useSimStore, type SimControl, type Speed, type TimelineState } from "./simStore";

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

  constructor(
    worker: Worker,
    ready: Extract<SimReply, { t: "ready" }>,
    nodes: StageNodes,
    opts: ControllerOptions,
  ) {
    this.worker = worker;
    this.nodes = nodes;
    this.opts = opts;
    this.rec = new Recorder(ready.partIds, ready.chamberIds, CAPACITY);
    this.rec.recordRaw(0, ready.frame, 0);
    this.mix = new Float32Array(this.rec.stride);
    worker.onmessage = (e: MessageEvent<SimReply>) => this.onReply(e.data);
    nodes.resetPeaks();
    document.addEventListener("visibilitychange", this.onVisibility);
    this.drawCurrent();
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
    if (m.t === "frames") {
      const stride = this.rec.stride;
      for (let i = 0; i < m.count; i++) this.rec.recordRaw(m.from + i, m.data, i * stride);
      if (m.count) this.step = m.from + m.count - 1;
      if (m.events.length) {
        this.events.push(...m.events);
        this.due.push(...m.events);
      }
      if ((this.events[0]?.step ?? Infinity) < this.rec.oldest)
        this.events = this.events.filter((e) => e.step >= this.rec.oldest);
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
      this.dirty = true;
      useSimStore.getState().set({ recalculating: false, scrubbed: false, paused: false });
    }
  }

  /** Pede ao worker os passos acumulados (um pedido por vez). */
  private send(force = 0) {
    if (this.inflight || this.rewinding) return;
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
    return true;
  }

  private draw(f: FrameView) {
    this.nodes.setDrag(
      this.dragging && this.shownStep === null
        ? { part: this.dragging.part, local: this.dragging.local, finger: this.finger }
        : null,
    );
    this.nodes.write(f, false);
    this.onFrame?.(this.timeline());
  }

  private frame = (now: number) => {
    const interval = now - this.last;
    const dt = Math.min(0.1, interval / 1000);
    this.last = now;
    if (!this.rewinding && !this.state.paused && this.shownStep === null) {
      this.pacer.advance(dt, this.state.speed);
      this.send();
    }
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
    this.nodes.resetPeaks();
    this.state.set({ scrubbed: false, recalculating: false });
    this.post({ t: "restart", id: this.epoch });
  }

  dragAt(p: Vec2): Id | null {
    if (this.rewinding || this.shownStep !== null) return null;
    const f = this.view(this.step);
    if (!f) return null;
    const id = partAt(this.nodes.model, f, p, { dynamicOnly: true, tol: 10 * this.nodes.ctx.px });
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
    this.state.set({ paused: true, scrubbed: this.shownStep !== null });
    const f = this.view(step);
    if (f) this.draw(f);
  }

  timeline(): TimelineState {
    const h = this.h;
    return {
      oldest: this.rec.oldest * h,
      latest: this.rec.latest * h,
      shown: (this.shownStep ?? this.step) * h,
      events: this.events.map((e) => e.step * h),
    };
  }

  redraw() {
    this.drawCurrent();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    if (this.rewinding) window.clearTimeout(this.rewinding.timer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.worker.terminate();
    this.nodes.setDrag(null);
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
