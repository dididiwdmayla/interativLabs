import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadScene, validateScene } from "@/model/scene";
import type { Scene } from "@/model/types";
import { linkForm, readField, toggleGroup, writeField } from "./linkFields";

const scenes: Scene[] = readdirSync("scenes/examples")
  .filter((f) => f.endsWith(".json") && f !== "index.json")
  .map((f) => {
    const r = loadScene(JSON.parse(readFileSync(`scenes/examples/${f}`, "utf8")));
    if (!r.ok) throw new Error(f);
    return r.scene;
  });

describe("formulário das ligações gerado do schema", () => {
  it("todo campo tem rótulo em português e lê o valor da ligação", () => {
    let n = 0;
    for (const s of scenes)
      for (const l of s.links) {
        const f = linkForm(l);
        for (const x of [...f.fields, ...f.groups.flatMap((g) => (g.present ? g.fields : []))]) {
          expect(x.label, `${l.kind} ${x.path.join(".")}`).not.toMatch(/^[a-z]+(\.[a-zA-Z]+)*$/);
          expect(readField(l, x)).not.toBeUndefined();
          n++;
        }
      }
    expect(n).toBeGreaterThan(20);
  });

  it("ligar um campo opcional e mudar um número mantém a cena válida", () => {
    for (const s of scenes)
      for (const l of s.links) {
        const f = linkForm(l);
        let next = l;
        for (const g of f.groups) if (!g.present) next = toggleGroup(next, g.key, true);
        const num = f.fields.find((x) => x.kind === "number" && x.path[0] !== "ref");
        if (num) next = writeField(next, num.path, (readField(next, num) as number) * 1.01);
        const scene = { ...s, links: s.links.map((x) => (x.id === l.id ? next : x)) };
        const v = validateScene(scene);
        expect(v.ok ? [] : v.issues.map((i) => `${l.kind}: ${i.path} ${i.message}`)).toEqual([]);
      }
  });

  it("ângulos em graus na tela", () => {
    const axle = scenes.flatMap((s) => s.links).find((l) => l.kind === "axle" && l.motor);
    if (!axle || axle.kind !== "axle") return;
    const f = linkForm(axle)
      .groups.find((g) => g.key === "motor")!
      .fields.find((x) => x.path[1] === "speed")!;
    expect(f.unit).toBe("°/s");
    expect(f.toView(Math.PI)).toBeCloseTo(180, 9);
  });
});
