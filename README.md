# interativLabs

Bancada de mecanismos em 2D, vertente da marca interativ.

Você desenha as peças à mão, empilha em camadas e liga as camadas com pinos, eixos, parafusos, trilhos e molas. Depois liga a física e opera o mecanismo com o dedo: uma engrenagem que move outra, um trinco que recolhe, um gatilho que solta um percussor, uma câmara de pressão que lança uma esfera. A camada 1 é o fundo; quanto mais alta, mais perto de você. Peças só se tocam dentro da mesma camada, e toda força que atravessa camadas passa por uma ligação que você enxerga.

Uso pessoal. Roda no navegador, no celular e no computador.

## Onde está cada coisa

- `AGENTS.md`: regras para quem escreve código aqui (pessoas e agentes).
- `docs/arquitetura.md`: como o app é dividido, o formato da cena e o modelo de física.
- `docs/roadmap.md`: as fases do projeto.
- `docs/fases/`: o plano detalhado de cada fase, com itens e critérios de aceite.
- `docs/identidade/`: a identidade Prancha índigo e o frame oficial.
- `reference/prototype-v0/`: o protótipo que validou a ideia. É referência, não código do app.

## Estado

Fase 1 (fundação) em andamento. A Parte C trouxe o motor definitivo (Box2D v3 calibrado para gravidade real, determinístico entre Node e navegador), o formato de cena v2 e as ligações 2.0. A Parte D trouxe o palco vivo: o app abre com um mecanismo montado na pele da Prancha índigo, que se simula, opera com o dedo, vê em câmera lenta e volta na linha do tempo. A Parte E2a trouxe a base do editor tátil: desfazer em tudo, layout de paisagem com tela cheia e app instalável, menus circulares de borda, seleção com alças e encaixe, cartão da peça, gaveta de peças prontas, pilha de camadas e projetos salvos no aparelho. A coordenação (briefing, decisões, prompts) vive no Project do Claude.

## Rodar

```
npm ci
npm run dev          # servidor local
npm run build        # build estático em dist/
npm run assets       # WebP 1x/2x, registro e folhas de contato do lote visual
npm run icons        # ícone provisório do app (SVG → PNG em public/icons/)
npm run lint && npm run typecheck && npm test
npm run capture      # capturas Playwright (390×844 e 1440×900) em docs/capturas/fase-1/
npm run check:overflow  # reprova rolagem lateral em 360, 390, 412 px e 844×390 (com as folhas abertas)
npm run bench        # comparativo de motores no Node → docs/decisoes/bench-node.json
npm run bench:browser   # o mesmo no Chromium headless (/#bench) → docs/decisoes/bench-chromium.json
npm run bench:scenes # regenera as cenas de medição em scenes/fixtures/bench/
npm run bench:size   # tamanho dos motores no build → docs/decisoes/bundle-size.json
npm run fixtures     # regenera as cenas de teste (scenes/fixtures/) e os exemplos (scenes/examples/)
npm run fixtures:hashes  # grava o hash de poses de cada cena de teste (scenes/fixtures/hashes.json)
npm run calibrate    # tabela da calibração do Box2D para gravidade real → docs/decisoes/calibracao-node.json
npm run test:e2e     # determinismo: o Chromium dá o mesmo hash que o Node em todas as cenas de teste
npx playwright test --project=lab   # capturas do laboratório em docs/capturas/fase-1/parte-c/
npx playwright test --project=capture-d   # capturas do palco em docs/capturas/fase-1/parte-d/
npx playwright test --project=e2a         # o editor tátil só com toque emulado (vários dedos), em 844×390
npx playwright test --project=capture-e2a # capturas do editor em docs/capturas/fase-1/parte-e2a/
```

## Instalar no celular

O app roda direto no navegador, mas instalado ele abre sem as barras do navegador (no iPhone, é o único jeito de ter tela cheia).

- **Android (Chrome):** abra o endereço do app, toque no menu ⋮ e em **Instalar app** (ou **Adicionar à tela inicial**). Abra pelo ícone novo. O botão **Tela cheia** (menu Vista, na borda esquerda) também funciona sem instalar e tenta travar em paisagem.
- **iPhone (Safari):** abra o endereço, toque em **Compartilhar** (o quadrado com a seta para cima) e em **Adicionar à Tela de Início**. Abra pelo ícone novo, com o celular deitado.
- **iPad (Safari):** o botão **Tela cheia** funciona; instalar pela tela de início também.

## Usar

Celular deitado é o layout principal. Nos cantos: menu (☰) com projetos, exemplos e arquivo; **Montar / Testar**; desfazer e refazer; a pílula da camada ativa (abre a pilha de camadas).

- **Peça:** toque escolhe (a mais alta da camada ativa sob o dedo); arrastar move, com encaixe em centros, vértices, bordas, eixos das ligações e grade; as alças em ouro giram (passos de 15°) e esticam. O botão redondo ao lado da peça (ou um toque longo) abre o cartão: nome, camada, tamanho, material, fixa ou solta, girar, espelhar, duplicar, excluir, ligações e detalhes.
- **Vista:** um dedo no fundo (ou numa peça de outra camada) move; dois dedos dão zoom e movem; roda do mouse dá zoom.
- **Menus de borda:** arraste do fundo até a borda e segure 1 s (o anel de ouro se completa) ou toque nas abas no meio das bordas. Direita: **Inserir** (peças prontas, nova camada, duplicar e excluir a seleção). Esquerda: **Vista** (enquadrar, raio-x, tela cheia, exemplos, dicas, canhoto). Deslize até o item e solte, ou toque nele.
- **Desfazer:** toque com dois dedos; refazer com três; Ctrl+Z e Ctrl+Shift+Z no computador.
- **Testar** liga a física: pausa, um passo, 0,05×/0,25×/1×, reiniciar, arrastar peças e a régua da linha do tempo.
- **Projetos** ficam salvos no aparelho a cada edição. Abrir um exemplo cria uma cópia. **Arquivo** exporta (copiar ou baixar o JSON) e importa cenas v0, v1 e v2.

Três páginas de trabalho, carregadas sob demanda:

- `/#perf`: a medição de desempenho. A cena de 150 peças e 100 ligações no palco real por 10 s; tocar em "Rodar 10 s" e depois em "Copiar resultado".
- `/#lab`: o laboratório. Lista as cenas de teste e os exemplos, roda cada um no motor do app (Box2D) com um desenho simples, deixa pausar, ver em câmera lenta (0,05×, 0,25×, 1×), reiniciar e arrastar as peças com o dedo, e mostra ao lado se as afirmações da cena passam. Uma cena direto: `/#lab/<grupo>/<nome>`, por exemplo `/#lab/exemplos/cilindro-dois-pistoes`.
- `/#bench`: o comparativo de motores (Planck, Rapier e Box2D). No celular: abrir, esperar o "Pronto", tocar em "Copiar resultado".

Playwright usa o Chromium indicado por `PLAYWRIGHT_BROWSERS_PATH`; para outro binário, defina `PW_CHROMIUM=/caminho/do/chrome`.

## Deploy

Build estático (Vite) pronto para a Vercel: `vercel.json` define `npm ci`, `npm run build` e a saída `dist/`. A ligação do projeto da Vercel ao repositório (com preview por branch) é feita pelo Will na conta dele.
