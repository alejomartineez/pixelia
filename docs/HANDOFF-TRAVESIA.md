# Handoff · La Travesía

El plan aprobado está en [PLAN-TRAVESIA.md](PLAN-TRAVESIA.md). Este archivo dice **dónde quedó** cada paso. Se
actualiza al cerrar cada paso, en cada corte por contexto y en cada integración.

## Reglas de trabajo (vienen del usuario; copiarlas en cada brief)
- **Autonomía total.** El usuario dijo: "Tenés el SÍ mío para todo lo que haga falta". No se pide permiso para nada:
  instalar, commitear, pushear, abrir sesiones, crear tags. Siguen valiendo las reglas de CLAUDE.md:
  - no tocar el otro proyecto de Supabase;
  - nunca usar `service_role`;
  - correr `npm run bump` antes de cada commit que cambie archivos del juego. Lo hace el orquestador al integrar; las
    ramas de los pasos no bumpean.
- **Regla del 50 % de contexto:**
  - Una sesión que pasa el **50 %** de contexto **para en ese mismo momento**: commitea lo que tenga como WIP en su
    rama, anota acá exactamente dónde quedó y qué falta, avisa con PushNotification y termina.
  - El orquestador abre enseguida una **sesión nueva fresh** (nunca un fork) que sigue lo mismo desde ese punto.
  - Antes de darle una tarea nueva a una sesión existente, el orquestador mira su uso con `get_usage`.
- **Avisos.** PushNotification al cerrar cada paso, en cada corte por contexto y al trabarse. Nunca se espera un OK.
- **Ramas.** Cada paso trabaja en su worktree y su rama `claude/trav-<paso>`. El orquestador mergea a `master`, corre
  `npm run bump` y `npm test`, y después commitea y pushea.
  - Bajo carga algunas pruebas headless fallan por tiempo. Antes de buscar un error, correrlas solas.
- **Carpeta vieja.** `pixelia/` y `.impeccable/` en la raíz no tienen seguimiento: no sumarlas a los commits.
- **GPU** (RTX 3060 Ti con la pasta gastada), en toda prueba que use la placa:
  - tope de 60 FPS (`?fps=60`);
  - corridas de 10–15 s, de a una, cerrando todo al terminar;
  - vigilar con `nvidia-smi --query-gpu=temperature.gpu,power.draw,utilization.gpu --format=csv` y cortar a ~70 °C o
    ~100 W.

  `npm test` y `smoke.mjs` usan SwiftShader, que va por CPU y no la carga.
- **Criterio de arte.** Producir no alcanza: cada tanda se mira en captura, se compara con la referencia y se corrige
  antes de cerrar. Hay que aplicar la prueba de grises, la de silueta en negro y mirar a tamaño real.
- **Tono.** Español rioplatense, cálido y sobrio, sin diminutivos (Guía de tono de DESIGN.md).
- **Idiomas.** Desde que se integra el 4a, todo texto nuevo va por `t()` con su clave en `src/i18n/es.js`. Nada de
  texto escrito directo en el código.

## Estado
| Paso | Qué | Sesión | Estado | Rama o commit |
|---|---|---|---|---|
| — | Plan, handoff y referencia de sprites (`docs/ref/`) | orquestador | hecho | (este commit) |
| 1a | Armas y armaduras fuera del cuerpo, `test-gear-fit` y galería de clases | trav-1a-armas | integrado | master |
| 1b | Íconos originales, tanda 1 (sistemas), `icons.html` y `test-icons` | trav-1b-iconos | en curso | rama `trav-1b` |
| 1b-2 | Íconos, tanda 2 (las 108 láminas de Hallazgos) | — | después del 1b | |
| 1c | Sacar Mi Casa y guardado v6 | trav-1c-micasa → trav-1c2-micasa | integrado | master |
| 1d | Generador de sprites 2D por capas, animaciones y `sprites.html` | trav-1d-sprites | integrado (quedan retoques de arte, ver notas) | master |
| 2a | Nivel único, talentos, arsenal, maestría y fuerza | — | después del Bloque 1 | |
| 2b | Cuartel, reclutas y encargos | — | después del 2a | |
| 2c | Archipiélago, travesía por rutas, farmeo, "Zarpar" y la vuelta a casa | — | después del 2a | |
| 2d | Elementos: reacciones, Santuario, fragmentos y nodos de veta | — | después del 2c | |
| 3a | Motor de cinemáticas, viñetas 2D, narrador Gemini y `audio.track` | trav-3a | hecho, sin bump (voz: Fenrir) | rama `claude/trav-3a-4f363c` |
| 3b | Cinemática "El Quiebre" nueva | — | después del 3a | |
| 3c | Cinemáticas de llegada a cada isla | — | después del 3a | |
| 3d | Guía interactiva de Vera (spotlight) | — | puede ir con el 2c | |
| 4a | Base de idiomas: `t()`, selector, fuentes cirílico y CJK, `test-i18n` | — | junto con el 2a | |
| 4b | Extraer el texto, glosario, traducir a 8 idiomas y revisar | — | después del Bloque 3 | |

