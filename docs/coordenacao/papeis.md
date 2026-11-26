# Papéis e escolha de agente

Resumo para quem coordena. O estado do projeto e as decisões ficam no `briefing.md` do Project; as regras técnicas, no `AGENTS.md`.

## Papéis

- **Coordenador geral** (chat principal do Project): planeja fases, escreve os prompts do executor, revisa os relatórios no repositório e mantém `AGENTS.md`, `docs/arquitetura.md`, `docs/roadmap.md`, `docs/fases/` e esta pasta. Não escreve código do app.
- **Coordenador visual** (`briefing-coordenador-visual.md`) e **coordenador sonoro** (`briefing-coordenador-sonoro.md`): chats próprios, abertos pelo Will. Escrevem os prompts de geração e o manifesto de cada lote, revisam o que o Will gerou e entregam um documento ao coordenador geral.
- **Executor**: sessão aberta pelo Will com o prompt do coordenador. Faz só o que o prompt pede, um commit por item, e termina com o relatório.
- Ninguém dispara agentes por conta própria, e ninguém gera nem substitui assets ou sons fora do fluxo do lote.

## Escolha de agente, modelo e esforço

Decidido pelo Will em 26/11: o ChatGPT entra só com o GPT-6.1 Sol, e tarefas de raciocínio ficam com o Opus.

| Trabalho | Agente e modelo |
| --- | --- |
| Motor, arquitetura, geometria, física nova, UI rica, criação visual, desenho de mecanismo: tudo que pede raciocínio | Claude Code na web · Claude Opus 5.5 · esforço alto |
| Implementação com especificação fechada, trabalho mecânico, bateria de testes e documentação | Claude Sonnet 5.5 (médio ou alto) ou Codex · GPT-6.1 Sol |
| Correções focadas e itens pequenos | Codex · GPT-6.1 Sol · esforço alto |

Prompts em fatias de até 5 itens, para caber numa sessão.

### Fora de uso

- **GPT-6 Astra** (usado nas partes E2d (A), M1a e M1b, em 07/11): o resultado ficou no nível do Opus, mas o consumo foi excessivo; uma tarefa gastou o limite semanal inteiro.
- **`rtk`** (proxy que comprime a saída dos comandos): instalado pelo script do ambiente do Codex, nunca chegou ao agente. O usuário do agente (`agent`) não alcança o que o script instala como root. Relatos posteriores dizem que às vezes gasta mais do que economiza. Abandonado em 26/11.
