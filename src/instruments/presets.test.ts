import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { loadScene } from "@/model/scene";
import { loadBox2d } from "@/engine/box2d/load";
import { SimSession } from "@/sim/session";
import { applyInputs } from "@/sim/runner";
import { rodaScene, rodaScript } from "../../scripts/fixtures/roda";
import { Samples } from "./sampling";
import { sample } from "./model";
import { instrumentPreset } from "./presets";
function scene(name: string) {
  const loaded = loadScene(JSON.parse(readFileSync(`scenes/examples/${name}.json`, "utf8")));
  if (!loaded.ok) throw new Error("Cena inválida");
  return loaded.scene;
}
it("launcher reads the exit speed at the muzzle (10.3 ±0.3 m/s) and keeps the instantaneous peak in the graph", async () => {
  const sc = scene("lancador-bancada");
  const s = new SimSession(await loadBox2d(), sc, { probes: instrumentPreset(sc) });
  for (let i = 0; i < 432; i++) {
    if (i === 72) s.dragStart("p19", [16, 35.5]);
    if (i > 72 && i <= 101)
      s.dragMove([16 - 18 * Math.min(1, (i - 72) / 28.8), 35.5 - Math.min(1, (i - 72) / 28.8)]);
    if (i === 360) s.dragEnd();
    const snapshot = s.advance();
    if (i === 100) expect(s.samples.series(s.step)[1]!.cursor?.value).toBe(snapshot.links.k30!.pressure);
  }
  const speed = s.samples.series(432)[0]!;
  const exits = speed.marks!;
  // one exit per shot in this run, at the step the ball passes x = 50 mm
  expect(exits).toHaveLength(1);
  expect(exits[0]!.value).toBeGreaterThanOrEqual(10);
  expect(exits[0]!.value).toBeLessThanOrEqual(10.6);
  // the instantaneous peak (gas pulse, with a vertical component) stays visible in the curve
  const peak = Math.max(...speed.points.map((p) => p.value ?? 0));
  expect(peak).toBeGreaterThan(exits[0]!.value!);
  s.dispose();
});
it("pawl drop count matches teeth passed in one crank turn", async () => {
  const sc = scene("roda-e-lingueta");
  const make = await loadBox2d();
  const e = make();
  e.compile(sc, { unitMm: 1 });
  const samples = new Samples();
  samples.configure(instrumentPreset(sc));
  const run = rodaScript(rodaScene()).runs[2]!;
  let initial = 0,
    final = 0;
  for (let i = 0; i < 528; i++) {
    applyInputs(e, run.inputs, i / 240, 1 / 240);
    e.step(1 / 240);
    const s = e.snapshot();
    samples.record(i + 1, s, e);
    if (i === 23) initial = s.links.k5!.angle!;
    if (i === 503) final = s.links.k5!.angle!;
  }
  const teeth = Math.round(Math.abs(final - initial) / ((2 * Math.PI) / 24));
  expect(teeth).toBe(8);
  expect(samples.series(528)[1]!.clicks).toBe(teeth);
  e.dispose();
});

it("pawl torque shows up while the ratchet pushes it: spring k·Δθ plus the stop, never the old zero", async () => {
  const sc = scene("roda-e-lingueta");
  const make = await loadBox2d();
  const e = make();
  e.compile(sc, { unitMm: 1 });
  const probe = instrumentPreset(sc)[1]!;
  const run = rodaScript(rodaScene()).runs[2]!;
  const axle = sc.links.find((l) => l.id === "k7" && l.kind === "axle");
  if (axle?.kind !== "axle" || !axle.torsion) throw new Error("Lingueta sem mola de torção");
  let peak = 0;
  for (let i = 0; i < 528; i++) {
    applyInputs(e, run.inputs, i / 240, 1 / 240);
    e.step(1 / 240);
    const snapshot = e.snapshot();
    const torque = sample(probe, snapshot, e)!;
    peak = Math.max(peak, Math.abs(torque));
    const link = snapshot.links.k7!;
    // while free (between the stops) the reading is the spring's own law
    if (Math.abs(link.angle! - axle.limit!.lower) > 0.01 && Math.abs(link.angle! - axle.limit!.upper) > 0.01)
      expect(torque).toBeCloseTo(
        -axle.torsion.k * (link.angle! - axle.torsion.rest) - axle.torsion.damping * link.speed!,
        6,
      );
  }
  // the tooth lifts the pawl about 0.43 rad off its rest angle: k · 0.43 ≈ 0.017 N·mm (it used to read 0)
  expect(peak).toBeGreaterThan(0.015);
  expect(peak).toBeLessThan(axle.torsion.k * (axle.limit!.upper - axle.torsion.rest) + 0.005);
  e.dispose();
});
it("disparo-extracao: pressure of the capsule, exit speed at the muzzle, bolt recoil and force at the claw", async () => {
  const loaded = loadScene(
    JSON.parse(readFileSync("scenes/fixtures/ciclo/disparo-extracao.scene.json", "utf8")),
  );
  if (!loaded.ok) throw new Error("Cena inválida");
  const sc = loaded.scene;
  const probes = instrumentPreset(sc);
  expect(probes.map((p) => p.id)).toEqual([
    "capsule-pressure",
    "ball-speed",
    "bolt-position",
    "extractor-force",
  ]);
  const s = new SimSession(await loadBox2d(), sc, { probes });
  for (let i = 0; i < 120; i++) {
    if (i === 24) s.release("k15");
    s.advance();
  }
  const [pressure, speed, bolt, claw] = s.samples.series(120);
  const max = (x: typeof pressure) => Math.max(...x!.points.map((p) => p.value ?? -Infinity));
  expect(max(pressure)).toBeGreaterThan(500);
  expect(speed!.marks).toHaveLength(1);
  expect(speed!.marks![0]!.value).toBeGreaterThan(12);
  expect(speed!.marks![0]!.value).toBeLessThan(25);
  expect(Math.min(...bolt!.points.map((p) => p.value ?? 0))).toBeLessThan(-22);
  expect(max(claw)).toBeGreaterThan(0.05);
  s.dispose();
});
