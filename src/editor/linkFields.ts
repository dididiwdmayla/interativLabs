import type { z } from "zod";
import { LinkSchema } from "@/model/schema";
import type { Link } from "@/model/types";

/**
 * Formulário de detalhes de uma ligação, gerado do schema (src/model/schema.ts):
 * cada número, sim/não e opção vira um campo com rótulo e unidade em
 * português. Ângulos aparecem em graus (a cena guarda radianos). Ids,
 * pontas e listas (paredes, respiros, ações) não entram aqui: são da E2b.
 */

export type FieldKind = "number" | "boolean" | "enum";

export interface FieldDesc {
  /** caminho dentro da ligação, ex.: ["motor", "speed"] ou ["at", 0] */
  path: (string | number)[];
  label: string;
  unit: string;
  kind: FieldKind;
  /** opções (enum): valor → rótulo */
  options?: [string, string][];
  /** cena → tela e tela → cena */
  toView: (v: number) => number;
  fromView: (v: number) => number;
  integer?: boolean;
}

export interface GroupDesc {
  /** campo opcional que liga e desliga (motor, batente, mola…) */
  key: string;
  label: string;
  present: boolean;
  /** valor padrão ao ligar */
  make: () => unknown;
  fields: FieldDesc[];
}

export interface LinkForm {
  fields: FieldDesc[];
  groups: GroupDesc[];
}

type AnyZod = z.ZodType & { _zod: { def: Record<string, unknown> & { type: string } } };

const DEG = 180 / Math.PI;
const id = (v: number) => v;
const toDeg = (v: number) => v * DEG;
const fromDeg = (v: number) => v / DEG;

/** Rótulo e unidade por campo (o tipo da ligação desempata). */
function meta(
  kind: Link["kind"],
  path: (string | number)[],
): { label: string; unit: string; angle?: boolean } {
  const k = path.filter((p) => typeof p === "string").join(".");
  const idx = path.find((p) => typeof p === "number");
  const xy = idx === undefined ? "" : idx === 0 ? " x" : " y";
  switch (k) {
    case "breakForce":
      return { label: "Força de soltura", unit: "N" };
    case "ref":
      return { label: "Número de chamada", unit: "" };
    case "at":
      return { label: `Ponto${xy}`, unit: "mm" };
    case "atA":
      return { label: `Ponta A${xy}`, unit: "mm" };
    case "atB":
      return { label: `Ponta B${xy}`, unit: "mm" };
    case "dir":
      return { label: "Direção", unit: "°", angle: true };
    case "travel":
      return { label: idx === 0 ? "Curso para trás" : "Curso à frente", unit: "mm" };
    case "friction":
      return { label: "Atrito", unit: kind === "slider" ? "N" : "N·mm" };
    case "motor.speed":
      return { label: "Velocidade", unit: "°/s", angle: true };
    case "motor.maxTorque":
      return { label: "Torque máximo", unit: "N·mm" };
    case "limit.lower":
      return { label: "Ângulo mínimo", unit: "°", angle: true };
    case "limit.upper":
      return { label: "Ângulo máximo", unit: "°", angle: true };
    case "torsion.k":
      return { label: "Rigidez", unit: "N·mm/rad" };
    case "torsion.rest":
      return { label: "Ângulo de repouso", unit: "°", angle: true };
    case "torsion.damping":
      return { label: "Amortecimento", unit: "N·mm·s/rad" };
    case "spring.k":
      return { label: "Rigidez", unit: "N/mm" };
    case "spring.rest":
      return { label: "Repouso", unit: "mm" };
    case "spring.damping":
      return { label: "Amortecimento", unit: "N·s/mm" };
    case "k":
      return { label: "Rigidez", unit: "N/mm" };
    case "damping":
      return kind === "mount"
        ? { label: "Amortecimento", unit: "×crítico" }
        : { label: "Amortecimento", unit: "N·s/mm" };
    case "freeLength":
      return { label: "Comprimento livre", unit: "mm" };
    case "solidLength":
      return { label: "Comprimento sólido", unit: "mm" };
    case "mode":
      return { label: "Modo", unit: "" };
    case "coil.outerD":
      return { label: "Diâmetro externo", unit: "mm" };
    case "coil.wireD":
      return { label: "Arame", unit: "mm" };
    case "coil.turns":
      return { label: "Espiras", unit: "" };
    case "maxLength":
      return { label: "Comprimento", unit: "mm" };
    case "linearHz":
      return { label: "Frequência linear", unit: "Hz" };
    case "angularHz":
      return { label: "Frequência angular", unit: "Hz" };
    case "r":
      return { label: "Raio", unit: "mm" };
    case "minSpeed":
      return { label: "Impacto mínimo", unit: "mm/s" };
    case "bore":
      return { label: "Diâmetro", unit: "mm" };
    case "length":
      return { label: "Comprimento", unit: "mm" };
    case "hole":
      return { label: "Furo da guia", unit: "nº" };
    case "gas.model":
      return { label: "Gás", unit: "" };
    case "gas.gamma":
      return { label: "γ do gás", unit: "" };
    case "gas.p0":
      return { label: "Pressão inicial", unit: "kPa" };
    case "gas.charge.amount":
      return { label: "Carga", unit: "mmol" };
    case "gas.charge.burnMs":
      return { label: "Queima", unit: "ms" };
    case "gas.charge.shots":
      return { label: "Cargas (acendimentos)", unit: "" };
    default:
      return { label: k, unit: "" };
  }
}

const ENUM_LABEL: Record<string, string> = {
  fixed: "Presa nas duas pontas",
  seated: "Apoiada (só empurra)",
  tension: "Só puxa",
  joint: "Junta (rasgo reto)",
  contact: "Contato (qualquer furo)",
  isothermal: "Isotérmico",
  adiabatic: "Adiabático",
};

