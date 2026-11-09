// Regenera la lista CORE de sw.js con TODOS los archivos reales (src/**/*.js, vendor, fuentes, íconos)
// y, con --bump, sube VERSION (pixelia-vN → pixelia-vN+1). También avisa si index.html o el código
// importan un .js que no existe.
//
//   node tools/gen-sw-core.mjs            (solo regenera CORE)
//   node tools/gen-sw-core.mjs --bump     (regenera CORE y sube VERSION)
//   node tools/gen-sw-core.mjs --check    (no escribe: sale con 1 si CORE no coincide con los archivos)
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const walk = (dir) => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const rel = (p) => './' + relative(ROOT, p).split('\\').join('/');
const list = (dir, re) => existsSync(join(ROOT, dir)) ? walk(join(ROOT, dir)).filter(f => re.test(f)).map(rel).sort() : [];

const src = list('src', /\.js$/);
const files = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  ...list('vendor', /\.js$/), ...list('fonts', /\.(woff2?|ttf)$/), ...list('icons', /\.(png|svg)$/),
  ...list('assets', /\.(m4a|json)$/),   // sonidos (DESIGN-AUDIO.md)
  './src/main.js', ...src.filter(f => f !== './src/main.js'),
];

// imports rotos: import ... from './x.js' / import('./x.js') que no existen
const broken = [];
for (const f of src) {
  const code = readFileSync(join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');   // sin comentarios
  for (const m of code.matchAll(/(?:from\s+|import\s*\(\s*)['"](\.{1,2}\/[^'"]+\.js)['"]/g)) {
    const target = posix.normalize(posix.join(posix.dirname(f), m[1]));
    if (!existsSync(join(ROOT, target))) broken.push(`${f} → ${m[1]}`);
  }
}

const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const start = sw.indexOf('const CORE = [');
const end = sw.indexOf('];', start);
if (start < 0 || end < 0) { console.error('No encontré "const CORE = [" … "];" en sw.js'); process.exit(2); }
const current = [...sw.slice(start, end).matchAll(/'([^']+)'/g)].map(m => m[1]);
const missing = files.filter(f => !current.includes(f));
const extra = current.filter(f => !files.includes(f));

// agrupado por carpeta, ~5 por línea
const lines = [];
const groups = new Map();
for (const f of files) { const k = f.startsWith('./src/') ? posix.dirname(f) : '_'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
for (const [, g] of groups) for (let i = 0; i < g.length; i += 5) lines.push('  ' + g.slice(i, i + 5).map(f => `'${f}'`).join(', ') + ',');
const block = 'const CORE = [\n' + lines.join('\n') + '\n';

console.log(`CORE: ${files.length} archivos (${src.length} .js en src)`);
if (missing.length) console.log('Faltaban en CORE:\n  ' + missing.join('\n  '));
if (extra.length) console.log('Sobraban en CORE (no existen):\n  ' + extra.join('\n  '));
if (broken.length) console.log('Imports a archivos que no existen:\n  ' + broken.join('\n  '));

if (args.includes('--check')) process.exit(missing.length || extra.length || broken.length ? 1 : 0);

let out = sw.slice(0, start) + block + sw.slice(end);
if (args.includes('--bump')) {
  out = out.replace(/const VERSION = 'pixelia-v(\d+)';/, (_, n) => { console.log(`VERSION pixelia-v${n} → pixelia-v${+n + 1}`); return `const VERSION = 'pixelia-v${+n + 1}';`; });
}
if (out !== sw) { writeFileSync(join(ROOT, 'sw.js'), out); console.log('sw.js actualizado'); } else console.log('sw.js ya estaba al día');
// el juego de PC (desktop/) lleva la misma versión: pixelia-vN → 0.N.0 (semver, la compara el actualizador)
syncDesktop(Number((out.match(/const VERSION = 'pixelia-v(\d+)';/) || [])[1]));
process.exit(broken.length ? 1 : 0);

function syncDesktop(n) {
  if (!n) return;
  const ver = `0.${n}.0`;
  const targets = [
    ['desktop/package.json', /("version":\s*")[^"]+(")/],
    ['desktop/src-tauri/tauri.conf.json', /("version":\s*")[^"]+(")/],
    ['desktop/src-tauri/Cargo.toml', /^(version = ")[^"]+(")/m],
  ];
  for (const [f, re] of targets) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    const txt = readFileSync(p, 'utf8');
    const next = txt.replace(re, `$1${ver}$2`);
    if (next !== txt) { writeFileSync(p, next); console.log(`${f} → ${ver}`); }
  }
}
