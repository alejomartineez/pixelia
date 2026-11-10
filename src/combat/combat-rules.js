// Combate táctico por turnos: motor puro (DESIGN-COMBAT.md). Sin three.js, sin DOM, sin store ni bus: se testea en
// Node. `b` (la pelea) es JSON puro: se guarda cada turno en state.expedition.active y se retoma. Mismo seed + mismas
// acciones = mismo resultado: toda la suerte sale de b.rs (estado del mulberry32).
//
//   newBattle({ encounter, seed, party, level, element, elements, leader, classLevel, picks, tools, equip, attempt }) → b
//     party: clases de los integrantes (src/combat/classes.js; los roles viejos se traducen solos)
//     level: nivel del líder (1..30) · leader: { cls, sub, picks } · classLevel: { clase: 1..10 } · picks: { clase: [ids] }
//   view(b)                       → lo que se ve: casillas, unidades, intenciones a la vista, objetivo, desafíos
//   move(b, unitId, x, y)         → { ok, why, events }
//   act(b, unitId, abilityId, x, y) → { ok, why, events }   (abilityId 'item:botiquin' usa un consumible)
//   endTurn(b)                    → { ok, events }   termina la fase del grupo
//   enemyTurn(b)                  → { ok, events }   golpes marcados, agua, refuerzos, movimiento y marcas nuevas
//   retreat(b)                    → { ok, events }
//   result(b)                     → { outcome, stars, challenges, loot, xp, morale, combos, ... }
//   quickResolve(opts)            → resultado de una pelea común ya ganada, sin jugarla
//   preview(b, unitId, abilityId, x, y, from) → { ok, events, after }   (para la previsualización al pasar el mouse)
//
// Turno: el grupo mueve y actúa (cada unidad: un movimiento y después una acción). Después los enemigos ejecutan lo
// que marcaron el turno anterior (las casillas marcadas pegan a quien esté ahí, amigo o enemigo), sube el agua,
// llegan refuerzos, y cada enemigo se mueve y marca su próximo golpe. Las marcas son relativas a quien ataca: si lo
// empujan, su golpe se corre con él.
import { COMBAT, TILES, MAP_CHARS, ABILITIES, ITEMS, UNITS, ENEMIES, CHALLENGES, ENCOUNTERS, FRAGMENTS, COMBOS } from './combat-data.js';
import { memberKit, leaderKit, toClass } from './classes.js';
import { recPower, foeScale } from '../core/power.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const RING8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

// ---------- suerte serializable ----------
function rand(b) {
  let a = (b.rs = (b.rs + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function localRng(seed) {
  const s = { rs: seed | 0 };
  return () => rand(s);
}
export function hashSeed(...parts) {
  let h = 0x811c9dc5;
  for (const ch of parts.map(String).join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// ---------- ayudas ----------
const inB = (b, x, y) => x >= 0 && y >= 0 && x < b.w && y < b.h;
const I = (b, x, y) => y * b.w + x;
const man = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
const tileDef = (b, x, y) => TILES[b.tiles[I(b, x, y)]];
export const unitById = (b, id) => b.units.find(u => u.id === id);
const onBoard = (u) => u.alive && !u.safe;
export const unitAt = (b, x, y) => b.units.find(u => onBoard(u) && u.x === x && u.y === y) || null;
const wallAt = (b, x, y) => b.walls.find(w => w.x === x && w.y === y) || null;
const trapAt = (b, x, y) => b.traps.find(t => t.x === x && t.y === y) || null;
const isHighAt = (b, x, y) => inB(b, x, y) && b.tiles[I(b, x, y)] === 'alto';
const isHigh = (b, u) => isHighAt(b, u.x, u.y);
export const allies = (b) => b.units.filter(u => onBoard(u) && u.side === 'ally');
export const foes = (b) => b.units.filter(u => onBoard(u) && u.side === 'enemy');
export const leaderOf = (b) => b.units.find(u => u.type === 'lider');
const captiveOf = (b) => b.units.find(u => u.captive) || null;
const bossOf = (b) => b.units.find(u => u.side === 'enemy' && ENEMIES[u.type].boss) || null;
const blocked = (b, x, y) => !inB(b, x, y) || !!tileDef(b, x, y).block || !!wallAt(b, x, y);
const setTile = (b, x, y, t) => { b.tiles = b.tiles.slice(); b.tiles[I(b, x, y)] = t; };   // copia al escribir (preview comparte)

function abilityDef(id) {
  if (id.startsWith('item:')) return ITEMS[id.slice(5)] || null;
  return ABILITIES[id] || null;
}
function phaseIdx(u) {
  const ph = ENEMIES[u.type]?.phases;
  if (!ph) return 0;
  let k = 0;
  ph.forEach((p, i) => { if (u.hp / u.maxHp <= p.from) k = i; });
  return k;
}
function enemyAttacks(u) {
  const d = ENEMIES[u.type];
  return d.phases ? d.phases[phaseIdx(u)].attacks : d.attacks;
}
function climbCost(b) {
  const lv = b.ropeItem ? 5 : Math.max(0, Math.min(5, b.tools.cuerda || 0));
  return COMBAT.climb[lv];
}
function addCombo(b, id, ev) {
  b.stats.combos.push(id);
  if (COMBOS[id]?.react) b.stats.reacts = (b.stats.reacts || 0) + 1;
  ev.push({ type: 'combo', id });
}
/** Una pelea guardada antes del paso A2 no trae fuego ni vapor: se completan al tocarla. */
function ensure(b) {
  if (!b.fire) b.fire = new Array(b.w * b.h).fill(0);
  if (!b.steam) b.steam = new Array(b.w * b.h).fill(0);
  return b;
}
const waterAt = (b, x, y) => inB(b, x, y) && (!!tileDef(b, x, y).water || b.flood[I(b, x, y)] > 0);
/** Mojado: por un golpe de Marea o por estar parado en el agua. */
const isWet = (b, u) => (u.wet || 0) > 0 || waterAt(b, u.x, u.y);
const fireAt = (b, x, y) => !!b.fire && inB(b, x, y) && b.fire[I(b, x, y)] > 0;
const steamAt = (b, x, y) => !!b.steam && inB(b, x, y) && b.steam[I(b, x, y)] > 0;
const fireproof = (u) => u.side === 'enemy' && !!ENEMIES[u.type].fireproof;

// ---------- mapa ----------
function buildMap(enc, seed) {
  const r = localRng(hashSeed(enc.id, seed));
  const mirror = !enc.noMirrorJitter && r() < 0.5;
  const flip = { '<': '>', '>': '<' };   // la corriente se espeja con el mapa
  const rows = enc.map.map(s => (mirror ? [...s].reverse().map(ch => flip[ch] || ch).join('') : s));
  // el tamaño sale del mapa: 6×6 los comunes del farmeo (paso A2), 8×8 la historia y los jefes
  const w = rows[0].length, h = rows.length;
  const out = { w, h, tiles: [], lead: null, allies: [], foes: [], waves: [], captive: null, exits: [], bridge: [], fires: [] };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x];
    let t = 'llano';
    if (ch === 'F') out.fires.push([x, y]);
    if (ch === 'L') out.lead = [x, y];
    else if (ch === 'a') out.allies.push([x, y]);
    else if (ch === 'e') out.foes.push([x, y]);
    else if (ch === 'w') out.waves.push([x, y]);
    else if (ch === 'c') out.captive = [x, y];
    else t = MAP_CHARS[ch] || 'llano';
    if (t === 'salida') out.exits.push([x, y]);
    if (t === 'pasarela') out.bridge.push([x, y]);
    out.tiles.push(t);
  }
  // Variación por semilla: 0 a 2 obstáculos más, sin cortar caminos ni tapar lugares de salida
  if (!enc.noMirrorJitter) {
    const special = [out.lead, ...out.allies, ...out.foes, ...out.waves, ...(out.captive ? [out.captive] : []), ...out.exits, ...out.fires];
    const near = (x, y) => special.some(([sx, sy]) => man(x, y, sx, sy) <= 1);
    const n = enc.farm ? Math.floor(r() * 2) : Math.floor(r() * 3);
    const obst = enc.region === 'bosque' || enc.region === 'banado' ? 'arbol' : 'roca';
    for (let k = 0, tries = 0; k < n && tries < 30; tries++) {
      const x = Math.floor(r() * w), y = Math.floor(r() * h);
      const i = y * w + x;
      if (out.tiles[i] !== 'llano' || near(x, y)) continue;
      out.tiles[i] = obst;
      if (!connected(out, special)) { out.tiles[i] = 'llano'; continue; }
      k++;
    }
  }
  return out;
}
function connected(m, points) {
  const w = m.w, h = m.h;
  const seen = new Set([m.lead[1] * w + m.lead[0]]);
  const q = [m.lead];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, i = ny * w + nx;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(i) || TILES[m.tiles[i]].block) continue;
      seen.add(i); q.push([nx, ny]);
    }
  }
  return points.every(([x, y]) => seen.has(y * w + x));
}

// ---------- crear ----------
function makeUnit(b, side, type, x, y, extra = {}) {
  const d = side === 'ally' ? UNITS[type] : ENEMIES[type];
  // un encuentro puede traer enemigos más duros que los de siempre (paso 7: el abordaje, contra la gente de la ciudad):
  // enc.foeHp multiplica la vida de todos y enc.bossHp la del jefe (encima de foeHp)
  const enc = ENCOUNTERS[b.enc] || {};
  // la Fuerza (paso 2a): b.foe escala la vida y el ataque de los enemigos cuando el grupo pasa la recomendada
  // paso A2: en el farmeo los enemigos de siempre traen menos vida (farmHp) y la Marea (I a III) los endurece
  const base = enc.farm && d.farmHp ? d.farmHp : d.hp;
  const hp = side === 'enemy' ? Math.max(1, Math.round(base * (enc.foeHp || 1) * (d.boss ? enc.bossHp || 1 : 1) * (b.foe?.hp || 1) * (COMBAT.marea[b.marea || 1]?.hp || 1))) : d.hp;
  const u = {
    id: 'u' + b.nextId++, side, type, x, y, hp, maxHp: hp, mv: d.mv, atk: (d.atk || 0) + (side === 'enemy' && d.atk ? b.foe?.atk || 0 : 0), armor: d.armor || 0,
    abilities: (d.abilities || []).slice(), cd: {}, moved: false, acted: false, alive: true, safe: false,
    root: 0, marked: 0, hurt: false, intent: null, dir: [0, side === 'ally' ? -1 : 1], phase: 0, ...extra,
  };
  b.units.push(u);
  return u;
}

