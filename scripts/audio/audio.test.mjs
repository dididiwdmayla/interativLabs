import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import { AUDIO, FORMATS, SEAM, TRUE_PEAK } from "./config.mjs";
import { seamReport } from "./seams.mjs";

const root = new URL("../../", import.meta.url);
const registry = readFileSync(new URL("src/assets/audio-registry.ts", root), "utf8");

test("todo asset da configuração tem arquivo convertido e entrada no registro", () => {
  for (const cfg of AUDIO) {
    const file = new URL(`public/audio/${cfg.id}.${FORMATS[cfg.kind].ext}`, root);
    assert.ok(existsSync(file), `${cfg.id}: arquivo ausente`);
    assert.ok(statSync(file).size > 1000, `${cfg.id}: arquivo pequeno demais`);
    assert.ok(registry.includes(`"${cfg.id}": {`), `${cfg.id}: sem entrada no registro`);
  }
});

test("a configuração tem 1 música e 25 efeitos; 20 com gatilho na Parte S", () => {
  assert.equal(AUDIO.filter((a) => a.kind === "music").length, 1);
  assert.equal(AUDIO.filter((a) => a.kind === "sfx").length, 25);
  assert.equal(AUDIO.filter((a) => a.kind === "sfx" && a.on === "S").length, 20);
});

test("os laços ficam dentro do arquivo e o crossfade cabe antes do início", () => {
  for (const cfg of AUDIO.filter((a) => a.loop)) {
    const cut = cfg.cut?.start ?? 0;
    const { start, end, crossfade } = cfg.loop;
    assert.ok(end > start, cfg.id);
    assert.ok(start - cut >= crossfade, `${cfg.id}: crossfade não cabe antes do início do laço`);
  }
});

test("o par tic/tac usa o mesmo ganho", () => {
  assert.equal(AUDIO.find((a) => a.id === "sfx-clock-tac").matchGainOf, "sfx-clock-tic");
});

test("a emenda de um tom contínuo periódico não tem salto nem oscilação", () => {
  const rate = 48000;
  const x = new Float32Array(rate * 4);
  for (let i = 0; i < x.length; i++) x[i] = 0.2 * Math.sin((2 * Math.PI * 100 * i) / rate);
  const r = seamReport(x, { start: 1, end: 3, crossfade: 0.5 }, 0.25);
  assert.ok(r.jumpDb < 0.1, `salto ${r.jumpDb}`);
  assert.ok(r.dipDb < SEAM.maxDiffDb + 2, `oscilação ${r.dipDb}`);
});

test("a emenda de energias diferentes é reprovada", () => {
  const rate = 48000;
  const x = new Float32Array(rate * 4);
  for (let i = 0; i < x.length; i++)
    x[i] = (i < rate * 2 ? 0.5 : 0.05) * Math.sin((2 * Math.PI * 100 * i) / rate);
  const r = seamReport(x, { start: 1, end: 3, crossfade: 0.5 }, 0.25);
  assert.ok(r.jumpDb > SEAM.maxDiffDb);
});

test("o pico real de saída é −1,5 dBTP", () => {
  assert.equal(TRUE_PEAK, -1.5);
});
