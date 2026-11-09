# Pixelia · "La Travesía": arreglos de arte, mapa de islas, expedición por rutas, niveles, maestría, cuartel y guía interactiva

Plan aprobado por el usuario el 2026-11-09. El estado está en [HANDOFF-TRAVESIA.md](HANDOFF-TRAVESIA.md).

## Contexto
El usuario jugó el Acto 1 (v52) y marcó dos cosas. El arranque tiene misterio y épica, pero al empezar las expediciones
el juego se vuelve insulso. Además hay arte que se ve mal. Lo que pidió:
- Armas metidas en el cuerpo y armaduras de clase que se superponen con él.
- Íconos que son emojis pixelados: hay que reemplazarlos por íconos originales, revisados con criterio.
- Sacar Mi Casa.
- Cinemática con más contexto, personajes que actúen e interactúen, y que se entienda qué es cada cosa.
- Una expedición enganchante y fácil de entender, que sume complejidad con el avance.
- Niveles de jugador, maestría de armas y objetos, y un mapa de islas que se desbloquea por nivel o fuerza (tipo
  Minecraft Dungeons).
- Un cuartel con la gente que reclutás.
- Guía de Vera interactiva para cada sistema nuevo.
- Cinemáticas al llegar a cada isla.
- La música épica de la cinemática se cambia más adelante con Suno: el usuario pasa la clave.

**Decisiones del usuario:**
- Expedición = **travesía por rutas** (mapa ramificado tipo Slay the Spire / FTL).
- Cuartel = **elegir escuadra + mandar al resto a encargos**.
- Islas con **fuerza recomendada**: se puede entrar con menos, con aviso, y se gana más botín.
- Orden: **arreglos primero, después lo nuevo**.

## Causas encontradas (para no reinvestigar)
**Armas** (`GEAR` en `src/avatar/figure.js:892-990`). Los astiles van sobre el eje del propio brazo, así que atraviesan
el puño, el antebrazo y la hombrera:
- hacha: astil en `x∈[-1,1) z∈[-1,1)`, y el pico apunta al torso;
- bastón y lanza: `z∈[0,2)` dentro del brazo;
- cuerda del arco: dentro del antebrazo;
- bolso: en el torso, justo en la cara interna del brazo;
- catalejo: pisa una columna del brazo;
- escudo: se mete en la riñonera.

Los largos son fijos (bastón 44, lanza 57), así que en enanos y anuros atraviesan el piso. Solo `HY(D)` y `front(D)` se
adaptan al cuerpo. Espada y martillo están bien.

**Armaduras.** Casi todas son color sobre los mismos vóxeles. Las piezas con geometría propia fallan así:
- Hombrera (`figure.js:371-383`): está en la grilla del brazo, debajo del hombro y no encima, y rota con el brazo.
- Faldones (`drawSkirt :416-437`): el pivote casi no se mueve y las piernas lo atraviesan al caminar.
- Capucha (`:818-825`): se mete en la espalda de los orcos.
- Manto (`:309-318`): pisa las columnas del brazo.
- Mochila y capa: comparten la celda z=-9.
- `armX` cae en medio vóxel cuando `armW` es impar.

**Íconos** (`src/core/icons.js`):
- 38 DEFS dibujados con la paleta pastel vieja.
- Todo lo que no está en DEFS pasa por `drawEmoji`, que pixela la fuente de emojis del sistema.
- `ALIAS` copia diseños de emoji.
- Hay unos 146 emojis únicos fuera del álbum y 108 en Hallazgos.
- DESIGN.md:131 recomienda usar emojis pixelados, y esa regla se cambia.

**Expedición** (`src/expedition/*`): grilla fija de 7×9 en la que las zonas casi no cambian nada. Hay mods escritos que
nunca se cablearon: `regionBonus`, `findMult` y `miradorBonus`. Las regiones solo dependen del rango
(`regionOpen`, `expedition.js:106`).

**Progresión:**
- Hay dos niveles: `state.player.level` (rango, catálogo, Mi Casa) y el nivel del líder (`state.classes.leader`, 1–30,
  combate).
- No existe maestría de armas.
- La escuadra son clases anónimas, una por edificio.
- Las 5 personas con nombre solo aportan su herramienta.
- Ya existe un "Cuartel de Bomberos".

**Cinemática** (`src/scenes/intro.js`):
- Seis planos de unos 8 s, cámara de dos puntos y una línea de texto por plano.
- Ninguna etiqueta dice qué es cada cosa.
- Las figuras ya tienen brazos, piernas y cabeza articulados (`userData.parts`), pero solo caminan.
- `story/echo-fx.js` ya tiene poses con utilería: es el precedente para actuar.

**Guía:** hoy hay tarjeta de Vera, flecha (`guideTarget`, `city.js:578`) y pista. No hay oscurecido ni recorte.

## Cómo se trabaja
- **Autonomía total.** El usuario dio el sí para todo lo que haga falta: instalar, commit, push, sesiones, tags.
  Siguen valiendo las reglas de CLAUDE.md sobre Supabase.
- **Documentos.** Al empezar se crean dos:
  - `docs/PLAN-TRAVESIA.md`: este plan más la investigación de modos de juego;
  - `docs/HANDOFF-TRAVESIA.md`: dónde quedó cada paso.
- **Sesiones.** Una por paso, en su worktree. Esta sesión es la **orquestadora**: arma los briefs, integra cada rama
  (`npm run bump`, `npm test`, commit, push) y abre las sesiones siguientes.
- **Regla de contexto nueva (pedido del usuario):**
  - Una sesión que pasa el **40 %** de contexto para en ese mismo momento.
  - Antes de parar commitea lo que tenga como WIP en su rama y anota en el HANDOFF dónde quedó.
  - El orquestador abre enseguida **una sesión nueva fresh** que sigue lo mismo desde ese punto.
  - Antes de asignarle algo nuevo a una sesión, el orquestador mira su uso con `get_usage`.
  - Primer paso al salir del plan: actualizar la memoria `context-handoff-sessions.md`, que hoy dice 40–45 %.
- **Avisos.** PushNotification al cerrar cada paso, en cada handoff y al trabarse.
- **GPU.** Siguen sus reglas: 60 FPS como máximo, corridas cortas y cortar a ~70 °C.

