# Colocar y mover edificios (handoff)

Rama `claude/colocacion-7b25f0`. Pedido del dueño: "cómo se mueven los edificios y la mecánica de cómo se colocan, porque
es medio tosco y antiintuitivo".

## Problemas que encontré (jugando en celu y PC, y leyendo `city.js`)
1. **El fantasma casi no se veía**: las casillas del pie (sin prueba de profundidad, `renderOrder` 6) se dibujaban
   **encima** del modelo transparente (`renderOrder` 4) y lo lavaban de celeste. Encima tenía opacidad 0,62 y rebotaba
   todo el tiempo.
2. **Los botones lejos del edificio**: Cancelar · Rotar · Colocar en una barra abajo; con el pulgar había que ir y volver.
3. **Con el dedo, arrastrar tapaba el edificio**: el fantasma quedaba debajo del dedo, y solo se agarraba si el toque caía
   justo sobre su base (margen 0,25 casillas); si no, se movía la cámara.
4. **Con el mouse el fantasma perseguía al puntero**: para llegar a la barra había que cruzar la ciudad, y había un parche
   ("settled") que intentaba devolverlo. Un clic en cualquier lado **construía y cobraba** de una.
5. **Sin paneo en los bordes**: para llevar algo lejos había que soltar, mover la cámara y volver a agarrar.
6. **Mover un edificio puesto** solo desde la ficha (tocar → Mover). Sin toque largo; sin deshacer: si lo dejabas mal, a
   repetir todo. El "Rotar" de la ficha giraba sin vuelta atrás.
7. **Motivo genérico**: "Hay algo ahí · elegí un lugar verde". Las casillas se pintaban con una regla enredada (verde o
   roja, sin distinguir "ocupado" de "falta plata/constructoras").
8. **Caminos seguidos**: pintando rápido se salteaban casillas (solo se pintaba en cada evento de movimiento), y no estaba
   claro que había un modo "seguir poniendo".
9. **Rotar** cambiaba la esquina pero no el centro: el edificio saltaba de lugar.

