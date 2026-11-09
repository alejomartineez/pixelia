// Expedición ↔ ciudad (DESIGN-CORE.md §2.3, §2.4, §2.9, §2.11, §5): lee la ciudad, arma la salida (provisiones del
// depósito, grupo según los edificios, equipo del Taller, cansancio), acredita el botín, avanza las zonas (que abren
// terreno), lleva la salida corta gratis del día y fabrica en el Taller. Emite los eventos de bus del contrato.
//   initExpedition() · expeditionStatus() · startExpedition({region, kind, party, equip}) · finishExpedition(run)
//   zonesExplored() · cityClasses() · cycleEffects(id, level) · cycleUpgradeLines(b) · classChance(cls, level)
//   craftStatus(kind, id) · craft(kind, id) · expeditionBadge()
import { bus } from '../core/bus.js';
import { store, todayStr } from '../core/state.js';
import {
  CYCLE, EQUIP_RECIPES, EQUIP_IDS, RESERVES, RESERVE_IDS, RESERVES_RANK, RESERVE_CAP, TIRED_MIN_NONE, BUILDING_BY_ID,
} from '../core/data.js';
import * as E from '../core/economy.js';
import { EXP, REGIONS, REGION_IDS, CLASSES, EQUIPMENT, HAZARDS, ringOf } from './exp-data.js';
import * as K from '../core/classes.js';
import { toClass } from '../combat/classes.js';
import { hashSeed } from './exp-gen.js';
import { ENCOUNTERS } from '../combat/combat-data.js';
import * as R from './exp-rules.js';
import { eventMult } from '../season/events.js';
import { comfortInfo } from '../home/furniture.js';
import { mineObjective, foundNucleo, raizMult } from '../core/raiz.js';

export { zonesExplored, roleLevel } from '../core/economy.js';

const S = () => store.state;
const MIN = 60e3;
// Primera salida corta (tutorial t5): mapa fijo del Bosque con "el aserradero abandonado" de objetivo y madera cerca
// (semilla buscada con exp-gen: 4 casillas de madera a profundidad ≤ 3 y 2 peligros lejos de la base).
export const TUTORIAL_SEED = 110;
// Experiencia por salida terminada (la daban los minijuegos; Fase 5): base + por estrella, × Observatorio y Mi Casa.
export const EXP_XP = { base: 10, perStar: 5 };

// ---------- Expedición del día (Fase 7b) ----------
// Una salida corta aparte, con la misma semilla para todo el mundo ese día (día UTC, igual que el servidor):
// hashSeed(día, región). No gasta provisiones ni la salida corta. El botín va al ranking de contactos y da un premio
// chico por participar (también sin conexión). La región rota entre las tres primeras y vale aunque no esté abierta.
export const DAILY_REGIONS = ['bosque', 'sierras', 'banado'];
export const DAILY_ZONE = 2;
export const DAILY_PRIZE = { gems: 3 };
/** Día de la Expedición del día: 'AAAA-MM-DD' en UTC. */
export const dailyDay = (d = new Date()) => new Date(d).toISOString().slice(0, 10);
export function dailyRegion(day = dailyDay()) {
  const n = Math.floor(Date.parse(day + 'T00:00:00Z') / 864e5);
  return DAILY_REGIONS[((n % DAILY_REGIONS.length) + DAILY_REGIONS.length) % DAILY_REGIONS.length];
}
export const dailySeed = (day = dailyDay()) => hashSeed(day, dailyRegion(day));
/** Botín de la Expedición del día en puntos: materiales 1, planos 6, hallazgos 4, colonos 3, estrellas 5. Tope 1000. */
export function dailyScore(loot = {}, stars = 0) {
  const mats = Object.values(loot.mats || {}).reduce((a, n) => a + (n || 0), 0);
  const finds = Array.isArray(loot.finds) ? loot.finds.length : loot.finds || 0;
  const v = mats + 6 * (loot.planos || 0) + 4 * finds + 3 * (loot.colonos || 0) + 5 * (stars || 0);
  return Math.max(0, Math.min(1000, Math.round(v)));
}
/** { day, region, regionName, zone, seed, done, last:{day, region, score, stars, loot, prize}|null } */
export function dailyInfo(state = S(), now = Date.now()) {
  const e = expState(state);
  const day = dailyDay(now), region = dailyRegion(day);
  const last = e.daily?.day === day ? e.daily : null;
  return { day, region, regionName: REGIONS[region]?.name, zone: DAILY_ZONE, seed: dailySeed(day), done: !!last || e.dailyStarted === day, last };
}
// Orden en que se arma el grupo por defecto (si no hay uno elegido antes).
const PRIORITY = K.CLASS_PRIORITY;

