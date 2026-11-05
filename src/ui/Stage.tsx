import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { assets } from "@/assets/registry";
import { MultiTap } from "@/editor/gestures";
import { MENUS, menuAt } from "@/editor/menus";
import { useUiStore } from "@/editor/useUiStore";
import type { PartPose } from "@/engine/types";
import { movePart, scalePart, scaleShape, setPose } from "@/editor/commands";
import { handlesFor, localBox, stretchTo, type Handle, type StretchResult } from "@/editor/handles";
import { snapAngle, snapMove, type SnapFeature, type SnapTargets } from "@/editor/snap";
import { snapFeatures, snapTargets } from "@/editor/snapScene";
import { shapeOutline } from "@/geometry/outline";
import type { Vec2 } from "@/geometry/vec";
import type { Part, Shape } from "@/model/types";
import { clampParams, paramsOf, regenerate } from "@/parts";
import { linkAt, partAt } from "@/render/hit";
import { StageNodes, drawnFrame, overrideFrame } from "@/render/nodes";
import { localOf, outlinePath, worldOf, type PartModel, type SceneModel } from "@/render/prepare";
import { SceneSvg, type LayerMode, type Selection } from "@/render/SceneSvg";
import {
  fitAround,
  fitView,
  type ScreenRect,
  hatchStep,
  mmPerPx,
  panBy,
  toScreen,
  toWorld,
  viewMatrix,
  zoomAt,
  type View,
} from "@/render/view";
import { EditOverlay, type OverlayHandle } from "./EditOverlay";
import { Icon } from "./icons";
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
  /**
   * controles que flutuam sobre a prancha, em px relativos ao palco: com
   * eles, o enquadramento desvia só do que cobrem (fitAround) e a margem
   * `fitPad` vira só a borda das áreas seguras
   */
  obstacles?: (stage: DOMRect) => { rects: ScreenRect[]; edge: Pad };
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
/** arrastar uma peça não selecionada: seleciona e move depois de 6 px */
const MOVE_PX = 6;
const LONG_MS = 500;
/** alvo das alças, px (44 de diâmetro) */
const HANDLE_PX = 22;
/** tolerância do encaixe, px de tela */
const SNAP_PX = 10;

type Gesture =
  | { kind: "none" }
  | { kind: "menu" }
  | { kind: "drag" }
  | { kind: "pan"; start: View; tap: boolean }
  | { kind: "pinch"; start: View; d0: number; m0: Vec2 }
  | {
      kind: "press";
      target: NonNullable<Selection>;
      start: View;
      timer: number;
      /** arrastar move a peça (camada ativa ou já escolhida); senão, move a vista */
      movable: boolean;
    }
  | {
      kind: "move";
      id: string;
      pose: PartPose;
      grab: Vec2;
      last: PartPose | null;
      features: SnapFeature[];
      targets: SnapTargets;
    }
  | { kind: "rotate"; id: string; pose: PartPose; a0: number; last: PartPose | null }
  | { kind: "stretch"; id: string; pose: PartPose; handle: Handle; last: StretchResult | null };

function vibrate(ms: number) {
  try {
    // só Chrome Android (sem suporte no Safari); exige um gesto da pessoa
    navigator.vibrate?.(ms);
  } catch {
    // sem vibração
  }
}

/** Contorno de prévia do esticar, no espaço local da peça. */
function previewPath(part: Part, res: StretchResult): string | null {
  let shape: Shape;
  if (res.kind === "params") {
    const pp = paramsOf(part);
    if (!pp) return null;
    shape = pp.g.build(clampParams(pp.g, { ...pp.params, ...res.params }));
  } else {
    const uniform = part.shape.kind !== "poly";
    const k = (res.sx + res.sy) / 2;
    shape = scaleShape(part.shape, uniform ? k : res.sx, uniform ? k : res.sy);
  }
  const o = shapeOutline(shape);
  return o.ok ? outlinePath(o.value.outline) : null;
}

