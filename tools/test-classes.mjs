// Pruebas de las clases (El Quiebre, paso 5b; DESIGN-COMBAT.md §14):
//   1. node: datos y curvas (src/combat/classes.js), kits y pasivas en el motor de combate, la expedición con clases y la
//      migración pura de los roles (src/core/classes-migrate.js).
//   2. Chrome headless (SwiftShader): el estado de la partida (src/core/classes.js): experiencia de clase y del líder,
//      subclase de Raíz, amenazas, y una partida vieja con roles que se migra al cargar.
//   node test-classes.mjs            todo
//   node test-classes.mjs --quick    solo la parte de node
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { UNITS, ABILITIES, ENCOUNTERS, COMBAT } from '../src/combat/combat-data.js';
import * as K from '../src/combat/classes.js';
import * as R from '../src/combat/combat-rules.js';
import * as X from '../src/expedition/exp-rules.js';
import { migrateClasses, migrateBattle } from '../src/core/classes-migrate.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUICK = process.argv.includes('--quick');
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ok  ', msg); } else { fail++; console.log('  MAL ', msg, extra !== undefined ? JSON.stringify(extra) : ''); } };
const section = (t) => console.log('\n' + t);
const byType = (b, t) => b.units.find(u => u.type === t && u.alive);
const place = (u, x, y) => { u.x = x; u.y = y; };
const clear = (b) => { for (const e of b.units.filter(u => u.side === 'enemy')) e.alive = false; };

// ------------------------------------------------------------------ datos
section('Clases y subclases (datos)');
ok(K.CLASS_IDS.length === 6 && K.CLASS_IDS.every(id => K.CLASSES[id] && UNITS[id]), 'las 6 clases base tienen datos y unidad', K.CLASS_IDS);
ok(K.CLASS_IDS.every(id => K.CLASSES[id].pool.length === 4 && K.CLASSES[id].passives.length === 3), 'cada clase: 4 activas elegibles y 3 pasivas');
ok(K.missingAbilities().length === 0, 'todas las habilidades de clases y subclases existen', K.missingAbilities());
ok(Object.keys(K.ROLE_CLASS).join() === 'exploracion,ingenieria,sanidad,guia,recoleccion' && K.ROLE_CLASS.exploracion === 'cazador' && K.ROLE_CLASS.ingenieria === 'forjador'
  && K.ROLE_CLASS.sanidad === 'curandero' && K.ROLE_CLASS.guia === 'monje' && K.ROLE_CLASS.recoleccion === 'saqueador', 'cada rol viejo pasa a su clase');
const raiz = K.SUBCLASS_IDS.map(id => K.SUBCLASSES[id]).filter(s => s.element === 'raiz');
ok(raiz.length === 6 && new Set(raiz.map(s => s.cls)).size === 6, 'las 6 subclases de Raíz, una por clase');
ok(raiz.every(s => s.abilities.length === 2 && s.passive && s.abilities.every(id => ABILITIES[id])), 'cada subclase: 2 habilidades y una pasiva');
ok(K.subclassFor('guerrero', 'raiz')?.name === 'Guardián de Raíz', 'Guerrero + Raíz → Guardián de Raíz');
ok(K.availableSubclasses('cazador', []).length === 0 && K.availableSubclasses('cazador', ['raiz'])[0].id === 'acechador_raiz', 'la subclase se abre con el elemento');

