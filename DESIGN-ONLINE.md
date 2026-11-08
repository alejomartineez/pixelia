# Pixelia Online — diseño

Objetivo: jugar online con amigas/amigos. Cada jugador tiene su cuenta y su partida en la nube, se agregan por **código de amiga**, se visitan las ciudades, se mandan regalos, se ayudan con obras e intercambian recursos. Todo **gratis**: el juego sigue siendo estático (GitHub Pages/Netlify) y el servidor es un proyecto **Supabase** free tier (Postgres + Auth + RLS).

Principio: **local-first**. La partida vive en `localStorage` (como hoy) y se sincroniza con la nube. Si no hay servidor configurado o no hay internet, el juego funciona igual y las funciones sociales muestran un estado amable ("Sin conexión").

## Archivos

```
src/online/config.js        SUPABASE_URL / SUPABASE_ANON_KEY (vacíos = modo local). Se completan al deployar.
src/online/net.js           fachada: elige adaptador (supabase | mock | off) y expone la API de abajo
src/online/net-supabase.js  adaptador real (vendor/supabase.min.js → createClient)
src/online/net-mock.js      adaptador simulado en localStorage compartido entre pestañas (?mock=1&mockuser=ana) para probar sin servidor
src/online/sync.js          sincronización de partida + publicación del perfil público (throttle) + inbox
src/online/social.js        lógica social + contrato con el núcleo (initSocial, openSocial, openAccount, handleConflict, socialBadge)
src/online/social-*.js      UI: ui (hoja + Amigas), mail (Pedidos + Buzón), week (Ranking + Equipo), trade (intercambio + pedido),
                            account (cuenta + elegir partida), common (avatar pixel, chips, helpers), style (CSS .soc-*)
supabase/schema.sql         tablas, RLS, funciones RPC (correr una vez en el SQL editor de Supabase)
tools/test-sql.mjs          valida schema.sql en PGlite (Postgres en Node) con auth.uid() simulado
tools/test-mock.mjs         API de net.js con dos pestañas (ana/bea) sobre el adaptador mock
tools/test-social.mjs       la UI social de punta a punta con dos jugadoras + capturas iPhone/PC (--out carpeta)
```

## Modelo de datos (Postgres)

- `profiles` (público entre amigas): `id uuid pk = auth.uid()`, `code text unique` (6 caracteres sin ambiguos: sin 0/O/1/I), `name`, `city_name`, `level`, `look jsonb` (personaje), `car jsonb`, `city jsonb` (snapshot para visitas: `{buildings:[{id,x,z,rot,level}], expansions, flagColor}`), `stats jsonb` (población, felicidad, récords, semana actual), `updated_at`, `last_seen`.
  RLS: cualquiera autenticado puede leer `id, code, name, level` (para buscar por código); el resto de columnas lo lee el dueño o sus amigas aceptadas (vía función `is_friend(a,b)`); solo el dueño escribe su fila.
- `saves`: `user_id pk`, `data jsonb`, `rev int`, `updated_at`. RLS: solo el dueño.
- `friendships`: `a uuid, b uuid (a<b), status 'pending'|'accepted', requested_by, points int default 0, created_at`. RLS: participantes. Altas/aceptar/borrar por RPC.
- `gifts`: `id bigserial, from_id, to_id, kind text, payload jsonb, created_at, claimed_at`. Tipos: `gift` (regalo diario), `help` (ayuda en obra), `trade` (entrega de intercambio), `sticker` (figurita), `like`. RLS: insertar con `from_id = auth.uid()` y solo a amigas; leer si sos from/to; marcar `claimed_at` solo el destinatario (RPC `claim_gift`, devuelve el payload una sola vez).
- `trades`: `id, from_id, to_id, offer jsonb, request jsonb, status 'pending'|'accepted'|'declined'|'cancelled', created_at, resolved_at`. RPC `respond_trade(id, accept)` y `cancel_trade(id)` con transición atómica (solo desde `pending`), y al aceptar crea las filas `gifts` de entrega para ambas partes; al cancelar/rechazar crea la devolución al que ofreció.
- `visits`: `host, visitor, day date, liked bool, helped int` — único por (host, visitor, day). RPC `visit(host)` suma puntos de amistad 1 vez por día.

