import { useUiStore } from "@/editor/useUiStore";
import { setLink } from "@/editor/commands";
import { stifferReturnSpring } from "@/instruments/experiment";
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
  const stiffer = stifferReturnSpring(scene);
  if (!stiffer) return;
  state.commit(setLink(scene, stiffer.id, stiffer));
  state.renameVariant("B", "Mola +50%");
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
