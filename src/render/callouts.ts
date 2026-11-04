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

/** Ponto da borda do retângulo (centro c, meias larguras hw, hh) na direção θ. */
function onRect(c: Vec2, hw: number, hh: number, th: number): Vec2 {
  const dx = Math.cos(th);
  const dy = Math.sin(th);
  const k = Math.min(
    Math.abs(dx) > 1e-9 ? hw / Math.abs(dx) : Infinity,
    Math.abs(dy) > 1e-9 ? hh / Math.abs(dy) : Infinity,
  );
  return [c[0] + dx * k, c[1] + dy * k];
}

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
 * @param px mm por px de tela (o número tem 13 px; a margem, 26 px)
 */
export function layoutCallouts(targets: CalloutTarget[], bounds: Box, px: number): Callout[] {
  if (targets.length === 0) return [];
  const c: Vec2 = [bounds[0] + bounds[2] / 2, bounds[1] + bounds[3] / 2];
  const margin = 26 * px;
  const hw = bounds[2] / 2 + margin;
  const hh = bounds[3] / 2 + margin;
  const minGap = 26 * px; // distância mínima entre rótulos ao longo da borda

  // posição ao longo do perímetro (0..per), na ordem angular
  const items = targets
    .map((t) => {
      const th = Math.atan2(t.p[1] - c[1], t.p[0] - c[0]) || -Math.PI / 2;
      return { t, th };
    })
    .sort((a, b) => a.th - b.th);
  const perimPos = (p: Vec2) => {
    // parâmetro de perímetro de um ponto da borda, a partir do canto superior esquerdo, horário
    const x = p[0] - (c[0] - hw);
    const y = p[1] - (c[1] - hh);
    const W = 2 * hw;
    const H = 2 * hh;
    if (Math.abs(y) < 1e-6) return x;
    if (Math.abs(x - W) < 1e-6) return W + y;
    if (Math.abs(y - H) < 1e-6) return W + H + (W - x);
    return 2 * W + H + (H - y);
  };
  const fromPerim = (s: number): Vec2 => {
    const W = 2 * hw;
    const H = 2 * hh;
    s = ((s % (2 * (W + H))) + 2 * (W + H)) % (2 * (W + H));
    const x0 = c[0] - hw;
    const y0 = c[1] - hh;
    if (s < W) return [x0 + s, y0];
    if (s < W + H) return [x0 + W, y0 + (s - W)];
    if (s < 2 * W + H) return [x0 + W - (s - W - H), y0 + H];
    return [x0, y0 + H - (s - 2 * W - H)];
  };
  const total = 2 * (2 * hw + 2 * hh);
  const pos = items.map((it) => perimPos(onRect(c, hw, hh, it.th)));
  // espalha mantendo a ordem: algumas passadas de afastamento
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let i = 0; i < pos.length; i++) {
      const j = (i + 1) % pos.length;
      if (pos.length < 2) break;
      let gap = pos[j]! - pos[i]!;
      if (j === 0) gap += total;
      if (gap < minGap) {
        const push = (minGap - gap) / 2;
        pos[i] = pos[i]! - push;
        pos[j] = pos[j]! + push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  const out: Callout[] = items.map((it, i) => {
    const label = fromPerim(pos[i]!);
    return { ...it.t, label, d: "", hidden: false };
  });
  // cruzamentos restantes: troca os rótulos
  for (let pass = 0; pass < 6; pass++) {
    let swapped = false;
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) {
        const A = out[i]!;
        const B = out[j]!;
        if (segCross(A.label, A.p, B.label, B.p)) {
          const t = A.label;
          A.label = B.label;
          B.label = t;
          swapped = true;
        }
      }
    if (!swapped) break;
  }
  // colisão entre rótulos: esconde o de menor prioridade
  const box = (o: Callout) => {
    const w = (String(o.ref).length * 8 + 6) * px;
    const h = (o.sub ? 30 : 18) * px;
    return [o.label[0] - w / 2, o.label[1] - h / 2, w, h] as const;
  };
  const byPrio = out.slice().sort((a, b) => b.priority - a.priority);
  const kept: Callout[] = [];
  for (const o of byPrio) {
    const b = box(o);
    const hit = kept.some((k) => {
      const q = box(k);
      return b[0] < q[0] + q[2] && q[0] < b[0] + b[2] && b[1] < q[1] + q[3] && q[1] < b[1] + b[3];
    });
    if (hit) o.hidden = true;
    else kept.push(o);
  }
  for (const o of out) o.d = calloutPath(o.label, o.p, px);
  return out;
}

/** Linha de chamada: curva suave do rótulo até o ponto, começando a 9 px do número. */
export function calloutPath(label: Vec2, p: Vec2, px: number): string {
  const dx = p[0] - label[0];
  const dy = p[1] - label[1];
  const L = Math.hypot(dx, dy) || 1;
  const s: Vec2 = [label[0] + (dx / L) * 9 * px, label[1] + (dy / L) * 9 * px];
  // curva: controle deslocado para o lado, 18% do comprimento
  const k = 0.18 * L;
  const cx = (s[0] + p[0]) / 2 - (dy / L) * k;
  const cy = (s[1] + p[1]) / 2 + (dx / L) * k;
  return `M${f(s[0])} ${f(s[1])}Q${f(cx)} ${f(cy)} ${f(p[0])} ${f(p[1])}`;
}
