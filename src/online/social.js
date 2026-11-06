// Social: lógica de amigas, regalitos, intercambios con escrow, pedidos, Obra en Equipo y ranking semanal.
// La UI vive en social-ui.js / social-*.js y se carga recién cuando se abre (import dinámico).
//
// Contrato (DESIGN-RETENTION.md):
//   initSocial(ctx)                     el núcleo lo llama después de initSync(ctx)
//   openSocial(ctx, tab='amigas')       tabs: 'amigas' | 'pedidos' | 'buzon' | 'ranking' | 'equipo'
//   openAccount(ctx)                    crear cuenta / entrar / salir / modo simulado
//   handleConflict(ctx, conflict)       -> Promise<'local'|'cloud'|null> elegir partida (resolveConflict)
//   socialBadge()                       número sincrónico (cacheado); bus 'social:badge' {count} cuando cambia
// Eventos que emite: 'social:badge', 'social:changed', 'social:helped' {kind}, 'social:gift' {sent:true}.
// Escucha: 'album:trade' {id, mode:'offer'|'ask'} (pone handled=true), 'minigame:finished', 'building:built',
// 'building:upgraded', 'online:inbox', 'online:status', 'online:conflict'.
//
// Estado local en state.social = { giftDay:{friendId:'YYYY-MM-DD'}, coop:{week, local, pending, claimed[], reached, carry[]},
//                                  rank:{hist:{week:{match3,blocks,parking,driving,stars,played}}, claimed[]} }
import { net, friendLevel, isoWeek, isDefaultName } from './net.js';
import * as sync from './sync.js';
import { bus } from '../core/bus.js';
import { store } from '../core/state.js';
import { rewardScale, BUILDING_BY_ID } from '../core/data.js';
import { ITEMS, addChest } from '../chests/chests.js';
import * as album from '../album/album.js';
import { eventFlag } from '../season/events.js';

// ---------- Balance ----------
/** Puntos de Obra en Equipo por acción. */
export const COOP_POINTS = { win: 30, built: 20, upgraded: 40, request: 50, gift: 10, help: 10 };
export const COOP_PER_MEMBER = 1000;
/** 5 escalones (porcentaje de la meta). Las monedas se escalan con el nivel al cobrar. */
export const COOP_TIERS = [
  { pct: 0.2, reward: { coins: 300 } },
  { pct: 0.4, reward: { chests: { madera: 1 }, coins: 150 } },
  { pct: 0.6, reward: { gems: 8, stickers: { n: 2, minStars: 2 } } },
  { pct: 0.8, reward: { chests: { plata: 1 } } },
  { pct: 1.0, reward: { chests: { oro: 1 }, gems: 20 } },
];
/** Monedas BASE del regalito diario según nivel de amistad (Conocidas → Inseparables). */
export const GIFT_COINS = [60, 90, 130, 180, 250];
export const GIFT_ITEMS = ['hammer', 'm3_moves', 'blk_bomb', 'park_time'];
/** Premio de participación del ranking semanal (para todas las que jugaron). */
export const RANK_PRIZE = { coins: 250, chests: { madera: 1 } };
export const RANK_BEST_GEMS = 5;
export const RANK_CATS = [
  { id: 'level', name: 'Nivel', icon: 'crown', short: 'Nivel' },
  { id: 'stars', name: 'Estrellas', icon: 'star', short: 'Estrellas' },
  { id: 'match3', name: 'Joyas Brillantes', icon: '💎', short: 'Joyas' },
  { id: 'blocks', name: 'Bloques Pixel', icon: '🧩', short: 'Bloques' },
  { id: 'parking', name: 'Estacionamiento', icon: '🅿️', short: 'Parking' },
  { id: 'driving', name: 'Ruta Pixel', icon: '🚗', short: 'Paseo' },
];
const WEEK_KEYS = ['match3', 'blocks', 'parking', 'driving', 'stars'];
/** Objetos de mochila que se pueden pedir / intercambiar. */
export const TRADE_ITEMS = Object.values(ITEMS).filter(i => i.kind === 'item').map(i => i.id);

