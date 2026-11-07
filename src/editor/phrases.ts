import type { Part } from "@/model/types";
import type { HammerTool } from "./hammer";
import { LINK_LABEL, partName } from "./names";

/**
 * Frases das ferramentas da mão em português com artigo e concordância:
 * "Parafuso: a Base fica presa ao fundo", "Eixo: o Ferrolho gira sobre a
 * Placa de base". O gênero vem da primeira palavra do nome da peça
 * (as peças do projeto e os nomes mais comuns estão na lista; o resto pela
 * terminação). Peça sem nome é "a peça 12".
 */

export type Gender = "f" | "m";

/** primeiras palavras que fogem da terminação (ou que valem conferir) */
const WORDS: Record<string, Gender> = {
  base: "f",
  parede: "f",
  haste: "f",
  ponte: "f",
  lente: "f",
  chave: "f",
  porca: "f",
  mola: "f",
  ação: "f",
  peça: "f",
  engrenagem: "f",
  roda: "f",
  guarda: "f",
  motora: "f",
  intermediária: "f",
  retém: "m",
  pinhão: "m",
  pistão: "m",
  came: "m",
  dente: "m",
  suporte: "m",
  batente: "m",
  pente: "m",
  canal: "m",
  coletor: "m",
  empurrador: "m",
  aparador: "m",
  percussor: "m",
  êmbolo: "m",
  eixo: "m",
  pino: "m",
  trilho: "m",
  fundo: "m",
  corpo: "m",
  cano: "m",
  disco: "m",
  bloco: "m",
  peso: "m",
  gatilho: "m",
  ferrolho: "m",
  disparo: "m",
  mapa: "m",
  dia: "m",
  tema: "m",
  sistema: "m",
  problema: "m",
};

/** Gênero do nome (pela primeira palavra). */
export function genderOf(name: string): Gender {
  const w = (name.trim().split(/[\s-]+/)[0] ?? "").toLocaleLowerCase("pt-BR");
  if (!w) return "f";
  const known = WORDS[w];
  if (known) return known;
  if (/(a|ção|são|gem|dade|ie|ise)$/.test(w)) return "f";
  return "m";
}

type Named = Pick<Part, "name" | "ref">;
const g = (p: Named): Gender => (p.name.trim() ? genderOf(p.name) : "f");
const art = (p: Named, f: string, m: string) => `${g(p) === "f" ? f : m} ${partName(p)}`;

/** "a Base", "o Ferrolho" */
export const the = (p: Named) => art(p, "a", "o");
/** "à Base", "ao Ferrolho" */
export const toThe = (p: Named) => art(p, "à", "ao");
/** "na Base", "no Ferrolho" */
export const inThe = (p: Named) => art(p, "na", "no");
/** "da Base", "do Ferrolho" */
export const ofThe = (p: Named) => art(p, "da", "do");
/** "presa", "preso" (concorda com a peça) */
export const agree = (p: Named, f: string, m: string) => (g(p) === "f" ? f : m);

/** Número com vírgula, como a interface mostra ("12,5"). */
export const mm = (v: number, digits = 1) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** Ferramentas do Martelo que se arrastam. */
const DRAGGED: HammerTool[] = ["spring", "rod", "cable", "slider", "chamber"];

/**
 * O que a ferramenta faz no ponto: `b` é a peça de cima, `a` a de baixo
 * (null = o fundo). Sem `b`, o que a pessoa deve fazer.
 */
export function hammerPhrase(tool: HammerTool, b: Named | null, a: Named | null): string {
  const name = LINK_LABEL[tool];
  if (!b) return idlePhrase(tool);
  switch (tool) {
    case "screw":
      return a
        ? `${name}: ${the(b)} se une ${toThe(a)}`
        : `${name}: ${the(b)} fica ${agree(b, "presa", "preso")} ao fundo`;
    case "axle":
      return `${name}: ${the(b)} gira sobre ${a ? the(a) : "o fundo"}`;
    case "lock":
      return `${name}: ${the(b)} fica ${agree(b, "presa", "preso")} ${a ? toThe(a) : "ao fundo"} até soltar`;
    case "pin":
      return `${name}: preso ${toThe(b)}, atravessa para a camada vizinha`;
    case "spring":
    case "rod":
    case "cable":
      return `${name}: arraste ${ofThe(b)} até a outra ponta`;
    case "slider":
      return `${name}: ${the(b)} corre; arraste na direção do curso`;
    case "chamber":
      return `${name}: arraste ao longo do furo, do fundo à boca`;
    case "sensor":
      return `${name} ${inThe(b)}: toque e depois escolha o alvo`;
  }
}

/** Frase da faixa antes do primeiro toque. */
export function idlePhrase(tool: HammerTool): string {
  const name = LINK_LABEL[tool];
  switch (tool) {
    case "spring":
    case "rod":
    case "cable":
      return `${name}: arraste de um ponto a outro; ponta no vazio fica no fundo`;
    case "slider":
      return `${name}: arraste a partir da peça que corre, na direção do curso`;
    case "chamber":
      return `${name}: arraste ao longo do furo, do fundo à boca`;
    default:
      return `${name}: toque sobre uma peça`;
  }
}

/** Frase enquanto arrasta: "Mola: 12,5 mm · solte para cravar". */
export function dragPhrase(tool: HammerTool, length: number): string {
  return `${LINK_LABEL[tool]}: ${mm(length)} mm · solte para cravar`;
}

/** Ferramenta que se arrasta (a frase do comprimento vale para ela). */
export const isDragTool = (tool: HammerTool) => DRAGGED.includes(tool);

/** Frase do Lápis para a ferramenta escolhida; `target` é a peça escolhida, se houver. */
export function pencilPhrase(
  t: { form: "contour" | "stroke"; op: "add" | "cut"; width: number; ruler: boolean },
  target: Named | null,
): string {
  const on = target ? ` ${inThe(target)}` : "";
  const ruler = t.ruler ? " · régua" : "";
  if (t.form === "contour")
    return t.op === "cut"
      ? `Tirar${on}: feche um laço, ou corte de borda a borda${ruler}`
      : `Somar${on}: feche um laço; no vazio, vira peça nova${ruler}`;
  return t.op === "cut"
    ? `Borracha de ${mm(t.width)} mm${on} · um toque faz furo${t.ruler ? " · reta vira rasgo" : ""}`
    : `Pincel de ${mm(t.width)} mm${on}: barra ou alavanca à mão${ruler}`;
}

/** Acrescenta "Esc sai" só para quem usa teclado ou mouse. */
export const withEsc = (phrase: string, keys: boolean) => (keys ? `${phrase} · Esc sai` : phrase);
