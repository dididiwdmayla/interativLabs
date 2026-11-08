import { beforeAll, describe, expect, it } from "vitest";
import { loadBox2d } from "@/engine/box2d/load";
import type { EngineAdapter } from "@/engine/types";
import { validateScene } from "@/model/scene";
import type { Scene } from "@/model/types";
import { CAPSULE_DEFAULTS, CAPSULE_MIN_STRIKE, capsuleGeometry } from "@/parts/capsule";
import { FIXED_STEP } from "./common";

/** Cápsula solta numa placa (vista de cima) e um bloco que a mão arrasta contra a espoleta. */
function scene(): Scene {
  const geo = capsuleGeometry(CAPSULE_DEFAULTS);
  const s: Scene = {
    version: 4,
    meta: { title: "golpe com o dedo", createdAt: "", updatedAt: "" },
    settings: { gravity: { on: false, g: 9810 }, snap: { on: false, grid: 1 } },
    layers: [{ id: "L", name: "Ação", visible: true, locked: false, thickness: 4 }],
    parts: [
      {
        id: "case",
        ref: 1,
        name: "Cápsula",
        layer: "L",
        x: 0,
        y: 0,
        angle: 0,
        fixed: false,
        fast: false,
        material: "brass",
        shape: { kind: "poly", outer: geo.outer, holes: [] },
        capsule: { ...geo.capsule, projectile: "ball" },
      },
      {
        id: "ball",
        ref: 2,
        name: "Esfera",
        layer: "L",
        x: geo.ball.at[0],
        y: 0,
        angle: 0,
        fixed: false,
        fast: true,
        material: "steel",
        shape: { kind: "circle", r: geo.ball.r, holes: [] },
      },
      {
        id: "pin",
        ref: 3,
        name: "Bloco",
        layer: "L",
        x: -30,
        y: 0,
        angle: 0,
        fixed: false,
        fast: false,
        material: "steel",
        shape: {
          kind: "poly",
          outer: [
            [-4, -1],
            [4, -1],
            [4, 1],
            [-4, 1],
          ],
          holes: [],
        },
      },
    ],
    links: [],
  };
  const v = validateScene(s);
  if (!v.ok) throw new Error(JSON.stringify(v.issues));
  return v.scene;
}

let make: () => EngineAdapter;
beforeAll(async () => {
  make = await loadBox2d();
});

describe("cápsula no motor", () => {
  it("o golpe mínimo fica abaixo da velocidade da mão (600 mm/s): dá para golpear com o dedo", () => {
    expect(CAPSULE_MIN_STRIKE).toBeLessThan(600);
  });

  it("a mão arrastando um bloco contra a espoleta dispara a cápsula e solta a esfera", () => {
    const a = make();
    a.compile(scene(), { unitMm: 1 });
    a.dragStart("pin", [-30, 0]);
    let fired = 0;
    for (let i = 0; i < 60; i++) {
      // o dedo vai longe; o alvo da mão persegue a 600 mm/s
      a.dragMove([40, 0]);
      a.step(FIXED_STEP);
      fired += a.snapshot().events.filter((e) => e.kind === "capsule-fired").length;
    }
    a.dragEnd();
    expect(fired).toBe(1);
    const s = a.snapshot();
    expect(s.links.case?.fired).toBe(true);
    // a esfera saiu para a frente e o estojo recuou
    expect(s.parts.ball!.x).toBeGreaterThan(capsuleGeometry(CAPSULE_DEFAULTS).ball.at[0] + 20);
    a.dispose();
  });

  it("empurrar devagar (300 mm/s) não dispara", () => {
    const a = make();
    a.compile(scene(), { unitMm: 1 });
    a.setVelocity("pin", [300, 0], 0);
    let fired = 0;
    for (let i = 0; i < 60; i++) {
      a.step(FIXED_STEP);
      fired += a.snapshot().events.filter((e) => e.kind === "capsule-fired").length;
    }
    expect(fired).toBe(0);
    a.dispose();
  });
});
