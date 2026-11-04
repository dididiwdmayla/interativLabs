import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { loadScene } from "@/model/scene";
import { StageNodes } from "./nodes";
import { prepareScene } from "./prepare";
import { SceneSvg } from "./SceneSvg";

/**
 * A montagem da cena em SVG é estável: para cada exemplo, a estrutura
 * (elementos, classes e as marcas data-*; sem coordenadas) fica igual ao
 * snapshot. Mudou o desenho de propósito? Atualize com `vitest -u`.
 */

const EXAMPLES = (JSON.parse(readFileSync("scenes/examples/index.json", "utf8")) as { order: string[] })
  .order;

function structure(html: string): string {
  const out: string[] = [];
  let depth = 0;
  const re = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, close, tag, attrs, self] = m;
    if (close) {
      depth--;
      continue;
    }
    const keep = [...attrs!.matchAll(/\s(class|data-[a-z]+|href|fill)="([^"]*)"/g)]
      .map(([, k, v]) => `${k}=${k === "fill" && !v!.startsWith("url") ? "…" : v}`)
      .join(" ");
    out.push(`${"  ".repeat(depth)}${tag}${keep ? " " + keep : ""}`);
    if (!self) depth++;
  }
  return out.join("\n").replace(/_r_[0-9a-z]+_/g, "U");
}

describe("montagem da cena em SVG", () => {
  for (const id of EXAMPLES) {
    it(`estrutura estável: ${id}`, () => {
      const r = loadScene(JSON.parse(readFileSync(`scenes/examples/${id}.json`, "utf8")));
      if (!r.ok) throw new Error(id);
      const model = prepareScene(r.scene);
      const nodes = new StageNodes(model);
      const html = renderToStaticMarkup(
        <SceneSvg
          model={model}
          nodes={nodes}
          uid="U"
          zoom={1}
          fitZoom={1}
          mode="edit"
          layerMode="focus"
          active={model.layers.length - 1}
          selection={null}
          size={{ width: 390, height: 700 }}
        />,
      );
      // uma folha por camada e tipo, cada peça uma vez, ferragens por <use>
      const parts = html.match(/data-part="/g)?.length ?? 0;
      expect(parts).toBe(model.partList.length);
      expect(structure(html)).toMatchSnapshot();
    });
  }
});
