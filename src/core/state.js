// Estado del juego + guardado en localStorage.
// Toda mutación de monedas/gemas/xp pasa por acá para que el HUD y las misiones se enteren.
import { bus } from './bus.js';
import {
  CUSTOM_CATALOG, START_BUILDERS, MAX_LEVEL, xpForLevel, levelUpReward, MAP_SIZE, AVATAR_TYPE_BY_ID, avatarType, fitsType,
  LEGACY_TYPES, LEGACY_ITEMS, MATERIALS, REGION_MATERIALS, PROV_START, RESERVE_CAP,
} from './data.js';

const BASE_KEY = 'pixelia.save.v1';
// 1: original · 2: sin realeza (tipos/piezas de princesa → gente) y tema por defecto "pueblo"
const VERSION = 2;

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
    // personaje del jugador. state.princess es un alias de state.avatar (saves viejos)
    avatar: { type: 'chica', ...avatarType('chica').look },
    avatarLooks: {}, // último look usado con cada tipo: { [type]: look } (al volver a un tipo se recupera)
    car: { body: 'convertible', color: 'celeste', wheels: 'clasica', topper: 'ninguno' },
    owned: freeOwned(),
    city: {
      // b: { uid, id, x, z, rot(0..3), level, buildEnd(ms|0), upgradeEnd(ms|0), lastCollect(ms), damaged(ms|0, amenazas) }
      // x,z = esquina mínima del footprint en la grilla MAP_SIZE x MAP_SIZE
      buildings: [
        { uid: 1, id: 'castillo', x: c - 2, z: c - 2, rot: 0, level: 1, buildEnd: 0, upgradeEnd: 0, lastCollect: Date.now() },
      ],
      nextUid: 2,
      expansions: 0,
      flagColor: 'celeste',
      camera: null, // la escena de ciudad puede guardar acá su posición/zoom
    },
    builders: START_BUILDERS,
    // materiales: los de minijuego para los monumentos ({ cristal, ladrillo, tuerca, mapa }, hasta la Fase 5) y los de
    // región que trae la expedición ({ madera, piedra, mineral, hierbas })
    materials: Object.fromEntries([...MATERIALS, ...REGION_MATERIALS].map(m => [m.id, 0])),
    // recursos del ciclo (DESIGN-CORE.md §5.1): provisiones en el depósito (tope en economy.provCap), planos,
    // equipo de expedición { id: n }, reservas para las amenazas { id: n } y colonos (suman población)
    prov: PROV_START,
    planos: 0,
    equipment: {},
    reserves: {},
    colonos: 0,
    expedition: {},   // lo completa initExpedition (src/expedition/expedition.js)
    threats: {},      // lo completa initThreats (src/threats/threats.js): avisos, resultados, defensa en curso, simulacro
    // done: misiones principales cobradas por id; main: cuántas van (compatibilidad); chain: versión de la cadena
    quests: { main: 0, mainProgress: 0, daily: null, achTier: {}, done: {}, chain: 0 },
    login: { last: null, streak: 0 },
    stats: {},
    games: {
      match3: { level: 1, stars: {} },   // stars: { [nivel]: 0..3 }
      blocks: { best: 0 },
      parking: { level: 1, stars: {} },
      driving: { best: 0 },
    },
    tutorial: {},   // flags libres para tips mostrados una vez: tutorial[key] = true
    // telemetry: métricas anónimas (online/telemetry.js) · textSize: 'normal'|'large'|'xlarge' · motion: 'auto'|'on'|'off'
    // (reducir movimiento: automático según el sistema, sí o no). Los saves viejos los reciben por deepFill.
    settings: { music: true, sfx: true, lowQuality: false, telemetry: true, textSize: 'normal', motion: 'auto' },
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
  delete s.princess;
  if ((s.v || 1) < 2) migrateNoRoyalty(s);
  if (!AVATAR_TYPE_BY_ID[s.avatar.type]) s.avatar.type = 'chica';
  if (s.onboarded === undefined) s.onboarded = true;
  // el nombre por defecto viejo era 'Princesa': ahora el juego es neutro
  if (s.player && s.player.name === 'Princesa') s.player.name = 'Pixelín';
  // una partida que ya avanzó (p. ej. jugada entrando con ?scene=) no repite el onboarding ni pisa sus nombres
  if (s.onboarded === false && !isFreshGame(s)) s.onboarded = true;
  return s;
}
/**
 * v1 → v2: la realeza se fue. Princesa/hada → chica, príncipe/mago → chico; las coronas, varitas y cetros que tenías
 * pasan a su equivalente (y quedan tuyos); el tema "pastel" (que era el de siempre) pasa al nuevo "pueblo".
 */
