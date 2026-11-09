// Amenazas: integración con la partida (DESIGN-CORE.md §3). Calendario fijo (threat-calendar), reglas puras
// (threat-rules) y acá: avisos, simulacro del tutorial, defensa en curso, resolución automática, daño, reparación,
// premios y eventos del bus.
//
// Estado (state.threats):
//   seen: { [id]: { type, f, g, start, end, at } }   avisos ya dados (fijan tipo y fuerza: no cambian si subís de rango)
//                         g: la parte de la fuerza que pone la Grieta (L1, src/core/raiz.js); el premio usa f − g
//   results: { [id]: { pct, mode, at, damaged:[uid], type, f } }   las últimas 12
//   report: [id]          resueltas solas, pendientes de mostrar en "Mientras no estabas"
//   mended: [uid]         arreglados por la vecindad (72 h), pendientes de contar
//   active: null | defensa (threat-rules.newDefense), se retoma el mismo día
//   sim: null | { at, start, end, done }   simulacro del tutorial (llega al día siguiente de llegar a Caserío)
//   titles: { [nombre]: ms }
// En cada edificio: b.damaged = ms | 0 y b.damagedBy = tipo.
import { bus } from '../core/bus.js';
import { store } from '../core/state.js';
import * as E from '../core/economy.js';
import { syncGrieta, grietaPower, grietaExtra, raizResist } from '../core/raiz.js';
import { threatPrepBonus } from '../core/tools-city.js';
import { BUILDING_BY_ID, DEFENSES, REGION_MAT_IDS, RESERVES } from '../core/data.js';
import * as Cal from './threat-calendar.js';
import * as R from './threat-rules.js';
import {
  THREAT_TYPES, MIN_RANK, SIM, AT_RISK_BASE, SIM_DELAY_H, SIM_WINDOW_H, AUTO_REPAIR_H, RESULTS_KEEP, LATE_DAYS,
  crewsFor, rewardFor, sparksFor, repairCost, PERFECT_TITLE, reserveFor,
} from './threat-data.js';

export { THREAT_TYPES };
const S = () => store.state;
const H = 3600e3;
let offset = 0;                                   // solo pruebas: corre el reloj de las amenazas
export const nowMs = () => Date.now() + offset;
export function _debugShift(ms) { offset += ms; tick(); }
export function _debugReset() { offset = 0; }

function ts(state = S()) {
  state.threats ||= {};
  const t = state.threats;
  t.seen ||= {}; t.results ||= {}; t.report ||= []; t.mended ||= []; t.titles ||= {};
  if (t.active === undefined) t.active = null;
  if (t.sim === undefined) t.sim = null;
  t.help ||= {}; t.helpNew ||= []; t.helpFixed ||= [];
  return t;
}

// ---------- Cuadrillas de contactos (Fase 7b) ----------
// Un contacto puede mandar una cuadrilla a la amenaza que publicás (stats.threat): cada una suma HELP.prep a la
// preparación de la resolución automática y una cuadrilla más en la defensa jugada (tope HELP.extraK). Si llega tarde
// (la amenaza ya se resolvió sola antes de que el juego se enterara), arregla un edificio que esa amenaza dañó.
export const HELP = { prep: 0.05, max: 3, extraK: 2 };
/** -> { n, names, bonus } para una amenaza. */
export function helpFor(id, state = S()) {
  const list = (ts(state).help[id] || []).slice(0, HELP.max);
  return { n: list.length, names: list.map(x => x.name), bonus: list.length * HELP.prep };
}
/**
 * Registra cuadrillas que llegaron del servidor: [{ threat, id (de quien ayuda), name, at (ms) }]. Idempotente.
 * Devuelve cuántas son nuevas.
 */
