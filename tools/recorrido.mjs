// Recorrido completo como jugador nuevo a 1920x1080 (pedido de la noche): logo, cinemática, personaje, clase, nombre,
// llegada con Vera, ciudad, primera expedición guiada, primer combate, la bestia y el faro (adelantados), Bitácora y
// una noche con un eco. Deja las capturas en shots/recorrido/ (el informe está en docs/RECORRIDO-NOCHE.md).
// No es parte de npm test: es para mirar el juego como lo ve alguien que recién llega.
//
//   node tools/recorrido.mjs [--out carpeta]
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = resolve(opt('out', join(ROOT, 'shots', 'recorrido')));
const SHOTS = !opt('no-shots', false);
const DEVICE = opt('device', 'full');
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
  full: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
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
  const f = join(OUT, `${String(++shotN).padStart(2, '0')}-${name}.png`);
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
      // si algo lo tapa (las pestañas fijas mientras el panel todavía se desplaza solo) se vuelve a centrar y se reintenta
      if (!pos || !pos.hit) { await sleep(150); continue; }
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
    const dom = (k) => { const el = document.querySelector(`[data-badge="${k}"]`); return !el || el.style.display === 'none' ? 0 : (el.textContent === '99+' ? 100 : el.textContent === '!' ? 1 : +el.textContent); };
    // el HUD muestra como mucho 4 globitos, por prioridad (hud.js BADGE_ORDER); los que se ven tienen que coincidir
    const st = ctx.hud.badgeState();
    const raw = { chests: C.chestBadge(), album: A.albumBadge(), pass: SE.seasonBadge(), quests: Q.claimableCount() };
    const want = st.shown;
    const got = Object.fromEntries(Object.keys(want).map(k => [k, dom(k)]));
    const visible = Object.values(got).filter(n => n > 0).length;
    const srcOk = Object.keys(raw).every(k => !want[k] || want[k] === raw[k]);
    return { want, got, visible, srcOk, raw };
  });
  const bad = Object.keys(r.want).filter(k => Math.min(100, r.want[k]) !== r.got[k]);
  ok(!bad.length && r.visible <= 4 && r.srcOk, `globitos del HUD correctos, ${r.visible} a la vista (${label}): ${JSON.stringify(r.got)}`, bad.length || !r.srcOk ? r : undefined);
  return r.got;
}
/** Termina todas las obras y mejoras (acelera el tiempo). */
const finishWorks = () => run(`const now = Date.now(); for (const b of store.state.city.buildings) { if (b.buildEnd > now) b.buildEnd = now - 1; if (b.upgradeEnd > now) b.upgradeEnd = now - 1; } store.markDirty(); E.tick(); return true;`);
/** Adelanta la producción de todos los edificios h horas. */
const ageProduction = (hours) => run(`for (const b of store.state.city.buildings) b.lastCollect -= ${hours} * 3600e3; store.markDirty(); E.tick(); return true;`);

