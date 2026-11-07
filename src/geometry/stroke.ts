import { ClipperOffset, EndType, JoinType, PolyTree64, type Paths64 } from "clipper2-ts";
import { CLIP_SCALE, MIN_AREA, difference, resolveRing } from "./clip";
import { area, containsPoint, signedArea, type PolyWithHoles, type Ring } from "./polygon";
import { CHORD_TOL, circleRing, slotRing } from "./primitives";
import { distToSegment, type Vec2 } from "./vec";

/**
 * Traço à mão do Lápis (docs/arquitetura.md §6, Parte E2c): do rastro do
 * dedo ou da caneta até uma forma com cara de peça usinada. Simplificação de
 * Ramer–Douglas–Peucker a 0,5 px de tela, depois suavização que preserva os
 * cantos (ângulo acima de ~35° fica canto), régua (reta, círculo, vértices)
 * e as regiões que o traço faz numa peça (laço, borda a borda, largura).
 * Tudo em mm; `px` é quantos mm vale um px de tela no zoom do desenho.
 */

/** Tolerância da simplificação, px de tela. */
export const RDP_PX = 0.5;
/** Ângulo a partir do qual um ponto do traço é canto, graus. */
export const CORNER_DEG = 35;
/** Escala da suavização (σ da gaussiana ao longo do traço), px de tela. */
export const SMOOTH_PX = 5;
/** Fim a menos disso do começo fecha o contorno, px de tela. */
export const CLOSE_PX = 12;

const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const hyp = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Ramer–Douglas–Peucker numa linha aberta (as pontas ficam). */
export function rdp(points: Vec2[], tol: number): Vec2[] {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let best = -1;
    let dmax = tol;
    for (let i = a + 1; i < b; i++) {
      const d = distToSegment(points[i]!, points[a]!, points[b]!);
      if (d > dmax) {
        dmax = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Pontos repetidos (mais perto que `tol`) saem. */
function dedupe(points: Vec2[], tol: number): Vec2[] {
  const out: Vec2[] = [];
  for (const p of points) if (!out.length || hyp(out[out.length - 1]!, p) > tol) out.push([p[0], p[1]]);
  return out;
}

/** Reamostra a linha em passos iguais de `h`, guardando o índice dos pontos de entrada. */
function resample(points: Vec2[], h: number, closed: boolean): Vec2[] {
  const pts = closed ? [...points, points[0]!] : points;
  const out: Vec2[] = [pts[0]!];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const L = hyp(a, b);
    let t = h - carry;
    while (t <= L) {
      out.push([a[0] + ((b[0] - a[0]) * t) / L, a[1] + ((b[1] - a[1]) * t) / L]);
      t += h;
    }
    carry = L - (t - h);
  }
  if (!closed && hyp(out[out.length - 1]!, pts[pts.length - 1]!) > h * 0.25) out.push(pts[pts.length - 1]!);
  if (closed && out.length > 1 && hyp(out[out.length - 1]!, out[0]!) < h * 0.5) out.pop();
  return out;
}

/** Ângulo de virada em graus no ponto i, olhando `k` pontos para cada lado. */
function turnAt(p: Vec2[], i: number, k: number, closed: boolean): number {
  const n = p.length;
  const ia = closed ? (i - k + n) % n : Math.max(0, i - k);
  const ib = closed ? (i + k) % n : Math.min(n - 1, i + k);
  if (ia === i || ib === i) return 0;
  const u = sub(p[i]!, p[ia]!);
  const v = sub(p[ib]!, p[i]!);
  const lu = Math.hypot(u[0], u[1]);
  const lv = Math.hypot(v[0], v[1]);
  if (lu < 1e-12 || lv < 1e-12) return 0;
  const c = Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv)));
  return (Math.acos(c) * 180) / Math.PI;
}

/** Índices dos cantos (máximos locais de virada acima do limite). */
function corners(p: Vec2[], k: number, closed: boolean, deg = CORNER_DEG): number[] {
  const n = p.length;
  const turn = p.map((_, i) => turnAt(p, i, k, closed));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!closed && (i === 0 || i === n - 1)) continue;
    if (turn[i]! < deg) continue;
    let max = true;
    for (let j = -k; j <= k && max; j++) {
      if (j === 0) continue;
      const q = closed ? (i + j + n) % n : i + j;
      if (q < 0 || q >= n) continue;
      if (turn[q]! > turn[i]! || (turn[q] === turn[i] && j < 0)) max = false;
    }
    if (max) out.push(i);
  }
  return out;
}

