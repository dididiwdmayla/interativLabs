/**
 * Vetores 2D em mm. Mesmo formato de ponto da cena ([x, y]).
 *
 * Orientação: "anti-horário" (CCW) aqui é o sentido de área com sinal
 * positiva pela fórmula do laço (x_i·y_{i+1} − x_{i+1}·y_i). Na tela, com o
 * eixo y para baixo, esse sentido aparece horário; a convenção matemática é a
 * mesma dos motores de física e do Clipper.
 */
export type Vec2 = [number, number];

export const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const scale = (a: Vec2, k: number): Vec2 => [a[0] * k, a[1] * k];
export const dot = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1];
export const cross = (a: Vec2, b: Vec2): number => a[0] * b[1] - a[1] * b[0];
export const len = (a: Vec2): number => Math.hypot(a[0], a[1]);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
export const polar = (r: number, a: number): Vec2 => [r * Math.cos(a), r * Math.sin(a)];

/** Produto vetorial de (b − a) × (c − a): > 0 quando a→b→c vira à esquerda (CCW). */
export function orient(a: Vec2, b: Vec2, c: Vec2): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

export function rotate(p: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

/** Aplica a pose (x, y, ângulo) a um ponto local. */
export function transform(p: Vec2, x: number, y: number, angle: number): Vec2 {
  const r = rotate(p, angle);
  return [r[0] + x, r[1] + y];
}

/** Distância de p ao segmento ab. */
export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Distância mínima entre os segmentos ab e cd (0 se cruzam). */
export function segmentDistance(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 * o2 < 0 && o3 * o4 < 0) return 0;
  return Math.min(
    distToSegment(a, c, d),
    distToSegment(b, c, d),
    distToSegment(c, a, b),
    distToSegment(d, a, b),
  );
}
