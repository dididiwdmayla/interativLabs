import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadBox2d } from "@/engine/box2d/load";
import type { EngineAdapter } from "@/engine/types";
import { loadScene } from "@/model/scene";
import type { Scene } from "@/model/types";
import { INVARIANTS, abuseScene, isFastScene, type InvariantId } from "./abuse";

/**
 * Teste de abuso, modo rápido (Fase 1 · Parte F, item 14.4): em cada cena
 * de scenes/fixtures/ (fora a bancada) e em cada exemplo, a peça móvel
 * mais pesada e a mais leve, em Normal e em Real, arrastadas para fora e
 * sacudidas; 1 s parado depois. O modo completo (todas as peças, as três
 * velocidades e as três manobras, 2 s parado) roda por `npm run abuse` e
 * fica em docs/decisoes/abuso.md.
 *
 * Falhas esperadas: o que não tem conserto nesta parte, com o motivo e os
 * números em docs/decisoes/abuso.md. Uma falha esperada que passa não
 * reprova.
 */

const IMPACT =
  "impacto rápido entre peças móveis: o Box2D v3 só cria o ponto de contato a 0,1 mm (distância especulativa, presa à folga linear de 0,025 mm), e a 1/240 s uma peça a 0,5–2 m/s anda 2–8 mm por passo; a sobreposição dura um passo";
const EXPECTED: Record<string, Partial<Record<InvariantId, string>>> = {
  "calibracao/corrente": {
    joint:
      "corrente de 40 elos chicoteada pela mão: os eixos da ponta abrem até ~1 mm (a cena é o teste de estresse da calibração)",
    penetration: IMPACT,
    speed: "a ponta da corrente chicoteada passa de 2 m/s (física: o chicote concentra a energia na ponta)",
    energy: "a sobreposição dos impactos entre elos é desfeita pelo contato, que devolve energia",
  },
  "calibracao/pilha": {
    penetration: IMPACT,
    speed: "caixas caindo de 200 mm quando a pilha desaba (queda livre)",
    energy:
      "a sobreposição das caixas que caem umas sobre as outras é desfeita pelo contato, que devolve energia",
  },
  "calibracao/pinhao": { penetration: IMPACT },
  "desempenho/desempenho": { penetration: IMPACT },
  "gas/cargas": { penetration: IMPACT },
  "gas/sensor": { penetration: IMPACT },
  "gas/recuo": { penetration: IMPACT },
  "exemplos/cilindro-dois-pistoes": { penetration: IMPACT },
  "rasgos/camadas": {
    penetration: IMPACT,
    speed:
      "a própria cena solta a peça com pino de 392 mm (2,8 m/s sem dedo); levantada pela mão, cai de 670 mm",
    energy: "o impacto da queda (3,4 m/s) é desfeito pelo contato, que devolve 0,0014 mJ",
  },
  "exemplos/engrenagens": { penetration: IMPACT },
  "exemplos/lancador-bancada": { penetration: IMPACT },
  "exemplos/lancador": { penetration: IMPACT },
  "exemplos/trava": { penetration: IMPACT },
  // garra contra o estojo com o ferrolho sacudido a 8 Hz: 0,311 mm num passo (o que dura dois passos fica em 0,16 mm)
  "ciclo/extrator": { penetration: IMPACT },
  "ciclo/ejetor": { penetration: IMPACT },
  "ciclo/disparo-extracao": { penetration: IMPACT },
};

function scenes(): { id: string; scene: Scene }[] {
  const out: { id: string; scene: Scene }[] = [];
  const load = (path: string): Scene => {
    const r = loadScene(JSON.parse(readFileSync(path, "utf8")));
    if (!r.ok) throw new Error(path);
    return r.scene;
  };
  for (const g of readdirSync("scenes/fixtures").sort()) {
    if (g === "bench" || g.includes(".")) continue;
    for (const f of readdirSync(`scenes/fixtures/${g}`).sort())
      if (f.endsWith(".scene.json"))
        out.push({ id: `${g}/${f.replace(".scene.json", "")}`, scene: load(`scenes/fixtures/${g}/${f}`) });
  }
  for (const f of readdirSync("scenes/examples").sort())
    if (f.endsWith(".json") && f !== "index.json")
      out.push({ id: `exemplos/${f.replace(".json", "")}`, scene: load(`scenes/examples/${f}`) });
  return out;
}

let make: () => EngineAdapter;
beforeAll(async () => {
  make = await loadBox2d();
});

describe("teste de abuso (modo rápido)", () => {
  for (const { id, scene } of scenes()) {
    it(id, { timeout: 60_000 }, () => {
      const heavy = abuseScene(make, id, scene, {
        fastScene: isFastScene(id, scene),
        speeds: [0.25, 1],
        maneuvers: ["out", "shake"],
        sample: 2,
        rest: 1,
      });
      const bad = INVARIANTS.filter((i) => !heavy.results[i.id].pass && !EXPECTED[id]?.[i.id]).map(
        (i) => `${i.label}: ${heavy.results[i.id].worst.toFixed(3)} (${heavy.results[i.id].where})`,
      );
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
});
