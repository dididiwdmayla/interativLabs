import { ratchet } from "./gear";
import type { MassProps } from "./polygon";

/** Catraca a partir da forma de engrenagem do v1 (mesmas proporções do protótipo). */
export function ratchetFromGearShape(module: number, teeth: number, bore: number) {
  const r = (module * teeth) / 2;
  const depth = (Math.PI * module) / 2;
  return ratchet({ teeth, outerRadius: r + 0.4 * depth, depth, bore });
}

/** Soma propriedades de massa de várias formas (eixos paralelos). */
export function combineMass(list: MassProps[]): MassProps {
  let a = 0;
  let sx = 0;
  let sy = 0;
  for (const m of list) {
    a += m.area;
    sx += m.area * m.centroid[0];
    sy += m.area * m.centroid[1];
  }
  if (a <= 0) return { area: 0, centroid: [0, 0], inertia: 0 };
  const cx = sx / a;
  const cy = sy / a;
  let j = 0;
  for (const m of list) {
    const dx = m.centroid[0] - cx;
    const dy = m.centroid[1] - cy;
    j += m.inertia + m.area * (dx * dx + dy * dy);
  }
  return { area: a, centroid: [cx, cy], inertia: j };
}