/** Resuelve lo que esté encima: subidas de nivel (abriendo cofres), aperturas de cofre, premios. Devuelve lo que vio. */
/** Cierra las hojas de diálogo de la historia (contactos de la cartógrafa) que estén abiertas. */
async function closeStory() {
  for (let i = 0; i < 10; i++) {
    const open = await ev(() => !!document.querySelector('.st-card:not(.out):not(.bark)') || !!document.querySelector('.st-epic'));
    if (!open) return;
    await ev(() => { const sk = document.querySelector('.st-epic .st-skip') || document.querySelector('.st-card:not(.out):not(.bark) .st-skip') || document.querySelector('.st-card:not(.out):not(.bark) .st-next'); sk?.click(); });
    await sleep(300);
  }
}
async function drainOverlays({ maxRounds = 40, shots = {} } = {}) {
  const seen = []; let quiet = 0;
  for (let i = 0; i < maxRounds; i++) {
    await sleep(350);
    if (await ev(() => !!document.querySelector('.st-card:not(.out):not(.bark), .st-epic'))) { seen.push('story'); await closeStory(); quiet = 0; continue; }
    const st = await ev(() => ({
      chx: !!document.querySelector('.chx-open'),
      sum: !!document.querySelector('.chx-sum .btn'),
      fan: !!document.querySelector('.chx-open .chx-stk, .chx-open [class*="stk"]'),
      lvl: !!document.querySelector('.modal.pnl-levelup'),
      login: !!document.querySelector('.modal.pnl-login, .modal.arrival-modal'),
      welcome: !!document.querySelector('.modal[class*="welcome"]'),
      reward: !!document.querySelector('.modal.reward-modal'),
      modal: !!document.querySelector('.modal'),
    }));
    if (st.chx || st.lvl || st.login || st.welcome || st.reward) quiet = 0;
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
    if (st.login) { seen.push('login'); if (!(await tap('.modal.pnl-login .modal-foot .btn', 'Abrir', { timeout: 300 }))) await tap('.modal.pnl-login .modal-foot .btn, .modal.arrival-modal .modal-foot .btn'); continue; }
    if (st.welcome) { seen.push('welcome'); await tap('.modal[class*="welcome"] .modal-foot .btn:last-child'); continue; }
    if (st.reward) { seen.push('reward'); await tap('.modal.reward-modal .modal-foot .btn:last-child'); continue; }
    if (++quiet >= 4) break;
  }
  return seen;
}
async function closeTop() {
  for (let i = 0; i < 4 && await hasModal(); i++) {
    if (process.env.E2E_DEBUG) console.log('    modales:', await ev(() => [...document.querySelectorAll('.modal')].map(m => m.className + ' x:' + !!m.querySelector('.modal-x')).join(' | ')));
    if (await ev(() => !!document.querySelector('.modal.reward-modal, .chx-open'))) { await drainOverlays(); continue; }
    if (!(await tap('.modal .modal-x', null, { timeout: 400 }))) await page.keyboard.press('Escape');
    await sleep(350);
  }
}
/** Construye con la interfaz: Construir → pestaña → tarjeta → ✓ junto al edificio (n veces si se pinta) → Listo. */
async function buildUI(id, n = 1) {
  await drainOverlays();
  const info = await run(`const d = E.def('${id}'); const cat = ctx.data.CATEGORIES?.find(c => c.id === d.cat); return { name: d.name, cat: cat?.name || d.cat };`);
  await tap('[data-act="build"]');
  await waitFor(`!!document.querySelector('.cx-build .cx-grid')`);
  await sleep(300);
  if (!(await ev((name) => [...document.querySelectorAll('.cx-build .cx-card .nm')].some(e => e.textContent === name), info.name))) await tap('.cx-build .cx-tabs .tab', info.cat);
  await sleep(250);
  const cardRe = '^' + info.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
  if (!(await tap('.cx-build .cx-card .nm', cardRe))) { await shot('fallo-construir-' + id); await closeTop(); return false; }
  let placing = await waitFor(`!!document.querySelector('.cx-pc .cx-pc-ok')`, 3000);
  // con la máquina cargada el toque puede quedar en marcar la tarjeta sin arrancar la colocación: si el panel sigue, otro toque
  if (!placing && await ev(() => !!document.querySelector('.cx-build .cx-grid'))) {
    await tap('.cx-build .cx-card .nm', cardRe);
    placing = await waitFor(`!!document.querySelector('.cx-pc .cx-pc-ok')`, 6000);
  }
  if (!placing) { await shot('fallo-colocar-' + id); await closeTop(); return false; }
  const before = await run(`return E.countOf('${id}')`);
  // cada toque en Colocar espera a que el edificio aparezca (con la máquina cargada la ciudad tarda en reubicar la pieza)
  const diag = [];
  const snap = () => ev((id) => {
    const b = document.querySelector('.cx-pc .cx-pc-ok');
    const r = b?.getBoundingClientRect();
    const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
    const E = window.__pixelia.economy;
    return {
      n: E.countOf(id), coins: window.__pixelia.store.state.coins, can: E.canBuild(id),
      bar: !!b, disabled: b?.disabled, hint: document.querySelector('.cx-pb-hint')?.textContent,
      hit: hit ? hit.tagName + '.' + hit.className : null, modals: [...document.querySelectorAll('.modal')].map(m => m.className),
      toasts: [...document.querySelectorAll('.toast, [class*="toast"]')].map(t => t.textContent.trim()).filter(Boolean),
    };
  }, id);
  for (let i = 0; i < n; i++) {
    diag.push(await snap());
    await tap('.cx-pc .cx-pc-ok');
    await waitFor(`window.__pixelia.economy.countOf('${id}') >= ${before + i + 1}`, 2500);
    await sleep(200);
  }
  diag.push(await snap());
  if (diag.at(-1).n < before + n) { console.log('    diag buildUI ' + id + ':\n      ' + diag.map(d => JSON.stringify(d)).join('\n      ')); await shot('fallo-pintar-' + id); }
  if (await ev(() => !!document.querySelector('.cx-placebar'))) { await tap(await ev(() => document.querySelector('.cx-pb-done')?.offsetParent ? '.cx-pb-done' : '.cx-pc .cx-pc-x')); await sleep(300); }
  // una subida de nivel ganada mientras se colocaba sale recién al terminar de colocar
  await drainOverlays();
  return (await run(`return E.countOf('${id}')`)) - before;
}
/**
 * Cobra la misión principal con la interfaz. Devuelve su id solo si de verdad se cobró (la principal avanzó):
 * antes devolvía el id aunque el toque en "Cobrar" cayera sobre una subida de nivel que apareció encima, y desde ahí
 * todas las misiones quedaban corridas una (e2e intermitente en "m4 cobrada").
 */
