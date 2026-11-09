// Combate ↔ expedición (DESIGN-COMBAT.md §13). Dos partes:
//  1. Node, sobre los motores puros: la casilla `enemigo` en el generador (bandas media y lejana, tope, nada en la corta,
//     la primera pelea garantizada), la tarjeta con sus opciones, Pelear arma la pelea con el grupo, la escolta y los
//     consumibles, guardar a mitad de la pelea con JSON y retomar, ganar (botín a la carga), perder y retirarse (ánimo y
//     casilla anterior), la resolución rápida y volver a la ciudad en medio de una pelea.
//  2. Chrome headless con SwiftShader (no usa la GPU): la casilla en el mapa, la tarjeta, la entrada a la escena combat
//     (primera pelea guiada, con las pistas de Vera), guardar a mitad y recargar el juego, ganar y volver con el botín,
//     perder y retirarse (vuelven a la casilla anterior), la resolución rápida y los eventos combat:* de la telemetría.
//
//   node tools/test-combat-exp.mjs [--out carpeta] [--no-shots] [--node]   (--node: solo la primera parte)
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = resolve(opt('out', join(ROOT, 'shots', 'combate-exp')));
const SHOTS = !opt('no-shots', false);
const NODE_ONLY = !!opt('node', false);
if (SHOTS && !NODE_ONLY) mkdirSync(OUT, { recursive: true });

let ok = 0, bad = 0;
const check = (cond, msg, extra) => { if (cond) { ok++; console.log('  ok  ', msg); } else { bad++; console.log('  MAL ', msg, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); } };
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);

// =====================================================================================================================
console.log('1. Motores puros (Node)');
const D = await imp('src/expedition/exp-data.js');
const G = await imp('src/expedition/exp-gen.js');
const R = await imp('src/expedition/exp-rules.js');
const C = await imp('src/combat/combat-rules.js');
const CD = await imp('src/combat/combat-data.js');

{
  // generador: dónde caen, cuántas y de qué encuentro
  let maps = 0, withEnemy = 0, bandOk = true, capOk = true, subOk = true, onVoid = true;
  for (const region of D.REGION_IDS) for (let s = 1; s <= 300; s++) {
    const m = G.generateMap({ region, zone: 2, seed: s });
    const plain = G.generateMap({ region, zone: 2, seed: s, enemies: false });
    maps++;
    const e = m.cells.filter(c => c.content === 'enemigo');
    if (e.length) withEnemy++;
    if (e.length > D.EXP.enemy.max) capOk = false;
    for (const [i, c] of m.cells.entries()) {
      if (c.content !== 'enemigo') { if (c.content !== plain.cells[i].content) onVoid = false; continue; }
      if (D.ringOf(c.depth) < 1 || c.band) bandOk = false;
      if (!D.REGIONS[region].enemies[c.sub] || !CD.ENCOUNTERS[c.sub] || CD.ENCOUNTERS[c.sub].kind !== 'comun') subOk = false;
      if (plain.cells[i].content !== 'vacio') onVoid = false;
    }
  }
  check(bandOk, 'las casillas enemigo caen solo en las bandas media y lejana (nunca en el río ni en el vado)');
  check(capOk, `nunca más de ${D.EXP.enemy.max} por mapa`);
  check(subOk, 'cada una lleva un encuentro común de su región');
  check(onVoid, 'solo reemplazan casillas vacías: el resto del mapa queda igual que antes');
  check(withEnemy / maps > 0.4 && withEnemy / maps < 0.85, `aparecen en una buena parte de las salidas normales (${Math.round(100 * withEnemy / maps)} %)`);
  let corta = 0;
  for (let s = 1; s <= 200; s++) corta += G.generateMap({ region: 'bosque', kind: 'corta', seed: s }).cells.filter(c => c.content === 'enemigo').length;
  check(corta === 0, 'la salida corta (tutorial y Expedición del día) no tiene enemigos');
  const a = G.generateMap({ region: 'cerro', zone: 3, seed: 77 }), b = G.generateMap({ region: 'cerro', zone: 3, seed: 77 });
  check(JSON.stringify(a) === JSON.stringify(b), 'misma semilla, mismas casillas enemigo');
  let firstOk = true;
  for (let s = 1; s <= 200; s++) {
    const m = G.generateMap({ region: 'bosque', zone: 1, seed: s, enemies: { first: 'bosque_claro' } });
    const g = m.cells.filter(c => c.guided);
    if (g.length !== 1 || g[0].sub !== 'bosque_claro' || g[0].depth < 4) firstOk = false;
  }
  check(firstOk, 'la primera pelea (los lobos del Bosque, guiada) está siempre, en la banda media');
}

