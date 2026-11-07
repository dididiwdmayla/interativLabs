# Roadmap do interativLabs

Cada fase tem um documento próprio em `docs/fases/` com itens numerados e critérios de aceite. O coordenador escreve o documento da fase antes de ela começar. Uma fase só fecha com `docs/verificacao-fase-N.md` e as capturas.

## Fase 0 — Direção (coordenação, sem código)

0.1 Documentos de coordenação: regras, arquitetura, roadmap, papéis. **Feito.**
0.2 Referência de imagem: comparar referências reais de cada frame, escolher a direção, gerar as imagens do frame no ChatGPT e fechar a identidade. Os assets são feitos a partir dessa referência. **Direção escolhida: Prancha índigo** (desenho de patente em traço branco sobre índigo), descrita em `docs/identidade/identidade.md`. **Feito:** frame oficial aprovado (seis imagens) em `docs/identidade/frame-oficial/`, com a avaliação no `README.md` da pasta.
0.3 O coordenador visual escreve o manifesto do lote 01 a partir do frame escolhido. **Manifesto escrito:** `art/source/lote-01/asset-manifest.md`, com a divisão entre asset e procedural, 17 imagens em 3 levas e os prompts.
0.4 O Will gera o lote 01 e sobe em `art/source/lote-01/` com o manifesto.

A Fase 1 pode começar enquanto a Fase 0 anda. Ela usa tokens provisórios.

## Fase 1 — Fundação

O protótipo reescrito sobre a arquitetura definitiva, com o motor escolhido por medição, testes de cena, desfazer em tudo e persistência.

Cresceu no caminho (04–07/11): palco vivo na pele da Prancha índigo, editor tátil em paisagem, exemplo-vitrine, e as ferramentas da mão para montar do zero: Martelo (ligar e fixar), peça multicamada e trava (formato v3), Lápis (recortar, acrescentar, borracha e rasgo). Partes e itens em `docs/fases/fase-1.md`. Faltam, nesta ordem (decidida com o Will em 07/11): **E2c** (acertos do teste, Lápis e caneta; em andamento), **E2d** (camadas em cores, esconder peça, cartões "o que é", rastro), **S** (som mínimo, quando o lote som-01 chegar; o coordenador sonoro já está trabalhando) e **E3** (verificação, com o `/#perf` no celular).

Saída: um app no ar que monta, liga, recorta e testa mecanismos do zero no celular deitado, com desfazer, projetos salvos, linha do tempo e som.

## Fase 2 — Mecânica 2.0

Profundidade mecânica, que é o que o Will mais quer da plataforma: ver, alterar e comparar como um mecanismo funciona. Em quatro partes curtas, nesta ordem:

- **M1 · Instrumentos e variantes.** Gráficos ao vivo de pressão, posição, velocidade, ângulo e força numa ligação; folga e contato; contagem de ciclos. **Comparar variantes:** duas versões do mesmo mecanismo rodando a mesma entrada, com os gráficos sobrepostos e a diferença medida. Vem primeiro porque as partes seguintes usam esses instrumentos nos próprios aceites.
- **M2 · Ciclo.** Cápsula com carga didática (a câmara aciona; o projétil sai e o estojo empurra a face da culatra), extrator e ejetor, tomada de gás para um pistão, trancamento por báscula e por alavanca articulada (o que cabe no plano), tudo como peças e ligações genéricas. Exemplo-vitrine: lançador de cápsulas com extração e ejeção pela física.
- **M3 · Pneumática.** Reservatório, válvula de retenção, válvula de carretel, bomba de pistão. Exemplo: bomba enchendo um reservatório que move um cilindro.
- **M4 · Relojoaria.** Escape de âncora, pêndulo, roda de balanço com espiral. Exemplos: escape de relógio e fechadura de pinos.

Saída: comparar duas versões de um extrator com números; um escape que marca o tempo; um ciclo completo de cápsula, extração e ejeção sem animação imposta.

## Fase 3 — Oficina guiada e projetos

A oficina guiada de `docs/arquitetura.md` §6 (receitas passo a passo, com gabarito fantasma, ferramenta realçada e conferência automática), com receitas que já usam a Mecânica 2.0: trinco de porta, catraca, gatilho com retém, engrenagens, ciclo com extração, escape, bomba. Galeria de projetos com miniaturas, duplicar e versionar.

Saída: alguém que nunca abriu o app monta um trinco e um escape seguindo a oficina.

## Fase 4 — Acabamento visual

Vem depois da mecânica para o coordenador visual fazer um lote só, cobrindo as peças novas (cápsula, extrator, escape, válvulas, trava). Fecha o acabamento: falhas de tinta e madeira (lote 01 revisto), efeitos (pontilhado do gás, leque do escape, faíscas de impacto), tela de entrada com a ilustração das pranchas, movimento de interface com as curvas da identidade, ícones finais e revisão de diretor de arte em todas as telas. Candidata ao Modo Astra (`docs/coordenacao/papeis.md`) para a criação visual.

Saída: as cenas de exemplo e o objeto padrão com acabamento de apresentação em 390 e 1440 px.

## Fase 5 — Editor 2.0

Encaixes de CAD (centro, vértice, ponto médio, concêntrico, tangente), cotas e medidas, seleção múltipla, grupos, repetição linear e circular, alinhar e distribuir, renomear e reordenar com arrasto.

Saída: dá para desenhar um mecanismo de relojoaria simples só com o editor, sem digitar coordenada.

## Fase 6 — Biblioteca de peças

Geradores paramétricos com presets: molas (compressão, tração, torção, lâmina), coroa interna, came e seguidor, detente de esfera, pistão e cilindro, rolamentos, e submontagens prontas. Cada peça sai da biblioteca já com material e ligações sugeridas.

Saída: catálogo navegável com miniaturas, e cada peça com teste de geração.

## Fase 7 — Simulação 2.0

O que sobrar depois da M1: setas de força nos contatos, cor de tensão nas molas, medição de energia, marcas de evento na linha do tempo, sensores com mais ações.

## Fase 8 — Vista explodida

As camadas se afastam em perspectiva, com transição animada, mostrando pinos e eixos atravessando as camadas. Funciona parada e durante a simulação.

## Fase 9 — Som 2.0

Além do som mínimo da Fase 1: batidas metálicas por material, ambiente de oficina, mais faixas, motor com barramentos completo, como o do interativMind.
