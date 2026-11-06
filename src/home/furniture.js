// Mi Casa: catálogo de muebles, ampliaciones de la casa, Confort y reglas de colocación (sin DOM ni three.js).
// Estado: state.home = { items: [{uid, id, x, z, rot}], wall: id, floor: id, nextUid, owned: {id: cantidad sin poner}, seen }
// El nivel de la casa es el nivel del edificio 'mi_casa' de la ciudad (se amplía como cualquier mejora, con constructora).
// Coordenadas: grilla del cuarto en tiles, x hacia la derecha, z hacia el frente; las paredes están en z = 0 (fondo) y
// x = 0 (izquierda). Los muebles de pared (wall: true) se ubican pegados a esas dos paredes.
import { bus } from '../core/bus.js';
import { store } from '../core/state.js';

// size: [ancho, fondo] en tiles. comfort: Confort que suma. price: {coins|gems}. rank: rango de ciudad para comprarlo.
// sit: se puede sentar · bed: cama · wardrobe: abre el Vestidor · rug: alfombra (no ocupa lugar, va abajo de todo)
// wall: va colgado en una pared (cuadros, estantes, ventanas) · shop: false = no se vende (sale de cofres, Pase o trofeos)
export const FURNITURE = [
  // --- básicos ---
  { id: 'cama', name: 'Cama', size: [1, 2], comfort: 12, price: { coins: 300 }, bed: true, desc: 'Para soñar lindo.' },
  { id: 'mesa', name: 'Mesa de madera', size: [2, 1], comfort: 6, price: { coins: 200 } },
  { id: 'silla', name: 'Silla', size: [1, 1], comfort: 3, price: { coins: 80 }, sit: true },
  { id: 'ropero', name: 'Ropero', size: [2, 1], comfort: 6, price: { coins: 400 }, wardrobe: true, desc: 'Tocalo para abrir el Vestidor.' },
  { id: 'lampara', name: 'Lámpara de pie', size: [1, 1], comfort: 5, price: { coins: 150 }, light: true },
  { id: 'planta', name: 'Planta', size: [1, 1], comfort: 5, price: { coins: 120 } },
  { id: 'alfombra', name: 'Alfombra redonda', size: [2, 2], comfort: 6, price: { coins: 180 }, rug: true },
  // --- living ---
  { id: 'sillon', name: 'Sillón', size: [2, 1], comfort: 14, price: { coins: 700 }, sit: true },
  { id: 'puff', name: 'Puf', size: [1, 1], comfort: 6, price: { coins: 250 }, sit: true },
  { id: 'mesita', name: 'Mesita ratona', size: [1, 1], comfort: 4, price: { coins: 220 } },
  { id: 'tele', name: 'Tele', size: [2, 1], comfort: 10, price: { coins: 900 } },
  { id: 'biblioteca', name: 'Biblioteca', size: [2, 1], comfort: 10, price: { coins: 800 } },
  { id: 'alfombra_larga', name: 'Alfombra a rayas', size: [3, 2], comfort: 8, price: { coins: 450 }, rug: true },
  { id: 'chimenea', name: 'Chimenea', size: [2, 1], comfort: 18, price: { coins: 2500 }, rank: 3, light: true },
  // --- cocina ---
  { id: 'cocina', name: 'Cocina', size: [2, 1], comfort: 10, price: { coins: 1200 } },
  { id: 'heladera', name: 'Heladera', size: [1, 1], comfort: 6, price: { coins: 900 } },
  // --- hobbies ---
  { id: 'escritorio', name: 'Escritorio', size: [2, 1], comfort: 8, price: { coins: 600 } },
  { id: 'consola', name: 'Consola retro', size: [1, 1], comfort: 9, price: { gems: 10 } },
  { id: 'acuario', name: 'Acuario', size: [2, 1], comfort: 16, price: { gems: 15 }, rank: 2, light: true },
  { id: 'piano', name: 'Piano', size: [2, 1], comfort: 18, price: { gems: 25 }, rank: 3 },
  { id: 'cama_gato', name: 'Camita de mascota', size: [1, 1], comfort: 8, price: { coins: 500 } },
  // --- pared ---
  { id: 'cuadro', name: 'Cuadro', size: [1, 1], comfort: 4, price: { coins: 150 }, wall: true },
  { id: 'estante', name: 'Estante con libros', size: [2, 1], comfort: 5, price: { coins: 250 }, wall: true },
  { id: 'reloj', name: 'Reloj de pared', size: [1, 1], comfort: 4, price: { coins: 300 }, wall: true },
  { id: 'poster', name: 'Póster de Pixelia', size: [1, 1], comfort: 4, price: { coins: 200 }, wall: true },
  { id: 'guirnalda', name: 'Guirnalda de luces', size: [3, 1], comfort: 7, price: { gems: 8 }, wall: true, light: true },
  // --- especiales (cofres, Pase, rangos) ---
  { id: 'arcoiris', name: 'Lámpara arcoíris', size: [1, 1], comfort: 14, shop: false, light: true, desc: 'Sale en cofres.' },
  { id: 'trono', name: 'Sillón de terciopelo', size: [2, 1], comfort: 20, shop: false, sit: true, desc: 'Sale en cofres.' },
  { id: 'globo', name: 'Globo terráqueo', size: [1, 1], comfort: 10, shop: false, desc: 'Sale en el Pase.' },
  { id: 'telescopio', name: 'Telescopio', size: [1, 1], comfort: 12, shop: false, desc: 'Sale en el Pase.' },
  // --- trofeos (llegan solos al cumplir hitos) ---
  { id: 'trofeo_rango', name: 'Copa de la Municipalidad', size: [1, 1], comfort: 10, shop: false, trophy: true, desc: 'Por llevar tu ciudad al rango Villa.' },
  { id: 'trofeo_obra', name: 'Maqueta del Faro', size: [1, 1], comfort: 10, shop: false, trophy: true, desc: 'Por terminar tu primer monumento.' },
  { id: 'trofeo_joyas', name: 'Trofeo de Joyas', size: [1, 1], comfort: 8, shop: false, trophy: true, desc: 'Por pasar 10 niveles de Joyas Brillantes.' },
  { id: 'trofeo_album', name: 'Medalla del Álbum', size: [1, 1], comfort: 8, shop: false, trophy: true, desc: 'Por completar una página del Álbum.' },
];
export const FURNITURE_BY_ID = Object.fromEntries(FURNITURE.map(f => [f.id, f]));
/** Muebles que pueden salir en cofres (los que no se venden + algunos lindos). */
export const CHEST_FURNITURE = ['arcoiris', 'trono', 'acuario', 'piano', 'chimenea', 'consola', 'guirnalda'];

