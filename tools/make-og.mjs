// Genera og.jpg (1200x630) para compartir el link: una captura real de la ciudad (armada acá, sin HUD)
// con el logo pixel y el lema encima. Usa Chrome headless como tools/smoke.mjs.
//
//   node tools/make-og.mjs                      (escribe og.jpg en la raíz)
//   node tools/make-og.mjs --theme bosque       (otro estilo de ciudad: pastel, moderna, bosque, playa, invierno, noche)
//   node tools/make-og.mjs --cam -3,2,15,0      (cámara x,z,zoom,rotación) --raw shots/og-raw.png (guarda la captura sin logo)
//   node tools/make-og.mjs --out shots/og.png   (si la salida termina en .png sale en PNG)
//
// JPEG calidad 90 y no PNG: en PNG pesa ~500 KB y WhatsApp suele no mostrar la imagen del link si pasa ~300 KB.
// Después de regenerarla, mirala (que se lea el logo y que pese < 300 KB).
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { crownSvg, wordSvg } from './make-logo.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const THEME = opt('theme', 'pastel');
const OUT = resolve(process.cwd(), opt('out', join(ROOT, 'og.jpg')));
const PNG = /\.png$/i.test(OUT);
const RAW = opt('raw', null);
const [camX, camZ, camU, camRot] = opt('cam', '-3.6,3.6,15,0').split(',').map(Number);
const W = 1200, H = 630;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };
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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const cityUp = () => page.waitForFunction(() => window.__pixelia?.city && window.__pixelia.ctx.router.current === 'city', { timeout: 60000, polling: 200 });

// ---------- 1) armar la ciudad y guardarla ----------
await page.goto(BASE + '?scene=city&nosplash&nosw&reset&cheat=30', { waitUntil: 'load' });
await cityUp();
await page.evaluate((theme, cam) => {
  const { store, economy: E, quests: Q } = window.__pixelia;
  const s = store.state;
  s.onboarded = true;
  s.player.name = 'Pixelia';
  s.city.theme = theme;
  s.city.expansions = 8;   // isla completa: sin carteles de "¡Expandir!"
  s.city.camera = cam;
  try { Q.claimLogin(); } catch {}
  const now = Date.now();
  const list = [];
  const put = (id, x, z, rot = 0, level = 1) => list.push([id, x, z, rot, level]);
  // anillo de caminos rosas alrededor del castillo (12..15) y avenidas hacia los cuatro lados
  for (let i = 11; i <= 16; i++) { put('camino_rosa', i, 11); put('camino_rosa', i, 16); if (i > 11 && i < 16) { put('camino_rosa', 11, i); put('camino_rosa', 16, i); } }
  for (let i = 4; i <= 10; i++) { put('camino_rosa', 13, i); put('camino_rosa', i, 13); }
  for (let i = 17; i <= 23; i++) { put('camino_rosa', 13, i); put('camino_rosa', i, 13); }
  // frente del castillo (lado z grande, el que mira a la cámara)
  put('fuente', 14, 18); put('cerezo', 12, 17); put('cerezo', 16, 17); put('farol', 12, 18); put('farol', 16, 19);
  put('heladeria', 17, 17, 2); put('cafeteria', 19, 17, 2, 2); put('pasteleria', 21, 17, 2); put('macetas', 23, 17);
  put('boutique', 17, 19, 2, 2); put('floreria', 19, 19, 2); put('salon', 21, 19, 2);
  put('rueda', 17, 21); put('cine', 20, 21, 0, 2);
  put('casita', 9, 17, 3); put('cabana', 7, 17, 3, 2); put('chalet', 5, 17, 3);
  put('mansion', 9, 19, 0, 2); put('torre_cristal', 6, 19); put('casita', 4, 21); put('banco', 12, 21);
  put('joyeria', 11, 19); put('boutique_real', 11, 21, 0); put('glorieta', 14, 20); put('unicornio', 14, 22);
  // costado derecho y fondo
  put('panaderia', 17, 14, 1); put('torre_bloques', 17, 11, 1); put('garaje', 19, 10); put('teatro', 20, 14, 1);
  put('spa', 17, 6); put('lago', 20, 6); put('pista', 14, 5); put('estatua', 14, 9);
  put('cabana', 9, 11, 1); put('chalet', 9, 14, 1); put('casita', 6, 14, 1); put('cabana', 6, 11, 1); put('lago', 5, 5);
  put('mansion', 9, 5); put('casita', 9, 8); put('chalet', 6, 8); put('torre_cristal', 4, 8);
  put('arco_rosas', 13, 17); put('macetas', 23, 19); put('banco', 16, 21);
  put('casita', 24, 16, 2); put('cabana', 24, 19, 2); put('chalet', 24, 22, 2); put('heladeria', 17, 24); put('casita', 20, 24); put('floreria', 23, 25);
  // árboles, arbustos y faroles donde queda lugar
  const fill = ['arbol', 'arbusto', 'cerezo', 'arbol', 'arbusto', 'farol', 'arbol', 'cerezo'];
  let k = 0;
  const kept = [];
  const occ = (x, z) => kept.some(([id, bx, bz, rot]) => { const [w, d] = E.footprint(id, rot); return x >= bx && x < bx + w && z >= bz && z < bz + d; });
  const ok = (id, x, z, rot) => { const [w, d] = E.footprint(id, rot); if (x < 0 || z < 0 || x + w > 28 || z + d > 28) return false; for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) if (occ(x + i, z + j)) return false; return true; };
  s.city.buildings = s.city.buildings.filter(b => b.id === 'castillo');
  kept.push(['castillo', 12, 12, 0]);
  for (const e of list) if (ok(e[0], e[1], e[2], e[3])) kept.push(e);
  for (let x = 1; x < 27; x++) for (let z = 1; z < 27; z++) {
    const h = (x * 73 + z * 151) % 11, out = x < 4 || z < 4 || x > 23 || z > 23;
    if (h < (out ? 7 : 5) && !occ(x, z)) kept.push([fill[k++ % fill.length], x, z, 0, 1]);
  }
  for (const [id, x, z, rot, level] of kept.slice(1)) s.city.buildings.push({ uid: s.city.nextUid++, id, x, z, rot, level, buildEnd: 0, upgradeEnd: 0, lastCollect: now });
  s.city.buildings[0].level = 3;
  store.markDirty(); store.save();
}, THEME, { x: camX, z: camZ, u: camU, rot: camRot });

