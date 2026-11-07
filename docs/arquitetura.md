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
             charge?: { amount: number /* mmol */; burnMs: number; shots?: number /* doses, padrão 1 */ } } }
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
- **Doses da carga** (Parte C2): `charge.shots` (inteiro ≥ 1, opcional, padrão 1) é quantas vezes a câmara acende; cada acendimento (sensor ou roteiro) queima uma dose inteira, nunca durante a queima da anterior. Sem o campo, a câmara acende uma vez só, como antes; nenhuma cena antiga muda. Cena de teste `gas/cargas`.

## 3.2 Formato da cena (versão 3) — peça multicamada e trava

Decidido em 05/11/2026. Entra na Fase 1 · Parte E2b, com a migração `v2 → v3` (só troca a versão: nenhuma cena v2 muda de comportamento nem de hash).

**Peça multicamada.** Em mecanismo de verdade, uma peça só costuma trabalhar em planos diferentes: a roda que é engrenagem embaixo e catraca em cima, o pinhão com a manivela, o gatilho com a barra que desce até o retém. Hoje isso se faz com duas peças aparafusadas, o que funciona na física mas atrapalha na mão (duas seleções, uma ferragem que não existe na peça real). Na v3, a peça tem a forma principal na camada dela e, opcionalmente, **perfis** em outras camadas, todos presos à mesma origem e ao mesmo ângulo:

```ts
interface Scene { version: 3; /* … como na v2 … */ }

interface Part { /* … como na v2: layer, shape, material, source … */
  profiles?: Profile[] }                     // um por camada extra; nunca na camada da principal

interface Profile { id: Id; layer: Id; shape: Shape;     // forma em coordenadas locais da peça
  material?: MaterialId;                     // sem = o da peça
  source?: { generator: string; params: Record<string, number | string> } }

type Link = /* … todas as da v2 … */
  | { kind: "lock"; a: Id | null; b: Id; at: Vec2;       // trava: prende até soltar
      breakForce?: number }                  // N; sem = só solta por toque ou sensor
  // slot ganha: profile?: Id                — perfil da guia que tem o furo (sem = a forma principal)
  // sensor ganha a ação: { do: "release"; target: Id /* trava */ }
```

Regras da v3:

- **Um corpo, várias camadas.** A peça é um corpo só no motor; cada perfil vira as suas formas convexas com o filtro da própria camada, então ele toca só o que está na camada dele. Massa e inércia somam todos os perfis (área × espessura da camada × densidade do material do perfil).
- **Perfis em camadas distintas**, uma por camada, nenhuma igual à da principal. Não precisam ser vizinhas: a ligação entre planos fica implícita, como a de um pino.
- **Geometria numa ligação.** Quando uma ligação usa a forma de uma peça (furo do rasgo, face de parede de câmara, eixo da guia de mola, hospedeiro de pino e sensor), vale o perfil na camada da ligação; sem perfil ali, a forma principal. O rasgo diz o perfil explicitamente (`slot.profile`).
- **Editar.** Mover e girar agem na peça inteira. Esticar, o lápis e o tamanho paramétrico agem no perfil da camada ativa. Mudar a peça de camada desloca todos os perfis juntos na pilha (bloqueado se algum sairia dela). Apagar uma camada apaga os perfis que estão nela; se for a da principal, o primeiro perfil restante vira a principal.
- **Trava** (`lock`): solda rígida entre `b` e `a` (ou o fundo), igual a um parafuso enquanto está presa, mas com as peças em corpos separados. Solta, a junta some e não volta até reiniciar a simulação (que sempre parte do desenhado). Solta por toque nela no Testar, pela ação `release` de um sensor, ou sozinha quando a força na junta passa de `breakForce` (trava fusível). O toque que solta é uma entrada gravada, como o arrasto, para a linha do tempo reproduzir igual.

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
| Arrasto (a mão) | Corpo cinemático no alvo e junta de motor com mola linear limitada (resolvida junto com os contatos, como nos exemplos do Box2D v3.2). Ver "Arrasto", abaixo. |
| Peça multicamada (v3) | Um corpo com as formas convexas de todos os perfis, cada uma com o filtro da sua camada e a densidade do seu material e da espessura da sua camada. |
| Trava (v3) | Junta soldada rígida (como as juntas, a 960 Hz). Soltar = destruir a junta na fronteira do passo. Trava fusível: a força de reação da junta, lida a cada passo, passando de `breakForce` solta no fim daquele passo. O estado (presa ou solta) vai no snapshot. |

### Arrasto (Parte F)

O arrasto é uma ação física da mão, não uma força ilimitada (`HAND` e `handLimits` em `src/engine/runtime.ts`; o Box2D em `box2dAdapter.ts`). Até a Parte E2a a força máxima era `(6 000·m + 4 000)·g/100` g·mm/s²: com gravidade real, ~98 vezes a do protótipo, dezenas de vezes o peso da peça (um peso de 20 g puxado com 12 N); ela vencia juntas macias (cabo, suporte elástico) e arremessava peças leves. E o corpo-alvo só recebia posição quando o dedo andava: com o dedo parado, ele seguia na última velocidade e levava a peça embora.

- **Alvo.** O dedo dá a posição; o alvo anda até ela a no máximo **600 mm/s de tempo simulado** e para quando chega. Em Lento (1/20), o dedo andando 100 mm/s na tela não vira 2 000 mm/s na simulação: a peça acompanha o dedo enquanto ele anda até 30 mm/s na tela (150 em Normal, 600 em Real) e fica para trás se ele for mais rápido.
- **Força máxima** (g·mm/s²; 1 N = 10⁶):
  `F = min( P + M, S, J )`, com
  - `P = clamp(10·m·g, 0,02 N, 5 N)`: dez vezes o peso (g de pelo menos 9 810 mm/s², para a mão funcionar igual sem gravidade), com piso para peças muito leves e teto absoluto;
  - `M = max(Σ molas da peça, mola mais forte ao alcance da peça)`, cada mola no fim do curso normal: `k·(livre − sólido)` (só tração: `k·livre`), `k·max|curso − repouso|` no trilho, `k·faixa/braço` na torção (faixa do batente, ou 90°; braço do eixo ao centro da peça, ≥ 5 mm). A soma das próprias molas puxa o ferrolho contra a mola de retorno. "Ao alcance" (`reach`) são as peças a até dois passos, por ligação ou por contato possível (camada em comum e formas a menos de 2 mm na pose desenhada), sem atravessar peças fixas: o gatilho alcança a barra e, pelo pino entre camadas, o retém, e assim vence a mola dele (o retém não é ligado ao gatilho, só encosta). A primeira versão usava a mola mais forte da cena inteira: no lançador de bancada era a do êmbolo (3,2 N), que a barra do gatilho nunca toca, e a mão forte demais afundava as esferas do carregador;
  - `S` (suporte elástico): `(4·m·g + 1,5 mm / c) / 1,6`, com `c = λmax(K)/ω²` a flexibilidade do suporte no ponto (K = M⁻¹ efetiva da junta soldada, ω pela `linearHz`): a mão leva o ponto até ~4 vezes a deflexão pelo peso mais 1,5 mm, descontada a sobrelevação de ζ ≈ 0,2;
  - `J` (juntas da peça: eixo, trilho, rasgo em junta, haste, solda rígida): `0,25 mm / c`, com `c = λmax(K)/(2π·960 Hz)²`. É o que a junta cede com a força da mão: **a junta sempre vence o dedo** porque a força nunca passa do que abre a junta mais macia da peça 0,25 mm (metade do limite do teste de abuso), e as juntas ficam a 960 Hz, 8 a 32 vezes a mola da mão.