export const WALLS = [
  { id: 'crema', name: 'Crema', a: '#fbefd9', b: '#f3e2c4' },
  { id: 'menta', name: 'Menta', a: '#cdeedd', b: '#b6e3cb' },
  { id: 'cielo', name: 'Cielo', a: '#cfe6fb', b: '#b8d8f5' },
  { id: 'durazno', name: 'Durazno', a: '#ffe0cc', b: '#f9cdb0' },
  { id: 'lavanda', name: 'Lavanda', a: '#e2dcf7', b: '#d0c7f0' },
  { id: 'rayas', name: 'Papel a rayas', a: '#fff4e0', b: '#f2a99a', stripes: true },
];
export const FLOORS = [
  { id: 'madera', name: 'Madera', a: '#d9a06b', b: '#c98c58' },
  { id: 'nogal', name: 'Nogal', a: '#9c6b4a', b: '#8a5b3d' },
  { id: 'baldosa', name: 'Baldosas', a: '#f2ece2', b: '#e2d8c8', checker: true },
  { id: 'damero', name: 'Damero', a: '#ffffff', b: '#7f9ee8', checker: true },
  { id: 'pasto', name: 'Alfombra verde', a: '#9fdc8a', b: '#8fd17a' },
];

// Ampliaciones: nivel del edificio 'mi_casa'. size = lado del cuarto (tiles). cost incluye materiales de los minijuegos.
// look: lo que se estrena (también se nota por fuera, en la ciudad).
export const HOME_LEVELS = [
  { level: 1, name: 'Monoambiente', size: [6, 6] },
  { level: 2, name: 'Casa con ventanal', size: [8, 8], cost: { coins: 2500, mats: { ladrillo: 8 } }, time: 600, look: 'ventanal y más lugar' },
  { level: 3, name: 'Casa con cocina', size: [10, 9], cost: { coins: 7000, mats: { ladrillo: 14, tuerca: 8 } }, time: 1800, rank: 3, look: 'cocina con mesada, pileta y alacenas' },
  { level: 4, name: 'Casa con dos ambientes', size: [12, 10], cost: { coins: 18000, mats: { ladrillo: 20, tuerca: 12, cristal: 10 } }, time: 3600, rank: 4, look: 'segundo ambiente con arco' },
  { level: 5, name: 'Casa con altillo', size: [14, 12], cost: { coins: 45000, gems: 15, mats: { ladrillo: 28, tuerca: 18, cristal: 16, mapa: 12 } }, time: 7200, rank: 5, look: 'altillo con escalera y claraboya' },
];
export const homeLevelDef = (lv) => HOME_LEVELS[Math.max(1, Math.min(HOME_LEVELS.length, lv | 0 || 1)) - 1];

