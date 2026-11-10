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

### A1: prototipo de la Travesía por nodos (rama `claude/a1-travesia-3e736a`, sin bump ni push)
**Qué quedó** (se juega de punta a punta con `?scene=voyage&seed=N` o con el botón provisorio "Travesía (prototipo)"
de la ciudad):
- `src/voyage/voyage-gen.js`: mapa con semilla, de 5 a 7 filas (la última es el jefe), de 2 a 4 nodos por fila, uniones
  sin cruces que se bifurcan y se juntan, 5 tipos (pelea, élite, evento, campamento, jefe) y de 3 a 5 peleas en
  cualquier camino.
- `src/voyage/voyage-rules.js` (puro, la salida es JSON): elegir nodo conectado, vida del grupo que sigue de pelea en
  pelea, 1 de 3 recompensas tras cada pelea, 5 eventos con consecuencia segura y a la vista, campamento (descansar o
  entrenar), 6 reliquias, caer o retirarse = mitad del botín, volver desde el mapa = todo. Sin provisiones ni relojes.
- `src/voyage/voyage-data.js`: tablas. **Extensión para A3**: `RELICS` (modificadores en `mods` y funciones en
  `on`: battle, fightWon, enter, finish), `REWARDS`, `registerRelic` y `registerReward`; los efectos son
  declarativos (`applyFx`).
- `src/voyage/voyage-scene.js`: escena `voyage` en DOM, sin arte. Guarda en `state.voyage` (`active`, `runs`,
  `wins`) y acredita los materiales con `store.grant` al terminar. Emite `voyage:finished` y `voyage:combat`.
- `tools/sim-voyage.mjs` (`npm run sim:voyage`): 200 salidas con la IA de `sim-combat`. Hoy: prudente 76 % de
  victorias, 6 nodos, 3,6 peleas, 6,9 turnos por pelea, 14,4 min estimados (28 s por turno, a ojo); codicioso 91 %;
  azar 66 %.
- `tools/test-voyage.mjs` (82 chequeos, en `npm test`; `--node` corre solo los motores). Corrí esa y `test-i18n`;
  la suite completa no.

**Qué falta o hay que saber:**
- El grupo es fijo (líder nivel 4 con Raíz, cazador, forjador y curandero nivel 2): no lee la partida. A3 lo arma con
  lo que llevás puesto.
- La ruta de élites domina (91 %): la élite es solo +40 % de vida y siempre da reliquia. Subir su dificultad o bajar
  el premio cuando A2 cierre el combate.
- Los minutos son una estimación; hay que medirlos con gente (A5) y con el tablero 6×6 de A2.
- Los textos `voyage.*` están solo en español: `test-i18n` los exceptúa de en y ja hasta A5 (son provisorios).
- El botón de la ciudad es un `position:fixed` puesto en `city.js`; se va con el HUD de PC (U2).
- No se retiró la expedición por grilla. No hay XP de líder ni de clases, ni "repetir travesía", ni Marea.
- Falta `npm run bump` (archivos nuevos en `src/voyage/` para `sw.js`) al integrar.
- En el worktree, `tools/node_modules` es un enlace al del checkout principal (no está en git).

**Qué necesita la Travesía del combate (para A2):**
- Hoy la Travesía escribe sobre la pelea recién creada con `newBattle`: vida actual y máxima, ataque y coraza de
  cada aliado, vida de los enemigos y `b.foe` (para los refuerzos). Mejor que `newBattle` lo reciba:
  `allies: { tipo: { hp, maxHp, atk, armor } }` y `foeHp` (multiplicador), sin depender de `power`.
- Lee de la pelea terminada `units[].hp/alive/type` y `items` (los gastados quedan en 0): que eso no cambie, o
  que `result(b)` devuelva `allies: { tipo: hp }` y `itemsUsed`.
- Usa `router.go('combat', { battle, noRetry: true, onSave, onEnd })`, `hashSeed`, `retreat` y `result`.
- La resolución automática de A2: que sea una función pura que devuelva el mismo `result` y la vida con que queda
  cada uno, así la Travesía la ofrece en la tarjeta de pelea.
- Para reliquias que cambian reglas adentro de la pelea (A3) hacen falta ganchos en el motor: primera habilidad
  gratis, daño por elemento, efecto al matar. Hoy solo se puede tocar el estado inicial.
- Élite: hoy es el mismo encuentro con más vida. Hace falta una marca de élite en los encuentros o un modificador
  (comportamiento, no solo números).

### Pendiente de integrar (paso A0)
- `claude/sweet-ramanujan-18bcd8` (sesión `local_8559c03b`, detenida a mitad de turno, **sin commit**): cambios en
  `src/combat/boss-models.js`, `combat-scene.js`, `combat-ui.js`, `enemy-models.js`, `tools/test-act1.mjs` y archivos
  nuevos `class-accent.js` y `combat-backdrop.js`. Revisar si sirve con el tablero 6×6 de A2 antes de terminarla.
- `claude/nifty-nightingale-01cb64` (paso 2a de la Travesía: nivel 50, talentos, arsenal con rarezas, maestría;
  `test-social` falla). Es la base de A3.

## Próximos pasos (ver "Orden" en el plan)
1. Cerrar R0 y mergearla a master. A0: integrar las dos ramas de arriba.
2. En paralelo: A1 (prototipo de la Travesía sin arte, `src/voyage/`), A2 (combate apto para farmear) y R1 (motor
   fotográfico, en **Opus 5.5 medio**).
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
- Modelo: `claude-fable-5-2` con esfuerzo bajo en todas las sesiones, salvo R1 (motor de render y shaders), que va
  en `claude-opus-5-5` con esfuerzo medio. Verificar con `get_session` que quedó así.
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
