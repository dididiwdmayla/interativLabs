import type { z } from "zod";
import type {
  AngleLimitSchema,
  AxleSchema,
  ChamberSchema,
  LayerSchema,
  LinearSpringSchema,
  LinkSchema,
  MotorSchema,
  PartSchema,
  PinSchema,
  SceneSchema,
  ScrewSchema,
  SensorSchema,
  ShapeSchema,
  SliderSchema,
  SpringSchema,
  TorsionSchema,
} from "./schema";

/** Tipos da cena v1, derivados do schema (fonte única). */
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
export type PinLink = z.infer<typeof PinSchema>;
export type SliderLink = z.infer<typeof SliderSchema>;
export type SpringLink = z.infer<typeof SpringSchema>;
export type ChamberLink = z.infer<typeof ChamberSchema>;
export type SensorLink = z.infer<typeof SensorSchema>;
export type Motor = z.infer<typeof MotorSchema>;
export type AngleLimit = z.infer<typeof AngleLimitSchema>;
export type Torsion = z.infer<typeof TorsionSchema>;
export type LinearSpring = z.infer<typeof LinearSpringSchema>;
