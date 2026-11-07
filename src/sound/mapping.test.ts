import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { audio } from "@/assets/audio-registry";
import { loadScene } from "@/model/scene";
import {
  FAMILY_IDS,
  HEAVY_MASS_G,
  IMPACT_FULL_SPEED,
  IMPACT_MIN_SPEED,
  POP_STRONG_CHARGE,
  WINDOW_MAX,
  WINDOW_MS,
  WindowLimiter,
  impactFamily,
  mapGas,
  mapImpact,
  partSounds,
  speedAmount,
  ventLevel,
  type PartSound,
} from "./mapping";

const part = (material: PartSound["material"], mass: number, ratchet = false): PartSound => ({
  material,
  mass,
  ratchet,
});

describe("família do impacto (material e massa)", () => {
  it("metal leve → impacto de metal; pesado acima do limiar de massa → bloco pesado", () => {
    expect(impactFamily(part("steel", 1), part("steel", 1))).toBe("metal");
    expect(impactFamily(part("steel", 1), part("brass", HEAVY_MASS_G - 0.1))).toBe("metal");
    expect(impactFamily(part("steel", 1), part("aluminum", HEAVY_MASS_G))).toBe("heavy");
    expect(impactFamily(part("steel", 2), part("steel", 400))).toBe("heavy");
  });

  it("madeira e polímero → madeira; borracha vence todos", () => {
    expect(impactFamily(part("steel", 1), part("wood", 5))).toBe("wood");
    expect(impactFamily(part("polymer", 1), part("steel", 900))).toBe("wood");
    expect(impactFamily(part("rubber", 1), part("wood", 1))).toBe("rubber");
    expect(impactFamily(part("steel", 100), part("rubber", 1))).toBe("rubber");
  });

  it("perfil de catraca em qualquer das duas → catraca, no lugar do impacto", () => {
    expect(impactFamily(part("steel", 36, true), part("steel", 0.9))).toBe("ratchet");
    expect(impactFamily(part("steel", 0.9), part("steel", 36, true))).toBe("ratchet");
  });

  it("cada família aponta para IDs que existem no registro", () => {
    for (const ids of Object.values(FAMILY_IDS)) for (const id of ids) expect(audio[id]).toBeDefined();
    expect(FAMILY_IDS.metal).toHaveLength(3);
    expect(FAMILY_IDS.heavy).toHaveLength(2);
    expect(FAMILY_IDS.wood).toHaveLength(2);
    expect(FAMILY_IDS.rubber).toHaveLength(1);
    expect(FAMILY_IDS.ratchet).toHaveLength(2);
  });
});

describe("volume e tom pela velocidade", () => {
  const a = part("steel", 1);
  const b = part("steel", 2);

  it("abaixo do limiar não soa", () => {
    expect(mapImpact(a, b, IMPACT_MIN_SPEED - 1)).toBeNull();
    expect(mapImpact(a, b, 0)).toBeNull();
    expect(mapImpact(a, b, IMPACT_MIN_SPEED)).not.toBeNull();
  });

  it("o volume e o tom crescem com a velocidade, e tom fica em ±1 semitom", () => {
    const speeds = [150, 300, 700, 1500, 3000, 6000, 20000];
    const cues = speeds.map((v) => mapImpact(a, b, v)!);
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i]!.gain).toBeGreaterThanOrEqual(cues[i - 1]!.gain);
      expect(cues[i]!.cents).toBeGreaterThanOrEqual(cues[i - 1]!.cents);
    }
    for (const c of cues) {
      expect(c.gain).toBeGreaterThan(0);
      expect(c.gain).toBeLessThanOrEqual(1);
      expect(Math.abs(c.cents)).toBeLessThanOrEqual(100);
    }
    expect(cues[0]!.cents).toBe(-100);
    expect(cues[cues.length - 1]!.cents).toBe(100);
    expect(speedAmount(IMPACT_FULL_SPEED * 3)).toBe(1);
  });

  it("a catraca estala sempre bem audível (varia pouco)", () => {
    const w = part("steel", 36, true);
    const soft = mapImpact(w, a, 200)!;
    const hard = mapImpact(w, a, 5000)!;
    expect(soft.family).toBe("ratchet");
    expect(soft.gain).toBeGreaterThanOrEqual(0.55);
    expect(hard.gain).toBeLessThanOrEqual(0.9);
  });
});

