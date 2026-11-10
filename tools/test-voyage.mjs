// La Travesía por nodos (PLAN-FOTO §A1). Dos partes:
//  1. Node, sobre los motores puros: el generador (filas, anchos, uniones sin cruces, tipos, de 3 a 5 peleas por
//     camino, semilla), las reglas de la salida (elegir nodo, la vida que sigue de pelea en pelea, recompensas 1 de 3,
//     eventos con consecuencia segura, campamento, reliquias, caer, retirarse, volver) y el bot de sim-voyage.
//  2. Chrome headless con SwiftShader (no usa la GPU): ?scene=voyage&seed=N, el mapa, entrar a una pelea por la
//     escena del combate, volver con la vida que quedó, recargar a mitad de la salida, llegar al jefe, ganarle por la
//     interfaz, el botín acreditado en la ciudad y el botón provisorio de la ciudad.
//
//   node tools/test-voyage.mjs [--out carpeta] [--no-shots] [--node]   (--node: solo la primera parte)
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = resolve(opt('out', join(ROOT, 'shots', 'travesia')));
const SHOTS = !opt('no-shots', false);
const NODE_ONLY = !!opt('node', false);
if (SHOTS && !NODE_ONLY) mkdirSync(OUT, { recursive: true });

let ok = 0, bad = 0;
const check = (cond, msg, extra) => { if (cond) { ok++; console.log('  ok  ', msg); } else { bad++; console.log('  MAL ', msg, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); } };
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);

// =====================================================================================================================
console.log('1. Motores puros (Node)');
const D = await imp('src/voyage/voyage-data.js');
const G = await imp('src/voyage/voyage-gen.js');
const R = await imp('src/voyage/voyage-rules.js');
const C = await imp('src/combat/combat-rules.js');
const ES = (await imp('src/i18n/es.js')).default;
const SIM = await imp('tools/sim-voyage.mjs');
const { VOY } = D;

{
  console.log('  a. generador');
  let shape = true, links = true, cross = true, types = true, range = true, fork = 0, join_ = 0;
  const seen = new Set(), rowsSeen = new Set();
  const N = 400;
  for (let s = 1; s <= N; s++) {
    const m = G.generateMap({ seed: s });
    rowsSeen.add(m.rows);
    const rows = Array.from({ length: m.rows }, (_, y) => m.nodes.filter(n => n.row === y));
    if (m.rows < VOY.rows[0] || m.rows > VOY.rows[1]) shape = false;
    rows.forEach((r, y) => { if (y === m.rows - 1 ? r.length !== 1 : r.length < VOY.width[0] || r.length > VOY.width[1]) shape = false; });
    const inc = new Map();
    for (const n of m.nodes) {
      seen.add(n.type);
      if (!D.NODE_TYPES.includes(n.type)) types = false;
      if ((n.type === 'jefe') !== (n.row === m.rows - 1)) types = false;
      if (n.row === 0 && n.type !== 'pelea') types = false;
      if (n.row === m.rows - 2 && n.type !== 'campamento') types = false;
      if (G.isFight(n.type) !== !!n.enc || (n.type === 'evento') !== !!n.event) types = false;
      if (n.row < m.rows - 1 && !n.next.length) links = false;
      for (const j of n.next) { if (m.nodes[j].row !== n.row + 1) links = false; inc.set(j, (inc.get(j) || 0) + 1); }
    }
    for (const n of m.nodes) if (n.row > 0 && !inc.get(n.id)) links = false;
    for (const r of rows) for (const a of r) for (const b of r) if (a.col < b.col) {
      if (Math.max(...a.next.map(j => m.nodes[j].col)) > Math.min(...b.next.map(j => m.nodes[j].col))) cross = false;
    }
    const fr = G.fightRange(m);
    if (fr.min < VOY.fights[0] || fr.max > VOY.fights[1]) range = false;
    if (m.nodes.some(n => n.next.length > 1)) fork++;
    if ([...inc.values()].some(k => k > 1)) join_++;
  }
  check(shape, `de ${VOY.rows[0]} a ${VOY.rows[1]} filas, de ${VOY.width[0]} a ${VOY.width[1]} nodos por fila y el jefe solo al final`);
  check(rowsSeen.size === VOY.rows[1] - VOY.rows[0] + 1, 'salen mapas de todos los largos', [...rowsSeen]);
  check(links, 'todo nodo tiene por dónde llegar y por dónde seguir, siempre a la fila siguiente');
  check(cross, 'los caminos no se cruzan');
  check(fork / N > 0.95 && join_ / N > 0.95, `los caminos se bifurcan y se juntan (${fork} y ${join_} de ${N})`);
  check(types && seen.size === 5, 'los 5 tipos: la primera fila es de peleas, antes del jefe hay campamento, cada pelea con su encuentro y cada evento con el suyo', [...seen]);
  check(range, `todo camino tiene de ${VOY.fights[0]} a ${VOY.fights[1]} peleas contando al jefe`);
  check(JSON.stringify(G.generateMap({ seed: 77 })) === JSON.stringify(G.generateMap({ seed: 77 })) && JSON.stringify(G.generateMap({ seed: 77 })) !== JSON.stringify(G.generateMap({ seed: 78 })), 'misma semilla, mismo mapa; otra semilla, otro');
}

