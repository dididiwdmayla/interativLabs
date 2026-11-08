import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseSceneJson } from "@/model/scene";
import { loadBox2d } from "@/engine/box2d/load";
import { replay } from "@/sim/comparison";
import { PoseHash } from "@/sim/runner";
import { RETURN_SPRING_FACTOR, stifferReturnSpring } from "./experiment";
import { instrumentPreset, launcherInputs } from "./presets";
import { launcherMetrics, launcherSummary } from "./comparisonMetrics";

it("Experimente comparar: a mola 50% mais rígida ainda faz o ciclo completo e o encurta", async () => {
  const parsed = parseSceneJson(readFileSync("scenes/examples/lancador-bancada.json", "utf8"));
  if (!parsed.ok) throw new Error("Cena inválida");
  const scene = parsed.scene;
  const stiffer = stifferReturnSpring(scene);
  if (stiffer?.kind !== "spring") throw new Error("Sem mola de retorno");
  expect(stiffer.k).toBeCloseTo(0.015 * RETURN_SPRING_FACTOR, 9);
  const b = { ...scene, links: scene.links.map((l) => (l.id === stiffer.id ? stiffer : l)) };
  // only the spring changes
  expect(b.links.filter((l, i) => l !== scene.links[i])).toEqual([stiffer]);

  const make = await loadBox2d();
  const aRun = replay(make, scene, launcherInputs(), 432, instrumentPreset(scene));
  const bRun = replay(make, b, launcherInputs(), 432, instrumentPreset(scene));
  const a = launcherMetrics(aRun.samples.series(432, 433), aRun.events);
  const bm = launcherMetrics(bRun.samples.series(432, 433), bRun.events);
  console.log("Experimente comparar", JSON.stringify({ A: a, B: bm }), launcherSummary(a, bm));

  // A: the bolt recoils to its 15 mm stop and returns in 0.24 s
  expect(a.recoil).toBeGreaterThan(14.9);
  expect(a.cycle).toBeCloseTo(0.2417, 3);
  // B still completes the cycle (the bolt returns to the drawn pose) …
  expect(bm.recoil).not.toBeNull();
  expect(bm.recoil).toBeGreaterThan(14);
  expect(bm.recoil).toBeLessThanOrEqual(a.recoil! + 1e-9);
  expect(bm.cycle).not.toBeNull();
  // … faster: at least 20 % shorter
  expect(bm.cycle!).toBeLessThan(a.cycle! * 0.8);
  // and still feeds the next ball into the chamber, where the first one started
  for (const run of [aRun, bRun]) {
    expect(run.last.parts.p11!.x).toBeCloseTo(9.65, 1);
    expect(run.last.parts.p11!.y).toBeCloseTo(1.296, 1);
  }
  // the comparison itself never touches the physics: the same variant twice gives the same poses
  const again = replay(make, scene, launcherInputs(), 432, instrumentPreset(scene));
  const ids = scene.parts.map((p) => p.id);
  const hashes = [aRun, again].map((run) => {
    const hash = new PoseHash();
    hash.addSnapshot(run.snapshot(), ids);
    return hash.digest();
  });
  expect(hashes[0]).toBe(hashes[1]);
  aRun.dispose();
  bRun.dispose();
  again.dispose();
});

it("o resumo é curto: duas linhas que cabem em 844 px", () => {
  const lines = launcherSummary({ recoil: 15.003, cycle: 0.2417 }, { recoil: 14.86, cycle: 0.1708 });
  expect(lines).toEqual(["Recuo A 15 · B 14,86 mm", "Ciclo A 0,24 · B 0,17 s"]);
  for (const line of lines) expect(line.length).toBeLessThanOrEqual(30);
  expect(launcherSummary({ recoil: 15, cycle: 0.24 }, { recoil: 0.05, cycle: null })[1]).toBe(
    "Ciclo A 0,24 · B — s",
  );
});
