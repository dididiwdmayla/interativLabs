/**
 * Sistema de unidades da cena v1.
 *
 * Base: milímetro (mm), grama (g), segundo (s), radiano (rad).
 * Eixo y para baixo (o mesmo do SVG); ângulo positivo = sentido horário na tela.
 *
 * Derivadas:
 *   velocidade        mm/s
 *   aceleração        mm/s²
 *   força             g·mm/s²          (= 1 µN)
 *   rigidez linear    g/s²             (força por mm)
 *   amortecimento lin g/s              (força por mm/s)
 *   torque            g·mm²/s²         (= 1 nN·m)
 *   rigidez de torção g·mm²/s² por rad
 *   carga da câmara   g·mm²/s²         (força × distância: F = carga / s)
 *
 * Massa = densidade do material × área × espessura nominal de 10 mm
 * (src/model/materials.ts). Com essa espessura, as massas do protótipo
 * (densidade × área em unidades de 10 mm) já saem em gramas.
 *
 * O protótipo v0 trabalhava em px, com 50 px por unidade do motor.
 * Escala de conversão (docs/fases/fase-1.md, item 2): 1 px = 0,2 mm.
 * Logo uma unidade do motor do protótipo = 10 mm, e a massa é a mesma.
 */

/** mm por px do protótipo. */
export const MM_PER_PX = 0.2;

/** px do protótipo por unidade do motor Planck no protótipo. */
export const V0_PX_PER_UNIT = 50;

/** mm por unidade de comprimento do motor do protótipo (= 10 mm). */
export const V0_MM_PER_UNIT = V0_PX_PER_UNIT * MM_PER_PX;

/** Espessura nominal das peças, em mm, usada para massa a partir da densidade. */
export const NOMINAL_THICKNESS_MM = 10;

export const DEG = Math.PI / 180;

export function degToRad(d: number): number {
  return d * DEG;
}

export function radToDeg(r: number): number {
  return r / DEG;
}

export function rpmToRadPerSec(rpm: number): number {
  return (rpm * 2 * Math.PI) / 60;
}

export function radPerSecToRpm(w: number): number {
  return (w * 60) / (2 * Math.PI);
}
