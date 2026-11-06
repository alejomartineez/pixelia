# Pixelia — progresión a largo plazo y social (contratos)

Basado en la investigación de docs/RESEARCH-retention.md (Hay Day, Township, Clash, Royal Match, Monopoly GO, Pokémon GO, Animal Crossing, Stardew).
Principios "cozy": nada de energía ni muros, nunca castigar ausencias (la racha se pausa, no se pierde; volver da regalo), competir solo por puntaje y con premio para todas, generosidad > competencia, cada sesión de 2 minutos avanza algo, máximo 2 eventos a la vez, nada de presión de tiempo agresiva.

## Módulos y dueños

| Módulo | Archivos | Qué hace |
|---|---|---|
| Cofres | src/chests/chests.js, chests-ui.js, chest-model.js | cofres, rarezas, mochila, potenciadores, construcciones gratis (hecho) |
| Álbum | src/album/*.js | figuritas, sets, brillitos, intercambio de repetidas |
| Temporada | src/season/*.js | Pase de Temporada (28 días, 30 niveles gratis), eventos rotativos, bienvenida de vuelta |
| Social UI | src/online/social-*.js | cuenta, amigas, buzón, pedidos de ayuda, intercambios, ranking, Obra en Equipo |
| Online datos | src/online/net*.js, sync.js, supabase/schema.sql | ver DESIGN-ONLINE.md |
| Integración | src/core/*, src/main.js, styles.css, src/scenes/city*.js, src/games/* | enganchar todo lo anterior |

Regla: cada módulo se comunica por **bus** y por las funciones exportadas abajo; los módulos nuevos no editan el núcleo, el núcleo los llama.

## Contratos

### Cofres (`src/chests/chests.js`) — ya existe
`initChests()`, `addChest(type,n,source)`, `openChest(type)`, `rollGameChest({won,stars})`, `chestBadge()`, `consumeItem(id)`, `itemCount(id)`, `useCityItem(id,{uid})`, `prodBoostMult()`, `happyBoostActive()`, `activeBoosts()`, `freeBuildCount(id)`, `consumeFreeBuild(id)`, `ITEMS`, `CHESTS`, `RARITIES`.
UI (`chests-ui.js`): `openChestsPanel(ctx, params)`, `openChestFlow(ctx, type)`, `playChestOpening(ctx, type, drops)`.
Premios con cofre: `store.grant({ chest: 'plata' })` debe emitir `reward:chest {type, n, source}` (lo hace el núcleo).

### Álbum (`src/album/album.js`)
- 12 sets × 9 figuritas (108), cada una con 1–5 estrellas (rareza). Temas: Vecinos, Ropa y Estilo, Autitos, Postres, Mascotas, Flores, Edificios, Tesoros, Música, Playa, Noche estrellada, Fiesta. Arte procedural pixel (emoji pixelado + marco por estrellas + nombre).
- `initAlbum()`; `grantStickers(n, {minStars, source}) -> [{id, stars, isNew}]`; `stickerCount(id)`; `duplicates() -> [{id, count}]`; `setProgress(setId)`; `claimSet(setId)` (premio: gemas + cofre + monedas escaladas; el álbum completo da Cofre de Diamante ×2 y título "Gran Coleccionista"); `brillitos()`; `convertDuplicates()` (repetidas → brillitos según estrellas); tienda de brillitos (sobres de figuritas, cofres); `stickerDef(id)`; `STICKER_SETS`.
- `openAlbum(ctx, params)` (UI completa del álbum con páginas por set, animación de pegar figurita nueva).
- Fuentes de figuritas: cada cofre trae figuritas (madera 2, plata 3, oro 4, real 6; estrellas según cofre) — el módulo álbum agrega esto a `openChest` (puede editar chests.js y chests-ui.js para mostrar las figuritas como cartas, con `kind: 'sticker'`); ganar minijuegos 35% 1 figurita; Pase de Temporada; regalos e intercambios de amigas.
- Emite `album:changed`, `album:setComplete {setId}`.
- Intercambio (online): solo repetidas (count ≥ 2), 1×1, estrellas ±1; 5★ solo con amistad ≥ 14 días. Escrow: al ofrecer se descuenta; payload `{stickers:{id:1}, stars:n}`.

### Temporada (`src/season/season.js`)
- Temporadas de 28 días desde la época fija 2026-11-02 (lunes). Temas rotativos (nombre, paleta de acento, emoji): Primavera en Flor, Carnaval de Pixelia, Noche Estrellada, Verano de Helado, Bosque Encantado, Noche de Estrellas...
- 30 niveles gratis; puntos de temporada ("✨ chispas") por: misión diaria cobrada 60, set del bonus diario 100, ganar minijuego 25 (+10 por estrella), cobrar edificio 2 (máx 60/día), terminar construcción 10, mejora 25, misión principal 80, ayudar/regalar a amiga 20, figurita nueva 5. Costo por nivel ≈ 120 (≈1 nivel por día de juego normal; 30 niveles en ~22 días).
- Premios por nivel definidos por datos: monedas, gemas, cofres (madera/plata/oro, Real en el 30), sobres de figuritas, potenciadores; en 10/20/30 algo especial (prenda premium gratis vía desbloqueo de catálogo, Cofre de Diamante). Después del 30: cofre de madera cada 150 chispas.
- Escucha por sí mismo el bus (`minigame:finished`, `production:collected`, `building:built`, `building:upgraded`, `quests:changed`→ detectar cobros, `album:changed`, `social:helped`) y suma chispas; persistencia en `state.season`.
- API: `initSeason()`, `seasonInfo()` → `{id, theme, endsInMs, level, points, need, rewards}`, `claimTier(n)`, `claimableTiers()`, `addSeasonPoints(n, reason)`, `openSeasonPass(ctx)` (UI tipo camino/carrusel con premios y candados).
- **Eventos rotativos** (`src/season/events.js`): calendario por semana ISO con plantillas JSON (máx 2 activos): "Finde de Doble Producción" (vie–dom, `eventMult('production')=2`), "Semana de Joyas" (premios ×1.5 en match3), "Lluvia de Cofres" (`eventMult('chestDrop')=2`), "Fiebre de Figuritas" (`eventMult('stickers')=2`), "Carrera de Estrellas" (meta personal de estrellas en minijuegos con 3 escalones de premio), "Semana Dorada" (1 por mes, habilita intercambio de 5★). API: `activeEvents()`, `eventMult(key)` (default 1), `openEventsPanel(ctx)`, `eventBannerInfo()`.
- **Bienvenida de vuelta**: si pasaron ≥ 2 días desde `lastSeen`, regalo escalado (monedas + cofre de madera + "¡Te extrañamos!"). `welcomeBackStatus()`, `claimWelcomeBack()`.
- **Racha flexible**: 1 "escudo de racha" gratis por semana: si faltás 1 día la racha se pausa en vez de reiniciarse (lo aplica `quests.loginStatus` vía `streakShieldAvailable()`/`consumeStreakShield()`).

### Social UI (`src/online/social.js`)
`openSocial(ctx, tab)` con tabs: Amigas (código propio, agregar, solicitudes, lista con nivel de amistad Conocidas/Amigas/Compinches/Íntimas/Inseparables por días, acciones Visitar · Regalito · Intercambiar), Pedidos (pedí una mano: hasta 3 por día; ver y cumplir pedidos de amigas con premio + chispas), Buzón (regalos, ayudas, entregas, likes y notitas; Cobrar todo), Ranking (semana: nivel, récords, estrellas; premio para todas, insignia de "mejor marca personal"), Obra en Equipo (barra semanal compartida con 5 escalones; meta = 1000 × integrantes activas; en modo sin conexión es una meta personal de 1000).
`openAccount(ctx)` (crear cuenta / entrar / salir / conflicto de partidas). Visitas: `ctx.router.go('city', { visit: friendId })` → la ciudad en modo visita.
Emite `social:helped`, `social:gift`, `online:inbox`.

### Integración en el núcleo
- HUD: botones Amigas (badge buzón+solicitudes+pedidos), Cofres (badge `chestBadge()`), Pase (badge niveles para cobrar), banner de evento activo y efectos activos (poción x2, felicidad) con tiempo.
- `store.grant` acepta `{chest, stickers}` y emite `reward:chest` / `reward:stickers`.
- `endGame`: aplica `eventMult`, `rollGameChest` (×`eventMult('chestDrop')`), figurita 35%, suma chispas, y muestra cofre/figurita ganados en el modal de premio.
- Minijuegos: en la pantalla previa, selector de potenciadores de la mochila (`itemCount`/`consumeItem`): match3 (`m3_moves`, `m3_bomb`), blocks (`blk_bomb` usable durante la partida), parking (`park_time`), driving (`drv_shield`).
- Economía: `globalMultiplier` × `prodBoostMult()` × `eventMult('production')` × maestría; felicidad al máximo si `happyBoostActive()`; construcciones gratis en el menú Construir (`freeBuildCount`) sin requisito de nivel; martillo en la ficha de obra.
- **Maestría por edificio**: monedas producidas acumuladas por tipo → 1–5 estrellas (umbrales 500, 2k, 8k, 25k, 80k × costo/100), +3% producción por estrella; se ve en la ficha del edificio.
- **Almacenamiento más largo**: el tope de producción de cada negocio cubre ~2–4 h (siesta), así volver después de un rato da una cosecha linda.
