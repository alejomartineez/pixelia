// Fachada online: elige el adaptador y expone una API única (ver DESIGN-ONLINE.md).
//
//   ?mock=1 (+ &mockuser=ana)   → 'mock'      (localStorage compartido entre pestañas, sin servidor)
//   config.js con URL + KEY     → 'supabase'
//   si no                       → 'off'       (todo devuelve { error: 'Modo sin conexión' })
//
// Regla de oro: NUNCA tira excepciones a la UI. Los errores vuelven como { error: 'texto amable' }.
// Los éxitos devuelven el dato directo (objeto, lista o null). Chequeá siempre `res?.error`.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const TIMEOUT_MS = 10000;
export const OFF_ERROR = 'Modo sin conexión';
export const NEED_LOGIN = 'Tenés que iniciar sesión para jugar online';

// ---------- Helpers puros (también los usan la UI y el mock) ----------

/** Niveles de amistad por días de interacción. */
export const FRIEND_LEVELS = [
  { id: 'conocidas', name: 'Saludo', min: 0 },
  { id: 'amigas', name: 'Mate', min: 3 },
  { id: 'compinches', name: 'Asado', min: 14 },
  { id: 'intimas', name: 'Llave de casa', min: 45 },
  { id: 'inseparables', name: 'Familia', min: 100 },
];

/** Nombre por defecto de la partida (antes era 'Princesa': los saves y perfiles viejos lo pueden tener). */
export const DEFAULT_PLAYER_NAME = 'Pixelín';
/** ¿Es un nombre "sin elegir" (el de por defecto, actual o viejo)? */
export const isDefaultName = (n) => n === DEFAULT_PLAYER_NAME || n === 'Princesa';

// Mensajes del servidor (schema.sql, viejo o actual) → textos neutros, con "contactos" (el servidor no se toca desde acá).
const LEGACY_SERVER_MSG = [
  [/tus amig[ao]s/g, 'tus contactos'], [/^Ya son amig[ao]s con (.+)$/, '$1 ya está entre tus contactos'], [/100 amig[ao]s/, '100 contactos'],
  [/^No son amig[ao]s$/, 'No está entre tus contactos'], [/con amig[ao]s de 14 días/, 'con amistades de 14 días'],
  [/^Escribí algo cortito$/, 'Escribí algo antes de mandarla'],
  [/^Otra amiga ya completó/, 'Alguien más ya completó'], [/código de amiga/, 'código de amistad'],
];
const neutralMsg = (m) => LEGACY_SERVER_MSG.reduce((s, [re, to]) => s.replace(re, to), m);
/** -> { index, id, name, min, next (días para el próximo nivel o null), progress 0..1 } */
export function friendLevel(days = 0) {
  let i = 0;
  while (i + 1 < FRIEND_LEVELS.length && days >= FRIEND_LEVELS[i + 1].min) i++;
  const cur = FRIEND_LEVELS[i], nxt = FRIEND_LEVELS[i + 1];
  return { index: i, ...cur, next: nxt ? nxt.min : null, progress: nxt ? (days - cur.min) / (nxt.min - cur.min) : 1 };
}

/** Semana ISO 'YYYY-Www' en UTC (igual que el servidor). */
export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

