// Coherencia del glosario (docs/i18n/glosario.md, paso 4b-0), sin navegador.
//
//   node tools/test-glossary.mjs           (falla si una traducción no usa la forma fijada)
//   node tools/test-glossary.mjs --list    (además lista cada término y en cuántas claves aparece)
//
// Lee las tablas del glosario (filas que empiezan con | **término** |) y, para cada término con forma fijada en un
// idioma que ya tiene texto (hoy en y ja; en el 4b, todos), busca las claves de es.js que lo usan y revisa que la
// traducción de esa clave lleve la forma fijada.
//   · Términos con mayúscula inicial ("Grieta", "Encanto"): se buscan respetando la mayúscula, como nombre propio.
//   · Términos en minúscula ("provisiones") y los sistemas de CASELESS: sin distinguir mayúsculas.
//   · En latín se acepta la forma sin la -s final (plural ↔ singular) y sin distinguir mayúsculas.
// Las excepciones van en KNOWN (traducciones que el 4b tiene que corregir: la lista se achica hasta quedar vacía) y en
// SKIP (claves donde la palabra en español tiene otro sentido y no es el término del glosario).
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIST = process.argv.includes('--list');
const COLS = ['es', 'cat', 'modo', 'en', 'zh-CN', 'ru', 'pt-BR', 'de', 'fr', 'ja', 'ko'];
const LANGS = COLS.slice(3);

/** clave → términos que no se miran en esa clave (la palabra tiene otro sentido). */
const SKIP = {
  // "+{n} de fuerza" de las amenazas es la fuerza de la amenaza (strength), no la Fuerza del grupo (glosario §5)
};
/** 'idioma|término|clave': traducción que hoy no usa la forma fijada y que el 4b corrige. */
const KNOWN = new Set([
  // 2a: en ja la travesía salió como 旅; el glosario fija 航海 (combina con 航海日誌)
  'ja|Travesía|talents.branch.supervivencia.text',
  'ja|Travesía|talents.sup_animo.text',
  // 3b (cinemática): se tradujo en paralelo al glosario; el 4b decide si corrige el texto o ajusta el glosario
  'en|Quiebre|intro.title', 'en|Vaciados|intro.line.11', 'en|Enanos de la Veta|intro.label.enanos',
  'en|Bajo Mundo|intro.label.bajo', 'en|Orcos de la Brasa|intro.label.orcos', 'en|Vaciados|intro.label.vaciados',
  'en|Cofradía de la Veta|intro.label.cofradia',
  'ja|Vaciados|intro.line.11', 'ja|Vaciados|intro.label.vaciados', 'ja|Cofradía de la Veta|intro.label.cofradia',
  'ja|Vera|intro.label.vera',
]);

let pass = 0, fail = 0;
const ok = (cond, msg, extra) => { if (cond) { pass++; if (LIST) console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg + (extra ? '\n      ' + extra : '')); } };

// ---------- glosario ----------
export function parseGlossary(md) {
  const terms = [];
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/);
    if (!m) continue;
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells.length !== COLS.length) throw new Error(`glosario: la fila "${m[1]}" tiene ${cells.length} columnas, no ${COLS.length}`);
    const row = Object.fromEntries(COLS.map((c, i) => [c, cells[i].replace(/\*\*/g, '')]));
    terms.push(row);
  }
  return terms;
}

const md = readFileSync(join(ROOT, 'docs', 'i18n', 'glosario.md'), 'utf8');
const TERMS = parseGlossary(md);
const load = async (code) => (await import(pathToFileURL(join(ROOT, 'src', 'i18n', code + '.js')).href)).default;
const ES = await load('es');
const DICTS = {};
for (const code of LANGS) DICTS[code] = await load(code);

