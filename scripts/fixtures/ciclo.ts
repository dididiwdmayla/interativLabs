import type { Vec2 } from "@/geometry/vec";
import type { Part } from "@/model/types";
import { P_ATM } from "@/model/units";
import { CAPSULE_DEFAULTS, CAPSULE_PROPORTIONS, capsuleGeometry, type CapsuleParams } from "@/parts/capsule";
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
  /** rebaixo da face do ferrolho em volta da espoleta: meia altura e profundidade (mm) */
  faceRecess: [3.3, 0.6] as [number, number],
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

/** Estojo vazio (sem esfera e sem carga): o que o extrator puxa nas cenas de extração. */
export function emptyCaseAt(b: Builder, layer: string, rear: number, y: number, name = "Estojo") {
  const p = { ...CAPSULE_DEFAULTS };
  const geo = capsuleGeometry(p);
  const kase = b.poly(name, layer, r4(rear + p.length / 2), y, geo.outer, "brass");
  kase.capsule = { ...geo.capsule, charge: 0 };
  kase.source = { generator: "capsule", params: { ...p } };
  return { case: kase, geo };
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
export function boltShape(
  opts: {
    len?: number;
    half?: number;
    ejector?: [number, number, number];
    pocket?: [number, number, number];
    /** rebaixo da face em volta da espoleta (o ferrolho que alimenta a cápsula) */
    recess?: boolean;
  } = {},
) {
  const len = opts.len ?? 30;
  const h = opts.half ?? 4;
  const ch = CICLO.pinChannel;
  const pts: Vec2[] = [[-len, -h]];
  if (opts.pocket) {
    const [x0, x1, y] = opts.pocket;
    pts.push([x0, -h], [x0, y], [x1, y], [x1, -h]);
  }
  // rebaixo da face em volta da espoleta: a face só encosta no fundo do estojo fora dela
  const [rh, rd] = opts.recess ? CICLO.faceRecess : [CICLO.pinChannel, 0];
  if (opts.recess) pts.push([0, -h], [0, -rh], [-rd, -rh], [-rd, -ch], [-12, -ch], [-12, ch], [-rd, ch]);
  else pts.push([0, -h], [0, -ch], [-12, -ch], [-12, ch]);
  if (opts.ejector) {
    // o rasgo do ejetor (mais embaixo) se junta ao rebaixo
    const [y0, y1, depth] = opts.ejector;
    if (opts.recess) pts.push([-rd, y0], [-depth, y0], [-depth, y1], [0, y1]);
    else pts.push([0, ch], [0, y0], [-depth, y0], [-depth, y1], [0, y1]);
  } else if (opts.recess) pts.push([-rd, rh], [0, rh]);
  else pts.push([0, ch]);
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
  const bolt = b.poly("Ferrolho", L, face, 0, boltShape({ half, recess: true }), "steel");
  // colisão contínua contra o estojo: a 600 mm/s o ferrolho anda 2,5 mm num passo
  bolt.fast = true;
  const striker = strikerPin(b, L, r4(face - 1.5));
  // guiado por um trilho do ferrolho, com mola de retorno: quando o ferrolho
  // para no assento, ele não chega na espoleta por inércia (0,6 m/s contra a mola)
  striker.fast = false;
  b.link({
    kind: "slider",
    a: bolt.id,
    b: striker.id,
    at: [0, 0],
    dir: 0,
    travel: [-1, 3],
    spring: { k: 0.08, rest: 0, damping: 0.00001 },
  });
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

/**
 * Extração: estojo vazio assentado num cano fixo, ferrolho num trilho do
 * fundo com o extrator cravado (gancho num eixo com mola de torção, a garra na
 * canaleta do estojo) e o rasgo do ejetor embaixo; o ejetor é uma barra fixa
 * dentro do rasgo, que o fundo do estojo encontra depois de sair da câmara.
 */
export const EXTRACAO = {
  /** curso do ferrolho para trás */
  travel: 40,
  /** ponta do ejetor: o fundo do estojo chega nela 22 mm atrás do assento (o estojo já saiu da câmara) */
  ejectorBack: 22,
  /** rasgo do ejetor no ferrolho: y de cima, y de baixo e profundidade */
  ejectorSlot: [1.8, 3.6, 36] as [number, number, number],
  /** mola do extrator: N·mm/rad, repouso (rad, aperta a garra para baixo) e batentes */
  torsion: { k: 5, rest: 0.05, damping: 0.002 },
  limit: { lower: -0.2, upper: 0.01 },
  /** bolso do extrator no topo do ferrolho: x de trás e da frente (local da face) e y do fundo */
  pocket: [-14, -10, -2.6] as [number, number, number],
  /** eixo do extrator (y do mundo): abaixo da linha da garra (−3,2 a −4,2) */
  pivotY: -3.1,
  /** folga entre o aro e a garra por cima: o estojo gira um pouco em volta dela */
  overRim: 0.6,
  /** piso da caixa (y do topo) */
  floor: 4.4,
};

export function buildExtracao(
  title = "Extrator",
  opts: {
    loaded?: boolean;
    barrel?: number;
    returnSpring?: { k: number; rest: number; damping: number };
  } = {},
) {
  const b = new Builder(title);
  const L = b.layer("Ação", CICLO.thickness);
  const geo = capsuleGeometry(CAPSULE_DEFAULTS);
  const brl = barrel(b, L, geo, opts.barrel ?? 20);
  const s0 = brl.seatX;
  const loaded = opts.loaded ? capsuleAt(b, L, s0, 0) : null;
  const kase = loaded ? loaded.case : emptyCaseAt(b, L, s0, 0).case;
  const ball = loaded?.ball ?? null;
  const half = 4.05;
  const bolt = b.poly(
    "Ferrolho",
    L,
    s0,
    0,
    boltShape({ len: 40, half, ejector: EXTRACAO.ejectorSlot, pocket: EXTRACAO.pocket }),
    "steel",
  );
  bolt.fast = true;
  const slider = b.link({
    kind: "slider",
    a: null,
    b: bolt.id,
    at: [0, 0],
    dir: 0,
    travel: [-EXTRACAO.travel, 0],
    ...(opts.returnSpring ? { spring: opts.returnSpring } : {}),
  });
  // extrator: alavanca deitada sobre o ferrolho, a garra na frente e, atrás, uma
  // aba que desce num bolso do ferrolho com o eixo. O eixo fica abaixo da linha
  // onde a garra puxa o aro: a puxada aperta a garra no aro em vez de levantá-la
  const rimF = r4(geo.rimFront - geo.outer[0]![0]); // da face do fundo à frente do aro
  const grooveF = r4(geo.grooveEnd - geo.outer[0]![0]);
  const und = CAPSULE_PROPORTIONS.rimUndercut;
  const top = r4(-half - 2.2);
  const under = r4(-half - 0.1);
  const pocket = EXTRACAO.pocket;
  const pivot: Vec2 = [r4(s0 + (pocket[0] + pocket[1]) / 2), EXTRACAO.pivotY];
  const world: Vec2[] = [
    [s0 + pocket[0] + 0.2, top],
    [s0 + grooveF - 0.2, top],
    [s0 + grooveF - 0.2, -geo.grooveHalf - 0.2],
    // face de trás da garra casada com o rebaixo do aro (folga de 0,01 mm)
    [r4(s0 + rimF + 0.01 + und * 0.2), -geo.grooveHalf - 0.2],
    [
      r4(s0 + rimF + 0.01 + und * (geo.rimHalf + EXTRACAO.overRim - geo.grooveHalf)),
      -geo.rimHalf - EXTRACAO.overRim,
    ],
    [s0, -geo.rimHalf - EXTRACAO.overRim],
    [s0, under],
    [s0 + pocket[1] - 0.2, under],
    [s0 + pocket[1] - 0.2, pocket[2] + 0.2],
    [s0 + pocket[0] + 0.2, pocket[2] + 0.2],
  ];
  const ext = b.poly(
    "Extrator",
    L,
    pivot[0],
    pivot[1],
    world.map(([x, y]) => [r4(x - pivot[0]), r4(y - pivot[1])] as Vec2),
    "steel",
  );
  const axle = b.link({
    kind: "axle",
    a: bolt.id,
    b: ext.id,
    at: [0, 0],
    torsion: { ...EXTRACAO.torsion },
    limit: { ...EXTRACAO.limit },
  });
  // ejetor: barra fixa dentro do rasgo do ferrolho
  const [ey0, ey1] = EXTRACAO.ejectorSlot;
  const tip = r4(s0 - EXTRACAO.ejectorBack);
  const ejector = b.rect("Ejetor", L, r4(tip - 5), r4((ey0 + ey1) / 2), 10, r4(ey1 - ey0 - 0.4), "steel", {
    fixed: true,
  });
  // piso da caixa, sob o caminho do estojo, até a face do cano
  const floorW = 60;
  const floor = b.rect("Caixa", L, r4(-floorW / 2), r4(EXTRACAO.floor + 2), floorW, 4, "steel", {
    fixed: true,
  });
  return { b, L, geo, brl, kase, ball, bolt, slider, ext, axle, ejector, floor, tip, s0, half };
}

/**
 * Ciclo completo: cápsula carregada assentada, ferrolho solto num trilho com
 * mola de retorno (recuo do fundo, como no Lançador), percussor por mola no
 * canal do ferrolho, armado numa trava que o gatilho (o roteiro, ou um toque
 * no Testar) solta.
 */
export const DISPARO = {
  barrel: 40,
  /** mola de retorno do ferrolho: N/mm, repouso além do fechado (pré-carga) e amortecimento */
  returnSpring: { k: 0.02, rest: 5, damping: 0.00005 },
  /** percussor armado: a ponta tantos mm atrás da face, e a mola dele (N/mm, livre) */
  cocked: 5,
  pinSpring: { k: 0.1, free: 13 },
  /** instante do gatilho no roteiro */
  trigger: 0.1,
};

export function buildDisparo() {
  const x = buildExtracao("Disparo e extração", {
    loaded: true,
    barrel: DISPARO.barrel,
    returnSpring: DISPARO.returnSpring,
  });
  const { b, L, bolt, s0 } = x;
  const tip = r4(s0 - DISPARO.cocked);
  const striker = strikerPin(b, L, tip);
  // guiado pelo trilho do ferrolho, sem colisão contínua (a leitura de contato do golpe usa a velocidade de antes do passo)
  striker.fast = false;
  b.link({
    kind: "slider",
    a: bolt.id,
    b: striker.id,
    at: [0, 0],
    dir: 0,
    travel: [-1, r4(DISPARO.cocked + 1.5)],
  });
  const rearB = r4(tip - 10 - s0);
  const springA: Vec2 = [r4(rearB - 5), 0];
  b.link({
    kind: "spring",
    a: bolt.id,
    b: striker.id,
    atA: springA,
    atB: [-5, 0],
    k: DISPARO.pinSpring.k,
    damping: 0,
    freeLength: DISPARO.pinSpring.free,
    mode: "seated",
    coil: { outerD: 1.2, wireD: 0.2, turns: 12 },
  });
  const sear = b.link({ kind: "lock", a: bolt.id, b: striker.id, at: [0, 0] });
  return { ...x, striker, sear };
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

  // ——— extrator e ejetor ———
  {
    /**
     * O puxão da mão: 45 mm para trás com uma rampa de aceleração (como uma mão
     * de verdade, que sai do repouso) e depois `speed` mm/s constantes.
     */
    const pull = (x: ReturnType<typeof buildExtracao>, speed: number, t0: number): ScriptInput => {
      const grip: Vec2 = [r4(x.bolt.x - 30), 0];
      const D = 45;
      const ramp = 0.3;
      const T = D / speed / (1 - ramp / 2);
      const N = 30;
      const path: Vec2[] = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const sNorm = (u < ramp ? (u * u) / (2 * ramp) : u - ramp / 2) / (1 - ramp / 2);
        path.push([r4(grip[0] - D * sNorm), 0]);
      }
      return { kind: "dragPath", part: x.bolt.id, path, t0, t1: r4(t0 + T), release: r4(t0 + T + 0.2) };
    };
    const pullEnd = (speed: number, t0: number) => t0 + 45 / speed / 0.85;
    const extraction = (x: ReturnType<typeof buildExtracao>): ScriptAssertion[] => [
      {
        kind: "while",
        label: "o estojo vem junto com o ferrolho até o ejetor (diferença de deslocamento < 0,5 mm)",
        cond: xOf(x.kase.id),
        condMin: r4(x.kase.x - EXTRACAO.ejectorBack + 0.5),
        condMax: r4(x.kase.x - 0.5),
        q: {
          abs: {
            diff: [
              { part: x.kase.id, along: [1, 0] },
              { part: x.bolt.id, along: [1, 0] },
            ],
          },
        },
        max: 0.5,
        minSteps: 5,
      },
      {
        kind: "maxField",
        label: "o eixo do extrator não abre (≤ 0,5 mm, o limite do abuso)",
        links: [x.axle.id],
        field: "gap",
        max: 0.5,
      },
    ];
    const box = { x0: -60, top: -6.5 };
    const ejection = (x: ReturnType<typeof buildExtracao>, minSpeed: number): ScriptAssertion[] => [
      {
        kind: "while",
        label: `o estojo bate no ejetor e sai a mais de ${br(minSpeed / 1000, 2)} m/s`,
        cond: xOf(x.kase.id),
        condMin: box.x0,
        condMax: r4(x.kase.x - EXTRACAO.ejectorBack + 1),
        q: { part: x.kase.id, speed: true },
        min: minSpeed,
        peak: true,
      },
      {
        kind: "while",
        label: "gira em volta da garra e sobe pela janela de cima (mais de 8 mm acima do eixo)",
        cond: xOf(x.kase.id),
        condMin: box.x0,
        condMax: 0,
        q: { diff: [{ const: 0 }, { part: x.kase.id, field: "y" }] },
        min: 8,
        peak: true,
      },
    ];
    /** interior da caixa: do fundo do curso do ferrolho à face do cano, do topo do extrator ao piso */
    const outside = (x: ReturnType<typeof buildExtracao>, t: number): ScriptAssertion => ({
      kind: "outside",
      label: "e termina fora da caixa (o centro do estojo fora do espaço entre o piso e o topo do extrator)",
      part: x.kase.id,
      box: [box.x0, box.top, 0, EXTRACAO.floor],
      t,
    });

    const xe = buildExtracao("Extrator");
    writeFixture("ciclo", "extrator", xe.b.scene, {
      title: "Extrator",
      notes: `Estojo vazio assentado num cano fixo; o ferrolho, num trilho, tem o extrator cravado (gancho num eixo com mola de torção de ${br(EXTRACAO.torsion.k, 1)} N·mm/rad) com a garra na canaleta do estojo. A mão puxa o ferrolho para trás a 500 mm/s: o estojo sai da câmara junto com ele até o ejetor. O eixo do extrator fica abaixo da linha da garra: a puxada aperta a garra no aro.`,
      view: [-70, -30, 100, 50],
      runs: [
        {
          name: "puxão a 500 mm/s",
          duration: 0.2,
          inputs: [pull(xe, 500, 0.05)],
          assertions: [
            ...extraction(xe),
            {
              kind: "at",
              label: "o estojo sai da câmara (anda mais de 20 mm para trás)",
              q: { part: xe.kase.id, along: [-1, 0] },
              t: 0.2,
              min: 20,
            },
          ],
        },
      ],
    });

    const xj = buildExtracao("Ejetor");
    const runs = [
      {
        name: "puxão a 500 mm/s",
        duration: 0.6,
        inputs: [pull(xj, 500, 0.05)],
        assertions: [...extraction(xj), ...ejection(xj, 500), outside(xj, 0.58)],
      },
    ];
    // robustez: 20 variações da velocidade e do instante do puxão
    for (const speed of [300, 400, 500, 600])
      for (const t0 of [0.05, 0.08, 0.11, 0.14, 0.17]) {
        const end = r4(pullEnd(speed, t0) + 0.45);
        runs.push({
          name: `${speed} mm/s em ${br(t0, 2)} s`,
          duration: end,
          inputs: [pull(xj, speed, t0)],
          assertions: [...extraction(xj), ...ejection(xj, 250), outside(xj, r4(end - 0.02))],
        });
      }
    writeFixture("ciclo", "ejetor", xj.b.scene, {
      title: "Ejetor",
      notes: `Continuação do extrator: puxado para trás, o fundo do estojo bate no ejetor (barra fixa dentro do rasgo do ferrolho, ${EXTRACAO.ejectorBack} mm atrás do assento), o estojo gira em volta da garra, sobe pela janela de cima e cai atrás da caixa. Robustez: 20 variações (300 a 600 mm/s, começando de 0,05 a 0,17 s).`,
      view: [-90, -40, 120, 60],
      runs,
    });
  }

  // ——— disparo e extração: o ciclo numa cena só ———
  {
    const x = buildDisparo();
    const ball = x.ball!;
    const t = DISPARO.trigger;
    const boltX: Quantity = { part: x.bolt.id, along: [1, 0] };
    const box = { x0: -60, top: -6.5 };
    writeFixture("ciclo", "disparo-extracao", x.b.scene, {
      title: "Disparo e extração",
      notes: `O ciclo inteiro: a cápsula carregada assentada no cano (${DISPARO.barrel} mm de furo), o ferrolho solto num trilho com mola de retorno de ${br(DISPARO.returnSpring.k, 3)} N/mm (recuo do fundo, como no Lançador), o percussor por mola armado numa trava (o gatilho; no Testar, um toque na trava). Em ${br(t, 2)} s a trava solta: o percussor golpeia a espoleta, a esfera sai pelo cano, o estojo empurra o ferrolho para trás, a garra extrai, o ejetor joga o estojo pela janela de cima e a mola fecha o ferrolho.`,
      view: [-75, -35, 140, 55],
      runs: [
        {
          name: "um tiro",
          duration: 0.6,
          inputs: [{ kind: "release", link: x.sear.id, t }],
          assertions: [
            {
              kind: "events",
              label: "o golpe dispara a cápsula uma vez",
              event: "capsule-fired",
              min: 1,
              max: 1,
            },
            {
              kind: "while",
              label: "a esfera sai pela boca do cano a 12–25 m/s",
              cond: xOf(ball.id),
              condMin: x.brl.muzzle,
              condMax: x.brl.muzzle + 400,
              q: vx(ball.id),
              min: 12000,
              max: 25000,
              peak: true,
            },
            {
              kind: "range",
              label: `o estojo empurra o ferrolho para trás até passar do ejetor (recuo > ${EXTRACAO.ejectorBack} mm) e sem bater no fim do curso`,
              q: { diff: [{ const: 0 }, boltX] },
              from: t,
              max: EXTRACAO.travel - 0.5,
            },
            {
              kind: "while",
              label: `recuo do ferrolho > ${EXTRACAO.ejectorBack} mm`,
              cond: boltX,
              condMax: -1,
              q: { diff: [{ const: 0 }, boltX] },
              min: EXTRACAO.ejectorBack,
              peak: true,
            },
            {
              kind: "returnsAfter",
              label: "e a mola fecha o ferrolho em até 0,3 s",
              q: boltX,
              event: "capsule-fired",
              min: -0.3,
              max: 0.3,
              within: 0.3,
            },
            {
              kind: "while",
              label: "a garra traz o estojo junto com o ferrolho até o ejetor (diferença < 0,5 mm)",
              cond: xOf(x.kase.id),
              condMin: r4(x.kase.x - EXTRACAO.ejectorBack + 0.5),
              condMax: r4(x.kase.x - 1),
              q: { abs: { diff: [{ part: x.kase.id, along: [1, 0] }, boltX] } },
              max: 0.5,
              minSteps: 2,
              // do golpe até o fundo do estojo chegar no ejetor (depois ele voa e o ferrolho volta)
              from: t,
              to: r4(t + 0.022),
            },
            {
              kind: "while",
              label: "o estojo bate no ejetor e sai a mais de 0,5 m/s",
              cond: xOf(x.kase.id),
              condMin: box.x0,
              condMax: r4(x.kase.x - EXTRACAO.ejectorBack + 1),
              q: { part: x.kase.id, speed: true },
              min: 500,
              peak: true,
            },
            {
              kind: "while",
              label: "e sobe pela janela de cima (mais de 8 mm acima do eixo)",
              cond: xOf(x.kase.id),
              condMin: box.x0,
              condMax: 0,
              q: { diff: [{ const: 0 }, { part: x.kase.id, field: "y" }] },
              min: 8,
              peak: true,
            },
            {
              kind: "outside",
              label: "e termina fora da caixa",
              part: x.kase.id,
              box: [box.x0, box.top, 0, EXTRACAO.floor],
              t: 0.58,
            },
            {
              kind: "maxField",
              label: "o eixo do extrator não abre (≤ 0,5 mm)",
              links: [x.axle.id],
              field: "gap",
              max: 0.5,
            },
          ],
        },
      ],
    });
    console.log(
      `   disparo-extracao: cápsula ${x.kase.id}, esfera ${ball.id}, ferrolho ${x.bolt.id}, eixo do extrator ${x.axle.id}, trava ${x.sear.id}, boca ${x.brl.muzzle}`,
    );
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
