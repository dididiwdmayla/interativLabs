import { eventIcons, eventNames, groupTicks, type EventTick, type TickGroup } from "@/instruments/events";
import { useEffect, useMemo, useRef, useState } from "react";
import { useElementSize } from "../useElementSize";
import { useSimStore, type TimelineState } from "./simStore";

/**
 * Linha do tempo em régua gravada (identidade, "Simulação"): os últimos
 * 10 s, tique longo a cada segundo e curto a cada 0,1 s (só os longos
 * quando ficariam a menos de 4 px), eventos em brasa, cabeça de leitura em ouro com ponta
 * triangular. Arrastar mostra as poses gravadas; continuar reexecuta até
 * ali e segue. A cada quadro só mudam transforms e o texto do tempo.
 */

const WINDOW = 10;
const fmt = (t: number) => `${t.toFixed(3).replace(".", ",")} s`;

export function Timeline() {
  const ctl = useSimStore((s) => s.ctl);
  const recalculating = useSimStore((s) => s.recalculating);
  const ref = useRef<HTMLDivElement>(null);
  const { width } = useElementSize(ref);
  const pad = 10;
  const w = Math.max(0, width - 2 * pad);
  const k = w / WINDOW; // px por segundo
  const strip = useRef<SVGGElement>(null);
  const head = useRef<SVGGElement>(null);
  const timeEl = useRef<HTMLOutputElement>(null);
  const span = useRef<SVGLineElement>(null);
  const [eventName, setEventName] = useState("");
  const [base, setBase] = useState(0);
  const [events, setEvents] = useState<EventTick[]>([]);
  const [open, setOpen] = useState<{ events: EventTick[]; left: number } | null>(null);
  const last = useRef<{ base: number; n: number; w0: number }>({ base: -1, n: -1, w0: 0 });

  useEffect(() => {
    if (!ctl) return;
    const on = (t: TimelineState) => {
      const w1 = Math.max(WINDOW, t.latest);
      const w0 = w1 - WINDOW;
      last.current.w0 = w0;
      const b = Math.floor(w0);
      if (b !== last.current.base) {
        last.current.base = b;
        setBase(b);
      }
      if (t.events.length !== last.current.n) {
        last.current.n = t.events.length;
        setEvents((t.ticks ?? []).slice());
      }
      strip.current?.setAttribute("transform", `translate(${pad - w0 * k} 0)`);
      head.current?.setAttribute("transform", `translate(${pad + (t.shown - w0) * k} 0)`);
      span.current?.setAttribute("x1", String(pad + (t.oldest - w0) * k));
      span.current?.setAttribute("x2", String(pad + (t.latest - w0) * k));
      if (timeEl.current) timeEl.current.textContent = `t = ${fmt(t.shown)}`;
    };
    ctl.setFrameListener(on);
    on(ctl.timeline());
    return () => ctl.setFrameListener(null);
  }, [ctl, k]);

  // tiques de base até base + 11 s, em px absolutos (t · k)
  const short = k * 0.1 >= 4;
  let ticks = "";
  let longs = "";
  for (let i = 0; i <= 110; i++) {
    const t = base + i / 10;
    const x = (t * k).toFixed(2);
    if (i % 10 === 0) longs += `M${x} 10V26`;
    else if (short) ticks += `M${x} 18V26`;
  }

  const groups = useMemo(() => groupTicks(events, k, base), [events, base, k]);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const choose = (event: EventTick) => {
    ctl?.scrub(event.step / 240);
    setEventName(eventNames[event.kind]);
    setOpen(null);
  };
  const openGroup = (group: TickGroup) => {
    ctl?.scrub(group.t);
    const left = pad + (group.t - last.current.w0) * k;
    setOpen({ events: group.events, left: Math.max(0, Math.min(left - 8, width - 232)) });
    setEventName(`${group.events.length} eventos`);
  };

  const scrubAt = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !ctl) return;
    const t = last.current.w0 + (clientX - r.left - pad) / k;
    ctl.scrub(t);
  };

  return (
    <div
      className="timeline"
      ref={ref}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setOpen(null);
        scrubAt(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubAt(e.clientX);
      }}
      role="slider"
      aria-label="Linha do tempo"
      aria-valuemin={0}
      aria-valuemax={WINDOW}
    >
      {width > 0 && (
        <svg className="timeline__svg" width={width} height={44}>
          <line className="timeline__base" x1={pad} x2={width - pad} y1={26} y2={26} />
          <line className="timeline__span" ref={span} y1={26} y2={26} />
          <g ref={strip}>
            <path className="timeline__tick" d={ticks} />
            <path className="timeline__tick timeline__tick--long" d={longs} />
            {groups.map((group) => {
              const first = group.events[0];
              if (!first) return null;
              return group.events.length === 1 ? (
                <g
                  key={`${first.step}:${first.kind}`}
                  transform={`translate(${group.t * k} 0)`}
                  className="timeline__event"
                  role="button"
                  tabIndex={0}
                  aria-label={`${eventNames[first.kind]}, ${fmt(group.t)}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    choose(first);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      choose(first);
                    }
                  }}
                >
                  <title>{eventNames[first.kind]}</title>
                  <rect x="-22" y="-2" width="44" height="44" fill="transparent" stroke="none" />
                  <path d="M0 16V26" />
                  <path d={eventIcons[first.kind]} transform="translate(0 8)" fill="none" />
                </g>
              ) : (
                <g
                  key={`${first.step}:group`}
                  transform={`translate(${group.t * k} 0)`}
                  className="timeline__event timeline__event--group"
                  role="button"
                  tabIndex={0}
                  aria-haspopup="menu"
                  aria-label={`${group.events.length} eventos, a partir de ${fmt(group.t)}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    openGroup(group);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openGroup(group);
                    }
                  }}
                >
                  <title>{`${group.events.length} eventos`}</title>
                  <rect x="-22" y="-2" width="44" height="44" fill="transparent" stroke="none" />
                  <path d="M0 16V26" />
                  <circle cx="0" cy="8" r="8" />
                  <text x="0" y="12" textAnchor="middle">
                    {group.events.length}
                  </text>
                </g>
              );
            })}
          </g>
          <g ref={head} className="timeline__head">
            <path d="M0 8V34" />
            <path d="M-5 2H5L0 8Z" className="timeline__tip" />
          </g>
        </svg>
      )}
      <output className="timeline__time" ref={timeEl}>
        t = {fmt(0)}
      </output>
      {open && (
        <ul
          className="timeline__list"
          role="menu"
          aria-label="Eventos neste ponto"
          style={{ left: open.left }}
          // taps inside the list must not reach the ruler (it would scrub and close the list first)
          onPointerDown={(e) => e.stopPropagation()}
        >
          {open.events.map((event) => (
            <li key={`${event.step}:${event.kind}:${event.id}`} role="none">
              <button type="button" role="menuitem" onClick={() => choose(event)}>
                <svg viewBox="-8 -8 16 16" width="16" height="16" aria-hidden="true">
                  <path d={eventIcons[event.kind]} fill="none" />
                </svg>
                {eventNames[event.kind]} <small>{fmt(event.step / 240)}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {eventName && <output className="timeline__event-name">{eventName}</output>}
      {recalculating && <p className="timeline__recalc">Recalculando…</p>}
    </div>
  );
}
