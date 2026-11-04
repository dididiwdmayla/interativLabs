/**
 * Materiais. Definem densidade, atrito, elasticidade e (na Fase 2) a hachura.
 * Valores físicos herdados do protótipo (reference/prototype-v0/engine.js).
 * Densidade em g/cm³; a massa usa a espessura nominal de src/model/units.ts.
 */

export const MATERIAL_IDS = ["steel", "aluminum", "brass", "polymer", "rubber", "wood"] as const;

export type MaterialId = (typeof MATERIAL_IDS)[number];

export interface Material {
  label: string;
  /** g/cm³ */
  density: number;
  friction: number;
  restitution: number;
}

export const MATERIALS: Record<MaterialId, Material> = {
  steel: { label: "Aço", density: 7.8, friction: 0.25, restitution: 0.05 },
  aluminum: { label: "Alumínio", density: 2.7, friction: 0.3, restitution: 0.05 },
  brass: { label: "Latão", density: 8.5, friction: 0.2, restitution: 0.05 },
  polymer: { label: "Polímero", density: 1.2, friction: 0.4, restitution: 0.1 },
  rubber: { label: "Borracha", density: 1.1, friction: 0.9, restitution: 0.5 },
  wood: { label: "Madeira", density: 0.7, friction: 0.5, restitution: 0.1 },
};

/** Ids do protótipo v0 → ids v1. */
export const V0_MATERIALS: Record<string, MaterialId> = {
  aco: "steel",
  aluminio: "aluminum",
  latao: "brass",
  polimero: "polymer",
  borracha: "rubber",
  madeira: "wood",
};
