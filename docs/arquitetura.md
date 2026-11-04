# Arquitetura do interativLabs

Documento vivo. Descreve como o app é dividido, o formato da cena, o modelo de física e as decisões que valem para todas as fases. Decisões tomadas por medição ficam em `docs/decisoes/`.

## 1. Visão geral

O app tem dois modos que nunca se misturam:

- **Editar**: desenhar peças, organizar camadas, criar ligações, ajustar propriedades. O estado é a cena (`Scene`), um documento JSON.
- **Simular**: a cena é compilada para o motor de física, que roda em passo fixo. A pessoa opera o mecanismo pelo toque. Ao voltar para Editar, a simulação é descartada; a cena desenhada não muda.

```
Scene (JSON) ──compile──▶ EngineWorld ──step──▶ Snapshot ──render──▶ SVG
     ▲                                                   │
     └──────────── comandos do editor ◀── toque ─────────┘ (no modo Editar)
```

## 2. Módulos

| Módulo | Faz | Não pode |
| --- | --- | --- |
| `src/model` | Tipos da cena, schema Zod, versões, migrações, ids | Importar React, tocar DOM |
| `src/geometry` | Polígonos com furos, booleanos (unir, subtrair), rasgos, decomposição convexa, offsets, engrenagem evolvente, testes de ponto | Conhecer o motor |
| `src/engine` | Adaptador do motor: compila a cena, aplica forças customizadas, devolve snapshots | Conhecer o renderizador |
| `src/sim` | Laço de passo fixo, gravação de quadros, linha do tempo, eventos (sensor, câmara) | Tocar DOM |
| `src/parts` | Geradores paramétricos: mola, engrenagem, cremalheira, came, catraca, alavanca, parafuso | Guardar estado |
| `src/render` | Desenho SVG da cena e do snapshot: peças, materiais, ligações, efeitos | Alterar a cena |
| `src/editor` | Ferramentas, seleção, encaixes, comandos de desfazer/refazer | Falar direto com o motor |
| `src/ui` | Painéis, barras, folhas, campos, menus | Lógica de domínio |

`src/model`, `src/geometry`, `src/engine` e `src/sim` rodam no Node e são cobertos por testes sem navegador.

### Interface do motor (`src/engine/types.ts`)

O app usa um motor só, o Box2D v3, carregado sob demanda por `src/engine/box2d/load.ts`. Ele fica atrás do adaptador comum, que a bancada (`/#bench`) também usa para Planck e Rapier. Entra a cena v2 (mm, g, s, N, kPa, rad); sai o snapshot nas unidades da cena. Só o adaptador conhece a escala interna.

```ts
interface EngineAdapter {
  readonly meta: { id: string; name: string; version: string; iterations: string };
  compile(scene: Scene, options: { unitMm: number }): CompileReport; // avisos, corpos, formas, juntas
  step(dt: number): void;            // um passo; o passo fixo de 1/240 s fica em src/sim
  snapshot(): Snapshot;              // poses, estado das ligações e eventos do passo
  pose(partId: Id): PartPose | null; // uma peça, sem montar o snapshot
  dragStart(partId: Id, pointMm: Vec2): boolean; // o dedo
  dragMove(pointMm: Vec2): void;
  dragEnd(): void;
  contactsDepthMax(): number;        // maior penetração do passo, mm
  setMotorSpeed(linkId: Id, speed: number): void;        // rad/s
  setVelocity(partId: Id, v: Vec2, omega: number): void; // roteiros de teste
  setForce(partId: Id, force: Vec2 | null, at?: Vec2): void; // N, constante até trocar (roteiros)
  ignite(linkId: Id): boolean;                           // acende uma câmara (como o sensor)
  setVent(linkId: Id, vent: number, open: boolean): void; // válvula de um respiro
  dispose(): void;
}
```

Snapshot (`time`, `steps`, `parts[id] = { x, y, angle }`, `links[id]`, `events`). Forças em N, torques em N·mm, pressão em kPa, gás em mmol, trabalho em mJ (N·mm):

