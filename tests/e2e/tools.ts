import type { Page } from "@playwright/test";

/**
 * Escolhe uma ferramenta na faixa (Martelo ou Lápis). Na faixa compacta os
 * grupos viram um seletor na ponta: toca nele até a ferramenta aparecer.
 */
export async function pickTool(page: Page, label: string): Promise<void> {
  const strip = page.locator(".toolstrip");
  for (let i = 0; i < 6; i++) {
    const tool = strip.getByRole("button", { name: label, exact: true });
    if (await tool.isVisible()) {
      await tool.click();
      return;
    }
    const selector = strip.locator(".toolstrip__selector");
    if (!(await selector.isVisible())) break;
    await selector.click();
  }
  throw new Error(`Ferramenta ${label} não encontrada na faixa`);
}

/** Toque com o dedo por CDP: pousa, segura `holdMs`, anda pelos pontos e solta. */
export async function touchPath(
  page: Page,
  points: [number, number][],
  opts: { holdMs?: number; stepMs?: number; beforeEnd?: () => Promise<void> } = {},
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const [first, ...rest] = points;
  if (!first) return;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: first[0], y: first[1] }],
  });
  if (opts.holdMs) await page.waitForTimeout(opts.holdMs);
  for (const p of rest) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: p[0], y: p[1] }] });
    if (opts.stepMs) await page.waitForTimeout(opts.stepMs);
  }
  await opts.beforeEnd?.();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}