- **Mola da mão.** Amortecimento crítico; rigidez para chegar à força máxima com a peça 4 mm atrás do alvo: `f = clamp(√(F/(4 mm·m))/2π, 30, 120)` Hz, sempre abaixo dos 960 Hz das juntas. Peça leve contra mola forte fica perto de 60–120 Hz; peça pesada sem mola, em 30 Hz.
- **Soltar.** O ponto agarrado sai com no máximo 750 mm/s (velocidade e giro escalados juntos).
- **Atravessar.** O alvo anda no máximo 2,5 mm por passo (600 mm/s); contra peças fixas vale a colisão contínua do Box2D (peça que anda mais que meia largura por passo). A peça na mão não vira "bala": a colisão contínua de bala não respeita as juntas e prendia um elo de corrente no vizinho (junta abrindo 13,9 mm no teste de abuso).

Números (a força máxima, a parcela que manda e a mola da mão):

| Cena · peça | Massa | F máx. | Quem limita | Mola da mão |
| --- | --- | --- | --- | --- |
| Cabo · peso | 20 g | 1,96 N | 10 × peso | 30 Hz |
| Parafusado × suporte elástico · barra no suporte | 8,5 g | 0,28 N | suporte (10 × peso daria 0,83 N) | 30 Hz |
| Pêndulo · barra | 14,1 g | 1,39 N | 10 × peso (junta: 32 N) | 30 Hz |
| Trava · maçaneta | 0,62 g | 0,12 N | peso + mola de torção | 35 Hz |
| Lançador de bancada · ferrolho (aço, com a luva) | 13,7 g | 3,97 N | junta do trilho (peso + molas daria 6,4 N) | 43 Hz |
| Lançador de bancada · gatilho | 2,42 g | 1,22 N | peso + mola ao alcance (a do percussor) | 57 Hz |
| Lançador de bancada · barra do gatilho | 2,03 g | 0,88 N | peso + mola ao alcance | 52 Hz |

O teste de abuso (`docs/decisoes/abuso.md`) confere tudo isso em todas as cenas.

### Câmara de gás (v2)

- Gás ideal. `V = A·L`, com `A = π·(bore/2)²` e `L` a distância entre as faces internas das paredes ao longo do eixo (ou entre o fundo e a parede, com uma só), no mínimo 0,05 mm.
- Estado: gás `n` (mmol) e, no adiabático, a energia interna `U` (kPa·mm³). `P = n·R·T/V` (isotérmico, `R·T` = 2 437,4 kPa·mm³/mmol a 20 °C) ou `P = (γ − 1)·U/V` (adiabático). Entre um passo e o seguinte sem troca de gás, `U ← U·(V_antes/V)^(γ−1)`: `P·V^γ` constante exatamente.
- Queima: a carga entra linear em `burnMs`, na temperatura de referência; acende por `ignite` ou ação de sensor, uma vez só.
- Força em cada parede `F = (P − p0)·A`, para fora; a reação vai ao corpo (com duas paredes, as reações se anulam).
- Escape (respiros descobertos e abertos, paredes desvedadas, boca do cilindro): `dn/dt = −K·A_o·(P − p0)`, `K = 0,05 mmol/(s·mm²·kPa)` (fluxo estrangulado do ar a 20 °C, 0,0814·P, com coeficiente de descarga 0,62, aplicado à diferença de pressão). Com orifícios de milímetros a constante de tempo `τ = V/(K·A_o·R·T)` é de microssegundos: integração exata, `n ← n_eq + (n − n_eq)·e^(−h/τ)`. No adiabático, o gás que sai expande o que fica (`U ∝ n^γ`); o que entra traz `γ·R·T/(γ − 1)` por mol.
- Portas: a diferença de `n/V` entre as duas câmaras decai com taxa `K·A·R·T·(1/V₁ + 1/V₂)`, exata no passo; o gás leva a temperatura de quem cede.
- **Força no solver.** Como força explícita, uma vez por passo, o gás é rígido demais: um pistão de gramas sob centenas de kPa atravessaria a câmara num passo. No Box2D a força do gás entra como mola de distância entre as faces, relinearizada a cada passo: rigidez `k = γ·P·A/L` (γ = 1 no isotérmico) e comprimento livre `L + F/k`, implícita no solver. Com a câmara aberta a rigidez efetiva cai para `k·τ/(τ + h)`; quando `ω·h < 0,5` a força volta a ser explícita (e a junta tem o impulso zerado). O estado termodinâmico (P, V, n, U) é sempre o exato; o trabalho e o impulso de cada parede vêm da força que o motor de fato aplicou.
- **Parede fora do furo** (Parte F, achado do teste de abuso): uma parede cuja face está a mais de 1,5 raio da linha do eixo saiu do cilindro (arrancada, caída); a câmara fica aberta para o ambiente e não aplica força nem rigidez. Antes, um pistão que tinha saído e caído metros abaixo voltava a "fechar" a câmara quando a projeção dele no eixo entrava no furo, e a mola do gás o puxava de volta.
- Snapshot por câmara: pressão, volume, gás e, por parede, força, impulso, trabalho, curso e vedação. É o dado dos gráficos da Fase 5.
- Plausível e didático, não balística real. Com 240 passos por segundo, um disparo de gás dura de 2 a 10 passos: o Lento (1/20) mostra cada um.

### Passo de tempo

Passo fixo de 1/240 s, com acumulador. Câmera lenta reduz o tempo simulado por quadro, não o passo. A linha do tempo grava snapshots (poses e estado das ligações) para voltar e repetir.

**Velocidades (Parte F).** A física é sempre em tempo real e em unidades reais; a interface escolhe quanto tempo simulado cabe em cada segundo de tela: **Lento** (1/20), **Normal** (¼, o padrão ao entrar em Testar e ao abrir uma cena no laboratório) e **Real** (1×). Real em peça de milímetros parece acelerado porque é: um pêndulo de 50 mm tem período de 0,45 s. A régua e o relógio continuam em tempo simulado. A primeira vez que a pessoa escolhe Real, uma frase explica isso (uma vez por aparelho, `localStorage`).

**Desenho entre passos (Parte F).** `src/sim/pacing.ts`: o `Pacer` guarda a posição de desenho em passos (fracionária) e pede ao worker sempre um passo adiante (`ceil(t) + 1`); o desenho mistura o passo anterior com o seguinte (`Recorder.blend`: posição e pressão lineares, ângulo pelo menor arco; molas, cabos, gás e chamadas saem das poses misturadas). Em Lento a cena anda em todo quadro (antes, um passo a cada ~5 quadros). Os eventos (sensor) aparecem no quadro em que o desenho chega ao passo deles. A linha do tempo e o "continuar daqui" usam passos inteiros. Custo da mistura: 0,004–0,008 ms por quadro (média) na cena de 150 peças (`docs/decisoes/perf-parte-f.json`).

### Escala de tela

