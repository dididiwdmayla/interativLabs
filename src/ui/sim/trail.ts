import type { Id } from "@/model/types";
import { spreadOffset } from "@/render/look";
import type { FrameSource, StageNodes, TrailWriter } from "@/render/nodes";
import type { Recorder } from "@/sim/session";

/**
 * Rastro do movimento no Testar (Parte E2d): o caminho recente do centro das
 * peças móveis, lido da gravação. Por padrão, as que andaram mais de 2 mm no
 * último 0,5 s de simulação (até 12, as que mais andaram) e a peça escolhida
 * sempre. Cada rastro são 6 trechos fixos com opacidade decrescente (o mais
 * novo, forte): a cada quadro só muda o `d` deles, nenhum elemento é criado.
 */
export const TRAIL = {
  /** janela, s de simulação */
  window: 0.5,
  /** amostras na janela */
  samples: 24,
  segments: 6,
  /** peças além da escolhida */
  max: 12,
  /** deslocamento mínimo na janela, mm */
  minMm: 2,
  /** reescolhe as peças a cada tantos passos */
  repick: 12,
} as const;

/** Caminhos que o palco monta (peças × trechos). */
export const TRAIL_SLOTS = TRAIL.max + 1;
export const TRAIL_PATHS = TRAIL_SLOTS * TRAIL.segments;

const f = (n: number) => (Math.round(n * 100) / 100).toString();

export class Trail implements TrailWriter {
  private slots: (Id | null)[] = [];
  private picked = -Infinity;
  private stride: number;
  private dynamic: { id: Id; layer: number }[];
  private rec: Recorder;
  private nodes: StageNodes;

  constructor(rec: Recorder, nodes: StageNodes, h: number) {
    this.rec = rec;
    this.nodes = nodes;
    this.stride = Math.max(1, Math.round(TRAIL.window / h / TRAIL.samples));
    const seen = new Set<Id>();
    this.dynamic = [];
    for (const m of nodes.model.partList)
      if (m.dynamic && !seen.has(m.part.id)) {
        seen.add(m.part.id);
        this.dynamic.push({ id: m.part.id, layer: m.layer });
      }
  }

  /** Esquece a escolha (reinício, volta na régua). */
  reset(): void {
    this.picked = -Infinity;
  }

  /** As peças do rastro no passo `s`: a escolhida e as que mais andaram. */
  pick(s: number): (Id | null)[] {
    const moved: { id: Id; d: number }[] = [];
    const focus = this.nodes.trailFocus;
    for (const { id } of this.dynamic) {
      if (id === focus) continue;
      const p = this.rec.xy(s, id);
      if (!p) continue;
      let d = 0;
      for (let k = 6; k <= TRAIL.samples; k += 6) {
        const q = this.rec.xy(s - k * this.stride, id);
        if (q) d = Math.max(d, Math.hypot(p[0] - q[0], p[1] - q[1]));
      }
      if (d > TRAIL.minMm) moved.push({ id, d });
    }
    moved.sort((a, b) => b.d - a.d);
    const ids: (Id | null)[] = [focus && this.dynamic.some((x) => x.id === focus) ? focus : null];
    for (const m of moved.slice(0, TRAIL.max)) ids.push(m.id);
    return ids;
  }

  write(frame: FrameSource & { step?: number }): void {
    const els = this.nodes.trailEls;
    if (!els.length) return;
    const s = Math.floor(frame.step ?? this.rec.latest);
    if (Math.abs(s - this.picked) >= TRAIL.repick) {
      this.slots = this.pick(s);
      this.picked = s;
    }
    const { spread = 0, active = 0, px } = this.nodes.ctx;
    const per = TRAIL.samples / TRAIL.segments;
    for (let k = 0; k < TRAIL_SLOTS; k++) {
      const id = this.slots[k] ?? null;
      const layer = id ? (this.dynamic.find((x) => x.id === id)?.layer ?? 0) : 0;
      // afastadas: o rastro acompanha a folha da camada da peça (a de cima é a da ativa)
      const o = spreadOffset(layer, spread);
      const a = spreadOffset(active, spread);
      const dx = (o[0] - a[0]) * px;
      const dy = (o[1] - a[1]) * px;
      for (let q = 0; q < TRAIL.segments; q++) {
        const el = els[k * TRAIL.segments + q];
        if (!el) continue;
        let d = "";
        if (id) {
          for (let j = q * per; j <= (q + 1) * per; j++) {
            const p = j === 0 ? frame.pose(id) : null;
            const xy: [number, number] | null = p ? [p.x, p.y] : this.rec.xy(s - j * this.stride, id);
            if (!xy) break;
            d += `${d ? "L" : "M"}${f(xy[0] + dx)} ${f(xy[1] + dy)}`;
          }
        }
        el.setAttribute("d", d);
      }
    }
  }
}
