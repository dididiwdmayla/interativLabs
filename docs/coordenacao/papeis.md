# Papéis e fluxo de trabalho

## Quem faz o quê

| Papel | Quem | Entrega | Não faz |
| --- | --- | --- | --- |
| Coordenador geral | Claude, no projeto interativLabs | Documentos de fase com itens e aceites; instruções prontas para cada sessão do executor; revisão de PR; atualização de `AGENTS.md`, `docs/arquitetura.md` e `docs/roadmap.md`; ativação dos coordenadores subordinados | Código do app |
| Coordenador visual | Agente subordinado, ativado pelo coordenador geral | Frames, manifesto de cada lote de assets (formato, dimensões, escala em mm, regras de repetição, âncoras), prompts para o ChatGPT, revisão das folhas de contato | Código do app; gerar imagem |
| Coordenador sonoro | Agente subordinado, ativado na fase de som | Lista de sons por evento do domínio, manifesto do lote de som, prompts para a ferramenta de geração, revisão das medidas | Código do app; gerar áudio |
| Executor | Will, com o Claude Code | Implementação dos itens, testes, capturas, documento de verificação, PR | Gerar ou trocar assets e sons |

## Ciclo de uma fase

1. O coordenador geral escreve `docs/fases/fase-N.md` e entrega ao Will a instrução de abertura da sessão.
2. O Will abre a sessão do Claude Code no repositório com essa instrução. O executor trabalha item por item, um commit por item, no branch `fase-N`.
3. Onde o documento da fase diz "pare e peça revisão", o executor para. O Will traz o resultado ao coordenador, que aprova ou corrige o rumo.
4. No fim, o executor escreve `docs/verificacao-fase-N.md`, gera as capturas e abre o PR.
5. O coordenador revisa o PR contra os aceites e as capturas. Aprovado, o Will faz o merge.

## Ciclo de um lote de assets

1. O coordenador visual escreve `art/source/lote-NN/asset-manifest.md` e os prompts.
2. O Will gera as imagens no ChatGPT e sobe os originais no mesmo diretório.
3. O executor roda `npm run assets` e gera as folhas de contato.
4. O coordenador visual revisa as folhas. Asset reprovado volta para o passo 2, com o motivo anotado no manifesto.

## Instrução padrão para abrir uma sessão do executor

```
Leia AGENTS.md e docs/fases/fase-N.md inteiros. Confira o git log para ver em que item a fase parou.
Trabalhe no branch fase-N. Execute os itens em ordem, a partir do primeiro que não tem commit.
Um commit por item, no formato "Fase N · item M — descrição", com lint, typecheck, test e build limpos antes de cada commit.
Onde o documento da fase pedir revisão do coordenador, pare e me mostre o resultado.
```
