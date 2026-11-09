// Arsenal, maestría, talentos, el Nivel y la Fuerza (La Travesía, paso 2a): pruebas de los módulos puros en Node, sin
// navegador. Cubre src/core/arsenal.js (armas, rasgos, equipar, desarmar, rehacer, maestría), src/core/talents.js
// (puntos, ramas, paragon), el Nivel de src/combat/classes.js (curva, nivel de combate, paragon), src/core/power.js
// (Fuerza, recomendada, escalado de enemigos) y lo que suma newBattle de src/combat/combat-rules.js (gear, power, itemPlus).
// No fija valores de balance (chances de rareza, de drop, fightRate…): prueba propiedades.
//   node tools/test-arsenal.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as A from '../src/core/arsenal.js';
import * as T from '../src/core/talents.js';
import * as W from '../src/core/power.js';
import * as K from '../src/combat/classes.js';
import * as R from '../src/combat/combat-rules.js';
import { ENCOUNTERS, ACT1, ENEMIES, ELEMENTS, ITEMS } from '../src/combat/combat-data.js';
import { MASTERY_STEPS } from '../src/core/data.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function ok(cond, msg, extra) {
  if (cond) { pass++; console.log('  ✔ ' + msg); } else { fail++; console.log('  ✘ ' + msg + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); }
}
function section(t) { console.log('\n' + t); }
const J = (x) => JSON.stringify(x);
function mulberry(seed) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const near = (a, b) => Math.abs(a - b) < 1e-9;
const sumMats = (m) => Object.values(m || {}).reduce((a, n) => a + n, 0);
/** Una partida mínima con el Nivel dado (la xp justa para llegar). */
const game = (nivel = 1, extra = {}) => ({ classes: { leader: { cls: null, sub: null, xp: K.leaderXpFor(nivel), picks: [] }, members: {} }, ...extra });
const plain = (w) => w.traits.filter(t => t.id !== 'afinidad');
const hasAff = (w) => w.traits.some(t => t.id === 'afinidad');

