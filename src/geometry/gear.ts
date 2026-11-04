import { CHORD_TOL, arcPoints, arcSegments, circleRing } from "./primitives";
import { convexHull, type PolyWithHoles, type Ring } from "./polygon";
import type { Piece } from "./decompose";
import { fail, ok, type GeoResult } from "./result";
import { distToSegment, polar, type Vec2 } from "./vec";

/**
 * Engrenagem evolvente, cremalheira e catraca.
 *
 * Convenção de fase (a mesma do protótipo): o dente k fica centrado no ângulo
 * (k + ½)·2π/z e os vãos nos ângulos k·2π/z. Assim um dente aponta para o vão
 * da vizinha quando a segunda tem fase π/z2 (z2 par) ou π − π/z2 em geral.
 *
 * O perfil é o que uma cremalheira de corte reta geraria: ferramenta com
 * flancos no ângulo de pressão, ponta reta a 1,25·m abaixo da linha primitiva
 * e dente engrossado pela folga (o dente da engrenagem fica mais fino em
 * `backlash`, medido no círculo primitivo). Para cada raio ρ, a meia
 * espessura angular do dente é o mínimo entre o flanco evolvente (onde a
 * ferramenta o gera) e a trocoide traçada pelo canto da ponta da ferramenta.
 * Com poucos dentes a trocoide corta o pé do flanco: é o rebaixo (undercut)
 * de verdade, que deixa a ponta da vizinha passar sem interferir.
 */

export interface GearGeometry {
  outline: PolyWithHoles;
  /** Peças convexas para o motor: núcleo + um polígono por dente. */
  pieces: Piece[];
  pitchRadius: number;
  tipRadius: number;
  rootRadius: number;
  baseRadius: number;
}

export interface InvoluteGearParams {
  /** mm */
  module: number;
  /** 8 a 200 */
  teeth: number;
  /** rad (padrão 20°) */
  pressureAngle?: number;
  /** redução da espessura do dente no primitivo, mm (padrão 0,04·m) */
  backlash?: number;
  /** diâmetro do furo central, mm (0 = sem furo) */
  bore?: number;
}

export const MIN_TEETH = 8;
export const MAX_TEETH = 200;
export const DEFAULT_PRESSURE_ANGLE = (20 * Math.PI) / 180;
export const BACKLASH_FACTOR = 0.04;
/** Altura do pé (ponta da ferramenta) em módulos. */
const DEDENDUM = 1.25;
/** Menor meia largura do pescoço do dente rebaixado, em módulos. */
const MIN_NECK = 0.2;

const inv = (a: number) => Math.tan(a) - a;

interface ToothProfile {
  /** raios crescentes, de rf a ra */
  rho: number[];
  /** meia espessura angular do dente em cada raio */
  psi: number[];
  /** raio onde o flanco evolvente começa */
  involuteStart: number;
  /** raio do pescoço (menor meia largura abaixo do evolvente) */
  neck: number;
  clamped: boolean;
}

