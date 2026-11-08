import type { EngineAdapter } from "@/engine/types";
import type { Scene } from "@/model/types";
import type { Probe } from "@/instruments/model";
import { SimSession, type SimInput } from "./session";
/** Replay input ids and world points; a missing drag target skips its entire gesture. */
export function replay(
  make: () => EngineAdapter,
  scene: Scene,
  inputs: SimInput[],
  steps: number,
  probes: Probe[],
) {
  const session = new SimSession(make, scene, { probes, capacity: Math.max(2400, steps) });
  let index = 0;
  let dragging = false;
  for (let step = 0; step < steps; step++) {
    while (index < inputs.length && inputs[index]!.step === step) {
      const input = inputs[index++]!;
      if (input.kind === "start") {
        dragging = scene.parts.some((p) => p.id === input.part);
        if (dragging) session.enqueue([input]);
      } else if (input.kind === "release") {
        if (scene.links.some((l) => l.id === input.link)) session.enqueue([input]);
      } else if (dragging) {
        session.enqueue([input]);
        if (input.kind === "end") dragging = false;
      }
    }
    session.advance();
    session.drainSound();
  }
  return session;
}