export function newBattle({ encounter = 'bosque_claro', seed = 1, party = [], level = 1, element = null, elements = null, leader = null,
  classLevel = null, picks = {}, roleLevel = null, tools = {}, equip = [], attempt = 1, gear = null, power = null, itemPlus = null, foeExtra = 0,
  marea = 1, fragments = [] } = {}) {
  const enc = ENCOUNTERS[encounter];
  if (!enc) throw new Error('encuentro desconocido: ' + encounter);
  const map = buildMap(enc, seed >>> 0);
  const N = map.w * map.h;
  const b = {
    v: 1, enc: enc.id, kind: enc.kind, seed: seed >>> 0, rs: (seed ^ 0x2545f491) | 0,
    w: map.w, h: map.h, tiles: map.tiles,
    marea: Math.max(1, Math.min(COMBAT.marea.length - 1, marea | 0 || 1)),
    fire: new Array(N).fill(0), steam: new Array(N).fill(0),
    flood: new Array(N).fill(0), floodNext: [], walls: [], traps: [], cover: {},
    bridge: enc.bridge && map.bridge.length ? { hp: enc.bridge.hp, max: enc.bridge.hp, cut: false, tiles: map.bridge, count: 0 } : null,
    wavePoints: map.waves, exits: map.exits, incoming: [],
    units: [], nextId: 1, turn: 1, phase: 'player', ended: false, outcome: null, reason: null,
    maxTurns: enc.maxTurns || (enc.farm ? COMBAT.maxTurns.farm : COMBAT.maxTurns[enc.kind]) || 14,
    objective: { ...enc.objective },
    tools: { catalejo: 0, martillo: 0, cuerda: 0, botiquin: 0, farol: 0, ...tools }, ropeItem: false,
    items: {}, level, element, attempt, intentPlus: 0, lootWin: 0,
    // paso 2a: Fuerza del grupo, la recomendada del encuentro y cuánto se escalan los enemigos; +efecto de los objetos
    power: power ?? null, rec: power != null ? recPower(enc.id) : null, foe: power != null ? foeScale(power, recPower(enc.id), foeExtra) : null,
    itemPlus: { ...(itemPlus || {}) },
    stats: { dmg: {}, kills: {}, combos: [], downs: 0, stolen: 0 },
  };
  for (const id of equip) if (ITEMS[id]) b.items[id] = 1;
  const fails = Math.max(0, Math.min(COMBAT.revancha.max, attempt - 1));
  const revHp = enc.kind === 'jefe' ? fails * COMBAT.revancha.hp : 0;

  // el líder y el grupo
  const els = elements || (element ? [element] : []);
  const lk = leaderKit({ cls: leader?.cls || null, sub: leader?.sub || null, picks: leader?.picks || [], level, elements: els });
  b.leader = { cls: lk.cls, sub: lk.sub, classLevel: lk.classLevel };
  const L0 = applyGear(b, applyKit(b, makeUnit(b, 'ally', 'lider', map.lead[0], map.lead[1]), lk, revHp), gear?.lider);
  // fragmentos de veta (paso A2): una habilidad prestada de Marea, Brasa o Céfiro por esta pelea
  for (const el of fragments || []) if (FRAGMENTS[el] && !L0.abilities.includes(FRAGMENTS[el])) L0.abilities.push(FRAGMENTS[el]);
  for (const [x, y] of map.fires) b.fire[I(b, x, y)] = 99;
  // nivel de clase de cada integrante; un roleLevel viejo (1..5, nivel del edificio) vale 2 × nivel − 1
  const cl = { ...Object.fromEntries(Object.entries(roleLevel || {}).map(([k, v]) => [toClass(k), 2 * Math.max(1, v | 0) - 1])), ...(classLevel || {}) };
  party.map(toClass).slice(0, 3).forEach((cls, i) => {
    const p = map.allies[i];
    const kit = memberKit(cls, cl[cls] || 1, picks?.[cls] || []);
    if (!p || !kit) return;
    applyGear(b, applyKit(b, makeUnit(b, 'ally', cls, p[0], p[1]), kit, revHp), gear?.[cls]);
  });
  if (map.captive && enc.objective.type === 'rescue') makeUnit(b, 'ally', 'cautivo', map.captive[0], map.captive[1], { captive: true, freed: false, mv: 0 });

  // enemigos
  const r = localRng(hashSeed(enc.id, seed, 'foes'));
  // Marea III: se suma uno más (enc.extra; si no hay, repite el primero)
  const extra = Array.from({ length: COMBAT.marea[b.marea].extra }, (_, k) => (enc.extra || enc.enemies)[k % (enc.extra || enc.enemies).length]);
  [...enc.enemies, ...extra].forEach((type, i) => {
    let p = map.foes[i];
    for (let tries = 0; !p && tries < 50; tries++) {
      const x = Math.floor(r() * b.w), y = Math.floor(r() * 3);
      if (!blocked(b, x, y) && !unitAt(b, x, y) && !waterAt(b, x, y)) p = [x, y];
    }
    if (!p) return;
    const u = makeUnit(b, 'enemy', type, p[0], p[1]);
    if (ENEMIES[type].boss && fails) u.maxHp = u.hp = Math.round(u.hp * (1 - COMBAT.revancha.bossHp * fails));
  });

  const ev = [];
  planIncoming(b, ev, true);
  return b;
}

/** Pone el kit de clase en una unidad del grupo (vida, ataque, movimiento, coraza, habilidades y pasivas en u.f). */
function applyKit(b, u, kit, revHp = 0) {
  u.maxHp = u.hp = kit.hp + revHp;
  u.atk = kit.atk; u.mv = kit.mv; u.armor = kit.armor;
  u.abilities = kit.abilities.slice();
  u.f = { ...kit.flags };
  if (kit.cls) u.cls = kit.cls;
  u.lv = kit.level;
  b.intentPlus += u.f.intentPlus || 0;
  b.lootWin += u.f.lootWin || 0;
  return u;
}
/**
 * Suma lo que lleva cada uno (paso 2a, arsenal.js gearMods): arma, maestría y talentos. { hp, atk, armor, flags,
 * affinity: [elementos], type }. La afinidad suma 1 de daño a las habilidades de ese elemento (u.aff).
 */
function applyGear(b, u, g) {
  if (!u || !g) return u;
  u.maxHp += g.hp || 0; u.hp += g.hp || 0;
  u.atk += g.atk || 0; u.armor = (u.armor || 0) + (g.armor || 0);
  for (const [k, n] of Object.entries(g.flags || {})) {
    u.f[k] = (u.f[k] || 0) + n;
    if (k === 'intentPlus') b.intentPlus += n;
    if (k === 'lootWin') b.lootWin += n;
  }
  if (g.affinity?.length) u.aff = g.affinity.slice();
  if (g.type) u.weapon = g.type;
  return u;
}
const flag = (u, k) => (u && u.f ? u.f[k] || 0 : 0);
/** Afinidad elemental del arma: +1 de daño con las habilidades de su elemento. */
const elemPlus = (u, def) => (def?.element && u?.aff?.includes(def.element) ? 1 : 0);

// ---------- movimiento ----------
/** Costo de entrar a una casilla. Para el grupo: los enemigos tapan, los aliados se atraviesan. */
function enterCost(b, u, x, y) {
  if (blocked(b, x, y)) return Infinity;
  const o = unitAt(b, x, y);
  if (o && o.side !== u.side) return Infinity;
  const t = tileDef(b, x, y);
  if (u.side === 'enemy' && ENEMIES[u.type].flies) return 1;          // vuela: ni el agua ni lo alto lo frenan
  const swims = u.side === 'enemy' && ENEMIES[u.type].swims;
  let c;
  if (t.high) c = swims ? Infinity : (u.side === 'ally' ? climbCost(b) : COMBAT.climb[0]);
  else if (t.water) c = swims ? 1 : COMBAT.waterCost;
  else c = t.cost || 1;
  if (b.flood[I(b, x, y)] > 0 && !swims) c += COMBAT.floodExtra;
  return c;
}
/** Dijkstra chico (64 casillas). Devuelve Map idx → { cost, prev }. */
function dijkstra(b, u, budget) {
  const start = I(b, u.x, u.y);
  const best = new Map([[start, { cost: 0, prev: -1 }]]);
  const open = [start];
  while (open.length) {
    let k = 0;
    for (let j = 1; j < open.length; j++) if (best.get(open[j]).cost < best.get(open[k]).cost) k = j;
    const cur = open.splice(k, 1)[0];
    const cx = cur % b.w, cy = (cur / b.w) | 0, cc = best.get(cur).cost;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!inB(b, nx, ny)) continue;
      const nc = cc + enterCost(b, u, nx, ny);
      if (nc > budget) continue;
      const ni = I(b, nx, ny);
      const prev = best.get(ni);
      if (!prev || nc < prev.cost) { best.set(ni, { cost: nc, prev: cur }); open.push(ni); }
    }
  }
  return best;
}
function pathTo(b, map, i) {
  const out = [];
  for (let c = i; c !== -1; c = map.get(c).prev) out.push([c % b.w, (c / b.w) | 0]);
  return out.reverse();
}
/** Trabado: quien arranca al lado de un enemigo solo se mueve COMBAT.stuckMv (el monje no se traba: Paso libre). */
export function isStuck(b, u) {
  if (u.side !== 'ally' || flag(u, 'noStuck')) return false;
  return foes(b).some(e => man(e.x, e.y, u.x, u.y) === 1);
}
const stuckAt = (b, u, x, y) => !flag(u, 'noStuck') && foes(b).some(e => man(e.x, e.y, x, y) === 1);
const moveBudget = (b, u) => (isStuck(b, u) ? Math.min(u.mv, COMBAT.stuckMv) : u.mv);
/** Casillas a las que puede llegar una unidad del grupo este turno: [{ x, y, cost }]. */
export function reachable(b, unitId) {
  const u = unitById(b, unitId);
  if (!u || !onBoard(u)) return [];
  const can = u.side === 'ally' && !u.moved && !u.acted && b.phase === 'player' && !b.ended && !(u.captive && !u.freed);
  if (!can) return [{ x: u.x, y: u.y, cost: 0 }];
  const out = [];
  for (const [i, v] of dijkstra(b, u, moveBudget(b, u))) {
    const x = i % b.w, y = (i / b.w) | 0;
    const o = unitAt(b, x, y);
    if (o && o !== u) continue;
    out.push({ x, y, cost: v.cost });
  }
  return out;
}

export function move(b, unitId, x, y) {
  const u = unitById(b, unitId);
  if (b.ended) return { ok: false, why: 'La pelea terminó', events: [] };
  if (b.phase !== 'player') return { ok: false, why: 'No es tu turno', events: [] };
  if (!u || !onBoard(u) || u.side !== 'ally') return { ok: false, why: 'No se puede mover', events: [] };
  if (u.moved || u.acted) return { ok: false, why: 'Ya se movió', events: [] };
  if (u.captive && !u.freed) return { ok: false, why: 'Está atado', events: [] };
  if (!inB(b, x, y)) return { ok: false, why: 'Fuera del campo', events: [] };
  if (u.x === x && u.y === y) return { ok: false, why: 'Ya está ahí', events: [] };
  const map = dijkstra(b, u, moveBudget(b, u));
  const i = I(b, x, y);
  if (!map.has(i)) return { ok: false, why: 'No llega', events: [] };
  const o = unitAt(b, x, y);
  if (o) return { ok: false, why: 'Está ocupado', events: [] };
  const path = pathTo(b, map, i);
  const from = [u.x, u.y];
  u.x = x; u.y = y; u.moved = true;
  if (path.length > 1) { const [px, py] = path[path.length - 2]; u.dir = [x - px, y - py]; }
  const ev = [{ type: 'move', id: u.id, from, to: [x, y], path }];
  if (u.captive && b.tiles[i] === 'salida') {
    u.safe = true;
    ev.push({ type: 'rescued', id: u.id });
  }
  checkEnd(b, ev);
  return { ok: true, events: ev };
}