function migrateNoRoyalty(s) {
  const mapLook = (l) => {
    if (!l || typeof l !== 'object') return l;
    if (LEGACY_TYPES[l.type] || l.type === undefined) l.type = LEGACY_TYPES[l.type] || 'chica';
    for (const kind of ['crown', 'acc']) if (LEGACY_ITEMS[kind][l[kind]]) l[kind] = LEGACY_ITEMS[kind][l[kind]];
    return l;
  };
  mapLook(s.avatar);
  if (s.avatarLooks && typeof s.avatarLooks === 'object') {
    for (const [t, l] of Object.entries(s.avatarLooks)) {
      if (!LEGACY_TYPES[t]) { mapLook(l); continue; }
      const to = LEGACY_TYPES[t];
      if (!s.avatarLooks[to]) s.avatarLooks[to] = mapLook({ ...l, type: to });
      delete s.avatarLooks[t];
    }
  }
  if (s.car && LEGACY_ITEMS.topper[s.car.topper]) s.car.topper = LEGACY_ITEMS.topper[s.car.topper];
  if (s.owned && typeof s.owned === 'object') {
    for (const [kind, map] of Object.entries(LEGACY_ITEMS)) {
      const list = Array.isArray(s.owned[kind]) ? s.owned[kind] : null;
      if (!list) continue;
      for (const [from, to] of Object.entries(map)) if (list.includes(from) && !list.includes(to)) list.push(to);
      s.owned[kind] = list.filter(id => !map[id]);
    }
  }
  if (s.city && s.city.theme === 'pastel') s.city.theme = 'pueblo';
  if (s.city && s.city.flagColor === 'rosa') s.city.flagColor = 'celeste';
  s.v = 2;
}
/** state.princess → state.avatar (no enumerable: no se guarda dos veces ni cambia el hash de sincronización). */
function withAlias(s) {
  Object.defineProperty(s, 'princess', {
    configurable: true, enumerable: false,
    get() { return s.avatar; },
    set(v) { if (v && typeof v === 'object') s.avatar = { type: s.avatar?.type || 'chica', ...v }; },
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

  // ---------- Monedas, gemas y recursos ----------
  // cost/reward: { coins, gems, xp, mats: {id: n}, prov, planos, equip: {id: n}, reserves: {id: n}, colonos (solo premios) }
  /** Tope del depósito de provisiones (lo pone economy.js; sin economía, sin tope). */
  provCap: () => Infinity,
  canAfford(cost = {}) {
    return (cost.coins || 0) <= state.coins && (cost.gems || 0) <= state.gems && store.hasMats(cost.mats)
      && (cost.prov || 0) <= (state.prov || 0) && (cost.planos || 0) <= (state.planos || 0)
      && store.hasItems('equipment', cost.equip) && store.hasItems('reserves', cost.reserves);
  },
  /** ¿Alcanzan los materiales? mats: { cristal: n, madera: n, ... } (sin mats: sí). */
  hasMats(mats) {
    if (!mats) return true;
    const have = state.materials || {};
    return Object.entries(mats).every(([id, n]) => (have[id] || 0) >= (n || 0));
  },
  /** ¿Alcanzan el equipo o las reservas? kind: 'equipment' | 'reserves'. */
  hasItems(kind, items) {
    if (!items) return true;
    const have = state[kind] || {};
    return Object.entries(items).every(([id, n]) => (have[id] || 0) >= (n || 0));
  },
  /** Suma (o resta) un recurso numérico del ciclo y avisa: resources:changed {key, value, delta, reason}. */
  _res(key, delta, reason) {
    if (!delta) return 0;
    let v = (state[key] || 0) + delta;
    if (key === 'prov' && delta > 0) v = Math.min(v, Math.max(state.prov || 0, store.provCap()));
    const d = v - (state[key] || 0);
    state[key] = Math.max(0, v);
    if (d) bus.emit('resources:changed', { key, value: state[key], delta: d, reason });
    return d;
  },
  _items(kind, items, sign, reason) {
    if (!items) return;
    state[kind] ||= {};
    const delta = {};
    for (const [id, n0] of Object.entries(items)) {
      const n = Math.max(0, Math.round(n0 || 0));
      if (!n) continue;
      state[kind][id] = Math.max(0, (state[kind][id] || 0) + sign * n);
      if (kind === 'reserves' && sign > 0) state[kind][id] = Math.min(RESERVE_CAP, state[kind][id]);
      delta[id] = sign * n;
    }
    if (Object.keys(delta).length) bus.emit('resources:changed', { key: kind === 'equipment' ? 'equip' : 'reserves', value: { ...state[kind] }, delta, reason });
  },
  /** Descuenta si alcanza. Devuelve true/false. */
  spend(cost = {}, reason = '') {
    if (!store.canAfford(cost)) return false;
    state.coins -= cost.coins || 0;
    state.gems -= cost.gems || 0;
    if (cost.mats) {
      state.materials ||= {};
      for (const [id, n] of Object.entries(cost.mats)) state.materials[id] = (state.materials[id] || 0) - (n || 0);
      bus.emit('materials:changed', { materials: state.materials, delta: Object.fromEntries(Object.entries(cost.mats).map(([id, n]) => [id, -n])), reason });
    }
    if (cost.prov) store._res('prov', -cost.prov, reason);
    if (cost.planos) store._res('planos', -cost.planos, reason);
    store._items('equipment', cost.equip, -1, reason);
    store._items('reserves', cost.reserves, -1, reason);
    dirty = true;
    bus.emit('currency:changed', { coins: state.coins, gems: state.gems, delta: { coins: -(cost.coins || 0), gems: -(cost.gems || 0) }, reason });
    return true;
  },
  /**
   * Suma premios. reward: {coins, gems, xp, chest, stickers, mats, furniture, prov, planos, equip, reserves, colonos}.
   * mats: { cristal: n, madera: n, ... } → emite 'materials:changed'. prov/planos/colonos/equip/reserves → 'resources:changed'
   * (las provisiones respetan el tope del depósito). source: 'collect'|'game'|'quest'|'levelup'|'login'|'expedition'|...
   *  - chest: 'madera'|'plata'|'oro'|'real' (o {type, n}); chests: cantidad (default 1) → emite 'reward:chest' {type, n, source}
   *  - stickers: n (o {n, minStars}) → emite 'reward:stickers' {n, minStars, source}; el álbum deja el resultado en payload.result
   * Devuelve { stickers: [{id, stars, isNew, count}], prov (lo que entró al depósito) }.
   */
  grant(reward = {}, source = '') {
    const out = { stickers: [], prov: 0 };
    if (!reward || typeof reward !== 'object') return out;
    const coins = Math.max(0, Math.round(reward.coins || 0));
    const gems = Math.max(0, Math.round(reward.gems || 0));
    if (coins) { state.coins += coins; store.inc('coinsEarned', coins); bus.emit('coins:earned', { amount: coins, source }); }
    if (gems) { state.gems += gems; store.inc('gemsEarned', gems); bus.emit('gems:earned', { amount: gems, source }); }
    if (coins || gems) bus.emit('currency:changed', { coins: state.coins, gems: state.gems, delta: { coins, gems }, reason: source });
    if (reward.mats && typeof reward.mats === 'object') {
      state.materials ||= {};
      const delta = {};
      for (const [id, n0] of Object.entries(reward.mats)) {
        const n = Math.max(0, Math.round(n0 || 0));
        if (!n) continue;
        state.materials[id] = (state.materials[id] || 0) + n;
        delta[id] = n;
        store.inc('matsEarned', n);
      }
      if (Object.keys(delta).length) bus.emit('materials:changed', { materials: state.materials, delta, reason: source });
    }
    for (const key of ['prov', 'planos', 'colonos']) {
      const n = Math.max(0, Math.round(reward[key] || 0));
      if (!n) continue;
      const d = store._res(key, n, source);
      if (key === 'prov') out.prov = d;
      if (key === 'planos' && d) store.inc('planosEarned', d);
    }
    store._items('equipment', reward.equip, 1, source);
    store._items('reserves', reward.reserves, 1, source);
    if (reward.furniture) {   // mueble para Mi Casa: { furniture: 'id' } (home/furniture.js lo suma al inventario)
      const id = typeof reward.furniture === 'object' ? reward.furniture.id : reward.furniture;
      if (id) bus.emit('reward:furniture', { id, n: (typeof reward.furniture === 'object' && reward.furniture.n) || 1, source });
    }
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
   * Cambia una pieza del look (target 'avatar' | 'car'; 'princess' es un alias viejo de 'avatar').
   */
  setLook(target, key, value) {
    if (target === 'princess') target = 'avatar';
    const obj = target === 'avatar' ? state.avatar : state[target];
    if (!obj || obj[key] === value) return;
    obj[key] = value;
    dirty = true;
    bus.emit('customize:changed', { target, key, value });
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
    bus.emit('customize:changed', { target: 'avatar', key: 'type', value: type });
    return true;
  },
};

// Autoguardado
setInterval(() => { if (dirty) store.save(); }, 4000);
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') store.save(); });
addEventListener('pagehide', () => store.save());
