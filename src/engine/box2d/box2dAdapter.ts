import type { Box2DModule, b2BodyId, b2JointId, b2Rot, b2ShapeId, b2Vec2, b2WorldId } from "box2d3-wasm";
import { PI, datan2, dcos, dsin } from "@/geometry/dmath";
import type { Vec2 } from "@/geometry/vec";
import type { Id, Scene } from "@/model/types";
import { ANGULAR_DAMPING, SPEED_LIMIT, trackedBodies, unwrapAngle } from "../common";
import { buildPlan, type Plan } from "../plan";
import { Runtime, type BodyIO, type BodyState } from "../runtime";
import type { CompileOptions, CompileReport, EngineAdapter, EngineEvent, PartPose, Snapshot } from "../types";

export const BOX2D_WASM_VERSION = "6.0.0";

/**
 * Parâmetros do mundo e do solver do Box2D v3 (docs/decisoes/motor.md,
 * "Calibração para gravidade real"). Velocidades em mm/s: o adaptador
 * converte para a escala interna.
 */
export interface Box2dTuning {
  /** subpassos do solver suave em cada passo de 1/240 s */
  subSteps: number;
  /** rigidez do contato, Hz (o Box2D limita a ¼ da frequência do subpasso) */
  contactHertz: number;
  contactDampingRatio: number;
  /** empurrão máximo de contato (velocidade de separação de peças sobrepostas), mm/s */
  contactSpeed: number;
  /** rigidez das juntas, Hz (o Box2D limita a ¼ da frequência do subpasso) */
  jointHertz: number;
  jointDampingRatio: number;
  /** abaixo desta velocidade de aproximação não há quique, mm/s */
  restitutionThreshold: number;
  /** limiar do evento de impacto, mm/s */
  hitEventThreshold: number;
  /** b2SetLengthUnitsPerMeter: escala a folga linear (0,005 × isto), a distância especulativa e a margem das caixas */
  lengthUnits: number;
}

/** Os padrões do Box2D, que valem em metros (aqui, lidos como unidades de 1 mm). */
export const BOX2D_DEFAULTS: Box2dTuning = {
  subSteps: 4,
  contactHertz: 30,
  contactDampingRatio: 10,
  contactSpeed: 3,
  jointHertz: 60,
  jointDampingRatio: 2,
  restitutionThreshold: 1,
  hitEventThreshold: 1,
  lengthUnits: 1,
};

/**
 * Calibração do app para gravidade real em escala de milímetro (medida em
 * scripts/bench/calibrate.ts): os parâmetros em metros convertidos para mm/s,
 * contato e juntas tão rígidos quanto o Box2D permite com 16 subpassos.
 */
export const CALIBRATED_TUNING: Box2dTuning = {
  subSteps: 16,
  contactHertz: 480,
  contactDampingRatio: 3,
  contactSpeed: 3000,
  jointHertz: 960,
  jointDampingRatio: 0,
  restitutionThreshold: 1000,
  hitEventThreshold: 100,
  lengthUnits: 5,
};

interface ShapeData {
  part: Id;
  body: number;
  sensor?: Id;
}

/**
 * Adaptador do Box2D v3.2 compilado para WASM (box2d3-wasm, build "compat":
 * sem threads nem SIMD, roda em qualquer navegador e no Node).
 *
 * Determinismo: o motor é WASM; aqui só entram operações exatas do IEEE e as
 * funções de src/geometry/dmath.ts (ângulo lido por datan2, rotações das
 * juntas por dcos/dsin), nunca `Math.sin/cos/atan2`.
 */
