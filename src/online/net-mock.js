// Adaptador simulado: la misma API que Supabase sobre localStorage ('pixelia.mockdb'),
// compartido entre pestañas del mismo origen. Sirve para probar flujos de varias jugadoras sin servidor:
//
//   pestaña 1: /?mock=1&mockuser=ana      pestaña 2: /?mock=1&mockuser=bea
//
// ?mockuser=nombre inicia sesión sola (crea la cuenta nombre@mock.test / contraseña 'mock').
// Sin mockuser: signUp/signIn normales. La sesión es por pestaña (sessionStorage).
// Replica las reglas de schema.sql (límites diarios, amistad, atomicidad, devoluciones) y los
// mensajes de error. Cada operación corre bajo navigator.locks → atómica entre pestañas.
// Los días se cuentan en UTC (como el servidor). debug.advanceDays(n) simula "mañana".
import { isoWeek, DEFAULT_PLAYER_NAME } from './net.js';

const KEY = 'pixelia.mockdb';
const SESSION_KEY = 'pixelia.mocksession';
const LOGGED_OUT_KEY = 'pixelia.mockloggedout';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DAY = 864e5;

// ---------- Errores ----------
class RpcError extends Error { constructor(m) { super(m); this.code = 'P0001'; } }
const E = (m) => { throw new RpcError(m); };

// ---------- Base ----------
const fresh = () => ({ v: 1, seq: 1, dayOffset: 0, users: {}, profiles: {}, saves: {}, friendships: {}, gifts: [], trades: [], visits: {}, requests: [], coop: {} });
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.v === 1) return d; } catch {}
  return fresh();
}
function persist(db) {
  // limpieza para no llenar el localStorage
  const t = nowMs(db);
  db.gifts = db.gifts.filter(g => !g.claimed_at || t - Date.parse(g.claimed_at) < 14 * DAY);
  db.trades = db.trades.filter(x => x.status === 'pending' || t - Date.parse(x.resolved_at) < 14 * DAY);
  db.requests = db.requests.filter(r => t - Date.parse(r.created_at) < 7 * DAY);
  for (const [k, v] of Object.entries(db.visits)) if (t - Date.parse(v.updated_at) > 21 * DAY) delete db.visits[k];
  localStorage.setItem(KEY, JSON.stringify(db));
}
/**
 * Transacción: lee, aplica fn y guarda solo si no hubo error y si fn cambió algo. Bloqueo entre pestañas con Web Locks.
 * Las lecturas no guardan: entre pestañas el localStorage tarda un poco en propagarse, y una lectura que reescribía su
 * copia vieja pisaba lo que otra pestaña acababa de guardar (se perdía, p. ej., un intercambio recién propuesto).
 */
async function tx(fn) {
  const run = () => {
    const db = load();
    const before = JSON.stringify(db);
    const r = fn(db);
    if (JSON.stringify(db) !== before) persist(db);
    return r;
  };
  if (globalThis.navigator?.locks?.request) return navigator.locks.request(KEY, run);
  return run();
}
const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- Tiempo (UTC + desplazamiento de prueba) ----------
const nowMs = db => Date.now() + (db.dayOffset || 0) * DAY;
const nowIso = db => new Date(nowMs(db)).toISOString();
const today = db => nowIso(db).slice(0, 10);