// ---------- daño ----------
function guardFor(b, t) {
  const lv = Math.max(0, Math.min(5, b.tools.farol || 0));
  if (!lv || t.type === 'lider') return 0;
  const L = leaderOf(b);
  return L && onBoard(L) && man(L.x, L.y, t.x, t.y) === 1 ? COMBAT.guard[lv] : 0;
}
/** Protector (pasiva del guerrero): 1 menos si al lado hay alguien del grupo que la tenga. */
function protectorFor(b, t) {
  return allies(b).some(a => a !== t && !a.captive && flag(a, 'guardAdj') && man(a.x, a.y, t.x, t.y) === 1) ? 1 : 0;
}
/** src: { side: 'ally'|'enemy'|'env', unit, by (tipo del grupo para las estadísticas), high, pierce, loot } */
function hurt(b, t, amount, src, ev) {
  if (!t || !onBoard(t) || amount <= 0) return 0;
  let dmg = amount;
  if (src.side === 'ally' && t.side === 'enemy' && t.marked) { dmg += t.marked; t.marked = 0; addCombo(b, 'marca', ev); }
  if (src.high) dmg += COMBAT.highDmg;
  if (t.armor && !src.pierce) dmg -= t.armor;
  if (t.side === 'ally' && src.side === 'enemy' && !src.nip) dmg -= guardFor(b, t) + (b.cover[t.id] || 0) + protectorFor(b, t);
  // paso A2: el matorral tapa de los tiros; el guardián cubre a los enemigos que tiene pegados; Marea apaga a los de Brasa
  if (src.ranged && tileDef(b, t.x, t.y).cover) dmg -= COMBAT.coverDmg;
  if (t.side === 'enemy' && src.side === 'ally' && !src.react && wardedBy(b, t)) dmg -= COMBAT.wardDmg;
  if (src.element === 'marea' && t.side === 'enemy' && ENEMIES[t.type].element === 'brasa') dmg += 2;
  dmg = Math.max(1, dmg);
  const dealt = Math.min(dmg, t.hp);
  t.hp -= dealt;
  if (src.react) b.stats.reactDmg = (b.stats.reactDmg || 0) + (t.side === 'enemy' ? dealt : 0);
  if (t.side === 'ally') t.hurt = true;
  if (src.by && t.side === 'enemy') b.stats.dmg[src.by] = (b.stats.dmg[src.by] || 0) + dealt;
  ev.push({ type: 'dmg', id: t.id, amount: dealt, hp: t.hp, src: src.unit?.id || src.side });
  if (t.hp <= 0) kill(b, t, src, ev);
  return dealt;
}
function kill(b, u, src, ev) {
  u.alive = false; u.intent = null;
  ev.push({ type: 'down', id: u.id });
  if (u.side === 'ally' && !u.captive) b.stats.downs++;
  if (u.side === 'enemy' && src.by) b.stats.kills[src.by] = (b.stats.kills[src.by] || 0) + 1;
  if (u.side === 'enemy' && (src.loot || flag(src.unit, 'lootKill'))) { b.stats.stolen++; ev.push({ type: 'stolen', id: u.id }); }
  // quien invocaba ya no trae a nadie
  if (u.side === 'enemy' && b.incoming.some(s => s.by === u.id)) b.incoming = b.incoming.filter(s => s.by !== u.id);
  if (u.side === 'enemy' && ENEMIES[u.type].explode) {
    const d = ENEMIES[u.type];
    const ring = d.explodeRing8 ? RING8 : DIRS;
    ev.push({ type: 'explode', id: u.id, at: [u.x, u.y], tiles: ring.map(([dx, dy]) => [u.x + dx, u.y + dy]).filter(([x, y]) => inB(b, x, y)) });
    for (const [dx, dy] of ring) {
      const n = inB(b, u.x + dx, u.y + dy) ? unitAt(b, u.x + dx, u.y + dy) : null;
      if (!n) continue;
      if (n.side === 'enemy') addCombo(b, 'reventon', ev);
      hurt(b, n, d.explodeDmg || COMBAT.explodeDmg, { side: 'env', by: n.side === 'enemy' ? src.by : null }, ev);
    }
  }
}
/** ¿Lo cubre un guardián de corteza? (otro enemigo con ward, pegado a él) */
function wardedBy(b, t) {
  if (ENEMIES[t.type].ward) return false;
  return foes(b).some(g => g !== t && ENEMIES[g.type].ward && man(g.x, g.y, t.x, t.y) === 1);
}

// ---------- elementos y reacciones (paso A2; PLAN-TRAVESIA "Los elementos", recortado) ----------
// Estados: mojado (u.wet o parado en agua), quemado (u.burn), enredado (u.root); casillas: fuego (b.fire) y vapor
// (b.steam). Reacciones: vapor (Marea + Brasa), descarga (Céfiro + mojado, en cadena), incendio (Brasa + raíz, matorral
// o enredado; se corre), fuego que salta (Céfiro + fuego), brote (Raíz + mojado) y despeje (Céfiro + vapor).
// src: el mismo de hurt(); los combos solo se anotan si la provoca el grupo.
function react(b, id, x, y, src, ev) {
  ev.push({ type: 'react', id, at: [x, y] });
  if (src.side === 'ally') addCombo(b, id, ev);
}
function setStatus(u, k, n, ev) {
  u[k] = Math.max(u[k] || 0, n);
  ev.push({ type: 'status', id: u.id, status: k, on: true });
}
function steamOn(b, x, y, ev) {
  b.steam = b.steam.slice(); b.steam[I(b, x, y)] = COMBAT.steamTurns;
  ev.push({ type: 'steam', tiles: [[x, y]] });
}
function fireOff(b, x, y) { if (b.fire[I(b, x, y)] < 90) { b.fire = b.fire.slice(); b.fire[I(b, x, y)] = 0; } }
/** Prende una casilla. El matorral y las paredes de raíz arden y pasan el fuego a lo que tengan pegado. */
function ignite(b, x, y, src, ev, depth = 0) {
  if (!inB(b, x, y) || tileDef(b, x, y).block || waterAt(b, x, y)) return false;
  const i = I(b, x, y);
  const w = wallAt(b, x, y);
  const fuel = (w && w.root) || tileDef(b, x, y).burns;
  if (w && !w.root) return false;
  if (w) { b.walls = b.walls.filter(k => k !== w); ev.push({ type: 'wallGone', tiles: [[x, y]] }); }
  if (tileDef(b, x, y).burns) setTile(b, x, y, 'llano');
  if (b.fire[i] < 90) { b.fire = b.fire.slice(); b.fire[i] = COMBAT.fireTurns; }
  ev.push({ type: 'fire', tiles: [[x, y]] });
  if (fuel && depth < 8) {
    if (!depth) react(b, 'incendio', x, y, src, ev);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inB(b, nx, ny) || fireAt(b, nx, ny)) continue;
      if (wallAt(b, nx, ny)?.root || tileDef(b, nx, ny).burns) ignite(b, nx, ny, src, ev, depth + 1);
    }
  }
  return true;
}
function burn(b, o, src, ev) {
  if (!o || !onBoard(o) || fireproof(o)) return;
  setStatus(o, 'burn', COMBAT.burnTurns, ev);
}
/** Aplica un elemento en una casilla (y a quien esté parado ahí). dir: hacia dónde iba el golpe. */
function applyElement(b, el, x, y, src, dir, ev) {
  if (!el || !inB(b, x, y)) return;
  ensure(b);
  const o = unitAt(b, x, y);
  const rsrc = { ...src, react: true, high: false, pierce: true, unit: src.unit };
  if (el === 'marea') {
    if (fireAt(b, x, y)) { fireOff(b, x, y); steamOn(b, x, y, ev); react(b, 'vapor', x, y, src, ev); }
    if (o && onBoard(o)) {
      if (o.burn) { o.burn = 0; if (!steamAt(b, x, y)) { steamOn(b, x, y, ev); react(b, 'vapor', x, y, src, ev); } }
      setStatus(o, 'wet', COMBAT.wetTurns, ev);
    }
  } else if (el === 'brasa') {
    if (waterAt(b, x, y) || (o && onBoard(o) && isWet(b, o))) {
      if (o) o.wet = 0;
      steamOn(b, x, y, ev); react(b, 'vapor', x, y, src, ev);
    } else if (o && onBoard(o)) {
      if (o.root > 0 && !fireproof(o)) { react(b, 'incendio', x, y, src, ev); hurt(b, o, COMBAT.igniteDmg, rsrc, ev); }
      burn(b, o, src, ev);
    } else ignite(b, x, y, src, ev);
  } else if (el === 'cefiro') {
    if (steamAt(b, x, y)) {
      b.steam = b.steam.slice();
      for (const [dx, dy] of [[0, 0], ...DIRS]) if (inB(b, x + dx, y + dy)) b.steam[I(b, x + dx, y + dy)] = 0;
      react(b, 'despeje', x, y, src, ev);
    }
    if (fireAt(b, x, y) || (o && o.burn > 0)) {
      let any = false;
      for (let k = 1; k <= 2; k++) {
        const nx = x + dir[0] * k, ny = y + dir[1] * k;
        if (!inB(b, nx, ny) || tileDef(b, nx, ny).block) break;
        const n = unitAt(b, nx, ny);
        if (n) { burn(b, n, src, ev); any = true; } else if (ignite(b, nx, ny, src, ev, 1)) any = true;
      }
      if (any) react(b, 'fuego_salta', x, y, src, ev);
    }
    if (o && onBoard(o) && isWet(b, o)) {
      react(b, 'descarga', x, y, src, ev);
      // en cadena: salta a los mojados de al lado, del bando que sean
      const seen = new Set([o.id]), q = [o];
      hurt(b, o, COMBAT.shockDmg, rsrc, ev);
      while (q.length) {
        const c = q.shift();
        for (const [dx, dy] of DIRS) {
          const n = inB(b, c.x + dx, c.y + dy) ? unitAt(b, c.x + dx, c.y + dy) : null;
          if (!n || seen.has(n.id) || !isWet(b, n)) continue;
          seen.add(n.id); q.push(n);
          hurt(b, n, COMBAT.chainDmg, rsrc, ev);
        }
      }
    }
  } else if (el === 'raiz') {
    if (o && onBoard(o) && o.root > 0 && isWet(b, o) && !(o.side === 'enemy' && ENEMIES[o.type].heavy)) { o.root++; react(b, 'brote', x, y, src, ev); }
  }
}
/** Corre a alguien una casilla (chorro del sapo, carga del jabalí, corriente). Devuelve si se movió. */
function shove(b, o, dir, src, ev, collide = COMBAT.collideDmg) {
  if (!o || !onBoard(o) || (o.side === 'enemy' && ENEMIES[o.type].heavy)) return false;
  const nx = o.x + dir[0], ny = o.y + dir[1];
  const other = inB(b, nx, ny) ? unitAt(b, nx, ny) : null;
  if (blocked(b, nx, ny) || other) {
    ev.push({ type: 'push', id: o.id, from: [o.x, o.y], to: [o.x, o.y], blocked: true });
    if (collide) hurt(b, o, collide, { ...src, nip: true }, ev);
    return false;
  }
  ev.push({ type: 'push', id: o.id, from: [o.x, o.y], to: [nx, ny] });
  o.x = nx; o.y = ny;
  landOn(b, o, src, ev);
  return true;
}
/** Lo que pasa al caer empujado en una casilla: trampa (los enemigos), fuego, salida (el rescatado). */
function landOn(b, o, src, ev) {
  const tr = trapAt(b, o.x, o.y);
  if (tr && o.side === 'enemy') { if (src.side === 'ally') addCombo(b, 'empuje_trampa', ev); triggerTrap(b, o, tr, ev); }
  if (onBoard(o) && fireAt(b, o.x, o.y) && !fireproof(o)) {
    if (src.side === 'ally' && o.side === 'enemy') addCombo(b, 'a_las_brasas', ev);
    hurt(b, o, COMBAT.fireDmg, { side: src.side === 'ally' ? 'ally' : 'env', by: src.by, react: true, pierce: true }, ev);
    burn(b, o, src, ev);
  }
  if (onBoard(o) && o.captive && o.freed && b.tiles[I(b, o.x, o.y)] === 'salida') { o.safe = true; ev.push({ type: 'rescued', id: o.id }); }
}
function heal(b, t, amount, ev) {
  if (!t || !onBoard(t)) return 0;
  const n = Math.min(amount, t.maxHp - t.hp);
  if (n > 0) { t.hp += n; ev.push({ type: 'heal', id: t.id, amount: n, hp: t.hp }); }
  return n;
}
function triggerTrap(b, u, trap, ev) {
  b.traps = b.traps.filter(t => t !== trap);
  ev.push({ type: 'trapHit', id: u.id, at: [trap.x, trap.y] });
  hurt(b, u, trap.dmg, { side: 'ally', by: trap.by }, ev);
  if (onBoard(u)) { u.root = Math.max(u.root, trap.root); ev.push({ type: 'root', id: u.id }); }
}
function cancelIntent(b, e, ev) {
  if (!e.intent || ENEMIES[e.type].heavy) return false;
  e.intent = null;
  ev.push({ type: 'cancel', id: e.id });
  return true;
}

