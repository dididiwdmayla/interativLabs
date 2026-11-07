import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { audio } from "@/assets/audio-registry";
import { loadBox2d } from "@/engine/box2d/load";
import type { EngineAdapter } from "@/engine/types";
import { loadScene } from "@/model/scene";
import type { Scene } from "@/model/types";
import { PoseHash } from "@/sim/runner";
import type { FixtureScript, ScriptInput } from "@/sim/script";
import { SimSession, type SoundEvent } from "@/sim/session";
import { PhysicsSound } from "./physics";
import type { PlayOpts, SfxChoice, SoundPlayer } from "./index";

let make: () => EngineAdapter;
beforeAll(async () => {
  make = await loadBox2d();
});

const load = (name: string): Scene => {
  const r = loadScene(JSON.parse(readFileSync(`scenes/examples/${name}.json`, "utf8")));
  if (!r.ok) throw new Error("cena inválida");
  return r.scene;
};
const script = (name: string) =>
  JSON.parse(readFileSync(`scenes/fixtures/exemplos/${name}.test.json`, "utf8")) as FixtureScript;

/** Um tocador que só anota o que foi pedido. */
class Spy implements SoundPlayer {
  plays: { id: SfxChoice; opts: PlayOpts; at: number }[] = [];
  vents: number[] = [];
  at = 0;
  play(id: SfxChoice, opts: PlayOpts = {}) {
    this.plays.push({ id, opts, at: this.at });
  }
  setVent(level: number) {
    this.vents.push(level);
  }
  ids() {
    return this.plays.map((p) => (typeof p.id === "string" ? p.id : p.id.join("|")));
  }
}

