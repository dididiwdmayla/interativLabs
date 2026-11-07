#!/usr/bin/env node
// Pipeline de áudio: art/source/som-NN/*.zip (originais + sound-manifest.md)
//   → .cache/audio-src/ (extraído, ignorado pelo git)
//   → public/audio/<id>.m4a (música: AAC 128 kbps, estéreo, 48 kHz, faststart)
//   → public/audio/<id>.wav (efeitos: PCM 16 bits mono, 48 kHz, com dither)
//   → src/assets/audio-registry.ts (GERADO, tipado)
//   → docs/capturas/som-01/medidas.md
//
// Volume: o loudnorm mede cada asset já cortado (primeira passada); a segunda aplica um
// único ganho linear até o alvo, limitado pelo pico real de −1,5 dBTP. A saída é medida
// de novo com o ebur128. Efeitos de 0,3 s são normalizados pelo pico (curtos demais para
// LUFS integrado). Cortes e fades do manifesto são aplicados uma vez, aqui.
//
// Uso: npm run audio
//      npm run audio -- --registry-only   reescreve o registro a partir dos arquivos
//                                         já convertidos, sem converter nada
//      npm run audio -- --only=id1,id2    converte só esses (não regenera registro nem medidas)

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import * as prettier from "prettier";
import { AUDIO, FORMATS, PEAK_MARGIN, PEAK_TARGETS, SEAM, TARGETS, TRUE_PEAK } from "./config.mjs";
import { decode, ffmpeg, loudness, loudnormMeasure, sampleStats } from "./ffmpeg.mjs";
import { seamReport } from "./seams.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = path.join(ROOT, "art/source");
const CACHE = path.join(ROOT, ".cache/audio-src");
export const OUT_AUDIO = path.join(ROOT, "public/audio");
const OUT_REGISTRY = path.join(ROOT, "src/assets/audio-registry.ts");
const OUT_REPORT = path.join(ROOT, "docs/capturas/som-01/medidas.md");

const args = process.argv.slice(2);
const registryOnly = args.includes("--registry-only");
const only = args
  .find((a) => a.startsWith("--only="))
  ?.slice(7)
  .split(",");

const round3 = (v) => Math.round(v * 1000) / 1000;
const outputFile = (cfg) => path.join(OUT_AUDIO, `${cfg.id}.${FORMATS[cfg.kind].ext}`);
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

/** Alvo do asset: { mode: "lufs" | "peak", value }. */
export function targetOf(cfg) {
  if (cfg.peak) return { mode: "peak", value: PEAK_TARGETS[cfg.peak] };
  return { mode: "lufs", value: TARGETS[cfg.level] };
}

/** Extrai cada zip uma vez em .cache/audio-src/<lote>/<zip>/; um carimbo de hash evita repetir. */
async function extract(lot, zip) {
  const zipPath = path.join(SOURCE, lot, zip);
  if (!existsSync(zipPath)) throw new Error(`original não encontrado: ${path.relative(ROOT, zipPath)}`);
  const dir = path.join(CACHE, lot, zip.replace(/\.zip$/, ""));
  const data = await readFile(zipPath);
  const hash = sha(data);
  const stamp = path.join(dir, ".stamp");
  if (existsSync(stamp) && (await readFile(stamp, "utf8")) === hash) return dir;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const files = unzipSync(new Uint8Array(data), {
    filter: (f) => !f.name.endsWith("/") && !f.name.startsWith("__MACOSX"),
  });
  for (const [name, bytes] of Object.entries(files))
    await writeFile(path.join(dir, path.basename(name)), bytes);
  await writeFile(stamp, hash);
  console.log(`  extraído ${lot}/${zip} (${Object.keys(files).length} arquivos)`);
  return dir;
}

/** A configuração e o manifesto do zip precisam listar os mesmos IDs. */
async function checkManifest(dir) {
  const text = await readFile(path.join(dir, "sound-manifest.md"), "utf8");
  const ids = [...text.matchAll(/^\| (music-[\w-]+|sfx-[\w-]+) \|/gm)].map((m) => m[1]).sort();
  const cfg = AUDIO.map((a) => a.id).sort();
  if (JSON.stringify(ids) !== JSON.stringify(cfg))
    throw new Error(`IDs do manifesto e de config.mjs diferem:\n  manifesto: ${ids}\n  config: ${cfg}`);
}

