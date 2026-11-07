// Ciudad llena para las épocas (Fase 4): llena el terreno con casas, negocios y deco de varios niveles y épocas,
// saca una captura con la cámara por defecto y mide triángulos por modelo y fps (Chrome headless: los fps solo sirven
// para comparar entre versiones, no son los de un iPhone).
//
//   node tools/era-city.mjs [--rank 8] [--era mix|1..5] [--level mix|1..5] [--device iphone|desktop] [--shot out.png]
//                           [--zoom 1] [--theme pueblo]
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
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
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport(VIEWS[opt('device', 'iphone')] || VIEWS.iphone);
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });

const cfg = { rank: Number(opt('rank', 8)), era: String(opt('era', 'mix')), level: String(opt('level', 'mix')), theme: String(opt('theme', 'pueblo')) };
await page.goto(BASE + '?scene=city&nosplash&nosw&reset&cheat=40', { waitUntil: 'load' });
await page.waitForFunction('window.__pixelia && window.__pixelia.store', { timeout: 60000 });
await new Promise(r => setTimeout(r, 1500));
const placed = await page.evaluate(async (cfg) => {
  const { store, data, economy: E } = window.__pixelia;
  const { todayStr } = await import('/src/core/state.js');
  const s = store.state;
  s.onboarded = true;
  s.login.last = todayStr();          // sin el premio diario encima de la captura
  s.city.expansions = data.MAX_EXPANSIONS;
  s.city.theme = cfg.theme;
  const castle = s.city.buildings.find(b => b.id === 'castillo');
  castle.level = cfg.rank;
  const { min, max } = E.landBounds(s);
  const ids2 = ['casita', 'cabana', 'chalet', 'torre_cristal', 'panaderia', 'heladeria', 'floreria', 'cafeteria', 'salon', 'pasteleria', 'boutique'];
  const ids3 = ['mansion', 'cine', 'spa', 'teatro', 'rueda'];
  let uid = s.city.nextUid, n = 0;
  const occupied = (x, z, w, d) => !E.canPlace('casita', x, z, 0, null, s).ok && w === 2 && d === 2;
  const put = (id, x, z, i) => {
    const [w, d] = data.BUILDING_BY_ID[id].size;
    if (!E.canPlace(id, x, z, 0, null, s).ok) return false;
    const era = cfg.era === 'mix' ? 1 + ((x * 7 + z * 3 + i) % 5) : Number(cfg.era);
    const level = cfg.level === 'mix' ? 1 + ((x * 5 + z * 11 + i) % 5) : Number(cfg.level);
    s.city.buildings.push({ uid: uid++, id, x, z, rot: 0, level, era, buildEnd: 0, upgradeEnd: 0, lastCollect: Date.now() });
    n++; return true;
  };
  let i = 0;
  // calles: una fila de caminos cada 5 tiles; manzanas de edificios de 2×2 y alguno de 3×3
  for (let z = min; z < max; z++) for (let x = min; x < max; x++) {
    if ((x - min) % 5 === 4 || (z - min) % 5 === 4) { if (E.canPlace('camino', x, z, 0, null, s).ok) s.city.buildings.push({ uid: uid++, id: 'camino', x, z, rot: 0, level: 1, buildEnd: 0, upgradeEnd: 0, lastCollect: 0 }); }
  }
  for (let z = min; z < max - 1; z++) for (let x = min; x < max - 1; x++) {
    i++;
    if (i % 9 === 0 && put(ids3[i % ids3.length], x, z, i)) continue;
    put(ids2[i % ids2.length], x, z, i);
  }
  for (let z = min; z < max; z++) for (let x = min; x < max; x++) if (E.canPlace('arbol', x, z, 0, null, s).ok) s.city.buildings.push({ uid: uid++, id: (x + z) % 3 ? 'arbol' : 'farol', x, z, rot: 0, level: 1, buildEnd: 0, upgradeEnd: 0, lastCollect: 0 });
  s.city.nextUid = uid;
  store.save();
  return { n, total: s.city.buildings.length };
}, cfg);
await page.goto(BASE + '?scene=city&nosplash&nosw', { waitUntil: 'load' });
await page.waitForFunction('window.__pixelia && document.querySelector("#scene canvas")', { timeout: 60000 });
await new Promise(r => setTimeout(r, Number(opt('wait', 5000))));
// --nohud: esconde el HUD y los avisos para mirar solo la ciudad
if (opt('nohud', false)) await page.addStyleTag({ content: '#hud, .modal, .modal-back, .toast, .cx-bubble, .cx-timer { display: none !important; }' });
const stats = await page.evaluate(async () => {
  const M = await import('/src/city/models.js');
  const { store } = window.__pixelia;
  let tris = 0, maxTris = 0, maxId = '';
  const per = {};
  for (const b of store.state.city.buildings) {
    const g = M.buildingModel(b.id, b.level, { era: b.era, theme: store.state.city.theme });
    let t = 0;
    g.traverse(o => { if (o.isMesh) t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    tris += t;
    const k = b.id + ' E' + (g.userData.era || 1) + ' L' + b.level;
    per[k] = t;
    if (t > maxTris) { maxTris = t; maxId = k; }
  }
  const fps = await new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); });
  const top = Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return { tris: Math.round(tris), maxTris, maxId, fps: Math.round(fps * 10) / 10, top };
});
console.log('edificios', placed, '\n', JSON.stringify(stats, null, 1));
const shot = opt('shot', null);
if (shot) { const f = resolve(process.cwd(), shot); mkdirSync(dirname(f), { recursive: true }); await page.screenshot({ path: f }); console.log('captura:', f); }
await browser.close(); server.close();
if (errors.length) { console.log('\n=== ERRORES ===\n' + [...new Set(errors)].join('\n')); process.exit(1); }
console.log('OK');