/** Anota en la página cada misión cobrada (también las del cobro automático de t1–t20, El Quiebre §E4). */
const installClaimLog = () => run(`if (!window.__claimLog) { window.__claimLog = []; window.__claimRead = 0; ctx.bus.on('quest:claimed', (e) => window.__claimLog.push(e.id)); } return true;`);
const isTutorial = (id) => (/^t\d+$/.test(id) && Number(id.slice(1)) <= 20) || id === 'q_combate';   // AUTO_CLAIM (story-data.js)
async function claimMainUI() {
  await installClaimLog();
  // t1–t20 se cobran solas al cumplirse: se toma la próxima cobrada que la prueba todavía no contó
  const nextAuto = async () => run(`if (window.__claimRead < window.__claimLog.length) return window.__claimLog[window.__claimRead++]; return null;`);
  let id = await nextAuto();
  if (!id) {
    const cur = await run(`const m = Q.mainQuest(); return m ? { id: m.id, done: m.done } : null;`);
    if (cur && isTutorial(cur.id) && cur.done) { await waitFor(`window.__claimLog.length > window.__claimRead`, 7000); id = await nextAuto(); }
  }
  if (id) { await drainOverlays(); return id; }
  const q = await run(`const m = Q.mainQuest(); return m ? { id: m.id, done: m.done, index: m.index } : null;`);
  if (!q?.done) {
    if (q) console.log('    (la misión ' + q.id + ' todavía no está cumplida: ' + JSON.stringify(await run(`return Q.mainQuest()`)) + ')');
    return null;
  }
  const advanced = `!!window.__pixelia.store.state.quests.done?.['${q.id}']`;
  for (let attempt = 0; attempt < 3; attempt++) {
    await drainOverlays();
    await closeTop();
    await tap('.hud-quest');
    if (!(await waitFor(`!!document.querySelector('.modal.pnl-quests')`, 4000))) continue;
    await sleep(400);
    await tap('.modal.pnl-quests .btn.gold', 'Cobrar', { timeout: 3000 });
    const ok = await waitFor(advanced, 2500);
    await sleep(500);
    await closeTop();
    if (ok) return q.id;
    console.log(`    (reintento cobrar ${q.id}: ${attempt + 1})`);
  }
  return null;
}
const mainId = () => run(`return Q.mainQuest()?.id || null`);
// ---------- recorrido ----------
const XP = (fn, ...a) => page.evaluate((src, a) => { const e = document.querySelector('.scene-expedition')?.__exp; return e ? new Function('e', 'a', 'return (' + src + ')(e, a)')(e, a) : null; }, fn.toString(), a);
const CB = (fn, ...a) => page.evaluate((src, a) => { const c = document.querySelector('.scene-combat')?.__combat; return c ? new Function('c', 'a', 'return (' + src + ')(c, a)')(c, a) : null; }, fn.toString(), a);
const expIdle = () => waitFor(`(() => { const e = document.querySelector('.scene-expedition')?.__exp; return e && !e.busy; })()`, 15000);
const cbIdle = () => waitFor(`(() => { const c = document.querySelector('.scene-combat')?.__combat; return c && !c.busy; })()`, 40000);
const RUN = (body) => page.evaluate(`(async () => { const { store, ctx, bus, economy: E, quests: Q } = window.__pixelia; const ST = ctx.story;
  const A = await import('/src/story/act1.js'); const EC = await import('/src/story/echoes.js'); const X = await import('/src/expedition/expedition.js');
  const SD = await import('/src/story/story-data.js'); ${body} })()`);
