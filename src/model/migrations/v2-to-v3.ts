import type { SceneV2, SceneV3 } from "../types";

/** No defaults or geometry changes: legacy simulations retain their hashes. */
export function migrateV2ToV3(scene: SceneV2): SceneV3 {
  return { ...scene, version: 3 };
}