/** Traduce cualquier error (red, auth, RPC) a un texto amable en español rioplatense. */
export function friendlyError(e) {
  if (!e) return 'Algo salió mal. Probá de nuevo en un rato.';
  const msg = String(e.message || e.error_description || e.msg || e.error || e);
  const code = e.code || '';
  if (code === 'P0001' || e.friendly) return neutralMsg(msg); // mensajes propios del servidor/mock (ya amables)
  if (code === 'TIMEOUT') return 'El servidor tardó demasiado. Probá de nuevo en un rato.';
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|offline/i.test(msg))
    return 'No hay conexión. Revisá tu internet y probá de nuevo.';
  if (/invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.';
  if (/already registered|already been registered|user already exists/i.test(msg)) return 'Ya hay una cuenta con ese email. Probá con "Ya tengo cuenta".';
  if (/email not confirmed/i.test(msg)) return 'Falta confirmar tu email: revisá tu correo (y la carpeta de spam).';
  if (/password.*(at least|short|characters)|weak.password/i.test(msg)) return 'La contraseña tiene que tener al menos 6 caracteres.';
  if (/(invalid|unable to validate).*email|email.*(invalid|format)/i.test(msg)) return 'Ese email no parece válido.';
  if (/rate limit|too many|429/i.test(msg)) return 'Demasiados intentos seguidos. Esperá un rato y probá de nuevo.';
  if (/jwt|token.*(expired|invalid)|not authenticated|refresh token/i.test(msg)) return 'Tu sesión venció. Volvé a iniciar sesión.';
  if (/permission denied|row-level security/i.test(msg)) return 'No tenés permiso para hacer eso.';
  if (/could not find the function|schema cache/i.test(msg)) return 'Falta configurar el servidor (corré schema.sql en Supabase).';
  return 'Algo salió mal. Probá de nuevo en un rato.';
}
const isNetErr = e => e?.code === 'TIMEOUT' || /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(String(e?.message || ''));

function withTimeout(p, ms = TIMEOUT_MS) {
  let t;
  return Promise.race([
    Promise.resolve(p).finally(() => clearTimeout(t)),
    new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })), ms); }),
  ]);
}

function pickMode() {
  let q;
  try { q = new URLSearchParams(location.search); } catch { q = new URLSearchParams(); }
  if (q.has('mock') && q.get('mock') !== '0') return 'mock';
  if (SUPABASE_URL && SUPABASE_ANON_KEY) return 'supabase';
  return 'off';
}

// ---------- Estado interno ----------
let adapter = null;
let initP = null;
const authFns = new Set();

function setUser(u) {
  const prev = net.user?.id || null;
  net.user = u ? { id: u.id, email: u.email || null } : null;
  if ((net.user?.id || null) !== prev) {
    for (const fn of [...authFns]) { try { fn(net.user); } catch (e) { console.error('[net] onAuth', e); } }
  }
}

async function doInit() {
  if (net.mode === 'off') { net.ready = true; return null; }
  try {
    if (net.mode === 'mock') adapter = (await import('./net-mock.js')).createMockAdapter();
    else adapter = (await import('./net-supabase.js')).createSupabaseAdapter(SUPABASE_URL, SUPABASE_ANON_KEY);
    net._adapter = adapter;
    adapter.onAuthChange(u => setUser(u));
    const u = await withTimeout(adapter.getUser());
    setUser(u);
    if (u) await ensureProfile(u.name);
  } catch (e) {
    console.warn('[net] init', e);
    net.lastError = friendlyError(e);
    if (isNetErr(e)) net.online = false;
  }
  net.ready = true;
  return net.user;
}

async function ensureProfile(name) {
  try { await withTimeout(adapter.rpc('ensure_profile', { p_name: name || null })); net.online = true; }
  catch (e) { console.warn('[net] ensure_profile', e); if (isNetErr(e)) net.online = false; }
}

function fail(e) {
  const msg = friendlyError(e);
  net.lastError = msg;
  if (isNetErr(e)) net.online = false;
  if (!(e?.code === 'P0001')) console.warn('[net]', e);
  return { error: msg };
}

/** Llama una RPC con todas las protecciones. map(data) da forma al resultado. */
async function call(name, args = {}, map) {
  if (net.mode === 'off') return { error: OFF_ERROR };
  await net.init();
  if (!adapter) return { error: net.lastError || 'No pudimos conectar con el servidor.' };
  if (!net.user) return { error: NEED_LOGIN };
  try {
    const data = await withTimeout(adapter.rpc(name, args));
    net.online = true;
    return map ? map(data) : data;
  } catch (e) { return fail(e); }
}
const arr = d => (Array.isArray(d) ? d : []);
const cleanEmail = e => String(e || '').trim().toLowerCase();

