# Roadmap do interativLabs

Cada fase tem um documento próprio em `docs/fases/` com itens numerados e critérios de aceite. O coordenador escreve o documento da fase antes de ela começar. Uma fase só fecha com `docs/verificacao-fase-N.md` e as capturas.

## Fase 0 — Direção (coordenação, sem código)

0.1 Documentos de coordenação: regras, arquitetura, roadmap, papéis. **Feito.**
0.2 Referência de imagem: comparar referências reais de cada frame, escolher a direção, gerar as imagens do frame no ChatGPT e fechar a identidade. Os assets são feitos a partir dessa referência. **Direção escolhida: Prancha índigo** (desenho de patente em traço branco sobre índigo), descrita em `docs/identidade/identidade.md`. **Feito:** frame oficial aprovado (seis imagens) em `docs/identidade/frame-oficial/`, com a avaliação no `README.md` da pasta.
0.3 O coordenador visual escreve o manifesto do lote 01 a partir do frame escolhido. **Manifesto escrito:** `art/source/lote-01/asset-manifest.md`, com a divisão entre asset e procedural, 17 imagens em 3 levas e os prompts.
0.4 O Will gera o lote 01 e sobe em `art/source/lote-01/` com o manifesto.

A Fase 1 pode começar enquanto a Fase 0 anda. Ela usa tokens provisórios.

## Fase 1 — Fundação

O protótipo reescrito sobre a arquitetura definitiva, com o motor escolhido por medição, testes de cena, desfazer em tudo e persistência. Visual provisório, mas limpo.

Saída: um app no ar na Vercel que faz tudo o que o protótipo fazia, mais desfazer, salvar projetos e a linha do tempo básica, com os testes do motor passando.

## Fase 2 — Linguagem visual

O lote 01 aplicado: tokens finais, tipografia, materiais com textura e chanfro, sombra entre camadas, ferragens nos pontos de ligação, molas desenhadas por espiras, fundo da bancada, ícones próprios, tela de entrada. A peça desenhada à mão passa a parecer usinada.

Saída: as três cenas de exemplo com acabamento de apresentação em 390 e 1440 px.

## Fase 3 — Editor 2.0

Booleanos entre peças (furos e rasgos com pino correndo já entram na Fase 1), encaixes de CAD (centro, vértice, ponto médio, concêntrico, tangente), cotas e medidas, seleção múltipla, grupos, repetição linear e circular, alinhar e distribuir, travar camada, renomear e reordenar com arrasto.

Saída: dá para desenhar um mecanismo de relojoaria simples só com o editor, sem digitar coordenada.

## Fase 4 — Biblioteca de peças

Geradores paramétricos com presets: molas (compressão, tração, torção, lâmina), engrenagem evolvente, cremalheira, coroa interna, came e seguidor, catraca e lingueta, alavancas, trinco e lingueta de porta, detente de esfera, pistão e cilindro, parafusos, pinos, rebites e rolamentos. Cada peça sai da biblioteca já com material e ligações sugeridas.

Saída: catálogo navegável com miniaturas, e cada peça com teste de geração.

## Fase 5 — Simulação 2.0

Linha do tempo completa (gravar, voltar, repetir em câmera lenta, marcar eventos), setas de força nos contatos, cor de tensão nas molas, gráficos (pressão, velocidade, ângulo), medição de energia, faíscas e clarões de impacto, sensores que disparam mais de uma ação.

Saída: dá para entender o tempo de um mecanismo quadro a quadro.

## Fase 6 — Vista explodida

As camadas se afastam em perspectiva, com transição animada, mostrando pinos e eixos atravessando as camadas. Funciona parada e durante a simulação.

## Fase 7 — Som

Lote de som gerado pelo coordenador sonoro: cliques de catraca, mola soltando, batidas metálicas por material, estouro de gás, ambiente de oficina. Motor de som com barramentos, igual ao do interativMind.

## Fase 8 — Projetos e exemplos guiados

Galeria de projetos com miniaturas, exemplos com roteiro (o app mostra onde tocar), duplicar e versionar projetos.
