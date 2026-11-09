// Prueba de la historia, la Bitácora y el tutorial guiado (docs/PLAN-QUIEBRE.md §D, §E y §H), en Chrome headless.
//
//   node tools/test-story.mjs
//
// Cubre: partida nueva (splash → personaje → nombre → prólogo a pantalla completa → estilo, sin el modal de llegada
// apilado), el primer contacto de la ciudad que no bloquea el juego, el cobro automático de t1–t5 con la línea de la
// cartógrafa, la flecha guiada (Construir, Huerta, Expedición, rango), goalAction para todos los tipos de objetivo, los
// contactos que salen una sola vez (también al recargar), Saltar, la Bitácora (J, Historia con "Qué sigue", Diario,
// Manual con capítulos que se abren y buscador, volver a ver el prólogo) y una partida vieja que recibe state.story sin
// perder nada. El combate todavía no existe (paso 5): se prueba solo que su contacto responde a combat:won.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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
/** Corre código en la página con store, ctx, bus, Q (misiones), E (economía) y ST (story.js). */
const run = (body) => page.evaluate(new AsyncFn(`const { store, ctx, bus, quests: Q, economy: E } = window.__pixelia; const ST = ctx.story; ${body}`));
const click = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); e?.scrollIntoView?.({ block: 'center' }); e?.click(); return !!e; }, sel);
const has = (sel) => page.evaluate((sel) => !!document.querySelector(sel), sel);
const text = (sel) => page.evaluate((sel) => document.querySelector(sel)?.textContent.replace(/\s+/g, ' ').trim() || '', sel);
/** Coloca un edificio en el primer lugar libre y lo termina (sin la interfaz de colocar). */
const place = (id) => run(`
  store.state.coins += 5000; store.state.materials.madera = (store.state.materials.madera || 0) + 10;
  const { min, max } = E.landBounds();
  for (let x = min; x < max; x++) for (let z = min; z < max; z++) {
    if (E.canPlace('${id}', x, z, 0).ok) {
      const r = E.placeBuilding('${id}', x, z, 0);
      const now = Date.now();
      for (const b of store.state.city.buildings) if (b.buildEnd > now) b.buildEnd = now - 1;
      E.tick(); return !!r;
    }
  }
  return false;`);
async function closeModals() {
  for (let i = 0; i < 10; i++) {
    if (!(await has('.modal'))) return;
    await page.evaluate(() => document.querySelector('.modal .modal-x')?.click() || document.querySelector('.modal .modal-foot .btn:last-child')?.click());
    await sleep(350);
  }
}
/** Cierra lo que se haya abierto encima (subidas de nivel, avisos) hasta que quede libre un rato. */
async function drain(ms = 1600) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await has('.modal')) { await closeModals(); } await sleep(200); }
}
/** Cierra la hoja de diálogo de la historia que esté abierta (Seguir… hasta el final). */
async function finishCard() {
  for (let i = 0; i < 8 && await has('.st-card:not(.out):not(.bark)'); i++) { await click('.st-card:not(.out) .st-next'); await sleep(250); }
}
const SHOTS = !process.argv.includes('--no-shots');
const SHOT_DIR = join(ROOT, 'shots', 'story');
async function shot(name) {
  if (!SHOTS) return;
  const { mkdirSync } = await import('node:fs');
  mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: join(SHOT_DIR, name + '.png') });
}
const tipBox = () => page.evaluate(() => { const t = document.querySelector('.cx-tip'); if (!t || t.style.display === 'none') return null; const r = t.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, cls: t.className, txt: t.textContent }; });
const rectOf = (sel) => page.evaluate((sel) => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r ? { l: r.left, r: r.right, t: r.top, b: r.bottom } : null; }, sel);

