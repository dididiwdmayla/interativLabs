import { FIXED_STEP } from "@/engine/common";
import type { EngineAdapter, PartPose, Snapshot } from "@/engine/types";
import type { Vec2 } from "@/geometry/vec";
import type { Id, Scene } from "@/model/types";

/**
 * Sessão de simulação do app (sem DOM): passo fixo de 1/240 s, entradas do
 * dedo gravadas com o passo em que entraram, gravação das poses dos
 * últimos 10 s e volta a um passo gravado.
 *
 * O Box2D v3 não serializa o mundo. Para continuar de um passo N, a sessão
 * recria o mundo e reexecuta as mesmas entradas até N; o determinismo
 * garante o mesmo estado (src/sim/session.test.ts confere pelo hash).
 */

/** Entrada ainda sem passo (fila até o próximo passo). */
export type PendingInput = { kind: "start"; part: Id; p: Vec2 } | { kind: "move"; p: Vec2 } | { kind: "end" };

export type SimInput =
  | { step: number; kind: "start"; part: Id; p: Vec2 }
  | { step: number; kind: "move"; p: Vec2 }
  | { step: number; kind: "end" };

type Pending = PendingInput;

export type SimEventKind = "sensor" | "chamber-fired" | "impact";

export interface SimEvent {
  step: number;
  kind: SimEventKind;
  /** sensor, câmara ou a primeira peça do impacto */
  id: Id;
}

/** Choque acima disto (mm/s) vira marca de "impacto forte" na linha do tempo. */
export const STRONG_IMPACT = 600;

/** Uma câmara no quadro gravado. */
export interface ChamberFrame {
  pressure: number;
  travel: number[];
}

export interface FrameView {
  step: number;
  time: number;
  pose(id: Id): PartPose | undefined;
  chamber(id: Id): ChamberFrame | undefined;
}

/** Gravação circular de quadros (poses e câmaras) por passo. */
export class Recorder {
  readonly capacity: number;
  readonly stride: number;
  private data: Float32Array;
  readonly partIndex: Map<Id, number>;
  readonly chamberIndex: Map<Id, number>;
  private nParts: number;
  /** passo mais novo gravado (−1: vazio) */
  latest = -1;
  /** passo mais antigo ainda na gravação */
  oldest = 0;

  constructor(partIds: Id[], chamberIds: Id[], capacity: number) {
    this.capacity = capacity;
    this.nParts = partIds.length;
    this.partIndex = new Map(partIds.map((id, i) => [id, i] as const));
    this.chamberIndex = new Map(chamberIds.map((id, i) => [id, i] as const));
    this.stride = partIds.length * 3 + chamberIds.length * 3;
    this.data = new Float32Array(this.stride * (capacity + 1));
  }

  private slot(step: number): number {
    return (step % (this.capacity + 1)) * this.stride;
  }

  record(step: number, s: Snapshot): void {
    const o = this.slot(step);
    const d = this.data;
    for (const [id, i] of this.partIndex) {
      const p = s.parts[id];
      if (!p) continue;
      d[o + i * 3] = p.x;
      d[o + i * 3 + 1] = p.y;
      d[o + i * 3 + 2] = p.angle;
    }
    const c0 = o + this.nParts * 3;
    for (const [id, i] of this.chamberIndex) {
      const st = s.links[id];
      d[c0 + i * 3] = st?.pressure ?? 0;
      d[c0 + i * 3 + 1] = st?.walls?.[0]?.travel ?? 0;
      d[c0 + i * 3 + 2] = st?.walls?.[1]?.travel ?? 0;
    }
    this.latest = step;
    this.oldest = Math.max(this.oldest, step - this.capacity);
  }

  /** Copia o quadro do passo para `out` a partir de `offset` (stride floats). */
  copyFrame(step: number, out: Float32Array, offset: number): void {
    const o = this.slot(step);
    out.set(this.data.subarray(o, o + this.stride), offset);
  }