// ---------- estado ----------
/** Completa state.expedition (idempotente). */
export function expState(state = S()) {
  if (!state.expedition || typeof state.expedition !== 'object') state.expedition = {};
  const e = state.expedition;
  if (e.active === undefined) e.active = null;
  if (e.freeDay === undefined) e.freeDay = null;
  if (!e.attempts || typeof e.attempts !== 'object') e.attempts = {};
  if (!e.regions || typeof e.regions !== 'object') e.regions = {};
  for (const id of REGION_IDS) {
    const r = e.regions[id];
    if (!r || typeof r !== 'object') e.regions[id] = { zone: 1, stars: {} };
    else { r.zone = Math.max(1, Math.min(6, r.zone | 0 || 1)); if (!r.stars || typeof r.stars !== 'object') r.stars = {}; }
  }
  if (!e.tired || typeof e.tired !== 'object') e.tired = {};
  if (e.last === undefined) e.last = null;
  if (!Array.isArray(e.party)) e.party = null;   // último grupo elegido
  return e;
}

// ---------- lo que la ciudad le da a la expedición ----------
const lv = (id, state = S()) => E.cycleLevel(id, state);
export const hasBase = (state = S()) => lv('casa_exp', state) > 0;
/** Lugares del grupo contando a quien lidera (0 sin Casa de Expediciones). */
export const partySlots = (state = S()) => E.cycleValue('casa_exp', 'slots', lv('casa_exp', state), 0);
export const provMax = (state = S()) => E.cycleValue('casa_exp', 'provMax', lv('casa_exp', state), EXP.provMax[0]);
export const equipSlots = (state = S()) => E.cycleValue('taller', 'equipSlots', lv('taller', state), 0);
export const tiredMinutes = (state = S()) => E.cycleValue('dispensario', 'tiredMin', lv('dispensario', state), TIRED_MIN_NONE);
/** Carga que suma la Carreta: +4; desde la época Hierro, la Carreta grande da +6 (DESIGN-CORE.md §4.1). */
export function carretaCargo(state = S()) {
  const r = EQUIP_RECIPES.carreta;
  return E.cityEra(state) >= (r.bigEra || 99) ? r.bigCargo : (r.cargo ?? EXP.carreta);
}
/** Texto corto del equipo (la Carreta cuenta la carga de la época). */
export const equipText = (id, state = S()) => (id === 'carreta' ? `+${carretaCargo(state)} de carga` : EQUIPMENT[id]?.text || '');
/** Carga del grupo: 6 + 3 por nivel del Establo, + Carreta. */
export function cargoMax(equip = [], state = S()) {
  return EXP.cargoBase + E.cycleValue('establo', 'cargo', lv('establo', state), 0) + (equip.includes('carreta') ? carretaCargo(state) : 0);
}
export const regionOpen = (id, state = S()) => !!REGIONS[id] && E.townRank(state) >= REGIONS[id].rank;
/** Clases que hay en la ciudad: [{ id, level (oficio 1..5), classLevel (1..10), tiredMs }] (tiredMs > 0: descansando). */
export function cityClasses(state = S(), now = Date.now()) {
  const e = expState(state);
  return K.cityClasses(state, now).map(r => ({ ...r, tiredMs: Math.max(0, (e.tired[r.id] || 0) - now) }));
}
/** Grupo por defecto: el último elegido (lo que siga disponible) y después por prioridad y nivel. */
export function defaultParty(state = S(), now = Date.now()) {
  const max = Math.max(0, partySlots(state) - 1);
  const ok = cityClasses(state, now).filter(r => !r.tiredMs);
  const ids = ok.map(r => r.id);
  const out = (expState(state).party || []).filter(id => ids.includes(id)).slice(0, max);
  const rest = ok.filter(r => !out.includes(r.id)).sort((a, b) => b.level - a.level || PRIORITY.indexOf(a.id) - PRIORITY.indexOf(b.id));
  for (const r of rest) { if (out.length >= max) break; out.push(r.id); }
  return out;
}
/** Equipo por defecto: lo que hay, en orden de utilidad, hasta los lugares del Taller. */
export function defaultEquip(state = S()) {
  const max = equipSlots(state), have = state.equipment || {};
  return ['cuerda', 'carreta', 'lona', 'pala', 'botiquin', 'farol'].filter(id => (have[id] || 0) > 0).slice(0, max);
}
/** Estado de una región para el mapa: { id, name, tier, rank, open, zone (próxima), explored (0..5), stars, done }. */
export function regionInfo(id, state = S()) {
  const e = expState(state), rg = REGIONS[id], st = e.regions[id];
  const explored = Math.max(0, Math.min(5, st.zone - 1));
  return { id, name: rg.name, tier: rg.tier, rank: rg.rank, open: regionOpen(id, state), zone: Math.min(5, st.zone), explored, done: explored >= 5, stars: { ...st.stars } };
}
const freeShortToday = (state = S()) => expState(state).freeDay !== todayStr();

