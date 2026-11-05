import { useId } from "react";
import { useUiStore } from "@/editor/useUiStore";
import type { SceneModel } from "@/render/prepare";
import { CardBody } from "./card/SelectionCard";
import { Icon } from "./icons";

export function LayerPlates({ model }: { model: SceneModel }) {
  const active = useUiStore((s) => s.activeLayer);
  const setActive = useUiStore((s) => s.setActiveLayer);
  // a do topo é a mais próxima de quem olha: ordem visual é o array invertido
  const top = [...model.layers].reverse();
  return (
    <ol className="plates" aria-label="Camadas">
      {top.map((l) => {
        const n = l.index + 1;
        const isActive = l.index === active;
        return (
          <li key={l.layer.id}>
            <button
              type="button"
              className="plate"
              aria-current={isActive ? "true" : undefined}
              onClick={() => setActive(l.index)}
            >
              <span className="plate__thumb" aria-hidden="true">
                <span className="plate__sheet" />
                <span className="plate__sheet" />
                <span className="plate__sheet plate__sheet--front" />
              </span>
              <span className="plate__num">{n}</span>
              <span className="plate__meta">
                <span className="plate__name">{l.layer.name}</span>
                <span className="plate__count">
                  {l.parts.length === 1 ? "1 peça" : `${l.parts.length} peças`}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Painel lateral fixo do computador (a partir de 1100 px): a seleção e as camadas. */
export function SidePanel({ model }: { model: SceneModel | null }) {
  const uid = useId();
  const xray = useUiStore((s) => s.xray);
  const setXray = useUiStore((s) => s.setXray);
  const sel = useUiStore((s) => s.selection);
  return (
    <aside className="panel" aria-label="Cartão e camadas">
      <section className="panel__section">
        <h2 className="panel__title">{sel?.kind === "link" ? "Ligação" : "Peça"}</h2>
        {model && sel ? (
          <CardBody model={model} />
        ) : (
          <p className="panel__empty">Nada escolhido. Toque numa peça ou ligação para ver o cartão dela.</p>
        )}
      </section>
      <section className="panel__section">
        <h2 className="panel__title">Camadas</h2>
        {model && <LayerPlates model={model} />}
        <button
          type="button"
          className="btn btn--outline panel__xray"
          aria-pressed={xray}
          onClick={() => setXray(!xray)}
        >
          <Icon name="xray" uid={`${uid}x`} size={20} />
          Raio-x
        </button>
      </section>
    </aside>
  );
}
