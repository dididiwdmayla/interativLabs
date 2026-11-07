import { useUiStore } from "@/editor/useUiStore";
import { ToolStrip } from "./ToolStrip";

export function LayerViewBar() {
  const ui = useUiStore();
  if (!ui.layerColors || ui.hammer || ui.pencil) return null;
  return <ToolStrip label="Vista das camadas" mode="cycle" phrase="Camadas em cores · folhas da mesma bancada" groups={[
    { name: "Cores", items: [{ id: "colors", label: "Cores", pressed: true, onClick: () => ui.setLayerView({ layerColors: false }) }] },
    { name: "Afastar", items: [{ id: "spread", label: "Afastar", pressed: ui.layerSpread > 0, onClick: () => ui.setLayerView({ layerSpread: ui.layerSpread ? 0 : 12 }) }] },
    { name: "Isolar", items: [{ id: "isolate", label: "Isolar", pressed: ui.layerIsolate, onClick: () => ui.setLayerView({ layerIsolate: !ui.layerIsolate }) }] },
  ]} popover={ui.layerSpread > 0 ? <label className="pencildetails">Distância <input aria-label="Distância entre camadas" type="range" min="4" max="32" step="2" value={ui.layerSpread} onChange={(e) => ui.setLayerView({ layerSpread: Number(e.target.value) })} /><output>{ui.layerSpread} mm</output></label> : undefined} />;
}
