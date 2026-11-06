import { useEffect, useId, useState } from "react";
import { HAMMER_GROUPS, type HammerTool } from "@/editor/hammer";
import { LINK_LABEL } from "@/editor/names";
import { useUiStore } from "@/editor/useUiStore";
import { Icon, type IconName } from "./icons";
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

export function HammerBar({ phrase }: { phrase?: string }) {
  const ui = useUiStore();
  const uid = useId();
  const [group, setGroup] = useState(0);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") useUiStore.getState().setHammer(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  if (!ui.hammer || ui.mode !== "edit") return null;
  return (
    <aside className="hammerbar stage__ui" aria-label="Ferramentas do Martelo" data-keeps-sheet>
      <div className="hammerbar__groups" role="group" aria-label="Grupos">
        {HAMMER_GROUPS.map((g, i) => (
          <button type="button" key={g.name} aria-pressed={group === i} onClick={() => setGroup(i)}>
            {g.name}
          </button>
        ))}
        <button
          type="button"
          aria-label="Sair do Martelo"
          title="Sair (Esc)"
          onClick={() => ui.setHammer(null)}
        >
          <Icon name="close" uid={`${uid}close`} size={18} />
        </button>
      </div>
      <div className="hammerbar__tools" role="group" aria-label={HAMMER_GROUPS[group]?.name}>
        {HAMMER_GROUPS[group]?.tools.map((tool) => (
          <button
            type="button"
            key={tool}
            aria-pressed={ui.hammer === tool}
            disabled={!["screw", "axle", "pin", "lock"].includes(tool)}
            onClick={() => ui.setHammer(tool)}
          >
            <Icon name={TOOL_ICONS[tool]} uid={`${uid}${tool}`} size={22} />
            <span>{LINK_LABEL[tool]}</span>
          </button>
        ))}
      </div>
      <p className="hammerbar__phrase" aria-live="polite">
        {phrase ?? `${LINK_LABEL[ui.hammer]}: toque sobre uma peça · Esc sai`}
      </p>
    </aside>
  );
}