| Ligação | Estado |
| --- | --- |
| Eixo | `angle` (rad, relativo à pose desenhada), `speed` (rad/s), `gap` (abertura entre os dois pontos, mm), `torque` (motor ou atrito) |
| Trilho | `translation` (mm), `force` (ao longo do eixo: batentes, atrito e mola de retorno) |
| Haste, cabo | `length`, `force` (+ puxa); cabo: `slack` (folga; > 0 = frouxo) |
| Suporte elástico | `offset` (deslocamento do ponto, mm), `angle` |
| Rasgo | modo junta: `position` (ao longo do rasgo, a partir do meio) e `deviation` (transversal); modo contato: `clearance` (folga até a parede; negativa = penetrando) |
| Mola | `length`, `force` (+ empurra; inclui o batente das espiras), `stopForce` (só o batente), `sideForce` (transversal ao eixo da guia) |
| Câmara | `pressure` (absoluta), `volume` (mm³), `gas`, `fired`, `burning`, `walls[] = { part, force, impulse (N·s), work, travel, sealed }`, `vents[] = { open, exposed }`, `ports[] = { exposed }` |
| Sensor | `count` |

Eventos do passo: `sensor` (peça e velocidade de aproximação), `chamber-fired`, `wall-unsealed`, `vent-opened` (pela parede que passa ou pelo sensor), `vent-closed`, `port-opened` e `impact` (duas peças, velocidade de aproximação acima de 100 mm/s e o ponto; para som e faíscas futuros).

- Parte comum a todos os motores: `plan.ts` (cena → corpos compostos, peças convexas, massa pela geometria e pela espessura da camada, ligações em unidades internas g·mm·s), `runtime.ts` (forças explícitas, sensor, arrasto de reserva, snapshot) e `chamber.ts` (o gás). O adaptador traduz o plano e lê e escreve nos corpos.
- Corpo dinâmico com origem no centro de massa e ângulo 0 na pose desenhada; cada grupo fixo é um corpo estático próprio (uma junta com uma peça fixa só desliga o contato com aquela peça). O índice 0 é o fundo, ponta das ligações com `a: null`.
- Determinismo: o código comum (geometria, plano, runtime, câmara, adaptador, migrações) não usa as funções transcendentais do JS; usa `src/geometry/dmath.ts` (portes do fdlibm, só operações exatas do IEEE). O mesmo hash no Node e no Chromium em todas as cenas de `scenes/fixtures/`.
- `src/sim/`: roteiros das cenas de teste (`script.ts`: entradas no tempo e afirmações sobre grandezas), executor sem DOM (`runner.ts`) e o registro das cenas (`fixtures.ts`). O laboratório (`/#lab`) e o Vitest usam o mesmo executor.

## 3. Formato da cena (versão 1)

Unidades da cena: milímetros e radianos. A interface mostra graus.

```ts
type Id = string;

interface Scene {
  version: 1;
  meta: { title: string; createdAt: string; updatedAt: string };
  settings: { gravity: { on: boolean; g: number /* mm/s² */ }; snap: { grid: number /* mm */; on: boolean } };
  layers: Layer[];           // índice 0 = fundo
  parts: Part[];
  links: Link[];
}

interface Layer { id: Id; name: string; visible: boolean; locked: boolean }

interface Part {
  id: Id; ref: number; name: string; layer: Id;
  x: number; y: number; angle: number;      // pose desenhada
  shape: Shape;
  material: MaterialId;                     // define densidade, atrito, elasticidade e aparência
  fixed: boolean;                           // corpo estático
  fast: boolean;                            // detecção contínua de colisão
  source?: { generator: string; params: Record<string, number | string> }; // peça paramétrica
}

type Shape =
  | { kind: "poly"; outer: Vec2[]; holes: Vec2[][] }    // coordenadas locais, em mm
  | { kind: "circle"; r: number; holes: Vec2[][] }
  | { kind: "gear"; module: number; teeth: number; pressureAngle: number; profile: "involute" | "ratchet"; bore: number };

// toda ligação também tem ref: number (omitido abaixo)
type Link =
  | { id: Id; kind: "screw";   a: Id | null; b: Id; at: Vec2 /* local de b */ }
  | { id: Id; kind: "axle";    a: Id | null; b: Id; at: Vec2; motor?: Motor; limit?: AngleLimit; torsion?: Torsion }
  | { id: Id; kind: "pin";     host: Id; at: Vec2; r: number; layers: [Id, Id] }
  | { id: Id; kind: "slider";  a: Id | null; b: Id; at: Vec2; dir: number; travel: [number, number]; spring?: LinearSpring }
  | { id: Id; kind: "spring";  a: Id | null; b: Id | null; atA: Vec2; atB: Vec2; k: number; damping: number; freeLength: number }
  | { id: Id; kind: "chamber"; a: Id | null; b: Id | null; at: Vec2; dir: number; bore: number; length: number; charge: number; burn: number }
  | { id: Id; kind: "sensor";  host: Id; at: Vec2; r: number; layers: [Id, Id]; minSpeed: number; triggers: Id[] };
```

