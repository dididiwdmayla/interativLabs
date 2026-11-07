import { buildPlan } from "@/engine/plan";
import { principalAxis } from "@/geometry/slot";
import type { Ring } from "@/geometry/polygon";
import { nextRef } from "@/model/ids";
import { P_ATM } from "@/model/units";
import type { ChamberLink, Link, Part, SensorAction, Vec2 } from "@/model/types";
import { locateInRing } from "@/geometry/polygon";
import { localOf, worldOf, type SceneModel } from "@/render/prepare";
import { idsFor, type Command } from "./commands";
import { type HammerPoint, type HammerTool } from "./hammer";
import { effective, frequencyPreset, SPRING_HZ } from "./linkPresets";
import { LINK_LABEL } from "./names";
import { snapAngle } from "./snap";

export function insertLink(link: Link): Command {
  return {
    label: `Cravar ${LINK_LABEL[link.kind].toLocaleLowerCase("pt-BR")} ${link.ref}`,
    recipe: (d) => {
      d.links.push(link);
    },
  };
}

/** Signed positions where a line crosses a closed ring, in world coordinates. */
function crossings(ring: Ring, origin: Vec2, u: Vec2): number[] {
  const out: number[] = [];
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length];
    if (!q) return;
    const x = p[0] - origin[0],
      y = p[1] - origin[1];
    const a = x * -u[1] + y * u[0];
    const b = (q[0] - origin[0]) * -u[1] + (q[1] - origin[1]) * u[0];
    if (a > 0 === b > 0 || Math.abs(a - b) < 1e-12) return;
    const t = a / (a - b);
    out.push((x + t * (q[0] - p[0])) * u[0] + (y + t * (q[1] - p[1])) * u[1]);
  });
  return out.sort((a, b) => a - b);
}

export interface DragLink {
  link: Link;
  warning?: string;
}
export function dragLink(
  model: SceneModel,
  tool: HammerTool,
  start: HammerPoint,
  end: HammerPoint,
  active: number,
): DragLink | null {
  const scene = model.scene,
    id = idsFor(scene).next("link"),
    ref = nextRef(scene);
  const dx = end.point[0] - start.point[0],
    dy = end.point[1] - start.point[1];
  const length = Math.hypot(dx, dy);
  if (length < 0.2) return null;
  if (tool === "spring" || tool === "rod" || tool === "cable") {
    const a = start.b?.part.id ?? null,
      b = end.b?.part.id ?? null;
    if (a === b) return null;
    const base = {
      id,
      ref,
      a,
      b,
      atA: localOf(start.b?.part, start.point),
      atB: localOf(end.b?.part, end.point),
    };
    if (tool === "rod") return { link: { ...base, kind: "rod" } };
    if (tool === "cable") return { link: { ...base, kind: "cable", maxLength: length } };
    const outerD = Math.max(1, Math.min(8, length / 5));
    return {
      link: {
        ...base,
        kind: "spring",
        ...frequencyPreset(effective(scene, a, b), SPRING_HZ.medium),
        freeLength: length,
        mode: "fixed",
        coil: { outerD, wireD: outerD / 12, turns: Math.max(3, Math.min(24, (length / outerD) * 1.5)) },
      },
    };
  }
  if (tool === "slider" && start.b) {
    let angle = snapAngle(Math.atan2(dy, dx)).angle;
    const axis = principalAxis(start.b.outline[0]?.outer ?? []);
    if (axis) {
      const a = Math.atan2(axis.u[1], axis.u[0]) + start.b.part.angle;
      const along = a + Math.round((angle - a) / Math.PI) * Math.PI;
      if (Math.abs(angle - along) < Math.PI / 45) angle = along;
    }
    return {
      link: {
        id,
        ref,
        kind: "slider",
        a: start.a?.part.id ?? null,
        b: start.b.part.id,
        at: localOf(start.b.part, start.point),
        dir: angle - start.b.part.angle,
        travel: [0, length],
      },
    };
  }
  if (tool !== "chamber") return null;
  return chamberLink(model, start, length, [dx / length, dy / length], active, id, ref);
}

