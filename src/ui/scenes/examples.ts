import { useUiStore } from "@/editor/useUiStore";
import { loadScene } from "@/model/scene";
import type { Scene } from "@/model/types";
import index from "../../../scenes/examples/index.json";

/**
 * Exemplos do menu (scenes/examples/index.json): ordem, cena padrão e uma
 * linha de descrição. Sem descrição no índice, vale a primeira frase das
 * notas da cena de teste do exemplo. As cenas carregam sob demanda.
 */

interface ExampleIndex {
  default: string;
  order: string[];
  descriptions?: Record<string, string>;
}

const INDEX = index as ExampleIndex;

const files = import.meta.glob<unknown>(["../../../scenes/examples/*.json", "!**/index.json"], {
  import: "default",
});
const titles = import.meta.glob<string>("../../../scenes/fixtures/exemplos/*.test.json", {
  eager: true,
  import: "title",
});
const notes = import.meta.glob<string>("../../../scenes/fixtures/exemplos/*.test.json", {
  eager: true,
  import: "notes",
});

export interface ExampleEntry {
  id: string;
  title: string;
  description: string;
  figure: number;
}

const firstSentence = (s: string | undefined) => (s ? (s.match(/^[^.]*\./)?.[0] ?? s) : "");
const fixtureKey = (id: string) => `../../../scenes/fixtures/exemplos/${id}.test.json`;

export const DEFAULT_EXAMPLE = INDEX.default;

export const EXAMPLES: ExampleEntry[] = INDEX.order
  .filter((id) => files[`../../../scenes/examples/${id}.json`])
  .map((id, i) => ({
    id,
    title: titles[fixtureKey(id)] ?? id,
    description: INDEX.descriptions?.[id] ?? firstSentence(notes[fixtureKey(id)]),
    figure: i + 1,
  }));

export async function loadExample(id: string): Promise<Scene> {
  const loader = files[`../../../scenes/examples/${id}.json`];
  if (!loader) throw new Error(`Exemplo ${id} não encontrado`);
  const r = loadScene(await loader());
  if (!r.ok) throw new Error(`Exemplo ${id} inválido: ${r.issues.map((x) => x.message).join("; ")}`);
  return r.scene;
}

/** Abre um exemplo no palco, enquadrado e no modo Editar. */
export async function openExample(id: string): Promise<void> {
  const e = EXAMPLES.find((x) => x.id === id);
  const scene = await loadExample(id);
  useUiStore.getState().openScene(id, scene, e?.figure ?? 1);
}
