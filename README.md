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

**Fase 1 (fundação) concluída; a Fase 2 (Mecânica 2.0) está começando**, pelos instrumentos (M1). A fase entregou, em partes: o motor definitivo (Box2D v3 calibrado para gravidade real, determinístico entre Node e navegador) e o formato de cena (v3, com migrações); o palco vivo na pele da Prancha índigo, com câmera lenta, linha do tempo e arrasto com o dedo; o editor tátil (desfazer em tudo, menus de borda, cartões, gaveta de peças, camadas, projetos salvos); o Martelo, as ligações, a trava e a peça multicamada; o Lápis e a caneta; o modo de entender (camadas em cores e afastadas, esconder peça, cartões "o que é", rastro); os exemplos Lançador de bancada e Roda e lingueta; e, por último, o som mínimo (uma música em laço e efeitos que marcam o que acontece). A coordenação (briefing, decisões, prompts) vive no Project do Claude.

O balanço da fase, com as medidas, o que ficou de fora e as capturas finais, está em [docs/verificacao-fase-1.md](docs/verificacao-fase-1.md); o do som, em [docs/verificacao-som-01.md](docs/verificacao-som-01.md). A verificação de cada parte tem o seu relatório em `docs/verificacao-fase-1-parte-*.md`.

## Rodar

