/**
 * Preferências de som, salvas no aparelho (localStorage, tudo em try/catch).
 * Música e efeitos ligam e desligam separados; o padrão é tudo ligado, mas
 * nada toca antes do primeiro gesto.
 */

export interface SoundPrefs {
  music: boolean;
  effects: boolean;
}

export const DEFAULT_PREFS: SoundPrefs = { music: true, effects: true };

export const PREFS_KEY = "il.sound";

export function parsePrefs(raw: string | null): SoundPrefs {
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const v = JSON.parse(raw) as Partial<SoundPrefs> | null;
    return {
      music: typeof v?.music === "boolean" ? v.music : DEFAULT_PREFS.music,
      effects: typeof v?.effects === "boolean" ? v.effects : DEFAULT_PREFS.effects,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function loadPrefs(): SoundPrefs {
  try {
    return parsePrefs(window.localStorage.getItem(PREFS_KEY));
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: SoundPrefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}
