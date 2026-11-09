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
- **Modelo (pedido del usuario, 2026-11-09).** Todas las sesiones van con Opus 5.5 (`claude-opus-5-5`) y esfuerzo
  medio: se pasa en `start_session` y se ajusta con `set_session_model` y `set_session_effort`.
- **Detalle en las animaciones (pedido del usuario, 2026-11-09).** En cada animación, cinemática, viñeta 2D, sprite o
  modelo con pose, los detalles van cuidados cuadro a cuadro:
  - nada sobrepuesto: armas, utilería, ropa y personajes no se atraviesan ni se tapan mal entre sí, tampoco en los
    cuadros de paso;
  - nada que no se entienda: cada objeto o detalle tiene que leerse a tamaño real (qué es y quién lo tiene). Si no se
    lee, se agranda, se simplifica o se saca;
  - se revisa cuadro a cuadro (galería o capturas) antes de cerrar, no solo el cuadro quieto.
- **Tono.** Español rioplatense, cálido y sobrio, sin diminutivos (Guía de tono de DESIGN.md).
- **Idiomas.** Desde que se integra el 4a, todo texto nuevo va por `t()` con su clave en `src/i18n/es.js`. Nada de
  texto escrito directo en el código.

## Estado
| Paso | Qué | Sesión | Estado | Rama o commit |
|---|---|---|---|---|
| — | Plan, handoff y referencia de sprites (`docs/ref/`) | orquestador | hecho | (este commit) |
| 1a | Armas y armaduras fuera del cuerpo, `test-gear-fit` y galería de clases | trav-1a-armas | integrado | master |
| 1b | Íconos originales, tanda 1 (sistemas), `icons.html` y `test-icons` | trav-1b-iconos | integrado | master |
| 1b-2 | Íconos, tanda 2 (las 108 láminas de Hallazgos) | — | después del 1b | |
| 1c | Sacar Mi Casa y guardado v6 | trav-1c-micasa → trav-1c2-micasa | integrado | master |
| 1d | Generador de sprites 2D por capas, animaciones y `sprites.html` | trav-1d-sprites | integrado (quedan retoques de arte, ver notas) | master |
| 2a | Nivel único, talentos, arsenal, maestría y fuerza | trav-2a → trav-2a2 → trav-2a3 | **hecho** (sin bump): rebasado sobre v57, `fightRate` 1,5, textos a `t()`, `npm test` entero sin confirmar (primera parte ✔, ver notas) | rama `claude/nifty-nightingale-01cb64` |
| 2b | Cuartel, reclutas y encargos | — | después del 2a | |
| 2c | Archipiélago, travesía por rutas, farmeo, "Zarpar" y la vuelta a casa | — | después del 2a | |
| 2d | Elementos: reacciones, Santuario, fragmentos y nodos de veta | — | después del 2c | |
| 3a | Motor de cinemáticas, viñetas 2D, narrador Gemini y `audio.track` (más retoques de sprites del 1d) | trav-3a-cinema | integrado (voz: Fenrir) | master |
| 3b | Cinemática "El Quiebre" nueva | — | después del 3a | |
| 3c | Cinemáticas de llegada a cada isla | — | después del 3a | |
| 3d | Guía interactiva de Vera (spotlight) | — | puede ir con el 2c | |
| 4a | Base de idiomas: `t()`, selector, fuentes cirílico y CJK, `test-i18n` | trav-4a-idiomas, trav-4a2 | **hecho**: base en master; HUD y ciudad a claves en `claude/trav-4a2-ea2158` (sin bump) | master + rama |
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