// ------------------------------------------------------------------ pureza
section('Módulos puros');
{
  const src = ['src/core/arsenal.js', 'src/core/talents.js', 'src/core/power.js'].map(f => readFileSync(join(ROOT, f), 'utf8')).join('\n');
  ok(!/\b(document|window|localStorage|requestAnimationFrame)\b/.test(src.replace(/\/\/.*$/gm, '')), 'arsenal, talentos y Fuerza sin DOM ni navegador');
  ok(!/from ['"]\.\/(state|bus|gear|classes)\.js|from ['"]three|Math\.random/.test(src), 'sin store, sin bus, sin three.js y sin Math.random');
}

// ------------------------------------------------------------------ armas
section('rollWeapon');
{
  const a = A.rollWeapon(mulberry(42), { source: 'pelea' }), b = A.rollWeapon(mulberry(42), { source: 'pelea' });
  ok(J(a) === J(b), 'misma semilla, misma arma', a);
  const many = (opts, n = 400, seed = 7) => { const r = mulberry(seed); return Array.from({ length: n }, () => A.rollWeapon(r, opts)); };
  const all = many({ source: 'pelea' }, 600);
  ok(all.every(w => A.WEAPON_TYPES[w.type] && w.rarity >= 0 && w.rarity < A.RARITIES.length && w.src === 'pelea'), 'tipo válido, rareza 0..4 y su origen');
  ok(new Set(all.map(w => w.type)).size === A.WEAPON_IDS.length, 'salen todos los tipos de arma', [...new Set(all.map(w => w.type))]);
  ok(many({ source: 'pelea', minRarity: 2 }).every(w => w.rarity >= 2), 'minRarity: nunca menos que rara');
  ok(many({ source: 'jefe', minRarity: 4 }).every(w => w.rarity === 4), 'minRarity 4: siempre reliquia');
  ok(many({ rarity: 9 }).every(w => w.rarity === A.RARITIES.length - 1) && many({ rarity: 1 }).every(w => w.rarity === 1), 'rareza fija (con tope en la más alta)');
  ok(many({ type: 'lanza' }).every(w => w.type === 'lanza'), 'tipo fijo');
  const byR = A.RARITIES.map((_, r) => many({ rarity: r }, 200, 11 + r));
  ok(byR.every((ws, r) => ws.every(w => plain(w).length === A.RARITIES[r].traits)), 'cada rareza trae su número de rasgos', A.RARITIES.map(x => x.traits));
  ok(byR.every(ws => ws.every(w => new Set(w.traits.map(t => t.id)).size === w.traits.length)), 'sin rasgos repetidos en una misma arma');
  ok(byR.every((ws, r) => ws.every(w => plain(w).every(t => A.TRAITS[t.id] && !A.TRAITS[t.id].rarityOnly && (A.TRAITS[t.id].minRarity || 0) <= r))), 'los rasgos respetan su rareza mínima');
  ok(byR[0].every(w => !hasAff(w)) && byR[1].every(w => !hasAff(w)), 'común y poco común: nunca afinidad');
  ok(A.RARITIES.every((x, r) => r >= 2 || x.affinity === 0), 'la afinidad es solo de rara para arriba (datos)');
  ok(byR.slice(2).some(ws => ws.some(hasAff)), 'de rara para arriba puede salir afinidad');
  ok(byR.every((ws, r) => A.RARITIES[r].affinity < 1 || ws.every(hasAff)), 'con chance 1, siempre la trae');
  ok(byR.flat().filter(hasAff).every(w => ELEMENTS[w.traits.find(t => t.id === 'afinidad').el]), 'la afinidad es de un elemento que existe');
  const isl = many({ rarity: 4, element: 'raiz' });
  ok(isl.every(w => w.traits.find(t => t.id === 'afinidad')?.el === 'raiz' || Object.keys(ELEMENTS).length > 1), 'la afinidad prefiere el elemento de la isla');
}

section('Arsenal: addWeapon, filtro y tope');
{
  const s = {};
  const r1 = A.addWeapon(s, { type: 'espada', rarity: 0, traits: [{ id: 'vida' }] });
  const r2 = A.addWeapon(s, { type: 'hacha', rarity: 1, traits: [{ id: 'botin' }] });
  ok(r1.weapon.uid > 0 && r2.weapon.uid === r1.weapon.uid + 1 && s.arsenal.items.length === 2 && !r1.scrapped && !r1.auto, 'cada arma con su uid, sin desarmar', [r1, r2]);
  ok(s.arsenal.items[0] === r1.weapon && s.arsenal.nextUid === r2.weapon.uid + 1, 'addWeapon devuelve el arma guardada y avanza nextUid');
  const src = { type: 'arco', rarity: 2, traits: [{ id: 'vigia' }] };
  A.addWeapon(s, src); s.arsenal.items.at(-1).traits[0].id = 'curas';
  ok(src.traits[0].id === 'vigia', 'guarda una copia: no toca el objeto que le pasaron');
  ok(A.setScrapFilter(s, 1) === 1 && A.setScrapFilter(s, 9) === 3 && A.setScrapFilter(s, -5) === -1, 'filtro de −1 a 3');
  A.setScrapFilter(s, 1);
  const n0 = s.arsenal.items.length;
  const f1 = A.addWeapon(s, { type: 'lanza', rarity: 1, traits: [] }), f2 = A.addWeapon(s, { type: 'lanza', rarity: 2, traits: [] });
  ok(f1.auto && sumMats(f1.scrapped) === A.RARITIES[1].scrap && !f2.auto && s.arsenal.items.length === n0 + 1, 'con el filtro, lo de rareza ≤ filtro se desarma solo y da sus materiales', { f1, len: s.arsenal.items.length });
  A.setScrapFilter(s, -1);

  // tope: lleno de armas, la que sobra se desarma (la de menos fuerza, nunca la equipada)
  const t = {};
  const r = mulberry(5);
  for (let i = 0; i < A.ARSENAL_CAP; i++) A.addWeapon(t, A.rollWeapon(r, { rarity: 1 + (i % 4) }));
  const weakest = [...t.arsenal.items].sort((x, y) => A.weaponPower(x) - A.weaponPower(y));
  A.equipWeapon(t, 'lider', weakest[0].uid);
  const second = weakest[1];
  const over = A.addWeapon(t, { type: 'escudo', rarity: 4, traits: [{ id: 'coraza' }, { id: 'vida2' }] });
  ok(t.arsenal.items.length === A.ARSENAL_CAP, `el arsenal no pasa de ${A.ARSENAL_CAP}`, t.arsenal.items.length);
  ok(A.isEquipped(t, weakest[0].uid) && !!A.weaponByUid(t, weakest[0].uid), 'la equipada (aunque sea la más floja) no se desarma');
  ok(!A.weaponByUid(t, second.uid) && sumMats(over.scrapped) === sumMats(A.scrapValue(second)) && !!A.weaponByUid(t, over.weapon.uid), 'se desarma la de menos fuerza que no está equipada', over.scrapped);
  ok(J(A.arsenalState(JSON.parse(J(t)))) === J(t.arsenal), 'arsenalState es idempotente');
}

section('Equipar');
{
  ok(A.WEAPON_IDS.every(type => A.canWield('lider', type)), 'el líder lleva cualquier tipo');
  ok(K.CLASS_IDS.every(c => A.WEAPON_IDS.every(type => A.canWield(c, type) === A.WEAPON_TYPES[type].classes.includes(c))), 'cada clase, solo sus tipos');
  ok(K.CLASS_IDS.every(c => A.canWield(c, A.CLASS_WEAPON[c])), 'cada clase puede llevar el arma de su kit');
  ok(K.CLASS_IDS.every(c => A.WEAPON_IDS.some(type => A.canWield(c, type))) && A.WIELDERS.length === 1 + K.CLASS_IDS.length, 'todos tienen algún arma');
  const s = {};
  const bow = A.addWeapon(s, { type: 'arco', rarity: 2, traits: [] }).weapon;
  const bad = A.equipWeapon(s, 'guerrero', bow.uid);
  ok(!bad.ok && bad.why === A.TXT.locked && !s.arsenal.equipped.guerrero, 'el guerrero no puede llevar un arco', bad);
  ok(!A.equipWeapon(s, 'nadie', bow.uid).ok && !A.equipWeapon(s, 'cazador', 999).ok, 'alguien que no existe o un arma que no está: no');
  const e1 = A.equipWeapon(s, 'cazador', bow.uid);
  ok(e1.ok && s.arsenal.equipped.cazador === bow.uid && A.equippedOn(s, 'cazador') === bow && A.wieldType(s, 'cazador') === 'arco', 'el cazador lo equipa');
  const e2 = A.equipWeapon(s, 'saqueador', bow.uid);
  ok(e2.ok && e2.from === 'cazador' && !s.arsenal.equipped.cazador && s.arsenal.equipped.saqueador === bow.uid, 'pasar el arma a otro la saca del primero', e2);
  const e3 = A.equipWeapon(s, 'lider', bow.uid);
  ok(e3.ok && e3.from === 'saqueador' && Object.keys(s.arsenal.equipped).join() === 'lider', 'y al líder también');
  ok(A.unequipWeapon(s, 'lider').ok && !A.unequipWeapon(s, 'lider').ok && !A.equippedOn(s, 'lider'), 'sacarla');
  ok(A.wieldType(s, 'lider', 'monje') === 'baston' && A.wieldType(s, 'lider', null) === null && A.wieldType(s, 'forjador') === 'martillo', 'sin arma: la de su clase (el líder sin clase, ninguna)');
}

section('Desarmar y rehacer rasgos');
{
  const s = {};
  const ws = A.RARITIES.map((_, r) => A.addWeapon(s, { type: 'hacha', rarity: r, traits: [] }).weapon);
  A.equipWeapon(s, 'lider', ws[4].uid);
  const no = A.scrapWeapon(s, ws[4].uid);
  ok(!no.ok && no.why === A.TXT.equipped && !!A.weaponByUid(s, ws[4].uid), 'lo equipado no se desarma');
  const vals = A.RARITIES.map((_, r) => sumMats(A.scrapValue({ rarity: r })));
  ok(vals.every((v, i) => i === 0 || v > vals[i - 1]) && vals.every((v, r) => v === A.RARITIES[r].scrap), 'los materiales crecen con la rareza', vals);
  const sc = A.scrapWeapon(s, ws[2].uid, 3);
  ok(sc.ok && sumMats(sc.mats) === A.RARITIES[2].scrap + 3 && !A.weaponByUid(s, ws[2].uid) && Object.keys(sc.mats).every(id => ['mineral', 'madera', 'piedra', 'hierbas'].includes(id)), 'desarmar: sale del arsenal y da materiales de región (+ bonus del talento)', sc.mats);
  ok(!A.scrapWeapon(s, ws[2].uid).ok, 'no se desarma dos veces');
  const c0 = A.rerollCost({ rarity: 0 }), c4 = A.rerollCost({ rarity: 4 }), cd = A.rerollCost({ rarity: 4 }, 0.3);
  ok(c4.coins > c0.coins && cd.coins < c4.coins && cd.coins > 0, 'rehacer cuesta más con la rareza y menos con el talento', { c0, c4, cd });

  const w = A.addWeapon(s, { type: 'espada', rarity: 2, traits: [{ id: 'vida' }, { id: 'vigia' }, { id: 'afinidad', el: 'raiz' }] }).weapon;
  const r = mulberry(9);
  let changed = 0, dup = 0;
  for (let i = 0; i < 40; i++) {
    const before = w.traits[0].id;
    const rr = A.rerollTrait(s, w.uid, 0, r);
    if (!rr.ok) dup = 99;
    if (w.traits[0].id !== before) changed++;
    if (new Set(w.traits.map(t => t.id)).size !== w.traits.length) dup++;
  }
  ok(changed === 40 && dup === 0, 'rehacer cambia el rasgo y nunca repite uno que ya tiene', { changed, dup, traits: w.traits });
  ok(w.traits.every(t => (A.TRAITS[t.id].minRarity || 0) <= w.rarity), 'el rasgo nuevo respeta la rareza');
  const ra = A.rerollTrait(s, w.uid, 2, r);
  const els = A.AFFINITY_ELEMENTS();
  ok(ra.ok && ra.trait.id === 'afinidad' && ELEMENTS[ra.trait.el] && (els.length < 2 || ra.trait.el !== 'raiz'), `la afinidad se rehace a otro elemento (${els.length} en el juego por ahora)`, ra.trait);
  ok(!A.rerollTrait(s, w.uid, 7, r).ok && !A.rerollTrait(s, 999, 0, r).ok, 'un rasgo o un arma que no existe: no');
}

section('Lo que da un arma');
{
  const st = A.RARITIES.map((_, r) => A.weaponStats({ type: 'espada', rarity: r, traits: [{ id: 'vida' }] }));
  const pw = A.RARITIES.map((_, r) => A.weaponPower({ type: 'espada', rarity: r, traits: [{ id: 'vida' }] }));
  ok(st.every((x, i) => i === 0 || x.hp + x.atk >= st[i - 1].hp + st[i - 1].atk), 'las estadísticas crecen con la rareza', st.map(x => [x.hp, x.atk]));
  ok(pw.every((p, i) => i === 0 || p > pw[i - 1]), 'la fuerza del arma crece con la rareza', pw);
  const avg = A.RARITIES.map((_, r) => { const g = mulberry(100 + r); let t = 0; for (let i = 0; i < 300; i++) t += A.weaponPower(A.rollWeapon(g, { rarity: r })); return t / 300; });
  ok(avg.every((p, i) => i === 0 || p > avg[i - 1]), 'en promedio, con rasgos al azar, también', avg.map(Math.round));
  const sh = A.weaponStats({ type: 'escudo', rarity: 4, traits: [] });
  ok(sh.atk === 0 && sh.armor >= 1, 'el escudo no pega: lo que sería ataque es coraza', sh);
  const full = A.weaponStats({ type: 'arco', rarity: 3, traits: [{ id: 'coraza' }, { id: 'curas' }, { id: 'temple' }, { id: 'hallazgo' }, { id: 'afinidad', el: 'raiz' }] });
  ok(full.armor === 1 && full.flags.healPlus === 1 && near(full.mastery, A.TRAITS.temple.mastery) && near(full.find, A.TRAITS.hallazgo.find) && J(full.affinity) === '["raiz"]', 'los rasgos suman coraza, pasivas, maestría, hallazgo y afinidad', full);
  ok(A.weaponPower(null) === 0 && A.weaponStats(null).hp === 0, 'sin arma, nada');
  const n = A.weaponName({ type: 'hacha', rarity: 2, traits: [{ id: 'afinidad', el: 'raiz' }] });
  ok(n.startsWith('Hacha') && /rara/.test(n) && /Raíz/.test(n), 'nombre: tipo, rareza y elemento', n);
  ok(/Martillo épico/.test(A.weaponName({ type: 'martillo', rarity: 3, traits: [] })) && A.weaponName(null) === A.TXT.noWeapon, 'el género del adjetivo y "Sin arma"');
}

// ------------------------------------------------------------------ maestría
section('Maestría');
{
  const C = A.MASTERY_CURVE;
  ok(C.length === A.MASTERY_MAX + 1 && C[1] === 0 && C.slice(2).every((v, i) => v > C[i + 1]), 'curva creciente del 1 al 20', C);
  ok(MASTERY_STEPS.every((v, i) => C[4 * (i + 1)] === Math.round(v * A.MASTERY_SCALE)), 'en el 4, 8, 12, 16 y 20 vale MASTERY_STEPS × MASTERY_SCALE', [4, 8, 12, 16, 20].map(l => C[l]));
  ok(A.masteryLevel(0) === 1 && A.masteryLevel(C[5] - 1) === 4 && A.masteryLevel(C[5]) === 5 && A.masteryLevel(1e12) === A.MASTERY_MAX, 'nivel de maestría según la xp, con tope 20');
  const inf = A.masteryXpInfo(C[6] + 3);
  ok(inf.level === 6 && inf.into === 3 && inf.need === C[7] - C[6] && !inf.max && A.masteryXpInfo(1e12).max, 'masteryXpInfo', inf);
  const at = (lv) => A.masteryPerks('espada', C[lv]);
  const p2 = A.masteryPerks('espada', C[3] - 1), p3 = at(3), p6 = at(6), p10 = at(10), p20 = at(20);
  ok(p2.techs.length === 0 && p3.techs.join() === 'guardia_alta' && p6.techs.length === 2 && p10.techs.length === 3, 'técnicas en el 3, el 6 y el 10', [p3.techs, p6.techs, p10.techs]);
  ok(p3.flags.guardAdj === 1 && p6.atk === 1 && p10.armor === 1, 'cada técnica da lo suyo (espada: guardia, +1 ataque, +1 coraza)');
  ok(p2.hp === 1 && p6.hp === 2 && p10.hp === 3, 'vida en el 2, el 5 y el 8', [p2.hp, p6.hp, p10.hp]);
  ok(A.masteryPerks('espada', C[3]).frame === null && at(4).frame === 'bronce' && at(8).frame === 'plata' && p10.frame === 'oro' && p20.frame === 'nombre', 'marcos (cosméticos) desde el 4');
  ok(A.WEAPON_IDS.every(t => A.WEAPON_TYPES[t].techs.length === 3 && A.masteryUnlock(t, 3).kind === 'tech' && A.masteryUnlock(t, 10).kind === 'tech' && A.masteryUnlock(t, 2).kind === 'hp'), 'cada tipo: 3 técnicas, y masteryUnlock dice qué abre');
  ok(A.masteryUnlock('nada', 3) === null && A.masteryUnlock('espada', 7) === null, 'un nivel sin nada: null');
  // objetos del Taller
  ok(A.masteryLevel(1e12, A.ITEM_MASTERY_MAX) === 10, 'los objetos del Taller topan en 10');
  ok(A.itemMasteryPlus(C[4] - 1) === 0 && A.itemMasteryPlus(C[4]) === 1 && A.itemMasteryPlus(C[8] - 1) === 1 && A.itemMasteryPlus(C[8]) === 2 && A.itemMasteryPlus(1e12) === 2, '+1 a su efecto en el 4 y otro en el 8');
  const s = {};
  const up = A.addMastery(s, 'espada', C[3]);
  ok(up && up.from === 1 && up.to === 3 && s.arsenal.mastery.espada === C[3], 'addMastery devuelve { from, to }', up);
  ok(A.addMastery(s, 'espada', 1) === null && A.addMastery(s, 'nada', 999) === null && A.addMastery(s, 'espada', 0) === null, 'sin subir, o un tipo que no existe: null');
  const iu = A.addMastery(s, 'botiquin', C[8], { item: true });
  ok(iu && iu.to === 8 && J(A.itemPlusOf(s)) === '{"botiquin":2}' && A.addMastery(s, 'espada', 10, { item: true }) === null, 'maestría de objeto: aparte de las armas, y itemPlusOf para newBattle', { iu, plus: A.itemPlusOf(s) });
  // gearMods: arma + maestría del tipo que usa + talentos
  const g = {};
  const w = A.addWeapon(g, { type: 'espada', rarity: 3, traits: [{ id: 'vida' }, { id: 'afinidad', el: 'raiz' }] }).weapon;
  A.equipWeapon(g, 'guerrero', w.uid);
  A.addMastery(g, 'espada', C[6]);
  const gm = A.gearMods(g, 'guerrero', { talents: { lider: { hp: 9 }, squad: { hp: 2, flags: {} } } });
  const ws = A.weaponStats(w), mp = A.masteryPerks('espada', C[6]);
  ok(gm.type === 'espada' && gm.uid === w.uid && gm.hp === ws.hp + mp.hp + 2 && gm.atk === ws.atk + mp.atk && J(gm.affinity) === '["raiz"]', 'gearMods suma arma, maestría y talentos del grupo', gm);
  const gl = A.gearMods(g, 'lider', { leaderCls: 'cazador', talents: { lider: { hp: 9 }, squad: { hp: 2 } } });
  ok(gl.type === 'arco' && gl.uid === null && gl.hp === 9 + A.masteryPerks('arco', 0).hp, 'el líder sin arma usa la de su clase y suma los talentos de líder', gl);
}

// ------------------------------------------------------------------ talentos
section('Talentos');
{
  ok(T.TREE_POINTS === T.TALENT_IDS.reduce((a, id) => a + T.TALENTS[id].max, 0) && T.TALENT_IDS.every(id => T.BRANCHES[T.TALENTS[id].branch]), 'el árbol: cada talento en una rama, TREE_POINTS = la suma de los topes');
  ok(T.BRANCH_IDS.every(b => T.TALENT_IDS.some(id => T.TALENTS[id].branch === b && T.TALENTS[id].need === 0)), 'cada rama tiene algo para arrancar');
  ok([1, 2, 10, 30].every(n => T.talentPoints(game(n)).total === n - 1) && T.talentPoints(game(1)).free === 0, 'puntos = Nivel − 1');
  const s = game(3);
  ok(T.learnTalent(s, 'mando_vida').ok && T.learnTalent(s, 'mando_vida').ok, 'con Nivel 3 se aprenden 2');
  const no = T.learnTalent(s, 'mando_vida');
  ok(!no.ok && no.why === T.TXT.noPoints && T.talentPoints(s).free === 0 && T.talentPoints(s).spent === 2, 'sin puntos, no', no);
  const t = game(12);
  T.learnTalent(t, 'mando_vida'); T.learnTalent(t, 'mando_vida'); T.learnTalent(t, 'mando_vida');
  const mx = T.learnTalent(t, 'mando_vida');
  ok(!mx.ok && mx.why === T.TXT.maxed && t.talents.ranks.mando_vida === T.TALENTS.mando_vida.max, 'cada talento tiene su tope', mx);
  ok(!T.canLearn(t, 'mando_voz').ok && T.TALENTS.mando_voz.need > 3, '`need`: Voz de mando pide puntos gastados en Mando', T.canLearn(t, 'mando_voz'));
  for (let i = 0; i < 4; i++) T.learnTalent(t, 'sup_cuero');
  ok(!T.canLearn(t, 'mando_voz').ok, 'los puntos de otra rama no cuentan');
  while (T.talentPoints(t).byBranch.mando < T.TALENTS.mando_voz.need) T.learnTalent(t, 'mando_maestria');
  ok(T.canLearn(t, 'mando_voz').ok && T.learnTalent(t, 'mando_voz').ok, 'con los puntos de la rama, se abre', T.talentPoints(t).byBranch);
  ok(!T.learnParagon(t, 'mando').ok, 'sin paragon antes del árbol lleno');
  // paragon: lo que pasa del árbol y lo de pasado el 50
  const over = (k) => T.talentPoints(game(1, { classes: { leader: { xp: K.leaderXpFor(50) + k * K.NIVEL.paragonStep } } }));
  const p50 = over(0);
  ok(p50.total === T.TREE_POINTS && p50.paragon.total === 49 - T.TREE_POINTS, `Nivel 50: el árbol lleno (${T.TREE_POINTS}) y lo que sobra al paragon`, p50);
  ok(over(3).paragon.total === 49 - T.TREE_POINTS + 3 && over(3).total === T.TREE_POINTS, 'cada NIVEL.paragonStep de xp pasado el 50: un punto de paragon más', over(3).paragon);
  const g = game(1, { classes: { leader: { xp: K.leaderXpFor(50) + 2 * K.NIVEL.paragonStep } } });
  const pts = T.talentPoints(g).paragon.total;
  let got = 0; while (T.learnParagon(g, 'oficio').ok) got++;
  ok(got === pts && T.talentPoints(g).paragon.free === 0 && !T.learnParagon(g, 'nada').ok, 'el paragon se gasta punto a punto en una rama', { got, pts });
  // talentMods
  const m = game(30);
  for (const [id, n] of [['mando_vida', 3], ['sup_cuero', 2], ['mando_maestria', 1], ['sup_animo', 2], ['of_desarme', 2], ['of_hallazgo', 1]]) for (let i = 0; i < n; i++) T.learnTalent(m, id);
  m.talents.paragon = { mando: 2, supervivencia: 10, oficio: 1000 };
  const tm = T.talentMods(m);
  ok(tm.lider.hp === 3 + 2 + 2 && near(tm.mastery, 0.1 + 2 * T.BRANCHES.mando.paragon.mastery) && tm.morale === 2 && tm.scrap === 2, 'talentMods suma vida de líder, maestría, ánimo y desarme (con el paragon)', tm);
  ok(near(tm.find, T.TALENTS.of_hallazgo.find + T.BRANCHES.oficio.paragon.findMax), 'el paragon de Oficio tiene tope', tm.find);
  ok(T.talentMods(game(5)).lider.hp === 0 && T.talentMods(game(5)).mastery === 0, 'sin talentos, nada');
  ok(T.resetTalents(m).ok && T.talentPoints(m).spent === 0 && T.talentPoints(m).paragon.spent === 0, 'resetTalents devuelve todo');
}

// ------------------------------------------------------------------ el Nivel
section('El Nivel');
{
  let curve = true;
  for (let n = 1; n < K.NIVEL.max; n++) {
    if (K.leaderXpFor(n + 1) - K.leaderXpFor(n) !== K.NIVEL.need(n) || K.leaderLevelFromXp(K.leaderXpFor(n + 1)) !== n + 1 || K.leaderLevelFromXp(K.leaderXpFor(n + 1) - 1) !== n) curve = false;
  }
  ok(curve && K.leaderXpFor(1) === 0, 'leaderXpFor y leaderLevelFromXp siguen NIVEL.need');
  ok(K.NIVEL.max === 50 && K.leaderLevelFromXp(1e12) === 50 && K.leaderXpFor(99) === K.leaderXpFor(50), 'tope 50');
  ok(K.combatLevel(1) === 1 && K.combatLevel(18) === 5 && K.combatLevel(50) === 14, 'nivel de combate: 1 → 1, 18 → 5, 50 → 14', [1, 18, 50].map(K.combatLevel));
  let mono = true; for (let n = 2; n <= 50; n++) if (K.combatLevel(n) < K.combatLevel(n - 1)) mono = false;
  ok(mono, 'el nivel de combate nunca baja al subir el Nivel');
  let inv = true;
  for (let c = 1; c <= K.combatLevel(50); c++) { const n = K.nivelFor(c); if (K.combatLevel(n) < c || (n > 1 && K.combatLevel(n - 1) >= c)) inv = false; }
  ok(inv, 'nivelFor: el Nivel más bajo con ese nivel de combate');
  const top = K.leaderXpFor(50);
  ok(K.paragonPoints(top - 1) === 0 && K.paragonPoints(top) === 0 && K.paragonPoints(top + K.NIVEL.paragonStep - 1) === 0 && K.paragonPoints(top + K.NIVEL.paragonStep) === 1 && K.paragonPoints(top + 2.5 * K.NIVEL.paragonStep) === 2, 'paragon: uno cada paragonStep pasado el 50');
  const i50 = K.leaderXpInfo(top + K.NIVEL.paragonStep + 7);
  ok(i50.max && i50.paragon === 1 && i50.paragonInto === 7 && i50.combat === K.combatLevel(50), 'leaderXpInfo en el tope', i50);
}

// ------------------------------------------------------------------ la Fuerza
section('Fuerza');
{
  const squad = ['guerrero', 'cazador', 'curandero'];
  const lv = [1, 10, 25, 50].map(n => W.powerOf(game(n), squad).total);
  ok(lv.every((p, i) => i === 0 || p > lv[i - 1]), 'crece con el Nivel', lv);
  const base = game(10);
  const p0 = W.powerOf(base, squad);
  ok(p0.members.length === 3 && p0.nivel === 10 && p0.total > p0.leader, 'suma líder, escuadra y Nivel', p0);
  const armed = game(10);
  const w = A.addWeapon(armed, { type: 'espada', rarity: 3, traits: [{ id: 'vida' }] }).weapon;
  A.equipWeapon(armed, 'lider', w.uid);
  ok(W.powerOf(armed, squad).total > p0.total, 'crece con un arma equipada', W.powerOf(armed, squad).total);
  const m2 = game(10); A.equipWeapon(m2, 'guerrero', A.addWeapon(m2, { type: 'espada', rarity: 2, traits: [] }).weapon.uid);
  ok(W.powerOf(m2, squad).total > p0.total, 'y con un arma en un integrante');
  const tal = game(10); T.learnTalent(tal, 'mando_vida'); T.learnTalent(tal, 'sup_cuero');
  ok(W.powerOf(tal, squad).total > p0.total, 'crece con talentos', W.powerOf(tal, squad).total);
  ok(W.powerOf(base, squad, { tools: { catalejo: 2 } }).total > p0.total && W.powerOf(base, ['guerrero']).total < p0.total, 'y con herramientas y escuadra');
  const rec = ACT1.map(id => W.recPower(id));
  ok(rec.every(p => p > 0) && rec.every((p, i) => i === 0 || p >= rec[i - 1]) && rec.at(-1) > rec[0], 'la recomendada de cada encuentro crece con el acto', Object.fromEntries(ACT1.map((id, i) => [id, rec[i]])));
  ok(W.recPower('bosque_claro') === W.recPower('bosque_claro'), 'la recomendada no cambia entre llamadas');
  const r = 500;
  const same = [0, 300, 500].map(p => W.foeScale(p, r));
  ok(same.every(f => f.hp === 1 && f.atk === 0), 'con la Fuerza ≤ recomendada, los enemigos no cambian', same);
  const up = W.foeScale(700, r);
  ok(near(up.hp, 1 + W.FOE_FOLLOW * 200 / r) && up.target === r + W.FOE_FOLLOW * 200, 'arriba, se suma la parte que sobra (FOE_FOLLOW)', up);
  ok(W.FOE_FOLLOW === 0.5, 'la mitad de lo que sobra');
  ok(W.foeScale(1e6, r).hp === W.FOE_MAX && W.foeScale(600, r, 100).hp > W.foeScale(600, r).hp, 'con tope, y el extra (la Marea) suma');
  ok([400, 600, 900, 1300, 3000].map(p => W.foeScale(p, r)).every((f, i, a) => i === 0 || (f.hp >= a[i - 1].hp && f.atk >= a[i - 1].atk)), 'más Fuerza, enemigos iguales o más duros');
}

// ------------------------------------------------------------------ combate
section('newBattle con gear, power e itemPlus');
{
  const party = ['guerrero', 'cazador', 'curandero'];
  const enemies = (b) => b.units.filter(u => u.side === 'enemy');
  const lider = (b) => b.units.find(u => u.type === 'lider');
  const b0 = R.newBattle({ encounter: 'bosque_claro', seed: 3, party, element: 'raiz' });
  const g = { lider: { hp: 2, atk: 1, armor: 1, flags: { healPlus: 1, intentPlus: 1 }, affinity: ['raiz'], type: 'espada' }, cazador: { hp: 3, atk: 0, armor: 0, flags: {} } };
  const b1 = R.newBattle({ encounter: 'bosque_claro', seed: 3, party, element: 'raiz', gear: g });
  const L0 = lider(b0), L1 = lider(b1);
  ok(L1.maxHp === L0.maxHp + 2 && L1.hp === L0.hp + 2 && L1.atk === L0.atk + 1 && L1.armor === L0.armor + 1, 'gear suma vida, ataque y coraza al líder', { L0: [L0.maxHp, L0.atk, L0.armor], L1: [L1.maxHp, L1.atk, L1.armor] });
  ok((L1.f.healPlus || 0) === (L0.f.healPlus || 0) + 1 && b1.intentPlus === b0.intentPlus + 1 && L1.weapon === 'espada' && J(L1.aff) === '["raiz"]', 'y sus pasivas (flags), el arma y la afinidad', { f: L1.f, intentPlus: [b0.intentPlus, b1.intentPlus] });
  const C0 = b0.units.find(u => u.type === 'cazador'), C1 = b1.units.find(u => u.type === 'cazador');
  ok(C1.maxHp === C0.maxHp + 3 && b1.units.find(u => u.type === 'guerrero').maxHp === b0.units.find(u => u.type === 'guerrero').maxHp, 'a cada integrante, lo suyo');
  ok(enemies(b1).every((e, i) => e.maxHp === enemies(b0)[i].maxHp), 'gear no toca a los enemigos');

  // afinidad: +1 de daño con una habilidad de su elemento, y nada con las otras
  const hit = (gear, ability) => {
    const b = R.newBattle({ encounter: 'bosque_claro', seed: 3, party, element: 'raiz', gear });
    b.tiles = b.tiles.map(t => (t === 'arbol' || t === 'roca' || t === 'alto' ? 'llano' : t));
    const L = lider(b), e = enemies(b)[0];
    for (const u of b.units) if (u !== L && u !== e) { u.x = -9; u.y = -9; }
    L.x = 3; L.y = 5; e.x = 3; e.y = 4; e.marked = 0;
    const h0 = e.hp;
    const r = R.act(b, L.id, ability, e.x, e.y);
    return { ok: r.ok, dmg: h0 - e.hp, why: r.why };
  };
  const affG = { lider: { hp: 0, atk: 0, armor: 0, flags: {}, affinity: ['raiz'] } };
  const e0 = hit(null, 'enredar'), e1 = hit(affG, 'enredar'), g0 = hit(null, 'golpe'), g1 = hit(affG, 'golpe');
  ok(e0.ok && e1.ok && e1.dmg === e0.dmg + 1, 'afinidad de Raíz: Enredar hace 1 más', { e0, e1 });
  ok(g0.ok && g1.ok && g1.dmg === g0.dmg, 'y Golpe (sin elemento) igual', { g0, g1 });

  // la Fuerza: por encima de la recomendada, los enemigos aguantan más (también los refuerzos)
  const rec = W.recPower('bosque_claro');
  const bp = R.newBattle({ encounter: 'bosque_claro', seed: 3, party, power: rec * 2 });
  const be = R.newBattle({ encounter: 'bosque_claro', seed: 3, party, power: rec });
  ok(bp.rec === rec && bp.power === rec * 2 && bp.foe.hp > 1, 'newBattle anota la Fuerza, la recomendada y el escalado', { rec: bp.rec, foe: bp.foe });
  ok(enemies(bp).every((e, i) => e.maxHp > enemies(b0)[i].maxHp && e.hp === e.maxHp), 'con más Fuerza que la recomendada, los enemigos tienen más vida', enemies(bp).map(e => e.maxHp));
  ok(enemies(be).every((e, i) => e.maxHp === enemies(b0)[i].maxHp && e.atk === enemies(b0)[i].atk), 'con la recomendada justa, igual que sin Fuerza');
  ok(b0.power === null && b0.foe === null && enemies(b0).every(e => e.maxHp === ENEMIES[e.type].hp * (ENCOUNTERS.bosque_claro.foeHp || 1)), 'sin power no escala nada');
  const wave = (b) => {
    for (const u of b.units) if (u.side === 'ally') { u.hp = u.maxHp = 999; }
    const ids = new Set(b.units.map(u => u.id));
    for (let k = 0; k < 8 && !b.ended; k++) { R.endTurn(b); R.enemyTurn(b); const nu = b.units.find(u => u.side === 'enemy' && !ids.has(u.id)); if (nu) return nu; }
    return null;
  };
  const w0 = wave(R.newBattle({ encounter: 'bosque_claro', seed: 3, party })), wp = wave(R.newBattle({ encounter: 'bosque_claro', seed: 3, party, power: rec * 2 }));
  ok(w0 && wp && w0.type === wp.type && wp.maxHp > w0.maxHp && w0.maxHp === ENEMIES[w0.type].hp, 'los refuerzos también salen escalados', { w0: w0 && [w0.type, w0.maxHp], wp: wp && [wp.type, wp.maxHp] });

  // maestría de objetos: el Botiquín cura más
  const heal = (itemPlus) => {
    const b = R.newBattle({ encounter: 'bosque_claro', seed: 3, party, equip: ['botiquin'], itemPlus });
    const L = lider(b);
    L.hp = 1;
    const r = R.act(b, L.id, 'item:botiquin', L.x, L.y);
    return { ok: r.ok, healed: L.hp - 1, why: r.why };
  };
  const h0 = heal(null), h2 = heal({ botiquin: 2 });
  ok(h0.ok && h0.healed === ITEMS.botiquin.heal && h2.ok && h2.healed === ITEMS.botiquin.heal + 2, 'itemPlus.botiquin: el Botiquín cura +n', { h0, h2 });
  ok(heal({ farol: 2 }).healed === ITEMS.botiquin.heal, 'el +n de otro objeto no lo toca');
}

console.log(`\n${fail ? '✘' : '✔'} ${pass} bien, ${fail} mal`);
process.exitCode = fail ? 1 : 0;
