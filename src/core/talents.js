// Talentos (La Travesía, paso 2a): un punto por cada Nivel ganado, en un árbol corto de 3 ramas, y puntos de paragon
// pasado el Nivel 50. Puro: sin DOM, sin store ni bus. El estado vive en state.talents = { ranks: { id: n },
// paragon: { mando: n, … } }; los puntos se calculan del Nivel (no se guardan). Diseño: DESIGN-COMBAT.md §18.3.
import { leaderLevelFromXp, paragonPoints, NIVEL } from '../combat/classes.js';
import { t, tn } from './i18n.js';

/** Los textos (claves talents.* de src/i18n/es.js): getters y funciones, para que salgan en el idioma de ese momento. */
export const TXT = {
  get noPoints() { return t('talents.noPoints'); }, get maxed() { return t('talents.maxed'); },
  needBranch: (n, b) => tn('talents.needBranch', n, { branch: b }),
  get noParagon() { return t('talents.noParagon', { max: NIVEL.max }); },
};
/** Getter de texto (enumerable) que se resuelve al leerlo: las tablas se arman antes de elegir idioma. */
const textProp = (o, field, key) => Object.defineProperty(o, field, { get: () => t(key), enumerable: true, configurable: true });

/**
 * Ramas. Cada talento: max rangos, need = puntos que pide gastados antes en la rama, y lo que da por rango.
 * Efectos chicos y visibles: el combate (lider/squad: vida, ataque, coraza, pasivas por flag), la travesía (ánimo,
 * maestría, hallazgo de armas) y el Taller (desarmar, rehacer rasgos, rareza del arma del jefe).
 */
export const BRANCHES = {
  mando: { id: 'mando', paragon: { mastery: 0.02 } },
  supervivencia: { id: 'supervivencia', paragon: { hpEvery: 5 } },
  oficio: { id: 'oficio', paragon: { find: 0.005, findMax: 0.15 } },
};
// talents.branch.<id>.name, .text, .paragon y .paragonText
for (const B of Object.values(BRANCHES)) {
  textProp(B, 'name', `talents.branch.${B.id}.name`); textProp(B, 'text', `talents.branch.${B.id}.text`);
  textProp(B.paragon, 'name', `talents.branch.${B.id}.paragon`); textProp(B.paragon, 'text', `talents.branch.${B.id}.paragonText`);
}
export const BRANCH_IDS = Object.keys(BRANCHES);
export const TALENTS = {
  // Mando
  mando_vida: { id: 'mando_vida', branch: 'mando', max: 3, need: 0, lider: { hp: 1 } },
  mando_maestria: { id: 'mando_maestria', branch: 'mando', max: 5, need: 0, mastery: 0.1 },
  mando_voz: { id: 'mando_voz', branch: 'mando', max: 3, need: 4, squad: { hp: 1 } },
  mando_filo: { id: 'mando_filo', branch: 'mando', max: 1, need: 8, lider: { atk: 1 } },
  mando_muro: { id: 'mando_muro', branch: 'mando', max: 1, need: 12, lider: { flags: { wallPlus: 1 } } },
  // Supervivencia
  sup_animo: { id: 'sup_animo', branch: 'supervivencia', max: 2, need: 0, morale: 1 },
  sup_cuero: { id: 'sup_cuero', branch: 'supervivencia', max: 3, need: 0, lider: { hp: 1 } },
  sup_vigia: { id: 'sup_vigia', branch: 'supervivencia', max: 1, need: 4, lider: { flags: { intentPlus: 1 } } },
  sup_curas: { id: 'sup_curas', branch: 'supervivencia', max: 2, need: 5, lider: { flags: { healPlus: 1 } } },
  sup_coraza: { id: 'sup_coraza', branch: 'supervivencia', max: 1, need: 10, lider: { armor: 1 } },
  sup_botin: { id: 'sup_botin', branch: 'supervivencia', max: 1, need: 12, lider: { flags: { lootWin: 1 } } },
  // Oficio
  of_desarme: { id: 'of_desarme', branch: 'oficio', max: 3, need: 0, scrap: 1 },
  of_hallazgo: { id: 'of_hallazgo', branch: 'oficio', max: 3, need: 0, find: 0.03 },
  of_rehacer: { id: 'of_rehacer', branch: 'oficio', max: 3, need: 4, reroll: 0.1 },
  of_taller: { id: 'of_taller', branch: 'oficio', max: 3, need: 4, itemMastery: 0.2 },
  of_jefe: { id: 'of_jefe', branch: 'oficio', max: 1, need: 12, bossRarity: 2 },
};
for (const T of Object.values(TALENTS)) { textProp(T, 'name', `talents.${T.id}.name`); textProp(T, 'text', `talents.${T.id}.text`); }
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
