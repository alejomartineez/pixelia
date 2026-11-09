// Captura de la galería de modelos (tools/gallery.html) con Chrome headless.
//   node tools/gallery-shot.mjs "<query>" out.png [ancho] [alto] [esperaMs]
//   ej: node tools/gallery-shot.mjs "cat=casa&levels=1,3,5" shots/casas.png 1366 800
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [query = '', out = 'gallery.png', W = '1366', H = '800', wait = '1200', evalExpr = ''] = process.argv.slice(2);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join(ROOT, p);
  if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: Number(W), height: Number(H), deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); else if (m.type() === 'warning') console.log('warn:', m.text()); else console.log('log:', m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${server.address().port}/tools/${process.env.GALLERY_PAGE || 'gallery.html'}?${query}`, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 60000 }).catch(e => errors.push('timeout ready'));
console.log('listo en', Date.now() - t0, 'ms');
await new Promise(r => setTimeout(r, Number(wait)));
if (evalExpr) console.log('eval>', JSON.stringify(await page.evaluate(evalExpr).catch(e => 'ERR ' + e.message), null, 1));
const f = resolve(process.cwd(), out);
mkdirSync(dirname(f), { recursive: true });
await page.screenshot({ path: f });
console.log('captura:', f);
await browser.close(); server.close();
if (errors.length) { console.log('\n=== ERRORES ===\n' + [...new Set(errors)].join('\n')); process.exit(1); }
console.log('OK');