Límites anti-abuso razonables (aunque sea entre amigas): regalo diario 1 por amiga por día; ayudas 3 por visita por día; intercambio máx 5 pendientes por jugador.

## Recursos y escrow
El servidor no conoce la economía (vive en el cliente). Para que un intercambio no duplique recursos:
1. Al proponer, el cliente descuenta localmente lo ofrecido (escrow) y crea `trades`.
2. Al aceptar (RPC atómica), el que acepta descuenta lo pedido; el servidor crea `gifts` kind `trade` para entregar `offer` → destinatario y `request` → proponente.
3. Rechazo/cancelación → `gifts` de devolución del `offer` al proponente.
4. Cada cliente acredita lo recibido cuando reclama su buzón (`claim_gift`, una sola vez).

## API del cliente (`src/online/net.js`) — igual para supabase y mock
```js
net.mode                 // 'supabase' | 'mock' | 'off'
await net.init()         // restaura sesión
net.user                 // null | { id, email }
net.onAuth(fn)           // cambios de sesión
signUp(email, password, name) / signIn(email, password) / signOut()
pullSave() -> {data, rev, updated_at} | null      pushSave(data, rev)
publishProfile(p)        getMyProfile()  findByCode(code)  getProfiles(ids)
listFriends() -> [{ id, name, code, level, points, status, incoming:boolean, last_seen }]
requestFriend(code)  respondFriend(otherId, accept)  removeFriend(otherId)
sendGift(toId, kind, payload)   inbox() -> unclaimed gifts to me   claimGift(id) -> payload|null
proposeTrade(toId, offer, request)  listTrades()  respondTrade(id, accept)  cancelTrade(id)
visit(hostId) -> {first:boolean}  like(hostId)  visitorsToMe(sinceIso)
```
Errores: devuelven `{ error: 'texto amable' }`, nunca tiran excepciones a la UI.

## Experiencia
- **Cuenta** (Ajustes → Cuenta, y primer arranque con servidor): "Crear cuenta" (nombre, email, contraseña) / "Ya tengo cuenta" / "Jugar sin cuenta". Al iniciar sesión en un dispositivo con partida local y nube distinta: elegir cuál conservar (mostrando nivel y fecha de cada una).
- **Amigas** (botón en el HUD con badge): tu código grande para compartir (copiar / compartir con `navigator.share`), agregar por código, solicitudes, lista con nivel, nivel de amistad y última conexión; acciones: Visitar, Regalo diario, Intercambiar.
- **Visitar**: la escena de ciudad en modo visita (solo lectura) con la ciudad y el personaje de la amistad; botón ❤️ (like diario), "Ayudar" en hasta 3 obras en curso (le resta 15 min a cada una y vos ganás monedas + puntos de amistad), cartel con su nombre, y botón "Volver a mi ciudad".
- **Buzón**: regalos, ayudas, entregas de intercambio y likes recibidos; "Cobrar todo".
- **Intercambio**: elegir qué ofrecés (monedas, gemas, objetos de mochila, figuritas) y qué pedís; la otra persona acepta o rechaza.
- **Ranking de amigas** semanal (nivel, récords de minijuegos, estrellas de la semana).

## Ampliación social (implementado en schema.sql + net.js + mock)

Todo lo de abajo está en `supabase/schema.sql`, en los dos adaptadores (`net-supabase.js`, `net-mock.js`) y probado en `tools/test-sql.mjs` (PGlite) y `tools/test-mock.mjs` (dos pestañas en Chrome headless). Los días se cuentan en **UTC** (servidor y mock).

