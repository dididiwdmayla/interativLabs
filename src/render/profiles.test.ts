import { it, expect } from "vitest";
import { profilesScene } from "../../scripts/fixtures/multicamada";
import { prepareScene } from "@/render/prepare";
import { drawnFrame } from "@/render/nodes";
import { partAt } from "@/render/hit";
import { thumbnailSvg } from "@/render/thumbnail";
it("renders and hits both surfaces with a shared pose and includes them in thumbnails", () => {
  const { scene, piece } = profilesScene();
  const model = prepareScene(scene);
  expect(model.partList.filter((m) => m.part.id === piece.id)).toHaveLength(2);
  expect(partAt(model, drawnFrame(model), [8, 0], { layer: (i) => i === 2 })).toBe(piece.id);
  expect(partAt(model, drawnFrame(model), [-8, 0], { layer: (i) => i === 0 })).toBe(piece.id);
  const svg = thumbnailSvg(model, { width: 200, height: 100 });
  for (const m of model.partList) expect(svg).toContain(m.d);
});