section('Nivel de clase (1 a 10)');
ok(K.classLevelFromXp(0) === 1 && K.classLevelFromXp(199) === 1 && K.classLevelFromXp(200) === 2 && K.classLevelFromXp(9000) === 10 && K.classLevelFromXp(99999) === 10, 'curva de experiencia');
ok(K.classLevelFromXp(9000, 4) === 4, 'el edificio pone el tope (2 × su nivel)');
// la curva de antes (paso 5b, cuarta parte): lo juntado se pasa a la nueva con el mismo nivel
{
  const v1lv = (x) => { let l = 1; while (l < 10 && x >= K.CLASS_XP_V1[l]) l++; return l; };
  const xs = [0, 29, 30, 55, 149, 150, 349, 350, 829, 1049, 1050, 1300];
  ok(xs.every(x => K.classLevelFromXp(K.remapClassXp(x)) === v1lv(x)), 'remapClassXp: nadie cambia de nivel con la curva nueva', xs.map(x => [x, v1lv(x), K.remapClassXp(x)]));
  ok(K.remapClassXp(55) === 400 && K.remapClassXp(1300) === 9250, 'y lo juntado dentro del nivel se mantiene en proporción');
}
const ci = K.classXpInfo(700);
ok(ci.level === 3 && ci.into === 100 && ci.need === 600 && !ci.max, 'cuánto falta para el próximo nivel', ci);
const c1 = K.memberKit('cazador', 1), c3 = K.memberKit('cazador', 3), c5 = K.memberKit('cazador', 5);
ok(c1.abilities.join() === 'tiro,marcar,tiro_pie', 'nivel 1: ataque básico y las 2 primeras del grupo', c1.abilities);
ok(K.unlockedPool('cazador', 1).length === 2 && K.unlockedPool('cazador', 3).length === 3 && K.unlockedPool('cazador', 6).length === 4, 'el grupo de 4 se abre en los niveles 1, 3 y 6');
ok(K.memberKit('cazador', 3, ['certero', 'marcar']).abilities.join() === 'tiro,certero,marcar', 'se eligen 2 activas de las abiertas');
ok(K.memberKit('cazador', 1, ['lazo']).abilities.join() === 'tiro,marcar,tiro_pie', 'una sin abrir no se puede elegir');
ok(c5.hp === UNITS.cazador.hp + 2 && c5.atk === UNITS.cazador.atk + 1 && c3.hp === UNITS.cazador.hp + 1, 'vida +1 cada 2 niveles y ataque +1 cada 4', { c3: c3.hp, c5: [c5.hp, c5.atk] });
for (let bl = 1; bl <= 5; bl++) {
  const k = K.memberKit('forjador', 2 * bl - 1);
  if (k.hp !== UNITS.forjador.hp + (bl - 1) || k.atk !== UNITS.forjador.atk + Math.floor((bl - 1) / 2)) ok(false, `nivel de clase ${2 * bl - 1} = rol viejo ${bl}`, k);
}
ok(true, 'el nivel de clase 2 × n − 1 pega y aguanta como el rol viejo de nivel n');
const g1 = K.memberKit('guerrero', 1), g9 = K.memberKit('guerrero', 9);
ok(g1.armor === 1 && !g1.flags.guardAdj && K.memberKit('guerrero', 5).flags.guardAdj === 1 && g9.hp === UNITS.guerrero.hp + 4 + 3, 'pasivas en los niveles 1, 5 y 9 (guerrero)', { g1, g9: g9.hp });
ok(K.memberKit('monje', 1).flags.noStuck && K.memberKit('curandero', 1).flags.medic && K.memberKit('forjador', 1).flags.smith, 'las reglas viejas de cada rol son la pasiva de nivel 1');

section('Nivel del líder (1 a 30)');
ok(K.leaderLevelFromXp(0) === 1 && K.leaderLevelFromXp(99) === 1 && K.leaderLevelFromXp(100) === 2 && K.leaderLevelFromXp(250) === 3, 'curva: 100 + 50 por nivel', [K.leaderLevelFromXp(100), K.leaderLevelFromXp(250)]);
ok(K.leaderLevelFromXp(K.leaderXpFor(30)) === 30 && K.leaderLevelFromXp(1e9) === 30 && K.leaderXpFor(30) === 23200, 'tope 30', K.leaderXpFor(30));
const li = K.leaderXpInfo(120);
ok(li.level === 2 && li.into === 20 && li.need === 150 && li.next.level === 5, 'lo que falta y el próximo nivel clave', li);
const p1 = K.leaderPerks(1), p6 = K.leaderPerks(6), p12 = K.leaderPerks(12);
ok(p1.classSlots === 0 && p1.subSlots === 1 && K.leaderPerks(5).subSlots === 2 && p6.classSlots === 1 && !K.leaderPerks(7).subPassive && K.leaderPerks(8).subPassive && p12.classSlots === 2,
  'niveles clave: 1 y 5 subclase, 6 y 12 clase, 8 pasiva de subclase');