/** Posição do botão da peça (px do palco): acima da seleção, ou embaixo se faltar espaço ou o dedo estiver em cima. */
function partButtonPos(m: PartModel, pose: PartPose, v: View, w: number, h: number, fingerY?: number): Vec2 {
  const b = localBox(m);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of [
    [b.x0, b.y0],
    [b.x1, b.y0],
    [b.x1, b.y1],
    [b.x0, b.y1],
  ] as Vec2[]) {
    const s = toScreen(v, worldOf(pose, q));
    x0 = Math.min(x0, s[0]);
    y0 = Math.min(y0, s[1]);
    x1 = Math.max(x1, s[0]);
    y1 = Math.max(y1, s[1]);
  }
  // no canto de cima, ao lado: a alça de girar fica no meio de cima e as de esticar nas laterais
  const right = x1 + BTN_GAP;
  const left = x0 - BTN_GAP;
  const x = right <= w - 40 ? right : left >= 40 ? left : Math.min(w - 40, Math.max(40, (x0 + x1) / 2));
  const above = y0 - BTN_GAP / 2;
  const below = y1 + BTN_GAP / 2;
  const fingerAbove = fingerY !== undefined && fingerY < (y0 + y1) / 2;
  let y = above < BTN_MIN_Y || fingerAbove ? below : above;
  if (y > h - BTN_MIN_Y) y = Math.max(BTN_MIN_Y, above);
  return [x, Math.min(h - 40, Math.max(BTN_MIN_Y, y))];
}

