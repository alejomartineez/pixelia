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

## Falta (pasos concretos)
Ver la sección "Estado" al final (se actualiza al cerrar la fase).

## Archivos .js nuevos (precache con `npm run bump`)
`src/expedition/expedition.js`, `src/city/models-cycle.js`, `src/scenes/panels-expedition.js`, `src/scenes/panels-workshop.js`.
