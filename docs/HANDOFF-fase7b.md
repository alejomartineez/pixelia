# Handoff · Fase 7b: lo social en el ciclo nuevo

Rama `claude/nice-goldberg-365eea`, desde master v22. Última fase del plan. Detalle de diseño y API en
[DESIGN-ONLINE.md](../DESIGN-ONLINE.md), sección "Fase 7b: lo social en el ciclo nuevo".

## Para el coordinador
- **`supabase/schema.sql` cambió: correrlo entero** en el SQL Editor del proyecto **Pixelia**. Es idempotente
  (en `test-sql` se carga dos veces). Agrega lo siguiente:
  - tablas `daily_runs` y `crews`, con sus índices, RLS (lectura: dueño y contactos / quien ayuda y quien recibe) y
    `revoke`/`grant` (solo `select` para `authenticated`; nadie inserta directo);
  - RPC `submit_daily`, `daily_board`, `send_crew` y `my_crews`, dentro del bloque de `grant execute`;
  - mensajes de intercambio que pasan de "figuritas" a "hallazgos", y de "amigos" a "contactos" (`pair_lock`,
    `request_friend`, `remove_friend`). `net.js` sigue traduciendo los textos viejos, así que un servidor sin
    actualizar no rompe nada.
- Sin archivos `.js` nuevos (no cambia la lista del precache, pero igual hace falta `npm run bump`, porque cambian
  archivos del juego). No toqué `sw.js` ni `VERSION`.
- Archivos tocados: `src/online/{net,net-mock,social,social-ui,social-week,social-style,social-common,sync}.js`,
  `src/expedition/{expedition,exp-scene,exp-ui}.js`, `src/scenes/panels-expedition.js`,
  `src/threats/{threats,threat-ui}.js`, `src/main.js` (una línea: `social:crews` → `runArrival`), `supabase/schema.sql`,
  `tools/test-{sql,mock,social}.mjs`, `DESIGN-ONLINE.md`.

## Hecho
1. **Expedición del día**: es una salida corta aparte, de zona 2, con la semilla `hashSeed(díaUTC, región)`, igual para
   todo el mundo. La región rota entre Bosque, Sierras y Bañado y vale aunque la región no esté abierta. No gasta
   provisiones, ni la salida corta, ni intentos de zona, y se hace una vez por día (UTC). Al volver calcula el botín en
   puntos (`dailyScore`), da 3 gemas por participar (también sin conexión) y lo manda al ranking del día. Sin sesión,
   el botín queda pendiente y se manda después (el servidor acepta hoy o ayer). Se juega desde un botón dorado en el
   panel de expedición y desde la tarjeta que está arriba del Ranking, con el podio del día entre contactos.
2. **Cuadrillas**: mientras hay una amenaza avisada y sin resolver, el perfil publica `stats.threat`. En Contactos, la
   tarjeta del contacto muestra "Sequía · en 7 días" y el botón "Mandar una cuadrilla". Límites:
   - una por contacto y amenaza;
   - 3 por día para quien ayuda;
   - 3 por amenaza para quien recibe.

   Quien ayuda gana 80 monedas × escala, 30 puntos de Obra en Equipo, chispas del Pase y 3 puntos de amistad. Quien
   recibe tiene +5% de preparación por cuadrilla en la resolución automática y una cuadrilla más en la defensa jugada
   (hasta +2). Lo ve en el panel de la amenaza, en "Mientras no estabas…" y en el resultado ("Con la ayuda de Ana").
   Si la cuadrilla llega cuando la amenaza ya se resolvió sola, arregla un edificio que esa amenaza dañó.
3. **Intercambio de hallazgos**: las reglas son las mismas (1×1, ±1★, 5★ con 14 días o en la Semana Dorada, 5 por día)
   y el payload sigue siendo `stickers`. Los mensajes del servidor y del mock ahora dicen "hallazgos" y son idénticos
   entre los dos (`test-mock` y `test-sql` los comparan).
4. **Ranking semanal**: tiene las categorías Estrellas, Salidas, Botín (suma de las Expediciones del día), Defensa (mejor
   % salvado de la semana) y Encanto. Sale "Nivel", que no es del ciclo. `stats.week = {id, stars, exps, botin, def,
   charm, rank}`. "Mejor marca personal" cuenta en las cuatro primeras. Las categorías se acomodan en dos filas en el
   iPhone.

## Pruebas
- `test-sql` 183/0, con dos secciones nuevas: Expedición del día (límites, hoy/ayer, ranking, RLS) y Cuadrillas
  (amenaza publicada o vencida, una por amenaza, topes 3/3, amistad, RLS, sin insertar directo).
- `test-mock` 91/0, con las mismas reglas en espejo y las fechas relativas a `dayOffset`.
- `test-social` 64/0. Casos nuevos:
  - ana y bea hacen la Expedición del día con la **misma semilla**, sin gastar provisiones, con premio y ranking de dos;
  - las categorías nuevas del ranking;
  - bea sube a Caserío y adelanta el reloj de amenazas hasta el aviso, publica su amenaza y ana le manda una cuadrilla
    desde la UI (premio, puntos de equipo, la segunda da error);
  - bea recibe la cuadrilla: +preparación, aviso en "Mientras no estabas…" y "con la ayuda de Ana" al resolverse sola.

  Ninguna prueba depende del día de la semana.
- `npm test` completo en verde, sin reintentos: e2e 91/0, migración 48/0, colocación 65/0, stress 15/0, visitas 20/0,
  mock 91/0, social 64/0, rango 32/0, obras 33/0, Mi Casa 43/0, expedición 30/0, ciclo 61/0, amenazas 71/0,
  telemetría 67/0 y SQL 183/0. `npm run check` no encuentra imports rotos.
- Capturas de iPhone (390×844 @2x) en `shots/social7b/` (la carpeta `shots/` no se versiona): `iphone-amigas-cuadrilla.png`,
  `iphone-amigas-cuadrilla-enviada.png`, `iphone-ranking-diaria.png`, `iphone-ranking-encanto.png` y el resto de las pestañas.

## Falta / ideas
- El intercambio de hallazgos no tiene reglas por región: el editor sigue mostrando todos los repetidos. Se podría
  agrupar por región como la pantalla de Hallazgos.
- Los perfiles de los contactos se cachean 2 minutos, así que una amenaza recién avisada puede tardar eso en aparecer
  en la tarjeta del contacto.
- La resolución automática al abrir la app puede correr antes de que lleguen las cuadrillas de esa sesión. En ese caso
  la cuadrilla no suma preparación: arregla un edificio dañado.
- `test-live` (Supabase real) no se corrió: necesita el schema nuevo aplicado.
