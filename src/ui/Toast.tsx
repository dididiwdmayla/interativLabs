import { useEffect } from "react";
import { useUiStore } from "@/editor/useUiStore";

const SHOW_MS = 3200;
const SHOW_UNDO_MS = 5200;

/**
 * Aviso curto embaixo da prancha ("Desfeito: mover Barra 3",
 * "Excluída Barra 3 e 2 ligações · Desfazer"). Some sozinho.
 */
export function Toast() {
  const notice = useUiStore((s) => s.notice);
  const clear = useUiStore((s) => s.clearNotice);
  const undo = useUiStore((s) => s.undo);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(clear, notice.undo ? SHOW_UNDO_MS : SHOW_MS);
    return () => window.clearTimeout(t);
  }, [notice, clear]);
  if (!notice) return null;
  return (
    <div
      className={`toast${notice.warn ? " toast--warn" : ""}`}
      role="status"
      aria-live="polite"
      key={notice.id}
    >
      <span className="toast__text">{notice.text}</span>
      {notice.undo && (
        <button
          type="button"
          className="toast__undo"
          onClick={() => {
            clear();
            undo();
          }}
        >
          Desfazer
        </button>
      )}
    </div>
  );
}
