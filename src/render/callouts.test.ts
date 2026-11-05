import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { containsPoint, type PolyWithHoles } from "@/geometry/polygon";
import { loadScene } from "@/model/scene";
import { layoutCallouts, outlineGeometry, type CalloutTarget } from "./callouts";
import { calloutGeometry } from "./calloutScene";
import { prepareScene } from "./prepare";

const rect = (x0: number, y0: number, x1: number, y1: number): PolyWithHoles => ({
  outer: [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ],
  holes: [],
});

describe("chamadas sem cruzar peças", () => {
  it("escolhe o lado livre: a linha só atravessa a peça que contém o ponto", () => {
    // peça pequena com o ponto, encostada numa placa grande à direita e outra embaixo
    const shapes = [rect(0, 0, 10, 10), rect(11, -40, 80, 40), rect(-40, 11, 10, 60)];
    const geo = outlineGeometry(
      shapes.map((s) => [s.outer]),
      (i, p) => containsPoint(shapes[i]!, p),
    );
    const t: CalloutTarget = { id: "a", ref: 7, p: [5, 5], priority: 1 };
    const [o] = layoutCallouts([t], [-40, -40, 120, 100], 0.2, geo);
    expect(o!.hidden).toBe(false);
    expect(o!.extra).toBe(0);
    // o rótulo fica do lado de cima ou da esquerda (onde não há placa)
    expect(o!.label[0] < 11 && o!.label[1] < 11).toBe(true);
  });

  it("sem caminho limpo, o rótulo vai para fora do contorno da cena", () => {
    // ponto no meio de um anel de placas fechado
    const shapes = [
      rect(-5, -5, 5, 5),
      rect(-30, -30, 30, -6),
      rect(-30, 6, 30, 30),
      rect(-30, -6, -6, 6),
      rect(6, -6, 30, 6),
    ];
    const geo = outlineGeometry(
      shapes.map((s) => [s.outer]),
      (i, p) => containsPoint(shapes[i]!, p),
    );
    const [o] = layoutCallouts([{ id: "a", ref: 1, p: [0, 0], priority: 1 }], [-30, -30, 60, 60], 0.2, geo);
    expect(o!.hidden).toBe(false);
    const outside = Math.abs(o!.label[0]) > 30 || Math.abs(o!.label[1]) > 30;
    expect(outside).toBe(true);
  });

  for (const id of ["engrenagens", "trava", "lancador", "biela-manivela", "cilindro-dois-pistoes"])
    it(`${id}: toda chamada visível tem caminho limpo ou fica fora da cena`, () => {
      const r = loadScene(JSON.parse(readFileSync(`scenes/examples/${id}.json`, "utf8")));
      if (!r.ok) throw new Error("cena inválida");
      const model = prepareScene(r.scene);
      const { geo, bounds } = calloutGeometry(model);
      const targets = model.links
        .filter((l) => l.link.kind !== "slot")
        .map((l) => ({ id: l.link.id, ref: l.link.ref, p: l.world, priority: 1 }));
      const px = 0.1;
      const out = layoutCallouts(targets, bounds, px, geo);
      const [x, y, w, h] = bounds;
      for (const o of out) {
        if (o.hidden) continue;
        const outside = o.label[0] < x || o.label[0] > x + w || o.label[1] < y || o.label[1] > y + h;
        expect(o.extra === 0 || outside, `chamada ${o.ref}`).toBe(true);
      }
    });
});
