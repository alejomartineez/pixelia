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

### A2: combate apto para farmear (rama `claude/a2-combate-5384e9`, sin bump ni push; falta mergear)
Diseño y números en DESIGN-COMBAT.md §19. Solo toca `src/combat/` y `tools/`.
- **Medido**: una pelea común dura **66 a 69 s a ×1** y 53 s a ×2 en la escena real (bot + 2,5 s por jugada;
  `node test-combat-farm-scene.mjs`), y **3,6 / 4,3 / 4,4 turnos** en Marea I / II / III (`npm run sim:farm`).
- Tablero 6×6 para el farmeo (el tamaño sale del mapa; la historia y los jefes siguen en 8×8), 18 encuentros del Bosque
  del Arroyo (16 comunes y 2 élites), Marea I a III, 10 enemigos nuevos con 5 arquetipos de IA, matorral, fuego,
  corriente, 6 reacciones de elementos, fragmentos de veta, velocidad ×1/×2/×3 con botón, salteo con Espacio y
  resolución automática con botín y XP completos.
- Pruebas: `test-combat-farm` 65, `test-combat-farm-scene` 19, `test-combat` 100, `test-combat-scene` 29,
  `test-combat-exp` 75, `test-act1` 84, `test-i18n` 116. Las dos nuevas están en `npm test`.
- **Interfaz para A1 (`src/voyage/`) y A3**; lo de antes no cambió de firma:
  - `FARM.arroyo = { comunes, elites, jefe }` y `MAREA_MAX` (combat-data.js); `pickEncounter({ island: 'arroyo', seed,
    elite, avoid })` (combat-rules.js).
  - `newBattle({ ..., marea: 1..3, fragments: ['marea' | 'brasa' | 'cefiro'] })`. Por la URL: `&marea=2&frag=brasa`.
  - `canAutoResolve(encounter, best)` y `autoResolve({ encounter, best, marea, lootWin })`: quien llama guarda las
    mejores estrellas por encuentro y Marea. `quickResolve({ encounter, wins, stars, marea })` acepta `stars`.
  - `result()` suma `marea`, `reacts` y `reactDmg`; el botín y la XP ya vienen multiplicados por la Marea.
  - `view()` suma `w`/`h` variables, `marea`, `farm`, y por casilla `fire`, `steam`, `cover`, `water`, `flow`; por
    unidad `wet`, `burn`, `warded`, `ai`, `element`. Eventos nuevos: `react`, `status`, `fire`, `fireOut`, `steam`,
    `steamGone`, `charge`, `crash`, `drift`.
  - Nadie debe asumir 8×8: usar `b.w` y `b.h`. `COMBAT.w`/`COMBAT.h` quedan solo como el tamaño de la historia.
- Al mergear: `npm run bump` (hay un archivo nuevo, `src/combat/combat-text.js`, que tiene que entrar en `sw.js`).
- Pendiente (para A3 o un A2b): la expedición vieja (`src/expedition/`) sigue llamando `quickResolve` sin `stars`, así
  que ahí "Resolver rápido" da lo de antes; los comunes de la historia siguen en 8×8; el bot no usa reacciones; el arte
  de los enemigos nuevos son cubos. En el worktree, `tools/node_modules` es un enlace al del checkout principal.


### A3: botín y construcción de personaje (rama `claude/a3-botin-b43392`, sale de A2 + master v63; sin bump ni push)
Todo con cubos e interfaz mínima. Motores puros con semilla; nada de arte.
- **Archivos nuevos**: `src/core/loot-data.js` (tablas: 31 efectos, 29 rasgos, habilidades por arma, botín por Marea, 15
  reliquias), `src/core/loot.js` (motor), `src/core/tree-data.js` (27 nodos, 3 ramas, 3 nodos clave), `src/core/tree.js`
  (puntos, requisitos, reinicio), `src/scenes/tree.js` (pantalla: `?scene=tree&veta=400`; flechas, Enter, R, Esc),
  `tools/test-loot.mjs` (132), `tools/test-tree.mjs` (51) y `tools/sim-loot.mjs` (`npm run sim:loot`; con `--check` va en
  `npm test`).
- **Objetos**: `rollItem(rng, { source, marea })` da un arma con rareza y de 1 a 4 rasgos en `w.affixes: [{ id, v, skill? }]`
  (común 1, poco común 1 a 2, rara 2 a 3, épica 3 a 4, reliquia 4). Van al arsenal de siempre; las armas viejas
  (`w.traits`) siguen valiendo. Los rasgos cambian habilidades: daño, recarga, alcance, cura, freno, radio.
