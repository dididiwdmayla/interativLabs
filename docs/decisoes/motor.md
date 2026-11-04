# Comparativo de motores de física (Fase 1 · item 4)

Data: 2026-11-04. Situação: **medido no Node e no Chromium; falta o celular do Will.** A escolha do motor é do Will com o coordenador, depois da rodada no celular. Nada no código escolhe o motor: os quatro ficam atrás do mesmo `EngineAdapter` (`src/engine/`).

## Candidatos (versões confirmadas no npm nesta data)

| Motor | Pacote | Versão | Licença | Observação |
| --- | --- | --- | --- | --- |
| Planck | `planck` | 1.5.1 | MIT | Porte em JS do Box2D v2.4 (o motor do protótipo). Configuração global em `Settings` |
| Rapier 2D | `@dimforge/rapier2d-compat` | 0.21.0 | Apache-2.0 | WASM embutido em base64 (funciona igual no Node, no navegador e no worker) |
| Rapier 2D determinístico | `@dimforge/rapier2d-deterministic-compat` | 0.21.0 | Apache-2.0 | Mesma API, matemática determinística entre plataformas |
| Box2D v3.2 | `box2d3-wasm` (build `compat`) | 6.0.0 | MIT | Mantido por um autor só (Birch-san). Tem juntas com motor e limite, filtros de 64 bits, sensores, bala (contínuo) e hash de estado. Sem junta de mouse no v3.2 (o arrasto é comum, ver abaixo) |

Descartados: `box2d-wasm` 7.0.0 e `@box2d/core` 0.11 (Box2D v2, sem manutenção desde 2022–2024), `kool-box2d-wasm` (o próprio README recomenda o `box2d3-wasm` para a web), `phaser-box2d` (porte JS do v3, parado desde 2025-01). O Box2D v3 entrou no comparativo sem custo extra: todas as peças da interface estavam expostas ao JS.

## Como foi medido

- **Mesmo adaptador para todos.** `src/engine/plan.ts` compila a cena num plano comum: parafusos viram corpo composto, cada grupo fixo é um corpo estático próprio, massa e inércia vêm da geometria (densidade × área × 10 mm), não das peças convexas. `src/engine/runtime.ts` aplica, igual em todos, a mola de torção, a mola de retorno do trilho, a mola entre pontos, a câmara (modelo do §4), o sensor com velocidade mínima e o **arrasto** (restrição suave de 6 Hz, amortecimento 0,9, força máxima (600·m + 400) do protótipo, resolvida como impulso a cada passo). Motor, batente e trilho são nativos de cada motor.
- **Passo** fixo de 1/240 s. Iterações: Planck 10 de velocidade + 4 de posição (as do protótipo); Rapier 4 de solver + 1 PGS interna (padrão); Box2D 4 subpassos (padrão). Sem sono, amortecimento angular 0,02.
- **Escala** do comparativo: **1 mm por unidade**. Cena 8 também a 10 mm/un, e a suíte inteira a 10 mm/un no Node (`bench-node-10mm.json`).
- **Gravidade:** as cenas migradas usam a do protótipo (100 mm/s², a calibrada). As sintéticas (pilha, corrente, escalas) usam a mesma, para medir o que o app vai rodar. A rodada com gravidade real está mais abaixo.
- **Cenas e roteiros** em `scenes/fixtures/bench/`, gerados por `npm run bench:scenes` (determinístico). Cada roteiro roda **duas vezes**: a primeira mede; a segunda só refaz o hash das poses (arredondadas a 1e-6 mm, a cada 60 passos).
- **Tempo de passo:** só a chamada `step()` (forças comuns inclusas), mediana e p95. No navegador o relógio tem 100 µs de resolução: lá o tempo é medido em lotes de 10 passos. Não conta compilação nem leitura de snapshot.
- **Penetração:** maior sobreposição entre peças em qualquer passo. **Tremor:** RMS do deslocamento em torno da média das peças que deveriam estar paradas, numa janela de 1 s.
- Máquinas desta sessão: Node 22.23.4 e Chromium 153 headless, Intel Xeon 2,1 GHz, 4 núcleos (contêiner Linux). A suíte inteira leva ~20 s em cada um.

