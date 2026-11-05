import { setShape, idsFor, type Command } from "@/editor/commands";
import { nextPartName } from "@/editor/names";
import { rack, ratchet } from "@/geometry/gear";
import type { Ring } from "@/geometry/polygon";
import { arcPoints, circleRing, slotRing } from "@/geometry/primitives";
import { nextRef, type Random } from "@/model/ids";
import type { MaterialId } from "@/model/materials";
import type { Part, Scene, Shape, Vec2 } from "@/model/types";

/**
 * Peças prontas da gaveta (docs/arquitetura.md §6, "Inserir e conectar"):
 * geradores paramétricos. A peça guarda `source.generator` e os parâmetros,
 * então mudar o tamanho refaz a forma. Formas centradas na origem local.
 * Sem DOM: roda no Node (src/parts/parts.test.ts).
 */

export interface ParamDef {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
  integer?: boolean;
}

/** Alça de esticar: distância do centro ao longo de um eixo local ↔ valor do parâmetro. */
export interface HandleDef {
  param: string;
  axis: "x" | "y";
  /** distância da alça ao centro, mm */
  dist: (p: Params) => number;
  /** valor do parâmetro para a alça a `d` mm do centro */
  value: (d: number, p: Params) => number;
}

export type Params = Record<string, number>;

export interface Generator {
  id: string;
  /** nome na gaveta e base do nome da peça ("Barra 3") */
  name: string;
  /** uma linha: o que a peça é */
  blurb: string;
  material: MaterialId;
  params: ParamDef[];
  /** parâmetros principais no cartão rápido (os primeiros, em ordem) */
  main: string[];
  handles: HandleDef[];
  /** detecção contínua (esfera) */
  fast?: boolean;
  build: (p: Params) => Shape;
}

const DEG = Math.PI / 180;

/** Retângulo com cantos arredondados, centrado. */
function roundedRect(w: number, h: number, r: number): Ring {
  const rr = Math.max(0, Math.min(r, w / 2 - 0.01, h / 2 - 0.01));
  if (rr <= 0.01)
    return [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ];
  const x = w / 2 - rr;
  const y = h / 2 - rr;
  return [
    ...arcPoints([x, -y], rr, -Math.PI / 2, 0),
    ...arcPoints([x, y], rr, 0, Math.PI / 2),
    ...arcPoints([-x, y], rr, Math.PI / 2, Math.PI),
    ...arcPoints([-x, -y], rr, Math.PI, (3 * Math.PI) / 2),
  ];
}

/** Barra de pontas arredondadas (estádio), centrada no eixo x. */
function stadium(l: number, w: number): Ring {
  const L = Math.max(l, w + 0.02);
  return slotRing([-L / 2 + w / 2, 0], [L / 2 - w / 2, 0], w);
}

const poly = (outer: Ring, holes: Ring[] = []): Shape => ({ kind: "poly", outer, holes });

const half = (k: string): Pick<HandleDef, "dist" | "value"> => ({
  dist: (p) => p[k]! / 2,
  value: (d) => 2 * d,
});

/** Módulo da catraca para o diâmetro externo (proporções de ratchetFromGearShape). */
const ratchetModule = (D: number, z: number) => D / 2 / (z / 2 + 0.2 * Math.PI);

