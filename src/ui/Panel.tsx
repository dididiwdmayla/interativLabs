import { useId } from "react";
import { useUiStore } from "@/editor/useUiStore";
import type { SceneModel } from "@/render/prepare";
import { CardBody } from "./card/SelectionCard";
import { Icon } from "./icons";
import { LayerStack } from "./LayerStack";

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
        {model && <LayerStack model={model} />}
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
