import { useEffect } from "react";
import { FIXTURES, GROUPS } from "@/sim/fixtures";
import { exposeLabHook } from "./labHook";

/**
 * Laboratório (/#lab): as cenas de teste e os exemplos rodando no motor do
 * app. Carregado sob demanda.
 */
export default function LabPage() {
  useEffect(() => {
    exposeLabHook();
  }, []);
  return (
    <main className="lab">
      <h1 className="lab__title">Laboratório</h1>
      {GROUPS.map((g) => {
        const items = FIXTURES.filter((f) => f.script.group === g.id);
        if (!items.length) return null;
        return (
          <section key={g.id}>
            <h2>{g.label}</h2>
            <ul>
              {items.map((f) => (
                <li key={f.id}>{f.script.title}</li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
