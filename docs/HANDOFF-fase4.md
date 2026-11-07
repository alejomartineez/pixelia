# Fase 4 — Épocas y arte por nivel (handoff)

Ramas: `claude/silly-shtern-b6b733` (tandas 1 y 2, ya en master) y `claude/fase4b-arte-ca33f1` (3×3, ciclo, Molino y
Carreta). Contratos: DESIGN-CORE.md §4 y §10.

## Hecho en la segunda sesión (`claude/fase4b-arte-ca33f1`)
- **Negocios de 3×3** en `src/city/models-shops3.js` (nuevo; `models-shops.js` los suma a `SHOP_BUILDERS`), con
  `eraArt: true`: Cine (marquesina con lamparitas, cartel rojo con estrella, carrito de pochoclos; en Madera y Piedra,
  fachada alta), Baños Termales (cúpula sobre tambor, pileta con burbujas; en Madera la cúpula es de paja), Rueda (aro de
  colores + rayos y patas del material de la época; R 7→10 con el nivel; en Hierro rueda de 12 rayos, en Vidrio y acero
  cápsulas) y Teatro (telón rojo, pórtico con frontón en 1–3 o marquesina recta con luces en 4–5, cúpula de la época).
  Ayudantes ahí: `hall`, `winRow`, `vertical`, `dome`, `blinking`.
- **Edificios del ciclo** (`src/city/models-cycle.js`, reescrito) con `eraArt: true` y silueta propia: Casa de
  Expediciones = atalaya con banderín verde (sube en 3 y 5); Taller = techo de una caída, portón ancho, chimenea de la
  fragua y alero con banco en el 2; Dispensario = casa encalada con cartel alto de cruz verde e invernadero en el 2;
  Conservera = galpón en diente de sierra, chimenea de fábrica y tanques; Establo = granero rojo con hastial al frente y
  portón en cruz; Tambo = silo de la época (+ silo chico en el 3); Molino = torre con aspas de lona (1–3), rueda de chapa
  (Hierro) o aerogenerador (Vidrio y acero), galería y "dos piedras" en el 4; Huerta = canteros + galpón + agua de la
  época (barril, aljibe, bomba, tanque, invernadero), parral en el 3. Ayudantes: `body` (regla de niveles), `shed`
  (techo de una caída), `tower`, `corral`.
- **Molino 4–5 pide la época Ladrillo**: `CYCLE.molino.up[4|5].era = 3` (data.js); `upgradeInfo` devuelve `reqEra` y
  `canUpgrade` responde `{ ok: false, reason: 'Época Ladrillo', locked: true, era: 3 }` (economy.js). La ficha dice
  "Necesitás la época Ladrillo" (`city-ui.js`, una línea).
- **Carreta grande**: `EQUIP_RECIPES.carreta` suma `cargo: 4, bigEra: 4, bigCargo: 6`; `expedition.js` exporta
  `carretaCargo(state)` y `equipText(id)`; `cargoMax` y la ficha del Establo usan la carga de la época. Los paneles del
  Taller y de la Expedición muestran `X.equipText(id)` (una línea en cada uno: `panels-workshop.js`, `panels-expedition.js`).


## Hecho
- **Capa de época** (`src/city/models-kit.js`, al final): `ERA_STYLE`, `eraStyle`, `eraWallColor`, `eraWall`, `eraSlab`,
  `eraRoof` (paja, dos_aguas, alto, cuatro_aguas, plano, mansarda, diente, terraza), `eraOpening` (puerta, ventana,
  vidriera), `eraVertical`, `eraCrown`, `eraGround`, `eraFence`, `eraRecolor`. Paletas en `ERA_PALETTES`
  (`src/core/palette.js`).
- **models.js**: `buildTemplate(id, nivel, {flag, era}, tema)`; con `def.eraArt` llama al builder con `{era, flag}` y no
  calma colores; si no, builder + `upgradeDressing` (casas/negocios) + `eraRecolor`. Caché `id|nivel|época|bandera|tema`.
  `modelEra(id, nivel, era)`: la Municipalidad sigue al rango; deco, caminos, monumentos y Mi Casa valen 1.
  `thumbnail(id, nivel, era, tema)` (acepta también el orden viejo `(id, nivel, tema)`).
- **Tanda 1**: Municipalidad nueva en `src/city/models-town.js` (nuevo): 1 salón de troncos, 2 galería + campanario,
  3 piedra + torre del reloj, 4 soportales + fuentes, 5 ladrillo con balcón y cúpula de tejas, 6 cúpula de hierro y
  vidrio, 7 torre de hierro y banderas, 8 torre de vidrio con terrazas. `look` de `TOWN_RANKS` actualizados.
- **Tanda 2**: las 5 casas (`eraHouse` en `models-houses.js`, reescrito) y los 7 negocios de 2×2 (`shopBody`/`sidewalk`
  con época vía `withEra` en `models-shops.js`). `eraArt: true` en todos ellos.
