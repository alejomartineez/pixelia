// Estrés de navegación: recorre todas las escenas (ciudad, visita, vestidor, 4 minijuegos) y todos los paneles
// N veces y mide fugas: contextos WebGL vivos, canvas en el DOM, listeners de window/document, listeners del bus,
// intervalos activos, <style> inyectados y modales abiertos. Compara cada vuelta contra la primera.
//
//   node tools/test-stress.mjs [--rounds 3] [--device iphone|desktop]
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const ROUNDS = Number(opt('rounds', 3));
const DEVICE = opt('device', 'iphone');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
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
const VIEWS = {
  iphone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1366, height: 800, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--max-active-webgl-contexts=32'] });
const errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ✔', msg); } else { fail++; console.log('  ✘', msg, extra !== undefined ? JSON.stringify(extra) : ''); } return !!c; };

// Instrumentación antes de que cargue el juego
const INSTRUMENT = () => {
  const T = window.__leak = { gl: [], win: new Map(), doc: new Map(), intervals: new Set(), bus: null };
  const key = (type, fn, opts) => type + '|' + (typeof opts === 'boolean' ? opts : !!opts?.capture) + '|' + (T.ids.get(fn) ?? T.ids.set(fn, T.ids.size).get(fn));
  T.ids = new WeakMap(); T.ids.size = 0;
  const idOf = (fn) => { if (!T.ids.has(fn)) { T.ids.set(fn, ++T.ids.size); } return T.ids.get(fn); };
  const k2 = (type, fn, opts) => type + '|' + (typeof opts === 'boolean' ? opts : !!opts?.capture) + '|' + idOf(fn);
  const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (fn && (this === window || this === document)) {
      const m = this === window ? T.win : T.doc;
      if (!(typeof opts === 'object' && opts?.once)) m.set(k2(type, fn, opts), type);
    }
    return add.call(this, type, fn, opts);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, opts) {
    if (fn && (this === window || this === document)) (this === window ? T.win : T.doc).delete(k2(type, fn, opts));
    return rem.call(this, type, fn, opts);
  };
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...a) {
    const c = gc.call(this, kind, ...a);
    if (c && /webgl/.test(kind) && !T.gl.some(x => x.deref?.() === c)) T.gl.push(new WeakRef(c));
    return c;
  };
  const si = window.setInterval, ci = window.clearInterval;
  window.setInterval = function (...a) { const id = si.apply(this, a); T.intervals.add(id); return id; };
  window.clearInterval = function (id) { T.intervals.delete(id); return ci.call(this, id); };
};
const MEASURE = async () => {
  const T = window.__leak;
  if (!T.bus) {
    const { bus } = await import('/src/core/bus.js');
    T.bus = new Map();
    const on = bus.on.bind(bus), off = bus.off.bind(bus);
    bus.on = (n, f) => { if (!T.bus.has(n)) T.bus.set(n, new Set()); T.bus.get(n).add(f); on(n, f); return () => bus.off(n, f); };
    bus.off = (n, f) => { T.bus.get(n)?.delete(f); off(n, f); };
  }
  const liveGl = T.gl.map(r => r.deref()).filter(c => c && !c.isContextLost()).length;
  const busN = [...T.bus.values()].reduce((a, s) => a + s.size, 0);
  const byType = (m) => { const o = {}; for (const t of m.values()) o[t] = (o[t] || 0) + 1; return o; };
  return {
    gl: liveGl, canvas: document.querySelectorAll('canvas').length, win: T.win.size, doc: T.doc.size,
    bus: busN, intervals: T.intervals.size, styles: document.querySelectorAll('style').length,
    modals: document.querySelectorAll('.modal').length, overlays: document.querySelectorAll('.chx-open, .alb-open, .fx-layer > *').length,
    nodes: document.getElementsByTagName('*').length, winTypes: byType(T.win), docTypes: byType(T.doc),
  };
};

const page = await browser.newPage();
await page.setViewport(VIEWS[DEVICE]);
await page.evaluateOnNewDocument(INSTRUMENT);
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });

// bea tiene una ciudad publicada para poder visitarla
const pb = await browser.newPage();
await pb.goto(`${BASE}?scene=city&mock=1&mockuser=bea&reset&cheat=6&nosplash&nosw`, { waitUntil: 'load' });
await pb.evaluate(() => { localStorage.removeItem('pixelia.mockdb'); });
await pb.reload({ waitUntil: 'load' });
await pb.waitForFunction(() => window.__pixelia?.ctx?.social, { timeout: 20000, polling: 150 });
const beaCode = await pb.evaluate(async () => (await window.__pixelia.net.getMyProfile()).code);

await page.goto(`${BASE}?scene=city&mock=1&mockuser=ana&reset&cheat=12&nosplash&nosw`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__pixelia?.ctx?.social, { timeout: 20000, polling: 150 });
const beaId = await page.evaluate(async (code) => {
  const { net } = window.__pixelia;
  await net.requestFriend(code);
  return (await net.findByCode(code)).id;
}, beaCode);
await pb.evaluate(async () => { const { net } = window.__pixelia; const f = (await net.listFriends())[0]; await net.respondFriend(f.id, true); const s = await import('/src/online/sync.js'); await s.publishProfileNow(true); });
await pb.close();
await page.evaluate(async () => {
  const { store, ctx } = window.__pixelia;
  const { todayStr } = await import('/src/core/state.js');
  store.state.login.last = todayStr();
  // edificios de los juegos para poder abrirlos
  ctx.ui.closeAllModals();
});
await sleep(1500);

