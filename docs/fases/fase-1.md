# Fase 1 — Fundação

Branch: `fase-1`. A fase roda em partes, uma por sessão do executor, cada uma com o seu prompt: **A** (itens 1–2, feita), **B** (3–4, feita), **C** (item 5: motor definitivo e ligações 2.0), **D** (item 6: simulação e palco), **E1** (item 10: pipeline de assets, feita), **E2** (itens 7–9: editor, ferramentas das ligações 2.0 e projetos), **E3** (item 11: verificação). O prompt de cada parte manda; este documento é o plano e os critérios de aceite. Um commit por item (`Fase 1 · item M — descrição`), push após cada commit. Ao terminar, abra um PR para o `main` com o documento de verificação.

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

## Item 6 — Simulação e palco

- Laço com acumulador, câmera lenta (0,05×, 0,25×, 1×), pausa, avanço de um passo.
- Gravação circular dos últimos 10 s; arrastar na linha do tempo volta a simulação a qualquer quadro gravado e permite continuar dali.
- Renderizador SVG com as regras de `docs/arquitetura.md` §5, sem texturas por enquanto. Furos e rasgos com `evenodd`.
- Pinça para zoom, dois dedos para mover, roda do mouse para zoom no computador, botão de enquadrar.

**Aceite:** cena sintética de 150 peças e 100 ligações a 60 qps no computador e medida no celular do Will (registre o número). Captura das três cenas em execução.

## Item 7 — Editor: comandos, seleção e camadas

- Pilha de comandos com desfazer e refazer (Ctrl+Z, Ctrl+Shift+Z, botões).
- Selecionar, mover, girar pela alça, editar vértices, duplicar, excluir.
- Camadas: criar, renomear, reordenar, ocultar, travar, excluir com confirmação na própria página. Destacar a camada ativa.

**Aceite:** qualquer sequência de 50 edições desfeita até o início devolve a cena idêntica (teste automatizado).

## Item 8 — Editor: ferramentas e propriedades

- Ferramentas de desenho: retângulo, círculo, polígono por pontos, traço livre (simplificado), engrenagem.
- Ferramentas de ligação: parafuso, eixo, pino, trilho, mola, câmara, sensor, com a mesma lógica de escolha de peças do protótipo (peça mais alta da camada ativa; a de baixo, ou o fundo).
- Painel de propriedades por tipo, com unidades (mm, °, s), igual em conteúdo ao do protótipo e com as correções de nome que fizerem sentido.
- Dica curta por ferramenta.

**Aceite:** dá para reconstruir o lançador do protótipo do zero, só com o editor, e ele funciona na simulação. Grave isso como teste Playwright.

## Item 9 — Projetos

- IndexedDB: lista de projetos com nome e data, abrir, duplicar, excluir, renomear. Autosave.
- Exportar e importar JSON (texto copiável; download pelo navegador quando disponível).
- Os três exemplos disponíveis num menu.

**Aceite:** fechar e reabrir a aba mantém o projeto; importar uma cena v0 do protótipo funciona.

## Item 10 — Pipeline de assets

`scripts/assets/` pronto para o lote 01, conforme o AGENTS.md: leitura do manifesto, WebP 1x/2x, registry tipado com âncoras e mm por pixel, folhas de contato, conferência 3×3 das texturas que repetem. Teste com três imagens falsas geradas pelo próprio script de teste.

**Aceite:** `npm run assets` roda limpo com o lote de teste e gera registry e folha de contato.

## Item 11 — Verificação

`docs/verificacao-fase-1.md`: o que foi feito, o que ficou de fora e por quê, as medidas dos itens 4 e 6, e as capturas em `docs/capturas/fase-1/`. Abra o PR.
