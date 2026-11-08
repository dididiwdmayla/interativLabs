import type { Variant } from "./projects";
import type { Probe } from "@/instruments/model";
import { create } from "zustand";
import type { Id, Scene } from "@/model/types";
import type { Selection } from "@/render/SceneSvg";
import type { CardPick } from "./cardPick";
import type { ExplainKind } from "./explain";
import type { HammerTool } from "./hammer";
import { DEFAULT_PENCIL, type PencilTool } from "./pencil";
import type { Command } from "./commands";
import { emptyHistory, lowerFirst, push, pushMerged, redo, run, undo, type HistoryState } from "./history";
import { sound } from "@/sound";
import { commitSound } from "@/sound/tools";

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
  variants: Variant[];
  activeVariant: string;
  variantSnapshot: () => Variant[];
  switchVariant: (id: string) => void;
  createVariant: () => string | null;
  renameVariant: (id: string, name: string) => void;
  deleteVariant: (id: string) => void;
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
  gapTarget: string | null;
  setGapTarget: (target: string | null) => void;
  probes: Probe[];
  setProbes: (probes: Probe[]) => void;
  hide: (id: Id) => void;
  unhide: (id: Id) => void;
  unhideAll: () => void;
  /** rastro do movimento no Testar */
  trail: boolean;
  setTrail: (on: boolean) => void;
  /** faixa do Som (Música e Efeitos) */
  soundBar: boolean;
  setSoundBar: (on: boolean) => void;
  /** cartão "o que é" aberto */
  explain: ExplainKind | null;
  setExplain: (k: ExplainKind | null) => void;
  /** a gaveta sai da frente enquanto uma peça é arrastada dela */
  drawerAway: boolean;
  setDrawerAway: (on: boolean) => void;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
  openScene: (
    id: string,
    scene: Scene,
    figure: number,
    history?: HistoryState,
    view?: ProjectView,
    variants?: Variant[],
    activeVariant?: string,
  ) => void;
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
  setHammer: (hammer) => {
    // abrir a faixa do Martelo (não trocar de ferramenta dentro dela)
    if (hammer && !get().hammer) sound.play("sfx-ui");
    set((s) => ({
      hammer,
      pencil: hammer ? false : s.pencil,
      hideMode: hammer ? false : s.hideMode,
      soundBar: hammer ? false : s.soundBar,
      pick: null,
      sheet: null,
      edgeMenu: null,
      selection: null,
    }));
  },
  pencil: false,
  pencilTool: DEFAULT_PENCIL,
  // o Lápis age na peça escolhida: a seleção fica
  setPencil: (pencil) => {
    if (pencil && !get().pencil) sound.play("sfx-ui");
    set((s) => ({
      pencil,
      hammer: pencil ? null : s.hammer,
      hideMode: pencil ? false : s.hideMode,
      soundBar: pencil ? false : s.soundBar,
      pick: null,
      edgeMenu: null,
    }));
  },
  setPencilTool: (patch) => set((s) => ({ pencilTool: { ...s.pencilTool, ...patch } })),
  current: null,
  variants: [],
  activeVariant: "A",
  variantSnapshot: () => {
    const s = get();
    return s.variants.map((v) =>
      v.id === s.activeVariant && s.current ? { ...v, scene: s.current.scene, history: s.history } : v,
    );
  },
  switchVariant: (id) => {
    const s = get();
    const variants = s.variantSnapshot();
    const next = variants.find((v) => v.id === id);
    if (!next || !s.current) return;
    set({
      variants,
      activeVariant: id,
      current: { ...s.current, scene: next.scene },
      history: next.history,
      mode: "edit",
      selection: null,
      sheet: null,
      pick: null,
      activeLayer: Math.max(0, next.scene.layers.length - 1),
    });
  },
  createVariant: () => {
    const s = get();
    if (!s.current) return null;
    const variants = s.variantSnapshot();
    const id = ["B", "C", "D"].find((id) => !variants.some((v) => v.id === id));
    if (!id) return null;
    set({
      variants: [
        ...variants,
        { id, name: id, scene: structuredClone(s.current.scene), history: emptyHistory() },
      ],
    });
    get().switchVariant(id);
    return id;
  },
  renameVariant: (id, name) => {
    if (name.trim())
      set((s) => ({ variants: s.variants.map((v) => (v.id === id ? { ...v, name: name.trim() } : v)) }));
  },
  deleteVariant: (id) => {
    if (id === "A") return;
    if (get().activeVariant === id) get().switchVariant("A");
    set((s) => ({ variants: s.variants.filter((v) => v.id !== id) }));
  },
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
  setLook: (patch) => {
    if (patch.open === true && !get().look.open) sound.play("sfx-ui");
    set((s) => {
      const look = { ...s.look, ...patch };
      // abrir o modo liga as cores; fechar volta tudo ao normal
      if (patch.open === true && !s.look.open) look.colors = true;
      if (patch.open === false) return { look: { ...LOOK_OFF, distance: s.look.distance } };
      return { look, soundBar: patch.open === true ? false : s.soundBar };
    });
  },
  hideMode: false,
  setHideMode: (hideMode) => {
    if (hideMode && !get().hideMode) sound.play("sfx-ui");
    set((s) => ({
      hideMode,
      hammer: hideMode ? null : s.hammer,
      pencil: hideMode ? false : s.pencil,
      soundBar: hideMode ? false : s.soundBar,
      pick: null,
      edgeMenu: null,
    }));
  },
  gapTarget: null,
  setGapTarget: (gapTarget) => set({ gapTarget }),
  probes: [],
  setProbes: (probes) => set({ probes: probes.slice(0, 4) }),
  hidden: [],
  hide: (id) => set((s) => (s.hidden.includes(id) ? {} : { hidden: [...s.hidden, id] })),
  unhide: (id) => set((s) => ({ hidden: s.hidden.filter((x) => x !== id) })),
  unhideAll: () => set({ hidden: [] }),
  trail: false,
  setTrail: (trail) => set({ trail }),
  soundBar: false,
  setSoundBar: (soundBar) => {
    if (soundBar && !get().soundBar) sound.play("sfx-ui");
    set((s) =>
      soundBar
        ? {
            soundBar,
            hammer: null,
            pencil: false,
            hideMode: false,
            look: { ...LOOK_OFF, distance: s.look.distance },
            pick: null,
            edgeMenu: null,
          }
        : { soundBar },
    );
  },
  explain: null,
  setExplain: (explain) => {
    if (explain && !get().explain) sound.play("sfx-ui");
    set({ explain });
  },
  drawerAway: false,
  setDrawerAway: (drawerAway) => set({ drawerAway }),
  setMode: (mode) => {
    if (mode !== get().mode) sound.play("sfx-mode");
    set({
      mode,
      pick: null,
      hammer: mode === "simulate" ? null : get().hammer,
      pencil: mode === "simulate" ? false : get().pencil,
      edgeMenu: null,
      sheet: mode === "simulate" ? null : get().sheet,
    });
  },
  toggleMode: () => get().setMode(get().mode === "edit" ? "simulate" : "edit"),
  openScene: (id, scene, figure, history, view, variants, activeVariant) =>
    set((s) => ({
      // estado de vista: o do projeto (peças que ainda existem); um exemplo começa sem nada escondido
      variants: variants ?? [{ id: "A", name: "A", scene, history: history ?? emptyHistory() }],
      activeVariant: activeVariant ?? "A",
      gapTarget: null,
      probes: view?.probes ?? [],
      hidden: view?.hidden ?? [],
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
    // o som segue o comando registrado (ligação carimbada), não o clique
    const tone = commitSound(s.current.scene, r.scene);
    if (tone) sound.play(tone);
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
  setSheet: (sheet) => {
    // abrir o cartão (não trocar de folha para o mesmo cartão)
    if (sheet === "card" && get().sheet !== "card") sound.play("sfx-ui");
    set({ sheet, edgeMenu: null });
  },
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