/** Gaussiana simples ao longo da linha (σ em amostras); pontas espelhadas na linha aberta. */
function blur(p: Vec2[], sigma: number, closed: boolean): Vec2[] {
  const n = p.length;
  const reach = Math.ceil(3 * sigma);
  const w = Array.from({ length: reach + 1 }, (_, k) => Math.exp(-(k * k) / (2 * sigma * sigma)));
  const get = (j: number): Vec2 => {
    if (closed) return p[((j % n) + n) % n]!;
    if (j < 0) {
      const e = p[0]!;
      const q = p[Math.min(n - 1, -j)]!;
      return [2 * e[0] - q[0], 2 * e[1] - q[1]];
    }
    if (j >= n) {
      const e = p[n - 1]!;
      const q = p[Math.max(0, 2 * (n - 1) - j)]!;
      return [2 * e[0] - q[0], 2 * e[1] - q[1]];
    }
    return p[j]!;
  };
  return p.map((_, i) => {
    let sx = 0;
    let sy = 0;
    let sw = 0;
    for (let k = -reach; k <= reach; k++) {
      const q = get(i + k);
      sx += q[0] * w[Math.abs(k)]!;
      sy += q[1] * w[Math.abs(k)]!;
      sw += w[Math.abs(k)]!;
    }
    return [sx / sw, sy / sw];
  });
}

export interface SmoothOptions {
  closed: boolean;
  /** mm por px de tela */
  px: number;
}

export interface Smoothed {
  points: Vec2[];
  /** índices dos cantos em `points` */
  corners: number[];
}

/**
 * Simplifica e suaviza preservando os cantos: RDP a 0,5 px; reamostra a 1,5
 * px; cantos (virada acima de 35° na escala de 8 px, sobre uma cópia com
 * σ = 2 px) ficam presos; cada
 * trecho entre cantos passa por uma gaussiana de σ = 5 px ao longo do traço
 * (o tremido do dedo, de 1 a 2 px em ondas de 10 a 15 px, some); o laço volta
 * à área do traço simplificado; por fim, RDP fino a 0,15 px enxuga os
 * vértices sem tirar a curva.
 */
