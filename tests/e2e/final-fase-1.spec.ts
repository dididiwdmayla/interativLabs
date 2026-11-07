import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";

/**
 * Item 11 (E3): capturas finais da Fase 1 em docs/capturas/fase-1/final/, em
 * 390×844, 844×390 e 1440×900: o Lançador no Montar e no Testar, a Roda e
 * lingueta, o Martelo e o Lápis abertos, o modo camadas em cores afastado e
 * a faixa do Som.
 */
const DIR = "docs/capturas/fase-1/final";
const VIEWPORTS = [
  { width: 390, height: 844, touch: true },
  { width: 844, height: 390, touch: true },
  { width: 1440, height: 900, touch: false },
];

type Ctl = {
  setSpeed(s: number): void;
  dragAt(p: [number, number]): string | null;
  dragMove(p: [number, number]): void;
  dragEnd(): void;
  preview(t: number): void;
};
type Ui = {
  setHint(on: boolean): void;
  setMode(m: string): void;
  setActiveLayer(i: number): void;
  setHammer(t: string | null): void;
  setPencil(on: boolean): void;
  setLook(p: Record<string, unknown>): void;
  setSoundBar(on: boolean): void;
};
type W = {
  __IL__: {
    openExample(id: string): Promise<void>;
    ui: { getState(): Ui };
    sim: { getState(): { ctl: Ctl | null } };
  };
};

const ui = <T>(page: Page, fn: (u: Ui) => T) =>
  page.evaluate(`(${fn.toString()})(window.__IL__.ui.getState())`) as Promise<T>;

async function open(page: Page, example: string) {
  await page.goto("/");
  await page.locator(".stage__sheet--static").first().waitFor();
  await page.evaluate(async (id) => {
    const h = (window as unknown as W).__IL__;
    await h.openExample(id);
    h.ui.getState().setHint(false);
  }, example);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}×${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch });
    const shot = async (page: Page, name: string) => {
      mkdirSync(DIR, { recursive: true });
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${DIR}/${name}-${vp.width}x${vp.height}.png`, animations: "disabled" });
    };

    test("Lançador: Montar e Testar", async ({ page }) => {
      await open(page, "lancador-bancada");
      await shot(page, "lancador-montar");
      await ui(page, (u) => u.setMode("simulate"));
      await page.waitForFunction(() => (window as unknown as W).__IL__.sim.getState().ctl);
      await page.evaluate(() => (window as unknown as W).__IL__.sim.getState().ctl!.setSpeed(0.05));
      // puxa o gatilho (como no roteiro do Lançador) e espera o recuo do ferrolho em Lento
      const held = await page.evaluate(() =>
        (window as unknown as W).__IL__.sim.getState().ctl!.dragAt([16, 35.5]),
      );
      for (let i = 1; i <= 8; i++) {
        await page.evaluate((p) => (window as unknown as W).__IL__.sim.getState().ctl!.dragMove(p), [
          16 - (18 * i) / 8,
          35.5 - i / 8,
        ] as [number, number]);
        await page.waitForTimeout(40);
      }
      if (held) await page.waitForTimeout(3600);
      await shot(page, "lancador-testar");
    });

    test("Roda e lingueta", async ({ page }) => {
      await open(page, "roda-e-lingueta");
      await ui(page, (u) => u.setActiveLayer(2));
      await shot(page, "roda-e-lingueta");
    });

    test("Martelo e Lápis abertos", async ({ page }) => {
      await open(page, "lancador-bancada");
      await ui(page, (u) => u.setHammer("axle"));
      await shot(page, "martelo-aberto");
      await ui(page, (u) => u.setPencil(true));
      await shot(page, "lapis-aberto");
    });

    test("Camadas em cores, afastadas", async ({ page }) => {
      await open(page, "lancador-bancada");
      await ui(page, (u) => u.setLook({ open: true, spread: true }));
      await shot(page, "camadas-cores-afastadas");
    });

    test("Faixa do Som", async ({ page }) => {
      await open(page, "lancador-bancada");
      await ui(page, (u) => u.setSoundBar(true));
      await shot(page, "faixa-do-som");
    });
  });
}
