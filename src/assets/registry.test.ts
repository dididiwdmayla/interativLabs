import { describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import sharp from "sharp";
import { assets, type Asset } from "./registry";

describe("lote 01 registry", () => {
  it("resolves all sources beneath a non-root BASE_URL", async () => {
    vi.resetModules();
    vi.stubEnv("BASE_URL", "/laboratorio/");
    try {
      const { assets: prefixed } = await import("./registry");
      for (const asset of Object.values(prefixed)) {
        for (const sources of [asset.src, ...asset.tints.map((tint) => tint.src)]) {
          expect(sources.x1.startsWith("/laboratorio/assets/")).toBe(true);
          expect(sources.x2.startsWith("/laboratorio/assets/")).toBe(true);
        }
      }
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
  it("declares 23 unique outputs and includes every tint at 1x/2x", async () => {
    expect(Object.keys(assets)).toHaveLength(23);
    for (const [id, entry] of Object.entries(assets)) {
      const asset: Asset = entry;
      expect(asset.id).toBe(id);
      expect(asset.anchor.x).toBeGreaterThanOrEqual(0);
      expect(asset.anchor.x).toBeLessThanOrEqual(1);
      expect(asset.anchor.y).toBeGreaterThanOrEqual(0);
      expect(asset.anchor.y).toBeLessThanOrEqual(1);
      if (asset.mmPerPx !== null) expect(asset.mmPerPx).toBeGreaterThan(0);
      for (const sources of [asset.src, ...asset.tints.map((tint) => tint.src)]) {
        for (const [key, factor] of [
          ["x1", 1],
          ["x2", 2],
        ] as const) {
          expect(sources[key].startsWith(import.meta.env.BASE_URL)).toBe(true);
          const relative = sources[key].slice(import.meta.env.BASE_URL.length);
          const meta = await sharp(join(process.cwd(), "public", relative)).metadata();
          expect(meta.format).toBe("webp");
          expect(meta.width).toBe(asset.width * factor);
          expect(meta.height).toBe(asset.height * factor);
        }
      }
    }
  });
});
