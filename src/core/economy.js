// Reglas de la ciudad: construir, producir, mejorar, expandir.
// La escena de la ciudad y el HUD usan SOLO estas funciones para que los números siempre coincidan.
import { bus } from './bus.js';
import { store } from './state.js';
import {
  BUILDING_BY_ID, MAP_SIZE, START_LAND, LAND_STEP, MAX_EXPANSIONS, MAX_BUILDING_LEVEL,
  CASTLE_BONUS_PER_LEVEL, MAX_BUILDERS, BUILDER_GEM_COST, TOWN_RANKS, MONUMENTS, MONUMENT_IDS, MATERIAL_BY_ID,
  eraOfRank, eraDef,
} from './data.js';
import { monumentComplete, monumentsDone, monumentBonus } from './monuments.js';
import { HOME_LEVELS, comfortInfo } from '../home/furniture.js';
export { monumentComplete, monumentsDone, monumentBonus };
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

// ---------- Rango de la ciudad y Encanto ----------
// El rango es el nivel de la Municipalidad (id 'castillo'). Subirlo pide cumplir el expediente de TOWN_RANKS.
export const townRank = (state = S()) => Math.min(TOWN_RANKS.length, castleLevel(state));
export const rankDef = (r) => TOWN_RANKS[Math.max(1, Math.min(TOWN_RANKS.length, r | 0 || 1)) - 1];
export const rankName = (r) => rankDef(r).name;
/** Encanto base de un tipo de edificio (antes de nivel y repetición). */
export function charmBase(d) {
  if (!d) return 0;
  if (d.charm != null) return d.charm;
  switch (d.cat) {
    case 'deco': return 4 + (d.happy || 0) * 2;
    case 'negocio': return 6 + (d.happy || 0) * 2;
    case 'casa': return 3;
    case 'especial': return 15 + (d.happy || 0);
    case 'camino': return d.id === 'camino' ? 0.3 : 0.6;
    default: return 0;
  }
}
/** Cuánto pesa el nivel en el Encanto: +25% por nivel; los monumentos suman según las etapas hechas (terminado = 100%). */
export function charmLevelMult(d, level = 1) {
  if (d?.cat === 'monumento') return Math.min(1, level / (MONUMENTS[d.id]?.stages.length || 1));
  return 1 + 0.25 * (level - 1);
}
export const CHARM_REPEAT = 0.85;      // cada copia extra del mismo edificio vale 85% de la anterior
export const CHARM_VARIETY = 0.02;     // +2% por cada tipo distinto (sin caminos), tope x1,5
/**
 * Encanto: qué tan linda y variada está la ciudad. Suma el encanto de cada edificio terminado (más por nivel),
 * con rendimiento decreciente si repetís el mismo, y un multiplicador por variedad.
 * {value, base, variety, kinds}
 */
export function charmInfo(state = S(), now = Date.now()) {
  const per = new Map();
  for (const b of state.city.buildings) {
    if (isConstructing(b, now)) continue;
    const d = def(b);
    if (!d) continue;
    const v = charmBase(d) * charmLevelMult(d, b.level || 1);
    if (!per.has(d.id)) per.set(d.id, []);
    per.get(d.id).push(v);
  }
  let base = 0, kinds = 0;
  for (const [id, list] of per) {
    list.sort((a, b) => b - a);
    list.forEach((v, i) => { base += v * Math.pow(CHARM_REPEAT, i); });
    if (def(id).cat !== 'camino') kinds++;
  }
  const variety = Math.min(1.5, 1 + CHARM_VARIETY * kinds);
  // Mi Casa: el Confort de adentro también hace linda la ciudad (Confort / 4)
  let home = 0;
  try { if (state.city.buildings.some(b => b.id === 'mi_casa')) home = comfortInfo(state).charm; } catch {}
  return { value: Math.round(base * variety) + home, base: Math.round(base), variety, kinds, home };
}
export const cityCharm = (state = S(), now = Date.now()) => charmInfo(state, now).value;
/** Cuánto Encanto base sumaría construir otra copia de `id` (para mostrar en el menú). */
export function charmGain(id, state = S()) {
  const d = def(id);
  const n = state.city.buildings.filter(b => b.id === id).length;
  return Math.round(charmBase(d) * Math.pow(CHARM_REPEAT, n) * 10) / 10;
}
/** Tipos de negocio distintos terminados. */
export function shopKinds(state = S(), now = Date.now()) {
  return new Set(state.city.buildings.filter(b => def(b)?.cat === 'negocio' && !isConstructing(b, now)).map(b => b.id)).size;
}
/** Valor actual de un requisito del expediente. */
export function rankReqValue(key, state = S(), now = Date.now()) {
  switch (key) {
    case 'pop': return population(state, now);
    case 'happy': return happiness(state, now).pct;
    case 'charm': return cityCharm(state, now);
    case 'shops': return shopKinds(state, now);
    case 'monuments': return monumentsDone(state, now);
    case 'planos': return state.planos || 0;
    default: return 0;
  }
}
/**
 * Estado del rango: {rank, def, next (def del siguiente o null), reqs:[{key, have, need, ok}], allOk, levelOk, charm, stars}.
 * stars (0..5): Encanto respecto del que pide el próximo rango (o el último si ya es el máximo).
 */
