import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { verify } from "./verify.mjs";
import { image, keyBlack, levels, fitRayCenter, rgbToLab } from "./operations.mjs";
import { readImage, encode, resize, png } from "./io.mjs";
import { colors, outputs, settings } from "./config.mjs";

test("three synthetic masters round-trip through Node IO, processing and WebP", async () => {
  const root = await mkdtemp(join(tmpdir(), "interativ-synthetic-"));
  try {
    for (const [id, kind] of ["OPACO", "CHAVE-PRETA", "MÁSCARA"].entries()) {
      const input = image(40, 32);
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 40; x++) {
          const value = kind === "OPACO" ? 40 : (x - 20) ** 2 + (y - 16) ** 2 < 100 ? 240 : 0;
          input.data.set([value, value, value, 255], (y * 40 + x) * 4);
        }
      const source = join(root, `${id}.png`);
      await writeFile(source, await png(input));
      let pixels = await readImage(source, { grayscale: kind === "MÁSCARA" });
      if (kind === "CHAVE-PRETA") pixels = keyBlack(pixels);
      if (kind === "MÁSCARA") pixels = levels(pixels, 60, 200);
      for (const factor of [1, 2]) {
        const output = join(root, `${id}-${factor}.webp`);
        await encode(await resize(pixels, 20 * factor, 16 * factor), output, {
          lossless: kind !== "OPACO",
          quality: 90,
        });
        const meta = await sharp(output).metadata();
        assert.equal(meta.width, 20 * factor);
        assert.equal(meta.height, 16 * factor);
        assert.equal(meta.format, "webp");
        const decoded = await readImage(output);
        if (kind === "CHAVE-PRETA") {
          assert.equal(decoded.data[3], 0);
          assert.ok(decoded.data[(8 * factor * 20 * factor + 10 * factor) * 4 + 3] > 0);
        }
        if (kind === "MÁSCARA") {
          assert.equal(decoded.data[0], 0);
          assert.equal(decoded.data[(8 * factor * 20 * factor + 10 * factor) * 4], 255);
        }
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ray intersection locates the empty spark origin independently of its bounding box", () => {
  const input = image(240, 200);
  const origin = [40, 100];
  for (const angle of [-0.7, 0, 0.7])
    for (let distance = 30; distance < 170; distance += 0.2) {
      const x = Math.round(origin[0] + Math.cos(angle) * distance),
        y = Math.round(origin[1] + Math.sin(angle) * distance);
      if (y >= 0 && y < input.height) input.data.set([255, 255, 255, 255], (y * input.width + x) * 4);
    }
  const fit = fitRayCenter(input);
  assert.ok(Math.hypot(fit.x - origin[0], fit.y - origin[1]) < 0.5);
});

test(
  "two complete builds are byte-identical, including registry, metrics and all contact sheets",
  { timeout: 240000 },
  async () => {
    const destination = await mkdtemp(join(tmpdir(), "interativ-determinism-"));
    try {
      const result = await verify(destination);
      const variantFiles = outputs.reduce((sum, output) => sum + Math.max(1, output.tints.length) * 2, 0);
      assert.equal(result.filesChecked, variantFiles + 14 + 3);
      assert.equal(result.first, result.second);
      const metrics = JSON.parse(
        await readFile(join(destination, "docs/capturas/lote-01/medidas.json"), "utf8"),
      );
      for (const item of metrics.outputs) {
        if (item.axesDifference !== null) assert.ok(item.axesDifference < 0.02, item.id);
        const spec = outputs.find((output) => output.id === item.id);
        if (spec.paper)
          item.delivered.mean.forEach((v, c) =>
            assert.ok(Math.abs(v - colors[spec.paper.token][c]) <= 2, item.id),
          );
        if (spec.mask) {
          assert.deepEqual(item.extrema, [0, 255]);
          assert.ok(item.delivered.transition >= spec.mask.minTransition);
        }
      }
      const paper = await readImage(join(destination, "public/assets/palco/paper-stage.webp"));
      const range = settings.paperLuminance.map((rgb) => rgbToLab(rgb)[0]);
      for (let p = 0; p < paper.data.length; p += 4) {
        const l = rgbToLab(Array.from(paper.data.subarray(p, p + 3)))[0];
        assert.ok(l >= range[0] && l <= range[1], `Decoded paper L=${l} is outside ${range}`);
      }
      const entry = await readImage(join(destination, "public/assets/entrada/scene-entry.webp"));
      for (let p = 0; p < entry.data.length; p += 4) {
        const a = entry.data[p + 3];
        assert.ok(a === 0 || a > 4);
        assert.ok(a === 255 || a < 248);
        if (a === 0) assert.deepEqual(Array.from(entry.data.subarray(p, p + 3)), [0, 0, 0]);
      }
    } finally {
      await rm(destination, { recursive: true, force: true });
    }
  },
);
