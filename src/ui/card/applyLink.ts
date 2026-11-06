import { setLink, linksWithReplacement } from "@/editor/commands";
import { useUiStore } from "@/editor/useUiStore";
import { validateScene } from "@/model/scene";
import type { Link } from "@/model/types";

/** Validated card edit; repeated changes on one control merge for 1.5 s. */
export function applyLink(next: Link, control: string): string | null {
  const ui = useUiStore.getState(),
    scene = ui.current?.scene;
  if (!scene) return null;
  const index = scene.links.findIndex((l) => l.id === next.id);
  if (index < 0) return "A ligação não está mais na cena";
  const links = linksWithReplacement(scene, next);
  const result = validateScene({ ...scene, links });
  if (!result.ok)
    return (
      result.issues.find((i) => i.path.startsWith(`links[${index}]`))?.message ??
      result.issues[0]?.message ??
      "Valor inválido"
    );
  ui.commit(setLink(scene, next.id, next), undefined, { merge: `link:${next.id}:${control}` });
  return null;
}