```
npm ci
npm run dev          # servidor local
npm run build        # build estático em dist/
npm run assets       # WebP 1x/2x, registro e folhas de contato do lote visual
npm run icons        # ícone provisório do app (SVG → PNG em public/icons/)
npm run audio        # som: extrai o zip do lote, normaliza, converte (m4a e wav) e gera public/audio/, o registro e as medidas
npm run lint && npm run typecheck && npm test
npm run capture      # capturas Playwright (390×844 e 1440×900) em docs/capturas/fase-1/
npm run check:overflow  # reprova rolagem lateral em 360, 390, 412 px, 844×390 e 640×360 (com folhas e Martelo abertos)
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
npx playwright test --project=sound-s     # som: nada antes do primeiro toque, música, aba escondida, preferências
npx playwright test --project=sound-fisica-s  # som da física e das ferramentas no navegador
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
- **Menus de borda:** arraste do fundo até a borda e segure 1 s (o anel de ouro se completa) ou toque nas abas no meio das bordas. Direita: **Inserir** (Martelo, Lápis, peças prontas, nova camada, duplicar e excluir a seleção). Esquerda: **Vista** (enquadrar, camadas em cores, raio-x, esconder peças, rastro no Testar, tela cheia, som, dicas no Montar, canhoto). Deslize até o item e solte, ou toque nele.
- **Desfazer:** toque com dois dedos; refazer com três; Ctrl+Z e Ctrl+Shift+Z no computador.
- **Martelo:** botão redondo junto ao desfazer, só no Montar; também no menu Inserir. Abrir ou fechar não mexe na vista. A faixa presa à borda de baixo mostra Fixar (parafuso, eixo, pino, trava), Ligar (mola, haste, cabo), Guiar (trilho) e Gás (câmara, sensor); em tela pequena, o botão na ponta da faixa troca de grupo. Toque rápido crava sob o dedo; arraste para desenhar ligações e cursos. Centros de discos, engrenagens e furos puxam o encaixe. Câmara: arraste do fundo à boca; uma peça solta sob o começo é a parede de trás, a primeira peça solta que fecha o furo é a da frente. Esc sai no computador. Segure uma ferramenta da faixa para abrir o cartão "o que é" dela.
- **Cursor deslocado:** com o dedo, segure parado 300 ms: acende uma mira em ouro 64 px acima do dedo (abaixo, se faltar espaço), com uma vibração curta no Android. Daí em diante o ponto é a mira: o dedo a move, o encaixe e a frase seguem a mira e soltar crava nela. Vale no Martelo inteiro, para mover uma ferragem e para começar um traço no Lápis. Mouse e caneta não têm deslocamento.
- **Lápis:** botão redondo ao lado do Martelo (ligar um desliga o outro); também no menu Inserir. A faixa tem **Contorno** ou **Traço**, **Somar** ou **Tirar**, a largura do traço (1, 2, 3 e 5 mm; o botão de detalhes abre um deslizante) e a **Régua**. Age na peça escolhida, no perfil da camada ativa; sem peça escolhida, na mais alta da camada ativa sob o começo do traço (no Contorno, um toque escolhe a peça).
  - Contorno: um laço fechado tira ou soma a região; um traço que entra e sai da peça a divide em dois lados, com o lado menor em brasa ("vai sair"): **Trocar lado** (ou toque num lado) e **Cravar corte**. Somar no vazio cria uma peça nova de aço, solta.
  - Traço: pincel (barra ou alavanca à mão) ou borracha; um toque da borracha faz um furo redondo da largura escolhida.
  - Régua: traço quase reto vira reta, quase círculo vira círculo, cantos viram vértices. A borracha reta com régua faz um rasgo reto, que o Martelo usa com pino em modo junta.
  - Peça paramétrica que passa pelo Lápis vira forma livre (aviso curto; desfazer volta). Corte que deixa partes soltas vira peças, cada ligação com a parte dela; numa peça multicamada, o Lápis oferece **Separar em peça**.
  - **Caneta:** no Lápis, a caneta desenha e o dedo só move a vista e dá zoom, ao mesmo tempo. Depois de ver a caneta, a faixa ganha **Dedo desenha**, para o dedo voltar a desenhar (fica salvo no aparelho). No Martelo, a caneta crava onde toca.
- **Cartão da ligação:** toque na ferragem com o Martelo para abrir. Predefinições vêm antes dos números de Detalhes. As alças ajustam batentes, curso, comprimento livre e raio. Listas de paredes, respiros, portas e ações pedem o alvo na prancha. Cada edição tem desfazer.
- **Peça multicamada:** no cartão, abra **Camadas desta peça** e **Estender para outra camada**. Escolha camada e forma. Mover/girar age na peça inteira; tamanho e alças de esticar editam o perfil ativo. Tocar num perfil ativa sua camada. Também é possível tirar um perfil, separar em peça ou fundir peças aparafusadas em camadas distintas. A gaveta oferece came, engrenagem com catraca e pinhão com manivela.
- **Testar** liga a física: pausa, um passo, **Lento**, **Normal** e **Real**, reiniciar, arrastar peças e a régua da linha do tempo. A mão tem força limitada; não teletransporta as peças.
- **Trava:** toque na argola no Testar para soltar. Também pode responder a sensor ou funcionar como fusível pela força configurada. Só volta ao reiniciar; a soltura fica gravada na linha do tempo. No exemplo **Roda e lingueta**, solte a trava e gire o punho da manivela.
- **Entender o mecanismo** (menu Vista; nada disso muda a cena nem a simulação):
  - **Camadas em cores:** cada camada numa cor, com o número num selo em cada peça; a faixa tem **Afastar** (as camadas se separam em diagonal, como pranchas empilhadas, com um deslizante de distância; pinos viram hastes entre elas) e **Isolar** (só a camada ativa e as ligações dela). Vale no Montar e no Testar, com a simulação rodando.
  - **Esconder peças:** cada toque esconde a peça de cima sob o dedo, para ver o que está atrás (também "Esconder" no cartão da peça). A pílula "N escondidas" abre a lista; um toque traz de volta, "Mostrar todas" traz todas. Fica salvo com o projeto.
  - **O que é?** no cartão da ligação: três frases e uma animação curta de como ela funciona.
  - **Rastro** (só no Testar): as peças que se movem deixam um caminho curto em ouro.
- **Som:** menu Vista → **Som** abre uma faixa com **Música** e **Efeitos**, que ligam e desligam separados e ficam salvos no aparelho. Nada toca antes do primeiro toque na tela; a aba fora de foco cala tudo. A música é um fundo baixo em laço (a emenda acontece depois de ~2 min 11 s). Os efeitos marcam o que acontece: cravar parafuso, trava, eixo e pino, ligar mola, haste e cabo, soltar a trava, trocar entre Montar e Testar, concluir um corte do Lápis e abrir uma faixa ou um cartão; e, no Testar, os impactos (pelo material e pela massa, com volume e tom pela velocidade), os estalos da catraca, o gás acendendo (sopro nas cargas fraca e média, estouro seco na forte) e o chiado de gás pelos respiros. Desfazer, refazer, navegar e arrastar a régua não tocam nada.
- **Projetos** ficam salvos no aparelho a cada edição. Abrir um exemplo cria uma cópia. **Arquivo** exporta (copiar ou baixar o JSON) e importa cenas v0, v1, v2 e v3; a exportação grava v3.

Três páginas de trabalho, carregadas sob demanda:

- `/#perf`: a medição de desempenho. A cena de 150 peças e 100 ligações no palco real por 10 s; tocar em "Rodar 10 s" e depois em "Copiar resultado".
- `/#lab`: o laboratório. Lista as cenas de teste e os exemplos, roda cada um no motor do app (Box2D) com um desenho simples, deixa pausar, ver em Lento, Normal ou Real, reiniciar e arrastar as peças com o dedo, e mostra ao lado se as afirmações da cena passam. Uma cena direto: `/#lab/<grupo>/<nome>`, por exemplo `/#lab/exemplos/cilindro-dois-pistoes`.
- `/#bench`: o comparativo de motores (Planck, Rapier e Box2D). No celular: abrir, esperar o "Pronto", tocar em "Copiar resultado".

Playwright usa o Chromium indicado por `PLAYWRIGHT_BROWSERS_PATH`; para outro binário, defina `PW_CHROMIUM=/caminho/do/chrome`.

## Deploy

Build estático (Vite) pronto para a Vercel: `vercel.json` define `npm ci`, `npm run build` e a saída `dist/`. A ligação do projeto da Vercel ao repositório (com preview por branch) é feita pelo Will na conta dele.
