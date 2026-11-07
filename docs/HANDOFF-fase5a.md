# Handoff · Fase 5a — sacar los minijuegos y guardado v3

Rama `claude/admiring-hawking-031936`. Primera mitad de la Fase 5 de DESIGN-CORE.md (§5.3, §7, §10). Las decisiones donde el
código precisa o se aparta del diseño están en DESIGN-CORE.md §7.2, bloque "Resultado de la Fase 5a".

## Hecho
- **Minijuegos fuera**: `src/games/*` (17 archivos) y `src/scenes/panels-games.js` borrados. En `main.js`: escenas
  `match3/blocks/parking/driving`, `router.openGame`, `gameStatus`, `endGame`/`finishGame` y `ctx.endGame/gameStatus`.
  `data.js`: los 4 edificios, `GAMES`, `GAME_BY_ID`, `MATERIALS` viejos, `MATERIAL_BY_GAME` y las 4 diarias. Íconos
  `game-*` y `cristal/ladrillo/tuerca/mapa` de `icons.js`. Botón **Juegos** del HUD (solo esa línea en `hud.js`; el
  rail dice "Hallazgos"). Tipos de objetivo `play/stars/score` de `quests.js`. `minigame:finished` ya no existe (lo
  reemplaza `expedition:finished` en temporada, eventos, social, sync; la telemetría dejó de mapearlo).
- **Reconversión** (§5.3): `LEGACY_BUILDINGS` en `data.js`; mismo uid, lugar, rotación, nivel y obra en curso. Si ya
  existía el edificio del ciclo, queda el de nivel más alto y el otro se devuelve en monedas. Sin Pista →
  `economy.ensureExpHouse` coloca la Casa de Expediciones cerca de la Municipalidad (o queda gratis en Construir).
- **Guardado v3** (`state.js`, `VERSION = 3`, `migrateV3` dentro de `migrate`, así también migra lo que llega por
  `importCode`/nube): materiales 1:1 (`LEGACY_MATS`) y costos de `MONUMENTS` y de Mi Casa renombrados; compensación
  (gemas en la migración, hallazgos de 2★+ al arrancar en `main.js grantV3Finds`); aviso único "Los minijuegos se
  retiraron" en la llegada (`openV3Notice`, después de la bienvenida y antes de "Mientras no estabas"); potenciadores →
  equipo (`LEGACY_BOOSTERS`; `chests.js` también convierte los que lleguen después, p. ej. un regalo viejo); `b.era` =
  época del rango; `planos = ⌊rango/2⌋` si faltaba; diarias re-sorteadas. `state.games` queda guardado y sin uso; partidas
  nuevas ya no lo tienen. Registro en `state.v3 {gems, finds, got, conv, refund, placeExp, expPlaced|expFree, shown}`.
- **Álbum → Hallazgos**: mismos ids y estado (`album.brillitos` = recortes). `SET_REGION`/`REGION_ORDER` en `album.js`;
  `grantStickers({region})` y `reward.stickers.region` (la expedición pasa `run.region`). La pantalla agrupa por región.
  Textos: Álbum/figuritas/brillitos → Hallazgos/hallazgos/recortes en la UI (album, cofres, social, ayuda, Pase).
- **Logros** de minijuegos: `retired: true` → "Recuerdo" con lo ganado (no aparecen si no se ganó ninguno; no suman).
- **Cofres recortados**: sin cofre por partida; cofre gratis 1 por día sin acumular; nivel → oro cada 5 (diamante en
  20/30/40), ya no madera por nivel; carta rara "Equipo de expedición"; Bolsa de materiales de región.
- **Pase / eventos / monumentos**: ver DESIGN-CORE.md §7.2 (equipo en `TIERS` 7/17/23, chispas por salida y por zona,
  semanas de región, Estadio y Museo atados a la expedición, Observatorio = +25% XP de expedición). La salida da XP
  (`EXP_XP` en `expedition.js`: 10 + 5 por ★, × Observatorio y confort de Mi Casa).
- **Auto**: el taller del auto del Vestidor ahora pide el **Establo** (botón "Auto" en su ficha; el auto se estaciona al lado).
- **Social** (mínimo): ranking sin categorías de minijuego (Nivel, Estrellas de expedición, Encanto); perfil
  `stats.week {id, stars, exps, charm, rank}`, sin `stats.best`; regalos del día: martillo o reloj de arena; Obra en
  Equipo suma al volver de una expedición.