## Claves externas (nunca copiarlas al repo, a los logs ni a la salida de comandos)
- **Gemini (narrador, 3a):** variable `GEMINI_API_KEY` en `C:\cursor-laburo\signboox-remotion\.env`, según el usuario
  el 2026-11-09. `tools/audio/narrate.mjs` toma `process.env.GEMINI_API_KEY` y, si no está, lee solo esa línea de ese
  `.env`. Nunca se imprime ni se guarda.
- **Suno (música):** la pasa el usuario más adelante.

## Cruces entre pasos del Bloque 1
- El **1b y el 1c** se cruzan en `src/season/season-data.js`, `src/chests/chests.js` y `chests-ui-common.js`:
  - el 1c saca los premios de muebles;
  - el 1b cambia los íconos de esos mismos archivos.

  Se integra primero el 1c, y el 1b rebasa sobre `master`. Si el 1b llega antes, el 1c resuelve el conflicto
  quedándose con los íconos nuevos.
- El **1a y el 1d** no se pisan:
  - el 1a toca `src/avatar/figure.js` y `avatar.js`;
  - el 1d solo **lee** de ahí (paletas, `look`), y sus archivos nuevos van en `src/art/`.

  Si el 1d necesita exportar algo de `figure.js`, lo pide en este archivo y lo agrega el 1a o el orquestador.
- El **1a y el 1c** comparten `tools/package.json` (cadena de `npm test`): se suma cada test en su línea al integrar.

## Notas de cada paso
(cada sesión anota acá lo que hizo, sus decisiones y lo que queda)

### 1a · Armas y armaduras fuera del cuerpo (rama `claude/trav-1a-f43a3b`)
- **Anclaje** (`GEAR` en `figure.js`). Nada que se sostenga pasa por el puño ni por el brazo:
  - lo que sale hacia adelante (guarda, martillo, trabuco) arranca en `front(D)`; las partes del mango que quedaban
    adentro del puño ya no se dibujan;
  - lo largo (hacha, lanza, bastón, arco) va parado en `zf(D) = max(front, ceil(armW/2) + 2)`. Así libra también el
    puño del guante y la manga ancha, que llegan hasta `ceil(armW/2)`. Una empuñadura de cuero llena la luz contra el
    puño (el "+1" del plan se cumple igual: `front(D)` es la primera celda libre, el puño ocupa `z < front`);
  - cada arma tiene su inclinación `grip: { rx, ry, rz }` y gira en el puño (`gripAt(D)`, un pivote dentro del brazo en
    `avatar.js`). La mano izquierda ahora se espeja como el brazo, así que en las dos manos +x es afuera;
  - los largos salen de `handUp(D)` y `tallOf(D)`, con tope para no tocar el piso;
  - el hacha lleva la hoja afuera y ya no tiene pincho del lado del cuerpo;
  - el arco va con la curva y la cuerda adelante y gira afuera (`ry`) para que la curva se lea de frente;
  - el escudo mira adelante, corrido afuera de la cadera y de la pierna, con una correa al puño;
  - el farol cuelga debajo del puño; libro y orbe se levantan menos y casi no se balancean (`offStill`).
