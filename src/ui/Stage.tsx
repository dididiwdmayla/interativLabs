import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { assets } from "@/assets/registry";
import { hammerPoint, hammerFix, type HammerPoint, type HammerTool } from "@/editor/hammer";
import {
  CURSOR_HOLD_MS,
  cursorLit,
  cursorPoint,
  holdCursor,
  isQuickTap,
  moveCursor,
  startCursor,
  type OffsetCursor,
} from "@/editor/offsetCursor";
import { dragLink, insertLink, sensorLink } from "@/editor/hammerDrag";
import { pickLinkEdit, PICK_PHRASE } from "@/editor/cardPick";
import { linkHandles, adjustLinkHandle, type LinkHandle } from "@/editor/linkHandles";
import { applyLink } from "./card/applyLink";
import { LINK_LABEL } from "@/editor/names";
import { moveLink } from "@/editor/moveLink";
import { HammerBar } from "./HammerBar";
import { PencilBar } from "./PencilBar";
import "./pencil.css";
import { commitPlan, pencilPlan, pencilTarget, planAreas, sideAt, type PencilPlan } from "@/editor/pencil";
import { HammerPreview } from "./HammerPreview";
import { MultiTap } from "@/editor/gestures";
import { MENUS, menuAt } from "@/editor/menus";
import { useUiStore } from "@/editor/useUiStore";
import type { PartPose } from "@/engine/types";
import { movePart, scalePart, scaleShape, setPose, setLink } from "@/editor/commands";
import { handlesFor, localBox, stretchTo, type Handle, type StretchResult } from "@/editor/handles";
import { snapAngle, snapMove, type SnapFeature, type SnapTargets } from "@/editor/snap";
import { snapFeatures, snapTargets } from "@/editor/snapScene";
import { shapeOutline } from "@/geometry/outline";
import type { Vec2 } from "@/geometry/vec";
import type { Part, Shape, Link, ChamberLink, SensorAction } from "@/model/types";
import { clampParams, paramsOf, regenerate } from "@/parts";
import { linkAt, partHit } from "@/render/hit";
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
const NO_HANDLES: Handle[] = [];
/** ferramentas do Martelo que se arrastam de um ponto a outro */
const DRAG_TOOLS: string[] = ["spring", "rod", "cable", "slider", "chamber"];
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
  | { kind: "linkhandle"; link: Link; handle: LinkHandle; last: Link | null }
  | {
      kind: "hammer";
      start: HammerPoint;
      last: HammerPoint;
      cursor: OffsetCursor;
      timer: number;
      /** vista no começo: um arrasto no fundo antes de acender o cursor move a vista */
      view0: View;
    }
  | {
      kind: "linkmove";
      id: string;
      last: HammerPoint | null;
      start: Vec2;
      cursor: OffsetCursor;
      timer: number;
      /** dedo quando o cursor acendeu: a ferragem só sai do lugar depois que ele anda */
      litAt?: Vec2;
    }
  | { kind: "pencil"; stroke: PencilStroke }
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
  | {
      kind: "stretch";
      id: string;
      layer: string;
      pose: PartPose;
      handle: Handle;
      last: StretchResult | null;
    };

/** Ações que o sensor pode disparar no alvo escolhido (faixa do Martelo). */
function sensorActions(target: Link): { label: string; action: SensorAction }[] {
  if (target.kind === "lock")
    return [{ label: "Soltar trava", action: { do: "release", target: target.id } }];
  if (target.kind !== "chamber") return [];
  return [
    { label: "Acender carga", action: { do: "ignite", target: target.id } },
    ...target.vents.flatMap((_, i) =>
      (["open", "close"] as const).map((act) => ({
        label: `${act === "open" ? "Abrir" : "Fechar"} respiro ${i + 1}`,
        action: { do: act, target: target.id, vent: i } as SensorAction,
      })),
    ),
  ];
}

/** Rastro do Lápis em andamento (dedo ou caneta). */
interface PencilStroke {
  id: number;
  /** mm, no mundo */
  points: Vec2[];
  cursor: OffsetCursor;
  timer: number;
  /** dedo (px do palco) */
  finger: Vec2;
}

