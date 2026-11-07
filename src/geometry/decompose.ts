import earcut from "earcut";
import { MIN_AREA } from "./clip";
import {
  area as shapeArea,
  cleanShape,
  isConvex,
  normalize,
  signedArea,
  type PolyWithHoles,
  type Ring,
} from "./polygon";
import { fail, fmt, ok, type GeoResult } from "./result";
import type { Vec2 } from "./vec";
import { dhypot } from "./dmath";

/**
 * Decomposição convexa para o motor de física.
 *
 * Método (determinístico): limpeza → triangulação por orelhas com pontes dos
 * furos (earcut) → fusão de Hertel-Mehlhorn, pela diagonal mais longa
 * primeiro, enquanto o resultado continuar convexo e com no máximo
 * `maxVertices` vértices → peças com menos de 0,05 mm² são fundidas a uma
 * vizinha ou descartadas (a área descartada é informada).
 */

/** Menor limite de vértices por polígono entre os motores candidatos (Box2D v3). */
export const MAX_POLY_VERTICES = 8;

export type Piece = { kind: "circle"; c: Vec2; r: number } | { kind: "poly"; points: Ring };

export interface Decomposition {
  pieces: Ring[];
  /** soma das áreas das peças, mm² */
  area: number;
  /** área perdida (lascas descartadas), mm² */
  discardedArea: number;
}

/**
 * Peça convexa mais fina que isso (mm, na menor largura) é lasca: o Box2D
 * calibrado (lengthUnits 5, folga linear de 0,025 mm) junta pontos a menos de
 * duas folgas da reta e a descarta como degenerada. Aparece na triangulação
 * de furos densos (traço à mão do Lápis): um leque de um canto distante até
 * dois vértices vizinhos do furo.
 */
export const MIN_THICKNESS = 0.055;

export interface DecomposeOptions {
  maxVertices?: number;
  minArea?: number;
  minThickness?: number;
}

interface Part {
  v: number[];
  alive: boolean;
  area: number;
}

const COLLINEAR_EPS = 1e-9;