function toothProfile(
  m: number,
  z: number,
  alpha: number,
  backlash: number,
  tol: number,
): ToothProfile | string {
  const r = (m * z) / 2;
  const rb = r * Math.cos(alpha);
  const ra = r + m;
  const hc = DEDENDUM * m;
  const rf = r - hc;
  const T = Math.tan(alpha);
  const sinA = Math.sin(alpha);
  const s = (Math.PI * m) / 2 - backlash;
  const sc = Math.PI * m - s;
  const psiP = s / (2 * r);
  const invA = inv(alpha);
  const gamma0 = Math.PI / z;
  const tc = -(sc / 2 - hc * T);
  if (!(tc < 0)) return "Ângulo de pressão grande demais para este módulo";
  if (!(rf > 0)) return "Dentes de menos para este módulo";

  const psiInv = (rho: number): number => {
    if (rho < rb) return Infinity;
    const d = (r * sinA - Math.sqrt(rho * rho - rb * rb)) * sinA;
    if (d > hc + 1e-12) return Infinity;
    return psiP + invA - inv(Math.acos(Math.min(1, rb / rho)));
  };
  const psiTro = (rho: number): number => {
    const q = Math.sqrt(Math.max(0, rho * rho - rf * rf));
    let best = Infinity;
    for (const u of [q, -q]) {
      const phi = (u - tc) / r;
      best = Math.min(best, gamma0 - phi + Math.atan2(u, rf));
    }
    return best;
  };
  let clamped = false;
  const psiRaw = (rho: number) => Math.min(psiInv(rho), psiTro(rho));
  const psiMin = (rho: number) => Math.asin(Math.min(1, (MIN_NECK * m) / rho));
  const psi = (rho: number) => {
    const v = psiRaw(rho);
    const lo = psiMin(rho);
    if (v < lo) {
      clamped = true;
      return lo;
    }
    return v;
  };

  // Início do evolvente: primeiro raio em que ele é o limite ativo.
  const N = 400;
  let start = ra;
  for (let i = 0; i <= N; i++) {
    const rho = rf + ((ra - rf) * i) / N;
    if (psiInv(rho) <= psiTro(rho)) {
      let lo = i === 0 ? rf : rf + ((ra - rf) * (i - 1)) / N;
      let hi = rho;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        if (psiInv(mid) <= psiTro(mid)) hi = mid;
        else lo = mid;
      }
      start = hi;
      break;
    }
  }
  if (start >= ra) return "O perfil evolvente não chegou a se formar";

  // Pescoço: menor meia largura linear entre rf e o início do evolvente.
  let neck = rf;
  let neckW = Infinity;
  for (let i = 0; i <= 200; i++) {
    const rho = rf + ((start - rf) * i) / 200;
    const w = rho * Math.sin(psiRaw(rho));
    if (w < neckW) {
      neckW = w;
      neck = rho;
    }
  }

  // Raios obrigatórios: pontas, início do evolvente e pelo menos 8 pontos no flanco evolvente.
  const set = new Set<number>([rf, ra, start, neck]);
  for (let i = 1; i < 8; i++) set.add(start + ((ra - start) * i) / 8);
  for (let i = 1; i < 8; i++) set.add(rf + ((start - rf) * i) / 8);
  const base = [...set].sort((a, b) => a - b);
  const pt = (rho: number): Vec2 => polar(rho, psi(rho));
  const rho: number[] = [base[0]!];
  const refine = (a: number, b: number, depth: number) => {
    const m2 = (a + b) / 2;
    if (depth < 14 && distToSegment(pt(m2), pt(a), pt(b)) > tol) {
      refine(a, m2, depth + 1);
      refine(m2, b, depth + 1);
    } else rho.push(b);
  };
  for (let i = 1; i < base.length; i++) refine(base[i - 1]!, base[i]!, 0);
  const psis = rho.map(psi);
  if (!(psis[psis.length - 1]! > 0))
    return "Dentes pontudos: aumente o número de dentes ou reduza o ângulo de pressão";
  return { rho, psi: psis, involuteStart: start, neck, clamped };
}

/** Peças convexas de um anel (núcleo com furo central). */
function annulusPieces(rIn: number, rOut: number): Piece[] {
  const n = Math.max(6, arcSegments(rIn, 2 * Math.PI));
  const outerPer = Math.max(1, Math.min(5, Math.ceil(arcSegments(rOut, 2 * Math.PI) / n)));
  const pieces: Piece[] = [];
  for (let k = 0; k < n; k++) {
    const a0 = (2 * Math.PI * k) / n;
    const a1 = (2 * Math.PI * (k + 1)) / n;
    const pts: Ring = [polar(rIn, a0)];
    for (let i = 0; i <= outerPer; i++) pts.push(polar(rOut, a0 + ((a1 - a0) * i) / outerPer));
    pts.push(polar(rIn, a1));
    pieces.push({ kind: "poly", points: pts });
  }
  return pieces;
}

function corePieces(rCore: number, bore: number): Piece[] {
  return bore > 0 ? annulusPieces(bore / 2, rCore) : [{ kind: "circle", c: [0, 0], r: rCore }];
}

function boreHole(bore: number): Ring[] {
  return bore > 0 ? [circleRing([0, 0], bore / 2).reverse()] : [];
}

