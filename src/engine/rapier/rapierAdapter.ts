import type RAPIER_NS from "@dimforge/rapier2d-compat";
import type { Vec2 } from "@/geometry/vec";
import type { Id, Scene } from "@/model/types";
import { ANGULAR_DAMPING, trackedBodies, unwrapAngle } from "../common";
import { buildPlan } from "../plan";
import { Runtime, type BodyIO, type BodyState } from "../runtime";
import type { CompileOptions, CompileReport, EngineAdapter, PartPose, Snapshot } from "../types";

export const RAPIER_VERSION = "0.21.0";

type R = typeof RAPIER_NS;
type RigidBody = RAPIER_NS.RigidBody;
type World = RAPIER_NS.World;

interface ColliderData {
  part: Id;
  body: number;
  sensor?: Id;
}

/**
 * Velocidade do motor do eixo: o Rapier modela o motor como mola-amortecedor;
 * com rigidez 0 e amortecimento alto ele persegue a velocidade-alvo, limitado
 * pelo torque máximo, como o motor do Box2D.
 */
const MOTOR_DAMPING = 1e4;

/** Adaptador do Rapier 2D (padrão ou determinístico, mesma API). */
export function createRapierAdapter(RAPIER: R, variant: { id: string; name: string }): EngineAdapter {
  let world: World | null = null;
  let events: RAPIER_NS.EventQueue | null = null;
  let rt: Runtime | null = null;
  let L = 1;
  let bodies: RigidBody[] = [];
  let angles: number[] = [];
  let tracked: number[] = [];
  const forced = new Set<number>();
  const colliderData = new Map<number, ColliderData>();
  const joints = new Map<Id, RAPIER_NS.RevoluteImpulseJoint>();

  const angleOf = (i: number): number => {
    const a = unwrapAngle(angles[i]!, bodies[i]!.rotation());
    angles[i] = a;
    return a;
  };

  const io: BodyIO = {
    read(i, out: BodyState) {
      const b = bodies[i]!;
      const p = b.translation();
      const v = b.linvel();
      out.x = p.x * L;
      out.y = p.y * L;
      out.angle = angleOf(i);
      out.vx = v.x * L;
      out.vy = v.y * L;
      out.w = b.angvel();
    },
    applyForce(i, fx, fy, px, py) {
      forced.add(i);
      bodies[i]!.addForceAtPoint({ x: fx / L, y: fy / L }, { x: px / L, y: py / L }, true);
    },
    applyTorque(i, t) {
      forced.add(i);
      bodies[i]!.addTorque(t / (L * L), true);
    },
    applyImpulse(i, jx, jy, px, py) {
      bodies[i]!.applyImpulseAtPoint({ x: jx / L, y: jy / L }, { x: px / L, y: py / L }, true);
    },
  };

  const adapter: EngineAdapter = {
    meta: {
      id: variant.id,
      name: variant.name,
      version: RAPIER_VERSION,
      iterations: "",
    },

    compile(scene: Scene, options: CompileOptions): CompileReport {
      adapter.dispose();
      L = options.unitMm;
      const plan = buildPlan(scene);
      const warnings = [...plan.warnings];
      const w = new RAPIER.World({ x: plan.gravity[0] / L, y: plan.gravity[1] / L });
      world = w;
      events = new RAPIER.EventQueue(true);
      const ip = w.integrationParameters;
      adapter.meta.iterations = `${ip.numSolverIterations} iterações de solver + ${ip.numInternalPgsIterations} PGS internas, CCD com até ${ip.maxCcdSubsteps} subpassos`;
      let fixtures = 0;
      colliderData.clear();
      bodies = plan.bodies.map((pb) => {
        const desc = (pb.static ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic())
          .setTranslation(pb.position[0] / L, pb.position[1] / L)
          .setCanSleep(false)
          .setAngularDamping(ANGULAR_DAMPING)
          .setCcdEnabled(pb.bullet);
        const body = w.createRigidBody(desc);
        for (const f of pb.fixtures) {
          let cd: RAPIER_NS.ColliderDesc | null;
          if (f.piece.kind === "circle")
            cd = RAPIER.ColliderDesc.ball(f.piece.r / L).setTranslation(f.piece.c[0] / L, f.piece.c[1] / L);
          else {
            const arr = new Float32Array(f.piece.points.length * 2);
            f.piece.points.forEach(([x, y], k) => {
              arr[2 * k] = x / L;
              arr[2 * k + 1] = y / L;
            });
            cd = RAPIER.ColliderDesc.convexHull(arr);
          }
          if (!cd) {
            warnings.push(`Rapier: uma peça convexa de ${f.part} ficou degenerada nesta escala`);
            continue;
          }
          cd.setDensity(0)
            .setFriction(f.friction)
            .setRestitution(f.restitution)
            .setCollisionGroups(((f.bits & 0xffff) << 16) | (f.bits & 0xffff))
            .setSensor(f.sensor);
          if (f.sensor) cd.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
          const c = w.createCollider(cd, body);
          const data: ColliderData = { part: f.part, body: pb.index };
          if (f.sensor && f.link) data.sensor = f.link;
          colliderData.set(c.handle, data);
          fixtures++;
        }
        if (!pb.static) body.setAdditionalMassProperties(pb.mass, { x: 0, y: 0 }, pb.inertia / (L * L), true);
        return body;
      });
      angles = plan.bodies.map(() => 0);
      tracked = trackedBodies(plan);
      rt = new Runtime(plan, io);
      joints.clear();
      const local = (i: number, p: Vec2) => {
        const b = plan.bodies[i]!;
        return { x: (p[0] - b.position[0]) / L, y: (p[1] - b.position[1]) / L };
      };
      for (const a of plan.axles) {
        const data = RAPIER.JointData.revolute(local(a.a, a.anchor), local(a.b, a.anchor));
        const j = w.createImpulseJoint(
          data,
          bodies[a.a]!,
          bodies[a.b]!,
          true,
        ) as RAPIER_NS.RevoluteImpulseJoint;
        j.setContactsEnabled(false);
        if (a.limit) j.setLimits(a.limit.lower, a.limit.upper);
        if (a.motor) {
          j.configureMotorVelocity(a.motor.speed, MOTOR_DAMPING);
          j.setMotorMaxForce(a.motor.maxTorque / (L * L));
        }
        joints.set(a.id, j);
      }
      for (const s of plan.sliders) {
        const data = RAPIER.JointData.prismatic(local(s.a, s.anchor), local(s.b, s.anchor), {
          x: s.axis[0],
          y: s.axis[1],
        });
        data.limitsEnabled = true;
        data.limits = [s.lower / L, s.upper / L];
        const j = w.createImpulseJoint(data, bodies[s.a]!, bodies[s.b]!, true);
        j.setContactsEnabled(false);
      }
      return {
        warnings,
        bodies: plan.bodies.length,
        fixtures,
        joints: plan.axles.length + plan.sliders.length,
      };
    },

    step(dt: number) {
      if (!world || !rt || !events) return;
      const runtime = rt;
      for (const i of forced) {
        bodies[i]!.resetForces(false);
        bodies[i]!.resetTorques(false);
      }
      forced.clear();
      runtime.beforeStep(dt);
      world.timestep = dt;
      world.step(events);
      events.drainCollisionEvents((h1, h2, started) => {
        if (!started) return;
        const a = colliderData.get(h1);
        const b = colliderData.get(h2);
        if (!a || !b) return;
        if (a.sensor && !b.sensor) runtime.sensorTouch(a.sensor, b.body, b.part);
        else if (b.sensor && !a.sensor) runtime.sensorTouch(b.sensor, a.body, a.part);
      });
      runtime.afterStep(dt);
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
      if (!world) return 0;
      const w = world;
      let max = 0;
      w.forEachCollider((c1) => {
        if (c1.isSensor()) return;
        w.contactPairsWith(c1, (c2) => {
          if (c2.isSensor() || c2.handle < c1.handle) return;
          w.contactPair(c1, c2, (m) => {
            const n = m.numContacts();
            for (let i = 0; i < n; i++) max = Math.max(max, -m.contactDist(i));
          });
        });
      });
      return max * L;
    },

    setMotorSpeed(linkId: Id, speed: number) {
      joints.get(linkId)?.configureMotorVelocity(speed, MOTOR_DAMPING);
    },

    setVelocity(partId: Id, v: Vec2, omega: number) {
      const r = rt?.plan.partRel.get(partId);
      if (!r || rt!.plan.bodies[r.body]!.static) return;
      const b = bodies[r.body]!;
      b.setLinvel({ x: v[0] / L, y: v[1] / L }, true);
      b.setAngvel(omega, true);
    },

    dispose() {
      events?.free();
      world?.free();
      events = null;
      world = null;
      rt = null;
      bodies = [];
      joints.clear();
      colliderData.clear();
      forced.clear();
    },
  };
  return adapter;
}