## Rumbo del juego: la aldea es el hogar, la aventura está afuera
El usuario quiere que la aldea sea tu hogar, pero que no sea donde pasa todo el juego. Eso ordena todo el Bloque 2.
- **El centro del juego pasa al archipiélago.**
  - En el HUD, la acción principal es **"Zarpar"**, que abre el mapa de islas. Construir queda como secundaria.
  - La historia principal (misiones t*, capítulos) pasa a ocurrir en las islas. Las misiones de la ciudad quedan para
    preparar la salida.
- **La aldea es la base que te prepara.**
  - Sus edificios dan capacidades para la travesía:
    - el **Muelle** mejora el esquife: más alcance para llegar a islas lejanas y más provisiones;
    - la **Forja** (el Taller) mejora, rehace y desarma armas;
    - el **Cuartel** maneja la escuadra y los encargos;
    - el **Santuario** maneja los elementos (ver abajo);
    - la **Cocina** (la Huerta) arma las provisiones.
  - Lo cozy queda: construir, el día y la noche, las amenazas con resolución automática. Pero son ratos cortos entre
    salidas, no la tarea principal.
- **Volver a casa se siente.**
  - Al regresar, una escena corta: el esquife amarra y la gente sale a recibirte.
  - Después, el resumen: botín, encargos que volvieron, lo que se construyó.
- **La economía cambia de fuente.**
  - La ciudad produce lo básico.
  - Lo valioso (armas, materiales de mejora, elementos) sale de las islas.
  - `sim:economy` se ajusta a eso: la meta es que la mayor parte del avance salga de la travesía.
  - En la Fase de Bloque 2 se revisan las metas de DESIGN-CORE §8.
- **Primeros minutos.** Después de la llegada con Vera, la ciudad se presenta en pocos pasos: construir lo mínimo, el
  Muelle y zarpar. La primera isla llega mucho antes que hoy.

## Los elementos, protagonistas (pedido del usuario)
Hoy solo existe la Raíz, con sus subclases, la Grieta y la decisión de cuánto sacar. Marea, Brasa y Céfiro están
diseñadas en DESIGN-COMBAT:811-820, pero no están hechas.

Los cuatro tienen que sentirse en todo el juego.
- **Cada isla tiene una veta.** El mapa marca de qué elemento es cada isla. Eso decide:
  - sus enemigos y su regla propia (Bañado → Marea, Cerro → Brasa, Sierras → Céfiro, Bosque → Raíz);
  - su botín elemental.
- **Hay ecos de los elementos desde el Acto 1, sin romper el canon.**
  - La Raíz es tuya: es el elemento del Acto 1, como hoy.
  - De los otros tres aparecen **fragmentos de veta** en su isla. Dan una versión menor y temporal, que dura esa salida
    como una reliquia. Así se prueban antes de tenerlos de verdad.
  - El elemento entero se gana en su arco de historia: Marea en el Acto 2, Brasa en el Acto 3 y Céfiro en el Acto 4.
- **Reacciones elementales en el combate** (`combat-rules.js`, motor puro). Las casillas toman estado y los estados se
  combinan, para que el terreno sea un rompecabezas:
  - Raíz enreda y levanta pared;
  - Marea moja y empuja;
  - Brasa quema;
  - Céfiro sopla y electriza.
  
  Algunos ejemplos de combinación:
  - mojado + Céfiro = descarga en cadena;
  - Raíz + Brasa = incendio que se expande;
  - Marea + Brasa = vapor que tapa la visión;
  - Céfiro + Brasa = fuego que salta casillas.

  Las combinaciones se descubren y se anotan en el Manual (principio I del plan viejo).
- **Las armas tienen afinidad elemental.** Es un rasgo de rareza, y la maestría del arma con su elemento abre la
  reacción propia del arma.
- **Santuario en la aldea.**
  - Es el edificio donde se ven y se mejoran los elementos. Cada uno tiene un árbol corto que se paga con esencia
    farmeada en sus islas.
  - La isla cambia a la vista con cada elemento: raíces que brillan, agua que corre, braseros, molinos. Esto ya existe
    para la Raíz y se generaliza.
- **En la travesía:**
  - nodos de **veta**, donde se elige cuánto sacar con el riesgo de la Grieta (se generaliza la decisión de la Raíz de
    `raiz-ui.js`);
  - eventos propios de cada elemento;
  - un jefe por elemento.
- **En las cinemáticas:**
  - la nueva presenta las cuatro vetas con su etiqueta y su color;
  - cada llegada a una isla arranca mostrando su veta.
- **Dónde va:** el 2a suma la afinidad de las armas. Un paso nuevo, el **2d**, hace las reacciones, el Santuario, los
  fragmentos y los nodos de veta, y va después del 2c porque usa los nodos y la escena. El balance va en `sim:combat`:
  las reacciones no pueden superar el 35 % del daño, una regla que ya existe por rol.

## El juego es de farmeo: qué cambia en el plan
Pixelia es para ratos cortos y repetidos. Por eso la travesía tiene que dar ganas de **repetir** islas, no solo de
pasarlas una vez. Los ajustes van dentro de cada paso:
- **Botín que vale la pena repetir (2a y 2c).**
  - Cada isla publica su **tabla de botín** en el mapa: materiales, tipos de arma, rarezas y la **pieza única de su
    jefe**. Así se puede ir a buscar algo concreto.
  - Hay contador de suerte: la pieza única sale segura cada N jefes sin que salga.
  - Armas con rasgos al azar. En el Taller se **rehace un rasgo** y se **desarma** lo que sobra para sacar materiales.
  - Hay **conjuntos** de 2–3 piezas por isla con bono.
  - Filtro de botín: desarmar solas las armas de cierta rareza para abajo.
- **Dificultad escalonada para farmear (2c).**
  - La Marea del Quiebre tiene niveles I a X por isla: cada nivel sube la fuerza de los enemigos y la calidad del botín.
  - **Endgame (después del Acto 1):** la **Grieta profunda**, una travesía sin fin que escala por piso. Tiene récord
    personal y deja comparar con los contactos (visitas online).
- **Salidas rápidas sobre lo ya ganado (2c).**
  - Botón **"Repetir travesía"** con la misma isla, escuadra y Marea.
  - Los combates contra enemigos muy por debajo de tu fuerza se pueden **resolver solos**: ya existe "Resolver rápido".
  - Una isla despejada tiene una **ruta corta** de 3–5 min para farmear.
- **Farmeo pasivo (2b).** Los encargos del Cuartel son el farmeo de fondo: mandar a la escuadra que no juega a islas
  despejadas, con la tabla de esa isla. Al volver al juego se ve el resumen en "Mientras no estabas…".