// ---------- Estado ----------
const S = () => store.state;
// La casa arranca amueblada: cama, ropero, mesa con silla, lámpara, planta, alfombra y un cuadro.
const STARTER = [
  ['cama', 0, 0, 0], ['ropero', 1, 0, 0], ['mesa', 3, 0, 0], ['silla', 3, 1, 2], ['lampara', 5, 0, 0],
  ['planta', 5, 5, 0], ['alfombra', 2, 3, 0], ['cuadro', 3, 0, 0],
];
export function homeState(state = S()) {
  if (!state.home || typeof state.home !== 'object') state.home = {};
  const h = state.home;
  if (!Array.isArray(h.items)) h.items = [];
  if (!h.owned || typeof h.owned !== 'object') h.owned = {};
  if (!h.trophies || typeof h.trophies !== 'object') h.trophies = {};
  h.wall ||= 'crema';
  h.floor ||= 'madera';
  h.nextUid ||= 1;
  if (!h.started) {
    h.started = true;
    for (const [id, x, z, rot] of STARTER) h.items.push({ uid: h.nextUid++, id, x, z, rot });
  }
  return h;
}
/** Nivel de la casa (= nivel del edificio mi_casa; 1 si todavía no hay). */
export function homeLevel(state = S()) { return state.city?.buildings?.find(b => b.id === 'mi_casa')?.level || 1; }
export function roomSize(state = S()) { return homeLevelDef(homeLevel(state)).size; }

// ---------- Geometría ----------
/**
 * Lo que ocupa la arquitectura en cada nivel (no se puede poner nada ahí):
 * floor: Set 'x,z' de tiles del piso · n: Set de x en la pared del fondo · w: Set de z en la pared izquierda.
 *   puerta en la pared izquierda (adelante) · 2+: ventanal en el medio del fondo · 3+: cocina (mesada y alacenas) en el
 *   fondo a la derecha · 4+: tabique que separa dos ambientes
 *   5: altillo (atrás a la izquierda, sobre columnas) con su escalera pegada a la pared izquierda.
 */
