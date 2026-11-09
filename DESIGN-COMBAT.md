# Combate táctico por turnos (El Quiebre, paso 5)

Plan: [docs/PLAN-QUIEBRE.md](docs/PLAN-QUIEBRE.md), §C (combate), §I (principios y balance) y §L5 (herramientas y nivel
del líder). Cubre el motor puro (§1–§10), la escena con su interfaz (§11) y el combate dentro de la expedición: la
casilla `enemigo`, el traspaso entre las dos escenas y la primera pelea guiada (§13), y las clases, subclases y el
nivel del líder (paso 5b, §14). Lo que falta está en §12 y en §14.10.

| Archivo | Qué es |
|---|---|
| `src/combat/combat-data.js` | Todos los números: unidades, habilidades, elementos, consumibles, enemigos, encuentros, desafíos y combos |
| `src/combat/combat-rules.js` | Motor puro y determinista: sin DOM, sin three.js y sin `Math.random` |
| `src/combat/classes.js` | Clases, subclases, curvas de nivel y kits (paso 5b, §14). Puro |
| `src/core/classes.js` | Estado de la partida: experiencia de clase y del líder, clase y subclase del líder (§14.6) |
| `src/core/classes-migrate.js` | Migración de los roles viejos a clases (§14.8). Pura |
| `tools/test-classes.mjs` | Clases, nivel del líder, subclases y migración: Node y Chrome headless (§14.9) |
| `tools/test-combat.mjs` | Pruebas en Node: `node test-combat.mjs` (con `--quick` saltea las corridas largas) |
| `tools/sim-combat.mjs` | Simulador con una IA de jugador: `node sim-combat.mjs [--n 40] [--only id] [--tools]` |
| `src/combat/combat-scene.js` | Escena `combat` en 3D: campo, unidades, casillas marcadas, animaciones y entrada |
| `src/combat/combat-ui.js` | Interfaz DOM: objetivo, orden del turno, fichas, barra de acciones, vista previa, menú y resultado |
| `src/combat/enemy-models.js` | Modelos vóxel de los enemigos del Acto 1 |
| `tools/test-combat-scene.mjs` | La escena en Chrome headless (SwiftShader): teclado, mouse, turno enemigo y una victoria |
| `tools/test-combat-exp.mjs` | Combate ↔ expedición: la casilla `enemigo`, el traspaso, guardar a mitad, ganar, perder, retirarse y la guía (§13) |

Los dos scripts corren desde `tools/` sin `node_modules`. Todavía no están en `package.json`: se suman al integrar.

## 1. Principios (de §I)
- **Intenciones a la vista.** Cada enemigo marca antes las casillas que va a golpear, y el golpe cae ahí en su próximo
  turno, a quien esté parado en esa casilla. Se juega como un rompecabezas, sin dados: no hay daño al azar.
- **Pocas reglas que se combinan.** Las marcas son **relativas** a quien ataca: si lo empujás, su golpe se corre con él
  y le puede caer a otro enemigo. Matar a un enemigo o sacarle el golpe (Robar, Enredar, Farol) cancela su marca.
- **Cada decisión tiene un costo visible.** Si atacás cuerpo a cuerpo, quedás trabado y dentro de la rueda del lobo.
  Las habilidades fuertes tienen recarga y los consumibles se gastan.
- **Perder enseña.** La causa de la derrota queda en `result.reason`: `lider`, `cautivo` o `noche`. Cada intento fallido
  contra un jefe da **revancha**.
- **Siempre se avanza.** Perder deja el 30 % de la experiencia y retirarse el 20 %.

## 2. El turno
1. **Turno del grupo.** Cada unidad se mueve una vez y después actúa una vez, en ese orden y en el que quieras. Si
   actúa, ya no se mueve.
2. `endTurn(b)` cierra el turno del grupo. Después, `enemyTurn(b)` hace todo esto en orden:
   1. Cada enemigo ejecuta su golpe marcado, que pega a quien esté ahí (amigo o enemigo). Una pared lo para.
   2. Sube el agua donde la bestia la marcó. Cada casilla inundada saca vida a quien esté parado en ella.
   3. Se gastan las paredes y la lona.
   4. Llegan los refuerzos que se veían venir (oleadas o pasarela).
   5. Los jefes cambian de fase si corresponde.
   6. Cada enemigo se mueve y marca su próximo golpe. Si al terminar de moverse queda al lado de alguien, el acoso le
      saca 1.
   7. Si el objetivo es aguantar y ya pasaron los turnos, se gana.
   8. Empieza el turno siguiente, bajan las recargas y se anuncia qué llega en el próximo turno enemigo.
3. En el primer turno los enemigos todavía no marcaron nada: se acomodan durante su primera fase.

**Fin de la pelea.**
- **Victoria:** según el objetivo (§7).
- **Derrota:**
  - cae el líder (`lider`);
  - cae la persona que había que rescatar (`cautivo`);
  - se pasa del turno máximo, 12 en las comunes y 16 en los jefes (`noche`).
- **Retirada:** `retreat(b)`.

## 3. El campo
**Grilla de 8×8.** Los mapas se escriben como texto en `ENCOUNTERS[id].map`. La semilla puede espejar el mapa y sumar
de 0 a 2 obstáculos, sin cortar caminos. Los jefes usan mapa fijo.

| Casilla | Mover | Nota |
|---|---|---|
| llano, pasarela, salida | 1 | |
| agua baja | 2 | la bestia nada: le cuesta 1 |
| lo alto | 3 (con Cuerda: 2 o 1) | no se inunda; +1 de daño contra quien está abajo; +1 de alcance a distancia |
| árbol, roca, vacío | no se pisa | Romper parte rocas; el vacío es la pasarela cortada |
| inundada | +1 | el agua tira: 1 en la fase 1 de la bestia, 2 en la fase 2 |

**Movimiento:**
- El grupo atraviesa a sus aliados, pero no a los enemigos.
- **Trabado:** quien arranca al lado de un enemigo se mueve solo 1 y no puede apuntar a distancia. La guía no se traba.
- Los enemigos **no ven las trampas**: si su camino pasa por una, caen ahí y quedan frenados.

## 4. El grupo (el líder y hasta 3 integrantes)
Desde el paso 5b la **clase** define el kit (§14). Las 6 clases reemplazan a los 5 roles. La recarga se cuenta en turnos
propios: con recarga 1, se usa un turno sí y uno no.

| Clase (antes) | Vida | Mover | Ataque | Básico | Grupo de 4 activas (recarga) — se eligen 2 |
|---|---|---|---|---|---|
| Guerrero (nueva) | 13 | 3 | 3 | Golpe | Tajo (2) · Guardia (3) · Embestida (3) · Aguante (3) |
| Cazador (exploración) | 8 | 3 | 2 | Tiro 2–3 | Marcar (2) · Tiro al pie (3) · Tiro certero (2) · Lazo (3) |
| Forjador (ingeniería) | 10 | 3 | 3 | Golpe | Trampa (2) · Barrera (3) · Remache (2) · Cepo (3) |
| Curandero (sanidad) | 9 | 3 | 1 | Golpe | Curar (1) · Aliento (4) · Vendaje (3) · Resguardo (3) |
| Monje (guía) | 10 | 4 | 3 | Golpe | Empujar (1) · Relevo (3) · Esquivar (2) · Salto (2) |
| Saqueador (recolección) | 10 | 3 | 2 | Golpe | Romper (2) · Robar (3) · Rapiña (2) · Humo (4) |

- Las 2 primeras del grupo vienen de entrada (son el kit del rol viejo, y el cazador suma Tiro al pie). La 3.ª se abre
  en el nivel de clase 3 y la 4.ª en el 6.
- Con un rescate en curso, cualquiera del grupo puede **Liberar**.
- El **líder** sin clase pelea como antes: vida 12, ataque 3, Golpe y las habilidades del elemento. Con clase, ver §14.4.

**Habilidades nuevas** (`ABILITIES` en `combat-data.js`):

| Habilidad | Tipo | Efecto |
|---|---|---|
| Tajo | attack + `cleave` | pega al de enfrente y a los dos de sus costados |
| Guardia | cover, radio 1 | él y los de al lado reciben 2 menos el próximo turno enemigo |
| Embestida | push | 2 de daño y lo corre una casilla |
| Aguante | heal, `self` | se cura 4 |
| Tiro al pie | root, distancia 2–3 | 1 de daño y lo frena; no le saca el golpe ni levanta pared |
| Tiro certero | attack, distancia 2–4 | +2 de daño |
| Lazo | trap, distancia 1–3 | trampa de 2 que frena |
| Remache | attack + `pierce` | +1 y atraviesa la coraza sin romperla |
| Cepo | trap | 4 de daño y frena 2 turnos |
| Vendaje | heal, distancia 0–1 | cura 6 |
| Resguardo | cover, radio 1 | 1 menos al grupo de al lado |
| Esquivar | cover, radio 0 | 3 menos solo para él |
| Salto | leap, distancia 2–3 | salta a una casilla libre, por encima de todo |
| Rapiña | attack + `lootKill` | +1, y si lo liquida suma 1 de botín |
| Humo | dazzle, radio 1 | los enemigos de al lado pierden el golpe marcado |

