import { arcPoints, circleRing } from "@/geometry/primitives";
import type { Vec2, Shape } from "@/model/types";
import type { FixtureScript } from "@/sim/script";
import { Builder, writeExample } from "./builder";

const DEG = Math.PI / 180;
export function rodaScene(
  options: {
    pawlLift?: number;
    spring?: number;
    weight?: number;
    pawlAngle?: number;
    azimuth?: number;
    damping?: number;
  } = {},
) {
  const b = new Builder("Roda e lingueta");
  const baseLayer = b.layer("Placa de base", 3),
    gears = b.layer("Engrenagens", 3),
    ratchets = b.layer("Catraca e lingueta", 3),
    handle = b.layer("Manivela", 3),
    load = b.layer("Peso e cabo", 3);
  const base = b.rect("Placa de base", baseLayer, -8, 0, 108, 84, "aluminum", {
    fixed: true,
    holes: [
      circleRing([-43, -33], 2),
      circleRing([43, -33], 2),
      circleRing([-43, 33], 2),
      circleRing([43, 33], 2),
    ],
  });
  const gear = (teeth: number): Shape => ({
    kind: "gear",
    module: 1,
    teeth,
    pressureAngle: 20 * DEG,
    profile: "involute",
    bore: 3,
  });
  const wheel = b.part({
    name: "Roda composta",
    layer: gears,
    x: 0,
    y: 0,
    material: "steel",
    shape: gear(36),
  });
  const ratchetR = 14,
    ratchetModule = ratchetR / (12 + 0.2 * Math.PI);
  wheel.profiles = [
    {
      id: "wheel-ratchet",
      layer: ratchets,
      material: "brass",
      shape: {
        kind: "gear",
        module: ratchetModule,
        teeth: 24,
        pressureAngle: 20 * DEG,
        profile: "ratchet",
        bore: 3,
      },
    },
  ];
  const pinion = b.part({
    name: "Pinhão com manivela",
    layer: gears,
    x: -24,
    y: 0,
    angle: Math.PI / 12,
    material: "steel",
    shape: gear(12),
  });
  const crankLength = 18;
  // Tangential shoulders avoid tiny slivers at boolean circle/shaft intersections.
  const shoulder = Math.acos(2 / 7),
    gripShoulder = Math.acos(2 / 4);
  const crank: Shape = {
    kind: "poly",
    holes: [],
    outer: [
      ...arcPoints([0, -8], 7, Math.PI - shoulder, 2 * Math.PI + shoulder),
      ...arcPoints([0, crankLength], 4, -gripShoulder, Math.PI + gripShoulder),
    ],
  };
  pinion.profiles = [{ id: "pinion-arm", layer: handle, material: "brass", shape: crank }];
  const scale = ratchetR / (1.4857142857142858 * (7 + 0.2 * Math.PI));
  const pivot: Vec2 = [6 * scale, -18.4 * scale];
  const lift = options.pawlLift ?? 0.45;
  const localPivot: Vec2 = [1.8220750551875882 * scale, -2.4724061810154923 * scale];
  const restAngle = options.pawlAngle ?? 0;
  const poseAngle = lift + restAngle;
  const pawl = b.poly(
    "Lingueta",
    ratchets,
    pivot[0] - Math.cos(poseAngle) * localPivot[0] + Math.sin(poseAngle) * localPivot[1],
    pivot[1] - Math.sin(poseAngle) * localPivot[0] - Math.cos(poseAngle) * localPivot[1],
    [
      [0.222075, -4.072406],
      [3.422075, -4.072406],
      [3.022075, -0.472406],
      [-4.977925, 5.527594],
      [-4.577925, 3.527594],
      [0.222075, -0.872406],
    ].map(([x, y]) => [x! * scale, y! * scale] as Vec2),
    "steel",
  );
  pawl.fast = true;
  pawl.angle = poseAngle;
  const azimuth = (options.azimuth ?? -2) * DEG;
  const px = pawl.x,
    py = pawl.y;
  pawl.x = px * Math.cos(azimuth) - py * Math.sin(azimuth);
  pawl.y = px * Math.sin(azimuth) + py * Math.cos(azimuth);
  pawl.angle += azimuth;
  const wheelAxle = b.link({ kind: "axle", a: base.id, b: wheel.id, at: [0, 0] });
  const pinionAxle = b.link({ kind: "axle", a: base.id, b: pinion.id, at: [0, 0] });
  const pawlAxle = b.link({
    kind: "axle",
    a: base.id,
    b: pawl.id,
    at: localPivot,
    limit: { lower: -lift - 12 * DEG, upper: 0.15 },
    torsion: { k: options.spring ?? 0.04, rest: -lift, damping: options.damping ?? 0.000012 },
  });
  const lock = b.link({ kind: "lock", a: base.id, b: pawl.id, at: [-4 * scale, 3 * scale] });
  const weight = b.rect("Peso", load, 18, 27, 4, options.weight ?? 7, "steel");
  const cable = b.link({
    kind: "cable",
    a: wheel.id,
    b: weight.id,
    atA: [18, 0],
    atB: [0, 0],
    maxLength: 27,
  });
  const grip: Vec2 = [
    pinion.x - Math.sin(pinion.angle) * crankLength,
    pinion.y + Math.cos(pinion.angle) * crankLength,
  ];
  return {
    scene: b.scene,
    base,
    wheel,
    pinion,
    pawl,
    weight,
    wheelAxle,
    pinionAxle,
    pawlAxle,
    lock,
    cable,
    grip,
    crankLength,
  };
}
export function rodaScript(r: ReturnType<typeof rodaScene>): FixtureScript {
  const path: Vec2[] = Array.from({ length: 121 }, (_, i) => {
    const a = r.pinion.angle + Math.PI / 2 + (i / 120) * 2 * Math.PI;
    return [r.pinion.x + r.crankLength * Math.cos(a), r.pinion.y + r.crankLength * Math.sin(a)];
  });
  return {
    id: "exemplos/roda-e-lingueta",
    group: "exemplos",
    scene: "../../examples/roda-e-lingueta.json",
    title: "Roda e lingueta",
    notes:
      "Mecanismo genérico de catraca; proporções inventadas. Solte a trava e gire a manivela: a roda só anda para um lado.",
    view: [-62, -44, 114, 112],
    runs: [
      {
        name: "trava presa",
        duration: 1,
        inputs: [],
        assertions: [
          {
            kind: "at",
            label: "O peso retorna a roda pelo menos 30° em 1 s",
            q: { link: r.wheelAxle.id, field: "angle" },
            t: 1,
            min: 30 * DEG,
          },
        ],
      },
      {
        name: "soltura por toque",
        duration: 3.5,
        inputs: [{ kind: "release", link: r.lock.id, t: 0.1 }],
        assertions: [
          {
            kind: "range",
            label: "A volta para em até um dente (17°)",
            q: { link: r.wheelAxle.id, field: "angle" },
            from: 0.1,
            max: 17 * DEG,
          },
          {
            kind: "span",
            label: "Fica parada por 3 s (variação abaixo de 1°)",
            q: { link: r.wheelAxle.id, field: "angle" },
            from: 0.5,
            to: 3.5,
            max: DEG,
          },
        ],
      },
      {
        name: "uma volta na manivela",
        duration: 2.2,
        inputs: [
          { kind: "release", link: r.lock.id, t: 0 },
          { kind: "dragPath", part: r.pinion.id, path, t0: 0.1, t1: 2.1, release: 2.2 },
        ],
        assertions: [
          {
            kind: "at",
            label: "A roda avança 1/3 de volta ±5%",
            q: { link: r.wheelAxle.id, field: "angle" },
            t: 2.1,
            min: -126 * DEG,
            max: -114 * DEG,
          },
        ],
      },
    ],
  };
}
export function generateRoda() {
  const r = rodaScene();
  writeExample("roda-e-lingueta", r.scene, rodaScript(r));
}
