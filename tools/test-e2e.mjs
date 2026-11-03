// Partida de punta a punta como jugadora nueva (sin cheat) en iPhone, con la interfaz real:
// splash → premio diario → misiones m1–m8 (construir, cobrar, minijuego, vestidor) → subida de nivel con cofre
// → abrir cofre con figuritas → minijuego con potenciador → premio → Pase → Álbum → Cofres (gratis, mochila,
// poción, martillo) → Eventos. Revisa que los globitos del HUD coincidan con los módulos en cada paso.
// El tiempo se acelera editando timestamps (obras, producción, cofre gratis), nunca con ?cheat.
//
//   node tools/test-e2e.mjs [--out carpeta-de-capturas] [--device iphone|desktop] [--no-shots]
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = resolve(opt('out', join(tmpdir(), 'pixelia-e2e')));
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
const page = await browser.newPage();
await page.setViewport(VIEW);
if (VIEW.hasTouch) await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');

const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });

let okN = 0, failN = 0;
const ok = (cond, msg, extra) => { if (cond) { okN++; console.log('  ✔ ' + msg); } else { failN++; console.log('  ✘ ' + msg + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } return !!cond; };
const section = (t) => console.log('\n■ ' + t);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let shotN = 0;
async function shot(name) {
  if (!SHOTS) return;
  const f = join(OUT, `${String(++shotN).padStart(2, '0')}-${DEVICE}-${name}.png`);
  await page.screenshot({ path: f });
  console.log('    📷 ' + f);
}
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const P = `window.__pixelia`;
const run = (code) => page.evaluate(`(async () => { const px = ${P}; const { ctx, store, economy: E, quests: Q, chests: C, album: A, season: SE, events: EV } = px; ${code} })()`);

async function waitFor(code, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await page.evaluate(code)) return true; } catch {}
    await sleep(120);
  }
  return false;
}
/** Toca (touch o click real) el primer elemento visible que matchea el selector y, opcional, el texto. */
async function tap(sel, text = null, { timeout = 5000 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const r = await page.evaluate((sel, text) => {
      const re = text ? new RegExp(text, 'i') : null;
      const els = [...document.querySelectorAll(sel)].filter(e => {
        const b = e.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) return false;
        const cs = getComputedStyle(e);
        if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false;
        return !re || re.test(e.textContent);
      });
      const e = els.at(-1) && els.length > 1 && sel.includes('.modal') ? els.at(-1) : els[0];
      if (!e) return null;
      document.querySelectorAll('[data-e2e]').forEach(x => x.removeAttribute('data-e2e'));
      e.setAttribute('data-e2e', '1');
      e.scrollIntoView({ block: 'center', inline: 'center' });
      return true;
    }, sel, text);
    if (r) {
      // esperar a que deje de moverse (scroll suave, animaciones de entrada) y que el punto caiga sobre el elemento
      let pos = null;
      for (let k = 0; k < 20; k++) {
        await sleep(90);
        const p = await page.evaluate(() => {
          const e = document.querySelector('[data-e2e]'); if (!e) return null;
          const b = e.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2;
          const hit = document.elementFromPoint(x, y);
          return { x, y, hit: !!hit && (e === hit || e.contains(hit) || hit.contains(e)) };
        });
        if (!p) break;
        if (pos && Math.abs(pos.x - p.x) < 0.5 && Math.abs(pos.y - p.y) < 0.5 && p.hit) { pos = p; break; }
        pos = p;
      }
      if (!pos) { await sleep(150); continue; }
      const r2 = pos;
      if (VIEW.hasTouch) await page.touchscreen.tap(r2.x, r2.y); else await page.mouse.click(r2.x, r2.y);
      return true;
    }
    if (false) {
      if (VIEW.hasTouch) await page.touchscreen.tap(r.x, r.y); else await page.mouse.click(r.x, r.y);
      return true;
    }
    await sleep(150);
  }
  console.log(`    (no encontré ${sel}${text ? ' «' + text + '»' : ''})`);
  return false;
}
async function tapXY(x, y) { if (VIEW.hasTouch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); }
const hasModal = () => ev(() => !!document.querySelector('.modal-back, .modal'));

