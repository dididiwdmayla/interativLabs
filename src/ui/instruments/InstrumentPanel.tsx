import { useState, useId, useRef, useEffect } from "react";
import { useUiStore } from "@/editor/useUiStore";
import { quantities } from "@/instruments/model";
import type { Series } from "@/instruments/sampling";
import { useSimStore } from "../sim/simStore";
import { useInstruments } from "./store";
import "./instruments.css";
const fmt = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
function Chart({ series, shown, latest }: { series: Series; shown: number; latest: number }) {
  const uid = useId();
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const [threshold, setThreshold] = useState<number | null>(null);
  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  };
  useEffect(
    () => () => {
      if (hold.current) clearTimeout(hold.current);
    },
    [],
  );
  const ctl = useSimStore((s) => s.ctl);
  const { probe, points, cursor } = series;
  const valid = points.filter((p) => p.value !== null);
  const values = valid.map((p) => p.value!);
  const lo = Math.min(0, ...values, probe.limit ?? 0);
  const hi = Math.max(1e-6, ...values, probe.limit ?? 0);
  const range = hi - lo || 1;
  const end = Math.max(1, latest * 240, points.at(-1)?.step ?? 0);
  const x = (step: number) => 12 + (step / end) * 276;
  const y = (value: number) => 78 - ((value - lo) / range) * 56;
  let drawing = false;
  const path = points
    .map((p) => {
      if (p.value === null) {
        drawing = false;
        return "";
      }
      const command = drawing ? "L" : "M";
      drawing = true;
      return `${command}${x(p.step).toFixed(2)},${y(p.value).toFixed(2)}`;
    })
    .join(" ");
  const peak = valid.reduce<(typeof valid)[number] | null>(
    (a, p) => (!a || p.value! > a.value! ? p : a),
    null,
  );
  const scrub = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    ctl?.scrub((Math.max(0, Math.min(1, (((clientX - r.left) / r.width) * 300 - 12) / 276)) * end) / 240);
  };
  return (
    <article
      className={`instrument-chart${probe.quantity === "pressure" ? " instrument-chart--energy" : ""}`}
    >
      <header>
        <h3 title={probe.name}>{probe.name}</h3>
        <button
          aria-label={`Remover ${probe.name}`}
          onClick={() => {
            const ui = useUiStore.getState();
            ui.setProbes(ui.probes.filter((p) => p.id !== probe.id));
          }}
        >
          ×
        </button>
      </header>
      <div className="instrument-chart__reading">
        <output>{fmt(cursor?.value)}</output>
        <span>{quantities[probe.quantity][1]}</span>
        <small>pico {fmt(peak?.value)}</small>
      </div>
      <svg
        viewBox="0 0 300 96"
        role="slider"
        tabIndex={0}
        aria-label={`Cursor de ${probe.name}`}
        aria-valuemin={0}
        aria-valuemax={end / 240}
        aria-valuenow={shown}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            ctl?.scrub(shown + (e.key === "ArrowLeft" ? -1 : 1) / 240);
          }
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = { x: e.clientX, y: e.clientY };
          const rect = e.currentTarget.getBoundingClientRect();
          const value = lo + ((78 - ((e.clientY - rect.top) / rect.height) * 96) / 56) * range;
          cancelHold();
          hold.current = setTimeout(() => setThreshold(value), 550);
          scrub(e.clientX, e.currentTarget);
        }}
        onPointerMove={(e) => {
          if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) cancelHold();
          if (e.currentTarget.hasPointerCapture(e.pointerId)) scrub(e.clientX, e.currentTarget);
        }}
        onPointerUp={(e) => {
          cancelHold();
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={cancelHold}
      >
        <defs>
          <pattern id={uid} width="23" height="14" patternUnits="userSpaceOnUse">
            <path d="M23 0H0V14" className="instrument-chart__grid" />
          </pattern>
        </defs>
        <rect x="12" y="22" width="276" height="56" fill={`url(#${uid})`} />
        <path d="M12 22V78H288" className="instrument-chart__axis" />
        <path d={path} className="instrument-chart__curve" />
        {probe.limit !== undefined && (
          <g className="instrument-chart__limit">
            <path d={`M12 ${y(probe.limit)}H288`} />
            <text x="286" y={y(probe.limit) - 3} textAnchor="end">
              limite {fmt(probe.limit)}
            </text>
          </g>
        )}
        {peak && <circle cx={x(peak.step)} cy={y(peak.value!)} r="2.5" className="instrument-chart__peak" />}
        <g className="instrument-chart__cursor">
          <path d={`M${x(shown * 240)} 16V82`} />
          <path d={`M${x(shown * 240) - 4} 12h8l-4 5z`} />
        </g>
        <text x="12" y="92">
          0 s
        </text>
        <text x="288" y="92" textAnchor="end">
          {fmt(end / 240)} s
        </text>
      </svg>
      {threshold !== null && (
        <button
          className="instrument-chart__threshold"
          onClick={() => {
            const ui = useUiStore.getState();
            ui.setProbes(
              ui.probes.map((p) =>
                p.id === probe.id ? { ...p, threshold } : { ...p, threshold: undefined },
              ),
            );
            setThreshold(null);
          }}
        >
          Contar quando passar daqui · {fmt(threshold)} {quantities[probe.quantity][1]}
        </button>
      )}
      {probe.threshold !== undefined && (
        <button
          className="instrument-chart__threshold"
          onClick={() => {
            const ui = useUiStore.getState();
            ui.setProbes(ui.probes.map((p) => (p.id === probe.id ? { ...p, threshold: undefined } : p)));
          }}
        >
          Limiar {fmt(probe.threshold)} · remover
        </button>
      )}
    </article>
  );
}
export function InstrumentPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const probes = useUiStore((s) => s.probes);
  const { series, shown, latest, ticks } = useInstruments();
  const thresholdSeries = series.find((s) => s.probe.threshold !== undefined);
  const cycles = thresholdSeries
    ? thresholdSeries.crossings
    : ticks.filter((t) => t.kind === "chamber-fired").length;
  const clicks = ticks.filter((t) => t.kind === "impact").length;
  if (!probes.length) return null;
  return (
    <section className="instruments" aria-label="Instrumentos">
      <header className="instruments__head">
        <button onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>
          Instrumentos <span>{collapsed ? "＋" : "−"}</span>
        </button>
        <small>
          {cycles} ciclos · {clicks} estalos · t = {fmt(shown)} s
        </small>
      </header>
      {!collapsed && (
        <div className="instruments__charts">
          {probes.map((probe) => (
            <Chart
              key={probe.id}
              series={
                series.find((s) => s.probe.id === probe.id) ?? {
                  probe,
                  points: [],
                  cursor: null,
                  crossings: 0,
                }
              }
              shown={shown}
              latest={latest}
            />
          ))}
        </div>
      )}
    </section>
  );
}
