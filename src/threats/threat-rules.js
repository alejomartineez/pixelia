// Reglas de las amenazas (DESIGN-CORE.md §3.3–§3.5). Puro: sin three.js, DOM ni store; recibe una vista plana de la
// ciudad, nunca el estado vivo:
//   city = { bounds: {min, max}, buildings: [{ uid, id, x, z, w, d, era, height, cat, level, prov, wood, tree, building }] }
//   (w, d ya rotados; prov = produce provisiones; wood = época Madera; tree = deco de árbol; building = en obra)
//   city.mods = { eff: { tipo: eficacia extra } } (la Raíz contra la sequía y la helada; opcional)
// La defensa en curso es un objeto plano serializable (se guarda en state.threats.active y se retoma).
import { DEFENSES } from '../core/data.js';
import {
  THREAT_TYPES, AT_RISK_BASE, FLOOD_DIST, effOf, defenseRadius, HOSPITAL_BONUS, PREP_W_COVER, PREP_W_RESERVES,
  turnsFor, fociFor, inflowFor, INFLOW_LEVEL, MAX_LEVEL, HIT_LEVEL, HITS_TO_DAMAGE, SPREAD_FROM, START_LEVEL, AUTO,
} from './threat-data.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const NOT_TARGET = new Set(['camino', 'deco', 'monumento', 'defensa']);
const NOT_TARGET_ID = new Set(['castillo', 'mi_casa']);

