import { useId } from "react";
import { useUiStore } from "@/editor/useUiStore";
import { Icon } from "./icons";

export interface LayerSummary {
  id: string;
  name: string;
  parts: number;
}

interface PanelProps {
  layers: LayerSummary[];
  activeLayer: string;
}

function LayerPlates({ layers, activeLayer }: PanelProps) {
  // A lista de camadas é uma pilha de pranchas pequenas; a do topo é a mais
  // próxima de quem olha, então a ordem visual é o array invertido.
  const top = [...layers].reverse();
  return (
    <ol className="plates" aria-label="Camadas">
      {top.map((l) => {
        const n = layers.indexOf(l) + 1;
        const active = l.id === activeLayer;
        return (
          <li key={l.id}>
            <button type="button" className="plate" aria-current={active ? "true" : undefined}>
              <span className="plate__thumb" aria-hidden="true">
                <span className="plate__sheet" />
                <span className="plate__sheet" />
                <span className="plate__sheet plate__sheet--front" />
              </span>
              <span className="plate__num">{n}</span>
              <span className="plate__meta">
                <span className="plate__name">{l.name}</span>
                <span className="plate__count">{l.parts === 1 ? "1 peça" : `${l.parts} peças`}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Painel de propriedades: coluna à direita no computador, folha inferior
 * no celular (recolhida por padrão; só a alça e a camada ativa aparecem).
 */
export function Panel(props: PanelProps) {
  const uid = useId();
  const open = useUiStore((s) => s.sheetOpen);
  const setOpen = useUiStore((s) => s.setSheetOpen);
  const active = props.layers.find((l) => l.id === props.activeLayer);
  const activeIndex = props.layers.findIndex((l) => l.id === props.activeLayer) + 1;
  const bodyId = `${uid}body`;
  return (
    <aside className="panel" data-open={open} aria-label="Propriedades">
      <button
        type="button"
        className="panel__handle only-mobile"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
      >
        <span className="panel__grip" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="panel__handle-label">
          <span className="panel__handle-k">Camada</span>
          <span className="panel__handle-num">{activeIndex}</span>
          <span className="panel__handle-name">{active?.name}</span>
        </span>
        <span className="panel__chev" aria-hidden="true">
          <Icon name="chevron" uid={`${uid}c`} size={20} />
        </span>
      </button>
      <div className="panel__body" id={bodyId}>
        <section className="panel__section">
          <h2 className="panel__title">Propriedades</h2>
          <p className="panel__empty">Nada selecionado. Toque numa peça ou ligação para ver as medidas.</p>
        </section>
        <section className="panel__section">
          <h2 className="panel__title">Camadas</h2>
          <LayerPlates {...props} />
        </section>
      </div>
    </aside>
  );
}
