// GERADO por scripts/audio/build.mjs (npm run audio); não editar à mão.
// Tempos em segundos no arquivo convertido (o corte inicial já foi descontado).

export type AudioId =
  | "music-bench"
  | "sfx-stamp"
  | "sfx-stamp-soft"
  | "sfx-link"
  | "sfx-lock-release"
  | "sfx-mode"
  | "sfx-cut"
  | "sfx-ui"
  | "sfx-impact-1"
  | "sfx-impact-2"
  | "sfx-impact-3"
  | "sfx-impact-heavy-1"
  | "sfx-impact-heavy-2"
  | "sfx-impact-wood-1"
  | "sfx-impact-wood-2"
  | "sfx-impact-rubber"
  | "sfx-ratchet-1"
  | "sfx-ratchet-2"
  | "sfx-gas"
  | "sfx-pop-strong"
  | "sfx-vent-loop"
  | "sfx-case-drop-1"
  | "sfx-case-drop-2"
  | "sfx-valve"
  | "sfx-clock-tic"
  | "sfx-clock-tac";
export type MusicId = "music-bench";
export type SfxId =
  | "sfx-stamp"
  | "sfx-stamp-soft"
  | "sfx-link"
  | "sfx-lock-release"
  | "sfx-mode"
  | "sfx-cut"
  | "sfx-ui"
  | "sfx-impact-1"
  | "sfx-impact-2"
  | "sfx-impact-3"
  | "sfx-impact-heavy-1"
  | "sfx-impact-heavy-2"
  | "sfx-impact-wood-1"
  | "sfx-impact-wood-2"
  | "sfx-impact-rubber"
  | "sfx-ratchet-1"
  | "sfx-ratchet-2"
  | "sfx-gas"
  | "sfx-pop-strong"
  | "sfx-vent-loop"
  | "sfx-case-drop-1"
  | "sfx-case-drop-2"
  | "sfx-valve"
  | "sfx-clock-tic"
  | "sfx-clock-tac";

export interface AudioLoop {
  /** Trecho repetido, s */
  start: number;
  end: number;
  /** Crossfade de potência constante na emenda, s */
  crossfade: number;
}

export interface AudioEntry {
  id: AudioId;
  kind: "music" | "sfx";
  bus: "music" | "effects";
  /** URL no mesmo servidor, sob /audio/ */
  src: string;
  /** duração medida do arquivo convertido, s */
  duration: number;
  loop: AudioLoop | null;
  /** alvo de volume: LUFS integrado ou pico real (dBTP) nos efeitos curtos */
  target: { mode: "lufs" | "peak"; value: number };
  /** o que o arquivo convertido mede: volume integrado (null nos curtos) e pico real, dBTP */
  measured: { lufs: number | null; peak: number };
  use: string;
  /** quando ganha gatilho: S = Parte S da Fase 1; M2, M3, M4 = Mecânica 2.0 (sem gatilho ainda) */
  on: "S" | "M2" | "M3" | "M4";
  /** ganho fino linear, de `gainDb` em scripts/audio/config.mjs */
  gain: number;
  bytes: number;
}