  /** Grava um quadro já montado (o espelho da gravação no thread principal). */
  recordRaw(step: number, src: Float32Array, offset: number): void {
    const o = this.slot(step);
    this.data.set(src.subarray(offset, offset + this.stride), o);
    this.latest = step;
    this.oldest = Math.max(this.oldest, step - this.capacity);
  }

  /** Esquece o que vem depois de `step`. */
  truncate(step: number): void {
    this.latest = Math.min(this.latest, step);
    this.oldest = Math.min(this.oldest, Math.max(0, this.latest));
  }

  has(step: number): boolean {
    return step >= this.oldest && step <= this.latest;
  }

  view(step: number, h: number): FrameView | null {
    if (!this.has(step)) return null;
    const o = this.slot(step);
    const d = this.data;
    const c0 = o + this.nParts * 3;
    return {
      step,
      time: step * h,
      pose: (id) => {
        const i = this.partIndex.get(id);
        if (i === undefined) return undefined;
        return { x: d[o + i * 3]!, y: d[o + i * 3 + 1]!, angle: d[o + i * 3 + 2]! };
      },
      chamber: (id) => {
        const i = this.chamberIndex.get(id);
        if (i === undefined) return undefined;
        return { pressure: d[c0 + i * 3]!, travel: [d[c0 + i * 3 + 1]!, d[c0 + i * 3 + 2]!] };
      },
    };
  }
}

/** Volta em andamento: avança a reexecução em fatias de tempo. */
export interface Rewind {
  readonly target: number;
  /** passos já refeitos */
  readonly done: number;
  /** reexecuta até gastar `budgetMs`; true quando chega ao passo */
  advance(budgetMs: number, now?: () => number): boolean;
}

export interface SessionOptions {
  /** passos gravados (padrão: 10 s) */
  capacity?: number;
}

export class SimSession {
  readonly scene: Scene;
  readonly h = FIXED_STEP;
  private make: () => EngineAdapter;
  private adapter: EngineAdapter;
  /** passos dados desde a compilação */
  step = 0;
  /** todas as entradas desde o passo 0 (a reexecução precisa delas) */
  private inputs: SimInput[] = [];
  private queue: Pending[] = [];
  private dragging = false;
  private target: Vec2 | null = null;
  readonly rec: Recorder;
  events: SimEvent[] = [];
  private partIds: Id[];
  last: Snapshot;

  constructor(make: () => EngineAdapter, scene: Scene, opts: SessionOptions = {}) {
    this.make = make;
    this.scene = scene;
    this.partIds = scene.parts.map((p) => p.id);
    const chambers = scene.links.filter((l) => l.kind === "chamber").map((l) => l.id);
    this.rec = new Recorder(this.partIds, chambers, opts.capacity ?? Math.round(10 / FIXED_STEP));
    this.adapter = this.compile();
    this.last = this.adapter.snapshot();
    this.rec.record(0, this.last);
  }

  private compile(): EngineAdapter {
    const a = this.make();
    a.compile(this.scene, { unitMm: 1 });
    return a;
  }

  get time(): number {
    return this.step * this.h;
  }

  /** O dedo agarrou `part` no ponto `p` (mundo, mm). Entra no próximo passo. */
  dragStart(part: Id, p: Vec2): void {
    this.queue.push({ kind: "start", part, p: [p[0], p[1]] });
  }
  dragMove(p: Vec2): void {
    const q = this.queue[this.queue.length - 1];
    if (q && q.kind === "move") q.p = [p[0], p[1]];
    else this.queue.push({ kind: "move", p: [p[0], p[1]] });
  }
  dragEnd(): void {
    this.queue.push({ kind: "end" });
  }

  private apply(a: EngineAdapter, inp: SimInput): void {
    if (inp.kind === "start") {
      this.dragging = a.dragStart(inp.part, inp.p);
      this.target = inp.p;
    } else if (inp.kind === "move") this.target = inp.p;
    else {
      a.dragEnd();
      this.dragging = false;
      this.target = null;
    }
  }

