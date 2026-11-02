# Pixelia · Ciudad de Princesas 👑

Juego de construir tu ciudad de princesas en **3D pixel art**, con minijuegos:
**Joyas Reales** (combiná 3), **Bloques Mágicos** (encastrar bloques), **Estacionamiento Real** y **Paseo Real** (manejar).
Funciona en iPhone (instalable como app, offline) y en PC (mouse + teclado).

Es 100% estático: HTML + JavaScript, sin servidor ni base de datos. El progreso se guarda en el navegador
(y se puede exportar/importar con un código desde Ajustes).

## Probar en la PC

Cualquier servidor estático sirve, por ejemplo:

```bash
npx serve .
```

y abrí la dirección que muestra. (Abrir `index.html` con doble clic no funciona: los módulos JS necesitan http.)

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

## Instalar en el iPhone
1. Abrir la URL en **Safari**.
2. Botón **Compartir** → **Agregar a inicio**.
3. Se abre a pantalla completa como una app y funciona sin internet.

## Actualizar
Después de cambiar archivos, subí `VERSION` en `sw.js` (por ejemplo `pixelia-v2`) para que los iPhone bajen la versión nueva.

## Estructura
Ver [DESIGN.md](DESIGN.md).
