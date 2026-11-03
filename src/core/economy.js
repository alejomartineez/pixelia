// Reglas de la ciudad: construir, producir, mejorar, expandir.
// La escena de la ciudad y el HUD usan SOLO estas funciones para que los números siempre coincidan.
import { bus } from './bus.js';
import { store } from './state.js';
import {
  BUILDING_BY_ID, MAP_SIZE, START_LAND, LAND_STEP, MAX_EXPANSIONS, MAX_BUILDING_LEVEL,
  CASTLE_LEVELS, CASTLE_BONUS_PER_LEVEL, MAX_BUILDERS, BUILDER_GEM_COST,
} from './data.js';
import { prodBoostMult, happyBoostActive, freeBuildCount, consumeFreeBuild } from '../chests/chests.js';
import { eventMult } from '../season/events.js';

const S = () => store.state;
export const def = (b) => BUILDING_BY_ID[typeof b === 'string' ? b : b.id];
const XP_COLLECT_MAX = 6;   // xp por cobro: raíz de los ciclos, tope 6 (igual que antes con almacenes de 6 tandas)

// ---------- Geometría ----------
/** Tamaño [w, d] según rotación (rot impar intercambia). */
export function footprint(id, rot = 0) {
  const [w, d] = def(id).size;
  return rot % 2 ? [d, w] : [w, d];
}
/** Terreno desbloqueado: tiles con min <= x < max (igual en z). */
export function landBounds(state = S()) {
  const side = Math.min(MAP_SIZE, START_LAND + LAND_STEP * state.city.expansions);
  const min = Math.floor((MAP_SIZE - side) / 2);
  return { min, max: min + side, side };
}
export function buildingAt(x, z, state = S()) {
  return state.city.buildings.find(b => {
    const [w, d] = footprint(b.id, b.rot);
    return x >= b.x && x < b.x + w && z >= b.z && z < b.z + d;
  }) || null;
}
/** ¿Se puede ubicar `id` con esquina (x,z)? ignoreUid permite mover un edificio existente. */
export function canPlace(id, x, z, rot = 0, ignoreUid = null, state = S()) {
  const [w, d] = footprint(id, rot);
  const { min, max } = landBounds(state);
  if (x < min || z < min || x + w > max || z + d > max) return { ok: false, reason: 'Fuera del terreno' };
  for (const b of state.city.buildings) {
    if (b.uid === ignoreUid) continue;
    const [bw, bd] = footprint(b.id, b.rot);
    if (x < b.x + bw && x + w > b.x && z < b.z + bd && z + d > b.z) return { ok: false, reason: 'Hay algo ahí' };
  }
  return { ok: true };
}

// ---------- Estado de edificios ----------
export const isConstructing = (b, now = Date.now()) => b.buildEnd > now;
export const isUpgrading = (b, now = Date.now()) => b.upgradeEnd > now;
export const isBusy = (b, now = Date.now()) => isConstructing(b, now) || isUpgrading(b, now);
export const countOf = (id, state = S()) => state.city.buildings.filter(b => b.id === id).length;
export const hasBuilt = (id, state = S(), now = Date.now()) => state.city.buildings.some(b => b.id === id && !isConstructing(b, now));
export const castleLevel = (state = S()) => state.city.buildings.find(b => b.id === 'castillo')?.level || 1;
export const buildersBusy = (state = S(), now = Date.now()) => state.city.buildings.filter(b => isBusy(b, now)).length;
export const buildersFree = (state = S(), now = Date.now()) => Math.max(0, state.builders - buildersBusy(state, now));

export function buildingPop(b) {
  const d = def(b);
  return d.pop ? Math.round(d.pop * (1 + 0.4 * (b.level - 1))) : 0;
}
export function buildingHappy(b) {
  const d = def(b);
  return d.happy ? Math.round(d.happy * (1 + 0.25 * (b.level - 1))) : 0;
}
/** Población: solo cuenta casas terminadas. */
export function population(state = S(), now = Date.now()) {
  return state.city.buildings.reduce((s, b) => s + (isConstructing(b, now) ? 0 : buildingPop(b)), 0);
}
export function happinessPoints(state = S(), now = Date.now()) {
  return state.city.buildings.reduce((s, b) => s + (isConstructing(b, now) ? 0 : buildingHappy(b)), 0);
}
/** Felicidad 0..100 (%) y bonus de producción 0..0.5. Con el Perfume de Alegría activo: al máximo (boosted: true). */
export function happiness(state = S(), now = Date.now()) {
  const pts = happinessPoints(state, now);
  if (happyBoostActive(now)) return { points: pts, pct: 100, bonus: 0.5, boosted: true };
  const ratio = pts / Math.max(10, population(state, now));
  return { points: pts, pct: Math.min(100, Math.round(ratio * 80)), bonus: Math.min(0.5, ratio * 0.4) };
}
/** Multiplicador temporal: poción de producción × evento "Doble Producción". */
export function boostMultiplier(now = Date.now()) {
  return prodBoostMult(now) * eventMult('production');
}
/** Bonus de toda la ciudad: felicidad × castillo × pociones × eventos (la maestría es aparte, por edificio). */
export function globalMultiplier(state = S(), now = Date.now()) {
  return (1 + happiness(state, now).bonus) * (1 + CASTLE_BONUS_PER_LEVEL * (castleLevel(state) - 1)) * boostMultiplier(now);
}

