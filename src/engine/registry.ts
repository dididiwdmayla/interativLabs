import type { EngineAdapter, EngineEntry } from "./types";

/**
 * Motores do comparativo, carregados sob demanda (cada um vira um pedaço
 * próprio do pacote). Nada aqui escolhe o motor do app: isso vem depois da
 * revisão do comparativo (docs/decisoes/motor.md).
 */
export const ENGINES: EngineEntry[] = [
  {
    id: "planck",
    label: "Planck",
    async load() {
      const m = await import("./planck/planckAdapter");
      return () => m.createPlanckAdapter();
    },
  },
  {
    id: "rapier-det",
    label: "Rapier (determinístico)",
    async load() {
      const [{ default: RAPIER }, m] = await Promise.all([
        import("@dimforge/rapier2d-deterministic-compat"),
        import("./rapier/rapierAdapter"),
      ]);
      await RAPIER.init();
      return (): EngineAdapter =>
        m.createRapierAdapter(RAPIER as never, { id: "rapier-det", name: "Rapier 2D (determinístico)" });
    },
  },
  {
    id: "rapier",
    label: "Rapier (padrão)",
    async load() {
      const [{ default: RAPIER }, m] = await Promise.all([
        import("@dimforge/rapier2d-compat"),
        import("./rapier/rapierAdapter"),
      ]);
      await RAPIER.init();
      return (): EngineAdapter => m.createRapierAdapter(RAPIER, { id: "rapier", name: "Rapier 2D (padrão)" });
    },
  },
  {
    id: "box2d",
    label: "Box2D v3",
    async load() {
      const [{ default: factory }, m] = await Promise.all([
        import("box2d3-wasm/compat"),
        import("./box2d/box2dAdapter"),
      ]);
      const B = await factory();
      return () => m.createBox2dAdapter(B as never);
    },
  },
];

export function engineEntry(id: string): EngineEntry | undefined {
  return ENGINES.find((e) => e.id === id);
}