// ---------- habilidades del grupo ----------
/** Habilidades que puede usar ahora (con su recarga). */
export function abilitiesOf(b, unitId) {
  const u = unitById(b, unitId);
  if (!u || u.side !== 'ally' || u.captive) return [];
  const out = u.abilities.map(id => ({ id, def: ABILITIES[id], cd: u.cd[id] || 0 }));
  const c = captiveOf(b);
  if (c && !c.freed && onBoard(c)) out.push({ id: 'liberar', def: ABILITIES.liberar, cd: 0 });
  for (const [id, n] of Object.entries(b.items)) if (n > 0) out.push({ id: 'item:' + id, def: ITEMS[id], cd: 0, item: true });
  return out.map(a => ({ ...a, ready: a.cd === 0 }));
}
function inRange(b, def, fx, fy, x, y) {
  const d = man(fx, fy, x, y);
  let [mn, mx] = def.range;
  if (def.ranged && isHighAt(b, fx, fy)) mx += COMBAT.highRange;
  return d >= mn && d <= mx;
}
function emptyPassable(b, x, y) {
  return inB(b, x, y) && !blocked(b, x, y) && !unitAt(b, x, y) && !trapAt(b, x, y);
}
/** ¿Se puede apuntar ahí? (sin chequear recarga ni turno). */
function canTarget(b, u, def, x, y, fx = u.x, fy = u.y) {
  if (!inB(b, x, y) || !inRange(b, def, fx, fy, x, y)) return false;
  if (def.line && x !== fx && y !== fy) return false;                 // en línea recta
  // el vapor tapa la vista: de lejos no se apunta hacia adentro ni desde adentro
  if (def.ranged && man(fx, fy, x, y) > 1 && (steamAt(b, x, y) || steamAt(b, fx, fy))) return false;
  const o = unitAt(b, x, y);
  const other = o && o !== u ? o : null;
  switch (def.kind) {
    case 'attack':
      if (def.ranged && stuckAt(b, u, fx, fy)) return false;          // con un enemigo encima no se puede apuntar
      if (other && other.side === 'enemy') return true;
      if (!other && def.ground && !tileDef(b, x, y).block && !(x === fx && y === fy)) return true;   // Ascua: al piso, al matorral o a una raíz
      if (!other && b.bridge && !b.bridge.cut && b.tiles[I(b, x, y)] === 'pasarela') return true;
      if (!other && def.breaks && b.tiles[I(b, x, y)] === 'roca') return true;
      return false;
    case 'mark': case 'disarm': case 'root': return !!other && other.side === 'enemy';
    case 'push': return !!other && other.side === 'enemy' && !ENEMIES[other.type].heavy;
    case 'trap': return !(x === fx && y === fy) && emptyPassable(b, x, y) && !isHighAt(b, x, y) && b.tiles[I(b, x, y)] !== 'pasarela';
    case 'wall': return !(x === fx && y === fy) && emptyPassable(b, x, y) && b.tiles[I(b, x, y)] !== 'pasarela';
    case 'heal': { if (def.self) return x === fx && y === fy; const t = (x === fx && y === fy) ? u : other; return !!t && t.side === 'ally' && !t.captive; }
    case 'leap': return !(x === fx && y === fy) && emptyPassable(b, x, y) && b.tiles[I(b, x, y)] !== 'pasarela';
    case 'healArea': case 'dazzle': case 'cover': case 'rope': return x === fx && y === fy;
    case 'swap': return !!other && other.side === 'ally' && !(other.captive && !other.freed);
    case 'free': return !!other && other.captive && !other.freed;
    default: return false;
  }
}
/** Casillas válidas para una habilidad, desde donde está la unidad o desde (fx, fy). */
export function targets(b, unitId, abilityId, fx, fy) {
  const u = unitById(b, unitId);
  const def = abilityDef(abilityId);
  if (!u || !def) return [];
  const sx = fx ?? u.x, sy = fy ?? u.y;
  const out = [];
  const [, mx] = def.range;
  const R = mx + (def.ranged ? COMBAT.highRange : 0);
  for (let y = Math.max(0, sy - R); y <= Math.min(b.h - 1, sy + R); y++)
    for (let x = Math.max(0, sx - R); x <= Math.min(b.w - 1, sx + R); x++)
      if (canTarget(b, u, def, x, y, sx, sy)) out.push({ x, y });
  return out;
}

export function act(b, unitId, abilityId, x, y) {
  const u = unitById(b, unitId);
  if (b.ended) return { ok: false, why: 'La pelea terminó', events: [] };
  if (b.phase !== 'player') return { ok: false, why: 'No es tu turno', events: [] };
  if (!u || !onBoard(u) || u.side !== 'ally' || u.captive) return { ok: false, why: 'No puede actuar', events: [] };
  if (u.acted) return { ok: false, why: 'Ya actuó', events: [] };
  const av = abilitiesOf(b, unitId).find(a => a.id === abilityId);
  if (!av) return { ok: false, why: 'No tiene esa habilidad', events: [] };
  if (!av.ready) return { ok: false, why: `Falta${av.cd > 1 ? 'n' : ''} ${av.cd} turno${av.cd > 1 ? 's' : ''}`, events: [] };
  const def = av.item ? itemWithMastery(b, av.def) : av.def;
  if (!canTarget(b, u, def, x, y)) return { ok: false, why: 'No se puede ahí', events: [] };
  const ev = [{ type: 'act', id: u.id, ability: abilityId, at: [x, y] }];
  if (x !== u.x || y !== u.y) u.dir = Math.abs(x - u.x) >= Math.abs(y - u.y) ? [Math.sign(x - u.x), 0] : [0, Math.sign(y - u.y)];
  const tgt = unitAt(b, x, y);
  resolve(b, u, def, x, y, ev);
  // paso A2: la habilidad deja su elemento donde cayó (o donde quedó el blanco, si lo corrieron)
  if (def.element && (def.kind === 'attack' || def.kind === 'push' || def.kind === 'root' || def.kind === 'disarm')) {
    const at = tgt && tgt !== u && onBoard(tgt) ? [tgt.x, tgt.y] : [x, y];
    const dir = Math.abs(x - u.x) >= Math.abs(y - u.y) ? [Math.sign(x - u.x), 0] : [0, Math.sign(y - u.y)];
    if (!b.ended && (!tgt || tgt === u || onBoard(tgt) || def.ground)) applyElement(b, def.element, at[0], at[1], { side: 'ally', unit: u, by: u.type }, dir, ev);
  }
  u.acted = true; u.moved = true;
  if (av.item) b.items[abilityId.slice(5)]--;
  else if (def.cd) u.cd[abilityId] = def.cd + 1;
  checkEnd(b, ev);
  return { ok: true, events: ev };
}