No zoom 1, **5 px de tela por mm**. É a escala do protótipo (1 px do v0 = 0,2 mm), então as cenas migradas aparecem do mesmo tamanho. O zoom vai de 0,15× a 8× (0,75 a 40 px por mm). Os tamanhos dos assets do lote 01 foram calculados para essa escala.

### Escala interna

1 mm por unidade do motor (Box2D v3). Ver `docs/decisoes/motor.md`.

## 5. Renderização

Implementada na Fase 1 · Parte D (`src/render/`). A pele é a da Prancha índigo (`docs/identidade/identidade.md`); os assets vêm de `assets` (`@/assets/registry`).

- **Modelo de desenho** (`prepare.ts`): a cena vira peças com contorno (`shapeOutline`, sem decomposição convexa), camada, ordem, material, ângulo da hachura (vizinhas do mesmo material alternam 45°/135°), massa calculada e se é móvel; e ligações com o lugar onde são desenhadas (a peça que as carrega, a camada e a faixa de camadas). Montado uma vez por cena.
- **Estrutura**: uma `<g>` por camada, na ordem do array; dentro dela, uma `<g>` por peça com a forma em `path` `evenodd` (furos e rasgos sem decomposição). A cena é dividida em **folhas** `<svg>` compostas à parte (`will-change: transform`): por camada, uma com o que fica parado e outra com o que se move, mais a folha das definições (padrões e imagens, referenciados por `url(#…)`) e a das chamadas. As folhas paradas ficam em cache durante a simulação.
- **Poses fora do React** (`nodes.ts`): os componentes montam a estrutura e registram os nós; o `StageNodes` escreve `transform` (peça, parede, sombra, cópias de pino e sensor) e o desenho das ligações que mudam de forma (mola, haste, cabo, gás, fio do arrasto) direto nos nós. Nenhum elemento é recriado por quadro. Depois de cada montagem, o React pede para reaplicar o quadro atual.
- **Vista** (`view.ts`): 5 px por mm no zoom 1, zoom de 0,15× a 8×; a matriz do mundo vai para o grupo de cada folha durante o gesto; o papel `paper-stage` é o fundo do contêiner, em escala de tela, deslocado com o pan; vinheta estática à parte. O que é medido em px de tela (chanfro, parede, degrau da hachura, chamadas, ferragens pequenas) é refeito no fim do gesto.
- **Pele** (`skin.ts`, `hatch.ts`): parede (cópia deslocada no mundo, 2 px; 3 px de 3× para cima), sombra dura sobre a camada de baixo (3 px no enquadramento, acompanhando o zoom até 6 px), face na cor do palco, hachura recortada no contorno interno do chanfro, chanfro em dois tons e contorno. Chanfro e faixa do corpo fixo são offsets da forma com Clipper2 (`offsetShapes`). Hachuras de aço, alumínio, latão, polímero, borracha e o pautado em `pattern` dentro do grupo da peça, com degrau 2ᵏ do zoom; madeira pelo `hatch-wood`. Peça abaixo de 24 px na tela: tom liso, sem chanfro nem parede.
- **Estados de camada** por classe no grupo: ativa à frente; as de baixo veladas (face em `wall`, traço `ink-faint`); as de cima só em contorno; todas plenas no Simular; raio-x só com contornos (linha oculta fora da ativa). Ligações que atravessam a camada ativa ficam fortes.
- **Ligações** (`LinkArt.tsx`, `geometry.ts`): ferragens do lote 01 por `<use>` (variante `gold` na selecionada; símbolo procedural abaixo de 10 px), mola com `spring-end` nas pontas e N `spring-coil` num grupo com `scaleX` (N do comprimento livre, ajustado para a escala ficar entre 0,6 e 1,6 na pose desenhada; espiras encostadas no sólido), haste, cabo (curva com a flecha da parábola quando frouxo), trilho, suporte elástico, câmara em corte com o gás em brasa (opacidade pela pressão) e o kPa, símbolo de apoio.
- **Chamadas** (`callouts.ts`): número fora das peças, linha curva sem cruzar; no Simular, só a peça móvel selecionada, acompanhando a pose.
- **Toque** (`hit.ts`): a peça mais alta sob o dedo (camada, depois ordem), com tolerância de borda.
- **Orçamento de pintura**: com mais de 40 peças móveis, a parede delas sai no Simular (`docs/decisoes/desempenho.md`).
- **Simular** (`src/sim/session.ts`, `src/ui/sim/`): a `SimSession` (sem DOM) roda num Web Worker; o thread principal pede os passos do quadro pelo `Pacer`, espelha a gravação dos últimos 10 s e desenha a cada quadro a mistura de dois passos (§4, "Desenho entre passos"). A linha do tempo volta a um passo recriando o mundo e reexecutando as entradas gravadas.
- Efeitos (pontilhado do gás, leque do escape, faíscas) e falhas de tinta (`tex-ink-wear`) entram na Fase 2. A vista explodida em perspectiva entra numa fase própria.

## 6. Editor (tátil, decidido em 04/11/2026)

Feito para o dedo e para a caneta, paisagem primeiro no celular. A complexidade fica disponível, mas nunca no caminho: cada ação tem um jeito óbvio de começar e uma explicação a um toque.

### Tela

- **Celular em paisagem** (layout principal): prancha ocupando a tela; menu (projetos e exemplos) no canto superior esquerdo; **Montar / Testar** num botão só no canto superior direito; desfazer e refazer no canto inferior esquerdo; a pílula da camada ativa no canto inferior direito; abas discretas no meio das bordas laterais abrem os menus circulares. Retrato continua funcionando, com a mesma lógica, mais enxuto. Computador e tablet usam o mesmo modelo, com o painel lateral fixo quando houver espaço.
- **Tela cheia:** Android e iPad pelo Fullscreen API, com tentativa de travar em paisagem (Screen Orientation, só no Android). iPhone não tem tela cheia de página nem trava de orientação: o app é instalável (manifesto com `display: standalone`) e, aberto pela tela de início, roda sem as barras do navegador; uma dica explica como instalar.
- **Canhoto:** uma opção troca os lados dos menus circulares e dos cantos.

### Gestos

- Um dedo na peça: seleciona; arrastar move (com encaixe). Um dedo no fundo: move a vista. Dois dedos: zoom e move. Toque longo na peça: menu da peça.
- Toque com dois dedos: desfaz. Com três: refaz.
- **Menus circulares de borda:** arrastar um dedo a partir do fundo da prancha até a faixa lateral (15% da largura) e segurar parado 1 s abre um menu circular naquela borda; um anel que se completa mostra o segundo passando, e soltar antes disso é só mover a vista (que volta para onde estava se o menu abrir). Escolha deslizando até o item e soltando (menu de marcação) ou tocando depois de aberto. As abas no meio das bordas abrem o mesmo menu com um toque. Direita: **Inserir** (peças prontas, nova camada, e atalhos para o Martelo e o Lápis). Esquerda: **Vista e modos** (camadas em cores, raio-x, isolar camada, enquadrar, tela cheia, testar).
- **Caneta** (`pointerType: "pen"`): no Lápis, a caneta desenha e o dedo só move a vista e dá zoom (ver "Ferramentas da mão").

### Peça selecionada

