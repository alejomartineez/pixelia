# Pixelia "maqueta fotografiada": render físico, cámara de cine y los primeros minutos primero (solo Windows)

## Contexto
El usuario quiere que Pixelia se vea pulido y fotográfico, como **una maqueta real fotografiada** (punto medio entre
Town to City y Teardown, sin perder lo cozy), y que eso impacte primero en los **primeros minutos de juego**.
Decisiones tomadas:
- Render **"Teardown liviano"** sobre three.js en Tauri; WebGL2 primero, con los datos pensados para pasar a WebGPU después.
- **Solo Windows** (WebView2) por ahora; la web y Mac, después, con el render clásico como respaldo.
- **Modelos con más densidad, por etapas**, empezando por lo que se ve en los primeros minutos.
- Las cuatro **viñetas 2D de El Quiebre** (la Orden, el robo, la caída, la Cofradía) **siguen en 2D**: solo se
  ajustan para que el pase entre 2D y 3D quede prolijo (mismo grano, misma temperatura de color y fundido).
- Hecho y sin commit: el posproceso de la Fase A (bloom, curva de tonos, split-toning, viñeteado, DOF por plano) en
  `src/core/voxel.js`, `settings.js`, `ambience-fx.js`, `src/cinema/player.js` e `intro.js`; falta `npm test`.
  `src/combat/` lo trabaja otra sesión (`local_8559c03b`): integrarla antes de tocar el combate.

## Etapa 0: base (rendimiento y producción)
1. Cerrar la Fase A: `npm test`, `npm run bump` y commit, stageando los archivos por nombre.
2. **Greedy meshing** en `Voxels.toGeometry`, respetando colores y oclusión.
3. **Mallas en segundo plano**: `toGeometry` en un Web Worker (`src/core/voxel-worker.js`) más un caché en IndexedDB.
4. **Importar MagicaVoxel `.vox`**: `src/core/vox-loader.js` (sin dependencias) arma un `Voxels` con paleta y flags
   de material por índice (emisivo, metal, vidrio, agua, rugosidad). Los modelos nuevos van en `assets/models/`.
5. **Diorama de prueba** `tools/lookdev.html` (casa, farol, agua, árbol, personaje, acantilado) con
   `?hour`, `?render=classic|photo` y cámara de cine, más `tools/lookdev-shots.mjs` → `shots/lookdev/`.

## Etapa 1: render fotográfico (`src/core/voxel.js` y módulo nuevo `src/core/voxel-light.js`)
- **Cadena en HDR**: el target de la escena pasa a float16. Luz en unidades físicas, **exposición** (con adaptación
  suave en las cinemáticas) y mapeo de tonos **AgX**. El bloom de la Fase A pasa a trabajar sobre HDR real: las luces
  brillan por encima de 1, no por umbral de color.
- **Volumen 3D por escena** (RGBA8 con mipmaps, color + ocupación, una celda cada 2 vóxeles), armado desde las grillas
  `Voxels` y actualizado por zonas. Permite:
  - **Sombra del sol con rayos** y penumbra física (más blanda cuanto más lejos del objeto que la proyecta).
  - **Oclusión ambiental** con 4 a 6 rayos cortos.
  - **Un rebote de luz** (GI de 1 salto): pocos rayos difusos que leen color y luz del volumen, de modo que la pared
    roja tiñe el piso.
  - **Reflejos con rayos** en el agua y el vidrio (con fallback al reflejo del cielo).
  - **Sombras con rayos de las luces puntuales cercanas** (hasta unas 8 por cuadro: faroles, fuego, vetas), para
    que cada farol pinte su charco de luz con sombra.
- **Material PBR por vóxel** (rugosidad, metal, emisión, vidrio, agua) desde la paleta o el `.vox`; especular con
  cielo físico (PMREM desde `ambience.js`), luz de borde y microvariación con ruido coherente para que las
  superficies "tengan material".
- **Cielo físico** (dispersión simple) que manda la luz de cielo y del sol según `ambience.js`.
- **Lente de maqueta**: desenfoque de profundidad con bokeh (de una a dos pasadas a media resolución), foco
  automático en lo que se mira, grano de película leve, aberración cromática muy suave en los bordes, viñeteado
  físico y destello de lente sutil en el sol y las luces fuertes. Todo por escena, con más intensidad en el cine.
