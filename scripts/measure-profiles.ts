import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { profilesScene } from "./fixtures/multicamada";
import { separateProfile, mergeProfiles } from "../src/editor/profileCommands";
import { run } from "../src/editor/history";
import { buildPlan } from "../src/engine/plan";
import { loadBox2d } from "../src/engine/box2d/load";
export async function main() {
  const { scene, piece } = profilesScene();
  const separate = separateProfile(scene, piece.id, "L3")!;
  const split = run(scene, separate.command.label, separate.command.recipe)!.scene;
  const merge = mergeProfiles(split, piece.id)!;
  const merged = run(split, merge.label, merge.recipe)!.scene;
  const make = await loadBox2d();
  const results = [];
  for (const [name, s] of [
    ["perfis", scene],
    ["separada", split],
    ["fundida", merged],
  ] as const) {
    const plan = buildPlan(s),
      body = plan.bodies[plan.partRel.get(piece.id)!.body]!;
    const e = make();
    e.compile(s, { unitMm: 1 });
    const frames = [];
    for (let i = 0; i < 240; i++) {
      e.step(1 / 240);
      frames.push(e.snapshot().parts[piece.id]);
    }
    e.dispose();
    results.push({
      name,
      mass: body.mass,
      inertia: body.inertia,
      poseHash: createHash("sha256").update(JSON.stringify(frames)).digest("hex"),
    });
  }
  writeFileSync(
    "docs/decisoes/perfis-editor-e2b.json",
    JSON.stringify({ steps: 240, dt: 1 / 240, part: piece.id, results }, null, 2) + "\n",
  );
  console.log(results);
}
