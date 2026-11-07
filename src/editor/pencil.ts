import type { Draft } from "immer";
import { MIN_AREA, difference, intersection, union } from "@/geometry/clip";
import {
  area,
  cleanShape,
  containsPoint,
  transformShape,
  type PolyWithHoles,
  type Ring,
} from "@/geometry/polygon";
import {
  loopRegion,
  ruledPoints,
  rule,
  smoothStroke,
  splitByLine,
  strokeLoop,
  strokeRegion,
  totalArea,
} from "@/geometry/stroke";
import { distToSegment, type Vec2 } from "@/geometry/vec";
import { nextRef } from "@/model/ids";
import { surfaces } from "@/model/profiles";
import type { Link, Part, Scene, Shape } from "@/model/types";
import { localOf, worldOf, type PartModel, type SceneModel } from "@/render/prepare";
import { dependentLinks, idsFor, type Command } from "./commands";
import { linkName, nextPartName, partName, plural } from "./names";

/**
 * Lápis (docs/arquitetura.md §6, Parte E2c): dois controles — Contorno ou
 * Traço, Somar ou Tirar — mais a largura do traço e a régua. Age na peça
 * escolhida, no perfil da camada ativa; sem peça escolhida, na mais alta da
 * camada ativa sob o começo do traço. Somar onde não há peça da camada ativa
 * cria uma peça nova. Sem DOM: o palco manda o rastro em mm.
 */

export interface PencilTool {
  form: "contour" | "stroke";
  op: "add" | "cut";
  /** largura do traço, mm */
  width: number;
  ruler: boolean;
}

export const PENCIL_WIDTHS = [1, 2, 3, 5];
export const DEFAULT_PENCIL: PencilTool = { form: "contour", op: "cut", width: 2, ruler: false };
export const FREEFORM_NOTICE = "Virou forma livre: o tamanho agora estica, não regenera";

/** Superfície (perfil) que o Lápis edita. */
export interface PencilTarget {
  part: Part;
  /** id da camada do perfil */
  layer: string;
  /** contorno no mundo */
  world: PolyWithHoles[];
}

export interface PencilInput {
  /** rastro em mm, no mundo */
  points: Vec2[];
  /** toque (sem arrastar): na borracha, um furo redondo */
  tap: boolean;
  /** mm por px de tela */
  px: number;
}

export type PencilPlan =
  | { kind: "none"; reason: string }
  | {
      kind: "ready";
      target: PencilTarget | null;
      /** formas finais da superfície, no mundo */
      result: PolyWithHoles[];
      /** o que entra (ouro) e o que sai (brasa), no mundo */
      added: PolyWithHoles[];
      removed: PolyWithHoles[];
      /** traço final (já suavizado), no mundo */
      line: Vec2[];
      op: "add" | "cut";
    }
  | {
      kind: "sides";
      target: PencilTarget;
      /** os dois lados do traço */
      sides: [PolyWithHoles[], PolyWithHoles[]];
      /** Tirar: o lado que sai; Somar: o lado que entra */
      pick: 0 | 1;
      line: Vec2[];
      op: "add" | "cut";
    };

const asShapes = (outline: PolyWithHoles[], m: Part): PolyWithHoles[] =>
  outline.map((s) => transformShape(s, m.x, m.y, m.angle));

/** A superfície da peça na camada ativa. */
export function surfaceModel(model: SceneModel, partId: string, layer: number): PartModel | undefined {
  return model.partList.find((m) => m.part.id === partId && m.layer === layer);
}

/** Peça escolhida no perfil da camada ativa; sem ela, a mais alta da camada ativa sob o ponto. */
export function pencilTarget(
  model: SceneModel,
  active: number,
  selected: string | null,
  at: Vec2 | null,
): PencilTarget | null {
  const layer = model.scene.layers[active];
  if (!layer || layer.locked || !layer.visible) return null;
  let m = selected ? surfaceModel(model, selected, active) : undefined;
  if (!m && at)
    m = model.partList
      .slice()
      .reverse()
      .find((q) => q.layer === active && q.outline.some((s) => containsPoint(s, localOf(q.part, at), 0.05)));
  if (!m) return null;
  return { part: m.part, layer: layer.id, world: asShapes(m.outline, m.part) };
}

