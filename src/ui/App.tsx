import { Suspense, lazy, useEffect, useState } from "react";
import { Panel, type LayerSummary } from "./Panel";
import { Stage } from "./Stage";
import { ToolBar } from "./ToolBar";
import { TopBar } from "./TopBar";

// A bancada de motores é carregada sob demanda: o código do comparativo não
// entra no pacote principal.
const BenchPage = lazy(() => import("./bench/BenchPage"));
// O laboratório (cenas de teste no motor do app) também.
const LabPage = lazy(() => import("./lab/LabPage"));

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
    return (
      <Suspense fallback={<p className="route-missing">Carregando a bancada…</p>}>
        <BenchPage />
      </Suspense>
    );
  }
  if (route === "#lab") {
    return (
      <Suspense fallback={<p className="route-missing">Carregando o laboratório…</p>}>
        <LabPage />
      </Suspense>
    );
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