const GROUP_LABEL: Record<string, string> = {
  motor: "Motor",
  limit: "Batente de ângulo",
  torsion: "Mola de torção",
  spring: "Mola de retorno",
  friction: "Atrito",
  breakForce: "Fusível",
  solidLength: "Comprimento sólido",
  charge: "Carga de gás",
};

/** Valores padrão ao ligar um campo opcional. */
const DEFAULTS: Record<string, () => unknown> = {
  motor: () => ({ speed: Math.PI, maxTorque: 50 }),
  limit: () => ({ lower: -Math.PI / 4, upper: Math.PI / 4 }),
  torsion: () => ({ k: 10, rest: 0, damping: 0.1 }),
  spring: () => ({ k: 0.1, rest: 0, damping: 0.001 }),
  friction: () => 1,
  breakForce: () => 1,
  solidLength: () => 0,
  charge: () => ({ amount: 0.2, burnMs: 4 }),
};

const SKIP = new Set([
  "id",
  "kind",
  "a",
  "b",
  "host",
  "pin",
  "guide",
  "profile",
  "body",
  "layers",
  "walls",
  "vents",
  "ports",
  "actions",
]);

/** Por tipo: o modo e o assento da câmara de cápsula ficam no cartão rápido ("recebe cápsula"). */
const SKIP_KIND: Partial<Record<Link["kind"], Set<string>>> = { chamber: new Set(["mode", "seat"]) };

function walk(kind: Link["kind"], schema: AnyZod, path: (string | number)[], out: FieldDesc[]): void {
  const def = schema._zod.def;
  switch (def.type) {
    case "number": {
      const m = meta(kind, path);
      out.push({
        path,
        label: m.label,
        unit: m.unit,
        kind: "number",
        toView: m.angle ? toDeg : id,
        fromView: m.angle ? fromDeg : id,
        integer: ["ref", "hole", "shots"].includes(String(path[path.length - 1])),
      });
      return;
    }
    case "boolean":
      out.push({ path, ...meta(kind, path), kind: "boolean", toView: id, fromView: id });
      return;
    case "enum": {
      const entries = Object.keys(def.entries as Record<string, string>);
      out.push({
        path,
        ...meta(kind, path),
        kind: "enum",
        options: entries.map((e) => [e, ENUM_LABEL[e] ?? e]),
        toView: id,
        fromView: id,
      });
      return;
    }
    case "tuple":
      (def.items as AnyZod[]).forEach((it, i) => walk(kind, it, [...path, i], out));
      return;
    case "object":
      for (const [k, v] of Object.entries(def.shape as Record<string, AnyZod>)) {
        if (path.length === 0 && SKIP.has(k)) continue;
        walk(kind, v, [...path, k], out);
      }
      return;
    default:
      return;
  }
}

const getAt = (o: unknown, path: (string | number)[]): unknown =>
  path.reduce<unknown>(
    (x, k) => (x && typeof x === "object" ? (x as Record<string | number, unknown>)[k] : undefined),
    o,
  );

export function readField(link: Link, f: FieldDesc): unknown {
  return getAt(link, f.path);
}

/** Cópia da ligação com o campo trocado. */
export function writeField(link: Link, path: (string | number)[], value: unknown): Link {
  const next = structuredClone(link) as Record<string | number, unknown>;
  let o = next;
  for (const k of path.slice(0, -1)) o = o[k] as Record<string | number, unknown>;
  const last = path[path.length - 1];
  if (last !== undefined) o[last] = value;
  return next as unknown as Link;
}

/** Liga ou desliga um campo opcional (de nível 1 ou dentro de gas). */
export function toggleGroup(link: Link, key: string, on: boolean): Link {
  const next = structuredClone(link) as unknown as Record<string, unknown>;
  const holder = key === "charge" ? (next.gas as Record<string, unknown>) : next;
  if (on) holder[key] = (DEFAULTS[key] ?? (() => 0))();
  else Reflect.deleteProperty(holder, key);
  return next as unknown as Link;
}

export function linkForm(link: Link): LinkForm {
  const option = (LinkSchema as unknown as AnyZod)._zod.def.options as AnyZod[];
  const schema = option.find(
    (o) =>
      ((o._zod.def.shape as Record<string, AnyZod>).kind?._zod.def.values as string[] | undefined)?.[0] ===
      link.kind,
  );
  const fields: FieldDesc[] = [];
  const groups: GroupDesc[] = [];
  if (!schema) return { fields, groups };
  const shape = schema._zod.def.shape as Record<string, AnyZod>;
  const visit = (k: string, v: AnyZod, base: (string | number)[]) => {
    if (base.length === 0 && (SKIP.has(k) || SKIP_KIND[link.kind]?.has(k))) return;
    const def = v._zod.def;
    if (def.type === "optional") {
      const inner = def.innerType as AnyZod;
      const fs: FieldDesc[] = [];
      walk(link.kind, inner, [...base, k], fs);
      groups.push({
        key: k,
        label: GROUP_LABEL[k] ?? k,
        present: getAt(link, [...base, k]) !== undefined,
        make: DEFAULTS[k] ?? (() => 0),
        fields: fs,
      });
      return;
    }
    if (def.type === "object" && k === "gas") {
      for (const [kk, vv] of Object.entries(def.shape as Record<string, AnyZod>)) visit(kk, vv, ["gas"]);
      return;
    }
    walk(link.kind, v, [...base, k], fields);
  };
  for (const [k, v] of Object.entries(shape)) visit(k, v, []);
  return { fields, groups };
}