- **Metas por día y por semana (2c).**
  - **Contratos**: 3 por día y 1 por semana, como "vencé 2 élites en el Bañado" o "traé 10 de hierro del Cerro". Dan
    monedas, materiales de mejora y XP de maestría.
  - Se apoyan en las misiones diarias que ya existen (`quests.js`).
- **Progresión larga (2a).**
  - La maestría por arma sube a nivel 20, con hitos cosméticos más allá del 10.
  - Los talentos siguen sumando más allá del nivel 50 con **puntos de paragon**, para que farmear siempre dé algo.
- **Hallazgos (1b, tanda 2).** Cada isla tiene su set, los repetidos se cambian con contactos y completar un set da un
  bono permanente. Esto cablea `regionBonus` y `findMult`, que hoy no hacen nada.
- **Balance (2c).** `sim-voyage` suma metas de farmeo:
  - en una isla despejada, una salida rápida da entre el 40 y el 60 % del botín de una salida completa, en un tercio
    del tiempo;
  - una pieza única cada 6 a 10 jefes como mucho;
  - con un rato por día de 20 minutos, subir al menos un nivel de Marea por semana.

  `sim:economy` suma el gasto de materiales en rehacer rasgos y mejorar armas, para que lo farmeado tenga dónde ir.

## Investigación: qué modos de juego enganchan y crecen con el jugador
| Referencia | Qué aporta | Qué tomamos |
|---|---|---|
| Slay the Spire, FTL, Monster Train | Mapa de rutas: cada fila es una decisión que se entiende sola (riesgo contra premio), y la profundidad sale de las combinaciones | La travesía por rutas (2c) |
| Minecraft Dungeons | Mapa de misiones con fuerza recomendada, botín con rareza que se ve en el personaje, dificultad escalonada para repetir | El archipiélago, la fuerza y la Marea del Quiebre |
| Hades | Mejoras de una sola salida que se combinan, la historia avanza también cuando perdés y la base cambia entre salidas | Las reliquias del Quiebre y la vuelta a casa |
| Diablo III y IV | Farmeo con objetivo: piezas únicas por jefe, niveles de tormento, paragon y rehacer rasgos | Las tablas de botín, el contador de suerte, el paragon y rehacer en la Forja |
| Into the Breach, Divinity: Original Sin 2 | Tácticas legibles, intenciones a la vista y terreno que reacciona (agua + rayo, aceite + fuego) | Las reacciones elementales del 2d |
| Assassin's Creed (hermandad), Darkest Dungeon | Gente con nombre que sube, se cansa y se manda a misiones | El Cuartel y los encargos |
| Dorfromantik | Calma y lectura instantánea | Descartado como núcleo: es lento y poco épico. Puede volver como evento de cartografía |

Las reglas que salen de esto:
- **La primera salida se entiende sin leer nada:** nodos con ícono claro y la ruta a la vista.
- **La complejidad llega por capas:** cada nodo, reliquia o reacción nueva se presenta una vez (3d).
- **Cada salida deja algo:** XP, maestría, un arma, un Hallazgo o avance de historia.
- **El botín tiene cara:** se ve en el personaje y en la escuadra.

## Sprites 2D de personajes (referencia del usuario, `docs/ref/sprites-referencia.webp`)
El usuario mandó una hoja de stickers en pixel art: caballero, explorador con antorcha, arquera encapuchada, ladrona,
bruja, mago, enano con hacha y goblin. Los quiere así para cada personaje, en las cinemáticas y en el HUD.
Qué se toma de la referencia:
- figuras de unos 24 × 32 px con cabeza grande;
- contorno oscuro de 1 px y luz de un solo lado;
- silueta que dice el oficio: casco, capucha, sombrero, barba, arma visible;
- paleta apagada de 3–4 tonos por material;
- borde blanco de sticker como opción para los retratos.

Nunca se copia un personaje de la referencia: es guía de estilo.

Cómo se hace (paso nuevo **1d**, en paralelo con el Bloque 1):
- **Generador de sprites por capas** en `src/art/sprite2d.js`, sin dependencias. Arma el sprite desde el mismo `look`
  del avatar 3D: pueblo, contextura, piel, pelo, barba, ropa, sombrero, clase y arma. Así cada recluta, cada persona
  con nombre y cada enemigo tiene su sprite sin dibujarlo a mano.
  - Las piezas se dibujan a mano en grillas: cuerpo por pueblo, cabezas, caras, peinados, barbas, ropa por clase,
    sombreros, armas y escudos.
  - Paletas de `figure.js` (`clothHex`, rampas de `avatar-kit.js`) para que el 2D y el 3D sean la misma persona.
- **Animaciones:**
  - quieto: 2 cuadros, respira;
  - caminar: 4;
  - golpe o disparo: 3;
  - recibir daño: 1;
  - caer: 2;
  - gestos para las cinemáticas: señalar, levantar algo, entregar.
- **Dónde se usa:**
  - retratos de diálogo (reemplazan los bustos 3D de la Bitácora cuando sumen);
  - lista de la escuadra y del Cuartel;
  - orden de turnos del combate;
  - avisos de encargos;
  - las viñetas 2D de las cinemáticas (3a, 3b, 3c).
- **Galería y criterio:**
  - `tools/sprites.html` muestra todos los pueblos × clases y cada animación cuadro a cuadro, a 1×, 2× y 4×;
  - se revisan con la prueba de grises y la de silueta en negro;
  - cada tanda se compara al lado de la referencia antes de cerrar.
- **Tests:** `test-sprite2d.mjs` (en `npm test`) revisa que todas las combinaciones armen sin huecos ni piezas
  fuera del cuadro, y que un look dé siempre el mismo sprite.

---

## Bloque 1: arreglos (tres pasos independientes, en paralelo, más el 1d)

### 1a. Armas y armaduras fuera del cuerpo (`src/avatar/figure.js`, `avatar.js`)
- **Regla nueva de anclaje.** Todo lo que se sostiene arranca en el frente del puño (`z ≥ front(D)+1`). Lo largo va
  inclinado hacia afuera y adelante con una pose propia (`rx`/`rz` por arma), nunca sobre el eje del brazo.
- **Largos por cuerpo.** Se miden en proporción a `armL` y `H`, con tope para no pasar el piso. El pico del hacha
  apunta hacia afuera.
