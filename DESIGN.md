# Pixelia · Tu ciudad, tu estilo — documento de diseño y contratos

PWA (HTML + ES modules, **sin build**) para iPhone **y PC**. Juego de construir ciudad (estilo city-builder casual) con minijuegos.
Estética: **3D pixel art** (vóxeles renderizados a baja resolución y escalados sin suavizado) + UI pastel con bordes gruesos color tinta.
Público: una pareja adulta que juega casual en el celu; neutro de género (cada jugador elige su personaje). Tiene que ser **amigable, linda, con recompensas frecuentes y enganchante** (sesiones cortas, cosas para cobrar, metas claras), nunca frustrante (sin energía, sin muros de pago; las gemas se ganan jugando).
Idioma: **español rioplatense** (vos, tocá, construí). Nada de marcas o personajes de juegos existentes: todo original.

## Estructura

```
index.html  styles.css  manifest.webmanifest  sw.js
vendor/three.min.js        (import * as THREE from 'three'  — vía importmap)
fonts/ icons/
src/main.js                arranque, router, ctx, endGame
src/core/                  NO MODIFICAR salvo el dueño del núcleo
  bus.js       eventos
  state.js     store: estado + guardado + monedas/xp/compras
  data.js      catálogos y balance (edificios, ropa, autos, misiones, logros)
  economy.js   reglas de ciudad (construir, producir, mejorar, expandir, formatos)
  quests.js    misiones, diarias, logros, login
  ui.js        h(), modal, toast, rewardModal, floatText, flyCurrency, confetti, costHtml, progressHtml
  icons.js     icon(name,size) / iconUrl(name)
  audio.js     audio.sfx(name) / audio.music(name)
  voxel.js     Voxels, createPixelRenderer, addLights, setIsoCamera, makeBillboard, imageSprite, shade, disposeObject
  hud.js       HUD de la ciudad
src/city/models.js         modelos vóxel de edificios/naturaleza  (agente Modelos)
src/scenes/city.js         escena ciudad                          (agente Ciudad)
src/avatar/avatar*.js      modelo del personaje (todos los tipos; princess.js = alias)  (agente Avatar)
src/city/themes*.js        temas de ciudad + selector             (agente Ciudad)
src/scenes/onboarding.js   primera partida: personaje, nombre, ciudad, tema
src/avatar/car.js          modelo auto                            (agente Avatar)
src/scenes/wardrobe.js     vestidor + taller                      (agente Avatar)
src/scenes/panels.js       misiones, juegos, ajustes, login, nivel (agente Paneles)
src/games/match3.js        Joyas Reales                           (agente Match3)
src/games/blocks.js        Bloques Mágicos                        (agente Bloques)
src/games/parking.js       Estacionamiento Real                   (agente Parking)
src/games/driving.js       Paseo Real                             (agente Driving)
tools/smoke.mjs            prueba headless con capturas
```

Cada agente es dueño **solo** de sus archivos (puede crear archivos nuevos dentro de su carpeta con prefijo propio, p.ej. `src/games/match3-sprites.js`). Si necesita un cambio en `src/core/*`, `main.js`, `styles.css` o `index.html`, **no lo hace**: lo reporta en `coreRequests`. Puede agregar CSS propio inyectando un `<style>` desde su módulo (con selectores prefijados por la clase de su escena, p.ej. `.scene-match3 ...`), y quitarlo en `unmount`.

## Contrato de escena

```js
// default export: fábrica que recibe ctx y devuelve la instancia
export default function create(ctx) {
  return {
    hud: false,            // false oculta el HUD de la ciudad (los minijuegos y el vestidor lo ocultan)
    music: 'game',         // 'city' | 'game' | 'drive' | 'calm' | null
    async mount(container, params) {},  // container: div.scene-root.scene-<id> a pantalla completa
    unmount() {},          // liberar TODO: renderer.dispose(), listeners de window/document, timers, bus.on(...) (guardar el unsubscribe), estilos inyectados
  };
}
```
`ctx` = `{ store, state, bus, ui, audio, data, economy, quests, router, hud, endGame, openPanel, gameStatus }`
- `ctx.router.go(id, params)` — ids: `city`, `wardrobe`, `match3`, `blocks`, `parking`, `driving`.
- `ctx.router.openGame(gameId)` — verifica desbloqueo (nivel + edificio construido) y muestra toast si no.
- `ctx.gameStatus(gameId)` → `{ok, reason, locked?, needsBuilding?}`.
- `ctx.openPanel(name, params)` → panels.js (`quests`, `games`, `settings`, `login`, `levelup`, `help`).
- `ctx.endGame(result)` — **todos los minijuegos terminan con esto**:
  `result = { game, score, stars (0..3), won, coins (BASE, se multiplica por nivel), gems, xp, title?, subtitle?, lines?: [html], newBest?, againLabel? }`
  Acredita premios, emite `minigame:finished`, muestra el modal de premio y devuelve `'again'` o `'city'` (si es `'city'` ya navega solo). Si devuelve `'again'`, el juego reinicia/avanza al siguiente nivel.
