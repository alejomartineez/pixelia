# Fase 3 — Amenazas: traspaso

Rama `claude/fase3-amenazas-ef10e9` (sin push). Contrato: DESIGN-CORE.md §3, §5.2, §6.1 y §10 (actualizado en esta rama:
entrada continua por el borde, rayos anunciados, premio proporcional, campos nuevos de `state.threats`).

## Hecho
- **`src/threats/`** (nuevo):
  - `threat-data.js`: todos los números (días, orden, aperturas, eficacias, turnos, focos, entrada, premios, reparación).
  - `threat-calendar.js` (puro): `schedule(s, rank)`, `nextThreat`, `threatsBetween`, `phase` (`lejos|aviso|señales|hoy|pasada`),
    `makeSim`, `whenText` ("en 4 días", "mañana", "hoy, hasta las 23:59"). Lee `EPOCH`/`SEASON_DAYS` de `season-data.js`.
  - `threat-rules.js` (puro): `candidates/atRisk`, `efficacy`, `prepInfo`, `autoResolve`, `pickDamaged`, `coverageTiles`,
    `newDefense`, `placeCrew`, `useReserve`, `endTurn`, `defenseResult`, `botTurn` (sim y "terminar sola"), `finishWithBot`.
  - `threats.js` (integración): `initThreats`, `threatStatus`, `currentThreat`, `resolvePending` (al cargar, cada 15 s y en
    `town:rankup`), simulacro al llegar a Caserío, `startDefense/crew/reserve/endTurn`, `repair/repairAll/repairAllInfo`,
    arreglo de la vecindad a las 72 h, premios (gemas, monedas, materiales, plano, cofre, título "Sin un rasguño"),
    chispas del Pase (`addSeasonPoints`, import dinámico), `reportStatus/ackReport`, `coverageTiles/wouldCover`, `cityView`.
    Para pruebas: `_debugShift(ms)` / `_debugReset()` corren solo el reloj de las amenazas.
  - `threat-scene.js`: capa sobre la ciudad (`attach`), cartel + señales + marcas de daño (`createDecor`), radio al colocar
    (`createCoverage`). Música `threat` durante la defensa.
  - `threat-ui.js`: estilos, cartel, panel (preparación, en riesgo con toque que resalta, reservas, "Enfrentar",
    "Construir …", "Ir al Taller"), resultado, "Mientras no estabas" y cajas de la ficha (dañado → Reparar / Reparar todo;
    defensa → contra qué, radio, eficacia y lo del próximo nivel).
- **Defensas** (`data.js`, `cat: 'defensa'`, pestaña "Defensas" en Construir): Dique 3×1, Granero, Cuartel de Bomberos,
  Pararrayos (1 plano solo el primero: `firstPlanos`), Refugio, Hospital; tabla `DEFENSES` (tipo, radio por nivel, mejoras con
  materiales desde el nivel 3). Modelos en `src/city/models-defense.js` (kit, época Madera; la capa de época los re-pinta).
- **Economía** (`economy.js`): dañado → `producerStatus` pausado (`damaged: true`), `canUpgrade`/`canRenovate` lo frenan
  ("Primero hay que repararlo"); al reparar se corre `lastCollect` lo que estuvo parado. Mejoras de defensas como las del ciclo.
  `placeCost` suma `planos` (y `firstPlanos`); `canBuild` avisa "Falta 1 plano".
- **Estado** (`state.js`): `threats: {}` (lo completa `initThreats`); en cada edificio `b.damaged` y `b.damagedBy`.
- **Misiones**: t15 Dique (premio 4 piedra para las bolsas), t16 2 bolsas de arena, t17 pasar el simulacro (tipo de objetivo
  nuevo `threat`, absoluto: `stats.threats`). Quien ya pasó t14 las recibe como misión actual.
- **Ciudad**: arroyo en el borde +X del terreno (crece y baja con las señales, pasarela bajo el cartel de expansión) y monte
  en el −Z (`city-world.js`, se mueven al ampliar). Señales en las últimas 48 h: tinte del cielo, lluvia, humo detrás del
  monte, escarcha, polvo, relámpagos. Edificios dañados con ícono y humito.
- **Bus**: `threat:announced {id, type, day, at, f}`, `threat:started {id}`, `threat:resolved {id, type, pct, mode, damaged,
  reward}`, `building:damaged {b, threat}`, `building:repaired {b, paid}` (`paid: null, auto: true` si fue la vecindad).
  La telemetría ya registra `threat:*` sola.

