// Estado del juego + guardado en localStorage.
// Toda mutación de monedas/gemas/xp pasa por acá para que el HUD y las misiones se enteren.
import { bus } from './bus.js';
import {
  CUSTOM_CATALOG, START_BUILDERS, MAX_LEVEL, xpForLevel, levelUpReward, MAP_SIZE, AVATAR_TYPE_BY_ID, avatarType, fitsType,
  LEGACY_TYPES, LEGACY_ITEMS, REGION_MATERIALS, PROV_START, RESERVE_CAP, LEGACY_MATS, LEGACY_BUILDINGS, LEGACY_BOOSTERS,
  TOWN_RANKS, eraOfRank, RETIRED_ITEMS,
} from './data.js';
import { THEME_ALIASES } from '../city/themes.js';
import { migrateClasses } from './classes-migrate.js';

const BASE_KEY = 'pixelia.save.v1';
// 1: original · 2: sin realeza (tipos/piezas de princesa → gente) y tema por defecto "pueblo"
// 3: sin minijuegos (materiales de región, edificios del ciclo, equipo, épocas; DESIGN-CORE.md §7.2)
// 4: fuera lo tierno (El Quiebre, plan §J7): solo personas, piezas retiradas devueltas y estilos de ciudad nuevos
export const VERSION = 4;

/** Ajustes por defecto (src/core/settings.js los aplica y valida; los saves viejos los reciben por deepFill). */
export const SETTINGS_DEFAULTS = {
  // sonido: music/sfx siguen siendo el sí/no (los lee el logo de index.html); los volúmenes van de 0 a 1
  music: true, sfx: true, volMaster: 0.8, volMusic: 0.7, volSfx: 0.8, volAmb: 0.6, volUi: 0.8, volVoice: 1, muteBg: true,
  // volVoice queda para el bus de voz del mezclador nuevo (plan §K, paso 3c); volUi: clics, menús y avisos
  // gráficos: gfxPreset 'auto' = se mide la compu en el primer rato y se elige uno (después queda fijo)
  gfxPreset: 'auto', renderScale: 200, aa: true, shadows: true, outline: true, particles: 'normal',
  maxFps: 60, bgFps: 30, showFps: false,
  lowQuality: false,   // del sistema viejo: si estaba en true, el preset arranca en Baja
  // pantalla (en el navegador solo cuenta uiScale)
  winMode: 'window', winRes: 'auto', uiScale: 100,
  // juego
  textSpeed: 'normal', skipSeen: false, combatSpeed: 1, confirmEnd: true, hints: true, camSpeed: 1, edgeScroll: false,
  dayNight: true,      // ciclo de día y noche de la ciudad (la expedición lo usa igual: es una regla)
  // controles: solo lo que se reasignó (acción → KeyboardEvent.code)
  keys: {},
  // accesibilidad
  textSize: 'normal', motion: 'auto', subtitles: true, hiContrast: false,
  telemetry: true,
};


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
    // materiales de región que trae la expedición ({ madera, piedra, mineral, hierbas }): monumentos, obras, equipo…
    materials: Object.fromEntries(REGION_MATERIALS.map(m => [m.id, 0])),
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
    // games: progreso de los minijuegos retirados (solo en partidas de antes de la v3; queda guardado y sin uso)
    // v3: compensación de la migración { gems, finds, at, shown, placeExp } (la muestra main.js una sola vez)
    tutorial: {},   // flags libres para tips mostrados una vez: tutorial[key] = true
    // historia (src/story/story.js la completa en initStory): { v, seen, pages, elements, act, chapter, flags }
    story: {},
    world: {},           // ambiente (src/core/ambience.js): light de 0 a 1, la luz como progreso
    // telemetry: métricas anónimas (online/telemetry.js) · textSize: 'normal'|'large'|'xlarge' · motion: 'auto'|'on'|'off'
    // (reducir movimiento: automático según el sistema, sí o no). Los saves viejos los reciben por deepFill.
    // el resto de los ajustes (gráficos, pantalla, volúmenes, juego, controles): SETTINGS_DEFAULTS, más abajo
    settings: JSON.parse(JSON.stringify(SETTINGS_DEFAULTS)),
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
  if ((s.v || 1) < 3) migrateV3(s);
  if ((s.v || 1) < 4) migrateV4(s);
  migrateClasses(s);   // roles de la expedición → clases (paso 5b; una sola vez, sin depender de s.v)
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
/**
 * v2 → v3 (DESIGN-CORE.md §7.2): se retiran los minijuegos sin que se pierda nada. Corre antes de deepFill, una sola
 * vez (s.v pasa a 3) y cada paso es seguro de repetir:
 *  1. materiales cristal/ladrillo/tuerca/mapa → mineral/piedra/madera/hierbas (se suman);
 *  2. Joyería/Torre de Bloques/Garaje/Pista → Taller/Dispensario/Establo/Casa de Expediciones (mismo uid, lugar,
 *     rotación, nivel y obra en curso). Si ya había uno del ciclo, queda el de nivel más alto y el otro se devuelve en
 *     monedas. Sin Casa de Expediciones, economy.ensureExpHouse la coloca sola (v3.placeExp);
 *  3. progreso de minijuegos → gemas (se suman acá) y hallazgos (los entrega main.js con el aviso, v3.finds);
 *  4. el álbum no cambia (pasa a llamarse Hallazgos con los mismos ids);
 *  5. potenciadores de la mochila → equipo de expedición;
 *  6. cada edificio sin época recibe la del rango actual (lo ya ganado no paga renovación);
 *  7. planos = ⌊rango / 2⌋ si la partida todavía no tenía (el resto de los recursos nuevos los completa deepFill);
 *  8. las diarias se vuelven a sortear (la cadena de misiones la migra quests.migrateQuestChain).
 * Monumentos, Mi Casa, rango, contactos, temas, ropa y auto no se tocan.
 */
