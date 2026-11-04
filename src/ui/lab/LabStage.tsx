import { useEffect, useMemo, useRef } from "react";
import { FIXED_STEP } from "@/engine/common";
import type { EngineAdapter, Snapshot } from "@/engine/types";
import type { Vec2 } from "@/geometry/vec";
import type { Id, Link, Scene } from "@/model/types";
import { applyInputs, applyRunChanges } from "@/sim/runner";
import type { ScriptRun } from "@/sim/script";
import {
  chamberDraws,
  chamberPolygon,
  coilPoints,
  drawParts,
  poseTransform,
  sceneBounds,
  worldPoint,
} from "./labDraw";

/**
 * Palco do laboratório: a cena rodando no Box2D, desenhada em SVG. A
 * estrutura é montada uma vez; a cada quadro só mudam o `transform` das
 * peças e o desenho das ligações (molas, hastes, cabos, gás).
 */

export interface StageControl {
  /** avança o tempo simulado até `t` sem desenhar cada passo (capturas) */
  seek(t: number): void;
  time(): number;
}

interface Props {
  scene: Scene;
  run: ScriptRun;
  make: () => EngineAdapter;
  paused: boolean;
  speed: number;
  view?: [number, number, number, number];
  /** muda para reiniciar */
  resetKey: number;
  onTime(t: number): void;
  controlRef: { current: StageControl | null };
}

type Two = Extract<Link, { kind: "rod" | "cable" | "spring" }>;

const H = FIXED_STEP;
/** no máximo 40 passos por quadro (1× a 6 quadros/s); o resto do tempo é descartado */
const MAX_STEPS = 40;

