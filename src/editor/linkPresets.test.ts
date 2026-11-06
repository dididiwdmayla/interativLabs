import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildPlan } from "@/engine/plan";
import type { Link, Scene } from "@/model/types";
import { validateScene } from "@/model/scene";
import { N } from "@/model/units";
import { prepareScene } from "@/render/prepare";
import { effective, frequencyPreset, SPRING_HZ } from "./linkPresets";
import { switchLink } from "./presetActions";
import { linkHandles, adjustLinkHandle } from "./linkHandles";
import { setLink, linksWithReplacement } from "./commands";
import { run, undo, push, emptyHistory } from "./history";
import { lockScene } from "../../scripts/fixtures/multicamada";

it("two masses get the same linear and angular frequency", () => {
  for (const scale of [1, 10]) {
    const { scene, weight } = lockScene();
    scene.links = [];
    scene.layers[1]!.thickness *= scale;
    const plan = buildPlan(scene),
      body = plan.bodies[plan.partRel.get(weight.id)!.body]!;
    for (const angular of [false, true])
      for (const hz of Object.values(SPRING_HZ)) {
        const mass = effective(scene, null, weight.id, angular, [weight.x, weight.y]);
        expect(mass).toBeCloseTo(angular ? body.inertia : body.mass, 8);
        const p = frequencyPreset(mass, hz);
        expect(Math.sqrt((p.k * N) / mass) / (2 * Math.PI)).toBeCloseTo(hz, 10);
        expect((p.damping * N) / (2 * Math.sqrt(p.k * N * mass))).toBeCloseTo(0.1, 10);
      }
  }
});

describe("link type switches", () => {
  for (const types of [
    ["screw", "mount", "lock"],
    ["rod", "cable", "spring"],
  ] as const)
    for (const from of types)
      for (const to of types)
        it(`${from} → ${to} preserves the anchors`, () => {
          const { scene, weight } = lockScene();
          scene.links = [];
          const base: Link =
            types[0] === "screw"
              ? { kind: "screw", id: "edited", ref: 80, a: null, b: weight.id, at: [1, 2] }
              : { kind: "rod", id: "edited", ref: 80, a: null, b: weight.id, atA: [-25, 3], atB: [1, 2] };
          const source = switchLink(scene, base, from)!;
          scene.links = [source];
          const next = switchLink(scene, source, to)!;
          expect(next).toMatchObject({ id: source.id, ref: source.ref, a: base.a, b: base.b });
          if ("at" in source) expect(next).toMatchObject({ at: source.at });
          else if ("atA" in source) expect(next).toMatchObject({ atA: source.atA, atB: source.atB });
          expect(validateScene({ ...scene, links: [next] }).ok).toBe(true);
        });
});

it("each stage handle changes its own field and undoes", () => {
  const { scene, weight } = lockScene();
  const links: Link[] = [
    {
      kind: "axle",
      id: "axle",
      ref: 80,
      a: null,
      b: weight.id,
      at: [0, 0],
      limit: { lower: -Math.PI / 4, upper: Math.PI / 4 },
    },
    { kind: "slider", id: "slider", ref: 81, a: null, b: weight.id, at: [0, 0], dir: 0, travel: [0, 20] },
    {
      kind: "spring",
      id: "spring",
      ref: 82,
      a: null,
      b: weight.id,
      atA: [-40, 0],
      atB: [0, 0],
      mode: "fixed",
      freeLength: 25,
      k: 0.1,
      damping: 0.001,
      coil: { outerD: 4, wireD: 0.3, turns: 10 },
    },
    {
      kind: "sensor",
      id: "sensor",
      ref: 83,
      host: weight.id,
      at: [0, 0],
      r: 2,
      layers: [weight.layer, weight.layer],
      minSpeed: 0,
      actions: [],
    },
  ];
  for (const link of links) {
    scene.links = [link];
    const model = prepareScene(scene);
    for (const handle of linkHandles(model, link, 0.1)) {
      const point: [number, number] =
        handle.angle === undefined
          ? [handle.point[0] + 3, handle.point[1]]
          : [handle.origin[0] + Math.cos(Math.PI / 6) * 5, handle.origin[1] + Math.sin(Math.PI / 6) * 5];
      const next = adjustLinkHandle(model, link, handle, point);
      expect(next).not.toEqual(link);
      const cmd = setLink(scene, link.id, next)!,
        result = run(scene, cmd.label, cmd.recipe)!;
      expect(cmd.notice).toBeUndefined();
      expect(undo(result.scene, push(emptyHistory(), result.entry))!.scene).toEqual(scene);
      if (next.kind === "axle")
        expect(next.limit![handle.field as "lower" | "upper"] / (Math.PI / 36)).toBeCloseTo(
          Math.round(next.limit![handle.field as "lower" | "upper"] / (Math.PI / 36)),
          8,
        );
    }
  }
});

it("presets can be applied to a loaded multilayer scene", () => {
  const s = JSON.parse(readFileSync("scenes/fixtures/multicamada/perfis.scene.json", "utf8")) as Scene;
  const id = s.parts[0]!.id;
  expect(effective(s, null, id)).toBeGreaterThan(0);
});

it("converting a sensor-controlled lock removes its release action in the same undo", () => {
  const { scene, lock, sensor } = lockScene();
  const target = scene.links.find((l) => l.id === sensor.id);
  if (target?.kind !== "sensor") throw new Error("Sensor ausente");
  target.actions.push({ do: "release", target: lock.id });
  const next = switchLink(scene, lock, "screw")!;
  expect(validateScene({ ...scene, links: linksWithReplacement(scene, next) }).ok).toBe(true);
  const command = setLink(scene, lock.id, next)!;
  expect(command.notice).toMatch(/ações de soltar/);
  const result = run(scene, command.label, command.recipe)!;
  expect(result.scene.links.find((l) => l.id === sensor.id)).toMatchObject({ actions: [] });
  expect(undo(result.scene, push(emptyHistory(), result.entry))!.scene).toEqual(scene);
});
