// GERADO por npm run assets; não editar à mão.
export type AssetGroup = "palco" | "ferragens" | "molas" | "materiais" | "efeitos" | "entrada";
export type AssetTint = "ink" | "gold" | "stage" | "ink-2" | "ember";
export interface AssetSources {
  readonly x1: string;
  readonly x2: string;
}
export interface Asset {
  readonly id: string;
  readonly group: AssetGroup;
  readonly src: AssetSources;
  readonly width: number;
  readonly height: number;
  readonly anchor: { readonly x: number; readonly y: number };
  readonly mmPerPx: number | null;
  readonly repeat: "none" | "x" | "xy";
  readonly tints: readonly { readonly token: AssetTint; readonly src: AssetSources }[];
}
const url = (path: string): string => import.meta.env.BASE_URL + path;
export const assets = {
  "paper-stage": {
    id: "paper-stage",
    group: "palco",
    src: {
      x1: url("assets/palco/paper-stage.webp"),
      x2: url("assets/palco/paper-stage@2x.webp"),
    },
    width: 512,
    height: 512,
    anchor: {
      x: 0,
      y: 0,
    },
    mmPerPx: null,
    repeat: "xy",
    tints: [],
  },
  "paper-chrome": {
    id: "paper-chrome",
    group: "palco",
    src: {
      x1: url("assets/palco/paper-chrome.webp"),
      x2: url("assets/palco/paper-chrome@2x.webp"),
    },
    width: 512,
    height: 512,
    anchor: {
      x: 0,
      y: 0,
    },
    mmPerPx: null,
    repeat: "xy",
    tints: [],
  },
  "paper-surface": {
    id: "paper-surface",
    group: "palco",
    src: {
      x1: url("assets/palco/paper-surface.webp"),
      x2: url("assets/palco/paper-surface@2x.webp"),
    },
    width: 512,
    height: 512,
    anchor: {
      x: 0,
      y: 0,
    },
    mmPerPx: null,
    repeat: "xy",
    tints: [],
  },
  "hw-screw-slot": {
    id: "hw-screw-slot",
    group: "ferragens",
    src: {
      x1: url("assets/ferragens/hw-screw-slot.webp"),
      x2: url("assets/ferragens/hw-screw-slot@2x.webp"),
    },
    width: 256,
    height: 256,
    anchor: {
      x: 0.5009012672942612,
      y: 0.5004765762365386,
    },
    mmPerPx: 0.02552114272971297,
    repeat: "none",
    tints: [
      {
        token: "ink",
        src: {
          x1: url("assets/ferragens/hw-screw-slot.webp"),
          x2: url("assets/ferragens/hw-screw-slot@2x.webp"),
        },
      },
      {
        token: "gold",
        src: {
          x1: url("assets/ferragens/hw-screw-slot-gold.webp"),
          x2: url("assets/ferragens/hw-screw-slot-gold@2x.webp"),
        },
      },
    ],
  },
  "hw-screw-hex": {
    id: "hw-screw-hex",
    group: "ferragens",
    src: {
      x1: url("assets/ferragens/hw-screw-hex.webp"),
      x2: url("assets/ferragens/hw-screw-hex@2x.webp"),
    },
    width: 256,
    height: 256,
    anchor: {
      x: 0.5008608433058873,
      y: 0.5006671611296737,
    },
    mmPerPx: 0.025623213311087877,
    repeat: "none",
    tints: [
      {
        token: "ink",
        src: {
          x1: url("assets/ferragens/hw-screw-hex.webp"),
          x2: url("assets/ferragens/hw-screw-hex@2x.webp"),
        },
      },
      {
        token: "gold",
        src: {
          x1: url("assets/ferragens/hw-screw-hex-gold.webp"),
          x2: url("assets/ferragens/hw-screw-hex-gold@2x.webp"),
        },
      },
    ],
  },
  "hw-axle": {
    id: "hw-axle",
    group: "ferragens",
    src: {
      x1: url("assets/ferragens/hw-axle.webp"),
      x2: url("assets/ferragens/hw-axle@2x.webp"),
    },
    width: 256,
    height: 256,
    anchor: {
      x: 0.5006983954301089,
      y: 0.5006255386822855,
    },
    mmPerPx: 0.034141117337045356,
    repeat: "none",
    tints: [
      {
        token: "ink",
        src: {
          x1: url("assets/ferragens/hw-axle.webp"),
          x2: url("assets/ferragens/hw-axle@2x.webp"),
        },
      },
      {
        token: "gold",
        src: {
          x1: url("assets/ferragens/hw-axle-gold.webp"),
          x2: url("assets/ferragens/hw-axle-gold@2x.webp"),
        },
      },
    ],
  },
  "hw-pin": {
    id: "hw-pin",
    group: "ferragens",
    src: {
      x1: url("assets/ferragens/hw-pin.webp"),
      x2: url("assets/ferragens/hw-pin@2x.webp"),
    },
    width: 256,
    height: 256,
    anchor: {
      x: 0.5007618576269749,
      y: 0.5004530577436689,
    },
    mmPerPx: 0.01705390050465899,
    repeat: "none",
    tints: [
      {
        token: "ink",
        src: {
          x1: url("assets/ferragens/hw-pin.webp"),
          x2: url("assets/ferragens/hw-pin@2x.webp"),
        },
      },
      {
        token: "gold",
        src: {
          x1: url("assets/ferragens/hw-pin-gold.webp"),
          x2: url("assets/ferragens/hw-pin-gold@2x.webp"),
        },
      },
    ],
  },
  "hw-rivet": {
    id: "hw-rivet",
    group: "ferragens",
    src: {
      x1: url("assets/ferragens/hw-rivet.webp"),
      x2: url("assets/ferragens/hw-rivet@2x.webp"),
    },
    width: 256,
    height: 256,
    anchor: {
      x: 0.5009311435834692,
      y: 0.5002158805134622,
    },
    mmPerPx: 0.021184216495198707,
    repeat: "none",
    tints: [
      {
        token: "ink",
        src: {
          x1: url("assets/ferragens/hw-rivet.webp"),
          x2: url("assets/ferragens/hw-rivet@2x.webp"),
        },
      },
      {
        token: "gold",
        src: {
          x1: url("assets/ferragens/hw-rivet-gold.webp"),
          x2: url("assets/ferragens/hw-rivet-gold@2x.webp"),
        },
      },
    ],
  },
  "hw-bearing": {
    id: "hw-bearing",
    group: "ferragens",
    src: {
      x1: url("assets/ferragens/hw-bearing.webp"),
      x2: url("assets/ferragens/hw-bearing@2x.webp"),
    },
    width: 256,
    height: 256,
    anchor: {
      x: 0.5006643212399118,
      y: 0.5003561976862134,
    },
    mmPerPx: 0.04303334860983612,
    repeat: "none",
    tints: [
      {
        token: "ink",
        src: {
          x1: url("assets/ferragens/hw-bearing.webp"),
          x2: url("assets/ferragens/hw-bearing@2x.webp"),
        },
      },
      {
        token: "gold",
        src: {
          x1: url("assets/ferragens/hw-bearing-gold.webp"),
          x2: url("assets/ferragens/hw-bearing-gold@2x.webp"),
        },
      },
    ],
  },
  "hw-sensor": {
    id: "hw-sensor",
    group: "ferragens",
    src: {
      x1: url("assets/ferragens/hw-sensor.webp"),
      x2: url("assets/ferragens/hw-sensor@2x.webp"),
    },
    width: 256,
    height: 256,
    anchor: {
      x: 0.5002731391491616,
      y: 0.5007703307853454,
    },
    mmPerPx: 0.029277578747898176,
    repeat: "none",
    tints: [
      {
        token: "ink",
        src: {
          x1: url("assets/ferragens/hw-sensor.webp"),
          x2: url("assets/ferragens/hw-sensor@2x.webp"),
        },
      },
      {
        token: "gold",
        src: {
          x1: url("assets/ferragens/hw-sensor-gold.webp"),
          x2: url("assets/ferragens/hw-sensor-gold@2x.webp"),
        },
      },
    ],
  },
  "spring-coil": {
    id: "spring-coil",
    group: "molas",
    src: {
      x1: url("assets/molas/spring-coil.webp"),
      x2: url("assets/molas/spring-coil@2x.webp"),
    },
    width: 64,
    height: 256,
    anchor: {
      x: 0,
      y: 0.5,
    },
    mmPerPx: 0.04411764705882353,
    repeat: "x",
    tints: [
      {
        token: "ink",
        src: {
          x1: url("assets/molas/spring-coil.webp"),
          x2: url("assets/molas/spring-coil@2x.webp"),
        },
      },
      {
        token: "gold",
        src: {
          x1: url("assets/molas/spring-coil-gold.webp"),
          x2: url("assets/molas/spring-coil-gold@2x.webp"),
        },
      },
    ],
  },
  "spring-end": {
    id: "spring-end",
    group: "molas",
    src: {
      x1: url("assets/molas/spring-end.webp"),
      x2: url("assets/molas/spring-end@2x.webp"),
    },
    width: 156,
    height: 256,
    anchor: {
      x: 0.5899715741550708,
      y: 0.49318230321734174,
    },
    mmPerPx: 0.04411764705882353,
    repeat: "none",
    tints: [
      {
        token: "ink",
        src: {
          x1: url("assets/molas/spring-end.webp"),
          x2: url("assets/molas/spring-end@2x.webp"),
        },
      },
      {
        token: "gold",
        src: {
          x1: url("assets/molas/spring-end-gold.webp"),
          x2: url("assets/molas/spring-end-gold@2x.webp"),
        },
      },
    ],
  },
  "tex-ink-wear": {
    id: "tex-ink-wear",
    group: "materiais",
    src: {
      x1: url("assets/materiais/tex-ink-wear.webp"),
      x2: url("assets/materiais/tex-ink-wear@2x.webp"),
    },
    width: 256,
    height: 256,
    anchor: {
      x: 0,
      y: 0,
    },
    mmPerPx: null,
    repeat: "xy",
    tints: [
      {
        token: "stage",
        src: {
          x1: url("assets/materiais/tex-ink-wear.webp"),
          x2: url("assets/materiais/tex-ink-wear@2x.webp"),
        },
      },
    ],
  },
  "hatch-wood": {
    id: "hatch-wood",
    group: "materiais",
    src: {
      x1: url("assets/materiais/hatch-wood.webp"),
      x2: url("assets/materiais/hatch-wood@2x.webp"),
    },
    width: 256,
    height: 256,
    anchor: {
      x: 0,
      y: 0,
    },
    mmPerPx: null,
    repeat: "xy",
    tints: [
      {
        token: "ink-2",
        src: {
          x1: url("assets/materiais/hatch-wood.webp"),
          x2: url("assets/materiais/hatch-wood@2x.webp"),
        },
      },
    ],
  },
  "fx-gas-1": {
    id: "fx-gas-1",
    group: "efeitos",
    src: {
      x1: url("assets/efeitos/fx-gas-1.webp"),
      x2: url("assets/efeitos/fx-gas-1@2x.webp"),
    },
    width: 256,
    height: 256,
    anchor: {
      x: 0,
      y: 0,
    },
    mmPerPx: null,
    repeat: "xy",
    tints: [
      {
        token: "ink-2",
        src: {
          x1: url("assets/efeitos/fx-gas-1.webp"),
          x2: url("assets/efeitos/fx-gas-1@2x.webp"),
        },
      },
      {
        token: "ember",
        src: {
          x1: url("assets/efeitos/fx-gas-1-ember.webp"),
          x2: url("assets/efeitos/fx-gas-1-ember@2x.webp"),
        },
      },
    ],
  },
  "fx-gas-2": {
    id: "fx-gas-2",
    group: "efeitos",
    src: {
      x1: url("assets/efeitos/fx-gas-2.webp"),
      x2: url("assets/efeitos/fx-gas-2@2x.webp"),
    },
    width: 256,
    height: 256,
    anchor: {
      x: 0,
      y: 0,
    },
    mmPerPx: null,
    repeat: "xy",
    tints: [
      {
        token: "ink-2",
        src: {
          x1: url("assets/efeitos/fx-gas-2.webp"),
          x2: url("assets/efeitos/fx-gas-2@2x.webp"),
        },
      },
      {
        token: "ember",
        src: {
          x1: url("assets/efeitos/fx-gas-2-ember.webp"),
          x2: url("assets/efeitos/fx-gas-2-ember@2x.webp"),
        },
      },
    ],
  },
  "fx-gas-3": {
    id: "fx-gas-3",
    group: "efeitos",
    src: {
      x1: url("assets/efeitos/fx-gas-3.webp"),
      x2: url("assets/efeitos/fx-gas-3@2x.webp"),
    },
    width: 256,
    height: 256,
    anchor: {
      x: 0,
      y: 0,
    },
    mmPerPx: null,
    repeat: "xy",
    tints: [
      {
        token: "ink-2",
        src: {
          x1: url("assets/efeitos/fx-gas-3.webp"),
          x2: url("assets/efeitos/fx-gas-3@2x.webp"),
        },
      },
      {
        token: "ember",
        src: {
          x1: url("assets/efeitos/fx-gas-3-ember.webp"),
          x2: url("assets/efeitos/fx-gas-3-ember@2x.webp"),
        },
      },
    ],
  },
  "fx-exhaust": {
    id: "fx-exhaust",
    group: "efeitos",
    src: {
      x1: url("assets/efeitos/fx-exhaust.webp"),
      x2: url("assets/efeitos/fx-exhaust@2x.webp"),
    },
    width: 256,
    height: 204,
    anchor: {
      x: 0.06,
      y: 0.5,
    },
    mmPerPx: null,
    repeat: "none",
    tints: [],
  },
  "fx-spark-1": {
    id: "fx-spark-1",
    group: "efeitos",
    src: {
      x1: url("assets/efeitos/fx-spark-1.webp"),
      x2: url("assets/efeitos/fx-spark-1@2x.webp"),
    },
    width: 64,
    height: 71,
    anchor: {
      x: 0.5,
      y: 0.5,
    },
    mmPerPx: null,
    repeat: "none",
    tints: [
      {
        token: "ink",
        src: {
          x1: url("assets/efeitos/fx-spark-1.webp"),
          x2: url("assets/efeitos/fx-spark-1@2x.webp"),
        },
      },
    ],
  },
  "fx-spark-2": {
    id: "fx-spark-2",
    group: "efeitos",
    src: {
      x1: url("assets/efeitos/fx-spark-2.webp"),
      x2: url("assets/efeitos/fx-spark-2@2x.webp"),
    },
    width: 64,
    height: 91,
    anchor: {
      x: 0.5,
      y: 0.5,
    },
    mmPerPx: null,
    repeat: "none",
    tints: [
      {
        token: "ink",
        src: {
          x1: url("assets/efeitos/fx-spark-2.webp"),
          x2: url("assets/efeitos/fx-spark-2@2x.webp"),
        },
      },
    ],
  },
  "fx-spark-3": {
    id: "fx-spark-3",
    group: "efeitos",
    src: {
      x1: url("assets/efeitos/fx-spark-3.webp"),
      x2: url("assets/efeitos/fx-spark-3@2x.webp"),
    },
    width: 64,
    height: 66,
    anchor: {
      x: 0.5,
      y: 0.5,
    },
    mmPerPx: null,
    repeat: "none",
    tints: [
      {
        token: "ink",
        src: {
          x1: url("assets/efeitos/fx-spark-3.webp"),
          x2: url("assets/efeitos/fx-spark-3@2x.webp"),
        },
      },
    ],
  },
  "scene-entry": {
    id: "scene-entry",
    group: "entrada",
    src: {
      x1: url("assets/entrada/scene-entry.webp"),
      x2: url("assets/entrada/scene-entry@2x.webp"),
    },
    width: 512,
    height: 734,
    anchor: {
      x: 0.5,
      y: 0,
    },
    mmPerPx: null,
    repeat: "none",
    tints: [],
  },
  "mask-develop": {
    id: "mask-develop",
    group: "entrada",
    src: {
      x1: url("assets/entrada/mask-develop.webp"),
      x2: url("assets/entrada/mask-develop@2x.webp"),
    },
    width: 768,
    height: 512,
    anchor: {
      x: 0,
      y: 0,
    },
    mmPerPx: null,
    repeat: "none",
    tints: [],
  },
} as const satisfies Record<string, Asset>;
export type AssetId = keyof typeof assets;
