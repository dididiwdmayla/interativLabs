import type { Link, Scene } from "@/model/types";

/** The Lançador's return spring (Mola de retorno), the one "Experimente comparar" stiffens. */
export const RETURN_SPRING = "k27";
/**
 * How much stiffer variant B's return spring is. Found by measurement on the example (replay of the
 * trigger gesture, 1,8 s): up to ×1,55 the bolt still returns and the next ball is chambered; from ×1,6 the
 * stiffer spring throws the next ball out of the chamber, and from ×2 the cycle never completes.
 * ×1,5 keeps a margin below that edge and shortens the cycle by about 30 %.
 */
export const RETURN_SPRING_FACTOR = 1.5;

/** The return spring with its stiffness multiplied, or null when the scene is not the Lançador. */
export function stifferReturnSpring(scene: Scene, factor = RETURN_SPRING_FACTOR): Link | null {
  const spring = scene.links.find((l) => l.id === RETURN_SPRING && l.kind === "spring");
  return spring?.kind === "spring" ? { ...spring, k: spring.k * factor } : null;
}
