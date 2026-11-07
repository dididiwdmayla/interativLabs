import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadScene } from "@/model/scene";
import type { Scene } from "@/model/types";
import type { StageNodes } from "@/render/nodes";
import { SPEEDS, speedMode, type Speed } from "@/sim/pacing";
import { prepareScene } from "@/render/prepare";
import type { FrameStats } from "../sim/controller";
import { useSimStore } from "../sim/simStore";
import { useSimulation } from "../sim/useSimulation";
import { Stage } from "../Stage";
import type { Look } from "@/render/look";
import "./perf.css";

/**
 * Medição de desempenho (/#perf): a cena sintética de 150 peças e 100
 * ligações no palco real, simulando por 10 s com um arrasto roteirizado,
 * em Real (padrão), Normal ou Lento. Mostra quadros por segundo (mediana e
 * p5), o tempo de física, de desenho e da interpolação por quadro e os
 * dados do aparelho.
 */

const DURATION = 10;

const sceneFile = import.meta.glob<unknown>("../../../scenes/fixtures/desempenho/desempenho.scene.json", {
  import: "default",
});

interface PerfResult {
  multilayer: boolean;
  /** camadas em cores e afastadas (Parte E2d) */
  colors: boolean;
  /** rastro do movimento ligado (Parte E2d) */
  trail: boolean;
  frames: number;
  fpsMedian: number;
  fpsP5: number;
  intervalP95: number;
  physicsMedian: number;
  physicsP95: number;
  drawMedian: number;
  drawP95: number;
  /** média (o relógio do navegador tem 0,1 ms de resolução: a mediana sairia 0) */
  mixMean: number;
  mixP95: number;
  speed: number;
  stepsPerFrame: number;
  /** quadros acima de 20 ms */
  long: number;
  device: Record<string, string | number>;
}

const q = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))] ?? NaN;
};
const n = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d).replace(".", ",") : "—");

function device(): Record<string, string | number> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    navegador: navigator.userAgent,
    densidade: window.devicePixelRatio,
    tela: `${screen.width}×${screen.height}`,
    janela: `${window.innerWidth}×${window.innerHeight}`,
    núcleos: navigator.hardwareConcurrency ?? "—",
    memória: nav.deviceMemory ? `${nav.deviceMemory} GB` : "—",
  };
}

function summarize(
  stats: FrameStats[],
  speed: number,
  multilayer = false,
  colors = false,
  trail = false,
): PerfResult {
  // o primeiro segundo é aquecimento (compilação do WASM, primeira pintura)
  const s = stats.slice(Math.min(60, Math.floor(stats.length / 10)));
  const fps = s.map((x) => 1000 / Math.max(1, x.interval));
  return {
    multilayer,
    colors,
    trail,
    frames: s.length,
    fpsMedian: q(fps, 0.5),
    fpsP5: q(fps, 0.05),
    intervalP95: q(
      s.map((x) => x.interval),
      0.95,
    ),
    physicsMedian: q(
      s.map((x) => x.physics),
      0.5,
    ),
    physicsP95: q(
      s.map((x) => x.physics),
      0.95,
    ),
    drawMedian: q(
      s.map((x) => x.draw),
      0.5,
    ),
    drawP95: q(
      s.map((x) => x.draw),
      0.95,
    ),
    mixMean: s.reduce((a, x) => a + x.mix, 0) / Math.max(1, s.length),
    mixP95: q(
      s.map((x) => x.mix),
      0.95,
    ),
    speed,
    stepsPerFrame: s.reduce((a, x) => a + x.steps, 0) / Math.max(1, s.length),
    long: s.filter((x) => x.interval > 20).length,
    device: device(),
  };
}

function resultText(r: PerfResult): string {
  return [
    `interativLabs /#perf — 150 peças, 100 ligações${r.multilayer ? ", 30 peças com dois perfis" : ""}${r.colors ? ", camadas em cores e afastadas" : ""}${r.trail ? ", rastro" : ""}, ${speedMode(r.speed).name} (${speedMode(r.speed).frac}), 10 s com arrasto`,
    `qps: mediana ${n(r.fpsMedian)} · p5 ${n(r.fpsP5)} (${r.frames} quadros; ${r.long} acima de 20 ms)`,
    `física por quadro: mediana ${n(r.physicsMedian, 2)} ms · p95 ${n(r.physicsP95, 2)} ms (${n(r.stepsPerFrame, 2)} passos)`,
    `desenho por quadro: mediana ${n(r.drawMedian, 2)} ms · p95 ${n(r.drawP95, 2)} ms`,
    `interpolação por quadro: média ${n(r.mixMean, 3)} ms · p95 ${n(r.mixP95, 3)} ms`,
    ...Object.entries(r.device).map(([k, v]) => `${k}: ${v}`),
  ].join("\n");
}

