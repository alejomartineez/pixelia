// Misiones principales, diarias, logros y premio de login.
import { bus } from './bus.js';
import { store, todayStr, levelOf } from './state.js';
import { MAIN_QUESTS, DAILY_POOL, DAILY_BONUS_ALL, ACHIEVEMENTS, LOGIN_REWARDS, rewardScale } from './data.js';
import { population, happinessPoints, castleLevel, cityCharm, def, zonesExplored } from './economy.js';
import { streakWithShield, consumeStreakShield, seasonInfo } from '../season/season.js';

const S = () => store.state;
const changed = () => { store.markDirty(); bus.emit('quests:changed'); };

// ---------- helpers de objetivos ----------
function absoluteValue(goal) {
  const s = S();
  switch (goal.type) {
    case 'level': return levelOf(s);
    case 'pop': return population(s);
    case 'happy': return happinessPoints(s);
    case 'castle': return castleLevel(s);
    case 'charm': return cityCharm(s);
    case 'expand': return s.city.expansions;
    case 'threat': return s.stats.threats || 0;   // amenazas pasadas (simulacro incluido; src/threats/threats.js)
    // El Quiebre (E5, paso 6b): peleas ganadas (de un encuentro, o todas), elementos encontrados y marcas de la historia.
    // Son absolutos: una partida que ya lo hizo los cumple apenas le llegan, sin perder nada.
    case 'combat': {
      const w = s.combat?.wins || {};
      return goal.enc ? (w[goal.enc] || 0) : Object.values(w).reduce((a, n) => a + (Number(n) || 0), 0);
    }
    case 'element': return (s.story?.elements || []).includes(goal.id) ? 1 : 0;
    case 'flag': return s.story?.flags?.[goal.flag] ? 1 : 0;
    case 'zone': {
      if (!goal.region) return zonesExplored(s);
      const r = s.expedition?.regions?.[goal.region];
      return Math.max(0, Math.min(5, ((r && r.zone) || 1) - 1));
    }
    case 'build':
      if (goal.id || goal.ids) {
        const ids = goal.ids || [goal.id];
        return s.city.buildings.filter(b => ids.includes(b.id) && !b.buildEnd).length;
      }
      return null;
    default: return null;
  }
}
/** Cuánto avanza `goal` con un evento. Devuelve número a sumar (o, para score, valor a comparar). */
function eventDelta(goal, ev) {
  const { name, p } = ev;
  switch (goal.type) {
    case 'build': return name === 'building:built' && !goal.id && !goal.ids && def(p.b).cat !== 'camino' ? 1 : 0;
    case 'upgrade': return name === 'building:upgraded' && (!goal.id || p.b.id === goal.id) ? 1 : 0;
    case 'collect': return name === 'production:collected' && p.currency === 'coins' ? p.amount : 0;
    case 'earn': return name === 'coins:earned' ? p.amount : 0;
    case 'customize': return name === 'customize:changed' ? 1 : 0;
    case 'buy': return name === 'item:bought' ? 1 : 0;
    // expedición y Taller (DESIGN-CORE.md §6.1)
    case 'expedition': {
      if (name !== 'expedition:finished' || p.prototype) return 0;
      if (goal.kind && p.kind !== goal.kind) return 0;
      if (goal.region && p.region !== goal.region) return 0;
      if (goal.equip && !(p.equip || []).includes(goal.equip)) return 0;
      if (goal.minStars && (p.stars || 0) < goal.minStars) return 0;
      return 1;
    }
    case 'expStars': return name === 'expedition:finished' && !p.prototype ? (p.stars || 0) : 0;
    case 'expFar': return name === 'expedition:finished' && !p.prototype ? (p.far || 0) : 0;
    case 'prov': return name === 'production:collected' && p.currency === 'prov' ? p.amount : 0;
    case 'repair': return name === 'building:repaired' && p.paid ? 1 : 0;   // la vecindad (auto) no cuenta
    case 'craft': return name === 'craft:done' && (!goal.id || p.id === goal.id) ? (p.n || 1) : 0;
    default: return 0;
  }
}
function applyDelta(cur, d) {
  if (d && typeof d === 'object') return Math.max(cur, d.max);
  return cur + (d || 0);
}

// ---------- Principal ----------
// La cadena se sigue por id (state.quests.done): la misión actual es la primera de MAIN_QUESTS sin cobrar. Así una fase
// puede sumar misiones en el medio (t15–t17, Amenazas) sin correr las demás. state.quests.main queda como "cuántas van".
// Cadena vieja (antes de la Fase 2: minijuegos). quests.main era el índice en esta lista.
const OLD_MAIN = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12', 'm13', 'm14', 'm15', 'm16', 'm17',
  'm18', 'm19', 'm20', 'm21', 'm22', 'm23', 'm24', 'm25', 'm26', 'm27', 'm28'];
// Las que piden lo mismo en la cadena nueva: ya cobradas, no se repiten.
const OLD_TO_NEW = { m1: 't1', m2: 't9', m7: 't8', m13: 't12', m14: 't14' };
export const CHAIN_VERSION = 2;
/**
 * Pasa una partida a la cadena nueva (idempotente). Lo cobrado de la vieja no se repite; quien ya había avanzado
 * saltea sin premio las primeras misiones que ya cumple y arranca en la primera que no (DESIGN-CORE.md §7.2, punto 8).
 */
