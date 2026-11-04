import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useUiStore } from "@/editor/useUiStore";
import type { StageNodes } from "@/render/nodes";
import { prepareScene } from "@/render/prepare";
import { ExampleMenu } from "./ExampleMenu";
import { Panel } from "./Panel";
import { DEFAULT_EXAMPLE, openExample } from "./scenes/examples";
import { useSimulation } from "./sim/useSimulation";
import { Stage } from "./Stage";
import { ToolBar } from "./ToolBar";
import { TopBar } from "./TopBar";

// A bancada de motores, o laboratório e a página de desempenho são
// carregados sob demanda: não entram no pacote principal.
const BenchPage = lazy(() => import("./bench/BenchPage"));
const LabPage = lazy(() => import("./lab/LabPage"));
const PerfPage = lazy(() => import("./perf/PerfPage"));

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

function Workbench() {
  const current = useUiStore((s) => s.current);
  const mode = useUiStore((s) => s.mode);
  const selection = useUiStore((s) => s.selection);
  const select = useUiStore((s) => s.select);
  const activeLayer = useUiStore((s) => s.activeLayer);
  const xray = useUiStore((s) => s.xray);
  const [nodes, setNodes] = useState<StageNodes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const model = useMemo(() => (current ? prepareScene(current.scene) : null), [current]);

  // a cena padrão aparece montada, no Editar, ao abrir o app
  useEffect(() => {
    if (!useUiStore.getState().current) openExample(DEFAULT_EXAMPLE).catch((e: Error) => setError(e.message));
  }, []);

  useSimulation(mode === "simulate", nodes);

  const title = current?.scene.meta.title ?? (error ? "Erro ao abrir" : "Carregando…");
  return (
    <div className="shell" data-mode={mode}>
      <TopBar title={title} />
      <Stage
        model={model}
        figure={current?.figure ?? 1}
        serial={current?.serial ?? 0}
        mode={mode}
        selection={selection}
        activeLayer={activeLayer}
        layerMode={xray ? "xray" : mode === "simulate" ? "all" : "focus"}
        onSelect={select}
        onNodes={setNodes}
      />
      <ToolBar />
      <Panel model={model} />
      <ExampleMenu />
      {error && <p className="shell__error">{error}</p>}
    </div>
  );
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
  if (route === "#lab" || route.startsWith("#lab/")) {
    return (
      <Suspense fallback={<p className="route-missing">Carregando o laboratório…</p>}>
        <LabPage />
      </Suspense>
    );
  }
  if (route === "#perf") {
    return (
      <Suspense fallback={<p className="route-missing">Carregando a medição…</p>}>
        <PerfPage />
      </Suspense>
    );
  }
  return <Workbench />;
}
