// Prueba de humo con Chrome headless: abre el juego, ejecuta pasos, saca capturas y lista errores.
//
//   node tools/smoke.mjs --scene match3 --shot shots/m3.png
//   node tools/smoke.mjs --scene city --device desktop --wait 3000 --shot shots/city.png
//   node tools/smoke.mjs --scene city --steps tools/steps-example.json
//   node tools/smoke.mjs --url "?scene=parking&cheat=10" --eval "window.__pixelia.store.state.coins"
//
// Opciones:
//   --scene <id>        escena inicial (city, wardrobe, match3, blocks, parking, driving)
//   --url <query>       query string completo (reemplaza --scene). Siempre se agrega nosplash&nosw.
//   --device iphone|desktop|ipad   (default iphone: 390x844 @3x táctil)
//   --wait <ms>         espera tras cargar (default 2500)
//   --shot <png>        captura final
//   --eval <js>         expresión a evaluar al final; imprime el resultado
//   --steps <json>      archivo con pasos: [{"tap":[x,y]}, {"drag":[x1,y1,x2,y2]}, {"key":"ArrowLeft"},
//                       {"wait":500}, {"eval":"js"}, {"shot":"a.png"}, {"click":"css selector"}]
//   --fresh             borra el guardado antes (default: sí; usar --keep para conservarlo)
//   --cheat <nivel>     agrega monedas/gemas y sube al nivel indicado
//
// Sale con código 1 si hubo errores de página (excepciones o console.error).
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : def; };

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
const port = server.address().port;

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const device = opt('device', 'iphone');
const VIEW = {
  iphone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  ipad: { width: 820, height: 1180, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  desktop: { width: 1366, height: 800, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
}[device];
await page.setViewport(VIEW);
if (device !== 'desktop') await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');

const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); else if (m.type() === 'warning') console.log('warn:', m.text()); });
page.on('requestfailed', r => errors.push('REQFAILED: ' + r.url() + ' ' + r.failure()?.errorText));
page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });

let query = opt('url', null);
if (!query) query = '?scene=' + opt('scene', 'city');
if (!query.startsWith('?')) query = '?' + query;
query += '&nosplash&nosw';
const cheat = opt('cheat', null);
if (cheat) query += '&cheat=' + cheat;
if (!opt('keep', false)) query += '&reset';
const url = `http://127.0.0.1:${port}/${query}`;
console.log('URL', url);
await page.goto(url, { waitUntil: 'load' });
// quitar &reset de la URL para que recargas no borren de nuevo
await page.evaluate(() => history.replaceState(null, '', location.href.replace('&reset', '')));
await new Promise(r => setTimeout(r, Number(opt('wait', 2500))));

async function shot(p) {
  const f = resolve(process.cwd(), p);
  mkdirSync(dirname(f), { recursive: true });
  await page.screenshot({ path: f });
  console.log('captura:', f);
}
async function tap(x, y) {
  if (VIEW.hasTouch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
}
async function drag(x1, y1, x2, y2, steps = 12) {
  // con eventos de puntero de mouse (funcionan con pointer events en ambos casos)
  await page.mouse.move(x1, y1); await page.mouse.down();
  for (let i = 1; i <= steps; i++) { await page.mouse.move(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps); await new Promise(r => setTimeout(r, 16)); }
  await page.mouse.up();
}

const stepsFile = opt('steps', null);
if (stepsFile) {
  const steps = JSON.parse(readFileSync(stepsFile, 'utf8'));
  for (const s of steps) {
    if (s.tap) await tap(...s.tap);
    if (s.click) await page.click(s.click).catch(e => errors.push('STEP click ' + s.click + ': ' + e.message));
    if (s.drag) await drag(...s.drag);
    if (s.key) await page.keyboard.press(s.key);
    if (s.keydown) await page.keyboard.down(s.keydown);
    if (s.keyup) await page.keyboard.up(s.keyup);
    if (s.wait) await new Promise(r => setTimeout(r, s.wait));
    if (s.eval) console.log('eval>', JSON.stringify(await page.evaluate(s.eval).catch(e => 'ERR ' + e.message)));
    if (s.shot) await shot(s.shot);
  }
}
const ev = opt('eval', null);
if (ev) console.log('eval>', JSON.stringify(await page.evaluate(ev).catch(e => 'ERR ' + e.message), null, 1));
const sp = opt('shot', null);
if (sp) await shot(sp);

await browser.close();
server.close();
if (errors.length) { console.log('\n=== ERRORES ===\n' + [...new Set(errors)].join('\n')); process.exit(1); }
console.log('OK sin errores');