export function migrateQuestChain(s = S()) {
  const q = s.quests;
  if (!q.done || typeof q.done !== 'object') q.done = {};
  if ((q.chain || 0) >= CHAIN_VERSION) return false;
  const oldIdx = Math.max(0, q.main | 0);
  for (const id of OLD_MAIN.slice(0, oldIdx)) {
    if (MAIN_QUESTS.some(m => m.id === id)) q.done[id] = 1;
    if (OLD_TO_NEW[id]) q.done[OLD_TO_NEW[id]] = 1;
  }
  if (oldIdx > 0) {
    for (const m of MAIN_QUESTS) {
      if (q.done[m.id]) continue;
      const abs = absoluteValue(m.goal);
      if (abs === null || abs < m.goal.count) break;
      q.done[m.id] = 1;
    }
  }
  q.chain = CHAIN_VERSION;
  q.mainProgress = 0;
  q.main = MAIN_QUESTS.filter(m => q.done[m.id]).length;
  store.markDirty();
  return true;
}
function currentMain() {
  const done = S().quests.done || {};
  const index = MAIN_QUESTS.findIndex(m => !done[m.id]);
  return index < 0 ? null : { q: MAIN_QUESTS[index], index };
}
export function mainQuest() {
  const s = S();
  const cur = currentMain();
  if (!cur) return null;
  const { q, index } = cur;
  const abs = absoluteValue(q.goal);
  const progress = abs !== null ? abs : s.quests.mainProgress;
  return { ...q, index, total: MAIN_QUESTS.length, progress: Math.min(progress, q.goal.count), done: progress >= q.goal.count };
}
/** Cobra la misión principal si está cumplida. auto: cobro automático del tutorial (t1–t20, src/story/story.js). */
export function claimMain({ auto = false } = {}) {
  const q = mainQuest();
  if (!q || !q.done) return null;
  const s = S();
  s.quests.done[q.id] = 1;
  s.quests.main = MAIN_QUESTS.filter(m => s.quests.done[m.id]).length;
  s.quests.mainProgress = 0;
  store.grant(q.reward, 'quest');
  changed();
  bus.emit('quest:claimed', { id: q.id, title: q.title, reward: q.reward, auto });
  return q.reward;
}
/** ¿Esta misión principal ya se cobró? (para aperturas: Expedición en t4, Taller en t6, mapa de región en t11) */
export const mainDone = (id) => !!S().quests.done?.[id];

// ---------- Diarias ----------
function seededPick(seedStr, arr, n) {
  let h = 2166136261;
  for (const ch of seedStr) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
  const pool = [...arr];
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}
/** needs de una diaria: id de un edificio que tiene que existir, o 'damaged' (algún edificio dañado por una amenaza). */
function dailyNeedsOk(needs, s) {
  if (!needs) return true;
  if (needs === 'damaged') return s.city.buildings.some(b => b.damaged);
  return s.city.buildings.some(b => b.id === needs);
}
export function ensureDaily() {
  const s = S();
  const today = todayStr();
  if (s.quests.daily?.date === today) return;
  const pool = DAILY_POOL.filter(q => (q.minLevel || 1) <= levelOf(s) && dailyNeedsOk(q.needs, s));
  // "Repará un edificio" solo existe si hay alguno dañado, y en ese caso sale siempre (DESIGN-CORE.md §6.1)
  const forced = pool.filter(q => q.needs === 'damaged');
  const picks = [...forced, ...seededPick(today + s.created, pool.filter(q => !forced.includes(q)), 3 - forced.length)];
  // el objetivo escalado se congela al elegirlo: si subís de nivel a mitad del día no se aleja una misión ya cumplida
  s.quests.daily = { date: today, list: picks.map(q => ({ id: q.id, progress: 0, claimed: false, count: dailyCount(q, levelOf(s)) })), bonusClaimed: false };
  changed();
}
function dailyCount(q, level) {
  return q.scale ? Math.round(q.goal.count * rewardScale(level) / 10) * 10 : q.goal.count;
}
export function dailyQuests() {
  ensureDaily();
  const s = S();
  const scale = rewardScale(levelOf(s));
  return s.quests.daily.list.map(entry => {
    const q = DAILY_POOL.find(d => d.id === entry.id);
    if (!q) return null;
    const count = entry.count || dailyCount(q, levelOf(s));
    const reward = { ...q.reward };
    if (reward.coins) reward.coins = Math.round(reward.coins * scale);
    return { ...q, goal: { ...q.goal, count }, reward, progress: Math.min(entry.progress, count), done: entry.progress >= count, claimed: entry.claimed };
  }).filter(Boolean);
}
export function claimDaily(id) {
  const q = dailyQuests().find(d => d.id === id);
  if (!q || !q.done || q.claimed) return null;
  S().quests.daily.list.find(e => e.id === id).claimed = true;
  store.grant(q.reward, 'quest');
  changed();
  return q.reward;
}
export function dailyBonusStatus() {
  const list = dailyQuests();
  return { ready: list.every(q => q.claimed) && !S().quests.daily.bonusClaimed, claimed: S().quests.daily.bonusClaimed, reward: DAILY_BONUS_ALL };
}
export function claimDailyBonus() {
  const st = dailyBonusStatus();
  if (!st.ready) return null;
  S().quests.daily.bonusClaimed = true;
  store.grant(DAILY_BONUS_ALL, 'quest');
  changed();
  return DAILY_BONUS_ALL;
}

