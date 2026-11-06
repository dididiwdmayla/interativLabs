import { readFileSync, writeFileSync } from "node:fs";
import type { Scene } from "@/model/types";
import { hammerPoint } from "@/editor/hammer";
import { dragLink } from "@/editor/hammerDrag";
import { prepareScene } from "@/render/prepare";

export function main() {
  const scene = JSON.parse(readFileSync("scenes/examples/lancador-bancada.json", "utf8")) as Scene;
  const original = scene.links.find((l) => l.kind === "chamber");
  if (original?.kind !== "chamber") throw new Error("Câmara ausente");
  scene.links = scene.links.filter((l) => l.id !== original.id && l.kind !== "sensor");
  scene.settings.snap.on = false;
  const model = prepareScene(scene);
  const a = hammerPoint(model, "chamber", original.at, 1, 0.001);
  const b = hammerPoint(model, "chamber", [original.at[0] + original.length, original.at[1]], 1, 0.001);
  const found = dragLink(model, "chamber", a, b, 1);
  writeFileSync(
    "docs/decisoes/camara-e2b.json",
    JSON.stringify({ original, detected: found, host: a.b?.part.name }, null, 2) + "\n",
  );
}
