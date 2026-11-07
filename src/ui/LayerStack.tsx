import { useId, useRef, useState } from "react";
import { deleteLayer, moveLayer, setLayerFields } from "@/editor/commands";
import { plural } from "@/editor/names";
import { useUiStore } from "@/editor/useUiStore";
import type { SceneModel } from "@/render/prepare";
import { NumberField } from "./card/fields";
import { Icon } from "./icons";
import { newLayerAction } from "./menuActions";

/**
 * Pilha de pranchas (identidade, "Lista de camadas"): do topo para o fundo,
 * cada camada como uma prancha oblíqua com fio duplo; a ativa à frente, em
 * ink, com a sombra dura. Tocar ativa; arrastar pela alça reordena; olho
 * oculta; cadeado trava; o lápis abre nome, espessura e excluir (com
 * confirmação na própria folha). Tudo é comando, com desfazer.
 */

const ROW_H = 60;

function Row({
  model,
  index,
  open,
  onOpen,
  onGrip,
  offset,
}: {
  model: SceneModel;
  index: number;
  open: boolean;
  onOpen: () => void;
  onGrip: (e: React.PointerEvent) => void;
  offset: number;
}) {
  const uid = useId();
  const ui = useUiStore();
  const L = model.layers[index];
  const [draft, setDraft] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  if (!L) return null;
  const layer = L.layer;
  const scene = model.scene;
  const active = ui.activeLayer === index;
  const count = L.parts.length;
  const name = draft ?? layer.name;
  return (
    <li
      className={`lrow${active ? " is-active" : ""}${!layer.visible ? " is-hidden" : ""}`}
      style={offset ? { transform: `translateY(${offset}px)` } : undefined}
      data-dragging={offset ? true : undefined}
    >
      <div className="lrow__main">
        <button
          type="button"
          className="lrow__pick"
          aria-current={active ? "true" : undefined}
          aria-label={`Ativar a camada ${index + 1}, ${layer.name}`}
          onClick={() => ui.setActiveLayer(index)}
        >
          <span className="lrow__plate" aria-hidden="true">
            <span className="lrow__sheet" style={ui.layerColors ? { background: `var(--layer-${index + 1})` } : undefined} />
          </span>
          <span className="lrow__num">– {index + 1}</span>
          <span className="lrow__meta">
            <span className="lrow__name">{layer.name}</span>
            <span className="lrow__count">
              {plural(count, "peça", "peças")}
              {layer.locked ? " · travada" : ""}
              {!layer.visible ? " · oculta" : ""}
            </span>
          </span>
        </button>
        <div className="lrow__btns">
          <button
            type="button"
            className="iconbtn lrow__btn"
            aria-label={layer.visible ? `Ocultar a camada ${layer.name}` : `Mostrar a camada ${layer.name}`}
            aria-pressed={!layer.visible}
            onClick={() => ui.commit(setLayerFields(scene, layer.id, { visible: !layer.visible }))}
          >
            <Icon name={layer.visible ? "eye" : "eyeOff"} uid={`${uid}v`} />
          </button>
          <button
            type="button"
            className="iconbtn lrow__btn"
            aria-label={layer.locked ? `Destravar a camada ${layer.name}` : `Travar a camada ${layer.name}`}
            aria-pressed={layer.locked}
            onClick={() => ui.commit(setLayerFields(scene, layer.id, { locked: !layer.locked }))}
          >
            <Icon name={layer.locked ? "lock" : "unlock"} uid={`${uid}l`} />
          </button>
          <button
            type="button"
            className="iconbtn lrow__btn"
            aria-label={`Editar a camada ${layer.name}`}
            aria-expanded={open}
            onClick={onOpen}
          >
            <Icon name="pencil" uid={`${uid}e`} />
          </button>
          <button
            type="button"
            className="iconbtn lrow__btn lrow__grip"
            aria-label={`Arrastar para reordenar a camada ${layer.name}`}
            onPointerDown={onGrip}
          >
            <Icon name="grip" uid={`${uid}g`} />
          </button>
        </div>
      </div>
      {open && (
        <div className="lrow__edit">
          <div className="nfield">
            <label className="nfield__label" htmlFor={`${uid}n`}>
              Nome
            </label>
            <div className="nfield__row">
              <input
                id={`${uid}n`}
                className="nfield__input"
                value={name}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  const t = name.trim();
                  setDraft(null);
                  if (t && t !== layer.name) ui.commit(setLayerFields(scene, layer.id, { name: t }));
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
            </div>
          </div>
          <NumberField
            label="Espessura"
            unit="mm"
            value={layer.thickness}
            note="Entra na massa das peças desta camada"
            onCommit={(v) => {
              if (!(v > 0)) return "A espessura precisa ser maior que zero";
              ui.commit(setLayerFields(scene, layer.id, { thickness: v }));
              return null;
            }}
          />
          {confirm ? (
            <div className="lrow__confirm" role="alert">
              <p>
                Excluir a camada {layer.name}
                {count ? ` e ${count === 1 ? "a peça dela" : `as ${count} peças dela`}` : ""}?
              </p>
              <div className="card__row">
                <button
                  type="button"
                  className="btn btn--outline btn--danger btn--small"
                  onClick={() => {
                    setConfirm(false);
                    ui.commit(deleteLayer(scene, layer.id), {
                      activeLayer: Math.min(ui.activeLayer, model.layers.length - 2),
                    });
                  }}
                >
                  Excluir
                </button>
                <button
                  type="button"
                  className="btn btn--outline btn--small"
                  onClick={() => setConfirm(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn--outline btn--danger btn--small"
              disabled={model.layers.length <= 1}
              onClick={() => setConfirm(true)}
            >
              <Icon name="trash" uid={`${uid}t`} size={20} />
              Excluir camada
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function LayerStack({ model }: { model: SceneModel }) {
  const uid = useId();
  const ui = useUiStore();
  const [open, setOpen] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ index: number; dy: number } | null>(null);
  const start = useRef(0);
  const n = model.layers.length;
  // do topo para o fundo: a ordem visual é o array invertido
  const order = model.layers.map((_, i) => n - 1 - i);

  const onGrip = (index: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    start.current = e.clientY;
    setDrag({ index, dy: 0 });
    const move = (ev: PointerEvent) => setDrag({ index, dy: ev.clientY - start.current });
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const dy = ev.clientY - start.current;
      setDrag(null);
      if (ev.type !== "pointerup") return;
      // para baixo na lista = para o fundo (índice menor)
      const to = Math.max(0, Math.min(n - 1, index - Math.round(dy / ROW_H)));
      const s = useUiStore.getState();
      const scene = s.current?.scene;
      if (!scene || to === index) return;
      const act = s.activeLayer;
      const nextActive =
        act === index ? to : act > index && act <= to ? act - 1 : act < index && act >= to ? act + 1 : act;
      s.commit(moveLayer(scene, index, to), { activeLayer: nextActive });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <div className="lstack">
      <button
        type="button"
        className="btn btn--outline lstack__new"
        disabled={n >= 16}
        onClick={newLayerAction}
      >
        <Icon name="layerAdd" uid={`${uid}n`} size={20} />
        Nova camada
      </button>
      <ol className="lstack__list" aria-label="Camadas, do topo para o fundo">
        {order.map((i) => {
          const id = model.layers[i]?.layer.id ?? String(i);
          return (
            <Row
              key={id}
              model={model}
              index={i}
              open={open === id}
              onOpen={() => setOpen(open === id ? null : id)}
              onGrip={onGrip(i)}
              offset={drag?.index === i ? drag.dy : 0}
            />
          );
        })}
      </ol>
      <p className="lstack__note">
        A camada 1 é o fundo: peça nova nela entra fixa. Peças só se tocam dentro da mesma camada.
        {ui.xray ? " Raio-x ligado." : ""}
      </p>
    </div>
  );
}
