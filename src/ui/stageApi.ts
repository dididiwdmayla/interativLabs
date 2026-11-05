import type { PartPose } from "@/engine/types";
import type { Vec2 } from "@/geometry/vec";
import type { Shape } from "@/model/types";
import type { View } from "@/render/view";

/**
 * Ponte entre o palco e o resto da interface (gaveta, menus, cartão): o
 * palco registra aqui a vista atual e as ações dele. Nada disso é estado
 * da cena; é só a câmera.
 */
export interface StageApi {
  view(): View;
  /** px do cliente → mm do mundo */
  clientToWorld(x: number, y: number): Vec2;
  /** mm do mundo → px do cliente */
  worldToClient(p: Vec2): Vec2;
  /** o ponto do cliente está sobre o palco */
  overStage(x: number, y: number): boolean;
  /** centro da vista, mm */
  center(): Vec2;
  fit(): void;
  /** move a vista (px), com animação curta */
  panBy(dx: number, dy: number): void;
  /**
   * Fantasma da peça que vem da gaveta, com o encaixe ativo, no ponto do
   * cliente. Devolve a pose encaixada (mundo) ou null fora do palco;
   * shape null apaga o fantasma.
   */
  insertPreview(shape: Shape | null, clientX?: number, clientY?: number): PartPose | null;
}

let current: StageApi | null = null;

export const stageApi = {
  set(api: StageApi | null) {
    current = api;
  },
  get(): StageApi | null {
    return current;
  },
};