export function smoothStroke(raw: Vec2[], o: SmoothOptions): Smoothed {
  const base = dedupe(raw, o.px * 0.25);
  if (base.length < 3) return { points: base, corners: [] };
  const simple = o.closed ? rdp([...base, base[0]!], RDP_PX * o.px).slice(0, -1) : rdp(base, RDP_PX * o.px);
  const h = 1.5 * o.px;
  const p = resample(simple.length >= 2 ? simple : base, h, o.closed);
  const n = p.length;
  if (n < 4) return { points: p, corners: [] };
  // cantos: virada medida a 8 px sobre uma cópia com o tremido mais fino tirado (σ = 2 px),
  // para o ruído do dedo não virar canto
  const k = Math.max(2, Math.round((8 * o.px) / h));
  const pinned = new Uint8Array(n);
  const cs = corners(blur(p, 2 / 1.5, o.closed), k, o.closed);
  for (const c of cs) pinned[c] = 1;
  if (!o.closed) {
    pinned[0] = 1;
    pinned[n - 1] = 1;
  }
  const at = (i: number) => (o.closed ? p[(i + n) % n]! : p[Math.max(0, Math.min(n - 1, i))]!);
  // gaussiana ao longo do traço (σ = SMOOTH_PX), trecho a trecho entre cantos; nas pontas presas, o
  // trecho é espelhado em volta da ponta (uma reta continua reta e a ponta não sai do lugar)
  const sigma = SMOOTH_PX / 1.5;
  const reach = Math.ceil(3 * sigma);
  const weights = Array.from({ length: reach + 1 }, (_, k) => Math.exp(-(k * k) / (2 * sigma * sigma)));
  const smoothRun = (idx: number[], fixedEnds: boolean) => {
    const m = idx.length;
    const src = idx.map((k) => at(k));
    const get = (j: number): Vec2 => {
      if (!fixedEnds) return src[((j % m) + m) % m]!;
      if (j < 0) {
        const e = src[0]!;
        const q = src[Math.min(m - 1, -j)]!;
        return [2 * e[0] - q[0], 2 * e[1] - q[1]];
      }
      if (j >= m) {
        const e = src[m - 1]!;
        const q = src[Math.max(0, 2 * (m - 1) - j)]!;
        return [2 * e[0] - q[0], 2 * e[1] - q[1]];
      }
      return src[j]!;
    };
    for (let j = fixedEnds ? 1 : 0; j < (fixedEnds ? m - 1 : m); j++) {
      let sx = 0;
      let sy = 0;
      let sw = 0;
      for (let k = -reach; k <= reach; k++) {
        const w = weights[Math.abs(k)]!;
        const q = get(j + k);
        sx += q[0] * w;
        sy += q[1] * w;
        sw += w;
      }
      p[idx[j]! % n] = [sx / sw, sy / sw];
    }
  };
  if (o.closed && !cs.length)
    smoothRun(
      Array.from({ length: n }, (_, k) => k),
      false,
    );
  else {
    const stops = o.closed ? [...cs, cs[0]! + n] : [0, ...cs, n - 1];
    for (let r = 0; r + 1 < stops.length; r++) {
      const idx: number[] = [];
      for (let k = stops[r]!; k <= stops[r + 1]!; k++) idx.push(k);
      if (idx.length > 2) smoothRun(idx, true);
    }
  }
  // enxuga: RDP fino por trecho entre cantos, e os cantos ficam
  const isCorner = new Uint8Array(n);
  for (const c of cs) isCorner[c] = 1;
  const breaks = o.closed ? (cs.length ? [...cs, cs[0]! + n] : [0, n]) : [0, ...cs, n - 1];
  const out: Vec2[] = [];
  const outCorners: number[] = [];
  for (let r = 0; r + 1 < breaks.length; r++) {
    const a = breaks[r]!;
    const b = breaks[r + 1]!;
    const seg: Vec2[] = [];
    for (let i = a; i <= b; i++) seg.push(at(i));
    const thin = rdp(seg, 0.15 * o.px);
    if (isCorner[a % n]) outCorners.push(out.length);
    out.push(...thin.slice(0, -1));
  }
  if (!o.closed) out.push(at(n - 1));
  // laço: a suavização não encolhe a forma (a área volta à do traço simplificado)
  if (o.closed && out.length >= 3) {
    const want = Math.abs(signedArea(simple.length >= 3 ? simple : base));
    const got = Math.abs(signedArea(out));
    if (want > 0 && got > 0) {
      const k = Math.sqrt(want / got);
      let cx = 0;
      let cy = 0;
      for (const q of out) {
        cx += q[0] / out.length;
        cy += q[1] / out.length;
      }
      for (let i = 0; i < out.length; i++) {
        const q = out[i]!;
        out[i] = [cx + (q[0] - cx) * k, cy + (q[1] - cy) * k];
      }
    }
  }
  return { points: out, corners: outCorners };
}

// ——— régua ———

/** Reta pelos mínimos quadrados; devolve as pontas (projeção do primeiro e do último ponto) e o desvio máximo. */
export function fitLine(points: Vec2[]): { a: Vec2; b: Vec2; dev: number } | null {
  const n = points.length;
  if (n < 2) return null;
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p[0] / n;
    cy += p[1] / n;
  }
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of points) {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const u: Vec2 = [Math.cos(ang), Math.sin(ang)];
  const proj = (p: Vec2): Vec2 => {
    const t = (p[0] - cx) * u[0] + (p[1] - cy) * u[1];
    return [cx + u[0] * t, cy + u[1] * t];
  };
  let dev = 0;
  for (const p of points) dev = Math.max(dev, Math.abs((p[0] - cx) * -u[1] + (p[1] - cy) * u[0]));
  return { a: proj(points[0]!), b: proj(points[n - 1]!), dev };
}

/** Círculo pelos mínimos quadrados algébricos (Kåsa); desvio radial máximo. */
export function fitCircle(points: Vec2[]): { c: Vec2; r: number; dev: number } | null {
  const n = points.length;
  if (n < 5) return null;
  let mx = 0;
  let my = 0;
  for (const p of points) {
    mx += p[0] / n;
    my += p[1] / n;
  }
  let suu = 0;
  let svv = 0;
  let suv = 0;
  let suuu = 0;
  let svvv = 0;
  let suvv = 0;
  let svuu = 0;
  for (const p of points) {
    const u = p[0] - mx;
    const v = p[1] - my;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-12) return null;
  const b1 = (suuu + suvv) / 2;
  const b2 = (svvv + svuu) / 2;
  const uc = (b1 * svv - b2 * suv) / det;
  const vc = (suu * b2 - suv * b1) / det;
  const c: Vec2 = [mx + uc, my + vc];
  const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
  let dev = 0;
  for (const p of points) dev = Math.max(dev, Math.abs(hyp(p, c) - r));
  return { c, r, dev };
}

