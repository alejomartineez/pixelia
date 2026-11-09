# Pixelia para PC: "El Quiebre" (historia épica), combate táctico, tutorial guiado y logo Dezings

## Contexto
- **Historia.** Pixelia tiene el esqueleto de una aventura (regiones que se abren en orden, aldeas, niebla, lugares con
  nombre, Hallazgos), pero no tiene canon, personajes ni conflicto.
- **Jugador nuevo.** Se pierde:
  - `goalAction` en `src/scenes/panels-common.js:358` solo cubre construir.
  - `hintFor` en `src/scenes/panels-quests.js:139` dice "Sin apuro.".
  - La flecha solo señala Construir.
  - La cadena se frena hasta que cobrás a mano.
  - Nadie explica de qué va el juego.
- **Lo que pidió el usuario:**
  - Historia con momentos épicos.
  - Elementos de la tierra que mejoran la isla y el personaje.
  - Monstruos, reyes de otras islas, mafias, traidores y piratas del cielo.
  - Un Bajo Mundo bajo las islas flotantes (volcanes, cavernas, aldeas).
  - Una animación inicial del colapso: la avaricia de los poderosos y la persistencia de los pobres en robar.
  - Combate táctico por turnos.
  - Un logo de estudio, **Dezings**.
  - Un juego de PC instalable.
- **La ciudad ya es una isla flotante con islotes** (`src/scenes/city-world.js:1`). El canon calza con lo que ya se ve.

**Decisiones:**
- La historia va dentro de Pixelia.
- La intro es una cinemática 3D en vóxel.
- La ciudad sigue cozy y la historia se permite ser épica.
- **Esta tanda es la Base + el Acto 1.** Los actos 2 a 4 quedan diseñados en el documento.
- **Plataforma:**
  - Juego de PC para **Windows y macOS**, empaquetado con **Tauri**. Rust es solo la cáscara; el juego sigue en JS y
    corre en WebView2 en Windows y en WKWebView en Mac. El juego ya soporta Safari 16.4 o más nuevo, así que el motor de
    Mac no trae sorpresas.
  - Los instaladores se compilan en **GitHub Actions**, porque el usuario no tiene Mac.
  - Por ahora **sin firma**: el README explica el aviso de SmartScreen y el "clic derecho → Abrir" de Mac.
  - Ya no se apunta a iPhone. La web de GitHub Pages queda publicada sin mantenimiento.
  - Se distribuye por GitHub Releases con actualización automática.
  - Lo online (Supabase) sigue igual.

## Canon (borrador, va a `DESIGN-STORY.md`; el usuario lo ajusta)
**El mundo de antes.** Un continente vivía de cuatro elementos que corrían en vetas:
- **Raíz** (tierra);
- **Marea** (agua);
- **Brasa** (fuego);
- **Céfiro** (aire).

**El Quiebre.**
- Las Casas poderosas, que después serían los reinos, cavaron sin medida para acumular.
- Los de abajo siguieron robando lo que quedaba para sobrevivir.
- Nadie paró. La tierra se vació por dentro y se partió.
- Los pedazos con Céfiro se elevaron y son las islas flotantes.
- Lo demás quedó como el **Bajo Mundo**: volcanes de Brasa suelta, cavernas y aldeas de quienes no subieron.
- No hay buenos puros.

**Hoy.**
- Los elementos andan sueltos. Las **Amenazas** que ya existen son el elemento que se desborda. Quedan atadas al canon
  sin cambiar el sistema.
- Llegás a un fragmento en ruinas.

**Facciones (actos posteriores):**
- **Piratas del cielo**: saquean desde dirigibles.
- **Los reinos**: islas grandes con sus reyes.
- **La Cofradía de la Veta**: la mafia que trafica elementos entre los reinos y el Bajo Mundo.
- **Un traidor cercano**, que se revela en el Acto 4.

**Elementos descubiertos.** Cada uno da dos cosas:
- **A la isla**: un efecto permanente, por ejemplo Raíz suma resistencia a sequía y helada y un edificio nuevo.
- **Al personaje**: una habilidad de líder en la expedición y en combate. Resuelve el pendiente de DESIGN-CORE §9.

**Actos:**
- **Acto 1, "Tu fragmento"** (esta tanda). Usa las 5 regiones actuales.
  1. Prólogo: la cinemática y la cartógrafa, la única que se quedó.
  2. Bosque: primer combate, de tutorial.
  3. Cerro del Hierro: en la mina vieja descubrís el **Núcleo de Raíz**.
  4. Bañado: jefe monstruo despertado por la Marea suelta.
  5. Costa de los Faros: reencendés el faro y te volvés visible.
  6. Cierre: primer abordaje de **piratas del cielo**, jefe del acto. Queda el gancho al Acto 2.
- **Acto 2**: islas vecinas, muelle de dirigibles y la amenaza nueva "abordaje".
- **Acto 3**: el Bajo Mundo, con Brasa y Marea.
- **Acto 4**: los reyes, la Cofradía, la traición, Céfiro y el final.

**Coleccionable.** Las Páginas del diario del último intendente.

## Tono
- **Guía de tono** (DESIGN.md). Se agrega "Registro épico". La ciudad sigue cálida y sobria. La intro, los jefes y las
  revelaciones pueden ser épicos, sin grandilocuencia, en rioplatense y sin diminutivos.
- **Diálogos**: de 1 a 4 líneas por escena, se pueden saltear y nunca bloquean.
- **Textos para PC**: "Tocá…" pasa a "Hacé clic…" (o a verbos neutros como "Elegí…"), en una pasada por todo el juego.

## Implementación

### 0. Juego de PC con Tauri (`desktop/`)
- **Estructura.** `desktop/src-tauri/` lleva `tauri.conf.json`, `Cargo.toml` y un `main.rs` mínimo, con Tauri v2.
  - `frontendDist` apunta a la raíz del repo y excluye `tools/`, `docs/`, `shots/` y `supabase/`.
  - El juego no cambia de estructura. CLAUDE.md aclara que "sin build" sigue valiendo para el juego y que el
    empaquetado vive aparte.
