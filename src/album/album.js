// Hallazgos (antes Álbum de figuritas; ids internos de siempre): 12 sets × 9 (108), rarezas 1–5★, repetidos → recortes
// (el campo sigue siendo album.brillitos), tienda de sobres. Cada set es de una región de la expedición (SET_REGION,
// DESIGN-CORE.md §7.2.4): lo que se encuentra explorando una región sale de sus sets.
// Datos + lógica. UI en album-ui.js, arte de las cartas en album-art.js.
// Estado: state.album = { have:{id:count}, claimedSets:[], brillitos, seen:[], done:[], since5, albumDone, title }
import { bus } from '../core/bus.js';
import { store } from '../core/state.js';
import { rewardScale } from '../core/data.js';
import { REGIONS } from '../expedition/exp-data.js';
export { renderStickerCard, renderPack } from './album-art.js';

// ---------- Datos ----------
// Cada set: [id, nombre, emoji, color, oscuro, claro, figuritas ordenadas por estrellas (3×1★, 2×2★, 2×3★, 1×4★, 1×5★)]
const RAW = [
  // (el id 'princesas' queda por compatibilidad con álbumes e intercambios viejos)
  ['princesas', 'Vecinos', '🏘️', '#ee8a5c', '#c8673d', '#fde9d8', [
    ['🥱', 'Siesta en la Hamaca'], ['🪞', 'Espejo de la Abuela'], ['🧹', 'Vecina que Barre'],
    ['💌', 'Carta sin Firmar'], ['🫖', 'Té con Masitas'],
    ['📮', 'Cartero Puntual'], ['🥖', 'Panadero Madrugador'],
    ['💃', 'Bailarina de la Plaza'], ['🏘️', 'Los Vecinos de Pixelia']]],
  ['vestidos', 'Ropa de Viaje', '🧥', '#7f9ee8', '#5a78c4', '#f8f0e4', [
    ['🧦', 'Medias Desparejas'], ['🧤', 'Guantes de Cuero'], ['👒', 'Capelina de Verano'],
    ['🧣', 'Bufanda Tejida'], ['👛', 'Monedero Gastado'],
    ['👗', 'Vestido de Domingo'], ['🧥', 'Tapado Heredado'],
    ['🥾', 'Botas de Caminata'], ['🧳', 'La Valija Completa']]],
  // el id 'autitos' quedó de cuando eran autos: ahora son cosas de navegar el aire (plan §M5)
  ['autitos', 'Navegación', '⛵', '#8fd3ff', '#4fa8e0', '#daf2ff', [
    ['🪢', 'Soga de Amarre'], ['🛶', 'Canoa de Corteza'], ['🧭', 'Brújula de Céfiro'],
    ['🏮', 'Farol de Proa'], ['🪁', 'Barrilete de Señales'],
    ['🎈', 'Globo de Lona'], ['⛵', 'Balandra del Puerto'],
    ['⚓', 'Ancla de Piedra'], ['🚢', 'Maqueta de Galeón']]],
  ['postres', 'Postres', '🍰', '#ffab7a', '#e07d4a', '#ffe3d1', [
    ['🍪', 'Galleta Robada'], ['🍯', 'Caramelo de Miel'], ['🍩', 'Dona Glaseada'],
    ['🥧', 'Tarta de Manzana'], ['🍮', 'Flan con Dulce de Leche'],
    ['🍦', 'Helado de Tres Gustos'], ['🥐', 'Medialuna de Manteca'],
    ['🍫', 'Chocolate Amargo'], ['🎂', 'Torta de Cumpleaños']]],
  ['mascotas', 'Fauna de la Isla', '🦊', '#6fe3c1', '#3cbf9a', '#d4f7ec', [
    ['🦔', 'Erizo del Monte'], ['🐟', 'Pez del Arroyo'], ['🐢', 'Tortuga sin Apuro'],
    ['🐇', 'Liebre Veloz'], ['🦆', 'Pato del Bañado'],
    ['🐈', 'Gato de Granero'], ['🐕', 'Perro Pastor'],
    ['🦊', 'Zorro Gris'], ['🦌', 'Ciervo Blanco']]],
  ['flores', 'Flores', '🌸', '#9ee06a', '#6bb83c', '#e3f7d2', [
    ['🌼', 'Margarita Me Quiere'], ['🌱', 'Brote Valiente'], ['🍀', 'Trébol (de Tres, Igual)'],
    ['🌷', 'Tulipán Tímido'], ['🌻', 'Girasol Chusma'],
    ['🌹', 'Rosa con Carácter'], ['🌺', 'Hibisco Fiestero'],
    ['🌸', 'Cerezo en Flor'], ['💐', 'Ramo para Vos']]],
  ['castillos', 'Edificios', '🏛️', '#9aa6f0', '#6a76c8', '#f9f1e6', [
    ['🧱', 'Ladrillo con Onda'], ['🗝️', 'Llave Perdida'], ['🕯️', 'Vela Tembleque'],
    ['🚪', 'Puerta que Rechina'], ['🪟', 'Ventana con Macetas'],
    ['🏠', 'Casa del Árbol'], ['🗼', 'Torre del Vigía'],
    ['🏟️', 'Estadio Lleno'], ['🏛️', 'La Municipalidad de Pixelia']]],
  ['joyas', 'Tesoros', '💎', '#5fd4e0', '#2fa6b5', '#d2f4f7', [
    ['📿', 'Collar de Cuentas'], ['🧿', 'Ojo Protector'], ['⌚', 'Reloj de la Abuela'],
    ['💍', 'Anillo de Compromiso'], ['🔔', 'Campana de Bronce'],
    ['🔮', 'Bola de Cristal Chusma'], ['💠', 'Cristal Celeste'],
    ['🏆', 'Copa de Oro'], ['💎', 'Diamante Legendario']]],
  ['musica', 'Música', '🎵', '#f09774', '#c96943', '#f8f0e4', [
    ['🥁', 'Tambor Ruidoso'], ['📻', 'Radio de la Tía'], ['🎧', 'Auriculares Enredados'],
    ['🎸', 'Guitarra Fogonera'], ['🎹', 'Piano Paciente'],
    ['🎻', 'Violín Dramático'], ['🎺', 'Trompeta Mañanera'],
    ['🪗', 'Bandoneón Tanguero'], ['🎤', 'Micrófono de Estrella']]],
  ['playa', 'Costa', '🏖️', '#efc99a', '#c99a62', '#fff1de', [
    ['🐚', 'Caracol Chismoso'], ['🦀', 'Cangrejo de Costado'], ['🩴', 'Ojotas Perdidas'],
    ['⚓', 'Ancla Oxidada'], ['🍉', 'Sandía Fresca'],
    ['🐬', 'Delfín de la Bahía'], ['🏄', 'Surfista Valiente'],
    ['🐙', 'Pulpo de las Rocas'], ['🏝️', 'Isla Secreta']]],
  ['noche', 'Noche Estrellada', '🌙', '#5e83d9', '#3b5ba5', '#dfe7f8', [
    ['🦉', 'Búho Desvelado'], ['🏮', 'Farol de Papel'], ['🌙', 'Luna Menguante'],
    ['🔭', 'Telescopio Curioso'], ['🪐', 'Saturno con Pollera'],
    ['☄️', 'Cometa Apurado'], ['🌌', 'Vía Láctea'],
    ['🌠', 'Deseo Fugaz'], ['🌕', 'Luna Llena de Pixelia']]],
  ['fiesta', 'Fiesta', '🎉', '#ff6f6f', '#d94848', '#ffdada', [
    ['🎈', 'Globo Escapista'], ['🎉', 'Cotillón Ruidoso'], ['🥤', 'Gaseosa sin Gas'],
    ['🎁', 'Regalo Misterioso'], ['🍕', 'Pizza de Muzza'],
    ['🪅', 'Piñata Llena'], ['🎊', 'Lluvia de Papel Picado'],
    ['🎆', 'Fuegos Artificiales'], ['🥳', 'El Alma de la Fiesta']]],
];
// Reparto de los sets por región, en orden (DESIGN-CORE.md §7.2.4)
export const SET_REGION = {
  princesas: 'bosque', vestidos: 'bosque', autitos: 'bosque',
  postres: 'sierras', mascotas: 'sierras',
  flores: 'banado', castillos: 'banado',
  joyas: 'cerro', musica: 'cerro',
  playa: 'costa', noche: 'costa', fiesta: 'costa',
};
export const REGION_ORDER = ['bosque', 'sierras', 'banado', 'cerro', 'costa'];
export const regionName = (id) => REGIONS[id]?.name || '';
const STARS_BY_INDEX = [1, 1, 1, 2, 2, 3, 3, 4, 5];
// Orden en la página (casillero → índice en la lista): la 5★ queda en el centro, como figurita estrella.
const SLOT_ORDER = [0, 3, 1, 5, 8, 6, 2, 7, 4];

