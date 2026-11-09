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
| 1c | Sacar Mi Casa y guardado v6 | — | por empezar | `claude/trav-1c` |
| 1d | Generador de sprites 2D por capas, animaciones y `sprites.html` | trav-1d | hecho (primera tanda de arte; quedan retoques, ver notas) | `claude/trav-1d-1bf7ee` |
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
