import { loadBox2d } from "@/engine/box2d/load";
import { FIXTURES } from "@/sim/fixtures";
import { runFixture } from "@/sim/runner";

export interface LabHashReport {
  userAgent: string;
  results: Record<string, { hash: string; pass: boolean; stepMedian: number; stepP95: number }>;
}

/**
 * Roda todas as cenas de teste no navegador e devolve hash e tempo de passo
 * de cada uma. Exposto em window.__LAB__ para tests/e2e/determinism.spec.ts.
 */
export async function runAllFixtures(): Promise<LabHashReport> {
  const make = await loadBox2d();
  const results: LabHashReport["results"] = {};
  for (const f of FIXTURES) {
    const r = await runFixture(make(), f.script, await f.load(), {
      now: () => performance.now(),
      coarseTimer: true,
      yieldEvery: () => new Promise((res) => setTimeout(res, 0)),
    });
    results[f.id] = {
      hash: r.hash,
      pass: r.pass,
      stepMedian: Math.max(...r.runs.map((x) => x.stepMedian)),
      stepP95: Math.max(...r.runs.map((x) => x.stepP95)),
    };
  }
  return { userAgent: navigator.userAgent, results };
}