/** PRNG determinístico (mulberry32) con estado entero, para poder guardarlo en la defensa. */
export function rngStep(state) {
  const a = (state + 0x6D2B79F5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}
const rnd = (d) => { const [r, s] = rngStep(d.rng); d.rng = s; return r; };

// ---------- Geometría ----------
/** Distancia del centro del tile (x, z) al rectángulo de un edificio (0 si está adentro). */
export function distToRect(x, z, r) {
  const cx = x + 0.5, cz = z + 0.5;
  const dx = Math.max(r.x - cx, 0, cx - (r.x + r.w)), dz = Math.max(r.z - cz, 0, cz - (r.z + r.d));
  return Math.hypot(dx, dz);
}
const inRect = (x, z, r) => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.d;
function* tilesOf(r) { for (let x = r.x; x < r.x + r.w; x++) for (let z = r.z; z < r.z + r.d; z++) yield [x, z]; }
/** ¿Algún tile de `b` está a distancia ≤ radio de la defensa `def`? */
export function covers(def, radius, b) {
  for (const [x, z] of tilesOf(b)) if (distToRect(x, z, def) <= radius) return true;
  return false;
}
/**
 * Tiles que cubre una defensa puesta en (x, z) con rotación rot (sin su propio lote).
 * size: tamaño sin rotar ([w, d]); bounds opcional para recortar al terreno.
 */
export function coverageTiles(defId, x, z, rot = 0, { level = 1, size = null, bounds = null } = {}) {
  const sz = size || [1, 1];
  const [w, d] = rot % 2 ? [sz[1], sz[0]] : sz;
  const R = defenseRadius(defId, level);
  const rect = { x, z, w, d };
  const out = [];
  const r = Math.ceil(R);
  for (let tx = x - r; tx < x + w + r; tx++) for (let tz = z - r; tz < z + d + r; tz++) {
    if (bounds && (tx < bounds.min || tz < bounds.min || tx >= bounds.max || tz >= bounds.max)) continue;
    if (inRect(tx, tz, rect)) continue;
    if (distToRect(tx, tz, rect) <= R) out.push([tx, tz]);
  }
  return out;
}

// ---------- En riesgo (§3.2, §3.3) ----------
const edgeDist = (b, B) => Math.min(b.x - B.min, b.z - B.min, B.max - (b.x + b.w), B.max - (b.z + b.d));
/** Candidatos de un tipo, ordenados del más expuesto al menos. */
export function candidates(type, city) {
  const B = city.bounds;
  const base = city.buildings.filter(b => !NOT_TARGET.has(b.cat) && !NOT_TARGET_ID.has(b.id) && !b.building);
  const by = (f) => (a, b) => f(a) - f(b) || a.uid - b.uid;
  switch (type) {
    case 'crecida': return base.filter(b => B.max - (b.x + b.w) <= FLOOD_DIST - 1).sort(by(b => B.max - (b.x + b.w)));
    case 'sequia': return base.filter(b => b.prov).sort(by(b => edgeDist(b, B)));
    case 'incendio': return base.filter(b => b.wood).sort(by(b => b.z - B.min));
    case 'tormenta': return [...base].sort(by(b => -(b.height || 0)));
    case 'helada': return base.filter(b => b.cat === 'casa' || b.prov).sort(by(b => b.z - B.min));
    default: return [];
  }
}
/** Edificios en riesgo: min(candidatos, 3 + f) elegidos por la regla del tipo. */
export function atRisk(type, city, f) {
  return candidates(type, city).slice(0, AT_RISK_BASE + Math.max(1, f));
}
/** Eficacia de defensa de un edificio contra un tipo: {eff, by (uid de la defensa que lo cubre), hospital}. */
export function efficacy(b, type, city) {
  let best = 0, by = null, hosp = false;
  for (const d of city.buildings) {
    const dd = DEFENSES[d.id];
    if (!dd || d.building) continue;
    const R = defenseRadius(d.id, d.level);
    if (dd.threat === type && covers(d, R, b)) { const e = effOf(d.level); if (e > best) { best = e; by = d.uid; } }
    else if (dd.threat === '*' && covers(d, R, b)) hosp = true;
  }
  let eff = best + (hosp ? HOSPITAL_BONUS : 0);
  // la Raíz (L1): resistencia a la sequía y a la helada en toda la isla (city.mods.eff, lo arma threats.cityView)
  eff += city.mods?.eff?.[type] || 0;
  const eb = THREAT_TYPES[type]?.eraBonus;
  if (eb && (b.era || 1) >= eb[0]) eff += eb[1];
  return { eff: Math.min(1, eff), by, hospital: hosp };
}
/**
 * Preparación: {enRiesgo, list:[{uid, id, eff, covered, by}], c, need, have, r, prep, pct}.
 * reserves = cantidad de la reserva del tipo que tenés (o el objeto state.reserves).
 */
export function prepInfo(type, city, reserves, f) {
  const list = atRisk(type, city, f).map(b => { const e = efficacy(b, type, city); return { uid: b.uid, id: b.id, eff: e.eff, covered: e.by != null, by: e.by, hospital: e.hospital }; });
  const enRiesgo = list.length;
  const have = typeof reserves === 'number' ? reserves : (reserves?.[THREAT_TYPES[type]?.reserve] || 0);
  const need = Math.ceil(enRiesgo / 2);
  const c = enRiesgo ? list.reduce((s, x) => s + x.eff, 0) / enRiesgo : 1;
  const r = need ? Math.min(1, have / need) : 1;
  const prep = enRiesgo ? PREP_W_COVER * c + PREP_W_RESERVES * r : 1;
  return { type, f, enRiesgo, list, c, need, have, r, prep, pct: Math.round(prep * 100) };
}

// ---------- Resolución automática (§3.5) ----------
/** {pct, damaged (cantidad), used (reservas consumidas)}. Los dañados se eligen después: primero los menos cubiertos. */
export function autoResolve(prep, f, enRiesgo, rand = Math.random, have = 0) {
  void rand;
  const pct = clamp(Math.round(AUTO.base + AUTO.perPrep * prep - (f - 1)), AUTO.min, AUTO.max);
  const damaged = enRiesgo ? Math.round((1 - pct / 100) * enRiesgo) : 0;
  return { pct, damaged, used: Math.min(have, Math.ceil(enRiesgo / 2)) };
}
/** Los n menos cubiertos de una prepInfo (empate: el más expuesto primero). */
export function pickDamaged(info, n) {
  return info.list.map((x, i) => ({ ...x, i })).sort((a, b) => a.eff - b.eff || a.i - b.i).slice(0, n).map(x => x.uid);
}

// ---------- Escena de defensa (§3.4) ----------
/** Terreno por tile: 0 pasto, 1 camino, 2 madera (edificio de época Madera o árbol), 3 edificio que no es de madera. */
function terrainOf(city) {
  const B = city.bounds, W = B.max - B.min;
  const t = new Array(W * W).fill(0);
  for (const b of city.buildings) {
    const k = b.cat === 'camino' ? 1 : b.tree || (b.wood && b.cat !== 'deco') ? 2 : b.cat === 'deco' && !b.tree ? 0 : 3;
    for (const [x, z] of tilesOf(b)) if (x >= B.min && z >= B.min && x < B.max && z < B.max) t[(x - B.min) * W + (z - B.min)] = k;
  }
  return t;
}
export const tileIndex = (d, x, z) => (x - d.min) * d.W + (z - d.min);
export const tileXZ = (d, i) => [d.min + Math.floor(i / d.W), d.min + (i % d.W)];
const inB = (d, x, z) => x >= d.min && z >= d.min && x < d.min + d.W && z < d.min + d.W;
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Arma una defensa. o: { id, type, f, city, reserves (cantidad del tipo), colonos, hospital, seed, K? }.
 * Devuelve un objeto plano: levels por tile (0..3), blocked, crews del turno, targets en riesgo con su eficacia, etc.
 */
export function newDefense({ id = 'x', type, f = 1, city, reserves = 0, K = 2, seed = 1 }) {
  const info = prepInfo(type, city, reserves, f);
  const B = city.bounds, W = B.max - B.min;
  const d = {
    id, type, f, turn: 1, turns: turnsFor(f), K, crewsLeft: K, crews: [], min: B.min, W,
    levels: new Array(W * W).fill(0), blocked: [], terrain: terrainOf(city), hits: {}, damaged: [],
    targets: info.list.map(x => { const b = city.buildings.find(o => o.uid === x.uid); return { uid: x.uid, id: x.id, x: b.x, z: b.z, w: b.w, d: b.d, h: b.height || 1, eff: x.eff, covered: x.covered }; }),
    enRiesgo: info.enRiesgo, prep: info.prep, reservesLeft: reserves, reservesUsed: 0, rng: (seed >>> 0) || 1, done: false, log: null,
  };
  placeFoci(d);
  if (!d.targets.length) d.done = true;
  return d;
}
/** Tiles del borde por donde entra la amenaza del tipo. */
function edgeTiles(d) {
  const edge = THREAT_TYPES[d.type].edge, max = d.min + d.W - 1, out = [];
  if (!edge) return out;
  for (let a = d.min; a <= max; a++) {
    if (edge === 'px') out.push([max, a]);
    else if (edge === 'nz') out.push([a, d.min]);
    else { out.push([d.min, a], [max, a]); if (a > d.min && a < max) out.push([a, d.min], [a, max]); }
  }
  return out;
}
/** Elige n tiles del borde frente a los edificios en riesgo (el k-ésimo frente al k-ésimo) donde la amenaza puede entrar. */
function pickEdge(d, n, ok = () => true) {
  const cands = edgeTiles(d), used = new Set(), out = [];
  const live = d.targets.filter(t => !d.damaged.includes(t.uid));
  for (let k = 0; k < n; k++) {
    const t = live.length ? live[Math.floor(rnd(d) * live.length)] : null;
    let best = null, bs = Infinity;
    for (const [x, z] of cands) {
      const i = tileIndex(d, x, z);
      if (used.has(i) || !ok(i)) continue;
      let s = t ? distToRect(x, z, t) : 0;
      if (d.type === 'incendio' && d.terrain[i] === 1) s += 4;   // el fuego no arranca en un camino
      if (d.type === 'helada' && d.terrain[i] === 1) s -= 1.5;   // la escarcha entra por los caminos
      if (d.targets.some(o => inRect(x, z, o))) s += 3;            // y nunca arriba de un lote en riesgo
      s += rnd(d) * 1.5;
      if (s < bs) { bs = s; best = i; }
    }
    if (best == null) break;
    used.add(best); out.push(best);
  }
  return out;
}
/** Focos iniciales en el borde del tipo, frente a los edificios en riesgo. Tormenta: marca dónde caen los primeros rayos. */
function placeFoci(d) {
  if (d.type === 'tormenta') { d.nextRays = pickRays(d); return; }
  for (const i of pickEdge(d, fociFor(d.f))) d.levels[i] = START_LEVEL;
}
/** Rayos del próximo turno (se ven antes: el cielo marca dónde van a caer). Más chances sobre lo más alto. */
function pickRays(d) {
  const out = [];
  const pool = d.targets.filter(t => !d.damaged.includes(t.uid));
  for (let k = 0; k < Math.ceil(d.f / 2) && pool.length; k++) {
    const tot = pool.reduce((s, t) => s + t.h, 0);
    let r = rnd(d) * tot, t = pool[0];
    for (const p of pool) { r -= p.h; if (r <= 0) { t = p; break; } }
    const tiles = [...tilesOf(t)];
    const [x, z] = tiles[Math.floor(rnd(d) * tiles.length)];
    out.push(tileIndex(d, x, z));
  }
  return out;
}
const isCrew = (d, i) => d.crews.some(([x, z]) => tileIndex(d, x, z) === i);
const blocked = (d, i) => d.blocked.includes(i);
/** Pone una cuadrilla: baja 2 niveles en su tile y 1 en las 4 vecinas; ese turno la amenaza no entra a su tile. */
export function placeCrew(d, x, z) {
  if (d.done || d.crewsLeft <= 0 || !inB(d, x, z)) return { ok: false };
  const i = tileIndex(d, x, z);
  if (isCrew(d, i)) return { ok: false };
  d.crews.push([x, z]);
  d.crewsLeft--;
  d.levels[i] = Math.max(0, d.levels[i] - 2);
  for (const [dx, dz] of NB) if (inB(d, x + dx, z + dz)) { const j = tileIndex(d, x + dx, z + dz); d.levels[j] = Math.max(0, d.levels[j] - 1); }
  return { ok: true };
}
/** Usa una reserva: el tile queda bloqueado hasta el final (bolsas de arena, cortafuego, lonas…). */
export function useReserve(d, x, z) {
  if (d.done || d.reservesLeft <= 0 || !inB(d, x, z)) return { ok: false };
  const i = tileIndex(d, x, z);
  if (blocked(d, i)) return { ok: false };
  d.blocked.push(i);
  d.levels[i] = 0;
  d.reservesLeft--; d.reservesUsed++;
  return { ok: true };
}
function nearestTarget(d, x, z) {
  let best = Infinity;
  for (const t of d.targets) if (!d.damaged.includes(t.uid)) best = Math.min(best, distToRect(x, z, t));
  return best === Infinity ? 0 : best;
}
/** ¿Puede entrar la amenaza a este tile? */
function canEnter(d, i) {
  if (d.levels[i] > 0 || blocked(d, i) || isCrew(d, i)) return false;
  if (d.type === 'incendio') return d.terrain[i] === 0 || d.terrain[i] === 2;   // caminos y piedra cortan el fuego
  return true;
}
function spreadScore(d, x, z, i) {
  let s = rnd(d) * 0.6 - 0.5 * nearestTarget(d, x, z);
  if (d.type === 'crecida') s -= 0.25 * (d.min + d.W - 1 - x);   // el agua va por lo bajo, pegada al arroyo
  else if (d.type === 'incendio' && d.terrain[i] === 2) s += 0.8;
  else if (d.type === 'helada' && d.terrain[i] === 1) s += 0.8;
  return s;
}
/** Termina el turno: avanza la amenaza, golpea, pasa de turno. Devuelve el registro de lo que pasó. */
export function endTurn(d) {
  if (d.done) return d.log || { spread: [], rays: [], hits: [], damaged: [] };
  const log = { turn: d.turn, spread: [], rays: [], hits: [], damaged: [] };
  const crewSet = new Set(d.crews.map(([x, z]) => tileIndex(d, x, z)));
  // 1) sube 1 nivel lo que ya estaba (salvo donde hay cuadrilla)
  const before = [];
  for (let i = 0; i < d.levels.length; i++) if (d.levels[i] > 0) { before.push(i); if (!crewSet.has(i)) d.levels[i] = Math.min(MAX_LEVEL, d.levels[i] + 1); }
  // 2) se extiende a 1 vecino (o caen rayos)
  if (d.type === 'tormenta') {
    for (const i of d.nextRays || []) {
      if (crewSet.has(i) || blocked(d, i)) { log.rays.push({ i, stopped: true }); continue; }
      d.levels[i] = Math.max(d.levels[i], HIT_LEVEL);
      log.rays.push({ i, stopped: false });
    }
  } else {
    for (const i of before) {
      if (d.levels[i] < SPREAD_FROM) continue;
      const [x, z] = tileXZ(d, i);
      let best = null, bs = -Infinity;
      for (const [dx, dz] of NB) {
        if (!inB(d, x + dx, z + dz)) continue;
        const j = tileIndex(d, x + dx, z + dz);
        if (!canEnter(d, j)) continue;
        const s = spreadScore(d, x + dx, z + dz, j);
        if (s > bs) { bs = s; best = j; }
      }
      if (best != null) { d.levels[best] = 1; log.spread.push(best); }
    }
  }
  // 2b) sigue entrando por el borde (salvo donde hay reserva o cuadrilla)
  if (d.type !== 'tormenta' && d.turn < d.turns) {
    for (const i of pickEdge(d, inflowFor(d.f), (i) => canEnter(d, i) || (d.levels[i] > 0 && !crewSet.has(i) && !blocked(d, i)))) {
      d.levels[i] = Math.max(d.levels[i], INFLOW_LEVEL);
      log.inflow ||= []; log.inflow.push(i);
    }
  }
  // 3) golpes: nivel ≥ 2 sobre el lote; si está cubierto, tira su eficacia para ignorarlo. 2 golpes = dañado
  for (const t of d.targets) {
    if (d.damaged.includes(t.uid)) continue;
    let hot = false;
    for (const [x, z] of tilesOf(t)) if (d.levels[tileIndex(d, x, z)] >= HIT_LEVEL) { hot = true; break; }
    if (!hot) continue;
    const ignored = t.eff > 0 && rnd(d) < t.eff;
    log.hits.push({ uid: t.uid, ignored });
    if (ignored) continue;
    d.hits[t.uid] = (d.hits[t.uid] || 0) + 1;
    if (d.hits[t.uid] >= HITS_TO_DAMAGE) { d.damaged.push(t.uid); log.damaged.push(t.uid); }
  }
  // 4) próximo turno
  d.turn++;
  d.crews = []; d.crewsLeft = d.K;
  if (d.type === 'tormenta') d.nextRays = d.turn <= d.turns ? pickRays(d) : [];
  const calm = d.type !== 'tormenta' && !d.levels.some(v => v > 0);
  if (d.turn > d.turns || calm || d.damaged.length >= d.targets.length) d.done = true;
  d.log = log;
  return log;
}
/** {pct, damaged:[uid], enRiesgo, saved}. salvado = 100 × (enRiesgo − dañados) / enRiesgo. */
export function defenseResult(d) {
  const n = d.enRiesgo || d.targets.length;
  const saved = n - d.damaged.length;
  return { pct: n ? Math.round(100 * saved / n) : 100, damaged: [...d.damaged], enRiesgo: d.targets.length, saved };
}

// ---------- Bot (simulación y "terminar sola" una defensa que quedó a medias) ----------
/** Juega un turno razonable: cuadrillas donde más amenaza bajan cerca de lo que está en riesgo y alguna reserva. */
export function botTurn(d, { reserves = true, slip = 0 } = {}) {
  if (d.done) return;
  const W = d.W;
  const weight = (x, z) => 1 + 3 / (1 + nearestTarget(d, x, z));
  // reserva: bloquear el tile caliente más pegado a un lote en riesgo
  if (reserves && d.reservesLeft > 0 && d.type !== 'tormenta') {
    let best = null, bs = 0;
    for (let i = 0; i < d.levels.length; i++) {
      if (d.levels[i] < 1 || blocked(d, i)) continue;
      const [x, z] = tileXZ(d, i), nt = nearestTarget(d, x, z);
      if (nt > 1.6) continue;
      const s = d.levels[i] + 2 - nt;
      if (s > bs) { bs = s; best = [x, z]; }
    }
    if (best) useReserve(d, ...best);
  }
  for (let k = 0; k < d.K && d.crewsLeft > 0; k++) {
    let best = null, bs = 0;
    for (let i = 0; i < W * W; i++) {
      const [x, z] = tileXZ(d, i);
      if (isCrew(d, i)) continue;
      let s = Math.min(2, d.levels[i]) * 2 * weight(x, z);
      for (const [dx, dz] of NB) if (inB(d, x + dx, z + dz)) s += Math.min(1, d.levels[tileIndex(d, x + dx, z + dz)]) * weight(x + dx, z + dz);
      // tormenta: tapar el lote de lo más alto que no está cubierto
      if (d.type === 'tormenta' && (d.nextRays || []).includes(i)) s += 6 * weight(x, z);
      if (s > bs) { bs = s; best = [x, z]; }
    }
    if (!best) break;
    // slip: chance de poner la cuadrilla en otro lado (para simular a una persona apurada)
    if (slip && rnd(d) < slip) { const i = Math.floor(rnd(d) * W * W); placeCrew(d, ...tileXZ(d, i)); continue; }
    placeCrew(d, ...best);
  }
}
/** Termina una defensa jugando con el bot (cuando quedó a medias y se pasó el día). */
export function finishWithBot(d, opts) {
  let guard = 50;
  while (!d.done && guard-- > 0) { botTurn(d, opts); endTurn(d); }
  return defenseResult(d);
}
