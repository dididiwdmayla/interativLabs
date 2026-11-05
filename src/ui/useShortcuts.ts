import { useEffect } from "react";
import { useUiStore } from "@/editor/useUiStore";
import { deleteSelectionAction } from "./menuActions";

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** Atalhos: Ctrl+Z desfaz, Ctrl+Shift+Z (ou Ctrl+Y) refaz, Delete exclui a seleção, Esc limpa a seleção. */
export function useShortcuts(extra?: (e: KeyboardEvent) => boolean): void {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const s = useUiStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && k === "y") {
        e.preventDefault();
        s.redo();
        return;
      }
      if ((k === "delete" || k === "backspace") && s.mode === "edit" && s.selection) {
        e.preventDefault();
        deleteSelectionAction();
        return;
      }
      if (k === "escape" && !s.sheet && !s.edgeMenu && s.selection) {
        s.select(null);
        return;
      }
      if (extra?.(e)) e.preventDefault();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [extra]);
}