export function decomposeConvex(shape: PolyWithHoles, opts: DecomposeOptions = {}): GeoResult<Decomposition> {
  const maxV = opts.maxVertices ?? MAX_POLY_VERTICES;
  const minArea = opts.minArea ?? MIN_AREA;
  const minThickness = opts.minThickness ?? MIN_THICKNESS;
  const clean = cleanShape(normalize(shape));
  if (clean.outer.length < 3) return fail("invalid", "A forma não tem área");
  const total = shapeArea(clean);
  if (!(total > 0)) return fail("invalid", "A forma não tem área");

  if (clean.holes.length === 0 && isConvex(clean.outer)) {
    const stripped = stripCollinear(clean.outer);
    if (stripped.length <= maxV && total >= minArea) {
      return ok({ pieces: [stripped], area: total, discardedArea: 0 });
    }
  }

  // Vértices canônicos (pontos idênticos viram o mesmo índice).
  const verts: Vec2[] = [];
  const canon: number[] = [];
  const key = new Map<string, number>();
  const flat: number[] = [];
  const holeIdx: number[] = [];
  const pushRing = (ring: Ring) => {
    for (const p of ring) {
      const k = `${p[0]},${p[1]}`;
      let id = key.get(k);
      if (id === undefined) {
        id = verts.length;
        verts.push(p);
        key.set(k, id);
      }
      canon.push(id);
      flat.push(p[0], p[1]);
    }
  };
  pushRing(clean.outer);
  for (const h of clean.holes) {
    holeIdx.push(flat.length / 2);
    pushRing(h);
  }

  let tris: number[];
  try {
    tris = earcut(flat, holeIdx.length ? holeIdx : null);
  } catch (e) {
    return fail("internal", `Falha na triangulação: ${(e as Error).message}`);
  }

  const parts: Part[] = [];
  const edges = new Map<string, number[]>();
  const ekey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const addEdges = (id: number) => {
    const v = parts[id]!.v;
    for (let i = 0; i < v.length; i++) {
      const k = ekey(v[i]!, v[(i + 1) % v.length]!);
      const l = edges.get(k);
      if (l) l.push(id);
      else edges.set(k, [id]);
    }
  };
  const dropEdges = (id: number) => {
    const v = parts[id]!.v;
    for (let i = 0; i < v.length; i++) {
      const k = ekey(v[i]!, v[(i + 1) % v.length]!);
      const l = edges.get(k);
      if (!l) continue;
      const j = l.indexOf(id);
      if (j >= 0) l.splice(j, 1);
      if (l.length === 0) edges.delete(k);
    }
  };
  const ringOf = (v: number[]): Ring => v.map((i) => verts[i]!);

  for (let i = 0; i < tris.length; i += 3) {
    let v = [canon[tris[i]!]!, canon[tris[i + 1]!]!, canon[tris[i + 2]!]!];
    if (v[0] === v[1] || v[1] === v[2] || v[0] === v[2]) continue;
    let a = signedArea(ringOf(v));
    if (a < 0) {
      v = [v[0]!, v[2]!, v[1]!];
      a = -a;
    }
    if (a < 1e-12) continue;
    parts.push({ v, alive: true, area: a });
    addEdges(parts.length - 1);
  }

  const tryMerge = (ia: number, ib: number, p: number, q: number, limit = maxV): number[] | null => {
    const A = parts[ia]!.v;
    const B = parts[ib]!.v;
    let u = p;
    let w = q;
    const ia0 = A.findIndex((x, i) => x === p && A[(i + 1) % A.length] === q);
    if (ia0 < 0) {
      u = q;
      w = p;
    }
    const iu = A.findIndex((x, i) => x === u && A[(i + 1) % A.length] === w);
    const jb = B.findIndex((x, i) => x === w && B[(i + 1) % B.length] === u);
    if (iu < 0 || jb < 0) return null;
    // A girado para começar em w e terminar em u; B para começar em u e terminar em w.
    const a: number[] = [];
    for (let k = 0; k < A.length; k++) a.push(A[(iu + 1 + k) % A.length]!);
    const b: number[] = [];
    for (let k = 0; k < B.length; k++) b.push(B[(jb + 1 + k) % B.length]!);
    const merged = [...a.slice(0, -1), ...b.slice(0, -1)];
    const ring = ringOf(merged);
    if (!convexCCW(ring)) return null;
    if (effectiveCount(ring) > limit) return null;
    return merged;
  };

  const widthOf = (v: number[]) => {
    const ring = ringOf(v);
    let w = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      const L = dhypot(b[0] - a[0], b[1] - a[1]);
      if (L < 1e-12) continue;
      let m = 0;
      for (const q of ring)
        m = Math.max(m, Math.abs((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) / L);
      w = Math.min(w, m);
    }
    return w;
  };

  /**
   * Lasca fina sem fusão de até 8 vértices: junta com a vizinha (convexo, até
   * 14 vértices) e divide de novo pela diagonal que deixa as duas metades
   * mais grossas, cada uma com até 8 vértices.
   */
  const splitMerge = (ia: number, ib: number, p: number, q: number): [number[], number[]] | null => {
    const m = tryMerge(ia, ib, p, q, 2 * maxV - 2);
    if (!m) return null;
    const n = m.length;
    let best: [number[], number[]] | null = null;
    let bestW = minThickness;
    for (let i = 0; i < n; i++)
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const a = m.slice(i, j + 1);
        const b = [...m.slice(j), ...m.slice(0, i + 1)];
        if (effectiveCount(ringOf(a)) > maxV || effectiveCount(ringOf(b)) > maxV) continue;
        const w = Math.min(widthOf(a), widthOf(b));
        if (w > bestW) {
          bestW = w;
          best = [a, b];
        }
      }
    return best;
  };

  const replace = (ia: number, ib: number, merged: number[]) => {
    dropEdges(ia);
    dropEdges(ib);
    parts[ia]!.alive = false;
    parts[ib]!.alive = false;
    parts.push({ v: merged, alive: true, area: parts[ia]!.area + parts[ib]!.area });
    addEdges(parts.length - 1);
  };

  const replaceWith = (ia: number, ib: number, v: number[], a: number) => {
    dropEdges(ia);
    dropEdges(ib);
    parts[ia]!.alive = false;
    parts[ib]!.alive = false;
    parts.push({ v, alive: true, area: a });
    addEdges(parts.length - 1);
  };

  /** `slack`: acréscimo de área aceito além de 25% da menor (lasca fina: a resolução de área do motor). */
  const hullMerge = (ia: number, ib: number, slack = 0): { v: number[]; area: number } | null => {
    const ids = [...new Set([...parts[ia]!.v, ...parts[ib]!.v])];
    const hull = hullIndices(ids, verts);
    if (hull.length < 3 || hull.length > maxV) return null;
    const a = signedArea(ringOf(hull));
    const base = parts[ia]!.area + parts[ib]!.area;
    if (a - base > Math.max(1e-4, slack, 0.25 * Math.min(parts[ia]!.area, parts[ib]!.area))) return null;
    return { v: hull, area: a };
  };

  // Hertel-Mehlhorn: diagonal mais longa primeiro, várias passadas.
  for (let pass = 0; pass < 50; pass++) {
    const cands: { k: string; p: number; q: number; l: number }[] = [];
    for (const [k, l] of edges) {
      if (l.length !== 2) continue;
      const [p, q] = k.split("_").map(Number) as [number, number];
      const a = verts[p]!;
      const b = verts[q]!;
      cands.push({ k, p, q, l: dhypot(a[0] - b[0], a[1] - b[1]) });
    }
    cands.sort((x, y) => y.l - x.l || (x.k < y.k ? -1 : x.k > y.k ? 1 : 0));
    let merged = false;
    for (const c of cands) {
      const l = edges.get(c.k);
      if (!l || l.length !== 2) continue;
      const [ia, ib] = l as [number, number];
      if (!parts[ia]!.alive || !parts[ib]!.alive) continue;
      const m = tryMerge(ia, ib, c.p, c.q);
      if (m) {
        replace(ia, ib, m);
        merged = true;
      }
    }
    if (!merged) break;
  }

  // Lascas (pequenas ou finas): funde com uma vizinha, senão descarta.
  const thin = (p: Part) => widthOf(p.v) < minThickness;
  let discarded = 0;
  for (let guard = 0; guard < 4 * parts.length; guard++) {
    const small = parts.findIndex((p) => p.alive && (p.area < minArea || thin(p)));
    if (small < 0) break;
    const v = parts[small]!.v;
    const neigh: { id: number; p: number; q: number }[] = [];
    for (let i = 0; i < v.length; i++) {
      const p = v[i]!;
      const q = v[(i + 1) % v.length]!;
      for (const id of edges.get(ekey(p, q)) ?? []) if (id !== small) neigh.push({ id, p, q });
    }
    neigh.sort((a, b) => parts[b.id]!.area - parts[a.id]!.area || a.id - b.id);
    let done = false;
    for (const n of neigh) {
      const m = tryMerge(n.id, small, n.p, n.q);
      if (m) {
        replace(n.id, small, m);
        done = true;
        break;
      }
    }
    // Sem fusão convexa (lasca encostada num trecho côncavo e denso): funde
    // pelo fecho convexo se o acréscimo for desprezível.
    // lasca fina: aceita encher um entalhe do tamanho dela mais a resolução de área do motor
    const slack = parts[small]!.area >= minArea ? parts[small]!.area + minArea : 0;
    for (const n of done ? [] : neigh) {
      const m = hullMerge(small, n.id, slack);
      if (m) {
        replaceWith(small, n.id, m.v, m.area);
        done = true;
        break;
      }
    }
    for (const n of done || parts[small]!.area < minArea ? [] : neigh) {
      const halves = splitMerge(n.id, small, n.p, n.q);
      if (!halves) continue;
      dropEdges(n.id);
      dropEdges(small);
      parts[n.id]!.alive = false;
      parts[small]!.alive = false;
      for (const v of halves) {
        parts.push({ v, alive: true, area: signedArea(ringOf(v)) });
        addEdges(parts.length - 1);
      }
      done = true;
      break;
    }
    if (!done) {
      dropEdges(small);
      parts[small]!.alive = false;
      discarded += parts[small]!.area;
    }
  }

  const pieces = parts.filter((p) => p.alive).map((p) => stripCollinear(ringOf(p.v)));
  const sum = pieces.reduce((s, r) => s + signedArea(r), 0);
  if (pieces.length === 0) return fail("too-small", "A forma é pequena demais");
  const warnings: string[] = [];
  if (discarded > 0)
    warnings.push(`Partes menores que ${fmt(minArea)} mm² foram descartadas (${fmt(discarded, 3)} mm²)`);
  return ok({ pieces, area: sum, discardedArea: discarded }, warnings);
}

