import { useEffect, useId, useRef, type ReactNode } from "react";
import { useUiStore } from "@/editor/useUiStore";
import { Icon } from "./icons";

interface SheetProps {
  title: string;
  /** lado lógico: "menu" (o do ☰) ou "tools" (o do Inserir e das camadas) */
  side: "menu" | "tools";
  children: ReactNode;
  /** fecha ao tocar fora (a do cartão fica aberta enquanto a pessoa mexe na prancha) */
  modal?: boolean;
  className?: string;
  onClose?: () => void;
}

/**
 * Folha lateral em paisagem e no computador; folha de baixo em retrato.
 * Cabeçalho com o título em Old Standard TT caixa alta e fio duplo.
 */
export function Sheet({ title, side, children, modal = true, className = "", onClose }: SheetProps) {
  const uid = useId();
  const setSheet = useUiStore((s) => s.setSheet);
  const ref = useRef<HTMLElement>(null);
  const close = onClose ?? (() => setSheet(null));
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    const down = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!modal || ref.current?.contains(t) || t.closest("[data-keeps-sheet]")) return;
      closeRef.current();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", down, true);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", down, true);
    };
  }, [modal]);

  return (
    <aside className={`sheet ${className}`} data-side={side} ref={ref} role="dialog" aria-label={title}>
      <header className="sheet__head">
        <h2 className="sheet__title">{title}</h2>
        <button type="button" className="iconbtn sheet__close" aria-label="Fechar" onClick={close}>
          <Icon name="close" uid={`${uid}x`} />
        </button>
      </header>
      <div className="sheet__body">{children}</div>
    </aside>
  );
}
