// Clases de la partida (El Quiebre, paso 5b; DESIGN-COMBAT.md §14): quién hay en la ciudad, su nivel de clase, la
// clase y la subclase del líder y su nivel (L5). Las reglas puras (curvas, kits, subclases) están en
// src/combat/classes.js; esto solo guarda y avisa. Todavía sin interfaz: la elige la segunda parte del 5b.
//
// state.classes = {
//   v: 1,
//   leader: { cls, sub, xp, picks },     // cls null: todavía no eligió (partida vieja o nueva antes del onboarding nuevo)
//   members: { [clase]: { xp, picks } }, // una persona por clase, como antes un rol por edificio
//   curve: 2,                            // versión de CLASS_XP (la 1 se pasa sola con remapClassXp)
// }
//
// Eventos: 'class:levelup' { cls, level } · 'leader:levelup' { level, from } · 'leader:changed' { cls, sub }
import { store } from './state.js';
import { bus } from './bus.js';
import * as E from './economy.js';
import {
  CLASSES, CLASS_IDS, CLASS_GAIN, CLASS_CURVE, remapClassXp, LEADER, classLevelFromXp, classXpInfo, leaderLevelFromXp, leaderXpInfo, leaderPerks,
  availableSubclasses, resolveSubclass, unlockedPool, validPicks, classPassives, SUBCLASSES,
} from '../combat/classes.js';

const S = () => store.state;

/** Edificio que trae a cada clase a la ciudad (el nivel del edificio es el nivel de oficio en la expedición). */
export const CLASS_BUILDING = { cazador: 'casa_exp', forjador: 'taller', monje: 'establo', curandero: 'dispensario', saqueador: 'huerta', guerrero: 'casa_exp' };
/** Nivel del edificio desde el que llega la clase (el Guerrero, con la Casa de Expediciones 2). */
export const CLASS_BUILDING_MIN = { guerrero: 2 };
/** Orden para armar el grupo por defecto (el Guerrero al final: no cambia los grupos de antes). */
export const CLASS_PRIORITY = ['cazador', 'forjador', 'monje', 'curandero', 'saqueador', 'guerrero'];

/** Completa state.classes (idempotente). */
export function classesState(state = S()) {
  if (!state.classes || typeof state.classes !== 'object') state.classes = {};
  const c = state.classes;
  c.v = 1;
  if (!c.leader || typeof c.leader !== 'object') c.leader = {};
  const L = c.leader;
  if (!CLASSES[L.cls]) L.cls = null;
  if (!SUBCLASSES[L.sub]) L.sub = null;
  L.xp = Math.max(0, Number(L.xp) || 0);
  if (!Array.isArray(L.picks)) L.picks = [];
  if (!c.members || typeof c.members !== 'object') c.members = {};
  // la curva de clase cambió en el paso 5b, cuarta parte: lo juntado con la vieja se pasa sin bajar de nivel
  const remap = c.curve !== CLASS_CURVE;
  for (const id of CLASS_IDS) {
    const m = c.members[id];
    if (!m || typeof m !== 'object') c.members[id] = { xp: 0, picks: [] };
    else { m.xp = Math.max(0, Number(m.xp) || 0); if (remap) m.xp = remapClassXp(m.xp); if (!Array.isArray(m.picks)) m.picks = []; }
  }
  c.curve = CLASS_CURVE;
  return c;
}

// ---------- integrantes ----------
/** Nivel de oficio de una clase en la ciudad (1..5, el del edificio; 0 si no está). Es lo que usa la expedición. */
export function classTier(cls, state = S(), now = Date.now()) {
  const b = CLASS_BUILDING[cls];
  if (!b) return 0;
  const lv = E.cycleLevel(b, state, now) - ((CLASS_BUILDING_MIN[cls] || 1) - 1);
  return Math.max(0, Math.min(5, lv));
}
/** Tope del nivel de clase: el edificio entrena hasta 2 × su nivel (con el edificio al 5, el nivel 10). */
export const classCap = (cls, state = S(), now = Date.now()) => 2 * classTier(cls, state, now);
/** Nivel de clase (1..10; 0 si la clase no está en la ciudad). */
export function memberLevel(cls, state = S(), now = Date.now()) {
  const cap = classCap(cls, state, now);
  return cap ? classLevelFromXp(classesState(state).members[cls]?.xp || 0, cap) : 0;
}
/** Todo lo de un integrante: { cls, name, tier, level, cap, xp: {…}, picks, pool, passives }. */
export function memberInfo(cls, state = S(), now = Date.now()) {
  const C = CLASSES[cls];
  if (!C) return null;
  const m = classesState(state).members[cls];
  const tier = classTier(cls, state, now), cap = 2 * tier;
  const level = tier ? classLevelFromXp(m.xp, cap) : 0;
  return {
    cls, name: C.name, tier, level, cap, xp: classXpInfo(m.xp, Math.max(1, cap)), picks: validPicks(cls, Math.max(1, level), m.picks),
    pool: C.pool.map(id => ({ id, open: unlockedPool(cls, Math.max(1, level)).includes(id) })), passives: classPassives(cls, Math.max(1, level)).map(p => p.id),
  };
}
/** Clases que hay en la ciudad: [{ id, level (oficio, 1..5), classLevel (1..10) }]. */
export function cityClasses(state = S(), now = Date.now()) {
  return CLASS_IDS.map(id => ({ id, level: classTier(id, state, now), classLevel: memberLevel(id, state, now) })).filter(r => r.level > 0);
}
/** Suma experiencia de clase. Devuelve [{ cls, from, to }] de quienes subieron. */
export function grantClassXp(list = [], xp = 0, state = S()) {
  const c = classesState(state), ups = [];
  const n = Math.max(0, Math.round(xp));
  if (!n) return ups;
  for (const cls of new Set(list)) {
    if (!c.members[cls]) continue;
    const before = memberLevel(cls, state);
    c.members[cls].xp += n;
    const after = memberLevel(cls, state);
    if (after > before && before > 0) { ups.push({ cls, from: before, to: after }); bus.emit('class:levelup', { cls, level: after, from: before }); }
  }
  store.markDirty();
  return ups;
}
/** Elige las 2 activas de un integrante (las que no estén abiertas se ignoran). */
export function setPicks(cls, picks = [], state = S()) {
  const c = classesState(state);
  if (!c.members[cls]) return false;
  c.members[cls].picks = validPicks(cls, Math.max(1, memberLevel(cls, state)), picks);
  store.markDirty();
  return true;
}

