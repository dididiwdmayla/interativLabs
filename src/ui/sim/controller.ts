import { loadBox2d } from "@/engine/box2d/load";
import type { Vec2 } from "@/geometry/vec";
import type { Id } from "@/model/types";
import { partAt } from "@/render/hit";
import type { StageNodes } from "@/render/nodes";
import { localOf } from "@/render/prepare";
import { SimSession, type FrameView, type Rewind } from "@/sim/session";
import { useSimStore, type SimControl, type Speed, type TimelineState } from "./simStore";

/**
 * Controlador do modo Simular, carregado sob demanda junto com o motor:
 * laço de quadros com acumulador e passo fixo, câmera lenta (reduz o tempo
 * simulado por quadro, não o passo), arrasto com o dedo, linha do tempo
 * dos últimos 10 s e volta a um passo gravado por reexecução.
 */

/** no máximo isto de passos por quadro (1× a 6 qps); o resto do tempo é descartado */
const MAX_STEPS = 40;
/** "recalculando" aparece se a reexecução passar disto */
const RECALC_NOTICE_MS = 150;

export interface FrameStats {
  /** intervalo desde o quadro anterior, ms */
  interval: number;
  /** física (passos + snapshots), ms */
  physics: number;
  /** escrita no SVG, ms */
  draw: number;
  steps: number;
}

export interface ControllerOptions {
  /** estatísticas por quadro (página /#perf) */
  onStats?: (s: FrameStats) => void;
  /** começa pausado */
  paused?: boolean;
}

class Controller implements SimControl {
  private session: SimSession;
  private nodes: StageNodes;
  private raf = 0;
  private last = 0;
  private acc = 0;
  /** passo mostrado quando a régua é arrastada (null = o atual) */
  private shownStep: number | null = null;
  private rewinding: { r: Rewind; t0: number } | null = null;
  private dragging: { part: Id; local: Vec2 } | null = null;
  private finger: Vec2 = [0, 0];
  private lastEventsLen = -1;
  private flash = new Map<Id, number>();
  private opts: ControllerOptions;
  private onFrame: ((t: TimelineState) => void) | null = null;

  constructor(session: SimSession, nodes: StageNodes, opts: ControllerOptions) {
    this.session = session;
    this.nodes = nodes;
    this.opts = opts;
    nodes.resetPeaks();
    document.addEventListener("visibilitychange", this.onVisibility);
    this.drawCurrent();
    this.start();
  }