- Imports directos permitidos: `import { store } from '../core/state.js'`, etc. Rutas relativas.

## Plataformas: iPhone y PC (obligatorio)
- Usar **Pointer Events** (`pointerdown/move/up`) para todo, funcionan con touch y mouse. `touch-action: none` en áreas de juego. Para arrastres usar `setPointerCapture`.
- **Teclado en PC**: juegos de manejo con flechas/WASD (+ espacio); Esc = pausa/salir/cancelar; en Bloques/Joyas el mouse alcanza.
- Layout: celular vertical (390×844 con notch: respetar `var(--safe-t)` / `var(--safe-b)`), PC apaisado (1366×800): centrar tableros con tamaño máximo, no estirar. iPad también.
- La ciudad en PC: rueda = zoom, arrastrar = mover cámara.
- Sin hover-only: todo debe funcionar con toques.
- Rendimiento: iPhone 12+ a 60fps. Reusar geometrías/materiales, nada de crear objetos por frame en loops calientes.

## Estilo visual
- Paleta en `data.js` → `PALETTE` y variables CSS en `styles.css` (`--pink`, `--lilac`, `--mint`, `--sky`, `--gold`, `--ink`...). Pasteles + contorno tinta `#3b2340`.
- 3D: usar SIEMPRE `createPixelRenderer` + `addLights` + `Voxels` de `voxel.js` (material compartido). 1 tile de ciudad = 1 unidad de mundo; edificios con **8 vóxeles por tile** (`scale: 1/8`).
- 2D (match3/bloques): canvas a baja resolución con `image-rendering: pixelated`, sprites pixel-art dibujados por código, con "volumen" (bisel claro arriba-izquierda, sombra abajo-derecha) para que combine con lo 3D.
- Fuente: `var(--font)` (Pixelify). Íconos: `icon('coin')`, `icon('gem')`, `icon('star')`, `icon('heart')`, `icon('crown')`, `icon('xp')` + cualquier emoji pixelado (`icon('🌸')`) o nombres en `icons.js`.
- Clases CSS listas: `.btn` (+ `.pink .lilac .mint .sky .gold .ghost .small .block`), `.icon-btn`, `.panel`, `.card` (+ `.locked .selected`), `.row .col .grid .grid.tight`, `.chip`, `.badge`, `.progress` (+ `.xp .pink .gold`), `.tabs .tab .tab.active`, `.swatches .swatch`, `.scroll`, `.game-bar` (+ `.game-stat` con `<small>` y `<b>`, `.game-title`, `.spacer`), `.game-bg`, `.game-bg.pattern`, `.game-help`.
- Feedback "jugoso": sonido (`audio.sfx`), partículas, `ui.floatText`, `ui.flyCurrency`, rebotes, confeti en logros.