- **Ajustes para escritorio:**
  - **Detección.** `window.__TAURI__` (o `?desktop`) prende un flag `ctx.desktop`.
  - **Service worker.** No se registra en el `.exe`: los archivos ya son locales. `sw.js` queda para la web.
  - **Ventana:**
    - 1280×720 como mínimo, redimensionable;
    - pantalla completa con F11;
    - ícono desde `tools/make-icons.mjs`;
    - título "Pixelia".
  - **Audio.**
    - En Windows se habilita sin gesto con `additionalBrowserArgs: --autoplay-policy=no-user-gesture-required`.
    - En Mac, WKWebView puede seguir pidiendo un gesto. Si pasa, el golpe del logo se omite ahí y la música arranca con
      el primer clic, como hoy.
  - **Teclas por plataforma.** Pantalla completa con F11 en Windows y con Ctrl+Cmd+F o el botón verde en Mac. Los atajos
    con modificador usan Cmd en Mac.
  - **Origen.** El juego corre en `http://tauri.localhost` en Windows y en `tauri://localhost` en Mac. Supabase y el
    guardado se verifican en los dos.
  - **Guardado.** `localStorage` persiste en la carpeta de datos de WebView2. Hay que verificar que sobreviva a las
    actualizaciones.
  - **Pasar la partida de la web al juego de PC.**
    - Si hay cuenta online, usar la nube si existe un guardado en la nube.
    - Si no, sumar "Exportar / Importar partida" en Ajustes, con un archivo `.json`.
  - **Supabase.** Verificar CORS y el login desde el origen `http://tauri.localhost`. Las URLs de redirección del Auth
    se ajustan en el panel solo si hacen falta.
- **Actualización.** Con `tauri-plugin-updater`, contra un `latest.json` en GitHub Releases, y con clave de firma propia.
  La clave privada nunca va al repo.
- **Scripts en `tools/`:**
  - `npm run desktop:dev`: ventana con el juego en vivo.
  - `npm run desktop:build`: genera el instalador `.exe` local.
  - `npm run release`: bump, tag `vN` y push del tag, solo con el OK del usuario.
- **GitHub Actions** (`.github/workflows/desktop.yml`, con `tauri-apps/tauri-action`). Con cada tag `v*` compila:
  - en `windows-latest`, el `.exe` NSIS;
  - en `macos-latest`, el `.dmg` universal para Intel y Apple Silicon.

  Después arma un borrador de release con los instaladores y el `latest.json` del actualizador. La clave de firma del
  actualizador va en los secrets del repo; el usuario la carga.

  El workflow también tiene un modo manual (`workflow_dispatch`) que compila y abre la app en macOS, saca una captura y
  la sube como artefacto. Así se prueba Mac sin tener una.
- **Requisitos que instala el usuario** (se piden permiso antes):
  - Rust con `rustup`;
  - Visual Studio Build Tools (C++);
  - WebView2, que en Windows 11 ya viene.
- **Escritorio primero en lo nuevo:**
  - Atajos de teclado (combate: 1 a 4 para habilidades, Espacio para fin de turno, Esc para menú).
  - Mouse con hover para ver alcances y daño.
  - Calidad alta por defecto, con la opción de calidad en Ajustes.
  - Lo viejo no se desarma.

### A. Logo Dezings
- **Dónde va.** Una capa `#studio` en `index.html`, por encima de `#splash`, con CSS y SVG en línea.
- **Diseño:**
  - Fondo oscuro.
  - Un ícono vóxel propio: un cubo isométrico que forma una "D".
  - La palabra **DEZINGS** en pixel art, con letras que caen y encajan y un brillo final.
  - En el `.exe` suena un golpe corto sintetizado en `src/core/audio.js`.
- **Generación.** `tools/make-logo.mjs --studio` arma el SVG y lo inyecta entre `<!--logo-studio-->`.
- **Tiempos:**
  - Cerca de 1,6 s la primera vez y cerca de 0,9 s después.
  - Corre mientras cargan los módulos.
  - Un clic o una tecla lo saltean.
  - Con `prefers-reduced-motion` es solo un fundido.
  - `?nosplash` y `?scene=` lo saltean.
- **Créditos.** "Un juego de Dezings" en el splash y en Ajustes.
- **Elección.** Capturas de 2 o 3 variantes.

### B. Cinemática "El Quiebre" (escena `intro`)
- **Archivo y uso.**
  - `src/scenes/intro.js` se registra en `SCENES` (`src/main.js:28`).
  - Sigue el contrato `{hud:false, music, mount, unmount}` y usa `createPixelRenderer` (`src/core/voxel.js:218`).
  - Es la primera escena de una partida nueva (`src/main.js:364`, `!state.introSeen`).
  - Se puede volver a ver desde la Bitácora.
- **Planos** (6, de 7 a 10 s cada uno, con un subtítulo por plano):
  1. El continente con las vetas latiendo.
  2. Las torres de las Casas extrayendo.
  3. De noche, figuras que roban cristales perseguidas por guardias.
  4. La tierra se agrieta.
  5. Los pedazos suben entre nubes y abajo quedan la oscuridad y la lava.
  6. Tu fragmento en ruinas y un bote que llega.
- **Construcción.** `Voxels`, `addLights`, `setIsoCamera` y `avatarModel`. Se reusan los acantilados y los islotes de
  `city-world.js`.
- **Calidad.** Alta en PC, y se respeta `?quality=low`.
- **Controles.** "Saltar" (Esc) siempre visible.
- **Música.** Pistas nuevas `epic` y `battle` en el secuenciador de `src/core/audio.js`.

### C. Combate táctico por turnos (`src/combat/`, con la misma división que `src/expedition/`)
- **`combat-data.js`.** Unidades, enemigos, habilidades y encuentros del Acto 1: lobos, bichos de veta, la bestia del
  Bañado, grumetes piratas y la capitana.
- **`combat-rules.js`.** Motor puro testeable en node, con la API `newBattle`, `view`, `move`, `act`, `endTurn`,
  `enemyTurn` y `result`. Devuelve eventos, igual que `src/expedition/exp-rules.js`.
