# Handoff · El Quiebre (Pixelia para PC, historia, combate, logo Dezings)

Plan completo y aprobado: [PLAN-QUIEBRE.md](PLAN-QUIEBRE.md). Este archivo dice **dónde quedó**; se actualiza al cerrar
cada paso.

## Reglas de trabajo (vienen del usuario)
- **Notificar** con PushNotification cada vez que se termina algo (un paso, un commit importante, al abrir la sesión
  siguiente o al trabarse): un mensaje corto con lo que quedó hecho. Le llega al celular.
- **Este archivo siempre al día**: qué paso está hecho, en qué commit y quién sigue (una sesión abierta fuera de la app
  no le avisa a la sesión coordinadora).
- **Autonomía total.** No hace falta pedir permiso: instalar Rust y las Build Tools, commit y push a `master`, tags,
  releases y secrets con `gh`. Siguen valiendo las reglas de CLAUDE.md: no tocar el otro proyecto de Supabase, nunca usar
  `service_role`, y `npm run bump` antes de cada commit que cambie archivos del juego.
- **Contexto.**
  - Al pasar el 40–45 % de contexto: terminar la unidad en curso, hacer commit, actualizar este archivo y seguir en una
    **sesión nueva fresh** (no un fork).
  - El brief de esa sesión es: "leé `docs/PLAN-QUIEBRE.md` y `docs/HANDOFF-QUIEBRE.md`, seguí desde el paso N y aplicá
    esta misma regla", con todas estas reglas copiadas. Se abre sin pedir OK: primero `start_session` (fresh); si la app
    lo rechaza (pasa con Remote Control), una pestaña de terminal con `claude` en bypassPermissions. **Probado el
    2026-11-09: la terminal de la app no ve `AppData\Roaming` ni la cuenta de Claude y pide iniciar sesión**, así que en
    ese caso se deja el brief en las notas compartidas y se avisa al usuario para que la abra desde la app.
- **Calidad.**
  - Guiar lo esencial, no todo.
  - Las mecánicas tienen que ser creativas, enganchantes y balanceadas: sección I del plan.
  - Ajustes completos: sección G.
- En la raíz hay una carpeta sin seguimiento, `pixelia/`: es una copia vieja. No sumarla a los commits.
- **GPU con límites térmicos** (RTX 3060 Ti con la pasta gastada: el hotspot llegó a 102,9 °C sin tope de FPS). Para
  toda prueba que use la GPU (preview del navegador, el `.exe` con `test-desktop.mjs`, renders, cinemática):
  - siempre tope de 60 FPS o menos; nunca sin límite ni VSync a 144 Hz o más (`?fps=` baja el tope);
  - corridas cortas de 10 a 15 s, de a una, y cerrar todas las instancias al terminar (también la pestaña del preview);
  - vigilar con `nvidia-smi --query-gpu=temperature.gpu,power.draw,utilization.gpu --format=csv` y cortar si el
    núcleo pasa ~70 °C o el consumo ~100 W (el hotspot no se ve: pedirle al usuario que lo mire en HWMonitor);
  - no instalar herramientas de monitoreo sin preguntar.
  `npm test` y `smoke.mjs` usan SwiftShader (CPU) y no cargan la GPU. Estas reglas son **solo para probar
  en la PC del usuario** (pasa a 240 FPS por su monitor de 240 Hz y la pasta gastada): el juego no avisa nada a los
  jugadores. En Ajustes el tope por defecto es 60, y hay opciones de 30, 120, 144, 240 o sin límite.