describe("teto de efeitos por janela", () => {
  it(`no máximo ${WINDOW_MAX} por ${WINDOW_MS} ms`, () => {
    const l = new WindowLimiter();
    const ok = [0, 1, 2, 3, 4, 5, 10, 49].map((t) => l.allow(t));
    expect(ok.filter(Boolean)).toHaveLength(WINDOW_MAX);
    // passada a janela, volta a caber
    expect(l.allow(WINDOW_MS + 1)).toBe(true);
  });

  it("uma rajada de 1000 impactos em 1 s soa no máximo WINDOW_MAX × (1000 / WINDOW_MS)", () => {
    const l = new WindowLimiter();
    let n = 0;
    for (let t = 0; t < 1000; t += 0.5) if (l.allow(t)) n++;
    expect(n).toBeLessThanOrEqual(WINDOW_MAX * (1000 / WINDOW_MS));
    expect(n).toBeGreaterThan(0);
  });
});

describe("gás", () => {
  it("fraca (0,1) e média (0,5) → sfx-gas; forte (1,2) → sfx-pop-strong", () => {
    expect(mapGas(0.1).id).toBe("sfx-gas");
    expect(mapGas(0.5).id).toBe("sfx-gas");
    expect(mapGas(POP_STRONG_CHARGE).id).toBe("sfx-gas");
    expect(mapGas(POP_STRONG_CHARGE + 0.01).id).toBe("sfx-pop-strong");
    expect(mapGas(1.2).id).toBe("sfx-pop-strong");
    expect(mapGas(5).gain).toBeLessThanOrEqual(1);
  });

  it("a carga fraca soa mais baixo que a média", () => {
    expect(mapGas(0.1).gain).toBeLessThan(mapGas(0.5).gain);
  });

  it("a carga forte soa acima da fraca e da média, em volume medido do arquivo", () => {
    // volume que sai: LUFS do arquivo + ganho fino do registro + ganho do toque
    const level = (c: ReturnType<typeof mapGas>) =>
      audio[c.id].measured.lufs! + 20 * Math.log10(audio[c.id].gain * c.gain);
    expect(level(mapGas(1.2))).toBeGreaterThan(level(mapGas(0.5)));
    expect(level(mapGas(1.2))).toBeGreaterThan(level(mapGas(0.1)) + 4);
  });

  it("o chiado: silêncio sem vazão, mais alto com mais vazão, nunca acima de 1", () => {
    expect(ventLevel(0)).toBe(0);
    expect(ventLevel(0.01)).toBe(0);
    const levels = [0.1, 0.5, 2, 8, 100].map(ventLevel);
    for (let i = 1; i < levels.length; i++) expect(levels[i]!).toBeGreaterThanOrEqual(levels[i - 1]!);
    expect(levels[levels.length - 1]).toBeLessThanOrEqual(1);
  });
});

describe("peças da bancada", () => {
  const load = (name: string) => {
    const r = loadScene(JSON.parse(readFileSync(`scenes/examples/${name}.json`, "utf8")));
    if (!r.ok) throw new Error("cena inválida");
    return r.scene;
  };

  it("massa e catraca vêm da cena (placa pesada, esfera leve, roda de catraca)", () => {
    const lanc = load("lancador-bancada");
    const info = partSounds(lanc);
    const byName = (n: string) => info.get(lanc.parts.find((p) => p.name === n)!.id)!;
    expect(byName("Placa de base").mass).toBeGreaterThan(HEAVY_MASS_G);
    expect(byName("Esfera 1").mass).toBeLessThan(HEAVY_MASS_G);
    expect(byName("Esfera 1").material).toBe("steel");
    // uma esfera de aço contra a placa de alumínio: bloco pesado
    expect(impactFamily(byName("Esfera 1"), byName("Placa de base"))).toBe("heavy");
    // esfera contra esfera: metal leve
    expect(impactFamily(byName("Esfera 1"), byName("Esfera 2"))).toBe("metal");
    const roda = load("roda-e-lingueta");
    const r = partSounds(roda);
    expect(r.get(roda.parts.find((p) => p.name === "Roda composta")!.id)!.ratchet).toBe(true);
    expect(r.get(roda.parts.find((p) => p.name === "Lingueta")!.id)!.ratchet).toBe(false);
  });
});