- **Cuerpo**:
  - el bolso va adelante de la cadera derecha, del lado de adentro del brazo y por debajo de la barba. Reemplaza el
    bolsito derecho del traje (`noPouch`);
  - el catalejo va atravesado en la espalda, en el cinturón;
  - la mochila corre la capa 5 vóxeles (`cape` en GEAR), y su manta no se mete en la nuca de las cabezas hundidas.
- **Hombrera**: pasó a la grilla del torso, una tapa 1 vóxel arriba de la camisa más la placa de afuera, pegada a la
  cabeza del brazo. No rota con el brazo. Los labios de adelante y atrás bajo la tapa se sacaron porque los barría el
  brazo al caminar.
- **Faldón**: `drawSkirt` dibuja el panel derecho centrado en la cadera, y `avatar.js → addSkirt` cuelga un panel de
  cada pierna (también en la versión liviana). Cada fila es tan ancha como la pierna y la bota más 1. A la altura de la
  mano, queda a 1 vóxel del brazo. Las faldas largas dan pasos más cortos (`LONG_SKIRT_AMP` 0,26).
  `userData.parts.skirt` ahora es la lista de los dos paneles.
- **Manto, capucha y cuello alto**: el manto cubre hombros y cabeza del brazo y queda abierto adelante, del ancho de la
  cabeza (la barba cae por ahí). Capucha caída, capucha de cabeza (orcos) y cuello alto dejan 1 vóxel de luz con la
  cabeza y la espalda: la cabeza gira un poco al respirar. La capa vuela un poco más al caminar (0,42).
- **`armX`**: ahora es `W/2 + sh - 1 + floor(armW/2)`, en vóxel entero respecto del torso.
- **Prueba** `tools/test-gear-fit.mjs` (en `npm test` y `npm run test:gear-fit`):
  - recorre 410 modelos: 5 pueblos × 2 contexturas × (6 clases + 16 GEAR + 16 ropas + capa con mochila o catalejo +
    capucha con pieles);
  - en cada uno mira 6 cuadros: quieto con la cabeza a cada lado y 4 pasos;
  - las grillas salen de `avatar-kit.js` con `globalThis.__gearFit`. Las capas se marcan con `lay(v, 'armor' | 'gear' |
    'outfit')` en `figure.js`, y `userData.setWalk(fase, camina, t)` fija el cuadro;
  - excepciones a propósito: la punta de arriba del faldón puede meterse bajo el cinturón (gira hacia adentro del torso,
    que la tapa) y la capucha puede tapar pelo en su propia grilla.
- **Galería**: `tools/people.html?set=clases` arma los 5 × 6, con `view=f|p|e|t`, `build=esbelto` y `walk=1`. Las
  capturas están en `shots/personajes/clases-{frente,perfil,espalda,tres-cuartos,caminando}.png`.
- **Para el 1d**: no cambió ningún export de paletas (`paletteOf`, `PEOPLE`, `OUTFITS`, `dimsOf` siguen iguales, salvo
  `armX`). Se suman `GEAR[id].grip`, `zf`, `handUp`, `tallOf` y `gripAt` por si el sprite 2D quiere la misma pose del
  arma.
- **Fuera del alcance, a propósito**: `tools/test-expedition.mjs` tenía una carrera. Después de "Retroceder" tocaba
  la casilla otra vez mientras la tarjeta vieja todavía se iba. Con los modelos nuevos la escena tarda un poco más y la
  carrera se perdía siempre (3 de 3; con `src/avatar` de antes pasaba). Ahora espera a que la tarjeta se cierre: 30/30
  dos veces seguidas.
- **`npm test`**: verde en todo lo que toca el 1a (`test-gear-fit` 422/0, `test-class-look`, `test-classes`, `test-combat*`,
  `test-act1`, `test-expedition` 30/0), salvo dos cosas que no vienen de este paso:
  - `test-people` falla 2 chequeos: "la llegada se cuenta con una escena" y "la escena dice quién llegó"
    (`llega_brigida` muestra solo "SaltarSeguir"). Falla igual con el `src/avatar` de `a335752`: ya estaba en `master`.
  - `test-settings` es intermitente bajo carga: falla una medición de tiempo distinta en cada corrida (FPS con tope 30,
    cámara al 200 %), y a veces ninguna. También falla con el código de antes.
