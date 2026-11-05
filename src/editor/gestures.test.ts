import { describe, expect, it } from "vitest";
import { MultiTap } from "./gestures";

describe("toque com vários dedos", () => {
  it("dois dedos curtos e parados: 2; três: 3", () => {
    const m = new MultiTap();
    m.down(1, 100, 100, 0);
    m.down(2, 200, 100, 20);
    expect(m.up(1, 120)).toBe(0);
    expect(m.up(2, 140)).toBe(2);
    m.down(1, 100, 100, 1000);
    m.down(2, 150, 100, 1010);
    m.down(3, 200, 100, 1020);
    m.up(2, 1100);
    m.up(1, 1110);
    expect(m.up(3, 1120)).toBe(3);
  });

  it("não vale com movimento acima de 10 px, toque longo ou um dedo só", () => {
    const m = new MultiTap();
    m.down(1, 0, 0, 0);
    m.down(2, 50, 0, 0);
    m.move(2, 62, 0);
    m.up(1, 100);
    expect(m.up(2, 100)).toBe(0);
    m.down(1, 0, 0, 0);
    m.down(2, 50, 0, 0);
    m.up(1, 300);
    expect(m.up(2, 300)).toBe(0);
    m.down(1, 0, 0, 0);
    expect(m.up(1, 50)).toBe(0);
  });
});