/** Cortes e fades, na linha do tempo do arquivo convertido. */
function editFilters(cfg, originalDuration) {
  const start = cfg.cut?.start ?? 0;
  const end = Math.min(cfg.cut?.end ?? originalDuration, originalDuration);
  const filters = [];
  if (start > 0 || end < originalDuration) {
    filters.push(`atrim=start=${start}:end=${end}`, "asetpts=PTS-STARTPTS");
  }
  if (cfg.fadeOut) filters.push(`afade=t=out:st=${round3(end - start - cfg.fadeOut)}:d=${cfg.fadeOut}`);
  return { filters, start, end };
}

function encoding(cfg) {
  const f = FORMATS[cfg.kind];
  if (cfg.kind === "sfx") {
    // Dither triangular na descida para 16 bits.
    return {
      filters: [`aresample=${f.sampleRate}:osf=s16:dither_method=triangular`],
      args: ["-ac", String(f.channels), "-c:a", f.codec],
    };
  }
  return {
    filters: [`aresample=${f.sampleRate}`],
    args: ["-ac", String(f.channels), "-c:a", f.codec, "-b:a", f.bitrate, "-movflags", "+faststart"],
  };
}

async function convert(cfg, file, gainDb, filters) {
  const out = outputFile(cfg);
  const enc = encoding(cfg);
  const chain = [...filters, `volume=${gainDb.toFixed(3)}dB`, ...enc.filters].join(",");
  // bitexact: sem versão do codificador nem datas nos metadados: a mesma saída a cada rodada.
  await ffmpeg([
    "-y",
    "-i",
    file,
    "-map_metadata",
    "-1",
    "-fflags",
    "+bitexact",
    "-flags:a",
    "+bitexact",
    "-vn",
    "-af",
    chain,
    ...enc.args,
    out,
  ]);
  return out;
}

async function measureFile(file) {
  const [samples, loud, bytes] = await Promise.all([decode(file), loudness(file), readFile(file)]);
  return { ...sampleStats(samples), ...loud, bytes: bytes.length, sha: sha(bytes), samples };
}

async function processAsset(cfg, gains) {
  const dir = await extract(cfg.source.lot, cfg.source.zip);
  const file = path.join(dir, cfg.source.entry);
  if (!existsSync(file)) throw new Error(`${cfg.id}: ${cfg.source.entry} não está em ${cfg.source.zip}`);
  const original = sampleStats(await decode(file));
  const { filters, start } = editFilters(cfg, original.duration);
  const target = targetOf(cfg);

  const ref = target.mode === "lufs" ? target.value : -24;
  const input = await loudnormMeasure(file, filters, ref, TRUE_PEAK);
  if (input.integrated == null && target.mode === "lufs" && filters.length) {
    // Depois do corte sobra menos de 0,4 s, o mínimo do medidor. O trecho cortado é só
    // ruído de fundo a −69 dB, que não pesa no volume: mede o original inteiro.
    input.integrated = (await loudnormMeasure(file, [], ref, TRUE_PEAK)).integrated;
  }
  let gain;
  if (cfg.matchGainOf) {
    gain = gains[cfg.matchGainOf];
    if (gain == null) throw new Error(`${cfg.id}: ${cfg.matchGainOf} precisa ser convertido antes`);
  } else if (target.mode === "peak") {
    gain = target.value - input.truePeak;
  } else {
    if (input.integrated == null) throw new Error(`${cfg.id}: curto demais para LUFS; use \`peak\``);
    gain = target.value - input.integrated;
  }
  // Teto de pico, com folga para a sobra do codificador.
  const ceiling = TRUE_PEAK - PEAK_MARGIN[cfg.kind] - input.truePeak;
  const limited = gain > ceiling;
  if (limited) gain = ceiling;

  let out = await convert(cfg, file, gain, filters);
  let m = await measureFile(out);
  if (m.truePeak > TRUE_PEAK) {
    gain -= m.truePeak - TRUE_PEAK + 0.1;
    out = await convert(cfg, file, gain, filters);
    m = await measureFile(out);
  }
  gains[cfg.id] = gain;
  const note = { gain, limited, cutStart: start, inputLufs: input.integrated, inputPeak: input.truePeak };
  const loud = m.integrated == null ? "curto" : `${m.integrated.toFixed(1)} LUFS`;
  console.log(
    `  ✓ ${cfg.id.padEnd(19)} ${m.duration.toFixed(2).padStart(7)} s ${loud.padStart(11)}  pico ${m.truePeak.toFixed(1)} dBTP  ganho ${gain >= 0 ? "+" : ""}${gain.toFixed(1)} dB${limited ? " (limitado pelo pico)" : ""}`,
  );
  return { measured: m, note };
}

