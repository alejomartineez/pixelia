# Pixelia · Tu ciudad, tu estilo — documento de diseño y contratos

PWA (HTML + ES modules, **sin build**) para iPhone **y PC**. Juego de construir ciudad (estilo city-builder casual) donde la
ciudad es la base para salir de **expedición** y aguantar las **amenazas** de cada temporada. Los minijuegos se retiraron en la
Fase 5 (guardado v3); el ciclo nuevo (Expedición, Amenazas, Épocas, recursos, tutorial y migración) está en [DESIGN-CORE.md](DESIGN-CORE.md).
Estética: **3D vóxel nítido** (modelos de vóxeles dibujados a alta resolución con antialias, oclusión ambiental y contorno tinta) + **UI oscura** pixel art (pizarra y madera oscura, bordes de metal gastado, texto claro, acentos dorado y azul Dezings ; ver **Interfaz oscura**). Desde El Quiebre ([docs/PLAN-QUIEBRE.md](docs/PLAN-QUIEBRE.md) §J) el mundo es más oscuro y serio; la ciudad sigue siendo el refugio cálido.
Público: **adultos que juegan ratos cortos, en el celu y en la PC** (2 a 10 minutos, varias veces por día), solos o con su gente.
Neutro de género: cada quien elige su personaje y los textos no suponen quién juega. El tono es **cozy adulto**: cálido pero
sobrio, más cerca de Townscaper o Dorfromantik que de un juego infantil (ver **Guía de tono**). Tiene que ser **claro,
con decisiones que pesan y metas que se ven** (cada rato avanza algo, el progreso se nota de lejos), nunca frustrante
(sin energía artificial: el límite son las provisiones que produce tu ciudad, con una salida corta gratis por día; sin
muros de pago; las gemas se ganan jugando; nunca se pierde nada para siempre).
Idioma: **español rioplatense** (vos, tocá, construí). Nada de marcas o personajes de juegos existentes: todo original.

## Guía de tono
Vale para todo texto nuevo y para la pasada sobre lo que queda (Fase 6). Ante la duda: ¿lo diría una persona adulta del
barrio, sin hablarle a un chico?
- **Sin diminutivos** en sistemas, premios, botones, recursos ni nombres de edificios: "regalos", no "regalitos"; "casa",
  no "casita". Se permiten solo cuando son la palabra normal del objeto ("bombilla", "palito") o en un chiste puntual.
- **Humor seco y local** en vez de tierno: observaciones del barrio, ironía suave, cosas que pasan en cualquier pueblo.
  "El arroyo creció. Como todos los años, nadie movió el auto". Nada de "¡¡Yaaay!!", corazones ni "mimos".
- **Neutro de género con sustantivos**, no con "@", "x" ni "e": gente, vecindad, el grupo, contactos, quien lidera, la
  persona que te visita. "Llegó gente nueva", no "llegaron vecinos/as". Sin "amigas" ni "princesas" como público supuesto.
- **Premios y festejos proporcionados**: un toast o un sonido para lo chico; **confeti y fanfarria solo en momentos grandes**:
  cambio de época, monumento terminado, amenaza superada con ≥ 90%, región explorada completa. Una subida de nivel o un
  cobro no llevan confeti.
