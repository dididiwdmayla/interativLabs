import { useUiStore } from "@/editor/useUiStore";
import { canFullscreen, isFullscreen, isIPhone, isStandalone, toggleFullscreen } from "./fullscreen";
import { stageApi } from "./stageApi";

/**
 * Ações da interface que não são comandos da cena (vista, modos, folhas).
 * Os menus de borda e o menu ☰ chamam por aqui.
 */

export async function fullscreenAction(): Promise<void> {
  const ui = useUiStore.getState();
  if (canFullscreen() || isFullscreen()) {
    const r = await toggleFullscreen();
    if (r === "unsupported") ui.notify("Este navegador não deixou entrar em tela cheia");
    return;
  }
  if (isStandalone()) {
    ui.notify("O app instalado já abre em tela cheia");
    return;
  }
  if (isIPhone()) {
    ui.setSheet("install");
    return;
  }
  ui.notify("Este navegador não tem tela cheia de página");
}

export function fitAction(): void {
  stageApi.get()?.fit();
}

export function xrayAction(): void {
  const ui = useUiStore.getState();
  ui.setXray(!ui.xray);
  ui.notify(ui.xray ? "Raio-x desligado" : "Raio-x: só os contornos");
}

export function tipsAction(): void {
  const ui = useUiStore.getState();
  ui.setHint(!ui.hint);
}

export function leftyAction(): void {
  const ui = useUiStore.getState();
  ui.setLefty(!ui.lefty);
  ui.notify(ui.lefty ? "Destro: menus como antes" : "Canhoto: menus e cantos trocados de lado");
}

export function examplesAction(): void {
  const ui = useUiStore.getState();
  ui.setMainTab("examples");
  ui.setSheet("main");
}

export function layersAction(): void {
  const ui = useUiStore.getState();
  ui.setLook({ open: !ui.look.open });
  if (ui.look.open) ui.notify("Camadas como desenhadas");
}

export function hideModeAction(): void {
  const ui = useUiStore.getState();
  ui.setHideMode(!ui.hideMode);
}

export function trailAction(): void {
  const ui = useUiStore.getState();
  ui.setTrail(!ui.trail);
  ui.notify(ui.trail ? "Rastro desligado" : "Rastro: o caminho recente das peças que se movem");
}

export function soundAction(): void {
  const ui = useUiStore.getState();
  ui.setSoundBar(!ui.soundBar);
}