// ---------- 2) recargar sin reset, sin HUD ni carteles ----------
await page.goto(BASE + '?scene=city&nosplash&nosw', { waitUntil: 'load' });
await cityUp();
await sleep(2500);
await page.evaluate(() => {
  const px = window.__pixelia;
  px.ctx.hud.hide();
  document.querySelectorAll('#modal-root > *, #toast-root > *').forEach(e => e.remove());
  const st = document.createElement('style');
  st.textContent = '#hud, #toast-root, #modal-root, #fx-root, #splash, .cx-side, .cx-sign, .cx-tip, .cx-tagwrap, .cx-pin, .cx-timer { display: none !important; }';
  document.head.append(st);
});
await sleep(1500);
const shot = await page.screenshot({ type: 'png' });
if (RAW) { const f = resolve(process.cwd(), RAW); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, shot); console.log('captura cruda:', f); }

// ---------- 3) componer logo + lema encima ----------
const font = readFileSync(join(ROOT, 'fonts', 'jersey10.woff2')).toString('base64');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: 'Jersey'; src: url(data:font/woff2;base64,${font}) format('woff2'); size-adjust: 122%; }
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #ffb8dc; }
  .bg { position: absolute; inset: 0; width: ${W}px; height: ${H}px; image-rendering: pixelated; }
  .veil { position: absolute; inset: 0; background:
    linear-gradient(90deg, rgba(255,214,234,.97) 0, rgba(255,206,230,.93) 30%, rgba(255,200,228,.55) 44%, rgba(255,200,228,0) 58%); }
  .brand { position: absolute; left: 70px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; align-items: flex-start;
    font-family: 'Jersey', sans-serif; color: #3b2340; letter-spacing: .02em; }
  .crown { width: 112px; height: 80px; margin-left: 6px; filter: drop-shadow(0 6px 0 rgba(59,35,64,.25)); }
  .word { width: 430px; height: 130px; margin-top: 18px; }
  .sub { margin: 18px 0 0 4px; font-size: 52px; line-height: 1; }
  .pill { margin: 26px 0 0 2px; padding: 8px 18px 11px; font-size: 27px; line-height: 1; background: #fff7fb; border: 3px solid #3b2340; border-radius: 12px; box-shadow: 0 4px 0 #3b2340; }
  .pill b { color: #c43c7c; font-weight: inherit; }
</style></head><body>
  <img class="bg" src="data:image/png;base64,${shot.toString('base64')}">
  <div class="veil"></div>
  <div class="brand">
    ${crownSvg('class="crown"')}
    ${wordSvg('Pixelia', 'class="word"')}
    <div class="sub">Tu ciudad, tu estilo</div>
    <div class="pill">Construí, decorá y jugá · <b>gratis</b></div>
  </div>
</body></html>`;
const comp = await browser.newPage();
await comp.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await comp.setContent(html, { waitUntil: 'load' });
await comp.evaluate(() => document.fonts.ready);
mkdirSync(dirname(OUT), { recursive: true });
await comp.screenshot(PNG ? { path: OUT, type: 'png' } : { path: OUT, type: 'jpeg', quality: 90 });
const kb = statSync(OUT).size / 1024;
console.log(`og: ${OUT} (${W}x${H}, ${kb.toFixed(0)} KB)${kb > 300 ? '  ¡OJO: pesa más de 300 KB (WhatsApp puede no mostrarla)!' : ''}`);
if (errors.length) console.log('errores de página:\n  ' + errors.join('\n  '));

await browser.close();
server.close();