/** Salida de prueba con el grupo al lado de la casilla de la pelea guiada (camino visitado hasta la base). */
function nearFight(mods = {}, party = ['cazador'], equip = ['botiquin', 'farol', 'lona']) {
  const run = R.newRun({ region: 'bosque', zone: 1, seed: 21, party, equip, prov: 24, mods: { firstFight: 'bosque_claro', ...mods } });
  const i = run.cells.findIndex(c => c.guided);
  const x = i % run.w, y = (i / run.w) | 0;
  // camino visitado de la base a la casilla de al lado (primero en x, después en y)
  const [bx, by] = run.base, ty = y + (y < run.h - 1 ? 1 : -1);
  let cx = bx, cy = by;
  const mark = () => { const c = run.cells[cy * run.w + cx]; c.visited = c.seen = true; };
  while (cx !== x) { cx += Math.sign(x - cx); mark(); }
  while (cy !== ty) { cy += Math.sign(ty - cy); mark(); }
  run.pos = [x, ty];
  for (const c of run.cells) if (Math.abs(c.depth - run.cells[i].depth) <= 2) c.seen = true;
  run.cells[i].seen = true;
  // que la casilla de al lado no sea otro enemigo o peligro
  return { run, x, y, i };
}

{
  const { run, x, y, i } = nearFight();
  let r = R.move(run, x, y);
  check(r.ok && run.pending?.kind === 'enemigo' && run.pending.encounter === 'bosque_claro' && run.pending.guided, 'entrar a la casilla abre la tarjeta de la pelea (guiada)');
  const pelear = run.pending.options.find(o => o.id === 'pelear'), rapido = run.pending.options.find(o => o.id === 'resolver');
  check(pelear?.can && pelear.prov === D.EXP.enemy.fightProv, 'Pelear se puede y cuesta el paso más la pelea', pelear);
  check(rapido && !rapido.can && /ganarla/.test(rapido.why), 'Resolver rápido no se puede si nunca se ganó', rapido);
  r = R.choose(run, 'retroceder');
  check(r.ok && !run.pending && run.pos[1] !== y, 'Retroceder antes de pelear no cuesta nada');
  const prov0 = run.prov;
  R.move(run, x, y);
  const stepC = run.pending.step;
  r = R.choose(run, 'pelear');
  check(r.ok && r.outcome === 'combat' && run.pending?.kind === 'combate' && run.battle?.enc === 'bosque_claro', 'Pelear arma la pelea y la deja guardada en la salida');
  check(run.prov <= prov0 - stepC - D.EXP.enemy.fightProv && run.prov >= prov0 - stepC - D.EXP.enemy.fightProv - 1 && run.pos[0] === x && run.pos[1] === y, 'se pagó el paso y la pelea, y el grupo está en la casilla');
  const allies = run.battle.units.filter(u => u.side === 'ally').map(u => u.type);
  check(allies.length === 4 && allies[0] === 'lider' && allies.includes('cazador'), 'pelean quien lidera, el que salió y la escolta hasta completar 3', allies);
  check(run.battle.items.botiquin === 1 && run.battle.items.farol === 1 && run.battle.items.lona === 1, 'el equipo del Taller llega como consumibles', run.battle.items);
  check(R.choose(run, 'pelear').ok === false && R.move(run, x, y + 1).ok === false, 'con la pelea en curso no se puede elegir ni moverse');

  // guardar a mitad de la pelea con JSON y retomar: mismo resultado
  const b = run.battle;
  const ally = b.units.find(u => u.side === 'ally' && u.type === 'cazador');
  const to = C.reachable(b, ally.id)[0];
  C.move(b, ally.id, to.x, to.y);
  C.endTurn(b); C.enemyTurn(b);
  const saved = JSON.parse(JSON.stringify(run));
  check(saved.battle.turn === 2 && saved.pending.kind === 'combate', 'la salida guardada lleva la pelea a mitad (turno 2)');
  const play = (rr) => { const bb = rr.battle; for (let k = 0; k < 4 && !bb.ended; k++) { C.endTurn(bb); C.enemyTurn(bb); } return JSON.stringify(C.view(bb)); };
  check(play(saved) === play(JSON.parse(JSON.stringify(run))), 'retomar la pelea guardada da lo mismo que seguirla');

  // ganar: botín a la carga, casilla hecha
  C.retreat(b); b.outcome = 'win'; b.reason = 'derrota';
  const res = C.result(b);
  const cargo0 = Object.values(run.cargo).reduce((a, n) => a + n, 0);
  const e = R.endCombat(run, res);
  check(e.ok && e.fight.outcome === 'win' && run.cells[i].done && !run.battle && !run.pending, 'ganar deja la casilla libre y cierra la pelea');
  check(Object.values(run.cargo).reduce((a, n) => a + n, 0) > cargo0 && e.events.some(ev => ev.type === 'loot'), 'el botín entra a la carga', run.cargo);
  check(R.result(run).fights.length === 1 && R.result(run).fights[0].enc === 'bosque_claro', 'el resultado de la salida cuenta la pelea');
}
{
  const { run, x, y } = nearFight();
  R.move(run, x, y); R.choose(run, 'pelear');
  const m0 = run.morale, from = run.pending.from;
  const b = run.battle; b.maxTurns = b.turn; C.endTurn(b); C.enemyTurn(b);
  check(b.ended && b.outcome === 'lose' && b.reason === 'noche', 'pasado el último turno se pierde (noche)', { o: b.outcome, r: b.reason });
  const e = R.endCombat(run, C.result(b));
  check(run.morale === m0 + CD.COMBAT.morale.lose && run.pos[0] === from[0] && run.pos[1] === from[1], `perder cuesta ${-CD.COMBAT.morale.lose} de ánimo y vuelve a la casilla anterior`);
  check(!run.cells[y * run.w + x].done && e.events.some(ev => ev.type === 'pushBack'), 'los enemigos siguen ahí (se puede volver a probar)');
  R.move(run, x, y); R.choose(run, 'pelear');
  const m1 = run.morale;
  C.retreat(run.battle);
  R.endCombat(run, C.result(run.battle));
  check(run.morale === m1 + CD.COMBAT.morale.retreat && run.pos[0] === from[0], `retirarse cuesta ${-CD.COMBAT.morale.retreat} de ánimo y también vuelve`);
  check(run.fights.map(f => f.outcome).join() === 'lose,retreat', 'las dos quedan anotadas');
}
{
  // resolución rápida: con la pelea ya ganada (de antes o en esta salida)
  const { run, x, y, i } = nearFight({ combatWins: { bosque_claro: 1 } });
  R.move(run, x, y);
  const rapido = run.pending.options.find(o => o.id === 'resolver');
  check(rapido.can && rapido.ok?.mats, 'ya ganada: Resolver rápido se puede y dice qué deja', rapido);
  const r = R.choose(run, 'resolver');
  check(r.ok && run.cells[i].done && !run.battle && run.fights[0].quick && run.fights[0].stars === 1, 'se resuelve sin jugar: 1 estrella y la casilla libre');
}
{
  // ánimo bajo: llegan cansados · volver en medio de una pelea es retirarse
  const { run, x, y } = nearFight();
  run.morale = 2;
  R.move(run, x, y);
  check(run.pending.options[0].tired, 'con el ánimo bajo la tarjeta avisa que llegan cansados');
  R.choose(run, 'pelear');
  const lead = run.battle.units.find(u => u.type === 'lider');
  check(run.battle.tired && lead.maxHp === CD.UNITS.lider.hp + CD.COMBAT.leader.hp(1) - D.EXP.enemy.tiredHp, 'y pelean con menos vida');
  run.morale = 5;
  const g = R.goHome(run);
  check(run.ended && run.fights[0]?.outcome === 'retreat', 'volver a la ciudad en medio de una pelea cuenta como retirada', run.fights);
  check(g.result.fights.length === 1, 'y queda en el resultado de la salida');
}
{
  // grupos chicos: la escolta completa 3; el Botiquín usado en el camino no llega a la pelea
  const { run } = nearFight({ escort: ['monje', 'saqueador'] }, ['curandero'], ['botiquin']);
  check(R.fightParty(run).join() === 'curandero,monje,saqueador', 'la escolta sale de la ciudad (mods.escort)', R.fightParty(run));
  R.useItem(run, 'botiquin');
  check(!R.fightItems(run).includes('botiquin'), 'el Botiquín ya usado no llega a la pelea');
}