export function involuteGear(p: InvoluteGearParams): GeoResult<GearGeometry> {
  const m = p.module;
  const z = p.teeth;
  const alpha = p.pressureAngle ?? DEFAULT_PRESSURE_ANGLE;
  const backlash = p.backlash ?? BACKLASH_FACTOR * m;
  const bore = p.bore ?? 0;
  if (!(m > 0) || !Number.isFinite(m)) return fail("invalid", "O módulo precisa ser maior que zero");
  if (!Number.isInteger(z) || z < MIN_TEETH || z > MAX_TEETH)
    return fail("invalid", `O número de dentes precisa ser inteiro, de ${MIN_TEETH} a ${MAX_TEETH}`);
  if (!(alpha > 0 && alpha < Math.PI / 4))
    return fail("invalid", "O ângulo de pressão precisa ficar entre 0° e 45°");
  if (!(backlash >= 0 && backlash < 0.5 * m))
    return fail("invalid", "A folga precisa ficar entre 0 e meio módulo");

  const prof = toothProfile(m, z, alpha, backlash, Math.min(CHORD_TOL / 4, 0.005 * m));
  if (typeof prof === "string") return fail("invalid", prof);
  const r = (m * z) / 2;
  const rf = r - DEDENDUM * m;
  const ra = r + m;
  const rb = r * Math.cos(alpha);
  if (!(bore >= 0) || bore / 2 > rf - 0.5 * m) return fail("invalid", "O furo central é grande demais");

  const pitch = (2 * Math.PI) / z;
  const n = prof.rho.length;
  const psiA = prof.psi[n - 1]!;
  const psiF = prof.psi[0]!;
  const outer: Ring = [];
  for (let k = 0; k < z; k++) {
    const c = (k + 0.5) * pitch;
    for (let i = 0; i < n; i++) outer.push(polar(prof.rho[i]!, c - prof.psi[i]!));
    const tip = arcPoints([0, 0], ra, c - psiA, c + psiA);
    for (let i = 1; i < tip.length - 1; i++) outer.push(tip[i]!);
    for (let i = n - 1; i >= 0; i--) outer.push(polar(prof.rho[i]!, c + prof.psi[i]!));
    const root = arcPoints([0, 0], rf, c + psiF, c + pitch - psiF);
    for (let i = 1; i < root.length - 1; i++) outer.push(root[i]!);
  }

  // Dente para o motor: fecho de 4 pontos por lado (pé, início do evolvente, meio, cabeça).
  const psiAt = (rho: number) => {
    let i = 1;
    while (i < n - 1 && prof.rho[i]! < rho) i++;
    const r0 = prof.rho[i - 1]!;
    const r1 = prof.rho[i]!;
    const t = r1 > r0 ? (rho - r0) / (r1 - r0) : 0;
    return prof.psi[i - 1]! + (prof.psi[i]! - prof.psi[i - 1]!) * Math.max(0, Math.min(1, t));
  };
  const working = r - m;
  const bot = Math.max(working, prof.neck);
  const j = Math.max(bot, prof.involuteStart);
  const radii =
    j - bot > 0.05 * m
      ? [bot, j, (j + ra) / 2, ra]
      : [bot, bot + (ra - bot) / 3, bot + (2 * (ra - bot)) / 3, ra];
  const pieces: Piece[] = corePieces(rf, bore);
  for (let k = 0; k < z; k++) {
    const c = (k + 0.5) * pitch;
    const pts: Vec2[] = [];
    for (const rho of radii) {
      const ps = psiAt(rho);
      pts.push(polar(rho, c - ps), polar(rho, c + ps));
    }
    pieces.push({ kind: "poly", points: convexHull(pts) });
  }

  return ok(
    {
      outline: { outer, holes: boreHole(bore) },
      pieces,
      pitchRadius: r,
      tipRadius: ra,
      rootRadius: rf,
      baseRadius: rb,
    },
    prof.clamped ? ["Rebaixo forte: o pé do dente foi reforçado para não quebrar"] : [],
  );
}

export interface RackParams {
  module: number;
  /** comprimento em dentes */
  teeth: number;
  pressureAngle?: number;
  backlash?: number;
  /** altura do corpo abaixo do pé dos dentes, mm */
  bodyHeight: number;
}

export interface RackGeometry {
  outline: PolyWithHoles;
  pieces: Piece[];
  /** passo, mm */
  pitch: number;
  /** comprimento total, mm */
  length: number;
}

/**
 * Cremalheira: linha primitiva em y = 0, dentes para +y (cabeça em +m, pé em
 * −1,25·m), dente k centrado em x = (k + ½)·π·m, de x = 0 a x = dentes·π·m.
 */
export function rack(p: RackParams): GeoResult<RackGeometry> {
  const m = p.module;
  const alpha = p.pressureAngle ?? DEFAULT_PRESSURE_ANGLE;
  const backlash = p.backlash ?? BACKLASH_FACTOR * m;
  if (!(m > 0)) return fail("invalid", "O módulo precisa ser maior que zero");
  if (!Number.isInteger(p.teeth) || p.teeth < 1 || p.teeth > 1000)
    return fail("invalid", "O número de dentes da cremalheira precisa ser inteiro, de 1 a 1000");
  if (!(p.bodyHeight > 0)) return fail("invalid", "A altura do corpo precisa ser maior que zero");
  const T = Math.tan(alpha);
  const pitch = Math.PI * m;
  const s = pitch / 2 - backlash;
  const yf = -DEDENDUM * m;
  const ya = m;
  const wr = s / 2 - yf * T;
  const wt = s / 2 - ya * T;
  if (!(wt > 0) || !(wr < pitch / 2))
    return fail("invalid", "Ângulo de pressão incompatível com o dente da cremalheira");
  const L = p.teeth * pitch;
  const yb = yf - p.bodyHeight;
  const outer: Ring = [
    [0, yb],
    [L, yb],
    [L, yf],
  ];
  const pieces: Piece[] = [
    {
      kind: "poly",
      points: [
        [0, yb],
        [L, yb],
        [L, yf],
        [0, yf],
      ],
    },
  ];
  for (let k = p.teeth - 1; k >= 0; k--) {
    const c = (k + 0.5) * pitch;
    outer.push([c + wr, yf], [c + wt, ya], [c - wt, ya], [c - wr, yf]);
  }
  for (let k = 0; k < p.teeth; k++) {
    const c = (k + 0.5) * pitch;
    pieces.push({
      kind: "poly",
      points: [
        [c - wr, yf],
        [c + wr, yf],
        [c + wt, ya],
        [c - wt, ya],
      ],
    });
  }
  outer.push([0, yf]);
  return ok({ outline: { outer, holes: [] }, pieces, pitch, length: L });
}

