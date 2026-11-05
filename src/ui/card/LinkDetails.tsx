import { setLink } from "@/editor/commands";
import { linkForm, readField, toggleGroup, writeField, type FieldDesc } from "@/editor/linkFields";
import { useUiStore } from "@/editor/useUiStore";
import { formatPath, validateScene } from "@/model/scene";
import type { Link } from "@/model/types";
import { NumberField } from "./fields";

/**
 * Detalhes de uma ligação: o formulário gerado do schema, com unidades e a
 * validação do próprio schema (mensagens em português). Carregado sob
 * demanda, junto com o Zod.
 */

/** Tenta a ligação nova na cena; devolve o erro do schema ou null (e aplica). */
function tryLink(next: Link): string | null {
  const ui = useUiStore.getState();
  const scene = ui.current?.scene;
  if (!scene) return null;
  const i = scene.links.findIndex((l) => l.id === next.id);
  if (i < 0) return null;
  const links = scene.links.slice();
  links[i] = next;
  const r = validateScene({ ...scene, links });
  if (!r.ok) {
    const mine = r.issues.find((x) => x.path.startsWith(`links[${i}]`)) ?? r.issues[0];
    return mine ? mine.message : "Valor inválido";
  }
  ui.commit(setLink(scene, next.id, next));
  return null;
}

function Field({ link, f }: { link: Link; f: FieldDesc }) {
  const v = readField(link, f);
  if (f.kind === "number")
    return (
      <NumberField
        label={f.label}
        unit={f.unit}
        value={f.toView(v as number)}
        digits={f.integer ? 0 : 3}
        onCommit={(x) => {
          if (f.integer && !Number.isInteger(x)) return "Use um número inteiro";
          return tryLink(writeField(link, f.path, f.fromView(x)));
        }}
      />
    );
  if (f.kind === "boolean")
    return (
      <label className="checkfield">
        <input
          type="checkbox"
          checked={v === true}
          onChange={(e) => tryLink(writeField(link, f.path, e.target.checked))}
        />
        {f.label}
      </label>
    );
  return (
    <div className="nfield">
      <span className="nfield__label">{f.label}</span>
      <select
        className="nfield__select"
        value={String(v)}
        aria-label={f.label}
        onChange={(e) => tryLink(writeField(link, f.path, e.target.value))}
      >
        {f.options?.map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function LinkDetails({ link }: { link: Link }) {
  const form = linkForm(link);
  return (
    <section className="card__sec card__form" aria-label="Detalhes">
      {form.fields.map((f) => (
        <Field key={formatPath(f.path)} link={link} f={f} />
      ))}
      {form.groups.map((g) => (
        <fieldset key={g.key} className="card__group">
          <label className="checkfield">
            <input
              type="checkbox"
              checked={g.present}
              onChange={(e) => {
                const err = tryLink(toggleGroup(link, g.key, e.target.checked));
                if (err) useUiStore.getState().notify(err, { warn: true });
              }}
            />
            {g.label}
          </label>
          {g.present && g.fields.map((f) => <Field key={formatPath(f.path)} link={link} f={f} />)}
        </fieldset>
      ))}
    </section>
  );
}
