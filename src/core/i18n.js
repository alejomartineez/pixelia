// Idiomas (docs/PLAN-TRAVESIA.md, Bloque 4). El texto fuente está en src/i18n/es.js; cada idioma, en src/i18n/<código>.js,
// y se baja con import() solo el que se usa (sin build ni dependencias).
//
//   t('settings.title')                     → "Ajustes"
//   t('settings.ver', { v: 'v53' })          → reemplaza {v}; los números se formatean según el idioma
//   tn('time.days', 3)                       → plural con Intl.PluralRules: { one: '{n} día', other: '{n} días' }
//   fmtNum(1234.5), fmtDate(new Date())      → Intl.NumberFormat / Intl.DateTimeFormat del idioma
//   canvasFont(16)                           → '16px "Jersey", …' para el texto que se dibuja en canvas
//   translateDom(el)                         → [data-i18n="clave"] y [data-i18n-attr="aria-label:clave;…"]
//
// Si a un idioma le falta una clave se muestra el español y se avisa una sola vez por consola (tools/test-i18n.mjs
// falla). Regla: todo texto nuevo va por t() con su clave en es.js; nada de texto escrito directo en el código.
import ES from '../i18n/es.js';

/** [código, nombre en su propio idioma]. El orden es el del selector de Ajustes. */
export const LANGS = [
  ['es', 'Español'], ['en', 'English'], ['zh-CN', '简体中文'], ['ru', 'Русский'], ['pt-BR', 'Português (Brasil)'],
  ['de', 'Deutsch'], ['fr', 'Français'], ['ja', '日本語'], ['ko', '한국어'],
];
export const LANG_CODES = LANGS.map(l => l[0]);
/** Locale de Intl para números y fechas (el español del juego es rioplatense). */
const LOCALE = { es: 'es-AR' };
/** Idiomas que no entran en Jersey 10 (solo latín): fuente pixel propia en fonts/, que se carga solo en ese idioma. */
const LANG_FONT = { ru: 'pixel-cyr', ja: 'pixel-ja', 'zh-CN': 'pixel-zh-CN', ko: 'pixel-ko' };
const CJK = new Set(['ja', 'zh-CN', 'ko']);
// respaldo del sistema por si un carácter quedó fuera del recorte de la fuente (tools/subset-fonts.mjs)
const SYS_FALLBACK = { ja: '"Yu Gothic UI", "Hiragino Sans", "Noto Sans JP"', 'zh-CN': '"Microsoft YaHei UI", "PingFang SC", "Noto Sans SC"',
  ko: '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR"' };
const BASE_FONT = "'Jersey', 'PixelNames', ui-rounded, system-ui, sans-serif";   // la misma --font de styles.css

let lang = 'es';
let dict = ES;
let plural = new Intl.PluralRules('es-AR');
let numFmt = new Intl.NumberFormat('es-AR');
let fontStack = BASE_FONT;
let pseudo = 0;   // ?pseudo=1: estira cada texto ~35 % (prueba de interfaz flexible, como el alemán)
const warned = new Set();
/** Claves que faltaron en el idioma actual (las lee tools/test-i18n.mjs). */
export const missing = new Set();
const loaded = { es: ES };

export const getLang = () => lang;
export const isCJK = (l = lang) => CJK.has(l);
export const locale = (l = lang) => LOCALE[l] || l;

/** 'en-US' → 'en', 'zh-TW' → 'zh-CN' (el más cercano que hay), 'pt' → 'pt-BR'. null si no hay ninguno. */
export function matchLang(tag) {
  const t = String(tag || '').trim().replace(/_/g, '-').toLowerCase();
  if (!t) return null;
  const exact = LANG_CODES.find(c => c.toLowerCase() === t);
  if (exact) return exact;
  const base = t.split('-')[0];
  return LANG_CODES.find(c => c.split('-')[0] === base) || null;
}

/** Primer idioma del sistema que el juego tiene; si ninguno, inglés. */
export function pickSystemLang(list) {
  for (const l of list || []) { const m = matchLang(l); if (m) return m; }
  return 'en';
}

function fill(s, vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => {
    if (!(k in vars)) return m;
    const v = vars[k];
    return typeof v === 'number' ? numFmt.format(v) : String(v ?? '');
  });
}
// estira el texto sin tocar etiquetas ni {variables}: duplica una de cada tres letras
function stretch(s) {
  let i = 0;
  return s.replace(/(<[^>]*>|\{\w+\}|&\w+;)|([A-Za-zÀ-ÿ])/g, (m, keep, ch) => keep || ((++i % 3 === 0) ? ch + ch.toLowerCase() : ch));
}
function lookup(key) {
  let s = dict[key];
  if (s === undefined) {
    if (lang !== 'es') {
      missing.add(key);
      if (!warned.has(key)) { warned.add(key); console.warn(`[i18n] falta "${key}" en ${lang}: va en español`); }
    }
    s = ES[key];
    if (s === undefined) {
      if (!warned.has('!' + key)) { warned.add('!' + key); console.warn(`[i18n] clave desconocida "${key}"`); }
      return key;
    }
  }
  return s;
}

/** Texto de la clave en el idioma actual, con {variables}. */
export function t(key, vars) {
  let s = lookup(key);
  if (typeof s === 'object') s = s.other ?? Object.values(s)[0];
  s = fill(String(s), vars);
  return pseudo ? stretch(s) : s;
}