export function roomLayout(level, W, D) {
  const floor = new Set(), n = new Set(), w = new Set();
  const door = D - 2;
  w.add(door);
  const win = level >= 2 ? [Math.floor(W / 2) - 1, Math.floor(W / 2)] : [W - 2];   // ventanita (1) o ventanal (2+)
  for (const x of win) n.add(x);
  const kitchen = level >= 3 ? [W - 3, W - 2, W - 1] : null;   // 3+: mesada con pileta y alacenas en el fondo, a la derecha
  if (kitchen) for (const x of kitchen) { floor.add(x + ',0'); n.add(x); }
  const part = level >= 4 ? W - 5 : -1;
  if (part >= 0) { for (let z = 0; z < 3; z++) floor.add(part + ',' + z); n.add(part); }
  const loft = level >= 5 ? { x1: 3, z1: 2, stairs: [3, 4, 5, 6] } : null;
  if (loft) {
    for (let x = 0; x <= loft.x1; x++) { n.add(x); for (let z = 0; z <= loft.z1; z++) floor.add(x + ',' + z); }
    for (let z = 0; z <= 6; z++) w.add(z);
    for (const z of loft.stairs) floor.add('0,' + z);
  }
  return { floor, n, w, door, win, kitchen, part, loft };
}
export function footprint(id, rot = 0) {
  const [w, d] = FURNITURE_BY_ID[id]?.size || [1, 1];
  return rot % 2 ? [d, w] : [w, d];
}
/** Celdas de pared que ocupa un mueble colgado: pared 'n' (fondo, a lo largo de x) o 'w' (izquierda, a lo largo de z). */
const wallSide = (it) => (it.rot % 2 ? 'w' : 'n');
/**
 * ¿Se puede poner `id` en (x,z,rot)? ignoreUid para mover. Devuelve {ok, reason}.
 * Muebles de piso: dentro del cuarto y sin pisar otros muebles de piso (las alfombras solo chocan con alfombras).
 * Muebles de pared: rot par = pared del fondo (z = 0, se mueve en x); rot impar = pared izquierda (x = 0, se mueve en z).
 */
export function canPlaceItem(id, x, z, rot = 0, ignoreUid = null, state = S()) {
  const f = FURNITURE_BY_ID[id];
  if (!f) return { ok: false, reason: '???' };
  const [W, D] = roomSize(state);
  const lay = roomLayout(homeLevel(state), W, D);
  const items = homeState(state).items.filter(o => o.uid !== ignoreUid);
  if (f.wall) {
    const side = rot % 2 ? 'w' : 'n';
    const len = f.size[0];
    const a = side === 'n' ? x : z;
    if (a < 0 || a + len > (side === 'n' ? W : D)) return { ok: false, reason: 'No entra en la pared' };
    for (let i = a; i < a + len; i++) if (lay[side].has(i)) return { ok: false, reason: 'Ahí hay una puerta o una ventana' };
    for (const o of items) {
      const of = FURNITURE_BY_ID[o.id];
      if (!of?.wall || wallSide(o) !== side) continue;
      const oa = side === 'n' ? o.x : o.z;
      if (a < oa + of.size[0] && a + len > oa) return { ok: false, reason: 'Ya hay algo colgado ahí' };
    }
    return { ok: true };
  }
  const [w, d] = footprint(id, rot);
  if (x < 0 || z < 0 || x + w > W || z + d > D) return { ok: false, reason: 'Fuera del cuarto' };
  for (let i = x; i < x + w; i++) for (let k = z; k < z + d; k++) if (lay.floor.has(i + ',' + k)) return { ok: false, reason: 'Ahí no entra' };
  for (const o of items) {
    const of = FURNITURE_BY_ID[o.id];
    if (!of || of.wall || !!of.rug !== !!f.rug) continue;
    const [ow, od] = footprint(o.id, o.rot);
    if (x < o.x + ow && x + w > o.x && z < o.z + od && z + d > o.z) return { ok: false, reason: 'Ya hay un mueble ahí' };
  }
  return { ok: true };
}
/** Lugar libre para un mueble, el más cercano a `near` ([x, z] en baldosas; si no, el centro del cuarto). */
export function freeSpot(id, rot = 0, state = S(), near = null) {
  const [W, D] = roomSize(state);
  const f = FURNITURE_BY_ID[id];
  if (f?.wall) {
    let best = null, bd = Infinity;
    for (const r of [0, 1]) for (let a = 0; a < (r ? D : W); a++) {
      const [x, z] = r ? [0, a] : [a, 0];
      if (!canPlaceItem(id, x, z, r, null, state).ok) continue;
      // misma pared primero, después la más cerca
      const dd = near ? Math.hypot(x - near[0], z - near[1]) + (r === rot % 2 ? 0 : 0.5) : a + r * 100;
      if (dd < bd) { bd = dd; best = [x, z, r]; }
    }
    return best;
  }
  let best = null, bd = Infinity;
  const [w, d] = footprint(id, rot);
  const [cx, cz] = near ? [near[0] + w / 2, near[1] + d / 2] : [W / 2, D / 2];
  for (let x = 0; x + w <= W; x++) for (let z = 0; z + d <= D; z++) {
    if (!canPlaceItem(id, x, z, rot, null, state).ok) continue;
    const dd = Math.hypot(x + w / 2 - cx, z + d / 2 - cz);
    if (dd < bd) { bd = dd; best = [x, z, rot]; }
  }
  return best;
}

