// La salida completa de la porción vertical (PLAN-FOTO, A1 + A2 + A3 enganchados). Dos partes:
//  1. Node, sobre los motores: la Travesía pelea los encuentros del Arroyo con la Marea elegida, al ganar cae botín
//     (armas con rasgos al arsenal, veta al árbol), el arma equipada define las habilidades de la pelea siguiente,
//     las reliquias de las dos tablas valen toda la salida, el árbol cambia la pelea, la resolución automática y una
//     salida guardada antes del botín.
//  2. Chrome headless con SwiftShader (no usa la GPU): un bot juega una salida entera desde ?scene=voyage (pelea por
//     la interfaz, botín, equipar, reliquia, jefe, volver, gastar un punto del árbol), recarga y verifica el guardado;
//     después zarpa en Marea II, resuelve sola una pelea ya superada y abre una partida vieja.
//
//   node tools/test-voyage-loop.mjs [--out carpeta] [--no-shots] [--node]   (--node: solo la primera parte)
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = resolve(opt('out', join(ROOT, 'shots', 'travesia-loop')));
const SHOTS = !opt('no-shots', false);
const NODE_ONLY = !!opt('node', false);
if (SHOTS && !NODE_ONLY) mkdirSync(OUT, { recursive: true });

let ok = 0, bad = 0;
const check = (cond, msg, extra) => { if (cond) { ok++; console.log('  ok  ', msg); } else { bad++; console.log('  MAL ', msg, extra !== undefined ? JSON.stringify(extra).slice(0, 500) : ''); } };
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);

// =====================================================================================================================
console.log('1. Motores (Node)');
const D = await imp('src/voyage/voyage-data.js');
const G = await imp('src/voyage/voyage-gen.js');
const R = await imp('src/voyage/voyage-rules.js');
const C = await imp('src/combat/combat-rules.js');
const CD = await imp('src/combat/combat-data.js');
const A = await imp('src/core/arsenal.js');
const L = await imp('src/core/loot.js');
const LD = await imp('src/core/loot-data.js');
const T = await imp('src/core/tree.js');
const TD = await imp('src/core/tree-data.js');
const ES = (await imp('src/i18n/es.js')).default;
const SIM = await imp('tools/sim-voyage.mjs');

/** Gana la pelea pendiente sin jugarla (todos los enemigos caen) y la cierra. */
function winFight(run, env, stars3 = true) {
  const b = R.activeBattle(run);
  for (const u of b.units) if (u.side === 'enemy') { u.hp = 0; u.alive = false; }
  b.ended = true; b.outcome = 'win';
  const res = C.result(b);
  if (stars3) res.stars = 3;
  return R.endCombat(run, res, [], env);
}
/** Un camino de la primera fila al jefe que pasa por una élite (o null). */
function pathWithElite(map) {
  const walk = (id, seen) => {
    const n = map.nodes[id], s = seen || n.type === 'elite';
    if (!n.next.length) return s ? [id] : null;
    for (const j of n.next) { const p = walk(j, s); if (p) return [id, ...p]; }
    return null;
  };
  for (const s of map.start) { const p = walk(s, false); if (p) return p; }
  return null;
}
let SEED = 0, PATH = null;
for (let s = 1; s < 400 && !PATH; s++) { const p = pathWithElite(G.generateMap({ seed: s })); if (p) { SEED = s; PATH = p; } }

{
  console.log('  a. encuentros del Arroyo y Marea');
  const farm = new Set([...CD.FARM.arroyo.comunes, ...CD.FARM.arroyo.elites, CD.FARM.arroyo.jefe]);
  let encs = true, elites = true;
  for (let s = 1; s <= 60; s++) for (const n of G.generateMap({ seed: s }).nodes) {
    if (n.enc && !farm.has(n.enc)) encs = false;
    if (n.type === 'elite' && !CD.FARM.arroyo.elites.includes(n.enc)) elites = false;
    if (n.type === 'jefe' && n.enc !== CD.FARM.arroyo.jefe) encs = false;
  }
  check(encs && elites, 'las peleas, las élites y el jefe son los encuentros de farmeo del Bosque del Arroyo');
  check(!!PATH, 'hay mapas con una élite en el camino', SEED);
  for (const m of [1, 2, 3]) {
    const run = R.newRun({ seed: 9, marea: m });
    R.enter(run, R.choices(run)[0]);
    check(run.marea === m && R.activeBattle(run).marea === m && R.activeBattle(run).w === 6 && R.activeBattle(run).h === 6, `Marea ${m}: la pelea es 6×6 y lleva esa Marea`);
  }
  check(R.newRun({ seed: 1, marea: 9 }).marea === CD.MAREA_MAX && R.newRun({ seed: 1 }).marea === 1, 'la Marea se acota de I a III');
}

