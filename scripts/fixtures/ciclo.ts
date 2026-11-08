import type { Vec2 } from "@/geometry/vec";
import type { Part } from "@/model/types";
import { P_ATM } from "@/model/units";
import { CAPSULE_DEFAULTS, capsuleGeometry, type CapsuleParams } from "@/parts/capsule";
import { buildPlan } from "@/engine/plan";
import type { Quantity, ScriptAssertion, ScriptInput } from "@/sim/script";
import { Builder, br, r4, writeFixture } from "./builder";

/**
 * Ciclo (Fase 2 · M2a): a cápsula, a câmara que recebe cápsula, o extrator e
 * o ejetor. Mecanismos genéricos e esquemáticos, proporções inventadas, gás
 * didático, projétil esférico. Coordenadas do mundo em mm, x para a frente
 * (a boca à direita) e y para baixo; o eixo do cano é y = 0.
 */

export const CICLO = {
  /** espessura da camada da ação: a esfera de Ø 6 mm com a massa da do Lançador */
  thickness: 4,
  /** fundo do estojo (o aro) encostado na face de trás do cano */
  breech: 0,
  /** folga do corpo do estojo na câmara do cano, no diâmetro */
  chamberPlay: 0.2,
  /** parede do cano */
  wall: 3,
  /** quanto do fundo do estojo fica fora da face do cano além da canaleta (a garra do extrator entra aí) */
  exposed: 0.6,
  /** assento da câmara de cápsula, mm */
  seat: 1,
  /** meia altura do canal do percussor */
  pinChannel: 0.7,
};

export interface CapsuleParts {
  case: Part;
  ball: Part;
  geo: ReturnType<typeof capsuleGeometry>;
}

/** Cápsula com a esfera presa na boca; `rear` é o x do fundo do estojo (o aro) no mundo. */
export function capsuleAt(
  b: Builder,
  layer: string,
  rear: number,
  y: number,
  params: Partial<CapsuleParams> = {},
  name = "Cápsula",
): CapsuleParts {
  const p = { ...CAPSULE_DEFAULTS, ...params };
  const geo = capsuleGeometry(p);
  const cx = r4(rear + p.length / 2);
  const kase = b.poly(name, layer, cx, y, geo.outer, "brass");
  const ball = b.circle("Esfera", layer, r4(cx + geo.ball.at[0]), y, geo.ball.r, "steel", { fast: true });
  kase.capsule = { ...geo.capsule, projectile: ball.id };
  kase.source = { generator: "capsule", params: { ...p } };
  return { case: kase, ball, geo };
}

/**
 * Cano fixo em duas metades (cima e baixo): a câmara do estojo atrás, com o
 * fundo do estojo (aro e canaleta) para fora da face de trás, e o furo da
 * esfera à frente. O estojo assenta pela boca no degrau entre a câmara e o
 * furo. `face` é o x da face de trás; `length`, o furo depois da câmara.
 */
