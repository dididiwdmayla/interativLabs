import { useCallback, useEffect, useRef, useState } from "react";
import type { SuiteProgress } from "@/bench/suite";
import { reportTable } from "@/bench/table";
import type { BenchReport, SceneResult } from "@/bench/types";
import type { BenchWorkerMessage } from "@/bench/bench.worker";
import "./bench.css";

/**
 * Página de medição (/#bench). Roda o comparativo de motores num Web Worker,
 * mostra o progresso e a tabela motor × cena, e copia o resultado.
 */

const ENGINE_ORDER = ["planck", "rapier-det", "rapier", "box2d"];
const ENGINE_LABEL: Record<string, string> = {
  planck: "Planck",
  "rapier-det": "Rapier det.",
  rapier: "Rapier",
  box2d: "Box2D v3",
};

const num = (n: number | null, d: number) =>
  n === null || !Number.isFinite(n) ? "—" : n.toFixed(d).replace(".", ",");

type Status = "running" | "done" | "error";

interface Row {
  key: string;
  scene: string;
  title: string;
  unitMm: number;
  cells: Record<string, SceneResult>;
}

function rowsOf(results: SceneResult[], mainUnit: number): Row[] {
  const map = new Map<string, Row>();
  for (const r of results) {
    const key = `${r.scene}@${r.unitMm}`;
    let row = map.get(key);
    if (!row) {
      row = { key, scene: r.scene, title: r.title, unitMm: r.unitMm, cells: {} };
      map.set(key, row);
    }
    row.cells[r.engine] = r;
  }
  return [...map.values()].sort(
    (a, b) =>
      a.scene.localeCompare(b.scene) ||
      (a.unitMm === mainUnit ? -1 : b.unitMm === mainUnit ? 1 : a.unitMm - b.unitMm),
  );
}

