// La Travesía por nodos (PLAN-FOTO §A1): datos del prototipo. Puro: sin DOM ni i18n (los textos van por
// t('voyage.…') en la escena, con el id de cada cosa).
//
// Punto de extensión para el paso A3 (reliquias y botín): RELICS y REWARDS son tablas declarativas. Cada reliquia es
// un puñado de modificadores (`mods`, se suman o multiplican en voyage-rules.js relicMods) y, si hace falta algo que
// no entra en un modificador, funciones en `on` (voyage-rules.js fire: battle, fightWon, enter, finish). Para sumar
// una reliquia o una recompensa nueva alcanza con agregar la entrada acá (o con registerRelic / registerReward).
import { TUTORIAL_PARTY, FARM } from '../combat/combat-data.js';

export const NODE_TYPES = ['pelea', 'elite', 'evento', 'campamento', 'jefe'];
export const FIGHT_TYPES = ['pelea', 'elite', 'jefe'];

export const VOY = {
  rows: [5, 7],          // filas del mapa, contando la del jefe
  width: [2, 4],         // nodos por fila (la del jefe tiene uno)
  fights: [3, 5],        // peleas en cualquier camino, contando élites y jefe
  // pesos de las filas del medio (la primera es siempre pelea y la anterior al jefe, campamento)
  weights: { pelea: 40, evento: 32, elite: 14, campamento: 14 },
  eliteFromRow: 2,       // las élites no salen en las dos primeras filas
  // el grupo del prototipo (fijo hasta que A3 lo arme con lo que llevás puesto)
  party: TUTORIAL_PARTY, level: 4, classLevel: 2, element: 'raiz',
  downHp: 1,             // quien cayó en una pelea llega a la siguiente con esta vida
  elite: { hp: 1 },      // las élites del Arroyo ya son encuentros propios (combat-data.js FARM.arroyo.elites)
  camp: { heal: 0.5, train: { maxHpAll: 2, atkLeader: 1 } },
  reward: { relicChance: 0.3 },
  loseLoot: 0.5,         // caer o retirarse: se vuelve con la mitad
};

/** La isla de la porción vertical: Bosque del Arroyo (los encuentros de farmeo del paso A2), con la Bestia del Bañado al final. */
const even = (ids) => Object.fromEntries(ids.map(id => [id, 10]));
export const ISLANDS = {
  bosque: {
    id: 'bosque',
    fights: even(FARM.arroyo.comunes),
    elites: even(FARM.arroyo.elites),
    boss: FARM.arroyo.jefe,
    events: ['puente', 'herido', 'altar', 'nido', 'fogata'],
  },
};

// Efectos (los aplica voyage-rules.js applyFx): healAll (0..1 = fracción de la vida máxima; más de 1 = puntos),
// dmgAll, dmgLeader (nunca matan: dejan en 1), maxHpAll, maxHpLeader, atkAll, atkLeader, atk / armor { who, n },
// mats { id: n }, loseMats (fracción), item, useItem, relic (true = una al azar; id = esa), nextFoe y bossHp
// (multiplican la vida de los enemigos de la próxima pelea y del jefe).

/** Eventos: cada opción tiene una consecuencia segura, a la vista antes de elegir. need: lo que hay que tener. */
export const EVENTS = {
  puente: { id: 'puente', options: [
    { id: 'cruzar', fx: { dmgAll: 2 } },
    { id: 'soltar', fx: { loseMats: 0.5 } },
  ] },
  herido: { id: 'herido', options: [
    { id: 'curar', need: { item: 'botiquin' }, fx: { useItem: 'botiquin', relic: true } },
    { id: 'escoltar', fx: { dmgAll: 2, mats: { hierbas: 4 } } },
    { id: 'seguir', fx: {} },
  ] },
  altar: { id: 'altar', options: [
    { id: 'sangre', fx: { maxHpLeader: -3, atkAll: 1 } },
    { id: 'ofrenda', need: { mats: 4 }, fx: { loseMats: 1, healAll: 1 } },
    { id: 'pasar', fx: {} },
  ] },
  nido: { id: 'nido', options: [
    { id: 'robar', fx: { mats: { madera: 4, hierbas: 3 }, nextFoe: 1.3 } },
    { id: 'rodear', fx: { dmgAll: 1 } },
  ] },
  fogata: { id: 'fogata', options: [
    { id: 'descansar', fx: { healAll: 0.4, bossHp: 1.15 } },
    { id: 'revolver', fx: { item: 'botiquin', dmgLeader: 2 } },
    { id: 'seguir', fx: {} },
  ] },
};

/**
 * Reliquias de la salida: cambian reglas, no números sueltos. mods:
 *   afterFightHeal (puntos a cada uno al ganar) · foeHp (× la vida enemiga) · campBoth (el campamento da las dos
 *   cosas) · revive (una vez por salida: al caer, el grupo se levanta con esa fracción de vida y la pelea se repite) ·
 *   lootMult (× los materiales de las peleas) · campHeal (× lo que cura el campamento) · equip (objetos en cada pelea)
 */
export const RELICS = {
  brasa: { id: 'brasa', mods: { afterFightHeal: 2 } },
  mella: { id: 'mella', mods: { foeHp: 0.85 } },
  fogon: { id: 'fogon', mods: { campBoth: true } },
  segunda: { id: 'segunda', mods: { revive: 0.5 } },
  bolsa: { id: 'bolsa', mods: { lootMult: 1.5, campHeal: 0.5 } },
  alforja: { id: 'alforja', mods: { equip: ['botiquin'] } },
};
export const registerRelic = (def) => { RELICS[def.id] = def; };

/**
 * Recompensas tras una pelea (se ofrecen 3 y se elige 1). w: peso. who: 'any' = se sortea a quién le toca al
 * ofrecerla. fx(ctx) arma el efecto con la pelea recién ganada (ctx.mats: lo que dejó).
 */
export const REWARDS = {
  curar: { id: 'curar', w: 30, fx: () => ({ healAll: 0.35 }) },
  vida: { id: 'vida', w: 22, fx: () => ({ maxHpAll: 2 }) },
  filo: { id: 'filo', w: 22, who: 'any', fx: (c) => ({ atk: { who: c.who, n: 1 } }) },
  coraza: { id: 'coraza', w: 14, who: 'any', fx: (c) => ({ armor: { who: c.who, n: 1 } }) },
  botin: { id: 'botin', w: 22, fx: (c) => ({ mats: { ...c.mats } }) },
  objeto: { id: 'objeto', w: 14, fx: () => ({ item: 'botiquin' }) },
};
export const registerReward = (def) => { REWARDS[def.id] = def; };