// ---------- Maestría por tipo de edificio ----------
// Monedas producidas (cobradas) por tipo → 1..5 estrellas, +3% de producción por estrella.
// Umbrales: 500, 2k, 8k, 25k, 80k × (costo del edificio / 100).
export const MASTERY_STEPS = [500, 2000, 8000, 25000, 80000];
export const MASTERY_BONUS = 0.03;
const masteryScale = (id) => Math.max(1, (def(id)?.cost?.coins || 100) / 100);
/** {stars 0..5, total, next (total para la próxima estrella o null), progress 0..1, bonus 0..0.15, steps} */
export function masteryInfo(id, state = S()) {
  const total = state.stats?.['prod_' + id] || 0;
  const steps = MASTERY_STEPS.map(v => Math.round(v * masteryScale(id)));
  let stars = 0;
  while (stars < steps.length && total >= steps[stars]) stars++;
  const prev = stars ? steps[stars - 1] : 0;
  const next = stars < steps.length ? steps[stars] : null;
  const progress = next ? Math.min(1, (total - prev) / (next - prev)) : 1;
  return { stars, total, next, progress, bonus: stars * MASTERY_BONUS, steps };
}
export const masteryMult = (id, state = S()) => 1 + masteryInfo(id, state).bonus;

// ---------- Almacenamiento ("siesta") ----------
// Cada productor de monedas guarda varias horas para que volver después de un rato dé una cosecha linda.
// Las primeras `prod.cap` tandas salen a ritmo normal (como cuando estás jugando); después la ciudad
// "duerme la siesta": sigue juntando hasta llenar el almacén, pero a SIESTA_RATE del ritmo.
// Balance (node tools/sim-economy.mjs, 7 días): almacén de 6 tandas (antes) vs siesta 3-4 h al 8% (ahora).
//   casual (4 sesiones de 10 min por día): producción 0,79M → 1,45M (x1,8), nivel 14 → 14 al día 7.
//   frecuente (8 sesiones de 5 min):        producción 2,88M → 4,45M (x1,5).
// Volver después de 3 h a una panadería da ~400 monedas base (antes 120). Las mejoras duplican su costo en cada
// nivel (UPGRADE_COST_MULT) para que haya en qué gastar a mediano plazo.
export const STORAGE_HOURS = { negocio: 3, casa: 4, especial: 3 };
export const SIESTA_RATE = 0.08;
/** Ciclos que guarda un edificio antes de llenarse. */
export function storageCap(id) {
  const d = def(id);
  if (!d?.prod) return 0;
  if (d.prod.gems) return d.prod.cap;   // las gemas no se estiran: siguen siendo escasas
  const hours = STORAGE_HOURS[d.cat] || 3;
  return Math.max(d.prod.cap, Math.ceil(hours * 3600 / d.prod.cycle));
}

// ---------- Construir ----------
/** Construcciones gratis ganadas en cofres para este edificio. */
export const freeBuilds = (id) => freeBuildCount(id);
/**
 * Costo de construir otra unidad: casas y negocios se encarecen un 15% por cada copia.
 * Con una construcción gratis (cofre) devuelve {coins:0, gems:0, free:true}.
 */
export function placeCost(id, state = S()) {
  if (freeBuildCount(id) > 0) return { coins: 0, gems: 0, free: true };
  const d = def(id);
  const n = countOf(id, state);
  const mult = (d.cat === 'casa' || d.cat === 'negocio') ? 1 + 0.15 * n : 1;
  return { coins: Math.round((d.cost.coins || 0) * mult), gems: d.cost.gems || 0 };
}
/**
 * ¿Puede construir? (sin mirar ubicación). reason es texto para mostrar.
 * Con una construcción gratis se ignoran nivel y población (se respetan el máximo y las constructoras) → {ok, free:true}.
 */
