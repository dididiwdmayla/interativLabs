import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { loadScene } from "@/model/scene";
import { loadBox2d } from "@/engine/box2d/load";
import { SimSession } from "@/sim/session";
import { applyInputs } from "@/sim/runner";
import { rodaScene, rodaScript } from "../../scripts/fixtures/roda";
import { Samples } from "./sampling";
import { instrumentPreset } from "./presets";
function scene(name: string) {
  const loaded = loadScene(JSON.parse(readFileSync(`scenes/examples/${name}.json`, "utf8")));
  if (!loaded.ok) throw new Error("Cena inválida");
  return loaded.scene;
}
it("launcher graph preserves the 10.3 ±0.3 m/s ball peak and chamber model", async () => {
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
  const peak = Math.max(...s.samples.series(432)[0]!.points.map((p) => p.value ?? 0));
  expect(peak).toBeGreaterThanOrEqual(10);
  expect(peak).toBeLessThanOrEqual(10.6);
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
