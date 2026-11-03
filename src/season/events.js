// Eventos rotativos: calendario determinista por semana (lunes a domingo, hora local) con plantillas de datos.
// Máximo 2 activos a la vez: slot A (semana entera) + slot B (finde largo). Nunca se repite la misma plantilla
// en un mismo slot dos semanas seguidas. La Semana Dorada ocupa el slot A la primera semana ISO de cada mes.
// Todas las funciones aceptan `now` opcional (ms o Date) para pruebas.
import { bus } from '../core/bus.js';
import { store } from '../core/state.js';
import { rewardScale } from '../core/data.js';
import { toast } from '../core/ui.js';
import { audio } from '../core/audio.js';
import { EVENT_TEMPLATES, WEEK_POOL, WEEKEND_POOL, RACE_EVERY } from './season-data.js';
import { toMs, weekIndex, epochDay, isoWeekKey, fmtLeft } from './season.js';

export { EVENT_TEMPLATES };
export const MULT_KEYS = ['production', 'chestDrop', 'stickers', 'match3Rewards', 'blocksRewards', 'parkingRewards', 'drivingRewards'];

// ---------- Rotación determinista ----------
const mod = (a, n) => ((a % n) + n) % n;
function shuffled(pool, seed) {
  let h = (seed * 2654435761 + pool.length * 97) >>> 0;
  const rnd = () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Elemento k de una secuencia infinita: permutaciones por ciclo, sin repetir en el borde entre ciclos.
 *  (El arreglo del borde toca sólo las posiciones 0 y 1, así el último de cada ciclo no depende del anterior.) */
function seqPick(pool, k) {
  const L = pool.length;
  if (L < 3) return pool[mod(k, L)];
  const c = Math.floor(k / L);
  const perm = shuffled(pool, c);
  const prevLast = shuffled(pool, c - 1)[L - 1];
  if (perm[0] === prevLast) [perm[0], perm[1]] = [perm[1], perm[0]];
  return perm[k - c * L];
}

/** Plantillas programadas para la semana w (desde la época). */
export function weekSchedule(w) {
  const monday = epochDay(w * 7);
  const golden = new Date(monday).getDate() <= 7; // primera semana ISO del mes
  const p = mod(w, RACE_EVERY);
  const slotA = golden ? 'dorada'
    : p === 0 ? 'estrellas'
      : seqPick(WEEK_POOL, Math.floor(w / RACE_EVERY) * (RACE_EVERY - 1) + (p - 1));
  const slotB = seqPick(WEEKEND_POOL, w);
  const week = isoWeekKey(monday);
  return [slotA, slotB].map((id, slot) => {
    const t = EVENT_TEMPLATES[id];
    return { id, slot, key: `${id}@${week}`, week, startsAt: epochDay(w * 7 + t.days[0]), endsAt: epochDay(w * 7 + t.days[1] + 1) };
  });
}

// ---------- Estado (Carrera de Estrellas) ----------
function es() {
  const s = store.state;
  if (!s.events || typeof s.events !== 'object') s.events = {};
  s.events.race ??= { key: '', stars: 0, done: [] };
  return s.events;
}
function raceFor(inst) {
  const e = es();
  if (e.race.key !== inst.key) { e.race = { key: inst.key, stars: 0, done: [] }; store.markDirty(); }
  return e.race;
}
function scaledReward(r) {
  return { ...r, coins: r.coins ? Math.round(r.coins * rewardScale(store.state.player.level)) : 0 };
}

function describe(inst, t) {
  const tpl = EVENT_TEMPLATES[inst.id];
  const out = {
    id: inst.id, key: inst.key, title: tpl.title, emoji: tpl.emoji, short: tpl.short, description: tpl.desc,
    color: tpl.color, dark: tpl.dark, mult: { ...tpl.mult }, flags: { ...(tpl.flags || {}) }, slot: inst.slot,
    startsAt: inst.startsAt, endsAt: inst.endsAt, endsInMs: inst.endsAt - t, endsIn: fmtLeft(inst.endsAt - t),
    startsInMs: inst.startsAt - t, startsIn: fmtLeft(inst.startsAt - t),
  };
  if (tpl.race) {
    const r = t >= inst.startsAt && t < inst.endsAt ? raceFor(inst) : { stars: 0, done: [] };
    const tiers = tpl.race.map((x, i) => ({ goal: x.goal, reward: scaledReward(x.reward), done: !!r.done[i] }));
    const next = tiers.find(x => !x.done);
    out.progress = { cur: r.stars, max: tiers[tiers.length - 1].goal, next: next ? next.goal : null, tiers, complete: !next };
    out.short = next ? `⭐ ${r.stars}/${next.goal}` : '⭐ ¡Completa!';
  }
  return out;
}

// ---------- API ----------
/** Eventos activos ahora (máx 2), la Semana Dorada primero. */
export function activeEvents(now) {
  const t = toMs(now);
  return weekSchedule(weekIndex(t))
    .filter(i => i.startsAt <= t && t < i.endsAt)
    .map(i => describe(i, t))
    .sort((a, b) => (b.id === 'dorada') - (a.id === 'dorada') || a.endsAt - b.endsAt);
}
/** Próximos eventos (esta semana y la que viene) que todavía no empezaron. */
export function upcomingEvents(now, limit = 3) {
  const t = toMs(now);
  const w = weekIndex(t);
  return [...weekSchedule(w), ...weekSchedule(w + 1)]
    .filter(i => i.startsAt > t)
    .sort((a, b) => a.startsAt - b.startsAt)
    .slice(0, limit)
    .map(i => describe(i, t));
}
/** Multiplicador combinado de los eventos activos (1 si no hay). keys: ver MULT_KEYS. */
// Cache barato (se recalcula cada 15 s) porque la economía puede consultarlo muy seguido.
let multCache = { bucket: -1, mults: {} };
export function eventMult(key, now) {
  const live = now == null;
  const t = toMs(now);
  if (live && multCache.bucket === Math.floor(t / 15e3)) return multCache.mults[key] ?? 1;
  const mults = {};
  for (const e of weekSchedule(weekIndex(t))) {
    if (!(e.startsAt <= t && t < e.endsAt)) continue;
    for (const [k, v] of Object.entries(EVENT_TEMPLATES[e.id].mult)) mults[k] = (mults[k] || 1) * v;
  }
  if (live) multCache = { bucket: Math.floor(t / 15e3), mults };
  return mults[key] ?? 1;
}
/** Flags de eventos (p.ej. 'trade5' durante la Semana Dorada: habilita intercambio de figuritas 5★). */
export function eventFlag(name, now) { return activeEvents(now).some(e => e.flags[name]); }

/** Para el banner del HUD: el evento más destacado + cuántos hay. null si no hay ninguno. */
export function eventBannerInfo(now) {
  const list = activeEvents(now);
  if (!list.length) return null;
  const top = list[0];
  return {
    id: top.id, key: top.key, emoji: top.emoji, title: top.title, short: top.short, color: top.color, dark: top.dark,
    endsAt: top.endsAt, endsInMs: top.endsInMs, endsIn: top.endsIn, count: list.length, others: list.slice(1).map(e => e.emoji),
    text: `${top.emoji} ${top.short} · ${top.endsIn}`,
  };
}

/** Estado de la Carrera de Estrellas activa (o null). */
export function raceStatus(now) { return activeEvents(now).find(e => e.progress) || null; }

function grantRaceReward(r) {
  const rw = scaledReward(r);
  if (rw.coins || rw.gems) store.grant({ coins: rw.coins, gems: rw.gems || 0 }, 'event');
  if (rw.chest) bus.emit('reward:chest', { type: rw.chest, n: 1, source: 'event' });
  if (rw.stickers) bus.emit('reward:stickers', { n: rw.stickers.n, minStars: rw.stickers.minStars || 1, source: 'event' });
  return rw;
}
/** Suma estrellas a la carrera (lo llama el listener de minigame:finished). Devuelve escalones ganados. */
export function addRaceStars(stars, now) {
  const t = toMs(now);
  const inst = weekSchedule(weekIndex(t)).find(i => EVENT_TEMPLATES[i.id].race && i.startsAt <= t && t < i.endsAt);
  if (!inst || !(stars > 0)) return [];
  const r = raceFor(inst);
  r.stars += stars;
  const won = [];
  EVENT_TEMPLATES[inst.id].race.forEach((tier, i) => {
    if (r.done[i] || r.stars < tier.goal) return;
    r.done[i] = true;
    won.push({ tier: i + 1, reward: grantRaceReward(tier.reward) });
  });
  store.markDirty();
  bus.emit('events:changed', { reason: 'race', stars: r.stars });
  for (const w of won) {
    bus.emit('events:raceTier', w);
    try { audio.sfx('star'); toast(`Carrera de Estrellas: ¡escalón ${w.tier} logrado!`, { icon: 'star', type: 'good' }); } catch {}
  }
  if (won.length) store.save();
  return won;
}

let inited = false;
let lastWeekKey = '';
export function initEvents() {
  if (inited) return;
  inited = true;
  es();
  bus.on('minigame:finished', ({ stars = 0 } = {}) => addRaceStars(stars || 0));
  // avisa cuando cambia el set de eventos activos (para que el HUD refresque el banner)
  const check = () => {
    const k = activeEvents().map(e => e.key).join('|');
    if (k !== lastWeekKey) { lastWeekKey = k; bus.emit('events:changed', { reason: 'schedule', active: k }); }
  };
  check();
  setInterval(check, 60e3);
}

/** Abre el panel de eventos (UI en events-ui.js, carga diferida). */
export function openEventsPanel(ctx, now) {
  return import('./events-ui.js').then(m => m.openEventsPanel(ctx, now));
}