// ---------- Inventario ----------
export const ownedCount = (id, state = S()) => homeState(state).owned[id] || 0;
export const placedCount = (id, state = S()) => homeState(state).items.filter(o => o.id === id).length;
/** Suma muebles al inventario (sin poner). source: 'shop' | 'chest' | 'season' | 'trophy' | 'rank' … */
export function giveFurniture(id, n = 1, source = '') {
  if (!FURNITURE_BY_ID[id] || n <= 0) return false;
  const h = homeState();
  h.owned[id] = (h.owned[id] || 0) + n;
  store.markDirty();
  bus.emit('home:changed', { gained: id, n, source });
  return true;
}
/** Compra un mueble de la tienda (va al inventario). */
export function canBuyFurniture(id, state = S()) {
  const f = FURNITURE_BY_ID[id];
  if (!f || f.shop === false) return { ok: false, reason: 'No se vende' };
  const rank = state.city?.buildings?.find(b => b.id === 'castillo')?.level || 1;
  if (f.rank && rank < f.rank) return { ok: false, reason: `Rango ${f.rank}`, locked: true };
  if (!store.canAfford(f.price)) return { ok: false, reason: 'No te alcanza', poor: true };
  return { ok: true };
}
export function buyFurniture(id) {
  const can = canBuyFurniture(id);
  if (!can.ok) return can;
  if (!store.spend(FURNITURE_BY_ID[id].price, 'furniture:' + id)) return { ok: false, reason: 'No te alcanza', poor: true };
  store.inc('furnitureBought');
  giveFurniture(id, 1, 'shop');
  return { ok: true };
}
/** Pone un mueble del inventario en el cuarto. Devuelve el ítem o {error}. */
export function placeItem(id, x, z, rot = 0) {
  const h = homeState();
  if (!h.owned[id]) return { error: 'No tenés ese mueble' };
  const pos = canPlaceItem(id, x, z, rot);
  if (!pos.ok) return { error: pos.reason };
  h.owned[id]--;
  const it = { uid: h.nextUid++, id, x, z, rot };
  h.items.push(it);
  store.markDirty();
  bus.emit('home:changed', { placed: it });
  return it;
}
export function moveItem(uid, x, z, rot) {
  const it = homeState().items.find(o => o.uid === uid);
  if (!it) return { error: 'No existe' };
  const pos = canPlaceItem(it.id, x, z, rot, uid);
  if (!pos.ok) return { error: pos.reason };
  Object.assign(it, { x, z, rot });
  store.markDirty();
  bus.emit('home:changed', { moved: it });
  return it;
}
/** Guarda un mueble puesto (vuelve al inventario). */
export function storeItem(uid) {
  const h = homeState();
  const i = h.items.findIndex(o => o.uid === uid);
  if (i < 0) return false;
  const [it] = h.items.splice(i, 1);
  h.owned[it.id] = (h.owned[it.id] || 0) + 1;
  store.markDirty();
  bus.emit('home:changed', { stored: it });
  return true;
}
export function setWall(id) { if (!WALLS.some(w => w.id === id)) return; homeState().wall = id; store.markDirty(); bus.emit('home:changed', { wall: id }); }
export function setFloor(id) { if (!FLOORS.some(w => w.id === id)) return; homeState().floor = id; store.markDirty(); bus.emit('home:changed', { floor: id }); }
/** Al achicarse nada (las ampliaciones solo agrandan), pero por las dudas: lo que quedó afuera vuelve al inventario. */
export function fitItems(state = S()) {
  const h = homeState(state);
  for (const it of h.items.slice()) {
    if (canPlaceItem(it.id, it.x, it.z, it.rot, it.uid, state).ok) continue;
    // primero se intenta reubicarlo; si no hay lugar, vuelve al inventario
    const i = h.items.indexOf(it);
    h.items.splice(i, 1);
    const spot = freeSpot(it.id, it.rot, state, [it.x, it.z]);   // lo más cerca de donde estaba
    if (spot) { Object.assign(it, { x: spot[0], z: spot[1], rot: spot[2] }); h.items.push(it); }
    else h.owned[it.id] = (h.owned[it.id] || 0) + 1;
  }
  store.markDirty();
  bus.emit('home:changed', { fit: true });
}

