# Briefing do coordenador visual ao coordenador geral — 04/11/2026

Assunto: o chat do coordenador visual agiu como coordenador geral e disparou a Fase 1. Ler antes de qualquer instrução de executor.

## O que aconteceu

1. O Will abriu um segundo chat no projeto para ser o coordenador visual. As instruções do projeto, que valem para todos os chats, definem o Claude como coordenador geral. Sem uma frase de abertura que dissesse o contrário, este chat assumiu o papel de geral.
2. Em 03/11, seguindo o `papeis.md` da época (commit `84c1969`, "executor passa a ser agente do projeto"), este chat disparou um agente executor para os itens 1 a 4 da Fase 1. Você não ficou sabendo. No seu chat, a última mensagem ao Will ainda diz que o executor não começou e pergunta "Disparo?".
3. O executor parou no meio do item 3, por limite de uso da conta.
4. O Will não queria nada disso. No fluxo dele, quem abre a sessão do executor (Claude Code ou Codex) é ele. O coordenador só entrega a instrução pronta, com agente, modelo e esforço recomendados.

## Estado do repositório

- O branch `fase-1` existe no GitHub, com dois commits que ninguém revisou:
  - `bfa7fe6` Fase 1 · item 1 — projeto, ferramentas e casca na Prancha índigo
  - `5117bd7` Fase 1 · item 2 — formato da cena v1, schema e migração do protótipo
- O `fase-1` parte de `b2afd59`, antes do frame oficial, do manifesto do lote 01 e da escala de 5 px/mm em `docs/arquitetura.md`. Ele precisa receber o `main` antes de seguir.
- O item 3 ficou pela metade e não foi commitado. Esse trabalho se perdeu e o item recomeça do zero.
- A ligação com a Vercel não foi feita, porque depende da conta do Will. Sem ela, o aceite do item 1 ("preview abrindo no celular") não fecha.

## O que mudei nos documentos de coordenação

Commits no `main`: `d583198` (fluxo de trabalho corrigido) e o deste briefing (coordenador visual em chat próprio).

- `AGENTS.md`, seção Papéis: o executor é uma sessão aberta pelo Will, com a instrução que o coordenador geral entrega pronta.
- `docs/coordenacao/papeis.md`: os ciclos foram reescritos.
  - Fase: o geral entrega a instrução; o Will abre a sessão; o executor para no ponto de revisão; o Will traz o resultado.
  - Lote de assets: a lista completa de prompts sai num documento só; o Will gera e manda cada imagem no chat do visual; o visual revisa antes de a imagem entrar no repositório; o Will sobe os aprovados; o visual escreve o briefing ao geral; o geral entrega a instrução do `npm run assets`.
  - Coordenador visual e coordenador sonoro: cada um num chat próprio.
- `docs/coordenacao/instrucoes-do-projeto.md` e `coordenador-visual.md`: mesmas correções.
- `art/source/lote-01/asset-manifest.md`, parágrafo de abertura: o fluxo novo de geração e revisão.

Esses arquivos são seus. Revise as mudanças e ajuste o que quiser; eu não mexo mais neles.

## O que você precisa fazer

1. **Não dispare executor.** Retire o "Disparo?" do seu chat. Daqui em diante, entregue ao Will a instrução para colar, com agente, modelo e esforço recomendados.
2. **Retomar a Fase 1, quando o Will quiser.** Neste chat o Will recebeu uma sugestão para o Claude Code com Opus e esforço alto. Revise antes de ele usar:

   ```
   Leia AGENTS.md e docs/fases/fase-1.md inteiros. Confira o git log para ver em que item a fase parou.
   Trabalhe no branch fase-1. Antes de começar, traga o main para ele (git merge origin/main): o main ganhou o frame oficial e a escala de tela de 5 px/mm em docs/arquitetura.md.
   Execute os itens em ordem, a partir do primeiro que não tem commit (deve ser o item 3).
   Um commit por item, no formato "Fase 1 · item M — descrição", com lint, typecheck, test e build limpos antes de cada commit. Push após cada commit.
   No item 4, preencha a tabela de docs/decisoes/motor.md com Node e navegador desta máquina e deixe a página /#bench pronta para eu rodar no celular.
   Onde o documento da fase pedir revisão do coordenador (fim do item 4), pare e me mostre o resultado com as medidas e as capturas.
   ```

3. **Revisar os itens 1 e 2.** Os dois entraram sem revisão. Confira os aceites no PR ou antes do item 4, como preferir.
4. **Imagens do lote 01.** O Will não vai mais mandar imagens no seu chat. Elas vêm para cá, eu reviso, e ele mesmo sobe as aprovadas no GitHub. Quando a leva 1 estiver no repositório, você recebe outro briefing meu com o que conferir nas folhas de contato, para entregar a instrução do `npm run assets`.
5. **Instruções do projeto.** O texto que o claude.ai aplica a todos os chats define o Claude como coordenador geral, e foi daí que veio a confusão. Sugiro duas coisas:
   - Acrescentar ao texto uma frase como: "Se o Will abrir a conversa dizendo que ela é o coordenador visual ou sonoro, siga o briefing desse papel em docs/coordenacao/ e não aja como coordenador geral".
   - O Will colar o texto atualizado de `docs/coordenacao/instrucoes-do-projeto.md` nas instruções do projeto.

## Lote 01, para seu controle

- O manifesto está pronto: 17 imagens em 3 levas.
- A lista completa de prompts está no projeto, em `lote-01/prompts-completos.md`. Ela substitui o `lote-01/leva-1.md`, que ficou repetido e pode ser apagado.
- Nenhuma imagem do lote foi gerada ainda.
