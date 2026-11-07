import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Scene } from "@/model/types";
import { NO_LOOK, linkShow, spreadBox, spreadOffset, touchModel, badgeSpot } from "./look";
import { prepareScene } from "./prepare";
import { MENUS, VIEW_MENU_MAX, menuItems } from "@/editor/menus";

const lancador = () =>
  prepareScene(JSON.parse(readFileSync("scenes/examples/lancador-bancada.json", "utf8")) as Scene);

describe("vista para entender (E2d)", () => {
  it("afastar: a camada 1 fica, as de cima sobem para a direita na proporção do índice", () => {
    expect(spreadOffset(0, 30)).toEqual([0, 0]);
    expect(spreadOffset(2, 30)).toEqual([48, -36]);
    const b = spreadBox([0, 0, 100, 50], 4, 30, 5);
    expect(b).toEqual([0, -54 / 5, 100 + 72 / 5, 50 + 54 / 5]);
  });

  it("isolar: só as ligações que tocam a ativa; o toque só alcança a ativa", () => {
    const m = lancador();
    const look = { ...NO_LOOK, isolate: true };
    for (const lm of m.links) {
      const touches = lm.span[0] <= 3 && 3 <= lm.span[1];
      expect(linkShow(lm, look, 3)).toBe(touches ? "shown" : "gone");
    }
    const t = touchModel(m, look, 3);
    expect(t.partList.every((p) => p.layer === 3)).toBe(true);
    expect(t.partList.length).toBe(2);
    expect(t.scene).toBe(m.scene);
  });

  it("esconder: ligação só de escondidas some; com uma visível fica com a ponta tracejada", () => {
    const m = lancador();
    const id = (name: string) => m.scene.parts.find((p) => p.name === name)!.id;
    const ferrolho = id("Ferrolho");
    const look = { ...NO_LOOK, hidden: new Set([ferrolho, id("Luva")]) };
    const screw = m.links.find((l) => l.link.kind === "screw" && l.link.b === id("Luva"))!;
    expect(linkShow(screw, look, 1)).toBe("gone");
    const slider = m.links.find((l) => l.link.kind === "slider" && l.link.b === ferrolho)!;
    expect(linkShow(slider, look, 1)).toBe("half");
    const t = touchModel(m, look, 1);
    expect(t.parts.has(ferrolho)).toBe(false);
    expect(m.parts.has(ferrolho)).toBe(true);
  });

  it("o selo fica dentro da peça, no ponto mais folgado", () => {
    const m = lancador();
    const placa = [...m.parts.values()].find((p) => p.part.name === "Placa de base")!;
    const s = badgeSpot(placa);
    expect(s.room).toBeGreaterThan(20);
  });

  it("o menu Vista não passa de 8 itens (no Montar e no Testar)", () => {
    const ctx = {
      hasSelection: false,
      xray: false,
      hint: false,
      lefty: false,
      fullscreen: false,
      layers: false,
      hideMode: false,
      trail: false,
      sound: false,
    };
    for (const mode of ["edit", "simulate"] as const)
      expect(menuItems("view", { ...ctx, mode }).length).toBeLessThanOrEqual(VIEW_MENU_MAX);
    expect(MENUS.view.items.some((i) => i.id === "examples")).toBe(false);
  });
});