- Alças grandes (alvo de 44 px) para mover, girar e esticar; encaixe magnético em grade, centros, bordas e eixos de outras peças, com a guia visível (e vibração curta no Android).
- **Botão da peça:** um botãozinho flutua acima da seleção, fora do caminho do dedo. Tocar abre o cartão rápido: camada (subir, descer, qual), tamanho, material, fixa ou solta, girar 90°, espelhar, duplicar, excluir e as ligações da peça. Ligação selecionada tem o seu cartão rápido (mola macia, média ou dura e o modo; eixo livre, com atrito ou motor; e assim por diante). Os números em mm, N e kPa ficam em "detalhes".

### Inserir e conectar

- **Gaveta de peças prontas** (pelo menu Inserir): placa, barra, disco, bloco, alavanca, esfera, engrenagem, catraca, cremalheira, placa com furo, placa com rasgo. Arrasta para a prancha; a peça entra na camada ativa e é paramétrica (`source.generator`), então mudar o tamanho regenera a forma.
- ~~Conectar por toque: tocar onde duas peças se sobrepõem abre um menu circular.~~ Substituído em 05/11 pelas ferramentas da mão (abaixo): com uma placa de base embaixo de tudo, todo ponto é sobreposição, e o toque precisa continuar sendo seleção.

### Ferramentas da mão (decidido em 05/11/2026)

Dois botões redondos flutuantes, só no Montar, na fileira de baixo junto do desfazer (o canhoto troca o lado): o **Martelo** (ligar e fixar) e o **Lápis** (forma). Cada um liga um modo que fica até tocar de novo no botão, apertar Esc ou ir para o Testar. **Ligar ou desligar um modo nunca mexe na vista** (o teste do Will em 07/11 mostrou que reenquadrar ao abrir o Martelo atrapalha). Com um modo ligado, uma faixa presa à borda de baixo, baixa e no estilo da prancha, mostra as ferramentas dele e uma frase diz o que a ferramenta ativa faz e o que o próximo toque vai fazer ("Eixo: a Alavanca 7 gira sobre a Placa de base 1"). Um dedo arrastando no fundo continua movendo a vista; dois dedos, zoom; os toques de desfazer e refazer continuam valendo.

**Martelo** — quatro grupos:

| Grupo | Ferramentas | Gesto |
| --- | --- | --- |
| Fixar | Parafuso, Eixo, Pino, Trava | Tocar no ponto. |
| Ligar | Mola, Haste, Cabo | Arrastar de um ponto a outro. |
| Guiar | Trilho | Arrastar na direção do curso, a partir da peça que corre. |
| Gás | Câmara, Sensor | Câmara: arrastar ao longo do furo, do fundo à boca. Sensor: tocar no ponto e depois no alvo. |

- **Cursor deslocado** (revisto em 07/11). Toque rápido crava sob o dedo, com encaixe. **Segurar parado 300 ms acende o cursor**: uma mira em ouro com a ferragem 64 px acima do dedo (abaixo, quando falta espaço em cima), ligada ao dedo por uma linha fina. A partir daí, **o ponto é o cursor**: o dedo o move 1:1, o encaixe e as peças realçadas são calculados no cursor, e soltar crava onde ele está. Nas ferramentas de arrastar, segurar antes de arrastar põe o começo no cursor, e o fim acompanha o cursor. As duas peças que vão ser ligadas ficam realçadas em ouro (a de cima cheia, a de baixo tracejada). Com caneta e mouse, sem deslocamento; com mouse, a prévia segue o ponteiro. Na E2b a ferragem aparecia acima, mas cravava sob o dedo: o cursor era só enfeite.
- **Quais peças.** `b` é a peça mais alta sob o ponto na camada ativa (se não houver, a mais alta abaixo); `a` é a próxima abaixo dela no mesmo ponto (mesma camada, ordem menor, ou camadas de baixo); sem nenhuma, o fundo. O cartão da ligação mostra o par e deixa trocar entre as peças daquele ponto.
- **Encaixe forte em centros.** Eixo e parafuso puxam para o centro de disco, engrenagem e furo redondo quando o ponto cai perto dele (até 30% do raio ou 24 px de tela). Os outros encaixes são os do §6 (pontos, bordas, retas das ligações, grade).
- **Pino.** O hospedeiro é `b`. A faixa vai da camada dele até a vizinha onde o ponto está livre (primeiro para baixo, depois para cima). Se o ponto cai num furo ou rasgo de uma peça de outra camada, a faixa chega até ela e o rasgo nasce junto (`joint` se o rasgo for reto, senão `contact`). O pino nunca nasce dentro de material: se nasceria, o cartão avisa.
- **Trava.** Fixa como o parafuso; no Testar, um toque nela solta (a ferragem salta para fora). Cartão: soltar por toque, por sensor ou fusível (com a força).
- **Ligar e guiar.** Ponta solta no fundo vazio = o fundo. Mola nasce presa, com o comprimento livre igual ao desenhado. Trilho: direção com encaixe de 15° e no eixo principal da peça; o curso é o comprimento arrastado. Câmara: o corpo é a peça sob o começo do arraste; as paredes, as peças móveis da mesma camada que cruzam a linha (até duas, a da frente primeiro); o diâmetro, a largura livre medida no meio da linha.
- **Mexer depois.** Ligação selecionada se arrasta pela ferragem, com o mesmo encaixe. As alças no palco ajustam o que é geometria: batentes de ângulo do eixo, curso do trilho, comprimento livre da mola, raio do sensor.
- Cada cravada é um comando ("Cravar eixo 12"), com desfazer. Animação curta de cravar (só `transform` e `opacity`) e vibração de 12 ms no Android.

**Cartão da ligação** — predefinições antes dos números: parafuso rígido ou elástico (vira suporte elástico, firme ou macio); eixo livre, com atrito (pouco, muito), com motor (sentido, velocidade, força), com mola de torção (macia, média, dura) e batentes; mola presa, apoiada ou só tração, macia, média ou dura, com guia (tocar na peça-guia); haste, cabo e mola se trocam entre si mantendo as pontas; trilho com mola de retorno e atrito por predefinição; trava por toque, por sensor ou fusível; câmara com carga fraca, média ou forte, doses, e as listas de paredes, respiros, portas (tocar para acrescentar); sensor com as ações (escolher a ação, tocar no alvo). "Detalhes" continua com todos os números.

**Peça multicamada no cartão da peça** — "Camadas desta peça": as camadas que ela ocupa (tocar ativa a camada e realça o perfil), "Estender para outra camada" (escolher a camada, ou uma nova acima ou abaixo, e a forma: cópia desta, disco, engrenagem, catraca, came, alavanca), "Tirar desta camada", "Separar em peça" (vira peça própria aparafusada à original) e "Fundir peças aparafusadas" (o inverso, quando cada uma está numa camada). A gaveta ganha peças prontas multicamada (engrenagem com catraca, pinhão com manivela) e o gerador de came (excêntrico e caracol).

**Lápis** (Parte E2c) — dois controles, e a combinação diz o que acontece:

| | Somar | Tirar |
| --- | --- | --- |
| **Contorno** (laço fechado, ou traço de borda a borda) | acrescenta a região à peça | recorta a região da peça |
| **Traço** (com largura) | pincel: barra ou alavanca à mão | borracha; reto, vira rasgo; um toque, furo redondo |