// ---------- Utilidades ----------
export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
const round5 = n => Math.max(5, Math.round(n / 5) * 5);
const scale = () => rewardScale(store.state?.player?.level || 1);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const myName = () => store.state?.player?.name || 'Vos';
/** ms hasta el lunes 00:00 UTC (fin de la semana ISO, igual que el servidor). */
export function weekEndsInMs(now = Date.now()) {
  const d = new Date(now);
  const day = d.getUTCDay() || 7;
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (8 - day));
  return end - now;
}
const prevWeek = () => isoWeek(new Date(Date.now() - 7 * 864e5));

// ---------- Estado local ----------
function S() {
  const s = store.state;
  if (!s) return null;
  s.social ??= {};
  const z = s.social;
  z.giftDay ??= {};
  z.coop ??= {};
  const c = z.coop;
  c.week ??= isoWeek(); c.local ??= 0; c.pending ??= 0; c.claimed ??= []; c.reached ??= 0; c.carry ??= [];
  z.rank ??= {};
  z.rank.hist ??= {}; z.rank.claimed ??= [];
  rollWeek(z);
  return z;
}
function rollWeek(z) {
  const c = z.coop, cur = isoWeek();
  if (c.week === cur) return;
  // escalones alcanzados y no cobrados de la semana pasada: se guardan para cobrar después (nunca se pierden)
  for (let n = 1; n <= c.reached; n++) if (!c.claimed.includes(n)) c.carry.push({ week: c.week, tier: n });
  c.carry = c.carry.slice(-10);
  Object.assign(c, { week: cur, local: 0, claimed: [], reached: 0 });
  // historial del ranking: solo las últimas 8 semanas
  const weeks = Object.keys(z.rank.hist).sort();
  for (const w of weeks.slice(0, Math.max(0, weeks.length - 8))) delete z.rank.hist[w];
  z.rank.claimed = z.rank.claimed.slice(-12);
  store.markDirty();
}
export const socialState = () => S();

// ---------- Caché online ----------
const cache = { friends: null, trades: null, coop: null, inbox: [], friendReqs: null, myReqs: null, visitors: null, profiles: {}, profilesAt: 0, user: null };
export const socialCache = cache;
function resetCache() {
  Object.assign(cache, { friends: null, trades: null, coop: null, inbox: [], friendReqs: null, myReqs: null, visitors: null, profiles: {}, profilesAt: 0 });
}

// ---------- Badge ----------
let badge = 0;
let ctxRef = null;
export function socialBadge() { return badge; }
function computeBadge() {
  if (!store.state) return 0;
  let n = 0;
  if (net.user) {
    n += (cache.friends || []).filter(f => f.incoming).length;
    n += cache.inbox.length;
    n += (cache.trades || []).filter(t => t.status === 'pending' && !t.outgoing).length;
  }
  n += coopInfo().claimable;
  n += rankPrizeWeeks().length;
  if (n !== badge) { badge = n; bus.emit('social:badge', { count: n }); }
  return n;
}
/** Contadores por pestaña (para los puntitos de las tabs). */
export function tabCounts() {
  const u = !!net.user;
  return {
    amigas: u ? (cache.friends || []).filter(f => f.incoming).length : 0,
    pedidos: u ? (cache.friendReqs || []).filter(r => sync.canAffordPayload(r.kind === 'speedup' ? {} : r.payload)).length : 0,
    buzon: u ? cache.inbox.length + (cache.trades || []).filter(t => t.status === 'pending' && !t.outgoing).length : 0,
    ranking: rankPrizeWeeks().length,
    equipo: coopInfo().claimable,
  };
}

