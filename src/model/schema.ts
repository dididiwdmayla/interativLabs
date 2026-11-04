import { z } from "zod";
import { MATERIAL_IDS } from "./materials";

/**
 * Formato da cena, versão 1 (docs/arquitetura.md §3).
 * Unidades: mm, g, s, rad (ver src/model/units.ts). Pontos são [x, y].
 * Mensagens dos tipos básicos vêm do locale pt-BR do Zod (ver parseScene);
 * as regras próprias abaixo já são escritas em português.
 */

const finite = (what: string) =>
  z.number({ error: `${what}: esperava um número` }).refine(Number.isFinite, `${what}: número inválido`);

const nonNeg = (what: string) => finite(what).refine((v) => v >= 0, `${what} não pode ser negativo`);
const positive = (what: string) => finite(what).refine((v) => v > 0, `${what} precisa ser maior que zero`);

export const IdSchema = z.string().min(1, "O id não pode ser vazio");

export const Vec2Schema = z.tuple([finite("Coordenada x"), finite("Coordenada y")]);

const RefSchema = z
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

export const LayerSchema = z.strictObject({
  id: IdSchema,
  name: z.string(),
  visible: z.boolean(),
  locked: z.boolean(),
});

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

/** Motor do eixo: velocidade-alvo (rad/s, positivo = horário) e torque máximo (g·mm²/s²). */
export const MotorSchema = z.strictObject({
  speed: finite("A velocidade do motor"),
  maxTorque: nonNeg("O torque máximo"),
});

/** Batente de ângulo, rad, relativo à pose desenhada. */
export const AngleLimitSchema = z
  .strictObject({ lower: finite("O ângulo mínimo"), upper: finite("O ângulo máximo") })
  .refine((l) => l.lower <= l.upper, {
    message: "O ângulo mínimo precisa ser menor ou igual ao máximo",
    path: ["lower"],
  });

/** Mola de torção: rigidez (por rad), ângulo de repouso (rad) e amortecimento (por rad/s). */
export const TorsionSchema = z.strictObject({
  k: nonNeg("A rigidez da mola de torção"),
  rest: finite("O ângulo de repouso"),
  damping: nonNeg("O amortecimento da mola de torção"),
});

/** Mola de retorno do trilho: rigidez (g/s²), repouso (mm ao longo do eixo) e amortecimento (g/s). */
export const LinearSpringSchema = z.strictObject({
  k: nonNeg("A rigidez da mola de retorno"),
  rest: finite("A posição de repouso"),
  damping: nonNeg("O amortecimento da mola de retorno"),
});

const LayerRangeSchema = z.tuple([IdSchema, IdSchema]);

const base = { id: IdSchema, ref: RefSchema };
const anchor = IdSchema.nullable();

export const ScrewSchema = z.strictObject({
  ...base,
  kind: z.literal("screw"),
  a: anchor,
  b: IdSchema,
  at: Vec2Schema,
});

export const AxleSchema = z.strictObject({
  ...base,
  kind: z.literal("axle"),
  a: anchor,
  b: IdSchema,
  at: Vec2Schema,
  motor: MotorSchema.optional(),
  limit: AngleLimitSchema.optional(),
  torsion: TorsionSchema.optional(),
});

export const PinSchema = z.strictObject({
  ...base,
  kind: z.literal("pin"),
  host: IdSchema,
  at: Vec2Schema,
  r: positive("O raio do pino"),
  layers: LayerRangeSchema,
});

export const SliderSchema = z
  .strictObject({
    ...base,
    kind: z.literal("slider"),
    a: anchor,
    b: IdSchema,
    at: Vec2Schema,
    /** rad, relativo ao ângulo de b */
    dir: finite("A direção do trilho"),
    /** [mínimo, máximo] em mm ao longo de dir, a partir da pose desenhada */
    travel: z.tuple([finite("O curso para trás"), finite("O curso à frente")]),
    spring: LinearSpringSchema.optional(),
  })
  .refine((s) => s.travel[0] <= s.travel[1], {
    message: "O início do curso precisa ser menor ou igual ao fim",
    path: ["travel"],
  });

export const SpringSchema = z.strictObject({
  ...base,
  kind: z.literal("spring"),
  a: anchor,
  b: anchor,
  atA: Vec2Schema,
  atB: Vec2Schema,
  k: nonNeg("A rigidez"),
  damping: nonNeg("O amortecimento"),
  freeLength: nonNeg("O comprimento livre"),
});

export const ChamberSchema = z.strictObject({
  ...base,
  kind: z.literal("chamber"),
  /** fundo da câmara (null = preso ao mundo) */
  a: anchor,
  /** projétil ou pistão */
  b: anchor,
  /** fundo, no espaço local de a */
  at: Vec2Schema,
  /** rad, relativo ao ângulo de a */
  dir: finite("A direção da câmara"),
  /** largura do furo, mm */
  bore: positive("A largura da câmara"),
  /** distância do fundo até a saída, mm */
  length: positive("O comprimento da câmara"),
  /** carga de gás, g·mm²/s² (força no projétil = carga / distância) */
  charge: nonNeg("A carga de gás"),
  /** tempo de queima, s */
  burn: nonNeg("O tempo de queima"),
});

