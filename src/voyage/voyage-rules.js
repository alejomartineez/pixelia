// Reglas de una salida de la Travesía por nodos (PLAN-FOTO §A1). Puro: sin DOM; la salida es JSON (se guarda tal cual).
//
//   newRun({ seed, island }) → run
//   choices(run) → ids de los nodos a los que se puede ir ahora
//   enter(run, nodeId) → { ok, events }: pelea/élite/jefe arman run.battle (combat-rules) y dejan
//     run.pending = { kind: 'combate' }; evento y campamento dejan su tarjeta en run.pending
//   endCombat(run, res) → cierra la pelea con el resultado del combate (combat-rules result(b)); ganar deja
//     run.pending = { kind: 'recompensa', options: [3] } (o termina la salida si era el jefe); caer o retirarse la
//     termina con la mitad del botín (salvo la reliquia que levanta al grupo una vez)
//   options(run) → las opciones de la tarjeta pendiente, con `can` y el efecto a la vista
//   choose(run, optionId) → aplica la opción (evento, campamento o recompensa)
//   leave(run) → volver a la aldea con todo lo juntado (se puede cuando no hay nada pendiente)
//
// La vida del grupo (run.squad) sigue de pelea en pelea. No hay provisiones ni relojes: se zarpa cuando se quiere.
// El combate se usa por su interfaz (newBattle / result); lo que la Travesía le cambia a la pelea (vida que llega,
// mejoras de la salida, enemigos de élite) se escribe sobre la pelea recién creada, como hace exp-rules con el cansancio.
import { ENCOUNTERS, ITEMS } from '../combat/combat-data.js';
import * as C from '../combat/combat-rules.js';
import { VOY, ISLANDS, EVENTS, RELICS, REWARDS } from './voyage-data.js';
import { generateMap, isFight } from './voyage-gen.js';

