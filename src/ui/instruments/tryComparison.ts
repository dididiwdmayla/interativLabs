import { useUiStore } from "@/editor/useUiStore";
import { setLink } from "@/editor/commands";
import { elasticPreset } from "@/editor/presetActions";
import { instrumentPreset, launcherInputs } from "@/instruments/presets";
import { compareVariants, useComparison } from "./comparison";
export function tryComparison() {
  const ui = useUiStore.getState();
  if (ui.variants.some((v) => v.id === "B")) {
    ui.notify("A variante B já existe. Use Comparar no seletor de variantes.");
    return;
  }
  const original = ui.activeVariant;
  ui.switchVariant("A");
  if (useUiStore.getState().createVariant() !== "B") return;
  const state = useUiStore.getState();
  const scene = state.current?.scene;
  if (!scene) return;
  const spring = scene.links.find((l) => l.id === "k27" && l.kind === "spring");
  if (!spring) return;
  state.commit(setLink(scene, spring.id, elasticPreset(scene, spring, "hard")));
  state.renameVariant("B", "Mola dura");
  const preset = instrumentPreset(scene);
  // Recoil first so it remains visible in the compact two-chart strip.
  state.setProbes([
    ...preset.filter((p) => p.id === "bolt-position"),
    ...preset.filter((p) => p.id !== "bolt-position"),
  ]);
  compareVariants("A", "B", { inputs: launcherInputs(), steps: 432 });
  const request = useComparison.getState().request;
  if (request) useComparison.setState({ request: { ...request, returnTo: original } });
}