## Estado
| Paso | Qué | Estado | Commit |
|---|---|---|---|
| — | Plan y handoff en `docs/` | hecho | (este commit) |
| 1 | 0: cáscara Tauri, `desktop:dev`, instalador `.exe`, Actions Win+Mac | hecho | a1f502e (v25) |
| 2a | A: logo Dezings | hecho | (commit v26) |
| 2b | E8: textos viejos, "Tocá" → "Hacé clic", pistas de misiones (`hintFor`, que adelanta E2) | hecho | (commit v26) |
| 2c | G: Ajustes completos, más el ajuste de la ventana al monitor | hecho | (commit v27) |
| 2d | J6 interfaz oscura + J7 fuera lo tierno (solo personas, estilos nuevos, guardado v4) | hecho | 3ef5f83 (v29) |
| 3 | D + E1–E4 + E7 + H: motor de historia, Bitácora con el Manual, prólogo, tutorial, primeros contactos | hecho | 97ac780 (v30) |
| 3b | J1–J5: ambiente (oscuridad por lugar, luz con la historia, día y noche, clima dinámico) | hecho | cefa551 (v33) |
| 3c | K: sonido y música (motor en `src/audio/`, mezclador por buses, música adaptativa, paisaje sonoro, 104 sonidos CC0) | hecho | 0bba507 (v34) |
| 4a | M1 + M2: personajes serios (vóxel detallado y low-poly para criaturas y jefes) y pueblos del mundo | **en curso** en la rama `claude/personajes-4a-6b06a8` (guía de arte en `docs/ARTE-PERSONAJES.md`); espera el OK del usuario con las 3 muestras antes de propagar; la integra el coordinador | |
| 4 | B + M4: cinemática "El Quiebre" y llegada corta con Vera | pendiente (después del 4a) | |
| 5 | C: combate táctico (motor y tests, escena e interfaz, casilla `enemigo`) | hecho: motor (v32), escena e interfaz, casilla `enemigo`, traspaso con la expedición, primer combate guiado y telemetría | d6f9451 + 1172274 (v35) |
| 5b | L5 + M3: personas con nombre, Vínculo, herramientas, nivel del líder, clases y subclases según los elementos, y pestaña Progreso | pendiente | |
| 6 | Acto 1 completo + E5–E6 | pendiente | |
| 7 | Balance (`sim-combat`, `sim:economy`), telemetría y primer release | pendiente | |

## Decisiones tomadas
- Plataforma:
  - Tauri v2 para Windows y macOS.
  - Los instaladores se compilan en GitHub Actions, porque el usuario no tiene Mac.
  - Sin firma por ahora.
  - Se distribuye por GitHub Releases con el actualizador.
  - La web de Pages queda sin mantenimiento.
  - Supabase sigue.
- Historia:
  - La columna vertebral es el misterio de la isla, con momentos épicos.
  - La ciudad sigue cozy.
  - El canon borrador está en el plan, y el usuario lo puede ajustar.
- Combate: táctico por turnos, en grilla de 8×8.
- Intro: cinemática 3D en vóxel.

## Lo que quedó hecho, para no rehacerlo
**Paso 1: escritorio**
- `desktop/` usa Tauri v2.
- `desktop/stage.mjs` copia el juego a `desktop/dist` y toca `lib.rs`, porque si no cargo no vuelve a embeber los archivos.
- `src/core/desktop.js`:
  - `isDesktop` / `ctx.desktop`, que también se prende con `?desktop`;
  - F11, y Ctrl+Cmd+F en Mac;
  - `setFullscreen()` / `isFullscreen()`, que esperan los Ajustes;
  - busca actualizaciones 8 s después de arrancar.
- En escritorio no hay service worker ni tarjeta de instalar.
- **Clave del actualizador:**
  - privada en `~/.tauri/pixelia-updater.key`, sin contraseña;
  - pública en `tauri.conf.json`;
  - secret del repo: `TAURI_SIGNING_PRIVATE_KEY`.
- **CI** (`.github/workflows/desktop.yml`):
  - Con tag `v*`, arma un borrador de release para Windows y Mac (universal).
  - El modo manual (`gh workflow run desktop.yml`) hace `win-check` (artefacto `windows-setup`) y `mac-smoke` (artefacto
    `mac-smoke` con capturas).
  - La corrida 42521705177 quedó en verde en las dos plataformas, y Mac abre y renderiza el juego.
- `tools/test-desktop.mjs` abre el `.exe` compilado con CDP (puerto 9333) y verifica:
  - el origen `http://tauri.localhost`;
  - `__TAURI__.updater`;
  - que no haya service worker;
  - `localStorage`;
  - que el clic arranque el onboarding;
  - que Supabase responda 200.
- `npm run bump` sincroniza `desktop/` (`pixelia-vN` pasa a `0.N.0`), y `npm run release` crea el tag.
- **Pasar la partida.** Ya existía Exportar/Importar en Ajustes, con un código. Faltaría ofrecerlo también como archivo
  `.json` en el paso 2c.

**Paso 2a: logo**
- `tools/make-logo.mjs` genera `studioHtml()`: un cubo vóxel isométrico y DEZINGS letra por letra. Los colores salen de
  variables CSS.
- Se inyecta con `node tools/make-logo.mjs --inject`, entre `<!--logo-studio-->` en `index.html`.
- La capa `#studio` va antes del splash:
  - dura 1,5 s la primera vez y 0,84 s después (flag `pixelia.studio` en `localStorage`);
  - se saltea con un clic o una tecla (la tecla no llega al juego);
  - con `?nosplash` o `?scene=` no aparece;
  - `?studio=<variante>` y `?studiohold` sirven para las capturas.
- **Variante elegida: `st-dez`**, el azul de Dezings (`#3d55b8`) con blanco, porque el usuario mandó ese color. Las demás
  (`st-brasa`, `st-cefiro`, `st-veta`) quedan en el CSS. Las capturas están en `shots/logo/`, que no se sube al repo.
