import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from "immer";
import type { Scene } from "@/model/types";

/**
 * Pilha de comandos do editor (docs/arquitetura.md §6, "Comandos"): toda
 * edição da cena é uma receita do Immer aplicada por `produceWithPatches`;
 * a entrada guarda os patches de ida e de volta e um nome legível
 * ("Mover Barra 3"). Desfazer aplica os inversos; refazer, os de ida.
 * Sem DOM e sem React: roda no Node (testes).
 */

enablePatches();

export const HISTORY_LIMIT = 200;

export interface Entry {
  /** nome legível, com maiúscula ("Mover Barra 3") */
  label: string;
  patches: Patch[];
  inverse: Patch[];
}

export interface HistoryState {
  past: Entry[];
  future: Entry[];
}

export type Recipe = (draft: Draft<Scene>) => void;

export const emptyHistory = (): HistoryState => ({ past: [], future: [] });

/**
 * Aplica a receita. Devolve a cena nova e a entrada, ou null quando a
 * receita não mudou nada (nada entra na pilha).
 */
export function run(scene: Scene, label: string, recipe: Recipe): { scene: Scene; entry: Entry } | null {
  const [next, patches, inverse] = produceWithPatches(scene, recipe);
  if (patches.length === 0) return null;
  return { scene: next, entry: { label, patches, inverse } };
}

/** Empilha a entrada (limpa o refazer; corta o mais antigo acima do limite). */
export function push(h: HistoryState, entry: Entry, limit = HISTORY_LIMIT): HistoryState {
  const past = [...h.past, entry];
  if (past.length > limit) past.splice(0, past.length - limit);
  return { past, future: [] };
}

export function undo(
  scene: Scene,
  h: HistoryState,
): { scene: Scene; history: HistoryState; entry: Entry } | null {
  const entry = h.past[h.past.length - 1];
  if (!entry) return null;
  return {
    scene: applyPatches(scene, entry.inverse),
    history: { past: h.past.slice(0, -1), future: [entry, ...h.future] },
    entry,
  };
}

export function redo(
  scene: Scene,
  h: HistoryState,
): { scene: Scene; history: HistoryState; entry: Entry } | null {
  const entry = h.future[0];
  if (!entry) return null;
  return {
    scene: applyPatches(scene, entry.patches),
    history: { past: [...h.past, entry], future: h.future.slice(1) },
    entry,
  };
}

/** "Mover Barra 3" → "mover Barra 3" (para "Desfeito: …"). */
export function lowerFirst(label: string): string {
  return label ? label.charAt(0).toLocaleLowerCase("pt-BR") + label.slice(1) : label;
}
