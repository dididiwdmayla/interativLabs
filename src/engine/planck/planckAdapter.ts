import {
  Circle,
  Polygon,
  PrismaticJoint,
  RevoluteJoint,
  Settings,
  Vec2 as PVec2,
  World,
  WorldManifold,
  type Body,
  type Contact,
  type Fixture,
} from "planck";
import type { Vec2 } from "@/geometry/vec";
import type { Id, Scene } from "@/model/types";
import { ANGULAR_DAMPING, FIXED_STEP, SPEED_LIMIT } from "../common";
import { buildPlan } from "../plan";
import { Runtime, type BodyIO, type BodyState } from "../runtime";
import type { CompileOptions, CompileReport, EngineAdapter, PartPose, Snapshot } from "../types";

export const PLANCK_VERSION = "1.5.1";
const VELOCITY_ITERATIONS = 10;
const POSITION_ITERATIONS = 4;

interface FixtureData {
  part: Id;
  body: number;
  sensor?: Id;
}

/** Adaptador do Planck (porte em JS do Box2D v2.4). */
export function createPlanckAdapter(): EngineAdapter {
  let world: World | null = null;
  let rt: Runtime | null = null;
  let L = 1;
  let bodies: (Body | null)[] = [];
  const joints = new Map<Id, RevoluteJoint>();
  const wm = new WorldManifold();

  const io: BodyIO = {
    read(i, out: BodyState) {
      const b = bodies[i]!;
      const p = b.getPosition();
      const v = b.getLinearVelocity();
      out.x = p.x * L;
      out.y = p.y * L;
      out.angle = b.getAngle();
      out.vx = v.x * L;
      out.vy = v.y * L;
      out.w = b.getAngularVelocity();
    },
    applyForce(i, fx, fy, px, py) {
      bodies[i]!.applyForce(PVec2(fx / L, fy / L), PVec2(px / L, py / L), true);
    },
    applyTorque(i, t) {
      bodies[i]!.applyTorque(t / (L * L), true);
    },
    applyImpulse(i, jx, jy, px, py) {
      bodies[i]!.applyLinearImpulse(PVec2(jx / L, jy / L), PVec2(px / L, py / L), true);
    },
  };

  const adapter: EngineAdapter = {
    meta: {
      id: "planck",
      name: "Planck",
      version: PLANCK_VERSION,
      iterations: `${VELOCITY_ITERATIONS} de velocidade + ${POSITION_ITERATIONS} de posição por passo`,
    },

    compile(scene: Scene, options: CompileOptions): CompileReport {
      adapter.dispose();
      L = options.unitMm;
      // Configuração global do Planck (vale para todos os mundos).
      Settings.maxTranslation = (SPEED_LIMIT * FIXED_STEP) / L;
      const plan = buildPlan(scene);
      const warnings = [...plan.warnings];
      const w = new World({ gravity: PVec2(plan.gravity[0] / L, plan.gravity[1] / L) });
      world = w;
      let fixtures = 0;
      bodies = plan.bodies.map((pb) => {
        const body = w.createBody({
          type: pb.static ? "static" : "dynamic",
          position: PVec2(pb.position[0] / L, pb.position[1] / L),
          angle: 0,
          bullet: pb.bullet,
          allowSleep: false,
          angularDamping: ANGULAR_DAMPING,
          linearDamping: 0,
        });
        for (const f of pb.fixtures) {
          const shape =
            f.piece.kind === "circle"
              ? new Circle(PVec2(f.piece.c[0] / L, f.piece.c[1] / L), f.piece.r / L)
              : new Polygon(f.piece.points.map(([x, y]) => PVec2(x / L, y / L)));
          if (shape instanceof Polygon && shape.m_count < 3) {
            warnings.push(`Planck: uma peça convexa de ${f.part} ficou degenerada nesta escala`);
            continue;
          }
          const fx = body.createFixture(shape, {
            density: 0,
            friction: f.friction,
            restitution: f.restitution,
            isSensor: f.sensor,
            filterCategoryBits: f.bits,
            filterMaskBits: f.bits,
          });
          const data: FixtureData = { part: f.part, body: pb.index };
          if (f.sensor && f.link) data.sensor = f.link;
          fx.setUserData(data);
          fixtures++;
        }
        if (!pb.static) body.setMassData({ mass: pb.mass, center: PVec2(0, 0), I: pb.inertia / (L * L) });
        return body;
      });
      rt = new Runtime(plan, io);
      const runtime = rt;
      joints.clear();
      for (const a of plan.axles) {
        const j = w.createJoint(
          new RevoluteJoint(
            {
              enableLimit: !!a.limit,
              lowerAngle: a.limit?.lower ?? 0,
              upperAngle: a.limit?.upper ?? 0,
              enableMotor: !!a.motor,
              motorSpeed: a.motor?.speed ?? 0,
              maxMotorTorque: (a.motor?.maxTorque ?? 0) / (L * L),
              collideConnected: false,
            },
            bodies[a.a]!,
            bodies[a.b]!,
            PVec2(a.anchor[0] / L, a.anchor[1] / L),
          ),
        );
        if (j) joints.set(a.id, j);
      }
      for (const s of plan.sliders) {
        w.createJoint(
          new PrismaticJoint(
            {
              enableLimit: true,
              lowerTranslation: s.lower / L,
              upperTranslation: s.upper / L,
              collideConnected: false,
            },
            bodies[s.a]!,
            bodies[s.b]!,
            PVec2(s.anchor[0] / L, s.anchor[1] / L),
            PVec2(s.axis[0], s.axis[1]),
          ),
        );
      }
      w.on("begin-contact", (c: Contact) => {
        const fa = c.getFixtureA();
        const fb = c.getFixtureB();
        for (const [s, o] of [
          [fa, fb],
          [fb, fa],
        ] as [Fixture, Fixture][]) {
          const u = s.getUserData() as FixtureData | null;
          const ou = o.getUserData() as FixtureData | null;
          if (!u?.sensor || !ou || ou.sensor) continue;
          runtime.sensorTouch(u.sensor, ou.body, ou.part);
        }
      });
      return {
        warnings,
        bodies: plan.bodies.length,
        fixtures,
        joints: plan.axles.length + plan.sliders.length,
      };
    },

    step(dt: number) {
      if (!world || !rt) return;
      rt.beforeStep(dt);
      world.step(dt, VELOCITY_ITERATIONS, POSITION_ITERATIONS);
      rt.afterStep(dt);
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
      let max = 0;
      for (let c = world.getContactList(); c; c = c.getNext()) {
        if (!c.isTouching() || c.getFixtureA().isSensor() || c.getFixtureB().isSensor()) continue;
        c.getWorldManifold(wm);
        const n = c.getManifold().pointCount;
        for (let i = 0; i < n; i++) max = Math.max(max, -(wm.separations[i] ?? 0));
      }
      return max * L;
    },

    setMotorSpeed(linkId: Id, speed: number) {
      joints.get(linkId)?.setMotorSpeed(speed);
    },

    setVelocity(partId: Id, v: Vec2, omega: number) {
      const r = rt?.plan.partRel.get(partId);
      const b = r ? bodies[r.body] : null;
      if (!b || rt!.plan.bodies[r!.body]!.static) return;
      b.setLinearVelocity(PVec2(v[0] / L, v[1] / L));
      b.setAngularVelocity(omega);
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
      world = null;
      rt = null;
      bodies = [];
      joints.clear();
    },
  };
  return adapter;
}
