// Árbol de habilidades (PLAN-FOTO, paso A3): pruebas de src/core/tree.js y tree-data.js en Node, sin navegador.
// Cubre los datos (un tercio del árbol: 25 a 30 nodos, 3 claves), los puntos, los requisitos, el reinicio, el guardado
// y lo que el árbol suma a una pelea de verdad (por src/core/loot.js). La pantalla (src/scenes/tree.js) se mira aparte.
//   node tools/test-tree.mjs
import * as T from '../src/core/tree.js';
import * as TD from '../src/core/tree-data.js';
import * as L from '../src/core/loot.js';
import { FX } from '../src/core/loot-data.js';
import * as R from '../src/combat/combat-rules.js';
import { ABILITIES, FARM } from '../src/combat/combat-data.js';
import * as ESM from '../src/i18n/es.js';

const ES = ESM.default || ESM.ES || Object.values(ESM)[0];
let pass = 0, fail = 0;
function ok(cond, msg, extra) {
  if (cond) { pass++; console.log('  ✔ ' + msg); } else { fail++; console.log('  ✘ ' + msg + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); }
}
const section = (s) => console.log('\n' + s);
const J = (x) => JSON.stringify(x);
const PARTY = ['guerrero', 'cazador', 'curandero'];
const xpFor = (points) => { let x = 0; for (let i = 0; i < points; i++) x += TD.TREE_NEED(i); return x; };
const game = (points = 0, nodes = []) => ({ tree: { v: 1, xp: xpFor(points), nodes: nodes.slice(), resets: 0 } });

section('Datos');
{
  const N = TD.TREE_NODES;
  ok(N.length >= 25 && N.length <= 30, `un tercio del árbol: de 25 a 30 nodos (${N.length})`);
  ok(new Set(N.map(n => n.id)).size === N.length, 'ids únicos');
  ok(TD.TREE_KEYS.length === 3, '3 nodos clave');
  ok(TD.TREE_KEYS.every(id => TD.TREE[id].rules || TD.TREE[id].loot), 'cada nodo clave cambia una regla del combate o del botín');
  ok(TD.TREE_KEYS.every(id => (TD.TREE[id].rules && Object.keys(TD.TREE[id].rules).length) && (TD.TREE[id].fx.some(f => f.v < 0) || TD.TREE[id].rules.noHeal || TD.TREE[id].rules.foeHp > 1)), 'y tiene un costo: da y saca');
  ok(N.every(n => n.req.every(r => TD.TREE[r])) && N.every(n => n.fx.every(f => FX[f.id] && f.v)), 'requisitos y efectos existen');
  ok(TD.TREE_BRANCHES.every(b => N.filter(n => n.branch === b && !n.req.length).length === 1), 'cada rama tiene un arranque');
  ok(new Set(N.map(n => n.x + ',' + n.y)).size === N.length && N.every(n => n.x >= 0 && n.x < TD.TREE_SIZE.w && n.y >= 0 && n.y < TD.TREE_SIZE.h), 'ningún nodo encima de otro ni fuera de la grilla');
  // todos se pueden alcanzar
  const st = game(N.length);
  let grew = true;
  while (grew) { grew = false; for (const n of N) if (T.takeNode(st, n.id).ok) grew = true; }
  ok(st.tree.nodes.length === N.length && T.treeInfo(st).free === 0, 'con todos los puntos se llega a todos los nodos');
  const need = [...TD.TREE_KEYS.flatMap(id => [`tree.key.${id}.name`, `tree.key.${id}.text`]), ...TD.TREE_BRANCHES.map(b => `tree.branch.${b}`)];
  ok(need.every(k => k in ES), 'los textos de ramas y nodos clave están en es.js', need.filter(k => !(k in ES)));
  ok(N.every(n => T.nodeName(n) && T.nodeText(n) && !T.nodeText(n).includes('{')), 'cada nodo tiene nombre y texto');
}

