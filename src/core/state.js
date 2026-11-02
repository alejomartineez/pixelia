// Estado del juego + guardado en localStorage.
// Toda mutación de monedas/gemas/xp pasa por acá para que el HUD y las misiones se enteren.
import { bus } from './bus.js';
import {
  CUSTOM_CATALOG, START_BUILDERS, MAX_LEVEL, xpForLevel, levelUpReward, MAP_SIZE,
} from './data.js';

const KEY = 'pixelia.save.v1';
const VERSION = 1;

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
    player: { name: 'Princesa', cityName: 'Pixelia', level: 1, xp: 0 },
    coins: 600,
    gems: 15,
    princess: { skin: 0, hair: 'largo', hairColor: 'castano', dress: 'clasico', dressColor: 'rosa', crown: 'tiara', acc: 'ninguno' },
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
  };
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
        state = deepFill(JSON.parse(raw), defaultState());
        // asegurar que lo gratis esté siempre en owned (por si se agregan items nuevos)
        const free = freeOwned();
        for (const k of Object.keys(free)) state.owned[k] = [...new Set([...(state.owned[k] || []), ...free[k]])];
      } catch (e) { console.warn('save corrupto, empezando de nuevo', e); state = defaultState(); }
    } else state = defaultState();
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
    state = defaultState();
    store.save();
  },

  exportCode() { return btoa(unescape(encodeURIComponent(JSON.stringify(state)))); },
  importCode(code) {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!parsed || typeof parsed !== 'object' || !parsed.city) throw new Error('Código inválido');
    state = deepFill(parsed, defaultState());
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
  /** Suma premios {coins, gems, xp}. source: 'collect'|'game'|'quest'|'levelup'|'login'|... */
  grant(reward = {}, source = '') {
    const coins = Math.max(0, Math.round(reward.coins || 0));
    const gems = Math.max(0, Math.round(reward.gems || 0));
    if (coins) { state.coins += coins; store.inc('coinsEarned', coins); bus.emit('coins:earned', { amount: coins, source }); }
    if (gems) { state.gems += gems; store.inc('gemsEarned', gems); bus.emit('gems:earned', { amount: gems, source }); }
    if (coins || gems) bus.emit('currency:changed', { coins: state.coins, gems: state.gems, delta: { coins, gems }, reason: source });
    if (reward.xp) store.addXp(reward.xp);
    dirty = true;
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
  /** Cambia una pieza del look (target 'princess' | 'car'). */
  setLook(target, key, value) {
    const obj = state[target];
    if (!obj || obj[key] === value) return;
    obj[key] = value;
    dirty = true;
    bus.emit('customize:changed', { target, key, value });
  },
};

// Autoguardado
setInterval(() => { if (dirty) store.save(); }, 4000);
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') store.save(); });
addEventListener('pagehide', () => store.save());