export function rankStatus(state = S(), now = Date.now()) {
  const rank = townRank(state);
  const cur = rankDef(rank);
  const next = rank < TOWN_RANKS.length ? rankDef(rank + 1) : null;
  // los planos cuentan cuando la partida ya los tiene (state.planos, Fase 2); antes, el expediente no los pide
  const reqs = next ? Object.entries(next.req || {}).filter(([key]) => key !== 'planos' || hasPlanos(state)).map(([key, need]) => {
    const have = rankReqValue(key, state, now);
    return { key, have, need, ok: have >= need };
  }) : [];
  const charm = cityCharm(state, now);
  const target = (next || TOWN_RANKS[TOWN_RANKS.length - 1]).req.charm;
  const stars = Math.max(0, Math.min(5, Math.floor((charm / target) * 5)));
  return {
    rank, def: cur, next, reqs, charm, stars,
    allOk: !!next && reqs.every(r => r.ok),
    levelOk: !!next && state.player.level >= next.reqLevel,
  };
}
const hasPlanos = (state) => typeof state.planos === 'number';
/** Planos que pide la obra del próximo rango (0 si no pide o si la partida todavía no maneja planos). */
export function rankPlanos(state = S()) {
  const r = townRank(state);
  const next = r < TOWN_RANKS.length ? rankDef(r + 1) : null;
  return next && hasPlanos(state) ? (next.req?.planos || 0) : 0;
}

// ---------- Épocas (DESIGN-CORE.md §4) ----------
/** Época actual de la ciudad (1..5): la del rango. Lo nuevo se construye en esta época. */
export const cityEra = (state = S()) => eraOfRank(townRank(state));
/** Época con la que se dibuja un edificio: la Municipalidad sigue al rango; el resto, b.era (1 si falta). */
export function buildingEra(b) {
  if (!b) return 1;
  if (b.id === 'castillo') return eraOfRank(b.level);
  return Math.max(1, Math.min(5, Math.round(b.era) || 1));
}
/** ¿Este edificio cambia con la época? (no: Municipalidad, Mi Casa, deco, caminos y monumentos). */
export function hasEra(b) {
  const d = def(b);
  if (!d || d.id === 'castillo' || d.id === 'mi_casa') return false;
  return !['deco', 'camino', 'monumento'].includes(d.cat);
}
/**
 * Renovar a la época actual: {era, cost:{coins, mats}, time} o null si no hace falta.
 * Monedas max(100, 0,4 × costo × época), materiales lote × tabla de la época, obra de 2 min × época. Conserva el nivel.
 */