/** Quanto o traço dá a volta no centro, rad. */
function sweep(points: Vec2[], c: Vec2): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = Math.atan2(points[i - 1]![1] - c[1], points[i - 1]![0] - c[0]);
    const b = Math.atan2(points[i]![1] - c[1], points[i]![0] - c[0]);
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    total += d;
  }
  return Math.abs(total);
}

export type Ruled =
  | { kind: "line"; a: Vec2; b: Vec2 }
  | { kind: "circle"; c: Vec2; r: number }
  | { kind: "poly"; points: Vec2[] };

/**
 * Régua: traço quase reto vira reta; quase círculo vira círculo; o resto
 * vira vértices nos cantos, com os trechos quase retos entre eles retos.
 */
export function rule(smoothed: Smoothed, o: SmoothOptions): Ruled {
  const pts = smoothed.points;
  const length = pts.reduce((s, p, i) => (i ? s + hyp(pts[i - 1]!, p) : 0), 0);
  if (!o.closed) {
    const line = fitLine(pts);
    if (line && line.dev <= Math.max(10 * o.px, 0.1 * length)) return { kind: "line", a: line.a, b: line.b };
  }
  const circle = fitCircle(pts);
  if (
    circle &&
    circle.dev <= 0.15 * circle.r &&
    sweep(o.closed ? [...pts, pts[0]!] : pts, circle.c) > 1.75 * Math.PI
  )
    return { kind: "circle", c: circle.c, r: circle.r };
  // vértices nos cantos; trecho quase reto entre dois cantos vira reta
  const cs = smoothed.corners.length ? smoothed.corners : [];
  if (!cs.length) return { kind: "poly", points: pts };
  const n = pts.length;
  const order = o.closed ? [...cs, cs[0]! + n] : [0, ...cs, n - 1];
  const out: Vec2[] = [];
  for (let r = 0; r + 1 < order.length; r++) {
    const run: Vec2[] = [];
    for (let i = order[r]!; i <= order[r + 1]!; i++) run.push(pts[i % n]!);
    const a = run[0]!;
    const b = run[run.length - 1]!;
    const runLen = hyp(a, b);
    const dev = Math.max(...run.map((p) => distToSegment(p, a, b)));
    if (dev <= Math.max(6 * o.px, 0.08 * runLen)) out.push(a);
    else out.push(...run.slice(0, -1));
  }
  if (!o.closed) out.push(pts[n - 1]!);
  return { kind: "poly", points: out };
}

export function ruledPoints(r: Ruled): Vec2[] {
  if (r.kind === "line") return [r.a, r.b];
  if (r.kind === "circle") return circleRing(r.c, r.r);
  return r.points;
}

// ——— regiões ———

/** Laço do traço: fecha quando o fim volta perto do começo, ou no primeiro cruzamento consigo mesmo. */
export function strokeLoop(points: Vec2[], px: number): Ring | null {
  if (points.length < 3) return null;
  if (hyp(points[0]!, points[points.length - 1]!) < CLOSE_PX * px) return points.slice();
  // primeiro segmento que cruza um anterior (não vizinho)
  for (let i = 2; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    for (let j = 0; j < i - 1; j++) {
      const hit = segmentHit(points[j]!, points[j + 1]!, a, b);
      if (hit) {
        const ring: Ring = [hit, ...points.slice(j + 1, i + 1)];
        return ring.length >= 3 ? ring : null;
      }
    }
  }
  return null;
}

function segmentHit(p: Vec2, q: Vec2, r: Vec2, s: Vec2): Vec2 | null {
  const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
  if (Math.abs(d) < 1e-15) return null;
  const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d;
  const u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
}

/** Região fechada do laço (contorno que cruza a si mesmo resolvido pela regra não nula). */
export function loopRegion(ring: Ring): PolyWithHoles[] {
  const r = resolveRing(signedArea(ring) < 0 ? ring.slice().reverse() : ring);
  return r.ok ? r.value.filter((s) => area(s) >= MIN_AREA) : [];
}