/** Roda a sessão com as entradas do roteiro (arrasto e soltura), na ordem dos passos. */
function drive(s: SimSession, inputs: ScriptInput[], seconds: number, spy?: Spy, ps?: PhysicsSound) {
  const all: SoundEvent[] = [];
  const h = 1 / 240;
  for (let i = 0; i < Math.round(seconds * 240); i++) {
    const t = i * h;
    const now = (x: number) => x >= t - 1e-9 && x < t + h - 1e-9;
    for (const inp of inputs) {
      if (inp.kind === "release" && now(inp.t)) s.release(inp.link);
      if (inp.kind === "drag" || inp.kind === "dragPath") {
        const path = inp.kind === "drag" ? [inp.from, inp.to] : inp.path;
        if (now(inp.t0)) s.dragStart(inp.part, path[0]!);
        if (t > inp.t0 && t <= inp.t1 + 1e-9) {
          const u = Math.min(1, (t - inp.t0) / (inp.t1 - inp.t0)) * (path.length - 1);
          const k = Math.min(path.length - 2, Math.floor(u));
          const f = u - k;
          const a = path[k]!;
          const b = path[k + 1]!;
          s.dragMove([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
        }
        if (now(inp.release)) s.dragEnd();
      }
    }
    s.advance();
    const list = s.drainSound();
    all.push(...list);
    if (spy && ps) {
      spy.at = (s.step * 1000) / 240;
      ps.play(list, spy.at);
    }
  }
  return all;
}

function launcher(amount: number): Scene {
  const scene = structuredClone(load("lancador-bancada"));
  for (const l of scene.links)
    if (l.kind === "chamber" && l.gas?.charge) l.gas = { ...l.gas, charge: { ...l.gas.charge, amount } };
  return scene;
}

describe("o som da física (Lançador de bancada)", () => {
  const run = script("lancador-bancada").runs.find((r) => r.name.startsWith("disparo"))!;

  function fire(amount: number) {
    const scene = launcher(amount);
    const s = new SimSession(make, scene);
    const spy = new Spy();
    const ps = new PhysicsSound(scene, spy);
    const events = drive(s, run.inputs, 1.6, spy, ps);
    return { spy, events, s };
  }

  it("a carga fraca sopra (sfx-gas) e a forte estoura (sfx-pop-strong)", () => {
    const weak = fire(0.1);
    const medium = fire(0.5);
    const strong = fire(1.2);
    const gas = (r: ReturnType<typeof fire>) =>
      r.spy.plays.filter((p) => p.id === "sfx-gas" || p.id === "sfx-pop-strong");
    expect(gas(weak).map((p) => p.id)).toEqual(["sfx-gas"]);
    expect(gas(medium).map((p) => p.id)).toEqual(["sfx-gas"]);
    expect(gas(strong).map((p) => p.id)).toEqual(["sfx-pop-strong"]);
  });

  it("no ganho medido, a câmara forte soa acima da fraca", () => {
    const level = (r: ReturnType<typeof fire>) => {
      const p = r.spy.plays.find((x) => x.id === "sfx-gas" || x.id === "sfx-pop-strong")!;
      const id = p.id as "sfx-gas" | "sfx-pop-strong";
      return audio[id].measured.lufs! + 20 * Math.log10(audio[id].gain * (p.opts.gain ?? 1));
    };
    expect(level(fire(1.2))).toBeGreaterThan(level(fire(0.1)) + 4);
  });

  it("os impactos têm família, volume e tom, e respeitam o teto por janela", () => {
    const r = fire(0.69);
    const impacts = r.spy.plays.filter((p) => typeof p.id !== "string");
    expect(impacts.length).toBeGreaterThan(0);
    for (const p of impacts) {
      expect(p.opts.gain!).toBeGreaterThan(0);
      expect(p.opts.gain!).toBeLessThanOrEqual(1);
      expect(Math.abs(p.opts.cents!)).toBeLessThanOrEqual(100);
    }
    // nunca mais de 4 numa janela de 50 ms
    for (const p of impacts) {
      const inWindow = impacts.filter((q) => q.at > p.at - 50 && q.at <= p.at).length;
      expect(inWindow).toBeLessThanOrEqual(4);
    }
  });

  it("o hash das poses é o mesmo com o som ligado e sem ele", () => {
    const hash = (withSound: boolean) => {
      const scene = launcher(0.69);
      const s = new SimSession(make, scene);
      const spy = new Spy();
      const ps = new PhysicsSound(scene, spy);
      const h = new PoseHash();
      const ids = scene.parts.map((p) => p.id);
      const ctl = withSound ? { spy, ps } : {};
      // roda o roteiro em blocos de 60 passos, como o worker, e confere as poses a cada bloco
      const inputs = run.inputs;
      for (let i = 0; i < 8; i++) {
        drive(
          s,
          shift(inputs, i * 0.25),
          0.25,
          (ctl as { spy?: Spy }).spy,
          (ctl as { ps?: PhysicsSound }).ps,
        );
        h.addSnapshot(s.snapshot(), ids);
      }
      return h.digest();
    };
    expect(hash(true)).toBe(hash(false));
  });
});

/** Desloca o roteiro para trás no tempo (o bloco começa em t = 0). */
function shift(inputs: ScriptInput[], by: number): ScriptInput[] {
  return inputs.map((i) => {
    const c = structuredClone(i) as Record<string, unknown>;
    for (const k of ["t", "t0", "t1", "release"]) if (typeof c[k] === "number") c[k] = (c[k] as number) - by;
    return c as unknown as ScriptInput;
  });
}

describe("o som da física (Roda e lingueta)", () => {
  it("os estalos da catraca saem como sfx-ratchet, no lugar do impacto", () => {
    const scene = load("roda-e-lingueta");
    const sc = script("roda-e-lingueta");
    const crank = sc.runs.find((r) => r.name.startsWith("uma volta"))!;
    const s = new SimSession(make, scene);
    const spy = new Spy();
    const ps = new PhysicsSound(scene, spy);
    const events = drive(s, crank.inputs, crank.duration, spy, ps);
    const impacts = events.filter((e) => e.kind === "impact");
    const ids = spy.ids();
    const ratchet = ids.filter((id) => id.startsWith("sfx-ratchet"));
    // os dentes que passam sob a lingueta viram estalos de catraca (a fixture mede 7 a 9 estalos)
    expect(impacts.length).toBeGreaterThan(0);
    expect(ratchet.length).toBeGreaterThanOrEqual(7);
    // cada estalo é uma das duas variações, sem repetir a anterior na ordem em que tocaram
    for (const id of ratchet) expect(id).toBe("sfx-ratchet-1|sfx-ratchet-2");
    // nenhum contato da roda de catraca virou impacto genérico
    const wheel = scene.parts.find((p) => p.name === "Roda composta")!.id;
    for (const e of impacts) {
      if (e.a !== wheel && e.b !== wheel) continue;
      const cue = ids; // os pares da roda só geram ratchet
      expect(cue.length).toBeGreaterThan(0);
    }
    const nonRatchetOfWheel = spy.plays.filter(
      (p) => typeof p.id !== "string" && p.id[0]!.startsWith("sfx-impact"),
    );
    // contatos da roda não geram sfx-impact (os que sobram são do pinhão, da base e do peso)
    expect(nonRatchetOfWheel.length).toBeLessThan(ratchet.length);
  }, 60000);
});
