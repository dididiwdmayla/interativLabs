import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { assets } from "@/assets/registry";
import { toolById } from "@/editor/tools";
import { useUiStore } from "@/editor/useUiStore";
import type { Vec2 } from "@/geometry/vec";
import { linkAt, partAt } from "@/render/hit";
import { StageNodes } from "@/render/nodes";
import type { SceneModel } from "@/render/prepare";
import { SceneSvg, type LayerMode, type Selection } from "@/render/SceneSvg";
import { fitView, mmPerPx, panBy, toWorld, viewMatrix, zoomAt, type View } from "@/render/view";
import { Icon } from "./icons";
import { useSimStore } from "./sim/simStore";
import { Timeline } from "./sim/Timeline";
import { useElementSize } from "./useElementSize";

/**
 * O palco: a prancha onde a cena é desenhada e simulada. O papel é o fundo
 * do contêiner, em escala de tela, deslocado com a vista; a cena é um SVG
 * com um grupo do mundo cuja matriz muda com a pinça e o arrasto do fundo
 * (sem passar pelo React). O que depende do zoom em px de tela (chanfro,
 * degrau da hachura, chamadas) é refeito no fim do gesto.
 *
 * Um dedo no fundo move a vista; na simulação, um dedo numa peça móvel a
 * arrasta. Dois dedos: pinça e movimento. Roda do mouse: zoom no ponto.
 */

interface StageProps {
  model: SceneModel | null;
  figure: number;
  /** muda a cada abertura de cena: reenquadra */
  serial: number;
  mode: "edit" | "simulate";
  selection?: Selection;
  activeLayer?: number;
  layerMode?: LayerMode;
  onSelect?: (s: Selection) => void;
  /** chamado quando a cena monta (a simulação pega os nós aqui) */
  onNodes?: (nodes: StageNodes | null) => void;
  /** sem chamadas, dica nem botão de enquadrar (perf) */
  bare?: boolean;
}

/** margens do enquadramento, px: cima, direita, baixo, esquerda (espaço das chamadas e da régua) */
const FIT_PAD_EDIT: [number, number, number, number] = [64, 44, 64, 44];
const FIT_PAD_SIM: [number, number, number, number] = [56, 32, 92, 32];
const TAP_PX = 8;
const WHEEL_SETTLE_MS = 160;

interface Pointer {
  id: number;
  x: number;
  y: number;
  x0: number;
  y0: number;
  t0: number;
}

function paperStyle(): React.CSSProperties {
  const a = assets["paper-stage"];
  return {
    backgroundImage: `image-set(url("${a.src.x1}") 1x, url("${a.src.x2}") 2x)`,
    backgroundSize: `${a.width}px ${a.height}px`,
  };
}