section('Puntos');
{
  ok(T.pointsFromXp(0) === 0 && T.pointsFromXp(TD.TREE_NEED(0) - 1) === 0 && T.pointsFromXp(TD.TREE_NEED(0)) === 1, 'el primer punto llega con la veta justa');
  ok([1, 5, 12, 27].every(p => T.pointsFromXp(xpFor(p)) === p && T.pointsFromXp(xpFor(p) - 1) === p - 1), 'la curva: cada punto pide su veta');
  ok(TD.TREE_NEED(5) > TD.TREE_NEED(0), 'cada punto cuesta más que el anterior');
  ok(T.pointsFromXp(1e9) === TD.TREE_IDS.length, 'tope: un punto por nodo');
  const st = {};
  ok(T.addTreeXp(st, 10) === null && st.tree.xp === 10, 'la veta se junta');
  ok(J(T.addTreeXp(st, 200)) === J({ from: 0, to: T.pointsFromXp(210) }), 'y avisa cuando da puntos');
  const i = T.treeInfo(game(3, ['filo1']));
  ok(i.points === 3 && i.spent === 1 && i.free === 2 && i.into === 0 && i.need === TD.TREE_NEED(3), 'treeInfo: puntos, gastados, libres y lo que falta');
  ok(T.addTreeXp(st, -5) === null && T.addTreeXp(st, NaN) === null && st.tree.xp === 210, 'no se resta ni se rompe con basura');
}

section('Requisitos');
{
  const st = game(4);
  ok(!T.canTake(st, 'filo4').ok && T.canTake(st, 'filo4').why === T.TXT.locked, 'un nodo lejano está cerrado');
  ok(!T.canTake(st, 'nada').ok, 'un nodo que no existe, no');
  ok(T.takeNode(st, 'filo1').ok && T.hasNode(st, 'filo1'), 'el arranque se toma');
  ok(!T.takeNode(st, 'filo1').ok && T.canTake(st, 'filo1').why === T.TXT.taken, 'no se toma dos veces');
  ok(T.reachableNode(st, 'filo2') && T.reachableNode(st, 'filo3') && !T.reachableNode(st, 'filo4'), 'se abren los de al lado');
  ok(T.takeNode(st, 'filo3').ok && T.takeNode(st, 'filo4').ok, 'alcanza con UNO de los requisitos (por cualquiera de los dos caminos)');
  ok(T.takeNode(st, 'guardia1').ok, 'otra rama se puede empezar cuando se quiera');
  ok(!T.takeNode(st, 'filo5').ok && T.canTake(st, 'filo5').why === T.TXT.noPoints, 'sin puntos no se toma');
  ok(!T.canTake(game(30), 'juramento').ok, 'un nodo clave pide llegar hasta el fondo de su rama');
  const v = T.treeView(st);
  ok(v.nodes.find(n => n.id === 'filo1').state === 'taken' && v.nodes.find(n => n.id === 'filo5').state === 'open' && v.nodes.find(n => n.id === 'filo7').state === 'locked', 'la vista marca tomado, a mano y cerrado');
}

section('Reinicio y guardado');
{
  const st = game(6, ['filo1', 'filo2', 'guardia1']);
  const r = T.resetTree(st);
  ok(r.ok && r.refunded === 3 && st.tree.nodes.length === 0 && T.treeInfo(st).free === 6, 'el reinicio devuelve todos los puntos');
  ok(st.tree.resets === 1 && st.tree.xp === xpFor(6), 'la veta no se pierde');
  ok(!T.resetTree(st).ok && st.tree.resets === 1, 'reiniciar un árbol vacío no cuenta');
  ok(T.takeNode(st, 'rastro1').ok, 'y se puede armar de otra forma');
  const old = { coins: 5 };
  ok(T.treeInfo(old).points === 0 && J(old.tree) === J({ v: 1, xp: 0, nodes: [], resets: 0 }), 'una partida de antes del A3 arranca con el árbol vacío');
  const st2 = JSON.parse(JSON.stringify(st));
  T.treeState(st2);
  ok(J(st2) === J(st), 'guardar y abrir no cambia nada');
  ok(T.treeState({ tree: { xp: 'x', nodes: ['filo1', 'nada', 'filo1'], resets: -2 } }).nodes.length === 0, 'un guardado roto se limpia');
  ok(T.treeState(game(1, ['filo1', 'filo2'])).nodes.length === 0, 'más nodos que puntos: se devuelve todo');
  ok(T.treeState(game(5, ['filo4'])).nodes.length === 0, 'un nodo suelto, sin su camino: se devuelve todo');
  ok(T.treeState(game(5, ['filo1', 'filo3', 'filo4'])).nodes.length === 3, 'un camino válido queda como está');
}