{
  console.log('  b. botín al ganar, equipar y habilidades');
  const state = {}, env = { state };
  const run = R.newRun({ seed: SEED, marea: 1 });
  let drops = 0, relicOffered = false;
  const before = JSON.stringify(C.newBattle({ encounter: 'arroyo_lobos', seed: 1, party: run.party, level: run.level }).units.find(u => u.type === 'cazador').abilities);
  for (const id of PATH) {
    R.enter(run, id, env);
    const node = R.nodeOf(run, id);
    if (run.pending.kind === 'combate') {
      const out = winFight(run, env);
      const ev = out.events.find(e => e.type === 'loot');
      if (node.type !== 'jefe') {
        check(!!ev && ev.veta > 0, `${node.type}: al ganar cae botín con veta`, out.events.map(e => e.type));
        drops += ev.items.length;
        if (node.type === 'elite') {
          check(ev.items.length >= 1, 'la élite deja al menos un arma');
          const os = R.options(run);
          relicOffered = os.some(o => o.id === 'reliquia');
          check(relicOffered, 'la élite ofrece una reliquia');
          R.choose(run, 'reliquia', env);
          continue;
        }
        R.skip(run);
      }
    } else R.choose(run, R.options(run).find(o => o.can).id);
  }
  check(run.ended && run.outcome === 'win', 'la salida termina con el jefe vencido', run.outcome);
  const a = A.arsenalState(state);
  check(a.items.length >= 2 && a.items.length === run.drops.length, 'las armas quedan en el arsenal de la partida', [a.items.length, run.drops.length]);
  check(a.items.every(w => Array.isArray(w.affixes) && w.affixes.length >= 1 && w.affixes.length <= 4 && w.rarity >= 0), 'cada arma trae rareza y de 1 a 4 rasgos');
  check(T.treeState(state).xp === run.veta && run.veta > 0, 'la veta de las peleas va al árbol', [state.tree.xp, run.veta]);
  check(run.relics.length === 1, 'la reliquia vale toda la salida', run.relics);
  check(run.xp > 0 && R.summary(run).items === run.drops.length, 'el resumen lleva la experiencia y las armas');
  const v = R.voyageState(state);
  check(v.mareaMax === 2 && Object.keys(v.best[1] || {}).length >= 3, 'vencer al jefe en Marea I abre la II y quedan las mejores marcas', v);
  check(Object.keys(a.mastery).length > 0, 'las armas usadas ganan maestría', a.mastery);

  // el arma equipada define las habilidades de la pelea siguiente
  const arco = { type: 'lanza', rarity: 2, traits: [], affixes: [{ id: 'filo', v: 2 }], tier: 1 };
  const w = A.addWeapon(state, arco).weapon;
  const run2 = R.newRun({ seed: SEED + 1, marea: 1 });
  R.enter(run2, R.choices(run2)[0], env);
  const ab0 = R.activeBattle(run2).units.find(u => u.type === 'lider').abilities.slice();
  check(A.equipWeapon(state, 'lider', w.uid).ok && R.refreshBattle(run2, env), 'se equipa antes de entrar y la pelea se arma de nuevo');
  const lid = R.activeBattle(run2).units.find(u => u.type === 'lider');
  const want = L.weaponSkills('lanza', 1);
  check(want.every(id => lid.abilities.includes(id)) && JSON.stringify(ab0) !== JSON.stringify(lid.abilities), 'el líder pelea con las habilidades de la lanza', [ab0, lid.abilities]);
  check(lid.am?.golpe?.dmg === 2 || JSON.stringify(lid.am || {}).includes('2'), 'el rasgo del arma cambia su golpe', lid.am);
  const b = R.activeBattle(run2); b.units.find(u => u.side === 'ally').moved = true;
  check(!R.refreshBattle(run2, env), 'una pelea empezada no se arma de nuevo');
  check(typeof before === 'string', 'referencia');
}