const winBattle = (run, hurt = {}) => {
  const b = R.activeBattle(run);
  for (const u of b.units) { if (u.side === 'enemy') { u.hp = 0; u.alive = false; } else if (hurt[u.type] != null) u.hp = hurt[u.type]; }
  b.ended = true; b.outcome = 'win';
  return C.result(b);
};
const loseBattle = (run) => { const b = R.activeBattle(run); for (const u of b.units) if (u.side === 'ally') { u.hp = 0; u.alive = false; } b.ended = true; b.outcome = 'lose'; return C.result(b); };
/** Lleva una salida hasta un nodo del tipo pedido ganando lo que haya en el medio. */
function runTo(seed, type) {
  for (let s = seed; s < seed + 80; s++) {
    const run = R.newRun({ seed: s });
    for (let g = 0; g < 40 && !run.ended; g++) {
      if (!run.pending) {
        const ch = R.choices(run);
        const want = ch.find(id => R.nodeOf(run, id).type === type);
        R.enter(run, want ?? ch[0]);
        if (want != null) return run;
      } else if (run.pending.kind === 'combate') R.endCombat(run, winBattle(run));
      else R.choose(run, R.options(run).find(o => o.can).id);
    }
  }
  return null;
}

{
  console.log('  b. reglas de la salida');
  const run = R.newRun({ seed: 5 });
  check(R.squadIds(run).length === 4 && R.squadIds(run)[0] === 'lider' && Object.values(run.squad).every(s => s.hp === s.maxHp && s.hp > 0), 'el grupo sale entero: líder y tres más', run.squad);
  check(JSON.stringify(R.choices(run)) === JSON.stringify(run.map.start), 'al zarpar se elige entre los nodos de la primera fila');
  check(!R.enter(run, run.map.boss).ok && run.pos == null, 'no se puede saltar a un nodo que no está conectado');
  const first = R.choices(run)[0];
  check(R.enter(run, first).ok && run.pending?.kind === 'combate' && !!R.activeBattle(run), 'entrar a una pelea arma el combate');
  check(R.choices(run).length === 0 && !R.choose(run, 'x').ok, 'con la pelea pendiente no se puede seguir de largo');
  const b1 = R.activeBattle(run);
  check(b1.units.filter(u => u.side === 'ally').length === 4 && b1.enc === R.nodeOf(run, first).enc, 'pelea el grupo completo contra el encuentro del nodo');
  const saved = JSON.parse(JSON.stringify(run));
  check(JSON.stringify(saved) === JSON.stringify(run), 'la salida es JSON puro (se guarda a mitad de una pelea)');
  const out = R.endCombat(run, winBattle(run, { lider: 5, cazador: 0 }));
  check(out.ok && run.squad.lider.hp === 5 && run.squad.cazador.hp === 0 && run.squad.forjador.hp === run.squad.forjador.maxHp, 'la vida con que termina cada uno queda en la salida', run.squad);
  check(run.pending?.kind === 'recompensa' && run.pending.options.length === 3 && new Set(run.pending.options.map(o => o.id)).size === 3, 'ganar ofrece 3 recompensas distintas', run.pending);
  check(Object.keys(run.loot.mats).length > 0, 'y deja el botín del encuentro', run.loot);
  const o = R.options(run)[0], before = JSON.stringify(run.squad) + JSON.stringify(run.loot) + run.relics + run.items;
  check(R.choose(run, o.id).ok && !run.pending && before !== JSON.stringify(run.squad) + JSON.stringify(run.loot) + run.relics + run.items, 'elegir una la aplica y libera el camino', o);
  check(JSON.stringify(R.choices(run)) === JSON.stringify(R.nodeOf(run, first).next), 'después se elige entre los nodos conectados');
  // la vida sigue a la pelea siguiente
  const r2 = runTo(11, 'pelea');   // recién zarpado: la primera fila es de peleas
  R.endCombat(r2, winBattle(r2, { lider: 4, curandero: 0 }));
  R.skip(r2);
  let g = 0;
  while (r2.pending?.kind !== 'combate' && g++ < 20) { if (!r2.pending) R.enter(r2, R.choices(r2).find(id => G.isFight(R.nodeOf(r2, id).type)) ?? R.choices(r2)[0]); else R.choose(r2, R.options(r2).find(x => x.can && !Object.keys(x.fx).some(k => /heal|dmg|maxHp/.test(k)))?.id || R.options(r2)[0].id); }
  const b2 = R.activeBattle(r2), lead = b2?.units.find(u => u.type === 'lider'), cur = b2?.units.find(u => u.type === 'curandero');
  check(!!b2 && lead.hp === r2.squad.lider.hp && lead.hp < lead.maxHp, 'la pelea siguiente empieza con la vida que quedó', { hp: lead?.hp, squad: r2.squad.lider });
  check(cur?.hp === VOY.downHp, 'quien cayó vuelve con lo justo', cur?.hp);
  // mejoras de la salida llegan a la pelea
  const r3 = R.newRun({ seed: 9 });
  R.applyFx(r3, { atk: { who: 'lider', n: 2 }, armor: { who: 'forjador', n: 1 }, maxHpAll: 3 });
  const base = R.newRun({ seed: 9 });
  R.enter(r3, r3.map.start[0]); R.enter(base, base.map.start[0]);
  const u3 = (r, t) => R.activeBattle(r).units.find(u => u.type === t);
  check(u3(r3, 'lider').atk === u3(base, 'lider').atk + 2 && u3(r3, 'forjador').armor === (u3(base, 'forjador').armor || 0) + 1 && u3(r3, 'cazador').maxHp === u3(base, 'cazador').maxHp + 3, 'ataque, coraza y vida máxima ganados en la salida llegan al combate');
}

