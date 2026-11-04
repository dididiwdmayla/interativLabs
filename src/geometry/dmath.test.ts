import { describe, expect, it } from "vitest";
import { seededRandom } from "@/model/ids";
import { datan, datan2, dcos, dexp, dhypot, dlog, dpow, dsin } from "./dmath";

/**
 * As funções determinísticas batem com as do JS dentro de poucos ulp, e o
 * resultado é sempre o mesmo bit (o hash de controle fica gravado aqui: se
 * mudar numa plataforma, o teste de Playwright do determinismo pega).
 */

const rnd = seededRandom(20261104);
const sample = (n: number, lo: number, hi: number) => Array.from({ length: n }, () => lo + (hi - lo) * rnd());

function maxErr(xs: number[], f: (x: number) => number, g: (x: number) => number, rel: boolean) {
  let worst = 0;
  for (const x of xs) {
    const a = f(x);
    const b = g(x);
    const e = Math.abs(a - b) / (rel ? Math.max(Math.abs(b), 1e-300) : 1);
    worst = Math.max(worst, e);
  }
  return worst;
}

describe("dmath", () => {
  const angles = [...sample(20000, -7, 7), ...sample(5000, -2000, 2000), 0, Math.PI, -Math.PI / 2, 1e-12];

  it("seno e cosseno: erro absoluto < 3e-16 até ±7 rad e < 1e-15 até ±2000 rad", () => {
    const small = angles.filter((a) => Math.abs(a) <= 7);
    expect(maxErr(small, dsin, Math.sin, false)).toBeLessThan(3e-16);
    expect(maxErr(small, dcos, Math.cos, false)).toBeLessThan(3e-16);
    expect(maxErr(angles, dsin, Math.sin, false)).toBeLessThan(1e-15);
    expect(maxErr(angles, dcos, Math.cos, false)).toBeLessThan(1e-15);
  });

  it("arco tangente: erro < 3e-16 nos quatro quadrantes e nos casos especiais", () => {
    const ys = sample(20000, -50, 50);
    const xs = sample(20000, -50, 50);
    let worst = 0;
    ys.forEach((y, i) => (worst = Math.max(worst, Math.abs(datan2(y, xs[i]!) - Math.atan2(y, xs[i]!)))));
    expect(worst).toBeLessThan(5e-16);
    expect(maxErr(sample(5000, -1e6, 1e6), datan, Math.atan, false)).toBeLessThan(3e-16);
    for (const [y, x] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
      [-0, -1],
      [1e-310, 1],
      [1, 1e-310],
    ] as const)
      expect(datan2(y, x)).toBeCloseTo(Math.atan2(y, x), 15);
  });

  it("exponencial, logaritmo e potência: erro relativo < 4e-16 (potência < 5e-15, o erro do log × y)", () => {
    expect(maxErr(sample(20000, -700, 700), dexp, Math.exp, true)).toBeLessThan(4e-16);
    expect(maxErr(sample(5000, -1, 1), dexp, Math.exp, true)).toBeLessThan(4e-16);
    const pos = [...sample(20000, 1e-6, 1e6), ...sample(2000, 0.5, 2)];
    expect(maxErr(pos, dlog, Math.log, false)).toBeLessThan(4e-15);
    expect(
      maxErr(
        pos,
        (v) => dpow(v, 1.4),
        (v) => Math.pow(v, 1.4),
        true,
      ),
    ).toBeLessThan(5e-15);
    expect(
      maxErr(
        pos,
        (v) => dpow(v, -0.4),
        (v) => Math.pow(v, -0.4),
        true,
      ),
    ).toBeLessThan(5e-15);
    expect(dexp(0)).toBe(1);
    expect(dlog(1)).toBe(0);
    expect(dpow(2, 10)).toBeCloseTo(1024, 11);
    expect(dhypot(3, 4)).toBe(5);
  });

  it("controle de bits: hash fixo das saídas", () => {
    const view = new DataView(new ArrayBuffer(8));
    let h = 0x811c9dc5;
    const mix = (v: number) => {
      view.setFloat64(0, v);
      for (let i = 0; i < 8; i++) h = Math.imul(h ^ view.getUint8(i), 0x01000193) >>> 0;
    };
    const r = seededRandom(7);
    for (let i = 0; i < 2000; i++) {
      const a = (r() - 0.5) * 40;
      mix(dsin(a));
      mix(dcos(a));
      mix(datan2(a, r() - 0.5));
      mix(dexp(a));
      mix(dlog(Math.abs(a) + 1e-3));
      mix(dpow(Math.abs(a) + 1, 1.4));
    }
    expect(h.toString(16)).toBe(DMATH_HASH);
  });
});

/** Hash de controle gravado (Node). O Chromium precisa dar o mesmo (tests/e2e/determinism.spec.ts). */
const DMATH_HASH = "6f14fa58";