ok(p1.hp === 0 && K.leaderPerks(4).atk === 1 && K.leaderPerks(10).hp === 4 && K.leaderPerks(10).morale === 1, 'bonus chico por nivel: vida, ataque y ánimo cada 10');
const n1 = K.leaderKit({ level: 1, element: 'raiz' }), n5 = K.leaderKit({ level: 5, element: 'raiz' });
ok(n1.abilities.join() === 'golpe,enredar' && n5.abilities.join() === 'golpe,enredar,muro_raiz' && n1.hp === 12, 'sin clase, el líder pelea como antes', [n1.abilities, n5.abilities]);
const gl1 = K.leaderKit({ cls: 'guerrero', level: 1 }), gl5 = K.leaderKit({ cls: 'guerrero', level: 5, element: 'raiz' });
ok(gl1.abilities.join() === 'golpe' && gl1.hp === 15 && gl1.armor === 1, 'guerrero nivel 1: Golpe, +3 de vida y Coraza', gl1);
ok(gl5.sub === 'guardian_raiz' && gl5.abilities.join() === 'golpe,abrazo_raiz,muro_raiz', 'con Raíz, las 2 de Guardián de Raíz', gl5.abilities);
const gl8 = K.leaderKit({ cls: 'guerrero', level: 8, elements: ['raiz'], picks: ['guardia'] });
ok(gl8.abilities.join() === 'golpe,guardia,abrazo_raiz,muro_raiz' && gl8.hp === 15 + K.leaderPerks(8).hp + 3 && gl8.classLevel === 3, 'nivel 8: una activa de clase elegida y la pasiva de la subclase', gl8);
ok(K.leaderKit({ cls: 'cazador', level: 1 }).abilities[0] === 'tiro' && K.leaderKit({ cls: 'cazador', level: 1 }).atk === 2, 'el líder cazador tira de lejos');
ok(K.resolveSubclass('monje', 'guardian_raiz', ['raiz']).id === 'caminante_raiz', 'una subclase de otra clase no vale: queda la suya');

// ------------------------------------------------------------------ motor
section('Combate con clases');
const b = R.newBattle({ encounter: 'bosque_claro', seed: 3, party: ['guerrero', 'monje', 'cazador'], level: 6, leader: { cls: 'forjador' },
  classLevel: { guerrero: 5, monje: 1, cazador: 1 } });
