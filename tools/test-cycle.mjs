// Ciclo ciudad ↔ expedición (Fase 2), con toques reales:
//   Casa de Expediciones → botón Expedición (globito) → panel → salida corta del tutorial (mapa fijo) → juntar madera y
//   explorar el objetivo → volver → el botín aparece en la ciudad → construir el Taller con esa madera → el panel muestra
//   Ingeniería 1 · 75% → mejorar el Taller → Ingeniería 2 · 80% → salida normal con Cuerda → zona 1 explorada → se puede
//   ampliar el terreno → salida a medias, recargar y retomar → eventos del contrato sin `prototype`.
//
//   node tools/test-cycle.mjs [--device iphone|desktop] [--out carpeta] [--no-shots]
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { generateMap, hashSeed } = await import(pathToFileURL(join(ROOT, 'src/expedition/exp-gen.js')).href);
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = resolve(opt('out', join(tmpdir(), 'pixelia-cycle')));
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

// partida fija: con `created` fijo la semilla de la salida normal (intento 2 del Bosque, después de la corta) es siempre la
// misma; se elige una con objetivo de lugar o aldea (con casilla) para que el bot sepa adónde ir.
let CREATED = 0;
for (let c = 1000; c < 3000; c++) {
  const m = generateMap({ region: 'bosque', zone: 1, kind: 'normal', seed: hashSeed('bosque', 1, 2, c, 'normal') });
  if (m.objective.type === 'lugar' && m.objective.cell) { CREATED = c; break; }
}

const page = await browser.newPage();
await page.setViewport(VIEW);
if (VIEW.hasTouch) await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });

async function waitFor(code, ms = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await page.evaluate(code)) return true; } catch {} await sleep(120); }
  return false;
}
const run = (body) => page.evaluate(new Function(`const { store, economy: E, quests: Q, ctx, bus } = window.__pixelia; ${body}`));
async function tapXY(x, y) { if (VIEW.hasTouch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); }
// abre el panel de Expedición limpio: cierra lo que haya quedado abierto (con la máquina cargada un ✕ puede no
// llegar a cerrar y el panel viejo queda con el equipo de antes) y reintenta el toque hasta que el panel aparece
async function openExp(timeout = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    await page.evaluate(() => document.querySelectorAll('.modal .modal-x').forEach(b => b.click()));
    if (!(await waitFor(`!document.querySelector('.modal')`, 2500))) continue;
    await waitFor(`!!document.querySelector('[data-act="expedition"]')`, 4000);
    await tapSel('[data-act="expedition"]', null, 2000);
    if (await waitFor(`!!document.querySelector('.modal.pnl-ex [data-ex-go]')`, 3000)) return true;
  }
  return false;
}
async function tapSel(sel, text = null, timeout = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const where = () => page.evaluate((sel, text) => {
      const re = text ? new RegExp(text, 'i') : null;
      const e = [...document.querySelectorAll(sel)].find(e => { const b = e.getBoundingClientRect(); return b.width > 2 && b.height > 2 && !e.disabled && (!re || re.test(e.textContent)); });
      if (!e) return null;
      e.scrollIntoView({ block: 'center' });
      const b = e.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }, sel, text);
    const p = await where();
    // si el botón todavía se mueve (una tarjeta que entra animada) se espera a que quede quieto antes de tocarlo
    if (p) { await sleep(250); const q = await where(); if (q && Math.abs(q.x - p.x) < 1 && Math.abs(q.y - p.y) < 1) { await tapXY(q.x, q.y); return true; } continue; }
    await sleep(150);
  }
  console.log(`    (no encontré ${sel}${text ? ' «' + text + '»' : ''})`);
  return false;
}
let shotN = 0;
async function shot(name) {
  if (!SHOTS) return;
  const f = join(OUT, `${String(++shotN).padStart(2, '0')}-${DEVICE}-${name}.png`);
  await page.screenshot({ path: f });
  console.log('    📷 ' + f);
}
/** Cierra modales (premio diario, bienvenida, subidas de nivel, cofres). */
async function drain() {
  for (let i = 0; i < 12; i++) {
    const st = await page.evaluate(() => ({ any: !!document.querySelector('.modal'), reward: !!document.querySelector('.modal.reward-modal, .modal.pnl-login, .modal[class*="welcome"]'), x: !!document.querySelector('.modal .modal-x') }));
    if (!st.any) return;
    if (st.reward) { await tapSel('.modal .modal-foot .btn:last-child', null, 800); await sleep(500); continue; }
    if (st.x) { await tapSel('.modal .modal-x', null, 800); await sleep(400); continue; }
    await page.keyboard.press('Escape'); await sleep(400);
  }
}
const exp = () => page.evaluate(() => { const e = document.querySelector('.scene-expedition')?.__exp; if (!e) return null; const r = e.run; return r && { busy: e.busy, card: e.card, modal: e.modal, run: r, view: e.view }; });
const idle = () => waitFor(`(() => { const e = document.querySelector('.scene-expedition')?.__exp; return e && !e.busy; })()`, 15000);

