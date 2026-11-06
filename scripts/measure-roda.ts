import { readFileSync, writeFileSync } from "node:fs";
import { parseScene } from "../src/model/scene";
import { loadBox2d } from "../src/engine/box2d/load";
import { applyInputs, runFixture } from "../src/sim/runner";
import type { FixtureScript } from "../src/sim/script";
import { rodaScene } from "./fixtures/roda";

export async function measureRoda() {
  const loaded = parseScene(readFileSync("scenes/examples/roda-e-lingueta.json", "utf8"));
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
  const scene = loaded.scene,
    r = rodaScene();
  const script = JSON.parse(
    readFileSync("scenes/fixtures/exemplos/roda-e-lingueta.test.json", "utf8"),
  ) as FixtureScript;
  const make = await loadBox2d(),
    fixture = await runFixture(make(), script, scene);
  const runs = [];
  for (const run of script.runs) {
    const e = make();
    e.compile(scene, { unitMm: 1 });
    let lo = Infinity,
      hi = -Infinity,
      maxReverse = 0,
      clicks = 0,
      previous = 0,
      rising = false,
      mismatchedContacts = 0,
      contactSamples = 0,
      wheelAtDriveStart = 0,
      pinionAtDriveStart = 0,
      angleAtDriveEnd = 0,
      pinionAtDriveEnd = 0;
    for (let i = 0; i < Math.round(run.duration * 240); i++) {
      applyInputs(e, run.inputs, i / 240, 1 / 240);
      e.step(1 / 240);
      const snapshot = e.snapshot(),
        angle = (snapshot.links[r.wheelAxle.id]!.angle! * 180) / Math.PI;
      maxReverse = Math.max(maxReverse, angle);
      if (i >= 120) {
        lo = Math.min(lo, angle);
        hi = Math.max(hi, angle);
      }
      if (i === 23) {
        wheelAtDriveStart = angle;
        pinionAtDriveStart = (snapshot.links[r.pinionAxle.id]!.angle! * 180) / Math.PI;
      }
      if (i === 503) {
        angleAtDriveEnd = angle;
        pinionAtDriveEnd = (snapshot.links[r.pinionAxle.id]!.angle! * 180) / Math.PI;
      }
      const pawl = snapshot.links[r.pawlAxle.id]!.angle!;
      // Count the physical drop after each tooth lifts the pawl; suppress sub-step chatter.
      if (pawl - previous > 0.002) rising = true;
      else if (rising && pawl - previous < -0.002) {
        if (i >= 24) clicks++;
        rising = false;
      }
      previous = pawl;
      for (const c of e.contactPairs?.() ?? []) {
        contactSamples++;
        if (!(c.bitsA & c.bitsB)) mismatchedContacts++;
      }
    }
    const end = e.snapshot();
    runs.push({
      name: run.name,
      finalWheelDeg: (end.links[r.wheelAxle.id]!.angle! * 180) / Math.PI,
      maxReverseDeg: maxReverse,
      stationarySpanDeg: hi - lo,
      angleAtDriveEnd,
      pinionAtDriveEnd,
      wheelTravelDeg: angleAtDriveEnd - wheelAtDriveStart,
      pinionTravelDeg: pinionAtDriveEnd - pinionAtDriveStart,
      clicks,
      contactSamples,
      mismatchedContacts,
    });
    e.dispose();
  }
  return { fixture, runs };
}
export async function main() {
  const report = await measureRoda();
  writeFileSync("docs/decisoes/roda-e-lingueta-e2b.json", JSON.stringify(report, null, 2) + "\n");
  const hashes = JSON.parse(readFileSync("scenes/fixtures/hashes.json", "utf8")) as Record<string, string>;
  hashes[report.fixture.id] = report.fixture.hash;
  writeFileSync("scenes/fixtures/hashes.json", JSON.stringify(hashes, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