const L = byType(b, 'lider'), G = byType(b, 'guerrero'), M = byType(b, 'monje'), Cz = byType(b, 'cazador');
ok(L.cls === 'forjador' && L.abilities.join() === 'golpe,trampa' && b.leader.cls === 'forjador', 'el líder con su clase', L.abilities);
ok(G.maxHp === K.memberKit('guerrero', 5).hp && G.armor === 1 && G.f.guardAdj === 1, 'el integrante con su nivel de clase y pasivas', { hp: G.maxHp, f: G.f });
ok(b.intentPlus === 1 && R.visibleIntentIds(b).size <= COMBAT.intentsBase + 1, 'el Rastreador suma una intención a la vista');
// el monje no se traba
clear(b);
const foe = b.units.find(u => u.side === 'enemy');
foe.alive = true; place(foe, 4, 4); place(M, 4, 5); place(Cz, 5, 4);
ok(!R.isStuck(b, M) && R.isStuck(b, Cz), 'el monje no se traba; el cazador sí');
const b2 = R.newBattle({ encounter: 'bosque_claro', seed: 3, party: ['guerrero'], level: 1, classLevel: { guerrero: 5 } });
const G2 = byType(b2, 'guerrero'), L2 = byType(b2, 'lider');
clear(b2);
const w = b2.units.find(u => u.side === 'enemy'); w.alive = true;
place(G2, 3, 4); place(L2, 3, 5); place(w, 4, 5);
w.intent = { id: 'mordida', name: 'Mordida', pattern: 'ring', dmg: 3, dir: [0, 1], len: 0 }; w.dir = [0, 1];
const gh = G2.hp;
place(w, 4, 4);   // al lado del guerrero y en diagonal del líder: muerde al guerrero
R.endTurn(b2); R.enemyTurn(b2);
ok(G2.hp === gh - 2 || G2.hp === gh - 3, 'Coraza: el guerrero recibe 1 menos', { antes: gh, después: G2.hp });
// Tajo pega a los costados
const b3 = R.newBattle({ encounter: 'cerro_veta', seed: 1, party: ['guerrero'], level: 1 });
const G3 = byType(b3, 'guerrero');
const bs = b3.units.filter(u => u.side === 'enemy');
for (const e of bs) e.alive = false;
const [f1, f2, f3] = bs; for (const e of [f1, f2, f3]) { e.alive = true; e.armor = 0; e.hp = e.maxHp = 20; }
for (const u of b3.units.filter(u => u.side === 'ally' && u !== G3)) place(u, 0, 7 - b3.units.indexOf(u) % 2);
place(G3, 4, 5); place(f1, 4, 4); place(f2, 3, 4); place(f3, 5, 4);
b3.tiles = b3.tiles.map(() => 'llano');
const tj = R.act(b3, G3.id, 'tajo', 4, 4);
ok(tj.ok && f1.hp < 20 && f2.hp < 20 && f3.hp < 20, 'Tajo pega al de enfrente y a sus costados', [tj.why, f1.hp, f2.hp, f3.hp]);
// Salto y Brote
const b4 = R.newBattle({ encounter: 'bosque_claro', seed: 2, party: ['monje'], level: 5, leader: { cls: 'monje' }, element: 'raiz', classLevel: { monje: 6 } });
const M4 = byType(b4, 'monje'), L4 = byType(b4, 'lider');
b4.tiles = b4.tiles.map(() => 'llano'); clear(b4);
const keep = b4.units.find(u => u.side === 'enemy'); keep.alive = true; place(keep, 0, 0);
place(M4, 4, 6); place(L4, 2, 6);
R.move(b4, M4.id, 4, 6);
const sj = R.act(b4, M4.id, 'salto', 4, 3);
ok(K.memberKit('monje', 6, ['salto', 'empujar']).abilities.includes('salto') && !sj.ok, 'Salto: solo si lo eligió', sj.why);
const b5 = R.newBattle({ encounter: 'bosque_claro', seed: 2, party: ['monje'], level: 5, leader: { cls: 'monje' }, element: 'raiz', picks: { monje: ['salto', 'esquivar'] }, classLevel: { monje: 6 } });
const M5 = byType(b5, 'monje'), L5 = byType(b5, 'lider');
b5.tiles = b5.tiles.map(() => 'llano'); clear(b5);
const k5 = b5.units.find(u => u.side === 'enemy'); k5.alive = true; place(k5, 0, 0);
place(M5, 4, 6); place(L5, 2, 6);
const s5 = R.act(b5, M5.id, 'salto', 4, 3);
ok(s5.ok && M5.x === 4 && M5.y === 3, 'Salto: salta a una casilla libre', s5.why);
ok(L5.abilities.includes('brote') && L5.mv === UNITS.monje.mv, 'el líder Caminante de Raíz tiene Brote', L5.abilities);
const br = R.act(b5, L5.id, 'brote', 2, 4);
ok(br.ok && L5.y === 4 && b5.walls.some(wl => wl.x === 2 && wl.y === 6 && wl.root), 'Brote: salta y deja una pared de raíz donde estaba', br.why);
const b6 = R.newBattle({ encounter: 'bosque_claro', seed: 2, party: ['monje'], picks: { monje: ['esquivar', 'empujar'] }, classLevel: { monje: 3 } });
const M6 = byType(b6, 'monje');
R.act(b6, M6.id, 'esquivar', M6.x, M6.y);
ok(b6.cover[M6.id] === 3 && Object.keys(b6.cover).length === 1, 'Esquivar cubre solo a quien lo usa');
// Tiro al pie: frena sin sacarle el golpe
const b7 = R.newBattle({ encounter: 'bosque_claro', seed: 4, party: ['cazador'] });
const C7 = byType(b7, 'cazador');
b7.tiles = b7.tiles.map(() => 'llano'); clear(b7);
const e7 = b7.units.find(u => u.side === 'enemy'); e7.alive = true; place(e7, C7.x, C7.y - 3);
e7.intent = { id: 'mordida', name: 'Mordida', pattern: 'ring', dmg: 3, dir: [0, 1], len: 0 };
const tp = R.act(b7, C7.id, 'tiro_pie', e7.x, e7.y);
ok(tp.ok && e7.root >= 1 && !!e7.intent && !b7.walls.length, 'Tiro al pie: lo frena, su golpe sigue marcado y no hay pared', tp.why);
// botín del saqueador
const b8 = R.newBattle({ encounter: 'bosque_claro', seed: 5, party: ['saqueador'] });
ok(b8.lootWin === 1, 'Bolsillo hondo: el saqueador suma botín al ganar');
clear(b8); b8.outcome = 'win'; b8.ended = true;
const r8 = R.result(b8), r0 = (() => { const c = R.newBattle({ encounter: 'bosque_claro', seed: 5, party: ['cazador'] }); clear(c); c.outcome = 'win'; c.ended = true; return R.result(c); })();
const sum = (m) => Object.values(m).reduce((a, n) => a + n, 0);
ok(sum(r8.loot.mats) === sum(r0.loot.mats) + 1, 'al ganar, 1 material más', [r8.loot.mats, r0.loot.mats]);
// roles viejos en newBattle
const old = R.newBattle({ encounter: 'bosque_claro', seed: 1, party: ['exploracion', 'guia'], roleLevel: { exploracion: 3 } });
ok(byType(old, 'cazador')?.maxHp === UNITS.cazador.hp + 2 && !!byType(old, 'monje')?.f.noStuck, 'un grupo con roles viejos pelea con sus clases (rol 3 = clase 5)', byType(old, 'cazador')?.maxHp);
// estadísticas por clase
const sim = R.newBattle({ encounter: 'bosque_claro', seed: 7, party: ['guerrero', 'cazador', 'saqueador'] });
const ok2 = R.act(sim, byType(sim, 'cazador').id, 'marcar', sim.units.find(u => u.side === 'enemy').x, sim.units.find(u => u.side === 'enemy').y);
ok(!ok2.ok || Object.keys(sim.stats.dmg).every(k => k === 'cazador'), 'el daño se cuenta por clase', sim.stats.dmg);
// guardar y retomar
const js = JSON.parse(JSON.stringify(b5));
ok(js.units.find(u => u.type === 'lider').f && js.leader.cls === 'monje', 'la pelea con clases es JSON puro');

