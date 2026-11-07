# Papéis e escolha de agente

Resumo para quem coordena. O estado do projeto e as decisões ficam no `briefing.md` do Project; as regras técnicas, no `AGENTS.md`.

## Papéis

- **Coordenador geral** (chat principal do Project): planeja fases, escreve os prompts do executor, revisa os relatórios no repositório e mantém `AGENTS.md`, `docs/arquitetura.md`, `docs/roadmap.md`, `docs/fases/` e esta pasta. Não escreve código do app.
- **Coordenador visual** (`briefing-coordenador-visual.md`) e **coordenador sonoro** (`briefing-coordenador-sonoro.md`): chats próprios, abertos pelo Will. Escrevem os prompts de geração e o manifesto de cada lote, revisam o que o Will gerou e entregam um documento ao coordenador geral.
- **Executor**: sessão aberta pelo Will com o prompt do coordenador. Faz só o que o prompt pede, um commit por item, e termina com o relatório.
- Ninguém dispara agentes por conta própria, e ninguém gera nem substitui assets ou sons fora do fluxo do lote.

## Escolha de agente, modelo e esforço

| Trabalho | Agente e modelo |
| --- | --- |
| Motor, arquitetura, geometria, UI rica, criação visual, desenho de mecanismo | Claude Code na web · Claude Opus 5.5 · esforço alto |
| Criação visual e de interação bem delimitada, quando valer o custo | Codex · GPT-6 Astra · esforço médio, no Modo Astra |
| Correções focadas, lógica e itens pequenos | Codex · GPT-6.1 Sol · esforço alto |
| Implementação com especificação fechada, trabalho mecânico, bateria de testes | Claude Sonnet 5.5 (médio ou alto) ou GPT-6.1 Sol · médio |

### Modo Astra

O GPT-6 Astra entrega no nível do Opus, mas a E2b consumiu o limite semanal inteiro do Will. Por isso:
- **Tarefa:** só criação visual e de interação bem delimitada, sem bateria de testes e sem pedido de retrabalho na mesma sessão.
- **Prompt:** arquivos de partida, condição de parada e "não explore além destes arquivos".
- **Configuração:** esforço médio (alto só se travar), Fast desligado (`/fast off`), um agente só.
- **Verificação:** só a mínima no fim: lint, typecheck, build e os testes dos arquivos tocados. A bateria completa e os acertos vão para uma sessão separada, com Sonnet ou Sol.
- **Relatório:** curto. Um commit por item serve de registro para retomar.
- **A testar:** o `rtk`, que comprime a saída dos comandos para o agente (`rtk init -g --codex`). Entraria pelo script de configuração do ambiente do Codex na web.

Prompts em fatias de até 5 itens, para caber numa sessão.
