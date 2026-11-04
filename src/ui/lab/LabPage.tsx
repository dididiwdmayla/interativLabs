import { useCallback, useEffect, useRef, useState } from "react";
import { loadBox2d } from "@/engine/box2d/load";
import type { EngineAdapter } from "@/engine/types";
import type { Scene } from "@/model/types";
import { FIXTURES, GROUPS, type FixtureEntry } from "@/sim/fixtures";
import { runFixture, type FixtureResult } from "@/sim/runner";
import { LabStage, type StageControl } from "./LabStage";
import { runAllFixtures } from "./labHook";
import "./lab.css";

/**
 * Laboratório (/#lab): as cenas de teste e os exemplos rodando no motor do
 * app, com desenho simples, para ver e sentir os comportamentos antes do
 * renderizador definitivo. Endereço direto de uma cena: /#lab/<grupo>/<nome>.
 */

const SPEEDS = [0.05, 0.25, 1] as const;
const speedLabel = (s: number) => `${String(s).replace(".", ",")}×`;
const fmtTime = (t: number) => `t = ${t.toFixed(3).replace(".", ",")} s`;

function idFromHash(): string {
  const h = window.location.hash.replace(/^#lab\/?/, "");
  const id = decodeURIComponent(h);
  return FIXTURES.some((f) => f.id === id) ? id : (FIXTURES[0]?.id ?? "");
}

function Mark({ state }: { state: "pass" | "fail" | "expected" | "wait" }) {
  return (
    <svg className={`lab__mark lab__mark--${state}`} viewBox="0 0 16 16" aria-hidden="true">
      {state === "pass" && <path d="M3 8.5 6.5 12 13 4.5" />}
      {(state === "fail" || state === "expected") && <path d="M4 4 12 12M12 4 4 12" />}
      {state === "wait" && <circle cx="8" cy="8" r="2" />}
    </svg>
  );
}

interface LabApi {
  runAll: typeof runAllFixtures;
  /** mostra uma cena parada no instante t (capturas) */
  show(id: string, run: number, t: number): Promise<void>;
}

export default function LabPage() {
  const [id, setId] = useState(idFromHash);
  const [runIdx, setRunIdx] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<{ id: string; scene: Scene } | null>(null);
  const [make, setMake] = useState<(() => EngineAdapter) | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<number>(0.25);
  const [resetKey, setResetKey] = useState(0);
  const [measured, setMeasured] = useState<{ id: string; result: FixtureResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const control = useRef<StageControl | null>(null);
  const timeEl = useRef<HTMLOutputElement | null>(null);
  const entry: FixtureEntry | undefined = FIXTURES.find((f) => f.id === id);
  const run = entry ? entry.script.runs[runIdx ?? entry.script.labRun ?? 0] : undefined;
  const scene = loaded?.id === id ? loaded.scene : null;
  const result = measured?.id === id ? measured.result : null;

  useEffect(() => {
    let alive = true;
    loadBox2d().then(
      (m) => alive && setMake(() => m),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, []);

  // cena e afirmações (rodadas inteiras, sem desenhar, num adaptador à parte)
  useEffect(() => {
    if (!entry) return;
    let alive = true;
    entry.load().then(
      (s) => alive && setLoaded({ id: entry.id, scene: s }),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [entry]);

  useEffect(() => {
    if (!entry || !scene || !make) return;
    let alive = true;
    const t = window.setTimeout(() => {
      runFixture(make(), entry.script, scene, {
        yieldEvery: () => new Promise((r) => setTimeout(r, 0)),
      }).then(
        (r) => alive && setMeasured({ id: entry.id, result: r }),
        (e: Error) => alive && setError(e.message),
      );
    }, 50);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [entry, scene, make]);

  useEffect(() => {
    const on = () => {
      const next = idFromHash();
      setId(next);
      setRunIdx(null);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const select = (next: string) => {
    window.history.replaceState(null, "", `#lab/${next}`);
    setId(next);
    setRunIdx(null);
    setPaused(false);
  };

  const onTime = useCallback((t: number) => {
    if (timeEl.current) timeEl.current.textContent = fmtTime(t);
  }, []);

  // gancho dos testes automatizados (tests/e2e)
  const state = useRef({ id, scene, run });
  useEffect(() => {
    state.current = { id, scene, run };
  }, [id, scene, run]);
  useEffect(() => {
    const api: LabApi = {
      runAll: runAllFixtures,
      async show(target, r, t) {
        window.history.replaceState(null, "", `#lab/${target}`);
        setId(target);
        setRunIdx(r);
        setPaused(true);
        for (let i = 0; i < 400; i++) {
          await new Promise((res) => setTimeout(res, 25));
          const cur = state.current;
          if (cur.id === target && cur.scene && control.current && control.current.time() === 0) break;
        }
        await new Promise((res) => setTimeout(res, 50));
        control.current?.seek(t);
      },
    };
    (window as unknown as { __LAB__?: LabApi }).__LAB__ = api;
  }, []);

  return (
    <main className="lab">
      <header className="lab__head">
        <p className="lab__kicker">interativLabs · motor do app</p>
        <h1 className="lab__title">Laboratório</h1>
        <p className="lab__lede">
          Cenas de teste e exemplos no Box2D calibrado, com gravidade real. Arraste as peças com o dedo; use a
          câmera lenta para ver o que acontece em milissegundos.
        </p>
      </header>

      <div className="lab__pick">
        <label className="lab__field">
          <span className="lab__label">Cena</span>
          <select value={id} onChange={(e) => select(e.target.value)}>
            {GROUPS.map((g) => {
              const items = FIXTURES.filter((f) => f.script.group === g.id);
              if (!items.length) return null;
              return (
                <optgroup key={g.id} label={g.label}>
                  {items.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.script.title}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>
        {entry && entry.script.runs.length > 1 && entry.script.runs.length <= 6 && (
          <div className="lab__runs" role="group" aria-label="Execução">
            {entry.script.runs.map((r, i) => (
              <button
                key={r.name}
                type="button"
                className="lab__chip"
                aria-pressed={run === r}
                onClick={() => setRunIdx(i)}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="lab__body">
        <section className="lab__stagewrap" aria-label="Palco">
          <div
            className="lab__stage"
            style={
              entry?.script.view
                ? { ["--ar" as string]: `${entry.script.view[2]} / ${entry.script.view[3]}` }
                : undefined
            }
          >
            {scene && make && run ? (
              <LabStage
                scene={scene}
                run={run}
                make={make}
                paused={paused}
                speed={speed}
                view={entry?.script.view}
                resetKey={resetKey}
                onTime={onTime}
                controlRef={control}
              />
            ) : (
              <p className="lab__wait">{error ? `Erro: ${error}` : "Carregando o motor…"}</p>
            )}
          </div>
          <div className="lab__controls">
            <button type="button" className="btn btn--primary lab__play" onClick={() => setPaused((p) => !p)}>
              {paused ? "Continuar" : "Pausar"}
            </button>
            <div className="lab__speeds" role="group" aria-label="Velocidade">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="lab__chip"
                  aria-pressed={speed === s}
                  onClick={() => setSpeed(s)}
                >
                  {speedLabel(s)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => {
                setResetKey((k) => k + 1);
              }}
            >
              Reiniciar
            </button>
            <output className="lab__time" ref={timeEl}>
              {fmtTime(0)}
            </output>
          </div>
        </section>

        <aside className="lab__info" aria-live="polite">
          <h2 className="lab__name">{entry?.script.title}</h2>
          {entry?.script.notes && <p className="lab__notes">{entry.script.notes}</p>}
          <h3 className="lab__sub">Afirmações</h3>
          {!result && <p className="lab__wait">Medindo…</p>}
          {result && (
            <ul className="lab__asserts">
              {result.runs.flatMap((r) =>
                r.assertions.map((a, i) => {
                  const st = a.pass ? "pass" : a.expectedFailure ? "expected" : "fail";
                  return (
                    <li key={`${r.name}-${i}`} className={`lab__assert lab__assert--${st}`}>
                      <Mark state={st} />
                      <span className="lab__alabel">
                        {result.runs.length > 1 && <span className="lab__arun">{r.name}: </span>}
                        {a.label}
                        {st === "expected" && <span className="lab__aexp"> (falha esperada)</span>}
                      </span>
                      <span className="lab__avalue">{a.value}</span>
                    </li>
                  );
                }),
              )}
            </ul>
          )}
        </aside>
      </div>
    </main>
  );
}
