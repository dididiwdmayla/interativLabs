import { offsetShapes } from "@/geometry/clip";
import type { PolyWithHoles } from "@/geometry/polygon";
import { outlinePath, type PartModel } from "./prepare";
import { mmPerPx, PX_PER_MM } from "./view";

/**
 * Pele da peça (identidade, "Hierarquia de traço" e "Peças"): o chanfro
 * iluminado em dois tons e a faixa do corpo fixo, como offsets da forma em
 * px de tela, calculados com Clipper2 na montagem e no fim de cada gesto de
 * zoom (nunca por quadro). Furos e rasgos recebem o mesmo tratamento por
 * dentro, porque o offset de uma forma com furos faz os furos crescerem.
 */

/** px de tela a partir do contorno */
export const BEVEL = {
  /** borda interna do contorno (1,5 px centrado) + fio escuro de 0,75 */
  dark: 1.5,
  /** + faixa clara de 1,25 (ink a 0,7) */
  light: 2.75,
  /** + faixa apagada de 1,25 (ink a 0,35); a hachura começa aqui */
  faint: 4,
  /** corpo fixo: faixa de 8 px de hachura do material ao longo da borda interna */
  body: 12,
};

/** Abaixo disto (px de tela), some chanfro e parede e a hachura vira tom. */
export const TINY_PX = 24;

export interface PartSkin {
  /** peça pequena na tela: sem chanfro nem parede, hachura em tom liso */
  tiny: boolean;
  /** faixa clara (evenodd) */
  light: string;
  /** faixa apagada (evenodd) */
  faint: string;
  /** área da hachura (contorno interno do chanfro) */
  inner: string;
  /** corpo fixo: miolo com pautado (a hachura do material fica na faixa) */
  core: string;
}

const join = (a: PolyWithHoles[], b: PolyWithHoles[]) => outlinePath(a) + outlinePath(b);

/** Chanfro e faixas de uma peça para o zoom dado. */
export function partSkin(m: PartModel, zoom: number): PartSkin {
  const px = mmPerPx(zoom);
  const tiny = m.size * PX_PER_MM * zoom < TINY_PX;
  if (tiny) return { tiny, light: "", faint: "", inner: m.d, core: "" };
  const o1 = offsetShapes(m.outline, -BEVEL.dark * px);
  const o2 = offsetShapes(m.outline, -BEVEL.light * px);
  const o3 = offsetShapes(m.outline, -BEVEL.faint * px);
  const core = m.body ? offsetShapes(m.outline, -BEVEL.body * px) : [];
  return {
    tiny,
    light: join(o1, o2),
    faint: join(o2, o3),
    inner: outlinePath(o3),
    core: outlinePath(core),
  };
}

/** Cache por peça e zoom (a cena e o zoom mudam pouco; o desenho pede muito). */
export class SkinCache {
  private map = new Map<string, PartSkin>();
  get(m: PartModel, zoom: number): PartSkin {
    const key = `${m.part.id}@${zoom.toFixed(4)}`;
    let s = this.map.get(key);
    if (!s) {
      s = partSkin(m, zoom);
      if (this.map.size > 4000) this.map.clear();
      this.map.set(key, s);
    }
    return s;
  }
}
