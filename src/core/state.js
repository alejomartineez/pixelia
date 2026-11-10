// Estado del juego + guardado en localStorage.
// Toda mutación de monedas/gemas/xp pasa por acá para que el HUD y las misiones se enteren.
import { bus } from './bus.js';
import {
  CUSTOM_CATALOG, START_BUILDERS, levelUpReward, MAP_SIZE, AVATAR_TYPE_BY_ID, avatarType, fitsType,
  LEGACY_TYPES, LEGACY_ITEMS, REGION_MATERIALS, PROV_START, RESERVE_CAP, LEGACY_MATS, LEGACY_BUILDINGS, LEGACY_BOOSTERS,
  TOWN_RANKS, eraOfRank, RETIRED_ITEMS, V5_TYPES, V5_ITEMS, v5Look, V5_CAR,
} from './data.js';
import { THEME_ALIASES } from '../city/themes.js';
import { migrateClasses } from './classes-migrate.js';
import { NIVEL, leaderXpFor, leaderLevelFromXp, leaderLevelV6, paragonPoints, LEADER } from '../combat/classes.js';

const BASE_KEY = 'pixelia.save.v1';
// 1: original · 2: sin realeza (tipos/piezas de princesa → gente) y tema por defecto "pueblo"
// 3: sin minijuegos (materiales de región, edificios del ciclo, equipo, épocas; DESIGN-CORE.md §7.2)
// 4: fuera lo tierno (El Quiebre, plan §J7): solo personas, piezas retiradas devueltas y estilos de ciudad nuevos
export const VERSION = 7;

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
  // idioma (src/core/i18n.js): '' = todavía no se eligió; al arrancar se toma el del sistema y se guarda
  lang: '',
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
    player: { name: 'Pixelín', cityName: 'Pixelia' },
    onboarded: false, // la primera vez se elige personaje, nombre y ciudad (scenes/onboarding.js)
    coins: 600,
    gems: 15,
    // personaje del jugador. state.princess es un alias de state.avatar (saves viejos)
    avatar: { type: 'humano', ...avatarType('humano').look },
    avatarLooks: {}, // último look usado con cada tipo: { [type]: look } (al volver a un tipo se recupera)
    car: { body: 'bote', color: 'azul', wheels: 'vela', topper: 'ninguno' },   // el esquife (plan §M5)
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
  return levelOf(s) <= 1 && (s.classes?.leader?.xp || s.player?.xp || 0) < 20 && (s.city?.buildings?.length || 0) <= 1 && !(s.stats?.coinsEarned > 200);
}
function migrate(s) {
  if (!s || typeof s !== 'object') return s;
  const old = Object.getOwnPropertyDescriptor(s, 'princess')?.value;
  if (!s.avatar || typeof s.avatar !== 'object') s.avatar = { type: 'princesa', ...(old && typeof old === 'object' ? old : {}) };
  delete s.princess;
  if ((s.v || 1) < 2) migrateNoRoyalty(s);
  if ((s.v || 1) < 3) migrateV3(s);
  if ((s.v || 1) < 4) migrateV4(s);
  if ((s.v || 1) < 5) migrateV5(s);
  else migrateSkiff(s);   // las partidas v5 de antes del esquife (rama de prueba) también se traducen
  if ((s.v || 1) < 6) migrateV6(s);
  migrateClasses(s);   // roles de la expedición → clases (paso 5b; una sola vez, sin depender de s.v)
  if ((s.v || 1) < 7) migrateV7(s);   // después de las clases: necesita state.classes.leader
  if (!AVATAR_TYPE_BY_ID[s.avatar.type]) s.avatar.type = 'humano';
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
 * Monumentos, Mi Casa (hasta el v6), rango, contactos, temas, ropa y auto no se tocan.
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
/**
 * v4 → v5 (plan §M, personajes serios y pueblos). Corre antes de deepFill, una sola vez (s.v pasa a 5):
 *  1. chica y chico pasan a ser humanos (esbelto y recio) y las piezas se traducen (V5_ITEMS, v5Look); el look de un
 *     tipo que no estaba puesto queda guardado en s.v5.looks (no hay dos looks de humano);
 *  2. lo comprado pasa a su equivalente; si ya lo tenías o el equivalente es gratis, se devuelve lo que pagaste;
 *  3. lo que tenías puesto queda tuyo aunque su equivalente ahora se pague (no se pierde nada).
 * Lo que cambió queda en s.v5 { from, coins, gems, shown } para el aviso único (main.js).
 */
function migrateV5(s) {
  if ((s.v || 1) >= 5) return;
  const v5 = (s.v5 && typeof s.v5 === 'object') ? s.v5 : (s.v5 = {});
  const KINDS = ['hair', 'dress', 'crown', 'acc'];
  const item = (kind, id) => CUSTOM_CATALOG[kind]?.find(i => i.id === id);
  let coins = 0, gems = 0;
  if (!s.owned || typeof s.owned !== 'object') s.owned = {};
  for (const kind of KINDS) {
    const list = Array.isArray(s.owned[kind]) ? s.owned[kind] : [];
    const out = new Set();
    for (const id of new Set(list)) {
      const [to, price] = V5_ITEMS[kind]?.[id] || [id, null];
      const it = item(kind, to);
      if (it && !it.free && !out.has(to)) { out.add(to); continue; }
      if (price) { coins += price.coins || 0; gems += price.gems || 0; }
    }
    s.owned[kind] = [...out];
  }
  if (s.avatar && typeof s.avatar === 'object') {
    if (V5_TYPES[s.avatar.type]) v5.from = s.avatar.type;
    s.avatar = v5Look(s.avatar);
    if (!AVATAR_TYPE_BY_ID[s.avatar.type]) s.avatar.type = 'humano';
  }
  const looks = {};
  if (s.avatarLooks && typeof s.avatarLooks === 'object') {
    for (const [t, l] of Object.entries(s.avatarLooks)) {
      if (!l || typeof l !== 'object') continue;
      if (AVATAR_TYPE_BY_ID[t]) { looks[t] = l; continue; }
      const { type, ...rest } = v5Look({ ...l, type: t });
      if (AVATAR_TYPE_BY_ID[type] && type !== s.avatar?.type && !looks[type]) looks[type] = rest;
      else (v5.looks || (v5.looks = {}))[t] = rest;
    }
  }
  s.avatarLooks = looks;
  for (const l of [s.avatar, ...Object.values(looks), ...Object.values(v5.looks || {})]) {
    if (!l) continue;
    for (const kind of KINDS) {
      const it = item(kind, l[kind]);
      if (it && !it.free && !s.owned[kind].includes(it.id)) s.owned[kind].push(it.id);
    }
  }
  if (coins) { s.coins = num(s.coins) + coins; v5.coins = num(v5.coins) + coins; }
  if (gems) { s.gems = num(s.gems) + gems; v5.gems = num(v5.gems) + gems; }
  if (migrateSkiff(s)) v5.skiff = 1;
  if (v5.shown == null) v5.shown = isFreshGame(s);
  s.v = 5;
}
// Mi Casa (salió en el v6): [Confort, monedas, gemas] de cada mueble, lo de arranque (no se pagó) y las ampliaciones.
const V6_FURN = {
  cama: [12, 300], mesa: [6, 200], silla: [3, 80], ropero: [6, 400], lampara: [5, 150], planta: [5, 120], alfombra: [6, 180],
  sillon: [14, 700], puff: [6, 250], mesita: [4, 220], tele: [10, 900], biblioteca: [10, 800], alfombra_larga: [8, 450],
  chimenea: [18, 2500], cocina: [10, 1200], heladera: [6, 900], escritorio: [8, 600], consola: [9, 0, 10], acuario: [16, 0, 15],
  piano: [18, 0, 25], cama_gato: [8, 500], cuadro: [4, 150], estante: [5, 250], reloj: [4, 300], poster: [4, 200], guirnalda: [7, 0, 8],
  arcoiris: [14], trono: [20], globo: [10], telescopio: [12], trofeo_rango: [10], trofeo_obra: [10], trofeo_joyas: [8], trofeo_album: [8],
};
const V6_STARTER = ['cama', 'ropero', 'mesa', 'silla', 'lampara', 'planta', 'alfombra', 'cuadro'];
const V6_CHEST = new Set(['arcoiris', 'trono', 'acuario', 'piano', 'chimenea', 'consola', 'guirnalda']);   // también salían en cofres
const V6_LEVELS = [null, null, { coins: 2500, mats: { piedra: 8 } }, { coins: 7000, mats: { piedra: 14, madera: 8 } },
  { coins: 18000, mats: { piedra: 20, madera: 12, mineral: 10 } }, { coins: 45000, gems: 15, mats: { piedra: 28, madera: 18, mineral: 16, hierbas: 12 } }];
/**
 * v5 → v6 (La Travesía, paso 1c: Mi Casa sale del juego). Corre antes de deepFill, una sola vez (s.v pasa a 6):
 *  1. el edificio 'mi_casa' sale del mapa (la parcela queda libre) y state.home se borra;
 *  2. se devuelve lo que se pagó: los muebles comprados (menos los de arranque; tope: stats.furnitureBought) y las
 *     ampliaciones hechas o en obra (monedas, gemas y materiales);
 *  3. el Encanto que daban la casa y su Confort queda anotado en s.v6.charm y economy.settleV6Charm lo pasa a un bono fijo
 *     (state.city.charmBonus), para no perder avance hacia el próximo rango;
 *  4. los trofeos (home.trophies) pasan a los Logros de la Bitácora (state.achievements).
 * Lo que cambió queda en s.v6 { had, coins, gems, mats, shown } para el aviso único (main.js).
 */
function migrateV6(s) {
  if ((s.v || 1) >= 6) return;
  const v6 = (s.v6 && typeof s.v6 === 'object') ? s.v6 : (s.v6 = {});
  const home = (s.home && typeof s.home === 'object') ? s.home : {};
  const list = Array.isArray(s.city?.buildings) ? s.city.buildings : [];
  const b = list.find(o => o && o.id === 'mi_casa');
  let coins = 0, gems = 0;
  const mats = {};
  if (b) {
    v6.had = 1;
    const level = Math.max(1, Math.min(5, Math.round(+b.level) || 1));
    // 2a. ampliaciones (la que estaba en obra también se pagó)
    const top = Math.min(5, level + ((+b.upgradeEnd || 0) > 0 ? 1 : 0));
    for (let lv = 2; lv <= top; lv++) {
      const c = V6_LEVELS[lv];
      coins += c.coins || 0; gems += c.gems || 0;
      for (const [m, n] of Object.entries(c.mats || {})) mats[m] = (mats[m] || 0) + n;
    }
    // 3. Confort (misma cuenta que tenía Mi Casa): repetir rinde 85%, la variedad multiplica y el nivel suma 5%
    const per = {};
    for (const it of Array.isArray(home.items) ? home.items : []) if (it && V6_FURN[it.id]) (per[it.id] ||= []).push(V6_FURN[it.id][0] || 0);
    let base = 0;
    for (const vals of Object.values(per)) vals.forEach((v, i) => { base += v * Math.pow(0.85, i); });
    const kinds = Object.keys(per).length;
    const comfort = Math.round(base * Math.min(1.6, 1 + 0.03 * kinds) * (1 + 0.05 * (level - 1)));
    v6.charm = { level, comfort: Math.round(comfort / 4) };
    s.city.buildings = list.filter(o => o !== b);
  }
  // 2b. muebles comprados: los puestos y los guardados, menos un juego de arranque
  const count = {};
  for (const it of Array.isArray(home.items) ? home.items : []) if (it && V6_FURN[it.id]) count[it.id] = (count[it.id] || 0) + 1;
  for (const [id, n] of Object.entries(home.owned && typeof home.owned === 'object' ? home.owned : {})) if (V6_FURN[id]) count[id] = (count[id] || 0) + num(n);
  if (home.started) for (const id of V6_STARTER) if (count[id]) count[id]--;
  const paid = [];
  for (const [id, n] of Object.entries(count)) {
    const [, c = 0, g = 0] = V6_FURN[id];
    if (c || g) for (let i = 0; i < n; i++) paid.push({ c, g, chest: V6_CHEST.has(id) });
  }
  paid.sort((x, y) => (x.chest - y.chest));   // los que también salían en cofres, al final
  const bought = s.stats && Number.isFinite(+s.stats.furnitureBought) ? num(s.stats.furnitureBought) : paid.length;
  for (const p of paid.slice(0, bought)) { coins += p.c; gems += p.g; }
  // 4. trofeos → logros
  const ach = (s.achievements && typeof s.achievements === 'object') ? s.achievements : (s.achievements = {});
  for (const [id, at] of Object.entries(home.trophies && typeof home.trophies === 'object' ? home.trophies : {})) if (at && !ach[id]) ach[id] = +at || Date.now();
  delete s.home;
  if (coins) { s.coins = num(s.coins) + coins; v6.coins = num(v6.coins) + coins; }
  if (gems) { s.gems = num(s.gems) + gems; v6.gems = num(v6.gems) + gems; }
  if (Object.keys(mats).length) {
    const m = (s.materials && typeof s.materials === 'object') ? s.materials : (s.materials = {});
    for (const [id, n] of Object.entries(mats)) m[id] = num(m[id]) + n;
    v6.mats = mats;
  }
  if (v6.shown == null) v6.shown = isFreshGame(s) || !v6.had;
  s.v = 6;
}
/**
 * El Nivel de una partida o de un perfil online. Desde el v7 es el de state.classes.leader (NIVEL); una partida o un
 * perfil de antes (otra versión del juego, visitas) tiene player.level y la xp del líder en la escala vieja.
 */
export function levelOf(s) {
  if (!s || typeof s !== 'object') return 1;
  const xp = Math.max(0, Number(s.classes?.leader?.xp) || 0);
  if ((s.v || 1) >= 7 || s.player?.level == null) return leaderLevelFromXp(xp);
  return Math.max(1, Math.min(NIVEL.max, Math.max(Number(s.player.level) || 1, leaderLevelV6(xp))));
}
/**
 * v6 → v7 (La Travesía, paso 2a: un solo Nivel). El nivel de la ciudad (player.level, tope 40) y el del líder
 * (classes.leader, tope 30) pasan a ser uno, el Nivel (tope 50, la curva de la ciudad): se toma el más alto de los dos,
 * con lo juntado dentro de ese nivel en la misma proporción, así nadie baja. player.level y player.xp se borran.
 * Corre después de migrateClasses. Lo que pasó queda en s.v7 { player, leader, level }.
 */
function migrateV7(s) {
  const p = (s.player && typeof s.player === 'object') ? s.player : (s.player = {});
  if (!s.classes || typeof s.classes !== 'object') s.classes = {};
  if (!s.classes.leader || typeof s.classes.leader !== 'object') s.classes.leader = {};
  const L = s.classes.leader;
  const pl = Math.max(1, Math.min(NIVEL.max, Math.round(num(p.level)) || 1));
  const lxp = Math.max(0, num(L.xp));
  const ll = leaderLevelV6(lxp);
  let llBase = 0; for (let n = 1; n < ll; n++) llBase += LEADER.need(n);
  const fracP = Math.min(0.999, Math.max(0, num(p.xp)) / NIVEL.need(pl));
  const fracL = ll >= LEADER.max ? 0 : Math.min(0.999, (lxp - llBase) / LEADER.need(ll));
  const level = Math.max(pl, ll);
  const frac = level >= NIVEL.max ? 0 : Math.max(pl === level ? fracP : 0, ll === level ? fracL : 0);
  L.xp = leaderXpFor(level) + Math.floor(frac * NIVEL.need(level));
  s.v7 = { player: pl, leader: ll, level };
  delete p.level; delete p.xp;
  s.v = 7;
}
/**
 * El auto pasa a ser el esquife (plan §M5): state.car y las piezas compradas pasan a la pieza que ocupa su lugar (casco,
 * vela, proa; el color queda). Nada se pierde y es seguro de repetir: solo traduce ids viejos. Devuelve si cambió algo.
 */
function migrateSkiff(s) {
  let changed = false;
  if (s.car && typeof s.car === 'object') for (const kind of ['body', 'wheels', 'topper']) {
    const to = V5_CAR[kind][s.car[kind]];
    if (to) { s.car[kind] = to; changed = true; }
  }
  if (s.owned && typeof s.owned === 'object') for (const kind of ['body', 'wheels', 'topper']) {
    const list = Array.isArray(s.owned[kind]) ? s.owned[kind] : null;
    if (!list || !list.some(id => V5_CAR[kind][id])) continue;
    s.owned[kind] = [...new Set(list.map(id => V5_CAR[kind][id] || id))];
    changed = true;
  }
  return changed;
}
/** state.princess → state.avatar (no enumerable: no se guarda dos veces ni cambia el hash de sincronización). */
function withAlias(s) {
  Object.defineProperty(s, 'princess', {
    configurable: true, enumerable: false,
    get() { return s.avatar; },
    set(v) { if (v && typeof v === 'object') s.avatar = { type: s.avatar?.type || 'humano', ...v }; },
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
   * Suma premios. reward: {coins, gems, xp, chest, stickers, mats, prov, planos, equip, reserves, colonos, page, element}.
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

  // ---------- Experiencia / Nivel ----------
  /**
   * Suma experiencia al Nivel (state.classes.leader.xp; v7). Por cada Nivel nuevo: su premio (levelUpReward) y
   * 'level:up' { level, reward }; al final 'leader:levelup' { level, from, source }. Pasado el 50 junta paragon
   * ('paragon:up' { points }). Devuelve { from, to } si subió o null.
   */
  addXp(n, source = 'city') {
    n = Math.round(n);
    if (!(n > 0)) return null;
    if (!state.classes || typeof state.classes !== 'object') state.classes = {};
    const L = (state.classes.leader && typeof state.classes.leader === 'object') ? state.classes.leader : (state.classes.leader = { cls: null, sub: null, xp: 0, picks: [] });
    L.xp = Math.max(0, Number(L.xp) || 0);
    const from = leaderLevelFromXp(L.xp), pFrom = paragonPoints(L.xp);
    L.xp += n;
    const to = leaderLevelFromXp(L.xp), pTo = paragonPoints(L.xp);
    bus.emit('xp:changed', { xp: L.xp, level: to, source });
    for (let lv = from + 1; lv <= to; lv++) {
      const reward = levelUpReward(lv);
      state.coins += reward.coins; state.gems += reward.gems;
      bus.emit('currency:changed', { coins: state.coins, gems: state.gems, delta: reward, reason: 'levelup' });
      bus.emit('level:up', { level: lv, reward });
    }
    if (pTo > pFrom) bus.emit('paragon:up', { points: pTo, from: pFrom });
    dirty = true;
    if (to > from) { bus.emit('leader:levelup', { level: to, from, source }); return { from, to }; }
    return null;
  },
  /** { level, xp (lo juntado en el nivel), need, pct } del Nivel. */
  xpProgress() {
    const xp = Math.max(0, Number(state.classes?.leader?.xp) || 0);
    const level = leaderLevelFromXp(xp);
    if (level >= NIVEL.max) { const into = (xp - leaderXpFor(level)) % NIVEL.paragonStep; return { level, xp: into, need: NIVEL.paragonStep, pct: into / NIVEL.paragonStep, paragon: paragonPoints(xp) }; }
    const need = NIVEL.need(level), into = xp - leaderXpFor(level);
    return { level, xp: into, need, pct: into / need };
  },
  /** El Nivel (1..50). */
  level() { return leaderLevelFromXp(state.classes?.leader?.xp || 0); },

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
    if ((item.unlock || 1) > store.level()) return false;
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
    next.build = prev.build ?? cur.build ?? def.build;
    for (const kind of ['hair', 'face', 'dress', 'crown', 'acc']) {
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
