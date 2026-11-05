import type { Scene } from "@/model/types";
import type { HistoryState } from "./history";

/**
 * A pilha de desfazer da sessão, guardada no sessionStorage por projeto:
 * fechar e reabrir a aba (ou voltar a ela) mantém o desfazer. Só vale se a
 * cena salva for a mesma de agora (hash sem os metadados). Tudo em
 * try/catch: sem armazenamento, o desfazer vale até recarregar.
 */

const key = (id: string) => `il.hist.${id}`;

/** FNV-1a de 32 bits do JSON da cena sem `meta` (nome e datas mudam fora da pilha). */
export function sceneHash(scene: Scene): string {
  const s = JSON.stringify({ ...scene, meta: null });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16)}:${s.length}`;
}

export function saveHistory(id: string, scene: Scene, h: HistoryState): void {
  try {
    const store = window.sessionStorage;
    if (h.past.length === 0 && h.future.length === 0) {
      store.removeItem(key(id));
      return;
    }
    store.setItem(key(id), JSON.stringify({ hash: sceneHash(scene), past: h.past, future: h.future }));
  } catch {
    // cheio ou bloqueado: o desfazer vale só até recarregar
  }
}

export function loadHistory(id: string, scene: Scene): HistoryState | null {
  try {
    const raw = window.sessionStorage.getItem(key(id));
    if (!raw) return null;
    const v = JSON.parse(raw) as { hash: string; past: HistoryState["past"]; future: HistoryState["future"] };
    if (v.hash !== sceneHash(scene) || !Array.isArray(v.past) || !Array.isArray(v.future)) return null;
    return { past: v.past, future: v.future };
  } catch {
    return null;
  }
}

export function dropHistory(id: string): void {
  try {
    window.sessionStorage.removeItem(key(id));
  } catch {
    // nada a fazer
  }
}