const placeNow = (id) => RUN(`
  const { min, max } = E.landBounds();
  for (let x = min; x < max; x++) for (let z = min; z < max; z++) if (E.canPlace('${id}', x, z, 0).ok) {
    const r = E.placeBuilding('${id}', x, z, 0); if (r?.error) return r.error;
    const now = Date.now(); for (const b of store.state.city.buildings) if (b.buildEnd > now) b.buildEnd = now - 1; E.tick(); return true; }
  return 'sin lugar';`);
const goCity = async (q = '') => { await page.goto(`${BASE}?nosplash&nosw${q}`, { waitUntil: 'load' }); return waitFor(`window.__pixelia?.ctx.router.current === 'city'`, 30000); };
const notes = [];
const note = (t) => { notes.push(t); console.log('    📝 ' + t); };
/** Juega los turnos de un combate en curso atacando al más cercano (como test-combat-exp). */
async function playFight(maxRounds = 12, boost = 0) {
  if (boost) await CB((c, a) => { for (const u of c.raw().units) if (u.side === 'ally') u.atk += a[0]; }, boost);
  let guard = 0;
  while (!(await CB(c => c.raw().ended)) && guard++ < maxRounds) {
    for (let k = 0; k < 8; k++) {
      const plan = await CB(c => {
        const R = c.rules, b = c.raw();
        const al = b.units.filter(u => u.alive && !u.safe && u.side === 'ally' && !u.acted && !(u.captive && !u.freed));
        const foes = b.units.filter(u => u.alive && u.side === 'enemy');
        if (!al.length || !foes.length) return null;
        const u = al[0];
        const atk = R.abilitiesOf(b, u.id).find(a => a.def.kind === 'attack' && a.ready);
        if (!atk) return { id: u.id, skip: true };
        const now = R.targets(b, u.id, atk.id);
        if (now.length) return { id: u.id, act: atk.id, x: now[0].x, y: now[0].y };
        if (u.moved) return { id: u.id, skip: true };
        let best = null;
        for (const t of R.reachable(b, u.id)) {
          const tg = R.targets(b, u.id, atk.id, t.x, t.y);
          const d = Math.min(...foes.map(e => Math.abs(e.x - t.x) + Math.abs(e.y - t.y)));
          const score = (tg.length ? 100 : 0) - d;
          if (!best || score > best.score) best = { score, x: t.x, y: t.y };
        }
        return best && (best.x !== u.x || best.y !== u.y) ? { id: u.id, move: [best.x, best.y] } : { id: u.id, skip: true };
      });
      if (!plan) break;
      if (plan.skip) { await CB((c, a) => { c.raw().units.find(u => u.id === a[0]).acted = true; }, plan.id); continue; }
      await CB((c, a) => c.select(a[0]), plan.id);
      if (plan.move) { await CB((c, a) => c.click(a[0], a[1]), ...plan.move); await cbIdle(); k--; continue; }
      await CB((c, a) => { c.ability(a[0]); c.click(a[1], a[2]); }, plan.act, plan.x, plan.y);
      await cbIdle();
      if (await CB(c => c.raw().ended)) break;
    }
    if (await CB(c => c.raw().ended)) break;
    await CB(c => c.endTurn(true));
    await cbIdle();
  }
  return CB(c => c.rules.result(c.raw()));
}
/** Pasa por la hoja o la épica de la historia que esté abierta, sacando una captura de la primera línea. */
async function storyShot(name, wait = 1400) { await sleep(wait); await shot(name); }