export function addHelp(list = [], state = S(), now = nowMs()) {
  const st = ts(state);
  let added = 0;
  for (const c of list) {
    if (!c?.threat || !c.id) continue;
    const arr = (st.help[c.threat] ||= []);
    if (arr.some(x => x.id === c.id)) continue;
    arr.push({ id: c.id, name: String(c.name || 'Un contacto').slice(0, 24), at: c.at || now });
    added++;
    const res = st.results[c.threat];
    const type = res?.type || st.seen[c.threat]?.type || null;
    if (res) {
      // llegó tarde (la amenaza se resolvió sola antes de que el juego se enterara). Si salió antes de que se resolviera,
      // cuenta como si hubiera llegado a tiempo: suma su preparación al resultado (y el premio de la diferencia).
      // Además arregla un edificio que esa amenaza dañó (si queda alguno).
      const late = { name: c.name, uid: null, from: null, to: null };
      if (res.mode === 'auto' && (c.at || now) <= res.at + 60e3 && arr.length <= HELP.max && res.pct < 100) lateBonus(res, late);
      const b = state.city.buildings.find(o => o.damaged && (res.damaged || []).includes(o.uid));
      if (b) { clearDamage(b, now); late.uid = b.uid; bus.emit('building:repaired', { b, paid: null, help: c.name }); }
      if (late.uid != null || late.to != null) st.helpFixed.push(late);
    } else if (arr.length <= HELP.max) st.helpNew.push({ threat: c.threat, name: c.name, type });
  }
  const keys = Object.keys(st.help);
  for (const k of keys.slice(0, Math.max(0, keys.length - 12))) delete st.help[k];
  if (added) store.markDirty();
  return added;
}
/** Cuadrilla tardía que salió a tiempo: +HELP.prep al % de la resolución automática y el premio de la diferencia. */
function lateBonus(res, late) {
  const from = res.pct, to = Math.min(100, from + Math.round(HELP.prep * 100));
  const f = Math.max(1, res.f || 1), a = rewardFor(from, f), b = rewardFor(to, f);
  const extra = {};
  if (b.gems > a.gems) extra.gems = b.gems - a.gems;
  if ((b.coins || 0) > (a.coins || 0)) extra.coins = b.coins - (a.coins || 0);
  if ((b.mats || 0) > (a.mats || 0)) extra.mats = pickMats(res.type, b.mats - (a.mats || 0));
  res.pct = to;
  (res.help ||= []).push(late.name);
  if (Object.keys(extra).length) { store.grant(extra, 'threat'); res.reward = mergeReward(res.reward, extra); }
  late.from = from; late.to = to;
}
const mergeReward = (r = {}, x = {}) => {
  const out = { ...r };
  for (const k of ['gems', 'coins']) if (x[k]) out[k] = (out[k] || 0) + x[k];
  if (x.mats) { out.mats = { ...(out.mats || {}) }; for (const [k, n] of Object.entries(x.mats)) out.mats[k] = (out.mats[k] || 0) + n; }
  return out;
};
/** La amenaza que se publica en el perfil para que los contactos manden cuadrillas: avisada, sin resolver, no simulacro. */
export function publicThreat(state = S(), now = nowMs()) {
  try {
    const t = currentThreat(now, state);
    if (!t || t.id === 'sim' || ts(state).results[t.id] || Cal.phase(t, now) === 'lejos') return null;
    return { id: t.id, type: t.type, start: t.start, end: t.end, help: helpFor(t.id, state).n };
  } catch { return null; }
}
const rank = (state = S()) => E.townRank(state);
// Observatorio terminado (bonus threatWarn, DESIGN-CORE.md §5.4): el aviso sale 2 días antes (WARN_DAYS_OBSERVATORY)
// La Grieta (L1): suma amenazas por temporada (grietaExtra) y fuerza a cada una al avisarla (grietaPower)
const grietaNow = (state = S(), now = nowMs()) => { try { return syncGrieta(state, now); } catch { return 0; } };
const calOpts = (state = S()) => ({
  observatory: (() => { try { return E.monumentBonus('threatWarn', state) > 0; } catch { return false; } })(),
  extra: grietaExtra(grietaNow(state)),
});