- Docs: CLAUDE.md, README.md, DESIGN.md (contrato de escena, estado, economía, suites) y DESIGN-CORE.md §7.2.

## Falta (Fase 5b y otras)
- **5b**: recalibrar economía con `sim-economy.mjs` nuevo (hoy la sim solo reemplaza las partidas por una salida aproximada
  para no romper); HUD en 3 capas (la barra de abajo quedó con 4 botones y Construir no está al centro); desbloqueo
  escalonado §6.2; planos del Pase en los niveles 10/20/30; chispas por amenaza; `TIER_COST`.
- Monumentos §5.4 que no son de mis archivos: Faro +1 de visión (`exp-rules.js`/`expedition.js`), Observatorio con aviso
  de amenazas 2 días antes (`src/threats/*`; hoy da XP de expedición, cambiar `bonus.type` y textos al hacerlo).
- **Arte**: `models-special.js` (y su registro en `models.js`) todavía tiene los modelos de Joyería, Torre de Bloques,
  Garaje y Pista: ya no los usa ningún edificio, los puede borrar la sesión de arte. No toqué `models-*.js`.
- Nombres y arte de los 12 sets de Hallazgos por región (hoy conservan los nombres de figurita; Fase 6 con la Guía de tono).
- Música `drive` de `audio.js` quedó sin uso (Fase 6).
- 7b: rehacer el ranking semanal alrededor de la expedición (hoy solo estrellas) y el intercambio de hallazgos por región.
- `supabase/schema.sql` tiene un comentario con `week:{id, match3, …}` y los mensajes de error de los intercambios dicen
  "figuritas"; `src/online/net-mock.js` repite esos mensajes a propósito (test-mock los compara), así que quedaron igual.
  Cambiarlos es de la 7b (hay que correr el SQL entero).

## Archivos .js (para el precache con `npm run bump`)
- Borrados: `src/games/blocks-art.js`, `blocks-logic.js`, `blocks.js`, `boosters.js`, `driving-sky.js`, `driving-world.js`,
  `driving.js`, `match3-engine.js`, `match3-levels.js`, `match3-sprites.js`, `match3-style.js`, `match3.js`,
  `parking-levels.js`, `parking-physics.js`, `parking-style.js`, `parking-world.js`, `parking.js`; `src/scenes/panels-games.js`.
- Nuevos en `src/`: ninguno. `node tools/gen-sw-core.mjs --check` no encuentra imports rotos (solo avisa que sobran los
  borrados en CORE, que regenera el bump).
- Herramientas: `tools/test-migration.mjs` (nuevo, en `npm test` después de e2e).

## Pruebas
- `tools/test-migration.mjs`: guardado v2 armado a mano (rango Villa, nivel 14, Joyas nivel 23, Estacionamiento 11, récords,
  álbum a medias con un set cobrado, materiales viejos y de región, Faro con 2 de 4 etapas, potenciadores, Mi Casa con
  muebles y trofeo, contactos, tema, ropa y auto) → 48 comprobaciones: materiales, etapa del Faro igual de cerca, edificios,
  épocas, gemas (91) y 6 hallazgos de 2★+, Hallazgos por región, equipo, planos, diarias, Recuerdos, todo lo demás
  intacto, aviso único; segunda carga y export/import idénticos; Joyería + Taller (devolución); sin Pista (Casa
  automática); `importCode`; partida nueva sin aviso.
- Suites actualizadas: `test-e2e` (potenciador viejo → equipo, sin botón Juegos), `test-works` (materiales de región y
  «Salir» a la expedición, Faro con piedra + mineral), `test-stress` (sin escenas ni panel de juegos), `test-social`
  (eventos de expedición, perfil sin `match3`), `test-telemetry`, `test-home` (materiales nuevos), `smoke.mjs` (ayuda).
- `npm test` en verde, suite por suite: e2e 83/0, migración 48/0, colocación 65/0, stress 15/0, visitas 20/0, mock 69/0,
  social 46/0, rango 32/0, obras 34/0, Mi Casa 43/0, expedición 30/0, ciclo 61/0, amenazas 69/0, telemetría 67/0, SQL 153/0.
  `test-place` y `test-cycle` fallaron una vez con la máquina cargada y pasaron solas al reintentar.
- `test-cycle` ahora cuenta el multiplicador de eventos al comparar el botín (esta semana toca "Semana de Expediciones").