/** Camino más barato (Dijkstra por costo de terreno; los peligros pesan más) de `from` a `to` sobre el run completo. */
function plan(r, from, to) {
  const cost = { llano: 1, bosque: 1, colina: 2, pantano: 2, roca: 3 };
  const key = (x, y) => y * r.w + x;
  const dist = new Map([[key(...from), 0]]), prev = new Map(), open = [[0, from[0], from[1]]];
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [d, x, y] = open.shift();
    if (x === to[0] && y === to[1]) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= r.w || ny >= r.h) continue;
      const c = r.cells[key(nx, ny)];
      const nd = d + cost[c.terrain] + (c.content === 'peligro' && !c.done ? 6 : 0);
      if (nd < (dist.get(key(nx, ny)) ?? Infinity)) { dist.set(key(nx, ny), nd); prev.set(key(nx, ny), [x, y]); open.push([nd, nx, ny]); }
    }
  }
  const path = [];
  let cur = to;
  while (cur && !(cur[0] === from[0] && cur[1] === from[1])) { path.unshift(cur); cur = prev.get(key(...cur)); }
  return path;
}
/** Resuelve la tarjeta abierta tocando la primera opción que se puede (la escena la anima). */
async function resolveCard() {
  for (let i = 0; i < 4; i++) {
    const e = await exp();
    if (!e?.card) return;
    await waitFor(`(() => { const c = document.querySelector('.scene-expedition .ex-card.in'); return c && !document.querySelector('.scene-expedition').__exp.busy; })()`, 6000);
    await sleep(350);
    await tapSel('.scene-expedition .ex-opt:not(:disabled)', null, 2000);
    await sleep(300);
    await idle();
  }
}
/** Camina hasta (x,y) paso a paso con los ganchos de la escena; resuelve las tarjetas que salgan. */
async function walkTo(target) {
  for (let guard = 0; guard < 30; guard++) {
    const e = await exp();
    if (!e || e.run.ended) return false;
    if (e.run.pos[0] === target[0] && e.run.pos[1] === target[1]) return true;
    const path = plan(e.run, e.run.pos, target);
    if (!path.length) return false;
    const [nx, ny] = path[0];
    await page.evaluate((x, y) => document.querySelector('.scene-expedition').__exp.move(x, y), nx, ny);
    await sleep(150);
    await idle();
    await resolveCard();
  }
  return false;
}
/** Bus: anota los eventos de expedición para revisarlos al final. */
const watchBus = () => run(`window.__expEv = []; for (const n of ['expedition:started', 'expedition:decision', 'expedition:finished', 'expedition:zone']) bus.on(n, p => window.__expEv.push({ n, p: JSON.parse(JSON.stringify(p)) })); return true;`);
/** Coloca un edificio donde entre (como lo haría Construir) y termina la obra. */
const placeNow = (id) => run(`
  const { min, max } = E.landBounds();
  for (let z = min; z < max; z++) for (let x = min; x < max; x++) if (E.canPlace('${id}', x, z, 0).ok) {
    const b = E.placeBuilding('${id}', x, z, 0);
    if (b.error) return { error: b.error };
    if (b.buildEnd) { b.buildEnd = Date.now() - 1; E.tick(); }
    return { uid: b.uid };
  }
  return { error: 'sin lugar' };`);
