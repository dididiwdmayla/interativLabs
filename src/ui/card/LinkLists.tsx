import type { Link, SensorAction } from "@/model/types";
import type { SceneModel } from "@/render/prepare";
import { useUiStore } from "@/editor/useUiStore";
import { linkName, partName } from "@/editor/names";
import { NumberField } from "./fields";
import { applyLink } from "./applyLink";

const ACTIONS: [SensorAction["do"], string][] = [
  ["ignite", "Acender carga"],
  ["open", "Abrir respiro"],
  ["close", "Fechar respiro"],
  ["release", "Soltar trava"],
];
function save(link: Link, key: string) {
  const error = applyLink(link, key);
  if (error) useUiStore.getState().notify(error, { warn: true });
}
export function LinkLists({ model, link: l }: { model: SceneModel; link: Link }) {
  const ui = useUiStore();
  const targetName = (id: string) => {
    const target = model.linkById.get(id)?.link;
    return target ? linkName(target) : id;
  };
  const name = (id: string) => {
    const p = model.parts.get(id)?.part;
    return p ? partName(p) : id;
  };
  if (l.kind === "chamber")
    return (
      <>
        <section className="card__sec" aria-label="Paredes">
          <h3 className="card__k">Paredes</h3>
          {l.walls.map((w, i) => (
            <div className="linkentry" key={w.part}>
              <span>{name(w.part)}</span>
              <button
                type="button"
                className="btn btn--outline"
                disabled={l.walls.length === 1}
                title={l.walls.length === 1 ? "A câmara precisa de pelo menos uma parede" : undefined}
                onClick={() => save({ ...l, walls: l.walls.filter((_, j) => j !== i) }, `wall-${i}`)}
              >
                Tirar parede {i + 1}
              </button>
              <NumberField
                label={`Vedação da parede ${i + 1}`}
                value={w.seal}
                unit="mm"
                onCommit={(v) =>
                  applyLink(
                    { ...l, walls: l.walls.map((x, j) => (j === i ? { ...x, seal: v } : x)) },
                    `wall-${i}`,
                  )
                }
              />
            </div>
          ))}
          <button
            type="button"
            className="btn btn--outline"
            disabled={l.walls.length >= 2}
            title={l.walls.length >= 2 ? "A câmara admite até duas paredes" : undefined}
            onClick={() => ui.setPick({ kind: "wall", link: l.id })}
          >
            Tocar para acrescentar parede
          </button>
        </section>
        <section className="card__sec" aria-label="Respiros">
          <h3 className="card__k">Respiros</h3>
          {l.vents.map((v, i) => (
            <div className="linkentry" key={i}>
              <label className="checkfield">
                <input
                  type="checkbox"
                  checked={v.open}
                  onChange={(e) =>
                    save(
                      {
                        ...l,
                        vents: l.vents.map((x, j) => (j === i ? { ...x, open: e.target.checked } : x)),
                      },
                      `vent-${i}`,
                    )
                  }
                />
                Respiro {i + 1} aberto
              </label>
              <NumberField
                label={`Diâmetro do respiro ${i + 1}`}
                value={v.d}
                unit="mm"
                onCommit={(d) =>
                  applyLink({ ...l, vents: l.vents.map((x, j) => (j === i ? { ...x, d } : x)) }, `vent-${i}`)
                }
              />
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => {
                  const scene = ui.current?.scene;
                  if (!scene) return;
                  ui.commit({
                    label: `Tirar respiro ${i + 1}`,
                    recipe: (d) => {
                      const c = d.links.find((x) => x.id === l.id);
                      if (c?.kind !== "chamber") return;
                      c.vents.splice(i, 1);
                      for (const sensor of d.links)
                        if (sensor.kind === "sensor")
                          sensor.actions = sensor.actions
                            .filter((a) => !(a.target === l.id && a.vent === i))
                            .map((a) =>
                              a.target === l.id && a.vent !== undefined && a.vent > i
                                ? { ...a, vent: a.vent - 1 }
                                : a,
                            );
                    },
                  });
                }}
              >
                Tirar respiro {i + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => ui.setPick({ kind: "vent", link: l.id })}
          >
            Tocar para acrescentar respiro
          </button>
        </section>
        <section className="card__sec" aria-label="Portas">
          <h3 className="card__k">Portas</h3>
          {l.ports.map((p, i) => (
            <div className="linkentry" key={i}>
              <span>{targetName(p.to)}</span>
              <NumberField
                label={`Diâmetro da porta ${i + 1}`}
                value={p.d}
                unit="mm"
                onCommit={(d) =>
                  applyLink({ ...l, ports: l.ports.map((x, j) => (j === i ? { ...x, d } : x)) }, `port-${i}`)
                }
              />
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => save({ ...l, ports: l.ports.filter((_, j) => j !== i) }, `port-${i}`)}
              >
                Tirar porta {i + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => ui.setPick({ kind: "port", link: l.id })}
          >
            Tocar em outra câmara
          </button>
        </section>
      </>
    );
  if (l.kind === "sensor")
    return (
      <section className="card__sec" aria-label="Ações do sensor">
        <h3 className="card__k">Ações do sensor</h3>
        {l.actions.map((a, i) => {
          const target = model.linkById.get(a.target)?.link;
          return (
            <div className="linkentry" key={i}>
              <span>
                {ACTIONS.find(([key]) => key === a.do)?.[1]} · {target ? linkName(target) : a.target}
                {a.vent === undefined ? "" : ` · respiro ${a.vent + 1}`}
              </span>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => save({ ...l, actions: l.actions.filter((_, j) => j !== i) }, `action-${i}`)}
              >
                Tirar ação {i + 1}
              </button>
            </div>
          );
        })}
        <div className="linkpresets">
          {ACTIONS.map(([action, label]) => (
            <button
              type="button"
              className="btn btn--outline"
              key={action}
              onClick={() => ui.setPick({ kind: "action", link: l.id, action })}
            >
              {label}: tocar no alvo
            </button>
          ))}
        </div>
        <NumberField
          label="Impacto mínimo"
          unit="mm/s"
          value={l.minSpeed}
          onCommit={(v) => applyLink({ ...l, minSpeed: v }, "minSpeed")}
        />
      </section>
    );
  return null;
}