// ---------- Refrescos ----------
let refreshing = null;
/** Trae amigas, intercambios, equipo y buzón. what: lista opcional ('friends','trades','coop','inbox','requests','visitors'). */
export function refreshSocial(what = null) {
  if (!net.user) { computeBadge(); bus.emit('social:changed', {}); return Promise.resolve(); }
  if (refreshing && !what) return refreshing;
  const want = k => !what || what.includes(k);
  const p = (async () => {
    const jobs = [];
    if (want('friends')) jobs.push(net.listFriends().then(r => { if (!r?.error) cache.friends = r; }));
    if (want('trades')) jobs.push(net.listTrades().then(r => { if (!r?.error) cache.trades = r; }));
    if (want('coop')) jobs.push(net.coopStatus().then(r => { if (r && !r.error) cache.coop = r; }));
    if (want('inbox')) jobs.push(sync.refreshInbox());
    if (what?.includes('requests')) jobs.push(net.friendRequests().then(r => { if (!r?.error) cache.friendReqs = r; }), net.myRequests().then(r => { if (!r?.error) cache.myReqs = r; }));
    if (what?.includes('visitors')) jobs.push(net.visitorsToMe().then(r => { if (!r?.error) cache.visitors = r; }));
    await Promise.all(jobs);
    computeBadge();
    bus.emit('social:changed', { what });
  })().finally(() => { if (!what) refreshing = null; });
  if (!what) refreshing = p;
  return p;
}
/** Perfiles completos de amigas (álbum, look, stats). Cacheados 2 min. */
export async function friendProfiles(force = false) {
  if (!net.user || !cache.friends) return cache.profiles;
  const ids = cache.friends.filter(f => f.status === 'accepted').map(f => f.id);
  if (!ids.length) return cache.profiles;
  if (!force && Date.now() - cache.profilesAt < 120e3 && ids.every(id => cache.profiles[id])) return cache.profiles;
  const r = await net.getProfiles(ids);
  if (!r?.error) { for (const p of r) cache.profiles[p.id] = p; cache.profilesAt = Date.now(); }
  return cache.profiles;
}
/** Álbum de una amiga ({id: count}) desde su perfil público, o null si no lo publicó todavía. */
export function friendAlbum(id) { return sync.decodeAlbum(cache.profiles[id]?.stats?.album); }

// ---------- Recompensas ----------
/** Escala un paquete de premio (las monedas con el nivel). */
export function scaledReward(r) {
  const out = { ...r };
  if (out.coins) out.coins = round5(out.coins * scale());
  return out;
}
/** Acredita {coins, gems, chests:{tipo:n}, stickers:{n, minStars}} -> { coins, gems, chests, stickers:[...] } */
export function grantPack(r, source = 'social') {
  const out = { coins: r.coins || 0, gems: r.gems || 0, chests: { ...(r.chests || {}) }, stickers: [] };
  if (out.coins || out.gems) store.grant({ coins: out.coins, gems: out.gems }, source);
  for (const [t, n] of Object.entries(out.chests)) addChest(t, n, source);
  if (r.stickers?.n) {
    try { out.stickers = album.grantStickers(r.stickers.n, { minStars: r.stickers.minStars || 1, source }); } catch (e) { console.warn('[social] figuritas', e); }
  }
  store.save();
  return out;
}

// ---------- Obra en Equipo ----------
export function addCoopPoints(n, reason = '') {
  const z = S();
  if (!z || !(n > 0)) return;
  z.coop.local += n;
  if (net.user) z.coop.pending += n;
  store.markDirty();
  bus.emit('social:coop', { added: n, reason });
  computeBadge();
}
let flushing = false;
export async function flushCoop() {
  const z = S();
  if (!z || !net.user || flushing || !(z.coop.pending > 0)) return;
  flushing = true;
  const n = z.coop.pending;
  try {
    const r = await net.addCoopPoints(n);
    if (r && !r.error) {
      z.coop.pending = Math.max(0, z.coop.pending - n);
      store.markDirty();
      await refreshSocial(['coop']);
    }
  } finally { flushing = false; }
}
/**
 * Estado de la Obra en Equipo de esta semana.
 * -> { week, online, total, goal, members:[{id,name,points,me}], tiers:[{n,at,reward,reached,claimed}], claimable, carry, pending, endsInMs }
 */