export function renovateInfo(b, state = S()) {
  if (!b || !hasEra(b)) return null;
  const era = cityEra(state);
  if (buildingEra(b) >= era) return null;
  const d = def(b), [w, dd] = d.size, ed = eraDef(era);
  const mats = {};
  for (const [k, n] of Object.entries(ed.mats || {})) mats[k] = n * w * dd;
  const cost = { coins: Math.max(100, Math.round(0.4 * (d.cost.coins || 0) * era)) };
  if (Object.keys(mats).length) cost.mats = mats;
  return { era, name: ed.name, cost, time: stageTime(120 * era, state) };
}
export function canRenovate(b, state = S(), now = Date.now()) {
  const info = renovateInfo(b, state);
  if (!info) return { ok: false, reason: 'Ya está en la época actual' };
  if (isBusy(b, now)) return { ok: false, reason: 'Está en obra' };
  if (buildersFree(state, now) <= 0) return { ok: false, reason: 'Constructoras ocupadas' };
  if (!store.hasMats(info.cost.mats)) return { ok: false, reason: 'Faltan materiales', mats: true };
  if (!store.canAfford(info.cost)) return { ok: false, reason: 'No te alcanza', poor: true };
  return { ok: true };
}
/** Empieza la renovación (usa la obra de mejora: upgradeEnd + b.renovating = época destino). */
export function startRenovate(uid, state = S()) {
  const b = state.city.buildings.find(o => o.uid === uid);
  if (!b) return { error: 'No existe' };
  const can = canRenovate(b, state);
  if (!can.ok) return { error: can.reason };
  const info = renovateInfo(b, state);
  collect(uid, state);
  if (!store.spend(info.cost, 'renovate:' + b.id)) return { error: 'No te alcanza' };
  b.renovating = info.era;
  b.upgradeEnd = Date.now() + info.time * 1000;
  store.markDirty();
  bus.emit('building:upgradeStarted', { b, renovate: true });
  return b;
}
/** Edificios de una época anterior a la de la ciudad (para el aviso después del cambio de época). */
export function outdatedBuildings(state = S(), now = Date.now()) {
  const era = cityEra(state);
  return state.city.buildings.filter(b => hasEra(b) && !isConstructing(b, now) && !b.renovating && buildingEra(b) < era);
}

/** Constructoras que regalan los rangos alcanzados. */
export const rankBuilders = (rank) => TOWN_RANKS.slice(0, rank).reduce((s, r) => s + (r.builders || 0), 0);
/**
 * Aplica los beneficios permanentes del rango (constructoras) y guarda récords para los logros.
 * Es idempotente: se puede llamar en cada tick (las partidas viejas reciben lo que les toca).
 */
