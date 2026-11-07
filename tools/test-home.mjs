// Mi Casa (Fase 4), con la interfaz real y el modo online de prueba:
// la casa aparece en la ciudad → Entrar → Decorar: comprar y poner un mueble, arrastrarlo, rotarlo, guardarlo, uno de pared,
// paredes y piso → el ropero abre el Vestidor → volver → recarga conserva todo → ampliar niveles 2 a 5 → visita a la casa de una amistad.
// Toma capturas de cada nivel de la casa para revisarlas a ojo.
//
//   node tools/test-home.mjs [--device iphone|desktop] [--out carpeta] [--no-shots]
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = resolve(opt('out', join(tmpdir(), 'pixelia-home')));
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
const ctx_sizes = { 2: '8x8', 3: '10x9', 4: '12x10', 5: '14x12' };
const home = (page) => page.evaluate(() => document.querySelector('.scene-home')?.__home?.debug || null);
/** Arrastre con el dedo (o el mouse en PC) de un punto a otro, en pasos. */
async function drag(page, a, b, steps = 10) {
  if (VIEW.hasTouch) {
    await page.touchscreen.touchStart(a.x, a.y);
    for (let i = 1; i <= steps; i++) { await page.touchscreen.touchMove(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps); await sleep(30); }
    await page.touchscreen.touchEnd();
  } else {
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    for (let i = 1; i <= steps; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps); await sleep(30); }
    await page.mouse.up();
  }
}
async function tapXY(page, x, y) { if (VIEW.hasTouch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); }
const itemScreen = (page, uid) => page.evaluate((uid) => document.querySelector('.scene-home').__home.itemScreen(uid), uid);
const tileScreen = (page, x, z) => page.evaluate((x, z) => document.querySelector('.scene-home').__home.tileScreen(x, z), x, z);
const homeItems = (page) => run(page, `return store.state.home.items.map(i => ({ ...i }))`);