if (NODE_ONLY) {
  console.log(`\ntest-combat-exp (node): ${ok} bien, ${bad} mal`);
  process.exit(bad ? 1 : 0);
}

// =====================================================================================================================
console.log('2. En el juego (Chrome headless, SwiftShader)');
const { default: puppeteer } = await import('puppeteer-core');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
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
await page.setViewport({ width: 1366, height: 800, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });
page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`HTTP ${r.status()}: ${r.url()}`); });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 20000, ...a) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await page.evaluate(fn, ...a)) return true; } catch {} await sleep(150); }
  return false;
}
const P = (fn, ...a) => page.evaluate(fn, ...a);
const scene = () => P(() => window.__pixelia?.ctx.router.current);
const EXP = (fn, ...a) => page.evaluate((src, a) => { const e = document.querySelector('.scene-expedition')?.__exp; return e ? new Function('e', 'a', 'return (' + src + ')(e, a)')(e, a) : null; }, fn.toString(), a);
const CB = (fn, ...a) => page.evaluate((src, a) => { const c = document.querySelector('.scene-combat')?.__combat; return c ? new Function('c', 'a', 'return (' + src + ')(c, a)')(c, a) : null; }, fn.toString(), a);
const expIdle = () => waitFor(() => { const e = document.querySelector('.scene-expedition')?.__exp; return e && !e.busy; }, 15000);
const cbIdle = () => waitFor(() => { const c = document.querySelector('.scene-combat')?.__combat; return c && !c.busy; }, 40000);
async function shot(name) { if (SHOTS) { await page.screenshot({ path: join(OUT, name) }); console.log('  captura', join(OUT, name)); } }
/** Lleva al grupo al lado de la casilla enemigo (x,y), con camino visitado, y rearma la escena. */
async function standNextTo(x, y) {
  await EXP((e, a) => {
    const run = e.raw(), [x, y] = a;
    const ty = y + (y < run.h - 1 ? 1 : -1);
    let cx = run.base[0], cy = run.base[1];
    const mark = () => { const c = run.cells[cy * run.w + cx]; c.visited = c.seen = true; };
    while (cx !== x) { cx += Math.sign(x - cx); mark(); }
    while (cy !== ty) { cy += Math.sign(ty - cy); mark(); }
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, -2]]) { const c = run.cells[(y + dy) * run.w + x + dx]; if (c && x + dx >= 0 && x + dx < run.w) c.seen = true; }
    const nb = run.cells[ty * run.w + x];
    if (nb.content !== 'vacio') { nb.content = 'vacio'; nb.sub = null; nb.done = true; }
    run.pos = [x, ty];
  }, x, y);
  await P(() => window.__pixelia.store.save());
  await P(() => window.__pixelia.ctx.router.go('expedition', { resume: true }));
  await waitFor(() => !!document.querySelector('.scene-expedition')?.__exp?.view, 20000);
  await sleep(900);
  await expIdle();
}
const telemetry = () => P(() => window.__cbEv || []);

