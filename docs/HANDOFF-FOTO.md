# HANDOFF: porción vertical "refugio cálido, mundo oscuro"

Plan: [PLAN-FOTO.md](PLAN-FOTO.md) (aprobado por el usuario el 2026-11-10; reemplaza el orden de
[PLAN-TRAVESIA.md](PLAN-TRAVESIA.md), del que se reusa el diseño de la Travesía §2c, los elementos y el farmeo).
Objetivo: una sola isla con todo al nivel final (render fotográfico, HUD de PC, farmeo con botín y árbol, tono
nuevo), cerca de una hora de juego, para probar con jugadores y como demo de Steam. Solo Windows.

## Estado (2026-11-10)

### Hecho
- **v62 en master** (`20bea9a`): posproceso en `src/core/voxel.js` (`createOutlinePass(..., withPost)`: bloom a 1/4 de
  resolución, DOF, curva en S, split-toning, viñeteado; `r.setPost`, `POST_DEFAULT`, `?post=0|1`, apagado en el preset
  bajo), `bloomBoost` de noche en `ambience-fx.js`, acabado por cinemática y por plano en `src/cinema/player.js`
  (`dof.focus: 'look'`) y en `src/scenes/intro.js`. Capturas en `shots/review-v62/`.
- `npm test` de la v62: pasa todo salvo el glosario (`settings.credits.music` en inglés decía "The Breaking" en vez de
  "Fracture"; es de la v61). La suite corta ahí, así que la prueba de SQL no corrió.

- **v63 en master: R0 y A0 cerrados.**
  - **R0** (rama `claude/foto-etapa0-b25a35`, mergeada): mallado en `src/core/voxel-mesh.js` (greedy meshing con
    uniones en T cerradas; `?greedy=0`), `voxel-worker.js` y `Voxels.toGeometryAsync` con caché en IndexedDB
    (`MESH_VERSION`), lector de MagicaVoxel `src/core/vox-loader.js`, `tools/make-vox.mjs`, `npm run test:vox`,
    diorama `tools/lookdev.html` y `npm run lookdev`. Medido: 6 % menos de vértices (el jitter por vóxel impide unir
    caras; R1 debería pasarlo al shader) y el armado de 1350 modelos bajó de ~5,7 s a ~2,6 s.
  - **A0, combate** (rama `claude/sweet-ramanujan-18bcd8`, mergeada): la Bestia del Bañado en vóxel
    (`boss-models.js`), color por clase (`class-accent.js`: aro, ropa, barra de vida y lista del turno) y fondo del
    bioma (`combat-backdrop.js`). Se integró porque estaba completa y pasaba `test-combat-scene`, `test-act1` y
    `test-class-look`; A2 parte de ahí.
  - **A0, paso 2a** (`claude/nifty-nightingale-01cb64`): ya estaba contenida en master (su punta `139ab19` es
    ancestro), no había nada que mergear. `test-social` pasa en master.
  - Suite completa de la v63: pasa todo. `test-audio` fallaba por los saltos CRLF de `LICENSES.md` en Windows
    (arreglada la prueba). Con varias sesiones corriendo a la vez, `test-place`, `test-mock`, `test-telemetry`,
    `test-combat-exp`, `test-classes` y `test-class-look` fallan por tiempos y pasan al repetirlas solas: ante una
    falla, repetir esa prueba suelta antes de tocar código.

### En curso (sesiones abiertas por el chat coordinador `local_377480f3`; el orquestador integra)
- **A1** `local_2fe76e8b`, rama `claude/a1-travesia-3e736a`: terminó (commit `293aad4`; pasan `test-voyage` y
  `test-i18n`). Falta revisarla, mergearla y correr la suite.
- **A2** `local_b3df4020`, rama `claude/a2-combate-5384e9` (esfuerzo medio). La sesión `local_a28fd135` no arrancó: ignorarla.
- **R1** `local_c19fef5f`, rama `claude/r1-render-024ec7` (Fable 5.2 medio).
- **U1** `local_6f56642d` (rama u1-tono) y **mock de U2** `local_d69a3fd1` (rama u2-mock-hud; espera la aprobación
  del usuario antes de pasar pantallas).

## Próximos pasos (ver "Orden" en el plan)
1. Integrar A1; después A2, R1 y U1 a medida que entreguen (revisar diff, mergear, suite, bump, commit y push).
2. Cuando A2 esté integrada, abrir A3 (botín, árbol, reliquias) sobre el arsenal y la maestría del 2a, que ya está en master.
3. A5: prueba con jugadores del prototipo con cubos. Recién después, arte.

## Lo que hace el usuario
- Trámites de Steam (verificación de identidad, pago y esperas) y confirmar en Steamworks qué uso de IA se declara.
- Conseguir 3 a 5 personas para las pruebas.
- Decidir si modela a mano o encarga las piezas protagonistas (MagicaVoxel).

## Reglas para cada sesión
- **Permiso del usuario (2026-11-10): sí a todo lo que haga falta para el plan**, sin preguntar: abrir sesiones nuevas
  (desde el orquestador o desde cualquier sesión), cambiarles modelo y esfuerzo, mergear ramas a master, bump y
  commits. También publicar: `git push` a GitHub y releases del juego de PC (`npm run release`), con la suite en
  verde. Siguen fuera: claves y pagos (Steam, bancos), la clave `service_role` y el otro proyecto de Supabase. Si la app rechaza abrir una sesión, dejar tarjeta y avisar.
- Modelo: `claude-fable-5-2` en todas las sesiones. Esfuerzo bajo por defecto y **medio en los pasos más difíciles**
  (R1, motor de render; A2, IA y balance del combate; y los que el orquestador juzgue así: economía sin relojes,
  migraciones de guardado). Verificar con `get_session` que quedó así.
- Pasado el 35 % de contexto: commit WIP, anotar acá dónde quedó y terminar; el orquestador abre una sesión nueva
  ("fresh"). Vale también para el orquestador.
- El tono cambió: ya no es "cozy". Hasta que U1 reescriba la guía, usar "refugio cálido, mundo oscuro; voz sobria".
- Textos por `t()` (i18n); español rioplatense. Sin build ni dependencias en tiempo de ejecución.
- GPU RTX 3060 Ti: tope de 60 FPS, corridas cortas, parar a 70 °C o 100 W. Las capturas con `smoke.mjs` usan
  SwiftShader (CPU).
- Consumo: el límite semanal de la cuenta iba por 88 % el 2026-11-10 (se renueva el 13). Commits WIP seguido; la
  suite completa, una vez por paso.
- El checkout principal es compartido: stagear los archivos por nombre, nunca `git add -u`. `npm run bump` antes de
  cada commit que cambie archivos del juego. Las sesiones trabajan en worktrees; el orquestador mergea.
- PushNotification al terminar un paso, en cada handoff y al quedar bloqueado.
