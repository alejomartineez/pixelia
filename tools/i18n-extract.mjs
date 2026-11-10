// Lo que falta traducir, por carpeta y por idioma (paso 4b-0). Sirve para repartir el 4b.
//
//   node tools/i18n-extract.mjs                 → escribe docs/i18n/pendiente.md
//   node tools/i18n-extract.mjs --json out.json → además, el detalle completo (cada texto con archivo y línea)
//   node tools/i18n-extract.mjs --stdout        → el informe por consola, sin escribir nada
//
// Dos partes:
//   1. Claves de src/i18n/es.js que faltan en cada idioma. Cada clave se atribuye a la carpeta de src/ que la usa:
//      la clave escrita entera ('hud.zarpar') o un prefijo que el código completa ('city.look.cycle.' + n).
//   2. Texto escrito directo en src/ (fuera de src/i18n/) que todavía no pasa por t(): literales con tilde, ñ, ¿ o ¡,
//      o frases de dos palabras o más que empiezan con mayúscula. Se descartan comentarios, console.*, claves, rutas,
//      CSS, selectores y colores. Es una estimación (algún falso positivo queda): sirve para medir y repartir, no es la
//      prueba (la prueba es la lista PASSED de tools/test-i18n.mjs, que crece en el 4b).
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const args = process.argv.slice(2);
const STDOUT = args.includes('--stdout');
const JSON_OUT = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const posix = (p) => p.split(sep).join('/');

// ---------- archivos ----------
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(m?js)$/.test(f)) out.push(p);
  }
  return out;
}
const FILES = walk(SRC).filter(f => !posix(relative(SRC, f)).startsWith('i18n/'));
const folderOf = (file) => { const r = posix(relative(ROOT, file)).split('/'); return r.length > 2 ? r.slice(0, 2).join('/') : 'src'; };
const read = (f) => readFileSync(f, 'utf8');

