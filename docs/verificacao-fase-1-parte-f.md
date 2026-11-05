# Verificação — Fase 1 · Parte F (correções do teste real e exemplo-vitrine)

Data: 05/11/2026. Branch `ccr-70458c4e-91j7fx` (o branch de trabalho desta sessão; o prompt pedia `fase-1-parte-f`). Máquina: Node 22 e Chromium headless, 4 núcleos, sem GPU.

## Itens

| Item | Feito | Commit |
| --- | --- | --- |
| 14.1 Velocidades | Lento (1/20), Normal (¼, o padrão ao entrar em Testar e ao abrir uma cena no laboratório) e Real (1×), com a fração embaixo do nome, no app e no `/#lab`; frase da primeira vez em Real, uma vez por aparelho. `src/sim/pacing.ts` (modos e o `Pacer`) | `6d83a06` |
| 14.2 Câmera lenta fluida | O desenho mistura o passo anterior e o seguinte a cada quadro (posição e pressão lineares, ângulo pelo menor arco; molas, cabos, gás e chamadas saem das poses), no app e no laboratório; eventos no quadro em que o desenho chega ao passo; `/#perf` com a escolha da velocidade e o custo da interpolação | `853beb6` |
| 14.3 Arrasto da mão | Força e velocidade limitadas (`HAND`, `handLimits` em `src/engine/runtime.ts`); o alvo para quando o dedo para; fórmulas e números em `docs/arquitetura.md` §4, "Arrasto" | `bc6fa4c` |
| 14.4 Teste de abuso | `src/sim/abuse.ts`, modo rápido no Vitest e completo por `npm run abuse`; correções na causa; `docs/decisoes/abuso.md` | `faadddb` |
| 14.5 Exemplo-vitrine | Lançador de bancada (`scenes/examples/lancador-bancada.json`, gerado por `scripts/fixtures/bancada.ts`), cena de teste e capturas no app | `f9761ac` |
| 14.6 Paisagem | Enquadramento que desvia só dos controles (`fitAround`), controles com fundo chrome translúcido, teste do toque em outra camada, `check:overflow` em 844×390 e 640×360 | `1181a4a` |
| 14.7 Verificação | Este documento e as capturas em `docs/capturas/fase-1/parte-f/` | commit deste documento |

## Antes e depois de cada problema relatado

### 1. "Em 1× fica exageradamente rápido, como se fosse 4×"

- **Antes:** 1× já era tempo real (o relógio do laboratório andava 0,5 s em 0,5 s de vídeo). O que parecia acelerado é física real em peça pequena vista grande: um pêndulo de 50 mm tem período de 0,45 s. O 0,25× fazia o papel de "velocidade comum".
- **Depois:** os nomes dizem o que cada um é. **Normal** (¼) é o padrão; **Lento** (1/20); **Real** (1×), e a primeira vez que a pessoa toca em Real aparece "Tempo real: peças pequenas se movem rápido de verdade.". A física continua em tempo real e em unidades reais; a régua e o relógio, em tempo simulado.
- Teste: `src/sim/pacing.test.ts` (1 s de tela = 0,05, 0,25 e 1 s simulado, ±1%, a 30, 60 e 120 qps e com tremor). Captura: `velocidade-{lento,normal,real}-{844x390,1440x900}.png` (Real com a frase).

### 2. "O 0,05× diminui muito o FPS"

- **Antes:** o laço desenhava só quando chegava um passo; em 0,05× um passo de 1/240 s cai a cada ~5 quadros, e a cena andava aos saltos (~12 qps aparentes) com a página a 60 qps.
- **Depois:** o desenho mistura dois passos em todo quadro. Teste com relógio falso (`src/sim/blend.test.ts`): em Lento o pêndulo muda de pose em todo quadro (sem a mistura repetia em 4 de 5). Captura: `lento-quadro-{1..4}-844x390.png` (quatro quadros seguidos de Lento no meio do recuo: o ferrolho e a pressão do gás entre dois passos).
- Medida (`/#perf`, 150 peças e 100 ligações, Chromium desta sessão, 1440×900; `docs/decisoes/perf-parte-f.json`):

| Velocidade | qps mediana · p5 | Quadros > 20 ms | Desenho/quadro (mediana · p95) | Interpolação/quadro (média) |
| --- | --- | --- | --- | --- |
| Lento | 59,9 · 59,5 | 1 de 541 | 0,5 · 0,7 ms | 0,008 ms |
| Normal | 59,9 · 59,9 | 0 de 541 | 0,5 · 0,8 ms | 0,004 ms |
| Real | 59,9 · 59,5 | 0 de 541 | 0,5 · 0,7 ms | 0,004 ms |

