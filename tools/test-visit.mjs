// Visitas entre amigas de punta a punta (modo mock, dos pestañas: ana y bea) con la interfaz real:
// agregarse por código → regalito diario → bea arranca una obra → ana la visita (Visitar en Amigas) → like, notita
// y "Ayudar" en la obra → a bea le llega al buzón (visita con notita + ayuda) → al cobrar, la obra se adelanta 15 min
// → pedido "Acelerá mi obra" que ana cumple desde Pedidos → la obra se adelanta otra vez.
// Complementa tools/test-social.mjs (intercambios, ranking, Obra en Equipo) y tools/test-mock.mjs (API).
//
//   node tools/test-visit.mjs [--out carpeta-de-capturas] [--no-shots]
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = resolve(opt('out', join(tmpdir(), 'pixelia-visit')));
const SHOTS = !opt('no-shots', false);
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
const VIEW = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ✔', msg); } else { fail++; console.log('  ✘', msg, extra !== undefined ? JSON.stringify(extra) : ''); } return !!c; };
const section = t => console.log('\n■', t);

async function open(user, extra = '') {
  const page = await browser.newPage();
  await page.setViewport(VIEW);
  await page.setUserAgent(UA);
  page.on('pageerror', e => errors.push(`[${user}] PAGEERROR: ` + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${user}] CONSOLE.ERROR: ` + m.text()); });
  await page.goto(`${BASE}?scene=city&mock=1&mockuser=${user}&reset${extra}&nosplash&nosw`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__pixelia?.ctx?.social, { timeout: 20000, polling: 150 });
  await page.evaluate(() => history.replaceState(null, '', location.href.replace(/&(reset|cheat=\d+)/g, '')));
  return page;
}
const ev = (page, code) => page.evaluate(`(async () => {
  const P = window.__pixelia, ctx = P.ctx, store = P.store, E = P.economy;
  const S = await import('/src/online/social.js');
  const sync = await import('/src/online/sync.js');
  const net = (await import('/src/online/net.js')).net;
  ${code}
})()`);
let front = null;
async function use(page) { if (front !== page) { await page.bringToFront(); front = page; await sleep(80); } }
async function shot(page, name) {
  if (!SHOTS) return;
  await use(page); await sleep(500);
  const f = join(OUT, name + '.png');
  await page.screenshot({ path: f });
  console.log('    📷', f);
}
/** Toque real (touch) en el centro del primer elemento visible que matchea (y opcional, cuyo texto matchea). */
async function tap(page, sel, text = null, timeout = 6000) {
  await use(page);
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const found = await page.evaluate((sel, text) => {
      const re = text ? new RegExp(text, 'i') : null;
      const e = [...document.querySelectorAll(sel)].find(x => { const b = x.getBoundingClientRect(); return b.width > 2 && b.height > 2 && (!re || re.test(x.textContent)); });
      if (!e) return false;
      document.querySelectorAll('[data-t]').forEach(x => x.removeAttribute('data-t'));
      e.setAttribute('data-t', '1'); e.scrollIntoView({ block: 'center' });
      return true;
    }, sel, text);
    if (found) {
      let p = null;
      for (let k = 0; k < 15; k++) {
        await sleep(90);
        const q = await page.evaluate(() => { const e = document.querySelector('[data-t]'); if (!e) return null; const b = e.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const hit = document.elementFromPoint(x, y); return { x, y, hit: !!hit && (hit === e || e.contains(hit) || hit.contains(e)) }; });
        if (!q) break;
        if (p && Math.abs(p.x - q.x) < .5 && Math.abs(p.y - q.y) < .5 && q.hit) { p = q; break; }
        p = q;
      }
      if (p) { await page.touchscreen.tap(p.x, p.y); return true; }
    }
    await sleep(150);
  }
  console.log(`    (no encontré ${sel}${text ? ' «' + text + '»' : ''})`);
  return false;
}
const waitFor = async (page, code, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await page.evaluate(code)) return true; } catch {} await sleep(150); } return false; };
const quiet = (page) => ev(page, `const { todayStr } = await import('/src/core/state.js'); store.state.login.last = todayStr(); store.state.season && (store.state.season.lastSeen = Date.now()); ctx.ui.closeAllModals(); return true;`);

try {
  section('Preparación: ana y bea con cuenta simulada');
  const A = await open('ana', '&cheat=6');
  await A.evaluate(() => { localStorage.removeItem('pixelia.mockdb'); for (const k of Object.keys(localStorage)) if (k.startsWith('pixelia.sync') || k.startsWith('pixelia.save')) localStorage.removeItem(k); });
  await A.goto(`${BASE}?scene=city&mock=1&mockuser=ana&reset&cheat=6&nosplash&nosw`, { waitUntil: 'load' });
  await A.waitForFunction(() => window.__pixelia?.ctx?.social, { timeout: 20000, polling: 150 });
  await A.evaluate(() => history.replaceState(null, '', location.href.replace(/&(reset|cheat=\d+)/g, '')));
  const B = await open('bea', '&cheat=6');
  await quiet(A); await quiet(B);
  const pa = await ev(A, `return await net.getMyProfile()`);
  const pb = await ev(B, `return await net.getMyProfile()`);
  ok(pa?.name === 'Ana' && pb?.name === 'Bea' && pa.code !== pb.code, `perfiles con nombre de la cuenta: ${pa?.name} (${pa?.code}) y ${pb?.name} (${pb?.code})`);
  ok(await ev(A, `return store.state.player.name`) === 'Ana', 'la partida de ana adopta el nombre de la cuenta');

  section('Agregarse por código (Amigas)');
  await use(A); await ev(A, `ctx.openSocial('amigas'); return true;`);
  await waitFor(A, `!!document.querySelector('.soc input[aria-label="Código de amistad"]')`);
  await A.type('.soc input[aria-label="Código de amistad"]', pb.code.toLowerCase());
  await tap(A, '.soc .btn.primary', '^Agregar$');
  await sleep(1200);
  await use(B); await ev(B, `ctx.openSocial('amigas'); return true;`);
  await sleep(1200);
  await shot(B, 'visit-01-bea-solicitud');
  await tap(B, '.soc .btn.mint', 'Aceptar');
  await sleep(1500);
  const fr = await ev(A, `return (await net.listFriends()).map(f => ({ name: f.name, status: f.status }))`);
  ok(fr.length === 1 && fr[0].name === 'Bea' && fr[0].status === 'accepted', 'ana y bea son amigas', fr);

  section('Regalito diario');
  await use(A); await ev(A, `await S.refreshSocial?.(); ctx.ui.closeAllModals(); ctx.openSocial('amigas'); return true;`);
  await sleep(1500);
  ok(await tap(A, '.soc-friend .btn', 'Regalo'), 'ana toca Regalo en la tarjeta de bea');
  await sleep(1200);
  await shot(A, 'visit-02-ana-amigas');
  const inboxB = await ev(B, `return (await net.inbox()).map(g => g.kind)`);
  ok(inboxB.includes('gift'), 'a bea le llegó el regalito al buzón', inboxB);

  section('Bea arranca una obra larga');
  await use(B); await ev(B, `ctx.ui.closeAllModals(); return true;`);
  const uid = await ev(B, `
    const city = P.city; city.S.startPlacement('casita'); await new Promise(r => setTimeout(r, 500));
    window.__pixelia.city.placer.confirm(); await new Promise(r => setTimeout(r, 500));
    const b = store.state.city.buildings.filter(b => b.id === 'casita').at(-1);
    if (!b) return null;
    b.buildEnd = Date.now() + 3 * 3600e3; store.markDirty(); E.tick();
    await sync.publishProfileNow(true);
    return b.uid;`);
  ok(uid != null, 'bea colocó una Casita en obra (3 h)', uid);
  const prof = await ev(A, `return (await net.getProfiles([${JSON.stringify(pb.id)}]))[0]?.city?.buildings?.find(b => b.uid === ${uid})`);
  ok(prof?.busyUntil > Date.now() && prof?.busyKind === 'build', 'el perfil público de bea trae la obra con busyUntil y busyKind=build', prof);

  section('Ana visita la ciudad de bea');
  await use(A); await ev(A, `ctx.ui.closeAllModals(); ctx.openSocial('amigas'); return true;`);
  await sleep(1200);
  await tap(A, '.soc-friend .btn', 'Visitar');
  ok(await waitFor(A, `window.__pixelia.ctx.router.visiting && !!document.querySelector('.cv-top')`, 15000), 'modo visita: cartel "Ciudad de Bea"');
  await sleep(2500);
  ok(await A.evaluate(() => /Bea/.test(document.querySelector('.cv-top')?.textContent || '') && document.getElementById('hud')?.classList.contains('hidden')), 'el HUD propio está oculto y el cartel dice Bea');
  ok(await A.evaluate(() => !document.querySelector('.modal.pnl-login, .modal.arrival-modal, .modal.pnl-levelup')), 'no aparecen premio diario ni subida de nivel encima de la visita');
  const helpN = await A.evaluate(() => document.querySelectorAll('.cv-help').length);
  ok(helpN >= 1, `burbuja "Ayudar" sobre la obra (${helpN})`);
  await shot(A, 'visit-03-ana-visita');
  await tap(A, '.cv-btns .btn.primary');
  await sleep(1500);
  await shot(A, 'visit-04-ana-like');
  await tap(A, '.cv-btns .btn.second');
  await waitFor(A, `!!document.querySelector('.cv-note textarea')`);
  await A.type('.cv-note textarea', '¡Qué linda tu casita!');
  await shot(A, 'visit-05-ana-notita');
  await tap(A, '.modal .modal-foot .btn.primary');
  await sleep(1200);
  await tap(A, '.cv-help');
  await sleep(1500);
  await shot(A, 'visit-06-ana-ayudo');
  const log = await ev(A, `const v = store.state.visitLog; return v?.hosts?.[${JSON.stringify(pb.id)}] || null`);
  ok(log?.liked && log?.note && log?.helped?.includes(uid), 'visitLog: like, notita y ayuda en esa obra', log);
  await tap(A, '.cv-btns .btn.mint', 'Volver');
  ok(await waitFor(A, `window.__pixelia.ctx.router.current === 'city' && !window.__pixelia.ctx.router.visiting && !document.getElementById('hud').classList.contains('hidden')`, 10000), 'vuelve a su ciudad con el HUD');

  section('A bea le llega todo al buzón y la obra se acelera');
  const before = await ev(B, `return store.state.city.buildings.find(b => b.uid === ${uid}).buildEnd`);
  await use(B); await ev(B, `ctx.ui.closeAllModals(); await sync.refreshInbox?.(); await S.refreshSocial?.(); ctx.openSocial('buzon'); return true;`);
  await sleep(1800);
  const txt = await B.evaluate(() => document.querySelector('.soc')?.innerText || '');
  ok(/Qué linda tu casita/.test(txt), 'bea ve la visita de ana con la notita en el Buzón');
  ok(/Ana/.test(txt), 'bea ve que fue Ana');
  await shot(B, 'visit-07-bea-buzon');
  // el HUD muestra como mucho 4 globitos por prioridad (Fase 5b): se mira la cuenta de Contactos, se vea o no
  const badge = await B.evaluate(() => { const h = window.__pixelia.ctx.hud; h.refreshBadges(); return h.badgeState().want.social || 0; });
  ok(badge >= 2, `globito de Amigas en el HUD de bea (${badge})`);
  await tap(B, '.soc .btn.gold', 'Cobrar todo');
  await sleep(2500);
  const after = await ev(B, `return store.state.city.buildings.find(b => b.uid === ${uid}).buildEnd`);
  ok(Math.round((before - after) / 60000) === 15, `la ayuda adelantó la obra ${Math.round((before - after) / 60000)} min`);

  section('Pedido de ayuda: "Acelerá mi obra" cumplido por ana');
  await use(B); await ev(B, `ctx.ui.closeAllModals(); ctx.openSocial('pedidos'); return true;`);
  await sleep(1200);
  await tap(B, '.soc .btn.primary', 'Pedir');
  await waitFor(B, `!!document.querySelector('.soc-kind')`);
  await tap(B, '.soc-kind', 'Acelerá');
  await sleep(300);
  await tap(B, '.soc-items .soc-item');
  await sleep(200);
  await shot(B, 'visit-08-bea-pedido');
  await tap(B, '.btn.primary', 'Publicar pedido');
  await sleep(1500);
  const mine = await ev(B, `return (await net.myRequests()).map(r => r.kind)`);
  ok(mine.includes('speedup'), 'bea publicó el pedido', mine);
  const before2 = await ev(B, `return store.state.city.buildings.find(b => b.uid === ${uid}).buildEnd`);
  await use(A); await ev(A, `ctx.ui.closeAllModals(); await S.refreshSocial?.(); ctx.openSocial('pedidos'); return true;`);
  await sleep(1800);
  await shot(A, 'visit-09-ana-pedidos');
  ok(await tap(A, '.soc-need .btn.mint', 'Ayudar'), 'ana toca Ayudar en el pedido de bea');
  await sleep(1800);
  await use(B); await ev(B, `ctx.ui.closeAllModals(); await sync.refreshInbox?.(); await S.refreshSocial?.(); ctx.openSocial('buzon'); return true;`);
  await sleep(1500);
  await tap(B, '.soc .btn.gold', 'Cobrar todo');
  await sleep(2500);
  const after2 = await ev(B, `return store.state.city.buildings.find(b => b.uid === ${uid}).buildEnd`);
  ok(Math.round((before2 - after2) / 60000) === 30, `el pedido cumplido adelantó la obra ${Math.round((before2 - after2) / 60000)} min`);
  await ev(B, `ctx.ui.closeAllModals(); return true;`);
  await sleep(800);
  await shot(B, 'visit-10-bea-ciudad');
} catch (e) {
  fail++;
  console.log('EXCEPCIÓN', e.stack || e);
}
await browser.close();
server.close();
if (errors.length) console.log('\n=== ERRORES DE PÁGINA ===\n' + [...new Set(errors)].join('\n'));
console.log(`\n${fail || errors.length ? '✘' : '✔'} ${pass} OK, ${fail} fallas, ${new Set(errors).size} errores de página`);
process.exit(fail || errors.length ? 1 : 0);