/** Globitos del HUD vs. lo que dicen los módulos. */
async function checkBadges(label) {
  await sleep(250);
  await ev(() => window.__pixelia.ctx.hud.refreshBadges());
  const r = await ev(() => {
    const { chests: C, album: A, season: SE, quests: Q, ctx } = window.__pixelia;
    const dom = (k) => { const el = document.querySelector(`[data-badge="${k}"]`); return !el || el.style.display === 'none' ? 0 : (el.textContent === '99+' ? 100 : +el.textContent); };
    const want = { chests: C.chestBadge(), album: A.albumBadge(), pass: SE.seasonBadge(), quests: Q.claimableCount(), social: ctx.social?.socialBadge?.() || 0 };
    const got = Object.fromEntries(Object.keys(want).map(k => [k, dom(k)]));
    return { want, got };
  });
  const bad = Object.keys(r.want).filter(k => Math.min(100, r.want[k]) !== r.got[k]);
  ok(!bad.length, `globitos del HUD correctos (${label}): ${JSON.stringify(r.got)}`, bad.length ? r : undefined);
  return r.got;
}
/** Termina todas las obras y mejoras (acelera el tiempo). */
const finishWorks = () => run(`const now = Date.now(); for (const b of store.state.city.buildings) { if (b.buildEnd > now) b.buildEnd = now - 1; if (b.upgradeEnd > now) b.upgradeEnd = now - 1; } store.markDirty(); E.tick(); return true;`);
/** Adelanta la producción de todos los edificios h horas. */
const ageProduction = (hours) => run(`for (const b of store.state.city.buildings) b.lastCollect -= ${hours} * 3600e3; store.markDirty(); E.tick(); return true;`);

