import { expect, test } from "@playwright/test";
import { OVERFLOW_WIDTHS } from "./viewports";

/**
 * Reprova rolagem lateral da página em 360, 390 e 412 px.
 * Confere também que todo controle clicável tem alvo de pelo menos 44 px.
 */
const ROUTES = ["/", "/#bench"];

for (const width of OVERFLOW_WIDTHS) {
  for (const route of ROUTES) {
    test(`sem rolagem lateral em ${width} px (${route})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      if (route === "/#bench") await page.getByRole("heading", { name: "Bancada de motores" }).waitFor();
      const m = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(m.doc, `scrollWidth do documento em ${width}px`).toBeLessThanOrEqual(m.inner);
      expect(m.body, `scrollWidth do body em ${width}px`).toBeLessThanOrEqual(m.inner);

      // Nenhum elemento visível ultrapassa a borda direita da janela, exceto
      // os que estão dentro de um contêiner de rolagem própria (a faixa de ferramentas).
      const escaped = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll("body *"))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (el.closest(".toolbar__scroll, .bench__tablewrap")) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden") continue;
          if (r.right > window.innerWidth + 0.5 || r.left < -0.5) out.push(`${el.tagName}.${el.className}`);
        }
        return out;
      });
      expect(escaped, "elementos fora da janela").toEqual([]);

      const small = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll("button, a[href], [role=button]"))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (r.width < 44 || r.height < 44)
            out.push(`${el.getAttribute("aria-label") ?? el.textContent} ${r.width}x${r.height}`);
        }
        return out;
      });
      expect(small, "alvos de toque menores que 44 px").toEqual([]);
    });
  }
}
