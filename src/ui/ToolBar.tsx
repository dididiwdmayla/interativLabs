import { Fragment, useId } from "react";
import { TOOL_GROUPS } from "@/editor/tools";
import { useUiStore } from "@/editor/useUiStore";
import { Icon } from "./icons";
import { ModeButton } from "./ModeButton";
import { SimControls } from "./sim/SimControls";

/**
 * Barra de ferramentas: embaixo no celular (faixa rolável + Simular fixo
 * na ponta), trilho vertical à esquerda no computador. No Simular, os
 * controles da simulação ocupam o mesmo lugar.
 */
export function ToolBar() {
  const uid = useId();
  const tool = useUiStore((s) => s.tool);
  const setTool = useUiStore((s) => s.setTool);
  const mode = useUiStore((s) => s.mode);
  return (
    <nav className="toolbar" aria-label={mode === "edit" ? "Ferramentas" : "Simulação"} data-mode={mode}>
      <div className="toolbar__scroll">
        {mode === "simulate" ? (
          <SimControls />
        ) : (
          TOOL_GROUPS.map((g, gi) => (
            <Fragment key={g.id}>
              {gi > 0 && <span className="toolbar__sep" aria-hidden="true" />}
              <div className="toolbar__group" role="group" aria-label={g.label}>
                {g.tools.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="tool"
                    aria-pressed={tool === t.id}
                    aria-label={t.label}
                    title={t.label}
                    onClick={() => setTool(t.id)}
                  >
                    <Icon name={t.id} uid={`${uid}${t.id}`} />
                  </button>
                ))}
              </div>
            </Fragment>
          ))
        )}
      </div>
      <div className="toolbar__end only-mobile">
        <ModeButton />
      </div>
    </nav>
  );
}
