// Ajudantes de ffmpeg do pipeline de áudio. O binário vem do `ffmpeg-static`
// (devDependency); FFMPEG_BIN aponta para outro, quando for preciso.

import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function ffmpegPath() {
  if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN;
  const bin = require("ffmpeg-static");
  if (!bin) throw new Error("ffmpeg-static não tem binário para esta plataforma; defina FFMPEG_BIN.");
  return bin;
}

/** Roda o ffmpeg; devolve { stdout (Buffer), stderr (string) }; rejeita se sair com erro. */
export function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath(), ["-hide_banner", "-nostdin", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const out = [];
    let err = "";
    child.stdout.on("data", (d) => out.push(d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg ${args.join(" ")}\n${err.slice(-2000)}`));
      resolve({ stdout: Buffer.concat(out), stderr: err });
    });
  });
}

/** Decodifica para PCM float 48 kHz (mono por padrão): amostras exatas para medir. */
export async function decode(file, { channels = 1, filters = [] } = {}) {
  const args = ["-i", file];
  if (filters.length) args.push("-af", filters.join(","));
  args.push("-ac", String(channels), "-ar", "48000", "-f", "f32le", "-");
  const { stdout } = await ffmpeg(args);
  const copy = new Uint8Array(stdout).buffer;
  return new Float32Array(copy, 0, Math.floor(stdout.length / 4));
}

/** Duração, pico de amostra e silêncio inicial (primeira amostra acima de −60 dBFS). */
export function sampleStats(samples, silenceDb = -60) {
  const threshold = 10 ** (silenceDb / 20);
  let first = -1;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]);
    if (v > peak) peak = v;
    if (first < 0 && v > threshold) first = i;
  }
  return {
    duration: samples.length / 48000,
    leadingSilence: (first < 0 ? samples.length : first) / 48000,
    samplePeakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity,
  };
}

/** Volume integrado (LUFS), pico real (dBTP) e formato, pelo medidor EBU R128. */
export async function loudness(file) {
  const { stderr } = await ffmpeg([
    "-nostats",
    "-i",
    file,
    "-af",
    "ebur128=peak=true:framelog=quiet",
    "-f",
    "null",
    "-",
  ]);
  const summary = stderr.slice(stderr.lastIndexOf("Summary:"));
  const integrated = Number(/I:\s+(-?[\d.]+|-inf) LUFS/.exec(summary)?.[1]);
  const truePeak = Number(/Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(summary)?.[1]);
  const stream = /Stream #0:0[^:]*: Audio: (\w+)[^,]*, (\d+) Hz, ([\w.()]+)/.exec(stderr);
  return {
    integrated: Number.isFinite(integrated) && integrated > -69 ? integrated : null,
    truePeak: Number.isFinite(truePeak) ? truePeak : -Infinity,
    codec: stream?.[1] ?? null,
    sampleRate: stream ? Number(stream[2]) : null,
    channels: stream?.[3] ?? null,
  };
}

/** Primeira passada do loudnorm no sinal já cortado: o que ele mediu na entrada. */
export async function loudnormMeasure(file, filters, target, truePeak) {
  const chain = [...filters, `loudnorm=I=${target}:TP=${truePeak}:LRA=11:print_format=json`].join(",");
  const { stderr } = await ffmpeg(["-nostats", "-i", file, "-af", chain, "-f", "null", "-"]);
  const json = JSON.parse(stderr.slice(stderr.lastIndexOf("{"), stderr.lastIndexOf("}") + 1));
  const i = Number(json.input_i);
  return { integrated: Number.isFinite(i) && i > -69 ? i : null, truePeak: Number(json.input_tp) };
}
