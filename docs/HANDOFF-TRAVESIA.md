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

## Estado
| Paso | Qué | Sesión | Estado | Rama o commit |
|---|---|---|---|---|
| — | Plan, handoff y referencia de sprites (`docs/ref/`) | orquestador | hecho | (este commit) |
| 1a | Armas y armaduras fuera del cuerpo, `test-gear-fit` y galería de clases | — | por empezar | `claude/trav-1a` |
| 1b | Íconos originales, tanda 1 (sistemas), `icons.html` y `test-icons` | — | por empezar | `claude/trav-1b` |
| 1b-2 | Íconos, tanda 2 (las 108 láminas de Hallazgos) | — | después del 1b | |
| 1c | Sacar Mi Casa y guardado v6 | trav-1c + su continuación | hecho (sin bump) | `claude/zealous-hellman-0f063d` (sale de `claude/trav-1c-a593b3`) |
| 1d | Generador de sprites 2D por capas, animaciones y `sprites.html` | — | por empezar | `claude/trav-1d` |
| 2a | Nivel único, talentos, arsenal, maestría y fuerza | — | después del Bloque 1 | |
| 2b | Cuartel, reclutas y encargos | — | después del 2a | |
| 2c | Archipiélago, travesía por rutas, farmeo, "Zarpar" y la vuelta a casa | — | después del 2a | |
| 2d | Elementos: reacciones, Santuario, fragmentos y nodos de veta | — | después del 2c | |
| 3a | Motor de cinemáticas, viñetas 2D, narrador Gemini y `audio.track` | — | después del 2c | |
| 3b | Cinemática "El Quiebre" nueva | — | después del 3a | |
| 3c | Cinemáticas de llegada a cada isla | — | después del 3a | |
| 3d | Guía interactiva de Vera (spotlight) | — | puede ir con el 2c | |

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