**Pedidos de ayuda ("Pedí una mano")** — tabla `requests(id, from_id, kind 'item'|'coins'|'speedup'|'sticker', payload, qty, filled_by, filled_at, expires_at = now()+24h)`.
- `net.createRequest(kind, payload, qty)` → `{ok, id, expires_at}`; máx **3 por jugadora por día**. `payload` = lo que se le entrega al completarse (ej. `{items:{hammer:1}}`, `{coins:200}`, `{minutes:30, uid}`, `{stickers:{id:1}}`).
- `net.friendRequests()` → abiertos (no vencidos, sin completar) de amigas aceptadas: `[{id, from_id, from_name, kind, payload, qty, created_at, expires_at}]`.
- `net.myRequests()` → mis pedidos de los últimos 3 días con `filled_by_name`.
- `net.fillRequest(id)` → atómico, una sola vez, no el propio, solo amigas. Crea un gift `request_fill` para la dueña con `payload + {request:{id,kind,qty}}` y devuelve `{ok, id, from_id, kind, payload, qty}`: el cliente de quien ayuda descuenta lo entregado (`deductPayload`) y se acredita su recompensa local.

**Amistad por días** — `friendships.days` y `last_day`. Toda interacción (regalo, ayuda, figurita, visita del día, like, nota, pedido completado, intercambio aceptado) llama a `bump_friendship(a,b,pts)` (interna, no expuesta): suma puntos y **como mucho 1 día por día calendario**. `listFriends()` devuelve `days` y `friendship = friendLevel(days)`. Niveles (`FRIEND_LEVELS` en net.js): Conocidas 0 · Amigas 3 · Compinches 14 · Íntimas 45 · Inseparables 100. Puntos: visita 1, ayuda 1, nota 1, like 2, regalo 2, figurita 2, intercambio 3, pedido 3.

**Hallazgos (antes figuritas)** — en `proposeTrade`, si `offer` o `request` tiene `stickers`: ambos lados deben ser solo `{stickers:{id:1}, stars:n}` (1 hallazgo por lado, sin mezclar con monedas/objetos), estrellas 1..5 con diferencia ≤ 1, hallazgos de 5★ solo con amigas de ≥ 14 días, y máx **5 intercambios de hallazgos por día** por jugadora (propuestos + aceptados). También `sendGift(to, 'sticker', {stickers:{id:1}})` (máx 3 por amiga por día). El payload sigue siendo `stickers` (mismos ids del álbum); desde la Fase 7b los mensajes del servidor y del mock dicen "hallazgos" y "contactos".

**Obra en Equipo** — tabla `coop(user_id, week 'YYYY-Www', points)`.
- `net.addCoopPoints(n)` → `{week, mine, added, capped}`; tope **2000 puntos por día**.
- `net.coopStatus(week?)` → `{week, total, mine, members:[{id, name, points, me}]}` (yo + amigas aceptadas).

**Visitas** — `visits.note` (máx 80). `net.leaveNote(hostId, text)` 1 por día por ciudad. `net.visitorsToMe(sinceIso?)` → `[{id, name, day, visited, liked, helped, note, at}]` (por defecto últimos 7 días).

**Ranking semanal** — `net.leaderboard(week = isoWeek())` → `[{id, name, level, week, me}]` de mí y mis contactos; `week` es `stats.week` (o `null` si es de otra semana). Desde la Fase 7b `sync.js` publica `stats.week = {id, stars, exps, botin, def, charm, rank}`: estrellas y salidas de expedición, botín sumado de las Expediciones del día y la mejor defensa de la semana (% salvado). Categorías del ranking (`RANK_CATS`): Estrellas, Salidas, Botín, Defensa y Encanto.
Además `stats.week` lleva `rank` y `charm` (rango de la ciudad y Encanto actuales) y `stats` los repite (`stats.rank`, `stats.charm`): así la categoría **Ciudad más linda** (`charm`) del ranking y el rango en la lista de amistades salen de `friends_leaderboard` sin cambiar el SQL (social.js pide `net.leaderboard(null)`, sin filtrar semana, junto con `listFriends` y los combina en `f.rank` / `f.charm`). La visita calcula rango y Encanto con el snapshot de la ciudad.