function offsetPaths(paths: Vec2[][], delta: number, end: EndType): PolyWithHoles[] {
  // juntas e pontas redondas com a mesma tolerância de corda dos arcos das peças
  const co = new ClipperOffset(2, CHORD_TOL * CLIP_SCALE);
  const p: Paths64 = paths.map((ring) =>
    ring.map(([x, y]) => ({ x: Math.round(x * CLIP_SCALE), y: Math.round(y * CLIP_SCALE) })),
  );
  co.addPaths(p, JoinType.Round, end);
  const tree = new PolyTree64();
  try {
    co.execute(delta * CLIP_SCALE, tree);
  } catch {
    return [];
  }
  // a árvore vira formas pelo mesmo caminho dos booleanos (furos e ilhas)
  const shapes: PolyWithHoles[] = [];
  const visit = (node: PolyTree64 | ReturnType<PolyTree64["child"]>) => {
    for (let i = 0; i < node.count; i++) {
      const c = node.child(i);
      const outer: Ring = (c.poly ?? []).map((q) => [q.x / CLIP_SCALE, q.y / CLIP_SCALE]);
      const holes: Ring[] = [];
      for (let j = 0; j < c.count; j++) {
        const h = c.child(j);
        holes.push((h.poly ?? []).map((q) => [q.x / CLIP_SCALE, q.y / CLIP_SCALE]));
        visit(h);
      }
      if (outer.length >= 3) shapes.push({ outer, holes });
    }
  };
  visit(tree);
  return shapes.filter((s) => area(s) >= MIN_AREA);
}

/**
 * Traço com largura: pincel ou borracha. Um toque é um disco do diâmetro da
 * largura; uma reta (régua) é o estádio exato (`slotRing`, que a ferramenta
 * de rasgo reconhece como reto); o resto, a linha engrossada com pontas e
 * juntas redondas.
 */
export function strokeRegion(points: Vec2[], width: number, closed = false): PolyWithHoles[] {
  const r = width / 2;
  if (points.length === 1 || (points.length === 2 && hyp(points[0]!, points[1]!) < 1e-6))
    return [{ outer: circleRing(points[0]!, r), holes: [] }];
  if (points.length === 2) return [{ outer: slotRing(points[0]!, points[1]!, width), holes: [] }];
  return offsetPaths([points], r, closed ? EndType.Joined : EndType.Round);
}

/** Lado de um ponto em relação a uma linha aberta (pelo segmento mais próximo): +1 esquerda, −1 direita. */
export function sideOf(line: Vec2[], p: Vec2): number {
  let best = Infinity;
  let side = 1;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const d = distToSegment(p, a, b);
    if (d < best - 1e-12) {
      best = d;
      const cr = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      side = cr >= 0 ? 1 : -1;
    }
  }
  return side;
}

/** Um ponto bem dentro da forma (para classificar o lado). */
export function interiorPoint(s: PolyWithHoles): Vec2 {
  // centro da maior peça de uma grade fina dentro da caixa; cai no miolo mesmo em formas côncavas
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of s.outer) {
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  }
  let best: Vec2 = s.outer[0]!;
  let bestD = -1;
  const N = 24;
  for (let i = 0; i <= N; i++)
    for (let j = 0; j <= N; j++) {
      const p: Vec2 = [x0 + ((x1 - x0) * i) / N, y0 + ((y1 - y0) * j) / N];
      if (!containsPoint(s, p)) continue;
      let d = Infinity;
      for (const ring of [s.outer, ...s.holes])
        for (let k = 0; k < ring.length; k++)
          d = Math.min(d, distToSegment(p, ring[k]!, ring[(k + 1) % ring.length]!));
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
  return best;
}

/** Fenda do corte de borda a borda, mm (a perda de área é desprezível: 2 µm × comprimento). */
export const SPLIT_GAP = 0.002;

export interface SplitResult {
  left: PolyWithHoles[];
  right: PolyWithHoles[];
}

/**
 * Divide formas por uma linha aberta que entra e sai delas. Os dois lados
 * vêm separados (vazio de um lado: o traço não atravessou).
 */
export function splitByLine(shapes: PolyWithHoles[], line: Vec2[]): SplitResult | null {
  if (line.length < 2) return null;
  const slit = offsetPaths([line], SPLIT_GAP / 2, EndType.Butt);
  if (!slit.length) return null;
  const d = difference(shapes, slit);
  if (!d.ok) return null;
  const out: SplitResult = { left: [], right: [] };
  for (const s of d.value) {
    if (area(s) < MIN_AREA) continue;
    (sideOf(line, interiorPoint(s)) > 0 ? out.left : out.right).push(s);
  }
  return out;
}

export const totalArea = (shapes: PolyWithHoles[]) => shapes.reduce((s, p) => s + area(p), 0);