function attackDmg(u, def) {
  return (def.dmg === 'atk' ? u.atk : def.dmg || 0) + (def.plus || 0) + elemPlus(u, def);
}
/** Un objeto del Taller con su maestría (b.itemPlus): cura, daño, cobertura o radio +n. */
function itemWithMastery(b, def) {
  const n = b.itemPlus?.[def.id] || 0;
  if (!n) return def;
  const d = { ...def };
  for (const k of ['heal', 'dmg', 'cover', 'radius']) if (typeof d[k] === 'number') d[k] += n;
  return d;
}
function resolve(b, u, def, x, y, ev) {
  const o = unitAt(b, x, y);
  const by = u.type;
  const high = isHigh(b, u) && !isHighAt(b, x, y);
  switch (def.kind) {
    case 'attack': {
      const dmg = attackDmg(u, def);
      if (o && o.side === 'enemy') {
        if (high) addCombo(b, 'desde_alto', ev);
        if (def.breaks && o.armor) { o.armor = 0; addCombo(b, 'sin_coraza', ev); }
        hurt(b, o, dmg, { side: 'ally', unit: u, by, high, pierce: !!def.pierce, loot: !!def.lootKill, ranged: !!def.ranged, element: def.element }, ev);
        if (def.rootHit && onBoard(o)) { o.root = Math.max(o.root, def.rootHit); ev.push({ type: 'root', id: o.id }); }
        if (def.cleave) {
          // los dos costados del blanco, mirando desde quien pega
          const dx = Math.sign(x - u.x), dy = Math.sign(y - u.y);
          for (const [sx, sy] of [[x - dy, y + dx], [x + dy, y - dx]]) {
            const n = inB(b, sx, sy) ? unitAt(b, sx, sy) : null;
            if (n && n.side === 'enemy') hurt(b, n, dmg, { side: 'ally', unit: u, by, high: false, pierce: !!def.pierce }, ev);
          }
        }
      } else if (b.tiles[I(b, x, y)] === 'pasarela') {
        hitBridge(b, dmg * (def.breaks ? 2 : 1), by, ev);
      } else if (def.breaks && b.tiles[I(b, x, y)] === 'roca') {
        setTile(b, x, y, 'llano');
        ev.push({ type: 'rockBroken', at: [x, y] });
      }
      break;
    }
    case 'mark':
      hurt(b, o, def.dmg + elemPlus(u, def), { side: 'ally', unit: u, by, high }, ev);
      if (onBoard(o)) { o.marked = COMBAT.markBonus + flag(u, 'markPlus'); ev.push({ type: 'mark', id: o.id }); }
      break;
    case 'trap': {
      const extra = (flag(u, 'smith') ? COMBAT.trapBonus[Math.max(0, Math.min(5, b.tools.martillo || 0))] : 0) + flag(u, 'trapPlus');
      b.traps.push({ x, y, dmg: def.dmg + extra, root: def.root || 1, by });
      ev.push({ type: 'trap', at: [x, y] });
      break;
    }
    case 'wall': {
      const extra = (flag(u, 'smith') && (b.tools.martillo || 0) >= 3 ? 1 : 0) + flag(u, 'wallPlus');
      b.walls.push({ x, y, turns: def.turns + extra, by, root: def.element === 'raiz' });
      ev.push({ type: 'wall', at: [x, y], turns: def.turns + extra });
      break;
    }
    case 'heal': {
      const t = o || u;
      const extra = (flag(u, 'medic') ? COMBAT.healBonus[Math.max(0, Math.min(5, b.tools.botiquin || 0))] : 0) + flag(u, 'healPlus');
      heal(b, t, def.heal + extra, ev);
      break;
    }
    case 'healArea': {
      const extra = (flag(u, 'medic') ? Math.ceil(COMBAT.healBonus[Math.max(0, Math.min(5, b.tools.botiquin || 0))] / 2) : 0) + flag(u, 'healPlus');
      for (const a of allies(b)) if (!a.captive && man(a.x, a.y, u.x, u.y) <= def.radius) heal(b, a, def.heal + extra, ev);
      break;
    }
    case 'disarm':
      hurt(b, o, def.dmg + elemPlus(u, def), { side: 'ally', unit: u, by, high }, ev);
      if (onBoard(o) && cancelIntent(b, o, ev)) { b.stats.stolen++; ev.push({ type: 'stolen', id: o.id }); }
      if (def.rootHit && onBoard(o)) { o.root = Math.max(o.root, def.rootHit); ev.push({ type: 'root', id: o.id }); }
      break;
    case 'push': push(b, u, o, def, ev); break;
    case 'swap': {
      const [ux, uy] = [u.x, u.y];
      u.x = o.x; u.y = o.y; o.x = ux; o.y = uy;
      ev.push({ type: 'swap', a: u.id, b: o.id });
      if (o.captive && b.tiles[I(b, o.x, o.y)] === 'salida') { o.safe = true; ev.push({ type: 'rescued', id: o.id }); }
      break;
    }
    case 'root': {
      hurt(b, o, def.dmg + elemPlus(u, def), { side: 'ally', unit: u, by, high }, ev);
      if (!onBoard(o)) break;
      if (!def.noCancel) cancelIntent(b, o, ev);
      o.root = Math.max(o.root, def.root);
      ev.push({ type: 'root', id: o.id });
      if (!def.wallTurns) break;
      // la pared de raíz sale en la casilla libre de al lado que queda más cerca de quien la lanzó
      let best = null;
      for (const [dx, dy] of DIRS) {
        const nx = o.x + dx, ny = o.y + dy;
        if (!emptyPassable(b, nx, ny) || b.tiles[I(b, nx, ny)] === 'pasarela') continue;
        const d = man(nx, ny, u.x, u.y);
        if (!best || d < best.d) best = { x: nx, y: ny, d };
      }
      const wt = def.wallTurns + flag(u, 'wallPlus');
      if (best) { b.walls.push({ x: best.x, y: best.y, turns: wt, by, root: true }); ev.push({ type: 'wall', at: [best.x, best.y], turns: wt }); }
      break;
    }
    case 'free':
      o.freed = true; o.mv = UNITS.cautivo.mv; o.moved = true;
      ev.push({ type: 'free', id: o.id });
      break;
    case 'dazzle':
      for (const e of foes(b)) if (man(e.x, e.y, u.x, u.y) <= def.radius) cancelIntent(b, e, ev);
      break;
    case 'cover': {
      const r = def.radius ?? 1;
      for (const a of allies(b)) if (man(a.x, a.y, u.x, u.y) <= r) b.cover[a.id] = Math.max(b.cover[a.id] || 0, def.cover);
      ev.push({ type: 'cover', id: u.id });
      break;
    }
    case 'leap': {
      const from = [u.x, u.y];
      u.x = x; u.y = y;
      ev.push({ type: 'leap', id: u.id, from, to: [x, y] });
      if (def.leaveWall) {
        const wt = def.leaveWall + flag(u, 'wallPlus');
        b.walls.push({ x: from[0], y: from[1], turns: wt, by, root: def.element === 'raiz' });
        ev.push({ type: 'wall', at: from, turns: wt });
      }
      break;
    }
    case 'rope':
      b.ropeItem = true;
      ev.push({ type: 'rope', id: u.id });
      break;
  }
}
function push(b, u, o, def, ev) {
  const by = u.type;
  hurt(b, o, def.dmg + elemPlus(u, def), { side: 'ally', unit: u, by, ranged: !!def.ranged, element: def.element }, ev);
  const dx = Math.sign(o.x - u.x), dy = Math.sign(o.y - u.y);
  for (let k = 0; k < (def.pushN || 1); k++) {
    if (!onBoard(o) || b.ended) return;
    const nx = o.x + dx, ny = o.y + dy;
    const other = inB(b, nx, ny) ? unitAt(b, nx, ny) : null;
    if (blocked(b, nx, ny) || other) {
      ev.push({ type: 'push', id: o.id, from: [o.x, o.y], to: [o.x, o.y], blocked: true });
      addCombo(b, 'empuje_choque', ev);
      hurt(b, o, COMBAT.collideDmg, { side: 'ally', by }, ev);
      if (other) hurt(b, other, COMBAT.collideDmg - 1, { side: other.side === 'enemy' ? 'ally' : 'env', by: other.side === 'enemy' ? by : null }, ev);
      return;
    }
    ev.push({ type: 'push', id: o.id, from: [o.x, o.y], to: [nx, ny] });
    o.x = nx; o.y = ny;                    // su golpe marcado se corre con él (es relativo)
    landOn(b, o, { side: 'ally', unit: u, by }, ev);
  }
}
function hitBridge(b, dmg, by, ev) {
  const br = b.bridge;
  if (!br || br.cut) return;
  br.hp = Math.max(0, br.hp - dmg);
  b.stats.dmg[by] = (b.stats.dmg[by] || 0) + dmg;
  ev.push({ type: 'bridge', hp: br.hp });
  if (br.hp > 0) return;
  br.cut = true;
  for (const [x, y] of br.tiles) if (!unitAt(b, x, y)) setTile(b, x, y, 'vacio');
  b.incoming = b.incoming.filter(s => s.from !== 'bridge');
  ev.push({ type: 'bridgeCut' });
}

// ---------- intenciones enemigas ----------
function patternTiles(b, self, pattern, x, y, dir, len) {
  const [dx, dy] = dir;
  const px = -dy, py = dx;
  let rel;
  switch (pattern) {
    case 'ring': rel = DIRS; break;
    case 'ring8': rel = RING8; break;
    case 'arc': rel = [[dx, dy], [dx + px, dy + py], [dx - px, dy - py]]; break;
    case 'line2': rel = [[dx, dy], [2 * dx, 2 * dy]]; break;
    case 'line3': rel = [[dx, dy], [2 * dx, 2 * dy], [3 * dx, 3 * dy]]; break;
    case 'front': rel = [[dx, dy]]; break;
    case 'charge':        // la carga corre hasta lo primero que encuentra (y pega ahí)
    case 'shot': {
      const out = [];
      for (let k = 1; k <= len; k++) {
        const tx = x + dx * k, ty = y + dy * k;
        if (!inB(b, tx, ty) || tileDef(b, tx, ty).block) break;
        if (pattern === 'shot' && steamAt(b, tx, ty)) break;           // el vapor para los tiros
        out.push([tx, ty]);
        if (wallAt(b, tx, ty)) break;
        const o = unitAt(b, tx, ty);
        if (o && o !== self) break;
      }
      return out;
    }
    default: rel = [];
  }
  return rel.map(([ox, oy]) => [x + ox, y + oy]).filter(([tx, ty]) => inB(b, tx, ty));
}
/** Casillas que va a golpear un enemigo (desde donde está ahora). */
export function intentTiles(b, e) {
  if (!e.intent || !onBoard(e)) return [];
  if (e.intent.pattern === 'heal') { const t = unitById(b, e.intent.target); return t && onBoard(t) ? [[t.x, t.y]] : []; }
  return patternTiles(b, e, e.intent.pattern, e.x, e.y, e.intent.dir, e.intent.len);
}
function strike(b, e, ev) {
  const it = e.intent;
  const tiles = intentTiles(b, e);
  e.intent = null;
  ev.push({ type: 'strike', id: e.id, attack: it.id, tiles });
  const src = { side: 'enemy', unit: e, ranged: it.pattern === 'shot', element: it.element };
  if (it.pattern === 'heal') {          // el musgo cura al que marcó, esté donde esté
    const t = unitById(b, it.target);
    if (t && onBoard(t)) heal(b, t, it.heal, ev);
    return;
  }
  if (it.pattern === 'charge') return chargeStrike(b, e, it, tiles, src, ev);
  for (const [x, y] of tiles) {
    if (wallAt(b, x, y)) { if (it.element === 'brasa' && wallAt(b, x, y).root) applyElement(b, 'brasa', x, y, src, it.dir, ev); continue; }
    const t = unitAt(b, x, y);
    if (t === e) continue;
    if (t) {
      if (t.side === 'enemy') addCombo(b, 'fuego_amigo', ev);
      const high = isHigh(b, e) && !isHigh(b, t);
      hurt(b, t, it.dmg, { ...src, high }, ev);
      if (b.ended) return;
    }
    if (it.element && (t || it.element === 'brasa')) applyElement(b, it.element, x, y, src, it.dir, ev);
    if (t && it.push && onBoard(t)) shove(b, t, it.dir, src, ev);
    if (b.ended) return;
  }
}
/** La carga del jabalí: corre por la línea, pega y empuja a lo primero que encuentra; si no hay nadie, se estrella. */
function chargeStrike(b, e, it, tiles, src, ev) {
  let last = [e.x, e.y], hit = null, crashed = false;
  for (const [x, y] of tiles) {
    if (wallAt(b, x, y)) { crashed = true; break; }
    const t = unitAt(b, x, y);
    if (t) { hit = t; break; }
    last = [x, y];
    if (trapAt(b, x, y)) break;
  }
  if (!hit && !crashed) {
    // ¿qué hay después del final de la línea? un árbol, una roca o el borde: se estrella
    const nx = last[0] + it.dir[0], ny = last[1] + it.dir[1];
    crashed = tiles.length < it.len || !inB(b, nx, ny) || blocked(b, nx, ny);
  }
  if (last[0] !== e.x || last[1] !== e.y) {
    const from = [e.x, e.y];
    e.x = last[0]; e.y = last[1]; e.dir = it.dir;
    ev.push({ type: 'charge', id: e.id, from, to: last });
    landOn(b, e, { side: 'env' }, ev);
    if (!onBoard(e)) return;
  }
  if (hit) {
    if (hit.side === 'enemy') addCombo(b, 'fuego_amigo', ev);
    hurt(b, hit, it.dmg, src, ev);
    if (!b.ended && onBoard(hit) && it.push) shove(b, hit, it.dir, src, ev);
  } else if (crashed) {
    addCombo(b, 'estrellado', ev);
    ev.push({ type: 'crash', id: e.id });
    hurt(b, e, COMBAT.crashDmg, { side: 'env' }, ev);
    if (onBoard(e)) { e.root = Math.max(e.root, 1); ev.push({ type: 'root', id: e.id }); }
  }
}