// ---------- azar de la salida (el estado va en run.rs) ----------
function rnd(run) {
  run.rs = (run.rs + 0x6D2B79F5) | 0;
  let t = run.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (run, list) => list[Math.floor(rnd(run) * list.length)];

// ---------- reliquias ----------
/** Los modificadores de todas las reliquias de la salida, juntos. */
export function relicMods(run) {
  const m = { afterFightHeal: 0, foeHp: 1, campBoth: false, revive: 0, lootMult: 1, campHeal: 1, equip: [] };
  for (const id of run.relics) {
    const d = RELICS[id]?.mods || {};
    m.afterFightHeal += d.afterFightHeal || 0;
    m.foeHp *= d.foeHp ?? 1;
    m.campBoth = m.campBoth || !!d.campBoth;
    m.revive = Math.max(m.revive, d.revive || 0);
    m.lootMult *= d.lootMult ?? 1;
    m.campHeal *= d.campHeal ?? 1;
    for (const it of d.equip || []) if (!m.equip.includes(it)) m.equip.push(it);
  }
  return m;
}
/** Llama a las funciones `on.<name>` de las reliquias (extensión para A3). */
function fire(run, name, ctx) {
  for (const id of run.relics) { try { RELICS[id]?.on?.[name]?.(run, ctx); } catch (e) { console.error('[voyage] reliquia', id, name, e); } }
}
const relicsLeft = (run) => Object.keys(RELICS).filter(id => !run.relics.includes(id));

// ---------- crear ----------
const battleCfg = (run, enc, seed) => ({
  encounter: enc, seed, party: run.party, level: run.level, element: run.element, elements: run.element ? [run.element] : [],
  classLevel: Object.fromEntries(run.party.map(c => [c, run.classLevel])),
});
export const squadIds = (run) => Object.keys(run.squad);
const members = (run) => Object.values(run.squad);

export function newRun({ seed = 1, island = 'bosque' } = {}) {
  const isl = ISLANDS[island] || ISLANDS.bosque;
  const run = {
    v: 1, seed: seed >>> 0, rs: (seed ^ 0x51ed270b) | 0, island: isl.id,
    map: generateMap({ seed, island: isl.id }),
    party: VOY.party.slice(), level: VOY.level, classLevel: VOY.classLevel, element: VOY.element,
    squad: {}, relics: [], items: [], loot: { mats: {} },
    pos: null, path: [], pending: null, battle: null, fights: [], log: [],
    nextFoe: 1, bossHp: 1, revived: false,
    ended: false, outcome: null, haul: null,
  };
  // la vida de cada uno sale del combate: se arma una pelea de muestra y se lee
  const probe = C.newBattle(battleCfg(run, Object.keys(isl.fights)[0], 1));
  for (const u of probe.units) if (u.side === 'ally' && !u.captive) run.squad[u.type] = { id: u.type, hp: u.maxHp, maxHp: u.maxHp, atk: 0, armor: 0, bonusHp: 0 };
  return run;
}

// ---------- efectos ----------
const addMats = (run, mats, events, why) => {
  const got = {};
  for (const [k, n] of Object.entries(mats || {})) if (n > 0) { run.loot.mats[k] = (run.loot.mats[k] || 0) + n; got[k] = n; }
  if (Object.keys(got).length) events.push({ type: 'mats', mats: got, why });
};
export const matsTotal = (run) => Object.values(run.loot.mats).reduce((a, n) => a + n, 0);
function heal(s, n) { const before = s.hp; s.hp = Math.min(s.maxHp, s.hp + Math.max(0, Math.round(n))); return s.hp - before; }
function hurt(s, n) { if (s.hp <= 0) return 0; const before = s.hp; s.hp = Math.max(1, s.hp - n); return before - s.hp; }
function grow(s, n) { s.maxHp = Math.max(1, s.maxHp + n); s.bonusHp += n; if (n > 0 && s.hp > 0) s.hp += n; s.hp = Math.min(s.hp, s.maxHp); }
export function giveRelic(run, id, events) {
  const left = relicsLeft(run);
  if (!left.length) return null;
  const got = id && left.includes(id) ? id : pick(run, left);
  run.relics.push(got);
  events.push({ type: 'relic', id: got });
  return got;
}
/** Aplica un efecto declarativo (voyage-data.js). Devuelve los eventos para la interfaz. */
export function applyFx(run, fx = {}, events = []) {
  const sq = run.squad, lead = sq.lider;
  if (fx.maxHpAll) { for (const s of members(run)) grow(s, fx.maxHpAll); events.push({ type: 'maxHp', n: fx.maxHpAll, who: 'all' }); }
  if (fx.maxHpLeader && lead) { grow(lead, fx.maxHpLeader); events.push({ type: 'maxHp', n: fx.maxHpLeader, who: 'lider' }); }
  if (fx.healAll) { let n = 0; for (const s of members(run)) n += heal(s, fx.healAll <= 1 ? Math.ceil(s.maxHp * fx.healAll) : fx.healAll); events.push({ type: 'heal', n }); }
  if (fx.dmgAll) { let n = 0; for (const s of members(run)) n += hurt(s, fx.dmgAll); events.push({ type: 'hurt', n, who: 'all' }); }
  if (fx.dmgLeader && lead) events.push({ type: 'hurt', n: hurt(lead, fx.dmgLeader), who: 'lider' });
  if (fx.atkAll) { for (const s of members(run)) s.atk += fx.atkAll; events.push({ type: 'atk', n: fx.atkAll, who: 'all' }); }
  if (fx.atkLeader && lead) { lead.atk += fx.atkLeader; events.push({ type: 'atk', n: fx.atkLeader, who: 'lider' }); }
  if (fx.atk && sq[fx.atk.who]) { sq[fx.atk.who].atk += fx.atk.n; events.push({ type: 'atk', n: fx.atk.n, who: fx.atk.who }); }
  if (fx.armor && sq[fx.armor.who]) { sq[fx.armor.who].armor += fx.armor.n; events.push({ type: 'armor', n: fx.armor.n, who: fx.armor.who }); }
  if (fx.loseMats) {
    const lost = {};
    for (const [k, n] of Object.entries(run.loot.mats)) { const d = Math.ceil(n * fx.loseMats); if (d > 0) { lost[k] = d; run.loot.mats[k] = n - d; if (!run.loot.mats[k]) delete run.loot.mats[k]; } }
    events.push({ type: 'lost', mats: lost });
  }
  if (fx.mats) addMats(run, fx.mats, events, 'fx');
  if (fx.useItem) { const i = run.items.indexOf(fx.useItem); if (i >= 0) run.items.splice(i, 1); events.push({ type: 'itemUsed', id: fx.useItem }); }
  if (fx.item && ITEMS[fx.item]) { run.items.push(fx.item); events.push({ type: 'item', id: fx.item }); }
  if (fx.relic) giveRelic(run, fx.relic === true ? null : fx.relic, events);
  if (fx.nextFoe) { run.nextFoe *= fx.nextFoe; events.push({ type: 'omen', what: 'nextFoe' }); }
  if (fx.bossHp) { run.bossHp *= fx.bossHp; events.push({ type: 'omen', what: 'bossHp' }); }
  return events;
}

// ---------- mapa ----------
export const nodeOf = (run, id) => run.map.nodes[id] || null;
export const currentNode = (run) => (run.pos == null ? null : nodeOf(run, run.pos));
/** Nodos a los que se puede ir ahora (ninguno con algo pendiente o la salida terminada). */
export function choices(run) {
  if (run.ended || run.pending) return [];
  return run.pos == null ? run.map.start.slice() : nodeOf(run, run.pos).next.slice();
}
/** Multiplicador de la vida enemiga de la pelea de un nodo: élite, reliquias, lo que dejó un evento. */
export function foeHpFor(run, node) {
  return (node.type === 'elite' ? VOY.elite.hp : 1) * relicMods(run).foeHp * (node.type === 'jefe' ? run.bossHp : run.nextFoe);
}
/** Arma la pelea de un nodo con el grupo tal como viene. */
export function makeBattle(run, node) {
  const m = relicMods(run);
  const b = C.newBattle({
    ...battleCfg(run, node.enc, C.hashSeed(run.seed, node.id, run.fights.length, 'travesia')),
    equip: [...new Set([...run.items, ...m.equip])].filter(id => ITEMS[id]),
  });
  for (const u of b.units) {
    const s = u.side === 'ally' && !u.captive ? run.squad[u.type] : null;
    if (!s) continue;
    u.maxHp = s.maxHp; u.atk += s.atk; u.armor = (u.armor || 0) + s.armor;
    u.hp = Math.max(1, Math.min(u.maxHp, s.hp > 0 ? s.hp : VOY.downHp));
  }
  const k = foeHpFor(run, node);
  if (k !== 1) {
    for (const u of b.units) if (u.side === 'enemy') u.maxHp = u.hp = Math.max(1, Math.round(u.hp * k));
    b.foe = { hp: (b.foe?.hp || 1) * k, atk: b.foe?.atk || 0 };   // para los refuerzos que entran después
  }
  b.voyage = { node: node.id, type: node.type };
  fire(run, 'battle', { battle: b, node });
  return b;
}
export function enter(run, nodeId) {
  const events = [];
  if (!choices(run).includes(nodeId)) return { ok: false, reason: 'unreachable', events };
  const node = nodeOf(run, nodeId);
  run.pos = nodeId; run.path.push(nodeId);
  events.push({ type: 'enter', node: nodeId, kind: node.type });
  fire(run, 'enter', { node });
  if (isFight(node.type)) {
    run.battle = makeBattle(run, node);
    run.pending = { kind: 'combate', node: nodeId, enc: node.enc };
  } else if (node.type === 'evento') run.pending = { kind: 'evento', node: nodeId, event: node.event };
  else run.pending = { kind: 'campamento', node: nodeId };
  return { ok: true, events };
}

// ---------- pelea ----------
export const activeBattle = (run) => (run?.pending?.kind === 'combate' ? run.battle : null);
function rewardOptions(run, node, mats) {
  const out = [];
  const left = relicsLeft(run);
  if (left.length && (node.type === 'elite' || rnd(run) < VOY.reward.relicChance)) out.push({ id: 'reliquia', relic: pick(run, left) });
  const pool = Object.values(REWARDS).filter(d => d.id !== 'botin' || Object.keys(mats).length);
  while (out.length < 3 && pool.length) {
    let x = rnd(run) * pool.reduce((a, d) => a + d.w, 0), i = 0;
    for (; i < pool.length - 1; i++) { x -= pool[i].w; if (x < 0) break; }
    const d = pool.splice(i, 1)[0];
    const who = d.who === 'any' ? pick(run, squadIds(run)) : null;
    out.push({ id: d.id, who, fx: d.fx({ who, mats, run }) });
  }
  return out;
}
function finish(run, outcome, events) {
  run.ended = true; run.outcome = outcome; run.pending = null; run.battle = null;
  const half = outcome === 'lose' || outcome === 'retreat';
  run.haul = { mats: Object.fromEntries(Object.entries(run.loot.mats).map(([k, n]) => [k, half ? Math.floor(n * VOY.loseLoot) : n]).filter(([, n]) => n > 0)) };
  fire(run, 'finish', { outcome });
  events.push({ type: 'end', outcome, haul: run.haul });
}
/**
 * Cierra la pelea en curso con su resultado (combat-rules result(b)). Sin resultado (pelea sin terminar) cuenta
 * como retirada. Devuelve { ok, fight, events }.
 */
export function endCombat(run, res = null, events = []) {
  const pd = run.pending;
  if (!pd || pd.kind !== 'combate') return { ok: false, reason: 'nofight', events };
  const b = run.battle, node = nodeOf(run, pd.node), m = relicMods(run);
  if (!res) { if (b && !b.ended) C.retreat(b); res = b ? C.result(b) : { enc: pd.enc, outcome: 'retreat', turns: 0, stars: 0, loot: { mats: {} } }; }
  // la vida con que cada uno sale de la pelea es la que lleva a la siguiente
  if (b) for (const s of members(run)) {
    const u = b.units.find(x => x.side === 'ally' && x.type === s.id);
    s.hp = u && u.alive !== false && u.hp > 0 ? Math.min(s.maxHp, u.hp) : 0;
  }
  // los objetos gastados en la pelea se van de la mochila (los que pone una reliquia vuelven solos)
  if (b?.items) for (const [id, n] of Object.entries(b.items)) if (n <= 0 && !m.equip.includes(id)) { const i = run.items.indexOf(id); if (i >= 0) run.items.splice(i, 1); }
  const win = res.outcome === 'win';
  const mats = {};
  if (win) for (const [k, n] of Object.entries(res.loot?.mats || {})) mats[k] = Math.max(1, Math.round(n * m.lootMult));
  const f = { node: node.id, type: node.type, enc: res.enc || pd.enc, outcome: res.outcome, turns: res.turns || 0, stars: res.stars || 0, mats };
  run.fights.push(f);
  events.push({ type: 'combatEnd', fight: { ...f } });
  run.battle = null;
  if (!win) {
    if (res.outcome === 'lose' && m.revive && !run.revived) {
      // la reliquia levanta al grupo una vez: la pelea se repite desde el principio
      run.revived = true;
      for (const s of members(run)) s.hp = Math.max(s.hp, Math.ceil(s.maxHp * m.revive));
      run.battle = makeBattle(run, node);
      events.push({ type: 'revive' });
      return { ok: true, fight: f, events };
    }
    finish(run, res.outcome === 'lose' ? 'lose' : 'retreat', events);
    return { ok: true, fight: f, events };
  }
  addMats(run, mats, events, 'combate');
  if (node.type !== 'jefe') run.nextFoe = 1;
  if (m.afterFightHeal) { let n = 0; for (const s of members(run)) if (s.hp > 0) n += heal(s, m.afterFightHeal); if (n) events.push({ type: 'heal', n, why: 'reliquia' }); }
  fire(run, 'fightWon', { fight: f, node });
  if (node.type === 'jefe') { finish(run, 'win', events); return { ok: true, fight: f, events }; }
  run.pending = { kind: 'recompensa', node: node.id, options: rewardOptions(run, node, mats) };
  return { ok: true, fight: f, events };
}

// ---------- tarjetas: evento, campamento, recompensa ----------
function canOption(run, o) {
  if (o.need?.item && !run.items.includes(o.need.item)) return false;
  if (o.need?.mats && matsTotal(run) < o.need.mats) return false;
  return true;
}
/** Opciones de la tarjeta pendiente: [{ id, fx, can, who?, relic? }]. */
export function options(run) {
  const pd = run.pending;
  if (!pd || run.ended) return [];
  if (pd.kind === 'evento') return EVENTS[pd.event].options.map(o => ({ id: o.id, fx: o.fx, need: o.need || null, can: canOption(run, o) }));
  if (pd.kind === 'campamento') {
    const m = relicMods(run);
    const rest = { healAll: Math.min(1, VOY.camp.heal * m.campHeal) }, train = { ...VOY.camp.train };
    return m.campBoth ? [{ id: 'ambos', fx: { ...train, ...rest }, can: true }]
      : [{ id: 'descansar', fx: rest, can: true }, { id: 'entrenar', fx: train, can: true }];
  }
  if (pd.kind === 'recompensa') return pd.options.map(o => ({ ...o, fx: o.id === 'reliquia' ? { relic: o.relic } : o.fx, can: true }));
  return [];
}
export function choose(run, optionId) {
  const events = [];
  const pd = run.pending;
  if (!pd || pd.kind === 'combate' || run.ended) return { ok: false, reason: 'nothing', events };
  const o = options(run).find(x => x.id === optionId);
  if (!o || !o.can) return { ok: false, reason: 'cant', events };
  run.pending = null;
  applyFx(run, o.fx, events);
  run.log.push({ node: pd.node, kind: pd.kind, pick: o.id });
  return { ok: true, events };
}
/** Saltear la recompensa (no elegir ninguna). */
export function skip(run) {
  if (run.pending?.kind !== 'recompensa') return { ok: false, events: [] };
  run.pending = null;
  return { ok: true, events: [] };
}
/** Volver a la aldea con todo lo juntado. En medio de una pelea cuenta como retirada. */
export function leave(run) {
  const events = [];
  if (run.ended) return { ok: false, events };
  if (run.pending?.kind === 'combate') return endCombat(run, null, events);
  finish(run, 'leave', events);
  return { ok: true, events };
}

// ---------- resumen ----------
export function summary(run) {
  const fights = run.fights.filter(f => f.outcome === 'win').length;
  return { outcome: run.outcome, nodes: run.path.length, fights, turns: run.fights.reduce((a, f) => a + f.turns, 0), relics: run.relics.slice(), haul: run.haul || { mats: { ...run.loot.mats } } };
}
/** Lo que se sabe del encuentro de un nodo, para la tarjeta. */
export const encounterOf = (node) => (node?.enc ? ENCOUNTERS[node.enc] : null);
