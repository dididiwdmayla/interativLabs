import { create } from "zustand";
import type { Series } from "@/instruments/sampling";
export const useInstruments = create<{ series: Series[]; setSeries: (series: Series[]) => void }>((set) => ({
  series: [],
  setSeries: (series) => set({ series }),
}));