export function coopInfo() {
  const z = S();
  if (!z) return { claimable: 0, tiers: [], members: [], total: 0, goal: COOP_PER_MEMBER, carry: [] };
  const c = z.coop;
  const online = !!(net.user && cache.coop && cache.coop.week === c.week);
  let members, total, goal;
  if (online) {
    members = cache.coop.members.map(m => (m.me ? { ...m, points: m.points + c.pending } : { ...m }));
    total = cache.coop.total + c.pending;
    goal = COOP_PER_MEMBER * Math.max(1, members.filter(m => m.points > 0).length);
  } else {
    members = [{ id: 'me', name: myName(), points: c.local, me: true }];
    total = c.local; goal = COOP_PER_MEMBER;
  }
  members.sort((a, b) => b.points - a.points);
  const reachedNow = COOP_TIERS.filter(t => total >= Math.round(goal * t.pct)).length;
  if (reachedNow > c.reached) { c.reached = reachedNow; store.markDirty(); }
  const tiers = COOP_TIERS.map((t, i) => ({
    n: i + 1, pct: t.pct, at: Math.round(goal * t.pct), reward: scaledReward(t.reward),
    reached: i < c.reached, claimed: c.claimed.includes(i + 1),
  }));
  const claimable = tiers.filter(t => t.reached && !t.claimed).length + c.carry.length;
  return { week: c.week, online, total, goal, members, tiers, claimable, carry: c.carry.map(x => ({ ...x, reward: scaledReward(COOP_TIERS[x.tier - 1].reward) })), pending: c.pending, endsInMs: weekEndsInMs() };
}
/** Cobra un escalón (n) de esta semana, o uno guardado de semanas anteriores (carryIndex). */
export function claimCoopTier(n, carryIndex = null) {
  const z = S();
  const c = z.coop;
  let tierN = n;
  if (carryIndex != null) {
    const it = c.carry[carryIndex];
    if (!it) return null;
    c.carry.splice(carryIndex, 1);
    tierN = it.tier;
  } else {
    const info = coopInfo();
    const t = info.tiers[n - 1];
    if (!t || !t.reached || t.claimed) return null;
    c.claimed.push(n);
  }
  const got = grantPack(scaledReward(COOP_TIERS[tierN - 1].reward), 'coop');
  store.markDirty();
  computeBadge();
  bus.emit('social:changed', { what: ['coop'] });
  return got;
}

// ---------- Ranking semanal ----------
function recordWeek({ game, score = 0, stars = 0 } = {}) {
  const z = S();
  if (!z) return;
  const w = isoWeek();
  const h = (z.rank.hist[w] ||= { match3: 0, blocks: 0, parking: 0, driving: 0, stars: 0, played: 0 });
  if (WEEK_KEYS.includes(game) && game !== 'stars') h[game] = Math.max(h[game] || 0, Math.round(score) || 0);
  h.stars += Math.max(0, stars | 0);
  h.played++;
  store.markDirty();
}
const isSunday = (d = new Date()) => d.getDay() === 0;
/** Semanas con premio de participación para cobrar (la actual el domingo, y la anterior si quedó pendiente). */
export function rankPrizeWeeks() {
  const z = S();
  if (!z) return [];
  const cur = isoWeek(), prev = prevWeek();
  const out = [];
  if (z.rank.hist[prev]?.played && !z.rank.claimed.includes(prev)) out.push(prev);
  if (isSunday() && z.rank.hist[cur]?.played && !z.rank.claimed.includes(cur)) out.push(cur);
  return out;
}
/** ¿Esta semana superé mi mejor marca de semanas anteriores en esa categoría? */
export function personalBest(cat, week = isoWeek()) {
  const z = S();
  const h = z?.rank.hist || {};
  const cur = h[week]?.[cat] || 0;
  if (!cur) return false;
  const prev = Object.entries(h).filter(([w]) => w < week).map(([, v]) => v[cat] || 0);
  return prev.length > 0 && cur > Math.max(...prev);
}
export function rankInfo() {
  const z = S();
  const week = isoWeek();
  const mine = { ...(z?.rank.hist[week] || { match3: 0, blocks: 0, parking: 0, driving: 0, stars: 0, played: 0 }) };
  const best = Object.fromEntries(WEEK_KEYS.map(k => [k, personalBest(k, week)]));
  const d = new Date();
  const daysToSunday = (7 - d.getDay()) % 7;
  return { week, mine, best, prizeWeeks: rankPrizeWeeks(), daysToSunday, endsInMs: weekEndsInMs(), prize: scaledReward(RANK_PRIZE) };
}
export function claimRankPrize(week) {
  const z = S();
  if (!rankPrizeWeeks().includes(week)) return null;
  z.rank.claimed.push(week);
  const anyBest = WEEK_KEYS.some(k => personalBest(k, week));
  const pack = scaledReward({ ...RANK_PRIZE, gems: anyBest ? RANK_BEST_GEMS : 0 });
  const got = grantPack(pack, 'ranking');
  got.best = anyBest;
  computeBadge();
  bus.emit('social:changed', { what: ['rank'] });
  return got;
}

