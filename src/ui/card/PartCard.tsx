import { useId, useState } from "react";
import {
  deleteParts,
  duplicatePart,
  mirrorPart,
  renamePart,
  rotate90,
  scalePart,
  setFixed,
  setMaterial,
  setPartFields,
  setPartLayer,
} from "@/editor/commands";
import { localBox } from "@/editor/handles";
import { LINK_LABEL, linkParts } from "@/editor/names";
import { useUiStore } from "@/editor/useUiStore";
import { mirroredShape, paramsOf, regenerate } from "@/parts";
import type { PartModel, SceneModel } from "@/render/prepare";
import { Icon, type IconName } from "../icons";
import { NumberField, Stepper } from "./fields";
import { fmt } from "./format";
import { Swatches } from "./Swatches";

const DEG = 180 / Math.PI;

function Action({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const uid = useId();
  return (
    <button type="button" className={`cardact${danger ? " cardact--danger" : ""}`} onClick={onClick}>
      <span className="cardact__icon">
        <Icon name={icon} uid={uid} />
      </span>
      <span className="cardact__label">{label}</span>
    </button>
  );
}

/** Nome editável: confirma ao sair do campo ou com Enter. */
function NameField({ m }: { m: PartModel }) {
  const commit = useUiStore((s) => s.commit);
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? m.part.name;
  const setText = (t: string) => setDraft(t);
  const done = () => {
    const scene = useUiStore.getState().current?.scene;
    const t = text.trim();
    setDraft(null);
    if (scene && t && t !== m.part.name) commit(renamePart(scene, m.part.id, t));
  };
  return (
    <input
      className="card__name"
      aria-label="Nome da peça"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={done}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

/** Cartão rápido da peça (docs/arquitetura.md §6, "Botão da peça"). */
export function PartCard({ model, m }: { model: SceneModel; m: PartModel }) {
  const uid = useId();
  const ui = useUiStore();
  const scene = model.scene;
  const p = m.part;
  const li = m.layer;
  const below = model.layers[li - 1]?.layer;
  const above = model.layers[li + 1]?.layer;
  const pp = paramsOf(p);
  const links = model.links.filter((lm) => linkParts(lm.link).includes(p.id));
  const box = localBox(m);
  const thickness = model.layers[li]?.layer.thickness ?? 3;

  const toLayer = (i: number) => {
    const L = model.layers[i]?.layer;
    if (L) ui.commit(setPartLayer(scene, [p.id], L.id), { activeLayer: i });
  };
  const setParam = (key: string, v: number) =>
    ui.commit(regenerate(scene, p.id, { [key]: v }), undefined, { merge: `param:${p.id}:${key}` });

  return (
    <div className="card">
      <div className="card__head">
        <span className="card__ref" aria-label={`Número de chamada ${p.ref}`}>
          {p.ref}
        </span>
        <NameField m={m} />
      </div>

      <section className="card__sec" aria-label="Camada">
        <h3 className="card__k">
          Camada {li + 1} · {model.layers[li]?.layer.name}
        </h3>
        <div className="card__layers">
          <button
            type="button"
            className="btn btn--outline btn--small card__layer"
            disabled={!above}
            onClick={() => toLayer(li + 1)}
          >
            <Icon name="up" uid={`${uid}u`} size={20} />
            {above ? `Subir · ${li + 2} ${above.name}` : "No topo"}
          </button>
          <button
            type="button"
            className="btn btn--outline btn--small card__layer"
            disabled={!below}
            onClick={() => toLayer(li - 1)}
          >
            <Icon name="down" uid={`${uid}d`} size={20} />
            {below ? `Descer · ${li} ${below.name}` : "No fundo"}
          </button>
        </div>
      </section>

      <section className="card__sec" aria-label="Tamanho">
        <h3 className="card__k">Tamanho</h3>
        {pp ? (
          pp.g.main.map((key) => {
            const d = pp.g.params.find((x) => x.key === key);
            if (!d) return null;
            return (
              <Stepper
                key={key}
                label={d.label}
                value={pp.params[key] ?? d.default}
                unit={d.unit}
                min={d.min}
                max={d.max}
                step={d.step}
                integer={d.integer}
                onChange={(v) => setParam(key, v)}
              />
            );
          })
        ) : (
          <div className="stepper">
            <span className="stepper__label">Escala (10% por toque)</span>
            <div className="stepper__row">
              <button
                type="button"
                className="tool stepper__btn"
                aria-label="Diminuir 10%"
                onClick={() =>
                  ui.commit(scalePart(scene, p.id, 0.9, 0.9), undefined, { merge: `scale:${p.id}` })
                }
              >
                <Icon name="minus" uid={`${uid}sm`} />
              </button>
              <output className="stepper__value">
                {fmt(box.x1 - box.x0, 1)} × {fmt(box.y1 - box.y0, 1)}
                <span className="stepper__unit"> mm</span>
              </output>
              <button
                type="button"
                className="tool stepper__btn"
                aria-label="Aumentar 10%"
                onClick={() =>
                  ui.commit(scalePart(scene, p.id, 1.1, 1.1), undefined, { merge: `scale:${p.id}` })
                }
              >
                <Icon name="plus" uid={`${uid}sp`} />
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card__sec" aria-label="Material">
        <h3 className="card__k">Material</h3>
        <Swatches value={p.material} onPick={(mat) => ui.commit(setMaterial(scene, p.id, mat))} />
      </section>

      <section className="card__sec" aria-label="Fixação">
        <div className="seg" role="radiogroup" aria-label="Fixa ou solta">
          <button
            type="button"
            role="radio"
            aria-checked={p.fixed}
            className="seg__opt"
            onClick={() => ui.commit(setFixed(scene, p.id, true))}
          >
            <Icon name="fixed" uid={`${uid}fx`} size={20} />
            Fixa
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!p.fixed}
            className="seg__opt"
            onClick={() => ui.commit(setFixed(scene, p.id, false))}
          >
            <Icon name="loose" uid={`${uid}lo`} size={20} />
            Solta
          </button>
        </div>
      </section>

      <section className="card__acts" aria-label="Ações">
        <Action icon="rotate" label="Girar 90°" onClick={() => ui.commit(rotate90(scene, p.id))} />
        <Action
          icon="mirror"
          label="Espelhar"
          onClick={() => ui.commit(mirrorPart(scene, p.id, mirroredShape(p)))}
        />
        <Action
          icon="duplicate"
          label="Duplicar"
          onClick={() => {
            const r = duplicatePart(scene, p.id);
            if (r) ui.commit(r.command, { selection: { kind: "part", id: r.newId } });
          }}
        />
        <Action
          icon="trash"
          label="Excluir"
          danger
          onClick={() => ui.commit(deleteParts(scene, [p.id]), { selection: null })}
        />
      </section>

      <section className="card__sec" aria-label="Ligações desta peça">
        <h3 className="card__k">Ligações</h3>
        {links.length === 0 ? (
          <p className="card__empty">Nenhuma ligação nesta peça.</p>
        ) : (
          <ul className="linklist">
            {links.map((lm) => (
              <li key={lm.link.id}>
                <button
                  type="button"
                  className="linklist__item"
                  onClick={() => ui.select({ kind: "link", id: lm.link.id })}
                >
                  <span className="linklist__ref">{lm.link.ref}</span>
                  {LINK_LABEL[lm.link.kind]}
                </button>
              </li>
            ))}
          </ul>
        )}
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
        <section className="card__sec card__form" aria-label="Detalhes">
          <NumberField
            label="Posição x"
            unit="mm"
            value={p.x}
            onCommit={(v) => (ui.commit(setPartFields(scene, p.id, { x: v })), null)}
          />
          <NumberField
            label="Posição y"
            unit="mm"
            value={p.y}
            onCommit={(v) => (ui.commit(setPartFields(scene, p.id, { y: v })), null)}
          />
          <NumberField
            label="Ângulo"
            unit="°"
            value={p.angle * DEG}
            onCommit={(v) => (ui.commit(setPartFields(scene, p.id, { angle: v / DEG })), null)}
          />
          {pp &&
            pp.g.params
              .filter((d) => !pp.g.main.includes(d.key))
              .map((d) => (
                <NumberField
                  key={d.key}
                  label={d.label}
                  unit={d.unit}
                  value={pp.params[d.key] ?? d.default}
                  onCommit={(v) => {
                    if (v < d.min || v > d.max) return `Entre ${fmt(d.min)} e ${fmt(d.max)} ${d.unit}`.trim();
                    ui.commit(regenerate(scene, p.id, { [d.key]: v }));
                    return null;
                  }}
                />
              ))}
          <NumberField
            label="Espessura"
            unit="mm"
            value={thickness}
            readOnly
            note={`Herdada da camada ${li + 1}; muda na pilha de camadas`}
          />
          <NumberField
            label="Massa"
            unit="g"
            value={m.mass}
            digits={m.mass < 10 ? 2 : 1}
            readOnly
            note="Calculada: área × espessura × densidade"
          />
          <NumberField
            label="Número de chamada"
            value={p.ref}
            digits={0}
            onCommit={(v) => {
              if (!Number.isInteger(v) || v < 1) return "Use um número inteiro maior que zero";
              const taken =
                scene.parts.some((x) => x.ref === v && x.id !== p.id) || scene.links.some((l) => l.ref === v);
              if (taken) return `O número ${v} já está em uso`;
              ui.commit(setPartFields(scene, p.id, { ref: v }));
              return null;
            }}
          />
        </section>
      )}
    </div>
  );
}
