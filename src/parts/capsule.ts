import type { Ring } from "@/geometry/polygon";
import type { Capsule, Vec2 } from "@/model/types";

/**
 * Cápsula da gaveta "Ciclo" (Fase 2 · M2a): estojo de latão com aro no fundo,
 * furo aberto na boca e a esfera presa nela. Proporções inventadas, gás
 * didático, projétil esférico (AGENTS.md, regras do domínio). Eixo local +x,
 * do fundo para a boca; a origem é o meio do comprimento.
 *
 *   aro ─┐ ┌─ canaleta (onde a garra do extrator puxa)
 *        ██ ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀  boca
 *        ██   ▐ fundo interno   furo     ( esfera )
 *        ██ ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
 */

export interface CapsuleParams {
  /** comprimento do estojo, mm */
  length: number;
  /** diâmetro do corpo, mm */
  diameter: number;
  /** diâmetro do aro, mm (maior que o corpo) */
  rim: number;
  /** carga: 0 fraca, 1 média, 2 forte */
  charge: number;
}

export const CAPSULE_DEFAULTS: CapsuleParams = { length: 22, diameter: 8, rim: 8.4, charge: 1 };

/** Cargas da cápsula, mmol (as predefinições da câmara: fraca, média, forte). */
export const CAPSULE_CHARGES = [0.05, 0.12, 0.25] as const;
export const CHARGE_LABELS = ["fraca", "média", "forte"] as const;

/** Golpe mínimo na espoleta, mm/s: o ferrolho empurrando a 600 mm/s não acende. */
export const CAPSULE_MIN_STRIKE = 1000;

/** Medidas derivadas: parede, aro, canaleta, fundo, folga e saliência da esfera. */
export const CAPSULE_PROPORTIONS = {
  wall: 0.9,
  rimWidth: 1,
  /** canaleta na frente do aro: largura e profundidade abaixo do corpo */
  grooveWidth: 1.2,
  grooveDepth: 0.8,
  /**
   * rebaixo da face da frente do aro (tangente: 5°): o aro avança um pouco
   * sobre a canaleta, e a garra puxando aperta em vez de escorregar para fora.
   * Medido nas 21 execuções de ciclo/ejetor: de 0 a 0,12 passa; a partir de
   * 0,15 a garra segura demais e o estojo trava nela ao girar no ejetor
   */
  rimUndercut: 0.09,
  baseThickness: 2.5,
  /** folga da esfera no furo, no diâmetro */
  clearance: 0.2,
  /** quanto a esfera sai da boca, mm */
  protrude: 2,
};

export interface CapsuleGeometry {
  outer: Ring;
  capsule: Omit<Capsule, "projectile">;
  /** esfera: centro (local do estojo) e raio */
  ball: { at: Vec2; r: number };
  /** frente do aro no fundo da canaleta (onde a garra do extrator puxa; a face sobe avançando `rimUndercut`) e fim da canaleta: x local */
  rimFront: number;
  grooveEnd: number;
  /** meia altura do corpo, do aro e do fundo da canaleta */
  bodyHalf: number;
  rimHalf: number;
  grooveHalf: number;
}

const r4 = (v: number) => Math.round(v * 1e4) / 1e4 + 0;

export function capsuleGeometry(p: CapsuleParams): CapsuleGeometry {
  const { wall, rimWidth, grooveWidth, grooveDepth, rimUndercut, baseThickness, clearance, protrude } =
    CAPSULE_PROPORTIONS;
  const D = Math.max(4, p.diameter);
  const L = Math.max(D + baseThickness + 2, p.length);
  const rim = Math.max(D, p.rim);
  const bore = D - 2 * wall;
  const x0 = -L / 2;
  const x1 = L / 2;
  const xr = x0 + rimWidth;
  const xg = xr + grooveWidth;
  const xb = Math.max(x0 + baseThickness, xg + 0.3);
  const h = D / 2;
  const hr = rim / 2;
  const hb = bore / 2;
  const hg = h - grooveDepth;
  const u = rimUndercut * (hr - hg);
  const outer: Ring = [
    [x0, -hr],
    [xr + u, -hr],
    [xr, -hg],
    [xg, -hg],
    [xg, -h],
    [x1, -h],
    [x1, -hb],
    [xb, -hb],
    [xb, hb],
    [x1, hb],
    [x1, h],
    [xg, h],
    [xg, hg],
    [xr, hg],
    [xr + u, hr],
    [x0, hr],
  ].map(([x, y]) => [r4(x!), r4(y!)] as Vec2);
  const r = (bore - clearance) / 2;
  const charge = CAPSULE_CHARGES[Math.max(0, Math.min(2, Math.round(p.charge)))]!;
  return {
    outer,
    capsule: {
      charge,
      base: [r4(xb), 0],
      mouth: [r4(x1), 0],
      bore: r4(bore),
      primer: [r4(x0), 0],
      minStrike: CAPSULE_MIN_STRIKE,
    },
    ball: { at: [r4(x1 + protrude - r), 0], r: r4(r) },
    rimFront: r4(xr),
    grooveEnd: r4(xg),
    bodyHalf: r4(h),
    rimHalf: r4(hr),
    grooveHalf: r4(hg),
  };
}
