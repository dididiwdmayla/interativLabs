import { addLayer, insertPart, type Command } from "@/editor/commands";
import { run } from "@/editor/history";
import type { Scene } from "@/model/types";
import { buildPart, generator, type BuildOptions } from ".";

/** Compound presets create their missing upper layer in the same undo step. */
export function buildInsertion(
  scene: Scene,
  id: string,
  options: BuildOptions,
): { command: Command; id: string } | null {
  let working = scene;
  const g = generator(id),
    index = scene.layers.findIndex((l) => l.id === options.layer);
  const extra =
    g?.compound && !scene.layers[index + 1]
      ? addLayer(scene, { above: index, random: options.random })
      : null;
  if (g?.compound && !scene.layers[index + 1] && !extra) return null;
  if (extra) working = run(scene, extra.command.label, extra.command.recipe)!.scene;
  const part = buildPart(working, id, options),
    insert = insertPart(working, part);
  return {
    id: part.id,
    command: {
      label: insert.label,
      recipe: (d) => {
        extra?.command.recipe(d);
        insert.recipe(d);
      },
    },
  };
}