- **El campo:**
  - Grilla de 8×8 (en PC entra cómoda) con obstáculos según el terreno.
  - El grupo es el líder más hasta 3 integrantes de la expedición. El rol define el kit:

    | Rol | Kit |
    |---|---|
    | exploración | a distancia |
    | ingeniería | barreras y trampas |
    | sanidad | curar |
    | recolección | robar o romper |
    | guía | movimiento y empujar |

  - Cada unidad tiene vida, movimiento, ataque básico y 1 o 2 habilidades con recarga.
  - El elemento suma una habilidad al líder.
  - Lo fabricado en el Taller (`EQUIPMENT` en `src/expedition/exp-data.js:138`) se usa como consumible.
- **Lectura táctica.** Los enemigos **marcan antes** las casillas que van a atacar. La IA sigue reglas simples por tipo,
  y los jefes tienen patrones por fase.
- **Duración y guardado.** De 3 a 6 min por pelea. Se guarda cada turno en `state.expedition.active`. Se puede retirar,
  y las peleas comunes ya ganadas se pueden **resolver rápido**.
- **Dónde aparece:**
  - Una casilla nueva `enemigo` en las bandas media y lejana (`CONTENT` en `exp-data.js:67`, `exp-gen.js`).
  - Los jefes, en lugares de la historia.
  - `exp-scene` le pasa el control a `combat-scene` y después vuelve.
- **Resultados.** Ganar da botín, páginas e historia. Perder cuesta ánimo y te devuelve a la casilla anterior; los
  jefes se pueden reintentar.
- **`combat-scene.js` y `combat-ui.js`.**
  - Cámara ortográfica, como `exp-scene.js:796`.
  - El grupo usa `avatarModel`. Los enemigos son modelos vóxel en `combat/enemy-models.js`.
  - Barra de acciones con atajos, fichas, orden de turnos, previsualización al pasar el mouse y casillas marcadas.

### D. Motor de historia y Bitácora (`src/story/`)
- **`story-data.js`.** Personajes con retrato de 16×16, escenas `{id, trigger, who, lines[], once}`, capítulos, páginas
  y elementos.
- **`story.js`:**
  - Arma `state.story = {seen:[], pages:{}, elements:[], act, chapter}` y `state.introSeen`, con `deepFill` y sin subir
    la versión del guardado.
  - `initStory()` va en `initProgression` (`src/main.js:308`).
  - Escucha el bus (`onboarding:done`, cobro de misión, `expedition:zone`, `expedition:region`, `town:rankup`, amenaza
    pasada, `combat:won` y `combat:lost`).
  - Encola escenas cuando la escena está quieta, como `runArrival`.
- **`story-ui.js`.** Hoja de diálogo con retrato en canvas de baja resolución sin suavizado y botón "Saltar". Las
  escenas épicas van a pantalla completa.
- **Efectos de los elementos:**
  - Para la isla: modificadores en `src/core/economy.js` y en la preparación de `src/threats/`, más un edificio nuevo en
    `src/core/data.js`.
  - Para el personaje: la habilidad de líder en `exp-rules` y en `combat-rules`.
  - Se acreditan con `store.grant` (tipos nuevos `page` y `element`, en `src/core/state.js:364`).
- **Bitácora** (`src/scenes/panels-story.js`).
  - Muestra el acto y el capítulo, las escenas, las páginas, los elementos, "Volver a ver la intro" y un **"Qué sigue"**
    con la misión actual y su `goalAction`.
  - Tiene botón en el riel del HUD (`src/core/hud.js:78`) y atajo J.

### E. Tutorial
1. **`goalAction`.** Cubrir los casos que faltan:
   - `prov` y `craft`: `city:focus` sobre la Huerta o el Taller.
   - `expedition`, `zone` y `expStars`: `openPanel('expedition')`.
   - `expand`: la cámara va al cartel.
   - `threat`: `threat:panel`.
   - Tipos nuevos `combat` y `story`.
2. **`hintFor`.** Pistas reales para todos los tipos y fuera los textos de los minijuegos.
3. **Flecha guiada** (`updateTutorial` en `src/scenes/city.js:523`). Señala según la misión: Construir, Expedición,
   la Huerta o el Taller, el cartel o la Bitácora.
4. **Cobro automático de t1–t20** (`claimMain` en `src/core/quests.js:119`), con toast y la línea de la cartógrafa.
5. **Pasos nuevos en la cadena** (`src/core/data.js:572`, seguida por id): primer combate después de t5, "encontrá el
   Núcleo de Raíz" y el jefe del Bañado.
6. **Primera expedición guiada** (`TUTORIAL_SEED`), con pistas de un solo uso. El primer combate también va guiado.
7. **Orden de entrada:**
   1. Logo.
   2. Splash.
   3. Cinemática.
   4. Personaje.
   5. Nombre.
   6. Prólogo.
   7. Estilo.

   El modal de llegada no se apila en la primera sesión (`src/scenes/arrival.js`).
8. **Textos viejos:**
   - "minijuegos" en `manifest.webmanifest` y en los meta de `index.html`.
   - Los diminutivos de los consejos de carga (`index.html:99`).
   - El lema del splash.
   - "Tocá" pasa a "Hacé clic".

### G. Ajustes completos (`src/scenes/panels-settings.js`)
Hoy hay música y sonidos con un sí/no, tamaño de texto, movimiento y telemetría. La calidad y el contorno existen solo
como atajos de URL (`?quality`, `?outline`). Se arma un panel por pestañas, guardado en `state.settings` y aplicado en
vivo. Los valores nuevos los completa `deepFill`.

- **Gráficos.** Se aplican con la API que ya tiene `createPixelRenderer` (`setMaxFps`, `setOutline`, `lowQuality`,
  `resize`); lo que falte se expone ahí.
  - Preset: Baja / Media / Alta / Personalizada.
  - Escala de resolución: 50 a 200 %, con 2× por defecto en Alta.
  - Antialias.
  - Sombras.
  - Oclusión ambiental.
  - Contorno tinta.
  - Partículas: pocas / normales / muchas.
  - Distancia de detalle de la ciudad.
  - Limitador de FPS: 30 / 60 / 120 / 144 / sin límite.
  - FPS en segundo plano.
  - VSync.
  - Contador de FPS en pantalla.