/**
 * Todo lo que necesita el panel y el HUD:
 * { hasBase, canNormal, canShort, reason, reasonShort, prov, provCap, provMax, provTake, partySlots, cargoMax, equipSlots,
 *   tired:{rol:ms}, roles, party, equip, regions, freeShort, active, zones, expansion }
 */
export function expeditionStatus(state = S(), now = Date.now()) {
  const e = expState(state);
  const base = hasBase(state);
  const prov = state.prov || 0;
  const active = e.active && !e.active.ended ? e.active : null;
  const roles = cityClasses(state, now);
  const tired = Object.fromEntries(roles.filter(r => r.tiredMs).map(r => [r.id, r.tiredMs]));
  const pm = provMax(state);
  let reason = '', reasonShort = '';
  if (!base) reason = reasonShort = 'Primero construí la Casa de Expediciones';
  else if (active) reason = reasonShort = 'Hay una salida en curso';
  if (!reason && prov < EXP.provMinNormal) reason = `Hacen falta ${EXP.provMinNormal} provisiones para salir (hay ${prov})`;
  if (!reasonShort && !freeShortToday(state)) reasonShort = 'La salida corta de hoy ya se hizo: mañana hay otra';
  const daily = dailyInfo(state, now);
  let reasonDaily = !base ? 'Primero construí la Casa de Expediciones' : active ? 'Hay una salida en curso' : '';
  if (!reasonDaily && daily.done) reasonDaily = 'La Expedición del día ya se hizo: mañana hay otra';
  const ex = E.expansionStatus(state);
  return {
    hasBase: base, canNormal: !reason, canShort: !reasonShort, reason, reasonShort, canDaily: !reasonDaily, reasonDaily, daily,
    prov, provCap: E.provCap(state, now), provMax: pm, provTake: Math.min(pm, prov),
    partySlots: partySlots(state), cargoMax: cargoMax([], state), equipSlots: equipSlots(state),
    tired, roles, party: defaultParty(state, now), equip: defaultEquip(state),
    regions: REGION_IDS.map(id => regionInfo(id, state)), freeShort: base && freeShortToday(state) && !active,
    active: active ? { region: active.region, zone: active.zone, kind: active.kind, steps: active.steps, name: REGIONS[active.region]?.name, daily: active.city?.daily || null } : null,
    zones: E.zonesExplored(state), expansion: ex ? { missingZones: ex.missingZones || 0, ok: ex.ok, reason: ex.reason } : null,
  };
}
/** Globito del botón Expedición: hay salida corta gratis o el grupo está listo para una normal (o hay una para retomar). */
export function expeditionBadge(state = S()) {
  const st = expeditionStatus(state);
  if (!st.hasBase) return 0;
  if (st.active) return 1;
  return (st.freeShort ? 1 : 0) + (st.canNormal ? 1 : 0);
}

// ---------- salir ----------
/** Modificadores del motor que salen de la ciudad (exp-rules newRun mods). */
function cityMods(party, equip, state = S(), { region, kind, tutorial, daily } = {}) {
  let stars = 0;
  try { stars = E.rankStatus(state).stars; } catch {}
  const cb = combatState(state);
  // escolta para la pelea: roles que hay en la ciudad y no salieron (los de nivel más alto primero)
  const escort = cityClasses(state).filter(r => !party.includes(r.id)).sort((a, b) => b.level - a.level).map(r => r.id);
  const mods = {
    // nivel de oficio (decisiones) y de clase (combate) de los que salen y de la escolta; el líder con su nivel real
    tier: Object.fromEntries([...party, ...escort].map(id => [id, Math.max(1, K.classTier(id, state))])),
    classLevel: Object.fromEntries([...party, ...escort].map(id => [id, Math.max(1, K.memberLevel(id, state))])),
    picks: Object.fromEntries([...party, ...escort].map(id => [id, K.memberInfo(id, state).picks])),
    leader: K.leaderMods(state),
    cargoMax: cargoMax(equip, state),
    encantoStars: stars,
    vision: (() => { try { return E.monumentBonus('vision', state); } catch { return 0; } })(),   // Faro (+1)
    combatWins: { ...cb.wins }, escort, elements: (state.story?.elements || []).slice(),
  };
  // la primera pelea es guiada: la de los lobos del Bosque del Arroyo, en la primera salida normal al Bosque (E6)
  if (kind === 'normal' && region === 'bosque' && !daily && !tutorial && !cb.guided && !cb.fights) mods.firstFight = FIRST_FIGHT;
  return mods;
}

