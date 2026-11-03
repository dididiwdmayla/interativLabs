/**
 * Formato v0: o do protótipo (reference/prototype-v0). Só leitura, para a
 * migração. Tudo em px; ângulos dos corpos e da direção em rad; limites e
 * repouso dos eixos em graus; tempo de queima em ms.
 */

export type V0Vec = [number, number];

export interface V0Layer {
  id: string;
  name: string;
  visible?: boolean;
}

export type V0Shape =
  | { type: "poly"; pts: V0Vec[] }
  | { type: "circle"; r: number }
  | { type: "gear"; r: number; teeth: number; depth: number; style: "reto" | "serra" };

export interface V0Part {
  id: string;
  name: string;
  layer: string;
  x: number;
  y: number;
  angle?: number;
  fixed?: boolean;
  material?: string;
  bullet?: boolean;
  shape: V0Shape;
}

interface V0LinkBase {
  id: string;
}

export type V0Link =
  | (V0LinkBase & { type: "screw"; a: string | null; b: string; p: V0Vec })
  | (V0LinkBase & {
      type: "axle";
      a: string | null;
      b: string;
      p: V0Vec;
      limitOn?: boolean;
      lower?: number;
      upper?: number;
      motorOn?: boolean;
      rpm?: number;
      torque?: number;
      tk?: number;
      trest?: number;
      td?: number;
    })
  | (V0LinkBase & { type: "pin"; host: string; p: V0Vec; r?: number; from?: string; to?: string })
  | (V0LinkBase & {
      type: "sensor";
      host: string;
      p: V0Vec;
      r?: number;
      from?: string;
      to?: string;
      target?: string;
      minSpeed?: number;
    })
  | (V0LinkBase & {
      type: "slider";
      a: string | null;
      b: string;
      p: V0Vec;
      dir?: number;
      travel?: number;
      back?: number;
      k?: number;
      rest?: number;
      damp?: number;
    })
  | (V0LinkBase & {
      type: "spring";
      a: string | null;
      b: string | null;
      pa: V0Vec;
      pb: V0Vec;
      k?: number;
      damp?: number;
      free?: number;
    })
  | (V0LinkBase & {
      type: "chamber";
      a: string | null;
      b: string | null;
      p: V0Vec;
      dir?: number;
      vent?: number;
      width?: number;
      charge?: number;
      burn?: number;
    });

export interface V0Scene {
  version?: number;
  nextId?: number;
  title?: string;
  layers: V0Layer[];
  parts: V0Part[];
  links: V0Link[];
  settings?: { gravity?: boolean; g?: number; snap?: boolean };
}

/** Uma cena é v0 se tem `nextId` ou formas com `type` (o v1 usa `kind` e `meta`). */
export function looksLikeV0(data: unknown): data is V0Scene {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if ("meta" in d) return false;
  if ("nextId" in d) return true;
  const parts = d.parts;
  return (
    Array.isArray(parts) &&
    parts.some(
      (p) =>
        p &&
        typeof p === "object" &&
        "shape" in p &&
        (p as { shape: { type?: unknown } }).shape?.type !== undefined,
    )
  );
}
