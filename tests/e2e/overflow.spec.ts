import { expect, test } from "@playwright/test";
import { OVERFLOW_LANDSCAPE, OVERFLOW_WIDTHS } from "./viewports";

/**
 * Reprova rolagem lateral da página em 360, 390 e 412 px de largura e no
 * celular deitado (844×390 e 640×360).
 * Confere também que todo controle clicável tem alvo de pelo menos 44 px.
 */
const ROUTES = [
  "/",
  "/#bench",
  "/#lab",
  "/#lab/exemplos/cilindro-dois-pistoes",
  "/#lab/exemplos/lancador-bancada",
  "/#perf",
];

const SIZES = [...OVERFLOW_WIDTHS.map((width) => ({ width, height: 800 })), ...OVERFLOW_LANDSCAPE];

for (const { width, height } of SIZES) {
  for (const route of ROUTES) {
    test(`sem rolagem lateral em ${width}×${height} (${route})`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      if (route === "/#bench") await page.getByRole("heading", { name: "Bancada de motores" }).waitFor();
      if (route.startsWith("/#lab")) await page.locator(".lab__svg").waitFor();
      if (route === "/" || route === "/#perf") await page.locator(".stage__sheet--static").first().waitFor();
      if (route === "/") await page.waitForTimeout(300);
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
          if (el.closest(".bench__tablewrap, .lab__stage, .stage__sheets, .holdring")) continue;
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

/** As folhas e o menu de borda abertos também não fazem rolagem lateral e têm alvos de 44 px. */
const SHEETS = ["main", "drawer", "layers", "card", "edge", "hammer", "pencil"] as const;
for (const { width, height } of [{ width: 360, height: 800 }, ...OVERFLOW_LANDSCAPE]) {
  for (const sheet of SHEETS) {
    test(`folha ${sheet} em ${width}×${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await page.locator(".stage__sheet--static").first().waitFor();
      await page.evaluate((sh) => {
        const ui = (
          window as unknown as {
            __IL__: {
              ui: {
                getState(): {
                  current: { scene: { parts: { id: string }[] } } | null;
                  select(s: { kind: "part"; id: string }): void;
                  setSheet(s: string): void;
                  setHammer(s: string): void;
                  setPencil(on: boolean): void;
                  setEdgeMenu(m: { side: "left" | "right"; cy: number; hover: null }): void;
                };
              };
            };
          }
        ).__IL__.ui.getState();
        const p = ui.current?.scene.parts.at(-1);
        if (p) ui.select({ kind: "part", id: p.id });
        if (sh === "edge") ui.setEdgeMenu({ side: "left", cy: 200, hover: null });
        else if (sh === "hammer") ui.setHammer("axle");
        else if (sh === "pencil") ui.setPencil(true);
        else ui.setSheet(sh);
      }, sheet);
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        inner: window.innerWidth,
        small: Array.from(document.querySelectorAll("button, a[href], [role=button], input[type=range]"))
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && r.height > 0)
          .filter(({ el, r }) =>
            el.matches("input[type=range]") ? r.height < 24 : r.width < 44 || r.height < 44,
          )
          .map(({ el, r }) => `${el.getAttribute("aria-label") ?? el.textContent} ${r.width}x${r.height}`),
        escaped: Array.from(document.querySelectorAll(".sheet *, .edgemenu *, .toolstrip *"))
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && (r.right > window.innerWidth + 0.5 || r.left < -0.5))
          .filter(({ el }) => !el.closest(".tiles"))
          .map(({ el }) => `${el.tagName}.${el.className}`),
      }));
      expect(m.doc).toBeLessThanOrEqual(m.inner);
      expect(m.small, "alvos de toque menores que 44 px").toEqual([]);
      expect(m.escaped, "fora da janela").toEqual([]);
    });
  }
}