export function syncRank(state = S(), now = Date.now()) {
  if (!state.city.rankPerks || typeof state.city.rankPerks !== 'object') state.city.rankPerks = { builders: 0 };
  const rank = townRank(state);
  const want = rankBuilders(rank), given = state.city.rankPerks.builders || 0;
  if (want > given) {
    state.builders += want - given;
    state.city.rankPerks.builders = want;
    store.markDirty();
    bus.emit('builders:changed', { builders: state.builders });
  }
  if ((state.stats.rankBest || 0) < rank) store.setMax('rankBest', rank);
  const ch = cityCharm(state, now);
  if ((state.stats.charmBest || 0) < ch) store.setMax('charmBest', ch);
}

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
  const pts = state.city.buildings.reduce((s, b) => s + (isConstructing(b, now) ? 0 : buildingHappy(b)), 0);
  return Math.round(pts * (1 + monumentBonus('happy', state, now)));   // Jardín Botánico
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
  const out = { coins: Math.round((d.cost.coins || 0) * mult), gems: d.cost.gems || 0 };
  if (d.cost.mats) out.mats = { ...d.cost.mats };
  return out;
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
  if (!free && d.rank && townRank(state) < d.rank) return { ok: false, reason: `Rango ${rankName(d.rank)}`, locked: true, rank: d.rank };
  if (d.max && countOf(id, state) >= d.max) return { ok: false, reason: 'Ya lo tenés' };
  if (!free && d.popReq && population(state, now) < d.popReq) return { ok: false, reason: `Necesita ${d.popReq} habitantes`, locked: true };
  if (d.time > 0 && buildersFree(state, now) <= 0) return { ok: false, reason: 'Constructoras ocupadas' };
  if (!free && !store.hasMats(placeCost(id, state).mats)) return { ok: false, reason: 'Faltan materiales', mats: true };
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
  const b = { uid: state.city.nextUid++, id, x, z, rot, level: 1, era: cityEra(state), buildEnd: d.time > 0 ? now + stageTime(d.time, state) * 1000 : 0, upgradeEnd: 0, lastCollect: now };
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
    if (d.cat === 'negocio') per *= 1 + monumentBonus('shopCoins', state, now);   // Faro
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
  return d.id === 'castillo' || d.id === 'mi_casa' || d.cat === 'monumento' || ((d.cat === 'casa' || d.cat === 'negocio') && !!d.prod);
}
export function maxLevel(b) {
  const d = def(b);
  if (d.id === 'castillo') return TOWN_RANKS.length;
  if (d.cat === 'monumento') return MONUMENTS[d.id].stages.length;
  if (d.id === 'mi_casa') return HOME_LEVELS.length;
  return MAX_BUILDING_LEVEL;
}
/** Duración real de una obra (segundos): la Torre del Reloj terminada la acorta. */
export function stageTime(sec, state = S(), now = Date.now()) {
  return Math.max(1, Math.round(sec * (1 - monumentBonus('time', state, now))));
}
// costo de mejora = costo base × factor (nivel actual → siguiente). Se duplica en cada nivel: las mejoras son el
// gran sumidero de monedas a mediano plazo (cada nivel da +50% de producción).
const UPGRADE_COST_MULT = [0, 1.7, 3.4, 6.8, 13.6];
/** {cost, time(seg), reqLevel} de la próxima mejora o null si está al máximo. */
export function upgradeInfo(b) {
  if (!canUpgradeType(b) || b.level >= maxLevel(b)) return null;
  const d = def(b);
  if (d.id === 'castillo') {
    const c = rankDef(b.level + 1);
    return { cost: c.cost, time: stageTime(c.time), reqLevel: c.reqLevel, rank: c.rank };
  }
  if (d.id === 'mi_casa') {
    const h = HOME_LEVELS[b.level];
    return { cost: { ...h.cost, mats: { ...(h.cost.mats || {}) } }, time: stageTime(h.time), reqLevel: 1, homeRank: h.rank || 0, home: h };
  }
  if (d.cat === 'monumento') {
    const st = MONUMENTS[d.id].stages[b.level];
    return { cost: { ...st.cost, mats: { ...st.cost.mats } }, time: stageTime(st.time), reqLevel: 1, stage: b.level + 1 };
  }
  const base = d.cost.coins || 200;
  return {
    cost: { coins: Math.round(base * UPGRADE_COST_MULT[b.level]), gems: b.level >= 3 ? b.level - 2 : 0 },
    time: stageTime(Math.max(15, Math.round((d.time || 10) * (b.level + 1)))),
    reqLevel: d.unlock + b.level * 2,
  };
}
export function canUpgrade(b, state = S(), now = Date.now()) {
  const info = upgradeInfo(b);
  if (!info) return { ok: false, reason: 'Nivel máximo' };
  if (isBusy(b, now)) return { ok: false, reason: 'Está en obra' };
  if (state.player.level < info.reqLevel) return { ok: false, reason: `Nivel ${info.reqLevel}`, locked: true };
  if (info.rank && !rankStatus(state, now).allOk) return { ok: false, reason: 'Falta completar el expediente', locked: true, reqs: true };
  if (info.homeRank && townRank(state) < info.homeRank) return { ok: false, reason: `Rango ${rankName(info.homeRank)}`, locked: true, rank: info.homeRank };
  if (buildersFree(state, now) <= 0) return { ok: false, reason: 'Constructoras ocupadas' };
  if (!store.hasMats(info.cost.mats)) return { ok: false, reason: 'Faltan materiales', mats: true };
  if (!store.canAfford(info.cost)) return { ok: false, reason: 'No te alcanza', poor: true };
  return { ok: true };
}