const overlaps = (a: PolyWithHoles[], b: PolyWithHoles[]) => {
  const i = intersection(a, b);
  return i.ok && totalArea(i.value) >= MIN_AREA;
};

/** A peça mais alta da camada ativa que a região toca (Somar sem peça sob o começo). */
function touching(model: SceneModel, active: number, region: PolyWithHoles[]): PencilTarget | null {
  const layer = model.scene.layers[active];
  if (!layer) return null;
  for (const m of model.partList.slice().reverse()) {
    if (m.layer !== active) continue;
    const world = asShapes(m.outline, m.part);
    if (overlaps(world, region)) return { part: m.part, layer: layer.id, world };
  }
  return null;
}

/** Do rastro ao plano: a região, o lado e o que muda. */
export function pencilPlan(
  model: SceneModel,
  tool: PencilTool,
  input: PencilInput,
  active: number,
  selected: string | null,
): PencilPlan {
  const pts = input.points;
  const first = pts[0];
  if (!first) return { kind: "none", reason: "Desenhe sobre a prancha" };
  let target = pencilTarget(model, active, selected, first);
  const o = { px: input.px };

  if (tool.form === "stroke") {
    let line: Vec2[];
    let closed = false;
    if (input.tap || pts.length < 2) line = [first];
    else {
      const loop = strokeLoop(pts, input.px);
      closed = !!loop && loop.length === pts.length;
      const sm = smoothStroke(closed && loop ? loop : pts, { closed, px: o.px });
      line = tool.ruler ? ruledPoints(rule(sm, { closed, px: o.px })) : sm.points;
      if (tool.ruler && line.length > 2 && rule(sm, { closed, px: o.px }).kind === "circle") closed = true;
    }
    const region = strokeRegion(line, tool.width, closed);
    if (!region.length) return { kind: "none", reason: "Traço curto demais" };
    // o traço que não encosta na peça escolhida faz peça nova (Somar) ou não faz nada (Tirar)
    if (target && !overlaps(target.world, region)) target = tool.op === "add" ? null : target;
    if (!target) target = touching(model, active, region);
    return finishPlan(target, region, tool.op, line);
  }

  // Contorno: laço fechado, ou traço aberto de borda a borda
  const loop = strokeLoop(pts, input.px);
  if (loop) {
    const sm = smoothStroke(loop, { closed: true, px: o.px });
    const ring = tool.ruler ? ruledPoints(rule(sm, { closed: true, px: o.px })) : sm.points;
    const region = loopRegion(ring);
    if (!region.length) return { kind: "none", reason: "O laço é pequeno demais" };
    // laço solto, longe da peça escolhida: peça nova; laço que encosta numa peça: une a ela
    if (target && tool.op === "add" && !overlaps(target.world, region)) target = null;
    if (!target) target = touching(model, active, region);
    return finishPlan(target, region, tool.op, ring);
  }
  const sm = smoothStroke(pts, { closed: false, px: o.px });
  const line = tool.ruler ? ruledPoints(rule(sm, { closed: false, px: o.px })) : sm.points;
  if (!target) {
    const at = line[Math.floor(line.length / 2)] ?? first;
    target = pencilTarget(model, active, selected, at);
  }
  if (!target)
    return {
      kind: "none",
      reason: tool.op === "add" ? "Feche o contorno para criar uma peça" : "Comece o corte sobre uma peça",
    };
  if (tool.op === "cut") {
    const split = splitByLine(target.world, extendEnds(line, 0.05));
    if (!split || !split.left.length || !split.right.length)
      return { kind: "none", reason: "O traço precisa entrar e sair da peça" };
    const pick = totalArea(split.left) <= totalArea(split.right) ? 0 : 1;
    return { kind: "sides", target, sides: [split.left, split.right], pick, line, op: "cut" };
  }
  // Somar por fora, de borda a borda: a região entre o traço e o contorno
  const closedLoop = loopRegion(line);
  const outside = difference(closedLoop, target.world);
  if (!outside.ok || totalArea(outside.value) < MIN_AREA)
    return { kind: "none", reason: "O traço precisa sair da peça e voltar" };
  const pieces = outside.value.filter((s) => area(s) >= MIN_AREA);
  const split = splitByLine(pieces, line);
  const left = split?.left ?? pieces;
  const right = split?.right ?? [];
  const pick = totalArea(left) >= totalArea(right) ? 0 : 1;
  return { kind: "sides", target, sides: [left, right], pick, line, op: "add" };
}

