// Combate apto para farmear (PLAN-FOTO, paso A2): pruebas del motor puro en Node.
//   node tools/test-combat-farm.mjs            todo
//   node tools/test-combat-farm.mjs --quick    sin las corridas con el bot
// Cubre: tablero de 6×6 (8×8 en la historia y los jefes), los encuentros del Bosque del Arroyo en Marea I a III, los
// arquetipos de IA (huye y tira, cubre, invoca, carga, revienta, cura), el terreno (cobertura, fuego, corriente), las
// reacciones de elementos, los fragmentos de veta, la resolución automática y una pelea guardada antes de este paso.
import { COMBAT, ENCOUNTERS, ENEMIES, FARM, TILES, FRAGMENTS, MAREA_MAX } from '../src/combat/combat-data.js';
import * as R from '../src/combat/combat-rules.js';
import { playBattle, expectedCfg } from './sim-combat.mjs';

const QUICK = process.argv.includes('--quick');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✔ ' + msg); } else { fail++; console.log('  ✘ ' + msg); } }
function section(t) { console.log('\n' + t); }
const man = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const I = (b, x, y) => y * b.w + x;
const PARTY = ['cazador', 'forjador', 'monje'];

/** Un claro de 6×6 vacío: el grupo abajo (fila 5) y los enemigos fuera, para poner a mano los que hagan falta. */
function arena(extra = {}) {
  const b = R.newBattle({ encounter: 'arroyo_lobos', seed: 3, party: PARTY, ...extra });
  b.tiles = b.tiles.map(() => 'llano');
  b.units.filter(u => u.side === 'ally').forEach((u, k) => { u.x = k + 1; u.y = 5; });
  for (const u of b.units) if (u.side === 'enemy') { u.alive = false; u.intent = null; }
  return b;
}
const ally = (b, t) => b.units.find(u => u.type === t);
let slot = 0;
function foe(b, type, x, y, hp) {
  const u = b.units.filter(k => k.side === 'enemy')[slot++ % 3];
  const d = ENEMIES[type];
  Object.assign(u, { type, x, y, alive: true, mv: d.mv, armor: d.armor || 0, hp: hp ?? d.hp, maxHp: d.hp, intent: null, root: 0, wet: 0, burn: 0, born: 1 });
  return u;
}
const tile = (b, x, y, t) => { b.tiles = b.tiles.slice(); b.tiles[I(b, x, y)] = t; };
const pass1 = (b) => { R.endTurn(b); return R.enemyTurn(b).events; };
const has = (ev, type, f = () => true) => ev.some(e => e.type === type && f(e));

// ---------------------------------------------------------------- tablero y encuentros
section('Tablero: 6×6 en el farmeo, 8×8 en la historia y los jefes');
{
  const f = R.newBattle({ encounter: 'arroyo_lobos', seed: 1, party: PARTY });
  const h = R.newBattle({ encounter: 'bosque_claro', seed: 1, party: PARTY });
  const j = R.newBattle({ encounter: 'banado_bestia', seed: 1, party: PARTY });
  ok(f.w === 6 && f.h === 6 && f.tiles.length === 36 && f.flood.length === 36, 'un encuentro del farmeo arma un tablero de 6×6');
  ok(h.w === 8 && h.h === 8 && j.w === 8 && j.h === 8, 'la historia y los jefes siguen en 8×8');
  ok(f.maxTurns === COMBAT.maxTurns.farm && h.maxTurns === COMBAT.maxTurns.comun, `tope de turnos: ${f.maxTurns} en el farmeo, ${h.maxTurns} en la historia`);
  const v = R.view(f);
  ok(v.w === 6 && v.tiles.length === 36 && v.farm && v.marea === 1, 'view() informa el tamaño, que es de farmeo y la Marea');
}

