# HANDOFF: Pixelia "maqueta fotografiada"

Plan: [PLAN-FOTO.md](PLAN-FOTO.md). Objetivo: un render físico estilo "maqueta fotografiada" (Town to City +
Teardown liviano), una cámara de cine y los primeros minutos de juego rehechos primero. Solo Windows por ahora.

## Estado (2026-11-10: Fase A y Etapa 0 hechas)

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

### Hecho: Etapa 0, base (rendimiento y herramientas)
- **Mallado** en `src/core/voxel-mesh.js` (sin three.js; lo comparten el hilo principal y el worker). `Voxels.toGeometry`
  y el `meshAO` de `src/city/models.js` (ahora `toGeometry({ aoLevels })`) pasan por `meshPacked`.
  - **Greedy meshing**: une caras coplanares con el mismo color final (ya con el jitter) y la misma oclusión en las 4
    esquinas. Las uniones en T se cierran: si el borde de un rectángulo unido pasa por la esquina de otro, se agrega
    ese vértice y el rectángulo se dibuja en abanico (sin eso quedaban agujeritos de un pixel).
    `?greedy=0` o `setGreedy(false)` lo apagan; `meshStats` cuenta mallas, caras, vértices y ms.
  - **Medido con `test-stress`** (1350 modelos de edificio × nivel × época, 4601 mallas): vértices 11,85 M → 11,19 M
    (**6 % menos**); en el diorama, 5 % menos. Es poco porque el arte de hoy varía el brillo de cada vóxel (jitter) y
    la oclusión cambia por esquina: casi no hay caras iguales pegadas. En superficies lisas une todo (una losa de
    16×16: 2304 → 24 vértices). **El armado sí mejoró mucho**: la ocupación pasó de un `Map` con claves de texto a
    una grilla densa, y armar los 1350 modelos bajó de ~5,7 s a ~2,6 s (v62 contra esta rama, mismo Chrome headless).
  - Para que el greedy rinda de verdad en la Etapa 1: sacar el jitter de los colores por vértice y hacerlo en el
    shader (ruido por posición de mundo). Con color parejo, las paredes y los pisos se unen casi enteros.
- **Worker y caché**: `src/core/voxel-worker.js` (módulo ES) y `Voxels.toGeometryAsync(opts)` en `voxel.js`. Busca
  la malla en IndexedDB (`pixelia-mesh`, clave = `MESH_VERSION` + opciones + huella de la grilla; tope de 600 mallas),
  si no está la arma en el worker y la guarda. Sin worker o sin IndexedDB, la arma en el hilo principal.
  `clearMeshCache()` lo vacía; subir `MESH_VERSION` en `voxel-mesh.js` cuando cambie el mallado.
  **Todavía ninguna escena del juego usa la versión asíncrona** (la API sincrónica quedó igual): la usa el diorama con
  `?async=1`. Conviene pasarle primero el terreno de la ciudad y los decorados de El Quiebre.
- **MagicaVoxel**: `src/core/vox-loader.js` (`parseVox`, `voxToVoxels`, `loadVox`). Lee SIZE/XYZI/RGBA, MATL y la
  escena (nTRN/nGRP/nSHP: posición y giro de cada modelo). Pasa de z arriba a y arriba. Devuelve el `Voxels`, la paleta y
  `materials[índice] = { emissive, metal, glass, water, rough }` (agua = vidrio con ior 1,33, o por `opts.materials`),
  más `materialAt(x, y, z)` y `split(pred)` para separar capas (lo emisivo, el vidrio). Muestra:
  `assets/models/farol.vox`, que arma `tools/make-vox.mjs` (también sirve para escribir `.vox` de prueba).
  Cuando el juego cargue modelos `.vox`, sumar `vox` a la lista de `assets` en `tools/gen-sw-core.mjs` (hoy el service
  worker no los guarda; el juego de PC sí los copia, porque `desktop/stage.mjs` lleva `assets/` entero).
  No lee los `.vox` con varios cuadros de animación ni las capas (LAYR); no hicieron falta.
- **Diorama**: `tools/lookdev.html` (`?hour`, `?render=classic|photo`, `?post`, `?cam=iso|cine`, `?weather`,
  `?greedy`, `?async`, `?still`) y `tools/lookdev-shots.mjs` → `shots/lookdev/<cam>-h<hora>-<render>.png`.
  `photo` hoy es classic más la Fase A. `createPixelRenderer` acepta `post: false` para apagar el acabado en una escena.
  `node lookdev-shots.mjs --check` compara greedy contra sin greedy pixel a pixel y prueba el worker con su caché.
- **Pruebas nuevas en `npm test`**: `test-vox.mjs` (mallado y lector `.vox`, sin navegador), `lookdev-shots.mjs --check`
  y la sección "Mallas" de `test-stress.mjs`.
- De paso: `npm test` venía roto desde la v61 por el glosario (`settings.credits.music` en inglés decía "The Breaking"
  y el glosario fija "Fracture"). Corregido en `src/i18n/en.js`.

## Próximo paso: Etapa 1 (render fotográfico)
Ver PLAN-FOTO.md. Orden sugerido, siempre comparando contra `shots/lookdev/` (sacar la serie antes de tocar nada):
1. Target de la escena en float16, exposición y mapeo de tonos AgX; el bloom sobre HDR real (hoy va por umbral).
   `?render=photo` del diorama pasa a ser este camino y `classic` queda como respaldo.
2. `src/core/voxel-light.js`: volumen 3D por escena (color + ocupación) armado desde las grillas `Voxels`
   (`packVoxels` ya da los datos planos); sombra del sol y oclusión con rayos.
3. Materiales por vóxel desde los flags del `.vox` (emisivo, metal, vidrio, agua, rugosidad) y jitter en el shader.
4. Rebote de luz, reflejos, luces puntuales con sombra, niebla; TAA y media resolución para el costo.

## Reglas para cada sesión
- Pasado el 35 % de contexto: commit WIP, anotar acá dónde quedó y terminar; el orquestador abre una sesión nueva
  ("fresh").
- Textos por `t()` (i18n); español rioplatense. Sin build ni dependencias en tiempo de ejecución.
- GPU RTX 3060 Ti: tope de 60 FPS, corridas cortas, parar a 70 °C o 100 W. Las capturas con `smoke.mjs` usan
  SwiftShader (CPU).
- El checkout principal es compartido: stagear los archivos por nombre, nunca `git add -u`. `npm run bump` antes de
  cada commit que cambie archivos del juego.
- PushNotification al terminar un paso, en cada handoff y al quedar bloqueado.
