// Fuerza (power level) · La Travesía, paso 2a. Puro: sin DOM, sin store ni bus (se importa desde combat-rules y Node).
// La Fuerza junta Nivel, armas, maestría, talentos, herramientas y escuadra en un número, con los mismos pesos con que
// pegan en el combate: cada punto de vida vale 10, de ataque 30, de coraza 40, cada habilidad y cada pasiva 10–15.
// Cada encuentro tiene su Fuerza recomendada (la del grupo `expected`). El combate la usa para escalar a los enemigos:
// por encima de la recomendada, la mitad de lo que sobra se suma a la vida (y al ataque) de los enemigos; con menos,
// no se achican (DESIGN-COMBAT.md §18.4).
import { leaderKit, memberKit, combatLevel, nivelFor, leaderLevelFromXp, classLevelFromXp, CLASS_IDS, toClass } from '../combat/classes.js';
import { ENCOUNTERS } from '../combat/combat-data.js';
import { gearMods } from './arsenal.js';
import { talentMods } from './talents.js';

export const POWER_W = { hp: 10, atk: 30, armor: 40, ability: 10, flag: 15, tool: 10, nivel: 3 };
/** La parte de la Fuerza que sobra sobre la recomendada que se suma a los enemigos (0,5: la mitad). */
export const FOE_FOLLOW = 0.5;
/** Tope del escalado de los enemigos (× la vida). */
export const FOE_MAX = 2;

const flagsN = (f = {}) => Object.values(f).reduce((a, n) => a + (n || 0), 0);
/** Fuerza de una unidad con su kit (leaderKit/memberKit) y sus mods (gearMods). */
export function unitPower(kit, mods = null) {
  if (!kit) return 0;
  const W = POWER_W;
  const m = mods || { hp: 0, atk: 0, armor: 0, flags: {}, affinity: [] };
  return W.hp * (kit.hp + m.hp) + W.atk * (kit.atk + m.atk) + W.armor * ((kit.armor || 0) + m.armor)
    + W.ability * (kit.abilities?.length || 0) + W.flag * (flagsN(kit.flags) + flagsN(m.flags)) + 20 * (m.affinity?.length || 0);
}
const toolsPower = (tools = {}) => POWER_W.tool * Object.values(tools).reduce((a, n) => a + (Number(n) || 0), 0);

/**
 * Fuerza de la partida con una escuadra. squad: ids de clase (o roles viejos). opts: { caps: { cls: tope de nivel },
 * tools: { catalejo: n, … }, elements }. Devuelve { total, leader, members: [{ cls, power }], tools, nivel }.
 */
export function powerOf(state, squad = [], opts = {}) {
  const L = state.classes?.leader || {};
  const nivel = leaderLevelFromXp(L.xp || 0);
  const els = opts.elements || (Array.isArray(state.story?.elements) ? state.story.elements : []);
  const tal = talentMods(state);
  const lk = leaderKit({ cls: L.cls || null, sub: L.sub || null, picks: L.picks || [], level: combatLevel(nivel), elements: els });
  const leader = unitPower(lk, gearMods(state, 'lider', { leaderCls: L.cls || null, talents: tal }));
  const members = squad.map(toClass).filter(c => CLASS_IDS.includes(c)).slice(0, 3).map(cls => {
    const m = state.classes?.members?.[cls] || {};
    const cl = classLevelFromXp(m.xp || 0, opts.caps?.[cls] ?? 10);
    return { cls, power: unitPower(memberKit(cls, cl, m.picks || []), gearMods(state, cls, { talents: tal })) };
  });
  const tools = toolsPower(opts.tools || {});
  const total = Math.round(leader + members.reduce((a, m) => a + m.power, 0) + tools + POWER_W.nivel * nivel);
  return { total, leader, members, tools, nivel };
}

// ---------- recomendada por encuentro ----------
const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
/** Fuerza de referencia de un integrante con ese nivel de clase (el promedio de las 6 clases). */
const refMember = (cl) => avg(CLASS_IDS.map(c => unitPower(memberKit(c, cl, []))));
/** Fuerza de referencia del líder con ese nivel de combate (el promedio de las 6 clases, con su elemento). */
const refLeader = (lv, el) => avg(CLASS_IDS.map(c => unitPower(leaderKit({ cls: c, level: lv, elements: el ? [el] : [] }))));
const recCache = new Map();
/** Fuerza recomendada para un encuentro: el grupo `expected` (nivel del líder, clases, herramientas) sin armas. */
export function recPower(encId) {
  if (recCache.has(encId)) return recCache.get(encId);
  const ex = ENCOUNTERS[encId]?.expected || {};
  const lv = ex.level || 1, size = ex.size || 3, cl = ex.classLevel || 1;
  const levels = Array.from({ length: size }, (_, i) => Array.isArray(cl) ? cl[i] || 1 : cl);
  const total = Math.round(refLeader(lv, ex.element) + levels.reduce((a, l) => a + refMember(l), 0) + toolsPower(ex.tools || {}) + POWER_W.nivel * nivelFor(lv));
  recCache.set(encId, total);
  return total;
}
/**
 * Escalado de los enemigos para una Fuerza: { hp: ×, atk: +, target }. Con la recomendada (o menos) no cambia nada.
 * extra: Fuerza que se suma al objetivo (la Marea del 2c).
 */
export function foeScale(power, rec, extra = 0) {
  const target = rec + FOE_FOLLOW * Math.max(0, (power || 0) - rec) + Math.max(0, extra);
  const m = Math.min(FOE_MAX, Math.max(1, target / Math.max(1, rec)));
  return { hp: m, atk: m >= 1.8 ? 2 : m >= 1.35 ? 1 : 0, target: Math.round(target) };
}