## Qué cambió
Todo lo de colocar se fue a **`src/scenes/city-place.js`** (nuevo, `createPlacer(host)`); `city.js` adelgazó ~250 líneas y
solo maneja los gestos y le pasa al módulo lo que le toca.
- **Botones junto al edificio** (`.cx-pc`): ✕ · Rotar · ✓, debajo de la base (o arriba del techo si abajo no entra),
  siempre dentro de la pantalla. Arriba, en rojo, el motivo cuando no entra ("Ahí está Panadería", "Fuera de tu
  terreno", "No te alcanzan las monedas", "Constructoras ocupadas"). Se esconden mientras arrastrás.
- **Barra abajo más chica** (`.cx-placebar`, se mantiene el nombre de clase porque `main.js`/`install-card.js` la usan para
  no abrir modales encima): nombre, costo, contador y una línea de ayuda. "Listo" solo cuando estás poniendo caminos/deco.
- **Arrastrar el fantasma** con dedo o mouse; arrastrar fuera de él mueve la cámara. Con el dedo el edificio queda
  **62 px por encima** (no lo tapa) y se levanta un poco del piso mientras lo llevás. Agarre generoso (0,45 casilla; 0,8
  en piezas de 1×1).
- **Tocar/clic en el pasto** lleva el fantasma ahí (no construye). Con mouse, **clic sobre el fantasma = colocar**.
- **Casillas por casilla**: verde libre, roja ocupada o fuera del terreno, ámbar si el lugar está bien pero falta otra cosa.
  El fantasma se tiñe apenas (sin perder sus colores) cuando no entra.
- **Paneo en los bordes**: arrastrando contra un borde (después de 0,25 s en la franja, arranque suave; medido con reloj
  real, así funciona igual si los cuadros vienen lentos).
- **Toque largo** (420 ms, también con mouse) sobre un edificio: se levanta (sin saltar: respeta de dónde lo agarraste)
  y sigue al puntero; al soltar en un lugar libre queda ahí. El toque largo gana sobre los carteles de terreno vecinos. Si no entra, queda levantado con el motivo y los botones. "Mover" de la ficha sigue (y la primera vez
  avisa del atajo).
- **Deshacer** el último movimiento o giro (mover es gratis, deshacer también): botón junto al edificio por 8 s y Ctrl+Z.
  No hay deshacer de construcciones nuevas a propósito (devolver la plata dejaría farmear XP/estadísticas).
- **Caminos y deco seguidos**: después del primero queda en modo "seguir poniendo"; ✓ pone otro y pasa a la casilla de
  al lado; arrastrar desde la pieza pinta todo lo que cruza, **sin huecos** (línea por casillas, pasos por los lados).
- **Rotar** gira alrededor del centro. **Teclado**: R rota, Enter/Espacio coloca, Esc cancela, flechas corren el fantasma
  una casilla siguiendo la grilla en pantalla, Ctrl+Z deshace. WASD sigue moviendo la cámara.
- Botones flotantes responden a `pointerup` (el navegador a veces no manda el `click` de un botón que se reubica cuadro
  a cuadro) y no toman el foco con mouse (si no, Enter "apretaba" Rotar en vez de colocar).
- `city-camera.js`: `panScreen(dx, dy)` (paneo en píxeles de pantalla).
- `city-ui.js`: se fue `makePlaceBar` y su CSS (ahora `PLACE_STYLE` en `city-place.js`).

## Gancho para la Fase 3 (radio de cobertura de las defensas)
En `city-place.js` (documentado arriba del archivo). El placer está en `S.place` (lo que reciben los paneles de
`city-ui`) y en `window.__pixelia.city.placer`:
```js
const off = S.place.onGhostMove((info) => {
  // info = { id, mode: 'new'|'move', uid, x, z, rot, w, d, cx, cz, valid, reason, paint }  ·  null al terminar
  if (!info || !isDefense(info.id)) return layer.clear();
  layer.set(cellsInRadius(info).map(([x, z]) => ({ x, z, tone: 'cover' })));
});
const layer = S.place.tileLayer('cobertura');   // capa de casillas propia, debajo del fantasma; se limpia sola al terminar
// tonos: 'cover' (celeste suave), 'ok', 'bad', 'warn'
```
También va por el bus: `city:placing {active:true, id, mode, uid}` al empezar, `city:placing {active:false}` al terminar y
`city:ghost` (mismo `info`) en cada cambio. Si la Fase 3 metió su gancho en el `updateGhost` viejo de `city.js`, al unir
hay que pasarlo a `onGhostMove` (el `updateGhost` ya no existe; ahora es `update()` adentro de `city-place.js`).

## Archivos
- **.js nuevo para el precache** (`npm run bump` al unir): `src/scenes/city-place.js`.
- Tocados: `src/scenes/city.js`, `src/scenes/city-ui.js`, `src/scenes/city-camera.js`.
- Prueba nueva: `tools/test-place.mjs` (en `npm test`). Ajustadas: `tools/test-e2e.mjs` (buildUI usa ✓ `.cx-pc-ok` y
  "Listo"/✕), `tools/test-works.mjs`, `tools/test-visit.mjs`.

## Pruebas
`tools/test-place.mjs` corre en iPhone (toque) y PC (mouse): colocar arrastrando y con ✓/Enter, arrastrar fuera del
fantasma mueve la vista, rotar (botón y R), lugar ocupado (motivo con el nombre, ✓ apagado, casillas rojas), cancelar
(✕ y Esc) sin gastar, toque largo para levantar y soltar, Deshacer (botón y Ctrl+Z), Mover desde la ficha, caminos
seguidos arrastrando sin huecos, paneo en el borde, flechas, clic sobre el fantasma y el gancho `onGhostMove`.
Capturas: `node smoke.mjs` en iPhone y PC → `shots/colocacion-{iphone,pc}-{libre,ocupado,caminos}.png`, y las de
`test-place.mjs` en `shots/place/` (la carpeta `shots/` no se commitea).

Resultado de `npm test` (corrido por partes porque la cadena corta en la primera falla; la máquina estaba cargada por otras
sesiones): `test-e2e` 85 OK (en la primera pasada falló por carga al tocar una pestaña del menú; reintentada sola, verde),
`test-place` 65 OK, `test-stress`, `test-visit`, `test-mock`, `test-social`, `test-works`, `test-home`, `test-expedition`,
`test-cycle`, `test-telemetry` y `test-sql` en verde.
**`test-rank` tiene 1 falla que ya está en master** (`15df6a6`, comprobado en un worktree aparte sin mis cambios): "la
ficha lista el expediente del próximo rango" espera 4 requisitos y hay 5 (el de planos que sumó la Fase 4). No es de
colocación; no la toqué. Hay que ajustar el `=== 4` de `tools/test-rank.mjs:177` o la ficha.
