import type { Vec2 } from "@/geometry/vec";
import type { Box } from "./view";

/**
 * Números de chamada (identidade, "Ligações"): número fora das peças, em
 * espaço livre, com uma linha curva fina até um ponto sobre a ligação.
 *
 * Para cada número, o lado e o ângulo são escolhidos pela menor quantidade
 * de cruzamentos da linha com os contornos das peças (a linha precisa
 * atravessar, no mínimo, os contornos das peças que contêm o ponto; isso é
 * o caminho limpo). Entre candidatos empatados, vale o mais curto e o mais
 * voltado para fora do desenho. Sem caminho limpo, o rótulo vai para fora
 * do contorno da cena. Rótulos que ainda colidem são escondidos, os de
 * menor prioridade primeiro. Tudo em mm do mundo.
 */

export interface CalloutTarget {
  id: string;
  ref: number;
  /** ponto da ligação ou da peça, mundo */
  p: Vec2;
  /** faixa de camadas ("2–4"), embaixo do número */
  sub?: string;
  /** maior = mais importante */
  priority: number;
}

export interface Callout extends CalloutTarget {
  label: Vec2;
  /** caminho da linha de chamada (do rótulo até o ponto) */
  d: string;
  hidden: boolean;
  /** cruzamentos com contornos além dos inevitáveis */
  extra: number;
}

export interface CalloutGeometry {
  /** verdadeiro onde há peça (o número fica em espaço livre) */
  occupied?: (p: Vec2) => boolean;
  /** quantos contornos de peça o segmento a–b cruza */
  crossings?: (a: Vec2, b: Vec2) => number;
  /** quantas peças contêm o ponto (os cruzamentos inevitáveis) */
  containing?: (p: Vec2) => number;
}

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();

function segCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const o = (p: Vec2, q: Vec2, r: Vec2) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(a, b, c);
  const d2 = o(a, b, d);
  const d3 = o(c, d, a);
  const d4 = o(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Pontos da curva da chamada: início (a 9 px do número), controle e fim. */
export function calloutCurve(label: Vec2, p: Vec2, px: number): [Vec2, Vec2, Vec2] {
  const dx = p[0] - label[0];
  const dy = p[1] - label[1];
  const L = Math.hypot(dx, dy) || 1;
  const s: Vec2 = [label[0] + (dx / L) * 9 * px, label[1] + (dy / L) * 9 * px];
  // curva: controle deslocado para o lado, 22% do comprimento
  const k = 0.22 * L;
  const c: Vec2 = [(s[0] + p[0]) / 2 - (dy / L) * k, (s[1] + p[1]) / 2 + (dx / L) * k];
  return [s, c, p];
}

/** A curva em 8 segmentos (para contar cruzamentos). */
function curvePoints(label: Vec2, p: Vec2, px: number): Vec2[] {
  const [s, c, e] = calloutCurve(label, p, px);
  const out: Vec2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const u = 1 - t;
    out.push([
      u * u * s[0] + 2 * u * t * c[0] + t * t * e[0],
      u * u * s[1] + 2 * u * t * c[1] + t * t * e[1],
    ]);
  }
  return out;
}

const ANGLES = 24;

