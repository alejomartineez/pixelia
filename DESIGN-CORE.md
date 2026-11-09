# Pixelia — ciclo central: Expedición, Amenazas y Épocas (contratos)

Documento de la Fase 0 del rediseño. Las Fases 1 a 7 se construyen leyendo **solo esto** (más DESIGN.md para motor y arte,
y DESIGN-RETENTION.md para Pase, eventos y social). Si algo de acá choca con el código, gana el código que ya existe y
se corrige este documento en el mismo commit.

> **Tu ciudad es la base de operaciones para explorar una región desconocida y aguantar lo que trae cada temporada.**
> Crecer deja de ser "tener más": es poder **llegar más lejos** en las expediciones y **resistir** amenazas cada vez más fuertes.

Qué reemplaza: los 4 minijuegos (Joyas Brillantes, Bloques Pixel, Estacionamiento Express, Ruta Pixel) se retiran cuando la
Expedición esté validada (Fase 1). Los materiales de minijuego pasan a ser materiales de región, el Álbum pasa a ser Hallazgos
y los potenciadores pasan a ser equipo de expedición (ver §7 Migración).

Convenciones: los ids de código van sin tildes y en minúscula (`madera`, `crecida`, `casa_exp`); los textos que ve la gente
siguen la Guía de tono de DESIGN.md. Todos los números de este documento son **iniciales**: se calibran con
`tools/sim-expedition.mjs` (Fase 1) y `tools/sim-economy.mjs` (Fase 5) contra las metas de §8, y viven en un solo archivo de
datos por módulo (`exp-data.js`, `threat-data.js`, `data.js`) para tocarlos en un solo lugar.

---

## 1. El ciclo central

```
CIUDAD ──produce──► provisiones (Huerta, Tambo…), equipo (Taller), integrantes con nivel (sus edificios)
   ▲                         │
   │                         ▼
mejoras, épocas,      EXPEDICIÓN: explorar, decidir, arriesgar (3–6 min, por turnos)
renovaciones,                │
defensas, terreno            ▼
   ▲          materiales de región, planos, hallazgos, colonos, zonas exploradas (= terreno)
   │                         │
   └─────────────────────────┘
                AMENAZA de temporada (con fecha y aviso): pone a prueba la ciudad que armaste;
                lo que no aguanta queda dañado hasta que lo reparás (monedas + materiales)
```

Lo que tiene que entenderse sin explicación: **la ciudad habilita la expedición, la expedición trae lo que la ciudad necesita
para crecer, y la amenaza mide si creciste bien.**

| Sistema | Por qué te hace querer crecer |
|---|---|
| Productores de provisiones | Más provisiones en la salida = más pasos = casillas lejanas, que son las que dan planos y hallazgos raros. |
| Casa de Expediciones | Cada nivel suma lugar en el grupo, provisiones por salida y nivel de Exploración. Los niveles 4–5 piden planos. |
| Establo, Taller, Dispensario, Huerta | Su nivel **es** el nivel del rol que entrenan (Guía, Ingeniería, Sanidad, Recolección): mejorarlos sube las probabilidades que ves en cada decisión. |
| Defensas con radio | Dónde construís importa: las amenazas golpean zonas concretas (el arroyo, el borde del monte, las casas de madera). |
| Épocas | Cambian cómo se ve la ciudad de lejos y le dan poder al ciclo (la piedra aguanta el fuego, el hierro trae pararrayos integrados). |
| Rango | Abre regiones, épocas, defensas y el tope de terreno. Lo frena el expediente (población, Encanto, monumentos, planos), no solo el nivel. |
| Terreno | Se gana explorando zonas, no comprándolo con nivel: más mapa explorado = más lugar para construir. |
| Monumentos | Se quedan, con materiales de región, y dan bonus al ciclo (§5.4). |

Por qué volver mañana: la expedición quedó a medio camino (se guarda y se retoma), la amenaza llega en 3 días, faltan
2 planos para la próxima época, la Huerta se llena en 4 horas, hay una salida corta gratis por día.

---

## 2. Expedición

Roguelite de exploración **por turnos**, con toques, sobre un diorama vóxel chico. Cada salida dura 3–6 minutos.
El mapa se genera con semilla desde la región y la zona, así que es infinito; la partida en curso se guarda en
`state.expedition.active` y se puede dejar y retomar.

### 2.1 Tipos de salida
| | Salida normal | Salida corta (gratis, 1 por día) |
|---|---|---|
| Grilla | 7 × 9 | 5 × 6 |
| Provisiones | las del depósito de la ciudad: se llevan `min(provMax, depósito)`; **mínimo 12** para poder salir | 12 fijas ("la vianda"), no salen del depósito |
| Carga | la del grupo (§2.4) | la mitad ("la mochila chica"), redondeando para arriba |
| Objetivo | a profundidad 7–8 (+1 cada 2 zonas) | a profundidad 4–5 |
| Avanza la zona | sí (si cumple el objetivo) | no |
| Lo que sobra | las provisiones que sobran **vuelven al depósito** | lo que sobra se pierde |
| Reinicio | — | a medianoche local (`todayStr()`); no se acumula |

Como lo que sobra vuelve, no hay que decidir cuántas provisiones llevar: siempre se lleva el máximo. La decisión está
adentro (hasta dónde ir), no en un formulario.

### 2.2 Grilla, niebla y movimiento
- Coordenadas `x` 0..w−1 (izquierda→derecha), `y` 0..h−1 (0 = lo más lejos). La **base** es la casilla de abajo al centro:
  `(3, 8)` en la normal, `(2, 5)` en la corta.
- **Profundidad** de una casilla = `|x − baseX| + (baseY − y)`. Anillos: **cerca** 1–3, **medio** 4–6, **lejos** 7+.
  El anillo sube el valor (botín) y el riesgo (peligros) de las casillas.
- Movimiento ortogonal (4 vecinas) a una casilla vecina. Cada paso gasta provisiones según el terreno:

  | Terreno | id | Costo | Con Guía |
  |---|---|---|---|
  | Llano | `llano` | 1 | 1 |
  | Monte | `bosque` | 1 | 1 |
  | Colina | `colina` | 2 | 1 |
  | Bañado | `pantano` | 2 | 1 |
  | Roca | `roca` | 3 | 2 |

- **Niebla**: se ve todo lo que está a distancia Manhattan ≤ **visión** de alguna casilla visitada. Visión 1; con
  Exploración en el grupo, 2. El **mirador** revela un cuadrado de radio 3 a su alrededor (7×7; 4 con Exploración nivel 3+).
  La zona del objetivo se ve desde el principio: un cuadrado de 3×3 marcado en dorado que lo contiene.
  Una casilla vista muestra terreno y qué hay; una no vista muestra solo niebla.
- **Cansancio del camino**: cada 5 pasos el grupo pierde 1 de ánimo ("el camino cansa").

### 2.3 Grupo y roles
- Tu personaje lidera (sin habilidad propia) y suma de 1 a 3 integrantes, **uno por rol** (no se repiten roles).
  Lugares totales (con quien lidera) según el nivel de la Casa de Expediciones: **2 / 2 / 3 / 3 / 4**.
- Cada rol existe si su edificio está construido; **el nivel del rol = el nivel más alto de ese edificio** (entrenar = mejorar
  el edificio; no hay un sistema aparte).

| Rol | id | Edificio | Habilidad base | Por nivel |
|---|---|---|---|---|
| Exploración | `exploracion` | Casa de Expediciones | visión 2; +25 en "pasar en silencio" (lobos) y +15 en "revisar a fondo" (ruinas) | +5 por nivel sobre 1 en sus decisiones; nivel 3+: el mirador revela radio 4 |
| Ingeniería | `ingenieria` | Taller | +25 en cruzar ríos; +30 en despejar derrumbes | +5 por nivel sobre 1 |
| Sanidad | `sanidad` | Dispensario | ánimo máximo +2; el campamento recupera +2 extra; el primer peligro fallado baja 1 menos | nivel 3+: una vez por salida, "Atender" (+2 de ánimo) |
| Recolección | `recoleccion` | Huerta | cada casilla de recurso da `+1 + floor(nivel/2)` | — |
| Guía | `guia` | Establo | −1 en terreno de costo ≥ 2; +20 en trepar y en seguir con tormenta; el regreso cuesta 1 menos (mínimo 1) | +5 por nivel sobre 1 |

- **Cansados**: si la salida fracasa (§2.7), los integrantes que fueron quedan cansados y no se pueden llevar por
  `120 − 20 × nivel del Dispensario` minutos (120 sin Dispensario, 20 con nivel 5). Nunca se pierde a nadie.
  Se ve en la ficha del grupo: "Descansando: 1 h 20 min".
- Prototipo (Fase 1): 3 roles fijos en nivel 1 (Exploración, Ingeniería, Sanidad), grupo de 3, sin ciudad, 24 provisiones
  y carga 15 (lo de una Casa nivel 3 y un Establo nivel 3). `EXP.prototype` en `exp-data.js`. Desde la Fase 2 queda como
  **salida de práctica**: solo sin Casa de Expediciones (o con `&proto=1`); sus eventos llevan `prototype: true` y lo traído
  no llega a la ciudad.
- Fase 2: el grupo se elige en el panel de Expedición (por defecto el último elegido, después por nivel); la Recolección
  la entrena **la mejor Huerta**. Cada edificio del ciclo dice en su ficha qué da el próximo nivel en la expedición
  ("Ingeniería 2: cruzar un río · 75% → 80%"), con la decisión típica de su rol (`roleChance`).

### 2.4 Provisiones, ánimo y carga
| | Valor inicial | Cambia con |
|---|---|---|
| **Provisiones** (`prov`) | salida normal: `provMax` = 18 / 21 / 24 / 27 / 30 según la Casa de Expediciones; corta: 12 | cada paso gasta el costo del terreno; algunos peligros y opciones gastan |
| **Ánimo** (`morale`) | 8 (10 con Sanidad), empieza lleno | peligros fallados −2/−3; cansancio −1 cada 5 pasos; imprevistos −1; campamento +3 (+2 con Sanidad); botiquín +3 |
| **Carga** (`cargoMax`) | `6 + 3 × nivel del Establo` (6 sin Establo, 21 con nivel 5); Carreta +4 | cada unidad de material ocupa 1; **planos, hallazgos y colonos no ocupan carga** |

Si un recurso no entra en la carga, queda en la casilla y se puede volver a buscarlo o soltar otra cosa ("Soltar 1 de madera").

### 2.5 Casillas
Contenido (`content`) de cada casilla:

| id | Qué es | Qué pasa al entrar |
|---|---|---|
| `vacio` | nada para hacer | — |
| `recurso` | madera, piedra, mineral o hierbas (`sub`) | se junta solo: cerca 2, medio 2, lejos 3 (+ Recolección, + `floor((tier−1)/2)` de la región) |
| `ruina` | restos viejos | decisión (§2.6); botín de ruina |
| `campamento` | lugar para descansar | "Descansar": +3 de ánimo (+2 con Sanidad), una vez (o "Seguir de largo" y guardarlo) |
| `aldea` | gente de la zona | una opción a elegir: **Comerciar** (2 materiales → 3 provisiones; 4 con Encanto ≥ 3★), **Sumar gente** (+1 colono; +2 con Encanto ≥ 4★), **Pedir indicaciones** (revela la casilla del objetivo o, si es de juntar, un radio 3 alrededor; +1 de ánimo; no aparece con el objetivo ya cumplido) o **Más tarde** |
| `mirador` | punto alto | revela un cuadrado de radio 3 (4 con Exploración nivel 3+) |
| `peligro` | río crecido, derrumbe, tormenta o lobos (`sub`) | decisión (§2.6) |
| `objetivo` | el lugar de la misión de la salida | "Explorar": botín de objetivo y ★ de objetivo |

