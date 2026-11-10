// La gente de la ciudad con su herramienta (El Quiebre, paso 5b segunda parte: L5; DESIGN-COMBAT.md §15). Los datos
// están en src/core/people-data.js; acá se guardan la llegada, el Vínculo, los encargos y el nivel de cada
// herramienta, y se escuchan los eventos que hacen avanzar los encargos.
//
// state.people = { v: 1, list: { [id]: { arrived, met, bond, n, tool } } }
//   arrived: cuándo llegó (0: todavía no) · met: ya se mostró la llegada · bond: Vínculo 1..5 · n: avance del encargo
//   actual · tool: nivel de su herramienta 0..5
// Eventos: 'people:arrived' { id } · 'people:bond' { id, bond } · 'people:tool' { id, tool, level }
import { store } from './state.js';
import { bus } from './bus.js';
import * as E from './economy.js';
import { PEOPLE, PEOPLE_IDS, BOND_MAX, TOOL_MAX, TOOLS, toolCost } from './people-data.js';
import { WEAPON_TYPES, weaponName, masteryUnlock, ITEM_MASTERY_PLUS_AT } from './arsenal.js';
import { ITEMS } from '../combat/combat-data.js';
import { t } from './i18n.js';

/** Avisos del arsenal y la maestría (paso 2a), por t(). */
export const TXT = {
  masteryUp: (name, n, what) => what ? t('arsenal.toast.masteryWhat', { name, n, what }) : t('arsenal.toast.mastery', { name, n }),
  get itemPlus() { return t('arsenal.toast.itemPlus'); },
  found: (name) => t('arsenal.toast.found', { name }),
  foundAuto: (name) => t('arsenal.toast.foundAuto', { name }),
};

const S = () => store.state;

/** Completa state.people (idempotente; se guarda por deepFill-friendly: no sube la versión del guardado). */
export function peopleState(state = S()) {
  if (!state.people || typeof state.people !== 'object') state.people = {};
  const p = state.people;
  p.v = 1;
  if (!p.list || typeof p.list !== 'object') p.list = {};
  for (const id of PEOPLE_IDS) {
    const o = p.list[id];
    if (!o || typeof o !== 'object') p.list[id] = { arrived: 0, met: false, bond: 1, n: 0, tool: 0 };
    else {
      o.arrived = Number(o.arrived) || 0; o.met = !!o.met;
      o.bond = Math.max(1, Math.min(BOND_MAX, o.bond | 0 || 1));
      o.n = Math.max(0, o.n | 0); o.tool = Math.max(0, Math.min(TOOL_MAX, o.tool | 0));
    }
  }
  return p;
}

// ---------- llegada ----------
function zonesOf(region, state) {
  const z = state.expedition?.regions?.[region]?.zone;
  return Math.max(0, (Number(z) || 1) - 1);
}
/** ¿Se cumple la condición de llegada? */
export function canArrive(id, state = S()) {
  const a = PEOPLE[id]?.arrive;
  if (!a) return false;
  if (a.start) return true;
  if (a.rank) { let r = 1; try { r = E.townRank(state); } catch {} return r >= a.rank; }
  if (a.zone) return zonesOf(a.zone.region, state) >= a.zone.n;
  return false;
}
/** Texto de cuándo llega (para la fila cerrada de la pestaña Progreso). */
export function arriveText(id) {
  const a = PEOPLE[id]?.arrive || {};
  if (a.rank) { let n = ''; try { n = E.rankName(a.rank); } catch {} return `Llega con el rango ${n || a.rank}`; }
  if (a.zone) return a.zone.region === 'bosque' ? 'Llega cuando explores la primera zona del Bosque' : 'Llega al explorar más';
  return '';
}
/** Hace llegar a quien ya puede (con su herramienta en nivel 1). Devuelve los ids que llegaron. */
export function checkArrivals(state = S()) {
  const P = peopleState(state), out = [];
  for (const id of PEOPLE_IDS) {
    const o = P.list[id];
    if (o.arrived || !canArrive(id, state)) continue;
    o.arrived = Date.now();
    o.tool = Math.max(1, o.tool);
    if (PEOPLE[id].arrive.start) o.met = true;   // Vera ya está desde el prólogo
    out.push(id);
    bus.emit('people:arrived', { id });
  }
  if (out.length) store.markDirty();
  return out;
}

