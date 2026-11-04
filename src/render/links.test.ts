import { describe, expect, it } from "vitest";
import { layoutCallouts } from "./callouts";
import {
  CABLE_SLACK_MIN,
  COIL_SCALE_MAX,
  COIL_SCALE_MIN,
  COIL_TOUCH,
  cablePath,
  coilCount,
  coilMetrics,
  coilScale,
} from "./geometry";

describe("mola: espiras pelo comprimento", () => {
  it("o número de espiras vem do comprimento livre", () => {
    const D = 6;
    const m = coilMetrics(D);
    for (const free of [20, 30, 45, 80]) {
      const n = coilCount(free, D);
      expect(n).toBe(Math.max(1, Math.round((free - 2 * m.end) / m.pitch)));
      // no comprimento livre, as espiras ficam perto da escala 1
      const sx = coilScale(free, n, D);
      expect(sx).toBeGreaterThan(0.8);
      expect(sx).toBeLessThan(1.25);
    }
  });

  it("mola mais grossa tem passo maior e menos espiras no mesmo comprimento", () => {
    expect(coilMetrics(12).pitch).toBeCloseTo(2 * coilMetrics(6).pitch, 9);
    expect(coilCount(60, 12)).toBeLessThan(coilCount(60, 6));
  });

  it("na pose desenhada o scaleX fica entre 0,6 e 1,6", () => {
    const D = 6;
    for (const drawn of [6, 9.6, 15, 30, 60, 120]) {
      const n = coilCount(25, D, drawn);
      const sx = coilScale(drawn, n, D);
      if (drawn - 2 * coilMetrics(D).end > coilMetrics(D).pitch * COIL_SCALE_MIN) {
        expect(sx).toBeGreaterThanOrEqual(COIL_SCALE_MIN - 1e-9);
        expect(sx).toBeLessThanOrEqual(COIL_SCALE_MAX + 1e-9);
      }
    }
  });

  it("o número não muda com o comprimento atual (só a escala)", () => {
    const n = coilCount(30, 6);
    const a = coilScale(20, n, 6);
    const b = coilScale(28, n, 6);
    expect(b).toBeGreaterThan(a);
  });

  it("comprimida até o sólido, as espiras encostam", () => {
    const n = coilCount(30, 6);
    expect(coilScale(2.4, n, 6, 2.4)).toBe(COIL_TOUCH);
    expect(coilScale(1, n, 6, 2.4)).toBe(COIL_TOUCH);
  });
});

describe("cabo", () => {
  it("esticado é uma reta", () => {
    expect(cablePath([0, 0], [30, 0], 30)).toMatch(/^M0 0L30 0$/);
    expect(cablePath([0, 0], [30, 0], 30 + CABLE_SLACK_MIN / 2)).toContain("L");
  });

  it("frouxo vira curva que pende para baixo, com a flecha da parábola", () => {
    const d = cablePath([0, 0], [30, 0], 32);
    expect(d).toContain("Q");
    const m = d.match(/Q([-\d.]+) ([-\d.]+)/);
    expect(m).not.toBeNull();
    const cy = Number(m![2]);
    // flecha h = √(3·c·folga/8) = √(3·30·2/8) = 4,74; controle a 2h
    expect(cy).toBeCloseTo(2 * Math.sqrt((3 * 30 * 2) / 8), 2);
    expect(cy).toBeGreaterThan(0);
  });

  it("corda vertical frouxa pende para o lado", () => {
    const d = cablePath([0, 0], [0, 30], 33);
    const m = d.match(/Q([-\d.]+) ([-\d.]+)/);
    expect(Math.abs(Number(m![1]))).toBeGreaterThan(1);
  });
});

describe("números de chamada", () => {
  const px = 0.2;
  it("ficam fora das peças e as linhas não se cruzam", () => {
    // uma peça ocupa o quadrado de −20 a 20
    const occupied = (p: [number, number]) => Math.abs(p[0]) < 20 && Math.abs(p[1]) < 20;
    const targets = [
      { id: "a", ref: 1, p: [-10, -10] as [number, number], priority: 1 },
      { id: "b", ref: 2, p: [10, -10] as [number, number], priority: 1 },
      { id: "c", ref: 3, p: [10, 10] as [number, number], priority: 1 },
      { id: "d", ref: 4, p: [-10, 10] as [number, number], priority: 1 },
      { id: "e", ref: 5, p: [0, -12] as [number, number], priority: 1 },
    ];
    const out = layoutCallouts(targets, [-20, -20, 40, 40], px, occupied);
    expect(out.every((o) => !o.hidden)).toBe(true);
    for (const o of out) expect(occupied(o.label)).toBe(false);
    const cross = (a: number[], b: number[], c: number[], d: number[]) => {
      const o = (p: number[], q: number[], r: number[]) =>
        (q[0]! - p[0]!) * (r[1]! - p[1]!) - (q[1]! - p[1]!) * (r[0]! - p[0]!);
      return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
    };
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++)
        expect(cross(out[i]!.label, out[i]!.p, out[j]!.label, out[j]!.p)).toBe(false);
  });
});
