import type { LinkKind } from "@/model/types";

/** Nome de cada tipo de ligação na interface. */
export const LINK_LABEL: Record<LinkKind, string> = {
  screw: "Parafuso",
  axle: "Eixo",
  rod: "Haste",
  cable: "Cabo",
  mount: "Suporte elástico",
  slider: "Trilho",
  pin: "Pino",
  slot: "Rasgo-guia",
  spring: "Mola",
  chamber: "Câmara",
  sensor: "Sensor",
};
