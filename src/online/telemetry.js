// Métricas anónimas de uso → tabla public.events de supabase/schema.sql (ver DESIGN-ONLINE.md, "Métricas anónimas").
//
// - anon_id: uuid al azar de este dispositivo, guardado APARTE de la partida ('pixelia.anon.v1'). Nunca email ni nombre.
// - Los eventos se juntan en una cola (memoria + localStorage, por si no hay internet) y salen en tandas cada 30 s
//   y al pasar a segundo plano. Funciona sin cuenta, con la clave publishable (solo INSERT: el servidor no deja leer).
// - Destino ("sink"):
//     'supabase' → POST /rest/v1/events (solo en el sitio publicado, o con ?telemetry=live para probar)
//     'local'    → ?mock=1 o servidor de desarrollo (localhost/LAN): las tandas quedan en localStorage 'pixelia.mock.events'
//     'off'      → config.js vacío: no se junta nada
// - Interruptor en Ajustes: state.settings.telemetry (prendido por defecto). Apagado = no se encola y se vacía la cola.
//
// Uso: initTelemetry(ctx) una vez (main.js); track(name, props) desde cualquier lado.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const ID_KEY = 'pixelia.anon.v1';
const QUEUE_KEY = 'pixelia.events.queue.v1';
export const LOCAL_SINK_KEY = 'pixelia.mock.events';
const FLUSH_MS = 30000;
const BATCH = 50;
const MAX_QUEUE = 300;            // sin internet por mucho tiempo: se quedan los 300 más nuevos
const NEW_SESSION_MS = 30 * 60e3; // más de 30 min en segundo plano = sesión nueva
const MAX_ERRORS = 8;             // errores no capturados por sesión (que un bucle no llene la tabla)
const NAME_RE = /^[a-z0-9_:.-]{1,39}$/;
const MAX_PROPS = 1800;           // el servidor rechaza props ≥ 2 KB

/**
 * Eventos del bus que se registran solos: nombre → función que arma las props (chicas y sin datos personales).
 * Un nombre que termina en ':*' registra todos los eventos con ese prefijo (con sus valores simples).
 * Para sumar uno nuevo alcanza con agregar una línea acá.
 */
export const TRACKED_EVENTS = {
  'level:up': p => ({ level: p?.level }),
  'town:rankup': p => ({ rank: p?.rank }),
  'building:built': p => ({ id: p?.b?.id }),
  'onboarding:step': p => ({ step: p?.step }),
  'onboarding:done': () => ({}),
  'scene:changed': p => ({ id: p?.id, visit: !!p?.params?.visit }),
  // próximas fases: cada evento con su prefijo queda registrado con sus valores simples
  'expedition:*': p => scalars(p),
  'threat:*': p => scalars(p),
  // combate (El Quiebre, paso 5; DESIGN-COMBAT.md §13): victoria, derrota y retirada, con los turnos, las estrellas y
  // si fue la guiada o una resolución rápida (para ajustar el balance con datos reales)
  'combat:won': p => combatProps(p),
  'combat:lost': p => combatProps(p),
  'combat:retreat': p => combatProps(p),
};
function combatProps(p = {}) {
  return scalars({ enc: p.enc, region: p.region, kind: p.kind, reason: p.reason, turns: p.turns, stars: p.stars, attempt: p.attempt,
    quick: !!p.quick, guided: !!p.guided, first: !!p.first, combos: p.combos, downs: p.downs });
}

// ---------- utilidades ----------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const readJson = (k, def) => { try { return JSON.parse(store.get(k)) ?? def; } catch { return def; } };

export function uuid() {
  if (globalThis.crypto?.randomUUID) { try { return crypto.randomUUID(); } catch {} }
  // http en la red local no es "contexto seguro": randomUUID no existe, getRandomValues sí
  const b = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.random() * 256 | 0;
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const x = [...b].map(n => n.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
/** Solo números finitos, booleanos y textos cortos; como mucho 12 claves. */
function scalars(p) {
  const out = {};
  if (!p || typeof p !== 'object') return out;
  for (const [k, v] of Object.entries(p).slice(0, 12)) {
    if (typeof v === 'number' && isFinite(v)) out[k] = Math.round(v * 1000) / 1000;
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = clip(v, 60);
  }
  return out;
}
function cleanProps(p) {
  const out = scalars(p);
  let s = JSON.stringify(out);
  // si igual se pasa (12 textos largos), se van sacando claves
  while (s.length > MAX_PROPS) { delete out[Object.keys(out).pop()]; s = JSON.stringify(out); }
  return out;
}
const cleanName = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9_:.-]/g, '_').slice(0, 39);

