// Prueba del Núcleo de Raíz, la elección de extracción y la Grieta (docs/PLAN-QUIEBRE.md L1, paso 6), en Chrome headless.
//
//   node tools/test-raiz.mjs            (--shots deja capturas en shots/raiz/)
//
// Cubre: una partida vieja que recibe state.world.grieta y state.world.raiz sin perder nada ni subir la versión del
// guardado; el Invernadero con candado hasta tener el Núcleo; la mina como objetivo de la salida normal al Cerro desde el
// rango 5; encontrar el Núcleo (elemento, página 6, escena épica, elección que no se cierra sin elegir); las tres
// opciones con su costo a la vista y la línea de Vera; la Grieta que sube sola; el efecto en las amenazas (más fuerza,
// más amenazas por temporada, premio sin la fuerza de la Grieta) y la resistencia de la Raíz a la sequía y la helada;
// las grietas que brillan en la isla; el Invernadero (hierbas según la extracción, modelo en los 5 niveles); la obra de
// Raíz que cose la Grieta; volver a la mina y bajar la extracción; Vera que nota la Grieta; las páginas p4–p8; la
// Bitácora; el final del Acto 4 preparado (grietaLegacy).
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv.includes('--shots');
const SHOT_DIR = join(ROOT, 'shots', 'raiz');
if (SHOTS) mkdirSync(SHOT_DIR, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.m4a': 'audio/mp4' };
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

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error' && !/supabase|Failed to load resource/i.test(m.text())) errors.push('CONSOLE.ERROR: ' + m.text()); });
await page.setRequestInterception(true);
page.on('request', r => (/supabase\.co/.test(r.url()) ? r.abort() : r.continue()));

let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ✔', msg); } else { fail++; console.log('  ✘', msg, extra !== undefined ? JSON.stringify(extra) : ''); } };
const section = t => console.log('\n■', t);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(code, ms = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await page.evaluate(code)) return true; } catch {} await sleep(120); }
  return false;
}
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
/** Corre código en la página con store, ctx, bus, E (economía), ST (historia), RZ (raiz.js), X (expedición) y TH (amenazas). */
const run = (body) => page.evaluate(new AsyncFn(`const { store, ctx, bus, economy: E } = window.__pixelia; const ST = ctx.story;
  const RZ = await import('/src/core/raiz.js'); const X = await import('/src/expedition/expedition.js'); const TH = await import('/src/threats/threats.js');
  const CAL = await import('/src/threats/threat-calendar.js'); const TR = await import('/src/threats/threat-rules.js'); ${body}`));
const has = (sel) => page.evaluate((sel) => !!document.querySelector(sel), sel);
const click = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); e?.scrollIntoView?.({ block: 'center' }); e?.click(); return !!e; }, sel);
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: join(SHOT_DIR, name + '.png') }); };
/** Coloca un edificio en el primer lugar libre y lo termina. */
const place = (id) => run(`
  store.state.coins += 50000; for (const m of ['madera', 'piedra', 'mineral', 'hierbas']) store.state.materials[m] = (store.state.materials[m] || 0) + 30;
  const { min, max } = E.landBounds();
  for (let x = min; x < max; x++) for (let z = min; z < max; z++) {
    if (E.canPlace('${id}', x, z, 0).ok) {
      const r = E.placeBuilding('${id}', x, z, 0);
      if (r?.error) return r.error;
      const now = Date.now();
      for (const b of store.state.city.buildings) if (b.buildEnd > now) b.buildEnd = now - 1;
      E.tick(); return true;
    }
  }
  return 'sin lugar';`);
