// Combate táctico: pruebas del motor puro en Node, sin navegador (DESIGN-COMBAT.md).
//   node tools/test-combat.mjs            todo
//   node tools/test-combat.mjs --quick    sin las corridas largas (se ganan los encuentros, duración del jefe)
//
// Cubre: la API y sus validaciones, determinismo con semilla, marcas antes del golpe, combos, recargas, objetivos
// (derrota, aguante, rescate), jefes (agua, pasarela), herramientas y nivel del líder, retirada, resolución rápida,
// guardar y retomar a mitad de una pelea, que cada encuentro del Acto 1 se pueda ganar con el grupo del tutorial y que
// los jefes duren de 6 a 12 turnos.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { COMBAT, ENCOUNTERS, ACT1, TUTORIAL_PARTY, ENEMIES } from '../src/combat/combat-data.js';
import * as R from '../src/combat/combat-rules.js';
import { botTurn, playBattle, expectedCfg } from './sim-combat.mjs';
import { CLASS_IDS } from '../src/combat/classes.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUICK = process.argv.includes('--quick');
let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✔ ' + msg); } else { fail++; console.log('  ✘ ' + msg); }
}
function section(t) { console.log('\n' + t); }
const J = (x) => JSON.stringify(x);

/** Deja el campo vacío alrededor y pone unidades a mano (el estado es JSON: se puede armar un escenario). */
function scene(encounter = 'bosque_claro', party = ['cazador', 'forjador', 'monje'], extra = {}) {
  const b = R.newBattle({ encounter, seed: 7, party, ...extra });
  b.tiles = b.tiles.map(t => (t === 'arbol' || t === 'roca' ? 'llano' : t));
  return b;
}
const place = (u, x, y) => { u.x = x; u.y = y; };
const byType = (b, t) => b.units.find(u => u.type === t && u.alive);
function mulberry(seed) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Juega con la IA: la suerte del bot sale de (semilla, turno), así se puede cortar y retomar. */
function playFrom(b, maxTurns = 60) {
  for (let k = 0; k < maxTurns && !b.ended; k++) {
    botTurn(b, { noise: 1.2 }, mulberry(b.seed * 31 + b.turn));
    if (b.ended) break;
    R.endTurn(b); R.enemyTurn(b);
  }
  return R.result(b);
}