export default function BenchPage() {
  const [status, setStatus] = useState<Status>("running");
  const [progress, setProgress] = useState<SuiteProgress | null>(null);
  const [results, setResults] = useState<SceneResult[]>([]);
  const [report, setReport] = useState<BenchReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const [manualText, setManualText] = useState("");
  const worker = useRef<Worker | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  /** Cria o worker e liga as mensagens (o estado só muda nos retornos dele). */
  const launch = useCallback(() => {
    worker.current?.terminate();
    const w = new Worker(new URL("../../bench/bench.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e: MessageEvent<BenchWorkerMessage>) => {
      const m = e.data;
      if (m.type === "progress") {
        setProgress(m.progress);
        const r = m.progress.result;
        if (r) setResults((prev) => [...prev, r]);
      } else if (m.type === "done") {
        // Exposto para o teste automatizado (tests/e2e/bench.spec.ts).
        (window as unknown as { __BENCH_REPORT__?: BenchReport }).__BENCH_REPORT__ = m.report;
        setReport(m.report);
        setStatus("done");
        w.terminate();
      } else {
        setError(m.message);
        setStatus("error");
        w.terminate();
      }
    };
    w.onerror = (e) => {
      setError(e.message || "Falha no worker da bancada");
      setStatus("error");
    };
    w.postMessage({ type: "run" });
  }, []);

  useEffect(() => {
    launch();
    return () => worker.current?.terminate();
  }, [launch]);

  const restart = () => {
    setStatus("running");
    setProgress(null);
    setResults([]);
    setReport(null);
    setError(null);
    setCopyState("idle");
    launch();
  };

  useEffect(() => {
    if (copyState === "manual") {
      textRef.current?.focus();
      textRef.current?.select();
    }
  }, [copyState]);

  const copy = async () => {
    if (!report) return;
    const text = `${reportTable(report)}\n\nJSON completo:\n${JSON.stringify(report)}`;
    try {
      if (!navigator.clipboard) throw new Error("sem área de transferência");
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setManualText(text);
      setCopyState("manual");
    }
  };

  const mainUnit = report?.unitMm ?? results[0]?.unitMm ?? 1;
  const rows = rowsOf(results, mainUnit);
  const engines = ENGINE_ORDER.filter((id) => results.some((r) => r.engine === id));
  const shownEngines = engines.length ? engines : ENGINE_ORDER;
  const failures = results.filter((r) => !r.pass);
  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined;

  return (
    <main className="bench" aria-busy={status === "running"}>
      <header className="bench__head">
        <p className="bench__kicker">interativLabs · Fase 1</p>
        <h1 className="bench__title">Bancada de motores</h1>
        <p className="bench__lede">
          Oito cenas de medição em cada motor de física, com passo fixo de 1/240 s. Tudo roda neste aparelho,
          num processo à parte; a tela continua respondendo.
        </p>
      </header>

      <section className="bench__device" aria-label="Aparelho">
        <dl>
          <div>
            <dt>Navegador</dt>
            <dd className="bench__ua">{ua}</dd>
          </div>
          <div>
            <dt>Núcleos</dt>
            <dd className="bench__num">{cores ?? "?"}</dd>
          </div>
          <div>
            <dt>Relógio</dt>
            <dd className="bench__num">
              {report ? `${num(report.environment.timerResolutionUs, 1)} µs` : "—"}
            </dd>
          </div>
          <div>
            <dt>Escala</dt>
            <dd className="bench__num">{mainUnit} mm por unidade</dd>
          </div>
        </dl>
      </section>

      <section className="bench__progress" aria-live="polite">
        <div
          className="bench__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <span style={{ transform: `scaleX(${status === "done" ? 1 : pct / 100})` }} />
        </div>
        <p className="bench__status">
          {status === "running" &&
            (progress
              ? `Medindo ${ENGINE_LABEL[progress.engine] ?? progress.engine} · ${progress.scene}${progress.unitMm !== mainUnit ? ` a ${progress.unitMm} mm/un` : ""} — ${progress.done} de ${progress.total}`
              : "Carregando os motores…")}
          {status === "done" && `Pronto: ${results.length} medições, ${failures.length} com falha.`}
          {status === "error" && `Erro: ${error}`}
        </p>
        <div className="bench__actions">
          <button type="button" className="btn btn--outline" onClick={restart}>
            Rodar de novo
          </button>
          <button type="button" className="btn btn--primary" onClick={copy} disabled={!report}>
            Copiar resultado
          </button>
        </div>
        {copyState === "copied" && <p className="bench__note">Copiado. Cole no chat do coordenador.</p>}
        {copyState === "manual" && (
          <div className="bench__manual">
            <p className="bench__note">
              O navegador não deixou copiar sozinho. O texto já está selecionado: copie pelo menu do sistema.
            </p>
            <textarea ref={textRef} readOnly value={manualText} rows={8} aria-label="Resultado para copiar" />
          </div>
        )}
      </section>

      <section className="bench__tablewrap" aria-label="Resultado por cena e motor">
        <table className="bench__table">
          <thead>
            <tr>
              <th scope="col">Cena</th>
              {shownEngines.map((id) => (
                <th key={id} scope="col">
                  {ENGINE_LABEL[id] ?? id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={shownEngines.length + 1} className="bench__empty">
                  A tabela se preenche conforme cada medição termina.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">
                  <span className="bench__scene">{row.title}</span>
                  <span className="bench__sceneid">
                    {row.scene.slice(0, 2)}
                    {row.unitMm !== mainUnit ? ` · ${row.unitMm} mm/un` : ""}
                  </span>
                </th>
                {shownEngines.map((id) => {
                  const c = row.cells[id];
                  if (!c)
                    return (
                      <td key={id} className="bench__cell bench__cell--wait">
                        —
                      </td>
                    );
                  return (
                    <td key={id} className={`bench__cell ${c.pass ? "" : "bench__cell--fail"}`}>
                      <span className="bench__verdict">{c.pass ? "Passa" : "Falha"}</span>
                      <span className="bench__metric">
                        <b>{num(c.stepMedian, 3)}</b> ms · p95 {num(c.stepP95, 3)}
                      </span>
                      <span className="bench__metric">
                        pen. {num(c.maxDepth, 3)} mm
                        {c.jitter !== null ? ` · tremor ${num(c.jitter, 4)}` : ""}
                      </span>
                      <span className="bench__metric">
                        {c.deterministic ? "determinístico" : "não determinístico"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {failures.length > 0 && (
        <section className="bench__fails" aria-label="Falhas">
          <h2 className="bench__h2">Falhas</h2>
          <ul>
            {failures.flatMap((f) =>
              f.assertions
                .filter((a) => !a.pass)
                .map((a) => (
                  <li key={`${f.scene}-${f.engine}-${f.unitMm}-${a.label}`}>
                    <span className="bench__failwho">
                      {ENGINE_LABEL[f.engine] ?? f.engine} · {f.title}
                      {f.unitMm !== mainUnit ? ` · ${f.unitMm} mm/un` : ""}
                    </span>
                    <span>
                      {a.label}: <b>{a.value}</b>
                    </span>
                  </li>
                )),
            )}
          </ul>
        </section>
      )}

      <footer className="bench__foot">
        <p>
          Passo: mediana e p95 do tempo de cada passo de 1/240 s (em lotes de 10 quando o relógio do navegador
          é grosso). Penetração: maior sobreposição entre peças. Tremor: deslocamento RMS das peças que
          deveriam estar paradas, numa janela de 1 s. Determinístico: duas execuções com o mesmo hash das
          poses.
        </p>
      </footer>
    </main>
  );
}