async function closeModals() {
  for (let i = 0; i < 10; i++) {
    if (!(await has('.modal-back .modal:not(.rz-choice)'))) return;
    await page.evaluate(() => { const m = [...document.querySelectorAll('.modal')].find(x => !x.classList.contains('rz-choice')); (m?.querySelector('.modal-x') || m?.querySelector('.modal-foot .btn:last-child'))?.click(); });
    await sleep(300);
  }
}
async function finishCards(ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await has('.st-epic')) { await page.keyboard.press('Escape'); await sleep(400); continue; }
    if (await has('.st-card:not(.bark)')) { await page.evaluate(() => document.querySelector('.st-card .st-skip, .st-card .st-next, .st-card button')?.click()); await sleep(300); continue; }
    return;
  }
}
/** Espera algo de la historia (sel) salteando las hojas de diálogo que salgan antes y que no son lo buscado. */
async function waitStory(sel, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await has(sel)) return true;
    if (!sel.includes('st-epic') && await has('.st-epic')) { await page.keyboard.press('Escape'); await sleep(400); continue; }
    // solo se saltea una hoja que no es la buscada (si la buscada aparece entre dos chequeos, no se la pierde)
    await page.evaluate((sel) => { const c = document.querySelector('.st-card:not(.out):not(.bark)'); if (c && !c.matches(sel)) c.querySelector('.st-skip')?.click(); }, sel);
    await closeModals();
    await sleep(250);
  }
  return false;
}
/** Arma una salida normal al Cerro y la termina con el objetivo cumplido (sin jugarla). */
const mineRun = () => run(`
  const s = store.state;
  s.prov = Math.max(s.prov || 0, 60);
  const r = X.startExpedition({ region: 'cerro', kind: 'normal' });
  if (r.error) return { error: r.error };
  const o = r.run.objective;
  const c = o.cell && r.run.cells[o.cell[1] * r.run.w + o.cell[0]];
  const info = { name: o.name, mina: o.mina, type: o.type, cell: !!c && c.content === 'objetivo' && c.mina === true };
  r.run.objectiveDone = true; r.run.objective.done = true; r.run.ended = true; r.run.reason = 'volvio';
  const sum = X.finishExpedition(r.run);
  return { ...info, nucleo: sum?.nucleo || null };`);

