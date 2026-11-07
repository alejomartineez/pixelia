# Fase 2 — Expedición ↔ ciudad: traspaso

Rama `claude/zealous-lewin-268e83` (sin push). Contrato: DESIGN-CORE.md §2.3, §2.4, §2.9, §2.11, §5, §6.1.

## Hecho
- **Recursos** (`state.js`): `prov` (arranca 30, tope `economy.provCap` = 40 + 20 × Casa + 40 × Granero), `planos`, `equipment`,
  `reserves` (tope 10), `colonos` (suman población), `expedition`; `materials` suma madera/piedra/mineral/hierbas.
  `canAfford/spend/grant` entienden `prov`, `planos`, `equip`, `reserves`, `colonos` y emiten `resources:changed`.
  `costHtml` y `rewardModal` los dibujan (🍞 📜 👪 y los del equipo). `data.js`: `REGION_MATERIALS`, `RESOURCES`, `CYCLE`
  (qué da cada nivel), `EQUIP_RECIPES`, `RESERVES`, `EXPANSION_ZONES`; `MATERIAL_BY_ID` incluye los de región.
- **Edificios del ciclo** (`cat: 'ciclo'`, pestaña "Expedición" en Construir): `casa_exp`, `huerta`, `taller`, `establo`,
  `dispensario`, `tambo`, `molino`, `conservera`. Mejoras sin gemas; desde el nivel 3 piden materiales de región; la Casa
  pide 2 y 4 planos en el 4 y el 5. Productores de provisiones: `producerStatus` con `currency: 'prov'`, sin
  multiplicadores, sin siesta; `collect` las manda al depósito (lo que no entra queda; si está lleno, `production:full`).
- **Modelos** `src/city/models-cycle.js` (registrado en `models.js`): regla de niveles del §4.2 con el kit, época Madera.
- **`src/expedition/expedition.js`**: `initExpedition`, `expeditionStatus`, `startExpedition`, `finishExpedition`,
  `zonesExplored`, `roleLevel`, `cycleEffects`, `cycleUpgradeLines`, `roleChance`, `craftStatus/craft`, `expeditionBadge`.
  Primera salida corta del Bosque con semilla fija (`TUTORIAL_SEED = 110`: aserradero, madera cerca). Primera Huerta con 2
  tandas listas (t3). `EXP.roleStep` 3 → 5.
- **Escena** `exp-scene.js`: con Casa de Expediciones usa `startExpedition` y acredita en `persist()` apenas termina
  (`finishExpedition`, idempotente); sin Casa (o `&proto=1`) queda la práctica de la Fase 1 (eventos con `prototype: true`).
  Resultado con zona explorada y "faltan N zonas para ampliar"; confeti solo con la región completa.
- **Paneles**: `panels-expedition.js` (depósito, retomar, mapa de regiones con candado por rango y nodos de zona con ★,
  grupo con % por rol, equipo, Salir · zona N / Salida corta) y `panels-workshop.js` (equipo y reservas). Registrados en
  `panels.js` (`expedition`, `workshop`). Ficha del edificio (`city-ui.js`): caja "En la expedición", qué cambia al
  mejorar (p. ej. "Ingeniería 2: cruzar un río · 75% → 80%") y botón Expedición/Taller (`def.panel`).
- **HUD**: botón Expedición primero en el riel, con las provisiones en el cartelito (`data-hud="prov"`, ahí vuelan los
  🍞 al cobrar) y globito = salida corta gratis + grupo listo.
- **Misiones** (`quests.js`): la cadena se sigue por id (`quests.done`); `migrateQuestChain` pasa partidas viejas sin repetir
  lo cobrado (m1→t1, m2→t9, m7→t8, m13→t12, m14→t14, m16+ igual) y saltea sin premio lo que ya cumplen. Tipos nuevos:
  `expedition {kind, region, equip, minStars}`, `zone {region}`, `expStars`, `expFar`, `prov`, `craft {id}`. Diarias con
  `needs` (edificio). t15–t17 quedan para la Fase 3 (se pueden insertar sin romper nada).
- `economy.expansionStatus` pide zonas exploradas (1/3/5/8/11/14/18), sin requisito de nivel.
- `main.js`: `initExpedition` en `initProgression` y `ctx.expedition`.