Interpretações registradas nos roteiros: no lançador, o repouso é medido de 0,5 s a 1,5 s (o desenho deixa 0,4 mm entre o pino do percussor e o retém, que fecham ao acomodar) e a saída da esfera conta a partir do disparo do sensor (no protótipo a esfera sai ~0,24 s depois dele). Nas engrenagens, "contra" é uma execução própria a partir do repouso, como no protótipo. No pinhão, o motor tem 1 N·mm (10⁶ g·mm²/s²); a penetração não muda com o torque (testado 0,2 e 1 N·mm).

## Resultado (Node e Chromium desta sessão; colunas do celular a preencher)

| Cena | Motor | Passa | Node mediana / p95 (ms) | Chromium mediana / p95 (ms) | Penetração máx. (mm) | Tremor RMS (mm) | Determinístico | Hash Node = Chromium | Celular: passa | Celular: mediana / p95 (ms) | Celular: hash = Node |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01-lancador | Planck | sim | 0,141 / 0,349 | 0,070 / 0,250 | 0,0531 | 0,0065 | sim | sim |  |  |  |
| 01-lancador | Rapier det. | sim | 0,053 / 0,112 | 0,060 / 0,190 | 0,1138 | 0,0000 | sim | sim |  |  |  |
| 01-lancador | Rapier | sim | 0,051 / 0,133 | 0,060 / 0,120 | 0,1138 | 0,0000 | sim | sim |  |  |  |
| 01-lancador | Box2D v3 | sim | 0,053 / 0,165 | 0,070 / 0,220 | 0,1201 | 0,0001 | sim | sim |  |  |  |
| 02-trava | Planck | sim | 0,043 / 0,089 | 0,020 / 0,110 | 0,0485 | 0,0000 | sim | sim |  |  |  |
| 02-trava | Rapier det. | sim | 0,024 / 0,040 | 0,030 / 0,060 | 0,0881 | 0,0000 | sim | sim |  |  |  |
| 02-trava | Rapier | sim | 0,022 / 0,047 | 0,030 / 0,080 | 0,0881 | 0,0000 | sim | sim |  |  |  |
| 02-trava | Box2D v3 | sim | 0,025 / 0,047 | 0,030 / 0,050 | 0,0576 | 0,0000 | sim | sim |  |  |  |
| 03-engrenagens | Planck | **não** | 0,172 / 0,342 | 0,110 / 0,210 | 0,1067 | 0,0103 | sim | sim |  |  |  |
| 03-engrenagens | Rapier det. | **não** | 0,067 / 0,125 | 0,070 / 0,200 | 0,1616 | 0,0002 | sim | sim |  |  |  |
| 03-engrenagens | Rapier | **não** | 0,067 / 0,166 | 0,080 / 0,190 | 0,1616 | 0,0002 | sim | sim |  |  |  |
| 03-engrenagens | Box2D v3 | **não** | 0,058 / 0,092 | 0,060 / 0,100 | 0,1305 | 0,0000 | sim | **não** |  |  |  |
| 04-pilha | Planck | sim | 1,090 / 2,031 | 0,650 / 1,140 | 0,0347 | 0,0028 | sim | sim |  |  |  |
| 04-pilha | Rapier det. | **não** | 0,287 / 0,355 | 0,300 / 0,390 | 0,1022 | 0,0000 | sim | sim |  |  |  |
| 04-pilha | Rapier | **não** | 0,280 / 0,362 | 0,270 / 0,370 | 0,1022 | 0,0000 | sim | sim |  |  |  |
| 04-pilha | Box2D v3 | **não** | 0,152 / 0,221 | 0,160 / 0,210 | 0,1344 | 0,0062 | sim | sim |  |  |  |
| 05-corrente | Planck | sim | 0,126 / 0,298 | 0,110 / 0,150 | 0,0000 | — | sim | sim |  |  |  |
| 05-corrente | Rapier det. | sim | 0,060 / 0,089 | 0,080 / 0,190 | 0,0000 | — | sim | sim |  |  |  |
| 05-corrente | Rapier | sim | 0,065 / 0,104 | 0,060 / 0,120 | 0,0000 | — | sim | sim |  |  |  |
| 05-corrente | Box2D v3 | sim | 0,072 / 0,123 | 0,080 / 0,150 | 0,0000 | — | sim | sim |  |  |  |
| 06-pinhao-cremalheira | Planck | sim | 0,034 / 0,076 | 0,030 / 0,050 | 0,0464 | — | sim | sim |  |  |  |
| 06-pinhao-cremalheira | Rapier det. | **não** | 0,035 / 0,064 | 0,040 / 0,050 | 0,1350 | — | sim | sim |  |  |  |
| 06-pinhao-cremalheira | Rapier | **não** | 0,037 / 0,068 | 0,030 / 0,050 | 0,1350 | — | sim | sim |  |  |  |
| 06-pinhao-cremalheira | Box2D v3 | **não** | 0,029 / 0,054 | 0,040 / 0,060 | 0,1348 | — | sim | sim |  |  |  |
| 07-bala | Planck | sim | 0,005 / 0,033 | 0,010 / 0,020 | 0,0000 | — | sim | sim |  |  |  |
| 07-bala | Rapier det. | sim | 0,008 / 0,025 | 0,020 / 0,030 | 0,0485 | — | sim | sim |  |  |  |
| 07-bala | Rapier | sim | 0,008 / 0,021 | 0,010 / 0,030 | 0,0485 | — | sim | sim |  |  |  |
| 07-bala | Box2D v3 | sim | 0,011 / 0,024 | 0,030 / 0,060 | 1,8800 | — | sim | sim |  |  |  |
| 08-escalas | Planck | sim | 0,135 / 0,198 | 0,100 / 0,140 | 0,0125 | 0,0000 | sim | sim |  |  |  |
| 08-escalas | Rapier det. | sim | 0,032 / 0,059 | 0,030 / 0,060 | 0,0000 | 0,0000 | sim | sim |  |  |  |
| 08-escalas | Rapier | sim | 0,030 / 0,047 | 0,030 / 0,060 | 0,0000 | 0,0000 | sim | sim |  |  |  |
| 08-escalas | Box2D v3 | sim | 0,022 / 0,036 | 0,060 / 0,090 | 0,0009 | 0,0000 | sim | sim |  |  |  |
| 08-escalas (10 mm/un) | Planck | sim | 0,133 / 0,186 | 0,090 / 0,130 | 0,1242 | 0,0000 | sim | sim |  |  |  |
| 08-escalas (10 mm/un) | Rapier det. | sim | 0,032 / 0,052 | 0,040 / 0,070 | 0,0000 | 0,0000 | sim | sim |  |  |  |
| 08-escalas (10 mm/un) | Rapier | sim | 0,031 / 0,048 | 0,060 / 0,100 | 0,0000 | 0,0000 | sim | sim |  |  |  |
| 08-escalas (10 mm/un) | Box2D v3 | sim | 0,022 / 0,042 | 0,030 / 0,060 | 0,0009 | 0,0000 | sim | sim |  |  |  |

