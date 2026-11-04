/**
 * Catálogo de ferramentas do editor: rótulos, grupos e dicas curtas.
 * Os textos seguem o protótipo (reference/prototype-v0), com unidades em mm.
 */

export type ToolId =
  | "select"
  | "rect"
  | "circle"
  | "poly"
  | "free"
  | "gear"
  | "screw"
  | "axle"
  | "pin"
  | "slider"
  | "spring"
  | "chamber"
  | "sensor";

export type ToolGroupId = "draw" | "link" | "energy";

export interface ToolDef {
  id: ToolId;
  label: string;
  hint: string;
}

export interface ToolGroup {
  id: ToolGroupId;
  label: string;
  tools: ToolDef[];
}

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: "draw",
    label: "Desenho",
    tools: [
      {
        id: "select",
        label: "Selecionar",
        hint: "Toque numa peça ou ligação para editar. Arraste o fundo para mover; pinça para zoom.",
      },
      { id: "rect", label: "Retângulo", hint: "Arraste para desenhar um retângulo na camada ativa." },
      { id: "circle", label: "Círculo", hint: "Arraste do centro para fora." },
      {
        id: "poly",
        label: "Polígono",
        hint: "Toque para marcar os pontos. Toque no primeiro ponto para fechar.",
      },
      { id: "free", label: "Livre", hint: "Desenhe o contorno com o dedo; a forma fecha sozinha." },
      {
        id: "gear",
        label: "Engrenagem",
        hint: "Arraste do centro para fora. Engrenagens do mesmo módulo engrenam.",
      },
    ],
  },
  {
    id: "link",
    label: "Ligações",
    tools: [
      {
        id: "screw",
        label: "Parafuso",
        hint: "Toque onde duas peças se sobrepõem para prendê-las. Numa peça só, prende ao fundo.",
      },
      {
        id: "axle",
        label: "Eixo",
        hint: "Toque onde a peça deve girar. Ela gira sobre a peça de baixo, ou sobre o fundo.",
      },
      {
        id: "pin",
        label: "Pino",
        hint: "Toque numa peça para pôr um pino. Ele atravessa camadas e empurra peças de outra camada.",
      },
      {
        id: "slider",
        label: "Trilho",
        hint: "Arraste sobre a peça na direção em que ela desliza. O comprimento do traço é o curso.",
      },
      {
        id: "spring",
        label: "Mola",
        hint: "Arraste de um ponto a outro. Cada ponta prende na peça que estiver ali, ou no fundo.",
      },
    ],
  },
  {
    id: "energy",
    label: "Energia",
    tools: [
      {
        id: "chamber",
        label: "Câmara",
        hint: "Arraste do fundo da câmara até a saída, passando pelo projétil.",
      },
      {
        id: "sensor",
        label: "Sensor",
        hint: "Toque numa peça para pôr um sensor de impacto, que pode acionar uma câmara.",
      },
    ],
  },
];

export const ALL_TOOLS: ToolDef[] = TOOL_GROUPS.flatMap((g) => g.tools);

export function toolById(id: ToolId): ToolDef {
  const t = ALL_TOOLS.find((x) => x.id === id);
  if (!t) throw new Error(`Ferramenta desconhecida: ${id}`);
  return t;
}

export function groupOf(id: ToolId): ToolGroup {
  const g = TOOL_GROUPS.find((x) => x.tools.some((t) => t.id === id));
  if (!g) throw new Error(`Ferramenta sem grupo: ${id}`);
  return g;
}
