# Combate táctico por turnos (El Quiebre, paso 5)

Plan: [docs/PLAN-QUIEBRE.md](docs/PLAN-QUIEBRE.md), §C (combate), §I (principios y balance) y §L5 (herramientas y nivel
del líder). Cubre el motor puro (§1–§10) y la escena con su interfaz (§11). La casilla `enemigo` de la expedición y el
traspaso entre las dos escenas quedan pendientes (§12).

| Archivo | Qué es |
|---|---|
| `src/combat/combat-data.js` | Todos los números: unidades, habilidades, elementos, consumibles, enemigos, encuentros, desafíos y combos |
| `src/combat/combat-rules.js` | Motor puro y determinista: sin DOM, sin three.js y sin `Math.random` |
| `tools/test-combat.mjs` | Pruebas en Node: `node test-combat.mjs` (con `--quick` saltea las corridas largas) |
| `tools/sim-combat.mjs` | Simulador con una IA de jugador: `node sim-combat.mjs [--n 40] [--only id] [--tools]` |
| `src/combat/combat-scene.js` | Escena `combat` en 3D: campo, unidades, casillas marcadas, animaciones y entrada |
| `src/combat/combat-ui.js` | Interfaz DOM: objetivo, orden del turno, fichas, barra de acciones, vista previa, menú y resultado |
| `src/combat/enemy-models.js` | Modelos vóxel de los enemigos del Acto 1 |
| `tools/test-combat-scene.mjs` | La escena en Chrome headless (SwiftShader): teclado, mouse, turno enemigo y una victoria |

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
El rol define el kit (§C del plan). La recarga se cuenta en turnos propios: con recarga 1, se usa un turno sí y uno no.

| Unidad | Vida | Mover | Ataque | Habilidades (recarga) |
|---|---|---|---|---|
| Líder | 12 | 3 | 3 | Golpe; habilidades de elemento según nivel |
| Exploración | 8 | 3 | 2 | Tiro 2–3 (4 desde lo alto); Marcar (2): el próximo golpe que reciba hace +3 |
| Ingeniería | 10 | 3 | 3 | Golpe; Trampa (2): 3 de daño y frena; Barrera (3): pared por 3 turnos |
| Sanidad | 9 | 3 | 1 | Golpe; Curar (1): 4 a distancia 2; Aliento (4): 2 a todos a distancia 2 |
| Recolección | 10 | 3 | 2 | Golpe; Romper (2): +2, atraviesa y rompe corazas, parte rocas, doble contra la pasarela; Robar (3): le saca el golpe marcado y suma botín |
| Guía | 10 | 4 | 3 | Golpe; Empujar (1): una casilla, 2 si choca, cae en trampas; Relevo (3): cambia de lugar con un aliado a distancia 3 |

- Con un rescate en curso, cualquiera del grupo puede **Liberar**.
- **Nivel de rol** (de la expedición): +1 de vida por nivel sobre 1 y +1 de ataque cada 2 niveles.

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
- **Líder por nivel** (1 a 30):
  - vida: `+⌊(nivel − 1) / 2⌋`;
  - ataque: `+⌊(nivel + 2) / 6⌋`, o sea +1 en el nivel 4 y +2 en el 10;
  - espacios de elemento: en los niveles 1, 5 y 12.
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
Bañado y 6 o 7 en la Costa. La Raíz entra desde el Bañado. Todas las combinaciones de 3 roles.

**Grupo del tutorial** (`TUTORIAL_PARTY`). El líder de nivel 1, sin herramientas ni elemento, con exploración,
ingeniería y sanidad.

## 8. Metas y resultados del simulador
`node sim-combat.mjs --n 40 --tools` corre 40 peleas por cada una de las 10 combinaciones de 3 roles. Son 400 por
encuentro y 400 por intento en los jefes, unas 4.500 peleas en total, en unos 80 s.