### 1b · Íconos originales, tanda 1 (rama `claude/trav-1b-e6ea29`, 2026-11-09)
- **Sistema** (`src/core/icons.js` + `src/core/icons/`):
  - cada ícono es una grilla de texto de 16×16 y otra de 24×24 con la paleta de `icons/palette.js` (11 rampas claro ·
    base · oscuro sacadas de los tokens, más tinta, sombra y brillo);
  - el contorno de tinta se agrega solo, y para cada tamaño se elige la grilla y el factor entero que más llenan
    (16 → 16×1, 20 → 24×1 a dpr 1,25, 32 → 16×2, 48 → 24×2);
  - siete familias, 158 íconos: `res` 15, `ui` 29, `hud` 22, `weather` 20, `land` 27, `combat` 24, `meta` 21;
  - `registerTint(id, base, {carácter: '#hex'})` tiñe un ícono: los cofres por rareza en `season-ui-common.js`.
    `registerIcon` queda solo para canvases (miniaturas 3D, banderas, `art()`);
  - se borraron los DEFS vectoriales viejos, `EMOJI`, `ALIAS` y `chestLayers`. También salieron los tiernos: fairy,
    wizard, bear, paw, cake, ribbon y wand;
  - `drawEmoji` queda como último recurso, con `console.warn` y `window.__iconMisses`;
  - `icons/legacy.js` traduce emojis e ids viejos (`crown`→`medal`, `car`→`skiff`, `album`→`finding`…). Sirve
    para partidas, mensajes y el ❤️ que guarda `schema.sql`.
- **Usos:** todos los `emoji`/`icon`/`ic` de los datos y las llamadas `icon('…')` usan ids, y no queda ningún
  emoji en el código salvo el álbum.
  - En `net-mock`, `social-*` y `events.js` los emojis del texto se sacaron. En `events.js` la estrella quedó como ★.
  - `test-e2e` buscaba `[data-pi="🍞"]`: ahora busca `prov`.
- **Galería** `tools/icons.html`:
  - `?fam=` e `?ids=` filtran;
  - `?sheet=1` arma la hoja compacta;
  - cada tarjeta muestra la grilla de 16 ×4 y la de 24 ×3, el ícono a 16/24/32 sobre fondo oscuro y claro, la prueba
    de grises y la silueta;
  - se captura con `GALLERY_PAGE=icons.html node gallery-shot.mjs "sheet=1" ../shots/icons/sheet.png 1280 1740`.
- **Test** `tools/test-icons.mjs`, primero en `npm test`, va en Node y tarda menos de un segundo:
  - revisa las grillas: tamaño, paleta, borde vacío y que no sean de un solo tono;
  - recorre los datos y sus campos de ícono;
  - revisa las llamadas literales y que no haya emojis en el código.

  Saltea solo `album.js` y `album-art.js` (tanda 2).
- **DESIGN.md**: la regla de los emojis pixelados se cambió por las reglas de lectura (silueta a 16 px en negro,
  grises, una idea, nada de copiar el emoji, mismo trazo y luz).
- **Criterio de arte:** se dibujó por familias y cada una pasó dos o tres vueltas con capturas, grises y silueta.
  Después hubo una vuelta de corrección de los más flojos (humo, visitas, cuerda, colonos, materiales, rank7, daga,
  mano, equipaje).
  - Metáforas cambiadas: `handshake` (Visitas) es una puerta abierta con luz adentro, `sync` una nube con dos
    flechas, `build` el armazón de una casa en obra, `el-marea` una gota.
  - Siguen dudosos a 16 px: `rope`, `pu-humano` (la espiga), `settlers` y `rank2`.
- **Cruce con el 1c:** rebasado sobre `1e08b7f` (v54, con el 1c).
  - En `chests.js`, `season.js`, `season-ui.js`, `season-ui-common.js` y `main.js` quedó lo del 1c (sin muebles,
    `coins_l`, el aviso v6) con los ids nuevos.
  - `achievements.js` (nuevo del 1c) usaba `album` y ahora usa `finding`.
  - El test ya no saltea Mi Casa, y no queda ninguna referencia a muebles ni a `mi_casa` en lo del 1b. `home` sigue
    siendo el ícono de la casa (volver a la ciudad, la categoría Casa).
  - Después del rebase: `test-icons` OK, `test-e2e` 104/0 y `test-migration` 93/0, cada uno corrido solo.
