# Handoff · Pulido después del rediseño

Rama `claude/youthful-mayer-3592ac`, desde master v23. Cabos sueltos de las fases 5b y 7b. Sin bump: no toqué `sw.js` ni
`VERSION`.

## Para el coordinador
- **`supabase/schema.sql` cambió: correrlo entero** en el SQL Editor del proyecto **Pixelia**. Solo cambian textos de
  error (sin el emoji 😄) en `request_friend`, `send_gift`, `visit`, `give_like`, `leave_note` y `send_crew`. Seis mensajes;
  `net-mock.js` tiene los mismos (los comparan `test-mock` y `test-sql`). Nada de tablas ni permisos.
- Sin archivos `.js` nuevos (el precache no cambia), pero igual hace falta `npm run bump` porque cambian archivos del juego.
- Archivos tocados: `src/core/economy.js`, `src/scenes/{panels-works,panels-style,arrival}.js`, `src/main.js`,
  `src/threats/{threats,threat-ui}.js`, `src/online/{social-trade,social-style,net-mock}.js`, `supabase/schema.sql`,
  `tools/{sim-economy,test-threats,test-works,test-social}.mjs`, `DESIGN-CORE.md` (§8).

## 1. Meta de monedas
**Resultado: `npm run sim:economy` da 20 ✔ · 0 ✘** (semilla 1, 60 días; también 20 ✔ a 90 días, rango 8 el día 77).
La meta se reformuló; el detalle y la tabla por semilla están en DESIGN-CORE.md §8, "Resultado del pulido".

- **Por qué la meta vieja no se podía cumplir.** "Saldo entre 1× y 3× del próximo gasto, al final del rato" choca con
  cómo juega cualquiera (y la sim): si te alcanza, lo comprás. Entonces, al irte, el saldo queda < 1× siempre que las
  monedas son lo que frena, y solo pasa 1× cuando frenan los materiales o las constructoras. Ningún ajuste pasó de ~60%:
  - comercio con las aldeas: 41% → 59%;
  - monumentos con −20% o −30% de monedas: 50–65%, y además rompen las metas de amenazas (preparación 64%, automática
    69–74%) y adelantan el primer monumento al día 8–9.
- **Meta nueva** (§8):
  - *al llegar* al rato, el saldo está entre 1× y 3× de lo que se quería comprar al irse, en ≥ 75% de los ratos;
  - *al irse*, el saldo pasa 3× el próximo gasto en ≤ 10% de los ratos.

  Semilla 1: **77,7%** al llegar (antes, sin comercio, 61%) y 1,8% de ratos > 3× al irse (antes 15%). Otras semillas al
  llegar: 73%, 48% y 64%. Las semillas 3 y 4 no llegan: encuentran más materiales y las monedas frenan más seguido.
  **Decidilo vos**: si se quiere ≥ 75% en todas las semillas, el paso siguiente es bajar un poco las monedas de las
  etapas de Jardín a Museo y, a la vez, recalibrar las amenazas, que hoy quedan en 75–76%, justo en el borde.
- **Sumidero nuevo: comercio con las aldeas** (`economy.js`: `TRADE`, `tradeStock`, `tradeQuote`, `buyMissing`).
  - Las aldeas venden los materiales que le faltan a la etapa de un monumento.
  - Precio por época: 60, 90, 200, 320 y 480 monedas por unidad. Tope por día: 12, 20, 30, 45 y 60 unidades.
  - Si falta más de lo que les queda en el día, venden lo que tengan.
  - Pide la Casa de Expediciones. Lo comprado no suma a `matsEarned`. Emite `materials:changed` (reason `trade`) y
    `trade:bought`.
  - En Obras, cuando a una etapa le faltan materiales, aparece "Comprar lo que falta a las aldeas · N monedas" con
    "Hoy les quedan N · X monedas cada uno".
  - En la sim (`--no-trade` para compararla sin el comercio): compra si después le quedan ≥ 2,5× las monedas de la
    etapa (`--trade-keep`). Cifras: 13 compras en 60 días, ~1.750 monedas por día.
- **Cambios en la sim** (`tools/sim-economy.mjs`):
  - mide las dos versiones de la meta;
  - nuevas perillas para explorar: `--trade-keep`, `--trade-price`, `--mon-coins 0.8` (o `faro=1,jardin=0.7…`);
  - `--trace` ahora muestra también "llegó" (el saldo al llegar);
  - imprime una línea con lo que se gastó en el comercio;
  - provisiones: no suma otro productor si falta ≤ 10% de lo que quiere por día. Antes, con el comercio, construía una
    Huerta de más el día 20, el depósito se llenaba y la meta "depósito al tope" daba 47% a 90 días.
- Probé y descarté:
  - **curva temprana**: al llegar, los días 1–10 ya andan bien (sale > 3× cuando lo que se quería era barato);
  - **otros sumideros** (reservas, equipo y reparaciones cuestan 20–250 monedas, contra ~40.000 por día): para que pesen
    habría que subirles el precio por rango, y eso encarece el arranque.
- Las otras semillas no reciben las perillas (`--runs` arma sus propios argumentos): para comparar perillas con varias
  semillas, correrlas a mano con `--seed N`.