export const RARITY_NAMES = { 1: 'Común', 2: 'Linda', 3: 'Brillante', 4: 'Dorada', 5: 'Holográfica' };
export const STAR_WEIGHTS = { 1: 48, 2: 27, 3: 15, 4: 7, 5: 3 };
export const BRILLO_VALUE = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 15 };
export const PITY_5 = 45;                 // a lo sumo 45 figuritas sin una 5★
export const NEW_BIAS = 2.2;              // las que te faltan pesan más dentro de su rareza (cozy)
export const ALBUM_TITLE = 'Gran Coleccionista';
export const ALBUM_REWARD = { chest: 'real', chests: 2, gems: 50, title: ALBUM_TITLE };

export const STICKER_SETS = RAW.map(([id, name, emoji, color, dark, light, list], si) => {
  const set = { id, name, emoji, color, dark, light, index: si, region: SET_REGION[id] || 'bosque', stickers: [] };
  for (let slot = 0; slot < 9; slot++) {
    const di = SLOT_ORDER[slot];
    const [em, nm] = list[di];
    set.stickers.push({
      id: `${id}-${slot + 1}`, n: si * 9 + slot + 1, slot, set: id, setName: name, setEmoji: emoji,
      name: nm, emoji: em, stars: STARS_BY_INDEX[di], color, dark, light,
    });
  }
  set.starSum = set.stickers.reduce((a, s) => a + s.stars, 0);
  return set;
});
export const SET_BY_ID = Object.fromEntries(STICKER_SETS.map(s => [s.id, s]));
export const STICKERS = STICKER_SETS.flatMap(s => s.stickers);
export const STICKER_BY_ID = Object.fromEntries(STICKERS.map(s => [s.id, s]));
export const TOTAL_STICKERS = STICKERS.length;
const BY_STARS = { 1: [], 2: [], 3: [], 4: [], 5: [] };
for (const s of STICKERS) BY_STARS[s.stars].push(s);