- **Sonido.** Un golpe al caer el cubo y un brillo, sintetizados en el script inline. Suenan solo si el `AudioContext`
  arranca en `running` (en la app de PC sí) y respetan `settings.sfx === false` y `settings.volSfx` (0..1).
  **El paso 2c tiene que crear `volSfx`.**
- "Un juego de Dezings" va al pie del splash. Ajustes todavía no lo muestra: va en el paso 2c.

**Paso 2b: textos**
- "Tocá…" pasa a "Hacé clic…" en los textos del juego.
- Se dejaron como estaban:
  - las instrucciones de iPhone;
  - la rama `touch ?` de `city-place.js`;
  - el dicho "se mira, no se toca".
- Meta y manifest sin minijuegos.
- Consejos de carga sin diminutivos.
- Lema nuevo del splash: "Reconstruí lo que quedó".
- `hintFor` cubre todos los tipos de objetivo.
- **Falta:** el "Cómo jugar" viejo (`openHelp`) sigue con diminutivos; se reemplaza por el Manual en el paso 3 (H).

**Paso 2c: Ajustes completos**
- **`src/core/settings.js`** es el centro: `initSettings(ctx)` (en `boot`, reemplaza a `applyA11y` + `audio.configure`),
  `setSetting(patch)` (guarda, valida con `normalize`, aplica en vivo y emite `settings:changed` con `{keys, settings}`),
  `PRESETS` (Baja 100 % sin sombras ni MSAA y pocas partículas · Media 150 % · Alta 200 %), `matchPreset` y `graphicsFrom`.
  También queda en `ctx.setSetting`. Los valores por defecto viven en `SETTINGS_DEFAULTS` de `src/core/state.js`
  (`deepFill` los completa en saves viejos; `lowQuality: true` de antes pasa al preset Baja).
- **Gráficos en vivo**: `setGraphics(cfg)` de `src/core/voxel.js` actualiza todos los renderers montados (registro
  `live`) y los nuevos arrancan igual. El antialias ahora es el MSAA del pase del contorno (con `lines` en 0 si el
  contorno está apagado), así ambos se cambian sin recrear el renderer. Sombras: se recompilan los materiales.
  `frameStats.frames` cuenta cuadros dibujados (contador de FPS y test). `graphics().particles` multiplica las
  partículas de `city-fx.js` y `ui.setParticles` las del confeti. El ajuste automático de resolución solo corre con
  un preset (no en Personalizada). `?quality`, `?outline` y `?fps` siguen mandando sobre los Ajustes.
- **Preset automático**: `gfxPreset: 'auto'` en partidas nuevas; tras ≈8 s en la ciudad con foco se mide y queda Alta,
  Media o Baja (aviso si no es Alta). Con `navigator.webdriver` (tests) no se mide.
- **Sonido**: `audio.js` tiene master, música, efectos y un canal nuevo de **ambiente** (brisa y pájaros en la ciudad,
  viento en expedición y amenaza; sigue a la música). `audio.level(canal)` y `audio.setBackground(muted, suspend)`.
  Con los valores por defecto suena igual que antes. El logo de `index.html` lee `volSfx` (ya existe).
- **Pantalla** (`src/core/desktop.js`): `applyWindow(s)` (ventana / pantalla completa / sin bordes, y resolución que
  entra en el área útil del monitor), `monitorInfo()`. F11 y el botón verde de la Mac quedan recordados en `winMode`.
  La escala de la interfaz usa `setZoom` del WebView en PC (el renderer compensa con `uiZoom`) y `zoom` CSS sobre el HUD
  y los modales en el navegador. Permisos nuevos en `capabilities/default.json` (posición, maximizar, zoom).
- **Ventana en monitores chicos (resuelto)**: `lib.rs` arranca la ventana invisible, la achica al área útil del monitor
  (`work_area`) y la muestra centrada. Mínimo 800×520. `test-desktop.mjs` ahora prueba la ventana, sin bordes,
  pantalla completa, 1280×720 y zoom 125 % en el `.exe` real (todo bien en 1920×1080).
- **Controles**: `src/core/keys.js` (`KEY_ACTIONS`, `codeFor`, `actionFor`, `assignKey` que intercambia si choca,
  `keyLabel`). La ciudad (`city.js`) y la expedición (`exp-scene.js`) leen las teclas de ahí. Atajos nuevos:
  **X** abre Expedición y **O** Ajustes. Flechas, Esc, Enter, Espacio y F11 son fijas.
