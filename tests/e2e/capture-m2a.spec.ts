import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import type { Scene } from "../../src/model/types";
import type { useSimStore } from "../../src/ui/sim/simStore";

/**
 * M2a: a gaveta "Ciclo", o cartão da cápsula e o "O que é?", a cápsula
 * carregada e a deflagrada de perto, a sequência de extração e ejeção em Lento
 * (4 quadros) e o painel de instrumentos de ciclo/disparo-extracao.
 */
type Harness = {
  __IL__: {
    ui: {
      getState(): {
        openScene(id: string, scene: Scene, figure: number): void;
        setMode(mode: "simulate" | "edit"): void;
        setSheet(s: string | null): void;
        select(s: { kind: "part"; id: string } | null): void;
        setExplain(k: string | null): void;
      };
    };
    sim: typeof useSimStore;
    stage: { get(): { worldToClient(p: [number, number]): [number, number] } | null };
  };
};
const DIR = "docs/capturas/fase-2/m2a";
const PHONE = { width: 844, height: 390 };

const fixture = (name: string) =>
  JSON.parse(readFileSync(`scenes/fixtures/ciclo/${name}.scene.json`, "utf8")) as Scene;

async function open(page: Page, scene: Scene, viewport = PHONE, mode: "simulate" | "edit" = "edit") {
  mkdirSync(DIR, { recursive: true });
  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.locator(".stage__sheet--static").first().waitFor();
  await page.evaluate(
    ({ scene, mode }) => {
      const ui = (window as unknown as Harness).__IL__.ui.getState();
      ui.openScene("capture-m2a", scene, 1);
      if (mode === "simulate") ui.setMode("simulate");
    },
    { scene, mode },
  );
  if (mode === "simulate")
    await page.waitForFunction(() => (window as unknown as Harness).__IL__.sim.getState().status === "ready");
  await page.waitForTimeout(300);
}

/** Recorte da tela em volta de uma peça (mundo → cliente), com margem em mm. */
async function clipAround(page: Page, scene: Scene, id: string, mm: number) {
  const p = scene.parts.find((q) => q.id === id)!;
  const [a, b] = await page.evaluate(
    ({ p, mm }) => {
      const api = (window as unknown as Harness).__IL__.stage.get()!;
      return [api.worldToClient([p.x - mm, p.y - mm * 0.5]), api.worldToClient([p.x + mm, p.y + mm * 0.5])];
    },
    { p: { x: p.x, y: p.y }, mm },
  );
  return { x: Math.max(0, a[0]), y: Math.max(0, a[1]), width: b[0] - a[0], height: b[1] - a[1] };
}

/** No Testar, pausado: solta a trava (o gatilho) no passo `at` e anda `steps` passos. */
async function playTrigger(page: Page, lock: [number, number] | null, at: number, steps: number) {
  await page.evaluate(
    async ({ lock, at, steps }) => {
      const h = (window as unknown as Harness).__IL__;
      const ctl = h.sim.getState().ctl!;
      h.sim.getState().set({ paused: true });
      ctl.restart();
      await new Promise((r) => setTimeout(r, 100));
      for (let i = 0; i < steps; i++) {
        if (lock && i === at && !ctl.releaseAt(lock)) throw new Error("Trava não solta");
        ctl.stepOnce();
        const until = performance.now() + 3000;
        while (ctl.timeline().latest * 240 < i + 1 - 0.01) {
          if (performance.now() > until) throw new Error(`Passo ${i + 1} não chegou`);
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    },
    { lock, at, steps },
  );
}

test("gaveta com a categoria Ciclo · 844x390", async ({ page }) => {
  await open(page, fixture("capsula-livre"));
  await page.evaluate(() => (window as unknown as Harness).__IL__.ui.getState().setSheet("drawer"));
  const group = page.getByRole("list", { name: "Ciclo" });
  await group.scrollIntoViewIfNeeded();
  await expect(group.getByRole("button")).toHaveCount(3);
  await expect(group.getByRole("button", { name: /^Cápsula/ })).toBeVisible();
  await page.screenshot({ path: `${DIR}/gaveta-ciclo-844x390.png` });
});

test("cartão da cápsula e O que é? · 844x390", async ({ page }) => {
  const scene = fixture("capsula-livre");
  await open(page, scene);
  const kase = scene.parts.find((p) => p.capsule)!;
  await page.evaluate((id) => {
    const ui = (window as unknown as Harness).__IL__.ui.getState();
    ui.select({ kind: "part", id });
    ui.setSheet("card");
  }, kase.id);
  const sec = page.getByRole("region", { name: "Cápsula" });
  await expect(sec).toContainText("Carregada");
  await expect(sec.getByRole("button", { name: "Média" })).toHaveAttribute("aria-pressed", "true");
  await sec.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${DIR}/cartao-capsula-844x390.png` });
  await sec.getByRole("button", { name: "O que é?" }).click();
  await expect(page.locator(".explain[data-kind=capsule]")).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${DIR}/o-que-e-capsula-844x390.png` });
});

