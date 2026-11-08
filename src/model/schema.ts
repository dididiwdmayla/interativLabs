import { z } from "zod";
import { straightSlot } from "@/geometry/slot";
import {
  AngleLimitSchema,
  IdSchema,
  LayerRangeSchema,
  MAX_LAYERS,
  MetaSchema,
  PartSchema as LegacyPartSchema,
  RefSchema,
  SettingsSchema,
  ShapeSchema,
  Vec2Schema,
  checkCommon,
  finite,
  nonNeg,
  positive,
} from "./schema-common";

export {
  AngleLimitSchema,
  CircleShapeSchema,
  GearShapeSchema,
  IdSchema,
  MAX_LAYERS,
  MetaSchema,
  PolyShapeSchema,
  SettingsSchema,
  ShapeSchema,
  Vec2Schema,
} from "./schema-common";

/**
 * Scene format v4: the capsule (a part with a charge) and the chamber that
 * receives it (architecture §3.3), over v3's multilayer profiles and
 * releasable locks (§3.2).
 * Unidades: mm, g, s, N, N/mm, N·mm, kPa, rad (ver src/model/units.ts).
 * Pontos são [x, y], no espaço local da peça de referência.
 */

export const ProfileSchema = z.strictObject({
  id: IdSchema,
  layer: IdSchema,
  shape: ShapeSchema,
  material: LegacyPartSchema.shape.material.optional(),
  source: LegacyPartSchema.shape.source,
});

/** v3 part: multilayer profiles. */
export const PartV3Schema = LegacyPartSchema.extend({ profiles: z.array(ProfileSchema).optional() });

/**
 * Capsule (v4): a case with a charge, an inner bore and the projectile held at the mouth.
 * Local points of the case part; mm, mmol, mm/s.
 */
export const CapsuleSchema = z.strictObject({
  /** mmol, didático */
  charge: nonNeg("A carga da cápsula"),
  /** a esfera presa na boca */
  projectile: IdSchema.optional(),
  /** fundo interno e boca: o eixo e o comprimento do furo */
  base: Vec2Schema,
  mouth: Vec2Schema,
  /** diâmetro do furo, mm */
  bore: positive("O diâmetro do furo da cápsula"),
  /** a espoleta */
  primer: Vec2Schema,
  /** golpe mínimo na espoleta, mm/s */
  minStrike: positive("O golpe mínimo na espoleta"),
});

export const PartSchema = PartV3Schema.extend({ capsule: CapsuleSchema.optional() });

export const LayerSchema = z.strictObject({
  id: IdSchema,
  name: z.string(),
  visible: z.boolean(),
  locked: z.boolean(),
  /** mm; massa = densidade × área × espessura */
  thickness: positive("A espessura da camada"),
});

/** Motor do eixo: velocidade-alvo (rad/s, positivo = horário) e torque máximo (N·mm). */
export const MotorSchema = z.strictObject({
  speed: finite("A velocidade do motor"),
  maxTorque: nonNeg("O torque máximo"),
});

/** Mola de torção: rigidez (N·mm/rad), ângulo de repouso (rad) e amortecimento (N·mm·s/rad). */
export const TorsionSchema = z.strictObject({
  k: nonNeg("A rigidez da mola de torção"),
  rest: finite("O ângulo de repouso"),
  damping: nonNeg("O amortecimento da mola de torção"),
});

/** Mola de retorno do trilho: rigidez (N/mm), repouso (mm ao longo do eixo) e amortecimento (N·s/mm). */
export const LinearSpringSchema = z.strictObject({
  k: nonNeg("A rigidez da mola de retorno"),
  rest: finite("A posição de repouso"),
  damping: nonNeg("O amortecimento da mola de retorno"),
});

const base = { id: IdSchema, ref: RefSchema };
const anchor = IdSchema.nullable();

