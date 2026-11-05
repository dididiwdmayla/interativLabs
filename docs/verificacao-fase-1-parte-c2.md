# Verificação — Fase 1 · Parte C2 (objeto padrão: lançador de ferrolho)

Data: 05/11/2026. Branch `ccr-df64b70c-ikzcue` (o branch de trabalho desta sessão; o prompt pedia `fase-1-parte-c2`). Máquina: Node 22 e Chromium headless, 4 núcleos, sem GPU.

## Itens

| Item | Feito | Commit |
| --- | --- | --- |
| 12.1 Desenho do mecanismo | `scenes/examples/lancador-ferrolho.json` (v2), gerado por `scripts/fixtures/ferrolho.ts` (`npm run fixtures -- ferrolho`). Ajuste no motor: doses da carga (`charge.shots`), com a cena de teste `gas/cargas`. Executor: velocidade como grandeza, janela no `dropsAfter` e a afirmação `returnsAfter` | `e57042d` |
| 12.2 Cena de teste do ciclo | `scenes/fixtures/exemplos/lancador-ferrolho.test.json`: 4 execuções, 54 afirmações, todas passam; hash em `scenes/fixtures/hashes.json` | `59f3aa8` |
| 12.3 Padrão do app e laboratório | `scenes/examples/index.json` com `lancador-ferrolho` no começo e como `default`; o `/#lab` descobre a cena (`/#lab/exemplos/lancador-ferrolho`) | `f07272f` |
| 12.4 Verificação | Este documento, capturas, `check:overflow` com a rota nova, nota das doses na arquitetura §3.1 | commit deste documento |

## O mecanismo

Coordenadas em mm, x para a boca e y para baixo; 200 × 82 mm (da traseira da armação, x = −116, à boca, x = 84; da armação, y = −12, ao pé da empunhadura, y = 70). Números de chamada: armação 1–4, ferrolho 10–19, disparo 20–21, gatilho 30–31, ligações 40–58.

1. **Armação** (3 mm, fixa): corpo com empunhadura, guarda e o rasgo do pino da barra (1); cano (2) e canal do carregador (3), na camada 2, parafusados ao corpo (40, 41); haste-guia da mola de retorno (4). Os batentes do ferrolho são os limites do trilho 43 (0 e −22 mm).
2. **Ferrolho** (4 mm; com essa espessura a esfera de Ø 6 mm tem a massa da esfera de aço real, 0,89 g): ferrolho (10) num trilho da armação (43), com a luva (11) parafusada (42); mola de retorno apoiada (44) na haste-guia, pré-carregada com 0,9 N contra o batente da frente; amortecedor de fim de curso (45, mola apoiada macia e amortecida entre o cano e o ferrolho: só freia a volta); êmbolo (12) num trilho do ferrolho (46) correndo dentro da luva; câmara de gás (47) com duas paredes, o êmbolo à frente e o ferrolho atrás, e um respiro sempre aberto; seis esferas (13–18), uma na câmara (num assento em V de 1,5 mm no piso do cano) e cinco no canal, empurradas pelo empurrador (19) num trilho (48) com mola apoiada (49).
3. **Disparo** (3 mm): percussor (20) num trilho do ferrolho (50) com mola presa (51); retém (21) num eixo da armação (52) com mola de torção e batente; sensor (53) na armação, no fundo da câmara, que acende uma dose da carga.
4. **Gatilho** (3 mm): gatilho (30) num eixo da armação (54) com mola de torção; barra do gatilho (31) num eixo do gatilho (55) com mola de torção, com um pino da camada 1 à 4 (56) correndo no rasgo do corpo (57, contato) e um pino das camadas 3–4 (58) que empurra o braço do retém.

Por onde a força passa: o dedo gira o gatilho (camada 4); a barra leva o pino 58 até o braço do retém (camada 3), que solta a espora do percussor; o percussor, preso ao ferrolho (camada 2) pelo trilho 50, cruza o sensor da armação (camada 1 → câmara 47); o gás empurra o êmbolo, que empurra a esfera (camada 2), e o ferrolho para trás; o ressalto do êmbolo bate no fundo do cano (batente da armação) e o gás segue empurrando só o ferrolho até ele desvedar (16 mm de curso); o ferrolho arrasta o percussor pelo limite do trilho 50 por cima do retém, comprime a mola de retorno na haste e descobre o carregador; na volta, freada pelo amortecedor, o êmbolo empurra a próxima esfera para o assento da câmara e o retém segura a espora.