const LEGACY_REFUND = { joyeria: 150, torre_bloques: 300, garaje: 600, pista: 1200 };
const num = (v) => Math.max(0, Math.round(Number(v) || 0));
function migrateV3(s) {
  if ((s.v || 1) >= 3) return;
  const fresh = isFreshGame(s);
  const v3 = (s.v3 && typeof s.v3 === 'object') ? s.v3 : (s.v3 = {});
  // 1. materiales
  const m = (s.materials && typeof s.materials === 'object') ? s.materials : (s.materials = {});
  for (const [from, to] of Object.entries(LEGACY_MATS)) {
    if (!(from in m)) continue;
    const n = num(m[from]);
    if (n) m[to] = num(m[to]) + n;
    delete m[from];
  }
  // 2. edificios de minijuego → edificios del ciclo
  const list = Array.isArray(s.city?.buildings) ? s.city.buildings : [];
  let refund = 0;
  const conv = [];
  for (const b of list.slice()) {
    const to = b && LEGACY_BUILDINGS[b.id];
    if (!to) continue;
    conv.push(b.id);
    const other = list.find(o => o !== b && o.id === to);
    if (!other) { b.id = to; continue; }
    // ya había uno del ciclo (máximo 1): queda el de nivel más alto en el lugar del que ya estaba
    refund += (LEGACY_REFUND[b.id] || 0) * Math.max(1, num(b.level));
    if (num(b.level) > num(other.level) && !other.buildEnd && !other.upgradeEnd) other.level = num(b.level);
    list.splice(list.indexOf(b), 1);
  }
  if (conv.length) v3.conv = conv;
  if (refund) { s.coins = num(s.coins) + refund; v3.refund = refund; }
  if (!fresh && !list.some(b => b.id === 'casa_exp')) v3.placeExp = 1;
  // 3. compensación por el progreso de los minijuegos
  const g = (s.games && typeof s.games === 'object') ? s.games : {};
  const lv = (k) => Math.max(0, num(g[k]?.level) - 1);
  const gems = Math.min(150, 2 * lv('match3') + 3 * lv('parking') + Math.floor(num(g.blocks?.best) / 1000) + Math.floor(num(g.driving?.best) / 1000));
  const finds = Math.min(10, Math.floor((lv('match3') + lv('parking')) / 5));
  if (v3.gems == null) {
    v3.gems = gems; v3.finds = finds; v3.at = Date.now(); v3.shown = fresh;
    if (gems) s.gems = num(s.gems) + gems;
  }
  // 5. potenciadores → equipo
  const items = s.chests?.items;
  if (items && typeof items === 'object') {
    const eq = (s.equipment && typeof s.equipment === 'object') ? s.equipment : (s.equipment = {});
    for (const [from, to] of Object.entries(LEGACY_BOOSTERS)) {
      if (!(from in items)) continue;
      const n = num(items[from]);
      if (n) eq[to] = num(eq[to]) + n;
      delete items[from];
    }
  }
  // 6. épocas: la del rango actual para lo que no tenía
  const castle = list.find(b => b.id === 'castillo');
  const rank = Math.max(1, Math.min(TOWN_RANKS.length, num(castle?.level) || 1));
  for (const b of list) if (b && b.era == null && b.id !== 'castillo') b.era = eraOfRank(rank);
  // 7. planos
  if (s.planos == null) s.planos = Math.floor(rank / 2);
  // 8. diarias de nuevo (las de minijuego ya no existen)
  if (s.quests && typeof s.quests === 'object') s.quests.daily = null;
  s.v = 3;
}
/**
 * v3 → v4 (plan §J7, fuera lo tierno). Corre antes de deepFill, una sola vez (s.v pasa a 4) y cada paso es seguro de
 * repetir:
 *  1. los personajes animales pasan a una persona (gato y conejo → chica, zorro y oso → chico) con el mismo color de
 *     pelo (el del pelaje) y de ropa; lo que no le sirve a una persona vuelve a lo de arranque del tipo;
 *  2. las piezas retiradas (RETIRED_ITEMS) se sacan de lo comprado y se devuelve lo que costaron;
 *  3. los estilos de ciudad viejos pasan a los nuevos (THEME_ALIASES: moderna → ceniza, playa → bruma, bosque → musgo,
 *     invierno → escarcha).
 * Lo que cambió queda en s.v4 { from, theme, coins, gems, shown } para el aviso único (main.js).
 */
