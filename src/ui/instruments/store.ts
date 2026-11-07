import { create } from "zustand";
import type { Series } from "@/instruments/sampling";
interface InstrumentsState {
  series: Series[];
  shown: number;
  latest: number;
  setTime: (shown: number, latest: number) => void;
  setSeries: (series: Series[]) => void;
}
export const useInstruments = create<InstrumentsState>((set) => ({
  series: [],
  shown: 0,
  latest: 0,
  setTime: (shown, latest) => set({ shown, latest }),
  setSeries: (series) => set({ series }),
}));
