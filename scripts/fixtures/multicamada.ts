import { rectRing, slotRing } from "@/geometry/primitives";
import type { ScriptInput } from "@/sim/script";
import { Builder, writeFixture } from "./builder";

export function profilesScene() {
  const b = new Builder("Perfis nas camadas 1 e 3");
  const l1 = b.layer("Traseira"),
    l2 = b.layer("Vazia"),
    l3 = b.layer("Frente", 5);
  const piece = b.poly("Peça multicamada", l1, 0, 0, rectRing(-10, -2, -6, 2), "steel");
  piece.profiles = [
    {
      id: "profile-front",
      layer: l3,
      material: "brass",
      shape: { kind: "poly", outer: rectRing(6, -2, 10, 2), holes: [] },
    },
  ];
  b.rect("Apoio traseiro", l1, -8, 12, 10, 2, "steel", { fixed: true });
  b.rect("Apoio intermediário", l2, 0, 5, 30, 2, "steel", { fixed: true });
  b.rect("Apoio frontal", l3, 8, 12, 10, 2, "steel", { fixed: true });
  return { scene: b.scene, piece };
}

export function profileSlotScene() {
  const b = new Builder("Rasgo no perfil");
  const l1 = b.layer("Base"),
    l2 = b.layer("Pino"),
    l3 = b.layer("Guia");
  const guide = b.circle("Guia multicamada", l1, 0, 0, 3, "aluminum", { fixed: true });
  guide.profiles = [
    {
      id: "guide-profile",
      layer: l3,
      shape: { kind: "poly", outer: rectRing(-25, -6, 25, 6), holes: [slotRing([-20, 0], [20, 0], 4)] },
    },
  ];
  const runner = b.circle("Cursor", l2, 0, 0, 3, "steel");
  const pin = b.link({ kind: "pin", host: runner.id, at: [0, 0], r: 1.9, layers: [l2, l3] });
  const slot = b.link({
    kind: "slot",
    pin: pin.id,
    guide: guide.id,
    profile: "guide-profile",
    hole: 0,
    mode: "joint",
  });
  return { scene: b.scene, runner, slot };
}

export function lockScene() {
  const b = new Builder("Trava: toque, sensor e fusível");
  const l1 = b.layer("Base"),
    l2 = b.layer("Móveis");
  const base = b.rect("Base", l1, 0, 0, 80, 12, "aluminum", { fixed: true });
  const weight = b.circle("Peso preso", l2, -15, 0, 3, "steel");
  const lock = b.link({ kind: "lock", a: base.id, b: weight.id, at: [0, 0] });
  const striker = b.circle("Acionador", l2, 15, -8, 1, "steel");
  b.link({ kind: "slider", a: base.id, b: striker.id, at: [0, 0], dir: Math.PI / 2, travel: [0, 8] });
  const sensor = b.link({
    kind: "sensor",
    host: base.id,
    at: [15, 0],
    r: 2,
    layers: [l2, l2],
    minSpeed: 0,
    actions: [],
  });
  return { scene: b.scene, weight, lock, sensor };
}

export function generateMulticamada() {
  const p = profilesScene();
  writeFixture("multicamada", "perfis", p.scene, {
    title: p.scene.meta.title,
    runs: [
      {
        name: "só toca nos planos ocupados",
        duration: 1,
        inputs: [],
        assertions: [
          {
            kind: "at",
            label: "Atravessa o apoio da camada 2 e repousa em 1 e 3",
            q: { part: p.piece.id, field: "y" },
            t: 0.8,
            min: 8.8,
            max: 9.1,
          },
          {
            kind: "span",
            label: "Repouso estável",
            q: { part: p.piece.id, field: "y" },
            from: 0.5,
            to: 1,
            max: 0.05,
          },
        ],
      },
    ],
  });
  const sl = profileSlotScene();
  writeFixture("multicamada", "rasgo-no-perfil", sl.scene, {
    title: sl.scene.meta.title,
    runs: [
      {
        name: "curso",
        duration: 0.5,
        inputs: [{ kind: "force", part: sl.runner.id, f: [0.01, 0], t0: 0, t1: 0.4 }],
        assertions: [
          {
            kind: "range",
            label: "Pino permanece na linha",
            q: { link: sl.slot.id, field: "deviation" },
            min: -0.05,
            max: 0.05,
          },
          {
            kind: "at",
            label: "Pino chega ao fim do rasgo do perfil",
            q: { part: sl.runner.id, field: "x" },
            t: 0.4,
            min: 19.8,
            max: 20.3,
          },
        ],
      },
    ],
  });
  const l = lockScene();
  const ramp: ScriptInput[] = Array.from({ length: 120 }, (_, i) => ({
    kind: "force",
    part: l.weight.id,
    t0: i / 240,
    t1: (i + 1) / 240,
    f: [0, i * 0.002],
  }));
  writeFixture("fixacoes", "trava", l.scene, {
    title: l.scene.meta.title,
    runs: [
      {
        name: "peso preso 3 s",
        duration: 3,
        inputs: [],
        assertions: [{ kind: "maxDisp", label: "Trava segura o peso", parts: [l.weight.id], max: 0.01 }],
      },
      {
        name: "toque e queda",
        duration: 0.3,
        inputs: [{ kind: "release", link: l.lock.id, t: 0.1 }],
        assertions: [
          {
            kind: "events",
            label: "Uma soltura por toque",
            event: "lock-released",
            match: { by: "touch" },
            min: 1,
            max: 1,
          },
          {
            kind: "at",
            label: "Queda em g ±5%",
            q: { part: l.weight.id, field: "y" },
            t: 0.3,
            min: 0.95 * 0.5 * 9810 * 0.2 ** 2,
            max: 1.05 * 0.5 * 9810 * 0.2 ** 2,
          },
        ],
      },
      {
        name: "fusível em rampa",
        duration: 0.5,
        patch: { [l.lock.id]: { breakForce: 0.1 } },
        inputs: ramp,
        assertions: [
          {
            kind: "events",
            label: "Uma soltura pelo fusível",
            event: "lock-released",
            match: { by: "force" },
            min: 1,
            max: 1,
          },
          {
            kind: "at",
            label: "Força ao soltar entre 0,9 e 1,1 do fusível",
            q: { link: l.lock.id, field: "force" },
            t: 0.5,
            min: 0.09,
            max: 0.11,
          },
        ],
      },
      {
        name: "sensor",
        duration: 0.2,
        patch: { [l.sensor.id]: { actions: [{ do: "release", target: l.lock.id }] } },
        inputs: [],
        assertions: [
          {
            kind: "events",
            label: "Sensor solta a trava",
            event: "lock-released",
            match: { by: "sensor" },
            min: 1,
            max: 1,
          },
          {
            kind: "at",
            label: "Peso livre depois do sensor",
            q: { link: l.lock.id, field: "released" },
            t: 0.2,
            min: 1,
            max: 1,
          },
        ],
      },
    ],
  });
}
