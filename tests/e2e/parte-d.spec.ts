import { expect, test, type Page } from "@playwright/test";
import { CAPTURE_VIEWPORTS } from "./viewports";

/**
 * Capturas da Fase 1 · Parte D (palco vivo) em 390×844 e 1440×900, em
 * docs/capturas/fase-1/parte-d/: cada exemplo no Editar, o cilindro no
 * Simular a 0,05× no meio do disparo, a biela no meio do ciclo, uma peça
 * selecionada, o raio-x e a linha do tempo arrastada.
 * Rodar: npx playwright test --project=capture-d
 */

const DIR = "docs/capturas/fase-1/parte-d";
const EXAMPLES = ["cilindro-dois-pistoes", "engrenagens", "biela-manivela", "trava", "lancador"];

interface Hooks {
  ui: {
    getState(): {
      select(s: { kind: "part" | "link"; id: string } | null): void;
      setXray(on: boolean): void;
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
      set(p: Record<string, unknown>): void;
    };
  };
  openExample(id: string): Promise<void>;
}

async function open(page: Page, id: string) {
  await page.evaluate(async (x) => {
    await (window as unknown as { __IL__: Hooks }).__IL__.openExample(x);
  }, id);
  await page.waitForTimeout(400);
}

async function simulateUntil(page: Page, t: number) {
  await page.getByRole("button", { name: "Simular" }).first().click();
  await page.waitForFunction(
    () => (window as unknown as { __IL__: Hooks }).__IL__.sim.getState().ctl !== null,
  );
  await page.evaluate(() => (window as unknown as { __IL__: Hooks }).__IL__.sim.getState().ctl!.setSpeed(1));
  await page.waitForFunction(
    (tt) => (window as unknown as { __IL__: Hooks }).__IL__.sim.getState().ctl!.timeline().latest >= tt,
    t,
    { timeout: 30_000 },
  );
  await page.evaluate(() => {
    const s = (window as unknown as { __IL__: Hooks }).__IL__.sim.getState();
    if (!s.paused) s.ctl!.togglePause();
  });
}

for (const vp of CAPTURE_VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
    });

    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await page.locator(".stage__sheet--static").first().waitFor();
    });

    for (const id of EXAMPLES)
      test(`${id} no Editar`, async ({ page }) => {
        await open(page, id);
        await page.screenshot({ path: `${DIR}/editar-${id}-${vp.name}.png` });
      });

    test("cilindro no Simular a 0,05×, no meio do disparo", async ({ page }) => {
      await open(page, "cilindro-dois-pistoes");
      await simulateUntil(page, 0.6);
      // procura, logo depois do acendimento, o quadro de maior pressão
      const fired = await page.evaluate(async () => {
        const ctl = (window as unknown as { __IL__: Hooks }).__IL__.sim.getState().ctl!;
        const t = ctl.timeline().events[0] ?? 0.2;
        let best = 0;
        let bestT = t;
        for (let k = 0; k <= 12; k++) {
          ctl.scrub(t + k / 240);
          await new Promise((r) => requestAnimationFrame(r));
          const kpa = Number((document.querySelector(".gauge")?.textContent ?? "0").replace(/\D/g, ""));
          if (kpa > best) {
            best = kpa;
            bestT = t + k / 240;
          }
        }
        ctl.scrub(bestT);
        ctl.setSpeed(0.05);
        return best;
      });
      expect(fired).toBeGreaterThan(110);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${DIR}/simular-cilindro-005-${vp.name}.png` });
    });

    test("biela no meio do ciclo", async ({ page }) => {
      await open(page, "biela-manivela");
      await simulateUntil(page, 1.5);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${DIR}/simular-biela-${vp.name}.png` });
    });

    test("peça selecionada", async ({ page }) => {
      await open(page, "engrenagens");
      await page.evaluate(() =>
        (window as unknown as { __IL__: Hooks }).__IL__.ui.getState().select({ kind: "part", id: "p8" }),
      );
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${DIR}/selecionada-${vp.name}.png` });
    });

    test("raio-x", async ({ page }) => {
      await open(page, "lancador");
      await page.evaluate(() => (window as unknown as { __IL__: Hooks }).__IL__.ui.getState().setXray(true));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${DIR}/raio-x-${vp.name}.png` });
    });

    test("linha do tempo arrastada", async ({ page }) => {
      await open(page, "cilindro-dois-pistoes");
      await simulateUntil(page, 1.2);
      const box = await page.locator(".timeline").boundingBox();
      if (!box) throw new Error("sem régua");
      // a régua mostra 10 s; arrasta a cabeça até perto de 0,3 s
      const x0 = box.x + 10 + ((box.width - 20) * 1.2) / 10;
      const x1 = box.x + 10 + ((box.width - 20) * 0.3) / 10;
      await page.mouse.move(x0, box.y + box.height - 12);
      await page.mouse.down();
      await page.mouse.move(x1, box.y + box.height - 12, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      await expect(page.locator(".timeline__time")).not.toHaveText("t = 1,200 s");
      await page.screenshot({ path: `${DIR}/linha-do-tempo-${vp.name}.png` });
    });
  });
}