export const ScrewSchema = z.strictObject({
  ...base,
  kind: z.literal("screw"),
  a: anchor,
  b: IdSchema,
  at: Vec2Schema,
});

export const LockSchema = z.strictObject({
  ...base,
  kind: z.literal("lock"),
  a: anchor,
  b: IdSchema,
  at: Vec2Schema,
  breakForce: positive("A força de soltura").optional(),
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
  /** atrito no eixo, N·mm (torque que precisa ser vencido para girar) */
  friction: nonNeg("O atrito do eixo").optional(),
});

/** Haste (biela): distância fixa entre dois pontos, gira livre nas duas pontas. */
export const RodSchema = z.strictObject({
  ...base,
  kind: z.literal("rod"),
  a: anchor,
  b: anchor,
  atA: Vec2Schema,
  atB: Vec2Schema,
});

/** Cabo: só limita a distância máxima; afrouxa. */
export const CableSchema = z.strictObject({
  ...base,
  kind: z.literal("cable"),
  a: anchor,
  b: anchor,
  atA: Vec2Schema,
  atB: Vec2Schema,
  maxLength: positive("O comprimento do cabo"),
});

/** Suporte elástico: preso, mas cede com o peso e vibra. */
export const MountSchema = z.strictObject({
  ...base,
  kind: z.literal("mount"),
  a: anchor,
  b: IdSchema,
  at: Vec2Schema,
  linearHz: positive("A frequência linear do suporte"),
  angularHz: positive("A frequência angular do suporte"),
  /** razão de amortecimento (1 = crítico) */
  damping: nonNeg("O amortecimento do suporte"),
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
    /** atrito do trilho, N */
    friction: nonNeg("O atrito do trilho").optional(),
  })
  .refine((s) => s.travel[0] <= s.travel[1], {
    message: "O início do curso precisa ser menor ou igual ao fim",
    path: ["travel"],
  });

export const PinSchema = z.strictObject({
  ...base,
  kind: z.literal("pin"),
  host: IdSchema,
  at: Vec2Schema,
  r: positive("O raio do pino"),
  layers: LayerRangeSchema,
});

/** Pino correndo num furo ou rasgo de outra peça. */
export const SlotSchema = z.strictObject({
  ...base,
  kind: z.literal("slot"),
  /** ligação pin */
  pin: IdSchema,
  /** peça com o furo */
  guide: IdSchema,
  profile: IdSchema.optional(),
  /** índice em shape.holes da peça-guia */
  hole: z.number().int("O índice do furo precisa ser inteiro").nonnegative("Índice de furo inválido"),
  mode: z.enum(["joint", "contact"], { error: 'Modo do rasgo inválido: use "joint" ou "contact"' }),
});

export const CoilSchema = z
  .strictObject({
    /** diâmetro externo, mm */
    outerD: positive("O diâmetro externo da mola"),
    /** diâmetro do arame, mm */
    wireD: positive("O diâmetro do arame"),
    turns: positive("O número de espiras"),
  })
  .refine((c) => c.wireD * 2 < c.outerD, {
    message: "O arame precisa ser mais fino que metade do diâmetro externo",
    path: ["wireD"],
  });

export const SpringSchema = z
  .strictObject({
    ...base,
    kind: z.literal("spring"),
    a: anchor,
    b: anchor,
    atA: Vec2Schema,
    atB: Vec2Schema,
    /** N/mm */
    k: nonNeg("A rigidez"),
    /** N·s/mm */
    damping: nonNeg("O amortecimento"),
    /** mm */
    freeLength: nonNeg("O comprimento livre"),
    /** presa nas duas pontas | apoiada (só empurra) | só puxa */
    mode: z.enum(["fixed", "seated", "tension"], {
      error: 'Modo da mola inválido: use "fixed", "seated" ou "tension"',
    }),
    /** espiras encostadas, mm (padrão: espiras × arame) */
    solidLength: nonNeg("O comprimento sólido").optional(),
    /** peça que passa por dentro e alinha o eixo da mola */
    guide: IdSchema.optional(),
    coil: CoilSchema,
  })
  .refine((s) => s.solidLength === undefined || s.mode === "tension" || s.solidLength <= s.freeLength, {
    message: "O comprimento sólido precisa ser menor ou igual ao comprimento livre",
    path: ["solidLength"],
  });

