// Prueba del Acto 1, segunda parte (paso 6b; docs/PLAN-QUIEBRE.md §C, §I, L6 y "Actos"), en Chrome headless.
//
//   node tools/test-act1.mjs            (--shots deja capturas en shots/act1/)
//
// Cubre: una partida vieja que recibe state.story.abordaje y state.story.echoes sin perder nada ni subir la versión del
// guardado; E5 (la primera pelea después de t5, el Núcleo, la bestia, el faro y el abordaje en la cadena, con cobro
// automático de la primera pelea); la bestia en la poza honda del Bañado (solo con el Núcleo, casilla al fondo, no se
// resuelve rápido, revancha que suma intentos, escena de Vera, página 9 y la marca al ganar); los jefes en low-poly
// (boss-models.js, con fase 2); el faro viejo como objetivo de la Costa desde el rango 6 (marca, escena y capítulo); el
// abordaje (llega después del faro, dirigible en el borde, tarjeta, pelea en la ciudad con la gente de la ciudad, perder
// deja revancha, ganar cierra el Acto 1 con la página 8 y el capítulo "Las islas te vieron"); los ecos de noche (solo de
// noche, uno por vez, una sola vez, clic que da la línea y la página 10, Bitácora, eco en una ruina de la expedición).
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv.includes('--shots');
const SHOT_DIR = join(ROOT, 'shots', 'act1');
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
/** Corre código en la página con store, ctx, bus, E, ST (historia), A (act1.js), EC (ecos), X (expedición), XR (reglas), Q. */
const run = (body) => page.evaluate(new AsyncFn(`const { store, ctx, bus, economy: E } = window.__pixelia; const ST = ctx.story;
  const A = await import('/src/story/act1.js'); const EC = await import('/src/story/echoes.js'); const X = await import('/src/expedition/expedition.js');
  const XR = await import('/src/expedition/exp-rules.js'); const RZ = await import('/src/core/raiz.js'); const Q = await import('/src/core/quests.js');
  const SD = await import('/src/story/story-data.js'); ${body}`));
const has = (sel) => page.evaluate((sel) => !!document.querySelector(sel), sel);
const click = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); e?.scrollIntoView?.({ block: 'center' }); e?.click(); return !!e; }, sel);
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: join(SHOT_DIR, name + '.png') }); };
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
    if (!(await has('.modal-back .modal:not(.rz-choice):not(.ab-modal):not(.ec-modal)'))) return;
    await page.evaluate(() => { const m = [...document.querySelectorAll('.modal')].find(x => !x.classList.contains('rz-choice') && !x.classList.contains('ab-modal') && !x.classList.contains('ec-modal')); (m?.querySelector('.modal-x') || m?.querySelector('.modal-foot .btn:last-child'))?.click(); });
    await sleep(300);
  }
}
/** Espera algo de la historia (sel) salteando las hojas y épicas que salgan antes y no son lo buscado. */
async function waitStory(sel, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await has(sel)) return true;
    if (!sel.includes('st-epic') && await has('.st-epic')) { await page.keyboard.press('Escape'); await sleep(400); continue; }
    await page.evaluate((sel) => { const c = document.querySelector('.st-card:not(.out):not(.bark)'); if (c && !c.matches(sel)) c.querySelector('.st-skip')?.click(); }, sel);
    await closeModals();
    await sleep(250);
  }
  return false;
}
async function drainStory(ms = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await has('.st-epic')) { await page.keyboard.press('Escape'); await sleep(400); continue; }
    if (await has('.st-card:not(.out):not(.bark)')) { await page.evaluate(() => document.querySelector('.st-card:not(.out):not(.bark) .st-skip')?.click()); await sleep(300); continue; }
    await closeModals();
    await sleep(300);
  }
}
const goCity = async (q = '') => {
  await page.goto(`${BASE}?scene=city&nosplash&nosw${q}`, { waitUntil: 'load' });
  return waitFor(`window.__pixelia?.ctx.router.current === 'city'`, 25000);
};

