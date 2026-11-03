// Sincronización local-first: partida ↔ nube, perfil público (throttle) y buzón.
//
//   import { initSync, resolveConflict } from './online/sync.js';
//   const st = await initSync(ctx);   // { mode, user, online, conflict }
//   if (st.conflict) → preguntar a la jugadora y llamar resolveConflict('local' | 'cloud')
//
// Eventos del bus:
//   'online:status'   { mode, user, online, syncing, lastSync, conflict:boolean }
//   'online:inbox'    { count, items }
//   'online:conflict' { local:{level,xp,coins,gems,buildings,at}, cloud:{...} }
//   'online:applied'  { payload, summary, source }   (después de acreditar un regalo)
//   'online:speedup'  { uid, minutes }               (una ayuda adelantó una obra)
import { net, isoWeek } from './net.js';
import { store } from '../core/state.js';
import { bus } from '../core/bus.js';
import { population, happiness } from '../core/economy.js';
import { ITEMS, CHESTS, addChest, chestCount } from '../chests/chests.js';
import { STICKERS } from '../album/album.js';

// { userId, rev, hash } de la última sincronización. En modo simulado va por jugadora (como el guardado).
const META_KEY = (() => {
  try {
    const q = new URLSearchParams(location.search);
    if (net.mode === 'mock') return 'pixelia.sync.mock.' + (q.get('mockuser') || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  } catch {}
  return 'pixelia.sync';
})();
const PUSH_EVERY_MS = 20e3;
const DEFAULT_NAME = 'Princesa';
const PROFILE_MIN_MS = 60e3;
const INBOX_EVERY_MS = 60e3;

let started = false;
let pushTimer = null, inboxTimer = null;
let pendingConflict = null;      // { local, cloud, cloudData, rev }
let pushing = false;
let lastPushedHash = null;
let lastProfileJson = '', lastProfileAt = 0;
let lastSync = null;
let inboxCount = 0;

// ---------- Meta local ----------
/** Huella de la partida (sin lastSeen ni cámara, que cambian aunque no haya progreso). */
export function stateHash(s = store.state) {
  const str = JSON.stringify(s, (k, v) => (k === 'lastSeen' || k === 'camera' ? undefined : v)) || '';
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + ':' + str.length;
}
function readMeta() { try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { return {}; } }
function writeMeta(m) { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch {} }

// ---------- Estado / eventos ----------
function status() {
  return { mode: net.mode, user: net.user, online: net.mode !== 'off' && net.online, syncing: pushing, lastSync, conflict: !!pendingConflict };
}
function emitStatus() { bus.emit('online:status', status()); }
export function getSyncStatus() { return { ...status(), inbox: inboxCount, conflictInfo: conflictInfo() }; }
function conflictInfo() { return pendingConflict ? { local: pendingConflict.local, cloud: pendingConflict.cloud } : null; }

// ---------- Resúmenes para comparar partidas ----------
function summary(s, at) {
  if (!s || typeof s !== 'object') return null;
  return {
    level: s.player?.level || 1,
    xp: s.player?.xp || 0,
    name: s.player?.name || '',
    cityName: s.player?.cityName || '',
    coins: s.coins || 0,
    gems: s.gems || 0,
    buildings: s.city?.buildings?.length || 0,
    at: at || (s.lastSeen ? new Date(s.lastSeen).toISOString() : null),
  };
}
/** Partida recién empezada (no se pierde nada si se reemplaza). */
function isPristine(s) {
  return (s.player?.level || 1) <= 1 && (s.player?.xp || 0) < 20 && (s.city?.buildings?.length || 0) <= 1 && !(s.stats?.coinsEarned > 200);
}
/** ¿Son "casi la misma" partida? */
function similar(a, b) {
  return a.level === b.level && a.buildings === b.buildings && Math.abs(a.coins - b.coins) <= Math.max(50, a.coins * 0.1) && Math.abs(a.gems - b.gems) <= 5;
}

// ---------- Inicio ----------
/**
 * Arranca la sincronización. Seguro de llamar una sola vez al iniciar el juego (llamadas extra devuelven el estado).
 * -> { mode, user, online, conflict: null | { local, cloud } }
 */
export async function initSync(ctx = {}) {
  if (started) return { ...status(), conflict: conflictInfo() };
  started = true;
  trackWeekStats();
  await net.init();
  net.onAuth(user => {
    emitStatus();
    if (user) startSession().then(r => { if (r?.conflict) bus.emit('online:conflict', r.conflict); });
    else stopSession();
  });
  addEventListener('visibilitychange', () => {
    if (!net.user) return;
    if (document.visibilityState === 'hidden') { store.save(); pushNow(); }
    else { refreshInbox(); }
  });
  addEventListener('online', () => { if (net.user) { pushNow(); refreshInbox(); } });
  let conflict = null;
  if (net.user) conflict = (await startSession()).conflict;
  emitStatus();
  return { ...status(), conflict };
}

let sessionUser = null;
async function startSession() {
  if (!net.user || sessionUser === net.user.id) return { conflict: conflictInfo() };
  sessionUser = net.user.id;
  pendingConflict = null;
  const conflict = await reconcile();
  startTimers();
  publishProfileNow(true);
  refreshInbox();
  emitStatus();
  return { conflict };
}
function stopSession() {
  sessionUser = null;
  pendingConflict = null;
  clearInterval(pushTimer); clearInterval(inboxTimer);
  pushTimer = inboxTimer = null;
  inboxCount = 0;
  bus.emit('online:inbox', { count: 0, items: [] });
  emitStatus();
}
function startTimers() {
  clearInterval(pushTimer); clearInterval(inboxTimer);
  pushTimer = setInterval(() => { tickPush(); }, PUSH_EVERY_MS);
  inboxTimer = setInterval(() => { if (document.visibilityState === 'visible') refreshInbox(); }, INBOX_EVERY_MS);
}

/** Compara partida local con la nube. Devuelve info de conflicto o null. */
async function reconcile() {
  const s = store.state;
  const meta = readMeta();
  const uid = net.user?.id;
  const cloud = await net.pullSave();
  if (!net.user || net.user.id !== uid) return null;        // cerró sesión o cambió de cuenta mientras tanto
  if (cloud?.error) { emitStatus(); return null; }          // sin red: seguimos local y reintentamos con el timer
  if (!cloud) { await pushNow({ force: true }); return null; } // primera vez en la nube
  const sameLine = meta.userId === uid;
  // la nube no cambió desde nuestra última sincronización → la local manda
  if (sameLine && meta.rev === cloud.rev) { await pushNow(); return null; }
  const loc = summary(s), cl = summary(cloud.data, cloud.updated_at);
  // la local no cambió desde la última sincronización (otro dispositivo avanzó) o la local está vacía → tomar la nube
  const localUntouched = sameLine && meta.hash && stateHash(s) === meta.hash;
  if (localUntouched || isPristine(s)) { adoptCloud(cloud); return null; }
  if (similar(loc, cl)) { await pushNow({ force: true }); return null; }
  pendingConflict = { local: loc, cloud: cl, cloudData: cloud.data, rev: cloud.rev };
  bus.emit('online:conflict', conflictInfo());
  emitStatus();
  return conflictInfo();
}

/** Reemplaza la partida local con la de la nube y recarga (el estado está referenciado en todo el juego). */
function adoptCloud(cloud, reload = true) {
  if (!net.user) return;
  // la nube tiene exactamente la misma partida: no hace falta reemplazar ni recargar
  if (stateHash(cloud.data) === stateHash(store.state)) {
    lastPushedHash = stateHash(store.state);
    writeMeta({ userId: net.user.id, rev: cloud.rev, hash: lastPushedHash });
    return;
  }
  store.importCode(btoa(unescape(encodeURIComponent(JSON.stringify(cloud.data)))));
  lastPushedHash = stateHash(store.state);
  writeMeta({ userId: net.user.id, rev: cloud.rev, hash: lastPushedHash });
  if (reload) { try { location.reload(); } catch {} }
}

/**
 * La jugadora eligió qué partida conservar. choice: 'local' | 'cloud'.
 * 'cloud' recarga la página (salvo opts.reload === false). -> { ok } | { error }
 */
export async function resolveConflict(choice, opts = {}) {
  const c = pendingConflict;
  if (!c) return { ok: true };
  if (choice === 'cloud') {
    pendingConflict = null;
    adoptCloud({ data: c.cloudData, rev: c.rev }, opts.reload !== false);
    emitStatus();
    return { ok: true };
  }
  pendingConflict = null;
  const r = await pushNow({ force: true });
  if (r?.error) { pendingConflict = c; return r; }
  emitStatus();
  return { ok: true };
}

// ---------- Subir partida ----------
async function tickPush() {
  if (!net.user || pendingConflict) return;
  const s = store.state;
  if (store.dirty || stateHash(s) !== lastPushedHash) await pushNow();
  publishProfileNow(false);
}
/** Sube ya la partida (si no hay conflicto pendiente). -> resultado de pushSave */
export async function pushNow(opts = {}) {
  if (!net.user || pushing || (pendingConflict && !opts.force)) return null;
  if (store.dirty) store.save();
  const s = store.state;
  const meta = readMeta();
  const uid = net.user.id;
  const rev = meta.userId === uid ? meta.rev ?? null : null;
  pushing = true;
  let r;
  try { r = await net.pushSave(s, rev, { force: !!opts.force }); } finally { pushing = false; }
  if (r?.error) { emitStatus(); return r; }
  if (r?.conflict) {
    if (net.user?.id !== uid) return r;   // cerró sesión en el medio
    // otro dispositivo guardó en el medio: preguntar
    const cloud = await net.pullSave();
    if (cloud && !cloud.error) {
      pendingConflict = { local: summary(s), cloud: summary(cloud.data, cloud.updated_at), cloudData: cloud.data, rev: cloud.rev };
      bus.emit('online:conflict', conflictInfo());
    }
    emitStatus();
    return r;
  }
  lastPushedHash = stateHash(s);
  lastSync = r.updated_at || new Date().toISOString();
  writeMeta({ userId: uid, rev: r.rev, hash: lastPushedHash });   // uid capturado: la subida fue de esa cuenta aunque haya salido en el medio
  emitStatus();
  return r;
}

// ---------- Perfil público ----------
/** Arma el perfil público a partir del estado (puro). */
export function buildPublicProfile(s = store.state, now = Date.now()) {
  const g = s.games || {};
  const week = s.online?.week?.id === isoWeek() ? s.online.week : { id: isoWeek(), match3: 0, blocks: 0, parking: 0, driving: 0, stars: 0 };
  let pop = 0, happy = 0;
  try { pop = population(s, now); happy = happiness(s, now).pct; } catch {}
  return {
    // con el nombre por defecto no se pisa el nombre de la cuenta (el que eligió al registrarse)
    name: s.player?.name && s.player.name !== DEFAULT_NAME ? s.player.name : undefined,
    cityName: s.player?.cityName, level: s.player?.level,
    look: s.princess, car: s.car,
    city: {
      buildings: (s.city?.buildings || []).map(b => {
        const o = { id: b.id, x: b.x, z: b.z, rot: b.rot, level: b.level, uid: b.uid };
        const end = Math.max(b.buildEnd || 0, b.upgradeEnd || 0);
        if (end > now) o.busyUntil = end;     // obra en curso: las amigas pueden ayudar
        if (end > now) o.busyKind = (b.buildEnd || 0) > now ? 'build' : 'upgrade';   // obra nueva o mejora
        return o;
      }),
      expansions: s.city?.expansions || 0,
      flagColor: s.city?.flagColor,
    },
    stats: {
      pop, happy,
      best: {
        match3: g.match3?.level || 1, blocks: g.blocks?.best || 0,
        parking: g.parking?.level || 1, driving: g.driving?.best || 0,
      },
      week,
      album: albumCode(s),
    },
  };
}

/**
 * Álbum compacto para el perfil público: un carácter base 36 por figurita (orden de STICKERS),
 * con la cantidad que tiene (tope 35). Sirve para que las amigas vean qué repetidas tenés y qué te falta.
 * -> { v:1, c:'0102…' } (108 caracteres)
 */
export function albumCode(s = store.state) {
  const have = s?.album?.have || {};
  return { v: 1, c: STICKERS.map(st => Math.min(35, Math.max(0, have[st.id] | 0)).toString(36)).join('') };
}
/** Decodifica albumCode -> { id: count } (solo las que tiene). null si no hay datos. */
export function decodeAlbum(a) {
  const c = a?.c;
  if (typeof c !== 'string' || !c) return null;
  const out = {};
  STICKERS.forEach((st, i) => { const n = parseInt(c[i] || '0', 36) || 0; if (n) out[st.id] = n; });
  return out;
}
export async function publishProfileNow(force = false) {
  if (!net.user) return null;
  const p = buildPublicProfile();
  const json = JSON.stringify(p);
  if (!force && (json === lastProfileJson || Date.now() - lastProfileAt < PROFILE_MIN_MS)) return null;
  lastProfileAt = Date.now();
  const r = await net.publishProfile(p);
  if (!r?.error) lastProfileJson = json;
  return r;
}

// Estadísticas de la semana (para el ranking): se guardan en state.online.week
function trackWeekStats() {
  bus.on('minigame:finished', ({ game, score = 0, stars = 0 } = {}) => {
    const s = store.state;
    if (!s) return;
    s.online ??= {};
    const id = isoWeek();
    if (s.online.week?.id !== id) s.online.week = { id, match3: 0, blocks: 0, parking: 0, driving: 0, stars: 0 };
    const w = s.online.week;
    if (game in w && game !== 'id' && game !== 'stars') w[game] = Math.max(w[game] || 0, Math.round(score) || 0);
    w.stars += Math.max(0, stars | 0);
    store.markDirty();
  });
}

// ---------- Buzón ----------
/** Consulta el buzón y emite 'online:inbox'. -> lista | { error } */
export async function refreshInbox() {
  if (!net.user) return [];
  const r = await net.inbox();
  if (r?.error) { emitStatus(); return r; }
  inboxCount = r.length;
  bus.emit('online:inbox', { count: r.length, items: r });
  emitStatus();
  return r;
}

/** Cobra un regalo y lo acredita. -> { payload, summary } | null (ya cobrado) | { error } */
export async function claimAndApply(gift) {
  const id = typeof gift === 'object' ? gift.id : gift;
  const payload = await net.claimGift(id);
  if (payload?.error) return payload;
  if (payload == null) { refreshInbox(); return null; }
  const summaryApplied = applyGiftPayload(payload, gift?.kind || 'gift');
  store.save();
  refreshInbox();
  return { payload, summary: summaryApplied };
}
/** "Cobrar todo": -> { count, total:{coins,gems,xp,items,stickers}, gifts } | { error } */
export async function claimAllAndApply() {
  const list = await net.claimAll();
  if (list?.error) return list;
  const total = { coins: 0, gems: 0, xp: 0, items: {}, stickers: {}, chests: {}, speedups: 0, likes: 0 };
  for (const g of list) {
    if (g.kind === 'like') { total.likes++; continue; }
    const s = applyGiftPayload(g.payload, g.kind);
    total.coins += s.coins; total.gems += s.gems; total.xp += s.xp; total.speedups += s.speedups;
    for (const k of ['items', 'stickers', 'chests']) for (const [id, n] of Object.entries(s[k])) total[k][id] = (total[k][id] || 0) + n;
  }
  store.save();
  inboxCount = 0;
  bus.emit('online:inbox', { count: 0, items: [] });
  return { count: list.length, total, gifts: list };
}

// ---------- Acreditar / descontar recursos (helpers puros sobre el store) ----------
let stickerAdder = null;
/** El sistema de figuritas puede registrar cómo se suman: fn(id, n). Por defecto: state.stickers[id] += n. */
export function setStickerAdder(fn) { stickerAdder = fn; }
let stickerTaker = null, stickerCanTake = null;
/**
 * fn(id, n) -> boolean: cómo se descuentan figuritas (para escrow). Por defecto: state.stickers[id].
 * canFn(id, n) -> boolean (opcional): si se pueden descontar, para canAffordPayload (sin tocar nada).
 */
export function setStickerTaker(fn, canFn = null) { stickerTaker = fn; stickerCanTake = canFn; }

const posInt = v => Math.max(0, Math.floor(Number(v) || 0));
const entries = o => (o && typeof o === 'object' && !Array.isArray(o) ? Object.entries(o) : []);

/**
 * Suma un payload {coins, gems, xp, items:{id:n}, stickers:{id:n}, chests:{tipo:n}, minutes, uid}
 * usando store.grant y la mochila de chests.js. Ignora negativos e ids desconocidos.
 * -> { coins, gems, xp, items:{}, stickers:{}, chests:{}, speedups }
 */
export function applyGiftPayload(payload, source = 'gift') {
  const out = { coins: 0, gems: 0, xp: 0, items: {}, stickers: {}, chests: {}, speedups: 0 };
  if (!payload || typeof payload !== 'object') return out;
  const s = store.state;
  out.coins = posInt(payload.coins); out.gems = posInt(payload.gems); out.xp = posInt(payload.xp);
  if (out.coins || out.gems || out.xp) store.grant({ coins: out.coins, gems: out.gems, xp: out.xp }, 'online:' + source);

  const itemList = entries(payload.items).filter(([id, n]) => ITEMS[id] && posInt(n));
  if (itemList.length) {
    chestCount(); // asegura state.chests
    for (const [id, n] of itemList) { s.chests.items[id] = (s.chests.items[id] || 0) + posInt(n); out.items[id] = posInt(n); }
    bus.emit('chests:changed', { received: out.items, source: 'online' });
  }
  for (const [type, n] of entries(payload.chests)) if (CHESTS[type] && posInt(n)) { addChest(type, posInt(n), 'online'); out.chests[type] = posInt(n); }

  const st = entries(payload.stickers).filter(([, n]) => posInt(n));
  if (st.length) {
    for (const [id, n] of st) {
      if (stickerAdder) stickerAdder(id, posInt(n));
      else { s.stickers ??= {}; s.stickers[id] = (s.stickers[id] || 0) + posInt(n); }
      out.stickers[id] = posInt(n);
    }
    bus.emit('stickers:received', { stickers: out.stickers, source });
  }

  // ayuda en obra: adelanta la obra/mejora del edificio uid
  const minutes = posInt(payload.minutes);
  if (minutes && payload.uid != null) {
    const b = s.city?.buildings?.find(x => x.uid === payload.uid);
    const now = Date.now();
    if (b && (b.buildEnd > now || b.upgradeEnd > now)) {
      if (b.buildEnd > now) b.buildEnd = Math.max(now, b.buildEnd - minutes * 60e3);
      if (b.upgradeEnd > now) b.upgradeEnd = Math.max(now, b.upgradeEnd - minutes * 60e3);
      out.speedups++;
      bus.emit('online:speedup', { uid: b.uid, minutes });
    }
  }
  store.markDirty();
  bus.emit('online:applied', { payload, summary: out, source });
  return out;
}

/** ¿Alcanza para entregar este payload? (monedas, gemas, objetos de mochila, figuritas) */
export function canAffordPayload(p = {}) {
  const s = store.state;
  if (posInt(p.coins) > s.coins || posInt(p.gems) > s.gems) return false;
  for (const [id, n] of entries(p.items)) if ((s.chests?.items?.[id] || 0) < posInt(n)) return false;
  for (const [id, n] of entries(p.stickers)) {
    if (stickerTaker) { if (stickerCanTake && !stickerCanTake(id, posInt(n))) return false; }
    else if ((s.stickers?.[id] || 0) < posInt(n)) return false;
  }
  return true;
}
/** Descuenta un payload (escrow al proponer intercambio / al aceptar / al completar un pedido). -> boolean */
export function deductPayload(p = {}, reason = 'online') {
  if (!canAffordPayload(p)) return false;
  const s = store.state;
  // figuritas primero: si el sistema de figuritas se niega, no se descontó nada más
  const taken = [];
  for (const [id, n] of entries(p.stickers)) if (posInt(n)) {
    if (stickerTaker) {
      if (!stickerTaker(id, posInt(n))) { for (const [tid, tn] of taken) stickerAdder?.(tid, tn); return false; }
      taken.push([id, posInt(n)]);
    } else s.stickers[id] -= posInt(n);
  }
  if (posInt(p.coins) || posInt(p.gems)) store.spend({ coins: posInt(p.coins), gems: posInt(p.gems) }, reason);
  let items = false;
  for (const [id, n] of entries(p.items)) if (posInt(n)) { s.chests.items[id] -= posInt(n); items = true; }
  if (items) bus.emit('chests:changed', { used: 'online' });
  store.markDirty();
  store.save();
  return true;
}