**Elemento Raíz** (líder):
- **Enredar** (3): a distancia 3. Hace 1 de daño, le saca el golpe marcado, no lo deja moverse el próximo turno y
  levanta una pared de raíz al lado del enemigo por 2 turnos.
- **Muro de raíz** (2): pared por 3 turnos.

Los otros elementos (Marea, Brasa y Céfiro) llegan en los actos 2 a 4. Se suman a `ELEMENTS`.

**Consumibles del Taller** (`EQUIPMENT` de la expedición): un uso por pelea, como acción `item:<id>`.

| Consumible | Efecto |
|---|---|
| Botiquín | cura 5 |
| Farol | encandila: los enemigos a distancia 2 pierden el golpe |
| Pala | zanja: trampa de 2 |
| Lona | quien la usa y los de al lado reciben 2 menos en el próximo turno enemigo |
| Cuerda | subir a lo alto cuesta 1 toda la pelea |

## 5. Enemigos del Acto 1
Los patrones son relativos al enemigo y a hacia dónde mira:
- **rueda:** las 4 casillas de al lado;
- **rueda8:** las 8 de alrededor;
- **arco:** la de enfrente y sus dos costados;
- **línea N:** N casillas en línea;
- **tiro:** hasta N casillas en línea; pega en lo primero que encuentra.

| Enemigo | Vida | Mover | Golpe marcado | Rasgos |
|---|---|---|---|---|
| Lobo de ojos brillantes | 10 | 4 | Mordida en rueda, 3 | va por el más débil; acoso 1 |
| Lobo viejo | 15 | 3 | Zarpazo en arco, 4 | acoso 1 |
| Bicho de veta | 7 | 2 | Chispazo en línea 2, 2 | coraza −1 (Romper la parte); al morir revienta 2 a los de al lado |
| Grumete pirata | 12 | 3 | Sablazo en arco, 3 | acoso 1 |
| Tirador pirata | 9 | 2 | Trabuco, tiro de 4, 3 | se aleja; una barrera lo para |
| **Bestia del Bañado** (jefe) | 30 | 2 | fase 1: Coletazo, línea 3, 4 · fase 2 (≤ 50 %): Remolino en rueda8, 4 | inunda 2 filas por turno (3 en fase 2), marcadas un turno antes; nada; no se la puede empujar ni sacarle el golpe; no sube a lo alto |
| **La capitana** (jefe) | 34 | 3 | fase 1: Pistola, tiro de 5, 4, o Sable en arco, 4, si tiene a alguien al lado · fase 2: Abordaje en arco, 5 | va por el líder; refuerzos por la pasarela cada 2 turnos (cada turno en fase 2); la pasarela tiene 10 de vida y, si se corta, no llega nadie más |

**Acoso.** No se marca, pero está en la ficha del enemigo. Es un desgaste chico, para que la pelea no se gane
esquivando todo: sin acoso, la IA terminaba las peleas comunes sin recibir daño.

**Combos.** Se anotan en el manual y cuentan para el desafío "Juego en equipo".

| Combo | Cómo sale |
|---|---|
| Marcar y pegar | golpe a un enemigo marcado |
| A la trampa | empujar a un enemigo a una trampa |
| Contra la pared | empujar a un enemigo contra algo |
| Entre ellos | el golpe de un enemigo le cae a otro |
| Reventón | un bicho que revienta lastima a otro enemigo |
| Desde arriba | pegar desde lo alto |
| Sin coraza | romper la coraza de un bicho |

## 6. Fórmulas
- **Daño del grupo:** `ataque (+ plus de la habilidad) + marca (3, se gasta) + 1 desde lo alto − coraza`, con un mínimo
  de 1. Romper atraviesa la coraza.
- **Daño enemigo:** `golpe + 1 desde lo alto − Farol − Lona`, con un mínimo de 1. El acoso no se reduce.
- **Choque al empujar:** 2 a quien empujaste y 1 a la otra unidad, si chocó con una.
- **Trampa:** 3, más el bonus de Martillo (0, 1, 1, 2, 2 o 3), y frena 1 turno.
- **Líder por nivel** (1 a 30; experiencia y niveles clave en §14.4):
  - vida: `+⌊(nivel − 1) / 2⌋`;
  - ataque: `+⌊(nivel + 2) / 6⌋`, o sea +1 en el nivel 4 y +2 en el 10;
  - sin clase, espacios de elemento en los niveles 1, 5 y 12 (como antes del 5b).
- **Integrante por nivel de clase** (1 a 10): vida `+⌊(nivel − 1) / 2⌋` y ataque `+⌊(nivel − 1) / 4⌋`. El nivel de
  clase `2n − 1` pega y aguanta igual que el rol viejo de nivel `n`.
- **Pasivas** que lee el motor (`u.f`): Coraza (−1 a cada golpe), Protector (−1 a los de al lado), Rastreador (+1
  intención a la vista), Ojo fino (marcas +1), Oficio (el Martillo vale para sus trampas y barreras), Filo (trampas +1),
  Obra firme (barreras +1 turno), Botica (el Botiquín vale para sus curas), Mano firme (curas +1), Paso libre (no se
  traba), Bolsillo hondo (+1 material al ganar), Oportunista (+1 de botín por enemigo liquidado).
- **Revancha contra jefes:** por cada intento fallido, hasta 2, el grupo suma +5 de vida y el jefe tiene −20 % de vida.
  `newBattle({ attempt })`.
- **Botín:** `mats × (0,8 · 1 · 1,2)` con 1, 2 o 3 estrellas, más 1 material por cada Robar que sacó un golpe.
  - Experiencia: completa si ganás, 30 % si perdés y 20 % si te retirás.
  - Ánimo: −3 si perdés, −1 si te retirás.
- **Estrellas:** 1 por ganar y 1 por cada desafío cumplido. Son 2 desafíos por encuentro, así que el máximo es 3.
  - Nadie cae.
  - Rápido (N turnos).
  - Juego en equipo (N combos).
  - Sin refuerzos: cortar la pasarela.
  - Rescate limpio.
  - Al frente y entero: que no lastimen al líder.
- **Resolución rápida:** solo para una pelea común ya ganada (`canQuickResolve(id, wins)`). Da 1 estrella, el botín
  de 1 estrella × 0,75 y la mitad de la experiencia, sin jugar.

## 7. Encuentros del Acto 1 (`ACT1`)
| Encuentro | Región | Tipo | Objetivo | Enemigos | Desafíos |
|---|---|---|---|---|---|
| Ojos en el monte (`bosque_claro`, tutorial) | Bosque | común | derrota | 2 lobos (+1 en el turno 4) | nadie cae · ≤ 6 turnos |
| La manada | Bosque | común | derrota | 2 lobos y el lobo viejo | nadie cae · 2 combos |
| La veta despierta | Cerro | común | derrota | 6 bichos | ≤ 6 turnos · 2 combos |
| El minero atrapado | Cerro | común | **rescate** | 3 bichos (+1 en el turno 3, +2 en el 5) | rescate limpio · nadie cae |
| Aguantar en el juncal | Bañado | común | **aguantar 5 turnos** | 2 lobos (+1, +1 y el viejo) | nadie cae · líder entero |
| La bestia del Bañado | Bañado | jefe | vencer al jefe | la bestia | nadie cae · ≤ 8 turnos |
| Saqueo en el muelle | Costa | común | derrota | 2 grumetes y 2 tiradores (+1 grumete en el turno 3) | nadie cae · ≤ 6 turnos |
| El abordaje | Costa | jefe | vencer al jefe | la capitana, un grumete, un tirador y la pasarela | cortar la pasarela · nadie cae |

**Rescate.** Mientras el minero está atado y escondido, los bichos no lo ven. Cuando lo desatás, van por él. Gana el
grupo cuando el minero llega a una salida.

**Jefes.** Al vencer al jefe se gana aunque queden refuerzos: huyen. Los jefes dan la página y la marca de historia de
`reward.page` y `reward.flag`, y la historia decide si es la primera vez.

**Grupo esperado** (`expected`, lo usa el simulador). El líder es de nivel 1 en el Bosque, 3 en el Cerro, 4 o 5 en el
Bañado y 6 o 7 en la Costa. La Raíz entra desde el Bañado. El nivel de clase de los integrantes (`classLevel`) es 1 en
el Bosque, 2 en el Cerro, 3 en el Bañado y 4 en la Costa. Todas las combinaciones de 3 clases, y el líder rota por las 6.

**Grupo del tutorial** (`TUTORIAL_PARTY`). El líder de nivel 1, sin clase, herramientas ni elemento, con cazador,
forjador y curandero de nivel 1.

## 8. Metas y resultados del simulador
`node sim-combat.mjs --n 20` corre 20 peleas por cada una de las 20 combinaciones de 3 clases, con el líder rotando por
las 6 clases. Son 400 por encuentro y 400 por intento en los jefes, unas 4.400 peleas en total, en unos 110 s. Con
`--noclass` el líder pelea sin clase, como antes del 5b.

