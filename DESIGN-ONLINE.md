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
src/online/social-*.js      UI: cuenta, amigas, visitas, regalos, intercambios, buzón, ranking
supabase/schema.sql         tablas, RLS, funciones RPC (correr una vez en el SQL editor de Supabase)
tools/test-sql.mjs          valida schema.sql en PGlite (Postgres en Node) con auth.uid() simulado
```

## Modelo de datos (Postgres)

- `profiles` (público entre amigas): `id uuid pk = auth.uid()`, `code text unique` (6 caracteres sin ambiguos: sin 0/O/1/I), `name`, `city_name`, `level`, `look jsonb` (princesa), `car jsonb`, `city jsonb` (snapshot para visitas: `{buildings:[{id,x,z,rot,level}], expansions, flagColor}`), `stats jsonb` (población, felicidad, récords, semana actual), `updated_at`, `last_seen`.
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
- **Visitar**: la escena de ciudad en modo visita (solo lectura) con la ciudad y la princesa de la amiga; botón ❤️ (like diario), "Ayudar" en hasta 3 obras en curso (le resta 15 min a cada una y vos ganás monedas + puntos de amistad), cartel con su nombre, y botón "Volver a mi ciudad".
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

**Figuritas** — en `proposeTrade`, si `offer` o `request` tiene `stickers`: ambos lados deben ser solo `{stickers:{id:1}, stars:n}` (1 figurita por lado, sin mezclar con monedas/objetos), estrellas 1..5 con diferencia ≤ 1, figuritas de 5★ solo con amigas de ≥ 14 días, y máx **5 intercambios de figuritas por día** por jugadora (propuestos + aceptados). También `sendGift(to, 'sticker', {stickers:{id:1}})` (máx 3 por amiga por día).

**Obra en Equipo** — tabla `coop(user_id, week 'YYYY-Www', points)`.
- `net.addCoopPoints(n)` → `{week, mine, added, capped}`; tope **2000 puntos por día**.
- `net.coopStatus(week?)` → `{week, total, mine, members:[{id, name, points, me}]}` (yo + amigas aceptadas).

**Visitas** — `visits.note` (máx 80). `net.leaveNote(hostId, text)` 1 por día por ciudad. `net.visitorsToMe(sinceIso?)` → `[{id, name, day, visited, liked, helped, note, at}]` (por defecto últimos 7 días).

**Ranking semanal** — `net.leaderboard(week = isoWeek())` → `[{id, name, level, week, me}]` de mí y mis amigas; `week` es `stats.week` (o `null` si es de otra semana). `sync.js` publica `stats.week = {id, match3, blocks, parking, driving, stars}` (mejor puntaje de la semana por juego + estrellas sumadas, guardado en `state.online.week` al escuchar `minigame:finished`).

**Extras de la API** (además de la lista de arriba): `net.claimAll()` (cobra todo atómico), `pushSave(data, rev, {force})` devuelve `{conflict:true}` si otro dispositivo guardó, helpers `friendLevel(days)`, `isoWeek()`, `friendlyError(e)`. El like va por la RPC `give_like` (`like` es palabra reservada en SQL). Regalos `help` llevan `{minutes, uid}` y al cobrarlos `applyGiftPayload` adelanta esa obra. El perfil público incluye `uid` y `busyUntil` de las obras en curso para que la visita sepa dónde ayudar.

**sync.js** — `initSync(ctx)`, `resolveConflict('local'|'cloud')`, `pushNow()`, `publishProfileNow(force)`, `refreshInbox()`, `claimAndApply(gift)`, `claimAllAndApply()`, `applyGiftPayload(payload, source)`, `canAffordPayload(p)`, `deductPayload(p)`, `buildPublicProfile(state)`, `getSyncStatus()`, `stateHash()`, `setStickerAdder(fn)` / `setStickerTaker(fn)` (el sistema de figuritas registra cómo sumar/restar; por defecto usa `state.stickers[id]`). Eventos: `online:status`, `online:inbox`, `online:conflict`, `online:applied`, `online:speedup`, `stickers:received`.
