// Prueba de idiomas (docs/PLAN-TRAVESIA.md, paso 4a; src/core/i18n.js), en Chrome headless.
//
//   node tools/test-i18n.mjs            (capturas en shots/i18n/)
//   node tools/test-i18n.mjs --no-shots
//
// Revisa:
//   1. cada idioma con texto tiene todas las claves de es.js, con las mismas {variables}, etiquetas y formas de plural;
//   2. los archivos ya pasados a claves (PASSED) no tienen texto con tilde fuera de src/i18n/, y cada clave que usan
//      existe en es.js;
//   3. cada carácter de un idioma tiene glifo en su fuente (Jersey 10 o fonts/pixel-<idioma>.woff2): nada de "tofu";
//   4. t(), tn(), matchLang() y el idioma del sistema;
//   5. en el juego: el splash en japonés, el cambio en vivo desde Ajustes → Idioma, ?lang= sobre los Ajustes, y las
//      pestañas de Ajustes en alemán (con ?pseudo=1: textos ~35 % más largos) y en japonés sin texto cortado
//      (scrollWidth > clientWidth en botones, pestañas y tarjetas);
//   6. el HUD de la ciudad, el menú Construir y la ficha de la municipalidad en japonés y en alemán largo: sin texto
//      cortado, sin botones del HUD encimados y sin claves que falten.
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { cmapOfFile } from './font-cmap.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = !process.argv.includes('--no-shots');
const OUT = join(ROOT, 'shots', 'i18n');
if (SHOTS) mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (cond, msg, extra) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg + (extra ? '\n      ' + extra : '')); } };

