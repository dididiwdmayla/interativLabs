import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { assets } from "@/assets/registry";
import { MultiTap } from "@/editor/gestures";
import { MENUS, menuAt } from "@/editor/menus";
import { useUiStore } from "@/editor/useUiStore";
import type { Vec2 } from "@/geometry/vec";
import { linkAt, partAt } from "@/render/hit";
import { StageNodes } from "@/render/nodes";
import type { SceneModel } from "@/render/prepare";
import { SceneSvg, type LayerMode, type Selection } from "@/render/SceneSvg";
import {
  fitView,
  hatchStep,
  mmPerPx,
  panBy,
  toScreen,
  toWorld,
  viewMatrix,
  zoomAt,
  type View,
} from "@/render/view";
import { useSimStore } from "./sim/simStore";
import { hitEdgeMenu } from "./edgeMenuState";
import { runMenuItem } from "./menuActions";
import { stageApi } from "./stageApi";
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
  /** sem chamadas (perf) */
  bare?: boolean;
  /** margens do enquadramento, px: cima, direita, baixo, esquerda (cantos, abas e régua) */
  fitPad?: { edit: Pad; sim: Pad };
  /** primeiro toque na prancha (a dica some) */
  onFirstTouch?: () => void;
}

type Pad = [number, number, number, number];