console.log('Glosario');
ok(TERMS.length >= 60, `docs/i18n/glosario.md tiene ${TERMS.length} términos`);
const dup = TERMS.map(t => t.es).filter((t, i, a) => a.indexOf(t) !== i);
ok(!dup.length, 'sin términos repetidos', dup.join(', '));
const badMode = TERMS.filter(t => !/^[TX=]$/.test(t.modo)).map(t => t.es);
ok(!badMode.length, 'cada término dice si se traduce (T), se transcribe (X) o queda igual (=)', badMode.join(', '));
const empty = TERMS.flatMap(t => LANGS.filter(l => !t[l]).map(l => `${t.es} (${l})`));
ok(!empty.length, 'cada término tiene forma en los 8 idiomas', empty.slice(0, 10).join(', '));
const same = TERMS.filter(t => t.modo === '=' && LANGS.some(l => t[l] !== t.es && t[l] !== t.en)).map(t => t.es);
ok(!same.length, 'los términos "=" quedan iguales', same.join(', '));

const forms = (v) => (v && typeof v === 'object' ? Object.values(v) : [v]).map(String);
const text = (v) => forms(v).join(' ¦ ').replace(/<[^>]*>/g, '');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const L = '\\p{L}';
// sistemas que en la prosa van en minúscula ("salí de expedición", "aguantar la travesía") y no tienen otro sentido
const CASELESS = new Set(['Travesía', 'Maestría', 'Grieta', 'Encanto', 'Bitácora', 'Expedición', 'Taller', 'Encargos', 'Cuartel', 'Escuadra']);
function esRegex(term) {
  const proper = term[0] !== term[0].toLowerCase() && !CASELESS.has(term);
  return new RegExp(`(?<!${L})${esc(term)}(?!${L})`, proper ? 'u' : 'iu');
}
const latin = (code) => !['zh-CN', 'ja', 'ko', 'ru'].includes(code);
function hasForm(code, target, form) {
  if (latin(code) || code === 'ru') {
    const low = target.toLowerCase(), f = form.toLowerCase();
    const stems = [f, f.replace(/ies$/, 'y'), f.replace(/s$/, '')].filter(x => x.length > 3);
    return stems.some(x => low.includes(x));
  }
  return target.includes(form);
}

// términos más largos primero: "Grieta profunda" se mira antes que "Grieta", y "Marea del Quiebre" antes que "Marea"
const byLen = [...TERMS].sort((a, b) => b.es.length - a.es.length);
const withText = LANGS.filter(c => Object.keys(DICTS[c]).length);
console.log(`Uso en los idiomas con texto (${withText.join(', ')})`);
const unusedKnown = new Set(KNOWN);
for (const code of withText) {
  const d = DICTS[code];
  const bad = [];
  let checked = 0;
  for (const [key, src] of Object.entries(ES)) {
    if (!(key in d)) continue;
    let s = text(src);
    const target = text(d[key]);
    for (const term of byLen) {
      const re = esRegex(term.es);
      if (!re.test(s)) continue;
      s = s.replace(new RegExp(re.source, re.flags + 'g'), ' ');   // que "Grieta" no vuelva a contar dentro de "Grieta profunda"
      if ((SKIP[key] || []).includes(term.es)) continue;
      checked++;
      const id = `${code}|${term.es}|${key}`;
      if (hasForm(code, target, term[code])) { if (KNOWN.has(id)) bad.push(`${id} (ya está bien: sacalo de KNOWN)`); continue; }
      if (KNOWN.has(id)) { unusedKnown.delete(id); continue; }
      bad.push(`${key}: "${term.es}" → se espera "${term[code]}" en ${JSON.stringify(target).slice(0, 80)}`);
    }
  }
  ok(!bad.length, `${code}: ${checked} usos de términos del glosario con la forma fijada`, bad.slice(0, 15).join('\n      '));
}
for (const id of [...unusedKnown]) if (!withText.includes(id.split('|')[0])) unusedKnown.delete(id);
ok(!unusedKnown.size, 'KNOWN no tiene excepciones que ya no existen', [...unusedKnown].join(', '));
if (KNOWN.size) console.log(`  · ${KNOWN.size} excepciones conocidas para corregir en el 4b (KNOWN)`);

console.log(`\n${pass} ✓  ${fail} ✗`);
process.exit(fail ? 1 : 0);