| Pelea | Meta | Resultado |
|---|---|---|
| Ojos en el monte | 85–95 % | 93,0 % ✔ (7,8 turnos) |
| La manada | 85–95 % | 92,8 % ✔ (6,8) |
| La veta despierta | 85–95 % | 91,8 % ✔ (9,1) |
| El minero atrapado | 85–95 % | 92,3 % ✔ (7,1) |
| Aguantar en el juncal | 85–95 % | 91,8 % ✔ (5,0) |
| Saqueo en el muelle | 85–95 % | 94,0 % ✔ (7,8) |
| Bestia, 1.º intento | 45–65 % | 58,5 % ✔ |
| Bestia, 3.º intento | ≥ 85 % | 91,3 % ✔ (ganada al 3.º o antes: 99,4 %) |
| Bestia, duración | 6–12 turnos | 8,5 ✔ |
| Capitana, 1.º intento | 45–65 % | 55,3 % ✔ |
| Capitana, 3.º intento | ≥ 85 % | 93,8 % ✔ (99,5 %) |
| Capitana, duración | 6–12 turnos | 9,7 ✔ |

**Aporte por rol.** Es el promedio por pelea en la que está cada uno. La meta es ≤ 35 % del daño y de los golpes
finales.

| Rol | Daño | Golpes finales |
|---|---|---|
| Líder | 22,1 % | 28,5 % |
| Exploración | 34,8 % | 22,6 % |
| Ingeniería | 31,8 % | 26,4 % |
| Sanidad | 1,3 % | 4,3 % |
| Recolección | 29,2 % | 25,0 % |
| Guía | 32,9 % | 28,5 % |

Todos cumplen. Sanidad aporta curando, no pegando.

Cada encuentro favorece a un rol distinto:
- exploración, contra lobos (≈ 45 %);
- recolección, contra bichos (≈ 42 %);
- exploración, contra la bestia (≈ 59 %).

Ningún camino único gana siempre. Contra la bestia, los grupos sin nadie a distancia ganan menos.

**Herramientas en nivel 3.** % de peleas ganadas, primer intento contra los jefes:

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
- **Casilla `enemigo` y traspaso con la expedición:**
  - `CONTENT` en `exp-data.js` y `exp-gen.js`, en las bandas media y lejana;
  - `exp-scene` guarda `active.battle` y llama a `router.go('combat', { battle, conditions: combatConditions(…), onSave,
    onEnd })`;
  - `onEnd` vuelve a `router.go('expedition', { resume: true })`;
  - si perdiste, volvés a la casilla anterior y el ánimo baja según `result.morale`;
  - el botín entra a la carga.
- **Resolución rápida:** el botón va en la tarjeta de la casilla `enemigo`, antes de entrar (`canQuickResolve`).
- **Integrar:**
  - sumar `test-combat-scene` a `npm test` y un script `test:combat-scene` en `tools/package.json`;
  - correr `npm run bump`.
- **Sonido** (paso 3c): hoy usa los `sfx` que hay (`bump`, `crash`, `horn`, `combo`…) y la música `threat`. El 3c puede
  sumar golpes propios y una pista de combate.
- **Telemetría** (paso 7): victoria, derrota, turnos y retirada. Escuchar `combat:end`.
- **Paso 5b, L5:** de dónde salen `tools`, `level` y `element`:
  - `tools` sale de los Vínculos;
  - `level` sale de la experiencia del líder;
  - `element` sale de los elementos encontrados.
- **Paso 7:**
  - revisar que la Cuerda no quede obligatoria contra la bestia;
  - meter el botín de combate en `sim:economy`.

## Estado
- **Paso 5, primera parte** (motor puro, tests, simulador y este documento): **hecho** e integrado en v32.
- **Paso 5, segunda parte** (escena, interfaz, modelos de enemigos, prueba headless y capturas): **hecha** en la rama
  `claude/combat-scene-02dc34`, sin mergear. Ya trae master (v33, con el 3b) adentro.
- **Falta:** la casilla `enemigo` y el traspaso con la expedición (§12).