export const GENERATORS: Generator[] = [
  {
    id: "plate",
    name: "Placa",
    blurb: "Chapa retangular de cantos arredondados",
    material: "aluminum",
    params: [
      { key: "w", label: "Largura", unit: "mm", min: 6, max: 400, step: 1, default: 60 },
      { key: "h", label: "Altura", unit: "mm", min: 6, max: 400, step: 1, default: 40 },
      { key: "r", label: "Raio do canto", unit: "mm", min: 0, max: 40, step: 0.5, default: 3 },
    ],
    main: ["w", "h"],
    handles: [
      { param: "w", axis: "x", ...half("w") },
      { param: "h", axis: "y", ...half("h") },
    ],
    build: (p) => poly(roundedRect(p.w!, p.h!, p.r!)),
  },
  {
    id: "bar",
    name: "Barra",
    blurb: "Barra reta de pontas arredondadas",
    material: "steel",
    params: [
      { key: "l", label: "Comprimento", unit: "mm", min: 6, max: 400, step: 1, default: 80 },
      { key: "w", label: "Largura", unit: "mm", min: 2, max: 40, step: 0.5, default: 8 },
    ],
    main: ["l", "w"],
    handles: [
      { param: "l", axis: "x", ...half("l") },
      { param: "w", axis: "y", ...half("w") },
    ],
    build: (p) => poly(stadium(p.l!, p.w!)),
  },
  {
    id: "disc",
    name: "Disco",
    blurb: "Disco cheio",
    material: "aluminum",
    params: [{ key: "d", label: "Diâmetro", unit: "mm", min: 2, max: 300, step: 1, default: 30 }],
    main: ["d"],
    handles: [{ param: "d", axis: "x", ...half("d") }],
    build: (p) => ({ kind: "circle", r: p.d! / 2, holes: [] }),
  },
  {
    id: "block",
    name: "Bloco",
    blurb: "Bloco de cantos vivos",
    material: "steel",
    params: [
      { key: "w", label: "Largura", unit: "mm", min: 2, max: 300, step: 1, default: 20 },
      { key: "h", label: "Altura", unit: "mm", min: 2, max: 300, step: 1, default: 20 },
    ],
    main: ["w", "h"],
    handles: [
      { param: "w", axis: "x", ...half("w") },
      { param: "h", axis: "y", ...half("h") },
    ],
    build: (p) => poly(roundedRect(p.w!, p.h!, 0)),
  },
  {
    id: "lever",
    name: "Alavanca",
    blurb: "Barra com um furo em cada ponta",
    material: "steel",
    params: [
      { key: "l", label: "Comprimento", unit: "mm", min: 16, max: 400, step: 1, default: 60 },
      { key: "w", label: "Largura", unit: "mm", min: 4, max: 40, step: 0.5, default: 10 },
      { key: "d", label: "Furo", unit: "mm", min: 1, max: 30, step: 0.5, default: 4 },
    ],
    main: ["l", "w"],
    handles: [
      { param: "l", axis: "x", ...half("l") },
      { param: "w", axis: "y", ...half("w") },
    ],
    build: (p) => {
      const w = p.w!;
      const l = Math.max(p.l!, 2 * w);
      const d = Math.min(p.d!, w - 1.5);
      const c = l / 2 - w / 2;
      return poly(stadium(l, w), [circleRing([-c, 0], d / 2), circleRing([c, 0], d / 2)]);
    },
  },
  {
    id: "ball",
    name: "Esfera",
    blurb: "Esfera de aço, com detecção contínua",
    material: "steel",
    fast: true,
    params: [{ key: "d", label: "Diâmetro", unit: "mm", min: 1, max: 60, step: 0.5, default: 6 }],
    main: ["d"],
    handles: [{ param: "d", axis: "x", ...half("d") }],
    build: (p) => ({ kind: "circle", r: p.d! / 2, holes: [] }),
  },
  {
    id: "gear",
    name: "Engrenagem",
    blurb: "Evolvente: as do mesmo módulo engrenam",
    material: "brass",
    params: [
      { key: "teeth", label: "Dentes", unit: "", min: 8, max: 120, step: 1, default: 20, integer: true },
      { key: "module", label: "Módulo", unit: "mm", min: 0.5, max: 5, step: 0.25, default: 1 },
      { key: "bore", label: "Furo", unit: "mm", min: 0, max: 60, step: 0.5, default: 4 },
    ],
    main: ["teeth", "module"],
    handles: [
      {
        param: "teeth",
        axis: "x",
        dist: (p) => (p.module! * p.teeth!) / 2,
        value: (d, p) => Math.round((2 * d) / p.module!),
      },
    ],
    build: (p) => ({
      kind: "gear",
      module: p.module!,
      teeth: p.teeth!,
      pressureAngle: 20 * DEG,
      profile: "involute",
      bore: Math.min(p.bore!, p.module! * (p.teeth! - 3)),
    }),
  },
  {
    id: "ratchet",
    name: "Catraca",
    blurb: "Dente de serra: gira livre para um lado só",
    material: "steel",
    params: [
      { key: "teeth", label: "Dentes", unit: "", min: 6, max: 60, step: 1, default: 16, integer: true },
      { key: "d", label: "Diâmetro", unit: "mm", min: 10, max: 200, step: 1, default: 30 },
      { key: "bore", label: "Furo", unit: "mm", min: 0, max: 60, step: 0.5, default: 4 },
    ],
    main: ["d", "teeth"],
    handles: [{ param: "d", axis: "x", ...half("d") }],
    build: (p) => {
      const z = p.teeth!;
      const m = ratchetModule(p.d!, z);
      const bore = Math.min(p.bore!, p.d! * 0.5);
      if (p.mirror !== 1)
        return { kind: "gear", module: m, teeth: z, pressureAngle: 20 * DEG, profile: "ratchet", bore };
      // espelhada: a forma de engrenagem só gira para um lado; vira polígono
      const r = (m * z) / 2;
      const depth = (Math.PI * m) / 2;
      const g = ratchet({ teeth: z, outerRadius: r + 0.4 * depth, depth, bore });
      if (!g.ok)
        return { kind: "gear", module: m, teeth: z, pressureAngle: 20 * DEG, profile: "ratchet", bore };
      const flip = (ring: Ring) => ring.map(([x, y]) => [-x, y] as Vec2).reverse();
      return poly(flip(g.value.outline.outer), g.value.outline.holes.map(flip));
    },
  },
  {
    id: "rack",
    name: "Cremalheira",
    blurb: "Dentes retos para engrenar com o pinhão",
    material: "steel",
    params: [
      { key: "teeth", label: "Dentes", unit: "", min: 2, max: 80, step: 1, default: 10, integer: true },
      { key: "module", label: "Módulo", unit: "mm", min: 0.5, max: 5, step: 0.25, default: 1 },
      { key: "body", label: "Corpo", unit: "mm", min: 1, max: 40, step: 0.5, default: 4 },
    ],
    main: ["teeth", "module"],
    handles: [
      {
        param: "teeth",
        axis: "x",
        dist: (p) => (p.teeth! * Math.PI * p.module!) / 2,
        value: (d, p) => Math.round((2 * d) / (Math.PI * p.module!)),
      },
    ],
    build: (p) => {
      const m = p.module!;
      const r = rack({ module: m, teeth: p.teeth!, bodyHeight: p.body! });
      if (!r.ok) return poly(roundedRect(10, 4, 0));
      const L = r.value.length;
      const yb = -1.25 * m - p.body!;
      const cy = (yb + m) / 2;
      return poly(r.value.outline.outer.map(([x, y]) => [x - L / 2, y - cy] as Vec2));
    },
  },
  {
    id: "plate-hole",
    name: "Placa com furo",
    blurb: "Chapa com um furo redondo no meio",
    material: "aluminum",
    params: [
      { key: "w", label: "Largura", unit: "mm", min: 6, max: 400, step: 1, default: 40 },
      { key: "h", label: "Altura", unit: "mm", min: 6, max: 400, step: 1, default: 30 },
      { key: "d", label: "Furo", unit: "mm", min: 1, max: 200, step: 0.5, default: 6 },
    ],
    main: ["w", "h", "d"],
    handles: [
      { param: "w", axis: "x", ...half("w") },
      { param: "h", axis: "y", ...half("h") },
    ],
    build: (p) => {
      const d = Math.min(p.d!, Math.min(p.w!, p.h!) - 2);
      return poly(roundedRect(p.w!, p.h!, 2), [circleRing([0, 0], d / 2)]);
    },
  },
  {
    id: "plate-slot",
    name: "Placa com rasgo",
    blurb: "Chapa com um rasgo reto: guia para um pino",
    material: "aluminum",
    params: [
      { key: "w", label: "Largura", unit: "mm", min: 8, max: 400, step: 1, default: 40 },
      { key: "h", label: "Altura", unit: "mm", min: 6, max: 400, step: 1, default: 16 },
      { key: "sl", label: "Comprimento do rasgo", unit: "mm", min: 2, max: 380, step: 0.5, default: 20 },
      { key: "sw", label: "Largura do rasgo", unit: "mm", min: 1, max: 100, step: 0.25, default: 4 },
    ],
    main: ["w", "sl", "sw"],
    handles: [
      { param: "w", axis: "x", ...half("w") },
      { param: "h", axis: "y", ...half("h") },
    ],
    build: (p) => {
      const sw = Math.min(p.sw!, p.h! - 2);
      const sl = Math.max(sw + 0.02, Math.min(p.sl!, p.w! - 2));
      return poly(roundedRect(p.w!, p.h!, 2), [slotRing([-sl / 2 + sw / 2, 0], [sl / 2 - sw / 2, 0], sw)]);
    },
  },
];