## 2. Cuadrilla tardía
`threats.addHelp`: si la cuadrilla llega cuando la amenaza ya se resolvió sola, pero **salió antes** de que se resolviera
(`at ≤ res.at + 1 min`, el `created_at` del servidor), cuenta como si hubiera llegado a tiempo:
- suma +5 puntos al resultado (`res.pct`), agrega el nombre a `res.help` y da la diferencia de premio entre los dos
  escalones de `rewardFor` (gemas, monedas y materiales; la diferencia no se escala por el tamaño de la amenaza);
- además arregla un edificio dañado, como antes.

Si salió después de resolverse (por el caché de 2 min de los perfiles), solo arregla un edificio.
"Mientras no estabas…" lo cuenta: "La cuadrilla de Ana llegó después de que se resolviera sola, pero salió a tiempo: el
resultado pasa de 72% a 77% y arregló la Casa." Elegí compensar en lugar de leer las cuadrillas antes de resolver: no
depende de la red ni del orden de arranque, y sin conexión no traba nada.

## 3. Intercambio de hallazgos por región
`social-trade.js`: las dos grillas del editor ("Vos das" y "Vos recibís") van agrupadas por región, en el orden de
`REGION_ORDER` y con el título de la región (`.soc-pick-region`), igual que la pantalla de Hallazgos. El orden de cada
grupo se respeta (lo que te falta primero, etc.).

## 4. Tono
Saqué el 😄 de los seis mensajes del servidor que lo tenían: no solo `send_crew`, también el código propio, el regalo,
la visita, el corazón y la nota. Cambian en `schema.sql` y en `net-mock.js` por igual.
**Ojo** (no lo toqué): "No te podés mandar regalos a vos misma" y "No te podés dar corazón a vos misma" asumen género.
Si se cambian, hay que cambiar los dos archivos.

## 5. Medianoche con la app abierta
Antes, con la app abierta, "Mientras no estabas…" se abría:
- al pasar la medianoche y volver a la ciudad (por ejemplo, al terminar una expedición);
- al llegar cuadrillas;
- al volver de segundo plano después de un rato corto.

Al quedarse quieta en la ciudad, el premio del día recién salía con el próximo cambio de escena.

Ahora (`main.js`):
- **Llegada de verdad**: abrir la app, volver de segundo plano después de ≥ 10 min (`AWAY_MS`) o la bienvenida de la
  temporada. Sale el modal de siempre. La primera pasada después de llegar se queda con eso, aunque no haya nada que
  mostrar.
- **Con la app abierta**: avisos cortos (toasts), sin modal ni el título "Mientras no estabas…"
  (`arrival.js` → `openLight`):
  - "Empezó un día nuevo (racha de N días): …", con el premio del día cobrado solo;
  - una línea por amenaza o cuadrilla;
  - "Hoy se abre: …".

  La bienvenida, el aviso de la v3 y el primer día siempre van en el modal.
- Cada 30 s se mira si cambió el día (`todayStr`). Si cambió y estás en la ciudad, salen los avisos sin esperar a que
  cambies de escena.

## Pruebas
- `node tools/sim-economy.mjs`: 20 ✔ · 0 ✘. `--days 90 --runs 3`: 20 ✔ (semilla 1).
- Suites nuevas o tocadas, todas en verde:
  - `test-threats` 79/0, con dos secciones nuevas:
    - "Cuadrilla que llega después de la resolución automática": 72% → 77%, diferencia de premio, la que salió tarde
      solo arregla y el texto lo cuenta;
    - "Con la app abierta: aviso liviano": fuerza el premio del día pendiente con `login.last = '2000-01-01'` y una
      amenaza sin contar. Comprueba que salen los toasts, que no hay modal y que el premio queda cobrado.
  - `test-works` 39/0, sección nueva "Comercio con las aldeas": cotiza 8 unidades, el botón en Obras compra y desaparece,
    el stock del día baja y la compra parcial vende hasta lo que queda.
  - `test-social`: chequeo nuevo "el editor agrupa los hallazgos por región".
- Ninguna prueba nueva depende de la fecha ni del día de la semana.
- `npm test` completo en verde, sin reintentos: e2e 91/0, migración 48/0, colocación 65/0, stress 15/0, visitas 20/0,
  mock 91/0, social 65/0, rango 32/0, obras 39/0, Mi Casa 43/0, expedición 30/0, ciclo 61/0, amenazas 79/0,
  telemetría 67/0 y SQL 183/0. `npm run check` sin imports rotos.

## Falta / ideas
- Monedas en las semillas 3 y 4 (ver el punto 1).
- La captura del panel de Obras no llega a mostrar el botón de comercio (queda más abajo; la prueba lo encuentra y lo
  toca). Si se quiere una captura, hay que hacer scroll hasta `[data-act="trade"]`.
- El panel de Obras no se redibuja cuando cambian solo las monedas. Si el botón de comprar figura apagado por falta de
  monedas, se actualiza al volver a abrir el panel o cuando cambian los materiales; tocarlo igual da un aviso claro.
- Textos con "vos misma" en el servidor (punto 4).
