import type { Vec2 } from "@/geometry/vec";
import type { Gas } from "@/model/types";
import { P_ATM } from "@/model/units";
import type { Quantity } from "@/sim/script";
import { Builder, br, writeFixture } from "./builder";

/** Gás 2.0 (item 5.6): lei dos gases, recuo do fundo, portas e sensor. */

/** Cilindro em U, aberto à direita; o fundo interno fica no x local 0. */
export function cylinder(
  b: Builder,
  name: string,
  layer: string,
  x: number,
  y: number,
  len: number,
  w: number,
) {
  const t = 4;
  const outer: Vec2[] = [
    [-t, -w / 2 - t],
    [len, -w / 2 - t],
    [len, -w / 2],
    [0, -w / 2],
    [0, w / 2],
    [len, w / 2],
    [len, w / 2 + t],
    [-t, w / 2 + t],
  ];
  return b.poly(name, layer, x, y, outer, "steel", { fixed: true });
}

const gauge = (id: string, p0 = P_ATM): Quantity => ({
  diff: [{ link: id, field: "pressure" }, { const: p0 }],
});

export function generateGas(): void {
  // Lei dos gases
  {
    const b = new Builder("Lei dos gases");
    const L = b.layer("Cilindro", 3);
    const w = 10;
    const s0 = 10;
    const cyl = cylinder(b, "Cilindro", L, 0, 0, 70, w);
    const piston = b.rect("Pistão", L, s0 + 4, 0, 8, w - 0.2, "aluminum");
    const k = 1;
    const slider = b.link({
      kind: "slider",
      a: cyl.id,
      b: piston.id,
      at: [0, 0],
      dir: 0,
      travel: [-s0 + 0.5, 50],
      spring: { k, rest: 0, damping: 0.0008 },
    });
    const gasIso: Gas = { model: "isothermal", gamma: 1.4, p0: P_ATM, charge: { amount: 0.1, burnMs: 2 } };
    const chamber = b.link({
      kind: "chamber",
      body: cyl.id,
      at: [0, 0],
      dir: 0,
      bore: w,
      length: 70,
      walls: [{ part: piston.id, seal: 100 }],
      vents: [],
      ports: [],
      gas: gasIso,
    });
    const pv = (gamma: number) => ({ pv: chamber.id, gamma });
    const forceChecks = (t: number) => [
      {
        kind: "compare" as const,
        label: "a força do gás na parede = (P − P_atm) × A (±0,5%)",
        a: { gasForce: chamber.id, wall: 0, p0: P_ATM },
        b: { const: 1 },
        t,
        op: "ratio" as const,
        min: 0.995,
        max: 1.005,
      },
      {
        kind: "compare" as const,
        label: "e é a força que a carga (a mola do trilho) mede (±0,5%)",
        a: { abs: { link: slider.id, field: "force" } },
        b: { link: chamber.id, field: "walls.0.force" },
        t,
        op: "ratio" as const,
        min: 0.995,
        max: 1.005,
      },
    ];
    writeFixture("gas", "lei", b.scene, {
      title: "Lei dos gases",
      notes: `Cilindro fechado de Ø ${w} mm com um pistão de alumínio num trilho com mola de ${k} N/mm (a carga). A 0,1 s, 0,1 mmol de gás entra em 2 ms; o pistão avança e assenta onde a força do gás iguala a da mola. Ambiente a ${br(P_ATM, 3)} kPa.`,
      view: [-10, -15, 90, 30],
      runs: [
        {
          name: "isotérmica",
          duration: 1.5,
          inputs: [{ kind: "ignite", link: chamber.id, t: 0.1 }],
          assertions: [
            {
              kind: "relSpan",
              label: "isotérmica: P·V constante durante a expansão (±1%)",
              q: pv(1),
              from: 0.11,
              to: 1.5,
              max: 0.01,
            },
            ...forceChecks(1.5),
          ],
        },
        {
          name: "adiabática",
          duration: 1.5,
          patch: { [chamber.id]: { gas: { ...gasIso, model: "adiabatic" } } },
          inputs: [{ kind: "ignite", link: chamber.id, t: 0.1 }],
          assertions: [
            {
              kind: "relSpan",
              label: "adiabática: P·V^γ constante depois da queima (±1%)",
              q: pv(1.4),
              from: 0.11,
              to: 1.5,
              max: 0.01,
            },
            ...forceChecks(1.5),
          ],
        },
      ],
    });
  }

  // Recuo do fundo: cilindro de dois pistões
  {
    const b = new Builder("Recuo do fundo");
    const L = b.layer("Cilindro", 10);
    const w = 10;
    const L0 = 20;
    b.rect("Trilho de cima", L, 40, -w / 2 - 2.5, 140, 5, "steel", { fixed: true });
    b.rect("Trilho de baixo", L, 40, w / 2 + 2.5, 140, 5, "steel", { fixed: true });
    const piston = b.rect("Pistão (leve)", L, L0 + 5, 0, 10, w - 0.2, "steel");
    const block = b.rect("Bloco (pesado)", L, -20, 0, 40, w - 1, "steel");
    const slider = b.link({
      kind: "slider",
      a: null,
      b: block.id,
      at: [0, 0],
      dir: 0,
      travel: [-25, 0],
      spring: { k: 0.3, rest: 2, damping: 0.004 },
    });
    const chamber = b.link({
      kind: "chamber",
      body: null,
      at: [0, 0],
      dir: 0,
      bore: w,
      length: 100,
      walls: [
        { part: piston.id, seal: 200 },
        { part: block.id, seal: 200 },
      ],
      vents: [{ at: 40, d: 6, open: true }],
      ports: [],
      gas: { model: "adiabatic", gamma: 1.4, p0: P_ATM, charge: { amount: 0.128, burnMs: 8 } },
    });
    writeFixture("gas", "recuo", b.scene, {
      title: "Cilindro de dois pistões (cena de teste)",
      notes:
        "Corpo fixo; a câmara fica entre um pistão leve (7,7 g), livre no furo, e um bloco pesado (28 g) num trilho com mola de retorno pré-carregada contra o batente. Respiro de Ø 6 mm a 40 mm do fundo. A 0,1 s a carga acende (gás adiabático, queima de 8 ms).",
      view: [-50, -40, 170, 80],
      runs: [
        {
          name: "disparo",
          duration: 1.3,
          inputs: [{ kind: "ignite", link: chamber.id, t: 0.1 }],
          assertions: [
            {
              kind: "span",
              label: "os dois se afastam: o bloco recua",
              q: { link: slider.id, field: "translation" },
              from: 0.1,
              to: 0.4,
              min: 0.3,
            },
            {
              kind: "at",
              label: "e o pistão avança pelo furo",
              q: { part: piston.id, along: [1, 0] },
              t: 0.2,
              min: 30,
            },
            {
              kind: "while",
              label: "vedada, os impulsos nas duas paredes são iguais e opostos (±2%)",
              cond: { link: chamber.id, field: "vents.0.exposed" },
              condMax: 0,
              q: {
                div: [
                  {
                    sum: [
                      { link: chamber.id, field: "walls.0.impulse" },
                      { link: chamber.id, field: "walls.1.impulse" },
                    ],
                  },
                  { sum: [{ abs: { link: chamber.id, field: "walls.0.impulse" } }, { const: 1e-12 }] },
                ],
              },
              min: -0.02,
              max: 0.02,
              from: 0.1,
            },
            {
              kind: "at",
              label: "a mola devolve o bloco à posição inicial (±0,2 mm) em até 1 s",
              q: { part: block.id, disp: true },
              t: 1.1,
              max: 0.2,
            },
            {
              kind: "dropsAfter",
              label: "quando o pistão passa o respiro, a pressão cai abaixo de 5% do pico em até 20 ms",
              q: gauge(chamber.id),
              event: "vent-opened",
              match: { chamber: chamber.id },
              fraction: 0.05,
              within: 0.02,
            },
          ],
        },
      ],
    });
  }

  // Portas
  {
    const b = new Builder("Portas");
    const L1 = b.layer("Cilindro A", 3);
    const L2 = b.layer("Cilindro B", 3);
    const w = 10;
    const cylA = cylinder(b, "Cilindro A", L1, 0, 0, 80, w);
    const pA = b.rect("Pistão A", L1, 14, 0, 8, w - 0.2, "aluminum");
    b.link({
      kind: "slider",
      a: cylA.id,
      b: pA.id,
      at: [0, 0],
      dir: 0,
      travel: [-9.5, 45],
      spring: { k: 0.05, rest: 0, damping: 0.0002 },
    });
    const cylB = cylinder(b, "Cilindro B", L2, 0, 30, 80, w);
    const pB = b.rect("Pistão B", L2, 14, 30, 8, w - 0.2, "aluminum");
    const sB = b.link({
      kind: "slider",
      a: cylB.id,
      b: pB.id,
      at: [0, 0],
      dir: 0,
      travel: [-9.5, 60],
      spring: { k: 0.05, rest: 0, damping: 0.0002 },
    });
    const gas = (amount: number): Gas => ({
      model: "isothermal",
      gamma: 1.4,
      p0: P_ATM,
      ...(amount > 0 ? { charge: { amount, burnMs: 2 } } : {}),
    });
    const chB = b.link({
      kind: "chamber",
      body: cylB.id,
      at: [0, 0],
      dir: 0,
      bore: w,
      length: 80,
      walls: [{ part: pB.id, seal: 200 }],
      vents: [],
      ports: [],
      gas: gas(0),
    });
    const chA = b.link({
      kind: "chamber",
      body: cylA.id,
      at: [0, 0],
      dir: 0,
      bore: w,
      length: 80,
      walls: [{ part: pA.id, seal: 200 }],
      vents: [],
      ports: [{ to: chB.id, at: 25, d: 3 }],
      gas: gas(0.15),
    });
    writeFixture("gas", "portas", b.scene, {
      title: "Portas entre câmaras",
      notes:
        "Dois cilindros com pistão e mola. A câmara A tem uma porta de Ø 3 mm a 25 mm do fundo que leva à câmara B; o pistão A cobre a porta até avançar. A 0,1 s a carga de A acende.",
      view: [-10, -15, 100, 60],
      runs: [
        {
          name: "disparo",
          duration: 1,
          inputs: [{ kind: "ignite", link: chA.id, t: 0.1 }],
          assertions: [
            {
              kind: "onlyAfter",
              label: "o segundo pistão só se move depois que a porta é descoberta",
              q: { link: sB.id, field: "translation" },
              threshold: 0.01,
              event: "port-opened",
              match: { chamber: chA.id },
            },
            {
              kind: "at",
              label: "com a porta aberta, as pressões se igualam (diferença < 1% no fim)",
              t: 1,
              q: {
                div: [
                  {
                    abs: {
                      diff: [
                        { link: chA.id, field: "pressure" },
                        { link: chB.id, field: "pressure" },
                      ],
                    },
                  },
                  { link: chA.id, field: "pressure" },
                ],
              },
              min: 0,
              max: 0.01,
            },
            {
              kind: "at",
              label: "e a porta continua aberta",
              t: 1,
              q: { link: chA.id, field: "ports.0.exposed" },
              min: 0.2,
            },
          ],
        },
      ],
    });
  }

  // Sensor
  {
    const b = new Builder("Sensor");
    const L = b.layer("Bancada", 3);
    const w = 10;
    const plate = b.rect("Suporte do sensor", L, -20, 0, 8, 30, "steel", { fixed: true });
    b.rect("Piso", L, 0, 45, 30, 10, "steel", { fixed: true });
    const r = 3;
    const ball1 = b.circle("Esfera 1", L, 0, -7 - 10, r, "steel");
    const ball2 = b.circle("Esfera 2", L, 0, -7 - 60, r, "steel");
    const cyl = cylinder(b, "Cilindro", L, 30, 0, 70, w);
    const piston = b.rect("Pistão", L, 30 + 14, 0, 8, w - 0.2, "aluminum");
    b.link({
      kind: "slider",
      a: cyl.id,
      b: piston.id,
      at: [0, 0],
      dir: 0,
      travel: [-9.5, 50],
      spring: { k: 0.2, rest: 0, damping: 0.0005 },
    });
    const chamber = b.link({
      kind: "chamber",
      body: cyl.id,
      at: [0, 0],
      dir: 0,
      bore: w,
      length: 70,
      walls: [{ part: piston.id, seal: 200 }],
      vents: [{ at: 4, d: 3, open: false }],
      ports: [],
      gas: { model: "isothermal", gamma: 1.4, p0: P_ATM, charge: { amount: 0.05, burnMs: 2 } },
    });
    const sensor = b.link({
      kind: "sensor",
      host: plate.id,
      at: [20, 0],
      r: 4,
      layers: [L, L],
      minSpeed: 300,
      actions: [{ do: "open", target: chamber.id, vent: 0 }],
    });
    const far = { [ball2.id]: { x: -60 } };
    const low = { [ball1.id]: { y: -7 - 1 } };
    const ignite = [{ do: "ignite" as const, target: chamber.id }];
    writeFixture("gas", "sensor", b.scene, {
      title: "Sensor",
      notes:
        "Esferas de aço caem através de um sensor (Ø 8 mm, impacto mínimo 300 mm/s). Na primeira execução, o sensor abre o respiro de uma câmara já acesa; nas outras, acende a câmara. De 10 mm de altura a esfera passa a 443 mm/s; de 1 mm, a 140 mm/s.",
      view: [-35, -80, 115, 135],
      runs: [
        {
          name: "abre o respiro",
          duration: 0.6,
          override: far,
          inputs: [{ kind: "ignite", link: chamber.id, t: 0.02 }],
          assertions: [
            {
              kind: "events",
              label: "acima do mínimo, o sensor abre o respiro",
              event: "vent-opened",
              match: { chamber: chamber.id, by: "sensor" },
              min: 1,
              max: 1,
            },
            {
              kind: "dropsAfter",
              label: "e o gás escapa (abaixo de 5% do pico em 20 ms)",
              q: gauge(chamber.id),
              event: "vent-opened",
              match: { chamber: chamber.id },
              fraction: 0.05,
              within: 0.02,
            },
          ],
        },
        {
          name: "abaixo do mínimo",
          duration: 0.6,
          override: { ...far, ...low },
          inputs: [{ kind: "ignite", link: chamber.id, t: 0.02 }],
          assertions: [
            { kind: "events", label: "abaixo do mínimo, nada acontece (sensor)", event: "sensor", max: 0 },
            {
              kind: "events",
              label: "abaixo do mínimo, nada acontece (respiro)",
              event: "vent-opened",
              max: 0,
            },
          ],
        },
        {
          name: "acende",
          duration: 0.6,
          override: far,
          patch: { [sensor.id]: { actions: ignite } },
          inputs: [],
          assertions: [
            {
              kind: "events",
              label: "numa segunda cena, o sensor acende a câmara",
              event: "chamber-fired",
              min: 1,
              max: 1,
            },
            { kind: "at", label: "e o pistão avança", q: { part: piston.id, along: [1, 0] }, t: 0.6, min: 1 },
          ],
        },
        {
          name: "dois toques",
          duration: 0.8,
          patch: { [sensor.id]: { actions: ignite } },
          inputs: [],
          assertions: [
            {
              kind: "events",
              label: "dois toques seguidos: o sensor conta os dois",
              event: "sensor",
              min: 2,
              max: 2,
            },
            { kind: "events", label: "mas a câmara não reacende", event: "chamber-fired", min: 1, max: 1 },
          ],
        },
      ],
    });
  }

  // Cargas: a mesma câmara acende de novo a cada toque enquanto houver dose
  {
    const b = new Builder("Cargas");
    const L = b.layer("Bancada", 3);
    const w = 10;
    const plate = b.rect("Suporte do sensor", L, -20, 0, 8, 30, "steel", { fixed: true });
    b.rect("Piso", L, 0, 45, 30, 10, "steel", { fixed: true });
    const r = 3;
    const e1 = b.circle("Esfera 1", L, 0, -7 - 10, r, "steel");
    const e2 = b.circle("Esfera 2", L, 0, -7 - 60, r, "steel");
    const cyl = cylinder(b, "Cilindro", L, 30, 0, 70, w);
    const piston = b.rect("Pistão", L, 30 + 14, 0, 8, w - 0.2, "aluminum");
    b.link({
      kind: "slider",
      a: cyl.id,
      b: piston.id,
      at: [0, 0],
      dir: 0,
      travel: [-9.5, 50],
      spring: { k: 0.2, rest: 0, damping: 0.0005 },
    });
    const gas = (shots?: number): Gas => ({
      model: "isothermal",
      gamma: 1.4,
      p0: P_ATM,
      charge: { amount: 0.02, burnMs: 2, ...(shots ? { shots } : {}) },
    });
    const chamber = b.link({
      kind: "chamber",
      body: cyl.id,
      at: [0, 0],
      dir: 0,
      bore: w,
      length: 70,
      walls: [{ part: piston.id, seal: 200 }],
      vents: [{ at: 4, d: 1, open: true }],
      ports: [],
      gas: gas(2),
    });
    b.link({
      kind: "sensor",
      host: plate.id,
      at: [20, 0],
      r: 4,
      layers: [L, L],
      minSpeed: 300,
      actions: [{ do: "ignite", target: chamber.id }],
    });
    writeFixture("gas", "cargas", b.scene, {
      title: "Cargas da câmara",
      notes:
        "Uma câmara com reservatório de duas doses (charge.shots = 2): cada toque no sensor acende uma dose. Sem shots, a carga acende uma vez só, como antes. O respiro aberto esvazia a câmara entre um toque e outro.",
      view: [-35, -80, 115, 135],
      runs: [
        {
          name: "duas doses, dois toques",
          duration: 0.8,
          inputs: [],
          assertions: [
            { kind: "events", label: "o sensor conta os dois toques", event: "sensor", min: 2, max: 2 },
            {
              kind: "events",
              label: "e a câmara acende duas vezes",
              event: "chamber-fired",
              min: 2,
              max: 2,
            },
            {
              kind: "at",
              label: "o estado conta as duas doses",
              q: { link: chamber.id, field: "shots" },
              t: 0.8,
              min: 2,
              max: 2,
            },
          ],
        },
        {
          name: "uma dose (padrão), dois toques",
          duration: 0.8,
          patch: { [chamber.id]: { gas: gas() } },
          inputs: [],
          assertions: [
            { kind: "events", label: "o sensor conta os dois toques", event: "sensor", min: 2, max: 2 },
            {
              kind: "events",
              label: "mas a câmara acende uma vez só",
              event: "chamber-fired",
              min: 1,
              max: 1,
            },
          ],
        },
        {
          name: "durante a queima",
          duration: 0.3,
          override: { [e1.id]: { x: -60 }, [e2.id]: { x: -60 } },
          patch: { [chamber.id]: { gas: { ...gas(2), charge: { amount: 0.02, burnMs: 20, shots: 2 } } } },
          inputs: [
            { kind: "ignite", link: chamber.id, t: 0.01 },
            { kind: "ignite", link: chamber.id, t: 0.02 },
            { kind: "ignite", link: chamber.id, t: 0.1 },
          ],
          assertions: [
            {
              kind: "at",
              label: "um acendimento durante a queima não gasta dose; depois dela, gasta",
              q: { link: chamber.id, field: "shots" },
              t: 0.3,
              min: 2,
              max: 2,
            },
            {
              kind: "at",
              label: "no meio da queima, uma dose só",
              q: { link: chamber.id, field: "shots" },
              t: 0.05,
              min: 1,
              max: 1,
            },
          ],
        },
      ],
    });
  }
}
