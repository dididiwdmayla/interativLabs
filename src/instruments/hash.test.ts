import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { loadBox2d } from "@/engine/box2d/load";
import { loadScene } from "@/model/scene";
import { PoseHash } from "@/sim/runner";
import { SimSession } from "@/sim/session";
import { stifferReturnSpring } from "./experiment";
import { instrumentPreset, launcherInputs } from "./presets";
import type { Probe } from "./model";

/** Measuring and comparing never change the simulation: the pose hash is the same bit for bit. */
it("the Lançador's pose hash is identical alone, with probes, and beside a comparison running at the same time", async () => {
  const loaded = loadScene(JSON.parse(readFileSync("scenes/examples/lancador-bancada.json", "utf8")));
  if (!loaded.ok) throw new Error("Cena inválida");
  const scene = loaded.scene;
  const stiffer = stifferReturnSpring(scene);
  if (!stiffer) throw new Error("Sem mola de retorno");
  const variantB = { ...scene, links: scene.links.map((l) => (l.id === stiffer.id ? stiffer : l)) };
  const make = await loadBox2d();
  const ids = scene.parts.map((p) => p.id);
  const inputs = launcherInputs();
  const extra: Probe[] = [
    ...instrumentPreset(scene).slice(0, 3),
    { id: "gap", target: "p10", quantity: "clearance", name: "Folga", other: "p4" },
  ];

  const feed = (s: SimSession, step: number) => {
    for (const i of inputs.filter((x) => x.step === step)) {
      if (i.kind === "start") s.dragStart(i.part, i.p);
      else if (i.kind === "move") s.dragMove(i.p);
      else if (i.kind === "end") s.dragEnd();
    }
  };
  const run = (probes: Probe[], beside: boolean) => {
    const a = new SimSession(make, scene, { probes });
    const b = beside ? new SimSession(make, variantB, { probes }) : null;
    const hash = new PoseHash();
    for (let step = 0; step < 432; step++) {
      feed(a, step);
      if (b) feed(b, step);
      hash.addSnapshot(a.advance(), ids);
      b?.advance();
    }
    a.dispose();
    b?.dispose();
    return hash.digest();
  };

  const alone = run([], false);
  expect(run(extra, false)).toBe(alone);
  expect(run(extra, true)).toBe(alone);
  expect(run(instrumentPreset(scene), true)).toBe(alone);
});
