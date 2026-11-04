import { loadScene } from "@/model/scene";
import type { Scene } from "@/model/types";
import type { BenchScript } from "./types";
import b1 from "../../scenes/fixtures/bench/01-lancador.bench.json";
import s1 from "../../scenes/fixtures/bench/01-lancador.scene.json";
import b2 from "../../scenes/fixtures/bench/02-trava.bench.json";
import s2 from "../../scenes/fixtures/bench/02-trava.scene.json";
import b3 from "../../scenes/fixtures/bench/03-engrenagens.bench.json";
import s3 from "../../scenes/fixtures/bench/03-engrenagens.scene.json";
import b4 from "../../scenes/fixtures/bench/04-pilha.bench.json";
import s4 from "../../scenes/fixtures/bench/04-pilha.scene.json";
import b5 from "../../scenes/fixtures/bench/05-corrente.bench.json";
import s5 from "../../scenes/fixtures/bench/05-corrente.scene.json";
import b6 from "../../scenes/fixtures/bench/06-pinhao-cremalheira.bench.json";
import s6 from "../../scenes/fixtures/bench/06-pinhao-cremalheira.scene.json";
import b7 from "../../scenes/fixtures/bench/07-bala.bench.json";
import s7 from "../../scenes/fixtures/bench/07-bala.scene.json";
import b8 from "../../scenes/fixtures/bench/08-escalas.bench.json";
import s8 from "../../scenes/fixtures/bench/08-escalas.scene.json";

/** As oito cenas de medição (scenes/fixtures/bench/, cena v1), migradas para a v2 ao abrir. */
export interface BenchCase {
  script: BenchScript;
  scene: Scene;
}

const raw: [unknown, unknown][] = [
  [b1, s1],
  [b2, s2],
  [b3, s3],
  [b4, s4],
  [b5, s5],
  [b6, s6],
  [b7, s7],
  [b8, s8],
];

export function benchCases(): BenchCase[] {
  return raw.map(([b, s]) => {
    const script = b as BenchScript;
    const v = loadScene(s);
    if (!v.ok)
      throw new Error(
        `Cena ${script.id} inválida: ${v.issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`,
      );
    return { script, scene: v.scene };
  });
}
