import type { StageNodes } from "./nodes";
import type { SceneModel } from "./prepare";

/** Ferragens do lote 01 e o contexto de desenho das ligações. */

export interface ArtContext {
  uid: string;
  /** mm por px de tela no zoom atual */
  px: number;
  selected: string | null;
  /** camada ativa (no Editar): o que a atravessa fica forte mesmo velado */
  active: number;
  nodes: StageNodes;
  model: SceneModel;
}

export type HwId = "hw-screw-slot" | "hw-screw-hex" | "hw-axle" | "hw-pin" | "hw-sensor";

/** Ø de referência de cada ferragem do lote 01, mm */
export const HW_REF: Record<HwId, number> = {
  "hw-screw-slot": 6,
  "hw-screw-hex": 6,
  "hw-axle": 8,
  "hw-pin": 4,
  "hw-sensor": 6,
};

export const HW_IDS = Object.keys(HW_REF) as HwId[];
/** abaixo disto, a ferragem vira símbolo */
export const HW_MIN_PX = 10;

export const assetRef = (ctx: ArtContext, id: string, gold: boolean) =>
  `#${ctx.uid}a-${id}${gold ? "-gold" : ""}`;
