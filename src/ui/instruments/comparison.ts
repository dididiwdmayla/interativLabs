import { instrumentPreset } from "@/instruments/presets";
import { create } from "zustand";
import { useUiStore } from "@/editor/useUiStore";
import type { Variant } from "@/editor/projects";
import type { SimInput } from "@/sim/session";
import type { Series } from "@/instruments/sampling";
import type { EventTick } from "@/instruments/events";
export interface Run {
  inputs: SimInput[];
  steps: number;
}
export interface Comparison {
  a: Variant;
  b: Variant;
  run: Run;
  returnTo: string;
}
export const runs = new Map<string, Run>();
export const runKey = () => {
  const s = useUiStore.getState();
  return `${s.current?.id}:${s.activeVariant}`;
};
export const useComparison = create<{
  request: Comparison | null;
  series: Series[];
  ticks: EventTick[];
  ghost: boolean;
  ready: boolean;
}>(() => ({ request: null, series: [], ticks: [], ghost: true, ready: false }));
export function compareVariants(aId: string, bId: string, run?: Run) {
  const ui = useUiStore.getState();
  const variants = ui.variantSnapshot();
  const a = variants.find((v) => v.id === aId),
    b = variants.find((v) => v.id === bId);
  const recorded = run ?? runs.get(`${ui.current?.id}:${aId}`);
  if (!a || !b || aId === bId || !recorded) {
    ui.notify("Execute a primeira variante antes de comparar.");
    return;
  }
  if (!ui.probes.length) ui.setProbes(instrumentPreset(a.scene));
  ui.switchVariant(aId);
  useComparison.setState({
    request: { a, b, run: recorded, returnTo: ui.activeVariant },
    series: [],
    ticks: [],
    ghost: true,
    ready: false,
  });
  // Let the previous worker unmount before creating the comparison controller.
  window.setTimeout(() => useUiStore.getState().setMode("simulate"), 0);
}
export function exitComparison() {
  const request = useComparison.getState().request;
  useComparison.setState({ request: null, series: [], ticks: [], ready: false });
  if (request) useUiStore.getState().switchVariant(request.returnTo);
}

useUiStore.subscribe((s, prev) => {
  if (s.current?.id !== prev.current?.id || (prev.mode === "simulate" && s.mode === "edit")) {
    useComparison.setState({ request: null, series: [], ticks: [], ready: false });
  }
});