Con las clases (paso 5b) se reajustaron 4 números: grumete 12 → 14 de vida, tirador 9 → 10, la capitana 34 → 42 y la
bestia 30 → 32. El grupo de clases nivel 3–4 con el líder de clase pegaba de más en la Costa (98,8 % y 77 %).

| Pelea | Meta | Resultado (paso 5b) | Antes (roles) |
|---|---|---|---|
| Ojos en el monte | 85–95 % | 86,8 % ✔ (7,8 turnos) | 93,0 % |
| La manada | 85–95 % | 89,0 % ✔ (6,8) | 92,8 % |
| La veta despierta | 85–95 % | 90,3 % ✔ (8,9) | 91,8 % |
| El minero atrapado | 85–95 % | 92,5 % ✔ (7,4) | 92,3 % |
| Aguantar en el juncal | 85–95 % | 92,5 % ✔ (5,0) | 91,8 % |
| Saqueo en el muelle | 85–95 % | 92,0 % ✔ (8,1) | 94,0 % |
| Bestia, 1.º intento | 45–65 % | 61,3 % ✔ | 58,5 % |
| Bestia, 3.º intento | ≥ 85 % | 89,3 % ✔ (ganada al 3.º o antes: 99,1 %) | 91,3 % |
| Bestia, duración | 6–12 turnos | 8,2 ✔ | 8,5 |
| Capitana, 1.º intento | 45–65 % | 56,8 % ✔ | 55,3 % |
| Capitana, 3.º intento | ≥ 85 % | 94,8 % ✔ (99,5 %) | 93,8 % |
| Capitana, duración | 6–12 turnos | 9,9 ✔ | 9,7 |

**Aporte por clase.** Es el promedio por pelea en la que está cada una. La meta es ≤ 35 % del daño y de los golpes
finales. "Ganadas con / sin" compara las peleas con esa clase en el grupo contra las que no la tienen.

| Clase | Daño | Golpes finales | Ganadas con / sin |
|---|---|---|---|
| Líder (todas) | 23,7 % | 26,5 % | — |
| Guerrero | 30,0 % | 26,7 % | 81,3 % / 83,9 % |
| Cazador | 32,7 % | 24,7 % | 86,7 % / 78,6 % |
| Forjador | 29,1 % | 23,4 % | 80,7 % / 84,6 % |
| Curandero | 1,2 % | 5,3 % | 78,8 % / 86,5 % |
| Monje | 31,7 % | 26,8 % | 85,7 % / 79,6 % |
| Saqueador | 27,9 % | 24,8 % | 82,6 % / 82,6 % |

Como líder: cazador 38,0 % del daño, monje 31,5 %, forjador 23,9 %, guerrero 22,8 %, saqueador 14,2 % y curandero
11,8 %. El líder cazador pega más porque tira de lejos sin trabarse con lo alto; no cuenta para la meta (el líder está
siempre), pero el paso 7 lo mira.

- Todas cumplen. El curandero aporta curando: con él se gana un poco menos en el simulador porque la IA no aprovecha
  bien las curas en peleas cortas. El paso 7 lo revisa con la telemetría.
- Ninguna clase gana siempre: las dos que más suben las victorias (cazador y monje) suman unos 7 puntos.

**Herramientas en nivel 3** (medido con los roles, antes del 5b). % de peleas ganadas, primer intento contra los jefes:

| Variante | La manada | Bestia | Capitana |
|---|---|---|---|
| sin nada | 89,0 % | 54,0 % | 52,5 % |
| Catalejo | 89,0 % | 54,0 % | 64,0 % |
| Martillo | 91,5 % | 58,0 % | 56,5 % |
| Cuerda | 89,0 % | **82,5 %** | 66,0 % |
| Botiquín | 90,5 % | 57,5 % | 59,0 % |
| Farol | 89,5 % | 55,0 % | 55,0 % |
| líder +5 niveles | 97,0 % | 62,5 % | 78,5 % |

- Ninguna herramienta es obligatoria: las comunes ya pasan del 85 % sin ninguna.
- La Cuerda es la clave contra la bestia, como pide L5. El paso 7 tiene que mirar que no quede obligatoria.
- El Catalejo no cambia nada en peleas de 3 enemigos o menos, porque ya se ven 3 intenciones.

**Pruebas** (`node test-combat.mjs`): 102 bien, 0 mal.
- El grupo del tutorial gana cada encuentro (30 semillas):
  - comunes: de 19 a 29 de 30;
  - bestia: 13 de 30;
  - capitana: 9 de 30.
- Los jefes duran, en promedio:
  - la bestia, 7,9 turnos (90 % de las peleas entre 6 y 12);
  - la capitana, 10,4 (81 % entre 6 y 12).
- Guardar con `JSON.stringify` a mitad de pelea (incluso a mitad del turno del grupo) y retomar da el mismo resultado.

## 9. IA
**Enemigos** (`planEnemy`). Cada enemigo prueba cada casilla a la que llega y cada dirección de cada uno de sus
ataques, y puntúa el golpe:
- **Suma por golpear a alguien del grupo:**
  - el daño;
  - +3 si lo mata;
  - más si es el líder, el rescatado o el más débil, según lo que prefiera ese enemigo.
- **Resta:**
  - 0,7 por cada punto de daño a otro enemigo (evita el fuego amigo, pero no siempre puede);
  - por quedar en el agua;
  - un poco por moverse.

Si no puede pegar a nadie, se acerca a su presa por el camino más barato. Los jefes cambian de ataques por fase. La
bestia elige las filas que inunda donde más gente del grupo hay abajo.

**Jugador del simulador** (`botTurn` en `sim-combat.mjs`):
- **Golosa con un paso de mirada.** Para cada integrante prueba cada casilla y cada acción sobre una copia de la pelea
  (`preview`), y ejecuta la mejor de todas. Repite hasta que nadie mejora.
- **Qué mira `evalState`:**
  - vida propia y enemiga;
  - peligro de las marcas a la vista, que pesa menos en quien todavía se puede mover;
  - distancia según el rol;
  - el objetivo;
  - guardar recargas y consumibles.
- **Solo usa lo que ve el jugador** (`visibleIntentIds`) y tiene ruido de ±0,6 para no jugar perfecto.
- **Con `knows`** (del segundo intento contra un jefe en adelante) sabe la mecánica: busca lo alto contra la bestia y
  prioriza cortar la pasarela.

## 10. API y guardado
```js
newBattle({ encounter, seed, party, level, element, tools, equip, roleLevel, attempt }) → b
view(b)                       // casillas (peligro, agua, paredes, trampas, refuerzos), unidades, intenciones, objetivo, desafíos
move(b, id, x, y)             // { ok, why, events }
act(b, id, abilityId, x, y)   // abilityId: 'golpe', 'empujar', 'item:botiquin', 'liberar', …
endTurn(b) / enemyTurn(b)     // { ok, events }
retreat(b) / result(b)
canQuickResolve(id, wins) / quickResolve({ encounter, wins })
reachable(b, id) / targets(b, id, abilityId, fx?, fy?) / abilitiesOf(b, id) / intentTiles(b, e) / dangerMap(b)
preview(b, id, abilityId, x, y, from?)   // { ok, events, after } sin tocar b: la previsualización al pasar el mouse
cloneBattle(b)
```
- `tools`: `{ catalejo, martillo, cuerda, botiquin, farol }`, del 0 al 5.
- **Eventos** para animar:
  - movimiento y acción: `move`, `enemyMove`, `act`, `push`, `swap`;
  - daño y efectos: `dmg`, `heal`, `down`, `mark`, `trap`, `trapHit`, `root`, `cancel`, `stolen`, `explode`, `nip`;
  - golpes y combos: `intent`, `strike`, `combo`;
  - terreno: `wall`, `wallGone`, `rockBroken`, `flood`, `floodNext`, `cover`, `rope`;
  - refuerzos y pasarela: `incoming`, `spawn`, `bridge`, `bridgeCut`;
  - rescate: `free`, `rescued`;
  - fases y turnos: `phase`, `endTurn`, `enemyPhase`, `turn`, `end`.
- **Guardado.** `b` es JSON puro, con la suerte en `b.rs`. Se guarda tal cual en `state.expedition.active`, por ejemplo
  en `active.battle`, después de cada acción o de cada turno.

## 11. Escena e interfaz (paso 5, segunda parte)
**Cómo se abre.**
- `?scene=combat` abre un encuentro de prueba: Ojos en el monte, con el grupo del tutorial.
- Parámetros de la URL: `&enc=banado_bestia&seed=3&party=exploracion,guia,sanidad&level=5&element=raiz&tools=cuerda:3,catalejo:2&equip=botiquin,farol&attempt=2`.
- Para las capturas, `&hour=21&weather=lluvia` cambia solo el dibujo.
- Desde el juego: `router.go('combat', { battle | encounter…, conditions, onSave(b), onEnd(result, b) })`.
  - `battle` retoma una pelea guardada (JSON puro).
  - `onSave` se llama después de cada acción y de cada turno.
  - `onEnd` se llama al cerrar el resultado. Sin `onEnd` vuelve a la ciudad: es el caso de la prueba, que no guarda.

