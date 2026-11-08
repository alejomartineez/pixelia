# Handoff · El Quiebre (Pixelia para PC, historia, combate, logo Dezings)

Plan completo y aprobado: [PLAN-QUIEBRE.md](PLAN-QUIEBRE.md). Este archivo dice **dónde quedó**; se actualiza al cerrar
cada paso.

## Reglas de trabajo (vienen del usuario)
- **Autonomía total.** No hace falta pedir permiso: instalar Rust y las Build Tools, commit y push a `master`, tags,
  releases y secrets con `gh`. Siguen valiendo las reglas de CLAUDE.md: no tocar el otro proyecto de Supabase, nunca usar
  `service_role`, y `npm run bump` antes de cada commit que cambie archivos del juego.
- **Contexto.**
  - Al pasar el 40–45 % de contexto: terminar la unidad en curso, hacer commit, actualizar este archivo y seguir en una
    **sesión nueva fresh** (no un fork).
  - El brief de esa sesión es: "leé `docs/PLAN-QUIEBRE.md` y `docs/HANDOFF-QUIEBRE.md`, seguí desde el paso N y aplicá
    esta misma regla".
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
| 2d | J6 interfaz oscura + J7 fuera lo tierno (solo personas, estilos nuevos, guardado v4) | hecho | (commit v29) |
| 3 | D + E1–E4 + E7 + H: motor de historia, Bitácora con el Manual, prólogo, tutorial, primeros contactos | **siguiente** | |
| 3b | J1–J5: ambiente (oscuridad por lugar, luz con la historia, día y noche, clima dinámico) | pendiente | |
| 3c | K: sonido y música (motor en `src/audio/`, mezclador por buses, música adaptativa, paisaje sonoro) | pendiente | |
| 4 | B: cinemática "El Quiebre" | pendiente | |
| 5 | C: combate táctico (motor y tests, escena e interfaz, casilla `enemigo`) | pendiente | |
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

## Pendiente o frágil
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
