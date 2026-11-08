import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadBox2d } from "@/engine/box2d/load";
import { slotRing } from "@/geometry/primitives";
import { runFixture } from "@/sim/runner";
import type { FixtureScript } from "@/sim/script";
import { parseScene, serializeScene, validateScene } from "./scene";
import type { Scene } from "./types";

function base(): Scene {
  return {
    version: 4,
    meta: { title: "Perfis e trava", createdAt: "", updatedAt: "" },
    settings: { gravity: { on: true, g: 9810 }, snap: { on: true, grid: 1 } },
    layers: ["L1", "L2", "L3"].map((id) => ({ id, name: id, visible: true, locked: false, thickness: 3 })),
    parts: [
      {
        id: "guide",
        ref: 1,
        name: "Guia",
        layer: "L1",
        x: 0,
        y: 0,
        angle: 0,
        fixed: true,
        fast: false,
        material: "steel",
        shape: { kind: "circle", r: 20, holes: [] },
        profiles: [
          {
            id: "profile",
            layer: "L3",
            shape: { kind: "circle", r: 20, holes: [slotRing([-5, 0], [5, 0], 4)] },
          },
        ],
      },
      {
        id: "weight",
        ref: 2,
        name: "Peso",
        layer: "L2",
        x: 0,
        y: 0,
        angle: 0,
        fixed: false,
        fast: false,
        material: "steel",
        shape: { kind: "circle", r: 3, holes: [] },
      },
    ],
    links: [
      { id: "pin", ref: 3, kind: "pin", host: "weight", at: [0, 0], r: 1, layers: ["L2", "L3"] },
      {
        id: "slot",
        ref: 4,
        kind: "slot",
        pin: "pin",
        guide: "guide",
        profile: "profile",
        hole: 0,
        mode: "joint",
      },
      { id: "lock", ref: 5, kind: "lock", a: null, b: "weight", at: [0, 0], breakForce: 1 },
      {
        id: "sensor",
        ref: 6,
        kind: "sensor",
        host: "guide",
        at: [0, 0],
        r: 1,
        layers: ["L2", "L2"],
        minSpeed: 0,
        actions: [{ do: "release", target: "lock" }],
      },
    ],
  };
}

describe("v3 integrity", () => {
  it("accepts profiles, a slot in a profile and a release action", () => {
    const s = base();
    expect(validateScene(s)).toMatchObject({ ok: true, scene: s });
    expect(parseScene(serializeScene(s))).toMatchObject({ ok: true, scene: s });
  });

  const invalid: [string, (s: Scene) => void][] = [
    [
      "parts[0].profiles[0].layer",
      (s) => {
        s.parts[0]!.profiles![0]!.layer = "missing";
      },
    ],
    [
      "parts[0].profiles[0].layer",
      (s) => {
        s.parts[0]!.profiles![0]!.layer = "L1";
      },
    ],
    [
      "parts[0].profiles[1].layer",
      (s) => {
        s.parts[0]!.profiles!.push({ ...s.parts[0]!.profiles![0]!, id: "other" });
      },
    ],
    [
      "parts[0].profiles[0].id",
      (s) => {
        s.parts[0]!.profiles![0]!.id = "weight";
      },
    ],
    [
      "links[1].profile",
      (s) => {
        if (s.links[1]!.kind === "slot") s.links[1]!.profile = "weight";
      },
    ],
    [
      "links[1].hole",
      (s) => {
        if (s.links[1]!.kind === "slot") s.links[1]!.hole = 2;
      },
    ],
    [
      "links[1].pin",
      (s) => {
        if (s.links[0]!.kind === "pin") s.links[0]!.layers = ["L1", "L2"];
      },
    ],
    [
      "links[3].actions[0].target",
      (s) => {
        if (s.links[3]!.kind === "sensor") s.links[3]!.actions[0]!.target = "pin";
      },
    ],
    [
      "links[2].breakForce",
      (s) => {
        if (s.links[2]!.kind === "lock") s.links[2]!.breakForce = 0;
      },
    ],
    [
      "links[2].breakForce",
      (s) => {
        if (s.links[2]!.kind === "lock") s.links[2]!.breakForce = -1;
      },
    ],
  ];
  it.each(invalid)("rejects invalid %s with a field path", (path, mutate) => {
    const s = base();
    mutate(s);
    const r = validateScene(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.path)).toContain(path);
  });
});

describe("v2 examples retain their physics hashes", () => {
  const hashes = JSON.parse(readFileSync("scenes/fixtures/hashes.json", "utf8")) as Record<string, string>;
  for (const file of readdirSync("scenes/examples").filter((f) =>
    [
      "lancador-bancada.json",
      "cilindro-dois-pistoes.json",
      "engrenagens.json",
      "biela-manivela.json",
      "trava.json",
      "lancador.json",
    ].includes(f),
  )) {
    it(file, { timeout: 60000 }, async () => {
      const current = JSON.parse(readFileSync(`scenes/examples/${file}`, "utf8")) as Scene;
      const old = { ...current, version: 2 };
      const r = parseScene(JSON.stringify(old));
      expect(r).toMatchObject({ ok: true, migratedFrom: 2 });
      if (!r.ok) throw new Error(JSON.stringify(r.issues));
      expect(r.scene).toEqual({ ...old, version: 4 });
      const name = file.replace(".json", "");
      const script = JSON.parse(
        readFileSync(`scenes/fixtures/exemplos/${name}.test.json`, "utf8"),
      ) as FixtureScript;
      const make = await loadBox2d();
      const result = await runFixture(make(), script, r.scene, { now: () => performance.now() });
      expect(result.hash).toBe(hashes[`exemplos/${name}`]);
    });
  }
});