- **Pantalla.** Se aplica con la API de ventana de Tauri y se recuerda al reabrir.
  - Ventana / pantalla completa / sin bordes.
  - Resolución de ventana.
  - Escala de la interfaz: 80 a 150 %.
- **Sonido.**
  - Volumen general, música, efectos y ambiente, con deslizadores en vez de sí/no (`src/core/audio.js` ya tiene ganancias
    separadas).
  - Silenciar en segundo plano.
- **Juego.**
  - Velocidad de los diálogos.
  - Saltear las cinemáticas ya vistas.
  - Velocidad de la animación del combate: x1 / x2 / x3.
  - Confirmar fin de turno.
  - Pistas de la guía: sí / no.
  - Velocidad de la cámara y de desplazamiento con los bordes.
- **Controles.** Lista de atajos (combate, Bitácora J, Construir B, Expedición E, cámara WASD) con reasignación
  simple.
- **Accesibilidad.** Lo de hoy (texto, movimiento), más subtítulos siempre activos y un modo de alto contraste para las
  casillas marcadas del combate.
- **Partida.** Exportar / importar partida, borrar partida, "Volver a ver la intro" y los créditos de Dezings.
- **Primer arranque.** Se elige un preset según los FPS medidos durante el logo y la intro, y se puede cambiar.

### H. Guías del juego (lo esencial, sin guiar todo)
- **Regla.** Se guía cada sistema central **la primera vez que aparece**, con una sola pantalla corta. Lo demás se
  descubre jugando y queda en el manual.
- **Primeros contactos.** Siete, con un aviso de 2 o 3 líneas y una ilustración vóxel o pixel, dichos por la cartógrafa:
  1. la ciudad (producir y cobrar);
  2. la expedición (provisiones, ánimo, niebla y volver);
  3. el combate (turnos, casillas marcadas y habilidades);
  4. las amenazas (aviso y preparación);
  5. los elementos;
  6. el rango y las Épocas;
  7. el Taller y el equipo.

  Se disparan por bus cuando el sistema se abre (`unlocks.js` ya sabe cuándo).
- **Manual.** Una pestaña de la Bitácora que reemplaza el "Cómo jugar" actual (`openHelp` en
  `src/scenes/panels-settings.js:391`).
  - El texto actual está viejo: tiene diminutivos ("burbujita", "animalito", "ratito") y hablá de tocar.
  - Va por capítulos, que se desbloquean al llegar a cada sistema, con buscador.
- **Pistas contextuales.** Al pasar el mouse sobre recursos, barras de la expedición, habilidades e íconos de efecto,
  aparece un tooltip con lo que hace y de dónde se saca.
- **"Qué sigue".** Vive en la Bitácora y en la tarjeta del HUD. Siempre hay un próximo paso claro, con su botón.

### I. Diseño de mecánicas: creativas, enganchantes y balanceadas
**Principios** (van a DESIGN-COMBAT y DESIGN-STORY):
- Cada decisión tiene un costo visible.
- Hay pocas reglas, pero se combinan.
- Ningún camino único gana siempre.
- Perder enseña: se ve por qué perdiste.
- Una partida corta siempre deja un avance.

**Combate:**
- **El terreno es un recurso.** Los elementos cambian el campo:
  - Raíz levanta una pared o enreda.
  - Marea empuja y apaga el fuego (actos posteriores).
  - Las cuerdas y las trampas de ingeniería crean caminos o cierres.
- **Combos entre roles.** Por ejemplo, la guía empuja a un enemigo a la trampa de ingeniería, o la exploración marca y el
  siguiente golpe hace más daño. Los combos se descubren y se anotan en el manual.
- **Intenciones a la vista.** El enemigo marca lo que va a hacer, y el jugador piensa como en un rompecabezas en vez de
  tirar dados.
- **Jefes con fases** y una mecánica propia cada uno:
  - La bestia del Bañado inunda casillas por turnos y hay que pelear en alto.
  - La capitana pirata llama refuerzos por la pasarela del dirigible, que se puede cortar.
- **Objetivos alternativos.** Algunas peleas se ganan sobreviviendo N turnos o rescatando a alguien, no solo matando.
- **Desafíos opcionales.** Ganar sin perder a nadie o en pocos turnos da un extra (sinergia con las 3 estrellas actuales).

**Meta y enganche:**
- **El ciclo se cierra.** La historia pide explorar, explorar da elementos y materiales, eso mejora la isla, y la isla
  aguanta las amenazas y desbloquea más historia.
- **Avance visible.** El elemento cambia algo **que se ve** en la isla (raíces brillantes, una construcción nueva) y
  algo **que se siente** en el personaje (una habilidad nueva).
- **Ganchos de curiosidad.** Las páginas del diario dejan preguntas abiertas, el final del acto se anuncia, y las zonas
  muestran siluetas de lo que hay más adelante.
- **Rachas y sorpresa moderadas.** Encuentros raros en la niebla (un mercader del Bajo Mundo, un pirata desertor que
  se suma) con chance baja y una vez por día.

**Balance:**
- **Simulador de combate.** `tools/sim-combat.mjs` corre miles de peleas con una IA de jugador razonable sobre el motor
  puro. Las metas van en DESIGN-COMBAT:

  | Pelea | Meta |
  |---|---|
  | común con el equipo esperado | 85–95 % ganadas |
  | jefe, primer intento | 45–65 % |
  | jefe, tercer intento | 85 % o más |
  | duración | según la meta de turnos |
  | rol | ninguno aporta más del 35 % del daño o de las victorias |

- **Economía.** `npm run sim:economy` sigue cumpliendo DESIGN-CORE §8 con los efectos de los elementos y con el botín de
  combate.
- **Telemetría.** Ya existe (`src/online/telemetry.js`). Se suman eventos de combate (victoria, derrota, turnos,
  retirada) para ajustar con datos reales.

### J. Dirección visual: un mundo más oscuro y vivo (pedido del usuario, 2026-11-08)
Se mantiene el vóxel nítido y el pixel art, pero el clima y el diseño pasan a ir con el mundo de El Quiebre.

