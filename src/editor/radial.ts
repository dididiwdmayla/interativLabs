/**
 * Geometria do menu circular de borda (docs/arquitetura.md §6, "Gestos"):
 * os itens num arco de 120° a 150°, voltado para o meio da tela, com o
 * centro na borda. O raio e o centro se ajustam para nenhum item sair da
 * tela nem entrar na área do entalhe. Tudo em px do palco. Sem DOM.
 */

export interface RadialInput {
  side: "left" | "right";
  /** centro vertical pedido (o dedo), px */
  cy: number;
  width: number;
  height: number;
  /** áreas seguras, px */
  insets: { top: number; right: number; bottom: number; left: number };
  count: number;
  /** raio do alvo de cada item, px */
  itemR?: number;
}

export interface RadialLayout {
  cx: number;
  cy: number;
  r: number;
  /** abertura do arco, graus */
  span: number;
  /** centros dos itens, de cima para baixo */
  items: { x: number; y: number; angle: number }[];
  itemR: number;
}

export const ITEM_R = 26;
const MARGIN = 10;
const R_MIN = 96;
const R_MAX = 170;
/** espaço mínimo entre centros vizinhos ao longo do arco */
const GAP = 60;

const DEG = Math.PI / 180;

export function radialLayout(o: RadialInput): RadialLayout {
  const itemR = o.itemR ?? ITEM_R;
  const n = Math.max(1, o.count);
  const top = o.insets.top + MARGIN + itemR;
  const bottom = o.height - o.insets.bottom - MARGIN - itemR;
  const avail = Math.max(0, bottom - top);
  // abertura: 120° com poucos itens, até 150° com muitos
  const span = n <= 3 ? 120 : n >= 6 ? 150 : 120 + (n - 3) * 10;
  const half = (span / 2) * DEG;
  const step = n > 1 ? (span * DEG) / (n - 1) : 0;
  // raio: o bastante para separar os itens, sem passar da altura útil
  const rNeed = n > 1 ? GAP / step : R_MIN;
  const rFit = avail / (2 * Math.sin(half));
  // folga de 45% sobre o mínimo: os rótulos ao lado dos itens das pontas não encostam no vizinho
  const r = Math.max(R_MIN * 0.75, Math.min(R_MAX, rFit, Math.max(R_MIN, rNeed * 1.45)));
  const edge = o.side === "right" ? o.width - o.insets.right - MARGIN : o.insets.left + MARGIN;
  // o centro recua se o item da ponta do arco ficaria colado na borda
  const inset = Math.max(0, itemR - r * Math.cos(half));
  const cx = o.side === "right" ? edge - inset : edge + inset;
  const ext = r * Math.sin(half);
  const cy = Math.min(bottom - ext, Math.max(top + ext, o.cy));
  const items: RadialLayout["items"] = [];
  for (let i = 0; i < n; i++) {
    // de cima para baixo (y da tela para baixo): t vai de −half a +half
    const t = n > 1 ? -half + i * step : 0;
    const a = o.side === "right" ? Math.PI - t : t;
    items.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(t), angle: a });
  }
  return { cx, cy, r, span, items, itemR };
}

/** Índice do item sob o ponto (alvo um pouco maior que o desenho), ou −1. */
export function radialHit(l: RadialLayout, x: number, y: number, slack = 8): number {
  let best = -1;
  let bd = l.itemR + slack;
  l.items.forEach((it, i) => {
    const d = Math.hypot(it.x - x, it.y - y);
    if (d <= bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}