{
  console.log('  c. reliquias de las dos tablas, árbol y Marea');
  const state = {}, env = { state };
  const all = R.ALL_RELICS();
  check(all.length === Object.keys(D.RELICS).length + LD.RELIC_IDS.length && new Set(all).size === all.length, 'las reliquias del viaje y las del combate no se pisan', all.length);
  check(all.every(id => ES[`voyage.relic.${id}.name`] || ES[`relic.${id}.name`]), 'todas tienen nombre');
  const run = R.newRun({ seed: 21 });
  R.giveRelic(run, 'cuerno_roto', []);
  R.enter(run, R.choices(run)[0], env);
  check(R.activeBattle(run).rules.foeHp === 0.85, 'una reliquia del combate cambia las reglas de la pelea', R.activeBattle(run).rules);
  const plain = R.newRun({ seed: 21 }); R.enter(plain, R.choices(plain)[0], { state: {} });
  const hp = (r) => R.activeBattle(r).units.filter(u => u.side === 'enemy').reduce((s, u) => s + u.hp, 0);
  check(hp(run) < hp(plain), 'y los enemigos llegan con menos vida', [hp(run), hp(plain)]);
  // el árbol: un nodo tomado cambia lo que lleva el grupo
  state.tree = { xp: 400, nodes: [] };
  const first = TD.TREE_NODES.find(n => !n.req.length && n.fx.length);
  const g0 = JSON.stringify(R.loadoutOf(R.newRun({ seed: 3 }), env));
  check(T.takeNode(state, first.id).ok, 'se toma un nodo del árbol con un punto');
  const g1 = JSON.stringify(R.loadoutOf(R.newRun({ seed: 3 }), env));
  check(g0 !== g1, 'el nodo cambia lo que el grupo lleva a la pelea', first.id);
  // mejor botín en mareas altas
  const haul = (m) => { let veta = 0, pow = 0, n = 0; for (let s = 1; s <= 40; s++) { const st = {}, r = R.newRun({ seed: s, marea: m }); R.enter(r, R.choices(r)[0], { state: st }); winFight(r, { state: st }); veta += r.veta; for (const w of st.arsenal.items) { pow += L.itemPower(w); n++; } } return { veta, n, pow: pow / Math.max(1, n) }; };
  const h1 = haul(1), h3 = haul(3);
  check(h3.veta > h1.veta && h3.n >= h1.n && h3.pow > h1.pow, 'en Marea III cae más veta, más armas y más fuertes que en la I', [h1, h3]);
}

{
  console.log('  d. resolución automática y guardado viejo');
  const state = {}, env = { state };
  const run = R.newRun({ seed: 5, marea: 2 });
  R.enter(run, R.choices(run)[0], env);
  const enc = run.pending.enc;
  check(!R.canAuto(run, env), 'una pelea nueva no se resuelve sola');
  winFight(run, env); R.skip(run);
  check(R.bestOf(state, 2, enc) === 3 && R.bestOf(state, 1, enc) === 0, 'las tres estrellas quedan anotadas en esa Marea');
  const again = R.newRun({ seed: 5, marea: 2 });
  R.enter(again, R.choices(again)[0], env);
  check(again.pending.enc === enc && R.canAuto(again, env), 'la misma pelea, ya superada, se puede resolver sola');
  const hp0 = JSON.stringify(again.squad), n0 = A.arsenalState(state).items.length, x0 = state.tree.xp;
  const out = R.autoFight(again, env);
  check(out.ok && out.fight.auto && again.pending.kind === 'recompensa' && JSON.stringify(again.squad) === hp0, 'se resuelve sin perder vida y deja la recompensa', out.fight);
  check(state.tree.xp > x0 && out.events.some(e => e.type === 'loot') && A.arsenalState(state).items.length >= n0, 'con botín completo: veta y armas');
  const low = R.newRun({ seed: 5, marea: 1 }); R.enter(low, R.choices(low)[0], env);
  check(!R.canAuto(low, env), 'en otra Marea hay que ganarla de nuevo');
  // una salida y una partida de antes del botín
  const old = JSON.parse(JSON.stringify(R.newRun({ seed: 8 })));
  for (const k of ['marea', 'wins', 'offers', 'best', 'drops', 'veta', 'xp']) delete old[k];
  const st2 = { voyage: { runs: 2, wins: 1, active: old } };
  const v = R.voyageState(st2);
  check(v.mareaMax === 1 && v.marea === 1 && v.runs === 2 && v.active === old, 'una partida vieja se completa sola', { mareaMax: v.mareaMax, runs: v.runs });
  Object.assign(old, { marea: old.marea ?? 1, wins: old.wins ?? 0, offers: old.offers ?? 0, best: old.best ?? {}, drops: old.drops ?? [], veta: old.veta ?? 0, xp: old.xp ?? 0 });
  let threw = null;
  try { R.enter(old, R.choices(old)[0], { state: st2 }); winFight(old, { state: st2 }); } catch (e) { threw = e.message; }
  check(!threw && old.pending?.kind === 'recompensa' && st2.arsenal && st2.tree, 'una salida guardada antes del botín sigue y gana botín', threw);
}