// los archivos ya pasados a claves (lista de tools/test-i18n.mjs, sección 2)
const testI18n = read(join(ROOT, 'tools', 'test-i18n.mjs'));
const PASSED = new Set([...((testI18n.match(/const PASSED = \{([\s\S]*?)\n\};/) || [])[1] || '').matchAll(/'(src\/[^']+)'\s*:/g)].map(m => m[1]));

// ---------- diccionarios ----------
const LANGS = [...read(join(SRC, 'core', 'i18n.js')).matchAll(/\['([\w-]+)', '[^']+'\]/g)].map(m => m[1]);
const load = async (code) => (await import(pathToFileURL(join(SRC, 'i18n', code + '.js')).href)).default;
const ES = await load('es');
const DICTS = {};
for (const c of LANGS) DICTS[c] = await load(c);
const KEYS = Object.keys(ES);
const words = (v) => (typeof v === 'object' ? Object.values(v)[Object.values(v).length - 1] : String(v)).replace(/<[^>]*>|\{\w+\}/g, ' ').split(/\s+/).filter(Boolean).length;

// ---------- literales ----------
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
function literals(code) {
  const out = [];
  const re = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
  let m;
  while ((m = re.exec(code))) out.push({ lit: m[0], line: code.slice(0, m.index).split('\n').length, index: m.index });
  return out;
}

// ---------- 1. a qué carpeta va cada clave ----------
const keyFolders = new Map(KEYS.map(k => [k, new Set()]));
const prefixes = [];   // [prefijo, carpeta]
const textHits = [];   // { file, folder, line, text }
for (const file of FILES) {
  const folder = folderOf(file);
  const code = stripComments(read(file));
  const lines = code.split('\n');
  for (const { lit, line } of literals(code)) {
    const body = lit.slice(1, -1);
    // dentro de una plantilla: t('clave') y 'prefijo.' + x en sus ${…}
    if (lit[0] === '`') for (const m of body.matchAll(/['"]([a-z]\w*(?:\.[\w-]+)*\.?)['"]/g)) {
      if (keyFolders.has(m[1])) keyFolders.get(m[1]).add(folder); else if (m[1].endsWith('.')) prefixes.push([m[1], folder]);
    }
    if (keyFolders.has(body)) { keyFolders.get(body).add(folder); continue; }
    if (/^[a-z]\w*(\.[\w-]+)*\.$/.test(body)) { prefixes.push([body, folder]); continue; }
    // `zona.cosa.${id}.name`: el prefijo hasta la primera variable
    const tpl = lit[0] === '`' && body.match(/^([a-z]\w*(?:\.[\w-]+)*\.)\$\{/);
    if (tpl) { prefixes.push([tpl[1], folder]); continue; }
    // ---------- 2. texto escrito directo ----------
    const src = lines[line - 1] || '';
    if (/console\.(log|warn|error|info|debug)\(|throw new Error|import\(|from\s+['"]|querySelector|getElementById|\bt\(\s*$/.test(src)) continue;
    const plain = body.replace(/\$\{[^}]*\}/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&\w+;/g, ' ').trim();
    if (!plain) continue;
    const tilde = /[áéíóúüñÁÉÍÓÚÑ¿¡]/.test(plain);
    const phrase = /^[A-ZÁÉÍÓÚÑ¿¡][a-záéíóúñü]+(\s+[\p{L}]+){1,}/u.test(plain) && !/[=;{}#]|^\w+\(|https?:|\.(js|png|json|woff2|m4a)\b/.test(plain);
    if (!tilde && !phrase) continue;
    if (/^[\w.-]+$/.test(plain) && !/\s/.test(plain) && !tilde) continue;
    if (/^(#|rgb|hsl|url\(|[\d.]+(px|em|rem|%|s|ms)\b)/.test(plain)) continue;
    textHits.push({ file: posix(relative(ROOT, file)), folder, line, text: plain.replace(/\s+/g, ' ').slice(0, 90) });
  }
}
// index.html: data-i18n="clave" (el splash y el arranque)
const html = read(join(ROOT, 'index.html'));
for (const m of html.matchAll(/data-i18n(?:-html)?="([^"]+)"|:([a-z][\w.-]+)[;"]/g)) { const k = m[1] || m[2]; if (keyFolders.has(k)) keyFolders.get(k).add('index.html'); }
for (const [p, folder] of prefixes) for (const k of KEYS) if (k.startsWith(p)) keyFolders.get(k).add(folder);
const homeOf = (k) => { const f = [...keyFolders.get(k)]; return f.length ? f.sort().join(' + ') : '(sin uso encontrado)'; };

// ---------- informe ----------
const now = new Date().toISOString().slice(0, 10);
const out = [];
const P = (s = '') => out.push(s);
P('# Pixelia · Lo que falta traducir (generado)');
P();
P(`Generado por \`node tools/i18n-extract.mjs\` el ${now}. **No editar a mano**: se vuelve a generar. Sirve para repartir`);
P('el 4b por carpeta y por idioma (ver [plan-4b.md](plan-4b.md)).');
P();
P(`- **Claves en es.js:** ${KEYS.length} (${KEYS.reduce((a, k) => a + words(ES[k]), 0).toLocaleString('es-AR')} palabras).`);
P(`- **Texto escrito directo en src/ sin t():** ${textHits.length} literales (estimación) en ${new Set(textHits.map(h => h.file)).size} archivos.`);
P(`- **Archivos ya pasados a claves** (PASSED de test-i18n): ${PASSED.size}.`);
P();
P('## 1. Claves de es.js que faltan, por idioma');
P();
P('| idioma | tiene | faltan | palabras que faltan |');
P('|---|---|---|---|');
const missingBy = {};
for (const c of LANGS.filter(c => c !== 'es')) {
  const miss = KEYS.filter(k => !(k in DICTS[c]));
  missingBy[c] = miss;
  P(`| ${c} | ${KEYS.length - miss.length} | ${miss.length} | ${miss.reduce((a, k) => a + words(ES[k]), 0).toLocaleString('es-AR')} |`);
}
P();
P('Por carpeta (la carpeta de src/ que usa la clave). Las columnas son las claves que faltan en cada idioma.');
P();
const homes = [...new Set(KEYS.map(homeOf))].sort();
const others = LANGS.filter(c => c !== 'es');
P(`| carpeta | claves | ${others.join(' | ')} |`);
P(`|---|---|${others.map(() => '---').join('|')}|`);
for (const h of homes) {
  const ks = KEYS.filter(k => homeOf(k) === h);
  P(`| ${h} | ${ks.length} | ${others.map(c => ks.filter(k => missingBy[c].includes(k)).length).join(' | ')} |`);
}
P();
P('Zonas de claves (el prefijo antes del primer punto) y qué idiomas las tienen completas:');
P();
const zones = [...new Set(KEYS.map(k => k.split('.')[0]))].sort();
P('| zona | claves | completa en |');
P('|---|---|---|');
for (const z of zones) {
  const ks = KEYS.filter(k => k.split('.')[0] === z);
  const full = others.filter(c => ks.every(k => k in DICTS[c]));
  P(`| ${z} | ${ks.length} | ${full.length ? full.join(', ') : '—'} |`);
}
P();
P('## 2. Texto escrito directo, por carpeta');
P();
P('Primero hay que pasarlo a claves en `es.js` (una sesión por carpeta, sin traducir); después cada idioma traduce las');
P('claves nuevas. Palabras: estimación para calcular el trabajo de traducción.');
P();
P('| carpeta | archivos | literales | palabras |');
P('|---|---|---|---|');
const folders = [...new Set(textHits.map(h => h.folder))].sort();
const wc = (s) => s.split(/\s+/).filter(Boolean).length;
for (const f of folders) {
  const hs = textHits.filter(h => h.folder === f);
  P(`| ${f} | ${new Set(hs.map(h => h.file)).size} | ${hs.length} | ${hs.reduce((a, h) => a + wc(h.text), 0).toLocaleString('es-AR')} |`);
}
P(`| **total** | ${new Set(textHits.map(h => h.file)).size} | ${textHits.length} | ${textHits.reduce((a, h) => a + wc(h.text), 0).toLocaleString('es-AR')} |`);
P();
P('### Por archivo');
P();
P('Con hasta tres ejemplos. "✔" = ya está en PASSED (lo que aparezca ahí es un nombre propio permitido o un falso');
P('positivo de la estimación).');
for (const f of folders) {
  P();
  P(`**${f}**`);
  P();
  const files = [...new Set(textHits.filter(h => h.folder === f).map(h => h.file))].sort();
  for (const file of files) {
    const hs = textHits.filter(h => h.file === file);
    const ex = hs.slice(0, 3).map(h => `\`${h.text.replace(/`/g, "'").slice(0, 50)}\` (l. ${h.line})`).join(' · ');
    P(`- \`${file}\`${PASSED.has(file) ? ' ✔' : ''}: ${hs.length} · ${ex}`);
  }
}
const sinUso = KEYS.filter(k => homeOf(k) === '(sin uso encontrado)');
if (sinUso.length) {
  P();
  P('## 3. Claves de es.js que no se encontraron en el código');
  P();
  P('Pueden armarse con un prefijo que la herramienta no ve (una variable) o haber quedado sin uso. Revisar antes de');
  P('borrar.');
  P();
  P(sinUso.slice(0, 80).map(k => `\`${k}\``).join(' · ') + (sinUso.length > 80 ? ` · … (${sinUso.length - 80} más)` : ''));
}
P();
const report = out.join('\n');
if (STDOUT) console.log(report);
else {
  mkdirSync(join(ROOT, 'docs', 'i18n'), { recursive: true });
  writeFileSync(join(ROOT, 'docs', 'i18n', 'pendiente.md'), report);
  console.log(`docs/i18n/pendiente.md: ${KEYS.length} claves, ${textHits.length} literales sin t() en ${folders.length} carpetas`);
}
if (JSON_OUT) {
  writeFileSync(resolve(JSON_OUT), JSON.stringify({ missing: missingBy, keyFolders: Object.fromEntries(KEYS.map(k => [k, homeOf(k)])), text: textHits }, null, 1));
  console.log(`detalle: ${JSON_OUT}`);
}
