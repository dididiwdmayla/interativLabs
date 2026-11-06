import { hammerStack } from "@/editor/hammer";
import { partName } from "@/editor/names";
import { useUiStore } from "@/editor/useUiStore";
import type { Link, Vec2 } from "@/model/types";
import { localOf, worldOf, type LinkModel, type SceneModel } from "@/render/prepare";
import { applyLink } from "./applyLink";
import { surfaces } from "@/model/profiles";

export function LinkPair({ model, lm }: { model: SceneModel; lm: LinkModel }) {
  const l = lm.link;
  if (l.kind === "slot") {
    const guides = hammerStack(model, lm.world, model.layers.length - 1, true);
    const current = model.parts.get(l.guide);
    if (current && !guides.some((m) => m.part.id === l.guide)) guides.push(current);
    const options = guides.flatMap((m) =>
      surfaces(m.part).flatMap((s) =>
        (s.shape.kind === "gear" ? [] : s.shape.holes).map((_, hole) => ({ part: m.part, surface: s, hole })),
      ),
    );
    const selected = `${l.guide}:${l.profile ?? l.guide}:${l.hole}`;
    return (
      <section className="card__sec">
        <h3 className="card__k">Liga</h3>
        <label className="nfield">
          <span className="nfield__label">Guia e furo</span>
          <select
            className="nfield__select"
            aria-label="Guia e furo"
            value={selected}
            onChange={(e) => {
              const option = options.find((o) => `${o.part.id}:${o.surface.id}:${o.hole}` === e.target.value);
              if (!option) return;
              const next = { ...l, guide: option.part.id, hole: option.hole };
              if (option.surface.id === option.part.id) delete next.profile;
              else next.profile = option.surface.id;
              const error = applyLink(next, "guide");
              if (error) useUiStore.getState().notify(error, { warn: true });
            }}
          >
            {options.map((o) => (
              <option
                key={`${o.part.id}:${o.surface.id}:${o.hole}`}
                value={`${o.part.id}:${o.surface.id}:${o.hole}`}
              >
                {partName(o.part)} · {model.scene.layers.findIndex((s) => s.id === o.surface.layer) + 1} ·
                furo {o.hole + 1}
              </option>
            ))}
          </select>
        </label>
        <p className="card__empty">Pino {model.linkById.get(l.pin)?.link.ref}</p>
      </section>
    );
  }
  const fields: {
    key: "a" | "b" | "body" | "host";
    label: string;
    id: string | null;
    point: Vec2;
    nullable: boolean;
  }[] = [];
  const two = l.kind === "spring" || l.kind === "rod" || l.kind === "cable";
  if (two) {
    fields.push(
      {
        key: "a",
        label: "Ponta A",
        id: l.a,
        point: worldOf(l.a ? model.drawn.get(l.a) : null, l.atA),
        nullable: true,
      },
      {
        key: "b",
        label: "Ponta B",
        id: l.b,
        point: worldOf(l.b ? model.drawn.get(l.b) : null, l.atB),
        nullable: true,
      },
    );
  } else if (l.kind === "chamber")
    fields.push({ key: "body", label: "Corpo", id: l.body, point: lm.world, nullable: true });
  else if (l.kind === "sensor" || l.kind === "pin")
    fields.push({ key: "host", label: "Hospedeiro", id: l.host, point: lm.world, nullable: false });
  else
    fields.push(
      { key: "a", label: "Peça A", id: l.a, point: lm.world, nullable: true },
      { key: "b", label: "Peça B", id: l.b, point: lm.world, nullable: false },
    );
  return (
    <section className="card__sec" aria-label="Trocar peças ligadas">
      <h3 className="card__k">Liga</h3>
      {fields.map((f) => {
        const options = hammerStack(model, f.point, model.layers.length - 1, true).map((m) => m.part);
        const current = f.id ? model.parts.get(f.id)?.part : undefined;
        if (current && !options.some((p) => p.id === current.id)) options.push(current);
        return (
          <label className="nfield" key={f.key}>
            <span className="nfield__label">{f.label}</span>
            <select
              className="nfield__select"
              aria-label={f.label}
              value={f.id ?? ""}
              onChange={(e) => {
                const id = e.target.value || null,
                  next: Link = structuredClone(l),
                  pose = id ? model.drawn.get(id) : null;
                if (next.kind === "spring" || next.kind === "rod" || next.kind === "cable") {
                  if (f.key === "a") {
                    next.a = id;
                    next.atA = localOf(pose, f.point);
                  } else {
                    next.b = id;
                    next.atB = localOf(pose, f.point);
                  }
                } else if (next.kind === "chamber") {
                  next.body = id;
                  next.at = localOf(pose, f.point);
                  next.dir +=
                    ((l.kind === "chamber" && l.body ? model.drawn.get(l.body)?.angle : 0) ?? 0) -
                    (pose?.angle ?? 0);
                } else if (next.kind === "pin" || next.kind === "sensor") {
                  if (!id) return;
                  next.host = id;
                  next.at = localOf(pose, f.point);
                } else {
                  if (f.key === "a") next.a = id;
                  else {
                    if (!id) return;
                    next.b = id;
                    next.at = localOf(pose, f.point);
                    if (next.kind === "slider" && l.kind === "slider")
                      next.dir += (model.drawn.get(l.b)?.angle ?? 0) - (pose?.angle ?? 0);
                  }
                }
                const error = applyLink(next, `pair-${f.key}`);
                if (error) useUiStore.getState().notify(error, { warn: true });
              }}
            >
              {f.nullable && <option value="">O fundo</option>}
              {options.map((p) => (
                <option value={p.id} key={p.id}>
                  {partName(p)} · {p.ref}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </section>
  );
}
