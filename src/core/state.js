// Estado del juego + guardado en localStorage.
// Toda mutación de monedas/gemas/xp pasa por acá para que el HUD y las misiones se enteren.
import { bus } from './bus.js';
import {
  CUSTOM_CATALOG, START_BUILDERS, MAX_LEVEL, xpForLevel, levelUpReward, MAP_SIZE, AVATAR_TYPE_BY_ID, avatarType, fitsType,
} from './data.js';

const BASE_KEY = 'pixelia.save.v1';
const VERSION = 1;

/**
 * Clave de guardado. En modo online simulado (?mock=1&mockuser=ana) cada jugadora simulada tiene su
 * propia partida ('pixelia.save.v1.mock.ana'), así dos pestañas no comparten el mismo localStorage.
 */
function saveKey() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('mock') && q.get('mock') !== '0') {
      const u = (q.get('mockuser') || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
      return BASE_KEY + '.mock' + (u ? '.' + u : '');
    }
  } catch {}
  return BASE_KEY;
}
export const SAVE_KEY = saveKey();
const KEY = SAVE_KEY;

export function todayStr(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function freeOwned() {
  const owned = {};
  for (const [kind, list] of Object.entries(CUSTOM_CATALOG)) owned[kind] = list.filter(i => i.free).map(i => i.id);
  return owned;
}

export function defaultState() {
  const c = Math.floor(MAP_SIZE / 2);
  return {
    v: VERSION,
    created: Date.now(),
    lastSeen: Date.now(),
    player: { name: 'Pixelín', cityName: 'Pixelia', level: 1, xp: 0 },
    onboarded: false, // la primera vez se elige personaje, nombre y ciudad (scenes/onboarding.js)
    coins: 600,
    gems: 15,
    // personaje del jugador. state.princess es un alias de state.avatar (código y saves viejos)
    avatar: { type: 'princesa', ...avatarType('princesa').look },
    avatarLooks: {}, // último look usado con cada tipo: { [type]: look } (al volver a un tipo se recupera)
    car: { body: 'convertible', color: 'rosa', wheels: 'clasica', topper: 'ninguno' },
    owned: freeOwned(),
    city: {
      // b: { uid, id, x, z, rot(0..3), level, buildEnd(ms|0), upgradeEnd(ms|0), lastCollect(ms) }
      // x,z = esquina mínima del footprint en la grilla MAP_SIZE x MAP_SIZE
      buildings: [
        { uid: 1, id: 'castillo', x: c - 2, z: c - 2, rot: 0, level: 1, buildEnd: 0, upgradeEnd: 0, lastCollect: Date.now() },
      ],
      nextUid: 2,
      expansions: 0,
      flagColor: 'rosa',
      camera: null, // la escena de ciudad puede guardar acá su posición/zoom
    },
    builders: START_BUILDERS,
    quests: { main: 0, mainProgress: 0, daily: null, achTier: {} },
    login: { last: null, streak: 0 },
    stats: {},
    games: {
      match3: { level: 1, stars: {} },   // stars: { [nivel]: 0..3 }
      blocks: { best: 0 },
      parking: { level: 1, stars: {} },
      driving: { best: 0 },
    },
    tutorial: {},   // flags libres para tips mostrados una vez: tutorial[key] = true
    settings: { music: true, sfx: true, lowQuality: false },
    // módulos de progresión (cada uno completa sus propios campos al iniciar: initChests/initAlbum/initSeason/initEvents)
    chests: {},
    album: {},
    season: {},
    events: {},
  };
}

/**
 * Saves viejos: el look vivía en state.princess (siempre princesa) → state.avatar con type.
 * Un save viejo ya se jugó: no se le muestra el onboarding. Se aplica antes de deepFill.
 */
/** Partida recién empezada (mismo criterio que isPristine de online/sync.js). */
function isFreshGame(s) {
  return (s.player?.level || 1) <= 1 && (s.player?.xp || 0) < 20 && (s.city?.buildings?.length || 0) <= 1 && !(s.stats?.coinsEarned > 200);
}
function migrate(s) {
  if (!s || typeof s !== 'object') return s;
  const old = Object.getOwnPropertyDescriptor(s, 'princess')?.value;
  if (!s.avatar || typeof s.avatar !== 'object') s.avatar = { type: 'princesa', ...(old && typeof old === 'object' ? old : {}) };
  if (!AVATAR_TYPE_BY_ID[s.avatar.type]) s.avatar.type = 'princesa';
  delete s.princess;
  if (s.onboarded === undefined) s.onboarded = true;
  // el nombre por defecto viejo era 'Princesa': ahora el juego es neutro
  if (s.player && s.player.name === 'Princesa') s.player.name = 'Pixelín';
  // una partida que ya avanzó (p. ej. jugada entrando con ?scene=) no repite el onboarding ni pisa sus nombres
  if (s.onboarded === false && !isFreshGame(s)) s.onboarded = true;
  return s;
}
/** state.princess → state.avatar (no enumerable: no se guarda dos veces ni cambia el hash de sincronización). */
function withAlias(s) {
  Object.defineProperty(s, 'princess', {
    configurable: true, enumerable: false,
    get() { return s.avatar; },
    set(v) { if (v && typeof v === 'object') s.avatar = { type: s.avatar?.type || 'princesa', ...v }; },
  });
  return s;
}

// Mezcla profunda: completa claves faltantes de un save viejo con los defaults
function deepFill(target, def) {
  for (const k of Object.keys(def)) {
    if (target[k] === undefined) target[k] = def[k];
    else if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k]) && target[k] && typeof target[k] === 'object') deepFill(target[k], def[k]);
  }
  return target;
}

