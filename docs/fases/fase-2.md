# Fase 2 — Mecânica 2.0

A fase roda em partes, uma ou duas sessões do executor por parte, cada parte com o seu PR para o `main`. A ordem e o porquê estão em `docs/roadmap.md`. Este documento é o plano e os critérios de aceite; o prompt de cada parte manda. Um commit por item (`Fase 2 · item N — descrição`).

Objetivo: o Will vê, altera e compara como um mecanismo funciona, com números. Primeiro os instrumentos (M1), depois o ciclo (M2), a pneumática (M3) e a relojoaria (M4), que usam os instrumentos nos próprios aceites.

## M1 · Instrumentos e variantes

Duas sessões de criação no Modo Astra (`docs/coordenacao/papeis.md`) e uma de verificação:

- **M1a** (itens 1–4): sondas, painel de gráficos, eventos na régua e instrumentos prontos nos exemplos.
- **M1b** (itens 5–6): variantes e comparação.
- **M1v** (item 7): verificação da M1 (Claude Sonnet).

Estado em 07/11:
- **M1a feita (PR #14).** Ficaram abertas algumas leituras: a folga não dá sinal de penetração; não há força em pino, em rasgo por contato nem em parafuso (que funde num corpo só); o torque no eixo da lingueta sai zero, porque a junta de eixo não segura rotação e a mola de torção é aplicada à parte; e o pico de velocidade da esfera (10,96 m/s) não é a velocidade na saída que a cena de teste mede (10,3). Dois testes ficam vermelhos no `main` por causa disso, de propósito, até a M1v.
- A revisão do coordenador viu ainda que, no celular deitado, o painel cobre o mecanismo e a curva fica ilegível numa janela de 1,8 s. Isso vai para a M1b.
- **M1b feita (PR #15, Astra).** Entregou o painel compacto (117 px em 844×390), a janela de 0,5 s, a pinça, o deslocamento, as variantes A–D, o comparar com fantasma e o "Experimente comparar". A revisão achou três coisas:
  - os números ainda saem com ponto decimal nas capturas ("pico 10.96");
  - o resumo da comparação aparece cortado em 844×390;
  - com a mola "dura", o Ferrolho da B quase não recua (0,05 mm) e não há ciclo para comparar.
- **M1v feita (Opus, 08/11; relatório em `docs/verificacao-fase-2-m1.md`):**
  - fechou as leituras: penetração pela separação do contato (e, sem contato, pela geometria); força em pino e em rasgo por contato pelos impulsos de contato; torque de eixo com mola de torção (pela lei), motor e batente; valor no evento (a velocidade na saída do Lançador: 10,59 m/s);
  - o parafuso mostra o motivo de não ter força ("une num corpo só");
  - acertou a formatação pt-BR, o resumo (duas linhas) e o "Experimente comparar" (mola de retorno 50% mais rígida: ciclo de 0,24 s para 0,17 s; o recuo fica perto do batente de 15 mm);
  - rodou a bateria (execução longa, tiques próximos, sondas persistidas, folga multicamada e com camadas afastadas, `/#perf` com 4 sondas e com comparação) e documentou (§10 da arquitetura). A medida achou e corrigiu um custo do painel (o gráfico montava todos os pontos a cada quadro) e um toque errado na folga com as camadas afastadas.

### Decisões fechadas da M1

- **Sonda** é o que a pessoa mede. Fica no estado de vista do projeto (como as peças escondidas), fora do formato da cena: sem migração, sem desfazer de cena, sem efeito no hash. **Medir nunca muda a simulação**: o hash de poses com sondas é igual ao sem sondas.
- O que dá para medir:

  | Alvo | Grandezas |
  | --- | --- |
  | Peça | posição x e y (mm), ângulo (°), velocidade (mm/s ou m/s), velocidade angular (°/s ou rpm) |
  | Eixo | ângulo relativo (°), torque na junta (N·mm) |
  | Parafuso, pino, rasgo, trilho, haste, cabo, suporte elástico | força na junta (N); no trilho, também a posição no curso (mm) |
  | Mola | força (N) e comprimento (mm) |
  | Trava | força na junta (N), com a linha do limite quando é fusível |
  | Câmara | pressão (kPa, "gás didático") e volume (mm³) |
  | Folga entre duas peças da mesma camada | distância mínima entre os contornos (mm); negativa é penetração |

- **Amostragem** no worker, a cada passo (1/240 s), alinhada à gravação da linha do tempo. Voltar a régua mostra os valores daquele instante. A interface recebe a série reduzida com mínimo e máximo por intervalo, para nenhum pico sumir.
- **Força** de junta pela força de reação do Box2D (`b2Joint_GetConstraintForce` e `…Torque`, já usadas na trava), convertida em N. Mola pela própria lei dela. Pressão pelo modelo da câmara. Folga pela distância entre formas do Box2D (confirmar a função na versão 6.0.0 do `box2d3-wasm`).
- **Painel Instrumentos**, no Testar:
  - até 4 gráficos, acima da régua no celular deitado, recolhível;
  - cada gráfico com nome, unidade, a curva da execução inteira, o cursor em ouro preso à régua (arrastar no gráfico também arrasta a régua), a leitura no cursor e o pico marcado;
  - estilo de gráfico de patente: quadriculado fino, curva em traço de tinta, pressão e energia em brasa.
- **Adicionar sonda:** "Medir" no cartão da peça e no cartão da ligação, com as grandezas válidas em chips; "Folga com…" no cartão da peça, e depois um toque na outra peça.
- **Eventos na régua:**
  - cada evento do motor vira um tique pequeno com ícone na régua: câmara acendeu, sensor, respiro abriu ou fechou, trava soltou, e impacto forte acima de um limiar;
  - um toque no tique leva o cursor até ele, com o nome;
  - o cabeçalho do painel conta os eventos da execução ("3 ciclos", "8 estalos");
  - "ciclo" é a câmara acendendo, ou uma sonda cruzando um valor para cima que a pessoa marca no gráfico.
- **Instrumentos prontos:**
  - **Lançador de bancada**: velocidade da esfera, pressão da câmara, posição do Ferrolho e força no Retém;
  - **Roda e lingueta**: ângulo da roda, torque no eixo da lingueta e os estalos.

  Ficam definidos em código (`src/instruments/presets.ts`), por exemplo, e aparecem com "Ver instrumentos" no Testar.
- **Variantes** (M1b):
  - um projeto tem a variante A (a original) e até mais três;
  - cada variante com a sua cena e o seu desfazer;
  - as sondas são do projeto e valem para todas, pelo id do alvo (sem o alvo, mostram "—");
  - um seletor "A ▾" perto do título troca de variante, e "Nova variante" duplica a atual.
- **Comparar** (M1b):
  - duas variantes rodam com as mesmas entradas (as da última execução da primeira, por id de peça e ponto; entrada sem peça correspondente é pulada);
  - os gráficos sobrepõem as duas (A em traço cheio, B tracejado), com a diferença no cursor e um resumo: picos e tempo até cada evento;
  - no palco, B aparece como fantasma tracejado sobre A, sincronizado, e liga e desliga;
  - no Lançador, "Experimente comparar" cria uma variante B com a mola de retorno dura, pronta para rodar.
- **Desempenho:** com 4 sondas e a comparação ligada, a perda no `/#perf` fica abaixo de 10%.

### Item 1 — Sondas (M1a)

Modelo das sondas no estado de vista do projeto, amostragem no worker com a gravação e as grandezas da tabela.

**Aceite:**
- teste do hash igual com e sem sondas;
- teste de cada grandeza numa cena de teste conhecida: queda livre dá velocidade = g·t ±1%; a mola em repouso dá a força = peso ±2%; a câmara bate com o modelo; a folga entre dois blocos parados dá a distância desenhada ±0,01 mm.

### Item 2 — Painel de gráficos (M1a)

Painel, cursor ligado à régua, leitura, pico, "Medir" nos cartões.

**Aceite:** capturas do painel com 4 gráficos em 844×390 e 1440×900.

### Item 3 — Eventos na régua e contagem (M1a)

**Aceite:** os eventos de uma execução do Lançador aparecem na régua, na ordem certa e no passo certo (teste contra os eventos do motor).

### Item 4 — Instrumentos prontos (M1a)

**Aceite:** no Lançador, a velocidade da esfera na saída bate com a cena de teste do exemplo (10,3 ±0,3 m/s; o pico instantâneo, 10,96 m/s, continua no gráfico); na Roda e lingueta, os estalos contados batem com os dentes que passaram.

### Item 5 — Variantes (M1b)

**Aceite:** criar, trocar, renomear e apagar variantes, com desfazer por variante; o projeto salvo volta com as variantes.

### Item 6 — Comparar (M1b)

**Aceite:** duas variantes iguais dão curvas idênticas (diferença zero); a variante com mola dura dá o recuo menor e o ciclo mais curto, com os números no resumo; fantasma sincronizado nas capturas.

### Item 7 — Verificação da M1 (M1v)

Bateria completa do `AGENTS.md`, `/#perf` com sondas e comparação, capturas, "Como ficou" em `docs/arquitetura.md` e `docs/verificacao-fase-2-m1.md`.

## M2 · Ciclo · M3 · Pneumática · M4 · Relojoaria

Planejadas em `docs/roadmap.md`. Itens e aceites entram aqui depois da revisão da M1.
