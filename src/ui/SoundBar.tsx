import { useEffect } from "react";
import { useUiStore } from "@/editor/useUiStore";
import { useSoundPrefs } from "@/sound";
import { ToolStrip } from "./ToolStrip";

/**
 * Faixa do Som (Parte S): Música e Efeitos ligam e desligam separados, salvos
 * no aparelho. Mesmo `ToolStrip` do Martelo, do Lápis e das camadas em cores;
 * nada aqui muda a cena. No Montar fica na borda de baixo; no Testar, na de
 * cima (a de baixo é da simulação).
 */
export function SoundBar() {
  const prefs = useSoundPrefs((s) => s.prefs);
  const set = useSoundPrefs((s) => s.setPrefs);
  const mode = useUiStore((s) => s.mode);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") useUiStore.getState().setSoundBar(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const phrase = `Música ${prefs.music ? "ligada" : "desligada"} · Efeitos ${prefs.effects ? "ligados" : "desligados"}`;
  return (
    <ToolStrip
      label="Som"
      edge={mode === "simulate" ? "top" : "bottom"}
      mode="cycle"
      phrase={phrase}
      groups={[
        {
          name: "Música",
          items: [
            {
              id: "music",
              label: "Música",
              icon: "music",
              pressed: prefs.music,
              onClick: () => set({ music: !prefs.music }),
            },
          ],
        },
        {
          name: "Efeitos",
          items: [
            {
              id: "effects",
              label: "Efeitos",
              icon: "effects",
              pressed: prefs.effects,
              onClick: () => set({ effects: !prefs.effects }),
            },
          ],
        },
        {
          name: "Fechar",
          items: [
            {
              id: "close",
              label: "Fechar",
              icon: "close",
              hint: "Fechar o som",
              onClick: () => useUiStore.getState().setSoundBar(false),
            },
          ],
        },
      ]}
    />
  );
}
