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
- **M1v (Opus, prompt entregue em 07/11):**
  - fecha as leituras: penetração pela separação do contato; força em pino e em rasgo por contato pelos impulsos de contato; torque de eixo com mola de torção, motor e batente; velocidade num evento ("valor no evento", para bater com a saída);
  - parafuso mostra o motivo de não ter força ("une num corpo só");
  - acerta a formatação pt-BR, o resumo e o "Experimente comparar" (uma mola mais rígida que ainda faz o ciclo);
  - roda a bateria completa (execução longa, tiques próximos, sondas persistidas, folga multicamada, `/#perf` com comparação) e documenta (§10 da arquitetura).

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

**Aceite:** no Lançador, o pico da velocidade da esfera no gráfico bate com a cena de teste do exemplo (10,3 ±0,3 m/s); na Roda e lingueta, os estalos contados batem com os dentes que passaram.

### Item 5 — Variantes (M1b)

**Aceite:** criar, trocar, renomear e apagar variantes, com desfazer por variante; o projeto salvo volta com as variantes.

### Item 6 — Comparar (M1b)

**Aceite:** duas variantes iguais dão curvas idênticas (diferença zero); a variante com mola dura dá o recuo menor e o ciclo mais curto, com os números no resumo; fantasma sincronizado nas capturas.

### Item 7 — Verificação da M1 (M1v)

Bateria completa do `AGENTS.md`, `/#perf` com sondas e comparação, capturas, "Como ficou" em `docs/arquitetura.md` e `docs/verificacao-fase-2-m1.md`.

## M2 · Ciclo

Duas sessões no Opus, cada uma com a verificação completa:

- **M2a** (itens 8–12): cápsula, câmara de cápsula, extrator e ejetor.
- **M2b** (itens 13–17): tomada de gás, trancamento e o exemplo-vitrine "Lançador de cápsulas", com "Experimente comparar" de extrator.

### Decisões fechadas da M2

- **Tudo genérico e esquemático** (`AGENTS.md`, regras do domínio): proporções inventadas, gás didático, sem calibre, sem medida de projeto real, sem cálculo de balística com propelente. O projétil da cápsula é uma esfera, como no Lançador.
- **Cápsula** é uma peça com carga: o estojo, normalmente de latão, com aro perto do fundo, um furo interno e o projétil preso na boca. Formato v4:
  ```ts
  interface Part { /* … v3 … */ capsule?: Capsule }
  interface Capsule {
    charge: number;          // mmol, didático (as predefinições da câmara: 0,1 · 0,5 · 1,2)
    projectile?: Id;         // a esfera presa na boca
    base: Vec2; mouth: Vec2; // fundo interno e boca, em coordenadas locais: o eixo e o comprimento do furo
    bore: number;            // mm, diâmetro do furo
    primer: Vec2;            // a espoleta, em coordenadas locais
    minStrike: number;       // mm/s, golpe mínimo na espoleta
  }
  // câmara ganha: mode?: "charge" | "capsule"   ("capsule": sem carga própria; recebe a cápsula assentada)
  //               seat?: number                   (mm: até onde o fundo da cápsula conta como assentado)
  ```
  A migração `v3 → v4` só troca a versão. **Nenhum hash antigo muda.**
- **Comportamento da cápsula:**
  - **Disparo:** um golpe na espoleta acima de `minStrike`, de qualquer peça (o percussor), acende a carga. O motor detecta o golpe, não um sensor desenhado. Cápsula já deflagrada não acende de novo. O estado "deflagrada" vai no snapshot; a cena desenhada sempre parte com tudo carregado.
  - **Gás:** a cápsula é uma câmara que mora no estojo. O corpo é o estojo; a parede de trás é o próprio fundo interno; a parede da frente é o projétil. A pressão empurra o projétil para a frente e o estojo para trás (contra a face da culatra, que segura ou recua).
  - **Fora de um cano,** o furo termina na boca do estojo: o projétil sai e o gás escapa.
  - **Assentada numa câmara `mode: "capsule"`,** o furo continua pelo cano, e o gás empurra a esfera até a boca do cano.
  - **Projétil preso:** a esfera fica presa à boca por uma trava que solta no instante do disparo. Antes disso, o carregador e o ferrolho podem empurrar a cápsula à vontade sem soltar a esfera.
- **Extrator e ejetor** são peças comuns, sem física especial:
  - **extrator:** gancho num eixo com mola de torção, preso ao ferrolho, cuja garra pula o aro quando a culatra fecha e puxa o estojo quando ela recua;
  - **ejetor:** batente fixo que bate num lado do fundo do estojo puxado, que gira em volta da garra e sai pela janela.

  O que a M2a entrega para eles: geradores na gaveta, encaixes e cenas de teste que provam o ciclo. Se a geometria pedir ajuste do motor (contato do aro, por exemplo), é contato e atrito, nunca animação imposta.
