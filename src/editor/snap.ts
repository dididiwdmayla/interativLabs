import type { Vec2 } from "@/geometry/vec";
import type { PartPose } from "@/engine/types";

/**
 * Encaixe magnético ao mover uma peça (docs/arquitetura.md §6, "Peça
 * selecionada"): nos centros de furos e círculos e nos vértices de outras
 * peças (ponto), nas bordas delas (segmento), no prolongamento dos eixos de
 * outras ligações (retas horizontal e vertical por cada ligação e a reta do
 * trilho) e na grade. O primeiro que couber dentro da tolerância vale,
 * nessa ordem. Tudo em mm do mundo. Sem DOM.
 */

export interface SnapFeature {
  /** ponto da peça que se move, no espaço local dela */
  local: Vec2;
  kind: "origin" | "center" | "vertex";
}

export interface SnapTargets {
  /** centros (peças, furos, círculos) e vértices de outras peças, mundo */
  points: { p: Vec2; kind: "center" | "vertex" | "link" }[];
  /** bordas de outras peças, mundo */
  edges: [Vec2, Vec2][];
  /** retas: ponto e direção unitária (eixos das ligações) */
  lines: { p: Vec2; u: Vec2 }[];
  grid: { on: boolean; step: number };
}

export type SnapGuide =
  | { kind: "point"; at: Vec2; target: "center" | "vertex" | "link" }
  | { kind: "edge"; a: Vec2; b: Vec2; at: Vec2 }
  | { kind: "line"; p: Vec2; u: Vec2 }
  | { kind: "grid"; at: Vec2 };

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
  /** chave do encaixe (muda quando o alvo muda: vibração curta) */
  key: string | null;
}

const world = (pose: PartPose, q: Vec2): Vec2 => {
  const c = Math.cos(pose.angle);
  const s = Math.sin(pose.angle);
  return [pose.x + q[0] * c - q[1] * s, pose.y + q[0] * s + q[1] * c];
};

function nearestOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy;
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  return [a[0] + dx * t, a[1] + dy * t];
}

const k3 = (v: Vec2) => `${v[0].toFixed(2)},${v[1].toFixed(2)}`;

/**
 * @param pose pose proposta pelo dedo
 * @param features pontos da peça que se move
 * @param tol tolerância, mm (cerca de 10 px de tela)
 */
export function snapMove(pose: PartPose, features: SnapFeature[], t: SnapTargets, tol: number): SnapResult {
  const feats = features.map((f) => ({ ...f, w: world(pose, f.local) }));
  // 1. ponto com ponto: centro e furo com centro, vértice com vértice
  let best: { d: number; dx: number; dy: number; g: SnapGuide } | null = null;
  for (const f of feats)
    for (const q of t.points) {
      if (f.kind === "vertex" && q.kind !== "vertex") continue;
      if (f.kind !== "vertex" && q.kind === "vertex") continue;
      const d = Math.hypot(q.p[0] - f.w[0], q.p[1] - f.w[1]);
      if (d <= tol && (!best || d < best.d))
        best = { d, dx: q.p[0] - f.w[0], dy: q.p[1] - f.w[1], g: { kind: "point", at: q.p, target: q.kind } };
    }
  if (best)
    return {
      x: pose.x + best.dx,
      y: pose.y + best.dy,
      guides: [best.g],
      key: `p:${k3((best.g as { at: Vec2 }).at)}`,
    };
  // 2. borda: vértice ou centro da peça encostando na borda de outra
  for (const f of feats)
    for (const [a, b] of t.edges) {
      const n = nearestOnSegment(f.w, a, b);
      const d = Math.hypot(n[0] - f.w[0], n[1] - f.w[1]);
      if (d <= tol && (!best || d < best.d))
        best = { d, dx: n[0] - f.w[0], dy: n[1] - f.w[1], g: { kind: "edge", a, b, at: n } };
    }
  if (best) {
    const g = best.g as { a: Vec2; b: Vec2 };
    return { x: pose.x + best.dx, y: pose.y + best.dy, guides: [best.g], key: `e:${k3(g.a)}:${k3(g.b)}` };
  }
  // 3. retas dos eixos das ligações: no máximo duas (x e y), a partir da origem e dos centros
  let x = pose.x;
  let y = pose.y;
  const guides: SnapGuide[] = [];
  const keys: string[] = [];
  const centers = feats.filter((f) => f.kind !== "vertex");
  let bx: { d: number; dx: number; l: { p: Vec2; u: Vec2 } } | null = null;
  let by: { d: number; dy: number; l: { p: Vec2; u: Vec2 } } | null = null;
  let bo: { d: number; dx: number; dy: number; l: { p: Vec2; u: Vec2 } } | null = null;
  for (const f of centers)
    for (const l of t.lines) {
      const rx = f.w[0] - l.p[0];
      const ry = f.w[1] - l.p[1];
      const along = rx * l.u[0] + ry * l.u[1];
      const px = l.p[0] + l.u[0] * along - f.w[0];
      const py = l.p[1] + l.u[1] * along - f.w[1];
      const d = Math.hypot(px, py);
      if (d > tol) continue;
      if (Math.abs(l.u[1]) < 1e-6) {
        if (!by || d < by.d) by = { d, dy: py, l };
      } else if (Math.abs(l.u[0]) < 1e-6) {
        if (!bx || d < bx.d) bx = { d, dx: px, l };
      } else if (!bo || d < bo.d) bo = { d, dx: px, dy: py, l };
    }
  if (bx || by) {
    if (bx) {
      x += bx.dx;
      guides.push({ kind: "line", ...bx.l });
      keys.push(`x:${bx.l.p[0].toFixed(2)}`);
    }
    if (by) {
      y += by.dy;
      guides.push({ kind: "line", ...by.l });
      keys.push(`y:${by.l.p[1].toFixed(2)}`);
    }
  } else if (bo) {
    x += bo.dx;
    y += bo.dy;
    guides.push({ kind: "line", ...bo.l });
    keys.push(`l:${k3(bo.l.p)}:${k3(bo.l.u)}`);
  }
  // 4. grade, nos eixos que nada encaixou
  if (t.grid.on && t.grid.step > 0) {
    const s = t.grid.step;
    const gx = Math.round(x / s) * s;
    const gy = Math.round(y / s) * s;
    let hit = false;
    if (!bx && !bo && Math.abs(gx - x) <= tol) {
      x = gx;
      hit = true;
    }
    if (!by && !bo && Math.abs(gy - y) <= tol) {
      y = gy;
      hit = true;
    }
    if (hit && guides.length === 0) guides.push({ kind: "grid", at: [x, y] });
  }
  return { x, y, guides, key: keys.length ? keys.join("|") : null };
}

/** Ângulo com passos de 15° perto dos ângulos redondos (dentro de 4°). */
export function snapAngle(a: number, stepDeg = 15, tolDeg = 4): { angle: number; snapped: boolean } {
  const step = (stepDeg * Math.PI) / 180;
  const r = Math.round(a / step) * step;
  return Math.abs(r - a) <= (tolDeg * Math.PI) / 180
    ? { angle: r, snapped: true }
    : { angle: a, snapped: false };
}
