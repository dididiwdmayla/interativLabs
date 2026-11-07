import type { Probe } from "@/instruments/model";
import { create } from "zustand";
import type { Id, LinkKind, Scene } from "@/model/types";
import type { Selection } from "@/render/SceneSvg";
import type { CardPick } from "./cardPick";
import type { HammerTool } from "./hammer";
import { DEFAULT_PENCIL, type PencilTool } from "./pencil";
import type { Command } from "./commands";
import { emptyHistory, lowerFirst, push, pushMerged, redo, run, undo, type HistoryState } from "./history";

export type Mode = "edit" | "simulate";
export type { Selection } from "@/render/SceneSvg";

export interface OpenScene {
  /** projeto (IndexedDB) ou exemplo de onde veio */
  id: string;
  scene: Scene;
  /** número da figura ("Fig. N") */
  figure: number;
  /** muda a cada abertura (reenquadra); não muda com as edições */
  serial: number;
}

export interface Notice {
  id: number;
  text: string;
  /** mostra o botão Desfazer */
  undo?: boolean;
  /** alerta (brasa) */
  warn?: boolean;
}

/** Folhas laterais: uma por vez. */
export type SheetId = "card" | "drawer" | "layers" | "main" | "install";
export type MainTab = "projects" | "examples" | "transfer";

export interface EdgeMenuState {
  /** lado físico na tela */
  side: "left" | "right";
  /** centro vertical do arco, px do palco */
  cy: number;
  /** item sob o dedo (deslizar e soltar) */
  hover: string | null;
}

/**
 * Camadas em cores (Parte E2d): estado de vista, fora da cena e do desfazer.
 * `open` é o modo (a faixa à vista); dentro dele, cores, afastar e isolar.
 */
export interface LayerLook {
  open: boolean;
  colors: boolean;
  spread: boolean;
  /** afastamento entre camadas vizinhas, px de tela */
  distance: number;
  isolate: boolean;
}

export const LOOK_OFF: LayerLook = {
  open: false,
  colors: false,
  spread: false,
  distance: 28,
  isolate: false,
};
export const SPREAD_MIN = 12;
export const SPREAD_MAX = 64;

/** Estado de vista salvo com o projeto (fora do formato da cena). */
export interface ProjectView {
  /** peças escondidas */
  hidden?: Id[];
  probes?: Probe[];
}

interface UiState {
  mode: Mode;
  pick: CardPick | null;
  setPick: (pick: CardPick | null) => void;
  hammer: HammerTool | null;
  setHammer: (tool: HammerTool | null) => void;
  /** Lápis ligado (ligar um desliga o outro) */
  pencil: boolean;
  /** escolhas do Lápis: ficam entre uma vez e outra */
  pencilTool: PencilTool;
  setPencil: (on: boolean) => void;
  setPencilTool: (patch: Partial<PencilTool>) => void;
  current: OpenScene | null;
  history: HistoryState;
  selection: Selection;
  /** índice da camada ativa (0 = fundo) */
  activeLayer: number;
  /** raio-x: só contornos */
  xray: boolean;
  notice: Notice | null;
  sheet: SheetId | null;
  mainTab: MainTab;
  /** formulário completo aberto no cartão */
  details: boolean;
  edgeMenu: EdgeMenuState | null;
  /** canhoto: troca os lados dos menus e dos cantos */
  lefty: boolean;
  /** dica curta no topo da prancha */
  hint: boolean;
  /** a pessoa usa teclado ou mouse (último ponteiro foi mouse, ou uma tecla foi apertada): "Esc sai" aparece */
  keys: boolean;
  setKeys: (on: boolean) => void;
  /** uma caneta já tocou a prancha nesta sessão: no Lápis, o dedo só move a vista (salvo "Dedo desenha") */
  penSeen: boolean;
  setPenSeen: (on: boolean) => void;
  /** "Dedo desenha" no Lápis, mesmo depois de ver a caneta (salvo no aparelho) */
  fingerDraws: boolean;
  setFingerDraws: (on: boolean) => void;
  /** camadas em cores, afastar e isolar */
  look: LayerLook;
  setLook: (patch: Partial<LayerLook>) => void;
  /** modo "Esconder peças": cada toque esconde a peça tocada */
  hideMode: boolean;
  setHideMode: (on: boolean) => void;
  /** peças escondidas do projeto aberto (estado de vista, salvo com o projeto) */
  hidden: Id[];
  probes: Probe[];
  setProbes: (probes: Probe[]) => void;
  hide: (id: Id) => void;
  unhide: (id: Id) => void;
  unhideAll: () => void;
  /** rastro do movimento no Testar */
  trail: boolean;
  setTrail: (on: boolean) => void;
  /** cartão "o que é" aberto */
  explain: LinkKind | null;
  setExplain: (k: LinkKind | null) => void;
  /** a gaveta sai da frente enquanto uma peça é arrastada dela */
  drawerAway: boolean;
  setDrawerAway: (on: boolean) => void;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
  openScene: (id: string, scene: Scene, figure: number, history?: HistoryState, view?: ProjectView) => void;
  select: (s: Selection) => void;
  setActiveLayer: (i: number) => void;
  setXray: (on: boolean) => void;
  /** aplica um comando (com desfazer); devolve se mudou a cena */
  commit: (
    cmd: Command | null,
    after?: Partial<Pick<UiState, "selection" | "activeLayer">>,
    opts?: { merge?: string },
  ) => boolean;
  undo: () => void;
  redo: () => void;
  notify: (text: string, opts?: { undo?: boolean; warn?: boolean }) => void;
  clearNotice: () => void;
  setSheet: (s: SheetId | null) => void;
  setMainTab: (t: MainTab) => void;
  setDetails: (on: boolean) => void;
  setEdgeMenu: (m: EdgeMenuState | null) => void;
  setLefty: (on: boolean) => void;
  setHint: (on: boolean) => void;
}

