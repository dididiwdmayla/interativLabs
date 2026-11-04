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
  webp: { quality: 90, effort: 6 },
  paperLuminance: ["181C3D", "262C4D"].map((hex) => hex.match(/../g).map((v) => parseInt(v, 16))),
  contact: { maxBytes: 3_145_728, zoom: 4, opacity: 0.3, hardwareSizes: [256, 32, 24] },
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
  correction: { factor, measured: null },
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
  hardware("hw-screw-slot", 6),
  hardware("hw-screw-hex", 6),
  hardware("hw-axle", 8),
  hardware("hw-pin", 4),
  hardware("hw-rivet", 5),
  hardware("hw-bearing", 10),
  { ...hardware("hw-sensor", 6), scale: { mm: 6, measure: "hex-faces" }, anchor: { kind: "plunger" } },
  {
    ...spring("spring-coil", { kind: "fixed", value: [0, 0.5] }),
    coil: { periodRange: [210, 270], band: [0.42, 0.58], crossingRange: [260, 490], crop: null },
  },
  {
    ...spring("spring-end", { kind: "eye" }),
    end: { eyeRegion: [70, 135, 660, 730], phaseRange: [700, 1000], strip: 12, crop: null },
  },
  tile("tex-ink-wear", "materiais", ["stage"]),
  tile("hatch-wood", "materiais", ["ink-2"]),
  ...[1, 2, 3].map((density) => ({
    ...tile(`fx-gas-${density}`, "efeitos", ["ink-2", "ember"], "fx-gas"),
    gas: { fraction: [0.25, 0.5, 1][density - 1], seed: 104729 },
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
    anchor: { kind: "spark-center" },
    repeat: "none",
    tints: ["ink"],
    spark: { index, emptyThreshold: 8 },
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
