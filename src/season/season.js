// Pase de Temporada (28 días, 30 niveles gratis), bienvenida de vuelta y escudo de racha.
// Contrato: DESIGN-RETENTION.md → "Temporada". UI en season-ui.js (openSeasonPass, openWelcomeBack).
// Estado en store.state.season. Todas las funciones con fecha aceptan `now` opcional (ms o Date) para pruebas.
import { bus } from '../core/bus.js';
import { store, todayStr } from '../core/state.js';
import { CUSTOM_CATALOG, BUILDING_BY_ID, rewardScale, fitsType, MATERIAL_BY_ID } from '../core/data.js';
import { monumentBonus } from '../core/monuments.js';
import { toast } from '../core/ui.js';
import { audio } from '../core/audio.js';
import { ITEMS, CHESTS } from '../chests/chests.js';
import {
  EPOCH, SEASON_DAYS, MAX_TIER, BONUS_EVERY, THEMES, TIER_COST, TIERS, COSMETIC_FALLBACK_GEMS, POINTS, WELCOME,
} from './season-data.js';

export { THEMES, TIERS, MAX_TIER, POINTS, BONUS_EVERY };

const DAY = 864e5;

// ---------- Fechas (hora local) ----------
export const toMs = (now) => (now == null ? Date.now() : +now);
/** ms del día `n` contado desde la época (00:00 local; respeta cambios de horario). */
export const epochDay = (n) => new Date(EPOCH.y, EPOCH.m, EPOCH.d + n).getTime();
/** Días calendario (locales) desde la época. Negativo si es antes. */
export function dayIndex(now) {
  const d = new Date(toMs(now));
  const mid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((mid - new Date(EPOCH.y, EPOCH.m, EPOCH.d)) / DAY);
}
/** Semana desde la época (lunes a domingo). */
export const weekIndex = (now) => Math.floor(dayIndex(now) / 7);
/** Clave de semana ISO, p.ej. "2026-W45". */
export function isoWeekKey(now) {
  const d = new Date(toMs(now));
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((t - y0) / DAY + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}
export const seasonIndexAt = (now) => Math.max(0, Math.floor(dayIndex(now) / SEASON_DAYS));
export function seasonBounds(index) {
  return { start: epochDay(index * SEASON_DAYS), end: epochDay((index + 1) * SEASON_DAYS) };
}
export const themeFor = (index) => THEMES[((index % THEMES.length) + THEMES.length) % THEMES.length];
/** "27d 14h" | "5h 20m" | "12m" */
export function fmtLeft(ms) {
  ms = Math.max(0, ms);
  const m = Math.floor(ms / 60e3), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ${h % 24}h`;
  if (h >= 1) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  return `${Math.max(1, m)}m`;
}

// ---------- Niveles ----------
const CUM = []; // CUM[i] = chispas totales para llegar al nivel i+1
TIER_COST.reduce((acc, c, i) => (CUM[i] = acc + c), 0);
export const TOTAL_POINTS = CUM[MAX_TIER - 1];
export const levelFor = (points) => CUM.filter(c => c <= points).length;
/** Chispas acumuladas necesarias para llegar al nivel n (1..30). */
export const pointsForTier = (n) => CUM[n - 1];

// ---------- Estado ----------
const S = () => store.state;
function ss() {
  const s = S();
  if (!s.season || typeof s.season !== 'object') s.season = {};
  const z = s.season;
  z.id ??= null;                       // número de temporada (1, 2, …)
  z.points ??= 0;
  if (!Array.isArray(z.claimed)) z.claimed = [];
  z.bonus ??= 0;                       // cofres extra (post nivel 30) ya cobrados
  z.daily ??= { date: '', collectPts: 0 };
  z.shield ??= { week: '', used: false };
  z.welcome ??= {};
  z.lastEnd ??= null;                  // resumen del cofre de fin de temporada
  z.lifetime ??= 0;
  if (!z.got || typeof z.got !== 'object') z.got = {}; // partes cobradas por nivel (para mostrarlas igual después)
  return z;
}

// ---------- Premios ----------
function premiumCatalog() {
  const out = [];
  for (const [kind, list] of Object.entries(CUSTOM_CATALOG))
    for (const it of list) if (!it.free && it.price?.gems) out.push({ kind, id: it.id, name: it.name, gems: it.price.gems, unlock: it.unlock || 1 });
  return out.sort((a, b) => a.unlock - b.unlock || a.gems - b.gems);
}
const AVATAR_KINDS = ['dress', 'hair', 'crown', 'acc'];
/** Qué prenda premium toca en cada nivel especial no cobrado (sin repetir dentro de la temporada). */
function cosmeticPlan(index, claimed) {
  const free = premiumCatalog().filter(c => !store.owns(c.kind, c.id));
  const plan = {};
  TIERS.forEach((t, i) => {
    const n = i + 1;
    if (!t.cosmetic || claimed.includes(n) || !free.length) return;
    // preferimos prendas que le sirvan a su personaje (más emoción); si ya tiene todas, piezas del esquife (si no, gemas)
    const type = S().avatar?.type;
    const mine = free.filter(c => AVATAR_KINDS.includes(c.kind) && fitsType(CUSTOM_CATALOG[c.kind].find(i => i.id === c.id), type));
    const pool = mine.length ? mine : free.filter(c => !AVATAR_KINDS.includes(c.kind));
    if (!pool.length) return;
    const pick = pool[(index * 5 + n * 3) % pool.length];
    free.splice(free.indexOf(pick), 1);
    plan[n] = pick;
  });
  return plan;
}

/**
 * Convierte la definición de un nivel en partes concretas (montos escalados, prenda elegida).
 * Partes: {kind:'coins'|'gems', amount} | {kind:'chest', type, n} | {kind:'stickers', n, minStars}
 *       | {kind:'item', id, n, name, icon} | {kind:'cosmetic', target, id, name} (o gemas si ya tiene todo)
 *       | {kind:'mats', id, n, name, icon} (materiales de región) | {kind:'equip', id, n, name, icon} (equipo de expedición)
 *       | {kind:'planos', n, name, icon} (planos de época)
 */
function resolveTier(n, index, plan) {
  const t = TIERS[n - 1];
  const lvl = S().player.level;
  const parts = [];
  if (t.cosmetic) {
    const c = plan[n];
    if (c) parts.push({ kind: 'cosmetic', target: c.kind, id: c.id, name: c.name });
    else parts.push({ kind: 'gems', amount: COSMETIC_FALLBACK_GEMS, note: 'Ya tenés todas las prendas premium' });
  }
  if (t.coins) parts.push({ kind: 'coins', amount: Math.round(t.coins * rewardScale(lvl)) });
  if (t.gems) parts.push({ kind: 'gems', amount: t.gems });
  if (t.chest) parts.push({ kind: 'chest', type: t.chest, n: 1, name: CHESTS[t.chest]?.name || 'Cofre' });
  if (t.stickers) parts.push({ kind: 'stickers', n: t.stickers.n, minStars: t.stickers.minStars || 1 });
  for (const [id, k] of Object.entries(t.items || {})) parts.push({ kind: 'item', id, n: k, name: ITEMS[id]?.name || id, icon: ITEMS[id]?.icon || 'gift' });
  for (const [id, k] of Object.entries(t.equip || {})) parts.push({ kind: 'equip', id, n: k, name: EQUIP_LOOK[id]?.name || id, icon: EQUIP_LOOK[id]?.icon || '🎒' });
  if (t.planos) parts.push({ kind: 'planos', n: t.planos, name: t.planos === 1 ? 'Plano' : 'Planos', icon: '📜' });
  for (const [id, k] of Object.entries(t.mats || {})) parts.push({ kind: 'mats', id, n: k, name: MATERIAL_BY_ID[id]?.name || id, icon: MATERIAL_BY_ID[id]?.icon || 'gift' });
  return parts;
}

function addBackpackItem(id, n) {
  const s = S();
  s.chests ??= {};
  s.chests.items ??= {};
  s.chests.items[id] = (s.chests.items[id] || 0) + n;
  store.markDirty();
  bus.emit('chests:changed', { item: id, n, source: 'season' });
}

/** Acredita partes ya resueltas. */
function grantParts(parts, source = 'season') {
  const money = { coins: 0, gems: 0 };
  for (const p of parts) {
    if (p.kind === 'coins' || p.kind === 'gems') money[p.kind] += p.amount;
    else if (p.kind === 'chest') bus.emit('reward:chest', { type: p.type, n: p.n || 1, source });
    else if (p.kind === 'stickers') bus.emit('reward:stickers', { n: p.n, minStars: p.minStars || 1, source });
    else if (p.kind === 'item') addBackpackItem(p.id, p.n);
    else if (p.kind === 'mats') store.grant({ mats: { [p.id]: p.n } }, source);
    else if (p.kind === 'equip') store.grant({ equip: { [p.id]: p.n } }, source);
    else if (p.kind === 'planos') store.grant({ planos: p.n }, source);
    else if (p.kind === 'cosmetic') {
      const owned = S().owned;
      (owned[p.target] ||= []);
      if (!owned[p.target].includes(p.id)) owned[p.target].push(p.id);
      store.inc('bought');
      bus.emit('item:unlocked', { kind: p.target, id: p.id, source });
    }
  }
  if (money.coins || money.gems) store.grant(money, source);
  store.markDirty();
}

/** Suma partes iguales (para el resumen del cofre de fin de temporada). */
function mergeParts(list) {
  const out = [];
  for (const p of list) {
    const same = out.find(o => o.kind === p.kind && (p.kind === 'coins' || p.kind === 'gems' ||
      (p.kind === 'chest' && o.type === p.type) || ((p.kind === 'item' || p.kind === 'mats') && o.id === p.id) ||
      (p.kind === 'stickers' && o.minStars === p.minStars) || p.kind === 'planos'));
    if (!same || p.kind === 'cosmetic') { out.push({ ...p }); continue; }
    if ('amount' in p) same.amount += p.amount; else same.n += p.n;
  }
  return out;
}

// ---------- Temporada actual / cambio de temporada ----------
function bonusState(z) {
  const extra = Math.max(0, z.points - TOTAL_POINTS);
  const earned = Math.floor(extra / BONUS_EVERY);
  return { every: BONUS_EVERY, progress: extra % BONUS_EVERY, earned, claimable: Math.max(0, earned - z.bonus), unlocked: z.points >= TOTAL_POINTS };
}

/** Si cambió la temporada, acredita lo no cobrado en el "cofre de fin de temporada" y reinicia. */
function ensureSeason(now) {
  const z = ss();
  const cur = seasonIndexAt(now) + 1;
  if (z.id === cur) return z;
  if (z.id == null) { z.id = cur; store.markDirty(); return z; }
  const oldIndex = z.id - 1;
  const level = levelFor(z.points);
  const plan = cosmeticPlan(oldIndex, z.claimed);
  let parts = [];
  for (let n = 1; n <= level; n++) if (!z.claimed.includes(n)) parts.push(...resolveTier(n, oldIndex, plan));
  const bonus = bonusState(z).claimable;
  if (bonus) parts.push({ kind: 'chest', type: 'madera', n: bonus, name: CHESTS.madera?.name || 'Cofre de Madera' });
  parts = mergeParts(parts);
  if (parts.length) grantParts(parts, 'season');
  z.lastEnd = { id: z.id, themeId: themeFor(oldIndex).id, level, points: z.points, parts, seen: false };
  z.id = cur; z.points = 0; z.claimed = []; z.bonus = 0; z.got = {};
  store.markDirty();
  store.save();
  bus.emit('season:rollover', { id: cur, lastEnd: z.lastEnd });
  bus.emit('season:changed', { reason: 'rollover' });
  return z;
}

// ---------- API ----------
/**
 * Info completa de la temporada.
 * → { id, index, theme, startsAt, endsAt, endsInMs, endsIn (texto), day (1..28), level, maxLevel, points,
 *     need (chispas del próximo nivel), into (chispas dentro del nivel), pct, rewards: [{n, cost, at, parts, special, state}],
 *     claimable: [n], bonus: {every, progress, earned, claimable, unlocked}, lastEnd }
 */
export function seasonInfo(now) {
  const t = toMs(now);
  const z = ensureSeason(t);
  const index = z.id - 1;
  const { start, end } = seasonBounds(index);
  const level = levelFor(z.points);
  const maxed = level >= MAX_TIER;
  const bonus = bonusState(z);
  const need = maxed ? BONUS_EVERY : TIER_COST[level];
  const into = maxed ? bonus.progress : z.points - (level ? CUM[level - 1] : 0);
  const plan = cosmeticPlan(index, z.claimed);
  const rewards = TIERS.map((tier, i) => {
    const n = i + 1;
    const claimed = z.claimed.includes(n);
    return { n, cost: TIER_COST[i], at: CUM[i], parts: (claimed && z.got[n]) || resolveTier(n, index, plan), special: !!tier.special,
      state: claimed ? 'claimed' : n <= level ? 'claimable' : n === level + 1 ? 'next' : 'locked' };
  });
  return {
    id: z.id, index, theme: themeFor(index), startsAt: start, endsAt: end, endsInMs: end - t, endsIn: fmtLeft(end - t),
    day: Math.min(SEASON_DAYS, Math.max(1, Math.floor((t - start) / DAY) + 1)),
    level, maxLevel: MAX_TIER, points: z.points, need, into, pct: Math.min(1, into / need),
    rewards, claimable: rewards.filter(r => r.state === 'claimable').map(r => r.n), bonus, lastEnd: z.lastEnd,
  };
}

/** Niveles alcanzados y sin cobrar. */
export function claimableTiers(now) {
  const z = ensureSeason(toMs(now));
  const level = levelFor(z.points);
  const out = [];
  for (let n = 1; n <= level; n++) if (!z.claimed.includes(n)) out.push(n);
  return out;
}

/** Cobra el nivel n. Devuelve {n, parts} o null. */
export function claimTier(n, now) {
  const z = ensureSeason(toMs(now));
  n = Number(n);
  if (!(n >= 1 && n <= MAX_TIER) || n > levelFor(z.points) || z.claimed.includes(n)) return null;
  const parts = resolveTier(n, z.id - 1, cosmeticPlan(z.id - 1, z.claimed));
  grantParts(parts, 'season');
  z.claimed.push(n);
  z.got[n] = parts;
  store.markDirty();
  store.save();
  bus.emit('season:claimed', { n, parts });
  bus.emit('season:changed', { reason: 'claim' });
  return { n, parts, special: !!TIERS[n - 1].special };
}

/** Cofres extra después del nivel 30 (uno cada 150 chispas). Devuelve cantidad cobrada. */
export function claimSeasonBonus(now) {
  const z = ensureSeason(toMs(now));
  const b = bonusState(z);
  if (!b.claimable) return 0;
  z.bonus = b.earned;
  bus.emit('reward:chest', { type: 'madera', n: b.claimable, source: 'season' });
  store.markDirty();
  store.save();
  bus.emit('season:changed', { reason: 'bonus' });
  return b.claimable;
}

/** Cobra todo lo disponible. Devuelve {tiers:[{n, parts}], bonus, parts (sumadas)}. */
export function claimAllTiers(now) {
  const tiers = [];
  for (const n of claimableTiers(now)) { const r = claimTier(n, now); if (r) tiers.push(r); }
  const bonus = claimSeasonBonus(now);
  const all = tiers.flatMap(r => r.parts);
  if (bonus) all.push({ kind: 'chest', type: 'madera', n: bonus, name: CHESTS.madera?.name });
  return { tiers, bonus, parts: mergeParts(all) };
}

/** Suma chispas. Devuelve {added, points, level, leveledUp} o null. */
export function addSeasonPoints(n, reason = '', now, { silent = false } = {}) {
  n = Math.round(Number(n) || 0);
  if (n <= 0) return null;
  const z = ensureSeason(toMs(now));
  const before = levelFor(z.points);
  const bonusBefore = bonusState(z).earned;
  z.points += n;
  z.lifetime += n;
  const level = levelFor(z.points);
  store.markDirty();
  bus.emit('season:points', { added: n, reason, points: z.points, level });
  bus.emit('season:changed', { reason: 'points' });
  if (level > before) {
    bus.emit('season:level', { level, from: before });
    if (!silent) { try { audio.sfx('star'); toast(`¡Pase de Temporada: nivel ${level}! Pasá a cobrar`, { icon: 'sparkle', type: 'good' }); } catch {} }
  } else if (level >= MAX_TIER && bonusState(z).earned > bonusBefore && !silent) {
    try { toast('¡Cofre extra del Pase listo para cobrar!', { icon: 'gift', type: 'good' }); } catch {}
  }
  return { added: n, points: z.points, level, leveledUp: level > before };
}

/** Badge del botón Pase: niveles por cobrar + cofres extra + resumen de fin de temporada sin ver. */
export function seasonBadge(now) {
  const z = ensureSeason(toMs(now));
  return claimableTiers(now).length + bonusState(z).claimable + (z.lastEnd && !z.lastEnd.seen ? 1 : 0);
}
export function seasonEndSummary() { return ss().lastEnd; }
export function ackSeasonEnd() {
  const z = ss();
  if (z.lastEnd && !z.lastEnd.seen) { z.lastEnd.seen = true; store.markDirty(); bus.emit('season:changed', { reason: 'ack' }); }
}

let lastExp = null;
/** Chispas ganadas en la última expedición terminada (para el resumen de la vuelta). {pts, at} | null */
export function lastExpeditionPoints() { return lastExp; }
// nombre e ícono del equipo para las partes del Pase (los datos de expedición viven en exp-data.js)
const EQUIP_LOOK = { cuerda: { name: 'Cuerda', icon: '🪢' }, pala: { name: 'Pala', icon: '🪏' }, lona: { name: 'Lona', icon: '⛺' }, farol: { name: 'Farol', icon: '🏮' }, botiquin: { name: 'Botiquín', icon: '🩹' }, carreta: { name: 'Carreta', icon: '🛒' } };

// ---------- Bienvenida de vuelta ----------
let awayFrom = null;   // lastSeen capturado ANTES del autoguardado
let hiddenAt = null;

/** {days, reward:{coins, gems}, chests, title, message} si corresponde regalo de bienvenida; si no null. */
export function welcomeBackStatus(now) {
  const t = toMs(now);
  if (!S() || !awayFrom) return null;
  const z = ss();
  const days = Math.floor((t - awayFrom) / DAY);
  if (days < WELCOME.minDays || z.welcome.from === awayFrom) return null;
  const counted = Math.min(days, WELCOME.maxDays);
  const big = days >= WELCOME.bigDays;
  const reward = { coins: Math.round(WELCOME.coinsPerDay * counted * rewardScale(S().player.level)), gems: big ? WELCOME.bigGems : 0 };
  const name = S().player.name || 'Pixelín';
  const message = days >= 14 ? `${name}, tanto tiempo. El vecindario cuidó tu ciudad mientras no estabas y te juntó un regalo.`
    : days >= 7 ? `Volviste, ${name}. En el barrio regaron las flores y te guardaron algo.`
      : `Hola de nuevo, ${name}. Te guardamos un regalo mientras no estabas.`;
  return { days, counted, reward, chests: big ? 2 : 1, chestType: 'madera', title: 'Bienvenida de vuelta', message };
}
/** Acredita el regalo de bienvenida. Devuelve el status cobrado o null. */
export function claimWelcomeBack(now) {
  const st = welcomeBackStatus(now);
  if (!st) return null;
  const z = ss();
  z.welcome = { from: awayFrom, at: toMs(now), days: st.days };
  store.grant(st.reward, 'welcome');
  bus.emit('reward:chest', { type: st.chestType, n: st.chests, source: 'welcome' });
  store.markDirty();
  store.save();
  bus.emit('season:welcomeClaimed', st);
  return st;
}

// ---------- Racha flexible ----------
/** ¿Queda el escudo de esta semana ISO? */
export function streakShieldAvailable(now) {
  const z = ss();
  return z.shield.week !== isoWeekKey(now) || !z.shield.used;
}
/** Gasta el escudo de la semana. true si se pudo. */
export function consumeStreakShield(now) {
  if (!streakShieldAvailable(now)) return false;
  const z = ss();
  z.shield = { week: isoWeekKey(now), used: true, date: todayStr(new Date(toMs(now))) };
  store.markDirty();
  bus.emit('season:shield', { week: z.shield.week });
  return true;
}
/**
 * Ayuda para quests.loginStatus: calcula la racha usando el escudo si faltó exactamente 1 día.
 * login = state.login {last, streak}. → {streak, shielded}
 */
export function streakWithShield(login, now) {
  const t = toMs(now);
  const ago = (k) => { const d = new Date(t); d.setDate(d.getDate() - k); return todayStr(d); };
  if (login?.last === ago(0)) return { streak: login.streak || 1, shielded: false };
  if (login?.last === ago(1)) return { streak: (login.streak || 0) + 1, shielded: false };
  if (login?.last === ago(2) && streakShieldAvailable(t)) return { streak: (login.streak || 0) + 1, shielded: true };
  return { streak: 1, shielded: false };
}

// ---------- Fuentes de chispas (bus) ----------
let inited = false;
let snap = null;
function questSnap() {
  const s = S();
  const d = s.quests?.daily;
  return { st: s, main: s.quests?.main || 0, date: d?.date || '', claimed: d?.list?.filter(e => e.claimed).length || 0, bonus: !!d?.bonusClaimed };
}
function onQuestsChanged() {
  const cur = questSnap();
  const prev = snap;
  snap = cur;
  if (!prev || prev.st !== cur.st) return; // partida nueva/importada: sólo re-sincroniza
  if (cur.main > prev.main) addSeasonPoints(POINTS.mainQuest * (cur.main - prev.main), 'mainQuest');
  if (cur.date === prev.date) {
    if (cur.claimed > prev.claimed) addSeasonPoints(POINTS.dailyQuest * (cur.claimed - prev.claimed), 'dailyQuest');
    if (cur.bonus && !prev.bonus) addSeasonPoints(POINTS.dailyBonus, 'dailyBonus');
  }
}
function countNewStickers(p) {
  if (!p || typeof p !== 'object') return 0;
  for (const k of ['newCount', 'newOnes', 'news']) if (typeof p[k] === 'number') return p[k];
  for (const k of ['stickers', 'added', 'drops', 'granted', 'list'])
    if (Array.isArray(p[k])) return p[k].filter(x => x && x.isNew).length;
  return p.isNew ? 1 : 0;
}

/**
 * Llamar UNA vez en el arranque, justo después de store.load() (antes de cualquier store.save()),
 * para capturar lastSeen de la bienvenida. Es idempotente.
 */
export function initSeason(now) {
  if (!S()) { console.warn('initSeason: llamalo después de store.load()'); return; }
  if (awayFrom == null) awayFrom = S().lastSeen || null;
  if (inited) return;
  inited = true;
  ensureSeason(toMs(now));
  snap = questSnap();

  bus.on('expedition:finished', ({ stars = 0, prototype } = {}) => {
    if (prototype) return;
    // Estadio terminado: +25% de chispas en las expediciones
    const pts = Math.round((POINTS.expedition + POINTS.perStar * (stars || 0)) * (1 + monumentBonus('pass')));
    lastExp = { pts, at: Date.now() };
    if (pts) addSeasonPoints(pts, 'expedition');
  });
  bus.on('expedition:zone', () => addSeasonPoints(Math.round(POINTS.zone * (1 + monumentBonus('pass'))), 'zone'));
  bus.on('production:collected', () => {
    const z = ss();
    const today = todayStr();
    if (z.daily.date !== today) z.daily = { date: today, collectPts: 0 };
    const pts = Math.min(POINTS.collectDailyMax - z.daily.collectPts, POINTS.collect);
    if (pts > 0) { z.daily.collectPts += pts; addSeasonPoints(pts, 'collect'); }
  });
  bus.on('building:built', ({ b } = {}) => {
    if (b && BUILDING_BY_ID[b.id]?.cat === 'camino') return;
    addSeasonPoints(POINTS.built, 'built');
  });
  bus.on('building:upgraded', () => addSeasonPoints(POINTS.upgraded, 'upgraded'));
  bus.on('building:renovated', () => addSeasonPoints(POINTS.renovated, 'renovated'));
  // reparar pagando (lo que arregla la vecindad sola a las 72 h no suma)
  bus.on('building:repaired', (p) => { if (p?.paid) addSeasonPoints(POINTS.repaired, 'repaired'); });
  bus.on('quests:changed', onQuestsChanged);
  bus.on('album:changed', (p) => { const k = countNewStickers(p); if (k) addSeasonPoints(POINTS.newSticker * k, 'sticker'); });
  bus.on('social:helped', () => addSeasonPoints(POINTS.helped, 'helped'));
  bus.on('social:gift', (p) => { if (p && (p.sent || p.outgoing || p.dir === 'out')) addSeasonPoints(POINTS.helped, 'gift'); });

  // Si la app queda abierta en segundo plano varios días (iPhone), también cuenta como ausencia.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt >= WELCOME.minDays * DAY) {
        awayFrom = hiddenAt;
        bus.emit('season:welcome', welcomeBackStatus());
      }
      hiddenAt = null;
      ensureSeason(Date.now());
    });
  }
}

// ---------- UI (carga diferida desde season-ui.js) ----------
/** Abre el Pase de Temporada. */
export function openSeasonPass(ctx, now) { return import('./season-ui.js').then(m => m.openSeasonPass(ctx, now)); }
/** Abre el regalo de bienvenida si corresponde. Promise<status cobrado | null>. */
export function openWelcomeBack(ctx, now) { return import('./season-ui.js').then(m => m.openWelcomeBack(ctx, now)); }

/** Solo para pruebas: fuerza el "último ingreso" usado por la bienvenida. */
export function _debugSetAwayFrom(ms) { awayFrom = ms; }