**Decisiones:**
- La oscuridad depende del lugar.
- La interfaz pasa a ser oscura con acentos.
- La luz avanza con la historia y con los ciclos de día y noche.
- Se saca lo tierno.

**J1. Ánimo según el lugar.** Cada lugar tiene un perfil de ambiente en `src/core/ambience.js` (módulo nuevo): paleta,
niebla, cielo, luz, partículas y música. Lo usan la ciudad, la expedición, el combate y la cinemática.

| Lugar | Clima |
|---|---|
| Ciudad | Refugio. Cálido y luminoso de a ratos, con faroles, ventanas y humo de chimeneas; puede ser alegre. |
| Expedición, banda cerca | Natural, con luz de día. |
| Expedición, bandas media y lejana | Más niebla, colores más apagados y más misterio a medida que te alejás. La profundidad se *ve*. |
| Lugares de la historia | Cada uno con su clima: la mina oscura con vetas que brillan; la costa de los faros con bruma y haces de luz. |
| Bajo Mundo (actos posteriores) | Muy oscuro. La luz sale de la lava, los cristales y las vetas. |

**J2. La luz como progreso.**
- La isla arranca nublada, gris y desaturada.
- Cada hito la va iluminando: reconstruir, subir de rango y de Época, el Núcleo de Raíz (raíces que brillan por la isla) y
  reencender el faro.
- Se guarda como `state.world.light`, de 0 a 1, derivado de la historia y del rango. El ambiente lo interpola.

**J3. Día y noche.**
- **Ciudad.** Ciclo comprimido de unos 20 min reales por día. Al anochecer se prenden faroles y ventanas.
- **Expedición.** Cada turno avanza la hora. De noche la visión baja en 1 y el farol del Taller la devuelve: el ciclo
  pasa a ser una mecánica.
- **Combate.** Hereda la hora y el clima de la casilla.
- **Bajo Mundo.** No tiene sol.

**J4. Clima dinámico.**
- Lluvia, tormenta con relámpagos y viento, niebla, nieve y ceniza cerca de los volcanes.
- Las **Amenazas se ven**: la tormenta trae una tormenta real, la crecida sube el agua, el incendio prende humo y
  brasas, la helada pone escarcha.
- **El clima juega** en la expedición, siempre con el efecto a la vista y nunca de sorpresa:
  - la tormenta baja la visión y encarece moverse;
  - la niebla esconde casillas.
- La calidad del clima se ajusta en Ajustes → Gráficos (partículas).

**J5. Lo que hace el jugador cambia el entorno.**
- Polvo y huellas al caminar.
- Cultivos que se mecen al cosechar.
- Las casas nuevas prenden la luz y las chimeneas.
- Las reparaciones después de una amenaza borran las marcas.
- Los elementos transforman el paisaje.
- En combate, el terreno se ve modificado: paredes de Raíz, charcos y trampas.

Pequeño y legible: cada acción importante tiene una respuesta visual.

**J6. Interfaz oscura con acentos.** En `styles.css`, con tokens:
- Paneles de pizarra y madera oscura.
- Bordes de metal gastado.
- Texto claro.
- Acentos en dorado y en el azul de Dezings (`#3d55b8`).

También se oscurecen el splash, el HUD, los modales y las tarjetas. Hay que cuidar el contraste (AA) y la legibilidad
del texto pixel. Las pantallas nuevas (Ajustes, Bitácora, combate) usan los mismos tokens desde el principio.

**J7. Fuera lo tierno.**
- **Personajes.** Solo personas: se sacan gato, zorro, conejo y oso. Los cuerpos, peinados y ropa de viajero van con el
  mundo.
- **Estilos de ciudad.** Los pastel, moderna y playa se reemplazan por estilos del mundo, por ejemplo ceniza, musgo,
  bruma, ocaso y escarcha.
- **Nombres y textos.** Se revisan los infantiles: el Vestidor pasa a algo como "Equipaje" o "Ropero", y la "Boutique
  real" a una sastrería.
- **Migración idempotente** (guardado v4, `migrate` en `src/core/state.js`):
  - Los avatares animales pasan a una persona con colores parecidos.
  - La ropa que solo existía para animales se devuelve en monedas.
  - Los estilos viejos pasan a su equivalente nuevo.
  - Hay un aviso único que explica el cambio.
- **Tests.** `test-migration.mjs` suma el caso.
- **Guía de tono.** Se actualiza DESIGN.md (arte y tono).

### K. Sonido y música: ambiente vivo y música adaptativa (pedido del usuario, 2026-11-08)
**Decisiones:**
- Música **híbrida**: instrumentos grabados reales y el juego compone con ellos en vivo, por capas.
- Estilo **folk melancólico**: piano, cuerdas y flauta con silencios. Cálido en la ciudad, misterioso afuera. Crece a
  orquesta y coro solo en los momentos épicos.
- Sonidos de **fuentes gratis** y sin regalías.

**Cómo lo hace la industria (investigado):**
- **Técnicas de música adaptativa:**
  - *Capas verticales*: se suman o se sacan instrumentos según la tensión. Es lo más común.
  - *Resecuenciado horizontal*: se cambia de sección en el límite de compás.
  - *Stingers*: frases cortas atadas a eventos, como un hallazgo o una victoria.
- **Ambiente:**
  - Una *cama* continua más *sonidos sueltos* con probabilidad y desfase al azar, así no se nota el loop.
  - El *silencio* también es diseño.
  - Los sonidos tienen dirección y distancia.
- **Herramientas.** El estándar son FMOD y Wwise. FMOD es gratis para indies con presupuesto chico y tiene versión
  HTML5/wasm, pero pesa, hay que integrarlo a mano y la licencia para web no es clara.
- **Decisión: motor propio sobre Web Audio nativo**, que es lo que el juego ya usa. Hace lo mismo para nuestra escala, sin
  dependencias en tiempo de ejecución (regla de CLAUDE.md) y sin licencias.
  - Howler.js no suma nada esencial.
  - Tone.js pesa y el secuenciador ya existe.