- **"Sos lo que llevás puesto"**: `WEAPON_SKILLS` da a cada tipo de arma su golpe y 3 habilidades (2 al empezar, la tercera
  con maestría 4; se llevan 2, `pickSkills`). Quien no equipó nada usa las del arma de su clase. Las de elemento del líder
  y los fragmentos quedan.
- **Árbol**: los puntos salen de la veta que deja cada pelea (`state.tree = { v, xp, nodes, resets }`; se completa solo, así
  que no hizo falta migración ni subir la versión del guardado). Nodos clave: Juramento de sangre (todos +1 de ataque,
  sin curas), Fila cerrada (1 menos de daño con alguien al lado, 1 menos de movimiento) y Marea adentro (enemigos con
  25 % más de vida; cada pelea deja un arma, y mejor).
- **Reliquias de salida**: `newRun`, `relicOffer` (3 a elegir), `takeRelic`, `skipRelic`; hasta 6 por salida. El objeto de
  la salida lo guarda la Travesía.
- **Enganche para la Travesía (A1, todavía no está en master)**; también está escrito arriba de `loot.js`:
  `const L = loadout(state, { party, leaderCls, run })` y `newBattle({ ..., marea: run.marea, gear: L.gear, rules: L.rules })`.
  Al ganar: `applyLoot(state, battleLoot({ result, source, marea, seed, mods: L.loot, luck: state.arsenal.luck, wins:
  run.wins }))` (source: `'pelea'`, `'elite'` o `'jefe'`) y `noteWin(run, result)`. `battleLoot` acepta igual el resultado de
  `autoResolve` (botín completo). Los materiales vuelven en `mats` para que los dé la economía.
- **Combate** (`combat-rules.js`, cambios chicos): `newBattle({ rules })` con `foeHp`, `foeAtk`, `maxTurns`, `startCover`,
  `noHeal`, `closeRank` y `killHeal`; `gear[quién]` acepta `skills`, `abil` (cambios por habilidad, `u.am`) y `mv`. Sin
  esos campos todo es igual que antes (`test-combat` 100, `test-combat-farm` 65, `test-arsenal` 122, `test-i18n` 126).
- **Simulador** (10 salidas, semilla 1, nivel del grupo fijo en el de la Marea I): fuerza media del arma puesta 48 → 166 →
  190 (salidas 1, 5 y 10), rasgos por arma 2 → 3,5, rareza media 1,3 → 2,8, 14 puntos del árbol y 55 armas. Con lo
  puesto gana 31 de 33 peleas jugadas; las mismas sin nada, 24 de 33 (en Marea III, 15 de 23).
- **Pendiente**: enchufarlo en `src/voyage/` cuando A1 esté en master (nodos de pelea, élite, jefe y reliquia) y en la
  expedición vieja (`gear.js` sigue con `fightMods` y `dropWeapon` del 2a). La ficha del objeto y la pantalla de equipo con
  los rasgos nuevos (`itemLines`, `itemPower`) son de U2. La escena del combate muestra los números base de cada
  habilidad, no los cambiados. El desarme por falta de lugar ordena por `weaponPower` (sin los rasgos nuevos). En el
  simulador la Marea sube rápido (III en la salida 3): el balance fino queda para A5. Textos nuevos en es, en y ja.
- Al mergear: `npm run bump` (5 archivos nuevos en `src/` para `sw.js`).

### En curso (sesiones abiertas por el chat coordinador `local_377480f3`; el orquestador integra)
- **A1** `local_2fe76e8b`, rama `claude/a1-travesia-3e736a`: terminó (commit `293aad4`; pasan `test-voyage` y
  `test-i18n`). Falta revisarla, mergearla y correr la suite.
- **A2** `local_b3df4020`, rama `claude/a2-combate-5384e9` (esfuerzo medio). La sesión `local_a28fd135` no arrancó: ignorarla.
- **R1** `local_c19fef5f`, rama `claude/r1-render-024ec7` (Fable 5.2 medio).
- **U1** `local_6f56642d` (rama u1-tono) y **mock de U2** `local_d69a3fd1` (rama u2-mock-hud; espera la aprobación
  del usuario antes de pasar pantallas).

## Próximos pasos (ver "Orden" en el plan)
1. Integrar A1; después A2, R1 y U1 a medida que entreguen (revisar diff, mergear, suite, bump, commit y push).
2. A3 (botín, árbol, reliquias) está hecho en su rama: mergearlo después de A2 y enchufarlo en la Travesía.
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