section('Encuentros del Bosque del Arroyo');
{
  const ids = [...FARM.arroyo.comunes, ...FARM.arroyo.elites];
  ok(FARM.arroyo.comunes.length >= 15 && FARM.arroyo.elites.length >= 2, `${FARM.arroyo.comunes.length} comunes y ${FARM.arroyo.elites.length} élites`);
  const kinds = new Set(ids.flatMap(id => [...ENCOUNTERS[id].enemies, ...(ENCOUNTERS[id].waves || []).flatMap(w => w.kinds)]));
  ok(kinds.size >= 10, `${kinds.size} enemigos comunes distintos en la isla (${[...kinds].join(', ')})`);
  const ais = new Set([...kinds].map(k => ENEMIES[k].ai || (ENEMIES[k].explode ? 'explode' : ENEMIES[k].flies ? 'flies' : ENEMIES[k].swims ? 'swims' : 'base')));
  ok(['kite', 'guard', 'summon', 'charge', 'heal', 'explode'].every(a => ais.has(a)), 'están el que huye y tira, el que cubre, el que invoca, el que carga, el que cura y el que revienta');
  let bad = [];
  for (const id of ids) for (let m = 1; m <= MAREA_MAX; m++) for (let seed = 1; seed <= 12; seed++) {
    const enc = ENCOUNTERS[id];
    if (enc.map.length !== 6 || enc.map.some(r => r.length !== 6)) { bad.push(id + ': mapa'); break; }
    const b = R.newBattle({ encounter: id, seed, party: PARTY, marea: m });
    const us = b.units.filter(u => u.alive);
    const spots = new Set(us.map(u => I(b, u.x, u.y)));
    if (spots.size !== us.length) bad.push(`${id} m${m} s${seed}: dos en la misma casilla`);
    if (us.some(u => TILES[b.tiles[I(b, u.x, u.y)]].block)) bad.push(`${id} m${m} s${seed}: alguien sobre un obstáculo`);
    if (us.filter(u => u.side === 'ally').length !== 4) bad.push(`${id}: faltan lugares para el grupo`);
    const want = enc.enemies.length + COMBAT.marea[m].extra;
    if (us.filter(u => u.side === 'enemy').length !== want) bad.push(`${id} m${m} s${seed}: ${us.filter(u => u.side === 'enemy').length} enemigos, se esperaban ${want}`);
    R.view(b);
  }
  ok(!bad.length, 'todos arman bien en Marea I, II y III con 12 semillas' + (bad.length ? ': ' + bad.slice(0, 4).join(' · ') : ''));
  const a = R.pickEncounter({ island: 'arroyo', seed: 5 }), a2 = R.pickEncounter({ island: 'arroyo', seed: 5 });
  const others = new Set(Array.from({ length: 40 }, (_, k) => R.pickEncounter({ island: 'arroyo', seed: k })));
  ok(a === a2 && FARM.arroyo.comunes.includes(a) && others.size >= 8, `pickEncounter: misma semilla, mismo encuentro; ${others.size} distintos en 40 semillas`);
  ok(R.pickEncounter({ island: 'arroyo', seed: 5, avoid: [a] }) !== a && FARM.arroyo.elites.includes(R.pickEncounter({ island: 'arroyo', seed: 2, elite: true })), 'no repite lo que ya salió y sabe elegir élites');
}

section('Marea I a III');
{
  const b1 = R.newBattle({ encounter: 'arroyo_lobos', seed: 1, party: PARTY });
  const b2 = R.newBattle({ encounter: 'arroyo_lobos', seed: 1, party: PARTY, marea: 2 });
  const b3 = R.newBattle({ encounter: 'arroyo_lobos', seed: 1, party: PARTY, marea: 3 });
  const hp = (b) => b.units.find(u => u.type === 'lobo').maxHp;
  ok(hp(b1) === ENEMIES.lobo.farmHp && hp(b2) === Math.round(ENEMIES.lobo.farmHp * 1.3) && hp(b3) > hp(b2), `la vida del lobo sube con la Marea (${hp(b1)}, ${hp(b2)}, ${hp(b3)})`);
  ok(b3.units.filter(u => u.side === 'enemy').length === 4, 'en la Marea III se suma un enemigo');
  pass1(b1); pass1(b2);
  const d = (b) => b.units.find(u => u.side === 'enemy' && u.intent)?.intent.dmg;
  for (let k = 0; k < 3 && !(d(b1) && d(b2)); k++) { pass1(b1); pass1(b2); }
  ok(d(b2) === d(b1) + 1, `y pegan 1 más en la Marea II (${d(b1)} → ${d(b2)})`);
  b1.outcome = b2.outcome = 'win'; b1.ended = b2.ended = true; b1.turn = b2.turn = 3; b1.stats.downs = b2.stats.downs = 0;
  const r1 = R.result(b1), r2 = R.result(b2);
  ok(r1.stars === 3 && r2.loot.mats.madera > r1.loot.mats.madera && r2.xp > r1.xp && r2.marea === 2, `mejor botín y más XP en la Marea II (${JSON.stringify(r1.loot.mats)} ${r1.xp} XP → ${JSON.stringify(r2.loot.mats)} ${r2.xp} XP)`);
}

