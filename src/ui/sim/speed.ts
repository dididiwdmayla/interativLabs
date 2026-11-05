import { REAL_NOTICE_KEY, REAL_SPEED, type Speed } from "@/sim/pacing";

let shown = false;

/**
 * A frase de Real ("Tempo real: peças pequenas se movem rápido de
 * verdade.") aparece uma vez por aparelho: true na primeira vez que a
 * pessoa escolhe Real. Sem armazenamento, uma vez por sessão.
 */
export function firstRealChoice(s: Speed): boolean {
  if (s !== REAL_SPEED || shown) return false;
  shown = true;
  try {
    if (window.localStorage.getItem(REAL_NOTICE_KEY)) return false;
    window.localStorage.setItem(REAL_NOTICE_KEY, "1");
  } catch {
    // sem armazenamento: mostra nesta sessão
  }
  return true;
}
