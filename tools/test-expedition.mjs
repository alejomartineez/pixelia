// Expedición (Fase 1), con toques reales: carga la escena → pasos tocando las casillas → una decisión con % →
// recarga a mitad de la salida y confirma que se retoma → Volver → resultado con estrellas y botín → salida corta →
// Esc (menú) → "Dejar para después" → la ciudad → volver a entrar retoma la corta → teclado (flechas).
//
//   node tools/test-expedition.mjs [--device iphone|desktop] [--out carpeta] [--no-shots]
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { generateMap } = await import(pathToFileURL(join(ROOT, 'src/expedition/exp-gen.js')).href);
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = resolve(opt('out', join(tmpdir(), 'pixelia-expedition')));
const SHOTS = !opt('no-shots', false);
const DEVICE = opt('device', 'iphone');
if (SHOTS) mkdirSync(OUT, { recursive: true });

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
const VIEW = VIEWS[DEVICE];
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

const errors = [];
let okN = 0, failN = 0;
const ok = (cond, msg, extra) => { if (cond) { okN++; console.log('  ✔ ' + msg); } else { failN++; console.log('  ✘ ' + msg + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } return !!cond; };
const section = (t) => console.log('\n■ ' + t);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Semilla con un peligro o una ruina justo adelante de la base (casilla (3,6)): así la decisión sale en el 2.º paso.
let SEED = 0;
for (let s = 1; s < 5000; s++) {
  const m = generateMap({ region: 'bosque', zone: 1, kind: 'normal', seed: s });
  const c = m.cells[6 * m.w + 3];
  if ((c.content === 'peligro' && c.sub !== 'rio') || c.content === 'ruina') { SEED = s; break; }
}

const page = await browser.newPage();
await page.setViewport(VIEW);
if (VIEW.hasTouch) await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });

const exp = () => page.evaluate(() => { const e = document.querySelector('.scene-expedition')?.__exp; if (!e) return null; const v = e.view; return v && { ...v, busy: e.busy, card: e.card, modal: e.modal, run: { steps: e.run.steps, pos: e.run.pos, prov: e.run.prov, seed: e.run.seed, kind: e.run.kind } }; });
async function waitFor(code, ms = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await page.evaluate(code)) return true; } catch {} await sleep(120); }
  return false;
}
/** La tarjeta de decisión terminó de entrar (sin transformación pendiente) y la escena no está animando. */
const cardReady = () => waitFor(`(() => { const c = document.querySelector('.scene-expedition .ex-card.in'); if (!c) return false; const t = getComputedStyle(c).transform; return (t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)') && !document.querySelector('.scene-expedition').__exp.busy; })()`, 6000);
const idle = () => waitFor(`(() => { const e = document.querySelector('.scene-expedition')?.__exp; return e && !e.busy; })()`);
async function tapXY(x, y) { if (VIEW.hasTouch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); }
async function tapSel(sel, text = null, timeout = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const p = await page.evaluate((sel, text) => {
      const re = text ? new RegExp(text, 'i') : null;
      const e = [...document.querySelectorAll(sel)].find(e => { const b = e.getBoundingClientRect(); return b.width > 2 && b.height > 2 && !e.disabled && (!re || re.test(e.textContent)); });
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }, sel, text);
    if (p) { await sleep(200); await tapXY(p.x, p.y); return true; }
    await sleep(150);
  }
  console.log(`    (no encontré ${sel}${text ? ' «' + text + '»' : ''})`);
  return false;
}
/** Toca el rótulo de costo de la vecina (x,y); si no está, la casilla misma. */
async function tapCell(x, y) {
  const p = await page.evaluate((x, y) => {
    const chip = [...document.querySelectorAll('.scene-expedition .ex-chip')].find(b => !b.classList.contains('hidden') && b._xy && b._xy[0] === x && b._xy[1] === y);
    if (chip) { const b = chip.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, chip: true }; }
    return document.querySelector('.scene-expedition').__exp.cellScreen(x, y);
  }, x, y);
  await tapXY(p.x, p.y);
  return p;
}
let shotN = 0;
async function shot(name) {
  if (!SHOTS) return;
  const f = join(OUT, `${String(++shotN).padStart(2, '0')}-${DEVICE}-${name}.png`);
  await page.screenshot({ path: f });
  console.log('    📷 ' + f);
}
const saved = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('pixelia.save.v1') || '{}').expedition || null; } catch { return null; } });