type PencilPending = { plan: Exclude<PencilPlan, { kind: "none" }>; offer?: string };

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
  const hammer = useUiStore((s) => s.hammer);
  const pencilOn = useUiStore((s) => s.pencil);
  const pencilTool = useUiStore((s) => s.pencilTool);
  const tool = hammer !== null || pencilOn;
  const picking = useUiStore((s) => s.pick);
  const [linkPreview, setLinkPreview] = useState<Link | null>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") useUiStore.getState().setPick(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const [hammerPreview, setHammerPreview] = useState<{
    hit: HammerPoint;
    start?: HammerPoint;
    view: View;
    /** dedo e ponto do cursor antes do encaixe, px, com o cursor deslocado aceso */
    finger?: Vec2 | null;
    raw?: Vec2 | null;
    stamped: boolean;
  } | null>(null);

  const [pencilPending, setPencilPending] = useState<PencilPending | null>(null);
  const [pending, setPending] = useState<
    { kind: "sensor"; hit: HammerPoint; target?: Link } | { kind: "chamber"; link: ChamberLink } | null
  >(null);
  useEffect(
    () =>
      useUiStore.subscribe((next, prev) => {
        if (
          next.hammer !== prev.hammer ||
          next.mode !== prev.mode ||
          next.current?.serial !== prev.current?.serial
        ) {
          setPending(null);
          setHammerPreview(null);
        }
        if (
          next.pencil !== prev.pencil ||
          next.mode !== prev.mode ||
          next.current?.scene !== prev.current?.scene ||
          next.activeLayer !== prev.activeLayer ||
          next.pencilTool !== prev.pencilTool
        )
          setPencilPending(null);
      }),
    [],
  );
  const waiting = pending?.kind === hammer ? pending : null;
  const finishSensor = (actions: SensorAction[] = []) => {
    if (!model || waiting?.kind !== "sensor") return;
    const link = sensorLink(model, waiting.hit, actions, activeLayer);
    if (link) useUiStore.getState().commit(insertLink(link), { selection: { kind: "link", id: link.id } });
    setPending(null);
    setHammerPreview(null);
  };

  const nodes = useMemo(() => (model ? new StageNodes(model) : null), [model]);
  useEffect(() => {
    onNodes?.(nodes);
  }, [nodes, onNodes]);

  const view = useRef<View>({ zoom: 1, tx: 0, ty: 0 });
  const pencilWorld = useRef<SVGGElement>(null);
  const pencilLive = useRef<SVGPathElement>(null);
  const pencilLiveOut = useRef<SVGPathElement>(null);
  /** contorno da peça-alvo (Tirar): a parte do traço sobre ela aparece em brasa */
  const [liveClip, setLiveClip] = useState<{ d: string; transform: string } | null>(null);
  const pencilCursor = useRef<SVGGElement>(null);
  const pencilTether = useRef<SVGPathElement>(null);
  /** uma caneta já desenhou nesta sessão: o dedo só move a vista no Lápis */
  const penSeen = useRef(false);
  const penStroke = useRef<PencilStroke | null>(null);
  /** chamado a cada mudança da vista (o botão da peça acompanha) */
  const onView = useRef<(() => void) | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);

  const writeView = useCallback(() => {
    const v = view.current;
    const m = viewMatrix(v);
    if (nodes) for (const g of nodes.worlds.values()) g.setAttribute("transform", m);
    pencilWorld.current?.setAttribute("transform", m);
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
    // ligar ou desligar o Martelo ou o Lápis nunca mexe na vista: a faixa não entra aqui
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
  const pickedSurface = useRef<{ id: string; layer: number } | null>(null);
  const pickPart = (w: Vec2): string | null => {
    if (!model || !nodes) return null;
    const tol = 8 * mmPerPx(view.current.zoom);
    const m =
      partHit(model, nodes.frame, w, { tol, layer: (i) => i === activeLayer && layerOk(i) }) ??
      partHit(model, nodes.frame, w, { tol, layer: layerOk });
    pickedSurface.current = m ? { id: m.part.id, layer: m.layer } : null;
    return m?.part.id ?? null;
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
    const layer = pickedSurface.current?.id === id ? pickedSurface.current.layer : m.layer;
    if (layer !== ui.activeLayer) ui.setActiveLayer(layer);
    if (ui.selection?.id !== id) onSelect?.({ kind: "part", id });
  };
  const selModel =
    selection?.kind === "part"
      ? (model?.partList.find((m) => m.part.id === selection.id && m.layer === activeLayer) ??
        model?.parts.get(selection.id) ??
        null)
      : null;
  const selectedLink = selection?.kind === "link" ? model?.linkById.get(selection.id)?.link : undefined;
  const linkFields =
    editing && model && selectedLink
      ? linkHandles(model, linkPreview?.id === selectedLink.id ? linkPreview : selectedLink, mmPerPx(zoom))
      : [];
  const selEditable = editing && !bare && !!selModel && layerOk(selModel.layer);
  // com o Lápis, as alças saem: o dedo desenha
  const allHandles = useMemo(
    () => (selEditable && selModel ? handlesFor(selModel, mmPerPx(zoom)) : []),
    [selEditable, selModel, zoom],
  );
  const handles = pencilOn ? NO_HANDLES : allHandles;
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

  // ——— Martelo: cursor deslocado (docs/arquitetura.md §6, revisto em 07/11) ———
  const hammerAt = (tool: HammerTool, sp: Vec2, m: SceneModel): HammerPoint =>
    hammerPoint(m, tool, toWorld(view.current, sp[0], sp[1]), activeLayer, mmPerPx(view.current.zoom));
  const showHammer = (
    hit: HammerPoint,
    start: HammerPoint | undefined,
    c: OffsetCursor,
    x: number,
    y: number,
  ) =>
    setHammerPreview({
      view: { ...view.current },
      hit,
      start,
      finger: cursorLit(c) ? [x, y] : null,
      raw: cursorLit(c) ? cursorPoint(c, x, y) : null,
      stamped: false,
    });
  /** segurar parado 300 ms acende o cursor: daí em diante o ponto é ele */
  const armCursor = (c: OffsetCursor): number => {
    if (!c.touch) return 0;
    return window.setTimeout(() => {
      const g = gesture.current;
      if ((g.kind !== "hammer" && g.kind !== "linkmove") || g.cursor !== c || pointers.current.size !== 1)
        return;
      if (!holdCursor(c)) return;
      vibrate(8);
      const f = [...pointers.current.values()][0];
      const tool = g.kind === "hammer" ? useUiStore.getState().hammer : "axle";
      if (!model || !tool || !f) return;
      const hit = hammerAt(tool, cursorPoint(c, f.x, f.y), model);
      if (g.kind === "hammer") {
        // nas ferramentas de arrastar, segurar antes põe o começo no cursor
        g.start = hit;
        g.last = hit;
      } else g.litAt = [f.x, f.y];
      showHammer(hit, undefined, c, f.x, f.y);
    }, CURSOR_HOLD_MS);
  };
  const beginLinkMove = (id: string, w: Vec2, x: number, y: number, pointerType: string, t: number) => {
    const cursor = startCursor(x, y, t, pointerType);
    gesture.current = { kind: "linkmove", id, last: null, start: w, cursor, timer: armCursor(cursor) };
  };

  // ——— Lápis (docs/arquitetura.md §6): o rastro, a prévia ao vivo e o comando ———
  const drawStroke = (st: PencilStroke | null) => {
    const pts = st?.points ?? [];
    const d =
      pts.length === 1
        ? `M${pts[0]?.[0]} ${pts[0]?.[1]}h0.001`
        : pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(3)} ${q[1].toFixed(3)}`).join("");
    pencilLive.current?.setAttribute("d", d);
    pencilLiveOut.current?.setAttribute("d", d);
    const lit = st && cursorLit(st.cursor);
    const ring = pencilCursor.current;
    const tether = pencilTether.current;
    if (ring) {
      if (lit && st) {
        const c = cursorPoint(st.cursor, st.finger[0], st.finger[1]);
        ring.setAttribute("transform", `translate(${c[0]} ${c[1]})`);
        ring.style.opacity = "1";
        tether?.setAttribute("d", `M${c[0]} ${c[1] + 13}L${st.finger[0]} ${st.finger[1] - 6}`);
      } else {
        ring.style.opacity = "0";
        tether?.setAttribute("d", "");
      }
    }
  };
  const startStroke = (id: number, x: number, y: number, pointerType: string, t: number): PencilStroke => {
    const cursor = startCursor(x, y, t, pointerType);
    const st: PencilStroke = { id, points: [toWorld(view.current, x, y)], cursor, timer: 0, finger: [x, y] };
    if (model && pencilTool.op === "cut") {
      const sel = selection?.kind === "part" ? selection.id : null;
      const t = pencilTarget(model, activeLayer, sel, st.points[0] ?? null);
      const m = t && model.partList.find((q) => q.part.id === t.part.id && q.layer === activeLayer);
      setLiveClip(
        m
          ? {
              d: m.d,
              transform: `translate(${m.part.x} ${m.part.y}) rotate(${(m.part.angle * 180) / Math.PI})`,
            }
          : null,
      );
    } else setLiveClip(null);
    if (cursor.touch)
      st.timer = window.setTimeout(() => {
        if (!holdCursor(cursor)) return;
        // segurar antes de traçar: o traço começa no cursor
        vibrate(8);
        const c = cursorPoint(cursor, st.finger[0], st.finger[1]);
        st.points = [toWorld(view.current, c[0], c[1])];
        drawStroke(st);
      }, CURSOR_HOLD_MS);
    drawStroke(st);
    return st;
  };
  const moveStroke = (st: PencilStroke, x: number, y: number) => {
    st.finger = [x, y];
    if (moveCursor(st.cursor, x, y)) window.clearTimeout(st.timer);
    const c = cursorPoint(st.cursor, x, y);
    const w = toWorld(view.current, c[0], c[1]);
    const last = st.points[st.points.length - 1];
    if (!last || Math.hypot(w[0] - last[0], w[1] - last[1]) > 0.5 * mmPerPx(view.current.zoom))
      st.points.push(w);
    drawStroke(st);
  };
  const endStroke = (st: PencilStroke, up: boolean, t = Infinity) => {
    window.clearTimeout(st.timer);
    drawStroke(null);
    if (!up) return;
    const tap =
      isQuickTap(st.cursor, st.finger[0], st.finger[1], t) ||
      (!cursorLit(st.cursor) && !st.cursor.moved && st.points.length < 3);
    finishStroke(tap ? st.points.slice(0, 1) : st.points, tap);
  };
  const finishStroke = (points: Vec2[], tap: boolean) => {
    if (!model) return;
    const ui = useUiStore.getState();
    const tool = ui.pencilTool;
    const first = points[0];
    if (!first) return;
    if (tap && tool.form === "contour") {
      // no Contorno, um toque escolhe a peça em que o Lápis vai agir
      const part = pickPart(first);
      if (part) selectPart(part);
      else onSelect?.(null);
      return;
    }
    if (model.layers[activeLayer]?.layer.locked) {
      ui.notify("Destrave a camada antes de desenhar", { warn: true });
      return;
    }
    const sel = ui.selection?.kind === "part" ? ui.selection.id : null;
    const plan = pencilPlan(model, tool, { points, tap, px: mmPerPx(view.current.zoom) }, activeLayer, sel);
    if (plan.kind === "none") {
      ui.notify(plan.reason, { warn: true });
      return;
    }
    if (plan.kind === "sides") {
      setPencilPending({ plan });
      return;
    }
    commitPencil(plan, false);
  };
  const commitPencil = (plan: Exclude<PencilPlan, { kind: "none" }>, separate: boolean) => {
    const ui = useUiStore.getState();
    const scene = ui.current?.scene;
    const layer = scene?.layers[activeLayer]?.id;
    if (!scene || !layer) return;
    const c = commitPlan(scene, plan, layer, { separate });
    if (c.kind === "offer") {
      setPencilPending({ plan, offer: c.reason });
      return;
    }
    setPencilPending(null);
    if (c.kind === "none") {
      ui.notify(c.reason, { warn: true });
      return;
    }
    if (ui.commit(c.command, c.selection ? { selection: { kind: "part", id: c.selection } } : undefined))
      vibrate(12);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest(".stage__ui")) return;
    if (!model || !nodes) return;
    onFirstTouch?.();
    const [x, y] = local(e);
    if (e.pointerType === "pen") penSeen.current = true;
    // caneta no Lápis: desenha à parte, e os dedos continuam movendo a vista ao mesmo tempo
    if (editing && !bare && pencilOn && e.pointerType === "pen" && !penStroke.current) {
      box.current?.setPointerCapture(e.pointerId);
      if (pencilPending?.plan.kind === "sides") {
        const side = sideAt(pencilPending.plan, toWorld(view.current, x, y));
        if (side !== null) setPencilPending({ plan: { ...pencilPending.plan, pick: side } });
        return;
      }
      penStroke.current = startStroke(e.pointerId, x, y, "pen", e.timeStamp);
      return;
    }
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
      if (g.kind === "linkhandle") setLinkPreview(null);
      if (g.kind === "hammer" || g.kind === "linkmove") {
        window.clearTimeout(g.timer);
        setHammerPreview(null);
        overlay.current?.guides([]);
      }
      if (g.kind === "press") window.clearTimeout(g.timer);
      if (g.kind === "pencil") endStroke(g.stroke, false);
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
      if (ctl?.releaseAt(w)) {
        gesture.current = { kind: "none" };
        return;
      }
      if (ctl && ctl.dragAt(w)) {
        gesture.current = { kind: "drag" };
        return;
      }
    } else if (!bare) {
      // Lápis com o dedo (ou mouse): desenha; com caneta presente, o dedo só move a vista
      if (pencilOn && !picking && !(e.pointerType === "touch" && penSeen.current)) {
        if (pencilPending?.plan.kind === "sides") {
          const side = sideAt(pencilPending.plan, w);
          if (side !== null) {
            setPencilPending({ plan: { ...pencilPending.plan, pick: side } });
            gesture.current = { kind: "none" };
            return;
          }
        }
        if (!pencilPending) {
          gesture.current = {
            kind: "pencil",
            stroke: startStroke(e.pointerId, x, y, e.pointerType, e.timeStamp),
          };
          return;
        }
      }
      if (pencilOn) {
        gesture.current = { kind: "pan", start: { ...view.current }, tap: false };
        return;
      }
      if (picking) {
        const result = pickLinkEdit(model, picking, w, mmPerPx(view.current.zoom));
        const error = result.link ? applyLink(result.link, picking.kind) : result.error;
        const ui = useUiStore.getState();
        if (error) ui.notify(error, { warn: true });
        else {
          ui.setPick(null);
          ui.setSheet("card");
        }
        gesture.current = { kind: "none" };
        return;
      }
      if (selectedLink) {
        const handle = linkFields
          .map((h) => ({ h, d: Math.hypot(h.point[0] - w[0], h.point[1] - w[1]) }))
          .filter((x) => x.d <= HANDLE_PX * mmPerPx(view.current.zoom))
          .sort((a, b) => a.d - b.d)[0]?.h;
        if (handle) {
          gesture.current = { kind: "linkhandle", link: selectedLink, handle, last: null };
          return;
        }
      }
      if (hammer) {
        if (waiting) {
          if (waiting.kind === "sensor") {
            const target = model.linkById.get(pickLink(w) ?? "")?.link;
            if (target?.kind === "chamber" || target?.kind === "lock") setPending({ ...waiting, target });
            else if (!pickPart(w)) finishSensor();
            else
              useUiStore.getState().notify("Toque numa câmara ou trava; toque no fundo para deixar sem ação");
          } else {
            const hit = hammerPoint(model, "pin", w, activeLayer, mmPerPx(view.current.zoom));
            if (hit.b?.dynamic && hit.b.part.id !== waiting.link.body) {
              // a parede tocada é a da frente; a de trás (se a regra achou) continua
              const link = {
                ...waiting.link,
                walls: [{ part: hit.b.part.id, seal: waiting.link.length }, ...waiting.link.walls],
              };
              const ui = useUiStore.getState();
              ui.commit(insertLink(link), { selection: { kind: "link", id: link.id } });
              ui.setSheet("card");
              setPending(null);
              setHammerPreview(null);
            } else useUiStore.getState().notify("Toque numa parede móvel da câmara", { warn: true });
          }
          gesture.current = { kind: "none" };
          return;
        }
        const link = pickLink(w);
        if (link && selection?.kind === "link" && selection.id === link) {
          beginLinkMove(link, w, x, y, e.pointerType, e.timeStamp);
          return;
        }
        if (link) {
          const ui = useUiStore.getState();
          ui.select({ kind: "link", id: link });
          ui.setSheet("card");
          setHammerPreview(null);
          gesture.current = { kind: "none" };
          return;
        }
        const cursor = startCursor(x, y, e.timeStamp, e.pointerType);
        const hit = hammerAt(hammer, [x, y], model);
        // dedo: nada aparece antes de acender o cursor (ou de arrastar); mouse e caneta: prévia no ponto
        if (!cursor.touch) showHammer(hit, undefined, cursor, x, y);
        if (cursor.touch || hit.b || DRAG_TOOLS.includes(hammer)) {
          gesture.current = {
            kind: "hammer",
            start: hit,
            last: hit,
            cursor,
            timer: armCursor(cursor),
            view0: { ...view.current },
          };
          return;
        }
        gesture.current = { kind: "pan", start: { ...view.current }, tap: true };
        return;
      }
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
            : {
                kind: "stretch",
                id: selModel.part.id,
                layer: selModel.part.layer,
                pose,
                handle: h,
                last: null,
              };
        return;
      }
      const link = pickLink(w);
      if (link && selection?.kind === "link" && selection.id === link) {
        beginLinkMove(link, w, x, y, e.pointerType, e.timeStamp);
        return;
      }
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
        const movable = !!pm && (pickedSurface.current?.layer === activeLayer || selection?.id === part);
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
    const [x, y] = local(e);
    if (penStroke.current?.id === e.pointerId) {
      moveStroke(penStroke.current, x, y);
      return;
    }
    if (!p) {
      if (editing && hammer && model && e.pointerType !== "touch")
        setHammerPreview({
          view: { ...view.current },
          hit: hammerPoint(
            model,
            hammer,
            toWorld(view.current, x, y),
            activeLayer,
            mmPerPx(view.current.zoom),
          ),
          stamped: false,
        });
      return;
    }
    p.x = x;
    p.y = y;
    if (e.pointerType === "touch") multi.current.move(e.pointerId, x, y);
    const g = gesture.current;
    const w = toWorld(view.current, x, y);
    if (g.kind === "linkhandle" && model) {
      g.last = adjustLinkHandle(model, g.link, g.handle, w);
      setLinkPreview(g.last);
    } else if (g.kind === "linkmove" && model) {
      const moved = moveCursor(g.cursor, x, y);
      if (moved) window.clearTimeout(g.timer);
      if (cursorLit(g.cursor)) {
        const lit = g.litAt ?? [x, y];
        if (!g.last && Math.hypot(x - lit[0], y - lit[1]) < 3) return;
      } else if (
        g.cursor.touch
          ? !g.cursor.moved
          : Math.hypot(w[0] - g.start[0], w[1] - g.start[1]) < 3 * mmPerPx(view.current.zoom)
      )
        return;
      g.last = hammerAt("axle", cursorPoint(g.cursor, x, y), model);
      overlay.current?.guides(g.last.guides);
      showHammer(g.last, undefined, g.cursor, x, y);
    } else if (g.kind === "hammer" && model && hammer) {
      const moved = moveCursor(g.cursor, x, y);
      if (moved) window.clearTimeout(g.timer);
      if (!cursorLit(g.cursor)) {
        // antes de acender: parado, espera; arrastando no fundo com ferramenta de tocar, move a vista
        if (g.cursor.touch && !g.cursor.moved) return;
        if (moved && !DRAG_TOOLS.includes(hammer) && !g.start.b) {
          setHammerPreview(null);
          gesture.current = { kind: "pan", start: g.view0, tap: false };
          onPointerMove(e);
          return;
        }
      }
      g.last = hammerAt(hammer, cursorPoint(g.cursor, x, y), model);
      showHammer(g.last, DRAG_TOOLS.includes(hammer) ? g.start : undefined, g.cursor, x, y);
    } else if (g.kind === "pencil") {
      moveStroke(g.stroke, x, y);
    } else if (g.kind === "menu") {
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
      const part = model.partList.find((m) => m.part.id === g.id && m.part.layer === g.layer)?.part;
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
    const pen = penStroke.current;
    if (pen?.id === e.pointerId) {
      penStroke.current = null;
      endStroke(pen, e.type === "pointerup", e.timeStamp);
      return;
    }
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
      case "linkhandle": {
        gesture.current = { kind: "none" };
        setLinkPreview(null);
        if (up && g.last && scene) ui.commit(setLink(scene, g.link.id, g.last));
        return;
      }
      case "linkmove": {
        gesture.current = { kind: "none" };
        setHammerPreview(null);
        overlay.current?.guides([]);
        window.clearTimeout(g.timer);
        if (up && model && g.last) ui.commit(moveLink(model, g.id, g.last.point));
        else if (up && !cursorLit(g.cursor)) ui.setSheet("card");
        return;
      }
      case "hammer": {
        gesture.current = { kind: "none" };
        window.clearTimeout(g.timer);
        if (!up || !model || !ui.hammer) {
          setHammerPreview(null);
          return;
        }
        if (g.last.b && model.layers[g.last.b.layer]?.layer.locked) {
          ui.notify("Destrave a camada antes de cravar", { warn: true });
          setHammerPreview(null);
          return;
        }
        if (ui.hammer === "sensor") {
          setPending({ kind: "sensor", hit: g.last });
          return;
        }
        if (DRAG_TOOLS.includes(ui.hammer)) {
          const created = dragLink(model, ui.hammer, g.start, g.last, activeLayer);
          if (!created) {
            ui.notify("Arraste entre duas pontas distintas", { warn: true });
            setHammerPreview(null);
            return;
          }
          if (created.link.kind === "chamber" && !created.link.walls.length) {
            setPending({ kind: "chamber", link: created.link });
            return;
          }
          ui.commit(insertLink(created.link), { selection: { kind: "link", id: created.link.id } });
          if (created.warning) {
            ui.notify(created.warning, { warn: true });
            ui.setSheet("card");
          }
          vibrate(12);
          setHammerPreview(null);
          return;
        }
        const stamp = hammerFix(model, ui.hammer, g.last);
        if (stamp?.warning) {
          ui.notify(stamp.warning, { warn: true });
          setHammerPreview(null);
          return;
        }
        if (stamp && ui.commit(stamp.command, { selection: { kind: "link", id: stamp.id } })) {
          setHammerPreview({ view: { ...view.current }, hit: g.last, stamped: true });
          vibrate(12);
          window.setTimeout(() => setHammerPreview(null), 350);
        }
        return;
      }
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
            ? regenerate(scene, g.id, res.params, undefined, g.layer)
            : scalePart(scene, g.id, res.sx, res.sy, g.layer),
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
      case "pencil":
        gesture.current = { kind: "none" };
        endStroke(g.stroke, up, e.timeStamp);
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

  const pencilPhrase = (): string => {
    const t = pencilTool;
    const mm = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    if (pencilPending?.offer) return `${pencilPending.offer}: separar em peça?`;
    if (pencilPending) {
      const a = planAreas(pencilPending.plan);
      return pencilPending.plan.op === "cut"
        ? `Vai sair ${mm(a.removed)} mm² (em brasa) · toque num lado para escolher`
        : `Vai entrar ${mm(a.added)} mm² · toque num lado para escolher`;
    }
    const target =
      selection?.kind === "part" && model?.parts.get(selection.id)
        ? (model.parts.get(selection.id)?.part.name ?? "")
        : "";
    const on = target ? ` em ${target}` : "";
    if (t.form === "contour")
      return t.op === "cut"
        ? `Tirar${on}: feche um laço, ou corte de borda a borda${t.ruler ? " · régua" : ""}`
        : `Somar${on}: feche um laço; no vazio, vira peça nova${t.ruler ? " · régua" : ""}`;
    return t.op === "cut"
      ? `Borracha de ${mm(t.width)} mm${on} · um toque faz furo${t.ruler ? " · reta vira rasgo" : ""}`
      : `Pincel de ${mm(t.width)} mm${on}: barra ou alavanca à mão${t.ruler ? " · régua" : ""}`;
  };
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
      {editing && picking && (
        <div className="pickprompt stage__ui" role="status">
          <span>{PICK_PHRASE[picking.kind]}</span>
          <button
            type="button"
            className="iconbtn"
            aria-label="Cancelar escolha"
            onClick={() => useUiStore.getState().setPick(null)}
          >
            <Icon name="close" uid="pick-close" />
          </button>
        </div>
      )}
      {editing && !bare && !hammer && hammerPreview && (
        <HammerPreview
          hit={hammerPreview.hit}
          tool="axle"
          view={hammerPreview.view}
          finger={hammerPreview.finger}
          raw={hammerPreview.raw}
          stamped={false}
        />
      )}
      {editing && !bare && hammer && (
        <>
          <HammerBar
            phrase={
              waiting?.kind === "sensor"
                ? waiting.target
                  ? "Escolha a ação do sensor"
                  : "Sensor: toque numa câmara, respiro ou trava; no fundo, fica sem ação"
                : waiting?.kind === "chamber"
                  ? "Toque na parede"
                  : hammerPreview?.start
                    ? `${LINK_LABEL[hammer]}: ${Math.hypot(hammerPreview.hit.point[0] - hammerPreview.start.point[0], hammerPreview.hit.point[1] - hammerPreview.start.point[1]).toFixed(1)} mm · solte para cravar`
                    : hammerPreview?.hit.phrase
            }
            actions={
              waiting?.kind === "sensor" && waiting.target
                ? sensorActions(waiting.target).map((a, i) => ({
                    id: `${i}`,
                    label: a.label,
                    onClick: () => finishSensor([a.action]),
                  }))
                : undefined
            }
          />
          {waiting?.kind === "sensor" && model && hammerPreview && (
            <svg className="hammerpreview" width="100%" height="100%" aria-hidden="true">
              {model.links
                .filter((l) => l.link.kind === "lock" || l.link.kind === "chamber")
                .map((l) => {
                  const p = toScreen(hammerPreview.view, l.world);
                  return (
                    <circle key={l.link.id} cx={p[0]} cy={p[1]} r="23" className="hammerpreview__line" />
                  );
                })}
            </svg>
          )}
          {hammerPreview && (
            <HammerPreview
              hit={hammerPreview.hit}
              start={hammerPreview.start}
              tool={hammer}
              view={hammerPreview.view}
              finger={hammerPreview.finger}
              raw={hammerPreview.raw}
              stamped={hammerPreview.stamped}
            />
          )}
        </>
      )}
      {editing && !bare && pencilOn && model && (
        <>
          <PencilBar
            phrase={pencilPhrase()}
            pending={pencilPending ? (pencilPending.offer ? "offer" : pencilPending.plan.kind) : null}
            op={pencilPending?.plan.op ?? pencilTool.op}
            onSwap={() =>
              setPencilPending((p) =>
                p?.plan.kind === "sides" ? { plan: { ...p.plan, pick: p.plan.pick === 0 ? 1 : 0 } } : p,
              )
            }
            onCommit={() => pencilPending && commitPencil(pencilPending.plan, !!pencilPending.offer)}
            onCancel={() => setPencilPending(null)}
          />
          <svg
            className="pencilpreview"
            width="100%"
            height="100%"
            aria-hidden="true"
            data-pencil-preview
            data-pending={pencilPending ? (pencilPending.offer ? "offer" : pencilPending.plan.kind) : "none"}
            data-pick={pencilPending?.plan.kind === "sides" ? pencilPending.plan.pick : undefined}
          >
            <defs>
              <pattern
                id={`${uid}-out`}
                patternUnits="userSpaceOnUse"
                width={5 * mmPerPx(zoom)}
                height={5 * mmPerPx(zoom)}
                patternTransform="rotate(45)"
              >
                <path
                  className="pencilpreview__hatch"
                  d={`M0 0V${5 * mmPerPx(zoom)}`}
                  strokeWidth={1.4 * mmPerPx(zoom)}
                />
              </pattern>
              {liveClip && (
                <clipPath id={`${uid}-clip`}>
                  <path d={liveClip.d} transform={liveClip.transform} clipRule="evenodd" />
                </clipPath>
              )}
            </defs>
            {/* a matriz da vista vem do writeView, como no grupo do mundo */}
            <g ref={pencilWorld}>
              {pencilPending && <PencilPendingPaths pending={pencilPending} uid={uid} />}
              <path
                ref={pencilLive}
                className={`pencilpreview__live pencilpreview__live--${pencilTool.form} pencilpreview__live--${pencilTool.op}`}
                strokeWidth={pencilTool.form === "stroke" ? pencilTool.width : undefined}
              />
              {liveClip && (
                <path
                  ref={pencilLiveOut}
                  className={`pencilpreview__liveout pencilpreview__live--${pencilTool.form}`}
                  strokeWidth={pencilTool.form === "stroke" ? pencilTool.width : undefined}
                  clipPath={`url(#${uid}-clip)`}
                />
              )}
            </g>
            <path ref={pencilTether} className="hammerpreview__line hammerpreview__tether" />
            <g ref={pencilCursor} className="pencilcursor" style={{ opacity: 0 }}>
              <circle r="13" className="hammercursor__ring" />
              <path className="hammercursor__cross" d="M-21 0H-15M15 0H21M0-21V-15M0 15V21M-3 0H3M0-3V3" />
            </g>
          </svg>
        </>
      )}
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
              linkHandles={linkFields}
              picking={picking}
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
          {editing && !bare && !tool && (
            <text className="stage__fig" x={width / 2} y={height - inset - gap - 14} textAnchor="middle">
              <tspan className="stage__fig-script">Fig. {figure}</tspan>
            </text>
          )}
        </svg>
      )}
      {selEditable && selModel && ready && !tool && (
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

/** Prévia de um corte ou soma esperando a escolha do lado: o que sai em brasa com hachura, o que entra em ouro. */
function PencilPendingPaths({ pending, uid }: { pending: PencilPending; uid: string }) {
  const plan = pending.plan;
  const line = plan.line.map((q, i) => `${i ? "L" : "M"}${q[0]} ${q[1]}`).join("");
  if (plan.kind === "ready")
    return (
      <>
        {plan.removed.length > 0 && (
          <path className="pencilpreview__out" d={outlinePath(plan.removed)} fill={`url(#${uid}-out)`} />
        )}
        {plan.added.length > 0 && <path className="pencilpreview__in" d={outlinePath(plan.added)} />}
      </>
    );
  const chosen = plan.sides[plan.pick];
  const other = plan.sides[plan.pick === 0 ? 1 : 0];
  return (
    <>
      {plan.op === "cut" ? (
        <>
          <path className="pencilpreview__keep" d={outlinePath(other)} />
          <path className="pencilpreview__out" d={outlinePath(chosen)} fill={`url(#${uid}-out)`} />
        </>
      ) : (
        <>
          {other.length > 0 && <path className="pencilpreview__keep" d={outlinePath(other)} />}
          <path className="pencilpreview__in" d={outlinePath(chosen)} />
        </>
      )}
      <path className="pencilpreview__line" d={line} />
    </>
  );
}
