// Sistema de cofres: tipos de cofre, rarezas, objetos, sorteo con "racha de suerte", inventario y efectos activos.
// UI en chests-ui.js. Los premios {chest:'plata'} en store.grant llegan acá vía el evento 'reward:chest'.
import { bus } from '../core/bus.js';
import { store } from '../core/state.js';
import { CUSTOM_CATALOG, BUILDING_BY_ID, rewardScale } from '../core/data.js';
import { stickerDropsForChest, grantStickers } from '../album/album.js';

const S = () => store.state;

// ---------- Rarezas ----------
export const RARITIES = {
  comun: { id: 'comun', name: 'Común', color: '#6fe3c1', dark: '#3cbf9a', order: 0 },
  rara: { id: 'rara', name: 'Rara', color: '#8fd3ff', dark: '#4fa8e0', order: 1 },
  epica: { id: 'epica', name: 'Épica', color: '#b58cff', dark: '#8a5ee0', order: 2 },
  legendaria: { id: 'legendaria', name: 'Legendaria', color: '#ffd166', dark: '#e8a93a', order: 3 },
};
export const RARITY_LIST = Object.values(RARITIES);

// ---------- Cofres ----------
// odds: pesos por rareza para cada slot; guarantee: rareza mínima de al menos un slot
export const CHESTS = {
  madera: { id: 'madera', name: 'Cofre de Madera', slots: 3, odds: { comun: 74, rara: 22, epica: 4, legendaria: 0 }, guarantee: null, price: null, color: '#b07a52', trim: '#d8d2e6' },
  plata: { id: 'plata', name: 'Cofre de Plata', slots: 4, odds: { comun: 52, rara: 34, epica: 12, legendaria: 2 }, guarantee: 'rara', price: { gems: 20 }, color: '#c9d6ea', trim: '#8fd3ff' },
  oro: { id: 'oro', name: 'Cofre de Oro', slots: 5, odds: { comun: 30, rara: 42, epica: 22, legendaria: 6 }, guarantee: 'epica', price: { gems: 50 }, color: '#ffd166', trim: '#ff7eb6' },
  real: { id: 'real', name: 'Cofre Real', slots: 6, odds: { comun: 0, rara: 45, epica: 38, legendaria: 17 }, guarantee: 'legendaria', price: { gems: 120 }, color: '#ff7eb6', trim: '#ffd166' },
};
export const CHEST_LIST = Object.values(CHESTS);
export const FREE_CHEST_EVERY_MS = 4 * 3600 * 1000;
export const FREE_CHEST_MAX = 2;          // se acumulan hasta 2 cofres gratis
export const PITY_LEGENDARY = 20;         // a lo sumo 20 cofres sin legendaria

