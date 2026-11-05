import { test, type Page } from "@playwright/test";

/**
 * Capturas da Fase 1 · Parte F em docs/capturas/fase-1/parte-f/:
 * as três velocidades com os botões, a sequência de 4 quadros em Lento
 * (interpolação), o arrasto forte no "Cabo" com o cabo inteiro, o
 * exemplo-vitrine nos estados do item 14.5 e a paisagem sem coluna.
 * Rodar: npx playwright test --project=capture-f
 */

const DIR = "docs/capturas/fase-1/parte-f";

interface Hooks {
  ui: {
    getState(): Record<string, (...a: unknown[]) => unknown> & {
      current: { scene: { parts: { id: string; name: string; x: number; y: number }[] } } | null;
      mode: string;
    };
  };
  sim: {
    getState(): {
      ctl: null | {
        scrub(t: number): void;
        setSpeed(s: number): void;
        togglePause(): void;
        timeline(): { latest: number; events: number[]; shown: number };
      };
      paused: boolean;
      speed: number;
    };
  };
  openExample(id: string): Promise<void>;
}

type W = { __IL__: Hooks };

async function boot(page: Page) {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.locator(".stage__sheet--static").first().waitFor();
  await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().setHint!(false));
}

async function test_(page: Page) {
  await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().setMode!("simulate"));
  await page.waitForFunction(() => (window as unknown as W).__IL__.sim.getState().ctl !== null);
}

const PHONE = { width: 844, height: 390 };
const DESK = { width: 1440, height: 900 };

test.describe("velocidades", () => {
  for (const vp of [
    { name: "844x390", ...PHONE, mobile: true },
    { name: "1440x900", ...DESK, mobile: false },
  ]) {
    test.describe(vp.name, () => {
      test.use({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        isMobile: vp.mobile,
        hasTouch: vp.mobile,
      });
      for (const [name, speed] of [
        ["lento", 0.05],
        ["normal", 0.25],
        ["real", 1],
      ] as const) {
        test(`${name}`, async ({ page }) => {
          await boot(page);
          await test_(page);
          await page.evaluate((s) => (window as unknown as W).__IL__.sim.getState().ctl!.setSpeed(s), speed);
          await page.waitForTimeout(600);
          await page.screenshot({ path: `${DIR}/velocidade-${name}-${vp.name}.png` });
        });
      }
    });
  }
});

/**
 * /#perf em Lento, Normal e Real (150 peças, 100 ligações), com o custo da
 * interpolação por quadro. Grava docs/decisoes/perf-parte-f.json.
 */
test.describe("desempenho com interpolação", () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  test("lento, normal e real", async ({ page }) => {
    test.setTimeout(240_000);
    const out: Record<string, unknown> = {};
    for (const [name, label] of [
      ["lento", "Lento"],
      ["normal", "Normal"],
      ["real", "Real"],
    ] as const) {
      await page.goto("/#perf");
      await page.locator(".stage__sheet--static").first().waitFor();
      await page.getByRole("button", { name: label, exact: true }).click();
      await page.getByRole("button", { name: /Rodar/ }).click();
      await page.waitForFunction(() => (window as unknown as { __PERF__?: unknown }).__PERF__, null, {
        timeout: 60_000,
      });
      out[name] = await page.evaluate(() => (window as unknown as { __PERF__?: unknown }).__PERF__);
      await page.evaluate(() => delete (window as unknown as { __PERF__?: unknown }).__PERF__);
    }
    const { writeFileSync } = await import("node:fs");
    writeFileSync("docs/decisoes/perf-parte-f.json", JSON.stringify(out, null, 2) + "\n");
  });
});
