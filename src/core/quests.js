// Misiones principales, diarias, logros y premio de login.
import { bus } from './bus.js';
import { store, todayStr } from './state.js';
import { MAIN_QUESTS, DAILY_POOL, DAILY_BONUS_ALL, ACHIEVEMENTS, LOGIN_REWARDS, rewardScale } from './data.js';
import { population, happinessPoints, castleLevel, cityCharm, def } from './economy.js';
import { streakWithShield, consumeStreakShield, seasonInfo } from '../season/season.js';

const S = () => store.state;
const changed = () => { store.markDirty(); bus.emit('quests:changed'); };

// ---------- helpers de objetivos ----------
function absoluteValue(goal) {
  const s = S();
  switch (goal.type) {
    case 'level': return s.player.level;
    case 'pop': return population(s);
    case 'happy': return happinessPoints(s);
    case 'castle': return castleLevel(s);
    case 'charm': return cityCharm(s);
    case 'expand': return s.city.expansions;
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
    case 'play': return name === 'minigame:finished' && (!goal.game || p.game === goal.game) ? 1 : 0;
    case 'stars': return name === 'minigame:finished' && (!goal.game || p.game === goal.game) ? (p.stars || 0) : 0;
    case 'score': return name === 'minigame:finished' && p.game === goal.game ? { max: p.score || 0 } : 0;
    case 'customize': return name === 'customize:changed' ? 1 : 0;
    case 'buy': return name === 'item:bought' ? 1 : 0;
    default: return 0;
  }
}
function applyDelta(cur, d) {
  if (d && typeof d === 'object') return Math.max(cur, d.max);
  return cur + (d || 0);
}

// ---------- Principal ----------
export function mainQuest() {
  const s = S();
  const q = MAIN_QUESTS[s.quests.main];
  if (!q) return null;
  const abs = absoluteValue(q.goal);
  const progress = abs !== null ? abs : s.quests.mainProgress;
  return { ...q, index: s.quests.main, total: MAIN_QUESTS.length, progress: Math.min(progress, q.goal.count), done: progress >= q.goal.count };
}
export function claimMain() {
  const q = mainQuest();
  if (!q || !q.done) return null;
  const s = S();
  s.quests.main++;
  s.quests.mainProgress = 0;
  store.grant(q.reward, 'quest');
  changed();
  return q.reward;
}

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
export function ensureDaily() {
  const s = S();
  const today = todayStr();
  if (s.quests.daily?.date === today) return;
  const pool = DAILY_POOL.filter(q => (q.minLevel || 1) <= s.player.level);
  const picks = seededPick(today + s.created, pool, 3);
  // el objetivo escalado se congela al elegirlo: si subís de nivel a mitad del día no se aleja una misión ya cumplida
  s.quests.daily = { date: today, list: picks.map(q => ({ id: q.id, progress: 0, claimed: false, count: dailyCount(q, s.player.level) })), bonusClaimed: false };
  changed();
}
function dailyCount(q, level) {
  return q.scale ? Math.round(q.goal.count * rewardScale(level) / 10) * 10 : q.goal.count;
}
export function dailyQuests() {
  ensureDaily();
  const s = S();
  const scale = rewardScale(s.player.level);
  return s.quests.daily.list.map(entry => {
    const q = DAILY_POOL.find(d => d.id === entry.id);
    if (!q) return null;
    const count = entry.count || dailyCount(q, s.player.level);
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
  return ACHIEVEMENTS.map(a => {
    const tier = s.quests.achTier[a.id] || 0; // cantidad de tiers ya cobrados
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
const TRACKED = ['building:built', 'building:upgraded', 'production:collected', 'coins:earned', 'minigame:finished', 'customize:changed', 'item:bought'];
export function initQuests() {
  ensureDaily();
  // logro "Estrella de Temporada": mejor nivel del pase alcanzado (sobrevive al cambio de temporada)
  try { store.setMax('seasonLevelBest', seasonInfo().level); } catch {}
  bus.on('season:level', ({ level } = {}) => { if (level) store.setMax('seasonLevelBest', level); bus.emit('quests:changed'); });
  for (const ev of ['chests:changed', 'album:changed']) bus.on(ev, () => bus.emit('quests:changed'));
  bus.on('*', ({ name, payload }) => {
    if (!TRACKED.includes(name)) {
      if (name === 'level:up' || name === 'city:expanded' || name === 'building:upgraded') bus.emit('quests:changed');
      return;
    }
    const s = S();
    const ev = { name, p: payload };
    const mq = MAIN_QUESTS[s.quests.main];
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
