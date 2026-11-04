/**
 * Sistema de unidades da cena.
 *
 * Cena v2 (atual), na cena e na interface: mm, g, s, N, N/mm, N·mm, kPa, °
 * (a cena guarda radianos). Eixo y para baixo (o mesmo do SVG); ângulo
 * positivo = sentido horário na tela.
 *
 *   força             N
 *   rigidez linear    N/mm
 *   amortecimento lin N·s/mm
 *   torque            N·mm
 *   rigidez de torção N·mm/rad
 *   amortecimento tor N·mm·s/rad
 *   pressão           kPa
 *   gás               mmol
 *   densidade         g/mm³ (src/model/materials.ts)
 *   massa             g = densidade × área × espessura da camada
 *
 * Dentro do motor (src/engine) tudo fica na base mm, g, s: força em
 * g·mm/s² (= 1 µN). O plano de compilação converte com `N` abaixo.
 *
 * Cena v1 (só leitura, migrada ao abrir): forças já em g·mm/s², rigidez em
 * g/s², torque em g·mm²/s², massa com espessura nominal de 10 mm e densidade
 * em g/cm³.
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

/** Espessura das camadas migradas da v1 (a espessura nominal do protótipo), mm. */
export const V1_THICKNESS_MM = 10;

/** Espessura padrão de uma camada nova, mm. */
export const DEFAULT_THICKNESS_MM = 3;

/** 1 N em g·mm/s² (a unidade de força dentro do motor). */
export const N = 1e6;

/** Gravidade real, mm/s² (padrão de cena nova). */
export const G_REAL = 9810;

/** Pressão atmosférica, kPa (p0 padrão de câmara nova). */
export const P_ATM = 101.325;

/** Temperatura do gás, K (20 °C). */
export const GAS_T = 293.15;

/** R·T em kPa·mm³ por mmol: P[kPa] = n[mmol] × RT / V[mm³]. */
export const GAS_RT = 8.314462618 * GAS_T * 1000;

/** 1 kPa × 1 mm² em g·mm/s² (= 1 mN). */
export const KPA_MM2 = 1e3;

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
