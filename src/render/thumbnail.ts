import { HATCHES } from "./hatch";
import type { SceneModel } from "./prepare";
import type { Box } from "./view";

/**
 * Miniatura gravada de uma cena (lista de projetos, gaveta de peças): as
 * peças com face, hachura do material e contorno, camada por camada, e um
 * ponto em cada ligação. Sai como texto SVG com classes (as cores vêm dos
 * tokens no CSS do app, `.thumb …`), para guardar no IndexedDB e mostrar
 * sem recalcular. Sem DOM.
 */

const f = (n: number) => (Math.round(n * 100) / 100).toString();

export interface ThumbOptions {
  /** tamanho em px */
  width: number;
  height: number;
  /** margem em px */
  pad?: number;
  /** caixa a enquadrar (padrão: a cena inteira) */
  box?: Box;
  /** prefixo dos ids dos padrões (único na página) */
  uid?: string;
}

export function thumbnailSvg(model: SceneModel, o: ThumbOptions): string {
  const pad = o.pad ?? 6;
  const box = o.box ?? model.bounds;
  const k = Math.min((o.width - 2 * pad) / box[2], (o.height - 2 * pad) / box[3]);
  const tx = pad + (o.width - 2 * pad - box[2] * k) / 2 - box[0] * k;
  const ty = pad + (o.height - 2 * pad - box[3] * k) / 2 - box[1] * k;
  const uid = o.uid ?? "t";
  // hachura: o passo em px da miniatura fica perto do de base (o padrão é em px base)
  const hs = 1 / k;
  const used = new Set(model.partList.map((m) => `${m.hatch === "wood" ? "polymer" : m.hatch}-${m.angle}`));
  let defs = "";
  for (const key of used) {
    const [id, angle] = key.split("-") as [keyof typeof HATCHES, string];
    const h = HATCHES[id];
    const rot = h.angled && angle !== "0" ? `rotate(${angle}) ` : "";
    defs += `<pattern id="${uid}${key}" patternUnits="userSpaceOnUse" width="${h.w}" height="${h.h}" patternTransform="${rot}scale(${f(hs)})">`;
    for (const l of h.lines)
      defs += `<path d="${l.d}" class="thumb__hatch" stroke-width="${l.w}"${l.dash ? ` stroke-dasharray="${l.dash}"` : ""}/>`;
    defs += "</pattern>";
  }
  let body = "";
  for (const L of model.layers) {
    if (L.layer.visible === false) continue;
    for (const m of L.parts) {
      const t = `translate(${f(m.part.x)} ${f(m.part.y)}) rotate(${f((m.part.angle * 180) / Math.PI)})`;
      const fill = `url(#${uid}${m.hatch === "wood" ? "polymer" : m.hatch}-${m.angle})`;
      body += `<g transform="${t}"><path class="thumb__face" d="${m.d}"/><path d="${m.d}" fill="${fill}" fill-rule="evenodd"/><path class="thumb__line" d="${m.d}"/></g>`;
    }
  }
  for (const lm of model.links) {
    if (lm.link.kind === "slot") continue;
    const p = lm.world;
    body += `<circle class="thumb__link" cx="${f(p[0])}" cy="${f(p[1])}" r="${f(1.6 / k)}"/>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="thumb" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}">` +
    `<defs>${defs}</defs><g transform="matrix(${f(k)} 0 0 ${f(k)} ${f(tx)} ${f(ty)})">${body}</g></svg>`
  );
}