try {
  section(`Salida normal con semilla fija (${SEED})`);
  await page.goto(`${BASE}?scene=expedition&reset&nosplash&nosw&new=1&seed=${SEED}`, { waitUntil: 'load' });
  await page.evaluate(() => history.replaceState(null, '', location.pathname + '?scene=expedition&nosplash&nosw'));
  ok(await waitFor(`!!document.querySelector('.scene-expedition')?.__exp?.view`, 25000), 'la escena expedition se monta');
  await idle(); await sleep(600);
  let v = await exp();
  ok(v.prov === 24 && v.morale === v.moraleMax && v.cargoN === 0 && v.cargoMax === 15, `arranca con 24 provisiones, ánimo lleno y carga 0/15 (${v.prov}, ${v.morale}/${v.moraleMax}, ${v.cargoN}/${v.cargoMax})`);
  ok(v.run.seed === SEED && v.w === 7 && v.h === 9, `grilla 7×9 con la semilla pedida (${v.w}×${v.h}, ${v.run.seed})`);
  const ui0 = await page.evaluate(() => ({
    home: document.querySelector('.ex-home')?.textContent.trim(), chips: [...document.querySelectorAll('.ex-chip:not(.hidden)')].length,
    goal: document.querySelector('.ex-goal')?.textContent.trim(), canvas: !!document.querySelector('.scene-expedition canvas'),
  }));
  ok(ui0.canvas && ui0.chips === 3, `diorama dibujado y 3 vecinas con su costo (${ui0.chips})`);
  ok(/Terminar|Volver/.test(ui0.home) && ui0.goal.length > 5, `botón Volver visible («${ui0.home}») y objetivo arriba («${ui0.goal}»)`);
  await shot('inicio');

  section('Pasos con toques');
  const t1 = await tapCell(3, 7);
  await sleep(150); await idle(); await sleep(300);
  v = await exp();
  ok(v.run.steps === 1 && v.pos[0] === 3 && v.pos[1] === 7, `un toque en la vecina mueve al grupo (${JSON.stringify(v.pos)}, toque en ${t1.chip ? 'rótulo' : 'casilla'})`);
  ok(v.prov === 23, `el paso gastó 1 provisión (${v.prov})`);
  const s1 = await saved();
  ok(s1?.active?.steps === 1, 'la salida en curso queda guardada en state.expedition.active');

  section('Una decisión con probabilidades');
  await tapCell(3, 6);
  ok(await cardReady(), 'entrar a un peligro o una ruina abre la tarjeta de decisión');
  await sleep(200);
  const cardInfo = await page.evaluate(() => {
    const c = document.querySelector('.scene-expedition .ex-card');
    return { title: c.querySelector('header b').textContent, opts: [...c.querySelectorAll('.ex-opt')].map(b => ({ txt: b.textContent, p: b.querySelector('.p').textContent, dis: b.disabled })), back: !!c.querySelector('.ex-back') };
  });
  ok(cardInfo.opts.length >= 2 && cardInfo.opts.some(o => /\d+%/.test(o.p)), `«${cardInfo.title}»: ${cardInfo.opts.length} opciones con su % (${cardInfo.opts.map(o => o.p).join(' / ')})`);
  ok(cardInfo.opts.every(o => /Cuesta/.test(o.txt)) && cardInfo.back, 'cada opción dice lo que cuesta y está "Retroceder"');
  await shot('decision');
  v = await exp();
  ok(v.run.steps === 1 && v.pending, 'mientras se decide, el grupo no avanzó ni pagó nada');
  // retroceder es gratis; después se vuelve a entrar y se elige la primera opción que se pueda
  await tapSel('.scene-expedition .ex-back');
  await sleep(500); await idle(); await sleep(400);
  v = await exp();
  ok(!v.pending && v.prov === 23 && v.run.steps === 1, 'Retroceder cierra la tarjeta sin costo');
  await tapCell(3, 6);
  await cardReady();
  await sleep(200);
  await tapSel('.scene-expedition .ex-opt:not(:disabled)');
  await sleep(200); await idle(); await sleep(400);
  v = await exp();
  ok(!v.pending && v.run.steps === 2 && v.pos[1] === 6, `elegir una opción resuelve el peligro y el grupo pasa (${JSON.stringify(v.pos)})`);
  const dec = await page.evaluate(() => document.querySelector('.scene-expedition').__exp.run.decisions);
  ok(dec.length === 1 && ['ok', 'fail'].includes(dec[0].outcome), `quedó registrada la decisión (${JSON.stringify(dec[0])})`);
  // un paso más, a cualquier vecina sin peligro
  v = await exp();
  const free = v.moves.find(m => m.ok && m.safe && (() => { const c = v.cells[m.y * v.w + m.x]; return c.seen && (c.done || !['peligro', 'ruina', 'campamento', 'aldea'].includes(c.content)); })());
  if (free) { await tapCell(free.x, free.y); await sleep(150); await idle(); await sleep(300); }
  if (await page.evaluate(() => !!document.querySelector('.scene-expedition .ex-card.in'))) { await tapSel('.scene-expedition .ex-opt:not(:disabled)'); await sleep(200); await idle(); }
  const before = await exp();
  await shot('a-mitad');

  section('Recargar a mitad retoma la salida');
  await page.reload({ waitUntil: 'load' });
  ok(await waitFor(`!!document.querySelector('.scene-expedition')?.__exp?.view`, 25000), 'la escena vuelve a montarse');
  await idle(); await sleep(500);
  v = await exp();
  ok(v.run.steps === before.run.steps && v.pos.join() === before.pos.join() && v.prov === before.prov && v.run.seed === SEED,
    `misma salida: paso ${v.run.steps}, casilla ${JSON.stringify(v.pos)}, ${v.prov} provisiones`, { antes: before.run, despues: v.run });
  ok(v.cells.filter(c => c.seen).length === before.cells.filter(c => c.seen).length, 'la niebla abierta sigue abierta');

  section('Volver y resultado');
  const ret = v.returnCost, provB = v.prov;
  await tapSel('.scene-expedition .ex-home');
  ok(await waitFor(`!!document.querySelector('.scene-expedition .ex-modal .ex-stars')`, 6000), 'aparece el resultado con estrellas');
  await sleep(1200);
  const resInfo = await page.evaluate(() => {
    const m = document.querySelector('.scene-expedition .ex-modal');
    return { title: m.querySelector('h2').textContent, stars: m.querySelectorAll('.ex-star').length, on: m.querySelectorAll('.ex-star.on').length, loot: m.querySelector('.ex-loot').textContent.trim(), text: m.textContent };
  });
  ok(resInfo.stars === 3 && resInfo.on >= 1, `3 estrellas, ${resInfo.on} ganadas («${resInfo.title}»)`);
  ok(/Lo que trajeron/.test(resInfo.text), `muestra lo que trajeron («${resInfo.loot}»)`);
  ok(new RegExp(`Sobraron ${provB - ret} provisi`).test(resInfo.text) || provB - ret === 0, `las provisiones que sobran vuelven al depósito (${provB} − ${ret})`);
  const s2 = await saved();
  ok(s2 && s2.active === null && s2.last?.reason === 'volvio', `terminada: sin salida activa y último resultado «${s2?.last?.reason}»`);
  await shot('resultado');

  section('Salida corta');
  await tapSel('.scene-expedition .ex-modal [data-a="short"]');
  await sleep(400); await idle(); await sleep(500);
  v = await exp();
  ok(v.run.kind === 'corta' && v.w === 5 && v.h === 6 && v.prov === 12 && v.cargoMax === 8, `5×6 con la vianda de 12 y la mochila chica (${v.w}×${v.h}, ${v.prov}, carga ${v.cargoMax})`);
  await page.keyboard.press('ArrowUp');
  await sleep(150); await idle(); await sleep(300);
  v = await exp();
  ok(v.run.steps === 1 && v.pos[1] === 4, `flecha arriba avanza una casilla (${JSON.stringify(v.pos)})`);
  if (v.pending) { await page.keyboard.press('1'); await sleep(200); await idle(); }
  await shot('corta');
  await page.keyboard.press('Escape');
  ok(await waitFor(`!!document.querySelector('.scene-expedition .ex-modal [data-a="city"]')`, 3000), 'Esc abre el menú (Seguir / Volver / Dejar para después)');
  await tapSel('.scene-expedition .ex-modal [data-a="city"]');
  ok(await waitFor(`window.__pixelia?.ctx?.router?.current === 'city' && !document.querySelector('.scene-expedition')`, 15000), '"Dejar para después" lleva a la ciudad');
  const s3 = await saved();
  ok(s3?.active?.kind === 'corta', 'la salida corta queda guardada');
  await page.evaluate(() => window.__pixelia.ctx.router.go('expedition'));
  ok(await waitFor(`!!document.querySelector('.scene-expedition')?.__exp?.view`, 15000), 'volver a entrar a la expedición');
  await idle(); await sleep(300);
  v = await exp();
  ok(v.run.kind === 'corta' && v.run.steps >= 1, `retoma la salida corta (paso ${v.run.steps})`);
  await shot('retoma');
} catch (e) {
  failN++;
  console.log('  ✘ excepción: ' + (e.stack || e.message));
}

await browser.close();
server.close();
if (errors.length) console.log('\n=== ERRORES DE PÁGINA ===\n' + [...new Set(errors)].join('\n'));
console.log(`\n${failN || errors.length ? '✘' : '✔'} ${okN} OK, ${failN} fallas, ${new Set(errors).size} errores de página`);
process.exit(failN || errors.length ? 1 : 0);
