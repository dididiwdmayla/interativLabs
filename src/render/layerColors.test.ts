import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Paleta provisória das camadas (tokens --layer-1 … --layer-16): OKLCH com a
 * mesma luminosidade, matizes longe do ouro e da brasa, contraste AA do
 * número (ink) sobre a face. Contas em sRGB pela conversão de Björn Ottosson.
 */
const css = readFileSync("src/styles/tokens.css", "utf8");

function oklchToLinear(L: number, C: number, h: number): [number, number, number] {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hexLum = (hex: string) => {
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(hex.slice(1 + i, 3 + i), 16) / 255));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const toOklch = (hex: string) => {
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(hex.slice(1 + i, 3 + i), 16) / 255)) as [
    number,
    number,
    number,
  ];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
};
const token = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim() ?? "";
const hueGap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe("paleta provisória das camadas", () => {
  const layers = Array.from({ length: 16 }, (_, i) => {
    const m = /oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/.exec(token(`layer-${i + 1}`));
    if (!m) throw new Error(`--layer-${i + 1} não está em OKLCH`);
    return { L: Number(m[1]) / 100, C: Number(m[2]), h: Number(m[3]) };
  });
  const gold = toOklch(token("color-gold"));
  const ember = toOklch(token("color-ember"));
  const ink = hexLum(token("color-ink"));

  it("16 cores com a mesma luminosidade e croma moderado", () => {
    expect(new Set(layers.map((c) => c.L)).size).toBe(1);
    for (const c of layers) expect(c.C).toBeLessThanOrEqual(0.09);
  });
  it("matizes longe do ouro e da brasa, e vizinhas bem diferentes", () => {
    for (const c of layers) {
      expect(hueGap(c.h, gold)).toBeGreaterThanOrEqual(40);
      expect(hueGap(c.h, ember)).toBeGreaterThanOrEqual(40);
    }
    for (let i = 1; i < layers.length; i++)
      expect(hueGap(layers[i]!.h, layers[i - 1]!.h)).toBeGreaterThanOrEqual(60);
  });
  it("contraste AA do número (ink) sobre a face", () => {
    for (const c of layers) {
      const rgb = oklchToLinear(c.L, c.C, c.h);
      for (const x of rgb) expect(x).toBeGreaterThanOrEqual(-1e-3);
      const y = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      expect((ink + 0.05) / (y + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
