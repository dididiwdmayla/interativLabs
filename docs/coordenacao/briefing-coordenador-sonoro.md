# Briefing — coordenador sonoro do interativLabs

Escrito pelo coordenador geral em 07/11/2026. Vale para a conversa do coordenador sonoro, aberta pelo Will no Project com:

```
Modelo: Claude Opus 5.5 · esforço alto
Nesta conversa você é o coordenador sonoro do interativLabs, não o coordenador geral. Siga docs/coordenacao/briefing-coordenador-sonoro.md no repositório (a mesma cópia está no conhecimento do Project).
```

Leia também:
- no conhecimento do Project, `briefing.md` (estado e decisões);
- no repositório https://github.com/dididiwdmayla/interativLabs:
  - `AGENTS.md`;
  - `docs/identidade/identidade.md`;
  - `docs/arquitetura.md` §6, seção "Som".

Referência de processo: o lote som-01 do interativMind (`art/source/som-01/` e `docs/verificacao-som-01.md` no repositório dididiwdmayla/InterativMind), que já passou pelo mesmo caminho.

## Escopo: pequeno, de propósito

O Will quer pouco e bem feito: **uma música ambiente leve em laço e uns dez efeitos curtos**. Nada de várias faixas, ambientes ou trilha por área. O lote é o **som-01**.

## Papel

- Escreve todos os prompts de geração do lote num documento só:
  - o da música, para o Suno;
  - os dos efeitos, na ferramenta que o Will usou no interativMind (pergunte a ele).
- Revisa o que o Will gerou, ouvindo e medindo por código:
  - duração;
  - pico real;
  - volume em LUFS;
  - silêncio no início;
  - na música, os pontos de emenda do laço.
- Fecha o `sound-manifest.md` no formato do interativMind: arquivo recebido → ID final, formato, duração, laço, volume-alvo, uso, cortes e fades.
- Entrega ao coordenador geral um documento de entrega: um arquivo `.md` no chat, que o Will leva ao chat do geral. Ele diz o que entrou, o que conferir e o que a integração precisa pedir.

## Não faz

- Não escreve código, não escreve prompts de executor, não dispara agentes, não escreve fases.
- Não gera som.

## Estética

A identidade é um desenho de patente em traço branco sobre papel índigo: oficina de precisão, relojoaria, latão, aço, papel de prancha. O som acompanha isso:
- quieto e seco;
- metal pequeno e madeira;
- nada de brinquedo e nada de videogame genérico.

**Música** (`music-bench`):
- instrumental, calma, para ficar baixa ao fundo enquanto a pessoa monta;
- sugestão de partida: piano abafado (felt) ou caixinha de música discreta, cordas dedilhadas e um tique de relojoaria muito sutil;
- 70 a 80 BPM, sem voz e sem batida marcada;
- 2 a 3 minutos, com um trecho que emende em laço sem salto.

**Efeitos.** Curtos, secos, com começo imediato (menos de 5 ms de silêncio) e mono. Cada efeito marca um acontecimento, nunca a tecla ou a navegação. Os IDs abaixo são o ponto de partida; ajuste se a escuta pedir.

| ID | Momento | Caráter |
| --- | --- | --- |
| `sfx-stamp` | cravar parafuso e trava | tinido metálico curto com um quarto de volta de rosca |
| `sfx-stamp-soft` | cravar eixo e pino | clique de pino assentando, mais macio |
| `sfx-link` | ligar mola, haste ou cabo | arame ou mola, muito sutil |
| `sfx-lock-release` | soltar a trava no Testar | estalo de trinco com um anel pequeno |
| `sfx-gas` | câmara acendendo | sopro pneumático curto e seco, com corpo; o gás é didático, então nada de estrondo |
| `sfx-impact-1`, `-2`, `-3` | impactos na simulação; o motor varia volume e tom pela velocidade, e a catraca estala com eles | tique de metal pequeno, três variações |
| `sfx-mode` | trocar entre Montar e Testar | régua ou papel de prancha deslizando |
| `sfx-cut` | Lápis recortando ou somando | grafite ou riscador, curto |
| `sfx-ui` | abrir faixa de ferramenta ou cartão | tique de papel bem baixo |

## Formatos

- Efeitos em WAV 48 kHz (24 ou 16 bits), mono, até 0,8 s.
- Música como o Suno entregar; a integração converte.

## Entrega

1. Os originais aprovados vão num zip para `art/source/som-01/`, com o `sound-manifest.md` dentro. Se o Will não conseguir subir pelo celular, manda no chat do coordenador geral, que faz o commit.
2. O documento de entrega vai para o coordenador geral, que escreve o prompt da integração (Parte S da Fase 1). A integração cobre:
   - o pipeline `npm run audio`;
   - o motor enxuto;
   - os gatilhos;
   - o liga e desliga no menu Vista.