// ---------- API pública ----------
export const net = {
  mode: pickMode(),     // 'supabase' | 'mock' | 'off'
  user: null,           // null | { id, email }
  ready: false,
  online: true,         // false si la última llamada falló por red
  lastError: null,
  _adapter: null,       // (debug/tests)

  /** Restaura la sesión. Se puede llamar muchas veces (devuelve siempre la misma promesa). */
  init() { return (initP ||= doInit()); },

  /** fn(user|null) cuando cambia la sesión. Devuelve la función para desuscribirse. */
  onAuth(fn) { authFns.add(fn); return () => authFns.delete(fn); },

  // ----- Cuenta -----
  /** -> { user } | { user:null, needsConfirm:true, message } | { error } */
  async signUp(email, password, name) {
    if (net.mode === 'off') return { error: OFF_ERROR };
    await net.init();
    if (!adapter) return { error: net.lastError || 'No pudimos conectar con el servidor.' };
    email = cleanEmail(email); name = String(name || '').trim().slice(0, 24);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Ese email no parece válido.' };
    if (String(password || '').length < 6) return { error: 'La contraseña tiene que tener al menos 6 caracteres.' };
    if (!name) return { error: 'Elegí un nombre para que tus contactos te reconozcan.' };
    try {
      const r = await withTimeout(adapter.signUp(email, password, name));
      net.online = true;
      if (!r.user) return { user: null, needsConfirm: true, message: 'Te mandamos un email para confirmar la cuenta. Abrilo y después tocá "Ya tengo cuenta".' };
      setUser(r.user);
      await ensureProfile(name);
      return { user: net.user };
    } catch (e) { return fail(e); }
  },
  /** -> { user } | { error } */
  async signIn(email, password) {
    if (net.mode === 'off') return { error: OFF_ERROR };
    await net.init();
    if (!adapter) return { error: net.lastError || 'No pudimos conectar con el servidor.' };
    try {
      const r = await withTimeout(adapter.signIn(cleanEmail(email), String(password || '')));
      net.online = true;
      setUser(r.user);
      await ensureProfile(r.user?.name);
      return { user: net.user };
    } catch (e) { return fail(e); }
  },
  /** -> { ok:true } | { error } */
  async signOut() {
    if (net.mode === 'off') return { error: OFF_ERROR };
    await net.init();
    try { if (adapter) await withTimeout(adapter.signOut()); } catch (e) { console.warn('[net] signOut', e); }
    setUser(null);
    return { ok: true };
  },

  // ----- Partida -----
  /** -> { data, rev, updated_at } | null | { error } */
  pullSave() { return call('pull_save', {}, d => d || null); },
  /** -> { ok, rev, updated_at } | { conflict:true, rev, updated_at } | { error }. opts.force pisa la nube. */
  pushSave(data, rev = null, opts = {}) {
    return call('push_save', { p_data: data, p_rev: rev ?? null, p_force: !!opts.force });
  },

  // ----- Perfil -----
  /** p: { name, cityName, level, look, car, city, stats } -> perfil | { error } */
  publishProfile(p) { return call('publish_profile', { p }); },
  getMyProfile() { return call('get_my_profile', {}, d => d || null); },
  /** -> { id, code, name, level } | null | { error } */
  findByCode(code) { return call('find_by_code', { p_code: String(code || '') }, d => arr(d)[0] || null); },
  /** -> [{ id, code, name, level, city_name, look, car, city, stats, last_seen, updated_at, friend }] (sensibles = null si no es amiga) */
  getProfiles(ids) { return call('get_profiles', { p_ids: [...new Set(ids || [])].slice(0, 100) }, arr); },

  // ----- Amigas -----
  /** -> [{ id, name, code, level, city_name, look, points, days, status, incoming, last_seen, since, friendship }] */
  listFriends() { return call('friends_view', {}, d => arr(d).map(f => ({ ...f, friendship: friendLevel(f.days || 0) }))); },
  /** -> { id, name, status:'pending'|'accepted' } */
  requestFriend(code) { return call('request_friend', { p_code: String(code || '') }); },
  respondFriend(otherId, accept) { return call('respond_friend', { p_other: otherId, p_accept: !!accept }); },
  removeFriend(otherId) { return call('remove_friend', { p_other: otherId }); },

  // ----- Regalos / buzón -----
  /** kind: 'gift' | 'help' | 'sticker'. payload: { coins, gems, xp, items:{id:n}, stickers:{id:n}, minutes, uid } */
  sendGift(toId, kind, payload = {}) { return call('send_gift', { p_to: toId, p_kind: kind, p_payload: payload || {} }); },
  /** -> [{ id, from_id, from_name, kind, payload, ref, note, created_at }] sin cobrar */
  inbox() { return call('my_inbox', {}, arr); },
  /** -> payload | null (si ya se cobró) | { error } */
  claimGift(id) { return call('claim_gift', { p_id: id }, d => d ?? null); },
  /** Cobra todo de una -> [{ id, kind, from_id, payload }] */
  claimAll() { return call('claim_all_gifts', {}, arr); },

  // ----- Intercambios -----
  proposeTrade(toId, offer, request) { return call('propose_trade', { p_to: toId, p_offer: offer || {}, p_request: request || {} }); },
  /** -> [{ id, from_id, to_id, other_id, other_name, outgoing, offer, request, status, is_sticker, created_at, resolved_at }] */
  listTrades() { return call('list_trades', {}, arr); },
  /** -> { ok, status, offer, request } (al aceptar, el cliente descuenta `request`) */
  respondTrade(id, accept) { return call('respond_trade', { p_id: id, p_accept: !!accept }); },
  cancelTrade(id) { return call('cancel_trade', { p_id: id }); },

  // ----- Visitas -----
  /** -> { first:boolean } */
  visit(hostId) { return call('visit', { p_host: hostId }); },
  like(hostId) { return call('give_like', { p_host: hostId }); },
  /** Nota de hasta 80 letras, 1 por día por ciudad. */
  leaveNote(hostId, text) { return call('leave_note', { p_host: hostId, p_text: String(text || '') }); },
  /** -> [{ id, name, day, visited, liked, helped, note, at }] (por defecto, últimos 7 días) */
  visitorsToMe(sinceIso = null) { return call('visitors_to_me', { p_since: sinceIso || null }, arr); },

  // ----- Pedidos de ayuda ("Pedí una mano") -----
  /** kind: 'item'|'coins'|'speedup'|'sticker'; payload = lo que se entrega al completarse (ej {items:{hammer:1}}) */
  createRequest(kind, payload = {}, qty = 1) { return call('create_request', { p_kind: kind, p_payload: payload || {}, p_qty: qty | 0 || 1 }); },
  /** Pedidos abiertos de mis amigas -> [{ id, from_id, from_name, kind, payload, qty, created_at, expires_at }] */
  friendRequests() { return call('list_friend_requests', {}, arr); },
  /** Mis pedidos (3 días) -> [{ id, kind, payload, qty, filled_by, filled_by_name, filled_at, created_at, expires_at }] */
  myRequests() { return call('my_requests', {}, arr); },
  /** -> { ok, id, from_id, kind, payload, qty } (el cliente descuenta lo entregado y acredita su premio) */
  fillRequest(id) { return call('fill_request', { p_id: id }); },

  // ----- Obra en Equipo -----
  /** -> { week, mine, added, capped } */
  addCoopPoints(n) { return call('add_coop_points', { p_n: Math.round(n) || 0 }); },
  /** -> { week, total, mine, members:[{ id, name, points, me }] } */
  coopStatus(week = null) { return call('coop_status', { p_week: week || null }); },

  // ----- Ranking semanal -----
  /** -> [{ id, name, level, week:{id, stars, exps, charm, rank}|null, me }] */
  leaderboard(week = isoWeek()) { return call('friends_leaderboard', { p_week: week || null }, arr); },
};

export default net;