**Extras de la API** (además de la lista de arriba): `net.claimAll()` (cobra todo atómico), `pushSave(data, rev, {force})` devuelve `{conflict:true}` si otro dispositivo guardó, helpers `friendLevel(days)`, `isoWeek()`, `friendlyError(e)`. El like va por la RPC `give_like` (`like` es palabra reservada en SQL). Regalos `help` llevan `{minutes, uid}` y al cobrarlos `applyGiftPayload` adelanta esa obra. El perfil público incluye `uid` y `busyUntil` de las obras en curso para que la visita sepa dónde ayudar.

**sync.js** — `initSync(ctx)`, `resolveConflict('local'|'cloud')`, `pushNow()`, `publishProfileNow(force)`, `refreshInbox()`, `claimAndApply(gift)`, `claimAllAndApply()`, `applyGiftPayload(payload, source)`, `canAffordPayload(p)`, `deductPayload(p)`, `buildPublicProfile(state)`, `getSyncStatus()`, `stateHash()`, `setStickerAdder(fn)` / `setStickerTaker(fn)` (el sistema de figuritas registra cómo sumar/restar; por defecto usa `state.stickers[id]`). Eventos: `online:status`, `online:inbox`, `online:conflict`, `online:applied`, `online:speedup`, `stickers:received`.

**Figuritas 5★ en la Semana Dorada** — el evento se calcula en el cliente (`eventFlag('trade5')`, events.js). Si está activo y la amistad tiene < 14 días, el cliente agrega `golden: true` al `offer` de un intercambio de figuritas y el servidor (y el mock) lo aceptan sin los 14 días. Es un permiso de confianza entre amigas, como el resto de la economía.

**Perfil público** — `stats.album = { v:1, c }`: un carácter base 36 por figurita (orden de `STICKERS`) con la cantidad que tiene (tope 35). `sync.albumCode(state)` / `sync.decodeAlbum(a)`. La UI lo usa para mostrar "¡Le falta!" / "La tiene repe" y para ofrecer solo repetidas reales de la amiga. Con el nombre por defecto ("Princesa") el perfil **no** manda `name` (no pisa el nombre que eligió al registrarse) y social.js adopta el nombre de la cuenta en la partida.

`setStickerTaker(fn, canFn)`: `canFn(id, n)` opcional para que `canAffordPayload` sepa si se pueden descontar figuritas (el álbum nunca deja una figurita en 0: solo se dan repetidas). `deductPayload` descuenta primero las figuritas y, si el álbum se niega, no toca nada más.

## UI social (`src/online/social.js` + `social-*.js`)

Contrato con el núcleo: `initSocial(ctx)` (después de `initSync`), `openSocial(ctx, tab)` con tabs `'amigas' | 'pedidos' | 'buzon' | 'ranking' | 'equipo'`, `openAccount(ctx)`, `handleConflict(ctx, conflict) -> Promise<'local'|'cloud'|null>` (una sola a la vez; también se abre sola con `online:conflict`), `socialBadge()` (sincrónico) + bus `social:badge {count}`.
Badge = solicitudes entrantes + buzón sin cobrar + intercambios pendientes para mí + escalones de Obra en Equipo para cobrar + premio semanal del ranking.
Emite `social:helped {kind:'request'}` (pedido cumplido → +20 chispas del pase) y `social:gift {sent:true}` (regalito). Maneja `album:trade {id, mode}` (pone `handled = true`): `offer` → editor de intercambio (elige amiga), `ask` → crear pedido con esa figurita; sin cuenta abre la pantalla de cuenta.

Estado local `state.social`: `giftDay` (regalito enviado hoy por amiga, día UTC), `coop {week, local, pending, claimed[], reached, carry[]}`, `rank {hist{semana: {match3, blocks, parking, driving, stars, played}}, claimed[]}`.

