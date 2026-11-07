import { useEffect } from "react";
import { SPREAD_MAX, SPREAD_MIN, useUiStore } from "@/editor/useUiStore";
import type { SceneModel } from "@/render/prepare";
import { ToolStrip } from "./ToolStrip";

/**
 * Faixa de "Camadas em cores" (Parte E2d): Cores, Afastar (com o
 * deslizante da distância) e Isolar, na mesma faixa do Martelo e do Lápis.
 * Vale no Montar e no Testar; nada aqui muda a cena.
 */
export function LayersBar({ model }: { model: SceneModel }) {
  const look = useUiStore((s) => s.look);
  const active = useUiStore((s) => s.activeLayer);
  const set = useUiStore((s) => s.setLook);
  const mode = useUiStore((s) => s.mode);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") useUiStore.getState().setLook({ open: false });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  if (!look.open) return null;
  const n = model.layers.length;
  const L = model.layers[active]?.layer;
  const parts: string[] = [];
  if (look.isolate && L) parts.push(`Só a camada ${active + 1}, ${L.name}, e as ligações dela`);
  else if (look.colors) parts.push(n === 1 ? "Uma camada" : `${n} camadas, do fundo (1) ao topo (${n})`);
  else parts.push("Cores desligadas");
  if (look.spread) parts.push("afastadas");
  return (
    <ToolStrip
      label="Camadas em cores"
      edge={mode === "simulate" ? "top" : "bottom"}
      mode="cycle"
      phrase={parts.join(" · ")}
      popover={
        look.spread ? (
          <label className="pencildetails">
            <span>Distância</span>
            <input
              type="range"
              min={SPREAD_MIN}
              max={SPREAD_MAX}
              step={2}
              value={look.distance}
              onChange={(e) => set({ distance: Number(e.target.value) })}
            />
            <output>{look.distance}</output>
          </label>
        ) : undefined
      }
      groups={[
        {
          name: "Cores",
          items: [
            {
              id: "colors",
              label: "Cores",
              icon: "layerColors",
              pressed: look.colors,
              onClick: () => set({ colors: !look.colors }),
            },
          ],
        },
        {
          name: "Afastar",
          items: [
            {
              id: "spread",
              label: "Afastar",
              icon: "spread",
              pressed: look.spread,
              onClick: () => set({ spread: !look.spread }),
            },
          ],
        },
        {
          name: "Isolar",
          items: [
            {
              id: "isolate",
              label: "Isolar",
              icon: "isolate",
              pressed: look.isolate,
              onClick: () => set({ isolate: !look.isolate }),
            },
          ],
        },
        {
          name: "Fechar",
          items: [
            {
              id: "close",
              label: "Fechar",
              icon: "close",
              hint: "Fechar as camadas em cores",
              onClick: () => set({ open: false }),
            },
          ],
        },
      ]}
    />
  );
}