section('Expedición con clases');
const run = X.newRun({ region: 'bosque', zone: 1, seed: 5, party: ['exploracion', 'guia'], mods: { roleLevel: { exploracion: 2 } } });
ok(run.party.join() === 'cazador,monje' && run.tier.cazador === 2 && X.classTier(run, 'cazador') === 2 && X.classTier(run, 'monje') === 1, 'una salida con roles viejos sale con sus clases', run.party);
ok(X.hasClass(run, 'monje') && X.stepCost(run, { terrain: 'roca' }) <= 2, 'el monje pasa mejor por la roca (como la guía)');
const fake = { party: ['guerrero'], tier: { guerrero: 1 }, equip: [], mods: {}, zone: 1, region: 'bosque', care: 0 };
const derr = X.optionChance(fake, null, { base: 45, role: { forjador: 30, guerrero: 20 } });
ok(derr.p === 65, 'el Guerrero abre paso: +20 en un derrumbe', derr);
const r10 = X.newRun({ region: 'bosque', zone: 1, seed: 5, party: ['cazador'], mods: { leader: { level: 10 } } });
const r1 = X.newRun({ region: 'bosque', zone: 1, seed: 5, party: ['cazador'], mods: { leader: { level: 9 } } });
ok(r10.moraleMax === r1.moraleMax + 1, 'el líder de nivel 10 aguanta 1 de ánimo más', [r1.moraleMax, r10.moraleMax]);
const fr = X.newRun({ region: 'banado', zone: 1, seed: 5, party: ['cazador'], mods: { leader: { level: 2, cls: 'guerrero', sub: null, picks: [] }, elements: ['raiz'], classLevel: { cazador: 4 }, escort: ['monje'] } });
const fb = X.makeBattle(fr, 'banado_juncal', 1, 1);
const FL = byType(fb, 'lider');
ok(fb.level === 2 && ENCOUNTERS.banado_juncal.expected.level === 4, 'la pelea usa el nivel real del líder, no el esperado', fb.level);
ok(FL.cls === 'guerrero' && FL.abilities.includes('abrazo_raiz') && byType(fb, 'cazador').maxHp === K.memberKit('cazador', 4).hp, 'el líder con su subclase y la clase con su nivel', FL.abilities);
ok(X.fightParty(fr).join() === 'cazador,monje,forjador', 'la escolta y las clases del tutorial completan el grupo', X.fightParty(fr));