- **`npm test`** (corrida anterior, rebasado sobre `db9dff3` con el 1a y el 1d):
  - Verde: icons, e2e, migration, place, stress, visit, mock, social, rank, works, home, expedition, cycle, threats,
    telemetry, ambience, audio, combat, combat-scene, combat-exp, classes, class-look, gear-fit, sprite2d, raiz, act1 y
    sql.
  - `test-settings` da 80/3 (contador de FPS y `ambience-fx.js:62` leyendo `.y` de una partícula que no existe). Da
    igual en `master` limpio: no es del 1b.
  - `test-people` da 29/2 (llegada de Brígida sin texto). También falla igual en `master`.
  - `test-story` es intermitente en esta rama: falló 3 veces, cada vez en algo distinto (premio del día, t3 al
    cosechar, "Ver El Quiebre"), y después pasó 3 veces seguidas 107/0. En `master` pasó las 2 veces que se probó.
    Si vuelve a fallar al integrar, mirar primero los tiempos de espera.
- **Para después:**
  - Tanda 2: las 108 láminas de Hallazgos (`album*.js`), que todavía usan emojis.
  - Ícono propio para "líder" (hoy `settlers`), "jefes" (hoy `medal`) y "accesorio" (hoy `bag`).
### 4a · Base de idiomas (rama `claude/trav-4a-b849e1`)
**Hecho** (commit sin bump; `npm run bump` regenera `sw.js` con las fuentes nuevas de `fonts/`):
- **`src/core/i18n.js`**: `t(clave, vars)`, `tn(clave, n, vars)` con `Intl.PluralRules` (plurales como objetos
  `{ one, other }`), `fmtNum`, `fmtDate`, `canvasFont(px)` para el texto en canvas, `translateDom(el)` para
  `data-i18n` / `data-i18n-html` / `data-i18n-attr`, `matchLang` y `pickSystemLang`.
  - Diccionarios en `src/i18n/<código>.js` (`export default { clave: texto }`), cargados con `import()`.
  - Si falta una clave, muestra el español, avisa una vez y la anota en `missing`.
  - Al cambiar `settings.lang` carga el diccionario y la fuente, y recién ahí emite **`lang:changed`**: los paneles y el
    HUD repintan con ese evento, no con `settings:changed`. `main.js` ya llama `hud.refresh()` con él.
- **Idiomas.** Hay 224 claves en es, en y ja (Ajustes completo, splash y comunes). zh-CN, ru, pt-BR, de, fr y ko están
  vacíos y caen al español hasta el 4b.
- **Elegir idioma.**
  - Nuevo `settings.lang` (`''` = sin elegir) y pestaña **Ajustes → Idioma** con los 9 idiomas, cada uno en su nombre.
  - La primera vez toma el idioma del sistema y lo guarda: `navigator.languages`, y en Tauri `systemLocales()` de
    `desktop.js`. WebView2 y WKWebView ya dan el locale del sistema operativo; si algún día se suma `tauri-plugin-os`,
    su `locale()` va primero solo. Si el sistema está en un idioma que el juego no tiene, va inglés.
  - **Navegadores de prueba** (`navigator.webdriver`): arrancan en español, para que los tests escritos en español
    sigan andando.
  - `?lang=xx` manda sobre los Ajustes sin guardarse. `?pseudo=1` estira cada texto ~35 % para probar el alemán.
- **Splash.** El script inline de `index.html` adivina el idioma (?lang, el guardado o el del sistema). Si no es
  español, esconde los textos (`html.i18n-wait`) hasta que `main.js` los traduce con `__boot.lang()`. Si el arranque
  falla, los avisos salen en inglés.
- **Fuentes.**
  - Pixelify Sans se descartó: le faltan la О y la П cirílicas en mayúscula, verificado con fontTools.
  - Se eligió **Fusion Pixel 12px proporcional** (OFL 1.1, TakWolf, versión 2026.10.25). Es una sola familia para el
    cirílico y el CJK, con variantes ja, zh_hans y ko. Jersey 10 sigue para todo el latín, incluidos ß, ç, ã y œ, que
    verifiqué.
  - `tools/subset-fonts.mjs` baja la fuente a `tools/.cache/` (ignorada) y arma `fonts/pixel-ja.woff2` (21 KB),
    `pixel-cyr.woff2` (5 KB) y `pixel-names.woff2` (1 KB, los nombres de los idiomas para el selector, con
    `unicode-range` en `styles.css`). zh-CN y ko se arman solos cuando su diccionario tenga texto. `--check` avisa si
    falta un glifo.
  - `i18n.js` carga la fuente del idioma con `FontFace` solo en ese idioma, y usa respaldo del sistema si falta.
  - Las licencias están en `fonts/OFL-*.txt`. `gen-sw-core.mjs` ya lista todo `fonts/*.woff2`, así que el bump las suma.
  - En CJK: `html[data-script=cjk]` sube el alto de línea.
