# HANDOFF: Pixelia "maqueta fotografiada"

Plan: [PLAN-FOTO.md](PLAN-FOTO.md). Objetivo: un render físico estilo "maqueta fotografiada" (Town to City +
Teardown liviano), una cámara de cine y los primeros minutos de juego rehechos primero. Solo Windows por ahora.

## Estado (2026-11-10)

### Hecho: Fase A, posproceso (commit "Acabado de cámara: bloom, tonos, viñeteado y DOF")
- `src/core/voxel.js`
  - `createOutlinePass(renderer, cfg, samples, lines, withPost)`: con `withPost`, bloom (extracción 4×4 a 1/4 de
    resolución en float16 y dos blur separables), DOF (mezcla con una versión borrosa según la distancia al foco; la
    tinta se apaga en lo desenfocado), curva en S, split-toning (sombras frías y luces cálidas) y viñeteado.
  - Renderer: `POST_DEFAULT`, `r.setPost(patch | null)`, `r.post`, `r.postOn`. `GFX.post` (Ajustes:
    `post: gfxPreset !== 'low'`). `?post=0|1` manda sobre los Ajustes.
  - `setGrade` acepta `bloomBoost` (ambience-fx lo manda con `look.glow * 1.6`: de noche las luces brillan más).
- `src/cinema/player.js`: `opts.post` (toda la cinemática) y `S.post` por plano; `dof.focus: 'look'` enfoca el punto que
  mira la cámara en cada cuadro (`focusFn(t, camPos)` para enfocar a mano).
- `src/scenes/intro.js`: `POST` de El Quiebre (bloom 0,6, viñeteado 0,42, contraste 0,22, split 0,22) y DOF en los
  planos 3D.
- Capturas de comparación en `shots/review-v62/` (`intro-N-post0|1.png`, `city-h*-post0|1.png`).
- Límite conocido: el target de la escena sigue en RGBA8 sRGB (LDR), así que el bloom trabaja por umbral. La Etapa 1
  lo pasa a HDR.

### Sesiones paralelas
- `local_8559c03b` ("Bestia del Bañado en vóxel y legibilidad del combate"): trabaja en `src/combat/` en su propia
  rama. Mergear antes de tocar el combate (Etapa 3.6).

## Próximo paso: Etapa 0
1. Greedy meshing en `Voxels.toGeometry` (respetando el color y la oclusión por vértice; medir con `test-stress`).
2. `toGeometry` en un Web Worker (`src/core/voxel-worker.js`) y caché en IndexedDB.
3. `src/core/vox-loader.js` (lector MagicaVoxel `.vox`, sin dependencias; flags de material por índice de paleta).
4. `tools/lookdev.html` y `tools/lookdev-shots.mjs` (diorama fijo, `?hour`, `?render=classic|photo`).

## Reglas para cada sesión
- Pasado el 40 % de contexto: commit WIP, anotar acá dónde quedó y terminar; el orquestador abre una sesión nueva
  ("fresh").
- Textos por `t()` (i18n); español rioplatense. Sin build ni dependencias en tiempo de ejecución.
- GPU RTX 3060 Ti: tope de 60 FPS, corridas cortas, parar a 70 °C o 100 W. Las capturas con `smoke.mjs` usan
  SwiftShader (CPU).
- El checkout principal es compartido: stagear los archivos por nombre, nunca `git add -u`. `npm run bump` antes de
  cada commit que cambie archivos del juego.
- PushNotification al terminar un paso, en cada handoff y al quedar bloqueado.
