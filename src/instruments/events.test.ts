import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { loadBox2d } from "@/engine/box2d/load";
import { loadScene } from "@/model/scene";
import { SimSession } from "@/sim/session";
import type { EngineEvent } from "@/engine/types";
import { eventTick, STRONG_IMPACT } from "./events";
it("launcher ticks retain the engine event order and recording step", async () => {
  const loaded = loadScene(JSON.parse(readFileSync("scenes/examples/lancador-bancada.json", "utf8")));
  if (!loaded.ok) throw new Error("Cena inválida");
  const s = new SimSession(await loadBox2d(), loaded.scene);
  const raw: { step: number; event: EngineEvent }[] = [];
  for (let i = 0; i < 432; i++) {
    if (i === 72) s.dragStart("p19", [16, 35.5]);
    if (i > 72 && i <= 101) s.dragMove([16 - (18 * (i - 72)) / 29, 35.5 - (i - 72) / 29]);
    if (i === 360) s.dragEnd();
    for (const event of s.advance().events) raw.push({ step: s.step, event });
  }
  const eligible = raw.filter(
    ({ event: e }) =>
      ["sensor", "chamber-fired", "vent-opened", "vent-closed", "lock-released"].includes(e.kind) ||
      (e.kind === "impact" && e.speed >= STRONG_IMPACT),
  );
  expect(eligible.some(({ event: e }) => e.kind === "chamber-fired")).toBe(true);
  expect(s.events.map((e) => [e.step, e.kind])).toEqual(
    eligible.map(({ step, event }) => [step, event.kind]),
  );
  expect(s.events.some((e) => e.kind === "vent-opened")).toBe(true);
  // The first shot starts with the controlled vent closed; no closing transition is emitted.
  s.dispose();
});
it("weak impacts are omitted and vent ticks preserve the chamber", () => {
  expect(eventTick({ kind: "impact", a: "a", b: "b", speed: 599, point: [0, 0], time: 1 }, 240)).toBeNull();
  expect(eventTick({ kind: "vent-closed", chamber: "c", vent: 0, time: 1 }, 240)).toEqual({
    step: 240,
    kind: "vent-closed",
    id: "c",
  });
});
