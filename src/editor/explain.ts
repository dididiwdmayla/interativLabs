import type { LinkKind } from "@/model/types";

export const EXPLAIN: Record<LinkKind, { text: string; animation: LinkKind }> = {
  screw: {
    text: "Prende duas peças para que se movam juntas, sem folga entre elas. No fundo, mantém a peça parada, como o parafuso de uma dobradiça.",
    animation: "screw",
  },
  axle: {
    text: "Deixa uma peça girar em torno de um ponto, sem escapar dele. É o que faz o eixo de uma tesoura.",
    animation: "axle",
  },
  pin: {
    text: "É um pequeno cilindro preso a uma peça que alcança outras camadas. Pode empurrar outra peça ou correr num rasgo, como o pino de uma fechadura.",
    animation: "pin",
  },
  slot: {
    text: "Guia um pino pelo caminho de um recorte. As paredes seguram o pino de lado, como num fecho com rasgo alongado.",
    animation: "slot",
  },
  slider: {
    text: "Deixa a peça correr numa direção, entre dois batentes. Funciona como o trilho de uma gaveta.",
    animation: "slider",
  },
  rod: {
    text: "Mantém a distância entre duas pontas, mas deixa as juntas girarem. Transmite empurrões e puxões, como a haste de uma manivela.",
    animation: "rod",
  },
  cable: {
    text: "Puxa quando está esticado e fica frouxo quando as pontas se aproximam. Como uma corda de varal, não consegue empurrar.",
    animation: "cable",
  },
  mount: {
    text: "Segura uma peça com um pouco de movimento elástico. Cede à força e procura voltar ao lugar, como um apoio de borracha sob uma máquina.",
    animation: "mount",
  },
  spring: {
    text: "Guarda energia quando é comprimida ou esticada e a devolve ao soltar, como a mola de uma caneta. Quando só está apoiada, pode sair do assento: o apoio não prende a ponta.",
    animation: "spring",
  },
  lock: {
    text: "Segura duas peças até receber o comando de soltar. Ao abrir, libera o movimento, como o trinco de uma caixa.",
    animation: "lock",
  },
  chamber: {
    text: "O gás empurra as paredes da câmara em sentidos opostos. Uma parede pode avançar enquanto a outra recua, como num pistão pneumático didático.",
    animation: "chamber",
  },
  sensor: {
    text: "Percebe uma peça entrando na sua zona com velocidade suficiente. Pode disparar uma ação, como um sensor que abre uma porta automática.",
    animation: "sensor",
  },
};