export function createBox2dAdapter(B: Box2DModule, tuning: Box2dTuning = CALIBRATED_TUNING): EngineAdapter {
  let worldId: b2WorldId | null = null;
  let rt: Runtime | null = null;
  let plan: Plan | null = null;
  let L = 1;
  let bodies: b2BodyId[] = [];
  let dynamic: number[] = [];
  let angles: number[] = [];
  let tracked: number[] = [];
  const shapeData: ShapeData[] = [];
  const joints = new Map<Id, b2JointId>();
  const v1: b2Vec2 = new B.b2Vec2(0, 0);
  const v2: b2Vec2 = new B.b2Vec2(0, 0);
  let impacts: EngineEvent[] = [];

  const angleOf = (i: number): number => {
    const r = B.b2Body_GetRotation(bodies[i]!);
    const a = unwrapAngle(angles[i]!, datan2(r.s, r.c));
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

  /** Força de reação de uma junta, g·mm/s² no mundo. */
  const jointForce = (id: Id): Vec2 | null => {
    const j = joints.get(id);
    if (!j) return null;
    const f = B.b2Joint_GetConstraintForce(j);
    const out: Vec2 = [f.x * L, f.y * L];
    f.delete();
    return out;
  };

  const shapeInfo = (id: b2ShapeId): ShapeData | undefined => shapeData[B.b2Shape_GetUserData(id) - 1];

  const rot = (angle: number): b2Rot => {
    const q = new B.b2Rot();
    q.c = dcos(angle);
    q.s = dsin(angle);
    return q;
  };

  const adapter: EngineAdapter = {
    meta: {
      id: "box2d",
      name: "Box2D v3 (WASM)",
      version: BOX2D_WASM_VERSION,
      iterations: `${tuning.subSteps} subpassos do solver suave por passo; contato ${tuning.contactHertz} Hz, juntas ${tuning.jointHertz} Hz; contínuo contra estáticos`,
    },

    compile(scene: Scene, options: CompileOptions): CompileReport {
      adapter.dispose();
      L = options.unitMm;
      const p = buildPlan(scene);
      plan = p;
      const warnings = [...p.warnings];
      B.b2SetLengthUnitsPerMeter(tuning.lengthUnits);
      const wd = B.b2DefaultWorldDef();
      wd.gravity = new B.b2Vec2(p.gravity[0] / L, p.gravity[1] / L);
      wd.enableSleep = false;
      wd.maximumLinearSpeed = SPEED_LIMIT / L;
      wd.contactHertz = tuning.contactHertz;
      wd.contactDampingRatio = tuning.contactDampingRatio;
      wd.contactSpeed = tuning.contactSpeed / L;
      wd.restitutionThreshold = tuning.restitutionThreshold / L;
      wd.hitEventThreshold = tuning.hitEventThreshold / L;
      const w = B.b2CreateWorld(wd);
      wd.delete();
      worldId = w;
      let fixtures = 0;
      shapeData.length = 0;
      bodies = p.bodies.map((pb) => {
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
          sd.enableHitEvents = !f.sensor;
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
            for (const q of pts) q.delete();
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
      dynamic = p.bodies.filter((b) => !b.static).map((b) => b.index);
      angles = p.bodies.map(() => 0);
      tracked = trackedBodies(p);
      joints.clear();
      const native = new Set<Id>();
      const local = (i: number, q: Vec2) => {
        const b = p.bodies[i]!;
        return new B.b2Vec2((q[0] - b.position[0]) / L, (q[1] - b.position[1]) / L);
      };
      const invMass = (i: number) => (p.bodies[i]!.static ? 0 : 1 / p.bodies[i]!.mass);
      const invInertia = (i: number) => (p.bodies[i]!.static ? 0 : 1 / p.bodies[i]!.inertia);
      const base = (jd: { base: { constraintHertz: number; constraintDampingRatio: number } }) => {
        jd.base.constraintHertz = tuning.jointHertz;
        jd.base.constraintDampingRatio = tuning.jointDampingRatio;
      };
      for (const a of p.axles) {
        const jd = B.b2DefaultRevoluteJointDef();
        jd.base.bodyIdA = bodies[a.a]!;
        jd.base.bodyIdB = bodies[a.b]!;
        jd.base.localFrameA.p = local(a.a, a.anchor);
        jd.base.localFrameB.p = local(a.b, a.anchor);
        jd.base.collideConnected = false;
        base(jd);
        jd.enableLimit = !!a.limit;
        jd.lowerAngle = a.limit?.lower ?? 0;
        jd.upperAngle = a.limit?.upper ?? 0;
        // Atrito: motor de velocidade zero com torque máximo = atrito (só sem motor).
        jd.enableMotor = !!a.motor || a.friction > 0;
        jd.motorSpeed = a.motor?.speed ?? 0;
        jd.maxMotorTorque = (a.motor?.maxTorque ?? a.friction) / (L * L);
        if (a.torsion && a.torsion.k > 0) {
          // Mola de torção nativa: o Box2D usa a massa axial 1/(iA + iB).
          const ka = invInertia(a.a) + invInertia(a.b);
          if (ka > 0) {
            const omega = Math.sqrt(a.torsion.k * ka);
            jd.enableSpring = true;
            jd.hertz = omega / (2 * PI);
            jd.dampingRatio = (a.torsion.damping * ka) / (2 * omega);
            jd.targetAngle = a.torsion.rest;
            native.add(a.id);
          }
        }
        joints.set(a.id, B.b2CreateRevoluteJoint(w, jd));
        jd.delete();
      }
      for (const s of p.sliders) {
        const jd = B.b2DefaultPrismaticJointDef();
        jd.base.bodyIdA = bodies[s.a]!;
        jd.base.bodyIdB = bodies[s.b]!;
        jd.base.localFrameA.p = local(s.a, s.anchor);
        jd.base.localFrameB.p = local(s.b, s.anchor);
        const ang = datan2(s.axis[1], s.axis[0]);
        jd.base.localFrameA.q = rot(ang);
        jd.base.localFrameB.q = rot(ang);
        jd.base.collideConnected = false;
        base(jd);
        jd.enableLimit = true;
        jd.lowerTranslation = s.lower / L;
        jd.upperTranslation = s.upper / L;
        if (s.friction > 0) {
          jd.enableMotor = true;
          jd.motorSpeed = 0;
          jd.maxMotorForce = s.friction / L;
        }
        if (s.spring && s.spring.k > 0) {
          // Mola de retorno nativa: massa axial da junta prismática na pose desenhada.
          const ra: Vec2 = [
            s.anchor[0] - p.bodies[s.a]!.position[0],
            s.anchor[1] - p.bodies[s.a]!.position[1],
          ];
          const rb: Vec2 = [
            s.anchor[0] - p.bodies[s.b]!.position[0],
            s.anchor[1] - p.bodies[s.b]!.position[1],
          ];
          const a1 = ra[0] * s.axis[1] - ra[1] * s.axis[0];
          const a2 = rb[0] * s.axis[1] - rb[1] * s.axis[0];
          const k = invMass(s.a) + invMass(s.b) + invInertia(s.a) * a1 * a1 + invInertia(s.b) * a2 * a2;
          if (k > 0) {
            const omega = Math.sqrt(s.spring.k * k);
            jd.enableSpring = true;
            jd.hertz = omega / (2 * PI);
            jd.dampingRatio = (s.spring.damping * k) / (2 * omega);
            jd.targetTranslation = s.spring.rest / L;
            native.add(s.id);
          }
        }
        joints.set(s.id, B.b2CreatePrismaticJoint(w, jd));
        jd.delete();
      }
      for (const d of p.distances) {
        // Haste: distância rígida. Cabo: só o máximo (mola ligada sem rigidez = só batentes).
        const jd = B.b2DefaultDistanceJointDef();
        jd.base.bodyIdA = bodies[d.a]!;
        jd.base.bodyIdB = bodies[d.b]!;
        jd.base.localFrameA.p = local(d.a, d.anchorA);
        jd.base.localFrameB.p = local(d.b, d.anchorB);
        jd.base.collideConnected = true;
        base(jd);
        jd.length = d.length / L;
        if (d.kind === "cable") {
          jd.enableSpring = true;
          jd.hertz = 0;
          jd.enableLimit = true;
          jd.minLength = 0;
          jd.maxLength = d.length / L;
        } else {
          jd.enableSpring = false;
          jd.minLength = d.length / L;
          jd.maxLength = d.length / L;
        }
        joints.set(d.id, B.b2CreateDistanceJoint(w, jd));
        jd.delete();
      }
      for (const m of p.mounts) {
        const jd = B.b2DefaultWeldJointDef();
        jd.base.bodyIdA = bodies[m.a]!;
        jd.base.bodyIdB = bodies[m.b]!;
        jd.base.localFrameA.p = local(m.a, m.anchor);
        jd.base.localFrameB.p = local(m.b, m.anchor);
        jd.base.collideConnected = false;
        base(jd);
        jd.linearHertz = m.linearHz;
        jd.angularHertz = m.angularHz;
        jd.linearDampingRatio = m.damping;
        jd.angularDampingRatio = m.damping;
        joints.set(m.id, B.b2CreateWeldJoint(w, jd));
        jd.delete();
      }
      const axleIds = new Set(p.axles.map((a) => a.id));
      const jointTorque = (id: Id): number | null => {
        const j = joints.get(id);
        return j && axleIds.has(id) ? B.b2RevoluteJoint_GetCurrentMotorTorque(j) * L * L : null;
      };
      rt = new Runtime(p, io, { native, jointForce, jointTorque });
      return {
        warnings,
        bodies: p.bodies.length,
        fixtures,
        joints: joints.size,
      };
    },

    step(dt: number) {
      if (!worldId || !rt) return;
      rt.beforeStep(dt);
      B.b2World_Step(worldId, dt, tuning.subSteps);
      const ev = B.b2World_GetSensorEvents(worldId);
      for (let i = 0; i < ev.beginCount; i++) {
        const e = ev.GetBeginEvent(i);
        const s = shapeInfo(e.sensorShapeId);
        const o = shapeInfo(e.visitorShapeId);
        if (s?.sensor && o && !o.sensor) rt.sensorTouch(s.sensor, o.body, o.part);
      }
      ev.delete();
      impacts = [];
      const ce = B.b2World_GetContactEvents(worldId);
      for (let i = 0; i < ce.hitCount; i++) {
        const e = ce.GetHitEvent(i);
        const a = shapeInfo(e.shapeIdA);
        const b = shapeInfo(e.shapeIdB);
        if (a && b)
          impacts.push({
            kind: "impact",
            a: a.part,
            b: b.part,
            speed: e.approachSpeed * L,
            point: [e.point.x * L, e.point.y * L],
            time: rt.time + dt,
          });
        e.delete();
      }
      ce.delete();
      rt.afterStep(dt);
      rt.pushEvents(impacts);
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
    dragMove(q: Vec2) {
      rt?.dragMove(q);
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
            const q = m.GetPoint(k);
            max = Math.max(max, -q.separation);
            q.delete();
          }
          c.delete();
        }
      }
      return max * L;
    },

    setMotorSpeed(linkId: Id, speed: number) {
      const j = joints.get(linkId);
      if (j && plan?.axles.some((a) => a.id === linkId)) B.b2RevoluteJoint_SetTargetMotorSpeed(j, speed);
    },

    setVelocity(partId: Id, v: Vec2, omega: number) {
      const r = rt?.plan.partRel.get(partId);
      if (!r || rt!.plan.bodies[r.body]!.static) return;
      v1.x = v[0] / L;
      v1.y = v[1] / L;
      B.b2Body_SetLinearVelocity(bodies[r.body]!, v1);
      B.b2Body_SetAngularVelocity(bodies[r.body]!, omega);
    },

    setForce(partId: Id, force: Vec2 | null, at?: Vec2) {
      rt?.setForce(partId, force, at);
    },

    ignite(linkId: Id) {
      return rt ? rt.ignite(linkId) : false;
    },

    setVent(linkId: Id, vent: number, open: boolean) {
      rt?.setVent(linkId, vent, open);
    },

    dispose() {
      if (worldId) B.b2DestroyWorld(worldId);
      worldId = null;
      rt = null;
      plan = null;
      bodies = [];
      joints.clear();
      shapeData.length = 0;
    },
  };
  return adapter;
}
