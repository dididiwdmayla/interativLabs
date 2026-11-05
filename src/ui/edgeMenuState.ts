import type { MenuContext, MenuItem } from "@/editor/menus";
import { radialHit, type RadialLayout } from "@/editor/radial";
import { useUiStore } from "@/editor/useUiStore";
import { isFullscreen } from "./fullscreen";

/** O menu de borda aberto agora (o palco consulta para o deslizar e soltar). */
let shown: { layout: RadialLayout; items: MenuItem[] } | null = null;

export function setShownMenu(m: { layout: RadialLayout; items: MenuItem[] } | null): void {
  shown = m;
}

/** Item do menu aberto sob o ponto do palco (px). */
export function hitEdgeMenu(x: number, y: number): string | null {
  if (!shown) return null;
  const i = radialHit(shown.layout, x, y);
  return i >= 0 ? (shown.items[i]?.id ?? null) : null;
}

export function useMenuContext(): MenuContext {
  const mode = useUiStore((s) => s.mode);
  const hasSelection = useUiStore((s) => s.selection !== null);
  const xray = useUiStore((s) => s.xray);
  const hint = useUiStore((s) => s.hint);
  const lefty = useUiStore((s) => s.lefty);
  return {
    mode,
    hasSelection,
    xray,
    hint,
    lefty,
    fullscreen: typeof document !== "undefined" && isFullscreen(),
  };
}
