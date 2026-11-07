# Som · lote som-01 — medidas dos arquivos convertidos

Gerado por `npm run audio`. Volume integrado e pico real pelo medidor EBU R128 (`ebur128=peak=true`) do ffmpeg, sobre o arquivo convertido; silêncio inicial até a primeira amostra acima de −60 dBFS. Alvos do manifesto: fundo −24 LUFS, médio −20, teto −18, sutil −24, sutil (mínimo) −28; efeitos de 0,3 s pelo pico (sutil −10 dBTP, mínimo −14 dBTP). Pico real máximo de saída: -1,5 dBTP.

Δ é o medido menos o alvo. "Pico" na coluna Limite marca o asset cujo ganho parou no teto de pico antes de chegar ao alvo de volume: o número fica abaixo do alvo e é o que o arquivo pode dar sem distorcer.

| ID | Formato | Duração (s) | LUFS | Alvo | Δ (LU) | Pico real (dBTP) | Ganho (dB) | Limite | Silêncio inicial (ms) | Tamanho | sha256 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- |
| music-bench | aac 48 kHz stereo | 157,888 | -24,0 | -24,0 LUFS | 0,0 | -8,9 | -8,9 |  | 0,0 | 2506 KB | 6a11b25e28cf |
| sfx-stamp | pcm_s16le 48 kHz mono | 0,470 | -20,0 | -20,0 LUFS | 0,0 | -1,6 | +1,6 | pico | 0,0 | 44 KB | 2d97186a737d |
| sfx-stamp-soft | pcm_s16le 48 kHz mono | 0,400 | -24,9 | -24,0 LUFS | -0,9 | -1,6 | +11,4 | pico | 0,0 | 38 KB | 29ea17d10a3f |
| sfx-link | pcm_s16le 48 kHz mono | 0,600 | -28,0 | -28,0 LUFS | 0,0 | -9,5 | +11,3 |  | 0,0 | 56 KB | 577e068e0bf2 |
| sfx-lock-release | pcm_s16le 48 kHz mono | 0,600 | -19,9 | -20,0 LUFS | 0,1 | -4,0 | +1,1 |  | 0,0 | 56 KB | c87b4b75e15d |
| sfx-mode | pcm_s16le 48 kHz mono | 0,600 | -24,0 | -24,0 LUFS | 0,0 | -11,9 | +0,8 |  | 0,1 | 56 KB | 11a6bbc5cfe1 |
| sfx-cut | pcm_s16le 48 kHz mono | 0,500 | -23,9 | -24,0 LUFS | 0,1 | -11,2 | +1,8 |  | 0,0 | 47 KB | d24195149ff2 |
| sfx-ui | pcm_s16le 48 kHz mono | 0,300 | curto | -14,0 dBTP | 0,0 | -14,0 | +10,0 |  | 0,0 | 28 KB | 8058da05f0b6 |
| sfx-impact-1 | pcm_s16le 48 kHz mono | 0,400 | -27,2 | -24,0 LUFS | -3,2 | -1,6 | +10,3 | pico | 0,0 | 38 KB | cf0260beaf4b |
| sfx-impact-2 | pcm_s16le 48 kHz mono | 0,400 | -26,0 | -24,0 LUFS | -2,0 | -1,6 | +9,2 | pico | 0,0 | 38 KB | 3b688887bcba |
| sfx-impact-3 | pcm_s16le 48 kHz mono | 0,400 | -27,7 | -24,0 LUFS | -3,7 | -1,6 | +11,2 | pico | 0,0 | 38 KB | f72704203097 |
| sfx-impact-heavy-1 | pcm_s16le 48 kHz mono | 0,600 | -24,0 | -24,0 LUFS | 0,0 | -3,1 | +6,3 |  | 0,0 | 56 KB | e888bb33b674 |
| sfx-impact-heavy-2 | pcm_s16le 48 kHz mono | 0,600 | -24,0 | -24,0 LUFS | 0,0 | -2,6 | +7,3 |  | 0,0 | 56 KB | 966a3efb951a |
| sfx-impact-wood-1 | pcm_s16le 48 kHz mono | 0,250 | curto | -24,0 LUFS | — | -1,6 | +10,4 | pico | 0,0 | 23 KB | 2691c11218cf |
| sfx-impact-wood-2 | pcm_s16le 48 kHz mono | 0,250 | curto | -24,0 LUFS | — | -1,6 | +11,0 | pico | 0,0 | 23 KB | c871b53f3ddb |
| sfx-impact-rubber | pcm_s16le 48 kHz mono | 0,400 | -23,9 | -24,0 LUFS | 0,1 | -2,1 | +11,0 |  | 0,0 | 38 KB | cbee9d7a0ac9 |
| sfx-ratchet-1 | pcm_s16le 48 kHz mono | 0,300 | curto | -10,0 dBTP | 0,0 | -10,0 | +2,4 |  | 0,0 | 28 KB | cc2e39403da9 |
| sfx-ratchet-2 | pcm_s16le 48 kHz mono | 0,300 | curto | -10,0 dBTP | 0,0 | -10,0 | +3,6 |  | 0,0 | 28 KB | 2c4d3ede9899 |
| sfx-gas | pcm_s16le 48 kHz mono | 0,800 | -20,0 | -20,0 LUFS | 0,0 | -3,8 | +2,8 |  | 0,1 | 75 KB | b17ff9c79311 |
| sfx-pop-strong | pcm_s16le 48 kHz mono | 0,700 | -22,0 | -18,0 LUFS | -4,0 | -1,6 | +0,9 | pico | 0,0 | 66 KB | 70048d4007c0 |
| sfx-vent-loop | pcm_s16le 48 kHz mono | 2,000 | -24,0 | -24,0 LUFS | 0,0 | -14,0 | -2,9 |  | 0,0 | 188 KB | 8651ae838656 |
| sfx-case-drop-1 | pcm_s16le 48 kHz mono | 0,800 | -23,9 | -24,0 LUFS | 0,1 | -2,1 | +3,0 |  | 0,0 | 75 KB | 262f9ffc4cdc |
| sfx-case-drop-2 | pcm_s16le 48 kHz mono | 0,800 | -24,0 | -24,0 LUFS | 0,0 | -1,8 | +3,9 |  | 0,0 | 75 KB | 60045dcc1786 |
| sfx-valve | pcm_s16le 48 kHz mono | 0,500 | -24,0 | -24,0 LUFS | 0,0 | -2,1 | +1,1 |  | 0,0 | 47 KB | 479d3426478f |
| sfx-clock-tic | pcm_s16le 48 kHz mono | 0,300 | curto | -14,0 dBTP | 0,0 | -14,0 | -5,1 |  | 0,0 | 28 KB | 9e32b25a415c |
| sfx-clock-tac | pcm_s16le 48 kHz mono | 0,300 | curto | -14,0 dBTP | -3,3 | -17,3 | -5,1 | par de clock-tic | 0,0 | 28 KB | 105c3a60d330 |

Total: 3,69 MB em 26 arquivos.

## Emendas de laço

Salto: diferença de energia (RMS) entre a janela que termina no fim do laço e a que começa no início (janela de 250 ms na música, 50 ms na vazão). Oscilação: maior desvio, em blocos de 100 ms (20 ms na vazão), da energia do crossfade de potência constante em relação à média das duas partes. Aceite: salto ≤ 1,5 dB; oscilação ≤ 3,5 dB.

| ID | Laço (s) | Crossfade (s) | Antes (dB) | Depois (dB) | Salto (dB) | Oscilação (dB) | Resultado |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| music-bench | 50,620 → 130,660 | 2,000 | -24,7 | -24,4 | 0,29 | 3,45 | sem salto |
| sfx-vent-loop | 0,500 → 1,500 | 0,020 | -27,5 | -27,1 | 0,37 | 0,16 | sem salto |