// ---------- combate (El Quiebre, paso 5; DESIGN-COMBAT.md §13) ----------
/** La primera pelea, guiada (plan §E6): los lobos de ojos brillantes del Bosque del Arroyo. */
export const FIRST_FIGHT = 'bosque_claro';
/** Página del diario que deja la primera victoria contra un encuentro común (los jefes traen la suya en reward.page). */
export const FIGHT_PAGES = { bosque_claro: 'p2' };
/**
 * state.combat = { wins: {enc: n}, losses: {enc: n}, retreats: {enc: n}, fights, quick, xp, guided } (idempotente).
 * xp: experiencia de quien lidera (la usa el paso 5b para el nivel). guided: ya se jugó la primera pelea guiada.
 */
export function combatState(state = S()) {
  if (!state.combat || typeof state.combat !== 'object') state.combat = {};
  const c = state.combat;
  for (const k of ['wins', 'losses', 'retreats']) if (!c[k] || typeof c[k] !== 'object') c[k] = {};
  for (const k of ['fights', 'quick', 'xp']) c[k] = Math.max(0, Number(c[k]) || 0);
  c.guided = !!c.guided;
  return c;
}
/**
 * Acredita una pelea apenas termina (la expedición sigue): cuenta victorias, derrotas y retiradas, suma la experiencia
 * de quien lidera, da la página y la marca de historia, y emite combat:won · combat:lost · combat:retreat (la historia
 * y la telemetría escuchan). El botín ya está en la carga de la salida. Idempotente por pelea (fight.credited).
 */
export function creditFight(run, fight, state = S()) {
  if (!fight || fight.credited) return null;
  fight.credited = true;
  const cb = combatState(state);
  const enc = fight.enc;
  const first = !cb.fights;
  cb.fights++;
  cb.xp += fight.xp || 0;
  // la pelea da su experiencia al líder y a cada clase que peleó (paso 5b)
  try { K.creditFightXp(run ? R.fightParty(run) : [], fight.xp || 0, state); } catch (err) { console.warn('[expedition] xp de clase', err); }
  if (fight.quick) cb.quick++;
  cb.guided = true;   // la guía es una sola: la primera pelea, sea cual sea
  const bag = fight.outcome === 'win' ? cb.wins : fight.outcome === 'lose' ? cb.losses : cb.retreats;
  const firstWin = fight.outcome === 'win' && !cb.wins[enc];
  bag[enc] = (bag[enc] || 0) + 1;
  const grant = {};
  const page = fight.page || (firstWin ? FIGHT_PAGES[enc] : null);
  if (page && !state.story?.pages?.[page]) grant.page = page;
  if (Object.keys(grant).length) store.grant(grant, 'combat');
  if (fight.flag) { state.story ||= {}; state.story.flags ||= {}; state.story.flags[fight.flag] = Date.now(); }
  store.inc('combats');
  if (fight.outcome === 'win') store.inc('combatWins');
  store.markDirty();
  const ev = fight.outcome === 'win' ? 'combat:won' : fight.outcome === 'lose' ? 'combat:lost' : 'combat:retreat';
  const payload = {
    enc, region: run?.region, kind: ENCOUNTERS[enc]?.kind || 'comun', outcome: fight.outcome, reason: fight.reason, turns: fight.turns || 0,
    stars: fight.stars || 0, quick: !!fight.quick, guided: !!fight.guided, attempt: fight.attempt || 1, combos: fight.combos || 0,
    downs: fight.downs || 0, first, page: grant.page || null,
  };
  bus.emit(ev, payload);
  return payload;
}

/**
 * Arma la salida: descuenta provisiones (normal) o usa la vianda del día (corta), gasta el equipo y guarda el run en
 * state.expedition.active. Devuelve { run } o { error }.
 */
