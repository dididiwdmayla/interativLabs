# Fase 1 · Parte E2d (A)

Criação em `fase-1-parte-e2d-a`, sobre `main` (`2c94e1b`). Sem subagentes, alterações no motor ou bateria de regressão.

| Item | Commit | Situação |
| --- | --- | --- |
| 16.1 | `dda8da6` | Pronto: frases, preferência do dedo, dica de teclado e pílula inteira em 844×390. |
| 16.2 | `a37076f` | Criação pronta: cores, afastamento, hastes e isolamento capturados nos dois mecanismos, tamanhos e modos. Interação completa fica para verificação. |
| 16.3 | `7bb6022` | Pronto: esconder/restaurar, miniaturas, persistência de vista e ligações parcialmente visíveis. Ferrolho escondido capturado no Testar. |
| 16.4 | Este commit: `Fase 1 · item 16.4 — cartões explicativos e rastro` | Implementado; aceite visual do rastro pendente. Os quatro cartões foram capturados, mas o roteiro usou Normal ¼ em vez de Lento 1/20 e não comprova claramente os dois rastros simultâneos. |

O commit final também reúne a formatação e o acabamento dos itens anteriores.

Paleta provisória: `--layer-1` … `--layer-16`, todas em `oklch(72% 0.065 H)`. Matizes, na ordem: **150, 205, 270, 330, 175, 235, 300, 125, 190, 255, 315, 345, 160, 220, 285, 140** graus. Números em `--color-shadow` sobre a cor da camada.

Verificação feita: typecheck por item; Vitest focado em `hammer`, `layerView`, `hiddenParts`, `projects`, `hit`, `explain` e `trails`; lint e build. Sem suíte completa, bancada, abuso, overflow ou determinismo. `capture-e2d` rodou **uma vez**, com **2 cenários aprovados e 30 imagens**, em [capturas](capturas/fase-1/parte-e2d/).

Após olhar as imagens, houve uma rodada de acabamento visual: distância passou a abrir por botão e as pílulas ganharam espaço junto à régua. Não houve nova captura; as imagens preservam o estado anterior a esse acabamento. O roteiro foi corrigido para Lento para a próxima sessão. O histórico do rastro também ganhou amostragem por tempo simulado para conservar a janela de 0,5 s em câmera lenta, coberta por teste focado.

Pontos para a sessão B:

- Conferir ponteiros, alças, prévias do Lápis/Martelo e arrasto de perfis multicamada com afastamento; nem todos os caminhos de interação foram exercitados.
- Conferir pontas de ligações, gás e rótulos em camadas diferentes; as hastes de pinos/sensores e as pontas escondidas usam desenho próprio.
- Exercitar toque longo, caneta real, preferências bloqueadas, troca/reabertura de projetos e combinações com raio-x, canhoto e retrato.
- Confirmar AA, desempenho e rastro simultâneo do Ferrolho/esfera em Lento, inclusive pausa, retorno na régua e aba sem foco. A captura existente `rastro-lento-*` está em Normal ¼.
- Conferir o acabamento visual posterior à captura, especialmente a régua e o controle de distância.

`rtk gain`: indisponível no ambiente; saída: `/bin/bash: line 1: rtk: command not found`.