- **Queda**:
  - en tres cuartos el arco se ve de canto (gira hacia afuera para leerse de frente);
  - el arco de los orcos sale chico (brazo largo y piernas cortas: el puño queda bajo);
  - la capucha de cabeza sigue siendo una caja grande en orcos y anuros (diseño de antes, no es un choque).

### 1d · Sprites 2D por capas (sesión trav-1d, 2026-11-09)
Hecho:
- `src/art/sprite2d.js` (compositor y API), `src/art/sprite-parts.js` (cabezas por pueblo, pelos, barbas, sombreros,
  brazos por pose, armas, cosas de los gestos, efectos) y `src/art/sprite-outfits.js` (los 16 estilos de ropa).
  Lee el `look` con `normalizeLook` (avatar.js), `classLook`/`CLASS_KIT` y `paletteOf` (figure.js) y `ramp`/`mix`
  (avatar-kit.js). **No toca `src/avatar/*`** ni hace falta ningún export nuevo de figure.js.
- API: `spriteFrame(look, anim, i, opts)` (píxeles puros, determinista, con caché), `frameCanvas`, `spriteSheet(look,
  opts)` (una fila por animación, cuadros de 32 × 32, `scale` entero), `drawFrame(ctx, sheet, anim, i, x, y)`,
  `portrait(look, { sticker, full, scale, flip })` (busto de 24 sin el arma, o cuerpo entero), `prepareLook`,
  `ENEMY_LOOKS` (grumete, tirador con `gear: 'trabuco'`, capitana, vaciado), `ANIMS`, `SPRITE_ITEMS`, `clearSpriteCache`.
  opts: `cls`, `gear`, `item` ('caja', 'veta', 'carta', 'bolsa').
- Animaciones: quieto 2, caminar 4, ataque 3 (golpe, estocada, disparo de arco o trabuco, conjuro o puñetazo según el
  arma), daño 1, caer 2 (de rodillas y tendido), señalar 2, levantar 2 y entregar 2.
- Cómo se arma: capas (atrás: capa, pelo largo, cola, mochila → piernas → torso y falda → brazo de atrás y escudo →
  cabeza, barba, pelo, sombrero, orejas → brazo de adelante, arma y dedos encima del agarre → cosa del gesto → efectos).
  Cada capa se sombrea sola (luz a la izquierda, sombra a la derecha y abajo) y las que llevan `sep` dejan una línea de
  tinta contra lo de atrás. Se arma en un lienzo de 48 × 40 y se encaja en el cuadro (si un brazo se pasa de costado
  la figura se corre; las astas se acortan si no entran entre el techo y el piso); los huecos de 1–2 px se tapan.
- `tools/sprites.html` con vistas `?view=ref` (la referencia al lado de 9 stickers), `grid` (pueblos × clases, prueba
  de grises a 1× y de silueta a 2×), `anims&k=4` (cada animación cuadro a cuadro) y `parts` (cada pieza y los
  retratos). Captura: `GALLERY_PAGE=sprites.html node gallery-shot.mjs "view=ref" ../shots/spr-ref.png 1400 790 600`.
- `tools/test-sprite2d.mjs` (en `npm test`, después de test-class-look): 1512 cuadros de pueblos × contexturas ×
  clases, 4200 del catálogo y 5400 de looks al azar sin nada fuera del cuadro, sin huecos y de una pieza;
  determinismo, siluetas distintas por clase, gente con nombre y enemigos, hoja, retrato y sticker.

Queda para un retoque de arte (no traba al 2b ni al 3a):
- Las armas siguen más chicas y apagadas que en la referencia (bastón, arco y antorcha allá son altos y claros).
  Conviene agrandarlas y darles más luz; el golpe de martillo pierde la cabeza en el cuadro `strike`.
