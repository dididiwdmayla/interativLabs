import type { Vec2 } from "@/model/types";
import type { Box } from "@/render/view";

export function layerOffset(index: number, distance: number): Vec2 {
  return [index * distance, -index * distance];
}
export function spreadBounds(bounds: Box, count: number, distance: number): Box {
  const d = Math.max(0, count - 1) * distance;
  return [bounds[0], bounds[1] - d, bounds[2] + d, bounds[3] + d];
}
