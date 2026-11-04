# Verificação — Fase 1 · Parte C (motor definitivo e ligações 2.0)

Data: 04/11/2026. Branch `fase-1-parte-c`. Máquina desta sessão: Node 22 e Chromium 153 headless, Intel Xeon 2,1 GHz, 4 núcleos.

## Itens

| Item | Feito |
| --- | --- |
| 5.1 Formato v2 e migração | Schema Zod v2 com integridade nova, migração v1 → v2, `parseScene` para v0, v1 e v2 (`src/model/`). |
| 5.2 Box2D definitivo | Calibração para gravidade real (`docs/decisoes/motor.md`), funções transcendentais determinísticas (`src/geometry/dmath.ts`), snapshot ampliado, eventos de impacto, roteiros em `src/sim/`, hash Node = Chromium. |
| 5.3 Fixações | Atrito no eixo e no trilho, haste, cabo, suporte elástico; quatro cenas de teste. |
| 5.4 Molas 2.0 | Modos, comprimento sólido, guia, mola nativa quando rígida; cinco cenas de teste. |
| 5.5 Furos e rasgos | Rasgo em junta (roda) e em contato; arrasto do Box2D dentro do solver; quatro cenas de teste. |
| 5.6 Gás 2.0 | Câmara de 1 ou 2 paredes, isotérmica e adiabática, vedação, respiros, portas, ações de sensor; força do gás no solver; quatro cenas de teste. |
| 5.7 Exemplos e laboratório | Cinco exemplos em `scenes/examples/` (com cenas de teste) e a página `/#lab`. |
| 5.8 Verificação | Este documento, a bancada de novo, capturas, arquitetura e README. |

## Aceites (Node, Box2D calibrado; o Chromium dá o mesmo hash em todas)

Gerada por `node scripts/run-ts.mjs scripts/fixtures/report.ts`. Valores sem unidade estão na unidade da afirmação (mm, rad, N, kPa).