// ---------- Vista plana de la ciudad (lo único que ven las reglas) ----------
const TREES = new Set(['arbol', 'cerezo']);
/** Alto estimado (en tiles) para la tormenta: el mismo con o sin la escena abierta. */
export function estHeight(b) {
  const d = BUILDING_BY_ID[b.id];
  if (!d) return 1;
  const L = b.level || 1, big = d.size[0] > 2 || d.size[1] > 2 ? 0.6 : 0;
  if (d.id === 'castillo') return 2.4 + 0.35 * L;
  if (d.cat === 'monumento') return 1.6 + 0.4 * L;
  if (d.cat === 'casa' || d.cat === 'negocio') return 0.9 + 0.3 * L + big + (d.id === 'torre_cristal' ? 1.2 : 0);
  if (d.cat === 'deco' || d.cat === 'camino') return 0.4;
  return 0.8 + 0.2 * L + big;
}
export function cityView(state = S(), now = Date.now()) {
  const L = E.landBounds(state);
  const buildings = state.city.buildings.map(b => {
    const d = BUILDING_BY_ID[b.id] || {};
    const [w, dd] = E.footprint(b.id, b.rot);
    const era = E.buildingEra(b);
    return { uid: b.uid, id: b.id, x: b.x, z: b.z, w, d: dd, era, level: b.level || 1, cat: d.cat, prov: !!d.prod?.prov,
      wood: era === 1 && E.hasEra(b), tree: TREES.has(b.id), building: E.isConstructing(b, now), height: estHeight(b), damaged: !!b.damaged };
  });
  // la Raíz da resistencia a la sequía y a la helada (más con más extracción)
  let mods = null;
  try { const sq = raizResist('sequia', state), he = raizResist('helada', state); if (sq || he) mods = { eff: { sequia: sq, helada: he } }; } catch {}
  // el Farol de guardia de Ramiro (L5, paso 7): más preparación
  try { const pr = threatPrepBonus(state); if (pr) mods = { ...(mods || {}), prep: pr }; } catch {}
  return { bounds: { min: L.min, max: L.max }, buildings, mods };
}

// ---------- Calendario de esta partida ----------
/** Amenaza con tipo y fuerza fijados si ya se avisó. */
function fixed(t, state = S()) {
  if (!t) return null;
  const s = ts(state).seen[t.id];
  if (s) return { ...t, type: s.type, f: s.f, g: s.g || 0 };
  if (t.id === 'sim') return { ...t, f: SIM.f, g: 0 };
  const g = grietaPower(grietaNow(state));
  return { ...t, f: rank(state) + g, g };
}
function simThreat(state = S()) {
  const sim = ts(state).sim;
  return sim ? { ...Cal.makeSim(sim.at, SIM_DELAY_H, SIM_WINDOW_H), start: sim.start, end: sim.end, signs: Math.max(sim.at, sim.start - 48 * H), f: SIM.f, type: SIM.type } : null;
}
/** La amenaza que importa ahora: el simulacro pendiente o la próxima del calendario. */
export function currentThreat(now = nowMs(), state = S()) {
  const t = ts(state);
  if (rank(state) < MIN_RANK && !t.sim) return null;
  if (t.sim && !t.sim.done) return simThreat(state);
  if (rank(state) < MIN_RANK) return null;
  // la próxima sin resolver (una ya jugada hoy no vuelve a aparecer)
  const s = Cal.seasonOf(now);
  const list = [...Cal.schedule(s, rank(state), calOpts(state)), ...Cal.schedule(s + 1, rank(state), calOpts(state))];
  for (const x of list) if (x.end > now && !t.results[x.id]) return fixed(x, state);
  return null;
}
export const threatName = (th) => (th?.id === 'sim' ? SIM.name : THREAT_TYPES[th?.type]?.name || 'Amenaza');

/**
 * Estado para el HUD de la ciudad y el panel: null si no hay nada que mostrar todavía.
 * {t, phase, when, type, def, name, info (preparación), active, canFace, result}
 */
export function threatStatus(now = nowMs(), state = S()) {
  const t = currentThreat(now, state);
  if (!t) return null;
  const phase = Cal.phase(t, now);
  const info = R.prepInfo(t.type, cityView(state, now), state.reserves || {}, t.f);
  const st = ts(state);
  return {
    t, phase, when: Cal.whenText(t, now), type: t.type, def: THREAT_TYPES[t.type], name: threatName(t), f: t.f, g: t.g || 0, info,
    active: st.active && st.active.id === t.id ? st.active : null,
    canFace: phase === 'hoy' && !st.results[t.id] && info.enRiesgo > 0, visible: phase !== 'lejos', help: helpFor(t.id, state),
    reserve: reserveFor(t.type), reserveName: RESERVES[reserveFor(t.type)]?.name,
  };
}