/** Pontas do traço esticadas um pouco: um traço que termina na borda ainda atravessa. */
function extendEnds(line: Vec2[], d: number): Vec2[] {
  if (line.length < 2) return line;
  const a = line[0];
  const b = line[1];
  const y = line[line.length - 1];
  const z = line[line.length - 2];
  if (!a || !b || !y || !z) return line;
  const ext = (p: Vec2, q: Vec2): Vec2 => {
    const L = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1;
    return [p[0] + ((p[0] - q[0]) / L) * d, p[1] + ((p[1] - q[1]) / L) * d];
  };
  return [ext(a, b), ...line, ext(y, z)];
}

function finishPlan(
  target: PencilTarget | null,
  region: PolyWithHoles[],
  op: "add" | "cut",
  line: Vec2[],
): PencilPlan {
  if (op === "cut") {
    if (!target) return { kind: "none", reason: "Tirar precisa de uma peça da camada ativa" };
    const d = difference(target.world, region);
    const removed = intersection(target.world, region);
    if (!d.ok || !removed.ok || totalArea(removed.value) < MIN_AREA)
      return { kind: "none", reason: "O traço não passou pela peça" };
    return {
      kind: "ready",
      target,
      result: d.value.filter((s) => area(s) >= MIN_AREA),
      added: [],
      removed: removed.value,
      line,
      op,
    };
  }
  if (!target) return { kind: "ready", target: null, result: region, added: region, removed: [], line, op };
  const u = union(target.world, region);
  if (!u.ok) return { kind: "none", reason: u.error.message };
  return { kind: "ready", target, result: u.value, added: region, removed: [], line, op };
}

/** Formas finais de um plano com lados (o lado escolhido sai, ou entra). */
export function resolveSides(plan: Extract<PencilPlan, { kind: "sides" }>): PolyWithHoles[] {
  const chosen = plan.sides[plan.pick];
  const other = plan.sides[plan.pick === 0 ? 1 : 0];
  if (plan.op === "cut") return other;
  const u = union(plan.target.world, chosen);
  return u.ok ? u.value : plan.target.world;
}

/** Lado sob o ponto (tocar num lado também escolhe). */
export function sideAt(plan: Extract<PencilPlan, { kind: "sides" }>, p: Vec2): 0 | 1 | null {
  for (const i of [0, 1] as const) if (plan.sides[i].some((s) => containsPoint(s, p, 0.05))) return i;
  return null;
}

// ——— comando ———

const round = (v: number) => Math.round(v * 1e4) / 1e4;

/** Forma do mundo para o espaço local da peça, limpa e arredondada. */
function toLocal(s: PolyWithHoles, pose: { x: number; y: number; angle: number } | null): Shape {
  const ring = (r: Ring) => r.map((p) => localOf(pose, p)).map((p): Vec2 => [round(p[0]), round(p[1])]);
  const c = cleanShape({ outer: ring(s.outer), holes: s.holes.map(ring) });
  return { kind: "poly", outer: c.outer, holes: c.holes };
}

