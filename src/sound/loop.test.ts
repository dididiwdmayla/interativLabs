import { describe, expect, it } from "vitest";
import { audio } from "@/assets/audio-registry";
import { equalPowerCurve, equalPowerIn, equalPowerOut, pickVariant, planStream, ventSegment } from "./loop";

describe("laço da música", () => {
  it("o trecho vem do manifesto (50,75 → 130,79 no original), descontado o corte de 0,13 s", () => {
    const loop = audio["music-bench"].loop!;
    expect(loop.start).toBeCloseTo(50.62, 3);
    expect(loop.end).toBeCloseTo(130.66, 3);
    expect(loop.crossfade).toBe(2);
    // 92 tempos a ~69 BPM: o trecho é o mesmo do manifesto
    expect(loop.end - loop.start).toBeCloseTo(130.79 - 50.75, 3);
  });

  it("a emenda entra 2 s antes do início e começa 2 s antes do fim", () => {
    const p = planStream(audio["music-bench"])!;
    expect(p.crossfade).toBe(2);
    expect(p.fadeAt).toBeCloseTo(128.66, 3);
    expect(p.entryAt).toBeCloseTo(48.62, 3);
    // depois da primeira volta, o novo tocador chega ao fim do trecho depois de (fim − início) s
    expect(p.fadeAt - p.entryAt).toBeCloseTo(130.66 - 50.62, 3);
  });

  it("efeito sem laço não tem plano", () => {
    expect(planStream(audio["sfx-stamp"])).toBeNull();
  });

  it("o crossfade é de potência constante", () => {
    for (let t = 0; t <= 1; t += 0.05) {
      expect(equalPowerIn(t) ** 2 + equalPowerOut(t) ** 2).toBeCloseTo(1, 10);
    }
    const up = equalPowerCurve("in", 9);
    expect(up[0]).toBeCloseTo(0);
    expect(up[8]).toBeCloseTo(1);
  });

  it("a vazão repete 0,5 → 1,5 com crossfade de 20 ms", () => {
    const loop = audio["sfx-vent-loop"].loop!;
    expect(loop).toEqual({ start: 0.5, end: 1.5, crossfade: 0.02 });
    const seg = ventSegment(loop);
    expect(seg.cycle).toBeCloseTo(1);
    expect(seg.offset).toBeCloseTo(0.48);
    expect(seg.duration).toBeCloseTo(1.02);
    // o segmento seguinte começa quando este chega a (fim − crossfade) do arquivo
    expect(seg.offset + seg.cycle).toBeCloseTo(loop.end - loop.crossfade);
  });
});

describe("variações", () => {
  it("nunca repete a anterior", () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (const count of [2, 3, 5]) {
      let last: number | null = null;
      const seen = new Set<number>();
      for (let i = 0; i < 2000; i++) {
        const v = pickVariant(count, last, random);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(count);
        if (last !== null) expect(v).not.toBe(last);
        seen.add(v);
        last = v;
      }
      expect(seen.size).toBe(count);
    }
  });

  it("com uma só variação, ela mesma", () => {
    expect(pickVariant(1, 0)).toBe(0);
    expect(pickVariant(1, null)).toBe(0);
  });
});
