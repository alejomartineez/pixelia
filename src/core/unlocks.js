// Apertura escalonada (DESIGN-CORE.md §6.2): las funciones se abren de a poco.
//  - Las que se ganan jugando (Expedición, Diarias, Obras, Hallazgos, Cofres…) se abren apenas se cumple la condición.
//  - Las que se abren con el paso de los días (Pase, Contactos, Eventos) salen de a una por sesión, en el modal de llegada
//    ("Hoy se abre: el Pase de Temporada"), que además adelanta la próxima ("Mañana se abre: Contactos").
// Estado: state.unlocks = { open: { id: ms } }. Las partidas de antes de esta versión arrancan con todo lo que ya cumplen
// abierto, sin aviso (initUnlocks).
import { bus } from './bus.js';
import { store, levelOf } from './state.js';
import { townRank } from './economy.js';

const DAY = 86400e3;
const S = () => store.state;
const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** Día de juego: 1 el día en que se creó la partida, 2 el siguiente (por fecha del calendario, no por horas). */
export function playDay(state = S(), now = Date.now()) {
  const c = Number(state.created) || now;
  return Math.max(1, Math.round((startOfDay(now) - startOfDay(c)) / DAY) + 1);
}
const has = (s, id) => s.city.buildings.some(b => b.id === id);
const rk = (s) => { try { return townRank(s); } catch { return 1; } };

// kind 'play': se abre sola al cumplirse · kind 'day': se anuncia al arrancar, de a una por sesión.
// soon(s): lo que falta en días para la condición de fecha (para el "mañana se abre"), o null si no depende del día.
export const FEATURES = [
  { id: 'expedicion', kind: 'play', name: 'la Expedición', ok: (s) => has(s, 'casa_exp') || !!s.expedition?.active },
  { id: 'diarias', kind: 'play', name: 'las misiones diarias', ok: (s) => !!s.quests?.done?.t9 },
  { id: 'amenazas', kind: 'play', name: 'las amenazas', ok: (s) => rk(s) >= 2 },
  { id: 'obras', kind: 'play', name: 'las obras de monumentos', ok: (s) => rk(s) >= 3 || s.city.buildings.some(b => b.id && /^(faro|jardin|observatorio|estadio|museo|torre_reloj)$/.test(b.id)) },
  { id: 'hallazgos', kind: 'play', name: 'los Hallazgos', ok: (s) => Object.values(s.album?.have || {}).some(n => n > 0) },
  { id: 'cofres', kind: 'play', name: 'los cofres', ok: (s) => (s.stats?.chestsOpened || 0) > 0 || Object.values(s.chests?.inv || {}).some(n => n > 0) },
  { id: 'pase', kind: 'day', name: 'el Pase de Temporada', icon: 'sparkle', ok: (s, now) => playDay(s, now) >= 2 || rk(s) >= 2, days: 2 },
  { id: 'contactos', kind: 'day', name: 'Contactos', icon: 'people', ok: (s, now) => playDay(s, now) >= 2 && levelOf(s) >= 4, days: 2, level: 4 },
  { id: 'eventos', kind: 'day', name: 'los eventos de la semana', icon: 'calendar', ok: (s, now) => playDay(s, now) >= 3, days: 3 },
];
const BY_ID = Object.fromEntries(FEATURES.map(f => [f.id, f]));

const us = (state = S()) => {
  if (!state.unlocks || typeof state.unlocks !== 'object') state.unlocks = {};
  if (!state.unlocks.open || typeof state.unlocks.open !== 'object') state.unlocks.open = {};
  return state.unlocks;
};

/** ¿Está abierta la función? Las de juego se abren (y quedan abiertas) apenas se cumplen. */
export function isOpen(id, state = S(), now = Date.now()) {
  const f = BY_ID[id];
  if (!f) return true;
  const u = us(state);
  if (u.open[id]) return true;
  if (f.kind === 'play' && safeOk(f, state, now)) {
    u.open[id] = now;
    store.markDirty();
    queueMicrotask(() => bus.emit('unlocks:changed', { id }));
    return true;
  }
  return false;
}
function safeOk(f, s, now) { try { return !!f.ok(s, now); } catch { return false; } }

let sessionDone = false;   // como mucho una apertura "de día" por sesión
/** Al arrancar: abre la primera función de día que ya corresponde. {id, name, icon} o null. Una sola vez por sesión. */
export function sessionUnlock(state = S(), now = Date.now()) {
  if (sessionDone) return null;
  const u = us(state);
  const f = FEATURES.find(x => x.kind === 'day' && !u.open[x.id] && safeOk(x, state, now));
  if (!f) return null;
  sessionDone = true;
  u.open[f.id] = now;
  store.markDirty();
  bus.emit('unlocks:changed', { id: f.id });
  return { id: f.id, name: f.name, icon: f.icon };
}
/** Lo que se abre en una próxima sesión: ya corresponde (esperando su turno) o se cumple mañana por fecha. */
export function nextUnlock(state = S(), now = Date.now()) {
  const u = us(state);
  const tomorrow = startOfDay(now) + DAY + 9 * 3600e3;
  for (const f of FEATURES) {
    if (f.kind !== 'day' || u.open[f.id]) continue;
    if (safeOk(f, state, now)) return { id: f.id, name: f.name, icon: f.icon, when: 'mañana' };
    if (safeOk(f, state, tomorrow)) return { id: f.id, name: f.name, icon: f.icon, when: 'mañana' };
    if (f.level && playDay(state, tomorrow) >= f.days) return { id: f.id, name: f.name, icon: f.icon, when: `al llegar al nivel ${f.level}` };
  }
  return null;
}
/** Si ya pasó la apertura de la sesión (para no repetir el aviso). */
export const sessionUnlockDone = () => sessionDone;

/**
 * Arranque. Una partida que ya venía jugando (nivel ≥ 3, rango ≥ 2 o creada antes de ayer) abre sin aviso todo lo que ya
 * cumple: quien juega desde antes no ve aparecer de golpe botones que ya conocía.
 */
export function initUnlocks(state = S(), now = Date.now()) {
  const u = us(state);
  if (u.v) return;
  u.v = 1;
  const veteran = levelOf(state) >= 3 || rk(state) >= 2 || playDay(state, now) >= 3 || !!state.v3;
  if (veteran) for (const f of FEATURES) if (safeOk(f, state, now)) u.open[f.id] = u.open[f.id] || now;
  store.markDirty();
}
/** Solo para pruebas y ?cheat: abre lo que depende del día (lo que se gana jugando sigue su condición). all: todo. */
export function _openAll(state = S(), now = Date.now(), { all = false } = {}) {
  const u = us(state);
  for (const f of FEATURES) if (all || f.kind === 'day') u.open[f.id] = u.open[f.id] || now;
  store.markDirty();
  bus.emit('unlocks:changed', {});
}