  private physics(a: EngineAdapter): void {
    if (this.dragging && this.target) a.dragMove(this.target);
    a.step(this.h);
  }

  /** Um passo: entradas pendentes, física, snapshot e gravação. */
  advance(): Snapshot {
    for (const q of this.queue) {
      const inp = { ...q, step: this.step } as SimInput;
      this.inputs.push(inp);
      this.apply(this.adapter, inp);
    }
    this.queue.length = 0;
    this.physics(this.adapter);
    this.step++;
    const s = this.adapter.snapshot();
    this.last = s;
    this.rec.record(this.step, s);
    for (const e of s.events) {
      if (e.kind === "sensor") this.events.push({ step: this.step, kind: "sensor", id: e.sensor });
      else if (e.kind === "chamber-fired")
        this.events.push({ step: this.step, kind: "chamber-fired", id: e.chamber });
      else if (e.kind === "impact" && e.speed >= STRONG_IMPACT) {
        const prev = this.events[this.events.length - 1];
        if (!prev || prev.kind !== "impact" || this.step - prev.step > 12)
          this.events.push({ step: this.step, kind: "impact", id: e.a });
      }
    }
    if (this.events.length && this.events[0]!.step < this.rec.oldest)
      this.events = this.events.filter((e) => e.step >= this.rec.oldest);
    return s;
  }

  /** Entradas vindas de fora (worker), na ordem, para o próximo passo. */
  enqueue(list: PendingInput[]): void {
    for (const q of list) {
      if (q.kind === "start") this.dragStart(q.part, q.p);
      else if (q.kind === "move") this.dragMove(q.p);
      else this.dragEnd();
    }
  }

  /** Quadro gravado do passo (null se já saiu da gravação). */
  frame(step = this.step): FrameView | null {
    return this.rec.view(step, this.h);
  }

  /** Entradas gravadas (cópia). */
  recordedInputs(): SimInput[] {
    return this.inputs.slice();
  }

  /**
   * Volta ao passo `target` (gravado): recria o mundo e reexecuta as mesmas
   * entradas até lá. A gravação e as entradas depois dele são descartadas.
   */
  rewind(target: number): Rewind {
    target = Math.max(0, Math.min(this.step, Math.round(target)));
    const a = this.compile();
    const inputs = this.inputs.filter((i) => i.step < target);
    this.dragging = false;
    this.target = null;
    let s = 0;
    let k = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this.adapter.dispose();
      this.adapter = a;
      this.inputs = inputs;
      this.queue.length = 0;
      this.step = target;
      this.rec.truncate(target);
      this.events = this.events.filter((e) => e.step <= target);
      this.last = a.snapshot();
      // um arrasto que estava acontecendo no passo não continua: o dedo já saiu
      if (this.dragging) this.queue.push({ kind: "end" });
    };
    return {
      target,
      get done() {
        return s;
      },
      // arrow: usa o this da sessão
      advance: (budgetMs: number, now = () => performance.now()) => {
        const t0 = now();
        while (s < target) {
          while (k < inputs.length && inputs[k]!.step === s) this.apply(a, inputs[k++]!);
          this.physics(a);
          s++;
          if ((s & 15) === 0 && now() - t0 >= budgetMs) return false;
        }
        finish();
        return true;
      },
    };
  }

  /** Volta ao passo zero. */
  restart(): void {
    this.adapter.dispose();
    this.adapter = this.compile();
    this.inputs = [];
    this.queue.length = 0;
    this.dragging = false;
    this.target = null;
    this.step = 0;
    this.events = [];
    this.rec.truncate(0);
    this.rec.oldest = 0;
    this.last = this.adapter.snapshot();
    this.rec.record(0, this.last);
  }

  /** Poses atuais direto do motor (precisão total; testes de determinismo). */
  snapshot(): Snapshot {
    return this.adapter.snapshot();
  }

  dispose(): void {
    this.adapter.dispose();
  }
}