- **Interfaz flexible en Ajustes.** La columna de pestañas crece con el texto, y las opciones segmentadas bajan de
  línea en vez de cortarse.
- **`tools/test-i18n.mjs`** está en `npm test`; con capturas, en `shots/i18n/`. Revisa:
  - claves, variables, etiquetas y formas de plural por idioma;
  - la lista `PASSED` de archivos sin texto con tilde: `i18n.js`, `settings.js` y `panels-settings.js`;
  - glifos de cada idioma contra su fuente (`tools/font-cmap.mjs`);
  - unidades;
  - cambio en vivo, `?lang` y splash en ja;
  - pestañas de Ajustes en ja, de (pseudo) y en sin texto cortado.
- **Docs.** La regla nueva está en CLAUDE.md y en DESIGN.md (Guía de tono).
- **Dependencias de desarrollo nuevas en `tools/`:** `subset-font` y `fontverter`. Solo las usan las herramientas; el
  juego no suma nada.

**HUD y ciudad a claves (sesión trav-4a2, rama `claude/trav-4a2-ea2158`, sin bump): hecho.**
- **Archivos pasados a claves (prefijos `hud.`, `city.`, `ui.` y `common.`):**
  - `src/core/hud.js` entero: botones, aria-labels, `data-tip`, `title`, chips, globitos y el riel. `render()` rearma
    todo con `lang:changed`; el título del rango, el del pase y la pista de provisiones se rearman con cada refresco.
  - `src/scenes/city-ui.js` entero: menú Construir (candados, cintas, chips), ficha de edificio, municipalidad,
    terreno, constructoras, Raíz y Grieta, y expandir. Los "se le suma…" por nivel y época van con claves armadas
    (`city.look.art.<nivel>[shop]`, `city.look.vert.<época>`, `city.look.plain.<nivel>`, `city.look.cycle.<nivel>`).
  - `src/scenes/city.js`: flecha guiada, carteles de nivel y maestría, avisos, y los botones flotantes. Estos
    se repintan con `lang:changed` (`applyLang()`).
  - `src/core/ui.js`: "Cerrar" (`common.close`), `confirm()`, `rewardModal()` y los costos.
- **Claves:** 428 en es, en y ja (eran 224). Las de `de`, `fr`, `pt-BR`, `ru`, `zh-CN` y `ko` quedan para el 4b.
- **Qué queda en español a propósito:** lo que llega armado de otros módulos sigue en español hasta el 4b:
  - nombres de `data.js` (edificios, categorías, rangos, épocas, descripciones);
  - los `reason` de `economy.js` y `raiz.js` ("Nivel 5", "Rango Caserío"…);
  - `chipText` de las amenazas;
  - las misiones;
  - `city-place.js` y `city-common.js` (los carteles "1 zona" y las frases de la gente).
  - Para no depender del texto, `city-ui.js` ya no compara `can.reason === 'Ya lo tenés'`: usa `isOwned()`. Lo
    mismo con `'No te alcanza'`, que ahora es `can.poor`. Sigue comparando `'Constructoras ocupadas'` y
    `'Faltan materiales'` (Raíz) contra `economy.js`/`raiz.js`: **en el 4b, darles una bandera
    (`busy: true`) antes de traducir esos `reason`.**
- **Fuente:** Jersey 10 no tiene "→" (el "Encanto 12 → 15" de las fichas). Se sumó a `fonts/pixel-names.woff2`,
  con `SYMBOLS` en `subset-fonts.mjs` y `U+2192` en el `unicode-range` de `styles.css`. `test-i18n` acepta
  pixel-names como respaldo en todos los idiomas. `pixel-ja.woff2` se rearmó (970 caracteres, 24,7 KB).