- **Juego**: velocidad de cámara y desplazamiento con los bordes (`city-camera.js`: `setSpeed`, `setEdge`), pistas de
  la guía (apaga la flecha de misión). **Quedan guardados para los pasos que vienen**: `textSpeed`, `skipSeen`
  (paso 3/4), `combatSpeed`, `confirmEnd`, `hiContrast` (paso 5, la clase `hi-contrast` ya está en `<html>`),
  `subtitles` (paso 4).
- **Partida**: guardar y cargar un archivo `.json` (`{juego, formato: 1, fecha, ciudad, codigo}`; usa
  `showSaveFilePicker` si existe, si no una descarga), el código de antes quedó en un desplegable, créditos de Dezings
  con la versión (la de la app en PC, la de `sw.js` en la web). "Instalar como app" solo aparece en la web.
- **Test**: `tools/test-settings.mjs` (en `npm test`).
- **Para el 2d**: el panel de Ajustes y el contador de FPS usan solo tokens de `:root` en `styles.css`
  (`--surface`, `--surface-2`, `--surface-hover`, `--rule`, `--track`, `--accent`, `--accent-l`, `--hud-ink`,
  `--hud-glass`, más los de siempre `--ink`, `--mint`…). Oscurecer = cambiar esos valores. El resto de los paneles
  todavía tiene colores claros fijos en `src/scenes/panels-style.js` (`#fff`, `#f0e4d2`…). El clima y las partículas
  nuevas del 3b tienen que leer `graphics().particles` (voxel.js) y `reducedMotion()`.
- **Para el 3c**: los volúmenes de Ajustes ya son buses en `src/core/audio.js` (`master`, `music`, `sfx`, `amb`, `ui`;
  los sonidos `tap/open/close/select/swoosh` van por `ui`). `volVoice` está guardado (1 por defecto) sin deslizador:
  el mezclador nuevo lo usa y suma la fila "Voces" en la pestaña Sonido (`panels-settings.js`, `PANES.sound`).

**Paso 2d: interfaz oscura y fuera lo tierno**
- **Tokens** (`styles.css`, `:root`; la tabla está en DESIGN.md → "Interfaz oscura"): `--ink` ahora es texto **claro**;
  los bordes usan `--edge` (casi negro) y las sombras `--shade`. Nuevos: `--ink-dark` (texto sobre dorado, menta y cielo),
  `--metal`/`--metal-l` (marco de los modales), `--wood`/`--wood-d` (cabecera de los modales, título en `--gold-t`),
  `--page`, `--coral-l` y un `-t` por acento (texto sobre oscuro). `--second` pasó a ser el azul Dezings.
  `color-scheme: dark`. **Regla para lo nuevo**: texto con `--ink*`, bordes con `--edge`, sombras con `--shade`, nunca hex.
- **Cómo se convirtió lo viejo**: un script mapeó los colores claros fijos de `styles.css` y del CSS dentro de los JS
  (fondos → `--surface*`/`--rule` o un tono oscuro del mismo matiz; `var(--ink)` en bordes → `--edge`, en sombras →
  `--shade`; `color: var(--X-d)` → `var(--X-t)`). Después, a mano: rellenos claros con texto (`--ink-dark`), contornos de
  texto de cofres (`OUT2`/`OUT3`), colores de datos con `color-mix` (temporada `setTheme`, rarezas y cofres en
  `chests-ui-common.js`, sets de Hallazgos en `album-ui.js`), splash inline de `index.html` (cielo de noche) y la
  cabecera de la temporada. **No se tocaron**: las láminas de Hallazgos (`album-art.js`, son ilustración) y el 3D de la
  ciudad (eso es el 3b).
- **Escenarios 3D de interfaz**: Equipaje y onboarding con fondo `0x1d1916`. La "boutique rosa" ahora es la Sastrería:
  `withTailor()` en `wardrobe-stage.js` re-mapea los colores al armar tarima, Sastrería y taller (`tailor()`, con
  `toHsl`/`fromHsl` exportados de `themes.js`); las lucecitas no se tocan.
- **Solo personas**: fuera gato, zorro, conejo y oso de `AVATAR_TYPES` y la familia "Animales". `LEGACY_TYPES` los traduce
  (gato y conejo → chica, zorro y oso → chico): perfiles de contactos viejos se ven como personas. `randomLook` ya no
  saca animales (conserva la tirada para que los vecinos no cambien). El código de pelajes de `avatar*.js` quedó sin uso.
- **Piezas retiradas** (`RETIRED_ITEMS` en `data.js`, con su precio): todo lo de animales más orejas de gato, antenas,
  tutú y alas de hada.
- **Estilos de ciudad**: pueblo, otoño, **musgo** (era bosque), **ceniza** (era moderna), **bruma** (era playa), **ocaso**
  (nuevo), **escarcha** (era invierno, sin muñeco de nieve) y noche. `THEME_ALIASES` cubre los ids viejos (visitas).