- **Amigas**: código grande (copiar / `navigator.share`), agregar por código, solicitudes entrantes/salientes, lista con avatar pixel (look del personaje), nivel, "se conectó hace 2 h", nivel de amistad con barra hasta el próximo. Acciones: Visitar (`ctx.router.go('city', {visit: id})`), Regalito (monedas `GIFT_COINS[nivel de amistad] × rewardScale`; 25% un objeto común; 25% una repetida 1–2★ propia si tiene 3 o más), Cambiar.
- **Intercambio**: figuritas 1×1 (tus repetidas ↔ repetidas de la amiga, ±1★, 5★ con 14 días o Semana Dorada) o monedas/gemas/objetos de mochila. Escrow: se descuenta recién cuando el servidor aceptó la propuesta; al aceptar se descuenta lo pedido; entregas y devoluciones llegan al buzón.
- **Pedidos**: hasta 3 por día (figurita que falta — marcando qué amigas la tienen repetida —, objeto, monedas, o acelerar una obra 30 min). Quien ayuda entrega lo pedido (la obra no cuesta nada) y gana monedas (`helperReward`), chispas y amistad.
- **Buzón**: intercambios para responder (ambos lados), regalos/ayudas/entregas/likes/pedidos cumplidos con "Cobrar" y "Cobrar todo" (vuelo de monedas + confeti), tus intercambios enviados (cancelar) y visitas de la semana con notitas.
- **Ranking**: semana ISO, categorías nivel/estrellas/juegos, podio pixel, "¡Mejor marca personal!" (supera tus semanas anteriores), premio de participación para todas (domingo; la semana anterior queda cobrable).
- **Obra en Equipo**: puntos por bus (ganar minijuego 30, obra terminada 20, mejora 40, pedido cumplido 50, regalito/ayuda 10), se suben con `addCoopPoints` cada 30 s; meta = 1000 × amigas con puntos (sin conexión: meta personal de 1000); 5 escalones cobrables una vez por semana (los no cobrados pasan a "semanas anteriores", no se pierden).
- **Cuenta**: crear cuenta / entrar / "Jugar sin cuenta"; con sesión: estado de sincronización, "Guardar ahora", cerrar sesión. Sin servidor (`net.mode === 'off'`) explica que el online llega cuando se configure y ofrece el modo simulado (`?mock=1&mockuser=…`).

## Fase 7b: lo social en el ciclo nuevo

**Expedición del día** — tabla `daily_runs (user_id, day, region, score 0..1000, stars 0..3, loot)`, PK (user_id, day).
- Cliente (`expedition.js`): `startExpedition({ daily: true })` arma una salida **corta** con zona 2 y semilla `hashSeed(díaUTC, región)` (`dailySeed`), igual para todo el mundo. La región rota entre Bosque, Sierras y Bañado (`dailyRegion`) y vale aunque no esté abierta. No gasta provisiones, ni la salida corta del día, ni intentos de zona. Una por día (UTC). Al volver: `dailyScore` (materiales 1, planos 6, hallazgos 4, colonos 3, estrellas 5), premio por participar `DAILY_PRIZE` (3 gemas, también sin conexión) y `expedition:finished {daily:{day, region, score, stars, loot}}`.
- `net.submitDaily(day, region, score, stars, loot)` (RPC `submit_daily`): una vez por día, acepta hoy o ayer. `social.js` la manda al volver; sin sesión queda en `state.social.dailyPending` y sale en el próximo refresco. `net.dailyBoard(day?)` (RPC `daily_board`) → yo + contactos de ese día, ordenado por botín.
- UI: tarjeta "Expedición del día" arriba del Ranking (podio del día y botón que abre el panel de expedición) y botón dorado en el panel de expedición.