- Age na peça escolhida, no perfil da camada ativa (sem peça escolhida, na mais alta sob o começo do traço). Somar onde não há peça da camada ativa cria uma peça nova.
- Traço aberto de borda a borda divide a peça em dois lados: o menor vem marcado em brasa ("vai sair"), com "trocar lado" e confirmar. Se o corte deixar duas partes soltas, viram duas peças (com aviso) e cada ligação fica com a parte que contém o ponto dela.
- **Régua** (liga e desliga): traço quase reto vira reta, quase círculo vira círculo, cantos viram vértices. Com a régua, a borracha reta dá um rasgo reto de verdade (vale para rasgo `joint`).
- Peça paramétrica que passa pelo lápis vira forma livre (aviso curto; desfazer volta). Engrenagem e disco viram polígono.
- **Caneta:** com caneta (`pointerType: "pen"`), ela desenha e o dedo só move a vista, sem precisar de opção.
- Com o dedo, segurar 300 ms antes de traçar desenha pelo cursor deslocado (mesma regra do Martelo). O traço é simplificado e suavizado preservando os cantos, para a forma sair com cara de peça usinada, não de rabisco.

### Entender

- **Modo camadas em cores:** cada camada ganha uma cor ordenada (do fundo para o topo), número na peça e, opcionalmente, as camadas afastadas em 2,5D para ver o que está em cima e embaixo. Isolar camada mostra só ela.
- **Esconder peça** com um toque (como o "clique e esconda" dos simuladores de desmontagem): a peça some da vista para mostrar o que está atrás, sem sair da cena nem da simulação; um toque na lista de escondidas traz de volta.
- **Cartões "o que é"** para cada ligação, com uma animação curta.
- **Oficina guiada** (decidida em 07/11, substitui o tutorial sobre o objeto padrão): a pessoa escolhe o que montar (trinco de porta, catraca, gatilho com retém, par de engrenagens e outros) e é levada passo a passo. Cada receita é dado (`src/learn/`): a frase do passo, o gabarito fantasma em ouro tracejado de onde vai a peça ou a ligação, a ferramenta a usar realçada, e a conferência automática quando a cena satisfaz o passo (forma parecida, ligação do tipo certo entre as peças certas, com tolerância generosa). Passo cumprido ganha selo e o próximo entra; no fim, Testar com a frase do que observar. Sair a qualquer hora mantém o projeto. Cada receita tem uma cena de teste: os passos feitos por roteiro dão um mecanismo que passa nas afirmações dela.
- **Rastro do movimento** no Testar: as peças em movimento deixam um rastro curto, para ver a trajetória.

### Som (mínimo, decidido em 07/11)

Pouca coisa, bem feita: uma música ambiente leve em laço (gerada no Suno) e uns 25 efeitos curtos, gerados num lote só (som-01); os que dependem de peças da Mecânica 2.0 (estojo caindo, válvula, tique de escape) ficam registrados e ligam quando a peça existir. Som marca o que acontece, nunca a tecla ou a navegação: cravar, ligar, soltar a trava, o gás acendendo, os impactos da simulação (o som escolhido pelo material e pela massa, o volume e a variação pela velocidade do impacto, com limite de efeitos por instante), a lingueta caindo num dente de catraca (contato com peça de perfil `ratchet`), a vazão de gás por um respiro (chiado em laço com volume pela vazão), o estouro seco da carga forte, trocar entre Montar e Testar, o lápis cortando. Nada toca antes do primeiro gesto; a aba fora de foco cala tudo. Música e efeitos ligam e desligam no menu Vista. O motor é uma versão enxuta do motor de som do interativMind (`src/sound/`), com o pipeline `npm run audio`. O som é só saída: não entra na simulação nem no hash.

### Comandos

- Toda mudança é um comando com desfazer e refazer (patches do Immer). Um arrasto é um comando só, registrado ao soltar.

### Como ficou na implementação (Parte E2a)

Onde o texto acima deixava margem, ou o uso mostrou outra coisa:

- **Nomes dos modos:** **Montar** e **Testar** na interface (no código continuam `edit` e `simulate`). O botão único mostra o modo para onde vai: "Testar" (o bloco claro) no Montar, "Montar" em contorno no Testar.
- **Comandos** (`src/editor/commands.ts`, `history.ts`): cada comando olha a cena, dá o nome legível ("Mover Barra 3", "Excluir eixo 41") e devolve a receita; `produceWithPatches` guarda ida e volta; pilha de 200. Passos seguidos do mesmo controle (o deslizante do tamanho, o − e + da escala) dentro de 1,5 s viram um passo só. Excluir peça remove as ligações que ficariam sem referência (e limpa guia de mola, ações de sensor e portas que apontavam para elas). O nome do projeto não entra na pilha.
- **Mover só na camada ativa.** Arrastar uma peça da camada ativa (ou a já escolhida) move a peça; arrastar uma peça de outra camada move a vista, e tocar nela a escolhe e ativa a camada. Sem isso, numa cena com placa de base (a camada 1 cobrindo tudo), não havia fundo livre para mover a vista nem para o gesto do menu de borda, e a placa saía do lugar sem querer.
- **Menu de borda:** faixa de 15% da largura da prancha, 1 s parado com menos de 8 px; o anel é uma máscara cônica animada (só máscara, como pede o `AGENTS.md`). O gesto também começa sobre peça de outra camada (é o mesmo que mover a vista). O raio do arco se ajusta à altura útil; com o menu aberto, cantos e abas saem da frente. Itens como dado em `src/editor/menus.ts`; as ações em `src/ui/menuActions.ts`.
- **Toque com vários dedos** (`src/editor/gestures.ts`): cada dedo com menos de 250 ms e menos de 10 px; a vista volta para onde estava (a pinça mínima do toque é desfeita). O aviso curto deixa o toque atravessar (só o botão Desfazer dele pega o dedo), para não roubar o segundo dedo.
- **Encaixe** (`src/editor/snap.ts`, `snapScene.ts`), em ordem: ponto com ponto (origem e centros de furo com centros de peça, de furo e de ligação; vértice com vértice), borda, retas dos eixos das ligações (horizontal e vertical por cada ligação e a reta do trilho), grade da cena. Tolerância de 10 px de tela. A vibração de 10 ms só sai no Chrome Android (o Safari não tem `navigator.vibrate`).
- **Alças** (`src/editor/handles.ts`): girar em volta da origem da peça, passos de 15° a até 4° dos redondos; esticar pelos parâmetros principais (paramétricas) ou escala por eixo e uniforme (as outras; círculo e engrenagem só uniforme). Os pontos de ligação presos à peça acompanham a escala.
- **Botão da peça:** no canto de cima, ao lado da seleção (a alça de girar fica no meio de cima), dentro da tela, e embaixo quando o dedo está em cima da peça. No computador o cartão fica no painel fixo; o botão continua.
- **Cartão rápido:** folha lateral do lado oposto ao da peça (decidido ao abrir); em retrato, folha de baixo, e a vista sobe a peça para a parte livre. Detalhes da ligação: formulário gerado do schema Zod (`src/editor/linkFields.ts`), carregado sob demanda com o Zod; campos opcionais (motor, batente, mola de torção, mola de retorno, atrito, carga) ligam e desligam com valores padrão; listas (paredes, respiros, portas, ações) ficam para a E2b.
- **Gaveta** (`src/parts/`): onze geradores com faixas e padrões; miniaturas e projetos usam `src/render/thumbnail.ts` (SVG com classes, cores pelos tokens). A peça espelhada guarda `mirror` nos parâmetros (a catraca espelhada vira polígono).
- **Camadas:** ocultar esconde o grupo da camada no palco (a simulação continua com ela); travar tira as peças do toque.
- **Projetos** (`src/editor/projects.ts`, `src/ui/projectFlow.ts`): IndexedDB `interativlabs` com os depósitos `projects` e `meta` (último aberto). Abrir um exemplo cria um projeto. A pilha de desfazer da sessão fica no sessionStorage por projeto e só volta se a cena for a mesma (hash sem os metadados). Sem IndexedDB, o projeto vive na memória e um aviso diz isso.
- **Tela e instalação:** sem service worker (desde o Chrome 108 no Android, instalar pelo menu não exige mais um; o aviso automático de instalação ainda pode exigir). Manifesto com `display: standalone`, `orientation: any`, ícones 192, 512 e 512 maskable e o `apple-touch-icon` de 180 (ícone provisório gerado por `npm run icons`).
- **Enquadrar** mira a caixa das peças móveis e das ligações (com margem de 6%); sem peças móveis, tudo. Os exemplos não precisaram ser recompostos.
- **Paisagem sem coluna (Parte F).** A prancha ocupa a tela toda; cantos (menu, Montar/Testar, desfazer e refazer, pílula da camada), título, abas das bordas e a faixa do Testar flutuam sobre ela com fundo `--color-chrome-float` (o chrome a 84%). O enquadramento (`fitAround` em `src/render/view.ts`) mede os retângulos desses controles e procura a maior escala em que a caixa do mecanismo, com 8 px de folga, não encosta em nenhum deles nem passa das áreas seguras, provando alguns centros perto do meio: desconta só o espaço que os controles cobrem, não faixas inteiras. Sem medida (testes), volta às margens fixas. O lançador de bancada ocupa 94% da altura útil em 844×390 e 86% em 640×360 (entre a fileira de cima e a de baixo; `docs/capturas/fase-1/parte-f/paisagem-*.json`). A "coluna" das capturas da E2a era a borda da placa de base das engrenagens, que não chega à esquerda: fundo vazio, não um painel.
- **Chamadas:** a camada 1 é a própria folha; as peças fixas dela não contam como obstáculo (o número pode ficar sobre a placa de base e a linha pode cruzá-la). Para cada número, 24 direções; vence a de menos cruzamentos além dos inevitáveis, depois a mais curta e mais voltada para fora.

