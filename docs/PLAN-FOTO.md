# Pixelia: porción vertical "refugio cálido, mundo oscuro" (solo Windows)

## Contexto
El usuario quiere convertir Pixelia en un juego de PC de farmeo, oscuro y atrapante, con gráficos de "maqueta
fotografiada", HUD de PC (referencias: Path of Exile, Albion), árbol de habilidades e historia que reacciona.
Diagnóstico de hoy: la expedición por grilla es clic, casilla y dado; el combate táctico (lo más profundo) casi no
aparece; la economía conserva relojes de celular; los modelos hechos en código se ven baratos.
Son demasiados frentes para hacerlos todos a lo ancho, así que se hace **una porción vertical**: una sola isla con
todo al nivel final, cerca de una hora de juego, que sirve para probar con jugadores y como demo de Steam.

**Decisiones tomadas (2026-11-10):**
- Motor: three.js en Tauri, render "Teardown liviano", WebGL2. Solo Windows; Mac y web después con el render clásico.
- Look: maqueta fotografiada. Tono: **la aldea es la única luz en un mundo roto** (adentro cálido, afuera oscuro).
- Aventura: **Travesía por nodos con el combate al centro**; la grilla se retira. Juego de **farmeo**.
- **Se sacan los relojes y esperas** de celular y las gemas para saltear.
- Modelos: más densidad, kit modular en `.vox`; las piezas protagonistas las hace una persona en MagicaVoxel.
- Las viñetas 2D de El Quiebre siguen en 2D.
- Sesiones: todas en Fable 5.2 con esfuerzo bajo, también R1. Al 35 % de contexto la
  sesión cierra y sigue otra nueva.
- **Permiso del usuario: sí a todo lo que haga falta para el plan**, sin preguntar (abrir sesiones desde cualquier
  chat, cambiar modelo y esfuerzo, mergear, bump y commits). Incluye publicar (push a GitHub y releases). Fuera: claves y pagos.
- Hecho: v62 con el posproceso (bloom, tonos, viñeteado, DOF) en master. En curso: Etapa R0 en la rama
  `claude/foto-etapa0-b25a35` (greedy meshing, worker, lector `.vox`; commit WIP `238ed1d`).
- Pendiente de integrar: rama 2a de la Travesía (`claude/nifty-nightingale-01cb64`: nivel 50, talentos, arsenal con
  rarezas, maestría; `test-social` falla) y la sesión de la Bestia y el combate (`claude/sweet-ramanujan-18bcd8`, detenida).

## Qué entra en la porción vertical
Arranque → El Quiebre → personaje → llegada → aldea mínima → **una isla (Bosque del Arroyo) farmeable** → jefe (la
Bestia del Bañado) → una decisión de historia. Todo con el render, el HUD y el tono nuevos.

## Pista A: diversión (primero, con cubos; Fable 5.2 bajo)
A0. **Integrar** la rama 2a y la de la Bestia: revisar, arreglar `test-social`, mergear o descartar con motivo.
A1. **Prototipo de la Travesía sin arte** en `src/voyage/` (según `docs/PLAN-TRAVESIA.md` §2c, recortado):
    mapa de nodos de 5 a 7 filas con 5 tipos (pelea, élite, evento, campamento, jefe); 3 a 5 peleas por salida;
    salida de 10 a 15 minutos; se zarpa cuando se quiere.
A2. **Combate apto para farmear** (`src/combat/`): tablero 6×6 y peleas de 1 a 2 minutos; velocidad ×2 y ×3;
    **resolución automática con botín completo** para lo ya superado; 10 a 12 enemigos con comportamientos distintos
    (huye, protege, invoca, carga en línea); terreno que importa; elementos con reacciones (plan 2d, recortado).
A3. **Botín y construcción de personaje**:
    - Objetos con rareza y de 1 a 4 rasgos al azar que modifican habilidades (sobre el arsenal de la rama 2a).
    - "Sos lo que llevás puesto": el arma define las habilidades activas (sobre la maestría de la rama 2a).
    - **Árbol de habilidades** de 60 a 100 nodos con 8 a 10 nodos clave que cambian reglas (datos en
      `src/core/tree-data.js`, pantalla nueva). En la porción vertical, un tercio del árbol.
    - 12 a 15 reliquias de salida que cambian reglas.
    - Niveles de dificultad de la isla (Marea I a III en la porción) con mejor botín.
A4. **Sin relojes** (`src/core/economy.js`, `data.js`, `chests.js`, pase, misiones): las obras se pagan con lo que
    se trae de la aventura y se terminan al instante o jugando; fuera gemas para saltear y constructores pagos;
    amenazas mientras jugás. Metas nuevas en DESIGN-CORE.md §8 (sesión de 1 a 2 horas) con `npm run sim:economy`.
    Migración de guardado v7.
A5. **Prueba con jugadores** (3 a 5 personas, el prototipo con cubos): `docs/PLAYTEST-1.md`. Si el farmeo no
    engancha, se ajusta acá, antes de ponerle arte.

