import type { Box2DModule, b2BodyId, b2JointId, b2Rot, b2ShapeId, b2Vec2, b2WorldId } from "box2d3-wasm";
import type { Piece } from "@/geometry/decompose";
import { PI, datan2, dcos, dhypot, dsin } from "@/geometry/dmath";
import { pieceSeparation, type WorldPiece } from "@/geometry/penetration";
import type { Vec2 } from "@/geometry/vec";
import type { Id, Scene } from "@/model/types";
import { ANGULAR_DAMPING, FIXED_STEP, SPEED_LIMIT, trackedBodies, unwrapAngle } from "../common";
import { buildPlan, type Plan } from "../plan";
import { HAND, Runtime, chase, handLimits, type BodyIO, type BodyState } from "../runtime";
import type { CompileOptions, CompileReport, EngineAdapter, EngineEvent, PartPose, Snapshot } from "../types";

export const BOX2D_WASM_VERSION = "6.0.0";

/** Passos do motor em cada passo de 1/240 s enquanto o tiro de uma cápsula anda. */
export const CAPSULE_SUBSTEPS = 8;
/** Abertura da solda da esfera (mm) acima da qual ela volta para a boca no fim do passo. */
export const CAPSULE_WELD_SNAP = 0.01;

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

/**
 * Mola rígida demais para a força explícita aplicada uma vez por passo
 * (Euler simplético, instável a partir de ω·h = 2): ω·h > 0,5 ou
 * amortecimento c·h/m > 0,25 vira mola nativa do Box2D (implícita).
 */
export function springNeedsNative(
  s: { k: number; damping: number; effMass: number },
  h = FIXED_STEP,
): boolean {
  if (!Number.isFinite(s.effMass) || s.k <= 0) return false;
  return Math.sqrt(s.k / s.effMass) * h > 0.5 || (s.damping * h) / s.effMass > 0.25;
}

interface ShapeData {
  bits: number;
  part: Id;
  body: number;
  sensor?: Id;
  /** pino: id da ligação dona da forma */
  pin?: Id;
}

/** Contact data of a body as exposed by box2d3-wasm 6.0.0 (b2Body_GetContactData). */
interface ContactItem {
  manifold: {
    pointCount: number;
    normal: { x: number; y: number; delete(): void };
    GetPoint(k: number): {
      separation: number;
      normalImpulse: number;
      tangentImpulse: number;
      delete(): void;
    };
  };
  shapeIdA: b2ShapeId;
  shapeIdB: b2ShapeId;
  delete(): void;
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
  /** mola nativa do gás de cada câmara: junta de distância entre as duas faces (ou fundo e face) */
  /** solda da esfera de cada cápsula (null: sem esfera ou já solta) */
  let capsuleWelds: (b2JointId | null)[] = [];
  /** centro da esfera no espaço do corpo do estojo (a solda) */
  let capsuleLocal: Vec2[] = [];
  const p0capsules = () => plan?.capsules ?? [];
  let gasJoints: ({ joint: b2JointId; a: number; b: number; la: Vec2; lb: Vec2; active: boolean } | null)[] =
    [];
  /**
   * a mão: corpo cinemático no alvo + junta de motor com mola limitada
   * (resolvida junto com os contatos). O alvo persegue o dedo com
   * velocidade limitada (600 mm/s: no máximo 2,5 mm por passo); contra as
   * peças fixas vale a colisão contínua do Box2D. A peça na mão não vira
   * "bala": a colisão contínua de bala não respeita as juntas e prendia o
   * elo de uma corrente no vizinho (junta abrindo 13,9 mm no teste de abuso).
   */
  let drag: {
    body: b2BodyId;
    joint: b2JointId;
    /** índice do corpo agarrado e o ponto agarrado no espaço dele */
    held: number;
    local: Vec2;
    target: Vec2;
    finger: Vec2;
  } | null = null;

  const endDrag = () => {
    if (!drag) return;
    B.b2DestroyJoint(drag.joint);
    B.b2DestroyBody(drag.body);
    drag = null;
  };

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

