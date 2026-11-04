import type { PartPose, Snapshot } from "@/engine/types";
import { dcos, dsin } from "@/geometry/dmath";
import type { PolyWithHoles } from "@/geometry/polygon";
import { shapeGeometry } from "@/geometry/shape";
import { transform, type Vec2 } from "@/geometry/vec";
import type { Id, Link, Part, Scene } from "@/model/types";

/**
 * Geometria de desenho do laboratório: contornos das peças (com furos, regra
 * evenodd), pontos das ligações no mundo e o desenho das molas e das câmaras.
 * Desenho provisório (o renderizador definitivo vem na Parte D).
 */

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();

export function outlinePath(outline: PolyWithHoles[]): string {
  let d = "";
  for (const s of outline)
    for (const ring of [s.outer, ...s.holes]) {
      d += ring.map((p, i) => `${i ? "L" : "M"}${f(p[0])} ${f(p[1])}`).join("") + "Z";
    }
  return d;
}

export interface DrawPart {
  part: Part;
  d: string;
  /** índice da camada (0 = fundo) */
  layer: number;
  dynamic: boolean;
}

export function drawParts(scene: Scene): DrawPart[] {
  const order = new Map(scene.layers.map((l, i) => [l.id, i] as const));
  const screwed = new Set(scene.links.flatMap((l) => (l.kind === "screw" && l.a === null ? [l.b] : [])));
  const out: DrawPart[] = [];
  for (const p of scene.parts) {
    const g = shapeGeometry(p.shape);
    if (!g.ok) continue;
    out.push({
      part: p,
      d: outlinePath(g.value.outline),
      layer: order.get(p.layer) ?? 0,
      dynamic: !p.fixed && !screwed.has(p.id),
    });
  }
  return out.sort((a, b) => a.layer - b.layer);
}

export function poseTransform(p: PartPose): string {
  return `translate(${f(p.x)} ${f(p.y)}) rotate(${f((p.angle * 180) / Math.PI)})`;
}

/** Ponto local de uma peça (ou do mundo, com id null) no mundo, pela pose atual. */
export function worldPoint(s: Snapshot, part: Id | null, at: Vec2): Vec2 {
  if (part === null) return at;
  const p = s.parts[part];
  return p ? transform(at, p.x, p.y, p.angle) : at;
}

/** Mola em zigue-zague entre dois pontos: `turns` espiras de largura `w`. */
export function coilPoints(a: Vec2, b: Vec2, turns: number, w: number): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.sqrt(dx * dx + dy * dy) || 1e-9;
  const ux = dx / L;
  const uy = dy / L;
  const n = Math.max(2, Math.round(turns * 2));
  const lead = Math.min(L * 0.08, 2);
  const pts: Vec2[] = [a, [a[0] + ux * lead, a[1] + uy * lead]];
  for (let i = 1; i < n; i++) {
    const t = lead + ((L - 2 * lead) * i) / n;
    const side = i % 2 ? 1 : -1;
    pts.push([a[0] + ux * t - uy * side * (w / 2), a[1] + uy * t + ux * side * (w / 2)]);
  }
  pts.push([b[0] - ux * lead, b[1] - uy * lead], b);
  return pts.map((p) => `${f(p[0])},${f(p[1])}`).join(" ");
}

/** Corpo do gás de uma câmara: retângulo ao longo do eixo entre as faces. */
export interface ChamberDraw {
  link: Extract<Link, { kind: "chamber" }>;
  /** posição inicial de cada face ao longo do eixo e de que lado */
  walls: { s0: number; side: 1 | -1 }[];
}

export function chamberDraws(scene: Scene): ChamberDraw[] {
  const byId = new Map(scene.parts.map((p) => [p.id, p] as const));
  const out: ChamberDraw[] = [];
  for (const l of scene.links) {
    if (l.kind !== "chamber") continue;
    const body = l.body === null ? null : (byId.get(l.body) ?? null);
    const ang = (body?.angle ?? 0) + l.dir;
    const u: Vec2 = [dcos(ang), dsin(ang)];
    const base = body ? transform(l.at, body.x, body.y, body.angle) : l.at;
    const ext = l.walls.map((w) => {
      const p = byId.get(w.part);
      const g = p ? shapeGeometry(p.shape) : null;
      let mn = Infinity;
      let mx = -Infinity;
      if (p && g?.ok)
        for (const s of g.value.outline)
          for (const q of s.outer) {
            const wq = transform(q, p.x, p.y, p.angle);
            const t = (wq[0] - base[0]) * u[0] + (wq[1] - base[1]) * u[1];
            mn = Math.min(mn, t);
            mx = Math.max(mx, t);
          }
      return { mn, mx, mid: (mn + mx) / 2 };
    });
    const [e0, e1] = ext;
    const front = e0 && e1 && e1.mid > e0.mid ? 1 : 0;
    out.push({
      link: l,
      walls: ext.map((e, i) =>
        ext.length === 1 || i === front ? { s0: e.mn, side: 1 } : { s0: e.mx, side: -1 },
      ),
    });
  }
  return out;
}

/** Quatro cantos do gás no mundo (fundo/parede de trás até a face da frente). */
export function chamberPolygon(c: ChamberDraw, s: Snapshot): string | null {
  const st = s.links[c.link.id];
  const walls = st?.walls;
  if (!walls) return null;
  let front = Infinity;
  let rear = 0;
  c.walls.forEach((w, i) => {
    const travel = walls[i]?.travel ?? 0;
    const pos = w.s0 + w.side * travel;
    if (w.side > 0) front = Math.min(front, pos);
    else rear = pos;
  });
  if (!Number.isFinite(front)) return null;
  const body = c.link.body === null ? null : s.parts[c.link.body];
  const ang = (body?.angle ?? 0) + c.link.dir;
  const u: Vec2 = [dcos(ang), dsin(ang)];
  const n: Vec2 = [-u[1], u[0]];
  const base = worldPoint(s, c.link.body, c.link.at);
  const hw = c.link.bore / 2;
  const at = (t: number, k: number): Vec2 => [base[0] + u[0] * t + n[0] * k, base[1] + u[1] * t + n[1] * k];
  const pts = [at(rear, -hw), at(front, -hw), at(front, hw), at(rear, hw)];
  return pts.map((p) => `${f(p[0])},${f(p[1])}`).join(" ");
}

/** Enquadramento: o do roteiro, ou os contornos das peças com margem. */
export function sceneBounds(
  scene: Scene,
  view?: [number, number, number, number],
): [number, number, number, number] {
  if (view) return view;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of scene.parts) {
    const g = shapeGeometry(p.shape);
    if (!g.ok) continue;
    for (const s of g.value.outline)
      for (const q of s.outer) {
        const w = transform(q, p.x, p.y, p.angle);
        x0 = Math.min(x0, w[0]);
        y0 = Math.min(y0, w[1]);
        x1 = Math.max(x1, w[0]);
        y1 = Math.max(y1, w[1]);
      }
  }
  if (!Number.isFinite(x0)) return [-50, -50, 100, 100];
  const m = Math.max(x1 - x0, y1 - y0) * 0.1 + 5;
  return [x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m];
}