export default function PerfPage() {
  const [multilayer, setMultilayer] = useState(false);
  const [colors, setColors] = useState(false);
  const [trail, setTrail] = useState(false);
  const look = useMemo<Look>(
    () => ({ colors, spread: colors ? 28 : 0, isolate: false, hidden: new Set() }),
    [colors],
  );
  const [scene, setScene] = useState<Scene | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PerfResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [speed, setSpeed] = useState<Speed>(
    () => (window as unknown as { __PERF_SPEED__?: Speed }).__PERF_SPEED__ ?? 1,
  );
  const [nodes, setNodes] = useState<StageNodes | null>(null);
  const stats = useRef<FrameStats[]>([]);
  const progress = useRef<HTMLSpanElement>(null);
  const model = useMemo(() => (scene ? prepareScene(scene) : null), [scene]);
  const ctl = useSimStore((s) => s.ctl);

  useEffect(() => {
    const load = Object.values(sceneFile)[0];
    if (!load) return;
    load().then((raw) => {
      const r = loadScene(raw);
      if (r.ok) {
        const scene = r.scene;
        if (multilayer) {
          scene.layers.push({ id: "perf-extra", name: "Perfis", visible: true, locked: false, thickness: 3 });
          scene.parts
            .filter((p) => !p.fixed)
            .slice(0, 30)
            .forEach((p) => {
              p.profiles = [
                { id: `perf-profile-${p.id}`, layer: "perf-extra", shape: structuredClone(p.shape) },
              ];
            });
        }
        setScene(scene);
      } else setError(r.issues.map((i) => i.message).join("; "));
    }, setError);
  }, [multilayer]);

  const opts = useMemo(
    () => ({
      onStats: (s: FrameStats) => {
        stats.current.push(s);
      },
    }),
    [],
  );
  useSimulation(running, nodes, opts);

  // roteiro: 10 s; de 2 s a 8 s o dedo arrasta o bloco da primeira célula em vaivém
  useEffect(() => {
    if (!running || !ctl || !model) return;
    useSimStore.getState().set({ speed, paused: false });
    stats.current = [];
    const block =
      model.partList.find((m) => m.part.name === "Bloco 1") ?? model.partList.find((m) => m.dynamic);
    const p0: [number, number] = block ? [block.part.x, block.part.y] : [0, 0];
    const t0 = performance.now();
    let held = false;
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      if (progress.current) progress.current.textContent = `${n(Math.min(t, DURATION))} s`;
      if (t >= 2 && t < 8) {
        const p: [number, number] = [p0[0] + 9 * Math.sin((t - 2) * 3), p0[1] + 4 * Math.sin((t - 2) * 5)];
        if (!held) held = ctl.dragAt(p0) !== null;
        else ctl.dragMove(p);
      } else if (held) {
        ctl.dragEnd();
        held = false;
      }
      if (t >= DURATION) {
        const r = summarize(stats.current, speed, multilayer, colors, trail);
        setResult(r);
        (window as unknown as { __PERF__?: PerfResult }).__PERF__ = r;
        setRunning(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, ctl, model, speed, multilayer, colors, trail]);

  const copy = useCallback(async () => {
    if (!result) return;
    const text = resultText(result);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // sem permissão de área de transferência: seleciona o texto para copiar à mão
      const pre = document.querySelector(".perf__text");
      if (pre) window.getSelection()?.selectAllChildren(pre);
    }
  }, [result]);

  return (
    <div className="perf">
      <header className="perf__head">
        <p className="perf__kicker">interativLabs · desempenho</p>
        <h1 className="perf__title">150 peças, 100 ligações{multilayer ? " · 30 com dois perfis" : ""}</h1>
        <div className="perf__actions">
          <label className="checkfield">
            <input
              type="checkbox"
              checked={multilayer}
              disabled={running}
              onChange={(e) => {
                setResult(null);
                setMultilayer(e.target.checked);
              }}
            />
            30 peças com dois perfis
          </label>
          <label className="checkfield">
            <input
              type="checkbox"
              checked={colors}
              disabled={running}
              onChange={(e) => {
                setResult(null);
                setColors(e.target.checked);
              }}
            />
            Camadas em cores e afastadas
          </label>
          <label className="checkfield">
            <input
              type="checkbox"
              checked={trail}
              disabled={running}
              onChange={(e) => {
                setResult(null);
                setTrail(e.target.checked);
              }}
            />
            Rastro
          </label>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!model || running}
            onClick={() => {
              setResult(null);
              setCopied(false);
              setRunning(true);
            }}
          >
            {running ? "Rodando…" : result ? "Rodar de novo" : "Rodar 10 s"}
          </button>
          {running && (
            <span className="perf__progress" ref={progress}>
              0 s
            </span>
          )}
          <div className="perf__speeds" role="group" aria-label="Velocidade">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                className="btn btn--outline perf__speed"
                aria-pressed={speed === s}
                disabled={running}
                onClick={() => setSpeed(s)}
              >
                {speedMode(s).name}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--outline" disabled={!result} onClick={copy}>
            {copied ? "Copiado" : "Copiar resultado"}
          </button>
        </div>
        {error && <p className="perf__error">{error}</p>}
      </header>
      <div className="perf__stage">
        <Stage
          model={model}
          figure={1}
          serial={1}
          mode="simulate"
          layerMode="all"
          activeLayer={3}
          onNodes={setNodes}
          look={look}
          bare
        />
      </div>
      {result && (
        <section className="perf__result" aria-live="polite">
          <dl className="perf__nums">
            <div>
              <dt>Quadros por segundo</dt>
              <dd>
                {n(result.fpsMedian)} <span>mediana</span> · {n(result.fpsP5)} <span>p5</span>
              </dd>
            </div>
            <div>
              <dt>Física por quadro</dt>
              <dd>
                {n(result.physicsMedian, 2)} ms <span>mediana</span> · {n(result.physicsP95, 2)} ms{" "}
                <span>p95</span>
              </dd>
            </div>
            <div>
              <dt>Interpolação por quadro</dt>
              <dd>
                {n(result.mixMean, 3)} ms <span>média</span> · {n(result.mixP95, 3)} ms <span>p95</span>
              </dd>
            </div>
            <div>
              <dt>Desenho por quadro</dt>
              <dd>
                {n(result.drawMedian, 2)} ms <span>mediana</span> · {n(result.drawP95, 2)} ms <span>p95</span>
              </dd>
            </div>
          </dl>
          <pre className="perf__text">{resultText(result)}</pre>
        </section>
      )}
    </div>
  );
}
