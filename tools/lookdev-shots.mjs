// Capturas del diorama de lookdev (tools/lookdev.html) con Chrome headless (SwiftShader: no usa la GPU).
//   node tools/lookdev-shots.mjs                 → shots/lookdev/<cam>-h<hora>-<render>.png (día, tarde, atardecer, noche)
//   node tools/lookdev-shots.mjs --hours 15,22.5 --cams cine --renders photo
//   node tools/lookdev-shots.mjs --check         → no saca la serie: compara greedy=0 contra greedy=1 pixel a pixel y
//                                                  prueba el worker de mallas con su caché (sale con 1 si algo no da)
//   node tools/lookdev-shots.mjs --bench         → costo por cuadro de classic, post y photo con la GPU de verdad (corrida corta)
//   --out <carpeta> (default shots/lookdev) · --size 1366x800 · --tag <sufijo>
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const EXTRA = opt("query", "") ? "&" + opt("query") : "";
const CHECK = !!opt('check', false);
const BENCH = !!opt('bench', false);
const HOURS = String(opt('hours', '9,15,19.5,22.5')).split(',').map(Number);
const CAMS = String(opt('cams', 'iso,cine')).split(',');
const RENDERS = String(opt('renders', BENCH ? 'classic,post,photo' : 'classic,photo')).split(',');
const OUT = resolve(ROOT, String(opt('out', 'shots/lookdev')));
const [W, H] = String(opt('size', '1366x800')).split('x').map(Number);
const TAG = opt('tag', '') ? '-' + opt('tag') : '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.vox': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join(ROOT, p);
  if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/tools/lookdev.html`;
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: BENCH ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ✔', msg); } else { fail++; console.log('  ✘', msg, extra !== undefined ? JSON.stringify(extra) : ''); } return !!c; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hooked = new WeakSet();

async function open(query, page) {
  page = page || await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  if (!hooked.has(page)) {
    hooked.add(page);
    page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
    page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  }
  await page.goto(`${BASE}?${query}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', { timeout: 90000 }).catch(() => errors.push('timeout: ' + query));
  await sleep(700);
  return page;
}
const stats = (page) => page.evaluate('window.__lookdev && window.__lookdev.stats()');

if (BENCH) {
  for (const cam of CAMS) for (const render of RENDERS) {
    const page = await open(`cam=${cam}&hour=${HOURS[0]}&render=${render}&still=1${EXTRA}`);
    const b = await page.evaluate('window.__lookdev.bench(40)');
    console.log(`bench ${cam} ${render}:`, JSON.stringify(b), JSON.stringify((await stats(page)).light));
    await page.close();
  }
} else if (!CHECK) {
  mkdirSync(OUT, { recursive: true });
  for (const cam of CAMS) for (const h of HOURS) for (const render of RENDERS) {
    const page = await open(`cam=${cam}&hour=${h}&render=${render}${EXTRA}`);
    const f = join(OUT, `${cam}-h${String(h).replace('.', '_')}-${render}${TAG}.png`);
    await page.screenshot({ path: f });
    const s = await stats(page);
    console.log('captura:', f, JSON.stringify({ postOn: s?.postOn, verts: s?.verts, faces: s?.faces, triangles: s?.triangles }));
    await page.close();
  }
} else {
  console.log('■ Greedy meshing: mismas capturas');
  const shot = async (query) => { const p = await open(query); const b64 = await p.screenshot({ encoding: 'base64' }); const s = await stats(p); await p.close(); return { b64, s }; };
  const cmp = await browser.newPage();
  const diff = (a, b) => cmp.evaluate(async (a, b) => {
    const load = (s) => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
    const [A, B] = await Promise.all([load(a), load(b)]);
    const px = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    const x = px(A), y = px(B);
    let n = 0, max = 0;
    for (let i = 0; i < x.length; i += 4) { const d = Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2])); if (d > 8) n++; if (d > max) max = d; }
    return { n, max, total: x.length / 4 };
  }, a, b);
  for (const cam of ['iso', 'cine']) {
    const q = `cam=${cam}&hour=15&render=classic&still=1`;
    const a = await shot(q + '&greedy=0'), b = await shot(q + '&greedy=1');
    const d = await diff(a.b64, b.b64);
    console.log(`    ${cam}: vértices ${a.s.verts} → ${b.s.verts} (${Math.round(100 - b.s.verts / a.s.verts * 100)} % menos), triángulos por cuadro ${a.s.triangles} → ${b.s.triangles}`);
    ok(a.s.faces === b.s.faces && b.s.verts < a.s.verts, `${cam}: mismas caras al aire, menos vértices`);
    // se tolera un puñado de pixeles (el antialias redondea distinto en algún borde)
    ok(d.n <= d.total * 0.0005, `${cam}: la captura no cambia (${d.n} de ${d.total} pixeles distintos, diferencia máxima ${d.max})`, d);
  }

  console.log('\n■ Worker de mallas y caché');
  const Q = 'cam=iso&hour=15&render=classic&still=1&async=1';
  const page = await open(Q);
  await page.evaluate(async () => { const v = await import('/src/core/voxel.js'); await v.clearMeshCache(); });
  await open(Q, page);
  const s1 = await stats(page);
  ok(s1.workerBuilds === 4 && s1.cacheHits === 0, `primera vez: 4 mallas armadas en el worker (${s1.terrainMs} ms)`, s1);
  const shotA = await page.screenshot({ encoding: 'base64' });
  await sleep(500); // que termine de guardar en IndexedDB
  await open(Q, page);
  const s2 = await stats(page);
  ok(s2.cacheHits === 4 && s2.workerBuilds === 0, `segunda vez: 4 mallas del caché de IndexedDB (${s2.terrainMs} ms)`, s2);
  const shotB = await page.screenshot({ encoding: 'base64' });
  const sync = await open('cam=iso&hour=15&render=classic&still=1');
  const shotS = await sync.screenshot({ encoding: 'base64' });
  const dA = await diff(shotA, shotS), dB = await diff(shotB, shotS);
  ok(dA.n === 0 && dB.n === 0, 'worker, caché y sincrónico dan la misma captura', { dA, dB });
  await sync.close(); await cmp.close(); await page.close();
}

await browser.close(); server.close();
if (errors.length) console.log('\n=== ERRORES DE PÁGINA ===\n' + [...new Set(errors)].join('\n'));
if (CHECK || errors.length) console.log(`\n${fail || errors.length ? '✘' : '✔'} ${pass} OK, ${fail} fallas, ${new Set(errors).size} errores de página`);
process.exit(fail || errors.length ? 1 : 0);