**La escena (`combat-scene.js`).**
- Cámara ortográfica como la de la expedición, encuadrada en el espacio libre entre los paneles. Q y E la giran de a 90°.
- El campo de 8×8 está armado con modelos vóxel por región, con paleta oscura:
  - el monte tiene pinos;
  - la mina tiene rocas con vetas que brillan;
  - el bañado tiene agua, juncos y sauces muertos;
  - la costa tiene tablones, postes y el dirigible de la capitana del otro lado de la pasarela.
- Lo alto es un peñón de 6 vóxeles. La salida tiene dos faroles. La pasarela cortada queda como hueco.
- Lo que cambia se rearma con los eventos:
  - paredes de raíz y barreras;
  - trampas;
  - el agua que sube;
  - rocas partidas;
  - la pasarela cortada.
- El grupo se arma con `avatarModel`: el líder con el look del jugador y los demás con el mismo `randomLook` que en la
  expedición. El minero atado lleva una soga. Cada unidad tiene un aro: azul el grupo, gris si ya actuó, dorado la elegida
  y rojo los enemigos.
- **Casillas marcadas.**
  - Llevan relleno rojo con borde y el daño en la esquina delantera, para que no tape a la unidad.
  - Al pasar el mouse por un enemigo, sus casillas se encienden.
  - El agua que sube va rayada en celeste.
  - Los refuerzos que llegan se ven rayados en rojo, con el cartel "Llega".
  - **Alto contraste** (`settings.hiContrast`, clase `hi-contrast`): fondo negro con rayado rojo y borde grueso claro.
    Se lee sin depender del color y cambia en vivo.
- **Animaciones.** Cada evento del motor se anima en orden:
  - caminar casilla por casilla;
  - estocada al actuar y al golpear;
  - sacudón y número al recibir daño;
  - caída al morir;
  - deslizarse al ser empujado;
  - salto al cambiar de lugar;
  - caer del cielo al llegar un refuerzo;
  - carteles de combo, fase del jefe, turno enemigo y "El agua sube".
- La velocidad es `settings.combatSpeed` (x1, x2 o x3). Con "reducir movimiento" va siempre a x3.
- Las animaciones van con tiempo real, no con el tiempo de cuadro. Si la máquina va lenta, saltan pero terminan a tiempo.
  Con SwiftShader se dibujan 3 cuadros por segundo.
- **Ambiente** (paso 3b).
  - Se le pasa `conditions` (lo que devuelve `combatConditions` de `src/core/ambience.js`) y lo dibuja `createAmbience`
    de `src/core/ambience-fx.js`, sobre la base oscura de cada región. Así hereda la hora y el clima de la casilla.
  - La niebla va detrás del campo, no encima (`fog` de 63 a 95).
  - La lectura manda: la luz nunca baja de un piso (`LIGHT_FLOOR`), ni de noche ni con tormenta.

**La interfaz (`combat-ui.js`).** Usa solo los tokens de J6.
- **Arriba:**
  - el encuentro y el objetivo ("Vencé a la bestia del Bañado");
  - los desafíos, con una estrella encendida mientras se cumplen;
  - la pasarela con su vida;
  - lo que llega en el próximo turno enemigo;
  - el turno, sobre el máximo (pasado ese turno, se hace de noche);
  - el botón de menú.
- **Izquierda, el orden del turno:**
  - el grupo, con su estado (se movió, listo o atado) y su vida;
  - después, los enemigos en el orden en que juegan, con el daño de su golpe o "?" si no se ve;
  - "N golpes no se ven desde acá", para que se entienda qué suma el Catalejo (L5).
  - Con un clic en alguien del grupo, se lo elige.
- **Abajo:**
  - la ficha de la unidad elegida: vida, mover, ataque y rasgos (trabado, frenado, en lo alto, ya actuó);
  - la barra de acciones: habilidades primero y consumibles después, con el número de su tecla, la recarga y el texto de
    la habilidad en el cartel del mouse;
  - el botón **Fin de turno** (Espacio).
- **Derecha:** la ficha de lo que está bajo el mouse.
  - Si es un enemigo: el golpe que marcó, la coraza, el acoso, si está marcado y la fase del jefe.
  - Si es una casilla: qué es y cuánto cuesta. Subir a lo alto muestra el costo con la Cuerda (L5).
- **Sobre el campo:** la barra de vida de cada unidad, con "+3" si está marcada, "frenado" o "?".
- **Vista previa al pasar el mouse.**
  - Con una habilidad elegida: el alcance en dorado tenue, los blancos en dorado y, sobre cada unidad afectada, lo que
    pasaría ("−8 · cae", "+4", "sin golpe"). Usa `preview` y no toca la pelea.
  - Moviendo: el alcance del ataque básico desde la casilla del mouse.
- **Atajos:**

  | Tecla | Qué hace |
  |---|---|
  | 1 a 9 | Habilidades y consumibles de la barra (1 a 4 son las habilidades) |
  | Espacio | Fin de turno |
  | Esc | Suelta la habilidad o abre el menú |
  | Tab y Shift+Tab | Siguiente o anterior del grupo |
  | Enter | Usa sobre uno mismo (Aliento, Farol, Lona, Cuerda) |
  | Q y E | Giran la cámara |
  | Clic derecho | Suelta la habilidad |

- **Clic:**
  - en alguien del grupo, lo elige;
  - en una casilla azul, mueve;
  - en un enemigo al alcance, le pega con el ataque básico;
  - con una habilidad elegida, la usa en el blanco.
- **Confirmar el fin de turno** (`settings.confirmEnd`): si a alguien le quedan acciones, pregunta. Espacio confirma y Esc
  sigue jugando.
- **Menú (Esc):** seguir, retirarse (pide confirmar y explica lo que cuesta), Ajustes y, en la prueba, volver a la ciudad.
- **Resultado:**
  - victoria, derrota o retirada, con el motivo;
  - las 3 estrellas (victoria y los dos desafíos);
  - el botín y la experiencia;
  - los combos;
  - el ánimo que se pierde;
  - si perdiste, una lección corta según `result.reason`;
  - contra un jefe, la revancha.
  - Botones: "Seguir", o "Reintentar" / "Revancha" y "Volver". La revancha suma un intento.
  - Emite `combat:end` en el bus.

**Enemigos (`enemy-models.js`).** `enemyModel(type, { broken })`. Cabeza y ojos van en partes animadas, y los ojos brillan
(capa `light`).
- **Lobos:** gris gastado, lomo erizado, colmillos y ojos amarillos.
- **Lobo viejo:** más grande, con melena y cicatriz, y ojos naranja.
- **Bicho de veta:** caparazón de piedra con cristales celestes que laten. Con `broken`, la coraza queda partida.
- **Grumete:** bandana, antiparras del cielo y sable.
- **Tirador:** saco largo, tricornio y trabuco.
- **Capitana:** saco rojo oscuro con dorado, pluma, brazo de bronce, sable y pistola.
- **Bestia del Bañado:** lomo de barro y musgo con juncos, garras, boca abierta y cuatro ojos verdes.

**Pruebas.** `node test-combat-scene.mjs`: 29 bien, 0 mal, en unos 4 minutos.
- Monta la escena.
- Teclado: Tab, 1 y Esc.
- Mueve con un clic real.
- Muestra las fichas al pasar el mouse.
- Espacio pide confirmar.
- Pasa el turno enemigo y los lobos marcan casillas, cada una con su número.
- Vista previa del daño, sin tocar la pelea.
- Alto contraste.
- Gana Ojos en el monte con el líder de nivel 30 en 6 turnos, con 3 estrellas y la pantalla de resultado.
- Retirada desde el menú.

**Capturas** en `shots/combat/` (la carpeta no se sube): `pelea-comun`, `casillas-marcadas`, `vista-previa`,
`alto-contraste`, `jefe`, `jefe-noche-lluvia` y `resultado`.

## 12. Pendiente
- **Integrar:**
  - sumar `test-combat-scene` y `test-combat-exp` a `npm test`, con los scripts `test:combat-scene` y `test:combat-exp`
    en `tools/package.json`;
  - correr `npm run bump`.
- **Sonido** (paso 3c): hoy usa los `sfx` que hay (`bump`, `crash`, `horn`, `combo`…) y la música `threat`. El 3c puede
  sumar golpes propios y una pista de combate.
- **Paso 5b, L5:** de dónde salen `tools`, `level` y `element`. Hoy la expedición los pasa así (§13):
  - `tools` sale de `mods.tools`, vacío hasta que estén los Vínculos;
  - `level` sale del nivel real del líder (`mods.leader.level`, de `state.classes`; §14). Sin él (simuladores, salidas
    guardadas de antes) queda el `expected.level` del encuentro;
  - `element` sale de los elementos encontrados (`state.story.elements`).
