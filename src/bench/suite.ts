import type { EngineEntry } from "@/engine/types";
import { runScript, timerResolutionUs } from "./runner";
import { benchCases } from "./scenes";
import type { BenchReport, SceneResult } from "./types";

/** Escala interna padrão do comparativo (mm por unidade do motor). */
export const DEFAULT_UNIT_MM = 1;

export interface SuiteProgress {
  engine: string;
  scene: string;
  unitMm: number;
  done: number;
  total: number;
  result?: SceneResult;
}

export interface SuiteOptions {
  engines: EngineEntry[];
  unitMm?: number;
  now: () => number;
  environment: BenchReport["environment"]["kind"];
  userAgent: string;
  hardwareConcurrency: number | null;
  /** só estas cenas (ids), para testes */
  only?: string[];
  onProgress?: (p: SuiteProgress) => void;
  yieldEvery?: () => Promise<void>;
}

/** Roda todos os motores em todas as cenas (e nas escalas extras pedidas). */
export async function runSuite(o: SuiteOptions): Promise<BenchReport> {
  const unitMm = o.unitMm ?? DEFAULT_UNIT_MM;
  const res = timerResolutionUs(o.now);
  const coarse = res > 20;
  const cases = benchCases().filter((c) => !o.only || o.only.includes(c.script.id));
  const jobs = cases.flatMap((c) =>
    [unitMm, ...(c.script.extraScales ?? []).filter((u) => u !== unitMm)].map((u) => ({ c, u })),
  );
  const total = jobs.length * o.engines.length;
  const report: BenchReport = {
    createdAt: new Date().toISOString(),
    environment: {
      kind: o.environment,
      userAgent: o.userAgent,
      hardwareConcurrency: o.hardwareConcurrency,
      timerResolutionUs: Math.round(res * 1000) / 1000,
    },
    unitMm,
    engines: [],
    results: [],
  };
  let done = 0;
  for (const e of o.engines) {
    const make = await e.load();
    let meta = null as BenchReport["engines"][number] | null;
    for (const { c, u } of jobs) {
      o.onProgress?.({ engine: e.id, scene: c.script.id, unitMm: u, done, total });
      const adapter = make();
      const r = await runScript(adapter, c.script, c.scene, {
        unitMm: u,
        now: o.now,
        coarseTimer: coarse,
        ...(o.yieldEvery ? { yieldEvery: o.yieldEvery } : {}),
      });
      meta ??= { ...adapter.meta };
      report.results.push(r);
      done++;
      o.onProgress?.({ engine: e.id, scene: c.script.id, unitMm: u, done, total, result: r });
    }
    if (meta) report.engines.push(meta);
  }
  return report;
}
