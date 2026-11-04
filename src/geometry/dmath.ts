/**
 * Funções transcendentais determinísticas (seno, cosseno, arco tangente,
 * exponencial, logaritmo, potência).
 *
 * `Math.sin`, `cos`, `atan2`, `exp`, `pow`… não são exigidas pelo padrão do
 * JavaScript a dar o resultado arredondado corretamente, e o V8 do Node e o
 * do Chromium diferem no último bit (docs/decisoes/motor.md, Determinismo).
 * Estas versões são portes do fdlibm (Sun, 1993) que usam só +, −, ×, ÷ e
 * `Math.sqrt`, todas exatas no IEEE 754: dão o mesmo bit em qualquer
 * plataforma. O erro fica em ~1 ulp (testado em dmath.test.ts).
 *
 * O código de física e de geometria (src/geometry, src/engine, src/sim) usa
 * só estas funções; `Math.sqrt`, `Math.abs`, `Math.floor`, `Math.round`,
 * `Math.min` e `Math.max` são exatas e continuam liberadas.
 */

export const PI = 3.141592653589793;
const PIO2 = 1.5707963267948966;
const PI_LO = 1.2246467991473532e-16;

const bits = new DataView(new ArrayBuffer(8));

/** 2^k exato, para −1074 ≤ k ≤ 1023. */
function pow2(k: number): number {
  if (k > 1023) return Infinity;
  if (k >= -1022) {
    bits.setUint32(0, (k + 1023) << 20);
    bits.setUint32(4, 0);
    return bits.getFloat64(0);
  }
  return pow2(k + 1022) * 2.2250738585072014e-308; // subnormal: 2^(k+1022) × 2^−1022
}

// ——— seno e cosseno ———

const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.0875723212981748279e-9;
const C6 = -1.13596475577881948265e-11;

/** sen(x + y) para |x| ≤ π/4, y a cauda de x. */
function kSin(x: number, y: number): number {
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  return x - (z * (0.5 * y - v * r) - y - v * S1);
}

/** cos(x + y) para |x| ≤ π/4. */
function kCos(x: number, y: number): number {
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (Math.abs(x) < 0.3) return 1 - (0.5 * z - (z * r - x * y));
  const qx = Math.abs(x) > 0.78125 ? 0.28125 : quarterHigh(x);
  const hz = 0.5 * z - qx;
  const a = 1 - qx;
  return a - (hz - (z * r - x * y));
}

/** |x|/4 só com a palavra alta (o desdobramento do fdlibm para não perder bits). */
function quarterHigh(x: number): number {
  bits.setFloat64(0, Math.abs(x) * 0.25);
  bits.setUint32(4, 0);
  return bits.getFloat64(0);
}

// Redução de argumento de Cody–Waite (π/2 em três partes).
const INV_PIO2 = 6.36619772367581382433e-1;
const PIO2_1 = 1.57079632673412561417;
const PIO2_2 = 6.0771005063039659766e-11;
const PIO2_2T = 2.02226624879595063154e-21;

let redHi = 0;
let redLo = 0;

/** Reduz x a y = x − n·π/2 (|y| ≤ π/4); devolve n. Válido para |x| < 2^20·π/2. */
function reduce(x: number): number {
  const n = Math.round(x * INV_PIO2);
  // primeira passada (85 bits) e a segunda (118 bits) do fdlibm, sempre as duas
  const t = x - n * PIO2_1;
  let w = n * PIO2_2;
  const r = t - w;
  w = n * PIO2_2T - (t - r - w);
  const y = r - w;
  redHi = y;
  redLo = r - y - w;
  return n;
}

export function dsin(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  if (Math.abs(x) <= 0.7853981633974483) return kSin(x, 0);
  const n = reduce(x) & 3;
  return n === 0
    ? kSin(redHi, redLo)
    : n === 1
      ? kCos(redHi, redLo)
      : n === 2
        ? -kSin(redHi, redLo)
        : -kCos(redHi, redLo);
}

