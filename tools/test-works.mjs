// Monumentos y materiales (Fase 3), con la interfaz real y el modo online de prueba:
// rango Pueblo → aparece "Obras" en el HUD → los materiales son los de región y «Salir» lleva a la expedición
// → panel Obras → Construir el Faro (colocar en la ciudad) → avanzar sus etapas → bonus de negocios activo
// → el expediente del rango Villa cuenta el monumento terminado. Toma capturas de cada etapa para revisarlas a ojo.
//
//   node tools/test-works.mjs [--device iphone|desktop] [--out carpeta] [--no-shots]
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = resolve(opt('out', join(tmpdir(), 'pixelia-works')));
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

async function openPage(user, cheat) {
  const page = await browser.newPage();
  await page.setViewport(VIEW);
  if (VIEW.hasTouch) await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
  page.on('pageerror', e => errors.push(`[${user}] PAGEERROR: ` + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${user}] CONSOLE.ERROR: ` + m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`[${user}] HTTP ${r.status()}: ${r.url()}`); });
  await page.goto(`${BASE}?scene=city&mock=1&mockuser=${user}&reset&cheat=${cheat}&nosplash&nosw`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__pixelia?.ctx?.social && document.querySelector('#hud .hud-rank'), { timeout: 25000, polling: 150 });
  // sin premio diario ni bienvenida encima
  await page.evaluate(async () => {
    const { store, ctx } = window.__pixelia;
    const { todayStr } = await import('/src/core/state.js');
    store.state.login.last = todayStr();
    ctx.ui.closeAllModals();
  });
  await sleep(1200);
  await page.evaluate(() => window.__pixelia.ctx.ui.closeAllModals());
  return page;
}
const run = (page, code) => page.evaluate(`(async () => { const px = window.__pixelia; const { ctx, store, economy: E, quests: Q } = px; ${code} })()`);
async function tap(page, sel, text = null, timeout = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const p = await page.evaluate((sel, text) => {
      const re = text ? new RegExp(text, 'i') : null;
      const e = [...document.querySelectorAll(sel)].find(e => {
        const b = e.getBoundingClientRect();
        return b.width > 2 && b.height > 2 && !e.disabled && (!re || re.test(e.textContent));
      });
      if (!e) return null;
      e.scrollIntoView({ block: 'center' });
      const b = e.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }, sel, text);
    if (p) {
      await sleep(250);
      if (VIEW.hasTouch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
      return true;
    }
    await sleep(150);
  }
  console.log(`    (no encontré ${sel}${text ? ' «' + text + '»' : ''})`);
  return false;
}
async function waitFor(page, code, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await page.evaluate(code)) return true; } catch {} await sleep(120); }
  return false;
}
let shotN = 0;
async function shot(page, name) {
  if (!SHOTS) return;
  const f = join(OUT, `${String(++shotN).padStart(2, '0')}-${DEVICE}-${name}.png`);
  await page.screenshot({ path: f });
  console.log('    📷 ' + f);
}
/** Construye y termina al instante (salta la obra editando el tiempo). */
const BUILD_FN = `
  const placeNow = (id) => {
    const { min, max } = E.landBounds();
    for (let z = min; z < max; z++) for (let x = min; x < max; x++) {
      if (!E.canPlace(id, x, z, 0).ok) continue;
      const r = E.placeBuilding(id, x, z, 0);
      if (r.error) return r.error;
      const b = store.state.city.buildings.at(-1);
      if (b.buildEnd) b.buildEnd = Date.now() - 1;
      E.tick();
      return b;
    }
    return 'sin lugar';
  };`;
/** Termina ya la obra (construcción o etapa) de un edificio por id. */
const finishFn = (id) => `const b = store.state.city.buildings.find(b => b.id === '${id}'); if (b.buildEnd) b.buildEnd = Date.now() - 1; if (b.upgradeEnd) b.upgradeEnd = Date.now() - 1; E.tick(); return b.level;`;
/** Foto de la ciudad centrada en un edificio (sin modales encima), para revisar el modelo a ojo. */
async function cityShot(page, id, name) {
  await page.evaluate(() => window.__pixelia.ctx.ui.closeAllModals());
  await run(page, `const b = store.state.city.buildings.find(b => b.id === '${id}'); ctx.bus.emit('city:focus', { uid: b.uid }); return true;`);
  await sleep(900);
  await page.evaluate(() => window.__pixelia.ctx.ui.closeAllModals());
  await sleep(500);
  await shot(page, name);
}

try {
  section('Cleo: rango Pueblo y botón Obras');
  const cleo = await openPage('cleo', 15);
  ok(await run(cleo, `return getComputedStyle(document.querySelector('#hud [data-act="works"]')).display === 'none'`), 'en Aldea el botón «Obras» no aparece');
  const r3 = await run(cleo, `${BUILD_FN}
    const c = store.state.city.buildings.find(b => b.id === 'castillo'); c.level = 3;
    const k = placeNow('casita'); const j = placeNow('casa_exp'); const p = placeNow('panaderia');
    E.tick(); return { rank: E.townRank(), j: typeof j, p: typeof p, mats: { ...store.state.materials } };`);
  ok(r3.rank === 3 && r3.j === 'object' && r3.p === 'object', 'rango Pueblo con Casa de Expediciones y Panadería', r3);
  ok(r3.mats && r3.mats.piedra === 0 && r3.mats.mineral === 0 && !('cristal' in r3.mats), 'arranca sin materiales', r3.mats);
  ok(await waitFor(cleo, `getComputedStyle(document.querySelector('#hud [data-act="works"]')).display !== 'none'`, 3000), 'en Pueblo aparece «Obras» en el HUD');
  const faroLock = await run(cleo, `return E.canBuild('faro')`);
  ok(!faroLock.ok && faroLock.mats, 'el Faro pide materiales', faroLock);
  const jLock = await run(cleo, `return E.canBuild('jardin')`);
  ok(!jLock.ok && /Rango Villa/.test(jLock.reason), 'el Jardín Botánico pide el rango Villa', jLock);

  section('Los materiales vienen de la expedición');
  ok(await tap(cleo, '#hud [data-act="works"]'), 'toca «Obras»');
  ok(await waitFor(cleo, `!!document.querySelector('.modal.pnl-works .pnl-wk-play')`, 5000), 'Obras muestra los materiales con «Salir»');
  const wl = await cleo.evaluate(() => [...document.querySelectorAll('.pnl-works .pnl-wk-mat')].map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  ok(wl.length === 4 && /Madera/.test(wl.join()) && /Bosque del Arroyo/.test(wl.join()), 'madera, piedra, mineral y hierbas con su región', wl);
  await tap(cleo, '.pnl-works .pnl-wk-play');
  ok(await waitFor(cleo, `!!document.querySelector('.modal.pnl-ex')`, 5000), '«Salir» abre el panel de Expedición');
  await sleep(600);
  await cleo.evaluate(() => window.__pixelia.ctx.ui.closeAllModals());
  await sleep(600);

  section('Panel Obras y construir el Faro');
  // lo que piden las 4 etapas del Faro (los números los calibra tools/sim-economy.mjs) y un poco más
  await run(cleo, `store.grant({ mats: { mineral: 120, piedra: 140 }, coins: 60000 }, 'test'); return true;`);
  ok(await tap(cleo, '#hud [data-act="works"]'), 'toca «Obras»');
  ok(await waitFor(cleo, `!!document.querySelector('.modal.pnl-works .pnl-wk-card')`, 5000), 'se abre el panel de Obras');
  await sleep(1500);
  const pw = await cleo.evaluate(() => ({
    cards: document.querySelectorAll('.pnl-works .pnl-wk-card').length,
    locked: document.querySelectorAll('.pnl-works .pnl-wk-card.locked').length,
    mats: [...document.querySelectorAll('.pnl-works [data-mat]')].map(e => e.textContent),
    first: document.querySelector('.pnl-works .pnl-wk-card .pnl-wk-name')?.textContent,
  }));
  ok(pw.cards === 6 && pw.locked === 5, '6 monumentos, 5 todavía bloqueados por rango', pw);
  ok(pw.first === 'Faro', 'el Faro aparece primero (se puede construir)', pw.first);
  ok(pw.mats.length === 4, 'muestra los 4 materiales', pw.mats);
  await shot(cleo, 'panel-obras');
  ok(await tap(cleo, '.pnl-works .pnl-wk-card .btn.primary', 'Construir'), 'toca «Construir» en el Faro');
  ok(await waitFor(cleo, `!!document.querySelector('.cx-pc .cx-pc-ok')`, 5000), 'arranca la colocación en la ciudad');
  await sleep(600);
  await shot(cleo, 'colocar-faro');
  const m0 = await run(cleo, `return { ...store.state.materials }`);
  await tap(cleo, '.cx-pc .cx-pc-ok');
  ok(await waitFor(cleo, `window.__pixelia.economy.countOf('faro') === 1`, 5000), 'Faro colocado');
  const m1 = await run(cleo, `return { ...store.state.materials }`);
  const c1 = await run(cleo, `return E.def('faro').cost.mats`);
  ok(m0.piedra - m1.piedra === c1.piedra && m0.mineral - m1.mineral === c1.mineral, `la etapa 1 gastó ${c1.piedra} de piedra y ${c1.mineral} de mineral`, { m0, m1, c1 });
  ok(await run(cleo, finishFn('faro')) === 1, 'terminan los cimientos (etapa 1)');
  await cityShot(cleo, 'faro', 'faro-etapa-1');

  section('Avanzar las etapas');
  const charm1 = await run(cleo, `return E.cityCharm()`);
  await run(cleo, `ctx.openPanel('works'); return true;`);
  ok(await waitFor(cleo, `/Avanzar a la etapa 2/.test(document.querySelector('.pnl-works')?.textContent || '')`, 5000), 'el panel ofrece «Avanzar a la etapa 2»');
  await tap(cleo, '.pnl-works .pnl-wk-card .btn.primary', 'Avanzar');
  ok(await waitFor(cleo, `!!document.querySelector('.pnl-works [data-wk-left]')`, 4000), 'la etapa 2 queda en obra');
  ok(await run(cleo, finishFn('faro')) === 2, 'etapa 2 terminada');
  const charm2 = await run(cleo, `return E.cityCharm()`);
  ok(charm2 > charm1, 'cada etapa suma Encanto', { charm1, charm2 });
  await cityShot(cleo, 'faro', 'faro-etapa-2');
  await run(cleo, `const b = store.state.city.buildings.find(b => b.id === 'faro'); E.startUpgrade(b.uid); return true;`);
  ok(await run(cleo, finishFn('faro')) === 3, 'etapa 3 terminada');
  await cityShot(cleo, 'faro', 'faro-etapa-3');
  const st4 = await run(cleo, `const b = store.state.city.buildings.find(b => b.id === 'faro'); const r = E.startUpgrade(b.uid); return r.error || 'ok'`);
  ok(st4 === 'ok', 'arranca la última etapa', st4);
  ok(await run(cleo, finishFn('faro')) === 4, '¡Faro inaugurado!');
  await cityShot(cleo, 'faro', 'faro-terminado');

  section('Bonus y expediente');
  // Faro (DESIGN-CORE.md §5.4): +1 de visión en las expediciones (ya no suma monedas de negocios)
  const fin = await run(cleo, `const ex = await import('/src/expedition/expedition.js'); return { done: E.monumentsDone(), bonus: E.monumentBonus('vision'), shop: E.monumentBonus('shopCoins'), up: E.upgradeInfo(store.state.city.buildings.find(b => b.id === 'faro')) }`);
  ok(fin.done === 1 && fin.bonus === 1 && fin.shop === 0, 'un monumento terminado con +1 de visión en las expediciones', fin);
  ok(fin.up === null, 'el Faro terminado no tiene más etapas');
  const rk = await run(cleo, `return E.rankStatus().reqs.find(r => r.key === 'monuments')`);
  ok(rk && rk.need === 1 && rk.ok, 'el expediente del rango Villa cuenta el monumento', rk);
  await run(cleo, `ctx.openPanel('works'); return true;`);
  ok(await waitFor(cleo, `!!document.querySelector('.pnl-works .pnl-wk-card.done')`, 5000), 'el Faro figura terminado en Obras');
  await sleep(1500);
  await shot(cleo, 'obras-faro-terminado');
  await cleo.evaluate(() => window.__pixelia.ctx.ui.closeAllModals());
  await run(cleo, `const b = store.state.city.buildings.find(b => b.id === 'faro'); ctx.bus.emit('city:focus', { uid: b.uid }); return true;`);
  ok(await waitFor(cleo, `/Monumento terminado/.test(document.querySelector('.cx-info-modal')?.textContent || '')`, 4000), 'la ficha del Faro dice «¡Monumento terminado!»');
  await shot(cleo, 'ficha-faro');

  section('Todos los monumentos: un modelo por etapa');
  const all = await run(cleo, `const mod = await import('/src/city/models.js'); const out = {};
    for (const id of ctx.data.MONUMENT_IDS) { const N = ctx.data.MONUMENTS[id].stages.length; out[id] = [];
      for (let L = 1; L <= N; L++) { const g = mod.buildingModel(id, L); out[id].push(Math.round(g.userData.height * 8)); } }
    return out;`);
  ok(Object.values(all).every(hs => hs.length >= 4 && hs.every(h => h > 3)), 'cada monumento tiene un modelo por etapa', all);
} catch (e) {
  failN++;
  console.log('EXCEPCIÓN', e.stack || e);
}

await browser.close();
server.close();
if (errors.length) console.log('\n=== ERRORES DE PÁGINA ===\n' + [...new Set(errors)].join('\n'));
console.log(`\n${failN || errors.length ? '✘' : '✔'} ${okN} OK, ${failN} fallas, ${new Set(errors).size} errores de página`);
process.exit(failN || errors.length ? 1 : 0);
