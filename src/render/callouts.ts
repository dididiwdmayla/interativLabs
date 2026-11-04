import type { Vec2 } from "@/geometry/vec";
import type { Box } from "./view";

/**
 * Números de chamada (identidade, "Ligações"): número fora das peças, em
 * espaço livre, com uma linha curva fina até um ponto sobre a ligação.
 * Os rótulos ficam na borda de uma caixa em volta do desenho, na mesma
 * ordem angular dos pontos em volta do centro; assim as linhas não se
 * cruzam. Rótulos que ainda colidem depois do espalhamento são escondidos,
 * os de menor prioridade primeiro. Tudo em mm do mundo.
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

/**
 * @param bounds caixa do desenho (mm)
 * @param px mm por px de tela (o número tem 13 px)
 * @param occupied verdadeiro onde há peça (o número fica em espaço livre)
 */
export function layoutCallouts(
  targets: CalloutTarget[],
  bounds: Box,
  px: number,
  occupied: (p: Vec2) => boolean = () => false,
): Callout[] {
  if (targets.length === 0) return [];
  const c: Vec2 = [bounds[0] + bounds[2] / 2, bounds[1] + bounds[3] / 2];
  const reach = Math.hypot(bounds[2], bounds[3]) / 2 + 60 * px;
  const size = (t: CalloutTarget): [number, number] => [
    (String(t.ref).length * 8 + 8) * px,
    (t.sub ? 30 : 18) * px,
  ];
  const placed: Callout[] = [];
  const overlaps = (q: Vec2, wh: [number, number]) =>
    placed.some((o) => {
      if (o.hidden) return false;
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
    const th0 = Math.atan2(dy, dx);
    let found: Vec2 | null = null;
    // marcha para fora do ponto, ao longo da direção do centro, com desvios de até 60°
    outer: for (let r = 26 * px; r <= reach; r += 6 * px)
      for (const dth of [0, 0.26, -0.26, 0.52, -0.52, 0.79, -0.79, 1.05, -1.05]) {
        const th = th0 + dth;
        const q: Vec2 = [t.p[0] + Math.cos(th) * r, t.p[1] + Math.sin(th) * r];
        if (free(q, wh) && !overlaps(q, wh)) {
          found = q;
          break outer;
        }
      }
    placed.push({ ...t, label: found ?? t.p, d: "", hidden: !found });
  }
  // linhas que ainda se cruzam: troca os rótulos (os dois lugares já são livres)
  for (let pass = 0; pass < 6; pass++) {
    let swapped = false;
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++) {
        const A = placed[i]!;
        const B = placed[j]!;
        if (A.hidden || B.hidden) continue;
        if (segCross(A.label, A.p, B.label, B.p)) {
          const tmp = A.label;
          A.label = B.label;
          B.label = tmp;
          swapped = true;
        }
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
  const dx = p[0] - label[0];
  const dy = p[1] - label[1];
  const L = Math.hypot(dx, dy) || 1;
  const s: Vec2 = [label[0] + (dx / L) * 9 * px, label[1] + (dy / L) * 9 * px];
  // curva: controle deslocado para o lado, 18% do comprimento
  const k = 0.22 * L;
  const cx = (s[0] + p[0]) / 2 - (dy / L) * k;
  const cy = (s[1] + p[1]) / 2 + (dx / L) * k;
  return `M${f(s[0])} ${f(s[1])}Q${f(cx)} ${f(cy)} ${f(p[0])} ${f(p[1])}`;
}
