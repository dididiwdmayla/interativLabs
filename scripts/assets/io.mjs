import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { image } from "./operations.mjs";

sharp.concurrency(1);

export async function readImage(path) {
  if (path instanceof URL) path = fileURLToPath(path);
  const { data, info } = await sharp(path)
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return image(info.width, info.height, new Uint8Array(data));
}

export const pipeline = (input) =>
  sharp(Buffer.from(input.data), { raw: { width: input.width, height: input.height, channels: 4 } });

export async function resize(input, width, height) {
  const { data, info } = await pipeline(input)
    .resize({ width, height, fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return image(info.width, info.height, new Uint8Array(data));
}

export async function encode(input, path, { lossless = true, quality = 90, effort = 6 } = {}) {
  await pipeline(input).webp({ lossless, quality, effort }).toFile(path);
}

export async function png(input) {
  return pipeline(input).png().toBuffer();
}
