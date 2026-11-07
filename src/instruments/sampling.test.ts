import { beforeAll, expect, it } from "vitest";
import { Builder } from "../../scripts/fixtures/builder";
import { loadBox2d } from "@/engine/box2d/load";
import type { EngineAdapter } from "@/engine/types";
import { SimSession } from "@/sim/session";
import { PoseHash } from "@/sim/runner";
import { sample, type Probe } from "./model";
import { Samples } from "./sampling";
let make: () => EngineAdapter;
beforeAll(async () => {
  make = await loadBox2d();
});
const probe = (target: string, quantity: Probe["quantity"], other?: string): Probe => ({
  id: quantity,
  target,
  quantity,
  name: quantity,
  ...(other ? { other } : {}),
});
it("free fall reads g·t within 1% and probes preserve the pose hash", () => {
  const b = new Builder("Queda");
  const layer = b.layer("Peças");
  const p = b.rect("Bloco", layer, 0, 0, 10, 10, "steel");
  const ps = [probe(p.id, "speed"), probe(p.id, "x"), probe(p.id, "angular")];
  const run = (probes: Probe[]) => {
    const session = new SimSession(make, b.scene, { probes });
    const hash = new PoseHash();
    for (let i = 0; i < 120; i++) hash.addSnapshot(session.advance(), [p.id]);
    const series = session.samples.series(120);
    session.dispose();
    return { hash: hash.digest(), series };
  };
  const measured = run(ps);
  expect(measured.hash).toBe(run([]).hash);
  expect(measured.series[0]!.cursor!.value).toBeCloseTo(9810 * 0.5, 0);
});
it("resting spring reads weight within 2% and its actual length", () => {
  const b = new Builder("Mola");
  const layer = b.layer("Peças");
  const weight = (10 * 10 * 3 * 0.00785 * 9810) / 1e6;
  const p = b.rect("Peso", layer, 0, 40 + weight / 0.02, 10, 10, "steel");
  const spring = b.link({
    kind: "spring",
    a: null,
    b: p.id,
    atA: [0, 0],
    atB: [0, 0],
    k: 0.02,
    damping: 0.001,
    freeLength: 40,
    mode: "tension",
    solidLength: 1,
    coil: { outerD: 8, wireD: 0.8, turns: 10 },
  });
  const e = make();
  e.compile(b.scene, { unitMm: 1 });
  for (let i = 0; i < 240; i++) e.step(1 / 240);
  const force = Math.abs(sample(probe(spring.id, "force"), e.snapshot(), e)!);
  expect(force).toBeGreaterThan(weight * 0.98);
  expect(force).toBeLessThan(weight * 1.02);
  expect(sample(probe(spring.id, "length"), e.snapshot(), e)).toBeCloseTo(40 + weight / 0.02, 1);
  e.dispose();
});
it("Box2D shape distance reads the drawn block gap within 0.01 mm", () => {
  const b = new Builder("Folga", 0);
  const layer = b.layer("Peças");
  const a = b.rect("A", layer, 0, 0, 10, 10, "steel", { fixed: true });
  const c = b.rect("B", layer, 13, 0, 10, 10, "steel", { fixed: true });
  const e = make();
  e.compile(b.scene, { unitMm: 1 });
  expect(sample(probe(a.id, "clearance", c.id), e.snapshot(), e)).toBeCloseTo(3, 2);
  e.dispose();
});
it("reduction keeps extrema, exact cursor and truncates the abandoned future", () => {
  const samples = new Samples();
  samples.configure([probe("p", "x")]);
  for (let i = 0; i < 1000; i++)
    samples.record(
      i,
      {
        time: i / 240,
        steps: i,
        parts: { p: { x: i === 451 ? 99 : i === 452 ? -12 : 0, y: 0, angle: 0 } },
        links: {},
        events: [],
      },
      {} as EngineAdapter,
    );
  const series = samples.series(451, 10)[0]!;
  expect(series.points.some((p) => p.value === 99)).toBe(true);
  expect(series.points.some((p) => p.value === -12)).toBe(true);
  expect(series.cursor?.value).toBe(99);
  samples.truncate(450);
  expect(samples.series(451)[0]!.cursor).toBeNull();
});
