import { Measure } from "../instruments/Measure";
import { Suspense, lazy, useId } from "react";
import { deleteLink } from "@/editor/commands";
import { LINK_LABEL } from "@/editor/names";
import { useUiStore } from "@/editor/useUiStore";
import type { LinkModel, SceneModel } from "@/render/prepare";
import { LinkQuick } from "./LinkQuick";
import { LinkLists } from "./LinkLists";
import { LinkPair } from "./LinkPair";
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
  slot: "slot",
  rod: "rod",
  cable: "cable",
  mount: "mount",
  lock: "latch",
};

/** Cartão da ligação selecionada: tipo, peças ligadas, detalhes e excluir. */
export function LinkCard({ model, lm }: { model: SceneModel; lm: LinkModel }) {
  const uid = useId();
  const ui = useUiStore();
  const l = lm.link;
  return (
    <div className="card">
      <div className="card__head">
        <span className="card__ref">{l.ref}</span>
        <span className="card__icon">
          <Icon name={LINK_ICON[l.kind] ?? "axle"} uid={`${uid}i`} />
        </span>
        <h3 className="card__title">{LINK_LABEL[l.kind]}</h3>
      </div>
      <Measure
        target={l.id}
        name={LINK_LABEL[l.kind]}
        kind={l.kind}
        limit={l.kind === "lock" ? l.breakForce : undefined}
      />
      <LinkQuick scene={model.scene} link={l} />
      <LinkPair model={model} lm={lm} />
      <LinkLists model={model} link={l} />
      <section className="card__acts" aria-label="Ações">
        <button type="button" className="cardact" data-keeps-sheet onClick={() => ui.setExplain(l.kind)}>
          <span className="cardact__icon">
            <Icon name="explain" uid={`${uid}x`} />
          </span>
          <span className="cardact__label">O que é?</span>
        </button>
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
