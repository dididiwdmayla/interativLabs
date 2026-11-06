import type { z } from "zod";
import type {
  AngleLimitSchema,
  AxleSchema,
  CableSchema,
  ChamberSchema,
  CoilSchema,
  GasSchema,
  LayerSchema,
  LinearSpringSchema,
  LinkSchema,
  MotorSchema,
  MountSchema,
  LockSchema,
  ProfileSchema,
  PartSchema,
  PinSchema,
  PortSchema,
  RodSchema,
  SceneSchema,
  ScrewSchema,
  SensorActionSchema,
  SensorSchema,
  ShapeSchema,
  SliderSchema,
  SlotSchema,
  SpringSchema,
  TorsionSchema,
  VentSchema,
  WallSchema,
} from "./schema";
import type { LinkV1Schema, SceneV1Schema } from "./schema-v1";

/** Tipos da cena v3, derivados do schema (fonte única). */
export type Vec2 = [number, number];
export type Id = string;
export type Scene = z.infer<typeof SceneSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type Part = z.infer<typeof PartSchema>;
export type Shape = z.infer<typeof ShapeSchema>;
export type Link = z.infer<typeof LinkSchema>;
export type LinkKind = Link["kind"];
export type ScrewLink = z.infer<typeof ScrewSchema>;
export type AxleLink = z.infer<typeof AxleSchema>;
export type RodLink = z.infer<typeof RodSchema>;
export type CableLink = z.infer<typeof CableSchema>;
export type MountLink = z.infer<typeof MountSchema>;
export type PinLink = z.infer<typeof PinSchema>;
export type SlotLink = z.infer<typeof SlotSchema>;
export type SliderLink = z.infer<typeof SliderSchema>;
export type SpringLink = z.infer<typeof SpringSchema>;
export type ChamberLink = z.infer<typeof ChamberSchema>;
export type SensorLink = z.infer<typeof SensorSchema>;
export type SensorAction = z.infer<typeof SensorActionSchema>;
export type Motor = z.infer<typeof MotorSchema>;
export type AngleLimit = z.infer<typeof AngleLimitSchema>;
export type Torsion = z.infer<typeof TorsionSchema>;
export type LinearSpring = z.infer<typeof LinearSpringSchema>;
export type Coil = z.infer<typeof CoilSchema>;
export type Gas = z.infer<typeof GasSchema>;
export type Wall = z.infer<typeof WallSchema>;
export type Vent = z.infer<typeof VentSchema>;
export type Port = z.infer<typeof PortSchema>;

/** Cena v1 (só leitura, para a migração). */
export type SceneV1 = z.infer<typeof SceneV1Schema>;
export type LinkV1 = z.infer<typeof LinkV1Schema>;

export type Profile = z.infer<typeof ProfileSchema>;
export type LockLink = z.infer<typeof LockSchema>;
export type SceneV2 = z.infer<typeof import("./schema-v2").SceneV2Schema>;
