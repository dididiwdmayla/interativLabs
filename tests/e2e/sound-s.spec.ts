import { expect, test, type Page } from "@playwright/test";

/**
 * Parte S · item 18.2 — o motor de som no navegador: nada é pedido a /audio/
 * antes do primeiro toque; depois do toque a música toca; a aba escondida
 * suspende o contexto; as preferências voltam depois de recarregar.
 */

type Debug = {
  state: string;
  hidden: boolean;
  prefs: { music: boolean; effects: boolean };
  music: { playing: boolean; time: number; started: boolean };
  loaded: string[];
  played: { id: string }[];
  voicesOf: Record<string, number>;
};
type W = {
  __IL__: {
    sound: { ready: boolean; debug(): Debug | null };
    ui: {
      getState(): { setSoundBar(on: boolean): void; setHint(on: boolean): void; setMode(m: string): void };
    };
  };
};

const debug = (page: Page) => page.evaluate(() => (window as unknown as W).__IL__.sound.debug());

async function open(page: Page, audio: string[]) {
  page.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    if (path.startsWith("/audio/")) audio.push(path);
  });
  await page.goto("/");
  await page.locator(".stage__sheet--static").first().waitFor();
  await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().setHint(false));
}

test.use({ viewport: { width: 1440, height: 900 } });

test("nada é pedido a /audio/ antes do primeiro toque; depois do toque a música toca", async ({ page }) => {
  const audio: string[] = [];
  await open(page, audio);
  await page.waitForTimeout(2500);
  expect(audio).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as W).__IL__.sound.ready)).toBe(false);
  expect(await debug(page)).toBeNull();

  await page.mouse.click(720, 450);
  await expect.poll(async () => (await debug(page))?.music.playing, { timeout: 15_000 }).toBe(true);
  expect(audio.some((p) => p === "/audio/music-bench.m4a")).toBe(true);
  const t0 = (await debug(page))!.music.time;
  await page.waitForTimeout(1500);
  expect((await debug(page))!.music.time).toBeGreaterThan(t0 + 0.5);
  // os efeitos da Parte S chegam depois, em tempo ocioso (25 menos os 5 da Mecânica 2.0, que não têm gatilho)
  await expect.poll(async () => (await debug(page))?.loaded.length, { timeout: 15_000 }).toBe(20);
  expect(audio).not.toContain("/audio/sfx-case-drop-1.wav");
});

test("a aba escondida cala tudo e suspende o contexto; a volta retoma", async ({ page }) => {
  const audio: string[] = [];
  await open(page, audio);
  await page.mouse.click(720, 450);
  await expect.poll(async () => (await debug(page))?.music.playing, { timeout: 15_000 }).toBe(true);

  const setVisibility = (state: "hidden" | "visible") =>
    page.evaluate((s) => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => s });
      document.dispatchEvent(new Event("visibilitychange"));
    }, state);

  await setVisibility("hidden");
  await expect.poll(async () => (await debug(page))?.state, { timeout: 5000 }).toBe("suspended");
  expect((await debug(page))!.music.playing).toBe(false);

  await setVisibility("visible");
  await expect.poll(async () => (await debug(page))?.state, { timeout: 5000 }).toBe("running");
  await expect.poll(async () => (await debug(page))?.music.playing, { timeout: 5000 }).toBe(true);
});

test("música e efeitos ligam e desligam separados, e as preferências voltam depois de recarregar", async ({
  page,
}) => {
  const audio: string[] = [];
  await open(page, audio);
  await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().setSoundBar(true));
  const strip = page.locator(".toolstrip");
  const music = strip.getByRole("button", { name: "Música", exact: true });
  const effects = strip.getByRole("button", { name: "Efeitos", exact: true });
  await expect(music).toHaveAttribute("aria-pressed", "true");
  await expect(effects).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".toolstrip__phrase")).toContainText("Música ligada · Efeitos ligados");

  await music.click();
  await expect(music).toHaveAttribute("aria-pressed", "false");
  await expect(effects).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".toolstrip__phrase")).toContainText("Música desligada · Efeitos ligados");
  const stored = await page.evaluate(() => window.localStorage.getItem("il.sound"));
  expect(JSON.parse(stored!)).toEqual({ music: false, effects: true });

  await page.reload();
  await page.locator(".stage__sheet--static").first().waitFor();
  await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().setSoundBar(true));
  await expect(music).toHaveAttribute("aria-pressed", "false");
  await expect(effects).toHaveAttribute("aria-pressed", "true");
  // com a música desligada, o primeiro toque acorda o motor mas a música não entra
  await page.mouse.click(720, 450);
  await expect
    .poll(async () => (await debug(page))?.prefs, { timeout: 15_000 })
    .toEqual({
      music: false,
      effects: true,
    });
  await page.waitForTimeout(1200);
  expect((await debug(page))!.music.playing).toBe(false);
  // ligando de novo, ela entra na hora
  await music.click();
  await expect.poll(async () => (await debug(page))?.music.playing, { timeout: 8000 }).toBe(true);
});