**Generación** (`exp-gen.js`, determinista con semilla):
1. Terreno por casilla con los pesos de la región; las casillas de profundidad 1 son siempre `llano`.
2. Lugares garantizados: 1 `objetivo` (profundidad 7–8 en la normal, 4–5 en la corta), 1 `campamento` en el anillo medio,
   1 `mirador` en profundidad 3–6. Las casillas de profundidad 1 solo pueden ser `vacio` o `recurso`.
   **Barrera** (solo salida normal): con la chance de la región (`REGIONS[].barrier`: Bosque 75%, Sierras 60%, Bañado 90%,
   Cerro 60%, Costa 50%) una fila entera entre la base y el objetivo (fila 3–5) es un río (un derrumbe largo en Sierras y
   Cerro) con **un solo vado** libre. Casi toda salida tiene así una decisión con número o un rodeo que se paga en pasos;
   en el diorama se ve un río que cruza el mapa.
3. El resto se tira con la tabla de la región, aplicando el anillo: `peligro` ×0,6 / ×1 / ×1,4 y `ruina` ×0,5 / ×1 / ×1,5
   (cerca / medio / lejos); la diferencia la absorbe `vacio`.
4. Validez: tiene que haber un camino de la base al objetivo que cueste ≤ 9 provisiones sin contar peligros (≤ 6 en la
   corta). Si no, se re-tira el terreno (hasta 20 veces) y después se allana el camino más corto.

**Tabla de contenido por región** (%; suma 100):

| Región | vacío | recurso | ruina | campamento | aldea | mirador | peligro |
|---|---|---|---|---|---|---|---|
| Bosque del Arroyo | 38 | 24 | 8 | 2 | 3 | 3 | 22 |
| Sierras Bajas | 33 | 24 | 10 | 2 | 3 | 5 | 23 |
| Bañado de los Juncos | 33 | 24 | 10 | 2 | 4 | 2 | 25 |
| Cerro del Hierro | 30 | 26 | 10 | 2 | 2 | 4 | 26 |
| Costa de los Faros | 32 | 20 | 14 | 2 | 4 | 4 | 24 |

(Fase 1: recurso −6 y campamento −2 respecto de la propuesta, a vacío: con más, la carga se llenaba sola y el ánimo no
pesaba.)