- **Desenho:**
  - cápsula carregada com a carga em brasa por dentro, em pontilhado como o gás;
  - deflagrada: sem a brasa e com a marca do golpe na espoleta;
  - estojo vazio com o traço levemente apagado.
- **Instrumentos e som:**
  - evento `capsule-fired` na régua ("cápsula disparou");
  - sonda de pressão da cápsula;
  - `sfx-pop-strong` ou `sfx-gas` pela carga;
  - `sfx-case-drop-1/-2` no impacto de um estojo deflagrado acima de um limiar (o gatilho que o lote som-01 deixou para a M2).

### Item 8 — Formato v4 (M2a)

Schema, mensagens em português, integridade:
- projétil existe;
- `base ≠ mouth`;
- `bore > 0`;
- câmara `capsule` sem `charge`.

Migração `v3 → v4`. O teste prova que os 33 hashes não mudam.

### Item 9 — Motor da cápsula (M2a)

Disparo pelo golpe, câmara no estojo, continuação pelo cano assentado, soltura da esfera no disparo, estado deflagrado, evento e sons.

**Aceite** (cenas de teste novas em `scenes/fixtures/ciclo/`):
- `capsula-livre`: cápsula solta na bancada, golpeada na espoleta. A esfera sai pela boca do estojo, e a quantidade de movimento fecha: m_estojo·v_estojo = m_esfera·v_esfera ±5%.
- `capsula-no-cano`: cápsula assentada num cano fixo com culatra fixa.
  - A esfera sai pela boca do cano.
  - Com o cano mais longo, a esfera sai mais rápida (duas variantes da cena, monotônico).
  - Golpear de novo a cápsula deflagrada não acende nada.
  - `capsule-fired` aparece uma vez.
- `capsula-empurrada`: o ferrolho empurra uma cápsula do carregador até o cano a 600 mm/s, e a esfera não solta antes do golpe.

### Item 10 — Peças do ciclo (M2a)

Categoria "Ciclo" na gaveta:
- **Cápsula:** paramétrica, com comprimento, diâmetro, aro e carga fraca, média ou forte; a esfera já vai presa.
- **Extrator:** gancho com eixo e mola de torção, pronto para cravar no ferrolho.
- **Ejetor:** batente.

No Martelo, a câmara ganha o modo "recebe cápsula" no cartão. No cartão da peça, a cápsula mostra a carga e o estado.

### Item 11 — Extração e ejeção (M2a)

**Aceite** (cenas de teste):
- `extrator`: com a cápsula assentada e a garra no aro, o ferrolho puxado para trás por arrasto roteirizado leva o estojo junto (diferença de deslocamento abaixo de 0,5 mm até o ejetor).
- `ejetor`: continuando, o estojo bate no ejetor, gira e sai pela janela, acima de uma velocidade medida, terminando fora da caixa.
- **Robustez:** a extração e a ejeção passam em 20 variações do tempo e da velocidade do puxão.
- O abuso passa nas cenas novas.

### Item 12 — Verificação da M2a

- Bateria completa do `AGENTS.md`.
- Determinismo com as cenas novas.
- Capturas da cápsula carregada e deflagrada, e da sequência de extração e ejeção em Lento.
- Arquitetura §3.3 (formato v4) e §4 (cápsula no motor).
- `docs/verificacao-fase-2-m2a.md`.

### Itens 13–17 — M2b (planejados)

- **Tomada de gás:** porta do cano para uma câmara de pistão (as portas já existem) e a peça pronta "pistão de gás".
- **Trancamento:**
  - por báscula: o cano inclina por um came e destrava;
  - por alavanca articulada: o joelho que só dobra depois de um tempo.

  Cenas de teste que provam que o estojo não recua enquanto a esfera está no cano.
- **Exemplo-vitrine "Lançador de cápsulas":** máquina de bancada, não forma de arma.
  - Carregador de 5 cápsulas, alimentação, disparo pelo gatilho do Lançador de bancada, extração, ejeção e realimentação, cinco ciclos seguidos.
  - Instrumentos prontos: pressão, velocidade na saída, recuo e força na garra do extrator.
  - "Experimente comparar" com a mola do extrator fraca e forte, que mostra quando a garra solta o aro.
- Verificação.

## M3 · Pneumática · M4 · Relojoaria

Planejadas em `docs/roadmap.md`. Itens e aceites entram aqui depois da M2.