function isDevHost() {
  if (typeof location === 'undefined') return true;
  if (location.protocol === 'file:') return true;
  const hn = location.hostname;
  return hn === 'localhost' || hn === '::1' || hn === '[::1]' || hn.endsWith('.local') || hn.endsWith('.localhost')
    || /^127\./.test(hn) || /^10\./.test(hn) || /^192\.168\./.test(hn) || /^172\.(1[6-9]|2\d|3[01])\./.test(hn);
}
function pickSink() {
  let q;
  try { q = new URLSearchParams(location.search); } catch { q = new URLSearchParams(); }
  if (q.has('mock') && q.get('mock') !== '0') return 'local';
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return 'off';
  // las pruebas y el servidor de desarrollo no ensucian las métricas reales
  if (isDevHost() && q.get('telemetry') !== 'live') return 'local';
  return 'supabase';
}

// ---------- estado ----------
let ctx = null;
let started = false;
let sink = 'off';
let ident = null;          // { id, first }
let queue = [];            // [{ n, p, t, s }]
let sending = false;
let timer = 0;
let version = null;
let session = null;        // { id, start, active, visibleSince, hiddenAt, errors }
let backoff = 0;

const enabled = () => sink !== 'off' && ctx?.state?.settings?.telemetry !== false;
const persist = () => { if (queue.length) store.set(QUEUE_KEY, JSON.stringify(queue)); else store.del(QUEUE_KEY); };

function loadIdent() {
  let v = readJson(ID_KEY, null);
  if (!v || typeof v.id !== 'string' || !/^[0-9a-f-]{36}$/.test(v.id)) {
    v = { id: uuid(), first: Date.now() };
    store.set(ID_KEY, JSON.stringify(v));
  }
  return v;
}

/** Versión del juego = nombre de la caché del service worker ('pixelia-v17'); sin SW (desarrollo) → 'dev'. */
async function resolveVersion() {
  try {
    const keys = (await globalThis.caches?.keys?.()) || [];
    const vs = keys.map(k => /^pixelia-v(\d+)$/.exec(k)).filter(Boolean).sort((a, b) => b[1] - a[1]);
    version = vs[0]?.[0] || 'dev';
  } catch { version = 'dev'; }
}

// ---------- API ----------
/** Registra un evento. props: valores simples (número, booleano, texto corto). No tira nunca. */
export function track(name, props = {}) {
  try {
    if (!started || !enabled() || !session) return false;
    const n = cleanName(name);
    if (!NAME_RE.test(n)) return false;
    queue.push({ n, p: cleanProps(props), t: Date.now(), s: session.id });
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
    persist();
    return true;
  } catch (e) { console.warn('[telemetry] track', e); return false; }
}

/** Manda lo encolado (en tandas de 50). beacon: al irse a segundo plano (fetch keepalive). */
export async function flush({ beacon = false } = {}) {
  if (!started) return { sent: 0 };
  if (!enabled()) { if (queue.length) { queue = []; persist(); } return { sent: 0, off: true }; }
  if (sending || !queue.length) return { sent: 0 };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { sent: 0, offline: true };
  sending = true;
  let sent = 0;
  try {
    while (queue.length) {
      const batch = queue.slice(0, BATCH);
      const now = Date.now();
      const rows = batch.map(e => {
        const props = { ...e.p };
        const late = Math.round((now - e.t) / 1000);
        if (late > 120) props.late = late;   // llegó tarde (sin internet): la hora real es created_at − late
        return { anon_id: ident.id, session_id: e.s, name: e.n, props, version: version || 'dev' };
      });
      const r = await send(rows, beacon);
      if (r === 'retry') { backoff = Math.min(backoff + 1, 6); break; }
      // 'ok' o 'drop' (el servidor rechazó la tanda: no se reintenta para siempre)
      backoff = 0;
      queue.splice(0, batch.length);
      persist();
      if (r === 'ok') sent += batch.length;
      if (beacon) break;   // keepalive tiene un límite de tamaño: una tanda alcanza
    }
  } finally { sending = false; }
  return { sent, left: queue.length };
}

async function send(rows, beacon) {
  if (sink === 'local') {
    const log = readJson(LOCAL_SINK_KEY, []);
    log.push(...rows.map(r => ({ ...r, at: new Date().toISOString() })));
    store.set(LOCAL_SINK_KEY, JSON.stringify(log.slice(-MAX_QUEUE)));
    return 'ok';
  }
  try {
    const res = await fetch(SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/events', {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(rows),
      keepalive: beacon,
      credentials: 'omit',
      cache: 'no-store',
    });
    if (res.ok) return 'ok';
    if (res.status === 408 || res.status === 429 || res.status >= 500) return 'retry';
    console.warn('[telemetry] el servidor rechazó una tanda', res.status);
    return 'drop';
  } catch { return 'retry'; }   // sin red: queda en la cola
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(async () => { await flush(); schedule(); }, FLUSH_MS * (1 + backoff));
}

// ---------- sesiones ----------
function daysSinceInstall() {
  const created = Number(ctx?.state?.created) || Date.now();
  const first = Math.min(ident.first || Date.now(), created);
  return Math.max(0, Math.floor((Date.now() - first) / 864e5));
}
const isStandalone = () => { try { return !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches); } catch { return false; } };

