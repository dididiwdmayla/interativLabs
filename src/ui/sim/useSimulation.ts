import { useEffect } from "react";
import { drawnFrame, type StageNodes } from "@/render/nodes";
import { DEFAULT_SPEED } from "@/sim/pacing";
import type { ControllerOptions } from "./controller";
import { useSimStore } from "./simStore";

/**
 * Liga a simulação enquanto `on` for verdadeiro: carrega o controlador e o
 * motor sob demanda (primeira vez), cria a sessão da cena montada em
 * `nodes` (sempre em Normal) e, ao sair, descarta tudo e devolve a cena à
 * pose desenhada.
 */
export function useSimulation(on: boolean, nodes: StageNodes | null, opts?: ControllerOptions): void {
  useEffect(() => {
    if (!on || !nodes) return;
    let alive = true;
    const store = useSimStore.getState();
    // Normal (¼ do tempo real) ao entrar em Testar
    store.set({
      status: "loading",
      error: null,
      recalculating: false,
      scrubbed: false,
      paused: false,
      speed: DEFAULT_SPEED,
    });
    import("./controller")
      .then((m) => m.createController(nodes, opts))
      .then(
        (ctl) => {
          if (!alive) {
            ctl.dispose();
            return;
          }
          useSimStore.getState().set({ ctl, status: "ready" });
        },
        (e: Error) => alive && useSimStore.getState().set({ status: "error", error: e.message }),
      );
    return () => {
      alive = false;
      useSimStore.getState().ctl?.dispose();
      useSimStore.getState().set({ ctl: null, status: "off", recalculating: false, scrubbed: false });
      nodes.setDrag(null);
      nodes.resetPeaks();
      nodes.write(drawnFrame(nodes.model), true);
    };
    // opts é fixo por página
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, nodes]);
}
