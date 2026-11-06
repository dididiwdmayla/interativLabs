import { useState } from "react";
import {
  extendProfile,
  mergeCandidates,
  mergeProfiles,
  removeProfile,
  separateProfile,
  type ProfileForm,
} from "@/editor/profileCommands";
import { useUiStore } from "@/editor/useUiStore";
import { surfaces } from "@/model/profiles";
import type { Part, Scene } from "@/model/types";

export function PartLayers({ scene, part, layer }: { scene: Scene; part: Part; layer: string }) {
  const ui = useUiStore(),
    [expanding, setExpanding] = useState(false),
    [target, setTarget] = useState("above"),
    [form, setForm] = useState<ProfileForm>("copy");
  const occupied = surfaces(part),
    merge = mergeCandidates(scene, part.id);
  return (
    <section className="card__sec linkquick" aria-label="Camadas desta peça">
      <h3 className="card__k">Camadas desta peça</h3>
      <div className="linkpresets">
        {scene.layers.map(
          (l, i) =>
            occupied.some((s) => s.layer === l.id) && (
              <button
                type="button"
                className="btn btn--outline"
                aria-pressed={l.id === layer}
                key={l.id}
                onClick={() => ui.setActiveLayer(i)}
              >
                {i + 1} · {l.name}
              </button>
            ),
        )}
      </div>
      <button
        type="button"
        className="btn btn--outline"
        aria-expanded={expanding}
        onClick={() => setExpanding(!expanding)}
      >
        Estender para outra camada
      </button>
      {expanding && (
        <>
          <label className="nfield">
            <span className="nfield__label">Camada de destino</span>
            <select
              className="nfield__select"
              aria-label="Camada de destino"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="above" disabled={scene.layers.length >= 16}>
                Nova acima
              </option>
              <option value="below" disabled={scene.layers.length >= 16}>
                Nova abaixo
              </option>
              {scene.layers
                .filter((l) => !occupied.some((s) => s.layer === l.id))
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {scene.layers.indexOf(l) + 1} · {l.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="nfield">
            <span className="nfield__label">Forma do perfil</span>
            <select
              className="nfield__select"
              aria-label="Forma do perfil"
              value={form}
              onChange={(e) => setForm(e.target.value as ProfileForm)}
            >
              {(
                [
                  ["copy", "Cópia desta"],
                  ["disc", "Disco"],
                  ["gear", "Engrenagem"],
                  ["ratchet", "Catraca"],
                  ["cam", "Came"],
                  ["lever", "Alavanca"],
                ] as const
              ).map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => {
              const result = extendProfile(scene, part.id, layer, target, form);
              if (!result) {
                ui.notify("Escolha uma camada livre para este perfil", { warn: true });
                return;
              }
              if (ui.commit(result.command)) {
                ui.setActiveLayer(
                  useUiStore.getState().current?.scene.layers.findIndex((l) => l.id === result.layer) ?? 0,
                );
                setExpanding(false);
              }
            }}
          >
            Criar perfil
          </button>
        </>
      )}
      {occupied.length > 1 && (
        <div className="linkpresets">
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => {
              ui.commit(removeProfile(scene, part.id, layer));
              const p = useUiStore.getState().current?.scene.parts.find((p) => p.id === part.id);
              if (!p) return;
              ui.setActiveLayer(scene.layers.findIndex((l) => l.id === p.layer));
            }}
          >
            Tirar desta camada
          </button>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => {
              const result = separateProfile(scene, part.id, layer);
              if (result) ui.commit(result.command, { selection: { kind: "part", id: result.newId } });
            }}
          >
            Separar em peça
          </button>
        </div>
      )}
      <button
        type="button"
        className="btn btn--outline"
        disabled={!!merge.reason}
        title={merge.reason}
        onClick={() => ui.commit(mergeProfiles(scene, part.id))}
      >
        Fundir peças aparafusadas
      </button>
      {merge.reason && <p className="card__empty">{merge.reason}</p>}
    </section>
  );
}