// ---------- 1. claves ----------
console.log('Claves');
const I18N = join(ROOT, 'src', 'i18n');
const load = async (code) => (await import(pathToFileURL(join(I18N, code + '.js')).href)).default;
const ES = await load('es');
const SRC = readFileSync(join(ROOT, 'src', 'core', 'i18n.js'), 'utf8');
const CODES = [...SRC.matchAll(/\['([\w-]+)', '[^']+'\]/g)].map(m => m[1]);
ok(CODES.length === 9 && CODES[0] === 'es', `LANGS tiene los 9 idiomas (${CODES.join(', ')})`);
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const tags = (s) => [...String(s).matchAll(/<\/?(\w+)/g)].map(m => m[0]).sort().join(',');
const forms = (v) => (v && typeof v === 'object' ? Object.values(v) : [v]);
const DICTS = {};
for (const code of CODES) {
  ok(existsSync(join(I18N, code + '.js')), `src/i18n/${code}.js existe`);
  DICTS[code] = await load(code);
}
for (const [k, v] of Object.entries(ES)) {
  if (typeof v === 'object') ok(typeof v.other === 'string', `es: el plural ${k} tiene "other"`);
}
for (const code of CODES.filter(c => c !== 'es')) {
  const d = DICTS[code];
  const n = Object.keys(d).length;
  if (!n) { console.log(`  · ${code}: sin traducir todavía (paso 4b), cae al español`); continue; }
  const miss = Object.keys(ES).filter(k => !(k in d));
  const extra = Object.keys(d).filter(k => !(k in ES));
  ok(!miss.length, `${code}: tiene las ${Object.keys(ES).length} claves de es`, miss.slice(0, 12).join(', '));
  ok(!extra.length, `${code}: no tiene claves que es no tenga`, extra.join(', '));
  const cats = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
  const badVars = [], badTags = [], badPlural = [], badTips = [];
  for (const [k, v] of Object.entries(d)) {
    if (!(k in ES)) continue;
    const src = ES[k];
    const want = vars(forms(src)[0] + (typeof src === 'object' ? '{n}' : ''));
    for (const f of forms(v)) {
      const got = vars(f + (typeof src === 'object' ? '{n}' : ''));
      if ([...new Set(got.split(','))].join(',') !== [...new Set(want.split(','))].join(',')) badVars.push(`${k} (${got} ≠ ${want})`);
      if (tags(f) !== tags(forms(src)[0])) badTags.push(k);
    }
    if (typeof src === 'object') {
      if (typeof v !== 'object' || !v.other) badPlural.push(k + ' sin "other"');
      else for (const c of cats) if (!(c in v) && c !== 'other' && !(c === 'one' && code === 'ja')) badPlural.push(`${k} sin "${c}"`);
    }
    if (k.endsWith('.tips') && String(v).split('|').length !== String(src).split('|').length) badTips.push(k);
  }
  ok(!badVars.length, `${code}: las {variables} coinciden con es`, badVars.join(' · '));
  ok(!badTags.length, `${code}: las etiquetas (<b>, <kbd>…) coinciden con es`, badTags.join(', '));
  ok(!badPlural.length, `${code}: los plurales tienen las formas de Intl.PluralRules (${cats.join(', ')})`, badPlural.join(', '));
  ok(!badTips.length, `${code}: las listas separadas con | tienen el mismo largo`, badTips.join(', '));
}

// ---------- 2. archivos ya pasados a claves ----------
// La lista crece con cada tanda (4a: Ajustes, ajustes y arranque; 4b: el resto) hasta cubrir todo src/.
// Excepciones: nombres propios que no se traducen.
const PASSED = {
  'src/core/i18n.js': ['Español', '[i18n]'],   // el nombre del idioma y los avisos de consola para quien programa
  'src/core/settings.js': [],
  'src/scenes/panels-settings.js': ['Pixelín'],
  'src/core/hud.js': ['señales'],   // el id de una fase de las amenazas (threats.js), no un texto
  'src/core/ui.js': [],
  'src/scenes/city-ui.js': [],
  'src/scenes/city.js': [],
  // 2a: arsenal, talentos, maestría y Fuerza (panels-progress.js todavía no: solo sus secciones del 2a están en claves;
  // el resto, rango, clases de la ciudad, gente y mundo, se pasa en el 4b)
  'src/core/arsenal.js': ['leñador'],   // id de una técnica (arsenal.tech.leñador.*), no es texto
  'src/core/talents.js': [],
  'src/core/gear.js': [],
  'src/core/power.js': [],
  'src/scenes/panels-arsenal.js': [],
};
console.log('Archivos pasados a claves');
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
for (const [file, allow] of Object.entries(PASSED)) {
  const code = stripComments(readFileSync(join(ROOT, file), 'utf8'));
  const lits = [...code.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)].map(m => m[0]);
  const bad = lits.filter(l => /[áéíóúüñÁÉÍÓÚÑ¿¡]/.test(l.replace(/\$\{[^}]*\}/g, '')) && !allow.some(a => l.includes(a)));
  ok(!bad.length, `${file}: sin texto en español escrito en el código`, bad.slice(0, 6).join(' · '));
  // las claves escritas enteras ('zona.cosa'); las que se arman ('city.look.cycle.' + n) terminan en punto y no se miran
  const zones = new Set(Object.keys(ES).map(k => k.split('.')[0]));
  const keys = lits.filter(l => /^'[a-z]\w*(\.[\w-]+)+'$/.test(l)).map(l => l.slice(1, -1)).filter(k => zones.has(k.split('.')[0]) && !/\.(js|mjs|png|json|m4a|woff2)$/.test(k));
  const unknown = [...new Set(keys.filter(k => !(k in ES)))];
  ok(!unknown.length, `${file}: las ${new Set(keys).size} claves que usa están en es.js`, unknown.join(', '));
}

// ---------- 3. glifos ----------
console.log('Fuentes');
const FONT_OF = { ru: 'pixel-cyr', ja: 'pixel-ja', 'zh-CN': 'pixel-zh-CN', ko: 'pixel-ko' };
const jersey = await cmapOfFile(readFileSync(join(ROOT, 'fonts', 'jersey10.woff2')));
// pixel-names va en todos los idiomas detrás de Jersey (styles.css, --font): los nombres de los idiomas y algún símbolo (→)
const names = await cmapOfFile(readFileSync(join(ROOT, 'fonts', 'pixel-names.woff2')));
const namesRange = (readFileSync(join(ROOT, 'styles.css'), 'utf8').match(/PixelNames[^}]*unicode-range:([^;]+);/) || [])[1] || '';
const inRange = (c) => namesRange.split(',').some(r => { const m = r.trim().match(/^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i); if (!m) return false; const a = parseInt(m[1], 16), b = m[2] ? parseInt(m[2], 16) : a; return c >= a && c <= b; });
const allText = (d) => Object.values(d).flatMap(forms).join('');
for (const code of CODES) {
  const text = allText(DICTS[code]).replace(/<[^>]*>|\{\w+\}/g, '');
  if (!text) continue;
  const file = FONT_OF[code] && join(ROOT, 'fonts', FONT_OF[code] + '.woff2');
  const own = file && existsSync(file) ? await cmapOfFile(readFileSync(file)) : null;
  if (FONT_OF[code]) ok(!!own, `${code}: está fonts/${FONT_OF[code]}.woff2 (correr node tools/subset-fonts.mjs)`);
  const lost = [...new Set(text)].filter(ch => { const c = ch.codePointAt(0); return c > 0x20 && !jersey.has(c) && !(own && own.has(c)) && !(names.has(c) && inRange(c)); });
  ok(!lost.length, `${code}: todos los caracteres tienen glifo (Jersey 10${own ? ' + ' + FONT_OF[code] : ''})`, lost.join(''));
}
for (const f of ['OFL-Jersey10.txt', 'OFL-FusionPixel.txt']) ok(existsSync(join(ROOT, 'fonts', f)), `fonts/${f} (licencia)`);
const fontFiles = readdirSync(join(ROOT, 'fonts')).filter(f => /\.woff2$/.test(f));
const gen = readFileSync(join(ROOT, 'tools', 'gen-sw-core.mjs'), 'utf8');
ok(/list\('fonts', \/\\\.\(woff2\?\|ttf\)\$\/\)/.test(gen), `gen-sw-core.mjs (npm run bump) suma a sw.js todo fonts/*.woff2 (${fontFiles.join(', ')})`);