// ---------- Regalito diario ----------
export function giftSentToday(friendId) { return S()?.giftDay[friendId] === utcDay(); }
/** Lo que trae el regalito según el nivel de amistad (sin el extra sorpresa). */
export function giftPreview(friend) {
  const lv = friend?.friendship?.index ?? friendLevel(friend?.days || 0).index;
  return { coins: round5(GIFT_COINS[lv] * scale()), level: lv };
}
/** Manda el regalito del día. A veces suma un objeto común o una figurita repetida (1–2★) tuya. -> { ok, payload } | { error } */
export async function sendDailyGift(friend) {
  const z = S();
  if (giftSentToday(friend.id)) return { error: 'Ya le mandaste el regalo de hoy 🎁 ¡Volvé mañana!' };
  const payload = { coins: giftPreview(friend).coins };
  let sticker = null;
  const r = Math.random();
  if (r < 0.25) payload.items = { [pick(GIFT_ITEMS)]: 1 };
  else if (r < 0.5) {
    const d = album.duplicates().filter(x => x.stars <= 2 && x.count >= 3); // siempre le queda una repetida para cambiar
    if (d.length) { sticker = pick(d).id; if (album.takeStickers(sticker, 1)) payload.stickers = { [sticker]: 1 }; else sticker = null; }
  }
  const res = await net.sendGift(friend.id, 'gift', payload);
  if (res?.error) {
    if (sticker) album.giveStickers({ [sticker]: 1 }, 'refund');
    if (/Ya le mandaste/.test(res.error)) { z.giftDay[friend.id] = utcDay(); store.markDirty(); }
    return res;
  }
  z.giftDay[friend.id] = utcDay();
  for (const [k, v] of Object.entries(z.giftDay)) if (v !== utcDay()) delete z.giftDay[k];
  store.markDirty(); store.save();
  bus.emit('social:gift', { sent: true, to: friend.id, payload });
  refreshSocial(['friends']);
  return { ok: true, payload };
}

// ---------- Intercambios ----------
/** Reglas de figuritas con esta amiga: { fiveOk, golden } (golden = Semana Dorada habilita 5★ sin los 14 días). */
export function stickerRules(friend) {
  const days = friend?.days || 0;
  const gold = eventFlag('trade5');
  return { fiveOk: days >= 14 || gold, golden: gold && days < 14, days };
}
/** ¿Es válido este par de figuritas? -> null | 'texto del problema' */
export function stickerPairProblem(offerId, askId, friend) {
  const a = album.stickerDef(offerId), b = album.stickerDef(askId);
  if (!a || !b) return 'Elegí una figurita de cada lado';
  if (album.stickerCount(offerId) < 2) return 'Solo podés ofrecer repetidas';
  if (Math.abs(a.stars - b.stars) > 1) return 'Tienen que tener estrellas parecidas (como mucho 1 de diferencia)';
  if (Math.max(a.stars, b.stars) === 5 && !stickerRules(friend).fiveOk) return 'Las de 5★ se cambian con amistades de 14 días o más (o en la Semana Dorada)';
  return null;
}
/**
 * Propone un intercambio con escrow: lo ofrecido se descuenta recién cuando el servidor lo aceptó.
 * offer/request: { coins, gems, items:{id:n} } o { stickers:{id:1}, stars } -> { ok, id } | { error }
 */