export function canBuild(id, state = S(), now = Date.now()) {
  const d = def(id);
  if (!d) return { ok: false, reason: '???' };
  const free = freeBuildCount(id) > 0;
  if (!free && d.unlock > state.player.level) return { ok: false, reason: `Nivel ${d.unlock}`, locked: true };
  if (d.max && countOf(id, state) >= d.max) return { ok: false, reason: 'Ya lo tenés' };
  if (!free && d.popReq && population(state, now) < d.popReq) return { ok: false, reason: `Necesita ${d.popReq} vecinos`, locked: true };
  if (d.time > 0 && buildersFree(state, now) <= 0) return { ok: false, reason: 'Constructoras ocupadas' };
  if (!free && !store.canAfford(placeCost(id, state))) return { ok: false, reason: 'No te alcanza', poor: true };
  return free ? { ok: true, free: true } : { ok: true };
}
/** Construye (consume la construcción gratis si hay). Devuelve el edificio creado o {error}. */
export function placeBuilding(id, x, z, rot = 0, state = S()) {
  const now = Date.now();
  const can = canBuild(id, state, now);
  if (!can.ok) return { error: can.reason };
  const pos = canPlace(id, x, z, rot, null, state);
  if (!pos.ok) return { error: pos.reason };
  if (can.free) { if (!consumeFreeBuild(id)) return { error: 'No te queda esa construcción gratis' }; }
  else if (!store.spend(placeCost(id, state), 'build:' + id)) return { error: 'No te alcanza' };
  const d = def(id);
  const b = { uid: state.city.nextUid++, id, x, z, rot, level: 1, buildEnd: d.time > 0 ? now + d.time * 1000 : 0, upgradeEnd: 0, lastCollect: now };
  state.city.buildings.push(b);
  store.markDirty();
  bus.emit('building:placed', { b, free: !!can.free });
  if (!b.buildEnd) finishConstruction(b);
  return b;
}
function finishConstruction(b) {
  // si la obra terminó mientras la app estaba cerrada, la producción arranca desde que terminó (progreso offline)
  const end = b.buildEnd || Date.now();
  b.buildEnd = 0;
  b.lastCollect = Math.min(Date.now(), end);
  store.inc('built');
  store.addXp(def(b).xp || 0);
  bus.emit('building:built', { b });
}
export function moveBuilding(uid, x, z, rot, state = S()) {
  const b = state.city.buildings.find(o => o.uid === uid);
  if (!b) return { error: 'No existe' };
  const pos = canPlace(b.id, x, z, rot, uid, state);
  if (!pos.ok) return { error: pos.reason };
  b.x = x; b.z = z; b.rot = rot;
  store.markDirty();
  bus.emit('building:moved', { b });
  return b;
}
/** Solo deco y caminos se pueden guardar/quitar (devuelve 50% de monedas). */
export function canRemove(b) { const c = def(b).cat; return c === 'deco' || c === 'camino'; }
export function removeBuilding(uid, state = S()) {
  const i = state.city.buildings.findIndex(o => o.uid === uid);
  if (i < 0) return false;
  const b = state.city.buildings[i];
  if (!canRemove(b)) return false;
  state.city.buildings.splice(i, 1);
  const refund = Math.floor((def(b).cost.coins || 0) * 0.5);
  if (refund) store.grant({ coins: refund }, 'refund');
  store.markDirty();
  bus.emit('building:removed', { b });
  return true;
}