- **Renombres**: Vestidor → **Equipaje** en todo el juego; la Boutique ya se llamaba Sastrería. 49 nombres de Hallazgos
  sin diminutivos ni ternura (ids iguales: no afecta álbumes ni intercambios).
- **Guardado v4** (`migrateV4` en `state.js`, `VERSION = 4`): animal → persona con el mismo color de pelo y de ropa,
  looks guardados de animales afuera, piezas retiradas devueltas en la moneda en que se pagaron, estilo viejo → nuevo.
  Queda `s.v4 { from, theme, coins, gems, shown }`; el aviso "La isla cambió" va en "Mientras no estabas…" (`v4Lines` de
  `main.js`, `arrival.js`). Partidas nuevas o sin cambios no lo ven.
- **Tests**: `test-migration.mjs` suma la sección v3 → v4 (16 chequeos: oso → chico, devolución de 1.850 monedas y
  27 gemas, playa → bruma, aviso único, segunda carga sin cambios, perfil de contacto viejo). `test-e2e.mjs` usa Chico y
  Ocaso en el onboarding.

**Paso 3: historia, Bitácora, tutorial y guías** (canon y reglas en [DESIGN-STORY.md](../DESIGN-STORY.md))
- **`src/story/`**:
  - `story-data.js`: la cartógrafa (Vera, retrato 16×16 con su paleta), actos y capítulos (`ACTS`, cada uno con
    `when(s)`), escenas (`SCENES`: prólogo en 2 partes, aviso para partidas viejas, los 7 contactos y una escena por
    capítulo), `QUEST_LINES` (t1–t20), 8 páginas del diario, 4 elementos y el `MANUAL`.
  - `story.js`: `initStory(ctx, hooks)` en `initProgression` (`main.js`). `state.story = { v, seen{id:ms}, pages{id:ms},
    elements[], act, chapter, flags, read, veteran }` y `state.introSeen`, sin subir la versión del guardado
    (`defaultState` trae `story: {}`). Disparadores por el bus → claves (`unlock:expedicion`, `built:taller`, `rank:2`,
    `quest:t13`, `zone:bosque`, `chapter:bosque`, `threat:announced`, `combat:first`, `element:first`, `story:city`,
    `story:veteran`). Cola: las escenas esperan `hooks.idle` (ciudad sin modales, sin llegada ni subidas de nivel) y se
    marcan vistas al aparecer; las líneas de la cartógrafa (barks) solo piden estar en la ciudad y se espacian 4 s.
    `playPrologue()`, `replay(id)`, `blocking()` (la llegada espera mientras hay una escena épica).
  - `story-ui.js`: hoja de diálogo abajo a la izquierda (z 45: arriba del HUD, debajo de los modales; **no es modal**,
    se sigue jugando), barks que se van solos y pantalla completa épica con vetas (Esc saltea; las teclas no llegan a la
    escena). Al salir de la ciudad (`scene:changed`) la hoja abierta se guarda (`leave()` → `'away'`) y vuelve a salir al
    regresar: antes tapaba el botón "A la ciudad" de la expedición en pantallas angostas. Con el HUD escondido
    (`body.no-hud`: colocando, defendiendo) la hoja no se ve y no salen líneas sueltas ni cobros automáticos. Velocidad del texto = `settings.textSpeed`; con reducir movimiento sale entero.
  - Premios: `store.grant({ page, element })` emite `reward:page` / `reward:element` (story.js los anota). Por el bus
    para no crear una importación circular state ↔ story.
- **Cobro automático de t1–t20** (`AUTO_CLAIM`): `story.js` llama `quests.claimMain({auto: true})` cuando la misión está
  cumplida y estás en la ciudad (al cambiar `quests:changed`, `stats:changed` de amenazas, al volver a la ciudad y cada
  4 s), con aviso "Misión cumplida", monedas que vuelan desde la tarjeta y la línea de la cartógrafa. `claimMain` emite
  `quest:claimed {id, title, reward, auto}` siempre.
- **Orden de entrada** (`onboarding.js`): personaje → nombre → `router.go('city')` → **prólogo** → estilo →
  `story.cityIntro()` (contacto de la ciudad). En la primera sesión la llegada es liviana (sin modal "Tu primer día":
  avisos con el premio y "Mañana se abre…"), `firstSession` en `main.js` se prende con `onboarding:done`.
- **Partidas viejas** (onboarded al crear la historia): `veteran`, `introSeen = true`, contactos de lo que ya conocen
  dados por vistos y un aviso corto ("Leer el prólogo") que también da la página 1.