- **Interfaz flexible:**
  - `.cx-actions` de la ficha pasó de grilla de 90 px a flex que crece con el texto ("あなたの町" y el alemán no
    entraban).
  - Los nombres del riel (Temporada, Bitácora) cuelgan centrados. Si uno largo se sale por el borde derecho,
    `fitRail()` de `hud.js` lo corre hacia adentro; corre al pintar, al cambiar el tamaño y cuando cargan las fuentes.
- **`test-i18n` (100 pruebas):**
  - `PASSED` suma `hud.js`, `ui.js`, `city-ui.js` y `city.js`, y revisa que cada clave escrita entera exista en
    es.js.
  - Nuevo `checkCity()` en ja, de (`?pseudo=1`) y en, con `?cheat=15`: el HUD, el menú Construir y la ficha de la
    municipalidad, sin texto cortado y sin botones del HUD encimados ni fuera de la ventana. Lo que cuelga con
    `position: absolute` (globitos, puntos) no cuenta.
  - Capturas en `shots/i18n/city-*.png`, `build-*.png` e `info-*.png`. Las miré a ojo en ja y de: nada cortado,
    nada encimado y nada de tofu.
  - Prueba el repintado en vivo del HUD, de los `data-tip` y de los botones flotantes al cambiar a ja.
- **Para el 4b:**
  - seguir con `city-place.js`, `city-common.js`, `panels-*.js` y los textos de `data.js` (los nombres van por
    clave de id, p. ej. `bld.<id>.name`);
  - traducir las 428 claves a de, fr, pt-BR, ru, zh-CN y ko;
  - correr `node tools/subset-fonts.mjs`.

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

