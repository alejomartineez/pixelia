# Pixelia · Tu ciudad, tu estilo 👑

Juego de construir tu ciudad a tu estilo en **3D pixel art**, con minijuegos:
**Joyas Reales** (combiná 3), **Bloques Mágicos** (encastrar bloques), **Estacionamiento Real** y **Paseo Real** (manejar).
Funciona en iPhone (instalable como app, offline) y en PC (mouse + teclado).

Al empezar elegís tu personaje (princesa, príncipe, chica, chico, hada, mago o un animalito), tu nombre, el de tu
ciudad y su estilo (pastel, moderna, bosque, playa, invierno o noche). Todo se puede cambiar después desde el Vestidor
y Ajustes.

Es 100% estático: HTML + JavaScript, sin servidor ni base de datos. El progreso se guarda en el navegador
(y se puede exportar/importar con un código desde Ajustes).

## Probar en la PC

```bash
cd tools
npm install        # solo la primera vez (Chrome headless y PGlite para las pruebas)
npm run serve      # http://127.0.0.1:5173/  ·  npm run serve:lan para abrirlo desde el celu
```

Cualquier otro servidor estático también sirve (por ejemplo `npx serve .`). Pruebas: `npm test`. (Abrir `index.html` con doble clic no funciona: los módulos JS necesitan http.)

Atajos para probar: `?cheat=15` (monedas, gemas y nivel 15), `?reset` (borra la partida), `?scene=match3` (abre una escena directo).

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