// ---------- Avisos ----------
function announce(t, state = S(), now = nowMs()) {
  const st = ts(state);
  if (st.seen[t.id]) return;
  st.seen[t.id] = { type: t.type, f: t.f, g: t.g || 0, start: t.start, end: t.end, at: now };
  store.markDirty();
  bus.emit('threat:announced', { id: t.id, type: t.type, day: t.day, at: t.start, f: t.f, g: t.g || 0 });
}
/** Simulacro del tutorial: se avisa al llegar a Caserío (una sola vez). */
function ensureSim(state = S(), now = nowMs()) {
  const st = ts(state);
  if (st.sim || rank(state) < MIN_RANK) return;
  if (Object.keys(st.results).length) return;   // ya pasó alguna amenaza: no hace falta el simulacro
  const sim = Cal.makeSim(now, SIM_DELAY_H, SIM_WINDOW_H);
  st.sim = { at: now, start: sim.start, end: sim.end, done: false };
  announce({ ...sim, f: SIM.f }, state, now);
}

// ---------- Resolver ----------
const pickMats = (type, n, rand = Math.random) => {
  const out = {};
  const rep = THREAT_TYPES[type].repair;
  for (let i = 0; i < n; i++) { const id = i < Math.ceil(n / 2) ? rep : REGION_MAT_IDS[Math.floor(rand() * REGION_MAT_IDS.length)]; out[id] = (out[id] || 0) + 1; }
  return out;
};
function applyResult({ id, type, f, g = 0, pct, mode, damaged, enRiesgo }, state = S(), now = nowMs()) {
  const st = ts(state);
  if (st.results[id]) return st.results[id];
  for (const uid of damaged) {
    const b = state.city.buildings.find(o => o.uid === uid);
    if (!b || b.damaged) continue;
    b.damaged = now; b.damagedBy = type;
    bus.emit('building:damaged', { b, threat: id });
  }
  // premio (§3.7) y chispas del Pase. Una amenaza con menos blancos es más chica: el premio también (con nada en riesgo,
  // solo las 2 gemas de consuelo), así no conviene tener la ciudad vacía de lo que la amenaza golpea.
  // la fuerza que pone la Grieta (g) trae más daño, no más premio
  const fr = Math.max(1, f - g);
  const rw = rewardFor(pct, fr);
  const size = Math.max(0, Math.min(1, (enRiesgo ?? AT_RISK_BASE + fr) / (AT_RISK_BASE + fr)));
  const reward = { gems: Math.max(2, Math.round(rw.gems * size)) };
  if (rw.coins && size > 0) reward.coins = Math.round(rw.coins * size);
  if (rw.mats && size > 0) reward.mats = pickMats(type, Math.max(1, Math.round(rw.mats * size)));
  if (rw.planoChance && size >= 0.5 && Math.random() < rw.planoChance) reward.planos = 1;
  if (rw.chest && size >= 0.5) reward.chest = rw.chest;
  let title = null;
  if (pct >= 100 && size >= 0.5 && !st.titles[PERFECT_TITLE]) { st.titles[PERFECT_TITLE] = now; title = PERFECT_TITLE; }
  store.grant(reward, 'threat');
  import('../season/season.js').then(m => { try { m.addSeasonPoints(sparksFor(pct), 'threat'); } catch (e) { console.warn('[threats] chispas', e); } }).catch(() => {});
  const sparks = sparksFor(pct);
  store.inc('threats');
  if (mode === 'jugada') store.inc('threatsPlayed');
  store.setMax('threatBest', pct);
  const help = helpFor(id, state).names;
  const res = { pct, mode, at: now, damaged: [...damaged], type, f, g, reward, sparks, title, help };
  st.results[id] = res;
  // se guardan las últimas 12
  const ids = Object.keys(st.results).sort((a, b) => st.results[b].at - st.results[a].at);
  for (const old of ids.slice(RESULTS_KEEP)) delete st.results[old];
  if (mode === 'auto') st.report.push(id);
  if (id === 'sim' && st.sim) st.sim.done = true;
  if (st.active?.id === id) st.active = null;
  store.markDirty();
  bus.emit('threat:resolved', { id, type, pct, mode, damaged: [...damaged], reward, g });
  bus.emit('quests:changed');
  return res;
}
/** Resuelve sola una amenaza (o termina con el bot la defensa que quedó a medias). */
function resolveAuto(t, state = S(), now = nowMs()) {
  const st = ts(state);
  if (st.active && st.active.id === t.id) return finishDefense(state, now, true);
  const info = R.prepInfo(t.type, cityView(state, now), state.reserves || {}, t.f);
  // las cuadrillas de contactos suman preparación (Fase 7b)
  const a = R.autoResolve(Math.min(1, info.prep + helpFor(t.id, state).bonus), t.f, info.enRiesgo, Math.random, info.have);
  const resId = reserveFor(t.type);
  if (a.used && resId) store.spend({ reserves: { [resId]: a.used } }, 'threat');
  return applyResult({ id: t.id, type: t.type, f: t.f, g: t.g || 0, pct: a.pct, mode: 'auto', damaged: R.pickDamaged(info, a.damaged), enRiesgo: info.enRiesgo }, state, now);
}
/** Al cargar y en cada tick: avisos, simulacro, resolución de lo que ya pasó y arreglos de la vecindad. */
/** Registro de rangos ({r, at}) para saber qué amenazas te tocaban en cada momento. Sin registro, el rango actual. */
function logRank(state, now) {
  const st = ts(state);
  if (!Array.isArray(st.rankLog)) st.rankLog = [];
  const r = rank(state);
  const last = st.rankLog[st.rankLog.length - 1];
  if (!last || last.r !== r) { st.rankLog.push({ r, at: last ? now : 0 }); if (st.rankLog.length > 12) st.rankLog.splice(1, 1); store.markDirty(); }
}
function rankAt(state, at) {
  const log = ts(state).rankLog || [];
  let r = null;
  for (const e of log) if (e.at <= at) r = e.r;
  return r ?? rank(state);
}
export function resolvePending(now = nowMs(), state = S()) {
  const st = ts(state);
  ensureSim(state, now);
  // simulacro vencido
  if (st.sim && !st.sim.done && now >= st.sim.end) resolveAuto(simThreat(state), state, now);
  // las avisadas que ya terminaron
  for (const [id, s] of Object.entries(st.seen)) {
    if (id === 'sim' || st.results[id] || s.end > now) continue;
    resolveAuto({ id, type: s.type, f: s.f, g: s.g || 0, start: s.start, end: s.end }, state, now);
  }
  // las que terminaron hace poco sin que se viera el aviso (la app estuvo cerrada toda la semana)
  logRank(state, now);
  if (rank(state) >= MIN_RANK) {
    for (const t of Cal.threatsBetween(now - LATE_DAYS * 24 * H, now, rank(state), calOpts(state))) {
      if (st.results[t.id] || st.seen[t.id]) continue;
      // solo si ya te tocaba cuando se avisó: subir de rango agrega días de amenaza, y uno que ya pasó no se cobra
      const rAt = rankAt(state, t.announce);
      if (rAt < MIN_RANK || !Cal.threatsBetween(t.start - H, t.end + H, rAt, calOpts(state)).some(x => x.id === t.id)) continue;
      const ft = fixed(t, state);
      announce(ft, state, now);
      resolveAuto(ft, state, now);
    }
    // aviso de la próxima
    const cur = currentThreat(now, state);
    if (cur && cur.id !== 'sim' && Cal.phase(cur, now) !== 'lejos') announce(cur, state, now);
  }
  // la vecindad arregla sola lo que lleva 72 h dañado
  for (const b of state.city.buildings) {
    if (b.damaged && now - b.damaged >= AUTO_REPAIR_H * H) { clearDamage(b, now); st.mended.push(b.uid); store.markDirty(); bus.emit('building:repaired', { b, paid: null, auto: true }); }
  }
}
export function tick() { try { resolvePending(); } catch (e) { console.warn('[threats]', e); } }