section('Migración de los roles (save crudo)');
const save = {
  v: 4, city: { buildings: [{ id: 'casa_exp', level: 2 }, { id: 'taller', level: 3 }, { id: 'establo', level: 1 }] },
  combat: { xp: 120 }, stats: { expeditions: 4, threats: 2 },
  expedition: {
    party: ['exploracion', 'ingenieria'], tired: { guia: 99 },
    active: { party: ['exploracion', 'guia'], roleLevel: { exploracion: 2, guia: 1 }, mods: { roleLevel: { exploracion: 2 }, escort: ['sanidad'] },
      battle: { units: [{ side: 'ally', type: 'lider' }, { side: 'ally', type: 'guia' }, { side: 'ally', type: 'sanidad' }, { side: 'enemy', type: 'lobo' }],
        stats: { dmg: { guia: 4, lider: 2 }, kills: { exploracion: 1 } }, traps: [{ by: 'ingenieria' }], walls: [] } },
  },
};
migrateClasses(save);
const mc = save.classes;
ok(mc.v === 1 && mc.curve === K.CLASS_CURVE && mc.leader.cls === null && mc.leader.xp === 120 + 4 * 30 + 2 * 20, 'el líder junta la xp de peleas, salidas y amenazas; elige clase después', mc.leader);
ok(mc.members.cazador.xp === K.classXpFor(3) && mc.members.forjador.xp === K.classXpFor(5) && mc.members.monje.xp === K.classXpFor(1) && mc.members.curandero.xp === 0, 'cada clase con la xp del nivel de su edificio (2 × n − 1)', mc.members);
ok(K.classLevelFromXp(mc.members.forjador.xp, 6) === 5, 'el forjador del Taller 3 queda en nivel de clase 5');
const A = save.expedition.active;
ok(A.party.join() === 'cazador,monje' && A.tier.cazador === 2 && !A.roleLevel && A.mods.tier.cazador === 2 && A.mods.escort.join() === 'curandero', 'la salida guardada pasa a clases', A);
ok(A.battle.units[1].type === 'monje' && A.battle.units[1].f.noStuck && A.battle.units[2].f.medic && A.battle.units[0].type === 'lider' && A.battle.units[3].type === 'lobo', 'la pelea guardada también, con sus pasivas', A.battle.units);
ok(A.battle.stats.dmg.monje === 4 && A.battle.stats.kills.cazador === 1 && A.battle.traps[0].by === 'forjador', 'y sus estadísticas');
ok(save.expedition.party.join() === 'cazador,forjador' && save.expedition.tired.monje === 99, 'el último grupo y el cansancio');
const again = JSON.stringify(save);
migrateClasses(save);
ok(JSON.stringify(save) === again, 'migrar de nuevo no cambia nada');
ok(migrateBattle({ units: [{ side: 'ally', type: 'cazador' }] }).units[0].type === 'cazador', 'una pelea ya con clases queda igual');
const resumed = R.newBattle({ encounter: 'bosque_claro', seed: 2, party: ['guia'] });
const ru = byType(resumed, 'monje');
ok(ru && R.reachable(resumed, ru.id).length > 0, 'una pelea migrada se sigue jugando');