**Desconector**: a borda de cima do rasgo 57 desce no fim do curso do gatilho e abaixa a barra; o pino 58 escorrega por baixo do braço do retém, que volta a subir e pega o percussor no recuo mesmo com o gatilho segurado. Soltando o gatilho, o pino passa por baixo do chanfro do braço e volta para trás dele.

### O que mudou em relação à lista do prompt, e por quê

- **A parede da frente da câmara é o êmbolo, não a esfera.** A parede de uma câmara é uma peça fixa da cena e cada tiro usa uma esfera diferente; com a esfera como parede, só a primeira seria empurrada. O êmbolo (haste de impulso de polímero, 0,74 g) é a parede da frente e empurra qualquer esfera que esteja na câmara. Acrescentei também a **luva** (o cilindro do gás, parafusada no ferrolho): ela fecha a boca do carregador enquanto o êmbolo anda, senão a próxima esfera subiria para dentro da câmara de gás.
- **Câmara de 15 mm e êmbolo com batente na armação.** Com folga de 2 mm entre as paredes e o êmbolo parando no ferrolho, a esfera saía a menos de 2 m/s e o ferrolho quase não recuava: a força do gás é uma mola relinearizada a cada passo de 1/240 s e entrega, por passo, um empurrão da ordem de L/γ. Com 15 mm de câmara e o ressalto do êmbolo batendo no fundo do cano, o gás empurra a esfera e depois só o ferrolho (o recuo do fundo de verdade).
- **Sensor na armação, não no ferrolho.** No recuo de 22 mm o percussor quica para trás no fim do curso e volta; com o sensor no ferrolho, ele acendia uma segunda dose com o ferrolho aberto. Na armação, no fundo da câmara, o percussor só o alcança com o ferrolho fechado.
- **Amortecedor de fim de curso e assento em V, em vez de um retentor de mola.** Um retentor com mola na frente da esfera atrapalhava o tiro (a esfera parava nele no passo do disparo). A volta lenta do ferrolho (~0,1 m/s, pelo amortecedor, que só age na volta) deixa a esfera chegar devagar, e um assento de 1,5 mm no piso a segura; o gás a tira de lá sem esforço.
- **Respiro sempre aberto (Ø 0,5 mm)** no meio da câmara: drena o gás que fica entre o êmbolo e o ferrolho quando a câmara volta a vedar (sem ele, o êmbolo ficava parado no meio do curso, sobre um colchão de gás).
- Peças da lista que viraram outra coisa: os "batentes" da armação são os limites do trilho do ferrolho; o "ressalto do ferrolho que leva o percussor para trás" é o limite do trilho do percussor.

## Ajuste no motor

**Doses da carga** (`gas.charge.shots`, opcional, inteiro ≥ 1, padrão 1). A câmara acendia uma vez só por simulação; um lançador que repete precisa de uma dose por tiro (como um reservatório que solta uma dose a cada batida do percussor). Cada acendimento queima uma dose inteira; acendimento durante a queima da dose anterior é ignorado. O snapshot da câmara ganhou `shots` (doses já acesas). Sem o campo, o comportamento é o de antes: os hashes das 27 cenas de teste antigas não mudaram. O lançador usa 12 doses.

Teste: `gas/cargas` (abaixo) e `src/model/schema.test.ts` (o campo é opcional, inteiro, ≥ 1). Não houve mudança de versão do formato: a v2 continua lendo todas as cenas existentes, e uma cena com `shots` não é lida por uma versão anterior do app (que ainda não existe publicada).

Testei também travar o sinal da força linearizada do gás dentro do passo (ela pode cruzar o zero quando as paredes andam mais que F/k num passo). No desenho final não mudou nada (8,59 × 8,57 m/s), então ficou de fora.

## Afirmações e valores medidos

Node e Box2D calibrado; o Chromium dá o mesmo hash (`npm run test:e2e`: 29 cenas). Valores sem unidade estão na unidade da grandeza (mm, rad, mm/s).

