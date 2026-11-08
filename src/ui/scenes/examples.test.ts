import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_EXAMPLE, EXAMPLES, loadExample } from "./examples";

const index = JSON.parse(readFileSync("scenes/examples/index.json", "utf8")) as {
  default: string;
  order: string[];
};

describe("exemplos do menu", () => {
  it("o índice lista cada exemplo uma vez e o padrão está na lista", () => {
    expect(new Set(index.order).size).toBe(index.order.length);
    expect(index.order).toContain(index.default);
    expect(DEFAULT_EXAMPLE).toBe(index.default);
    for (const id of index.order) expect(existsSync(`scenes/examples/${id}.json`)).toBe(true);
  });

  it("todo exemplo tem cena de teste, nome e uma linha de descrição", () => {
    expect(EXAMPLES.map((e) => e.id)).toEqual(index.order);
    for (const e of EXAMPLES) {
      expect(existsSync(`scenes/fixtures/exemplos/${e.id}.test.json`)).toBe(true);
      expect(e.title.length).toBeGreaterThan(3);
      expect(e.description.length).toBeGreaterThan(10);
    }
    expect(EXAMPLES.map((e) => e.figure)).toEqual(index.order.map((_, i) => i + 1));
  });

  it("cada exemplo abre pelo schema", async () => {
    for (const e of EXAMPLES) {
      const s = await loadExample(e.id);
      expect(s.version).toBe(4);
    }
  });
});