// ---------- Producción ----------
/** Estado de producción de un edificio. amount = lo que se cobraría ahora. */
export function producerStatus(b, now = Date.now(), state = S()) {
  const d = def(b);
  if (!d.prod) return { producer: false };
  const currency = d.prod.gems ? 'gems' : 'coins';
  const cap = storageCap(d.id);
  if (isBusy(b, now)) return { producer: true, currency, paused: true, ready: false, amount: 0, progress: 0, full: false, cap };
  const cycleMs = d.prod.cycle * 1000;
  const elapsed = Math.max(0, now - b.lastCollect);
  const cycles = Math.min(cap, Math.floor(elapsed / cycleMs));
  const full = cycles >= cap;
  const awake = currency === 'gems' ? cap : Math.min(cap, d.prod.cap);   // tandas a ritmo normal
  const siesta = Math.max(0, cycles - awake);
  const effective = cycles - siesta + siesta * SIESTA_RATE;
  const progress = full ? 1 : (elapsed % cycleMs) / cycleMs;
  let per;
  if (currency === 'gems') per = d.prod.gems;
  else {
    // el castillo no se da bonus a sí mismo (felicidad/castillo) pero sí recibe pociones y eventos
    const city = d.id === 'castillo' ? boostMultiplier(now) : globalMultiplier(state, now);
    per = d.prod.coins * (1 + 0.5 * (b.level - 1)) * city * masteryMult(d.id, state);
  }
  return {
    producer: true, currency, ready: cycles > 0, amount: Math.round(per * effective), cycles, cap, progress, full,
    perCycle: Math.round(per), cycleSec: d.prod.cycle,
    awakeCap: awake, siesta: siesta > 0, siestaRate: SIESTA_RATE,       // "durmiendo la siesta": junta más lento
    fullInSec: full ? 0 : Math.max(0, (cap * cycleMs - elapsed) / 1000),   // cuánto falta para llenarse
  };
}
/** Cobra un edificio. Devuelve {amount, currency} o null. */
export function collect(uid, state = S()) {
  const now = Date.now();
  const b = state.city.buildings.find(o => o.uid === uid);
  if (!b) return null;
  const st = producerStatus(b, now, state);
  if (!st.producer || !st.ready || st.amount <= 0) return null;
  const d = def(b);
  const before = st.currency === 'coins' ? masteryInfo(d.id, state).stars : 0;
  // conserva el progreso parcial del ciclo actual (si no estaba lleno)
  b.lastCollect = st.full ? now : b.lastCollect + st.cycles * d.prod.cycle * 1000;
  // xp: crece más lento que los ciclos (con almacenes de varias horas no debe dispararse)
  store.grant({ [st.currency]: st.amount, xp: Math.min(XP_COLLECT_MAX, Math.max(1, Math.round(Math.sqrt(st.cycles)))) }, 'collect');
  if (st.currency === 'coins') {
    store.inc('collected', st.amount);
    store.inc('prod_' + d.id, st.amount);
    const after = masteryInfo(d.id, state).stars;
    if (after > before) bus.emit('building:mastery', { id: d.id, stars: after, b });
  }
  bus.emit('production:collected', { b, amount: st.amount, currency: st.currency });
  return { amount: st.amount, currency: st.currency };
}
/** Cobra todo lo cobrable (botón "cobrar todo"). */
export function collectAll(state = S()) {
  const total = { coins: 0, gems: 0 };
  for (const b of state.city.buildings) {
    const r = collect(b.uid, state);
    if (r) total[r.currency] += r.amount;
  }
  return total;
}

// ---------- Mejoras ----------
export function canUpgradeType(b) {
  const d = def(b);
  return d.id === 'castillo' || ((d.cat === 'casa' || d.cat === 'negocio') && !!d.prod);
}
export function maxLevel(b) { return def(b).id === 'castillo' ? CASTLE_LEVELS.length + 1 : MAX_BUILDING_LEVEL; }
// costo de mejora = costo base × factor (nivel actual → siguiente). Se duplica en cada nivel: las mejoras son el
// gran sumidero de monedas a mediano plazo (cada nivel da +50% de producción).
const UPGRADE_COST_MULT = [0, 1.7, 3.4, 6.8, 13.6];
/** {cost, time(seg), reqLevel} de la próxima mejora o null si está al máximo. */
export function upgradeInfo(b) {
  if (!canUpgradeType(b) || b.level >= maxLevel(b)) return null;
  const d = def(b);
  if (d.id === 'castillo') {
    const c = CASTLE_LEVELS.find(l => l.level === b.level + 1);
    return { cost: c.cost, time: c.time, reqLevel: c.reqLevel };
  }
  const base = d.cost.coins || 200;
  return {
    cost: { coins: Math.round(base * UPGRADE_COST_MULT[b.level]), gems: b.level >= 3 ? b.level - 2 : 0 },
    time: Math.max(15, Math.round((d.time || 10) * (b.level + 1))),
    reqLevel: d.unlock + b.level * 2,
  };
}
export function canUpgrade(b, state = S(), now = Date.now()) {
  const info = upgradeInfo(b);
  if (!info) return { ok: false, reason: 'Nivel máximo' };
  if (isBusy(b, now)) return { ok: false, reason: 'Está en obra' };
  if (state.player.level < info.reqLevel) return { ok: false, reason: `Nivel ${info.reqLevel}`, locked: true };
  if (buildersFree(state, now) <= 0) return { ok: false, reason: 'Constructoras ocupadas' };
  if (!store.canAfford(info.cost)) return { ok: false, reason: 'No te alcanza', poor: true };
  return { ok: true };
}
export function startUpgrade(uid, state = S()) {
  const b = state.city.buildings.find(o => o.uid === uid);
  if (!b) return { error: 'No existe' };
  const can = canUpgrade(b, state);
  if (!can.ok) return { error: can.reason };
  const info = upgradeInfo(b);
  // cobrar lo pendiente antes de pausar la producción
  collect(uid, state);
  if (!store.spend(info.cost, 'upgrade:' + b.id)) return { error: 'No te alcanza' };
  b.upgradeEnd = Date.now() + info.time * 1000;
  store.markDirty();
  bus.emit('building:upgradeStarted', { b });
  return b;
}
function finishUpgrade(b) {
  const end = b.upgradeEnd || Date.now();
  b.upgradeEnd = 0;
  b.level++;
  b.lastCollect = Math.min(Date.now(), end);
  store.inc('upgrades');
  store.addXp(Math.round((def(b).xp || 20) * 0.8 * b.level));
  bus.emit('building:upgraded', { b, level: b.level });
}