/** Laço no tempo do arquivo convertido (corte inicial descontado). */
function loopOf(cfg, cutStart) {
  if (!cfg.loop) return null;
  return {
    start: round3(cfg.loop.start - cutStart),
    end: round3(cfg.loop.end - cutStart),
    crossfade: cfg.loop.crossfade,
  };
}

function entryFor(cfg, m, cutStart) {
  const target = targetOf(cfg);
  return {
    id: cfg.id,
    kind: cfg.kind,
    bus: cfg.kind === "music" ? "music" : "effects",
    src: `/audio/${path.basename(outputFile(cfg))}`,
    duration: round3(m.duration),
    loop: loopOf(cfg, cutStart),
    target: { mode: target.mode, value: target.value },
    use: cfg.use,
    on: cfg.on,
    gain: round3(10 ** (cfg.gainDb / 20)),
    bytes: m.bytes,
  };
}

async function registrySource(entries) {
  const union = (list) => list.map((e) => JSON.stringify(e.id)).join(" | ") || "never";
  const body = entries.map((e) => `  ${JSON.stringify(e.id)}: ${JSON.stringify(e)},`).join("\n");
  const src = `// GERADO por scripts/audio/build.mjs (npm run audio); não editar à mão.
// Tempos em segundos no arquivo convertido (o corte inicial já foi descontado).

export type AudioId = ${union(entries)};
export type MusicId = ${union(entries.filter((e) => e.kind === "music"))};
export type SfxId = ${union(entries.filter((e) => e.kind === "sfx"))};

export interface AudioLoop {
  /** Trecho repetido, s */
  start: number;
  end: number;
  /** Crossfade de potência constante na emenda, s */
  crossfade: number;
}

export interface AudioEntry {
  id: AudioId;
  kind: "music" | "sfx";
  bus: "music" | "effects";
  /** URL no mesmo servidor, sob /audio/ */
  src: string;
  /** duração medida do arquivo convertido, s */
  duration: number;
  loop: AudioLoop | null;
  /** alvo de volume: LUFS integrado ou pico real (dBTP) nos efeitos curtos */
  target: { mode: "lufs" | "peak"; value: number };
  use: string;
  /** quando ganha gatilho: S = Parte S da Fase 1; M2, M3, M4 = Mecânica 2.0 (sem gatilho ainda) */
  on: "S" | "M2" | "M3" | "M4";
  /** ganho fino linear, de \`gainDb\` em scripts/audio/config.mjs */
  gain: number;
  bytes: number;
}

export const audio: Record<AudioId, AudioEntry> = {
${body}
};

export const audioIds = Object.keys(audio) as AudioId[];
export const sfxIds = audioIds.filter((id): id is SfxId => audio[id].kind === "sfx");
`;
  const config = (await prettier.resolveConfig(OUT_REGISTRY)) ?? {};
  return prettier.format(src, { ...config, parser: "typescript" });
}

const fmt = (v, d = 1) => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(d).replace(".", ","));

