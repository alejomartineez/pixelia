// Botín y construcción de personaje (PLAN-FOTO, paso A3): pruebas de src/core/loot.js y loot-data.js en Node, sin
// navegador. Cubre los objetos con rasgos, "sos lo que llevás puesto" (el arma define las habilidades y los rasgos las
// cambian dentro de una pelea de verdad), las reglas que suman el árbol y las reliquias en src/combat/combat-rules.js,
// las reliquias de salida, el botín por Marea y el de la resolución automática. Prueba propiedades, no números de balance.
//   node tools/test-loot.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as L from '../src/core/loot.js';
import * as D from '../src/core/loot-data.js';
import * as A from '../src/core/arsenal.js';
import * as T from '../src/core/tree.js';
import * as R from '../src/combat/combat-rules.js';
import { ABILITIES, FARM, ELEMENT_NAMES } from '../src/combat/combat-data.js';
import { PASSIVE_FLAGS } from '../src/combat/classes.js';
import * as ESM from '../src/i18n/es.js';
import { playBattle } from './sim-combat.mjs';

const ES = ESM.default || ESM.ES || Object.values(ESM)[0];
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function ok(cond, msg, extra) {
  if (cond) { pass++; console.log('  ✔ ' + msg); } else { fail++; console.log('  ✘ ' + msg + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); }
}
const section = (s) => console.log('\n' + s);
const J = (x) => JSON.stringify(x);
const avg = (a) => a.reduce((s, n) => s + n, 0) / Math.max(1, a.length);
const PARTY = ['guerrero', 'cazador', 'curandero'];
const ENC = FARM.arroyo.comunes[0], ELITE = FARM.arroyo.elites[0];
/** Una partida con un arma fija equipada a alguien. */
function withWeapon(who, type, affixes = [], rarity = 2, st = {}) {
  const r = A.addWeapon(st, { type, rarity, traits: [], affixes, src: 'pelea' });
  A.equipWeapon(st, who, r.weapon.uid);
  return st;
}
const battle = (st, extra = {}, run = null) => {
  const lo = L.loadout(st, { party: PARTY, leaderCls: 'guerrero', run });
  return { lo, b: R.newBattle({ encounter: ENC, seed: 7, party: PARTY, leader: { cls: 'guerrero' }, level: 3, gear: lo.gear, rules: lo.rules, ...extra }) };
};
const unit = (b, type) => b.units.find(u => u.side === 'ally' && u.type === type);
const defOf = (b, type, id) => R.abilitiesOf(b, unit(b, type).id).find(a => a.id === id)?.def;
const fakeWin = (enc = ENC, stars = 3, marea = 1) => ({ enc, outcome: 'win', stars, marea, loot: { mats: { madera: 4, hierbas: 2 } }, xp: 30 });

