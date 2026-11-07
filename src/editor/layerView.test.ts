import { expect, it } from "vitest";
import { layerOffset, spreadBounds } from "./layerView";
it("separates sheets up and right and encloses every sheet", () => {
  expect(layerOffset(3, 12)).toEqual([36, -36]);
  expect(spreadBounds([-10, -20, 40, 50], 4, 12)).toEqual([-10, -56, 76, 86]);
});