Regras do formato:

- Peças e ligações têm `ref: number`, o número de chamada da prancha. É único na cena, atribuído na criação (o maior existente + 1), editável e nunca renumerado sozinho. É ele que aparece nas linhas de chamada da identidade.

- `a: null` significa "preso ao fundo" (o mundo fixo).
- Pontos de ligação são guardados no espaço local da peça de referência. Mover a peça leva a ligação junto.
- `layers: [de, até]` cobre todas as camadas entre as duas, na ordem atual do array.
- O protótipo v0 usa outro formato. A migração `v0 → v1` é escrita na Fase 1 e testada com as três cenas de `reference/prototype-v0/`.

## 3.1 Formato da cena (versão 2) — ligações 2.0

Decidido em 04/11/2026. Entra na Fase 1 · Parte C, com a migração `v1 → v2`. A v2 traz as interações que fazem o mecanismo se comportar como peça de verdade: fixação rígida e fixação relativa (as peças continuam corpos separados, cada uma com seu peso), molas que só empurram, objetos dentro de molas, furos e rasgos onde um pino corre, e gás que empurra todas as paredes que o cercam.

Unidades físicas da v2, na cena e na interface: **mm, g, s, N, N/mm, N·mm, kPa, °** (a cena guarda radianos). A gravidade padrão é a real, **9 810 mm/s²**, com câmera lenta para ver o que acontece em milissegundos.

```ts
interface Scene { version: 2; /* … como na v1 … */ }

interface Layer { id: Id; name: string; visible: boolean; locked: boolean;
  thickness: number }                        // mm, padrão 3; massa = densidade × área × espessura

// Materiais com densidade real em g/mm³ (aço 0,00785; alumínio 0,0027; latão 0,0085;
// polímero 0,0012; borracha 0,0011; madeira 0,0007), atrito e restituição.

type Link =
  // — Fixação rígida: nada se move entre as peças —
  | { kind: "screw";  a: Id | null; b: Id; at: Vec2 }
  // — Fixações relativas: cada peça segue um corpo, com o seu peso —
  | { kind: "axle";   a: Id | null; b: Id; at: Vec2;               // pivô: gira, balança com o peso
      motor?: Motor; limit?: AngleLimit; torsion?: Torsion; friction?: number /* N·mm */ }
  | { kind: "rod";    a: Id | null; b: Id | null; atA: Vec2; atB: Vec2 }        // haste/biela: distância fixa, gira nas duas pontas
  | { kind: "cable";  a: Id | null; b: Id | null; atA: Vec2; atB: Vec2; maxLength: number } // cabo: só limita o máximo; afrouxa
  | { kind: "mount";  a: Id | null; b: Id; at: Vec2;               // suporte elástico: preso, mas cede com o peso e vibra
      linearHz: number; angularHz: number; damping: number }
  | { kind: "slider"; a: Id | null; b: Id; at: Vec2; dir: number;  // trilho
      travel: [number, number]; spring?: LinearSpring; friction?: number /* N */ }
  // — Contato entre camadas —
  | { kind: "pin";    host: Id; at: Vec2; r: number; layers: [Id, Id] }
  | { kind: "slot";   pin: Id /* ligação pin */; guide: Id /* peça com o furo */; hole: number /* índice em shape.holes */;
      mode: "joint" | "contact" }                                  // pino correndo num furo ou rasgo
  // — Molas —
  | { kind: "spring"; a: Id | null; b: Id | null; atA: Vec2; atB: Vec2;
      k: number /* N/mm */; damping: number /* N·s/mm */; freeLength: number;
      mode: "fixed" | "seated" | "tension";                        // presa nas duas pontas | apoiada (só empurra) | só puxa
      solidLength?: number;                                        // espiras encostadas: vira batente rígido
      guide?: Id;                                                  // peça que passa por dentro e alinha o eixo da mola
      coil: { outerD: number; wireD: number; turns: number } }     // desenho e comprimento sólido padrão
  // — Gás —
  | { kind: "chamber"; body: Id | null; at: Vec2; dir: number;     // cilindro: corpo que contém o furo
      bore: number /* Ø mm */; length: number;
      walls: { part: Id; seal: number /* mm de curso até abrir */ }[];  // peças que fecham o gás (1 ou 2)
      vents: { at: number /* mm do fundo */; d: number /* Ø do orifício */; open: boolean }[];
      ports: { to: Id /* outra câmara */; at: number; d: number }[];
      gas: { model: "isothermal" | "adiabatic"; gamma: number; p0: number /* kPa */;
             charge?: { amount: number /* mmol */; burnMs: number } } }
  | { kind: "sensor"; host: Id; at: Vec2; r: number; layers: [Id, Id]; minSpeed: number;
      actions: { do: "ignite" | "open" | "close"; target: Id; vent?: number }[] };
// Toda ligação tem também id e ref.
```

