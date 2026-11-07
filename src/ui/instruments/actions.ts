import { useUiStore } from "@/editor/useUiStore";
import { quantities, type Quantity } from "@/instruments/model";
export function addProbe(target: string, quantity: Quantity, name: string, other?: string, limit?: number) {
  const ui = useUiStore.getState();
  const id = `${target}:${quantity}:${other ?? ""}`;
  if (ui.probes.some((p) => p.id === id)) return;
  if (ui.probes.length >= 4) {
    ui.notify("Até 4 gráficos. Remova uma sonda no painel Instrumentos.");
    return;
  }
  ui.setProbes([
    ...ui.probes,
    {
      id,
      target,
      quantity,
      name: `${name} · ${quantities[quantity][0]}`,
      ...(other ? { other } : {}),
      ...(limit !== undefined ? { limit } : {}),
    },
  ]);
  ui.notify("Sonda adicionada · veja Instrumentos no Testar");
}