export function startExpedition({ region = 'bosque', kind = 'normal', party = null, equip = null, seed = null, daily = false } = {}, state = S()) {
  const e = expState(state);
  const now = Date.now();
  const dInfo = daily ? dailyInfo(state, now) : null;
  if (dInfo) { kind = 'corta'; region = dInfo.region; }
  kind = kind === 'corta' ? 'corta' : 'normal';
  if (!REGIONS[region]) region = 'bosque';
  if (!hasBase(state)) return { error: 'Primero construí la Casa de Expediciones' };
  if (e.active && !e.active.ended) return { error: 'Hay una salida en curso' };
  if (dInfo && dInfo.done) return { error: 'La Expedición del día ya se hizo: mañana hay otra' };
  if (!dInfo && !regionOpen(region, state)) return { error: `${REGIONS[region].name} se abre en el rango ${E.rankName(REGIONS[region].rank)}` };
  if (kind === 'corta' && !dInfo && !freeShortToday(state)) return { error: 'La salida corta de hoy ya se hizo' };
  if (kind === 'normal' && (state.prov || 0) < EXP.provMinNormal) return { error: `Hacen falta ${EXP.provMinNormal} provisiones` };
  // grupo: un integrante por clase, que exista en la ciudad y no esté descansando, hasta los lugares de la Casa
  const avail = cityClasses(state, now).filter(r => !r.tiredMs).map(r => r.id);
  party = [...new Set((party || defaultParty(state, now)).map(toClass))].filter(id => avail.includes(id)).slice(0, Math.max(0, partySlots(state) - 1));
  // equipo: uno de cada, lo que haya, hasta los lugares del Taller
  const have = state.equipment || {};
  equip = [...new Set(equip || defaultEquip(state))].filter(id => EQUIPMENT[id] && (have[id] || 0) > 0).slice(0, equipSlots(state));
  const rs = e.regions[region];
  const recorrido = kind === 'normal' && rs.zone > 5;
  const zone = dInfo ? DAILY_ZONE : Math.min(5, rs.zone);
  const attempt = dInfo ? 0 : (e.attempts[region] = (e.attempts[region] || 0) + 1);
  const tutorial = !dInfo && kind === 'corta' && region === 'bosque' && !(state.stats.expeditions > 0) && !e.tutorialShort;
  if (dInfo) seed = dInfo.seed;
  else if (seed == null) seed = tutorial ? TUTORIAL_SEED : hashSeed(region, zone, attempt, state.created || 0, kind);
  let prov;
  if (kind === 'normal') {
    prov = Math.min(provMax(state), state.prov || 0);
    store.spend({ prov }, 'expedition');
  } else {
    prov = EXP.kinds.corta.prov;
    if (dInfo) e.dailyStarted = dInfo.day;
    else e.freeDay = todayStr();
    if (tutorial) e.tutorialShort = true;
  }
  if (equip.length) store.spend({ equip: Object.fromEntries(equip.map(id => [id, 1])) }, 'expedition');
  const run = R.newRun({ region, zone, kind, seed, party, equip, prov, mods: cityMods(party, equip, state, { region, kind, tutorial, daily: !!dInfo }) });
  run.city = { recorrido: recorrido && !dInfo, tutorial, at: now, daily: dInfo ? dInfo.day : null };
  // la mina sellada del Cerro (L1): el objetivo de la salida normal es la mina, para encontrar el Núcleo o volver a elegir
  const mine = kind === 'normal' && !dInfo && region === 'cerro' ? mineObjective(state) : null;
  if (mine) placeMine(run, mine);
  e.active = run;
  e.party = party.slice();
  store.markDirty();
  bus.emit('expedition:started', { region, zone, kind, party: run.party.slice(), equip: run.equip.slice(), prov: run.prov, daily: run.city.daily });
  return { run };
}
/**
 * Pone la mina sellada como objetivo de la salida (un lugar lejano). Si el mapa tenía "juntar", elige una casilla al
 * fondo; el resto del mapa queda igual. mode: 'nucleo' (la primera vez) o 'revisit' (volver a elegir la extracción).
 */
export const MINE_NAME = 'la mina sellada';
function placeMine(run, mode) {
  const o = run.objective;
  let cell = o.cell;
  if (!cell) {
    const [lo, hi] = EXP.kinds.normal.objDepth;
    const cands = run.cells.map((c, i) => i).filter(i => { const c = run.cells[i]; return !c.band && c.depth >= lo && c.depth <= hi + 1 && (c.content === 'vacio' || c.content === 'recurso'); });
    const i = cands.length ? cands[run.seed % cands.length] : run.cells.reduce((b, c, k) => (c.depth > run.cells[b].depth ? k : b), 0);
    cell = [i % run.w, (i / run.w) | 0];
  }
  const c = run.cells[cell[1] * run.w + cell[0]];
  c.content = 'objetivo'; c.sub = 'lugar'; c.mina = true;
  run.objective = { type: 'lugar', name: MINE_NAME, cell: cell.slice(), hint: (o.hint || cell).slice(), known: false, done: false, mina: mode };
}
/** Salida en curso guardada (para retomarla) o null. */
export function activeRun(state = S()) {
  const e = expState(state);
  return e.active && !e.active.ended && e.active.v === 1 ? e.active : null;
}

// ---------- volver ----------
/** Casillas lejanas (profundidad 7+) pisadas en la salida. */
const farCells = (run) => run.cells.filter(c => c.visited && ringOf(c.depth) === 2).length;
/**
 * Acredita lo que trajeron (materiales, planos, hallazgos, colonos, gemas y cofre de 3★, provisiones que sobran),
 * avanza la zona si se cumplió el objetivo, deja cansado al grupo si fracasó y emite los eventos.
 * Idempotente: un run ya acreditado devuelve el mismo resumen. Devuelve el resumen para el modal.
 */