// ---------- líder ----------
export const leaderLevel = (state = S()) => leaderLevelFromXp(classesState(state).leader.xp);
const elementsOf = (state) => (Array.isArray(state.story?.elements) ? state.story.elements.slice() : []);
/** { level, xp: {…}, perks, cls, sub, subclasses, picks, next } — la pestaña "Progreso" de la segunda parte lo muestra. */
export function leaderInfo(state = S()) {
  const L = classesState(state).leader;
  const info = leaderXpInfo(L.xp);
  const els = elementsOf(state);
  const sub = L.cls ? resolveSubclass(L.cls, L.sub, els) : null;
  const perks = leaderPerks(info.level);
  return {
    level: info.level, xp: info, perks, cls: L.cls, sub: sub?.id || null, next: info.next,
    subclasses: L.cls ? availableSubclasses(L.cls, els).map(s => s.id) : [],
    picks: L.cls ? validPicks(L.cls, perks.classLevel, L.picks, perks.classSlots) : [],
  };
}
/** Lo que la expedición y el combate necesitan del líder: { level, cls, sub, picks }. */
export function leaderMods(state = S()) {
  const i = leaderInfo(state);
  return { level: i.level, cls: i.cls, sub: i.sub, picks: i.picks.slice() };
}
/** Suma experiencia al líder. Devuelve { from, to } o null si no subió. */
export function grantLeaderXp(xp = 0, source = '', state = S()) {
  const L = classesState(state).leader;
  const n = Math.max(0, Math.round(xp));
  if (!n) return null;
  const from = leaderLevelFromXp(L.xp);
  L.xp += n;
  const to = leaderLevelFromXp(L.xp);
  store.markDirty();
  if (to > from) { bus.emit('leader:levelup', { level: to, from, source }); return { from, to }; }
  return null;
}
/** Experiencia del líder por una amenaza aguantada (pct 0..100). */
export const threatXp = (pct = 0) => Math.round(LEADER.gain.threat.base + LEADER.gain.threat.perPct * Math.max(0, Math.min(100, pct)));
/** Se cambia en la ciudad: no con una salida en curso. */
const inCity = (state) => !(state.expedition?.active && !state.expedition.active.ended);
/** Elige la clase del líder (la elección de la segunda parte del 5b: onboarding o la primera vez en la ciudad). */
export function setLeaderClass(cls, state = S()) {
  if (!CLASSES[cls] || !inCity(state)) return false;
  const L = classesState(state).leader;
  if (L.cls !== cls) { L.cls = cls; L.sub = null; L.picks = []; }
  store.markDirty();
  bus.emit('leader:changed', { cls, sub: leaderInfo(state).sub });
  return true;
}
/** Cambia la subclase (en la ciudad, de las que abren los elementos encontrados). */
export function setSubclass(id, state = S()) {
  const L = classesState(state).leader;
  if (!L.cls || !inCity(state) || !availableSubclasses(L.cls, elementsOf(state)).some(s => s.id === id)) return false;
  L.sub = id;
  store.markDirty();
  bus.emit('leader:changed', { cls: L.cls, sub: id });
  return true;
}
/** Elige las activas de clase del líder (según sus espacios). */
export function setLeaderPicks(picks = [], state = S()) {
  const L = classesState(state).leader;
  if (!L.cls) return false;
  const p = leaderPerks(leaderLevel(state));
  L.picks = validPicks(L.cls, p.classLevel, picks, Math.max(p.classSlots, 2));
  store.markDirty();
  return true;
}

// ---------- de dónde sale la experiencia ----------
/** Una pelea: su xp completa al líder y a cada integrante que peleó. */
export function creditFightXp(party = [], xp = 0, state = S()) {
  return { leader: grantLeaderXp(xp, 'combat', state), members: grantClassXp(party, xp, state) };
}
/** Una salida: la xp de la salida × LEADER.gain.expedition al líder y × CLASS_GAIN.expedition a los que fueron. */
export function creditExpeditionXp(party = [], xp = 0, state = S()) {
  return { leader: grantLeaderXp(xp * LEADER.gain.expedition, 'expedition', state), members: grantClassXp(party, xp * CLASS_GAIN.expedition, state) };
}

let inited = false;
/** Engancha las amenazas aguantadas (src/threats emite 'threat:resolved'). Idempotente. */
export function initClasses() {
  classesState();
  if (inited) return;
  inited = true;
  bus.on('threat:resolved', (p) => { try { if (p && p.id !== 'sim') grantLeaderXp(threatXp(p.pct), 'threat'); } catch (e) { console.warn('[classes] amenaza', e); } });
}
