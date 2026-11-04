import { ENGINES } from "@/engine/registry";
import { runSuite, type SuiteProgress } from "./suite";
import type { BenchReport } from "./types";

/** Mensagens do worker da bancada para a página. */
export type BenchWorkerMessage =
  | { type: "progress"; progress: SuiteProgress }
  | { type: "done"; report: BenchReport }
  | { type: "error"; message: string };

const post = (m: BenchWorkerMessage) => (self as unknown as { postMessage(m: unknown): void }).postMessage(m);

self.onmessage = async (e: MessageEvent<{ type: "run"; unitMm?: number }>) => {
  if (e.data?.type !== "run") return;
  try {
    const report = await runSuite({
      engines: ENGINES,
      ...(e.data.unitMm ? { unitMm: e.data.unitMm } : {}),
      now: () => performance.now(),
      environment: "browser",
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      onProgress: (progress) => post({ type: "progress", progress }),
      yieldEvery: () => new Promise((r) => setTimeout(r, 0)),
    });
    post({ type: "done", report });
  } catch (err) {
    post({ type: "error", message: (err as Error)?.message ?? String(err) });
  }
};
