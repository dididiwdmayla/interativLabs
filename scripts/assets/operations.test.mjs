import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { outputs, sourceIds, settings, colors } from "./config.mjs";
import {
  image,
  keyBlack,
  components,
  fitProportion,
  fitCircle,
  boundary,
  autocorrelation,
  crossfade,
  seamError,
  adjustLab,
  meanRgb,
  rgbToLab,
  thinComponents,
  coverage,
  levels,
  normalizeAlpha,
} from "./operations.mjs";

function synthetic(width, height, pixel) {
  const output = image(width, height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) output.data.set(pixel(x, y), (y * width + x) * 4);
  return output;
}

test("manifest table IDs and configured source IDs agree in both directions", async () => {
  const manifest = await readFile(
    new URL("../../art/source/lote-01/asset-manifest.md", import.meta.url),
    "utf8",
  );
  const ids = [
    ...manifest.matchAll(/^\| `([^`]+)` \| (?:palco|ferragens|molas|materiais|efeitos|entrada) \|/gm),
  ]
    .map((m) => m[1])
    .sort();
  assert.equal(ids.length, 17);
  assert.deepEqual(sourceIds, ids);
  const expected = ids
    .filter((id) => !["fx-gas", "fx-spark"].includes(id))
    .concat("paper-chrome", "paper-surface", ...[1, 2, 3].flatMap((n) => [`fx-gas-${n}`, `fx-spark-${n}`]))
    .sort();
  assert.deepEqual(outputs.map((o) => o.id).sort(), expected);
  assert.equal(new Set(outputs.map((o) => o.id)).size, 23);
  for (const output of outputs) for (const token of output.tints) assert.equal(colors[token].length, 3);
});

test("black key uses 12/235 and removes components below six pixels, with explicit exceptions", () => {
  const raw = synthetic(40, 12, (x, y) => {
    const v =
      y === 2 && x === 1
        ? 12
        : y === 2 && x === 3
          ? 235
          : y === 6 && x >= 2 && x < 7
            ? 235
            : y === 9 && x >= 2 && x < 8
              ? 235
              : 0;
    return [v, v, v, 255];
  });
  const keyed = keyBlack(raw);
  assert.equal(keyed.data[(2 * 40 + 1) * 4 + 3], 0);
  assert.equal(keyed.data[(2 * 40 + 3) * 4 + 3], 0);
  assert.equal(keyed.data[(6 * 40 + 2) * 4 + 3], 0);
  assert.equal(keyed.data[(9 * 40 + 2) * 4 + 3], 255);
  assert.deepEqual(settings.preserveDots, ["tex-ink-wear", "fx-gas", "hw-rivet"]);
  for (const id of settings.preserveDots) {
    const preserved = keyBlack(raw, { preserveDots: settings.preserveDots.includes(id) });
    assert.equal(preserved.data[(2 * 40 + 3) * 4 + 3], 255);
    assert.equal(preserved.data[(6 * 40 + 2) * 4 + 3], 255);
  }
});

test("least squares corrects a 2% taller ellipse and measures its off-center anchor", () => {
  const cx = 237.2,
    cy = 219.6,
    rx = 180,
    ry = 183.6;
  const ellipse = synthetic(500, 480, (x, y) => [
    255,
    255,
    255,
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 ? 255 : 0,
  ]);
  const points = boundary(ellipse);
  const fit = fitProportion(points);
  assert.ok(Math.abs(fit.factor - rx / ry) / (rx / ry) < 0.002);
  const corrected = fitCircle(points.map(([x, y]) => [x, y * fit.factor]));
  assert.ok(Math.abs(corrected.x - cx) < 0.5);
  assert.ok(Math.abs(corrected.y - cy * fit.factor) < 0.5);
});

test("autocorrelation recovers a nonintegral synthetic period within one pixel", () => {
  const period = 37.4;
  const signal = Array.from(
    { length: 800 },
    (_, x) => Math.sin((2 * Math.PI * x) / period) + 0.2 * Math.cos((4 * Math.PI * x) / period),
  );
  assert.ok(Math.abs(autocorrelation(signal, 25, 49).period - period) < 1);
});

test("seam crossfade reduces border jump below average interior jump", () => {
  const input = synthetic(100, 100, (x, y) => [20 + x + Math.sin(y) * 8, 30 + y, 60 + x / 2, 255]);
  assert.ok(seamError(input).ratio > 1);
  assert.ok(seamError(crossfade(input)).ratio < 1);
});

test("Lab mean adjustment preserves paper variation and bounds luminance", () => {
  const input = synthetic(80, 80, (x, y) => [
    33 + 4 * Math.sin(x),
    39 + 4 * Math.sin(y),
    68 + 3 * Math.cos(x + y),
    255,
  ]);
  const result = adjustLab(input, colors.stage, { luminance: settings.paperLuminance });
  meanRgb(result).forEach((v, c) => assert.ok(Math.abs(v - colors.stage[c]) <= 2));
  const low = rgbToLab(settings.paperLuminance[0])[0],
    high = rgbToLab(settings.paperLuminance[1])[0];
  let min = 100,
    max = 0;
  for (let i = 0; i < result.data.length; i += 4) {
    const l = rgbToLab(Array.from(result.data.subarray(i, i + 3)))[0];
    min = Math.min(min, l);
    max = Math.max(max, l);
  }
  assert.ok(min >= low - 0.4 && max <= high + 0.4);
  assert.ok(max - min > 1);
});

test("seeded thinning preserves the requested component fraction and is byte-identical", () => {
  const input = synthetic(100, 100, (x, y) => [255, 255, 255, x % 5 === 0 && y % 5 === 0 ? 255 : 0]);
  for (const fraction of [0.25, 0.5]) {
    const a = thinComponents(input, fraction, 104729),
      b = thinComponents(input, fraction, 104729);
    assert.ok(Math.abs((components(a.output).areas.length - 1) / a.count - fraction) < 0.02);
    assert.deepEqual(a.output.data, b.output.data);
    assert.ok(Math.abs(coverage(a.output).binary / coverage(input).binary - fraction) < 0.02);
  }
});

test("alpha normalization clears hidden RGB and levels reach both endpoints", () => {
  const input = synthetic(4, 1, (x) => [x * 80, x * 80, x * 80, [0, 4, 128, 248][x]]);
  const alpha = normalizeAlpha(input, { unpremultiply: true });
  assert.deepEqual(Array.from(alpha.data.slice(0, 8)), Array(8).fill(0));
  assert.equal(alpha.data[15], 255);
  assert.equal(alpha.data[8], 255);
  const mask = levels(input, 60, 200);
  assert.equal(mask.data[0], 0);
  assert.equal(mask.data[12], 255);
});
