import { PI } from "@/geometry/dmath";
import type { Vec2 } from "@/geometry/vec";
import type { MaterialId } from "@/model/materials";
import type { Part, Scene } from "@/model/types";
import { P_ATM } from "@/model/units";
import type { Quantity, ScriptAssertion, ScriptInput } from "@/sim/script";
import { Builder, r4, writeExample } from "./builder";

/**
 * Objeto padrão (item 12): lançador de esferas de brinquedo com ferrolho.
 * Mecanismo genérico e esquemático, com proporções inventadas e gás didático.
 *
 * Coordenadas do mundo em mm, x para a frente (a boca à direita) e y para
 * baixo. O eixo do cano é y = 0. Pose desenhada: ferrolho fechado, percussor
 * armado no retém, uma esfera na câmara e cinco no carregador.
 */

const DEG = PI / 180;

/** Peça poligonal dada em coordenadas do mundo: a origem vai para o meio da caixa. */
function polyAt(
  b: Builder,
  name: string,
  layer: string,
  world: Vec2[],
  material: MaterialId,
  opts: { fixed?: boolean; fast?: boolean; holes?: Vec2[][] } = {},
): Part {
  const xs = world.map((p) => p[0]);
  const ys = world.map((p) => p[1]);
  const cx = Math.round(((Math.min(...xs) + Math.max(...xs)) / 2) * 10) / 10;
  const cy = Math.round(((Math.min(...ys) + Math.max(...ys)) / 2) * 10) / 10;
  const loc = (q: Vec2): Vec2 => [r4(q[0] - cx), r4(q[1] - cy)];
  const part = b.poly(name, layer, cx, cy, world.map(loc), material, {
    fixed: opts.fixed ?? false,
    holes: (opts.holes ?? []).map((h) => h.map(loc)),
  });
  part.fast = opts.fast ?? false;
  return part;
}

/** Ponto do mundo no espaço local de uma peça (sem giro). */
const local = (p: Part, q: Vec2): Vec2 => [r4(q[0] - p.x), r4(q[1] - p.y)];

/** Medidas que o desenho fixa (também usadas pelo roteiro e pelo relatório). */
export const FERROLHO = {
  ballR: 3,
  /** centro da esfera na câmara */
  chamberX: 9.65,
  /** fundo do assento em V da câmara, mm */
  seatDepth: 1.5,
  /** centro da coluna do carregador */
  magX: -8,
  /** boca do cano */
  muzzleX: 84,
  /** face do ferrolho fechado (fundo da câmara de gás) */
  boltFace: -45.4,
  /** comprimento da câmara de gás com o êmbolo recolhido */
  gasGap: 15,
  /** curso do ferrolho para trás */
  boltTravel: 22,
  /** curso do êmbolo à frente do ferrolho */
  emboloStroke: 40,
  /** onde o dedo puxa o gatilho (mundo) */
  triggerPull: [14.6, 33] as Vec2,
  /** onde o dedo pega o ferrolho (mundo) */
  boltGrip: [-65, -5] as Vec2,
};

export interface FerrolhoIds {
  scene: Scene;
  corpo: string;
  ferrolho: string;
  embolo: string;
  balls: string[];
  empurrador: string;
  percussor: string;
  retem: string;
  gatilho: string;
  barra: string;
  boltSlider: string;
  pinSlider: string;
  emboloSlider: string;
  feedSlider: string;
  returnSpring: string;
  chamber: string;
  sensor: string;
  retemAxle: string;
  triggerAxle: string;
  slot: string;
}