function migrateV4(s) {
  if ((s.v || 1) >= 4) return;
  const v4 = (s.v4 && typeof s.v4 === 'object') ? s.v4 : (s.v4 = {});
  // 1. personajes
  const person = (l) => {
    if (!l || typeof l !== 'object' || !LEGACY_TYPES[l.type] || AVATAR_TYPE_BY_ID[l.type]) return l;
    const to = LEGACY_TYPES[l.type];
    const keep = (kind, id) => (CUSTOM_CATALOG[kind].some(i => i.id === id && fitsType(i, to)) ? id : avatarType(to).look[kind]);
    return {
      ...avatarType(to).look, type: to, hairColor: l.hairColor ?? avatarType(to).look.hairColor,
      dressColor: l.dressColor ?? avatarType(to).look.dressColor, crown: keep('crown', l.crown), acc: keep('acc', l.acc),
    };
  };
  if (s.avatar && LEGACY_TYPES[s.avatar.type] && !AVATAR_TYPE_BY_ID[s.avatar.type]) { v4.from = s.avatar.type; s.avatar = person(s.avatar); }
  if (s.avatarLooks && typeof s.avatarLooks === 'object') {
    for (const [t, l] of Object.entries(s.avatarLooks)) {
      if (AVATAR_TYPE_BY_ID[t] || !LEGACY_TYPES[t]) continue;
      const to = LEGACY_TYPES[t];
      if (!s.avatarLooks[to]) s.avatarLooks[to] = person({ ...l, type: t });
      delete s.avatarLooks[t];
    }
  }
  // 2. piezas retiradas: se devuelven (una sola vez: después ya no están en owned)
  let coins = 0, gems = 0;
  if (s.owned && typeof s.owned === 'object') {
    for (const [kind, map] of Object.entries(RETIRED_ITEMS)) {
      const list = Array.isArray(s.owned[kind]) ? s.owned[kind] : null;
      if (!list) continue;
      for (const id of new Set(list)) { const p = map[id]; if (p) { coins += p.coins || 0; gems += p.gems || 0; } }
      s.owned[kind] = list.filter(id => !(id in map));
    }
  }
  if (coins) { s.coins = num(s.coins) + coins; v4.coins = num(v4.coins) + coins; }
  if (gems) { s.gems = num(s.gems) + gems; v4.gems = num(v4.gems) + gems; }
  // 3. estilos de ciudad
  const th = s.city?.theme;
  if (th && THEME_ALIASES[th]) { v4.theme = th; s.city.theme = THEME_ALIASES[th]; }
  if (v4.shown == null) v4.shown = isFreshGame(s) || !(v4.from || v4.theme || v4.coins || v4.gems);
  s.v = 4;
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
  /** ¿Alcanzan los materiales? mats: { madera: n, piedra: n, ... } (sin mats: sí). */
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
   * Suma premios. reward: {coins, gems, xp, chest, stickers, mats, furniture, prov, planos, equip, reserves, colonos, page, element}.
 * page / element: id o lista de ids (historia, src/story/story.js) → emiten 'reward:page' / 'reward:element'.
   * mats: { madera: n, piedra: n, ... } → emite 'materials:changed'. prov/planos/colonos/equip/reserves → 'resources:changed'
   * (las provisiones respetan el tope del depósito). source: 'collect'|'game'|'quest'|'levelup'|'login'|'expedition'|...
   *  - chest: 'madera'|'plata'|'oro'|'real' (o {type, n}); chests: cantidad (default 1) → emite 'reward:chest' {type, n, source}
   *  - stickers: n (o {n, minStars, region}) → emite 'reward:stickers' {n, minStars, region, source}; Hallazgos deja el
   *    resultado en payload.result (con region, de los sets de esa región)
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
    // historia: páginas del diario y elementos (src/story/story.js los anota; acá solo se avisa)
    for (const id of [].concat(reward.page || [])) if (id) bus.emit('reward:page', { id, source });
    for (const id of [].concat(reward.element || [])) if (id) bus.emit('reward:element', { id, source });
    if (reward.stickers) {
      const st = typeof reward.stickers === 'object' ? reward.stickers : { n: reward.stickers };
      const payload = { n: Math.max(0, Math.round(st.n || 0)), minStars: st.minStars || 1, region: st.region || null, source };
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
