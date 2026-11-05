import { describe, expect, it } from "vitest";
import { radialHit, radialLayout } from "./radial";

const insets = { top: 0, right: 44, bottom: 21, left: 44 };

describe("menu circular de borda", () => {
  for (const [w, h] of [
    [844, 390],
    [640, 360],
    [390, 844],
    [1440, 900],
  ] as const)
    for (const side of ["left", "right"] as const)
      for (const n of [2, 4, 6, 9])
        it(`${w}×${h}, ${side}, ${n} itens: nada fora da tela nem sob o entalhe, arco de 120° a 150°`, () => {
          for (const cy of [0, h / 2, h]) {
            const l = radialLayout({ side, cy, width: w, height: h, insets, count: n });
            expect(l.span).toBeGreaterThanOrEqual(120);
            expect(l.span).toBeLessThanOrEqual(150);
            for (const it of l.items) {
              expect(it.x - l.itemR).toBeGreaterThanOrEqual(insets.left - 0.01);
              expect(it.x + l.itemR).toBeLessThanOrEqual(w - insets.right + 0.01);
              expect(it.y - l.itemR).toBeGreaterThanOrEqual(insets.top - 0.01);
              expect(it.y + l.itemR).toBeLessThanOrEqual(h - insets.bottom + 0.01);
            }
            // voltado para o meio da tela
            for (const it of l.items) expect(side === "right" ? it.x <= l.cx : it.x >= l.cx).toBe(true);
            // itens não se sobrepõem
            for (let i = 1; i < l.items.length; i++) {
              const a = l.items[i - 1]!;
              const b = l.items[i]!;
              expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(l.itemR * 1.6);
            }
          }
        });

  it("acha o item sob o dedo", () => {
    const l = radialLayout({ side: "right", cy: 200, width: 844, height: 390, insets, count: 4 });
    const it = l.items[2]!;
    expect(radialHit(l, it.x + 5, it.y - 5)).toBe(2);
    expect(radialHit(l, l.cx, l.cy)).toBe(-1);
  });
});