export function LabStage({ scene, run, make, paused, speed, view, resetKey, onTime, controlRef }: Props) {
  const compiled = useMemo(() => applyRunChanges(scene, run), [scene, run]);
  const parts = useMemo(() => drawParts(compiled), [compiled]);
  const chambers = useMemo(() => chamberDraws(compiled), [compiled]);
  const twos = useMemo(
    () =>
      compiled.links.filter((l): l is Two => l.kind === "rod" || l.kind === "cable" || l.kind === "spring"),
    [compiled],
  );
  const axles = useMemo(
    () => compiled.links.filter((l) => l.kind === "axle" || l.kind === "mount" || l.kind === "screw"),
    [compiled],
  );
  const vb = sceneBounds(compiled, view);
  const unit = Math.max(vb[2], vb[3]) / 400; // ~1 px de tela em mm no tamanho típico

  const svg = useRef<SVGSVGElement | null>(null);
  const partEls = useRef(new Map<Id, SVGGElement>());
  const linkEls = useRef(new Map<Id, SVGElement>());
  const labelEls = useRef(new Map<Id, SVGTextElement>());
  const adapter = useRef<EngineAdapter | null>(null);
  const simTime = useRef(0);
  const acc = useRef(0);
  const dragging = useRef<Id | null>(null);
  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);
  useEffect(() => {
    pausedRef.current = paused;
    speedRef.current = speed;
  }, [paused, speed]);

  // compila e roda o laço
  useEffect(() => {
    const peak = new Map<Id, number>();
    const draw = (s: Snapshot) => {
      for (const [id, el] of partEls.current) {
        const p = s.parts[id];
        if (p) el.setAttribute("transform", poseTransform(p));
      }
      for (const l of twos) {
        const el = linkEls.current.get(l.id);
        if (!el) continue;
        const a = worldPoint(s, l.a, l.atA);
        const b = worldPoint(s, l.b, l.atB);
        if (l.kind === "spring") el.setAttribute("points", coilPoints(a, b, l.coil.turns, l.coil.outerD));
        else {
          el.setAttribute("x1", String(a[0]));
          el.setAttribute("y1", String(a[1]));
          el.setAttribute("x2", String(b[0]));
          el.setAttribute("y2", String(b[1]));
          if (l.kind === "cable")
            el.classList.toggle("lab__cable--slack", (s.links[l.id]?.slack ?? 0) > 0.05);
        }
      }
      for (const c of chambers) {
        const el = linkEls.current.get(c.link.id);
        const st = s.links[c.link.id];
        if (!el || !st) continue;
        const pts = chamberPolygon(c, s);
        if (pts) el.setAttribute("points", pts);
        const gaugeP = (st.pressure ?? 0) - c.link.gas.p0;
        const pk = Math.max(peak.get(c.link.id) ?? 1, gaugeP);
        peak.set(c.link.id, pk);
        el.setAttribute("fill-opacity", String(Math.max(0.06, Math.min(0.85, (0.85 * gaugeP) / pk))));
        const label = labelEls.current.get(c.link.id);
        if (label) {
          label.textContent = `${Math.round(st.pressure ?? 0)} kPa`;
          const base = worldPoint(s, c.link.body, c.link.at);
          label.setAttribute("x", String(base[0]));
          label.setAttribute("y", String(base[1] - c.link.bore / 2 - 3 * unit));
        }
      }
      for (const l of compiled.links) {
        if (l.kind !== "sensor") continue;
        const el = linkEls.current.get(l.id);
        if (el && s.events.some((e) => e.kind === "sensor" && e.sensor === l.id)) {
          el.classList.add("lab__sensor--hit");
          window.setTimeout(() => el.classList.remove("lab__sensor--hit"), 400);
        }
      }
    };

    const a = make();
    a.compile(compiled, { unitMm: 1 });
    adapter.current = a;
    simTime.current = 0;
    acc.current = 0;
    draw(a.snapshot());
    onTime(0);
    let raf = 0;
    let last = performance.now();
    const stepTo = (target: number) => {
      while (simTime.current + H / 2 < target) {
        applyInputs(a, run.inputs, simTime.current, H);
        a.step(H);
        simTime.current += H;
      }
    };
    controlRef.current = {
      seek(t: number) {
        stepTo(t);
        draw(a.snapshot());
        onTime(simTime.current);
      },
      time: () => simTime.current,
    };
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) {
        acc.current += dt * speedRef.current;
        let n = 0;
        while (acc.current >= H && n < MAX_STEPS) {
          applyInputs(a, run.inputs, simTime.current, H);
          a.step(H);
          simTime.current += H;
          acc.current -= H;
          n++;
        }
        if (n === MAX_STEPS) acc.current = 0;
        if (n) {
          draw(a.snapshot());
          onTime(simTime.current);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      if (document.visibilityState === "visible") raf = requestAnimationFrame(frame);
    };
    // pausa o laço quando a aba sai de foco
    const vis = () => (document.visibilityState === "visible" ? start() : cancelAnimationFrame(raf));
    document.addEventListener("visibilitychange", vis);
    start();
    return () => {
      document.removeEventListener("visibilitychange", vis);
      cancelAnimationFrame(raf);
      a.dispose();
      adapter.current = null;
      controlRef.current = null;
    };
  }, [compiled, run, make, resetKey, twos, chambers, unit, onTime, controlRef]);

  const toMm = (e: React.PointerEvent): Vec2 | null => {
    const m = svg.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const id = (e.target as Element).closest("[data-part]")?.getAttribute("data-part");
    const p = toMm(e);
    if (!id || !p || !adapter.current) return;
    if (adapter.current.dragStart(id, p)) {
      dragging.current = id;
      svg.current?.setPointerCapture(e.pointerId);
      partEls.current.get(id)?.classList.add("lab__part--held");
      e.preventDefault();
    }
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const p = toMm(e);
    if (p) adapter.current?.dragMove(p);
  };
  const onUp = () => {
    if (!dragging.current) return;
    partEls.current.get(dragging.current)?.classList.remove("lab__part--held");
    dragging.current = null;
    adapter.current?.dragEnd();
  };

  const nLayers = compiled.layers.length;
  return (
    <svg
      ref={svg}
      className="lab__svg"
      viewBox={vb.join(" ")}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      role="img"
      aria-label={`Simulação: ${compiled.meta.title}`}
      style={{ ["--u" as string]: `${unit}px` }}
    >
      <defs>
        <pattern
          id="lab-hatch"
          patternUnits="userSpaceOnUse"
          width={5 * unit}
          height={5 * unit}
          patternTransform="rotate(45)"
        >
          <rect className="lab__hatch-bg" width={5 * unit} height={5 * unit} />
          <line className="lab__hatch" x1={0} y1={0} x2={0} y2={5 * unit} />
        </pattern>
      </defs>
      {chambers.map((c) => (
        <polygon
          key={c.link.id}
          className="lab__gas"
          ref={(el) => {
            if (el) linkEls.current.set(c.link.id, el);
          }}
        />
      ))}
      {parts.map((p) => (
        <g
          key={p.part.id}
          ref={(el) => {
            if (el) partEls.current.set(p.part.id, el);
          }}
          className={`lab__part${p.dynamic ? " lab__part--dyn" : ""}`}
          style={{ opacity: 0.55 + (0.45 * (p.layer + 1)) / nLayers }}
        >
          <path
            d={p.d}
            fillRule="evenodd"
            data-part={p.dynamic ? p.part.id : undefined}
            vectorEffect="non-scaling-stroke"
          />
          {compiled.links.map((l) => {
            if ((l.kind === "pin" || l.kind === "sensor") && l.host === p.part.id)
              return (
                <circle
                  key={l.id}
                  cx={l.at[0]}
                  cy={l.at[1]}
                  r={l.r}
                  className={l.kind === "pin" ? "lab__pin" : "lab__sensor"}
                  vectorEffect="non-scaling-stroke"
                  ref={(el) => {
                    if (el && l.kind === "sensor") linkEls.current.set(l.id, el);
                  }}
                />
              );
            return null;
          })}
          {axles.map((l) => {
            if (l.kind !== "axle" && l.kind !== "mount" && l.kind !== "screw") return null;
            if (l.b !== p.part.id) return null;
            const r = 1.6 * unit * 3;
            return (
              <g
                key={l.id}
                className={`lab__joint lab__joint--${l.kind}`}
                transform={`translate(${l.at[0]} ${l.at[1]})`}
              >
                {l.kind === "mount" ? (
                  <rect x={-r} y={-r} width={2 * r} height={2 * r} vectorEffect="non-scaling-stroke" />
                ) : (
                  <circle r={r} vectorEffect="non-scaling-stroke" />
                )}
                <path
                  d={l.kind === "screw" ? `M${-r} ${r}L${r} ${-r}` : `M${-r} 0H${r}M0 ${-r}V${r}`}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </g>
      ))}
      {twos.map((l) =>
        l.kind === "spring" ? (
          <polyline
            key={l.id}
            className="lab__spring"
            vectorEffect="non-scaling-stroke"
            ref={(el) => {
              if (el) linkEls.current.set(l.id, el);
            }}
          />
        ) : (
          <line
            key={l.id}
            className={l.kind === "rod" ? "lab__rod" : "lab__cable"}
            vectorEffect="non-scaling-stroke"
            ref={(el) => {
              if (el) linkEls.current.set(l.id, el);
            }}
          />
        ),
      )}
      {chambers.map((c) => (
        <text
          key={c.link.id}
          className="lab__gauge"
          textAnchor="start"
          style={{ fontSize: `${9 * unit}px` }}
          ref={(el) => {
            if (el) labelEls.current.set(c.link.id, el);
          }}
        />
      ))}
    </svg>
  );
}