export function barrel(
  b: Builder,
  layer: string,
  geo: CapsuleParts["geo"],
  length: number,
  opts: { face?: number; fixed?: boolean; name?: string } = {},
) {
  const face = opts.face ?? CICLO.breech;
  const x0 = geo.outer[0]![0];
  const exposed = r4(geo.grooveEnd - x0 + CICLO.exposed);
  const caseLen = geo.capsule.mouth[0] - x0;
  const chamberLen = r4(caseLen - exposed);
  const hc = r4(geo.bodyHalf + CICLO.chamberPlay / 2);
  const hb = r4(geo.ball.r + 0.1);
  const ho = r4(hc + CICLO.wall);
  const muzzle = r4(face + chamberLen + length);
  // entrada chanfrada: o estojo que chega do carregador um pouco caído entra sem enganchar
  const side = (sgn: 1 | -1): Vec2[] => [
    [face, sgn * ho],
    [muzzle, sgn * ho],
    [muzzle, sgn * hb],
    // cone de entrada do furo: a esfera de um estojo um pouco caído sobe nele
    [r4(face + chamberLen + 1.2), sgn * hb],
    [face + chamberLen, sgn * r4(hb + 0.5)],
    [face + chamberLen, sgn * hc],
    [face + 1, sgn * hc],
    [face, sgn * r4(hc + 0.5)],
  ];
  const fixed = opts.fixed ?? true;
  const cx = r4((face + muzzle) / 2);
  const loc = (pts: Vec2[], cy: number) => pts.map(([x, yy]) => [r4(x - cx), r4(yy - cy)] as Vec2);
  const cyTop = r4(-(ho + hb) / 2);
  const cyBot = r4((ho + hb) / 2);
  const top = b.poly(
    `${opts.name ?? "Cano"} (cima)`,
    layer,
    cx,
    cyTop,
    loc(side(-1).reverse(), cyTop),
    "steel",
    {
      fixed,
    },
  );
  const bottom = b.poly(opts.name ?? "Cano", layer, cx, cyBot, loc(side(1), cyBot), "steel", { fixed });
  /** onde fica o fundo do estojo assentado (o fundo da câmara de cápsula) */
  const seatX = r4(face - exposed);
  const chamber = b.link({
    kind: "chamber",
    mode: "capsule",
    seat: CICLO.seat,
    body: bottom.id,
    at: [r4(seatX - bottom.x), r4(-bottom.y)],
    dir: 0,
    bore: r4(2 * hc),
    length: r4(muzzle - seatX),
    walls: [],
    vents: [],
    ports: [],
    gas: { model: "adiabatic", gamma: 1.4, p0: P_ATM },
  });
  return { top, bottom, chamber, face, muzzle, seatX, chamberLen, hc, hb, ho };
}

/** Culatra fixa: dois blocos com o canal do percussor no eixo, a face em x = `face`. */
export function breechBlock(b: Builder, layer: string, face: number, half: number, depth = 14) {
  const ch = CICLO.pinChannel;
  const up = b.rect(
    "Culatra (cima)",
    layer,
    r4(face - depth / 2),
    r4(-(half + ch) / 2),
    depth,
    r4(half - ch),
    "steel",
    {
      fixed: true,
    },
  );
  const down = b.rect(
    "Culatra",
    layer,
    r4(face - depth / 2),
    r4((half + ch) / 2),
    depth,
    r4(half - ch),
    "steel",
    {
      fixed: true,
    },
  );
  return { up, down };
}

/** Percussor: pino leve de aço que corre no canal; a ponta em x = `tip`. */
export function strikerPin(b: Builder, layer: string, tip: number, len = 10) {
  const h = r4(2 * CICLO.pinChannel - 0.2);
  const pin = b.rect("Percussor", layer, r4(tip - len / 2), 0, len, h, "steel");
  // colisão contínua: a 1,5 m/s ele anda 6 mm num passo e atravessaria o estojo
  pin.fast = true;
  return pin;
}

/** Velocidade ao longo de x. */
const vx = (part: string): Quantity => ({ part, vel: [1, 0] });
const xOf = (part: string): Quantity => ({ part, field: "x" });

/** Massa de uma peça no motor (g), pela geometria. */
function massOf(scene: Parameters<typeof buildPlan>[0], id: string): number {
  const plan = buildPlan(scene);
  return plan.bodies[plan.partRel.get(id)!.body]!.mass;
}

export function buildLivre() {
  // vista de cima da bancada: sem gravidade, nada de fora mexe no estojo nem na esfera
  const b = new Builder("Cápsula livre", 0);
  const L = b.layer("Ação", CICLO.thickness);
  const cap = capsuleAt(b, L, 0, 0);
  // percussor de teste: um pino leve de polímero (0,04 g), com colisão contínua
  const tip = 0.5;
  const striker = b.poly(
    "Percussor",
    L,
    -14,
    0,
    [
      [-4, -tip],
      [3.5, -tip],
      [3.5, tip],
      [-4, tip],
    ],
    "polymer",
  );
  striker.fast = true;
  return { b, L, cap, striker };
}

