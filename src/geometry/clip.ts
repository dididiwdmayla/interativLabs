import {
  ClipType,
  ClipperOffset,
  EndType,
  FillRule,
  JoinType,
  PolyTree64,
  booleanOpWithPolyTree,
  type Path64,
  type Paths64,
  type PolyPath64,
} from "clipper2-ts";
import { area, normalize, orientRing, type PolyWithHoles, type Ring } from "./polygon";
import { fail, fmt, ok, type GeoResult } from "./result";

/**
 * Booleanos de polígono com Clipper2 (clipper2-ts), em coordenadas inteiras.
 * Escala fixa: 10 000 unidades por mm (resolução de 0,1 µm). Escolha e
 * comparação em docs/decisoes/geometria.md.
 */
export const CLIP_SCALE = 10_000;

/** Menor área de uma forma válida, mm². */
export const MIN_AREA = 0.05;

const toPath = (ring: Ring): Path64 =>
  ring.map(([x, y]) => ({ x: Math.round(x * CLIP_SCALE), y: Math.round(y * CLIP_SCALE) }));

const fromPath = (path: Path64): Ring => path.map((p) => [p.x / CLIP_SCALE, p.y / CLIP_SCALE]);

function shapesToPaths(shapes: PolyWithHoles[]): Paths64 {
  const out: Paths64 = [];
  for (const s of shapes) {
    const n = normalize(s);
    out.push(toPath(n.outer));
    for (const h of n.holes) out.push(toPath(h));
  }
  return out;
}

/** Árvore do Clipper → formas com furos (ilhas dentro de furos viram formas próprias). */
function treeToShapes(tree: PolyTree64): PolyWithHoles[] {
  const out: PolyWithHoles[] = [];
  const visitOuter = (node: PolyPath64) => {
    const outer = node.poly ? fromPath(node.poly) : [];
    const holes: Ring[] = [];
    for (let i = 0; i < node.count; i++) {
      const hole = node.child(i);
      if (hole.poly) holes.push(orientRing(fromPath(hole.poly), false));
      for (let j = 0; j < hole.count; j++) visitOuter(hole.child(j));
    }
    if (outer.length >= 3) out.unshift({ outer: orientRing(outer, true), holes });
  };
  for (let i = 0; i < tree.count; i++) visitOuter(tree.child(i));
  // Ordem estável: maior área primeiro, depois menor x do externo.
  return out.sort((a, b) => area(b) - area(a) || minX(a) - minX(b));
}

const minX = (s: PolyWithHoles) => s.outer.reduce((m, p) => Math.min(m, p[0]), Infinity);

function run(
  type: ClipType,
  subject: Paths64,
  clip: Paths64 | null,
  fill: FillRule = FillRule.NonZero,
): GeoResult<PolyWithHoles[]> {
  for (const path of [...subject, ...(clip ?? [])]) {
    for (const p of path) {
      if (!Number.isSafeInteger(p.x) || !Number.isSafeInteger(p.y))
        return fail("invalid", "Coordenada inválida ou grande demais na forma");
    }
  }
  try {
    const tree = new PolyTree64();
    booleanOpWithPolyTree(type, subject, clip, tree, fill);
    return ok(treeToShapes(tree));
  } catch (e) {
    return fail("internal", `Falha na operação booleana: ${(e as Error).message}`);
  }
}

const list = (s: PolyWithHoles | PolyWithHoles[]): PolyWithHoles[] => (Array.isArray(s) ? s : [s]);

/**
 * Resolve um contorno qualquer (inclusive que cruza a si mesmo) em formas
 * simples, pela regra de preenchimento não nula: cada laço conta.
 */
export function resolveRing(ring: Ring): GeoResult<PolyWithHoles[]> {
  if (ring.length < 3) return fail("invalid", "Um contorno precisa de pelo menos 3 pontos");
  return run(ClipType.Union, [toPath(ring)], null, FillRule.NonZero);
}

/** Normaliza formas de entrada arbitrárias (externos e furos resolvidos à parte). */
function resolveShapes(shapes: PolyWithHoles[]): GeoResult<PolyWithHoles[]> {
  const outers = shapes.map((s) => toPath(s.outer));
  const holes = shapes.flatMap((s) => s.holes.map(toPath));
  if (holes.length === 0) return run(ClipType.Union, outers, null, FillRule.NonZero);
  const o = run(ClipType.Union, outers, null, FillRule.NonZero);
  if (!o.ok) return o;
  const h = run(ClipType.Union, holes, null, FillRule.NonZero);
  if (!h.ok) return h;
  return run(ClipType.Difference, shapesToPaths(o.value), shapesToPaths(h.value));
}

