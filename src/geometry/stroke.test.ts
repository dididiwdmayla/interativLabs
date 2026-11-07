import { describe, expect, it } from "vitest";
import { area, signedArea } from "./polygon";
import { straightSlot } from "./slot";
import {
  fitCircle,
  loopRegion,
  rule,
  smoothStroke,
  splitByLine,
  strokeLoop,
  strokeRegion,
  totalArea,
} from "./stroke";
import type { Vec2 } from "./vec";

/** ruído determinístico (LCG) */
function noise(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32 - 0.5;
  };
}
const PX = 0.2; // zoom 1: 5 px por mm

function handCircle(c: Vec2, r: number, amp: number, seed = 1): Vec2[] {
  const rnd = noise(seed);
  const pts: Vec2[] = [];
  for (let i = 0; i < 180; i++) {
    const a = (2 * Math.PI * i) / 180;
    const rr = r + amp * rnd();
    pts.push([c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)]);
  }
  return pts;
}

function handSquare(side: number, amp: number, seed = 2): Vec2[] {
  const rnd = noise(seed);
  const corners: Vec2[] = [
    [0, 0],
    [side, 0],
    [side, side],
    [0, side],
  ];
  const pts: Vec2[] = [];
  for (let k = 0; k < 4; k++) {
    const a = corners[k]!;
    const b = corners[(k + 1) % 4]!;
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      pts.push([a[0] + (b[0] - a[0]) * t + amp * rnd(), a[1] + (b[1] - a[1]) * t + amp * rnd()]);
    }
  }
  return pts;
}

describe("suavização do traço", () => {
  it("laço tremido: a área fica a 2% do círculo desenhado, sem serrilhado", () => {
    const raw = handCircle([0, 0], 6, 0.3);
    const s = smoothStroke(raw, { closed: true, px: PX });
    const a = Math.abs(signedArea(s.points));
    expect(Math.abs(a - Math.PI * 36) / (Math.PI * 36)).toBeLessThan(0.02);
    // nenhuma virada brusca: o maior ângulo entre segmentos vizinhos é pequeno
    let worst = 0;
    const n = s.points.length;
    for (let i = 0; i < n; i++) {
      const p = s.points[(i + n - 1) % n]!;
      const q = s.points[i]!;
      const r = s.points[(i + 1) % n]!;
      const t =
        Math.abs(Math.atan2(r[1] - q[1], r[0] - q[0]) - Math.atan2(q[1] - p[1], q[0] - p[0])) % (2 * Math.PI);
      worst = Math.max(worst, Math.min(t, 2 * Math.PI - t));
    }
    expect((worst * 180) / Math.PI).toBeLessThan(25);
  });
  it("quadrado tremido guarda os quatro cantos", () => {
    const s = smoothStroke(handSquare(20, 0.25), { closed: true, px: PX });
    expect(s.corners).toHaveLength(4);
    const ruled = rule(s, { closed: true, px: PX });
    expect(ruled.kind).toBe("poly");
    if (ruled.kind === "poly") {
      expect(ruled.points).toHaveLength(4);
      expect(Math.abs(Math.abs(signedArea(ruled.points)) - 400) / 400).toBeLessThan(0.03);
    }
  });
  it("régua: círculo à mão vira círculo de raio ±3%", () => {
    const s = smoothStroke(handCircle([3, 4], 8, 0.8, 7), { closed: true, px: PX });
    const r = rule(s, { closed: true, px: PX });
    expect(r.kind).toBe("circle");
    if (r.kind === "circle") expect(Math.abs(r.r - 8) / 8).toBeLessThan(0.03);
    expect(fitCircle(s.points)!.r).toBeCloseTo(8, 0);
  });
  it("régua: traço tremido de ±1 mm vira reta, e a borracha reta é rasgo reto", () => {
    const rnd = noise(9);
    const raw: Vec2[] = [];
    for (let i = 0; i <= 60; i++) raw.push([i * 0.5, 2 * rnd()]);
    const s = smoothStroke(raw, { closed: false, px: PX });
    const r = rule(s, { closed: false, px: PX });
    expect(r.kind).toBe("line");
    if (r.kind !== "line") return;
    const region = strokeRegion([r.a, r.b], 2);
    expect(region).toHaveLength(1);
    expect(straightSlot(region[0]!.outer)).not.toBeNull();
  });
});

describe("regiões do traço", () => {
  it("laço fecha pela ponta ou pelo cruzamento", () => {
    const ring = handCircle([0, 0], 5, 0);
    expect(strokeLoop(ring, PX)).not.toBeNull();
    // um laço com rabo: o começo vem de fora, cruza e segue
    const tail: Vec2[] = [
      [-10, 0],
      ...handCircle([0, 0], 5, 0).slice(90),
      ...handCircle([0, 0], 5, 0).slice(0, 100),
      [12, 3],
    ];
    const loop = strokeLoop(tail, PX)!;
    const region = loopRegion(loop);
    expect(totalArea(region)).toBeGreaterThan(70);
  });
  it("borracha de 2 mm num traço de 30 mm tira 60 mm² mais as pontas", () => {
    const pts: Vec2[] = [];
    for (let i = 0; i <= 30; i++) pts.push([i, 0.0001 * i * i]);
    const region = strokeRegion(pts, 2);
    const body = totalArea(region) - Math.PI;
    expect(Math.abs(body - 60) / 60).toBeLessThan(0.05);
  });
  it("toque de 3 mm é um disco de Ø 3 ±0,05", () => {
    const [disc] = strokeRegion([[1, 1]], 3);
    const xs = disc!.outer.map((p) => p[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(3, 1);
    expect(Math.abs(2 * Math.sqrt(area(disc!) / Math.PI) - 3)).toBeLessThan(0.05);
  });
  it("traço de borda a borda divide a placa em dois lados", () => {
    const plate = {
      outer: [
        [-20, -10],
        [20, -10],
        [20, 10],
        [-20, 10],
      ] as Vec2[],
      holes: [],
    };
    const split = splitByLine(
      [plate],
      [
        [5, -15],
        [5, 15],
      ],
    )!;
    expect(split.left).toHaveLength(1);
    expect(split.right).toHaveLength(1);
    const a = totalArea(split.left);
    const b = totalArea(split.right);
    expect(a + b).toBeCloseTo(800, 0);
    expect(Math.min(a, b)).toBeCloseTo(300, 0);
  });
});
