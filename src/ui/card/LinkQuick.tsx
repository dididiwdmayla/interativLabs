import { elasticPreset, frictionPreset, switchLink } from "@/editor/presetActions";
import { effective, MOUNT_HZ, SPRING_HZ } from "@/editor/linkPresets";
import { useUiStore } from "@/editor/useUiStore";
import { LINK_LABEL } from "@/editor/names";
import type { Link, LinkKind, Scene } from "@/model/types";
import { N } from "@/model/units";
import { worldOf } from "@/render/prepare";
import { NumberField, Stepper } from "./fields";
import { applyLink } from "./applyLink";

const STRENGTH: [string, string][] = [
  ["soft", "Macia"],
  ["medium", "Média"],
  ["hard", "Dura"],
];
function Options({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value?: string;
  items: [string, string][];
  onChange: (key: string) => void;
}) {
  return (
    <div className="card__sec">
      <h3 className="card__k">{label}</h3>
      <div className="linkpresets" role="group" aria-label={label}>
        {items.map(([key, name]) => (
          <button
            type="button"
            key={key}
            className="btn btn--outline"
            aria-pressed={value === key}
            onClick={() => onChange(key)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
function save(link: Link, key: string) {
  const err = applyLink(link, key);
  if (err) useUiStore.getState().notify(err, { warn: true });
}
function strength(scene: Scene, link: Link): string | undefined {
  if (link.kind !== "spring" && link.kind !== "axle" && link.kind !== "slider") return undefined;
  const k = link.kind === "spring" ? link.k : link.kind === "axle" ? link.torsion?.k : link.spring?.k;
  if (k === undefined) return "none";
  const at =
    link.kind === "axle"
      ? worldOf(
          scene.parts.find((p) => p.id === link.b),
          link.at,
        )
      : undefined;
  const mass = effective(scene, link.a, link.b, link.kind === "axle", at, link.id);
  const hz = Math.sqrt((k * N) / mass) / (2 * Math.PI);
  return Object.entries(SPRING_HZ).find(([, f]) => Math.abs(f - hz) < 0.01)?.[0];
}

function frictionLevel(scene: Scene, link: Link): string | undefined {
  if (link.kind !== "axle" && link.kind !== "slider") return undefined;
  if (!link.friction) return "none";
  for (const key of ["low", "high"] as const) {
    const preset = frictionPreset(scene, link, key);
    if (
      (preset.kind === "axle" || preset.kind === "slider") &&
      Math.abs((preset.friction ?? 0) - link.friction) < 1e-8
    )
      return key;
  }
  return undefined;
}

export function LinkQuick({ scene, link: l }: { scene: Scene; link: Link }) {
  const ui = useUiStore();
  const motor = l.kind === "axle" ? l.motor : undefined;
  const swap = (kind: string) => {
    const next = switchLink(scene, l, kind as LinkKind);
    if (next) save(next, "type");
  };
  const elastic = (key: string) => {
    if (key === "none") {
      if (l.kind === "axle") {
        const n = { ...l };
        delete n.torsion;
        save(n, "torsion");
      }
      if (l.kind === "slider") {
        const n = { ...l };
        delete n.spring;
        save(n, "return");
      }
    } else save(elasticPreset(scene, l, key as keyof typeof SPRING_HZ), "elastic");
  };
  const friction =
    l.kind === "axle" || l.kind === "slider" ? (
      <Options
        label="Atrito"
        value={frictionLevel(scene, l)}
        items={[
          ["none", "Sem"],
          ["low", "Pouco"],
          ["high", "Muito"],
        ]}
        onChange={(key) => save(frictionPreset(scene, l, key as "none" | "low" | "high"), "friction")}
      />
    ) : null;
  return (
    <section className="card__sec linkquick" aria-label="Predefinições">
      {(l.kind === "screw" || l.kind === "mount" || l.kind === "lock") && (
        <Options
          label="Fixação"
          value={l.kind}
          items={[
            ["screw", "Rígida"],
            ["mount", "Elástica"],
            ["lock", "Trava"],
          ]}
          onChange={swap}
        />
      )}
      {(l.kind === "rod" || l.kind === "cable" || l.kind === "spring") && (
        <Options
          label="Ligação"
          value={l.kind}
          items={(["rod", "cable", "spring"] as const).map((k) => [k, LINK_LABEL[k]])}
          onChange={swap}
        />
      )}
      {l.kind === "mount" && (
        <Options
          label="Suporte"
          value={l.linearHz === MOUNT_HZ.firm ? "firm" : l.linearHz === MOUNT_HZ.soft ? "soft" : undefined}
          items={[
            ["firm", "Firme"],
            ["soft", "Macio"],
          ]}
          onChange={(key) =>
            save(
              {
                ...l,
                linearHz: MOUNT_HZ[key as keyof typeof MOUNT_HZ],
                angularHz: MOUNT_HZ[key as keyof typeof MOUNT_HZ],
                damping: 0.1,
              },
              "mount",
            )
          }
        />
      )}
      {l.kind === "lock" && (
        <>
          <Options
            label="Soltar"
            value={l.breakForce === undefined ? "touch" : "fuse"}
            items={[
              ["touch", "Por toque"],
              ["sensor", "Por sensor"],
              ["fuse", "Fusível"],
            ]}
            onChange={(key) => {
              if (key === "sensor") {
                ui.setHammer("sensor");
                ui.notify("Ponha o sensor e toque nesta trava");
              } else if (key === "touch") {
                const n = { ...l };
                delete n.breakForce;
                save(n, "release");
              } else
                save(
                  {
                    ...l,
                    breakForce: Math.max(
                      0.001,
                      ((effective(scene, l.a, l.b, false, undefined, l.id) * scene.settings.gravity.g) / N) *
                        1.5,
                    ),
                  },
                  "release",
                );
            }}
          />
          {l.breakForce !== undefined && (
            <NumberField
              label="Força de soltura"
              unit="N"
              value={l.breakForce}
              digits={4}
              onCommit={(v) => applyLink({ ...l, breakForce: v }, "breakForce")}
            />
          )}
        </>
      )}
      {l.kind === "axle" && (
        <>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => {
              const n = { ...l };
              delete n.motor;
              delete n.torsion;
              delete n.friction;
              save(n, "free");
            }}
          >
            Eixo livre
          </button>
          {friction}
          <label className="checkfield">
            <input
              type="checkbox"
              checked={!!l.motor}
              onChange={(e) => {
                const n = { ...l };
                if (e.target.checked)
                  n.motor = {
                    speed: 2 * Math.PI,
                    maxTorque: Math.max(
                      0.01,
                      ((effective(scene, l.a, l.b, false, undefined, l.id) * scene.settings.gravity.g) / N) *
                        20,
                    ),
                  };
                else delete n.motor;
                save(n, "motor");
              }}
            />
            Com motor
          </label>
          {motor && (
            <>
              <Options
                label="Sentido"
                value={motor.speed >= 0 ? "cw" : "ccw"}
                items={[
                  ["cw", "Horário"],
                  ["ccw", "Anti-horário"],
                ]}
                onChange={(key) =>
                  save(
                    {
                      ...l,
                      motor: { ...motor, speed: Math.abs(motor.speed) * (key === "cw" ? 1 : -1) },
                    },
                    "motor.direction",
                  )
                }
              />
              <Stepper
                label="Velocidade"
                value={(Math.abs(motor.speed) * 60) / (2 * Math.PI)}
                unit="rpm"
                min={5}
                max={600}
                step={5}
                onChange={(v) =>
                  save(
                    {
                      ...l,
                      motor: { ...motor, speed: ((v * 2 * Math.PI) / 60) * (motor.speed < 0 ? -1 : 1) },
                    },
                    "motor.speed",
                  )
                }
              />
              <NumberField
                label="Força do motor"
                value={motor.maxTorque}
                unit="N·mm"
                onCommit={(v) => applyLink({ ...l, motor: { ...motor, maxTorque: v } }, "motor.force")}
              />
            </>
          )}
          <Options
            label="Mola de torção"
            value={strength(scene, l)}
            items={[["none", "Sem"], ...STRENGTH]}
            onChange={elastic}
          />
          <label className="checkfield">
            <input
              type="checkbox"
              checked={!!l.limit}
              onChange={(e) => {
                const n = { ...l };
                if (e.target.checked) n.limit = { lower: -Math.PI / 4, upper: Math.PI / 4 };
                else delete n.limit;
                save(n, "limit");
              }}
            />
            Batentes de ângulo · ajuste nas alças
          </label>
        </>
      )}
      {l.kind === "spring" && (
        <>
          <Options
            label="Modo da mola"
            value={l.mode}
            items={[
              ["fixed", "Presa"],
              ["seated", "Apoiada"],
              ["tension", "Só tração"],
            ]}
            onChange={(key) => save({ ...l, mode: key as typeof l.mode }, "mode")}
          />
          <Options label="Rigidez" value={strength(scene, l)} items={STRENGTH} onChange={elastic} />
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => ui.setPick({ kind: "guide", link: l.id })}
          >
            {l.guide ? "Trocar peça-guia" : "Tocar na peça-guia"}
          </button>
          {l.guide && (
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => {
                const n = { ...l };
                delete n.guide;
                save(n, "guide");
              }}
            >
              Sem guia
            </button>
          )}
          <NumberField
            label="Comprimento livre"
            unit="mm"
            value={l.freeLength}
            onCommit={(v) => applyLink({ ...l, freeLength: v }, "freeLength")}
          />
        </>
      )}
      {l.kind === "slider" && (
        <>
          <Options
            label="Mola de retorno"
            value={strength(scene, l)}
            items={[["none", "Sem"], ...STRENGTH]}
            onChange={elastic}
          />
          {friction}
          <p className="card__empty">Ajuste o curso pelas duas alças no palco.</p>
        </>
      )}
      {l.kind === "cable" && (
        <NumberField
          label="Comprimento máximo"
          unit="mm"
          value={l.maxLength}
          onCommit={(v) => applyLink({ ...l, maxLength: v }, "maxLength")}
        />
      )}
      {l.kind === "chamber" && (
        <Options
          label="A câmara"
          value={l.mode === "capsule" ? "capsule" : "charge"}
          items={[
            ["charge", "Carga própria"],
            ["capsule", "Recebe cápsula"],
          ]}
          onChange={(key) => {
            if (key === "capsule") {
              // sem carga nem paredes: a cápsula assentada traz as dela (a esfera e o fundo do estojo)
              const { charge: _charge, ...gas } = l.gas;
              void _charge;
              save(
                { ...l, mode: "capsule", seat: l.seat ?? 1, walls: [], vents: [], ports: [], gas },
                "mode",
              );
            } else if (l.walls.length) {
              const { mode: _m, seat: _s, ...rest } = l;
              void _m;
              void _s;
              save(rest, "mode");
            } else
              useUiStore
                .getState()
                .notify(
                  "Para voltar à carga própria, refaça a câmara com o Martelo (ela precisa de paredes)",
                  {
                    warn: true,
                  },
                );
          }}
        />
      )}
      {l.kind === "chamber" && l.mode === "capsule" && (
        <>
          <NumberField
            label="Assento"
            unit="mm"
            value={l.seat ?? 1}
            onCommit={(v) => applyLink({ ...l, seat: Math.max(0, v) }, "seat")}
          />
          <p className="card__empty">
            O fundo da cápsula a até esta distância do fundo da câmara conta como assentado: o furo continua
            pelo cano. Arraste a alça no palco.
          </p>
        </>
      )}
      {l.kind === "chamber" && l.mode !== "capsule" && (
        <>
          <Options
            label="Carga"
            value={
              l.gas.charge?.amount === 0.1
                ? "weak"
                : l.gas.charge?.amount === 0.5
                  ? "medium"
                  : l.gas.charge?.amount === 1.2
                    ? "strong"
                    : undefined
            }
            items={[
              ["weak", "Fraca"],
              ["medium", "Média"],
              ["strong", "Forte"],
            ]}
            onChange={(key) =>
              save(
                {
                  ...l,
                  gas: {
                    ...l.gas,
                    charge: {
                      amount: ({ weak: 0.1, medium: 0.5, strong: 1.2 } as Record<string, number>)[key] ?? 0.5,
                      burnMs: l.gas.charge?.burnMs ?? 1,
                      shots: l.gas.charge?.shots ?? 1,
                    },
                  },
                },
                "charge",
              )
            }
          />
          <Stepper
            label="Doses"
            value={l.gas.charge?.shots ?? 1}
            unit=""
            min={1}
            max={100}
            step={1}
            integer
            onChange={(v) =>
              save(
                {
                  ...l,
                  gas: {
                    ...l.gas,
                    charge: {
                      amount: l.gas.charge?.amount ?? 0.5,
                      burnMs: l.gas.charge?.burnMs ?? 1,
                      shots: v,
                    },
                  },
                },
                "shots",
              )
            }
          />
        </>
      )}
      {(l.kind === "sensor" || l.kind === "pin") && (
        <NumberField
          label="Raio"
          unit="mm"
          value={l.r}
          onCommit={(v) => applyLink({ ...l, r: v }, "radius")}
        />
      )}
      {(l.kind === "pin" || l.kind === "sensor") && (
        <div className="card__sec">
          <h3 className="card__k">Faixa de camadas</h3>
          {([0, 1] as const).map((index) => (
            <label key={index} className="nfield">
              <span className="nfield__label">{index === 0 ? "De" : "Até"}</span>
              <select
                className="nfield__select"
                aria-label={index === 0 ? "Camada inicial" : "Camada final"}
                value={l.layers[index]}
                onChange={(e) => {
                  const layers: [string, string] = [...l.layers];
                  layers[index] = e.target.value;
                  save({ ...l, layers }, `layers-${index}`);
                }}
              >
                {scene.layers.map((layer, i) => (
                  <option value={layer.id} key={layer.id}>
                    {i + 1} · {layer.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {l.kind === "slot" && (
        <Options
          label="Rasgo"
          value={l.mode}
          items={[
            ["joint", "Guia reta"],
            ["contact", "Contato"],
          ]}
          onChange={(key) => save({ ...l, mode: key as typeof l.mode }, "mode")}
        />
      )}
    </section>
  );
}
