import { Suspense, lazy, useId } from "react";
import { deleteLink } from "@/editor/commands";
import { LINK_LABEL, linkParts, partName } from "@/editor/names";
import { useUiStore } from "@/editor/useUiStore";
import type { LinkModel, SceneModel } from "@/render/prepare";
import { Icon, type IconName } from "../icons";

const LinkDetails = lazy(() => import("./LinkDetails"));

/** Ícone de cada ligação: o próprio símbolo dela no palco. */
const LINK_ICON: Partial<Record<string, IconName>> = {
  screw: "screw",
  axle: "axle",
  pin: "pin",
  slider: "slider",
  spring: "spring",
  chamber: "chamber",
  sensor: "sensor",
  slot: "pin",
  rod: "slider",
  cable: "spring",
  mount: "screw",
};

/** Cartão da ligação selecionada: tipo, peças ligadas, detalhes e excluir. */
export function LinkCard({ model, lm }: { model: SceneModel; lm: LinkModel }) {
  const uid = useId();
  const ui = useUiStore();
  const l = lm.link;
  const parts = [...new Set(linkParts(l))];
  const span = lm.span[0] === lm.span[1] ? `${lm.span[0] + 1}` : `${lm.span[0] + 1}–${lm.span[1] + 1}`;
  return (
    <div className="card">
      <div className="card__head">
        <span className="card__ref">{l.ref}</span>
        <span className="card__icon">
          <Icon name={LINK_ICON[l.kind] ?? "axle"} uid={`${uid}i`} />
        </span>
        <h3 className="card__title">{LINK_LABEL[l.kind]}</h3>
      </div>
      <section className="card__sec" aria-label="Peças ligadas">
        <h3 className="card__k">Liga · camadas {span}</h3>
        <ul className="linklist">
          {parts.map((id) => {
            const p = id === null ? null : model.parts.get(id)?.part;
            return (
              <li key={id ?? "ground"}>
                {p ? (
                  <button
                    type="button"
                    className="linklist__item"
                    onClick={() => ui.select({ kind: "part", id: p.id })}
                  >
                    <span className="linklist__ref">{p.ref}</span>
                    {partName(p)}
                  </button>
                ) : (
                  <span className="linklist__item linklist__item--static">
                    <span className="linklist__ref">—</span>O fundo
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <section className="card__acts" aria-label="Ações">
        <button
          type="button"
          className="cardact cardact--danger"
          onClick={() => ui.commit(deleteLink(model.scene, l.id), { selection: null })}
        >
          <span className="cardact__icon">
            <Icon name="trash" uid={`${uid}t`} />
          </span>
          <span className="cardact__label">Excluir</span>
        </button>
      </section>
      <button
        type="button"
        className="btn btn--outline card__details"
        aria-expanded={ui.details}
        onClick={() => ui.setDetails(!ui.details)}
      >
        <Icon name="details" uid={`${uid}de`} size={20} />
        Detalhes
      </button>
      {ui.details && (
        <Suspense fallback={<p className="card__empty">Carregando…</p>}>
          <LinkDetails link={l} />
        </Suspense>
      )}
    </div>
  );
}