// ------------------------------------------------------------------
section('Módulos puros y datos');
{
  const src = ['src/core/loot.js', 'src/core/loot-data.js', 'src/core/tree.js', 'src/core/tree-data.js'].map(f => readFileSync(join(ROOT, f), 'utf8')).join('\n');
  ok(!/\b(document|window|localStorage|requestAnimationFrame)\b/.test(src.replace(/\/\/.*$/gm, '')), 'botín y árbol sin DOM ni navegador');
  ok(!/from ['"]\.\/(state|bus|gear)\.js|from ['"]three|Math\.random/.test(src), 'sin store, sin bus, sin three.js y sin Math.random');
  ok(D.AFFIX_IDS.every(id => D.FX[id]), 'cada rasgo es un efecto conocido');
  ok(D.AFFIX_IDS.every(id => D.AFFIXES[id].v.length === 3 && D.AFFIXES[id].v.every(([a, b]) => a >= 1 && b >= a)), 'cada rasgo tiene valores para las Mareas I, II y III');
  ok(D.AFFIX_IDS.every(id => { const v = D.AFFIXES[id].v; return v[2][1] >= v[0][1] && v[2][0] >= v[0][0]; }), 'los valores no bajan con la Marea');
  ok(Object.values(D.FX).filter(f => f.flag).every(f => PASSIVE_FLAGS.includes(f.flag)), 'las pasivas que tocan los efectos existen en el combate');
  ok(Object.values(D.FX).filter(f => f.affinity).every(f => ELEMENT_NAMES[f.affinity]), 'las afinidades son elementos del combate');
  const sk = Object.values(D.WEAPON_SKILLS);
  ok(A.WEAPON_IDS.every(id => D.WEAPON_SKILLS[id]) && sk.every(W => ABILITIES[W.basic] && W.skills.length === 3 && W.skills.every(s => ABILITIES[s])), 'cada tipo de arma tiene su golpe y 3 habilidades que existen');
  ok(new Set(sk.map(W => J(W.skills))).size === sk.length, 'no hay dos armas con las mismas habilidades');
  ok(D.AFFIXES.tecnica.skills.every(s => ABILITIES[s]), 'las habilidades prestadas existen');
  ok(D.RELIC_IDS.length >= 12 && D.RELIC_IDS.length <= 15, `hay de 12 a 15 reliquias (${D.RELIC_IDS.length})`);
  ok(D.RELIC_IDS.every(id => (D.RELICS[id].fx || []).every(f => D.FX[f.id])), 'los efectos de las reliquias existen');
  const need = [...D.FX_IDS.map(id => `loot.fx.${id}`), ...D.RELIC_IDS.flatMap(id => [`relic.${id}.name`, `relic.${id}.text`])];
  ok(need.every(k => k in ES), 'cada efecto y cada reliquia tiene su texto en es.js', need.filter(k => !(k in ES)));
  ok(L.fxText({ id: 'peso', v: 2 }).includes('2') && L.fxText({ id: 'tecnica', v: 1, skill: 'salto' }).includes(ABILITIES.salto.name), 'el texto de un rasgo lleva su valor o su habilidad');
}

// ------------------------------------------------------------------
section('Objetos: rareza y de 1 a 4 rasgos');
{
  const a = Array.from({ length: 5 }, (_, i) => L.rollItem(L.rngOf(99 + i), { marea: 2, source: 'elite' }));
  const b = Array.from({ length: 5 }, (_, i) => L.rollItem(L.rngOf(99 + i), { marea: 2, source: 'elite' }));
  ok(J(a) === J(b), 'misma semilla, mismo objeto');
  ok(J(L.rollItem(L.rngOf(1), {})) !== J(L.rollItem(L.rngOf(2), {})), 'otra semilla, otro objeto');
  const rng = L.rngOf(2024);
  const all = [];
  for (let i = 0; i < 4000; i++) all.push(L.rollItem(rng, { marea: 1 + (i % 3), source: ['pelea', 'elite', 'jefe'][i % 3 === 0 ? 0 : (i >> 2) % 3] }));
  ok(all.every(w => A.WEAPON_TYPES[w.type] && w.rarity >= 0 && w.rarity <= 4), 'tipo y rareza válidos');
  ok(all.every(w => w.affixes.length >= 1 && w.affixes.length <= 4), 'de 1 a 4 rasgos');
  ok(all.every(w => { const [mn, mx] = D.AFFIX_COUNT[w.rarity]; return w.affixes.length >= mn && w.affixes.length <= mx; }), 'la cantidad de rasgos sale de la rareza');
  const counts = [0, 1, 2, 3, 4].map(r => avg(all.filter(w => w.rarity === r).map(w => w.affixes.length)));
  ok(counts.every((c, i) => i === 0 || c >= counts[i - 1]) && counts[4] === 4 && counts[0] === 1, 'más rareza, más rasgos (común 1, reliquia 4)', counts);
  ok(all.every(w => new Set(w.affixes.map(x => x.id)).size === w.affixes.length), 'sin rasgos repetidos');
  ok(all.every(w => w.affixes.filter(x => D.FX[x.id].affinity).length <= 1), 'una sola afinidad por arma');
  ok(all.every(w => w.affixes.every(x => { const [mn, mx] = D.AFFIXES[x.id].v[w.tier - 1]; return x.v >= mn && x.v <= mx; })), 'cada valor cae en el rango de su Marea');
  ok(all.every(w => w.affixes.every(x => (D.AFFIXES[x.id].min || 0) <= w.rarity && (!D.AFFIXES[x.id].types || D.AFFIXES[x.id].types.includes(w.type)))), 'cada rasgo respeta su rareza mínima y sus tipos de arma');
  // un rasgo de habilidad toca alguna habilidad de esa arma: ninguno sale muerto
  const dead = all.flatMap(w => w.affixes.filter(x => D.FX[x.id].abil).filter(x => {
    const st = withWeapon('lider', w.type, [x]);
    const g = L.loadout(st, { party: [] }).gear.lider;
    return ![D.WEAPON_SKILLS[w.type].basic, ...D.WEAPON_SKILLS[w.type].skills].some(s => g.abil[s]);
  }).map(x => w.type + ':' + x.id));
  ok(!dead.length, 'los rasgos de habilidad siempre tocan una habilidad del arma que los trae', [...new Set(dead)]);
  ok(all.filter(w => w.affixes.some(x => x.id === 'tecnica')).every(w => { const s = w.affixes.find(x => x.id === 'tecnica').skill; return ABILITIES[s] && !D.WEAPON_SKILLS[w.type].skills.includes(s); }), 'la habilidad prestada es de otra arma');
  ok(new Set(all.flatMap(w => w.affixes.map(x => x.id))).size === D.AFFIX_IDS.length, 'salen todos los rasgos de la tabla');
  ok(L.rollItem(L.rngOf(3), { rarity: 4, type: 'arco' }).rarity === 4 && L.rollItem(L.rngOf(3), { rarity: 4, type: 'arco' }).type === 'arco', 'rareza y tipo fijos');
  ok(Array.from({ length: 200 }, (_, i) => L.rollItem(L.rngOf(i), { minRarity: 2 })).every(w => w.rarity >= 2), 'rareza mínima');
  const w0 = { type: 'espada', rarity: 2, traits: [], affixes: [] };
  ok(L.itemPower({ ...w0, affixes: [{ id: 'peso', v: 2 }] }) > L.itemPower(w0) && L.itemPower({ ...w0, affixes: [{ id: 'peso', v: 3 }] }) > L.itemPower({ ...w0, affixes: [{ id: 'peso', v: 2 }] }), 'la fuerza del objeto sube con sus rasgos');
  ok(L.itemPower({ type: 'espada', rarity: 1, traits: [{ id: 'vida' }] }) === A.weaponPower({ type: 'espada', rarity: 1, traits: [{ id: 'vida' }] }), 'un arma vieja (sin rasgos nuevos) vale lo de siempre');
  ok(L.itemLines(all.find(w => w.affixes.length === 4)).length === 4, 'la ficha trae una línea por rasgo');
}

// ------------------------------------------------------------------
section('Marea I a III: mejor botín');
{
  const sample = (source, marea, n = 3000) => { const rng = L.rngOf(500 + marea); return Array.from({ length: n }, () => L.rollItem(rng, { source, marea })); };
  for (const src of ['pelea', 'elite', 'jefe']) {
    const s = [1, 2, 3].map(m => sample(src, m));
    const rar = s.map(x => avg(x.map(w => w.rarity))), pw = s.map(x => avg(x.map(L.itemPower))), aff = s.map(x => avg(x.map(w => w.affixes.length)));
    ok(rar[0] < rar[1] && rar[1] < rar[2], `${src}: la rareza media sube con la Marea`, rar.map(n => +n.toFixed(2)));
    ok(pw[0] < pw[1] && pw[1] < pw[2] && pw[2] > pw[0] * 1.3, `${src}: la fuerza media del objeto sube (más de 30 % de la I a la III)`, pw.map(n => Math.round(n)));
    ok(aff[0] < aff[2], `${src}: más rasgos por arma en la Marea III`, aff.map(n => +n.toFixed(2)));
  }
  const by = ['pelea', 'elite', 'jefe'].map(src => avg(sample(src, 2).map(w => w.rarity)));
  ok(by[0] < by[1] && by[1] < by[2], 'un élite deja mejor botín que una pelea común, y un jefe mejor que un élite', by.map(n => +n.toFixed(2)));
  for (const k of ['pelea', 'elite', 'jefe']) ok([1, 2, 3].every(m => Math.abs(D.LOOT.odds[k][m].reduce((a, n) => a + n, 0) - 100) < 1e-9), `${k}: las chances de rareza suman 100`);
  ok(D.LOOT.drop[1] < D.LOOT.drop[2] && D.LOOT.drop[2] < D.LOOT.drop[3], 'más chance de arma por pelea en cada Marea');
  // el botín de la pelea entera
  const loots = (marea, mods = {}, source = 'pelea') => Array.from({ length: 1500 }, (_, i) => L.battleLoot({ result: fakeWin(ENC, 3, marea), source, marea, seed: i, mods }));
  const n = [1, 2, 3].map(m => loots(m).reduce((s, l) => s + l.items.length, 0));
  ok(n[0] < n[1] && n[1] < n[2], 'en 1500 peleas caen más armas cuanto más alta la Marea', n);
  const v = [1, 2, 3].map(m => loots(m)[0].veta);
  ok(v[0] < v[1] && v[1] < v[2], 'cada pelea da más veta para el árbol', v);
}

// ------------------------------------------------------------------
section('"Sos lo que llevás puesto": el arma define las habilidades');
{
  ok(J(L.weaponSkills('espada', 1)) === J(['golpe', 'tajo', 'guardia']), 'espada: su golpe y las dos primeras');
  ok(L.unlockedSkills('espada', 1).length === 2 && L.unlockedSkills('espada', D.SKILL_AT[2]).length === 3, 'la maestría abre la tercera');
  ok(J(L.weaponSkills('espada', 4, ['embestida'])) === J(['golpe', 'embestida', 'tajo']), 'se elige cuáles llevar');
  ok(J(L.weaponSkills('espada', 1, ['embestida'])) === J(['golpe', 'tajo', 'guardia']), 'una que la maestría no abrió no se puede elegir');
  ok(L.weaponSkills('nada').length === 0, 'sin arma conocida, nada');
  // dentro de una pelea
  const st = withWeapon('guerrero', 'martillo');
  const { b, lo } = battle(st);
  ok(J(unit(b, 'guerrero').abilities) === J(['golpe', 'remache', 'cepo']), 'el guerrero con martillo pelea con las habilidades del martillo', unit(b, 'guerrero').abilities);
  ok(J(unit(b, 'cazador').abilities) === J(['tiro', 'marcar', 'certero']), 'quien no equipó nada usa las del arma de su clase', unit(b, 'cazador').abilities);
  ok(J(lo.skills.guerrero) === J(unit(b, 'guerrero').abilities), 'loadout avisa qué lleva cada uno');
  A.equipWeapon(st, 'guerrero', A.addWeapon(st, { type: 'escudo', rarity: 0, traits: [], affixes: [] }).weapon.uid);
  ok(J(unit(battle(st).b, 'guerrero').abilities) === J(['golpe', 'guardia', 'resguardo']), 'cambia el arma, cambian las habilidades');
  A.addMastery(st, 'escudo', 100000);
  L.pickSkills(st, 'guerrero', ['aguante', 'guardia']);
  ok(J(unit(battle(st).b, 'guerrero').abilities) === J(['golpe', 'aguante', 'guardia']), 'con maestría se elige la tercera');
  // el líder: las del arma y las de su elemento
  const stL = withWeapon('lider', 'arco');
  const loL = L.loadout(stL, { party: PARTY, leaderCls: null });
  const bL = R.newBattle({ encounter: ENC, seed: 7, party: PARTY, level: 6, element: 'raiz', gear: loL.gear, fragments: ['brasa'] });
  const la = R.leaderOf(bL).abilities;
  ok(la[0] === 'tiro' && la.includes('marcar') && la.includes('enredar') && la.includes('ascua') && !la.includes('golpe'), 'el líder lleva las del arma, las de su elemento y el fragmento', la);
  // una partida vieja: armas con traits y sin affixes
  const old = { arsenal: { v: 1, nextUid: 2, items: [{ uid: 1, type: 'hacha', rarity: 2, traits: [{ id: 'vida' }, { id: 'afinidad', el: 'raiz' }] }], equipped: { guerrero: 1 }, filter: -1, mastery: {}, itemMastery: {}, luck: 0 } };
  const bo = battle(old);
  ok(J(unit(bo.b, 'guerrero').abilities) === J(['golpe', 'rapina', 'tajo']) && bo.lo.gear.guerrero.hp === 3 && bo.lo.gear.guerrero.affinity[0] === 'raiz', 'un arma de antes del A3 sigue valiendo (vida, afinidad) y define las habilidades');
  ok(!('affixes' in old.arsenal.items[0]) && old.arsenal.v === 1, 'el guardado viejo no se toca');
  // una pelea entera con lo puesto se puede jugar
  const full = L.loadout(withWeapon('lider', 'lanza', [], 2, withWeapon('curandero', 'baston', [{ id: 'venda', v: 2 }], 2, withWeapon('guerrero', 'martillo'))), { party: PARTY, leaderCls: 'guerrero' });
  const res = [1, 2, 3, 4].map(s => playBattle({ encounter: ENC, seed: s, party: PARTY, leader: { cls: 'guerrero' }, level: 3, classLevel: { guerrero: 2, cazador: 2, curandero: 2 }, gear: full.gear, rules: full.rules }).res);
  ok(res.every(r => ['win', 'lose', 'retreat'].includes(r.outcome)) && res.some(r => r.outcome === 'win'), 'el bot juega y gana peleas con las habilidades de las armas', res.map(r => r.outcome));
}

// ------------------------------------------------------------------
section('Los rasgos cambian las habilidades en la pelea');
{
  const base = battle(withWeapon('guerrero', 'espada')).b;
  const mod = (affixes, type = 'espada', who = 'guerrero') => battle(withWeapon(who, type, affixes)).b;
  const d0 = defOf(base, 'guerrero', 'tajo');
  ok(defOf(mod([{ id: 'peso', v: 2 }]), 'guerrero', 'tajo').plus === (d0.plus || 0) + 2, 'Ataques con recarga +2: el Tajo pega 2 más');
  ok(!defOf(mod([{ id: 'peso', v: 2 }]), 'guerrero', 'golpe').plus, '…y el golpe básico no cambia');
  ok(defOf(mod([{ id: 'filo', v: 1 }]), 'guerrero', 'golpe').plus === 1 && !defOf(mod([{ id: 'filo', v: 1 }]), 'guerrero', 'tajo').plus, 'Golpe básico +1 toca solo el básico');
  ok(defOf(mod([{ id: 'presteza', v: 1 }]), 'guerrero', 'tajo').cd === d0.cd - 1, 'la recarga del Tajo baja 1');
  ok(defOf(mod([{ id: 'oficio', v: 9 }]), 'guerrero', 'tajo').cd === 1, 'una recarga nunca baja de 1');
  ok(defOf(mod([{ id: 'amparo', v: 1 }]), 'guerrero', 'guardia').cover === ABILITIES.guardia.cover + 1, 'la Guardia cubre 1 más');
  ok(defOf(mod([{ id: 'alcance', v: 1 }], 'arco', 'cazador'), 'cazador', 'certero').range[1] === ABILITIES.certero.range[1] + 1, 'el Tiro certero llega 1 más lejos');
  ok(defOf(mod([{ id: 'venda', v: 2 }], 'baston', 'curandero'), 'curandero', 'curar').heal === ABILITIES.curar.heal + 2, 'Curar cura 2 más');
  ok(defOf(mod([{ id: 'cepo', v: 2 }, { id: 'nudo', v: 1 }], 'martillo'), 'guerrero', 'cepo').dmg === ABILITIES.cepo.dmg + 2 && defOf(mod([{ id: 'nudo', v: 1 }], 'martillo'), 'guerrero', 'cepo').root === ABILITIES.cepo.root + 1, 'el Cepo pega y frena más');
  ok(ABILITIES.tajo.plus === undefined && ABILITIES.tajo.cd === d0.cd, 'la tabla de habilidades no se toca');
  ok(defOf(mod([{ id: 'peso', v: 2 }]), 'cazador', 'certero').plus === ABILITIES.certero.plus, 'el rasgo es de quien lleva el arma, no del grupo');
  const t = mod([{ id: 'tecnica', v: 1, skill: 'salto' }]);
  ok(unit(t, 'guerrero').abilities.includes('salto') && unit(t, 'guerrero').abilities.length === 4, 'un arma puede prestar una habilidad de más');
  const s = battle(withWeapon('guerrero', 'espada', [{ id: 'vida', v: 3 }, { id: 'ataque', v: 1 }, { id: 'coraza', v: 1 }, { id: 'paso', v: 1 }])).b;
  const g0 = unit(base, 'guerrero'), g1 = unit(s, 'guerrero');
  ok(g1.maxHp === g0.maxHp + 3 && g1.atk === g0.atk + 1 && g1.armor === g0.armor + 1 && g1.mv === g0.mv + 1, 'vida, ataque, coraza y movimiento');
  ok(battle(withWeapon('guerrero', 'espada', [{ id: 'afin_brasa', v: 1 }])).lo.gear.guerrero.affinity.includes('brasa'), 'afinidad con un elemento');
  ok(battle(withWeapon('guerrero', 'espada', [{ id: 'rapina', v: 2 }])).b.lootWin === base.lootWin + 2, 'las pasivas (botín al ganar) llegan al combate');
  // el daño de verdad: un enemigo al lado del guerrero
  const hit = (b, ability) => {
    const g = unit(b, 'guerrero'), e = b.units.find(u => u.side === 'enemy');
    e.x = g.x; e.y = g.y - 1; e.armor = 0; e.hp = e.maxHp = 30;
    b.units.filter(u => u !== e && u !== g && u.x === e.x && u.y === e.y).forEach(u => { u.x = -1; u.alive = false; });
    const r = R.act(b, g.id, ability, e.x, e.y);
    return r.ok ? 30 - e.hp : null;
  };
  const dA = hit(base, 'tajo'), dB = hit(mod([{ id: 'peso', v: 2 }]), 'tajo');
  ok(dA > 0 && dB === dA + 2, 'el Tajo con el rasgo saca 2 más de vida', [dA, dB]);
  const cdB = mod([{ id: 'presteza', v: 1 }]);
  hit(cdB, 'tajo'); hit(base, 'tajo');
  ok(unit(cdB, 'guerrero').cd.tajo === unit(base, 'guerrero').cd.tajo - 1, 'y con Presteza vuelve un turno antes');
}

// ------------------------------------------------------------------
section('Reglas que cambian el combate');
{
  const plain = R.newBattle({ encounter: ENC, seed: 7, party: PARTY, leader: { cls: 'guerrero' }, level: 3 });
  const rb = (rules, extra = {}) => R.newBattle({ encounter: ENC, seed: 7, party: PARTY, leader: { cls: 'guerrero' }, level: 3, rules, ...extra });
  const foes = (b) => b.units.filter(u => u.side === 'enemy');
  const hp = (b) => foes(b).reduce((s, u) => s + u.hp, 0);
  ok(J(rb(null).units) === J(plain.units) && J(rb({}).units) === J(plain.units), 'sin reglas, la pelea es la de siempre');
  ok(hp(rb({ foeHp: 0.5 })) < hp(plain) && hp(rb({ foeHp: 1.5 })) > hp(plain), 'foeHp: los enemigos llegan con menos o con más vida');
  ok(foes(rb({ foeAtk: 1 })).every((u, i) => u.atk === foes(plain)[i].atk + (foes(plain)[i].atk ? 1 : 0)), 'foeAtk: pegan 1 más');
  ok(rb({ maxTurns: 2 }).maxTurns === plain.maxTurns + 2, 'maxTurns: la noche tarda 2 turnos más');
  const sc = rb({ startCover: 2 });
  ok(sc.units.filter(u => u.side === 'ally').every(u => sc.cover[u.id] === 2), 'startCover: el grupo empieza cubierto');
  // noHeal
  const heal = (rules) => {
    const st = withWeapon('curandero', 'baston');
    const lo = L.loadout(st, { party: PARTY, leaderCls: 'guerrero' });
    const b = rb(rules, { gear: lo.gear });
    const c = unit(b, 'curandero'); c.hp -= 3;
    R.act(b, c.id, 'curar', c.x, c.y);
    return c.maxHp - c.hp;
  };
  ok(heal(null) === 0 && heal({ noHeal: true }) === 3, 'noHeal: nadie se cura');
  // killHeal
  const kill = (rules) => {
    const b = rb(rules);
    const g = unit(b, 'guerrero'), e = foes(b)[0];
    g.hp -= 3; e.x = g.x; e.y = g.y - 1; e.hp = 1; e.armor = 0;
    R.act(b, g.id, 'golpe', e.x, e.y);
    return g.maxHp - g.hp;
  };
  ok(kill(null) === 3 && kill({ killHeal: 1 }) === 2, 'killHeal: quien liquida se cura 1');
  // closeRank y startCover: menos daño recibido en peleas enteras (las mismas semillas)
  const lost = (rules) => { let n = 0; for (let s = 1; s <= 24; s++) { const { b } = playBattle({ encounter: FARM.arroyo.comunes[s % 6], seed: s, party: PARTY, leader: { cls: 'guerrero' }, level: 3, classLevel: { guerrero: 2, cazador: 2, curandero: 2 }, rules }); n += b.units.filter(u => u.side === 'ally').reduce((a, u) => a + (u.maxHp - Math.max(0, u.hp)), 0); } return n; };
  const l0 = lost(null), l1 = lost({ closeRank: 1 }), l2 = lost({ startCover: 2 });
  ok(l1 < l0, 'closeRank: en 24 peleas el grupo pierde menos vida', [l0, l1]);
  ok(l2 < l0, 'startCover: en 24 peleas el grupo pierde menos vida', [l0, l2]);
  ok(J(L.mergeRules([{ foeHp: 0.8, maxTurns: 2 }, { foeHp: 1.25, maxTurns: 1, noHeal: true }])) === J({ foeHp: 1, maxTurns: 3, noHeal: true }), 'las reglas de varias fuentes se juntan');
}

// ------------------------------------------------------------------
section('Reliquias de salida');
{
  const run = L.newRun({ seed: 11, marea: 2 });
  const o1 = L.relicOffer(run);
  ok(o1.length === D.RELIC_OFFER && new Set(o1).size === o1.length && o1.every(id => D.RELICS[id]), 'se ofrecen 3 distintas');
  ok(J(L.relicOffer(L.newRun({ seed: 11, marea: 2 }))) === J(o1) && J(L.relicOffer(L.newRun({ seed: 12 }))) !== J(o1), 'misma salida, misma oferta; otra salida, otra');
  ok(!L.takeRelic(run, D.RELIC_IDS.find(id => !o1.includes(id))).ok, 'no se puede tomar una que no se ofreció');
  ok(L.takeRelic(run, o1[1]).ok && run.relics.length === 1, 'se toma una');
  const o2 = L.relicOffer(run);
  ok(!o2.includes(o1[1]) && J(o2) !== J(o1), 'la siguiente oferta es otra y no repite la que ya se lleva');
  L.skipRelic(run);
  ok(J(L.relicOffer(run)) !== J(o2), 'se puede pasar de largo');
  while (run.relics.length < D.RELIC_MAX) L.takeRelic(run, L.relicOffer(run)[0]);
  ok(run.relics.length === D.RELIC_MAX && L.relicOffer(run).length === 0, `se llevan hasta ${D.RELIC_MAX}`);
  ok(L.newRun({ seed: 11 }).relics.length === 0, 'duran una salida: la siguiente arranca sin ninguna');
  // cada una cambia algo: lo que lleva el grupo, las reglas del combate o el botín
  const st = withWeapon('guerrero', 'martillo');
  const none = L.loadout(st, { party: PARTY, leaderCls: 'guerrero', run: L.newRun({}) });
  const same = D.RELIC_IDS.filter(id => J(L.loadout(st, { party: PARTY, leaderCls: 'guerrero', run: { ...L.newRun({}), relics: [id] } })) === J(none));
  ok(!same.length, 'las 15 cambian algo de la salida', same);
  const rules = D.RELIC_IDS.filter(id => D.RELICS[id].rules || D.RELICS[id].loot || D.RELICS[id].skillCap != null);
  ok(rules.length >= 8, `la mayoría cambia reglas, no solo números (${rules.length})`);
  const with1 = (id) => battle(st, {}, { ...L.newRun({}), relics: [id] });
  ok(J(unit(with1('un_solo_oficio').b, 'guerrero').abilities) === J(['golpe', 'remache']) && defOf(with1('un_solo_oficio').b, 'guerrero', 'remache').cd === ABILITIES.remache.cd - 1, 'Un solo oficio: una habilidad del arma y recargas más cortas');
  ok(with1('cuerno_roto').b.rules.foeHp < 1 && with1('reloj_parado').b.maxTurns === battle(st).b.maxTurns + 2, 'Cuerno roto y Reloj parado llegan a la pelea');
  ok(defOf(with1('piedra_de_afilar').b, 'cazador', 'tiro').plus === 1 && unit(with1('farol_de_proa').b, 'curandero').maxHp === unit(battle(st).b, 'curandero').maxHp + 2, 'Piedra de afilar y Farol de proa valen para todo el grupo');
  ok(with1('ojo_de_vidrio').b.intentPlus >= 9, 'Ojo de vidrio: se ven todas las intenciones');
  // las del botín
  const lm = (id) => L.loadout({}, { party: PARTY, run: { ...L.newRun({}), relics: [id] } }).loot;
  const many = (mods, source = 'pelea', marea = 1, extra = {}) => Array.from({ length: 800 }, (_, i) => L.battleLoot({ result: fakeWin(ENC, 3, marea), source, marea, seed: i, mods, ...extra }));
  const items = (ls) => ls.flatMap(l => l.items);
  ok(avg(items(many(lm('vela_negra'))).map(w => w.tier)) === 2 && avg(items(many({})).map(w => w.tier)) === 1, 'Vela negra: el botín es el de una Marea más');
  ok(avg(items(many(lm('moneda_marcada'), 'elite')).map(w => w.rarity)) > avg(items(many({}, 'elite')).map(w => w.rarity)), 'Moneda marcada: el élite deja botín de jefe');
  ok(avg(items(many(lm('hueso_de_suerte'))).map(w => w.rarity)) > avg(items(many({})).map(w => w.rarity)), 'Hueso de la suerte: mejor rareza');
  const mir = many(lm('espejo_roto'), 'elite'), nor = many({}, 'elite');
  ok(items(mir).length === 2 * items(nor).length && avg(items(mir).map(w => w.rarity)) < avg(items(nor).map(w => w.rarity)), 'Espejo roto: el doble de armas, un escalón peores');
  ok(items(mir).every(w => w.affixes.length <= D.AFFIX_COUNT[w.rarity][1]), '…y con los rasgos de su rareza');
  const sum = (m) => Object.values(m).reduce((a, n) => a + n, 0);
  const bag = (wins) => sum(L.battleLoot({ result: fakeWin(), mods: lm('bolsa_sin_fondo'), wins }).mats);
  ok(bag(0) === 6 && bag(3) === 9 && bag(20) === 11, 'Bolsa sin fondo: crece con las peleas ganadas, hasta 5', [bag(0), bag(3), bag(20)]);
}

// ------------------------------------------------------------------
section('Botín de la pelea y de la resolución automática');
{
  const none = L.battleLoot({ result: { enc: ENC, outcome: 'lose', stars: 0, loot: { mats: {} } }, seed: 1 });
  ok(!none.items.length && !none.veta && !Object.keys(none.mats).length, 'una derrota no deja nada');
  const a = L.battleLoot({ result: fakeWin(), source: 'elite', marea: 2, seed: 5 }), b = L.battleLoot({ result: fakeWin(), source: 'elite', marea: 2, seed: 5 });
  ok(J(a) === J(b) && J(a) !== J(L.battleLoot({ result: fakeWin(), source: 'elite', marea: 2, seed: 6 })), 'misma pelea y semilla, mismo botín');
  ok(a.items.length === D.LOOT.count.elite[2] && L.battleLoot({ result: fakeWin(), source: 'jefe', marea: 3, seed: 5 }).items.length === D.LOOT.count.jefe[3], 'élites y jefes dejan armas siempre');
  ok(J(a.mats) === J(fakeWin().loot.mats), 'los materiales son los de la pelea');
  ok(L.battleLoot({ result: fakeWin(), seed: 1, mods: { mats: 2 } }).mats.madera === 5, 'el árbol suma materiales');
  // la resolución automática: botín completo
  const played = playBattle({ encounter: ENC, seed: 3, party: PARTY, leader: { cls: 'guerrero' }, level: 6, classLevel: { guerrero: 4, cazador: 4, curandero: 4 }, marea: 2 }).res;
  const auto = R.autoResolve({ encounter: ENC, best: 3, marea: 2 });
  ok(auto && auto.auto && auto.stars === 3 && auto.outcome === 'win', 'una pelea ya ganada con 3 estrellas se resuelve sola');
  const lp = L.battleLoot({ result: { ...played, outcome: 'win', stars: 3 }, marea: 2, seed: 44 }), la = L.battleLoot({ result: auto, marea: 2, seed: 44 });
  ok(J(la.items) === J(lp.items) && la.veta === lp.veta, 'la resolución automática deja las mismas armas y la misma veta que jugarla con 3 estrellas');
  ok(J(auto.loot.mats) === J(R.autoResolve({ encounter: ENC, best: 3, marea: 2 }).loot.mats) && Object.values(la.mats).reduce((s, n) => s + n, 0) >= Object.values(L.battleLoot({ result: R.autoResolve({ encounter: ENC, best: 3, marea: 1 }), marea: 1, seed: 44 }).mats).reduce((s, n) => s + n, 0), 'y los materiales completos de esa Marea');
  const autos = (m) => Array.from({ length: 1000 }, (_, i) => L.battleLoot({ result: R.autoResolve({ encounter: ENC, best: 3, marea: m }), marea: m, seed: i }));
  const fought = (m) => Array.from({ length: 1000 }, (_, i) => L.battleLoot({ result: fakeWin(ENC, 3, m), marea: m, seed: i }));
  ok([1, 2, 3].every(m => autos(m).reduce((s, l) => s + l.items.length, 0) === fought(m).reduce((s, l) => s + l.items.length, 0)), 'en 1000 peleas resueltas solas caen tantas armas como jugándolas, en las tres Mareas');
  ok(L.battleLoot({ result: fakeWin(ENC, 1), seed: 1 }).veta < L.battleLoot({ result: fakeWin(ENC, 3), seed: 1 }).veta, 'más estrellas, más veta');
  ok(Array.from({ length: 300 }, (_, i) => L.battleLoot({ result: fakeWin(), seed: i, mods: { sure: true } })).every(l => l.items.length >= 1), 'Marea adentro: cada pelea deja un arma');
  ok(Array.from({ length: 300 }, (_, i) => L.battleLoot({ result: fakeWin(), seed: i, mods: { sure: true }, luck: D.LOOT.luck.after })).every(l => l.items[0].rarity >= D.LOOT.luck.min && l.luck === 0), 'contador de suerte: tras la racha, la próxima es rara como mínimo');
  const dry = L.battleLoot({ result: fakeWin(), seed: 1, mods: {}, luck: 2 });
  ok(dry.luck === (dry.items.some(w => w.rarity >= 2) ? 0 : 3), 'sin un arma rara, la racha crece');
  const f0 = fought(1).reduce((s, l) => s + l.items.length, 0), f1 = Array.from({ length: 1000 }, (_, i) => L.battleLoot({ result: fakeWin(), seed: i, mods: { find: 20 } })).reduce((s, l) => s + l.items.length, 0);
  ok(f1 > f0 * 1.2, 'el rasgo de hallazgo hace caer más armas', [f0, f1]);
  // applyLoot y noteWin
  const st = {};
  const loot = L.battleLoot({ result: fakeWin(), source: 'jefe', marea: 3, seed: 9 });
  const r = L.applyLoot(st, loot);
  ok(st.arsenal.items.length === loot.items.length && r.weapons.every(w => w.uid) && st.arsenal.items.every(w => w.affixes.length), 'las armas quedan en el arsenal con sus rasgos');
  ok(st.tree.xp === loot.veta && st.arsenal.luck === loot.luck && J(r.mats) === J(loot.mats), 'la veta va al árbol; los materiales se devuelven para que los dé la economía');
  ok(r.points && T.treeInfo(st).points >= 1, 'un jefe de Marea III ya da un punto del árbol');
  const st2 = JSON.parse(JSON.stringify(st));
  A.arsenalState(st2); T.treeState(st2);
  ok(J(st2) === J(st), 'guardar y volver a abrir no cambia nada');
  st.arsenal.filter = 4; A.arsenalState(st); st.arsenal.filter = 3;
  const before = st.arsenal.items.length;
  const r2 = L.applyLoot(st, { items: [{ type: 'espada', rarity: 0, traits: [], affixes: [{ id: 'vida', v: 1 }] }], veta: 0, luck: 0 });
  ok(st.arsenal.items.length === before && Object.keys(r2.scrapped).length > 0, 'el filtro de desarme de siempre sigue andando');
  const run = L.newRun({ seed: 1 });
  L.noteWin(run, fakeWin(ENC, 2)); L.noteWin(run, fakeWin(ENC, 3)); L.noteWin(run, { enc: ENC, outcome: 'lose' });
  ok(run.wins === 2 && run.best[ENC] === 3 && R.canAutoResolve(ENC, run.best[ENC]), 'la salida anota las peleas ganadas y las mejores estrellas');
  // equipar lo mejor
  const st3 = {};
  const rng = L.rngOf(8);
  for (let i = 0; i < 30; i++) A.addWeapon(st3, L.rollItem(rng, { marea: 2, source: 'elite' }));
  const eq = L.equipBest(st3, PARTY, 'guerrero');
  ok(Object.keys(eq).length === 4 && new Set(Object.values(eq)).size === 4, 'equipBest arma a los cuatro sin repetir');
  ok(PARTY.every(c => A.canWield(c, A.equippedOn(st3, c).type)), 'cada uno con un arma que puede llevar');
  const top = Math.max(...st3.arsenal.items.map(L.itemPower));
  ok(L.itemPower(A.equippedOn(st3, 'lider')) === top, 'el líder se queda con la de más fuerza');
}

console.log(`\n${fail ? '✘' : '✔'} ${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