const BY_ID = new Map(GENERATORS.map((g) => [g.id, g] as const));

export function generator(id: string | undefined): Generator | undefined {
  return id === undefined ? undefined : BY_ID.get(id);
}

export function defaults(g: Generator): Params {
  return Object.fromEntries(g.params.map((p) => [p.key, p.default]));
}

/** Parâmetros dentro das faixas (inteiros arredondados). */
export function clampParams(g: Generator, p: Params): Params {
  const out: Params = { ...p };
  for (const d of g.params) {
    let v = p[d.key] ?? d.default;
    if (!Number.isFinite(v)) v = d.default;
    v = Math.min(d.max, Math.max(d.min, v));
    out[d.key] = d.integer ? Math.round(v) : Math.round(v / (d.step / 10)) * (d.step / 10);
  }
  return out;
}

const numericParams = (src: Record<string, number | string> | undefined): Params =>
  Object.fromEntries(Object.entries(src ?? {}).filter(([, v]) => typeof v === "number")) as Params;

/** Parâmetros atuais da peça paramétrica (padrões onde faltar). */
export function paramsOf(part: Part): { g: Generator; params: Params } | null {
  const g = generator(part.source?.generator);
  if (!g) return null;
  return { g, params: clampParams(g, { ...defaults(g), ...numericParams(part.source?.params) }) };
}

