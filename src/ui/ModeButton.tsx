import { useUiStore } from "@/editor/useUiStore";

/**
 * Montar / Testar num botão só. No Montar ele é o principal (o único bloco
 * invertido da tela: fundo ink, texto stage) e diz "Testar"; no Testar fica
 * em contorno e diz "Montar".
 */
export function ModeButton({ className = "" }: { className?: string }) {
  const mode = useUiStore((s) => s.mode);
  const toggle = useUiStore((s) => s.toggleMode);
  const testing = mode === "simulate";
  return (
    <button
      type="button"
      className={`btn ${testing ? "btn--outline" : "btn--primary"} ${className}`}
      aria-label={testing ? "Montar: voltar a editar" : "Testar: ligar a física"}
      onClick={toggle}
    >
      {testing ? "Montar" : "Testar"}
    </button>
  );
}
