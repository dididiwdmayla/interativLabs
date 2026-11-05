import { useEffect } from "react";
import { useUiStore } from "@/editor/useUiStore";

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** Atalhos de teclado: Ctrl+Z desfaz, Ctrl+Shift+Z (ou Ctrl+Y) refaz, Esc fecha. */
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
      if (extra?.(e)) e.preventDefault();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [extra]);
}
