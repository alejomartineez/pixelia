// Publica una versión del juego de PC: crea el tag vN (N = VERSION de sw.js, la que sube `npm run bump`) y lo sube.
// GitHub Actions (.github/workflows/desktop.yml) compila Windows y macOS y arma un borrador de release con el
// actualizador; después se publica el borrador desde GitHub (o con `gh release edit vN --draft=false`).
//   node release.mjs            → tag + push
//   node release.mjs --dry      → solo dice qué haría
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8' }).trim();
const n = Number((readFileSync(join(ROOT, 'sw.js'), 'utf8').match(/const VERSION = 'pixelia-v(\d+)';/) || [])[1]);
if (!n) { console.error('No encontré VERSION en sw.js'); process.exit(1); }
const tag = `v${n}`;
const conf = JSON.parse(readFileSync(join(ROOT, 'desktop/src-tauri/tauri.conf.json'), 'utf8'));
if (conf.version !== `0.${n}.0`) { console.error(`tauri.conf.json dice ${conf.version} y sw.js dice ${n}: corré npm run bump`); process.exit(1); }
const dirty = sh('git status --porcelain --untracked-files=no');
if (dirty) { console.error('Hay cambios sin commitear:\n' + dirty); process.exit(1); }
if (sh(`git tag -l ${tag}`)) { console.error(`El tag ${tag} ya existe: subí la versión con npm run bump`); process.exit(1); }
if (process.argv.includes('--dry')) { console.log(`Crearía y subiría ${tag}`); process.exit(0); }
sh(`git tag -a ${tag} -m "Pixelia ${tag}"`);
sh(`git push origin ${tag}`);
console.log(`${tag} subido: GitHub Actions compila los instaladores (pestaña Actions) y deja el release en borrador.`);
