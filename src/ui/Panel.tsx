import { useId } from "react";
import { useUiStore } from "@/editor/useUiStore";
import type { Link } from "@/model/types";
import { MATERIALS } from "@/model/materials";
import type { SceneModel } from "@/render/prepare";
import { Icon } from "./icons";
import { LINK_LABEL } from "./labels";

const num = (n: number, d = 1) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Peças que uma ligação toca. */
function linkParts(l: Link): (string | null)[] {
  switch (l.kind) {
    case "pin":
    case "sensor":
      return [l.host];
    case "slot":
      return [l.guide];
    case "chamber":
      return [l.body, ...l.walls.map((w) => w.part)];
    default:
      return [l.a, l.b];
  }
}

function Field({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="field">
      <dt className="field__label">{label}</dt>
      <dd className="field__value">
        {value}
        {unit && <span className="field__unit"> {unit}</span>}
      </dd>
    </div>
  );
}

function Properties({ model }: { model: SceneModel }) {
  const sel = useUiStore((s) => s.selection);
  const select = useUiStore((s) => s.select);
  if (!sel)
    return <p className="panel__empty">Nada selecionado. Toque numa peça ou ligação para ver as medidas.</p>;
  const partRef = (id: string | null) =>
    id === null ? "fundo" : String(model.parts.get(id)?.part.ref ?? "?");
  if (sel.kind === "part") {
    const m = model.parts.get(sel.id);
    if (!m) return null;
    const p = m.part;
    const links = model.links.filter((lm) => linkParts(lm.link).includes(p.id));
    return (
      <>
        <dl className="fields">
          <Field label="Nome" value={p.name || "Sem nome"} />
          <Field label="Chamada" value={String(p.ref)} />
          <Field label="Camada" value={`${m.layer + 1} · ${model.layers[m.layer]?.layer.name ?? ""}`} />
          <Field label="Material" value={MATERIALS[p.material].label} />
          <Field label="Massa" value={num(m.mass, m.mass < 10 ? 2 : 1)} unit="g" />
          <Field label="Fixação" value={m.dynamic ? "Móvel" : "Fixa"} />
        </dl>
        <h3 className="panel__sub">Ligações</h3>
        {links.length === 0 ? (
          <p className="panel__empty">Nenhuma.</p>
        ) : (
          <ul className="linklist">
            {links.map((lm) => (
              <li key={lm.link.id}>
                <button
                  type="button"
                  className="linklist__item"
                  onClick={() => select({ kind: "link", id: lm.link.id })}
                >
                  <span className="linklist__ref">{lm.link.ref}</span>
                  {LINK_LABEL[lm.link.kind]}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="panel__note">Edição na próxima etapa; por enquanto, só leitura.</p>
      </>
    );
  }
  const lm = model.linkById.get(sel.id);
  if (!lm) return null;
  const l = lm.link;
  const span = lm.span[0] === lm.span[1] ? `${lm.span[0] + 1}` : `${lm.span[0] + 1}–${lm.span[1] + 1}`;
  return (
    <>
      <dl className="fields">
        <Field label="Tipo" value={LINK_LABEL[l.kind]} />
        <Field label="Chamada" value={String(l.ref)} />
        <Field label="Peças" value={linkParts(l).map(partRef).join(" · ")} />
        <Field label="Camadas" value={span} />
        {l.kind === "spring" && (
          <>
            <Field label="Rigidez" value={num(l.k, 3)} unit="N/mm" />
            <Field label="Comprimento livre" value={num(l.freeLength)} unit="mm" />
          </>
        )}
        {l.kind === "chamber" && (
          <>
            <Field label="Diâmetro" value={num(l.bore)} unit="mm" />
            <Field label="Pressão inicial" value={num(l.gas.p0)} unit="kPa" />
          </>
        )}
        {l.kind === "cable" && <Field label="Comprimento" value={num(l.maxLength)} unit="mm" />}
        {(l.kind === "pin" || l.kind === "sensor") && <Field label="Raio" value={num(l.r, 2)} unit="mm" />}
        {l.kind === "slider" && (
          <Field label="Curso" value={`${num(l.travel[0])} a ${num(l.travel[1])}`} unit="mm" />
        )}
      </dl>
      <p className="panel__note">Edição na próxima etapa; por enquanto, só leitura.</p>
    </>
  );
}

function LayerPlates({ model }: { model: SceneModel }) {
  const active = useUiStore((s) => s.activeLayer);
  const setActive = useUiStore((s) => s.setActiveLayer);
  // a do topo é a mais próxima de quem olha: ordem visual é o array invertido
  const top = [...model.layers].reverse();
  return (
    <ol className="plates" aria-label="Camadas">
      {top.map((l) => {
        const n = l.index + 1;
        const isActive = l.index === active;
        return (
          <li key={l.layer.id}>
            <button
              type="button"
              className="plate"
              aria-current={isActive ? "true" : undefined}
              onClick={() => setActive(l.index)}
            >
              <span className="plate__thumb" aria-hidden="true">
                <span className="plate__sheet" />
                <span className="plate__sheet" />
                <span className="plate__sheet plate__sheet--front" />
              </span>
              <span className="plate__num">{n}</span>
              <span className="plate__meta">
                <span className="plate__name">{l.layer.name}</span>
                <span className="plate__count">
                  {l.parts.length === 1 ? "1 peça" : `${l.parts.length} peças`}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Painel de propriedades: coluna à direita no computador, folha inferior
 * no celular (recolhida por padrão; a alça mostra a seleção ou a camada).
 */
export function Panel({ model }: { model: SceneModel | null }) {
  const uid = useId();
  const open = useUiStore((s) => s.sheetOpen);
  const setOpen = useUiStore((s) => s.setSheetOpen);
  const active = useUiStore((s) => s.activeLayer);
  const xray = useUiStore((s) => s.xray);
  const setXray = useUiStore((s) => s.setXray);
  const sel = useUiStore((s) => s.selection);
  const bodyId = `${uid}body`;
  const layer = model?.layers[active];
  const selName =
    sel?.kind === "part"
      ? model?.parts.get(sel.id)?.part.name
      : sel?.kind === "link"
        ? (() => {
            const l = model?.linkById.get(sel.id)?.link;
            return l ? `${LINK_LABEL[l.kind]} ${l.ref}` : undefined;
          })()
        : undefined;
  return (
    <aside className="panel" data-open={open} aria-label="Propriedades">
      <button
        type="button"
        className="panel__handle only-mobile"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
      >
        <span className="panel__grip" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="panel__handle-label">
          {selName ? (
            <>
              <span className="panel__handle-k panel__handle-k--sel">Seleção</span>
              <span className="panel__handle-name">{selName}</span>
            </>
          ) : (
            <>
              <span className="panel__handle-k">Camada</span>
              <span className="panel__handle-num">{active + 1}</span>
              <span className="panel__handle-name">{layer?.layer.name}</span>
            </>
          )}
        </span>
        <span className="panel__chev" aria-hidden="true">
          <Icon name="chevron" uid={`${uid}c`} size={20} />
        </span>
      </button>
      <div className="panel__body" id={bodyId}>
        <section className="panel__section">
          <h2 className="panel__title">Propriedades</h2>
          {model && <Properties model={model} />}
        </section>
        <section className="panel__section">
          <h2 className="panel__title">Camadas</h2>
          {model && <LayerPlates model={model} />}
          <button
            type="button"
            className="btn btn--outline panel__xray"
            aria-pressed={xray}
            onClick={() => setXray(!xray)}
          >
            <Icon name="xray" uid={`${uid}x`} size={20} />
            Raio-x
          </button>
        </section>
      </div>
    </aside>
  );
}
