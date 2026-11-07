import { addLayer, deleteLink, deleteParts, duplicatePart } from "@/editor/commands";
import { useUiStore } from "@/editor/useUiStore";
import {
  fitAction,
  fullscreenAction,
  hideModeAction,
  layersAction,
  leftyAction,
  tipsAction,
  trailAction,
  xrayAction,
} from "./actions";

/** Novo nome de camada que não repete os existentes. */
function freshLayerName(names: string[]): string {
  for (let i = names.length + 1; ; i++) {
    const n = `Camada ${i}`;
    if (!names.includes(n)) return n;
  }
}

/** Nova camada logo acima da ativa, que passa a ser a ativa. */
export function newLayerAction(): void {
  const ui = useUiStore.getState();
  const scene = ui.current?.scene;
  if (!scene) return;
  const r = addLayer(scene, { above: ui.activeLayer, name: freshLayerName(scene.layers.map((l) => l.name)) });
  if (!r) {
    ui.notify("No máximo 16 camadas", { warn: true });
    return;
  }
  if (ui.commit(r.command, { activeLayer: ui.activeLayer + 1 }))
    ui.notify(`Nova camada ${ui.activeLayer + 2} acima da ativa`);
}

export function duplicateSelectionAction(): void {
  const ui = useUiStore.getState();
  const scene = ui.current?.scene;
  const sel = ui.selection;
  if (!scene || sel?.kind !== "part") {
    if (sel?.kind === "link") ui.notify("Duplicar vale para peças");
    return;
  }
  const r = duplicatePart(scene, sel.id);
  if (r) ui.commit(r.command, { selection: { kind: "part", id: r.newId } });
}

export function deleteSelectionAction(): void {
  const ui = useUiStore.getState();
  const scene = ui.current?.scene;
  const sel = ui.selection;
  if (!scene || !sel) return;
  ui.commit(sel.kind === "part" ? deleteParts(scene, [sel.id]) : deleteLink(scene, sel.id), {
    selection: null,
  });
}

export function partsAction(): void {
  useUiStore.getState().setSheet("drawer");
}

const ACTIONS: Record<string, () => void> = {
  parts: partsAction,
  hammer: () => useUiStore.getState().setHammer("axle"),
  pencil: () => useUiStore.getState().setPencil(true),
  "layer-new": newLayerAction,
  duplicate: duplicateSelectionAction,
  delete: deleteSelectionAction,
  fit: fitAction,
  xray: xrayAction,
  fullscreen: () => void fullscreenAction(),
  layers: layersAction,
  hide: hideModeAction,
  trail: trailAction,
  tips: tipsAction,
  lefty: leftyAction,
};

/** Executa o item de menu e fecha o menu. */
export function runMenuItem(id: string): void {
  useUiStore.getState().setEdgeMenu(null);
  ACTIONS[id]?.();
}