try {
  console.log('  a. ciudad con Casa de Expediciones y una salida normal al Bosque');
  await page.goto(`${BASE}?scene=city&reset&nosplash&nosw&cheat=6&quality=low`, { waitUntil: 'load' });
  await P(() => history.replaceState(null, '', location.pathname + '?nosplash&nosw&quality=low'));
  check(await waitFor(() => window.__pixelia?.ctx.router.current === 'city', 30000), 'la ciudad carga');
  const placed = await P(() => {
    const { store, economy: E, bus } = window.__pixelia;
    window.__cbEv = [];
    for (const n of ['combat:won', 'combat:lost', 'combat:retreat', 'expedition:combat']) bus.on(n, p => window.__cbEv.push({ n, p: JSON.parse(JSON.stringify(p)) }));
    const { min, max } = E.landBounds();
    for (let z = min; z < max; z++) for (let x = min; x < max; x++) if (E.canPlace('casa_exp', x, z, 0).ok) {
      const b = E.placeBuilding('casa_exp', x, z, 0);
      if (b.buildEnd) { b.buildEnd = Date.now() - 1; E.tick(); }
      store.state.prov = 40; store.state.stats.expeditions = 1;
      store.state.settings.combatSpeed = 3; store.state.settings.confirmEnd = false;
      return true;
    }
    return false;
  });
  check(placed, 'Casa de Expediciones construida');
  const st = await P(() => { const r = window.__pixelia.ctx.expedition.startExpedition({ region: 'bosque', kind: 'normal' }); return r.error || { guided: r.run.cells.filter(c => c.guided).length, mods: r.run.mods }; });
  check(st.guided === 1 && st.mods.firstFight === 'bosque_claro', 'la primera salida normal al Bosque trae la pelea guiada', st);
  check(Array.isArray(st.mods.escort) && st.mods.combatWins && typeof st.mods.combatWins === 'object', 'la ciudad le pasa la escolta y las peleas ganadas', st.mods);
  await P(() => window.__pixelia.ctx.router.go('expedition', { resume: true }));
  check(await waitFor(() => !!document.querySelector('.scene-expedition')?.__exp?.view, 30000), 'abre la expedición');
  await sleep(1200);
  const target = await EXP(e => { const r = e.raw(); const i = r.cells.findIndex(c => c.guided); return [i % r.w, (i / r.w) | 0]; });
  await standNextTo(...target);
  const seen = await EXP((e, a) => e.view.cells[a[1] * e.view.w + a[0]], ...target);
  check(seen.seen && seen.content === 'enemigo' && seen.sub === 'bosque_claro', 'la casilla enemigo se ve en el mapa', seen);
  await shot('1-casilla-en-el-mapa.png');

  console.log('  b. la tarjeta y la entrada al combate');
  await EXP((e, a) => e.move(a[0], a[1]), ...target);
  check(await waitFor(() => !!document.querySelector('.scene-expedition .ex-card.in'), 8000), 'entrar abre la tarjeta');
  await sleep(500);
  const card = await P(() => document.querySelector('.scene-expedition .ex-card.in')?.innerText.replace(/\s+/g, ' ') || '');
  check(/Ojos en el monte/.test(card) && /Pelear/.test(card) && /Resolver rápido/.test(card) && /escolta/.test(card), 'la tarjeta muestra el encuentro, quiénes pelean y las opciones', card);
  check(/lobos de ojos brillantes/.test(card) && /Si pierden/.test(card), 'y qué esperan y qué cuesta perder', card);
  await shot('2-tarjeta-enemigo.png');
  await EXP(e => e.choose(0));
  check(await waitFor(() => window.__pixelia.ctx.router.current === 'combat' && !!document.querySelector('.scene-combat')?.__combat?.view, 30000), 'Pelear pasa a la escena del combate');
  await sleep(2600);
  const info = await CB(c => ({ guided: c.guided, exp: c.expedition, enc: c.view.enc, allies: c.view.units.filter(u => u.side === 'ally').length }));
  check(info?.enc === 'bosque_claro' && info.exp && info.guided && info.allies === 4, 'es la pelea de la casilla, guiada, con el grupo completo', info);
  const same = await P(() => { const a = window.__pixelia.store.state.expedition.active; const c = document.querySelector('.scene-combat').__combat.raw(); return a?.battle === c && a.pending?.kind === 'combate'; });
  check(same, 'la escena juega la misma pelea guardada en state.expedition.active.battle');
  check(await waitFor(() => /Se pelea por turnos|turnos/.test(document.querySelector('.scene-combat').__combat.guide), 6000), 'Vera arranca la guía: el contacto del combate');
  check(await P(() => !!window.__pixelia.store.state.story?.seen?.c_combate), 'el contacto del combate queda visto (la ciudad no lo repite)');
  await shot('3-entrada-al-combate.png');

  console.log('  c. primer combate guiado: pistas de un solo uso');
  const lead = await CB(c => { const u = c.raw().units.find(x => x.type === 'lider'); const r = c.rules.reachable(c.raw(), u.id).filter(t => t.x !== u.x || t.y !== u.y); return { id: u.id, to: r[0] }; });
  await CB((c, a) => c.select(a[0]), lead.id);
  await CB((c, a) => c.click(a[0], a[1]), lead.to.x, lead.to.y);
  await cbIdle();
  check(await waitFor(() => /actúa una vez/.test(document.querySelector('.scene-combat').__combat.guide), 4000), 'después de mover: cómo actuar');
  await shot('4-primer-combate-guiado.png');
  // los lobos marcan cuando llegan a alguien: puede tardar un turno o dos
  let g2 = '';
  for (let k = 0; k < 4; k++) {
    await CB(c => { for (const u of c.raw().units) if (u.side === 'ally' && u.alive) u.hp = u.maxHp; });   // que nadie caiga mientras tanto
    await CB(c => c.endTurn(true));
    await cbIdle();
    await sleep(600);
    g2 = await CB(c => c.guide);
    if (await P(() => !!window.__pixelia.store.state.tutorial?.combatTips?.marks)) break;
  }
  check(/marcadas|Llega|rayada/.test(g2), 'después del turno enemigo: las casillas marcadas', g2);
  const tips = await P(() => Object.keys(window.__pixelia.store.state.tutorial?.combatTips || {}));
  check(tips.includes('intro') && tips.includes('act') && tips.includes('marks'), 'las pistas quedan anotadas (no se repiten)', tips);
  await shot('5-casillas-marcadas-guia.png');

  console.log('  d. guardar a mitad y recargar el juego');
  const liveTurn = await CB(c => c.view.turn);
  const savedTurn = await P(() => { window.__pixelia.store.save(); return JSON.parse(localStorage.getItem('pixelia.save.v1')).expedition.active.battle.turn; });
  check(savedTurn === liveTurn && savedTurn >= 2, `el guardado tiene la pelea a mitad (turno ${savedTurn})`, { savedTurn, liveTurn });
  await page.goto(`${BASE}?nosplash&nosw&quality=low`, { waitUntil: 'load' });
  check(await waitFor(() => window.__pixelia?.ctx.router.current === 'city', 30000), 'recarga en la ciudad');
  await P(() => { window.__cbEv = []; const { bus } = window.__pixelia; for (const n of ['combat:won', 'combat:lost', 'combat:retreat']) bus.on(n, p => window.__cbEv.push({ n, p: JSON.parse(JSON.stringify(p)) })); window.__pixelia.store.state.settings.combatSpeed = 3; });
  await P(() => window.__pixelia.ctx.router.go('expedition', { resume: true }));
  check(await waitFor(() => window.__pixelia.ctx.router.current === 'combat' && !!document.querySelector('.scene-combat')?.__combat?.view, 30000), 'abrir la expedición retoma la pelea');
  const resumed = await CB(c => ({ turn: c.view.turn, enc: c.view.enc, guided: c.guided }));
  check(resumed?.turn === savedTurn && resumed.enc === 'bosque_claro', 'en el mismo turno', resumed);

  console.log('  e. ganar y volver con el botín');
  await sleep(800);
  await CB(c => { for (const u of c.raw().units) if (u.side === 'ally') u.atk = 30; });   // para que la prueba no dependa de jugar bien
  let guard = 0;
  while (!(await CB(c => c.raw().ended)) && guard++ < 10) {
    for (let k = 0; k < 6; k++) {
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
  const won = await CB(c => c.rules.result(c.raw()));
  check(won?.outcome === 'win', `ganó la pelea (${won?.turns} turnos)`);
  await page.waitForSelector('.cb-result', { timeout: 10000 }).catch(() => {});
  await sleep(900);
  const resTxt = await P(() => document.querySelector('.cb-result')?.innerText.replace(/\s+/g, ' ') || '');
  check(/Victoria/.test(resTxt) && !/Reintentar/.test(resTxt), 'pantalla de victoria (sin Reintentar en la expedición)', resTxt);
  const cargo0 = await P(() => Object.values(window.__pixelia.store.state.expedition.active.cargo).reduce((a, n) => a + n, 0));
  await P(() => document.querySelector('.cb-result [data-a="go"]').click());
  check(await waitFor(() => window.__pixelia.ctx.router.current === 'expedition' && !!document.querySelector('.scene-expedition')?.__exp?.view, 30000), 'Seguir vuelve a la expedición');
  await sleep(1200);
  await expIdle();
  const after = await EXP((e, a) => { const r = e.raw(); return { done: r.cells[a[1] * r.w + a[0]].done, pos: r.pos, cargo: Object.values(r.cargo).reduce((s, n) => s + n, 0), fights: r.fights.length, battle: r.battle, pending: r.pending }; }, ...target);
  check(after.done && after.pos[0] === target[0] && after.pos[1] === target[1] && !after.battle && !after.pending, 'la casilla quedó libre y el grupo está ahí');
  check(after.cargo > cargo0, `el botín entró a la carga (${cargo0} → ${after.cargo})`);
  const cb = await P(() => window.__pixelia.store.state.combat);
  check(cb?.wins?.bosque_claro === 1 && cb.guided && cb.xp > 0, 'la ciudad anota la victoria, la guía y la experiencia de quien lidera', cb);
  check(await P(() => !!window.__pixelia.store.state.story?.pages?.p2), 'la primera victoria contra los lobos da la página "Los lobos del arroyo"');
  let ev = await telemetry();
  check(ev.some(x => x.n === 'combat:won' && x.p.enc === 'bosque_claro' && x.p.turns > 0 && x.p.guided), 'se emite combat:won con los turnos (historia y telemetría)', ev);
  await sleep(1500);
  await shot('6-vuelta-con-botin.png');

  console.log('  f. perder y retirarse: vuelven a la casilla anterior');
  // otra casilla enemigo (los lobos otra vez) al lado, para probar la derrota, la retirada y la resolución rápida
  const t2 = await EXP(e => {
    const r = e.raw(), [px, py] = r.pos;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) {
      const x = px + dx, y = py + dy, c = r.cells[y * r.w + x];
      if (!c || x < 0 || x >= r.w || y < 0) continue;
      c.content = 'enemigo'; c.sub = 'bosque_claro'; c.done = false; c.seen = true; c.guided = false; c.terrain = 'llano';
      return [x, y];
    }
    return null;
  });
  await P(() => window.__pixelia.store.save());
  await P(() => window.__pixelia.ctx.router.go('expedition', { resume: true }));
  await waitFor(() => !!document.querySelector('.scene-expedition')?.__exp?.view, 20000);
  await sleep(900); await expIdle();
  const before = await EXP(e => ({ pos: e.raw().pos, morale: e.raw().morale }));
  await EXP((e, a) => e.move(a[0], a[1]), ...t2);
  await waitFor(() => !!document.querySelector('.scene-expedition .ex-card.in'), 8000);
  await sleep(400);
  const quickBtn = await P(() => { const b = [...document.querySelectorAll('.scene-expedition .ex-opt')].find(x => /Resolver rápido/.test(x.textContent)); return b && !b.disabled; });
  check(quickBtn, 'ya ganada: la tarjeta deja Resolver rápido');
  await EXP(e => e.choose(0));
  await waitFor(() => window.__pixelia.ctx.router.current === 'combat' && !!document.querySelector('.scene-combat')?.__combat?.view, 30000);
  await sleep(1500);
  check(!(await CB(c => c.guided)), 'la segunda pelea ya no es guiada');
  await CB(c => { const b = c.raw(); b.maxTurns = b.turn; });
  await CB(c => c.endTurn(true));
  await cbIdle();
  await page.waitForSelector('.cb-result', { timeout: 15000 }).catch(() => {});
  await sleep(700);
  const lostTxt = await P(() => document.querySelector('.cb-result')?.innerText.replace(/\s+/g, ' ') || '');
  check(/Derrota/.test(lostTxt) && /ánimo/.test(lostTxt) && !/Reintentar/.test(lostTxt), 'derrota: dice cuánto ánimo cuesta y no ofrece reintentar', lostTxt);
  await P(() => document.querySelector('.cb-result [data-a="go"]').click());
  await waitFor(() => window.__pixelia.ctx.router.current === 'expedition' && !!document.querySelector('.scene-expedition')?.__exp?.view, 30000);
  await sleep(1500); await expIdle();
  const afterLose = await EXP((e, a) => { const r = e.raw(); return { pos: r.pos, morale: r.morale, done: r.cells[a[1] * r.w + a[0]].done }; }, ...t2);
  check(afterLose.pos[0] === before.pos[0] && afterLose.pos[1] === before.pos[1] && !afterLose.done, 'volvieron a la casilla anterior y los lobos siguen ahí', { before, afterLose });
  check(afterLose.morale === before.morale + CD.COMBAT.morale.lose, `el ánimo bajó ${-CD.COMBAT.morale.lose}`, afterLose);
  await shot('7-vuelta-tras-derrota.png');

  await EXP((e, a) => e.move(a[0], a[1]), ...t2);
  await waitFor(() => !!document.querySelector('.scene-expedition .ex-card.in'), 8000);
  await sleep(400);
  await EXP(e => e.choose(0));
  await waitFor(() => window.__pixelia.ctx.router.current === 'combat' && !!document.querySelector('.scene-combat')?.__combat?.view, 30000);
  await sleep(1500);
  await page.keyboard.press('Escape'); await sleep(300);
  await P(() => document.querySelector('.cb-modal [data-a="retreat"]')?.click()); await sleep(200);
  await P(() => document.querySelector('.cb-modal [data-a="yes"]')?.click()); await sleep(800);
  check(/Retirada/.test(await P(() => document.querySelector('.cb-result')?.innerText || '')), 'retirarse desde el menú');
  await P(() => document.querySelector('.cb-result [data-a="go"]').click());
  await waitFor(() => window.__pixelia.ctx.router.current === 'expedition' && !!document.querySelector('.scene-expedition')?.__exp?.view, 30000);
  await sleep(1500); await expIdle();
  const afterRet = await EXP(e => ({ pos: e.raw().pos, morale: e.raw().morale }));
  check(afterRet.pos[0] === before.pos[0] && afterRet.morale === afterLose.morale + CD.COMBAT.morale.retreat, `retirarse cuesta ${-CD.COMBAT.morale.retreat} de ánimo y también vuelve`, afterRet);

  console.log('  g. resolución rápida');
  await EXP((e, a) => e.move(a[0], a[1]), ...t2);
  await waitFor(() => !!document.querySelector('.scene-expedition .ex-card.in'), 8000);
  await sleep(400);
  await EXP(e => e.choose(1));
  await sleep(1500); await expIdle();
  const quick = await EXP((e, a) => { const r = e.raw(); return { scene: window.__pixelia.ctx.router.current, done: r.cells[a[1] * r.w + a[0]].done, last: r.fights[r.fights.length - 1] }; }, ...t2);
  check(quick.scene === 'expedition' && quick.done && quick.last?.quick, 'se resuelve sin pasar por la escena del combate', quick);
  ev = await telemetry();
  const names = ev.map(x => x.n);
  check(names.includes('combat:lost') && names.includes('combat:retreat') && names.filter(n => n === 'combat:won').length >= 1, 'combat:lost, combat:retreat y combat:won (rápido) en el bus', names);
  const tracked = await P(async () => { const t = await import('./src/online/telemetry.js'); return ['combat:won', 'combat:lost', 'combat:retreat'].every(n => typeof t.TRACKED_EVENTS[n] === 'function'); });
  check(tracked, 'la telemetría registra victoria, derrota y retirada');
  const cb2 = await P(() => window.__pixelia.store.state.combat);
  check(cb2.losses.bosque_claro === 1 && cb2.retreats.bosque_claro === 1 && cb2.quick === 1 && cb2.fights === 4, 'la ciudad lleva la cuenta de cada pelea', cb2);
} catch (e) {
  bad++; console.log('  ERROR', e.stack || e.message);
}

await browser.close();
server.close();
const errs = [...new Set(errors)].filter(e => !/net::ERR_|supabase|AudioContext/.test(e));
if (errs.length) { bad++; console.log('\n=== ERRORES DE PÁGINA ===\n' + errs.join('\n')); }
console.log(`\ntest-combat-exp: ${ok} bien, ${bad} mal`);
process.exit(bad ? 1 : 0);