let state = null;
let dirty = false;

export const store = {
  get state() { return state; },

  load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch {}
    if (raw) {
      try {
        state = withAlias(deepFill(migrate(JSON.parse(raw)), defaultState()));
        // asegurar que lo gratis esté siempre en owned (por si se agregan items nuevos)
        const free = freeOwned();
        for (const k of Object.keys(free)) state.owned[k] = [...new Set([...(state.owned[k] || []), ...free[k]])];
      } catch (e) { console.warn('save corrupto, empezando de nuevo', e); state = withAlias(defaultState()); }
    } else state = withAlias(defaultState());
    return state;
  },

  save() {
    if (!state) return;
    state.lastSeen = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(state)); dirty = false; } catch (e) { console.warn('no se pudo guardar', e); }
  },
  markDirty() { dirty = true; },
  get dirty() { return dirty; },

  reset() {
    try { localStorage.removeItem(KEY); } catch {}
    state = withAlias(defaultState());
    store.save();
  },

  exportCode() { return btoa(unescape(encodeURIComponent(JSON.stringify(state)))); },
  importCode(code) {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!parsed || typeof parsed !== 'object' || !parsed.city) throw new Error('Código inválido');
    state = withAlias(deepFill(migrate(parsed), defaultState()));
    store.save();
  },

  // ---------- Monedas / gemas ----------
  canAfford(cost = {}) {
    return (cost.coins || 0) <= state.coins && (cost.gems || 0) <= state.gems;
  },
  /** Descuenta si alcanza. Devuelve true/false. */
  spend(cost = {}, reason = '') {
    if (!store.canAfford(cost)) return false;
    state.coins -= cost.coins || 0;
    state.gems -= cost.gems || 0;
    dirty = true;
    bus.emit('currency:changed', { coins: state.coins, gems: state.gems, delta: { coins: -(cost.coins || 0), gems: -(cost.gems || 0) }, reason });
    return true;
  },
  /**
   * Suma premios. reward: {coins, gems, xp, chest, stickers}. source: 'collect'|'game'|'quest'|'levelup'|'login'|...
   *  - chest: 'madera'|'plata'|'oro'|'real' (o {type, n}); chests: cantidad (default 1) → emite 'reward:chest' {type, n, source}
   *  - stickers: n (o {n, minStars}) → emite 'reward:stickers' {n, minStars, source}; el álbum deja el resultado en payload.result
   * Devuelve { stickers: [{id, stars, isNew, count}] } (vacío si no hubo figuritas).
   */
  grant(reward = {}, source = '') {
    const out = { stickers: [] };
    if (!reward || typeof reward !== 'object') return out;
    const coins = Math.max(0, Math.round(reward.coins || 0));
    const gems = Math.max(0, Math.round(reward.gems || 0));
    if (coins) { state.coins += coins; store.inc('coinsEarned', coins); bus.emit('coins:earned', { amount: coins, source }); }
    if (gems) { state.gems += gems; store.inc('gemsEarned', gems); bus.emit('gems:earned', { amount: gems, source }); }
    if (coins || gems) bus.emit('currency:changed', { coins: state.coins, gems: state.gems, delta: { coins, gems }, reason: source });
    if (reward.xp) store.addXp(reward.xp);
    if (reward.chest) {
      const type = typeof reward.chest === 'object' ? reward.chest.type : reward.chest;
      const n = Math.max(1, Math.round((typeof reward.chest === 'object' ? reward.chest.n : reward.chests) || 1));
      if (type) bus.emit('reward:chest', { type, n, source });
    }
    if (reward.stickers) {
      const st = typeof reward.stickers === 'object' ? reward.stickers : { n: reward.stickers };
      const payload = { n: Math.max(0, Math.round(st.n || 0)), minStars: st.minStars || 1, source };
      if (payload.n) { bus.emit('reward:stickers', payload); out.stickers = payload.result || []; }
    }
    dirty = true;
    return out;
  },

  // ---------- Experiencia / nivel ----------
  addXp(n) {
    n = Math.round(n);
    if (n <= 0) return;
    const p = state.player;
    if (p.level >= MAX_LEVEL) return;
    p.xp += n;
    bus.emit('xp:changed', { xp: p.xp, level: p.level });
    while (p.level < MAX_LEVEL && p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level++;
      const reward = levelUpReward(p.level);
      state.coins += reward.coins; state.gems += reward.gems;
      bus.emit('currency:changed', { coins: state.coins, gems: state.gems, delta: reward, reason: 'levelup' });
      bus.emit('level:up', { level: p.level, reward });
    }
    dirty = true;
  },
  xpProgress() {
    const p = state.player;
    const need = xpForLevel(p.level);
    return { level: p.level, xp: p.xp, need, pct: p.level >= MAX_LEVEL ? 1 : p.xp / need };
  },

  // ---------- Estadísticas ----------
  inc(key, n = 1) {
    state.stats[key] = (state.stats[key] || 0) + n;
    dirty = true;
    bus.emit('stats:changed', { key, value: state.stats[key] });
  },
  setMax(key, value) {
    if ((state.stats[key] || 0) < value) { state.stats[key] = value; dirty = true; bus.emit('stats:changed', { key, value }); }
  },

  // ---------- Personalización ----------
  owns(kind, id) { return (state.owned[kind] || []).includes(id); },
  /** Compra un item del catálogo (hair/dress/crown/acc/body/wheels/topper). */
  buyItem(kind, id) {
    const item = CUSTOM_CATALOG[kind]?.find(i => i.id === id);
    if (!item || store.owns(kind, id)) return false;
    if ((item.unlock || 1) > state.player.level) return false;
    if (!store.spend(item.price || {}, 'buy:' + kind)) return false;
    state.owned[kind].push(id);
    store.inc('bought');
    bus.emit('item:bought', { kind, id });
    dirty = true;
    return true;
  },
  /**
   * Cambia una pieza del look (target 'avatar' | 'princess' | 'car'). 'princess' es alias de 'avatar';
   * para el personaje el evento customize:changed sale con target 'princess' (compatibilidad).
   */
  setLook(target, key, value) {
    const obj = target === 'avatar' ? state.avatar : state[target];
    if (!obj || obj[key] === value) return;
    obj[key] = value;
    dirty = true;
    bus.emit('customize:changed', { target: target === 'avatar' ? 'princess' : target, key, value });
  },
  /**
   * Cambia el tipo de personaje (gratis). Guarda el look actual del tipo viejo y recupera el último look
   * del tipo nuevo; lo que no sirva para ese tipo o no sea tuyo vuelve al look inicial del tipo.
   */
  setAvatarType(type) {
    const a = state.avatar;
    if (!AVATAR_TYPE_BY_ID[type] || a.type === type) return false;
    const { type: oldType, ...cur } = a;
    state.avatarLooks[oldType] = cur;
    const def = avatarType(type).look;
    const prev = state.avatarLooks[type] || {};
    const next = { type, skin: prev.skin ?? cur.skin ?? def.skin, hairColor: prev.hairColor ?? def.hairColor, dressColor: prev.dressColor ?? def.dressColor };
    for (const kind of ['hair', 'dress', 'crown', 'acc']) {
      const want = prev[kind] ?? def[kind];
      const item = CUSTOM_CATALOG[kind].find(i => i.id === want);
      next[kind] = item && fitsType(item, type) && store.owns(kind, want) ? want : def[kind];
    }
    state.avatar = next;
    dirty = true;
    bus.emit('customize:changed', { target: 'princess', key: 'type', value: type });
    return true;
  },
};

// Autoguardado
setInterval(() => { if (dirty) store.save(); }, 4000);
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') store.save(); });
addEventListener('pagehide', () => store.save());