export function buildFerrolho(): FerrolhoIds {
  const b = new Builder("Lançador de ferrolho");
  const L1 = b.layer("Armação", 3);
  // 4 mm: a esfera de Ø 6 mm tem a massa da esfera de aço de verdade (0,89 g)
  const L2 = b.layer("Ferrolho", 4);
  const L3 = b.layer("Disparo", 3);
  const L4 = b.layer("Gatilho", 3);
  const { ballR, chamberX, magX, muzzleX, boltFace } = FERROLHO;
  const bore = ballR + 0.15;
  /** meia altura do êmbolo e da luva (que segura a coluna do carregador) */
  const eH = 2.0;
  const lH = 2.8;

  // ——— 1. Armação ———
  // rasgo do pino da barra do gatilho: no fim do curso a borda de cima desce e
  // abaixa a barra (desconector)
  const slotHole: Vec2[] = [
    [-31.8, 13.8],
    [-26.8, 13.8],
    [-25.0, 16.3],
    [-22.0, 16.3],
    [-22.0, 19.7],
    [-31.8, 19.7],
  ];
  const guardWindow: Vec2[] = [
    [10, 24],
    [26, 21],
    [30, 30],
    [24, 40],
    [9, 41],
  ];
  const corpo = polyAt(
    b,
    "Corpo",
    L1,
    [
      [-116, -12],
      [30, -12],
      [30, 10],
      [34, 20],
      [34, 32],
      [26, 46],
      [4, 46],
      [3, 70],
      [-26, 70],
      [-34, 24],
      [-66, 22],
      [-70, 10],
      [-116, 10],
    ],
    "aluminum",
    { fixed: true, holes: [slotHole, guardWindow] },
  );
  const haste = polyAt(
    b,
    "Haste-guia",
    L1,
    [
      [-114, -5.2],
      [-80, -5.2],
      [-80, -2.8],
      [-114, -2.8],
    ],
    "steel",
    { fixed: true },
  );
  const cano = polyAt(
    b,
    "Cano",
    L2,
    [
      [-14, -8],
      [70, -8],
      [70, -10],
      [76, -10],
      [76, -8],
      [muzzleX, -8],
      [muzzleX, -bore],
      [-14, -bore],
    ],
    "steel",
  );
  const canal = polyAt(
    b,
    "Canal do carregador",
    L2,
    [
      [magX - 5.2, bore],
      [magX - 3.2, bore],
      [magX - 3.2, 60],
      [magX + 3.2, 60],
      [magX + 3.2, 5.3],
      [-2.6, bore],
      [chamberX - 3, bore],
      [chamberX, bore + FERROLHO.seatDepth],
      [chamberX + 3, bore],
      [muzzleX, bore],
      [muzzleX, 9],
      [magX + 5.2, 9],
      [magX + 5.2, 62],
      [magX - 5.2, 62],
    ],
    "steel",
  );

  // ——— 2. Ferrolho ———
  const ferrolho = polyAt(
    b,
    "Ferrolho",
    L2,
    [
      [-82, -6],
      [boltFace, -6],
      [boltFace, lH],
      [-82, lH],
    ],
    "polymer",
  );
  // luva: o cilindro do gás, parafusada no ferrolho; por baixo fecha a boca do
  // carregador enquanto o êmbolo corre dentro dela
  const luvaFront = chamberX - ballR - 0.25;
  const luva = polyAt(
    b,
    "Luva",
    L2,
    [
      [boltFace - 1, -lH],
      [luvaFront, -lH],
      [luvaFront, -eH - 0.05],
      [boltFace, -eH - 0.05],
      [boltFace, eH + 0.05],
      [luvaFront, eH + 0.05],
      [luvaFront, lH],
      [boltFace - 1, lH],
    ],
    "polymer",
  );
  // haste de impulso: a parede da frente do gás; empurra a esfera. O ressalto de
  // cima bate no fundo do cano (batente da armação) e o gás segue empurrando só
  // o ferrolho para trás
  const eRear = boltFace + FERROLHO.gasGap;
  const embolo = polyAt(
    b,
    "Êmbolo",
    L2,
    [
      [eRear, -4.5],
      [eRear + 2, -4.5],
      [eRear + 2, -eH],
      [chamberX - ballR, -eH],
      [chamberX - ballR, eH],
      [eRear, eH],
    ],
    "polymer",
    { fast: true },
  );
  // assento em V no piso do cano: a esfera que chega devagar fica nele
  const seatA = Math.atan2(FERROLHO.seatDepth, 3);
  const ballY = r4(bore + FERROLHO.seatDepth - ballR / Math.cos(seatA));
  const balls: Part[] = [b.circle("Esfera 1", L2, chamberX, ballY, ballR, "steel")];
  const magTop = lH + ballR + 0.05;
  for (let i = 0; i < 5; i++)
    balls.push(b.circle(`Esfera ${i + 2}`, L2, magX, magTop + i * 6.05, ballR, "steel"));
  const followerTop = magTop + 4 * 6.05 + ballR + 0.05;
  const empurrador = polyAt(
    b,
    "Empurrador",
    L2,
    [
      [magX - 3, followerTop],
      [magX + 3, followerTop],
      [magX + 3, followerTop + 4],
      [magX - 3, followerTop + 4],
    ],
    "polymer",
  );
  // ——— 3. Disparo ———
  const percussor = polyAt(
    b,
    "Percussor",
    L3,
    [
      [-76.5, -1.5],
      [-59.5, -1.5],
      [-58.5, 0],
      [-59.5, 1.5],
      [-73.5, 1.5],
      [-73.5, 4.5],
      [-75.5, 4.5],
      [-76.5, 3.5],
    ],
    "aluminum",
    { fast: true },
  );
  // pivô à frente do dente, na altura do contato com a espora: o percussor não
  // força o retém para nenhum lado; só a mola de torção o segura
  const retemPivot: Vec2 = [-60.5, 3.25];
  const retem = polyAt(
    b,
    "Retém",
    L3,
    [
      [-73.5, 2.0],
      [-72.5, 2.0],
      [-70, 5.0],
      [-62, 5.0],
      [-61.8, 2.6],
      [-60.5, 1.95],
      [-59.2, 2.6],
      [-59, 4.5],
      [-59, 14.8],
      [-60.5, 17.0],
      [-62, 17.0],
      [-62, 7.5],
      [-73.5, 7.5],
    ],
    "aluminum",
  );

  // ——— 4. Gatilho ———
  const T0: Vec2 = [17, 26];
  const T1: Vec2 = [r4(T0[0] - 12 * Math.sin(15 * DEG)), r4(T0[1] - 12 * Math.cos(15 * DEG))];
  const gatilho = polyAt(
    b,
    "Gatilho",
    L4,
    [
      [12.6, 13.0],
      [15.4, 13.6],
      [19.2, 25.0],
      [19.2, 28.0],
      [17.6, 34.0],
      [15.0, 39.0],
      [12.4, 41.0],
      [11.6, 39.6],
      [14.0, 34.0],
      [15.0, 28.5],
      [14.8, 26.0],
    ],
    "steel",
  );
  const pinB: Vec2 = [-63.2, 15.3];
  const barY = (x: number) => T1[1] + ((pinB[1] - T1[1]) * (T1[0] - x)) / (T1[0] - pinB[0]);
  const pinA: Vec2 = [-30, r4(barY(-30))];
  const barra = polyAt(
    b,
    "Barra do gatilho",
    L4,
    [
      [-65, r4(barY(-65) - 1.4)],
      [15.2, r4(barY(15.2) - 1.4)],
      [15.2, r4(barY(15.2) + 1.4)],
      [-65, r4(barY(-65) + 1.4)],
    ],
    "aluminum",
    { fast: true },
  );

  // ——— ligações ———
  b.link({ kind: "screw", a: corpo.id, b: cano.id, at: local(cano, [40, -6]) });
  b.link({ kind: "screw", a: corpo.id, b: canal.id, at: local(canal, [magX, 61]) });
  b.link({ kind: "screw", a: ferrolho.id, b: luva.id, at: local(luva, [boltFace - 0.5, 0]) });
  const boltSlider = b.link({
    kind: "slider",
    a: corpo.id,
    b: ferrolho.id,
    at: local(ferrolho, [-65, -3]),
    dir: 0,
    travel: [-FERROLHO.boltTravel, 0],
  });
  // mola de retorno apoiada, na haste-guia, pré-carregada contra o batente da frente
  const rsA: Vec2 = [-112, -4];
  const rsB: Vec2 = [-82, -4];
  const rsK = 0.015;
  const rsPre = 0.9;
  const returnSpring = b.link({
    kind: "spring",
    a: corpo.id,
    b: ferrolho.id,
    atA: local(corpo, rsA),
    atB: local(ferrolho, rsB),
    k: rsK,
    damping: 0,
    freeLength: r4(rsB[0] - rsA[0] + rsPre / rsK),
    mode: "seated",
    guide: haste.id,
    coil: { outerD: 5.2, wireD: 0.5, turns: 10 },
  });
  // amortecedor de fim de curso: mola apoiada macia e muito amortecida, entre o
  // cano e a frente do ferrolho; só freia a volta (apoiada não puxa), e o
  // ferrolho empurra a esfera para a câmara devagar
  const bfA: Vec2 = [-14, -5.4];
  const bfB: Vec2 = [boltFace, -5.4];
  b.link({
    kind: "spring",
    a: cano.id,
    b: ferrolho.id,
    atA: local(cano, bfA),
    atB: local(ferrolho, bfB),
    k: 0.002,
    damping: 0.009,
    freeLength: r4(bfA[0] - bfB[0] + FERROLHO.boltTravel + 1),
    mode: "seated",
    coil: { outerD: 4, wireD: 0.4, turns: 9 },
  });
  const emboloSlider = b.link({
    kind: "slider",
    a: ferrolho.id,
    b: embolo.id,
    at: [0, 0],
    dir: 0,
    travel: [0, FERROLHO.emboloStroke],
    spring: { k: 0.05, rest: 0, damping: 0.0004 },
  });
  const chamber = b.link({
    kind: "chamber",
    body: null,
    at: [boltFace, 0],
    dir: 0,
    bore: 6,
    length: 100,
    walls: [
      { part: embolo.id, seal: 100 },
      { part: ferrolho.id, seal: 16 },
    ],
    // respiro sempre aberto no meio da câmara: drena o gás que sobra depois do tiro
    vents: [{ at: 7, d: 0.5, open: true }],
    ports: [],
    gas: { model: "adiabatic", gamma: 1.4, p0: P_ATM, charge: { amount: 0.45, burnMs: 1, shots: 12 } },
  });
  const feedSlider = b.link({
    kind: "slider",
    a: canal.id,
    b: empurrador.id,
    at: [0, 0],
    dir: -PI / 2,
    travel: [0, r4(followerTop - 3.3)],
  });
  const fsA: Vec2 = [magX, 60];
  const fsB: Vec2 = [magX, followerTop + 4];
  const fsK = 0.008;
  b.link({
    kind: "spring",
    a: canal.id,
    b: empurrador.id,
    atA: local(canal, fsA),
    atB: local(empurrador, fsB),
    k: fsK,
    damping: 0.0003,
    freeLength: r4(fsA[1] - fsB[1] + 0.45 / fsK),
    mode: "seated",
    coil: { outerD: 5.6, wireD: 0.4, turns: 18 },
  });
  const pinSlider = b.link({
    kind: "slider",
    a: ferrolho.id,
    b: percussor.id,
    at: [0, 0],
    dir: 0,
    travel: [-1, 9],
  });
  const ppA: Vec2 = [-81.5, 0];
  const ppB: Vec2 = [-76.5, 0];
  b.link({
    kind: "spring",
    a: ferrolho.id,
    b: percussor.id,
    atA: local(ferrolho, ppA),
    atB: local(percussor, ppB),
    k: 0.025,
    damping: 0.000005,
    freeLength: 15.5,
    mode: "fixed",
    coil: { outerD: 2.4, wireD: 0.4, turns: 8 },
  });
  const retemAxle = b.link({
    kind: "axle",
    a: corpo.id,
    b: retem.id,
    at: local(retem, retemPivot),
    limit: { lower: -0.8, upper: 0 },
    torsion: { k: 3, rest: 0.3, damping: 0.0002 },
  });
  // sensor na armação, no fundo da câmara: o percussor só o alcança com o
  // ferrolho fechado (no recuo, um percussor que quica não acende de novo)
  const sensor = b.link({
    kind: "sensor",
    host: corpo.id,
    at: local(corpo, [-49, 0]),
    r: 1.5,
    layers: [L3, L3],
    minSpeed: 800,
    actions: [{ do: "ignite", target: chamber.id }],
  });
  const triggerAxle = b.link({
    kind: "axle",
    a: corpo.id,
    b: gatilho.id,
    at: local(gatilho, T0),
    limit: { lower: 0, upper: 0.55 },
    torsion: { k: 4, rest: -0.3, damping: 0.0005 },
  });
  b.link({
    kind: "axle",
    a: gatilho.id,
    b: barra.id,
    at: local(barra, T1),
    torsion: { k: 8, rest: 0.3, damping: 0.0005 },
  });
  const pinAL = b.link({ kind: "pin", host: barra.id, at: local(barra, pinA), r: 1.2, layers: [L1, L4] });
  const slot = b.link({ kind: "slot", pin: pinAL.id, guide: corpo.id, hole: 0, mode: "contact" });
  b.link({ kind: "pin", host: barra.id, at: local(barra, pinB), r: 1.2, layers: [L3, L4] });

  // números de chamada: armação 1–9, ferrolho 10–19, disparo 20–29, gatilho 30–39,
  // ligações a partir de 40 (na ordem em que foram criadas)
  const refs: Record<string, number> = {
    Corpo: 1,
    Cano: 2,
    "Canal do carregador": 3,
    "Haste-guia": 4,
    Ferrolho: 10,
    Luva: 11,
    Êmbolo: 12,
    Empurrador: 19,
    Percussor: 20,
    Retém: 21,
    Gatilho: 30,
    "Barra do gatilho": 31,
  };
  balls.forEach((p, i) => (refs[p.name] = 13 + i));
  for (const p of b.scene.parts) {
    const r = refs[p.name];
    if (r === undefined) throw new Error(`sem número de chamada: ${p.name}`);
    p.ref = r;
  }
  b.scene.links.forEach((l, i) => (l.ref = 40 + i));

  return {
    scene: b.scene,
    corpo: corpo.id,
    ferrolho: ferrolho.id,
    embolo: embolo.id,
    balls: balls.map((p) => p.id),
    empurrador: empurrador.id,
    percussor: percussor.id,
    retem: retem.id,
    gatilho: gatilho.id,
    barra: barra.id,
    boltSlider: boltSlider.id,
    pinSlider: pinSlider.id,
    emboloSlider: emboloSlider.id,
    feedSlider: feedSlider.id,
    returnSpring: returnSpring.id,
    chamber: chamber.id,
    sensor: sensor.id,
    retemAxle: retemAxle.id,
    triggerAxle: triggerAxle.id,
    slot: slot.id,
  };
}