// ---------------------------------------------------------------- arquetipos de IA
section('Enemigos: cada uno se juega distinto');
{
  // el hondero huye y tira
  let b = arena(); slot = 0;
  const h = foe(b, 'hondero', 2, 2);
  const L = ally(b, 'lider'); L.x = 2; L.y = 3;
  pass1(b);
  ok(Math.min(...R.allies(b).map(a => man(a, h))) >= 2 && !!h.intent && h.intent.pattern === 'shot', 'el hondero se aleja de quien tiene encima y marca su tiro');

  // el guardián cubre
  b = arena(); slot = 0;
  const g = foe(b, 'guardian', 0, 0), w = foe(b, 'hondero', 4, 1);
  for (let k = 0; k < 4 && man(g, w) !== 1; k++) pass1(b);
  ok(man(g, w) === 1, 'el guardián camina hasta quedar pegado a quien cuida');
  b = arena(); slot = 0;
  const g2 = foe(b, 'guardian', 2, 2), w2 = foe(b, 'lobo', 3, 2, 7);
  const L2 = ally(b, 'lider'); L2.x = 3; L2.y = 3;
  ok(R.view(b).units.find(u => u.id === w2.id).warded && !R.view(b).units.find(u => u.id === g2.id).warded, 'view() marca a quién cubre');
  const c = R.cloneBattle(b); R.unitById(c, g2.id).alive = false;
  R.act(b, L2.id, 'golpe', 3, 2); R.act(c, R.leaderOf(c).id, 'golpe', 3, 2);
  ok(w2.hp === R.unitById(c, w2.id).hp + COMBAT.wardDmg, `pegado al guardián recibe 1 menos (${7 - w2.hp} contra ${7 - R.unitById(c, w2.id).hp})`);

  // el nido invoca
  b = arena(); slot = 0;
  const n = foe(b, 'nido', 2, 1);
  pass1(b); pass1(b);
  const inc = b.incoming.find(s => s.from === 'summon');
  ok(!!inc && inc.kind === 'larva' && R.view(b).tiles.some(t => t.incoming === 'larva'), 'el nido avisa un turno antes dónde sale la larva');
  const dead = R.cloneBattle(b); const L3 = R.leaderOf(dead); const nn = R.unitById(dead, n.id); nn.hp = 1; L3.x = nn.x; L3.y = nn.y + 1;
  if (R.unitAt(dead, L3.x, L3.y) !== L3) { L3.y = nn.y - 1; }
  R.act(dead, L3.id, 'golpe', nn.x, nn.y);
  ok(!nn.alive && !dead.incoming.length && dead.ended && dead.outcome === 'win', 'si cae el nido, la larva que venía no sale (y la pelea termina)');
  const ev = pass1(b);
  ok(has(ev, 'spawn', e => e.kind === 'larva') && b.units.some(u => u.type === 'larva' && u.alive), 'y si no, la larva sale');

  // el jabalí carga
  b = arena(); slot = 0;
  let j = foe(b, 'jabali', 0, 2);
  const L4 = ally(b, 'lider'); L4.x = 3; L4.y = 2;
  j.intent = { id: 'carga', name: 'Carga', pattern: 'charge', dmg: 4, dir: [1, 0], len: 5, push: 1 };
  ok(JSON.stringify(R.intentTiles(b, j)) === '[[1,2],[2,2],[3,2]]', 'la carga marca la línea hasta lo primero que encuentra');
  let hp0 = L4.hp;
  let e4 = pass1(b);
  ok(has(e4, 'charge', e => e.to[0] === 2 && e.to[1] === 2) && L4.hp <= hp0 - 4 + 0 && has(e4, 'push', e => e.id === L4.id && e.to[0] === 4), 'corre hasta el blanco, pega 4 y lo empuja una casilla');
  b = arena(); slot = 0;
  j = foe(b, 'jabali', 0, 2);
  tile(b, 4, 2, 'arbol');
  j.intent = { id: 'carga', name: 'Carga', pattern: 'charge', dmg: 4, dir: [1, 0], len: 5, push: 1 };
  e4 = pass1(b);
  ok(has(e4, 'crash') && has(e4, 'combo', e => e.id === 'estrellado') && j.hp === ENEMIES.jabali.hp - COMBAT.crashDmg, 'si nadie queda en la línea, se estrella contra el árbol: recibe 2 y es un combo');
  ok(!has(e4, 'enemyMove', e => e.id === j.id), 'y queda aturdido: ese turno no se mueve');

  // el hongo revienta
  b = arena(); slot = 0;
  const ho = foe(b, 'hongo', 2, 2, 1), lo = foe(b, 'lobo', 3, 3, 7);
  const L5 = ally(b, 'lider'); L5.x = 2; L5.y = 3; hp0 = L5.hp;
  const e5 = R.act(b, L5.id, 'golpe', 2, 2).events;
  ok(has(e5, 'explode', e => e.tiles.length === 8) && lo.hp === 7 - ENEMIES.hongo.explodeDmg && L5.hp === hp0 - ENEMIES.hongo.explodeDmg && has(e5, 'combo', e => e.id === 'reventon'),
    'el hongo revienta alrededor (también en diagonal): 3 al lobo y 3 a quien lo mató de cerca');

  // el musgo cura
  b = arena(); slot = 0;
  const mu = foe(b, 'musgo', 0, 0), lw = foe(b, 'lobo', 2, 1, 3);
  let e6 = pass1(b);
  const iv = R.view(b).units.find(u => u.id === mu.id).intent;
  ok(mu.intent?.pattern === 'heal' && mu.intent.target === lw.id && iv.heal === 4 && iv.dmg === 0 && has(e6, 'intent', e => e.heal), 'el musgo marca a quién va a curar, a la vista');
  ok(R.dangerMap(b)[I(b, lw.x, lw.y)] === 0, 'esa marca no cuenta como peligro');
  const before = lw.hp;
  e6 = pass1(b);
  ok(has(e6, 'heal', e => e.id === lw.id) && lw.hp > before, `y lo cura (${before} → ${lw.hp})`);

  // el cuervo vuela
  b = arena(); slot = 0;
  for (let x = 0; x < 6; x++) { tile(b, x, 2, 'agua'); tile(b, x, 3, 'alto'); }
  const cu = foe(b, 'cuervo', 2, 0);
  pass1(b);
  ok(cu.y >= 3, 'el cuervo cruza el agua y lo alto sin frenarse');
}

