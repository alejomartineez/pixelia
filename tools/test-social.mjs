// Prueba de punta a punta de la UI social (src/online/social*.js) con dos jugadoras simuladas
// (ana y bea) en dos pestañas del mismo origen (?mock=1&mockuser=…), usando la interfaz real.
//
//   node tools/test-social.mjs [--out carpeta-de-capturas] [--no-shots]
//
// Cubre: amistad por código, regalito diario, pedido de figurita cumplido, intercambio de figuritas
// con escrow, intercambio de monedas rechazado (devolución), buzón y "Cobrar todo", Obra en Equipo
// (puntos por bus + escalón), ranking semanal (stats.week publicado) + premio, badge, 'album:trade',
// cuenta (off / sin sesión / con sesión) y elección de partida. Capturas de cada pestaña en iPhone y PC.
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = resolve(opt('out', join(tmpdir(), 'pixelia-social')));
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

const VIEW = {
  iphone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1366, height: 800, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Saca &reset/&cheat de la URL para que una recarga (p.ej. al cambiar el viewport a PC) conserve la partida. */
const noReset = (page) => page.evaluate(() => history.replaceState(null, '', location.href.replace(/&(reset|cheat=\d+)/g, '')));
/** Cambia el viewport (puppeteer recarga la página si cambia isMobile) y espera a que el juego vuelva a estar listo. */
async function setDevice(page, device) {
  await page.setViewport(VIEW[device]);
  await page.setUserAgent(device === 'iphone' ? UA_IPHONE : (await browser.userAgent()).replace('HeadlessChrome', 'Chrome'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__pixelia?.ctx?.social, { timeout: 20000, polling: 150 });
  await ev(page, `const { todayStr } = await import('/src/core/state.js'); P.store.state.login.last = todayStr(); ctx.ui.closeAllModals();`);
  await sleep(500);
}
async function open(query, device = 'iphone', { emptyConfig = false } = {}) {
  const page = await browser.newPage();
  if (emptyConfig) {
    // Simula un config.js vacío (el real ya apunta al Supabase del proyecto).
    await page.setRequestInterception(true);
    page.on('request', r => r.url().endsWith('/src/online/config.js')
      ? r.respond({ contentType: 'text/javascript', body: "export const SUPABASE_URL = ''; export const SUPABASE_ANON_KEY = '';" })
      : r.continue());
  }
  await page.setViewport(VIEW[device]);
  if (device === 'iphone') await page.setUserAgent(UA_IPHONE);
  const tag = (query.match(/mockuser=(\w+)/) || [, query.includes('mock') ? 'mock' : 'off'])[1];
  page.on('pageerror', e => errors.push(`[${tag}] PAGEERROR: ` + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] CONSOLE.ERROR: ` + m.text()); });
  await page.goto(BASE + query + '&nosplash&nosw', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__pixelia?.ctx, { timeout: 20000, polling: 150 });
  await noReset(page);
  return page;
}
/** Corre código async en la página con P (window.__pixelia), ctx, S (social.js), sync, al (album.js). */
const ev = (page, code) => page.evaluate(`(async () => {
  const P = window.__pixelia, ctx = P.ctx;
  const S = await import('/src/online/social.js');
  const sync = await import('/src/online/sync.js');
  const al = await import('/src/album/album.js');
  const net = (await import('/src/online/net.js')).net;
  ${code}
})()`);
let front = null;
/** Las pestañas en segundo plano no corren requestAnimationFrame: traer al frente antes de usarla. */
async function use(page) { if (front !== page) { await page.bringToFront(); front = page; await sleep(60); } }
async function click(page, sel) {
  await use(page);
  await page.waitForSelector(sel, { timeout: 8000, polling: 150 });
  await page.evaluate((s) => { const el = document.querySelector(s); el.scrollIntoView({ block: 'center' }); el.click(); }, sel);
  await sleep(120);
}
async function shot(page, name) {
  if (!SHOTS) return;
  await use(page);
  await sleep(450);
  await page.screenshot({ path: join(OUT, name + '.png') });
  console.log('    📷', name);
}
/** Espera a que el panel deje de mostrar "Cargando…". */
async function settle(page) {
  await page.waitForFunction(() => !document.querySelector('.soc-loading'), { timeout: 10000, polling: 150 }).catch(() => {});
  await sleep(250);
}
async function tab(page, id) { await use(page); await ev(page, `await S.openSocial(ctx, '${id}')`); await settle(page); }

let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ✔', msg); } else { fail++; console.log('  ✘', msg, extra !== undefined ? JSON.stringify(extra) : ''); } };
const section = t => console.log('\n■', t);

try {
  // ---------------------------------------------------------------
  section('Preparación');
  let A = await open('?scene=city&mock=1&mockuser=ana&reset&cheat=8');
  await A.evaluate(() => { localStorage.removeItem('pixelia.mockdb'); for (const k of Object.keys(localStorage)) if (k.startsWith('pixelia.sync')) localStorage.removeItem(k); });
  await A.goto(BASE + '?scene=city&mock=1&mockuser=ana&reset&cheat=8&nosplash&nosw', { waitUntil: 'load' });
  await A.waitForFunction(() => window.__pixelia?.ctx?.social, { timeout: 20000, polling: 150 });
  await noReset(A);
  const B = await open('?scene=city&mock=1&mockuser=bea&reset&cheat=6');
  await B.waitForFunction(() => window.__pixelia?.ctx?.social, { timeout: 20000, polling: 150 });
  // figuritas de prueba: tres de 2★ (X para pedir, Y para ofrecer, Z para pedir en intercambio)
  const ids = await ev(A, `const two = al.STICKERS.filter(s => s.stars === 2); return [two[0].id, two[1].id, two[2].id];`);
  const [X, Y, Z] = ids;
  const prep = (name, stickers) => `
    const { todayStr } = await import('/src/core/state.js');
    P.store.state.login.last = todayStr();
    P.store.state.player.name = '${name}';
    al.giveStickers(${JSON.stringify(stickers)}, 'test');
    P.store.save();
    ctx.ui.closeAllModals();
    await sync.publishProfileNow(true);
    return { user: net.user?.email, social: !!ctx.social };`;
  const pa = await ev(A, prep('Ana', { [Y]: 3 }));
  const pb = await ev(B, prep('Bea', { [X]: 3, [Z]: 2 }));
  ok(pa.user === 'ana@mock.test' && pb.user === 'bea@mock.test' && pa.social && pb.social, 'ana y bea entran solas y el núcleo cargó social.js', [pa, pb]);
  await sleep(600);

  // ---------------------------------------------------------------
  section('Amistad por código');
  await tab(A, 'amigas');
  const code = await A.$eval('.soc-code', el => el.getAttribute('aria-label').replace('Código ', ''));
  ok(/^[A-HJ-NP-Z2-9]{6}$/.test(code), `ana ve su código grande (${code})`);
  await shot(A, 'iphone-amigas-vacia');
  await tab(B, 'amigas');
  await B.type('.soc-add input', code.toLowerCase());
  ok((await B.$eval('.soc-add input', el => el.value)) === code, 'el campo pasa el código a mayúsculas');
  await click(B, '.soc-add .btn');
  await sleep(500);
  await B.waitForSelector('.soc-req', { timeout: 8000, polling: 150 });
  ok(await B.$eval('.soc-wrap', el => el.textContent.includes('Esperando respuesta')), 'bea ve su solicitud saliente');
  await ev(A, `await S.refreshSocial()`);
  const badgeA = await ev(A, `return S.socialBadge()`);
  ok(badgeA >= 1, `badge de ana cuenta la solicitud entrante (${badgeA})`);
  await tab(A, 'amigas');
  await A.waitForSelector('.soc-req .btn.mint', { timeout: 8000, polling: 150 });
  await shot(A, 'iphone-amigas-solicitud');
  await click(A, '.soc-req .btn.mint');
  await A.waitForSelector('.soc-friend', { timeout: 8000, polling: 150 });
  ok(await A.$eval('.soc-friend', el => el.textContent.includes('Bea') && el.textContent.includes('Saludo')), 'ana acepta: bea en la lista con nivel de amistad');

  // ---------------------------------------------------------------
  section('Regalito diario');
  await tab(B, 'amigas');
  await B.waitForSelector('.soc-friend .soc-acts .btn.primary', { timeout: 8000, polling: 150 });
  const beaPtsBefore = await ev(B, `return S.coopInfo().total`);
  // sin sorpresa al azar (objeto/figurita) para que las cuentas de figuritas de la prueba sean exactas
  await B.evaluate(() => { window.__rnd = Math.random; Math.random = () => 0.9; });
  await click(B, '.soc-friend .soc-acts .btn.primary');
  await B.waitForFunction(() => document.querySelector('.soc-friend .soc-acts .btn.primary')?.classList.contains('done'), { timeout: 8000, polling: 150 });
  await B.evaluate(() => { Math.random = window.__rnd; });
  ok(true, 'bea manda el regalito y el botón queda "Enviado"');
  ok((await ev(B, `return S.coopInfo().total`)) >= beaPtsBefore + 10, 'regalito suma 10 puntos a la Obra en Equipo de bea');
  const again = await ev(B, `const f = S.socialCache.friends.find(x => x.name === 'Ana'); return await S.sendDailyGift(f)`);
  ok(/Ya le mandaste/.test(again?.error || ''), 'segundo regalito del día → error amable');
  await shot(B, 'iphone-amigas-lista');

  // ---------------------------------------------------------------
  section('Buzón: cobrar el regalito');
  await ev(A, `await S.refreshSocial()`);
  ok((await ev(A, `return S.socialBadge()`)) >= 1, 'badge de ana suma el buzón');
  await tab(A, 'buzon');
  await A.waitForSelector('.soc-mail', { timeout: 8000, polling: 150 });
  ok(await A.$eval('.soc-wrap', el => el.textContent.includes('Regalo de Bea')), 'ana ve "Regalo de Bea"');
  await shot(A, 'iphone-buzon');
  const coins0 = await ev(A, `return P.store.state.coins`);
  await click(A, '.soc-claimall .btn.gold');
  await A.waitForFunction(() => !document.querySelector('.soc-mail'), { timeout: 8000, polling: 150 });
  const coins1 = await ev(A, `return P.store.state.coins`);
  ok(coins1 > coins0, `Cobrar todo acredita monedas (${coins0} → ${coins1})`);

  // ---------------------------------------------------------------
  section('Pedido de figurita');
  await tab(A, 'pedidos');
  await click(A, '.soc-mine .btn.primary');
  await A.waitForSelector('.modal.soc-ed .soc-kind', { timeout: 8000, polling: 150 });
  await click(A, '.modal.soc-ed .soc-kind');
  await A.waitForSelector(`.soc-pick .stk[data-id="${X}"]`, { timeout: 8000, polling: 150 });
  await A.evaluate((id) => document.querySelector(`.soc-pick .stk[data-id="${id}"]`).closest('button').click(), X);
  await sleep(200);
  ok(await A.$eval(`.soc-pick .stk[data-id="${X}"]`, el => el.closest('button').querySelector('.soc-has')?.textContent.includes('Bea')), 'el creador marca que Bea tiene esa figurita repetida');
  await shot(A, 'iphone-pedido-crear');
  await click(A, '.modal.soc-ed .modal-foot .btn.primary');
  await A.waitForFunction(() => !document.querySelector('.modal.soc-ed'), { timeout: 8000, polling: 150 });
  await settle(A);
  ok(await A.$eval('.soc-wrap', el => el.textContent.includes('Vence en')), 'el pedido aparece en "Pedí una mano" con vencimiento');
  await shot(A, 'iphone-pedidos-mios');
  await tab(B, 'pedidos');
  await B.waitForSelector('.soc-need .btn.mint:not([disabled])', { timeout: 8000, polling: 150 });
  await shot(B, 'iphone-pedidos-amigas');
  const bBefore = await ev(B, `return { n: al.stickerCount('${X}'), coins: P.store.state.coins, pts: S.coopInfo().total, chispas: P.store.state.season?.points || 0 }`);
  await click(B, '.soc-need .btn.mint');
  await sleep(900);
  const bAfter = await ev(B, `return { n: al.stickerCount('${X}'), coins: P.store.state.coins, pts: S.coopInfo().total, chispas: P.store.state.season?.points || 0 }`);
  ok(bAfter.n === bBefore.n - 1, `bea entrega la repetida (${bBefore.n} → ${bAfter.n})`);
  ok(bAfter.coins > bBefore.coins && bAfter.pts >= bBefore.pts + 50, 'bea gana monedas y 50 puntos de equipo', [bBefore, bAfter]);
  ok(bAfter.chispas > bBefore.chispas, `bea gana chispas del pase por ayudar (social:helped) ${bBefore.chispas} → ${bAfter.chispas}`);
  await tab(A, 'buzon');
  await A.waitForSelector('.soc-mail', { timeout: 8000, polling: 150 });
  ok(await A.$eval('.soc-wrap', el => el.textContent.includes('completó tu pedido')), 'ana recibe "Bea completó tu pedido"');
  await click(A, '.soc-claimall .btn.gold');
  await sleep(700);
  ok((await ev(A, `return al.stickerCount('${X}')`)) === 1, 'ana pega la figurita pedida');

  // ---------------------------------------------------------------
  section('Intercambio de figuritas con escrow');
  await ev(B, `await sync.publishProfileNow(true)`);
  await tab(A, 'amigas');
  await click(A, '.soc-friend .soc-acts .btn.second');
  await A.waitForSelector('.modal.soc-ed .soc-pane-box.give .soc-pick', { timeout: 8000, polling: 150 });
  await settle(A);
  await A.evaluate((id) => document.querySelector(`.soc-pane-box.give .stk[data-id="${id}"]`).closest('button').click(), Y);
  await sleep(150);
  await A.waitForSelector(`.soc-pane-box.get .stk[data-id="${Z}"]`, { timeout: 8000, polling: 150 });
  await A.evaluate((id) => document.querySelector(`.soc-pane-box.get .stk[data-id="${id}"]`).closest('button').click(), Z);
  await sleep(150);
  ok(await A.$eval('.modal.soc-ed .modal-foot .btn.second', b => !b.disabled), 'el editor habilita "Proponer" con una figurita de cada lado (±1★)');
  await shot(A, 'iphone-intercambio-editor');
  const yBefore = await ev(A, `return al.stickerCount('${Y}')`);
  await click(A, '.modal.soc-ed .modal-foot .btn.second');
  await A.waitForFunction(() => !document.querySelector('.modal.soc-ed'), { timeout: 8000, polling: 150 });
  ok((await ev(A, `return al.stickerCount('${Y}')`)) === yBefore - 1, `escrow: la figurita ofrecida se descuenta al proponer (${yBefore} → ${yBefore - 1})`);
  await ev(B, `await S.refreshSocial()`);
  ok((await ev(B, `return S.tabCounts().buzon`)) >= 1, 'bea tiene el intercambio pendiente en el buzón');
  await tab(B, 'buzon');
  await B.waitForSelector('.soc-trade .btn.mint:not([disabled])', { timeout: 8000, polling: 150 });
  await shot(B, 'iphone-buzon-intercambio');
  const zBefore = await ev(B, `return al.stickerCount('${Z}')`);
  await click(B, '.soc-trade .btn.mint');
  await sleep(900);
  ok((await ev(B, `return al.stickerCount('${Z}')`)) === zBefore - 1, 'bea acepta y entrega su figurita');
  await tab(B, 'buzon');
  if (await B.$('.soc-claimall .btn.gold')) { await click(B, '.soc-claimall .btn.gold'); await sleep(700); }
  ok((await ev(B, `return al.stickerCount('${Y}')`)) === 1, 'bea cobra la figurita de ana');
  await tab(A, 'buzon');
  await A.waitForSelector('.soc-claimall .btn.gold', { timeout: 8000, polling: 150 });
  await click(A, '.soc-claimall .btn.gold');
  await sleep(700);
  ok((await ev(A, `return al.stickerCount('${Z}')`)) === 1, 'ana cobra la figurita de bea');

  section('Intercambio de monedas rechazado → devolución');
  const t = await ev(A, `const f = S.socialCache.friends.find(x => x.name === 'Bea'); const c0 = P.store.state.coins; const r = await S.proposeTrade(f, { coins: 100 }, { gems: 2 }); return { r, d: c0 - P.store.state.coins }`);
  ok(t.r.ok && t.d === 100, 'proponer descuenta las 100 monedas (escrow)', t);
  await tab(A, 'buzon');
  await shot(A, 'iphone-buzon-mis-intercambios');
  await ev(B, `await S.refreshSocial()`);
  await tab(B, 'buzon');
  await B.waitForSelector('.soc-trade .btn.ghost', { timeout: 8000, polling: 150 });
  await click(B, '.soc-trade .btn.ghost');
  await sleep(800);
  await tab(A, 'buzon');
  ok(await A.waitForFunction(() => document.querySelector('.soc-wrap')?.textContent.includes('Te devolvieron'), { timeout: 8000, polling: 150 }).then(() => true, () => false), 'ana ve la devolución en el buzón');
  const c2 = await ev(A, `return P.store.state.coins`);
  await click(A, '.soc-claimall .btn.gold'); await sleep(700);
  ok((await ev(A, `return P.store.state.coins`)) === c2 + 100, 'la devolución vuelve a ana');

  // ---------------------------------------------------------------
  section('Obra en Equipo');
  for (const p of [A, B]) await ev(p, `P.bus.emit('expedition:finished', { region: 'bosque', kind: 'normal', stars: 3, reason: 'volvio' }); P.bus.emit('building:upgraded', { b: P.store.state.city.buildings[0], level: 1 }); await S.flushCoop();`);
  const coop = await ev(A, `S.addCoopPoints(600, 'test'); await S.flushCoop(); await S.refreshSocial(['coop']); return S.coopInfo()`);
  ok(coop.online && coop.members.length === 2 && coop.members.every(m => m.points > 0), 'coopStatus online con aportes de ana y bea', coop.members);
  ok(coop.goal === 2000 && coop.tiers[0].reached, `meta = 1000 × 2 activas, escalón 1 alcanzado (total ${coop.total})`);
  await tab(A, 'equipo');
  await A.waitForSelector('.soc-tier.claimable .btn', { timeout: 8000, polling: 150 });
  await shot(A, 'iphone-equipo');
  const cc0 = await ev(A, `return P.store.state.coins`);
  await click(A, '.soc-tier.claimable .btn');
  await sleep(600);
  ok((await ev(A, `return P.store.state.coins`)) > cc0 && (await ev(A, `return S.coopInfo().tiers[0].claimed`)), 'cobrar el escalón 1 (una sola vez por semana)');

  // ---------------------------------------------------------------
  section('Ranking semanal');
  await ev(B, `await sync.publishProfileNow(true)`);
  const prof = await ev(A, `const f = S.socialCache.friends.find(x => x.name === 'Bea'); return (await net.getProfiles([f.id]))[0].stats.week`);
  ok(prof?.id && prof.stars >= 3 && prof.exps >= 1 && !('match3' in prof), 'stats.week publicado en el perfil de bea (estrellas y salidas de expedición)', prof);
  const prev = await ev(A, `const w = (await import('/src/online/net.js')).isoWeek(new Date(Date.now() - 7 * 864e5));
    P.store.state.social.rank.hist[w] = { stars: 2, played: 2 }; return w`);
  await tab(A, 'ranking');
  await A.waitForSelector('.soc-podium', { timeout: 8000, polling: 150 });
  const rk = await A.$$eval('.soc-rrow', rows => rows.map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  ok(rk.length === 2, 'ranking con ana y bea', rk);
  ok(await A.$eval('.soc-wrap', el => el.textContent.includes('Mejor marca personal')), 'insignia de mejor marca personal (más estrellas que la semana pasada)');
  await shot(A, 'iphone-ranking');
  ok(await A.$eval('.soc-prize', el => el.textContent.includes('¡Premio de la semana!')), `premio de participación de la semana ${prev} disponible`);
  const rc0 = await ev(A, `return P.store.state.coins`);
  // los domingos también se cobra la semana en curso: se cuenta que se fue una sola semana, no que no quede ninguna
  const pw0 = await ev(A, `return S.rankPrizeWeeks().length`);
  await click(A, '.soc-prize .btn.gold');
  await sleep(600);
  ok((await ev(A, `return P.store.state.coins`)) > rc0 && (await ev(A, `return S.rankPrizeWeeks().length`)) === pw0 - 1, 'cobrar el premio de participación (una vez)');
  await click(A, '.soc-cat:nth-child(5)');
  await shot(A, 'iphone-ranking-encanto');

  // ---------------------------------------------------------------
  section('Expedición del día');
  const dailyRun = (page) => ev(page, `
    const E = await import('/src/core/economy.js');
    const X = await import('/src/expedition/expedition.js');
    if (!P.store.state.city.buildings.some(b => b.id === 'casa_exp')) {
      const { min, max } = E.landBounds();
      outer: for (let z = min; z < max; z++) for (let x = min; x < max; x++) if (E.canPlace('casa_exp', x, z, 0).ok) {
        const b = E.placeBuilding('casa_exp', x, z, 0); if (b.buildEnd) { b.buildEnd = Date.now() - 1; E.tick(); } break outer;
      }
    }
    const e = X.expState();
    if (e.active) { X.finishExpedition(e.active); }
    const before = { prov: P.store.state.prov, free: e.freeDay, gems: P.store.state.gems, att: JSON.stringify(e.attempts) };
    const st = X.expeditionStatus();
    const r = X.startExpedition({ daily: true });
    if (r.error) return { error: r.error, st: { hasBase: st.hasBase, reasonDaily: st.reasonDaily } };
    const run = r.run;
    const sum = X.finishExpedition(run);
    const again = X.startExpedition({ daily: true });
    const after = { prov: P.store.state.prov, free: e.freeDay, gems: P.store.state.gems, att: JSON.stringify(e.attempts) };
    await new Promise(res => setTimeout(res, 400));
    return { seed: run.seed, region: run.region, zone: run.zone, kind: run.kind, info: X.dailyInfo(), daily: sum.daily, before, after, again: again.error || null };`);
  const da = await dailyRun(A), dbb = await dailyRun(B);
  ok(!da.error && !dbb.error, 'ana y bea salen a la Expedición del día', [da.error, dbb.error, da.st]);
  ok(da.seed === dbb.seed && da.region === dbb.region && da.seed === da.info.seed && da.zone === 2 && da.kind === 'corta', `misma semilla para las dos (${da.seed}, ${da.region}, zona ${da.zone})`, [da.seed, dbb.seed]);
  ok(da.before.prov === da.after.prov && da.before.free === da.after.free && da.before.att === da.after.att, 'no gasta provisiones, ni la salida corta, ni intentos de zona', [da.before, da.after]);
  ok(da.after.gems === da.before.gems + 3 && da.daily?.prize?.gems === 3, 'premio chico por participar (3 gemas)', [da.before.gems, da.after.gems]);
  ok(/ya se hizo/.test(da.again || ''), 'una por día: la segunda dice que mañana hay otra', da.again);
  ok(typeof da.daily?.score === 'number' && da.daily.day === da.info.day, `botín en puntos (${da.daily?.score}) del día ${da.info.day}`);
  const dRows = await ev(A, `await S.refreshSocial(['daily']); return S.dailyStatus().rows`);
  ok(dRows?.length === 2 && dRows.some(r => r.me) && dRows.some(r => r.name === 'Bea'), 'ranking del día con ana y bea (se mandó solo al volver)', dRows);
  ok((await ev(A, `return S.rankInfo().mine.exps`)) >= 1, 'la salida cuenta en "Salidas" del ranking semanal');
  await tab(A, 'ranking');
  ok(await A.$eval('.soc-daily', el => el.textContent.includes('Expedición del día') && el.querySelectorAll('.soc-drow').length === 2), 'el ranking muestra la Expedición del día con el podio de contactos');
  await shot(A, 'iphone-ranking-diaria');
  const cats = await A.$$eval('.soc-cat', b => b.map(x => x.textContent.trim()));
  ok(cats.join() === 'Estrellas,Salidas,Botín,Defensa,Encanto', 'categorías del ciclo: Estrellas, Salidas, Botín, Defensa, Encanto', cats);

  // ---------------------------------------------------------------
  section('Cuadrilla para la amenaza de un contacto');
  const thB = await ev(B, `
    const T = await import('/src/threats/threats.js');
    const E = await import('/src/core/economy.js');
    // rango Caserío (Municipalidad nivel 2) y simulacro ya hecho: así le toca la próxima del calendario
    const c = P.store.state.city.buildings.find(b => b.id === 'castillo'); if (c && (c.level || 1) < 2) c.level = 2;
    P.store.state.threats ||= {}; P.store.state.threats.sim = { at: 0, start: 0, end: 0, done: true }; T.tick();
    let t = T.currentThreat();
    if (!t) return { error: 'sin amenaza (rango ' + E.townRank() + ')' };
    if (T.nowMs() < t.announce) T._debugShift(t.announce - T.nowMs() + 60e3);
    const pt = T.publicThreat();
    await sync.publishProfileNow(true);
    return { id: t.id, pt };`);
  ok(!!thB.pt && thB.pt.id === thB.id && thB.pt.end > Date.now(), `bea publica su amenaza avisada (${thB.id})`, thB);
  const beaId = await ev(A, `return S.socialCache.friends.find(x => x.name === 'Bea').id`);
  await ev(A, `await S.friendProfiles(true)`);   // los perfiles se cachean 2 min
  await tab(A, 'amigas');
  await A.waitForSelector('.soc-friend .soc-crew', { timeout: 8000, polling: 150 }).catch(() => {});
  ok(await A.$eval('.soc-friend', el => !!el.querySelector('.soc-crew') && !!el.querySelector('.soc-threat')), 'ana ve la amenaza de bea y el botón "Mandar una cuadrilla"');
  await shot(A, 'iphone-amigas-cuadrilla');
  const cw0 = await ev(A, `return { coins: P.store.state.coins, pts: S.coopInfo().total, chispas: P.store.state.season?.points || 0 }`);
  await click(A, '.soc-friend .soc-crew');
  await A.waitForFunction(() => document.querySelector('.soc-crew')?.classList.contains('done'), { timeout: 8000, polling: 150 }).catch(() => {});
  const cw1 = await ev(A, `return { coins: P.store.state.coins, pts: S.coopInfo().total, chispas: P.store.state.season?.points || 0, sent: S.crewSent('${beaId}', '${thB.id}') }`);
  ok(cw1.sent && cw1.coins > cw0.coins && cw1.pts >= cw0.pts + 30, 'ana manda la cuadrilla: premio en monedas y puntos de equipo', [cw0, cw1]);
  await shot(A, 'iphone-amigas-cuadrilla-enviada');
  ok((await ev(A, `return (await S.sendCrew(S.socialCache.friends.find(x => x.name === 'Bea'))).error || ''`)).includes('Ya mandaste'), 'la segunda para la misma amenaza → error amable');
  const hb = await ev(B, `
    const T = await import('/src/threats/threats.js');
    await S.refreshSocial(['crews']);
    const h = T.helpFor('${thB.id}');
    const st = T.threatStatus();
    const rep = T.reportStatus();
    return { n: h.n, bonus: h.bonus, names: h.names, stHelp: st?.help?.n, newN: rep?.helpNew?.length || 0 };`);
  ok(hb.n === 1 && hb.names[0] === 'Ana' && hb.bonus > 0 && hb.stHelp === 1, 'bea recibe la cuadrilla de ana: suma preparación a su amenaza', hb);
  ok(hb.newN === 1, 'queda para contarla en "Mientras no estabas…"');
  // 'social:crews' abre "Mientras no estabas…" si la ciudad está libre; si no, se ve en la próxima llegada
  await use(B); await sleep(2500);
  const arr = await ev(B, `
    const txt = [...document.querySelectorAll('.modal')].map(m => m.textContent).join(' ');
    if (/cuadrilla/.test(txt)) { ctx.ui.closeAllModals(); return { modal: true, txt }; }
    const m = await import('/src/threats/threat-ui.js');
    return { modal: false, txt: (m.reportParts(ctx)?.lines || []).join(' ') };`);
  ok(/Ana/.test(arr.txt) && /cuadrilla/.test(arr.txt), `"Mientras no estabas…" cuenta que Ana mandó una cuadrilla${arr.modal ? ' (se abrió solo)' : ''}`, arr);
  const res = await ev(B, `
    const T = await import('/src/threats/threats.js');
    const t = T.currentThreat();
    T._debugShift(t.end - T.nowMs() + 60e3);
    const r = P.store.state.threats.results['${thB.id}'];
    T._debugReset();
    return r ? { help: r.help, pct: r.pct, mode: r.mode } : null;`);
  ok(res?.mode === 'auto' && res.help?.includes('Ana'), 'al resolverse sola, la amenaza recuerda la ayuda de Ana', res);

  // ---------------------------------------------------------------
  section('Badge y álbum');
  const bd = await ev(B, `let got = null; const off = P.bus.on('social:badge', e => { got = e; }); S.addCoopPoints(5000, 'test'); off(); return { got, n: S.socialBadge(), counts: S.tabCounts() }`);
  ok(bd.got && bd.got.count === bd.n && bd.counts.equipo >= 1, 'social:badge se emite cuando aparece un escalón cobrable', bd);
  const at = await ev(A, `ctx.ui.closeAllModals(); const p = { id: '${Y}', mode: 'offer', handled: false }; P.bus.emit('album:trade', p); return p.handled`);
  await A.waitForSelector('.soc-fpick button', { timeout: 8000, polling: 150 });
  ok(at === true, "'album:trade' offer → handled y abre el selector de amiga");
  await shot(A, 'iphone-album-ofrecer');
  await ev(A, `ctx.ui.closeAllModals(); const p = { id: '${X}', mode: 'ask', handled: false }; P.bus.emit('album:trade', p);`);
  await A.waitForSelector('.modal.soc-ed .soc-kind.on', { timeout: 8000, polling: 150 });
  ok(true, "'album:trade' ask → abre el creador de pedidos con la figurita");
  await ev(A, `ctx.ui.closeAllModals()`);

  // ---------------------------------------------------------------
  section('Cuenta y conflicto');
  await ev(A, `await S.openAccount(ctx)`);
  await A.waitForSelector('.soc-sync', { timeout: 8000, polling: 150 });
  ok(await A.$eval('.modal.soc-account', el => el.textContent.includes('Ana') && el.textContent.includes('Cerrar sesión')), 'cuenta con sesión: nombre, sincronización y salir');
  await shot(A, 'iphone-cuenta');
  await ev(A, `ctx.ui.closeAllModals()`);
  const cfP = ev(A, `return await S.handleConflict(ctx, { local: { level: 8, coins: 1200, gems: 30, buildings: 6, at: new Date(Date.now() - 3600e3).toISOString() }, cloud: { level: 11, coins: 5400, gems: 80, buildings: 14, at: new Date(Date.now() - 86400e3).toISOString() } })`);
  await A.waitForSelector('.soc-cf', { timeout: 8000, polling: 150 });
  await shot(A, 'iphone-conflicto');
  await click(A, '.soc-cf .soc-card:not(.rec) .btn');
  ok((await cfP) === 'local', 'elegir partida resuelve la promesa de handleConflict');

  const O = await open('?scene=city&reset', 'iphone', { emptyConfig: true });
  await ev(O, `const { todayStr } = await import('/src/core/state.js'); P.store.state.login.last = todayStr(); ctx.ui.closeAllModals(); await ctx.openAccount();`);
  await O.waitForSelector('.modal.soc-account', { timeout: 8000, polling: 150 });
  ok(await O.$eval('.modal.soc-account', el => el.textContent.includes('se configure el servidor')), 'modo off: explica que el online llega cuando se configure el servidor');
  await shot(O, 'iphone-cuenta-off');
  await ev(O, `ctx.ui.closeAllModals(); await ctx.openSocial('amigas')`);
  await O.waitForSelector('.soc-connect', { timeout: 8000, polling: 150 });
  await shot(O, 'iphone-amigas-off');
  await ev(O, `P.bus.emit('expedition:finished', { region: 'bosque', kind: 'normal', stars: 2, reason: 'volvio' })`);
  await tab(O, 'equipo');
  ok((await ev(O, `return S.coopInfo()`)).total === 30, 'sin conexión la Obra en Equipo es personal (suma igual)');
  await O.close();
  const M = await open('?scene=city&mock=1&reset');
  await ev(M, `const { todayStr } = await import('/src/core/state.js'); P.store.state.login.last = todayStr(); ctx.ui.closeAllModals(); await ctx.openAccount();`);
  await M.waitForSelector('.modal.soc-account input[type=email]', { timeout: 8000, polling: 150 });
  await M.type('.modal.soc-account input[type=text]', 'Cami');
  await M.type('.modal.soc-account input[type=email]', 'cami@test.com');
  await M.type('.modal.soc-account input[type=password]', '123');
  await click(M, '.modal.soc-account .btn.primary.block');
  await sleep(400);
  ok(await M.$eval('.soc-err', el => el.textContent.includes('6 caracteres')), 'crear cuenta: error amable de contraseña corta');
  await shot(M, 'iphone-cuenta-crear');
  await M.type('.modal.soc-account input[type=password]', '456');
  await click(M, '.modal.soc-account .btn.primary.block');
  await M.waitForSelector('.soc-sync', { timeout: 8000, polling: 150 });
  ok((await ev(M, `return { u: net.user?.email, name: P.store.state.player.name }`)).name === 'Cami', 'crear cuenta entra y usa el nombre elegido');
  await M.close();

  // ---------------------------------------------------------------
  section('Capturas en PC');
  front = null;
  await setDevice(A, 'desktop');
  ok((await ev(A, `return P.store.state.player.name`)) === 'Ana', 'al recargar en PC la partida de ana sigue ahí');
  for (const id of ['amigas', 'pedidos', 'buzon', 'ranking', 'equipo']) { await tab(A, id); await shot(A, 'desktop-' + id); }
  await ev(A, `ctx.ui.closeAllModals()`);
  await ev(A, `const f = S.socialCache.friends.find(x => x.name === 'Bea'); (await import('/src/online/social-trade.js')).openTradeEditor(ctx, { friend: f })`);
  await A.waitForSelector('.modal.soc-ed', { timeout: 8000, polling: 150 });
  await settle(A);
  await shot(A, 'desktop-intercambio');
  await ev(A, `ctx.ui.closeAllModals()`);
  await setDevice(B, 'desktop');
  await tab(B, 'amigas');
  await shot(B, 'desktop-amigas-bea');
} catch (e) {
  fail++;
  console.log('EXCEPCIÓN', e);
} finally {
  await browser.close();
  server.close();
}
const errs = [...new Set(errors)];
if (errs.length) console.log('\n=== ERRORES DE PÁGINA ===\n' + errs.join('\n'));
if (SHOTS) console.log('\nCapturas en', OUT);
console.log(`\n${fail || errs.length ? '✘' : '✔'} ${pass} OK, ${fail} fallas, ${errs.length} errores de página`);
process.exit(fail || errs.length ? 1 : 0);