- **Bitácora** (`src/scenes/panels-story.js`, panel `story`): Historia (acto, capítulo, "Qué sigue" con la misión actual
  y su `goalAction`, escenas para releer, volver a ver el prólogo, actos cerrados), Diario (páginas con globito de no
  leídas, elementos) y Manual (capítulos por sistema con `open(s, X)`, buscador sin tildes, atajos actuales de
  `keys.js`). Botón en el riel del HUD (meta de controles pasa a ≤ 15) y tecla **J** (`journal` en `keys.js`). El panel
  `help` de antes abre el Manual; `openHelp` se borró y Ajustes → Partida tiene el botón "Manual".
- **Tutorial**: `goalAction` cubre todos los tipos (Huerta y cartel por `city:highlight` / `city:sign`, cobrar por
  `city:collect`, Taller, Expedición, amenaza, reparar, Bitácora; nivel no tiene botón) y `goalIcon` también.
  `hintFor` suma reparar, combate y historia. **Flecha guiada** (`guideTarget` en `city.js`): Construir, Expedición
  (a la izquierda del riel), Huerta y Taller (cartel arriba del edificio), rango y amenaza (a la derecha), carteles de
  terreno (titilan) o la Bitácora; se apaga al abrir lo que señalaba (`panel:open`, que ahora emite `openPanel`).
  Abrir Construir ya no apaga la flecha de una misión que no es de construir.
- **Pistas contextuales** (`src/core/tips.js`, `initTips()` en `boot`): `data-tip` / `data-tip-title`, solo con mouse.
  Puestas en monedas, gemas, población, felicidad, constructoras, Expedición (provisiones) y en provisiones, ánimo y
  carga de la expedición. Faltan habilidades e íconos de efecto (llegan con el combate).
- **Tests**: `tools/test-story.mjs` (en `npm test`, 94 chequeos; capturas en `shots/story/` sin `--no-shots`).
  `test-e2e.mjs` sigue el recorrido nuevo (prólogo, primer día sin modal, `installClaimLog` para los cobros
  automáticos, `closeStory` en `drainOverlays`). `test-threats.mjs` acepta t15/t17 ya cobradas. `test-migration.mjs` arma la semana
  de Contactos con la fecha de hoy en UTC (estaba fija en 2026-W45 y fallaba cada lunes UTC).
- **Decisión de canon**: los capítulos siguen el orden en que se abren las regiones (Bosque → Sierras → Bañado → Cerro →
  Costa → abordaje); el plan ponía el Cerro antes que el Bañado (ver DESIGN-STORY §4).

**Paso 3b: ambiente** (detalle en DESIGN.md → "Ambiente: lugar, luz, día y noche, clima")
- **`src/core/ambience.js`** (puro): lugares (`PLACES`: ciudad, expedición cerca / medio / lejos, mina, faros, Bajo Mundo),
  climas (`WEATHER`, con los de las amenazas), reloj de la ciudad (`cityHour`, 20 min por día), `cityWeather` (clima del día),
  `resolveLook` (lo que se ve), `lightFor` / `initWorldLight` (`state.world.light`, en `main.js`; avisa al subir de a
  décimos), `combatConditions` para el paso 5 y la base de los ecos (`cityEchoSpots`, `expEchoSpots`, `ECHO_RULES`).
- **`src/core/ambience-fx.js`** (three.js): luces, cielo, `r.setGrade` nuevo en `voxel.js` (saturación, tono y niebla por
  profundidad en el pase final), ventanas de noche (`windowMaterial` + `setNightGlow`; `models.js` pone los vidrios en su
  capa `win`), lluvia, nieve, ceniza, brasas y polvo, relámpagos (`ambience:thunder`). Vuelve todo a 0 al desmontar.
- **Ciudad**: `src/scenes/city-ambience.js` (día y noche, clima del día, clima de la amenaza en señales vía `decor.weather`,
  humo de chimeneas, casa nueva que prende la chimenea, hojas al cosechar, limpieza al reparar). `threat-scene.js` ya no
  tira lluvia ni relámpagos propios (los pone el ambiente); quedan el velo suave, el humo del monte y el polvo.
  Ajustes → Juego → "Día y noche en la ciudad" (`dayNight`). Emite `ambience:night` al cambiar.
- **Expedición**: reglas en `exp-rules.js` (`clock`, `front`, `conditions`, `makeFront`, `hourOf`, `weatherOf`; la vista
  trae `cond`). Se sale a las 6 y cada paso es una hora; desde las 20 visión −1 salvo con el Farol. Un frente por salida a lo
  sumo (25–40 % según la región, dura 2–4 pasos, anunciado): tormenta (visión −1 y +1 en colina, bañado y roca; la Lona lo
  evita), niebla y ceniza (visión −1), nieve (+1 en lo difícil), lluvia (solo se ve). Usa otra suerte: mapas y peligros
  iguales. Salidas guardadas sin reloj siguen igual. `exp-ambience.js`: chip de hora y clima en la barra, avisos, niebla y
  color por anillo, luz del Farol, polvo y huellas. Manual → La expedición suma "Día y noche" y "Clima".