Falhas (as mesmas no Node e no Chromium):

- 03-engrenagens · Planck: contra, o conjunto para antes de girar um passo de dente da catraca (25,7°) → 28,4°
- 03-engrenagens · Rapier det.: contra, o conjunto para antes de girar um passo de dente da catraca (25,7°) → 34,1°
- 03-engrenagens · Rapier: contra, o conjunto para antes de girar um passo de dente da catraca (25,7°) → 34,1°
- 03-engrenagens · Box2D v3: contra, o conjunto para antes de girar um passo de dente da catraca (25,7°) → 35,1°
- 04-pilha · Rapier det.: após 3 s, nenhuma caixa saiu mais de 1 mm do lugar → 1,352 mm
- 04-pilha · Rapier: após 3 s, nenhuma caixa saiu mais de 1 mm do lugar → 1,352 mm
- 04-pilha · Box2D v3: após 3 s, nenhuma caixa saiu mais de 1 mm do lugar → 1,365 mm
- 06-pinhao-cremalheira · Rapier det.: penetração entre dentes menor que 0,1 mm → 0,1350 mm
- 06-pinhao-cremalheira · Rapier: penetração entre dentes menor que 0,1 mm → 0,1350 mm
- 06-pinhao-cremalheira · Box2D v3: penetração entre dentes menor que 0,1 mm → 0,1348 mm