Regras da v2:

- **Fixo × relativo.** Parafuso soma as peças num corpo só. Todas as outras ligações mantêm corpos separados: uma peça presa por eixo, haste, cabo ou suporte elástico continua sentindo a gravidade, balança, pende e transmite o próprio peso.
- **Mola apoiada** (`seated`) empurra quando comprimida e se solta quando passa do comprimento livre, como uma mola de compressão assentada num ressalto. **Comprimento sólido**: com as espiras encostadas, a mola vira batente rígido (padrão `turns × wireD`).
- **Objeto dentro da mola.** A mola nunca colide com nada: é força e desenho. Com `guide`, o eixo dela acompanha a peça-guia (uma haste que passa por dentro) e o desenho envolve a guia.
- **Furo e rasgo como guia.** `slot` liga um pino ao furo `hole` da peça-guia. `joint`: só em rasgo reto, vira restrição de ponto sobre segmento com rotação livre e batentes nas pontas (preciso, sem folga). `contact`: qualquer forma de furo (curva, em L, mancal redondo); o pino colide com as paredes do furo, com a folga real do desenho. O pino precisa ocupar a camada da peça-guia.
- **Gás que empurra tudo.** A pressão age em cada parede (`walls`) para fora e devolve a reação ao `body`. Com duas paredes móveis (um pistão à frente e um bloco atrás, sobre um trilho com mola), o bloco recua enquanto o pistão avança: o efeito de recuo do fundo (blowback) sai da física, não de animação.

Como ficou na implementação (Parte C), onde o texto acima deixava margem:

- **Schema** em `src/model/schema.ts`; a v1 continua lida por `schema-v1.ts` e migrada por `migrations/v1-to-v2.ts`. `parseScene` abre v0, v1 e v2, em objeto ou texto. Integridade nova: `slot.pin` aponta para um `pin`, `slot.hole` existe nos furos da guia, o pino ocupa a camada da guia, `joint` exige rasgo reto (reconhecido pela geometria em `src/geometry/slot.ts`, com tolerância; senão "Rasgo curvo: use o modo contato"), `chamber.walls` com 1 ou 2 peças móveis (nem fixas nem parafusadas ao fundo), `chamber.ports` para outra câmara, ações do sensor para câmaras e respiros existentes, `solidLength ≤ freeLength` (exceto só tração) e arame mais fino que meio diâmetro.
- **`p0` da câmara é a pressão inicial e a do ambiente** dela: a força é `(P − p0)·A` e os respiros soltam o gás até `p0`. Câmara nova usa 101,325 kPa. A migração da v1 usa `p0 = 0`, que reproduz a força da v1 (`F = carga / s`) com `n = carga / (R·T)`.
- **Respiro**: `open` é a válvula; o orifício só solta gás quando está dentro da câmara (descoberto pela parede, com fração linear no diâmetro). Um respiro aberto à frente do pistão é a porta que a parede descobre ao passar; um respiro fechado dentro da câmara é uma válvula que o sensor abre.
- **Paredes**: com uma, ela é a da frente e o fundo é `at`; com duas, a da frente é a de centro mais adiante no eixo. A face interna é o extremo da peça ao longo do eixo. `seal` conta o curso para fora desde a pose desenhada. A boca do cilindro (`length`) também solta o gás quando a parede da frente passa dela.
- **Portas**: a fração descoberta é medida na câmara que declara a porta.
- **Mola com guia**: o eixo é o eixo principal (maior momento de área) do contorno da peça-guia, orientado de A para B; o comprimento é a projeção nesse eixo.
- **Espessura**: camada nova com 3 mm; camada migrada com 10 mm (as massas da v1).