- **Paso 6 (E5), hecho en el 6b:** `q_combate` después de t5 (`quests.js` cuenta las victorias de `state.combat.wins`,
  con `enc` opcional). Los jefes van en lugares de la historia: la bestia en la poza honda del Bañado (casilla `enemigo`
  con `boss`, al fondo de la salida normal) y la capitana en el abordaje, que se pelea en la ciudad
  (`src/story/act1.js`). La revancha cuenta las derrotas guardadas (`mods.bossLosses` → `attempt` en `makeBattle`).
  Los jefes se dibujan en low-poly (`src/combat/boss-models.js`, con `setPhase` en la fase 2). La bestia ahora da la
  página 9 (antes p3, que ya daba el rango 2). Detalle en DESIGN-STORY §5, "Estado (paso 6b…)".
- **Paso 7:**
  - revisar que la Cuerda no quede obligatoria contra la bestia;
  - ajustar con los datos de la telemetría de combate (`combat:won`, `combat:lost` y `combat:retreat`).

## 13. Combate en la expedición (paso 5, tercera parte)
**La casilla `enemigo`** (`CONTENT.enemigo`, ícono ⚔️). `sub` es el id del encuentro.
- Solo aparece en la salida normal, en las bandas media y lejana (profundidad 4 o más), nunca en la barrera del río.
- La salida corta no tiene enemigos, ni la del tutorial ni la Expedición del día.
- `placeEnemies` en `exp-gen.js` las tira al final, con su propia suerte, y solo sobre casillas vacías: el resto del mapa
  queda igual que antes.
- Chance por casilla vacía: `EXP.enemy.chance` = 7 % en la banda media y 13 % en la lejana, con un tope de 2 por mapa.
  En promedio sale una por salida normal y un 62 % de los mapas tiene al menos una.
- La tirada de encuentro va por región, con su peso, en `REGIONS[r].enemies`:

  | Región | Encuentros |
  |---|---|
  | Bosque | Ojos en el monte 55 · La manada 45 |
  | Sierras | La manada 60 · La veta despierta 40 |
  | Bañado | Aguantar en el juncal 65 · La manada 35 |
  | Cerro | La veta despierta 55 · El minero atrapado 45 |
  | Costa | Saqueo en el muelle 100 |

- En el mapa se ve con una estaca con trapo rojo y lo que espera: lobos, bichos de veta o un pirata.

**La tarjeta** (al entrar, como un peligro).
- Muestra el encuentro, quiénes esperan (y si llegan más o hay que aguantar o rescatar) y quiénes pelean.
- Si el ánimo está en 3 o menos, avisa que llegan cansados: el grupo pelea con 2 de vida menos cada uno.
- **Pelear:** cuesta el paso más 1 provisión (`EXP.enemy.fightProv`). Dice qué se gana y qué cuesta perder o retirarse.
- **Resolver rápido:** solo para un encuentro común ya ganado (`canQuickResolve`, contando las victorias de antes y las de
  esta salida). Mismo costo, sin jugar: 1 estrella y el botín reducido (§6).
- **Retroceder:** gratis, como en los peligros.

**El grupo que pelea** (`fightParty`). Son los que salieron y, si son menos de 3, la **escolta**: roles que hay en la
ciudad y no salieron, primero los de nivel más alto (`mods.escort`). Si la ciudad no tiene a nadie, se completa con los
roles del tutorial. Con la Casa de Expediciones en nivel 1 o 2, el grupo es quien lidera y uno más, y así pierde casi
siempre: con el simulador, quien lidera con 1 rol gana entre el 0 y el 12 % de las comunes, con 2 entre el 43 y el 85 % y
con 3 más del 90 %.

**Consumibles** (`fightItems`). Llega el equipo del Taller que se llevó, con un uso por pelea. El Botiquín es el mismo de
la salida: si se usó en el camino, no llega, y si se usa en la pelea, ya no está para el camino.

**El traspaso.**
1. Pelear da el paso, cobra la pelea y arma la batalla en `run.battle` con `makeBattle`: el grupo, la escolta, los
   consumibles, el nivel de rol, el ánimo y el elemento.
2. Queda `run.pending = { kind: 'combate' }`, y todo se guarda en `state.expedition.active`.
3. `exp-scene` llama a `router.go('combat', { battle, expedition: true, guided, conditions, onSave, onEnd })`.
   - `conditions` lleva la hora, la noche, el clima y la banda de la casilla.
   - La escena juega sobre el mismo objeto que está guardado en la salida, así que `onSave` solo guarda la partida.
     Lo hace después de cada acción y de cada turno.
4. Al cerrar el resultado, `onEnd` llama a `endCombat(run, result)`, acredita la pelea en la ciudad (`creditFight`) y
   vuelve con `router.go('expedition', { resume: true, fightEvents })`.
5. La expedición anima lo que dejó: el botín que entra a la carga, o el grupo que vuelve caminando a la casilla anterior.

**Resultados.**
- **Ganar:** la casilla queda hecha y el botín entra a la carga. Si no entra todo, el resto queda en la casilla, como
  siempre.
- **Perder:** −3 de ánimo. El grupo vuelve a la casilla de la que vino y los enemigos se quedan ahí, para volver a probar.
- **Retirarse:** −1 de ánimo y también vuelve.
- Volver a la ciudad en medio de una pelea cuenta como retirada (`goHome`).
- En la expedición no hay "Reintentar" (`noRetry`): la casilla sigue ahí, pero cada intento cuesta.
- Si el ánimo llega a 0, la salida termina como siempre (`sin_animo`).

**Guardado y retomar.**
- La pelea vive en `state.expedition.active.battle`. Al abrir la expedición con una pelea en curso, se vuelve a la escena
  del combate en el mismo turno.
- Si se cerró en la pantalla de resultado, la pelea se acredita sin volver a abrirla.

**La ciudad** (`expedition.js`):
- `state.combat = { wins, losses, retreats, fights, quick, xp, guided }`, con victorias, derrotas y retiradas por encuentro.
  `xp` es la experiencia de quien lidera (para el paso 5b): no se suma a la del jugador.
- `creditFight` cuenta la pelea y da la página. La primera victoria contra los lobos da "Los lobos del arroyo" (p2); los
  jefes, la de `reward.page` y su marca.
- `creditFight` emite `combat:won`, `combat:lost` o `combat:retreat` con `{ enc, region, kind, outcome, reason, turns,
  stars, quick, guided, attempt, combos, downs, first, page }`. La historia escucha `combat:won` y `combat:lost`.
- `cityMods` pasa a la salida `combatWins`, `escort`, `elements` y `firstFight`.
- `stats.combats` y `stats.combatWins` llevan la cuenta.

**Primer combate guiado** (plan §E6).
- La primera salida normal al Bosque, si nunca se peleó, trae garantizada la pelea de los lobos (`FIRST_FIGHT =
  'bosque_claro'`) en la banda media (`EXP.enemy.firstDepth`).
- La primera pelea, sea cual sea, va guiada: la escena recibe `guided` y Vera habla en un panel abajo a la derecha, con su
  retrato.
- Son pistas de un solo uso (`GUIDE_TIPS` en `combat-scene.js`, anotadas en `state.tutorial.combatTips`):
  1. al empezar, cómo se pelea y cómo mover;
  2. después de mover, cómo actuar;
  3. después de actuar, el fin de turno;
  4. después del turno enemigo, las casillas marcadas;
  5. más adelante, los roles y los combos;
  6. cuando se anuncia uno, el refuerzo que llega.
- Las líneas del contacto `c_combate` se reparten entre esas pistas, y el contacto queda visto, así que la ciudad no lo
  repite.

**Telemetría.** `TRACKED_EVENTS` registra `combat:won`, `combat:lost` y `combat:retreat`: encuentro, región, tipo, motivo,
turnos, estrellas, intento, si fue rápida o guiada, si fue la primera, combos y caídos. Además, `expedition:combat` sale al
entrar a una pelea.

**Balance.**
- `exp-bots.mjs` no juega la pelea táctica, que la mide `sim-combat`. `simFight` usa lo que da ese simulador:
  - gana el 90 % de las veces el bot prudente, el 88 % el medio, el 86 % el codicioso y el 65 % el azar, con 15 puntos
    menos si el grupo está cansado;
  - las estrellas siguen la misma proporción.
- Los bots resuelven rápido lo ya ganado (salvo el codicioso), pelean si el ánimo alcanza y, si no, rodean.
- `sim-economy` cobra 4 minutos por pelea jugada y 10 s por la rápida. El bot juega una pelea por salida como mucho, y
  solo si el rato de 10 minutos tiene tiempo.
- Los resultados están en el Estado, al final.

**Pruebas.** `node tools/test-combat-exp.mjs`. Con `--node` corre solo la primera parte, en unos segundos.
1. **En Node:**
   - el generador: bandas, tope, encuentros de la región, solo sobre casillas vacías, nada en la corta, la misma semilla
     y la pelea guiada garantizada;
   - la tarjeta;
   - Pelear con el grupo, la escolta y los consumibles;
   - guardar a mitad de la pelea con JSON y retomar;
   - ganar, perder y retirarse;
   - la resolución rápida;
   - el grupo cansado;
   - volver a la ciudad en medio de una pelea.
