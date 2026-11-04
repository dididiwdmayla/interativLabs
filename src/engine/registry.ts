import type { EngineAdapter, EngineEntry } from "./types";

/**
 * Motores do comparativo (/#bench), carregados sob demanda (cada um vira um
 * pedaço próprio do pacote). O app usa só o Box2D, por src/engine/box2d/load.ts;
 * Planck e Rapier ficam só aqui. O Box2D da bancada é o calibrado do app.
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
    label: "Box2D v3 (calibrado)",
    async load() {
      const { loadBox2d } = await import("./box2d/load");
      return loadBox2d();
    },
  },
];

export function engineEntry(id: string): EngineEntry | undefined {
  return ENGINES.find((e) => e.id === id);
}