**Imprevistos**: al pisar por primera vez una casilla del anillo medio (10%) o lejano (25%) puede pasar algo chico:
−1 provisión ("Se rompió una bolsa de la vianda", "No había vado…"), −1 de ánimo ("Una ampolla…") o las dos ("Niebla
cerrada…"). El regreso se conoce de antemano; lo de allá lejos no: es lo que hace que ir justo al límite sea un riesgo
(`EXP.mishap`, `EXP.mishaps`).

**Qué recurso y qué peligro** (% dentro de `recurso` y de `peligro`), y terreno:

| Región | madera / piedra / mineral / hierbas | río / derrumbe / tormenta / lobos | llano / monte / colina / bañado / roca |
|---|---|---|---|
| Bosque del Arroyo | 50 / 20 / 0 / 30 | 40 / 10 / 15 / 35 | 35 / 40 / 15 / 5 / 5 |
| Sierras Bajas | 15 / 50 / 35 / 0 | 10 / 45 / 30 / 15 | 30 / 15 / 30 / 5 / 20 |
| Bañado de los Juncos | 35 / 10 / 0 / 55 | 50 / 15 / 20 / 15 | 30 / 20 / 5 / 40 / 5 |
| Cerro del Hierro | 10 / 35 / 55 / 0 | 10 / 40 / 35 / 15 | 25 / 10 / 30 / 5 / 30 |
| Costa de los Faros | 25 / 25 / 25 / 25 | 25 / 15 / 45 / 15 | 45 / 15 / 20 / 10 / 10 |

Cada región tiene materiales que las otras no dan (hierbas: Bosque, Bañado, Costa; mineral: Sierras, Cerro, Costa):
eso es lo que empuja a abrir regiones nuevas.

### 2.6 Peligros y decisiones (probabilidades a la vista)
Al entrar a un peligro o una ruina se abre una decisión con 2–3 opciones. Cada opción muestra **el número** ("70%") y el
costo; nada de barras sin número. La probabilidad final es:

```
p = base + rol (si el rol está en el grupo: bono + 5 × (nivel − 1)) + equipo + hallazgos de la región
      − 3 × (zona − 1) − 2 × (tier de la región − 1)          → se recorta a [10, 95]
```

La línea de detalle dice de dónde sale ("50 base · +25 Ingeniería · +15 Cuerda · −3 zona 2"). **Retroceder** siempre
está y es gratis: la tarjeta se abre antes de dar el paso, así que no se paga nada y el peligro sigue ahí sin resolver.
Al elegir una opción se paga el paso (terreno) más el costo de la opción. Resuelto (bien o mal), el peligro desaparece y
quedás en la casilla: **fallar no frena**, lo que cuesta es ánimo y provisiones.
**Con cuidado**: después de fallar una opción arriesgada, la próxima tiene +10, a la vista en la línea de detalle ("+10 con
cuidado"); se gasta al usarla (`EXP.care`). Es la red para las rachas: con los números a la vista, tres fallos seguidos al
75–85% se sienten injustos aunque sean honestos (pasó jugando el prototipo).

| Peligro | Opción | Base | Rol | Equipo | Si sale bien | Si sale mal |
|---|---|---|---|---|---|---|
| Río crecido (`rio`) | Cruzar | 50 | Ingeniería +25 | Cuerda +15 | pasás | −2 ánimo, −1 provisión y el agua se lleva 1 material al azar |
| | Rodear | 100 | — | — | cuesta 2 provisiones (1 con Guía) | — |
| Derrumbe (`derrumbe`) | Despejar | 45 | Ingeniería +30 | Pala +15 | pasás y +1 piedra | −2 ánimo y −2 provisiones |
| | Trepar | 60 | Guía +20 | Cuerda +10 | pasás | −2 ánimo y −1 provisión |
| Tormenta (`tormenta`) | Seguir | 55 | Guía +20 | Lona +20 | pasás | −2 ánimo y −2 provisiones |
| | Esperar | 100 | — | Lona: cuesta 1 menos | cuesta 2 provisiones | — |
| Lobos (`lobos`) | Pasar en silencio | 50 | Exploración +25 | — | pasás | −3 ánimo y −2 provisiones |
| | Espantar con fuego | 85 | — | pide Farol, o 1 madera de la carga | pasás | −2 ánimo |
| Ruina (`ruina`) | Revisar a fondo | 70 | Exploración +15 | Pala +10 | botín de ruina completo | −2 ánimo, −1 provisión y botín chico |
| | Mirar por arriba | 100 | — | — | botín chico | — |

- **Botín de ruina completo**: 2 materiales de la región + hallazgo 60% + plano con chance 10% / 25% / 40% (cerca / medio / lejos).
  **Botín chico**: 1 material + hallazgo 20%.
- **Hallazgos**: estrellas según el anillo: cerca 1–2★, medio 1–3★, lejos 2–5★.
- **Hallazgos de la región**: cada set de Hallazgos completo de una región suma +5 a todas las decisiones en esa región.

### 2.7 Volver y fracasar
- **Volver** se puede en cualquier momento. El botón siempre dice cuánto cuesta: "Volver · 3 provisiones".
  Costo del regreso = `ceil(d / 3)`, con `d` = pasos del camino más corto **por casillas ya visitadas** hasta la base
  (Guía: −1, mínimo 1; en la base es 0).
- Si te alcanzan las provisiones: volvés con **toda la carga**; lo que sobra vuelve al depósito (salida normal).
- **Fracaso** (`sin_provisiones` o `sin_animo`): volver sin provisiones para el regreso, o llegar a 0 de ánimo (en ese caso
  se vuelve solo). Se conserva **la mitad de cada material** (`floor(n / 2)`), todos los planos, hallazgos y colonos,
  y los integrantes quedan cansados (§2.3). Nunca se pierde a nadie ni nada de la ciudad.
- Texto de ejemplo: "Se quedaron sin provisiones a mitad de camino. Volvieron con la mitad de la carga; nada grave".

La tensión de "sigo o vuelvo" sale de que el regreso cuesta, que los peligros comen provisiones y ánimo, y que lo valioso
está lejos.

### 2.8 Estrellas y botín
Tres estrellas independientes (no hace falta una para la otra):
1. **Objetivo**: llegaste al objetivo y elegiste "Explorar" (o, si es de juntar, volviste con lo pedido).
2. **Carga llena**: volviste con la carga completa (`EXP.cargoStar` = 1). Con "≥ 75%" salía casi sola; "llena" se
   entiende sin explicación y es la que empuja a seguir un poco más.
3. **Todos bien**: no fracasaste y volviste con ánimo ≥ 4.

Tipos de objetivo (`objective.type`), uno por salida:
- `lugar`: "Encontrá la mina vieja" / "el aserradero abandonado". Al explorar: 3 materiales + hallazgo ≥ 2★ y, si la zona
  es 3 o más, 1 plano.
- `juntar`: "Traé 5 de piedra" (N = 4 + ⌈zona / 2⌉ en la normal, 2 + ⌈zona / 2⌉ en la corta; el material es uno de los
  fuertes de la región). Se cumple al volver con N de ese material.
- `aldea`: "Llegá a la aldea perdida". Al llegar: +2 colonos y una opción de aldea gratis.
- Pesos: `lugar` 50, `juntar` 25, `aldea` 25 (`EXP.objectiveWeights`).

Premios extra al volver: 1 gema por cada salida de 3★; cofre de madera 25% en salida de 3★ (es la única fuente de cofres de
la expedición). **La expedición no da monedas**: las monedas siguen saliendo de la ciudad.

Botín esperado (meta de calibración, §8): salida normal 8–14 materiales, 0,4–0,8 planos y 0,8–1,5 hallazgos.

### 2.9 Regiones, zonas y mapa de región
| id | Región | Abre en rango | Tier | Materiales fuertes |
|---|---|---|---|---|
| `bosque` | Bosque del Arroyo | 1 Aldea | 1 | madera, hierbas |
| `sierras` | Sierras Bajas | 2 Caserío | 2 | piedra, mineral |
| `banado` | Bañado de los Juncos | 3 Pueblo | 3 | hierbas, madera |
| `cerro` | Cerro del Hierro | 5 Ciudad | 4 | mineral, piedra |
| `costa` | Costa de los Faros | 6 Gran Ciudad | 5 | todos |

- Cada región tiene **5 zonas** en fila (un camino de nodos en el mapa de región). La salida normal va siempre a la
  **próxima zona sin explorar** de la región elegida (o, si ya están las 5, a un **recorrido**: zona 5 sin progreso, con
  semilla nueva cada vez). Cumplir el objetivo con al menos ★ marca la zona como explorada y abre la siguiente.
- Semilla de una salida: `hashSeed(region, zone, intento, state.created)`; el intento sube en cada salida, así que repetir
  una zona da un mapa nuevo. La "Expedición del día" de la Fase 7b usa `hashSeed(todayStr(), region)`, igual para todos.
- **Terreno de la ciudad se gana explorando**: la expansión `n` (1..7) pide **zonas exploradas en total** ≥
  **1 / 3 / 5 / 8 / 11 / 14 / 18**, el rango que permite ese terreno (`TOWN_RANKS[].land`, igual que hoy) y monedas
  (`500 × 2,1^n`, igual que hoy). **Se saca el requisito de nivel** de `expansionInfo`. Hay 25 zonas, así que 18 se alcanza
  con margen.
- El mapa de región es un panel (no una escena 3D en la Fase 2): las 5 regiones alrededor de la ciudad, candado con el rango
  que la abre, nodos de zona con sus estrellas, botones "Salida" y "Salida corta". El panel muestra cuánto falta para la
  próxima expansión ("2 zonas más para ampliar el terreno").

### 2.10 Pantalla
- Escena `expedition`: diorama vóxel de la grilla (1 casilla = 1 tile), con `createPixelRenderer` + `addLights` + `Voxels`,
  terreno y naturaleza reusando `natureModel` y el kit de `models.js`. La niebla son casillas apagadas con nubes bajas
  (`cloudModel`); el grupo es el `avatarModel` de quien lidera más figuras chicas por rol.
- Tocar una casilla vecina = moverse (se marca el costo arriba de cada vecina alcanzable; las que no alcanzan, grises).
  En PC: clic o flechas/WASD; Esc = menú (Volver / Seguir).
- Arriba: barra con provisiones, ánimo (`8/10`) y carga (`6/15`), y debajo el objetivo y la región. Abajo: botón
  **Volver · N provisiones** siempre visible (en rojo "faltan N" si no alcanza; volver igual pide confirmación porque es
  fracaso). Sobre cada vecina, un rótulo con su costo; en rojo "sin vuelta" si ese paso deja sin provisiones para volver.
- Decisión: hoja desde abajo con las opciones, el % grande y la línea de detalle.
- Resultado: modal con estrellas, la carga, "Lo que trajeron" y, si corresponde, "La zona 2 quedó explorada" y
  "Falta 1 zona para ampliar el terreno". Sin confeti en el resultado: el festejo grande es al cumplir el objetivo, en el
  diorama, y (Fase 2) al abrir terreno o región.

### 2.11 Contrato del módulo `src/expedition/`
| Archivo | Fase | Qué es |
|---|---|---|
| `exp-data.js` | 1 | constantes y tablas: `EXP`, `TERRAIN`, `REGIONS`, `HAZARDS`, `OBJECTIVES`, `EQUIPMENT`, `ROLES` |
| `exp-gen.js` | 1 | generador puro con semilla |
| `exp-rules.js` | 1 | motor puro: **sin three.js, sin DOM, sin store ni bus** (se testea en Node) |
| `exp-scene.js` | 1 | escena `expedition` (contrato de escena de DESIGN.md) |
| `exp-ui.js` | 1 | DOM: preparar salida, barra, decisiones, resultado, mapa de región (este último en la Fase 2) |
| `expedition.js` | 2 | integración con la ciudad: lee el estado, calcula los modificadores, da los premios, emite el bus |

```js
// exp-gen.js
export function rng(seed)                                  // mulberry32: () => [0,1); el estado es un entero serializable
export function hashSeed(...parts)                          // entero de 32 bits estable
export function generateMap({ region, zone, kind, seed })   // kind: 'normal' | 'corta'
// → { w, h, base:[x,y], cells:[{ terrain, content, sub, depth }], objective:{ type, cell?, mat?, n? } }   (cells en orden y*w+x)

// exp-rules.js — muta `run` en el lugar y devuelve eventos; mismo seed + mismas elecciones = mismo resultado (repetible)
export function newRun({ region, zone, kind, seed, party, equip, prov, mods })   // → run (JSON puro)
//   party: ['exploracion', 'ingenieria'] · equip: ['cuerda'] · mods: { roleLevel:{rol:n}, cargoMax, moraleMax, regionBonus, encantoStars }
export function view(run)            // → { cells visibles, pos, prov, morale, cargo, cargoMax, returnCost, moves:[{x,y,cost}], pending }
export function move(run, x, y)      // → { ok, events:[...] }  (puede dejar run.pending con una decisión)
export function choose(run, optionId)// → { ok, outcome:'ok'|'fail', events }
export function useItem(run, id)     // botiquín, "Atender" de Sanidad, soltar carga: id = 'botiquin' | 'atender' | 'soltar:madera'
export function goHome(run)          // → { result }  (termina la salida)
export function result(run)          // → { stars:[bool,bool,bool], starCount, loot:{ mats, planos, finds:[{stars}], colonos }, reason, steps, objectiveDone }
//   reason: 'volvio' | 'sin_provisiones' | 'sin_animo'
// eventos: { type: 'step'|'reveal'|'loot'|'decision'|'morale'|'prov'|'camp'|'objective'|'end', ... } (la escena los anima en orden)
//   y además: 'outcome' {hazard, option, p, outcome, text} · 'mishap' {id, text} · 'mirador' · 'hint' (indicaciones)
//   · 'lose'/'spend'/'drop' {mats} · 'back' (retroceder) · 'skip' · 'village' {option}
// extras: returnCostFrom(run, x, y), optionChance(run, hz, opt), stepCost(run, cell), cloneRun(run) (para el simulador)
// run.pending = { kind: 'peligro'|'ruina'|'campamento'|'aldea', at: 'enter'|'here', x, y, step, options:[{ id, label, p, sure,
//   detail, prov, mats, can, why, ok, fail }] }   ('enter' = todavía no se dio el paso: Retroceder es gratis)
// result(run) suma: provLeft (vuelve al depósito en la normal), cargoN, cargoMax, morale, value, gems (1 si 3★), chest (25% si 3★)
```

```js
// expedition.js (Fase 2)
export function initExpedition()                 // completa state.expedition y escucha el bus
export function expeditionStatus()               // → { canNormal, canShort, reason, provMax, partySlots, cargoMax, equipSlots, tired:{rol:ms}, regions:[...] }
export function startExpedition({ region, kind, party, equip })  // descuenta provisiones/equipo, crea run, emite expedition:started
export function finishExpedition(run)            // acredita (store.grant), avanza zonas, emite expedition:finished; devuelve el resumen para el modal
export function zonesExplored()                  // total de zonas exploradas (lo usa economy.expansionStatus)
export function roleLevel(role)                  // nivel del rol según su edificio (0 si no está)
// además (Fase 2): expState() · activeRun() · defaultParty() · defaultEquip() · cargoMax(equip) · partySlots() · provMax()
//   equipSlots() · tiredMinutes() · regionInfo(id) · expeditionBadge() (globito del HUD) · roleChance(role, nivel)
//   cycleEffects(id, nivel) / cycleUpgradeLines(b) (ficha del edificio) · craftStatus(kind, id) / craft(kind, id) (Taller)
//   TUTORIAL_SEED (la primera salida corta del Bosque usa un mapa fijo con "el aserradero abandonado" y madera cerca)
// zonesExplored, roleLevel, cycleLevel, cycleValue y provCap viven en economy.js (sin ciclo de imports) y se reexportan.
```
- La escena acredita la salida **apenas termina** (en su `persist()`, antes de la animación del resultado), así cerrar la app
  en el medio no pierde el botín. `finishExpedition` es idempotente (`run.city.summary`). El run de la ciudad lleva
  `run.city = { recorrido, tutorial, at, summary }`.
- `expedition:finished` suma (además del contrato) `party`, `equip` y `far` (casillas lejanas pisadas: la diaria
  "Explorá una casilla lejana").

Router (`main.js`): `SCENES.expedition = () => import('./expedition/exp-scene.js')`; `ctx.router.go('expedition',
{ region, kind, resume })`. La escena **no** usa `ctx.endGame`: al terminar llama `finishExpedition(run)`, muestra el
resultado y vuelve a `city`. Música: `'calm'` hasta que la Fase 6 agregue `'expedition'`.

**Eventos de bus** (nombres estables; la Fase 7a ya los puede escuchar para métricas):
| Evento | Payload |
|---|---|
| `expedition:started` | `{ region, zone, kind, party, equip, prov }` |
| `expedition:decision` | `{ region, hazard, option, p, outcome }` |
| `expedition:finished` | `{ region, zone, kind, stars, loot, reason, steps, objectiveDone }` |
| `expedition:zone` | `{ region, zone, total }` (zona explorada; `total` = zonas exploradas en total) |
| `expedition:region` | `{ region }` (las 5 zonas) |
| `resources:changed` | `{ key, value, delta, reason }` para `prov`, `planos`, `equip`, `reserves`, `colonos` |

**Estado** (`state.expedition`, lo completa `initExpedition`; lo inicializa `deepFill` con `{}`):
```js
expedition: {
  active: null | run,                 // salida en curso (se retoma al volver a entrar)
  freeDay: 'AAAA-MM-DD' | null,       // último día que se usó la salida corta
  attempts: { [region]: n },          // para la semilla
  regions: { [region]: { zone: 1..6, stars: { [zona]: 0..3 } } },   // zone = próxima zona sin explorar (6 = completa)
  tired: { [rol]: msHasta },
  last: null | resumen,               // último resultado (para el modal si se cerró la app)
}
```
Recursos nuevos en la raíz del estado (§5): `prov`, `planos`, `equipment`, `reserves`, `colonos`.

---

## 3. Amenazas

Cada temporada trae 2–4 amenazas **con fecha y aviso**. Se ven venir en la ciudad, se preparan con defensas y reservas, y el
día que llegan se enfrentan en una escena corta por turnos sobre tu propia ciudad. Si no estás, se resuelven solas con tu
preparación. Nunca se destruye nada para siempre.

### 3.1 Calendario
- Temporadas de 28 días desde la época fija **lunes 2026-11-02** (`EPOCH` de `season-data.js`; usar `dayIndex`,
  `seasonIndexAt` y `epochDay` de `season.js`). Día 0 = lunes.
- Días de amenaza dentro de la temporada: **5, 12, 19 y 26** (todos sábados). Cuántos te tocan según tu rango:
  rango 2–3: días **12 y 26**; rango 4–5: **5, 12 y 26**; rango 6+: los **4**. El calendario es el mismo para todo el mundo
  (así se puede ayudar a un contacto, Fase 7b).
- Tipo por turno: `ORDER = ['crecida', 'incendio', 'tormenta', 'sequia', 'helada']`; el turno `i` (0..3) de la temporada `s`
  es `ORDER[(s × 4 + i) % 5]`. Si ese tipo todavía no está abierto para vos, se usa el siguiente abierto del orden.
- Id de amenaza: `` `${s}-${i}` `` (p. ej. `"3-2"`). La del tutorial es `"sim"`.
- **Aviso**: 4 días antes a las 08:00 (6 con el Observatorio terminado). En el HUD: "Crecida del arroyo · en 4 días".
  Las últimas 48 h se ve en la ciudad: cielo, nivel del arroyo, viento en los árboles, humo a lo lejos, escarcha.
- **El día**: de 08:00 a 23:59 se puede "Enfrentar" una vez. A las 00:00 se resuelve sola (en la práctica: la próxima vez que
  abrís el juego, si ya pasó).
- **Quién la recibe**: hace falta tener rango ≥ 2 en el momento del aviso. Una amenaza se fija al avisarse (tipo y fuerza no
  cambian si subís de rango en el medio).
- **Tutorial**: al llegar a Caserío llega un **simulacro** propio (crecida chica, fuerza 1, fuera del calendario), avisado
  al momento y que llega al día siguiente (≥ 16 h después).

### 3.2 Tipos
| Tipo | id | Abre en rango | Qué pone en riesgo | Cómo avanza en la escena | Defensa | Reserva | Material de reparación |
|---|---|---|---|---|---|---|---|
| Crecida del arroyo | `crecida` | 2 | edificios a ≤ 4 tiles del arroyo (borde +X del terreno) | el agua entra por el borde del arroyo y baja por las casillas más cercanas | Dique | Bolsas de arena | piedra |
| Sequía | `sequia` | 2 | productores de provisiones | avanza desde los bordes del terreno hacia las huertas | Granero | Tinajas de agua | hierbas |
| Incendio de monte | `incendio` | 3 | edificios de época Madera y la deco de árboles, con prioridad a los cercanos al monte (borde −Z) | el fuego salta a casillas vecinas con madera o árboles | Cuartel de Bomberos | Baldes | madera |
| Tormenta eléctrica | `tormenta` | 3 | los edificios más altos | no avanza: cada turno caen `ceil(fuerza / 2)` rayos sobre candidatos | Pararrayos | Lonas | mineral |
| Helada | `helada` | 4 | casas y productores | la escarcha avanza por los caminos desde el borde norte | Refugio | Leña | madera |

El Hospital ayuda contra todas (§3.3). La ciudad necesita un **arroyo** visible en el borde +X y un **monte** en el −Z: los
dibuja la Fase 3 en la decoración de afuera del terreno (`city-world.js`).

### 3.3 Preparación
- **Fuerza** `f` = tu rango al momento del aviso (1..8; el simulacro, 1).
- **En riesgo**: `enRiesgo = min(candidatos, 3 + f)` edificios, elegidos por la regla del tipo. Si hay menos candidatos que eso,
  la amenaza es más chica (no se inventan blancos).
- **Cobertura** `c` = promedio, sobre los edificios en riesgo, de su eficacia de defensa:
  - Una defensa del tipo que corresponde cubre los edificios con algún tile a distancia ≤ su radio. Eficacia de una defensa de
    nivel L: `0,6 + 0,08 × L` (0,68 a 1,0). Si lo cubren varias, vale la mejor.
  - Hospital: +0,1 a cualquier edificio dentro de su radio, contra cualquier tipo.
  - Época del edificio (§4): incendio, época ≥ Piedra +0,3; crecida, ≥ Piedra +0,1; helada, ≥ Ladrillo +0,2;
    tormenta, ≥ Hierro +0,2. Todo se recorta a 1.
- **Reservas** `r = min(1, tenidas / necesarias)`, con `necesarias = ceil(enRiesgo / 2)`.
- **Preparación** `prep = 0,6 × c + 0,4 × r`, mostrada en % en el panel de la amenaza, con la lista de edificios en riesgo
  y cuáles están cubiertos (al tocarlos, la ciudad los resalta).
- Al colocar una defensa, la ciudad dibuja su radio en el piso y marca qué edificios en riesgo cubre.

### 3.4 Escena de defensa (si estás)
Modo superpuesto de la ciudad (no es otra escena): `ctx.router.go('city', { defense: threatId })` monta la capa de
`threat-scene.js` sobre la ciudad. Turnos: `5 + ceil(f / 2)` (6 a 9). Focos iniciales: `1 + floor(f / 3)`.

Cada turno:
1. **Cuadrillas**: ponés hasta `K` cuadrillas en tiles. Cada una baja 2 niveles de amenaza en su tile y 1 en las 4 vecinas,
   y ese turno la amenaza no puede entrar a su tile. `K = 2 + floor(colonos / 5) + 1 si hay Hospital`, con tope 6.
2. **Reservas**: usar una reserva en un tile lo bloquea para el resto de la amenaza (bolsas de arena, cortafuego, etc.).
3. **Avanza la amenaza**: cada tile afectado sube 1 nivel (tope 3) y se extiende a 1 vecino según la regla del tipo.
   Tormenta: en vez de extenderse, caen los rayos.
4. **Golpes**: un edificio en riesgo con amenaza de nivel ≥ 2 sobre su lote al final del turno recibe 1 golpe; si está
   cubierto, tira su eficacia para ignorarlo. **2 golpes = dañado.**

Resultado: `salvado = 100 × (enRiesgo − dañados) / enRiesgo`. Meta de diseño: con `prep ≥ 0,7` y juego razonable, ≥ 90%.

**Fase 3 (calibrado con `tools/sim-threats.mjs`)**: con solo los focos iniciales una cuadrilla apagaba todo en el turno 1, así
que la amenaza **sigue entrando por su borde**: cada turno aparecen `2 + floor(f / 2)` tiles nuevos en nivel 2 frente a lo que
está en riesgo (una reserva puesta en el borde la frena ahí). Los focos y la entrada nunca caen sobre un lote en riesgo.
Tormenta: los rayos del turno siguiente **se ven antes** (⚡ sobre la casilla) y una cuadrilla en esa casilla los frena.
Una defensa con 0 en riesgo no se puede enfrentar (pasa sola). Resultado de la sim (bot con 25% de cuadrillas mal puestas):
preparación media 83%, jugando 98% (≥ 90% en el 92–100% de las ciudades), automática 80%, 1,4 dañados en promedio; sin
preparar, jugando 89% y automática 33%.

### 3.5 Resolución automática (si no estás)
```
salvado = clamp(round(35 + 60 × prep − (f − 1)), 30, 95)          // jugarla es la única forma de llegar a 100
dañados = round((1 − salvado / 100) × enRiesgo)                     // primero los menos cubiertos
reservas consumidas = min(tenidas, necesarias)
```
Al volver, un solo modal junta todo lo que pasó ("Mientras no estabas…"): "Pasó la tormenta: salvaste el 92%. Quedaron
2 edificios para reparar". Nada de reproches por no haber estado.

### 3.6 Daño y reparación
- Un edificio dañado (`b.damaged = ms`) **deja de producir y no se puede mejorar** hasta repararlo. Se ve: andamio chico,
  lona, humo o barro según el tipo.
- **Reparar** (desde la ficha o "Reparar todo"): monedas `max(50, round(0,15 × costo de construcción × nivel))` +
  `1 + floor(nivel / 2)` del material de reparación del tipo. Es al instante y no ocupa constructora.
- **Nunca es permanente**: a las 72 h la vecindad lo arregla sola, gratis ("Lo arreglaron entre todos").

### 3.7 Premios
| Salvado | Premio (además de las chispas) |
|---|---|
| < 50% | 2 gemas |
| 50–74% | 4 gemas, `100 × f` monedas, 2 materiales |
| 75–89% | 6 gemas, `150 × f` monedas, 4 materiales, plano 25% |
| 90–99% | 10 gemas, `200 × f` monedas, 6 materiales, plano 50%, cofre de plata |
| 100% | lo de 90–99%, plano garantizado y, la primera vez, el título "Sin un rasguño" |

Chispas del Pase: `40 + round(0,6 × salvado)`. Superar una amenaza con ≥ 90% es uno de los pocos momentos con festejo grande.
Una amenaza más chica (menos en riesgo que `3 + f`) da el premio proporcional; con nada en riesgo, solo 2 gemas (Fase 3).

### 3.8 Contrato del módulo `src/threats/`
| Archivo | Qué es |
|---|---|
| `threat-data.js` | tipos, `ORDER`, días, aperturas por rango, eficacias, premios |
| `threat-calendar.js` | puro: `schedule(seasonIndex, rank)`, `nextThreat(now, rank)`, `threatsBetween(a, b, rank)`, `phase(threat, now)` → `'lejos' \| 'aviso' \| 'señales' \| 'hoy' \| 'pasada'` |
| `threat-rules.js` | puro (sin three.js/DOM/store): `atRisk(type, city, f)`, `prepInfo(type, city, reserves, f)`, `autoResolve(prep, f, enRiesgo, rand)`, `newDefense({...})`, `placeCrew(d, x, z)`, `useReserve(d, x, z)`, `endTurn(d)`, `defenseResult(d)` |
| `threats.js` | integración: `initThreats()`, `threatStatus()`, `resolvePending()` (al cargar y en cada `tick`), `repair(uid)`, `repairAll()`, premios y bus |
| `threat-scene.js` | capa sobre la ciudad: `attach(cityApi, threatId)` → `{ detach, onTap, update }`; `createDecor` (cartel, señales, marcas de daño) y `createCoverage` (radio al colocar) |
| `threat-ui.js` | panel de la amenaza (aviso, preparación, en riesgo), resultado y "Mientras no estabas" |

`city` pasa a `threat-rules` una vista plana de la ciudad (`{ bounds, buildings:[{uid, id, x, z, w, d, era, height, cat}], roads }`),
nunca el estado vivo.

**Eventos de bus**: `threat:announced {id, type, day, at, f}` · `threat:started {id}` (escena) ·
`threat:resolved {id, type, pct, mode: 'jugada'|'auto', damaged:[uid], reward}` · `building:damaged {b, threat}` ·
`building:repaired {b, paid}` · `craft:done {kind: 'equip'|'reserve', id, n}`.

**Estado**:
```js
threats: {
  seen: { [id]: { type, f, start, end, at } },            // avisos ya dados (fijan tipo y fuerza)
  results: { [id]: { pct, mode, at, damaged:[uid] } },    // se guardan las últimas 12
  report: [id],                                           // pendientes de mostrar en "Mientras no estabas"
  active: null | defensa,                                 // defensa en curso (se puede retomar el mismo día)
  sim: null | { at, start, end, done },                   // simulacro del tutorial
  mended: [uid],                                          // arreglados por la vecindad, pendientes de contar
  titles: { [nombre]: ms },                               // "Sin un rasguño"
}
// en cada edificio: b.damaged = ms | 0 y b.damagedBy = tipo
```

---

## 4. Épocas

La ciudad cambia de época con el rango, y **cada edificio** muestra la época en la que está construido o renovado. Así la
ciudad mezcla épocas como una ciudad real, renovar es una tarea con sentido (y un sumidero), y la época importa en las
amenazas.

### 4.1 Mapeo y requisitos
| Época | id | era | Rangos | Planos para entrar | Material para renovar |
|---|---|---|---|---|---|
| Madera | `madera` | 1 | 1 Aldea, 2 Caserío | — | — |
| Piedra | `piedra` | 2 | 3 Pueblo, 4 Villa | 3 | piedra |
| Ladrillo | `ladrillo` | 3 | 5 Ciudad | 6 | piedra + madera |
| Hierro | `hierro` | 4 | 6 Gran Ciudad, 7 Metrópolis | 10 | mineral + madera |
| Vidrio y acero | `vidrio` | 5 | 8 Capital | 15 | mineral ×2 |

- **Pasar de época** = subir al primer rango de la época siguiente. El expediente de ese rango suma `req.planos`
  (`TOWN_RANKS[r].req.planos` = 3 en el 3, 6 en el 5, 10 en el 6, 15 en el 8; los planos se gastan al empezar la obra).
  Es uno de los momentos de festejo grande.
- `data.js` exporta `ERAS` (id, nombre, rangos, planos, material) y `eraOfRank(rank)`; `economy.js` exporta
  `cityEra(state)`.
- **Construir** algo nuevo lo hace en la época actual de la ciudad.
- **Renovar** un edificio a la época actual: monedas `max(100, round(0,4 × costo de construcción × era))`, materiales
  `w × d` (tiles del lote) de cada material de la tabla, obra de `2 min × era` con constructora. Conserva el nivel.
  Se ofrece en la ficha ("Renovar a Piedra") y en un aviso después del cambio de época ("12 edificios para renovar").
- Lo que la época le da al ciclo: resistencia en amenazas (§3.3); Ladrillo abre el Molino de dos piedras (nivel 4–5 del
  Molino); Hierro abre la Carreta grande (+6 en vez de +4) y los puentes en las expediciones (los ríos cuestan 1 menos al
  rodear); Vidrio y acero sube +1 la visión del mirador.
- Estado: `b.era` (1..5) en cada edificio; los que no lo tienen valen 1. Online: viaja dentro de `city.buildings`, así que
  las visitas ven las épocas sin cambios en el esquema.

### 4.2 Qué cambia a la vista
Paletas apagadas, cálidas y de pocos colores por época (valores de partida; la Fase 4 los ajusta con capturas):

| Época | Materiales y siluetas | Paleta |
|---|---|---|
| Madera | tablas horizontales con juntas oscuras, base de piedra suelta, techos de paja o tejuela, cercos de palo, chimenea de piedra; todo bajo, de 1 piso | tabla `#a8774a` / `#8a5d36`, paja `#d9b46a`, tejuela `#7a5a3a`, piedra `#9b9286`, musgo `#6f8a4f` |
| Piedra | muros de piedra en hiladas irregulares, esquinas de sillar, arcos de medio punto, techos de pizarra, torres cuadradas bajas, vigas a la vista | piedra `#a49b8c` / `#8c8375`, juntas `#6f675c`, pizarra `#5d6878`, viga `#5a4632` |
| Ladrillo | ladrillo con juntas claras, teja colonial, balcones de hierro forjado, chimeneas altas, aberturas con dintel; 2–3 pisos | ladrillo `#b5603f`, junta `#e6d8c3`, teja `#a8492f`, carpintería `#3f5e4a`, crema `#efe3cc` |
| Hierro | estructura remachada, galpones con techo de chapa en diente de sierra, tanques de agua, faroles a gas, escaleras de servicio | hierro `#5c6168`, óxido `#9a5a3a`, negro `#2f2b2a`, chapa `#8d949a`, farol `#f2c45a` |
| Vidrio y acero | torres con muro cortina (vidrio con montantes), terrazas verdes, aleros finos, antenas, paneles | acero `#c7ccd1`, vidrio `#8fc1d0` / `#6aa3b8`, blanco `#f2f0ea`, terraza `#79a35a` |

**Cada nivel cambia la estructura** (reemplaza a `upgradeDressing`, que eran solo adornos). Regla para casas, negocios y
edificios del ciclo, en cualquier época:

| Nivel | Cambio |
|---|---|
| 1 | volumen base de 1 piso con el techo de la época |
| 2 | anexo lateral o galería (el lote se llena) |
| 3 | un piso más y techo distinto (más pendiente, mansarda o terraza según la época) |
| 4 | el elemento vertical de la época: chimenea de piedra / torre / chimenea alta / tanque de agua / antena; aberturas más grandes |
| 5 | remate: mirador, cúpula, letrero iluminado o terraza verde, y vereda o cerco de la época alrededor del lote |

Prueba de aceptación: en una captura de `smoke.mjs --device iphone` con la cámara por defecto, una persona distingue el
nivel 1 del 3 y del 5, y la época, **sin leer nada**.

### 4.3 Orden del arte (tandas)
1. **Tanda 1 — el ciclo**: Municipalidad (sus 8 niveles se rehacen siguiendo las épocas: 1–2 Madera, 3–4 Piedra, 5 Ladrillo,
   6–7 Hierro, 8 Vidrio y acero; se actualizan los `look` de `TOWN_RANKS`), Casa de Expediciones, Establo, Taller,
   Dispensario, Huerta, Tambo, Molino, Conservera y las 6 defensas.
2. **Tanda 2**: casas (5) y negocios (10).
3. **Tanda 3**: deco, caminos, el exterior de Mi Casa y la base de los monumentos (los monumentos conservan su diseño).

Hasta que un edificio tenga su arte por época, usa el **respaldo**: su modelo de siempre + `upgradeDressing` + recoloreo de
la época (`eraRecolor`), para que el cambio de época se note en toda la ciudad desde el primer día.

### 4.4 Contrato de la capa de época (`models-kit.js` / `models.js`)
```js
// models-kit.js
export const ERA_STYLE = { 1: { wall, wallD, trim, roof, roofD, base, window, accent }, ... }   // paletas de §4.2
export function eraStyle(era)
export function eraWall(m, x, y, z, w, h, d, era, opts)      // muro con el patrón del material (tablas, hiladas, ladrillo, chapa, muro cortina)
export function eraRoof(m, x, y, z, w, d, era, opts)         // opts.kind: 'dos_aguas' | 'cuatro_aguas' | 'plano' | 'mansarda' | 'diente'
export function eraOpening(m, face, plane, u, y, era, kind)  // kind: 'puerta' | 'ventana' | 'vidriera'
export function eraVertical(m, x, y, z, era)                 // el elemento vertical del nivel 4
export function eraRecolor(m, era)                           // respaldo para builders sin arte por época
// upgradeDressing se borró al terminar la tanda 3

// models.js
buildTemplate(id, level, { flag, era }, themeId)
//   def.eraArt === true → BUILDERS[id](m, level, { era, flag }) y nada más
//   si no             → BUILDERS[id](m, level, opts) + eraRecolor(m, era) si era > 1
// clave de caché: id|nivel|era|flag|tema
buildingModel(id, level, { era, ... })     // era por defecto 1
thumbnail(id, level, era = 1)
```
- La capa de época elige los colores base **antes** de `compile(m, themeId)`; el tema de la ciudad re-mapea encima como hoy.
  La Fase 4 revisa que Bosque, Invierno Nevado y Luces de Noche sigan viéndose bien con las paletas nuevas.
- `data.js`: `eraArt: true` en cada edificio a medida que su tanda está hecha.

---

## 5. Recursos y edificios nuevos

### 5.1 Recursos
| Recurso | Estado | Fuentes | Sumideros |
|---|---|---|---|
| **Provisiones** | `state.prov` (depósito con tope) | Huerta, Tambo, Molino, Conservera; aldeas (comercio); premios de amenaza; diarias | salidas normales (pasos); comercio en aldeas |
| **Materiales de región**: madera, piedra, mineral, hierbas | `state.materials` (mismos ids nuevos) | expediciones (recursos, ruinas, objetivos, aldeas); amenazas; diarias; Pase | monumentos; equipo; reservas; reparaciones; renovaciones; mejoras de nivel 3+ de los edificios del ciclo y defensas; algunos edificios nuevos |
| **Planos** | `state.planos` (número) | ruinas lejanas, objetivos de zona 3+, amenazas ≥ 75%, Pase (niveles 10, 20 y 30) | cambio de época (3 / 6 / 10 / 15); Casa de Expediciones niveles 4 y 5 (2 y 4); primera construcción de Bomberos, Pararrayos y Hospital (1 c/u) |
| **Equipo** | `state.equipment` `{ id: n }` | Taller (fabricar); Pase; pocos en cofres | 1 uso por salida |
| **Reservas** | `state.reserves` `{ id: n }`, tope 10 por tipo | Taller (desde el rango Caserío, cuando se abren las amenazas) | amenazas (se usan en la escena o se consumen en la automática) |
| **Hallazgos** | `state.album` (el de siempre) | ruinas, objetivos, aldeas (raro), pocos cofres | repetidos → recortes; intercambios |
| **Colonos** | `state.colonos` (número) | aldeas, objetivos de aldea | ninguno: cada colono suma 1 de población y cada 5 suman una cuadrilla |
| **Monedas** | `state.coins` | la ciudad (negocios y casas), amenazas, diarias | construir, mejorar, renovar, reparar, equipo, reservas, expansiones |
| **Gemas** | `state.gems` | rango, nivel, amenazas, salidas de 3★, logros, diarias, Rueda | acelerar, constructoras |

- **Depósito de provisiones**: tope `40 + 20 × nivel de la Casa de Expediciones` (60 a 140) `+ 40 × nivel` de cada Granero.
  Arranque: 30 provisiones.
- **store**: `canAfford/spend/grant` entienden `prov`, `planos`, `equip: {id: n}`, `reserves: {id: n}` y `colonos` (solo en
  premios), además de `mats` con los ids nuevos. Emiten `resources:changed {key, value, delta, reason}` (y
  `materials:changed` como hoy para `mats`). `costHtml` los dibuja. `population()` suma `state.colonos`.
- **Producción**: un productor de provisiones tiene `prod: { prov: n, cycle, cap }`; `producerStatus`/`collect` lo tratan
  como a las monedas y lo cobrado va al depósito (lo que no entra queda en el edificio). Emite
  `production:collected {b, amount, currency: 'prov'}`.

**Equipo** (Taller; se elige al preparar la salida; lugares por salida según el Taller: 1 / 1 / 2 / 2 / 3, 0 sin Taller):
| id | Nombre | Efecto | Costo |
|---|---|---|---|
| `cuerda` | Cuerda | +15 cruzar ríos, +10 trepar | 3 madera + 60 monedas |
| `pala` | Pala | +15 despejar, +10 revisar ruinas | 2 mineral + 1 madera + 100 monedas |
| `lona` | Lona | +20 seguir con tormenta; esperar cuesta 1 menos | 1 hierbas + 2 madera + 80 monedas |
| `farol` | Farol | permite "Espantar con fuego" sin gastar madera | 1 mineral + 1 madera + 80 monedas |
| `botiquin` | Botiquín | una vez: +3 de ánimo | 3 hierbas + 60 monedas |
| `carreta` | Carreta | +4 de carga (+6 desde la época de Hierro); pide Establo nivel 2 | 6 madera + 2 mineral + 250 monedas |

**Reservas** (Taller, desde el rango Caserío): bolsas de arena `arena` (2 piedra + 40), tinajas `tinajas` (1 piedra + 1 hierbas + 40),
baldes `baldes` (1 mineral + 1 madera + 40), lonas `lonas` (1 hierbas + 1 madera + 40), leña `lena` (2 madera + 20).
Fabricar es al instante (sin cola) en esta versión.

### 5.2 Edificios nuevos
`cat` nueva `'ciclo'` para los del ciclo y `'defensa'` para las defensas (pestañas propias en Construir).

| id | Nombre | Tamaño | Rango | Máx. | Efecto por nivel (1 → 5) |
|---|---|---|---|---|---|
| `casa_exp` | Casa de Expediciones | 3×3 | 1 | 1 | lugares 2/2/3/3/4 · `provMax` 18/21/24/27/30 · Exploración = nivel · depósito +20 por nivel · niveles 4 y 5 piden 2 y 4 planos |
| `taller` | Taller | 2×2 | 1 | 1 | Ingeniería = nivel · equipo por salida 1/1/2/2/3 · reservas desde el rango Caserío |
| `establo` | Establo | 3×3 | 1 | 1 | Guía = nivel · carga +3 por nivel · Carreta desde nivel 2 |
| `dispensario` | Dispensario | 2×2 | 2 | 1 | Sanidad = nivel · cansancio 100/80/60/40/20 min |
| `huerta` | Huerta | 2×2 | 1 | 6 | 2/3/4/5/6 provisiones cada 45 min, guarda 6 tandas · Recolección = nivel de la mejor |
| `tambo` | Tambo | 3×3 | 2 | 3 | 5/7/9/11/13 cada 60 min, guarda 4 |
| `molino` | Molino | 2×2 | 3 | 3 | 8/11/14/17/20 cada 90 min, guarda 3 |
| `conservera` | Conservera | 3×3 | 5 | 2 | 15/19/23/27/31 cada 120 min, guarda 2 |
| `dique` | Dique | 3×1 | 2 | 4 | crecida, radio 4/4/5/5/6 |
| `granero` | Granero | 2×2 | 2 | 2 | sequía, radio 4/4/5/5/6 · depósito +40 por nivel |
| `bomberos` | Cuartel de Bomberos | 2×2 | 3 | 2 | incendio, radio 5/5/6/6/7 |
| `pararrayos` | Pararrayos | 1×1 | 3 | 6 | tormenta, radio 3/3/4/4/5 |
| `refugio` | Refugio | 2×2 | 4 | 2 | helada, radio 4/4/5/5/6 |
| `hospital` | Hospital | 3×3 | 5 | 1 | todas: +0,1 de eficacia en radio 5/5/6/6/7 · +1 cuadrilla |

Costos de partida (monedas; desde el nivel 3, las mejoras de estos edificios piden también materiales de región):
Huerta 120, Casa de Expediciones 200, Taller 300 + 3 madera, Establo 600 + 4 madera, Dispensario 900 + 3 hierbas,
Tambo 900, Dique 700 + 6 madera (estacas), Granero 800 + 3 madera, Molino 2400 + 4 piedra, Bomberos 2500 + 4 madera + 1 plano,
Pararrayos 600 + 2 mineral + 1 plano (solo el primero), Refugio 3500 + 6 madera, Conservera 9000 + 6 mineral,
Hospital 12000 + 6 mineral + 4 hierbas + 1 plano. La eficacia de defensa por nivel es la de §3.3.

### 5.3 Edificios que se reconvierten (Fase 5)
| Hoy | Pasa a ser | Por qué encaja |
|---|---|---|
| `joyeria` Joyería (2×2) | `taller` | mismo tamaño |
| `torre_bloques` Torre de Bloques (2×2) | `dispensario` | mismo tamaño |
| `garaje` Garaje (3×3) | `establo` | mismo tamaño |
| `pista` Pista Arcoíris (3×3) | `casa_exp` | mismo tamaño |

Mismo `uid`, lugar, rotación y nivel. `boutique_real` (vestidor) se queda.

### 5.4 Monumentos
Se quedan, con los materiales renombrados (§7) y bonus nuevos atados al ciclo:
Faro: +1 de visión en todas las expediciones · Jardín Botánico: +25% de felicidad (igual) · Observatorio: avisos de amenaza
2 días antes · Estadio: +25% de chispas del Pase en expediciones · Museo: +50% de chance de hallazgo en ruinas ·
Torre del Reloj: obras 10% más rápidas (igual).

**Resultado de la Fase 5b**: `bonus.type` nuevos en `MONUMENTS` (`data.js`): Faro `vision` (+1, lo suma `cityMods` de
`expedition.js` a `run.mods.vision`; deja de dar +10% de monedas de negocios), Observatorio `threatWarn` (el calendario
avisa con `WARN_DAYS_OBSERVATORY` = 6 días en vez de 4; deja de dar XP de expedición). Jardín, Estadio, Museo y Torre del
Reloj quedan como estaban (ya atados al ciclo). Así ningún monumento suma monedas: el término "monumentos" del
multiplicador de producción de §8 queda en 0.

---

## 6. Tutorial y apertura escalonada

### 6.1 Cadena de misiones nueva (reemplaza `MAIN_QUESTS`; ids `t1`…)
Primeros ~30 minutos, después del onboarding (personaje, nombre, ciudad, estilo; sin cambios):

| id | Título | Pide | Enseña |
|---|---|---|---|
| t1 | Primera casa | Construí una Casa | construir |
| t2 | Algo para comer | Construí una Huerta | provisiones |
| t3 | Primera cosecha | Juntá 4 provisiones (cobrá la Huerta) | cobrar |
| t4 | Base de operaciones | Construí la Casa de Expediciones | el edificio central |
| t5 | Primera salida | Hacé la salida corta al Bosque del Arroyo | moverse, niebla, volver (mapa fijo y guiado, objetivo "el aserradero viejo") |
| t6 | Con lo que trajiste | Construí el Taller (pide 3 de madera) | el botín sirve en la ciudad |
| t7 | Bien equipados | Fabricá una Cuerda | equipo |
| t8 | Más gente | Llegá a 15 de población | casas |
| t9 | Pan del día | Construí la Panadería | monedas |
| t10 | Salida en serio | Hacé una salida normal con la Cuerda | provisiones del depósito, decisiones con % |
| t11 | Zona explorada | Cumplí el objetivo de la zona 1 del Bosque | zonas |
| t12 | Más terreno | Ampliá la ciudad | el terreno se gana explorando |
| t13 | Animales de carga | Construí el Establo | carga y Guía |
| t14 | De Aldea a Caserío | Subí al rango Caserío | expediente |
| t15 | Se viene el agua | Construí un Dique (llega el aviso del simulacro) | amenazas y radio |
| t16 | Bolsas de arena | Fabricá 2 bolsas de arena | reservas |
| t17 | Primera prueba | Pasá el simulacro (jugado o automático) | resultado y reparación |
| t18 | Tres estrellas | Hacé una salida de 3★ | estrellas |
| t19 | Hacia las sierras | Explorá una zona de las Sierras Bajas | regiones |
| t20 | Época de Piedra | Subí al rango Pueblo (pide 3 planos) | épocas |

t1–t12 entran en ~30 minutos. **Fase 2**: la cadena se sigue por id (`state.quests.done`), así t15–t17 (Fase 3) se insertan
entre t14 y t18 sin correr nada; quien ya pasó t14 las recibe como misión actual. La cadena vieja de minijuegos se migra
sin repetir lo cobrado (m1→t1, m2→t9, m7→t8, m13→t12, m14→t14, m16–m28 iguales) y quien ya había avanzado saltea sin
premio las primeras que ya cumple (`migrateQuestChain` en `quests.js`, idempotente). Ayudas: t3 sale enseguida porque la
primera Huerta arranca con 2 tandas listas; t5 da 3 de madera y t6 otras 3 (Taller y Cuerda alcanzan aunque la salida
corta vuelva con poco). Las diarias llevan `needs` (el edificio que tiene que existir). Después siguen las misiones largas de siempre reescritas (monumentos, renovar, Villa,
Ciudad…, hasta Capital). Tipos de objetivo nuevos para `quests.js`: `expedition {kind?, region?}`, `zone {region?}`,
`expStars` (suma), `prov` (provisiones juntadas, suma), `craft {id?}`, `threat` (amenazas pasadas), `renovate`,
`era` (absoluto: época de la ciudad).

Diarias nuevas (`DAILY_POOL`): "Hacé 2 salidas", "Juntá 20 provisiones", "Conseguí 4 estrellas en expediciones",
"Fabricá 2 cosas en el Taller", "Construí 3 cosas", "Mejorá un edificio", "Explorá una casilla lejana", y "Repará un
edificio" solo si hay alguno dañado. **Fase 5b**: `d_repair` usa `needs: 'damaged'` (`quests.js dailyNeedsOk`) y, si hay
algún edificio dañado al sortear el día, sale siempre (objetivo `repair`: `building:repaired` pagado; lo que arregla la
vecindad no cuenta).

### 6.2 Apertura escalonada
Una función nueva por vez, como mucho **una por sesión al arrancar** ("Hoy se abre: el Pase de Temporada"), y el modal de
llegada adelanta la próxima ("Mañana se abre: Contactos").

| Función | Se abre |
|---|---|
| Construir, misiones | desde el principio |
| Expedición (botón del HUD) | t4 |
| Taller | t6 |
| Diarias | al terminar t9 |
| Mapa de región | t11 |
| Pase de Temporada | día 2 de juego o rango Caserío, lo primero |
| Amenazas | rango Caserío |
| Contactos (social) | nivel 4 o día 2, lo último |
| Eventos | día 3 |
| Obras (monumentos) | rango Pueblo (igual que hoy) |
| Hallazgos | al encontrar el primero |
| Cofres | al ganar el primero |
| Mi Casa | nivel 2 (igual que hoy) |

**Resultado de la Fase 5b** (`src/core/unlocks.js`, `state.unlocks.open {id: ms}`):
- Dos clases. Las **de juego** (Expedición, Diarias, Amenazas, Obras, Hallazgos, Cofres) se abren apenas se cumple la
  condición. Las **de día** (Pase: día 2 o rango Caserío; Contactos: día 2 y nivel 4; Eventos: día 3) se abren de a una por
  sesión al arrancar, en el modal de llegada ("Hoy se abre: el Pase de Temporada"), que también adelanta la próxima
  ("Mañana se abre: Contactos"). "Día de juego" = días de calendario desde `state.created` (día 1 = el de la partida).
- Quien ya jugaba (nivel ≥ 3, rango ≥ 2, partida de hace 3 días o más, o migrada v3) arranca con todo lo que ya cumple abierto
  y sin aviso. `?cheat` abre las de día (`_openAll`); las de juego siguen su condición.
- Taller y Mapa de región no tienen botón propio en el HUD: se abren con su edificio y con la zona, como ya pasaba.
- **Modal único de llegada** (`src/scenes/arrival.js`): junta regalo de bienvenida, "Los minijuegos se retiraron" (v3),
  las amenazas resueltas solas (`threat-ui.reportParts`), el premio del día con la racha (los 7 días en una tira) y la
  apertura del día. Título "Mientras no estabas…" ("Tu primer día" el día 1 si no hay nada más que contar). Lo de cobrar se
  acredita al tocar "Cobrar". El panel `login` sigue existiendo pero ya no sale solo.

---

## 7. Migración

### 7.1 Qué pasa con cada sistema
| Sistema | Destino | Fase |
|---|---|---|
| 4 minijuegos (`src/games/*`, ~6.000 líneas) | se sacan cuando la Expedición esté validada; sus edificios se reconvierten (§5.3) | 5 |
| Materiales cristal/ladrillo/tuerca/mapa | materiales de región 1:1 (§7.2) | 5 |
| Monumentos | se quedan; costos con los materiales nuevos; bonus atados al ciclo (§5.4) | 2 y 5 |
| Álbum de figuritas | **Hallazgos**: los 12 sets se reparten entre las regiones, se conservan ids y lo ya pegado | 5 (y textos en 6) |
| Potenciadores de minijuego | equipo de expedición (§7.2) | 5 |
| Cofres | muy recortados (§8) | 5 |
| Pase y eventos | el Pase sigue, con puntos de expediciones y amenazas, ~1 nivel por día; los eventos de minijuego se cambian por eventos de región | 5 |
| Encanto y rango | el rango maneja épocas, regiones y terreno; el Encanto mejora el trato en las aldeas | 2 y 4 |
| Auto y garaje del Vestidor | el auto solo se usa en los minijuegos: queda abierto (§9) | 5 |
| Mi Casa, Vestidor, temas, social | se quedan; el social se adapta en la Fase 7b | — |

### 7.2 Guardado v3 (`state.js`, `VERSION = 3`, Fase 5)
`migrateV3(s)` corre si `s.v < 3`, antes de `deepFill`, y es idempotente:
1. **Materiales**: `cristal → mineral`, `ladrillo → piedra`, `tuerca → madera`, `mapa → hierbas`, sumando cantidades.
   Los costos de `MONUMENTS` se renombran con la misma tabla (el Jardín queda mineral + madera: vidrio y madera de
   invernadero), así que una etapa a medio juntar sigue igual de cerca.
2. **Edificios de minijuego**: se reconvierten según §5.3. Si no había Pista, la Casa de Expediciones se coloca sola cerca de
   la Municipalidad (misma búsqueda que `ensureHome`); si no entra, queda una construcción gratis en el menú.
3. **Progreso de minijuegos → compensación** (modal único "Los minijuegos se retiraron"):
   `gemas = min(150, 2 × (match3.level − 1) + 3 × (parking.level − 1) + floor(blocks.best / 1000) + floor(driving.best / 1000))`
   y `hallazgos = min(10, floor(niveles totales / 5))` en sobres de 2★ o más. `state.games` queda guardado y sin uso.
4. **Álbum → Hallazgos**: `state.album` no cambia (`have`, `claimedSets`, `seen`, `done`); `album.brillitos` sigue siendo el
   campo de los **recortes** (cambia solo el texto). Reparto de sets por región, en orden: Bosque `princesas`, `vestidos`,
   `autitos` · Sierras `postres`, `mascotas` · Bañado `flores`, `castillos` · Cerro `joyas`, `musica` · Costa `playa`,
   `noche`, `fiesta`. Nombres y arte nuevos por región: Fase 5, con la Guía de tono.
5. **Potenciadores → equipo**: `m3_moves → cuerda`, `m3_bomb → pala`, `blk_bomb → pala`, `park_time → farol`,
   `drv_shield → lona` (1:1). Martillo, reloj de arena y pociones se quedan.
6. **Épocas**: cada edificio recibe `era = eraOfRank(rango actual)`: lo ya ganado se ve en su época sin pagar renovación.
7. **Recursos nuevos**: `prov = 30`, `planos = floor(rango / 2)`, `equipment`, `reserves`, `colonos = 0`, `expedition`,
   `threats` (los completa `deepFill`).
8. **Misiones**: quien ya jugó (rango ≥ 2 o nivel ≥ 5) arranca la cadena nueva en la primera misión que no cumple, salteando
   t1–t12 sin premio (salvo lo que habilitan). Las diarias se re-sortean.
9. **Logros de minijuegos**: se conservan los escalones ganados y se muestran como "Recuerdos"; no suman más.
10. **Online**: el perfil público publica los ids nuevos y `era`; un cliente viejo vería edificios desconocidos como caja
    neutra, pero con `npm run bump` todos se actualizan. Los intercambios de figuritas siguen andando (ids iguales).

Prueba: cargar un guardado v2 real (con monumentos a medias, álbum y potenciadores) y confirmar que materiales, álbum,
monumentos, edificios y niveles pasan sin pérdida, y que una segunda carga no cambia nada.

**Resultado de la Fase 5a** (`migrateV3` en `state.js`, `tools/test-migration.mjs` en `npm test`):
- Si la partida ya tenía el edificio del ciclo (p. ej. Joyería **y** Taller, posible desde la v20), queda uno solo con el nivel
  más alto y el repetido se devuelve en monedas (costo de base × nivel; `v3.refund`).
- "Niveles totales" para los hallazgos = (Joyas − 1) + (Estacionamiento − 1). Cada hallazgo de compensación es de 2★ o más.
  Las gemas se suman en la migración; los hallazgos se entregan al arrancar (después de `initAlbum`) y el aviso sale una vez en
  la llegada a la ciudad (`state.v3`). Una partida recién empezada (`isFreshGame`) no recibe aviso ni la Casa automática.
- La Casa de Expediciones automática la coloca `economy.ensureExpHouse` en el primer `tick` (misma búsqueda que Mi Casa).
- Hallazgos: `SET_REGION` en `album.js`; `grantStickers({region})` saca solo de los sets de esa región (la expedición pasa
  `run.region`). La pantalla agrupa los sets por región. Nombres y arte nuevos de los sets: pendiente (Fase 6).
- Cofres: sin cofre por partida ganada; el cofre gratis pasa a 1 por día (sin acumular) y subir de nivel ya no da madera
  (oro cada 5 niveles, diamante en 20/30/40). Nueva carta rara "Equipo de expedición". La Bolsa de materiales da de región.
- Pase: los potenciadores de los niveles 7, 17 y 23 pasan a equipo (`equip` en `TIERS`); chispas por expedición
  (20 + 5 por ★) y por zona explorada (30) en lugar de las partidas (números de la propuesta de §8, sin recalibrar).
- Eventos: las 4 semanas de minijuego pasan a semanas de región (`region_bosque`, `region_sierras`, `region_banado`:
  ×1,5 materiales en esa región; `expMats` ×1,25 en todas); Lluvia de Cofres da segunda tirada al cofre de 3★; Fin de
  semana de Hallazgos duplica cada hallazgo; la Carrera de Estrellas cuenta las estrellas de expedición.
- Monumentos (§5.4): Estadio = +25% de chispas en expediciones y Museo = +50% de chance de un hallazgo más al volver (ya
  andan). El Observatorio queda, por ahora, en +25% de experiencia de expedición (la salida da 10 + 5 por ★ de XP, como
  daban las partidas); el aviso de amenazas 2 días antes y el Faro (+1 de visión) quedan para la fase que toque
  `src/threats/` y `exp-rules.js`.
- El auto del Vestidor queda atado al Establo (ex Garaje): botón "Auto" en su ficha y se estaciona al lado (§9).
- Ranking semanal de contactos: solo Nivel, Estrellas (de expedición) y Encanto; el perfil publica `week {stars, exps}`.

---

## 8. Metas de balance

Las mide el `tools/sim-economy.mjs` nuevo (Fase 5) con el perfil **2 ratos por día** (9:00 y 20:00, ~10 min) salvo que
diga otra cosa, y `tools/sim-expedition.mjs` (Fase 1) con bots. Cada meta tiene que salir en el reporte de la sim con
✔/✘.

**Monedas** (reformulada en el pulido; antes: "al final de cada rato, saldo entre 1× y 3× del próximo gasto grande en
≥ 80%", ver abajo por qué no se podía cumplir)
- **Al llegar** a cada rato, del día 2 al 60: el saldo (después de cobrar) está entre **1× y 3× de lo que se quería comprar
  al irse del rato anterior** (la próxima mejora, construcción, renovación, expansión u obra de rango que la sim quiere
  hacer) en **≥ 75%** de los ratos.
- **Al irse**: el saldo pasa **3× el próximo gasto grande** en **≤ 10%** de los ratos (no se juntan monedas sin destino).
- Sumidero del medio del juego: **comercio con las aldeas** (`economy.tradeQuote` / `buyMissing`, botón en Obras). Las aldeas
  venden los materiales que le faltan a la etapa de un monumento, por monedas y con tope por día (`TRADE`, por época:
  60/90/200/320/480 monedas cada uno, 12/20/30/45/60 por día). Pide la Casa de Expediciones; lo comprado no cuenta como
  material juntado. La sim compra si después le quedan ≥ 2,5× las monedas de la etapa.
- Multiplicadores de producción **sumados y con tope**: `1 + felicidad + rango + maestría + monumentos`, tope ×2,5; las
  pociones y los eventos multiplican después, con tope ×2 entre ambos.

**Pase de Temporada**
- ~1 nivel por día; el nivel 30 entre el **día 22 y el 25** con 2 ratos por día; con 4 ratos por día, no antes del día 16.
- Propuesta inicial: chispas por diaria 40, bonus de las 3 diarias 60, misión principal 50, salida terminada 20 + 5 por ★,
  zona explorada 30, amenaza `40 + 0,6 × %`, construir 5, mejorar 15, renovar 15, reparar 5, cobrar 1 (tope 30 por día),
  hallazgo nuevo 5, ayudar a un contacto 20; `TIER_COST` = 60, 120, 180 y después 280. La sim manda sobre estos números.

**Rango**
- 2 ratos por día: rango 2 el día 1; 3 entre los días 4–6; 5 entre los días 18–25; 8 entre los días 70–90.
- **El rango no lo frena solo el nivel**: en ≤ 25% de las subidas el último requisito en cumplirse es `reqLevel`, y el tiempo
  esperando solo por nivel es < 10% del tiempo entre rangos.

**Provisiones y expediciones**
- Rango 1–2: alcanza para 2 salidas normales por día + la corta. Rango 5+: 3 normales por día.
- El depósito llega al tope en < 30% de los ratos (no se tira producción a la basura).
- Bots de `sim-expedition` (500 salidas por región y zona):
  - **prudente** (vuelve con reserva ≥ 1,5 × regreso): fracasa ≤ 10%, ★ de objetivo ≥ 85%;
  - **codicioso** (vuelve recién cuando no le alcanza para otro paso): fracasa 30–50%;
  - **medio**: 3★ en 25–40%;
  - salida normal de 12 a 25 pasos (≈ 3–6 min a 10–15 s por paso); botín 8–14 materiales, 0,4–0,8 planos y 0,8–1,5
    hallazgos;
  - "seguir" (jugar como el codicioso desde ahí) rinde más que "volver" en 25–65% de las vueltas voluntarias del prudente
    y el medio: si fuera casi siempre o casi nunca, la decisión sería obvia.
- **Fase 2** (`roleStep` 3 → 5, `node tools/sim-expedition.mjs --n 300`): el % que se ve en la decisión típica sube 20 puntos
del nivel 1 al 5 (cruzar un río 75% → 95% con Ingeniería). En el agregado: Exploración sola nivel 1 → 5, medio 3★ 29,7% →
32,7% y objetivo 77,7% → 80,7%; Ingeniería + Sanidad, prudente 3★ 23% → 29%. El prototipo (nivel 1) no cambia.
- **Resultado de la Fase 1** (prototipo: Bosque, zona 1, Exploración + Ingeniería + Sanidad en nivel 1, 24 provisiones,
  carga 15; `node tools/sim-expedition.mjs --only proto --n 1000`): prudente fracasa 0% y cumple el objetivo 82%; medio 3★
  36%; codicioso fracasa 15%; 14,8 pasos (p10–p90: 11–20); 12,2 materiales, 0,44 planos y 1,34 hallazgos; seguir > volver
  en 38%. Dos metas de partida quedan afuera, y se aceptan así:
  - *prudente ≥ 85%*: el bot pierde provisiones paseando por la niebla antes de ubicar la casilla del objetivo; una persona
    va derecho a la zona dorada (jugando a mano, el objetivo se encontró en todas las salidas).
  - *codicioso 30–50%*: el regreso se ve siempre ("Volver · 3", "sin vuelta" en rojo), así que quien apura con cuidado solo
    fracasa por los dados (imprevistos y peligros fallados al final). Llevarlo a 30% pedía tanta suerte en contra que el
    juego prudente también se sentía al azar. Con menos ayudas (sin Sanidad, regiones de tier 3+) sube solo a 35–55%,
    casi todo "sin ánimo". Meta efectiva: **15–35% en el prototipo**. El codicioso trae ~10% más valor que el medio:
    apurar paga, pero con varianza.
  - Corta (`--kind corta`): prudente cumple 87%, medio 3★ 22%, 8 pasos.
  - Roles: sin nadie, 3★ 9%; con Exploración sola, 29%; con los 3 del prototipo, 40%. El nivel del rol mueve poco (+3 por
    nivel): la Fase 2 puede querer subirlo (p. ej. +5) para que mejorar el edificio se note en las decisiones.

**Amenazas**
- La sim que juega normal llega a la amenaza con preparación ≥ 70%; la resolución automática da 75–95%; ≤ 2 edificios
  dañados en promedio.

**Otros**
- Cofres: ≤ 1,5 por día en promedio (fuentes: rango, cada 5 niveles, Pase, amenazas ≥ 90%, salidas de 3★).
- Gemas: 15–25 por día.
- Primer monumento terminado: días 10–14.
- Planos: nunca son lo último que falta para un cambio de época en más del 30% de las corridas.


**Resultado de la Fase 5b** (`node tools/sim-economy.mjs`, 2 ratos por día, 60 días): 18 ✔ · 1 ✘. Pase nivel 30 el día 25
(día 18 con 4 ratos, `TIER_COST` 60/120/180 y después 440; planos en los niveles 10/20/30); rangos 2/3/5/8 los días
1/4/19/77, el nivel es el último requisito en el 17% de las subidas; cofres 1,4 por día (cofre gratis cada 3 días); gemas
20,9 por día; primer monumento el día 11; depósito al tope 0–14%. Multiplicadores sumados con tope ×2,5 y pociones ×
eventos con tope ×2 (`economy.js`). Colonos: suman población hasta el 25% de lo que alojan las casas. **No se cumple**:
saldo 1×–3× en el 41–59% de los ratos (bimodal: < 1× los primeros 10 días, > 3× esperando materiales de monumento); se
acepta y queda para la próxima vuelta. Detalle de cada número en `docs/HANDOFF-fase5b.md`.

**Resultado del pulido** (`node tools/sim-economy.mjs`, semilla 1): **20 ✔ · 0 ✘** a 60 días y a 90 (rango 8 el día 77,
depósito al tope 0,6%). Por qué cambió la meta de monedas: la sim (como una persona) compra todo lo que le alcanza, así
que al irse el saldo queda < 1× siempre que las monedas son lo que frena; solo pasa 1× cuando frenan los materiales o las
constructoras. Con la medida vieja, ningún ajuste pasó de ~60% (comercio 59%; monumentos con −20/−30% de monedas 50–65%,
y además rompen las metas de amenazas y del primer monumento, que están al límite). Medida al llegar y con el comercio:

| Semilla | Al llegar 1×–3× (antes, sin comercio) | Al irse > 3× | Al irse 1×–3× (meta vieja) |
|---|---|---|---|
| 1 | **77,7%** (61%) | 1,8% (antes 15%) | 51% (antes 41%) |
| 2 | 73% (61%) | — | — |
| 3 | 48% (61%) | — | — |
| 4 | 64% (51%) | — | — |

Lo que queda abajo de 1× al llegar son las etapas de monumento que se pagan en 3 o 4 ratos (Jardín, Observatorio,
Estadio, Museo): ahí frenan las monedas, que es lo esperable. Las semillas 3 y 4 encuentran más materiales y entonces las
monedas frenan más seguido: si se quiere ≥ 75% en todas, el próximo paso es bajar un poco las monedas de esas etapas y a
la vez reacomodar las amenazas (que hoy quedan en 75–76%, justo en el borde).

### 8.x La Raíz y la Grieta (PLAN-QUIEBRE L1, paso 6a)
`npm run sim:economy` corre además las tres extracciones (`--raiz sellar|medida|exprimir`, en procesos aparte; `--no-raiz3`
para saltearlo). La sim encuentra el Núcleo al llegar a la mina (o 3 días después del rango 5 si el bot no fue al Cerro),
construye el Invernadero apenas puede y hace la obra de Raíz cuando la Grieta pasa de 40.

| Meta | Cómo se mide | Semilla 1 (2026-11-09) |
|---|---|---|
| Ninguna extracción saca más de 15 % de ventaja neta a los 60 días | valor neto desde el día del Núcleo = monedas + 250 × material + 20 × provisión que entran − reparaciones − obras de Raíz; (mejor − peor) / peor | 2,7 % |
| La elección cuesta | exprimir da más bonus y trae más Grieta y no menos daño que sellar | sellar 39.500 · Grieta 0 · 3 dañados / exprimir 158.000 · Grieta 38 · 4 dañados |

Números (src/core/raiz.js): sellar ×0,5 sin Grieta · con medida ×1, +4 al elegir y +0,15 por día hasta 15 · exprimir ×2,
+15 al elegir y +0,9 por día. La Grieta da +1 de fuerza a las amenazas desde 15, +2 desde 35 y +3 desde 60 (desde el rebalanceo §8.z; antes 25/50/75) (el premio
se calcula sin esa fuerza) y suma una amenaza por temporada desde 30 y dos desde 60 (los sábados que falten y después los
miércoles 9 y 23). La Raíz da +0,1 de eficacia contra la sequía y la helada (fija, sin importar la extracción, desde §8.z). El Invernadero (rango 5, 7.000
monedas, madera 6, hierbas 6, mineral 2) da 2 hierbas × rinde cada 3 h (guarda 2 tandas). La obra de Raíz cuesta 6.000
monedas, madera 6, piedra 6 y hierbas 4 (+35 % cada vez), tarda 12 h y cose 12.
---

### 8.y La gente de la ciudad en el simulador (paso 7)
`sim:economy` simula ahora a la gente de la ciudad (L5): llegan, avanzan sus encargos, el bot entrega materiales y mejora
las herramientas en el Taller con lo que le sobra después del próximo gasto grande (una mejora por rato, Martillo y Farol
primero). `--no-tools` corre como antes. Imprime en cada rango el nivel del líder, el de las tres mejores clases y las
herramientas (con eso arma `sim-combat` su sección "En la partida").

- **Semilla 1, con la gente:** 18 ✔ · 4 ✘. Fallan monedas al llegar (58,7 % contra ≥ 75 %), "el último requisito es el
  nivel" (33 % contra ≤ 25 %), "esperando solo por nivel" (15,9 % contra < 10 %) y la automática (74,3 % contra 75–95 %).
  Sin la gente (`--no-tools`) da 22 ✔ · 0 ✘.
- **No es la gente lo que lo rompe: es la semilla.** Con las semillas 2 a 4, sin la gente, fallan 3, 4 y 5 metas; con la
  gente, 7, 2 y 3. "Monedas al llegar" falla en todas las corridas menos la semilla 1 sin gente; la preparación, la
  automática y "el último requisito es el nivel" fallan en la mitad. Con la gente el juego va un poco más rápido (rango 5
  el día 19 en vez del 24): las salidas rinden más y el nivel del jugador queda atrás del rango.
- **Se probó y no alcanzó:** sin los efectos de las herramientas en la expedición, sin que el bot gaste en la gente,
  experiencia por Vínculo (40 × Vínculo) y Martillo al 3 %. Ninguno lleva las cuatro semillas a verde: las metas de
  arriba están al borde con cualquier suerte.
- **Hecho en §8.z:** el rebalanceo con varias semillas.

### 8.z Rebalanceo con varias semillas (paso 7b)
`npm run sim:seeds` (`node sim-economy.mjs --seeds 1-6`) corre una partida completa por semilla en paralelo, cada una
con sus metas (también la Raíz y los 4 ratos), y dice en cuántas pasa cada meta. `--seeds 13-24`, `--seeds 1,5,9` y
`--days 90` también valen; los demás flags pasan igual. Tarda ~1 minuto para 12 semillas.

**Resultado** (con la gente de la ciudad y sus herramientas):

| Corrida | Antes (paso 7) | Ahora |
|---|---|---|
| 60 días, semillas 1–6 | 10 metas con alguna falla (monedas al llegar 0/6, "el último requisito es el nivel" 0/6) | **todas en las 6** |
| 60 días, semillas 1–12 | — | **todas en las 12** |
| 60 días, semillas 13–24 (fuera de muestra) | — | ver abajo |
| 90 días, semillas 1–6 | — | rango 8 entre 70 y 90 en las 6; depósito al tope 5/6 |
| semilla 1 sola (`npm run sim:economy`) | 18 ✔ · 4 ✘ | 22 ✔ · 0 ✘ |

**Qué cambió en el juego** (solo números de economía y amenazas):
- **Monumentos** (`MON_COIN = 0,75` en `data.js`): las etapas del Jardín, el Observatorio, el Estadio y el Museo cuestan
  25 % menos monedas. Se pagaban en 3 o 4 ratos y se llegaba con menos de lo que se quería comprar. El Faro (el primero,
  meta del día 10–14) y la Torre del Reloj quedan igual; la Torre, que marca el rango 8, pide 25 % más de materiales: con
  los otros más baratos sobraba plata para comprárselos a las aldeas y la Capital llegaba el día 67.
- **Nivel pedido por rango:** el rango 6 pasa de 23 a 21 y el 7 de 28 a 26 (con la gente, el rango llegaba antes que el
  nivel en 2 o 3 de cada 6 subidas). El 5 y el 8 quedan igual.
- **Rango 3:** Encanto 650 → 620 (la semilla lenta llegaba el día 7).
- **Amenazas** (`threat-data.js`): la preparación pesa igual la cobertura y las reservas (0,5 y 0,5; antes 0,6 y 0,4) y
  la resolución automática arranca de 40 (antes 35). El Cuartel de Bomberos ya no pide plano: sin planos no había nada
  contra el incendio. El Farol de guardia suma 5 puntos por nivel (antes 4).
- **La Raíz** (`raiz.js`): la Grieta pega desde 15/35/60 (fuerza +1/+2/+3) y trae amenazas de más desde 30/60. La
  resistencia a la sequía y la helada ya no depende de la extracción (con el rinde, exprimir también defendía el doble).
- **Gemas de E5:** las misiones del Acto 1 dan menos gemas (3, 4, 4 y 6; antes 5, 6, 6 y 10).

**Qué cambió en el simulador** (que mida lo que dice la meta):
- "Lo que se quería comprar" es lo que frenan las monedas o los materiales. Si lo frenan las constructoras ocupadas o un
  plano, se le guardan monedas igual, pero no cuenta para la meta: el Granero con las constructoras ocupadas o una
  renovación sin plano quedaban como "el gasto grande" con el saldo 10× o 600× arriba.
- La meta de la Raíz pide que exprimir traiga más bonus, más Grieta y **amenazas más fuertes o más seguido** que sellar
  (Σ de la fuerza de la Grieta en cada aviso, o más avisos). El daño se muestra pero no se pide: con el doble de bonus quien
  exprime se defiende mejor, y el costo neto ya lo mide la meta del 15 %.
- Se probaron y se descartaron: comprar en las aldeas con 2× o 3× (2,5× sigue siendo lo mejor), topes de comercio más
  altos y monumentos al 70, 80 y 85 %.
- **Queda:** a 90 días, en 1 de 6 semillas el depósito de provisiones pasa el 30 % de los ratos al tope desde el día 50
  (entran 88 por día y tres salidas normales gastan ~72). Fuera de muestra (semillas 13–24) cada meta pasa en 10 u 11
  de 12, con las fallas al borde: el ruido del bot.

## 9. Abierto (lo deciden las fases con el juego en la mano)
- Fuerza, focos y turnos de amenaza: validar en la Fase 3 que con preparación media se llegue a ~90% jugando.
- Si quien lidera tiene alguna habilidad propia (hoy no).
- Colonos: si hace falta un tope por vivienda libre.
- Dibujo del arroyo y el monte alrededor del terreno (Fase 3) y cómo se ve la crecida.
- `TIER_COST` y chispas finales (Fase 5, con la sim).
- El auto y su taller en el Vestidor: sin minijuegos no tiene uso. Propuesta: pasa a ser la carreta/vehículo de la Casa de
  Expediciones (se ve al salir); decide la Fase 5.
- Nombres finales de las regiones, de los sets de Hallazgos y de los objetivos: con la Guía de tono, en la fase que los use.
- Fabricar con cola de tiempo en el Taller (hoy es al instante).

---

## 10. Dueños de archivos por fase
Cada fase toca **solo** sus archivos. Si necesita algo de otro dueño, lo deja anotado en la carpeta de notas compartida
para la sesión coordinadora. Archivos nuevos: dentro de la carpeta de la fase con su prefijo.

| Fase | Puede tocar | No toca |
|---|---|---|
| **1** Prototipo de Expedición | `src/expedition/exp-*.js` (nuevos), `tools/sim-expedition.mjs`, `tools/test-expedition.mjs`; en `src/main.js` **solo** la línea de `SCENES.expedition` | `src/core/*`, la ciudad, `data.js` (íconos: usa emojis con `icon('🪵')`, no edita `icons.js`) |
| **2** Expedición ↔ ciudad | `src/expedition/expedition.js`; `data.js` (edificios del ciclo, `MAIN_QUESTS`, `DAILY_POOL`); `state.js` (campos nuevos y `grant/spend/canAfford`, **sin** migración v3); `economy.js` (provisiones, `expansionStatus` por zonas, `roleLevel`); `quests.js` (tipos nuevos); `src/city/models-cycle.js` (nuevo) y su registro en `models.js`; `src/scenes/panels-expedition.js` y `panels-workshop.js` (nuevos); en `hud.js` **solo** el botón Expedición | `src/games/*`, temporada, cofres, social |
| **3** Amenazas | `src/threats/*` (nuevo); `src/city/models-defense.js` (nuevo); `data.js` (defensas y misiones t15–t17); `economy.js` (daño y reparación en `producerStatus`/`canUpgrade`); `state.js` (`threats`, `b.damaged`); `city.js`, `city-ui.js` y `city-world.js` (capa de defensa, radio al colocar, arroyo y monte) | `season.js` (solo lee `EPOCH` y sus funciones de fecha) |
| **4** Épocas y arte | `models-kit.js` (capa de época), `models.js` (`buildTemplate`, caché, `thumbnail`), `models-*.js` por tandas; `data.js` (`ERAS`, `eraOfRank`, `req.planos`, `look`, `eraArt`); `economy.js` (`cityEra`, renovar); `palette.js` (paletas de época, coordinando con lo que dejó la Fase 6) | lógica de expedición y amenazas |
| **5** Sacar minijuegos, v3, economía, HUD | borrar `src/games/*` y `panels-games.js`; `main.js` (router, `finishGame`); `state.js` (migración v3); `season-data.js` (puntos, niveles, eventos); `src/chests/*` (recorte); `src/album/*` (Hallazgos); `hud.js` (rearmado en 3 capas: *Hoy*, *Temporada*, *Largo plazo*; ≤ 14 controles y ≤ 4 globitos); `quests.js`; `tools/sim-economy.mjs`; las suites de `tools/test-*.mjs` | arte de época, motor de amenazas |
| **6** Tono (en paralelo desde ahora) | **solo literales de texto** (`name`, `desc`, `title`, `text`, mensajes) en `data.js`, `season-data.js`, `album.js`, `src/online/social*.js`, `src/scenes/*`, `src/core/ui.js`; `palette.js`, `styles.css` (reglas existentes), `audio.js` (música nueva `expedition` y `amenaza`), `avatar-outfits.js`, `themes.js` | no agrega ni saca entradas de catálogos ni cambia ids o números |
| **7a** Métricas y accesibilidad (en paralelo desde ahora) | `src/online/telemetry.js` (nuevo, escucha el bus); `supabase/schema.sql` (tabla `events`, solo inserción con RLS); `panels-settings.js` (métricas, tamaño de texto, reducir movimiento); `styles.css` **solo en un bloque nuevo al final** marcado `/* === Accesibilidad (Fase 7a) === */`; `index.html` (zoom); en `main.js` **solo** la línea de `initTelemetry()` | catálogos y lógica de juego |
| **7b** Social adaptado (al final) | `src/online/*`, `schema.sql`: Expedición del día, mandar una cuadrilla a un contacto, intercambio de hallazgos | — |

Reglas para las sesiones en paralelo:
- Ninguna fase corre `npm run bump` ni toca `sw.js`/`VERSION`: lo hace la sesión coordinadora al unir.
- Los nombres de eventos de bus y de campos de estado de este documento son el contrato: si una fase necesita cambiarlos,
  actualiza este documento en el mismo commit y lo avisa en la carpeta de notas.
- La Fase 7a registra al menos: los pasos `t1`–`t12` del tutorial (`quests:changed`), `expedition:started/finished`,
  `expedition:zone`, `threat:resolved`, `era:changed` y `town:rankup`. Mientras esos eventos no existan, el oyente no hace
  nada (no rompe).
- `era:changed {era, from}` lo emite la Fase 4 al terminar la obra de rango que cambia de época (junto a `town:rankup`).