section('Lo que el árbol suma a la pelea');
{
  const enc = FARM.arroyo.comunes[0];
  const fight = (st) => { const lo = L.loadout(st, { party: PARTY, leaderCls: 'guerrero' }); return { lo, b: R.newBattle({ encounter: enc, seed: 7, party: PARTY, leader: { cls: 'guerrero' }, level: 3, gear: lo.gear, rules: lo.rules }) }; };
  const u = (b, type) => b.units.find(x => x.side === 'ally' && x.type === type);
  const def = (b, type, id) => R.abilitiesOf(b, u(b, type).id).find(a => a.id === id)?.def;
  const base = fight(game(0)).b;
  const a = fight(game(9, ['filo1'])).b;
  ok(PARTY.every(c => u(a, c).abilities.filter(id => ABILITIES[id].kind === 'attack' && ABILITIES[id].cd).every(id => def(a, c, id).plus === (ABILITIES[id].plus || 0) + 1)), 'Filo 1: los ataques con recarga de todo el grupo pegan 1 más');
  const g = fight(game(9, ['guardia1', 'guardia2', 'guardia4'])).b;
  ok(['lider', ...PARTY].every(c => u(g, c).maxHp === u(base, c).maxHp + 3), 'Guardia: +3 de vida para los cuatro');
  ok(def(g, 'curandero', 'curar').heal === ABILITIES.curar.heal + 1, 'y las curas rinden más');
  const all = (ids) => game(27, ids);
  const filo = ['filo1', 'filo2', 'filo4', 'filo5', 'filo7'];
  const l8 = fight(all([...filo, 'filo8'])).b;
  ok(u(l8, 'lider').atk === u(base, 'lider').atk + 1 && u(l8, 'cazador').atk === u(base, 'cazador').atk, 'un nodo "solo el líder" no toca al resto');
  const jur = fight(all([...filo, 'juramento']));
  ok(jur.b.rules.noHeal === true && ['lider', ...PARTY].every(c => u(jur.b, c).atk === u(base, c).atk + 1), 'Juramento de sangre: todos pegan 1 más y la pelea queda sin curas');
  const c = u(jur.b, 'curandero'); c.hp -= 3; R.act(jur.b, c.id, 'curar', c.x, c.y);
  ok(c.hp === c.maxHp - 3, '…de verdad: Curar no cura');
  const fc = fight(all(['guardia1', 'guardia2', 'guardia4', 'guardia5', 'guardia7', 'fila_cerrada']));
  ok(fc.b.rules.closeRank === 1 && u(fc.b, 'guerrero').mv === u(base, 'guerrero').mv - 1, 'Fila cerrada: la regla prendida y 1 menos de movimiento');
  const ma = fight(all(['rastro1', 'rastro2', 'rastro4', 'rastro5', 'rastro7', 'marea_adentro']));
  const hp = (b) => b.units.filter(x => x.side === 'enemy').reduce((s, x) => s + x.hp, 0);
  ok(hp(ma.b) > hp(base) && ma.lo.loot.sure === true && ma.lo.loot.quality >= 20, 'Marea adentro: enemigos con más vida y botín asegurado y mejor');
  ok(ma.lo.loot.find === 13 && ma.lo.loot.veta === 10 && ma.lo.loot.mastery === 20, 'Rastro: hallazgo, veta y maestría llegan a las reglas del botín', ma.lo.loot);
  const win = { enc, outcome: 'win', stars: 3, loot: { mats: { madera: 4 } } };
  const n0 = Array.from({ length: 600 }, (_, i) => L.battleLoot({ result: win, seed: i, mods: fight(game(0)).lo.loot })).reduce((s, l) => s + l.items.length, 0);
  const n1 = Array.from({ length: 600 }, (_, i) => L.battleLoot({ result: win, seed: i, mods: ma.lo.loot })).reduce((s, l) => s + l.items.length, 0);
  ok(n1 >= 600 && n1 > n0, 'con Marea adentro caen más armas en las mismas 600 peleas', [n0, n1]);
  ok(J(T.treeEffects(game(0))) === J({ fx: [], rules: [], loot: [], keys: [] }) && J(fight(game(0)).lo.rules) === '{}', 'un árbol vacío no cambia nada');
  ok(J(T.treeEffects(jur.lo ? all([...filo, 'juramento']) : {}).keys) === J(['juramento']), 'el árbol avisa qué nodos clave están tomados');
}

console.log(`\n${fail ? '✘' : '✔'} ${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