{
  console.log('  c. élite, eventos y campamento');
  const re = runTo(1, 'elite');
  check(!!re, 'hay salidas con élite');
  if (re) {
    const node = R.nodeOf(re, re.pos), plain = C.newBattle({ encounter: node.enc, seed: R.activeBattle(re).seed, party: re.party, level: re.level, element: re.element, classLevel: Object.fromEntries(re.party.map(c => [c, re.classLevel])) });
    const hp = (b) => b.units.filter(u => u.side === 'enemy').reduce((a, u) => a + u.maxHp, 0);
    check((await imp('src/combat/combat-data.js')).FARM.arroyo.elites.includes(node.enc) && hp(R.activeBattle(re)) === Math.round(hp(plain) * D.VOY.elite.hp), 'la élite es un encuentro de élite del Arroyo', [node.enc, hp(R.activeBattle(re)), hp(plain)]);
    R.endCombat(re, winBattle(re));
    check(re.pending.options[0].id === 'reliquia' && R.ALL_RELICS().includes(re.pending.options[0].relic), 'y siempre ofrece una reliquia', re.pending.options);
    R.choose(re, 'reliquia');
    check(re.relics.length === 1, 'la reliquia elegida queda en la salida');
  }
  let evOk = true, sure = true;
  for (const ev of Object.values(D.EVENTS)) {
    if (ev.options.length < 2) evOk = false;
    for (const o of ev.options) {
      if (!ES[`voyage.event.${ev.id}.${o.id}`] || !ES[`voyage.event.${ev.id}.title`] || !ES[`voyage.event.${ev.id}.text`]) evOk = false;
      // misma salida, misma opción: mismo resultado (no hay tirada)
      const a = R.newRun({ seed: 3 }), b = R.newRun({ seed: 3 });
      b.rs = 12345;
      for (const r of [a, b]) { r.items.push('botiquin'); r.loot.mats = { madera: 6 }; r.relics = Object.keys(D.RELICS).slice(1); R.applyFx(r, o.fx); }
      if (JSON.stringify([a.squad, a.loot, a.items, a.relics, a.nextFoe, a.bossHp]) !== JSON.stringify([b.squad, b.loot, b.items, b.relics, b.nextFoe, b.bossHp])) sure = false;
    }
  }
  check(evOk, 'cada evento tiene al menos dos opciones, con sus textos');
  check(sure, 'la consecuencia de cada opción es segura: no depende de una tirada');
  const rv = runTo(1, 'evento');
  check(rv?.pending?.kind === 'evento' && R.options(rv).length >= 2, 'el nodo de evento abre su tarjeta con opciones');
  const rh = R.newRun({ seed: 2 });
  rh.pending = { kind: 'evento', node: 0, event: 'herido' };
  check(R.options(rh).find(o => o.id === 'curar').can === false && !R.choose(rh, 'curar').ok, 'una opción que pide algo que no tenés no se puede elegir');
  rh.items.push('botiquin');
  check(R.choose(rh, 'curar').ok && rh.relics.length === 1 && !rh.items.includes('botiquin'), 'con el Botiquín: se gasta y da una reliquia', rh);
  const rp = R.newRun({ seed: 2 });
  rp.loot.mats = { madera: 5, hierbas: 2 }; rp.squad.lider.hp = 2;
  rp.pending = { kind: 'evento', node: 0, event: 'puente' };
  R.choose(rp, 'cruzar');
  check(rp.squad.lider.hp === 1 && rp.squad.cazador.hp === rp.squad.cazador.maxHp - 2 && rp.loot.mats.madera === 5, 'el puente, cruzar: todos pierden vida (nadie cae por un evento) y la carga queda', rp.squad);
  rp.pending = { kind: 'evento', node: 0, event: 'puente' };
  R.choose(rp, 'soltar');
  check(rp.loot.mats.madera === 2 && rp.loot.mats.hierbas === 1, 'el puente, soltar peso: se pierde la mitad del botín', rp.loot);
  const rc = runTo(1, 'campamento');
  check(rc?.pending?.kind === 'campamento' && R.options(rc).map(o => o.id).join() === 'descansar,entrenar', 'el campamento deja elegir entre descansar y entrenar');
  for (const s of Object.values(rc.squad)) s.hp = 1;
  const rc2 = JSON.parse(JSON.stringify(rc));
  R.choose(rc, 'descansar'); R.choose(rc2, 'entrenar');
  check(Object.values(rc.squad).every(s => s.hp === 1 + Math.ceil(s.maxHp * VOY.camp.heal)), 'descansar cura', rc.squad);
  check(rc2.squad.lider.atk === 1 && rc2.squad.cazador.maxHp === rc.squad.cazador.maxHp + 2, 'entrenar mejora al grupo para el resto de la salida', rc2.squad);
}

