import { create } from "zustand";
import type { Scene } from "@/model/types";
import type { Selection } from "@/render/SceneSvg";
import type { ToolId } from "./tools";

export type Mode = "edit" | "simulate";
export type { Selection } from "@/render/SceneSvg";

export interface OpenScene {
  /** id do exemplo (scenes/examples) */
  id: string;
  scene: Scene;
  /** número da figura ("Fig. N") */
  figure: number;
  /** muda a cada abertura (reenquadra) */
  serial: number;
}

interface UiState {
  mode: Mode;
  tool: ToolId;
  sheetOpen: boolean;
  menuOpen: boolean;
  current: OpenScene | null;
  selection: Selection;
  /** índice da camada ativa (0 = fundo) */
  activeLayer: number;
  /** raio-x: só contornos */
  xray: boolean;
  setTool: (tool: ToolId) => void;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
  setSheetOpen: (open: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  openScene: (id: string, scene: Scene, figure: number) => void;
  select: (s: Selection) => void;
  setActiveLayer: (i: number) => void;
  setXray: (on: boolean) => void;
}

/**
 * Estado de interface (não é a cena editável: comandos e desfazer entram na
 * Parte E2). A cena aberta é um exemplo, só para ver e simular.
 */
export const useUiStore = create<UiState>()((set) => ({
  mode: "edit",
  tool: "select",
  sheetOpen: false,
  menuOpen: false,
  current: null,
  selection: null,
  activeLayer: 0,
  xray: false,
  setTool: (tool) => set({ tool }),
  setMode: (mode) => set({ mode }),
  toggleMode: () => set((s) => ({ mode: s.mode === "edit" ? "simulate" : "edit" })),
  setSheetOpen: (sheetOpen) => set({ sheetOpen }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  openScene: (id, scene, figure) =>
    set((s) => ({
      current: { id, scene, figure, serial: (s.current?.serial ?? 0) + 1 },
      mode: "edit",
      selection: null,
      menuOpen: false,
      // a camada mais alta começa ativa: é a mais perto de quem olha
      activeLayer: Math.max(0, scene.layers.length - 1),
    })),
  select: (selection) => set({ selection }),
  setActiveLayer: (activeLayer) => set({ activeLayer }),
  setXray: (xray) => set({ xray }),
}));
