import type { Scene } from "@/model/types";
import type { Probe } from "./model";
/** Example ids are stable; a renamed copy still offers the same instruments. */
export function instrumentPreset(scene: Scene): Probe[] {
  const has = (id: string, name: string) => scene.parts.some((p) => p.id === id && p.name === name);
  if (
    has("p7", "Ferrolho") &&
    has("p10", "Esfera 1") &&
    scene.links.some((l) => l.id === "k30" && l.kind === "chamber")
  )
    return [
      {
        id: "ball-speed",
        target: "p10",
        quantity: "velocity",
        name: "Esfera · velocidade",
        // "Na saída": the instant the ball centre passes the muzzle (x = 50 mm), where the example's test
        // measures the exit speed. The curve keeps the instantaneous peak, which the gas pulse inflates.
        at: { kind: "crossing", target: "p10", quantity: "absoluteX", threshold: 50 },
        atLabel: "na saída",
      },
      { id: "gas-pressure", target: "k30", quantity: "pressure", name: "Câmara · pressão" },
      { id: "bolt-position", target: "p7", quantity: "x", name: "Ferrolho · posição x" },
      { id: "sear-force", target: "k35", quantity: "force", name: "Retém · força" },
    ];
  // ciclo/disparo-extracao (Fase 2 · M2a): o ciclo da cápsula numa cena só
  if (
    has("p4", "Cápsula") &&
    has("p5", "Esfera") &&
    has("p6", "Ferrolho") &&
    scene.links.some((l) => l.id === "k9" && l.kind === "axle") &&
    scene.links.some((l) => l.kind === "chamber" && l.mode === "capsule")
  ) {
    const seat = scene.links.find((l) => l.kind === "chamber" && l.mode === "capsule");
    const body = seat?.kind === "chamber" ? scene.parts.find((p) => p.id === seat.body) : undefined;
    // a boca do cano: o fundo da câmara de cápsula mais o comprimento dela
    const muzzle = seat?.kind === "chamber" && body ? body.x + seat.at[0] + seat.length : 59.2;
    return [
      { id: "capsule-pressure", target: "p4", quantity: "pressure", name: "Cápsula · pressão" },
      {
        id: "ball-speed",
        target: "p5",
        quantity: "velocity",
        name: "Esfera · velocidade",
        at: { kind: "crossing", target: "p5", quantity: "absoluteX", threshold: muzzle },
        atLabel: "na saída",
      },
      { id: "bolt-position", target: "p6", quantity: "x", name: "Ferrolho · recuo" },
      { id: "extractor-force", target: "k9", quantity: "force", name: "Extrator · força na garra" },
    ];
  }
  if (
    has("p2", "Roda composta") &&
    has("p4", "Lingueta") &&
    scene.links.some((l) => l.id === "k7" && l.kind === "axle")
  )
    return [
      { id: "wheel-angle", target: "p2", quantity: "angle", name: "Roda · ângulo" },
      { id: "pawl-torque", target: "k7", quantity: "torque", name: "Lingueta · torque", countDrops: true },
    ];
  return [];
}

/** Same trigger gesture as the launcher demonstration, recorded at 240 Hz. */
export function launcherInputs(): import("@/sim/session").SimInput[] {
  const inputs: import("@/sim/session").SimInput[] = [
    { step: 72, kind: "start", part: "p19", p: [16, 35.5] },
  ];
  for (let step = 73; step <= 101; step++) {
    const fraction = Math.min(1, (step - 72) / 28.8);
    inputs.push({ step, kind: "move", p: [16 - 18 * fraction, 35.5 - fraction] });
  }
  inputs.push({ step: 360, kind: "end" });
  return inputs;
}
