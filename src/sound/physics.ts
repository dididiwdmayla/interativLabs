import type { Id, Scene } from "@/model/types";
import type { SoundEvent } from "@/sim/session";
import {
  FAMILY_IDS,
  WindowLimiter,
  mapGas,
  mapImpact,
  partSounds,
  ventLevel,
  type PartSound,
} from "./mapping";
import type { SoundPlayer } from "./index";

/**
 * O som da física: recebe os eventos que o worker mandou junto com os
 * quadros (já no instante em que o desenho chega ao passo deles) e os
 * traduz em efeitos. Só toca na execução para a frente; quem chama não
 * entrega nada ao voltar ou arrastar a régua. O som nunca entra na
 * simulação nem no hash: lê eventos prontos e só escreve no tocador.
 */
export class PhysicsSound {
  private parts: Map<Id, PartSound>;
  private player: SoundPlayer;
  private limiter = new WindowLimiter();
  private venting = false;

  constructor(scene: Scene, player: SoundPlayer) {
    this.parts = partSounds(scene);
    this.player = player;
  }

  /** Eventos que o desenho acabou de alcançar. `nowMs` é o relógio do navegador. */
  play(list: readonly SoundEvent[], nowMs: number): void {
    for (const e of list) {
      switch (e.kind) {
        case "impact": {
          const a = this.parts.get(e.a);
          const b = this.parts.get(e.b);
          if (!a || !b) break;
          const cue = mapImpact(a, b, e.speed);
          if (cue && this.limiter.allow(nowMs))
            this.player.play(FAMILY_IDS[cue.family], { gain: cue.gain, cents: cue.cents });
          break;
        }
        case "fired": {
          const cue = mapGas(e.charge);
          this.player.play(cue.id, { gain: cue.gain });
          break;
        }
        case "unlocked":
          this.player.play("sfx-lock-release");
          break;
        case "flow": {
          const level = ventLevel(e.flow);
          this.venting = level > 0;
          this.player.setVent(level);
          break;
        }
      }
    }
  }

  /** Para o que for contínuo (pausa, régua, volta, saída). */
  silence(): void {
    if (!this.venting) return;
    this.venting = false;
    this.player.setVent(0);
  }

  reset(): void {
    this.silence();
    this.limiter.reset();
  }
}
