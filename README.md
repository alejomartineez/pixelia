# Pixelia · Tu ciudad, tu estilo 👑

Juego de construir tu ciudad a tu estilo en **3D pixel art**: la ciudad es la base para salir de **expedición** (por turnos,
ratos cortos) y aguantar las **amenazas** de cada temporada; los edificios cambian de **época** a medida que crece.
Es un juego de PC para Windows y macOS, con mouse y teclado. La versión web sigue andando en el navegador.

Al empezar elegís tu personaje (chica, chico o un animalito), tu nombre, el de tu
ciudad y su estilo (pastel, moderna, bosque, playa, invierno o noche). Todo se puede cambiar después desde el Vestidor
y Ajustes.

Es 100% estático: HTML + JavaScript, sin servidor ni base de datos. El progreso se guarda en el navegador
(y se puede exportar/importar con un código desde Ajustes).

## Juego de PC (Windows y macOS)
Pixelia se juega como app de escritorio, hecha con [Tauri](https://tauri.app). El juego sigue en JavaScript y sin compilar,
y `desktop/` solo lo empaqueta. La versión web sigue publicada en GitHub Pages, pero ya no se cuida para el celular.

**Instalar.** Bajá el instalador del último [release](https://github.com/alejomartineez/pixelia/releases/latest):
`Pixelia_x.y.z_x64-setup.exe` en Windows o `Pixelia_x.y.z_universal.dmg` en Mac. Después se actualiza sola. Las apps
todavía no están firmadas:
- **Windows**: si sale "Windows protegió su PC", tocá **Más información → Ejecutar de todas formas**.
- **Mac**: la primera vez, hacé **clic derecho en Pixelia → Abrir → Abrir**. Si dice que "está dañada", corré en la
  Terminal `xattr -cr /Applications/Pixelia.app`.

**Pasar la partida de la web.** Usá la cuenta online o, en Ajustes, *Exportar* en la web e *Importar* en la app.

**Compilar** (desde `tools/`):
- La primera vez necesitás [Rust](https://rustup.rs) y, en Windows, las Build Tools de Visual Studio con C++.
- `npm run desktop:dev` abre una ventana con el juego en vivo, usando el servidor local.
- `npm run desktop:build` arma el instalador de Windows en `desktop/src-tauri/target/release/bundle/nsis/`.
- `node test-desktop.mjs` abre ese `.exe` y revisa que arranque bien: Tauri, guardado y online.
- `npm run release` crea y sube el tag `vN`. GitHub Actions compila Windows y Mac y deja el release en borrador, con el
  archivo del actualizador. La clave del actualizador está en los secrets del repo (`TAURI_SIGNING_PRIVATE_KEY`) y la
  copia local, en `~/.tauri/`. Nunca va al repo.
- En Actions → *desktop* → *Run workflow*, la ejecución manual compila Windows y Mac y deja capturas de la app abierta
  en macOS, para probar Mac sin tener una.

## Probar en la PC

```bash
cd tools
npm install        # solo la primera vez (Chrome headless y PGlite para las pruebas)
npm run serve      # http://127.0.0.1:5173/  ·  npm run serve:lan para abrirlo desde el celu
```

Cualquier otro servidor estático también sirve (por ejemplo `npx serve .`). Pruebas: `npm test`. (Abrir `index.html` con doble clic no funciona: los módulos JS necesitan http.)

Atajos para probar: `?cheat=15` (monedas, gemas y nivel 15), `?reset` (borra la partida), `?scene=expedition` (abre una escena directo).

## Hostear gratis

### Opción A — GitHub Pages
1. Crear un repo en GitHub y subir esta carpeta (sin `tools/node_modules`).
2. Settings → Pages → *Deploy from a branch* → rama `main`, carpeta `/ (root)`.
3. Queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

### Opción B — Netlify Drop (sin cuenta de GitHub)
Entrá a https://app.netlify.com/drop y arrastrá la carpeta. Te da una URL al toque.

### Opción C — Cloudflare Pages
Workers & Pages → Create → Pages → *Upload assets* → subir la carpeta.

## Online (cuentas, amigos, visitas)
Usa el proyecto de Supabase **Pixelia** (gratis), ya configurado en `src/online/config.js`
(URL y clave *publishable*, que es pública a propósito; la seguridad la dan las reglas de `supabase/schema.sql`).
- Las cuentas se crean con email y contraseña, sin email de confirmación.
- Si cambiás `supabase/schema.sql`, volvé a correrlo entero en el SQL Editor del proyecto.
- `node tools/test-live.mjs` prueba el servidor real con dos cuentas nuevas `@example.com`
  (quedan en Authentication → Users; se pueden borrar desde ahí).
- Sin servidor: `?mock=1&mockuser=ana` (y otra pestaña con `mockuser=bea`).
- Cuando lo publiques, en Authentication → URL Configuration poné la dirección del juego como *Site URL*.

## Instalar en el iPhone
1. Abrir la URL en **Safari**.
2. Botón **Compartir** → **Agregar a inicio**.
3. Se abre a pantalla completa como una app y funciona sin internet.

## Actualizar
Después de cambiar archivos, corré `node tools/gen-sw-core.mjs --bump` (regenera la lista de archivos de `sw.js` y sube `VERSION`) para que los iPhone bajen la versión nueva.

## Estructura
Ver [DESIGN.md](DESIGN.md).
