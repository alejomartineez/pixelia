// Bonus permanentes de los monumentos terminados (ver MONUMENTS en data.js).
// Módulo chico, sin dependencias de economy.js, para que lo puedan usar main.js, season.js y economy.js sin ciclos.
import { store } from './state.js';
import { MONUMENTS, MONUMENT_IDS } from './data.js';

/** ¿El monumento está terminado (en su última etapa y sin obra pendiente de construcción)? */
export function monumentComplete(id, state = store.state, now = Date.now()) {
  const mo = MONUMENTS[id];
  const b = mo && state?.city?.buildings?.find(o => o.id === id);
  return !!b && !(b.buildEnd > now) && (b.level || 1) >= mo.stages.length;
}
/** Cuántos monumentos terminados hay. */
export function monumentsDone(state = store.state, now = Date.now()) {
  return MONUMENT_IDS.filter(id => monumentComplete(id, state, now)).length;
}
/** Suma de los bonus de un tipo (shopCoins, happy, gameXp, pass, stickers, time) de los monumentos terminados. */
export function monumentBonus(type, state = store.state, now = Date.now()) {
  let s = 0;
  for (const id of MONUMENT_IDS) {
    const mo = MONUMENTS[id];
    if (mo.bonus?.type === type && monumentComplete(id, state, now)) s += mo.bonus.value;
  }
  return s;
}
