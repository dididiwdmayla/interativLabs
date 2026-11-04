import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/editor/useUiStore";
import { EXAMPLES, openExample } from "./scenes/examples";

/** Menu (☰): os exemplos, com nome e uma linha de descrição. */
export function ExampleMenu() {
  const open = useUiStore((s) => s.menuOpen);
  const setOpen = useUiStore((s) => s.setMenuOpen);
  const current = useUiStore((s) => s.current?.id);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const down = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!ref.current?.contains(t) && !t.closest(".topbar__menu")) setOpen(false);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", down);
    ref.current?.querySelector<HTMLButtonElement>("button[aria-current]")?.focus();
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", down);
    };
  }, [open, setOpen]);

  if (!open) return null;
  return (
    <div className="menu" ref={ref} role="dialog" aria-label="Exemplos">
      <h2 className="menu__title">Exemplos</h2>
      <ul className="menu__list">
        {EXAMPLES.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className="menu__item"
              aria-current={e.id === current ? "true" : undefined}
              onClick={() => {
                setError(null);
                openExample(e.id).catch((err: Error) => setError(err.message));
              }}
            >
              <span className="menu__fig">Fig. {e.figure}</span>
              <span className="menu__name">{e.title}</span>
              <span className="menu__desc">{e.description}</span>
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="menu__error">{error}</p>}
    </div>
  );
}
