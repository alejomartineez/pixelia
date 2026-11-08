# Handoff · Fase 5b — economía, HUD en 3 capas y apertura escalonada

Rama `claude/priceless-vaughan-7d1d14`, desde master v21. Segunda mitad de la Fase 5 de DESIGN-CORE.md (§5.4, §6.2, §8,
§10). Las decisiones donde el código precisa el diseño están en DESIGN-CORE.md, bloques "Resultado de la Fase 5b" (§5.4,
§6.1 diarias, §6.2) y en §8 para la economía.

## Hecho
- **HUD en 3 capas** (`src/core/hud.js`, `styles.css`):
  - *Hoy*: Expedición (con provisiones) y Cofres en el riel; debajo de la misión, chips de la amenaza que viene
    (`threats.threatStatus()` + `chipText`, toca → `threat:panel`), Diarias `N/3` (toca → Misiones en la pestaña
    Diarias) y "N edificios para renovar" (toca → ficha del próximo, de a uno). El cartel de la amenaza que estaba en la
    columna de la ciudad (`threat-scene.js`) se sacó: vive en el HUD.
  - *Temporada*: un solo botón **Temporada** (Pase; punto con el emoji del evento en curso). Los eventos se abren desde
    una barra nueva arriba del Pase (`season-ui.js`, `.ssn-evbar`, `data-act="events"`).
  - *Largo plazo*: chip de rango con la **época** (`eraDef(cityEra())`) y "!" para subir; Obras; Hallazgos.
  - Arriba, el perfil abre Ajustes (se sacó el botón de engranaje repetido; queda un engranaje chico dentro del perfil).
    Abajo, 3 botones: Vestidor · **Construir** (siempre al centro, grilla de 3 columnas) · Contactos. Misiones no tiene
    botón: la tarjeta de la misión y el chip de Diarias abren el panel (el globito de misiones va en la tarjeta).
  - Metas: **14 controles** con todo abierto (`hud.controls()`) y **≤ 4 globitos** a la vez por prioridad
    (`BADGE_ORDER`: misiones, expedición, rango, Pase, cofres, obras, hallazgos, contactos; `hud.badgeState()`).
  - Apaisado: la capa Hoy va en fila debajo del riel.
- **Apertura escalonada** (`src/core/unlocks.js`, nuevo): ver DESIGN-CORE.md §6.2. `state.unlocks.open`.
- **Modal único "Mientras no estabas…"** (`src/scenes/arrival.js`, nuevo; `main.js arrivalSteps`): bienvenida, aviso v3,
  amenazas resueltas (`threat-ui.reportParts`), premio del día con la racha y "Hoy se abre / Mañana se abre".
- **Monumentos** (§5.4): Faro +1 de visión en la expedición (`run.mods.vision`), Observatorio anuncia las amenazas 2 días
  antes (`threatWarn`; ya existía `WARN_DAYS_OBSERVATORY`). Se sacó el XP del Observatorio y el +10% de negocios del Faro.
- **Diaria "Repará un edificio"** (`d_repair`, `needs: 'damaged'`, objetivo `repair`).
- **Amenazas** (`threats.js`): al subir de rango se agregan días de amenaza; uno que ya pasó ya no se resuelve solo con daño
  y sin aviso (`rankLog` / `rankAt`: solo se cobra lo que te tocaba cuando se avisó).
- **Tarjeta de instalar** (`install-card.js`): espera a que no haya `.th-bar` ni `.cx-placebar`; si se empieza a colocar
  algo o arranca una defensa con la tarjeta a la vista, se esconde sin contarla como vista y vuelve a esperar.
- **Limpieza**: `models-special.js` queda solo con la Boutique (se borraron Joyería, Torre de Bloques, Garaje, Pista y
  `miniCar`, que no usaba nadie); `tools/make-og.mjs` usa los edificios del ciclo en su lugar.
- **Economía** (tarea 1): ver la sección de abajo.

## Economía
Sim nueva: `node tools/sim-economy.mjs` (o `npm run sim:economy` desde `tools/`), con el código real en Node (estado,
economía, misiones y diarias, Pase, eventos, cofres, Hallazgos, expediciones con el bot "medio" de `tools/exp-bots.mjs`,
amenazas con el bot del motor). Opciones `--days`, `--sessions 4`, `--seed`, `--runs N`, `--quiet`, `--goals`, `--trace`.
Imprime la tabla y el reporte de metas de §8 con ✔/✘. **18 ✔ · 1 ✘** a 60 días (19 ✔ · 1 ✘ a 90).

