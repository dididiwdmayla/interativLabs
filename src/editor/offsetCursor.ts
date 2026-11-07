import type { Vec2 } from "@/geometry/vec";

/**
 * Cursor deslocado das ferramentas da mão (docs/arquitetura.md §6, revisto em
 * 07/11). Toque rápido (menos de 250 ms e de 10 px) crava sob o dedo.
 * Segurar parado 300 ms acende o cursor 64 px acima do dedo (abaixo, quando
 * falta espaço em cima); daí em diante o ponto é o cursor: o dedo o move
 * 1:1. Mouse e caneta: sem deslocamento. Sem DOM: o relógio vem de quem chama.
 */

export const CURSOR_HOLD_MS = 300;
export const CURSOR_TAP_MS = 250;
export const CURSOR_STILL_PX = 10;
export const CURSOR_OFFSET_PX = 64;
/** px livres acima do cursor para ele caber em cima (senão vai para baixo) */
export const CURSOR_TOP_PX = 24;

export interface OffsetCursor {
  touch: boolean;
  /** onde o dedo pousou, px do palco */
  x0: number;
  y0: number;
  t0: number;
  /** o dedo andou mais que a folga antes de acender */
  moved: boolean;
  /** deslocamento vertical do cursor quando aceso (0 apagado) */
  dy: number;
}

export function startCursor(x: number, y: number, t: number, pointerType: string): OffsetCursor {
  return { touch: pointerType === "touch", x0: x, y0: y, t0: t, moved: false, dy: 0 };
}

/** Deslocamento do cursor quando acende: acima, ou abaixo se faltar espaço em cima. */
export function cursorOffset(y: number, top = 0): number {
  return y - CURSOR_OFFSET_PX < top + CURSOR_TOP_PX ? CURSOR_OFFSET_PX : -CURSOR_OFFSET_PX;
}

/** Atualiza com o dedo em (x, y); devolve true se o dedo saiu da folga agora. */
export function moveCursor(c: OffsetCursor, x: number, y: number): boolean {
  if (c.moved || c.dy !== 0) return false;
  if (Math.hypot(x - c.x0, y - c.y0) > CURSOR_STILL_PX) {
    c.moved = true;
    return true;
  }
  return false;
}

/** O relógio do segurar venceu: acende se o dedo ficou parado (só toque). Devolve se acendeu. */
export function holdCursor(c: OffsetCursor, top = 0): boolean {
  if (!c.touch || c.moved || c.dy !== 0) return false;
  c.dy = cursorOffset(c.y0, top);
  return true;
}

export const cursorLit = (c: OffsetCursor) => c.dy !== 0;

/** O ponto da ferramenta, px do palco, com o dedo em (x, y). */
export function cursorPoint(c: OffsetCursor, x: number, y: number): Vec2 {
  return [x, y + c.dy];
}

/** Toque rápido: pouco tempo e pouco movimento. */
export function isQuickTap(c: OffsetCursor, x: number, y: number, t: number): boolean {
  return t - c.t0 < CURSOR_TAP_MS && Math.hypot(x - c.x0, y - c.y0) < CURSOR_STILL_PX;
}