// ---------------------------------------------------------------- terreno
section('Terreno que importa');
{
  let b = arena(); slot = 0;
  const h = foe(b, 'hondero', 2, 0);
  const c = ally(b, 'cazador'); c.x = 2; c.y = 3;
  const b2 = R.cloneBattle(b); tile(b2, 2, 3, 'mata');
  for (const k of [b, b2]) R.unitById(k, h.id).intent = { id: 'piedra', name: 'Pedrada', pattern: 'shot', dmg: 3, dir: [0, 1], len: 4 };
  const hp0 = c.hp;
  pass1(b); pass1(b2);
  ok(hp0 - c.hp === 3 && hp0 - R.unitById(b2, c.id).hp === 3 - COMBAT.coverDmg && R.view(b2).tiles[I(b2, 2, 3)].cover, 'el matorral tapa de los tiros: 1 menos');

  b = arena(); slot = 0;
  foe(b, 'nido', 5, 0);
  const L = ally(b, 'lider'); L.x = 2; L.y = 3;
  b.fire[I(b, 2, 3)] = 3;
  ok(R.dangerMap(b)[I(b, 2, 3)] === COMBAT.fireDmg && R.view(b).tiles[I(b, 2, 3)].fire === 3, 'el fuego se ve como peligro');
  const l0 = L.hp;
  const ev = pass1(b);
  ok(l0 - L.hp === COMBAT.fireDmg && L.burn > 0 && has(ev, 'status', e => e.status === 'burn' && e.on) && b.fire[I(b, 2, 3)] === 2, 'quedarse en el fuego quema 2 y deja quemado; el fuego se va apagando');

  b = arena(); slot = 0;
  foe(b, 'nido', 5, 0);
  const L2 = ally(b, 'lider'); L2.x = 2; L2.y = 3;
  tile(b, 2, 3, 'corr_e');
  ok(R.view(b).units.find(u => u.id === L2.id).wet, 'en el agua se está mojado');
  const ev2 = pass1(b);
  ok(L2.x === 3 && L2.y === 3 && has(ev2, 'drift', e => e.id === L2.id), 'la corriente arrastra una casilla a quien se quede en ella');

  b = arena(); slot = 0;
  const lo = foe(b, 'lobo', 2, 2, 7);
  const m = ally(b, 'monje'); m.x = 2; m.y = 3;
  b.fire[I(b, 2, 1)] = 3;
  const ev3 = R.act(b, m.id, 'empujar', 2, 2).events;
  ok(lo.y === 1 && has(ev3, 'combo', e => e.id === 'a_las_brasas') && lo.burn > 0 && lo.hp === 7 - 1 - COMBAT.fireDmg, 'empujar a un enemigo al fuego lo quema (combo "A las brasas")');

  const f = R.newBattle({ encounter: 'arroyo_brasas', seed: 2, party: PARTY });
  ok(f.fire.filter(n => n >= 90).length === 1, 'la fogata del mapa arde toda la pelea');
  for (let k = 0; k < 3; k++) pass1(f);
  ok(f.fire.some(n => n >= 90), 'y no se apaga sola');
}