test("cápsula carregada de perto (Montar)", async ({ page }) => {
  const scene = fixture("capsula-no-cano");
  await open(page, scene, { width: 1440, height: 900 });
  const kase = scene.parts.find((p) => p.capsule)!;
  const clip = await clipAround(page, scene, kase.id, 18);
  await page.screenshot({ path: `${DIR}/capsula-carregada.png`, clip });
});

/** O ponto da trava do gatilho (o percussor armado) no mundo. */
function searPoint(scene: Scene): [number, number] {
  const lock = scene.links.find((l) => l.kind === "lock");
  if (!lock || lock.kind !== "lock") throw new Error("sem trava");
  const p = scene.parts.find((q) => q.id === lock.b)!;
  return [p.x + lock.at[0], p.y + lock.at[1]];
}

test("estojo deflagrado de perto (Testar, depois do ciclo)", async ({ page }) => {
  const scene = fixture("disparo-extracao");
  await open(page, scene, { width: 1440, height: 900 }, "simulate");
  await playTrigger(page, searPoint(scene), 24, 132);
  await page.waitForTimeout(300);
  const kase = scene.parts.find((p) => p.capsule)!;
  // o estojo ejetado ficou deitado sobre o ferrolho fechado: recorta em volta dele
  const at = await page.evaluate((id) => {
    const h = (window as unknown as { __IL__: { sim: typeof useSimStore } }).__IL__;
    const ctl = h.sim.getState().ctl!;
    return ctl.capsuleFired(id);
  }, kase.id);
  expect(at).toBe(true);
  const pos = { ...kase, x: kase.x - 36.7, y: -8.2 };
  const clip = await clipAround(page, { ...scene, parts: [pos] }, kase.id, 20);
  await page.screenshot({ path: `${DIR}/capsula-deflagrada.png`, clip });
});

test("extração e ejeção em Lento, 4 quadros", async ({ page }) => {
  const scene = fixture("disparo-extracao");
  await open(page, scene, { width: 1440, height: 900 }, "simulate");
  await page.evaluate(() =>
    (window as unknown as { __IL__: { sim: typeof useSimStore } }).__IL__.sim.getState().ctl!.setSpeed(0.05),
  );
  await playTrigger(page, searPoint(scene), 24, 60);
  const frames: [string, number][] = [
    ["1-disparo", 0.106],
    ["2-extracao", 0.118],
    ["3-ejetor", 0.129],
    ["4-ejecao", 0.146],
  ];
  const center = { ...scene.parts.find((p) => p.capsule)!, x: -24, y: -6 };
  for (const [name, t] of frames) {
    await page.evaluate(
      (t) =>
        (window as unknown as { __IL__: { sim: typeof useSimStore } }).__IL__.sim.getState().ctl!.preview(t),
      t,
    );
    await page.waitForTimeout(250);
    const clip = await clipAround(page, { ...scene, parts: [center] }, center.id, 48);
    await page.screenshot({ path: `${DIR}/sequencia-${name}.png`, clip });
  }
});

for (const viewport of [PHONE, { width: 1440, height: 900 }])
  test(`painel de instrumentos da disparo-extracao · ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    const scene = fixture("disparo-extracao");
    await open(page, scene, viewport, "simulate");
    await page.getByRole("button", { name: "Ver instrumentos", exact: true }).click();
    await playTrigger(page, searPoint(scene), 24, 132);
    await page.evaluate(() =>
      (window as unknown as { __IL__: { sim: typeof useSimStore } }).__IL__.sim.getState().ctl!.scrub(0.4),
    );
    await page.waitForTimeout(300);
    const panel = page.getByRole("region", { name: "Instrumentos" });
    await expect(panel).toContainText("Cápsula · pressão");
    await expect(panel).toContainText("Extrator · força na garra");
    await expect(panel.locator(".instrument-chart__at")).toContainText("na saída");
    await expect(page.getByRole("button", { name: "Experimente comparar" })).toHaveCount(0);
    await page.screenshot({
      path: `${DIR}/instrumentos-disparo-extracao-${viewport.width}x${viewport.height}.png`,
    });
  });
