import { create } from "zustand";
import type { ToolId } from "./tools";

export type Mode = "edit" | "simulate";

interface UiState {
  mode: Mode;
  tool: ToolId;
  sheetOpen: boolean;
  setTool: (tool: ToolId) => void;
  toggleMode: () => void;
  setSheetOpen: (open: boolean) => void;
}

/**
 * Estado de interface (não é a cena). A cena e a pilha de comandos
 * entram no item 7, com Zustand + Immer.
 */
export const useUiStore = create<UiState>()((set) => ({
  mode: "edit",
  tool: "select",
  sheetOpen: false,
  setTool: (tool) => set({ tool }),
  toggleMode: () => set((s) => ({ mode: s.mode === "edit" ? "simulate" : "edit" })),
  setSheetOpen: (sheetOpen) => set({ sheetOpen }),
}));