| Execução | Afirmação | Passa | Medido |
| --- | --- | --- | --- |
| repouso | parado, nenhuma peça se move mais que 0,2 mm depois de 0,5 s | sim | 0,00 mm |
| repouso | o retém segura o percussor armado | sim | de 0,08 a 0,08 |
| repouso | e o sensor não dispara | sim | 0 eventos |
| repouso | o carregador mantém a próxima esfera encostada na luva (sem folga) | sim | de 5,59 a 5,59 |
| repouso | a esfera 1 fica na câmara | sim | 9,65 |
| repouso | a esfera 1 fica na câmara (assentada) | sim | 1,29 |
| disparo, com o gatilho segurado | o sensor dispara exatamente 1 vez | sim | 1 evento |
| disparo, com o gatilho segurado | desconexão: com o gatilho segurado por mais de 1 s, não há segundo disparo | sim | 1 evento |
| disparo, com o gatilho segurado | a esfera sai pela boca a 5–20 m/s | sim | de 8137,57 a 8137,65 em 4 passos |
| disparo, com o gatilho segurado | o ferrolho recua pelo menos 18 mm (rearma o percussor e abre o carregador) | sim | 22,00 |
| disparo, com o gatilho segurado | o ferrolho volta ao batente da frente em até 0,3 s | sim | voltou em 262,5 ms |
| disparo, com o gatilho segurado | o gás não fica preso (abaixo de 5% do pico em 20 ms) | sim | caiu em 0,0 ms (pico 1859,0) |
| disparo, com o gatilho segurado | com o gatilho ainda puxado, o percussor está preso no retém | sim | 0,08 |
| disparo, com o gatilho segurado | e o gatilho continua puxado | sim | 0,28 |
| disparo, com o gatilho segurado | soltando o gatilho, o percussor continua preso | sim | 0,08 |
| disparo, com o gatilho segurado | a esfera 2 está na câmara | sim | 9,65 |
| disparo, com o gatilho segurado | a esfera 2 está na câmara (assentada) | sim | 1,29 |
| seis ciclos e o carregador vazio | sete puxões, sete acendimentos do sensor | sim | 7 eventos |
| seis ciclos e o carregador vazio | e sete cargas | sim | 7 eventos |
| seis ciclos e o carregador vazio | a esfera 1 sai pela boca a 5–20 m/s | sim | de 8137,57 a 8137,65 em 4 passos |
| seis ciclos e o carregador vazio | a esfera 2 sai pela boca a 5–20 m/s | sim | de 8205,40 a 8205,41 em 4 passos |
| seis ciclos e o carregador vazio | a esfera 3 sai pela boca a 5–20 m/s | sim | de 8204,12 a 8204,20 em 4 passos |
| seis ciclos e o carregador vazio | a esfera 4 sai pela boca a 5–20 m/s | sim | de 8195,57 a 8195,65 em 4 passos |
| seis ciclos e o carregador vazio | a esfera 5 sai pela boca a 5–20 m/s | sim | de 8215,83 a 8215,84 em 4 passos |
| seis ciclos e o carregador vazio | a esfera 6 sai pela boca a 5–20 m/s | sim | de 8183,15 a 8183,16 em 4 passos |
| seis ciclos e o carregador vazio | ciclo 1: o ferrolho recua e volta ao batente em até 0,3 s | sim | voltou em 262,5 ms |
| seis ciclos e o carregador vazio | ciclo 1: termina com o percussor preso no retém | sim | 0,08 |
| seis ciclos e o carregador vazio | ciclo 1: termina com o ferrolho no batente | sim | 0,00 |
| seis ciclos e o carregador vazio | ciclo 2: o ferrolho recua e volta ao batente em até 0,3 s | sim | voltou em 258,3 ms |
| seis ciclos e o carregador vazio | ciclo 2: termina com o percussor preso no retém | sim | 0,08 |
| seis ciclos e o carregador vazio | ciclo 2: termina com o ferrolho no batente | sim | 0,00 |
| seis ciclos e o carregador vazio | ciclo 3: o ferrolho recua e volta ao batente em até 0,3 s | sim | voltou em 254,2 ms |
| seis ciclos e o carregador vazio | ciclo 3: termina com o percussor preso no retém | sim | 0,08 |
| seis ciclos e o carregador vazio | ciclo 3: termina com o ferrolho no batente | sim | 0,00 |
| seis ciclos e o carregador vazio | ciclo 4: o ferrolho recua e volta ao batente em até 0,3 s | sim | voltou em 241,7 ms |
| seis ciclos e o carregador vazio | ciclo 4: termina com o percussor preso no retém | sim | 0,08 |
| seis ciclos e o carregador vazio | ciclo 4: termina com o ferrolho no batente | sim | 0,00 |
| seis ciclos e o carregador vazio | ciclo 5: o ferrolho recua e volta ao batente em até 0,3 s | sim | voltou em 225,0 ms |
| seis ciclos e o carregador vazio | ciclo 5: termina com o percussor preso no retém | sim | 0,08 |
| seis ciclos e o carregador vazio | ciclo 5: termina com o ferrolho no batente | sim | 0,00 |
| seis ciclos e o carregador vazio | ciclo 6: o ferrolho recua e volta ao batente em até 0,3 s | sim | voltou em 225,0 ms |
| seis ciclos e o carregador vazio | ciclo 6: termina com o percussor preso no retém | sim | 0,08 |
| seis ciclos e o carregador vazio | ciclo 6: termina com o ferrolho no batente | sim | 0,00 |
| seis ciclos e o carregador vazio | ciclo 7: o ferrolho recua e volta ao batente em até 0,3 s | sim | voltou em 195,8 ms |
| seis ciclos e o carregador vazio | ciclo 7: termina com o percussor preso no retém | sim | 0,09 |
| seis ciclos e o carregador vazio | ciclo 7: termina com o ferrolho no batente | sim | 0,00 |
| seis ciclos e o carregador vazio | carregador vazio: o gás não fica preso (abaixo de 5% do pico em 20 ms) | sim | caiu em 0,0 ms (pico 1879,9) |
| arrasto manual | o dedo leva o ferrolho até o fim do curso | sim | de -22,00 a -22,00 |
| arrasto manual | o percussor não acende a carga | sim | 0 eventos |
| arrasto manual | soltando, a esfera 2 entra na câmara | sim | 9,65 |
| arrasto manual | soltando, a esfera 2 entra na câmara (assentada) | sim | 1,29 |
| arrasto manual | e o ferrolho volta ao batente | sim | 0,00 |
| arrasto manual | com o percussor preso | sim | 0,08 |
| arrasto manual | a esfera que estava na câmara sai rolando pela boca (não há extrator) | sim | 155,33 |