  /** Contato mais fundo do último passo (mm) e as duas peças. */
  const deepest = (): { depth: number; a: Id; b: Id } => {
    let max = 0;
    let a = "";
    let b = "";
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
          if (-q.separation > max) {
            max = -q.separation;
            a = shapeInfo(c.shapeIdA)?.part ?? "";
            b = shapeInfo(c.shapeIdB)?.part ?? "";
          }
          q.delete();
        }
        c.delete();
      }
    }
    return { depth: max * L, a, b };
  };

  /** Last step length, s (contact impulses are per solver substep). */
  let lastDt = FIXED_STEP;

  /** Touching contacts of a body (empty for a body without contacts). */
  const contactsOf = (index: number): ContactItem[] => {
    const id = bodies[index]!;
    const cap = B.b2Body_GetContactCapacity(id);
    return cap ? (B.b2Body_GetContactData(id, cap) as ContactItem[]) : [];
  };

  /**
   * Net contact force (N) on the shapes that satisfy `mine`, from the manifold impulses
   * (normal + tangent) of the last step divided by the solver substep. Contacts with
   * `other` false are ignored. A contact impulse acts on B along the normal; on A, against it.
   */
  const contactForce = (
    bodyIndexes: number[],
    mine: (s: ShapeData) => boolean,
    other: (s: ShapeData) => boolean,
  ): number => {
    let fx = 0;
    let fy = 0;
    for (const bi of new Set(bodyIndexes)) {
      for (const c of contactsOf(bi)) {
        const a = shapeInfo(c.shapeIdA);
        const b = shapeInfo(c.shapeIdB);
        const m = c.manifold;
        if (a && b && m.pointCount) {
          const aMine = mine(a) && other(b);
          const bMine = mine(b) && other(a);
          // the same contact is listed under both bodies: count it once, from the body of the shape we own
          if ((aMine || bMine) && !(aMine && bMine) && bi === (aMine ? a.body : b.body)) {
            const n = m.normal;
            let jn = 0;
            let jt = 0;
            for (let k = 0; k < m.pointCount; k++) {
              const q = m.GetPoint(k);
              jn += q.normalImpulse;
              jt += q.tangentImpulse;
              q.delete();
            }
            // tangent = right perpendicular of the normal (Box2D v3 convention)
            const sign = bMine ? 1 : -1;
            fx += sign * (n.x * jn + n.y * jt);
            fy += sign * (n.y * jn - n.x * jt);
            n.delete();
          }
        }
        c.delete();
      }
    }
    // impulse (g·mm/s in engine units) per substep → force in N
    return (Math.hypot(fx, fy) * L) / (lastDt / tuning.subSteps) / 1e6;
  };

  /** Smallest manifold separation (mm) between touching shapes of the two parts; null without contact. */
  const contactSeparation = (bodyIndexes: number[], a: Id, b: Id): number | null => {
    let min: number | null = null;
    for (const bi of new Set(bodyIndexes)) {
      for (const c of contactsOf(bi)) {
        const sa = shapeInfo(c.shapeIdA);
        const sb = shapeInfo(c.shapeIdB);
        if (sa && sb && ((sa.part === a && sb.part === b) || (sa.part === b && sb.part === a)))
          for (let k = 0; k < c.manifold.pointCount; k++) {
            const q = c.manifold.GetPoint(k);
            if (min === null || q.separation * L < min) min = q.separation * L;
            q.delete();
          }
        c.delete();
      }
    }
    return min;
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
          sd.density = (f.density ?? 0) * L * L;
          sd.updateBodyMass = false;
          sd.material.friction = f.friction;
          sd.material.restitution = f.restitution;
          sd.filter.categoryBits = f.bits;
          sd.filter.maskBits = f.bits;
          sd.isSensor = f.sensor;
          sd.enableSensorEvents = true;
          sd.enableHitEvents = !f.sensor;
          const data: ShapeData = { bits: f.bits, part: f.part, body: pb.index };
          if (f.sensor && f.link) data.sensor = f.link;
          else if (f.link) data.pin = f.link;
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
      for (const sl of p.slots) {
        // Rasgo reto: junta de roda sem mola (ponto sobre reta, rotação livre), batentes nas pontas.
        const jd = B.b2DefaultWheelJointDef();
        jd.base.bodyIdA = bodies[sl.a]!;
        jd.base.bodyIdB = bodies[sl.b]!;
        jd.base.localFrameA.p = local(sl.a, sl.anchor);
        jd.base.localFrameB.p = local(sl.b, sl.anchor);
        const q = datan2(sl.axis[1], sl.axis[0]);
        jd.base.localFrameA.q = rot(q);
        jd.base.localFrameB.q = rot(q);
        jd.base.collideConnected = false;
        base(jd);
        jd.enableSpring = false;
        jd.enableLimit = true;
        jd.lowerTranslation = sl.lower / L;
        jd.upperTranslation = sl.upper / L;
        joints.set(sl.id, B.b2CreateWheelJoint(w, jd));
        jd.delete();
      }
      for (const sp of p.springs) {
        // Toda mola ganha uma junta de distância: batente das espiras encostadas
        // (mínimo = comprimento sólido) e, se for rígida demais para o passo
        // explícito, a mola nativa (rigidez e massa efetiva viram frequência).
        const jd = B.b2DefaultDistanceJointDef();
        jd.base.bodyIdA = bodies[sp.a]!;
        jd.base.bodyIdB = bodies[sp.b]!;
        jd.base.localFrameA.p = new B.b2Vec2(sp.localA[0] / L, sp.localA[1] / L);
        jd.base.localFrameB.p = new B.b2Vec2(sp.localB[0] / L, sp.localB[1] / L);
        jd.base.collideConnected = true;
        base(jd);
        jd.length = sp.freeLength / L;
        jd.enableSpring = true;
        jd.enableLimit = true;
        jd.minLength = sp.solidLength / L;
        jd.maxLength = 1e6 / L;
        if (!sp.guide && springNeedsNative(sp)) {
          const omega = Math.sqrt(sp.k / sp.effMass);
          jd.hertz = omega / (2 * PI);
          jd.dampingRatio = sp.damping / (2 * sp.effMass * omega);
          // o Box2D chama de positivo o impulso que afasta as pontas (compressão)
          if (sp.mode === "seated") jd.lowerSpringForce = 0;
          if (sp.mode === "tension") jd.upperSpringForce = 0;
          native.add(sp.id);
        } else {
          jd.hertz = 0;
          if (sp.guide && springNeedsNative(sp))
            warnings.push("Box2D: mola com guia rígida demais para o passo explícito; pode vibrar");
        }
        joints.set(sp.id, B.b2CreateDistanceJoint(w, jd));
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
      for (const l of p.locks) {
        const jd = B.b2DefaultWeldJointDef();
        jd.base.bodyIdA = bodies[l.a]!;
        jd.base.bodyIdB = bodies[l.b]!;
        jd.base.localFrameA.p = local(l.a, l.anchor);
        jd.base.localFrameB.p = local(l.b, l.anchor);
        jd.base.collideConnected = false;
        base(jd);
        jd.linearHertz = 0;
        jd.angularHertz = 0;
        joints.set(l.id, B.b2CreateWeldJoint(w, jd));
        jd.delete();
      }
      // a esfera da cápsula presa na boca: solda rígida até o golpe na espoleta
      capsuleLocal = p.capsules.map((c) => {
        const b = p.bodies[c.body]!;
        return [c.anchor[0] - b.position[0], c.anchor[1] - b.position[1]] as Vec2;
      });
      capsuleWelds = p.capsules.map((c) => {
        if (c.ball < 0) return null;
        const jd = B.b2DefaultWeldJointDef();
        jd.base.bodyIdA = bodies[c.body]!;
        jd.base.bodyIdB = bodies[c.ball]!;
        jd.base.localFrameA.p = local(c.body, c.anchor);
        jd.base.localFrameB.p = local(c.ball, c.anchor);
        jd.base.collideConnected = false;
        base(jd);
        jd.linearHertz = 0;
        jd.angularHertz = 0;
        const joint = B.b2CreateWeldJoint(w, jd);
        jd.delete();
        // a colisão contínua de bala não respeita juntas: presa, a esfera não é bala
        if (p.bodies[c.ball]!.bullet) B.b2Body_SetBullet(bodies[c.ball]!, false);
        return joint;
      });
      gasJoints = p.chambers.map((ch) => {
        const front = ch.walls.find((wl) => wl.side > 0);
        const rear = ch.walls.find((wl) => wl.side < 0);
        if (!front) return null;
        const a = rear ? rear.body : ch.body;
        const la = rear ? rear.face : ch.base;
        if (a === front.body) return null;
        const jd = B.b2DefaultDistanceJointDef();
        jd.base.bodyIdA = bodies[a]!;
        jd.base.bodyIdB = bodies[front.body]!;
        jd.base.localFrameA.p = new B.b2Vec2(la[0] / L, la[1] / L);
        jd.base.localFrameB.p = new B.b2Vec2(front.face[0] / L, front.face[1] / L);
        jd.base.collideConnected = true;
        base(jd);
        jd.length = Math.max(front.s0 - (rear ? rear.s0 : 0), 0.05) / L;
        jd.enableSpring = true;
        jd.hertz = 0;
        jd.enableLimit = false;
        // Cápsula: o tiro inteiro cabe em menos de um passo, e a mola linear
        // passaria do ponto de força zero e puxaria a esfera de volta. O gás só
        // empurra (como a mola apoiada); as câmaras de carga ficam como eram.
        if (ch.capsule) jd.lowerSpringForce = 0;
        const joint = B.b2CreateDistanceJoint(w, jd);
        jd.delete();
        return { joint, a, b: front.body, la, lb: front.face, active: false };
      });
      const axleIds = new Set(p.axles.map((a) => a.id));
      const jointTorque = (id: Id): number | null => {
        const j = joints.get(id);
        return j && axleIds.has(id) ? B.b2RevoluteJoint_GetCurrentMotorTorque(j) * L * L : null;
      };
      const gasSpring = (ci: number, k: number, F: number, g: { base: Vec2; axis: Vec2 }): boolean => {
        const gj = gasJoints[ci];
        if (!gj || !rt) return false;
        // Força do gás linearizada no passo: F(L) ≈ F − k·(L' − L), uma mola nativa
        // de rigidez k e comprimento livre L + F/k, implícita no solver.
        const pa = rt.world(gj.a, gj.la);
        const pb = rt.world(gj.b, gj.lb);
        const len = (pb[0] - pa[0]) * g.axis[0] + (pb[1] - pa[1]) * g.axis[1];
        const K = rt.invMassAlong(gj.a, pa, gj.b, pb, g.axis);
        // Gás macio para o passo (ω·h < 0,5, por exemplo com a câmara aberta): força explícita.
        if (!(k > 0 && K > 0) || Math.sqrt(k * K) * FIXED_STEP < 0.5) {
          if (gj.active) {
            // sem mola, o impulso acumulado ainda entraria no "warm start": SetRestLength zera
            B.b2DistanceJoint_SetSpringHertz(gj.joint, 0);
            B.b2DistanceJoint_SetRestLength(gj.joint, Math.max(len, 0.05) / L);
          }
          gj.active = false;
          return false;
        }
        gj.active = true;
        B.b2DistanceJoint_SetSpringHertz(gj.joint, Math.sqrt(k * K) / (2 * PI));
        B.b2DistanceJoint_SetSpringDampingRatio(gj.joint, 0);
        B.b2DistanceJoint_SetRestLength(gj.joint, (len + F / k) / L);
        return true;
      };
      rt = new Runtime(p, io, {
        native,
        jointForce,
        jointTorque,
        gasSpring,
        releaseProjectile(i) {
          const joint = capsuleWelds[i];
          if (!joint) return;
          B.b2DestroyJoint(joint);
          capsuleWelds[i] = null;
          const ball = p.capsules[i]!.ball;
          if (p.bodies[ball]!.bullet) B.b2Body_SetBullet(bodies[ball]!, true);
        },
        destroyLock(id) {
          const joint = joints.get(id);
          if (joint) {
            B.b2DestroyJoint(joint);
            joints.delete(id);
          }
        },
      });
      return {
        warnings,
        bodies: p.bodies.length,
        fixtures,
        joints: joints.size,
      };
    },

    step(dt: number) {
      if (!worldId || !rt) return;
      lastDt = dt;
      if (drag) {
        // o alvo anda até o dedo com velocidade limitada (tempo simulado)
        drag.target = chase(drag.target, drag.finger, HAND.speed * dt);
        const t = new B.b2Transform();
        t.p = new B.b2Vec2(drag.target[0] / L, drag.target[1] / L);
        t.q = rot(0);
        B.b2Body_SetTargetTransform(drag.body, t, dt, true);
        t.delete();
      }
      // O tiro de uma cápsula dura menos que um passo: enquanto ele anda, o
      // passo vira CAPSULE_SUBSTEPS passos do motor e o gás é refeito em cada
      // um. Cenas sem cápsula dão sempre um passo só (os hashes não mudam).
      const n = rt.shooting() ? CAPSULE_SUBSTEPS : 1;
      const t0 = rt.time;
      const h = n > 1 ? dt / n : dt;
      lastDt = h;
      const all: EngineEvent[] = [];
      for (let k = 0; k < n; k++) {
        rt.beforeStep(h, k);
        B.b2World_Step(worldId, h, tuning.subSteps);
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
              time: n > 1 ? t0 + (k + 1) * h : rt.time + dt,
            });
          e.delete();
        }
        ce.delete();
        if (n > 1) rt.afterStep(h, { last: k === n - 1, t0, total: dt });
        else rt.afterStep(dt);
        rt.checkFuses();
        // o golpe na espoleta acende a carga e já pode dividir o resto do passo
        rt.strikes(impacts);
        for (const e of impacts) all.push(e);
        gasJoints.forEach((gj, ci) => {
          if (!gj || !rt || !gj.active) return;
          const f = B.b2Joint_GetConstraintForce(gj.joint);
          const pa = rt.world(gj.a, gj.la);
          const pb = rt.world(gj.b, gj.lb);
          const dx = pb[0] - pa[0];
          const dy = pb[1] - pa[1];
          const l = Math.sqrt(dx * dx + dy * dy);
          rt.recordGasForce(ci, l > 0 ? ((f.x * dx + f.y * dy) * L) / l : 0, h);
          f.delete();
        });
      }
      rt.pushEvents(all);
      // A colisão contínua do Box2D contra peças fixas recua o estojo para o
      // instante do toque sem levar a esfera junto (ela não respeita juntas).
      // Presa, a esfera é parte rígida do estojo: volta para a boca, com a
      // velocidade do estojo naquele ponto. Só age quando a solda abriu.
      for (const [i, c] of p0capsules().entries()) {
        if (!capsuleWelds[i] || c.ball < 0) continue;
        const cs = rt.body(c.body);
        const lc = capsuleLocal[i]!;
        const cos = dcos(cs.angle);
        const sin = dsin(cs.angle);
        const wx = cs.x + lc[0] * cos - lc[1] * sin;
        const wy = cs.y + lc[0] * sin + lc[1] * cos;
        const bs = rt.body(c.ball);
        if (dhypot(bs.x - wx, bs.y - wy) <= CAPSULE_WELD_SNAP) continue;
        const t = new B.b2Transform();
        t.p = new B.b2Vec2(wx / L, wy / L);
        t.q = rot(cs.angle);
        B.b2Body_SetTransform(bodies[c.ball]!, t.p, t.q);
        t.delete();
        v1.x = (cs.vx - cs.w * (wy - cs.y)) / L;
        v1.y = (cs.vy + cs.w * (wx - cs.x)) / L;
        B.b2Body_SetLinearVelocity(bodies[c.ball]!, v1);
        B.b2Body_SetAngularVelocity(bodies[c.ball]!, cs.w);
        rt.invalidate(c.ball);
      }

      for (const i of tracked) angleOf(i);
    },

    snapshot(): Snapshot {
      return rt ? rt.snapshot() : { time: 0, steps: 0, parts: {}, links: {}, events: [] };
    },

    velocity(partId) {
      const r = plan?.partRel.get(partId);
      if (!r || !rt) return null;
      const state = rt.body(r.body);
      const p = rt.pose(partId)!;
      return {
        x: state.vx - state.w * (p.y - state.y),
        y: state.vy + state.w * (p.x - state.x),
        omega: state.w,
      };
    },
    reaction(id) {
      const joint = joints.get(id);
      if (joint) {
        const f = jointForce(id)!;
        return {
          force: Math.hypot(...f) / 1e6,
          torque: (B.b2Joint_GetConstraintTorque(joint) * L * L) / 1e6,
        };
      }
      if (!plan) return null;
      // Pin: net contact force on its circle. Contact-mode slot: the same, only against the guide part.
      const slot = plan.slotContacts.find((sc) => sc.id === id);
      const owner = slot ? slot.pin : id;
      if (!slot && plan.links.find((l) => l.id === id)?.kind !== "pin") return null;
      const own = shapeData.filter((d) => d.pin === owner);
      if (!own.length) return null;
      return {
        force: contactForce(
          own.map((d) => d.body),
          (d) => d.pin === owner,
          slot ? (d) => d.part === slot.guide : () => true,
        ),
        torque: 0,
      };
    },
    clearance(a, b) {
      if (!plan || !rt) return null;
      const fixtures = (id: Id) =>
        plan!.bodies.flatMap((body) =>
          body.fixtures.filter((f) => f.part === id && !f.sensor).map((f) => ({ f, body: body.index })),
        );
      const world = (item: { f: { piece: Piece }; body: number }): WorldPiece => {
        const shape = item.f.piece;
        return shape.kind === "circle"
          ? { kind: "circle", c: rt!.world(item.body, shape.c), r: shape.r }
          : { kind: "poly", points: shape.points.map((pt) => rt!.world(item.body, pt)) };
      };
      let distance = Infinity;
      let overlap = false;
      let geometric = Infinity;
      const bodiesOf: number[] = [];
      for (const fa of fixtures(a))
        for (const fb of fixtures(b)) {
          if (!(fa.f.bits & fb.f.bits)) continue;
          bodiesOf.push(fa.body, fb.body);
          const proxy = (item: typeof fa) => {
            const p = new B.b2ShapeProxy();
            const shape = item.f.piece;
            const points = shape.kind === "circle" ? [shape.c] : shape.points;
            p.count = points.length;
            p.radius = shape.kind === "circle" ? shape.r / L : 0;
            points.forEach((pt, i) => {
              const w = rt!.world(item.body, pt);
              const v = new B.b2Vec2(w[0] / L, w[1] / L);
              p.setPoint(i, v);
              v.delete();
            });
            return p;
          };
          const pa = proxy(fa),
            pb = proxy(fb);
          const input = new B.b2DistanceInput();
          const transform = new B.b2Transform();
          const zero = new B.b2Vec2(0, 0),
            rotation = rot(0);
          transform.p = zero;
          transform.q = rotation;
          input.transform = transform;
          input.proxyA = pa;
          input.proxyB = pb;
          input.useRadii = true;
          const out = B.b2ComputeShapeDistance(input, null);
          const d = out.distance * L;
          distance = Math.min(distance, d);
          // The shape distance is zero from the first touch on: the depth comes from the contacts or, for
          // pairs the engine never collides (both fixed, or before the first step), from the geometry.
          if (d <= 1e-9) {
            overlap = true;
            geometric = Math.min(geometric, pieceSeparation(world(fa), world(fb)));
          }
          out.delete();
          input.delete();
          pa.delete();
          pb.delete();
          transform.delete();
          zero.delete();
          rotation.delete();
        }
      if (!Number.isFinite(distance)) return null;
      if (!overlap) return distance;
      const touching = contactSeparation(bodiesOf, a, b);
      return Math.min(0, touching ?? geometric);
    },

    pose(partId: Id): PartPose | null {
      return rt ? rt.pose(partId) : null;
    },

    dragStart(partId: Id, pointMm: Vec2) {
      const r = rt?.plan.partRel.get(partId);
      if (!worldId || !rt || !r || rt.plan.bodies[r.body]!.static) return false;
      endDrag();
      const bd = B.b2DefaultBodyDef();
      bd.type = B.b2BodyType.b2_kinematicBody;
      bd.position = new B.b2Vec2(pointMm[0] / L, pointMm[1] / L);
      bd.enableSleep = false;
      const body = B.b2CreateBody(worldId, bd);
      bd.delete();
      const s = rt.body(r.body);
      const c = dcos(-s.angle);
      const n = dsin(-s.angle);
      const dx = pointMm[0] - s.x;
      const dy = pointMm[1] - s.y;
      const jd = B.b2DefaultMotorJointDef();
      jd.base.bodyIdA = body;
      jd.base.bodyIdB = bodies[r.body]!;
      jd.base.localFrameB.p = new B.b2Vec2((dx * c - dy * n) / L, (dx * n + dy * c) / L);
      jd.base.collideConnected = true;
      const d = handLimits(rt.plan, r.body, tuning.jointHertz);
      jd.linearHertz = d.hertz;
      jd.linearDampingRatio = 1;
      jd.maxSpringForce = d.maxForce / L;
      jd.angularHertz = 0;
      jd.maxSpringTorque = 0;
      jd.maxVelocityForce = 0;
      jd.maxVelocityTorque = 0;
      drag = {
        body,
        joint: B.b2CreateMotorJoint(worldId, jd),
        held: r.body,
        local: [dx * c - dy * n, dx * n + dy * c],
        target: [pointMm[0], pointMm[1]],
        finger: [pointMm[0], pointMm[1]],
      };
      jd.delete();
      return true;
    },
    dragMove(q: Vec2) {
      if (drag) drag.finger = [q[0], q[1]];
    },
    dragEnd() {
      if (drag && rt) {
        // ao soltar, o ponto agarrado fica com no máximo HAND.release mm/s
        const i = drag.held;
        const s = rt.body(i);
        const p = rt.world(i, drag.local);
        const rx = p[0] - s.x;
        const ry = p[1] - s.y;
        const vx = s.vx - s.w * ry;
        const vy = s.vy + s.w * rx;
        const v = Math.sqrt(vx * vx + vy * vy);
        if (v > HAND.release) {
          const k = HAND.release / v;
          v1.x = (s.vx * k) / L;
          v1.y = (s.vy * k) / L;
          B.b2Body_SetLinearVelocity(bodies[i]!, v1);
          B.b2Body_SetAngularVelocity(bodies[i]!, s.w * k);
        }
      }
      endDrag();
    },

    contactPairs() {
      const out: { a: Id; b: Id; bitsA: number; bitsB: number }[] = [];
      for (const i of dynamic) {
        const id = bodies[i]!,
          cap = B.b2Body_GetContactCapacity(id);
        if (!cap) continue;
        const list = B.b2Body_GetContactData(id, cap) as {
          manifold: { pointCount: number };
          shapeIdA: b2ShapeId;
          shapeIdB: b2ShapeId;
          delete(): void;
        }[];
        for (const c of list) {
          const a = shapeInfo(c.shapeIdA),
            b = shapeInfo(c.shapeIdB);
          if (c.manifold.pointCount && a && b)
            out.push({ a: a.part, b: b.part, bitsA: a.bits, bitsB: b.bits });
          c.delete();
        }
      }
      return out;
    },

    contactsDepthMax() {
      return deepest().depth;
    },

    contactsDeepest() {
      const d = deepest();
      return d.depth > 0 ? d : null;
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

    release(linkId: Id) {
      rt?.requestRelease(linkId);
    },

    ignite(linkId: Id) {
      return rt ? rt.ignite(linkId) : false;
    },

    setVent(linkId: Id, vent: number, open: boolean) {
      rt?.setVent(linkId, vent, open);
    },

    probe(region?: [number, number, number, number]) {
      if (!rt)
        return { kinetic: 0, potential: 0, maxSpeed: 0, outside: 0, railGap: 0, railOver: 0, nan: false };
      return rt.probe(region);
    },

    dispose() {
      drag = null;
      gasJoints = [];
      capsuleWelds = [];
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