// ——— cena de teste do ciclo (item 12.2) ———

/** Puxa o gatilho com o dedo em t e solta em t + hold. */
function pull(gatilho: string, t: number, hold: number): ScriptInput {
  return {
    kind: "drag",
    part: gatilho,
    from: FERROLHO.triggerPull,
    to: [-2, 32],
    t0: t,
    t1: t + 0.12,
    release: t + hold,
  };
}

export function generateFerrolho(): void {
  const f = buildFerrolho();
  const { chamberX, muzzleX } = FERROLHO;
  const bolt: Quantity = { link: f.boltSlider, field: "translation" };
  const pin: Quantity = { link: f.pinSlider, field: "translation" };
  const gauge: Quantity = { diff: [{ link: f.chamber, field: "pressure" }, { const: P_ATM }] };
  const sensorEv = { sensor: f.sensor };
  const ballX = (i: number): Quantity => ({ part: f.balls[i]!, field: "x" });
  const ballY = (i: number): Quantity => ({ part: f.balls[i]!, field: "y" });
  const seatY = f.scene.parts.find((p) => p.id === f.balls[0])!.y;
  const nextY = f.scene.parts.find((p) => p.id === f.balls[1])!.y;
  /** recuo mínimo: a frente da luva passa da boca do carregador (e a espora, do retém) */
  const needed = 18;

  const exits = (i: number, label: string): ScriptAssertion => ({
    kind: "while",
    label,
    cond: ballX(i),
    condMin: muzzleX,
    condMax: muzzleX + 150,
    q: { part: f.balls[i]!, vel: [1, 0] },
    min: 5000,
    max: 20000,
  });
  const inChamber = (i: number, t: number, label: string): ScriptAssertion[] => [
    { kind: "at", label, q: ballX(i), t, min: chamberX - 0.5, max: chamberX + 0.5 },
    { kind: "at", label: `${label} (assentada)`, q: ballY(i), t, min: seatY - 0.2, max: seatY + 0.2 },
  ];
  const cocked = (t: number, label: string): ScriptAssertion => ({
    kind: "at",
    label,
    q: pin,
    t,
    min: -0.5,
    max: 0.5,
  });
  const closed = (t: number, label: string): ScriptAssertion => ({
    kind: "at",
    label,
    q: bolt,
    t,
    min: -0.2,
    max: 0.2,
  });

  const cycle = 0.6;
  const cycles: ScriptAssertion[] = [];
  for (let i = 0; i < 6; i++) cycles.push(exits(i, `a esfera ${i + 1} sai pela boca a 5–20 m/s`));
  for (let i = 0; i < 7; i++) {
    const t = 0.3 + i * cycle;
    cycles.push(
      {
        kind: "returnsAfter",
        label: `ciclo ${i + 1}: o ferrolho recua e volta ao batente em até 0,3 s`,
        q: bolt,
        event: "chamber-fired",
        from: t,
        min: -0.2,
        max: 0.2,
        within: 0.3,
      },
      cocked(t + 0.58, `ciclo ${i + 1}: termina com o percussor preso no retém`),
      closed(t + 0.58, `ciclo ${i + 1}: termina com o ferrolho no batente`),
    );
  }

  writeExample("lancador-ferrolho", f.scene, {
    title: "Lançador de ferrolho",
    notes:
      "Puxe o gatilho e veja em 0,05×: o gás empurra o êmbolo e a esfera para a frente e o ferrolho para trás, a mola de retorno se comprime na haste-guia e, na volta, a próxima esfera sobe do carregador e entra na câmara. Brinquedo esquemático: proporções inventadas, esferas de aço de 6 mm e gás didático.",
    view: [-120, -20, 210, 95],
    labRun: 1,
    runs: [
      {
        name: "repouso",
        duration: 3,
        inputs: [],
        assertions: [
          {
            kind: "maxDisp",
            label: "parado, nenhuma peça se move mais que 0,2 mm depois de 0,5 s",
            parts: "dynamic",
            from: 0.5,
            to: 3,
            max: 0.2,
          },
          {
            kind: "range",
            label: "o retém segura o percussor armado",
            q: pin,
            from: 0.5,
            min: -0.5,
            max: 0.5,
          },
          { kind: "events", label: "e o sensor não dispara", event: "sensor", max: 0 },
          {
            kind: "range",
            label: "o carregador mantém a próxima esfera encostada na luva (sem folga)",
            q: ballY(1),
            from: 0.5,
            min: nextY - 0.5,
            max: nextY,
          },
          ...inChamber(0, 3, "a esfera 1 fica na câmara"),
        ],
      },
      {
        name: "disparo, com o gatilho segurado",
        duration: 1.8,
        inputs: [pull(f.gatilho, 0.3, 1.5)],
        assertions: [
          {
            kind: "events",
            label: "o sensor dispara exatamente 1 vez",
            event: "sensor",
            match: sensorEv,
            min: 1,
            max: 1,
          },
          {
            kind: "events",
            label: "desconexão: com o gatilho segurado por mais de 1 s, não há segundo disparo",
            event: "chamber-fired",
            min: 1,
            max: 1,
          },
          exits(0, "a esfera sai pela boca a 5–20 m/s"),
          {
            kind: "span",
            label: `o ferrolho recua pelo menos ${needed} mm (rearma o percussor e abre o carregador)`,
            q: bolt,
            min: needed,
          },
          {
            kind: "returnsAfter",
            label: "o ferrolho volta ao batente da frente em até 0,3 s",
            q: bolt,
            event: "chamber-fired",
            min: -0.2,
            max: 0.2,
            within: 0.3,
          },
          {
            kind: "dropsAfter",
            label: "o gás não fica preso (abaixo de 5% do pico em 20 ms)",
            q: gauge,
            event: "wall-unsealed",
            match: { part: f.ferrolho },
            fraction: 0.05,
            within: 0.02,
          },
          cocked(1.45, "com o gatilho ainda puxado, o percussor está preso no retém"),
          {
            kind: "at",
            label: "e o gatilho continua puxado",
            q: { link: f.triggerAxle, field: "angle" },
            t: 1.45,
            min: 0.2,
          },
          cocked(1.8, "soltando o gatilho, o percussor continua preso"),
          ...inChamber(1, 1.8, "a esfera 2 está na câmara"),
        ],
      },
      {
        name: "seis ciclos e o carregador vazio",
        duration: 0.3 + 7 * cycle,
        inputs: Array.from({ length: 7 }, (_, i) => pull(f.gatilho, 0.3 + i * cycle, 0.3)),
        assertions: [
          {
            kind: "events",
            label: "sete puxões, sete acendimentos do sensor",
            event: "sensor",
            match: sensorEv,
            min: 7,
            max: 7,
          },
          { kind: "events", label: "e sete cargas", event: "chamber-fired", min: 7, max: 7 },
          ...cycles,
          {
            kind: "dropsAfter",
            label: "carregador vazio: o gás não fica preso (abaixo de 5% do pico em 20 ms)",
            q: gauge,
            event: "wall-unsealed",
            match: { part: f.ferrolho },
            from: 0.3 + 6 * cycle,
            fraction: 0.05,
            within: 0.02,
          },
        ],
      },
      {
        name: "arrasto manual",
        duration: 2.5,
        inputs: [
          {
            kind: "drag",
            part: f.ferrolho,
            from: FERROLHO.boltGrip,
            to: [FERROLHO.boltGrip[0] - 45, FERROLHO.boltGrip[1]],
            t0: 0.3,
            t1: 0.6,
            release: 0.75,
          },
        ],
        assertions: [
          {
            kind: "range",
            label: "o dedo leva o ferrolho até o fim do curso",
            q: bolt,
            max: -(FERROLHO.boltTravel - 0.5),
            from: 0.6,
            to: 0.75,
          },
          { kind: "events", label: "o percussor não acende a carga", event: "sensor", max: 0 },
          ...inChamber(1, 2.5, "soltando, a esfera 2 entra na câmara"),
          closed(2.5, "e o ferrolho volta ao batente"),
          cocked(2.5, "com o percussor preso"),
          {
            kind: "at",
            label: "a esfera que estava na câmara sai rolando pela boca (não há extrator)",
            q: ballX(0),
            t: 2.5,
            min: muzzleX,
          },
        ],
      },
    ],
  });
}