function reportMarkdown(rows, seams) {
  const lines = [
    "# Som · lote som-01 — medidas dos arquivos convertidos",
    "",
    "Gerado por `npm run audio`. Volume integrado e pico real pelo medidor EBU R128 (`ebur128=peak=true`) do ffmpeg, sobre o arquivo convertido; silêncio inicial até a primeira amostra acima de −60 dBFS. Alvos do manifesto: fundo −24 LUFS, médio −20, teto −18, sutil −24, sutil (mínimo) −28; efeitos de 0,3 s pelo pico (sutil −10 dBTP, mínimo −14 dBTP). Pico real máximo de saída: " +
      `${fmt(TRUE_PEAK)} dBTP.`,
    "",
    'Δ é o medido menos o alvo. "Pico" na coluna Limite marca o asset cujo ganho parou no teto de pico antes de chegar ao alvo de volume: o número fica abaixo do alvo e é o que o arquivo pode dar sem distorcer.',
    "",
    "| ID | Formato | Duração (s) | LUFS | Alvo | Δ (LU) | Pico real (dBTP) | Ganho (dB) | Limite | Silêncio inicial (ms) | Tamanho | sha256 |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- |",
  ];
  let total = 0;
  for (const { cfg, m, note } of rows) {
    const t = targetOf(cfg);
    const peakMode = t.mode === "peak";
    const alvo = peakMode ? `${fmt(t.value)} dBTP` : `${fmt(t.value)} LUFS`;
    const delta = peakMode ? m.truePeak - t.value : m.integrated == null ? null : m.integrated - t.value;
    total += m.bytes;
    lines.push(
      `| ${cfg.id} | ${m.codec ?? "?"} ${m.sampleRate ? m.sampleRate / 1000 : "?"} kHz ${m.channels ?? ""} | ${fmt(m.duration, 3)} | ${m.integrated == null ? "curto" : fmt(m.integrated)} | ${alvo} | ${fmt(delta)} | ${fmt(m.truePeak)} | ${note ? (note.gain >= 0 ? "+" : "") + fmt(note.gain) : "—"} | ${note?.limited ? "pico" : cfg.matchGainOf ? `par de ${cfg.matchGainOf.slice(4)}` : ""} | ${fmt(m.leadingSilence * 1000)} | ${fmt(m.bytes / 1024, 0)} KB | ${m.sha.slice(0, 12)} |`,
    );
  }
  lines.push("", `Total: ${fmt(total / 1024 / 1024, 2)} MB em ${rows.length} arquivos.`, "");
  lines.push(
    "## Emendas de laço",
    "",
    `Salto: diferença de energia (RMS) entre a janela que termina no fim do laço e a que começa no início (janela de ${fmt(SEAM.window * 1000, 0)} ms na música, 50 ms na vazão). Oscilação: maior desvio, em blocos de 100 ms (20 ms na vazão), da energia do crossfade de potência constante em relação à média das duas partes. Aceite: salto ≤ ${fmt(SEAM.maxDiffDb)} dB; oscilação ≤ 3,5 dB.`,
    "",
    "| ID | Laço (s) | Crossfade (s) | Antes (dB) | Depois (dB) | Salto (dB) | Oscilação (dB) | Resultado |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
  );
  for (const s of seams) {
    const ok = s.jumpDb <= SEAM.maxDiffDb && s.dipDb <= 3.5;
    lines.push(
      `| ${s.id} | ${fmt(s.loop.start, 3)} → ${fmt(s.loop.end, 3)} | ${fmt(s.loop.crossfade, 3)} | ${fmt(s.beforeDb)} | ${fmt(s.afterDb)} | ${fmt(s.jumpDb, 2)} | ${fmt(s.dipDb, 2)} | ${ok ? "sem salto" : "REPROVADO"} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  await mkdir(OUT_AUDIO, { recursive: true });
  const dir = await extract(AUDIO[0].source.lot, AUDIO[0].source.zip);
  await checkManifest(dir);
  const known = new Set(AUDIO.map((a) => path.basename(outputFile(a))));
  if (!only) for (const f of await readdir(OUT_AUDIO)) if (!known.has(f)) await rm(path.join(OUT_AUDIO, f));
  console.log(`áudio: ${AUDIO.length} assets na configuração`);

  const gains = {};
  const results = {};
  // o par que empresta o ganho de outro vem depois dele
  const order = [...AUDIO].sort((a, b) => Number(!!a.matchGainOf) - Number(!!b.matchGainOf));
  for (const cfg of order) {
    if (registryOnly || (only && !only.includes(cfg.id))) {
      if (!existsSync(outputFile(cfg)))
        throw new Error(`${cfg.id}: arquivo convertido ausente; rode \`npm run audio\``);
      results[cfg.id] = { measured: await measureFile(outputFile(cfg)), note: null };
      continue;
    }
    results[cfg.id] = await processAsset(cfg, gains);
  }
  if (only) {
    console.log("--only: registro e medidas não foram regenerados; rode `npm run audio` completo.");
    return;
  }
  const cutStart = (cfg) => cfg.cut?.start ?? 0;
  const entries = AUDIO.map((a) => entryFor(a, results[a.id].measured, cutStart(a)));
  await writeFile(OUT_REGISTRY, await registrySource(entries));
  console.log(`registro: ${entries.length} assets → ${path.relative(ROOT, OUT_REGISTRY)}`);
  if (registryOnly) return;

  const seams = AUDIO.filter((a) => a.loop).map((a) => {
    const loop = loopOf(a, cutStart(a));
    const window = a.kind === "music" ? SEAM.window : 0.05;
    return { id: a.id, loop, ...seamReport(results[a.id].measured.samples, loop, window) };
  });
  const rows = AUDIO.map((cfg) => ({ cfg, m: results[cfg.id].measured, note: results[cfg.id].note }));
  await mkdir(path.dirname(OUT_REPORT), { recursive: true });
  await writeFile(OUT_REPORT, reportMarkdown(rows, seams));
  console.log(`medidas → ${path.relative(ROOT, OUT_REPORT)}`);
  const bad = seams.filter((s) => s.jumpDb > SEAM.maxDiffDb || s.dipDb > 3.5);
  if (bad.length) console.warn(`ATENÇÃO: emenda fora do aceite em ${bad.map((s) => s.id).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