export function finishExpedition(run, state = S()) {
  const e = expState(state);
  if (!run) return null;
  if (run.city?.summary) return run.city.summary;
  const res = R.result(run);
  const now = Date.now();
  run.city = run.city || {};
  const L = res.loot;
  // peleas que no se acreditaron al terminar (volver en medio de una pelea cuenta como retirada)
  for (const f of run.fights || []) if (!f.credited) creditFight(run, f, state);
  // eventos de región y monumentos (reemplazan a los de los minijuegos, Fase 5): materiales ×, cofre de 3★ con segunda
  // tirada en "Lluvia de Cofres", hallazgos dobles en su fin de semana, Museo (+50% de chance de un hallazgo más) y la
  // experiencia de la salida con el Observatorio y el confort de Mi Casa
  const mult = (k) => { try { return eventMult(k) || 1; } catch { return 1; } };
  const matMult = mult('expMats') * mult('region_' + run.region);
  const mats = {};
  for (const [id, n] of Object.entries(L.mats || {})) mats[id] = Math.round((n || 0) * matMult);
  const reward = { mats, planos: L.planos || 0, colonos: L.colonos || 0, gems: res.gems || 0 };
  if (res.chest || (res.starCount === 3 && mult('chestDrop') > 1 && Math.random() < EXP.chestAt3 * (mult('chestDrop') - 1))) reward.chest = 'madera';
  let xpBonus = 0;
  try { xpBonus = comfortInfo().xpBonus || 0; } catch {}
  reward.xp = run.prototype ? 0 : Math.round((EXP_XP.base + EXP_XP.perStar * res.starCount) * (1 + xpBonus));
  if (run.kind === 'normal' && res.reason === 'volvio' && res.provLeft > 0) reward.prov = res.provLeft;
  const got = store.grant(reward, 'expedition');
  // experiencia de clase y del líder (paso 5b): la de la salida, a quien fue y a quien lidera
  if (!run.prototype) { try { K.creditExpeditionXp(run.party, reward.xp, state); } catch (err) { console.warn('[expedition] xp de clase', err); } }
  const finds = [];
  const findN = Math.max(1, Math.round(mult('stickers')));
  for (const f of L.finds || []) { const o = store.grant({ stickers: { n: findN, minStars: f.stars, region: run.region } }, 'expedition'); finds.push(...(o.stickers || [])); }
  let museo = 0;
  try { museo = E.monumentBonus('stickers', state); } catch {}
  if (museo > 0 && (L.finds || []).length && Math.random() < museo) finds.push(...(store.grant({ stickers: { n: 1, region: run.region } }, 'expedition').stickers || []));
  // zonas
  let zoneExplored = false, regionDone = false;
  const rs = e.regions[run.region];
  if (run.kind === 'normal' && rs) {
    rs.stars[run.zone] = Math.max(rs.stars[run.zone] || 0, res.starCount);
    if (res.objectiveDone && !run.city.recorrido && rs.zone === run.zone && rs.zone <= 5) {
      rs.zone++;
      zoneExplored = true;
      regionDone = rs.zone > 5;
    }
  }
  // cansancio
  if (res.reason !== 'volvio') {
    const until = now + tiredMinutes(state) * MIN;
    for (const id of run.party) e.tired[id] = until;
  }
  const far = farCells(run);
  store.inc('expeditions');
  if (res.starCount) store.inc('expStars', res.starCount);
  if (far) store.inc('expFar', far);
  // Expedición del día: botín en puntos para el ranking y premio por participar (una vez por día)
  let daily = null;
  if (run.city.daily) {
    const loot = { mats: { ...reward.mats }, planos: reward.planos || 0, finds: finds.length, colonos: reward.colonos || 0 };
    store.grant(DAILY_PRIZE, 'expedition:daily');
    const prize = { ...DAILY_PRIZE };
    daily = { day: run.city.daily, region: run.region, score: dailyScore(loot, res.starCount), stars: res.starCount, loot, prize };
    e.daily = daily;
  }
  const ex = E.expansionStatus(state);
  const summary = {
    daily,
    ...res, provBack: got.prov || 0, finds, zoneExplored, regionDone, recorrido: !!run.city.recorrido,
    regionName: REGIONS[run.region]?.name, zonesTotal: E.zonesExplored(state),
    missingZones: ex ? ex.missingZones || 0 : 0, canExpand: !!ex?.ok, far,
  };
  run.city.summary = summary;
  e.last = summary;
  e.active = null;
  store.markDirty();
  bus.emit('expedition:finished', {
    region: run.region, zone: run.zone, kind: run.kind, stars: res.starCount, loot: L, reason: res.reason, steps: res.steps,
    objectiveDone: res.objectiveDone, party: run.party.slice(), equip: run.equip.slice(), far,
    daily: daily ? { day: daily.day, region: daily.region, score: daily.score, stars: daily.stars, loot: daily.loot } : null,
  });
  // la mina: el Núcleo de Raíz (la primera vez) o la elección de extracción otra vez (raiz.js emite 'raiz:found')
  if (run.objective?.mina && res.objectiveDone) {
    const f = foundNucleo(state, now, { revisit: run.objective.mina === 'revisit' });
    summary.nucleo = { first: f.first, revisit: run.objective.mina === 'revisit' };
  }
  if (zoneExplored) bus.emit('expedition:zone', { region: run.region, zone: run.zone, total: summary.zonesTotal });
  if (regionDone) bus.emit('expedition:region', { region: run.region });
  return summary;
}