### Leitura

- **Catraca (todos):** o problema é da cena migrada, não do motor. Com contato exato, a lingueta desce até o batente de −25° antes de segurar, e a catraca gira 1,1 a 1,4 passo. No protótipo (Planck a 10 mm/un) ela parava em 24,4°: a "pele" de 0,1 mm dos polígonos do Planck nessa escala segurava a lingueta antes (conferido rodando o `engine.js` do protótipo). O "~13°" do README do protótipo é o giro da engrenagem motora.
- **Pilha e pinhão (Rapier e Box2D):** os dois usam contato macio (mola de 30 Hz). A pilha de 20 caixas afunda 1,35 mm em 3 s; no pinhão, cada inversão fecha a folga de 0,08 mm a ~38 mm/s e o contato afunda 0,135 mm. O Planck (contato rígido com correção de posição) passa nos dois.
- **Desempenho:** em cena leve todos ficam abaixo de 0,2 ms por passo. Na pilha de 200 caixas, o Box2D é o mais rápido (0,15 ms no Node, 0,16 no Chromium), o Rapier fica em 0,27–0,30 ms e o Planck em 0,65–1,09 ms, com p95 de 1,1–2,0 ms. A 60 quadros são 4 passos por quadro: o Planck gasta 2,6–4,4 ms de física por quadro nesta máquina, e um celular intermediário deve ser 3 a 5 vezes mais lento.
- **Rapier determinístico × padrão:** resultados idênticos (mesmos hashes nesta máquina). Custo do determinístico na pilha: +2% no Node, +11% no Chromium; nas cenas leves, dentro do ruído.

### Determinismo

- Duas execuções no mesmo ambiente: hash igual em **todas** as cenas, nos quatro motores.
- **Node × Chromium:** 35 de 36 hashes iguais. A exceção é o Box2D na cena 3. Causa provável, conferida à parte: `Math.atan2`, `Math.sin`, `Math.cos`, `Math.exp` e `Math.acos` dão resultados diferentes no último bit entre o V8 do Node 22 e o do Chromium 153 (200 000 amostras; só `Math.hypot` bateu). O adaptador do Box2D lê o ângulo com `Math.atan2`; o motor em si é WASM e determinístico.
- Consequência para o item 5: para o mesmo hash entre aparelhos, o código comum (runtime, adaptador) não pode usar as funções transcendentais do JS; precisa de versões próprias determinísticas, ou das do motor. O Planck usa `Math.sin/cos` por dentro e não tem como garantir isso; Rapier determinístico e Box2D têm.
- O celular do Will mostra o caso real: a coluna "hash = Node" diz se o mesmo arquivo dá o mesmo resultado no telefone.

## Gravidade real (9,81 m/s²), só no Node

`npm run bench:scenes` com `BENCH_G=9810` (`bench-node-gravidade-real.json`):