- **Arco.** La cuerda va adelante del puño, con un vóxel de luz.
- **Bolso y catalejo.** Van al cinturón, del lado de afuera de la cadera, y con `x ≥ armX + armW/2 + 1`.
- **Hombrera.** Pasa a ser una pieza de la grilla del torso, una cáscara arriba del hombro (+1 vóxel por fuera de la
  camisa). Ya no rota con el brazo. Si hace falta que acompañe, rota la mitad.
- **Faldones.**
  - Abiertos adelante y atrás, en paneles que rotan con cada pierna: un panel hijo del pivote de la pierna.
  - El hábito largo pasa a ser un panel con la pierna más corta en la animación.
- **Capucha, manto, mochila y capa:**
  - capucha y manto con 1 vóxel de separación;
  - capa corrida detrás de la mochila cuando están las dos;
  - `armX` redondeado a vóxel entero (se compensa el ancho del hombro).
- **Prueba nueva** `tools/test-gear-fit.mjs` (en `npm test`). Para cada pueblo × contextura × clase × arma revisa, en
  idle y en 4 cuadros de caminata:
  - que no haya vóxeles del arma dentro del cuerpo;
  - que no haya vóxeles por debajo de y=0;
  - que la armadura quede a 1 vóxel o más de la piel.

  Usa las grillas antes del mesh.
- **Galería.** `tools/people.html?set=clases` pasa a mostrar la grilla completa de 5×6, con `walk=1` y con vista de
  frente, perfil y espalda. Las capturas van a `shots/personajes/clases-*.png` y se miran una por una antes de cerrar.

### 1b. Íconos originales (`src/core/icons.js` y los mapas de datos)
- **Sistema nuevo de sprites originales.** Se dibujan a mano en grillas de 16×16 (HUD) y 24×24 (paneles), con la paleta
  oscura de los tokens.
- **Reglas de lectura**, que van a DESIGN.md:
  - silueta legible a 16 px en negro;
  - prueba de grises;
  - una idea por ícono;
  - nada de copiar el emoji equivalente;
  - el mismo trazo y la misma luz en toda la familia.
- **Galería nueva** `tools/icons.html`: todos los íconos a 16, 24 y 32 px sobre fondos oscuro y claro, más la prueba de
  grises. Se captura con `gallery-shot.mjs` y se revisa por familias.
- **Tanda 1 (sistemas, unos 90):**
  - monedas y recursos;
  - los materiales de región;
  - acciones de interfaz;
  - HUD (Expedición, Bitácora, Construir…);
  - amenazas, clima, elementos, clases y armas;
  - categorías de Construir;
  - misiones y metas;
  - cofres, pase y rangos.

  Se reemplazan los campos `emoji`/`icon` de `data.js`, `exp-data.js`, `threat-data.js`, `ambience.js`,
  `story-data.js`, `season-data.js`, `chests.js`, `themes.js`, `hud.js`, `city-ui.js`, `panels-*.js` y `exp-ui.js` por
  ids de sprite.
- **`drawEmoji` queda como último recurso, con aviso en consola** (`test-icons.mjs` falla si algún id cae ahí).
- **Fuera los íconos tiernos sin uso:** fairy, bear, paw, cake, ribbon, wand y similares.
- **Tanda 2 (Hallazgos, 108):** láminas de 32×32 con estilo de ilustración, una familia por set. Va como un paso
  aparte dentro del mismo bloque, porque es mucho arte.
- **Emojis en el texto** (`net-mock`, `social-*`, `events.js`): se reemplazan por íconos o se sacan.

### 1c. Sacar Mi Casa
- **Borrar:**
  - `src/scenes/home.js`, `src/home/*` y `src/city/models-home.js`;
  - `tools/test-home.mjs` y su entrada en `npm test`.
- **Editar:** todo lo que listó la exploración.
  - `main.js`, `data.js` (`mi_casa`), `economy.js` (Comfort → Encanto, `ensureHome`, `HOME_LEVELS`, eras y Martillo),
    `state.js`, `quests.js` (bonus de Comfort), `expedition.js` (XP por Comfort), `city-ui.js`, `city-visit.js`,
    `city-ambience.js`, `threat-rules.js`, `models.js` y `sync.js` (`city.home`);
  - el pase (`season-data.js`, sus premios de muebles → reemplazarlos por premios de la travesía);
  - cofres (`chests.js`, `chests-ui-common.js`) y trofeos;
  - el audio de Mi Casa (`audio.js`, `mixer.js`, `soundscape.js`, `pieces.js`);
  - `panels-quests.js:146`, `tools/gallery.html` y los docs (CLAUDE.md, DESIGN*.md).
- **Guardado v6** (`migrateV6` en `state.js`):
  - el edificio `mi_casa` sale del mapa y la parcela queda libre;
  - se devuelven las monedas y gemas de los muebles comprados y de las mejoras de la casa;
  - el Encanto que daba el Comfort pasa a un bono fijo equivalente en la ciudad, para que nadie baje de rango;
  - los trofeos pasan a la Bitácora (sección Logros);
  - aviso único en "Mientras no estabas…".
- **Visitas a contactos viejos:** si el perfil trae `city.home`, se ignora.
- **Tests:** `test-migration` suma el caso v5 → v6, y se actualizan `test-stress` y `test-audio`.
- `sim:economy` sigue en verde en las semillas 1 a 12, recalibrando lo que el Comfort aportaba.

---

## Bloque 2: la Travesía (lo nuevo; dos pasos en serie y uno en paralelo)

### 2a. Nivel, fuerza y maestría (base para todo lo demás; primero)
- **Un solo Nivel de jugador.**
  - El nivel del líder (`state.classes.leader`) pasa a ser **el Nivel**: tope 50, se ve en el HUD y sube con todo.
  - `state.player.level` se retira: lo que pedía pasa a pedir Nivel o Encanto.
  - Migración: se toma el más alto de los dos y se recalcula la XP, sin bajar a nadie.
  - Cada nivel da un punto de **talento**: un árbol corto de 3 ramas (Mando, Supervivencia, Oficio) con efectos chicos y
    visibles.
- **Armas como objetos.**
  - `src/core/arsenal.js` (puro) + `state.arsenal`: armas con tipo (espada, hacha, arco, bastón, martillo, lanza,
    escudo), rareza (común → reliquia), **fuerza** y 1 o 2 rasgos.
  - Caen en la travesía, se equipan por persona en el Cuartel y se ven en el modelo, con el anclaje del 1a.