| Cena | Afirmação | Passa | Medido |
| --- | --- | --- | --- |
| Biela e manivela | curso da cruzeta = 2 × raio (30 mm ± 1%) | sim | 29,9997 |
| Biela e manivela | comprimento da haste constante (±0,01 mm) | sim | de 49,9998 a 50,0002 |
| Biela e manivela | a manivela gira na velocidade do motor (±2%) | sim | 3,1416 |
| Cilindro de dois pistões | a esfera acende a carga | sim | 1 evento |
| Cilindro de dois pistões | o fundo recua | sim | 2,5530 |
| Cilindro de dois pistões | o pistão sai pela boca | sim | 4601,6206 |
| Cilindro de dois pistões | a mola devolve o fundo ao batente (±0,2 mm) | sim | 0,0006 |
| Engrenagens e catraca | a favor: a intermediária gira −1,5 × a motora (±2%) | sim | -1,49947 |
| Engrenagens e catraca | a favor: a catraca gira 2 × a motora (±2%) | sim | 1,99903 |
| Engrenagens e catraca | contra: contra, a lingueta trava antes de um passo de dente (25,7°) | sim | 0,4144 |
| Lançador de esfera | parado, o retém segura o percussor (< 0,2 mm) | sim | 0,0000 mm |
| Lançador de esfera | puxando o gatilho, o sensor dispara uma vez | sim | 1 evento |
| Lançador de esfera | e a câmara acende | sim | 1 evento |
| Lançador de esfera | a esfera sai do cano (x > 142,4 mm) | sim | 1009,2129 |
| Trava de porta | a maçaneta gira 30° | sim | -0,5244 |
| Trava de porta | e a lingueta recolhe pelo menos 6 mm | sim | 7,1298 |
| Trava de porta | soltando, volta à posição inicial (±0,3 mm) em até 1 s | sim | 0,0003 |
| Biela e manivela (cena de teste) | curso do bloco = 2 × raio da manivela (30 mm ± 1%) | sim | 30,0000 |
| Biela e manivela (cena de teste) | comprimento da haste constante (50 ± 0,01 mm) | sim | de 50,0000 a 50,0000 |
| Biela e manivela (cena de teste) | a manivela gira na velocidade do motor (1 volta/s ± 1%) | sim | 6,2832 |
| Cabo | esticado, a distância fica em 50 ± 0,05 mm | sim | de 50,0003 a 50,0003 |
| Cabo | empurrado para cima, o cabo afrouxa (distância < 50 mm) | sim | de 41,9024 a 45,7826 |
| Cabo | frouxo, o cabo não puxa (força nula) | sim | de 0,0000 a 0,0000 |
| Cabo | o peso cai de volta e o cabo estica de novo (50 ± 0,05 mm) | sim | de 50,0003 a 50,0003 |
| Cabo | esticado, o cabo sustenta o peso (0,196 N ± 1%) | sim | 0,1962 |
| Parafusado × suporte elástico | a parafusada não se move (< 0,01 mm) | sim | 0,0000 mm |
| Parafusado × suporte elástico | a do suporte cede com o próprio peso e oscila (passa da deflexão estática) | sim | 3,2544 |
| Parafusado × suporte elástico | assenta na deflexão estática da frequência configurada (1,92 mm ± 10%) | sim | 1,9153 |
| Parafusado × suporte elástico | parada no fim (variação < 0,02 mm) | sim | 0,0000 |
| Pêndulo | sem atrito: o período bate com 2π·√(I/(m·g·d)) (±3%) | sim | 0,5272 s (esperado 0,5182 s, erro 1,73%) |
| Pêndulo | sem atrito: o eixo não abre (≤ 0,05 mm) | sim | 0,0004 |
| Pêndulo | com atrito: com atrito, a amplitude cai a cada ciclo até parar | sim | 5 meios ciclos decrescentes (0,528 → 0,428 → 0,349 → 0,251…), no fim 0,0000 |
| Pêndulo | com atrito: parado no fim (/ω/ < 0,01 rad/s) | sim | de -0,0000 a 0,0000 |
| Mola apoiada e mola de tração | repouso: apoiada: compressão estática = m·g/k (9,81 mm ± 2%) | sim | 30,1900 |
| Mola apoiada e mola de tração | repouso: só tração: extensão estática = m·g/k (9,81 mm ± 2%) | sim | 49,8100 |
| Mola apoiada e mola de tração | empurrão para cima: apoiada, puxada além do comprimento livre: não puxa (força nula) | sim | de 0,000000 a 0,000000 em 27 passos |
| Mola apoiada e mola de tração | empurrão para cima: só tração, empurrada abaixo do comprimento livre: não empurra (força nula) | sim | de 0,000000 a 0,000000 em 27 passos |
| Mola apoiada e mola de tração | empurrão para cima: os dois caem pela gravidade e voltam ao repouso (apoiada ± 2%) | sim | 30,1899 |
| Mola com guia | a força fica alinhada ao eixo da guia (transversal < 1% da força) | sim | de 0,000000 a 0,000000 em 960 passos |
| Mola com guia | nenhum contato entre a haste e a mola (a mola não colide) | sim | 0,0000 mm |
| Mola com guia | o bloco oscila e assenta | sim | 29 meios ciclos decrescentes (1,803 → 1,572 → 1,351 → 1,151…), no fim 0,0002 |
| Mola com guia | extensão final = m·g·sen 30°/k (1,85 mm ± 2%) | sim | 1,8483 |
| Pré-carga | no primeiro passo a mola já empurra com k·(livre − montada) = 0,5 N (± 1%) | sim | 0,4999 |
| Pré-carga | o batente do trilho segura a mesma força (0,5 N ± 1%) | sim | 0,4999 |
| Pré-carga | o bloco não sai do batente (< 0,01 mm) | sim | 0,0029 mm |
| Mola rígida (nativa) | estável: o bloco não explode nem atravessa a mola | sim | de 24,9903 a 24,9908 |
| Mola rígida (nativa) | assenta na compressão estática m·g/k (0,0092 mm ± 5%) | sim | 24,9908 |
| Mola rígida (nativa) | parado no fim (variação < 0,001 mm) | sim | 0,0000 |
| Comprimento sólido | a mola nunca fica menor que o sólido − 0,05 mm (9,95 mm) | sim | de 9,9865 a 50,0000 |
| Comprimento sólido | devolve a força como batente (50 N ± 2%) | sim | 50,0000 |
| Comprimento sólido | sem explodir: o bloco fica no trilho e em velocidade razoável | sim | de -20,0135 a 20,0000 |
| Pino e camadas | o pino nunca toca a peça da camada 1 no caminho (a caixa não se move) | sim | 0,0000 mm |
| Pino e camadas | atravessa e para no piso da camada 3 (centro a 92 mm ± 0,1) | sim | 92,0003 |
| Rasgo curvo (contato) | o pino percorre o arco de ponta a ponta (≥ 88°) | sim | 1,5741 |
| Rasgo curvo (contato) | penetração < 0,1 mm | sim | 0,0359 mm |
| Rasgo curvo (contato) | nunca escapa do rasgo (folga até a parede ≥ −0,1 mm) | sim | de -0,0359 a 0,1930 |
| Mancal com folga | a peça gira em torno do furo | sim | 2,0401 |
| Mancal com folga | o centro do pino fica dentro de folga + penetração (≤ 0,2 mm do centro do furo) | sim | de 0,0805 a 0,1081 |
| Mancal com folga | penetração do pino na parede < 0,1 mm | sim | de -0,0275 a -0,0000 |
| Rasgo reto (junta) | desvio transversal do pino < 0,01 mm | sim | de -0,0018 a 0,0056 |
| Rasgo reto (junta) | o pino para nos batentes (10 mm + 0,1 mm de folga de cada lado) | sim | de -10,1035 a 10,1001 |
| Rasgo reto (junta) | e chega aos dois batentes | sim | 20,2036 |
| Rasgo reto (junta) | solta, a alavanca gira livre em torno do pino | sim | 0,2552 |
| Lei dos gases | isotérmica: isotérmica: P·V constante durante a expansão (±1%) | sim | 0,000% |
| Lei dos gases | isotérmica: a força do gás na parede = (P − P_atm) × A (±0,5%) | sim | 1,00000 |
| Lei dos gases | isotérmica: e é a força que a carga (a mola do trilho) mede (±0,5%) | sim | 1,00000 |
| Lei dos gases | adiabática: adiabática: P·V^γ constante depois da queima (±1%) | sim | 0,000% |
| Lei dos gases | adiabática: a força do gás na parede = (P − P_atm) × A (±0,5%) | sim | 1,00000 |
| Lei dos gases | adiabática: e é a força que a carga (a mola do trilho) mede (±0,5%) | sim | 1,00000 |
| Portas entre câmaras | o segundo pistão só se move depois que a porta é descoberta | sim | evento em 112,5 ms, movimento em 112,5 ms |
| Portas entre câmaras | com a porta aberta, as pressões se igualam (diferença < 1% no fim) | sim | 0,0000 |
| Portas entre câmaras | e a porta continua aberta | sim | 1,0000 |
| Cilindro de dois pistões (cena de teste) | os dois se afastam: o bloco recua | sim | 2,5530 |
| Cilindro de dois pistões (cena de teste) | e o pistão avança pelo furo | sim | 521,2448 |
| Cilindro de dois pistões (cena de teste) | vedada, os impulsos nas duas paredes são iguais e opostos (±2%) | sim | de 0,000000 a 0,000000 em 3 passos |
| Cilindro de dois pistões (cena de teste) | a mola devolve o bloco à posição inicial (±0,2 mm) em até 1 s | sim | 0,0007 |
| Cilindro de dois pistões (cena de teste) | quando o pistão passa o respiro, a pressão cai abaixo de 5% do pico em até 20 ms | sim | caiu em 0,0 ms (pico 103,5) |
| Sensor | abre o respiro: acima do mínimo, o sensor abre o respiro | sim | 1 evento |
| Sensor | abre o respiro: e o gás escapa (abaixo de 5% do pico em 20 ms) | sim | caiu em 4,2 ms (pico 155,2) |
| Sensor | abaixo do mínimo: abaixo do mínimo, nada acontece (sensor) | sim | 0 eventos |
| Sensor | abaixo do mínimo: abaixo do mínimo, nada acontece (respiro) | sim | 0 eventos |
| Sensor | acende: numa segunda cena, o sensor acende a câmara | sim | 1 evento |
| Sensor | acende: e o pistão avança | sim | 10,1636 |
| Sensor | dois toques: dois toques seguidos: o sensor conta os dois | sim | 2 eventos |
| Sensor | dois toques: mas a câmara não reacende | sim | 1 evento |
| Bala de prova | não atravessa a parede de 1 mm | sim | 100 de 100 |
| Corrente de 40 elos | em 5 s, nenhum eixo abre mais que 0,5 mm | sim | 0,2096 |
| Pilha de 200 caixas | em 3 s, nenhuma caixa sai mais de 1 mm do lugar | sim | 0,6697 mm |
| Pinhão e cremalheira | no primeiro trecho, deslocamento da cremalheira = raio primitivo × ângulo (erro < 2%) | sim | 6,02351 |
| Pinhão e cremalheira | penetração entre dentes menor que 0,1 mm | sim | 0,0022 mm |