export const WallSchema = z.strictObject({
  part: IdSchema,
  /** mm de curso, a partir da pose desenhada, até a parede deixar de vedar */
  seal: nonNeg("O curso de vedação"),
});

export const VentSchema = z.strictObject({
  /** mm do fundo, ao longo do eixo */
  at: finite("A posição do respiro"),
  /** diâmetro do orifício, mm */
  d: positive("O diâmetro do respiro"),
  /** válvula aberta; um respiro aberto só solta gás quando está dentro da câmara */
  open: z.boolean(),
});

export const PortSchema = z.strictObject({
  /** outra câmara */
  to: IdSchema,
  /** mm do fundo desta câmara */
  at: finite("A posição da porta"),
  /** diâmetro, mm */
  d: positive("O diâmetro da porta"),
});

export const GasSchema = z.strictObject({
  model: z.enum(["isothermal", "adiabatic"], {
    error: 'Modelo de gás inválido: use "isothermal" ou "adiabatic"',
  }),
  /** razão dos calores específicos (ar: 1,4) */
  gamma: finite("O γ do gás").refine((v) => v >= 1 && v <= 2, "O γ precisa ficar entre 1 e 2"),
  /** pressão inicial e do ambiente, kPa */
  p0: nonNeg("A pressão inicial"),
  charge: z
    .strictObject({
      /** mmol */
      amount: nonNeg("A carga de gás"),
      /** tempo de queima, ms */
      burnMs: nonNeg("O tempo de queima"),
      /**
       * quantas vezes a carga acende (padrão 1): um reservatório que solta uma
       * dose a cada acendimento, como num lançador que repete
       */
      shots: z
        .number({ error: "O número de cargas precisa ser um número" })
        .int("O número de cargas precisa ser inteiro")
        .min(1, "O número de cargas precisa ser pelo menos 1")
        .optional(),
    })
    .optional(),
});

export const ChamberV3Schema = z.strictObject({
  ...base,
  kind: z.literal("chamber"),
  /** corpo que contém o furo (null = o fundo) */
  body: anchor,
  /** fundo do cilindro, no espaço local de body */
  at: Vec2Schema,
  /** rad, relativo ao ângulo de body (do fundo para a saída) */
  dir: finite("A direção da câmara"),
  /** diâmetro do furo, mm */
  bore: positive("O diâmetro da câmara"),
  /** do fundo até a saída, mm */
  length: positive("O comprimento da câmara"),
  walls: z.array(WallSchema),
  vents: z.array(VentSchema),
  ports: z.array(PortSchema),
  gas: GasSchema,
});

/**
 * v4 chamber: `mode: "capsule"` has no charge or walls of its own and receives a seated capsule;
 * `seat` is how far (mm) the case rear may be from `at` and still count as seated.
 */
export const ChamberSchema = ChamberV3Schema.extend({
  mode: z
    .enum(["charge", "capsule"], { error: 'Modo da câmara inválido: use "charge" ou "capsule"' })
    .optional(),
  seat: nonNeg("O assento da câmara").optional(),
});

export const SensorActionSchema = z.strictObject({
  do: z.enum(["ignite", "open", "close", "release"], {
    error: 'Ação inválida: use "ignite", "open", "close" ou "release"',
  }),
  /** câmara */
  target: IdSchema,
  /** índice do respiro (abrir e fechar) */
  vent: z.number().int("O índice do respiro precisa ser inteiro").nonnegative().optional(),
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
  actions: z.array(SensorActionSchema),
});

