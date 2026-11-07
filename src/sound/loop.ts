import type { AudioEntry } from "@/assets/audio-registry";

/**
 * Contas de laço e de sorteio, sem Web Audio (testáveis no Node).
 *
 * Laço da música: a primeira passada vai do começo do arquivo até o fim do
 * trecho; nas voltas seguintes só o trecho se repete. A emenda é um crossfade
 * de potência constante de `crossfade` s: um segundo tocador entra em
 * `loop.start − crossfade` quando o primeiro chega a `loop.end − crossfade`,
 * e os dois chegam juntos a `loop.start` e `loop.end` no fim do fade (o trecho
 * dura um número inteiro de tempos, então as duas partes batem no compasso).
 */

export interface StreamPlan {
  /** posição do tocador (s) em que o próximo começa a entrar */
  fadeAt: number;
  /** de onde o próximo tocador começa (s) */
  entryAt: number;
  crossfade: number;
}

export function planStream(entry: Pick<AudioEntry, "loop">): StreamPlan | null {
  const loop = entry.loop;
  if (!loop) return null;
  const crossfade = Math.min(loop.crossfade, Math.max(0, loop.start), loop.end - loop.start);
  return { fadeAt: loop.end - crossfade, entryAt: loop.start - crossfade, crossfade };
}

/** Ganhos de potência constante: `out` desce com o cosseno, `in` sobe com o seno. */
export const equalPowerOut = (t: number): number => Math.cos((Math.min(1, Math.max(0, t)) * Math.PI) / 2);
export const equalPowerIn = (t: number): number => Math.sin((Math.min(1, Math.max(0, t)) * Math.PI) / 2);

/** Curva para `setValueCurveAtTime`, com `n` pontos, subindo ou descendo. */
export function equalPowerCurve(direction: "in" | "out", n = 32): Float32Array {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    curve[i] = direction === "in" ? equalPowerIn(t) : equalPowerOut(t);
  }
  return curve;
}

/**
 * Laço de buffer com crossfade (a vazão): segmentos sobrepostos. O segmento k
 * começa em `k · cycle` no relógio, toca o arquivo a partir de `start − crossfade`
 * por `cycle + crossfade` s, entra durante os primeiros `crossfade` s e sai
 * nos últimos. Cada segmento nasce `cycle` depois do anterior.
 */
export function ventSegment(loop: { start: number; end: number; crossfade: number }) {
  const cycle = loop.end - loop.start;
  const crossfade = Math.min(loop.crossfade, loop.start, cycle / 2);
  return { cycle, crossfade, offset: loop.start - crossfade, duration: cycle + crossfade };
}

/**
 * Sorteia uma variação sem repetir a anterior. `random` devolve [0, 1).
 * Com uma só variação, ela mesma.
 */
export function pickVariant(count: number, last: number | null, random: () => number = Math.random): number {
  if (count <= 1) return 0;
  if (last === null || last < 0 || last >= count) return Math.min(count - 1, Math.floor(random() * count));
  const i = Math.min(count - 2, Math.floor(random() * (count - 1)));
  return i >= last ? i + 1 : i;
}