// ---------- Objetos ----------
// kind:
//  'coins'|'gems'|'xp'   — se acreditan al abrir (amount = [min,max], monedas escalan con nivel)
//  'item'                — va a la mochila (consumible). use: 'city' (se usa desde la mochila) | 'game' (se usa al empezar ese juego)
//  'cosmetic'            — desbloquea una prenda/parte de auto que no tengas (pool: 'coins' o 'gems' según su precio)
//  'build'               — una construcción gratis de esos edificios (pool), sin requisito de nivel
export const ITEMS = {
  coins_s: { name: 'Bolsita de monedas', rarity: 'comun', kind: 'coins', amount: [120, 220], icon: 'coin' },
  xp_s: { name: 'Pergamino de saber', rarity: 'comun', kind: 'xp', amount: [25, 45], icon: 'xp' },
  hammer: { name: 'Martillo Mágico', rarity: 'comun', kind: 'item', use: 'city', icon: '🔨', desc: 'Termina una obra o mejora al instante.' },
  m3_moves: { name: '+5 Movidas', rarity: 'comun', kind: 'item', use: 'game', game: 'match3', icon: '👟', desc: 'Empezá un nivel de Joyas Reales con 5 movidas extra.' },
  blk_bomb: { name: 'Bomba de Bloques', rarity: 'comun', kind: 'item', use: 'game', game: 'blocks', icon: '💣', desc: 'En Bloques Mágicos: limpia un área de 3x3 cuando quieras.' },
  park_time: { name: 'Reloj Extra', rarity: 'comun', kind: 'item', use: 'game', game: 'parking', icon: '⏱️', desc: 'Estacionamiento Real: +30 segundos y 2 toques gratis.' },

  coins_m: { name: 'Cofrecito de monedas', rarity: 'rara', kind: 'coins', amount: [400, 650], icon: 'coin' },
  gems_s: { name: 'Puñado de gemas', rarity: 'rara', kind: 'gems', amount: [3, 6], icon: 'gem' },
  hourglass: { name: 'Reloj de Arena', rarity: 'rara', kind: 'item', use: 'city', icon: '⏳', desc: 'Adelanta 1 hora todas las obras y mejoras en curso.' },
  potion_prod: { name: 'Poción Dorada', rarity: 'rara', kind: 'item', use: 'city', icon: '🧪', desc: 'Producción x2 en toda la ciudad durante 30 minutos.', boost: { type: 'prod', mult: 2, minutes: 30 } },
  m3_bomb: { name: 'Bomba de Joyas', rarity: 'rara', kind: 'item', use: 'game', game: 'match3', icon: '💥', desc: 'Empezá un nivel de Joyas Reales con 2 bombas en el tablero.' },
  drv_shield: { name: 'Escudo de Viaje', rarity: 'rara', kind: 'item', use: 'game', game: 'driving', icon: '🛡️', desc: 'Empezá Paseo Real con escudo y turbo cargado.' },

  gems_m: { name: 'Bolsa de gemas', rarity: 'epica', kind: 'gems', amount: [10, 16], icon: 'gem' },
  potion_happy: { name: 'Perfume de Alegría', rarity: 'epica', kind: 'item', use: 'city', icon: '🌸', desc: 'Felicidad al máximo (+50% producción) durante 1 hora.', boost: { type: 'happy', minutes: 60 } },
  cosmetic_coins: { name: 'Prenda sorpresa', rarity: 'epica', kind: 'cosmetic', pool: 'coins', icon: '🎀', desc: 'Una prenda o parte de auto nueva, gratis.' },
  build_deco: { name: 'Deco sorpresa', rarity: 'epica', kind: 'build', pool: ['fuente', 'estatua', 'glorieta', 'arco_rosas', 'cerezo', 'macetas'], icon: '⛲', desc: 'Una decoración gratis para tu ciudad.' },

  gems_l: { name: 'Tesoro de gemas', rarity: 'legendaria', kind: 'gems', amount: [30, 45], icon: 'gem' },
  potion_mega: { name: 'Elixir Real', rarity: 'legendaria', kind: 'item', use: 'city', icon: '✨', desc: 'Producción x3 en toda la ciudad durante 2 horas.', boost: { type: 'prod', mult: 3, minutes: 120 } },
  cosmetic_gems: { name: 'Prenda legendaria', rarity: 'legendaria', kind: 'cosmetic', pool: 'gems', icon: '👑', desc: 'Una prenda o parte de auto premium (de las que cuestan gemas), gratis.' },
  build_legend: { name: 'Monumento legendario', rarity: 'legendaria', kind: 'build', pool: ['unicornio', 'lago', 'rueda'], icon: '🦄', desc: 'Una construcción legendaria gratis, ¡aunque no tengas el nivel!' },
};
for (const [id, it] of Object.entries(ITEMS)) it.id = id;
const BY_RARITY = Object.fromEntries(RARITY_LIST.map(r => [r.id, Object.values(ITEMS).filter(i => i.rarity === r.id)]));

// ---------- Estado ----------
function cs() {
  const s = S();
  if (!s.chests) s.chests = {};
  const c = s.chests;
  c.inv ??= {};               // cofres sin abrir: { madera: 2, ... }
  c.items ??= {};             // mochila: { hammer: 1, ... }
  c.freeBuilds ??= {};        // construcciones gratis: { fuente: 1 }
  c.boosts ??= {};            // efectos activos: { prod: {mult, until}, happy: {until} }
  c.freeBase ??= Date.now() - FREE_CHEST_EVERY_MS; // el primer cofre gratis ya está listo
  c.sinceLegend ??= 0;
  c.opened ??= 0;
  c.winsSinceChest ??= 0;
  return c;
}

// ---------- Aleatoriedad ----------
const rand = () => Math.random();
const pickWeighted = (weights) => {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  let r = rand() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) { if ((r -= w) <= 0) return k; }
  return entries[entries.length - 1][0];
};
const randInt = (a, b) => a + Math.floor(rand() * (b - a + 1));