function startSession() {
  const now = Date.now();
  session = { id: uuid(), start: now, active: 0, visibleSince: now, hiddenAt: 0, errors: 0, started: false };
  trackStart();
}
/** session_start (la versión del juego va en la columna version de cada fila). */
function trackStart() {
  if (!session || session.started) return;
  session.started = track('session_start', {
    days: daysSinceInstall(), level: ctx?.state?.player?.level || 1,
    standalone: isStandalone(), touch: (navigator.maxTouchPoints || 0) > 0,
  });
}
function endSession() {
  if (!session) return;
  const now = Date.now();
  if (session.visibleSince) { session.active += now - session.visibleSince; session.visibleSince = 0; }
  // se manda cada vez que la app pasa a segundo plano (la duración acumulada: el análisis toma la mayor por sesión)
  track('session_end', { dur: Math.round(session.active / 1000), scene: ctx?.router?.current || '' });
}
function onVisibility() {
  if (document.visibilityState === 'hidden') {
    endSession();
    if (session) session.hiddenAt = Date.now();
    flush({ beacon: true });
  } else if (session) {
    const away = session.hiddenAt ? Date.now() - session.hiddenAt : 0;
    if (away > NEW_SESSION_MS) startSession();
    else { session.visibleSince = Date.now(); session.hiddenAt = 0; }
  }
}

// ---------- enganches ----------
function matchTracked(name) {
  if (TRACKED_EVENTS[name]) return TRACKED_EVENTS[name];
  const i = name.indexOf(':');
  return i > 0 ? TRACKED_EVENTS[name.slice(0, i) + ':*'] : null;
}
// eventos que se pueden emitir repetidos sin que nada cambie (el onboarding redibuja el paso al elegir personaje)
const DEDUPE = new Set(['onboarding:step']);
const lastSeen = new Map();
function onBus({ name, payload } = {}) {
  const fn = matchTracked(name);
  if (!fn) return;
  let props = {};
  try { props = fn(payload) || {}; } catch {}
  if (DEDUPE.has(name)) {
    const k = (session?.id || '') + JSON.stringify(props);
    if (lastSeen.get(name) === k) return;
    lastSeen.set(name, k);
  }
  track(name, props);
}

// aperturas de paneles principales: se envuelven las funciones de ctx (las escenas y el HUD las llaman por ctx)
const PANEL_FNS = { openChests: 'chests', openAlbum: 'album', openSeasonPass: 'season', openEvents: 'events', openSocial: 'social', openAccount: 'account' };
function wrapPanels() {
  const wrap = (key, nameOf) => {
    const f = ctx[key];
    if (typeof f !== 'function' || f.__tracked) return;
    const g = function (...a) { try { track('panel_open', { panel: nameOf(a) }); } catch {} return f.apply(this, a); };
    g.__tracked = true;
    ctx[key] = g;
  };
  wrap('openPanel', a => String(a[0] || ''));
  for (const [k, n] of Object.entries(PANEL_FNS)) wrap(k, () => n);
}

function onError(msg, where) {
  if (!session || session.errors >= MAX_ERRORS) return;
  session.errors++;
  track('error', { msg: clip(String(msg || 'error').replace(/^Uncaught /, ''), 160), where: clip(String(where || ''), 60) });
}
const fileOf = (u) => String(u || '').split('?')[0].split('/').slice(-2).join('/');

/** Arranca la telemetría. ctx = contexto del juego (main.js). Se puede llamar una sola vez. */
export function initTelemetry(gameCtx) {
  if (started) return api;
  ctx = gameCtx;
  sink = pickSink();
  started = true;
  if (sink === 'off') return api;
  ident = loadIdent();
  queue = readJson(QUEUE_KEY, []).filter(e => e && NAME_RE.test(e.n) && e.s).slice(-MAX_QUEUE);
  if (!enabled()) { queue = []; persist(); }
  resolveVersion();
  startSession();
  ctx.bus?.on('*', onBus);
  wrapPanels();
  addEventListener('error', e => onError(e.message, `${e.filename ? fileOf(e.filename) : 'inline'}:${e.lineno || 0}`));
  addEventListener('unhandledrejection', e => onError(e.reason?.message || e.reason, 'promise'));
  document.addEventListener('visibilitychange', onVisibility);
  addEventListener('pagehide', () => { endSession(); flush({ beacon: true }); });
  addEventListener('online', () => flush());
  schedule();
  return api;
}

/** El interruptor de Ajustes cambió: apagado vacía la cola al toque. */
export function setEnabled(on) {
  if (!ctx?.state?.settings) return;
  ctx.state.settings.telemetry = !!on;
  if (!on) { queue = []; persist(); }
  else trackStart();
}

const api = {
  track, flush, setEnabled, TRACKED_EVENTS,
  get sink() { return sink; },
  get queue() { return queue.map(e => ({ ...e })); },
  get anonId() { return ident?.id || null; },
  get sessionId() { return session?.id || null; },
  get enabled() { return enabled(); },
};
if (typeof window !== 'undefined') window.__pixeliaTelemetry = api;
export default api;