## 4. Física

### Camadas como filtros

Cada camada `i` tem o bit `1 << i`. Uma peça usa categoria e máscara iguais ao bit da sua camada. Um pino ou sensor que vai da camada `de` até a `até` usa a soma dos bits do intervalo. O limite prático é de 16 camadas.

### Motor

**Box2D v3** (`box2d3-wasm` 6.0.0, build compat, Box2D v3.2), decidido em 04/11/2026 pelo comparativo de `docs/decisoes/motor.md`. O app carrega só ele, sob demanda (`src/engine/box2d/load.ts`: ~222 KB gzip de JS e WASM); Planck e Rapier ficam só na página `/#bench`. Escala interna: **1 mm por unidade**.

**Calibração para gravidade real** (`CALIBRATED_TUNING`, tabela em `docs/decisoes/motor.md`): os parâmetros que o Box2D define em metros viraram mm/s (empurrão máximo de contato 3 000 mm/s, limiar de quique 1 000 mm/s, impacto 100 mm/s, velocidade máxima 40 000 mm/s); `b2SetLengthUnitsPerMeter(5)` (folga linear 0,025 mm, distância especulativa 0,1 mm); contato a 480 Hz com amortecimento 3; juntas no teto de rigidez (960 Hz, ¼ do subpasso) sem amortecimento; **16 subpassos** por passo de 1/240 s. Com isso a pilha de 200 caixas, a corrente de 40 elos, o pinhão e a bala passam com 9 810 mm/s², e a pilha custa 0,44 ms por passo no Chromium.

### Ligações no motor (v2)

| Ligação | No motor |
| --- | --- |
| Parafuso | Corpo composto (união por componentes conexos). Grupo com peça fixa ou parafuso ao fundo = corpo estático. |
| Eixo | Junta de revolução: motor e batente nativos; mola de torção nativa (frequência pela rigidez e pela massa axial 1/(iA + iB) do Box2D); atrito como motor de velocidade zero com torque máximo = atrito (sem motor). |
| Haste | Junta de distância rígida no comprimento desenhado; não desliga o contato entre as peças. |
| Cabo | Junta de distância com mola ligada e rigidez zero: só os batentes, com máximo = comprimento do cabo. |
| Suporte elástico | Junta soldada com `linearHz`, `angularHz` e a mesma razão de amortecimento. Estática: mola linear ω²·K⁻¹ no ponto e angular ω²·I. |
| Trilho | Junta prismática com batentes; mola de retorno nativa (frequência pela massa axial na pose desenhada; o Box2D v3.2 não conta a mola na força de reação, então o snapshot soma `−k·(x − repouso) − c·v`); atrito como motor de velocidade zero. |
| Pino, sensor | Forma circular extra no corpo hospedeiro, com o filtro da faixa de camadas. O sensor conta a maior velocidade relativa entre antes e depois do passo (um batente rígido pode parar a peça dentro do passo do toque). |
| Rasgo (`joint`) | Junta de roda sem mola: o centro do pino sobre a linha de centro do rasgo reto, rotação livre, batentes nas pontas descontado o raio do pino. Desliga o contato entre a guia e a peça do pino. |
| Rasgo (`contact`) | Nada além da geometria: o furo existe na peça-guia (decomposição com furos) e o pino colide com as paredes. |
| Mola | Toda mola ganha uma junta de distância com mínimo = comprimento sólido (o batente das espiras) e sem colisão desligada. Força de Hooke explícita a cada passo, com o modo (apoiada só age encostada e só empurra; só tração só age esticada e só puxa); se `ω·h > 0,5` ou `c·h/m > 0,25` (m = massa efetiva ao longo da mola na pose desenhada), vira a mola nativa da junta, com `lower/upperSpringForce` no lugar do modo. Mola com guia é sempre explícita. |
| Câmara | Estado do gás comum (`src/engine/chamber.ts`); a força entra no solver como mola de distância entre as faces (ver abaixo). |
| Arrasto (o dedo) | Corpo cinemático no dedo e junta de motor com mola linear (resolvida junto com os contatos, como nos exemplos do Box2D v3.2). Frequência `min(30, 6·√(g/100))` Hz e força máxima `(6 000·m + 4 000)·g/100` g·mm/s²: os 6 Hz e a força do protótipo, escalados com a gravidade. |