// ---------- qué da cada nivel (ficha del edificio y panel) ----------
// Decisión que mejor muestra cada rol: [peligro, opción].
const CLASS_SAMPLE = { cazador: ['lobos', 'silencio'], forjador: ['rio', 'cruzar'], monje: ['tormenta', 'seguir'], guerrero: ['derrumbe', 'despejar'] };
const SAMPLE_TEXT = { lobos: 'pasar en silencio junto a los lobos', rio: 'cruzar un río', tormenta: 'seguir con tormenta', derrumbe: 'despejar un derrumbe' };
/** Probabilidad que se ve en la decisión típica de la clase (zona 1 del Bosque, sin equipo). null si no tiene una. */
export function classChance(cls, level) {
  cls = toClass(cls);
  const sm = CLASS_SAMPLE[cls];
  if (!sm || level < 1) return null;
  const hz = HAZARDS[sm[0]], opt = hz.options.find(o => o.id === sm[1]);
  const fake = { party: [cls], tier: { [cls]: level }, equip: [], mods: {}, zone: 1, region: 'bosque', care: 0 };
  return { p: R.optionChance(fake, hz, opt).p, text: SAMPLE_TEXT[sm[0]], hazard: sm[0] };
}
/** @deprecated nombre de antes del paso 5b. */
export const roleChance = classChance;
/** Materiales por casilla de recurso con el Saqueador (anillo cercano). */
const gatherAmount = (level) => EXP.ringAmount[0] + (level > 0 ? 1 + Math.floor(level / 2) : 0);
/** Líneas "qué da este edificio en este nivel" para la expedición: [{ key, label, value, text }]. */
export function cycleEffects(id, level) {
  const out = [];
  const add = (key, label, value, text) => out.push({ key, label, value, text: text ?? `${label}: ${value}` });
  const rc = (cls) => {
    const c = classChance(cls, level);
    if (c) add('p', `${CLASSES[cls].name} ${level}`, `${c.p}%`, `${CLASSES[cls].name} ${level}: ${c.text} · ${c.p}%`);
  };
  switch (id) {
    case 'casa_exp':
      add('slots', 'Lugares en el grupo', E.cycleValue(id, 'slots', level), `Grupo: quien lidera + ${E.cycleValue(id, 'slots', level) - 1}`);
      add('provMax', 'Provisiones por salida', E.cycleValue(id, 'provMax', level));
      rc('cazador');
      add('cap', 'Depósito', 40 + 20 * level, `Depósito: hasta ${40 + 20 * level} provisiones`);
      if (level >= 3) add('mirador', 'Mirador', 'radio 4', 'Desde un mirador se ve más lejos (radio 4)');
      break;
    case 'taller':
      rc('forjador');
      add('equip', 'Equipo por salida', E.cycleValue(id, 'equipSlots', level));
      break;
    case 'establo':
      rc('monje');
      add('cargo', 'Carga del grupo', EXP.cargoBase + E.cycleValue(id, 'cargo', level));
      if (level >= 2) add('carreta', 'Carreta', 'se puede fabricar', `Se puede fabricar la Carreta (+${carretaCargo()} de carga)`);
      break;
    case 'dispensario':
      add('morale', 'Ánimo del grupo', EXP.morale + EXP.moraleSanidad, `Curandero ${level}: ánimo ${EXP.morale + EXP.moraleSanidad} y mejor descanso`);
      add('tired', 'Descanso tras un fracaso', `${E.cycleValue(id, 'tiredMin', level)} min`);
      if (level >= 3) add('atender', 'Atender', '+2 ánimo', 'Una vez por salida: Atender (+2 de ánimo)');
      break;
    case 'invernadero': {
      const d = BUILDING_BY_ID[id];
      const n = Math.max(1, Math.round(E.cycleValue(id, 'mat', level) * (raizMult() || 0.5)));
      add('mat', 'Hierbas', n, `${n} de hierbas cada ${Math.round(d.prod.cycle / 60)} min (según la extracción de la Raíz)`);
      break;
    }
    case 'huerta': case 'tambo': case 'molino': case 'conservera': {
      const d = BUILDING_BY_ID[id];
      add('prov', 'Provisiones', E.cycleValue(id, 'prov', level), `${E.cycleValue(id, 'prov', level)} provisiones cada ${Math.round(d.prod.cycle / 60)} min`);
      if (id === 'huerta') add('gather', 'Saqueador', `${gatherAmount(level)} por recurso`, `Saqueador ${level}: ${gatherAmount(level)} de material por casilla cercana (la mejor Huerta)`);
      break;
    }
    default: break;
  }
  return out;
}
/** Para la ficha: qué cambia en la expedición al mejorar `b` → ['Forjador 2: cruzar un río · 75% → 80%', ...]. */
export function cycleUpgradeLines(b) {
  if (!CYCLE[b.id] || (b.level || 1) >= 5) return [];
  const a = cycleEffects(b.id, b.level || 1), z = cycleEffects(b.id, (b.level || 1) + 1);
  const lines = [];
  for (const n of z) {
    const o = a.find(x => x.key === n.key);
    if (!o) lines.push(n.text);
    else if (String(o.value) !== String(n.value)) lines.push(n.key === 'p' ? `${n.label}: ${ROLE_SAMPLE_TEXT(b.id)} · ${o.value} → ${n.value}` : `${n.label}: ${o.value} → ${n.value}`);
  }
  return lines;
}
function ROLE_SAMPLE_TEXT(id) {
  const role = toClass(CYCLE[id]?.role), s = role && CLASS_SAMPLE[role];
  return s ? SAMPLE_TEXT[s[0]] : '';
}