- El casco de hierro deja la cara oscura (casco + barba + ojos); probar un yelmo más claro o sin barba visible.
- Caminar mueve poco los brazos; el cuadro tendido (caer 2) sale de girar la figura y se puede dibujar mejor.
- Las bestias del combate (lobos, etc.) no tienen sprite: no son un `look`. Si las cinemáticas las necesitan, van
  aparte (grillas propias en `src/art/`).
- Si el 1a agrega campos al look (escudo aparte, armadura), sprite2d los ignora hasta sumarlos: ids que no conoce caen
  a 'viajero' (ropa) o a nada (arma).
- `npm test` en esta rama: todo verde salvo dos cosas ajenas al 1d (el 1d solo suma archivos y nadie del juego importa
  `src/art/`). `test-settings` falló por tiempo dentro de la cadena ("cámara al 200 %") y sola pasa 83/0.
  `test-people` falla 2 de 31 también solo: la escena de llegada de Brígida sale sin texto (`txt: "SaltarSeguir"`).
  Viene de antes; que lo mire el orquestador al integrar.
### 1c · Sacar Mi Casa (hecho)
**Primera sesión** (rama `claude/trav-1c-a593b3`, commit WIP `240a214`, sin bump):
- Borrados `src/scenes/home.js`, `src/home/*`, `src/city/models-home.js`, `tools/test-home.mjs` (y su entrada en `npm test`).
- Sin rastros de Mi Casa en `src/` (grep de `home/`, `mi_casa`, `comfortInfo`, `HOME_LEVELS`, `furniture`): main, data,
  economy (Comfort, eras, Martillo, mejoras, `ensureHome`), state (`reward.furniture`), quests (bono de login), expedition (XP),
  city-ui, city-visit, city-ambience, threat-rules, models, sync (`city.home` ya no se publica; los perfiles viejos se ignoran
  porque city-visit salta ids sin `def`), audio (lugar `home`, crujidos, `enterScene`), panels-quests y `tools/gallery.html`.
- **Logros:** `src/core/achievements.js` nuevo (los 4 `trofeo_*`, `state.achievements = {id: fecha}`, `initAchievements` en
  main.js en lugar de `initHome`; `ctx.achievements`). Se ven al final del **Diario** de la Bitácora (`panels-story.js`,
  `[data-achievement]`). El de Joyas solo se muestra a quien lo ganó.
- **Cofres y pase:** el ítem épico `furniture` pasó a `coins_l` «Arcón de monedas» [700, 1000]; pase nivel 14 = 8 gemas +
  400 monedas, nivel 27 = 10 gemas + 700 monedas (con un cofre de plata fallaba la meta de cofres por día). El 1b rebasa
  sobre esto quedándose con sus íconos.
- **Guardado v6** (`VERSION = 6`, `migrateV6` en state.js): saca `mi_casa`, borra `state.home`, devuelve ampliaciones hechas y
  la que estaba en obra (monedas, gemas y materiales) y los muebles comprados (menos los de arranque, tope
  `stats.furnitureBought`, los que salían en cofres van últimos), trofeos → `state.achievements`. El Encanto: `v6.charm
  {level, comfort}` y `economy.settleV6Charm` (la primera vez que se pide `charmInfo`) lo pasa a `state.city.charmBonus`
  (edificio con sus reglas de variedad + Confort/4). Aviso único dentro de «La isla cambió» (`v6Pending` en main.js).
- `test-migration` en verde (93 ✔) con el caso nuevo v5 → v6. `test-stress` y `test-audio` editados (sin correr).
- Arreglado de paso: `claimLogin` devolvía `reward` sin definir.