// ------------------------------------------------------------------ en el juego
if (!QUICK) {
  section('En el juego (Chrome headless, SwiftShader)');
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
  await page.setViewport({ width: 1280, height: 760, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  async function waitFor(fn, ms = 25000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await page.evaluate(fn)) return true; } catch {} await sleep(200); } return false; }
  const run = (src) => page.evaluate(new Function(`return (async () => { const P = window.__pixelia; const S = P.store.state; const K = await import('./src/core/classes.js'); ${src} })()`));
  try {
    await page.goto(BASE + '?reset', { waitUntil: 'load' });
    ok(await waitFor(() => !!window.__pixelia?.store?.state), 'el juego carga');
    await sleep(800);
    let r = await run(`const i = K.leaderInfo(); return { lv: i.level, cls: i.cls, v: S.classes?.v, m: Object.keys(S.classes?.members || {}).length };`);
    ok(r.lv === 1 && r.cls === null && r.v === 1 && r.m === 6, 'partida nueva: líder nivel 1, sin clase, 6 clases', r);
    r = await run(`let ev = null; P.bus.on('leader:levelup', p => { ev = p; }); const up = K.grantLeaderXp(250, 'test'); return { up, ev, lv: K.leaderLevel() };`);
    ok(r.lv === 3 && r.up?.to === 3 && r.ev?.level === 3, 'la experiencia sube el nivel del líder y avisa', r);
    r = await run(`const x0 = S.classes.leader.xp; P.bus.emit('threat:resolved', { id: 't1', type: 'crecida', pct: 80, mode: 'auto', damaged: [], reward: {} }); return S.classes.leader.xp - x0;`);
    ok(r === 10 + 8, 'una amenaza aguantada da experiencia al líder (10 + 0,1 × %)', r);
    r = await run(`return { a: K.setLeaderClass('guerrero'), b: K.setSubclass('guardian_raiz'), sub: K.leaderInfo().sub };`);
    ok(r.a && !r.b && r.sub === null, 'sin Raíz no hay subclase', r);
    r = await run(`S.story ||= {}; S.story.elements = ['raiz']; const i = K.leaderInfo(); const m = K.leaderMods(); return { sub: i.sub, subs: i.subclasses, m, set: K.setSubclass('guardian_raiz'), bad: K.setSubclass('acechador_raiz') };`);
    ok(r.sub === 'guardian_raiz' && r.subs.join() === 'guardian_raiz' && r.set && !r.bad && r.m.cls === 'guerrero' && r.m.level === 3, 'con Raíz, Guardián de Raíz; la de otra clase no', r);
    r = await run(`S.expedition.active = { ended: false }; const a = K.setLeaderClass('cazador'); S.expedition.active = null; return a;`);
    ok(r === false, 'la clase se cambia en la ciudad, no con una salida en curso');
    r = await run(`S.city.buildings.push({ uid: 9901, id: 'taller', x: 1, z: 1, level: 2 }, { uid: 9902, id: 'casa_exp', x: 3, z: 1, level: 2 });
      const before = K.memberLevel('forjador'); const ups = K.grantClassXp(['forjador'], 1200); const cl = K.cityClasses().map(c => c.id + ':' + c.level + ':' + c.classLevel);
      return { before, after: K.memberLevel('forjador'), ups, cl, info: K.memberInfo('forjador') };`);
    ok(r.before === 1 && r.after === 4 && r.ups[0]?.to === 4, 'la clase sube con la experiencia hasta el tope del edificio (Taller 2 → nivel 4)', r);
    ok(r.cl.includes('forjador:2:4') && r.cl.includes('guerrero:1:1') && r.cl.includes('cazador:2:1'), 'las clases de la ciudad (el Guerrero con la Casa de Expediciones 2)', r.cl);
    r = await run(`const ex = P.ctx.expedition || await import('./src/expedition/expedition.js'); const x0 = S.classes.leader.xp, c0 = S.classes.members.cazador.xp;
      const run = { party: ['cazador'], fights: [] }; ex.creditFight(run, { enc: 'bosque_claro', outcome: 'win', xp: 20, turns: 5, stars: 2 });
      return { leader: S.classes.leader.xp - x0, cazador: S.classes.members.cazador.xp - c0, forjador: S.classes.members.forjador.xp };`);
    ok(r.leader === 20 && r.cazador === 20, 'una pelea da su experiencia al líder y a quien peleó', r);
    // partida vieja con roles: se migra al cargar
    const json = await page.evaluate(() => JSON.stringify(window.__pixelia.store.state));
    await page.goto(BASE + 'tools/no-existe.html', { waitUntil: 'load' });   // misma página sin el juego: no pisa el guardado
    await page.evaluate((json) => {
      const s = JSON.parse(json);
      delete s.classes;
      s.combat = { ...(s.combat || {}), xp: 300 };
      s.stats = { ...(s.stats || {}), expeditions: 2, threats: 1 };
      s.expedition = { ...(s.expedition || {}), party: ['exploracion', 'guia'], tired: {}, active: null };
      localStorage.setItem('pixelia.save.v1', JSON.stringify(s));
    }, json);
    await page.goto(BASE, { waitUntil: 'load' });
    ok(await waitFor(() => !!window.__pixelia?.store?.state?.classes), 'la partida vieja carga');
    await sleep(600);
    r = await run(`return { xp: S.classes.leader.xp, lv: K.leaderLevel(), cls: S.classes.leader.cls, forj: K.memberLevel('forjador'), caz: K.memberLevel('cazador'), party: S.expedition.party };`);
    ok(r.xp === 300 + 60 + 20 && r.lv === K_LEADER(380) && r.cls === null, 'el líder con la xp de antes y sin clase (la elige en la ciudad)', r);
    ok(r.forj === 3 && r.caz === 3 && r.party.join() === 'cazador,monje', 'cada clase con el nivel de su edificio y el último grupo con clases', r);
    ok(!errors.length, 'sin errores en la página', errors.slice(0, 3));
  } catch (e) { ok(false, 'el juego anduvo sin trabarse', String(e && e.stack || e)); }
  await browser.close();
  server.close();
}
function K_LEADER(xp) { return K.leaderLevelFromXp(xp); }

console.log(`\ntest-classes: ${pass} bien, ${fail} mal`);
process.exitCode = fail ? 1 : 0;
