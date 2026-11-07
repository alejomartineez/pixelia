# Fase 4 — Épocas y arte por nivel (handoff)

Rama `claude/silly-shtern-b6b733`. Contratos: DESIGN-CORE.md §4 y §10.

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
- Herramientas: `tools/era-city.mjs`, `tools/era-shots.mjs` (no van al precache).

## Falta
- **Tanda 2, resto**: Cine, Baños Termales, Rueda y Teatro (3×3) siguen con el respaldo.
- **Tanda 1, ciclo**: los edificios de la Fase 2 (`models-cycle.js`) y las defensas de la Fase 3 (`models-defense.js`) se
  re-pintan con el respaldo (`eraRecolor`). Para arte propio: dibujar con `eraWall/eraRoof/eraOpening/...` usando
  `o.era` y marcar `eraArt: true` en `data.js`.
- **Tanda 3**: deco, caminos, exterior de Mi Casa, base de los monumentos; después borrar `upgradeDressing`.
- Aviso "N edificios para renovar" fuera del festejo (por ejemplo en el chip de rango del HUD; es de la Fase 5).
- `req.planos` solo cuenta si la partida tiene `state.planos` numérico (lo agrega la Fase 2); sin eso el expediente no
  lo pide, para no trabar el rango 3.
- Materiales de renovar (`piedra`, `madera`, `mineral`) son los ids nuevos de la Fase 2.

## Pruebas
- `node tools/era-shots.mjs <carpeta>`: grillas épocas × niveles por edificio + la Municipalidad.
- `node tools/era-city.mjs --nohud --shot x.png [--rank 8] [--era mix|n] [--level mix|n] [--theme noche]`: ciudad
  llena (89 edificios + caminos y deco), triángulos por modelo y fps headless.
  Medido: 564 mil triángulos con épocas mezcladas contra 554 mil de `master` con la misma ciudad (+2 %); el modelo más
  pesado es la Municipalidad de Capital (13,4 mil; antes la de nivel 8 tenía 16 mil).
- `npm test` completo: ver el resumen de la sesión.
