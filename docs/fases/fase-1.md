# Fase 1 — Fundação

Branch: `fase-1` (ou o da sessão do executor). A fase roda em partes, uma por sessão do executor, cada uma com o seu prompt e o seu PR para o `main`: **A** (itens 1–2), **B** (3–4), **C** (item 5: motor definitivo e ligações 2.0), **C2** (item 12: objeto padrão), **D** (item 6: palco vivo), **E1** (item 10: pipeline de assets), **E2a** (itens 7–9: base do editor tátil), **F** (item 14: correções do teste real e exemplo-vitrine), **E2b** (item 13: Martelo, cartões de ligação, peça multicamada e trava; PR #8), todas feitas; **E2c** (item 15: acertos do teste da E2b, Lápis e caneta; PR #9), **E2d** (item 16: camadas em cores, esconder peça, cartões "o que é" e rastro), **S** (item 18: som mínimo) e **E3** (item 11: verificação), nesta ordem. A oficina guiada (antes item 17) foi para a Fase 3, depois da Mecânica 2.0 (`docs/roadmap.md`). O prompt de cada parte manda; este documento é o plano e os critérios de aceite. Um commit por item (`Fase 1 · item M — descrição`), push após cada commit.

Objetivo: o protótipo de `reference/prototype-v0/` reescrito sobre a arquitetura definitiva (`docs/arquitetura.md`), com o motor de física escolhido por medição, testes de cena, desfazer em tudo e projetos salvos. O visual já usa os tokens, a paleta e as fontes da Prancha índigo (`docs/identidade/identidade.md`), mas sem hachuras, texturas nem ferragens: isso é da Fase 2. Alinhamento, espaçamento e toque precisam estar corretos, porque a Fase 2 completa a pele, não refaz a estrutura.

O protótipo é referência de comportamento, não código para copiar. As coordenadas das três cenas de exemplo foram ajustadas na mão e testadas; os valores físicos delas servem de ponto de partida.

---

## Item 1 — Projeto e ferramentas

- Vite + React + TypeScript estrito, alias `@/` para `src/`.
- ESLint, Prettier, Vitest, Playwright.
- Scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `capture` (capturas Playwright em 390×844 e 1440×900, salvas em `docs/capturas/fase-1/`), `check:overflow` (360, 390 e 412 px; reprova rolagem lateral).
- `src/styles/tokens.css` com os tokens de cor, tipografia e movimento de `docs/identidade/identidade.md`, mais espaço e raio. Fontes servidas localmente (pacotes `@fontsource`), sem depender do Google Fonts em produção.
- Casca do app: barra superior, palco SVG ocupando o resto, barra de ferramentas embaixo no celular e à esquerda no computador, painel à direita no computador.
- Projeto ligado à Vercel com preview por branch.

**Aceite:** `lint`, `typecheck`, `test` e `build` limpos; preview na Vercel abrindo no celular; casca sem rolagem lateral em 360, 390 e 412 px.

## Item 2 — Formato da cena

- Tipos de `docs/arquitetura.md` §3 em `src/model/`, schema Zod com mensagens em português, geração de ids.
- Migração `v0 → v1`. O formato v0 é o do protótipo (px, `shape.type`, campos `from`/`to`, etc.). Escala de conversão: 1 px do protótipo = 0,2 mm.
- `reference/prototype-v0/scenes/` tem as três cenas do protótipo em JSON v0.

**Aceite:** as três cenas v0 migram, passam no schema e voltam para JSON sem perda (ida e volta igual); um JSON com campo inválido falha apontando o caminho do campo.

## Item 3 — Geometria

- Polígono com furos. Booleanos de unir e subtrair: escolha a biblioteca pela robustez nos casos de teste; registre a escolha em `docs/decisoes/geometria.md`.
- Rasgo: forma de "estádio" (retângulo com pontas redondas) a partir de dois pontos e uma largura.
- Decomposição em peças convexas para o motor, inclusive de polígonos com furos. Nenhuma peça com área menor que 0,05 mm² nem com mais vértices do que o motor aceita.
- Engrenagem de perfil evolvente a partir de módulo, número de dentes e ângulo de pressão (20° padrão), com furo central. Perfil de catraca (dente de serra).
- Área, centroide, momento de inércia, ponto dentro da forma (com furos).

**Aceite:** testes cobrindo: polígono que cruza a si mesmo (rejeitado com mensagem, ou corrigido, nunca quebra); furo encostado na borda; rasgo que divide a peça em duas (vira duas peças, com aviso); soma das áreas das peças convexas igual à área da forma com erro abaixo de 0,5%; duas engrenagens evolventes de mesmo módulo, à distância `m·(z1+z2)/2`, sem interferência na malha em 360 posições de giro.

## Item 4 — Comparativo de motores

Interface `EngineAdapter` em `src/engine/` (compilar cena, passo, snapshot, arrastar ponto, soltar, eventos). Implemente para **Planck** e **Rapier 2D**. Tente **Box2D v3 em WASM**; se a ligação JS não estiver madura, registre o motivo e siga com dois.

Cenas de medição em `scenes/fixtures/bench/`:

1. Lançador do protótipo: ciclo gatilho → retém → percussor → sensor → câmara.
2. Trava de porta do protótipo.
3. Engrenagens e catraca do protótipo (motor a favor e contra a catraca).
4. Pilha de 200 caixas de 10 mm.
5. Corrente de 40 elos ligados por eixos.
6. Pinhão de 12 dentes contra cremalheira, ida e volta 50 vezes.
7. Esfera de 5 mm a 20 m/s contra parede de 1 mm (detecção contínua).
8. Peças de 1 mm e de 300 mm na mesma cena.

Medir, por motor: comportamento passa ou falha; tempo de passo (mediana e p95) no Node e no navegador; penetração máxima; tremor de peças em repouso; determinismo (duas execuções com o mesmo hash de poses); tamanho do pacote. Crie a página `/#bench` que roda as cenas no navegador e mostra a tabela, para o Will abrir no celular.

**Aceite:** `docs/decisoes/motor.md` com a tabela completa (Node, computador e celular do Will), a escala interna proposta e uma recomendação. **Pare aqui e peça a revisão do coordenador** antes do item 5.

## Item 5 — Motor definitivo e ligações 2.0 (Parte C)

Motor: Box2D v3 (`docs/arquitetura.md` §4). Formato: v2 (`docs/arquitetura.md` §3.1). Os subitens e os critérios de aceite completos estão no prompt da Parte C; em resumo:

- 5.1 Formato v2, migração `v1 → v2`, espessura por camada e densidades reais.
- 5.2 Adaptador definitivo do Box2D v3, calibrado para gravidade real em mm (pilha e corrente passam), determinístico entre Node e navegador.
- 5.3 Fixações: parafuso, eixo com atrito, haste, cabo, suporte elástico, trilho com atrito.
- 5.4 Molas 2.0: presa, apoiada, só tração, comprimento sólido, guia.
- 5.5 Furos e rasgos como guias (`joint` e `contact`).
- 5.6 Gás 2.0: paredes móveis, vedação, respiros, portas, sensores com ações.
- 5.7 Cenas de teste e exemplos (inclui a catraca corrigida e uma cena de recuo do fundo).
- 5.8 Verificação.

## Item 6 — Palco vivo (Parte D)

O app principal passa a desenhar e simular a cena: o renderizador definitivo na pele da Prancha índigo (contorno, parede, chanfro, sombra entre camadas, hachuras procedurais, papel, ferragens e molas do lote 01, números de chamada), o modo Simular com câmera lenta e linha do tempo, o arrasto com o dedo, a navegação da vista, o menu de exemplos e o objeto padrão aberto ao entrar. Meta de desempenho: 150 peças e 100 ligações a 60 qps, medida no celular do Will. Subitens e aceites no prompt da Parte D.

## Itens 7, 8 e 9 — Base do editor tátil (Parte E2a)

O modelo de interação está em `docs/arquitetura.md` §6. A Parte E2a entrega: comandos com desfazer e refazer (botões e gestos), o layout tátil em paisagem e retrato com tela cheia e app instalável, os menus circulares de borda, seleção e manipulação com encaixe e o botão da peça, a gaveta de peças prontas, a gestão de camadas e os projetos salvos. Leva junto as correções da revisão da Parte D. Subitens e aceites no prompt da Parte E2a.

## Item 10 — Pipeline de assets

`scripts/assets/` pronto para o lote 01, conforme o AGENTS.md: leitura do manifesto, WebP 1x/2x, registry tipado com âncoras e mm por pixel, folhas de contato, conferência 3×3 das texturas que repetem. Teste com três imagens falsas geradas pelo próprio script de teste.

**Aceite:** `npm run assets` roda limpo com o lote de teste e gera registry e folha de contato.

## Item 11 — Verificação

`docs/verificacao-fase-1.md`: o que foi feito, o que ficou de fora e por quê, as medidas dos itens 4 e 6, e as capturas em `docs/capturas/fase-1/`. Abra o PR.

## Item 12 — Objeto padrão (Parte C2)

O app abre com um mecanismo montado, que a pessoa opera e edita a partir dele: um lançador de esferas de brinquedo com ferrolho que recua pelo gás (recuo do fundo), percussor, retém, gatilho e carregador. Proporções inventadas, gás didático, nenhuma reprodução de arma real. Mostra as ligações 2.0 juntas: mola de retorno numa haste-guia, molas apoiadas, rasgo como guia, pino entre camadas, câmara com duas paredes, sensor. Cena de teste com o ciclo completo. Subitens e aceites no prompt da Parte C2.

## Item 13 — Martelo, cartões de ligação, peça multicamada e trava (Parte E2b)

Formato v3 (`docs/arquitetura.md` §3.2) e as ferramentas da mão (§6, "Ferramentas da mão"), menos o Lápis:
- 13.1 Formato v3: perfis por camada, trava, `slot.profile`, ação `release`; migração `v2 → v3` sem mudar nenhum hash.
- 13.2 Motor e desenho dos perfis e da trava (soltar por toque, sensor e força), com a entrada gravada.
- 13.3 Martelo: Fixar (parafuso, eixo, pino com rasgo automático, trava), com prévia acima do dedo e encaixe forte em centros.
- 13.4 Martelo: Ligar (mola, haste, cabo), Guiar (trilho) e Gás (câmara e sensor), e mover a ligação depois.
- 13.5 Cartões de ligação com predefinições, trocas de tipo, alças no palco e as listas da câmara e do sensor.
- 13.6 Peça multicamada no cartão da peça, gerador de came e peças prontas multicamada.
- 13.7 Exemplo "Roda e lingueta" e cenas de teste.
- 13.8 Verificação.

## Item 14 — Correções do teste real e exemplo-vitrine (Parte F)

Depois do primeiro teste do Will no celular (04/11):
- velocidades renomeadas para Lento (1/20), Normal (¼, o padrão) e Real (1×), porque tempo real em peça pequena parece 4× rápido;
- câmera lenta fluida, com interpolação de desenho entre passos;
- arrasto da mão com força e velocidade limitadas, para nunca romper juntas nem arremessar peças (a força era multiplicada por ~98);
- teste de abuso em todas as cenas, com invariantes de junta, penetração, velocidade e energia;
- o objeto padrão refeito como exemplo-vitrine bem composto, com gatilho na orientação certa, câmara em corte, ferrolho com recuo visível e coletor de esferas;
- paisagem sem a coluna vazia da esquerda.

Subitens e aceites no prompt da Parte F.

## Item 15 — Acertos do teste, Lápis e caneta (Parte E2c)

- 15.1 Acertos do teste da E2b: o Martelo não mexe na vista; cursor deslocado de verdade (§6); faixa presa à borda de baixo, baixa, no estilo da prancha; detecção da câmara (corpo, paredes e diâmetro).
- 15.2 Lápis: contorno (somar e tirar), lados no traço de borda a borda, dividir em duas peças, peça nova, suavização que preserva cantos.
- 15.3 Lápis: traço com largura (pincel, borracha, rasgo, furo) e régua.
- 15.4 Caneta, forma livre, perfil da camada ativa e a física das formas novas.
- 15.5 Verificação.

## Item 16 — Entender (Parte E2d, em duas sessões)

Primeira parte rodada no Modo Astra (`docs/coordenacao/papeis.md`): uma sessão de criação e outra de verificação, no mesmo PR.

- **A · criação** (GPT-6 Astra, esforço médio):
  - 16.1 acertos da revisão da E2c (frases do Martelo, "Esc sai" só com teclado, pílula da camada, "Dedo desenha");
  - 16.2 modo camadas em cores (paleta provisória em tokens, Afastar 2,5D, Isolar);
  - 16.3 esconder peça;
  - 16.4 cartões "o que é" e rastro.
- **B · verificação** (Claude Sonnet 5.5, esforço alto, no branch da A):
  - 16.5 bateria completa, testes que faltarem e `/#perf` com os modos novos;
  - 16.6 câmara do Lançador coerente com o desenho (saída 10,3 ±0,3 m/s);
  - 16.7 capturas e documentação.

## Item 17 — (movido)

A oficina guiada foi para a Fase 3, depois da Mecânica 2.0, para as receitas já usarem o ciclo, o escape e a bomba (decisão de 07/11).

## Item 18 — Som mínimo (Parte S)

Lote som-01 (uma música em laço e uns oito efeitos, pelo coordenador sonoro), pipeline `npm run audio`, motor enxuto e os gatilhos de §6 (Som), com liga e desliga no menu Vista.