// ---------------------------------------------------------------- elementos
section('Elementos: fragmentos de veta y reacciones');
{
  const frag = (el, extra = {}) => { const b = arena({ fragments: [el], ...extra }); slot = 0; return b; };
  ok(Object.keys(FRAGMENTS).every(el => R.leaderOf(frag(el)).abilities.includes(FRAGMENTS[el])) && !R.leaderOf(arena()).abilities.includes('ascua'), 'un fragmento le presta al líder la habilidad de ese elemento');

  // vapor: Brasa sobre mojado
  let b = frag('brasa');
  let lo = foe(b, 'lobo', 2, 2, 7); tile(b, 2, 2, 'agua');
  let L = R.leaderOf(b); L.x = 2; L.y = 4;
  const cz = ally(b, 'cazador'); cz.x = 2; cz.y = 5;
  let ev = R.act(b, L.id, 'ascua', 2, 2).events;
  ok(has(ev, 'react', e => e.id === 'vapor') && b.steam[I(b, 2, 2)] > 0 && !lo.burn && has(ev, 'combo', e => e.id === 'vapor'), 'Brasa sobre alguien en el agua: vapor (y no lo quema)');
  ok(!R.targets(b, cz.id, 'tiro').some(t => t.x === 2 && t.y === 2), 'el vapor tapa la vista: no se le puede tirar de lejos');
  const hd = foe(b, 'hondero', 2, 0);
  ok(!R.intentTiles(b, Object.assign(hd, { intent: { pattern: 'shot', dir: [0, 1], len: 4, dmg: 2 } })).some(([x, y]) => y >= 2), 'y para los tiros enemigos');
  for (let k = 0; k < COMBAT.steamTurns; k++) pass1(b);
  ok(b.steam.every(n => n === 0), `el vapor se va en ${COMBAT.steamTurns} turnos`);

  // vapor al revés: Marea sobre el fuego
  b = frag('marea');
  lo = foe(b, 'ascua_errante', 2, 2, 7); L = R.leaderOf(b); L.x = 2; L.y = 4;
  b.fire[I(b, 2, 2)] = 3;
  ev = R.act(b, L.id, 'oleada', 2, 2).events;
  ok(has(ev, 'react', e => e.id === 'vapor') && b.fire[I(b, 2, 2)] === 0 && lo.y === 1 && lo.wet > 0 && lo.hp === 7 - 3, 'Marea apaga el fuego (vapor), moja, empuja y a un ascua errante le pega 2 más');
  ok(!R.targets(b, L.id, 'oleada').some(t => t.x !== L.x && t.y !== L.y), 'la oleada va en línea recta');

  // incendio: Brasa sobre raíz y matorral, y sobre un enredado
  b = frag('brasa', { element: 'raiz' });
  foe(b, 'nido', 5, 0);
  L = R.leaderOf(b); L.x = 2; L.y = 4;
  b.walls.push({ x: 2, y: 2, turns: 3, by: 'lider', root: true }); tile(b, 3, 2, 'mata'); tile(b, 4, 2, 'mata');
  ev = R.act(b, L.id, 'ascua', 2, 2).events;
  ok(has(ev, 'react', e => e.id === 'incendio') && !b.walls.length && [2, 3, 4].every(x => b.fire[I(b, x, 2)] > 0) && b.tiles[I(b, 3, 2)] === 'llano', 'Brasa sobre una pared de raíz: arde y el fuego se corre al matorral pegado');
  b = frag('brasa');
  lo = foe(b, 'lobo', 2, 2, 7); lo.root = 1; L = R.leaderOf(b); L.x = 2; L.y = 4;
  ev = R.act(b, L.id, 'ascua', 2, 2).events;
  ok(has(ev, 'react', e => e.id === 'incendio') && lo.hp === 7 - 2 - COMBAT.igniteDmg && lo.burn > 0, 'Brasa sobre un enredado: incendio, 2 más de daño, y queda quemado');
  const hpB = lo.hp;
  pass1(b);
  ok(lo.hp === hpB - COMBAT.burnDmg, 'quemado: 1 por turno');

  // descarga en cadena: Céfiro sobre mojado
  b = frag('cefiro');
  const a1 = foe(b, 'lobo', 2, 2, 7), a2 = foe(b, 'lobo', 2, 1, 7); a1.wet = 2; tile(b, 2, 1, 'agua');
  L = R.leaderOf(b); L.x = 2; L.y = 4;
  ev = R.act(b, L.id, 'rafaga', 2, 2).events;
  ok(has(ev, 'react', e => e.id === 'descarga') && a1.hp <= 7 - 1 - COMBAT.shockDmg && a2.hp <= 7 - COMBAT.chainDmg, `Céfiro sobre un mojado: descarga, y salta al mojado de al lado (${a1.hp} y ${a2.hp} de 7)`);
  const res = R.result(Object.assign(R.cloneBattle(b), { outcome: 'win', ended: true }));
  ok(res.reacts >= 1 && res.reactDmg >= COMBAT.shockDmg + COMBAT.chainDmg, 'el resultado cuenta las reacciones y su daño');

  // fuego que salta: Céfiro sobre el fuego
  b = frag('cefiro');
  lo = foe(b, 'lobo', 2, 2, 7); L = R.leaderOf(b); L.x = 2; L.y = 4;
  b.fire[I(b, 2, 2)] = 3;
  ev = R.act(b, L.id, 'rafaga', 2, 2).events;
  ok(has(ev, 'react', e => e.id === 'fuego_salta') && lo.y === 0 && b.fire[I(b, 2, 1)] > 0 && lo.burn > 0, 'Céfiro sobre el fuego: lo corre dos casillas y las llamas saltan detrás');

  // brote: Raíz sobre mojado
  b = arena({ element: 'raiz' }); slot = 0;
  lo = foe(b, 'lobo', 2, 2, 7); tile(b, 2, 2, 'agua'); L = R.leaderOf(b); L.x = 2; L.y = 4;
  ev = R.act(b, L.id, 'enredar', 2, 2).events;
  ok(has(ev, 'react', e => e.id === 'brote') && lo.root === 2, 'Raíz sobre un mojado: brote, lo frena un turno más');

  // despeje: Céfiro sobre el vapor
  b = frag('cefiro');
  lo = foe(b, 'lobo', 2, 2, 7); L = R.leaderOf(b); L.x = 2; L.y = 3;
  b.steam[I(b, 2, 2)] = 2; b.steam[I(b, 3, 2)] = 2;
  ev = R.act(b, L.id, 'rafaga', 2, 2).events;
  ok(has(ev, 'react', e => e.id === 'despeje') && b.steam.every(n => n === 0), 'Céfiro se lleva el vapor');

  // los enemigos también traen elemento
  b = arena(); slot = 0;
  const as = foe(b, 'ascua_errante', 2, 1); L = R.leaderOf(b); L.x = 2; L.y = 2;
  as.intent = { id: 'llamarada', name: 'Llamarada', pattern: 'line2', dmg: 2, dir: [0, 1], len: 0, element: 'brasa' };
  ev = pass1(b);
  ok(L.burn > 0 && has(ev, 'fire', e => e.tiles[0][0] === 2 && e.tiles[0][1] === 3), 'la llamarada del ascua errante quema y deja el piso en llamas');
  b = arena(); slot = 0;
  const sp = foe(b, 'sapo', 2, 0); L = R.leaderOf(b); L.x = 2; L.y = 2;
  sp.intent = { id: 'escupida', name: 'Chorro', pattern: 'shot', dmg: 2, dir: [0, 1], len: 3, element: 'marea', push: 1 };
  ev = pass1(b);
  ok(has(ev, 'push', e => e.id === L.id && e.to[1] === 3) && has(ev, 'status', e => e.id === L.id && e.status === 'wet'), 'el chorro del sapo moja y empuja');
}

