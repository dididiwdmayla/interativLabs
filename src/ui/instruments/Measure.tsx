import { useState } from "react";
import { useUiStore } from "@/editor/useUiStore";
import { available, noReadingReason, quantities } from "@/instruments/model";
import type { LinkKind } from "@/model/types";
import { addProbe } from "./actions";
import "./instruments.css";
export function Measure({
  target,
  name,
  kind,
  limit,
}: {
  target: string;
  name: string;
  kind: LinkKind | "part";
  limit?: number;
}) {
  const [open, setOpen] = useState(false);
  const ui = useUiStore();
  const options = available(kind);
  const reason = kind === "part" ? undefined : noReadingReason[kind];
  if (!options.length && !reason) return null;
  if (!options.length)
    return (
      <section className="card__sec measure">
        <p className="measure__note">{reason}</p>
      </section>
    );
  return (
    <section className="card__sec measure">
      <button className="btn btn--outline btn--small" aria-expanded={open} onClick={() => setOpen(!open)}>
        Medir
      </button>
      {open && (
        <div className="measure__chips">
          {options.map((q) => (
            <button
              key={q}
              className="btn btn--outline btn--small"
              aria-pressed={ui.probes.some((p) => p.target === target && p.quantity === q)}
              onClick={() => addProbe(target, q, name, undefined, q === "force" ? limit : undefined)}
            >
              {quantities[q][0]} <small>{quantities[q][1]}</small>
            </button>
          ))}
        </div>
      )}
      {kind === "part" && (
        <button
          className="btn btn--outline btn--small"
          onClick={() => {
            ui.setGapTarget(target);
            ui.setSheet(null);
            ui.select(null);
            ui.setPencil(false);
            ui.setHammer(null);
            ui.notify("Toque na outra peça da mesma camada para medir a folga");
          }}
        >
          Folga com…
        </button>
      )}
    </section>
  );
}