**K1. Mezclador** (`src/audio/mixer.js`).
- **Buses:** general / música / ambiente / efectos / interfaz / voz. Toman los volúmenes de Ajustes del paso 2c.
- **Ducking:** la música baja sola en diálogos, stingers y momentos épicos.
- **Reverb por lugar:** `ConvolverNode` con respuestas de impulso generadas en código (ruido que decae, sin archivos).
  Hay perfiles de campo abierto, interior, cueva y mina.
- **Filtro paso bajo** para lo amortiguado: adentro de Mi Casa, la tormenta vista desde adentro.
- **Mezcla prolija:** fundidos siempre (nada de clics), límite de voces simultáneas (cerca de 32) y silencio en segundo
  plano si así está en Ajustes.

**K2. Sampler** (`src/audio/sampler.js`).
- Instrumentos con una muestra cada pocos semitonos, afinados con `playbackRate`, con ADSR y round-robin.
- Se cargan por escena, sin bloquear el arranque.
- **Formato:** `.m4a` (AAC), que anda en WebView2 y en WKWebView (Mac), decodificado con `decodeAudioData`.
- **Presupuesto:** cerca de 6 MB para los instrumentos y cerca de 10 MB para los ambientes.

**K3. Compositor adaptativo** (`src/audio/composer.js`, reemplaza al secuenciador de `src/core/audio.js`).
- Cada lugar define una *pieza*: modo y escala, tempo, progresiones, banco de motivos y capas (pad, bajo, melodía,
  percusión, coro).
- Un parámetro de **intensidad** de 0 a 1 suma o saca capas. Los cambios caen en el compás.
- **Leitmotivs:** el tema de la isla, el de la cartógrafa y el de El Quiebre (nace en la cinemática y vuelve en las
  revelaciones).
- **Respiros:** silencios entre frases, sobre todo en la ciudad y al explorar.
- **Modo épico** para la intro, los jefes y las revelaciones: más orquesta, coro y percusión grave.
- **Stingers:**
  - hallazgo y página del diario;
  - elemento descubierto;
  - subida de rango y de Época;
  - aviso de amenaza;
  - victoria y derrota en combate;
  - nivel.
- **Mapeo por lugar:**
  - Ciudad: cálida, más rica a medida que la isla se ilumina (J2).
  - Expedición: más escasa y misteriosa cuanto más lejos.
  - Combate: pulso y percusión, que suben con el peligro.
  - Bajo Mundo: grave y dissonante.
  - La noche cambia la instrumentación.

**K4. Paisaje sonoro** (`src/audio/soundscape.js`). Lo maneja el perfil de ambiente de J1.
- **Camas con fundido:** viento, mar al borde de la isla, bosque, lluvia, zumbido de cueva, fuego, murmullo de la ciudad
  (crece con la población).
- **Emisores sueltos** con probabilidad, rango de intervalo y variación de tono y volumen. Ubicados en 3D (`PannerNode`)
  donde corresponde: pájaros en los árboles, olas en el borde, martillo en el Taller, fuente, chimeneas.
- **Día y noche:** pájaros de día; grillos, búhos y faroles que zumban de noche.
- **Clima:**
  - la lluvia tiene intensidad;
  - el trueno llega después del relámpago, con retraso según la distancia;
  - viento de tormenta.
- **Amenazas:** el agua que sube, el fuego que crepita, la escarcha que cruje.
- **Respuesta a las acciones (J5):**
  - pasos según la superficie (pasto, piedra, madera, arena, agua) en la expedición, Mi Casa y el combate;
  - construir, cosechar, reparar.
- **Interfaz:** clics de madera y metal, acordes con la interfaz oscura (J6).

**K5. Fuentes y licencias** (todas gratis, sin regalías, sin licencias NC ni ND):
- **Ambiente y efectos:**
  - bundles de Sonniss para la GDC (2015–2026, sin regalías ni atribución; no permiten entrenar IA);
  - Freesound, filtrado **solo CC0**;
  - packs de Kenney (CC0).
- **Instrumentos:** bancos libres de muestras orquestales y de piano (por ejemplo VSCO 2 Community Edition).
  Se verifica la licencia de cada uno: si pide atribución (CC-BY), va en créditos.
- **Registro.** `assets/audio/LICENSES.md` anota origen, autor y licencia de cada archivo. Los créditos del juego (Ajustes
  → Partida) lo muestran.
- **Descarga.** Si un sitio no deja bajar en automático, se le pide al usuario solo esa descarga, con el enlace exacto.

**K6. Preparación de los archivos** (`tools/audio/`, con ffmpeg instalado vía winget):
- recortar;
- puntos de loop sin clic;
- normalizar loudness (música cerca de −16 LUFS, ambiente cerca de −20, efectos ajustados a oído);
- mono para los sonidos sueltos;
- AAC entre 96 y 128 kbps;
- `assets/audio/manifest.json` con duración, loop y categoría.

`assets/` entra en `desktop/stage.mjs` y en el precache de `sw.js` (`gen-sw-core.mjs`).

**K7. Pruebas y escucha:**
- `tools/test-audio.mjs` en `npm test`:
  - el mezclador y los buses arrancan;
  - el compositor programa notas en cada lugar sin errores;
  - los emisores respetan el límite de voces;
  - los volúmenes de Ajustes se aplican.
- Render con `OfflineAudioContext` de 30 s por lugar: que no sea silencio y que el pico quede por debajo de 0 dBFS.
- `tools/render-audio.mjs` exporta fragmentos `.wav` (ciudad de día y de noche, expedición cerca y lejos, combate, épico)
  a `shots/audio/`, para que el usuario los escuche y opine.
- `DESIGN-AUDIO.md` nuevo: arquitectura, mapeo por lugar, motivos, fuentes y reglas de mezcla.

### L. Historia que se juega: personajes, herramientas y progreso (pedido del usuario, 2026-11-09)
Elegidas por el usuario. Todo va a `DESIGN-STORY.md`, que es un borrador: los nombres se pueden cambiar.

**L1. Vos también podés repetir el Quiebre.** Al encontrar un elemento (el Núcleo de Raíz en el Acto 1), se elige
cuánto sacarle:

