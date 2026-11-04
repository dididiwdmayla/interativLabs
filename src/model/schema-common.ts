import { z } from "zod";
import { MATERIAL_IDS } from "./materials";

/**
 * Peças do schema comuns às versões 1 e 2 da cena: números, pontos, formas,
 * peças, motor e batente do eixo, metadados e grade.
 * Mensagens dos tipos básicos vêm do locale pt-BR do Zod (ver parseScene);
 * as regras próprias são escritas em português.
 */

export const finite = (what: string) =>
  z.number({ error: `${what}: esperava um número` }).refine(Number.isFinite, `${what}: número inválido`);

export const nonNeg = (what: string) => finite(what).refine((v) => v >= 0, `${what} não pode ser negativo`);
export const positive = (what: string) =>
  finite(what).refine((v) => v > 0, `${what} precisa ser maior que zero`);

export const IdSchema = z.string().min(1, "O id não pode ser vazio");

export const Vec2Schema = z.tuple([finite("Coordenada x"), finite("Coordenada y")]);

export const RefSchema = z
  .number()
  .int("O número de chamada precisa ser inteiro")
  .positive("O número de chamada precisa ser maior que zero");

const RingSchema = z.array(Vec2Schema).min(3, "Um contorno precisa de pelo menos 3 pontos");

export const PolyShapeSchema = z.strictObject({
  kind: z.literal("poly"),
  outer: RingSchema,
  holes: z.array(RingSchema),
});

export const CircleShapeSchema = z.strictObject({
  kind: z.literal("circle"),
  r: positive("O raio"),
  holes: z.array(RingSchema),
});

export const GearShapeSchema = z.strictObject({
  kind: z.literal("gear"),
  /** módulo, mm (diâmetro primitivo = módulo × dentes) */
  module: positive("O módulo"),
  teeth: z
    .number()
    .int("O número de dentes precisa ser inteiro")
    .min(6, "Uma engrenagem precisa de pelo menos 6 dentes")
    .max(400, "No máximo 400 dentes"),
  /** rad */
  pressureAngle: finite("O ângulo de pressão").refine(
    (v) => v > 0 && v < Math.PI / 4,
    "O ângulo de pressão precisa ficar entre 0° e 45°",
  ),
  profile: z.enum(["involute", "ratchet"], { error: 'Perfil inválido: use "involute" ou "ratchet"' }),
  /** diâmetro do furo central, mm (0 = sem furo) */
  bore: nonNeg("O furo central"),
});

export const ShapeSchema = z.discriminatedUnion(
  "kind",
  [PolyShapeSchema, CircleShapeSchema, GearShapeSchema],
  {
    error: 'Tipo de forma inválido: use "poly", "circle" ou "gear"',
  },
);

export const PartSchema = z.strictObject({
  id: IdSchema,
  ref: RefSchema,
  name: z.string(),
  layer: IdSchema,
  x: finite("A posição x"),
  y: finite("A posição y"),
  angle: finite("O ângulo"),
  shape: ShapeSchema,
  material: z.enum(MATERIAL_IDS, { error: `Material inválido: use ${MATERIAL_IDS.join(", ")}` }),
  fixed: z.boolean(),
  fast: z.boolean(),
  source: z
    .strictObject({
      generator: z.string().min(1),
      params: z.record(z.string(), z.union([z.number(), z.string()])),
    })
    .optional(),
});

/** Batente de ângulo, rad, relativo à pose desenhada. */
export const AngleLimitSchema = z
  .strictObject({ lower: finite("O ângulo mínimo"), upper: finite("O ângulo máximo") })
  .refine((l) => l.lower <= l.upper, {
    message: "O ângulo mínimo precisa ser menor ou igual ao máximo",
    path: ["lower"],
  });

export const LayerRangeSchema = z.tuple([IdSchema, IdSchema]);

export const SettingsSchema = z.strictObject({
  gravity: z.strictObject({ on: z.boolean(), g: finite("A gravidade") }),
  snap: z.strictObject({ grid: positive("A grade"), on: z.boolean() }),
});

export const MetaSchema = z.strictObject({
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const MAX_LAYERS = 16;

export type Issue = (path: (string | number)[], message: string) => void;

/** Integridade comum: ids e números de chamada únicos, camadas das peças. */
export function checkCommon(
  s: {
    layers: { id: string }[];
    parts: { id: string; ref: number; layer: string }[];
    links: { id: string; ref: number; kind: string }[];
  },
  issue: Issue,
): { layerIds: Set<string>; partIds: Set<string>; linkKinds: Map<string, string> } {
  const layerIds = new Set<string>();
  s.layers.forEach((l, i) => {
    if (layerIds.has(l.id)) issue(["layers", i, "id"], `Id de camada repetido: ${l.id}`);
    layerIds.add(l.id);
  });

  const all = new Set<string>(layerIds);
  const partIds = new Set<string>();
  const refs = new Set<number>();
  const seeRef = (ref: number, path: (string | number)[]) => {
    if (refs.has(ref)) issue([...path, "ref"], `Número de chamada repetido: ${ref}`);
    refs.add(ref);
  };

  s.parts.forEach((p, i) => {
    if (all.has(p.id)) issue(["parts", i, "id"], `Id repetido: ${p.id}`);
    all.add(p.id);
    partIds.add(p.id);
    seeRef(p.ref, ["parts", i]);
    if (!layerIds.has(p.layer)) issue(["parts", i, "layer"], `Camada inexistente: ${p.layer}`);
  });

  const linkKinds = new Map<string, string>();
  s.links.forEach((l, i) => {
    if (all.has(l.id)) issue(["links", i, "id"], `Id repetido: ${l.id}`);
    all.add(l.id);
    linkKinds.set(l.id, l.kind);
    seeRef(l.ref, ["links", i]);
  });
  return { layerIds, partIds, linkKinds };
}
