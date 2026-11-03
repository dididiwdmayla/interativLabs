import { useId } from "react";
import { useUiStore } from "@/editor/useUiStore";
import { Icon } from "./icons";
import { ModeButton } from "./ModeButton";

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const uid = useId();
  const mode = useUiStore((s) => s.mode);
  return (
    <header className="topbar">
      <div className="topbar__side">
        <button type="button" className="iconbtn" aria-label="Menu" title="Menu">
          <Icon name="menu" uid={`${uid}m`} />
        </button>
      </div>
      <h1 className="topbar__title" title={title}>
        <span className="topbar__mode">{mode === "edit" ? "Editar" : "Simular"}</span>
        <span className="topbar__name">{title}</span>
      </h1>
      <div className="topbar__side topbar__side--end">
        <button type="button" className="iconbtn" aria-label="Desfazer" title="Desfazer (Ctrl+Z)" disabled>
          <Icon name="undo" uid={`${uid}u`} />
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label="Refazer"
          title="Refazer (Ctrl+Shift+Z)"
          disabled
        >
          <Icon name="redo" uid={`${uid}r`} />
        </button>
        <ModeButton className="only-desktop" />
      </div>
    </header>
  );
}