// ---------- Saltar tiempos ----------
export function remainingMs(b, now = Date.now()) {
  return Math.max(0, (isConstructing(b, now) ? b.buildEnd : b.upgradeEnd) - now);
}
/** Gemas para terminar ya. Gratis si faltan 5 segundos o menos. */
export function skipCost(b, now = Date.now()) {
  const ms = remainingMs(b, now);
  if (ms <= 5000) return 0;
  return Math.max(1, Math.ceil(ms / 60000));
}
export function skip(uid, state = S()) {
  const b = state.city.buildings.find(o => o.uid === uid);
  if (!b || !isBusy(b)) return false;
  const cost = skipCost(b);
  if (!store.spend({ gems: cost }, 'skip')) return false;
  if (isConstructing(b)) b.buildEnd = Date.now() - 1; else b.upgradeEnd = Date.now() - 1;
  tick(state);
  return true;
}

// ---------- Tick (llamado ~1/seg desde main.js) ----------
export function tick(state = S()) {
  const now = Date.now();
  for (const b of state.city.buildings) {
    if (b.buildEnd && b.buildEnd <= now) { finishConstruction(b); store.markDirty(); }
    if (b.upgradeEnd && b.upgradeEnd <= now) { finishUpgrade(b); store.markDirty(); }
  }
}

// ---------- Expansiones / constructoras ----------
export function expansionInfo(state = S()) {
  const n = state.city.expansions;
  if (n >= MAX_EXPANSIONS) return null;
  return { cost: { coins: Math.round(500 * Math.pow(2.1, n)), gems: n >= 3 ? (n - 2) * 5 : 0 }, reqLevel: 2 + n * 2 };
}
export function expand(state = S()) {
  const info = expansionInfo(state);
  if (!info) return { error: 'Terreno al máximo' };
  if (state.player.level < info.reqLevel) return { error: `Nivel ${info.reqLevel}` };
  if (!store.spend(info.cost, 'expand')) return { error: 'No te alcanza' };
  state.city.expansions++;
  store.inc('expansions');
  store.addXp(30 * state.city.expansions);
  store.markDirty();
  bus.emit('city:expanded', { expansions: state.city.expansions, bounds: landBounds(state) });
  return { ok: true };
}
export function builderInfo(state = S()) {
  if (state.builders >= MAX_BUILDERS) return null;
  return { cost: { gems: BUILDER_GEM_COST[state.builders + 1] } };
}
export function buyBuilder(state = S()) {
  const info = builderInfo(state);
  if (!info || !store.spend(info.cost, 'builder')) return false;
  state.builders++;
  store.markDirty();
  bus.emit('builders:changed', { builders: state.builders });
  return true;
}

/** Formato corto de tiempo: 1h 05m / 3m 20s / 45s */
export function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}
/** 12345 -> "12.345" · 123456 -> "123k" · 1234567 -> "1,2M" (abrevia desde 100.000) */
export function fmtNum(n) {
  n = Math.round(Number(n) || 0);
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.0', '').replace('.', ',') + 'M';
  if (a >= 1e5) return Math.trunc(n / 1e3) + 'k';
  return n.toLocaleString('es-AR');
}
