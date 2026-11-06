import type { Scene, SceneV2 } from "../types";

/** No defaults or geometry changes: legacy simulations retain their hashes. */
export function migrateV2ToV3(scene: SceneV2): Scene {
  return { ...scene, version: 3 };
}
