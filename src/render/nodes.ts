import { TrailHistory, TRAIL_BANDS } from "./trails";
import type { PartPose } from "@/engine/types";
import type { Vec2 } from "@/geometry/vec";
import type { Id } from "@/model/types";
import { calloutPath } from "./callouts";
import { cablePath, coilScale, gasPolygon, type ChamberGeo } from "./geometry";
import { worldOf, type SceneModel } from "./prepare";

/**
 * Nós guardados do palco e o escritor de quadros. Os componentes React
 * montam a estrutura uma vez e registram aqui os nós que mexem; o laço da
 * simulação escreve `transform` (e o desenho das ligações que mudam de
 * forma) direto neles, sem passar pelo React e sem recriar elementos.
 */

/** O que o escritor precisa saber de um quadro. */
export interface FrameSource {
  time?: number;
  lock?(id: Id): boolean | undefined;
  pose(id: Id): PartPose | undefined;
  /** câmara: pressão absoluta (kPa) e curso de cada parede (mm) */
  chamber(id: Id): { pressure: number; travel: readonly number[] } | undefined;
}

/** Quadro da pose desenhada (modo Editar). */
export function drawnFrame(model: SceneModel): FrameSource {
  return {
    pose: (id) => model.drawn.get(id),
    chamber: (id) => {
      const l = model.linkById.get(id)?.link;
      return l?.kind === "chamber" ? { pressure: l.gas.p0, travel: l.walls.map(() => 0) } : undefined;
    },
  };
}

/** Quadro com uma peça numa pose diferente (o dedo arrastando no Montar). */
export function overrideFrame(base: FrameSource, id: Id, pose: PartPose): FrameSource {
  return { pose: (pid) => (pid === id ? pose : base.pose(pid)), chamber: (cid) => base.chamber(cid) };
}

interface PartNodes {
  g?: SVGGElement | null;
  wall?: SVGGElement | null;
  shadow?: SVGGElement | null;
  /** desenhos de ligação que seguem a peça em outras camadas (pino, sensor) */
  followers: Set<SVGGElement>;
}

export interface SpringNodes {
  g?: SVGGElement | null;
  coils?: SVGGElement | null;
  endB?: SVGGElement | null;
  a: { part: Id | null; at: Vec2 };
  b: { part: Id | null; at: Vec2 };
  n: number;
  outerD: number;
  end: number;
  solid: number;
}

export interface TwoNodes {
  el?: SVGElement | null;
  a: { part: Id | null; at: Vec2 };
  b: { part: Id | null; at: Vec2 };
  max: number;
}

interface ChamberNodes {
  gas?: SVGPolygonElement | null;
  label?: SVGTextElement | null;
  geo: ChamberGeo;
  peak: number;
}

export interface WriteContext {
  /** deslocamento da parede, mm (2 px de tela) */
  wallMm: number;
  /** deslocamento da sombra, mm */
  shadowMm: number;
  /** px de tela em mm (texto e marcas) */
  px: number;
  /** escreve a parede das peças móveis (falso no Simular de cena pesada) */
  walls?: boolean;
}

/** pressão manométrica (kPa) em que o gás chega à metade da opacidade máxima */
const GAS_HALF_KPA = 40;

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();
const deg = (a: number) => (a * 180) / Math.PI;
export const poseTransform = (p: PartPose, dx = 0, dy = 0) =>
  `translate(${f(p.x + dx)} ${f(p.y + dy)}) rotate(${f(deg(p.angle))})`;