interface AnchorUse {
  field: "a" | "b" | "host" | "body";
  /** ponto no espaço local da peça cortada */
  at: Vec2;
}

/** Os pontos de uma ligação presos à peça (no espaço local dela). */
function anchorsOn(scene: Scene, l: Link, partId: string): AnchorUse[] {
  const pose = (id: string | null) => (id ? (scene.parts.find((p) => p.id === id) ?? null) : null);
  const via = (from: string | null, at: Vec2): Vec2 => localOf(pose(partId), worldOf(pose(from), at));
  switch (l.kind) {
    case "screw":
    case "lock":
    case "axle":
    case "mount":
    case "slider": {
      const out: AnchorUse[] = [];
      if (l.b === partId) out.push({ field: "b", at: l.at });
      if (l.a === partId) out.push({ field: "a", at: via(l.b, l.at) });
      return out;
    }
    case "pin":
    case "sensor":
      return l.host === partId ? [{ field: "host", at: l.at }] : [];
    case "rod":
    case "cable":
    case "spring": {
      const out: AnchorUse[] = [];
      if (l.a === partId) out.push({ field: "a", at: l.atA });
      if (l.b === partId) out.push({ field: "b", at: l.atB });
      return out;
    }
    case "chamber":
      return l.body === partId ? [{ field: "body", at: l.at }] : [];
    case "slot":
      return [];
  }
}

const distTo = (s: Shape, p: Vec2): number => {
  if (s.kind !== "poly") return Infinity;
  const shape = { outer: s.outer, holes: s.holes };
  if (containsPoint(shape, p, 0.05)) return 0;
  let d = Infinity;
  for (const ring of [s.outer, ...s.holes])
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length];
      if (b) d = Math.min(d, distToSegment(p, a, b));
    });
  return d;
};

const ringCentre = (r: Ring): Vec2 => [
  r.reduce((s, p) => s + p[0], 0) / r.length,
  r.reduce((s, p) => s + p[1], 0) / r.length,
];

export type PencilCommit =
  | { kind: "command"; command: Command; selection: string | null }
  | { kind: "offer"; reason: string }
  | { kind: "none"; reason: string };

/** Ponto mais longe que isso de todas as partes: a ligação perdeu a peça. */
const LOST_MM = 0.5;

/**
 * O comando de um plano. Uma parte: a forma muda (peça paramétrica vira
 * forma livre). Várias partes soltas: viram peças (a maior fica com o id),
 * cada ligação com a parte que contém o ponto dela; ligação que perde a peça
 * sai no mesmo comando, com aviso. Peça multicamada só separa com
 * `separate` (a interface oferece "Separar em peça").
 */