const go = (id, params = {}) => page.evaluate(async (id, params) => {
  const { ctx } = window.__pixelia;
  ctx.ui.closeAllModals();
  for (let i = 0; i < 40 && document.querySelector('.chx-open, .alb-open'); i++) await new Promise(r => setTimeout(r, 100));
  const r = await ctx.router.go(id, params);
  await new Promise(r => setTimeout(r, 900));
  return r && ctx.router.current === id;
}, id, params);
const panel = (code) => page.evaluate(async (code) => {
  const { ctx } = window.__pixelia;
  const p = (0, eval)(`(ctx) => ${code}`)(ctx);
  await new Promise(r => setTimeout(r, 700));
  const had = document.querySelectorAll('.modal').length;
  ctx.ui.closeAllModals();
  await new Promise(r => setTimeout(r, 350));
  return had;
}, code);

const PANELS = [
  ['Juegos', `ctx.openPanel('games')`], ['Misiones', `ctx.openPanel('quests')`], ['Ajustes', `ctx.openPanel('settings')`],
  ['Ayuda', `ctx.openPanel('help')`], ['Cofres', `ctx.openChests()`], ['Mochila', `ctx.openChests({ tab: 'mochila' })`],
  ['Álbum', `ctx.openAlbum()`], ['Pase', `ctx.openSeasonPass()`], ['Eventos', `ctx.openEvents()`],
  ['Amigas', `ctx.openSocial('amigas')`], ['Buzón', `ctx.openSocial('buzon')`], ['Ranking', `ctx.openSocial('ranking')`],
  ['Equipo', `ctx.openSocial('equipo')`], ['Cuenta', `ctx.openAccount()`], ['Tu ciudad', `ctx.openPanel('rank')`], ['Obras', `ctx.openPanel('works')`],
  // selector de estilo de ciudad: maquetas con su propio WebGL (se libera a los 1,5 s)
  ['Temas', `import('/src/city/themes-ui.js').then(m => { m.openThemePicker(ctx); })`],
  ['Construir', `ctx.bus.emit('hud:build')`],
];
const SCENES = [['onboarding'], ['wardrobe'], ['match3'], ['blocks'], ['parking'], ['driving'], ['city', { visit: null }], ['wardrobe', { tab: 'car' }]];

await page.evaluate(() => window.__pixelia && null);
await page.evaluate((s) => (0, eval)(`(${s})()`), MEASURE.toString()).catch(() => {});
const measure = () => page.evaluate((s) => (0, eval)(`(${s})()`), MEASURE.toString());
const results = [];
for (let round = 1; round <= ROUNDS; round++) {
  console.log(`\n■ Vuelta ${round}`);
  let okScenes = 0, okPanels = 0;
  for (const [id, params] of SCENES) {
    const p = params?.visit === null ? { visit: beaId, name: 'Bea' } : params;
    if (await go(id, p || {})) okScenes++; else console.log('    no entró a', id, JSON.stringify(p || {}));
    if (id === 'city' && p?.visit) await sleep(1200);
    if (await go('city')) okScenes++;
    for (const [name, code] of PANELS) {
      const had = await panel(code);
      if (had) okPanels++; else console.log('    no abrió', name);
    }
    if (id !== 'match3') continue;
  }
  await go('city');
  await sleep(1500);
  const m = await measure();
  results.push(m);
  ok(okScenes === SCENES.length * 2, `escenas: ${okScenes}/${SCENES.length * 2} navegaciones`);
  ok(okPanels >= PANELS.length * SCENES.length - 1, `paneles: ${okPanels}/${PANELS.length * SCENES.length} aperturas`);
  console.log('    medición:', JSON.stringify({ ...m, winTypes: undefined, docTypes: undefined }));
}
const [a, , c] = [results[0], results[1], results.at(-1)];
console.log('\n■ Fugas (última vuelta vs. primera)');
ok(c.gl <= a.gl && c.gl <= 2, `contextos WebGL vivos: ${a.gl} → ${c.gl}`);
ok(c.canvas <= a.canvas, `canvas en el DOM: ${a.canvas} → ${c.canvas}`);
ok(c.win <= a.win, `listeners en window: ${a.win} → ${c.win}`, c.win > a.win ? { antes: a.winTypes, despues: c.winTypes } : undefined);
ok(c.doc <= a.doc, `listeners en document: ${a.doc} → ${c.doc}`, c.doc > a.doc ? { antes: a.docTypes, despues: c.docTypes } : undefined);
ok(c.bus <= a.bus, `listeners del bus: ${a.bus} → ${c.bus}`);
ok(c.intervals <= a.intervals, `intervalos activos: ${a.intervals} → ${c.intervals}`);
ok(c.styles <= a.styles, `<style> en el documento: ${a.styles} → ${c.styles}`);
ok(c.modals === 0 && c.overlays === 0, `sin modales ni overlays colgados (${c.modals}/${c.overlays})`);
ok(c.nodes <= a.nodes * 1.1, `nodos del DOM: ${a.nodes} → ${c.nodes}`);

await browser.close();
server.close();
if (errors.length) console.log('\n=== ERRORES DE PÁGINA ===\n' + [...new Set(errors)].join('\n'));
console.log(`\n${fail || errors.length ? '✘' : '✔'} ${pass} OK, ${fail} fallas, ${new Set(errors).size} errores de página`);
process.exit(fail || errors.length ? 1 : 0);