const roleLine = (role) => page.evaluate((r) => document.querySelector(`.modal.pnl-ex [data-role="${r}"]`)?.textContent.replace(/\s+/g, ' ').trim() || null, role);

try {
  // ===================================================================
  section('Ciudad con la Casa de Expediciones');
  await page.goto(`${BASE}?scene=city&reset&nosplash&nosw&cheat=6`, { waitUntil: 'load' });
  await page.evaluate(() => history.replaceState(null, '', location.pathname + '?nosplash&nosw'));
  ok(await waitFor(`window.__pixelia?.ctx.router.current === 'city' && !!document.querySelector('.hud-rail')`, 25000), 'la ciudad carga');
  await run(`store.state.created = ${CREATED}; store.state.onboarded = true; store.markDirty(); return true;`);
  await sleep(1500);
  await drain();
  await watchBus();
  ok(await page.evaluate(() => document.querySelector('[data-act="expedition"]')?.style.display === 'none'), 'sin Casa de Expediciones el botón Expedición no está');
  const casa = await placeNow('casa_exp');
  ok(casa.uid > 0, 'Casa de Expediciones construida', casa);
  await sleep(1300);
  ok(await waitFor(`document.querySelector('[data-act="expedition"]')?.style.display !== 'none'`, 4000), 'aparece el botón Expedición en el riel');
  ok(await page.evaluate(() => document.querySelector('[data-hud="provtag"]')?.textContent === '30'), 'el cartelito muestra las 30 provisiones del depósito');
  await run(`ctx.hud.refreshBadges(); return true;`);
  const badge = await page.evaluate(() => { const b = document.querySelector('[data-badge="expedition"]'); return b && b.style.display !== 'none' ? +b.textContent : 0; });
  ok(badge >= 1, `globito con salida corta gratis y grupo listo (${badge})`);
  await shot('ciudad-boton');

  // ===================================================================
  section('Panel de Expedición y salida corta del tutorial');
  ok(await tapSel('[data-act="expedition"]'), 'toqué Expedición');
  ok(await waitFor(`!!document.querySelector('.modal.pnl-ex [data-ex-go="corta"]')`, 5000), 'se abre el panel con Salir y Salida corta');
  const line1 = await roleLine('exploracion');
  ok(/Exploración 1/.test(line1 || '') && /%/.test(line1 || ''), 'el grupo muestra Exploración 1 con su %', line1);
  ok(/Construí Taller/.test(await roleLine('ingenieria') || ''), 'Ingeniería pide el Taller');
  await shot('panel-expedicion');
  await tapSel('.modal.pnl-ex [data-ex-go="corta"]');
  ok(await waitFor(`!!document.querySelector('.scene-expedition')?.__exp?.view`, 25000), 'la escena de la salida se monta');
  let e = await exp();
  ok(e.run.kind === 'corta' && e.run.seed === 110 && e.run.city?.tutorial, 'salida corta con el mapa fijo del tutorial', { kind: e.run.kind, seed: e.run.seed });
  ok(e.run.party.includes('exploracion') && e.run.prov === 12, 'grupo de la ciudad (Exploración) y 12 provisiones de vianda', { party: e.run.party, prov: e.run.prov });
  ok(await run(`return store.state.prov === 30 && store.state.expedition.freeDay === (new Date().toISOString(), store.state.expedition.freeDay) && !!store.state.expedition.freeDay`), 'la corta no gasta el depósito y usa la del día');
  // juntar dos casillas de madera cercanas y explorar el objetivo
  const woods = e.run.cells.map((c, i) => ({ c, x: i % e.run.w, y: Math.floor(i / e.run.w) })).filter(o => o.c.content === 'recurso' && o.c.sub === 'madera').sort((a, b) => a.c.depth - b.c.depth).slice(0, 2);
  for (const w of woods) ok(await walkTo([w.x, w.y]), `camina hasta la madera (${w.x},${w.y})`);
  e = await exp();
  const oc = e.run.objective.cell;
  ok(await walkTo(oc), 'llega al objetivo: ' + e.run.objective.name);
  await resolveCard();
  e = await exp();
  ok(e.run.objectiveDone, 'objetivo cumplido');
  await shot('salida-corta');
  const cargo = { ...e.run.cargo };
  const mats0 = await run(`return { ...store.state.materials }`);
  await page.evaluate(() => document.querySelector('.scene-expedition').__exp.home(false));
  await sleep(400);
  if (await page.evaluate(() => !!document.querySelector('.scene-expedition [data-a="go"]'))) await tapSel('.scene-expedition [data-a="go"]');
  ok(await waitFor(`!!document.querySelector('.scene-expedition [data-a="city"]')`, 15000), 'resultado de la salida');
  const resTxt = await page.evaluate(() => document.querySelector('.scene-expedition .ex-btns')?.parentElement?.innerText.replace(/\s+/g, ' ') || '');
  ok(/ya está en la ciudad/.test(resTxt) && !/práctica/i.test(resTxt), 'el resultado dice que lo traído ya está en la ciudad', resTxt.slice(0, 200));
  await shot('resultado-corta');

  // ===================================================================
  section('El botín aparece en la ciudad');
  const mats1 = await run(`return { ...store.state.materials }`);
  ok((cargo.madera || 0) >= 3, `trajeron madera (${cargo.madera || 0})`, cargo);
  // las semanas de región / de expediciones (eventos, Fase 5) multiplican lo que se trae: se cuenta con el multiplicador activo
  const matMult = await run(`const ev = window.__pixelia.events; return ev.eventMult('expMats') * ev.eventMult('region_bosque')`);
  ok(Object.entries(cargo).every(([m, n]) => (mats1[m] || 0) === (mats0[m] || 0) + Math.round(n * matMult)), `los materiales de la carga se sumaron a la ciudad (×${matMult} por eventos)`, { cargo, antes: mats0, despues: mats1 });
  ok(await run(`return !store.state.expedition.active && store.state.expedition.last?.kind === 'corta' && store.state.stats.expeditions === 1`), 'la salida queda cerrada y contada');
  await tapSel('.scene-expedition [data-a="city"]');
  ok(await waitFor(`window.__pixelia.ctx.router.current === 'city'`, 10000), 'vuelve a la ciudad');
  await sleep(1200);
  await drain();

  // ===================================================================
  section('Mejorar el Taller cambia la probabilidad que se muestra');
  const can = await run(`return E.canBuild('taller')`);
  ok(can.ok, 'el Taller se puede construir con la madera traída', can);
  const tall = await placeNow('taller');
  ok(tall.uid > 0, 'Taller construido');
  ok(await run(`return (store.state.materials.madera || 0) === ${(mats1.madera || 0) - 3}`), 'el Taller gastó 3 de madera');
  await openExp();
  await waitFor(`!!document.querySelector('.modal.pnl-ex [data-role="ingenieria"]')`, 5000);
  const ing1 = await roleLine('ingenieria');
  ok(/Ingeniería 1/.test(ing1 || '') && /75%/.test(ing1 || ''), 'Ingeniería 1: cruzar un río 75%', ing1);
  await tapSel('.modal.pnl-ex .modal-x');
  await sleep(500);
  const up = await run(`const b = store.state.city.buildings.find(o => o.uid === ${tall.uid}); const r = E.startUpgrade(b.uid); if (r.error) return r; b.upgradeEnd = Date.now() - 1; E.tick(); return { level: b.level };`);
  ok(up.level === 2, 'Taller mejorado a nivel 2', up);
  ok(await run(`return ctx.expedition.cycleUpgradeLines(store.state.city.buildings.find(o => o.id === 'taller')).some(t => /80% → 85%/.test(t))`), 'la ficha anticipa el próximo nivel: 80% → 85%');
  await openExp();
  await waitFor(`!!document.querySelector('.modal.pnl-ex [data-role="ingenieria"]')`, 5000);
  const ing2 = await roleLine('ingenieria');
  ok(/Ingeniería 2/.test(ing2 || '') && /80%/.test(ing2 || ''), 'Ingeniería 2: cruzar un río 80%', ing2);
  await shot('panel-taller-2');
  await tapSel('.modal.pnl-ex .modal-x');
  await sleep(400);

  // ===================================================================
  section('Taller: fabricar una Cuerda');
  await run(`store.grant({ mats: { madera: 3 } }, 'test'); ctx.openPanel('workshop'); return true;`);
  ok(await waitFor(`!!document.querySelector('.modal.pnl-ws [data-craft="cuerda"] .btn')`, 5000), 'panel del Taller');
  await shot('taller');
  await tapSel('.modal.pnl-ws [data-craft="cuerda"] .btn');
  ok(await waitFor(`(window.__pixelia.store.state.equipment.cuerda || 0) === 1`, 3000), 'Cuerda fabricada');
  await tapSel('.modal.pnl-ws .modal-x');
  await sleep(400);

  // ===================================================================
  section('Salida normal: zona 1 explorada y terreno');
  await openExp();
  await waitFor(`!!document.querySelector('.modal.pnl-ex [data-ex-go="normal"]')`, 5000);
  ok(await page.evaluate(() => !!document.querySelector('.modal.pnl-ex [data-equip="cuerda"].on')), 'la Cuerda viene elegida',
    await page.evaluate(() => ({ modals: [...document.querySelectorAll('.modal')].map(m => m.className), equip: window.__pixelia.store.state.equipment, btns: [...document.querySelectorAll('.modal.pnl-ex [data-equip]')].map(b => b.outerHTML.slice(0, 120)) })));
  const prov0 = await run(`return store.state.prov`);
  await tapSel('.modal.pnl-ex [data-ex-go="normal"]');
  ok(await waitFor(`!!document.querySelector('.scene-expedition')?.__exp?.view`, 25000), 'la escena se monta');
  e = await exp();
  ok(e.run.kind === 'normal' && e.run.equip.includes('cuerda') && e.run.prov === Math.min(18, prov0), `salida normal con Cuerda y ${e.run.prov} provisiones del depósito`);
  ok(await run(`return store.state.prov === ${prov0 - Math.min(18, prov0)} && !store.state.equipment.cuerda`), 'se descontaron las provisiones y la Cuerda');
  ok(e.run.roleLevel.ingenieria === 2 || !e.run.party.includes('ingenieria'), 'el rol sale con el nivel de su edificio', e.run.roleLevel);
  ok(await walkTo(e.run.objective.cell), 'llega al objetivo');
  await resolveCard();
  e = await exp();
  ok(e.run.objectiveDone, 'objetivo de la zona 1 cumplido');
  await page.evaluate(() => document.querySelector('.scene-expedition').__exp.home(false));
  await sleep(400);
  if (await page.evaluate(() => !!document.querySelector('.scene-expedition [data-a="go"]'))) await tapSel('.scene-expedition [data-a="go"]');
  ok(await waitFor(`!!document.querySelector('.scene-expedition [data-a="city"]')`, 15000), 'resultado');
  const res2 = await page.evaluate(() => document.querySelector('.scene-expedition .ex-btns')?.parentElement?.innerText.replace(/\s+/g, ' ') || '');
  ok(/zona 1 de Bosque del Arroyo quedó explorada/.test(res2), 'el resultado dice que la zona 1 quedó explorada', res2.slice(0, 240));
  ok(/ampliar el terreno/.test(res2), 'y que ya se puede ampliar el terreno');
  await shot('resultado-zona');
  const z = await run(`return { zone: store.state.expedition.regions.bosque.zone, total: E.zonesExplored(), ex: E.expansionStatus() }`);
  ok(z.zone === 2 && z.total === 1, 'Bosque: próxima zona 2, 1 zona explorada', z);
  ok(z.ex.ok, 'la expansión 1 se habilita con 1 zona explorada', z.ex);
  const leftover = await run(`return store.state.expedition.last.provBack`);
  ok(await run(`return store.state.prov === ${prov0 - Math.min(18, prov0)} + ${leftover}`), `las provisiones que sobraron (${leftover}) volvieron al depósito`);
  await tapSel('.scene-expedition [data-a="city"]');
  await waitFor(`window.__pixelia.ctx.router.current === 'city'`, 10000);
  await sleep(900);
  await drain();
  ok(await run(`return !!E.expand().ok && store.state.city.expansions === 1`), 'el terreno se amplía');
  const z2 = await run(`return E.expansionStatus()`);
  ok(!z2.ok && z2.missingZones === 2 && /2 zonas más/.test(z2.reason), 'la próxima pide 3 zonas en total', z2);

  const evs = await page.evaluate(() => window.__expEv || []);
  const names = evs.map(x => x.n);
  ok(names.filter(n => n === 'expedition:started').length === 2 && names.filter(n => n === 'expedition:finished').length === 2, 'expedition:started y finished por cada salida', names);
  ok(names.includes('expedition:zone') && evs.find(x => x.n === 'expedition:zone').p.total === 1, 'expedition:zone con el total de zonas');
  ok(evs.every(x => !x.p.prototype), 'ningún evento lleva prototype: true');

  // ===================================================================
  section('Salida a medias: recargar y retomar');
  await run(`store.grant({ prov: 20 }, 'test'); return true;`);
  // después de ampliar el terreno el HUD vuelve cuando termina la animación (con la máquina cargada tarda)
  await waitFor(`!!document.querySelector('[data-act="expedition"]')`, 8000);
  await openExp();
  await waitFor(`!!document.querySelector('.modal.pnl-ex [data-ex-go="normal"]:not(:disabled)')`, 5000);
  await tapSel('.modal.pnl-ex [data-ex-go="normal"]');
  await waitFor(`(() => { const e = document.querySelector('.scene-expedition')?.__exp; return !!e?.view && e.run?.steps === 0; })()`, 25000); // la salida nueva, no la escena anterior que se está yendo
  e = await exp();
  const mv = e.view.moves.find(m => m.ok);
  await page.evaluate((x, y) => document.querySelector('.scene-expedition').__exp.move(x, y), mv.x, mv.y);
  await sleep(200); await idle(); await resolveCard();
  e = await exp();
  const steps = e.run.steps;
  ok(steps >= 1, `dio ${steps} paso(s)`);
  await page.reload({ waitUntil: 'load' });
  ok(await waitFor(`window.__pixelia?.ctx.router.current === 'city'`, 25000), 'recarga en la ciudad');
  await sleep(1500);
  await drain();
  await run(`ctx.hud.refreshBadges(); return true;`);
  await openExp();
  ok(await waitFor(`!!document.querySelector('.modal.pnl-ex [data-ex-go="resume"]')`, 5000), 'el panel ofrece Retomar');
  ok(await page.evaluate(() => document.querySelector('.modal.pnl-ex [data-ex-go="normal"]')?.disabled), 'y no deja salir de nuevo');
  await shot('panel-retomar');
  await tapSel('.modal.pnl-ex [data-ex-go="resume"]');
  ok(await waitFor(`!!document.querySelector('.scene-expedition')?.__exp?.view`, 25000), 'la escena se monta');
  e = await exp();
  ok(e.run.steps === steps && e.run.kind === 'normal', 'retoma la misma salida', { steps: e.run.steps });
  await page.evaluate(() => document.querySelector('.scene-expedition').__exp.home(false));
  await sleep(400);
  if (await page.evaluate(() => !!document.querySelector('.scene-expedition [data-a="go"]'))) await tapSel('.scene-expedition [data-a="go"]');
  ok(await waitFor(`!!document.querySelector('.scene-expedition [data-a="city"]')`, 15000), 'vuelven');
  ok(await run(`return store.state.stats.expeditions === 3`), '3 salidas contadas');

  // ===================================================================
  section('Misiones y consola');
  ok(await run(`return Q.mainQuest() != null`), 'la cadena de misiones sigue');
  ok(errors.length === 0, 'sin errores en la consola', errors.slice(0, 5));
} catch (err) {
  failN++;
  console.log('  ✘ excepción: ' + (err.stack || err.message));
  await shot('excepcion').catch(() => {});
}
console.log(`\n${failN ? '✘' : '✔'} test-cycle (${DEVICE}): ${okN} bien, ${failN} mal`);
if (errors.length) console.log(errors.slice(0, 10).join('\n'));
await browser.close();
server.close();
process.exit(failN ? 1 : 0);