## Qué da cada edificio (nivel 1 → 5; en la ficha se ve el próximo)
| Edificio | Rango | Costo | En la expedición |
|---|---|---|---|
| Casa de Expediciones | 1 | 200 | grupo 2/2/3/3/4 (con quien lidera) · 18/21/24/27/30 provisiones por salida · Exploración = nivel (lobos 75→95%) · depósito 60→140 · mirador radio 4 desde el 3 · niveles 4 y 5 piden 2 y 4 planos |
| Huerta (hasta 6) | 1 | 120 | 2/3/4/5/6 provisiones cada 45 min, guarda 6 tandas · la mejor entrena Recolección (+1 + ⌊nivel/2⌋ por recurso) |
| Taller | 1 | 300 + 3 madera | Ingeniería = nivel (cruzar un río 75→95%) · equipo por salida 1/1/2/2/3 · fabrica equipo y, desde Caserío, reservas |
| Establo | 1 (nivel 2 de jugador) | 600 + 4 madera | Guía = nivel (seguir con tormenta 75→95%) · carga 9/12/15/18/21 · Carreta desde el nivel 2 |
| Dispensario | 2 | 900 + 3 hierbas | Sanidad = nivel (ánimo 10, mejor descanso; Atender desde el 3) · descanso tras un fracaso 100/80/60/40/20 min (120 sin él) |
| Tambo (hasta 3) | 2 | 900 | 5/7/9/11/13 cada 60 min, guarda 4 |
| Molino (hasta 3) | 3 | 2400 + 4 piedra | 8/11/14/17/20 cada 90 min, guarda 3 |
| Conservera (hasta 2) | 5 | 9000 + 6 mineral | 15/19/23/27/31 cada 120 min, guarda 2 |
Mejoras: monedas como las casas (×1,7, ×3,4…), sin gemas; desde el nivel 3 suman materiales de región (`CYCLE[id].up`).

## Tutorial (DESIGN-CORE.md §6.1)
t1 Casa → t2 Huerta → t3 cobrar 4 provisiones (la primera Huerta arranca con 2 tandas) → t4 Casa de Expediciones (aparece
el botón Expedición) → t5 salida corta al Bosque (mapa fijo, semilla 110; premio 3 madera) → t6 Taller (3 madera; premio 3
madera) → t7 Cuerda → t8 15 de población → t9 Panadería → t10 salida normal con Cuerda → t11 zona 1 del Bosque → t12 ampliar
(1 zona) → t13 Establo → t14 Caserío → [t15–t17 de la Fase 3] → t18 salida de 3★ → t19 una zona de las Sierras → t20
Pueblo → largas de siempre (m16–m28). Diarias nuevas: 2 salidas, 20 provisiones, 4 estrellas, 2 cosas en el Taller, una
casilla lejana (las de minijuego solo salen si está su edificio).

## Falta / para otras fases
- **Fase 3**: insertar t15–t17 en `MAIN_QUESTS` entre t14 y t18 (la cadena va por id); el Granero ya suma al depósito
  (`economy.provCap` busca `granero`); las reservas ya se fabrican en el Taller (`state.reserves`, tope 10).
- **Fase 4**: Molino niveles 4–5 piden la época Ladrillo y la Carreta da +6 desde Hierro (no está: falta `cityEra`);
  `models-cycle.js` está en época Madera con funciones del kit, listo para la capa de época (`eraArt` sin marcar).
- **Fase 5**: bonus de monumentos atados al ciclo (§5.4: Faro +1 visión, Museo +50% hallazgos, Estadio chispas) no están;
  la aplicación escalonada de §6.2 (Diarias al terminar t9) tampoco; reconversión de joyeria/garaje/pista/torre (§5.3).
- `test-e2e.mjs` ya no construye la Joyería en el tutorial: la pone por API antes de probar los potenciadores.

## Archivos .js nuevos (precache con `npm run bump`)
`src/expedition/expedition.js`, `src/city/models-cycle.js`, `src/scenes/panels-expedition.js`, `src/scenes/panels-workshop.js`.

## Estado de las pruebas
- `npm test` completo en verde (12 suites): e2e 85/0 con el tutorial nuevo t1–t10, stress 3 vueltas, visitas, mock, social,
  rango, obras, Mi Casa, expedición 30/30, **test-cycle 61/0** (nuevo), telemetría y SQL.
- `tools/test-cycle.mjs`: Casa → botón Expedición con globito → panel → salida corta del tutorial (semilla 110) → madera y
  objetivo → el botín llega a `state.materials` → Taller con esa madera → panel "Ingeniería 1 · 75%" → Taller nivel 2 →
  "80%" (y la ficha anticipa 80% → 85%) → Cuerda en el Taller → salida normal con Cuerda → zona 1 explorada → sobrante al
  depósito → ampliar terreno → salida a medias, recarga y Retomar → eventos sin `prototype`. Juega con ganchos de prueba
  de la escena (`__exp.move/choose/home`), los mismos caminos que el toque.
- Simulador con `roleStep` 5: ver DESIGN-CORE.md §8 (bloque "Fase 2").

## Problemas conocidos
- Abrir `?scene=expedition` a mano con Casa de Expediciones arma una salida real (gasta provisiones); para practicar,
  `&proto=1`.
- El globito del botón Expedición casi siempre está (grupo listo = hay 12 provisiones): es lo que pide la consigna; si la
  Fase 5 lo quiere más callado, mostrar solo la salida corta gratis.
- Los cuatro edificios con casa (Casa de Expediciones, Taller, Dispensario, Conservera) se parecen de lejos: los distinguen
  el cartel, el mástil, el portón y la chimenea; el Establo tiene tablas rojizas. La Fase 4 los rehace por época.