try {
  section('Dani: la casa aparece en la ciudad');
  const dani = await openPage('dani', 15);
  ok(await waitFor(dani, `window.__pixelia.store.state.city.buildings.some(b => b.id === 'mi_casa')`, 5000), 'Mi Casa aparece sola al tener nivel 2 o más');
  const st0 = await run(dani, `const h = store.state.home; return { n: h.items.length, ids: h.items.map(i => i.id), comfort: px.home.comfortInfo().value, charm: E.charmInfo().home }`);
  ok(st0.n === 8 && st0.ids.includes('cama') && st0.ids.includes('ropero'), 'arranca amueblada (cama, ropero, mesa, silla…)', st0);
  ok(st0.comfort > 0 && st0.charm > 0, 'el Confort suma Encanto a la ciudad', st0);
  const menu = await run(dani, `ctx.bus.emit('hud:build', {}); await new Promise(r => setTimeout(r, 900)); const t = [...document.querySelectorAll('.cx-build .cx-card .nm')].map(e => e.textContent); ctx.ui.closeAllModals(); return t;`);
  ok(!menu.includes('Mi Casa'), 'Mi Casa no está en el menú Construir');
  await sleep(500);
  await run(dani, `const b = store.state.city.buildings.find(b => b.id === 'mi_casa'); ctx.bus.emit('city:focus', { uid: b.uid }); return true;`);
  ok(await waitFor(dani, `/Monoambiente/.test(document.querySelector('.cx-info-modal')?.textContent || '')`, 5000), 'la ficha dice «Monoambiente»');
  await shot(dani, 'ficha-mi-casa');
  ok(await tap(dani, '.cx-info-modal .btn', 'Entrar'), 'toca «Entrar»');
  ok(await waitFor(dani, `window.__pixelia.ctx.router.current === 'home' && !!document.querySelector('.scene-home')?.__home`, 10000), 'entra a la casa');
  await sleep(1500);
  const h1 = await home(dani);
  ok(h1 && h1.items.length === 8 && h1.size.join('x') === '6x6' && /Mi Casa/.test(h1.title), 'cuarto de 6×6 con sus muebles', h1 && { n: h1.items.length, size: h1.size, title: h1.title });
  await shot(dani, 'casa-adentro');

  section('Decorar: comprar, mover, rotar y guardar');
  ok(await tap(dani, '.scene-home [data-hm="deco"]'), 'toca «Decorar»');
  ok(await waitFor(dani, `document.querySelector('.scene-home').classList.contains('editing')`, 3000), 'modo Decorar');
  await tap(dani, '.scene-home .hm-tabs .tab', 'Tienda');
  ok(await waitFor(dani, `!!document.querySelector('.scene-home .hm-card[data-id="puff"]')`, 3000), 'la Tienda muestra los muebles');
  await sleep(1200);
  await shot(dani, 'tienda');
  const coins0 = await run(dani, `return store.state.coins`);
  ok(await tap(dani, '.scene-home .hm-card[data-id="puff"]'), 'compra un Puf');
  ok(await waitFor(dani, `window.__pixelia.store.state.home.items.some(i => i.id === 'puff')`, 3000), 'el Puf queda puesto en el cuarto');
  const coins1 = await run(dani, `return store.state.coins`);
  ok(coins0 - coins1 === 250, 'cobró 250 monedas', { coins0, coins1 });
  const puff0 = (await homeItems(dani)).find(i => i.id === 'puff');
  ok((await home(dani)).sel === puff0.uid, 'el Puf queda elegido (barra con Rotar/Guardar)');
  // arrastrarlo a una baldosa libre de adelante a la derecha
  const target = await run(dani, `for (const [x, z] of [[5, 4], [4, 5], [5, 3], [3, 5]]) if (px.home.canPlaceItem('puff', x, z, 0, ${puff0.uid}).ok) return [x, z]; return null;`);
  const a = await itemScreen(dani, puff0.uid), b = await tileScreen(dani, ...target);
  await drag(dani, a, b, 12);
  await sleep(600);
  const puff1 = (await homeItems(dani)).find(i => i.id === 'puff');
  ok(puff1.x === target[0] && puff1.z === target[1], `arrastrar lo mueve a ${target.join(',')}`, { antes: [puff0.x, puff0.z], ahora: [puff1.x, puff1.z] });
  await shot(dani, 'puf-movido');
  // un mueble de 2×1 para rotar
  await tap(dani, '.scene-home .hm-card[data-id="tele"]');
  ok(await waitFor(dani, `window.__pixelia.store.state.home.items.some(i => i.id === 'tele')`, 3000), 'compra y pone una Tele');
  const tv0 = (await homeItems(dani)).find(i => i.id === 'tele');
  await tap(dani, '.scene-home .hm-sel .btn', 'Rotar');
  await sleep(400);
  const tv1 = (await homeItems(dani)).find(i => i.id === 'tele');
  ok(tv1 && tv1.rot === (tv0.rot + 1) % 4, 'Rotar gira la Tele', { antes: tv0.rot, ahora: tv1?.rot });
  await tap(dani, '.scene-home .hm-sel .btn', 'Guardar');
  await sleep(400);
  const inv = await run(dani, `return { placed: store.state.home.items.some(i => i.id === 'tele'), owned: store.state.home.owned.tele || 0 }`);
  ok(!inv.placed && inv.owned === 1, 'Guardar la devuelve a «Mis muebles»', inv);
  await tap(dani, '.scene-home .hm-tabs .tab', 'Mis muebles');
  ok(await waitFor(dani, `!!document.querySelector('.scene-home .hm-card[data-id="tele"] .ct')`, 3000), 'la Tele aparece en Mis muebles');
  // de pared: el reloj va a la pared del fondo y «Otra pared» lo pasa a la izquierda
  await tap(dani, '.scene-home .hm-tabs .tab', 'Tienda');
  await tap(dani, '.scene-home .hm-card[data-id="reloj"]');
  ok(await waitFor(dani, `window.__pixelia.store.state.home.items.some(i => i.id === 'reloj')`, 3000), 'compra y cuelga un Reloj de pared');
  await tap(dani, '.scene-home .hm-sel .btn', 'Otra pared');
  await sleep(400);
  const clock = (await homeItems(dani)).find(i => i.id === 'reloj');
  ok(clock && clock.rot % 2 === 1 && clock.x === 0, '«Otra pared» lo pasa a la pared izquierda', clock);
  await tap(dani, '.scene-home .hm-tabs .tab', 'Paredes');
  await tap(dani, '.scene-home .hm-card[data-id="menta"]');
  await tap(dani, '.scene-home .hm-tabs .tab', 'Pisos');
  await tap(dani, '.scene-home .hm-card[data-id="baldosa"]');
  await sleep(500);
  ok(await run(dani, `return store.state.home.wall === 'menta' && store.state.home.floor === 'baldosa'`), 'pinta las paredes de menta y pone baldosas');
  await tap(dani, '.scene-home .hm-sel .btn', 'Listo');
  await tap(dani, '.scene-home [data-hm="deco"]');
  ok(await waitFor(dani, `!document.querySelector('.scene-home').classList.contains('editing')`, 3000), '«Listo» sale de Decorar');
  await sleep(900);
  await shot(dani, 'casa-decorada');

  section('El ropero abre el Vestidor');
  const wr = (await homeItems(dani)).find(i => i.id === 'ropero');
  const wp = await itemScreen(dani, wr.uid);
  await tapXY(dani, wp.x, wp.y - 10);
  ok(await waitFor(dani, `window.__pixelia.ctx.router.current === 'wardrobe'`, 8000), 'tocar el ropero abre el Vestidor');
  await sleep(1200);
  await tap(dani, '.wd-back');
  ok(await waitFor(dani, `window.__pixelia.ctx.router.current === 'home'`, 8000), 'volver del Vestidor vuelve a la casa');
  await sleep(1000);
  await tap(dani, '.scene-home .hm-back');
  ok(await waitFor(dani, `window.__pixelia.ctx.router.current === 'city'`, 8000), 'volver lleva a la ciudad');

  section('Recarga: la casa queda como la dejaste');
  await run(dani, `store.save(); return true;`);
  await dani.goto(`${BASE}?scene=home&mock=1&mockuser=dani&nosplash&nosw`, { waitUntil: 'load' });
  ok(await waitFor(dani, `!!document.querySelector('.scene-home')?.__home`, 15000), 'abre la casa después de recargar');
  await sleep(1200);
  const after = await run(dani, `const h = store.state.home; return { wall: h.wall, floor: h.floor, puff: h.items.find(i => i.id === 'puff'), reloj: h.items.find(i => i.id === 'reloj'), tele: h.owned.tele }`);
  ok(after.wall === 'menta' && after.floor === 'baldosa' && after.puff?.x === target[0] && after.reloj?.rot % 2 === 1 && after.tele === 1, 'paredes, piso, muebles e inventario se guardaron', after);

  section('Ampliar la casa (niveles 2 a 5)');
  await run(dani, `store.grant({ coins: 200000, gems: 100, mats: { piedra: 200, madera: 200, mineral: 200, hierbas: 200 } }, 'test'); const c = store.state.city.buildings.find(b => b.id === 'castillo'); c.level = 5; E.tick(); return true;`);
  ok(await tap(dani, '.scene-home [data-hm="up"]'), 'toca «Ampliar»');
  ok(await waitFor(dani, `/Casa con ventanal/.test(document.querySelector('.hm-up-modal')?.textContent || '')`, 4000), 'muestra la próxima: «Casa con ventanal»');
  await shot(dani, 'ampliar');
  await tap(dani, '.hm-up-modal .btn', 'Ampliar');
  ok(await waitFor(dani, `window.__pixelia.economy.isUpgrading(window.__pixelia.store.state.city.buildings.find(b => b.id === 'mi_casa'))`, 4000), 'arranca la obra de ampliación (con constructora)');
  let before5 = null;
  for (let L = 2; L <= 5; L++) {
    if (L === 5) before5 = await run(dani, `return store.state.home.items.map(it => ({ uid: it.uid, x: it.x, z: it.z }))`);
    await run(dani, `const b = store.state.city.buildings.find(b => b.id === 'mi_casa'); if (!E.isUpgrading(b)) E.startUpgrade(b.uid); b.upgradeEnd = Date.now() - 1; E.tick(); return b.level;`);
    await sleep(1500);
    const hl = await home(dani);
    const want = ctx_sizes[L];
    ok(hl.level === L && hl.size.join('x') === want, `nivel ${L}: cuarto de ${want}`, { level: hl.level, size: hl.size });
    await shot(dani, `casa-nivel-${L}`);
  }
  const fit = await run(dani, `const h = store.state.home; return h.items.every(it => px.home.canPlaceItem(it.id, it.x, it.z, it.rot, it.uid).ok)`);
  ok(fit, 'después de ampliar, ningún mueble quedó encima de la arquitectura nueva');
  const moved = await run(dani, `return store.state.home.items.map(it => ({ uid: it.uid, x: it.x, z: it.z }))`);
  const dist = moved.map(m => { const o = before5.find(b => b.uid === m.uid); return o ? Math.hypot(m.x - o.x, m.z - o.z) : 0; });
  const movedN = dist.filter(d => d > 0).length;
  ok(movedN > 0 && Math.max(0, ...dist) <= 5, 'con el altillo, los muebles de abajo se corren cerca de donde estaban (no al centro)', { movedN, dist });

  section('Visita: la casa de una amistad');
  const pub = await run(dani, `const s = await import('/src/online/sync.js'); await s.publishProfileNow(true); const p = await px.net.getMyProfile(); return { code: p?.code, items: p?.city?.home?.items?.length || 0, id: px.net.user?.id };`);
  ok(pub.items > 0, 'el perfil publica la casa (city.home)', pub);
  const eli = await openPage('eli', 6);
  await eli.evaluate(async (code) => { await window.__pixelia.net.requestFriend(code); }, pub.code);
  await run(dani, `const f = (await px.net.listFriends())[0]; await px.net.respondFriend(f.id, true); return true;`);
  await run(eli, `ctx.router.go('home', { visit: '${pub.id}', name: 'Dani' }); return true;`);
  ok(await waitFor(eli, `!!document.querySelector('.scene-home')?.__home`, 12000), 'Eli entra a la casa de Dani');
  await sleep(1500);
  const vis = await home(eli);
  ok(vis.visit && vis.items.length === pub.items && /Casa de/.test(vis.title) && vis.level === 5, 've sus muebles, su nivel y el título «Casa de…»', vis && { n: vis.items.length, title: vis.title, level: vis.level });
  ok(!(await eli.evaluate(() => !!document.querySelector('.scene-home [data-hm="deco"]'))), 'de visita no se puede decorar');
  await shot(eli, 'visita-casa');
  await tap(eli, '.scene-home .hm-back');
  ok(await waitFor(eli, `window.__pixelia.ctx.router.current === 'city'`, 8000), 'volver lleva a la ciudad de la amistad');
} catch (e) {
  failN++;
  console.log('EXCEPCIÓN', e.stack || e);
}

await browser.close();
server.close();
if (errors.length) console.log('\n=== ERRORES DE PÁGINA ===\n' + [...new Set(errors)].join('\n'));
console.log(`\n${failN || errors.length ? '✘' : '✔'} ${okN} OK, ${failN} fallas, ${new Set(errors).size} errores de página`);
process.exit(failN || errors.length ? 1 : 0);