- **Pruebas**: `tools/test-ambience.mjs` (en `npm test`, 65 chequeos; `--shots` deja capturas). `era-city.mjs --q
  "&hour=21&weather=tormenta"` y `?hour=` / `?weather=` en la URL (en una práctica de expedición `?hour=` también mueve el
  reloj de la salida). Capturas en `shots/ambience/` (ciudad de día, atardecer, noche y tormenta; expedición de noche).
- **Balance**: `sim:expedition` da los mismos ✘ que antes (regiones altas, ya pasaban de las metas) y el prototipo pasa
  todo. `sim:economy` quedó 18 ✔ · 2 ✘ justo en el borde (monedas al llegar 73,3 % contra ≥ 75 %; automática 74,9 % contra
  75–95 %; antes 20 ✔). El simulador es muy sensible al orden de compras: cualquier cambio en las salidas mueve qué defensa
  se construye cuándo. Revisarlo en el paso 7.
- **Para después**: los lugares de la historia (mina con vetas, faros con haces) están como perfiles pero ninguna escena los
  usa todavía (paso 6 o el combate). El sonido de la lluvia, el trueno y la noche quedó en el 3c. El combate pide `combatConditions(cond)` (paso 5, segunda parte). Los ecos (L6) se
  arman en el paso 6 sobre `echoSpots()` de la ciudad y de la expedición.

**Ramas en paralelo (2026-11-09).** El 4a y la integración del combate con la expedición corren en ramas aparte, cada
uno en su worktree; los integra a `master` la sesión coordinadora. El 3c se commiteó directo en `master`.

**Paso 3c: sonido y música** (detalle en [DESIGN-AUDIO.md](../DESIGN-AUDIO.md))
- **Motor** en `src/audio/`: `mixer.js` (buses general/música/ambiente/efectos/interfaz/voz, ducking, reverb por lugar
  con impulsos hechos en código, amortiguado, 32 voces, limitador), `sampler.js` (`.m4a` del manifest, loops sin el
  relleno del AAC, instrumentos con round-robin), `synth.js` (cuerdas, bajo, coro con formantes y el respaldo de cada
  instrumento), `pieces.js` (10 piezas, 3 leitmotivs, 14 stingers), `composer.js` (capas por intensidad, cambios en el
  compás, frases con respiros), `soundscape.js` (camas, emisores 3D, trueno con retraso, pasos), `engine.js`.
- **Fachada** `src/core/audio.js`: misma API de siempre más `setScene`, `stinger`, `intensity`, `epic`, `motif`, `step`,
  `thunder`, `dialog`, `connect(bus)` (en `main.js`), `enterScene` (lo llama el router), `credits` y `debug`. Lo alimentan
  `city-ambience.js` (cada segundo, más cosechar y reparar) y `exp-ambience.js` (cada paso, con pasos según el terreno).
  El secuenciador chiptune y el ambiente sintético viejos se borraron; los efectos con nombre ahora son muestras de Kenney
  o stingers, con la síntesis de antes de respaldo.
- **Ajustes**: fila "Voces" en Sonido; Partida → Créditos suma "Sonidos e instrumentos" (desde `manifest.credits`).
- **Archivos**: `assets/audio/` (4,8 MB, 104 `.m4a`, `manifest.json`, `LICENSES.md`). Se rehacen con
  `node tools/audio/prepare.mjs --src <descargas>` (qué se toma de cada descarga: `tools/audio/sources.mjs`). Las
  descargas originales quedaron en el scratchpad de la sesión del 3c (no en el repo); si hace falta rehacerlas, bajar de
  nuevo lo de `paso-3c-fuentes-audio.md` (set mínimo ya aprobado). `assets/` entra a `sw.js` y a `desktop/stage.mjs`.
- **Pruebas**: `tools/test-audio.mjs` en `npm test`; `node tools/render-audio.mjs` deja 9 `.wav` en `shots/audio/`
  (ciudad de día, noche y tormenta; expedición cerca y lejos; combate; épico; mina; Mi Casa). Niveles: ciudad −20 LUFS,
  picos debajo de −3 dBFS.
