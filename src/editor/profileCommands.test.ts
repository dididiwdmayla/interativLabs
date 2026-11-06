import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { validateScene } from "@/model/scene";
import type { Scene } from "@/model/types";
import { buildPlan } from "@/engine/plan";
import { buildInsertion } from "@/parts/insert";
import { buildPart, regenerate } from "@/parts";
import { profilesScene, profileSlotScene } from "../../scripts/fixtures/multicamada";
import { run, undo, redo, emptyHistory, push } from "./history";
import {
  deleteLayer,
  duplicatePart,
  partLayerReason,
  scalePart,
  setPartLayer,
  type Command,
} from "./commands";
import {
  extendProfile,
  removeProfile,
  separateProfile,
  mergeProfiles,
  mergeCandidates,
} from "./profileCommands";
const hash = (s: unknown) => createHash("sha256").update(JSON.stringify(s)).digest("hex");
function apply(scene: Scene, c: Command | null): Scene {
  expect(c).not.toBeNull();
  const result = run(scene, c!.label, c!.recipe)!;
  const valid = validateScene(result.scene);
  expect(valid.ok, JSON.stringify(valid)).toBe(true);
  const back = undo(result.scene, push(emptyHistory(), result.entry))!;
  expect(hash(back.scene)).toBe(hash(scene));
  expect(hash(redo(back.scene, back.history)!.scene)).toBe(hash(result.scene));
  return result.scene;
}
for (const form of ["copy", "disc", "gear", "ratchet", "cam", "lever"] as const)
  it(`extends ${form} into existing/new layers as one undo`, () => {
    for (const target of ["L2", "above", "below"]) {
      const { scene, piece } = profilesScene();
      const r = extendProfile(scene, piece.id, piece.layer, target, form)!;
      const next = apply(scene, r.command);
      expect(next.parts[0]!.profiles).toHaveLength(2);
      expect(next.layers).toHaveLength(target === "L2" ? 3 : 4);
    }
  });
