import { readFileSync } from "node:fs";

// Identity colors have one source: the application's existing CSS tokens.
const css = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");
export const colors = Object.fromEntries(
  [...css.matchAll(/--color-([\w-]+):\s*(#[\da-f]{6})/gi)].map(([, name, hex]) => [
    name,
    hex.match(/[\da-f]{2}/gi).map((channel) => Number.parseInt(channel, 16)),
  ]),
);

export const settings = {
  batch: "lote-01",
  black: 12,
  white: 235,
  minArea: 6,
  preserveDots: ["tex-ink-wear", "fx-gas", "hw-rivet"],
  alphaBounds: 8,
  contourThreshold: 128,
  padding: 0.04,
  crossfade: 0.08,
  webp: { quality: 90, effort: 6, exact: true },
  paperLuminance: ["181C3D", "262C4D"].map((hex) => hex.match(/../g).map((v) => parseInt(v, 16))),
  // Leave room for WebP quality-90 quantization inside the specified L range.
  paperLuminanceGuard: 0.5,
  contact: {
    maxBytes: 3_145_728,
    zoom: 4,
    opacity: 0.3,
    hardwareSizes: [256, 32, 24],
    width: 1200,
    margin: 28,
    heading: 64,
    font: 19,
    smallFont: 15,
    seamCrop: 64,
    alphaCrop: 32,
    hardwareRow: 360,
    hardwarePage: 4,
    springOverlap: 0.2,
    springRow: 450,
    hatchSpacing: 6,
    hatchStroke: 0.65,
    entryMin: 358,
    effectMin: 24,
    gasMin: 128,
    paperMin: 240,
  },
};

const hardware = (id, mm, factor = 1) => ({
  id,
  source: id,
  group: "ferragens",
  format: "CHAVE-PRETA",
  size: { axis: "width", x1: 256, x2: 512 },
  scale: { mm, measure: "circle-diameter" },
  anchor: { kind: "circle" },
  repeat: "none",
  tints: ["ink", "gold"],
  correction: { factor, measured: factor },
});
const tile = (id, group, tints, source = id) => ({
  id,
  source,
  group,
  format: "CHAVE-PRETA",
  size: { axis: "width", x1: 256, x2: 512 },
  scale: null,
  anchor: { kind: "fixed", value: [0, 0] },
  repeat: "xy",
  tints,
});
const paper = (id, token, variation) => ({
  id,
  source: "paper-stage",
  group: "palco",
  format: "OPACO",
  size: { axis: "width", x1: 512, x2: 1024 },
  scale: null,
  anchor: { kind: "fixed", value: [0, 0] },
  repeat: "xy",
  tints: [],
  paper: { token, variation },
});
const spring = (id, anchor) => ({
  id,
  source: id,
  group: "molas",
  format: "CHAVE-PRETA",
  size: { axis: "height", x1: 256, x2: 512 },
  scale: { mm: 6, measure: "coil-diameter" },
  anchor,
  repeat: id === "spring-coil" ? "x" : "none",
  tints: ["ink", "gold"],
});

// Twenty-three logical outputs. Tint files belong to their output, not to
// additional registry entries. Source IDs correspond exactly to manifest rows.
export const outputs = [
  paper("paper-stage", "stage", 1),
  paper("paper-chrome", "chrome", 0.5),
  paper("paper-surface", "surface", 0.6),
  hardware("hw-screw-slot", 6, 0.9832989947331693),
  hardware("hw-screw-hex", 6, 0.9796623452841596),
  hardware("hw-axle", 8, 0.978234153928781),
  hardware("hw-pin", 4, 0.9788652824059398),
  hardware("hw-rivet", 5, 0.9823608032561096),
  {
    ...hardware("hw-bearing", 10, 0.9695831079008016),
    anchor: { kind: "bore", ring: { center: [619, 621], radius: [150, 260], edge: "inner" } },
  },
  {
    ...hardware("hw-sensor", 6, 0.9417),
    scale: { mm: 6, measure: "hex-faces" },
    anchor: { kind: "plunger", ring: { center: [624, 624], radius: [245, 290] } },
  },
  {
    ...spring("spring-coil", { kind: "fixed", value: [0, 0.5] }),
    coil: {
      periodRange: [210, 270],
      band: [0.42, 0.58],
      crossingRange: [260, 490],
      measuredPeriod: 255.97397681816258,
      crop: { left: 323, top: 0, width: 256, height: 1024 },
    },
  },
  {
    ...spring("spring-end", { kind: "eye" }),
    end: {
      eyeRing: { center: [430, 505], radius: [280, 390], angles: [100, 260] },
      phaseRange: [680, 850],
      strip: 12,
      measuredCut: 707,
      crop: { left: 85, top: 0, width: 622, height: 1024 },
    },
  },
  tile("tex-ink-wear", "materiais", ["stage"]),
  tile("hatch-wood", "materiais", ["ink-2"]),
  ...[1, 2, 3].map((density) => ({
    ...tile(`fx-gas-${density}`, "efeitos", ["ink-2", "ember"], "fx-gas"),
    gas: { fraction: [0.25, 0.5, 1][density - 1], seed: 104729, crossfade: 0 },
  })),
  {
    id: "fx-exhaust",
    source: "fx-exhaust",
    group: "efeitos",
    format: "CHAVE-PRETA",
    size: { axis: "width", x1: 256, x2: 512 },
    scale: null,
    anchor: { kind: "root", value: [0.06, 0.5] },
    repeat: "none",
    tints: [],
    radial: { from: "ember", to: "ink", reach: 0.6 },
  },
  ...[1, 2, 3].map((index) => ({
    id: `fx-spark-${index}`,
    source: "fx-spark",
    group: "efeitos",
    format: "CHAVE-PRETA",
    size: { axis: "width", x1: 64, x2: 128 },
    scale: null,
    anchor: {
      kind: "spark-center",
      measured: [
        [192.1650831739459, 513.2043982906423],
        [713.8421202221123, 519.768951053655],
        [1246.3745184796314, 510.35504282029837],
      ][index - 1],
    },
    repeat: "none",
    tints: ["ink"],
    spark: { index, emptyThreshold: 8, minGap: 32 },
  })),
  {
    id: "scene-entry",
    source: "scene-entry",
    group: "entrada",
    format: "TRANSPARENTE",
    size: { axis: "width", x1: 512, x2: 1024 },
    scale: null,
    anchor: { kind: "fixed", value: [0.5, 0] },
    repeat: "none",
    tints: [],
    alpha: { low: 4, high: 248, unpremultiply: false },
  },
  {
    id: "mask-develop",
    source: "mask-develop",
    group: "entrada",
    format: "MÁSCARA",
    size: { axis: "width", x1: 768, x2: 1536 },
    scale: null,
    anchor: { kind: "fixed", value: [0, 0] },
    repeat: "none",
    tints: [],
    mask: { levels: [60, 200], fallback: [40, 220], minTransition: 0.06 },
  },
];

export const sourceIds = [...new Set(outputs.map((output) => output.source))].sort();
