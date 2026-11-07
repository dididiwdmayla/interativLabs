/**
 * Edge-menu entries as data (docs/arquitetura.md §6).
 * The menu reads this list. Hammer contains fasteners, links, guides and gas;
 * Insert opens Hammer or the drawer (including multilayer parts and cams).
 * Tapping overlapping parts still selects; only Hammer creates links.
 * Pencil draws and cuts the shape of a part (Part E2c).
 */

/** "insert" fica à direita (à esquerda no canhoto); "view", do outro lado. */
export type MenuId = "insert" | "view";

export interface MenuContext {
  mode: "edit" | "simulate";
  hasSelection: boolean;
  xray: boolean;
  hint: boolean;
  lefty: boolean;
  fullscreen: boolean;
}

export interface MenuItem {
  id: string;
  label: string;
  /** nome do ícone em src/ui/icons.tsx */
  icon: string;
  /** só aparece quando verdadeiro */
  when?: (c: MenuContext) => boolean;
  /** ligado (ouro), para os que alternam */
  on?: (c: MenuContext) => boolean;
}

export interface MenuDef {
  id: MenuId;
  title: string;
  /** o menu existe neste modo */
  modes: ("edit" | "simulate")[];
  items: MenuItem[];
}

export const MENUS: Record<MenuId, MenuDef> = {
  insert: {
    id: "insert",
    title: "Inserir",
    modes: ["edit"],
    items: [
      { id: "hammer", label: "Martelo", icon: "hammer" },
      { id: "pencil", label: "Lápis", icon: "pencil" },
      { id: "parts", label: "Peças prontas", icon: "parts" },
      { id: "layer-new", label: "Nova camada", icon: "layerAdd" },
      { id: "duplicate", label: "Duplicar seleção", icon: "duplicate", when: (c) => c.hasSelection },
      { id: "delete", label: "Excluir seleção", icon: "trash", when: (c) => c.hasSelection },
    ],
  },
  view: {
    id: "view",
    title: "Vista",
    modes: ["edit", "simulate"],
    items: [
      { id: "fit", label: "Enquadrar", icon: "fit" },
      { id: "xray", label: "Raio-x", icon: "xray", on: (c) => c.xray },
      { id: "fullscreen", label: "Tela cheia", icon: "fullscreen", on: (c) => c.fullscreen },
      { id: "layer-colors", label: "Camadas em cores", icon: "layers" },
      { id: "tips", label: "Dicas", icon: "tips", on: (c) => c.hint },
      { id: "lefty", label: "Canhoto", icon: "lefty", on: (c) => c.lefty },
    ],
  },
};

/** Itens visíveis agora. */
export function menuItems(id: MenuId, c: MenuContext): MenuItem[] {
  return MENUS[id].items.filter((it) => !it.when || it.when(c));
}

/** Qual menu fica em cada lado físico. */
export function menuAt(side: "left" | "right", lefty: boolean): MenuId {
  return (side === "right") !== lefty ? "insert" : "view";
}

export function sideOf(id: MenuId, lefty: boolean): "left" | "right" {
  return (id === "insert") !== lefty ? "right" : "left";
}
