import { useEffect, useState } from "react";
import { PENCIL_WIDTHS } from "@/editor/pencil";
import { useUiStore } from "@/editor/useUiStore";
import { ToolStrip, type StripItem } from "./ToolStrip";

const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/**
 * Faixa do Lápis (docs/arquitetura.md §6): Contorno ou Traço, Somar ou
 * Tirar, a largura do traço (1, 2, 3 e 5 mm, e um deslizante nos detalhes)
 * e a Régua. Mesmo componente da faixa do Martelo.
 */
export function PencilBar({
  phrase,
  pending,
  op,
  onSwap,
  onCommit,
  onCancel,
}: {
  phrase?: string;
  /** esperando a escolha do lado, ou a oferta de separar em peça */
  pending: "sides" | "offer" | "ready" | null;
  op: "add" | "cut";
  onSwap: () => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const penSeen = useUiStore((s) => s.penSeen);
  const fingerDraws = useUiStore((s) => s.fingerDraws);
  const on = useUiStore((s) => s.pencil);
  const mode = useUiStore((s) => s.mode);
  const tool = useUiStore((s) => s.pencilTool);
  const set = useUiStore((s) => s.setPencilTool);
  const [details, setDetails] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") useUiStore.getState().setPencil(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  if (!on || mode !== "edit") return null;
  const custom = !PENCIL_WIDTHS.includes(tool.width);
  const cancel: StripItem = { id: "cancel", label: "Cancelar", onClick: onCancel };
  const actions: StripItem[] | undefined =
    pending === "offer"
      ? [{ id: "separate", label: "Separar em peça", pressed: true, onClick: onCommit }, cancel]
      : pending === "sides"
        ? [
            { id: "swap", label: "Trocar lado", onClick: onSwap },
            {
              id: "commit",
              label: op === "cut" ? "Cravar corte" : "Cravar soma",
              pressed: true,
              onClick: onCommit,
            },
            cancel,
          ]
        : undefined;
  const stroke = tool.form === "stroke";
  return (
    <ToolStrip
      label="Ferramentas do Lápis"
      mode="cycle"
      phrase={phrase}
      actions={actions}
      popover={
        details && stroke ? (
          <label className="pencildetails">
            <span>Largura do traço</span>
            <input
              type="range"
              min={0.5}
              max={10}
              step={0.5}
              value={tool.width}
              onChange={(e) => set({ width: Number(e.target.value) })}
            />
            <output>{fmt(tool.width)} mm</output>
          </label>
        ) : undefined
      }
      groups={[
        ...(penSeen
          ? [
              {
                name: "Toque",
                items: [
                  {
                    id: "finger",
                    label: "Dedo desenha",
                    glyph: "Dedo",
                    pressed: fingerDraws,
                    onClick: () => useUiStore.getState().setFingerDraws(!fingerDraws),
                  },
                ],
              },
            ]
          : []),
        {
          name: "Forma",
          items: [
            {
              id: "contour",
              label: "Contorno",
              icon: "contour",
              pressed: !stroke,
              onClick: () => set({ form: "contour" }),
            },
            {
              id: "stroke",
              label: "Traço",
              icon: "stroke",
              pressed: stroke,
              onClick: () => set({ form: "stroke" }),
            },
          ],
        },
        {
          name: "Ação",
          items: [
            {
              id: "add",
              label: "Somar",
              icon: "add",
              pressed: tool.op === "add",
              onClick: () => set({ op: "add" }),
            },
            {
              id: "cut",
              label: "Tirar",
              icon: "cut",
              pressed: tool.op === "cut",
              onClick: () => set({ op: "cut" }),
            },
          ],
        },
        {
          name: "Largura",
          items: [
            ...PENCIL_WIDTHS.map((w) => ({
              id: `w${w}`,
              label: `${w} mm`,
              glyph: `${w}`,
              pressed: tool.width === w,
              disabled: !stroke,
              onClick: () => set({ width: w }),
            })),
            {
              id: "wmore",
              label: custom ? `${fmt(tool.width)} mm` : "Detalhes",
              icon: custom ? undefined : "details",
              glyph: custom ? fmt(tool.width) : undefined,
              pressed: custom || details,
              disabled: !stroke,
              onClick: () => setDetails((d) => !d),
            },
          ],
        },
        {
          name: "Régua",
          items: [
            {
              id: "ruler",
              label: "Régua",
              icon: "ruler",
              pressed: tool.ruler,
              onClick: () => set({ ruler: !tool.ruler }),
            },
          ],
        },
      ]}
    />
  );
}