// ------------------------------------------------------------------ pureza
section('Motor puro');
{
  const src = readFileSync(join(ROOT, 'src/combat/combat-rules.js'), 'utf8') + readFileSync(join(ROOT, 'src/combat/combat-data.js'), 'utf8');
  ok(!/\b(document|window|localStorage|requestAnimationFrame)\b/.test(src.replace(/\/\/.*$/gm, '')), 'sin DOM ni navegador');
  ok(!/from ['"]three|from ['"]\.\.\/core|Math\.random/.test(src), 'sin three.js, sin store y sin Math.random');
}

// ------------------------------------------------------------------ crear y ver
section('newBattle y view');
{
  const b = R.newBattle({ encounter: 'bosque_claro', seed: 3, party: TUTORIAL_PARTY });
  const v = R.view(b);
  ok(v.w === 8 && v.h === 8 && v.tiles.length === 64, 'grilla de 8×8');
  ok(v.tiles.some(t => t.t === 'arbol'), 'con obstáculos según el terreno');
  ok(v.units.filter(u => u.side === 'ally').length === 4, 'el líder y 3 integrantes');
  ok(v.units.find(u => u.type === 'lider').abilities.some(a => a.id === 'golpe'), 'el líder tiene su golpe');
  ok(v.units.find(u => u.type === 'cazador').abilities.map(a => a.id).join() === 'tiro,marcar,tiro_pie', 'la clase define el kit (cazador: tiro, marcar y tiro al pie)');
  ok(v.phase === 'player' && v.turn === 1 && v.canEnd, 'arranca el turno del grupo');
  ok(J(b) === J(JSON.parse(J(b))), 'la pelea es JSON puro');
  const b2 = R.newBattle({ encounter: 'bosque_claro', seed: 3, party: TUTORIAL_PARTY });
  ok(J(b) === J(b2), 'misma semilla, misma pelea');
  const maps = new Set([1, 2, 3, 4, 5, 6].map(s => R.newBattle({ encounter: 'bosque_manada', seed: s, party: TUTORIAL_PARTY }).tiles.join()));
  ok(maps.size > 1, 'la semilla varía el mapa (espejo y obstáculos)');
  let err = null; try { R.newBattle({ encounter: 'nada' }); } catch (e) { err = e; }
  ok(!!err, 'un encuentro desconocido falla');
}

// ------------------------------------------------------------------ mover
section('move');
{
  const b = scene();
  const L = byType(b, 'lider');
  const reach = R.reachable(b, L.id);
  ok(reach.length > 1 && reach.every(t => t.cost <= L.mv), 'reachable respeta el movimiento');
  const far = { x: L.x, y: Math.max(0, L.y - 5) };
  ok(!R.move(b, L.id, far.x, far.y).ok, 'no llega más lejos que su movimiento');
  const t = reach.find(r => r.cost > 0);
  const r = R.move(b, L.id, t.x, t.y);
  ok(r.ok && r.events[0].type === 'move' && r.events[0].path.length >= 2, 'se mueve y devuelve el camino');
  ok(!R.move(b, L.id, L.x, L.y - 1).ok, 'una sola vez por turno');
  const E = byType(b, 'cazador');
  b.tiles[(E.y - 1) * 8 + E.x] = 'roca';
  ok(!R.move(b, E.id, E.x, E.y - 1).ok, 'no se pisa una roca');
  const foe = b.units.find(u => u.side === 'enemy');
  ok(!R.move(b, foe.id, foe.x, foe.y + 1).ok, 'no se mueven enemigos');
  // trabado
  const G = byType(b, 'monje'), I = byType(b, 'forjador');
  place(foe, 4, 3); place(I, 4, 4); place(G, 3, 3);
  ok(R.reachable(b, I.id).every(t => t.cost <= COMBAT.stuckMv), 'trabado: al lado de un enemigo se mueve 1');
  ok(R.reachable(b, G.id).some(t => t.cost > 1), 'la guía no se traba');
}

// ------------------------------------------------------------------ marcas antes del golpe
section('Intenciones a la vista');
{
  const b = scene('bosque_claro', ['forjador', 'curandero', 'monje']);
  const [w1, w2] = b.units.filter(u => u.side === 'enemy');
  const L = byType(b, 'lider'), S = byType(b, 'curandero');
  place(w1, 3, 3); place(w2, 7, 0); place(L, 3, 5); place(S, 0, 7);
  R.endTurn(b);
  const e1 = R.enemyTurn(b);
  ok(e1.events.some(e => e.type === 'intent'), 'al final de su turno marcan el golpe');
  const v = R.view(b);
  const marked = v.units.find(u => u.id === w1.id).intent;
  ok(marked && marked.tiles.length > 0 && !marked.hidden, 'la vista muestra las casillas marcadas');
  ok(v.tiles.some(t => t.danger > 0), 'el mapa de peligro suma las marcas');
  // quien queda en una casilla marcada recibe; quien sale, no
  const target = b.units.find(u => u.side === 'ally' && R.intentTiles(b, w1).some(([x, y]) => x === u.x && y === u.y));
  ok(!!target, 'el lobo marcó a alguien del grupo');
  const hpBefore = target.hp;
  const safe = R.reachable(b, target.id).find(t => !R.intentTiles(b, w1).some(([x, y]) => x === t.x && y === t.y) && R.dangerMap(b)[t.y * 8 + t.x] === 0);
  R.move(b, target.id, safe.x, safe.y);
  R.endTurn(b);
  const e2 = R.enemyTurn(b);
  ok(e2.events.some(e => e.type === 'strike' && e.id === w1.id), 'en su turno ejecuta lo marcado');
  const si = e2.events.findIndex(e => e.type === 'strike' && e.id === w1.id);
  let hitByStrike = false;
  for (let k = si + 1; k < e2.events.length && ['dmg', 'down', 'combo', 'explode'].includes(e2.events[k].type); k++) if (e2.events[k].id === target.id) hitByStrike = true;
  ok(!hitByStrike && target.hp >= hpBefore - (ENEMIES.lobo.nip || 0) * 2, 'si salís de la marca no te pega');
  // el Catalejo muestra más intenciones
  const many = R.newBattle({ encounter: 'cerro_veta', seed: 2, party: TUTORIAL_PARTY });
  R.endTurn(many); R.enemyTurn(many);
  const base = R.visibleIntentIds(many).size;
  many.tools.catalejo = 5;
  ok(base === COMBAT.intentsBase + many.intentPlus && many.intentPlus === 1 && R.visibleIntentIds(many).size > base, `Catalejo: de ${base} a ${R.visibleIntentIds(many).size} intenciones a la vista`);
  many.tools.catalejo = 0;
  for (const e of many.units.filter(u => u.side === 'enemy')) e.intent = { id: 'chispazo', name: 'Chispazo', pattern: 'line2', dmg: 2, dir: [0, 1], len: 0 };
  const hidden = R.view(many).units.filter(u => u.intent?.hidden).length;
  ok(hidden === many.units.filter(u => u.side === 'enemy').length - COMBAT.intentsBase - many.intentPlus, `las que no se ven quedan ocultas (${hidden})`);
}

// ------------------------------------------------------------------ acciones, recargas y combos
section('act, recargas y combos');
{
  const b = scene('bosque_claro', ['cazador', 'forjador', 'monje']);
  const [w1, w2] = b.units.filter(u => u.side === 'enemy');
  const L = byType(b, 'lider'), E = byType(b, 'cazador'), I = byType(b, 'forjador'), G = byType(b, 'monje');
  place(w1, 4, 3); place(w2, 7, 0); place(L, 0, 7); place(E, 4, 6); place(I, 6, 3); place(G, 3, 3);
  // marcar y pegar
  let r = R.act(b, E.id, 'marcar', 4, 3);
  ok(r.ok && w1.marked === COMBAT.markBonus, 'exploración marca');
  ok(!R.act(b, E.id, 'tiro', 4, 3).ok, 'una acción por turno');
  // trampa al lado y empuje a la trampa
  r = R.act(b, I.id, 'trampa', 5, 3);
  ok(r.ok && b.traps.length === 1, 'ingeniería deja una trampa');
  const hp0 = w1.hp;
  r = R.act(b, G.id, 'empujar', 4, 3);
  ok(r.ok && w1.x === 5 && w1.y === 3, 'la guía empuja una casilla');
  ok(r.events.some(e => e.type === 'combo' && e.id === 'empuje_trampa') && r.events.some(e => e.type === 'combo' && e.id === 'marca'), 'combos: a la trampa y marcar y pegar');
  ok(hp0 - w1.hp === Math.min(hp0, 1 + COMBAT.markBonus + 3) && w1.root > 0, 'la marca suma +3 y la trampa frena');
  ok(!b.traps.length && !w1.marked, 'la trampa y la marca se gastan');
  // recargas
  R.endTurn(b); R.enemyTurn(b);
  if (!b.ended) {
    const cd = R.abilitiesOf(b, G.id).find(a => a.id === 'empujar');
    ok(!cd.ready && cd.cd === 1, 'empujar tiene 1 turno de recarga');
    ok(R.act(b, G.id, 'empujar', w1.x, w1.y).why?.startsWith('Falta'), 'con recarga no se puede');
    R.endTurn(b); R.enemyTurn(b);
    ok(b.ended || R.abilitiesOf(b, G.id).find(a => a.id === 'empujar').ready, 'al turno siguiente vuelve');
  }
  // empujar corre la marca (es relativa) y contra algo hace daño
  const c = scene('bosque_claro', ['monje', 'curandero', 'forjador']);
  const [a1, a2] = c.units.filter(u => u.side === 'enemy');
  const g = byType(c, 'monje'), L2 = byType(c, 'lider'), S2 = byType(c, 'curandero'), I2 = byType(c, 'forjador');
  place(a1, 4, 2); place(a2, 6, 0); place(g, 4, 3); place(L2, 0, 7); place(S2, 1, 7); place(I2, 2, 7);
  a1.intent = { id: 'mordida', name: 'Mordida', pattern: 'ring', dmg: 3, dir: [0, 1], len: 0 };
  const before = R.intentTiles(c, a1).map(J).sort().join();
  R.act(c, g.id, 'empujar', 4, 2);
  const after = R.intentTiles(c, a1).map(J).sort().join();
  ok(a1.y === 1 && before !== after && !R.intentTiles(c, a1).some(([x, y]) => x === 4 && y === 3), 'empujado, su golpe se corre con él');
  const d = scene('bosque_claro', ['monje', 'curandero', 'forjador']);
  const [d1] = d.units.filter(u => u.side === 'enemy');
  const dg = byType(d, 'monje');
  place(d1, 4, 0); place(dg, 4, 1);
  const dh = d1.hp;
  const rr = R.act(d, dg.id, 'empujar', 4, 0);
  ok(rr.events.some(e => e.type === 'combo' && e.id === 'empuje_choque') && dh - d1.hp === 1 + COMBAT.collideDmg, 'contra el borde: choque de 2');
  // fuego amigo: el golpe marcado pega a otro enemigo
  const f = scene('bosque_claro', ['monje', 'curandero', 'forjador']);
  const [f1, f2] = f.units.filter(u => u.side === 'enemy');
  for (const u of f.units.filter(u => u.side === 'ally')) place(u, u.x, 7);
  place(byType(f, 'lider'), 0, 7);
  place(f1, 3, 3); place(f2, 4, 3);
  f1.intent = { id: 'mordida', name: 'Mordida', pattern: 'ring', dmg: 3, dir: [0, 1], len: 0 };
  f2.intent = null;
  R.endTurn(f);
  const fe = R.enemyTurn(f);
  ok(fe.events.some(e => e.type === 'combo' && e.id === 'fuego_amigo') && f2.hp === f2.maxHp - 3, 'las marcas pegan también a los enemigos');
}

// ------------------------------------------------------------------ elemento y nivel del líder
section('Raíz y nivel del líder');
{
  const b1 = R.newBattle({ encounter: 'bosque_claro', seed: 1, party: TUTORIAL_PARTY, level: 1, element: 'raiz' });
  const b5 = R.newBattle({ encounter: 'bosque_claro', seed: 1, party: TUTORIAL_PARTY, level: 5, element: 'raiz' });
  const L1 = byType(b1, 'lider'), L5 = byType(b5, 'lider');
  ok(L1.abilities.includes('enredar') && !L1.abilities.includes('muro_raiz'), 'nivel 1: un espacio (Enredar)');
  ok(L5.abilities.includes('muro_raiz'), 'nivel 5: abre otro espacio (Muro de raíz)');
  ok(L5.maxHp > L1.maxHp && L5.atk > L1.atk, `nivel 5: más vida (${L1.maxHp}→${L5.maxHp}) y ataque (${L1.atk}→${L5.atk})`);
  ok(!byType(R.newBattle({ encounter: 'bosque_claro', seed: 1, party: TUTORIAL_PARTY, level: 9 }), 'lider').abilities.includes('enredar'), 'sin elemento no hay habilidad de elemento');
  const b = scene('bosque_claro', TUTORIAL_PARTY, { element: 'raiz' });
  const [w] = b.units.filter(u => u.side === 'enemy');
  const L = byType(b, 'lider');
  place(w, 4, 2); place(L, 4, 4);
  w.intent = { id: 'mordida', name: 'Mordida', pattern: 'ring', dmg: 3, dir: [0, 1], len: 0 };
  const r = R.act(b, L.id, 'enredar', 4, 2);
  ok(r.ok && !w.intent && w.root === 1, 'Enredar frena: pierde el golpe marcado y no se mueve');
  ok(b.walls.length === 1 && b.walls[0].root && Math.abs(b.walls[0].x - 4) + Math.abs(b.walls[0].y - 2) === 1, 'y levanta una pared de raíz al lado');
  ok(!R.move(b, byType(b, 'curandero').id, b.walls[0].x, b.walls[0].y).ok, 'la pared corta el paso');
  // el jefe no se frena
  const k = R.newBattle({ encounter: 'banado_bestia', seed: 1, party: TUTORIAL_PARTY, level: 1, element: 'raiz' });
  const bs = k.units.find(u => u.type === 'bestia');
  const kl = byType(k, 'lider');
  place(bs, 4, 3); place(kl, 4, 5);
  bs.intent = { id: 'coletazo', name: 'Coletazo', pattern: 'line3', dmg: 4, dir: [0, 1], len: 0 };
  R.act(k, kl.id, 'enredar', 4, 3);
  ok(!!bs.intent && bs.root === 1, 'a un jefe lo enreda pero no le saca el golpe');
}

// ------------------------------------------------------------------ herramientas de L5
section('Herramientas (L5)');
{
  const mk = (tools) => scene('bosque_claro', ['cazador', 'forjador', 'curandero'], { tools });
  const a = mk({}), m = mk({ martillo: 3 });
  for (const b of [a, m]) R.act(b, byType(b, 'forjador').id, 'trampa', byType(b, 'forjador').x, byType(b, 'forjador').y - 1);
  ok(m.traps[0].dmg > a.traps[0].dmg, `Martillo: la trampa pega más (${a.traps[0].dmg}→${m.traps[0].dmg})`);
  const h0 = mk({}), h3 = mk({ botiquin: 3 });
  for (const b of [h0, h3]) { const L = byType(b, 'lider'); L.hp = 2; const S = byType(b, 'curandero'); place(S, L.x + 1, L.y); R.act(b, S.id, 'curar', L.x, L.y); }
  ok(byType(h3, 'lider').hp > byType(h0, 'lider').hp, 'Botiquín: la sanidad cura más');
  const c0 = scene('banado_bestia', TUTORIAL_PARTY), c3 = scene('banado_bestia', TUTORIAL_PARTY, { tools: { cuerda: 3 } });
  const climb = (b) => { const L = byType(b, 'lider'); const al = b.tiles.findIndex((t, i) => t === 'alto' && Math.abs((i % 8) - L.x) + Math.abs(((i / 8) | 0) - L.y) === 1); return R.reachable(b, L.id).find(t => t.y * 8 + t.x === al)?.cost; };
  ok(climb(c3) < climb(c0), `Cuerda: subir a lo alto cuesta menos (${climb(c0)}→${climb(c3)})`);
  const g0 = scene('bosque_claro', TUTORIAL_PARTY), g3 = scene('bosque_claro', TUTORIAL_PARTY, { tools: { farol: 3 } });
  for (const b of [g0, g3]) {
    const [w] = b.units.filter(u => u.side === 'enemy');
    const L = byType(b, 'lider'), S = byType(b, 'curandero');
    place(L, 3, 5); place(S, 4, 5); place(w, 4, 4);
    w.intent = { id: 'mordida', name: 'Mordida', pattern: 'ring', dmg: 3, dir: [0, 1], len: 0 };
    w.mv = 0;
    R.endTurn(b); R.enemyTurn(b);
  }
  ok(byType(g3, 'curandero').hp > byType(g0, 'curandero').hp, 'Farol de guardia: al lado del líder se recibe menos');
  // ninguna herramienta es obligatoria: la pelea común se gana sin ninguna (ver abajo, grupo del tutorial)
}

// ------------------------------------------------------------------ consumibles del Taller
section('Consumibles');
{
  const b = scene('bosque_claro', TUTORIAL_PARTY, { equip: ['botiquin', 'farol', 'lona'] });
  const L = byType(b, 'lider');
  L.hp = 3;
  ok(R.abilitiesOf(b, L.id).some(a => a.id === 'item:botiquin'), 'lo del Taller aparece como acción');
  const r = R.act(b, L.id, 'item:botiquin', L.x, L.y);
  ok(r.ok && L.hp === 8 && b.items.botiquin === 0, 'el botiquín cura 5 y se gasta');
  ok(!R.abilitiesOf(b, byType(b, 'curandero').id).some(a => a.id === 'item:botiquin'), 'un uso por pelea');
  const [w] = b.units.filter(u => u.side === 'enemy');
  const E = byType(b, 'cazador');
  place(w, E.x, E.y - 2);
  w.intent = { id: 'mordida', name: 'Mordida', pattern: 'ring', dmg: 3, dir: [0, 1], len: 0 };
  R.act(b, E.id, 'item:farol', E.x, E.y);
  ok(!w.intent, 'el farol encandila: pierden el golpe marcado');
}

// ------------------------------------------------------------------ objetivos
section('Objetivos');
{
  // aguante
  const s = R.newBattle({ encounter: 'banado_juncal', seed: 4, party: TUTORIAL_PARTY });
  ok(R.view(s).objective.text.startsWith('Aguantá 5'), 'aguante: el objetivo dice cuántos turnos');
  let spawned = false, saw = false;
  for (let k = 0; k < 6 && !s.ended; k++) {
    if (s.incoming.length) saw = true;
    R.endTurn(s);
    const e = R.enemyTurn(s);
    if (e.events.some(x => x.type === 'spawn')) spawned = true;
  }
  ok(saw && spawned, 'los refuerzos se ven un turno antes y llegan');
  ok(s.ended, `aguante: la pelea termina (${s.outcome}, ${s.reason})`);
  const s2 = R.newBattle({ encounter: 'banado_juncal', seed: 4, party: TUTORIAL_PARTY });
  for (let k = 0; k < 8 && !s2.ended; k++) {
    R.endTurn(s2); R.enemyTurn(s2);
    for (const e of s2.units.filter(u => u.side === 'enemy')) { e.alive = false; }
  }
  ok(s2.outcome === 'win' && s2.reason === 'aguante' && s2.turn === 5, 'aguante: al terminar el turno 5 se gana');
  // rescate
  const r = scene('cerro_rescate', TUTORIAL_PARTY);
  const c = r.units.find(u => u.captive);
  const L = byType(r, 'lider');
  for (const e of r.units.filter(u => u.side === 'enemy')) place(e, 7, 0);
  ok(!R.move(r, c.id, c.x, c.y + 1).ok, 'rescate: atado no se mueve');
  place(L, c.x, c.y + 1);
  ok(R.act(r, L.id, 'liberar', c.x, c.y).ok && c.freed, 'cualquiera del grupo lo desata');
  R.endTurn(r); R.enemyTurn(r);
  const ex = r.exits[0];
  place(c, ex[0], ex[1] - 1);
  r.tiles[(ex[1] - 1) * 8 + ex[0]] = 'llano';
  const mv = R.move(r, c.id, ex[0], ex[1]);
  ok(mv.ok && r.ended && r.outcome === 'win' && r.reason === 'rescate', 'llega a la salida: se gana');
  const res = R.result(r);
  ok(res.stars >= 1 && res.loot.mats && Object.keys(res.loot.mats).length > 0 && res.xp > 0, 'ganar da botín y experiencia');
  // perder si cae el líder
  const l = scene('bosque_claro', TUTORIAL_PARTY);
  const [w] = l.units.filter(u => u.side === 'enemy');
  const LL = byType(l, 'lider');
  LL.hp = 1; place(w, LL.x, LL.y - 1);
  w.intent = { id: 'mordida', name: 'Mordida', pattern: 'ring', dmg: 3, dir: [0, 1], len: 0 };
  R.endTurn(l); R.enemyTurn(l);
  ok(l.ended && l.outcome === 'lose' && l.reason === 'lider', 'si cae el líder, el grupo se repliega (derrota)');
  ok(R.result(l).morale === COMBAT.morale.lose && R.result(l).xp > 0, 'perder cuesta ánimo pero deja algo de experiencia');
  // noche
  const n = R.newBattle({ encounter: 'bosque_claro', seed: 4, party: TUTORIAL_PARTY });
  for (const e of n.units.filter(u => u.side === 'enemy')) { e.mv = 0; e.x = 7; }
  for (let k = 0; k < 30 && !n.ended; k++) { R.endTurn(n); R.enemyTurn(n); for (const e of n.units.filter(u => u.side === 'enemy')) e.intent = null; }
  ok(n.outcome === 'lose' && n.reason === 'noche' && n.turn === n.maxTurns + 1, `si se llega al turno ${n.maxTurns} se hace de noche`);
}

// ------------------------------------------------------------------ jefes
section('Jefes');
{
  const b = R.newBattle({ encounter: 'banado_bestia', seed: 2, party: TUTORIAL_PARTY });
  R.endTurn(b);
  R.enemyTurn(b);
  ok(b.floodNext.length > 0 && R.view(b).tiles.some(t => t.floodNext), 'la bestia marca dónde va a subir el agua');
  const next = b.floodNext.slice();
  ok(next.every(i => b.tiles[i] !== 'alto'), 'lo alto no se inunda');
  const L = byType(b, 'lider');
  const wet = next[0];
  const occ = b.units.find(u => u.alive && u.y * 8 + u.x === wet);
  if (occ) place(occ, 0, 0);
  place(L, wet % 8, (wet / 8) | 0);
  for (const e of b.units.filter(u => u.side === 'enemy')) e.intent = null;
  const hp = L.hp;
  R.endTurn(b);
  const ev = R.enemyTurn(b);
  ok(ev.events.some(e => e.type === 'flood') && b.flood[wet] > 0, 'el agua sube donde marcó');
  ok(L.hp === hp - COMBAT.floodDmg[0] || b.ended, 'el agua tira: quien está abajo recibe daño');
  // capitana y pasarela
  // con el grupo del abordaje (la gente de la ciudad en el rango 6): uno de nivel 1 cae antes de que lleguen refuerzos
  const c = R.newBattle({ encounter: 'costa_capitana', seed: 2, party: ['saqueador', 'cazador', 'curandero'], level: 7, classLevel: { saqueador: 10, cazador: 10, curandero: 9 } });
  ok(c.bridge && c.bridge.tiles.length === 2, 'la capitana trae una pasarela');
  let arrived = false;
  for (let k = 0; k < 2; k++) { R.endTurn(c); if (R.enemyTurn(c).events.some(e => e.type === 'spawn' && e.from === 'bridge')) arrived = true; }
  ok(arrived, 'llama refuerzos por la pasarela');
  const Rc = byType(c, 'saqueador');
  const [px, py] = c.bridge.tiles.find(([x, y]) => !R.unitAt(c, x, y));
  place(Rc, px + 1, py);
  if (R.unitAt(c, px + 1, py) !== Rc) place(Rc, px + 1, py);
  const hp0 = c.bridge.hp;
  Rc.cd = {};
  R.act(c, Rc.id, 'romper', px, py);
  ok(hp0 - c.bridge.hp === Math.min(hp0, 2 * (Rc.atk + 2)), 'Romper pega doble a la pasarela (hasta cortarla)');
  const z = scene('costa_capitana', ['saqueador', 'cazador', 'curandero']);
  for (const e of z.units.filter(u => u.side === 'enemy' && u.type !== 'capitana')) e.alive = false;
  const zc = z.units.find(u => u.type === 'capitana');
  place(zc, 7, 0);
  const zr = byType(z, 'saqueador');
  const [bx, by] = z.bridge.tiles[0];
  place(zr, bx + 1, by);
  z.bridge.hp = 1;
  const cut = R.act(z, zr.id, 'golpe', bx, by);
  ok(cut.ok && cut.events.some(e => e.type === 'bridgeCut') && z.bridge.cut && z.tiles[by * 8 + bx] === 'vacio', 'se corta la pasarela');
  let more = false;
  for (let k = 0; k < 4 && !z.ended; k++) { R.endTurn(z); if (R.enemyTurn(z).events.some(e => e.type === 'spawn' && e.from === 'bridge')) more = true; }
  ok(!more && R.result({ ...z, outcome: 'win' }).challenges.find(c => c.id === 'pasarela').done, 'cortada, no llegan más (y cuenta el desafío)');
  // revancha
  const a1 = R.newBattle({ encounter: 'banado_bestia', seed: 1, party: TUTORIAL_PARTY, attempt: 1 });
  const a3 = R.newBattle({ encounter: 'banado_bestia', seed: 1, party: TUTORIAL_PARTY, attempt: 3 });
  ok(a3.units.find(u => u.type === 'bestia').maxHp < a1.units.find(u => u.type === 'bestia').maxHp && byType(a3, 'lider').maxHp > byType(a1, 'lider').maxHp, 'revancha: cada intento fallido ayuda un poco');
}

// ------------------------------------------------------------------ retirada y resolución rápida
section('Retirada y resolución rápida');
{
  const b = R.newBattle({ encounter: 'bosque_manada', seed: 1, party: TUTORIAL_PARTY });
  const r = R.retreat(b);
  ok(r.ok && b.ended && b.outcome === 'retreat', 'se puede retirar');
  ok(R.result(b).morale === COMBAT.morale.retreat && R.result(b).stars === 0, 'retirarse cuesta menos ánimo que perder');
  ok(!R.retreat(b).ok && !R.move(b, byType(b, 'lider').id, 0, 0).ok && !R.endTurn(b).ok, 'terminada, no se puede seguir');
  ok(!R.canQuickResolve('bosque_manada', 0), 'una pelea nunca ganada no se resuelve rápido');
  ok(!R.canQuickResolve('banado_bestia', 3), 'un jefe no se resuelve rápido');
  const q = R.quickResolve({ encounter: 'bosque_manada', wins: 1 });
  ok(q && q.outcome === 'win' && q.quick && q.stars === 1 && Object.values(q.loot.mats).every(n => n >= 1), 'una común ya ganada se resuelve rápido, con menos botín');
}

// ------------------------------------------------------------------ determinismo y guardado
section('Determinismo, guardar y retomar');
{
  const cfg = { encounter: 'bosque_manada', seed: 42, party: ['cazador', 'monje', 'curandero'], level: 2 };
  const a = playFrom(R.newBattle(cfg)), b = playFrom(R.newBattle(cfg));
  ok(J(a) === J(b), `mismas acciones, mismo resultado (${a.outcome} en ${a.turns} turnos)`);
  for (const id of ['bosque_manada', 'cerro_rescate', 'banado_bestia', 'costa_capitana']) {
    const c = { encounter: id, seed: 9, party: TUTORIAL_PARTY, level: ENCOUNTERS[id].expected.level, element: ENCOUNTERS[id].expected.element };
    const full = playFrom(R.newBattle(c));
    const half = R.newBattle(c);
    playFrom(half, 3);
    const saved = JSON.stringify(half);                // lo que va a state.expedition.active
    const resumed = playFrom(JSON.parse(saved));
    ok(J(full) === J(resumed), `${id}: guardar en el turno ${JSON.parse(saved).turn} y retomar da lo mismo (${full.outcome}, ${full.turns} turnos)`);
  }
  // a mitad del turno del grupo también
  const m = R.newBattle({ encounter: 'costa_muelle', seed: 5, party: TUTORIAL_PARTY, level: 6 });
  playFrom(m, 2);
  const L = byType(m, 'lider');
  const t = R.reachable(m, L.id).find(r => r.cost > 0);
  if (t) R.move(m, L.id, t.x, t.y);
  const copy = JSON.parse(JSON.stringify(m));
  ok(J(playFrom(m)) === J(playFrom(copy)), 'guardar a mitad del turno del grupo y retomar da lo mismo');
}

// ------------------------------------------------------------------ previsualización
section('preview');
{
  const b = scene('bosque_claro', TUTORIAL_PARTY);
  const [w] = b.units.filter(u => u.side === 'enemy');
  const L = byType(b, 'lider');
  place(w, 4, 3); place(L, 4, 5);
  const snap = J(b);
  const p = R.preview(b, L.id, 'golpe', 4, 3, [4, 4]);
  ok(p.ok && p.events.some(e => e.type === 'dmg' && e.id === w.id), 'muestra el daño desde otra casilla');
  ok(J(b) === snap, 'sin tocar la pelea');
}

// ------------------------------------------------------------------ corridas largas
if (!QUICK) {
  section('Cada encuentro del Acto 1 se gana con el grupo del tutorial (líder nivel 1, sin herramientas ni elemento)');
  for (const id of ACT1.filter(id => !ENCOUNTERS[id].expected?.city)) {   // el abordaje lo pelea la gente de la ciudad
    const N = 30;
    let w = 0;
    for (let s = 1; s <= N; s++) w += playBattle({ encounter: id, seed: s, party: TUTORIAL_PARTY, level: 1 }).res.outcome === 'win';
    // con las clases, el grupo esperado de la Costa ya tiene nivel de clase 4: el del tutorial queda más lejos (jefes: 10 %)
    const min = ENCOUNTERS[id].kind === 'jefe' ? 0.1 : 0.5;
    ok(w / N >= min, `${ENCOUNTERS[id].name}: ${w}/${N} ganadas (mínimo ${Math.round(min * 100)} %)`);
  }
  section('Los jefes duran de 6 a 12 turnos (grupo esperado con nivel de clase, el líder de cada clase, primer intento, ganadas)');
  for (const id of ACT1.filter(id => ENCOUNTERS[id].kind === 'jefe')) {
    const ex = ENCOUNTERS[id].expected;
    const turns = [];
    for (let s = 1; s <= 60; s++) {
      const { res } = playBattle(expectedCfg(id, TUTORIAL_PARTY, s, {}, CLASS_IDS[s % CLASS_IDS.length]));
      if (res.outcome === 'win') turns.push(res.turns);
    }
    const avg = turns.reduce((a, n) => a + n, 0) / Math.max(1, turns.length);
    const within = turns.filter(t => t >= 6 && t <= 12).length / Math.max(1, turns.length);
    ok(turns.length > 0 && avg >= 6 && avg <= 12 && within >= 0.7, `${ENCOUNTERS[id].name}: ${avg.toFixed(1)} turnos de promedio, ${(within * 100).toFixed(0)} % entre 6 y 12 (${turns.length} ganadas)`);
  }
}

console.log(`\n${fail ? '✘' : '✔'} ${pass} bien, ${fail} mal`);
process.exitCode = fail ? 1 : 0;