// Qué prendas se pueden sortear (que no tengas)
function cosmeticPool(pool) {
  const s = S(), out = [];
  for (const [kind, list] of Object.entries(CUSTOM_CATALOG))
    for (const it of list) {
      if (it.free || store.owns(kind, it.id) || !it.price) continue;
      if ((pool === 'gems') === !!it.price.gems) out.push({ kind, id: it.id, name: it.name });
    }
  return out;
}

/** Arma un premio concreto a partir de un tipo de objeto (resuelve montos, prenda, edificio). */
function resolveDrop(item) {
  const lvl = S().player.level;
  const d = { item: item.id, rarity: item.rarity, name: item.name, icon: item.icon, kind: item.kind };
  if (item.kind === 'coins') d.amount = Math.round(randInt(...item.amount) * rewardScale(lvl));
  else if (item.kind === 'gems') d.amount = randInt(...item.amount);
  else if (item.kind === 'xp') d.amount = Math.round(randInt(...item.amount) * Math.sqrt(rewardScale(lvl)));
  else if (item.kind === 'item') d.amount = 1;
  else if (item.kind === 'cosmetic') {
    const pool = cosmeticPool(item.pool);
    if (!pool.length) return { ...d, kind: 'gems', amount: item.pool === 'gems' ? 35 : 12, name: 'Gemas (ya tenés todo)', icon: 'gem', converted: true };
    const c = pool[Math.floor(rand() * pool.length)];
    Object.assign(d, { amount: 1, target: c.kind, targetId: c.id, name: c.name, cosmeticKind: c.kind });
  } else if (item.kind === 'build') {
    const id = item.pool[Math.floor(rand() * item.pool.length)];
    Object.assign(d, { amount: 1, building: id, name: BUILDING_BY_ID[id].name });
  }
  return d;
}

/** Sortea el contenido de un cofre (sin aplicarlo). */
export function rollChest(type) {
  const def = CHESTS[type];
  const c = cs();
  const rarities = [];
  for (let i = 0; i < def.slots; i++) rarities.push(pickWeighted(def.odds));
  // garantía del cofre
  const order = r => RARITIES[r].order;
  if (def.guarantee && !rarities.some(r => order(r) >= order(def.guarantee))) rarities[rarities.length - 1] = def.guarantee;
  // racha de suerte: si hace mucho que no sale legendaria
  if (!rarities.includes('legendaria') && c.sinceLegend + 1 >= PITY_LEGENDARY) rarities[rarities.length - 1] = 'legendaria';
  rarities.sort((a, b) => order(a) - order(b)); // de menor a mayor: lo mejor al final (más emoción)
  const used = new Set();
  return rarities.map(r => {
    let options = BY_RARITY[r].filter(i => !used.has(i.id));
    if (!options.length) options = BY_RARITY[r];
    const it = options[Math.floor(rand() * options.length)];
    used.add(it.id);
    return resolveDrop(it);
  });
}

/** Acredita los premios ya sorteados. */
function applyDrops(drops) {
  const c = cs();
  const totals = { coins: 0, gems: 0, xp: 0 };
  for (const d of drops) {
    if (d.kind === 'coins' || d.kind === 'gems' || d.kind === 'xp') totals[d.kind] += d.amount;
    else if (d.kind === 'item') c.items[d.item] = (c.items[d.item] || 0) + d.amount;
    else if (d.kind === 'cosmetic') {
      const owned = S().owned;
      (owned[d.cosmeticKind] ||= []).includes(d.targetId) || owned[d.cosmeticKind].push(d.targetId);
      store.inc('bought');
      bus.emit('item:unlocked', { kind: d.cosmeticKind, id: d.targetId, source: 'chest' });
    } else if (d.kind === 'build') c.freeBuilds[d.building] = (c.freeBuilds[d.building] || 0) + 1;
  }
  if (totals.coins || totals.gems || totals.xp) store.grant(totals, 'chest');
}