  private get state() {
    return useSimStore.getState();
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

  private drawCurrent() {
    const f = this.session.frame();
    if (f) this.draw(f);
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
    const s = this.session;
    let steps = 0;
    const t0 = performance.now();
    if (this.rewinding) {
      const done = this.rewinding.r.advance(10);
      if (!done && !this.state.recalculating && t0 - this.rewinding.t0 > RECALC_NOTICE_MS)
        useSimStore.getState().set({ recalculating: true });
      if (done) {
        this.rewinding = null;
        this.shownStep = null;
        this.acc = 0;
        useSimStore.getState().set({ recalculating: false, scrubbed: false, paused: false });
      }
    } else if (!this.state.paused && this.shownStep === null) {
      this.acc += dt * this.state.speed;
      while (this.acc >= s.h && steps < MAX_STEPS) {
        s.advance();
        this.acc -= s.h;
        steps++;
      }
      if (steps === MAX_STEPS) this.acc = 0;
    }
    const t1 = performance.now();
    if (steps) {
      this.sensorFlash();
      this.drawCurrent();
    } else if (this.dragging) this.nodes.writeDrag();
    const t2 = performance.now();
    this.opts.onStats?.({ interval, physics: t1 - t0, draw: t2 - t1, steps });
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Sensor acionado: anel e tiques em brasa por 280 ms. */
  private sensorFlash() {
    const ev = this.session.events;
    if (ev.length === this.lastEventsLen) return;
    const from = Math.max(0, this.lastEventsLen);
    this.lastEventsLen = ev.length;
    const now = performance.now();
    for (let i = from; i < ev.length; i++) {
      const e = ev[i];
      if (!e) continue;
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
    if (st.paused && this.shownStep !== null && this.shownStep !== this.session.step) {
      this.resumeFrom(this.shownStep);
      return;
    }
    this.shownStep = null;
    st.set({ paused: !st.paused, scrubbed: false });
  }

  /** Continua de um quadro gravado: reexecuta até ele e segue dali. */
  private resumeFrom(step: number) {
    this.endDrag();
    const r = this.session.rewind(step);
    this.rewinding = { r, t0: performance.now() };
  }

  stepOnce() {
    if (this.rewinding) return;
    if (this.shownStep !== null && this.shownStep !== this.session.step) {
      this.resumeFrom(this.shownStep);
      return;
    }
    this.state.set({ paused: true });
    this.session.advance();
    this.sensorFlash();
    this.drawCurrent();
  }

  setSpeed(s: Speed) {
    this.state.set({ speed: s });
  }

  restart() {
    this.rewinding = null;
    this.endDrag();
    this.session.restart();
    this.shownStep = null;
    this.acc = 0;
    this.lastEventsLen = -1;
    this.nodes.resetPeaks();
    this.state.set({ scrubbed: false, recalculating: false });
    this.drawCurrent();
  }

  dragAt(p: Vec2): Id | null {
    if (this.rewinding || this.shownStep !== null) return null;
    const f = this.session.frame();
    if (!f) return null;
    const id = partAt(this.nodes.model, f, p, { dynamicOnly: true, tol: 10 * this.nodes.ctx.px });
    if (!id) return null;
    this.dragging = { part: id, local: localOf(f.pose(id), p) };
    this.finger = p;
    this.session.dragStart(id, p);
    this.nodes.setDrag({ part: id, local: this.dragging.local, finger: p });
    this.nodes.writeDrag();
    return id;
  }

  dragMove(p: Vec2) {
    if (!this.dragging) return;
    this.finger = p;
    this.session.dragMove(p);
    if (this.nodes.dragState) this.nodes.dragState.finger = p;
  }

  dragEnd() {
    if (!this.dragging) return;
    this.session.dragEnd();
    this.endDrag();
  }

  private endDrag() {
    this.dragging = null;
    this.nodes.setDrag(null);
    this.nodes.writeDrag();
  }

  scrub(t: number) {
    if (this.rewinding) return;
    const rec = this.session.rec;
    const step = Math.max(rec.oldest, Math.min(rec.latest, Math.round(t / this.session.h)));
    if (this.dragging) this.dragEnd();
    this.shownStep = step === this.session.step ? null : step;
    this.state.set({ paused: true, scrubbed: this.shownStep !== null });
    const f = this.session.frame(step);
    if (f) this.draw(f);
  }

  timeline(): TimelineState {
    const s = this.session;
    const h = s.h;
    return {
      oldest: s.rec.oldest * h,
      latest: s.rec.latest * h,
      shown: (this.shownStep ?? s.step) * h,
      events: s.events.map((e) => e.step * h),
    };
  }

  redraw() {
    const f = this.session.frame(this.shownStep ?? this.session.step);
    if (f) this.draw(f);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.session.dispose();
    this.nodes.setDrag(null);
  }
}

let makeEngine: Promise<Awaited<ReturnType<typeof loadBox2d>>> | null = null;

/** Carrega o motor (uma vez) e cria o controlador da cena montada em `nodes`. */
export async function createController(nodes: StageNodes, opts: ControllerOptions = {}): Promise<SimControl> {
  makeEngine ??= loadBox2d();
  const make = await makeEngine;
  const session = new SimSession(make, nodes.model.scene);
  if (opts.paused !== undefined) useSimStore.getState().set({ paused: opts.paused });
  return new Controller(session, nodes, opts);
}