// ---------- encargos y Vínculo ----------
export const currentTask = (id, state = S()) => {
  const o = peopleState(state).list[id];
  return o && o.arrived && o.bond < BOND_MAX ? PEOPLE[id].tasks[o.bond - 1] || null : null;
};
function bondUp(id, state) {
  const o = peopleState(state).list[id];
  if (o.bond >= BOND_MAX) return false;
  o.bond++; o.n = 0;
  store.markDirty();
  bus.emit('people:bond', { id, bond: o.bond });
  return true;
}
/** Suma avance a los encargos de ese tipo. Devuelve los ids que subieron de Vínculo. */
export function progress(type, { region = null, n = 1 } = {}, state = S()) {
  const P = peopleState(state), ups = [];
  for (const id of PEOPLE_IDS) {
    const t = currentTask(id, state);
    if (!t || t.type !== type || (t.region && t.region !== region)) continue;
    const o = P.list[id];
    o.n += n;
    if (o.n >= (t.n || 1) && bondUp(id, state)) ups.push(id);
  }
  store.markDirty();
  return ups;
}
/** Los encargos de la historia: se cumplen solos cuando está la marca. */
export function checkFlags(state = S()) {
  const ups = [];
  const flags = state.story?.flags || {};
  for (const id of PEOPLE_IDS) {
    const t = currentTask(id, state);
    if (t?.type === 'flag' && flags[t.flag] && bondUp(id, state)) ups.push(id);
  }
  return ups;
}
/** Entregar los materiales del encargo. { ok, why }. */
export function deliver(id, state = S()) {
  const t = currentTask(id, state);
  if (!t || t.type !== 'deliver') return { ok: false, why: 'No hay nada para entregar' };
  if (!store.canAfford({ mats: t.mats })) return { ok: false, why: 'Faltan materiales' };
  store.spend({ mats: t.mats }, 'people:' + id);
  bondUp(id, state);
  return { ok: true };
}

// ---------- herramientas ----------
export const hasTaller = (state = S()) => { try { return E.cycleLevel('taller', state) > 0; } catch { return false; } };
/** Nivel de cada herramienta: { catalejo, martillo, cuerda, botiquin, farol } (0 si su dueño no llegó). */
export function toolLevels(state = S()) {
  const P = peopleState(state), out = {};
  for (const id of PEOPLE_IDS) { const o = P.list[id]; out[PEOPLE[id].tool] = o.arrived ? o.tool : 0; }
  return out;
}
/** ¿Se puede subir la herramienta de esa persona? { ok, why, to, cost }. */
export function toolUpgradeInfo(id, state = S()) {
  const o = peopleState(state).list[id], P = PEOPLE[id];
  if (!P || !o?.arrived) return { ok: false, why: 'Todavía no llegó' };
  const to = o.tool + 1;
  if (o.tool >= TOOL_MAX) return { ok: false, why: 'Está al máximo', to: o.tool };
  const cost = toolCost(P.tool, to);
  if (to > o.bond) return { ok: false, why: `Pide Vínculo ${to}`, to, cost };
  if (!hasTaller(state)) return { ok: false, why: 'Se mejora en el Taller', to, cost };
  if (!store.canAfford(cost)) return { ok: false, why: 'Faltan recursos', to, cost };
  return { ok: true, why: '', to, cost };
}
export function upgradeTool(id, state = S()) {
  const inf = toolUpgradeInfo(id, state);
  if (!inf.ok) return inf;
  store.spend(inf.cost, 'tool:' + PEOPLE[id].tool);
  const o = peopleState(state).list[id];
  o.tool = inf.to;
  store.markDirty();
  bus.emit('people:tool', { id, tool: PEOPLE[id].tool, level: o.tool });
  return { ok: true, to: o.tool };
}

/** Todo lo de una persona para la pestaña Progreso. */
export function personInfo(id, state = S()) {
  const P = PEOPLE[id], o = peopleState(state).list[id];
  if (!P) return null;
  const t = currentTask(id, state);
  return {
    id, name: P.name, title: P.title, who: P.who, tool: P.tool, toolName: TOOLS[P.tool].name, arrived: !!o.arrived, met: o.met,
    bond: o.bond, toolLevel: o.arrived ? o.tool : 0, arriveText: arriveText(id),
    task: t ? { ...t, have: t.type === 'deliver' ? null : o.n, need: t.n || 1, canDeliver: t.type === 'deliver' && store.canAfford({ mats: t.mats }) } : null,
    upgrade: toolUpgradeInfo(id, state),
  };
}
export const peopleInfo = (state = S()) => PEOPLE_IDS.map(id => personInfo(id, state));

