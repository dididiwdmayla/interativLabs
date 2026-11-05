import { useId, useState } from "react";
import { fmt, parseNum } from "./format";
import { Icon } from "../icons";

interface NumberFieldProps {
  label: string;
  value: number;
  unit?: string;
  digits?: number;
  /** devolve a mensagem de erro, ou null quando aceitou */
  onCommit?: (v: number) => string | null;
  readOnly?: boolean;
  note?: string;
}

/**
 * Campo numérico da identidade: rótulo em Old Standard TT caixa alta, valor
 * em Archivo tabular, unidade em ink-2, linha de base que fica ouro no foco.
 * Confirma ao sair do campo ou com Enter; o erro aparece embaixo, em português.
 */
export function NumberField({ label, value, unit, digits = 2, onCommit, readOnly, note }: NumberFieldProps) {
  const id = useId();
  // rascunho só enquanto a pessoa escreve; fora disso, mostra o valor da cena
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const text = draft ?? fmt(value, digits);
  const setText = (t: string) => setDraft(t);
  const commit = () => {
    setDraft(null);
    if (readOnly || !onCommit) return;
    const v = parseNum(text);
    if (!Number.isFinite(v)) {
      setError("Escreva um número");
      return;
    }
    setError(onCommit(v));
  };
  return (
    <div className={`nfield${error ? " has-error" : ""}${readOnly ? " is-readonly" : ""}`}>
      <label className="nfield__label" htmlFor={id}>
        {label}
      </label>
      <div className="nfield__row">
        <input
          id={id}
          className="nfield__input"
          inputMode="decimal"
          value={text}
          readOnly={readOnly}
          onFocus={() => setDraft(text)}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setDraft(null);
              setError(null);
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || note ? `${id}m` : undefined}
        />
        {unit && <span className="nfield__unit">{unit}</span>}
      </div>
      {(error || note) && (
        <p className={error ? "nfield__error" : "nfield__note"} id={`${id}m`}>
          {error ?? note}
        </p>
      )}
    </div>
  );
}

interface StepperProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  integer?: boolean;
  onChange: (v: number) => void;
}

/** Tamanho no cartão rápido: − e + grandes, o valor e um deslizante. */
export function Stepper({ label, value, unit, min, max, step, integer, onChange }: StepperProps) {
  const uid = useId();
  const clamp = (v: number) => Math.min(max, Math.max(min, integer ? Math.round(v) : v));
  const big = integer ? 1 : step;
  return (
    <div className="stepper">
      <span className="stepper__label" id={`${uid}l`}>
        {label}
      </span>
      <div className="stepper__row">
        <button
          type="button"
          className="tool stepper__btn"
          aria-label={`Diminuir ${label.toLocaleLowerCase("pt-BR")}`}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - big))}
        >
          <Icon name="minus" uid={`${uid}m`} />
        </button>
        <output className="stepper__value" aria-labelledby={`${uid}l`}>
          {fmt(value, integer ? 0 : 1)}
          {unit && <span className="stepper__unit"> {unit}</span>}
        </output>
        <button
          type="button"
          className="tool stepper__btn"
          aria-label={`Aumentar ${label.toLocaleLowerCase("pt-BR")}`}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + big))}
        >
          <Icon name="plus" uid={`${uid}p`} />
        </button>
      </div>
      <input
        type="range"
        className="stepper__range"
        min={min}
        max={max}
        step={integer ? 1 : step}
        value={value}
        aria-labelledby={`${uid}l`}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
    </div>
  );
}
