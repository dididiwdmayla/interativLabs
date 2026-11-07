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
      { id: "ball-speed", target: "p10", quantity: "velocity", name: "Esfera · velocidade" },
      { id: "gas-pressure", target: "k30", quantity: "pressure", name: "Câmara · pressão" },
      { id: "bolt-position", target: "p7", quantity: "x", name: "Ferrolho · posição x" },
      { id: "sear-force", target: "k35", quantity: "force", name: "Retém · força" },
    ];
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