- **Niebla volumétrica y rayos de luz** a baja resolución usando la sombra del volumen.
- **Costo**: los rayos se calculan a media resolución con upsample bilateral y acumulación temporal (**TAA** con
  reproyección). Tope de 60 FPS; la calidad baja usa el render clásico. Presupuesto alto en escenas chicas
  (cinemáticas, elección de personaje, llegada) y medio en la ciudad.

## Etapa 2: cámara de cine (`src/cinema/timeline.js`, `player.js`, `poses.js`)
- Lente por plano (`lens: mm`), cambio de foco (`focusOn: objeto` o claves), cámara en mano con ruido suave (se apaga
  con "reducir movimiento"), encuadre por tercios (`frame(subject, { thirds, size })`), plano/contraplano, dolly,
  paneo, grúa y dolly zoom con aceleración y frenado suaves.
- Fundido de cámara juego ↔ escena sin corte, para las llegadas y las escenas de historia en la ciudad.
- Luz de tres puntos por plano (clave, relleno, borde) con luces físicas.

## Etapa 3: los primeros minutos, escena por escena (el corazón de este plan)
Recorrido de referencia: `shots/recorrido/` 01 a 46. Cada escena se rehace con modelos `.vox` de densidad nueva
(16 vóxeles por tile; 32 en objetos protagonistas de primer plano), la luz nueva y la cámara nueva:
1. **Logo y splash**: un plano 3D corto en el render nuevo detrás del logo (luz de amanecer sobre la isla).
2. **El Quiebre** (`src/scenes/intro.js`): decorados 3D `world`, `towers`, `rise` y `frag` remodelados (el corte de
   la tierra con estratos con textura y vetas emisivas que tiñen la roca), cámara nueva y luz de tres puntos.
   Las viñetas 2D quedan, con transición cuidada.
3. **Elección de personaje, clase y nombre** (`onboarding.js`, `wardrobe.js`): estudio de foto (pedestal de
   madera, luz clave cálida y borde frío, bokeh de fondo) y personajes revisados en la densidad nueva.
4. **Llegada con Vera** (las 4 escenas de llegada): de noche, con el esquife de Vera y el farol tiñendo la cabaña,
   cámara que baja hasta el juego con fundido de cámara.
5. **Primeros minutos en la ciudad**: terreno inicial, cabaña, primera Casa (época Madera), obra en curso y huerta,
   en la densidad nueva.
6. **Primera expedición y primer combate**: tablero, bosque y lobos (combate, después de integrar la sesión de la
   Bestia).
Criterio por escena: capturas antes y después, revisión cuadro a cuadro (nada superpuesto ni ilegible, nada de cubos
sueltos) y FPS medido en el juego de PC.

## Etapa 4: el resto del juego, por etapas
Las demás épocas de la ciudad, regiones de expedición, enemigos y llegadas a islas, con la misma regla de densidad
(documentada en DESIGN.md, sección de arte) y los mismos materiales.

## Qué esperar
- En las escenas de los primeros minutos (chicas y con presupuesto alto), cerca del nivel de Town to City y con buena
  parte del realismo de Teardown. Lo que falta: GI de varios saltos y sombras con rayos de todas las luces a la vez.
- En la ciudad grande, algo por debajo: por presupuesto se reducen los rayos, el rebote y la cantidad de luces con sombra.
- Riesgos: el mantenimiento del render propio (probar en GPUs Intel y AMD antes de publicar), la carga de la GPU
  (media resolución, TAA y tope de 60) y el tiempo de modelado (por eso `.vox`).
- Si el diorama de la Etapa 0 y la Etapa 1 no llega al nivel buscado, se reevalúa Unreal 5 con evidencia.

## Verificación
- Cada paso: capturas antes y después (diorama y escenas reales; día, atardecer, noche) enviadas con SendUserFile, y
  revisión cuadro a cuadro de las cinemáticas con `tools/cinema.html?view=strip`.
- `npm test` completo, más `test-stress` (FPS, vértices y tiempo de armado con la ciudad llena).
- FPS y temperatura en el juego de PC (`npm run desktop:dev`), en corridas cortas: parar a 70 °C o 100 W.
- `node test-desktop.mjs` con el `.exe` antes de publicar; `npm run bump` antes de cada commit; stagear los
  archivos por nombre.
- Trabajo largo: pasado el 40 % de contexto, seguir en una sesión nueva con el estado anotado en el HANDOFF.
