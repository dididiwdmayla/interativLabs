/**
 * Geração de ids. Ids são strings opacas, únicas na cena, com um prefixo
 * legível por tipo (L = camada, p = peça, k = ligação). O gerador recebe os
 * ids já usados para nunca colidir com uma cena importada.
 */

export type IdKind = "layer" | "part" | "link";

const PREFIX: Record<IdKind, string> = { layer: "L", part: "p", link: "k" };

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export type Random = () => number;

export interface IdGenerator {
  next(kind: IdKind): string;
  /** Marca um id como usado (ex.: ao inserir algo vindo de fora). */
  reserve(id: string): void;
}

export function createIdGenerator(used: Iterable<string> = [], random: Random = Math.random): IdGenerator {
  const taken = new Set(used);
  return {
    next(kind) {
      for (;;) {
        let s = PREFIX[kind];
        for (let i = 0; i < 8; i++) s += ALPHABET[Math.floor(random() * ALPHABET.length)];
        if (!taken.has(s)) {
          taken.add(s);
          return s;
        }
      }
    },
    reserve(id) {
      taken.add(id);
    },
  };
}

/** Gerador pseudoaleatório determinístico (mulberry32) para testes e fixtures. */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Próximo número de chamada: o maior existente + 1 (nunca renumera). */
export function nextRef(scene: { parts: { ref: number }[]; links: { ref: number }[] }): number {
  let max = 0;
  for (const p of scene.parts) max = Math.max(max, p.ref);
  for (const l of scene.links) max = Math.max(max, l.ref);
  return max + 1;
}
