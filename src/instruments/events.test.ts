import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { loadBox2d } from "@/engine/box2d/load";
import { loadScene } from "@/model/scene";
import { SimSession } from "@/sim/session";
import type { EngineEvent } from "@/engine/types";
import { eventTick, groupTicks, STRONG_IMPACT, type EventTick } from "./events";
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
      ["sensor", "chamber-fired", "vent-opened", "vent-closed", "lock-released", "wall-unsealed"].includes(
        e.kind,
      ) ||
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
it("ticks too close for the ruler group into one marker that keeps every event in order", () => {
  const at = (step: number, kind: EventTick["kind"] = "vent-opened"): EventTick => ({
    step,
    kind,
    id: "k30",
  });
  // the launcher fires within a few steps: sensor, chamber, sensor, vent, unseal, vent
  const burst = [
    at(87, "sensor"),
    at(87, "chamber-fired"),
    at(91, "sensor"),
    at(91),
    at(92, "wall-unsealed"),
    at(95),
  ];
  const ruler = 82; // px per second on an 844 px wide screen
  const groups = groupTicks([at(1), ...burst, at(114), at(160), at(600)], ruler);
  expect(groups.map((g) => g.events.length)).toEqual([1, 7, 1, 1]);
  expect(groups[1]!.events.map((e) => e.step)).toEqual([87, 87, 91, 91, 92, 95, 114]);
  // zoomed in enough, the same events separate
  expect(groupTicks(burst, 4000).length).toBeGreaterThan(1);
  // ticks before the visible window are skipped
  expect(groupTicks(burst, ruler, 2)).toEqual([]);
});
