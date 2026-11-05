/**
 * Toque com vários dedos (docs/arquitetura.md §6, "Gestos"): dois dedos
 * desfazem, três refazem. Vale como toque curto quando nenhum dedo ficou
 * mais de 250 ms encostado nem andou mais de 10 px. Sem DOM: o palco passa
 * os eventos de ponteiro já em px.
 */

export const MULTI_TAP_MS = 250;
export const MULTI_TAP_PX = 10;

interface Finger {
  x0: number;
  y0: number;
  t0: number;
  moved: boolean;
}

export class MultiTap {
  private fingers = new Map<number, Finger>();
  private max = 0;
  private spoiled = false;

  down(id: number, x: number, y: number, t: number): void {
    if (this.fingers.size === 0) {
      this.max = 0;
      this.spoiled = false;
    }
    this.fingers.set(id, { x0: x, y0: y, t0: t, moved: false });
    this.max = Math.max(this.max, this.fingers.size);
  }

  move(id: number, x: number, y: number): void {
    const f = this.fingers.get(id);
    if (f && Math.hypot(x - f.x0, y - f.y0) > MULTI_TAP_PX) this.spoiled = true;
  }

  /** Dedo solto. Devolve 2 ou 3 quando o último dedo de um toque múltiplo curto sai; senão 0. */
  up(id: number, t: number): number {
    const f = this.fingers.get(id);
    if (!f) return 0;
    if (t - f.t0 > MULTI_TAP_MS) this.spoiled = true;
    this.fingers.delete(id);
    if (this.fingers.size > 0) return 0;
    const n = this.spoiled ? 0 : this.max;
    this.max = 0;
    return n === 2 || n === 3 ? n : 0;
  }

  cancel(id: number): void {
    this.spoiled = true;
    this.fingers.delete(id);
  }

  /** algum toque múltiplo ainda pode valer */
  get pending(): boolean {
    return this.fingers.size >= 2 && !this.spoiled;
  }
}