export const audio: Record<AudioId, AudioEntry> = {
  "music-bench": {
    id: "music-bench",
    kind: "music",
    bus: "music",
    src: "/audio/music-bench.m4a",
    duration: 157.888,
    loop: { start: 50.62, end: 130.66, crossfade: 2 },
    target: { mode: "lufs", value: -24 },
    measured: { lufs: -24, peak: -8.9 },
    use: "Fundo da bancada, no Montar e no Testar",
    on: "S",
    gain: 1,
    bytes: 2566163,
  },
  "sfx-stamp": {
    id: "sfx-stamp",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-stamp.wav",
    duration: 0.47,
    loop: null,
    target: { mode: "lufs", value: -20 },
    measured: { lufs: -20, peak: -1.6 },
    use: "Cravar parafuso e trava",
    on: "S",
    gain: 1,
    bytes: 45164,
  },
  "sfx-stamp-soft": {
    id: "sfx-stamp-soft",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-stamp-soft.wav",
    duration: 0.4,
    loop: null,
    target: { mode: "lufs", value: -24 },
    measured: { lufs: -24.9, peak: -1.6 },
    use: "Cravar eixo e pino",
    on: "S",
    gain: 1,
    bytes: 38444,
  },
  "sfx-link": {
    id: "sfx-link",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-link.wav",
    duration: 0.6,
    loop: null,
    target: { mode: "lufs", value: -28 },
    measured: { lufs: -28, peak: -9.5 },
    use: "Ligar mola, haste ou cabo",
    on: "S",
    gain: 1,
    bytes: 57644,
  },
  "sfx-lock-release": {
    id: "sfx-lock-release",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-lock-release.wav",
    duration: 0.6,
    loop: null,
    target: { mode: "lufs", value: -20 },
    measured: { lufs: -19.9, peak: -4 },
    use: "Soltar a trava no Testar",
    on: "S",
    gain: 1,
    bytes: 57644,
  },
  "sfx-mode": {
    id: "sfx-mode",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-mode.wav",
    duration: 0.6,
    loop: null,
    target: { mode: "lufs", value: -24 },
    measured: { lufs: -24, peak: -11.9 },
    use: "Trocar entre Montar e Testar",
    on: "S",
    gain: 1,
    bytes: 57644,
  },
  "sfx-cut": {
    id: "sfx-cut",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-cut.wav",
    duration: 0.5,
    loop: null,
    target: { mode: "lufs", value: -24 },
    measured: { lufs: -23.9, peak: -11.2 },
    use: "Lápis recortando ou somando",
    on: "S",
    gain: 1,
    bytes: 48044,
  },
  "sfx-ui": {
    id: "sfx-ui",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-ui.wav",
    duration: 0.3,
    loop: null,
    target: { mode: "peak", value: -14 },
    measured: { lufs: null, peak: -14 },
    use: "Abrir faixa de ferramenta ou cartão",
    on: "S",
    gain: 1,
    bytes: 28844,
  },
  "sfx-impact-1": {
    id: "sfx-impact-1",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-impact-1.wav",
    duration: 0.4,
    loop: null,
    target: { mode: "lufs", value: -24 },
    measured: { lufs: -27.2, peak: -1.6 },
    use: "Impacto de metal pequeno",
    on: "S",
    gain: 1,
    bytes: 38444,
  },
  "sfx-impact-2": {
    id: "sfx-impact-2",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-impact-2.wav",
    duration: 0.4,
    loop: null,
    target: { mode: "lufs", value: -24 },
    measured: { lufs: -26, peak: -1.6 },
    use: "Impacto de metal pequeno",
    on: "S",
    gain: 1,
    bytes: 38444,
  },
  "sfx-impact-3": {
    id: "sfx-impact-3",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-impact-3.wav",
    duration: 0.4,
    loop: null,
    target: { mode: "lufs", value: -24 },
    measured: { lufs: -27.7, peak: -1.6 },
    use: "Impacto de metal pequeno",
    on: "S",
    gain: 1,
    bytes: 38444,
  },
  "sfx-impact-heavy-1": {
    id: "sfx-impact-heavy-1",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-impact-heavy-1.wav",
    duration: 0.6,
    loop: null,
    target: { mode: "lufs", value: -24 },
    measured: { lufs: -24, peak: -3.1 },
    use: "Impacto de metal pesado",
    on: "S",
    gain: 1,
    bytes: 57644,
  },
  "sfx-impact-heavy-2": {
    id: "sfx-impact-heavy-2",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-impact-heavy-2.wav",
    duration: 0.6,
    loop: null,
    target: { mode: "lufs", value: -24 },
    measured: { lufs: -24, peak: -2.6 },
    use: "Impacto de metal pesado",
    on: "S",
    gain: 1,
    bytes: 57644,
  },
  "sfx-impact-wood-1": {
    id: "sfx-impact-wood-1",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-impact-wood-1.wav",
    duration: 0.25,
    loop: null,
    target: { mode: "lufs", value: -24 },
    measured: { lufs: null, peak: -1.6 },
    use: "Impacto de madeira e polímero",
    on: "S",
    gain: 1,
    bytes: 24044,
  },
  "sfx-impact-wood-2": {
    id: "sfx-impact-wood-2",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-impact-wood-2.wav",
    duration: 0.25,
    loop: null,
    target: { mode: "lufs", value: -24 },
    measured: { lufs: null, peak: -1.6 },
    use: "Impacto de madeira e polímero",
    on: "S",
    gain: 1,
    bytes: 24044,
  },
  "sfx-impact-rubber": {
    id: "sfx-impact-rubber",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-impact-rubber.wav",
    duration: 0.4,
    loop: null,
    target: { mode: "lufs", value: -24 },
    measured: { lufs: -23.9, peak: -2.1 },
    use: "Impacto de borracha",
    on: "S",
    gain: 1,
    bytes: 38444,
  },
  "sfx-ratchet-1": {
    id: "sfx-ratchet-1",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-ratchet-1.wav",
    duration: 0.3,
    loop: null,
    target: { mode: "peak", value: -10 },
    measured: { lufs: null, peak: -10 },
    use: "Lingueta caindo num dente de catraca",
    on: "S",
    gain: 1,
    bytes: 28844,
  },
  "sfx-ratchet-2": {
    id: "sfx-ratchet-2",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-ratchet-2.wav",
    duration: 0.3,
    loop: null,
    target: { mode: "peak", value: -10 },
    measured: { lufs: null, peak: -10 },
    use: "Lingueta caindo num dente de catraca",
    on: "S",
    gain: 1,
    bytes: 28844,
  },
  "sfx-gas": {
    id: "sfx-gas",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-gas.wav",
    duration: 0.8,
    loop: null,
    target: { mode: "lufs", value: -20 },
    measured: { lufs: -20, peak: -3.8 },
    use: "Câmara acendendo, carga fraca e média",
    on: "S",
    gain: 0.708,
    bytes: 76844,
  },
  "sfx-pop-strong": {
    id: "sfx-pop-strong",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-pop-strong.wav",
    duration: 0.7,
    loop: null,
    target: { mode: "lufs", value: -18 },
    measured: { lufs: -22, peak: -1.6 },
    use: "Câmara com carga forte",
    on: "S",
    gain: 1,
    bytes: 67244,
  },
  "sfx-vent-loop": {
    id: "sfx-vent-loop",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-vent-loop.wav",
    duration: 2,
    loop: { start: 0.5, end: 1.5, crossfade: 0.02 },
    target: { mode: "lufs", value: -24 },
    measured: { lufs: -24, peak: -14 },
    use: "Gás saindo por respiro ou porta",
    on: "S",
    gain: 1,
    bytes: 192044,
  },
  "sfx-case-drop-1": {
    id: "sfx-case-drop-1",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-case-drop-1.wav",
    duration: 0.8,
    loop: null,
    target: { mode: "lufs", value: -24 },
    measured: { lufs: -23.9, peak: -2.1 },
    use: "Cápsula vazia caindo depois da ejeção",
    on: "M2",
    gain: 1,
    bytes: 76844,
  },
  "sfx-case-drop-2": {
    id: "sfx-case-drop-2",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-case-drop-2.wav",
    duration: 0.8,
    loop: null,
    target: { mode: "lufs", value: -24 },
    measured: { lufs: -24, peak: -1.8 },
    use: "Cápsula vazia caindo depois da ejeção",
    on: "M2",
    gain: 1,
    bytes: 76844,
  },
  "sfx-valve": {
    id: "sfx-valve",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-valve.wav",
    duration: 0.5,
    loop: null,
    target: { mode: "lufs", value: -24 },
    measured: { lufs: -24, peak: -2.1 },
    use: "Válvula de retenção assentando",
    on: "M3",
    gain: 1,
    bytes: 48044,
  },
  "sfx-clock-tic": {
    id: "sfx-clock-tic",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-clock-tic.wav",
    duration: 0.3,
    loop: null,
    target: { mode: "peak", value: -14 },
    measured: { lufs: null, peak: -14 },
    use: "Escape de relógio, batida ímpar",
    on: "M4",
    gain: 1,
    bytes: 28844,
  },
  "sfx-clock-tac": {
    id: "sfx-clock-tac",
    kind: "sfx",
    bus: "effects",
    src: "/audio/sfx-clock-tac.wav",
    duration: 0.3,
    loop: null,
    target: { mode: "peak", value: -14 },
    measured: { lufs: null, peak: -17.3 },
    use: "Escape de relógio, batida par",
    on: "M4",
    gain: 1,
    bytes: 28844,
  },
};

export const audioIds = Object.keys(audio) as AudioId[];
export const sfxIds = audioIds.filter((id): id is SfxId => audio[id].kind === "sfx");