**Cuadrillas para la amenaza de un contacto** — tabla `crews (helper, host, threat, day)`, única por (helper, host, threat).
- El perfil publica `stats.threat = {id, type, start, end, help}` mientras hay una amenaza avisada sin resolver (`threats.publicThreat`, no el simulacro); se republica enseguida al avisarse.
- `net.sendCrew(hostId, threatId)` (RPC `send_crew`): solo contactos, la amenaza tiene que ser la publicada y no haber terminado; 1 por contacto y amenaza, **3 por día** para quien ayuda, **3 por amenaza** para quien recibe; suma 3 puntos de amistad. Quien ayuda gana `CREW_PRIZE` (80 monedas × escala), 30 puntos de Obra en Equipo y chispas del Pase (`social:helped {kind:'crew'}`).
- `net.myCrews()` (RPC `my_crews`, 14 días): `social.js` las pasa a `threats.addHelp` en cada refresco. Cada cuadrilla suma **+5% de preparación** a la resolución automática (`HELP.prep`, tope 3) y una cuadrilla más en la defensa jugada (tope +2). Si llega cuando la amenaza ya se resolvió, arregla un edificio que esa amenaza dañó. El panel de la amenaza muestra "Cuadrillas de Ana +5%", y "Mientras no estabas…" cuenta quién mandó cuadrillas (`social:crews` vuelve a abrir la llegada si la ciudad está libre) y "con la ayuda de…" en el resultado.

Correr `supabase/schema.sql` entero en el SQL Editor del proyecto Pixelia (tablas, índices, RLS y funciones nuevas; mensajes de intercambio pasados a "hallazgos").

## Métricas anónimas (`public.events` + `src/online/telemetry.js`)

Para saber D1/D7 y dónde se va la gente, sin cuenta y sin datos personales.

- **Tabla** `events (id, anon_id uuid, session_id uuid, name ≤ 39 [a-z0-9_:.-], props jsonb objeto < 2 KB, version ≤ 40, created_at)`.
  RLS: `anon` y `authenticated` solo pueden **insertar**, y solo las columnas `anon_id, session_id, name, props, version`
  (`id` y `created_at` los pone el servidor). Nadie lee, cambia ni borra desde el cliente: se consulta desde el panel de Supabase.
- **anon_id**: uuid al azar del dispositivo en `localStorage['pixelia.anon.v1']`, aparte de la partida (no viaja con la nube
  ni con el código de respaldo). Nunca se mandan email, nombre, ciudad ni user_id. Errores: solo el mensaje recortado y archivo:línea.
- **Cliente**: cola en memoria + `localStorage['pixelia.events.queue.v1']` (tope 300), tandas de 50 cada 30 s, al pasar a segundo
  plano (`fetch keepalive`) y al volver la conexión. 2xx = enviado; 5xx/408/429/sin red = se reintenta; otro 4xx = se descarta.
  Un evento que sale tarde lleva `props.late` (segundos). Sin `config.js` no se junta nada; con `?mock=1` o en localhost/LAN
  las tandas quedan en `localStorage['pixelia.mock.events']` (`?telemetry=live` fuerza el envío real, para probar).
- **Interruptor**: Ajustes → "Enviar estadísticas anónimas de uso" (`state.settings.telemetry`, prendido por defecto). Apagado
  vacía la cola y no registra nada.
- **Eventos**: `session_start {days, level, standalone, touch}`, `session_end {dur, scene}` (se manda cada vez que la app pasa a
  segundo plano con la duración acumulada: tomar la mayor por `session_id`; más de 30 min afuera = sesión nueva), `scene:changed {id, visit}`,
  `onboarding:step {step}`, `onboarding:done`, `level:up {level}`, `town:rankup {rank}`, `minigame:finished {game, stars, won, score}`,
  `building:built {id}`, `panel_open {panel}`, `error {msg, where}`, `install_prompt_shown/accepted/dismissed`.
  Los del bus salen de `TRACKED_EVENTS`; `expedition:*` y `threat:*` ya se registran solos (valores simples del payload).
