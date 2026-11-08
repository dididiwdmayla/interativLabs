import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { loadBox2d } from "@/engine/box2d/load";
import { parseSceneJson } from "@/model/scene";
import { instrumentPreset } from "@/instruments/presets";
import { replay } from "./comparison";
import type { SimInput } from "./session";
it("variantes iguais têm curvas idênticas e diferença zero em cada sonda", async () => {
  const parsed = parseSceneJson(readFileSync("scenes/examples/lancador-bancada.json", "utf8"));
  if (!parsed.ok) throw new Error("Cena inválida");
  const make = await loadBox2d();
  const inputs: SimInput[] = [{ step: 72, kind: "start", part: "p19", p: [16, 35.5] }];
  for (let i = 73; i <= 101; i++)
    inputs.push({
      step: i,
      kind: "move",
      p: [16 - 18 * Math.min(1, (i - 72) / 28.8), 35.5 - Math.min(1, (i - 72) / 28.8)],
    });
  inputs.push({ step: 360, kind: "end" });
  const probes = instrumentPreset(parsed.scene);
  const a = replay(make, parsed.scene, inputs, 432, probes);
  const b = replay(make, structuredClone(parsed.scene), inputs, 432, probes);
  const sa = a.samples.series(432, 433),
    sb = b.samples.series(432, 433);
  expect(sb).toEqual(sa);
  for (let i = 0; i < sa.length; i++)
    for (let j = 0; j < sa[i]!.points.length; j++) {
      const av = sa[i]!.points[j]!.value,
        bv = sb[i]!.points[j]!.value;
      if (av !== null && bv !== null) expect(bv - av).toBe(0);
    }
  expect(b.events).toEqual(a.events);
  a.dispose();
  b.dispose();
});
it("pula gestos e toques sem alvo correspondente", async () => {
  const parsed = parseSceneJson(readFileSync("scenes/examples/engrenagens.json", "utf8"));
  if (!parsed.ok) throw new Error("Cena inválida");
  const make = await loadBox2d();
  const inputs: SimInput[] = [
    { step: 0, kind: "start", part: "missing", p: [0, 0] },
    { step: 1, kind: "move", p: [100, 100] },
    { step: 2, kind: "end" },
    { step: 3, kind: "release", link: "missing" },
  ];
  const a = replay(make, parsed.scene, [], 24, []);
  const b = replay(make, parsed.scene, inputs, 24, []);
  expect(b.snapshot().parts).toEqual(a.snapshot().parts);
  expect(b.inputLog).toEqual([]);
  a.dispose();
  b.dispose();
});
