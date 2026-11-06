import { beforeAll, describe, expect, it } from "vitest";
import { lockScene, profilesScene, profileSlotScene } from "../../scripts/fixtures/multicamada";
import { loadBox2d } from "./box2d/load";
import { buildPlan } from "./plan";
import type { EngineAdapter } from "./types";
import { FIXED_STEP } from "./common";
import { SimSession } from "@/sim/session";
import { PoseHash } from "@/sim/runner";

let make: () => EngineAdapter;
beforeAll(async () => {
  make = await loadBox2d();
});

describe("multilayer bodies", () => {
  it("sums material/thickness mass and parallel-axis inertia in one body", () => {
    const { scene, piece } = profilesScene();
    const plan = buildPlan(scene);
    const body = plan.bodies[plan.partRel.get(piece.id)!.body]!;
    const a = 16 * 3 * 0.00785,
      b = 16 * 5 * 0.0085;
    const cx = (-8 * a + 8 * b) / (a + b);
    const inertia = a * (32 / 12 + (-8 - cx) ** 2) + b * (32 / 12 + (8 - cx) ** 2);
    expect(body.parts).toEqual([piece.id]);
    expect(body.mass).toBeCloseTo(a + b, 10);
    expect(body.inertia).toBeCloseTo(inertia, 10);
    expect(new Set(body.fixtures.map((f) => f.bits))).toEqual(new Set([1, 4]));
    expect(body.fixtures.every((f) => (f.bits & 2) === 0)).toBe(true);
  });

  it("screw union retains the mass, inertia and filters of extra profiles", () => {
    const { scene, piece } = profilesScene();
    const before = buildPlan(scene);
    const original = before.bodies[before.partRel.get(piece.id)!.body]!;
    const profile = piece.profiles!.pop()!;
    const second = {
      ...piece,
      id: "separate",
      ref: 99,
      layer: profile.layer,
      shape: profile.shape,
      material: profile.material!,
      profiles: undefined,
    };
    scene.parts.push(second);
    scene.links.push({ kind: "screw", id: "screw", ref: 100, a: piece.id, b: second.id, at: [0, 0] });
    const after = buildPlan(scene);
    const united = after.bodies[after.partRel.get(piece.id)!.body]!;
    expect(united.mass).toBe(original.mass);
    expect(united.inertia).toBe(original.inertia);
    expect(united.fixtures.map((f) => f.bits)).toEqual(original.fixtures.map((f) => f.bits));
  });

  it("compiles the explicitly selected slot profile", () => {
    const { scene, slot } = profileSlotScene();
    expect(buildPlan(scene).slots.find((s) => s.id === slot.id)?.upper).toBeCloseTo(20.1, 3);
  });
});

describe("lock lifecycle", () => {
  it("releases at the step boundary, records the touch, rewinds identically and resets", () => {
    const { scene, lock } = lockScene();
    const session = new SimSession(make, scene);
    const hash = () => {
      const h = new PoseHash();
      h.addSnapshot(
        session.snapshot(),
        scene.parts.map((p) => p.id),
      );
      return h.digest();
    };
    for (let i = 0; i < 24; i++) session.advance();
    session.release(lock.id);
    expect(session.snapshot().links[lock.id]!.released).toBe(false);
    session.advance();
    expect(session.snapshot().links[lock.id]!.released).toBe(true);
    expect(session.recordedInputs()).toEqual([{ step: 24, kind: "release", link: lock.id }]);
    expect(session.frame(24)?.lock?.(lock.id)).toBe(false);
    expect(session.frame(25)?.lock?.(lock.id)).toBe(true);
    while (session.step < 48) session.advance();
    const h48 = hash();
    while (session.step < 60) session.advance();
    const rewind = session.rewind(48);
    while (!rewind.advance(1000)) {
      /* replay */
    }
    expect(hash()).toBe(h48);
    expect(session.snapshot().links[lock.id]!.released).toBe(true);
    session.restart();
    expect(session.frame(0)?.lock?.(lock.id)).toBe(false);
    expect(session.snapshot().links[lock.id]!.released).toBe(false);
    session.dispose();
  });

  it("sensor and lock release occur in the same step", () => {
    const { scene, lock, sensor } = lockScene();
    const sensorLink = scene.links.find((l) => l.id === sensor.id);
    if (sensorLink?.kind === "sensor") sensorLink.actions = [{ do: "release", target: lock.id }];
    const a = make();
    a.compile(scene, { unitMm: 1 });
    let touched = false;
    for (let i = 0; i < 50; i++) {
      a.step(FIXED_STEP);
      const s = a.snapshot();
      const e = s.events.find((e) => e.kind === "sensor");
      if (!e) continue;
      touched = true;
      expect(s.events.find((e) => e.kind === "lock-released")?.time).toBe(e.time);
      expect(s.links[lock.id]!.releasedAt).toBe(e.time);
      break;
    }
    expect(touched).toBe(true);
    a.dispose();
  });
});