export class StageNodes {
  model: SceneModel;
  spread = 0;
  trailHistory = new TrailHistory();
  trailPaths = new Map<number, SVGPathElement>();
  trailOn = false;
  trailSelected: Id | null = null;
  trailHidden: readonly string[] = [];
  trailLayer: number | null = null;
  refTrail(index: number) {
    return (el: SVGPathElement | null) => {
      if (el) this.trailPaths.set(index, el);
      else this.trailPaths.delete(index);
    };
  }
  hiddenEnds = new Map<string, { el: SVGCircleElement; part: Id; at: Vec2; layer: number }>();
  refHiddenEnd(key: string, part: Id, at: Vec2, layer: number) {
    return (el: SVGCircleElement | null) => {
      if (el) this.hiddenEnds.set(key, { el, part, at, layer });
      else this.hiddenEnds.delete(key);
    };
  }
  shafts = new Map<Id, SVGPathElement>();
  refShaft(id: Id) {
    return (el: SVGPathElement | null) => {
      if (el) this.shafts.set(id, el);
      else this.shafts.delete(id);
    };
  }
  ctx: WriteContext = { wallMm: 0.4, shadowMm: 0.6, px: 0.2 };
  /** quadro mostrado agora (o laço troca; o React reaplica depois de cada montagem) */
  frame: FrameSource;
  parts = new Map<Id, PartNodes>();
  springs = new Map<Id, SpringNodes>();
  locks = new Map<Id, { el: SVGGElement; released: boolean; animation?: Animation }>();
  rods = new Map<Id, TwoNodes>();
  cables = new Map<Id, TwoNodes>();
  chambers = new Map<Id, ChamberNodes>();
  world: HTMLElement | null = null;
  /** fio e anel do arrasto */
  drag: { g?: SVGGElement | null; wire?: SVGLineElement | null; ring?: SVGCircleElement | null } = {};
  dragState: { part: Id; local: Vec2; finger: Vec2 } | null = null;
  /** chamadas de peça que acompanham a pose (linha e ponto) */
  partCallouts = new Map<Id, { label: Vec2; line?: SVGPathElement | null; dot?: SVGCircleElement | null }>();

  constructor(model: SceneModel) {
    this.model = model;
    this.frame = drawnFrame(model);
  }

  setContext(ctx: WriteContext): void {
    this.ctx = ctx;
  }

  /** contêiner das folhas (procura de nós por data-link) */
  setRoot(el: HTMLElement | null): void {
    this.world = el;
  }

  /** grupos do mundo de cada folha: a vista escreve a mesma matriz em todos */
  worlds = new Map<string, SVGGElement>();
  refWorld(key: string) {
    return (el: SVGGElement | null) => {
      if (el) this.worlds.set(key, el);
      else this.worlds.delete(key);
    };
  }

  /** ref de um nó da peça */
  refPart(id: Id, field: "g" | "wall" | "shadow", key = id) {
    return (el: SVGGElement | null) => {
      this.part(key)[field] = el;
    };
  }

  /** ref de um desenho que segue a peça em outra camada */
  refFollower(id: Id) {
    return (el: SVGGElement | null) => {
      const set = this.part(id).followers;
      if (el) set.add(el);
      else for (const x of set) if (!x.isConnected) set.delete(x);
    };
  }

  refLock(id: Id) {
    return (el: SVGGElement | null) => {
      const old = this.locks.get(id);
      if (old?.el === el) return;
      old?.animation?.cancel();
      if (el) this.locks.set(id, { el, released: false });
      else this.locks.delete(id);
    };
  }

  refChamber(id: Id, geo: ChamberGeo, field: "gas" | "label") {
    return (el: SVGPolygonElement | SVGTextElement | null) => {
      let c = this.chambers.get(id);
      if (!c || c.geo !== geo) {
        c = { geo, peak: 1 };
        this.chambers.set(id, c);
      }
      if (field === "gas") c.gas = el as SVGPolygonElement | null;
      else c.label = el as SVGTextElement | null;
    };
  }

  refSpring(id: Id, entry: SpringNodes, field: "g" | "coils" | "endB") {
    return (el: SVGGElement | null) => {
      let s = this.springs.get(id);
      if (!s || s.n !== entry.n || s.outerD !== entry.outerD) {
        s = { ...entry };
        this.springs.set(id, s);
      }
      s[field] = el;
    };
  }

  refTwo(kind: "rods" | "cables", id: Id, entry: Omit<TwoNodes, "el">) {
    return (el: SVGElement | null) => {
      this[kind].set(id, { ...entry, el });
    };
  }