/** A quién persigue (si no puede pegar ya). */
function chooseTarget(b, e) {
  const list = allies(b).filter(a => !a.safe && !(a.captive && !a.freed));   // atado y escondido: no lo ven
  if (!list.length) return null;
  const pref = ENEMIES[e.type].prefers;
  const near = (a) => man(a.x, a.y, e.x, e.y);
  if (pref === 'captive') { const c = list.find(a => a.captive); if (c) return c; }
  if (pref === 'leader') { const L = list.find(a => a.type === 'lider'); if (L) return L; }
  if (pref === 'wet') { const w = list.filter(a => isWet(b, a)).sort((a, c) => near(a) - near(c))[0]; if (w) return w; }
  if (pref === 'weak') return list.slice().sort((a, c) => (a.hp / a.maxHp) - (c.hp / c.maxHp) || near(a) - near(c))[0];
  return list.slice().sort((a, c) => near(a) - near(c) || a.hp - c.hp)[0];
}
function hitValue(b, e, atk, tiles) {
  let v = 0;
  const pref = ENEMIES[e.type].prefers;
  for (const [x, y] of tiles) {
    if (wallAt(b, x, y)) continue;
    const t = unitAt(b, x, y);
    if (!t || t === e) continue;
    if (t.side === 'enemy') { v -= atk.dmg * 0.7; continue; }
    if (t.captive && !t.freed) continue;
    v += atk.dmg + (atk.dmg >= t.hp ? 3 : 0);
    if (t.type === 'lider') v += pref === 'leader' ? 4 : 1.5;
    if (t.captive) v += pref === 'captive' ? 5 : 2;
    if (pref === 'weak') v += 2 * (1 - t.hp / t.maxHp);
    if (pref === 'wet' && isWet(b, t)) v += 3;
    if (atk.element === 'cefiro' && isWet(b, t)) v += COMBAT.shockDmg;
  }
  return v;
}
function bestAttackFrom(b, e, x, y) {
  let best = null;
  const ox = e.x, oy = e.y;
  e.x = x; e.y = y;                       // los tiros se calculan desde ahí
  for (const atk of enemyAttacks(e)) {
    if (atk.near && !allies(b).some(a => man(a.x, a.y, x, y) === 1)) continue;
    const dirs = atk.pattern === 'ring' || atk.pattern === 'ring8' ? [DIRS[2]] : DIRS;
    for (const dir of dirs) {
      const tiles = patternTiles(b, e, atk.pattern, x, y, dir, atk.len);
      let v = hitValue(b, e, atk, tiles);
      if (v <= 0) continue;
      if (ENEMIES[e.type].keepAway && allies(b).some(a => man(a.x, a.y, x, y) === 1)) v -= 1;
      if (!best || v > best.v) best = { v, atk, dir };
    }
  }
  e.x = ox; e.y = oy;
  return best;
}
function setIntent(b, e, best, ev) {
  // enc.foeDmg: golpe extra de los enemigos de ese encuentro (paso 7)
  e.intent = { id: best.atk.id, name: best.atk.name, pattern: best.atk.pattern, dmg: best.atk.dmg + (ENCOUNTERS[b.enc]?.foeDmg || 0) + (COMBAT.marea[b.marea || 1]?.dmg || 0), dir: best.dir, len: best.atk.len || 0 };
  if (best.atk.element) e.intent.element = best.atk.element;
  if (best.atk.push) e.intent.push = best.atk.push;
  e.dir = best.dir;
  ev.push({ type: 'intent', id: e.id, attack: best.atk.id, tiles: intentTiles(b, e) });
}
/** Distancia (en costo) de cada casilla hasta una unidad, para un enemigo (sin contar unidades). */
function distField(b, e, tx, ty) {
  const INF = 1e9, d = new Array(b.w * b.h).fill(INF);
  const swims = ENEMIES[e.type].swims;
  d[I(b, tx, ty)] = 0;
  const q = [[tx, ty]];
  while (q.length) {
    let k = 0;
    for (let j = 1; j < q.length; j++) if (d[I(b, q[j][0], q[j][1])] < d[I(b, q[k][0], q[k][1])]) k = j;
    const [x, y] = q.splice(k, 1)[0];
    const base = d[I(b, x, y)];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (blocked(b, nx, ny)) continue;
      const t = tileDef(b, nx, ny);
      const c = ENEMIES[e.type].flies ? 1 : t.high ? (swims ? INF : COMBAT.climb[0]) : t.water ? (swims ? 1 : COMBAT.waterCost) : 1;
      if (base + c < d[I(b, nx, ny)]) { d[I(b, nx, ny)] = base + c; q.push([nx, ny]); }
    }
  }
  return d;
}
/** Mueve (si puede) y marca el próximo golpe. Las trampas no se ven: si el camino pasa por una, cae y se frena ahí. */
function planEnemy(b, e, ev, canMove = true) {
  if (!onBoard(e)) return;
  e.intent = null;
  ensure(b);
  const def = ENEMIES[e.type], ai = def.ai || null;
  const swims = def.swims;
  // lo que no quiere pisar: el agua que sube y el fuego
  const wet = (x, y) => (!swims && !def.flies && (b.flood[I(b, x, y)] > 1 || b.floodNext.includes(I(b, x, y)))) || (!def.fireproof && fireAt(b, x, y));
  const al = allies(b).filter(a => !(a.captive && !a.freed));
  const nearAlly = (x, y) => Math.min(99, ...al.map(a => man(a.x, a.y, x, y)));
  // a quién cuida el guardián: el más frágil de los otros (el que cura, el nido, el que tira)
  const ward = ai === 'guard' ? foes(b).filter(f => f !== e && !ENEMIES[f.type].ward).sort((a, c) => a.maxHp - c.maxHp || man(a.x, a.y, e.x, e.y) - man(c.x, c.y, e.x, e.y))[0] || null : null;
  // lo que suma cada casilla según el arquetipo (se ve en cómo se mueve; el golpe sigue marcado como siempre)
  const posBonus = (x, y) => {
    const d = nearAlly(x, y);
    if (ai === 'kite') return d <= 1 ? -3 : d === 2 ? 0.5 : 1;                  // tira y se aleja
    if (ai === 'charge') return d >= 2 ? 1 : 0;                                // toma carrera
    if (ai === 'guard' && ward) return man(x, y, ward.x, ward.y) === 1 ? 4 - d * 0.1 : -man(x, y, ward.x, ward.y) * 0.5;
    if (ai === 'summon' || ai === 'heal') return Math.min(d, 4) * 0.6;         // se queda atrás
    return 0;
  };
  let dest = null, destBest = null;
  const reach = canMove && !e.root ? dijkstra(b, e, e.mv) : new Map([[I(b, e.x, e.y), { cost: 0, prev: -1 }]]);
  if (e.root) e.root--;
  const free = [];
  for (const [i, v] of reach) {
    const x = i % b.w, y = (i / b.w) | 0;
    const o = unitAt(b, x, y);
    if (o && o !== e) continue;
    free.push({ i, x, y, cost: v.cost });
  }
  let bestScore = -Infinity;
  for (const c of free) {
    const best = bestAttackFrom(b, e, c.x, c.y);
    if (!best) continue;
    const s = best.v - c.cost * 0.05 - (wet(c.x, c.y) ? 1.5 : 0) + rand(b) * 0.01 + (ai ? posBonus(c.x, c.y) : 0);
    if (s > bestScore) { bestScore = s; dest = c; destBest = best; }
  }
  // el musgo: si hay un enemigo lastimado a su alcance, lo cura en vez de pegar (y se ve a quién)
  let healPlan = null;
  if (ai === 'heal') {
    const hurtOnes = foes(b).filter(f => f !== e && f.hp < f.maxHp).sort((a, c) => (c.maxHp - c.hp) - (a.maxHp - a.hp) || a.id.localeCompare(c.id));
    const val = (c) => posBonus(c.x, c.y) - (wet(c.x, c.y) ? 1.5 : 0);
    for (const t of hurtOnes) {
      const spots = free.filter(c => man(c.x, c.y, t.x, t.y) <= def.heal.range);
      if (!spots.length) continue;
      healPlan = { t, spot: spots.sort((a, c) => val(c) - val(a) || a.cost - c.cost || a.i - c.i)[0] };
      break;
    }
    if (healPlan) { dest = healPlan.spot; destBest = null; }
  }
  if (!dest && (ai === 'guard' || ai === 'summon' || ai === 'heal')) {
    // sin golpe a tiro: el guardián se pega a quien cuida; el nido y el musgo se quedan atrás
    let bs = -Infinity;
    for (const c of free) {
      const s = posBonus(c.x, c.y) - (wet(c.x, c.y) ? 1.5 : 0) - c.cost * 0.01 + rand(b) * 0.001;
      if (s > bs) { bs = s; dest = c; }
    }
    if (ai === 'guard' && !ward) dest = null;       // quedó solo: va al frente como cualquiera
  }
  if (!dest) {
    // nadie a tiro: se acerca a su presa
    const tgt = chooseTarget(b, e);
    if (tgt) {
      const d = distField(b, e, tgt.x, tgt.y);
      let bs = Infinity;
      for (const c of free) {
        const s = d[c.i] + (wet(c.x, c.y) ? 1.5 : 0) + c.cost * 0.01 + rand(b) * 0.001;
        if (s < bs) { bs = s; dest = c; }
      }
    }
  }
  if (dest && (dest.x !== e.x || dest.y !== e.y)) {
    const path = pathTo(b, reach, dest.i);
    const from = [e.x, e.y];
    let stop = path[path.length - 1], trap = null;
    for (let k = 1; k < path.length; k++) {
      const tr = trapAt(b, path[k][0], path[k][1]);
      if (tr) { stop = path[k]; trap = tr; path.length = k + 1; break; }
    }
    const [px, py] = path[path.length - 2];
    e.x = stop[0]; e.y = stop[1];
    e.dir = [e.x - px, e.y - py];
    ev.push({ type: 'enemyMove', id: e.id, from, to: [e.x, e.y], path });
    if (trap) {
      triggerTrap(b, e, trap, ev);
      if (!onBoard(e)) return;
      destBest = bestAttackFrom(b, e, e.x, e.y);
      healPlan = null;
    } else if (!destBest && !healPlan) destBest = bestAttackFrom(b, e, e.x, e.y);
  }
  if (healPlan && onBoard(healPlan.t)) {
    e.intent = { id: 'curar', name: 'Curar', pattern: 'heal', dmg: 0, heal: def.heal.amount, target: healPlan.t.id, dir: e.dir, len: 0 };
    ev.push({ type: 'intent', id: e.id, attack: 'curar', tiles: intentTiles(b, e), heal: true });
  } else if (destBest) setIntent(b, e, destBest, ev);
  // acoso: al terminar de moverse muerde un poco al más débil que tenga al lado (no se marca: es la regla del bicho)
  const nip = ENEMIES[e.type].nip || 0;
  if (nip && onBoard(e)) {
    const adj = allies(b).filter(a => man(a.x, a.y, e.x, e.y) === 1).sort((a, c) => a.hp - c.hp || a.id.localeCompare(c.id));
    if (adj.length) { ev.push({ type: 'nip', id: e.id, target: adj[0].id }); hurt(b, adj[0], nip, { side: 'enemy', unit: e, nip: true }, ev); }
  }
}

// ---------- agua y refuerzos ----------
function planFlood(b, ev) {
  b.floodNext = [];
  const bs = bossOf(b);
  if (!bs || !onBoard(bs) || !ENEMIES[bs.type].swims) return;
  const rows = ENEMIES[bs.type].phases[phaseIdx(bs)].floodRows;
  const lowAt = (x, y) => TILES[b.tiles[I(b, x, y)]].low && !wallAt(b, x, y);
  let best = null;
  for (let y0 = 0; y0 <= b.h - rows; y0++) {
    let v = rand(b) * 0.5;
    for (const a of allies(b)) if (a.y >= y0 && a.y < y0 + rows && lowAt(a.x, a.y)) v += a.type === 'lider' ? 3 : 2;
    if (!best || v > best.v) best = { v, y0 };
  }
  for (let y = best.y0; y < best.y0 + rows; y++) for (let x = 0; x < b.w; x++) if (lowAt(x, y)) b.floodNext.push(I(b, x, y));
  ev.push({ type: 'floodNext', tiles: b.floodNext.map(i => [i % b.w, (i / b.w) | 0]) });
}
/**
 * Lo que llega en la próxima fase enemiga (se ve un turno antes). start: al armar la pelea, la bestia todavía no marca
 * el agua (recorrido de la noche: el campo arrancaba rayado entero y no se podía leer); la primera franja se marca
 * después del primer turno enemigo.
 */