{
  console.log('  d. reliquias, caer y volver');
  check(Object.keys(D.RELICS).length >= 5 && Object.keys(D.RELICS).every(id => ES[`voyage.relic.${id}.name`] && ES[`voyage.relic.${id}.text`]), `hay ${Object.keys(D.RELICS).length} reliquias, con nombre y texto`);
  const foeHp = (r) => R.activeBattle(r).units.filter(u => u.side === 'enemy').reduce((a, u) => a + u.maxHp, 0);
  const a = R.newRun({ seed: 4 }), b = R.newRun({ seed: 4 });
  b.relics.push('mella', 'alforja');
  R.enter(a, a.map.start[0]); R.enter(b, b.map.start[0]);
  check(foeHp(b) < foeHp(a), 'Diente mellado: los enemigos empiezan con menos vida', [foeHp(a), foeHp(b)]);
  check(R.activeBattle(b).items.botiquin === 1 && !R.activeBattle(a).items.botiquin, 'Alforja: cada pelea empieza con un Botiquín');
  a.relics.push('brasa'); b.relics.push('bolsa');
  const ra = winBattle(a, { lider: 3 }), rb = winBattle(b);
  R.endCombat(a, ra); R.endCombat(b, rb);
  check(a.squad.lider.hp === 5, 'Brasa: después de ganar, cada uno recupera 2', a.squad.lider);
  check(Object.values(b.loot.mats).reduce((x, y) => x + y, 0) > Object.values(a.loot.mats).reduce((x, y) => x + y, 0), 'Bolsa honda: las peleas dejan más materiales', [a.loot, b.loot]);
  const cf = R.newRun({ seed: 4 }); cf.relics.push('fogon'); cf.pending = { kind: 'campamento', node: 0 };
  check(R.options(cf).length === 1 && R.options(cf)[0].fx.healAll && R.options(cf)[0].fx.atkLeader, 'Olla del fogón: el campamento da las dos cosas');
  // extensión para A3: una reliquia nueva con función
  D.registerRelic({ id: '_prueba', mods: {}, on: { battle: (run, { battle }) => { battle.marca = true; } } });
  const ext = R.newRun({ seed: 4 }); ext.relics.push('_prueba'); R.enter(ext, ext.map.start[0]);
  check(R.activeBattle(ext).marca === true, 'una reliquia nueva se suma con registerRelic y puede tocar la pelea (extensión para A3)');
  delete D.RELICS._prueba;
  // caer
  const l = R.newRun({ seed: 6 });
  l.loot.mats = { madera: 7, hierbas: 1 };
  R.enter(l, l.map.start[0]);
  R.endCombat(l, loseBattle(l));
  check(l.ended && l.outcome === 'lose' && l.haul.mats.madera === 3 && !l.haul.mats.hierbas, 'si el grupo cae, la salida termina con la mitad del botín', l.haul);
  check(R.choices(l).length === 0 && !R.enter(l, l.map.start[0]).ok, 'una salida terminada no sigue');
  const s2 = R.newRun({ seed: 6 }); s2.relics.push('segunda');
  R.enter(s2, s2.map.start[0]);
  R.endCombat(s2, loseBattle(s2));
  check(!s2.ended && s2.pending?.kind === 'combate' && R.activeBattle(s2)?.turn === 1 && s2.squad.lider.hp === Math.ceil(s2.squad.lider.maxHp / 2), 'Nudo de la segunda vuelta: el grupo se levanta y la pelea se repite', s2.squad.lider);
  R.endCombat(s2, loseBattle(s2));
  check(s2.ended && s2.outcome === 'lose', 'pero una sola vez por salida');
  const rt = R.newRun({ seed: 6 }); rt.loot.mats = { madera: 4 };
  R.enter(rt, rt.map.start[0]);
  R.leave(rt);
  check(rt.ended && rt.outcome === 'retreat' && rt.haul.mats.madera === 2, 'retirarse de una pelea termina la salida con la mitad', rt.haul);
  const lv = R.newRun({ seed: 6 }); lv.loot.mats = { madera: 4 };
  R.leave(lv);
  check(lv.ended && lv.outcome === 'leave' && lv.haul.mats.madera === 4, 'volver a la aldea desde el mapa conserva todo');
  const bs = runTo(1, 'jefe');
  check(bs && R.nodeOf(bs, bs.pos).enc === D.ISLANDS.bosque.boss, 'el último nodo es el jefe de la isla');
  R.endCombat(bs, winBattle(bs));
  check(bs.ended && bs.outcome === 'win' && !bs.pending, 'vencer al jefe cierra la salida');
}

