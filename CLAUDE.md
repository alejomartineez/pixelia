# Pixelia

PWA de ciudad en 3D pixel art con minijuegos (Joyas Brillantes, Bloques Pixel, Estacionamiento Express, Ruta Pixel),
cofres, pase de temporada, personajes y temas de ciudad, y online (cuentas, amigos, visitas) con Supabase.
Para iPhone (instalable, offline) y PC. Textos del juego en español rioplatense, tono amable.

- Arquitectura y reglas de arte: [DESIGN.md](DESIGN.md) · online: [DESIGN-ONLINE.md](DESIGN-ONLINE.md) ·
  retención: [DESIGN-RETENTION.md](DESIGN-RETENTION.md) · uso y hosting: [README.md](README.md).
- JavaScript con módulos ES, **sin build**: three.js y supabase-js están en `vendor/` (importmap en `index.html`).
  No agregar bundlers ni dependencias en tiempo de ejecución.
- Escenas: `create(ctx)` → `{ mount, unmount }`. 3D siempre con `createPixelRenderer` de `src/core/voxel.js`
  (vóxel nítido: 2× con antialias, oclusión ambiental y contorno tinta; nada de render a baja resolución);
  2D (íconos, tableros) en canvas de baja resolución sin suavizado.
- Guardado local: `localStorage` `pixelia.save.v1`.

## Comandos (desde `tools/`, la primera vez `npm install`)
- `npm run serve` → http://127.0.0.1:5173/ (`serve:lan` para abrirlo desde el celu en la misma Wi-Fi).
  También está la configuración `pixelia` en `.claude/launch.json` para la vista previa.
- `npm test` → e2e, stress, visitas, mock online, social y SQL (Chrome headless; tarda unos minutos).
- `node smoke.mjs --scene parking --device desktop --dpr 1.25 --shot ../shots/x.png` → captura rápida de una escena.
- `npm run test:live` → prueba el Supabase real (crea dos cuentas `@example.com`).
- Atajos de URL: `?cheat=15`, `?reset`, `?scene=match3`, `?mock=1&mockuser=ana`, `?outline=0|1`, `?quality=low|high`.

## Publicar
GitHub Pages desde `master` (raíz) en https://alejomartineez.github.io/pixelia/ (repo `alejomartineez/pixelia`).
Antes de cada commit que cambie archivos del juego: `npm run bump` (regenera `sw.js` y sube `VERSION`),
si no los iPhone instalados siguen con la versión vieja. Publicar = commit + push.

## Online
Supabase proyecto **Pixelia** (no tocar el otro proyecto de la cuenta). `src/online/config.js` lleva la URL y la
clave *publishable*, que es pública; la seguridad son las reglas de `supabase/schema.sql`. Nunca usar la clave
`service_role`/secret. Si cambia `schema.sql`, hay que correrlo entero en el SQL Editor del proyecto.