export interface RatchetParams {
  teeth: number;
  /** raio da ponta dos dentes, mm */
  outerRadius: number;
  /** profundidade do dente, mm */
  depth: number;
  /** inclinação da face de trava em relação ao raio, rad (padrão 4°) */
  faceAngle?: number;
  /** diâmetro do furo central, mm */
  bore?: number;
}

export const DEFAULT_FACE_ANGLE = (4 * Math.PI) / 180;
/** Fração do passo em que fica a ponta (rampa longa, face curta), como no protótipo. */
const RATCHET_TIP_FRACTION = 0.78;

/**
 * Catraca (dente de serra). Cada dente sobe em rampa reta do pé A até a ponta
 * T e desce pela face de trava até o pé B; entre B e o próximo A, arco de pé.
 * Gira livre no sentido em que a rampa passa pela lingueta.
 */
export function ratchet(p: RatchetParams): GeoResult<GearGeometry> {
  const z = p.teeth;
  const ro = p.outerRadius;
  const d = p.depth;
  const face = p.faceAngle ?? DEFAULT_FACE_ANGLE;
  const bore = p.bore ?? 0;
  if (!Number.isInteger(z) || z < 3 || z > MAX_TEETH)
    return fail("invalid", `O número de dentes da catraca precisa ser inteiro, de 3 a ${MAX_TEETH}`);
  if (!(ro > 0) || !(d > 0) || d >= ro)
    return fail("invalid", "Profundidade do dente incompatível com o raio");
  if (!(face > -Math.PI / 3 && face < Math.PI / 3))
    return fail("invalid", "A face de trava precisa ficar entre −60° e 60°");
  const rr = ro - d;
  if (!(bore >= 0) || bore / 2 > rr - 0.1 * d) return fail("invalid", "O furo central é grande demais");
  const step = (2 * Math.PI) / z;
  const thT = RATCHET_TIP_FRACTION * step;
  // Ponto B: a partir de T, na direção do raio para dentro girada de `face` para frente.
  const T: Vec2 = polar(ro, thT);
  const er: Vec2 = [Math.cos(thT), Math.sin(thT)];
  const et: Vec2 = [-Math.sin(thT), Math.cos(thT)];
  const dir: Vec2 = [
    -Math.cos(face) * er[0] + Math.sin(face) * et[0],
    -Math.cos(face) * er[1] + Math.sin(face) * et[1],
  ];
  const bq = T[0] * dir[0] + T[1] * dir[1];
  const cq = ro * ro - rr * rr;
  const t = -bq - Math.sqrt(Math.max(0, bq * bq - cq));
  const B: Vec2 = [T[0] + dir[0] * t, T[1] + dir[1] * t];
  const thB = Math.atan2(B[1], B[0]);
  if (!(thB > thT - step / 2 && thB < step - 1e-6))
    return fail("invalid", "A face de trava inclina demais para este passo");

  const outer: Ring = [];
  const dCore = Math.min(0.3, 0.1 * d);
  const pieces: Piece[] = corePieces(rr, bore);
  for (let k = 0; k < z; k++) {
    const a = k * step;
    outer.push(polar(rr, a), polar(ro, a + thT), polar(rr, a + thB));
    const root = arcPoints([0, 0], rr, a + thB, a + step);
    for (let i = 1; i < root.length - 1; i++) outer.push(root[i]!);
    pieces.push({
      kind: "poly",
      points: [polar(rr - dCore, a), polar(ro, a + thT), polar(rr - dCore, a + thB)],
    });
  }
  return ok({
    outline: { outer, holes: boreHole(bore) },
    pieces,
    pitchRadius: ro - d / 2,
    tipRadius: ro,
    rootRadius: rr,
    baseRadius: rr,
  });
}
