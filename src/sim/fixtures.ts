import { loadScene } from "@/model/scene";
import type { Scene } from "@/model/types";
import type { FixtureScript } from "./script";

/**
 * Cenas de teste (scenes/fixtures/<grupo>/) e exemplos (scenes/examples/).
 * Os roteiros vêm junto; as cenas carregam sob demanda.
 */

const scripts = import.meta.glob<FixtureScript>("../../scenes/fixtures/*/*.test.json", {
  eager: true,
  import: "default",
});
const scenes = import.meta.glob<unknown>(
  ["../../scenes/fixtures/*/*.scene.json", "../../scenes/examples/*.json"],
  {
    import: "default",
  },
);

/** Ordem dos grupos na lista do laboratório. */
export const GROUPS: { id: string; label: string }[] = [
  { id: "exemplos", label: "Exemplos" },
  { id: "fixacoes", label: "Fixações" },
  { id: "multicamada", label: "Multicamada" },
  { id: "molas", label: "Molas" },
  { id: "rasgos", label: "Furos e rasgos" },
  { id: "gas", label: "Gás" },
  { id: "calibracao", label: "Calibração" },
  { id: "desempenho", label: "Desempenho" },
];

export interface FixtureEntry {
  id: string;
  script: FixtureScript;
  load(): Promise<Scene>;
}

function join(dir: string, rel: string): string {
  const parts = dir.split("/");
  for (const seg of rel.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

const groupOrder = (g: string) => {
  const i = GROUPS.findIndex((x) => x.id === g);
  return i < 0 ? GROUPS.length : i;
};

export const FIXTURES: FixtureEntry[] = Object.entries(scripts)
  .map(([path, script]) => {
    const key = join(path.slice(0, path.lastIndexOf("/")), script.scene);
    return {
      id: script.id,
      script,
      async load(): Promise<Scene> {
        const loader = scenes[key];
        if (!loader) throw new Error(`Cena ${key} não encontrada`);
        const r = loadScene(await loader());
        if (!r.ok)
          throw new Error(
            `Cena ${script.id} inválida: ${r.issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`,
          );
        return r.scene;
      },
    };
  })
  .sort((a, b) => groupOrder(a.script.group) - groupOrder(b.script.group) || a.id.localeCompare(b.id));