- **Revisión cuadro a cuadro** (regla nueva del usuario: nada sobrepuesto, todo se tiene que entender):
  - sprites (`sprites.html?view=anims&set=all&rows=a-b`: las 6 clases, el tirador y lanza, escudo, farol, libro y orbe,
    con caja, veta, carta y bolsa):
    - el arma levantada para el golpe va detrás de la cabeza (antes cruzaba el casco o la cara);
    - el objeto que se levanta se corre afuera de la cabeza sin soltarse de la mano;
    - la carta lleva solapa y sello rojo, y la bolsa es un saco atado con una moneda;
    - el anuro: el sombrero baja (`hatDy`) y los ojos saltones van encima (`eyesOver`);
    - la lanza al frente sale de la mano, sin contera atravesando el torso.
  - viñeta: el forcejeo es un tironeo con los dos brazos estirados sobre el cristal, a 24 px uno del otro (no se
    pisan). El cristal va encima de las manos y salta en arco por encima de las cabezas hasta la mano del guardia. El
    guardia va sin espada, así no aparece y desaparece un arma entre gestos.
  - poses 3D (`cinema.html?view=poses`, de frente y de perfil):
    - `cargar` con `holdBoth` (la caja entre las dos manos);
    - `caer` con las piernas en el piso;
    - `arrodillarse` con las piernas atrás y el cuerpo bajado hasta tocar el piso (se mide con la geometría,
      `groundGap`);
    - el cristal 3D es un rombo celeste, la caja y la carta son más grandes.
  - pruebas: `test-sprite2d` 14/0 y `test-cinema` 56/0 (suma "caja entre las dos manos" y "de rodillas apoya en el
    piso").

Queda:
- El cuadro tendido de `caer` en 2D sigue saliendo de girar la figura: se entiende, pero se puede dibujar mejor.
- El arco tenso cruza el pecho con la cuerda, como el de la referencia; si molesta, acortar la V.
- El 3b escribe sus líneas en `narration.js`, las graba con `npm run narrate -- --script intro` (Fenrir por defecto)
  y las pone en los planos con `subs: [{ at, text, voice: 'intro/NN' }]`.
- El bump (orquestador) tiene que sumar `assets/audio/voice/` al `sw.js`.
- Las bestias (lobos, etc.) no tienen sprite.
- Cuando entre el 4a, los subtítulos y carteles nuevos van con `t()`. Este paso no escribió textos de juego nuevos,
  salvo la línea de apertura en `narration.js` (es la de siempre) y los de la demostración, que van en el código de
  la viñeta y de la prueba.

### 2a · Nivel único, talentos, arsenal, maestría y Fuerza (rama `claude/trav-2a-e5cfa6`, sin bump) · **CORTADO, sigue otra sesión**
Diseño completo de las APIs: `side-session-notes/…/2a-diseno.md`; balance: `…/2a-balance.md`. Docs: DESIGN-COMBAT.md §18 y
DESIGN-CORE.md §7.4 (guardado v7).

Hecho:
- **Nivel único** (`NIVEL` en `src/combat/classes.js`, tope 50, `need = 40·n^1,6 + 20`, `fightRate` 2, paragon cada 8000).
  La xp vive en `state.classes.leader.xp`; `store.addXp` reparte premios y avisa `level:up` / `leader:levelup` / `paragon:up`;
  `levelOf(s)` en state.js para cualquier partida o perfil (también los v6 online). El combate usa `combatLevel(Nivel)` (la escala
  vieja del líder), así el Acto 1 queda balanceado igual. `player.level/xp` ya no existen en `src/` (grep limpio).
- **Guardado v7** (`migrateV7`, después de `migrateClasses`): el más alto de los dos niveles con su fracción; `s.v7`. `test-migration` 105 ✔.
- **Arsenal** (`src/core/arsenal.js` puro + `src/core/gear.js`): 7 tipos, 5 rarezas, 1–2 rasgos, afinidad elemental como rasgo de
  rareza (+1 de daño a habilidades de su elemento), contador de suerte, tope 40, equipar/sacar/rehacer/desarmar/filtro. Caen al ganar
  (jefe siempre) desde `creditFightGear` en `expedition.creditFight`.
- **Maestría** 1–20 por tipo (curva de `MASTERY_STEPS`, ahora en data.js), técnicas en 3/6/10, vida en 2/5/8, marcos 4…20; objetos
  del Taller 1–10 (+1 efecto en 4 y 8, `itemPlus` en newBattle).
- **Talentos** (`src/core/talents.js`): 3 ramas, 16 talentos (36 puntos), lo que sobra y el paragon a una línea por rama.
- **Fuerza** (`src/core/power.js`): `powerOf`, `recPower`, `foeScale` (la mitad de lo que sobra sobre la recomendada); `newBattle({ gear,
  power, itemPlus, foeExtra })`.
- **Interfaz**: Progreso ordenada Nivel · Talentos · Maestrías · Fuerza (`panels-progress.js`), panel `panels-arsenal.js` (desde Progreso y
  el Taller), avisos de maestría y de arma (`people.js`), punto de talento en el panel de subida, HUD "Nivel N", arma equipada en el
  modelo (`gear.heldGear`, ciudad/expedición/combate). Capturas `shots/2a-*.png`; en la del modelo las 5 armas se leen sin cruzar el
  cuerpo (son piezas de GEAR que ya cubre `test-gear-fit`; rareza y rasgos no cambian la forma ni el color).
- **Pruebas** (cada una sola): `test-arsenal` 122 ✔ (nueva, en `npm test` y `test:arsenal`), `test-migration` 105, `test-classes` 81,
  `test-combat` 100, `test-e2e` 104, `test-mock` 91, `test-people` 31 (arreglado de paso lo de la llegada de Brígida), `test-class-look` 51,
  `test-telemetry` 67 (arreglado `install-card.js`). **`npm test` entero sin correr.**
- **sim:combat** (`--n 20`): sección "Fuerza" nueva, todo ✔ (recomendada 86–92 % en los comunes; menos da menos; más gana igual o más).

**Falta (lo que sigue la sesión nueva):**
1. **`sim:economy` semillas 1–12 en verde.** Hoy, sin contar la meta nueva, solo 2, 9 y 10 dan ✔; las otras fallan por poco en metas al
   borde (Nivel como último requisito 33 % en 1 y 6; primer monumento día 8–9 en 3, 4 y 6; monedas al llegar 69–73 % en 5, 8 y 11;
   rango 2 el día 2 en 7 y 8; rango 5 el día 17 en 12). Master tras el 1c daba 2 fallas en 1–12. Sospechas: el bot nuevo (resuelve rápido,
   camina a buscar peleas, desarma) cambia el ritmo de monedas y materiales; probar `--no-farm` / `--no-gear` para separar qué mueve cada
   meta, y el exponente de `NIVEL.need` (1,6) con `fightRate` (2).
2. **Meta "al menos un avance por rato"** (nueva en sim-economy): da 51–63 % contra 90 %. Armas y maestría salen solo de peleas y hay
   0–2 por salida normal en ratos de 10 min. Decidir: medirla con ratos de 20 min (el plan dice "un rato de 20 min"; da ~63 %), sumar
   casillas enemigo (`EXP.enemy` en exp-data), dar maestría/armas también fuera de la pelea (botín de la salida, cofres: `gear.dropWeapon`
   con `source: 'cofre'` ya existe), o dejar la meta para el 2c (rutas con pelea segura). Mientras tanto `--seeds` sale con error.
3. DESIGN-CORE.md §8: anotar el balance final del 2a (no está escrito). Correr `npm test` entero.
4. Rebasar sobre `master` cuando entre el 1b (íconos) y, si ya está el 4a, pasar los `TXT` de arsenal.js, talents.js, gear.js,
   panels-progress.js y panels-arsenal.js a `t()`.

### 2a, segunda sesión (rama `claude/trav-2a2-7cba92`, sin bump) · **CORTADO por contexto, sigue otra sesión**
Hecho:
- **Rebase sobre `master`** (con 1a, 1b, 1c, 1d y 4a): los 3 commits del 2a se juntaron en uno (respaldo de la rama vieja:
  `backup-trav-2a-pre-rebase`). Conflictos: `package.json` (test-arsenal en `npm test` junto a icons e i18n), `test-people`
  (la versión de master), `panels-progress.js` (la navegación del 2a; «La ciudad» con el ícono `castle`), CLAUDE.md, este archivo.
  Emojis `⚔️` del 2a → id `sword`. **`test-icons` OK.**
- **Idiomas:** todo el texto de `arsenal.js`, `talents.js`, `gear.js`, `panels-arsenal.js` y lo nuevo de `panels-progress.js`
  pasó a `t()`/`tn()` (234 claves `arsenal.*`, `talents.*`, `gear.*`, `progress.*`; getters, así cambia en vivo), traducido a en y
  ja, `fonts/pixel-ja.woff2` regenerada. Los 5 archivos nuevos están en `PASSED` (panels-progress no: tiene texto viejo).
  **`test-i18n` 69 ✔ / 0 ✘, `test-arsenal` 122 ✔** (antes del cambio de fightRate/curva). Falta: `people.js` (avisos de maestría y
  arma), `panels-workshop.js` (`arsenal`, `arsenalHelp`), `panels-rewards.js` (`talent`, `paragon`) y los nombres de `ELEMENTS`.
- **Meta de Avance, decidida:** se mide por **cada 20 min de juego** (los ratos seguidos se juntan hasta 20 min: con 2 ratos
  de 10, uno por día), como dice el plan; la tasa por rato de 10 min se muestra aparte. Y en el juego: **arma del camino**
  (`EXP.weaponFind` en exp-data: una salida normal con ≥ 1★ en la que ninguna pelea dejó arma trae una con 30 %, rareza de pelea
  común, `source: 'camino'`; `summary.weapon`). Con eso Avance da 32–35/36 semillas (fallan con 86–88 %).
- **Bot de sim-economy:** rehace rasgos (`rerollUp`, uno por día, hasta 3 por arma; `--no-reroll`) para que lo farmeado tenga
  dónde ir (lo pide el plan); gasta ~4 materiales y ~600 monedas por día.
- **Balance (36 semillas, `--seeds 1-36`):** la causa sistemática era que con `fightRate` 2 el Nivel iba 1 adelante los días 2–7
  (desbloqueos y premios antes → monumento, Pase y rango 5 temprano). Quedó **`fightRate` 1 y `need = 40·n^1,58 + 20`**.
  - Master sin el 2a: ~12 fallas semilla-meta en 36 (Monedas al llegar 4, Pase 2, rango 5 2, etc.).
  - 2a con fightRate 2 y curva 1,6 + reroll: 45. **Con fightRate 1 y 1,58 + reroll: 33** — Monedas al llegar 8/36, Avance 4,
    Pase 4 ratos 4, Pase 3, Monedas al irse 3, el resto 1–2. Sin reroll, la misma curva daba rango 5 temprano en 11/36.
  - Ojo: las metas están al borde y el azar es uno solo (cualquier tirada extra corre todo); comparar siempre con 24–36 semillas.
  - Herramienta: `scratchpad`… no queda; para probar, `NIVEL_NEED`/`NIVEL_FR` se sacaron del código.

**Falta (la sesión que siga):**
1. Bajar las fallas de Monedas al llegar (8/36; la causa probable: el Nivel ahora más lento deja compras bloqueadas). Probar
   `need` 1,58 con constante 40–60 o `fightRate` 1,5; seguir comparando con 36 semillas contra master (~12).
2. Correr `test-classes`, `test-combat`, `test-act1`, `test-arsenal` (cambió fightRate) y después `npm test` entero, de a una
   las que fallen por tiempo. `sim:combat` no depende de fightRate (usa niveles fijos), pero conviene una corrida corta.
3. DESIGN-CORE.md §8 y DESIGN-COMBAT.md §18: anotar el balance final y la meta de Avance por 20 min; `sim:seeds` del
   package.json corre 1–6.

### 2a, tercera sesión (rama `claude/nifty-nightingale-01cb64`, sin bump) · **HECHO**
- **Rebase sobre `master` v57** (3a y 4a-2). Conflictos: CLAUDE.md y `package.json` (arsenal y cinemáticas juntos),
  `hud.js` (el "Nivel N" de la estrella va por `t('city.info.level')`), `city.js` (los dos imports), es/en/ja y
  `test-i18n` (los dos bloques). Sin claves repetidas.
- **Balance:** `NIVEL.fightRate` 1 → **1,5** (curva `40·n^1,58 + 20` igual). `sim:economy --seeds 1-36`: **24** fallas
  semilla-meta (antes 33; master 12), **Monedas al llegar 35/36** (master 32/36), Avance 36/36. Fuera de muestra (37–72):
  33 contra 38 con fr 1. Lo que queda, repartido al borde: depósito al tope 5, rango 5 día 17 en 4, Pase 4 ratos 3,
  monumento día 9 en 3, Pase 2, rango 2 en 2. Tabla de todas las variantes en DESIGN-CORE.md §8.v; DESIGN-COMBAT.md §18.1 y
  §18.5 (meta de Avance cada 20 min y arma del camino).
- **Idiomas:** avisos de maestría y arma (`people.js` → `arsenal.toast.*`), el Taller (`arsenal.workshopHelp`), el punto de
  talento y de paragon del panel de subida (`talents.levelup.*`, con `tn`) y `ELEMENTS` (`element.raiz`; el getter lo pone
  `arsenal.js` para que `combat-data.js` siga puro, lo pide `test-combat`). `withText` usa prefijos con punto (así
  `test-i18n` no los toma por claves). `fonts/pixel-ja.woff2` regenerada.
- **Pruebas:** `test-classes` 81, `test-combat` 100, `test-act1` 84, `test-arsenal` 122, `test-i18n` 116, todo ✔.
  `sim:combat --n 6`: 4 metas ✘ al borde por la muestra chica (no depende de fightRate; con `--n 20` daba todo ✔).
  `npm test` entero: lo lancé y corté por la regla del 40 % de contexto con la primera parte en verde (icons, e2e 104,
  i18n 116, migration 65+105, place, stress 20, sin fallas hasta ahí). **Falta confirmarlo entero**: el orquestador lo corre al
  integrar (las que fallen por tiempo, de a una).
- Para el orquestador: `npm run bump` al integrar. El 2b y el 2c pueden partir de esta rama.

