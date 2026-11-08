import { useEffect, useId, useState } from "react";
import { setCapsuleCharge } from "@/editor/commands";
import { useUiStore } from "@/editor/useUiStore";
import type { Capsule, Part, Scene } from "@/model/types";
import { CAPSULE_CHARGES, CHARGE_LABELS } from "@/parts/capsule";
import { Icon } from "../icons";
import { useSimStore } from "../sim/simStore";
import { fmt } from "./format";

/**
 * A cápsula no cartão da peça (Fase 2 · M2a): a carga (fraca, média ou forte),
 * o estado (carregada ou deflagrada, no Testar, lido do quadro mostrado) e o
 * "O que é?".
 */
export function CapsuleSection({ scene, part }: { scene: Scene; part: Part & { capsule: Capsule } }) {
  const uid = useId();
  const ui = useUiStore();
  const c = part.capsule;
  const mode = useUiStore((s) => s.mode);
  const ctl = useSimStore((s) => s.ctl);
  const [fired, setFired] = useState<boolean | null>(null);
  // no Testar, o estado acompanha o quadro mostrado (a régua inclusive)
  useEffect(() => {
    if (mode !== "simulate" || !ctl) return;
    const read = () => setFired(ctl.capsuleFired(part.id));
    read();
    const t = window.setInterval(read, 200);
    return () => window.clearInterval(t);
  }, [mode, ctl, part.id]);
  const level = CAPSULE_CHARGES.findIndex((v) => Math.abs(v - c.charge) < 1e-9);
  const state =
    mode === "simulate" && fired !== null
      ? fired
        ? "Deflagrada"
        : "Carregada"
      : c.charge > 0
        ? "Carregada"
        : "Vazia";
  return (
    <section className="card__sec" aria-label="Cápsula">
      <h3 className="card__k">
        Cápsula · {state}
        {c.projectile === undefined ? " · sem esfera" : ""}
      </h3>
      <div className="linkpresets" role="group" aria-label="Carga">
        {CHARGE_LABELS.map((name, i) => (
          <button
            type="button"
            key={name}
            className="btn btn--outline"
            aria-pressed={level === i}
            disabled={mode === "simulate"}
            onClick={() => ui.commit(setCapsuleCharge(scene, part.id, CAPSULE_CHARGES[i] ?? c.charge, i))}
          >
            {name.charAt(0).toUpperCase() + name.slice(1)}
          </button>
        ))}
      </div>
      <p className="card__empty">
        Carga de {fmt(c.charge, 2)} mmol (gás didático) · dispara com um golpe na espoleta acima de{" "}
        {fmt(c.minStrike / 1000, 1)} m/s
      </p>
      <div className="card__acts">
        <button type="button" className="cardact" data-keeps-sheet onClick={() => ui.setExplain("capsule")}>
          <span className="cardact__icon">
            <Icon name="explain" uid={`${uid}x`} />
          </span>
          <span className="cardact__label">O que é?</span>
        </button>
      </div>
    </section>
  );
}