| Meta (§8) | Antes | Después |
|---|---|---|
| Monedas: saldo 1×–3× del próximo gasto grande en ≥ 80% de los ratos | ✘ 0% (casi siempre sin nada que comprar o ×100) | ✘ 41% (otras semillas 45–59%) |
| Pase nivel 30 entre días 22–25 (2 ratos) | ✘ día 3 | ✔ día 25 (semillas: 22–23) |
| Pase con 4 ratos no antes del día 16 | ✘ día 2 | ✔ día 18 |
| Rango 2 el día 1 | ✔ 1 | ✔ 1 |
| Rango 3 días 4–6 | ✘ 2 | ✔ 4 (semillas 4, 4, 8) |
| Rango 5 días 18–25 | ✘ 10 | ✔ 19 (semillas 19–22) |
| Rango 8 días 70–90 | ✘ 63 | ✔ 77 (semillas 69–81) |
| Último requisito = nivel ≤ 25% | ✘ 71% | ✔ 17% |
| Espera solo por nivel < 10% | ✘ 69% | ✔ 1% |
| Rango 1–2: 2 normales + corta | — (no había días en rango 1–2) | ✔ 3,5 |
| Rango 5+: 3 normales | ✔ 3,1 | ✔ 3,2 |
| Depósito al tope < 30% | ✘ 65% | ✔ 0–14% |
| Amenazas: preparación ≥ 70% | ✔ 79%* | ✔ 73–78% |
| Amenazas: automática 75–95% | ✔ 77%* | ✔ 75–77% |
| Amenazas: ≤ 2 dañados | ✔ 1,1* | ✔ 0,4–1,0 |
| Multiplicadores sumados con tope ×2,5 / ×2 | ✘ (producto sin tope) | ✔ (máximo visto ×2,05; temporales ×2) |
| Cofres ≤ 1,5 por día | ✘ 6,6 | ✔ 1,4 (semillas 1,3–1,5) |
| Gemas 15–25 por día | ✘ 62 | ✔ 20,9 (semillas 20–22) |
| Primer monumento días 10–14 | ✘ 4 | ✔ 11 (semillas 10–13) |
| Planos lo último para cambiar de época ≤ 30% | ✘ 50% de las corridas | ✔ 0 de 16 cambios |

\* Con la sim mejorada (acomoda las defensas); con la de antes daba 50–60%.

Resultado: **18 ✔ · 1 ✘** en 60 días (19 ✔ · 1 ✘ en 90). Fechas reales de la semilla 1: rango 2 d1 · 3 d4 · 4 d11 · 5 d19
· 6 d29 · 7 d51 · 8 d77; monumentos Faro d11 · Jardín d19 · Observatorio d28 · Estadio d38 · Museo d51 · Torre d77.

**Lo que no se cumple: monedas 1×–3× (41–59% según la semilla).** El reparto es bimodal: los días 1–10 casi siempre
quedan < 1× (mucho barato para comprar, se ahorra para la obra de rango y el Faro) y las etapas de monumento que esperan
materiales juntan monedas (> 3×). Subir o bajar las monedas de las etapas, la producción o las obras de mejora pasa el
problema de un lado al otro y rompe otras metas. Se acepta: las monedas no frenan el rango (lo frenan monumentos, Encanto y
población). Próxima vuelta: medir el "próximo gasto" al llegar al rato, o sumar un sumidero de monedas sin materiales a
mitad del juego.

### Números que cambiaron

### `src/core/economy.js`
- **Multiplicadores**: antes `(1 + felicidad) × (1 + 8% × rango) × pociones × eventos × maestría × (1 + Faro 10% en negocios)`.
  Ahora `productionMult(id)` = `min(2,5, 1 + felicidad + rango + maestría + monumentos)` × `min(2, pociones × eventos)`
  (`PROD_MULT_CAP`, `BOOST_MULT_CAP`). La Municipalidad no se suma felicidad ni rango (igual que antes). `globalMultiplier()`
  sigue existiendo (ciudad, sin maestría). Se sacó `monumentBonus('shopCoins')`; el término de monumentos lee
  `prodCoins` (hoy 0, como pediste).
- **Duración de las mejoras** (casas, negocios, ciclo y defensas; no Municipalidad, monumentos ni Mi Casa): antes
  `max(15 s, tiempo × (nivel + 1))` (la mayoría < 1 min). Ahora `UPGRADE_TIME = { base: 300, max: 6 h, mult: 20, pow: 1.3 }`:
  `clamp(5 min, 6 h, tiempo × 20 × (nivel+1)^1,3)`. Panadería 8 → 27 min, Cine 1 h 40 → 5 h 25, Teatro 4 h → 6 h. Por qué:
  sin eso las constructoras nunca pesan, todo se gasta en un rato y el saldo queda siempre < 1× (38%, 71 ratos bajos).
  Ojo juego: saltar una mejora larga con gemas cuesta más (1 gema por minuto); martillo y reloj de arena valen más.
