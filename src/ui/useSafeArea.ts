import { useEffect, useState } from "react";

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const ZERO: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Áreas seguras (`env(safe-area-inset-*)`) em px, medidas num elemento de
 * prova: o entalhe da câmera em paisagem e a barra de gestos. Atualiza ao
 * girar e ao redimensionar.
 */
export function useSafeArea(): Insets {
  const [ins, setIns] = useState<Insets>(ZERO);
  useEffect(() => {
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
      "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    document.body.appendChild(probe);
    const read = () => {
      const cs = getComputedStyle(probe);
      const next = {
        top: parseFloat(cs.paddingTop) || 0,
        right: parseFloat(cs.paddingRight) || 0,
        bottom: parseFloat(cs.paddingBottom) || 0,
        left: parseFloat(cs.paddingLeft) || 0,
      };
      setIns((s) =>
        s.top === next.top && s.right === next.right && s.bottom === next.bottom && s.left === next.left
          ? s
          : next,
      );
    };
    read();
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
      probe.remove();
    };
  }, []);
  return ins;
}