function planIncoming(b, ev, start = false) {
  b.incoming = [];
  const next = b.turn;                         // la fase enemiga de este turno
  const enc = ENCOUNTERS[b.enc];
  for (const w of enc.waves || []) {
    if (w.turn !== next) continue;
    const pts = b.wavePoints.slice();
    for (const kind of w.kinds) {
      if (!pts.length) break;
      const k = Math.floor(rand(b) * pts.length);
      const [x, y] = pts.splice(k, 1)[0];
      b.incoming.push({ kind, x, y, from: 'wave' });
    }
  }
  const bs = bossOf(b);
  if (b.bridge && !b.bridge.cut && bs && onBoard(bs) && bs.type === 'capitana') {
    const every = ENEMIES.capitana.phases[phaseIdx(bs)].bridgeEvery;
    if (next % every === 0) {
      const kinds = enc.bridge.kinds;
      const [x, y] = b.bridge.tiles[b.bridge.count % b.bridge.tiles.length];
      b.incoming.push({ kind: kinds[b.bridge.count % kinds.length], x, y, from: 'bridge' });
    }
  }
  // el nido saca una larva al lado cada tantos turnos (se ve un turno antes, como los refuerzos)
  for (const e of foes(b)) {
    const sm = ENEMIES[e.type].summon;
    if (!sm || start || (next - (e.born || 1)) % sm.every !== 0) continue;
    if (foes(b).filter(f => f.type === sm.kind).length >= sm.max) continue;
    const spots = DIRS.map(([dx, dy]) => [e.x + dx, e.y + dy]).filter(([x, y]) => inB(b, x, y) && !blocked(b, x, y) && !unitAt(b, x, y) && !b.incoming.some(s => s.x === x && s.y === y));
    if (!spots.length) continue;
    const al = allies(b);
    const near = ([x, y]) => Math.min(99, ...al.map(a => man(a.x, a.y, x, y)));
    spots.sort((p, q) => near(p) - near(q));
    b.incoming.push({ kind: sm.kind, x: spots[0][0], y: spots[0][1], from: 'summon', by: e.id });
  }
  if (start) b.floodNext = []; else planFlood(b, ev);
  if (b.incoming.length) ev.push({ type: 'incoming', list: b.incoming.map(s => ({ ...s })) });
}
function spawn(b, s, ev) {
  if (s.from === 'bridge' && (!b.bridge || b.bridge.cut)) return;
  let at = null;
  if (!blocked(b, s.x, s.y) && !unitAt(b, s.x, s.y)) at = [s.x, s.y];
  else {
    // la casilla libre más cercana
    let bd = Infinity;
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      if (blocked(b, x, y) || unitAt(b, x, y) || isHighAt(b, x, y)) continue;
      const d = man(x, y, s.x, s.y) + (y * b.w + x) * 1e-4;
      if (d < bd) { bd = d; at = [x, y]; }
    }
  }
  if (!at) return;
  if (s.from === 'summon' && !b.units.some(k => k.id === s.by && onBoard(k))) return;
  const u = makeUnit(b, 'enemy', s.kind, at[0], at[1], { born: b.turn });
  if (s.from === 'bridge') b.bridge.count++;
  ev.push({ type: 'spawn', id: u.id, kind: s.kind, at, from: s.from });
}

// ---------- turnos ----------
export function endTurn(b) {
  if (b.ended) return { ok: false, why: 'La pelea terminó', events: [] };
  if (b.phase !== 'player') return { ok: false, why: 'No es tu turno', events: [] };
  b.phase = 'enemy';
  return { ok: true, events: [{ type: 'endTurn', turn: b.turn }] };
}

export function enemyTurn(b) {
  if (b.ended) return { ok: false, why: 'La pelea terminó', events: [] };
  if (b.phase !== 'enemy') return { ok: false, why: 'Primero terminá tu turno', events: [] };
  const ev = [{ type: 'enemyPhase', turn: b.turn }];
  // 1. golpes marcados
  for (const e of foes(b)) {
    if (e.intent && onBoard(e)) strike(b, e, ev);
    if (checkEnd(b, ev)) return { ok: true, events: ev };
  }
  // 2. el agua
  const bs = bossOf(b);
  const floodLv = bs && onBoard(bs) ? phaseIdx(bs) : 0;
  for (let i = 0; i < b.flood.length; i++) if (b.flood[i] > 0) b.flood[i]--;
  for (const i of b.floodNext) b.flood[i] = COMBAT.floodTurns;
  if (b.floodNext.length) ev.push({ type: 'flood', tiles: b.floodNext.map(i => [i % b.w, (i / b.w) | 0]) });
  b.floodNext = [];
  for (const u of b.units.slice()) {
    if (!onBoard(u) || b.flood[I(b, u.x, u.y)] <= 0) continue;
    if (u.side === 'enemy' && ENEMIES[u.type].swims) continue;
    hurt(b, u, COMBAT.floodDmg[floodLv], { side: u.side === 'ally' ? 'enemy' : 'env' }, ev);
  }
  if (checkEnd(b, ev)) return { ok: true, events: ev };
  // 2b. (paso A2) el fuego quema, la corriente arrastra, y se van el vapor, lo mojado y lo quemado
  if (elementTick(b, ev)) return { ok: true, events: ev };
  // 3. paredes
  for (const w of b.walls) w.turns--;
  const gone = b.walls.filter(w => w.turns <= 0);
  if (gone.length) { b.walls = b.walls.filter(w => w.turns > 0); ev.push({ type: 'wallGone', tiles: gone.map(w => [w.x, w.y]) }); }
  b.cover = {};
  // 4. refuerzos
  for (const s of b.incoming) spawn(b, s, ev);
  b.incoming = [];
  // 5. fase de los jefes
  for (const e of foes(b)) {
    const k = phaseIdx(e);
    if (k !== e.phase) { e.phase = k; ev.push({ type: 'phase', id: e.id, phase: k, text: ENEMIES[e.type].phases[k].text }); }
  }
  // 6. se mueven y marcan
  // (los guardianes al final: se acomodan al lado de quien cuidan, ya movido)
  const order = foes(b); order.sort((a, c) => (ENEMIES[a.type].ai === 'guard') - (ENEMIES[c.type].ai === 'guard'));
  for (const e of order) { planEnemy(b, e, ev, true); if (checkEnd(b, ev)) return { ok: true, events: ev }; }
  // 7. objetivo de aguante
  if (b.objective.type === 'survive' && b.turn >= b.objective.turns) {
    end(b, 'win', 'aguante', ev);
    return { ok: true, events: ev };
  }
  // 8. turno nuevo
  b.turn++;
  if (b.turn > b.maxTurns) { end(b, 'lose', 'noche', ev); return { ok: true, events: ev }; }
  planIncoming(b, ev);
  for (const u of b.units) {
    if (u.side !== 'ally') continue;
    u.moved = !!(u.captive && !u.freed); u.acted = false;
    for (const k of Object.keys(u.cd)) if (u.cd[k] > 0) u.cd[k]--;
  }
  b.phase = 'player';
  ev.push({ type: 'turn', turn: b.turn });
  return { ok: true, events: ev };
}

function elementTick(b, ev) {
  ensure(b);
  if (!b.fire.some(n => n > 0) && !b.steam.some(n => n > 0) && !b.units.some(u => onBoard(u) && (u.burn || u.wet)) && !b.tiles.some(t => TILES[t].flow)) return false;
  for (const u of b.units.slice()) {
    if (!onBoard(u)) continue;
    const src = { side: u.side === 'ally' ? 'enemy' : 'env', nip: true, pierce: true };
    if (fireAt(b, u.x, u.y) && !fireproof(u)) { hurt(b, u, COMBAT.fireDmg, src, ev); if (onBoard(u)) burn(b, u, src, ev); }
    else if (u.burn > 0) {
      if (isWet(b, u)) u.burn = 0;
      else { hurt(b, u, COMBAT.burnDmg, src, ev); u.burn--; }
      if (onBoard(u) && !u.burn) ev.push({ type: 'status', id: u.id, status: 'burn', on: false });
    }
    if (onBoard(u) && u.wet > 0 && !--u.wet) ev.push({ type: 'status', id: u.id, status: 'wet', on: false });
  }
  if (checkEnd(b, ev)) return true;
  // la corriente
  for (const u of b.units.slice()) {
    if (!onBoard(u)) continue;
    const flow = tileDef(b, u.x, u.y).flow;
    if (!flow || (u.side === 'enemy' && (ENEMIES[u.type].flies || ENEMIES[u.type].heavy))) continue;
    const nx = u.x + flow[0], ny = u.y + flow[1];
    if (blocked(b, nx, ny) || unitAt(b, nx, ny)) continue;
    ev.push({ type: 'drift', id: u.id, from: [u.x, u.y], to: [nx, ny] });
    u.x = nx; u.y = ny;
    landOn(b, u, { side: 'env' }, ev);
  }
  const out = [], clear = [];
  b.fire = b.fire.map((n, i) => { if (n === 1) out.push([i % b.w, (i / b.w) | 0]); return n > 0 && n < 90 ? n - 1 : n; });
  b.steam = b.steam.map((n, i) => { if (n === 1) clear.push([i % b.w, (i / b.w) | 0]); return n > 0 ? n - 1 : 0; });
  if (out.length) ev.push({ type: 'fireOut', tiles: out });
  if (clear.length) ev.push({ type: 'steamGone', tiles: clear });
  return checkEnd(b, ev);
}

function end(b, outcome, reason, ev) {
  b.ended = true; b.outcome = outcome; b.reason = reason; b.phase = 'ended';
  ev.push({ type: 'end', outcome, reason });
}
function checkEnd(b, ev) {
  if (b.ended) return true;
  const L = leaderOf(b);
  if (!L || !L.alive) { end(b, 'lose', 'lider', ev); return true; }
  const c = captiveOf(b);
  if (c && !c.alive) { end(b, 'lose', 'cautivo', ev); return true; }
  if (b.objective.type === 'rescue' && c && c.safe) { end(b, 'win', 'rescate', ev); return true; }
  if (b.objective.type === 'defeat') {
    const bs = bossOf(b);
    if (b.objective.boss && bs) { if (!bs.alive) { end(b, 'win', 'jefe', ev); return true; } return false; }
    const pendingWaves = (ENCOUNTERS[b.enc].waves || []).some(w => w.turn > b.turn) || b.incoming.length;
    if (!foes(b).length && !pendingWaves) { end(b, 'win', 'derrota', ev); return true; }
  }
  return false;
}

export function retreat(b) {
  if (b.ended) return { ok: false, why: 'La pelea terminó', events: [] };
  const ev = [];
  end(b, 'retreat', 'retirada', ev);
  return { ok: true, events: ev };
}

// ---------- vista ----------
/** Enemigos cuyas intenciones se ven: los jefes siempre; del resto, los más cercanos al grupo (más con el Catalejo). */
export function visibleIntentIds(b) {
  const lv = Math.max(0, Math.min(5, b.tools.catalejo || 0));
  const n = COMBAT.intentsBase + COMBAT.catalejo[lv] + (b.intentPlus || 0);
  const al = allies(b);
  const dist = (e) => Math.min(99, ...al.map(a => man(a.x, a.y, e.x, e.y)));
  const list = foes(b).filter(e => !ENEMIES[e.type].boss).sort((a, c) => dist(a) - dist(c) || a.id.localeCompare(c.id));
  const ids = new Set(list.slice(0, n).map(e => e.id));
  for (const e of foes(b)) if (ENEMIES[e.type].boss) ids.add(e.id);
  return ids;
}
/** Daño que espera cada casilla en la próxima fase enemiga, con lo que se ve (marcas a la vista y agua). */
export function dangerMap(b) {
  const d = new Array(b.w * b.h).fill(0);
  const vis = visibleIntentIds(b);
  for (const e of foes(b)) {
    if (!e.intent || !vis.has(e.id)) continue;
    for (const [x, y] of intentTiles(b, e)) d[I(b, x, y)] += e.intent.dmg;
  }
  const bs = bossOf(b);
  const lv = bs && onBoard(bs) ? phaseIdx(bs) : 0;
  for (let i = 0; i < d.length; i++) if (b.flood[i] > 1 || b.floodNext.includes(i)) d[i] += COMBAT.floodDmg[lv];
  if (b.fire) for (let i = 0; i < d.length; i++) if (b.fire[i] > 0) d[i] += COMBAT.fireDmg;
  return d;
}