export const SensorSchema = z.strictObject({
  ...base,
  kind: z.literal("sensor"),
  host: IdSchema,
  at: Vec2Schema,
  r: positive("O raio do sensor"),
  layers: LayerRangeSchema,
  /** mm/s */
  minSpeed: nonNeg("O impacto mínimo"),
  /** ligações acionadas (câmaras) */
  triggers: z.array(IdSchema),
});

export const LinkSchema = z.discriminatedUnion(
  "kind",
  [ScrewSchema, AxleSchema, PinSchema, SliderSchema, SpringSchema, ChamberSchema, SensorSchema],
  { error: "Tipo de ligação inválido: use screw, axle, pin, slider, spring, chamber ou sensor" },
);

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

const SceneShape = z.strictObject({
  version: z.literal(1, { error: "Versão da cena desconhecida: esperava 1" }),
  meta: MetaSchema,
  settings: SettingsSchema,
  layers: z
    .array(LayerSchema)
    .min(1, "A cena precisa de pelo menos uma camada")
    .max(MAX_LAYERS, `No máximo ${MAX_LAYERS} camadas`),
  parts: z.array(PartSchema),
  links: z.array(LinkSchema),
});

type SceneIn = z.infer<typeof SceneShape>;

/** Integridade referencial: ids únicos, refs únicas, referências existentes. */
function checkReferences(s: SceneIn, ctx: z.RefinementCtx): void {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });

  const layerIds = new Set<string>();
  s.layers.forEach((l, i) => {
    if (layerIds.has(l.id)) issue(["layers", i, "id"], `Id de camada repetido: ${l.id}`);
    layerIds.add(l.id);
  });

  const all = new Set<string>(layerIds);
  const partIds = new Set<string>();
  const refs = new Map<number, string>();
  const seeRef = (ref: number, path: (string | number)[]) => {
    if (refs.has(ref)) issue([...path, "ref"], `Número de chamada repetido: ${ref}`);
    refs.set(ref, path.join("."));
  };

  s.parts.forEach((p, i) => {
    if (all.has(p.id)) issue(["parts", i, "id"], `Id repetido: ${p.id}`);
    all.add(p.id);
    partIds.add(p.id);
    seeRef(p.ref, ["parts", i]);
    if (!layerIds.has(p.layer)) issue(["parts", i, "layer"], `Camada inexistente: ${p.layer}`);
  });

  const linkIds = new Map<string, string>();
  s.links.forEach((l, i) => {
    if (all.has(l.id)) issue(["links", i, "id"], `Id repetido: ${l.id}`);
    all.add(l.id);
    linkIds.set(l.id, l.kind);
    seeRef(l.ref, ["links", i]);
  });

  const needPart = (i: number, field: string, id: string | null, nullable: boolean) => {
    if (id === null) {
      if (!nullable) issue(["links", i, field], "Esta ponta precisa estar presa a uma peça");
      return;
    }
    if (!partIds.has(id)) issue(["links", i, field], `Peça inexistente: ${id}`);
  };

  s.links.forEach((l, i) => {
    switch (l.kind) {
      case "screw":
      case "axle":
      case "slider":
        needPart(i, "b", l.b, false);
        needPart(i, "a", l.a, true);
        if (l.a !== null && l.a === l.b)
          issue(["links", i, "a"], "A ligação não pode prender a peça nela mesma");
        break;
      case "spring":
        needPart(i, "a", l.a, true);
        needPart(i, "b", l.b, true);
        if (l.a !== null && l.a === l.b)
          issue(["links", i, "b"], "As duas pontas da mola estão na mesma peça");
        break;
      case "chamber":
        needPart(i, "a", l.a, true);
        needPart(i, "b", l.b, true);
        if (l.a !== null && l.a === l.b)
          issue(["links", i, "b"], "O projétil não pode ser o fundo da câmara");
        break;
      case "pin":
      case "sensor":
        needPart(i, "host", l.host, false);
        l.layers.forEach((lid, j) => {
          if (!layerIds.has(lid)) issue(["links", i, "layers", j], `Camada inexistente: ${lid}`);
        });
        if (l.kind === "sensor") {
          l.triggers.forEach((t, j) => {
            const kind = linkIds.get(t);
            if (kind === undefined) issue(["links", i, "triggers", j], `Ligação inexistente: ${t}`);
            else if (kind !== "chamber") issue(["links", i, "triggers", j], "O sensor só aciona câmaras");
          });
        }
        break;
    }
  });
}

export const SceneSchema = SceneShape.superRefine(checkReferences);