{
  console.log('  e. el bot juega salidas enteras con el combate real');
  let done = true, fightsOk = true, wins = 0;
  const t0 = Date.now();
  for (let s = 1; s <= 12; s++) {
    const { run, summary } = SIM.playVoyage(500 + s, SIM.BOTS[s % 3]);
    if (!run.ended) done = false;
    if (summary.outcome === 'win') { wins++; const n = run.fights.filter(f => f.outcome === 'win').length; if (n < VOY.fights[0] || n > VOY.fights[1]) fightsOk = false; }
  }
  check(done, `12 salidas de punta a punta (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  check(wins >= 3 && fightsOk, `las ganadas tienen de ${VOY.fights[0]} a ${VOY.fights[1]} peleas (${wins} ganadas)`);
}

if (NODE_ONLY) {
  console.log(`\ntest-voyage (node): ${ok} bien, ${bad} mal`);
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
async function shot(name) { if (SHOTS) { await page.screenshot({ path: join(OUT, name) }); console.log('  captura', join(OUT, name)); } }

try {
  console.log('  a. ?scene=voyage&seed=7: el mapa');
  await page.goto(`${BASE}?scene=voyage&seed=7&reset&nosplash&nosw&cheat=6&quality=low`, { waitUntil: 'load' });
  check(await inVoyage(), 'abre la escena de la Travesía');
  await P(() => history.replaceState(null, '', location.pathname + '?scene=voyage&nosplash&nosw&quality=low'));
  await P(() => { window.__pixelia.store.state.settings.combatSpeed = 3; window.__pixelia.store.state.settings.confirmEnd = false; });
  const m = await VY(v => ({ seed: v.run.seed, nodes: v.run.map.nodes.length, dom: document.querySelectorAll('.vy-node').length, can: document.querySelectorAll('.vy-node.can').length, start: v.run.map.start.length, lines: document.querySelectorAll('.vy-map line').length, links: v.run.map.nodes.reduce((a, n) => a + n.next.length, 0) }));
  check(m.seed === 7 && m.dom === m.nodes && m.lines === m.links, 'la semilla de la URL arma el mapa: un botón por nodo y una línea por unión', m);
  check(m.can === m.start && (await card()) === 'mapa', 'se puede entrar por cualquier nodo de la primera fila');
  check(/Líder/.test(await text('.vy-sq')) && /Jefe/.test(await text('.vy-map')), 'se ve el grupo con su vida y el jefe al final');
  check(await P(() => { const el = document.querySelector('.scene-voyage'); return el.scrollWidth <= el.clientWidth + 1; }), 'entra en la pantalla sin barra horizontal');
  await shot('1-mapa.png');

  console.log('  b. una pelea por la escena del combate');
  await P(() => document.querySelector('.vy-node.can').click());
  check((await card()) === 'combate' && /Pelear/.test(await text('[data-card]')), 'entrar a un nodo de pelea muestra el encuentro y Pelear');
  await shot('2-tarjeta-pelea.png');
  await P(() => document.querySelector('[data-a="fight"]').click());
  check(await inCombat(), 'Pelear pasa a la escena del combate');
  await sleep(1500);
  check(await P(() => window.__pixelia.store.state.voyage.active.battle === document.querySelector('.scene-combat').__combat.raw()), 'es la misma pelea guardada en state.voyage.active.battle');
  check((await CB(c => c.view.units.filter(u => u.side === 'ally').length)) === 4, 'pelea el grupo completo');
  await shot('3-combate.png');
  // gana sin jugarla: la pelea queda terminada y al volver la Travesía la acredita (como al cerrar el juego en el resultado)
  await CB(c => { const b = c.raw(); for (const u of b.units) { if (u.side === 'enemy') { u.hp = 0; u.alive = false; } else if (u.type === 'lider') u.hp = 4; } b.ended = true; b.outcome = 'win'; });
  await P(() => window.__pixelia.ctx.router.go('voyage', { resume: true }));
  check(await inVoyage() && (await card()) === 'recompensa', 'al volver con la pelea ganada se ofrece la recompensa');
  check((await P(() => document.querySelectorAll('[data-card="recompensa"] [data-opt]').length)) === 3, 'tres opciones para elegir una');
  check((await text('[data-hp="lider"]')).startsWith('4/'), 'la vida del líder es la que quedó en la pelea', await text('[data-hp="lider"]'));
  await shot('4-recompensa.png');
  await P(() => document.querySelector('[data-card="recompensa"] [data-opt]').click());
  check((await card()) === 'mapa' && (await P(() => document.querySelectorAll('.vy-node.can').length)) > 0, 'elegida la recompensa, se sigue por los nodos conectados');

  console.log('  c. recargar a mitad de la salida');
  const before = await VY(v => JSON.stringify({ pos: v.run.pos, squad: v.run.squad, loot: v.run.loot, relics: v.run.relics }));
  await page.goto(`${BASE}?scene=voyage&nosplash&nosw&quality=low`, { waitUntil: 'load' });
  check(await inVoyage(), 'recarga en la Travesía');
  check((await VY(v => JSON.stringify({ pos: v.run.pos, squad: v.run.squad, loot: v.run.loot, relics: v.run.relics }))) === before, 'la salida sigue donde estaba');
  await P(() => { window.__pixelia.store.state.settings.combatSpeed = 3; window.__pixelia.store.state.settings.confirmEnd = false; });

  console.log('  d. hasta el jefe: eventos, campamento y peleas');
  const kinds = new Set();
  for (let g = 0; g < 30; g++) {
    const st = await VY(v => ({ ...v.view, type: v.run.pos != null ? v.run.map.nodes[v.run.pos].type : null, boss: v.run.map.boss }));
    if (st.ended) break;
    if (!st.pending) { await P((id) => document.querySelector(`.vy-node[data-node="${id}"]`).click(), st.choices[0]); continue; }
    kinds.add(st.pending);
    if (st.pending === 'combate') {
      if (st.type === 'jefe') break;
      await VY(v => { const b = v.run.battle; for (const u of b.units) if (u.side === 'enemy') { u.hp = 0; u.alive = false; } b.ended = true; b.outcome = 'win'; v.finishFight(v.combat.result(b)); });
    } else await P(() => document.querySelector('[data-card] [data-opt]:not([disabled])').click());
  }
  check(kinds.has('combate') && kinds.has('recompensa') && kinds.has('campamento'), 'pasó por peleas, recompensas y el campamento', [...kinds]);
  check((await card()) === 'combate' && /Jefe/.test(await text('[data-card] h2')), 'llega al jefe', await text('[data-card] h2'));
  await shot('5-antes-del-jefe.png');

  console.log('  e. ganarle al jefe por la interfaz del combate');
  await P(() => document.querySelector('[data-a="fight"]').click());
  check(await inCombat(), 'entra al combate del jefe');
  await sleep(2000);
  await CB(c => { for (const u of c.raw().units) { if (u.side === 'ally') { u.atk = 60; u.hp = u.maxHp = 60; } } });
  let guard = 0;
  while (!(await CB(c => c.raw().ended)) && guard++ < 12) {
    for (let k = 0; k < 6; k++) {
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
      if (plan.move) { await CB((c, a) => c.click(a[0], a[1]), ...plan.move); await cbIdle(); k--; continue; }
      await CB((c, a) => { c.ability(a[0]); c.click(a[1], a[2]); }, plan.act, plan.x, plan.y);
      await cbIdle();
      if (await CB(c => c.raw().ended)) break;
    }
    if (await CB(c => c.raw().ended)) break;
    await CB(c => c.endTurn(true));
    await cbIdle();
  }
  check((await CB(c => c.raw().outcome)) === 'win', 'el jefe cae');
  await page.waitForSelector('.cb-result', { timeout: 15000 }).catch(() => {});
  await sleep(600);
  const mats0 = await P(() => JSON.stringify(window.__pixelia.store.state.materials || {}));
  await P(() => document.querySelector('.cb-result [data-a="go"]').click());
  check(await inVoyage() && (await card()) === 'fin', 'cerrar el resultado vuelve a la Travesía, con el resumen');
  const end = await VY(v => ({ outcome: v.run.outcome, haul: v.run.haul, credited: v.run.credited }));
  check(end.outcome === 'win' && end.credited && Object.keys(end.haul.mats).length > 0, 'la salida termina ganada y con botín', end);
  const st = await P(() => ({ mats: JSON.stringify(window.__pixelia.store.state.materials || {}), wins: window.__pixelia.store.state.voyage.wins, runs: window.__pixelia.store.state.voyage.runs }));
  check(st.mats !== mats0 && st.wins === 1 && st.runs === 1, 'el botín se acredita en la ciudad y la salida queda anotada', st);
  check(/El jefe cayó/.test(await text('[data-card]')) && /Trajiste/.test(await text('[data-card]')), 'el resumen dice qué pasó y qué trajiste', await text('[data-card]'));
  await shot('6-resumen.png');

  console.log('  f. de la ciudad a la Travesía');
  await P(() => document.querySelector('[data-a="city"]').click());
  check(await waitFor(() => window.__pixelia.ctx.router.current === 'city' && !!document.querySelector('.voyage-proto-btn'), 30000), 'vuelve a la ciudad, que tiene el botón provisorio');
  check(await P(() => window.__pixelia.store.state.voyage.active === null), 'la salida terminada no queda guardada');
  await sleep(800);
  await shot('7-ciudad-boton.png');
  await P(() => document.querySelector('.voyage-proto-btn').click());
  check(await inVoyage() && (await card()) === 'zarpar', 'el botón abre la Travesía en el muelle: se zarpa cuando se quiere');
  await P(() => document.querySelector('[data-a="sail"]').click());
  check((await card()) === 'mapa' && (await VY(v => v.run.path.length)) === 0 && (await P(() => window.__pixelia.store.state.voyage.runs)) === 2, 'Zarpar arma una salida nueva, sin costo');
  check(errors.length === 0, 'sin errores en la consola', errors.slice(0, 5));
} catch (e) {
  bad++;
  console.log('  MAL  excepción:', e.stack || e.message);
  if (errors.length) console.log(errors.slice(0, 8).join('\n'));
} finally {
  await browser.close();
  server.close();
}

console.log(`\ntest-voyage: ${ok} bien, ${bad} mal`);
process.exit(bad ? 1 : 0);