/** Cápsula assentada num cano fixo, com a culatra fixa atrás e o percussor no canal dela. */
export function buildCano(length: number, charge = CAPSULE_DEFAULTS.charge) {
  const b = new Builder("Cápsula no cano");
  const L = b.layer("Ação", CICLO.thickness);
  const geo = capsuleGeometry(CAPSULE_DEFAULTS);
  const brl = barrel(b, L, geo, length);
  const cap = capsuleAt(b, L, brl.seatX, 0, { charge });
  breechBlock(b, L, brl.seatX, brl.ho);
  const striker = strikerPin(b, L, r4(brl.seatX - 0.5));
  return { b, L, cap, brl, striker };
}

/**
 * Ferrolho num trilho do fundo: bloco com a face em x local 0, o canal do
 * percussor no eixo (aberto na face) e, opcionalmente, o rasgo do ejetor
 * embaixo (aberto na face).
 */
export function boltShape(opts: { len?: number; half?: number; ejector?: [number, number, number] } = {}) {
  const len = opts.len ?? 30;
  const h = opts.half ?? 4;
  const ch = CICLO.pinChannel;
  const pts: Vec2[] = [
    [-len, -h],
    [0, -h],
    [0, -ch],
    [-12, -ch],
    [-12, ch],
    [0, ch],
  ];
  if (opts.ejector) {
    const [y0, y1, depth] = opts.ejector;
    pts.push([0, y0], [-depth, y0], [-depth, y1], [0, y1]);
  }
  pts.push([0, h], [-len, h]);
  return pts.map(([x, y]) => [r4(x), r4(y)] as Vec2);
}

/** O ferrolho empurra a cápsula do carregador até o cano, a 600 mm/s (a mão no roteiro). */
export function buildEmpurrada() {
  const b = new Builder("Cápsula empurrada");
  const L = b.layer("Ação", CICLO.thickness);
  const geo = capsuleGeometry(CAPSULE_DEFAULTS);
  const brl = barrel(b, L, geo, 30);
  const feed = 25;
  const rear = r4(brl.seatX - feed);
  // carregador: a bandeja onde a cápsula espera, deitada sobre o aro, atrás do cano
  const tray = b.rect(
    "Carregador",
    L,
    r4((rear - 14 + brl.face) / 2),
    r4(geo.rimHalf + 2),
    r4(brl.face - rear + 14),
    4,
    "steel",
    {
      fixed: true,
    },
  );
  const cap = capsuleAt(b, L, rear, 0);
  const gap = 2;
  const face = r4(rear - gap);
  const half = r4(geo.rimHalf - 0.15);
  const bolt = b.poly("Ferrolho", L, face, 0, boltShape({ half }), "steel");
  // colisão contínua contra o estojo: a 600 mm/s o ferrolho anda 2,5 mm num passo
  bolt.fast = true;
  const striker = strikerPin(b, L, r4(face - 1.5));
  // solto no canal do ferrolho (com um trilho no ferrolho o Box2D não registra o
  // golpe na espoleta: ver docs/verificacao-fase-2-m2a.md)
  const slider = b.link({
    kind: "slider",
    a: null,
    b: bolt.id,
    at: [0, 0],
    dir: 0,
    travel: [0, r4(feed + gap)],
  });
  return { b, L, geo, brl, tray, cap, bolt, striker, slider, feed, gap, face };
}

/** Variante de um roteiro com o cano de outro comprimento (forma e posição das duas metades e a câmara). */
function barrelPatch(length: number): Record<string, Record<string, unknown>> {
  const { brl } = buildCano(length);
  return {
    [brl.top.id]: { x: brl.top.x, y: brl.top.y, shape: brl.top.shape },
    [brl.bottom.id]: { x: brl.bottom.x, y: brl.bottom.y, shape: brl.bottom.shape },
    [brl.chamber.id]: { length: brl.chamber.length, at: brl.chamber.at },
  };
}

/** Comprimentos do cano (depois da câmara) nas duas variantes de capsula-no-cano. */
export const BARRELS = { short: 10, long: 40 };

