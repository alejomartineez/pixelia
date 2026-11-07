# Fase 4 — Épocas y arte por nivel (handoff)

Ramas: `claude/silly-shtern-b6b733` (tandas 1 y 2, ya en master), `claude/fase4b-arte-ca33f1` (3×3, ciclo, Molino y
Carreta, ya en master) y `claude/trusting-lehmann-2f58b5` (defensas, tanda 3, aceptación: **la Fase 4 queda terminada**).
Contratos: DESIGN-CORE.md §4 y §10.

## Hecho en la tercera sesión (`claude/trusting-lehmann-2f58b5`)
- **Defensas** con arte por época y nivel (`src/city/models-defense.js`, reescrito; `eraArt: true` en las 6). Firma de
  lejos de cada una: Dique = muro largo del material de la época con el arroyo al frente (2 compuerta con volante, 3 camino
  de ronda, 4 casilla del cuidador, 5 escala de crecida, faroles y bandera celeste); Granero = hórreo sobre pilares con
  muelas (Madera, Piedra, Ladrillo) o silo de tolva redondo sobre patas (Hierro, Vidrio y acero), bolsas de grano, agua
  guardada en el 2, noria en el 4, bandera dorada en el 5; Cuartel de Bomberos = rojo (tablas pintadas, paños rojos o
  montantes rojos en el muro cortina), portón ancho de la época, campana en el techo hasta el 3, carro / bomba a vapor /
  autobomba en el 2, torre de mangueras con campana o sirena en el 4; Pararrayos = mástil (palo, obelisco, pilar de
  ladrillo, torre reticulada, mástil de acero con balizas), punta de cobre, chapa con el rayo en el 3, corona de puntas
  en el 4, bola de cobre y baliza en el 5; Refugio = techo a dos aguas hasta el piso con escarcha en la cumbrera (bóveda
  de chapa o de paneles en Hierro y Vidrio y acero), chimenea grande con humo y ventanas encendidas (`m.light`), leñera
  en el 2; Hospital = bloque blanco con marquesina, alas al frente en el 2 y el cartel azul con la H sobre el techo,
  ambulancia en el 3. `models-cycle.js` exporta `cycleBody` y `eraTower` para reusar la regla de niveles.
  La lógica de amenazas no se tocó.
- **Tanda 3**: deco, caminos, Mi Casa y base de monumentos por época (`eraArt: true` en todos). No se renuevan
  (`hasEra` es false): siguen a la **época de la ciudad**. `city.js` tiene `drawEra(b)` (b.era si `hasEra`, si no
  `cityEra()`; se usa al dibujar y al comparar para reconstruir, así el cambio de época los redibuja solo) y
  `city-visit.js` usa la del rango del dueño. `modelEra` en `models.js` ya no fuerza 1, salvo árbol, arbusto, cerezo y
  unicornio (`ERA_FREE`, se ven igual siempre).
  - `models-deco.js`: materiales en `DS[era]`; farol (aceite colgado, linterna sobre piedra, forjado verde, gas de dos
    brazos, columna de acero), banco (medio tronco, losa de piedra, listones con hierro verde/negro, hormigón), fuente
    (piso, borde, columna y remate de la época en vez del corazón), pedestal de la estatua, glorieta (techo de paja,
    pizarra, tejas, chapa o vidrio), macetas, arco, orilla y muelle de la laguna. Caminos: Piedra (tierra con lajas →
    lajas → adoquín parejo → granito → baldosones), Ladrillo (a soga → espina de pez → industrial → adoquín de hormigón),
    Dorado (cambian las juntas; luces al ras).
  - `models-home.js`: Mi Casa con `eraWall/eraOpening/gable` de la época; conserva puerta bordó, corazón en el hastial
    (en Vidrio y acero, en la fachada, con techo terraza), buzón, canteros y árbol; cerco de la época en el 5.
  - `models-monuments.js`: `eraBase` en `staged` (piso de la época desde Ladrillo y cerco de la época con entrada); el
    monumento conserva su diseño.
  - `upgradeDressing` borrado de `models-kit.js` y de `models.js` (nadie lo usaba).
- `EQUIPMENT.carreta.text`: "+4 de carga (+6 desde la época Hierro)".
- `tools/era-city.mjs`: `--set ciclo` (ciudad llena con ciclo y defensas, Dique en las calles y Pararrayos entre los
  árboles, ignora `max`) y `--accept id1,id2` (prueba de aceptación: una fila por época, columnas niveles 1/3/5 de cada
  id, ciudad chica; `--nohud` ahora también esconde la tarjeta de instalar).
- Fuera de mi lista, chico: `src/scenes/city.js` (`drawEra`, 4 líneas), `src/scenes/city-visit.js` (época de deco en
  visitas, 3 líneas), `DESIGN.md` y `DESIGN-CORE.md` (texto de `upgradeDressing`).

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
- Tercera sesión: ningún .js nuevo (solo cambian archivos que ya estaban en el precache).

## Falta
- Nada de la Fase 4. Quedan para otras fases: aviso "N edificios para renovar" fuera del festejo (chip de rango del HUD,
  Fase 5) y los especiales de minijuego (joyería, torre de bloques, garaje, pista, boutique real) con el respaldo
  `eraRecolor` (se retiran en la Fase 5).
- Detalle conocido: al **mover** una deco o un camino, el fantasma de `city-place.js` usa `b.era` (la época en que se
  construyó) en vez de la de la ciudad; al soltarlo se dibuja bien. No lo toqué porque la colocación no es mía
  (`era: movingB ? movingB.era : E.cityEra()` → para deco/caminos/Mi Casa/monumentos debería ser `E.cityEra()`).
- `req.planos` solo cuenta si la partida tiene `state.planos` numérico (lo agrega la Fase 2).

## Pruebas
- Tercera sesión: triángulos promedio por modelo (5 épocas × 5 niveles, en miles) antes → ahora: Dique 1,9 → 2,1,
  Granero 2,8 → 3,8, Bomberos 2,7 → 3,7, Pararrayos 0,8 → 1,0, Refugio 2,8 → 3,5, Hospital 5,5 → 6,2; Farol 0,7 → 0,5,
  Fuente 2,3 → 2,2, Glorieta 2,9 → 2,9, Camino 0,3 → 0,3, Mi Casa 3,2 → 3,3. Ciudad llena `--rank 8 --era mix --level mix`:
  560 mil (565 mil antes); con ciclo y defensas (`--set ciclo`, 119 edificios): 506 mil.
  Aceptación en iPhone (`era-city.mjs --accept bomberos,granero`, `refugio,huerta`, `hospital,dique`, `--nohud`, cámara
  por defecto): la época se reconoce por material y techo en cada fila y el 1, el 3 y el 5 se separan por altura, anexos,
  torre y remate (la H del Hospital y la compuerta del Dique se leen de lejos).
  Grillas: `node tools/era-shots.mjs shots/eras --ids dique,granero,bomberos,pararrayos,refugio,hospital,mi_casa`; deco:
  `node tools/gallery-shot.mjs "ids=farol,banco,fuente,estatua,glorieta,macetas,arco_rosas,lago,camino,camino_rosa,camino_dorado&eras=1,2,3,4,5&levels=1&cols=10" shots/deco.png 1600 1100`.
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