// ---------- Defensa jugada (§3.4) ----------
const hasHospital = (state = S()) => state.city.buildings.some(b => b.id === 'hospital' && !E.isConstructing(b));
/** Arranca (o retoma) la defensa de la amenaza de hoy. Devuelve la defensa o {error}. */
export function startDefense(id, state = S(), now = nowMs()) {
  const st = ts(state);
  const t = currentThreat(now, state);
  if (!t || t.id !== id) return { error: 'Esa amenaza no es hoy' };
  if (Cal.phase(t, now) !== 'hoy') return { error: 'Todavía no llegó' };
  if (st.results[id]) return { error: 'Ya la enfrentaste' };
  if (st.active && st.active.id === id) return st.active;
  if (!R.atRisk(t.type, cityView(state, now), t.f).length) return { error: 'Hoy no hay nada expuesto: pasa sola' };
  const resId = reserveFor(t.type);
  const d = R.newDefense({ id, type: t.type, f: t.f, city: cityView(state, now), reserves: state.reserves?.[resId] || 0,
    K: crewsFor(state.colonos || 0, hasHospital(state)) + Math.min(HELP.extraK, helpFor(id, state).n), seed: (now & 0x7fffffff) ^ 0x5bd1e995 });
  st.active = d;
  store.markDirty();
  bus.emit('threat:started', { id });
  return d;
}
export const activeDefense = (state = S()) => ts(state).active;
function persist(state = S()) { store.markDirty(); return ts(state).active; }
export function crew(x, z, state = S()) { const d = ts(state).active; if (!d) return { ok: false }; const r = R.placeCrew(d, x, z); persist(state); return r; }
export function reserve(x, z, state = S()) { const d = ts(state).active; if (!d) return { ok: false }; const r = R.useReserve(d, x, z); persist(state); return r; }
/** Termina el turno; si la defensa terminó, aplica el resultado. Devuelve { log, done, result }. */
export function endTurn(state = S(), now = nowMs()) {
  const d = ts(state).active;
  if (!d) return { log: null, done: true };
  const log = R.endTurn(d);
  persist(state);
  if (d.done) return { log, done: true, result: finishDefense(state, now) };
  return { log, done: false };
}
/** Cierra la defensa en curso (con el bot si quedó a medias: se pasó el día). */
function finishDefense(state = S(), now = nowMs(), withBot = false) {
  const st = ts(state);
  const d = st.active;
  if (!d) return null;
  const res = withBot ? R.finishWithBot(d) : R.defenseResult(d);
  const resId = reserveFor(d.type);
  if (d.reservesUsed && resId) store.spend({ reserves: { [resId]: Math.min(d.reservesUsed, state.reserves?.[resId] || 0) } }, 'threat');
  const t = st.seen[d.id] || {};
  return applyResult({ id: d.id, type: d.type, f: d.f || t.f || 1, g: t.g || 0, pct: res.pct, mode: 'jugada', damaged: res.damaged, enRiesgo: res.enRiesgo }, state, now);
}
/** Deja la defensa para después (se retoma el mismo día). */
export function pauseDefense() { store.markDirty(); }