export function view(b) {
  ensure(b);
  const vis = visibleIntentIds(b);
  const danger = dangerMap(b);
  const tiles = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const i = I(b, x, y), w = wallAt(b, x, y);
    tiles.push({
      x, y, t: b.tiles[i], high: b.tiles[i] === 'alto', flood: b.flood[i], floodNext: b.floodNext.includes(i),
      wall: w ? w.turns : 0, rootWall: !!w?.root, trap: !!trapAt(b, x, y), exit: b.tiles[i] === 'salida',
      bridge: b.tiles[i] === 'pasarela', danger: danger[i],
      fire: b.fire[i], steam: b.steam[i], cover: !!TILES[b.tiles[i]].cover, water: !!TILES[b.tiles[i]].water, flow: TILES[b.tiles[i]].flow || null,
      incoming: b.incoming.find(s => s.x === x && s.y === y)?.kind || null,
    });
  }
  const units = b.units.filter(onBoard).map(u => {
    const d = u.side === 'ally' ? UNITS[u.type] : ENEMIES[u.type];
    let intent = null;
    if (u.side === 'enemy' && u.intent) intent = vis.has(u.id) ? { name: u.intent.name, dmg: u.intent.dmg, tiles: intentTiles(b, u), heal: u.intent.heal || 0, element: u.intent.element || null, pattern: u.intent.pattern } : { hidden: true };
    return {
      id: u.id, side: u.side, type: u.type, cls: u.cls || null, name: d.name, x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp, mv: u.mv, atk: u.atk,
      armor: u.armor, stuck: isStuck(b, u), moved: u.moved, acted: u.acted, root: u.root, marked: u.marked, high: isHigh(b, u),
      captive: !!u.captive, freed: !!u.freed, boss: !!(u.side === 'enemy' && ENEMIES[u.type].boss), phase: u.phase,
      heavy: !!(u.side === 'enemy' && ENEMIES[u.type].heavy), explode: !!(u.side === 'enemy' && ENEMIES[u.type].explode),
      abilities: u.side === 'ally' ? abilitiesOf(b, u.id).map(a => ({ id: a.id, name: a.def.name, kind: a.def.kind, cd: a.cd, ready: a.ready, text: a.def.text, item: !!a.item })) : [],
      intent,
      // paso A2: estados y lo que hace distinto a cada enemigo
      wet: isWet(b, u), burn: u.burn || 0, ai: u.side === 'enemy' ? ENEMIES[u.type].ai || null : null,
      warded: u.side === 'enemy' && wardedBy(b, u), cover: !!tileDef(b, u.x, u.y).cover,
      element: u.side === 'enemy' ? ENEMIES[u.type].element || null : null,
    };
  });
  const enc = ENCOUNTERS[b.enc];
  const o = b.objective;
  const objText = o.type === 'survive' ? `Aguantá ${o.turns} turnos (${Math.min(b.turn, o.turns)}/${o.turns})`
    : o.type === 'rescue' ? (captiveOf(b)?.freed ? 'Llevá al minero a la salida' : 'Desatá al minero')
    : o.boss ? `Vencé a ${ENEMIES[bossOf(b)?.type]?.name.toLowerCase() || 'el jefe'}` : 'Vencé a todos';
  return {
    enc: b.enc, name: enc.name, text: enc.text, kind: b.kind, turn: b.turn, maxTurns: b.maxTurns, phase: b.phase,
    ended: b.ended, outcome: b.outcome, reason: b.reason, w: b.w, h: b.h, tiles, units, marea: b.marea || 1, farm: !!enc.farm, leader: { cls: b.leader?.cls || null },
    objective: { type: o.type, text: objText, turns: o.turns || 0 },
    challenges: (enc.challenges || []).map(c => ({ id: c.id, name: CHALLENGES[c.id].name, text: CHALLENGES[c.id].text(c), done: challengeDone(b, c) })),
    items: { ...b.items }, bridge: b.bridge ? { hp: b.bridge.hp, max: b.bridge.max, cut: b.bridge.cut } : null,
    incoming: b.incoming.map(s => ({ ...s })), canEnd: b.phase === 'player' && !b.ended, canRetreat: !b.ended,
  };
}

// ---------- resultado ----------
function challengeDone(b, c) {
  switch (c.id) {
    case 'sinBajas': return b.stats.downs === 0;
    case 'turnos': return b.turn <= c.n;
    case 'combo': return b.stats.combos.length >= c.n;
    case 'reaccion': return (b.stats.reacts || 0) > 0;
    case 'pasarela': return !!b.bridge?.cut;
    case 'rescateLimpio': return !captiveOf(b)?.hurt;
    case 'liderIntacto': return !leaderOf(b)?.hurt;
    default: return false;
  }
}
export function result(b) {
  const enc = ENCOUNTERS[b.enc];
  const win = b.outcome === 'win';
  const challenges = (enc.challenges || []).map(c => ({ id: c.id, name: CHALLENGES[c.id].name, done: win && challengeDone(b, c) }));
  const stars = win ? Math.min(3, 1 + challenges.filter(c => c.done).length) : 0;
  const M = COMBAT.marea[b.marea || 1];
  const f = COMBAT.lootByStars[stars] * M.loot;
  const mats = {};
  if (win) {
    for (const [k, n] of Object.entries(enc.reward.mats || {})) mats[k] = Math.max(1, Math.round(n * f));
    const keys = Object.keys(enc.reward.mats || {});
    const extra = b.stats.stolen + (b.lootWin || 0);
    if (keys.length) for (let k = 0; k < extra; k++) mats[keys[k % keys.length]] = (mats[keys[k % keys.length]] || 0) + 1;
  }
  const xp = Math.round((enc.reward.xp || 0) * M.xp * (win ? 1 : b.outcome === 'lose' ? 0.3 : b.outcome === 'retreat' ? 0.2 : 0));
  return {
    enc: b.enc, kind: b.kind, outcome: b.outcome, reason: b.reason, turns: b.turn, stars, challenges,
    loot: { mats }, xp, morale: b.outcome === 'lose' ? COMBAT.morale.lose : b.outcome === 'retreat' ? COMBAT.morale.retreat : 0,
    combos: [...new Set(b.stats.combos)], comboCount: b.stats.combos.length, downs: b.stats.downs,
    dmg: { ...b.stats.dmg }, kills: { ...b.stats.kills }, marea: b.marea || 1, reacts: b.stats.reacts || 0, reactDmg: b.stats.reactDmg || 0,
    page: win ? enc.reward.page || null : null, flag: win ? enc.reward.flag || null : null, attempt: b.attempt,
  };
}

/** Las peleas comunes ya ganadas se pueden resolver rápido (sin jugarlas): menos botín y sin estrellas extra. */
export function canQuickResolve(encounter, wins = 0) {
  const enc = ENCOUNTERS[encounter];
  return !!enc && enc.kind === 'comun' && wins > 0;
}
/**
 * Resolución automática (paso A2): una pelea común ya ganada con 3 estrellas en esa Marea se resuelve sola, con el botín
 * y la XP completos (los de 3 estrellas). best: las estrellas del mejor resultado en esa Marea.
 */
export function canAutoResolve(encounter, best = 0) {
  const enc = ENCOUNTERS[encounter];
  return !!enc && enc.kind === 'comun' && best >= 3;
}
/** → el mismo formato que result(), con auto: true y un resumen corto en summary: { mats, xp, stars }. */
export function autoResolve({ encounter, best = 3, marea = 1, lootWin = 0 } = {}) {
  if (!canAutoResolve(encounter, best)) return null;
  const enc = ENCOUNTERS[encounter];
  const M = COMBAT.marea[Math.max(1, Math.min(COMBAT.marea.length - 1, marea | 0 || 1))];
  const mats = {};
  for (const [k, n] of Object.entries(enc.reward.mats || {})) mats[k] = Math.max(1, Math.round(n * COMBAT.lootByStars[3] * M.loot));
  const keys = Object.keys(mats);
  for (let k = 0; k < lootWin && keys.length; k++) mats[keys[k % keys.length]]++;
  const xp = Math.round((enc.reward.xp || 0) * M.xp);
  return {
    enc: enc.id, kind: enc.kind, outcome: 'win', reason: 'auto', quick: true, auto: true, turns: 0, stars: 3,
    challenges: (enc.challenges || []).map(c => ({ id: c.id, name: CHALLENGES[c.id].name, done: true })),
    loot: { mats }, xp, morale: 0, combos: [], comboCount: 0, downs: 0, dmg: {}, kills: {}, marea: M === COMBAT.marea[1] ? 1 : COMBAT.marea.indexOf(M),
    reacts: 0, reactDmg: 0, page: null, flag: null, attempt: 1, summary: { name: enc.name, mats: { ...mats }, xp, stars: 3 },
  };
}
/** Con stars: 3 (las mejores estrellas en esa pelea) es la resolución automática completa; si no, la rápida de siempre. */
export function quickResolve({ encounter, wins = 1, stars = 0, marea = 1, lootWin = 0 } = {}) {
  if (stars >= 3 && canAutoResolve(encounter, stars)) return autoResolve({ encounter, best: stars, marea, lootWin });
  if (!canQuickResolve(encounter, wins)) return null;
  const enc = ENCOUNTERS[encounter];
  const mats = {};
  for (const [k, n] of Object.entries(enc.reward.mats || {})) mats[k] = Math.max(1, Math.floor(n * COMBAT.quick.loot * COMBAT.lootByStars[1]));
  return {
    enc: enc.id, kind: enc.kind, outcome: 'win', reason: 'rapido', quick: true, turns: 0, stars: 1,
    challenges: (enc.challenges || []).map(c => ({ id: c.id, name: CHALLENGES[c.id].name, done: false })),
    loot: { mats }, xp: Math.round((enc.reward.xp || 0) * 0.5), morale: 0, combos: [], comboCount: 0, downs: 0,
    dmg: {}, kills: {}, page: null, flag: null, attempt: 1,
  };
}

// ---------- copia y previsualización ----------
/** Copia rápida (las casillas se comparten y se copian al escribir; las intenciones nunca se mutan). */
export function cloneBattle(b) {
  return {
    ...b,
    units: b.units.map(u => ({ ...u, cd: { ...u.cd } })),
    walls: b.walls.map(w => ({ ...w })), traps: b.traps.map(t => ({ ...t })),
    fire: b.fire ? b.fire.slice() : undefined, steam: b.steam ? b.steam.slice() : undefined,
    flood: b.flood.slice(), floodNext: b.floodNext.slice(), incoming: b.incoming.map(s => ({ ...s })),
    cover: { ...b.cover }, items: { ...b.items }, objective: { ...b.objective }, tools: { ...b.tools },
    bridge: b.bridge ? { ...b.bridge } : null,
    stats: { ...b.stats, dmg: { ...b.stats.dmg }, kills: { ...b.stats.kills }, combos: b.stats.combos.slice() },
  };
}
/** Qué pasaría (sin tocar b). from = [x, y] para probar desde otra casilla (sin validar el camino). */
export function preview(b, unitId, abilityId, x, y, from = null) {
  const c = cloneBattle(b);
  const u = unitById(c, unitId);
  if (!u) return { ok: false, events: [], after: c };
  if (from && (from[0] !== u.x || from[1] !== u.y)) { u.x = from[0]; u.y = from[1]; u.moved = true; }
  const r = abilityId ? act(c, unitId, abilityId, x, y) : { ok: true, events: [] };
  return { ok: r.ok, why: r.why, events: r.events, after: c };
}
