/**
 * Tela cheia e orientação (conferido no @mdn/browser-compat-data 8.1.8,
 * de 02/11/2026):
 * - Fullscreen API: Chrome Android desde a 71; Safari do iPad desde a
 *   16.4 (com prefixo webkit desde a 12); **não existe no iPhone**.
 * - Screen Orientation `lock()`: só Chrome Android (e Firefox Android
 *   144+); Safari não tem. Exige a página em tela cheia (ou instalada) e
 *   pode recusar: a falha é silenciosa.
 * - No iPhone, a tela cheia vem do app instalado pela tela de início
 *   (`display: standalone` no manifesto).
 */

type FsDoc = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> };

/** O navegador tem tela cheia de página (Android, iPad, computador). */
export function canFullscreen(): boolean {
  const d = document as FsDoc;
  return Boolean(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  const d = document as FsDoc;
  return Boolean(d.fullscreenElement || d.webkitFullscreenElement);
}

/** Aberto pela tela de início (app instalado): já sem as barras do navegador. */
export function isStandalone(): boolean {
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  } catch {
    // matchMedia ausente
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone ou iPod (o iPad moderno se apresenta como Mac, com toque). */
export function isIPhone(): boolean {
  return /iPhone|iPod/.test(navigator.userAgent);
}

/** Entra (ou sai) da tela cheia; no Android, tenta travar em paisagem. Nunca lança. */
export async function toggleFullscreen(): Promise<"on" | "off" | "unsupported"> {
  const d = document as FsDoc;
  try {
    if (isFullscreen()) {
      if (d.exitFullscreen) await d.exitFullscreen();
      else await d.webkitExitFullscreen?.();
      return "off";
    }
    if (!canFullscreen()) return "unsupported";
    const el = document.documentElement as FsEl;
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
    else await el.webkitRequestFullscreen?.();
  } catch {
    return isFullscreen() ? "on" : "unsupported";
  }
  try {
    await (screen.orientation as LockableOrientation | undefined)?.lock?.("landscape");
  } catch {
    // sem trava de orientação (iPad, computador) ou recusada: segue sem travar
  }
  return "on";
}
