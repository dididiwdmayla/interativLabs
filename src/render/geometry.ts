import type { PartPose } from "@/engine/types";
import type { Vec2 } from "@/geometry/vec";
import type { ChamberLink, Scene } from "@/model/types";
import { shapeOutline } from "@/geometry/outline";
import { assets } from "@/assets/registry";
import { worldOf } from "./prepare";

/**
 * Desenho das ligações que mudam de forma: mola (espiras do lote 01),
 * cabo (reto esticado, curva quando frouxo) e o gás da câmara.
 */

const COIL = assets["spring-coil"];
const END = assets["spring-end"];
/** Ø externo de referência da espira do lote 01, mm */
const COIL_REF_D = 6;
/** fração do passo em que as espiras do desenho encostam (fio da frente) */
export const COIL_TOUCH = 0.32;

export interface CoilMetrics {
  /** mm por px da imagem, na escala da mola */
  s: number;
  /** passo de uma espira, mm */
  pitch: number;
  /** do olhal até a primeira espira, mm (o olhal cobre 20% dela) */
  end: number;
}

export function coilMetrics(outerD: number): CoilMetrics {
  const s = (COIL.mmPerPx ?? 0.0441) * (outerD / COIL_REF_D);
  return {
    s,
    pitch: COIL.width * s,
    end: ((1 - END.anchor.x) * END.width - 0.2 * COIL.width) * s,
  };
}

/** Faixa do scaleX das espiras na pose desenhada (manifesto do lote 01). */
export const COIL_SCALE_MIN = 0.6;
export const COIL_SCALE_MAX = 1.6;

/**
 * Quantas espiras desenhar: vem do comprimento livre e não muda durante a
 * simulação. Se o comprimento desenhado (`drawn`) deixaria o scaleX fora de
 * 0,6–1,6, N é corrigido para caber (o que acontece no fim de um gesto).
 */
export function coilCount(freeLength: number, outerD: number, drawn = freeLength): number {
  const m = coilMetrics(outerD);
  let n = Math.max(1, Math.round((freeLength - 2 * m.end) / m.pitch));
  const avail = Math.max(0, drawn - 2 * m.end);
  const hi = Math.floor(avail / (m.pitch * COIL_SCALE_MIN));
  const lo = Math.ceil(avail / (m.pitch * COIL_SCALE_MAX));
  if (n > hi) n = hi;
  if (n < lo) n = lo;
  return Math.max(1, n);
}

/** Escala horizontal das espiras para o comprimento atual; no sólido, encostam. */
export function coilScale(length: number, n: number, outerD: number, solid = 0): number {
  const m = coilMetrics(outerD);
  if (length <= solid + 1e-6) return COIL_TOUCH;
  return Math.max(COIL_TOUCH, (length - 2 * m.end) / (n * m.pitch));
}

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();

/** Folga a partir da qual o cabo é desenhado frouxo, mm. */
export const CABLE_SLACK_MIN = 0.05;

/**
 * Cabo de a até b com comprimento máximo `max`: reta quando esticado; com
 * folga, uma curva de segundo grau com a flecha da catenária aproximada
 * pela parábola (comprimento ≈ c + 8h²/3c), pendendo para baixo (+y).
 */
export function cablePath(a: Vec2, b: Vec2, max: number): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const c = Math.hypot(dx, dy);
  const slack = max - c;
  if (slack <= CABLE_SLACK_MIN || c < 1e-6) return `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`;
  const h = Math.sqrt((3 * c * slack) / 8);
  // normal à corda do lado de baixo (+y); corda vertical: para +x
  let nx = -dy / c;
  let ny = dx / c;
  if (ny < 0 || (Math.abs(ny) < 1e-9 && nx < 0)) {
    nx = -nx;
    ny = -ny;
  }
  const mx = (a[0] + b[0]) / 2 + nx * 2 * h;
  const my = (a[1] + b[1]) / 2 + ny * 2 * h;
  return `M${f(a[0])} ${f(a[1])}Q${f(mx)} ${f(my)} ${f(b[0])} ${f(b[1])}`;
}

/** Faces das paredes da câmara ao longo do eixo, na pose desenhada. */
export interface ChamberGeo {
  link: ChamberLink;
  walls: { s0: number; side: 1 | -1 }[];
}

export function chamberGeo(scene: Scene, link: ChamberLink): ChamberGeo {
  const byId = new Map(scene.parts.map((p) => [p.id, p] as const));
  const body = link.body === null ? null : (byId.get(link.body) ?? null);
  const ang = (body?.angle ?? 0) + link.dir;
  const u: Vec2 = [Math.cos(ang), Math.sin(ang)];
  const base = body ? worldOf(body, link.at) : link.at;
  const ext = link.walls.map((w) => {
    const p = byId.get(w.part);
    const g = p ? shapeOutline(p.shape) : null;
    let mn = Infinity;
    let mx = -Infinity;
    if (p && g?.ok)
      for (const s of g.value.outline)
        for (const q of s.outer) {
          const wq = worldOf(p, q);
          const t = (wq[0] - base[0]) * u[0] + (wq[1] - base[1]) * u[1];
          mn = Math.min(mn, t);
          mx = Math.max(mx, t);
        }
    return { mn, mx, mid: (mn + mx) / 2 };
  });
  const [e0, e1] = ext;
  const front = e0 && e1 && e1.mid > e0.mid ? 1 : 0;
  return {
    link,
    walls: ext.map((e, i) =>
      ext.length === 1 || i === front ? { s0: e.mn, side: 1 } : { s0: e.mx, side: -1 },
    ),
  };
}

/** Polígono do gás no mundo, pelo curso das paredes. */
export function gasPolygon(
  c: ChamberGeo,
  body: PartPose | null | undefined,
  travel: readonly number[],
): string {
  let front = Infinity;
  let rear = 0;
  c.walls.forEach((w, i) => {
    const pos = w.s0 + w.side * (travel[i] ?? 0);
    if (w.side > 0) front = Math.min(front, pos);
    else rear = pos;
  });
  if (!Number.isFinite(front)) front = c.link.length;
  front = Math.min(front, c.link.length);
  const ang = (body?.angle ?? 0) + c.link.dir;
  const u: Vec2 = [Math.cos(ang), Math.sin(ang)];
  const n: Vec2 = [-u[1], u[0]];
  const base = worldOf(body ?? null, c.link.at);
  const hw = c.link.bore / 2;
  const at = (t: number, k: number) =>
    `${f(base[0] + u[0] * t + n[0] * k)},${f(base[1] + u[1] * t + n[1] * k)}`;
  return [at(rear, -hw), at(front, -hw), at(front, hw), at(rear, hw)].join(" ");
}
