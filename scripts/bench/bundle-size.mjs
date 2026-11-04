/**
 * Tamanho dos motores no build (JS + WASM, gzip nível 9). Rode depois de
 * `npm run build`. Grava docs/decisoes/bundle-size.json.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const DIR = "dist/_app";
const files = readdirSync(DIR);
const size = (f) => {
  const buf = readFileSync(`${DIR}/${f}`);
  return { raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length };
};
const pick = (re) => files.filter((f) => re.test(f));
const groups = {
  planck: { js: pick(/^engine-planck-.*\.js$/), wasm: [] },
  "rapier-det": { js: pick(/^engine-rapier-det-.*\.js$/), wasm: [] },
  rapier: { js: pick(/^engine-rapier-[^d].*\.js$|^engine-rapier-d[^e].*\.js$/), wasm: [] },
  box2d: { js: pick(/^engine-box2d-.*\.js$/), wasm: pick(/^Box2D\.compat-.*\.wasm$/) },
  "comum (bancada, geometria, runtime)": {
    js: [...pick(/^runtime-.*\.js$/), ...pick(/^bench\.worker-.*\.js$/)],
    wasm: [],
  },
  "app principal": { js: pick(/^index-.*\.js$/), wasm: [] },
};
const out = {};
for (const [k, g] of Object.entries(groups)) {
  const js = g.js.map(size);
  const wasm = g.wasm.map(size);
  const sum = (list, key) => list.reduce((s, x) => s + x[key], 0);
  out[k] = {
    files: [...g.js, ...g.wasm],
    js: sum(js, "raw"),
    wasm: sum(wasm, "raw"),
    gzip: sum(js, "gzip") + sum(wasm, "gzip"),
  };
}
writeFileSync("docs/decisoes/bundle-size.json", JSON.stringify(out, null, 2) + "\n");
const kb = (n) => (n / 1024).toFixed(1).replace(".", ",");
console.log("| Pacote | JS (KB) | WASM (KB) | gzip total (KB) |\n| --- | --- | --- | --- |");
for (const [k, v] of Object.entries(out))
  console.log(`| ${k} | ${kb(v.js)} | ${kb(v.wasm)} | ${kb(v.gzip)} |`);
