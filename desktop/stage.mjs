// Copia el juego (tal cual, sin compilar) a desktop/dist para que Tauri lo empaquete.
// Solo lo que el juego usa: nada de tools/, docs/, supabase/ ni sw.js (en el .exe los archivos ya son locales).
import { cpSync, rmSync, mkdirSync, existsSync, utimesSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(HERE, 'dist');
const ITEMS = ['index.html', 'styles.css', 'manifest.webmanifest', 'src', 'vendor', 'fonts', 'icons', 'assets'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const it of ITEMS) {
  const from = join(ROOT, it);
  if (!existsSync(from)) throw new Error(`Falta ${it}`);
  cpSync(from, join(OUT, it), { recursive: true });
}
// cargo no siempre nota que cambió dist/: tocar lib.rs obliga a volver a embeber los archivos del juego
const now = new Date();
utimesSync(join(HERE, 'src-tauri/src/lib.rs'), now, now);
console.log(`stage: ${ITEMS.length} entradas copiadas a desktop/dist`);
