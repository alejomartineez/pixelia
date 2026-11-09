// Recorta la fuente pixel de cada idioma que no entra en Jersey 10 (solo latín) a los caracteres que usa el juego.
// Fuente: Fusion Pixel 12px proporcional (OFL 1.1, https://github.com/TakWolf/fusion-pixel-font), que trae una
// variante por idioma (ja, ko, zh_hans) y cubre el cirílico en la latina. Se baja una vez a tools/.cache/.
//
//   node subset-fonts.mjs            → fonts/pixel-<idioma>.woff2 de cada idioma con texto, pixel-cyr y pixel-names
//   node subset-fonts.mjs --check    → sale con 1 si algún carácter de src/i18n/<idioma>.js falta en su fuente
//
// Correrlo después de cambiar ja.js, zh-CN.js, ko.js o ru.js (el 4b lo corre al final de cada traducción).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import subsetFont from 'subset-font';
import { cmapOf } from './font-cmap.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const FONTS = join(ROOT, 'fonts');
const CACHE = join(HERE, '.cache', 'fusion-pixel');
const VERSION = '2026.10.25';
const ZIP = `fusion-pixel-font-12px-proportional-ttf-v${VERSION}.zip`;
const URL_ZIP = `https://github.com/TakWolf/fusion-pixel-font/releases/download/${VERSION}/${ZIP}`;
const check = process.argv.includes('--check');

// idioma → variante de Fusion Pixel
const VARIANT = { ja: 'ja', 'zh-CN': 'zh_hans', ko: 'ko', cyr: 'latin', names: 'ja' };
const ttf = (v) => join(CACHE, `fusion-pixel-12px-proportional-${v}.ttf`);

async function ensureSource() {
  if (existsSync(ttf('ja'))) return;
  mkdirSync(CACHE, { recursive: true });
  const zip = join(CACHE, ZIP);
  if (!existsSync(zip)) {
    console.log('Bajando', URL_ZIP);
    const r = await fetch(URL_ZIP);
    if (!r.ok) throw new Error(`descarga ${r.status}`);
    writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
  }
  // bsdtar abre .zip: el de Windows 10+ (System32, no el GNU tar de Git Bash) y el de macOS
  const tar = process.platform === 'win32' ? join(process.env.SystemRoot || 'C:\Windows', 'System32', 'tar.exe') : 'tar';
  execFileSync(tar, ['-xf', ZIP], { cwd: CACHE });
}

const range = (a, b) => { let s = ''; for (let c = a; c <= b; c++) s += String.fromCodePoint(c); return s; };
const BASE = range(0x20, 0x7e) + range(0xa0, 0xff) + '‐–—―‘’‚“”„†‥…‰′″‹›€№™←↑→↓×÷・';
const CJK_BASE = range(0x3000, 0x303f) + range(0xff01, 0xff5e) + range(0xff61, 0xff9f);
const KANA = range(0x3041, 0x3096) + range(0x30a0, 0x30ff);

async function dictText(code) {
  const f = join(ROOT, 'src', 'i18n', code + '.js');
  if (!existsSync(f)) return '';
  const d = (await import(pathToFileURL(f).href + '?t=' + Date.now())).default || {};
  const out = [];
  for (const v of Object.values(d)) out.push(typeof v === 'object' ? Object.values(v).join('') : String(v));
  return out.join('');
}
const LANG_NAMES = (() => {
  const src = readFileSync(join(ROOT, 'src', 'core', 'i18n.js'), 'utf8');
  return [...src.matchAll(/\['[\w-]+', '([^']+)'\]/g)].map(m => m[1]).join('');
})();

const uniq = (s) => [...new Set([...s])].sort().join('');

async function build(name, variant, text, checkText = text) {
  const src = readFileSync(ttf(variant));
  const cmap = cmapOf(src);
  const chars = uniq(text);
  // lo latino (hasta U+02FF) y la puntuación general los dibuja Jersey 10: solo cuenta lo demás del texto del idioma
  const lost = [...uniq(checkText)].filter(ch => { const c = ch.codePointAt(0); return c > 0x2ff && !(c >= 0x2000 && c <= 0x20cf) && !cmap.has(c); });
  if (lost.length) console.log(`  ${name}: ${lost.length} caracteres sin glifo en Fusion Pixel (${variant}): ${lost.join('')}`);
  if (check) return lost.length;
  const out = await subsetFont(src, chars, { targetFormat: 'woff2' });
  writeFileSync(join(FONTS, `pixel-${name}.woff2`), out);
  console.log(`  fonts/pixel-${name}.woff2  ${(out.length / 1024).toFixed(1)} KB  (${chars.length} caracteres)`);
  return lost.length;
}

await ensureSource();
let lost = 0;
for (const code of ['ja', 'zh-CN', 'ko']) {
  const txt = await dictText(code);
  if (!txt.trim()) { console.log(`  ${code}: sin traducir todavía, no se arma la fuente`); continue; }
  const extra = code === 'ja' ? KANA : '';
  lost += await build(code, VARIANT[code], BASE + CJK_BASE + extra + txt, txt);
}
// ruso: el cirílico entero (son pocos glifos) más el latín de base
const ru = await dictText('ru');
lost += await build('cyr', VARIANT.cyr, BASE + range(0x400, 0x45f) + ru, ru);
// nombres de los idiomas para el selector de Ajustes, más los símbolos que Jersey 10 no tiene y que usa el texto en
// alfabeto latino (→). styles.css la declara con unicode-range: se baja solo si se ven.
const SYMBOLS = '→';
const namesExtra = [...LANG_NAMES].filter(ch => ch.codePointAt(0) > 0x24f).join('') + SYMBOLS;
lost += await build('names', VARIANT.names, namesExtra);
console.log(`  unicode-range de pixel-names: ${[...uniq(namesExtra)].map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase()).join(', ')}`);

// licencias junto a las fuentes
if (!check) {
  const lic = join(CACHE, 'OFL.txt');
  if (existsSync(lic)) writeFileSync(join(FONTS, 'OFL-FusionPixel.txt'), readFileSync(lic));
  for (const d of existsSync(join(CACHE, 'LICENSES')) ? readdirSync(join(CACHE, 'LICENSES')) : []) {
    for (const f of readdirSync(join(CACHE, 'LICENSES', d))) writeFileSync(join(FONTS, `OFL-FusionPixel-${d}.txt`), readFileSync(join(CACHE, 'LICENSES', d, f)));
  }
}
if (check && lost) { console.log('Hay caracteres sin glifo: revisá la traducción o sumá un respaldo.'); process.exit(1); }
