import { describe, expect, it } from "vitest";
import { snapAngle, snapMove, type SnapTargets } from "./snap";

const empty: SnapTargets = { points: [], edges: [], lines: [], grid: { on: false, step: 1 } };

describe("encaixe", () => {
  it("encaixa o centro no centro de um furo dentro da tolerância", () => {
    const t: SnapTargets = { ...empty, points: [{ p: [10, 10], kind: "center" }] };
    const r = snapMove({ x: 11, y: 9.4, angle: 0 }, [{ local: [0, 0], kind: "origin" }], t, 2);
    expect([r.x, r.y]).toEqual([10, 10]);
    expect(r.guides[0]?.kind).toBe("point");
    expect(r.key).not.toBeNull();
    const far = snapMove({ x: 14, y: 9.4, angle: 0 }, [{ local: [0, 0], kind: "origin" }], t, 2);
    expect([far.x, far.y]).toEqual([14, 9.4]);
    expect(far.key).toBeNull();
  });

  it("vértice com vértice, considerando o giro da peça", () => {
    const t: SnapTargets = { ...empty, points: [{ p: [0, 20], kind: "vertex" }] };
    // vértice local (10, 0) girado 90° fica em (x, y + 10)
    const r = snapMove({ x: 0.5, y: 9.2, angle: Math.PI / 2 }, [{ local: [10, 0], kind: "vertex" }], t, 2);
    expect(r.x).toBeCloseTo(0, 9);
    expect(r.y).toBeCloseTo(10, 9);
  });

  it("encosta na borda de outra peça", () => {
    const t: SnapTargets = {
      ...empty,
      edges: [
        [
          [0, 0],
          [100, 0],
        ],
      ],
    };
    const r = snapMove({ x: 50, y: -1.2, angle: 0 }, [{ local: [0, 0], kind: "origin" }], t, 2);
    expect([r.x, r.y]).toEqual([50, 0]);
    expect(r.guides[0]?.kind).toBe("edge");
  });

  it("alinha no prolongamento dos eixos das ligações, em x e em y", () => {
    const t: SnapTargets = {
      ...empty,
      lines: [
        { p: [30, 0], u: [0, 1] },
        { p: [0, 40], u: [1, 0] },
      ],
    };
    const r = snapMove({ x: 31, y: 41.5, angle: 0 }, [{ local: [0, 0], kind: "origin" }], t, 2);
    expect([r.x, r.y]).toEqual([30, 40]);
    expect(r.guides.length).toBe(2);
  });

  it("grade quando nada mais encaixa", () => {
    const t: SnapTargets = { ...empty, grid: { on: true, step: 5 } };
    const r = snapMove({ x: 11, y: 13.8, angle: 0 }, [{ local: [0, 0], kind: "origin" }], t, 2);
    expect([r.x, r.y]).toEqual([10, 15]);
  });

  it("ângulo com passos de 15° perto dos redondos", () => {
    expect(snapAngle((47 * Math.PI) / 180).angle).toBeCloseTo((45 * Math.PI) / 180, 12);
    expect(snapAngle((52 * Math.PI) / 180).snapped).toBe(false);
  });
});