## Ganchos en archivos de otras fases (para reconciliar al unir)
- **`src/scenes/city.js`** (otra sesión rediseña la colocación y el movimiento): el radio de la defensa son **3 líneas** en
  la colocación actual — `beginPlacing`: `if (E.def(p.id).cat === 'defensa') placing.cov = createCoverage(TA);`,
  `updateGhost`: `p.cov?.update(p.id, p.x, p.z, p.rot, p.level);`, `endPlacement` (y `unmount`): `p.cov?.dispose();`.
  Al rehacer la colocación alcanza con llamar `createCoverage(TA)` al empezar, `.update(id, x, z, rot, nivel)` cada vez que
  se mueve el fantasma y `.dispose()` al terminar. El resto: import, `startDefense/endDefense/highlightBuilding`, `TA` (API
  para la capa), `decor.sync()` en `syncStatus`, `decor/defense.update(dt)` en `frame`, en `onTap` la primera línea manda
  el toque a la defensa, `params.defense` y los eventos `threat:defend {id}` / `threat:panel`.
- `src/scenes/city-ui.js`: import, ícono de la pestaña `defensa`, `b.damaged` en la firma de la ficha, la caja de
  amenazas (1 línea) y la de Producción no se dibuja si está dañado.
- `src/scenes/city-world.js`: arroyo y monte (`onStream/onMonte/monteTiles/buildStream/setStream`).
- `src/main.js`: import + `ctx.threats`, `initThreats` en `initProgression`, "Mientras no estabas" en la llegada (después de
  la bienvenida, antes del premio diario) y `.th-bar` en `OVERLAYS` (la llegada espera a que termine la defensa).
- `src/core/quests.js`: `case 'threat'` en `absoluteValue` (1 línea).

## Archivos .js nuevos (precache con `npm run bump`)
`src/threats/threat-data.js`, `src/threats/threat-calendar.js`, `src/threats/threat-rules.js`, `src/threats/threats.js`,
`src/threats/threat-scene.js`, `src/threats/threat-ui.js`, `src/city/models-defense.js`.
Herramientas (no van al precache): `tools/test-threats.mjs` (en `npm test`), `tools/sim-threats.mjs` (`npm run sim:threats`).

## Pruebas
- `node tools/test-threats.mjs` (68 chequeos): calendario y reglas en Node; en Chrome (iPhone): simulacro al llegar a
  Caserío con su aviso y cartel, t15–t17 en su lugar, panel, radio al colocar el Dique (con "cubierto" sobre las casas) y que
  se borre al cancelar, preparación que sube con Dique y bolsas, defensa jugada con un toque real (cuadrilla), turnos hasta
  el resultado, eventos, t17; resolución automática con recarga y "Mientras no estabas" una sola vez; dañado no produce ni
  mejora, marca en la ciudad, ficha con Reparar; arreglo a las 72 h; defensa a medias que se termina sola al pasar el día.
- `node tools/sim-threats.mjs` (✔ en las 6 metas): ver el bloque "Fase 3" del §3.4 de DESIGN-CORE.md.
- `npm test` completo: ver el resumen al final de este archivo.

## Falta / para otras fases
- **Arte por época** de las defensas (Fase 4): hoy usan el respaldo `eraRecolor`. Marcar `eraArt: true` al dibujarlas.
- **HUD** (Fase 5): el aviso vive en un cartel de la ciudad (columna derecha, arriba de los botones); si el HUD nuevo quiere
  "Crecida del arroyo · en 4 días" en su capa *Hoy*, usar `threats.threatStatus()` y `chipText` de `threat-ui.js`.
- Diaria "Repará un edificio" (solo si hay alguno dañado): `DAILY_POOL` usa `needs` por edificio; hace falta un `needs`
  nuevo en `quests.js` (Fase 5).
- Ayudar a un contacto con su amenaza (Fase 7b): el calendario ya es el mismo para todo el mundo.
- La tarjeta "Llevate Pixelia a tu inicio" (Fase 7a, `install-card.js`) se dibuja encima de la barra de la defensa y de la
  de colocación en iPhone: convendría que espere a `.th-bar`/`.cx-placebar` como la llegada.
- Incendio con la ciudad en Piedra: casi no hay blancos (todo lo nuevo es de piedra y los árboles no cuentan como "en
  riesgo", solo propagan). Es lo que pide el diseño ("la piedra aguanta el fuego"), pero el premio queda chico.