- **Enganches que esperan a otros pasos**: combate (paso 5) → `bus.emit('combat:music', { danger })` y
  `bus.emit('combat:end', { won })` (no toqué `src/combat/`); cinemática (paso 4) → `audio.music('epic')`,
  `audio.epic(true)`, `audio.motif('quiebre')`; diálogos → `audio.dialog(true/false)` (story-ui todavía no lo llama);
  pasos en Mi Casa y en combate → `audio.step('madera')` cuando haya personaje que camine. El bus `voice` está listo
  pero no hay voces grabadas.
- **Falta (necesita OK de descarga nueva)**: cuerdas sostenidas, cello y arpa de VSCO (el colchón hoy es sintético),
  Impact Sounds de Kenney para pasos reales por superficie, originales de Freesound en calidad completa.

**Sección L del plan (historia que se juega; c2f389d).** El usuario sumó L1 (elegir cuánto sacarle a un elemento y la
Grieta), L2 (la culpa de Vera, pista falsa del traidor, se revela en el Acto 2), L4 (el giro: las Casas cavaron donde
estaba el Céfiro a propósito; el traidor guarda el secreto y sale de la gente de tu ciudad), L5 (personas con nombre,
Vínculo 1–5, herramientas, nivel del líder, pestaña Progreso) y L6 (ecos de noche). El canon ya está en DESIGN-STORY.md
y los textos del paso 3 no lo contradicen: el prólogo dice "Tengo algo que arreglar" y las páginas p5–p8 siembran L2 y
L4. **No está implementado**: 3b deja la noche y los lugares para los ecos, 5b hace L5, 6 hace L1, las pistas de L2/L4 y
los primeros ecos, 7 balancea L1 y L5.

## Pendiente o frágil
- **`npm test` con la máquina cargada** (2026-11-09, otras sesiones corriendo tests a la vez): `test-mock`,
  `test-migration`, `test-social`, `test-threats` y `test-story` fallaron alguna vez en la cadena por tiempos y pasaron
  solos. Si falla una en la cadena, correrla sola antes de buscar un bug.
- **Del paso 3**: el contacto del combate y el de los elementos ya están escritos pero se disparan con `combat:won`/
  `combat:lost` (paso 5) y `reward:element` (paso 6). Las páginas p4–p8 no tienen disparador todavía (paso 6). "Volver
  a ver la intro" en la Bitácora va cuando exista la cinemática (paso 4; hoy está "Volver a ver el prólogo"). El ajuste
  `skipSeen` todavía no se usa. En la web, la hoja de diálogo puede quedar encima de la tarjeta "Instalar" (solo
  navegador). E6 (primera expedición guiada con pistas de un uso) y E5 (pasos nuevos en la cadena) van en el paso 6.
- **J7 a medias en el arte de los personajes**: siguen siendo chibi (ojos grandes, cachetes). El plan pide cuerpos,
  peinados y ropa de viajero "con el mundo": es trabajo de modelos en `avatar*.js` (también borrar el código de pelajes).
  Lo mismo para algunas piezas de disfraz que quedaron (hada, mago, Calabaza rodante del auto). Conviene hacerlo con el
  acto 1 (paso 6) o antes si molesta.
- **Interfaz oscura**: se revisó por captura la ciudad con HUD, Misiones, Ajustes, Cofres, Contactos, Hallazgos, Estilos,
  Temporada, Equipaje y onboarding. No se miraron una por una: Mi Casa por dentro, visitas, colocación, expedición,
  amenazas y Obras; si algo quedó claro o sin contraste, es un color fijo que el script no agarró (buscar `#f`/`#e` en
  `background` del archivo de esa pantalla).
- **Ajustes que todavía no se usan**: diálogos, cinemáticas vistas, combate, subtítulos y alto contraste se guardan
  pero los usan los pasos 3 a 5 (leer `ctx.state.settings`). "Volver a ver la intro" va en Partida o en la Bitácora
  cuando exista la intro (paso 4).
- **No se hicieron** (no tienen sentido en WebView): VSync (lo maneja siempre el sistema; el panel lo explica),
  oclusión ambiental (va horneada en la geometría y es barata) y distancia de detalle de la ciudad.
- **Sin bordes en Windows**: el tamaño exterior queda 8 px más grande por lado (sombra invisible de la ventana); se ve
  bien, pero si molesta, ajustar en `applyWindow`.
- **El preset automático** no se probó en una compu lenta de verdad: si elige mal, ajustar los umbrales de `decide()`
  en `settings.js`.
- `npm run desktop:build` compila el `.exe` y el instalador, y al final falla por la firma del actualizador si no está
  `TAURI_SIGNING_PRIVATE_KEY` en el entorno. Es esperado en local; el `.exe` sirve igual para `test-desktop.mjs`.
- `desktop:dev` todavía no se probó en ventana; sí se probó el `.exe` de release con `test-desktop.mjs`.
- No hay release publicado. El primero va en el paso 7.
