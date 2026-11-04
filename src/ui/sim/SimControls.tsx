import { useId } from "react";
import { Icon } from "../icons";
import { SPEEDS, useSimStore } from "./simStore";

const speedLabel = (s: number) => `${String(s).replace(".", ",")}×`;

/**
 * Controles do Simular, no lugar das ferramentas (barra de baixo no
 * celular, trilho no computador): pausa, um passo, câmera lenta e reiniciar.
 */
export function SimControls() {
  const uid = useId();
  const st = useSimStore();
  const ctl = st.ctl;
  const off = !ctl || st.recalculating;
  return (
    <div className="simctl" role="group" aria-label="Simulação">
      <button
        type="button"
        className="tool"
        aria-label={st.paused ? "Continuar" : "Pausar"}
        title={st.paused ? "Continuar" : "Pausar"}
        disabled={off}
        onClick={() => ctl?.togglePause()}
      >
        <Icon name={st.paused ? "play" : "pause"} uid={`${uid}p`} />
      </button>
      <button
        type="button"
        className="tool"
        aria-label="Avançar um passo"
        title="Avançar um passo (1/240 s)"
        disabled={off}
        onClick={() => ctl?.stepOnce()}
      >
        <Icon name="step" uid={`${uid}s`} />
      </button>
      <span className="toolbar__sep" aria-hidden="true" />
      <div className="simctl__speeds" role="group" aria-label="Velocidade">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className="simctl__speed"
            aria-pressed={st.speed === s}
            disabled={!ctl}
            onClick={() => ctl?.setSpeed(s)}
          >
            {speedLabel(s)}
          </button>
        ))}
      </div>
      <span className="toolbar__sep" aria-hidden="true" />
      <button
        type="button"
        className="tool"
        aria-label="Reiniciar"
        title="Reiniciar"
        disabled={off}
        onClick={() => ctl?.restart()}
      >
        <Icon name="restart" uid={`${uid}r`} />
      </button>
      {st.status === "loading" && <span className="simctl__status">Carregando o motor…</span>}
      {st.status === "error" && <span className="simctl__status simctl__status--error">{st.error}</span>}
    </div>
  );
}