/** Resuelve lo que esté encima: subidas de nivel (abriendo cofres), aperturas de cofre, premios. Devuelve lo que vio. */
async function drainOverlays({ maxRounds = 40, shots = {} } = {}) {
  const seen = [];
  for (let i = 0; i < maxRounds; i++) {
    await sleep(350);
    const st = await ev(() => ({
      chx: !!document.querySelector('.chx-open'),
      sum: !!document.querySelector('.chx-sum .btn'),
      fan: !!document.querySelector('.chx-open .chx-stk, .chx-open [class*="stk"]'),
      lvl: !!document.querySelector('.modal.pnl-levelup'),
      login: !!document.querySelector('.modal.pnl-login'),
      welcome: !!document.querySelector('.modal[class*="welcome"]'),
      reward: !!document.querySelector('.modal.reward-modal'),
      modal: !!document.querySelector('.modal'),
    }));
    if (st.chx) {
      if (!seen.includes('chest')) { seen.push('chest'); await sleep(900); if (shots.chest) await shot(shots.chest); }
      if (st.sum) {
        if (!seen.includes('summary')) { seen.push('summary'); if (shots.summary) await shot(shots.summary); }
        await tap('.chx-sum .btn');
      } else {
        await tapXY(VIEW.width / 2, VIEW.height / 2);
        await sleep(700);
        if (shots.cards && !seen.includes('cards')) {
          const fan = await ev(() => /Figuritas/i.test(document.querySelector('.chx-open')?.textContent || ''));
          if (fan) { seen.push('cards'); await shot(shots.cards); }
        }
      }
      continue;
    }
    if (st.lvl) {
      if (!seen.includes('levelup')) { seen.push('levelup'); await sleep(900); if (shots.levelup) await shot(shots.levelup); }
      if (!(await tap('.modal.pnl-levelup .modal-foot .btn', 'Abrir ahora', { timeout: 300 }))) await tap('.modal.pnl-levelup .modal-foot .btn:last-child');
      continue;
    }
    if (st.login) { seen.push('login'); if (!(await tap('.modal.pnl-login .modal-foot .btn', 'Abrir', { timeout: 300 }))) await tap('.modal.pnl-login .modal-foot .btn'); continue; }
    if (st.welcome) { seen.push('welcome'); await tap('.modal[class*="welcome"] .modal-foot .btn:last-child'); continue; }
    if (st.reward) { seen.push('reward'); await tap('.modal.reward-modal .modal-foot .btn:last-child'); continue; }
    break;
  }
  return seen;
}
async function closeTop() {
  for (let i = 0; i < 4 && await hasModal(); i++) {
    if (!(await tap('.modal .modal-x', null, { timeout: 400 }))) await page.keyboard.press('Escape');
    await sleep(350);
  }
}
/** Construye con la interfaz: Construir → pestaña → tarjeta → Colocar (n veces si se pinta) → Listo. */
async function buildUI(id, n = 1) {
  const info = await run(`const d = E.def('${id}'); const cat = ctx.data.CATEGORIES?.find(c => c.id === d.cat); return { name: d.name, cat: cat?.name || d.cat };`);
  await tap('[data-act="build"]');
  await waitFor(`!!document.querySelector('.cx-build .cx-grid')`);
  await sleep(300);
  if (!(await ev((name) => [...document.querySelectorAll('.cx-build .cx-card .nm')].some(e => e.textContent === name), info.name))) await tap('.cx-build .cx-tabs .tab', info.cat);
  await sleep(250);
  if (!(await tap('.cx-build .cx-card .nm', '^' + info.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'))) { await shot('fallo-construir-' + id); await closeTop(); return false; }
  if (!(await waitFor(`!!document.querySelector('.cx-pb-btns')`, 3000))) { await shot('fallo-colocar-' + id); await closeTop(); return false; }
  const before = await run(`return E.countOf('${id}')`);
  for (let i = 0; i < n; i++) { await tap('.cx-pb-btns .btn.mint'); await sleep(350); }
  if (await ev(() => !!document.querySelector('.cx-pb-btns'))) { await tap('.cx-pb-btns .btn:first-child'); await sleep(300); }
  return (await run(`return E.countOf('${id}')`)) - before;
}
async function claimMainUI() {
  const q = await run(`const m = Q.mainQuest(); return m ? { id: m.id, done: m.done } : null;`);
  if (!q?.done) return null;
  await tap('.hud-quest');
  await waitFor(`!!document.querySelector('.modal.pnl-quests')`);
  await sleep(400);
  await tap('.modal.pnl-quests .btn.gold', 'Cobrar');
  await sleep(900);
  await closeTop();
  return q.id;
}
const mainId = () => run(`return Q.mainQuest()?.id || null`);

try {
  // ===================================================================
  section('Arranque como jugadora nueva');
  await page.goto(BASE + '?nosw&reset', { waitUntil: 'load' });
  await page.evaluate(() => history.replaceState(null, '', location.pathname + '?nosw'));
  ok(await waitFor(`document.getElementById('splash')?.classList.contains('ready')`, 6000), 'splash listo para tocar');
  await sleep(600);
  await shot('splash');
  await tapXY(VIEW.width / 2, VIEW.height * 0.7);
  ok(await waitFor(`!!document.querySelector('.modal.pnl-login')`, 9000), 'aparece el premio diario al llegar a la ciudad');
  ok(await run(`return !Q.mainQuest() ? false : Q.mainQuest().id === 'm1' && store.state.player.level === 1`), 'nivel 1 y misión m1');
  await sleep(700);
  await shot('premio-diario');
  await tap('.modal.pnl-login .modal-foot .btn');
  await sleep(1200);
  ok(await run(`return Q.loginStatus() === null`), 'premio diario cobrado');
  await tap('.modal.pnl-login .modal-foot .btn', null, { timeout: 800 });
  await sleep(500);
  await drainOverlays();
  ok(!(await hasModal()), 'sin modales después del premio diario');
  await shot('ciudad-inicio');
  await checkBadges('inicio');

  // ===================================================================
  section('Misiones m1–m4: construir y cobrar');
  ok(await buildUI('casita') === 1, 'm1: Casita Rosa colocada con Construir → tarjeta → Colocar');
  await shot('obra-casita');
  await finishWorks();
  await sleep(500);
  ok(await claimMainUI() === 'm1', 'm1 cobrada desde Misiones');
  await drainOverlays({ shots: { levelup: 'subida-nivel' } });
  ok(await buildUI('panaderia') === 1, 'm2: Panadería Dulce colocada');
  await finishWorks();
  ok(await claimMainUI() === 'm2', 'm2 cobrada');
  await drainOverlays({ shots: { levelup: 'subida-nivel', chest: 'cofre-apertura', cards: 'cofre-figuritas', summary: 'cofre-botin' } });
  // m3: cobrar 60 monedas tocando la burbuja
  await ageProduction(1);
  await sleep(1200);
  const bubble = await ev(() => { const e = [...document.querySelectorAll('.cx-bubble, [class*="bubble"]')].find(x => x.getBoundingClientRect().width > 4); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  if (bubble) { await tapXY(bubble.x, bubble.y); await sleep(800); }
  ok(!!bubble, 'hay burbuja de cobro en la panadería');
  await shot('cobrar');
  for (let i = 0; i < 3 && (await mainId()) === 'm3' && !(await run(`return Q.mainQuest().done`)); i++) {
    await ageProduction(1);
    await run(`for (const b of store.state.city.buildings) E.collect(b.uid); return true;`);
  }
  ok(await claimMainUI() === 'm3', 'm3 (cobrar 60) cobrada');
  await drainOverlays({ shots: { levelup: 'subida-nivel-2', chest: 'cofre-apertura', cards: 'cofre-figuritas', summary: 'cofre-botin' } });
  ok(await buildUI('joyeria') === 1, 'm4: Joyería Mágica colocada');
  await finishWorks();
  ok(await claimMainUI() === 'm4', 'm4 cobrada');
  await drainOverlays({ shots: { levelup: 'subida-nivel-3', chest: 'cofre-apertura', cards: 'cofre-figuritas', summary: 'cofre-botin' } });
  await checkBadges('después de m4');
  const st1 = await run(`return { level: store.state.player.level, coins: store.state.coins, chestsOpened: store.state.stats.chestsOpened || 0, stickers: A.albumProgress?.() }`);
  console.log('    estado:', JSON.stringify(st1));

  // ===================================================================
  section('m5: minijuego (Joyas Reales) desde Juegos');
  await tap('[data-act="games"]');
  ok(await waitFor(`!!document.querySelector('.modal.pnl-games')`), 'panel Juegos abierto');
  await sleep(600);
  await shot('juegos');
  await tap('.modal .btn.pink', 'Jugar');
  ok(await waitFor(`!!document.querySelector('.scene-match3 .m3-play')`, 9000), 'tarjeta previa de Joyas Reales');
  await sleep(500);
  await shot('match3-tarjeta');
  await tap('.m3-play');
  ok(await waitFor(`window.__pixelia.ctx.router.current === 'match3' && document.querySelector('.scene-match3')?.__m3?.mode === 'play'`, 6000), 'partida empezada');
  await sleep(1500);
  await ev(() => document.querySelector('.scene-match3').__m3.finishNow(true));
  ok(await waitFor(`!!document.querySelector('.modal.reward-modal')`, 15000), 'modal de premio al ganar');
  await sleep(1000);
  await shot('premio-minijuego');
  const prize = await ev(() => document.querySelector('.modal.reward-modal')?.innerText.replace(/\s+/g, ' ').slice(0, 300));
  ok(/chispas/i.test(prize || ''), 'el premio muestra las chispas del Pase', prize);
  await tap('.modal.reward-modal .modal-foot .btn', 'Ciudad|Volver');
  ok(await waitFor(`window.__pixelia.ctx.router.current === 'city'`, 6000), 'vuelve a la ciudad');
  await sleep(800);
  await drainOverlays({ shots: { levelup: 'subida-nivel-4' } });
  ok(await claimMainUI() === 'm5', 'm5 cobrada (trae Cofre de Madera)');
  await drainOverlays();
  await checkBadges('después de m5 (cofre en inventario)');

  // ===================================================================
  section('m6–m8: árboles, población, vestidor');
  const placed = await buildUI('arbol', 3);
  ok(placed >= 3, `m6: ${placed} árboles pintados`);
  await finishWorks();
  ok(await claimMainUI() === 'm6', 'm6 cobrada');
  await drainOverlays();
  // m7: 15 de población: casitas hasta llegar (con monedas propias, cobrando producción)
  for (let i = 0; i < 6 && !(await run(`return Q.mainQuest()?.id !== 'm7' || Q.mainQuest().done`)); i++) {
    await ageProduction(2);
    await run(`for (const b of store.state.city.buildings) E.collect(b.uid); return true;`);
    const can = await run(`return E.canBuild('casita').ok`);
    if (can) { await buildUI('casita'); await finishWorks(); }
    await drainOverlays();
  }
  ok(await claimMainUI() === 'm7', 'm7 (15 de población) cobrada');
  await drainOverlays({ shots: { levelup: 'subida-nivel-5' } });
  await tap('[data-act="wardrobe"]');
  ok(await waitFor(`window.__pixelia.ctx.router.current === 'wardrobe'`, 8000), 'Vestidor abierto');
  await sleep(1500);
  await shot('vestidor');
  // cambiar algo: el primer swatch o ítem que no esté seleccionado
  const look0 = await run(`return JSON.stringify(store.state.princess)`);
  await tap('.scene-wardrobe .wd-list [data-id]', 'Tuyo');
  await sleep(600);
  const changed = (await run(`return JSON.stringify(store.state.princess)`)) !== look0;
  ok(changed, 'cambió el look en el vestidor');
  await tap('.scene-wardrobe .wd-back');
  await waitFor(`window.__pixelia.ctx.router.current === 'city'`, 6000);
  await sleep(800);
  await drainOverlays();
  ok(await claimMainUI() === 'm8', 'm8 cobrada');
  await drainOverlays({ shots: { levelup: 'subida-nivel-6' } });
  await checkBadges('después de m8');

  // ===================================================================
  section('Cofres: gratis, abrir, mochila, poción y martillo');
  await run(`store.state.chests.freeBase = Date.now() - 4 * 3600e3 - 5000; store.markDirty(); ctx.bus.emit('chests:changed'); return true;`);
  await checkBadges('cofre gratis listo');
  await tap('[data-act="chests"]');
  ok(await waitFor(`!!document.querySelector('.chx-free')`), 'panel de Cofres abierto');
  await sleep(600);
  await shot('cofres');
  const nBefore = await run(`return store.state.stats.chestsOpened || 0`);
  await tap('.chx-free .btn');
  await sleep(600);
  await drainOverlays({ shots: { chest: 'cofre-apertura-2', cards: 'cofre-figuritas-2', summary: 'cofre-botin-2' } });
  ok((await run(`return store.state.stats.chestsOpened || 0`)) === nBefore + 1, 'cofre gratis reclamado y abierto');
  await tap('.modal .chx-actions .btn.pink, .modal .btn.pink', 'Abrir');
  await drainOverlays({ shots: { chest: 'cofre-apertura-2', cards: 'cofre-figuritas-2', summary: 'cofre-botin-2' } });
  // objetos de la mochila (si los cofres no trajeron poción/martillo, se agregan para probar el flujo)
  await run(`const it = store.state.chests.items; if (!it.potion_prod) it.potion_prod = 1; if (!it.hammer) it.hammer = 1; if (!it.m3_moves) it.m3_moves = 1; store.markDirty(); ctx.bus.emit('chests:changed'); return true;`);
  await tap('.modal [data-tab="mochila"]');
  await sleep(600);
  await shot('mochila');
  await ev(() => { const it = [...document.querySelectorAll('.modal .chx-item')].find(e => /Poción Dorada/.test(e.textContent)); it?.querySelector('.btn')?.setAttribute('data-potion', '1'); });
  const usedPotion = await tap('.modal [data-potion]', null, { timeout: 1500 }) || await run(`return C.useCityItem('potion_prod').ok`);
  await sleep(800);
  await drainOverlays();
  ok(await run(`return C.prodBoostMult() === 2`), 'poción de producción activa (x2)', usedPotion);
  await closeTop();
  await sleep(600);
  ok(await ev(() => !!document.querySelector('.hud-fx .fx-chip.gold')), 'chip de poción x2 con tiempo en el HUD');
  // martillo: empezar una obra y terminarla desde la ficha
  await ageProduction(3);
  await run(`for (const b of store.state.city.buildings) E.collect(b.uid); return true;`);
  await buildUI('casita');
  const busyUid = await run(`const now = Date.now(); return store.state.city.buildings.find(b => b.buildEnd > now)?.uid ?? null`);
  if (busyUid != null) {
    const hammers = await run(`return C.itemCount('hammer')`);

    const opened = await ev((uid) => { const c = window.__pixelia.city; const e = c.entries.get(uid); if (!e) return false; const v = e.root.position.clone(); v.y += 0.4; v.project(c.r.camera); const b = document.querySelector('.scene-city').getBoundingClientRect(); return { x: b.left + (v.x + 1) / 2 * b.width, y: b.top + (1 - v.y) / 2 * b.height }; }, busyUid).catch(() => null);
    if (opened) await tapXY(opened.x, opened.y);
    await sleep(800);
    const viaUI = await tap('.modal .btn.gold', 'Martillo', { timeout: 1500 });
    if (!viaUI) await run(`C.useCityItem('hammer', { uid: ${busyUid} }); E.tick(); return true;`);
    await sleep(600);
    ok((await run(`return C.itemCount('hammer')`)) === hammers - 1 && (await run(`return !(store.state.city.buildings.find(b => b.uid === ${busyUid})?.buildEnd > Date.now())`)), `martillo terminó la obra (${viaUI ? 'desde la ficha' : 'por API'})`);
    await closeTop();
    await drainOverlays();
  }
  await checkBadges('después de cofres');

  // ===================================================================
  section('Minijuego con potenciador (+5 movidas)');
  await run(`ctx.router.openGame('match3'); return true;`);
  ok(await waitFor(`!!document.querySelector('.scene-match3 .pxb-slot')`, 9000), 'tarjeta con potenciadores');
  await sleep(500);
  await tap('.scene-match3 .pxb-slot:not(.empty)');
  await sleep(300);
  await shot('match3-potenciador');
  const moves0 = await ev(() => document.querySelector('.scene-match3 .pxb-slot.on') ? 1 : 0);
  ok(moves0 === 1, 'potenciador seleccionado');
  await tap('.m3-play');
  await waitFor(`document.querySelector('.scene-match3')?.__m3?.mode === 'play'`, 6000);
  await sleep(1800);
  ok(await ev(() => document.querySelector('.scene-match3').__m3.boosts.includes('m3_moves')), 'el potenciador se aplicó y se consumió');
  await shot('match3-jugando');
  await ev(() => document.querySelector('.scene-match3').__m3.finishNow(true));
  await waitFor(`!!document.querySelector('.modal.reward-modal')`, 15000);
  await sleep(900);
  await shot('premio-minijuego-2');
  await tap('.modal.reward-modal .modal-foot .btn', 'Ciudad|Volver');
  await waitFor(`window.__pixelia.ctx.router.current === 'city'`, 6000);
  await sleep(800);
  await drainOverlays();
  await checkBadges('después del segundo minijuego');

  // ===================================================================
  section('Pase de Temporada, Álbum y Eventos');
  await run(`SE.addSeasonPoints(400, 'test'); return true;`);
  await checkBadges('niveles del pase para cobrar');
  await tap('[data-act="pass"]');
  ok(await waitFor(`!!document.querySelector('.modal')`, 5000), 'Pase abierto');
  await sleep(900);
  await shot('pase');
  const tiers = await run(`return SE.claimableTiers().length`);
  if (tiers) { await tap('.modal .btn', 'Cobrar', { timeout: 1500 }); await sleep(900); await drainOverlays(); }
  ok((await run(`return SE.claimableTiers().length`)) < tiers || !tiers, 'se cobró un nivel del pase desde la UI', tiers);
  await closeTop();
  await drainOverlays();
  await checkBadges('después del pase');
  await tap('[data-act="album"]');
  ok(await waitFor(`!!document.querySelector('.modal, .alb-open, [class*="alb-"]')`, 5000), 'Álbum abierto');
  await sleep(900);
  await shot('album');
  await closeTop();
  await sleep(400);
  await drainOverlays();
  await checkBadges('después del álbum');
  await tap('[data-act="events"]');
  ok(await waitFor(`!!document.querySelector('.modal')`, 5000), 'Eventos abierto');
  await sleep(800);
  await shot('eventos');
  await closeTop();
  await tap('[data-act="social"]');
  await sleep(1200);
  await shot('amigas-offline');
  await closeTop();
  await sleep(400);
  await shot('ciudad-final');
  await checkBadges('final');
  const fin = await run(`return { level: store.state.player.level, main: Q.mainQuest()?.id, coins: store.state.coins, gems: store.state.gems, chests: C.chestCount(), stickers: Object.keys(store.state.album?.have || {}).length, season: SE.seasonInfo().level }`);
  console.log('    final:', JSON.stringify(fin));
  ok(fin.main === 'm9' || +String(fin.main).slice(1) > 8, 'misiones m1–m8 completas');
} catch (e) {
  failN++;
  console.log('EXCEPCIÓN', e.stack || e);
  await shot('excepcion').catch(() => {});
}

await browser.close();
server.close();
if (errors.length) console.log('\n=== ERRORES DE PÁGINA ===\n' + [...new Set(errors)].join('\n'));
console.log(`\n${failN || errors.length ? '✘' : '✔'} ${okN} OK, ${failN} fallas, ${new Set(errors).size} errores de página`);
process.exit(failN || errors.length ? 1 : 0);
