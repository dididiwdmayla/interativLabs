/**
 * Materiais. Definem densidade, atrito, elasticidade e (na Fase 2) a hachura.
 * Densidade real em g/mm³ (cena v2): massa = densidade × área × espessura da
 * camada. Atrito e restituição herdados do protótipo
 * (reference/prototype-v0/engine.js).
 */

export const MATERIAL_IDS = ["steel", "aluminum", "brass", "polymer", "rubber", "wood"] as const;

export type MaterialId = (typeof MATERIAL_IDS)[number];

export interface Material {
  label: string;
  /** g/mm³ */
  density: number;
  friction: number;
  restitution: number;
}

export const MATERIALS: Record<MaterialId, Material> = {
  steel: { label: "Aço", density: 0.00785, friction: 0.25, restitution: 0.05 },
  aluminum: { label: "Alumínio", density: 0.0027, friction: 0.3, restitution: 0.05 },
  brass: { label: "Latão", density: 0.0085, friction: 0.2, restitution: 0.05 },
  polymer: { label: "Polímero", density: 0.0012, friction: 0.4, restitution: 0.1 },
  rubber: { label: "Borracha", density: 0.0011, friction: 0.9, restitution: 0.5 },
  wood: { label: "Madeira", density: 0.0007, friction: 0.5, restitution: 0.1 },
};

/** Ids do protótipo v0 → ids v1/v2. */
export const V0_MATERIALS: Record<string, MaterialId> = {
  aco: "steel",
  aluminio: "aluminum",
  latao: "brass",
  polimero: "polymer",
  borracha: "rubber",
  madeira: "wood",
};
