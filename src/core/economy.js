// Reglas de la ciudad: construir, producir, mejorar, expandir.
// La escena de la ciudad y el HUD usan SOLO estas funciones para que los números siempre coincidan.
import { bus } from './bus.js';
import { store, todayStr } from './state.js';
import {
  BUILDING_BY_ID, MAP_SIZE, START_LAND, LAND_STEP, MAX_EXPANSIONS, MAX_BUILDING_LEVEL,
  CASTLE_BONUS_PER_LEVEL, MAX_BUILDERS, BUILDER_GEM_COST, TOWN_RANKS, MONUMENTS, MONUMENT_IDS, MATERIAL_BY_ID,
  eraOfRank, eraDef,
  CYCLE, DEFENSES, ROLE_BUILDING, PROV_CAP_BASE, PROV_CAP_PER_CASA, PROV_CAP_PER_GRANERO, EXPANSION_ZONES,
} from './data.js';
import { monumentComplete, monumentsDone, monumentBonus } from './monuments.js';
import { HOME_LEVELS, comfortInfo } from '../home/furniture.js';
export { monumentComplete, monumentsDone, monumentBonus };
import { prodBoostMult, happyBoostActive, freeBuildCount, consumeFreeBuild, addFreeBuild } from '../chests/chests.js';
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
    case 'ciclo': return 5 + (d.happy || 0) * 2;
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
  if (b.damaged) return { ok: false, reason: 'Primero hay que repararlo', damaged: true };
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
// Colonos (los traen las aldeas de la expedición): viven en lo que sobra de las casas, así que cuentan para la población
// hasta un 25% de lo que alojan las casas (DESIGN-CORE.md §9, "tope por vivienda libre"; Fase 5b: sin tope llegaban a
// ~4 por día y la felicidad caía sola). Los que no entran esperan (siguen sumando cuadrillas en las amenazas).
export const COLONOS_PER_HOUSING = 0.25;
/** Población que alojan las casas terminadas (sin colonos). */
export function housingPop(state = S(), now = Date.now()) {
  return state.city.buildings.reduce((s, b) => s + (isConstructing(b, now) ? 0 : buildingPop(b)), 0);
}
/** Colonos que cuentan para la población (los que entran en las casas). */
export function colonosHoused(state = S(), now = Date.now()) {
  return Math.min(state.colonos || 0, Math.floor(COLONOS_PER_HOUSING * housingPop(state, now)));
}
/** Población: casas terminadas + los colonos que entran en ellas. */
export function population(state = S(), now = Date.now()) {
  return housingPop(state, now) + colonosHoused(state, now);
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
// Multiplicadores de producción de monedas (DESIGN-CORE.md §8): los permanentes se SUMAN con tope y los temporales
// multiplican después, también con tope. Así no se disparan al juntarse (antes eran todos un producto).
export const PROD_MULT_CAP = 2.5;    // 1 + felicidad + rango + maestría + monumentos
export const BOOST_MULT_CAP = 2;     // pociones × eventos
/**
 * Multiplicador de monedas de un edificio (id) o de la ciudad (sin id, sin maestría).
 * {happy, rank, mastery, monuments, base (≤ 2,5), boost (≤ 2), total}. La Municipalidad no se da felicidad ni rango a sí misma.
 */
export function productionMult(id = null, state = S(), now = Date.now()) {
  const castle = id === 'castillo';
  const happy = castle ? 0 : happiness(state, now).bonus;
  const rank = castle ? 0 : CASTLE_BONUS_PER_LEVEL * (castleLevel(state) - 1);
  const mastery = id ? masteryInfo(id, state).bonus : 0;
  const monuments = monumentBonus('prodCoins', state, now);   // hoy ningún monumento da monedas (Fase 5b: Faro → visión)
  const base = Math.min(PROD_MULT_CAP, 1 + happy + rank + mastery + monuments);
  const boost = Math.min(BOOST_MULT_CAP, boostMultiplier(now));
  return { happy, rank, mastery, monuments, base, boost, total: base * boost };
}
/** Bonus de toda la ciudad (felicidad + rango + monumentos, con tope) × pociones y eventos (con tope). Sin maestría. */
export function globalMultiplier(state = S(), now = Date.now()) {
  return productionMult(null, state, now).total;
}

// ---------- Ciclo de la expedición: niveles de rol y depósito de provisiones (DESIGN-CORE.md §2.3, §5) ----------
/** Nivel más alto de un edificio terminado (0 si no hay ninguno). Mientras se mejora cuenta el nivel de antes. */
export function cycleLevel(id, state = S(), now = Date.now()) {
  let lv = 0;
  for (const b of state.city.buildings) if (b.id === id && !isConstructing(b, now)) lv = Math.max(lv, b.level || 1);
  return lv;
}
/** Nivel de un rol de expedición = nivel del edificio que lo entrena (0 si no está). */
export function roleLevel(role, state = S(), now = Date.now()) {
  const id = ROLE_BUILDING[role];
  return id ? cycleLevel(id, state, now) : 0;
}
/** Valor de una tabla de CYCLE para un nivel (1..5); con nivel 0 devuelve `none`. */
export function cycleValue(id, key, level, none = 0) {
  const t = CYCLE[id]?.[key];
  if (!t || level < 1) return none;
  return t[Math.min(t.length, level) - 1];
}
/** Tope del depósito: 40 + 20 × nivel de la Casa de Expediciones + 40 × nivel de cada Granero (Fase 3). */
export function provCap(state = S(), now = Date.now()) {
  let granero = 0;
  for (const b of state.city.buildings) if (b.id === 'granero' && !isConstructing(b, now)) granero += b.level || 1;
  return PROV_CAP_BASE + PROV_CAP_PER_CASA * cycleLevel('casa_exp', state, now) + PROV_CAP_PER_GRANERO * granero;
}
store.provCap = () => provCap();
/** Zonas exploradas en total (state.expedition.regions[r].zone es la próxima sin explorar, 1..6). */
export function zonesExplored(state = S()) {
  const regs = state.expedition?.regions || {};
  return Object.values(regs).reduce((a, r) => a + Math.max(0, Math.min(5, ((r && r.zone) || 1) - 1)), 0);
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
  if (d.prod.gems || d.prod.prov) return d.prod.cap;   // gemas y provisiones no se estiran: guardan sus tandas
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
  // planos: algunas defensas piden 1 (el Pararrayos, solo el primero: firstPlanos)
  const planos = (d.cost.planos || 0) + (d.firstPlanos && n === 0 ? d.firstPlanos : 0);
  if (planos) out.planos = planos;
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
  if (!free && (placeCost(id, state).planos || 0) > (state.planos || 0)) return { ok: false, reason: 'Falta 1 plano', planos: true };
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
  const currency = d.prod.gems ? 'gems' : d.prod.prov ? 'prov' : 'coins';
  const cap = storageCap(d.id);
  if (isBusy(b, now)) return { producer: true, currency, paused: true, ready: false, amount: 0, progress: 0, full: false, cap };
  // dañado por una amenaza: no produce hasta repararlo (src/threats/threats.js; al reparar se corre el reloj)
  if (b.damaged) return { producer: true, currency, paused: true, damaged: true, ready: false, amount: 0, progress: 0, full: false, cap };
  const cycleMs = d.prod.cycle * 1000;
  const elapsed = Math.max(0, now - b.lastCollect);
  const cycles = Math.min(cap, Math.floor(elapsed / cycleMs));
  const full = cycles >= cap;
  const awake = currency !== 'coins' ? cap : Math.min(cap, d.prod.cap);   // tandas a ritmo normal
  const siesta = Math.max(0, cycles - awake);
  const effective = cycles - siesta + siesta * SIESTA_RATE;
  const progress = full ? 1 : (elapsed % cycleMs) / cycleMs;
  let per;
  if (currency === 'gems') per = d.prod.gems;
  else if (currency === 'prov') per = cycleValue(d.id, 'prov', b.level || 1, d.prod.prov);   // sin multiplicadores
  else {
    // sumados con tope (productionMult); el castillo no se da felicidad ni rango a sí mismo
    per = d.prod.coins * (1 + 0.5 * (b.level - 1)) * productionMult(d.id, state, now).total;
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
  if (st.currency === 'prov') {
    // al depósito: lo que no entra queda en el edificio (se cobran las tandas que entran; si entra menos de una, una)
    const space = provCap(state, now) - (state.prov || 0);
    if (space <= 0) { bus.emit('production:full', { b, currency: 'prov' }); return { amount: 0, currency: 'prov', full: true }; }
    const take = Math.min(st.cycles, Math.max(1, Math.floor(space / st.perCycle)));
    b.lastCollect = take >= st.cycles && st.full ? now : b.lastCollect + take * d.prod.cycle * 1000;
    const got = store.grant({ prov: take * st.perCycle, xp: Math.min(XP_COLLECT_MAX, Math.max(1, Math.round(Math.sqrt(take)))) }, 'collect').prov;
    store.inc('provCollected', got);
    bus.emit('production:collected', { b, amount: got, currency: 'prov' });
    return { amount: got, currency: 'prov' };
  }
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
  const total = { coins: 0, gems: 0, prov: 0 };
  for (const b of state.city.buildings) {
    const r = collect(b.uid, state);
    if (r) total[r.currency] = (total[r.currency] || 0) + r.amount;
  }
  return total;
}

// ---------- Mejoras ----------
export function canUpgradeType(b) {
  const d = def(b);
  return d.id === 'castillo' || d.id === 'mi_casa' || d.cat === 'monumento' || d.cat === 'ciclo' || d.cat === 'defensa' || ((d.cat === 'casa' || d.cat === 'negocio') && !!d.prod);
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
// Duración de una mejora (seg): crece con el nivel para que las constructoras pesen y la plata no se gaste toda en un
// rato (DESIGN-CORE.md §8, Fase 5b, tools/sim-economy.mjs): tiempo de obra del edificio × mult × (nivel siguiente)^pow,
// entre base y max. Panadería: 8 → 27 min · Cine: 1 h 40 → 5 h 25 · Teatro: 4 h → 6 h (tope).
export const UPGRADE_TIME = { base: 300, max: 6 * 3600, mult: 20, pow: 1.3 };
const upgradeSec = (d, level) => Math.min(UPGRADE_TIME.max, Math.max(UPGRADE_TIME.base, Math.round((d.time || 10) * UPGRADE_TIME.mult * Math.pow(level + 1, UPGRADE_TIME.pow))));
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
  if (d.cat === 'ciclo' || d.cat === 'defensa') {
    // edificios del ciclo y defensas: sin gemas; desde el nivel 3 piden materiales de región (y la Casa, planos en el 4 y el 5)
    const up = (d.cat === 'defensa' ? DEFENSES : CYCLE)[d.id]?.up?.[b.level + 1] || {};
    const cost = { coins: Math.round(base * UPGRADE_COST_MULT[b.level]) };
    if (up.mats) cost.mats = { ...up.mats };
    if (up.planos) cost.planos = up.planos;
    return { cost, time: stageTime(upgradeSec(d, b.level)), reqLevel: d.unlock + b.level, reqEra: up.era || 0 };
  }
  return {
    cost: { coins: Math.round(base * UPGRADE_COST_MULT[b.level]), gems: b.level >= 3 ? b.level - 2 : 0 },
    time: stageTime(upgradeSec(d, b.level)),
    reqLevel: d.unlock + b.level * 2,
  };
}
export function canUpgrade(b, state = S(), now = Date.now()) {
  const info = upgradeInfo(b);
  if (!info) return { ok: false, reason: 'Nivel máximo' };
  if (isBusy(b, now)) return { ok: false, reason: 'Está en obra' };
  if (b.damaged) return { ok: false, reason: 'Primero hay que repararlo', damaged: true };
  if (state.player.level < info.reqLevel) return { ok: false, reason: `Nivel ${info.reqLevel}`, locked: true };
  if (info.rank && !rankStatus(state, now).allOk) return { ok: false, reason: 'Falta completar el expediente', locked: true, reqs: true };
  if (info.homeRank && townRank(state) < info.homeRank) return { ok: false, reason: `Rango ${rankName(info.homeRank)}`, locked: true, rank: info.homeRank };
  if (info.reqEra && cityEra(state) < info.reqEra) return { ok: false, reason: `Época ${eraDef(info.reqEra).name}`, locked: true, era: info.reqEra };
  if (buildersFree(state, now) <= 0) return { ok: false, reason: 'Constructoras ocupadas' };
  if (!store.hasMats(info.cost.mats)) return { ok: false, reason: 'Faltan materiales', mats: true };
  if ((info.cost.planos || 0) > (state.planos || 0)) return { ok: false, reason: `Faltan planos (${state.planos || 0}/${info.cost.planos})`, planos: true };
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
// ---------- Comercio con las aldeas ----------
// Las aldeas que cruza la expedición venden materiales por monedas, a precio de época y con un tope por día. Sirve para
// no quedarse esperando el último puñado de una etapa de monumento cuando sobran monedas (el sumidero de monedas del
// medio del juego, DESIGN-CORE.md §8). Pide la Casa de Expediciones. Lo comprado no cuenta como material juntado.
export const TRADE = { price: [60, 90, 200, 320, 480], perDay: [12, 20, 30, 45, 60] };   // índice = época − 1
export function tradeStock(state = S(), now = Date.now()) {
  const era = cityEra(state), i = Math.max(0, Math.min(TRADE.price.length - 1, era - 1));
  const day = todayStr(new Date(now));
  const used = state.trade?.day === day ? state.trade.n || 0 : 0;
  return { price: TRADE.price[i], perDay: TRADE.perDay[i], left: Math.max(0, TRADE.perDay[i] - used), day };
}
/**
 * Lo que costaría comprar lo que falta de estos materiales, hasta lo que les queda a las aldeas hoy:
 * {units, coins, mats, missing (unidades que faltan en total), full (cubre todo), left, price, ok, reason}.
 */
export function tradeQuote(mats, state = S(), now = Date.now()) {
  const st = tradeStock(state, now), have = materials(state), out = {};
  let units = 0, missing = 0;
  for (const [id, n] of Object.entries(mats || {})) {
    const miss = Math.max(0, (n || 0) - (have[id] || 0));
    missing += miss;
    const take = Math.min(miss, st.left - units);
    if (take > 0) { out[id] = take; units += take; }
  }
  const coins = units * st.price;
  let reason = '';
  if (!hasBuilt('casa_exp', state, now)) reason = 'Hace falta la Casa de Expediciones';
  else if (!missing) reason = 'No falta nada';
  else if (!st.left) reason = 'Las aldeas no tienen más por hoy';
  else if (coins > state.coins) reason = 'No te alcanza';
  return { units, coins, mats: out, missing, full: units >= missing, left: st.left, price: st.price, ok: !reason, reason };
}
/** Compra a las aldeas lo que falta de estos materiales (lo que tengan hoy). Devuelve la cotización o {error}. */
export function buyMissing(mats, state = S(), now = Date.now()) {
  const q = tradeQuote(mats, state, now);
  if (!q.ok) return { error: q.reason };
  if (!store.spend({ coins: q.coins }, 'trade')) return { error: 'No te alcanza' };
  state.materials ||= {};
  for (const [id, n] of Object.entries(q.mats)) state.materials[id] = (state.materials[id] || 0) + n;
  const day = tradeStock(state, now).day;
  state.trade = { day, n: (state.trade?.day === day ? state.trade.n || 0 : 0) + q.units };
  store.markDirty();
  bus.emit('materials:changed', { materials: state.materials, delta: { ...q.mats }, reason: 'trade' });
  bus.emit('trade:bought', { mats: q.mats, coins: q.coins, units: q.units });
  return q;
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
  ensureExpHouse(state, now);
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
  const b = placeNearCastle('mi_casa', state, now);
  if (b) bus.emit('home:ready', { b });
  return b;
}
/** Coloca un edificio (nivel 1, ya terminado) en el lugar libre más cercano a la Municipalidad. null si no entra. */
function placeNearCastle(id, state = S(), now = Date.now(), extra = {}) {
  const c = state.city.buildings.find(b => b.id === 'castillo');
  const [cw, cd] = c ? footprint('castillo', c.rot) : [0, 0];
  const cx = c ? c.x + cw / 2 : MAP_SIZE / 2, cz = c ? c.z + cd / 2 : MAP_SIZE / 2;
  const [w, d] = footprint(id, 0);
  const { min, max } = landBounds(state);
  let best = null, bd = Infinity;
  for (let x = min; x <= max - w; x++) for (let z = min; z <= max - d; z++) {
    if (!canPlace(id, x, z, 0, null, state).ok) continue;
    // cerca de la Municipalidad, preferentemente adelante (se ve apenas entrás)
    const dist = Math.hypot(x + w / 2 - cx, z + d / 2 - cz) - (z + d / 2 > cz ? 0.6 : 0);
    if (dist < bd) { bd = dist; best = [x, z]; }
  }
  if (!best) return null;
  const b = { uid: state.city.nextUid++, id, x: best[0], z: best[1], rot: 0, level: 1, buildEnd: 0, upgradeEnd: 0, lastCollect: now, ...extra };
  state.city.buildings.push(b);
  store.markDirty();
  bus.emit('building:placed', { b, auto: true });
  return b;
}
/**
 * Migración v3 (DESIGN-CORE.md §7.2.2): una partida que ya jugaba y no tenía Pista (→ Casa de Expediciones) recibe la
 * Casa de Expediciones colocada sola cerca de la Municipalidad; si no entra, queda como construcción gratis en el menú.
 */
export function ensureExpHouse(state = S(), now = Date.now()) {
  const v3 = state.v3;
  if (!v3?.placeExp) return null;
  v3.placeExp = 0;
  store.markDirty();
  if (state.city.buildings.some(b => b.id === 'casa_exp')) return null;
  const b = placeNearCastle('casa_exp', state, now, { era: cityEra(state) });
  if (b) { v3.expPlaced = b.uid; return b; }
  addFreeBuild('casa_exp');
  v3.expFree = 1;
  return null;
}

// ---------- Expansiones / constructoras ----------
export function expansionInfo(state = S()) {
  const n = state.city.expansions;
  if (n >= MAX_EXPANSIONS) return null;
  // la expansión n+1 pide zonas exploradas en total (EXPANSION_ZONES, §2.9) y un rango cuyo terreno (land) permita más
  // de n expansiones. Sin requisito de nivel: el terreno se gana explorando.
  const reqRank = (TOWN_RANKS.find(r => r.land > n) || TOWN_RANKS[TOWN_RANKS.length - 1]).rank;
  return { cost: { coins: Math.round(500 * Math.pow(2.1, n)), gems: n >= 3 ? (n - 2) * 5 : 0 }, reqLevel: 1, reqZones: EXPANSION_ZONES[n], reqRank };
}
/**
 * ¿Se puede expandir ya? {...info, ok, reason, short, zones, missingZones} (short: texto corto para el cartel).
 * null si está al máximo.
 */
export function expansionStatus(state = S()) {
  const info = expansionInfo(state);
  if (!info) return null;
  const zones = zonesExplored(state), missingZones = Math.max(0, info.reqZones - zones);
  const out = { ...info, zones, missingZones };
  if (missingZones > 0) {
    const z = missingZones === 1 ? '1 zona más' : `${missingZones} zonas más`;
    return { ...out, ok: false, reason: `Explorá ${z} para ampliar el terreno`, short: missingZones === 1 ? '1 zona' : `${missingZones} zonas`, zonesLock: true };
  }
  if (townRank(state) < info.reqRank) return { ...out, ok: false, reason: `Necesitás el rango ${rankName(info.reqRank)}`, short: `Rango ${rankName(info.reqRank)}` };
  return { ...out, ok: true };
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
