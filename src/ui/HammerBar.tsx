import { useEffect } from "react";
import { HAMMER_GROUPS, type HammerTool } from "@/editor/hammer";
import { LINK_LABEL } from "@/editor/names";
import { useUiStore } from "@/editor/useUiStore";
import type { IconName } from "./icons";
import { ToolStrip, type StripItem } from "./ToolStrip";
import "./hammer.css";

const TOOL_ICONS: Record<HammerTool, IconName> = {
  screw: "screw",
  axle: "axle",
  pin: "pin",
  lock: "latch",
  spring: "spring",
  rod: "rod",
  cable: "cable",
  slider: "slider",
  chamber: "chamber",
  sensor: "sensor",
};

/** Faixa do Martelo: os quatro grupos na faixa compartilhada com o Lápis. */
export function HammerBar({ phrase, actions }: { phrase?: string; actions?: StripItem[] }) {
  const lastInput = useUiStore((s) => s.lastInput);
  const hammer = useUiStore((s) => s.hammer);
  const mode = useUiStore((s) => s.mode);
  const setHammer = useUiStore((s) => s.setHammer);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      useUiStore.getState().noteInput("keyboard");
      if (e.key === "Escape") useUiStore.getState().setHammer(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  if (!hammer || mode !== "edit") return null;
  return (
    <ToolStrip
      label="Ferramentas do Martelo"
      mode="select"
      phrase={
        phrase ??
        `${LINK_LABEL[hammer]}: toque sobre uma peça${lastInput === "mouse" || lastInput === "keyboard" ? " · Esc sai" : ""}`
      }
      actions={actions}
      groups={HAMMER_GROUPS.map((g) => ({
        name: g.name,
        items: g.tools.map((tool) => ({
          id: tool,
          label: LINK_LABEL[tool],
          icon: TOOL_ICONS[tool],
          pressed: hammer === tool,
          onClick: () => setHammer(tool),
          onLongPress: () => useUiStore.getState().setExplain(tool),
        })),
      }))}
    />
  );
}