// ---------- Logros ----------
export function achievements() {
  const s = S();
  // los de los minijuegos retirados quedan como "Recuerdos" con lo ganado (y no aparecen si no se ganó ninguno)
  return ACHIEVEMENTS.filter(a => !a.retired || (s.quests.achTier[a.id] || 0) > 0).map(a => {
    const tier = s.quests.achTier[a.id] || 0; // cantidad de tiers ya cobrados
    if (a.retired) return { ...a, tier, value: s.stats[a.stat] || 0, target: a.tiers[Math.max(0, tier - 1)], maxed: true, memory: true, ready: false, reward: 0, label: 'Recuerdo de los minijuegos' };
    const value = s.stats[a.stat] || 0;
    const maxed = tier >= a.tiers.length;
    const target = maxed ? a.tiers[a.tiers.length - 1] : a.tiers[tier];
    return { ...a, tier, value, target, maxed, ready: !maxed && value >= target, reward: maxed ? 0 : a.reward[tier], label: a.desc.replace('{n}', target.toLocaleString('es-AR')) };
  });
}
export function claimAchievement(id) {
  const a = achievements().find(x => x.id === id);
  if (!a || !a.ready) return null;
  S().quests.achTier[id] = a.tier + 1;
  const reward = { gems: a.reward, xp: 20 * (a.tier + 1) };
  store.grant(reward, 'achievement');
  changed();
  return reward;
}

// ---------- Login diario ----------
/**
 * Devuelve {streak, day(1..7), reward, all, shielded} si hay premio para cobrar hoy, si no null.
 * Racha que perdona: si faltaste un solo día y queda el escudo de la semana, la racha sigue (shielded: true).
 */
export function loginStatus() {
  const s = S();
  const today = todayStr();
  if (s.login.last === today) return null;
  const { streak, shielded } = streakWithShield(s.login);
  const day = ((streak - 1) % LOGIN_REWARDS.length) + 1;
  return { streak, day, reward: LOGIN_REWARDS[day - 1], all: LOGIN_REWARDS, shielded };
}
export function claimLogin() {
  const st = loginStatus();
  if (!st) return null;
  const s = S();
  if (st.shielded) consumeStreakShield();
  s.login.last = todayStr();
  s.login.streak = st.streak;
  store.setMax('bestStreak', st.streak);
  store.grant(st.reward, 'login');
  changed();
  return st.reward;
}

/** Cantidad de cosas para cobrar (para el globito del botón Misiones). */
export function claimableCount() {
  let n = 0;
  if (mainQuest()?.done) n++;
  n += dailyQuests().filter(q => q.done && !q.claimed).length;
  if (dailyBonusStatus().ready) n++;
  n += achievements().filter(a => a.ready).length;
  return n;
}

// ---------- Escucha de eventos ----------
const TRACKED = ['building:built', 'building:upgraded', 'production:collected', 'coins:earned', 'customize:changed', 'item:bought',
  'expedition:finished', 'craft:done', 'building:repaired'];
// eventos que no cuentan para nada pero cambian una misión absoluta (combate, elementos, historia): refrescan la tarjeta
const REFRESH = ['level:up', 'city:expanded', 'building:upgraded', 'expedition:zone', 'combat:won', 'reward:element', 'story:faro', 'story:flag'];
export function initQuests() {
  migrateQuestChain();
  ensureDaily();
  // logro "Estrella de Temporada": mejor nivel del pase alcanzado (sobrevive al cambio de temporada)
  try { store.setMax('seasonLevelBest', seasonInfo().level); } catch {}
  bus.on('season:level', ({ level } = {}) => { if (level) store.setMax('seasonLevelBest', level); bus.emit('quests:changed'); });
  for (const ev of ['chests:changed', 'album:changed']) bus.on(ev, () => bus.emit('quests:changed'));
  bus.on('*', ({ name, payload }) => {
    if (!TRACKED.includes(name)) {
      if (REFRESH.includes(name)) bus.emit('quests:changed');
      return;
    }
    const s = S();
    const ev = { name, p: payload };
    const mq = currentMain()?.q;
    if (mq && absoluteValue(mq.goal) === null) {
      const d = eventDelta(mq.goal, ev);
      if (d) s.quests.mainProgress = applyDelta(s.quests.mainProgress, d);
    }
    ensureDaily();
    for (const entry of s.quests.daily.list) {
      const q = DAILY_POOL.find(x => x.id === entry.id);
      if (!q || entry.claimed) continue;
      const d = eventDelta(q.goal, ev);
      if (d) entry.progress = applyDelta(entry.progress, d);
    }
    changed();
  });
}