// ---------- Taller: equipo y reservas ----------
/** ¿Se puede fabricar? kind: 'equip' | 'reserve'. { ok, reason, cost, have, max } */
export function craftStatus(kind, id, state = S()) {
  const rec = kind === 'equip' ? EQUIP_RECIPES[id] : RESERVES[id];
  if (!rec) return { ok: false, reason: '???' };
  const have = (kind === 'equip' ? state.equipment : state.reserves)?.[id] || 0;
  const out = { cost: rec.cost, have, max: kind === 'reserve' ? RESERVE_CAP : null };
  if (lv('taller', state) < 1) return { ...out, ok: false, reason: 'Hace falta el Taller' };
  if (kind === 'reserve' && E.townRank(state) < RESERVES_RANK) return { ...out, ok: false, reason: `Desde el rango ${E.rankName(RESERVES_RANK)}`, locked: true };
  if (kind === 'equip' && rec.establo && lv('establo', state) < rec.establo) return { ...out, ok: false, reason: `Pide el Establo nivel ${rec.establo}`, locked: true };
  if (kind === 'reserve' && have >= RESERVE_CAP) return { ...out, ok: false, reason: `Tope de ${RESERVE_CAP}` };
  if (!store.hasMats(rec.cost.mats)) return { ...out, ok: false, reason: 'Faltan materiales', mats: true };
  if (!store.canAfford(rec.cost)) return { ...out, ok: false, reason: 'No te alcanza', poor: true };
  return { ...out, ok: true };
}
/** Fabrica una unidad (al instante). Emite craft:done {kind, id, n}. Devuelve { ok } o { error }. */
export function craft(kind, id, state = S()) {
  const st = craftStatus(kind, id, state);
  if (!st.ok) return { error: st.reason };
  if (!store.spend(st.cost, 'craft:' + id)) return { error: 'No te alcanza' };
  store.grant(kind === 'equip' ? { equip: { [id]: 1 } } : { reserves: { [id]: 1 } }, 'craft');
  store.inc('crafted');
  bus.emit('craft:done', { kind, id, n: 1 });
  return { ok: true };
}
export { EQUIP_IDS, RESERVE_IDS };

// ---------- arranque ----------
let inited = false;
export function initExpedition() {
  expState();
  K.initClasses();
  if (inited) return;
  inited = true;
  // primera cosecha: la primera Huerta arranca con dos tandas listas (el tutorial pide 4 provisiones enseguida)
  bus.on('building:built', ({ b } = {}) => {
    const s = S();
    if (b?.id !== 'huerta' || s.stats.provCollected > 0 || s.tutorial?.firstHarvest) return;
    s.tutorial ||= {};
    s.tutorial.firstHarvest = true;
    b.lastCollect = Math.min(b.lastCollect, Date.now() - 2 * BUILDING_BY_ID.huerta.prod.cycle * 1000);
    store.markDirty();
  });
}