export function layoutCallouts(
  targets: CalloutTarget[],
  bounds: Box,
  px: number,
  geo: CalloutGeometry | ((p: Vec2) => boolean) = {},
): Callout[] {
  if (targets.length === 0) return [];
  const g: CalloutGeometry = typeof geo === "function" ? { occupied: geo } : geo;
  const occupied = g.occupied ?? (() => false);
  const c: Vec2 = [bounds[0] + bounds[2] / 2, bounds[1] + bounds[3] / 2];
  const reach = Math.hypot(bounds[2], bounds[3]) / 2 + 60 * px;
  const size = (t: CalloutTarget): [number, number] => [
    (String(t.ref).length * 8 + 8) * px,
    (t.sub ? 30 : 18) * px,
  ];
  const placed: Callout[] = [];
  const overlaps = (q: Vec2, wh: [number, number], skip?: Callout) =>
    placed.some((o) => {
      if (o.hidden || o === skip) return false;
      const ow = size(o);
      return (
        Math.abs(o.label[0] - q[0]) * 2 < ow[0] + wh[0] && Math.abs(o.label[1] - q[1]) * 2 < ow[1] + wh[1]
      );
    });
  const free = (q: Vec2, wh: [number, number]) => {
    const hw = wh[0] / 2 + 3 * px;
    const hh = wh[1] / 2 + 3 * px;
    for (const d of [
      [0, 0],
      [-hw, -hh],
      [hw, -hh],
      [-hw, hh],
      [hw, hh],
      [0, -hh],
      [0, hh],
    ] as const)
      if (occupied([q[0] + d[0], q[1] + d[1]])) return false;
    return true;
  };
  const crossCount = (label: Vec2, p: Vec2) => {
    if (!g.crossings) return 0;
    const pts = curvePoints(label, p, px);
    let n = 0;
    for (let i = 1; i < pts.length; i++) n += g.crossings(pts[i - 1]!, pts[i]!);
    return n;
  };

  const order = targets.slice().sort((a, b) => b.priority - a.priority);
  for (const t of order) {
    const wh = size(t);
    let dx = t.p[0] - c[0];
    let dy = t.p[1] - c[1];
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) {
      dx = 0;
      dy = -1;
    } else {
      dx /= L;
      dy /= L;
    }
    const out0 = Math.atan2(dy, dx);
    const base = g.containing?.(t.p) ?? 0;
    let best: { q: Vec2; score: number; cost: number } | null = null;
    // um candidato por direção: o primeiro lugar livre marchando para fora do ponto
    for (let i = 0; i < ANGLES; i++) {
      const th = out0 + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * ((2 * Math.PI) / ANGLES);
      for (let r = 26 * px; r <= reach; r += 6 * px) {
        const q: Vec2 = [t.p[0] + Math.cos(th) * r, t.p[1] + Math.sin(th) * r];
        if (!free(q, wh) || overlaps(q, wh)) continue;
        const score = Math.max(0, crossCount(q, t.p) - base);
        // custo: comprimento e quanto a direção foge de "para fora do desenho"
        const dev = Math.abs(Math.atan2(Math.sin(th - out0), Math.cos(th - out0)));
        const cost = r / px + dev * 40;
        if (!best || score < best.score || (score === best.score && cost < best.cost))
          best = { q, score, cost };
        break;
      }
      if (best && best.score === 0 && i >= 8) break;
    }
    if (best && best.score > 0 && g.crossings) {
      // sem caminho limpo: para fora do contorno da cena, na direção do ponto
      for (let r = 0; r <= 120 * px; r += 6 * px) {
        const ex = Math.abs(dx) > 1e-9 ? (bounds[2] / 2 + 16 * px + r) / Math.abs(dx) : Infinity;
        const ey = Math.abs(dy) > 1e-9 ? (bounds[3] / 2 + 16 * px + r) / Math.abs(dy) : Infinity;
        const e = Math.min(ex, ey);
        const q: Vec2 = [c[0] + dx * e, c[1] + dy * e];
        if (free(q, wh) && !overlaps(q, wh)) {
          best = { q, score: Math.max(0, crossCount(q, t.p) - base), cost: Infinity };
          break;
        }
      }
    }
    placed.push({
      ...t,
      label: best?.q ?? t.p,
      d: "",
      hidden: !best,
      extra: best?.score ?? 0,
    });
  }
  // linhas que ainda se cruzam: troca os rótulos se não piorar os cruzamentos com peças
  for (let pass = 0; pass < 6; pass++) {
    let swapped = false;
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++) {
        const A = placed[i]!;
        const B = placed[j]!;
        if (A.hidden || B.hidden) continue;
        if (!segCross(A.label, A.p, B.label, B.p)) continue;
        const bA = g.containing?.(A.p) ?? 0;
        const bB = g.containing?.(B.p) ?? 0;
        const eA = Math.max(0, crossCount(B.label, A.p) - bA);
        const eB = Math.max(0, crossCount(A.label, B.p) - bB);
        if (eA + eB > A.extra + B.extra) continue;
        const tmp = A.label;
        A.label = B.label;
        B.label = tmp;
        A.extra = eA;
        B.extra = eB;
        swapped = true;
      }
    if (!swapped) break;
  }
  for (const o of placed) o.d = calloutPath(o.label, o.p, px);
  // ordem original
  const idx = new Map(targets.map((t, i) => [t.id, i] as const));
  return placed.sort((a, b) => (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0));
}

/** Linha de chamada: curva suave do rótulo até o ponto, começando a 9 px do número. */
export function calloutPath(label: Vec2, p: Vec2, px: number): string {
  const [s, c, e] = calloutCurve(label, p, px);
  return `M${f(s[0])} ${f(s[1])}Q${f(c[0])} ${f(c[1])} ${f(e[0])} ${f(e[1])}`;
}

/**
 * Geometria das chamadas a partir dos contornos no mundo: espaço ocupado,
 * cruzamentos de um segmento com os contornos e peças que contêm um ponto.
 */
export function outlineGeometry(
  rings: Vec2[][][],
  contains: (shape: number, p: Vec2) => boolean,
): Required<CalloutGeometry> {
  const boxes = rings.map((shape) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const r of shape)
      for (const q of r) {
        x0 = Math.min(x0, q[0]);
        y0 = Math.min(y0, q[1]);
        x1 = Math.max(x1, q[0]);
        y1 = Math.max(y1, q[1]);
      }
    return [x0, y0, x1, y1] as const;
  });
  const inBox = (i: number, p: Vec2) => {
    const b = boxes[i]!;
    return p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
  };
  return {
    occupied: (p) => rings.some((_, i) => inBox(i, p) && contains(i, p)),
    containing: (p) => rings.reduce((n, _, i) => n + (inBox(i, p) && contains(i, p) ? 1 : 0), 0),
    crossings: (a, b) => {
      const sx0 = Math.min(a[0], b[0]);
      const sx1 = Math.max(a[0], b[0]);
      const sy0 = Math.min(a[1], b[1]);
      const sy1 = Math.max(a[1], b[1]);
      let n = 0;
      rings.forEach((shape, i) => {
        const bx = boxes[i]!;
        if (bx[2] < sx0 || bx[0] > sx1 || bx[3] < sy0 || bx[1] > sy1) return;
        let hit = false;
        for (const r of shape) {
          for (let k = 0; k < r.length; k++)
            if (segCross(a, b, r[k]!, r[(k + 1) % r.length]!)) {
              hit = true;
              break;
            }
          if (hit) break;
        }
        // conta peças cruzadas (uma vez por peça por segmento)
        if (hit) n++;
      });
      return n;
    },
  };
}
