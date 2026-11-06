// Rango de la ciudad y Encanto (con ?cheat y el modo online de prueba):
// chip del HUD → panel "Tu ciudad" con el expediente → cumplir requisitos → Mejorar → festejo con premio,
// constructora extra por rango, bloqueo "Rango X" en el menú Construir, ficha de la Municipalidad,
// y el perfil público (stats.rank / stats.charm) que ve una amistad.
//
//   node tools/test-rank.mjs [--device iphone|desktop] [--out carpeta] [--no-shots]
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = resolve(opt('out', join(tmpdir(), 'pixelia-rank')));
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

try {
  section('Bea: rango inicial y panel "Tu ciudad"');
  const bea = await openPage('bea', 12);
  const st0 = await run(bea, `return { rank: E.townRank(), name: E.rankName(E.townRank()), charm: E.cityCharm(), chip: document.querySelector('.hud-rank')?.textContent || '', builders: store.state.builders }`);
  ok(st0.rank === 1 && st0.name === 'Aldea', 'empieza en rango 1, Aldea', st0);
  ok(/Aldea/.test(st0.chip), 'el chip del HUD dice «Aldea»', st0.chip);
  const lock = await run(bea, `return E.canBuild('torre_cristal')`);
  ok(!lock.ok && lock.locked && /Rango Caser/.test(lock.reason), 'Torre de Cristal pide «Rango Caserío» (con nivel 12)', lock);

  ok(await tap(bea, '#hud .hud-rank'), 'toca el chip de rango');
  ok(await waitFor(bea, `!!document.querySelector('.modal.pnl-rank .pnl-rk-file')`), 'se abre el panel con el expediente');
  const p1 = await bea.evaluate(() => ({
    rows: document.querySelectorAll('.pnl-rank .pnl-rk-req').length,
    okRows: document.querySelectorAll('.pnl-rank .pnl-rk-req.ok').length,
    btn: document.querySelector('.pnl-rank .pnl-rk-up .btn')?.disabled,
    text: document.querySelector('.pnl-rank')?.textContent || '',
  }));
  ok(p1.rows === 5, 'expediente con 5 renglones (población, felicidad, encanto, negocios, nivel)', p1.rows);
  ok(p1.btn === true, 'el botón Mejorar está deshabilitado con el expediente incompleto');
  ok(/Caserío/.test(p1.text) && /Torre de Cristal/.test(p1.text), 'muestra el próximo rango y lo que desbloquea');
  await shot(bea, 'panel-rango');

  section('Cumplir el expediente');
  const built = await run(bea, `${BUILD_FN}
    const out = [];
    for (const id of ['casita', 'casita', 'cabana', 'panaderia', 'arbusto', 'banco', 'farol', 'cerezo']) { const r = placeNow(id); out.push(typeof r === 'string' ? id + ':' + r : id); }
    return { out, st: E.rankStatus() };`);
  ok(built.st.allOk && built.st.levelOk, 'expediente completo', built);
  const gain1 = await run(bea, `return [E.charmGain('banco'), E.charmBase(E.def('banco'))]`);
  ok(gain1[0] < gain1[1], 'repetir suma menos Encanto (otro Banquito vale menos que el primero)', gain1);
  ok(await waitFor(bea, `!document.querySelector('.pnl-rank .pnl-rk-up .btn')?.disabled`, 4000), 'el panel se actualiza y habilita «Mejorar»');
  await shot(bea, 'expediente-completo');
  const gems0 = await run(bea, `return store.state.gems`);
  ok(await tap(bea, '.pnl-rank .pnl-rk-up .btn', 'Mejorar'), 'toca «Mejorar a Caserío»');
  ok(await waitFor(bea, `!!document.querySelector('.pnl-rank [data-rk-left]')`, 4000), 'la Municipalidad queda en obra (cuenta regresiva)');

  section('Fin de obra: festejo');
  await run(bea, `const b = store.state.city.buildings.find(b => b.id === 'castillo'); b.upgradeEnd = Date.now() - 1; E.tick(); return true;`);
  ok(await waitFor(bea, `!!document.querySelector('.modal.pnl-rank.reward-modal .pnl-rk-party')`, 5000), 'el panel pasa a modo festejo');
  const party = await bea.evaluate(() => document.querySelector('.pnl-rank')?.textContent || '');
  ok(/Caserío/.test(party) && /desbloque/i.test(party), 'festejo con nombre del rango y desbloqueos');
  const after = await run(bea, `return { rank: E.townRank(), gems: store.state.gems, best: store.state.stats.rankBest, chip: document.querySelector('.hud-rank')?.textContent || '', torre: E.canBuild('torre_cristal').reason || 'ok' }`);
  ok(after.rank === 2 && after.best === 2, 'rango 2 guardado (y récord para el logro)', after);
  ok(after.gems > gems0 - 2, 'cobró el premio del rango (gemas)', { antes: gems0, despues: after.gems });
  ok(/Caserío/.test(after.chip), 'el chip del HUD dice «Caserío»', after.chip);
  ok(after.torre !== 'Rango Caserío', 'la Torre de Cristal ya no pide rango', after.torre);
  await shot(bea, 'festejo');
  await tap(bea, '.pnl-rank .pnl-rk-foot .btn', 'Genial');
  await waitFor(bea, `!document.querySelector('.modal.pnl-rank')`, 3000);

  section('Ficha de la Municipalidad y menú Construir');
  await run(bea, `const b = store.state.city.buildings.find(b => b.id === 'castillo'); ctx.bus.emit('city:focus', { uid: b.uid }); return true;`);
  ok(await waitFor(bea, `!!document.querySelector('.cx-info-modal')`, 4000), 'se abre la ficha de la Municipalidad');
  const ficha = await bea.evaluate(() => ({ txt: document.querySelector('.cx-info-modal')?.textContent || '', stars: document.querySelectorAll('.cx-info-modal .cx-ihead .cx-stars img').length, reqs: document.querySelectorAll('.cx-info-modal .cx-reqline').length }));
  ok(/Rango 2: Caserío/.test(ficha.txt), 'la ficha dice «Rango 2: Caserío»');
  ok(ficha.stars === 8, 'la Municipalidad muestra 8 estrellas', ficha.stars);
  ok(ficha.reqs === 4, 'la ficha lista el expediente del próximo rango', ficha.reqs);
  await shot(bea, 'ficha-municipalidad');
  await bea.evaluate(() => window.__pixelia.ctx.ui.closeAllModals());
  await sleep(300);
  await run(bea, `ctx.bus.emit('hud:build', { focus: 'mansion' }); return true;`);
  ok(await waitFor(bea, `!!document.querySelector('.cx-build .cx-card')`, 4000), 'se abre el menú Construir');
  const card = await bea.evaluate(() => [...document.querySelectorAll('.cx-build .cx-card')].find(c => /Mansión/.test(c.textContent))?.textContent || '');
  ok(/Rango Pueblo/.test(card), 'la Mansión muestra el candado «Rango Pueblo»', card);
  const deco = await bea.evaluate(() => document.querySelector('.cx-build .cx-card .cx-gives')?.innerHTML || '');
  ok(/sparkle/.test(deco), 'las tarjetas muestran cuánto Encanto suman');
  await shot(bea, 'menu-construir');
  await bea.evaluate(() => window.__pixelia.ctx.ui.closeAllModals());

  section('Rango 3: constructora de regalo');
  const b3 = await run(bea, `const b = store.state.city.buildings.find(b => b.id === 'castillo'); const before = store.state.builders; b.level = 3; E.tick(); const r = { before, after: store.state.builders, perks: store.state.city.rankPerks }; E.tick(); r.again = store.state.builders; return r;`);
  ok(b3.after === b3.before + 1 && b3.again === b3.after, 'el rango Pueblo regala una constructora (una sola vez)', b3);
  const bi = await run(bea, `return E.builderInfo()`);
  ok(bi && bi.cost.gems > 0, 'la regalada no cuenta para el tope de constructoras compradas', bi);

  section('Online: perfil público y amistades');
  const pub = await run(bea, `const s = await import('/src/online/sync.js'); await s.publishProfileNow(true); const p = await px.net.getMyProfile(); return { rank: p?.stats?.rank, charm: p?.stats?.charm, wcharm: p?.stats?.week?.charm, code: p?.code };`);
  ok(pub.rank === 3 && pub.charm > 0 && pub.wcharm === pub.charm, 'el perfil publica rango y Encanto (también en week)', pub);
  const ana = await openPage('ana', 6);
  await ana.evaluate(async (code) => { await window.__pixelia.net.requestFriend(code); }, pub.code);
  await run(bea, `const f = (await px.net.listFriends())[0]; await px.net.respondFriend(f.id, true); return true;`);
  const seen = await run(ana, `const so = await import('/src/online/social.js'); await so.refreshSocial(['friends']); const f = so.socialCache.friends?.[0]; return { rank: f?.rank, charm: f?.charm, name: f?.name }`);
  ok(seen.rank === 3 && seen.charm === pub.charm, 'Ana ve el rango y el Encanto de Bea en su lista', seen);
  await run(ana, `ctx.openSocial('amigas'); return true;`);
  ok(await waitFor(ana, `/Pueblo/.test(document.querySelector('.soc-friend')?.textContent || '')`, 6000), 'la tarjeta de la amistad muestra «Pueblo»');
  await shot(ana, 'amistad-rango');
} catch (e) {
  failN++;
  console.log('EXCEPCIÓN', e.stack || e);
}

await browser.close();
server.close();
if (errors.length) console.log('\n=== ERRORES DE PÁGINA ===\n' + [...new Set(errors)].join('\n'));
console.log(`\n${failN || errors.length ? '✘' : '✔'} ${okN} OK, ${failN} fallas, ${new Set(errors).size} errores de página`);
process.exit(failN || errors.length ? 1 : 0);
