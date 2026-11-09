// Talentos (La Travesía, paso 2a): un punto por cada Nivel ganado, en un árbol corto de 3 ramas, y puntos de paragon
// pasado el Nivel 50. Puro: sin DOM, sin store ni bus. El estado vive en state.talents = { ranks: { id: n },
// paragon: { mando: n, … } }; los puntos se calculan del Nivel (no se guardan). Diseño: DESIGN-COMBAT.md §18.3.
import { leaderLevelFromXp, paragonPoints } from '../combat/classes.js';

export const TXT = {
  noPoints: 'No te quedan puntos', maxed: 'Ya está al máximo', needBranch: (n, b) => `Pide ${n} puntos en ${b}`,
  noParagon: 'Los puntos de paragon llegan con el árbol lleno y pasado el Nivel 50',
};

/**
 * Ramas. Cada talento: max rangos, need = puntos que pide gastados antes en la rama, y lo que da por rango.
 * Efectos chicos y visibles: el combate (lider/squad: vida, ataque, coraza, pasivas por flag), la travesía (ánimo,
 * maestría, hallazgo de armas) y el Taller (desarmar, rehacer rasgos, rareza del arma del jefe).
 */
export const BRANCHES = {
  mando: { id: 'mando', name: 'Mando', text: 'Quien lidera y cómo lo sigue el grupo.', paragon: { name: 'Temple', text: '+2 % de maestría por punto.', mastery: 0.02 } },
  supervivencia: { id: 'supervivencia', name: 'Supervivencia', text: 'Aguantar la travesía y volver.', paragon: { name: 'Aguante', text: '+1 de vida a quien lidera cada 5 puntos.', hpEvery: 5 } },
  oficio: { id: 'oficio', name: 'Oficio', text: 'Sacarle provecho a lo que se trae.', paragon: { name: 'Ojo de hallazgo', text: '+0,5 % de chance de arma por punto (tope 15 %).', find: 0.005, findMax: 0.15 } },
};
export const BRANCH_IDS = Object.keys(BRANCHES);
export const TALENTS = {
  // Mando
  mando_vida: { id: 'mando_vida', branch: 'mando', name: 'Presencia', max: 3, need: 0, text: '+1 de vida a quien lidera por rango.', lider: { hp: 1 } },
  mando_maestria: { id: 'mando_maestria', branch: 'mando', name: 'Escuela', max: 5, need: 0, text: '+10 % de maestría de armas por rango.', mastery: 0.1 },
  mando_voz: { id: 'mando_voz', branch: 'mando', name: 'Voz de mando', max: 3, need: 4, text: '+1 de vida a cada integrante por rango.', squad: { hp: 1 } },
  mando_filo: { id: 'mando_filo', branch: 'mando', name: 'Filo', max: 1, need: 8, text: '+1 de ataque a quien lidera.', lider: { atk: 1 } },
  mando_muro: { id: 'mando_muro', branch: 'mando', name: 'Línea firme', max: 1, need: 12, text: 'Las paredes y barreras de quien lidera duran 1 turno más.', lider: { flags: { wallPlus: 1 } } },
  // Supervivencia
  sup_animo: { id: 'sup_animo', branch: 'supervivencia', name: 'Buen ánimo', max: 2, need: 0, text: '+1 de ánimo máximo en la travesía por rango.', morale: 1 },
  sup_cuero: { id: 'sup_cuero', branch: 'supervivencia', name: 'Cuero duro', max: 3, need: 0, text: '+1 de vida a quien lidera por rango.', lider: { hp: 1 } },
  sup_vigia: { id: 'sup_vigia', branch: 'supervivencia', name: 'Vigía', max: 1, need: 4, text: 'Se ve la intención de un enemigo más.', lider: { flags: { intentPlus: 1 } } },
  sup_curas: { id: 'sup_curas', branch: 'supervivencia', name: 'Vendas limpias', max: 2, need: 5, text: 'Las curas de quien lidera dan +1 por rango.', lider: { flags: { healPlus: 1 } } },
  sup_coraza: { id: 'sup_coraza', branch: 'supervivencia', name: 'Coraza', max: 1, need: 10, text: '+1 de coraza a quien lidera.', lider: { armor: 1 } },
  sup_botin: { id: 'sup_botin', branch: 'supervivencia', name: 'Mochila llena', max: 1, need: 12, text: 'Al ganar una pelea, 1 material más.', lider: { flags: { lootWin: 1 } } },
  // Oficio
  of_desarme: { id: 'of_desarme', branch: 'oficio', name: 'Desarmador', max: 3, need: 0, text: 'Desarmar da 1 material más por rango.', scrap: 1 },
  of_hallazgo: { id: 'of_hallazgo', branch: 'oficio', name: 'Buen ojo', max: 3, need: 0, text: '+3 % de chance de que una pelea deje un arma por rango.', find: 0.03 },
  of_rehacer: { id: 'of_rehacer', branch: 'oficio', name: 'Mano de herrero', max: 3, need: 4, text: 'Rehacer un rasgo cuesta 10 % menos por rango.', reroll: 0.1 },
  of_taller: { id: 'of_taller', branch: 'oficio', name: 'Práctica', max: 3, need: 4, text: '+20 % de maestría de los objetos del Taller por rango.', itemMastery: 0.2 },
  of_jefe: { id: 'of_jefe', branch: 'oficio', name: 'Botín de jefe', max: 1, need: 12, text: 'El arma de un jefe sale rara como mínimo.', bossRarity: 2 },
};
export const TALENT_IDS = Object.keys(TALENTS);
/** Puntos que da el árbol entero (el resto, y el paragon, van al paragon de cada rama). */
export const TREE_POINTS = TALENT_IDS.reduce((a, id) => a + TALENTS[id].max, 0);

