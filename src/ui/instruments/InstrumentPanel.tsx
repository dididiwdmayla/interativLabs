import { formatNumber } from "@/instruments/format";
import { launcherMetrics, launcherSummary } from "@/instruments/comparisonMetrics";
import { eventNames, type EventTick, type TickKind } from "@/instruments/events";
import { useComparison, exitComparison } from "./comparison";
import { useState, useId, useRef, useEffect } from "react";
import { useUiStore } from "@/editor/useUiStore";
import { noReadingReason, quantities } from "@/instruments/model";
import type { Series } from "@/instruments/sampling";
import { useSimStore } from "../sim/simStore";
import { useInstruments } from "./store";
import "./instruments.css";
const fmt = (v: number | null | undefined) => formatNumber(v);
/** Index of the first point after `step` (points are in time order). */
function firstAfter(points: { step: number }[], step: number): number {
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((points[mid]?.step ?? Infinity) <= step) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Name shown for the instant a probe also reads (its own label, or the ruler tick's name). */
const atName = (probe: Series["probe"]) =>
  probe.atLabel ?? (probe.at?.kind === "tick" ? eventNames[probe.at.tick].toLowerCase() : "no evento");

function Chart({
  series,
  shown,
  latest,
  oldest,
  kinds,
}: {
  series: Series;
  shown: number;
  latest: number;
  oldest: number;
  kinds: TickKind[];
}) {
  const uid = useId();
  const width = useInstruments((s) => s.window);
  const pointers = useRef(new Map<number, number>());
  const pinch = useRef(0);
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
  // A probe left on a link that has nothing to read says why instead of a bare dash.
  const reason = useUiStore((s) => {
    const kind = s.current?.scene.links.find((l) => l.id === probe.target)?.kind;
    return kind ? noReadingReason[kind] : undefined;
  });
  const other = useComparison((s) => s.series.find((v) => v.probe.id === probe.id));
  // one pass over the points: the scale (including the other variant and the limit) and the extremes
  let lo = Math.min(0, probe.limit ?? 0);
  let hi = Math.max(1e-6, probe.limit ?? 0);
  let max: (typeof points)[number] | null = null;
  let min: (typeof points)[number] | null = null;
  for (const p of points) {
    if (p.value === null) continue;
    if (p.value < lo) lo = p.value;
    if (p.value > hi) hi = p.value;
    if (!max || p.value > (max.value ?? -Infinity)) max = p;
    if (!min || p.value < (min.value ?? Infinity)) min = p;
  }
  for (const p of other?.points ?? []) {
    if (p.value === null) continue;
    if (p.value < lo) lo = p.value;
    if (p.value > hi) hi = p.value;
  }
  const range = hi - lo || 1;
  const fullEnd = Math.max(1, latest * 240, points.at(-1)?.step ?? 0);
  const span = width === null ? fullEnd : width * 240;
  const begin = Math.max(0, Math.min(shown * 240 - span / 2, fullEnd - span));
  const end = begin + span;
  const x = (step: number) => 12 + ((step - begin) / span) * 276;
  const y = (value: number) => 78 - ((value - lo) / range) * 56;
  // only the stretch inside the window (and one point past each edge) is drawn: a long run has thousands of points
  const trace = (pts: typeof points) => {
    const first = Math.max(0, firstAfter(pts, begin - 1) - 1);
    const last = Math.min(pts.length, firstAfter(pts, end) + 1);
    let d = "";
    for (let i = first; i < last; i++) {
      const p = pts[i];
      if (!p || p.value === null) continue;
      d += `${i > first && pts[i - 1]?.value != null ? "L" : "M"}${x(p.step).toFixed(2)},${y(p.value).toFixed(2)} `;
    }
    return d;
  };
  const path = trace(points);
  const otherPath = other ? trace(other.points) : "";
  const bipolar = (min?.value ?? 0) < 0 && (max?.value ?? 0) > 0;
  const peak = Math.abs(min?.value ?? 0) > Math.abs(max?.value ?? 0) ? min : max;
  // the value at the latest occurrence of the probe's event that the cursor has already passed
  const reached = series.marks?.filter((m) => m.step <= Math.round(shown * 240)).at(-1);
  const pickEvent = (tick: TickKind | "") => {
    const ui = useUiStore.getState();
    ui.setProbes(
      ui.probes.map((p) => {
        if (p.id !== probe.id) return p;
        const next = { ...p };
        delete next.at;
        delete next.atLabel;
        return tick ? { ...next, at: { kind: "tick" as const, tick } } : next;
      }),
    );
  };
  const scrub = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    ctl?.scrub(
      (Math.max(0, Math.min(1, (((clientX - r.left) / r.width) * 300 - 12) / 276)) * span + begin) / 240,
    );
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
        {other && (
          <span className="instrument-chart__difference">
            Δ{" "}
            {fmt(
              cursor?.value != null && other.cursor?.value != null ? other.cursor.value - cursor.value : null,
            )}
          </span>
        )}
        <small title={reason}>
          {reason ??
            (bipolar ? `mín ${fmt(min?.value)} · máx ${fmt(max?.value)}` : `pico ${fmt(peak?.value)}`)}
        </small>
        {probe.at && (
          <strong className="instrument-chart__at">
            {atName(probe)} {fmt(reached?.value)} {quantities[probe.quantity][1]}
          </strong>
        )}
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
          pointers.current.set(e.pointerId, e.clientX);
          if (pointers.current.size === 2) {
            cancelHold();
            const [a, b] = [...pointers.current.values()];
            pinch.current = Math.abs((a ?? 0) - (b ?? 0));
            return;
          }
          start.current = { x: e.clientX, y: e.clientY };
          const rect = e.currentTarget.getBoundingClientRect();
          const value = lo + ((78 - ((e.clientY - rect.top) / rect.height) * 96) / 56) * range;
          cancelHold();
          hold.current = setTimeout(() => setThreshold(value), 550);
          scrub(e.clientX, e.currentTarget);
        }}
        onPointerMove={(e) => {
          if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, e.clientX);
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            const distance = Math.abs((a ?? 0) - (b ?? 0));
            if (distance > 0 && pinch.current > 0)
              useInstruments.getState().setWindow(((width ?? latest) * pinch.current) / distance);
            pinch.current = distance;
            cancelHold();
            return;
          }
          if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) cancelHold();
          if (e.currentTarget.hasPointerCapture(e.pointerId)) scrub(e.clientX, e.currentTarget);
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          cancelHold();
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          cancelHold();
        }}
      >
        <defs>
          <clipPath id={`${uid}-clip`}>
            <rect x="12" y="16" width="276" height="66" />
          </clipPath>
          <pattern id={`${uid}-old`} width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M0 6L6 0" className="instrument-chart__grid" />
          </pattern>
          <pattern id={uid} width="23" height="14" patternUnits="userSpaceOnUse">
            <path d="M23 0H0V14" className="instrument-chart__grid" />
          </pattern>
        </defs>
        <rect x="12" y="22" width="276" height="56" fill={`url(#${uid})`} />
        <path d="M12 22V78H288" className="instrument-chart__axis" />
        {oldest * 240 > begin && (
          <g className="instrument-chart__expired">
            <rect
              x="12"
              y="22"
              width={Math.max(0, Math.min(276, x(oldest * 240) - 12))}
              height="56"
              fill={`url(#${uid}-old)`}
            />
            <text x="16" y="34">
              sem poses antes de {fmt(oldest)} s
            </text>
          </g>
        )}
        <path d={path} clipPath={`url(#${uid}-clip)`} className="instrument-chart__curve" />
        {other && (
          <path
            d={otherPath}
            clipPath={`url(#${uid}-clip)`}
            className="instrument-chart__curve instrument-chart__curve--other"
          />
        )}
        {probe.limit !== undefined && (
          <g className="instrument-chart__limit">
            <path d={`M12 ${y(probe.limit)}H288`} />
            <text x="286" y={y(probe.limit) - 3} textAnchor="end">
              limite {fmt(probe.limit)}
            </text>
          </g>
        )}
        {series.marks
          ?.filter(
            (m): m is typeof m & { value: number } => m.value !== null && m.step >= begin && m.step <= end,
          )
          .map((m) => (
            <path
              key={m.step}
              className="instrument-chart__mark"
              d={`M${x(m.step)} ${y(m.value) - 4}l3.5 4l-3.5 4l-3.5 -4z`}
            />
          ))}
        {peak && peak.value !== null && peak.step >= begin && peak.step <= end && (
          <circle cx={x(peak.step)} cy={y(peak.value)} r="2.5" className="instrument-chart__peak" />
        )}
        <g className="instrument-chart__cursor">
          <path d={`M${x(shown * 240)} 16V82`} />
          <path d={`M${x(shown * 240) - 4} 12h8l-4 5z`} />
        </g>
        <text x="12" y="92">
          {fmt(begin / 240)} s
        </text>
        <text x="288" y="92" textAnchor="end">
          {fmt(end / 240)} s
        </text>
      </svg>
      {(kinds.length > 0 || probe.at) && (
        <label className="instrument-chart__event">
          <span>Ler em</span>
          <select
            aria-label={`Ler ${probe.name} no evento`}
            value={probe.at?.kind === "tick" ? probe.at.tick : probe.at ? "custom" : ""}
            onChange={(e) => pickEvent(e.target.value as TickKind | "")}
          >
            <option value="">Só no cursor</option>
            {probe.at && probe.at.kind !== "tick" && <option value="custom">{atName(probe)}</option>}
            {kinds.map((k) => (
              <option key={k} value={k}>
                {eventNames[k]}
              </option>
            ))}
          </select>
        </label>
      )}
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
  const [expanded, setExpanded] = useState(false);
  const width = useInstruments((s) => s.window);
  const [collapsed, setCollapsed] = useState(false);
  const comparison = useComparison();
  const probes = useUiStore((s) => s.probes);
  const { series, shown, latest, oldest, ticks } = useInstruments();
  const kinds = [...new Set(ticks.map((t) => t.kind))];
  const summary = comparison.ready
    ? comparisonSummary(series, comparison.series, ticks, comparison.ticks)
    : null;
  const thresholdSeries = series.find((s) => s.probe.threshold !== undefined);
  const cycles = thresholdSeries
    ? thresholdSeries.crossings
    : ticks.filter((t) => t.kind === "chamber-fired").length;
  const clicks =
    series.find((s) => s.probe.countDrops)?.clicks ?? ticks.filter((t) => t.kind === "impact").length;
  if (!probes.length && !comparison.request) return null;
  return (
    <section className={`instruments${expanded ? " instruments--expanded" : ""}`} aria-label="Instrumentos">
      <header className="instruments__head">
        <button onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>
          Instrumentos <span>{collapsed ? "＋" : "−"}</span>
        </button>
        {!comparison.request && (
          <small>
            {cycles} {cycles === 1 ? "ciclo" : "ciclos"} · {clicks} {clicks === 1 ? "estalo" : "estalos"} · t
            = {fmt(shown)} s
          </small>
        )}
        {comparison.request && (
          <>
            <small
              className="comparison-summary"
              title={summary?.detail}
              aria-label={summary ? `${summary.lines.join(". ")}. ${summary.detail}` : undefined}
            >
              {summary
                ? summary.lines.map((line) => <span key={line}>{line}</span>)
                : "Preparando comparação…"}
            </small>
            <button
              aria-pressed={comparison.ghost}
              onClick={() => {
                useComparison.setState({ ghost: !comparison.ghost });
                useSimStore.getState().ctl?.redraw();
              }}
            >
              Fantasma
            </button>
            <button onClick={exitComparison}>Sair</button>
          </>
        )}
        <button onClick={() => useInstruments.getState().setWindow(width === null ? 0.5 : null)}>
          {width === null ? "Janela do cursor" : "Execução inteira"}
        </button>
        <button className="instruments__expand" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Compactar" : "Expandir"}
        </button>
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
              oldest={oldest}
              kinds={kinds}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Two short lines for the header (recoil and cycle for the launcher, else the first readings) and the full detail. */
function comparisonSummary(a: Series[], b: Series[], eventsA: EventTick[], eventsB: EventTick[]) {
  const peak = (s: Series | undefined) =>
    s?.points.reduce<number | null>(
      (v, p) => (p.value !== null && (v === null || Math.abs(p.value) > Math.abs(v)) ? p.value : v),
      null,
    );
  const readings = a.map(
    (s) => `${s.probe.name}: A ${fmt(peak(s))} / B ${fmt(peak(b.find((o) => o.probe.id === s.probe.id)))}`,
  );
  const indexed = (events: EventTick[]) => {
    const occurrences = new Map<string, number>();
    return new Map(
      events.map((event) => {
        const key = `${event.kind}:${event.id}`;
        const count = occurrences.get(key) ?? 0;
        occurrences.set(key, count + 1);
        return [`${key}:${count}`, event] as const;
      }),
    );
  };
  const ea = indexed(eventsA),
    eb = indexed(eventsB);
  const events = [...new Set([...ea.keys(), ...eb.keys()])].map((key) => {
    const first = ea.get(key),
      second = eb.get(key);
    const event = first ?? second;
    return event
      ? `${eventNames[event.kind]} (${event.id}): A ${fmt(first ? first.step / 240 : null)} / B ${fmt(second ? second.step / 240 : null)} s`
      : "";
  });
  const launcher = a.some((s) => s.probe.id === "bolt-position");
  const lines = launcher
    ? launcherSummary(launcherMetrics(a, eventsA), launcherMetrics(b, eventsB))
    : a
        .slice(0, 2)
        .map(
          (s) =>
            `${s.probe.name}: A ${fmt(peak(s))} · B ${fmt(peak(b.find((o) => o.probe.id === s.probe.id)))}`,
        );
  return {
    lines,
    detail: [
      ...(launcher ? ["Ciclo: da ignição até o ferrolho voltar a 0,5 mm da pose desenhada"] : []),
      ...readings,
      ...events,
    ].join(" · "),
  };
}
