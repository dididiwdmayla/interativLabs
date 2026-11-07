import type { EventTick } from "@/instruments/events";
import { create } from "zustand";
import type { Series } from "@/instruments/sampling";
interface InstrumentsState {
  series: Series[];
  ticks: EventTick[];
  shown: number;
  latest: number;
  setTime: (shown: number, latest: number, ticks: EventTick[]) => void;
  setSeries: (series: Series[]) => void;
}
export const useInstruments = create<InstrumentsState>((set) => ({
  series: [],
  ticks: [],
  shown: 0,
  latest: 0,
  setTime: (shown, latest, ticks) => set({ shown, latest, ticks }),
  setSeries: (series) => set({ series }),
}));