- **Maestría por tipo de arma** (y por objeto del Taller).
  - Usar un arma en combate suma maestría, niveles 1–10, con la curva de `MASTERY_STEPS` (`economy.js:345`).
  - Cada nivel abre algo concreto: +daño, una habilidad propia del arma en el 3, 6 y 10, y un marco visual en el arma.
  - Los objetos del Taller (`ITEMS`) suben su maestría al usarlos y mejoran su efecto.
- **Fuerza (power level).** Es Nivel + armas + herramientas + escuadra. Hay una función pura (`powerOf(state, squad)`) y
  se ve como número grande en el mapa y en el Cuartel. El combate la usa para escalar a los enemigos (`expected`).
- **Interfaz.** La pestaña Progreso se ordena como Nivel, Talentos, Maestrías y Fuerza. Hay un aviso al subir de nivel o
  de maestría.
- **Balance.**
  - `sim:combat` suma escalado por fuerza: misma meta de 85–95 % con la fuerza recomendada, menos con menos.
  - `sim:economy` suma XP por día: un rato de 20 min tiene que dar al menos un avance (nivel, maestría o arma).

### 2b. Cuartel y reclutas (en paralelo con 2c, después del 2a)
- **Edificio nuevo "Cuartel".** El "Cuartel de Bomberos" pasa a llamarse **"Bomberos"** (mismo id).
- **Reclutas como personas.**
  - `state.squad.members[]`, cada una con nombre, pueblo, clase, nivel, arma, maestrías, rasgo de personalidad y aspecto
    (`randomLook`).
  - Migración: cada miembro anónimo de clase pasa a un recluta con nombre y conserva su nivel.
  - `fightParty`, `defenders` y `cityClasses` leen de la escuadra.
- **De dónde salen:**
  - las personas con nombre (Brígida, Nahuel, Olga y Ramiro pueden sumarse a la escuadra con Vínculo 3);
  - la casilla de rescate de la travesía (ya existe el `cautivo` en combate);
  - las aldeas ("Sumar gente");
  - un tablón del Cuartel que ofrece un recluta por día.

  Hay lugar para más reclutas con el nivel del Cuartel.
- **Escena del Cuartel** (`src/scenes/barracks.js`, 3D vóxel): un patio con los reclutas parados.
  - Clic en un recluta abre su ficha: equipar arma, ver maestrías, subir de clase.
  - Se arma la escuadra de 3 para la travesía.
- **Encargos.**
  - Los que no van a la travesía salen solos a misiones por tiempo (30 min a 8 h en tiempo real) en islas ya
    despejadas.
  - Vuelven con materiales, XP y a veces un arma. Un encargo que les queda grande puede salir mal: vuelven cansados.
  - Lógica pura en `src/core/errands.js`, resuelta al volver como las amenazas automáticas.

### 2c. Mapa del archipiélago y travesía por rutas (el corazón; después del 2a)
**Mapa del mundo** (`src/scenes/worldmap.js`, reemplaza el panel `panels-expedition.js` como puerta de entrada):
- La isla de tu ciudad está en el centro, con islas vóxel flotando alrededor y nubes entre ellas.
- Al elegir una isla, el esquife viaja animado hasta ella.
- **Islas del Acto 1:** las cinco regiones de hoy (Bosque, Sierras, Bañado, Cerro, Costa) pasan a ser islotes del
  fragmento, con la historia y los jefes en su lugar.
- **Acto 2 y siguientes:** islas en silueta entre la niebla, con candado de historia y fuerza recomendada.
- **Cada isla muestra:**
  - fuerza recomendada contra la tuya, en verde, amarillo o rojo;
  - materiales que da;
  - jefe;
  - estrellas;
  - nivel de **Marea del Quiebre**: la dificultad opcional que se abre al despejarla, más dura pero con más botín, para
    repetir islas.
- `regionOpen` pasa a ser `islandOpen(state, id)`: historia más fuerza recomendada (se puede entrar con aviso).

**La travesía por rutas** (motor puro nuevo, `src/voyage/voyage-gen.js` y `voyage-rules.js`, guardado en JSON como hoy):
- **Mapa de la isla.** Son 5–7 filas de nodos con caminos que se cruzan (generado por semilla) y un jefe o lugar al
  final. Se ve sobre la isla vóxel desde arriba, con el grupo moviéndose de nodo en nodo.
- **Nodos:**
  - Combate: el táctico de siempre.
  - Élite: más difícil, con arma garantizada.
  - Evento: decisiones con costo, que salen de las tablas de peligros y ruinas de `exp-data.js`, reescritas como
    escenas cortas con Vera o la escuadra.
  - Ruina: botín y Hallazgo.
  - Campamento: elegir entre curar, subir el ánimo o mejorar un arma.
  - Mercader del Bajo Mundo.
  - Aldea: reclutar o comerciar.
  - Mirador: revela qué hay en las filas siguientes.
  - Misterio: un nodo sin decir qué es.
  - Jefe.
- **Recursos de la salida:**
  - **provisiones**: cada nodo cuesta una y son las de siempre (se reusa `provMax`);
  - **vida de la escuadra**, que sigue entre combates;
  - **ánimo**.

  Si te quedás sin provisiones o se cae la escuadra, volvés con la mitad del botín, igual que hoy.
- **Reliquias del Quiebre.** Son mejoras que solo duran esa salida (estilo boons de Hades) y caen en élites, ruinas y
  eventos. Por ejemplo: "la primera habilidad de cada combate es gratis" o "las raíces de la Raíz duran un turno más".
  Algunas se combinan entre sí, y descubrir esas combinaciones es parte del juego (se anotan en el Manual).
- **Complejidad que se abre de a poco** (lo fácil primero), con cada novedad presentada por la guía del Bloque 3:
  - la primera isla solo tiene combate, evento, ruina y jefe;
  - después llegan, en este orden: campamento, élite, mirador, mercader, reliquias, aldea y misterio;
  - al final, la Marea del Quiebre y los modificadores por isla (niebla, tormenta y noche de `exp-rules` pasan a ser
    modificadores de isla).
- **Cada isla tiene identidad:** tabla propia de nodos, enemigos, eventos, botín y una regla propia. Por ejemplo:
  - Bañado: casillas inundadas en los combates;
  - Sierras: rutas cortadas que piden Cuerda;
  - Cerro: los nodos oscuros piden Farol.
