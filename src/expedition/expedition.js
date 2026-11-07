// Expedición ↔ ciudad (DESIGN-CORE.md §2.3, §2.4, §2.9, §2.11, §5): lee la ciudad, arma la salida (provisiones del
// depósito, grupo según los edificios, equipo del Taller, cansancio), acredita el botín, avanza las zonas (que abren
// terreno), lleva la salida corta gratis del día y fabrica en el Taller. Emite los eventos de bus del contrato.
//   initExpedition() · expeditionStatus() · startExpedition({region, kind, party, equip}) · finishExpedition(run)
//   zonesExplored() · roleLevel(role) · cycleEffects(id, level) · cycleUpgradeLines(b) · roleChance(role, level)
//   craftStatus(kind, id) · craft(kind, id) · expeditionBadge()
import { bus } from '../core/bus.js';
import { store, todayStr } from '../core/state.js';
import {
  CYCLE, EQUIP_RECIPES, EQUIP_IDS, RESERVES, RESERVE_IDS, RESERVES_RANK, RESERVE_CAP, TIRED_MIN_NONE, BUILDING_BY_ID,
} from '../core/data.js';
import * as E from '../core/economy.js';
import { EXP, REGIONS, REGION_IDS, ROLES, ROLE_IDS, EQUIPMENT, HAZARDS, ringOf } from './exp-data.js';
import { hashSeed } from './exp-gen.js';
import * as R from './exp-rules.js';
import { eventMult } from '../season/events.js';
import { comfortInfo } from '../home/furniture.js';

export { zonesExplored, roleLevel } from '../core/economy.js';

