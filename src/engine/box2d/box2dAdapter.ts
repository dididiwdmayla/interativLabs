import type { Box2DModule, b2BodyId, b2JointId, b2ShapeId, b2Vec2, b2WorldId } from "box2d3-wasm";
import type { Vec2 } from "@/geometry/vec";
import type { Id, Scene } from "@/model/types";
import { ANGULAR_DAMPING, SPEED_LIMIT, trackedBodies, unwrapAngle } from "../common";
import { buildPlan } from "../plan";
import { Runtime, type BodyIO, type BodyState } from "../runtime";
import type { CompileOptions, CompileReport, EngineAdapter, PartPose, Snapshot } from "../types";

export const BOX2D_WASM_VERSION = "6.0.0";
/** Subpassos internos do solver suave do Box2D v3 em cada passo de 1/240 s. */
const SUB_STEPS = 4;

interface ShapeData {
  part: Id;
  body: number;
  sensor?: Id;
}

/**
 * Adaptador do Box2D v3.2 compilado para WASM (box2d3-wasm, build "compat":
 * sem threads nem SIMD, roda em qualquer navegador e no Node).
 */
export function createBox2dAdapter(B: Box2DModule): EngineAdapter {
  let worldId: b2WorldId | null = null;
  let rt: Runtime | null = null;
  let L = 1;
  let bodies: b2BodyId[] = [];
  let dynamic: number[] = [];
  let angles: number[] = [];
  let tracked: number[] = [];
  const shapeData: ShapeData[] = [];
  const joints = new Map<Id, b2JointId>();
  const v1: b2Vec2 = new B.b2Vec2(0, 0);
  const v2: b2Vec2 = new B.b2Vec2(0, 0);

  const angleOf = (i: number): number => {
    const r = B.b2Body_GetRotation(bodies[i]!);
    const a = unwrapAngle(angles[i]!, Math.atan2(r.s, r.c));
    r.delete();
    angles[i] = a;
    return a;
  };

  const io: BodyIO = {
    read(i, out: BodyState) {
      const id = bodies[i]!;
      const p = B.b2Body_GetPosition(id);
      const v = B.b2Body_GetLinearVelocity(id);
      out.x = p.x * L;
      out.y = p.y * L;
      out.vx = v.x * L;
      out.vy = v.y * L;
      p.delete();
      v.delete();
      out.angle = angleOf(i);
      out.w = B.b2Body_GetAngularVelocity(id);
    },
    applyForce(i, fx, fy, px, py) {
      v1.x = fx / L;
      v1.y = fy / L;
      v2.x = px / L;
      v2.y = py / L;
      B.b2Body_ApplyForce(bodies[i]!, v1, v2, true);
    },
    applyTorque(i, t) {
      B.b2Body_ApplyTorque(bodies[i]!, t / (L * L), true);
    },
    applyImpulse(i, jx, jy, px, py) {
      v1.x = jx / L;
      v1.y = jy / L;
      v2.x = px / L;
      v2.y = py / L;
      B.b2Body_ApplyLinearImpulse(bodies[i]!, v1, v2, true);
    },
  };

  const shapeInfo = (id: b2ShapeId): ShapeData | undefined => shapeData[B.b2Shape_GetUserData(id) - 1];

  const adapter: EngineAdapter = {
    meta: {
      id: "box2d",
      name: "Box2D v3 (WASM)",
      version: BOX2D_WASM_VERSION,
      iterations: `${SUB_STEPS} subpassos do solver suave por passo, contínuo contra estáticos`,
    },

    compile(scene: Scene, options: CompileOptions): CompileReport {
      adapter.dispose();
      L = options.unitMm;
      const plan = buildPlan(scene);
      const warnings = [...plan.warnings];
      const wd = B.b2DefaultWorldDef();
      wd.gravity = new B.b2Vec2(plan.gravity[0] / L, plan.gravity[1] / L);
      wd.enableSleep = false;
      wd.maximumLinearSpeed = SPEED_LIMIT / L;
      const w = B.b2CreateWorld(wd);
      wd.delete();
      worldId = w;
      let fixtures = 0;
      shapeData.length = 0;
      bodies = plan.bodies.map((pb) => {
        const bd = B.b2DefaultBodyDef();
        bd.type = pb.static ? B.b2BodyType.b2_staticBody : B.b2BodyType.b2_dynamicBody;
        bd.position = new B.b2Vec2(pb.position[0] / L, pb.position[1] / L);
        bd.isBullet = pb.bullet;
        bd.enableSleep = false;
        bd.angularDamping = ANGULAR_DAMPING;
        const body = B.b2CreateBody(w, bd);
        bd.delete();
        for (const f of pb.fixtures) {
          const sd = B.b2DefaultShapeDef();
          sd.density = 0;
          sd.updateBodyMass = false;
          sd.material.friction = f.friction;
          sd.material.restitution = f.restitution;
          sd.filter.categoryBits = f.bits;
          sd.filter.maskBits = f.bits;
          sd.isSensor = f.sensor;
          sd.enableSensorEvents = true;
          const data: ShapeData = { part: f.part, body: pb.index };
          if (f.sensor && f.link) data.sensor = f.link;
          shapeData.push(data);
          sd.userData = shapeData.length;
          let ok = true;
          if (f.piece.kind === "circle") {
            const c = new B.b2Circle();
            c.center = new B.b2Vec2(f.piece.c[0] / L, f.piece.c[1] / L);
            c.radius = f.piece.r / L;
            B.b2CreateCircleShape(body, sd, c);
            c.delete();
          } else {
            const pts = f.piece.points.map(([x, y]) => new B.b2Vec2(x / L, y / L));
            const hull = B.b2ComputeHull(pts);
            if (hull.count < 3) ok = false;
            else {
              const poly = B.b2MakePolygon(hull, 0);
              B.b2CreatePolygonShape(body, sd, poly);
              poly.delete();
            }
            hull.delete();
            for (const p of pts) p.delete();
          }
          sd.delete();
          if (!ok) warnings.push(`Box2D: uma peça convexa de ${f.part} ficou degenerada nesta escala`);
          else fixtures++;
        }
        if (!pb.static) {
          const md = new B.b2MassData();
          md.mass = pb.mass;
          md.center = new B.b2Vec2(0, 0);
          md.rotationalInertia = pb.inertia / (L * L);
          B.b2Body_SetMassData(body, md);
          md.delete();
        }
        return body;
      });
      dynamic = plan.bodies.filter((b) => !b.static).map((b) => b.index);
      angles = plan.bodies.map(() => 0);
      tracked = trackedBodies(plan);
      rt = new Runtime(plan, io);
      joints.clear();
      const local = (i: number, p: Vec2) => {
        const b = plan.bodies[i]!;
        return new B.b2Vec2((p[0] - b.position[0]) / L, (p[1] - b.position[1]) / L);
      };
      for (const a of plan.axles) {
        const jd = B.b2DefaultRevoluteJointDef();
        jd.base.bodyIdA = bodies[a.a]!;
        jd.base.bodyIdB = bodies[a.b]!;
        jd.base.localFrameA.p = local(a.a, a.anchor);
        jd.base.localFrameB.p = local(a.b, a.anchor);
        jd.base.collideConnected = false;
        jd.enableLimit = !!a.limit;
        jd.lowerAngle = a.limit?.lower ?? 0;
        jd.upperAngle = a.limit?.upper ?? 0;
        jd.enableMotor = !!a.motor;
        jd.motorSpeed = a.motor?.speed ?? 0;
        jd.maxMotorTorque = (a.motor?.maxTorque ?? 0) / (L * L);
        joints.set(a.id, B.b2CreateRevoluteJoint(w, jd));
        jd.delete();
      }
      for (const s of plan.sliders) {
        const jd = B.b2DefaultPrismaticJointDef();
        jd.base.bodyIdA = bodies[s.a]!;
        jd.base.bodyIdB = bodies[s.b]!;
        jd.base.localFrameA.p = local(s.a, s.anchor);
        jd.base.localFrameB.p = local(s.b, s.anchor);
        const ang = Math.atan2(s.axis[1], s.axis[0]);
        jd.base.localFrameA.q = B.b2MakeRot(ang);
        jd.base.localFrameB.q = B.b2MakeRot(ang);
        jd.base.collideConnected = false;
        jd.enableLimit = true;
        jd.lowerTranslation = s.lower / L;
        jd.upperTranslation = s.upper / L;
        B.b2CreatePrismaticJoint(w, jd);
        jd.delete();
      }
      return {
        warnings,
        bodies: plan.bodies.length,
        fixtures,
        joints: plan.axles.length + plan.sliders.length,
      };
    },

    step(dt: number) {
      if (!worldId || !rt) return;
      rt.beforeStep(dt);
      B.b2World_Step(worldId, dt, SUB_STEPS);
      const ev = B.b2World_GetSensorEvents(worldId);
      for (let i = 0; i < ev.beginCount; i++) {
        const e = ev.GetBeginEvent(i);
        const s = shapeInfo(e.sensorShapeId);
        const o = shapeInfo(e.visitorShapeId);
        if (s?.sensor && o && !o.sensor) rt.sensorTouch(s.sensor, o.body, o.part);
      }
      ev.delete();
      rt.afterStep(dt);
      for (const i of tracked) angleOf(i);
    },

    snapshot(): Snapshot {
      return rt ? rt.snapshot() : { time: 0, steps: 0, parts: {}, links: {}, events: [] };
    },

    pose(partId: Id): PartPose | null {
      return rt ? rt.pose(partId) : null;
    },

    dragStart(partId: Id, pointMm: Vec2) {
      const r = rt?.plan.partRel.get(partId);
      return !!(rt && r && rt.dragStart(r.body, pointMm));
    },
    dragMove(p: Vec2) {
      rt?.dragMove(p);
    },
    dragEnd() {
      rt?.dragEnd();
    },

    contactsDepthMax() {
      let max = 0;
      for (const i of dynamic) {
        const id = bodies[i]!;
        const cap = B.b2Body_GetContactCapacity(id);
        if (!cap) continue;
        const list = B.b2Body_GetContactData(id, cap) as {
          manifold: { pointCount: number; GetPoint(k: number): { separation: number; delete(): void } };
          shapeIdA: b2ShapeId;
          shapeIdB: b2ShapeId;
          delete(): void;
        }[];
        for (const c of list) {
          const m = c.manifold;
          for (let k = 0; k < m.pointCount; k++) {
            const p = m.GetPoint(k);
            max = Math.max(max, -p.separation);
            p.delete();
          }
          c.delete();
        }
      }
      return max * L;
    },

    setMotorSpeed(linkId: Id, speed: number) {
      const j = joints.get(linkId);
      if (j) B.b2RevoluteJoint_SetTargetMotorSpeed(j, speed);
    },

    setVelocity(partId: Id, v: Vec2, omega: number) {
      const r = rt?.plan.partRel.get(partId);
      if (!r || rt!.plan.bodies[r.body]!.static) return;
      v1.x = v[0] / L;
      v1.y = v[1] / L;
      B.b2Body_SetLinearVelocity(bodies[r.body]!, v1);
      B.b2Body_SetAngularVelocity(bodies[r.body]!, omega);
    },

    dispose() {
      if (worldId) B.b2DestroyWorld(worldId);
      worldId = null;
      rt = null;
      bodies = [];
      joints.clear();
      shapeData.length = 0;
    },
  };
  return adapter;
}