- **Lo que se mantiene:**
  - el combate táctico y su puente (`enterCombat` / `finishFight`, `exp-scene.js:740-772`);
  - las herramientas (`TOOL_EXP`);
  - los elementos y la Grieta;
  - los jefes y escenas del Acto 1 (`act1.js` cuelga del nodo de jefe de su isla);
  - el 3★ por salida;
  - los Hallazgos.
- **Duración:** una salida dura unos 10–15 min (adultos, ratos cortos). La salida corta del día pasa a ser una ruta de 3
  filas.
- **Migración:** las zonas despejadas por región pasan a estrellas y nodos de jefe vencidos de su isla. Una salida
  activa de la grilla vieja se cierra al cargar y se acreditan sus materiales.
- **Se retiran** `exp-gen.js`, la parte de grilla de `exp-rules.js` y `exp-scene.js`. Se reusan las tablas de
  `exp-data.js`, `exp-ambience.js` (luz y clima de la isla) y `exp-guide.js` (pasa a la guía nueva).
- **Simulador nuevo** `tools/sim-voyage.mjs`, que reemplaza `sim:expedition`. Bots que eligen rutas (codicioso,
  prudente, al azar) y metas:
  - salida típica en 10–15 min;
  - primera vez en una isla con la fuerza recomendada: 70–85 % de éxito;
  - ninguna ruta domina;
  - cada salida da algún avance.

  `sim:economy` se cablea al motor nuevo.
- **Tests:** `test-voyage.mjs` (motor puro), `test-worldmap.mjs` (interfaz) y adaptar `test-combat-exp`, `test-act1`,
  `test-cycle` y `test-e2e`.

---

## Bloque 3: épica, cinemáticas y guía interactiva (después del 2c)

### 3a. Motor de cinemáticas (`src/cinema/`)
Se extrae de `intro.js` lo reusable:
- **Línea de tiempo con pistas:**
  - cámara con varios puntos y curvas;
  - subtítulos con varias líneas por plano;
  - luces, sonidos y stingers.
- **Biblioteca de poses** sobre `userData.parts`: señalar, cargar, empujar, pelear, caer, agarrar, entregar, mirar,
  arrodillarse. Se aplican después de `update` y usan las "manos" con utilería de `echo-fx.js:21-43`.
- **Etiquetas en 3D** con `createOverlays`/`project` de `city-fx.js:84-129`: la primera vez que aparece algo, un cartel
  sobrio con nombre y una línea ("La Veta: la sangre del continente").
- **Viñetas en pixel art 2D animado** (pedido del usuario), en `src/cinema/pixel2d.js`. Son momentos de la cinemática
  contados como crónica ilustrada que se mueve, y se alternan con los planos 3D.
  - Sobre un canvas de baja resolución sin suavizado, como manda CLAUDE.md para el 2D.
  - Capas con paralaje, sprites con cuadros de animación (caminar, correr, golpear, caer, gesto), tweens, partículas
    y una cámara 2D (paneo, zoom entero, temblor).
  - Los sprites se dibujan en código, en grillas con la paleta de cada escena (como los íconos del 1b), o como hojas
    PNG en `assets/cinema/` armadas con un script de `tools/`. No se agrega ninguna dependencia.
  - Galería `tools/sprites.html`, para revisar cada animación cuadro a cuadro antes de usarla.
  - Se usan para lo que en 3D sale duro: el forcejeo del robo, la caída de la gente en el Quiebre, la historia de las
    Casas, y también en las llegadas a cada isla.
- **Narrador** (pedido del usuario): voz grave, épica y misteriosa, pero que entusiasme, generada con **Gemini TTS**.
  - `tools/audio/narrate.mjs` lee los textos de la cinemática (DESIGN-STORY §7 / `story-data.js`) y les pide a la API
    una voz grave (se prueban, por ejemplo, Charon, Algenib y Fenrir). La indicación de estilo es "narrador épico,
    misterioso, español rioplatense sobrio".
  - Arma un `.wav` por línea y lo pasa a `.m4a` con `prepare.mjs`, en `assets/audio/voice/`.
  - Suena por el bus `voice`, que ya existe con su ajuste `volVoice`, y baja la música con el ducking. Los subtítulos
    se sincronizan con la duración real de cada línea.
  - **Clave:** la `GEMINI_API_KEY` sale del `.env` del proyecto SignBoox. El script la lee de una variable de entorno o
    de la ruta de ese `.env`, sin copiarla nunca al repo ni a los logs. La ruta se le pide al usuario al llegar al paso
    si no se encuentra; buscarla por disco quedó bloqueado en el plan.
  - Se generan dos o tres voces de muestra de la primera línea y se le mandan al usuario para que elija antes de
    grabar todo.
  - La misma herramienta sirve después para las cinemáticas de isla y para líneas de Vera, si gusta.
- `audio.track(id)` en `core/audio.js`, para pistas grabadas (`.m4a` en el manifest, categoría `music`, se baja durante
  el splash). Así la pista de Suno entra sin tocar nada más.

### 3b. Cinemática "El Quiebre" nueva (`src/scenes/intro.js` sobre el motor)
- Entre 9 y 11 planos, unos 2 minutos, con saltar siempre a mano. Se cuenta en orden:
  1. el mundo entero y las cuatro vetas, cada una con su etiqueta;
  2. las Casas;
  3. los enanos de la Veta trabajando;
  4. un noble que da la orden;
  5. el robo: forcejeo, el cristal que cambia de mano, la guardia que persigue;
  6. el Quiebre, con gente que cae y alguien que ayuda a otro;
  7. las islas que suben;
  8. los Vaciados y los orcos de la Brasa;
  9. la Cofradía mirando desde lejos (siembra del traidor);
  10. Vera en su esquife, que encuentra tu fragmento;
  11. tu personaje despierta.
- Cada plano se arma en **3D** o como **viñeta 2D en pixel art**, según qué cuenta mejor:
  - 3D para lo grande: el mundo, las vetas, las islas que suben, el esquife;
  - 2D para la acción entre personajes: la orden del noble, el robo y el forcejeo, la gente que cae y se ayuda.
- El narrador lleva el hilo de los planos 1 a 9, y Vera habla en el 10 y el 11.
- Textos en DESIGN-STORY §7, con el tono de M4 (sin diminutivos).
- Se actualizan `test-story.mjs:108-111` y `recorrido.mjs:375`.
- Música: por ahora queda la `epic` actual. Cuando el usuario pase la clave de Suno, se genera la pista, se convierte a
  `.m4a` con `tools/audio/prepare.mjs` y entra por `audio.track('intro')`.

