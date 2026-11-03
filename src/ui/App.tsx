import { useEffect, useState } from "react";
import { Panel, type LayerSummary } from "./Panel";
import { Stage } from "./Stage";
import { ToolBar } from "./ToolBar";
import { TopBar } from "./TopBar";

// Cena vazia provisória; o modelo da cena entra no item 2 e o editor no item 7.
const LAYERS: LayerSummary[] = [{ id: "L1", name: "Fundo", parts: 0 }];

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export function App() {
  const route = useHashRoute();
  if (route === "#bench") {
    return <p className="route-missing">A página de medição entra no item 4.</p>;
  }
  return (
    <div className="shell">
      <TopBar title="Projeto sem nome" />
      <Stage figure={1} title="Projeto sem nome" />
      <ToolBar />
      <Panel layers={LAYERS} activeLayer="L1" />
    </div>
  );
}
