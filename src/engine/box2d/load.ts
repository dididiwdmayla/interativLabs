import type { EngineAdapter } from "../types";
import type { Box2dTuning } from "./box2dAdapter";

/**
 * Motor do app: Box2D v3 (docs/arquitetura.md §4), carregado sob demanda —
 * o WASM (≈ 220 KB gzip) vira um pedaço próprio do pacote e só baixa quando
 * a simulação começa.
 */
export async function loadBox2d(tuning?: Box2dTuning): Promise<() => EngineAdapter> {
  const [{ default: factory }, m] = await Promise.all([
    import("box2d3-wasm/compat"),
    import("./box2dAdapter"),
  ]);
  const B = await factory();
  return () => m.createBox2dAdapter(B as never, tuning);
}