export function dcos(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  if (Math.abs(x) <= 0.7853981633974483) return kCos(x, 0);
  const n = reduce(x) & 3;
  return n === 0
    ? kCos(redHi, redLo)
    : n === 1
      ? -kSin(redHi, redLo)
      : n === 2
        ? -kCos(redHi, redLo)
        : kSin(redHi, redLo);
}

// ——— arco tangente ———

const ATAN_HI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, PIO2];
const ATAN_LO = [
  2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17,
  6.12323399573676603587e-17,
];
const AT0 = 3.33333333333329318027e-1;
const AT1 = -1.99999999998764832476e-1;
const AT2 = 1.42857142725034663711e-1;
const AT3 = -1.1111110405462355788e-1;
const AT4 = 9.09088713343650656196e-2;
const AT5 = -7.69187620504482999495e-2;
const AT6 = 6.66107313738753120669e-2;
const AT7 = -5.83357013379057348645e-2;
const AT8 = 4.97687799461593236017e-2;
const AT9 = -3.6531572744216915527e-2;
const AT10 = 1.62858201153657823623e-2;

export function datan(x: number): number {
  if (Number.isNaN(x)) return NaN;
  const sign = x < 0 ? -1 : 1;
  let ax = Math.abs(x);
  if (ax >= 7.378697629483821e19) return sign * (ATAN_HI[3]! + ATAN_LO[3]!);
  let id: number;
  if (ax < 0.4375) {
    if (ax < 1.862645149230957e-9) return x;
    id = -1;
  } else if (ax < 1.1875) {
    if (ax < 0.6875) {
      id = 0;
      ax = (2 * ax - 1) / (2 + ax);
    } else {
      id = 1;
      ax = (ax - 1) / (ax + 1);
    }
  } else if (ax < 2.4375) {
    id = 2;
    ax = (ax - 1.5) / (1 + 1.5 * ax);
  } else {
    id = 3;
    ax = -1 / ax;
  }
  const z = ax * ax;
  const w = z * z;
  const s1 = z * (AT0 + w * (AT2 + w * (AT4 + w * (AT6 + w * (AT8 + w * AT10)))));
  const s2 = w * (AT1 + w * (AT3 + w * (AT5 + w * (AT7 + w * AT9))));
  if (id < 0) return sign * (ax - ax * (s1 + s2));
  return sign * (ATAN_HI[id]! - (ax * (s1 + s2) - ATAN_LO[id]! - ax));
}

export function datan2(y: number, x: number): number {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  if (x === 1) return datan(y);
  if (y === 0) {
    if (x > 0 || Object.is(x, 0)) return y; // ±0
    return Object.is(y, -0) ? -PI : PI;
  }
  if (x === 0) return y > 0 ? PIO2 : -PIO2;
  if (!Number.isFinite(x)) {
    if (!Number.isFinite(y)) return x > 0 ? (y > 0 ? PI / 4 : -PI / 4) : y > 0 ? (3 * PI) / 4 : (-3 * PI) / 4;
    return x > 0 ? (y > 0 ? 0 : -0) : y > 0 ? PI : -PI;
  }
  if (!Number.isFinite(y)) return y > 0 ? PIO2 : -PIO2;
  const r = Math.abs(y / x);
  let z: number;
  if (r > 1.152921504606847e18) z = PIO2 + 0.5 * PI_LO;
  else if (x < 0 && r < 1e-300) z = 0;
  else z = datan(r);
  if (x > 0) return y > 0 ? z : -z;
  return y > 0 ? PI - (z - PI_LO) : z - PI_LO - PI;
}

// ——— exponencial, logaritmo, potência ———

