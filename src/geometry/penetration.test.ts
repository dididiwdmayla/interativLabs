import { expect, it } from "vitest";
import { pieceSeparation, type WorldPiece } from "./penetration";

const box = (x: number, y: number, w: number, h: number, clockwise = false): WorldPiece => {
  const ring: [number, number][] = [
    [x - w / 2, y - h / 2],
    [x + w / 2, y - h / 2],
    [x + w / 2, y + h / 2],
    [x - w / 2, y + h / 2],
  ];
  return { kind: "poly", points: clockwise ? ring.reverse() : ring };
};

it("reads the gap between separate boxes and the depth of overlapping ones, whatever the winding", () => {
  for (const cw of [false, true]) {
    expect(pieceSeparation(box(0, 0, 10, 10), box(13, 0, 10, 10, cw))).toBeCloseTo(3, 9);
    expect(pieceSeparation(box(0, 0, 10, 10, cw), box(8, 0, 10, 10))).toBeCloseTo(-2, 9);
    expect(pieceSeparation(box(0, 0, 10, 10), box(3, 9, 10, 10, cw))).toBeCloseTo(-1, 9);
  }
});
it("circles against circles and polygons", () => {
  const c: WorldPiece = { kind: "circle", c: [0, 0], r: 3 };
  expect(pieceSeparation(c, { kind: "circle", c: [5, 0], r: 1 })).toBeCloseTo(1, 9);
  expect(pieceSeparation(c, { kind: "circle", c: [3, 0], r: 1 })).toBeCloseTo(-1, 9);
  expect(pieceSeparation(box(8, 0, 10, 10), c)).toBeCloseTo(0 - 0, 9); // face at x = 3 touches r = 3
  expect(pieceSeparation(c, box(7, 0, 10, 10))).toBeCloseTo(-1, 9);
});