| Opción | Lo que da | Lo que cuesta |
|---|---|---|
| Sellar | un bonus chico | nada: la isla queda estable |
| Con medida | el bonus normal | poco |
| Exprimir | el doble de bonus | sube la **Grieta** |

- **Qué hace la Grieta** (`state.world.grieta`, de 0 a 100):
  - las amenazas pegan más fuerte y llegan más seguido;
  - la isla muestra grietas que brillan (J5);
  - la cartógrafa lo nota.
- **Se puede reparar**, lento y caro, con obras de la Raíz. Ninguna decisión es para siempre, como pide el tono cozy.
- **Más adelante** se puede volver a elegir en el mismo lugar: subir o bajar la extracción.
- **El final del Acto 4** cambia según la Grieta acumulada.
- **Balance:** `sim:economy` corre las tres opciones. A los 60 días, ninguna puede sacar más de un 15 % de ventaja neta
  contando las pérdidas por amenazas.

**L2. La culpa de Vera.** Antes del Quiebre, Vera dibujó los mapas de las vetas para las Casas. Sin saberlo, les mostró
dónde cavar. Por eso se quedó en las ruinas: quiere arreglar algo.
- **En el Acto 1** solo hay pistas: un eco (L6), una página del diario y un silencio cuando se habla de mapas.
- **En el Acto 2** se revela.
- **Es la pista falsa del traidor:** todo apunta a ella y no es ella.

**L4. El giro final.** El Quiebre no fue un accidente.
- Las Casas sabían que el continente se iba a partir. Con los mapas de Vera cavaron justo donde estaba el Céfiro, para
  que **sus** tierras subieran y el resto quedara abajo.
- El traidor es quien guarda ese secreto desde entonces. Ya se insinúa en los "permisos" del diario de Tadeo y en
  "Céfiro: lo sabe alguien que no lo dice".
- **Propuesta:** el traidor sale de la gente que llegó a tu ciudad (L5). Así la traición duele.
- **Pistas repartidas:** páginas p5 a p8 en el Acto 1, ecos y diálogos en los actos 2 y 3. La revelación es en el
  Acto 4.

**L5. La ciudad cuenta historias, y cada personaje trae una herramienta.**
- **Cómo llegan.** A medida que crece la población, llegan personas con nombre: solo personas, sin animales que hablen
  (J7). Cada una dice 2 líneas al llegar y trae un dato del mundo.
- **Vínculo.** Cada una tiene un nivel de **Vínculo**, de 1 a 5. Sube con sus encargos chicos (que van a la cadena de
  misiones) y con la historia.
- **Herramienta.** Cada nivel de Vínculo abre un nivel de su **herramienta**. La herramienta mejora la ciudad, la
  expedición y el combate a la vez.
- **Mejorar la herramienta** cuesta materiales de región y pasar por el Taller.

  | Quién (borrador) | Llega | Herramienta | Qué mejora |
  |---|---|---|---|
  | Vera, cartógrafa | desde el inicio | Catalejo | ve más lejos en la niebla y, con más niveles, qué hay en cada casilla; en combate muestra las intenciones de más enemigos |
  | Brígida, herrera que escapó de un reino | rango 2 | Martillo | obras más baratas; las trampas de ingeniería pegan más |
  | Nahuel, subió del Bajo Mundo colgado de una cuerda | Bosque explorado | Cuerda | atajos en la expedición; en combate trepa a lo alto (clave contra la bestia del Bañado) |
  | Olga, curandera | rango 3 | Botiquín | más ánimo en la expedición; la sanidad cura más |
  | Ramiro Ochoa, ex guardia de las Casas | rango 5 | Farol de guardia | más preparación contra las amenazas; en combate protege |

- **Nivel del líder** (1 a 30). Sube con la experiencia que dan las expediciones, los combates y las amenazas
  aguantadas.
  - Cada nivel da un bonus chico.
  - Los niveles clave abren espacios de habilidad. Esas habilidades salen de los elementos y del equipo.
- **Pestaña "Progreso"** en la Bitácora. Junta todo lo que sube en un solo lugar:
  - rango y Época;
  - nivel del líder;
  - Vínculos y herramientas;
  - elementos;
  - Grieta;
  - páginas del diario.

  En cada fila se ve qué falta para el próximo nivel.
- **Balance:** las curvas de experiencia y de Vínculo van en DESIGN-CORE §8 y en `sim:economy`. Ninguna herramienta es
  obligatoria para ganar una pelea común.

**L6. Ecos de noche.** De noche (J3), en algunas ruinas de la ciudad y de la expedición aparecen siluetas vóxel
traslúcidas que repiten de 5 a 8 s un momento de antes del Quiebre.
- **Al hacer clic** dan una línea o una página del diario.
- **Salen una sola vez** cada uno y quedan en la Bitácora.
- **Tono:** misteriosos, no dan miedo.
- **Algunos siembran L2 y L4.** Por ejemplo, Vera joven dibujando un mapa para un señor de una Casa.

**Dónde entra en el orden de trabajo:**
- **3b** deja lista la base de los ecos: noche y lugares.
- **5b**, nuevo paso después del combate, hace L5: personas, Vínculo, herramientas, nivel del líder y la pestaña
  Progreso.
- **6** hace L1 con el Núcleo de Raíz, las pistas de L2, L4 y L6 en el Acto 1, y los primeros ecos.
- **7** balancea L1 y L5 en los simuladores.

### F. Documentación
- `DESIGN-STORY.md` nuevo: canon, actos 1 a 4, facciones, elementos, jefes y reglas de escritura.
- `DESIGN-COMBAT.md` nuevo: reglas, fórmulas, IA y duración.
- Actualizar en DESIGN-CORE: §1, §6, §9 y §10.
- Agregar en DESIGN.md: el "Registro épico" y la plataforma PC.
- Actualizar en CLAUDE.md:
  - la descripción, que pasa a "juego de PC con Tauri; la web queda sin mantenimiento";
  - los comandos `desktop:*` y `release`;
  - los atajos `?scene=intro` y `?scene=combat`;
  - el paso de publicar, que pasa a ser un release en GitHub (la web se sigue publicando con push, como hasta ahora).