const LN2_HI = 6.9314718036912381649e-1;
const LN2_LO = 1.90821492927058770002e-10;
const INV_LN2 = 1.442695040888963387;
const P1 = 1.66666666666666019037e-1;
const P2 = -2.77777777770155933842e-3;
const P3 = 6.61375632143793436117e-5;
const P4 = -1.6533902205465251539e-6;
const P5 = 4.13813679705723846039e-8;

export function dexp(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x > 709.782712893384) return Infinity;
  if (x < -745.1332191019411) return 0;
  const ax = Math.abs(x);
  let k = 0;
  let hi = x;
  let lo = 0;
  if (ax > 0.34657359027997264) {
    k = ax < 1.0397207708399179 ? (x > 0 ? 1 : -1) : Math.trunc(INV_LN2 * x + (x > 0 ? 0.5 : -0.5));
    hi = x - k * LN2_HI;
    lo = k * LN2_LO;
    x = hi - lo;
  } else if (ax < 3.725290298461914e-9) return 1 + x;
  const t = x * x;
  const c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return 1 - ((x * c) / (c - 2) - x);
  const y = 1 - (lo - (x * c) / (2 - c) - hi);
  if (k >= -1021) return y * pow2(k);
  return y * pow2(k + 1000) * pow2(-1000);
}

const LG1 = 6.66666666666673513e-1;
const LG2 = 3.999999999940941908e-1;
const LG3 = 2.857142874366239149e-1;
const LG4 = 2.222219843214978396e-1;
const LG5 = 1.818357216161805012e-1;
const LG6 = 1.531383769920937332e-1;
const LG7 = 1.479819860511658591e-1;
const SQRT2 = 1.4142135623730951;

export function dlog(x: number): number {
  if (Number.isNaN(x) || x < 0) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return Infinity;
  let k = 0;
  if (x < 2.2250738585072014e-308) {
    x *= 18014398509481984; // 2^54
    k = -54;
  }
  bits.setFloat64(0, x);
  const hi = bits.getUint32(0);
  k += ((hi >>> 20) & 0x7ff) - 1023;
  bits.setUint32(0, (hi & 0x000fffff) | 0x3ff00000);
  let m = bits.getFloat64(0); // [1, 2)
  if (m > SQRT2) {
    m /= 2;
    k++;
  }
  const f = m - 1;
  const s = f / (2 + f);
  const z = s * s;
  const w = z * z;
  const t1 = w * (LG2 + w * (LG4 + w * LG6));
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
  const R = t2 + t1;
  const hfsq = 0.5 * f * f;
  return k * LN2_HI - (hfsq - (s * (hfsq + R) + k * LN2_LO) - f);
}

/** x^y para x ≥ 0 (o caso da física: volumes, razões de pressão). */
export function dpow(x: number, y: number): number {
  if (y === 0) return 1;
  if (y === 1) return x;
  if (x === 0) return y > 0 ? 0 : Infinity;
  if (x < 0) {
    if (Number.isInteger(y)) {
      const p = dexp(y * dlog(-x));
      return Math.abs(y) % 2 === 1 ? -p : p;
    }
    return NaN;
  }
  if (y === 2) return x * x;
  if (y === 0.5) return Math.sqrt(x);
  return dexp(y * dlog(x));
}

/** √(x² + y²), sem `Math.hypot` (que não tem garantia de bit entre motores de JS). */
export function dhypot(x: number, y: number): number {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const m = Math.max(ax, ay);
  if (m === 0 || !Number.isFinite(m)) return m;
  if (m > 1e150 || m < 1e-150) {
    const a = ax / m;
    const b = ay / m;
    return m * Math.sqrt(a * a + b * b);
  }
  return Math.sqrt(ax * ax + ay * ay);
}

export function dtan(x: number): number {
  return dsin(x) / dcos(x);
}

export function dasin(x: number): number {
  return datan2(x, Math.sqrt((1 - x) * (1 + x)));
}

export function dacos(x: number): number {
  return datan2(Math.sqrt((1 - x) * (1 + x)), x);
}
