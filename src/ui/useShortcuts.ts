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
    // "Esc sai" só aparece para quem usa teclado ou mouse
    const input = (e: Event) => {
      const s = useUiStore.getState();
      if (e instanceof PointerEvent) s.setKeys(e.pointerType === "mouse");
      else if (e instanceof KeyboardEvent && !typing(e.target)) s.setKeys(true);
    };
    window.addEventListener("keydown", on);
    window.addEventListener("keydown", input, true);
    window.addEventListener("pointerdown", input, true);
    return () => {
      window.removeEventListener("keydown", on);
      window.removeEventListener("keydown", input, true);
      window.removeEventListener("pointerdown", input, true);
    };
  }, [extra]);
}
