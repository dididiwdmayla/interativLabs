import { useState } from "react";
import { useUiStore, type MainTab } from "@/editor/useUiStore";
import { EXAMPLES, openExample } from "./scenes/examples";
import { Sheet } from "./Sheet";

const TABS: { id: MainTab; label: string }[] = [
  { id: "projects", label: "Projetos" },
  { id: "examples", label: "Exemplos" },
  { id: "transfer", label: "Arquivo" },
];

function Examples() {
  const current = useUiStore((s) => s.current?.id);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
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
    </>
  );
}

/** Menu ☰: projetos, exemplos e arquivo (exportar e importar). */
export function MainSheet() {
  const tab = useUiStore((s) => s.mainTab);
  const setTab = useUiStore((s) => s.setMainTab);
  return (
    <Sheet title="interativLabs" side="menu" className="sheet--main">
      <div className="tabs" role="tablist" aria-label="Menu">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="tabs__tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "examples" && <Examples />}
      {tab !== "examples" && <p className="sheet__lede">Em breve.</p>}
    </Sheet>
  );
}