export async function proposeTrade(friend, offer, request) {
  const off = { ...offer }, req = { ...request };
  if (!sync.canAffordPayload(off)) return { error: 'No te alcanza para ofrecer eso' };
  if (off.stickers && stickerRules(friend).golden && Math.max(off.stars || 0, req.stars || 0) === 5) off.golden = true;
  const r = await net.proposeTrade(friend.id, off, req);
  if (r?.error) return r;
  if (!sync.deductPayload(offer, 'trade:escrow')) { await net.cancelTrade(r.id); return { error: 'No te alcanza para ofrecer eso' }; }
  refreshSocial(['trades']);
  return r;
}
export async function acceptTrade(t) {
  if (!sync.canAffordPayload(t.request)) return { error: 'Te falta algo de lo que te piden para aceptar' };
  const r = await net.respondTrade(t.id, true);
  if (r?.error) { refreshSocial(['trades']); return r; }
  sync.deductPayload(t.request, 'trade');
  bus.emit('social:trade', { id: t.id, status: 'accepted' });
  await refreshSocial(['trades', 'inbox']);
  return r;
}
export async function declineTrade(t) {
  const r = await net.respondTrade(t.id, false);
  refreshSocial(['trades']);
  return r;
}
export async function cancelTrade(t) {
  const r = await net.cancelTrade(t.id);
  await refreshSocial(['trades', 'inbox']);
  return r;
}

// ---------- Pedidos de ayuda ----------
export const REQUEST_KINDS = {
  sticker: { name: 'Figurita que me falta', icon: '🃏' },
  item: { name: 'Un objeto', icon: '🔨' },
  coins: { name: 'Monedas', icon: 'coin' },
  speedup: { name: 'Acelerá mi obra', icon: '⏳' },
};
export const SPEEDUP_MINUTES = 30;
export function requestCoinOptions() { return [150, 400, 800].map(c => round5(c * scale())); }
/** Lo que tiene que entregar quien ayuda (la obra no cuesta nada). */
export const requestCost = (req) => (req.kind === 'speedup' ? {} : { coins: req.payload?.coins, gems: req.payload?.gems, items: req.payload?.items, stickers: req.payload?.stickers });
/** Premio para quien ayuda. */
export function helperReward(req) {
  const base = round5(60 * scale());
  return { coins: base + (req.kind === 'coins' ? round5((req.payload?.coins || 0) * 0.2) : 0) };
}
export const canFill = (req) => sync.canAffordPayload(requestCost(req));
export async function createHelpRequest(kind, payload) {
  const r = await net.createRequest(kind, payload, 1);
  if (!r?.error) await refreshSocial(['requests']);
  return r;
}
export async function fillFriendRequest(req) {
  const cost = requestCost(req);
  if (!sync.canAffordPayload(cost)) return { error: 'No tenés lo que necesita 😔' };
  const r = await net.fillRequest(req.id);
  if (r?.error) { refreshSocial(['requests']); return r; }
  sync.deductPayload(cost, 'request');
  const reward = helperReward(req);
  store.grant(reward, 'online:help');
  store.save();
  bus.emit('social:helped', { kind: 'request', to: req.from_id, request: req });
  await refreshSocial(['requests', 'friends']);
  return { ok: true, reward };
}

// ---------- Buzón ----------
export async function claimAll() {
  const r = await sync.claimAllAndApply();
  if (!r?.error) { cache.inbox = []; computeBadge(); bus.emit('social:changed', { what: ['inbox'] }); }
  return r;
}
export async function claimOne(gift) {
  const r = await sync.claimAndApply(gift);
  cache.inbox = cache.inbox.filter(g => g.id !== gift.id);
  computeBadge();
  bus.emit('social:changed', { what: ['inbox'] });
  return r;
}