| Cena | Motor | Passa | Valor que falhou | Passo mediana / p95 (ms) |
| --- | --- | --- | --- | --- |
| 04-pilha | Planck | **não** | 39193,115 mm | 2,328 / 7,089 |
| 04-pilha | Rapier det. | **não** | 1049,624 mm | 1,214 / 1,760 |
| 04-pilha | Rapier | **não** | 1049,624 mm | 1,198 / 2,121 |
| 04-pilha | Box2D v3 | **não** | 38338,668 mm | 0,451 / 0,697 |
| 05-corrente | Planck | **não** | 1,895 mm | 0,126 / 0,313 |
| 05-corrente | Rapier det. | **não** | 0,851 mm | 0,072 / 0,146 |
| 05-corrente | Rapier | **não** | 0,851 mm | 0,061 / 0,114 |
| 05-corrente | Box2D v3 | **não** | 11,188 mm | 0,074 / 0,132 |
| 08-escalas | Planck | sim | — | 0,239 / 0,613 |
| 08-escalas | Rapier det. | sim | — | 0,035 / 0,054 |
| 08-escalas | Rapier | sim | — | 0,037 / 0,058 |
| 08-escalas | Box2D v3 | sim | — | 0,024 / 0,039 |
| 08-escalas (10 mm/un) | Planck | **não** | 0,0511 mm | 0,189 / 0,389 |
| 08-escalas (10 mm/un) | Rapier det. | sim | — | 0,032 / 0,054 |
| 08-escalas (10 mm/un) | Rapier | sim | — | 0,038 / 0,072 |
| 08-escalas (10 mm/un) | Box2D v3 | sim | — | 0,022 / 0,041 |

Com peças de 10 mm sob gravidade real, nenhum motor segura a pilha (afunda e desaba) nem a corrente (eixos abrem 0,85 a 11 mm) com os parâmetros padrão. Para eles, é como empilhar caixas de 1 m sob 100 g. Se o app quiser gravidade real em escala de milímetro, vai precisar de contato mais rígido e mais subpassos, medidos num item próprio.

## Escala interna e limite de velocidade (proposta)

- **1 mm por unidade.** A 10 mm/un o Planck emperra as engrenagens de módulo 1 (a pele de polígono, 2 × `linearSlop` = 0,1 mm, passa da folga de 0,04 mm) e trava o pinhão; falha também no tremor da cena 8 com gravidade real. Rapier e Box2D dão o mesmo resultado nas duas escalas, exceto o pinhão, que passa a 10 mm/un nos dois. A 1 mm/un os números da cena são os do motor, sem conversão.
- **Limite de velocidade: 40 m/s** (40 000 mm/s), comum aos três: Planck com `Settings.maxTranslation` = 166,7 unidades por passo; Box2D com `maximumLinearSpeed` = 40 000 unidades/s (o padrão, 400 unidades/s, seria 0,4 m/s nesta escala); Rapier não limita. A bala de 20 m/s passa nos quatro, sem atravessar a parede de 1 mm em 100 lançamentos.

## Tamanho do pacote (build de produção, gzip nível 9)

Medido por `npm run bench:size` (`bundle-size.json`). Todos ficam fora do pacote principal (71,8 KB gzip, igual ao de antes): só carregam na bancada.

| Pacote | JS | WASM | gzip total |
| --- | --- | --- | --- |
| Planck | 205,9 KB | — | **45,8 KB** |
| Rapier determinístico (compat) | 3 367 KB (WASM em base64) | — | **1 263 KB** |
| Rapier padrão (compat) | 3 326 KB (WASM em base64) | — | **1 251 KB** |
| Box2D v3 (compat) | 30,1 KB | 597,6 KB | **218,8 KB** |
| Comum (plano, runtime, geometria, bancada) | 295,0 KB | — | 72,7 KB |