Observações:

- Pêndulo: o período medido fica 1,73% acima de 2π·√(I/(m·g·d)), que é a fórmula de pequenas amplitudes; a 30° o período real é 1,74% maior.
- Lei dos gases: `P·V` e `P·V^γ` ficam constantes por construção do estado do gás (variação 0,000%). O que a cena mede de fato é a força: a que o solver aplicou na parede bate com (P − P_atm)·A e com a força que a mola de carga mede, a 1 parte em 10⁵.
- Cilindro de dois pistões: a câmara fica vedada só 3 passos (12,5 ms); o pistão leve sai em seguida. Os impulsos iguais e opostos vêm da mesma junta do solver que empurra as duas paredes.
- Nenhum aceite foi afrouxado e nenhum teste novo está marcado como falha esperada. As falhas esperadas antigas do bench continuam marcadas (catraca da cena migrada nos três motores) e uma nova foi marcada no Rapier (razão das engrenagens 2,08%, pelo aço com a densidade real).

## Verificação padrão

- `npm run lint`, `npm run typecheck`, `npm test` (Vitest: 374 testes passam, 4 falhas esperadas da bancada; testes do pipeline de assets), `npm run build`: limpos, sem avisos.
- `npm run check:overflow`: sem rolagem lateral em 360, 390 e 412 px em `/`, `/#bench`, `/#lab` e `/#lab/exemplos/cilindro-dois-pistoes`; alvos de toque ≥ 44 px.
- `npm run test:e2e` (determinismo): hash igual ao do Node nas 26 cenas de `scenes/fixtures/`.
- Pacote: app principal 73,6 KB gzip; motor do app (sob demanda) 222,3 KB gzip de JS e WASM do Box2D, mais 43,6 KB de adaptador, plano e runtime.

## Capturas

`docs/capturas/fase-1/parte-c/` (`npx playwright test --project=lab`), em 390×844 e 1440×900, com a cena parada no meio do movimento:

- `lab-mola-apoiada-*`: as duas molas logo depois do empurrão (a apoiada já solta do bloco).
- `lab-rasgo-curvo-*`: o pino no rasgo em arco, arrastado.
- `lab-cilindro-dois-pistoes-*`: 2 ms depois de acender, o gás a 198 kPa entre o fundo que recua e o pistão.

## O que ficou de fora

- O laboratório desenha com traço simples, sem hachura de material nem linhas de chamada: o renderizador definitivo é da Parte D.
- Os exemplos do protótipo mantêm `p0 = 0` na câmara do lançador (ambiente sem pressão, como na v1) para a carga equivalente valer; uma câmara nova usa a atmosfera.
- A rodada no celular do Will (bancada e laboratório) depende da Vercel.
