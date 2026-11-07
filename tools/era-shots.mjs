// Grillas de capturas por época (Fase 4): para cada edificio clave, una imagen con las 5 épocas (filas) × los niveles
// (columnas), y la Municipalidad con sus 8 niveles. Usa tools/gallery.html vía gallery-shot.mjs.
//
//   node tools/era-shots.mjs [carpeta] [--ids casita,panaderia] [--levels 1,2,3,4,5] [--theme pueblo]
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const out = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(HERE, '..', 'shots', 'eras'));
mkdirSync(out, { recursive: true });
const DEFAULT = ['casita', 'cabana', 'chalet', 'torre_cristal', 'mansion', 'panaderia', 'heladeria', 'floreria', 'cafeteria', 'salon', 'pasteleria', 'boutique', 'cine', 'spa', 'rueda', 'teatro'];
const ids = (opt('ids', '') || DEFAULT.join(',')).split(',').filter(Boolean);
const levels = opt('levels', '1,2,3,4,5');
const theme = opt('theme', '');
const th = theme ? `&theme=${theme}` : '';
let fail = 0;
const shot = (query, file, w, h) => {
  const r = spawnSync(process.execPath, [join(HERE, 'gallery-shot.mjs'), query, join(out, file), String(w), String(h), '700'], { encoding: 'utf8' });
  const ok = r.status === 0;
  if (!ok) { fail++; console.log(r.stdout.split('\n').filter(l => /ERR|error/i.test(l)).join('\n')); }
  console.log(ok ? 'ok ' : 'ERR', file);
};
if (!opt('ids', '')) shot(`ids=castillo&levels=1,2,3,4,5,6,7,8&cols=4${th}`, `castillo${theme ? '-' + theme : ''}.png`, 1600, 900);
const n = levels.split(',').length;
for (const id of ids) shot(`ids=${id}&eras=1,2,3,4,5&levels=${levels}&cols=${n}${th}`, `${id}${theme ? '-' + theme : ''}.png`, 260 * n, 1300);
console.log('carpeta:', out);
process.exit(fail ? 1 : 0);
