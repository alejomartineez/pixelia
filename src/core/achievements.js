// Logros (paso 1c de La Travesía): hitos que se cumplen una sola vez y quedan anotados en la Bitácora (Diario).
// Antes eran los trofeos de Mi Casa (muebles 'trofeo_*'); el guardado v6 pasa home.trophies a state.achievements.
// Estado: state.achievements = { id: fecha (ms) }. Sin DOM.
import { bus } from './bus.js';
import { store } from './state.js';

export const ACHIEVEMENTS = [
  { id: 'trofeo_rango', name: 'Copa de la Municipalidad', ic: 'trophy', desc: 'Llevar la ciudad al rango Villa.', test: (s) => (s.stats?.rankBest || 0) >= 4 },
  { id: 'trofeo_obra', name: 'Maqueta del Faro', ic: 'monument', desc: 'Terminar el primer monumento.', test: (s) => MONUMENT_DONE(s) },
  { id: 'trofeo_album', name: 'Medalla de Hallazgos', ic: 'finding', desc: 'Juntar 30 Hallazgos nuevos.', test: (s) => (s.stats?.stickersNew || 0) >= 30 },
  // recuerdo de los minijuegos: solo se muestra a quien lo ganó
  { id: 'trofeo_joyas', name: 'Trofeo de Joyas', ic: 'gem', desc: 'Pasar 10 niveles de Joyas Brillantes.', legacy: true, test: (s) => (s.stats?.match3Wins || 0) >= 10 },
];
export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

let MONUMENT_DONE = () => false;
const S = () => store.state;
export function achievementsState(state = S()) {
  if (!state.achievements || typeof state.achievements !== 'object') state.achievements = {};
  return state.achievements;
}
/** Logros para la Bitácora: los cumplidos y los que faltan (los de antes solo si se ganaron). */
export function achievementList(state = S()) {
  const got = achievementsState(state);
  return ACHIEVEMENTS.filter(a => !a.legacy || got[a.id]).map(a => ({ ...a, at: got[a.id] || 0 }));
}
/** Revisa los logros (idempotente). Devuelve los ids nuevos. */
export function syncAchievements(state = S()) {
  const got = achievementsState(state);
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (got[a.id]) continue;
    let ok = false;
    try { ok = a.test(state); } catch {}
    if (!ok) continue;
    got[a.id] = Date.now();
    fresh.push(a.id);
  }
  if (fresh.length) { store.markDirty(); bus.emit('achievement:new', { ids: fresh }); }
  return fresh;
}
let inited = false;
/** Una vez al arrancar (main.js). monumentDone: (state) => bool, para no importar economy.js desde acá. */
export function initAchievements({ monumentDone } = {}) {
  if (monumentDone) MONUMENT_DONE = monumentDone;
  if (inited) return;
  inited = true;
  let pend = 0;
  const later = () => { if (!pend) pend = setTimeout(() => { pend = 0; syncAchievements(); }, 400); };
  for (const ev of ['stats:changed', 'town:rankup', 'building:upgraded']) bus.on(ev, later);
  syncAchievements();
}