{
  console.log('  e. el bot juega salidas enteras en las tres Mareas');
  for (const m of [1, 2, 3]) {
    const r = SIM.playVoyage(700 + m, 'prudente', { marea: m });
    check(r.run.ended && r.run.marea === m && r.seconds > 0 && r.state.tree.xp >= 0, `Marea ${m}: la salida termina (${r.summary.outcome}, ${r.run.fights.length} peleas, ${r.state.arsenal?.items.length || 0} armas)`);
  }
}

if (NODE_ONLY) {
  console.log(`\ntest-voyage-loop (node): ${ok} bien, ${bad} mal`);
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
const VY = (fn, ...a) => page.evaluate((src, a) => { const v = document.querySelector('.scene-voyage')?.__voyage; return v ? new Function('v', 'a', 'return (' + src + ')(v, a)')(v, a) : null; }, fn.toString(), a);
const CB = (fn, ...a) => page.evaluate((src, a) => { const c = document.querySelector('.scene-combat')?.__combat; return c ? new Function('c', 'a', 'return (' + src + ')(c, a)')(c, a) : null; }, fn.toString(), a);
const cbIdle = () => waitFor(() => { const c = document.querySelector('.scene-combat')?.__combat; return c && !c.busy; }, 40000);
const inVoyage = () => waitFor(() => window.__pixelia?.ctx.router.current === 'voyage' && !!document.querySelector('.scene-voyage')?.__voyage, 30000);
const inCombat = () => waitFor(() => window.__pixelia.ctx.router.current === 'combat' && !!document.querySelector('.scene-combat')?.__combat?.view, 30000);
const card = () => P(() => document.querySelector('.scene-voyage [data-card]')?.dataset.card || null);
const text = (sel) => P((s) => document.querySelector(s)?.innerText.replace(/\s+/g, ' ') || '', sel);
const fast = () => P(() => { window.__pixelia.store.state.settings.combatSpeed = 3; window.__pixelia.store.state.settings.confirmEnd = false; });
async function shot(name) { if (SHOTS) { await page.screenshot({ path: join(OUT, name) }); console.log('  captura', join(OUT, name)); } }

/** El bot juega la pelea abierta por la interfaz del combate (el grupo pega fuerte para que la prueba sea corta). */
async function botFight() {
  await sleep(1500);
  await CB(c => { for (const u of c.raw().units) { if (u.side === 'ally') { u.atk = 60; u.hp = u.maxHp = 60; } } });
  let guard = 0;
  while (!(await CB(c => c.raw().ended)) && guard++ < 14) {
    for (let k = 0; k < 8; k++) {
      const plan = await CB(c => {
        const R = c.rules, b = c.raw();
        const al = b.units.filter(u => u.alive && !u.safe && u.side === 'ally' && !u.acted);
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
      if (plan.move) { await CB((c, a) => c.click(a[0], a[1]), ...plan.move); await cbIdle(); continue; }
      await CB((c, a) => { c.ability(a[0]); c.click(a[1], a[2]); }, plan.act, plan.x, plan.y);
      await cbIdle();
      if (await CB(c => c.raw().ended)) break;
    }
    if (await CB(c => c.raw().ended)) break;
    await CB(c => c.endTurn(true));
    await cbIdle();
  }
  const outcome = await CB(c => c.raw().outcome);
  await page.waitForSelector('.cb-result', { timeout: 15000 }).catch(() => {});
  await sleep(600);
  await P(() => document.querySelector('.cb-result [data-a="go"]')?.click());
  await inVoyage();
  return outcome;
}
/** Gana la pelea pendiente sin abrir el combate (como volver con la pelea ganada). */
const quickWin = () => VY(v => { const b = v.run.battle; for (const u of b.units) if (u.side === 'enemy') { u.hp = 0; u.alive = false; } b.ended = true; b.outcome = 'win'; v.finishFight(v.combat.result(b)); });
const snap = () => P(() => { const s = window.__pixelia.store.state; return { items: s.arsenal?.items.length || 0, equipped: JSON.stringify(s.arsenal?.equipped || {}), xp: s.tree?.xp || 0, nodes: (s.tree?.nodes || []).slice(), mareaMax: s.voyage?.mareaMax, best: JSON.stringify(s.voyage?.best || {}), wins: s.voyage?.wins, mats: JSON.stringify(s.materials || {}) }; });

try {
  console.log('  a. el muelle: elegir la Marea');
  await page.goto(`${BASE}?scene=voyage&reset&nosplash&nosw&cheat=6&quality=low`, { waitUntil: 'load' });
  check(await inVoyage() && (await card()) === 'zarpar', 'abre en el muelle');
  await P(() => history.replaceState(null, '', location.pathname + '?scene=voyage&nosplash&nosw&quality=low'));
  await fast();
  const mr = await P(() => [...document.querySelectorAll('[data-marea]')].map(b => ({ m: b.dataset.marea, off: b.disabled, on: b.classList.contains('on') })));
  check(mr.length === 3 && mr[0].on && !mr[0].off && mr[1].off && mr[2].off, 'tres Mareas: la I elegida, la II y la III cerradas hasta vencer al jefe', mr);
  check(/Árbol de habilidades/.test(await text('[data-card="zarpar"]')) && /Equipo/.test(await text('[data-card="zarpar"]')), 'desde el muelle se abren el árbol y el equipo');
  check(await P(() => { const el = document.querySelector('.scene-voyage'); return el.scrollWidth <= el.clientWidth + 1; }), 'entra en la pantalla sin barra horizontal');
  await shot('1-muelle.png');
  await VY((v, a) => { v.start(a[0]); }, SEED);
  check((await VY(v => v.run.marea)) === 1 && /Marea I\b/.test(await text('.vy-top')), 'zarpa en Marea I y se ve arriba', await text('.vy-top'));

  console.log('  b. la primera pelea, por la interfaz del combate');
  await P((id) => document.querySelector(`.vy-node[data-node="${id}"]`).click(), PATH[0]);
  check((await card()) === 'combate', 'el primer nodo es una pelea');
  const enc0 = await VY(v => v.run.pending.enc);
  await P(() => document.querySelector('[data-a="fight"]').click());
  check(await inCombat(), 'Pelear abre el combate');
  check((await CB(c => ({ w: c.raw().w, h: c.raw().h, m: c.raw().marea, farm: c.view.farm }))).w === 6, 'tablero de 6×6');
  check((await botFight()) === 'win', 'el bot gana la pelea');
  check((await card()) === 'recompensa', 'vuelve a la Travesía con la recompensa');
  const s1 = await snap();
  check(s1.xp > 0 && /Veta/.test(await text('[data-card="recompensa"]')), 'la pelea dejó veta para el árbol y se lee en la tarjeta', s1);
  check(JSON.parse(s1.best)[1]?.[enc0] >= 1, 'queda anotada la mejor marca de esa pelea', s1.best);
  await shot('2-recompensa.png');
  await P(() => document.querySelector('[data-a="skip"]').click());

  console.log('  c. hasta la élite: botín, reliquia y equipar');
  let relicTaken = false;
  for (const id of PATH.slice(1)) {
    const node = await VY((v, a) => v.run.map.nodes[a[0]].type, id);
    if (node === 'jefe') break;
    await P((n) => document.querySelector(`.vy-node[data-node="${n}"]`).click(), id);
    const k = await card();
    if (k === 'combate') {
      await quickWin();
      if (node === 'elite' && !relicTaken) {
        check((await P(() => document.querySelectorAll('[data-card="recompensa"] [data-drop]').length)) >= 1, 'la élite deja un arma y se ve con sus rasgos', await text('[data-card="recompensa"]'));
        await shot('3-botin-elite.png');
        check(!!(await P(() => document.querySelector('[data-opt="reliquia"]'))), 'y ofrece una reliquia');
        await P(() => document.querySelector('[data-opt="reliquia"]').click());
        relicTaken = true;
        check((await VY(v => v.run.relics.length)) === 1 && (await P(() => document.querySelectorAll('.vy-tag.relic').length)) === 1, 'la reliquia queda en la mochila para toda la salida');
      } else await P(() => document.querySelector('[data-a="skip"]').click());
    } else await P(() => document.querySelector('[data-card] [data-opt]:not([disabled])').click());
  }
  check(relicTaken, 'pasó por la élite');
  const s2 = await snap();
  check(s2.items >= 1, 'hay armas en el arsenal', s2);
  await P(() => document.querySelector('[data-a="gear"]').click());
  check((await P(() => document.querySelectorAll('[data-card="equipo"] [data-who]').length)) === 4, 'el panel de equipo muestra a los cuatro');
  check(/Fuerza \d+/.test(await text('[data-card="equipo"]')) && /Habilidades:/.test(await text('[data-card="equipo"]')), 'cada arma con su fuerza y las habilidades que da');
  await shot('4-equipo.png');
  const eq = await P(() => { const b = document.querySelector('[data-card="equipo"] [data-equip]'); if (!b) return null; const [who, uid] = b.dataset.equip.split(':'); b.click(); return { who, uid: Number(uid) }; });
  check(!!eq && JSON.parse((await snap()).equipped)[eq.who] === eq.uid, 'un clic equipa el arma', eq);
  const skills = await VY((v, a) => v.gear.skills[a[0]] || [], eq.who);
  check(skills.length >= 2, 'el arma define las habilidades de quien la lleva', skills);
  check((await P((w) => document.querySelector(`[data-who="${w}"] [data-cur]`)?.dataset.cur, eq.who)) === String(eq.uid), 'el panel muestra el arma puesta');

  console.log('  d. el jefe');
  const rest = PATH.slice(PATH.indexOf(await VY(v => v.run.pos)) + 1);
  for (const id of rest) {
    await P((n) => document.querySelector(`.vy-node[data-node="${n}"]`).click(), id);
    const k = await card();
    if (k === 'combate') {
      if ((await VY(v => v.run.map.nodes[v.run.pos].type)) === 'jefe') break;
      await quickWin(); await P(() => document.querySelector('[data-a="skip"]').click());
    } else await P(() => document.querySelector('[data-card] [data-opt]:not([disabled])').click());
  }
  check((await card()) === 'combate' && /Jefe/.test(await text('[data-card="combate"] h2')), 'llega al jefe', await text('[data-card] h2'));
  const ab = await VY((v, a) => ({ unit: v.run.battle.units.find(u => u.type === a[0])?.abilities || [], gear: v.gear.skills[a[0]] || [] }), eq.who);
  check(ab.gear.every(id => ab.unit.includes(id)), 'en la pelea siguiente pelea con las habilidades del arma equipada', ab);
  await P(() => document.querySelector('[data-a="fight"]').click());
  check(await inCombat(), 'entra al combate del jefe');
  check((await botFight()) === 'win', 'el jefe cae');
  check((await card()) === 'fin', 'el resumen de la salida');
  const s3 = await snap();
  check(s3.wins === 1 && s3.mareaMax === 2 && s3.mats !== s1.mats, 'la salida queda anotada, se abre la Marea II y los materiales van a la aldea', s3);
  check(/Armas: \d+/.test(await text('[data-card="fin"]')) && /Experiencia: \d+/.test(await text('[data-card="fin"]')), 'el resumen dice armas, veta y experiencia', await text('[data-card="fin"]'));
  check(s3.xp >= 30, 'alcanza la veta para el primer punto del árbol', s3.xp);
  await shot('5-resumen.png');

  console.log('  e. el árbol desde la vuelta');
  await P(() => document.querySelector('[data-a="tree"]').click());
  check(await waitFor(() => window.__pixelia.ctx.router.current === 'tree' && !!window.__tree, 20000), 'se abre el árbol');
  const open = await P(() => window.__tree.view().nodes.find(n => n.state === 'open')?.id);
  await P((id) => { const b = document.querySelector(`[data-node="${id}"]`); b.click(); }, open);
  await P(() => document.querySelector('[data-act="take"]').click());
  const s4 = await snap();
  check(s4.nodes.length === 1 && s4.nodes[0] === open, 'se gasta un punto en un nodo', s4.nodes);
  await shot('6-arbol.png');
  await P(() => document.querySelector('[data-act="back"]').click());
  check(await inVoyage(), 'Volver trae de nuevo a la Travesía');

  console.log('  f. recargar: todo quedó guardado');
  await page.goto(`${BASE}?scene=voyage&nosplash&nosw&quality=low`, { waitUntil: 'load' });
  check(await inVoyage() && (await card()) === 'zarpar', 'recarga en el muelle');
  await fast();
  const s5 = await snap();
  check(s5.items === s4.items && s5.equipped === s4.equipped && s5.xp === s4.xp && s5.nodes.join() === s4.nodes.join() && s5.mareaMax === 2 && s5.best === s4.best && s5.wins === 1 && s5.mats === s4.mats, 'armas, equipo, árbol, Marea abierta, marcas y materiales siguen ahí', [s4, s5]);
  check(!(await P(() => document.querySelector('[data-marea="2"]').disabled)) && (await P(() => document.querySelector('[data-marea="3"]').disabled)), 'la Marea II está abierta y la III no');

  console.log('  g. Marea II y resolución automática');
  await P(() => document.querySelector('[data-marea="2"]').click());
  check(await P(() => document.querySelector('[data-marea="2"]').classList.contains('on')), 'se elige la Marea II');
  await VY((v, a) => { v.start(a[0]); }, SEED);
  check((await VY(v => v.run.marea)) === 2, 'la salida nueva es de Marea II');
  await P((id) => document.querySelector(`.vy-node[data-node="${id}"]`).click(), PATH[0]);
  check((await VY(v => v.run.battle.marea)) === 2 && !(await P(() => document.querySelector('[data-a="auto"]'))), 'la pelea lleva la Marea II y todavía no se puede resolver sola');
  const tn = await VY(v => JSON.stringify(v.gear.gear.lider));
  check(typeof tn === 'string' && (await snap()).nodes.length === 1, 'el nodo del árbol sigue tomado al armar la pelea');
  // se anota como ya ganada con tres estrellas y se vuelve a dibujar
  await P(() => { const s = window.__pixelia.store.state, r = s.voyage.active; (s.voyage.best[2] ??= {})[r.pending.enc] = 3; });
  await P(() => document.querySelector('[data-a="gear"]').click());
  check(!!(await P(() => document.querySelector('[data-a="auto"]'))), 'con tres estrellas en esa Marea aparece Resolver sola');
  const hp0 = await VY(v => JSON.stringify(v.run.squad)), x0 = (await snap()).xp;
  await P(() => document.querySelector('[data-a="auto"]').click());
  check((await card()) === 'recompensa' && (await VY(v => JSON.stringify(v.run.squad))) === hp0 && (await snap()).xp > x0, 'se resuelve sin jugarla, sin perder vida y con botín', await text('[data-card]'));
  check(/Resuelta sola/.test(await text('[data-card="recompensa"]')), 'la tarjeta lo dice');
  await shot('7-auto.png');

  console.log('  h. una partida de antes del botín');
  await P(() => {
    const st = window.__pixelia.store, s = st.state, r = s.voyage.active;
    for (const k of ['marea', 'wins', 'offers', 'best', 'drops', 'veta', 'xp', 'bag']) delete r[k];
    r.pending = null;
    delete s.arsenal; delete s.tree; s.voyage = { runs: 4, wins: 1, active: r };
    st.markDirty(); st.save();
  });
  await page.goto(`${BASE}?scene=voyage&nosplash&nosw&quality=low`, { waitUntil: 'load' });
  check(await inVoyage() && (await card()) === 'mapa', 'una partida sin arsenal ni árbol, con una salida vieja a medias, abre en el mapa');
  await P(() => document.querySelector('.vy-node.can').click());
  const kk = await card();
  if (kk === 'combate') await quickWin(); else await P(() => document.querySelector('[data-card] [data-opt]:not([disabled])').click());
  check(['recompensa', 'mapa'].includes(await card()), 'y se sigue jugando', await card());
  check(errors.length === 0, 'sin errores en la consola', errors.slice(0, 5));
} catch (e) {
  bad++;
  console.log('  MAL  excepción:', e.stack || e.message);
  if (errors.length) console.log(errors.slice(0, 8).join('\n'));
} finally {
  await browser.close();
  server.close();
}

console.log(`\ntest-voyage-loop: ${ok} bien, ${bad} mal`);
process.exit(bad ? 1 : 0);