### 3. "Algumas coisas não agem como deveriam" (física)

- **Antes:** o arrasto puxava com `(6 000·m + 4 000)·g/100`: com gravidade real, ~98 vezes a força do protótipo, dezenas de vezes o peso (um peso de 20 g com 12 N). E o corpo-alvo do dedo só recebia posição quando o dedo andava: parado, ele seguia na última velocidade e levava a peça embora. No teste de abuso (mesmo roteiro, antes e depois): o peso do "Cabo" a 9,9 m/s, a barra do suporte elástico arrancada a 6,75 vezes o limite, pêndulo e molas a 3–9 m/s, juntas abrindo até 21 mm. O cabo em si nunca passou de 50,34 mm no motor (o que parecia cabo esticado no vídeo não reproduzi: o peso voava a 9,9 m/s para fora da vista).
- **Depois:** a mão (14.3): alvo a no máximo 600 mm/s de tempo simulado, força de 10 vezes o peso mais as molas ao alcance da peça, nunca mais que o que abre uma junta da peça 0,25 mm nem o que deforma um suporte elástico além da faixa dele. Cabo: 0,65 m/s e 50,003 mm; suporte elástico: 0,97 do limite; pêndulo e molas abaixo de 1,4 m/s. Captura: `cabo-arrasto-forte-{390x844,1440x900}.png` (Real, o dedo puxando a 4 vezes o cabo: o peso fica na ponta do cabo de 50 mm).
- O abuso achou e corrigiu na causa, além da força: **bug do gás** (pistão que saía do cilindro e caía era puxado de volta de metros de distância pela mola do gás), **"bala" e juntas** (a colisão contínua de bala do Box2D não respeita as juntas: prendia um elo de corrente no vizinho e o percussor no ferrolho) e **o motor de 40 N·mm** da cena de desempenho esmagando um bloco de 0,35 g.
- Resultado: das 29 cenas, 16 sem nenhuma falha (antes 6); 20 falhas de invariante (antes 44), todas falhas esperadas com motivo e números em `docs/decisoes/abuso.md` (ver "Riscos").

### 4. O lançador de ferrolho ("o gatilho tá apontado pro outro lado"; "no mínimo um exemplo bem trabalhado")

- **Antes:** corpo de pistola com empunhadura e mira, gatilho com a face convexa para a frente, recuo de 22 mm, esferas saindo da tela.
- **Depois:** **Lançador de bancada**, o novo objeto padrão (ver "O exemplo-vitrine" abaixo). Capturas no app em 844×390 e 1440×900: `vitrine-montar`, `vitrine-repouso`, `vitrine-meio-do-recuo-lento`, `vitrine-esfera-saindo`, `vitrine-coletor`.

### 5. Paisagem: "coluna escura à esquerda com ~20% da largura"

- **Antes:** a "coluna" das capturas da E2a não era um painel: era a borda esquerda da placa de base das engrenagens (a placa não chega à esquerda e o resto é fundo vazio). Mas o enquadramento reservava faixas inteiras (60 px em cima e embaixo, 40 px dos lados) e os controles tinham fundo opaco.
- **Depois:** o enquadramento mede os retângulos dos controles que flutuam (cantos, título, abas, faixa do Testar) e procura a maior escala em que a caixa do mecanismo não encosta neles nem passa das áreas seguras (`fitAround`). Controles com fundo chrome translúcido. O lançador de bancada ocupa **94% da altura útil em 844×390 e 86% em 640×360** (afirmado no teste; `paisagem-*.json`). Toque numa peça de outra camada a escolhe e ativa a camada dela (já era assim desde a E2a; agora tem teste). Capturas: `paisagem-{vitrine,engrenagens}-{844x390,640x360}.png`.

## O exemplo-vitrine

1. Placa de base de alumínio (camada 1, Base) com o suporte traseiro e a haste-guia; o cano, o canal do carregador e o coletor são peças fixas aparafusadas a ela (os únicos parafusos).
2. Ação (camada 2): ferrolho de aço num trilho da placa, com a luva (o cilindro do gás) aparafusada e a mola de retorno na haste-guia; o êmbolo corre dentro da luva; a câmara de gás tem duas paredes (êmbolo à frente, ferrolho atrás) e aparece em corte, com a esfera assentada e o gás em brasa.
3. Disparo (camada 3): percussor num trilho do ferrolho, preso no retém (eixo com mola de torção); o sensor no fundo da câmara acende uma dose e fecha a válvula de alívio; o sensor no fim do curso do ferrolho a abre (o êmbolo volta sem colchão de gás).
4. Gatilho (camada 4): face côncava para a boca, o dedo puxa para trás; a barra leva o movimento ao retém por um pino entre camadas e o rasgo da placa abaixa a barra no fim do curso (desconector).
5. Na volta do ferrolho, a próxima esfera sobe do carregador vertical (empurrador de aço, mola amortecida) e o êmbolo a leva ao assento; a que saiu bate na parede do coletor e se junta às outras.