// ---------- 4 y 5. en el navegador ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.m4a': 'audio/mp4' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(ROOT, p);
  if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error' && !/supabase|Failed to load resource/i.test(m.text())) errors.push('CONSOLE.ERROR: ' + m.text()); });
await page.setRequestInterception(true);
page.on('request', r => (/supabase\.co/.test(r.url()) ? r.abort() : r.continue()));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(code, ms = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await page.evaluate(code)) return true; } catch {} await sleep(120); }
  return false;
}
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: join(OUT, name + '.png') }); };
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
const run = (body) => page.evaluate(new AsyncFn(`const { store, ctx, bus } = window.__pixelia; const I = await import('/src/core/i18n.js'); ${body}`));

async function openCity(query = '') {
  await page.goto(`${BASE}?scene=city&nosplash&nosw${query}`, { waitUntil: 'load' });
  return waitFor(`window.__pixelia?.ctx.router.current === 'city' && !!window.__pixelia.city?.r`, 30000);
}
async function closeModals() {
  for (let i = 0; i < 6; i++) {
    if (!(await page.evaluate(() => !!document.querySelector('.modal')))) return;
    await page.evaluate(() => document.querySelector('.modal .modal-x')?.click() || document.querySelector('.modal .modal-foot .btn:last-child')?.click());
    await sleep(350);
  }
}
/** Elementos con texto cortado dentro de root: scrollWidth > clientWidth (y lo mismo en alto) en botones, pestañas y tarjetas. */
const clipped = (root) => page.evaluate((root) => {
  const out = [];
  const box = document.querySelector(root);
  if (!box) return ['(no está ' + root + ')'];
  // lo que cuelga por diseño (globitos, puntos, carteles del riel) va con position: absolute y no cuenta como texto
  // cortado: se esconde un momento para medir
  const hung = [...box.querySelectorAll('*')].filter(el => /^(absolute|fixed)$/.test(getComputedStyle(el).position));
  const prev = hung.map(el => el.style.display);
  hung.forEach(el => { el.style.display = 'none'; });
  for (const el of box.querySelectorAll('button, .set-tab, .a11y-opt, .set-lang, .chip, .pill, .card, .pnl-sec-title, .set-lbl b, .set-lbl small, h2, h3, h4, kbd, summary, label, .cx-lock span, .cx-free span, .cx-card .nm')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    const cs = getComputedStyle(el);
    if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue;
    if (el.scrollWidth > el.clientWidth + 1 || (cs.overflowY === 'hidden' && el.scrollHeight > el.clientHeight + 2)) out.push(`${el.className || el.tagName}: "${el.textContent.trim().slice(0, 40)}" ${el.scrollWidth}>${el.clientWidth}`);
  }
  hung.forEach((el, i) => { el.style.display = prev[i]; });
  // el título y las pestañas no se salen del panel
  const panel = document.querySelector('.modal.set-panel')?.getBoundingClientRect();
  if (panel) for (const el of document.querySelectorAll('.set-tab span, .modal-head h2')) {
    const r = el.getBoundingClientRect();
    if (r.right > panel.right + 1) out.push('se sale del panel: ' + el.textContent);
  }
  return out;
}, root);
/** Botones del HUD que se pisan entre sí o se salen de la ventana (con textos largos, las columnas crecen). */
const hudOverlaps = () => page.evaluate(() => {
  const out = [];
  // los botones y los carteles que cuelgan del riel (nombre abajo, nivel arriba)
  const els = [...document.querySelectorAll('#hud button, #hud .pill, .cx-side > *, .rail-btn > span:not(.rail-ic), .rail-tag')].filter(el => el.offsetParent !== null && el.getBoundingClientRect().width > 0);
  const rs = els.map(el => ({ el, r: el.getBoundingClientRect(), name: (el.dataset.act || el.dataset.hud || el.className) }));
  for (const a of rs) if (a.r.left < -1 || a.r.top < -1 || a.r.right > innerWidth + 1 || a.r.bottom > innerHeight + 1) out.push(`${a.name} se sale de la ventana`);
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i], b = rs[j];
    if (a.el.contains(b.el) || b.el.contains(a.el) || a.el.parentElement === b.el.parentElement && a.el.closest('.rail-btn')) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 2 && h > 2) out.push(`${a.name} pisa a ${b.name} (${Math.round(w)}×${Math.round(h)})`);
  }
  return out;
});
/** El HUD, el menú Construir y la ficha de la municipalidad en un idioma: nada cortado, nada encimado, ninguna clave de menos. */
async function checkCity(query, label) {
  ok(await openCity(query + '&cheat=15'), `${label}: ciudad con todo el HUD abierto (?cheat=15)`);
  await waitFor(`document.querySelector('#hud [data-act="pass"]')?.style.display !== 'none'`, 5000);
  await sleep(900);
  await closeModals();
  await run(`bus.emit('resources:changed', {}); return true;`);
  await sleep(400);
  await shot(`city-${label}`);
  const cut = await clipped('#hud');
  ok(!cut.length, `${label}: el HUD no tiene texto cortado`, cut.slice(0, 8).join('\n      '));
  const over = await hudOverlaps();
  ok(!over.length, `${label}: en el HUD nada se pisa ni se sale de la ventana`, over.slice(0, 8).join('\n      '));
  // menú Construir
  await run(`bus.emit('hud:build'); return true;`);
  ok(await waitFor(`document.querySelectorAll('.cx-build .cx-card').length > 3`, 5000), `${label}: se abre el menú Construir`);
  await sleep(700);
  await shot(`build-${label}`);
  const cutB = await clipped('.cx-build');
  ok(!cutB.length, `${label}: el menú Construir no tiene texto cortado`, cutB.slice(0, 8).join('\n      '));
  await closeModals();
  // ficha de la municipalidad (rango, producción, terreno, constructoras y acciones)
  await run(`const b = ctx.state.city.buildings.find(o => o.id === 'castillo'); bus.emit('city:focus', { uid: b.uid }); return true;`);
  ok(await waitFor(`!!document.querySelector('.cx-info-modal .cx-actions')`, 5000), `${label}: se abre la ficha de la municipalidad`);
  await sleep(500);
  await shot(`info-${label}`);
  const cutI = await clipped('.cx-info-modal');
  ok(!cutI.length, `${label}: la ficha no tiene texto cortado`, cutI.slice(0, 8).join('\n      '));
  await closeModals();
  const code = query.match(/lang=([\w-]+)/)[1];
  if (Object.keys(DICTS[code]).length) {   // los idiomas sin texto todavía caen al español (paso 4b)
    const miss = (await run(`return [...I.missing];`)).filter(k => /^(hud|city|ui|common)\./.test(k));
    ok(!miss.length, `${label}: al HUD y a la ciudad no les falta ninguna clave`, miss.join(', '));
  }
}
const TABS = ['gfx', 'screen', 'sound', 'game', 'lang', 'keys', 'a11y', 'save'];
async function checkTabs(code, label) {
  await run(`ctx.openPanel('settings', { tab: 'gfx' }); return true;`);
  await waitFor(`!!document.querySelector('.set-tab.on')`, 5000);
  const cut = [];
  for (const tab of TABS) {
    await page.evaluate((tab) => document.querySelector(`.set-tab[data-tab="${tab}"]`)?.click(), tab);
    await waitFor(`document.querySelector('.set-tab.on')?.dataset.tab === '${tab}'`, 3000);
    await sleep(tab === 'save' ? 600 : 200);
    // la pestaña entera, de arriba abajo
    const h = await page.evaluate(() => { const p = document.querySelector('.set-pane'); return p ? p.scrollHeight - p.clientHeight : 0; });
    for (let y = 0; y <= h; y += 400) {
      await page.evaluate((y) => { const p = document.querySelector('.set-pane'); if (p) p.scrollTop = y; }, y);
      for (const c of await clipped('.modal.set-panel')) if (!cut.includes(c)) cut.push(`[${tab}] ${c}`);
    }
    await page.evaluate(() => { const p = document.querySelector('.set-pane'); if (p) p.scrollTop = 0; });
    if (['gfx', 'game', 'lang', 'keys', 'save'].includes(tab)) await shot(`settings-${label}-${tab}`);
  }
  ok(!cut.length, `${label}: ninguna pestaña de Ajustes tiene texto cortado`, cut.slice(0, 8).join('\n      '));
  await closeModals();
}

