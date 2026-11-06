import { useId } from "react";
import { useUiStore } from "@/editor/useUiStore";
import type { SceneModel } from "@/render/prepare";
import { Icon } from "./icons";
import { ModeButton } from "./ModeButton";

export const HINT_TEXT = "Toque numa peça para escolher · segure 1 s na borda para os menus";

/**
 * Os quatro cantos da prancha (docs/arquitetura.md §6, "Tela"): menu (☰)
 * em cima à esquerda, Montar / Testar em cima à direita, desfazer e refazer
 * embaixo à esquerda, a pílula da camada ativa embaixo à direita. Canhoto
 * troca os lados (por CSS, `data-lefty` na casca). No topo, o nome do
 * projeto e a dica curta, fora do desenho.
 */
export function Corners({ model, wide }: { model: SceneModel | null; wide: boolean }) {
  const uid = useId();
  const mode = useUiStore((s) => s.mode);
  const sheet = useUiStore((s) => s.sheet);
  const setSheet = useUiStore((s) => s.setSheet);
  const canUndo = useUiStore((s) => s.history.past.length > 0);
  const canRedo = useUiStore((s) => s.history.future.length > 0);
  const undo = useUiStore((s) => s.undo);
  const redo = useUiStore((s) => s.redo);
  const active = useUiStore((s) => s.activeLayer);
  const hint = useUiStore((s) => s.hint);
  const hammer = useUiStore((s) => s.hammer);
  const setHammer = useUiStore((s) => s.setHammer);
  const editing = mode === "edit";
  const layer = model?.layers[active]?.layer;
  const title = model?.scene.meta.title ?? "";
  return (
    <>
      <div className="corner corner--tl">
        <button
          type="button"
          className="iconbtn corner__btn"
          aria-label="Menu: projetos e exemplos"
          aria-expanded={sheet === "main"}
          data-keeps-sheet
          onClick={() => setSheet(sheet === "main" ? null : "main")}
        >
          <Icon name="menu" uid={`${uid}m`} />
        </button>
      </div>
      <div className="corner corner--tr">
        <ModeButton />
      </div>
      <div className="corner corner--top" aria-live="polite">
        <h1 className="corner__title" title={title}>
          {title}
        </h1>
        {editing && hint && <p className="corner__hint">{HINT_TEXT}</p>}
      </div>
      {editing && (
        <div className="corner corner--bl">
          <button
            type="button"
            className="iconbtn corner__btn"
            aria-label="Desfazer"
            title="Desfazer (Ctrl+Z · toque com dois dedos)"
            disabled={!canUndo}
            onClick={undo}
          >
            <Icon name="undo" uid={`${uid}u`} />
          </button>
          <button
            type="button"
            className="iconbtn corner__btn"
            aria-label="Refazer"
            title="Refazer (Ctrl+Shift+Z · toque com três dedos)"
            disabled={!canRedo}
            onClick={redo}
          >
            <Icon name="redo" uid={`${uid}r`} />
          </button>
          <button
            type="button"
            className="iconbtn corner__btn hammerbutton"
            aria-label="Martelo"
            aria-pressed={hammer !== null}
            onClick={() => setHammer(hammer ? null : "axle")}
          >
            <Icon name="hammer" uid={`${uid}h`} />
          </button>
        </div>
      )}
      {editing && !wide && layer && (
        <div className="corner corner--br">
          <button
            type="button"
            className="pill"
            aria-label={`Camada ativa: ${active + 1}, ${layer.name}. Abrir a pilha de camadas`}
            aria-expanded={sheet === "layers"}
            data-keeps-sheet
            onClick={() => setSheet(sheet === "layers" ? null : "layers")}
          >
            <span className="pill__plates" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="pill__num">{active + 1}</span>
            <span className="pill__name">{layer.name}</span>
          </button>
        </div>
      )}
    </>
  );
}