it("edits only the active profile and duplicates with fresh IDs", () => {
  const { scene, piece } = profilesScene();
  const shape = buildPart(scene, "disc", { x: 0, y: 0, layer: "L3" });
  piece.profiles![0]!.shape = shape.shape;
  piece.profiles![0]!.source = shape.source;
  const next = apply(scene, regenerate(scene, piece.id, { d: 40 }, undefined, "L3"));
  expect(next.parts[0]!.shape).toEqual(piece.shape);
  expect(next.parts[0]!.profiles![0]!.shape).toMatchObject({ r: 20 });
  const scaled = apply(next, scalePart(next, piece.id, 2, 2, "L3"));
  expect(scaled.parts[0]!.profiles![0]!.shape).toMatchObject({ r: 40 });
  const dup = duplicatePart(scaled, piece.id)!;
  const duplicated = apply(scaled, dup.command);
  expect(duplicated.parts.at(-1)!.profiles![0]!.id).not.toBe(piece.profiles![0]!.id);
});
it("moves the complete stack and blocks a profile outside its bounds", () => {
  const { scene, piece } = profilesScene();
  expect(partLayerReason(scene, piece.id, 1)).toMatch(/sairia/);
  expect(setPartLayer(scene, [piece.id], "L2")).toBeNull();
  scene.layers.push({ ...scene.layers[0]!, id: "L4" });
  const next = apply(scene, setPartLayer(scene, [piece.id], "L2"));
  expect(next.parts[0]).toMatchObject({ layer: "L2", profiles: [{ layer: "L4" }] });
});
it("removes/promotes profiles and updates explicit slots when deleting their layer", () => {
  const { scene, slot } = profileSlotScene();
  const promoted = apply(scene, deleteLayer(scene, "L1"));
  expect(promoted.parts[0]!.layer).toBe("L3");
  expect(promoted.links.find((l) => l.id === slot.id)).not.toHaveProperty("profile");
  const removed = apply(scene, removeProfile(scene, scene.parts[0]!.id, "L3"));
  expect(removed.links.some((l) => l.id === slot.id)).toBe(false);
  const layerRemoved = apply(scene, deleteLayer(scene, "L3"));
  expect(layerRemoved.parts[0]!.profiles).toBeUndefined();
});
it("separates a slotted profile without losing its pin constraint", () => {
  const { scene, slot } = profileSlotScene();
  const separated = separateProfile(scene, slot.guide, "L3")!;
  const next = apply(scene, separated.command);
  expect(next.links.find((l) => l.id === slot.id)).toMatchObject({ guide: separated.newId });
  expect(next.links.find((l) => l.id === slot.id)).not.toHaveProperty("profile");
  const merged = apply(next, mergeProfiles(next, slot.guide));
  expect(merged.links.find((l) => l.id === slot.id)).toMatchObject({
    guide: slot.guide,
    profile: merged.parts[0]!.profiles![0]!.id,
  });
});
it("split and merged bodies preserve mass, inertia and the simulated pose hash", async () => {
  const { scene, piece } = profilesScene();
  const separated = separateProfile(scene, piece.id, "L3")!;
  expect(separated.command.warning).toMatch(/centroide/);
  const split = apply(scene, separated.command),
    merged = apply(split, mergeProfiles(split, piece.id));
  const { loadBox2d } = await import("@/engine/box2d/load"),
    make = await loadBox2d();
  const hashes: string[] = [];
  const expected = buildPlan(scene).bodies[1]!;
  for (const s of [scene, split, merged]) {
    const plan = buildPlan(s),
      body = plan.bodies[plan.partRel.get(piece.id)!.body]!;
    expect(body.mass).toBeCloseTo(expected.mass, 10);
    expect(body.inertia).toBeCloseTo(expected.inertia, 8);
    const e = make();
    e.compile(s, { unitMm: 1 });
    const frames = [];
    for (let i = 0; i < 240; i++) {
      e.step(1 / 240);
      frames.push(e.snapshot().parts[piece.id]);
    }
    hashes.push(hash(frames));
    e.dispose();
  }
  expect(new Set(hashes).size).toBe(1);
});
it("merging offsets preserves world anchors and rejects overlapping layers", () => {
  const { scene, piece } = profilesScene();
  delete piece.profiles;
  const other = buildPart(scene, "bar", { x: 8, y: 3, layer: "L3" });
  other.angle = 0.2;
  scene.parts.push(other);
  scene.links = [
    { kind: "screw", id: "s", ref: 90, a: piece.id, b: other.id, at: [0, 0] },
    { kind: "axle", id: "a", ref: 91, a: null, b: other.id, at: [1, 2] },
  ];
  const next = apply(scene, mergeProfiles(scene, piece.id));
  const axle = next.links[0]!;
  expect(axle).toMatchObject({ kind: "axle", b: piece.id });
  if (axle.kind !== "axle") throw new Error("missing axle");
  expect(axle.at[0]).toBeCloseTo(8 + Math.cos(0.2) - 2 * Math.sin(0.2), 8);
  scene.links.push({ kind: "lock", id: "internal", ref: 92, a: piece.id, b: other.id, at: [0, 0] });
  expect(mergeCandidates(scene, piece.id).reason).toMatch(/outras ligações/);
  expect(mergeProfiles(scene, piece.id)).toBeNull();
  other.layer = piece.layer;
  expect(mergeCandidates(scene, piece.id).reason).toMatch(/mesma camada/);
});
for (const kind of ["gear-ratchet", "pinion-crank"])
  it(`${kind} adds its missing layer with undo`, () => {
    const { scene } = profilesScene();
    scene.parts = [];
    scene.layers = scene.layers.slice(0, 1);
    const r = buildInsertion(scene, kind, { layer: "L1", x: 0, y: 0 })!;
    const s = apply(scene, r.command);
    expect(s.layers).toHaveLength(2);
    expect(s.parts[0]!.profiles).toHaveLength(1);
  });
