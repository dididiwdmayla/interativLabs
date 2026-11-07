import { expect, it } from "vitest";
import { TrailHistory } from "./trails";
it("uses simulation time, includes the selected piece, caps tracks and expires still pieces", () => {
  const history = new TrailHistory();
  const points = (x: number) =>
    new Map(Array.from({ length: 20 }, (_, i) => [`p${i}`, [x, i] as [number, number]]));
  expect(history.update(0, points(0), "p19")).toEqual(["p19"]);
  expect(history.update(0.1, points(3), "p19")).toHaveLength(12);
  expect(history.path("p19", 0, 0.1)).toContain("M0.00 19.00L3.00 19.00");
  expect(history.update(0.7, points(3), null)).toEqual([]);
  expect(history.update(0, points(0), null)).toEqual([]);
});

it("keeps the half-second window during slow playback", () => {
  const history = new TrailHistory();
  let ids: string[] = [];
  for (let i = 0; i <= 600; i++) {
    const time = i / 1200;
    ids = history.update(time, new Map([["bolt", [time * 5, 0]]]), null);
  }
  expect(ids).toContain("bolt");
});