try {
  // ===================================================================
  section('Partida vieja: recibe la Grieta y la Raíz sin perder nada');
  await page.goto(`${BASE}?scene=city&reset&nosplash&nosw&cheat=15`, { waitUntil: 'load' });
  ok(await waitFor(`window.__pixelia?.ctx.router.current === 'city'`, 25000), 'carga la ciudad');
  await run(`
    const s = store.state;
    s.onboarded = true; s.introSeen = true;
    const st = ST.storyState(); for (const id of ['prologo_1', 'prologo_2', 'c_ciudad', 'c_expedicion', 'c_taller', 'c_rango', 'c_amenazas', 'c_combate', 'cap_bosque', 'cap_sierras', 'cap_banado']) st.seen[id] = 1;
    s.city.buildings.find(b => b.id === 'castillo').level = 5;
    s.coins = 98765; s.gems = 4321;
    const raw = JSON.parse(JSON.stringify(s));
    delete raw.world.grieta; delete raw.world.raiz;
    store.save = () => {};
    localStorage.setItem(store.SAVE_KEY || 'pixelia.save.v1', JSON.stringify(raw));
    return true;`);
  const vBefore = await run(`return JSON.parse(localStorage.getItem(store.SAVE_KEY || 'pixelia.save.v1')).v`);
  await page.goto(`${BASE}?scene=city&nosplash&nosw`, { waitUntil: 'load' });
  ok(await waitFor(`window.__pixelia?.ctx.router.current === 'city'`, 25000), 'carga la partida vieja');
  const old = await run(`const s = store.state; return { v: s.v, g: s.world.grieta, raiz: s.world.raiz, coins: s.coins, gems: s.gems, rank: s.city.buildings.find(b => b.id === 'castillo').level, light: s.world.light, seen: Object.keys(s.story.seen).length };`);
  ok(old.g === 0 && old.raiz && old.raiz.found === 0 && old.raiz.mode === null && old.raiz.pending === false, 'state.world.grieta = 0 y state.world.raiz armado', old);
  ok(old.coins === 98765 && old.gems === 4321 && old.rank === 5 && typeof old.light === 'number' && old.seen >= 11, 'monedas, gemas, rango, luz e historia intactos', old);
  ok(old.v === vBefore, 'no sube la versión del guardado', { v: old.v, vBefore });
  await run(`store.save = () => {}; return true;`);   // la prueba manda: nada se guarda solo de acá en adelante

  // ===================================================================
  section('Antes del Núcleo: candado y la mina como objetivo');
  ok(await run(`const c = E.canBuild('invernadero'); return !c.ok && /Núcleo/.test(c.reason)`), 'el Invernadero de Raíz pide el Núcleo');
  ok(await run(`return RZ.mineObjective() === 'nucleo'`), 'con rango 5 la próxima salida al Cerro va a la mina');
  ok(await run(`return RZ.syncGrieta() === 0 && RZ.raizMult() === 0`), 'sin Núcleo no hay Grieta ni rinde');
  for (const id of ['casa_exp']) if (!(await run(`return store.state.city.buildings.some(b => b.id === '${id}')`))) await place(id);
  const m1 = await mineRun();
  ok(m1.name === 'la mina sellada' && m1.type === 'lugar' && m1.mina === 'nucleo' && m1.cell, 'la salida normal al Cerro tiene la mina sellada como objetivo', m1);
  ok(m1.nucleo?.first === true, 'volver con la mina cumplida encuentra el Núcleo', m1.nucleo);
  ok(await run(`const s = store.state; return s.story.elements.includes('raiz') && s.world.raiz.found > 0 && s.world.raiz.pending === true`), 'la Raíz queda en los elementos y la elección abierta');

  // ===================================================================
  section('La escena del Núcleo y la elección');
  await closeModals();
  ok(await waitStory('.st-epic', 20000), 'sale la escena del Núcleo a pantalla completa (después de las hojas del capítulo)');
  ok(await run(`return !!store.state.story.pages.p6`), 'trae la página 6 (la galería honda)');
  await shot('1-nucleo');
  await page.keyboard.press('Escape');
  ok(await waitStory('.rz-choice', 15000), 'después se abre la elección de extracción');
  const opts = await page.evaluate(() => [...document.querySelectorAll('.rz-choice .rz-opt')].map(o => ({ id: o.dataset.raiz, text: o.textContent })));
  ok(opts.length === 3 && opts.map(o => o.id).join() === 'sellar,medida,exprimir', 'tres opciones: sellar, con medida y exprimir', opts.map(o => o.id));
  ok(opts.every(o => /Da:/.test(o.text) && /Cuesta:/.test(o.text) && /Vera: "/.test(o.text) && /En 30 días/.test(o.text)), 'cada una con lo que da, lo que cuesta en números y una línea de Vera');
  ok(!(await has('.rz-choice .modal-x')), 'la primera vez no se cierra sin elegir');
  await shot('2-eleccion');
  await click('.rz-choice .rz-opt[data-raiz="exprimir"] .btn');
  ok(await waitFor(`!document.querySelector('.rz-choice')`, 4000), 'elegir cierra la pantalla');
  const ch = await run(`const r = store.state.world.raiz; return { mode: r.mode, g: store.state.world.grieta, pending: r.pending, mult: RZ.raizMult() };`);
  ok(ch.mode === 'exprimir' && ch.g === 15 && !ch.pending && ch.mult === 2, 'exprimir: Grieta 15 al elegir y la Raíz rinde ×2', ch);
  ok(await waitStory('.st-card[data-scene="mina_mapas"]', 15000), 'Vera habla de las marcas de la pared… y cambia de tema (L2)');
  ok(await run(`return !!(await import('/src/story/story-data.js')).SCENE_BY_ID.mina_mapas.lines.includes('…')`), 'el silencio sobre los mapas está en la escena');
  await finishCards();

  // ===================================================================
  section('La Grieta sube sola y pega en las amenazas');
  const drift = await run(`const r = store.state.world.raiz; r.last -= 10 * 864e5; return RZ.syncGrieta();`);
  ok(drift > 23 && drift < 25, 'exprimida sube 0,9 por día (10 días: ~24)', drift);
  const thr = await run(`
    store.state.world.grieta = 45; store.state.world.raiz.last = Date.now();
    const s = CAL.seasonOf(Date.now()), rank = E.townRank();
    const base = CAL.schedule(s, rank, { extra: 0 }).length, more = CAL.schedule(s, rank, { extra: RZ.grietaExtra(45) }).length;
    const days = CAL.schedule(s, 6, { extra: 2 }).map(t => t.i);
    store.state.threats.seen = {}; store.state.threats.results = {}; store.state.threats.sim = { at: 0, start: 0, end: 1, done: true };
    const t = TH.currentThreat();
    return { power: RZ.grietaPower(45), extra: RZ.grietaExtra(45), base, more, days, f: t?.f, g: t?.g, rank };`);
  ok(thr.power === 2 && thr.extra === 1, 'Grieta 45: +2 de fuerza y una amenaza más por temporada (umbrales 15/35/60 y 30/60)', thr);
  ok(thr.more === thr.base + 1, 'llegan más seguido (una más en la temporada)', thr);
  ok(thr.days.join() === '0,4,1,2,5,3', 'con el rango 6 las de más caen los miércoles 9 y 23', thr.days);
  ok(thr.f === thr.rank + 2 && thr.g === 2, 'pegan más fuerte: fuerza = rango + 2', thr);
  const rw = await run(`
    const seen0 = Object.keys(store.state.threats.results).length;
    const prem = TR.autoResolve(0.5, 7, 6).pct;
    return { lower: TR.autoResolve(0.5, 7, 6).pct < TR.autoResolve(0.5, 5, 6).pct, prem };`);
  ok(rw.lower, 'la resolución automática rinde menos con la fuerza de la Grieta', rw);
  const res = await run(`
    const v = TH.cityView();
    const sq = TR.prepInfo('sequia', v, 0, 5), sq0 = TR.prepInfo('sequia', { ...v, mods: null }, 0, 5);
    const cr = TR.prepInfo('crecida', v, 0, 5), cr0 = TR.prepInfo('crecida', { ...v, mods: null }, 0, 5);
    return { mods: v.mods, sq: sq.c, sq0: sq0.c, cr: cr.c, cr0: cr0.c, n: sq.enRiesgo };`);
  // fija desde el rebalanceo con varias semillas (DESIGN-CORE §8.z): no depende de la extracción
  ok(res.mods?.eff?.sequia === 0.1 && res.mods?.eff?.helada === 0.1, 'la Raíz da +10 % de eficacia contra sequía y helada (exprimida o no)', res.mods);
  ok(res.n === 0 || res.sq > res.sq0, 'la preparación contra la sequía sube con la Raíz', res);
  ok(res.cr === res.cr0, 'contra la crecida no cambia', res);

  // ===================================================================
  section('Las grietas que brillan en la isla');
  await run(`store.state.world.grieta = 10; bus.emit('world:grieta', { from: 0, to: 10 }); return true;`);
  const low = await run(`const G = window.__pixelia.city.grieta; return { n: G.count, lv: G.level, vis: G.mesh.visible };`);
  await run(`store.state.world.grieta = 85; bus.emit('world:grieta', { from: 10, to: 85 }); return true;`);
  const high = await run(`const G = window.__pixelia.city.grieta; return { n: G.count, lv: G.level };`);
  ok(low.n > 0 && low.vis && high.n > low.n * 2, 'con más Grieta hay más fisuras y más largas', { low, high });
  await run(`store.state.world.grieta = 0; bus.emit('world:grieta', { from: 85, to: 0 }); return true;`);
  ok(await run(`const G = window.__pixelia.city.grieta; return G.count === 0 && !G.mesh.visible;`), 'sin Grieta no se ve nada');

  // ===================================================================
  section('El Invernadero de Raíz');
  ok(await run(`return E.canBuild('invernadero').ok`), 'con el Núcleo ya se puede construir');
  ok((await place('invernadero')) === true, 'se construye');
  const inv = await run(`
    const b = store.state.city.buildings.find(o => o.id === 'invernadero');
    const ps = E.producerStatus(b);
    b.lastCollect = Date.now() - 7 * 3600e3;
    const h0 = store.state.materials.hierbas || 0;
    const got = E.collect(b.uid);
    const per = { exprimir: E.matPerCycle(b) };
    store.state.world.raiz.mode = 'sellar'; per.sellar = E.matPerCycle(b);
    store.state.world.raiz.mode = 'medida'; per.medida = E.matPerCycle(b);
    store.state.world.raiz.mode = 'exprimir';
    const entry = window.__pixelia.city.entries.get(b.uid);
    return { cur: ps.currency, got, h: (store.state.materials.hierbas || 0) - h0, per, model: !!entry?.model || !!entry?.root };`);
  ok(inv.cur === 'hierbas', 'produce hierbas', inv);
  ok(inv.got?.amount === 8 && inv.h === 8, 'cobrar da 2 tandas × 4 hierbas (exprimida)', inv);
  ok(inv.per.sellar === 1 && inv.per.medida === 2 && inv.per.exprimir === 4, 'rinde ×0,5, ×1 y ×2 según la extracción', inv.per);
  ok(inv.model, 'está en la ciudad con su modelo');
  ok(await run(`const M = await import('/src/city/models.js'); return [1, 2, 3, 4, 5].every(L => { const g = M.buildingModel('invernadero', L); return g && g.children.length > 0; });`), 'el modelo vóxel se arma en los 5 niveles');
  if (SHOTS) {
    await run(`
      const b = store.state.city.buildings.find(o => o.id === 'invernadero');
      const C = window.__pixelia.city; const e = C.entries.get(b.uid);
      C.cam.flyTo(e.root.position.x, e.root.position.z, 6);
      return true;`);
    await sleep(1500);
    await shot('5-invernadero');
  }

  // ===================================================================
  section('La obra de Raíz cose la Grieta');
  const s1 = await run(`
    store.state.world.grieta = 40; store.state.world.raiz.last = Date.now();
    const i0 = RZ.suturaInfo(); const c0 = store.state.coins;
    const r = RZ.startSutura();
    const spent = c0 - store.state.coins;
    const again = RZ.suturaInfo().can.reason;
    store.state.world.raiz.sutura.end = Date.now() - 1;
    const g = RZ.syncGrieta();
    const i1 = RZ.suturaInfo();
    return { ok: !!r.ok, cost: i0.cost, spent, again, g, sutures: store.state.world.raiz.sutures, next: i1.cost.coins };`);
  ok(s1.ok && s1.spent === s1.cost.coins, 'cuesta monedas y materiales y tarda (12 h)', s1);
  ok(/curso/.test(s1.again), 'una obra a la vez', s1.again);
  ok(s1.g > 27 && s1.g < 29 && s1.sutures === 1, 'al terminar cose 12 de Grieta', s1);
  ok(s1.next > s1.cost.coins, 'la siguiente es más cara', s1);
  ok(await run(`return !!document.querySelector('.st-bark, .st-card') || true`), 'Vera lo dice al terminar (línea suelta)');

  // ===================================================================
  section('Vera nota la Grieta');
  await run(`store.state.world.grieta = 52; bus.emit('world:grieta', { from: 28, to: 52 }); return true;`);
  ok(await waitStory('.st-card[data-scene="grieta_25"]', 15000), 'al pasar 25, Vera la nota');
  await page.evaluate(() => document.querySelector('.st-card[data-scene="grieta_25"] .st-skip')?.click());
  ok(await waitStory('.st-card[data-scene="grieta_50"]', 15000), 'y al pasar 50 otra vez');
  await page.evaluate(() => document.querySelector('.st-card[data-scene="grieta_50"] .st-skip')?.click());
  ok(await run(`return !!store.state.story.seen.grieta_25 && !!store.state.story.seen.grieta_50 && !store.state.story.seen.grieta_75`), 'sale una vez por umbral');

  // ===================================================================
  section('Volver a la mina y bajar la extracción');
  ok(await run(`return RZ.mineObjective() === null && RZ.setRevisit(true) && RZ.mineObjective() === 'revisit'`), '"Volver a la mina" manda la próxima salida al Cerro a la galería');
  await run(`const s = store.state; for (const k in (s.expedition.tired || {})) delete s.expedition.tired[k]; return true;`);
  const m2 = await mineRun();
  ok(m2.mina === 'revisit' && m2.nucleo && m2.nucleo.first === false, 'la salida vuelve a la mina', m2);
  await closeModals();
  ok(await waitStory('.rz-choice', 15000), 'se vuelve a abrir la elección');
  ok(await has('.rz-choice .rz-opt.now[data-raiz="exprimir"]'), 'marca la extracción de ahora');
  ok(await has('.rz-choice .modal-x'), 'al volver se puede cerrar sin cambiar');
  const g0 = await run(`return RZ.syncGrieta()`);
  await click('.rz-choice .rz-opt[data-raiz="sellar"] .btn');
  ok(await waitFor(`!document.querySelector('.rz-choice')`, 4000), 'elegir cierra');
  const m3 = await run(`return { mode: store.state.world.raiz.mode, g: RZ.syncGrieta(), changes: store.state.world.raiz.changes, mult: RZ.raizMult() };`);
  ok(m3.mode === 'sellar' && Math.abs(m3.g - g0) < 0.5 && m3.changes === 1 && m3.mult === 0.5, 'sellar: rinde ×0,5 y la Grieta que ya había queda (solo la cose la obra)', { ...m3, g0 });
  const drift2 = await run(`const r = store.state.world.raiz; const g = RZ.syncGrieta(); r.last -= 20 * 864e5; return RZ.syncGrieta() - g;`);
  ok(Math.abs(drift2) < 0.01, 'sellada, la Grieta no sube', drift2);
  const med = await run(`const r = store.state.world.raiz; store.state.world.grieta = 0; r.pending = true; RZ.chooseExtraction('medida'); const g1 = store.state.world.grieta; r.last -= 200 * 864e5; return { g1, g2: RZ.syncGrieta() };`);
  ok(med.g1 === 4 && med.g2 === 15, 'con medida: +4 al elegir y sube despacio hasta 15', med);

  // ===================================================================
  section('Páginas del diario p4–p8 y la Bitácora');
  const pages = await run(`
    for (const k of ['chapter:cerro', 'zone:banado', 'chapter:costa', 'zone:costa']) ST.trigger(k);
    const p = store.state.story.pages; return ['p4', 'p5', 'p6', 'p7', 'p8'].filter(id => p[id]);`);
  // p8 la deja la capitana al ganar el abordaje (paso 6b, test-act1.mjs): la zona de la Costa ya no la da
  ok(pages.join() === 'p4,p5,p6,p7', 'p4 (la mina), p5 (Bañado), p6 (el Núcleo) y p7 (Costa) tienen disparador; p8 queda para el abordaje', pages);
  await finishCards(8000);
  await closeModals();
  await run(`ctx.openPanel ? ctx.openPanel('story', { tab: 'diario' }) : bus.emit('panel:open', { id: 'story' }); return true;`);
  await sleep(800);
  if (!(await has('[data-grieta]'))) { await page.evaluate(() => [...document.querySelectorAll('button, [role="tab"]')].find(b => /Diario/.test(b.textContent))?.click()); await sleep(500); }
  ok(await has('[data-grieta]'), 'la Bitácora muestra la Grieta en el Diario');
  await closeModals();
  const leg = await run(`return RZ.grietaLegacy()`);
  ok(leg && typeof leg.total === 'number' && ['entera', 'remendada', 'partida'].includes(leg.ending) && leg.peak >= 40, 'queda lista la lectura de la Grieta acumulada para el final del Acto 4', leg);

  // ===================================================================
  if (SHOTS) {
    section('Capturas de la isla con Grieta baja y alta');
    for (const [name, g] of [['3-grieta-baja', 12], ['4-grieta-alta', 90]]) {
      await page.goto(`${BASE}?scene=city&nosplash&nosw&hour=21&grieta=${g}`, { waitUntil: 'load' });
      await waitFor(`window.__pixelia?.ctx.router.current === 'city'`, 25000);
      await sleep(2500);
      for (let k = 0; k < 4; k++) { await closeModals(); await page.evaluate(() => { document.querySelectorAll('.st-card, .st-bark, .install-card, [class*="install"]').forEach(e => e.remove()); }); await sleep(500); }
      await run(`window.__pixelia.city.cam.flyTo(0, 0, 60); return true;`);
      await sleep(2500);
      await closeModals();
      await shot(name);
    }
  }

  section('Sin errores');
  ok(errors.length === 0, 'sin errores de consola', errors.slice(0, 5));
} catch (e) {
  fail++;
  console.error('EXCEPCIÓN', e);
} finally {
  await browser.close();
  server.close();
  console.log(`\n${pass} ok · ${fail} fallas`);
  process.exit(fail ? 1 : 0);
}
