import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadScene } from "@/model/scene";
import { cut, makeShape, repairShape } from "./clip";
import { MAX_POLY_VERTICES, decomposeConvex, piecesArea } from "./decompose";
import { involuteGear } from "./gear";
import { area, isConvex, signedArea, type PolyWithHoles, type Ring } from "./polygon";
import { circleRing, rectRing, slotRing } from "./primitives";
import { shapeGeometry } from "./shape";
import { seededRandom } from "@/model/ids";

const one = (r: { ok: boolean; value?: PolyWithHoles[] }): PolyWithHoles[] => (r.ok ? r.value! : []);
const simple = (outer: Ring, holes: Ring[] = []): PolyWithHoles => ({ outer, holes });

function star(n: number, r1: number, r2: number): Ring {
  return Array.from({ length: 2 * n }, (_, i) => {
    const r = i % 2 ? r2 : r1;
    const a = (Math.PI * i) / n;
    return [r * Math.cos(a), r * Math.sin(a)] as [number, number];
  });
}

function prototypePolys(): PolyWithHoles[] {
  const v0 = JSON.parse(readFileSync("reference/prototype-v0/scenes/lancador.json", "utf8"));
  const r = loadScene(v0, { now: "2026-11-03T00:00:00.000Z" });
  if (!r.ok) throw new Error("cena");
  return r.scene.parts.flatMap((p) =>
    p.shape.kind === "poly" ? [simple(p.shape.outer, p.shape.holes)] : [],
  );
}

function shapes(): { name: string; shape: PolyWithHoles }[] {
  const out: { name: string; shape: PolyWithHoles }[] = [];
  const add = (name: string, list: PolyWithHoles[]) =>
    list.forEach((shape, i) => out.push({ name: `${name}${list.length > 1 ? ` #${i + 1}` : ""}`, shape }));
  add("quadrado", [simple(rectRing(0, 0, 10, 10))]);
  add("círculo", [simple(circleRing([0, 0], 10))]);
  add("L", [
    simple([
      [0, 0],
      [20, 0],
      [20, 5],
      [5, 5],
      [5, 20],
      [0, 20],
    ]),
  ]);
  add(
    "oito",
    one(
      makeShape([
        [0, 0],
        [10, 10],
        [10, 0],
        [0, 10],
      ]),
    ),
  );
  add("furo tangente", one(cut(simple(rectRing(0, 0, 20, 20)), circleRing([5, 10], 5))));
  add("furo vazando", one(cut(simple(rectRing(0, 0, 20, 20)), circleRing([0, 10], 5))));
  add("rasgo dividindo", one(cut(simple(rectRing(0, 0, 20, 10)), slotRing([10, -5], [10, 15], 2))));
  add("estrela de 12 pontas", [simple(star(12, 20, 8))]);
  add(
    "placa com 3 furos e 1 rasgo",
    one(
      repairShape(
        simple(rectRing(0, 0, 60, 30), [
          circleRing([10, 10], 3),
          circleRing([25, 20], 4),
          circleRing([50, 8], 2.5),
          slotRing([35, 8], [50, 22], 3),
        ]),
      ),
    ),
  );
  add("anel", [simple(circleRing([0, 0], 12), [circleRing([0, 0], 7).reverse()])]);
  add("barra longa 300 × 1", [simple(rectRing(0, 0, 300, 1))]);
  add("pente", [
    simple([
      [0, 0],
      [30, 0],
      [30, 12],
      [27, 12],
      [27, 4],
      [24, 4],
      [24, 12],
      [21, 12],
      [21, 4],
      [18, 4],
      [18, 12],
      [15, 12],
      [15, 4],
      [12, 4],
      [12, 12],
      [9, 12],
      [9, 4],
      [6, 4],
      [6, 12],
      [3, 12],
      [3, 4],
      [0, 4],
    ]),
  ]);
  add("moldura", [simple(rectRing(0, 0, 40, 30), [rectRing(5, 5, 35, 25).reverse()])]);
  const rnd = seededRandom(42);
  add("radial aleatório", [
    simple(
      Array.from({ length: 40 }, (_, i) => {
        const a = (2 * Math.PI * i) / 40;
        const r = 8 + rnd() * 12;
        return [r * Math.cos(a), r * Math.sin(a)] as [number, number];
      }),
    ),
  ]);
  const g = involuteGear({ module: 1, teeth: 16, bore: 4 });
  if (g.ok) add("engrenagem pela via genérica", [g.value.outline]);
  add("triângulo com furo", [
    simple(
      [
        [0, 0],
        [30, 0],
        [15, 26],
      ],
      [circleRing([15, 9], 4).reverse()],
    ),
  ]);
  add("cruz", [
    simple([
      [10, 0],
      [20, 0],
      [20, 10],
      [30, 10],
      [30, 20],
      [20, 20],
      [20, 30],
      [10, 30],
      [10, 20],
      [0, 20],
      [0, 10],
      [10, 10],
    ]),
  ]);
  add("protótipo", prototypePolys());
  return out;
}

describe("decomposição convexa", () => {
  const list = shapes();

  it("tem pelo menos 20 formas", () => {
    expect(list.length).toBeGreaterThanOrEqual(20);
  });

  for (const { name, shape } of list) {
    it(name, () => {
      const r = decomposeConvex(shape);
      expect(r.ok, JSON.stringify(r)).toBe(true);
      if (!r.ok) return;
      for (const p of r.value.pieces) {
        expect(isConvex(p)).toBe(true);
        expect(signedArea(p)).toBeGreaterThan(0);
        expect(p.length).toBeLessThanOrEqual(MAX_POLY_VERTICES);
        expect(Math.abs(signedArea(p))).toBeGreaterThanOrEqual(0.05);
      }
      const a = area(shape);
      const sum = r.value.pieces.reduce((s, p) => s + signedArea(p), 0);
      expect(Math.abs(sum - a) / a).toBeLessThan(0.005);
      const again = decomposeConvex(shape);
      expect(again).toEqual(r);
    });
  }

  it("círculo sem furo continua círculo", () => {
    const g = shapeGeometry({ kind: "circle", r: 5, holes: [] });
    expect(g.ok).toBe(true);
    if (g.ok) expect(g.value.pieces).toEqual([{ kind: "circle", c: [0, 0], r: 5 }]);
  });

  it("círculo com furo vira polígonos convexos", () => {
    const g = shapeGeometry({ kind: "circle", r: 5, holes: [circleRing([1, 0], 1)] });
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(g.value.pieces.every((p) => p.kind === "poly" && isConvex(p.points))).toBe(true);
    const a = Math.PI * 25 - Math.PI;
    expect(Math.abs(piecesArea(g.value.pieces) - a) / a).toBeLessThan(0.005);
  });

  it("lascas abaixo de 0,05 mm² são descartadas e informadas", () => {
    const r = decomposeConvex(simple(rectRing(0, 0, 0.2, 0.2)));
    expect(r.ok).toBe(false);
  });
});
