import { writeFileSync } from "node:fs";
import { signedArea } from "@/geometry/polygon";
import { CORNER_DEG, RDP_PX, SMOOTH_PX, rule, smoothStroke } from "@/geometry/stroke";
import type { Vec2 } from "@/geometry/vec";

/**
 * Números da suavização do Lápis (Parte E2c): traços tremidos sintéticos,
 * com o ruído de um dedo (1 a 2 px em ondas de 10 a 15 px), no zoom 1
 * (0,2 mm por px). Grava docs/decisoes/lapis-e2c.json.
 */
const PX = 0.2;
function noise(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32 - 0.5;
  };
}
/** tremido de dedo: ruído suave (passa-baixa) de amplitude `amp` mm */
function finger(points: Vec2[], amp: number, seed: number): Vec2[] {
  const rnd = noise(seed);
  let ox = 0;
  let oy = 0;
  return points.map(([x, y]) => {
    ox = 0.6 * ox + 0.4 * amp * 2 * rnd();
    oy = 0.6 * oy + 0.4 * amp * 2 * rnd();
    return [x + ox, y + oy];
  });
}
const circle = (r: number, n: number): Vec2[] =>
  Array.from({ length: n }, (_, i) => [
    r * Math.cos((2 * Math.PI * i) / n),
    r * Math.sin((2 * Math.PI * i) / n),
  ]);
function square(side: number, per: number): Vec2[] {
  const c: Vec2[] = [
    [0, 0],
    [side, 0],
    [side, side],
    [0, side],
  ];
  return c.flatMap((a, k) => {
    const b = c[(k + 1) % 4]!;
    return Array.from(
      { length: per },
      (_, i) => [a[0] + ((b[0] - a[0]) * i) / per, a[1] + ((b[1] - a[1]) * i) / per] as Vec2,
    );
  });
}
/** maior desvio (mm) da forma suavizada à forma ideal, pela distância ao contorno ideal */
const worstTurn = (pts: Vec2[], closed: boolean) => {
  let w = 0;
  const n = pts.length;
  for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
    const p = pts[(i + n - 1) % n]!;
    const q = pts[i]!;
    const r = pts[(i + 1) % n]!;
    let t = Math.abs(Math.atan2(r[1] - q[1], r[0] - q[0]) - Math.atan2(q[1] - p[1], q[0] - p[0]));
    t = Math.min(t, 2 * Math.PI - t);
    w = Math.max(w, (t * 180) / Math.PI);
  }
  return w;
};

export function main() {
  const out: Record<string, unknown> = {
    parametros: { rdpPx: RDP_PX, gaussianaSigmaPx: SMOOTH_PX, cantoGraus: CORNER_DEG, mmPorPx: PX },
  };
  const ideal = circle(6, 240);
  const raw = finger(ideal, 0.3, 4);
  const s = smoothStroke(raw, { closed: true, px: PX });
  const a0 = Math.PI * 36;
  out.lacoR6 = {
    pontosNoRastro: raw.length,
    verticesFinais: s.points.length,
    erroDeArea: Math.abs(Math.abs(signedArea(s.points)) - a0) / a0,
    maiorViradaEntreSegmentosGraus: worstTurn(s.points, true),
    maiorViradaNoRastroGraus: worstTurn(raw, true),
  };
  let spurious = 0;
  for (let seed = 1; seed <= 40; seed++)
    for (const r of [4, 6, 10]) {
      const loop = finger(circle(r, 240), 0.3, seed);
      if (smoothStroke(loop, { closed: true, px: PX }).corners.length) spurious++;
    }
  out.cantosFalsos = { lacos: 120, raiosMm: [4, 6, 10], comCantoFalso: spurious };
  const sq = finger(square(20, 60), 0.25, 8);
  const ss = smoothStroke(sq, { closed: true, px: PX });
  const ruled = rule(ss, { closed: true, px: PX });
  out.quadrado20 = {
    cantosDetectados: ss.corners.length,
    reguaVertices: ruled.kind === "poly" ? ruled.points.length : ruled.kind,
    erroDeAreaComRegua:
      ruled.kind === "poly" ? Math.abs(Math.abs(signedArea(ruled.points)) - 400) / 400 : null,
  };
  const rnd = noise(5);
  const line: Vec2[] = Array.from({ length: 61 }, (_, i) => [i * 0.5, 2 * rnd()]);
  const ls = smoothStroke(line, { closed: false, px: PX });
  out.retaTremidaMais1mm = { regua: rule(ls, { closed: false, px: PX }).kind };
  writeFileSync("docs/decisoes/lapis-e2c.json", JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify(out, null, 2));
}