try {
  // ===================================================================
  section('1. Logo, splash y cinemática');
  await page.goto(BASE + '?nosw&reset&studiohold', { waitUntil: 'load' });
  await sleep(1800);
  await shot('logo');
  await page.mouse.click(VIEW.width / 2, VIEW.height / 2);
  await page.evaluate(() => history.replaceState(null, '', location.pathname + '?nosw'));
  ok(await waitFor(`document.getElementById('splash')?.classList.contains('ready')`, 15000), 'splash listo');
  await sleep(700);
  await shot('splash');
  await tapXY(VIEW.width / 2, VIEW.height * 0.7);
  ok(await waitFor(`window.__pixelia?.ctx.router.current === 'intro' && !!document.querySelector('.scene-intro .in-skip')`, 15000), 'cinemática');
  await sleep(3500);
  await shot('intro-1-continente');
  for (const [i, t, n] of [[1, 5, 'intro-2-torres'], [2, 5, 'intro-3-robo'], [3, 4.5, 'intro-4-grieta'], [4, 5.5, 'intro-5-subida'], [5, 8, 'intro-6-fragmento']]) {
    await ev((a) => { window.__pixelia.intro.go(a[0]); window.__pixelia.intro.seek(a[1]); }, [i, t]);
    await sleep(1500);
    await shot(n);
  }
  await page.keyboard.press('Escape');

  // ===================================================================
  section('2. Personaje, clase y nombre');
  ok(await waitFor(`window.__pixelia.ctx.router.current === 'onboarding' && !!document.querySelector('.scene-onboarding .ob-type')`, 12000), 'onboarding');
  await sleep(1200);
  await shot('personaje');
  const t2 = await ev(() => document.querySelector('.scene-onboarding .ob-type:not(.on)')?.dataset.type || null);
  if (t2) { await tap(`.scene-onboarding .ob-type[data-type="${t2}"]`); await sleep(800); await shot('personaje-otro-pueblo'); }
  await tap('.scene-onboarding .ob-next');
  ok(await waitFor(`document.querySelectorAll('.scene-onboarding .cls-card').length === 6`, 5000), 'clases');
  await sleep(900);
  await shot('clase');
  await tap('.scene-onboarding .cls-card[data-cls="cazador"]');
  await sleep(700);
  await shot('clase-cazador');
  await tap('.scene-onboarding .ob-next');
  ok(await waitFor(`!!document.querySelector('.scene-onboarding [data-f=name]')`, 5000), 'nombre');
  await tap('.scene-onboarding [data-f=name]');
  await page.keyboard.type('Irene', { delay: 30 });
  await tap('.scene-onboarding [data-f=city]');
  await page.keyboard.type('Paso Viejo', { delay: 30 });
  await sleep(500);
  await shot('nombre');
  await tap('.scene-onboarding .ob-next');

  // ===================================================================
  section('3. Llegada con Vera');
  ok(await waitFor(`!!document.querySelector('.st-epic')`, 15000), 'llegada');
  await storyShot('llegada-1', 2500);
  for (let i = 2; i <= 4; i++) {
    await page.mouse.click(VIEW.width / 2, VIEW.height / 2); await sleep(150);
    await page.mouse.click(VIEW.width / 2, VIEW.height / 2);
    await storyShot('llegada-' + i, 2200);
  }
  for (let i = 0; i < 6 && await ev(() => !!document.querySelector('.st-epic')); i++) { await page.mouse.click(VIEW.width / 2, VIEW.height / 2); await sleep(500); }
  ok(await waitFor(`!!document.querySelector('.modal.tp-modal .tp-card')`, 9000), 'estilo de la ciudad');
  await sleep(900);
  await shot('estilo-ciudad');
  await tap('.modal.tp-modal .modal-foot .btn');
  ok(await waitFor(`!!document.querySelector('.st-card[data-scene="c_ciudad"]')`, 9000), 'Vera presenta la ciudad');
  await sleep(1800);
  await shot('ciudad-vera');
  await closeStory();
  await drainOverlays();
  await sleep(800);
  await shot('ciudad-inicio');

  // ===================================================================
  section('4. Primeros pasos en la ciudad (t1–t4)');
  await installClaimLog();
  await tap('[data-act="build"]');
  await waitFor(`!!document.querySelector('.cx-build .cx-grid')`);
  await sleep(700);
  await shot('construir');
  await closeTop();
  ok(await buildUI('casita') === 1, 't1 casa');
  await shot('casa-en-obra');
  await finishWorks(); await sleep(600); await claimMainUI();
  await drainOverlays({ shots: { levelup: 'subida-nivel' } });
  ok(await buildUI('huerta') === 1, 't2 huerta');
  await finishWorks(); await claimMainUI();
  await drainOverlays({ shots: { chest: 'cofre' } });
  await sleep(1200);
  const bubble = await ev(() => { const e = [...document.querySelectorAll('.cx-bubble')].find(x => x.getBoundingClientRect().width > 4); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await shot('huerta-globito');
  if (bubble) { await tapXY(bubble.x, bubble.y); await sleep(900); }
  if (!(await run(`return Q.mainQuest().done`))) await run(`for (const b of store.state.city.buildings) E.collect(b.uid); return true;`);
  await claimMainUI(); await drainOverlays();
  ok(await buildUI('casa_exp') === 1, 't4 casa de expediciones');
  await finishWorks(); await claimMainUI(); await drainOverlays();
  await sleep(1500);
  await drainOverlays();
  await shot('ciudad-con-casa-exp');

  // ===================================================================
  section('5. Primera expedición guiada (t5)');
  await tap('[data-act="expedition"]');
  ok(await waitFor(`!!document.querySelector('.modal.pnl-ex [data-ex-go="corta"]:not(:disabled)')`, 6000), 'panel de expedición');
  await sleep(700);
  await shot('expedicion-panel');
  await tap('.modal.pnl-ex [data-ex-go="corta"]');
  ok(await waitFor(`!!document.querySelector('.scene-expedition')?.__exp?.view`, 30000), 'salida corta');
  await sleep(2500);
  await shot('expedicion-guia-1');
  const guides = [];
  for (let i = 0; i < 7; i++) {
    const g = await XP(e => e.guide?.text || '');
    if (g && !guides.includes(g)) guides.push(g);
    if (await ev(() => !!document.querySelector('.ex-guide [data-a="ok"]'))) { await tap('.ex-guide [data-a="ok"]'); await sleep(400); }
    const chip = await ev(() => { const c = [...document.querySelectorAll('.scene-expedition .ex-chip')].find(b => !b.classList.contains('hidden') && b.getBoundingClientRect().width > 4); if (!c) return null; const b = c.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    if (!chip) break;
    await tapXY(chip.x, chip.y);
    await expIdle(); await sleep(600);
    if (await ev(() => !!document.querySelector('.scene-expedition .ex-card.in'))) {
      await sleep(600); await shot('expedicion-tarjeta-' + i);
      await tap('.scene-expedition .ex-opt:not(:disabled)'); await sleep(600); await expIdle();
    }
    if (i === 1 || i === 3) { await sleep(800); await shot('expedicion-paso-' + i); }
  }
  console.log('    pistas vistas:', JSON.stringify(guides));
  await tap('.scene-expedition .ex-home');
  await sleep(700);
  await shot('expedicion-volver');
  if (await ev(() => !!document.querySelector('.scene-expedition [data-a="go"]'))) await tap('.scene-expedition [data-a="go"]');
  ok(await waitFor(`!!document.querySelector('.scene-expedition [data-a="city"]')`, 20000), 'resultado');
  await sleep(1200);
  await shot('expedicion-resultado');
  await tap('.scene-expedition [data-a="city"]');
  await waitFor(`window.__pixelia.ctx.router.current === 'city'`, 12000);
  await sleep(1200);
  await claimMainUI();
  await drainOverlays({ shots: { levelup: 'subida-nivel-2' } });
  await sleep(1000);
  await shot('ciudad-mision-pelea');

  // ===================================================================
  section('6. Primer combate (salida normal al Bosque)');
  await run(`store.state.prov = Math.max(store.state.prov, 30); return true;`);
  await tap('[data-act="expedition"]');
  ok(await waitFor(`!!document.querySelector('.modal.pnl-ex [data-ex-go="normal"]')`, 6000), 'panel');
  await sleep(600);
  await shot('expedicion-panel-normal');
  await tap('.modal.pnl-ex [data-ex-go="normal"]');
  ok(await waitFor(`!!document.querySelector('.scene-expedition')?.__exp?.view`, 30000), 'salida normal');
  await sleep(1500);
  const tgt = await XP(e => { const r = e.raw(); const i = r.cells.findIndex(c => c.guided); return i < 0 ? null : [i % r.w, (i / r.w) | 0]; });
  ok(!!tgt, 'hay pelea guiada', tgt);
  if (tgt) {
    await XP((e, a) => {
      const run = e.raw(), [x, y] = a; const ty = y + (y < run.h - 1 ? 1 : -1);
      let cx = run.base[0], cy = run.base[1]; const mark = () => { const c = run.cells[cy * run.w + cx]; c.visited = c.seen = true; };
      while (cx !== x) { cx += Math.sign(x - cx); mark(); } while (cy !== ty) { cy += Math.sign(ty - cy); mark(); }
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = run.cells[(y + dy) * run.w + x + dx]; if (c) c.seen = true; }
      const nb = run.cells[ty * run.w + x]; if (nb.content !== 'vacio') { nb.content = 'vacio'; nb.sub = null; nb.done = true; }
      run.pos = [x, ty];
    }, ...tgt);
    await ev(() => window.__pixelia.store.save());
    await ev(() => window.__pixelia.ctx.router.go('expedition', { resume: true }));
    await waitFor(`!!document.querySelector('.scene-expedition')?.__exp?.view`, 20000);
    await sleep(1500); await expIdle();
    await shot('combate-casilla');
    await XP((e, a) => e.move(a[0], a[1]), ...tgt);
    ok(await waitFor(`!!document.querySelector('.scene-expedition .ex-card.in')`, 8000), 'tarjeta del enemigo');
    await sleep(800);
    await shot('combate-tarjeta');
    await XP(e => e.choose(0));
    ok(await waitFor(`window.__pixelia.ctx.router.current === 'combat' && !!document.querySelector('.scene-combat')?.__combat?.view`, 30000), 'combate');
    await sleep(3000);
    await shot('combate-entrada');
    const lead = await CB(c => { const u = c.raw().units.find(x => x.type === 'lider'); const r = c.rules.reachable(c.raw(), u.id).filter(t => t.x !== u.x || t.y !== u.y); return { id: u.id, to: r[0] }; });
    await CB((c, a) => c.select(a[0]), lead.id);
    await sleep(700);
    await shot('combate-seleccion');
    await CB((c, a) => c.click(a[0], a[1]), lead.to.x, lead.to.y);
    await cbIdle(); await sleep(900);
    await shot('combate-guia-actuar');
    await CB(c => c.endTurn(true)); await cbIdle(); await sleep(1200);
    await shot('combate-turno-enemigo');
    const res = await playFight(14, 0);
    ok(res?.outcome === 'win', 'primer combate ganado', res);
    if (res?.outcome !== 'win') note(`El primer combate guiado se perdió jugando simple (atacar al más cercano): ${JSON.stringify(res)}`);
    await page.waitForSelector('.cb-result', { timeout: 10000 }).catch(() => {});
    await sleep(1200);
    await shot('combate-resultado');
    await ev(() => document.querySelector('.cb-result [data-a="go"]')?.click());
    await waitFor(`window.__pixelia.ctx.router.current === 'expedition'`, 15000);
    await sleep(1800);
    await shot('combate-vuelta-expedicion');
    await tap('.scene-expedition .ex-home'); await sleep(600);
    if (await ev(() => !!document.querySelector('.scene-expedition [data-a="go"]'))) await tap('.scene-expedition [data-a="go"]');
    await waitFor(`!!document.querySelector('.scene-expedition [data-a="city"]')`, 20000);
    await sleep(1000);
    await tap('.scene-expedition [data-a="city"]');
    await waitFor(`window.__pixelia.ctx.router.current === 'city'`, 12000);
    await sleep(1500);
    await shot('ciudad-despues-pelea');
    await drainOverlays();
  }

  // ===================================================================
  section('7. La bestia del Bañado (adelantado)');
  await RUN(`const s = store.state; const c = s.city.buildings.find(b => b.id === 'castillo'); if (c) c.level = 5; s.prov = 80; store.save(); return true;`);
  await page.goto(`${BASE}?scene=combat&enc=banado_bestia&seed=3&level=5&element=raiz&nosplash&nosw`, { waitUntil: 'load' });
  ok(await waitFor(`!!document.querySelector('.scene-combat')?.__combat?.view`, 30000), 'pelea con la bestia');
  await sleep(3500);
  await shot('bestia-pelea');
  const lb = await CB(c => { const u = c.raw().units.find(x => x.side === 'ally'); return u?.id; });
  if (lb) { await CB((c, a) => c.select(a[0]), lb); await sleep(700); await shot('bestia-seleccion'); }
  await goCity('');
  await RUN(`store.save = () => {}; return true;`);
  await drainOverlays();
  await RUN(`X.creditFight({ region: 'banado', party: ['cazador', 'forjador', 'curandero'], mods: { escort: [] } }, { enc: 'banado_bestia', outcome: 'win', turns: 8, stars: 2, xp: 80, page: 'p9', flag: 'bestia_vencida' }); return true;`);
  ok(await waitFor(`!!document.querySelector('.st-epic')`, 15000), 'escena de la bestia vencida');
  await storyShot('bestia-vencida', 2500);
  await closeStory(); await drainOverlays();

  // ===================================================================
  section('8. El faro viejo (adelantado)');
  const faro = await RUN(`const s = store.state; const c = s.city.buildings.find(b => b.id === 'castillo'); if (c) c.level = 6; s.prov = 80;
    if (!s.city.buildings.some(b => b.id === 'casa_exp')) return 'sin casa';
    const r = X.startExpedition({ region: 'costa', kind: 'normal' }); if (r.error) return r.error;
    localStorage.setItem(store.SAVE_KEY || 'pixelia.save.v1', JSON.stringify(s));
    return { name: r.run.objective.name, faro: r.run.objective.faro };`);
  console.log('    faro:', JSON.stringify(faro));
  await page.goto(`${BASE}?scene=expedition&nosplash&nosw`, { waitUntil: 'load' });
  ok(await waitFor(`!!document.querySelector('.scene-expedition')?.__exp?.view`, 30000), 'expedición a la Costa');
  await sleep(2500);
  await shot('faro-expedicion');
  await goCity('');
  await RUN(`store.save = () => {}; return true;`);
  await drainOverlays();
  await RUN(`const s = store.state; const run = s.expedition.active; if (!run) return false; run.objectiveDone = true; run.objective.done = true; run.ended = true; run.reason = 'volvio'; X.finishExpedition(run); s.expedition.active = null; return true;`);
  ok(await waitFor(`!!document.querySelector('.st-epic')`, 15000), 'escena del faro');
  await storyShot('faro-encendido', 2500);
  await closeStory(); await drainOverlays();

  // ===================================================================
  section('9. Bitácora');
  await run(`ctx.openPanel('story'); return true;`);
  await sleep(1200);
  await shot('bitacora-historia');
  for (const t of ['progreso', 'diario', 'manual']) {
    await tap(`.pnl-story .pnl-tabs [data-tab="${t}"]`);
    await sleep(1000);
    await shot('bitacora-' + t);
  }
  await closeTop();

  // ===================================================================
  section('10. Una noche con un eco');
  await RUN(`const s = store.state; s.story.chapter = 'cerro'; s.story.echoes = {}; localStorage.setItem(store.SAVE_KEY || 'pixelia.save.v1', JSON.stringify(s)); return s.story.chapter;`);
  ok(await goCity('&hour=22'), 'ciudad de noche');
  await RUN(`store.save = () => {}; return true;`);
  await drainOverlays();
  await sleep(1500);
  await shot('noche-ciudad');
  const hasEcho = await waitFor(`!!window.__pixelia.city?.act1?.echo`, 8000);
  ok(hasEcho, 'aparece un eco');
  ok(await waitFor(`!!document.querySelector('.ec-mark')`, 4000), 'la primera vez, una marca señala el eco');
  await sleep(600);
  await shot('noche-eco-marca');
  if (hasEcho) {
    await RUN(`const p = window.__pixelia.city.act1.echo.pos; window.__pixelia.city.cam.flyTo(p.x, p.z, 26); return true;`);
    await sleep(3000);
    await shot('noche-eco');
    const sp = await RUN(`const c = window.__pixelia.city; const p = c.act1.echo.pos.clone(); p.y = 0.45; return c.ov.project(p, {});`);
    await page.mouse.click(sp.x, sp.y);
    ok(await waitFor(`!!document.querySelector('.ec-modal')`, 6000), 'línea del eco');
    ok(!(await page.evaluate(() => !!document.querySelector('.ec-mark'))), 'la marca se va al tocar el eco');
    await sleep(900);
    await shot('noche-eco-linea');
  }

  section('Sin errores');
  ok(errors.length === 0, 'sin errores de consola', errors.slice(0, 6));
} catch (e) {
  failN++;
  console.error('EXCEPCIÓN', e);
  try { await shot('excepcion'); } catch {}
} finally {
  console.log(`\n${okN} ok · ${failN} fallas`);
  if (notes.length) console.log('Notas:\n- ' + notes.join('\n- '));
  await browser.close();
  server.close();
}