export interface BuildOptions {
  x: number;
  y: number;
  /** id da camada */
  layer: string;
  params?: Params;
  random?: Random;
}

/**
 * Peça nova de um gerador, com id, o próximo número de chamada e um nome
 * com número ("Barra 3"). Fixa na camada 1 (o fundo), solta nas outras.
 */
export function buildPart(scene: Scene, generatorId: string, o: BuildOptions): Part {
  const g = generator(generatorId);
  if (!g) throw new Error(`Gerador desconhecido: ${generatorId}`);
  const params = clampParams(g, { ...defaults(g), ...o.params });
  const fixed = scene.layers.findIndex((l) => l.id === o.layer) === 0;
  return {
    id: idsFor(scene, o.random).next("part"),
    ref: nextRef(scene),
    name: nextPartName(scene, g.name),
    layer: o.layer,
    x: o.x,
    y: o.y,
    angle: 0,
    shape: g.build(params),
    material: g.material,
    fixed,
    fast: g.fast ?? false,
    source: { generator: g.id, params },
  };
}

/** Caixa local (mm) de uma forma gerada: meia largura e meia altura. */
function halfSize(shape: Shape): [number, number] {
  if (shape.kind === "circle") return [shape.r, shape.r];
  if (shape.kind === "gear") {
    const r = (shape.module * shape.teeth) / 2;
    return [r, r];
  }
  let x = 0;
  let y = 0;
  for (const [a, b] of shape.outer) {
    x = Math.max(x, Math.abs(a));
    y = Math.max(y, Math.abs(b));
  }
  return [x, y];
}

/**
 * Comando que muda parâmetros de uma peça paramétrica e refaz a forma; os
 * pontos de ligação acompanham a mudança de tamanho em cada eixo.
 */
export function regenerate(scene: Scene, partId: string, change: Params, verb?: string): Command | null {
  const part = scene.parts.find((p) => p.id === partId);
  const cur = part && paramsOf(part);
  if (!part || !cur) return null;
  const mirror = part.source?.params.mirror;
  const next = clampParams(cur.g, { ...cur.params, ...change });
  if (cur.g.params.every((d) => next[d.key] === cur.params[d.key])) return null;
  const withMirror = mirror === undefined ? next : { ...next, mirror: Number(mirror) };
  const shape = cur.g.build(withMirror);
  const [x0, y0] = halfSize(part.shape);
  const [x1, y1] = halfSize(shape);
  return setShape(scene, partId, shape, {
    params: withMirror,
    anchorScale: [x0 > 0 ? x1 / x0 : 1, y0 > 0 ? y1 / y0 : 1],
    verb: verb ?? "Esticar",
  });
}

/** Forma espelhada da peça paramétrica (o gerador refaz com `mirror` trocado). */
export function mirroredShape(part: Part): Shape | undefined {
  const cur = paramsOf(part);
  if (!cur) return undefined;
  const m = part.source?.params.mirror === 1 ? 0 : 1;
  return cur.g.build({ ...cur.params, mirror: m });
}