// ---------- Utilidades ----------
const uuid = () => globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
const genCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const normCode = c => String(c || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const pk = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const isEmpty = o => !o || Object.keys(o).length === 0;
const nextId = db => db.seq++;

function isFriend(db, a, b) { return db.friendships[pk(a, b)]?.status === 'accepted'; }
function pairLock(db, me, other) {
  const f = db.friendships[pk(me, other)];
  if (!f || f.status !== 'accepted') E('Solo podés hacer eso con tus contactos');
  return f;
}
function bump(db, a, b, pts = 1) {
  const f = db.friendships[pk(a, b)];
  if (!f || f.status !== 'accepted') return;
  f.points += Math.max(0, pts | 0);
  if (f.last_day !== today(db)) { f.days++; f.last_day = today(db); }
}
function checkPayload(p) {
  if (p == null) return {};
  if (!isObj(p)) E('Los datos del regalo no son válidos');
  if (JSON.stringify(p).length > 4096) E('Ese paquete es demasiado grande');
  for (const [k, v] of Object.entries(p)) {
    if (['coins', 'gems', 'xp', 'minutes', 'stars', 'uid', 'qty'].includes(k)) {
      if (typeof v !== 'number' || !isFinite(v) || v < 0 || v > 1e9) E(`Los datos del regalo no son válidos (${k})`);
    } else if (k === 'items' || k === 'stickers') {
      if (!isObj(v)) E(`Los datos del regalo no son válidos (${k})`);
      for (const [k2, n] of Object.entries(v))
        if (typeof n !== 'number' || n < 1 || n > 9999 || n !== Math.trunc(n) || k2.length > 40) E(`Los datos del regalo no son válidos (${k})`);
    }
  }
  return clone(p);
}
const profileOf = (db, id) => db.profiles[id] || null;
const nameOf = (db, id) => db.profiles[id]?.name ?? null;
function visitRow(db, host, visitor) {
  const k = `${host}|${visitor}|${today(db)}`;
  return (db.visits[k] ||= { host, visitor, day: today(db), visited: false, liked: false, helped: 0, note: null, created_at: nowIso(db), updated_at: nowIso(db) });
}
function stickerTradesToday(db, u) {
  const d = today(db);
  return db.trades.filter(t => t.is_sticker && ((t.from_id === u && t.day === d) || (t.to_id === u && t.status === 'accepted' && t.resolved_at?.slice(0, 10) === d))).length;
}
function addGift(db, from, to, kind, payload, ref = null, note = null) {
  const g = { id: nextId(db), from_id: from, to_id: to, kind, payload: clone(payload) || {}, ref, note, day: today(db), created_at: nowIso(db), claimed_at: null };
  db.gifts.push(g);
  return g;
}
function refundTrade(db, t, from, note) {
  if (!isEmpty(t.offer)) addGift(db, from, t.from_id, 'trade', t.offer, t.id, note);
}
function needProfile(db, me) { if (!db.profiles[me]) E('Primero creá tu perfil online'); }
function friendIds(db, me) {
  return Object.values(db.friendships).filter(f => f.status === 'accepted' && (f.a === me || f.b === me)).map(f => (f.a === me ? f.b : f.a));
}

// ---------- RPCs (mismos nombres, argumentos y formas que schema.sql) ----------
const RPC = {
  is_friend(db, me, { p_a, p_b }) { return !!me && (me === p_a || me === p_b) && isFriend(db, p_a, p_b); },

  ensure_profile(db, me, { p_name }) {
    if (db.profiles[me]) return clone(db.profiles[me]);
    const used = new Set(Object.values(db.profiles).map(p => p.code));
    let code; do code = genCode(); while (used.has(code));
    const n = String(p_name || '').trim().slice(0, 24) || DEFAULT_PLAYER_NAME;
    db.profiles[me] = { id: me, code, name: n, city_name: 'Pixelia', level: 1, look: {}, car: {}, city: {}, stats: {}, updated_at: nowIso(db), last_seen: nowIso(db) };
    return clone(db.profiles[me]);
  },
  create_profile(db, me, a) { return RPC.ensure_profile(db, me, a); },

  publish_profile(db, me, { p }) {
    if (!isObj(p)) E('Perfil inválido');
    if (JSON.stringify(p.city || {}).length > 65536) E('Tu ciudad es demasiado grande para publicarla');
    if (JSON.stringify(p.stats || {}).length > 8192) E('Estadísticas demasiado grandes');
    if (JSON.stringify(p.look || {}).length > 2048 || JSON.stringify(p.car || {}).length > 2048) E('Datos de personaje demasiado grandes');
    RPC.ensure_profile(db, me, { p_name: p.name });
    const r = db.profiles[me];
    const s = v => (typeof v === 'string' ? v.trim().slice(0, 24) : '');
    if (s(p.name)) r.name = s(p.name);
    if (s(p.cityName)) r.city_name = s(p.cityName);
    if (typeof p.level === 'number') r.level = Math.min(999, Math.max(1, Math.floor(p.level)));
    for (const k of ['look', 'car', 'city', 'stats']) if (isObj(p[k])) r[k] = clone(p[k]);
    r.updated_at = r.last_seen = nowIso(db);
    return clone(r);
  },
  get_my_profile(db, me) { return clone(profileOf(db, me)); },
  find_by_code(db, me, { p_code }) {
    const c = normCode(p_code);
    const p = Object.values(db.profiles).find(x => x.code === c);
    return p ? [{ id: p.id, code: p.code, name: p.name, level: p.level }] : [];
  },
  get_profiles(db, me, { p_ids }) {
    return (p_ids || []).slice(0, 100).map(id => db.profiles[id]).filter(Boolean).map(p => {
      const ok = p.id === me || isFriend(db, me, p.id);
      return {
        id: p.id, code: p.code, name: p.name, level: p.level,
        city_name: ok ? p.city_name : null, look: ok ? clone(p.look) : null, car: ok ? clone(p.car) : null,
        city: ok ? clone(p.city) : null, stats: ok ? clone(p.stats) : null,
        last_seen: ok ? p.last_seen : null, updated_at: ok ? p.updated_at : null, friend: ok && p.id !== me,
      };
    });
  },

  pull_save(db, me) {
    if (db.profiles[me]) db.profiles[me].last_seen = nowIso(db);
    const s = db.saves[me];
    return s ? { data: clone(s.data), rev: s.rev, updated_at: s.updated_at } : null;
  },
  push_save(db, me, { p_data, p_rev, p_force }) {
    if (!isObj(p_data)) E('Partida inválida');
    if (JSON.stringify(p_data).length > 1500000) E('La partida es demasiado grande para guardarla en la nube');
    let s = db.saves[me];
    if (!s) s = db.saves[me] = { data: clone(p_data), rev: 1, updated_at: nowIso(db) };
    else if (!p_force && (p_rev ?? null) !== s.rev) return { ok: false, conflict: true, rev: s.rev, updated_at: s.updated_at };
    else Object.assign(s, { data: clone(p_data), rev: s.rev + 1, updated_at: nowIso(db) });
    if (db.profiles[me]) db.profiles[me].last_seen = nowIso(db);
    return { ok: true, rev: s.rev, updated_at: s.updated_at };
  },

  request_friend(db, me, { p_code }) {
    needProfile(db, me);
    const c = normCode(p_code);
    if (c.length !== 6) E('El código tiene 6 letras y números');
    const o = Object.values(db.profiles).find(x => x.code === c);
    if (!o) E(`No encontramos a nadie con el código ${c}`);
    if (o.id === me) E('Ese es tu propio código 😄');
    const f = db.friendships[pk(me, o.id)];
    if (f) {
      if (f.status === 'accepted') E(`${o.name} ya está entre tus contactos`);
      if (f.requested_by === me) E(`Ya le mandaste una solicitud a ${o.name}, falta que acepte`);
      f.status = 'accepted'; f.accepted_at = nowIso(db);
      return { id: o.id, name: o.name, status: 'accepted' };
    }
    const mine = Object.values(db.friendships);
    if (mine.filter(x => x.requested_by === me && x.status === 'pending').length >= 30) E('Tenés muchas solicitudes sin responder. Esperá que te acepten');
    if (friendIds(db, me).length >= 100) E('Llegaste al máximo de 100 contactos');
    const [a, b] = me < o.id ? [me, o.id] : [o.id, me];
    db.friendships[pk(a, b)] = { a, b, status: 'pending', requested_by: me, points: 0, days: 0, last_day: null, created_at: nowIso(db), accepted_at: null };
    return { id: o.id, name: o.name, status: 'pending' };
  },
  respond_friend(db, me, { p_other, p_accept }) {
    const k = pk(me, p_other), f = db.friendships[k];
    if (!f || f.status !== 'pending' || f.requested_by === me) E('Esa solicitud ya no está disponible');
    if (p_accept) { f.status = 'accepted'; f.accepted_at = nowIso(db); return { status: 'accepted' }; }
    delete db.friendships[k];
    return { status: 'declined' };
  },
  remove_friend(db, me, { p_other }) {
    const k = pk(me, p_other);
    if (!db.friendships[k]) E('No está entre tus contactos');
    delete db.friendships[k];
    for (const t of db.trades) {
      if (t.status === 'pending' && ((t.from_id === me && t.to_id === p_other) || (t.from_id === p_other && t.to_id === me))) {
        t.status = 'cancelled'; t.resolved_at = nowIso(db);
        refundTrade(db, t, t.to_id, 'Devolución: intercambio cancelado');
      }
    }
    return { ok: true };
  },
  friends_view(db, me) {
    return Object.values(db.friendships).filter(f => f.a === me || f.b === me).map(f => {
      const p = db.profiles[f.a === me ? f.b : f.a];
      if (!p) return null;
      const acc = f.status === 'accepted';
      return {
        id: p.id, name: p.name, code: p.code, level: p.level,
        city_name: acc ? p.city_name : null, look: acc ? clone(p.look) : null,
        points: f.points, days: f.days, status: f.status, incoming: f.status === 'pending' && f.requested_by !== me,
        last_seen: acc ? p.last_seen : null, since: f.accepted_at || f.created_at,
      };
    }).filter(Boolean).sort((x, y) => (y.status === 'pending') - (x.status === 'pending') || String(y.last_seen || '').localeCompare(String(x.last_seen || '')));
  },

  send_gift(db, me, { p_to, p_kind, p_payload }) {
    if (!['gift', 'help', 'sticker'].includes(p_kind)) E('Ese tipo de regalo no existe');
    if (p_to === me) E('No te podés mandar regalos a vos misma 😄');
    pairLock(db, me, p_to);
    const pl = checkPayload(p_payload);
    const d = today(db);
    let pts;
    if (p_kind === 'gift') {
      if (db.gifts.some(g => g.from_id === me && g.to_id === p_to && g.kind === 'gift' && g.day === d)) E('Ya le mandaste el regalo de hoy 🎁 ¡Volvé mañana!');
      pts = 2;
    } else if (p_kind === 'help') {
      const v = visitRow(db, p_to, me);
      if (v.helped >= 3) E('Ya ayudaste 3 veces hoy en esta ciudad. ¡Mañana más!');
      v.helped++; v.updated_at = nowIso(db);
      pts = 1;
    } else {
      if (db.gifts.filter(g => g.from_id === me && g.to_id === p_to && g.kind === 'sticker' && g.day === d).length >= 3) E('Ya le regalaste 3 figuritas hoy');
      pts = 2;
    }
    const g = addGift(db, me, p_to, p_kind, pl);
    bump(db, me, p_to, pts);
    return { ok: true, id: g.id };
  },
  my_inbox(db, me) {
    return db.gifts.filter(g => g.to_id === me && !g.claimed_at).slice(0, 200)
      .map(g => ({ id: g.id, from_id: g.from_id, from_name: nameOf(db, g.from_id), kind: g.kind, payload: clone(g.payload), ref: g.ref, note: g.note, created_at: g.created_at }));
  },
  claim_gift(db, me, { p_id }) {
    const g = db.gifts.find(x => x.id === p_id && x.to_id === me && !x.claimed_at);
    if (!g) return null;
    g.claimed_at = nowIso(db);
    return clone(g.payload) || {};
  },
  claim_all_gifts(db, me) {
    const out = [];
    for (const g of db.gifts) if (g.to_id === me && !g.claimed_at) { g.claimed_at = nowIso(db); out.push({ id: g.id, kind: g.kind, from_id: g.from_id, payload: clone(g.payload) }); }
    return out;
  },

  propose_trade(db, me, { p_to, p_offer, p_request }) {
    if (p_to === me) E('No podés intercambiar con vos misma');
    const f = pairLock(db, me, p_to);
    const o = checkPayload(p_offer), r = checkPayload(p_request);
    if (isEmpty(o) && isEmpty(r)) E('El intercambio está vacío');
    if (db.trades.filter(t => t.from_id === me && t.status === 'pending').length >= 5) E('Tenés 5 intercambios esperando respuesta. Esperá a que te contesten o cancelá alguno');
    const st = 'stickers' in o || 'stickers' in r;
    if (st) {
      const onlySt = x => Object.keys(x).every(k => k === 'stickers' || k === 'stars' || k === 'golden');
      if (!onlySt(o) || !onlySt(r)) E('En un intercambio de figuritas solo van figuritas (sin monedas ni objetos)');
      if (!('stickers' in o && 'stickers' in r)) E('Hace falta una figurita de cada lado');
      const one = x => Object.keys(x.stickers).length === 1 && Object.values(x.stickers).reduce((a, b) => a + b, 0) === 1;
      if (!one(o) || !one(r)) E('Se intercambia de a una figurita por lado');
      if (typeof o.stars !== 'number' || typeof r.stars !== 'number') E('Faltan las estrellas de las figuritas');
      const ok = s => s >= 1 && s <= 5 && s === Math.trunc(s);
      if (!ok(o.stars) || !ok(r.stars)) E('Las estrellas van de 1 a 5');
      if (Math.abs(o.stars - r.stars) > 1) E('Las figuritas tienen que tener estrellas parecidas (como mucho 1 de diferencia)');
      // golden: Semana Dorada (eventFlag('trade5'), calculado en el cliente) habilita 5★ sin los 14 días
      if (Math.max(o.stars, r.stars) === 5 && f.days < 14 && o.golden !== true) E('Las figuritas de 5 estrellas se cambian con amistades de 14 días o más');
      if (stickerTradesToday(db, me) >= 5) E('Ya hiciste 5 intercambios de figuritas hoy. ¡Mañana más!');
    }
    const t = { id: nextId(db), from_id: me, to_id: p_to, offer: o, request: r, status: 'pending', is_sticker: st, day: today(db), created_at: nowIso(db), resolved_at: null };
    db.trades.push(t);
    return { ok: true, id: t.id };
  },
  list_trades(db, me) {
    const t0 = nowMs(db) - 7 * DAY;
    return db.trades
      .filter(t => (t.from_id === me || t.to_id === me) && (t.status === 'pending' || Date.parse(t.resolved_at) > t0))
      .sort((x, y) => (y.status === 'pending') - (x.status === 'pending') || y.created_at.localeCompare(x.created_at))
      .slice(0, 50)
      .map(t => {
        const other = t.from_id === me ? t.to_id : t.from_id;
        return { id: t.id, from_id: t.from_id, to_id: t.to_id, other_id: other, other_name: nameOf(db, other), outgoing: t.from_id === me, offer: clone(t.offer), request: clone(t.request), status: t.status, is_sticker: t.is_sticker, created_at: t.created_at, resolved_at: t.resolved_at };
      });
  },
  respond_trade(db, me, { p_id, p_accept }) {
    const t = db.trades.find(x => x.id === p_id && x.to_id === me);
    if (!t) E('No encontramos ese intercambio');
    if (t.status !== 'pending') E(`Ese intercambio ya no está disponible (${t.status === 'accepted' ? 'ya fue aceptado' : t.status === 'declined' ? 'fue rechazado' : 'fue cancelado'})`);
    if (p_accept) {
      pairLock(db, me, t.from_id);
      if (t.is_sticker && stickerTradesToday(db, me) >= 5) E('Ya hiciste 5 intercambios de figuritas hoy. ¡Mañana más!');
      t.status = 'accepted'; t.resolved_at = nowIso(db);
      if (!isEmpty(t.offer)) addGift(db, t.from_id, t.to_id, 'trade', t.offer, t.id, 'Intercambio aceptado');
      if (!isEmpty(t.request)) addGift(db, t.to_id, t.from_id, 'trade', t.request, t.id, 'Intercambio aceptado');
      bump(db, t.from_id, t.to_id, 3);
      return { ok: true, status: 'accepted', offer: clone(t.offer), request: clone(t.request) };
    }
    t.status = 'declined'; t.resolved_at = nowIso(db);
    refundTrade(db, t, t.to_id, 'Devolución: intercambio rechazado');
    return { ok: true, status: 'declined' };
  },
  cancel_trade(db, me, { p_id }) {
    const t = db.trades.find(x => x.id === p_id && x.from_id === me && x.status === 'pending');
    if (!t) E('Ese intercambio ya no se puede cancelar');
    t.status = 'cancelled'; t.resolved_at = nowIso(db);
    refundTrade(db, t, t.from_id, 'Devolución: intercambio cancelado');
    return { ok: true, status: 'cancelled' };
  },

  visit(db, me, { p_host }) {
    if (p_host === me) E('Esa es tu ciudad 😄');
    pairLock(db, me, p_host);
    const v = visitRow(db, p_host, me);
    const first = !v.visited;
    if (first) { v.visited = true; v.updated_at = nowIso(db); bump(db, me, p_host, 1); }
    return { first };
  },
  give_like(db, me, { p_host }) {
    if (p_host === me) E('No te podés dar corazón a vos misma 😄');
    pairLock(db, me, p_host);
    const v = visitRow(db, p_host, me);
    if (v.liked) E('Ya le diste ❤️ hoy. ¡Mañana podés de nuevo!');
    v.liked = true; v.updated_at = nowIso(db);
    addGift(db, me, p_host, 'like', {}, null, '❤️');
    bump(db, me, p_host, 2);
    return { ok: true };
  },
  leave_note(db, me, { p_host, p_text }) {
    const t = String(p_text || '').trim();
    if (p_host === me) E('Esa es tu ciudad 😄');
    if (!t) E('Escribí algo antes de mandarla');
    if ([...t].length > 80) E('La nota puede tener hasta 80 letras');
    pairLock(db, me, p_host);
    const v = visitRow(db, p_host, me);
    if (v.note != null) E('Ya le dejaste una nota hoy');
    v.note = t; v.updated_at = nowIso(db);
    bump(db, me, p_host, 1);
    return { ok: true };
  },
  visitors_to_me(db, me, { p_since }) {
    const since = p_since ? Date.parse(p_since) : nowMs(db) - 7 * DAY;
    return Object.values(db.visits).filter(v => v.host === me && Date.parse(v.updated_at) >= since)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 100)
      .map(v => ({ id: v.visitor, name: nameOf(db, v.visitor), day: v.day, visited: v.visited, liked: v.liked, helped: v.helped, note: v.note, at: v.updated_at }));
  },

  create_request(db, me, { p_kind, p_payload, p_qty }) {
    if (!['item', 'coins', 'speedup', 'sticker'].includes(p_kind)) E('Ese tipo de pedido no existe');
    if (!Number.isInteger(p_qty) || p_qty < 1 || p_qty > 99) E('Cantidad inválida');
    needProfile(db, me);
    const pl = checkPayload(p_payload);
    if (db.requests.filter(r => r.from_id === me && r.day === today(db)).length >= 3) E('Ya pediste 3 manos hoy. ¡Mañana podés pedir más!');
    const r = { id: nextId(db), from_id: me, kind: p_kind, payload: pl, qty: p_qty, filled_by: null, filled_at: null, day: today(db), created_at: nowIso(db), expires_at: new Date(nowMs(db) + DAY).toISOString() };
    db.requests.push(r);
    return { ok: true, id: r.id, expires_at: r.expires_at };
  },
  list_friend_requests(db, me) {
    const t = nowMs(db);
    return db.requests.filter(r => !r.filled_by && Date.parse(r.expires_at) > t && r.from_id !== me && isFriend(db, me, r.from_id))
      .sort((a, b) => a.expires_at.localeCompare(b.expires_at)).slice(0, 100)
      .map(r => ({ id: r.id, from_id: r.from_id, from_name: nameOf(db, r.from_id), kind: r.kind, payload: clone(r.payload), qty: r.qty, created_at: r.created_at, expires_at: r.expires_at }));
  },
  my_requests(db, me) {
    const t0 = nowMs(db) - 3 * DAY;
    return db.requests.filter(r => r.from_id === me && Date.parse(r.created_at) > t0)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(r => ({ id: r.id, kind: r.kind, payload: clone(r.payload), qty: r.qty, filled_by: r.filled_by, filled_by_name: r.filled_by ? nameOf(db, r.filled_by) : null, filled_at: r.filled_at, created_at: r.created_at, expires_at: r.expires_at }));
  },
  fill_request(db, me, { p_id }) {
    const r = db.requests.find(x => x.id === p_id);
    if (!r) E('No encontramos ese pedido');
    if (r.from_id === me) E('No podés completar tu propio pedido 😅');
    if (r.filled_by) E('Alguien más ya completó ese pedido 💨');
    if (Date.parse(r.expires_at) <= nowMs(db)) E('Ese pedido ya venció');
    pairLock(db, me, r.from_id);
    r.filled_by = me; r.filled_at = nowIso(db);
    addGift(db, me, r.from_id, 'request_fill', { ...clone(r.payload), request: { id: r.id, kind: r.kind, qty: r.qty } }, r.id, 'Pedido completado');
    bump(db, me, r.from_id, 3);
    return { ok: true, id: r.id, from_id: r.from_id, kind: r.kind, payload: clone(r.payload), qty: r.qty };
  },

  add_coop_points(db, me, { p_n }) {
    if (!Number.isFinite(p_n) || p_n <= 0 || p_n > 100000) E('Cantidad inválida');
    const wk = isoWeek(new Date(nowMs(db)));
    const c = (db.coop[`${me}|${wk}`] ||= { user_id: me, week: wk, points: 0, day: today(db), day_points: 0 });
    const dp = c.day === today(db) ? c.day_points : 0;
    const add = Math.max(0, Math.min(Math.round(p_n), 2000 - dp));
    c.points += add; c.day = today(db); c.day_points = dp + add;
    return { week: wk, mine: c.points, added: add, capped: add < p_n };
  },
  coop_status(db, me, { p_week }) {
    const wk = p_week || isoWeek(new Date(nowMs(db)));
    const ids = [me, ...friendIds(db, me)].filter(id => db.profiles[id]);
    const members = ids.map(id => ({ id, name: nameOf(db, id), points: db.coop[`${id}|${wk}`]?.points || 0, me: id === me }))
      .sort((a, b) => b.points - a.points || String(a.name).localeCompare(String(b.name)));
    return { week: wk, mine: db.coop[`${me}|${wk}`]?.points || 0, total: members.reduce((s, m) => s + m.points, 0), members };
  },
  friends_leaderboard(db, me, { p_week }) {
    return [me, ...friendIds(db, me)].map(id => db.profiles[id]).filter(Boolean).map(p => {
      const w = p.stats?.week;
      return { id: p.id, name: p.name, level: p.level, week: w && (!p_week || w.id === p_week) ? clone(w) : null, me: p.id === me };
    }).sort((a, b) => b.level - a.level || String(a.name).localeCompare(String(b.name)));
  },
};

