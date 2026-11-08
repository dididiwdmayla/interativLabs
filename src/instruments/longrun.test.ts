import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { loadBox2d } from "@/engine/box2d/load";
import { loadScene } from "@/model/scene";
import { SimSession } from "@/sim/session";
import { EXACT_STEPS } from "./sampling";
import { instrumentPreset } from "./presets";

const MINUTE = 240 * 60;

it("a 60 s run keeps the sample memory bounded, every peak and the exact last ten seconds", async () => {
  const loaded = loadScene(JSON.parse(readFileSync("scenes/examples/lancador-bancada.json", "utf8")));
  if (!loaded.ok) throw new Error("Cena inválida");
  const scene = loaded.scene;
  const probes = instrumentPreset(scene);
  const s = new SimSession(await loadBox2d(), scene, { probes });
  for (let i = 0; i < MINUTE; i++) {
    if (i === 72) s.dragStart("p19", [16, 35.5]);
    if (i > 72 && i <= 101)
      s.dragMove([16 - 18 * Math.min(1, (i - 72) / 28.8), 35.5 - Math.min(1, (i - 72) / 28.8)]);
    if (i === 360) s.dragEnd();
    s.advance();
  }
  // without reduction this would be 4 probes × 14 401 samples
  const stored = s.samples.stored();
  console.log("60 s: samples kept", stored, "of", 4 * (MINUTE + 1));
  expect(stored).toBeLessThan(4 * 8800);
  expect(stored).toBeLessThan((4 * (MINUTE + 1)) / 1.5);

  const series = s.samples.series(s.step);
  // the exit speed and the instantaneous peak from the first second survive the reduction
  expect(series[0]!.marks!.length).toBeGreaterThan(0);
  expect(Math.max(...series[0]!.points.map((p) => p.value ?? 0))).toBeCloseTo(10.96, 1);
  // the recoil of the bolt (−15 mm at its stop) too
  expect(Math.min(...series[2]!.points.map((p) => p.value ?? 0))).toBeLessThan(-14.9);
  // the cursor is exact over the last ten seconds, where the stage has poses …
  for (const step of [s.step, s.step - 1200, s.step - 2400])
    expect(s.samples.series(step)[0]!.cursor?.step).toBe(step);
  // … and has no reading further back (the chart does not invent one)
  expect(s.samples.series(s.step - EXACT_STEPS - 500)[0]!.cursor).toBeNull();
  expect(s.samples.series(100)[0]!.cursor).toBeNull();
  s.dispose();
});

it("the recording window and the exact samples agree: scrubbing can only land where the cursor reads", async () => {
  const loaded = loadScene(JSON.parse(readFileSync("scenes/examples/lancador-bancada.json", "utf8")));
  if (!loaded.ok) throw new Error("Cena inválida");
  const s = new SimSession(await loadBox2d(), loaded.scene, { probes: instrumentPreset(loaded.scene) });
  for (let i = 0; i < 3 * 2400; i++) s.advance();
  // the oldest pose still recorded is the oldest step with an exact reading
  expect(s.rec.oldest).toBe(s.step - 2400);
  expect(s.samples.series(s.rec.oldest)[0]!.cursor?.step).toBe(s.rec.oldest);
  expect(EXACT_STEPS).toBeGreaterThan(2400);
  s.dispose();
});
