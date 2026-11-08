import type { Scene, SceneV3 } from "../types";

/**
 * v4 only adds optional fields (the capsule and the capsule chamber): no
 * defaults or geometry changes, so every v3 simulation keeps its hash.
 */
export function migrateV3ToV4(scene: SceneV3): Scene {
  return { ...scene, version: 4 };
}