// ---------- UI (carga diferida) ----------
export function openSocial(ctx, tab = 'amigas', opts = {}) {
  ctxRef ||= ctx;
  return import('./social-ui.js').then(m => m.openSocialUI(ctx || ctxRef, tab, opts)).catch(e => { console.error('[social] ui', e); });
}
export function openAccount(ctx, opts = {}) {
  ctxRef ||= ctx;
  return import('./social-account.js').then(m => m.openAccountUI(ctx || ctxRef, opts)).catch(e => { console.error('[social] cuenta', e); });
}
let conflictP = null;
/** Muestra la elección de partida. -> Promise<'local'|'cloud'|null> (una sola a la vez). */
export function handleConflict(ctx, conflict) {
  ctxRef ||= ctx;
  const info = conflict || sync.getSyncStatus().conflictInfo;
  if (!info) return Promise.resolve(null);
  if (conflictP) return conflictP;
  conflictP = import('./social-account.js').then(m => m.conflictModal(ctx || ctxRef, info))
    .catch(e => { console.error('[social] conflicto', e); return null; })
    .finally(() => { conflictP = null; });
  return conflictP;
}
/** Partida con el nombre por defecto: adopta el nombre de la cuenta (el que eligió al registrarse). */
async function adoptAccountName() {
  const s = store.state;
  if (!net.user || !s || !isDefaultName(s.player.name)) return;
  const p = await net.getMyProfile();
  const n = typeof p?.name === 'string' ? [...p.name.trim()].slice(0, 16).join('') : '';
  if (n && !isDefaultName(n) && isDefaultName(s.player.name)) {
    s.player.name = n;
    store.markDirty(); store.save();
    ctxRef?.hud?.refresh?.();
  }
}
function onAlbumTrade(p) {
  if (!p || typeof p !== 'object' || !album.stickerDef(p.id)) return;
  p.handled = true;
  if (net.mode === 'off' || !net.user) { openAccount(ctxRef, { reason: 'trade' }); return; }
  import('./social-trade.js').then(m => (p.mode === 'ask' ? m.openRequestCreator(ctxRef, { kind: 'sticker', sticker: p.id }) : m.openTradeEditor(ctxRef, { offerSticker: p.id })))
    .catch(e => console.error('[social] intercambio', e));
}

// ---------- Init ----------
let inited = false;
export function initSocial(ctx) {
  ctxRef = ctx || ctxRef;
  if (inited) { computeBadge(); return; }
  inited = true;
  S();
  sync.setStickerAdder((id, n) => album.giveStickers({ [id]: n }, 'online'));
  sync.setStickerTaker((id, n) => album.takeStickers(id, n), (id, n) => album.stickerCount(id) - n >= 1);

  bus.on('minigame:finished', (r) => { recordWeek(r); if (r?.won) addCoopPoints(COOP_POINTS.win, 'win'); computeBadge(); });
  bus.on('building:built', ({ b } = {}) => { if (b && BUILDING_BY_ID[b.id]?.cat !== 'camino') addCoopPoints(COOP_POINTS.built, 'built'); });
  bus.on('building:upgraded', () => addCoopPoints(COOP_POINTS.upgraded, 'upgraded'));
  bus.on('social:helped', (p) => addCoopPoints(p?.kind === 'request' ? COOP_POINTS.request : COOP_POINTS.help, 'helped'));
  bus.on('social:gift', (p) => { if (p && (p.sent || p.outgoing)) addCoopPoints(COOP_POINTS.gift, 'gift'); });
  bus.on('album:trade', onAlbumTrade);
  bus.on('online:inbox', ({ items } = {}) => { cache.inbox = Array.isArray(items) ? items : []; computeBadge(); });
  bus.on('online:conflict', (info) => { handleConflict(ctxRef, info); });
  bus.on('online:status', (st) => {
    const uid = st?.user?.id || null;
    if (uid !== cache.user) { cache.user = uid; resetCache(); if (uid) { refreshSocial(); adoptAccountName(); } else computeBadge(); }
  });

  cache.user = net.user?.id || null;
  setInterval(() => { if (document.visibilityState === 'visible') flushCoop(); }, 30e3);
  setInterval(() => { if (document.visibilityState === 'visible' && net.user) refreshSocial(); }, 75e3);
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushCoop();
    else if (net.user) refreshSocial();
  });
  // conflicto que quedó pendiente antes de que existiera esta UI
  const st = sync.getSyncStatus();
  if (st.conflictInfo) handleConflict(ctxRef, st.conflictInfo);
  computeBadge();
  if (net.user) { refreshSocial(); adoptAccountName(); }
  else net.init().then(() => { if (net.user) { cache.user = net.user.id; refreshSocial(); adoptAccountName(); } });
}