/** Plural: la clave guarda { one, few, many, other… } según Intl.PluralRules; {n} es el número ya formateado. */
export function tn(key, n, vars) {
  const s = lookup(key);
  let form = s;
  if (s && typeof s === 'object') form = s[plural.select(n)] ?? s.other;
  const out = fill(String(form), { n, ...vars });
  return pseudo ? stretch(out) : out;
}

/** ¿Existe la clave (en el idioma o en español)? */
export const has = (key) => key in dict || key in ES;

export const fmtNum = (n, opts) => (opts ? new Intl.NumberFormat(locale(), opts) : numFmt).format(n);
export const fmtDate = (d, opts = { dateStyle: 'medium' }) => new Intl.DateTimeFormat(locale(), opts).format(d instanceof Date ? d : new Date(d));
/** Familia tipográfica del idioma (la misma que --font). */
export const fontFamily = () => fontStack;
/** Para ctx.font de un canvas: '16px "Jersey", "PixelLang-ja", …'. */
export const canvasFont = (px, weight = '') => `${weight ? weight + ' ' : ''}${px}px ${fontStack}`;

/** Traduce lo que tiene data-i18n / data-i18n-html / data-i18n-attr dentro de root. */
export function translateDom(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map(x => x.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  }
}

async function loadDict(code) {
  if (loaded[code]) return loaded[code];
  try {
    const m = await import(`../i18n/${code}.js`);
    loaded[code] = m.default || {};
  } catch (e) {
    console.warn(`[i18n] no se pudo cargar ${code}`, e);
    loaded[code] = {};
  }
  return loaded[code];
}

const fontsAdded = new Map();
/** Carga la fuente pixel del idioma (si tiene) y arma la familia. Espera hasta ~2,5 s para no mostrar cuadraditos. */
async function applyFont(code) {
  const file = LANG_FONT[code];
  const de = document.documentElement;
  de.dataset.script = CJK.has(code) ? 'cjk' : code === 'ru' ? 'cyrl' : 'latn';
  if (!file) { fontStack = BASE_FONT; de.style.removeProperty('--font'); de.style.removeProperty('--font-lang'); return; }
  const fam = `PixelLang-${code}`;
  if (!fontsAdded.has(code) && typeof FontFace === 'function') {
    const base = new URL('../../fonts/', import.meta.url);
    const ff = new FontFace(fam, `url("${new URL(file + '.woff2', base)}") format("woff2")`, { display: 'block' });
    document.fonts.add(ff);
    fontsAdded.set(code, ff.load().catch(e => { console.warn(`[i18n] fuente ${file}`, e); }));
  }
  await Promise.race([fontsAdded.get(code), new Promise(r => setTimeout(r, 2500))]);
  fontStack = `'Jersey', '${fam}', 'PixelNames', ${SYS_FALLBACK[code] ? SYS_FALLBACK[code] + ', ' : ''}ui-rounded, system-ui, sans-serif`;
  de.style.setProperty('--font', fontStack);
  de.style.setProperty('--font-lang', `'Jersey', '${fam}'`);   // el splash de index.html
}

/** Cambia el idioma: baja el diccionario y la fuente. Devuelve el código aplicado. */
export async function setLang(code) {
  code = matchLang(code) || 'es';
  const d = code === 'es' ? ES : await loadDict(code);
  await applyFont(code);
  lang = code; dict = d;
  plural = new Intl.PluralRules(locale(code));
  numFmt = new Intl.NumberFormat(locale(code));
  missing.clear();
  document.documentElement.lang = locale(code);
  return code;
}

/** Idiomas del sistema: el locale del sistema operativo en el juego de PC (desktop.js) o los del navegador. */
async function systemLangs() {
  try { const d = await import('./desktop.js'); const l = await d.systemLocales?.(); if (l?.length) return l; } catch {}
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

/**
 * Al arrancar (main.js, antes del HUD): la primera vez toma el idioma del sistema y lo guarda en settings.lang.
 * ?lang=xx manda sobre los Ajustes (no se guarda). Cuando cambia settings.lang, carga el idioma y emite 'lang:changed'.
 */
export async function initI18n(ctx) {
  const params = new URLSearchParams(location.search);
  pseudo = params.has('pseudo') ? 1 : 0;
  const s = ctx.state.settings;
  // los navegadores de prueba (navigator.webdriver) arrancan en español, el idioma en que están escritas las pruebas;
  // tools/test-i18n.mjs prueba la detección con pickSystemLang y los idiomas con ?lang=
  if (!LANG_CODES.includes(s.lang)) { s.lang = navigator.webdriver ? 'es' : pickSystemLang(await systemLangs()); ctx.store.markDirty(); }
  const forced = matchLang(params.get('lang'));
  await setLang(forced || s.lang);
  ctx.i18n = { t, tn, getLang, setLang, fmtNum, fmtDate };
  ctx.bus.on('settings:changed', async ({ keys } = {}) => {
    if (!keys?.includes('lang') || s.lang === lang) return;
    const applied = await setLang(s.lang);
    ctx.bus.emit('lang:changed', { lang: applied });
  });
  if (typeof window !== 'undefined') window.__i18n = { t, tn, missing, getLang, setLang, translateDom };
  return lang;
}
