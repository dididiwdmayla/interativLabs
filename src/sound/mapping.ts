import type { SfxId } from "@/assets/audio-registry";
import { shapeGeometry } from "@/geometry/shape";
import { MATERIALS, type MaterialId } from "@/model/materials";
import { surfaces } from "@/model/profiles";
import { SOUND_FLOW_MIN } from "@/sim/session";
import type { Id, Scene } from "@/model/types";

/**
 * Do que a física avisa ao som que sai: o mapeamento puro (sem Web Audio, sem
 * DOM) de material, massa, velocidade e carga para o efeito, o volume e o
 * tom. O som é só saída: nada daqui entra na simulação nem no hash.
 */

/** Metal acima desta massa soa como bloco pesado (g). Na bancada: placas de alumínio (49–165 g), roda (37 g) e manivela (30 g) são pesadas; cano, ferrolho e esferas (≤ 16 g) são leves. */
export const HEAVY_MASS_G = 25;

/** Abaixo desta velocidade de aproximação o impacto não soa (mm/s). */
export const IMPACT_MIN_SPEED = 150;
/** Daqui para cima o volume e o tom não crescem mais (mm/s). */
export const IMPACT_FULL_SPEED = 6000;

/** No máximo tantos efeitos de impacto em cada janela de tempo. */
export const WINDOW_MS = 50;
export const WINDOW_MAX = 4;

/** Carga (mmol) até a "média" da câmara: soa como sopro. */
export const GAS_MEDIUM_CHARGE = 0.5;
/** Acima disto (mmol) a carga é "forte" e estoura seco. Entre a média (0,5) e a forte (1,2); vale para cargas livres. */
export const POP_STRONG_CHARGE = 0.85;

export type ImpactFamily = "metal" | "heavy" | "wood" | "rubber" | "ratchet";

export const FAMILY_IDS: Record<ImpactFamily, readonly SfxId[]> = {
  metal: ["sfx-impact-1", "sfx-impact-2", "sfx-impact-3"],
  heavy: ["sfx-impact-heavy-1", "sfx-impact-heavy-2"],
  wood: ["sfx-impact-wood-1", "sfx-impact-wood-2"],
  rubber: ["sfx-impact-rubber"],
  ratchet: ["sfx-ratchet-1", "sfx-ratchet-2"],
};

/** O que o som precisa saber de cada peça. */
export interface PartSound {
  material: MaterialId;
  /** g (área × espessura da camada × densidade, somando os perfis) */
  mass: number;
  /** tem perfil de catraca */
  ratchet: boolean;
}

/** Material, massa e catraca de cada peça da cena, uma vez por montagem. */
export function partSounds(scene: Scene): Map<Id, PartSound> {
  const thickness = new Map(scene.layers.map((l) => [l.id, l.thickness] as const));
  const out = new Map<Id, PartSound>();
  for (const p of scene.parts) {
    let mass = 0;
    let ratchet = false;
    for (const s of surfaces(p)) {
      if (s.shape.kind === "gear" && s.shape.profile === "ratchet") ratchet = true;
      const g = shapeGeometry(s.shape);
      if (g.ok) mass += g.value.mass.area * MATERIALS[s.material].density * (thickness.get(s.layer) ?? 0);
    }
    out.set(p.id, { material: p.material, mass, ratchet });
  }
  return out;
}

/** Quanto a velocidade pede, de 0 (no limiar) a 1 (a partir de IMPACT_FULL_SPEED), na escala do log. */
export function speedAmount(speed: number): number {
  if (!(speed > IMPACT_MIN_SPEED)) return 0;
  const t = Math.log(speed / IMPACT_MIN_SPEED) / Math.log(IMPACT_FULL_SPEED / IMPACT_MIN_SPEED);
  return Math.min(1, Math.max(0, t));
}

/** Família do som de um choque entre duas peças. */
export function impactFamily(a: PartSound, b: PartSound): ImpactFamily {
  if (a.ratchet || b.ratchet) return "ratchet";
  if (a.material === "rubber" || b.material === "rubber") return "rubber";
  const soft = (m: MaterialId) => m === "wood" || m === "polymer";
  if (soft(a.material) || soft(b.material)) return "wood";
  return Math.max(a.mass, b.mass) >= HEAVY_MASS_G ? "heavy" : "metal";
}

export interface ImpactCue {
  family: ImpactFamily;
  /** volume de 0 a 1 */
  gain: number;
  /** tom, em centésimos de semitom (±100) */
  cents: number;
}

/** Impacto → família, volume e tom; null abaixo do limiar. */
export function mapImpact(a: PartSound, b: PartSound, speed: number): ImpactCue | null {
  if (!(speed >= IMPACT_MIN_SPEED)) return null;
  const family = impactFamily(a, b);
  const t = speedAmount(speed);
  // a catraca estala sempre no mesmo peso (varia pouco); o resto vai de suave a cheio
  const gain = family === "ratchet" ? 0.55 + 0.35 * t : 0.1 + 0.9 * t;
  return { family, gain, cents: Math.round((t - 0.5) * 200) };
}

export interface GasCue {
  id: Extract<SfxId, "sfx-gas" | "sfx-pop-strong">;
  gain: number;
}

/** Carga da câmara (mmol) → sopro até a média, estouro seco acima do limiar. */
export function mapGas(charge: number): GasCue {
  if (charge > POP_STRONG_CHARGE) {
    return {
      id: "sfx-pop-strong",
      gain: Math.min(1, 0.85 + 0.15 * Math.min(1, (charge - POP_STRONG_CHARGE) / 0.35)),
    };
  }
  // a carga fraca (0,1) sopra baixo; a média (0,5) toca inteira
  const t = Math.min(1, Math.max(0, charge / GAS_MEDIUM_CHARGE));
  return { id: "sfx-gas", gain: 0.4 + 0.6 * Math.sqrt(t) };
}

/** Estojo vazio caindo: as duas variações, volume e tom pela velocidade. */
export const CASE_DROP_IDS = ["sfx-case-drop-1", "sfx-case-drop-2"] as const satisfies readonly SfxId[];
export function mapCaseDrop(speed: number): { gain: number; cents: number } {
  const t = speedAmount(speed);
  return { gain: 0.25 + 0.75 * t, cents: Math.round((t - 0.5) * 120) };
}

/** Vazão (mmol/s) → volume do chiado de 0 a 1. Zero é silêncio. */
export const FLOW_FULL = 8;
export function ventLevel(flow: number): number {
  if (!(flow >= SOUND_FLOW_MIN)) return 0;
  return Math.min(1, 0.2 + 0.8 * Math.sqrt(Math.min(1, flow / FLOW_FULL)));
}

/** Teto de efeitos por janela de tempo (ms): `allow` diz se mais um cabe agora. */
export class WindowLimiter {
  private times: number[] = [];
  readonly max: number;
  readonly windowMs: number;
  constructor(max = WINDOW_MAX, windowMs = WINDOW_MS) {
    this.max = max;
    this.windowMs = windowMs;
  }
  allow(nowMs: number): boolean {
    const from = nowMs - this.windowMs;
    while (this.times.length && (this.times[0] ?? Infinity) <= from) this.times.shift();
    if (this.times.length >= this.max) return false;
    this.times.push(nowMs);
    return true;
  }
  reset(): void {
    this.times = [];
  }
}