2. **En Chrome headless:**
   - la casilla en el mapa y la tarjeta;
   - la entrada a la escena de combate, con la misma pelea guardada;
   - la guía de Vera y sus pistas;
   - guardar a mitad y recargar el juego;
   - ganar y volver con el botín, la página y el evento;
   - perder y retirarse;
   - la resolución rápida;
   - la telemetría.

**Capturas** en `shots/combate-exp/` (la carpeta no se sube):
- `1-casilla-en-el-mapa`;
- `2-tarjeta-enemigo`;
- `3-entrada-al-combate`;
- `4-primer-combate-guiado`;
- `5-casillas-marcadas-guia`;
- `6-vuelta-con-botin`;
- `7-vuelta-tras-derrota`.

## 14. Clases, subclases y nivel del líder (paso 5b, primera parte: la lógica)
Plan: M3 y L5 de `docs/PLAN-QUIEBRE.md`. Esta parte es solo lógica, sin interfaz ni modelos: la elección de clase en el
onboarding, la pestaña "Progreso" y los modelos por clase quedan para la segunda parte, después del 4a.

### 14.1 Las 6 clases
| Clase | Antes era | En combate | En la expedición | Edificio que la trae |
|---|---|---|---|---|
| Guerrero | nueva | primera línea: aguanta y protege | abre paso: +20 al despejar un derrumbe, +10 al cruzar un río | Casa de Expediciones 2 |
| Cazador | exploración | a distancia y marcar | visión 2, mejor con lobos y ruinas | Casa de Expediciones |
| Forjador | ingeniería | barreras y trampas | cruzar ríos y despejar derrumbes | Taller |
| Curandero | sanidad | curar y proteger | ánimo, descanso y Atender | Dispensario |
| Monje | guía | movimiento, empujar y esquivar | colinas, bañados, roca y tormenta | Establo |
| Saqueador | recolección | robar y romper | más material por recurso | Huerta |

- En la expedición, cada clase conserva **los mismos efectos** que su rol. Las decisiones usan el **nivel de oficio**
  (1 a 5, el nivel de su edificio, `run.tier`), con los mismos números de antes. Por eso `sim:expedition` no cambia.
- La ciudad tiene una persona por clase, como antes un rol por edificio. El Guerrero entra último en el grupo por defecto
  (`CLASS_PRIORITY`), así los grupos de siempre no cambian.

### 14.2 Nivel de clase (1 a 10)
- Experiencia total para cada nivel (`CLASS_XP`): 0 · 30 · 80 · 150 · 240 · 350 · 480 · 640 · 830 · 1050.
- **Tope:** el edificio entrena hasta 2 × su nivel. Con el edificio al 5 se llega al 10. La experiencia de más se guarda:
  al mejorar el edificio, el nivel sube solo.
- **De dónde sale:** cada pelea da su experiencia (20 a 100, `reward.xp` × resultado) a cada integrante que peleó,
  escolta incluida. Cada salida da su experiencia (`EXP_XP`: 10 + 5 por estrella) a los que fueron.
- **Qué da:** vida y ataque (§6), la 3.ª activa del grupo en el nivel 3, la 4.ª en el 6 y las pasivas en el 1, el 5 y
  el 9.

| Clase | Nivel 1 | Nivel 5 | Nivel 9 |
|---|---|---|---|
| Guerrero | Coraza: −1 a cada golpe | Protector: −1 a los de al lado | Temple: +3 de vida |
| Cazador | Rastreador: +1 intención a la vista | Ojo fino: marcas +1 | Pulso: +1 de ataque |
| Forjador | Oficio: el Martillo vale para sus trampas y barreras | Filo: trampas +1 | Obra firme: barreras +1 turno |
| Curandero | Botica: el Botiquín vale para sus curas | Mano firme: curas +1 | Entereza: +2 de vida |
| Monje | Paso libre: no se traba | Calma: +2 de vida | Pies de viento: +1 de movimiento |
| Saqueador | Bolsillo hondo: +1 material al ganar | Oportunista: +1 de botín por enemigo liquidado | Muñeca: +1 de ataque |

Las pasivas de nivel 1 de monje, curandero y forjador son las reglas que antes tenía el rol (no trabarse, el Botiquín y
el Martillo).

### 14.3 Elegir habilidades
`validPicks(clase, nivel, picks)` deja solo las abiertas y completa con las primeras del grupo. Se guardan en
`state.classes.members[clase].picks` (`setPicks`) y llegan a la pelea en `newBattle({ picks })`. La interfaz para
elegirlas es de la segunda parte.

### 14.4 El líder: nivel 1 a 30 (L5)
- **Experiencia para pasar del nivel n al n + 1:** `100 + 50 × (n − 1)`. Para el nivel 3 hacen falta 250; para el 5,
  700; para el 7, 1.350; para el 10, 2.700, y para el 30, 23.200.
- **De dónde sale:**
  - las peleas: su experiencia completa;
  - las salidas: ½ de la experiencia de la salida (de 5 a 13);
  - las amenazas aguantadas: `10 + 0,1 × %` (de 10 a 20), escuchando `threat:resolved`.

  La primera curva (`50 + 25 × (n − 1)` y 3 × la salida) llevaba al líder al nivel 11 el día 7 en `sim:economy`.
  `sim:economy` ahora muestra el nivel del líder en los días 7, 25 y 60 (resultado en §14.9). El paso 7 lo ajusta: la
  meta es llegar a la Costa con nivel 6 o 7.
- **Bonus chico por nivel:** vida y ataque (§6) y +1 de ánimo máximo en la expedición cada 10 niveles.
- **La clase del líder** sube sola con su nivel: nivel de clase `1 + ⌊(nivel − 1) / 3⌋` (1, 4, 7… → 1, 2, 3…; el 10
  llega en el 28). Con él se abren las pasivas y el grupo de 4 de su clase.
- **Niveles clave** (`LEADER.slots`): abren espacios de habilidad.

  | Nivel | Abre |
  |---|---|
  | 1 | la 1.ª habilidad de la subclase |
  | 5 | la 2.ª habilidad de la subclase |
  | 6 | la 1.ª activa de su clase (elegida del grupo) |
  | 8 | la pasiva de la subclase |
  | 12 | la 2.ª activa de su clase |
  | 15, 20, 25 y 30 | reservados para los actos 2 a 4 (otro elemento y habilidades del equipo) |

- **Stats del líder con clase:** vida `12 + (vida de la clase − 10)`, ataque `máx(2, ataque de la clase)` más el bonus
  por nivel, movimiento y ataque básico de su clase (el cazador tira de lejos).
- **Sin clase** (partida vieja, o nueva antes de la segunda parte del 5b) pelea como antes: Golpe y Raíz por los niveles
  1, 5 y 12.
- La primera prueba con los espacios de clase en los niveles 1 y 10 daba 98 % en el muelle y 83 % contra la capitana.
  Por eso la activa de clase llega recién en el 6.

### 14.5 Subclases del líder
Cada elemento descubierto abre la subclase de su clase con ese elemento. Cada una da 2 habilidades (en los niveles 1 y
5) y una pasiva (en el 8). Se cambia en la ciudad (`setSubclass`, no con una salida en curso). Si el líder tiene un
solo elemento, queda la subclase de ese elemento sin tener que elegir.

**Acto 1: Raíz** (hechas):

| Subclase | Clase | Habilidades | Pasiva |
|---|---|---|---|
| Guardián de Raíz | Guerrero | Abrazo de raíz (cuerpo a cuerpo: 2, quita el golpe, frena y levanta pared) · Muro de raíz | Corteza: +3 de vida |
| Acechador de Raíz | Cazador | Espina (distancia 2–4, +1 y frena) · Enredar | Ojos de raíz: +1 intención a la vista |
| Tejedor de Raíz | Forjador | Zarza (trampa de 3 que frena 2, a distancia 3) · Muro de raíz | Trenzado: paredes +1 turno |
| Herbolario de Raíz | Curandero | Savia (cura 3 al grupo a 2 o menos) · Enredar | Brotes: curas +1 |
| Caminante de Raíz | Monje | Brote (salta hasta 3 y deja una pared de raíz) · Enredar | Raíz ligera: +1 de movimiento |
| Furtivo de Raíz | Saqueador | Zarpa de raíz (2, quita el golpe, frena y suma botín) · Muro de raíz | Raíz codiciosa: +1 material al ganar |

**Diseñadas, sin implementar** (llegan con su acto; los números se calibran entonces):