// ---------- Adaptador ----------
export function createMockAdapter() {
  const authFns = new Set();
  let q;
  try { q = new URLSearchParams(location.search); } catch { q = new URLSearchParams(); }
  const mockUser = (q.get('mockuser') || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  const ss = (() => { try { return sessionStorage; } catch { return null; } })();
  const getSession = () => { try { return JSON.parse(ss?.getItem(SESSION_KEY)); } catch { return null; } };
  const setSession = (u) => { try { u ? ss?.setItem(SESSION_KEY, JSON.stringify(u)) : ss?.removeItem(SESSION_KEY); } catch {} };
  const toUser = u => (u ? { id: u.id, email: u.email, name: u.name } : null);
  const emit = (u) => { for (const fn of [...authFns]) { try { fn(u); } catch (e) { console.error(e); } } };
  const current = () => getSession()?.id || null;

  // cambios de otras pestañas: si borraron la base (debug.reset) cerramos sesión
  try {
    addEventListener('storage', (ev) => { if (ev.key === KEY && ev.newValue == null && current()) { setSession(null); emit(null); } });
  } catch {}

  const adapter = {
    mode: 'mock',

    async getUser() {
      await sleep(5);
      let loggedOut = false;
      try { loggedOut = ss?.getItem(LOGGED_OUT_KEY) === '1'; } catch {}
      if (mockUser && !loggedOut) {
        const email = `${mockUser}@mock.test`;
        const u = await tx(db => {
          let x = Object.values(db.users).find(y => y.email === email);
          if (!x) { x = { id: uuid(), email, password: 'mock', name: mockUser[0].toUpperCase() + mockUser.slice(1), created_at: nowIso(db) }; db.users[x.id] = x; }
          return toUser(x);
        });
        setSession(u);
        return u;
      }
      const s = getSession();
      if (!s) return null;
      const db = load();
      if (!db.users[s.id]) { setSession(null); return null; }
      return toUser(db.users[s.id]);
    },
    onAuthChange(cb) { authFns.add(cb); return () => authFns.delete(cb); },

    async signUp(email, password, name) {
      await sleep(30);
      const u = await tx(db => {
        if (Object.values(db.users).some(y => y.email === email)) throw new Error('User already registered');
        const x = { id: uuid(), email, password, name, created_at: nowIso(db) };
        db.users[x.id] = x;
        return toUser(x);
      });
      try { ss?.removeItem(LOGGED_OUT_KEY); } catch {}
      setSession(u); emit(u);
      return { user: u };
    },
    async signIn(email, password) {
      await sleep(30);
      const db = load();
      const x = Object.values(db.users).find(y => y.email === email);
      if (!x || x.password !== password) throw new Error('Invalid login credentials');
      const u = toUser(x);
      try { ss?.removeItem(LOGGED_OUT_KEY); } catch {}
      setSession(u); emit(u);
      return { user: u };
    },
    async signOut() {
      setSession(null);
      try { ss?.setItem(LOGGED_OUT_KEY, '1'); } catch {}
      emit(null);
    },

    async rpc(name, args = {}) {
      const fn = RPC[name];
      if (!fn) throw new Error(`Could not find the function public.${name} in the schema cache`);
      const me = current();
      if (!me) E('Tenés que iniciar sesión para usar las funciones online');
      await sleep(10 + Math.random() * 40); // latencia simulada
      return clone(await tx(db => fn(db, me, args || {})));
    },

    // Herramientas para pruebas (no son parte de la API)
    debug: {
      /** Simula que pasaron n días (afecta límites diarios, vencimientos y semanas). */
      advanceDays: (n = 1) => tx(db => { db.dayOffset = (db.dayOffset || 0) + n; return db.dayOffset; }),
      reset: () => { localStorage.removeItem(KEY); },
      dump: () => load(),
      whoami: () => current(),
    },
  };
  return adapter;
}