/** Figuritas que trae cada cofre (para sumarlas en openChest). */
export const CHEST_STICKERS = {
  madera: { n: 2, minStars: 1 },
  plata: { n: 3, minStars: 2 },
  oro: { n: 4, minStars: 3 },
  real: { n: 6, minStars: 4 },
};
export function stickerDropsForChest(type) { return { ...(CHEST_STICKERS[type] || { n: 0, minStars: 1 }) }; }

/** Tienda de brillitos. */
export const SHOP = [
  { id: 'sobre_comun', kind: 'pack', name: 'Sobre Común', cost: 10, n: 3, minStars: 1, desc: '3 hallazgos', color: '#ee8a5c', dark: '#c8673d', emoji: '🌸' },
  { id: 'sobre_brillante', kind: 'pack', name: 'Sobre Brillante', cost: 30, n: 3, minStars: 3, desc: '3 hallazgos · uno de 3★ o más', color: '#8fd3ff', dark: '#4fa8e0', emoji: '💎' },
  { id: 'sobre_dorado', kind: 'pack', name: 'Sobre Dorado', cost: 70, n: 5, minStars: 4, desc: '5 hallazgos · uno de 4★ o más', color: '#ffd166', dark: '#e8a93a', emoji: '🌟' },
  { id: 'cofre_plata', kind: 'chest', name: 'Cofre de Plata', cost: 45, chest: 'plata', desc: 'Un cofre con premios y 3 hallazgos', color: '#c9d6ea', dark: '#8fa3c2', emoji: '🎁' },
];
export const SHOP_BY_ID = Object.fromEntries(SHOP.map(i => [i.id, i]));
/** Sobre genérico para mostrar figuritas que llegan de otras fuentes (cofres, juegos, regalos). */
export const PACK_FOR_STARS = (minStars = 1) => minStars >= 4 ? SHOP_BY_ID.sobre_dorado : minStars >= 3 ? SHOP_BY_ID.sobre_brillante : SHOP_BY_ID.sobre_comun;

// ---------- Estado ----------
export function albumState() {
  const s = store.state;
  if (!s) return null;
  let created = false;
  if (!s.album || typeof s.album !== 'object') { s.album = {}; created = true; }
  const a = s.album;
  if (!a.have || typeof a.have !== 'object') { a.have = {}; created = true; }
  if (!Array.isArray(a.claimedSets)) { a.claimedSets = []; created = true; }
  if (typeof a.brillitos !== 'number') { a.brillitos = 0; created = true; }
  if (!Array.isArray(a.seen)) { a.seen = []; created = true; }
  if (!Array.isArray(a.done)) { a.done = []; created = true; }
  if (typeof a.since5 !== 'number') { a.since5 = 0; created = true; }
  if (created) store.markDirty();
  return a;
}
const A = albumState;