// ---------- API pública ----------
export function chestCount(type) { const c = cs(); return type ? (c.inv[type] || 0) : Object.values(c.inv).reduce((a, b) => a + b, 0); }
export function addChest(type, n = 1, source = '') {
  if (!CHESTS[type]) return;
  const c = cs();
  c.inv[type] = (c.inv[type] || 0) + n;
  store.markDirty();
  bus.emit('chests:changed', { added: type, n, source });
}
// Rareza de la carta de figuritas según la mejor figurita del sobre (1–2★ común … 5★ legendaria)
const STAR_RARITY = { 1: 'comun', 2: 'comun', 3: 'rara', 4: 'epica', 5: 'legendaria' };
/** Carta "Figuritas" para la apertura: kind 'stickers', stickers: [{id, stars, isNew, count}]. */
function stickerDrop(got, type) {
  const best = Math.max(...got.map(g => g.stars));
  const fresh = got.filter(g => g.isNew).length;
  return {
    item: 'stickers', kind: 'stickers', rarity: STAR_RARITY[best] || 'comun', icon: '🌟', amount: got.length,
    name: got.length === 1 ? '1 figurita' : `${got.length} figuritas`, stickers: got, fresh, chest: type,
  };
}

/**
 * Abre un cofre del inventario. Devuelve la lista de premios (ya acreditados) o null.
 * Además de los objetos, cada cofre trae figuritas del álbum (madera 2, plata 3, oro 4, real 6): van en una
 * carta {kind:'stickers'} ubicada según su rareza.
 */
export function openChest(type) {
  const c = cs();
  if (!c.inv[type]) return null;
  c.inv[type]--;
  const drops = rollChest(type);
  applyDrops(drops);
  c.opened++;
  c.sinceLegend = drops.some(d => d.rarity === 'legendaria') ? 0 : c.sinceLegend + 1;
  const sd = stickerDropsForChest(type);
  if (sd.n > 0) {
    let got = [];
    try { got = grantStickers(sd.n, { minStars: sd.minStars, source: 'chest:' + type }); } catch (e) { console.error(e); }
    if (got.length) {
      const card = stickerDrop(got, type);
      const ord = RARITIES[card.rarity].order;
      let at = drops.findIndex(d => RARITIES[d.rarity].order > ord);
      if (at < 0) at = drops.length;
      drops.splice(at, 0, card);
    }
  }
  store.inc('chestsOpened');
  store.markDirty();
  store.save();
  bus.emit('chests:changed', { opened: type, drops });
  return drops;
}
/** Compra con gemas y lo deja en el inventario. */
export function buyChest(type) {
  const def = CHESTS[type];
  if (!def?.price || !store.spend(def.price, 'chest:' + type)) return false;
  addChest(type, 1, 'shop');
  return true;
}

// Cofre gratis cada 4 h (se acumulan hasta FREE_CHEST_MAX)
export function freeChestStatus(now = Date.now()) {
  const c = cs();
  const ready = Math.min(FREE_CHEST_MAX, Math.floor((now - c.freeBase) / FREE_CHEST_EVERY_MS));
  const nextIn = ready >= FREE_CHEST_MAX ? 0 : FREE_CHEST_EVERY_MS - ((now - c.freeBase) % FREE_CHEST_EVERY_MS);
  return { ready, nextIn, max: FREE_CHEST_MAX };
}
export function claimFreeChest(now = Date.now()) {
  const st = freeChestStatus(now);
  if (st.ready <= 0) return false;
  const c = cs();
  // si estaba en el tope, el contador vuelve a empezar desde ahora
  c.freeBase = st.ready >= FREE_CHEST_MAX ? now - (FREE_CHEST_MAX - 1) * FREE_CHEST_EVERY_MS : c.freeBase + FREE_CHEST_EVERY_MS;
  addChest('madera', 1, 'free');
  return true;
}

// ---------- Mochila ----------
export function itemCount(id) { return cs().items[id] || 0; }
export function backpack() {
  const c = cs();
  return Object.entries(c.items).filter(([, n]) => n > 0).map(([id, n]) => ({ ...ITEMS[id], count: n }))
    .sort((a, b) => RARITIES[b.rarity].order - RARITIES[a.rarity].order);
}
/** Gasta un objeto (para potenciadores de minijuegos). Devuelve true si había. */
export function consumeItem(id) {
  const c = cs();
  if (!c.items[id]) return false;
  c.items[id]--;
  store.markDirty();
  bus.emit('chests:changed', { used: id });
  return true;
}
/**
 * Usa un objeto de ciudad. opts.uid para el martillo (edificio en obra).
 * Devuelve {ok, msg} — el texto se muestra en un toast.
 */
