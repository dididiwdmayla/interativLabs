// Conferência das emendas de laço, por diferença de energia ao redor do ponto.
// Entrada: amostras mono do arquivo convertido (48 kHz) e o laço no tempo dele.

const RATE = 48000;

const rmsDb = (x, from, to) => {
  let s = 0;
  const a = Math.max(0, from);
  const b = Math.min(x.length, to);
  for (let i = a; i < b; i++) s += x[i] * x[i];
  const n = Math.max(1, b - a);
  return 10 * Math.log10(s / n + 1e-20);
};

/**
 * - `jumpDb`: energia (RMS, dB) da janela que termina no fim do laço contra a que começa
 *   no início. É o salto que a pessoa ouviria se o trecho voltasse seco, sem crossfade.
 * - `dipDb`: com o crossfade de potência constante do motor (o fim do laço sai enquanto o
 *   trecho de antes do início entra, como em src/sound/loop.ts), o maior desvio da energia
 *   misturada, em blocos de 100 ms, em relação à média das duas partes. Zero é perfeito.
 */
export function seamReport(x, loop, window) {
  const s = Math.round(loop.start * RATE);
  const e = Math.round(loop.end * RATE);
  const w = Math.round(window * RATE);
  const before = rmsDb(x, e - w, e);
  const after = rmsDb(x, s, s + w);
  const x2 = Math.round(loop.crossfade * RATE);
  const block = Math.max(1, Math.min(Math.round(0.1 * RATE), Math.floor(x2 / 2)));
  let dip = 0;
  if (s - x2 >= 0 && x2 > 0) {
    const mix = new Float32Array(x2);
    for (let i = 0; i < x2; i++) {
      const t = (i + 0.5) / x2;
      mix[i] = x[e - x2 + i] * Math.cos((t * Math.PI) / 2) + x[s - x2 + i] * Math.sin((t * Math.PI) / 2);
    }
    for (let k = 0; k + block <= x2; k += block) {
      const m = rmsDb(mix, k, k + block);
      const a = rmsDb(x, e - x2 + k, e - x2 + k + block);
      const b = rmsDb(x, s - x2 + k, s - x2 + k + block);
      const avg = 10 * Math.log10((10 ** (a / 10) + 10 ** (b / 10)) / 2);
      dip = Math.max(dip, Math.abs(m - avg));
    }
  }
  return { jumpDb: Math.abs(before - after), beforeDb: before, afterDb: after, dipDb: dip };
}
