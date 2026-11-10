// Capturas de "El Quiebre" plano por plano (PLAN-TRAVESIA §3b), para revisarlas una por una: Chrome headless con
// SwiftShader (va por CPU, no carga la placa). Por cada plano arma una hoja con varios instantes (con los carteles y
// el subtítulo de ese momento) en shots/intro/plano-NN.png.
//   node intro-shots.mjs                      → los 11 planos, 6 instantes cada uno
//   node intro-shots.mjs --shots 1,4 --n 8    → solo esos planos (de 1 a 11), 8 instantes
//   node intro-shots.mjs --lang ja --at 3.2   → un instante (en segundos) de cada plano, en japonés
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const N = Number(opt('n', 6)), LANG = opt('lang', 'es'), AT = opt('at', null), W = 960, H = 540;
const OUT = join(ROOT, 'shots/intro');
mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.m4a': 'audio/mp4' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(ROOT, p);
  if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(String(e.message)));
page.on('console', m => { if (m.type() === 'error' || /\[cine\]|\[viñeta\]|\[i18n\]/.test(m.text())) errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/?reset&scene=intro&fps=30&lang=${LANG}`, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__pixelia?.intro, { timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));   // el manifest con las voces (estira los planos)
const count = await page.evaluate(() => window.__pixelia.intro.count);
const only = opt('shots', null)?.split(',').map(Number) || Array.from({ length: count }, (_, i) => i + 1);
const sheets = [];
for (const k of only) {
  const i = k - 1;
  const dur = await page.evaluate((i) => { const I = window.__pixelia.intro; I.go(i); return I.cinema.timeline.S.dur; }, i);
  const times = AT != null ? [Number(AT)] : Array.from({ length: N }, (_, j) => +(0.9 + (dur - 1.6) * j / (N - 1)).toFixed(1));
  const imgs = [];
  for (const s of times) {
    await page.evaluate((i, s) => { const I = window.__pixelia.intro; I.cinema.labels?.seen.clear(); I.go(i); I.seek(s); }, i, s);
    await new Promise(r => setTimeout(r, 750));   // los carteles entran con un fundido de 0,5 s
    imgs.push({ s, b64: await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 82 }) });
  }
  sheets.push({ k, dur, imgs });
  console.log(`plano ${k}: ${dur.toFixed(1)} s · ${times.join(', ')}`);
}
// hojas: una por plano, en una página aparte (2 columnas)
const sheet = await browser.newPage();
for (const { k, dur, imgs } of sheets) {
  const cols = imgs.length > 1 ? 2 : 1, rows = Math.ceil(imgs.length / cols);
  await sheet.setViewport({ width: cols * (W / 2 + 8), height: rows * (H / 2 + 26) + 30 });
  await sheet.setContent(`<body style="margin:0;background:#111;color:#ddd;font:13px sans-serif"><div style="padding:6px">Plano ${k} · ${dur.toFixed(1)} s · ${LANG}</div>
    <div style="display:grid;grid-template-columns:repeat(${cols},${W / 2}px);gap:4px 8px">${imgs.map(m => `<figure style="margin:0"><img src="data:image/jpeg;base64,${m.b64}" width="${W / 2}" height="${H / 2}"><figcaption>${m.s} s</figcaption></figure>`).join('')}</div></body>`, { waitUntil: 'load' });
  const f = join(OUT, `plano-${String(k).padStart(2, '0')}${LANG !== 'es' ? '-' + LANG : ''}${AT != null ? '-t' + AT : ''}.png`);
  writeFileSync(f, await sheet.screenshot({ type: 'png', fullPage: true }));
}
const total = await page.evaluate(() => { const I = window.__pixelia.intro; let s = 0; for (let i = 0; i < I.count; i++) { I.go(i); s += I.cinema.timeline.S.dur; } return s; });
console.log(`total: ${total.toFixed(1)} s`);
if (errors.length) console.log('errores:\n  ' + [...new Set(errors)].slice(0, 12).join('\n  '));
await browser.close(); server.close();
