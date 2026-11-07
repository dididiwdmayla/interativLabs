import type { SfxId } from "@/assets/audio-registry";
import type { LinkKind, Scene } from "@/model/types";

/**
 * Som das ferramentas: ligado ao evento de domínio (o comando registrado na
 * cena), nunca ao clique. Desfazer, refazer, navegação, menus e o arrasto da
 * vista não tocam nada.
 */

/** Cravar parafuso e trava: o carimbo; eixo e pino: o carimbo macio; mola, haste e cabo: ligar. */
export const LINK_SOUND: Partial<Record<LinkKind, SfxId>> = {
  screw: "sfx-stamp",
  lock: "sfx-stamp",
  axle: "sfx-stamp-soft",
  pin: "sfx-stamp-soft",
  spring: "sfx-link",
  rod: "sfx-link",
  cable: "sfx-link",
};

/**
 * Efeito do comando que acabou de mudar a cena: uma ligação nova (e nenhuma
 * peça nova: duplicar não carimba). Trilho, rasgo, suporte, câmara e sensor
 * não estão na tabela do som e ficam em silêncio.
 */
export function commitSound(before: Scene, after: Scene): SfxId | null {
  if (after.parts.length !== before.parts.length) return null;
  if (after.links.length !== before.links.length + 1) return null;
  const known = new Set(before.links.map((l) => l.id));
  const added = after.links.find((l) => !known.has(l.id));
  return added ? (LINK_SOUND[added.kind] ?? null) : null;
}