### 3c. Cinemáticas de llegada a cada isla
- Son 10–20 s con el mismo motor:
  - el esquife llega en 3D;
  - una viñeta 2D cuenta la leyenda del lugar, con el narrador;
  - una etiqueta presenta el lugar, con una línea de Vera o de alguien de la escuadra.
- Se disparan la primera vez que se entra a cada isla (`story.seen`, clave `isla:<id>`) y se pueden volver a ver desde
  la Bitácora.
- Cada isla tiene su paleta y su clima.

### 3d. Guía interactiva de Vera (`src/story/spotlight.js`)
- **Capa que oscurece la pantalla** con un recorte alrededor del elemento: una máscara SVG sobre el rect del objetivo.
  Si el objetivo es un edificio 3D, se proyecta su caja, y `highlightBuilding` mueve la cámara.
- **Tarjeta de Vera anclada al recorte**, con tres partes: **qué es**, **para qué sirve** y **qué hacer ahora**. Tiene
  pasos con "Siguiente" y solo se avanza haciendo la acción pedida cuando corresponde.
- **Secuencias de un uso por sistema** (`state.tutorial.spot`), disparadas por `unlock:*`, `built:*` y `quest:*`:
  - Construir, Misiones, Mapa de islas, primera travesía (nodos y provisiones), Cuartel y escuadra, Encargos, Arsenal
    y maestría, Talentos;
  - Amenazas, Combate (se integra con las `combatTips`), Bitácora;
  - cada nodo nuevo de la travesía cuando aparece por primera vez.
- Reemplaza a `exp-guide.js` y se suma a la flecha de `guideTarget` (la flecha sigue para las misiones comunes).
- Respeta el ajuste de pistas y "reducir movimiento", y la Bitácora → Manual permite repetir cada guía.

---

## Bloque 4: el juego en los idiomas más usados (pedido del usuario)
Hoy todo el texto está escrito a mano en español dentro de `src/`. Solo los literales con tilde ya son unos 900, y el
total se estima entre 3000 y 5000 textos. No hay nada de idiomas armado. La única fuente, Jersey 10, cubre solo el
alfabeto latino.

**Por qué en dos partes.** Traducir ahora sería tirar trabajo: el 2c retira la expedición de grilla y el 3b reescribe la
intro. Por eso se hace así:
- **4a, la base:** va junto con el 2a. Desde que se integra, todo texto nuevo del Bloque 2 y del 3 nace con clave.
- **4b, extraer y traducir:** va al final, después del Bloque 3, cuando el texto ya no cambia.

**Idiomas.** Se eligen por alcance y por lo que más se usa entre jugadores de PC (Steam):
- **español**, el idioma fuente, que queda rioplatense para todos porque es la voz del juego;
- **inglés**;
- **chino simplificado**;
- **ruso**;
- **portugués de Brasil**;
- **alemán**;
- **francés**;
- **japonés**;
- **coreano**.

Si la base aguanta bien, una segunda tanda suma polaco, turco e italiano.

### 4a. Base de idiomas (con el 2a)
- **`src/core/i18n.js`**
  - `t(clave, vars)` para el texto y `tn(clave, n, vars)` para los plurales, con `Intl.PluralRules`.
  - Números y fechas con `Intl.NumberFormat` y `Intl.DateTimeFormat`.
  - Las claves tienen nombre estable, como `hud.zarpar` o `voyage.node.camp.name`.
  - El texto fuente va en `src/i18n/es.js`, y cada idioma en `src/i18n/<código>.js`. Con `import()` se carga solo el
    idioma elegido, así que no hay build ni dependencias.
  - Si falta una clave, se muestra el español con un aviso en la consola, y el test falla.
- **Datos.** `data.js`, `exp-data.js`, `story-data.js` y los demás guardan **claves**, no textos. Cada id de edificio,
  isla o arma arma su clave (`building.<id>.name`).
- **Elegir idioma.**
  - Va en Ajustes → Idioma: `setSetting({ lang })` aplica en vivo con `settings:changed` y repinta el HUD y los paneles
    abiertos.
  - La primera vez se toma el idioma del sistema: `navigator.language` en la web y el locale del sistema operativo en
    Tauri, por `src/core/desktop.js`.
  - `?lang=en` en la URL manda sobre los Ajustes, como `?quality`.
- **Fuentes por idioma.** Se verifican la licencia (OFL) y la cobertura antes de elegir.
  - **Ruso:** una fuente pixel con cirílico que combine con Jersey (por ejemplo, Pixelify Sans).
  - **Chino, japonés y coreano:** una fuente pixel CJK, como Fusion Pixel o Ark Pixel, o Galmuri para coreano.
    - Un script de `tools/` la **recorta** a los caracteres que usa el juego.
    - Solo se carga en ese idioma, y `sw.js` la suma al bump.
  - **Texto en canvas.** Los tableros 2D, los carteles 3D y `createOverlays` también pasan por `t()` y por la fuente
    del idioma.
- **Interfaz que se estira.**
  - El alemán ocupa cerca de un 30 % más y el CJK pide otro alto de línea.
  - Ningún texto va en un ancho fijo: los botones y tarjetas crecen, o achican la letra hasta un tope.
- **Lo que no se traduce:**
  - nombres puestos por el jugador, notas de visitas y nombres de contactos;
  - el perfil online, que guarda ids y no textos, así una visita se ve en el idioma de quien mira.
- **Regla desde que se integra el 4a:** todo texto nuevo va por `t()` con su clave en `es.js`. Va en CLAUDE.md, en
  DESIGN.md (Guía de tono) y en las reglas del HANDOFF.
- **`tools/test-i18n.mjs`** (en `npm test`) revisa:
  - que cada clave de `es` exista en cada idioma y que las variables `{x}` coincidan;
  - que no aparezcan textos con tilde fuera de `src/i18n/` en los archivos ya pasados (con una lista que se achica en
    el 4b hasta quedar vacía);
  - capturas en `de` y `ja` sin texto cortado: se mide `scrollWidth > clientWidth` en botones, pestañas y tarjetas.
- **Prueba de la base.** Se pasan a claves el HUD, los Ajustes y el menú de inicio, y se traducen esos textos al
  inglés y al japonés para probar todo el camino, incluida la fuente CJK.