const LINK_ERROR =
  "Tipo de ligação inválido: use screw, axle, rod, cable, mount, slider, pin, slot, spring, chamber, sensor ou lock";

export const LinkV3Schema = z.discriminatedUnion(
  "kind",
  [
    ScrewSchema,
    LockSchema,
    AxleSchema,
    RodSchema,
    CableSchema,
    MountSchema,
    SliderSchema,
    PinSchema,
    SlotSchema,
    SpringSchema,
    ChamberV3Schema,
    SensorSchema,
  ],
  { error: LINK_ERROR },
);

export const LinkSchema = z.discriminatedUnion(
  "kind",
  [
    ScrewSchema,
    LockSchema,
    AxleSchema,
    RodSchema,
    CableSchema,
    MountSchema,
    SliderSchema,
    PinSchema,
    SlotSchema,
    SpringSchema,
    ChamberSchema,
    SensorSchema,
  ],
  { error: LINK_ERROR },
);

const layersField = z
  .array(LayerSchema)
  .min(1, "A cena precisa de pelo menos uma camada")
  .max(MAX_LAYERS, `No máximo ${MAX_LAYERS} camadas`);

const SceneV3Shape = z.strictObject({
  version: z.literal(3, { error: "Versão da cena desconhecida: esperava 3" }),
  meta: MetaSchema,
  settings: SettingsSchema,
  layers: layersField,
  parts: z.array(PartV3Schema),
  links: z.array(LinkV3Schema),
});

const SceneShape = z.strictObject({
  version: z.literal(4, { error: "Versão da cena desconhecida: esperava 4" }),
  meta: MetaSchema,
  settings: SettingsSchema,
  layers: layersField,
  parts: z.array(PartSchema),
  links: z.array(LinkSchema),
});

type SceneIn = z.infer<typeof SceneShape>;
type LinkIn = SceneIn["links"][number];