O Rapier sem o "compat" (WASM em arquivo à parte) ficaria em ~930 KB gzip (WASM de 2,4 MB → 919 KB + 32 KB de JS, medido no pacote npm), mas exige configurar o carregamento do WASM no Vite.

## Recomendação (provisória, até o celular)

**Box2D v3 (`box2d3-wasm`, build compat), a 1 mm por unidade, com `contactHertz` = 60.**

1. Comportamento: com o padrão passa em 5 de 8 cenas; com `contactHertz` 60 passa também na pilha (0,03 mm de penetração) e no pinhão (0,078 mm), medido nesta sessão. Sobra só a catraca, que é da cena.
2. Desempenho: o mais rápido onde pesa (pilha: 0,15–0,16 ms por passo, 4 a 7 vezes mais rápido que o Planck; p95 0,21–0,22 contra 1,1–2,0 ms). É o único com folga clara para a meta de 60 quadros com 150 peças no celular.
3. Determinismo: o motor é WASM e determinístico entre plataformas; a diferença Node × Chromium vem da leitura de ângulo em JS, que tem conserto no item 5.
4. Tamanho: 219 KB gzip, carregado só no modo Simular.
5. Riscos: projeto de um mantenedor só; a API do WASM aloca objeto por chamada (`b2Vec2`), o que pede cuidado no adaptador; o build com SIMD e threads (`deluxe`) exige isolamento de origem e não foi medido.

Segunda opção: **Rapier determinístico**, com frequência de contato de 120 Hz (passa pilha e pinhão nesta sessão). Mais pesado (1,26 MB, ou ~0,93 MB sem o compat) e mais lento que o Box2D na pilha, mas com determinismo garantido pelo próprio pacote e manutenção de uma empresa.

O **Planck** é o que mais passa sem ajuste (7 de 8) e o menor (46 KB), mas é o mais lento nas cenas pesadas e não tem como garantir determinismo entre navegadores. Vale como reserva se o celular mostrar problema com WASM.

## O que cada motor exigiria para passar no que falhou

| Falha | Planck | Rapier (det. e padrão) | Box2D v3 |
| --- | --- | --- | --- |
| Catraca: gira mais que um passo | Mudar a cena (batente da lingueta em ~−12°, ou outra lingueta) ou o critério. Passa a 10 mm/un só por causa da pele de 0,1 mm, que quebra as engrenagens | Mudar a cena ou o critério | Mudar a cena ou o critério |
| Pilha: afunda 1,35 mm | — (passa) | `integrationParameters.contact_natural_frequency` = 120 Hz (medido: passa; com 60 Hz também passa a pilha, mas não o pinhão). Mais iterações sozinhas (8) não bastam | `contactHertz` = 60 (medido: passa). Com 120 Hz precisa de 8 subpassos para o pinhão continuar passando |
| Pinhão: penetração 0,135 mm | — (passa, 0,046 mm) | 120 Hz de contato (0,076 mm) | `contactHertz` 60 (0,078 mm) |
| Engrenagens a 10 mm/un | Escala de 1 mm/un, ou `Settings.linearSlop` 10 vezes menor | — | — |
| Determinismo entre aparelhos | Não há como garantir (usa `Math.sin/cos`) | Usar a variante determinística e tirar as funções transcendentais do JS comum | Ler o ângulo pelo Box2D (ou atan2 próprio) e tirar as funções transcendentais do JS comum |
| Gravidade real em escala de mm | Fora do alcance com o passo de 1/240 s; precisa de item próprio | Idem | Idem |

## Para o celular do Will

1. Abrir o link de prévia da Vercel com `/#bench` no fim.
2. A medição começa sozinha; tocar em "Rodar de novo" refaz do zero. Esperar o "Pronto".
3. Tocar em "Copiar resultado" e colar no chat do coordenador (vai a tabela em texto e o JSON completo; se o navegador não deixar copiar, o texto aparece selecionado numa caixa).

As colunas "Celular" da tabela acima são preenchidas com esse resultado.
