# Verificação — Fase 1 · Parte D (palco vivo)

Data: 04/11/2026. Branch `claude/fase-1-parte-d-0930lm` (o branch de trabalho desta sessão; o prompt pedia `fase-1-parte-d`). Máquina: Node 22 e Chromium 153 headless, 4 núcleos, sem GPU.

## Itens

| Item | Feito | Commit |
| --- | --- | --- |
| 6.1 Renderizador base | `src/render/`: cena → SVG por camada e peça, papel no fundo do contêiner, moldura e Fig. N, estados de camada, poses escritas direto nos nós (`StageNodes`). Este commit já trouxe a primeira versão da pele, das ligações e do Simular, refinadas nos seguintes | `a4a63cd` |
| 6.2 Pele das peças | Chanfro e faixa do corpo por offsets Clipper2, parede, sombra, cinco hachuras e pautado em `pattern` com degrau 2ᵏ, madeira pelo `hatch-wood` atual | `fb44c74` |
| 6.3 Ligações | Ferragens, mola de pontas e espiras, haste, cabo, trilho, suporte, câmara, apoio, chamadas sem cruzar, variante gold | `e7a133b` |
| 6.4 Simular | `SimSession`, controlador sob demanda, controles, régua com eventos, volta por reexecução, arrasto | `b9d30f0` |
| 6.5 Vista e toque | Pan, pinça, dois dedos, roda, enquadrar, seleção e painel só leitura | `17ceab2` |
| 6.6 Exemplos | `scenes/examples/index.json`, menu (☰), cena padrão ao abrir | `ac5d04f` |
| 6.7 Desempenho | Cena de 150 peças e 100 ligações, `/#perf`, física no worker, folhas compostas, orçamento da parede | `63c5f30` |
| 6.8 Verificação | Testes, capturas, este documento, arquitetura §5 e README | commit deste documento |

## Testes

`npm run lint`, `npm run typecheck`, `npm test` (19 arquivos, 409 testes + 4 falhas esperadas preexistentes; 13 do pipeline de assets) e `npm run build` limpos, sem avisos. Novos:

- `src/render/scene.test.tsx`: a montagem em SVG de cada exemplo bate com o snapshot da estrutura (elementos, classes, data-*, sem coordenadas).
- `src/render/skin.test.ts`: offsets do chanfro em peça com furo e rasgo (furos crescem, área perdida ≈ perímetro × d), faixa do corpo fixo, tom liso abaixo de 24 px, degraus da hachura.
- `src/render/links.test.ts`: número de espiras pelo comprimento livre, escala entre 0,6 e 1,6 na pose desenhada, espiras encostadas no sólido, cabo reto esticado e curva quando frouxo, chamadas fora das peças sem cruzar.
- `src/sim/session.test.ts`: voltar ao passo N (com arrasto na biela e no meio do disparo do cilindro) dá o mesmo hash de poses da execução contínua, e segue igual dali.
- `src/render/hit.test.ts`: o toque pega a peça mais alta sob o dedo (camada, ordem, pose atual, tolerância).
- `src/geometry/outline.test.ts`: `shapeOutline` dá o mesmo contorno e massa de `shapeGeometry`.
- `src/ui/scenes/examples.test.ts`: índice dos exemplos coerente.
- Cena `desempenho/desempenho` com roteiro de estabilidade e hash; `npm run test:e2e` confirma o mesmo hash no Chromium em todas as cenas.

Playwright: `check:overflow` passa em 360, 390 e 412 px para `/`, `/#bench`, `/#lab`, `/#lab/exemplos/cilindro-dois-pistoes` e `/#perf`; `--project=lab` e `--project=determinism` passam; `--project=capture-d` gera as 20 capturas.

## Desempenho

Detalhes em `docs/decisoes/desempenho.md`. Chromium da sessão, 150 peças e 100 ligações a 1× com arrasto: **390×844: 59,9 qps (p5 59,5–59,9)**; **1440×900: 59,9 qps (p5 59,5)**, com 3–5% dos quadros acima de 20 ms. Física no worker: 6,3–7,7 ms por quadro (≈ 4 passos). Desenho (JS): 0,8 ms de mediana. Pacote principal: 108,4 KB gzip (era 71,8 KB no `main`); Simular sob demanda: controlador 2,6 KB + worker e motor ≈ 48 KB + WASM 207,8 KB.

## Capturas

`docs/capturas/fase-1/parte-d/`, em 390×844 e 1440×900 (densidade 2): `editar-<exemplo>`, `simular-cilindro-005` (0,05×, no quadro de maior pressão logo depois do acendimento), `simular-biela`, `selecionada`, `raio-x`, `linha-do-tempo`.

## Revisão de diretor de arte (lado a lado com o frame oficial)

No nível do frame:

- **Peça usinada.** De perto (engrenagens, trava, biela a partir de 2×), contorno, chanfro claro em dois tons, parede e sombra dura leem como chapa gravada, inclusive por dentro de furos e rasgos. A catraca da camada ativa sobre as engrenagens veladas lembra a (a).
- **Camadas veladas** com face em `wall` e traço apagado; a ativa salta sem cor. **Raio-x** limpo.
- **Corpo fixo** com a faixa de hachura na borda e o pautado no miolo, como o quadrado 7 da (d).
- **Moldura** tracejada no Editar e contínua no Simular; "Fig. N" em cursiva; régua em ouro com eventos em brasa; fio e anel de ouro no arrasto.

Abaixo do frame (pendências de arte):

1. **Escala no celular.** Os exemplos são pequenos (peças de 5 a 40 mm) e o enquadramento usa toda a cena: no 390×844 o cilindro e o lançador ficam miúdos, com peças abaixo de 24 px que viram tom liso sem chanfro (`editar-cilindro-dois-pistoes-390x844`, `raio-x-390x844`). No frame (a) o mecanismo ocupa a prancha. Caminho: exemplos desenhados maiores ou enquadramento que ignore partes soltas (a esfera alta do cilindro).
2. **Gás.** O preenchimento em brasa por opacidade é fraco perto do pontilhado do frame (b); o pontilhado (`fx-gas`) é da Fase 2.
3. **Chamadas.** Ficam fora das peças e sem cruzar, mas em cenas compridas as linhas ficam longas e às vezes atravessam outras peças (`editar-trava-1440x900`). No frame elas são curtas e saem para o lado livre mais próximo.
4. **Dica da ferramenta** no topo cobre parte da prancha no celular; no frame não há esse letreiro.
5. **Régua no celular** mostra só os tiques de segundo (os de 0,1 s ficariam a 3 px).
6. **Madeira**: os nós do `hatch-wood` atual repetem em grade (já sabido; o asset volta ao coordenador visual).
7. **Parede das peças móveis** some no Simular em cenas com mais de 40 peças móveis (orçamento de pintura); nos exemplos ela fica.
8. Sem `tex-ink-wear` (Fase 2): a hachura ainda está limpa demais perto da gravura do frame.

## O que ficou de fora e por quê

- Ferramentas de desenho e de ligação, desfazer e projetos salvos: Parte E2.
- Efeitos (pontilhado do gás, leque do escape, faíscas) e falhas de tinta: Fase 2.
- GSAP: conferida a versão atual (`gsap` 3.15.1 no npm, instalada 3.15.0; `@gsap/react` 2.1.2), mas nada nesta parte precisou dele: as transições de interface são de CSS com os tokens e cortes curtos com `prefers-reduced-motion`.
- A troca de degrau da hachura acontece no fim do gesto, mas sem a transição de opacidade de 120 ms da identidade.
