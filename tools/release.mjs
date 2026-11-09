// Publica una versión del juego de PC: crea el tag vN (N = VERSION de sw.js, la que sube `npm run bump`) y lo sube.
// GitHub Actions (.github/workflows/desktop.yml) compila Windows y macOS y arma un borrador de release con el
// actualizador; después se publica el borrador desde GitHub (o con `gh release edit vN --draft=false`).
//   node release.mjs            → revisa todo, crea el tag y lo sube (lo corre el usuario: publicar es decisión suya)
//   node release.mjs --dry      → solo revisa y dice qué haría (npm run release:check); no crea nada
// Antes de crear el tag revisa (paso 7):
//   - la rama es master, sin cambios sin commitear y al día con origin/master (ni adelante ni atrás);
//   - sw.js, desktop/package.json, tauri.conf.json y Cargo.toml dicen la misma versión (0.N.0);
//   - el tag vN no existe ni en local ni en GitHub;
//   - el workflow escucha los tags v* y tauri.conf.json tiene la clave pública del actualizador.
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const problems = [], notes = [];
const fail = (m) => problems.push(m);

const n = Number((read('sw.js').match(/const VERSION = 'pixelia-v(\d+)';/) || [])[1]);
if (!n) { console.error('No encontré VERSION en sw.js'); process.exit(1); }
const tag = `v${n}`, ver = `0.${n}.0`;

// versiones
const conf = JSON.parse(read('desktop/src-tauri/tauri.conf.json'));
if (conf.version !== ver) fail(`tauri.conf.json dice ${conf.version} y sw.js dice ${n}: corré npm run bump`);
const pkg = JSON.parse(read('desktop/package.json'));
if (pkg.version !== ver) fail(`desktop/package.json dice ${pkg.version} (tendría que ser ${ver}): corré npm run bump`);
const cargo = (read('desktop/src-tauri/Cargo.toml').match(/^version\s*=\s*"([^"]+)"/m) || [])[1];
if (cargo !== ver) fail(`Cargo.toml dice ${cargo} (tendría que ser ${ver}): corré npm run bump`);
// actualizador y workflow
if (!conf.plugins?.updater?.pubkey) fail('tauri.conf.json no tiene la clave pública del actualizador (plugins.updater.pubkey)');
const wf = '.github/workflows/desktop.yml';
if (!existsSync(join(ROOT, wf))) fail(`falta ${wf}`);
else if (!/tags:\s*\[\s*'v\*'\s*\]/.test(read(wf))) fail(`${wf} no escucha los tags v*`);
// git
try {
  const branch = sh('git rev-parse --abbrev-ref HEAD');
  if (branch !== 'master') fail(`la rama es ${branch}: el release sale de master`);
  const dirty = sh('git status --porcelain --untracked-files=no');
  if (dirty) fail('hay cambios sin commitear:\n' + dirty);
  try {
    sh('git fetch -q origin master');
    const [ahead, behind] = sh('git rev-list --left-right --count HEAD...origin/master').split(/\s+/).map(Number);
    if (ahead) fail(`hay ${ahead} commit(s) sin subir: git push`);
    if (behind) fail(`faltan ${behind} commit(s) de origin/master: git pull`);
  } catch { notes.push('no se pudo comparar con origin/master (¿sin conexión?)'); }
  if (sh(`git tag -l ${tag}`)) fail(`el tag ${tag} ya existe en local: subí la versión con npm run bump`);
  try { if (sh(`git ls-remote --tags origin refs/tags/${tag}`)) fail(`el tag ${tag} ya existe en GitHub`); } catch { notes.push('no se pudo mirar los tags de GitHub'); }
} catch (e) { fail('git: ' + (e.stderr || e.message)); }

for (const m of notes) console.log('· ' + m);
if (problems.length) {
  console.error(`No se puede publicar ${tag}:`);
  for (const m of problems) console.error('  ✘ ' + m);
  process.exit(1);
}
if (DRY) { console.log(`✔ Todo listo: npm run release crearía y subiría ${tag} (${ver}). Después: gh release edit ${tag} --draft=false`); process.exit(0); }
sh(`git tag -a ${tag} -m "Pixelia ${tag}"`);
sh(`git push origin ${tag}`);
console.log(`${tag} subido: GitHub Actions compila los instaladores (pestaña Actions) y deja el release en borrador.`);
console.log(`Para publicarlo: gh release edit ${tag} --draft=false`);