- **Colonos**: cuentan para la población hasta el 25% de lo que alojan las casas (`COLONOS_PER_HOUSING`, `housingPop()`,
  `colonosHoused()`). Por qué: llegaban a ~4,5 por día (137 al día 30), la población crecía sola y la felicidad caía hasta
  trabar el rango 5 (DESIGN-CORE §9 ya lo dejaba abierto: "tope por vivienda libre"). Siguen sumando cuadrillas.

### `src/core/data.js`
- **Producción de monedas** (`prod: { coins, cycle }`): antes → después. Municipalidad 15/60 s → 10/300 s · Casa 4/45 →
  4/270 · Cabaña 7/60 → 5/300 · Chalet 12/75 → 8/300 · Torre de Cristal 22/90 → 7/270 · Casona 45/120 → 8/240 ·
  Panadería 20/60 → 15/300 · Heladería 35/90 → 16/270 · Florería 50/120 → 15/240 · Café 70/150 → 20/300 ·
  Peluquería 95/180 → 26/360 · Pastelería 120/200 → 24/300 · Tienda de Ropa 160/240 → 26/300 · Cine 260/300 → 20/300 ·
  Baños 380/360 → 28/360 · Teatro 800/600 → 55/600. (~1/6 del ritmo de antes; los grandes más recortados porque en el
  medio del juego no había en qué gastar.)
- **Rueda de la Fortuna**: `max: 1` (antes sin tope) y 1 gema cada 6 h guardando 1 (antes cada 30 min guardando 4).
- **Monumentos** (solo `stages`, no toqué `bonus`): monedas × / materiales × respecto de la 5a: Faro ×2 / ×2,3 ·
  Jardín ×4 / ×2,7 · Observatorio ×3,5 / ×2,5 · Estadio ×3 / ×2,5 · Museo ×3 / ×3,5 · Torre ×3 / ×4,5 (redondeado a 500
  monedas). Por qué: con los de antes el Faro salía el día 4 y la Torre el 43; los materiales se juntan mientras el
  monumento siguiente todavía no se abrió.
- **Expediente** (`TOWN_RANKS`): pop/feliz/Encanto/negocios y nivel. Rango 3: pop 45 → 120, Encanto 140 → 650, negocios
  3 → 4 · Rango 4: 90 → 200, 300 → 900, 5 → 6 · Rango 5: 150 → 340, 520 → 1350, 7 → 8, nivel 20 → 18 · Rango 6: 220 →
  460, felicidad 55 → 52, 800 → 1750, nivel 26 → 23 · Rango 7: 300 → 580, 1150 → 2400, nivel 31 → 28 · Rango 8: 400 →
  700, 1600 → 2800, nivel 36 → 33. Planos y monumentos sin cambios. Premios de gemas a la mitad (5/10/15/25/35/50/80 →
  3/5/8/12/18/25/40). Por qué: Encanto y población se cumplían días antes; esperaba el nivel en 5 de 7 subidas. Los
  valores siguen la ciudad de la sim dentro del terreno de cada rango (lo de antes de rango 6 quedó atado al lugar).
- `levelUpReward` gemas `3 + nivel/3` → `1 + nivel/8` (monedas igual).
- `MAIN_QUESTS` gemas: t14 8 → 5, t19 8 → 5, t20 10 → 6, m16–m28 a un cuarto (p. ej. m28 80 → 20); sin cofre m18 y m22.
- `DAILY_BONUS_ALL` `{ gems: 3, xp: 50, chest: 'plata' }` → `{ gems: 1, xp: 50, stickers: 1 }` (un cofre por día era casi
  todo el tope).
- `LOGIN_REWARDS` gemas 3/5/10 → 2/3/6.
- `ACHIEVEMENTS` premios × 0,25 (mín. 1) desde los de antes; los retirados ("Recuerdos") sin cambios.

### `src/season/season-data.js` y `season.js`
- `TIER_COST` 60, 90, 120… → 60, 120, 180 y después **440** (total 12.240).
- `POINTS` (propuesta de §8): diaria 60 → 40, bonus 100 → 60, principal 80 → 50, cobrar 2 → 1 (tope 60 → 30), construir
  10 → 5, mejorar 25 → 15, **renovar 15** y **reparar 5** nuevos (en `season.js`: `building:renovated` y
  `building:repaired` con `paid`). Salida 20 + 5/★, zona 30 y amenaza `40 + 0,6 × %` (threats.js) sin cambios.
  `POINT_SOURCES` suma renovar, reparar y amenaza.