### Câmara de gás (v2)

- Gás ideal. `V = A·L`, com `A = π·(bore/2)²` e `L` a distância entre as faces internas das paredes ao longo do eixo (ou entre o fundo e a parede, com uma só), no mínimo 0,05 mm.
- Estado: gás `n` (mmol) e, no adiabático, a energia interna `U` (kPa·mm³). `P = n·R·T/V` (isotérmico, `R·T` = 2 437,4 kPa·mm³/mmol a 20 °C) ou `P = (γ − 1)·U/V` (adiabático). Entre um passo e o seguinte sem troca de gás, `U ← U·(V_antes/V)^(γ−1)`: `P·V^γ` constante exatamente.
- Queima: a carga entra linear em `burnMs`, na temperatura de referência; acende por `ignite` ou ação de sensor, uma vez só.
- Força em cada parede `F = (P − p0)·A`, para fora; a reação vai ao corpo (com duas paredes, as reações se anulam).
- Escape (respiros descobertos e abertos, paredes desvedadas, boca do cilindro): `dn/dt = −K·A_o·(P − p0)`, `K = 0,05 mmol/(s·mm²·kPa)` (fluxo estrangulado do ar a 20 °C, 0,0814·P, com coeficiente de descarga 0,62, aplicado à diferença de pressão). Com orifícios de milímetros a constante de tempo `τ = V/(K·A_o·R·T)` é de microssegundos: integração exata, `n ← n_eq + (n − n_eq)·e^(−h/τ)`. No adiabático, o gás que sai expande o que fica (`U ∝ n^γ`); o que entra traz `γ·R·T/(γ − 1)` por mol.
- Portas: a diferença de `n/V` entre as duas câmaras decai com taxa `K·A·R·T·(1/V₁ + 1/V₂)`, exata no passo; o gás leva a temperatura de quem cede.
- **Força no solver.** Como força explícita, uma vez por passo, o gás é rígido demais: um pistão de gramas sob centenas de kPa atravessaria a câmara num passo. No Box2D a força do gás entra como mola de distância entre as faces, relinearizada a cada passo: rigidez `k = γ·P·A/L` (γ = 1 no isotérmico) e comprimento livre `L + F/k`, implícita no solver. Com a câmara aberta a rigidez efetiva cai para `k·τ/(τ + h)`; quando `ω·h < 0,5` a força volta a ser explícita (e a junta tem o impulso zerado). O estado termodinâmico (P, V, n, U) é sempre o exato; o trabalho e o impulso de cada parede vêm da força que o motor de fato aplicou.
- Snapshot por câmara: pressão, volume, gás e, por parede, força, impulso, trabalho, curso e vedação. É o dado dos gráficos da Fase 5.
- Plausível e didático, não balística real. Com 240 passos por segundo, um disparo de gás dura de 2 a 10 passos: a câmera lenta (0,05×) mostra cada um.

### Passo de tempo

Passo fixo de 1/240 s, com acumulador. Câmera lenta reduz o tempo simulado por quadro, não o passo. A linha do tempo grava snapshots (poses e estado das ligações) para voltar e repetir.

### Escala de tela

No zoom 1, **5 px de tela por mm**. É a escala do protótipo (1 px do v0 = 0,2 mm), então as cenas migradas aparecem do mesmo tamanho. O zoom vai de 0,15× a 8× (0,75 a 40 px por mm). Os tamanhos dos assets do lote 01 foram calculados para essa escala.

### Escala interna

1 mm por unidade do motor (Box2D v3). Ver `docs/decisoes/motor.md`.

## 5. Renderização