try {
  // ===================================================================
  section('Partida vieja: recibe el abordaje y los ecos sin perder nada');
  await page.goto(`${BASE}?scene=city&reset&nosplash&nosw&cheat=15`, { waitUntil: 'load' });
  ok(await waitFor(`window.__pixelia?.ctx.router.current === 'city'`, 25000), 'carga la ciudad');
  await run(`
    const s = store.state;
    s.onboarded = true; s.introSeen = true;
    const st = ST.storyState(); for (const id of ['prologo_1', 'prologo_2', 'c_ciudad', 'c_expedicion', 'c_taller', 'c_rango', 'c_amenazas', 'c_combate', 'c_elementos', 'cap_bosque', 'cap_sierras', 'cap_banado', 'cap_cerro', 'mina_camino', 'cap_costa']) st.seen[id] = 1;
    s.coins = 76543; s.gems = 2109;
    const raw = JSON.parse(JSON.stringify(s));
    delete raw.story.abordaje; delete raw.story.echoes;
    store.save = () => {};
    localStorage.setItem(store.SAVE_KEY || 'pixelia.save.v1', JSON.stringify(raw));
    return true;`);
  const vBefore = await run(`return JSON.parse(localStorage.getItem(store.SAVE_KEY || 'pixelia.save.v1')).v`);
  ok(await goCity(), 'carga la partida vieja');
  const old = await run(`const s = store.state; A.abordajeState(s); EC.echoState(s); return { v: s.v, coins: s.coins, gems: s.gems, ab: s.story.abordaje, ec: s.story.echoes, seen: Object.keys(s.story.seen).length, st: A.abordajeStatus(s) };`);
  ok(old.ab && old.ab.tries === 0 && old.ec && Object.keys(old.ec).length === 0 && old.st === 'none', 'state.story.abordaje y state.story.echoes armados, sin faro', old);
  ok(old.coins === 76543 && old.gems === 2109 && old.seen >= 15, 'monedas, gemas e historia intactas', old);
  ok(old.v === vBefore, 'no sube la versión del guardado', { v: old.v, vBefore });
  await run(`store.save = () => {}; return true;`);

  // ===================================================================
  section('E5: los pasos nuevos de la cadena');
  await place('casa_exp');
  const chain = await run(`const ids = (await import('/src/core/data.js')).MAIN_QUESTS.map(q => q.id);
    return { c: ids.indexOf('q_combate') - ids.indexOf('t5'), n: ids.indexOf('q_nucleo') - ids.indexOf('m24'), b: ids.indexOf('q_bestia') - ids.indexOf('m21'), f: ids.indexOf('q_faro') - ids.indexOf('m26'), a: ids.indexOf('q_abordaje') - ids.indexOf('q_faro'), auto: SD.AUTO_CLAIM.includes('q_combate') };`);
  ok(chain.c === 1 && chain.b === 1 && chain.n === 1 && chain.f === 1 && chain.a === 1, 'primera pelea después de t5; la bestia después de Villa; el Núcleo después de Ciudad; faro y abordaje después de Gran Ciudad', chain);
  ok(chain.auto, 'la primera pelea se cobra sola, con la línea de Vera');
  const q1 = await run(`const s = store.state; s.quests.done = { t1: 1, t2: 1, t3: 1, t4: 1, t5: 1 }; s.combat = { wins: {}, losses: {}, retreats: {} };
    const a = Q.mainQuest(); s.combat.wins.bosque_claro = 1; const b = Q.mainQuest(); return { a: a.id, ad: a.done, b: b.id, bd: b.done, type: a.goal.type };`);
  ok(q1.a === 'q_combate' && !q1.ad && q1.type === 'combat', 'después de la salida corta, la misión es ganar la primera pelea', q1);
  ok(q1.bd, 'ganar una pelea la cumple (cuenta las victorias guardadas)', q1);
  const q2 = await run(`const s = store.state; const { MAIN_QUESTS } = await import('/src/core/data.js');
    s.quests.done = {}; for (const m of MAIN_QUESTS) { if (m.id === 'q_bestia') break; s.quests.done[m.id] = 1; }
    const b = Q.mainQuest(); const out = { b: b.id, bd: b.done }; s.combat.wins.banado_bestia = 1; out.bd2 = Q.mainQuest().done;
    s.quests.done.q_bestia = 1; for (const m of MAIN_QUESTS) { if (m.id === 'q_nucleo') break; s.quests.done[m.id] = 1; }
    const before = Q.mainQuest(); out.a = before.id; out.ad = before.done; out.act = (await import('/src/scenes/panels-common.js')).goalAction(ctx, before.goal, () => {})?.label;
    s.story.elements = [...new Set([...(s.story.elements || []), 'raiz'])]; out.ad2 = Q.mainQuest().done;
    s.quests.done.q_nucleo = 1; for (const m of MAIN_QUESTS) { if (m.id === 'q_faro') break; s.quests.done[m.id] = 1; }
    const f = Q.mainQuest(); out.f = f.id; out.fd = f.done; s.story.flags.faro = Date.now(); out.fd2 = Q.mainQuest().done;
    s.quests.done.q_faro = 1; const ab = Q.mainQuest(); out.ab = ab.id; out.abd = ab.done; s.combat.wins.costa_capitana = 1; out.abd2 = Q.mainQuest().done;
    // vuelta atrás para lo que sigue
    s.story.elements = s.story.elements.filter(e => e !== 'raiz'); delete s.story.flags.faro; s.combat = { wins: { bosque_claro: 1 }, losses: {}, retreats: {} };
    s.quests.done = { t1: 1, t2: 1, t3: 1, t4: 1, t5: 1, q_combate: 1 };
    return out;`);
  ok(q2.a === 'q_nucleo' && !q2.ad && q2.ad2 && q2.act === 'Expedición', 'encontrá el Núcleo de Raíz: lleva a la Expedición y se cumple con el elemento', q2);
  ok(q2.b === 'q_bestia' && !q2.bd && q2.bd2, 'el jefe del Bañado: se cumple al vencer a la bestia', q2);
  ok(q2.f === 'q_faro' && !q2.fd && q2.fd2 && q2.ab === 'q_abordaje' && !q2.abd && q2.abd2, 'el faro y el abordaje cierran la cadena del Acto 1', q2);

  // ===================================================================
  section('La bestia del Bañado en la poza honda');
  for (const id of ['casa_exp']) if (!(await run(`return store.state.city.buildings.some(b => b.id === '${id}')`))) await place(id);
  await run(`store.state.city.buildings.find(b => b.id === 'castillo').level = 2; return true;`);
  ok(await run(`return A.lairFor(store.state, 'banado') === null`), 'antes del rango 3 la bestia no espera');
  await run(`store.state.city.buildings.find(b => b.id === 'castillo').level = 5; return true;`);
  ok(await run(`return A.lairFor(store.state, 'banado') === 'banado_bestia' && A.lairFor(store.state, 'bosque') === null`), 'desde el rango 3 (El agua que respira) espera en el Bañado, y en ningún otro lado');
  await run(`store.state.combat.losses.banado_bestia = 1; return true;`);
  const lair = await run(`const s = store.state; s.prov = Math.max(s.prov || 0, 60);
    const r = X.startExpedition({ region: 'banado', kind: 'normal' });
    if (r.error) return { error: r.error };
    const run = r.run, i = run.cells.findIndex(c => c.content === 'enemigo' && c.boss);
    const c = run.cells[i]; const maxD = Math.max(...run.cells.filter(x => !x.band).map(x => x.depth));
    const b = XR.makeBattle(run, 'banado_bestia', i % run.w, (i / run.w) | 0);
    const opts = (() => { run.pos = [i % run.w, (i / run.w) | 0]; return null; })();
    const out = { sub: c?.sub, depth: c?.depth, maxD, n: run.cells.filter(x => x.content === 'enemigo' && x.sub === 'banado_bestia').length, attempt: b.attempt, name: run.boss?.name };
    X.expState(s).active = null; s.expedition.active = null;
    return out;`);
  ok(lair.sub === 'banado_bestia' && lair.n === 1 && lair.depth >= 7, 'la salida normal al Bañado tiene a la bestia en una casilla del fondo (banda lejana)', lair);
  ok(lair.name === 'la poza honda', 'el lugar se llama la poza honda', lair);
  ok(lair.attempt === 2, 'una derrota de antes suma un intento de revancha', lair);
  ok(await run(`return !(await import('/src/combat/combat-rules.js')).canQuickResolve('banado_bestia', 5)`), 'contra un jefe no hay resolución rápida');
  ok(await waitStory('.st-card[data-scene="poza"]', 12000), 'Vera avisa de la poza honda y de pelear en alto');
  await drainStory(2500);
  // perder y ganar
  await run(`X.creditFight({ region: 'banado', party: ['cazador', 'forjador', 'curandero'], mods: { escort: [] } }, { enc: 'banado_bestia', outcome: 'lose', reason: 'grupo', turns: 7, xp: 24 }); return true;`);
  ok(await waitStory('.st-card[data-scene="bestia_lost"]', 12000), 'perder: Vera da la clave de la revancha');
  await drainStory(2500);
  await run(`X.creditFight({ region: 'banado', party: ['cazador', 'forjador', 'curandero'], mods: { escort: [] } }, { enc: 'banado_bestia', outcome: 'win', turns: 8, stars: 2, xp: 80, page: 'p9', flag: 'bestia_vencida' }); return true;`);
  ok(await waitStory('.st-epic', 12000), 'ganar: escena a pantalla completa de la bestia');
  await shot('3-bestia-vencida');
  const won = await run(`const s = store.state; return { flag: !!s.story.flags.bestia_vencida, p9: !!s.story.pages.p9, lair: A.lairFor(s, 'banado'), page: SD.PAGE_BY_ID.p9?.title, reward: (await import('/src/combat/combat-data.js')).ENCOUNTERS.banado_bestia.reward.page };`);
  ok(won.flag && won.p9 && won.lair === null && won.reward === 'p9', 'deja la marca, la página 9 (La Madre del Agua) y ya no espera', won);
  await drainStory(3000);

  // ===================================================================
  section('Los jefes en low-poly');
  const bm = await run(`const B = await import('/src/combat/boss-models.js');
    const a = B.bossModel('bestia'), c = B.bossModel('capitana'), n = B.bossModel('lobo');
    let tris = 0; a.traverse(o => { if (o.isMesh) tris += o.geometry.attributes.position.count / 3; });
    a.userData.update(0.016, false, 1); a.userData.setPhase(1); a.userData.update(0.016, false, 1.2); c.userData.setPhase(1); c.userData.update(0.5, false, 2);
    return { lp: a.userData.lowpoly && c.userData.lowpoly, ha: a.userData.height, hc: c.userData.height, none: n === null, tris, types: B.BOSS_TYPES };`);
  ok(bm.lp && bm.none && bm.types.join() === 'bestia,capitana', 'bossModel arma la bestia y la capitana (y nada para los demás)', bm);
  const one = await run(`const EM = await import('/src/combat/enemy-models.js'); const g = EM.enemyModel('bestia'); return { lp: !!g.userData.lowpoly, name: g.name, types: EM.ENEMY_MODEL_TYPES.includes('bestia') };`);
  ok(one.lp && one.name === 'boss:bestia' && one.types, 'una sola bestia: enemyModel("bestia") entrega la de boss-models (la galería y el combate ven la misma)', one);
  ok(bm.ha > 1.2 && bm.hc > 1.4 && bm.hc < 2.4 && bm.tris > 400, 'tienen tamaño de jefe y caras facetadas', bm);
  await page.goto(`${BASE}?scene=combat&enc=banado_bestia&seed=3&level=5&element=raiz&nosplash&nosw`, { waitUntil: 'load' });
  ok(await waitFor(`!!document.querySelector('.cb-top, .cb-hud, [class*="cb-"]')`, 25000), 'la pelea contra la bestia abre con el modelo nuevo');
  await sleep(2500);
  await shot('1-bestia');
  await page.goto(`${BASE}?scene=combat&enc=costa_capitana&seed=3&level=7&element=raiz&hour=20&nosplash&nosw`, { waitUntil: 'load' });
  ok(await waitFor(`!!document.querySelector('[class*="cb-"]')`, 25000), 'la pelea contra la capitana abre');
  await sleep(2500);
  await shot('2-capitana');

  // ===================================================================
  section('El faro viejo de la Costa');
  ok(await goCity(), 'vuelve a la ciudad');
  await run(`store.save = () => {}; return true;`);
  await drainStory(2500);
  await place('casa_exp');
  ok(await run(`const s = store.state; s.city.buildings.find(b => b.id === 'castillo').level = 5; return !A.faroDue(s, 'costa')`), 'con rango 5 todavía no hay faro');
  const faro = await run(`const s = store.state; s.city.buildings.find(b => b.id === 'castillo').level = 6; s.prov = Math.max(s.prov || 0, 60);
    const due = A.faroDue(s, 'costa'), other = A.faroDue(s, 'banado');
    const r = X.startExpedition({ region: 'costa', kind: 'normal' });
    if (r.error) return { error: r.error };
    const o = r.run.objective, c = r.run.cells[o.cell[1] * r.run.w + o.cell[0]];
    const info = { due, other, name: o.name, faro: o.faro, cell: c.content === 'objetivo' && c.faro === true, mina: !!o.mina };
    r.run.objectiveDone = true; r.run.objective.done = true; r.run.ended = true; r.run.reason = 'volvio';
    const sum = X.finishExpedition(r.run);
    return { ...info, lit: sum.faro, flag: !!s.story.flags.faro, at: A.abordajeState(s).at - s.story.flags.faro, st: A.abordajeStatus(s) };`);
  ok(faro.due && !faro.other && faro.name === 'el faro viejo' && faro.faro && faro.cell && !faro.mina, 'desde el rango 6, la salida normal a la Costa va al faro viejo', faro);
  ok(faro.lit && faro.flag, 'volver con el objetivo cumplido lo enciende (story.flags.faro)', faro);
  ok(faro.st === 'waiting' && faro.at === 15 * 60e3, 'el abordaje queda en camino: llega 15 minutos después', faro);
  ok(await waitStory('.st-epic', 15000), 'escena a pantalla completa: el haz del faro y las luces que contestan');
  await shot('4-faro');
  await drainStory(3000);
  ok(await run(`return store.state.story.chapter === 'abordaje'`), 'se abre el capítulo Velas en el cielo');
  ok(await run(`return !A.faroDue(store.state, 'costa')`), 'encendido, la Costa vuelve a sus objetivos de siempre');

  // ===================================================================
  section('Velas en el cielo: el abordaje');
  await run(`A.rushAbordaje(); return true;`);
  ok(await run(`return A.abordajeStatus() === 'ready' && !!store.state.story.abordaje.arrived`), 'llega el dirigible (abordaje:arrive)');
  ok(await waitStory('.st-epic', 15000), 'escena a pantalla completa de la llegada');
  await page.keyboard.press('Escape'); await sleep(500);
  ok(await waitFor(`!!document.querySelector('.ab-modal')`, 12000), 'después de la escena se abre la tarjeta del abordaje');
  const card = await page.evaluate(() => document.querySelector('.ab-modal')?.textContent || '');
  ok(/Defienden/.test(card) && /pasarela/.test(card) && /No se llevan nada/.test(card), 'la tarjeta dice quién defiende, la pasarela y que perder no cuesta lo guardado', card.slice(0, 200));
  ok(await run(`return !!window.__pixelia.city.act1.ship`), 'el dirigible queda amarrado al borde de la isla');
  ok(await page.evaluate(() => { const b = document.querySelector('.act1-alert'); return !!b && b.style.display !== 'none'; }), 'y hay un botón a la vista para defender');
  await shot('5-abordaje-tarjeta');
  await click('.ab-modal .modal-x, .ab-modal .btn.ghost');
  await sleep(400);
  // la tarjeta ya llevó la cámara hacia el borde donde está amarrado el dirigible
  await sleep(1800);
  const vis = await run(`const c = window.__pixelia.city, s = c.act1.ship; const p = s.position.clone(); p.y += 1.4;
    const sc = c.ov.project(p, {}); const el = document.elementFromPoint(sc.x, sc.y);
    return { x: Math.round(sc.x), y: Math.round(sc.y), w: innerWidth, h: innerHeight, tag: el?.tagName, cls: el?.className?.baseVal ?? el?.className };`);
  ok(vis.x > 0 && vis.x < vis.w && vis.y > 0 && vis.y < vis.h && vis.tag === 'CANVAS', 'el dirigible queda en pantalla, sin tarjetas del HUD encima', vis);
  await shot('6-dirigible');
  // la pelea en la ciudad
  await run(`bus.emit('abordaje:panel'); return true;`);
  ok(await waitFor(`!!document.querySelector('.ab-modal [data-abordaje="go"]')`, 5000), 'la tarjeta se vuelve a abrir desde el botón');
  await click('.ab-modal [data-abordaje="go"]');
  ok(await waitFor(`window.__pixelia?.ctx.router.current === 'combat'`, 15000), 'Defender el borde abre la pelea');
  const bt = await page.evaluate(() => { const c = document.querySelector('#app, body').querySelector('*') && [...document.querySelectorAll('*')].find(e => e.__combat)?.__combat; const b = c?.battle; return b ? { enc: b.enc, ab: b.abordaje, att: b.attempt, allies: b.units.filter(u => u.side === 'ally').map(u => u.type) } : null; });
  ok(bt && bt.enc === 'costa_capitana' && bt.ab && bt.allies.length === 4 && bt.allies[0] === 'lider', 'contra la capitana, con quien lidera y tres de la ciudad', bt);
  await sleep(1500);
  await shot('7-abordaje-pelea');
  // retirarse: vuelve a la ciudad y el dirigible sigue
  await page.keyboard.press('Escape');
  await waitFor(`!!document.querySelector('[data-a="retreat"]')`, 5000);
  await click('[data-a="retreat"]'); await sleep(300); await click('[data-a="yes"]');
  ok(await waitFor(`!!document.querySelector('[data-a="go"]')`, 15000), 'retirarse muestra el resultado (sin "Revancha" ahí: se vuelve a la ciudad)');
  ok(!(await has('[data-a="retry"]')), 'sin botón de reintentar dentro de la pelea');
  await click('[data-a="go"]');
  ok(await waitFor(`window.__pixelia?.ctx.router.current === 'city'`, 15000), 'vuelve a la ciudad');
  await run(`store.save = () => {}; return true;`);
  ok(await run(`return A.abordajeStatus() === 'ready' && store.state.story.abordaje.tries === 1 && (store.state.combat.retreats.costa_capitana || 0) === 1`), 'el dirigible sigue en el borde; la retirada queda contada');
  // perder deja revancha
  await run(`A.creditAbordaje({ enc: 'costa_capitana', outcome: 'lose', reason: 'grupo', turns: 9, xp: 30, loot: { mats: {} } }, null, store.state, X.creditFight); return true;`);
  ok(await run(`return A.bossAttempt(store.state, 'costa_capitana') === 2 && A.abordajeStatus() === 'ready'`), 'perder: la próxima pelea es revancha (intento 2) y siguen esperando');
  ok(await waitStory('.st-card[data-scene="abordaje_lost"]', 12000), 'Vera: no se van a ir solos');
  await drainStory(2500);
  ok(await run(`return A.abordajeBattle(store.state).attempt === 2`), 'la pelea de revancha arranca con el intento 2');
  // ganar cierra el Acto 1
  const mats0 = await run(`return { ...store.state.materials }`);
  await run(`A.creditAbordaje({ enc: 'costa_capitana', outcome: 'win', turns: 10, stars: 2, xp: 100, page: 'p8', flag: 'capitana_vencida', loot: { mats: { mineral: 3, madera: 3 } } }, null, store.state, X.creditFight); return true;`);
  const fin = await run(`const s = store.state; return { st: A.abordajeStatus(s), flag: !!s.story.flags.capitana_vencida, p8: !!s.story.pages.p8, won: !!s.story.abordaje.won, mineral: s.materials.mineral };`);
  ok(fin.st === 'done' && fin.flag && fin.p8 && fin.won, 'ganar: la marca, la página 8 (La llave) y el abordaje resuelto', fin);
  ok(fin.mineral === (mats0.mineral || 0) + 3, 'el botín entra al depósito de la ciudad', { before: mats0.mineral, after: fin.mineral });
  ok(await waitStory('.st-epic', 15000), 'escena del cierre del Acto 1 a pantalla completa');
  await sleep(600);
  await shot('8-fin-acto1');
  ok(await run(`return SD.SCENE_BY_ID.acto1_2.lines.includes('…') && /Cofradía/.test(SD.SCENE_BY_ID.acto1_2.lines[0])`), 'el sello de la Cofradía y otro silencio de Vera (L2, L4)');
  await drainStory(4000);
  ok(await run(`return store.state.story.chapter === 'cierre'`), 'capítulo final: Las islas te vieron');
  ok(await waitFor(`!window.__pixelia.city.act1.ship`, 4000), 'el dirigible se va');

  // ===================================================================
  section('Ecos de noche');
  await run(`const s = store.state; s.story.chapter = 'cerro'; s.story.echoes = {}; localStorage.setItem(store.SAVE_KEY || 'pixelia.save.v1', JSON.stringify(s)); return true;`);
  ok(await goCity('&hour=12'), 'la ciudad de día');
  await run(`store.save = () => {}; return true;`);
  await drainStory(2500);
  await sleep(800);
  ok(await run(`return !window.__pixelia.city.act1.echo`), 'de día no hay ecos');
  ok(await goCity('&hour=22'), 'la ciudad de noche');
  await run(`store.save = () => {}; return true;`);
  await drainStory(2500);
  ok(await waitFor(`window.__pixelia.city.act1.echo?.id === 'e_cavar'`, 6000), 'de noche aparece el primer eco en el borde de la isla');
  const fig = await run(`const g = window.__pixelia.city.r.scene.getObjectByName('act1').children.find(o => o.name.startsWith('echo:'));
    let people = 0, ghost = 0; g.traverse(o => { if (o.isMesh && o.userData.shared) { people++; if (o.material.transparent && o.material.opacity < 0.7) ghost++; } }); return { people, ghost };`);
  ok(fig.people > 10 && fig.ghost === fig.people, 'las figuras del eco son la gente del 4a (avatarModel), pintadas de fantasma', fig);
  await run(`const p = window.__pixelia.city.act1.echo.pos; window.__pixelia.city.cam.flyTo(p.x, p.z, 26); return true;`);
  await sleep(2500);
  await shot('9-eco-ciudad');
  const sp = await run(`const c = window.__pixelia.city; const p = c.act1.echo.pos.clone(); p.y = 0.45; return c.ov.project(p, {});`);
  await page.mouse.click(sp.x, sp.y);
  ok(await waitFor(`!!document.querySelector('.ec-modal')`, 5000), 'hacer clic en el eco abre su línea');
  const ecText = await page.evaluate(() => document.querySelector('.ec-modal')?.textContent || '');
  ok(/Una más/.test(ecText) && /Diario/.test(ecText), 'la línea del eco y que queda en el Diario', ecText.slice(0, 160));
  await click('.ec-modal .modal-x');
  ok(await run(`return !!store.state.story.echoes.e_cavar`), 'queda anotado (una sola vez)');
  ok(await waitFor(`window.__pixelia.city.act1.echo?.id === 'e_subir'`, 8000), 'el que se vio se desvanece y la noche siguiente toca otro');
  const rep = await run(`return EC.seeEcho('e_cavar') === null`);
  ok(rep, 'un eco visto no se repite');
  // el de la mesa del archivo deja la página 10
  const p10 = await run(`EC.seeEcho('e_subir'); const had = !!store.state.story.pages.p10; const e = EC.seeEcho('e_mapa'); return { had, now: !!store.state.story.pages.p10, page: e?.page };`);
  ok(!p10.had && p10.now && p10.page === 'p10', 'el eco de la mesa del archivo deja la página 10 (L2)', p10);
  ok(await run(`return EC.cityEcho() === null && EC.expEcho(store.state, 'cerro')?.id === 'e_permiso' && EC.expEcho(store.state, 'costa')?.id === 'e_permiso'`), 'en la ciudad ya no quedan; en la expedición sigue el de los permisos');
  ok(await run(`store.state.story.chapter = 'sierras'; const a = EC.expEcho(store.state, 'cerro'); store.state.story.chapter = 'cierre'; return a === null`), 'los ecos esperan a su capítulo');
  // en la Bitácora
  await run(`ctx.openPanel('story'); return true;`);
  await sleep(600);
  await click('[data-tab="diario"], .tab[data-id="diario"], button[data-tab="diario"]');
  await sleep(500);
  const book = await page.evaluate(() => [...document.querySelectorAll('[data-echo]')].map(e => e.dataset.echo));
  ok(book.length === 3 && book[0] === 'e_cavar', 'el Diario de la Bitácora lista los ecos vistos', book);
  await page.evaluate(() => document.querySelector('[data-echo]')?.scrollIntoView({ block: 'center' }));
  await sleep(300);
  await shot('10-bitacora-ecos');
  await closeModals();
  await page.keyboard.press('Escape');
  // en una ruina de la expedición
  await place('casa_exp');
  await run(`const s = store.state; s.prov = Math.max(s.prov || 0, 60); const r = X.startExpedition({ region: 'cerro', kind: 'normal' });
    const run = r.run; let i = run.cells.findIndex(c => c.content === 'ruina');
    if (i < 0) { i = run.cells.findIndex(c => c.content === 'vacio' && c.depth === 2); run.cells[i].content = 'ruina'; run.cells[i].sub = 'derrumbe'; }
    run.cells[i].visited = true; run.cells[i].seen = true; run.cells[i].done = true;
    localStorage.setItem(store.SAVE_KEY || 'pixelia.save.v1', JSON.stringify(s)); return i;`);
  await page.goto(`${BASE}?scene=expedition&nosplash&nosw&echo=1`, { waitUntil: 'load' });
  ok(await waitFor(`!![...document.querySelectorAll('*')].find(e => e.__exp)?.__exp?.echo`, 20000), 'en una ruina ya pisada aparece el eco de los permisos');
  const xe = await page.evaluate(() => [...document.querySelectorAll('*')].find(e => e.__exp)?.__exp?.echo);
  ok(xe?.id === 'e_permiso', 'es el de los permisos (L4)', xe);
  await sleep(1500);
  await shot('11-eco-expedicion');

  // ===================================================================
  section('E6: la primera expedición, guiada');
  await page.goto(`${BASE}?scene=city&reset&nosplash&nosw&cheat=15`, { waitUntil: 'load' });
  ok(await waitFor(`window.__pixelia?.ctx.router.current === 'city'`, 25000), 'partida nueva');
  await run(`store.save = () => {}; store.state.onboarded = true; return true;`);
  await place('casa_exp');
  const g0 = await run(`const s = store.state; s.stats.expeditions = 0; X.expState(s).tutorialShort = false; X.expState(s).freeDay = null;
    const r = X.startExpedition({ region: 'bosque', kind: 'corta' }); if (r.error) return { error: r.error };
    const G = await import('/src/expedition/exp-guide.js');
    return { tut: !!r.run.city.tutorial, seed: r.run.seed, guided: G.guidedRun(r.run, s), ids: G.EXP_GUIDE_IDS };`);
  ok(g0.tut && g0.seed === 110 && g0.guided, 'la salida corta del tutorial (TUTORIAL_SEED) va guiada', g0);
  ok(g0.ids?.length === 7, 'siete pistas: moverse, juntar, un imprevisto, el paso sin vuelta, el objetivo, volver y la carga llena', g0.ids);
  await run(`ctx.router.go('expedition', { resume: true }); return true;`);
  const xs = () => page.evaluate(() => [...document.querySelectorAll('*')].find(e => e.__exp)?.__exp);
  ok(await waitFor(`!![...document.querySelectorAll('*')].find(e => e.__exp)?.__exp?.guide?.text`, 20000), 'Vera aparece abajo a la derecha con la primera pista');
  const t1 = await page.evaluate(() => [...document.querySelectorAll('*')].find(e => e.__exp).__exp.guide.text);
  ok(/casilla vecina/.test(t1) && /provisiones/.test(t1), 'la primera: cómo moverse y lo que cuesta', t1);
  ok(await has('.ex-guide canvas') && await has('.ex-guide [data-a="ok"]'), 'con su retrato y un botón Entendido');
  await shot('12-expedicion-guiada');
  ok(await run(`return !!store.state.tutorial.expTips.start`), 'queda anotada (una sola vez)');
  // dar un paso hacia una casilla con algo para juntar
  const step = await page.evaluate(() => { const x = [...document.querySelectorAll('*')].find(e => e.__exp).__exp; const v = x.view, run = x.raw();
    const mv = v.moves.filter(m => m.ok).sort((a, b) => (run.cells[b.y * run.w + b.x].content === 'recurso') - (run.cells[a.y * run.w + a.x].content === 'recurso'))[0];
    x.move(mv.x, mv.y); return { x: mv.x, y: mv.y, content: run.cells[mv.y * run.w + mv.x].content }; });
  await waitFor(`![...document.querySelectorAll('*')].find(e => e.__exp)?.__exp?.busy`, 8000);
  await sleep(800);
  const t2 = await run(`return { tips: Object.keys(store.state.tutorial.expTips), loot: !!store.state.tutorial.expTips.loot }`);
  ok(step.content !== 'recurso' || t2.loot, 'juntar algo trae la pista de la carga', { step, t2 });
  // en otra salida no se repite lo visto
  const g1 = await run(`const G = await import('/src/expedition/exp-guide.js'); const s = store.state;
    const daily = G.guidedRun({ kind: 'corta', city: { daily: 3 } }, s); s.stats.expeditions = 5; const later = G.guidedRun({ kind: 'normal', city: {} }, s);
    return { daily, later };`);
  ok(!g1.daily && !g1.later, 'la Expedición del día y las salidas de después no van guiadas', g1);

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
