import { useSyncExternalStore } from "react";

/** Resultado de uma media query, atualizado quando muda. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (on) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", on);
      return () => m.removeEventListener("change", on);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Largura a partir da qual o painel lateral fica fixo. */
export const WIDE_QUERY = "(min-width: 1100px)";