- Assets são acessados por `assets` de `@/assets/registry`, gerado por `npm run assets`: id, grupo, fontes 1x/2x sob `BASE_URL`, dimensões, âncora normalizada, mm/px, repetição e variantes tingidas com suas fontes.

- Uma `<g>` por camada, na ordem da profundidade. Dentro dela, uma `<g>` por peça, com `transform` atualizado a cada quadro.
- A forma da peça vira um `path` com regra `evenodd` (furos e rasgos funcionam sem decomposição no desenho).
- Material = textura que repete (`pattern` em mm reais, via `scale` do registry) + borda e chanfro desenhados como contornos deslocados + sombra estática projetada na camada de baixo. Nada disso é recalculado durante a simulação.
- Ferragens (cabeça de parafuso, pino, rolamento, sensor) são assets posicionados no ponto da ligação, girando com a peça.
- Molas são desenhadas por segmentos (uma espira repetida ao longo do eixo), esticando e comprimindo com o comprimento real.
- Efeitos (clarão, fumaça, faíscas de impacto) ficam numa camada própria e são limitados por quantidade.
- A visão de camadas tem três estados: todas, ativa em destaque (as outras esmaecidas) e raio-x (só contornos). A vista explodida em perspectiva entra numa fase própria.

## 6. Editor

- Toda mudança é um comando com `do`/`undo`. Um arrasto gera um comando só, ao soltar.
- Ferramentas: selecionar, retângulo, círculo, polígono por pontos, traço livre, furo, rasgo, peça da biblioteca, e uma ferramenta por ligação.
- Encaixes: grade, centro de círculo, vértice, ponto médio, concêntrico, tangente, alinhado ao eixo de outra ligação. O encaixe ativo aparece como marca visível.
- Seleção: toque seleciona a peça mais alta da camada ativa; seleção múltipla por caixa (arrasto com a ferramenta de seleção num espaço vazio, no computador) e pelo botão "Selecionar mais" (no celular).
- Painel de propriedades: folha inferior no celular (recolhida por padrão), coluna à direita no computador.

## 7. Persistência

- Projetos em IndexedDB: cena, miniatura e data. Autosave a cada comando, com debounce.
- Exportar e importar em JSON. Ao importar, a cena passa pelo schema e pelas migrações; um erro mostra qual campo falhou.

## 8. Testes

- **Geometria**: casos de borda (polígono que cruza a si mesmo, furo tangente à borda, rasgo que corta a peça em duas).
- **Motor**: uma cena por comportamento em `scenes/fixtures/`, rodada no Node por N segundos com entradas roteirizadas (por exemplo, "arraste o ponto P até Q em 0,4 s"), com afirmações sobre poses, velocidades e eventos.
- **Visual**: capturas Playwright em 390×844 e 1440×900, nos dois temas quando houver, guardadas em `docs/capturas/fase-N/`.
- **Desempenho**: cena sintética de 150 peças e 100 ligações; registra quadros por segundo e tempo de passo.

## 9. Decisões

| Decisão | Quando | Estado |
| --- | --- | --- |
| Identidade visual | Fase 0 | Fechada: Prancha índigo (`docs/identidade/identidade.md`) |
| Biblioteca de booleanos de polígono | Fase 1 · item 3 | Fechada: Clipper2 (`clipper2-ts`), escala inteira de 10 000 por mm; triangulação pelo earcut (`docs/decisoes/geometria.md`) |
| Motor de física | Fase 1 · item 4 | Fechada em 04/11: Box2D v3 (`box2d3-wasm`). A rodada no celular do Will, quando a Vercel estiver ligada, só confirma; se o celular mostrar problema, volta à mesa |
| Escala interna e limite de velocidade | Fase 1 · item 4 | Fechada: 1 mm por unidade, 40 m/s (§4) |
| Formato v2 e ligações 2.0 | 04/11 | Fechada (§3.1); implementada na Fase 1 · Parte C |
| Gravidade | 04/11 | Real (9 810 mm/s²) por padrão; calibração de contato e subpassos feita na Parte C (§4) |
| Funções transcendentais | Fase 1 · Parte C | Fechada: `src/geometry/dmath.ts` (fdlibm) em todo o código de física e geometria; mesmo hash no Node e no Chromium |
