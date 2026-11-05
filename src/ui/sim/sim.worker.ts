import { loadBox2d } from "@/engine/box2d/load";
import type { Scene } from "@/model/types";
import { SimSession, type PendingInput, type SimEvent } from "@/sim/session";

/**
 * A física do modo Simular num Web Worker: a sessão (Box2D, passo fixo,
 * entradas, gravação e volta por reexecução) roda aqui, fora do thread
 * que desenha. O thread principal pede N passos por quadro e recebe os
 * quadros de cada passo, que ele espelha na própria gravação.
 */

export type SimRequest =
  | { t: "init"; scene: Scene }
  | { t: "run"; id: number; steps: number; inputs: PendingInput[] }
  | { t: "rewind"; id: number; step: number }
  | { t: "restart"; id: number };

export type SimReply =
  | { t: "ready"; partIds: string[]; chamberIds: string[]; lockIds: string[]; frame: Float32Array }
  | {
      t: "frames";
      id: number;
      /** passo do primeiro quadro */
      from: number;
      count: number;
      data: Float32Array;
      events: SimEvent[];
      /** ms de física (passos + snapshots) */
      physics: number;
    }
  | { t: "rewound"; id: number; step: number; ms: number }
  | { t: "error"; message: string };

const post = (m: SimReply, transfer: Transferable[] = []) =>
  (self as unknown as { postMessage(m: unknown, t: Transferable[]): void }).postMessage(m, transfer);

let session: SimSession | null = null;

function frames(id: number, from: number, count: number, events: SimEvent[], physics: number) {
  if (!session) return;
  const stride = session.rec.stride;
  const data = new Float32Array(stride * count);
  for (let i = 0; i < count; i++) session.rec.copyFrame(from + i, data, i * stride);
  post({ t: "frames", id, from, count, data, events, physics }, [data.buffer]);
}

self.onmessage = async (e: MessageEvent<SimRequest>) => {
  const m = e.data;
  try {
    if (m.t === "init") {
      const make = await loadBox2d();
      session?.dispose();
      session = new SimSession(make, m.scene);
      const frame = new Float32Array(session.rec.stride);
      session.rec.copyFrame(0, frame, 0);
      post(
        {
          t: "ready",
          partIds: [...session.rec.partIndex.keys()],
          chamberIds: [...session.rec.chamberIndex.keys()],
          lockIds: [...session.rec.lockIndex.keys()],
          frame,
        },
        [frame.buffer],
      );
      return;
    }
    if (!session) return;
    if (m.t === "run") {
      session.enqueue(m.inputs);
      const steps = Math.max(0, Math.floor(m.steps));
      const t0 = performance.now();
      const from = session.step + 1;
      for (let i = 0; i < steps; i++) session.advance();
      const physics = performance.now() - t0;
      frames(
        m.id,
        from,
        steps,
        session.events.filter((x) => x.step >= from),
        physics,
      );
    } else if (m.t === "rewind") {
      const t0 = performance.now();
      const r = session.rewind(m.step);
      while (!r.advance(1e9)) {
        /* no worker, de uma vez */
      }
      post({ t: "rewound", id: m.id, step: session.step, ms: performance.now() - t0 });
    } else if (m.t === "restart") {
      session.restart();
      frames(m.id, 0, 1, [], 0);
    }
  } catch (err) {
    post({ t: "error", message: (err as Error)?.message ?? String(err) });
  }
};