| Elemento | Guerrero | Cazador | Forjador | Curandero | Monje | Saqueador |
|---|---|---|---|---|---|---|
| **Marea** (empuja y apaga el fuego) | Rompeolas: Ola de choque (empuja a los de alrededor) · Dique (pared de agua que frena) · pasiva: no lo pueden empujar | Arponero de Marea: Arpón (lo trae 2 casillas hacia él) · Niebla (−1 intención a la vista del enemigo) · pasiva: tiros +1 en agua | Esclusero: Compuerta (inunda o seca una franja) · Canal (agua que lleva una trampa) · pasiva: el agua no lo frena | Aguador: Manantial (cura 2 por turno en una casilla, 3 turnos) · Calma chicha (limpia el agua y el fuego al lado) · pasiva: curas +1 en agua | Monje de la Corriente: Corriente (corre a un aliado o enemigo 2 casillas por el agua) · Remolino (empuja en rueda) · pasiva: nada en agua sin costo | Contrabandista de Marea: Resaca (le roba y lo arrastra 1) · Bote (sale por el agua) · pasiva: +1 material en peleas con agua |
| **Brasa** (fuego y calor) | Yunque Ardiente: Golpe de brasa (+2 y quema 1 por 2 turnos) · Muralla de fuego (pared que quema al que la toca) · pasiva: −1 al daño de fuego | Tirador de Brasa: Flecha encendida (quema 1 por 2 turnos) · Bengala (muestra todas las intenciones por un turno) · pasiva: quemar +1 | Fundidor: Colada (trampa que quema) · Forja rápida (repara una barrera y la deja ardiendo) · pasiva: trampas +1 | Brasero: Calor (el grupo a 2 cura 2 y se saca la helada) · Cauterizar (cura 5 y limpia estados) · pasiva: estados −1 turno | Monje de Ceniza: Paso de fuego (salta y quema donde cae) · Humareda (los de al lado pierden el golpe) · pasiva: no lo traban ni lo queman | Incendiario: Mecha (deja una bomba que revienta al turno siguiente) · Saqueo en llamas (si lo liquida, +2 de botín) · pasiva: Romper quema |
| **Céfiro** (viento y altura) | Vendaval: Ráfaga (empuja en línea 2 casillas) · Escudo de viento (para los tiros por un turno) · pasiva: −1 a los tiros | Tirador del Viento: Tiro largo (distancia 2–6) · Ojo de halcón (desde lo alto, +2 y +1 intención) · pasiva: subir a lo alto cuesta 1 | Aparejador: Polea (sube a un aliado a lo alto) · Ancla (pared que corta la pasarela) · pasiva: barreras paran el viento | Soplo: Aire limpio (cura 2 a todos a 3) · Brisa (+1 de movimiento al grupo un turno) · pasiva: curas a distancia +1 | Monje del Cielo: Planeo (salta hasta 4) · Torbellino (empuja en rueda y frena) · pasiva: +1 de movimiento | Pirata del Cielo: Gancho (le roba a distancia 3) · Escape (cambia de lugar con un aliado lejos) · pasiva: +1 material contra piratas |

Para sumar un elemento hacen falta: sus habilidades en `ABILITIES` (los tipos nuevos que pidan, como quemar o inundar,
en `combat-rules`), sus 6 entradas en `SUBCLASSES` y el elemento en `ELEMENTS`.

### 14.6 Estado de la partida (`src/core/classes.js`)
```
state.classes = { v: 1, leader: { cls, sub, xp, picks }, members: { [clase]: { xp, picks } } }
```
- **Lectura:** `classTier`, `classCap`, `memberLevel`, `memberInfo`, `cityClasses`, `leaderLevel`, `leaderInfo` (con lo
  que falta para el próximo nivel y el próximo nivel clave) y `leaderMods`.
- **Escritura:** `grantClassXp`, `grantLeaderXp`, `setLeaderClass`, `setSubclass`, `setPicks`, `setLeaderPicks`,
  `creditFightXp` y `creditExpeditionXp`.
- **Eventos:** `class:levelup`, `leader:levelup` y `leader:changed`. `initClasses()` (lo llama `initExpedition`)
  escucha `threat:resolved`.
- **La expedición** (`cityMods` de `expedition.js`) pasa a la salida `mods.tier`, `mods.classLevel`, `mods.picks` y
  `mods.leader`. `makeBattle` arma la pelea con el nivel real del líder.
- **Se acredita** en `creditFight` (pelea) y en `finishExpedition` (salida).

### 14.7 API del motor
`newBattle({ party, level, leader: { cls, sub, picks }, classLevel, picks, elements, … })`. `party` son clases; los roles
viejos y `roleLevel` (1..5) se traducen solos: rol de nivel n = clase de nivel 2n − 1. Las unidades del grupo tienen
`cls`, `lv` y las pasivas en `u.f`. La pelea suma `b.leader`, `b.intentPlus` y `b.lootWin`. Las estadísticas de daño y
golpes finales van por clase (`lider` para el líder). El motor sigue siendo JSON puro y determinista.

### 14.8 Migración (`src/core/classes-migrate.js`)
`migrateClasses(save)` corre desde `migrate()` de `state.js` antes de `deepFill`, una sola vez (marca
`state.classes.v`), sin depender de la versión del guardado. **No sube la versión:** la v5 la sube el 4a.
1. Cada clase arranca con la experiencia del nivel `2 × nivel del edificio − 1`. En combate rinde igual que antes.
2. El líder junta `combat.xp + 30 × salidas + 20 × amenazas`, sin clase: la elige la primera vez que abre la ciudad
   (segunda parte del 5b).
3. La salida y la pelea guardadas a medias pasan sus roles a clases: grupo, escolta, niveles (`roleLevel` → `tier`),
   unidades con sus pasivas de nivel 1 y estadísticas. También el último grupo y el cansancio.

### 14.9 Pruebas y balance
- `node test-classes.mjs`: 78 bien, 0 mal (64 en Node y 14 en Chrome headless; `--quick`, solo Node). Cubre:
  - datos, curvas, kits, pasivas y habilidades nuevas;
  - subclases de Raíz y nivel del líder;
  - combate y expedición con clases;
  - migración cruda y migración de una partida vieja al cargar en el juego;
  - experiencia por pelea, por salida y por amenaza.
- `node test-combat.mjs`: 102 bien. El grupo del tutorial contra los jefes pide ahora un mínimo de 10 % (antes 20 %):
  el grupo esperado de la Costa ya tiene nivel de clase 4 y el del tutorial queda más lejos. La duración de los jefes se
  mide con el grupo esperado con clases.