- **Exclamaciones con medida**: una por pantalla como mucho. Los títulos de resultado describen lo que pasó ("Volvieron
  todos", "Zona explorada", "Casi") en vez de calificar ("¡Divino!", "¡Increíble!").
- **Números a la vista y frases cortas**: "Cruzar el arroyo · 70%", "Volver · 3 provisiones". Los textos de ayuda dicen qué
  hacer, no venden.
- **Ausencias sin culpa**: "Mientras no estabas pasó la tormenta: salvaste el 92%". Nunca "¡Te extrañamos!" ni "¡No nos
  abandones!".
- **Nombres sobrios**: edificios por lo que son (Panadería, Taller, Dispensario), estilos por estación o lugar (Otoño, Bruma, Ceniza).
- **Fuera lo tierno** (El Quiebre, §J7): personajes solo personas; nada de mascotas-avatar, tutús, orejitas ni "mimosos".
  Los Hallazgos se nombran como cosas que se encuentran en la isla ("Ancla Oxidada", "Pato del Bañado"), no como peluches.

- **Registro épico** (El Quiebre, [DESIGN-STORY.md](DESIGN-STORY.md)): solo en el prólogo, los jefes y las revelaciones.
  Frases cortas y concretas, sin mayúsculas, signos de más ni adjetivos grandes: "La tierra se vació por dentro y se
  partió", no "¡El cataclismo más terrible de la historia!". La ciudad sigue cálida y sobria.

Reemplazos de ejemplo:

| Antes | Ahora |
|---|---|
| regalitos | regalos |
| brillitos (moneda del álbum) | recortes |
| Amigas (pestaña y botón) | Contactos |
| niveles de amistad Conocidas → Amigas → Compinches → Íntimas → Inseparables | Saludo → Mate → Asado → Llave de casa → Familia |
| "¡Divino!" (combo de Joyas) | "Combo" |
| tema Dulce Pastel | Otoño (o Puerto) |
| Panadería Dulce, Café Gatito, Tienda Brillo | Panadería, Café, Tienda |
| Casita, Banquito, florcitas, pajaritos | Casa, Banco, flores, pájaros |
| figuritas / Álbum | Hallazgos (cuando llegue la Fase 5) |
| "¡Te extrañamos!" | "Mientras no estabas…" |
| tipo de personaje por defecto Chica, "animalitos" | Gente (desde la v4, solo personas: los animales se migran a una persona) |
| Vestidor, "boutique rosa" | Equipaje, la Sastrería (madera oscura, cuero y bronce) |
| Ciudad Moderna, Playa Tropical, Bosque, Invierno Nevado | Ceniza, Bruma, Musgo, Escarcha (más Ocaso) |
| Pollito Pío, Unicornia Mimosa, Autitos, Mascotas | Pato del Bañado, Ciervo Blanco, Vehículos, Fauna de la Isla |

## Estructura

```
index.html  styles.css  manifest.webmanifest  sw.js
vendor/three.min.js        (import * as THREE from 'three'  — vía importmap)
fonts/ icons/
src/main.js                arranque, router, ctx, endGame
src/core/                  NO MODIFICAR salvo el dueño del núcleo
  bus.js       eventos
  state.js     store: estado + guardado + monedas/xp/compras
  data.js      catálogos y balance (edificios, ropa, piezas del esquife, misiones, logros)
  economy.js   reglas de ciudad (construir, producir, mejorar, expandir, formatos)
  quests.js    misiones, diarias, logros, login
  ui.js        h(), modal, toast, rewardModal, floatText, flyCurrency, confetti, costHtml, progressHtml
  icons.js     icon(name,size) / iconUrl(name)
  audio.js     audio.sfx(name) / audio.music(name)
  voxel.js     Voxels, createPixelRenderer, addLights, setIsoCamera, makeBillboard, imageSprite, shade, disposeObject
  hud.js       HUD de la ciudad en 3 capas (Hoy · Temporada · Largo plazo; ≤ 14 controles, ≤ 4 globitos)
  unlocks.js   apertura escalonada de funciones (DESIGN-CORE.md §6.2)
src/city/models.js         modelos vóxel de edificios/naturaleza  (agente Modelos)
src/scenes/city.js         escena ciudad                          (agente Ciudad)
src/avatar/avatar*.js      modelo del personaje (todos los tipos)  (agente Avatar)
src/city/themes*.js        temas de ciudad + selector             (agente Ciudad)
src/scenes/onboarding.js   primera partida: personaje, nombre, ciudad, tema
src/avatar/skiff.js        modelo del esquife (car.js lo reexporta) (agente Avatar)
src/scenes/wardrobe.js     vestidor + esquife                     (agente Avatar)
src/scenes/panels.js       misiones, ajustes, login, nivel, obras    (agente Paneles)
src/expedition/            Expedición: exp-data, exp-gen, exp-rules, exp-scene, exp-ui, expedition (DESIGN-CORE.md §2)
src/threats/               Amenazas de temporada (DESIGN-CORE.md §3)
tools/smoke.mjs            prueba headless con capturas
```

> **Minijuegos retirados (Fase 5).** Joyas Brillantes, Bloques Pixel, Estacionamiento Express y Ruta Pixel se sacaron del
> código: sus edificios pasaron a Taller, Dispensario, Establo y Casa de Expediciones, los materiales a los de región, los
> potenciadores a equipo y el Álbum a **Hallazgos** (mismos ids). La migración del guardado (v3) está en `state.js` y en
> DESIGN-CORE.md §7.2. Quién toca qué archivo en cada fase: DESIGN-CORE.md §10.

Cada agente es dueño **solo** de sus archivos (puede crear archivos nuevos dentro de su carpeta con prefijo propio, p.ej. `src/expedition/exp-ui.js`). Si necesita un cambio en `src/core/*`, `main.js`, `styles.css` o `index.html`, **no lo hace**: lo reporta en `coreRequests`. Puede agregar CSS propio inyectando un `<style>` desde su módulo (con selectores prefijados por la clase de su escena, p.ej. `.scene-expedition ...`), y quitarlo en `unmount`.

## Contrato de escena

```js
// default export: fábrica que recibe ctx y devuelve la instancia
export default function create(ctx) {
  return {
    hud: false,            // false oculta el HUD de la ciudad (la expedición y el vestidor lo ocultan)
    music: 'game',         // 'city' | 'game' | 'calm' | 'expedition' | 'threat' | null
    async mount(container, params) {},  // container: div.scene-root.scene-<id> a pantalla completa
    unmount() {},          // liberar TODO: renderer.dispose(), listeners de window/document, timers, bus.on(...) (guardar el unsubscribe), estilos inyectados
  };
}
```
`ctx` = `{ store, state, bus, ui, audio, data, economy, quests, router, hud, home, expedition, threats, openPanel, chests, album, season, events, net, … }`
- `ctx.router.go(id, params)` — ids: `city`, `wardrobe`, `onboarding`, `home`, `expedition`.
- `ctx.openPanel(name, params)` → panels.js (`quests`, `settings`, `login`, `levelup`, `help`, `rank`, `works`, `expedition`, `workshop`).
- `ctx.router.go('expedition', { region, kind, resume })` — escena de la Expedición (DESIGN-CORE.md §2.11); no usa `endGame`.
- Imports directos permitidos: `import { store } from '../core/state.js'`, etc. Rutas relativas.

## Plataformas: iPhone y PC (obligatorio)
- Usar **Pointer Events** (`pointerdown/move/up`) para todo, funcionan con touch y mouse. `touch-action: none` en áreas de juego. Para arrastres usar `setPointerCapture`.
- **Teclado en PC**: Esc = salir/cancelar; en la expedición y los tableros el mouse alcanza.
- Layout: celular vertical (390×844 con notch: respetar `var(--safe-t)` / `var(--safe-b)`), PC apaisado (1366×800): centrar tableros con tamaño máximo, no estirar. iPad también.
- La ciudad en PC: rueda = zoom, arrastrar = mover cámara.
- Sin hover-only: todo debe funcionar con toques.
- Rendimiento: iPhone 12+ a 60fps. Reusar geometrías/materiales, nada de crear objetos por frame en loops calientes.

## Estilo visual
- Paleta única en `src/core/palette.js` (`PALETTE`, re-exportada por `data.js`) y variables CSS en `styles.css` (`--primary` terracota, `--second` azul pizarra, `--mint`, `--sky`, `--gold`, `--ink`...; clases `.btn.primary` / `.btn.second`). Contorno tinta café `#3d2f2a`. Nada de realeza: sin coronas, castillos ni princesas (la Municipalidad es el centro de la ciudad).
- 3D: usar SIEMPRE `createPixelRenderer` + `addLights` + `Voxels` de `voxel.js` (material compartido). 1 tile de ciudad = 1 unidad de mundo; edificios con **8 vóxeles por tile** (`scale: 1/8`).
- 2D (íconos, tableros): canvas a baja resolución con `image-rendering: pixelated`, sprites pixel-art dibujados por código, con "volumen" (bisel claro arriba-izquierda, sombra abajo-derecha) para que combine con lo 3D.
- Fuente: `var(--font)` (Pixelify). Íconos: `icon('coin')`, `icon('gem')`, `icon('star')`, `icon('heart')`, `icon('crown')`, `icon('xp')` + cualquier emoji pixelado (`icon('🌸')`) o nombres en `icons.js`.
- Clases CSS listas: `.btn` (+ `.pink .lilac .mint .sky .gold .ghost .small .block`), `.icon-btn`, `.panel`, `.card` (+ `.locked .selected`), `.row .col .grid .grid.tight`, `.chip`, `.badge`, `.progress` (+ `.xp .pink .gold`), `.tabs .tab .tab.active`, `.swatches .swatch`, `.scroll`, `.game-bar` (+ `.game-stat` con `<small>` y `<b>`, `.game-title`, `.spacer`), `.game-bg`, `.game-bg.pattern`, `.game-help`.
- Feedback claro: sonido (`audio.sfx`), partículas, `ui.floatText`, `ui.flyCurrency`, rebotes. Confeti y fanfarria solo en los
  momentos grandes de la Guía de tono (cambio de época, monumento, amenaza superada, región completa).

## Interfaz oscura (El Quiebre, §J6)
Todo color de la interfaz sale de los tokens de `:root` en `styles.css`; las pantallas nuevas no ponen colores fijos.
- **Superficies**: `--page` (fondo), `--panel`/`--panel-2` (madera oscura), `--surface`/`--surface-2`/`--surface-hover`
  (pizarra), `--rule` (divisores), `--track` (rieles y barras vacías), `--wood`/`--wood-d` (cabecera de los modales, con
  el título en dorado).
- **Bordes y sombras**: `--edge` (contorno casi negro, como el contorno tinta del 3D), `--metal`/`--metal-l` (marco de
  metal gastado de los modales), `--shade` (sombra dura).
- **Texto**: `--ink` (claro), `--ink-l`, `--ink-ll` (secundario, AA sobre `--surface-2`), `--ink-dark` (sobre rellenos
  claros: dorado, menta, cielo).
- **Acentos**: cada color tiene base (relleno de botón), `-d` (sombra del botón), `-l` (fondo teñido oscuro) y `-t`
  (texto sobre oscuro). `--second` y `--accent` son el azul Dezings `#3d55b8`; `--gold` es el dorado.
- Los colores claros que vienen de datos (temporadas, rarezas, sets de Hallazgos) se oscurecen al usarlos con
  `color-mix(in srgb, <color> N%, #1d1916)`. Contraste mínimo AA (4,5:1 en texto chico, 3:1 en botones de 18 px en
  negrita).
- El 3D de las escenas de interfaz (Equipaje, onboarding) usa fondo `0x1d1916`; la Sastrería se re-mapea a madera, cuero
  y bronce con `tailor()` de `wardrobe-stage.js`.
- Las láminas de los Hallazgos (`album-art.js`) son ilustración y conservan sus colores.

## Ambiente: lugar, luz, día y noche, clima (El Quiebre, §J1–J5)
- **`src/core/ambience.js`** (puro, también corre en Node): `PLACES` (ciudad, expedición cerca / media / lejos, mina,
  faros, Bajo Mundo), `WEATHER` (despejado, nublado, lluvia, tormenta, niebla, nieve, ceniza y los de las amenazas: humo,
  helada, sequía), `resolveLook({ base, place, hour, weather, light, region })` → cielo, luces, saturación, tono, niebla,
  brillo de ventanas, partículas. Reloj de la ciudad `cityHour()` (20 min reales por día), `cityWeather()` (casi siempre
  lindo: es el refugio), `lightFor(state, rank)` y `initWorldLight` (main.js) para `state.world.light`.
- **`src/core/ambience-fx.js`** lo aplica a una escena: luces, cielo CSS (ciudad) o fondo (expedición), `r.setGrade` de
  `voxel.js` (saturación, tono y niebla por profundidad en el pase final, que queda aunque no haya contorno),
  `setNightGlow` (los vidrios van a su capa con `windowMaterial()`; `models.js` los separa al compilar), lluvia, nieve,
  ceniza, brasas y polvo (`graphics().particles`; nada con reducir movimiento) y relámpagos (`ambience:thunder` para el 3c).
- **Ciudad** (`src/scenes/city-ambience.js`): hora y clima del día, el clima de la amenaza en sus 48 h de señales
  (`decor.weather`, `THREAT_WEATHER`), humo de chimeneas (más al atardecer, de noche y con frío), la casa nueva prende la
  chimenea, la cosecha suelta hojas, la reparación limpia. Ajustes → Juego → "Día y noche en la ciudad".
- **Expedición** (`exp-ambience.js`; reglas en `exp-rules.js` `conditions`): se sale al alba (6:00) y cada paso es una hora;
  desde las 20 la visión baja 1 (el Farol la devuelve). Un frente de clima por salida a lo sumo, con su propia suerte (no
  cambia mapas ni peligros) y anunciado: tormenta (visión −1 y +1 provisión en colina, bañado y roca; la Lona lo evita), niebla y
  ceniza (visión −1), nieve (+1 en terreno difícil). Chip de hora y clima en la barra, aviso al cambiar, niebla y color según el anillo, polvo y huellas.
- **Para lo que viene**: el combate pide `combatConditions(cond)`; los ecos de noche (L6) usan `cityEchoSpots` /
  `expEchoSpots`, `ambience:night` y `__exp.echoSpots()`. Pruebas y capturas: `?hour=21.5` y `?weather=tormenta`.

## Personajes, temas y contorno
- **Personajes** (`data.js` → `AVATAR_TYPES`, paso 4a de El Quiebre): el tipo es el **pueblo** (humano, enano, anuro, gente-zorro, orco; los Vaciados no se eligen), con complexión recia o esbelta (`build`) y una cara (`face`: barbas, cicatrices, parche, pintura). Chica y chico pasan a humano esbelto y recio en el guardado v5 (`migrateV5`). Estilo **mezcla**: la gente en vóxel detallado a 1/48 (`src/avatar/figure.js` arma las piezas y `avatar.js` el modelo) y las criaturas en low-poly facetado (`lowpoly.js`). **Las reglas de arte (caras, proporciones, rampas de color y prueba en grises) están en [docs/ARTE-PERSONAJES.md](docs/ARTE-PERSONAJES.md)**; la galería para revisarlas es `tools/people.html`. La primera partida (`onboarding.js`) arranca con un pueblo al azar; después se cambia en el Equipaje o en Ajustes → "Cambiar personaje". Cada pieza de `CUSTOM_CATALOG` puede tener `types` y se filtra con `fitsType(item, type)` en tienda, cofres, Pase y subida de nivel.
- **Estilos de ciudad** (`city/themes.js`): Pueblo Acogedor (por defecto, sin re-mapeo), Otoño, Musgo, Ceniza (pizarra y brasas, ventanas encendidas), Bruma (la costa de los faros), Ocaso (ventanas encendidas), Escarcha y Luces de Noche (`dark: true`, aro claro bajo el personaje). Los ids viejos quedan como alias (`THEME_ALIASES`: pastel → otono, moderna → ceniza, playa → bruma, bosque → musgo, invierno → escarcha) y la v4 los cambia en el guardado. No hay modelos por tema: los colores de vóxel se re-mapean (`mapColor`; las reglas usan "ranuras": `pink` = terracota principal, `lilac` = azul pizarra) y cambian terreno, cielo, luces y naturaleza. Se guarda en `state.city.theme`, se elige gratis con `openThemePicker(ctx)` (botón paleta en la ciudad, Ajustes y onboarding), emite `city:theme` y se ve en las visitas.
- **Vóxel nítido** (desde nov 2026; antes el 3D se dibujaba a ~480 px y se agrandaba pixelado, y los bordes diagonales hacían serrucho): el "pixel" del arte es el **vóxel**, no el pixel de pantalla. `createPixelRenderer` dibuja a **2 pixeles de render por px CSS** (en PC es supersampleo 2×2; en celu, casi nativo) con **MSAA 4×** y el canvas al 100% suavizado (`.voxel-canvas`, nunca `pixelated`). Tope de 4,6 M pixeles de render; si los cuadros vienen lentos (<42 fps) baja solo a 1,5× y 1,2×. `settings.lowQuality` (o `?quality=low`) arranca en ≤1,5× sin MSAA; `?quality=high` apaga el ajuste automático (capturas).
- **Oclusión ambiental por vértice**: `Voxels.toGeometry` oscurece cada esquina según sus 3 vecinos (rincones, aleros, pie de las paredes) — es lo que da volumen y lectura. `{ ao: false }` la apaga. Pisos con variación en manchas de 2×2 y contraste bajo.
- **Contorno tinta**: `createPixelRenderer({ outline: true })` pinta ≈1 px CSS de tinta `#3b2340` por fuera de las siluetas (saltos de profundidad), con borde suavizado (`?outline=0|1` lo fuerza para comparar). Las miniaturas offscreen (edificios, personajes, temas, cofres) se dibujan a **3×** con antialias y `outlineCanvas(canvas, ancho)` de `voxel.js`; se muestran achicadas sin `pixelated`.
- **2D sigue siendo pixel art**: íconos de `icons.js` (grilla de 24, bloques enteros), tableros de Joyas/Bloques, cielo de Ruta Pixel y burbujas `makeBillboard` conservan `pixelated`: la UI y los sprites son pixel art, el mundo 3D es vóxel nítido.

## Sonidos disponibles
`audio.sfx(name)`: tap, open, close, coin, gem, build, place, done, levelup, error, match, combo(n), pop, clear, swoosh, star, win, lose, horn, crash, bump, select, buy.
`audio.music(name)`: city, game, drive, calm, null. (El router pone la música de la escena según `music`.)

## Estado (store.state) — ver `defaultState()` en state.js
- `coins, gems, player{name,cityName,level,xp}`
- `onboarded`, `avatar{type, skin(index), hair, hairColor(id), dress, dressColor(id), crown, acc}` (`state.princess` = alias viejo, no enumerable), `avatarLooks{[type]: look}`, `city.theme`; `car{body, color(id de OUTFIT_COLORS), wheels, topper}`; `owned{hair:[],dress:[],...}`
- `city{buildings:[{uid,id,x,z,rot,level,buildEnd,upgradeEnd,lastCollect}], nextUid, expansions, flagColor, camera, rankPerks{builders}}` (`rankPerks`: constructoras ya regaladas por rango, para no darlas dos veces)
- `materials{madera, piedra, mineral, hierbas}`: materiales de región (expedición; monumentos, obras, equipo). Ver DESIGN-CORE.md §5.
- `achievements{id: ms}`: Logros cumplidos (`src/core/achievements.js`; se ven al final del Diario de la Bitácora) · `city.charmBonus`: Encanto fijo que dejó Mi Casa al irse (guardado v6) · `v6{had, coins, gems, mats, charm, charmBonus, shown}`: lo que hizo la migración v6 (el aviso «Mi Casa cerró sus puertas» sale una vez). Mi Casa (`home{…}`, edificio `mi_casa`) se retiró en el paso 1c de La Travesía.
- `games{…}`: solo en partidas de antes de la v3 (progreso de los minijuegos retirados, guardado y sin uso) · `v3{gems, finds, conv, refund, placeExp, shown}`: lo que hizo la migración v3 (el aviso "Los minijuegos se retiraron" sale una vez).
- `stats{}` (usar `store.inc(key,n)` / `store.setMax`): `match3Wins`, `blocksLines`, `parkingWins`, `drivingMeters`, `rankBest`, `charmBest` alimentan logros; `matsEarned` cuenta materiales ganados.
- `tutorial{}` flags libres. `settings{music,sfx,lowQuality}`.
- Mutar estado solo vía store/economy cuando exista función; si se toca a mano, llamar `store.markDirty()`.

## Eventos (bus)
`currency:changed, coins:earned, gems:earned, xp:changed, level:up{level,reward}, building:placed{b}, building:built{b}, building:upgradeStarted{b}, building:upgraded{b,level}, building:moved{b}, building:removed{b}, production:collected{b,amount,currency}, city:expanded, builders:changed, minigame:finished{game,score,stars,won}, customize:changed, item:bought, quests:changed, scene:changed{id}, stats:changed, hud:build{focus?}, city:flag{color,hex}, town:rankup{rank,def,era,eraChanged}, era:changed{era,from}, building:renovated{b,era,from}, city:focus{uid}, city:place{id}, city:placing{active}, materials:changed{materials,delta,reason}, achievement:new{ids}` (`hud:build` lo emite el botón Construir del HUD; la ciudad abre el menú; `focus` = id de edificio a resaltar. `town:rankup` sale al terminar la mejora de la Municipalidad: la ciudad abre el panel `rank` en modo festejo. `city:focus` abre la ficha de un edificio desde otro panel; `city:place` arranca la colocación de un edificio (lo usa el panel de Obras); `city:placing {active:false}` sale al terminar de colocar: las subidas de nivel ganadas mientras tanto se muestran recién ahí, para no tapar la barra de Colocar).

## API de modelos (contratos entre agentes)

### src/city/models.js (agente Modelos)
```js
export const VOXELS_PER_TILE = 8;
export function buildingModel(id, level = 1, opts = {}) // -> THREE.Group
```
- Origen: **centro del footprint, base en y=0**. Ocupa `size[0]` tiles en X y `size[1]` en Z (rot 0). El frente (puerta) mira a **+Z**. La ciudad rota el grupo `rot * 90°` alrededor de Y.
- `group.userData.height` = altura en unidades de mundo (para ubicar burbujas arriba).
- `group.userData.update?.(dt, t)` animaciones opcionales (agua de la fuente, rueda girando, banderas, humo de chimenea, patitos). La ciudad llama esto cada frame.
- Mayor `level` = más detalle visible (piso extra, adornos dorados, banderas, flores). Cada mejora tiene que **notarse de lejos**.
  Cada nivel cambia la estructura y cada época el material y la paleta (`b.era`, `eraWall/eraRoof/...`, `def.eraArt`;
  DESIGN-CORE.md §4). Con arte por época (Fase 4, terminada): Municipalidad (`models-town.js`), casas (`eraHouse`),
  negocios (`models-shops.js`, `models-shops3.js`), edificios del ciclo (`models-cycle.js`), defensas
  (`models-defense.js`, usa `cycleBody` y `eraTower` de `models-cycle.js`), deco y caminos (`models-deco.js`, materiales
  en `DS[era]`) y la base de los monumentos (`eraBase` en `models-monuments.js`).
  Deco, caminos y monumentos no se renuevan: la escena les pasa la época de la ciudad (`drawEra` en `city.js`;
  en las visitas, la del rango del dueño). Árbol, arbusto, cerezo y unicornio valen 1 siempre (comparten caché).
  `upgradeDressing` ya no existe; el respaldo (`eraRecolor`) queda para los especiales de minijuego.
  `eraWall` arma volúmenes macizos (una cáscara hueca duplicaría los triángulos). El arte por época no pasa por
  `calmColors`: sus juntas e hiladas son a propósito.
- Municipalidad (id `castillo`): 8 niveles, uno por rango (`TOWN_RANKS[].look` dice qué estrena: pórtico, alas, fuentes, cúpula
  dorada, techo azul con torrecitas, mirador con alfombra roja, arco dorado con fuegos artificiales). `buildingModel` admite nivel 8 solo para ella.
- Monumentos (`cat:'monumento'`, `models-monuments.js`): un modelo por etapa. Cada builder dibuja el monumento **terminado**;
  `staged` lo recorta a la altura de la etapa (≈10% / 35% / 60%…) y le suma andamio al frente y a la derecha, lona, grúa con el
  material colgando, pilas de los materiales que usa, cinta y un cartel con una pelotita por etapa (doradas las hechas).
  Terminado: borde dorado, brillitos y lo animado (haz del Faro, telescopio, agujas y campana de la Torre, banderas).
  Ojo: la capa y=0 del lote queda tapada por la base del lote en la ciudad; los detalles del piso van en y≥1.
- Caminos (`cat:'camino'`): baldosa plana de 1 vóxel de alto que cubre el tile entero.
- Cachear geometrías por `id+level` (clonar el grupo / reusar geometry).
```js
export function constructionModel(w, d)    // andamio + cinta + cajas para obra/mejora, origen centro, base y=0
export function natureModel(kind, seed)     // 'tree' | 'pine' | 'bush' | 'rock' | 'flowers' | 'mushroom' — decoración fuera del terreno
export function cloudModel(seed)            // nube vóxel (sin sombra)
export function thumbnail(id, level = 1, era = 1, theme) // -> Promise<dataURL> ícono del edificio (render offscreen, cacheado). También (id, level, theme, era).
```

### src/avatar/avatar.js (agente Avatar)
```js
export function avatarModel(look, opts = {}) // -> THREE.Group, altura total ≈ 1 unidad, mira a +Z, base en y=0
// group.userData.update(dt, moving:boolean)   — caminar (piernas/brazos/rebote) o idle (respira, parpadea)
export function randomLook(seed, opts)        // look aleatorio válido (gente de la ciudad); opts.type: pueblo, opts.cls: clase
// opts de avatarModel: cls (viste por clase o rol, ROLE_CLASS), gear (equipo fuera del catálogo), seated, npc, scale
```
### src/avatar/skiff.js (agente Avatar): el esquife volador (plan §M5, ex auto)
```js
export function skiffModel(car, opts = {})  // -> THREE.Group, eslora ≈ 1,5–1,9 en Z, proa a +Z, flota a SKIFF_FLOAT sobre y=0
// car = state.car = { body: casco, color: pintura, wheels: aparejo (vela o globo), topper: proa } (claves de antes)
// opts.driver: look sentado en el banco de popa · userData.sail: el aparejo (miniatura) · userData.size = {w, l, h}
// userData.update(dt, speed, steer): se mece, escora al doblar, la vela flamea y el cristal de Céfiro late
export function carStats(car)             // {speed, handling} 1..5 desde CAR_BODIES
export function normalizeCar(car)         // corrige ids y traduce los del auto de antes (V5_CAR)
```
`car.js` reexporta todo como `carModel`. Vóxel de 1/24, madera en 4 tonos, la pintura sale de `clothHex` y el cristal
de abajo va con `lightMat`. En la ciudad (`city-life.js`) amarra al muelle del Establo (un poste con soga y dos tablas)
y cada 40 a 80 s da una vuelta a la isla por fuera del borde, a la altura de los techos. En el Equipaje, el escenario
es el muelle de amarre de noche (`buildDock` en `wardrobe-stage.js`). Galería: `tools/people.html?set=esquifes`
(`part=casco|vela|proa`, `driver=1`).
Usar colores de `data.js` (`OUTFIT_COLORS`, `HAIR_COLORS` y los `skins` de cada pueblo); la ropa los apaga con `clothHex` y las rampas salen de `ramp` (`avatar-kit.js`).

## Economía (resumen)
- Casas dan **población**; negocios requieren población mínima (`popReq`) y producen monedas por ciclo con tope (`cap` ciclos) → hay que volver a cobrar.
- Deco da **felicidad** → bonus de producción hasta +50%. Mejorar la Municipalidad → +8% global por nivel.
- **Rango de la ciudad** = nivel de la Municipalidad (`TOWN_RANKS` en data.js: Aldea → Caserío → Pueblo → Villa → Ciudad → Gran Ciudad → Metrópolis → Capital).
  Subir pide un **expediente** (`req`: población, felicidad %, Encanto, tipos de negocio distintos) + nivel de jugador (`reqLevel`) + monedas/gemas y obra.
  Cada rango da `reward` (gemas y cofre), terreno (`land` = cuántas expansiones permite; `expansionStatus()` pide nivel **y** rango),
  constructoras de regalo (`builders`, en los rangos 3 y 6; no cuentan para el tope de compra) y desbloquea los edificios con `rank`.
  API en economy.js: `townRank`, `rankDef`, `rankStatus` (reqs, allOk, levelOk, stars), `syncRank` (en cada `tick`).
  UI: chip de rango y época en el HUD (brilla con "!" si se puede subir) → panel `rank` (`panels-rank.js`), ficha de la Municipalidad con el expediente.
- **Encanto** (`charmInfo`/`cityCharm`): qué tan linda y variada está la ciudad. Cada edificio terminado suma `charm` (o un valor por categoría,
  ver `charmBase`) × (1 + 0,25 por nivel extra); cada copia repetida del mismo edificio vale ×0,85 de la anterior; la variedad multiplica
  +2% por tipo distinto (tope ×1,5). Se muestra en estrellas (0–5) respecto del Encanto que pide el próximo rango. `charmGain(id)` = cuánto sumaría otra copia.
- Balance (`SIM_DAYS=120 node tools/sim-economy.mjs .`, con monumentos y materiales): jugando 4 ratos por día, rango 2 el día 1, rango 5 ≈ día 12
  y rango 8 ≈ día 51; con 2 ratos por día (`SIM_DAYS=150 node tools/sim-economy.mjs . new 1 9,20`), 2 / 20 / 95. Las monedas sobran: el ritmo
  lo marcan `reqLevel`, la población (terreno), el Encanto (variedad) y los monumentos (materiales). La sim reacomoda la ciudad si un monumento no entra.
- **Materiales y monumentos**: los materiales son los de región (madera, piedra, mineral, hierbas: `REGION_MATERIALS` en
  data.js) y los trae la expedición (cada región tiene los suyos, DESIGN-CORE.md §2.9); también salen en diarias, amenazas, en la
  "Bolsa de materiales" de los cofres (elige lo que más te falta; antes del rango Pueblo da monedas) y en algunos niveles del Pase
  (`mats` en `TIERS`). Los de los minijuegos retirados se migraron 1:1 (cristal→mineral, ladrillo→piedra, tuerca→madera,
  mapa→hierbas) junto con los costos de `MONUMENTS`.
  `store.canAfford/spend/grant` entienden `cost.mats`/`reward.mats` (`{madera: n, ...}`); `costHtml` los dibuja.
  `MONUMENTS` (Faro, Jardín Botánico, Observatorio, Estadio, Museo, Torre del Reloj) también son edificios `cat:'monumento'`, `max:1`:
  el **nivel es la etapa** (4 o 5). Construir paga la etapa 1; cada etapa siguiente es una mejora (`upgradeInfo` → `stages[nivel]`,
  con materiales + monedas + obra con constructora). Encanto = `charm` × etapas hechas / N. Terminado da un bonus permanente
  (`monuments.js` → `monumentBonus(type)`): Faro +10% monedas de negocios, Jardín +25% felicidad, Observatorio +25% XP de partidas,
  Estadio +25% chispas por partida, Museo +50% de chance de figurita, Torre del Reloj obras −10% (`stageTime`).
  Se desbloquean por rango (3, 4, 5, 5, 6, 7) y los rangos 4–8 piden 1, 2, 3, 5 y 6 terminados (`req.monuments`).
  UI: botón **Obras** en el riel del HUD (desde el rango Pueblo; el globito cuenta las etapas que ya se pueden empezar) → panel `works`
  (`panels-works.js`): materiales con "Jugar", cada monumento con su etapa, lo que pide la próxima y el bonus. Al terminar una partida
  dice cuánto falta de ese material para la próxima etapa (`materialHint`). La ficha del monumento muestra "Etapa N de M" y "Avanzar obra".
- **Mi Casa** se retiró (La Travesía, paso 1c): la ciudad es el puerto desde donde se sale de travesía. El guardado v6
  (`migrateV6` en `state.js`) saca el edificio `mi_casa` y deja libre la parcela, devuelve lo pagado por las ampliaciones y los
  muebles comprados, y pasa el Encanto que daban la casa y su Confort a `city.charmBonus` (`economy.settleV6Charm`, la primera
  vez que se pide el Encanto) para que nadie baje de rango. Los trofeos pasan a **Logros** (`src/core/achievements.js`), al final
  del Diario de la Bitácora. En partidas nuevas la Municipalidad da 35 de Encanto (antes 20 + la casa). Los perfiles viejos
  que traen `city.home` se ignoran.
- Constructoras limitadas (2, se compran más con gemas). Obras con tiempo; se aceleran con gemas (≤5s gratis).
- Recursos del ciclo: provisiones, materiales de región, planos, equipo, reservas y colonos (DESIGN-CORE.md §5); la expedición
  no da monedas (sí experiencia: 10 + 5 por ★, con el Observatorio). Misiones principales guían, diarias dan hábito, logros a largo plazo, premio diario de login con racha.

## Pruebas
```
node tools/smoke.mjs --scene <id> [--device iphone|desktop|ipad] [--cheat 15] [--wait ms] [--steps pasos.json] [--shot ruta.png] [--eval js]
```
Captura en Chrome headless, imprime errores de consola y sale con código 1 si hubo. **Guardar capturas en tu carpeta del scratchpad, no en el proyecto.** Mirá las capturas (Read del png) para juzgar cómo se ve. `window.__pixelia` expone `{ctx, store, bus, economy, quests, data}` para pasos `eval`.
URL params: `?scene=id`, `?cheat=nivel` (+100k monedas, +1000 gemas), `?reset`, `?nosplash`.

Suites de punta a punta (todas con `--out carpeta` para las capturas; salen con 1 si algo falla):
```
node tools/test-e2e.mjs      jugadora nueva sin cheat en iPhone: splash → onboarding con toques reales (Osito, color de ropa, nombre y ciudad tipeados, estilo Bosque; verifica el guardado) → modal de llegada (premio del día, «Mañana se abre») → tutorial t1–t10 → nivel → cofre → potenciador viejo → equipo → «Hoy se abre: el Pase» → Pase/Hallazgos/Cofres/Eventos (desde el Pase); revisa los globitos del HUD (≤ 4) y los controles (≤ 14); al final recarga y confirma que no repite el onboarding
node tools/test-migration.mjs guardado v2 armado a mano (minijuegos jugados, álbum a medias, materiales viejos, monumento a medias, potenciadores) → v3 sin pérdidas; segunda carga igual; Joyería + Taller; sin Pista; importCode; partida nueva; v5 → v6 (Mi Casa sale: devoluciones, bono de Encanto, Logros)
node tools/test-visit.mjs    ana y bea (mock): amistad por código, regalito, visita (like, notita, ayudar obra) → buzón → la obra se acelera; pedido "Acelerá mi obra"
node tools/test-social.mjs   UI social completa (intercambios con escrow, ranking, Obra en Equipo, cuenta, conflicto)
node tools/test-rank.mjs     rango y Encanto (mock + cheat): chip del HUD → panel con expediente → Mejorar → festejo, constructora de regalo, ficha, menú, perfil público visto por una amistad
node tools/test-works.mjs    monumentos (mock + cheat): rango Pueblo → botón Obras → materiales de región con «Salir» a la expedición → panel Obras → Construir y colocar el Faro → etapas → bonus de negocios y expediente; capturas de cada etapa
node tools/test-mock.mjs     API de net.js con dos pestañas     ·     node tools/test-sql.mjs   schema.sql en PGlite
node tools/test-stress.mjs   recorre escenas + paneles N veces (--rounds 3) y mide fugas (WebGL, listeners, bus, intervalos)
node tools/gen-sw-core.mjs   regenera CORE de sw.js con todos los .js reales (--bump sube VERSION, --check solo verifica)
```
