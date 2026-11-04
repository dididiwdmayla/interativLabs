# Papéis e fluxo de trabalho

## Quem faz o quê

| Papel | Quem | Entrega | Não faz |
| --- | --- | --- | --- |
| Coordenador geral | Claude, no chat do projeto interativLabs | Documentos de fase com itens e aceites; a instrução pronta de cada sessão do executor, com agente, modelo e esforço recomendados; revisão do resultado e do PR; atualização de `AGENTS.md`, `docs/arquitetura.md` e `docs/roadmap.md` | Código do app; abrir sessões de executor por conta própria |
| Coordenador visual | Papel assumido pelo Claude do projeto quando a fase pede arte, seguindo `docs/coordenacao/coordenador-visual.md` | Identidade, manifesto de cada lote, a lista completa de prompts do lote, revisão de cada imagem antes de entrar no repositório, revisão das folhas de contato, briefing ao coordenador geral | Código do app; gerar imagem |
| Coordenador sonoro | Papel assumido na fase de som | Lista de sons por evento, manifesto do lote de som, prompts, revisão de cada arquivo, briefing ao coordenador geral | Código do app; gerar áudio |
| Executor | Sessão do Claude Code ou do Codex aberta pelo Will no repositório | Implementação dos itens, testes, capturas, documento de verificação, PR | Gerar ou trocar assets e sons; seguir além de um ponto de revisão |
| Dono do projeto | Will | Escolhas de direção; abre as sessões do executor; gera a arte e o som; sobe os originais aprovados; merge | |

## Ciclo de uma fase

1. O coordenador geral escreve `docs/fases/fase-N.md` e entrega ao Will a instrução do executor, pronta para colar, dizendo onde rodar (Claude Code ou Codex), com qual modelo e esforço, e até que item a sessão vai.
2. O Will abre a sessão e cola a instrução. O executor trabalha item por item, um commit e um push por item, no branch `fase-N`.
3. Onde o documento da fase diz "pare e peça revisão", o executor para e devolve o resultado. O Will traz esse resultado ao chat do projeto.
4. O coordenador revisa (o que passou, o que falhou, o que fazer), mostra o que precisa de decisão do Will e entrega a próxima instrução: correção ou continuação.
5. No fim, o executor escreve `docs/verificacao-fase-N.md`, gera as capturas e abre o PR. O coordenador revisa o PR contra os aceites e as capturas. Aprovado, o Will faz o merge.

Se a sessão do executor cair no meio de um item, o Will abre outra com a mesma instrução: o `git log` diz onde parou.

## Ciclo de um lote de assets

1. O coordenador visual escreve `art/source/lote-NN/asset-manifest.md` e entrega ao Will a **lista completa de prompts do lote**, num documento só, com o nome, o formato e o anexo de cada imagem.
2. O Will gera as imagens no ChatGPT, na ordem da lista, e manda no chat do projeto dizendo o nome de cada uma.
3. O coordenador visual revisa cada imagem contra o manifesto: aprovada, ou reprovada com o motivo e o ajuste no prompt (anotados na seção "Revisões" do manifesto). Reprovada volta ao passo 2.
4. O Will sobe os originais aprovados em `art/source/lote-NN/`, com o nome igual ao ID (`hw-screw-slot.png`).
5. O coordenador visual fecha com um briefing ao coordenador geral: o que entrou, o que ficou de fora e o que conferir nas folhas de contato.
6. O coordenador geral entrega ao Will a instrução do executor para rodar `npm run assets`. As folhas de contato voltam ao coordenador visual para a conferência final.

## Instrução padrão do executor

O Will cola no Claude Code ou no Codex, aberto no repositório. O coordenador ajusta o número da fase e o ponto de parada.

```
Leia AGENTS.md e docs/fases/fase-N.md inteiros. Confira o git log para ver em que item a fase parou.
Trabalhe no branch fase-N. Execute os itens em ordem, a partir do primeiro que não tem commit.
Um commit por item, no formato "Fase N · item M — descrição", com lint, typecheck, test e build limpos antes de cada commit.
Onde o documento da fase pedir revisão do coordenador, pare e me mostre o resultado com as medidas e as capturas.
```
