import { tryComparison } from "../instruments/tryComparison";
import { useComparison } from "../instruments/comparison";
import { instrumentPreset } from "@/instruments/presets";
import { useId } from "react";
import { useUiStore } from "@/editor/useUiStore";
import { DEFAULT_SPEED, REAL_NOTICE, SPEEDS, speedMode, type Speed } from "@/sim/pacing";
import { Icon } from "../icons";
import { useSimStore } from "./simStore";
import { firstRealChoice } from "./speed";

/** Nome e, menor embaixo, a fração do tempo real. */
function SpeedLabel({ speed }: { speed: number }) {
  const m = speedMode(speed);
  return (
    <>
      <span className="simctl__speedname">{m.name}</span>
      <span className="simctl__speedfrac">{m.frac}</span>
    </>
  );
}

function chooseSpeed(set: (s: Speed) => void, s: Speed): void {
  set(s);
  if (firstRealChoice(s)) useUiStore.getState().notify(REAL_NOTICE);
}

/**
 * Controles do Testar, na faixa de baixo junto com a régua: pausa, um
 * passo, velocidade (Lento 1/20, Normal ¼, Real 1×: um botão que troca
 * no celular; os três no computador) e reiniciar.
 */
export function SimControls() {
  const uid = useId();
  const comparing = useComparison((s) => s.request !== null);
  const scene = useUiStore((s) => s.current?.scene);
  const preset = scene ? instrumentPreset(scene) : [];
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
      <button
        type="button"
        className="simctl__speed simctl__cycle"
        aria-label={`Velocidade: ${speedMode(st.speed).name} (${speedMode(st.speed).frac} do tempo real); toque para trocar`}
        disabled={!ctl}
        onClick={() =>
          ctl &&
          chooseSpeed(
            (s) => ctl.setSpeed(s),
            SPEEDS[(SPEEDS.indexOf(st.speed) + 1) % SPEEDS.length] ?? DEFAULT_SPEED,
          )
        }
      >
        <SpeedLabel speed={st.speed} />
      </button>
      <div className="simctl__speeds" role="group" aria-label="Velocidade">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className="simctl__speed"
            aria-pressed={st.speed === s}
            aria-label={`${speedMode(s).name} (${speedMode(s).frac} do tempo real)`}
            disabled={!ctl}
            onClick={() => ctl && chooseSpeed((x) => ctl.setSpeed(x), s)}
          >
            <SpeedLabel speed={s} />
          </button>
        ))}
      </div>
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
      {preset.length > 0 && (
        <button
          className="btn btn--outline btn--small instruments-open"
          onClick={() => useUiStore.getState().setProbes(preset)}
        >
          Ver instrumentos
        </button>
      )}
      {preset.some((p) => p.id === "bolt-position") && !comparing && (
        <button className="btn btn--outline btn--small" onClick={tryComparison}>
          Experimente comparar
        </button>
      )}
      {st.status === "loading" && <span className="simctl__status">Carregando o motor…</span>}
      {st.status === "error" && <span className="simctl__status simctl__status--error">{st.error}</span>}
    </div>
  );
}
