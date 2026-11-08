import type { Scene } from "@/model/types";
import { prepareScene } from "./prepare";
import { poseTransform, type FrameSource, type StageNodes } from "./nodes";
/** Contours only: no hatch, shadow or event effects. */
export class Ghost {
  private paths: { id: string; el: SVGPathElement }[] = [];
  constructor(nodes: StageNodes, scene: Scene) {
    const world = [...nodes.worlds.values()].at(-1);
    if (!world) return;
    for (const p of prepareScene(scene).partList) {
      if (scene.layers[p.layer]?.visible === false) continue;
      const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
      el.setAttribute("d", p.d);
      el.setAttribute("class", "comparison-ghost");
      el.setAttribute("vector-effect", "non-scaling-stroke");
      world.append(el);
      this.paths.push({ id: p.part.id, el });
    }
  }
  write(frame: FrameSource, visible: boolean, hidden: string[]) {
    for (const { id, el } of this.paths) {
      const pose = frame.pose(id);
      el.style.display = visible && pose && !hidden.includes(id) ? "" : "none";
      if (pose) el.setAttribute("transform", poseTransform(pose));
    }
  }
  dispose() {
    for (const { el } of this.paths) el.remove();
  }
}