// ---------------------------------------------------------------- resolución automática
section('Resolución automática');
{
  ok(!R.canAutoResolve('arroyo_lobos', 2) && R.canAutoResolve('arroyo_lobos', 3) && !R.canAutoResolve('banado_bestia', 3), 'solo las peleas comunes ya ganadas con 3 estrellas');
  const b = R.newBattle({ encounter: 'arroyo_lobos', seed: 1, party: PARTY, marea: 2 });
  Object.assign(b, { outcome: 'win', ended: true, turn: 3 });
  const played = R.result(b), auto = R.autoResolve({ encounter: 'arroyo_lobos', best: 3, marea: 2 });
  ok(played.stars === 3 && JSON.stringify(auto.loot) === JSON.stringify(played.loot) && auto.xp === played.xp, `da el botín y la XP completos, los mismos que jugarla con 3 estrellas (${JSON.stringify(auto.loot.mats)}, ${auto.xp} XP)`);
  ok(auto.auto && auto.stars === 3 && auto.outcome === 'win' && auto.summary.xp === auto.xp && auto.summary.name === ENCOUNTERS.arroyo_lobos.name && auto.marea === 2, 'trae un resumen corto (nombre, botín, XP)');
  const q = R.quickResolve({ encounter: 'arroyo_lobos', wins: 1 }), q3 = R.quickResolve({ encounter: 'arroyo_lobos', wins: 1, stars: 3 });
  ok(!q.auto && q.xp < auto.xp && q3.auto && q3.xp === R.autoResolve({ encounter: 'arroyo_lobos' }).xp, 'quickResolve sigue igual sin las 3 estrellas, y con ellas es la automática');
  ok(R.autoResolve({ encounter: 'arroyo_lobos', best: 2 }) === null, 'sin las 3 estrellas no hay resolución automática');
}

