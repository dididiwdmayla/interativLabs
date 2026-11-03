import { useUiStore } from "@/editor/useUiStore";

interface ModeButtonProps {
  className?: string;
}

/** Botão principal: o único elemento invertido da tela (fundo ink, texto stage). */
export function ModeButton({ className = "" }: ModeButtonProps) {
  const mode = useUiStore((s) => s.mode);
  const toggle = useUiStore((s) => s.toggleMode);
  const simulating = mode === "simulate";
  return (
    <button
      type="button"
      className={`btn ${simulating ? "btn--outline" : "btn--primary"} ${className}`}
      aria-pressed={simulating}
      onClick={toggle}
    >
      {simulating ? "Editar" : "Simular"}
    </button>
  );
}