/** Free interval of a ring set along a line, around s = 0 (the axis). */
function chordAround(rings: Ring[], origin: Vec2, n: Vec2): [number, number] | null {
  const hits = rings.flatMap((r) => crossings(r, origin, n)).sort((a, b) => a - b);
  let best: [number, number] | null = null;
  for (let i = 0; i + 1 < hits.length; i += 2) {
    const lo = hits[i] ?? 0,
      hi = hits[i + 1] ?? 0;
    const gap = lo > 0 ? lo : hi < 0 ? -hi : 0;
    const bestGap = best ? (best[0] > 0 ? best[0] : best[1] < 0 ? -best[1] : 0) : Infinity;
    if (gap < bestGap) best = [lo, hi];
  }
  return best;
}

/** Free gap (between material) of a ring set along a line, containing s = 0. */
function gapAround(rings: Ring[], origin: Vec2, n: Vec2): [number, number] | null {
  const hits = rings.flatMap((r) => crossings(r, origin, n));
  const up = Math.max(...hits.filter((v) => v < -0.01));
  const down = Math.min(...hits.filter((v) => v > 0.01));
  return Number.isFinite(up) && Number.isFinite(down) ? [up, down] : null;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Câmara pela regra de 07/11 (docs/arquitetura.md §6, "Como ficou na
 * implementação (Parte E2c)"): peça móvel sob o começo é a parede de trás
 * (com o conjunto aparafusado dela) e o corpo é a peça fixa por baixo, ou o
 * fundo; peça fixa sob o começo é o corpo. A parede da frente é a primeira
 * peça móvel que cruza a linha depois do começo, fora do conjunto de trás,
 * e que fecha pelo menos 80% do furo na transversal. O diâmetro é a largura
 * dela na transversal (o pistão encaixa no cilindro).
 */
function chamberLink(
  model: SceneModel,
  start: HammerPoint,
  length: number,
  u: Vec2,
  active: number,
  id: string,
  ref: number,
): DragLink {
  const scene = model.scene;
  const normal: Vec2 = [-u[1], u[0]];
  const layer = start.b?.layer ?? active;
  const plan = buildPlan(scene);
  const bodyOf = (pid: string) => plan.partRel.get(pid)?.body;
  const isStatic = (pid: string) => {
    const i = bodyOf(pid);
    return i === undefined || !!plan.bodies[i]?.static;
  };
  const rings = (m: (typeof model.partList)[number], holes = true) =>
    m.outline
      .flatMap((s) => (holes ? [s.outer, ...s.holes] : [s.outer]))
      .map((r) => r.map((p) => worldOf(m.part, p)));
  const along = (p: Vec2) => (p[0] - start.point[0]) * u[0] + (p[1] - start.point[1]) * u[1];
  const sameLayer = model.partList.filter((m) => m.layer === layer);
  const under = (m: (typeof sameLayer)[number]) =>
    m.outline.some((s) => locateInRing(localOf(m.part, start.point), s.outer) !== "outside");

  let body: Part | null = null;
  let back: { part: string; index: number; face: number } | null = null;
  const startPart = start.b;
  if (startPart && !isStatic(startPart.part.id)) {
    const index = bodyOf(startPart.part.id) ?? -1;
    // the set member whose forward face sits at the start (the engine reads the part's extreme on the axis)
    for (const m of sameLayer) {
      if (bodyOf(m.part.id) !== index) continue;
      const face = Math.max(...rings(m, false).flat().map(along));
      if (!back || Math.abs(face) < Math.abs(back.face)) back = { part: m.part.id, index, face };
    }
    body =
      sameLayer
        .slice()
        .reverse()
        .find((m) => isStatic(m.part.id) && under(m))?.part ?? null;
  } else if (startPart) body = startPart.part;

  const bodyModel = body
    ? model.partList.find((m) => m.part.id === body?.id && m.layer === layer)
    : undefined;
  const backSet = back ? sameLayer.filter((m) => bodyOf(m.part.id) === back?.index) : [];
  const backModel = backSet.find((m) => m.part.id === back?.part);
  const station = (t: number): Vec2 => [start.point[0] + u[0] * t, start.point[1] + u[1] * t];
  /** the bore at a station: free gap in the body, else in the back set (a sliding tube), else the back face */
  const boreAt = (t: number) => {
    const at = station(t);
    if (bodyModel) {
      const gap = gapAround(rings(bodyModel), at, normal);
      return gap && { gap, cylinder: true };
    }
    const tube = gapAround(
      backSet.flatMap((m) => rings(m)),
      at,
      normal,
    );
    if (tube) return { gap: tube, cylinder: true };
    const face = backModel && back ? chordAround(rings(backModel), station(back.face - 0.1), normal) : null;
    return face && { gap: face, cylinder: false };
  };

  const candidates = sameLayer
    .filter((m) => !isStatic(m.part.id) && bodyOf(m.part.id) !== back?.index)
    .map((m) => {
      const ts = rings(m, false)
        .flatMap((r) => crossings(r, start.point, u))
        .filter((t) => t >= -0.2);
      const first = Math.min(...ts.filter((t) => t <= length + 0.2));
      return { m, first, last: Math.max(...ts) };
    })
    .filter((c) => Number.isFinite(c.first))
    .sort((a, b) => a.first - b.first);
  let front: { part: string; width: number; station: number } | null = null;
  for (const c of candidates) {
    // a face pode ser redonda (esfera): mede ao longo da peça e fica com a maior vedação
    let best: { width: number; station: number; closes: boolean; overlap: number } | null = null;
    const span = Math.max(0, c.last - c.first - 0.2);
    for (let k = 0; k <= 32; k++) {
      const t = c.first + 0.1 + (span * k) / 32;
      const chord = chordAround(rings(c.m), station(t), normal);
      if (!chord) continue;
      const reference = boreAt(t);
      const ref = reference?.gap;
      const overlap = ref ? Math.min(chord[1], ref[1]) - Math.max(chord[0], ref[0]) : chord[1] - chord[0];
      // the piston fits in the cylinder: only the face inside the bore counts
      const width = reference?.cylinder ? overlap : chord[1] - chord[0];
      const closes = !ref || overlap >= 0.8 * (ref[1] - ref[0]);
      if (!best || overlap > best.overlap + 1e-9) best = { width, station: t, closes, overlap };
    }
    if (!best?.closes) continue;
    front = { part: c.m.part.id, width: best.width, station: best.station };
    break;
  }
  const vao = bodyModel
    ? (gapAround(rings(bodyModel), station(front?.station ?? length / 2), normal) ??
      gapAround(rings(bodyModel), station(length / 2), normal))
    : null;
  const walls = [
    ...(front ? [{ part: front.part, seal: length }] : []),
    ...(back ? [{ part: back.part, seal: length }] : []),
  ];
  const vaoWidth = vao ? vao[1] - vao[0] : null;
  const bore = round2(front?.width ?? vaoWidth ?? 6);
  const link: ChamberLink = {
    id,
    ref,
    kind: "chamber",
    body: body?.id ?? null,
    at: localOf(body, start.point),
    dir: Math.atan2(u[1], u[0]) - (body?.angle ?? 0),
    bore,
    length,
    walls,
    vents: [],
    ports: [],
    gas: { model: "adiabatic", gamma: 1.4, p0: P_ATM, charge: { amount: 0.5, burnMs: 1, shots: 1 } },
  };
  const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return {
    link,
    warning: !front
      ? "Toque na parede"
      : vaoWidth !== null && Math.abs(bore - vaoWidth) > 0.1 * vaoWidth
        ? `O pistão mede ${fmt(bore)} mm e o vão do corpo ${fmt(round2(vaoWidth))} mm; confira o diâmetro no cartão`
        : undefined,
  };
}

export function sensorLink(
  model: SceneModel,
  hit: HammerPoint,
  actions: SensorAction[] = [],
  active?: number,
): Link | null {
  const host = hit.b;
  if (!host) return null;
  const layer = active === undefined ? host.part.layer : (model.scene.layers[active]?.id ?? host.part.layer);
  return {
    id: idsFor(model.scene).next("link"),
    ref: nextRef(model.scene),
    kind: "sensor",
    host: host.part.id,
    at: localOf(host.part, hit.point),
    r: 2,
    layers: [layer, layer],
    minSpeed: 0,
    actions,
  };
}