/** margens padrão do enquadramento, px: cima, direita, baixo, esquerda */
const FIT_PAD_EDIT: Pad = [64, 44, 64, 44];
const FIT_PAD_SIM: Pad = [56, 32, 92, 32];
const TAP_PX = 8;
/** faixa lateral do gesto do menu, fração da largura da prancha */
const EDGE_ZONE = 0.15;
const HOLD_MS = 1000;
const HOLD_PX = 8;
const SNAP_MS = 220;
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
  fitPad,
  onFirstTouch,
}: StageProps) {
  const box = useRef<HTMLDivElement>(null);
  const sheets = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(box);
  const uid = useId().replace(/:/g, "");
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
    const m = viewMatrix(v);
    if (nodes) for (const g of nodes.worlds.values()) g.setAttribute("transform", m);
    if (box.current) box.current.style.backgroundPosition = `${v.tx}px ${v.ty}px`;
  }, [nodes]);

  /** fim do gesto: o que é medido em px de tela é refeito */
  const settle = useCallback(() => {
    setZoom((z) => (Math.abs(z - view.current.zoom) > 1e-6 ? view.current.zoom : z));
  }, []);

  const fit = useCallback(() => {
    if (!model || width <= 0 || height <= 0) return;
    const pad = editing ? (fitPad?.edit ?? FIT_PAD_EDIT) : (fitPad?.sim ?? FIT_PAD_SIM);
    const v = fitView(model.focus, width, height, pad);
    view.current = v;
    setFitZoom(v.zoom);
    writeView();
    settle();
  }, [model, width, height, editing, writeView, settle, fitPad]);

  // a vista para o resto da interface (gaveta, menus)
  useEffect(() => {
    if (bare) return;
    const rect = () => box.current?.getBoundingClientRect();
    stageApi.set({
      view: () => view.current,
      clientToWorld: (x, y) => {
        const r = rect();
        return toWorld(view.current, x - (r?.left ?? 0), y - (r?.top ?? 0));
      },
      worldToClient: (p) => {
        const r = rect();
        const q = toScreen(view.current, p);
        return [q[0] + (r?.left ?? 0), q[1] + (r?.top ?? 0)];
      },
      overStage: (x, y) => {
        const r = rect();
        return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      },
      center: () => toWorld(view.current, width / 2, height / 2),
      fit,
    });
    return () => stageApi.set(null);
  }, [bare, fit, width, height]);

  // enquadra ao abrir a cena e na primeira medida do palco
  const fitted = useRef<string>("");
  useLayoutEffect(() => {
    const key = `${serial}:${width > 0 && height > 0}:${model !== null}`;
    if (fitted.current === key || width <= 0) return;
    fitted.current = key;
    fit();
  }, [serial, width, height, model, fit]);

  useLayoutEffect(() => {
    nodes?.setRoot(sheets.current);
    writeView();
  });

  // ——— gestos ———
  const pointers = useRef(new Map<number, Pointer>());
  const multi = useRef(new MultiTap());
  /** vista no começo de um toque com vários dedos (volta para ela se for desfazer) */
  const multiView = useRef<View | null>(null);
  const gesture = useRef<{
    kind: "none" | "pan" | "pinch" | "drag" | "menu";
    start?: View;
    d0?: number;
    m0?: Vec2;
    tap?: boolean;
  }>({ kind: "none" });

  // ——— segurar na borda: menu circular (docs/arquitetura.md §6) ———
  const ring = useRef<HTMLDivElement>(null);
  const hold = useRef<{ ax: number; ay: number; side: "left" | "right"; timer: number } | null>(null);
  const showRing = (x: number, y: number) => {
    const el = ring.current;
    if (!el) return;
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.classList.remove("is-on");
    void el.offsetWidth; // reinicia a animação do anel
    el.classList.add("is-on");
  };
  const clearHold = () => {
    if (hold.current) window.clearTimeout(hold.current.timer);
    hold.current = null;
    ring.current?.classList.remove("is-on");
  };
  /** começa (ou recomeça) a contar o segundo parado, se o dedo está na faixa lateral */
  const armHold = (x: number, y: number) => {
    clearHold();
    if (bare || width <= 0) return;
    const side = x < width * EDGE_ZONE ? "left" : x > width * (1 - EDGE_ZONE) ? "right" : null;
    if (!side) return;
    const ui = useUiStore.getState();
    if (!MENUS[menuAt(side, ui.lefty)].modes.includes(ui.mode)) return;
    showRing(x, y);
    const timer = window.setTimeout(() => {
      const g = gesture.current;
      const h = hold.current;
      if (g.kind !== "pan" || !h || pointers.current.size !== 1) return;
      clearHold();
      useUiStore.getState().setEdgeMenu({ side: h.side, cy: h.ay, hover: null });
      // a vista volta, com animação curta, para onde estava antes do gesto
      if (g.start) animateView(g.start);
      gesture.current = { kind: "menu" };
    }, HOLD_MS);
    hold.current = { ax: x, ay: y, side, timer };
  };
  const anim = useRef(0);
  const animateView = (to: View) => {
    cancelAnimationFrame(anim.current);
    const from = { ...view.current };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      view.current = to;
      writeView();
      settle();
      return;
    }
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / SNAP_MS);
      const e = 1 - (1 - k) ** 3;
      view.current = {
        zoom: from.zoom + (to.zoom - from.zoom) * e,
        tx: from.tx + (to.tx - from.tx) * e,
        ty: from.ty + (to.ty - from.ty) * e,
      };
      writeView();
      if (k < 1) anim.current = requestAnimationFrame(step);
      else settle();
    };
    anim.current = requestAnimationFrame(step);
  };
  useEffect(() => () => clearHold(), []);

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
    onFirstTouch?.();
    const [x, y] = local(e);
    box.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { id: e.pointerId, x, y, x0: x, y0: y, t0: performance.now() });
    if (e.pointerType === "touch") {
      if (pointers.current.size === 1) multiView.current = { ...view.current };
      multi.current.down(e.pointerId, x, y, e.timeStamp);
    }
    if (pointers.current.size === 2) {
      clearHold();
      if (gesture.current.kind === "menu") return;
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
    armHold(x, y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    const [x, y] = local(e);
    p.x = x;
    p.y = y;
    if (e.pointerType === "touch") multi.current.move(e.pointerId, x, y);
    const g = gesture.current;
    if (g.kind === "menu") {
      const ui = useUiStore.getState();
      const hover = hitEdgeMenu(x, y);
      if (ui.edgeMenu && ui.edgeMenu.hover !== hover) ui.setEdgeMenu({ ...ui.edgeMenu, hover });
    } else if (g.kind === "drag") {
      ctl?.dragMove(toWorld(view.current, x, y));
    } else if (g.kind === "pan" && g.start) {
      const h = hold.current;
      if (pointers.current.size === 1 && (!h || Math.hypot(x - h.ax, y - h.ay) > HOLD_PX)) armHold(x, y);
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
    if (e.pointerType === "touch") {
      const n =
        e.type === "pointerup"
          ? multi.current.up(e.pointerId, e.timeStamp)
          : (multi.current.cancel(e.pointerId), 0);
      if (n && editing) {
        // toque de dois dedos desfaz, de três refaz; a vista volta para onde estava
        if (multiView.current) {
          view.current = multiView.current;
          writeView();
        }
        gesture.current = { kind: "none" };
        if (n === 2) useUiStore.getState().undo();
        else useUiStore.getState().redo();
        settle();
        return;
      }
    }
    const g = gesture.current;
    clearHold();
    if (g.kind === "menu") {
      // deslizar e soltar: escolhe o item sob o dedo; sem item, o menu fica aberto
      const hover = useUiStore.getState().edgeMenu?.hover;
      gesture.current = { kind: "none" };
      if (hover && e.type === "pointerup") runMenuItem(hover);
      return;
    }
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

  // troca de degrau da hachura: transição de opacidade de 120 ms (identidade, "Como o zoom afeta")
  const step = hatchStep(zoom);
  const lastStep = useRef(step);
  const [restep, setRestep] = useState<"a" | "b" | undefined>(undefined);
  useLayoutEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    setRestep((r) => (r === "a" ? "b" : "a"));
  }, [step]);

  const ready = width > 0 && height > 0;
  const inset = 8;
  const gap = 3;
  const title = model?.scene.meta.title ?? "";

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
      <div className="stage__vignette" aria-hidden="true" />
      <div className="holdring" ref={ring} aria-hidden="true">
        <span className="holdring__track" />
        <span className="holdring__fill" />
      </div>
      {ready && (
        <div
          className="stage__sheets"
          ref={sheets}
          data-restep={restep}
          role="img"
          aria-label={`Prancha: ${title}`}
        >
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
              size={{ width, height }}
            />
          )}
        </div>
      )}
      {ready && (
        <svg className="stage__svg stage__chrome" width={width} height={height} aria-hidden="true">
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
          {editing && !bare && (
            <text className="stage__fig" x={width / 2} y={height - inset - gap - 14} textAnchor="middle">
              <tspan className="stage__fig-script">Fig. {figure}</tspan>
            </text>
          )}
        </svg>
      )}
    </main>
  );
}