### Como ficou na implementação (Parte E2b)

O Martelo usa as mesmas regras de encaixe para criar e mover ligações. A prévia do dedo fica 64 px acima do ponto; mouse e caneta ficam no ponto. Pino e rasgo nascem num único comando. O sensor espera a escolha do alvo e da ação antes de gravar. As listas dos cartões usam a prancha para escolher paredes, guias, respiros, portas e alvos. A troca de corpo conserva posição e direção mundiais da câmara.

No cartão da peça, cada camada escolhe uma superfície para editar tamanho/material; posição e ângulo continuam únicos. Separar transfere as ligações da camada escolhida (rasgos pelo perfil explícito) e conserva a origem. Fundir transforma os pontos para a origem da peça escolhida. Primitivas com outra origem/ângulo viram polígonos, porque o formato só admite círculo/engrenagem centrados; formas já alinhadas mantêm seus parâmetros. Remover a principal promove o primeiro perfil, preservando materiais herdados e referências de rasgo. Conjuntos prontos criam a camada extra no mesmo passo de desfazer.

O exemplo Roda e lingueta usa um contrapeso no braço da manivela: sem ele, o próprio braço impedia o retorno pelo peso pendurado. A lingueta usa detecção contínua para o impacto rápido contra os dentes; é movimento de corpo, sem animação imposta à física. A trava e o eixo têm pontos separados no desenho para facilitar o toque.

Trocar uma trava controlada por sensor para parafuso/suporte retira suas ações de soltura no mesmo comando, com aviso; desfazer restaura ambos. Fundir é bloqueado com motivo quando há outra ligação interna além dos parafusos, pois ela passaria a ligar a peça a si mesma. As ligações externas mantêm seus pontos mundiais.

Predefinições finais do item 13.5:

| Controle | Predefinição | Valor |
| --- | --- | --- |
| Mola linear, torção e retorno | Macia / média / dura | 4 / 10 / 25 Hz |
| Amortecimento das molas | Todas | 10% do crítico |
| Suporte elástico | Firme / macio | 60 / 15 Hz, linear e angular; amortecimento 0,1 |
| Atrito | Pouco / muito | 5% / 30% do peso efetivo |
| Atrito no eixo | Torque | Força acima × raio do disco/engrenagem; 10 mm nas outras formas |
| Câmara didática | Fraca / média / forte | 0,1 / 0,5 / 1,2 mmol por dose |
| Fusível inicial | Força de soltura | 1,5 × peso efetivo, mínimo 0,001 N; editável |

Rigidez e amortecimento são calculados pela massa reduzida dos corpos distintos; na torção, pela inércia no ponto do eixo. O cálculo inclui perfis e uniões por parafuso, exclui a ligação que está sendo editada e ignora corpos fixos. `k = m·(2πf)²` e `c = 2·0,1·m·2πf`, convertidos para as unidades dos campos. Valores autorais fora dessas predefinições continuam disponíveis em Detalhes. Mudanças consecutivas no mesmo controle se juntam em 1,5 s. As alças gravam apenas ao soltar; batentes angulares avançam de 5° em 5°.

O uso mostrou uma diferença entre a regra geométrica da câmara e a câmara autoral do Lançador: a linha encontra Luva, Esfera e Êmbolo, com vão de 4,1 mm, enquanto o exemplo declara fundo, Êmbolo e Ferrolho, com 6 mm. O cartão permite corrigir corpo e paredes; o aceite de reconstrução exata ficou como falha esperada na E2b e foi resolvido pela regra de 07/11 na E2c (abaixo).

### Como ficou na implementação (Parte E2c)

**Vista parada.** O enquadramento não olha mais para o Martelo nem para o Lápis: a chave do enquadramento é só a cena e a medida do palco, e a altura útil é a do palco inteiro. Abrir e fechar o Martelo dez vezes em 844×390 e 640×360 deixa zoom e posição idênticos (teste `hand-e2c`). "Enquadrar", pedido com a faixa aberta, desvia dela como de qualquer controle flutuante.

**Cursor deslocado** (`src/editor/offsetCursor.ts`, sem DOM). O tempo vem do `timeStamp` do evento. Antes de acender, nada aparece sob o dedo (o toque rápido crava sem prévia, com a animação de cravar); arrastar antes de acender continua valendo: nas ferramentas de tocar, arrastar no fundo move a vista; nas de arrastar, o começo fica sob o dedo. Ao acender: vibração de 8 ms, a mira (anel em ouro de 13 px com cruz fina), a ferragem fantasma no ponto e uma linha tracejada até o dedo, tudo por `transform` e `opacity`. Na movimentação de ligação a ferragem só sai do lugar depois que o dedo anda 3 px a partir de onde a mira acendeu (segurar e soltar não move nada). O ponto antes do encaixe fica em `data-point`, o dedo em `data-finger`: medido no navegador, o ponto final fica a 64 px de tela acima do dedo com erro abaixo de 1 px.