// ---------- eventos ----------
let inited = false;
let showFn = null, idleFn = () => true, busy = false;
/** Escena de llegada: las 2 líneas y el dato del mundo. */
export function arrivalScene(id) {
  const P = PEOPLE[id];
  return { id: 'llega_' + id, who: P.who, title: `${P.name}, ${P.title}`, lines: [...P.lines, P.fact].filter(Boolean) };
}
/**
 * Engancha los eventos (idempotente). opts.idle(): cuándo se puede mostrar una llegada (ciudad sin modales);
 * opts.show(scene): cómo se muestra (la escena de historia de src/story/story-ui.js).
 */
export function initPeople(ctx, { idle = () => true, show = null } = {}) {
  peopleState();
  checkArrivals();
  checkFlags();
  if (inited) return;
  inited = true;
  const toast = (text, ic) => { try { ctx?.ui?.toast?.(text, { icon: ic }); } catch {} };
  const check = () => { checkArrivals(); checkFlags(); };
  bus.on('town:rankup', check);
  bus.on('expedition:zone', () => { progress('zone'); check(); });
  bus.on('expedition:finished', (p) => { if (!p?.prototype) progress('expedition', { region: p?.region || null }); check(); });
  bus.on('combat:won', () => progress('combatWin'));
  bus.on('threat:resolved', (p) => { if (p && p.id !== 'sim') progress('threat'); });
  bus.on('reward:page', checkFlags);
  bus.on('quests:changed', checkFlags);
  bus.on('people:bond', ({ id, bond }) => toast(`${PEOPLE[id].name}: Vínculo ${bond}. Ya se puede mejorar su ${TOOLS[PEOPLE[id].tool].name.toLowerCase()}.`, 'people'));
  bus.on('people:tool', ({ id, level }) => toast(`${TOOLS[PEOPLE[id].tool].name} nivel ${level}`, 'hammer'));
  // arsenal (paso 2a): la maestría que sube y el arma que se encuentra. La subida de Nivel ya abre su panel
  // ('level:up' → openPanel('levelup')), por eso 'leader:levelup' no lleva toast acá.
  bus.on('mastery:up', ({ kind, id, level } = {}) => {
    if (kind === 'objeto') {
      const it = ITEMS[id];
      if (it) toast(TXT.masteryUp(it.name, level, ITEM_MASTERY_PLUS_AT.includes(level) ? TXT.itemPlus : ''), 'hammer');
      return;
    }
    const T = WEAPON_TYPES[id];
    if (T) toast(TXT.masteryUp(T.name, level, masteryUnlock(id, level)?.name || ''), 'star');
  });
  bus.on('arsenal:drop', ({ weapon, auto } = {}) => {
    if (weapon) toast(auto ? TXT.foundAuto(weaponName(weapon)) : TXT.found(weaponName(weapon)), auto ? 'hammer' : 'gift');
  });
  // las llegadas se muestran de a una, cuando la ciudad está tranquila (las que llegaron y todavía no se vieron)
  showFn = show; idleFn = idle;
  setInterval(() => { showNextArrival(); }, 1500);
}
/** Muestra la próxima llegada que no se vio (si la ciudad está tranquila, o siempre con force). */
export async function showNextArrival({ force = false } = {}) {
  if (busy || !showFn) return false;
  const id = PEOPLE_IDS.find(k => { const o = peopleState().list[k]; return o.arrived && !o.met; });
  if (!id || (!force && (!idleFn() || document.querySelector('.st-card')))) return false;
  const o = peopleState().list[id];
  busy = true;
  o.met = true;
  store.markDirty();
  const sc = arrivalScene(id);
  try {
    const v = await showFn(sc);
    // si otra escena de la historia la tapó (o se salió de la ciudad), se vuelve a mostrar después
    const other = document.querySelector('.st-card:not(.out)');
    if (v !== 'done' && (v === 'away' || (other && other.dataset.scene !== sc.id))) { o.met = false; store.markDirty(); }
  } catch (e) { console.warn('[people] llegada', e); }
  busy = false;
  return true;
}
