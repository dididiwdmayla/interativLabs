import { useEffect, useId, useState } from "react";
import { partName, plural } from "@/editor/names";
import { useUiStore } from "@/editor/useUiStore";
import type { PartModel, SceneModel } from "@/render/prepare";
import { Icon } from "./icons";
import { ToolStrip } from "./ToolStrip";

/**
 * Peças escondidas (Parte E2d, "clique e esconda"): a pílula "N escondidas"
 * no canto, perto da pílula da camada, abre a lista com a miniatura e o nome
 * de cada uma; um toque traz de volta, "Mostrar todas" traz todas. Estado de
 * vista: fica com o projeto, fora da cena e do desfazer.
 */

/** Miniatura da peça: o contorno na pose desenhada, com a hachura do material em tom liso. */
function PartThumb({ m }: { m: PartModel }) {
  const xs = m.outline.flatMap((s) => s.outer.map((p) => p[0]));
  const ys = m.outline.flatMap((s) => s.outer.map((p) => p[1]));
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const w = Math.max(1, Math.max(...xs) - x0);
  const h = Math.max(1, Math.max(...ys) - y0);
  const pad = Math.max(w, h) * 0.08;
  return (
    <svg
      className="hiddenlist__thumb"
      width="40"
      height="32"
      viewBox={`${x0 - pad} ${y0 - pad} ${w + 2 * pad} ${h + 2 * pad}`}
      aria-hidden="true"
    >
      <g transform={`rotate(${(m.part.angle * 180) / Math.PI} ${x0 + w / 2} ${y0 + h / 2})`}>
        <path d={m.d} className="hiddenlist__shape" fillRule="evenodd" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

export function HiddenPill({ model }: { model: SceneModel }) {
  const uid = useId();
  const hidden = useUiStore((s) => s.hidden);
  const unhide = useUiStore((s) => s.unhide);
  const unhideAll = useUiStore((s) => s.unhideAll);
  const [open, setOpen] = useState(false);
  const list = hidden.map((id) => model.parts.get(id)).filter((m): m is PartModel => !!m);
  useEffect(() => {
    if (!list.length) setOpen(false);
  }, [list.length]);
  if (!list.length) return null;
  return (
    <div className="hiddenpill" data-keeps-sheet>
      {open && (
        <div className="hiddenlist" role="dialog" aria-label="Peças escondidas">
          <ul>
            {list.map((m) => (
              <li key={m.part.id}>
                <button
                  type="button"
                  className="hiddenlist__item"
                  aria-label={`Mostrar ${partName(m.part)}`}
                  onClick={() => unhide(m.part.id)}
                >
                  <PartThumb m={m} />
                  <span className="hiddenlist__ref">{m.part.ref}</span>
                  <span className="hiddenlist__name">{partName(m.part)}</span>
                  <Icon name="eye" uid={`${uid}${m.part.id}`} size={20} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn--outline btn--small hiddenlist__all" onClick={unhideAll}>
            Mostrar todas
          </button>
        </div>
      )}
      <button
        type="button"
        className="pill hiddenpill__btn"
        aria-expanded={open}
        aria-label={`${plural(list.length, "peça escondida", "peças escondidas")}: abrir a lista`}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="hide" uid={`${uid}i`} size={20} />
        <span className="pill__num">{list.length}</span>
        <span className="pill__name">{list.length === 1 ? "escondida" : "escondidas"}</span>
      </button>
    </div>
  );
}

/** Faixa do modo "Esconder peças": a frase, "Mostrar todas" e "Pronto". */
export function HideBar() {
  const mode = useUiStore((s) => s.mode);
  const count = useUiStore((s) => s.hidden.length);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") useUiStore.getState().setHideMode(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <ToolStrip
      label="Esconder peças"
      mode="cycle"
      edge={mode === "simulate" ? "top" : "bottom"}
      phrase={
        count
          ? `Toque numa peça para escondê-la · ${plural(count, "escondida", "escondidas")}`
          : "Toque numa peça para escondê-la e ver o que está atrás"
      }
      groups={[]}
      actions={[
        {
          id: "all",
          label: "Mostrar todas",
          disabled: count === 0,
          onClick: () => useUiStore.getState().unhideAll(),
        },
        {
          id: "done",
          label: "Pronto",
          pressed: true,
          onClick: () => useUiStore.getState().setHideMode(false),
        },
      ]}
    />
  );
}
