import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { image } from "./operations.mjs";

sharp.concurrency(1);

export async function readImage(path, { grayscale = false } = {}) {
  if (path instanceof URL) path = fileURLToPath(path);
  if (grayscale) {
    const { data, info } = await sharp(path)
      .removeAlpha()
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const output = image(info.width, info.height);
    for (let p = 0; p < info.width * info.height; p++)
      output.data.set([data[p], data[p], data[p], 255], p * 4);
    return output;
  }
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

export async function encode(input, path, { lossless = true, quality = 90, effort = 6, exact = true } = {}) {
  await pipeline(input).webp({ lossless, quality, effort, exact }).toFile(path);
}

export async function png(input) {
  return pipeline(input).png().toBuffer();
}