  refDrag(field: "g" | "wire" | "ring") {
    return (el: SVGGElement | SVGLineElement | SVGCircleElement | null) => {
      if (field === "g") this.drag.g = el as SVGGElement | null;
      else if (field === "wire") this.drag.wire = el as SVGLineElement | null;
      else this.drag.ring = el as SVGCircleElement | null;
    };
  }

  refPartCallout(id: Id, label: Vec2, field: "line" | "dot") {
    return (el: SVGPathElement | SVGCircleElement | null) => {
      let c = this.partCallouts.get(id);
      if (!c || c.label !== label) {
        c = { label };
        this.partCallouts.set(id, c);
      }
      if (field === "line") c.line = el as SVGPathElement | null;
      else c.dot = el as SVGCircleElement | null;
      if (!el && !c.line && !c.dot) this.partCallouts.delete(id);
    };
  }

  setDrag(d: { part: Id; local: Vec2; finger: Vec2 } | null): void {
    this.dragState = d;
  }

  part(id: Id): PartNodes {
    let p = this.parts.get(id);
    if (!p) {
      p = { followers: new Set() };
      this.parts.set(id, p);
    }
    return p;
  }

  /** Escreve um quadro. `all` inclui as peças fixas (montagem e troca de zoom). */
  write(frame: FrameSource = this.frame, all = true): void {
    this.frame = frame;
    const { wallMm, shadowMm } = this.ctx;
    for (const m of this.model.partList) {
      if (!all && !m.dynamic) continue;
      const n = this.parts.get(m.key);
      const p = frame.pose(m.part.id);
      if (!n || !p) continue;
      const t = poseTransform(p);
      n.g?.setAttribute("transform", t);
      if (all || this.ctx.walls !== false)
        n.wall?.setAttribute("transform", poseTransform(p, wallMm, wallMm));
      n.shadow?.setAttribute("transform", poseTransform(p, shadowMm, shadowMm));
      for (const fl of n.followers) fl.setAttribute("transform", t);
    }
    const at = (e: { part: Id | null; at: Vec2 }, layer: number) => {
      const q = worldOf(e.part === null ? null : frame.pose(e.part), e.at);
      const d = ((e.part ? (this.model.parts.get(e.part)?.layer ?? layer) : layer) - layer) * this.spread;
      return [q[0] + d, q[1] - d] as Vec2;
    };
    for (const [id, s] of this.springs) {
      const layer = this.model.linkById.get(id)?.layer ?? 0;
      const a = at(s.a, layer);
      const b = at(s.b, layer);
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      s.g?.setAttribute("transform", `translate(${f(a[0])} ${f(a[1])}) rotate(${f(deg(ang))})`);
      s.coils?.setAttribute(
        "transform",
        `translate(${f(s.end)} 0) scale(${f(coilScale(L, s.n, s.outerD, s.solid))} 1)`,
      );
      s.endB?.setAttribute("transform", `translate(${f(L)} 0)`);
    }
    for (const [id, r] of this.rods) {
      const layer = this.model.linkById.get(id)?.layer ?? 0;
      const a = at(r.a, layer);
      const b = at(r.b, layer);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      r.el?.setAttribute("transform", `translate(${f(a[0])} ${f(a[1])}) rotate(${f(deg(ang))})`);
    }
    for (const [id, c] of this.cables) {
      const layer = this.model.linkById.get(id)?.layer ?? 0;
      c.el?.setAttribute("d", cablePath(at(c.a, layer), at(c.b, layer), c.max));
    }
    for (const [id, c] of this.chambers) {
      const st = frame.chamber(id);
      if (!st) continue;
      const link = c.geo.link;
      const body = link.body === null ? null : frame.pose(link.body);
      c.gas?.setAttribute("points", gasPolygon(c.geo, body, st.travel));
      const gauge = st.pressure - link.gas.p0;
      // opacidade pela pressão manométrica, saturando (a mesma ao voltar na régua)
      const g = Math.max(0, gauge);
      c.gas?.setAttribute("fill-opacity", f(Math.max(0.06, (0.85 * g) / (g + GAS_HALF_KPA))));
      if (c.label) {
        c.label.textContent = `${Math.round(st.pressure)} kPa`;
        const base = worldOf(body, link.at);
        c.label.setAttribute("x", f(base[0]));
        c.label.setAttribute("y", f(base[1] - link.bore / 2 - 6 * this.ctx.px));
      }
    }
    for (const [id, c] of this.partCallouts) {
      const p = frame.pose(id);
      if (!p || !c.line) continue;
      c.line.setAttribute("d", calloutPath(c.label, [p.x, p.y], this.ctx.px));
      c.dot?.setAttribute("cx", f(p.x));
      c.dot?.setAttribute("cy", f(p.y));
    }
    for (const [id, n] of this.locks) {
      const released = frame.lock?.(id) ?? false;
      if (released === n.released) continue;
      n.animation?.cancel();
      n.released = released;
      n.el.style.opacity = released ? "0" : "1";
      if (released && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        n.animation = n.el.animate(
          [
            { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
            {
              transform: `translate(${12 * this.ctx.px}px, ${-35 * this.ctx.px}px) rotate(35deg)`,
              opacity: 0,
            },
          ],
          { duration: 250, easing: "ease-out" },
        );
      }
    }
    for (const n of this.hiddenEnds.values()) {
      const p = worldOf(frame.pose(n.part), n.at);
      n.el.setAttribute("cx", f(p[0] + n.layer * this.spread));
      n.el.setAttribute("cy", f(p[1] - n.layer * this.spread));
    }
    for (const [id, el] of this.shafts) {
      const lm = this.model.linkById.get(id);
      if (!lm) continue;
      const q = worldOf(lm.carrier ? frame.pose(lm.carrier) : null, lm.at);
      const a = lm.span[0] * this.spread,
        b = lm.span[1] * this.spread;
      el.setAttribute("d", `M${q[0] + a} ${q[1] - a}L${q[0] + b} ${q[1] - b}`);
    }
    if (this.trailOn && frame.time !== undefined) {
      const points = new Map<Id, Vec2>();
      for (const [id, m] of this.model.parts) {
        if (
          (!m.dynamic && id !== this.trailSelected) ||
          this.trailHidden.includes(id) ||
          (this.trailLayer !== null && m.layer !== this.trailLayer)
        )
          continue;
        const p = frame.pose(id);
        if (p) points.set(id, worldOf(p, m.center));
      }
      const ids = this.trailHistory.update(frame.time, points, this.trailSelected);
      for (const [index, el] of this.trailPaths) {
        const id = ids[Math.floor(index / TRAIL_BANDS)];
        const d = (id ? (this.model.parts.get(id)?.layer ?? 0) : 0) * this.spread;
        el.setAttribute("d", id ? this.trailHistory.path(id, index % TRAIL_BANDS, frame.time, [d, -d]) : "");
        el.dataset.trailPart = id ?? "";
      }
    } else {
      this.trailHistory.clear();
      for (const el of this.trailPaths.values()) el.setAttribute("d", "");
    }
    this.writeDrag();
  }

  writeDrag(): void {
    const d = this.dragState;
    const { g, wire, ring } = this.drag;
    if (!g) return;
    if (!d) {
      g.setAttribute("visibility", "hidden");
      return;
    }
    const p = worldOf(this.frame.pose(d.part), d.local);
    g.setAttribute("visibility", "visible");
    wire?.setAttribute("x1", f(p[0]));
    wire?.setAttribute("y1", f(p[1]));
    wire?.setAttribute("x2", f(d.finger[0]));
    wire?.setAttribute("y2", f(d.finger[1]));
    ring?.setAttribute("cx", f(p[0]));
    ring?.setAttribute("cy", f(p[1]));
  }

  resetPeaks(): void {
    for (const c of this.chambers.values()) c.peak = 1;
  }
}
