import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EXPLAIN } from "./explain";
import { LINK_LABEL } from "./names";
import { ExplainArt } from "@/ui/ExplainCard";
import type { LinkKind } from "@/model/types";
it("all twelve connections have concise Portuguese text and their own animation", () => {
  expect(Object.keys(EXPLAIN)).toHaveLength(12);
  for (const kind of Object.keys(LINK_LABEL) as LinkKind[]) {
    expect(EXPLAIN[kind].text.split(/[.!?]/).filter((s) => s.trim()).length).toBeLessThanOrEqual(3);
    expect(EXPLAIN[kind].animation).toBe(kind);
    const svg = renderToStaticMarkup(ExplainArt({ kind }));
    expect(svg).toContain(`explain-art--${kind}`);
    const css = readFileSync("src/ui/explain.css", "utf8");
    const classes = [...svg.matchAll(/class="(explain-art__[a-z-]+)"/g)].map((m) => m[1]);
    expect(classes.some((name) => new RegExp(`\\.${name}[^}]+animation:`).test(css))).toBe(true);
  }
});
