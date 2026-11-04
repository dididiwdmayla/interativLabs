import { z } from "zod";
import {
  AngleLimitSchema,
  IdSchema,
  LayerRangeSchema,
  MAX_LAYERS,
  MetaSchema,
  PartSchema,
  RefSchema,
  SettingsSchema,
  Vec2Schema,
  checkCommon,
  finite,
  nonNeg,
  positive,
} from "./schema-common";

/**
 * Formato da cena, versão 1 (docs/arquitetura.md §3). Só leitura: toda cena
 * v1 é migrada para a v2 ao abrir (src/model/migrations/v1-to-v2.ts).
 * Unidades: mm, g, s, rad; forças em g·mm/s² (ver src/model/units.ts).
 */

export const LayerV1Schema = z.strictObject({
  id: IdSchema,
  name: z.string(),
  visible: z.boolean(),
  locked: z.boolean(),
});

/** Motor do eixo: velocidade-alvo (rad/s, positivo = horário) e torque máximo (g·mm²/s²). */
export const MotorV1Schema = z.strictObject({
  speed: finite("A velocidade do motor"),
  maxTorque: nonNeg("O torque máximo"),
});

/** Mola de torção: rigidez (por rad), ângulo de repouso (rad) e amortecimento (por rad/s). */
export const TorsionV1Schema = z.strictObject({
  k: nonNeg("A rigidez da mola de torção"),
  rest: finite("O ângulo de repouso"),
  damping: nonNeg("O amortecimento da mola de torção"),
});

/** Mola de retorno do trilho: rigidez (g/s²), repouso (mm ao longo do eixo) e amortecimento (g/s). */
export const LinearSpringV1Schema = z.strictObject({
  k: nonNeg("A rigidez da mola de retorno"),
  rest: finite("A posição de repouso"),
  damping: nonNeg("O amortecimento da mola de retorno"),
});

const base = { id: IdSchema, ref: RefSchema };
const anchor = IdSchema.nullable();

export const ScrewV1Schema = z.strictObject({
  ...base,
  kind: z.literal("screw"),
  a: anchor,
  b: IdSchema,
  at: Vec2Schema,
});

export const AxleV1Schema = z.strictObject({
  ...base,
  kind: z.literal("axle"),
  a: anchor,
  b: IdSchema,
  at: Vec2Schema,
  motor: MotorV1Schema.optional(),
  limit: AngleLimitSchema.optional(),
  torsion: TorsionV1Schema.optional(),
});

export const PinV1Schema = z.strictObject({
  ...base,
  kind: z.literal("pin"),
  host: IdSchema,
  at: Vec2Schema,
  r: positive("O raio do pino"),
  layers: LayerRangeSchema,
});

export const SliderV1Schema = z
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
    spring: LinearSpringV1Schema.optional(),
  })
  .refine((s) => s.travel[0] <= s.travel[1], {
    message: "O início do curso precisa ser menor ou igual ao fim",
    path: ["travel"],
  });

export const SpringV1Schema = z.strictObject({
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

export const ChamberV1Schema = z.strictObject({
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

export const SensorV1Schema = z.strictObject({
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

export const LinkV1Schema = z.discriminatedUnion(
  "kind",
  [ScrewV1Schema, AxleV1Schema, PinV1Schema, SliderV1Schema, SpringV1Schema, ChamberV1Schema, SensorV1Schema],
  { error: "Tipo de ligação inválido: use screw, axle, pin, slider, spring, chamber ou sensor" },
);

const SceneShape = z.strictObject({
  version: z.literal(1, { error: "Versão da cena desconhecida: esperava 1" }),
  meta: MetaSchema,
  settings: SettingsSchema,
  layers: z
    .array(LayerV1Schema)
    .min(1, "A cena precisa de pelo menos uma camada")
    .max(MAX_LAYERS, `No máximo ${MAX_LAYERS} camadas`),
  parts: z.array(PartSchema),
  links: z.array(LinkV1Schema),
});

type SceneIn = z.infer<typeof SceneShape>;

/** Integridade referencial: ids únicos, refs únicas, referências existentes. */
function checkReferences(s: SceneIn, ctx: z.RefinementCtx): void {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });
  const { layerIds, partIds, linkKinds: linkIds } = checkCommon(s, issue);

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

export const SceneV1Schema = SceneShape.superRefine(checkReferences);