export function useCityItem(id, opts = {}) {
  const item = ITEMS[id];
  if (!item || item.use !== 'city' || !itemCount(id)) return { ok: false, msg: 'No tenés ese objeto' };
  const now = Date.now();
  const s = S();
  if (id === 'hammer') {
    const b = s.city.buildings.find(x => x.uid === opts.uid) || s.city.buildings.find(x => x.buildEnd > now || x.upgradeEnd > now);
    if (!b || !(b.buildEnd > now || b.upgradeEnd > now)) return { ok: false, msg: 'No hay ninguna obra en curso' };
    if (b.buildEnd > now) b.buildEnd = now - 1; else b.upgradeEnd = now - 1;
    consumeItem(id);
    return { ok: true, msg: '¡Obra terminada!', uid: b.uid };
  }
  if (id === 'hourglass') {
    const busy = s.city.buildings.filter(x => x.buildEnd > now || x.upgradeEnd > now);
    if (!busy.length) return { ok: false, msg: 'No hay obras en curso' };
    for (const b of busy) { if (b.buildEnd > now) b.buildEnd -= 3600e3; if (b.upgradeEnd > now) b.upgradeEnd -= 3600e3; }
    consumeItem(id);
    return { ok: true, msg: `¡${busy.length} obra${busy.length > 1 ? 's' : ''} adelantada${busy.length > 1 ? 's' : ''} 1 hora!` };
  }
  if (item.boost) {
    const c = cs();
    const cur = c.boosts[item.boost.type];
    const base = cur && cur.until > now ? cur.until : now;
    // misma intensidad: se suma el tiempo; distinta: queda la más fuerte con el tiempo nuevo
    const mult = item.boost.mult || 1;
    c.boosts[item.boost.type] = { mult: Math.max(mult, cur && cur.until > now ? cur.mult || 1 : 1), until: (cur && cur.until > now && (cur.mult || 1) === mult ? base : now) + item.boost.minutes * 60e3 };
    consumeItem(id);
    bus.emit('boosts:changed', { type: item.boost.type });
    return { ok: true, msg: item.boost.type === 'prod' ? `¡Producción x${c.boosts.prod.mult}!` : '¡La ciudad está feliz!' };
  }
  return { ok: false, msg: 'Ese objeto se usa en un minijuego' };
}

// ---------- Efectos activos (los lee economy.js) ----------
export function activeBoosts(now = Date.now()) {
  const b = cs().boosts, out = {};
  if (b.prod && b.prod.until > now) out.prod = { mult: b.prod.mult, leftMs: b.prod.until - now };
  if (b.happy && b.happy.until > now) out.happy = { leftMs: b.happy.until - now };
  return out;
}
export function prodBoostMult(now = Date.now()) { return activeBoosts(now).prod?.mult || 1; }
export function happyBoostActive(now = Date.now()) { return !!activeBoosts(now).happy; }

// ---------- Construcciones gratis ----------
export function freeBuildCount(id) { return cs().freeBuilds[id] || 0; }
export function consumeFreeBuild(id) {
  const c = cs();
  if (!c.freeBuilds[id]) return false;
  c.freeBuilds[id]--;
  store.markDirty();
  bus.emit('chests:changed', { usedBuild: id });
  return true;
}

// ---------- Fuentes de cofres ----------
/**
 * Cofre por terminar un minijuego. Devuelve el tipo ganado o null.
 * Ganar da chance de madera/plata; cada 4 victorias sin cofre se garantiza uno.
 */
export function rollGameChest({ won, stars = 0 }) {
  if (!won) return null;
  const c = cs();
  c.winsSinceChest++;
  let type = null;
  const r = rand();
  if (stars >= 3 && r < 0.12) type = 'plata';
  else if (r < 0.22 + stars * 0.06) type = 'madera';
  if (!type && c.winsSinceChest >= 4) type = 'madera';
  if (type) { c.winsSinceChest = 0; addChest(type, 1, 'game'); }
  return type;
}
/** Cofres por subir de nivel: madera siempre, oro cada 5 niveles, real en 20/30/40. */
export function levelUpChests(level) {
  const out = ['madera'];
  if (level % 5 === 0) out.push('oro');
  if (level % 10 === 0 && level >= 20) out.push('real');
  return out;
}

/** Cantidad de cosas para atender (badge): cofres sin abrir + gratis listos. */
export function chestBadge() { return chestCount() + freeChestStatus().ready; }

export function initChests() {
  cs();
  bus.on('reward:chest', ({ type, n = 1, source }) => addChest(type, n, source));
  bus.on('level:up', ({ level }) => { for (const t of levelUpChests(level)) addChest(t, 1, 'levelup'); });
}
