// Arsenal, talentos y Fuerza en la partida (La Travesía, paso 2a): el pegamento entre las reglas puras (arsenal.js,
// talents.js, power.js) y el store. Cobra, da lo desarmado, guarda y avisa.
// Eventos: 'arsenal:changed' · 'arsenal:drop' { weapon, auto, scrapped } · 'mastery:up' { kind: 'arma'|'objeto', id,
// level } · 'talents:changed'.
import { bus } from './bus.js';
import { store } from './state.js';
import * as A from './arsenal.js';
import * as T from './talents.js';
import { powerOf } from './power.js';
import { classesState, classCap } from './classes.js';
import { CLASS_IDS, toClass } from '../combat/classes.js';
import { ENCOUNTERS } from '../combat/combat-data.js';

const S = () => store.state;
/** Veta de cada región (el 2c la pone en el mapa): la afinidad que más sale en sus armas. */
export const REGION_ELEMENT = { bosque: 'raiz', banado: 'marea', cerro: 'brasa', sierras: 'cefiro', costa: 'marea' };
let rng = Math.random;
/** Para las pruebas: un azar fijo. */
export function setGearRng(fn) { rng = typeof fn === 'function' ? fn : Math.random; }
const changed = () => { store.markDirty(); bus.emit('arsenal:changed', {}); };

/** Lo que la expedición pasa al combate: { gear: {lider, cls…}, power, itemPlus, moraleBonus }. */
export function fightMods(party = [], state = S(), { tools = {} } = {}) {
  const L = classesState(state).leader;
  const tal = T.talentMods(state);
  const gear = { lider: A.gearMods(state, 'lider', { leaderCls: L.cls, talents: tal }) };
  for (const cls of CLASS_IDS) gear[cls] = A.gearMods(state, cls, { talents: tal });
  return { gear, power: currentPower(party, state, { tools }).total, itemPlus: A.itemPlusOf(state), moraleBonus: tal.morale };
}
/** Fuerza de la partida con esa escuadra (los topes de clase de los edificios y las herramientas de la gente). */
export function currentPower(party = [], state = S(), { tools = {} } = {}) {
  const caps = Object.fromEntries(CLASS_IDS.map(c => [c, classCap(c, state)]));
  return powerOf(state, party, { caps, tools });
}

/**
 * Después de una pelea: maestría del tipo de arma de cada uno que peleó (la resolución rápida da la mitad), maestría
 * de los objetos del Taller usados y, si se ganó, quizás un arma (siempre con un jefe). Devuelve { ups, drop }.
 */
export function creditFightGear(run, fight, party = [], state = S()) {
  if (!fight || fight.gearCredited) return null;
  fight.gearCredited = true;
  const a = A.arsenalState(state);
  const tal = T.talentMods(state);
  const L = classesState(state).leader;
  const ups = [];
  const xp = (fight.xp || 0) * (fight.quick ? 0.5 : 1);
  for (const who of ['lider', ...party.map(toClass)]) {
    const type = run?.mods?.gear?.[who]?.type ?? A.wieldType(state, who, L.cls);
    if (!type || !xp) continue;
    const mult = 1 + tal.mastery + A.weaponStats(A.equippedOn(state, who)).mastery;
    const up = A.addMastery(state, type, xp * mult);
    if (up) { ups.push({ kind: 'arma', id: type, level: up.to }); bus.emit('mastery:up', { kind: 'arma', id: type, level: up.to, from: up.from }); }
  }
  for (const id of fight.items || []) {
    const up = A.addMastery(state, id, A.ITEM_USE_XP * (1 + tal.itemMastery), { item: true });
    if (up) { ups.push({ kind: 'objeto', id, level: up.to }); bus.emit('mastery:up', { kind: 'objeto', id, level: up.to, from: up.from }); }
  }
  let drop = null;
  if (fight.outcome === 'win') {
    const boss = ENCOUNTERS[fight.enc]?.kind === 'jefe';
    const find = Object.keys(a.equipped).reduce((s, who) => s + A.weaponStats(A.equippedOn(state, who)).find, 0);
    const chance = boss ? A.DROP_CHANCE.jefe : Math.min(0.9, A.DROP_CHANCE.pelea + tal.find + find);
    a.luck++;
    if (rng() < chance) drop = dropWeapon({ source: boss ? 'jefe' : 'pelea', minRarity: boss ? tal.bossRarity : 0, element: REGION_ELEMENT[run?.region] || null }, state);
  }
  changed();
  return { ups, drop };
}
/** Suma un arma nueva (de una pelea, un cofre o un premio). Respeta el filtro de desarme y el contador de suerte. */
export function dropWeapon(opts = {}, state = S()) {
  const a = A.arsenalState(state);
  const tal = T.talentMods(state);
  let minRarity = opts.minRarity || 0;
  if (a.luck >= A.LUCK.after) minRarity = Math.max(minRarity, A.LUCK.min);
  const w = A.rollWeapon(rng, { ...opts, minRarity });
  w.at = Date.now();
  if (w.rarity >= A.LUCK.min) a.luck = 0;
  const res = A.addWeapon(state, w, { scrapBonus: tal.scrap });
  if (res.scrapped) store.grant({ mats: res.scrapped }, 'desarme');
  store.inc('weaponsFound');
  bus.emit('arsenal:drop', { weapon: res.weapon, auto: res.auto, scrapped: res.scrapped });
  changed();
  return res.weapon;
}