// ---------- Consultas ----------
export function stickerDef(id) { return STICKER_BY_ID[id] || null; }
export function stickerCount(id) { return A().have[id] || 0; }
export function hasSticker(id) { return stickerCount(id) > 0; }
export function brillitos() { return A().brillitos; }
export function isClaimed(setId) { return A().claimedSets.includes(setId); }
export function isUnseen(id) { const a = A(); return (a.have[id] || 0) > 0 && !a.seen.includes(id); }
export function unseenCount(setId) {
  const list = setId ? SET_BY_ID[setId]?.stickers || [] : STICKERS;
  return list.reduce((n, s) => n + (isUnseen(s.id) ? 1 : 0), 0);
}
/** Marca figuritas como vistas (ya "pegadas"). No emite album:changed (es solo visual). */
export function markSeen(ids) {
  const a = A();
  let ch = false;
  for (const id of [].concat(ids)) if ((a.have[id] || 0) > 0 && !a.seen.includes(id)) { a.seen.push(id); ch = true; }
  if (ch) { store.markDirty(); bus.emit('album:seen', { ids: [].concat(ids) }); }
}

/** Progreso de un set: { setId, have, total, complete, claimed, claimable, reward } */
export function setProgress(setId) {
  const set = SET_BY_ID[setId];
  if (!set) return null;
  const a = A();
  const have = set.stickers.filter(s => (a.have[s.id] || 0) > 0).length;
  const complete = have === set.stickers.length;
  const claimed = a.claimedSets.includes(setId);
  return { setId, have, total: set.stickers.length, complete, claimed, claimable: complete && !claimed, reward: setReward(setId) };
}
/** Progreso total del álbum. */
export function albumProgress() {
  const a = A();
  const have = STICKERS.filter(s => (a.have[s.id] || 0) > 0).length;
  const setsComplete = STICKER_SETS.filter(s => setProgress(s.id).complete).length;
  return { have, total: TOTAL_STICKERS, pct: have / TOTAL_STICKERS, setsComplete, setsClaimed: a.claimedSets.length, sets: STICKER_SETS.length, albumDone: !!a.albumDone, title: a.title || null };
}
export function claimableSets() { return STICKER_SETS.filter(s => setProgress(s.id).claimable).map(s => s.id); }
/** Para un badge en el HUD: sets para reclamar + figuritas nuevas sin pegar. */
export function albumBadge() { return claimableSets().length + unseenCount(); }

/**
 * Premio de un set. Se escala con la suma de estrellas del set (22 en todos) y con cuántos sets ya
 * reclamaste (cada set nuevo da +12%), las monedas además con el nivel. Los primeros 6 dan Cofre de Plata; después, sin
 * cofre (Fase 5b: §8, ≤ 1,5 cofres por día; el álbum completo sigue dando los suyos).
 */
export function setReward(setId) {
  const set = SET_BY_ID[setId];
  if (!set) return null;
  const a = A();
  const k = a.claimedSets.includes(setId) ? Math.max(0, a.claimedSets.indexOf(setId)) : a.claimedSets.length;
  const m = 1 + k * 0.12;
  const lvl = store.state?.player?.level || 1;
  return {
    gems: Math.round(set.starSum * 0.15 * m),   // Fase 5b: era × 0,5 (§8: 15–25 gemas por día)
    coins: Math.round(set.starSum * 25 * m * rewardScale(lvl) / 10) * 10,
    chest: k < 6 ? 'plata' : null,
  };
}

/** Repetidas: [{id, count (total que tenés), extra (count-1), stars, value (brillitos de las extra)}], mejores primero. */
export function duplicates() {
  const a = A();
  return Object.entries(a.have).filter(([id, c]) => c >= 2 && STICKER_BY_ID[id])
    .map(([id, count]) => { const st = STICKER_BY_ID[id].stars; return { id, count, extra: count - 1, stars: st, value: (count - 1) * BRILLO_VALUE[st] }; })
    .sort((x, y) => y.stars - x.stars || STICKER_BY_ID[x.id].n - STICKER_BY_ID[y.id].n);
}
/** Cuánto darían las repetidas: { count, brillitos } (maxStars opcional para guardar las mejores). */
export function duplicatesValue({ maxStars = 5, ids = null } = {}) {
  let count = 0, value = 0;
  for (const d of duplicates()) {
    if (d.stars > maxStars || (ids && !ids.includes(d.id))) continue;
    count += d.extra; value += d.value;
  }
  return { count, brillitos: value };
}