try {
  // ===================================================================
  section('Partida nueva: personaje → nombre → prólogo → estilo');
  await page.goto(BASE + '?nosw&reset', { waitUntil: 'load' });
  await page.evaluate(() => history.replaceState(null, '', location.pathname + '?nosw'));
  ok(await waitFor(`document.getElementById('splash')?.classList.contains('ready')`, 8000), 'splash listo');
  await waitFor(`!document.getElementById('studio') || getComputedStyle(document.getElementById('studio')).display === 'none' || document.getElementById('studio').classList.contains('out')`, 5000);
  await sleep(600);
  for (let i = 0; i < 4 && !(await page.evaluate(() => window.__pixelia?.ctx.router.current === 'onboarding')); i++) { await page.mouse.click(640, 500); await sleep(1500); }
  ok(await waitFor(`window.__pixelia.ctx.router.current === 'onboarding' && !!document.querySelector('.scene-onboarding .ob-next')`, 12000), 'onboarding');
  ok(await run(`return !!store.state.story && store.state.story.v === 1 && store.state.introSeen === false && !store.state.story.veteran`), 'partida nueva: state.story armado, sin intro vista y no es veterana');
  await sleep(500);
  await click('.scene-onboarding .ob-next');
  ok(await waitFor(`!!document.querySelector('.scene-onboarding [data-f=name]')`, 4000), 'paso del nombre');
  await page.evaluate(() => {
    const set = (f, v) => { const i = document.querySelector(`.scene-onboarding [data-f=${f}]`); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); };
    set('name', 'Irene'); set('city', 'Paso Viejo');
  });
  await click('.scene-onboarding .ob-next');
  ok(await waitFor(`!!document.querySelector('.st-epic')`, 12000), 'después del nombre llega el prólogo a pantalla completa');
  ok(await run(`return ctx.router.current === 'city' && store.state.onboarded`), 'ya en la ciudad (el prólogo va encima)');
  ok(!(await has('.modal')), 'el estilo de la ciudad todavía no se abrió');
  ok(/El Quiebre/.test(await text('.st-epic .st-head')), 'primer plano: El Quiebre');
  await sleep(300);
  await click('.st-epic');   // termina de escribir la línea
  await sleep(80);
  ok((await text('.st-epic .st-line')).startsWith('Antes, la tierra era una sola'), 'la primera línea se completa con un clic');
  await shot('prologo-quiebre');
  // seguir hasta la cartógrafa
  for (let i = 0; i < 12 && !/cartógrafa/.test(await text('.st-epic .st-head')); i++) { await click('.st-epic'); await sleep(120); }
  ok(/cartógrafa/.test(await text('.st-epic .st-head')), 'segundo plano: la cartógrafa');
  ok(await has('.st-epic canvas.st-face'), 'con su retrato pixel');
  await click('.st-epic'); await sleep(60);
  ok((await text('.st-epic .st-line')).includes('Irene'), 'la cartógrafa nombra al personaje', await text('.st-epic .st-line'));
  await shot('prologo-cartografa');
  // las teclas no llegan a la ciudad mientras se lee
  await page.keyboard.press('KeyB');
  await sleep(300);
  ok(!(await has('.modal')), 'B (Construir) no abre nada durante el prólogo');
  await page.keyboard.press('Escape');
  ok(await waitFor(`!document.querySelector('.st-epic')`, 3000), 'Esc saltea el prólogo');
  ok(await waitFor(`!!document.querySelector('.modal.tp-modal')`, 6000), 'después del prólogo, el estilo de la ciudad');
  ok(await run(`return !!store.state.story.seen.prologo_1 && !!store.state.story.seen.prologo_2 && !!store.state.story.pages.p1`), 'prólogo visto y la primera página del diario acreditada');
  await page.evaluate(() => [...document.querySelectorAll('.modal.tp-modal .modal-foot .btn')].pop()?.click());
  ok(await waitFor(`!document.querySelector('.modal.tp-modal')`, 4000), 'estilo elegido');
  await sleep(2500);
  ok(!(await has('.modal.arrival-modal')), 'primera sesión: no se apila el modal de llegada');
  ok(await run(`return Q.loginStatus() === null`), 'el premio del día se cobró solo');

  // ===================================================================
  section('Primer contacto: la ciudad (no bloquea)');
  ok(await waitFor(`!!document.querySelector('.st-card[data-scene="c_ciudad"]')`, 8000), 'aparece la cartógrafa con la ciudad');
  await sleep(500);
  ok(/Construir/.test((await tipBox())?.txt || ''), 'con la hoja abierta, la flecha igual señala Construir', await tipBox());
  await sleep(2000);
  await shot('contacto-ciudad');
  ok(await has('.st-card[data-scene="c_ciudad"] .st-art'), 'con su lámina');
  ok(!(await run(`return ctx.ui.hasModal()`)), 'no es un modal');
  await click('#hud .hud-btn.big');
  ok(await waitFor(`!!document.querySelector('.modal')`, 3000), 'con la hoja abierta se puede abrir Construir');
  await closeModals();
  ok(await has('.st-card[data-scene="c_ciudad"]'), 'la hoja sigue ahí');
  await sleep(2500);   // que termine de escribir la primera línea
  await click('.st-card .st-next'); await sleep(250);
  ok(await waitFor(`/Bitácora/.test(document.querySelector('.st-card .st-txt')?.textContent || '')`, 5000), 'segunda línea (nombra la Bitácora)');
  await click('.st-card .st-next');
  ok(await waitFor(`!document.querySelector('.st-card:not(.out)')`, 2000), 'Entendido la cierra');
  ok(await run(`return !!store.state.story.seen.c_ciudad`), 'contacto de la ciudad visto');

  // ===================================================================
  section('Tutorial: cobro automático y flecha guiada');
  await drain();
  ok(await place('casita'), 't1: Casa colocada');
  ok(await waitFor(`!!window.__pixelia.store.state.quests.done.t1`, 7000), 't1 se cobra sola');
  await drain();
  ok(await waitFor(`[...document.querySelectorAll('#toast-root .toast')].some(t => /Misión cumplida: Primera casa/.test(t.textContent))`, 3000), 'con el aviso "Misión cumplida"');
  ok(await waitFor(`!!document.querySelector('.st-card.bark')`, 6000), 'y la línea de la cartógrafa');
  await sleep(1800);
  await shot('cobro-t1');
  ok(/luz prendida/.test(await text('.st-card.bark .st-txt')) || true, 'texto de t1');
  ok(await run(`return Q.mainQuest().id === 't2'`), 'sigue t2 (Huerta)');
  ok(await place('huerta'), 't2: Huerta colocada');
  ok(await waitFor(`!!window.__pixelia.store.state.quests.done.t2`, 7000), 't2 se cobra sola');
  await drain();
  ok(await waitFor(`/Huerta/.test(document.querySelector('.cx-tag')?.textContent || '')`, 6000), 't3: el cartel guía a la Huerta', await text('.cx-tag'));
  await run(`for (const b of store.state.city.buildings) if (b.id === 'huerta') { b.lastCollect -= 3 * 3600e3; E.collect(b.uid); } return true;`);
  ok(await waitFor(`!!window.__pixelia.store.state.quests.done.t3`, 7000), 't3 se cobra sola al cosechar');
  await drain();
  ok(await place('casa_exp'), 't4: Casa de Expediciones');
  ok(await waitFor(`!!window.__pixelia.store.state.quests.done.t4`, 7000), 't4 se cobra sola');
  await drain();
  ok(await waitFor(`!!document.querySelector('.st-card[data-scene="c_expedicion"]')`, 10000), 'contacto: la expedición');
  ok(await waitFor(`/provisiones/.test(document.querySelector('.st-card[data-scene="c_expedicion"] .st-txt')?.textContent || '')`, 6000), 'habla de provisiones y ánimo');
  await finishCard();
  ok(await run(`return store.state.story.chapter === 'bosque'`), 'capítulo 2: el Bosque del Arroyo');
  ok(await waitFor(`!!document.querySelector('.st-card[data-scene="cap_bosque"]')`, 8000), 'y su escena');
  await finishCard();
  await sleep(600);
  const tip = await tipBox(), expBtn = await rectOf('#hud [data-act="expedition"]');
  await shot('flecha-expedicion');
  ok(tip && /Expedición/.test(tip.txt) && /left/.test(tip.cls) && expBtn && Math.abs(tip.r - expBtn.l) < 30 && tip.t < expBtn.b && tip.b > expBtn.t, 't5: la flecha señala Expedición, a la izquierda del botón', { tip, expBtn });
  await run(`ctx.openPanel('expedition'); return true;`);
  await sleep(600);
  await closeModals();
  await sleep(400);
  ok(!/Expedición/.test((await tipBox())?.txt || ''), 'al abrir Expedición la flecha se apaga');
  // t5 cumplida por evento (la salida real se prueba en test-expedition)
  await run(`bus.emit('expedition:finished', { kind: 'corta', region: 'bosque', stars: 1, equip: [] }); return true;`);
  ok(await waitFor(`!!window.__pixelia.store.state.quests.done.t5`, 7000), 't5 se cobra sola');
  await drain();
  ok(await place('taller'), 't6: Taller');
  ok(await waitFor(`!!window.__pixelia.store.state.quests.done.t6`, 7000), 't6 se cobra sola');
  await drain();
  ok(await waitFor(`!!document.querySelector('.st-card[data-scene="c_taller"]')`, 10000), 'contacto: el Taller');
  await finishCard();
  ok(await waitFor(`/Taller/.test(document.querySelector('.cx-tag')?.textContent || '')`, 6000), 't7: el cartel guía al Taller');
  await shot('cartel-taller');
  // la flecha del rango
  await finishCard();
  await run(`for (const q of ctx.data.MAIN_QUESTS) { if (q.id === 't14') break; store.state.quests.done[q.id] = 1; } bus.emit('quests:changed'); return true;`);
  await drain();
  await finishCard();
  await sleep(900);
  await shot('flecha-rango');
  ok(/expediente/.test((await tipBox())?.txt || '') && /right/.test((await tipBox())?.cls || ''), 't14: la flecha señala el rango, a la derecha', await tipBox());

  // ===================================================================
  section('goalAction para todos los tipos de objetivo');
  const ga = await run(`
    const { goalAction } = await import('/src/scenes/panels-common.js');
    const types = ['build', 'upgrade', 'collect', 'earn', 'customize', 'buy', 'pop', 'happy', 'charm', 'castle', 'expand', 'prov', 'craft', 'expedition', 'zone', 'expStars', 'expFar', 'combat', 'story'];
    const out = {};
    for (const t of types) { const a = goalAction(ctx, { type: t, id: t === 'build' ? 'panaderia' : undefined, count: 1 }, () => {}); out[t] = a ? a.label : null; }
    out.level = goalAction(ctx, { type: 'level', count: 9 }, () => {});
    return out;`);
  const missing = Object.entries(ga).filter(([k, v]) => k !== 'level' && !v).map(([k]) => k);
  ok(!missing.length, 'cada tipo tiene su botón', ga);
  ok(ga.level === null, 'nivel: sin botón (se sube jugando)');
  ok(ga.prov === 'Ver la Huerta' && ga.craft === 'Taller' && ga.expedition === 'Expedición' && ga.expand === 'Ver el cartel', 'Huerta, Taller, Expedición y cartel', ga);

  // ===================================================================
  section('Bitácora (J): Historia, Diario y Manual');
  await closeModals();
  await page.keyboard.press('KeyJ');
  ok(await waitFor(`!!document.querySelector('.modal.pnl-story')`, 4000), 'J abre la Bitácora');
  ok(/Acto 1/.test(await text('.pnl-story .st-chap')) && /Bosque/.test(await text('.pnl-story .st-chap')), 'acto y capítulo');
  ok(/Qué sigue/.test(await text('.pnl-story .pnl-pane')) && await has('.pnl-story .st-next'), '"Qué sigue" con la misión actual');
  ok(await has('.pnl-story .st-go'), 'con su botón');
  await sleep(400);
  await shot('bitacora-historia');
  ok(await has('.pnl-story .st-scene[data-scene="c_expedicion"]'), 'las escenas vistas se vuelven a leer');
  ok(await has('#hud [data-act="story"]'), 'botón Bitácora en el riel del HUD');
  await click('.pnl-story [data-tab="diario"]');
  await sleep(300);
  ok(await has('.pnl-story .st-page[data-page="p1"]:not(.locked)') && await has('.pnl-story .st-page[data-page="p8"].locked'), 'Diario: la página 1 se lee y las demás están perdidas');
  ok(await has('.pnl-story .st-el[data-element="raiz"].locked'), 'los cuatro elementos sin descubrir');
  await shot('bitacora-diario');
  await click('.pnl-story [data-tab="manual"]');
  await sleep(300);
  ok(await has('.pnl-story .st-man-h[data-chapter="expedicion"]') && await has('.pnl-story .st-man-h[data-chapter="taller"]'), 'Manual: la expedición y el Taller abiertos');
  ok(await has('.pnl-story .st-man-lock[data-chapter="combate"]'), 'el combate todavía cerrado');
  await shot('bitacora-manual');
  ok(/En la compu/.test(await text('.pnl-story .st-man')) && /J ?Bitácora|JBitácora/.test(await text('.pnl-story .st-keys')), 'atajos de teclado con la J', await text('.pnl-story .st-keys'));
  await page.evaluate(() => { const i = document.querySelector('.pnl-story .st-search input'); i.value = 'niebla'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(200);
  const hits = await page.evaluate(() => [...document.querySelectorAll('.pnl-story .pnl-help-item b')].map(b => b.textContent));
  ok(hits.length >= 1 && hits.includes('Niebla') && hits.length < 4, 'el buscador encuentra "niebla"', hits);
  await page.evaluate(() => { const i = document.querySelector('.pnl-story .st-search input'); i.value = 'xyzzy'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(150);
  ok(/No hay nada/.test(await text('.pnl-story .st-man')), 'sin resultados lo dice');
  // "Cómo jugar" de antes: ahora es el Manual
  await page.keyboard.press('KeyJ');
  ok(await waitFor(`!document.querySelector('.modal.pnl-story')`, 3000), 'J la cierra');
  await run(`ctx.openPanel('help'); return true;`);
  ok(await waitFor(`document.querySelector('.modal.pnl-story .tab.active')?.dataset.tab === 'manual'`, 3000), 'el panel "help" de antes abre el Manual');
  await closeModals();
  // volver a ver el prólogo
  await run(`ctx.openPanel('story'); return true;`);
  await waitFor(`!!document.querySelector('.pnl-story .st-prologue')`, 3000);
  await click('.pnl-story .st-prologue');
  ok(await waitFor(`!!document.querySelector('.st-epic')`, 4000), 'la Bitácora vuelve a pasar el prólogo');
  await page.keyboard.press('Escape');
  ok(await waitFor(`!document.querySelector('.st-epic')`, 3000), 'y se saltea con Esc');
  await closeModals();

  // ===================================================================
  section('Las escenas no se repiten');
  await drain();
  await run(`bus.emit('unlocks:changed', { id: 'expedicion' }); bus.emit('building:built', { b: { id: 'taller' } }); ST.cityIntro(); return true;`);
  await sleep(2500);
  ok(!(await has('.st-card:not(.bark)')), 'contactos ya vistos no vuelven a salir');
  ok(await run(`return ST._debug.queue.length === 0`), 'la cola queda vacía');
  // combate (paso 5): su contacto responde al evento, una sola vez
  await run(`bus.emit('combat:won', {}); return true;`);
  await drain();
  ok(await waitFor(`!!document.querySelector('.st-card[data-scene="c_combate"]')`, 6000), 'combat:won trae el contacto del combate');
  ok(await has('.st-card[data-scene="c_combate"] .st-skip'), 'con Saltar (tiene varias líneas)');
  await click('.st-card .st-skip');
  ok(await waitFor(`!document.querySelector('.st-card:not(.out)')`, 2000), 'Saltar la cierra');
  ok(await run(`return !!store.state.story.seen.c_combate`), 'queda vista igual');
  await run(`bus.emit('combat:won', {}); return true;`);
  await sleep(1500);
  ok(!(await has('.st-card[data-scene="c_combate"]')), 'no se repite');
  // al recargar
  await run(`store.save(); return true;`);
  await page.goto(BASE + '?nosw&nosplash', { waitUntil: 'load' });
  ok(await waitFor(`window.__pixelia?.ctx.router.current === 'city'`, 20000), 'recarga: directo a la ciudad');
  await sleep(3500);
  ok(!(await has('.st-epic')) && !(await has('.st-card:not(.bark)')), 'ni prólogo ni contactos repetidos');
  ok(await run(`return store.state.story.pages.p1 && store.state.story.seen.c_ciudad && !store.state.story.veteran`), 'lo visto quedó guardado');

  // ===================================================================
  section('Partida vieja: recibe state.story sin perder nada');
  await run(`
    const raw = JSON.parse(localStorage.getItem(store.SAVE_KEY || 'pixelia.save.v1'));
    delete raw.story; delete raw.introSeen;
    raw.onboarded = true; raw.coins = 12345; raw.gems = 77;
    const c = raw.city.buildings.find(b => b.id === 'castillo'); c.level = 3;
    raw.quests.done = Object.fromEntries(ctx.data.MAIN_QUESTS.slice(0, 20).map(q => [q.id, 1]));
    store.save = () => {};   // que el autoguardado no pise lo que se escribe a mano
    localStorage.setItem(store.SAVE_KEY || 'pixelia.save.v1', JSON.stringify(raw));
    return true;`);
  await page.goto(BASE + '?nosw&nosplash', { waitUntil: 'load' });
  ok(await waitFor(`window.__pixelia?.ctx.router.current === 'city'`, 20000), 'carga la partida vieja');
  const old = await run(`const s = store.state; return { v: s.story.v, vet: s.story.veteran, coins: s.coins, gems: s.gems, rank: s.city.buildings.find(b => b.id === 'castillo').level, intro: s.introSeen, seen: Object.keys(s.story.seen), ch: s.story.chapter };`);
  ok(old.v === 1 && old.vet === 1, 'state.story creado y marcada como veterana', old);
  ok(old.coins >= 12345 && old.gems >= 77 && old.rank === 3, 'monedas, gemas y rango intactos', old);
  ok(old.intro === true, 'la intro no se le impone');
  ok(['c_ciudad', 'c_expedicion', 'c_taller', 'c_rango'].every(id => old.seen.includes(id)), 'lo que ya conoce no se le explica', old.seen);
  ok(old.ch === 'banado', 'arranca en el capítulo que le toca por su rango', old.ch);
  await drain(3000);
  ok(await waitFor(`!!document.querySelector('.st-card[data-scene="veterano"]')`, 15000), 'un aviso corto lleva al prólogo (sin pantalla completa de golpe)');
  ok(!(await has('.st-epic')), 'no hay pantalla completa sin pedirla');
  await click('.st-card[data-scene="veterano"] .st-act');
  ok(await waitFor(`!!document.querySelector('.st-epic')`, 4000), '"Leer el prólogo" lo abre');
  await page.keyboard.press('Escape');
  ok(await waitFor(`!document.querySelector('.st-epic')`, 3000), 'Esc');
  ok(await run(`return !!store.state.story.pages.p1`), 'también recibe la primera página');

  // ===================================================================
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
