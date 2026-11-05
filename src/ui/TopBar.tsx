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
  const menuOpen = useUiStore((s) => s.menuOpen);
  const setMenuOpen = useUiStore((s) => s.setMenuOpen);
  const canUndo = useUiStore((s) => s.mode === "edit" && s.history.past.length > 0);
  const canRedo = useUiStore((s) => s.mode === "edit" && s.history.future.length > 0);
  const undo = useUiStore((s) => s.undo);
  const redo = useUiStore((s) => s.redo);
  return (
    <header className="topbar">
      <div className="topbar__side">
        <button
          type="button"
          className="iconbtn topbar__menu"
          aria-label="Menu de exemplos"
          title="Exemplos"
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name={menuOpen ? "close" : "menu"} uid={`${uid}m`} />
        </button>
      </div>
      <h1 className="topbar__title" title={title}>
        <span className="topbar__mode">{mode === "edit" ? "Editar" : "Simular"}</span>
        <span className="topbar__name">{title}</span>
      </h1>
      <div className="topbar__side topbar__side--end">
        <button
          type="button"
          className="iconbtn"
          aria-label="Desfazer"
          title="Desfazer (Ctrl+Z)"
          disabled={!canUndo}
          onClick={undo}
        >
          <Icon name="undo" uid={`${uid}u`} />
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label="Refazer"
          title="Refazer (Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={redo}
        >
          <Icon name="redo" uid={`${uid}r`} />
        </button>
        <ModeButton className="only-desktop" />
      </div>
    </header>
  );
}