// ---------- Sorteo ----------
const rand = () => Math.random();
function pickWeighted(entries) { // [[valor, peso]]
  const tot = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * tot;
  for (const [v, w] of entries) { if ((r -= w) <= 0) return v; }
  return entries[entries.length - 1][0];
}
function pickTier(minStars = 1) {
  return Number(pickWeighted(Object.entries(STAR_WEIGHTS).filter(([s]) => Number(s) >= minStars)));
}
function pickSticker(stars, inPack, region = null) {
  const a = A();
  // explorando una región: solo de sus sets (si una región no tuviera de esa rareza, de todos)
  const own = region ? BY_STARS[stars].filter(s => SET_REGION[s.set] === region) : [];
  return pickWeighted((own.length ? own : BY_STARS[stars]).map(s => {
    let w = (a.have[s.id] || 0) > 0 ? 1 : NEW_BIAS;
    if (inPack.has(s.id)) w *= 0.25;
    return [s, w];
  }));
}

/** Suma figuritas concretas ({id: n}) y devuelve [{id, stars, isNew, count}]. Emite album:changed y album:setComplete. */
function addStickers(entries, source, reason) {
  const a = A();
  const out = [];
  for (const [id, n] of entries) {
    const def = STICKER_BY_ID[id];
    if (!def || n <= 0) continue;
    const before = a.have[id] || 0;
    a.have[id] = before + n;
    out.push({ id, stars: def.stars, isNew: before === 0, count: a.have[id] });
  }
  if (!out.length) return out;
  const newCount = out.filter(x => x.isNew).length;
  store.inc('stickersEarned', out.length);
  if (newCount) store.inc('stickersNew', newCount);
  store.markDirty();
  bus.emit('album:changed', { reason, source, added: out, newCount });
  checkCompletions();
  return out;
}
function checkCompletions() {
  const a = A();
  for (const set of STICKER_SETS) {
    if (a.done.includes(set.id)) continue;
    if (set.stickers.every(s => (a.have[s.id] || 0) > 0)) {
      a.done.push(set.id);
      store.markDirty();
      bus.emit('album:setComplete', { setId: set.id });
    }
  }
}

/**
 * Sortea y acredita n figuritas. minStars: al menos una tendrá esa rareza o más.
 * Devuelve [{id, stars, isNew, count}] ordenadas de menor a mayor rareza (lo mejor al final).
 */
export function grantStickers(n = 1, { minStars = 1, source = '', region = null } = {}) {
  const a = A();
  n = Math.max(0, Math.min(60, Math.round(Number(n) || 0)));
  if (!n) return [];
  minStars = Math.max(1, Math.min(5, Math.round(Number(minStars) || 1)));
  const tiers = Array.from({ length: n }, () => pickTier(1));
  if (minStars > 1 && !tiers.some(t => t >= minStars)) tiers[n - 1] = pickTier(minStars);
  // racha de suerte: a lo sumo PITY_5 figuritas sin una holográfica
  if (!tiers.includes(5)) {
    const firstForced = PITY_5 - a.since5 - 1;
    if (firstForced < n) tiers[Math.max(0, firstForced)] = 5;
  }
  tiers.sort((x, y) => x - y);
  // since5: figuritas desde la última 5★
  const last5 = tiers.lastIndexOf(5);
  a.since5 = last5 >= 0 ? n - 1 - last5 : a.since5 + n;
  const inPack = new Set();
  const picks = tiers.map(t => { const s = pickSticker(t, inPack, REGIONS[region] ? region : null); inPack.add(s.id); return s.id; });
  // se acreditan una por una: si la misma sale dos veces, la segunda ya no es nueva
  return addStickers(picks.map(id => [id, 1]), source, 'grant');
}