/** px entre a caixa da peça e o centro do botão; px livres no topo e embaixo (cantos) */
const BTN_GAP = 34;
const BTN_MIN_Y = 76;
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
  obstacles,
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
  /** chamado a cada mudança da vista (o botão da peça acompanha) */
  const onView = useRef<(() => void) | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);

  const writeView = useCallback(() => {
    const v = view.current;
    const m = viewMatrix(v);
    if (nodes) for (const g of nodes.worlds.values()) g.setAttribute("transform", m);
    if (box.current) box.current.style.backgroundPosition = `${v.tx}px ${v.ty}px`;
    onView.current?.();
  }, [nodes]);

  /** fim do gesto: o que é medido em px de tela é refeito */
  const settle = useCallback(() => {
    setZoom((z) => (Math.abs(z - view.current.zoom) > 1e-6 ? view.current.zoom : z));
  }, []);

  const fit = useCallback(() => {
    if (!model || width <= 0 || height <= 0) return;
    const pad = editing ? (fitPad?.edit ?? FIT_PAD_EDIT) : (fitPad?.sim ?? FIT_PAD_SIM);
    const rect = box.current?.getBoundingClientRect();
    const obs = rect && obstacles ? obstacles(rect) : null;
    const v = obs
      ? fitAround(model.focus, width, height, obs.rects, obs.edge)
      : fitView(model.focus, width, height, pad);
    view.current = v;
    setFitZoom(v.zoom);
    writeView();
    settle();
  }, [model, width, height, editing, writeView, settle, fitPad, obstacles]);

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
  const gesture = useRef<Gesture>({ kind: "none" });
  const overlay = useRef<OverlayHandle>(null);
  const partBtn = useRef<HTMLButtonElement>(null);
  const snapKey = useRef<string | null>(null);

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
      const panning = g.kind === "pan" || (g.kind === "press" && !g.movable);
      if (!panning || !h || pointers.current.size !== 1) return;
      if (g.kind === "press") window.clearTimeout(g.timer);
      clearHold();
      useUiStore.getState().setEdgeMenu({ side: h.side, cy: h.ay, hover: null });
      // a vista volta, com animação curta, para onde estava antes do gesto
      animateView(g.start);
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

  // ——— edição: peça mais alta sob o dedo, alças, pose durante o gesto ———
  const layerOk = (i: number) => {
    const L = model?.layers[i]?.layer;
    return !!L && L.visible && !L.locked;
  };
  const pickPart = (w: Vec2): string | null => {
    if (!model || !nodes) return null;
    const tol = 8 * mmPerPx(view.current.zoom);
    return (
      partAt(model, nodes.frame, w, { tol, layer: (i) => i === activeLayer && layerOk(i) }) ??
      partAt(model, nodes.frame, w, { tol, layer: layerOk })
    );
  };
  const pickLink = (w: Vec2): string | null => {
    if (!model) return null;
    const id = linkAt(model, w, 14 * mmPerPx(view.current.zoom));
    const lm = id ? model.linkById.get(id) : null;
    return lm && model.layers[lm.layer]?.layer.visible !== false ? id : null;
  };
  const selectPart = (id: string) => {
    const m = model?.parts.get(id);
    if (!m) return;
    const ui = useUiStore.getState();
    if (m.layer !== ui.activeLayer) ui.setActiveLayer(m.layer);
    if (ui.selection?.id !== id) onSelect?.({ kind: "part", id });
  };
  const selModel = selection?.kind === "part" ? (model?.parts.get(selection.id) ?? null) : null;
  const selEditable = editing && !bare && !!selModel && layerOk(selModel.layer);
  const handles = useMemo(
    () => (selEditable && selModel ? handlesFor(selModel, mmPerPx(zoom)) : []),
    [selEditable, selModel, zoom],
  );
  const hitHandle = (x: number, y: number): Handle | null => {
    if (!selModel || handles.length === 0) return null;
    let best: Handle | null = null;
    let bd = HANDLE_PX;
    for (const h of handles) {
      const s = toScreen(view.current, worldOf(selModel.part, h.local));
      const d = Math.hypot(s[0] - x, s[1] - y);
      if (d <= bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  };
  /** escreve a pose da peça no gesto (a cena só muda ao soltar) */
  const showPose = (id: string, pose: PartPose | null, fingerY?: number) => {
    if (!model || !nodes) return;
    const base = drawnFrame(model);
    nodes.write(pose ? overrideFrame(base, id, pose) : base, true);
    overlay.current?.pose(pose);
    placePartButton(pose ?? model.drawn.get(id) ?? null, fingerY);
  };
  /** botão da peça: acima da seleção, dentro da tela, do lado oposto ao dedo */
  const placePartButton = (pose: PartPose | null, fingerY?: number) => {
    const el = partBtn.current;
    if (!el || !selModel || !pose) return;
    const pos = partButtonPos(selModel, pose, view.current, width, height, fingerY);
    el.style.transform = `translate(${Math.round(pos[0])}px, ${Math.round(pos[1])}px)`;
  };
  useLayoutEffect(() => {
    onView.current = selModel ? () => placePartButton(selModel.part) : null;
    if (selModel && gesture.current.kind === "none") placePartButton(selModel.part);
  });
  const snapTo = (k: string | null) => {
    if (k && k !== snapKey.current) vibrate(10);
    snapKey.current = k;
  };
  const endEditGesture = () => {
    overlay.current?.guides([]);
    overlay.current?.preview(null);
    snapKey.current = null;
    sheets.current?.classList.remove("is-dragging");
  };

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
      panBy: (dx, dy) => animateView(panBy(view.current, dx, dy)),
      insertPreview: (shape, cx, cy) => {
        const r = rect();
        if (!shape || cx === undefined || cy === undefined || !r || !model) {
          overlay.current?.ghost(null);
          overlay.current?.guides([]);
          snapKey.current = null;
          return null;
        }
        if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) {
          overlay.current?.ghost(null);
          overlay.current?.guides([]);
          return null;
        }
        const o = shapeOutline(shape);
        if (!o.ok) return null;
        const w = toWorld(view.current, cx - r.left, cy - r.top);
        const feats: SnapFeature[] = [{ local: [0, 0], kind: "origin" }];
        for (const sh of o.value.outline) {
          for (const h of sh.holes) {
            const c = h.reduce<Vec2>((a, q) => [a[0] + q[0] / h.length, a[1] + q[1] / h.length], [0, 0]);
            feats.push({ local: c, kind: "center" });
          }
          if (shape.kind === "poly" && sh.outer.length <= 24)
            for (const v of sh.outer) feats.push({ local: v, kind: "vertex" });
        }
        const sn = snapMove(
          { x: w[0], y: w[1], angle: 0 },
          feats,
          snapTargets(model, ""),
          SNAP_PX * mmPerPx(view.current.zoom),
        );
        const pose = { x: sn.x, y: sn.y, angle: 0 };
        overlay.current?.ghost(outlinePath(o.value.outline), pose);
        overlay.current?.guides(sn.guides);
        snapTo(sn.key);
        return pose;
      },
    });
    return () => stageApi.set(null);
    // animateView, snapTo e overlay só usam refs e o writeView (que muda com a cena, já nas dependências)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bare, fit, width, height, model]);

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
      const g = gesture.current;
      if (g.kind === "menu") return;
      if (g.kind === "drag") ctl?.dragEnd();
      if (g.kind === "press") window.clearTimeout(g.timer);
      if (g.kind === "move" || g.kind === "rotate" || g.kind === "stretch") {
        // o segundo dedo cancela a edição em curso: a peça volta
        showPose(g.id, null);
        endEditGesture();
      }
      beginPinch();
      return;
    }
    if (pointers.current.size > 2) return;
    const w = toWorld(view.current, x, y);
    if (!editing) {
      if (ctl && ctl.dragAt(w)) {
        gesture.current = { kind: "drag" };
        return;
      }
    } else if (!bare) {
      const h = hitHandle(x, y);
      if (h && selModel) {
        const pose = { x: selModel.part.x, y: selModel.part.y, angle: selModel.part.angle };
        gesture.current =
          h.kind === "rotate"
            ? {
                kind: "rotate",
                id: selModel.part.id,
                pose,
                a0: Math.atan2(w[1] - pose.y, w[0] - pose.x),
                last: pose,
              }
            : { kind: "stretch", id: selModel.part.id, pose, handle: h, last: null };
        return;
      }
      const link = pickLink(w);
      const part = link ? null : pickPart(w);
      if (link || part) {
        const target: NonNullable<Selection> = link
          ? { kind: "link", id: link }
          : { kind: "part", id: part ?? "" };
        const timer = window.setTimeout(() => {
          const g = gesture.current;
          if (g.kind !== "press") return;
          // toque longo: abre o cartão rápido da peça (ou da ligação)
          if (g.target.kind === "part") selectPart(g.target.id);
          else onSelect?.(g.target);
          useUiStore.getState().setSheet("card");
          vibrate(10);
          gesture.current = { kind: "none" };
        }, LONG_MS);
        // peça de outra camada (a placa de base, por exemplo): o toque escolhe, o arrasto move a vista
        const pm = part ? model.parts.get(part) : undefined;
        const movable = !!pm && (pm.layer === activeLayer || selection?.id === part);
        gesture.current = { kind: "press", target, start: { ...view.current }, timer, movable };
        if (!movable) armHold(x, y);
        return;
      }
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
    const w = toWorld(view.current, x, y);
    if (g.kind === "menu") {
      const ui = useUiStore.getState();
      const hover = hitEdgeMenu(x, y);
      if (ui.edgeMenu && ui.edgeMenu.hover !== hover) ui.setEdgeMenu({ ...ui.edgeMenu, hover });
    } else if (g.kind === "drag") {
      ctl?.dragMove(w);
    } else if (g.kind === "press") {
      const moved = Math.hypot(x - p.x0, y - p.y0);
      if (g.target.kind === "part" && g.movable && moved > MOVE_PX && model) {
        window.clearTimeout(g.timer);
        const m = model.parts.get(g.target.id);
        if (!m) return;
        selectPart(m.part.id);
        const w0 = toWorld(view.current, p.x0, p.y0);
        gesture.current = {
          kind: "move",
          id: m.part.id,
          pose: { x: m.part.x, y: m.part.y, angle: m.part.angle },
          grab: [w0[0] - m.part.x, w0[1] - m.part.y],
          last: null,
          features: snapFeatures(m),
          targets: snapTargets(model, m.part.id),
        };
        sheets.current?.classList.add("is-dragging");
        onPointerMove(e);
      } else if ((g.target.kind === "link" || !g.movable) && moved > TAP_PX) {
        window.clearTimeout(g.timer);
        gesture.current = { kind: "pan", start: g.start, tap: false };
        onPointerMove(e);
      } else if (moved > TAP_PX) window.clearTimeout(g.timer);
    } else if (g.kind === "move") {
      const tol = SNAP_PX * mmPerPx(view.current.zoom);
      const want = { x: w[0] - g.grab[0], y: w[1] - g.grab[1], angle: g.pose.angle };
      const s = snapMove(want, g.features, g.targets, tol);
      g.last = { x: s.x, y: s.y, angle: g.pose.angle };
      overlay.current?.guides(s.guides);
      snapTo(s.key);
      showPose(g.id, g.last, y);
    } else if (g.kind === "rotate") {
      const a = Math.atan2(w[1] - g.pose.y, w[0] - g.pose.x);
      const r = snapAngle(g.pose.angle + a - g.a0);
      g.last = { ...g.pose, angle: r.angle };
      snapTo(r.snapped ? `a:${r.angle.toFixed(4)}` : null);
      showPose(g.id, g.last, y);
    } else if (g.kind === "stretch" && model) {
      const part = model.parts.get(g.id)?.part;
      if (!part) return;
      const res = stretchTo(part, g.handle, localOf(g.pose, w));
      g.last = res;
      overlay.current?.preview(res ? previewPath(part, res) : null);
    } else if (g.kind === "pan") {
      if (Math.hypot(x - p.x0, y - p.y0) > TAP_PX) g.tap = false;
      if (!g.tap) {
        view.current = panBy(g.start, x - p.x0, y - p.y0);
        writeView();
      }
      const h = hold.current;
      if (pointers.current.size === 1 && (!h || Math.hypot(x - h.ax, y - h.ay) > HOLD_PX)) armHold(x, y);
    } else if (g.kind === "pinch") {
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
    const up = e.type === "pointerup";
    clearHold();
    const ui = useUiStore.getState();
    const scene = ui.current?.scene;
    switch (g.kind) {
      case "menu": {
        // deslizar e soltar: escolhe o item sob o dedo; sem item, o menu fica aberto
        const hover = ui.edgeMenu?.hover;
        gesture.current = { kind: "none" };
        if (hover && up) runMenuItem(hover);
        return;
      }
      case "drag":
        ctl?.dragEnd();
        gesture.current = { kind: "none" };
        return;
      case "press":
        window.clearTimeout(g.timer);
        if (up) {
          if (g.target.kind === "part") selectPart(g.target.id);
          else onSelect?.(g.target);
        }
        gesture.current = { kind: "none" };
        return;
      case "move":
      case "rotate": {
        gesture.current = { kind: "none" };
        endEditGesture();
        // um arrasto é um comando só, registrado ao soltar
        const last = g.last;
        const cmd =
          up && last && scene
            ? g.kind === "move"
              ? movePart(scene, g.id, last.x, last.y)
              : setPose(scene, g.id, last)
            : null;
        if (!cmd || !ui.commit(cmd)) showPose(g.id, null);
        return;
      }
      case "stretch": {
        gesture.current = { kind: "none" };
        endEditGesture();
        const res = g.last;
        if (!up || !res || !scene) return;
        ui.commit(
          res.kind === "params"
            ? regenerate(scene, g.id, res.params)
            : scalePart(scene, g.id, res.sx, res.sy),
        );
        return;
      }
      case "pinch":
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
      case "pan":
        // toque no fundo: limpa a seleção
        if (g.tap && up && editing && !bare) onSelect?.(null);
        gesture.current = { kind: "none" };
        settle();
        return;
      case "none":
        return;
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
          {model && nodes && editing && !bare && (
            <EditOverlay
              ref={overlay}
              nodes={nodes}
              size={{ width, height }}
              px={mmPerPx(zoom)}
              selection={
                selEditable && selModel
                  ? {
                      pose: { x: selModel.part.x, y: selModel.part.y, angle: selModel.part.angle },
                      handles,
                      d: selModel.d,
                    }
                  : null
              }
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
      {selEditable && selModel && ready && (
        <button
          type="button"
          ref={partBtn}
          className="stage__ui partbtn"
          aria-label={`Cartão de ${selModel.part.name || "peça"} (${selModel.part.ref})`}
          data-keeps-sheet
          onClick={() => useUiStore.getState().setSheet("card")}
        >
          <Icon name="details" uid={`${uid}pb`} size={20} />
        </button>
      )}
    </main>
  );
}
