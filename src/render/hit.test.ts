import { describe, expect, it } from "vitest";
import { rectRing } from "@/geometry/primitives";
import type { Part, Scene } from "@/model/types";
import { partAt } from "./hit";
import { drawnFrame } from "./nodes";
import { prepareScene } from "./prepare";

const NOW = "2026-11-04T00:00:00.000Z";
const box = (id: string, layer: string, x: number, size: number, fixed = false): Part => ({
  id,
  ref: Number(id.slice(1)),
  name: id,
  layer,
  x,
  y: 0,
  angle: 0,
  shape: { kind: "poly", outer: rectRing(-size / 2, -size / 2, size / 2, size / 2), holes: [] },
  material: "steel",
  fixed,
  fast: false,
});

function scene(parts: Part[]): Scene {
  return {
    version: 4,
    meta: { title: "t", createdAt: NOW, updatedAt: NOW },
    settings: { gravity: { on: true, g: 9810 }, snap: { grid: 1, on: true } },
    layers: ["L1", "L2", "L3"].map((id) => ({ id, name: id, visible: true, locked: false, thickness: 3 })),
    parts,
    links: [],
  };
}

describe("toque: a peça mais alta sob o dedo", () => {
  // p1 (camada 1) grande; p2 (camada 3) e p3 (camada 2) sobre ela; p4 fixa na camada 3
  const parts = [
    box("p1", "L1", 0, 40),
    box("p2", "L3", 0, 10),
    box("p3", "L2", 3, 10),
    box("p4", "L3", 15, 6, true),
  ];
  const model = prepareScene(scene(parts));
  const frame = drawnFrame(model);

  it("pega a da camada mais alta", () => {
    expect(partAt(model, frame, [0, 0], { dynamicOnly: true })).toBe("p2");
    expect(partAt(model, frame, [7, 0], { dynamicOnly: true })).toBe("p3");
    expect(partAt(model, frame, [-15, 0], { dynamicOnly: true })).toBe("p1");
  });

  it("no arrasto, ignora peça fixa por cima e pega a móvel embaixo", () => {
    expect(partAt(model, frame, [15, 0], { dynamicOnly: true })).toBe("p1");
    expect(partAt(model, frame, [15, 0])).toBe("p4");
  });

  it("na mesma camada, a última do array (desenhada por cima)", () => {
    const m = prepareScene(scene([box("p1", "L1", 0, 20), box("p2", "L1", 2, 20)]));
    expect(partAt(m, drawnFrame(m), [0, 0], { dynamicOnly: true })).toBe("p2");
  });

  it("segue a pose do quadro (a peça andou)", () => {
    const moved = {
      ...frame,
      pose: (id: string) => (id === "p2" ? { x: -12, y: 0, angle: 0 } : frame.pose(id)),
    };
    expect(partAt(model, moved, [-12, 0], { dynamicOnly: true })).toBe("p2");
    expect(partAt(model, moved, [-4, 0], { dynamicOnly: true })).toBe("p1");
  });

  it("camada escondida não pega; tolerância de borda pega peça fina", () => {
    expect(partAt(model, frame, [0, 0], { dynamicOnly: true, layer: (i) => i !== 2 })).toBe("p3");
    expect(partAt(model, frame, [21, 0], { dynamicOnly: true })).toBeNull();
    expect(partAt(model, frame, [21, 0], { dynamicOnly: true, tol: 1.5 })).toBe("p1");
  });
});
