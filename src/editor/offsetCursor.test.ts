import { describe, expect, it } from "vitest";
import { cursorLit, cursorPoint, holdCursor, isQuickTap, moveCursor, startCursor } from "./offsetCursor";

describe("cursor deslocado", () => {
  it("segurar parado acende 64 px acima; daí o dedo move o cursor 1:1", () => {
    const c = startCursor(100, 200, 0, "touch");
    expect(moveCursor(c, 104, 203)).toBe(false);
    expect(holdCursor(c)).toBe(true);
    expect(cursorLit(c)).toBe(true);
    expect(cursorPoint(c, 150, 260)).toEqual([150, 196]);
  });
  it("sem espaço em cima, acende abaixo do dedo", () => {
    const c = startCursor(100, 40, 0, "touch");
    holdCursor(c);
    expect(cursorPoint(c, 100, 40)).toEqual([100, 104]);
  });
  it("arrastar antes de acender não acende: o ponto fica sob o dedo", () => {
    const c = startCursor(100, 200, 0, "touch");
    expect(moveCursor(c, 120, 200)).toBe(true);
    expect(holdCursor(c)).toBe(false);
    expect(cursorPoint(c, 130, 210)).toEqual([130, 210]);
  });
  it("mouse e caneta: sem deslocamento", () => {
    for (const type of ["mouse", "pen"]) {
      const c = startCursor(100, 200, 0, type);
      expect(holdCursor(c)).toBe(false);
      expect(cursorPoint(c, 100, 200)).toEqual([100, 200]);
    }
  });
  it("toque rápido: menos de 250 ms e de 10 px", () => {
    const c = startCursor(100, 200, 1000, "touch");
    expect(isQuickTap(c, 103, 204, 1200)).toBe(true);
    expect(isQuickTap(c, 103, 204, 1260)).toBe(false);
    expect(isQuickTap(c, 112, 200, 1100)).toBe(false);
  });
});
