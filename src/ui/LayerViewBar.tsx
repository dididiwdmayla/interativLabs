import { useState } from "react";
import { useUiStore } from "@/editor/useUiStore";
import { ToolStrip } from "./ToolStrip";

export function LayerViewBar() {
  const ui = useUiStore();
  const [distanceOpen, setDistanceOpen] = useState(false);
  if (!ui.layerColors || ui.hammer || ui.pencil) return null;
  return (
    <ToolStrip
      label="Vista das camadas"
      mode="cycle"
      phrase="Camadas em cores · folhas da mesma bancada"
      groups={[
        {
          name: "Cores",
          items: [
            {
              id: "colors",
              label: "Cores",
              icon: "layers",
              pressed: true,
              onClick: () => ui.setLayerView({ layerColors: false }),
            },
          ],
        },
        {
          name: "Afastar",
          items: [
            {
              id: "spread",
              label: "Afastar",
              icon: "fit",
              pressed: ui.layerSpread > 0,
              onClick: () => ui.setLayerView({ layerSpread: ui.layerSpread ? 0 : 12 }),
            },
          ],
        },
        ...(ui.layerSpread > 0
          ? [
              {
                name: "Distância",
                items: [
                  {
                    id: "distance",
                    label: `${ui.layerSpread} mm`,
                    glyph: `${ui.layerSpread}`,
                    pressed: distanceOpen,
                    onClick: () => setDistanceOpen((open) => !open),
                  },
                ],
              },
            ]
          : []),
        {
          name: "Isolar",
          items: [
            {
              id: "isolate",
              label: "Isolar",
              icon: "eye",
              pressed: ui.layerIsolate,
              onClick: () => ui.setLayerView({ layerIsolate: !ui.layerIsolate }),
            },
          ],
        },
      ]}
      popover={
        ui.layerSpread > 0 && distanceOpen ? (
          <label className="pencildetails">
            Distância{" "}
            <input
              aria-label="Distância entre camadas"
              type="range"
              min="4"
              max="32"
              step="2"
              value={ui.layerSpread}
              onChange={(e) => ui.setLayerView({ layerSpread: Number(e.target.value) })}
            />
            <output>{ui.layerSpread} mm</output>
          </label>
        ) : undefined
      }
    />
  );
}