- `BONUS_EVERY` 150 → 600.
- `TIERS`: **planos +1 en 10, 20 y 30** (parte nueva `kind: 'planos'` en `season.js`; se ve en `season-ui-common.js`,
  2 líneas). Sin cofre en 5 (→ 250 monedas + 4 madera), 12 (→ 2 hallazgos + 4 hierbas), 25 (→ 900 monedas + 6 mineral) y
  29 (→ 4 hallazgos 3★ + 8 piedra). Gemas: 4: 5 → 3, 10: 10 → 6, 21: 10 → 6, 27: 15 → 10.
- Carrera de Estrellas, escalón 2: 8 gemas + cofre de madera → 5 gemas + 2 hallazgos.

### Cofres, Hallazgos, expedición
- `chests.js`: cofre gratis cada **72 h** (antes 24 h); "Puñado de gemas" 3–6 → 1–2, "Bolsa de gemas" 10–16 → 3–5.
  `chests-ui.js`: el texto dice "con el cofre gratis, que sale cada 3 días".
- `album.js`: gemas de un set `estrellas × 0,5` → `× 0,15`; cofre de plata en los primeros 6 sets y después sin cofre
  (antes oro). El álbum completo da lo mismo que antes.
- `exp-data.js`: `chestAt3` 0,25 → 0,10 (cofre de las salidas de 3★). Es el único número de expedición que toqué.
- `threat-data.js`: sin cambios (los premios de amenaza ya daban bien).

### Herramientas
- `tools/sim-economy.mjs` reescrita; `tools/exp-bots.mjs` (los bots, sacados de `sim-expedition.mjs`, que ahora los
  importa; mismo resultado); `tools/package.json` → `"sim:economy"`.
- `test-migration.mjs`: la etapa 3 del Faro ya no pide 12 + 10; ahora comprueba que pide piedra + mineral y que lo
  juntado (9 + 7) sigue ahí.
- `test-works.mjs`: el grant de prueba alcanza para el Faro nuevo (140 piedra, 120 mineral, 60.000 monedas) y "la etapa 1
  gastó…" lee el costo de `E.def('faro')`. No toqué la sección "Bonus y expediente".

## Archivos .js (para el precache con `npm run bump`)
- Nuevos: `src/core/unlocks.js`, `src/scenes/arrival.js` (`node tools/gen-sw-core.mjs --check` los marca como faltantes en
  CORE: los suma el bump).
- Borrados: ninguno.

## Pruebas
- `npm test` en verde, suite por suite: e2e 91/0, migración 48/0, colocación 65/0, stress 15/0, visitas 20/0, mock 69/0,
  social 46/0, rango 32/0, obras 33/0, Mi Casa 43/0, expedición 30/0, ciclo 61/0, amenazas 71/0, telemetría 67/0, SQL 153/0.
  `test-telemetry` ahora trae el interruptor de métricas a la vista antes de tocarlo (quedaba fuera de pantalla y el toque
  fallaba siempre en esta rama). `test-e2e` falló una vez al colocar el Taller con la máquina cargada (ya pasaba en la Fase 4)
  y pasó sola al reintentar.
- `node tools/sim-economy.mjs`: 18 ✔ · 1 ✘ (monedas).
- Suites actualizadas: `test-e2e` (modal de llegada, "Mañana se abre: el Pase", día 1 sin Pase/Contactos/Hallazgos/Cofres/
  Obras, ≤ 14 controles, Cofres al ganar el primero, "Hoy se abre: el Pase" al volver otro día, eventos desde el Pase,
  globitos contra `hud.badgeState()` con ≤ 4 a la vista), `test-migration` (el aviso v3 va dentro del modal de llegada),
  `test-threats` (aviso de la amenaza en el HUD; diaria de reparar), `test-visit` (cuenta del globito de Contactos aunque
  no entre entre los 4), `test-works` (Faro = +1 de visión).
- Capturas: `node smoke.mjs --scene city --device iphone --cheat 12 --steps steps-hud-5b.json --shot ../shots/5b-hud-iphone.png`
  (también `iphone-se` y `landscape`): ciudad en Pueblo con simulacro avisado, diarias, 5 para renovar, 14 controles y 3
  globitos.

## Falta / para otras fases
- **Monedas 1×–3×** (única meta de §8 en rojo, ver Economía).
- **Planos** sobran (~3 por día, 280 guardados al día 90): si tienen que pesar, bajarlos en `exp-data.js` o darles otro uso.
- Margen de gemas ~4 por día: si se suman gemas a `DAILY_POOL`, volver a correr la sim.
- La columna de botones de la ciudad (`.cx-side`: ir a la Municipalidad, girar, estilo) no cuenta como HUD; si se quiere
  bajar más, el botón de estilo podría pasar a Ajustes.
- 7b: ayudar a un contacto con su amenaza, intercambio de hallazgos por región.