## Personajes, temas y contorno
- **Personajes** (`data.js` → `AVATAR_TYPES`): Princesa, Príncipe, Chica, Chico, Hada, Mago y animalitos (Gatito, Zorrito, Conejito, Osito). La primera partida (`onboarding.js`, si `state.onboarded` es false) elige tipo (al azar al empezar), colores, nombre y ciudad; después se cambia en el Vestidor (pestaña Personaje) o en Ajustes → "Cambiar personaje". Cada pieza de `CUSTOM_CATALOG` puede tener `types` y se filtra con `fitsType(item, type)` en tienda, cofres, Pase y subida de nivel. Textos neutros: nada de "princesa" salvo el nombre del tipo.
- **Temas de ciudad** (`city/themes.js`): Dulce Pastel, Ciudad Moderna, Bosque Mágico, Playa Tropical, Invierno Nevado, Luces de Noche (`dark: true`, aro claro bajo el personaje). No hay modelos por tema: los colores de vóxel se re-mapean (`mapColor`) y cambian terreno, cielo, luces y naturaleza. Se guarda en `state.city.theme`, se elige gratis con `openThemePicker(ctx)` (botón paleta en la ciudad, Ajustes y onboarding), emite `city:theme` y se ve en las visitas.
- **Escala entera**: cada pixel de render ocupa exactamente N×N pixeles físicos (N entero); el canvas lleva tamaño CSS = buffer×N/dpr (no 100%), así el navegador nunca escala por 2,001 ni 1,999 y no salen columnas dobles. Resolución interna acotada a 480 pixeles en el lado corto (`maxRes`). El contorno rellena grietas de 1 pixel en vez de entintarlas. Pisos con variación en manchas de 2×2 y contraste bajo (el moteado de a un vóxel se ve como ruido).
- **Pixel art fino**: `pixelSize` por defecto ≈1.5 px CSS en celular y ≈2 en PC; `createPixelRenderer({ outline: true })` agrega un contorno tinta de 1 pixel de render en los saltos de profundidad (`?outline=0|1` lo fuerza para comparar). Íconos de `icons.js` dibujados en capas sobre grilla de 24, escalados por bloques enteros (sin interpolación).

## Sonidos disponibles
`audio.sfx(name)`: tap, open, close, coin, gem, build, place, done, levelup, error, match, combo(n), pop, clear, swoosh, star, win, lose, horn, crash, bump, select, buy.
`audio.music(name)`: city, game, drive, calm, null. (El router pone la música de la escena según `music`.)

## Estado (store.state) — ver `defaultState()` en state.js
- `coins, gems, player{name,cityName,level,xp}`
- `onboarded`, `avatar{type, skin(index), hair, hairColor(id), dress, dressColor(id), crown, acc}` (`state.princess` = alias no enumerable), `avatarLooks{[type]: look}`, `city.theme`; `car{body, color(id de OUTFIT_COLORS), wheels, topper}`; `owned{hair:[],dress:[],...}`
- `city{buildings:[{uid,id,x,z,rot,level,buildEnd,upgradeEnd,lastCollect}], nextUid, expansions, flagColor, camera}`
- `games.match3{level, stars{}}`, `games.blocks{best}`, `games.parking{level, stars{}}`, `games.driving{best}`
- `stats{}` (usar `store.inc(key,n)` / `store.setMax`): `match3Wins`, `blocksLines`, `parkingWins`, `drivingMeters` alimentan logros.
- `tutorial{}` flags libres. `settings{music,sfx,lowQuality}`.
- Mutar estado solo vía store/economy cuando exista función; si se toca a mano, llamar `store.markDirty()`.

## Eventos (bus)
`currency:changed, coins:earned, gems:earned, xp:changed, level:up{level,reward}, building:placed{b}, building:built{b}, building:upgradeStarted{b}, building:upgraded{b,level}, building:moved{b}, building:removed{b}, production:collected{b,amount,currency}, city:expanded, builders:changed, minigame:finished{game,score,stars,won}, customize:changed, item:bought, quests:changed, scene:changed{id}, stats:changed, hud:build{focus?}, city:flag{color,hex}` (`hud:build` lo emite el botón Construir del HUD; la ciudad abre el menú; `focus` = id de edificio a resaltar).

## API de modelos (contratos entre agentes)