- **Datos/economía**: `ERAS`, `ERA_BY_ID`, `eraOfRank`, `eraDef` y `req.planos` (3/6/10/15) en `data.js`;
  `cityEra`, `buildingEra`, `hasEra`, `renovateInfo`, `canRenovate`, `startRenovate`, `outdatedBuildings`, `rankPlanos`
  en `economy.js`. `b.era = cityEra()` al construir. La obra de rango gasta los planos al empezar. Al terminar:
  `town:rankup {rank, def, era, eraChanged}` y, si cambió, `era:changed {era, from}`. Renovar usa la obra de mejora
  (`b.renovating` + `upgradeEnd`) y emite `building:renovated {b, era, from}`.
- **UI** (toques mínimos fuera de mis archivos, ver abajo): ficha con "Renovar a …", "Renovando a …", texto de mejora
  estructural; festejo de época en el panel de rango (aviso con la época nueva, edificios para renovar, fanfarria y confeti).
- **Temas**: regla `orange` en Luces de Noche (el ladrillo se iba a fucsia); cremas con algo de croma.

## Archivos fuera de mi lista que toqué (chico, para que funcione)
- `src/scenes/city.js`: pasa `era: b.era` al modelo y reconstruye si cambia la época (4 líneas).
- `src/scenes/city-visit.js`: `era: b.era` (1 línea).
- `src/scenes/city-ui.js`: miniaturas con época, caja "Renovar", "Renovando a", textos de mejora.
- `src/scenes/panels-rank.js`: festejo de época.
- `src/city/themes.js`: regla `orange` del tema noche.
- `DESIGN.md`: eventos y API de modelos.

## Archivos .js nuevos (para el precache al hacer `npm run bump`)
- `src/city/models-town.js`
- `src/city/models-shops3.js` (segunda sesión)
- Herramientas: `tools/era-city.mjs`, `tools/era-shots.mjs` (no van al precache).

## Falta
- **Defensas** (`models-defense.js`, Fase 3): siguen con el respaldo (`eraRecolor`). Para arte propio: dibujar con
  `eraWall/eraRoof/eraOpening/...` usando `o.era` y marcar `eraArt: true` en `data.js` (ver `body` en `models-cycle.js`).
- `exp-data.js` sigue diciendo "+4 de carga" en `EQUIPMENT.carreta.text`; los paneles ya usan `equipText`.
- Captura de `smoke.mjs --device iphone` de la ciudad con edificios del ciclo (la de `era-city.mjs` no los pone: tienen
  `max`); revisé las grillas de `era-shots.mjs` (nivel y época se distinguen) pero no la prueba de aceptación en iPhone.
- **Tanda 3**: deco, caminos, exterior de Mi Casa, base de los monumentos; después borrar `upgradeDressing`.
- Aviso "N edificios para renovar" fuera del festejo (por ejemplo en el chip de rango del HUD; es de la Fase 5).
- `req.planos` solo cuenta si la partida tiene `state.planos` numérico (lo agrega la Fase 2); sin eso el expediente no
  lo pide, para no trabar el rango 3.
- Materiales de renovar (`piedra`, `madera`, `mineral`) son los ids nuevos de la Fase 2.

## Pruebas
- Segunda sesión: ciudad llena con épocas mezcladas (`era-city.mjs --rank 8 --era mix --level mix`) 565 mil triángulos
  (564 mil antes); 8/5/5 = 578 mil. Promedio por modelo (5 épocas × 5 niveles) antes → ahora: Casa de Expediciones
  5,8 → 6,8 mil, Huerta 2,6 → 2,8, Taller 2,9 → 3,2, Establo 5,6 → 6,3, Dispensario 3,0 → 3,2, Tambo 5,9 → 6,3,
  Molino 2,7 → 2,9, Conservera 5,9 → 6,0, Cine 7,9 → 7,2, Baños 6,2 → 6,8, Rueda 8,0 → 6,9, Teatro 7,9 → 7,3.
  `npm test` (segunda sesión): las 12 suites en verde (e2e 85, stress 15, visitas 20, mock 69, social 46, rango 31,
  obras 36, Mi Casa 43, expedición 30, ciclo 61, telemetría 67, SQL 153). La e2e falló una vez por carga al colocar el
  Taller y pasó sola. `test-rank.mjs` ahora espera 5 líneas en el expediente del rango 3: desde la Fase 2 la partida
  tiene `state.planos` y se suma la de los 3 planos (fallaba igual en master).
  `node tools/era-shots.mjs shots/eras --ids casa_exp,huerta,taller,establo,dispensario,tambo,molino,conservera,cine,spa,rueda,teatro`.
- `node tools/era-shots.mjs <carpeta>`: grillas épocas × niveles por edificio + la Municipalidad.
- `node tools/era-city.mjs --nohud --shot x.png [--rank 8] [--era mix|n] [--level mix|n] [--theme noche]`: ciudad
  llena (89 edificios + caminos y deco), triángulos por modelo y fps headless.
  Medido: 564 mil triángulos con épocas mezcladas contra 554 mil de `master` con la misma ciudad (+2 %); el modelo más
  pesado es la Municipalidad de Capital (13,4 mil; antes la de nivel 8 tenía 16 mil).
- Ciudad llena por época (rango, época, nivel): 2/1/1 = 425 mil, 5/3/3 = 517 mil, 8/5/5 = 581 mil triángulos.
- `npm test` completo en verde (11 suites: e2e 73, stress, visitas, mock, social, rango, obras, Mi Casa, expedición,
  telemetría y SQL 153; 0 fallas, 0 errores de página).
