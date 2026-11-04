import type { PartPose } from "@/engine/types";
import type { Vec2 } from "@/geometry/vec";
import type { Id } from "@/model/types";
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
}

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();
const deg = (a: number) => (a * 180) / Math.PI;
export const poseTransform = (p: PartPose, dx = 0, dy = 0) =>
  `translate(${f(p.x + dx)} ${f(p.y + dy)}) rotate(${f(deg(p.angle))})`;

export class StageNodes {
  model: SceneModel;
  ctx: WriteContext = { wallMm: 0.4, shadowMm: 0.6, px: 0.2 };
  /** quadro mostrado agora (o laço troca; o React reaplica depois de cada montagem) */
  frame: FrameSource;
  parts = new Map<Id, PartNodes>();
  springs = new Map<Id, SpringNodes>();
  rods = new Map<Id, TwoNodes>();
  cables = new Map<Id, TwoNodes>();
  chambers = new Map<Id, ChamberNodes>();
  world: SVGGElement | null = null;
  /** fio e anel do arrasto */
  drag: { g?: SVGGElement | null; wire?: SVGLineElement | null; ring?: SVGCircleElement | null } = {};
  dragState: { part: Id; local: Vec2; finger: Vec2 } | null = null;

  constructor(model: SceneModel) {
    this.model = model;
    this.frame = drawnFrame(model);
  }

  setContext(ctx: WriteContext): void {
    this.ctx = ctx;
  }

  setWorld(el: SVGGElement | null): void {
    this.world = el;
  }

  /** ref de um nó da peça */
  refPart(id: Id, field: "g" | "wall" | "shadow") {
    return (el: SVGGElement | null) => {
      this.part(id)[field] = el;
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
      const n = this.parts.get(m.part.id);
      const p = frame.pose(m.part.id);
      if (!n || !p) continue;
      const t = poseTransform(p);
      n.g?.setAttribute("transform", t);
      n.wall?.setAttribute("transform", poseTransform(p, wallMm, wallMm));
      n.shadow?.setAttribute("transform", poseTransform(p, shadowMm, shadowMm));
      for (const fl of n.followers) fl.setAttribute("transform", t);
    }
    const at = (e: { part: Id | null; at: Vec2 }) =>
      worldOf(e.part === null ? null : frame.pose(e.part), e.at);
    for (const s of this.springs.values()) {
      const a = at(s.a);
      const b = at(s.b);
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      s.g?.setAttribute("transform", `translate(${f(a[0])} ${f(a[1])}) rotate(${f(deg(ang))})`);
      s.coils?.setAttribute(
        "transform",
        `translate(${f(s.end)} 0) scale(${f(coilScale(L, s.n, s.outerD, s.solid))} 1)`,
      );
      s.endB?.setAttribute("transform", `translate(${f(L)} 0)`);
    }
    for (const r of this.rods.values()) {
      const a = at(r.a);
      const b = at(r.b);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      r.el?.setAttribute("transform", `translate(${f(a[0])} ${f(a[1])}) rotate(${f(deg(ang))})`);
    }
    for (const c of this.cables.values()) c.el?.setAttribute("d", cablePath(at(c.a), at(c.b), c.max));
    for (const [id, c] of this.chambers) {
      const st = frame.chamber(id);
      if (!st) continue;
      const link = c.geo.link;
      const body = link.body === null ? null : frame.pose(link.body);
      c.gas?.setAttribute("points", gasPolygon(c.geo, body, st.travel));
      const gauge = st.pressure - link.gas.p0;
      c.peak = Math.max(c.peak, gauge, 1);
      c.gas?.setAttribute("fill-opacity", f(Math.max(0.06, Math.min(0.85, (0.85 * gauge) / c.peak))));
      if (c.label) {
        c.label.textContent = `${Math.round(st.pressure)} kPa`;
        const base = worldOf(body, link.at);
        c.label.setAttribute("x", f(base[0]));
        c.label.setAttribute("y", f(base[1] - link.bore / 2 - 6 * this.ctx.px));
      }
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
