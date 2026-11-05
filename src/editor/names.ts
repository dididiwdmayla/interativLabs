import type { Link, LinkKind, Part, Scene } from "@/model/types";

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

/** "Barra 3" ou, sem nome, "peça 12". */
export function partName(p: Pick<Part, "name" | "ref">): string {
  return p.name.trim() || `peça ${p.ref}`;
}

/** "eixo 41" (minúsculo, como no meio de uma frase). */
export function linkName(l: Pick<Link, "kind" | "ref">): string {
  return `${LINK_LABEL[l.kind].toLocaleLowerCase("pt-BR")} ${l.ref}`;
}

/** Peças que uma ligação toca (null = o fundo). */
export function linkParts(l: Link): (string | null)[] {
  switch (l.kind) {
    case "pin":
    case "sensor":
      return [l.host];
    case "slot":
      return [l.guide];
    case "chamber":
      return [l.body, ...l.walls.map((w) => w.part)];
    case "spring":
      return l.guide ? [l.a, l.b, l.guide] : [l.a, l.b];
    default:
      return [l.a, l.b];
  }
}

/**
 * Próximo nome com número para um tipo de peça ("Barra" → "Barra 3"): o
 * maior número já usado com esse prefixo + 1.
 */
export function nextPartName(scene: Scene, base: string): string {
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} (\\d+)$`);
  let n = 0;
  for (const p of scene.parts) {
    const m = re.exec(p.name.trim());
    if (m) n = Math.max(n, Number(m[1]));
  }
  return `${base} ${n + 1}`;
}

/** "1 ligação", "2 ligações" */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
