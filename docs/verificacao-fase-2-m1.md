# Fase 2 · M1 — verificação (M1v)

Sessão de verificação da M1 (instrumentos e variantes), depois das duas sessões de criação (M1a, PR #14; M1b, PR #15). Fecha as leituras do motor que ficaram abertas, acerta o que a revisão achou e roda a bateria completa. O `main` entrou nesta sessão com dois testes vermelhos de propósito (pico da esfera e folga com penetração); saem os dois verdes, sem afrouxar tolerância.

## Entrega

| Item | Commit | Estado |
| --- | --- | --- |
| 7.1 · Leituras do motor | `2f3e056` | Feito. Todos os aceites passam (tabela abaixo). |
| 7.2 · Acertos da revisão da M1b | `5e5faa7` | Feito. pt-BR numa função só, resumo em duas linhas, "Experimente comparar" medido. |
| 7.3 · Bateria e casos | `93d75ac` e o commit desta verificação | Feito. Dois defeitos achados e corrigidos (abaixo). |
| 7.4 · Documentação | commit desta verificação | `docs/arquitetura.md` §10, README ("Usar"), este relatório e `docs/decisoes/desempenho.md`. |

## 7.1 — leituras do motor e aceites

De onde sai cada leitura nova (funções do `box2d3-wasm` 6.0.0 conferidas nos tipos instalados):

| Leitura | Origem |
| --- | --- |
| Folga com penetração | `b2Body_GetContactData` → `manifold.GetPoint(k).separation` entre os corpos das duas peças (a menor, negativa na penetração). Sem contato (as duas peças fixas, ou antes do primeiro passo), a separação geométrica das peças convexas (`src/geometry/penetration.ts`); sem toque, `b2ComputeShapeDistance`, como antes |
| Força no pino e no rasgo por contato | `b2Body_GetContactData` → `normalImpulse` e `tangentImpulse` de cada ponto, somados como vetor sobre as formas do pino (no rasgo, só os contatos com a peça-guia), ÷ subpasso do solver (`dt / 4`). Os impulsos do Box2D v3 são por subpasso, não por passo: a conta dá o peso sem fator nenhum de ajuste |
| Torque no eixo | `b2Joint_GetConstraintTorque` (motor, atrito e batentes) **mais** a mola de torção pela própria lei (`LinkState.torsionTorque`): medido, a restrição do Box2D não inclui a mola nativa (com a mola sozinha dá 0) |
| Parafuso | sem leitura: o cartão e o gráfico dizem "Une as peças num corpo só: sem força entre elas." |
| Valor no evento | `Probe.at` (tique da régua, agora também "Parede saiu do furo", ou cruzamento de outra leitura); a velocidade na saída do Lançador é a da esfera ao cruzar a boca do cano (x = 50 mm) |

| Aceite | Medido | Teste |
| --- | --- | --- |
| Folga −2 ±0,05 mm, blocos sobrepostos | **−2** (peças fixas, geometria) e **−2** (peças soltas, depois de 1 passo, pelo contato); bloco apoiado no piso: −0,0003 mm | `sampling.test.ts` (o teste vermelho, sem mudar a tolerância), `readings.test.ts` |
| Folga ±0,01 mm entre blocos parados | 3,00 (como antes) | `sampling.test.ts` |
| Folga com camadas | um pino da camada 1 que chega à 2 enxerga a peça da 2 a 3 mm (o contorno da peça mesmo, na 1, estaria a 6 mm); peça só na camada 3: "—" | `readings.test.ts` |
| Força no pino = peso ±3% | dois pinos sob um bloco de 2,355 g: 0,011606 e 0,011605 N cada, para 0,011551 N (+0,47%) | `readings.test.ts` |
| Força no rasgo por contato = peso | alavanca pendurada num furo: 0,072211 N, o peso da alavanca mais o do pino (0,072211 N) | `readings.test.ts` |
| Torque da mola de torção = k·Δθ ±2% | braço preso pela mola em equilíbrio: −0,71817 N·mm, o peso dá 0,71820 (−0,004%) e k·Δθ dá 0,71817; com batente, mola e batente juntos carregam o peso (±2%) | `readings.test.ts` |
| Torque da lingueta aparece | pico de 0,0173 N·mm na Roda e lingueta (era 0); entre os batentes, igual à lei −k·(θ − repouso) − c·ω a 10⁻⁶ | `presets.test.ts` |
| Velocidade na saída 10,3 ±0,3 m/s | **10,589 m/s** (passo 89); a cena de teste do exemplo mede 10,586 pelo pico na boca. O pico instantâneo, 10,963, continua no gráfico | `presets.test.ts` (o outro teste vermelho) |
| Hash igual com e sem sondas | igual, com as 4 sondas prontas, com folga, força de pino e rasgo, torque e valor no evento, e também ao lado de uma comparação rodando | `readings.test.ts`, `hash.test.ts`; no Chromium, `capture-m1v.spec.ts` |

Um achado que muda a leitura do aceite: o `wall-unsealed` do Lançador não é a saída da esfera. A câmara tem duas paredes (êmbolo e Ferrolho) e o evento é o Ferrolho desvedando o furo, no passo 92, quando a esfera já bateu no coletor (passo 91). Por isso a "saída" é o cruzamento da boca do cano; o `wall-unsealed` virou um tique da régua e uma opção do seletor "Ler em". A velocidade na saída (10,589) fica a 0,011 m/s do limite do aceite (10,6): o 10,3 nominal vem do lote E2d e a física de hoje dá ~10,59. Passa, sem folga.

## 7.2 — acertos da revisão da M1b

- **pt-BR:** `formatNumber`/`formatValue` (`src/instruments/format.ts`), uma função só, feita à mão (não depende do ICU do navegador): "10,96", "4.292,8", "Δ 9,78"; três dígitos significativos abaixo de 0,1, para um torque de 0,017 N·mm não virar "0". Teste: `format.test.ts`; no navegador, `capture-m1v.spec.ts` reprova ponto decimal no painel.
- **Resumo da comparação:** duas linhas curtas, "Recuo A 15 · B 14,86 mm" e "Ciclo A 0,24 · B 0,17 s"; o detalhe (picos, tempos dos eventos) fica no `title`. Cabe em 844×390 e em 640×360 (`check:overflow` reprova linha cortada).
- **Experimente comparar:** a variante B tem a mola de retorno (k27) 50% mais rígida (0,015 → 0,0225 N/mm). Achada por varredura da rigidez (replay do gesto do gatilho, 1,8 s):

  | k27 | Recuo (mm) | Ciclo (s) | Próxima esfera na câmara? |
  | --- | --- | --- | --- |
  | ×1 (A) | 15,00 | 0,242 | sim |
  | ×1,4 | 15,00 | 0,171 | sim |
  | ×1,5 (B) | 14,86 | 0,171 | sim |
  | ×1,55 | 14,66 | 0,163 | sim |
  | ×1,6 | 14,47 | 0,150 | **não** (sai pela boca) |
  | ×2 a ×3 | 14,3–15,0 | — (o ferrolho não volta a 0,5 mm) | não |
  | ×4 a ×6 | 12,2 → 4,6 | 0,079 → 0,042 | **não** (a esfera fica no carregador) |
  | ×8 ou mais | 0,02–0,35 | — (quase não recua) | não |

  Até ×1,55 o ciclo completa e alimenta a próxima esfera; a partir de ×1,6 a mola mais rígida arremessa a esfera pela boca (×1,6 a ×1,75, com exceção isolada em ×1,65) e, de ×2 em diante, o mecanismo para de alimentar. ×4 a ×6 dão recuo menor e ciclo bem mais curto, mas sem alimentar: não é um ciclo completo. ×1,5 deixa uma margem abaixo da borda. O que a física mostra é **ciclo 29% mais curto (0,242 → 0,171 s) com recuo praticamente igual (15,00 → 14,86 mm)**: o curso é limitado pelo batente de 15 mm, então uma mola mais rígida não reduz o recuo, só devolve o ferrolho mais depressa. Com a predefinição "dura" antiga, o Ferrolho recuava 0,05 mm e não havia ciclo. Teste: `tryComparison.test.ts` (confere A e B, a próxima esfera na câmara e que só a mola mudou).

## 7.3 — bateria e casos

Bateria padrão:

| Verificação | Resultado |
| --- | --- |
| `npm run lint` e `npm run typecheck` | limpos, sem avisos |
| `npm test` | Vitest 893 passaram e 4 "expected fail" (69 arquivos; os dois vermelhos do `main` ficaram verdes); pipeline de assets 13 de 13; áudio 7 de 7 |
| `npm run build` | limpo |
| `npm run check:overflow` | 80 de 80: os 72 de antes e 8 novos (painel de instrumentos compacto e expandido, comparação com o resumo e seletor de variantes aberto, em 844×390 e 640×360) |
| `npm run test:e2e` (determinismo) | 33 hashes iguais entre o Node e o Chromium |
| Hash com sondas e com comparação | igual ao sem sondas: no Node (`hash.test.ts`, também com uma segunda variante rodando ao lado) e no Chromium (`capture-m1v.spec.ts`) |
| Specs do editor | `roda-e2b` 2, `profiles-e2b` 3, `cards-e2b` 17, `drag-e2b` 11, `hammer-e2b` 11, `hand-e2c` 8, `pencil-e2c` 11, `understand-e2d` 12, `e2a` 5, `motor-e2b` 2, `lab` 6, `sound-s` 3, `sound-fisica-s` 4: todos passam |
| Specs da M1 | `capture-m1a` 4, `capture-m1b` 2 e `capture-m1v` 9 (novo): todos passam |

O `hand-e2c` tinha 2 falhas que já estavam no `main` (as mesmas, no commit `45ab7f4` da entrada desta sessão): o toque de teste a 70 px abaixo da barra caía na borda de cima da faixa do Martelo em 844×390 (a faixa começa em y ≈ 333; o enquadramento do palco provavelmente mudou uns pixels quando o seletor de variantes entrou na M1b, mas não conferi o commit exato). Não é defeito de comportamento; o ponto do toque foi para 40 px abaixo da barra, dentro da placa e longe da faixa, e os 8 testes passam.

O que ficou de fora: a bancada de 30 min (`bench`) e os perfs antigos (`perf-e2b`, `perf-e2d`, `perf-som-s`), que esta sessão não tocou; o `/#perf` novo está em `perf-m1v`. As capturas históricas que os specs regravam (Fase 1, M1a e M1b) foram restauradas.

Casos:

- **Execução longa (60 s):** 18 404 de 57 604 amostras guardadas (32%); teto de ~8 700 por sonda por mais longa que seja a execução; os picos da primeira segundo (10,96 m/s; recuo de −15 mm) sobrevivem. Fora da janela de 10 s das poses o cursor não tem leitura (`null`) e o gráfico sombreia o trecho "sem poses antes de t"; a régua e o gráfico param na mesma borda. `longrun.test.ts`.
- **Tiques próximos:** os eventos da ignição do Lançador (12 ou 13, conforme a largura da régua) viram um marcador com a contagem; o toque abre a lista (nome e tempo de cada um) e escolher leva o cursor ao tique. Achou e corrigiu um defeito da própria lista (o toque dentro dela chegava à régua, que fechava a lista antes do clique). `events.test.ts` (agrupamento) e `capture-m1v.spec.ts` (toque e lista).
- **Sondas:** voltam com o projeto (com `at`, limite e limiar), seguem as variantes, sobrevivem ao reiniciar (mesma série, bit a bit) e, com o alvo apagado, leem "—" em todas as grandezas. `persistence.test.ts`.
- **Folga com peças multicamada e camadas afastadas:** o motor escolhe a forma da camada certa (pino que atravessa camadas; camadas sem camada comum dão "—", `readings.test.ts`). Com as camadas afastadas, o toque na segunda peça ignorava o deslocamento da folha da camada dela e errava a peça: corrigido em `Stage.tsx`, com teste no navegador (`capture-m1v.spec.ts`; falhava antes da correção).
- **Pinça no gráfico, toque emulado (CDP):** dois dedos afastando estreitam a janela (0,5 s → menos de 0,4 s) e juntando alargam (`capture-m1v.spec.ts`).
- **Medir não muda a simulação no Chromium:** as peças do Lançador ficam nas mesmas posições com as 4 sondas e sem nenhuma, em dois instantes (`capture-m1v.spec.ts`).

### `/#perf`

150 peças e 100 ligações, 1440×900, Chromium headless sem GPU, 10 s com arrasto, duas rodadas alternadas. Perda abaixo de 10%: **0%** nos quadros por segundo (mediana 59,9 nas três situações), no máximo 1% de quadros acima de 20 ms. A tabela completa está em `docs/decisoes/desempenho.md`.

| Situação | Velocidade | qps mediana | qps p5 | Quadros > 20 ms |
| --- | --- | --- | --- | --- |
| Sem sondas | Normal | 59,9 | 59,9 | 0 de ~542 |
| Sem sondas | Real | 59,9 | 59,9 | 0 de ~542 |
| 4 sondas | Normal | 59,9 | 59,5–59,9 | 0–5 de ~541 |
| 4 sondas | Real | 59,9 | 59,9 | 0 de ~542 |
| Comparação e fantasma | Normal | 59,9 | 59,9 | 1–3 de ~538 |
| Comparação e fantasma | Real | 59,9 | 59,5 | 0–1 de ~538 |

A primeira rodada com a comparação deu p5 de 30 e 6–10% de quadros longos. O custo era do painel (o gráfico montava o traço com todos os pontos da execução a cada quadro, só depois recortando a janela de 0,5 s); agora monta só o trecho visível.

## Capturas

Em `docs/capturas/fase-2/m1v/`, em 844×390 e 1440×900:

- `lancador-resumo-comparacao-*.png`: o resumo da comparação (duas linhas, sem corte), com o fantasma;
- `roda-torque-lingueta-*.png`: o torque da lingueta lido pela mola de torção;
- `lancador-velocidade-saida-*.png`: a velocidade na saída ("na saída 10,59 m/s") ao lado do pico (10,96);
- `lancador-tiques-agrupados-*.png`: o marcador com a contagem e a lista aberta.

Os seletores "Ler em" aparecem no painel expandido e na tela larga; no celular deitado, compacto, ficam escondidos para não tirar espaço dos nomes e das curvas.

## Falhas esperadas

Nenhuma nova. Os 4 "expected fail" do Vitest são os que já existiam.

## Riscos e pendências

- A velocidade na saída (10,589 m/s) passa por 0,011 m/s. Qualquer retoque futuro na física do Lançador (câmara, esfera, atrito do cano) pode empurrá-la para fora de 10,3 ±0,3; o teste vai avisar.
- O "Experimente comparar" mostra ciclo mais curto, não recuo menor: o curso do Ferrolho é limitado pelo batente. Uma demonstração de recuo menor pediria outra mudança (massa do ferrolho, ou o gás), que é decisão do coordenador.
- A força de pino e de rasgo é o vetor líquido dos contatos: dois contatos que se opõem se cancelam.
- Fora dos últimos 10 s o gráfico mostra o envelope (mínimo e máximo), não todos os passos.
- A comparação repete as duas variantes antes de tocar; em cenas grandes (2 × 2 400 passos de 150 peças) são alguns segundos de "Preparando comparação…". O tempo não foi medido à parte.
- Não medido em celular: só o Chromium desta sessão (sem GPU). A medida no celular do Will fica para depois do merge (`/#perf`, com 4 sondas e com comparação).

## O que o Will faz depois do merge, no celular

1. No Lançador, tocar em **Testar**, **Ver instrumentos** e **Experimente comparar**.
2. Ver o fantasma tracejado sobre o mecanismo e as curvas do Ferrolho (A cheia, B tracejada): o resumo diz o recuo e o ciclo das duas.
3. Medir a folga entre duas peças: tocar numa peça, **Medir** → **Folga com…**, e tocar noutra peça da mesma camada. Encostar uma na outra e ver o número passar de positivo a negativo.
4. Criar uma variante própria (**A ▾** → **Nova variante**), mudar uma mola ou um peso, rodar e comparar.
