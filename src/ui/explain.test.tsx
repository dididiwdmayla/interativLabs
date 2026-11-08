import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EXPLAIN, EXPLAIN_ORDER } from "@/editor/explain";
import { LINK_LABEL } from "@/editor/names";
import type { LinkKind } from "@/model/types";
import { ExplainArt } from "./ExplainArt";

/** Classes com `animation` no CSS dos cartões (só transform e opacity nos keyframes). */
const css = readFileSync("src/ui/explain.css", "utf8");
const animated = new Set(
  [...css.matchAll(/((?:\.[\w-]+\s*,?\s*)+)\{[^}]*\banimation(?:-name)?\s*:/g)].flatMap((m) =>
    [...(m[1] ?? "").matchAll(/\.([\w-]+)/g)].map((x) => x[1] ?? ""),
  ),
);

describe('cartões "o que é"', () => {
  const kinds = Object.keys(LINK_LABEL) as LinkKind[];

  it("os 12 tipos de ligação têm cartão", () => {
    expect(kinds).toHaveLength(12);
    expect([...EXPLAIN_ORDER].sort()).toEqual([...kinds].sort());
  });

  for (const k of kinds)
    it(`${k}: até três frases curtas, com um exemplo, e uma animação`, () => {
      const e = EXPLAIN[k];
      expect(e.title).toBe(LINK_LABEL[k] === "Rasgo-guia" ? "Rasgo-guia" : LINK_LABEL[k]);
      expect(e.text.length).toBeGreaterThan(0);
      expect(e.text.length).toBeLessThanOrEqual(3);
      for (const t of e.text) {
        expect(t.match(/[.!?](\s|$)/g)?.length).toBe(1);
        expect(t.length).toBeLessThanOrEqual(110);
      }
      expect(e.text.join(" ")).toMatch(/(^|\s)É (o|a) /);
      const html = renderToStaticMarkup(<ExplainArt kind={k} />);
      const classes = [...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => (m[1] ?? "").split(" "));
      expect(classes.filter((c) => animated.has(c)).length).toBeGreaterThan(0);
    });

  it("cápsula (peça do ciclo): até três frases curtas e uma animação", () => {
    const e = EXPLAIN.capsule;
    expect(e.title).toBe("Cápsula");
    expect(e.text.length).toBeLessThanOrEqual(3);
    for (const t of e.text) {
      expect(t.match(/[.!?](\s|$)/g)?.length).toBe(1);
      expect(t.length).toBeLessThanOrEqual(110);
    }
    const html = renderToStaticMarkup(<ExplainArt kind="capsule" />);
    const classes = [...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => (m[1] ?? "").split(" "));
    expect(classes.filter((c) => animated.has(c)).length).toBeGreaterThan(2);
  });

  it("as animações só mexem em transform e opacity, e param com prefers-reduced-motion", () => {
    for (const m of css.matchAll(/@keyframes [\w-]+\s*\{([\s\S]*?)\n\}/g))
      for (const p of (m[1] ?? "").matchAll(/([a-z-]+)\s*:/g))
        expect(["transform", "opacity", "animation-timing-function"]).toContain(p[1]);
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation: none/);
  });
});
