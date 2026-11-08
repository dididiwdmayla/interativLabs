import { compareVariants } from "./instruments/comparison";
import { useState } from "react";
import { useUiStore } from "@/editor/useUiStore";
import "./variants.css";
export function VariantMenu() {
  const ui = useUiStore();
  const [pair, setPair] = useState(false);
  const [first, setFirst] = useState("A");
  const [second, setSecond] = useState("B");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <div className="variants">
      <button
        className="btn btn--outline btn--small"
        aria-expanded={open}
        aria-label="Variantes"
        onClick={() => {
          setOpen(!open);
          setName(ui.variants.find((v) => v.id === ui.activeVariant)?.name ?? "");
        }}
      >
        {ui.activeVariant} ▾
      </button>
      {open && (
        <div className="variants__menu">
          {ui.variants.map((v) => (
            <button
              key={v.id}
              className="btn btn--outline btn--small"
              aria-pressed={v.id === ui.activeVariant}
              onClick={() => {
                ui.switchVariant(v.id);
                setOpen(false);
              }}
            >
              {v.id} · {v.name}
            </button>
          ))}
          <button
            className="btn btn--outline btn--small"
            disabled={ui.variants.length >= 4}
            onClick={() => {
              ui.createVariant();
              setOpen(false);
            }}
          >
            Nova variante
          </button>
          <button
            className="btn btn--outline btn--small"
            disabled={ui.variants.length < 2}
            onClick={() => {
              setFirst(ui.activeVariant);
              setSecond(ui.variants.find((v) => v.id !== ui.activeVariant)?.id ?? "B");
              setPair(!pair);
            }}
          >
            Comparar
          </button>
          {pair && (
            <div>
              <label>
                Primeira{" "}
                <select
                  aria-label="Primeira variante"
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                >
                  {ui.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id} · {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Segunda{" "}
                <select
                  aria-label="Segunda variante"
                  value={second}
                  onChange={(e) => setSecond(e.target.value)}
                >
                  {ui.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id} · {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn btn--outline btn--small"
                disabled={first === second}
                onClick={() => {
                  compareVariants(first, second);
                  setOpen(false);
                }}
              >
                Iniciar comparação
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ui.renameVariant(ui.activeVariant, name);
              setOpen(false);
            }}
          >
            <input
              aria-label="Nome da variante"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
            <button className="btn btn--outline btn--small">Renomear</button>
          </form>
          <button
            className="btn btn--outline btn--small"
            disabled={ui.activeVariant === "A"}
            onClick={() => {
              ui.deleteVariant(ui.activeVariant);
              setOpen(false);
            }}
          >
            Apagar variante
          </button>
        </div>
      )}
    </div>
  );
}