// ---------- Daño y reparación (§3.6) ----------
export const isDamaged = (b) => !!b?.damaged;
function clearDamage(b, now = nowMs()) {
  // la producción no corre mientras está dañado: se corre el reloj lo que estuvo parado
  if (b.lastCollect && b.damaged) b.lastCollect = Math.min(Date.now(), b.lastCollect + Math.max(0, now - b.damaged));
  b.damaged = 0; delete b.damagedBy;
}
export function repairInfo(b, now = nowMs()) {
  if (!b?.damaged) return null;
  const d = BUILDING_BY_ID[b.id];
  const type = b.damagedBy || 'crecida';
  const cost = repairCost(d?.cost?.coins || 100, b.level || 1, type);
  return { cost, type, def: THREAT_TYPES[type], since: b.damaged, autoIn: Math.max(0, b.damaged + AUTO_REPAIR_H * H - now) };
}
export function canRepair(b) {
  const info = repairInfo(b);
  if (!info) return { ok: false, reason: 'No está dañado' };
  if (!store.hasMats(info.cost.mats)) return { ok: false, reason: 'Faltan materiales', mats: true, info };
  if (!store.canAfford(info.cost)) return { ok: false, reason: 'No te alcanza', poor: true, info };
  return { ok: true, info };
}
/** Repara al instante (no ocupa constructora). Devuelve { ok } o { error }. */
export function repair(uid, state = S()) {
  const b = state.city.buildings.find(o => o.uid === uid);
  const can = canRepair(b);
  if (!can.ok) return { error: can.reason };
  if (!store.spend(can.info.cost, 'repair')) return { error: 'No te alcanza' };
  clearDamage(b);
  store.inc('repairs');
  store.markDirty();
  bus.emit('building:repaired', { b, paid: can.info.cost });
  return { ok: true };
}
export const damagedBuildings = (state = S()) => state.city.buildings.filter(b => b.damaged);
/** Costo de "Reparar todo" (suma) y si alcanza. */
export function repairAllInfo(state = S()) {
  const cost = { coins: 0, mats: {} };
  const list = damagedBuildings(state);
  for (const b of list) { const c = repairInfo(b).cost; cost.coins += c.coins; for (const [k, v] of Object.entries(c.mats)) cost.mats[k] = (cost.mats[k] || 0) + v; }
  return { list, cost, ok: list.length > 0 && store.hasMats(cost.mats) && store.canAfford(cost) };
}
export function repairAll(state = S()) {
  let n = 0;
  for (const b of damagedBuildings(state)) if (repair(b.uid, state).ok) n++;
  return n;
}

