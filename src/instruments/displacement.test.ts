import { expect, it } from "vitest";
import { Samples } from "./sampling";
import type { EngineAdapter, Snapshot } from "@/engine/types";
it("mede deslocamento desde a pose inicial e oferece posição absoluta", () => {
  const samples = new Samples();
  samples.configure([
    { id: "d", target: "p", quantity: "x", name: "Recuo" },
    { id: "a", target: "p", quantity: "absoluteX", name: "Posição" },
    { id: "missing", target: "missing", quantity: "x", name: "Ausente" },
  ]);
  const frame = (x: number) =>
    ({ time: 0, steps: 0, events: [], parts: { p: { x, y: 0, angle: 0 } }, links: {} }) as Snapshot;
  samples.record(0, frame(-65), {} as EngineAdapter);
  samples.record(1, frame(-70), {} as EngineAdapter);
  expect(samples.series(0)[0]?.cursor?.value).toBe(0);
  expect(samples.series(1).map((s) => s.cursor?.value)).toEqual([-5, -70, null]);
});
