import type { LinkKind } from "@/model/types";

/**
 * Cartões "o que é" (Parte E2d): para cada ligação, no máximo três frases
 * curtas em português claro, com um exemplo de mecanismo real genérico. A
 * animação que acompanha cada cartão fica em src/ui/ExplainArt.tsx.
 */
export interface Explain {
  title: string;
  /** até três frases */
  text: string[];
  /** o que a animação mostra (texto alternativo) */
  shows: string;
}

/** As ligações e as peças com "O que é?" próprio (a cápsula, Fase 2 · M2a). */
export type ExplainKind = LinkKind | "capsule";

export const EXPLAIN: Record<ExplainKind, Explain> = {
  screw: {
    title: "Parafuso",
    text: [
      "Une duas peças num corpo só: uma não se mexe em relação à outra.",
      "Preso ao fundo, a peça fica parada na bancada.",
      "É o parafuso que prende a lâmina ao cabo de uma plaina.",
    ],
    shows: "duas chapas aparafusadas andando juntas",
  },
  axle: {
    title: "Eixo",
    text: [
      "Deixa uma peça girar em volta de um ponto da outra.",
      "Pode ter motor, atrito, mola de torção e batentes de ângulo.",
      "É o eixo de uma tesoura.",
    ],
    shows: "uma alavanca girando em volta do eixo",
  },
  pin: {
    title: "Pino",
    text: [
      "Um círculo preso a uma peça que atravessa outras camadas e bate em tudo o que encontra nelas.",
      "É o único jeito de uma peça empurrar outra de outra camada.",
      "É o pino de uma dobradiça de porta.",
    ],
    shows: "o pino de uma chapa empurrando a chapa da camada de baixo",
  },
  slot: {
    title: "Rasgo-guia",
    text: [
      "Um furo comprido onde um pino corre, como num trilho.",
      "Reto, o pino só anda ao longo dele; curvo, segue a forma do furo.",
      "É o rasgo de um trinco de janela.",
    ],
    shows: "o pino correndo de ponta a ponta do rasgo",
  },
  slider: {
    title: "Trilho",
    text: [
      "Deixa uma peça deslizar numa direção, entre dois batentes.",
      "Pode ter mola de retorno e atrito.",
      "É a gaveta de uma mesa.",
    ],
    shows: "um bloco correndo no trilho e batendo nos batentes",
  },
  rod: {
    title: "Haste",
    text: [
      "Liga dois pontos a uma distância fixa: puxa e empurra.",
      "As pontas giram livres, como dois eixos.",
      "É a biela entre o pedal e a roda de uma máquina de costura antiga.",
    ],
    shows: "uma manivela girando e a haste levando o bloco",
  },
  cable: {
    title: "Cabo",
    text: [
      "Liga dois pontos até um comprimento máximo: puxa, mas não empurra.",
      "Frouxo, não faz força nenhuma.",
      "É o cabo do freio de uma bicicleta.",
    ],
    shows: "um peso subindo e descendo pendurado no cabo",
  },
  mount: {
    title: "Suporte elástico",
    text: [
      "Um parafuso que cede um pouco e volta, como um coxim de borracha.",
      "Firme ou macio, sempre amortecido.",
      "É o coxim que segura o motor de uma máquina de lavar.",
    ],
    shows: "um bloco balançando e voltando ao lugar",
  },
  spring: {
    title: "Mola",
    text: [
      "Faz força pela diferença entre o comprimento livre e o de agora.",
      "Presa, puxa e empurra; apoiada, só empurra e solta do assento.",
      "É a mola de uma caneta.",
    ],
    shows: "a mola apoiada empurrando o bloco e soltando do assento",
  },
  lock: {
    title: "Trava",
    text: [
      "Prende como um parafuso até ser solta.",
      "Solta por um toque, por um sensor ou quando a força passa do limite (fusível).",
      "É o trinco de uma porta.",
    ],
    shows: "a trava saltando e a peça caindo",
  },
  chamber: {
    title: "Câmara",
    text: [
      "Gás que empurra as paredes móveis e devolve o recuo.",
      "Uma carga acende a pressão; respiros e portas deixam o gás sair.",
      "É o cilindro de uma seringa (o gás é didático).",
    ],
    shows: "o gás empurrando as duas paredes para longe uma da outra",
  },
  sensor: {
    title: "Sensor",
    text: [
      "Uma zona que percebe uma batida acima de uma velocidade.",
      "Quando dispara, solta uma trava, acende uma carga ou abre um respiro.",
      "É o interruptor de fim de curso de um portão.",
    ],
    shows: "uma esfera batendo na zona e o sensor acendendo",
  },
  capsule: {
    title: "Cápsula",
    text: [
      "Um estojo com carga e uma esfera presa na boca: um golpe forte na espoleta, no fundo, acende a carga.",
      "O gás empurra a esfera para a frente e o estojo para trás; num cano, empurra até a boca do cano.",
      "Depois, vazio, o estojo é puxado pelo aro e jogado para fora (o gás é didático).",
    ],
    shows: "o percussor batendo na espoleta, a esfera saindo e o estojo recuando",
  },
};

/** Os 12 tipos, na ordem do Martelo e depois os que só existem pelo cartão. */
export const EXPLAIN_ORDER: LinkKind[] = [
  "screw",
  "axle",
  "pin",
  "lock",
  "spring",
  "rod",
  "cable",
  "slider",
  "chamber",
  "sensor",
  "slot",
  "mount",
];