export function Stage({
  model,
  figure,
  serial,
  mode,
  selection = null,
  activeLayer = 0,
  layerMode = "focus",
  onSelect,
  onNodes,
  bare = false,
}: StageProps) {
  const box = useRef<HTMLDivElement>(null);
  const world = useRef<SVGGElement>(null);
  const { width, height } = useElementSize(box);
  const uid = useId().replace(/:/g, "");
  const tool = useUiStore((s) => s.tool);
  const ctl = useSimStore((s) => s.ctl);
  const editing = mode === "edit";

  const nodes = useMemo(() => (model ? new StageNodes(model) : null), [model]);
  useEffect(() => {
    onNodes?.(nodes);
  }, [nodes, onNodes]);

  const view = useRef<View>({ zoom: 1, tx: 0, ty: 0 });
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);

  const writeView = useCallback(() => {
    const v = view.current;
    world.current?.setAttribute("transform", viewMatrix(v));
    if (box.current) box.current.style.backgroundPosition = `${v.tx}px ${v.ty}px`;
  }, []);

  /** fim do gesto: o que é medido em px de tela é refeito */
  const settle = useCallback(() => {
    setZoom((z) => (Math.abs(z - view.current.zoom) > 1e-6 ? view.current.zoom : z));
  }, []);

  const fit = useCallback(() => {
    if (!model || width <= 0 || height <= 0) return;
    const v = fitView(model.bounds, width, height, editing ? FIT_PAD_EDIT : FIT_PAD_SIM);
    view.current = v;
    setFitZoom(v.zoom);
    writeView();
    settle();
  }, [model, width, height, editing, writeView, settle]);

  // enquadra ao abrir a cena e na primeira medida do palco
  const fitted = useRef<string>("");
  useLayoutEffect(() => {
    const key = `${serial}:${width > 0 && height > 0}`;
    if (fitted.current === key || width <= 0) return;
    fitted.current = key;
    fit();
  }, [serial, width, height, fit]);

  useLayoutEffect(() => {
    nodes?.setWorld(world.current);
    writeView();
  });

  // ——— gestos ———
  const pointers = useRef(new Map<number, Pointer>());
  const gesture = useRef<{
    kind: "none" | "pan" | "pinch" | "drag";
    start?: View;
    d0?: number;
    m0?: Vec2;
    tap?: boolean;
  }>({ kind: "none" });

  const local = (e: { clientX: number; clientY: number }): Vec2 => {
    const r = box.current?.getBoundingClientRect();
    return r ? [e.clientX - r.left, e.clientY - r.top] : [0, 0];
  };

  const beginPinch = () => {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b) return;
    gesture.current = {
      kind: "pinch",
      start: { ...view.current },
      d0: Math.hypot(b.x - a.x, b.y - a.y) || 1,
      m0: [(a.x + b.x) / 2, (a.y + b.y) / 2],
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest(".stage__ui")) return;
    if (!model || !nodes) return;
    const [x, y] = local(e);
    box.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { id: e.pointerId, x, y, x0: x, y0: y, t0: performance.now() });
    if (pointers.current.size === 2) {
      if (gesture.current.kind === "drag") ctl?.dragEnd();
      beginPinch();
      return;
    }
    if (pointers.current.size > 2) return;
    const w = toWorld(view.current, x, y);
    if (!editing && ctl && ctl.dragAt(w)) {
      gesture.current = { kind: "drag" };
      return;
    }
    gesture.current = { kind: "pan", start: { ...view.current }, tap: true };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    const [x, y] = local(e);
    p.x = x;
    p.y = y;
    const g = gesture.current;
    if (g.kind === "drag") {
      ctl?.dragMove(toWorld(view.current, x, y));
    } else if (g.kind === "pan" && g.start) {
      if (Math.hypot(x - p.x0, y - p.y0) > TAP_PX) g.tap = false;
      if (!g.tap) {
        view.current = panBy(g.start, x - p.x0, y - p.y0);
        writeView();
      }
    } else if (g.kind === "pinch" && g.start && g.d0 && g.m0) {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const m: Vec2 = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      const z = zoomAt(g.start, d / g.d0, g.m0[0], g.m0[1]);
      view.current = panBy(z, m[0] - g.m0[0], m[1] - g.m0[1]);
      writeView();
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    if (!p) return;
    const g = gesture.current;
    if (g.kind === "drag") {
      ctl?.dragEnd();
      gesture.current = { kind: "none" };
      return;
    }
    if (g.kind === "pinch") {
      if (pointers.current.size === 1) {
        // sobra um dedo: continua movendo a vista a partir daqui
        const q = [...pointers.current.values()][0];
        if (q) {
          q.x0 = q.x;
          q.y0 = q.y;
        }
        gesture.current = { kind: "pan", start: { ...view.current }, tap: false };
      } else gesture.current = { kind: "none" };
      settle();
      return;
    }
    if (g.kind === "pan") {
      if (g.tap && e.type === "pointerup" && editing && model && nodes) {
        const w = toWorld(view.current, p.x, p.y);
        const px = mmPerPx(view.current.zoom);
        const link = linkAt(model, w, 14 * px);
        const part = link ? null : partAt(model, nodes.frame, w, { tol: 8 * px });
        onSelect?.(link ? { kind: "link", id: link } : part ? { kind: "part", id: part } : null);
      }
      gesture.current = { kind: "none" };
      settle();
    }
  };

  // roda do mouse: zoom no ponto (listener passivo falso para impedir a rolagem da página)
  const wheelTimer = useRef(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const on = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const k = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
      view.current = zoomAt(view.current, k, e.clientX - r.left, e.clientY - r.top);
      writeView();
      window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(settle, WHEEL_SETTLE_MS);
    };
    el.addEventListener("wheel", on, { passive: false });
    return () => el.removeEventListener("wheel", on);
  }, [writeView, settle]);

  // depois de remontar (zoom novo), a simulação reescreve o quadro dela
  useLayoutEffect(() => {
    ctl?.redraw();
  }, [zoom, ctl]);

  const ready = width > 0 && height > 0;
  const inset = 8;
  const gap = 3;
  const title = model?.scene.meta.title ?? "";
  const close = zoom >= 3;

  return (
    <main
      className="stage"
      ref={box}
      data-mode={mode}
      style={paperStyle()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {ready && (
        <svg
          className={`stage__svg scene${close ? " is-close" : ""}`}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          data-mode={mode}
          aria-label={`Prancha: ${title}`}
        >
          <defs>
            <clipPath id={`${uid}clip`}>
              <rect
                x={inset + gap}
                y={inset + gap}
                width={width - 2 * (inset + gap)}
                height={height - 2 * (inset + gap)}
              />
            </clipPath>
            <radialGradient id={`${uid}v`} cx="50%" cy="48%" r="75%">
              <stop offset="60%" className="stage__vignette-in" />
              <stop offset="100%" className="stage__vignette-out" />
            </radialGradient>
          </defs>
          <rect width={width} height={height} fill={`url(#${uid}v)`} />
          <g clipPath={`url(#${uid}clip)`}>
            <g className="world" ref={world}>
              {model && nodes && (
                <SceneSvg
                  model={model}
                  nodes={nodes}
                  uid={uid}
                  zoom={zoom}
                  fitZoom={fitZoom}
                  mode={mode}
                  layerMode={layerMode}
                  active={activeLayer}
                  selection={selection}
                  callouts={!bare}
                />
              )}
            </g>
          </g>
          <rect
            className="stage__frame stage__frame--outer"
            x={inset}
            y={inset}
            width={width - 2 * inset}
            height={height - 2 * inset}
          />
          <rect
            className={`stage__frame stage__frame--inner${editing ? " is-draft" : ""}`}
            x={inset + gap}
            y={inset + gap}
            width={width - 2 * (inset + gap)}
            height={height - 2 * (inset + gap)}
          />
          {editing && (
            <text className="stage__fig" x={inset + gap + 14} y={height - inset - gap - 14}>
              <tspan className="stage__fig-script">Fig. {figure}</tspan>
              <tspan className="stage__fig-name" dx="10">
                {title}
              </tspan>
            </text>
          )}
        </svg>
      )}
      {!bare && (
        <div className="stage__ui stage__corner">
          <button
            type="button"
            className="iconbtn stage__fit"
            aria-label="Enquadrar"
            title="Enquadrar"
            onClick={fit}
          >
            <Icon name="fit" uid={`${uid}fit`} />
          </button>
        </div>
      )}
      {editing && !bare && (
        <p className="stage__hint" aria-live="polite">
          {toolById(tool).hint}
        </p>
      )}
      {!editing && !bare && <Timeline />}
    </main>
  );
}