### 4b. Extraer y traducir (después del Bloque 3)
- **Extraer.** El texto que quede en `src/` pasa a `es.js` por carpetas, con una sesión por carpeta para no pisarse.
  `test-i18n` termina sin excepciones.
- **Glosario** (`docs/i18n/glosario.md`), que se cierra **antes** de traducir.
  - No se traducen: Pixelia, Vera y los nombres de personas.
  - La Veta, el Quiebre, Raíz, Marea, Brasa, Céfiro, la Cofradía, los Vaciados, la Marea del Quiebre, los Hallazgos y
    los nombres de islas tienen un término fijo por idioma. Por ejemplo, en inglés: the Vein, the Sundering, Root,
    Tide, Ember, Zephyr.
- **Guía de tono por idioma** (`docs/i18n/tono.md`): cozy adulto, cálido y sobrio, sin diminutivos ni infantilizar.
  Fija el tratamiento de cada idioma: "du" en alemán, "ты" en ruso, registro です/ます en japonés y 해요체 en coreano.
- **Traducción.**
  - La hacen las sesiones desde el español, con el glosario y la guía. Se traduce el sentido, no el voseo ni los
    modismos al pie de la letra.
  - Va un idioma por sesión, en paralelo, porque cada uno es un archivo distinto.
- **Revisión.**
  - Otra sesión retrotraduce una muestra del 10 % de cada idioma y marca lo que cambió de sentido.
  - Lo dudoso queda anotado para que lo revise alguien nativo antes de publicar en tiendas.
- **Voces.**
  - Los subtítulos de las cinemáticas se traducen siempre.
  - El narrador (Gemini TTS, 3a) se graba en español y en inglés, y Ajustes → Voz elige entre original e inglés.
  - Los otros idiomas se graban si una muestra por idioma suena bien. Si no, van con subtítulos.
- **Juego de PC.** El nombre, la descripción, los textos del instalador de Tauri y los avisos de actualización van en
  cada idioma.
- **Capturas por idioma.** Se sacan con `recorrido.mjs --lang <código>` y se miran a ojo, buscando texto cortado,
  letras que faltan y cajas vacías ("tofu").

---

## Orden y sesiones
1. **Bloque 1:** 1a, 1b (tanda 1), 1c y 1d en paralelo, en cuatro sesiones con worktree. El 1d solo crea archivos
   nuevos (`src/art/`, `tools/sprites.html`); conectarlo al HUD es parte del 2b y del 3d. Tocan archivos distintos; 1b y 1c
   se cruzan en `season-data.js` y `chests.js`, así que 1c va primero en esos dos archivos y 1b rebasa. Después, la
   tanda 2 del 1b (Hallazgos).
2. **2a y 4a en paralelo** (el 4a solo toca `i18n`, Ajustes, fuentes y el HUD), y después **2b y 2c en paralelo** (2c
   es el más grande y puede necesitar dos sesiones: motor y sim, y después escena y mapa). Con el 2c va el cambio de
   rumbo de la aldea, con "Zarpar" en el HUD y la vuelta a casa. Después, el **2d** (elementos).
3. **3a**, y después **3b, 3c y 3d** (3d puede arrancar con el 2c, porque solo necesita los ids de lo que señala).
4. **4b:** primero la extracción por carpetas y el glosario, después un idioma por sesión y al final la revisión.
5. **Integración final:** recorrido de jugador nuevo con `tools/recorrido.mjs` (capturas e informe), `npm test`,
   `sim:voyage`, `sim:combat` y `sim:seeds 1-12`.

## Verificación
- **Bloque 1:**
  - `node test-gear-fit.mjs` en verde;
  - capturas `people.html?set=clases` (frente, perfil, espalda y caminando) revisadas a ojo;
  - `tools/icons.html` revisado por familias y en grises;
  - `test-icons.mjs`: ningún id cae en emoji;
  - `test-migration` v5 → v6;
  - `npm test` completo.
- **Bloque 2:**
  - `sim:voyage` y `sim:combat` en metas, y `sim:seeds 1-12` en verde;
  - `test-voyage`, `test-worldmap` y `test-barracks`;
  - una salida completa jugada en el preview (`?scene=worldmap`, `?cheat=15`) con capturas de mapa, ruta, combate,
    campamento y jefe.
- **Bloque 3:**
  - la cinemática nueva capturada por plano en `shots/intro/`;
  - `test-story` adaptado;
  - un recorrido de jugador nuevo de punta a punta, con la guía disparándose una sola vez por sistema;
  - GPU vigilada con `nvidia-smi` en cada prueba con preview.
- **Bloque 4:**
  - `test-i18n` en verde, sin excepciones al cerrar el 4b;
  - capturas del recorrido en los 9 idiomas, revisadas a ojo;
  - la retrotraducción de muestra sin cambios de sentido pendientes.
- **Juego de PC:** al final de cada bloque, `npm run desktop:build` + `node test-desktop.mjs`.

## Archivos críticos
- **Bloque 1:**
  - `src/avatar/figure.js`, `src/avatar/avatar.js`, `tools/people.html`;
  - `src/core/icons.js` y los campos de íconos de los datos;
  - `src/core/state.js` (migraciones), `src/core/economy.js`, `src/season/*`, `src/chests/*`.
- **Bloque 2:**
  - `src/combat/classes.js`, `src/core/classes.js`, `src/core/people*.js`, `src/expedition/*`;
  - nuevos: `src/voyage/*`, `src/core/arsenal.js`, `src/core/errands.js`, `src/scenes/worldmap.js`,
    `src/scenes/barracks.js`, `tools/sim-voyage.mjs`.
- **Bloque 3:**
  - nuevos: `src/cinema/*`, `src/story/spotlight.js`;
  - `src/scenes/intro.js`, `src/story/story-data.js`, `src/core/audio.js`, `src/audio/sampler.js`.
- **Bloque 4:**
  - nuevos: `src/core/i18n.js`, `src/i18n/*.js`, `fonts/` (pixel con cirílico y CJK recortada),
    `tools/test-i18n.mjs`, `docs/i18n/*`;
  - `src/core/settings.js`, `src/core/desktop.js`, `index.html`, `styles.css`, `sw.js` y todo `src/` en el 4b.
- **Docs:** DESIGN-CORE (expedición → travesía, §8 metas), DESIGN-COMBAT (fuerza, maestría, escuadra), DESIGN-STORY
  (islas y cinemáticas), DESIGN.md (regla de íconos), CLAUDE.md (sin Mi Casa, escenas nuevas).
