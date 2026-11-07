import type { Vec2 } from "@/geometry/vec";
import type { Id } from "@/model/types";
import { containsPoint, type PolyWithHoles } from "@/geometry/polygon";
import { distToSegment } from "@/geometry/vec";
import type { LinkModel, PartModel, SceneModel } from "./prepare";
import type { Box } from "./view";

/**
 * Vista para entender o mecanismo (Parte E2d): camadas em cores, camadas
 * afastadas em 2,5D, isolar a camada ativa e peças escondidas. Nada disto
 * muda a cena, o hash ou a simulação: é só o jeito de desenhar e de tocar.
 */
export interface Look {
  colors: boolean;
  /** afastamento entre camadas vizinhas, px de tela (0 = juntas) */
  spread: number;
  isolate: boolean;
  /** peças escondidas */
  hidden: ReadonlySet<Id>;
}

export const NO_LOOK: Look = { colors: false, spread: 0, isolate: false, hidden: new Set() };

/** Direção do afastamento na tela: para cima e para a direita. */
export const SPREAD_DIR: Vec2 = [0.8, -0.6];

/** Deslocamento da folha da camada `i` na tela, px. A camada 1 (o fundo) fica no lugar. */
export function spreadOffset(i: number, spread: number): Vec2 {
  return i === 0 ? [0, 0] : [i * spread * SPREAD_DIR[0], i * spread * SPREAD_DIR[1]];
}

/**
 * Caixa (mm) que o conjunto afastado ocupa no zoom `zoom`: a do enquadramento
 * crescida pelo deslocamento da camada mais alta.
 */
export function spreadBox(focus: Box, layers: number, spread: number, pxPerMm: number): Box {
  const top = spreadOffset(Math.max(0, layers - 1), spread);
  const dx = top[0] / pxPerMm;
  const dy = top[1] / pxPerMm;
  return [
    focus[0] + Math.min(0, dx),
    focus[1] + Math.min(0, dy),
    focus[2] + Math.abs(dx),
    focus[3] + Math.abs(dy),
  ];
}

/** Peças de que cada ligação depende (null = o fundo). */
function touched(lm: LinkModel): (Id | null)[] {
  const l = lm.link;
  switch (l.kind) {
    case "pin":
    case "sensor":
      return [l.host];
    case "slot":
      return [l.guide];
    case "chamber":
      return [l.body, ...l.walls.map((w) => w.part)];
    default:
      return [l.a, l.b];
  }
}

export type LinkShow = "shown" | "half" | "gone";

/**
 * Uma ligação some quando só toca peças escondidas (o fundo não conta),
 * fica com a ponta tracejada quando liga uma escondida a uma visível, e no
 * isolar só aparece se toca a camada ativa.
 */
export function linkShow(lm: LinkModel, look: Look, active: number): LinkShow {
  if (look.isolate && !(lm.span[0] <= active && active <= lm.span[1])) return "gone";
  if (!look.hidden.size) return "shown";
  const parts = touched(lm).filter((p): p is Id => p !== null);
  if (!parts.length) return "shown";
  const hid = parts.filter((p) => look.hidden.has(p)).length;
  if (hid === 0) return "shown";
  return hid === parts.length ? "gone" : "half";
}

/** Ponta escondida de uma ligação de duas pontas: "a", "b" ou nenhuma. */
export function hiddenEnd(lm: LinkModel, look: Look): "a" | "b" | null {
  const l = lm.link;
  if (l.kind !== "spring" && l.kind !== "rod" && l.kind !== "cable") return null;
  if (l.a && look.hidden.has(l.a)) return "a";
  if (l.b && look.hidden.has(l.b)) return "b";
  return null;
}

/**
 * Modelo para o toque: sem as peças escondidas e, no isolar, só com a
 * camada ativa. As ferramentas (seleção, Martelo, Lápis) usam este modelo,
 * então a peça escondida não recebe toque em nenhuma delas.
 */
export function touchModel(model: SceneModel, look: Look, active: number): SceneModel {
  if (!look.hidden.size && !look.isolate) return model;
  const keep = (m: PartModel) => !look.hidden.has(m.part.id) && (!look.isolate || m.layer === active);
  const partList = model.partList.filter(keep);
  return {
    ...model,
    partList,
    parts: new Map([...model.parts].filter(([, m]) => keep(m))),
    layers: model.layers.map((L) => ({ ...L, parts: L.parts.filter(keep) })),
  };
}

// ——— selo do número da camada ———

export interface BadgeSpot {
  /** ponto local mais longe das bordas */
  at: Vec2;
  /** distância dele até a borda, mm */
  room: number;
  /** caixa local: x0, y0, x1, y1 */
  box: [number, number, number, number];
}

const spots = new WeakMap<PartModel, BadgeSpot>();

function edgeDistance(outline: PolyWithHoles[], p: Vec2): number {
  let d = Infinity;
  for (const s of outline)
    for (const r of [s.outer, ...s.holes])
      for (let i = 0; i < r.length; i++) d = Math.min(d, distToSegment(p, r[i]!, r[(i + 1) % r.length]!));
  return d;
}

/**
 * Lugar do selo dentro da peça (espaço local): o ponto de uma grade 11×11
 * mais longe das bordas, com a folga dele (mm). Calculado uma vez por peça.
 */
export function badgeSpot(m: PartModel): BadgeSpot {
  const got = spots.get(m);
  if (got) return got;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of m.outline)
    for (const q of s.outer) {
      x0 = Math.min(x0, q[0]);
      y0 = Math.min(y0, q[1]);
      x1 = Math.max(x1, q[0]);
      y1 = Math.max(y1, q[1]);
    }
  let best: { at: Vec2; room: number } = { at: [(x0 + x1) / 2, (y0 + y1) / 2], room: 0 };
  const N = 10;
  for (let i = 0; i <= N; i++)
    for (let j = 0; j <= N; j++) {
      const p: Vec2 = [x0 + ((x1 - x0) * i) / N, y0 + ((y1 - y0) * j) / N];
      if (!m.outline.some((s) => containsPoint(s, p))) continue;
      const room = edgeDistance(m.outline, p);
      // preferência leve pelo meio da caixa (o selo não foge para uma ponta)
      const centre =
        Math.hypot(p[0] - (x0 + x1) / 2, p[1] - (y0 + y1) / 2) / Math.max(1e-6, x1 - x0 + y1 - y0);
      if (room * (1 - 0.3 * centre) > best.room) best = { at: p, room };
    }
  if (best.room === 0) best = { at: [x1, y0], room: 0 };
  const out: BadgeSpot = { ...best, box: [x0, y0, x1, y1] };
  spots.set(m, out);
  return out;
}
