// Íconos dibujados a mano (src/core/icons/): que cada grilla esté bien formada y que ningún id de la interfaz caiga
// en emoji (DESIGN.md, "Íconos").
//   node tools/test-icons.mjs              → todo
//   node tools/test-icons.mjs --sprites    → solo las grillas (rápido, para dibujar)   [--fam res,ui]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const onlySprites = args.includes('--sprites');
const famArg = args.includes('--fam') ? args[args.indexOf('--fam') + 1].split(',') : null;
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);

const errors = [];
const fail = (msg) => errors.push(msg);

// ---------- 1. grillas ----------
const { PAL } = await imp('src/core/icons/palette.js');
const { FAMILIES, SPRITES } = await imp('src/core/icons/index.js');
let count = 0;
const seen = new Map();
for (const f of FAMILIES) {
  if (famArg && !famArg.includes(f.id)) continue;
  for (const [id, d] of Object.entries(f.icons)) {
    count++;
    if (seen.has(id)) fail(`${id}: repetido en ${seen.get(id)} y ${f.id}`);
    seen.set(id, f.id);
    if (!/^[a-z][a-zA-Z0-9-]*$/.test(id)) fail(`${id}: el id va en minúsculas, sin espacios`);
    if (!d.name) fail(`${id}: falta name`);
    for (const n of [16, 24]) {
      const rows = d['s' + n];
      if (!Array.isArray(rows)) { fail(`${id}: falta la grilla s${n}`); continue; }
      if (rows.length !== n) fail(`${id}.s${n}: tiene ${rows.length} filas`);
      let ink = 0, tones = new Set();
      rows.forEach((r, y) => {
        if (r.length !== n) fail(`${id}.s${n} fila ${y}: tiene ${r.length} columnas`);
        for (const [x, ch] of [...r].entries()) {
          if (ch !== '.' && !(ch in PAL)) fail(`${id}.s${n} (${x},${y}): "${ch}" no está en la paleta`);
          if (ch !== '.' && (y === 0 || y === n - 1 || x === 0 || x === n - 1)) fail(`${id}.s${n} (${x},${y}): el borde va vacío (el contorno se agrega solo)`);
          if (ch !== '.') { ink++; tones.add(ch); }
        }
      });
      if (ink < n * n * 0.12) fail(`${id}.s${n}: casi vacío (${ink} pixeles)`);
      if (tones.size < 2) fail(`${id}.s${n}: un solo tono (sin luz ni sombra)`);
    }
  }
}
console.log(`grillas: ${count} íconos`);

// ---------- 2. usos ----------
if (!onlySprites) {
  const known = (name) => !!SPRITES[name] || /^(chest-|chest3d-|flag-|art-)/.test(name);
  // a) los datos: todo campo icon/emoji/ic de las tablas tiene que ser un id dibujado
  const DATA = ['src/core/data.js', 'src/expedition/exp-data.js', 'src/threats/threat-data.js', 'src/core/ambience.js',
    'src/story/story-data.js', 'src/season/season-data.js', 'src/chests/chests.js', 'src/city/themes.js', 'src/combat/combat-data.js',
    'src/combat/classes.js'];
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.addEventListener ??= () => {}; globalThis.removeEventListener ??= () => {};
  globalThis.window ??= globalThis;
  let fields = 0;
  const walk = (v, path, depth, seenObj) => {
    if (!v || typeof v !== 'object' || depth > 7 || seenObj.has(v)) return;
    seenObj.add(v);
    for (const [k, x] of Object.entries(v)) {
      if (typeof x === 'string' && ['icon', 'emoji', 'ic'].includes(k)) {
        fields++;
        if (!known(x)) fail(`${path}.${k} = "${x}": no es un ícono dibujado`);
      } else if (x && typeof x === 'object') walk(x, `${path}.${k}`, depth + 1, seenObj);
    }
  };
  for (const p of DATA) {
    let mod;
    try { mod = await imp(p); } catch (e) { fail(`${p}: no se pudo importar en Node (${e.message})`); continue; }
    for (const [name, v] of Object.entries(mod)) walk(v, `${p.split('/').pop()}:${name}`, 0, new Set());
  }
  console.log(`datos: ${fields} campos de ícono`);

  // b) el código: llamadas icon('x') / iconUrl('x') y campos ic/icon/emoji literales; nada de emojis sueltos
  const EMOJI = /(?:\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}])/u;
  // las láminas de Hallazgos son la tanda 2
  const SKIP = /(^|\/)(album\.js|album-art\.js|icons\/legacy\.js)$/;
  const files = [];
  const scan = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) scan(p); else if (p.endsWith('.js')) files.push(p); } };
  scan(join(ROOT, 'src'));
  let calls = 0;
  for (const p of files) {
    const rel = relative(ROOT, p).split('\\').join('/');
    if (SKIP.test(rel)) continue;
    // sin comentarios (los // dentro de strings como 'http://' no importan: no tienen emojis ni íconos)
    const code = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
    code.split('\n').forEach((ln, i) => {
      const at = `${rel}:${i + 1}`;
      const em = ln.match(new RegExp(EMOJI.source, 'gu'));
      if (em) fail(`${at}: emoji en el código (${[...new Set(em)].join(' ')}): usá un ícono o sacalo`);
      for (const m of ln.matchAll(/\b(?:icon|iconUrl)\(\s*'([^']+)'/g)) { calls++; if (!known(m[1])) fail(`${at}: icon('${m[1]}') no está dibujado`); }
      for (const m of ln.matchAll(/\b(?:ic|icon|emoji)\s*:\s*'([^']*)'/g)) { calls++; if (m[1] && !known(m[1])) fail(`${at}: ${m[0]} no está dibujado`); }
    });
  }
  console.log(`código: ${files.length} archivos, ${calls} usos literales`);
}

if (errors.length) {
  console.log(`\n=== ${errors.length} ERRORES ===\n` + errors.slice(0, 200).join('\n'));
  process.exit(1);
}
console.log('OK');
process.exit(0);   // los módulos de datos dejan timers vivos