**Segunda sesión** (rama `claude/zealous-hellman-0f063d`, sale del WIP; sin bump):
- **Balance:** queda `castillo.charm` **35**. Probé 30, 32, 38, 40, 45 y contar a la Municipalidad como un tipo más en la
  variedad. Con 35, en las semillas 1–12 quedan las mismas 2 fallas sueltas (Pase nivel 30 el día 26 en la 9; planos
  últimos en la 8) y en 13–24 hay 7, igual que la base (master da 0 en 1–12 y 7 en 13–24). En 24 semillas: 9 contra 7.
  - La semilla 9 nunca saca 3★ y el bot se traba en la misión t18: pierde las chispas de 13 misiones principales. En la
    base, las semillas 8, 11 y 12 se traban igual en `q_combate`. Es el bot, no el juego.
  - En la 8 el Encanto llega antes que en la base y lo último para Piedra son los planos (suerte de la expedición).
  - 38 o más adelanta los rangos 3 y 5; 30 o 32 hacen fallar más el Pase. Detalle en DESIGN-CORE.md §8.w.
  - Si el orquestador quiere 12/12 sí o sí, lo que queda es arreglar el bot (que busque 3★ cuando la misión lo pide), no
    el Encanto.
- **Docs:** CLAUDE.md (intro, `npm test`, `?scene`), DESIGN.md (estado, eventos, arte, Mi Casa → retirada, pruebas),
  DESIGN-CORE.md (§7.1, §7.3 guardado v6 nuevo, §8.w balance), DESIGN-AUDIO.md (lugar `home` → pantallas tranquilas) y
  DESIGN-COMBAT.md. Los handoffs viejos quedan como historia.
- **`npm test`** (sin bump), cada suite en verde corrida sola: e2e 104, migración 93, colocación 65, stress 15, visitas 20,
  mock 91, social 65, rango 32, obras 39, expedición 30, ciclo 67, amenazas y telemetría ok, ajustes, historia 107,
  ambiente, audio 72, combate 100, escena de combate 29, combate-exp 75, clases 80, look de clase 51, Raíz 60, Acto 1 84 y
  SQL 183. En la cadena larga fallaron por tiempo stress, expedición e historia; solas pasan.
  - `test-audio`: lo que esperaba el WIP para la «pantalla tranquila» estaba mal (reverb `open`); la pieza `calm` usa
    `interior`. Corregido.
  - **`test-people` da 29 bien y 2 mal** («la llegada se cuenta con una escena»): **falla igual en master** (`a335752`,
    con su propio servidor), no es del 1c. Queda para quien toque `people`/historia.
- Captura del Diario con los Logros: bien (2 de 4 cumplidos, el de Joyas solo porque se ganó). Encanto de arranque 36.

### 3a · Motor de cinemáticas (rama `claude/trav-3a-4f363c`, sin bump)
Hecho:
- **`src/cinema/timeline.js`** (sin three ni DOM; se prueba en node):
  - cámara de varios puntos con curva Catmull-Rom y `fov`, ease por pista o por tramo; `travel()` es el travelling de
    dos puntos de siempre;
  - subtítulos `{ at, text | lines, voice }`: con voz grabada duran lo que el audio más 0,45 s y estiran el plano;
    sin voz, el tiempo de lectura (2,6 palabras/s);
  - fundidos de luz (`lights`), eventos (`sfx`, `stinger`, `voice`, `shake`, `label`, `run`) que se disparan una vez;
  - `createTimeline` con `hold`, `tail` y `refit()` (cuando llega el manifest con las voces).
- **`src/cinema/player.js`**: `createCinema(ctx, container, { r, shots, prefix, title, applyLight, onShot, onFinish,
  shake, advanceSfx })`. Barras, fundido, subtítulos de varias líneas, título, puntos, Saltar, voz con la música baja,
  carteles 3D, temblor y planos con `vignette` (canvas 2D encima). Los estilos van por prefijo: **`intro.js` usa `in`,
  así siguen sus clases `.in-sub`, `.in-skip`, etc.**
- **`intro.js` corre sobre el player** sin cambiar lo que se ve: los mismos 6 planos, la cámara que sigue a los que
  roban (`camFn`), el temblor de la grieta y el título. `test-story` 107/0; capturas en `shots/intro-*.png`.
- **`src/cinema/poses.js`**: `applyPose(model, nombre, { w, t, side, look, p })` después de `update`, para señalar,
  cargar, empujar, pelear, caer, agarrar, entregar, mirar y arrodillarse (acepta alias sin tilde o en inglés);
  `poseWeight`, `handOf`/`holdProp`/`dropProp` (las manos de los ecos) y `prop('cristal' | 'caja' | 'carta' | 'bolsa'
  | 'farol' | 'pala')`.