// ---------- lo que se ve en el modelo ----------
/**
 * La pieza de GEAR (src/avatar/figure.js) del arma equipada de alguien ('lider' o una clase), o null si no tiene una
 * equipada (entonces lleva la de su clase, classLook). Con mods (run.mods.gear[who] de una salida), la de esa salida.
 */
export function heldGear(who, state = S(), mods = null) {
  if (mods) return mods.uid && A.WEAPON_TYPES[mods.type] ? A.WEAPON_TYPES[mods.type].gear : null;
  const w = A.equippedOn(state, who);
  return w ? A.WEAPON_TYPES[w.type]?.gear || null : null;
}

// ---------- acciones del jugador ----------
export function equip(who, uid, state = S()) { const r = A.equipWeapon(state, who, uid); if (r.ok) changed(); return r; }
export function unequip(who, state = S()) { const r = A.unequipWeapon(state, who); if (r.ok) changed(); return r; }
export function scrap(uid, state = S()) {
  const r = A.scrapWeapon(state, uid, T.talentMods(state).scrap);
  if (r.ok) { store.grant({ mats: r.mats }, 'desarme'); store.inc('weaponsScrapped'); changed(); }
  return r;
}
export const rerollCostOf = (uid, state = S()) => A.rerollCost(A.weaponByUid(state, uid), T.talentMods(state).reroll);
export function reroll(uid, idx, state = S()) {
  const w = A.weaponByUid(state, uid);
  if (!w || !w.traits[idx]) return { ok: false, why: A.TXT.noTrait };
  const cost = rerollCostOf(uid, state);
  if (!store.spend(cost, 'rehacer')) return { ok: false, why: 'No alcanza', cost };
  const r = A.rerollTrait(state, uid, idx, rng);
  store.inc('traitsRerolled');
  changed();
  return { ...r, cost };
}
export function setFilter(rarity, state = S()) { const f = A.setScrapFilter(state, rarity); changed(); return f; }

export function learn(id, state = S()) {
  const r = T.learnTalent(state, id);
  if (r.ok) { store.markDirty(); bus.emit('talents:changed', { id }); }
  return r;
}
export function learnParagon(branch, state = S()) {
  const r = T.learnParagon(state, branch);
  if (r.ok) { store.markDirty(); bus.emit('talents:changed', { branch }); }
  return r;
}
export function resetTalents(state = S()) { T.resetTalents(state); store.markDirty(); bus.emit('talents:changed', {}); return { ok: true }; }

let inited = false;
/** Completa el estado (arsenal y talentos). Idempotente. */
export function initGear() {
  A.arsenalState(S()); T.talentsState(S());
  if (inited) return;
  inited = true;
}
