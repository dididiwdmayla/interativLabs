import { describe, expect, it } from "vitest";
import { prepareScene } from "@/render/prepare";
import { loadScene } from "@/model/scene";
import type { Scene } from "@/model/types";
import { hammerPoint } from "./hammer";
import { dragLink, insertLink, sensorLink } from "./hammerDrag";
import { moveLink } from "./moveLink";
import { run, push, undo, redo, emptyHistory } from "./history";
import { profilesScene, lockScene } from "../../scripts/fixtures/multicamada";

function twoParts() {
  const { scene, piece } = profilesScene();
  piece.shape = { kind: "circle", r: 2, holes: [] };
  piece.profiles = [];
  scene.parts = [piece, { ...structuredClone(piece), id: "second", ref: 90, x: 20 }];
  scene.links = [];
  scene.settings.gravity.on = false;
  scene.settings.snap.on = false;
  return scene;
}
function drawing(scene: Scene, tool: "spring" | "rod" | "cable" | "slider") {
  const model = prepareScene(scene);
  return dragLink(
    model,
    tool,
    hammerPoint(model, tool, [0, 0], 0, 0.01),
    hammerPoint(model, tool, [20, 0], 0, 0.01),
    0,
  )!;
}

describe("dragged links", () => {
  for (const tool of ["spring", "rod", "cable", "slider"] as const)
    it(`${tool} preserves geometry through undo and redo`, () => {
      const scene = twoParts();
      const { link } = drawing(scene, tool);
      const cmd = insertLink(link),
        result = run(scene, cmd.label, cmd.recipe)!;
      expect(loadScene(result.scene).ok).toBe(true);
      if (link.kind === "spring") expect(link.freeLength).toBe(20);
      if (link.kind === "cable") expect(link.maxLength).toBe(20);
      if (link.kind === "slider") expect(link.travel).toEqual([0, 20]);
      const back = undo(result.scene, push(emptyHistory(), result.entry))!;
      expect(back.scene).toEqual(scene);
      expect(redo(back.scene, back.history)!.scene).toEqual(result.scene);
    });
  it("a spring oscillates around the drawn free length", async () => {
    const scene = twoParts();
    const { link } = drawing(scene, "spring");
    scene.links.push(link);
    scene.parts[1]!.x += 2;
    const { loadBox2d } = await import("@/engine/box2d/load");
    const make = await loadBox2d();
    const engine = make();
    engine.compile(scene, { unitMm: 1 });
    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < 120; i++) {
      engine.step(1 / 240);
      const p = engine.snapshot().parts;
      const d = Math.hypot(p.second!.x - p[scene.parts[0]!.id]!.x, p.second!.y - p[scene.parts[0]!.id]!.y);
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
    expect(min).toBeLessThan(19);
    expect(max).toBeGreaterThan(21);
    engine.dispose();
  });
  it("moving hardware preserves both connected parts and is undoable", () => {
    const scene = twoParts();
    const { link } = drawing(scene, "spring");
    scene.links.push(link);
    const cmd = moveLink(prepareScene(scene), link.id, [10, 8])!;
    const result = run(scene, cmd.label, cmd.recipe)!;
    expect(result.scene.links[0]).toMatchObject({ a: scene.parts[0]!.id, b: "second" });
    expect(cmd.warning).toContain("saiu da peça");
    expect(undo(result.scene, push(emptyHistory(), result.entry))!.scene).toEqual(scene);
  });
  it("a sensor action releases the chosen lock in the engine", async () => {
    const { scene, sensor, lock } = lockScene();
    scene.links = scene.links.filter((l) => l.id !== sensor.id);
    const model = prepareScene(scene);
    const host = model.parts.get(sensor.host)!;
    const hit = { point: [15, 0] as [number, number], b: host, a: null, guides: [], phrase: "" };
    const link = sensorLink(model, hit, [{ do: "release", target: lock.id }], 1)!;
    scene.links.push(link);
    expect(loadScene(scene).ok).toBe(true);
    const { loadBox2d } = await import("@/engine/box2d/load");
    const make = await loadBox2d();
    const engine = make();
    engine.compile(scene, { unitMm: 1 });
    for (let i = 0; i < 100; i++) engine.step(1 / 240);
    expect(engine.snapshot().links[lock.id]!.released).toBe(true);
    engine.dispose();
  });
});