let noticeSeq = 0;

/** Seleção que ainda existe na cena (depois de desfazer, por exemplo). */
function validSelection(scene: Scene, s: Selection): Selection {
  if (!s) return null;
  if (s.kind === "part") return scene.parts.some((p) => p.id === s.id) ? s : null;
  return scene.links.some((l) => l.id === s.id) ? s : null;
}

const clampLayer = (scene: Scene, i: number) => Math.max(0, Math.min(scene.layers.length - 1, i));

function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // sem armazenamento: a preferência vale só nesta sessão
  }
}

const hasWindow = typeof window !== "undefined";

/**
 * Estado do editor e da interface. A cena aberta (`current.scene`) só muda
 * por comandos (`commit`), com desfazer e refazer por patches do Immer.
 */
export const useUiStore = create<UiState>()((set, get) => ({
  mode: "edit",
  pick: null,
  setPick: (pick) => set({ pick, sheet: null, edgeMenu: null, hammer: null }),
  hammer: null,
  setHammer: (hammer) =>
    set((s) => ({
      hammer,
      pencil: hammer ? false : s.pencil,
      hideMode: hammer ? false : s.hideMode,
      pick: null,
      sheet: null,
      edgeMenu: null,
      selection: null,
    })),
  pencil: false,
  pencilTool: DEFAULT_PENCIL,
  // o Lápis age na peça escolhida: a seleção fica
  setPencil: (pencil) =>
    set((s) => ({
      pencil,
      hammer: pencil ? null : s.hammer,
      hideMode: pencil ? false : s.hideMode,
      pick: null,
      edgeMenu: null,
    })),
  setPencilTool: (patch) => set((s) => ({ pencilTool: { ...s.pencilTool, ...patch } })),
  current: null,
  history: emptyHistory(),
  selection: null,
  activeLayer: 0,
  xray: false,
  notice: null,
  sheet: null,
  mainTab: "projects",
  details: false,
  edgeMenu: null,
  lefty: hasWindow && readPref("il.lefty") === "1",
  hint: !hasWindow || readPref("il.hint") !== "0",
  keys: hasWindow && typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches,
  setKeys: (keys) => {
    if (get().keys !== keys) set({ keys });
  },
  penSeen: false,
  setPenSeen: (penSeen) => {
    if (get().penSeen !== penSeen) set({ penSeen });
  },
  fingerDraws: hasWindow && readPref("il.fingerDraws") === "1",
  setFingerDraws: (fingerDraws) => {
    writePref("il.fingerDraws", fingerDraws ? "1" : "0");
    set({ fingerDraws });
  },

  look: LOOK_OFF,
  setLook: (patch) =>
    set((s) => {
      const look = { ...s.look, ...patch };
      // abrir o modo liga as cores; fechar volta tudo ao normal
      if (patch.open === true && !s.look.open) look.colors = true;
      if (patch.open === false) return { look: { ...LOOK_OFF, distance: s.look.distance } };
      return { look };
    }),
  hideMode: false,
  setHideMode: (hideMode) =>
    set((s) => ({
      hideMode,
      hammer: hideMode ? null : s.hammer,
      pencil: hideMode ? false : s.pencil,
      pick: null,
      edgeMenu: null,
    })),
  probes: [],
  setProbes: (probes) => set({ probes: probes.slice(0, 4) }),
  hidden: [],
  hide: (id) => set((s) => (s.hidden.includes(id) ? {} : { hidden: [...s.hidden, id] })),
  unhide: (id) => set((s) => ({ hidden: s.hidden.filter((x) => x !== id) })),
  unhideAll: () => set({ hidden: [] }),
  trail: false,
  setTrail: (trail) => set({ trail }),
  explain: null,
  setExplain: (explain) => set({ explain }),
  drawerAway: false,
  setDrawerAway: (drawerAway) => set({ drawerAway }),
  setMode: (mode) =>
    set({
      mode,
      pick: null,
      hammer: mode === "simulate" ? null : get().hammer,
      pencil: mode === "simulate" ? false : get().pencil,
      edgeMenu: null,
      sheet: mode === "simulate" ? null : get().sheet,
    }),
  toggleMode: () => get().setMode(get().mode === "edit" ? "simulate" : "edit"),
  openScene: (id, scene, figure, history, view) =>
    set((s) => ({
      // estado de vista: o do projeto (peças que ainda existem); um exemplo começa sem nada escondido
      probes: view?.probes ?? [],
      hidden: (view?.hidden ?? []).filter((h) => scene.parts.some((p) => p.id === h)),
      hideMode: false,
      look: { ...LOOK_OFF, distance: s.look.distance },
      explain: null,
      current: { id, scene, figure, serial: (s.current?.serial ?? 0) + 1 },
      history: history ?? emptyHistory(),
      mode: "edit",
      hammer: null,
      pencil: false,
      pick: null,
      selection: null,
      sheet: null,
      details: false,
      edgeMenu: null,
      // a camada mais alta começa ativa: é a mais perto de quem olha
      activeLayer: Math.max(0, scene.layers.length - 1),
    })),
  select: (selection) =>
    set((s) => ({
      selection,
      details: selection && s.selection?.id === selection.id ? s.details : false,
      sheet: !selection && s.sheet === "card" ? null : s.sheet,
    })),
  setActiveLayer: (activeLayer) => set({ activeLayer }),
  setXray: (xray) => set({ xray }),

  commit: (cmd, after, opts) => {
    const s = get();
    if (!cmd || !s.current) return false;
    const r = run(s.current.scene, cmd.label, cmd.recipe);
    if (!r) return false;
    const selection = validSelection(
      r.scene,
      after && after.selection !== undefined ? after.selection : s.selection,
    );
    set({
      current: { ...s.current, scene: r.scene },
      history: opts?.merge
        ? pushMerged(s.history, { ...r.entry, merge: opts.merge }, performance.now())
        : push(s.history, r.entry),
      selection,
      activeLayer: clampLayer(r.scene, after?.activeLayer ?? s.activeLayer),
    });
    if (cmd.warning) s.notify(cmd.warning, { warn: true, undo: true });
    else if (cmd.notice) s.notify(cmd.notice, { undo: true });
    return true;
  },
  undo: () => {
    const s = get();
    if (!s.current || s.mode !== "edit") return;
    const r = undo(s.current.scene, s.history);
    if (!r) return;
    set({
      current: { ...s.current, scene: r.scene },
      history: r.history,
      selection: validSelection(r.scene, s.selection),
      activeLayer: clampLayer(r.scene, s.activeLayer),
    });
    s.notify(`Desfeito: ${lowerFirst(r.entry.label)}`);
  },
  redo: () => {
    const s = get();
    if (!s.current || s.mode !== "edit") return;
    const r = redo(s.current.scene, s.history);
    if (!r) return;
    set({
      current: { ...s.current, scene: r.scene },
      history: r.history,
      selection: validSelection(r.scene, s.selection),
      activeLayer: clampLayer(r.scene, s.activeLayer),
    });
    s.notify(`Refeito: ${lowerFirst(r.entry.label)}`);
  },
  notify: (text, opts) => set({ notice: { id: ++noticeSeq, text, ...opts } }),
  clearNotice: () => set({ notice: null }),
  setSheet: (sheet) => set({ sheet, edgeMenu: null }),
  setMainTab: (mainTab) => set({ mainTab }),
  setDetails: (details) => set({ details }),
  setEdgeMenu: (edgeMenu) => set({ edgeMenu }),
  setLefty: (lefty) => {
    writePref("il.lefty", lefty ? "1" : "0");
    set({ lefty });
  },
  setHint: (hint) => {
    writePref("il.hint", hint ? "1" : "0");
    set({ hint });
  },
}));