## Pista R: render y cámara (en paralelo con la pista A)
R0. Base (en curso): greedy meshing, worker con caché, lector `.vox`, diorama `tools/lookdev.html`.
R1. **Motor fotográfico** (`src/core/voxel.js`, `src/core/voxel-light.js`): cadena HDR con
    exposición y AgX; volumen 3D por escena (color y ocupación) con rayos para sombra del sol con penumbra,
    oclusión ambiental, un rebote de luz, reflejos en agua y vidrio, y sombras de hasta 8 luces puntuales; material
    PBR por vóxel; cielo físico; lente de maqueta (bokeh, grano, aberración leve, viñeteado); niebla volumétrica;
    TAA. Rayos a media resolución, tope de 60 FPS, calidad baja con el render clásico.
    Para el tono: la oscuridad es de verdad (negros profundos, luz que cae rápido) y la aldea emite luz cálida.
R2. **Cámara de cine** (`src/cinema/`): lente por plano, cambio de foco, cámara en mano, encuadre por tercios,
    plano y contraplano, fundido de cámara juego ↔ escena, luz de tres puntos.

## Pista U: HUD de PC y tono
U1. **Guía de tono nueva** en DESIGN.md (reemplaza "cozy adulto"): refugio cálido y mundo oscuro; voz sobria y
    seca; reglas de color (cálidos solo en la aldea y en lo que da luz). Actualizar CLAUDE.md.
U2. **Sistema de interfaz de PC** (`src/core/ui.js`, estilos): paneles oscuros y densos con marcos trabajados,
    inventario en grilla, ficha de objeto con rasgos y comparación al pasar el mouse, barra de habilidades,
    pantalla de personaje y del árbol, atajos de teclado. Diseñar primero un mock con la skill `impeccable` y
    aprobarlo con el usuario antes de pasar todas las pantallas. Sin anchos fijos (9 idiomas).
U3. **Historia que reacciona**: una decisión grande al final de la isla (qué se hace con la veta, o a qué Casa se
    apoya) guardada en `story.flags`, que cambia qué enemigos, mercader y escena aparecen después. Pocas y grandes.

## Pista M: modelos de la porción
M1. Regla de densidad (16 vóxeles por tile; 32 en protagonistas) y paleta del tono nuevo en DESIGN.md.
M2. Kit modular de la época Madera, decorados de El Quiebre, la isla del Bosque (terreno, árboles, ruinas),
    enemigos y la Bestia, en `.vox` (`assets/models/`), ensamblados por código. Hoja de referencias en `docs/ref/`.
    Las piezas protagonistas, hechas a mano por el usuario o un artista; el resto, Claude con revisión por capturas.

## Orden
1. A0 y cierre de R0. 2. A1, A2 y R1 en paralelo. 3. A3, U1 y el mock de U2. 4. A5 (prueba con cubos).
5. A4, R2, U2 completo y M1 y M2. 6. Arte y render sobre la Travesía; El Quiebre, personaje y llegada con cámara
nueva; U3. 7. Segunda prueba con jugadores y demo.
Frente del usuario, en paralelo: trámites de Steam (verificación de 15 a 30 días, 100 USD y 30 días de espera,
página "Próximamente" 2 semanas antes) y confirmar en Steamworks qué uso de IA hay que declarar.

## Fuera de la porción (después)
Las demás islas y épocas, el Cuartel con encargos, el resto del árbol, Mareas IV a X y la Grieta profunda, más
decisiones de historia, traducción (bloque 4b), Mac y web.

## Riesgos
- Farmeo con combate por turnos: si las peleas no bajan a 1 o 2 minutos y el botín no se siente, no engancha. Se
  valida en A5 antes de invertir en arte.
- Tamaño: es casi un juego nuevo. La porción vertical es el corte; no se ensancha hasta cerrarla.
- Render propio: mantenimiento nuestro y carga de GPU (probar también en Intel y AMD). Si el diorama no llega al
  nivel buscado tras R1, se reevalúa Unreal 5 con evidencia.
- Consumo de la cuenta: el límite semanal iba por 88 %; sesiones cortas, commits WIP y la suite completa una vez por paso.

## Verificación
- Pista A: pruebas nuevas por sistema en `tools/` (travesía, botín, árbol, economía sin relojes), `npm run
  sim:economy` y la prueba con jugadores.
- Pistas R, U y M: capturas antes y después (diorama y escenas reales; día y noche) enviadas con SendUserFile,
  revisión cuadro a cuadro de cinemáticas con `tools/cinema.html?view=strip`, y `test-stress` para FPS y armado.
- Siempre: `npm test` completo al cerrar cada paso, FPS y temperatura en `npm run desktop:dev` (parar a 70 °C o
  100 W), `node test-desktop.mjs` antes de publicar, `npm run bump` antes de cada commit, stagear por nombre.
- Estado al día en `docs/PLAN-FOTO.md` (este plan) y `docs/HANDOFF-FOTO.md`.
