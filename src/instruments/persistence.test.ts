import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { beforeAll, expect, it } from "vitest";
import { Builder } from "../../scripts/fixtures/builder";
import { loadBox2d } from "@/engine/box2d/load";
import { closeDb, getProject, putProject } from "@/editor/projects";
import { useUiStore } from "@/editor/useUiStore";
import type { EngineAdapter } from "@/engine/types";
import { loadScene } from "@/model/scene";
import { SimSession } from "@/sim/session";
import { blankScene } from "@/ui/projectFlow";
import { formatNumber } from "./format";
import { quantities, sample, type Probe, type Quantity } from "./model";
import { instrumentPreset } from "./presets";

let make: () => EngineAdapter;
beforeAll(async () => {
  make = await loadBox2d();
});

it("probes come back with the project, with their event, limit and threshold, and follow the variants", async () => {
  const scene = blankScene("Sondas");
  const probes: Probe[] = [
    {
      id: "a",
      target: "p1",
      quantity: "velocity",
      name: "Esfera · velocidade",
      at: { kind: "crossing", target: "p1", quantity: "absoluteX", threshold: 50 },
      atLabel: "na saída",
    },
    { id: "b", target: "k1", quantity: "force", name: "Retém · força", limit: 0.8, threshold: 0.2 },
    { id: "c", target: "p1", quantity: "clearance", name: "Folga", other: "p2" },
  ];
  useUiStore.getState().openScene("probes", scene, 1);
  useUiStore.getState().setProbes(probes);
  useUiStore.getState().createVariant();
  expect(useUiStore.getState().probes).toEqual(probes);
  useUiStore.getState().switchVariant("A");
  expect(useUiStore.getState().probes).toEqual(probes);

  const s = useUiStore.getState();
  expect(
    await putProject({
      id: "probes",
      name: "Sondas",
      scene,
      variants: s.variantSnapshot(),
      activeVariant: "B",
      thumb: "",
      createdAt: "",
      updatedAt: "",
      view: { hidden: [], probes: s.probes },
    }),
  ).toBe(true);
  await closeDb();
  const p = (await getProject("probes"))!;
  useUiStore.getState().openScene("other", blankScene("Outro"), 1);
  expect(useUiStore.getState().probes).toEqual([]);
  useUiStore.getState().openScene(p.id, p.scene, 1, undefined, p.view, p.variants, p.activeVariant);
  expect(useUiStore.getState().probes).toEqual(probes);
});

it("restarting keeps the probes and measures the same run again, to the last bit", async () => {
  const loaded = loadScene(JSON.parse(readFileSync("scenes/examples/lancador-bancada.json", "utf8")));
  if (!loaded.ok) throw new Error("Cena inválida");
  const probes = instrumentPreset(loaded.scene);
  const session = new SimSession(make, loaded.scene, { probes });
  const play = () => {
    for (let i = 0; i < 300; i++) {
      if (i === 72) session.dragStart("p19", [16, 35.5]);
      if (i > 72 && i <= 101)
        session.dragMove([16 - 18 * Math.min(1, (i - 72) / 28.8), 35.5 - Math.min(1, (i - 72) / 28.8)]);
      session.advance();
    }
    return JSON.stringify(session.samples.series(session.step, 301));
  };
  const first = play();
  session.restart();
  expect(session.samples.probes).toEqual(probes);
  expect(session.samples.series(0)[0]!.points).toHaveLength(1);
  expect(play()).toBe(first);
  session.dispose();
});

it("a probe on something that was deleted reads a dash, whatever the quantity", () => {
  const b = new Builder("Sem alvo");
  const layer = b.layer("Peças");
  b.rect("Restante", layer, 0, 0, 10, 10, "steel");
  const e = make();
  e.compile(b.scene, { unitMm: 1 });
  e.step(1 / 240);
  const snapshot = e.snapshot();
  for (const quantity of Object.keys(quantities) as Quantity[]) {
    const probe: Probe = {
      id: quantity,
      target: "apagada",
      quantity,
      name: quantity,
      other: "tambem-apagada",
    };
    const value = sample(probe, snapshot, e);
    expect(value, quantity).toBeNull();
    expect(formatNumber(value)).toBe("—");
  }
  // and the sampler records the gap instead of failing
  const session = new SimSession(make, b.scene, {
    probes: [{ id: "x", target: "apagada", quantity: "x", name: "x" }],
  });
  session.advance();
  expect(session.samples.series(1)[0]!.cursor?.value).toBeNull();
  session.dispose();
  e.dispose();
});