// ---------- Materiales y monumentos ----------
export const materials = (state = S()) => state.materials || {};
/** 'del Faro' / 'de la Torre del Reloj' (para armar frases). */
export function monumentOf(id) { const mo = MONUMENTS[id]; return mo?.art === 'la' ? `de la ${mo.name}` : `del ${mo?.name || id}`; }
/**
 * Estado de un monumento para el panel de Obras:
 * {id, def, mon, N, b (edificio o null), stagesDone (0..N), done, busy, unlocked, nextIdx, next ({cost,time} o null), can}
 */
export function monumentStatus(id, state = S(), now = Date.now()) {
  const d = def(id), mon = MONUMENTS[id], N = mon.stages.length;
  const b = state.city.buildings.find(o => o.id === id) || null;
  const building = !!b && isConstructing(b, now);
  const stagesDone = !b || building ? 0 : Math.min(N, b.level || 1);
  const busy = !!b && isBusy(b, now);
  const done = !!b && !building && stagesDone >= N;
  const unlocked = townRank(state) >= (d.rank || 1);
  const nextIdx = b ? (building ? 0 : stagesDone) : 0;
  const next = done ? null : mon.stages[nextIdx];
  const can = done ? { ok: false, reason: 'Terminado' } : busy ? { ok: false, reason: 'Está en obra' } : b ? canUpgrade(b, state, now) : canBuild(id, state, now);
  return { id, def: d, mon, N, b, stagesDone, done, busy, unlocked, nextIdx, next, can };
}
/**
 * Para la pantalla de fin de partida: el monumento (desbloqueado, sin terminar y sin obra en curso) cuya próxima
 * etapa pide este material. {id, name, stage, need, have, missing, mat} o null.
 */
export function materialHint(matId, state = S(), now = Date.now()) {
  for (const id of MONUMENT_IDS) {
    const st = monumentStatus(id, state, now);
    if (!st.unlocked || st.done || st.busy || !st.next) continue;
    const need = st.next.cost.mats?.[matId];
    if (!need) continue;
    const have = materials(state)[matId] || 0;
    return { id, name: st.def.name, of: monumentOf(id), the: `${MONUMENTS[id].art || 'el'} ${st.def.name}`, stage: st.nextIdx + 1, need, have, missing: Math.max(0, need - have), mat: MATERIAL_BY_ID[matId] };
  }
  return null;
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
  // la obra de rango gasta los planos del expediente al empezar
  const planos = b.id === 'castillo' ? rankPlanos(state) : 0;
  if (planos > 0) {
    state.planos = Math.max(0, state.planos - planos);
    bus.emit('resources:changed', { key: 'planos', value: state.planos, delta: -planos, reason: 'rank' });
  }
  b.upgradeEnd = Date.now() + info.time * 1000;
  store.markDirty();
  bus.emit('building:upgradeStarted', { b });
  return b;
}
function finishUpgrade(b) {
  const end = b.upgradeEnd || Date.now();
  b.upgradeEnd = 0;
  if (b.renovating) {          // renovación: cambia la época, conserva el nivel
    const from = buildingEra(b);
    b.era = b.renovating;
    delete b.renovating;
    b.lastCollect = Math.min(Date.now(), end);
    store.inc('renovations');
    store.addXp(Math.round((def(b).xp || 20) * 0.5 * b.era));
    bus.emit('building:renovated', { b, era: b.era, from });
    return;
  }
  b.level++;
  b.lastCollect = Math.min(Date.now(), end);
  store.inc('upgrades');
  store.addXp(Math.round((def(b).xp || 20) * 0.8 * b.level));
  bus.emit('building:upgraded', { b, level: b.level });
  if (b.id === 'castillo') {
    const r = rankDef(b.level);
    if (r.reward) store.grant(r.reward, 'rank');
    syncRank();
    const from = eraOfRank(b.level - 1), era = eraOfRank(b.level);
    bus.emit('town:rankup', { rank: b.level, def: r, era, eraChanged: era !== from });
    if (era !== from) bus.emit('era:changed', { era, from });
  }
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
  syncRank(state, now);
  ensureHome(state, now);
}