try {
  // --- 4. unidades ---
  console.log('t(), tn() y el idioma del sistema');
  ok(await openCity(), 'la ciudad arranca');
  const u = await run(`
    const r = {};
    r.match = ['en-US', 'zh-TW', 'zh', 'pt-PT', 'ja-JP', 'ko-KR', 'de-AT', 'es-419', 'pl', ''].map(x => I.matchLang(x));
    r.sys = [I.pickSystemLang(['pl-PL', 'pt-PT']), I.pickSystemLang(['tr']), I.pickSystemLang(['fr-CA', 'en'])];
    r.es = [I.t('settings.title'), I.t('settings.screen.resHelp', { w: '1920', h: '1080' }), I.tn('time.daysAgo', 1), I.tn('time.daysAgo', 3), I.fmtNum(1234.5)];
    r.unknown = I.t('no.existe.esta');
    await I.setLang('en'); r.en = [I.t('settings.title'), I.tn('time.daysAgo', 1), I.tn('time.daysAgo', 2), I.fmtNum(1234.5)];
    await I.setLang('ru'); r.ru = [I.t('settings.title'), [...I.missing].includes('settings.title'), document.documentElement.dataset.script];
    await I.setLang('de'); r.de = I.fmtNum(1234.5);
    await I.setLang('ja'); r.ja = [I.t('settings.title'), I.tn('time.daysAgo', 5), document.documentElement.dataset.script, I.canvasFont(16)];
    await I.setLang('es'); r.back = I.t('settings.title');
    return r;`);
  ok(JSON.stringify(u.match) === JSON.stringify(['en', 'zh-CN', 'zh-CN', 'pt-BR', 'ja', 'ko', 'de', 'es', null, null]), 'matchLang: en-US→en, zh-TW→zh-CN, pt-PT→pt-BR, ja-JP→ja…', JSON.stringify(u.match));
  ok(JSON.stringify(u.sys) === JSON.stringify(['pt-BR', 'en', 'fr']), 'idioma del sistema: el primero que hay; si ninguno, inglés', JSON.stringify(u.sys));
  ok(u.es[0] === 'Ajustes' && u.es[1].includes('1920×1080') && u.es[2] === 'hace 1 día' && u.es[3] === 'hace 3 días' && u.es[4] === '1234,5' || u.es[4] === '1.234,5', 't/tn/fmtNum en español', JSON.stringify(u.es));
  ok(u.unknown === 'no.existe.esta', 'una clave desconocida se ve como clave (y avisa)');
  ok(JSON.stringify(u.en) === JSON.stringify(['Settings', '1 day ago', '2 days ago', '1,234.5']), 'inglés: texto, plural y números', JSON.stringify(u.en));
  ok(u.ru[0] === 'Ajustes' && u.ru[1] && u.ru[2] === 'cyrl', 'ruso sin traducir: cae al español, anota la clave que falta y usa la fuente cirílica', JSON.stringify(u.ru));
  ok(u.de === '1.234,5', 'alemán: números con Intl', u.de);
  ok(u.ja[0] === '設定' && u.ja[1] === '5日前' && u.ja[2] === 'cjk' && /PixelLang-ja/.test(u.ja[3]), 'japonés: texto, plural, fuente CJK y canvasFont', JSON.stringify(u.ja));
  ok(u.back === 'Ajustes', 'vuelve al español');

  // --- 5a. cambio en vivo desde Ajustes ---
  console.log('Ajustes → Idioma');
  ok(await run(`return ctx.state.settings.lang === 'es';`), 'en un navegador de prueba arranca en español y lo guarda');
  await run(`ctx.openPanel('settings', { tab: 'lang' }); return true;`);
  ok(await waitFor(`document.querySelectorAll('.set-lang').length === 9`, 4000), 'el selector muestra los 9 idiomas');
  await shot('settings-es-lang');
  await page.evaluate(() => document.querySelector('.set-lang[data-lang="ja"]').click());
  ok(await waitFor(`document.documentElement.lang === 'ja' && document.querySelector('.set-tab[data-tab="lang"] span')?.textContent === '言語'`, 6000), 'al elegir 日本語, el panel abierto se repinta al momento');
  ok(await run(`return ctx.state.settings.lang === 'ja' && document.querySelector('.modal.set-panel .modal-head h2')?.textContent === '設定';`), 'se guarda settings.lang y cambia el título');
  ok(await page.evaluate(() => document.fonts.check('16px "PixelLang-ja"', '設定')), 'la fuente pixel japonesa está cargada');
  await closeModals();

  // --- 5b. ?lang= manda sobre los Ajustes ---
  ok(await openCity('&lang=en'), 'la ciudad arranca con ?lang=en');
  ok(await run(`return I.getLang() === 'en' && ctx.state.settings.lang === 'ja';`), '?lang=en manda sobre los Ajustes (que siguen en ja)');

  // --- 5c. splash en japonés ---
  await page.goto(`${BASE}?lang=ja&nosw`, { waitUntil: 'load' });
  ok(await waitFor(`document.getElementById('splash')?.classList.contains('ready')`, 30000), 'splash listo');
  const sp = await page.evaluate(() => ({ tap: document.querySelector('.splash-tap')?.textContent, sub: document.querySelector('.splash-sub')?.textContent,
    wait: document.documentElement.classList.contains('i18n-wait'), by: document.querySelector('.splash-by')?.textContent }));
  ok(sp.tap === DICTS.ja['boot.tap'] && sp.sub === DICTS.ja['boot.sub'] && !sp.wait, 'el splash sale en japonés', JSON.stringify(sp));
  await sleep(4500);   // que termine el logo de Dezings, que tapa el splash
  await shot('splash-ja');

  // --- 5d. Ajustes en japonés y en alemán largo ---
  console.log('Texto cortado');
  ok(await openCity('&lang=ja'), 'ciudad en japonés');
  const miss0 = await run(`return [...I.missing];`);
  await checkTabs('ja', 'ja');
  const missJa = (await run(`return [...I.missing];`)).filter(k => !miss0.includes(k) && k.startsWith('settings.'));
  ok(!missJa.length, 'ja: a Ajustes no le falta ninguna clave', missJa.join(', '));
  ok(await openCity('&lang=de&pseudo=1'), 'ciudad en alemán con textos estirados (?pseudo=1)');
  await checkTabs('de', 'de');
  ok(await openCity('&lang=en'), 'ciudad en inglés');
  await checkTabs('en', 'en');

  // --- 6. el HUD y la ciudad en japonés, en alemán largo y en inglés ---
  console.log('HUD y ciudad');
  await checkCity('&lang=ja', 'ja');
  await checkCity('&lang=de&pseudo=1', 'de');
  await checkCity('&lang=en', 'en');
  // el HUD se repinta al cambiar el idioma en vivo
  await run(`const S = await import('/src/core/settings.js'); S.setSetting({ lang: 'ja' }); return true;`);
  ok(await waitFor(`document.querySelector('#hud [data-act="build"] span')?.textContent === ${JSON.stringify(DICTS.ja['hud.build'])} && document.querySelector('.cx-collect span')?.textContent === ${JSON.stringify(DICTS.ja['city.side.collectAll'])}`, 6000),
    'al cambiar el idioma, el HUD y los botones de la ciudad se repintan');
  ok(await page.evaluate((tip) => document.querySelector('#hud [data-hud="coins"]')?.getAttribute('data-tip') === tip, DICTS.ja['hud.coins.tip']), 'también las pistas (data-tip) del HUD');
} catch (e) {
  fail++; console.log('  ✗ excepción: ' + (e.stack || e.message));
} finally {
  const errs = errors.filter(e => !/net::ERR|favicon/.test(e));
  ok(!errs.length, 'sin errores en la página', errs.slice(0, 5).join('\n      '));
  await browser.close();
  server.close();
  console.log(`\n${pass} bien, ${fail} mal`);
  process.exit(fail ? 1 : 0);
}
