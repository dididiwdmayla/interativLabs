import type { MaterialId } from "@/model/materials";

/**
 * Hachuras por material (identidade, "Hachuras por material"). Os padrões
 * são desenhados em px do degrau base (1 unidade = 1 px de tela no zoom 1 =
 * 0,2 mm) e escalados por `patternTransform` pelo degrau 2ᵏ do zoom.
 * Linhas verticais no espaço do padrão; o ângulo de 45° ou 135° vem do
 * transform. Borracha e pautado do corpo ficam paralelos ao eixo x da peça.
 */

export type HatchId = MaterialId | "body";

export interface HatchDef {
  /** tamanho do ladrilho, px base */
  w: number;
  h: number;
  /** gira 45°/135° (falso: paralelo ao eixo x da peça) */
  angled: boolean;
  /** cobertura média do traço, para o tom liso das peças pequenas */
  coverage: number;
  /** linhas: [x1, y1, x2, y2, largura, tracejado?] ou caminho */
  lines: { d: string; w: number; dash?: string }[];
}

export const HATCHES: Record<Exclude<HatchId, "wood">, HatchDef> = {
  // pares de linhas: as duas a 1,5 de distância, um par a cada 6
  steel: {
    w: 6,
    h: 6,
    angled: true,
    coverage: 0.2,
    lines: [
      { d: "M1.5 -1V7", w: 0.6 },
      { d: "M3 -1V7", w: 0.6 },
    ],
  },
  // linha simples a cada 7
  aluminum: { w: 7, h: 7, angled: true, coverage: 0.07, lines: [{ d: "M1 -1V8", w: 0.5 }] },
  // cheia alternada com tracejada (4 com vão de 2), a cada 3,5
  brass: {
    w: 7,
    h: 6,
    angled: true,
    coverage: 0.15,
    lines: [
      { d: "M1 -1V7", w: 0.6 },
      { d: "M4.5 0V6", w: 0.6, dash: "4 2" },
    ],
  },
  // cruzada aberta a cada 8 (losangos depois do giro de 45°)
  polymer: {
    w: 8,
    h: 8,
    angled: true,
    coverage: 0.12,
    lines: [
      { d: "M0.5 -1V9", w: 0.5 },
      { d: "M-1 0.5H9", w: 0.5 },
    ],
  },
  // ondulada paralela ao eixo x: uma a cada 4, amplitude 1, período 8
  rubber: {
    w: 8,
    h: 4,
    angled: false,
    coverage: 0.19,
    lines: [{ d: "M-2 2C-1 0.6 1 0.6 2 2S5 3.4 6 2S9 0.6 10 2", w: 0.75 }],
  },
  // pautado do corpo fixo: traço 0,5 a cada 6
  body: { w: 12, h: 6, angled: false, coverage: 0.08, lines: [{ d: "M-1 3H13", w: 0.5 }] },
};

/** Cobertura do tom liso por material (madeira: medida aproximada do ladrilho). */
export function hatchCoverage(id: HatchId): number {
  return id === "wood" ? 0.15 : HATCHES[id].coverage;
}

/** Ladrilho da madeira no degrau base, px de tela (manifesto, leva 2). */
export const WOOD_TILE_PX = 256;

/** Escala do conteúdo do padrão: mm por px base vezes o degrau 2ᵏ. */
export const hatchScale = (step: number) => 0.2 * 2 ** step;

export function patternTransform(step: number, angle: 0 | 45 | 135): string {
  const k = hatchScale(step);
  return angle ? `rotate(${angle}) scale(${k})` : `scale(${k})`;
}