export function union(
  a: PolyWithHoles | PolyWithHoles[],
  b: PolyWithHoles | PolyWithHoles[] = [],
): GeoResult<PolyWithHoles[]> {
  return run(ClipType.Union, shapesToPaths([...list(a), ...list(b)]), null);
}

export function difference(
  a: PolyWithHoles | PolyWithHoles[],
  b: PolyWithHoles | PolyWithHoles[],
): GeoResult<PolyWithHoles[]> {
  return run(ClipType.Difference, shapesToPaths(list(a)), shapesToPaths(list(b)));
}

export function intersection(
  a: PolyWithHoles | PolyWithHoles[],
  b: PolyWithHoles | PolyWithHoles[],
): GeoResult<PolyWithHoles[]> {
  return run(ClipType.Intersection, shapesToPaths(list(a)), shapesToPaths(list(b)));
}

const totalArea = (shapes: PolyWithHoles[]) => shapes.reduce((s, p) => s + area(p), 0);

/**
 * Cria a forma de uma peça a partir de um contorno desenhado (que pode cruzar
 * a si mesmo) e furos opcionais.
 */
export function makeShape(outer: Ring, holes: Ring[] = []): GeoResult<PolyWithHoles[]> {
  const r = resolveRing(outer);
  if (!r.ok) return r;
  const warnings: string[] = [];
  if (r.value.length > 1) warnings.push(`O contorno cruzava a si mesmo e virou ${r.value.length} peças`);
  let shapes = r.value;
  if (holes.length) {
    const h = resolveShapes(holes.map((ring) => ({ outer: ring, holes: [] })));
    if (!h.ok) return h;
    const d = difference(shapes, h.value);
    if (!d.ok) return d;
    shapes = d.value;
  }
  if (totalArea(shapes) < MIN_AREA) return fail("too-small", "A forma é pequena demais");
  return ok(shapes, warnings);
}

/**
 * Normaliza uma forma com furos vinda de fora (furos que vazam a borda,
 * furos encostados, contornos cruzados).
 */
export function repairShape(shape: PolyWithHoles): GeoResult<PolyWithHoles[]> {
  const r = resolveShapes([shape]);
  if (!r.ok) return r;
  if (totalArea(r.value) < MIN_AREA) return fail("too-small", "A forma é pequena demais");
  const warnings = r.value.length > 1 ? [`A forma virou ${r.value.length} peças`] : [];
  return ok(r.value, warnings);
}

/**
 * Corta uma peça com um furo ou rasgo (diferença). Se o corte dividir a peça,
 * devolve as N partes com aviso.
 */
export function cut(
  piece: PolyWithHoles | PolyWithHoles[],
  cutter: PolyWithHoles | PolyWithHoles[] | Ring,
): GeoResult<PolyWithHoles[]> {
  const c: PolyWithHoles[] = isRing(cutter) ? [{ outer: cutter, holes: [] }] : list(cutter);
  const d = difference(piece, c);
  if (!d.ok) return d;
  const parts = d.value.filter((p) => area(p) >= MIN_AREA);
  const lost = totalArea(d.value) - totalArea(parts);
  if (parts.length === 0) return fail("empty", "O corte removeu a peça inteira");
  const warnings: string[] = [];
  if (parts.length > 1) warnings.push(`O corte dividiu a peça em ${parts.length} partes`);
  if (lost > 0)
    warnings.push(`Lascas menores que ${fmt(MIN_AREA)} mm² foram descartadas (${fmt(lost, 3)} mm²)`);
  return ok(parts, warnings);
}

function isRing(x: PolyWithHoles | PolyWithHoles[] | Ring): x is Ring {
  return Array.isArray(x) && (x.length === 0 || Array.isArray(x[0]));
}

/**
 * Desloca o contorno de formas com furos (positivo = para fora, negativo =
 * para dentro), com junção arredondada. Furos crescem quando a forma
 * encolhe. Usado no chanfro e nas faixas do renderizador (src/render).
 * Devolve [] quando a forma some no deslocamento.
 */
export function offsetShapes(shapes: PolyWithHoles[], delta: number): PolyWithHoles[] {
  if (shapes.length === 0) return [];
  const co = new ClipperOffset(2, 0.002 * CLIP_SCALE);
  co.addPaths(shapesToPaths(shapes), JoinType.Round, EndType.Polygon);
  const tree = new PolyTree64();
  try {
    co.execute(delta * CLIP_SCALE, tree);
  } catch {
    return [];
  }
  return treeToShapes(tree);
}