const S = () => store.state;
const MIN = 60e3;
// Primera salida corta (tutorial t5): mapa fijo del Bosque con "el aserradero abandonado" de objetivo y madera cerca
// (semilla buscada con exp-gen: 4 casillas de madera a profundidad ≤ 3 y 2 peligros lejos de la base).
export const TUTORIAL_SEED = 110;
// Experiencia por salida terminada (la daban los minijuegos; Fase 5): base + por estrella, × Observatorio y Mi Casa.
export const EXP_XP = { base: 10, perStar: 5 };
// Orden en que se arma el grupo por defecto (si no hay uno elegido antes).
const ROLE_PRIORITY = ['exploracion', 'ingenieria', 'guia', 'sanidad', 'recoleccion'];

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
/** Roles que existen en la ciudad: [{ id, level, tiredMs }] (tiredMs > 0: descansando). */
export function cityRoles(state = S(), now = Date.now()) {
  const e = expState(state);
  return ROLE_IDS.map(id => ({ id, level: E.roleLevel(id, state, now), tiredMs: Math.max(0, (e.tired[id] || 0) - now) }))
    .filter(r => r.level > 0);
}
/** Grupo por defecto: el último elegido (lo que siga disponible) y después por prioridad y nivel. */
export function defaultParty(state = S(), now = Date.now()) {
  const max = Math.max(0, partySlots(state) - 1);
  const ok = cityRoles(state, now).filter(r => !r.tiredMs);
  const ids = ok.map(r => r.id);
  const out = (expState(state).party || []).filter(id => ids.includes(id)).slice(0, max);
  const rest = ok.filter(r => !out.includes(r.id)).sort((a, b) => b.level - a.level || ROLE_PRIORITY.indexOf(a.id) - ROLE_PRIORITY.indexOf(b.id));
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
  const roles = cityRoles(state, now);
  const tired = Object.fromEntries(roles.filter(r => r.tiredMs).map(r => [r.id, r.tiredMs]));
  const pm = provMax(state);
  let reason = '', reasonShort = '';
  if (!base) reason = reasonShort = 'Primero construí la Casa de Expediciones';
  else if (active) reason = reasonShort = 'Hay una salida en curso';
  if (!reason && prov < EXP.provMinNormal) reason = `Hacen falta ${EXP.provMinNormal} provisiones para salir (hay ${prov})`;
  if (!reasonShort && !freeShortToday(state)) reasonShort = 'La salida corta de hoy ya se hizo: mañana hay otra';
  const ex = E.expansionStatus(state);
  return {
    hasBase: base, canNormal: !reason, canShort: !reasonShort, reason, reasonShort,
    prov, provCap: E.provCap(state, now), provMax: pm, provTake: Math.min(pm, prov),
    partySlots: partySlots(state), cargoMax: cargoMax([], state), equipSlots: equipSlots(state),
    tired, roles, party: defaultParty(state, now), equip: defaultEquip(state),
    regions: REGION_IDS.map(id => regionInfo(id, state)), freeShort: base && freeShortToday(state) && !active,
    active: active ? { region: active.region, zone: active.zone, kind: active.kind, steps: active.steps, name: REGIONS[active.region]?.name } : null,
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
function cityMods(party, equip, state = S()) {
  let stars = 0;
  try { stars = E.rankStatus(state).stars; } catch {}
  return {
    roleLevel: Object.fromEntries(party.map(id => [id, Math.max(1, E.roleLevel(id, state))])),
    cargoMax: cargoMax(equip, state),
    encantoStars: stars,
  };
}
/**
 * Arma la salida: descuenta provisiones (normal) o usa la vianda del día (corta), gasta el equipo y guarda el run en
 * state.expedition.active. Devuelve { run } o { error }.
 */
export function startExpedition({ region = 'bosque', kind = 'normal', party = null, equip = null, seed = null } = {}, state = S()) {
  const e = expState(state);
  const now = Date.now();
  kind = kind === 'corta' ? 'corta' : 'normal';
  if (!REGIONS[region]) region = 'bosque';
  if (!hasBase(state)) return { error: 'Primero construí la Casa de Expediciones' };
  if (e.active && !e.active.ended) return { error: 'Hay una salida en curso' };
  if (!regionOpen(region, state)) return { error: `${REGIONS[region].name} se abre en el rango ${E.rankName(REGIONS[region].rank)}` };
  if (kind === 'corta' && !freeShortToday(state)) return { error: 'La salida corta de hoy ya se hizo' };
  if (kind === 'normal' && (state.prov || 0) < EXP.provMinNormal) return { error: `Hacen falta ${EXP.provMinNormal} provisiones` };
  // grupo: un integrante por rol, que exista en la ciudad y no esté descansando, hasta los lugares de la Casa
  const avail = cityRoles(state, now).filter(r => !r.tiredMs).map(r => r.id);
  party = [...new Set(party || defaultParty(state, now))].filter(id => avail.includes(id)).slice(0, Math.max(0, partySlots(state) - 1));
  // equipo: uno de cada, lo que haya, hasta los lugares del Taller
  const have = state.equipment || {};
  equip = [...new Set(equip || defaultEquip(state))].filter(id => EQUIPMENT[id] && (have[id] || 0) > 0).slice(0, equipSlots(state));
  const rs = e.regions[region];
  const recorrido = kind === 'normal' && rs.zone > 5;
  const zone = Math.min(5, rs.zone);
  const attempt = (e.attempts[region] = (e.attempts[region] || 0) + 1);
  const tutorial = kind === 'corta' && region === 'bosque' && !(state.stats.expeditions > 0) && !e.tutorialShort;
  if (seed == null) seed = tutorial ? TUTORIAL_SEED : hashSeed(region, zone, attempt, state.created || 0, kind);
  let prov;
  if (kind === 'normal') {
    prov = Math.min(provMax(state), state.prov || 0);
    store.spend({ prov }, 'expedition');
  } else {
    prov = EXP.kinds.corta.prov;
    e.freeDay = todayStr();
    if (tutorial) e.tutorialShort = true;
  }
  if (equip.length) store.spend({ equip: Object.fromEntries(equip.map(id => [id, 1])) }, 'expedition');
  const run = R.newRun({ region, zone, kind, seed, party, equip, prov, mods: cityMods(party, equip, state) });
  run.city = { recorrido, tutorial, at: now };
  e.active = run;
  e.party = party.slice();
  store.markDirty();
  bus.emit('expedition:started', { region, zone, kind, party: run.party.slice(), equip: run.equip.slice(), prov: run.prov });
  return { run };
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
  try { xpBonus = E.monumentBonus('gameXp', state) + (comfortInfo().xpBonus || 0); } catch {}
  reward.xp = run.prototype ? 0 : Math.round((EXP_XP.base + EXP_XP.perStar * res.starCount) * (1 + xpBonus));
  if (run.kind === 'normal' && res.reason === 'volvio' && res.provLeft > 0) reward.prov = res.provLeft;
  const got = store.grant(reward, 'expedition');
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
  const ex = E.expansionStatus(state);
  const summary = {
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
  });
  if (zoneExplored) bus.emit('expedition:zone', { region: run.region, zone: run.zone, total: summary.zonesTotal });
  if (regionDone) bus.emit('expedition:region', { region: run.region });
  return summary;
}

// ---------- qué da cada nivel (ficha del edificio y panel) ----------
// Decisión que mejor muestra cada rol: [peligro, opción].
const ROLE_SAMPLE = { exploracion: ['lobos', 'silencio'], ingenieria: ['rio', 'cruzar'], guia: ['tormenta', 'seguir'] };
const SAMPLE_TEXT = { lobos: 'pasar en silencio junto a los lobos', rio: 'cruzar un río', tormenta: 'seguir con tormenta' };
/** Probabilidad que se ve en la decisión típica del rol (zona 1 del Bosque, sin equipo). null si el rol no tiene una. */
export function roleChance(role, level) {
  const s = ROLE_SAMPLE[role];
  if (!s || level < 1) return null;
  const hz = HAZARDS[s[0]], opt = hz.options.find(o => o.id === s[1]);
  const fake = { party: [role], roleLevel: { [role]: level }, equip: [], mods: {}, zone: 1, region: 'bosque', care: 0 };
  return { p: R.optionChance(fake, hz, opt).p, text: SAMPLE_TEXT[s[0]], hazard: s[0] };
}
/** Materiales por casilla de recurso con Recolección (anillo cercano). */
const gatherAmount = (level) => EXP.ringAmount[0] + (level > 0 ? 1 + Math.floor(level / 2) : 0);
/** Líneas "qué da este edificio en este nivel" para la expedición: [{ key, label, value, text }]. */
export function cycleEffects(id, level) {
  const out = [];
  const add = (key, label, value, text) => out.push({ key, label, value, text: text ?? `${label}: ${value}` });
  const rc = (role) => {
    const c = roleChance(role, level);
    if (c) add('p', `${ROLES[role].name} ${level}`, `${c.p}%`, `${ROLES[role].name} ${level}: ${c.text} · ${c.p}%`);
  };
  switch (id) {
    case 'casa_exp':
      add('slots', 'Lugares en el grupo', E.cycleValue(id, 'slots', level), `Grupo: quien lidera + ${E.cycleValue(id, 'slots', level) - 1}`);
      add('provMax', 'Provisiones por salida', E.cycleValue(id, 'provMax', level));
      rc('exploracion');
      add('cap', 'Depósito', 40 + 20 * level, `Depósito: hasta ${40 + 20 * level} provisiones`);
      if (level >= 3) add('mirador', 'Mirador', 'radio 4', 'Desde un mirador se ve más lejos (radio 4)');
      break;
    case 'taller':
      rc('ingenieria');
      add('equip', 'Equipo por salida', E.cycleValue(id, 'equipSlots', level));
      break;
    case 'establo':
      rc('guia');
      add('cargo', 'Carga del grupo', EXP.cargoBase + E.cycleValue(id, 'cargo', level));
      if (level >= 2) add('carreta', 'Carreta', 'se puede fabricar', `Se puede fabricar la Carreta (+${carretaCargo()} de carga)`);
      break;
    case 'dispensario':
      add('morale', 'Ánimo del grupo', EXP.morale + EXP.moraleSanidad, `Sanidad ${level}: ánimo ${EXP.morale + EXP.moraleSanidad} y mejor descanso`);
      add('tired', 'Descanso tras un fracaso', `${E.cycleValue(id, 'tiredMin', level)} min`);
      if (level >= 3) add('atender', 'Atender', '+2 ánimo', 'Una vez por salida: Atender (+2 de ánimo)');
      break;
    case 'huerta': case 'tambo': case 'molino': case 'conservera': {
      const d = BUILDING_BY_ID[id];
      add('prov', 'Provisiones', E.cycleValue(id, 'prov', level), `${E.cycleValue(id, 'prov', level)} provisiones cada ${Math.round(d.prod.cycle / 60)} min`);
      if (id === 'huerta') add('gather', 'Recolección', `${gatherAmount(level)} por recurso`, `Recolección ${level}: ${gatherAmount(level)} de material por casilla cercana (la mejor Huerta)`);
      break;
    }
    default: break;
  }
  return out;
}
/** Para la ficha: qué cambia en la expedición al mejorar `b` → ['Ingeniería 2: cruzar un río · 75% → 80%', ...]. */
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
  const role = CYCLE[id]?.role, s = role && ROLE_SAMPLE[role];
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