/** Integridade referencial: ids e refs únicos, referências existentes e coerentes. */
function checkReferences(s: SceneIn, ctx: z.RefinementCtx): void {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });
  const { layerIds, partIds } = checkCommon(s, issue);
  const partById = new Map(s.parts.map((p) => [p.id, p] as const));
  const linkById = new Map<string, LinkIn>(s.links.map((l) => [l.id, l] as const));
  const layerIndex = new Map(s.layers.map((l, i) => [l.id, i] as const));
  const screwedToGround = new Set(s.links.flatMap((l) => (l.kind === "screw" && l.a === null ? [l.b] : [])));

  const needPart = (i: number, field: string, id: string | null, nullable: boolean) => {
    if (id === null) {
      if (!nullable) issue(["links", i, field], "Esta ponta precisa estar presa a uma peça");
      return;
    }
    if (!partIds.has(id)) issue(["links", i, field], `Peça inexistente: ${id}`);
  };
  const twoEnds = (i: number, a: string | null, b: string | null, what: string) => {
    needPart(i, "a", a, true);
    needPart(i, "b", b, true);
    if (a === null && b === null) issue(["links", i, "b"], `As duas pontas ${what} estão no fundo`);
    else if (a !== null && a === b) issue(["links", i, "b"], `As duas pontas ${what} estão na mesma peça`);
  };
  const needLayers = (i: number, layers: [string, string]) =>
    layers.forEach((lid, j) => {
      if (!layerIds.has(lid)) issue(["links", i, "layers", j], `Camada inexistente: ${lid}`);
    });

  const ids = new Set([...s.layers, ...s.parts, ...s.links].map((x) => x.id));
  s.parts.forEach((p, i) => {
    const layers = new Set([p.layer]);
    p.profiles?.forEach((profile, j) => {
      const path = ["parts", i, "profiles", j];
      if (ids.has(profile.id)) issue([...path, "id"], `Id repetido: ${profile.id}`);
      ids.add(profile.id);
      if (!layerIds.has(profile.layer)) issue([...path, "layer"], `Camada inexistente: ${profile.layer}`);
      if (layers.has(profile.layer)) issue([...path, "layer"], "A peça só pode ter um perfil por camada");
      layers.add(profile.layer);
    });
  });

  const projectiles = new Map<string, number>();
  s.parts.forEach((p, i) => {
    const c = p.capsule;
    if (!c) return;
    const path = ["parts", i, "capsule"];
    if (c.base[0] === c.mouth[0] && c.base[1] === c.mouth[1])
      issue([...path, "mouth"], "O fundo e a boca da cápsula precisam ser pontos diferentes");
    if (c.projectile === undefined) return;
    const ball = partById.get(c.projectile);
    if (!ball) issue([...path, "projectile"], `Peça inexistente: ${c.projectile}`);
    else if (ball.id === p.id) issue([...path, "projectile"], "O projétil não pode ser a própria cápsula");
    else if (ball.shape.kind !== "circle")
      issue([...path, "projectile"], "O projétil da cápsula precisa ser uma esfera");
    else if (ball.layer !== p.layer)
      issue([...path, "projectile"], "O projétil precisa estar na camada da cápsula");
    else if (ball.fixed) issue([...path, "projectile"], "O projétil precisa ser uma peça móvel");
    else if (ball.capsule) issue([...path, "projectile"], "O projétil não pode ser outra cápsula");
    const other = projectiles.get(c.projectile);
    if (other !== undefined)
      issue([...path, "projectile"], `O projétil já está na cápsula ${s.parts[other]?.ref ?? ""}`);
    projectiles.set(c.projectile, i);
  });

  s.links.forEach((l, i) => {
    switch (l.kind) {
      case "lock":
      case "screw":
      case "axle":
      case "slider":
      case "mount":
        needPart(i, "b", l.b, false);
        needPart(i, "a", l.a, true);
        if (l.a !== null && l.a === l.b)
          issue(["links", i, "a"], "A ligação não pode prender a peça nela mesma");
        break;
      case "rod":
        twoEnds(i, l.a, l.b, "da haste");
        break;
      case "cable":
        twoEnds(i, l.a, l.b, "do cabo");
        break;
      case "spring":
        twoEnds(i, l.a, l.b, "da mola");
        if (l.guide !== undefined && !partIds.has(l.guide))
          issue(["links", i, "guide"], `Peça-guia inexistente: ${l.guide}`);
        break;
      case "pin":
        needPart(i, "host", l.host, false);
        needLayers(i, l.layers);
        break;
      case "sensor":
        needPart(i, "host", l.host, false);
        needLayers(i, l.layers);
        l.actions.forEach((a, j) => {
          const t = linkById.get(a.target);
          if (!t) issue(["links", i, "actions", j, "target"], `Ligação inexistente: ${a.target}`);
          else if (a.do === "release") {
            if (t.kind !== "lock")
              issue(["links", i, "actions", j, "target"], "Soltar precisa apontar para uma trava");
            if (a.vent !== undefined)
              issue(["links", i, "actions", j, "vent"], "Soltar uma trava não usa respiro");
          } else if (t.kind !== "chamber")
            issue(["links", i, "actions", j, "target"], "O sensor só age sobre câmaras");
          else if (a.do !== "ignite") {
            if (a.vent === undefined)
              issue(["links", i, "actions", j, "vent"], "Abrir ou fechar precisa do índice do respiro");
            else if (a.vent >= t.vents.length)
              issue(["links", i, "actions", j, "vent"], `Respiro inexistente na câmara ${t.ref}: ${a.vent}`);
          }
        });
        break;
      case "slot": {
        const pin = linkById.get(l.pin);
        if (!pin) issue(["links", i, "pin"], `Ligação inexistente: ${l.pin}`);
        else if (pin.kind !== "pin") issue(["links", i, "pin"], "O rasgo precisa apontar para um pino");
        const guide = partById.get(l.guide);
        if (!guide) {
          issue(["links", i, "guide"], `Peça inexistente: ${l.guide}`);
          break;
        }
        const profile = l.profile === undefined ? guide : guide.profiles?.find((p) => p.id === l.profile);
        if (!profile) {
          issue(["links", i, "profile"], `Perfil inexistente na peça ${guide.ref}: ${l.profile}`);
          break;
        }
        if (pin?.kind === "pin") {
          if (pin.host === l.guide)
            issue(["links", i, "guide"], "O pino não pode correr num furo da própria peça");
          const gi = layerIndex.get(profile.layer);
          const a = layerIndex.get(pin.layers[0]);
          const b = layerIndex.get(pin.layers[1]);
          if (
            gi !== undefined &&
            a !== undefined &&
            b !== undefined &&
            (gi < Math.min(a, b) || gi > Math.max(a, b))
          )
            issue(["links", i, "pin"], "O pino precisa ocupar a camada da peça-guia");
        }
        const holes = profile.shape.kind === "gear" ? [] : profile.shape.holes;
        const hole = holes[l.hole];
        if (!hole) {
          issue(["links", i, "hole"], `Furo inexistente na peça ${guide.ref}: ${l.hole}`);
          break;
        }
        if (l.mode === "joint") {
          const st = straightSlot(hole);
          if (!st) issue(["links", i, "mode"], "Rasgo curvo: use o modo contato");
          else if (pin?.kind === "pin" && pin.r > st.r + 1e-6)
            issue(["links", i, "pin"], "O pino é mais largo que o rasgo");
        }
        break;
      }
      case "chamber": {
        needPart(i, "body", l.body, true);
        if (l.mode === "capsule") {
          if (l.gas.charge)
            issue(["links", i, "gas", "charge"], "A câmara que recebe cápsula não tem carga própria");
          if (l.walls.length)
            issue(
              ["links", i, "walls"],
              "A câmara que recebe cápsula não tem paredes: a cápsula traz as dela",
            );
          if (l.vents.length)
            issue(["links", i, "vents"], "A câmara que recebe cápsula ainda não aceita respiros");
          if (l.ports.length)
            issue(["links", i, "ports"], "A câmara que recebe cápsula ainda não aceita portas");
          break;
        }
        if (l.seat !== undefined)
          issue(["links", i, "seat"], "O assento só vale na câmara que recebe cápsula");
        if (l.walls.length < 1 || l.walls.length > 2)
          issue(["links", i, "walls"], "A câmara precisa de 1 ou 2 paredes móveis");
        const seen = new Set<string>();
        l.walls.forEach((w, j) => {
          const p = partById.get(w.part);
          if (!p) issue(["links", i, "walls", j, "part"], `Peça inexistente: ${w.part}`);
          else if (p.fixed || screwedToGround.has(p.id))
            issue(["links", i, "walls", j, "part"], "A parede da câmara precisa ser uma peça móvel");
          if (w.part === l.body)
            issue(["links", i, "walls", j, "part"], "A parede não pode ser o corpo da câmara");
          if (seen.has(w.part)) issue(["links", i, "walls", j, "part"], "Parede repetida");
          seen.add(w.part);
        });
        l.ports.forEach((p, j) => {
          const t = linkById.get(p.to);
          if (!t) issue(["links", i, "ports", j, "to"], `Ligação inexistente: ${p.to}`);
          else if (t.kind !== "chamber")
            issue(["links", i, "ports", j, "to"], "A porta precisa levar a outra câmara");
          else if (t.id === l.id)
            issue(["links", i, "ports", j, "to"], "A porta não pode levar à própria câmara");
        });
        break;
      }
    }
  });
}

export const SceneSchema = SceneShape.superRefine(checkReferences);

/** v3 scenes (read only, for the migration): the same integrity checks, none of v4's fields. */
export const SceneV3Schema = SceneV3Shape.superRefine((s, ctx) => checkReferences({ ...s, version: 4 }, ctx));