Cena de teste do ajuste no motor (`gas/cargas`):

| Execução | Afirmação | Passa | Medido |
| --- | --- | --- | --- |
| duas doses, dois toques | o sensor conta os dois toques | sim | 2 eventos |
| duas doses, dois toques | e a câmara acende duas vezes | sim | 2 eventos |
| duas doses, dois toques | o estado conta as duas doses | sim | 2,00 |
| uma dose (padrão), dois toques | o sensor conta os dois toques | sim | 2 eventos |
| uma dose (padrão), dois toques | mas a câmara acende uma vez só | sim | 1 evento |
| durante a queima | um acendimento durante a queima não gasta dose; depois dela, gasta | sim | 2,00 |
| durante a queima | no meio da queima, uma dose só | sim | 1,00 |

Observações:

- "Encostada" na repouso: a esfera de cima do carregador assenta 0,21 mm dentro da face de baixo da luva (contato macio do Box2D sob os 0,45 N da mola do carregador); a afirmação pede que não haja folga e que ela fique parada.
- "Caiu em 0,0 ms": a pressão cai abaixo de 5% do pico no mesmo passo em que o ferrolho desveda (16 mm de curso). O pico de 1,86–1,88 MPa (manométrico) é didático e vem da dose entrar inteira em 1 ms na câmara de 15 mm.
- O roteiro puxa o gatilho com o dedo (arrasto de 30 Hz, como o do app); entre o começo do puxão e o tiro passam 225 ms.

## Números do mecanismo

