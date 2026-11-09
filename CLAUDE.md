# Pixelia

PWA de ciudad vóxel en 3D: la ciudad es la base para salir de **expedición** (roguelite corto por turnos que trae materiales
de región, planos, hallazgos y terreno) y para aguantar las **amenazas** de cada temporada (crecidas, incendios, tormentas…,
con resolución automática si no estás). Los edificios cambian por **épocas** (Madera → Piedra → Ladrillo → Hierro →
Vidrio y acero) según el rango. Además: rango con Encanto, monumentos, pase de temporada, personajes y temas, y
online (cuentas, contactos, visitas) con Supabase, y los **Hallazgos** (la colección que se encuentra explorando). Los 4
minijuegos de antes **se retiraron** en la Fase 5: sus edificios, materiales, potenciadores y el álbum se migran solos al
abrir una partida vieja (guardado v3, `migrateV3` en `src/core/state.js`, DESIGN-CORE.md §7.2). **Mi Casa** también
se retiró (La Travesía, paso 1c): el guardado v6 (`migrateV6`) devuelve lo gastado, pasa su Encanto a un bono fijo de la
ciudad y los trofeos a Logros, en el Diario de la Bitácora (`src/core/achievements.js`).
Para adultos que juegan ratos cortos. **Es un juego de PC para Windows y macOS, empaquetado con Tauri en `desktop/`.** La web de GitHub Pages sigue
publicada pero ya no se mantiene para celular. En marcha: historia "El Quiebre", combate táctico, guías y logo Dezings.
El plan está en [docs/PLAN-QUIEBRE.md](docs/PLAN-QUIEBRE.md) y el estado en [docs/HANDOFF-QUIEBRE.md](docs/HANDOFF-QUIEBRE.md). Textos en español rioplatense, tono cozy
adulto: cálido y sobrio, sin diminutivos (ver la Guía de tono de DESIGN.md).

- Ciclo nuevo (Expedición, Amenazas, Épocas, recursos, tutorial, migración v3, metas de balance y qué archivos toca cada
  fase): [DESIGN-CORE.md](DESIGN-CORE.md) · arquitectura, arte y guía de tono: [DESIGN.md](DESIGN.md) ·
  online: [DESIGN-ONLINE.md](DESIGN-ONLINE.md) · retención: [DESIGN-RETENTION.md](DESIGN-RETENTION.md) ·
  historia, Bitácora y guías (`src/story/`): [DESIGN-STORY.md](DESIGN-STORY.md) ·
  sonido y música (`src/audio/`, `assets/audio/`): [DESIGN-AUDIO.md](DESIGN-AUDIO.md) ·
  uso y hosting: [README.md](README.md).
- JavaScript con módulos ES, **sin build**: three.js y supabase-js están en `vendor/` (importmap en `index.html`).
  No agregar bundlers ni dependencias en tiempo de ejecución. Tauri (Rust) solo empaqueta y vive aparte, en `desktop/`:
  `desktop/stage.mjs` copia el juego tal cual a `desktop/dist`. `src/core/desktop.js` maneja lo propio de la app
  (`ctx.desktop`, pantalla completa y actualizaciones).
- Escenas: `create(ctx)` → `{ mount, unmount }`. 3D siempre con `createPixelRenderer` de `src/core/voxel.js`
  (vóxel nítido: 2× con antialias, oclusión ambiental y contorno tinta; nada de render a baja resolución);
  2D (íconos, tableros) en canvas de baja resolución sin suavizado.
- Guardado local: `localStorage` `pixelia.save.v1`.

## Comandos (desde `tools/`, la primera vez `npm install`)
- `npm run serve` → http://127.0.0.1:5173/ (`serve:lan` para abrirlo desde el celu en la misma Wi-Fi).
  También está la configuración `pixelia` en `.claude/launch.json` para la vista previa.
- `npm test` → e2e, migración v2→v3, colocación, stress, visitas, mock online, social, rango, obras, expedición,
  ciclo, amenazas, telemetría, ajustes, historia, ambiente, audio, combate y SQL (Chrome headless; tarda unos minutos).
- `node smoke.mjs --scene city --device desktop --dpr 1.25 --shot ../shots/x.png` → captura rápida de una escena.
- `npm run render:audio` → fragmentos `.wav` de cada lugar en `shots/audio/` (OfflineAudioContext, sin GPU).
- `npm run sim:economy` → simula 60 días de economía (2 ratos por día) y chequea las metas de DESIGN-CORE.md §8.
- `npm run desktop:dev` abre la ventana del juego de PC en vivo. `npm run desktop:build` arma el `.exe`, y
  `node test-desktop.mjs` lo abre y lo revisa por CDP.
- `npm run test:live` → prueba el Supabase real (crea dos cuentas `@example.com`).
- Atajos de URL: `?cheat=15`, `?reset`, `?scene=expedition` (o `wardrobe`), `?mock=1&mockuser=ana`, `?outline=0|1`, `?quality=low|high`,
  `?hour=21.5` y `?weather=tormenta` (ambiente: hora y clima, `src/core/ambience.js`).
- Ajustes: `src/core/settings.js` (`setSetting(patch)` guarda, aplica en vivo y emite `settings:changed`); los gráficos
  llegan a todos los renderers con `setGraphics` de `voxel.js` y las teclas salen de `src/core/keys.js`. `?quality`,
  `?outline` y `?fps=N` mandan sobre los Ajustes.

## Publicar
GitHub Pages desde `master` (raíz) en https://alejomartineez.github.io/pixelia/ (repo `alejomartineez/pixelia`).
Antes de cada commit que cambie archivos del juego: `npm run bump`. Regenera `sw.js`, sube `VERSION` y sincroniza la
versión de `desktop/` (`pixelia-vN` pasa a `0.N.0`).
Publicar la web = commit + push. Publicar el juego de PC = `npm run release`: crea el tag `vN`, Actions compila Windows y
Mac y deja el release en borrador. Después se publica con `gh release edit vN --draft=false`.

## Online
Supabase proyecto **Pixelia** (no tocar el otro proyecto de la cuenta). `src/online/config.js` lleva la URL y la
clave *publishable*, que es pública; la seguridad son las reglas de `supabase/schema.sql`. Nunca usar la clave
`service_role`/secret. Si cambia `schema.sql`, hay que correrlo entero en el SQL Editor del proyecto.
