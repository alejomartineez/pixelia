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

### En curso
- **R0** en la rama `claude/foto-etapa0-b25a35` (sesión `local_1440b5bf`, worktree `.claude/worktrees/foto-etapa0-b25a35`):
  commit WIP `238ed1d` con greedy meshing (`voxel.js`, `voxel-mesh.js`), `voxel-worker.js` con caché, `vox-loader.js`,
  `tools/make-vox.mjs`, `tools/test-vox.mjs`, diorama de lookdev y el arreglo del glosario. Falta: suite completa,
  bump, commit final y merge a master.

### Pendiente de integrar (paso A0)
- `claude/sweet-ramanujan-18bcd8` (sesión `local_8559c03b`, detenida a mitad de turno, **sin commit**): cambios en
  `src/combat/boss-models.js`, `combat-scene.js`, `combat-ui.js`, `enemy-models.js`, `tools/test-act1.mjs` y archivos
  nuevos `class-accent.js` y `combat-backdrop.js`. Revisar si sirve con el tablero 6×6 de A2 antes de terminarla.
- `claude/nifty-nightingale-01cb64` (paso 2a de la Travesía: nivel 50, talentos, arsenal con rarezas, maestría;
  `test-social` falla). Es la base de A3.

## Próximos pasos (ver "Orden" en el plan)
1. Cerrar R0 y mergearla a master. A0: integrar las dos ramas de arriba.
2. En paralelo: A1 (prototipo de la Travesía sin arte, `src/voyage/`), A2 (combate apto para farmear) y R1 (motor
   fotográfico).
3. A3 (botín, árbol, reliquias), U1 (guía de tono nueva) y el mock de U2 (HUD de PC) para que el usuario lo apruebe.
4. A5: prueba con jugadores del prototipo con cubos. Recién después, arte.

## Lo que hace el usuario
- Trámites de Steam (verificación de identidad, pago y esperas) y confirmar en Steamworks qué uso de IA se declara.
- Conseguir 3 a 5 personas para las pruebas.
- Decidir si modela a mano o encarga las piezas protagonistas (MagicaVoxel).

## Reglas para cada sesión
- **Permiso del usuario (2026-11-10): sí a todo lo que haga falta para el plan**, sin preguntar: abrir sesiones nuevas
  (desde el orquestador o desde cualquier sesión), cambiarles modelo y esfuerzo, mergear ramas a master, bump y
  commits. También publicar: `git push` a GitHub y releases del juego de PC (`npm run release`), con la suite en
  verde. Siguen fuera: claves y pagos (Steam, bancos), la clave `service_role` y el otro proyecto de Supabase. Si la app rechaza abrir una sesión, dejar tarjeta y avisar.
- Modelo: `claude-fable-5-2` con esfuerzo bajo en **todas** las sesiones, también R1 (el usuario lo cambió el
  2026-11-10). Verificar con `get_session` que quedó así.
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
