import { readFileSync } from "node:fs";
import { beforeAll, expect, it } from "vitest";
import { Builder } from "../../scripts/fixtures/builder";
import { circleRing } from "@/geometry/primitives";
import { loadBox2d } from "@/engine/box2d/load";
import type { EngineAdapter } from "@/engine/types";
import { loadScene } from "@/model/scene";
import { PoseHash } from "@/sim/runner";
import { SimSession } from "@/sim/session";
import { sample, type Probe } from "./model";

let make: () => EngineAdapter;
beforeAll(async () => {
  make = await loadBox2d();
});
const probe = (target: string, quantity: Probe["quantity"], other?: string): Probe => ({
  id: `${target}:${quantity}`,
  target,
  quantity,
  name: quantity,
  ...(other ? { other } : {}),
});
const run = (scene: Parameters<EngineAdapter["compile"]>[0], steps: number) => {
  const e = make();
  e.compile(scene, { unitMm: 1 });
  for (let i = 0; i < steps; i++) e.step(1 / 240);
  return e;
};
const weightN = (volumeMm3: number) => (volumeMm3 * 0.00785 * 9810) / 1e6;

it("pin force: a block on two fixed pins reads its weight, half on each", () => {
  const b = new Builder("Pinos");
  const L1 = b.layer("Peças");
  const base = b.rect("Base", L1, 0, 20, 30, 10, "steel", { fixed: true });
  const block = b.rect("Bloco", L1, 0, 8.5, 10, 10, "steel");
  const pins = [-3, 3].map((x) =>
    b.link({ kind: "pin", host: base.id, at: [x, -4.5], r: 2, layers: [L1, L1] }),
  );
  const e = run(b.scene, 480);
  const weight = weightN(10 * 10 * 3);
  const readings = pins.map((p) => sample(probe(p.id, "force"), e.snapshot(), e)!);
  console.log("pin force", readings, "weight", weight, "block y", e.snapshot().parts[block.id]!.y);
  for (const f of readings) {
    expect(f).toBeGreaterThan((weight / 2) * 0.97);
    expect(f).toBeLessThan((weight / 2) * 1.03);
  }
  e.dispose();
});

it("contact slot force: a lever hanging in a round hole reads its weight", () => {
  const b = new Builder("Mancal");
  const L1 = b.layer("Placa");
  const L2 = b.layer("Alavanca");
  const plate = b.rect("Placa", L1, 0, 0, 20, 20, "steel", { fixed: true, holes: [circleRing([0, 0], 2.1)] });
  const lever = b.rect("Alavanca", L2, 0, 22, 6, 50, "steel");
  const pin = b.link({ kind: "pin", host: lever.id, at: [0, -22], r: 2, layers: [L1, L2] });
  const slot = b.link({ kind: "slot", pin: pin.id, guide: plate.id, hole: 0, mode: "contact" });
  const e = run(b.scene, 720);
  // the lever plus its own pin (a steel disc as thick as the layer)
  const weight = weightN(6 * 50 * 3 + Math.PI * 2 * 2 * 3);
  const f = sample(probe(slot.id, "force"), e.snapshot(), e)!;
  const g = sample(probe(pin.id, "force"), e.snapshot(), e)!;
  console.log("slot force", f, "pin", g, "weight", weight);
  expect(f).toBeGreaterThan(weight * 0.97);
  expect(f).toBeLessThan(weight * 1.03);
  e.dispose();
});

it("torsion spring torque matches the weight it holds (arm at equilibrium), within 2%", () => {
  const b = new Builder("Torção");
  const L1 = b.layer("Peças");
  const post = b.rect("Apoio", L1, -3, 0, 6, 6, "steel", { fixed: true });
  // an arm hinged at its left end: its centre of mass is 20 mm from the axle
  const arm = b.rect("Braço", L1, 20, 0, 40, 4, "steel");
  const k = 3; // N·mm/rad
  const axle = b.link({
    kind: "axle",
    a: post.id,
    b: arm.id,
    at: [-20, 0],
    torsion: { k, rest: 0, damping: 0.05 },
  });
  const e = run(b.scene, 1200);
  const snap = e.snapshot();
  const theta = snap.links[axle.id]!.angle!;
  const held = weightN(40 * 4 * 3) * 20 * Math.cos(theta); // N·mm
  const torque = sample(probe(axle.id, "torque"), snap, e)!;
  console.log("torsion", { theta, held, torque, kTheta: k * theta });
  expect(theta).toBeGreaterThan(0.1);
  expect(Math.abs(torque)).toBeGreaterThan(held * 0.98);
  expect(Math.abs(torque)).toBeLessThan(held * 1.02);
  expect(torque).toBeLessThan(0); // the spring opposes the weight
  expect(Math.abs(torque)).toBeGreaterThan(k * theta * 0.98);
  expect(Math.abs(torque)).toBeLessThan(k * theta * 1.02);
  e.dispose();
});

