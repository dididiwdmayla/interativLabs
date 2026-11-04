import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Scene } from "@/model/types";
import { shapeOutline } from "./outline";
import { shapeGeometry } from "./shape";

describe("contorno sem decomposição", () => {
  it("é o mesmo contorno e a mesma massa de shapeGeometry em todos os exemplos", () => {
    for (const f of readdirSync("scenes/examples").filter((x) => x.endsWith(".json") && x !== "index.json")) {
      const s = JSON.parse(readFileSync(`scenes/examples/${f}`, "utf8")) as Scene;
      for (const p of s.parts) {
        const a = shapeOutline(p.shape);
        const b = shapeGeometry(p.shape);
        expect(a.ok && b.ok).toBe(true);
        if (!a.ok || !b.ok) continue;
        expect(a.value.outline).toEqual(b.value.outline);
        expect(a.value.mass).toEqual(b.value.mass);
      }
    }
  });
});