/** Fecho convexo por índices (anti-horário, sem colineares), determinístico. */
function hullIndices(ids: number[], verts: Vec2[]): number[] {
  const p = ids.slice().sort((a, b) => verts[a]![0] - verts[b]![0] || verts[a]![1] - verts[b]![1] || a - b);
  const cr = (o: number, a: number, b: number) => {
    const O = verts[o]!;
    const A = verts[a]!;
    const B = verts[b]!;
    return (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
  };
  const lower: number[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cr(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: number[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (upper.length >= 2 && cr(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** Convexo e anti-horário, aceitando vértices colineares. */
function convexCCW(ring: Ring): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[(i - 1 + n) % n]!;
    const b = ring[i]!;
    const c = ring[(i + 1) % n]!;
    const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    const l = dhypot(b[0] - a[0], b[1] - a[1]) * dhypot(c[0] - b[0], c[1] - b[1]);
    if (z < -COLLINEAR_EPS * l) return false;
  }
  return true;
}

function isCollinearAt(ring: Ring, i: number): boolean {
  const n = ring.length;
  const a = ring[(i - 1 + n) % n]!;
  const b = ring[i]!;
  const c = ring[(i + 1) % n]!;
  const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
  const l = dhypot(b[0] - a[0], b[1] - a[1]) * dhypot(c[0] - b[0], c[1] - b[1]);
  return Math.abs(z) <= COLLINEAR_EPS * l;
}

function effectiveCount(ring: Ring): number {
  let n = 0;
  for (let i = 0; i < ring.length; i++) if (!isCollinearAt(ring, i)) n++;
  return n;
}

/** Tira vértices colineares (a forma não muda). */
export function stripCollinear(ring: Ring): Ring {
  const out = ring.slice();
  for (let i = 0; i < out.length && out.length > 3;) {
    if (isCollinearAt(out, i)) out.splice(i, 1);
    else i++;
  }
  return out;
}

/** Área de uma lista de peças (círculos inclusos). */
export function piecesArea(pieces: Piece[]): number {
  let s = 0;
  for (const p of pieces) s += p.kind === "circle" ? Math.PI * p.r * p.r : Math.abs(signedArea(p.points));
  return s;
}
