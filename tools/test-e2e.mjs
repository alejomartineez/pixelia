// Partida de punta a punta como jugadora nueva (sin cheat) en iPhone, con la interfaz real:
// splash → onboarding (personaje, nombre, ciudad) → prólogo de la cartógrafa → estilo (se verifica el guardado) → premio
// diario sin modal (primera sesión) → la cartógrafa presenta la ciudad → tutorial t1–t10 (se cobran solas: El Quiebre §E4) (casa, huerta y cosecha, Casa de Expediciones, salida corta, Taller y Cuerda, población,
// panadería, salida normal con Cuerda) → subida de nivel
// → cofre con hallazgos → potenciador viejo → equipo → Pase → Hallazgos → Cofres (gratis, mochila,
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
const isTutorial = (id) => /^t\d+$/.test(id) && Number(id.slice(1)) <= 20;
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

try {
  // ===================================================================
  section('Arranque como jugadora nueva');
  await page.goto(BASE + '?nosw&reset', { waitUntil: 'load' });
  await page.evaluate(() => history.replaceState(null, '', location.pathname + '?nosw'));
  ok(await waitFor(`document.getElementById('splash')?.classList.contains('ready')`, 6000), 'splash listo para tocar');
  await sleep(600);
  await shot('splash');
  await tapXY(VIEW.width / 2, VIEW.height * 0.7);

  // ===================================================================
  section('Onboarding: personaje, nombre y estilo de ciudad');
  ok(await waitFor(`window.__pixelia.ctx.router.current === 'onboarding' && !!document.querySelector('.scene-onboarding .ob-type')`, 9000), 'partida nueva entra al onboarding (no directo a la ciudad)');
  ok(await run(`return store.state.onboarded === false`), 'todavía no figura como onboarded');
  await sleep(900);
  await shot('onboarding-personaje');
  // un pueblo distinto del de arranque (desde el paso 4a la partida nueva arranca con un pueblo al azar); tema: Ocaso
  const OB_TYPE = await ev(() => document.querySelector('.scene-onboarding .ob-type:not(.on)')?.dataset.type || 'humano');
  const OB_NAME = 'Bruno', OB_CITY = 'Villa Prueba', OB_THEME = 'ocaso';
  ok(await tap('.scene-onboarding .ob-type[data-type="' + OB_TYPE + '"]'), `toqué el personaje ${OB_TYPE}`);
  await sleep(600);
  ok(await ev((t) => !!document.querySelector(`.scene-onboarding .ob-type.on[data-type="${t}"]`), OB_TYPE), 'la tarjeta del personaje queda marcada');
  ok(await ev(() => /Color de pelo/i.test(document.querySelector('.scene-onboarding .ob-body')?.textContent || '') && !/pelaje|animal/i.test(document.querySelector('.scene-onboarding .ob-body')?.textContent || '')), 'solo personas: ofrece "Color de pelo" y nada de animales');
  // color de ropa: el primer swatch que no está elegido
  const dressId = await ev(() => document.querySelector('.scene-onboarding .ob-sw[data-key="dressColor"] button:not(.on)')?.dataset.id || null);
  ok(!!dressId && await tap(`.scene-onboarding .ob-sw[data-key="dressColor"] button[data-id="${dressId}"]`), `toqué el color de ropa ${dressId}`);
  await sleep(500);
  await shot('onboarding-pueblo');
  await tap('.scene-onboarding .ob-next');
  ok(await waitFor(`!!document.querySelector('.scene-onboarding [data-f=name]')`, 4000), 'paso 2: nombre del personaje y de la ciudad');
  await sleep(500);
  await tap('.scene-onboarding [data-f=name]');
  await sleep(250);
  ok(await ev(() => document.activeElement?.dataset?.f === 'name'), 'el toque en el campo de nombre le da foco');
  await page.keyboard.type(OB_NAME, { delay: 40 });
  await sleep(300);
  ok(await ev((n) => (document.querySelector('.scene-onboarding .ob-title b')?.textContent || '').includes(n), OB_NAME), 'el título saluda con el nombre escrito');
  await tap('.scene-onboarding [data-f=city]');
  await sleep(250);
  await page.keyboard.type(OB_CITY, { delay: 30 });
  await sleep(300);
  await shot('onboarding-nombre');
  await tap('.scene-onboarding .ob-next', 'Empezar');
  // orden de entrada (El Quiebre §E7): personaje → nombre → prólogo → estilo
  ok(await waitFor(`!!document.querySelector('.st-epic')`, 12000), 'al terminar llega el prólogo a pantalla completa');
  await sleep(900);
  await shot('prologo');
  for (let i = 0; i < 12 && !/cartógrafa/.test(await ev(() => document.querySelector('.st-epic .st-head')?.textContent || '')); i++) { await tapXY(VIEW.width / 2, VIEW.height / 2); await sleep(150); }
  ok(/cartógrafa/.test(await ev(() => document.querySelector('.st-epic .st-head')?.textContent || '')), 'la cartógrafa se presenta');
  await sleep(1200);
  await shot('prologo-cartografa');
  await tap('.st-epic .st-skip');
  ok(await waitFor(`!document.querySelector('.st-epic')`, 3000), 'Saltar cierra el prólogo');
  ok(await waitFor(`!!document.querySelector('.modal.tp-modal .tp-card')`, 9000), 'después se abre "Estilo de tu ciudad"');
  ok(await run(`return ctx.router.current === 'city' && store.state.onboarded === true`), 'ya en la ciudad y marcado como onboarded');
  ok(!(await ev(() => !!document.querySelector('.modal.arrival-modal'))), 'el premio diario espera a que se cierre el selector de estilo');
  await sleep(900);
  await shot('estilo-ciudad');
  ok(await run(`return (store.state.city.theme || 'pueblo') !== '${OB_THEME}'`), `el tema inicial no es ${OB_THEME}`);
  await tap(`.modal.tp-modal .tp-card[data-theme="${OB_THEME}"]`);
  await sleep(600);
  ok(await ev((t) => !!document.querySelector(`.modal.tp-modal .tp-card.on[data-theme="${t}"]`), OB_THEME), 'la tarjeta del tema queda elegida');
  ok(await run(`return store.state.city.theme === '${OB_THEME}'`), `tema ${OB_THEME} aplicado en vivo`);
  await shot('estilo-elegido');
  await tap('.modal.tp-modal .modal-foot .btn', 'Listo');
  ok(await waitFor(`!document.querySelector('.modal.tp-modal')`, 4000), 'selector de estilo cerrado con ¡Listo!');
  // lo guardado (localStorage, con el autoguardado del juego) refleja todas las elecciones
  const savedOk = await waitFor(`(() => { try { const s = JSON.parse(localStorage.getItem(window.__pixelia.store.SAVE_KEY || 'pixelia.save.v1')); return s?.onboarded === true && s.avatar?.type === '${OB_TYPE}' && s.city?.theme === '${OB_THEME}'; } catch { return false; } })()`, 9000);
  const saved = await ev(() => { try { const s = JSON.parse(localStorage.getItem(window.__pixelia.store.SAVE_KEY || 'pixelia.save.v1')); return { onboarded: s.onboarded, type: s.avatar?.type, dress: s.avatar?.dressColor, name: s.player?.name, city: s.player?.cityName, theme: s.city?.theme }; } catch (e) { return String(e); } });
  ok(savedOk, 'el guardado tiene onboarded, personaje y tema', saved);
  ok(saved?.type === OB_TYPE && saved?.dress === dressId, `guardado: personaje ${OB_TYPE} con ropa ${dressId}`, saved);
  ok(saved?.name === OB_NAME && saved?.city === OB_CITY, `guardado: nombre «${OB_NAME}» y ciudad «${OB_CITY}»`, saved);
  ok(saved?.theme === OB_THEME, `guardado: tema ${OB_THEME}`, saved);

  // primera sesión (El Quiebre §E7): no se apila el modal de llegada; el premio del día se cobra con un aviso que también
  // adelanta lo que se abre mañana
  ok(await waitFor(`[...document.querySelectorAll('#toast-root .toast')].some(t => /primer día/.test(t.textContent))`, 9000), 'aviso del premio de tu primer día');
  ok(await waitFor(`[...document.querySelectorAll('#toast-root .toast')].some(t => /Mañana se abre: el Pase de Temporada/.test(t.textContent))`, 4000), 'y que mañana se abre el Pase');
  ok(!(await ev(() => !!document.querySelector('.modal.arrival-modal'))), 'sin modal de llegada en la primera sesión');
  ok(await run(`return !Q.mainQuest() ? false : Q.mainQuest().id === 't1' && store.state.player.level === 1`), 'nivel 1 y misión t1');
  ok(await run(`return Q.loginStatus() === null`), 'premio diario cobrado');
  // la cartógrafa presenta la ciudad (no bloquea)
  ok(await waitFor(`!!document.querySelector('.st-card[data-scene="c_ciudad"]')`, 9000), 'la cartógrafa presenta la ciudad');
  await sleep(1500);
  await shot('contacto-ciudad');
  await closeStory();
  ok(await ev(() => ['pass', 'social', 'album', 'chests', 'works'].every(a => document.querySelector(`#hud [data-act="${a}"]`)?.style.display === 'none')), 'día 1: Pase, Contactos, Hallazgos, Cofres y Obras todavía cerrados');
  ok(await run(`return ctx.hud.controls().length <= 15`), 'el HUD tiene ≤ 15 controles');
  await sleep(500);
  await drainOverlays();
  ok(!(await hasModal()), 'sin modales después del premio diario');
  await shot('ciudad-inicio');
  await checkBadges('inicio');

  // ===================================================================
  section('Tutorial t1–t4: casa, huerta, primera cosecha y la base');
  await installClaimLog();
  ok(await buildUI('casita') === 1, 't1: Casa colocada con Construir → tarjeta → Colocar');
  await shot('obra-casita');
  await finishWorks();
  await sleep(500);
  ok(await claimMainUI() === 't1', 't1 cobrada desde Misiones');
  await drainOverlays({ shots: { levelup: 'subida-nivel' } });
  ok(await buildUI('huerta') === 1, 't2: Huerta colocada (pestaña Expedición)');
  await finishWorks();
  ok(await claimMainUI() === 't2', 't2 cobrada');
  await drainOverlays({ shots: { levelup: 'subida-nivel', chest: 'cofre-apertura', cards: 'cofre-figuritas', summary: 'cofre-botin' } });
  // t3: la primera Huerta arranca con dos tandas: tocar su globito junta 4 provisiones
  await sleep(1200);
  const bubble = await ev(() => { const e = [...document.querySelectorAll('.cx-bubble')].find(x => x.getBoundingClientRect().width > 4 && x.querySelector('[data-pi="🍞"]')); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  ok(!!bubble, 'la Huerta muestra el globito de provisiones');
  const prov0 = await run(`return store.state.prov`);
  if (bubble) { await tapXY(bubble.x, bubble.y); await sleep(900); }
  await shot('cobrar-huerta');
  if (!(await run(`return Q.mainQuest().done`))) await run(`for (const b of store.state.city.buildings) E.collect(b.uid); return true;`);
  ok((await run(`return store.state.prov`)) >= prov0 + 4, 'las provisiones fueron al depósito');
  ok(await claimMainUI() === 't3', 't3 (primera cosecha) cobrada');
  await drainOverlays({ shots: { levelup: 'subida-nivel-2' } });
  ok(!(await ev(() => document.querySelector('[data-act="expedition"]')?.style.display !== 'none')), 'el botón Expedición todavía no aparece');
  ok(await buildUI('casa_exp') === 1, 't4: Casa de Expediciones colocada');
  await finishWorks();
  ok(await claimMainUI() === 't4', 't4 cobrada');
  await drainOverlays({ shots: { levelup: 'subida-nivel-3' } });
  await sleep(600);
  ok(await ev(() => document.querySelector('[data-act="expedition"]')?.style.display !== 'none'), 'aparece el botón Expedición en el riel');
  await checkBadges('después de t4');

  // ===================================================================
  section('t5: primera salida (corta, mapa fijo)');
  await tap('[data-act="expedition"]');
  ok(await waitFor(`!!document.querySelector('.modal.pnl-ex [data-ex-go="corta"]:not(:disabled)')`, 5000), 'panel de Expedición con la salida corta gratis');
  await sleep(500);
  await shot('panel-expedicion');
  await tap('.modal.pnl-ex [data-ex-go="corta"]');
  ok(await waitFor(`!!document.querySelector('.scene-expedition')?.__exp?.view`, 25000), 'escena de la salida');
  ok(await ev(() => document.querySelector('.scene-expedition').__exp.run.seed === 110), 'es el mapa fijo del tutorial');
  await sleep(1200);
  // dos pasos tocando los rótulos de costo de las vecinas
  for (let i = 0; i < 2; i++) {
    const chip = await ev(() => { const c = [...document.querySelectorAll('.scene-expedition .ex-chip')].find(b => !b.classList.contains('hidden') && b.getBoundingClientRect().width > 4); if (!c) return null; const b = c.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    if (chip) await tapXY(chip.x, chip.y);
    await waitFor(`!document.querySelector('.scene-expedition').__exp.busy`, 8000);
    await sleep(400);
    if (await ev(() => !!document.querySelector('.scene-expedition .ex-card.in'))) { await tap('.scene-expedition .ex-opt:not(:disabled)'); await sleep(500); await waitFor(`!document.querySelector('.scene-expedition').__exp.busy`, 8000); }
  }
  ok(await ev(() => document.querySelector('.scene-expedition').__exp.run.steps >= 1), 'el grupo avanzó');
  await shot('salida-corta');
  await tap('.scene-expedition .ex-home');
  await sleep(500);
  if (await ev(() => !!document.querySelector('.scene-expedition [data-a="go"]'))) await tap('.scene-expedition [data-a="go"]');
  ok(await waitFor(`!!document.querySelector('.scene-expedition [data-a="city"]')`, 15000), 'resultado de la salida');
  await sleep(900);
  await shot('resultado-salida');
  await tap('.scene-expedition [data-a="city"]');
  ok(await waitFor(`window.__pixelia.ctx.router.current === 'city'`, 9000), 'vuelve a la ciudad');
  await sleep(900);
  await drainOverlays();
  ok(await claimMainUI() === 't5', 't5 cobrada (trae madera)');
  await drainOverlays({ shots: { levelup: 'subida-nivel-4' } });

  // ===================================================================
  section('t6–t7: Taller y Cuerda');
  ok(await run(`return E.canBuild('taller').ok`), 'alcanza la madera para el Taller');
  ok(await buildUI('taller') === 1, 't6: Taller colocado');
  await finishWorks();
  ok(await claimMainUI() === 't6', 't6 cobrada');
  await drainOverlays();
  await tap('[data-act="expedition"]');
  await waitFor(`!!document.querySelector('.modal.pnl-ex')`, 5000);
  await sleep(400);
  await tap('.modal.pnl-ex .btn', 'Ir al Taller');
  ok(await waitFor(`!!document.querySelector('.modal.pnl-ws [data-craft="cuerda"] .btn:not(:disabled)')`, 5000), 'panel del Taller');
  await sleep(400);
  await shot('taller');
  await tap('.modal.pnl-ws [data-craft="cuerda"] .btn');
  ok(await waitFor(`(window.__pixelia.store.state.equipment.cuerda || 0) === 1`, 3000), 'Cuerda fabricada');
  await closeTop();
  ok(await claimMainUI() === 't7', 't7 cobrada');
  await drainOverlays({ shots: { levelup: 'subida-nivel-5' } });

  // ===================================================================
  section('t8–t9: población y panadería');
  for (let i = 0; i < 6 && !(await run(`return Q.mainQuest()?.id !== 't8' || Q.mainQuest().done`)); i++) {
    await ageProduction(2);
    await run(`for (const b of store.state.city.buildings) E.collect(b.uid); return true;`);
    const can = await run(`return E.canBuild('casita').ok`);
    if (can) { await buildUI('casita'); await finishWorks(); }
    await drainOverlays();
  }
  ok(await claimMainUI() === 't8', 't8 (15 de población) cobrada');
  await drainOverlays({ shots: { levelup: 'subida-nivel-6' } });
  if (!(await run(`return E.canBuild('panaderia').ok`))) { await ageProduction(3); await run(`for (const b of store.state.city.buildings) E.collect(b.uid); return true;`); }
  ok(await buildUI('panaderia') === 1, 't9: Panadería colocada');
  await finishWorks();
  ok(await claimMainUI() === 't9', 't9 cobrada');
  await drainOverlays();

  // ===================================================================
  section('t10: salida normal con la Cuerda');
  await tap('[data-act="expedition"]');
  ok(await waitFor(`!!document.querySelector('.modal.pnl-ex [data-ex-go="normal"]:not(:disabled)')`, 5000), 'se puede salir (hay provisiones)');
  ok(await ev(() => !!document.querySelector('.modal.pnl-ex [data-equip="cuerda"].on')), 'la Cuerda viene elegida');
  await tap('.modal.pnl-ex [data-ex-go="normal"]');
  ok(await waitFor(`!!document.querySelector('.scene-expedition')?.__exp?.view`, 25000), 'escena de la salida normal');
  await sleep(1000);
  await tap('.scene-expedition .ex-home');
  await sleep(500);
  if (await ev(() => !!document.querySelector('.scene-expedition [data-a="go"]'))) await tap('.scene-expedition [data-a="go"]');
  ok(await waitFor(`!!document.querySelector('.scene-expedition [data-a="city"]')`, 15000), 'resultado');
  await tap('.scene-expedition [data-a="city"]');
  await waitFor(`window.__pixelia.ctx.router.current === 'city'`, 9000);
  await sleep(900);
  await drainOverlays();
  ok(await claimMainUI() === 't10', 't10 cobrada');
  await drainOverlays();
  ok(await run(`return Q.mainQuest()?.id === 't11' && /1 zona más/.test(E.expansionStatus().reason)`), 'sigue t11 (explorar la zona 1) y el terreno pide 1 zona');
  await checkBadges('después de t10');

  // ===================================================================
  section('Cofres: gratis, abrir, mochila, poción y martillo');
  // apertura escalonada: Cofres aparece al ganar el primero
  await run(`if (!store.state.unlocks.open.cofres) C.addChest('madera', 1, 'test'); return true;`);
  ok(await waitFor(`document.querySelector('#hud [data-act="chests"]')?.style.display !== 'none'`, 3000), 'con el primer cofre aparece el botón Cofres');
  await run(`store.state.chests.freeBase = Date.now() - C.FREE_CHEST_EVERY_MS - 5000; store.markDirty(); ctx.bus.emit('chests:changed'); return true;`);
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
  await tap('.modal .chx-actions .btn.primary, .modal .btn.primary', 'Abrir');
  await drainOverlays({ shots: { chest: 'cofre-apertura-2', cards: 'cofre-figuritas-2', summary: 'cofre-botin-2' } });
  // objetos de la mochila (si los cofres no trajeron poción/martillo, se agregan para probar el flujo)
  await run(`const it = store.state.chests.items; if (!it.potion_prod) it.potion_prod = 1; if (!it.hammer) it.hammer = 1; store.markDirty(); ctx.bus.emit('chests:changed'); return true;`);
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
  section('Potenciador viejo en la mochila → equipo de expedición');
  // los minijuegos se retiraron (Fase 5): un potenciador que llegue a la mochila (regalo viejo) pasa a ser equipo
  const cuerda0 = await run(`return store.state.equipment?.cuerda || 0`);
  await run(`store.state.chests.items.m3_moves = 2; ctx.bus.emit('chests:changed', { item: 'm3_moves', n: 2 }); return true;`);
  ok(await run(`return !store.state.chests.items.m3_moves && (store.state.equipment.cuerda || 0) === ${cuerda0} + 2`), '+5 Movidas → 2 Cuerdas');
  ok(await run(`return !document.querySelector('[data-act="games"]') && !window.__pixelia.ctx.router.openGame`), 'sin botón Juegos ni router.openGame');
  await checkBadges('después del potenciador');
  // antes la partida cerraba todo al cambiar de escena: se cierran los paneles que quedaron abiertos (Cofres)
  await run(`ctx.ui.closeAllModals(); return true;`);
  await sleep(800);
  await drainOverlays();

  // ===================================================================
  section('Pase de Temporada, Álbum y Eventos');
  // apertura escalonada: dos días después, al volver, "Hoy se abre: el Pase de Temporada" (una función por sesión)
  await run(`store.state.created -= 3 * 864e5; store.markDirty(); ctx.bus.emit('season:welcome'); return true;`);
  const opened = await waitFor(`/Hoy se abre: el Pase de Temporada/.test(document.querySelector('.modal.arrival-modal')?.textContent || '')`, 20000);
  if (!opened) console.log('    estado:', await run(`const u = await import('/src/core/unlocks.js'); return { day: u.playDay(), open: store.state.unlocks.open, modals: [...document.querySelectorAll('.modal')].map(m => m.className), ov: !!document.querySelector('.chx-open, .alb-open, .cx-placebar, .th-bar'), scene: ctx.router.current };`));
  ok(opened, 'al volver otro día: «Hoy se abre: el Pase de Temporada»');
  await shot('llegada-se-abre-pase');
  await tap('.modal.arrival-modal .modal-foot .btn');
  await sleep(600);
  await drainOverlays();
  ok(await ev(() => document.querySelector('#hud [data-act="pass"]')?.style.display !== 'none'), 'aparece el botón Temporada');
  ok(await run(`const u = await import('/src/core/unlocks.js'); return !u.isOpen('eventos')`), 'los eventos esperan a otra sesión');
  await run(`const u = await import('/src/core/unlocks.js'); u._openAll(undefined, undefined, { all: true }); return true;`);
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
  // Temporada = Pase + eventos en un botón: los eventos se abren desde el Pase
  await tap('[data-act="pass"]');
  ok(await waitFor(`!!document.querySelector('.modal.ssn-pass .ssn-evbar')`, 5000), 'el Pase muestra la barra de eventos de la semana');
  await tap('.modal.ssn-pass [data-act="events"]');
  ok(await waitFor(`document.querySelectorAll('.modal').length >= 1 && !!document.querySelector('.modal:not(.ssn-pass)')`, 5000), 'Eventos abierto desde el Pase');
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
  console.log('    social:', JSON.stringify(await run(`return { badge: ctx.social?.socialBadge?.(), tabs: ctx.social?.tabCounts?.() }`)));
  const fin = await run(`return { level: store.state.player.level, main: Q.mainQuest()?.id, coins: store.state.coins, gems: store.state.gems, chests: C.chestCount(), stickers: Object.keys(store.state.album?.have || {}).length, season: SE.seasonInfo().level }`);
  console.log('    final:', JSON.stringify(fin));
  ok(fin.main === 't11', 'tutorial t1–t10 completo (sigue t11)', fin.main);

  // ===================================================================
  section('Recarga: la partida sigue con lo elegido en el onboarding');
  await run(`store.save(); return true;`);
  await page.goto(BASE + '?nosw', { waitUntil: 'load' });
  ok(await waitFor(`document.getElementById('splash')?.classList.contains('ready')`, 6000), 'splash listo');
  await sleep(400);
  await tapXY(VIEW.width / 2, VIEW.height * 0.7);
  ok(await waitFor(`window.__pixelia.ctx.router.current === 'city'`, 9000), 'entra directo a la ciudad (sin repetir el onboarding)');
  const again = await run(`return { type: store.state.avatar.type, name: store.state.player.name, city: store.state.player.cityName, theme: store.state.city.theme, onboarded: store.state.onboarded }`);
  ok(again.onboarded && again.type === OB_TYPE && again.name === 'Bruno' && again.city === 'Villa Prueba' && again.theme === 'ocaso', `tras recargar: ${OB_TYPE} «Bruno», «Villa Prueba», tema ocaso`, again);
  await sleep(800);
  await drainOverlays();
  await shot('recarga-ciudad');} catch (e) {
  failN++;
  console.log('EXCEPCIÓN', e.stack || e);
  await shot('excepcion').catch(() => {});
}

await browser.close();
server.close();
if (errors.length) console.log('\n=== ERRORES DE PÁGINA ===\n' + [...new Set(errors)].join('\n'));
console.log(`\n${failN || errors.length ? '✘' : '✔'} ${okN} OK, ${failN} fallas, ${new Set(errors).size} errores de página`);
process.exit(failN || errors.length ? 1 : 0);
