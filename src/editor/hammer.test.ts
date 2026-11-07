import { describe, it, expect } from "vitest";
import { prepareScene } from "@/render/prepare";
import { loadScene } from "@/model/scene";
import { hammerFix, hammerPoint } from "./hammer";
import { run, undo, redo, push, emptyHistory } from "./history";
import { profileSlotScene, profilesScene } from "../../scripts/fixtures/multicamada";

describe("Hammer fasteners", () => {
  for (const tool of ["screw", "axle", "lock", "pin"] as const) {
    it(`${tool}: a stamp undoes and redoes as one command`, () => {
      const { scene, piece } = profilesScene();
      piece.shape = { kind: "circle", r: 10, holes: [] };
      piece.profiles = [];
      scene.links = [];
      const model = prepareScene(scene);
      const point = hammerPoint(model, tool, [3, 0], 0, 0.1);
      expect(point.b?.part.id).toBe(piece.id);
      if (tool === "screw" || tool === "axle") expect(point.point).toEqual([0, 0]);
      const stamp = hammerFix(model, tool, point)!;
      const result = run(scene, stamp.command.label, stamp.command.recipe)!;
      expect(loadScene(result.scene).ok).toBe(true);
      const history = push(emptyHistory(), result.entry);
      const back = undo(result.scene, history)!;
      expect(back.scene).toEqual(scene);
      expect(redo(back.scene, back.history)!.scene).toEqual(result.scene);
    });
  }
  it("detects a slot on an extra profile and creates a joint with the pin", () => {
    const { scene } = profileSlotScene();
    scene.links = [];
    const model = prepareScene(scene);
    const hit = hammerPoint(model, "pin", [0, 0], 1, 0.01);
    const stamp = hammerFix(model, "pin", hit)!;
    const result = run(scene, stamp.command.label, stamp.command.recipe)!;
    expect(result.scene.links).toHaveLength(2);
    expect(result.scene.links[1]).toMatchObject({ kind: "slot", mode: "joint", profile: "guide-profile" });
    expect(loadScene(result.scene).ok).toBe(true);
  });
});

describe("stamped fasteners in the engine", () => {
  it("a centered axle rotates and a ground screw stays fixed", async () => {
    const { loadBox2d } = await import("@/engine/box2d/load");
    const make = await loadBox2d();
    for (const tool of ["axle", "screw"] as const) {
      const { scene, piece } = profilesScene();
      piece.shape = { kind: "circle", r: 10, holes: [] };
      piece.profiles = [];
      scene.parts = [piece];
      scene.links = [];
      scene.settings.gravity.on = false;
      const model = prepareScene(scene);
      const stamp = hammerFix(model, tool, hammerPoint(model, tool, [3, 0], 0, 0.1))!;
      const next = run(scene, stamp.command.label, stamp.command.recipe)!.scene;
      const engine = make();
      engine.compile(next, { unitMm: 1 });
      engine.setForce(piece.id, [0, 0.05], [10, 0]);
      for (let i = 0; i < 120; i++) engine.step(1 / 240);
      const pose = engine.snapshot().parts[piece.id]!;
      if (tool === "screw") expect([pose.x, pose.y, pose.angle]).toEqual([0, 0, 0]);
      else expect(Math.abs(pose.angle)).toBeGreaterThan(0.1);
      engine.dispose();
    }
  });
  it("an automatically made pin runs in its profile slot", async () => {
    const { loadBox2d } = await import("@/engine/box2d/load");
    const { scene } = profileSlotScene();
    scene.links = [];
    const model = prepareScene(scene);
    const stamp = hammerFix(model, "pin", hammerPoint(model, "pin", [0, 0], 1, 0.01))!;
    const next = run(scene, stamp.command.label, stamp.command.recipe)!.scene;
    const pin = next.links[0]!;
    if (pin.kind !== "pin") throw new Error("Pino ausente");
    const make = await loadBox2d();
    const engine = make();
    engine.compile(next, { unitMm: 1 });
    engine.setForce(pin.host, [0.01, 0]);
    for (let i = 0; i < 120; i++) engine.step(1 / 240);
    const pose = engine.snapshot().parts[pin.host]!;
    expect(pose.x).toBeGreaterThan(15);
    expect(Math.abs(pose.y)).toBeLessThan(0.01);
    engine.dispose();
  });
});