// ---------- Confort ----------
// Misma idea que el Encanto: cada mueble suma su confort, repetir el mismo rinde 85% del anterior y la variedad
// multiplica (+3% por tipo distinto, tope ×1,6). Da +1% de XP en todo cada 40 de Confort (tope +10%), suma
// Encanto a la ciudad (Confort / 4) y mejora el premio diario (+1% de monedas cada 20, tope +25%).
export function comfortInfo(state = S()) {
  // sin la casa en la ciudad (antes del nivel 2) todavía no cuenta
  if (!state.city?.buildings?.some(b => b.id === 'mi_casa')) return { value: 0, kinds: 0, variety: 1, xpBonus: 0, loginBonus: 0, charm: 0 };
  const per = new Map();
  for (const it of homeState(state).items) {
    const f = FURNITURE_BY_ID[it.id];
    if (!f) continue;
    if (!per.has(f.id)) per.set(f.id, []);
    per.get(f.id).push(f.comfort || 0);
  }
  let base = 0;
  for (const list of per.values()) list.forEach((v, i) => { base += v * Math.pow(0.85, i); });
  const kinds = per.size;
  const variety = Math.min(1.6, 1 + 0.03 * kinds);
  const value = Math.round(base * variety * (1 + 0.05 * (homeLevel(state) - 1)));
  return { value, kinds, variety, xpBonus: Math.min(0.10, Math.floor(value / 40) / 100), loginBonus: Math.min(0.25, Math.floor(value / 20) / 100), charm: Math.round(value / 4) };
}
export const comfort = (state = S()) => comfortInfo(state).value;

// ---------- Trofeos y premios ----------
// Trofeos: llegan solos al inventario la primera vez que se cumple el hito (y una sola vez: home.trophies).
const TROPHIES = [
  { id: 'trofeo_rango', test: (s) => (s.stats?.rankBest || 0) >= 4 },
  { id: 'trofeo_obra', test: (s) => MONUMENT_DONE(s) },
  { id: 'trofeo_joyas', test: (s) => (s.stats?.match3Wins || 0) >= 10 },
  { id: 'trofeo_album', test: (s) => (s.stats?.stickersNew || 0) >= 30 },
];
let MONUMENT_DONE = () => false;
/** Revisa los trofeos (idempotente). Devuelve los ids nuevos. */
export function syncTrophies(state = S()) {
  const h = homeState(state);
  const got = [];
  for (const t of TROPHIES) {
    if (h.trophies[t.id]) continue;
    let ok = false;
    try { ok = t.test(state); } catch {}
    if (!ok) continue;
    h.trophies[t.id] = Date.now();
    giveFurniture(t.id, 1, 'trophy');
    got.push(t.id);
  }
  if (got.length) bus.emit('home:trophy', { ids: got });
  return got;
}
let inited = false;
/**
 * Llamar una vez al arrancar (main.js initProgression). Los premios {furniture: id} de store.grant llegan por
 * 'reward:furniture'; los trofeos se revisan al cambiar las estadísticas o el rango.
 * monumentDone: función (state) => bool, para no importar economy.js desde acá.
 */
export function initHome({ monumentDone } = {}) {
  if (monumentDone) MONUMENT_DONE = monumentDone;
  if (inited) return;
  inited = true;
  homeState();
  bus.on('reward:furniture', ({ id, n = 1, source = '' } = {}) => giveFurniture(id, n, source));
  let pend = 0;
  const later = () => { if (!pend) pend = setTimeout(() => { pend = 0; syncTrophies(); }, 400); };
  for (const ev of ['stats:changed', 'town:rankup', 'building:upgraded']) bus.on(ev, later);
  // al ampliar la casa, lo que quedó tapado por la arquitectura nueva se reacomoda
  bus.on('building:upgraded', ({ b } = {}) => { if (b?.id === 'mi_casa') fitItems(); });
  syncTrophies();
}