- **`src/cinema/labels.js`**: `createLabels(container, r).introduce(id, pos, nombre, línea)` con
  `createOverlays`/`project`; lo ya presentado no se repite (`seen`, se puede pasar de afuera para guardarlo).
- **`src/cinema/pixel2d.js`**: viñetas 320 × 180 sin suavizado. Capas con paralaje que se pintan una vez, capas
  vivas, actores con los sprites de `sprite2d.js`, utilería con brillo, partículas (chispa, polvo, brillo), tweens,
  guion con `at()` y cámara 2D (paneo, zoom entero, temblor). `seek(t)` es determinista. Pinceles: `skyBands`,
  `rooftops`, `cobbles`, `halo`, `pixels`, `dither`.
  - Demostración **`forcejeo`** (~8 s): de noche frente al depósito, alguien sale con un cristal de veta, el guardia
    le cierra el paso, forcejean a 3×, el cristal cambia de mano y quien robaba cae. Galería: `tools/cinema.html`
    (`?view=strip&k=1`, `?t=4.6&k=3`); capturas `shots/vineta-4.png` y `shots/vineta-46.png`.
- **Retoques de sprites** (comparados con la referencia): armas más grandes y claras (espada 11, hacha y martillo con
  cabeza grande, lanza 14, bastón alto con gema grande); el asta se acorta para que la cabeza entre siempre (el martillo
  en `strike`); casco y yelmo más arriba, sin nasal y con carrilleras finas, así la cara se lee; al caminar los brazos
  se balancean (`swing`/`back`). `test-sprite2d` 14/0.
- **Audio**: `audio.track(id)` (pistas `track/<id>`, categoría `music`, se bajan en el splash), `audio.voice(id)`,
  `audio.voiceDur(id)` y `audio.prepareVoice(ids)`. Detalle en DESIGN-AUDIO.md → "Pistas grabadas y narrador".
- **Narrador**: `tools/audio/narrate.mjs` (`--models`, `--samples`, `--script intro --voice X`) y `prepare.mjs --voice`.
  Con una indicación suelta delante, Gemini la leía en voz alta (salían 30 s); con notas de dirección (perfil, escena,
  notas, TRANSCRIPT) lee solo la línea, y cada toma se transcribe para comprobarlo. Guion en `src/cinema/narration.js`.
  - **Se mandaron 3 muestras al usuario** (Charon, Algenib y Fenrir, `gemini-3.8-flash-tts`) de "Antes del cielo hubo
    una sola tierra. Y por dentro, estaba viva." (`shots/voice/muestra-*.m4a`). **Eligió Fenrir** (2026-11-09):
    queda como `VOICE` por defecto en `narrate.mjs` y la línea de apertura está grabada en
    `assets/audio/voice/intro/01.m4a` (7,6 s). LICENSES.md suma la sección "Narrador" (no es CC0; `test-audio` lo
    acepta solo para ese crédito).
- **`tools/test-cinema.mjs`** (en `npm test` después de test-sprite2d, y `npm run test:cinema`): 54 ok, con la línea
  grabada sonando por el bus de voz y la música baja. `test-audio` 72/0.

Queda:
- El 3b escribe sus líneas en `narration.js`, las graba con `npm run narrate -- --script intro` (Fenrir por defecto)
  y las pone en los planos con `subs: [{ at, text, voice: 'intro/NN' }]`.
- El bump (orquestador) tiene que sumar `assets/audio/voice/` al `sw.js`.
- El cuadro tendido de `caer` sigue saliendo de girar la figura (se ve en el forcejeo); conviene dibujarlo.
- Las bestias (lobos, etc.) no tienen sprite.
- Cuando entre el 4a, los subtítulos y carteles nuevos van con `t()`. Este paso no escribió textos de juego nuevos,
  salvo la línea de apertura en `narration.js` (es la de siempre) y los de la demostración, que van en el código de
  la viñeta y de la prueba.