**Faixa** (`src/ui/ToolStrip.tsx`, um componente para o Martelo e o Lápis). Presa à borda de baixo da prancha, sobre a moldura, como o carimbo de um desenho técnico: filete grosso por fora, fino por dentro, divisões finas entre grupos, rótulos em versalete da Old Standard, ouro só na ferramenta ativa. Altura: botões de 44 px mais o filete (≈ 49,5 px) e a frase de 14 px logo acima, que ocupa todo o vão entre os cantos (com reticências se não couber; o texto inteiro fica no `title`). A posição é medida: o vão entre o grupo do desfazer e a pílula da camada; se não couber nem na forma mais compacta, a faixa sobe para cima dos cantos. Três formas, escolhidas pela largura: tudo à vista com rótulos; no Martelo, os grupos viram um seletor na ponta (o nome do grupo e quatro losangos; tocar passa ao próximo) e no Lápis cada grupo vira um botão que alterna; por fim, só ícones. Com uma ferramenta aberta, a pílula da camada encolhe para 116 px e a "Fig." some. Em 640×360, 844×390 e 1440×900 a faixa e a frase não tocam o retângulo central de 60% nem os cantos (caixas medidas no teste).

**Câmara** (regra de 07/11, `src/editor/hammerDrag.ts`). Peça solta sob o começo: ela e o conjunto aparafusado dela formam o lado de trás; a parede de trás é a peça do conjunto, na camada, cuja face dianteira fica mais perto do começo (o motor lê o extremo da peça ao longo do eixo; no Lançador é o Ferrolho, não a Luva, que se estende até a boca). O corpo é a peça fixa da mesma camada sob o começo, ou o fundo. Peça fixa sob o começo: ela é o corpo, sem parede de trás. A parede da frente é a primeira peça solta que cruza a linha depois do começo, fora do conjunto de trás, e que fecha pelo menos 80% do furo na transversal; o furo é o vão no corpo, senão o vão no conjunto de trás (um tubo que corre junto, como a Luva), senão a largura da parede de trás. A largura da frente é medida em 33 estações ao longo dela (faces redondas, como uma esfera, também contam), e o diâmetro é a parte dessa largura dentro do furo quando há cilindro (o pistão encaixa nele), ou a largura inteira sem cilindro. Vão no corpo diferente do diâmetro em mais de 10%: aviso e o cartão abre. Resultado no Lançador: corpo no fundo, Êmbolo à frente e Ferrolho atrás, 4,05 mm (o Êmbolo dentro da Luva de 4,1 mm); o exemplo declara 6 mm. Com a geometria detectada e os ajustes de cartão do exemplo (carga, respiros, vedação, sensores), o ciclo passa nas 72 afirmações da cena de teste. No Cilindro de dois pistões: corpo no fundo, Pistão à frente, Fundo móvel atrás, 9,8 mm (exemplo: 10), 4 de 4 afirmações (`docs/decisoes/camara-e2c.json`). Câmara que espera "Toque na parede" guarda a parede de trás já achada.

**Lápis** (`src/geometry/stroke.ts` para o traço, `src/editor/pencil.ts` para o plano e o comando, `src/ui/PencilBar.tsx` e o gesto no palco).

- Do rastro à forma: pontos repetidos saem; Ramer–Douglas–Peucker a 0,5 px de tela; reamostragem a 1,5 px; cantos onde a virada passa de 35° medida a 8 px sobre uma cópia com σ = 2 px; cada trecho entre cantos passa por uma gaussiana de σ = 5 px ao longo do traço, com as pontas presas por espelhamento (reta continua reta); o laço volta à área do traço simplificado (a suavização não encolhe a forma); RDP fino a 0,15 px. O resultado do recorte é limpo na tolerância de corda dos arcos (0,02 mm). Números em `docs/decisoes/lapis-e2c.json`: um laço de 6 mm de raio com tremido de dedo sai com 43 vértices, erro de área de 0,24% e maior virada entre segmentos de 11,6° (o rastro tinha 169°); um quadrado tremido de 20 mm guarda os 4 cantos; em 120 laços tremidos de 4, 6 e 10 mm, 1 ganhou um canto falso (o de 4 mm, a curva mais fechada).
- Fechamento: fim a menos de 12 px do começo, ou o primeiro cruzamento consigo mesmo (o laço é o trecho entre os dois pontos do cruzamento).
- Borda a borda: a linha (esticada 0,05 mm nas pontas) abre uma fenda de 2 µm na peça; as partes de cada lado são classificadas pelo segmento mais próximo da linha. Somar por fora: a região entre o traço e o contorno é o laço do traço fechado pela corda, menos a peça, com a mesma escolha de lado.
- Traço com largura: toque é disco de Ø igual à largura; reta da régua é o estádio exato (`slotRing`), que `straightSlot` reconhece; o resto, a linha engrossada pelo Clipper com pontas e juntas redondas. Pincel que encosta numa peça da camada ativa une a ela; no vazio, peça nova. A prévia ao vivo é o próprio traço com a largura, em ouro, e uma cópia recortada pelo contorno da peça-alvo em brasa (no Tirar), por `clipPath`.
- Peça nova: aço, solta, na camada ativa, nome "Peça à mão N", origem no centro da caixa.
- Corte em partes soltas: a maior fica com o id; as outras viram "Nome (parte N)", com a pose, o material, fixa/solta e a camada da original. Cada ligação presa por ponto vai para a parte mais perto do ponto (até 0,5 mm); mais longe, sai no mesmo comando, com as que dependiam dela (rasgo do pino, ações de sensor, portas), e o aviso lista os números. Rasgos têm o furo achado de novo pelo centro e pela área (2%). Ligações sem ponto (paredes da câmara, guia da mola) ficam com a parte maior.
- O Martelo, num rasgo reto, crava o pino na linha de centro (antes nascia onde o dedo estava e o motor o encostava na linha com aviso).
- Caneta: o traço da caneta é guardado à parte do gesto dos dedos, então os dois andam juntos; depois que uma caneta toca a prancha, o dedo no Lápis só move a vista e dá zoom (na sessão).

**Física das formas novas.** A decomposição convexa trata como lasca, além das peças com menos de 0,05 mm², as mais finas que 0,055 mm na menor largura: o Box2D calibrado (`lengthUnits` 5) descarta como degenerada uma peça com pontos a menos de duas folgas lineares (0,05 mm) da reta, e a triangulação de furos densos fazia leques finos de um canto distante até dois vértices vizinhos do furo. A lasca é fundida à vizinha; se a fusão passar de 8 vértices, as duas são juntadas e divididas de novo pela diagonal que deixa as metades mais grossas; pelo fecho convexo, a lasca fina pode encher um entalhe do tamanho dela mais 0,05 mm². Nenhuma forma do Lápis nos testes (laços, somas, borracha em zigue-zague, pincel tremido, furos de toque, engrenagem e disco recortados) dá aviso de compilação; os 33 hashes das cenas de teste não mudaram.

### Como ficou na implementação (Parte E2d)