Aceites (cena de teste `scenes/fixtures/exemplos/lancador-bancada.test.json`, 4 execuções, todas as afirmações passam):

| Aceite | Medido |
| --- | --- |
| Repouso parado, percussor preso, sem disparo, próxima esfera encostada na luva, esfera 1 assentada | 0,000 mm; 0,09 mm; 0 eventos; sem folga; 9,65 mm / 1,30 mm |
| Disparo com o gatilho segurado: um tiro, desconexão (nenhum segundo tiro em 1 s) | 1 evento; 1 carga |
| Esfera sai pela boca a 5–20 m/s | 10,3 a 10,4 m/s nas seis |
| Recuo visível de 8 a 15 mm | 15,0 mm (o gás empurra até 14,5 mm; em 4 passos) |
| Volta ao batente em até 0,3 s; ciclo em Normal entre 0,5 e 2 s de tela | 217 a 250 ms simulados = 0,87 a 1,0 s de tela |
| Gás não fica preso | abaixo de 5% do pico no passo em que desveda |
| Seis ciclos e o carregador vazio | 7 puxões, 7 acendimentos, 7 cargas; cada ciclo termina com o percussor preso e o ferrolho no batente |
| As esferas param no coletor e ficam lá | as seis em fila na rampa, de x = 62 a 89 mm (a parede está em 92), paradas no último 0,5 s (0,000 mm) |
| Arrasto manual do ferrolho | o dedo leva o ferrolho ao fim do curso (15,0 mm) sem acender a carga; soltando, a esfera 2 entra e se assenta, o ferrolho volta, o percussor fica preso, a esfera da câmara sai rolando para o coletor |
| Robustez (fora da cena de teste) | o ciclo de seis tiros passa com o puxão deslocado de 1 a 13 passos e segurando 0,25, 0,32 e 0,4 s: 30 de 30 |

Massas: ferrolho com a luva 13,7 g (aço), êmbolo 0,74 g, esferas 0,89 g, empurrador 0,75 g, percussor 0,49 g, retém 0,63 g, gatilho 2,42 g, barra 2,03 g. Dose de 0,5 mmol por tiro (12 doses), câmara Ø 6 × 15 mm.

Revisão de diretor de arte (feita sobre as capturas, ao lado do frame oficial a): saíram o corpo de pistola, a empunhadura e o ressalto de mira do cano (lembravam arma e não tinham função), os quatro parafusos de canto (sem ligação de verdade, só ruído de números) e o excesso de cano (98 → 64 mm, para o conjunto caber maior no celular); o carregador deixou de passar da placa; os números das ligações seguem a montagem (40–43 fixações, 44–51 ação, 52–56 disparo, 57–61 gatilho).

## Verificação padrão

- `npm run lint`, `npm run typecheck`, `npm test` (Vitest: 632 testes e as 4 falhas esperadas antigas da bancada, mais os testes do pipeline de assets) e `npm run build`: limpos, sem avisos.
- `npm run check:overflow`: 45 casos, sem rolagem lateral em 360, 390 e 412 px, em 844×390 e em 640×360.
- `npm run test:e2e`: hash do Chromium igual ao do Node em todas as cenas de `scenes/fixtures/`.
- `npx playwright test --project=capture-f`: 16 testes (capturas, `/#perf` nas três velocidades, altura útil em paisagem, toque em outra camada).
- Teste de abuso: rápido no Vitest (~20 s); completo por `npm run abuse` (837 execuções, ~6 min).

## O que ficou de fora e por quê

- **Penetração no impacto entre peças móveis** (falha esperada em 13 cenas): o Box2D v3 só cria o contato a 0,1 mm, e a 1/240 s uma peça a 0,5–2 m/s anda 2–8 mm por passo. O conserto é passo menor ou distância especulativa maior, as duas decisões fechadas da calibração. Números em `docs/decisoes/abuso.md`.
- **A peça acompanha o dedo em tempo de tela só até a velocidade do alvo** (600 mm/s simulados: 30 mm/s de tela em Lento, 150 em Normal). Mais rápido que isso, ela fica para trás, de propósito: é o que impede o dedo de virar 2 000 mm/s em Lento.
- **Medidas no celular do Will**: `/#perf` (agora com Lento, Normal e Real) continua pendente.
