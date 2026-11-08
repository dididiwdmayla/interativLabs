import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Scene } from "../../src/model/types";
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
  // Fase 2 · M2a: o ciclo da cápsula no laboratório
  "/#lab/ciclo/disparo-extracao",
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
const SHEETS = [
  "main",
  "drawer",
  "layers",
  "card",
  "edge",
  "hammer",
  "pencil",
  // Parte E2d: a faixa das camadas (com o deslizante), no Montar e no Testar; o modo
  // Esconder; a lista de escondidas aberta; o cartão "o que é"
  "colors",
  "colors-sim",
  "hide",
  "hidden",
  "explain",
  // Parte S: a faixa do Som (Música e Efeitos), no Montar e no Testar
  "sound",
  "sound-sim",
  // Fase 2 · M2a: a gaveta rolada até o grupo Ciclo e o "o que é" da cápsula
  "drawer-ciclo",
  "explain-capsule",
] as const;
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
                  setLook(p: Record<string, unknown>): void;
                  setMode(m: string): void;
                  setHideMode(on: boolean): void;
                  hide(id: string): void;
                  setExplain(k: string): void;
                  setSoundBar(on: boolean): void;
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
        else if (sh === "colors") ui.setLook({ open: true, spread: true });
        else if (sh === "colors-sim") {
          ui.setMode("simulate");
          ui.setLook({ open: true, spread: true, isolate: true });
        } else if (sh === "hide") ui.setHideMode(true);
        else if (sh === "hidden") for (const q of ui.current?.scene.parts.slice(0, 5) ?? []) ui.hide(q.id);
        else if (sh === "explain") ui.setExplain("spring");
        else if (sh === "explain-capsule") ui.setExplain("capsule");
        else if (sh === "drawer-ciclo") ui.setSheet("drawer");
        else if (sh === "sound") ui.setSoundBar(true);
        else if (sh === "sound-sim") {
          ui.setMode("simulate");
          ui.setSoundBar(true);
        } else ui.setSheet(sh);
      }, sheet);
      if (sheet === "hidden") await page.locator(".hiddenpill__btn").click();
      if (sheet === "drawer-ciclo") await page.getByRole("list", { name: "Ciclo" }).scrollIntoViewIfNeeded();
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
        escaped: Array.from(
          document.querySelectorAll(".sheet *, .edgemenu *, .toolstrip *, .hiddenlist *, .corner *"),
        )
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

/**
 * M1: o painel de instrumentos (compacto e expandido), a comparação com o resumo e o seletor
 * de variantes abertos no celular deitado: sem rolagem lateral, nada fora da janela, alvos de
 * 44 px e o painel dentro da tela.
 */
const INSTRUMENT_STATES = ["panel", "expanded", "comparison", "variants"] as const;
type Harness = {
  __IL__: {
    ui: {
      getState(): { openScene(id: string, scene: Scene, figure: number): void; setMode(m: string): void };
    };
    sim: { getState(): { status: string } };
  };
};
for (const { width, height } of OVERFLOW_LANDSCAPE) {
  for (const state of INSTRUMENT_STATES) {
    test(`instrumentos ${state} em ${width}×${height}`, async ({ page }) => {
      const scene = JSON.parse(readFileSync("scenes/examples/lancador-bancada.json", "utf8")) as Scene;
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await page.locator(".stage__sheet--static").first().waitFor();
      await page.evaluate((scene) => {
        const ui = (window as unknown as Harness).__IL__.ui.getState();
        ui.openScene("overflow-m1", scene, 1);
        ui.setMode("simulate");
      }, scene);
      await page.waitForFunction(
        () => (window as unknown as Harness).__IL__.sim.getState().status === "ready",
      );
      if (state === "variants") {
        await page.getByRole("button", { name: "Variantes", exact: true }).click();
        await page.getByRole("button", { name: "Nova variante", exact: true }).click();
        await page.getByRole("button", { name: "Variantes", exact: true }).click();
        await page.getByRole("button", { name: "Comparar", exact: true }).click();
        await page.locator(".variants__menu").waitFor();
      } else if (state === "comparison") {
        await page.getByRole("button", { name: "Experimente comparar", exact: true }).click();
        await page.locator(".comparison-ghost").first().waitFor();
        await expect(page.locator(".comparison-summary")).toContainText("Recuo A");
      } else {
        await page.getByRole("button", { name: "Ver instrumentos", exact: true }).click();
        await page.locator(".instrument-chart").first().waitFor();
        if (state === "expanded") await page.getByRole("button", { name: "Expandir", exact: true }).click();
      }
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const inside = (el: Element) =>
          el.closest(".instruments, .variants, .timeline, .simcontrols, .stage__hud") !== null;
        const box = (el: Element) => el.getBoundingClientRect();
        return {
          doc: document.documentElement.scrollWidth,
          inner: window.innerWidth,
          height: window.innerHeight,
          outside: Array.from(document.querySelectorAll(".instruments *, .variants *, .timeline *"))
            .map((el) => ({ el, r: box(el) }))
            .filter(({ r }) => r.width > 0 && r.height > 0)
            .filter(
              ({ el, r }) =>
                !el.closest(".instruments__charts, .timeline svg, .variants__menu *") &&
                (r.right > window.innerWidth + 0.5 ||
                  r.left < -0.5 ||
                  r.bottom > window.innerHeight + 0.5 ||
                  r.top < -0.5),
            )
            .map(({ el }) => `${el.tagName}.${el.className}`),
          small: Array.from(document.querySelectorAll("button, [role=button], [role=menuitem]"))
            .filter(inside)
            .map((el) => ({ el, r: box(el) }))
            .filter(({ r }) => r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44))
            .map(({ el, r }) => `${el.getAttribute("aria-label") ?? el.textContent} ${r.width}x${r.height}`),
          clipped: Array.from(document.querySelectorAll(".comparison-summary span"))
            .filter((el) => el.scrollWidth > el.clientWidth + 1)
            .map((el) => `${el.textContent} ${el.scrollWidth}>${el.clientWidth}`),
        };
      });
      expect(m.doc, "rolagem lateral").toBeLessThanOrEqual(m.inner);
      expect(m.outside, "fora da janela").toEqual([]);
      expect(m.small, "alvos de toque menores que 44 px").toEqual([]);
      expect(m.clipped, "resumo da comparação cortado").toEqual([]);
    });
  }
}