/** Completa state.talents (idempotente). */
export function talentsState(state) {
  if (!state.talents || typeof state.talents !== 'object') state.talents = {};
  const t = state.talents;
  if (!t.ranks || typeof t.ranks !== 'object') t.ranks = {};
  for (const id of Object.keys(t.ranks)) if (!TALENTS[id]) delete t.ranks[id]; else t.ranks[id] = Math.max(0, Math.min(TALENTS[id].max, t.ranks[id] | 0));
  if (!t.paragon || typeof t.paragon !== 'object') t.paragon = {};
  for (const b of BRANCH_IDS) t.paragon[b] = Math.max(0, t.paragon[b] | 0);
  for (const k of Object.keys(t.paragon)) if (!BRANCHES[k]) delete t.paragon[k];
  return t;
}
const xpOf = (state) => Math.max(0, Number(state.classes?.leader?.xp) || 0);
const spentIn = (t, branch) => TALENT_IDS.filter(id => TALENTS[id].branch === branch).reduce((a, id) => a + (t.ranks[id] || 0), 0);
/**
 * { total, spent, free, paragon: { total, spent, free }, byBranch } — un punto por Nivel ganado (Nivel − 1). El árbol
 * entero pide TREE_POINTS: lo que se gana por encima pasa al paragon, junto con los puntos de pasado el Nivel 50.
 */
export function talentPoints(state) {
  const t = talentsState(state);
  const earned = leaderLevelFromXp(xpOf(state)) - 1;
  const total = Math.min(earned, TREE_POINTS);
  const spent = TALENT_IDS.reduce((a, id) => a + (t.ranks[id] || 0), 0);
  const pTotal = paragonPoints(xpOf(state)) + Math.max(0, earned - TREE_POINTS);
  const pSpent = BRANCH_IDS.reduce((a, b) => a + t.paragon[b], 0);
  return { total, spent, free: Math.max(0, total - spent), paragon: { total: pTotal, spent: pSpent, free: Math.max(0, pTotal - pSpent) },
    byBranch: Object.fromEntries(BRANCH_IDS.map(b => [b, spentIn(t, b)])) };
}
/** ¿Se puede subir ese talento? { ok, why } */
export function canLearn(state, id) {
  const T = TALENTS[id];
  if (!T) return { ok: false, why: TXT.maxed };
  const t = talentsState(state);
  if ((t.ranks[id] || 0) >= T.max) return { ok: false, why: TXT.maxed };
  if (spentIn(t, T.branch) < T.need) return { ok: false, why: TXT.needBranch(T.need, BRANCHES[T.branch].name) };
  if (talentPoints(state).free <= 0) return { ok: false, why: TXT.noPoints };
  return { ok: true };
}
export function learnTalent(state, id) {
  const c = canLearn(state, id);
  if (!c.ok) return c;
  const t = talentsState(state);
  t.ranks[id] = (t.ranks[id] || 0) + 1;
  return { ok: true, rank: t.ranks[id] };
}
/** Pone un punto de paragon en una rama. */
export function learnParagon(state, branch) {
  if (!BRANCHES[branch]) return { ok: false, why: TXT.maxed };
  if (talentPoints(state).paragon.free <= 0) return { ok: false, why: TXT.noParagon };
  const t = talentsState(state);
  t.paragon[branch]++;
  return { ok: true, points: t.paragon[branch] };
}
/** Devuelve todos los puntos (en la ciudad; gratis en el 2a). */
export function resetTalents(state) {
  const t = talentsState(state);
  t.ranks = {}; for (const b of BRANCH_IDS) t.paragon[b] = 0;
  return { ok: true };
}

/**
 * Lo que dan los talentos: { lider: {hp, atk, armor, flags}, squad: {hp, atk, armor, flags}, morale, mastery,
 * itemMastery, find, scrap, reroll, bossRarity }.
 */
export function talentMods(state) {
  const t = talentsState(state);
  const out = { lider: { hp: 0, atk: 0, armor: 0, flags: {} }, squad: { hp: 0, atk: 0, armor: 0, flags: {} },
    morale: 0, mastery: 0, itemMastery: 0, find: 0, scrap: 0, reroll: 0, bossRarity: 0 };
  const addUnit = (o, s, n) => {
    o.hp += (s.hp || 0) * n; o.atk += (s.atk || 0) * n; o.armor += (s.armor || 0) * n;
    for (const [k, v] of Object.entries(s.flags || {})) o.flags[k] = (o.flags[k] || 0) + v * n;
  };
  for (const id of TALENT_IDS) {
    const n = t.ranks[id] || 0;
    if (!n) continue;
    const T = TALENTS[id];
    if (T.lider) addUnit(out.lider, T.lider, n);
    if (T.squad) addUnit(out.squad, T.squad, n);
    for (const k of ['morale', 'mastery', 'itemMastery', 'find', 'scrap', 'reroll']) out[k] += (T[k] || 0) * n;
    if (T.bossRarity) out.bossRarity = Math.max(out.bossRarity, T.bossRarity);
  }
  const P = t.paragon;
  out.mastery += BRANCHES.mando.paragon.mastery * P.mando;
  out.lider.hp += Math.floor(P.supervivencia / BRANCHES.supervivencia.paragon.hpEvery);
  out.find += Math.min(BRANCHES.oficio.paragon.findMax, BRANCHES.oficio.paragon.find * P.oficio);
  return out;
}