// ---------- Premios de sets ----------
/** Reclama el premio de un set completo. Devuelve {setId, coins, gems, chest, album?} o null. */
export function claimSet(setId) {
  const p = setProgress(setId);
  if (!p || !p.claimable) return null;
  const a = A();
  const rew = setReward(setId);
  a.claimedSets.push(setId);
  store.grant({ coins: rew.coins, gems: rew.gems }, 'album');
  if (rew.chest) bus.emit('reward:chest', { type: rew.chest, n: 1, source: 'album' });
  store.inc('albumSets');
  const result = { setId, ...rew };
  if (a.claimedSets.length >= STICKER_SETS.length && !a.albumDone) {
    a.albumDone = true;
    a.title = ALBUM_TITLE;
    store.grant({ gems: ALBUM_REWARD.gems }, 'album');
    bus.emit('reward:chest', { type: ALBUM_REWARD.chest, n: ALBUM_REWARD.chests, source: 'album' });
    bus.emit('player:title', { title: ALBUM_TITLE, source: 'album' });
    bus.emit('album:complete', { title: ALBUM_TITLE });
    result.album = { ...ALBUM_REWARD };
  }
  store.markDirty();
  store.save();
  bus.emit('album:changed', { reason: 'claim', setId });
  return result;
}

// ---------- Brillitos ----------
/**
 * Cambia repetidas por brillitos (siempre deja 1 de cada una).
 * opts.maxStars: no tocar las de más estrellas; opts.ids: solo esas figuritas.
 * Devuelve { count, brillitos }.
 */
export function convertDuplicates({ maxStars = 5, ids = null } = {}) {
  const a = A();
  let count = 0, gained = 0;
  for (const d of duplicates()) {
    if (d.stars > maxStars || (ids && !ids.includes(d.id))) continue;
    a.have[d.id] = 1;
    count += d.extra; gained += d.value;
  }
  if (!count) return { count: 0, brillitos: 0 };
  a.brillitos += gained;
  store.inc('brillitosEarned', gained);
  store.markDirty();
  bus.emit('album:changed', { reason: 'convert', count, brillitos: gained });
  return { count, brillitos: gained };
}
export function addBrillitos(n, source = '') {
  n = Math.round(n);
  if (!n) return;
  const a = A();
  a.brillitos = Math.max(0, a.brillitos + n);
  store.markDirty();
  bus.emit('album:changed', { reason: 'brillitos', brillitos: n, source });
}
export function canBuy(itemId) { const it = SHOP_BY_ID[itemId]; return !!it && A().brillitos >= it.cost; }
/** Compra en la tienda de brillitos. Devuelve {item, stickers?} o null si no alcanza. */
export function buyShopItem(itemId) {
  const it = SHOP_BY_ID[itemId];
  const a = A();
  if (!it || a.brillitos < it.cost) return null;
  a.brillitos -= it.cost;
  store.markDirty();
  if (it.kind === 'chest') {
    bus.emit('reward:chest', { type: it.chest, n: 1, source: 'album' });
    bus.emit('album:changed', { reason: 'buy', item: it.id });
    store.save();
    return { item: it };
  }
  const stickers = grantStickers(it.n, { minStars: it.minStars, source: 'shop:' + it.id });
  store.save();
  return { item: it, stickers };
}

// ---------- Intercambio (lo usa la UI social / online) ----------
/** ¿Se puede ofrecer? (solo repetidas) */
export function canTrade(id) { return stickerCount(id) >= 2; }
/** Descuenta n repetidas (escrow al ofrecer). Nunca deja en 0. Devuelve true si pudo. */
export function takeStickers(id, n = 1) {
  const a = A();
  if ((a.have[id] || 0) - n < 1) return false;
  a.have[id] -= n;
  store.markDirty();
  bus.emit('album:changed', { reason: 'trade-out', id, n });
  return true;
}
/** Acredita figuritas concretas (intercambio, regalo, devolución de escrow): { id: n } → [{id, stars, isNew, count}] */
export function giveStickers(map, source = 'trade') {
  return addStickers(Object.entries(map || {}).map(([id, n]) => [id, Math.max(0, Math.round(n))]), source, 'give');
}

// ---------- Init ----------
let inited = false;
let offs = [];
export function initAlbum() {
  albumState();
  if (inited) return;
  inited = true;
  offs.push(bus.on('reward:stickers', (p = {}) => {
    const { n = 1, minStars = 1, source = 'reward', region = null } = p;
    const res = grantStickers(n, { minStars, source, region });
    // quien emitió puede leer el resultado para mostrarlo
    if (p && typeof p === 'object') p.result = res;
  }));
  checkCompletions();
}
/** Para pruebas: desengancha el bus. */
export function disposeAlbum() { offs.forEach(f => f()); offs = []; inited = false; }