### src/city/models.js (agente Modelos)
```js
export const VOXELS_PER_TILE = 8;
export function buildingModel(id, level = 1, opts = {}) // -> THREE.Group
```
- Origen: **centro del footprint, base en y=0**. Ocupa `size[0]` tiles en X y `size[1]` en Z (rot 0). El frente (puerta) mira a **+Z**. La ciudad rota el grupo `rot * 90°` alrededor de Y.
- `group.userData.height` = altura en unidades de mundo (para ubicar burbujas arriba).
- `group.userData.update?.(dt, t)` animaciones opcionales (agua de la fuente, rueda girando, banderas, humo de chimenea, patitos). La ciudad llama esto cada frame.
- Mayor `level` = más detalle visible (piso extra, adornos dorados, banderas, flores). Castillo: 5 niveles muy distintos.
- Caminos (`cat:'camino'`): baldosa plana de 1 vóxel de alto que cubre el tile entero.
- Cachear geometrías por `id+level` (clonar el grupo / reusar geometry).
```js
export function constructionModel(w, d)    // andamio + cinta + cajas para obra/mejora, origen centro, base y=0
export function natureModel(kind, seed)     // 'tree' | 'pine' | 'bush' | 'rock' | 'flowers' | 'mushroom' — decoración fuera del terreno
export function cloudModel(seed)            // nube vóxel (sin sombra)
export function thumbnail(id, level = 1)    // -> Promise<dataURL> ícono 96x96 del edificio (render offscreen, cacheado). Usado por el menú de construcción.
```

### src/avatar/princess.js (agente Avatar)
```js
export function princessModel(look, opts = {}) // -> THREE.Group, altura total ≈ 1 unidad, mira a +Z, base en y=0
// group.userData.update(dt, moving:boolean)   — caminar (piernas/brazos/rebote) o idle (respira, parpadea)
export function randomLook(seed)              // look aleatorio válido (para vecinas NPC)
```
### src/avatar/car.js (agente Avatar)
```js
export function carModel(car, opts = {})  // -> THREE.Group, largo ≈ 1 unidad en Z, frente a +Z, base y=0
// group.userData.size = {w, l, h}; group.userData.update(dt, speed, steer) — gira ruedas y las dobla
export function carStats(car)           // {speed, handling} 1..5 desde CAR_BODIES
```
Usar colores de `data.js` (`OUTFIT_COLORS`, `HAIR_COLORS`, `SKIN_TONES`).

## Economía (resumen)
- Casas dan **población**; negocios requieren población mínima (`popReq`) y producen monedas por ciclo con tope (`cap` ciclos) → hay que volver a cobrar.
- Deco da **felicidad** → bonus de producción hasta +50%. Castillo mejora → +8% global por nivel.
- Constructoras limitadas (2, se compran más con gemas). Obras con tiempo; se aceleran con gemas (≤5s gratis).
- Minijuegos dan monedas (escaladas por nivel), xp y a veces gemas. Misiones principales guían, diarias dan hábito, logros a largo plazo, premio diario de login con racha.

## Pruebas
```
node tools/smoke.mjs --scene <id> [--device iphone|desktop|ipad] [--cheat 15] [--wait ms] [--steps pasos.json] [--shot ruta.png] [--eval js]
```
Captura en Chrome headless, imprime errores de consola y sale con código 1 si hubo. **Guardar capturas en tu carpeta del scratchpad, no en el proyecto.** Mirá las capturas (Read del png) para juzgar cómo se ve. `window.__pixelia` expone `{ctx, store, bus, economy, quests, data}` para pasos `eval`.
URL params: `?scene=id`, `?cheat=nivel` (+100k monedas, +1000 gemas), `?reset`, `?nosplash`.

Suites de punta a punta (todas con `--out carpeta` para las capturas; salen con 1 si algo falla):
```
node tools/test-e2e.mjs      jugadora nueva sin cheat en iPhone: splash → onboarding con toques reales (Osito, color de ropa, nombre y ciudad tipeados, estilo Bosque Mágico; verifica el guardado) → premio diario → m1–m8 → nivel + cofre → minijuego con potenciador → Pase/Álbum/Cofres/Eventos; revisa los globitos del HUD; al final recarga y confirma que no repite el onboarding
node tools/test-visit.mjs    ana y bea (mock): amistad por código, regalito, visita (like, notita, ayudar obra) → buzón → la obra se acelera; pedido "Acelerá mi obra"
node tools/test-social.mjs   UI social completa (intercambios con escrow, ranking, Obra en Equipo, cuenta, conflicto)
node tools/test-mock.mjs     API de net.js con dos pestañas     ·     node tools/test-sql.mjs   schema.sql en PGlite
node tools/test-stress.mjs   recorre escenas + paneles N veces (--rounds 3) y mide fugas (WebGL, listeners, bus, intervalos)
node tools/gen-sw-core.mjs   regenera CORE de sw.js con todos los .js reales (--bump sube VERSION, --check solo verifica)
```