// ---------------------------------------------------------------- compatibilidad
section('Peleas guardadas antes de este paso');
{
  const b = R.newBattle({ encounter: 'bosque_claro', seed: 4, party: PARTY });
  delete b.fire; delete b.steam; delete b.marea;
  const s = JSON.parse(JSON.stringify(b));
  let fine = true;
  try { R.view(s); R.endTurn(s); R.enemyTurn(s); R.view(s); R.result(s); } catch (e) { fine = false; console.log(e); }
  ok(fine && s.fire.length === 64 && s.turn === 2, 'una pelea sin fuego, vapor ni Marea se retoma sin romperse');
  const x = R.newBattle({ encounter: 'arroyo_tormenta', seed: 9, party: PARTY, marea: 3, fragments: ['brasa'] });
  const y = R.newBattle({ encounter: 'arroyo_tormenta', seed: 9, party: PARTY, marea: 3, fragments: ['brasa'] });
  for (const k of [x, y]) for (let t = 0; t < 3; t++) pass1(k);
  ok(JSON.stringify(x) === JSON.stringify(y), 'misma semilla y mismas acciones, mismo resultado');
}

// ---------------------------------------------------------------- duración
if (!QUICK) {
  section('Una pelea común dura de 3 a 5 turnos (bot, grupo esperado, ganadas)');
  for (const m of [1, 2, 3]) {
    let wins = 0, turns = 0, n = 0;
    const ex = COMBAT.marea[m].expected;
    for (const id of FARM.arroyo.comunes) for (let k = 0; k < 4; k++) {
      const party = [['cazador', 'forjador', 'curandero'], ['guerrero', 'cazador', 'curandero'], ['monje', 'saqueador', 'cazador'], ['guerrero', 'forjador', 'monje']][k];
      const { res } = playBattle(expectedCfg(id, party, 500 + k * 11, { marea: m, level: ex.level, classLevel: Object.fromEntries(party.map(c => [c, ex.classLevel])) }), { noise: 1.2 });
      n++; if (res.outcome === 'win') { wins++; turns += res.turns; }
    }
    const avg = turns / Math.max(1, wins);
    ok(avg >= 3 && avg <= 5 && wins / n >= (m === 3 ? 0.6 : 0.8), `Marea ${'I'.repeat(m)}: ${avg.toFixed(1)} turnos de promedio, gana ${(100 * wins / n).toFixed(0)} % (${n} peleas)`);
  }
}

console.log(`\n${fail ? '✘' : '✔'} ${pass} bien, ${fail} mal`);
process.exitCode = fail ? 1 : 0;