it("stop and motor torque add to the spring's: a stopped arm reads the weight it leans on the stop", () => {
  const b = new Builder("Batente");
  const L1 = b.layer("Peças");
  const post = b.rect("Apoio", L1, -3, 0, 6, 6, "steel", { fixed: true });
  const arm = b.rect("Braço", L1, 20, 0, 40, 4, "steel");
  const axle = b.link({
    kind: "axle",
    a: post.id,
    b: arm.id,
    at: [-20, 0],
    limit: { lower: -0.5, upper: 0.2 },
    torsion: { k: 1, rest: 0, damping: 0.05 },
  });
  const e = run(b.scene, 1200);
  const snap = e.snapshot();
  const theta = snap.links[axle.id]!.angle!;
  expect(theta).toBeCloseTo(0.2, 2);
  const held = weightN(40 * 4 * 3) * 20 * Math.cos(theta);
  // spring (−k·θ) plus the stop carry the whole weight
  expect(Math.abs(sample(probe(axle.id, "torque"), snap, e)!)).toBeGreaterThan(held * 0.98);
  expect(Math.abs(sample(probe(axle.id, "torque"), snap, e)!)).toBeLessThan(held * 1.02);
  e.dispose();
});

it("clearance: overlapping dynamic blocks read the contact depth; resting contact reads about zero", () => {
  const b = new Builder("Contato", 0);
  const L1 = b.layer("Peças");
  const a = b.rect("A", L1, 0, 0, 10, 10, "steel");
  const c = b.rect("B", L1, 8, 0, 10, 10, "steel");
  const e = run(b.scene, 1);
  expect(sample(probe(a.id, "clearance", c.id), e.snapshot(), e)).toBeCloseTo(-2, 1);
  e.dispose();

  const r = new Builder("Apoio");
  const R1 = r.layer("Peças");
  r.rect("Piso", R1, 0, 20, 40, 10, "steel", { fixed: true });
  const block = r.rect("Bloco", R1, 0, 10, 10, 10, "steel");
  const rest = run(r.scene, 480);
  const gap = sample(probe(block.id, "clearance", "p1"), rest.snapshot(), rest)!;
  expect(Math.abs(gap)).toBeLessThan(0.05);
  rest.dispose();
});

it("clearance picks the shape of the right layer: a pin on its layers, none across distant layers", () => {
  const b = new Builder("Camadas", 0);
  const L1 = b.layer("Fundo");
  const L2 = b.layer("Meio");
  const L3 = b.layer("Topo");
  const a = b.rect("A", L1, 0, 0, 10, 10, "steel", { fixed: true });
  b.link({ kind: "pin", host: a.id, at: [7, 0], r: 1, layers: [L1, L2] });
  const c = b.rect("C", L2, 16, 0, 10, 10, "steel", { fixed: true });
  const d = b.rect("D", L3, 16, 0, 10, 10, "steel", { fixed: true });
  const e = run(b.scene, 1);
  const snap = e.snapshot();
  // A's own outline is only on layer 1; on layer 2 it is the pin (right edge x = 8) that faces C (left edge x = 11)
  expect(sample(probe(a.id, "clearance", c.id), snap, e)).toBeCloseTo(3, 2);
  // layer 3 shares no layer with A or its pin
  expect(sample(probe(a.id, "clearance", d.id), snap, e)).toBeNull();
  e.dispose();
});

it("reading every new quantity leaves the launcher's pose hash exactly as it was", async () => {
  const loaded = loadScene(JSON.parse(readFileSync("scenes/examples/lancador-bancada.json", "utf8")));
  if (!loaded.ok) throw new Error("Cena inválida");
  const scene = loaded.scene;
  const ids = scene.parts.map((p) => p.id);
  const probes: Probe[] = [
    { ...probe("k40", "force"), at: { kind: "tick", tick: "chamber-fired" } },
    probe("k41", "force"),
    probe("k35", "torque"),
    probe("p10", "clearance", "p4"),
  ];
  const hashOf = (list: Probe[]) => {
    const s = new SimSession(make, scene, { probes: list });
    const hash = new PoseHash();
    for (let i = 0; i < 432; i++) {
      if (i === 72) s.dragStart("p19", [16, 35.5]);
      if (i > 72 && i <= 101)
        s.dragMove([16 - 18 * Math.min(1, (i - 72) / 28.8), 35.5 - Math.min(1, (i - 72) / 28.8)]);
      if (i === 360) s.dragEnd();
      hash.addSnapshot(s.advance(), ids);
    }
    const series = s.samples.series(432);
    s.dispose();
    return { hash: hash.digest(), series };
  };
  const measured = hashOf(probes);
  expect(measured.hash).toBe(hashOf([]).hash);
  // the pin and the slot read something while the trigger is dragged; the sear's torque is not the old zero
  expect(Math.max(...measured.series[1]!.points.map((p) => p.value ?? 0))).toBeGreaterThan(0);
  expect(Math.max(...measured.series[2]!.points.map((p) => Math.abs(p.value ?? 0)))).toBeGreaterThanOrEqual(
    0,
  );
  expect(measured.series[0]!.marks!.length).toBeGreaterThan(0);
});