| Grandeza | Valor |
| --- | --- |
| Massas | ferrolho + luva 1,95 g (polímero); êmbolo 0,74 g (polímero); esfera 0,89 g (aço, Ø 6 mm); empurrador 0,12 g; percussor 0,49 g (alumínio); retém 0,63 g (alumínio); gatilho 2,33 g (aço); barra 2,03 g (alumínio) |
| Mola de retorno (44) | apoiada, 0,015 N/mm, pré-carga 0,9 N no batente (1,23 N no fim do curso), na haste-guia |
| Amortecedor (45) | apoiada, 0,002 N/mm, 0,009 N·s/mm, só na volta |
| Mola do percussor (51) | presa, 0,025 N/mm: 0,26 N armado; bate no sensor a 1,37 m/s (mínimo 0,8 m/s) |
| Mola do carregador (49) | apoiada, 0,008 N/mm, 0,45 N com a coluna cheia, 0,0003 N·s/mm |
| Retorno do êmbolo (46) | 0,05 N/mm, 0,0004 N·s/mm; curso livre 40 mm, batente no fundo do cano a 14,4 mm |
| Torção | retém 3 N·mm/rad (0,9 N·mm de pré-carga); gatilho 4 N·mm/rad (1,2 N·mm); barra 8 N·mm/rad (2,4 N·mm) |
| Carga | adiabática (γ 1,4), 0,45 mmol por dose, queima de 1 ms, 12 doses; câmara Ø 6 mm × 15 mm; respiro Ø 0,5 mm; o ferrolho desveda com 16 mm de recuo |
| Velocidade de saída | 8,14 a 8,22 m/s nas seis esferas (≈ 30 mJ) |
| Curso do ferrolho | 22 mm (até o batente de trás) em todos os tiros, inclusive o vazio |
| Tempo do ciclo | do tiro ao ferrolho fechado e percussor preso: 196 a 263 ms (o vazio, sem esfera para empurrar, é o mais rápido); do começo do puxão ao tiro: 225 ms |

## Verificação padrão

- `npm run lint`, `npm run typecheck`, `npm test` (Vitest: 474 testes + 4 falhas esperadas antigas da bancada; testes do pipeline de assets) e `npm run build`: limpos, sem avisos.
- `npm run check:overflow`: sem rolagem lateral em 360, 390 e 412 px, agora também em `/#lab/exemplos/lancador-ferrolho`.
- `npm run test:e2e`: hash do Chromium igual ao do Node nas 29 cenas de `scenes/fixtures/`.
- O app (`/`) abre com o lançador de ferrolho como Fig. 1, no renderizador da Parte D.

## Capturas

`docs/capturas/fase-1/parte-c2/` (`npx playwright test --project=capture-c2`), em 390×844 e 1440×900, na execução "disparo" do `/#lab`:

- `lab-repouso-*`: armado, uma esfera na câmara e cinco no carregador.
- `lab-meio-do-recuo-*` (t = 0,533 s): o êmbolo no batente, o gás a 781 kPa empurrando o ferrolho para trás, a esfera no meio do cano.
- `lab-esfera-saindo-*` (t = 0,542 s): a esfera na boca, o ferrolho no batente de trás com a mola de retorno comprimida, a próxima esfera começando a subir.
- `lab-nova-esfera-entrando-*` (t = 0,679 s): o êmbolo empurrando a esfera 2 para a câmara, a coluna subindo.

## Riscos e pendências

- **Regime de velocidade.** Com mais carga (0,55 a 0,7 mmol) algumas esferas saem a ~5,5 m/s em vez de ~9: o êmbolo é uma bala contra uma esfera comum e o momento do contato no passo muda o resultado. Com 0,45 mmol as seis saem a 8,1–8,2 m/s. Quem editar a carga pode cair perto do limite de 5 m/s.
- **Volta do ferrolho** em 263 ms no primeiro tiro, perto do limite de 0,3 s; mais amortecimento deixa a esfera chegar devagar ao assento, menos deixa ela passar dele (precisa chegar abaixo de ~0,13 m/s).
- **O disparo cabe em um ou dois passos** de 1/240 s: em 0,05× o tiro aparece em saltos (a esfera anda ~34 mm por passo). É o limite do passo fixo, não do desenho.
- **Eventos de `ignite` pelo roteiro** não aparecem no snapshot (o runtime limpa os eventos no começo do passo); o sensor não tem esse problema. Achado ao escrever `gas/cargas`, que mede pelo campo `shots`; não corrigi por não ser desta parte.
- O laboratório desenha com traço simples; o renderizador da Parte D mostra a cena no app. A legibilidade no celular (peças de 2 a 5 mm de altura no enquadramento de 200 mm) fica para a revisão do Will.