export function generateCiclo(): void {
  // ——— cápsula livre ———
  {
    const { b, cap, striker } = buildLivre();
    const mc = massOf(b.scene, cap.case.id);
    const mb = massOf(b.scene, cap.ball.id);
    const r = mb / mc;
    const strike = 0.05;
    writeFixture("ciclo", "capsula-livre", b.scene, {
      title: "Cápsula livre",
      notes: `Cápsula solta na bancada (vista de cima, sem gravidade), golpeada na espoleta por um pino leve de polímero a 1,2 m/s. A esfera sai pela boca do estojo e o estojo recua: estojo de ${br(mc, 3)} g, esfera de ${br(mb, 3)} g, carga média (${br(cap.case.capsule!.charge, 3)} mmol). Ambiente a ${br(P_ATM, 3)} kPa.`,
      view: [-30, -20, 120, 40],
      runs: [
        {
          name: "golpe",
          duration: 0.2,
          inputs: [{ kind: "velocity", part: striker.id, t: strike, v: [1200, 0], omega: 0 }],
          assertions: [
            { kind: "events", label: "a cápsula dispara uma vez", event: "capsule-fired", min: 1, max: 1 },
            {
              kind: "range",
              label: "não dispara antes do golpe",
              q: { link: cap.case.id, field: "fired" },
              to: strike,
              max: 0,
            },
            {
              kind: "at",
              label: "a esfera sai pela boca do estojo (a mais de 20 mm dela)",
              q: { diff: [xOf(cap.ball.id), xOf(cap.case.id)] },
              t: 0.1,
              min: cap.geo.capsule.mouth[0] + 20,
            },
            {
              kind: "compare",
              label: `a quantidade de movimento fecha: m_estojo·v_estojo = m_esfera·v_esfera ±5% (v_estojo/v_esfera = −${br(r, 3)})`,
              a: vx(cap.case.id),
              b: vx(cap.ball.id),
              t: 0.1,
              op: "ratio",
              min: r4(-r * 1.05),
              max: r4(-r * 0.95),
            },
            {
              kind: "at",
              label: "a esfera sai a 5–25 m/s",
              q: vx(cap.ball.id),
              t: 0.1,
              min: 5000,
              max: 25000,
            },
          ],
        },
      ],
    });
  }

  // ——— cápsula no cano ———
  {
    const { b, cap, brl, striker } = buildCano(BARRELS.long);
    const exitSpeed = (min: number, max: number, label: string, muzzle: number): ScriptAssertion => ({
      kind: "while",
      label,
      cond: xOf(cap.ball.id),
      condMin: muzzle,
      condMax: muzzle + 300,
      q: vx(cap.ball.id),
      min,
      max,
      peak: true,
    });
    const common = (muzzle: number): ScriptAssertion[] => [
      { kind: "events", label: "capsule-fired aparece uma vez", event: "capsule-fired", min: 1, max: 1 },
      {
        kind: "range",
        label: "golpear de novo a cápsula deflagrada não acende nada (o gás fica no ambiente)",
        q: { link: cap.case.id, field: "pressure" },
        from: 0.2,
        max: P_ATM + 0.5,
      },
      {
        kind: "maxDisp",
        label: "o estojo fica assentado (a culatra fixa segura o recuo)",
        parts: [cap.case.id],
        max: 0.3,
      },
      {
        kind: "at",
        label: "a esfera sai pela boca do cano",
        q: xOf(cap.ball.id),
        t: 0.2,
        min: muzzle + 50,
      },
    ];
    const strikes: ScriptInput[] = [
      { kind: "velocity", part: striker.id, t: 0.05, v: [1500, 0], omega: 0 },
      { kind: "velocity", part: striker.id, t: 0.25, v: [1500, 0], omega: 0 },
    ];
    const shortMuzzle = r4(brl.muzzle - BARRELS.long + BARRELS.short);
    writeFixture("ciclo", "capsula-no-cano", b.scene, {
      title: "Cápsula no cano",
      notes: `Cápsula assentada num cano fixo (o estojo assenta pela boca no degrau da câmara), culatra fixa atrás com o percussor no canal. O percussor golpeia a 1,5 m/s em 0,05 s e de novo em 0,25 s. Com o cano mais longo, o gás empurra a esfera por mais tempo e ela sai mais rápida (${BARRELS.short} mm × ${BARRELS.long} mm de furo depois da câmara).`,
      view: [-30, -20, 110, 40],
      runs: [
        {
          name: `cano de ${BARRELS.long} mm`,
          duration: 0.4,
          inputs: strikes,
          assertions: [
            ...common(brl.muzzle),
            exitSpeed(
              19000,
              21500,
              "com o cano longo a esfera sai a 19–21,5 m/s (mais rápida que no curto)",
              brl.muzzle,
            ),
          ],
        },
        {
          name: `cano de ${BARRELS.short} mm`,
          duration: 0.4,
          patch: barrelPatch(BARRELS.short),
          inputs: strikes,
          assertions: [
            ...common(shortMuzzle),
            exitSpeed(
              15000,
              18900,
              "com o cano curto a esfera sai a 15–18,9 m/s (mais lenta que no longo)",
              shortMuzzle,
            ),
          ],
        },
      ],
    });
  }

  // ——— cápsula empurrada ———
  {
    const { b, cap, bolt, striker, brl, feed } = buildEmpurrada();
    const grip: Vec2 = [r4(bolt.x - 20), r4(bolt.y - 2)];
    const t0 = 0.1;
    const t1 = r4(t0 + (feed + 6) / 600);
    const strike = 0.45;
    const ballLocal: Vec2 = [r4(cap.ball.x - cap.case.x), r4(cap.ball.y - cap.case.y)];
    writeFixture("ciclo", "capsula-empurrada", b.scene, {
      title: "Cápsula empurrada",
      notes: `O ferrolho, puxado pela mão a 600 mm/s, empurra a cápsula do carregador ${feed} mm até assentar no cano. A esfera continua presa na boca: a solda só solta no golpe na espoleta (o ferrolho bate a 0,6 m/s, abaixo dos ${cap.case.capsule!.minStrike} mm/s do golpe mínimo). Em ${strike} s o percussor golpeia e a esfera sai.`,
      view: [-50, -20, 110, 40],
      runs: [
        {
          name: "alimentação",
          duration: 0.7,
          inputs: [
            {
              kind: "drag",
              part: bolt.id,
              from: grip,
              to: [r4(grip[0] + feed + 6), grip[1]],
              t0,
              t1,
              release: 0.6,
            },
            { kind: "velocity", part: striker.id, t: strike, v: [1500, 0], omega: 0 },
          ],
          assertions: [
            {
              kind: "range",
              label: "a esfera não solta antes do golpe (fica a menos de 0,05 mm da boca)",
              q: {
                dist: [
                  { part: cap.ball.id, at: [0, 0] },
                  { part: cap.case.id, at: ballLocal },
                ],
              },
              to: strike,
              max: 0.05,
            },
            {
              kind: "range",
              label: "e a cápsula não dispara antes do golpe",
              q: { link: cap.case.id, field: "fired" },
              to: strike,
              max: 0,
            },
            {
              kind: "at",
              label: `a cápsula anda ${feed} mm e assenta no cano (±0,3 mm)`,
              q: { part: cap.case.id, along: [1, 0] },
              t: strike - 0.01,
              min: feed - 0.3,
              max: feed + 0.3,
            },
            { kind: "events", label: "o golpe dispara uma vez", event: "capsule-fired", min: 1, max: 1 },
            {
              kind: "while",
              label:
                "e a esfera sai pela boca do cano a mais de 5 m/s (o ferrolho solto recua junto com o estojo)",
              cond: xOf(cap.ball.id),
              condMin: brl.muzzle,
              condMax: brl.muzzle + 300,
              q: vx(cap.ball.id),
              min: 5000,
              peak: true,
            },
          ],
        },
      ],
    });
  }
}