// ---------- Mi Casa ----------
let homeTry = 0;
/**
 * Mi Casa aparece sola en la ciudad al llegar a nivel 2 (en el nivel 1 la partida sigue "recién empezada" para el
 * onboarding y la sincronización), cerca de la Municipalidad. Si no hay lugar, reintenta cada 30 s.
 */
export function ensureHome(state = S(), now = Date.now()) {
  if ((state.player?.level || 1) < 2 || state.city.buildings.some(b => b.id === 'mi_casa')) return null;
  if (now - homeTry < 30e3) return null;
  homeTry = now;
  const c = state.city.buildings.find(b => b.id === 'castillo');
  const [cw, cd] = c ? footprint('castillo', c.rot) : [0, 0];
  const cx = c ? c.x + cw / 2 : MAP_SIZE / 2, cz = c ? c.z + cd / 2 : MAP_SIZE / 2;
  const { min, max } = landBounds(state);
  let best = null, bd = Infinity;
  for (let x = min; x <= max - 2; x++) for (let z = min; z <= max - 2; z++) {
    if (!canPlace('mi_casa', x, z, 0, null, state).ok) continue;
    // cerca de la Municipalidad, preferentemente adelante (se ve apenas entrás)
    const d = Math.hypot(x + 1 - cx, z + 1 - cz) - (z + 1 > cz ? 0.6 : 0);
    if (d < bd) { bd = d; best = [x, z]; }
  }
  if (!best) return null;
  const b = { uid: state.city.nextUid++, id: 'mi_casa', x: best[0], z: best[1], rot: 0, level: 1, buildEnd: 0, upgradeEnd: 0, lastCollect: now };
  state.city.buildings.push(b);
  store.markDirty();
  bus.emit('building:placed', { b, auto: true });
  bus.emit('home:ready', { b });
  return b;
}

// ---------- Expansiones / constructoras ----------
export function expansionInfo(state = S()) {
  const n = state.city.expansions;
  if (n >= MAX_EXPANSIONS) return null;
  // la expansión n pide nivel 2+2n y un rango cuyo terreno (land) permita más de n expansiones
  const reqRank = (TOWN_RANKS.find(r => r.land > n) || TOWN_RANKS[TOWN_RANKS.length - 1]).rank;
  return { cost: { coins: Math.round(500 * Math.pow(2.1, n)), gems: n >= 3 ? (n - 2) * 5 : 0 }, reqLevel: 2 + n * 2, reqRank };
}
/** ¿Se puede expandir ya? {...info, ok, reason, short} (short: texto corto para el cartel). null si está al máximo. */
export function expansionStatus(state = S()) {
  const info = expansionInfo(state);
  if (!info) return null;
  if (state.player.level < info.reqLevel) return { ...info, ok: false, reason: `Se desbloquea en nivel ${info.reqLevel}`, short: `Nivel ${info.reqLevel}` };
  if (townRank(state) < info.reqRank) return { ...info, ok: false, reason: `Necesitás el rango ${rankName(info.reqRank)}`, short: `Rango ${rankName(info.reqRank)}` };
  return { ...info, ok: true };
}
export function expand(state = S()) {
  const info = expansionInfo(state);
  if (!info) return { error: 'Terreno al máximo' };
  const st = expansionStatus(state);
  if (!st.ok) return { error: st.reason };
  if (!store.spend(info.cost, 'expand')) return { error: 'No te alcanza' };
  state.city.expansions++;
  store.inc('expansions');
  store.addXp(30 * state.city.expansions);
  store.markDirty();
  bus.emit('city:expanded', { expansions: state.city.expansions, bounds: landBounds(state) });
  return { ok: true };
}
/** Contratar constructora con gemas (las que regalan los rangos no cuentan para el tope). */
export function builderInfo(state = S()) {
  const bought = state.builders - (state.city.rankPerks?.builders || 0);
  if (bought >= MAX_BUILDERS) return null;
  return { cost: { gems: BUILDER_GEM_COST[bought + 1] } };
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