// ---------- "Mientras no estabas" ----------
/** Lo pendiente de contar: [{id, name, pct, damaged, reward}] y los arreglados por la vecindad. null si no hay nada. */
export function reportStatus(state = S()) {
  const st = ts(state);
  const items = st.report.map(id => ({ id, ...st.results[id], name: id === 'sim' ? SIM.name : THREAT_TYPES[st.results[id]?.type]?.name })).filter(x => x.type);
  if (!items.length && !st.mended.length && !st.helpNew.length && !st.helpFixed.length) return null;
  return {
    items, mended: st.mended.map(uid => state.city.buildings.find(b => b.uid === uid)).filter(Boolean),
    helpNew: st.helpNew.slice(),
    helpFixed: st.helpFixed.map(x => ({ name: x.name, b: x.uid != null ? state.city.buildings.find(b => b.uid === x.uid) || null : null, from: x.from ?? null, to: x.to ?? null }))
      .filter(x => x.b || x.to != null),
  };
}
export function ackReport(state = S()) { const st = ts(state); st.report = []; st.mended = []; st.helpNew = []; st.helpFixed = []; store.markDirty(); }

// ---------- Defensas: radio ----------
export const isDefense = (id) => !!DEFENSES[typeof id === 'string' ? id : id?.id];
/** Tiles que cubre una defensa (para dibujar el radio al colocarla). */
export function coverageTiles(defId, x, z, rot = 0, level = 1, state = S()) {
  return R.coverageTiles(defId, x, z, rot, { level, size: BUILDING_BY_ID[defId]?.size, bounds: E.landBounds(state) });
}
/** De los edificios en riesgo de la amenaza actual, cuáles cubriría una defensa puesta acá: [uid]. */
export function wouldCover(defId, x, z, rot = 0, level = 1, state = S()) {
  const dd = DEFENSES[defId];
  if (!dd) return [];
  const st = threatStatus(nowMs(), state);
  const [w, d] = E.footprint(defId, rot);
  const rect = { x, z, w, d };
  const R0 = DEFENSES[defId].radius[Math.max(1, Math.min(5, level)) - 1];
  const view = cityView(state);
  // contra su tipo: los en riesgo de la amenaza actual si es de ese tipo; si no, los candidatos de su tipo
  const type = dd.threat === '*' ? st?.type : dd.threat;
  if (!type) return [];
  const list = st && st.type === type ? st.info.list.map(x => x.uid) : R.atRisk(type, view, Math.max(1, rank(state))).map(b => b.uid);
  return list.filter(uid => { const b = view.buildings.find(o => o.uid === uid); return b && R.covers(rect, R0, b); });
}

// ---------- arranque ----------
let inited = false;
export function initThreats() {
  ts();
  if (inited) return;
  inited = true;
  bus.on('town:rankup', () => tick());
  setInterval(tick, 15e3);
  tick();
}
