# Desempenho do palco (Fase 1 · item 6.7)

Meta do `AGENTS.md`: 60 quadros por segundo com 150 peças e 100 ligações num celular intermediário. Medido na página `/#perf`, com a cena sintética `scenes/fixtures/desempenho/desempenho.scene.json` (gerada por `npm run fixtures -- desempenho`): 150 peças e 100 ligações de todos os tipos em 4 camadas, com hachuras de todos os materiais, ferragens, molas e uma câmara. A página roda a cena no palco real a 1× por 10 s, com um arrasto roteirizado de 2 s a 8 s, e descarta o primeiro segundo (aquecimento).

- **Quadros por segundo:** mediana e p5 de 1000 / intervalo entre quadros (`requestAnimationFrame`).
- **Física por quadro:** tempo de passos + snapshots no worker que chegou naquele quadro.
- **Desenho por quadro:** escrita dos `transform` e das ligações no SVG (só JavaScript; a pintura do navegador entra nos quadros por segundo).

## Resultados

Chromium 153 headless desta sessão (Linux, 4 núcleos, sem GPU: rasterização por software), densidade 1, três rodadas cada.

| Aparelho | Janela | qps mediana | qps p5 | Quadros > 20 ms | Física/quadro (mediana · p95) | Desenho/quadro (mediana · p95) |
| --- | --- | --- | --- | --- | --- | --- |
| Chromium da sessão | 390×844 | 59,9 | 59,5–59,9 | 0–1 de 541 | 6,3–6,5 ms · 9,8–10,4 ms | 0,8 ms · 1,2–1,3 ms |
| Chromium da sessão | 1440×900 | 59,9 | 59,5 | 16–25 de ~520 | 7,6–7,7 ms · 14,5–18,0 ms | 0,8 ms · 3,4–5,6 ms |
| Celular do Will | — | — | — | — | — | — |
| Computador do Will | — | — | — | — | — | — |

As linhas do Will ficam para depois do merge: abrir `/#perf`, tocar em "Rodar 10 s" e colar o resultado ("Copiar resultado") no chat.

### Com a interpolação (Parte F, item 14.2)

A página `/#perf` ganhou a escolha da velocidade (Real, o padrão da medição; Normal; Lento) e a linha "interpolação por quadro" (média, porque o relógio do navegador tem 0,1 ms de resolução). Chromium headless desta sessão, 1440×900, densidade 1 (`tests/e2e/parte-f.spec.ts`, `docs/decisoes/perf-parte-f.json`):

| Velocidade | qps mediana · p5 | Quadros > 20 ms | Passos por quadro | Física/quadro (mediana · p95) | Desenho/quadro (mediana · p95) | Interpolação/quadro (média · p95) |
| --- | --- | --- | --- | --- | --- | --- |
| Lento (1/20) | 59,9 · 59,5 | 1 de 540 | 0,2 | 0 · 2,2 ms | 0,7 · 3,0 ms | 0,004 · 0 ms |
| Normal (¼) | 59,9 · 59,9 | 1 de 540 | 1,0 | 1,7 · 3,2 ms | 0,7 · 3,0 ms | 0,006 · 0,1 ms |
| Real (1×) | 59,9 · 59,5 | 3 de 538 | 4,0 | 6,4 · 12,6 ms | 0,7 · 4,0 ms | 0,026 · 0,1 ms |

Em Lento o desenho agora roda em todo quadro (antes, só nos quadros em que chegava um passo, ~1 em 5): o custo é a escrita dos `transform` (0,7 ms de mediana), igual à de Normal.

## Onde o tempo ia e o que foi corrigido

Primeira medida, com a física no thread principal e uma folha SVG só: **mediana 59,9, p5 29,9**, 155 de 377 quadros acima de 20 ms (1440×900). Medido por partes:

1. **Física no thread principal.** O Box2D calibrado (16 subpassos) custa ~1,5 ms por passo nesta cena; a 1× são 4 passos por quadro (~6–9 ms). Com a câmera lenta em 0,05× (física quase parada), o desenho sozinho dava 59,9 / 59,5. **Correção:** a sessão roda num Web Worker (`src/ui/sim/sim.worker.ts`); o thread principal pede os passos do quadro, recebe os quadros de cada passo, espelha a gravação e só desenha. O determinismo e a volta pela linha do tempo não mudam (a SimSession é a mesma, testada em `src/sim/session.test.ts`).
2. **Repintura das peças fixas.** Mexer numa peça invalidava a folha inteira, e as placas grandes com hachura eram rasterizadas de novo a cada quadro (escondê-las dava 59,9 / 59,5). **Correção:** a cena é montada em folhas `<svg>` compostas à parte (`will-change: transform`), uma com o que fica parado e outra com o que se move por camada, mais as folhas de definições e de chamadas. As fixas ficam em cache no compositor.
3. **Parede das peças móveis.** Depois de 1 e 2, a 0,25× ainda sobravam ~60 quadros longos; escondendo só a parede das peças móveis, 8–24. É uma segunda cópia com traço de cada peça móvel, repintada a cada quadro. **Correção:** orçamento de pintura (`WALL_BUDGET` em `src/render/SceneSvg.tsx`): com mais de 40 peças móveis, a parede delas não é desenhada no Simular. No Editar e nas peças fixas ela continua; os cinco exemplos têm menos de 10 peças móveis e não são afetados.

Também saiu do pacote principal o que não precisa estar nele (ver abaixo).

## Pacotes

Build de produção (`vite build`), gzip nível 9.

| Pacote | Quando carrega | Bruto | gzip |
| --- | --- | --- | --- |
| `index` (app principal: casca, renderizador, geometria com Clipper2) | ao abrir | 353,5 KB | 108,4 KB |
| `index` no `main` antes desta parte (casca vazia) | — | 231,3 KB | 71,8 KB |
| `index.css` | ao abrir | 27,5 KB | 5,9 KB |
| `scene` (schema Zod e migrações) | junto com a primeira cena | 115,4 KB | 33,2 KB |
| `controller` (laço, linha do tempo) | ao entrar no Simular | 7,4 KB | 2,6 KB |
| `sim.worker` + adaptador + runtime + `engine-box2d` | ao entrar no Simular (worker) | 6,0 + 11,4 + 95,4 + 30,1 KB | 2,2 + 4,1 + 30,6 + 11,1 KB |
| `Box2D.compat.wasm` | ao entrar no Simular | 597,6 KB | 207,8 KB |
| `PerfPage` | só em `/#perf` | 4,8 KB | 2,1 KB |

O renderizador usa `shapeOutline` (`src/geometry/outline.ts`), que dá o mesmo contorno e a mesma massa de `shapeGeometry` sem a decomposição convexa: o earcut não entra no pacote principal.

## Pendências

- Medir no celular do Will. Se o p5 ficar abaixo de 50, os próximos candidatos são: baixar o orçamento da parede, trocar a hachura das peças móveis por tom liso durante o Simular e diminuir a densidade de pixels das folhas móveis.
- O tempo de física (~1,5 ms por passo nesta cena) é o do Box2D calibrado com 16 subpassos; não mudou nesta parte. No celular, se o worker não der conta de 4 passos por quadro, a simulação a 1× fica mais lenta que o tempo real (o acumulador descarta o atraso acima de 40 passos), mas o desenho continua fluido.
