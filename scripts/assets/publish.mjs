import { mkdir, writeFile, stat, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { format } from "prettier";
import sharp from "sharp";
import { encode, readImage } from "./io.mjs";
import { tint, meanRgb, seamError, coverage, transitionWidth } from "./operations.mjs";
import { colors, settings } from "./config.mjs";

export async function publish(prepared, root) {
  const assets = {};
  const expected = new Set();
  for (const item of prepared) {
    const { spec, x1, x2 } = item;
    await mkdir(join(root, "public/assets", spec.group), { recursive: true });
    const variants = spec.tints.length ? spec.tints : [null];
    const files = [];
    for (const [index, token] of variants.entries()) {
      const id = index === 0 ? spec.id : `${spec.id}-${token}`;
      const src = { x1: `assets/${spec.group}/${id}.webp`, x2: `assets/${spec.group}/${id}@2x.webp` };
      const sizes = [];
      for (const [scale, input] of [
        ["x1", x1],
        ["x2", x2],
      ]) {
        const path = join(root, "public", src[scale]);
        const pixels = token ? tint(input, colors[token]) : input;
        await encode(pixels, path, { ...settings.webp, lossless: spec.format !== "OPACO" });
        expected.add(path);
        sizes.push((await stat(path)).size);
      }
      files.push({ token, src, bytes: { x1: sizes[0], x2: sizes[1] } });
    }
    assets[spec.id] = {
      id: spec.id,
      group: spec.group,
      src: files[0].src,
      width: x1.width,
      height: x1.height,
      anchor: { x: item.anchor[0], y: item.anchor[1] },
      mmPerPx: item.mmPerPx,
      repeat: spec.repeat,
      tints: files.filter((file) => file.token).map(({ token, src }) => ({ token, src })),
    };
    item.metrics.files = files;
    // Measure decoded delivery files, so compression is included in the report.
    const decoded = await readImage(join(root, "public", files[0].src.x1));
    item.metrics.delivered = {
      width: decoded.width,
      height: decoded.height,
      coverage: coverage(decoded, settings.alphaBounds),
    };
    if (spec.paper) item.metrics.delivered.mean = meanRgb(decoded);
    if (spec.repeat === "xy") item.metrics.delivered.seam = seamError(decoded);
    if (spec.mask) item.metrics.delivered.transition = transitionWidth(decoded);
  }
  // Remove stale generated WebP files only in the groups owned by this batch.
  for (const group of new Set(prepared.map((item) => item.spec.group))) {
    const directory = join(root, "public/assets", group);
    for (const name of await readdir(directory)) {
      const path = join(directory, name);
      if (name.endsWith(".webp") && !expected.has(path)) await rm(path);
    }
  }
  const code = `// GERADO por npm run assets; não editar à mão.
export type AssetGroup = "palco" | "ferragens" | "molas" | "materiais" | "efeitos" | "entrada";
export type AssetTint = ${[...new Set(prepared.flatMap((item) => item.spec.tints))].map((t) => JSON.stringify(t)).join(" | ")};
export interface AssetSources { readonly x1: string; readonly x2: string; }
export interface Asset {
 readonly id: string; readonly group: AssetGroup; readonly src: AssetSources;
 readonly width: number; readonly height: number;
 readonly anchor: { readonly x: number; readonly y: number };
 readonly mmPerPx: number | null; readonly repeat: "none" | "x" | "xy";
 readonly tints: readonly { readonly token: AssetTint; readonly src: AssetSources }[];
}
const url = (path: string): string => import.meta.env.BASE_URL + path;
export const assets = ${JSON.stringify(assets, null, 2).replace(/"(assets\/[^"\n]+)"/g, 'url("$1")')} as const satisfies Record<string, Asset>;
export type AssetId = keyof typeof assets;
`;
  await mkdir(join(root, "src/assets"), { recursive: true });
  await writeFile(
    join(root, "src/assets/registry.ts"),
    await format(code, { parser: "typescript", printWidth: 110 }),
  );
  const directory = join(root, "docs/capturas", settings.batch);
  await mkdir(directory, { recursive: true });
  const metrics = {
    library: sharp.versions,
    assetsBytes: 0,
    outputs: prepared.map((item) => ({ id: item.spec.id, ...item.metrics })),
  };
  for (const path of expected) metrics.assetsBytes += (await stat(path)).size;
  await writeFile(
    join(directory, "medidas.json"),
    await format(JSON.stringify(metrics), { parser: "json", printWidth: 110 }),
  );
  return metrics;
}