export function pencilCommit(
  scene: Scene,
  target: PencilTarget | null,
  resultWorld: PolyWithHoles[],
  op: "add" | "cut",
  opts: { separate?: boolean } = {},
): PencilCommit {
  const pieces = resultWorld.filter((s) => area(s) >= MIN_AREA).sort((a, b) => area(b) - area(a));
  if (!target) return { kind: "none", reason: "Sem peça da camada ativa" };
  if (!pieces.length) return { kind: "none", reason: "O corte tiraria a peça inteira" };
  const part = target.part;
  const multi = !!part.profiles?.length;
  if (pieces.length > 1 && multi && !opts.separate)
    return {
      kind: "offer",
      reason: `O corte deixa ${plural(pieces.length, "parte solta", "partes soltas")} no perfil desta camada`,
    };
  const shapes = pieces.map((s) => toLocal(s, part));
  const surface = surfaces(part).find((s) => s.layer === target.layer);
  const wasParametric = !!surface?.source;
  const ids = idsFor(scene);
  let ref = nextRef(scene);
  const extra: Part[] = shapes.slice(1).map((shape, i) => ({
    id: ids.next("part"),
    ref: ref++,
    name: `${partName(part)} (parte ${i + 2})`,
    layer: target.layer,
    x: part.x,
    y: part.y,
    angle: part.angle,
    shape,
    material: surface?.material ?? part.material,
    fixed: part.fixed,
    fast: part.fast,
  }));
  const owners = [part.id, ...extra.map((p) => p.id)];
  // ligações: cada uma fica com a parte que contém o ponto dela
  const moves = new Map<string, Partial<Record<AnchorUse["field"], string>>>();
  const lost = new Set<string>();
  const slotMoves = new Map<string, { guide: string; hole: number }>();
  const oldShape = surface?.shape;
  for (const l of scene.links) {
    if (multi && linkSurface(scene, l, part) !== target.layer) continue;
    for (const a of anchorsOn(scene, l, part.id)) {
      const d = shapes.map((s) => distTo(s, a.at));
      const best = d.indexOf(Math.min(...d));
      if (!((d[best] ?? Infinity) <= LOST_MM)) lost.add(l.id);
      else if (best > 0) moves.set(l.id, { ...moves.get(l.id), [a.field]: owners[best] });
    }
    if (l.kind === "slot" && l.guide === part.id && oldShape && oldShape.kind !== "gear") {
      const old = oldShape.holes[l.hole];
      const found = old ? findHole(shapes, old) : null;
      if (!found) lost.add(l.id);
      else slotMoves.set(l.id, { guide: owners[found.piece] ?? part.id, hole: found.hole });
    }
  }
  const removed = dependentLinks(scene, new Set(), lost);
  const verb = op === "cut" ? "Recortar" : "Somar a";
  const label = `${verb} ${partName(part)}${extra.length ? ` em ${extra.length + 1} peças` : ""}`;
  const warnings: string[] = [];
  if (extra.length) warnings.push(`O corte separou ${partName(part)} em ${extra.length + 1} peças`);
  if (removed.size)
    warnings.push(
      `${plural(removed.size, "ligação perdeu", "ligações perderam")} a peça e ${removed.size > 1 ? "saíram" : "saiu"}: ${[
        ...removed,
      ]
        .map((id) => scene.links.find((l) => l.id === id))
        .filter((l): l is Link => !!l)
        .map(linkName)
        .join(", ")}`,
    );
  const notice = wasParametric ? FREEFORM_NOTICE : undefined;
  return {
    kind: "command",
    selection: part.id,
    command: {
      label,
      warning: warnings.length ? [...warnings, ...(notice ? [notice] : [])].join(". ") : undefined,
      notice,
      recipe: (d) => {
        const q = d.parts.find((p) => p.id === part.id);
        if (!q) return;
        const s = q.profiles?.find((p) => p.layer === target.layer) ?? q;
        s.shape = shapes[0] as Draft<Shape>;
        delete s.source;
        d.parts.push(...(extra as Draft<Part>[]));
        d.links = d.links.filter((l) => !removed.has(l.id));
        for (const l of d.links) {
          const m = moves.get(l.id);
          if (m) Object.assign(l, m);
          const sm = slotMoves.get(l.id);
          if (sm && l.kind === "slot") {
            l.guide = sm.guide;
            l.hole = sm.hole;
            if (sm.guide !== part.id) delete l.profile;
          }
          if (l.kind === "sensor") l.actions = l.actions.filter((a) => !removed.has(a.target));
          if (l.kind === "chamber") l.ports = l.ports.filter((p) => !removed.has(p.to));
        }
      },
    },
  };
}