- `node test-combat-exp.mjs`: 75 bien. `test-cycle`: 61. `test-migration`: 63. `test-expedition`: 30.
- `sim:combat`: todas las metas (§8).
- `sim:expedition`: las mismas metas en ✔ y en ✘ que en master, con los mismos números.
- `sim:economy` (semilla 1): 18 ✔ y 2 ✘, las mismas dos que ya fallaban en master ("preparación al llegar" y "la
  automática daría"). Con las semillas 4 a 8 suma lo mismo que master: 84 ✔. Muestra el nivel del líder: 3 el día 7,
  5 el día 25 y 9 el día 60. A la Costa (rango 6) se llega con nivel 5 o 6; el encuentro espera 6 o 7 (paso 7).
- `test-e2e`: 89 bien y 7 mal, las mismas 7 del Pase de Temporada que fallan en master. `test-combat-scene` 29,
  `test-threats` 79, `test-settings` 77, `test-stress` 15, `test-ambience` 65 y `test-telemetry` 67, sin fallas.
- `test-story`: 94. La flecha de t14 a veces tarda más de 1 s: el test ahora la espera hasta 4 s en lugar de un
  `sleep(900)` fijo.

### 14.10 Para la segunda parte del 5b (después del 4a)
- **Onboarding:** elegir la clase del líder (`setLeaderClass`). En una partida vieja (`leader.cls === null`), la primera
  vez que abre la ciudad.
- **Interfaz:**
  - pestaña "Progreso" de la Bitácora con `leaderInfo()` y `memberInfo()`;
  - elegir las activas (`setPicks` y `setLeaderPicks`);
  - cambiar la subclase en la ciudad;
  - nombres de clase en el panel de Expedición: hoy usa `ROLES` y `ROLE_IDS`, que quedan como alias de `CLASSES`.
    El Guerrero bloqueado dice "Construí Casa de Expediciones"; tiene que decir "nivel 2".
- **Modelos:** `combat-scene` y `exp-scene` pueden pasar `u.cls` y la clase a `avatarModel(look, { cls })` del 4a.
  `ROLE_CLASS` del 4a coincide con el de `src/combat/classes.js`.
- **`combat-scene`:** hoy acepta `roleLevel` por la URL. Sumar `classLevel`, `leader` y `picks`.
- **Paso 7:** el líder cazador (38 % del daño), el curandero (el simulador gana menos con él) y la curva del líder en
  `sim:economy`.

## 15. La gente de la ciudad, el Vínculo, las herramientas y la pestaña Progreso (paso 5b, segunda parte)
Plan: L5 de `docs/PLAN-QUIEBRE.md`. La elección de clase en el onboarding y el aspecto de cada clase esperan al 4a
(§14.10).

| Archivo | Qué es |
|---|---|
| `src/core/people-data.js` | Personas, encargos, herramientas, costos y efectos en la expedición. Puro |
| `src/core/people.js` | `state.people`: llegadas, Vínculo, encargos, nivel de cada herramienta y los eventos |
| `src/scenes/panels-progress.js` | Pestaña "Progreso" de la Bitácora |
| `tools/test-people.mjs` | Node y Chrome headless (§15.6) |

### 15.1 Quiénes llegan
| Persona | Llega | Herramienta | Material para mejorarla |
|---|---|---|---|
| Vera, cartógrafa | desde el inicio | Catalejo | mineral |
| Brígida, herrera | rango 2 | Martillo | mineral |
| Nahuel, subió del Bajo Mundo | la primera zona del Bosque explorada | Cuerda | madera |
| Olga, curandera | rango 3 | Botiquín | hierbas |
| Ramiro Ochoa, ex guardia de las Casas | rango 5 | Farol de guardia | madera |

- **Al llegar** dicen 2 líneas y dejan un dato del mundo, con una escena de historia (`llega_<id>`). Sale cuando la
  ciudad está tranquila, de a una, y después de las escenas de la historia. Si otra escena la tapa, vuelve a salir después
  (`showNextArrival`). Vera ya está desde el prólogo: no tiene
  escena.
- **Retratos:** hoy usan el de Vera (`cartografa`) o la cara vacía. Los demás retratos serios los hace el 4a, con los
  ids `brigida`, `nahuel`, `olga` y `ramiro` (`who` en `PEOPLE`).

### 15.2 Vínculo 1 a 5 y encargos
- Cada persona llega con Vínculo 1 y tiene 4 encargos, uno por nivel.
- **Tipos de encargo:**
  - volver de N salidas (de una región, si lo dice);
  - explorar N zonas;
  - ganar N peleas;
  - aguantar N amenazas;
  - entregar materiales (con el botón "Entregar" de Progreso);
  - una marca de la historia (`bestia_vencida` o `capitana_vencida`).
- **Decisión:** los encargos viven en `people.js` y no en la cadena de misiones, porque `src/core/quests.js` lo tiene
  abierto la sesión de la Raíz (E5). Para sumarlos a la cadena hay que leer `currentTask(id)` desde `quests.js`.
- Los encargos avanzan con los eventos `expedition:finished` (la práctica no cuenta), `expedition:zone`, `combat:won` y
  `threat:resolved`. Las marcas de la historia se revisan con `quests:changed` y `reward:page`.

### 15.3 Herramientas 0 a 5
- Llegan en nivel 1 con su dueño. Cada nivel de Vínculo deja subir un nivel más.
- **Se mejoran en el Taller** (hace falta tenerlo construido). Ir al nivel `n` cuesta `60 × n` monedas y `n + 1` de su
  material: al nivel 2, 120 monedas y 3 de material; al 5, 300 y 6.
- **Combate:** `b.tools` con las tablas que ya existían (`COMBAT.catalejo`, `trapBonus`, `climb`, `healBonus` y
  `guard`, §6). La expedición las manda en `mods.tools`.
- **Expedición** (`TOOL_EXP`; los simuladores no las usan, así que no cambian):
  - Catalejo: +1 de visión desde el nivel 3, y +3 por nivel en "pasar en silencio" y en "revisar a fondo".
  - Martillo: +4 por nivel en "despejar".
  - Cuerda: +3 por nivel en "cruzar" y +4 en "trepar".
  - Botiquín: ánimo máximo `+⌊nivel / 2⌋`.
  - Farol: +3 por nivel en "seguir con tormenta".
- **Ciudad: queda para el paso 7** (decisión de esta noche). El Martillo tiene que dar obras más baratas y el Farol más
  preparación contra las amenazas. Las dos cosas tocan los costos de `economy.js` y la preparación de `src/threats`, y
  hay que balancearlas con `sim:economy` y `sim:threats`.
- **Ninguna herramienta es obligatoria:** las peleas comunes ya pasan del 85 % sin ninguna (§8).

### 15.4 Pestaña "Progreso" de la Bitácora
Cada fila dice qué falta para el próximo nivel:
- **la ciudad:** rango y Época, con los requisitos que faltan;
- **quien lidera:** nivel, barra de experiencia, clase y subclase, y el próximo nivel clave;
- **el grupo:** nivel de cada clase, con el tope del edificio;
- **la gente y sus herramientas:** el Vínculo, el encargo con su avance, el nivel de la herramienta y qué hace, y los
  botones "Entregar" y "Mejorar". Quien todavía no llegó aparece cerrado, con cuándo llega;
- **el mundo:** elementos, la Grieta y las páginas del diario.

**El nivel del líder también se ve:**
- en el panel de Expedición: "Nombre · nivel N", con la clase;
- en un aviso cuando sube (`leader:levelup`).

Hay avisos cuando sube un Vínculo o una herramienta. El Guerrero bloqueado ahora dice "Construí Casa de Expediciones
nivel 2".

### 15.5 Estado guardado
```
state.people = { v: 1, list: { [id]: { arrived, met, bond, n, tool } } }
```
`peopleState()` lo completa en una partida vieja, sin subir la versión del guardado. Una partida vieja recibe a quien
ya cumple la condición de llegada (por ejemplo, a Brígida en el rango 2) y le muestra la escena.

### 15.6 Pruebas
`node test-people.mjs` (con `--quick`, solo Node): 31 bien, 0 mal. Cubre:
- los datos y el tono;
- los costos;
- los efectos en la expedición y en el combate;
- en el juego:
  - Vera con su Catalejo desde el inicio;
  - encargos de salida, de zona, de entrega y de historia;
  - el Vínculo como tope de la herramienta y la mejora en el Taller;
  - la llegada de Brígida y Olga con su escena;
  - las herramientas y el nivel real del líder en la salida;
  - la pestaña Progreso completa y mejorar desde ella;
  - el nivel del líder en el panel de Expedición.

## Estado
- **Paso 5b, segunda parte** (la gente de la ciudad, el Vínculo, las herramientas, el nivel del líder visible y la
  pestaña Progreso, §15): **hecha** en la rama `claude/progreso-5b2`, sin mergear. Falta lo que espera al 4a (§14.10) y
  la parte de ciudad de las herramientas (paso 7, §15.3). Para integrar: sumar `"test:people": "node test-people.mjs"` y
  `node test-people.mjs` a `npm test`.
- **Paso 5b, primera parte** (la lógica de clases, subclases y nivel del líder, §14): **hecha** en la rama
  `claude/clases-5b-7cbe71`, sin mergear. No sube la versión del guardado ni corre `npm run bump`.
  - Para integrar: sumar a `tools/package.json` el script `"test:classes": "node test-classes.mjs"` y
    `node test-classes.mjs` a `npm test`, y correr `npm run bump`.
  - Lo que sigue (segunda parte, después del 4a) está en §14.10.
- **Paso 5, primera parte** (motor puro, tests, simulador y este documento): **hecho** e integrado en v32.
- **Paso 5, segunda parte** (escena, interfaz, modelos de enemigos, prueba headless y capturas): **hecha** en la rama
  `claude/combat-scene-02dc34`, sin mergear. Ya trae master (v33, con el 3b) adentro.
- **Paso 5, tercera parte** (casilla `enemigo`, traspaso, primera pelea guiada, telemetría y balance, §13): **hecha** en la
  rama `claude/combate-expedicion-ed9cb7`, que sale de la segunda parte y trae master. Sin mergear.
  - `node test-combat-exp.mjs`: 75 bien, 0 mal (35 en Node y 40 en Chrome headless).
  - Siguen bien, cada una corrida sola: `test-combat-scene` 29, `test-combat --quick` 92, `test-expedition` 30,
    `test-cycle` 61, `test-telemetry` 67 y `test-story` 94.
  - `test-cycle` ahora rodea las casillas `enemigo` en su camino.
  - `test-story` falla una vez cada tanto, también en la rama sin cambios (una flecha o el premio del día, según la
    corrida).
- **Balance con el combate** (las mismas metas que antes, comparado contra la rama sin cambios):
  - **`sim:expedition`:** las mismas metas en ✔ y en ✘ que antes. La única que cambia es "medio saca 3★ en 25–40 %" del
    prototipo, que pasa de 39,2 % a 40,4 % con 500 salidas. Es ruido: con 2000 salidas da 34,3 % sin combate y 35,3 %
    con combate.
  - **`sim:economy`** (semilla 1): 18 ✔ y 2 ✘, igual que antes. Las dos que fallan ya fallaban: "monedas al llegar" y
    "la automática daría".
  - **Con 8 semillas:**
    - los materiales de la expedición quedan iguales: 57,4 por día sin combate y 57,5 con combate;
    - el botín de combate es chico: de 0 a 0,3 materiales por día, con 0 a 3 peleas jugadas en 60 días, porque cada una
      cuesta 4 minutos del rato;
    - la preparación ante las amenazas baja unos 3 puntos (de 70 % a 67 %). Esa meta ya fallaba en la mitad de las
      semillas, y la diferencia sale de dónde el bot de la ciudad pone las defensas: las corridas se separan desde el
      día 1.
- **Para integrar:**
  - sumar a `tools/package.json` el script `"test:combat-exp": "node test-combat-exp.mjs"`;
  - sumar `node test-combat-exp.mjs` a `npm test`, con la escena;
  - correr `npm run bump`.