- `README.md`: cómo instalar y compilar.

## Manejo de contexto entre sesiones (pedido del usuario)
- **Memoria.** Al arrancar se guarda en la memoria del proyecto, como `feedback`: "si el chat supera el 40–45 % de
  contexto, seguir en una sesión nueva *fresh* (no un fork) con la misma tarea".
- **Copia del plan en el repo.** Este plan se copia a `docs/PLAN-QUIEBRE.md`. Cada sesión nueva lo lee y no depende del
  historial de esta.
- **Estado.** `docs/HANDOFF-QUIEBRE.md`, siguiendo el patrón de los `docs/HANDOFF-*.md` que ya existen, se actualiza al
  cerrar cada paso. Registra:
  - qué paso está hecho y en qué commit;
  - qué decisiones se tomaron (por ejemplo, la variante de logo elegida);
  - qué quedó pendiente o frágil;
  - cuál es el siguiente paso.
- **Corte de sesión:**
  - Se mide el contexto con `get_usage` en cada límite de paso. También se corta antes si un paso viene largo.
  - Al pasar el 40–45 %, se termina la unidad en curso, se hace commit y se actualiza el HANDOFF.
  - Después se abre una sesión nueva (`start_session`, contexto `fresh`) con un brief corto: leer `docs/PLAN-QUIEBRE.md`
    y `docs/HANDOFF-QUIEBRE.md`, seguir desde el paso N y aplicar la misma regla de corte. La sesión de origen termina ahí.
- **Partición esperada.** Más o menos una sesión por paso del orden de trabajo. El combate (paso 5) y el Acto 1
  (paso 6) probablemente lleven dos sesiones cada uno.

## Orden de trabajo (un commit por paso)
**Autonomía.** El usuario autorizó hacer todo sin pedir permiso. Eso incluye:
- instalar Rust y las Build Tools;
- commit y push a `master`;
- crear los tags y releases;
- generar la clave del actualizador y cargarla como secret con `gh`.

Sigue en pie la regla de CLAUDE.md: no tocar el otro proyecto de Supabase ni usar la clave `service_role`.
1. **0**: cáscara Tauri, `desktop:dev` andando, el juego actual corriendo en ventana, guardado y online verificados,
   instalador `.exe` de prueba y workflow de GitHub Actions compilando Windows y Mac, con captura de Mac.
2. **A + E8 + G**: logo, textos, pasada de "Tocá" a "Hacé clic" y Ajustes completos. Del logo se elige una variante
   y se dejan las otras en `shots/` para que el usuario las vea.
2d. **J6 + J7**: interfaz oscura con tokens y fuera lo tierno, con su migración v4. Va antes de seguir sumando pantallas.
3. **D + E1–E4 + E7 + H**: motor de historia, Bitácora con el Manual, prólogo, tutorial y los primeros contactos.
3b. **J1–J5**: `ambience.js`, la luz como progreso, día y noche, clima y las respuestas del entorno en la ciudad y la
    expedición. El combate y el Bajo Mundo lo usan cuando existan.
3c. **K**: mezclador, sampler, compositor adaptativo, paisaje sonoro y la preparación de los archivos. Va después de 3b,
    que define los lugares, el clima y el día y la noche. Reemplaza la música sintetizada actual.
4. **B**: cinemática, que ya usa la paleta, el ambiente oscuro y el motivo de El Quiebre (K3) en modo épico.
5. **C**: combate. Primero el motor con sus tests, después la escena y la interfaz, después la casilla `enemigo`.
5b. **L5**: personas con nombre, Vínculo, herramientas, nivel del líder y pestaña Progreso de la Bitácora.
6. **Acto 1 completo**: escenas, Núcleo de Raíz con la elección de extracción y la Grieta (L1), jefes, faro, abordaje
   pirata, pistas de Vera y del giro (L2, L4), primeros ecos de noche (L6) y E5–E6.
7. **Balance y primer release**: `sim-combat` y `sim:economy` dentro de sus metas (incluidas L1 y L5), telemetría de
   combate y después `npm run release`.

Antes de cada commit: `npm run bump`. La web se sigue regenerando igual, aunque no se pruebe en celular.

## Verificación
- **`npm test` completo** desde `tools/`. Sigue en Chrome headless: es el mismo motor que WebView2. Atención a e2e,
  migración, ciclo y expedición.
- **Tests nuevos:**
  - `test-combat.mjs`:
    - motor con semillas fijas;
    - cada encuentro del Acto 1 se puede ganar con el grupo del tutorial;
    - el jefe dura de 6 a 12 turnos;
    - guardar y retomar a mitad de una pelea.
  - `test-story.mjs`:
    - intro → prólogo → t1 → t5 guiado → primer combate → Bitácora;
    - las escenas no se repiten;
    - Saltar funciona;
    - una partida vieja recibe `state.story` sin perder nada.
- **`npm run sim:economy`** con el efecto de Raíz, y **`node sim-combat.mjs`** dentro de las metas de la sección I.
- **`test-settings.mjs`** (nuevo): cada ajuste se guarda, se aplica en vivo (FPS medidos con el limitador, escala de
  resolución, volúmenes) y sobrevive al reabrir.
- **Guías:** cada uno de los 7 primeros contactos aparece una sola vez y en su momento. El Manual desbloquea los capítulos
  en orden.
- **Escritorio:**
  - `npm run desktop:dev` a 1280×720 y 1920×1080: recorrido completo como jugador nuevo, FPS de la cinemática y del combate.
  - Cerrar y reabrir mantiene la partida.
  - El login online funciona.
  - El instalador `.exe` instala, abre y se actualiza contra un release de prueba.
- **Mac, sin tener una Mac:**
  - El workflow manual compila el `.dmg`, abre la app en el runner de macOS y saca capturas (logo, intro, ciudad,
    combate).
  - Una prueba con WebKit (motor de Safari) en headless corre las escenas principales. Se suma solo como herramienta de
    desarrollo en `tools/`.
  - Una prueba real en una Mac de alguien conocido antes del primer release público.
- **Capturas** de: logo, planos de la intro, prólogo, flecha sobre Expedición, combate con casillas marcadas y Bitácora.
