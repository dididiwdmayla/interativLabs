import { useEffect } from "react";
import { HAMMER_GROUPS, type HammerTool } from "@/editor/hammer";
import { LINK_LABEL } from "@/editor/names";
import { idlePhrase, withEsc } from "@/editor/phrases";
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
  const hammer = useUiStore((s) => s.hammer);
  const mode = useUiStore((s) => s.mode);
  const setHammer = useUiStore((s) => s.setHammer);
  const keys = useUiStore((s) => s.keys);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
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
      phrase={phrase ?? withEsc(idlePhrase(hammer), keys)}
      actions={actions}
      groups={HAMMER_GROUPS.map((g) => ({
        name: g.name,
        items: g.tools.map((tool) => ({
          id: tool,
          label: LINK_LABEL[tool],
          icon: TOOL_ICONS[tool],
          pressed: hammer === tool,
          onClick: () => setHammer(tool),
        })),
      }))}
    />
  );
}
