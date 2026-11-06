import { useEffect, useId, useRef, useState } from "react";
import { relativeDate } from "@/editor/time";
import { useUiStore, type MainTab } from "@/editor/useUiStore";
import { fullscreenAction } from "./actions";
import { Icon } from "./icons";
import {
  duplicateProject,
  exportFileName,
  exportJson,
  importText,
  newProject,
  openExampleAsProject,
  openProject,
  removeProject,
  renameProject,
  useProjects,
  type ImportResult,
} from "./projectFlow";
import { EXAMPLES } from "./scenes/examples";
import { Sheet } from "./Sheet";

const TABS: { id: MainTab; label: string }[] = [
  { id: "projects", label: "Projetos" },
  { id: "examples", label: "Exemplos" },
  { id: "transfer", label: "Arquivo" },
];

function ProjectRow({
  id,
  name,
  thumb,
  updatedAt,
}: {
  id: string;
  name: string;
  thumb: string;
  updatedAt: string;
}) {
  const uid = useId();
  const current = useUiStore((s) => s.current?.id === id);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <li className={`prow${current ? " is-current" : ""}`}>
      <div className="prow__main">
        <button
          type="button"
          className="prow__open"
          aria-current={current ? "true" : undefined}
          onClick={() => void openProject(id).then(() => useUiStore.getState().setSheet(null))}
        >
          <span className="prow__thumb" aria-hidden="true" dangerouslySetInnerHTML={{ __html: thumb }} />
          <span className="prow__meta">
            <span className="prow__name">{name}</span>
            <span className="prow__date">{relativeDate(updatedAt)}</span>
          </span>
        </button>
        <button
          type="button"
          className="iconbtn prow__more"
          aria-label={`Ações do projeto ${name}`}
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
            setConfirm(false);
          }}
        >
          <Icon name="pencil" uid={`${uid}p`} />
        </button>
      </div>
      {open && (
        <div className="prow__acts">
          <div className="nfield">
            <label className="nfield__label" htmlFor={`${uid}n`}>
              Nome
            </label>
            <div className="nfield__row">
              <input
                id={`${uid}n`}
                className="nfield__input"
                value={draft ?? name}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  const t = (draft ?? name).trim();
                  setDraft(null);
                  if (t && t !== name) void renameProject(id, t);
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
            </div>
          </div>
          {confirm ? (
            <div className="lrow__confirm" role="alert">
              <p>Excluir o projeto {name}? Não dá para desfazer.</p>
              <div className="card__row">
                <button
                  type="button"
                  className="btn btn--outline btn--danger btn--small"
                  onClick={() => void removeProject(id)}
                >
                  Excluir
                </button>
                <button
                  type="button"
                  className="btn btn--outline btn--small"
                  onClick={() => setConfirm(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="card__row">
              <button
                type="button"
                className="btn btn--outline btn--small"
                onClick={() => void duplicateProject(id).then(() => useUiStore.getState().setSheet(null))}
              >
                <Icon name="duplicate" uid={`${uid}d`} size={20} />
                Duplicar
              </button>
              <button
                type="button"
                className="btn btn--outline btn--danger btn--small"
                onClick={() => setConfirm(true)}
              >
                <Icon name="trash" uid={`${uid}t`} size={20} />
                Excluir
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Projects() {
  const list = useProjects((s) => s.list);
  const stored = useProjects((s) => s.stored);
  const refresh = useProjects((s) => s.refresh);
  const close = () => useUiStore.getState().setSheet(null);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <>
      <h3 className="card__k">Novo projeto</h3>
      <div className="card__row">
        <button
          type="button"
          className="btn btn--outline btn--small"
          onClick={() => void newProject("default").then(close)}
        >
          Objeto padrão
        </button>
        <button
          type="button"
          className="btn btn--outline btn--small"
          onClick={() => void newProject("blank").then(close)}
        >
          Em branco
        </button>
      </div>
      {!stored && (
        <p className="nfield__error">
          Este navegador não deixa salvar no aparelho: os projetos somem ao fechar.
        </p>
      )}
      <ul className="plist">
        {list.map((p) => (
          <ProjectRow key={p.id} {...p} />
        ))}
      </ul>
    </>
  );
}

function Examples() {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <p className="sheet__lede">Abrir um exemplo cria um projeto novo, cópia dele.</p>
      <ul className="menu__list">
        {EXAMPLES.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className="menu__item"
              onClick={() => {
                setError(null);
                openExampleAsProject(e.id)
                  .then(() => useUiStore.getState().setSheet(null))
                  .catch((err: Error) => setError(err.message));
              }}
            >
              <span className="menu__fig">Fig. {e.figure}</span>
              <span className="menu__name">{e.title}</span>
              <span className="menu__desc">{e.description}</span>
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="menu__error">{error}</p>}
    </>
  );
}

function Transfer() {
  const uid = useId();
  const [shown, setShown] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const out = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);

  const copy = async () => {
    const json = exportJson();
    try {
      await navigator.clipboard.writeText(json);
      setMsg("JSON da cena copiado");
      setShown(null);
    } catch {
      // sem área de transferência: mostra o texto selecionado para copiar à mão
      setShown(json);
      setMsg("Selecione o texto abaixo e copie");
      requestAnimationFrame(() => out.current?.select());
    }
  };
  const download = () => {
    try {
      const blob = new Blob([exportJson()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = exportFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setMsg(`Baixando ${exportFileName()}`);
    } catch {
      setShown(exportJson());
      setMsg("Este navegador não baixa arquivos: copie o texto abaixo");
    }
  };
  const doImport = async (t: string) => {
    const r = await importText(t);
    setResult(r);
    if (r.ok) {
      setText("");
      useUiStore.getState().setSheet(null);
    }
  };

  return (
    <>
      <h3 className="card__k">Exportar a cena aberta</h3>
      <div className="card__row">
        <button type="button" className="btn btn--outline btn--small" onClick={() => void copy()}>
          <Icon name="export" uid={`${uid}c`} size={20} />
          Copiar JSON
        </button>
        <button type="button" className="btn btn--outline btn--small" onClick={download}>
          <Icon name="export" uid={`${uid}d`} size={20} />
          Baixar .json
        </button>
      </div>
      {msg && <p className="nfield__note">{msg}</p>}
      {shown !== null && (
        <textarea className="jsonbox" ref={out} readOnly value={shown} aria-label="JSON da cena" rows={6} />
      )}
      <h3 className="card__k transfer__k">Importar</h3>
      <p className="sheet__lede">
        Cole o JSON de uma cena (v0 do protótipo, v1 ou v2) ou escolha um arquivo.
      </p>
      <textarea
        className="jsonbox"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="JSON para importar"
        placeholder='{"version": 3, …}'
        rows={5}
      />
      <div className="card__row">
        <button
          type="button"
          className="btn btn--outline btn--small"
          disabled={!text.trim()}
          onClick={() => void doImport(text)}
        >
          <Icon name="import" uid={`${uid}i`} size={20} />
          Importar texto
        </button>
        <button type="button" className="btn btn--outline btn--small" onClick={() => file.current?.click()}>
          <Icon name="import" uid={`${uid}f`} size={20} />
          Escolher arquivo
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        className="visually-hidden"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void f.text().then(doImport);
        }}
      />
      {result && !result.ok && (
        <ul className="issues" role="alert">
          {result.issues.map((i, k) => (
            <li key={k}>
              {i.path && <code className="issues__path">{i.path}</code>} {i.message}
            </li>
          ))}
        </ul>
      )}
      <h3 className="card__k transfer__k">Tela</h3>
      <button type="button" className="btn btn--outline btn--small" onClick={() => void fullscreenAction()}>
        <Icon name="fullscreen" uid={`${uid}fs`} size={20} />
        Tela cheia
      </button>
    </>
  );
}

/** Menu ☰: projetos, exemplos e arquivo (exportar e importar). */
export function MainSheet() {
  const tab = useUiStore((s) => s.mainTab);
  const setTab = useUiStore((s) => s.setMainTab);
  return (
    <Sheet title="interativLabs" side="menu" className="sheet--main">
      <div className="tabs" role="tablist" aria-label="Menu">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="tabs__tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "projects" && <Projects />}
      {tab === "examples" && <Examples />}
      {tab === "transfer" && <Transfer />}
    </Sheet>
  );
}
