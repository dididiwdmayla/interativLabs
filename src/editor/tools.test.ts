import { describe, expect, it } from "vitest";
import { ALL_TOOLS, TOOL_GROUPS, groupOf, toolById } from "./tools";

describe("catálogo de ferramentas", () => {
  it("tem ids únicos e uma dica curta para cada ferramenta", () => {
    const ids = ALL_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of ALL_TOOLS) {
      expect(t.hint.length).toBeGreaterThan(10);
      expect(t.hint.length).toBeLessThanOrEqual(110);
    }
  });

  it("cobre as sete ligações da arquitetura", () => {
    const links = TOOL_GROUPS.filter((g) => g.id !== "draw").flatMap((g) => g.tools.map((t) => t.id));
    expect(links.sort()).toEqual(["axle", "chamber", "pin", "screw", "sensor", "slider", "spring"]);
  });

  it("encontra ferramenta e grupo", () => {
    expect(toolById("gear").label).toBe("Engrenagem");
    expect(groupOf("sensor").id).toBe("energy");
    expect(() => toolById("nada" as never)).toThrow();
  });
});
