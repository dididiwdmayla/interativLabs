import { expect, test, type Page } from "@playwright/test";

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
        preview(t: number): void;
        restart(): void;
        dragAt(p: [number, number]): string | null;
        dragMove(p: [number, number]): void;
        dragEnd(): void;
        setSpeed(s: number): void;
        togglePause(): void;
        timeline(): { latest: number; events: number[]; shown: number };
      };
      paused: boolean;
      speed: number;
      set(p: Record<string, unknown>): void;
    };
  };
  openExample(id: string): Promise<void>;
  stage: { get(): { worldToClient(p: [number, number]): [number, number] } | null };
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
          if (speed === 1) {
            // Real pelo botão de verdade: a frase da primeira vez aparece
            if (vp.mobile) await page.locator(".simctl__cycle").click();
            else await page.getByRole("button", { name: /^Real/ }).click();
            await expect(
              page.getByText("Tempo real: peças pequenas se movem rápido de verdade."),
            ).toBeVisible();
          } else
            await page.evaluate(
              (s) => (window as unknown as W).__IL__.sim.getState().ctl!.setSpeed(s),
              speed,
            );
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

/** Exemplo-vitrine no app: Montar (repouso) e Testar (repouso, meio do recuo em Lento, esfera saindo, coletor). */
test.describe("exemplo-vitrine", () => {
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
      test("montar", async ({ page }) => {
        await boot(page);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${DIR}/vitrine-montar-${vp.name}.png` });
      });

      test("testar", async ({ page }) => {
        test.setTimeout(120_000);
        await boot(page);
        await test_(page);
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${DIR}/vitrine-repouso-${vp.name}.png` });
        // puxa o gatilho em Real e lê o instante do tiro na linha do tempo
        const tf = await page.evaluate(async () => {
          const ctl = (window as unknown as W).__IL__.sim.getState().ctl!;
          const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
          ctl.setSpeed(1);
          const t0 = ctl.timeline().latest;
          ctl.dragAt([16, 35.5]);
          for (let i = 1; i <= 12; i++) {
            await wait(16);
            ctl.dragMove([16 - (18 * i) / 12, 35.5 - i / 12]);
          }
          await wait(900);
          ctl.dragEnd();
          await wait(600);
          ctl.setSpeed(0.05);
          return Math.min(...ctl.timeline().events.filter((e) => e > t0));
        });
        const at = async (t: number, name: string) => {
          await page.evaluate((x) => (window as unknown as W).__IL__.sim.getState().ctl!.scrub(x), t);
          await page.waitForTimeout(250);
          await page.screenshot({ path: `${DIR}/vitrine-${name}-${vp.name}.png` });
        };
        await at(tf + 1 / 240, "meio-do-recuo-lento");
        await at(tf + 2 / 240, "esfera-saindo");
        // quatro quadros seguidos de Lento (0,2 passo cada): o desenho entre os passos
        if (vp.name === "844x390")
          for (let k = 0; k < 4; k++) {
            await page.evaluate(
              (x) => (window as unknown as W).__IL__.sim.getState().ctl!.preview(x),
              tf + (0.4 + 0.2 * k) / 240,
            );
            await page.waitForTimeout(150);
            await page.screenshot({ path: `${DIR}/lento-quadro-${k + 1}-${vp.name}.png` });
          }
        // seis tiros e o carregador vazio: as esferas no coletor
        await page.evaluate(async () => {
          const ctl = (window as unknown as W).__IL__.sim.getState().ctl!;
          const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
          ctl.restart();
          (window as unknown as W).__IL__.sim.getState().set({ paused: false, scrubbed: false });
          await wait(300);
          ctl.setSpeed(1);
          for (let shot = 0; shot < 7; shot++) {
            ctl.dragAt([16, 35.5]);
            for (let i = 1; i <= 12; i++) {
              await wait(16);
              ctl.dragMove([16 - (18 * i) / 12, 35.5 - i / 12]);
            }
            await wait(350);
            ctl.dragEnd();
            await wait(450);
          }
          await wait(800);
          ctl.setSpeed(0.25);
        });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${DIR}/vitrine-coletor-${vp.name}.png` });
      });
    });
  }
});

/** Paisagem: a prancha ocupa a tela toda, os controles flutuam sobre ela. */
test.describe("paisagem", () => {
  for (const vp of [
    { name: "844x390", width: 844, height: 390 },
    { name: "640x360", width: 640, height: 360 },
  ]) {
    test.describe(vp.name, () => {
      test.use({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      test("exemplos", async ({ page }) => {
        await boot(page);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${DIR}/paisagem-vitrine-${vp.name}.png` });
        // altura útil: entre a fileira de cima (menu, título, Testar) e a de baixo (desfazer, camada)
        const m = await page.evaluate(() => {
          const api = (window as unknown as W).__IL__.stage.get()!;
          const a = api.worldToClient([-128, -20]);
          const b = api.worldToClient([104, 68]);
          const bottomOf = (sel: string) =>
            Math.max(...[...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect().bottom));
          const topOf = (sel: string) =>
            Math.min(...[...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect().top));
          const top = bottomOf(".corner--tl > *, .corner--tr > *");
          const bottom = topOf(".corner--bl > *, .corner--br > *");
          return { plate: b[1] - a[1], useful: bottom - top, ratio: (b[1] - a[1]) / (bottom - top) };
        });
        expect(m.ratio).toBeGreaterThan(0.7);
        const { writeFileSync } = await import("node:fs");
        writeFileSync(`${DIR}/paisagem-${vp.name}.json`, JSON.stringify(m, null, 2) + "\n");
        await page.evaluate(async () => (window as unknown as W).__IL__.openExample("engrenagens"));
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${DIR}/paisagem-engrenagens-${vp.name}.png` });
      });
    });
  }
});

/** Toque numa peça de outra camada: escolhe a peça e ativa a camada dela. */
test.describe("toque em outra camada", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  test("a placa de base (camada 1) com a camada 4 ativa", async ({ page }) => {
    await boot(page);
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().activeLayer);
    expect(before).toBe(3);
    const [x, y] = await page.evaluate(() =>
      (window as unknown as W).__IL__.stage.get()!.worldToClient([-100, 50]),
    );
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => {
      const s = (window as unknown as W).__IL__.ui.getState() as unknown as {
        activeLayer: number;
        selection: { id: string } | null;
        current: { scene: { parts: { id: string; name: string }[] } };
      };
      return {
        layer: s.activeLayer,
        part: s.current.scene.parts.find((p) => p.id === s.selection?.id)?.name,
      };
    });
    expect(after).toEqual({ layer: 0, part: "Placa de base" });
  });
});

/** Arrasto forte no "Cabo" (laboratório, Real): o peso vai até o fim do cabo e o cabo fica inteiro. */
test.describe("cabo", () => {
  for (const vp of [
    { name: "390x844", width: 390, height: 844 },
    { name: "1440x900", ...DESK },
  ]) {
    test.describe(vp.name, () => {
      test.use({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
      test("arrasto forte", async ({ page }) => {
        await page.goto("/#lab/fixacoes/cabo");
        const svg = page.locator(".lab__svg");
        await svg.waitFor();
        await page.getByRole("button", { name: /^Real/ }).click();
        await page.locator(".lab__stagewrap").scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);
        const box = (await page.locator('.lab__svg [data-part="p1"]').boundingBox())!;
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        // o dedo vai longe e rápido, na diagonal (o peso de Ø 18 mm está a 59 mm
        // abaixo do ponto do cabo): até o mundo (200, 200), 4 vezes o cabo
        const k = box.width / 18;
        await page.mouse.move(x + 200 * k, y + (200 - 59) * k, { steps: 6 });
        await page.waitForTimeout(500);
        await page
          .locator(".lab__stagewrap")
          .screenshot({ path: `${DIR}/cabo-arrasto-forte-${vp.name}.png` });
        await page.mouse.up();
      });
    });
  }
});