**Frases das ferramentas** (`src/editor/phrases.ts`). Gênero pela primeira palavra do nome da peça (lista das palavras do projeto e terminação), com artigo e contração: "Parafuso: a Base fica presa ao fundo", "Parafuso: a Placa 3 se une à Base", "Eixo: o Retém gira sobre o fundo", "Tirar na Placa 3". Números com vírgula. "Esc sai" só aparece quando o último ponteiro foi um mouse ou uma tecla foi apertada. Com uma faixa aberta, a pílula da camada perde espaçamento e o nome passa a até duas linhas pequenas; ainda cortado, o toque mostra o nome inteiro num aviso. Depois de ver a caneta, a faixa do Lápis ganha "Dedo desenha" (liga e desliga, salvo no aparelho em `il.fingerDraws`).

**Câmara do Lançador.** A câmara declarada passou a ser o tubo da Luva, onde o Êmbolo corre (4,1 mm), e não o diâmetro da esfera (6 mm), que corre no cano à frente. O Martelo detecta 4,05 mm. Para a saída continuar em 10,3 m/s, a dose passou de 0,5 para 0,69 mmol (força ∝ pressão × área; com a área menor a pressão sobe, e os respiros drenam mais). As 72 afirmações passam com o dado e com a geometria detectada (`docs/decisoes/camara-e2d.json`). Só o hash do Lançador de bancada mudou.

**Vista para entender** (`src/render/look.ts`). Um objeto `Look` (cores, afastamento em px, isolar, peças escondidas) vai do estado da interface ao palco e ao SVG; nada disso entra na cena, no hash, no desfazer ou no motor.

- **Camadas em cores.** Item do menu Vista; a faixa (`LayersBar`, o mesmo `ToolStrip`) tem Cores, Afastar, Isolar e Fechar. No Montar ela fica na borda de baixo; no Testar, na de cima (a de baixo é da simulação), no lugar do nome. Cada grupo de camada recebe `--layer-color: var(--layer-N)`; com `.is-colors` a face toma a cor, a hachura cai para 45% e a parede é a cor misturada com a sombra. Todas as camadas ficam plenas. Selo redondo de fio duplo com o número dentro da peça, no ponto de uma grade 11×11 mais longe das bordas (calculado uma vez por peça); sem folga, fora, junto ao canto de cima, com uma linha fina. Gira com a peça (fica no grupo dela: nenhum custo por quadro). Paleta provisória: `--layer-1…16` em `oklch(46% 0.055 h)`, matizes pela razão áurea entre 112° e 358°, a pelo menos 48° do ouro e da brasa, contraste do ink de 5,3 a 5,7 (teste `src/render/layerColors.test.ts`). A pilha e a pílula usam as mesmas cores.
- **Afastar.** Cada folha `<svg>` da camada `i` ganha `transform: translate(i·d·0,8 px, −i·d·0,6 px)` (a camada 1 fica no lugar), com transição curta; `d` é a distância do deslizante (28 px no celular deitado), escalada pela altura da prancha até 2,4× no computador. Cada folha mostra a moldura tracejada da prancha com o número no canto, para ler como chapas empilhadas. Pinos e sensores que atravessam camadas viram uma haste tracejada da folha de baixo à de cima, um `<g>` que acompanha o ponto na peça (uma escrita de `transform` por quadro). As chamadas saem; o manômetro vai para a folha da câmara. Ao ligar, a vista enquadra o conjunto afastado (a caixa do enquadramento crescida pelo deslocamento da camada de cima, desviando dos controles, do deslizante inclusive) e volta à vista anterior ao desligar. O toque age na folha da camada ativa: o ponto do palco é convertido com o deslocamento dela (prévia do Martelo, Lápis, alças e botão da peça transladados junto, por `translate`). No Testar e no esconder, o toque tenta cada folha, da de cima para a de baixo.
- **Isolar.** Só a camada ativa e as ligações cuja faixa a contém; o toque também só alcança a ativa.

**Esconder peça.** No cartão da peça, "Esconder"; no menu Vista, "Esconder peças" (faixa com a frase, "Mostrar todas" e "Pronto"), em que o toque esconde a peça mais alta sob o dedo em qualquer camada. A escondida ganha `visibility: hidden` (os nós continuam e o escritor de quadros não muda) e sai do **modelo de toque** (`touchModel`): seleção, Martelo, Lápis e o arrasto no Testar usam esse modelo, sem ela. Ligação só de escondidas some; a que liga uma escondida a uma visível volta por `visibility: visible` e ganha um anel tracejado na ponta escondida (na mola, na haste e no cabo, na ponta; nas ferragens, em volta delas). A pílula "N escondidas" fica ao lado da pílula da camada (no Testar, ao lado do Montar) e abre a lista com miniatura, número e nome. As escondidas ficam no registro do projeto no IndexedDB (`view.hidden`), salvas à parte da cena; abrir um exemplo começa sem nada escondido.

**Cartões "o que é"** (`src/editor/explain.ts`, `src/ui/ExplainArt.tsx`, `src/ui/explain.css`). Para as 12 ligações, até três frases com um exemplo genérico, e uma cena de 200×110 no traço da prancha com as ferragens do lote 01, animada em laço por `@keyframes` só de `transform` e `opacity` (a biela usa quadros-chave calculados da biela e manivela de verdade). Em `prefers-reduced-motion`, a cena fica parada na pose inicial. Abrem pelo "O que é?" do cartão da ligação e por um toque longo (500 ms) na ferramenta da faixa do Martelo.

**Rastro** (`src/ui/sim/trail.ts`). Item "Rastro" do menu Vista, só no Testar. O palco monta 13 × 6 caminhos fixos na folha de cima; a cada quadro desenhado, o rastro lê da gravação 24 amostras do último 0,5 s de simulação do centro de cada peça (passo de 5 passos de física) e escreve só o `d`. As peças: a escolhida sempre e até 12 das que andaram mais de 2 mm na janela, reescolhidas a cada 12 passos. Seis trechos por peça, de 95% a 10% de opacidade: o caminho some ao longo do tempo. Afastadas, cada rastro acompanha a folha da camada da peça.

**Menu Vista** (8 itens): Enquadrar, Camadas em cores, Raio-x, Esconder peças, Rastro (só no Testar), Tela cheia, Dicas, Canhoto. "Exemplos" saiu (fica no menu do canto).

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
| Velocidades | 04/11 (Parte F) | Fechada: Lento 1/20, Normal ¼ (padrão), Real 1×, com interpolação de desenho |
| Peça multicamada e trava (formato v3) | 05/11 | Fechada (§3.2); implementação na Fase 1 · Parte E2b |
| Ferramentas da mão: Martelo e Lápis | 05/11 | Fechada (§6); Martelo na Parte E2b, Lápis e caneta na E2c. Substitui o "conectar por toque na sobreposição" |
| Cursor deslocado, faixa na borda sem mexer na vista | 07/11 | Fechada (§6), depois do teste do Will; implementada na E2c |
| Oficina guiada (receitas) | 07/11 | Fechada (§6, Entender); substitui o tutorial sobre o objeto padrão; entra na Fase 3, depois da Mecânica 2.0 |
| Ordem das fases | 07/11 | Fecha a Fase 1 (E2c, E2d, S, E3) → Mecânica 2.0 → oficina guiada → acabamento visual (`docs/roadmap.md`) |
| Som mínimo | 07/11 | Fechada (§6, Som): uma música em laço e uns 25 efeitos; lote som-01 pelo coordenador sonoro |
| Entender: cores, afastar, esconder, "o que é", rastro | 07/11 | Implementada na E2d (§6); paleta das camadas provisória, até o coordenador visual |