/** Camada da superfície que uma ligação usa nesta peça. */
function linkSurface(scene: Scene, l: Link, part: Part): string {
  if (l.kind === "slot") return part.profiles?.find((p) => p.id === l.profile)?.layer ?? part.layer;
  const layers = scene.layers.map((x) => x.id);
  const own = surfaces(part).map((s) => s.layer);
  // a camada inferida da ligação (a mais alta das peças nas pontas), se a peça tiver perfil nela
  const ends = ("host" in l ? [l.host] : "body" in l ? [l.body] : [l.a, l.b]).map(
    (id) => scene.parts.find((p) => p.id === id)?.layer,
  );
  const top = layers.filter((id) => ends.includes(id)).at(-1);
  return top && own.includes(top) ? top : part.layer;
}

/** O furo novo que corresponde a um furo antigo (mesmo centro e área a 2%). */
function findHole(shapes: Shape[], old: Ring): { piece: number; hole: number } | null {
  const c = ringCentre(old);
  const a = Math.abs(area({ outer: old, holes: [] }));
  for (let i = 0; i < shapes.length; i++) {
    const s = shapes[i];
    if (!s || s.kind !== "poly") continue;
    for (let j = 0; j < s.holes.length; j++) {
      const h = s.holes[j];
      if (!h) continue;
      const hc = ringCentre(h);
      const ha = Math.abs(area({ outer: h, holes: [] }));
      if (Math.hypot(hc[0] - c[0], hc[1] - c[1]) < 0.05 && Math.abs(ha - a) <= 0.02 * a)
        return { piece: i, hole: j };
    }
  }
  return null;
}

/** Peça nova desenhada à mão: aço, solta, na camada ativa, origem no centro da caixa. */
export function newPartCommand(scene: Scene, layer: string, region: PolyWithHoles[]): PencilCommit {
  const pieces = region.filter((s) => area(s) >= MIN_AREA).sort((a, b) => area(b) - area(a));
  if (!pieces.length) return { kind: "none", reason: "A forma é pequena demais" };
  const ids = idsFor(scene);
  let ref = nextRef(scene);
  const parts: Part[] = pieces.map((s) => {
    const xs = s.outer.map((p) => p[0]);
    const ys = s.outer.map((p) => p[1]);
    const x = round((Math.min(...xs) + Math.max(...xs)) / 2);
    const y = round((Math.min(...ys) + Math.max(...ys)) / 2);
    const pose = { x, y, angle: 0 };
    return {
      id: ids.next("part"),
      ref: ref++,
      name: "",
      layer,
      x,
      y,
      angle: 0,
      shape: toLocal(s, pose),
      material: "steel",
      fixed: false,
      fast: false,
    };
  });
  const named = { ...scene, parts: [...scene.parts] };
  for (const p of parts) {
    p.name = nextPartName(named, "Peça à mão");
    named.parts.push(p);
  }
  const first = parts[0];
  if (!first) return { kind: "none", reason: "A forma é pequena demais" };
  return {
    kind: "command",
    selection: first.id,
    command: {
      label: `Desenhar ${partName(first)}`,
      notice: parts.length > 1 ? `O desenho virou ${parts.length} peças` : undefined,
      recipe: (d) => {
        d.parts.push(...(parts as Draft<Part>[]));
      },
    },
  };
}

/** Comando final de um plano pronto (ou com o lado escolhido). */
export function commitPlan(
  scene: Scene,
  plan: Exclude<PencilPlan, { kind: "none" }>,
  layer: string,
  opts: { separate?: boolean } = {},
): PencilCommit {
  if (plan.kind === "sides") return pencilCommit(scene, plan.target, resolveSides(plan), plan.op, opts);
  if (!plan.target) return newPartCommand(scene, layer, plan.result);
  return pencilCommit(scene, plan.target, plan.result, plan.op, opts);
}

/** Área (mm²) que entra e sai, para a frase. */
export function planAreas(plan: Exclude<PencilPlan, { kind: "none" }>): { added: number; removed: number } {
  if (plan.kind === "ready") return { added: totalArea(plan.added), removed: totalArea(plan.removed) };
  const a = totalArea(plan.sides[plan.pick]);
  return plan.op === "cut" ? { added: 0, removed: a } : { added: a, removed: 0 };
}
