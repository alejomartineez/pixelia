// Expedición: motor puro (DESIGN-CORE.md §2.11). Sin three.js, sin DOM, sin store ni bus: se testea en Node.
// `run` es JSON puro (se guarda en state.expedition.active y se retoma). Mismo seed + mismas elecciones = mismo resultado:
// toda la suerte sale de run.rs (estado del mulberry32).
//
//   newRun({ region, zone, kind, seed, party, equip, prov, mods }) → run
//   view(run)              → lo que se ve: casillas visibles, pos, prov, ánimo, carga, regreso, movimientos, decisión pendiente
//   move(run, x, y)        → { ok, events }        (un peligro o una ruina dejan run.pending sin moverse todavía)
//   choose(run, optionId)  → { ok, outcome, p, events }   ('retroceder' cancela un peligro sin costo)
//   useItem(run, id)       → { ok, events }        ('botiquin' | 'atender' | 'soltar:madera')
//   goHome(run)            → { result, events }
//   result(run)            → { stars, starCount, loot, reason, steps, objectiveDone, ... }
import { EXP, TERRAIN, REGIONS, HAZARDS, MAT_IDS, ringOf, lootValue } from './exp-data.js';
import { generateMap } from './exp-gen.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// ---------- suerte serializable ----------
function rand(run) {
  let a = (run.rs = (run.rs + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (run, lo, hi) => lo + Math.floor(rand(run) * (hi - lo + 1));

// ---------- ayudas ----------
const idx = (run, x, y) => y * run.w + x;
const cellAt = (run, x, y) => (x < 0 || y < 0 || x >= run.w || y >= run.h ? null : run.cells[idx(run, x, y)]);
export const hasRole = (run, role) => run.party.includes(role);
export const roleLevel = (run, role) => (hasRole(run, role) ? Math.max(1, run.roleLevel[role] || 1) : 0);
const tier = (run) => (REGIONS[run.region] || REGIONS.bosque).tier;
const cargoCount = (run) => Object.values(run.cargo).reduce((a, n) => a + n, 0);
const hasEquip = (run, id) => run.equip.includes(id);

export function stepCost(run, cell) {
  const t = TERRAIN[cell.terrain];
  return hasRole(run, 'guia') ? t.guia : t.cost;
}

function visionRadius(run) {
  return (hasRole(run, 'exploracion') ? EXP.visionExploracion : EXP.vision) + (run.mods.vision || 0);
}
/** Abre la niebla a distancia ≤ radius (Manhattan; square = en cuadrado, como desde el mirador). */
function reveal(run, cx, cy, radius, events, square = false) {
  const out = [];
  for (let y = 0; y < run.h; y++) for (let x = 0; x < run.w; x++) {
    const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
    if ((square ? Math.max(dx, dy) : dx + dy) > radius) continue;
    const c = cellAt(run, x, y);
    if (!c.seen) { c.seen = true; out.push([x, y]); }
  }
  if (out.length && events) events.push({ type: 'reveal', cells: out });
  return out;
}

/** Pasos del camino más corto por casillas visitadas desde (x,y) hasta la base (extra = una casilla más que cuenta como visitada). */
function homeSteps(run, x, y, extra = null) {
  const ok = (i) => run.cells[i].visited || i === extra;
  const start = idx(run, x, y), goal = idx(run, run.base[0], run.base[1]);
  if (start === goal) return 0;
  const seen = new Map([[start, 0]]);
  const q = [start];
  while (q.length) {
    const u = q.shift(), ux = u % run.w, uy = (u / run.w) | 0, d = seen.get(u);
    for (const [dx, dy] of DIRS) {
      const nx = ux + dx, ny = uy + dy;
      if (nx < 0 || ny < 0 || nx >= run.w || ny >= run.h) continue;
      const v = idx(run, nx, ny);
      if (seen.has(v) || !ok(v)) continue;
      if (v === goal) return d + 1;
      seen.set(v, d + 1); q.push(v);
    }
  }
  return Infinity;
}
/** Costo de volver = ceil(d/3) por casillas ya visitadas (Guía: −1, mínimo 1; en la base es 0). */
export function returnCostFrom(run, x, y, extra = null) {
  const d = homeSteps(run, x, y, extra);
  if (d === 0) return 0;
  if (d === Infinity) return 99;
  return Math.max(1, Math.ceil(d / 3) - (hasRole(run, 'guia') ? 1 : 0));
}
export const returnCost = (run) => returnCostFrom(run, run.pos[0], run.pos[1]);

/** Probabilidad final de una opción y la línea de detalle (§2.6). */
export function optionChance(run, hz, opt) {
  if (opt.base >= 100) return { p: 100, sure: true, parts: [] };
  const parts = [[opt.base, 'base']];
  for (const [role, bonus] of Object.entries(opt.role || {})) {
    if (!hasRole(run, role)) continue;
    const lv = roleLevel(run, role);
    parts.push([bonus + EXP.roleStep * (lv - 1), ROLE_NAMES[role] + (lv > 1 ? ' ' + lv : '')]);
  }
  for (const [eq, bonus] of Object.entries(opt.equip || {})) if (hasEquip(run, eq)) parts.push([bonus, EQUIP_NAMES[eq]]);
  if (run.mods.regionBonus) parts.push([run.mods.regionBonus, 'hallazgos']);
  if (run.care) parts.push([run.care, 'con cuidado']);
  if (run.zone > 1) parts.push([-EXP.zonePenalty * (run.zone - 1), 'zona ' + run.zone]);
  if (tier(run) > 1) parts.push([-EXP.tierPenalty * (tier(run) - 1), 'región']);
  const raw = parts.reduce((a, [n]) => a + n, 0);
  return { p: Math.max(EXP.probMin, Math.min(EXP.probMax, raw)), sure: false, parts };
}
const ROLE_NAMES = { exploracion: 'Exploración', ingenieria: 'Ingeniería', sanidad: 'Sanidad', recoleccion: 'Recolección', guia: 'Guía' };
const EQUIP_NAMES = { cuerda: 'Cuerda', pala: 'Pala', lona: 'Lona', farol: 'Farol', botiquin: 'Botiquín', carreta: 'Carreta' };

/** Costo en provisiones de una opción (además del paso) y si se puede elegir. */
function optionCost(run, opt) {
  let prov = opt.cost?.prov || 0, mats = null, can = true, why = '';
  if (prov && opt.guiaProv && hasRole(run, 'guia')) prov += opt.guiaProv;
  if (prov && opt.lonaProv && hasEquip(run, 'lona')) prov += opt.lonaProv;
  if (opt.needs === 'fuego' && !hasEquip(run, 'farol')) {
    mats = { madera: 1 };
    if (!(run.cargo.madera > 0)) { can = false; why = 'Hace falta 1 de madera (o un Farol)'; }
  }
  return { prov: Math.max(0, prov), mats, can, why };
}

function buildOptions(run, hzId, stepC) {
  const hz = HAZARDS[hzId];
  return hz.options.map(o => {
    const ch = optionChance(run, hz, o), cost = optionCost(run, o);
    const total = stepC + cost.prov;
    const can = cost.can && total <= run.prov;
    return {
      id: o.id, label: o.label, p: ch.p, sure: ch.sure,
      detail: ch.parts.map(([n, t], i) => (i === 0 ? `${n} ${t}` : `${n >= 0 ? '+' : '−'}${Math.abs(n)} ${t}`)).join(' · '),
      prov: cost.prov, mats: cost.mats, can, why: !cost.can ? cost.why : total > run.prov ? 'No alcanzan las provisiones' : '',
      ok: describe(o.ok), fail: ch.sure ? null : describe(o.fail),
    };
  });
}
/** Efectos en datos simples para que la UI los muestre ("−2 ánimo · −1 provisión"). */
function describe(fx) {
  if (!fx) return null;
  const out = {};
  if (fx.morale) out.morale = fx.morale;
  if (fx.prov) out.prov = fx.prov;
  if (fx.loseMat) out.loseMat = fx.loseMat;
  if (fx.mats) out.mats = { ...fx.mats };
  if (fx.loot) out.loot = fx.loot;
  return out;
}

// ---------- crear ----------
export function newRun({ region = 'bosque', zone = 1, kind = 'normal', seed = 1, party = [], equip = [], prov, mods = {} } = {}) {
  const map = generateMap({ region, zone, kind, seed });
  const K = EXP.kinds[kind] || EXP.kinds.normal;
  const roleLv = { ...(mods.roleLevel || {}) };
  const sanidad = party.includes('sanidad');
  const moraleMax = mods.moraleMax ?? EXP.morale + (sanidad ? EXP.moraleSanidad : 0);
  // la salida corta va con la mochila chica: la mitad de la carga
  const cargoMax = Math.max(3, Math.ceil((mods.cargoMax ?? EXP.cargoBase + (equip.includes('carreta') ? EXP.carreta : 0)) * (K.cargoFactor || 1)));
  const startProv = prov ?? (kind === 'corta' ? K.prov : EXP.prototype.prov);
  const run = {
    v: 1, region: map.region, zone, kind, seed: seed >>> 0, rs: (seed ^ 0x9e3779b9) | 0,
    w: map.w, h: map.h, base: map.base,
    cells: map.cells.map(c => ({ ...c, seen: false, visited: false, done: false, drops: null, amt: 0 })),
    objective: { ...map.objective, known: false, done: false },
    pos: map.base.slice(), prev: null,
    prov: startProv, provStart: startProv,
    morale: moraleMax, moraleMax, cargoMax,
    cargo: {}, planos: 0, finds: [], colonos: 0,
    steps: 0, party: party.slice(), equip: equip.slice(), roleLevel: roleLv, mods: { ...mods },
    used: {}, shield: sanidad,             // Sanidad: el primer peligro fallado baja 1 menos
    pending: null, ended: false, reason: null, objectiveDone: false, decisions: [], result: null,
  };
  const b = cellAt(run, run.base[0], run.base[1]);
  b.visited = true; b.done = true;
  reveal(run, run.base[0], run.base[1], visionRadius(run));
  return run;
}

// ---------- vista ----------
export function view(run) {
  const cells = run.cells.map((c, i) => {
    const x = i % run.w, y = (i / run.w) | 0;
    if (!c.seen) return { x, y, seen: false, depth: c.depth };
    return { x, y, seen: true, visited: c.visited, done: c.done, terrain: c.terrain, content: c.content, sub: c.sub, depth: c.depth, drops: c.drops };
  });
  const rc = returnCost(run);
  const moves = [];
  if (!run.ended) for (const [dx, dy] of DIRS) {
    const x = run.pos[0] + dx, y = run.pos[1] + dy, c = cellAt(run, x, y);
    if (!c) continue;
    const cost = stepCost(run, c);
    const after = returnCostFrom(run, x, y, idx(run, x, y));
    moves.push({ x, y, cost, ok: !run.pending && cost <= run.prov, safe: run.prov - cost >= after, returnAfter: after });
  }
  const o = run.objective;
  const objCellKnown = o.cell && (o.known || cellAt(run, o.cell[0], o.cell[1]).seen);
  return {
    w: run.w, h: run.h, base: run.base, cells, pos: run.pos.slice(),
    prov: run.prov, provStart: run.provStart, morale: run.morale, moraleMax: run.moraleMax,
    cargo: { ...run.cargo }, cargoN: cargoCount(run), cargoMax: run.cargoMax,
    planos: run.planos, finds: run.finds.slice(), colonos: run.colonos, steps: run.steps,
    returnCost: rc, canReturn: run.prov >= rc, moves, pending: run.pending,
    objective: { type: o.type, name: o.name, mat: o.mat, n: o.n, hint: o.hint, cell: objCellKnown ? o.cell : null, done: run.objectiveDone },
    ended: run.ended, reason: run.reason, nextTired: EXP.tiredEvery - (run.steps % EXP.tiredEvery),
    items: itemsAvailable(run),
  };
}
function itemsAvailable(run) {
  const out = [];
  if (hasEquip(run, 'botiquin') && !run.used.botiquin) out.push('botiquin');
  if (roleLevel(run, 'sanidad') >= 3 && !run.used.atender) out.push('atender');
  return out;
}

// ---------- efectos ----------
function addMorale(run, n, reason, events) {
  const before = run.morale;
  run.morale = Math.max(0, Math.min(run.moraleMax, run.morale + n));
  if (run.morale !== before) events.push({ type: 'morale', delta: run.morale - before, value: run.morale, reason });
}
function addProv(run, n, reason, events) {
  const before = run.prov;
  run.prov = Math.max(0, run.prov + n);
  if (run.prov !== before) events.push({ type: 'prov', delta: run.prov - before, value: run.prov, reason });
}
/** Pone materiales en la casilla actual y junta lo que entre en la carga. */
function giveMats(run, mats, events, reason) {
  const c = cellAt(run, run.pos[0], run.pos[1]);
  c.drops = c.drops || {};
  for (const [m, n] of Object.entries(mats)) if (n > 0) c.drops[m] = (c.drops[m] || 0) + n;
  pickup(run, events, null, reason);
}
function pickup(run, events, except = null, reason = 'loot') {
  const c = cellAt(run, run.pos[0], run.pos[1]);
  if (!c.drops) return;
  const got = {}, left = {};
  for (const m of MAT_IDS) {
    const n = c.drops[m] || 0;
    if (!n || m === except) { if (n) left[m] = n; continue; }
    const take = Math.min(n, run.cargoMax - cargoCount(run));
    if (take > 0) { run.cargo[m] = (run.cargo[m] || 0) + take; got[m] = take; }
    if (n - take > 0) left[m] = n - take;
  }
  c.drops = Object.keys(left).length ? left : null;
  if (Object.keys(got).length || c.drops) events.push({ type: 'loot', mats: got, left: c.drops ? { ...c.drops } : null, reason });
}
function regionMat(run) {
  const R = REGIONS[run.region];
  let total = 0; for (const m in R.mats) total += R.mats[m];
  let x = rand(run) * total;
  for (const m of MAT_IDS) { const w = R.mats[m] || 0; if (x < w) return m; x -= w; }
  return 'madera';
}
function rollFind(run, ring, minStars = 1) {
  const [lo, hi] = EXP.findStars[ring];
  return { stars: Math.max(minStars, randInt(run, lo, hi)) };
}
function ruinLoot(run, cell, full, events) {
  const ring = ringOf(cell.depth);
  const mats = {};
  const n = full ? 2 : 1;
  for (let i = 0; i < n; i++) { const m = regionMat(run); mats[m] = (mats[m] || 0) + 1; }
  const ev = { type: 'loot', mats: {}, reason: full ? 'ruina' : 'ruina_chica' };
  if (rand(run) < (full ? EXP.ruinFind : EXP.ruinSmallFind) * (run.mods.findMult || 1)) { const f = rollFind(run, ring); run.finds.push(f); ev.find = f; }
  if (full && rand(run) < EXP.ruinPlano[ring]) { run.planos++; ev.plano = 1; }
  if (ev.find || ev.plano) events.push(ev);
  giveMats(run, mats, events, ev.reason);
}
function loseRandomMat(run, n, events) {
  for (let i = 0; i < n; i++) {
    const have = MAT_IDS.filter(m => run.cargo[m] > 0);
    if (!have.length) return;
    const m = have[Math.floor(rand(run) * have.length)];
    run.cargo[m]--; if (!run.cargo[m]) delete run.cargo[m];
    events.push({ type: 'lose', mats: { [m]: 1 } });
  }
}
function spendMats(run, mats) {
  for (const [m, n] of Object.entries(mats)) { run.cargo[m] -= n; if (run.cargo[m] <= 0) delete run.cargo[m]; }
}

function checkMorale(run, events) {
  if (run.morale <= 0 && !run.ended) endRun(run, 'sin_animo', events);
}

/** Da el paso: paga provisiones, marca la casilla, cansancio, niebla. No aplica el contenido. */
function doStep(run, x, y, cost, events) {
  run.prov -= cost;
  run.prev = run.pos.slice();
  run.pos = [x, y];
  run.steps++;
  const c = cellAt(run, x, y);
  const first = !c.visited;
  c.visited = true;
  events.push({ type: 'step', x, y, from: run.prev, cost, prov: run.prov, steps: run.steps });
  reveal(run, x, y, visionRadius(run), events);
  if (run.steps % EXP.tiredEvery === 0) addMorale(run, -1, 'cansancio', events);
  if (first && rand(run) < EXP.mishap[ringOf(c.depth)]) {
    const m = EXP.mishaps[Math.floor(rand(run) * EXP.mishaps.length)];
    events.push({ type: 'mishap', id: m.id, text: m.text });
    if (m.prov) addProv(run, m.prov, 'imprevisto', events);
    if (m.morale) addMorale(run, m.morale, 'imprevisto', events);
  }
}

/** Lo que pasa al quedar en una casilla (recurso, campamento, aldea, mirador, objetivo, cosas tiradas). */
function enterCell(run, events) {
  const [x, y] = run.pos, c = cellAt(run, x, y);
  if (!c.done) {
    switch (c.content) {
      case 'recurso': {
        const ring = ringOf(c.depth);
        const lv = roleLevel(run, 'recoleccion');
        const n = EXP.ringAmount[ring] + (lv ? 1 + Math.floor(lv / 2) : 0) + Math.floor((tier(run) - 1) / 2);
        c.done = true;
        giveMats(run, { [c.sub]: n }, events, 'recurso');
        return;
      }
      case 'mirador': {
        c.done = true;
        const rad = EXP.mirador + (roleLevel(run, 'exploracion') >= 3 ? EXP.miradorExploracion3 - EXP.mirador : 0) + (run.mods.miradorBonus || 0);
        events.push({ type: 'mirador', x, y, radius: rad });
        reveal(run, x, y, rad, events, true);
        break;
      }
      case 'campamento': {
        run.pending = { kind: 'campamento', x, y, at: 'here', options: [
          { id: 'descansar', label: 'Descansar', p: 100, sure: true, prov: 0, can: true, ok: { morale: EXP.camp + (hasRole(run, 'sanidad') ? EXP.campSanidad : 0) } },
          { id: 'seguir', label: 'Seguir de largo', p: 100, sure: true, prov: 0, can: true, ok: null, keep: true },
        ] };
        events.push({ type: 'decision', pending: run.pending });
        break;
      }
      case 'aldea': openVillage(run, x, y, false, events); break;
      case 'objetivo': {
        c.done = true;
        run.objectiveDone = true;
        run.objective.done = true;
        if (run.objective.type === 'lugar') {
          const mats = {};
          for (let i = 0; i < 3; i++) { const m = regionMat(run); mats[m] = (mats[m] || 0) + 1; }
          const f = rollFind(run, ringOf(c.depth), 2);
          run.finds.push(f);
          const plano = run.zone >= 3 ? 1 : 0;
          run.planos += plano;
          events.push({ type: 'objective', objective: run.objective.type, name: run.objective.name, find: f, plano });
          giveMats(run, mats, events, 'objetivo');
        } else {
          run.colonos += 2;
          events.push({ type: 'objective', objective: 'aldea', name: run.objective.name, colonos: 2 });
          openVillage(run, x, y, true, events);
        }
        return;
      }
      default: break;
    }
  }
  pickup(run, events);
}
function openVillage(run, x, y, free, events) {
  const stars = run.mods.encantoStars || 0;
  const two = MAT_IDS.reduce((a, m) => a + (run.cargo[m] || 0), 0) >= 2;
  run.pending = { kind: 'aldea', x, y, at: 'here', free, options: [
    { id: 'comerciar', label: 'Comerciar', p: 100, sure: true, prov: 0, can: two, why: two ? '' : 'Hacen falta 2 materiales', ok: { prov: stars >= 3 ? 4 : 3, give: 2 } },
    { id: 'colonos', label: 'Sumar gente', p: 100, sure: true, prov: 0, can: true, ok: { colonos: stars >= 4 ? 2 : 1 } },
    ...(free || run.objectiveDone ? [] : [{ id: 'indicaciones', label: 'Pedir indicaciones', p: 100, sure: true, prov: 0, can: true,
      ok: { morale: 1, reveal: run.objective.type === 'juntar' ? 'area' : true } }]),
    { id: 'seguir', label: 'Más tarde', p: 100, sure: true, prov: 0, can: true, ok: null, keep: true },
  ] };
  events.push({ type: 'decision', pending: run.pending });
}

// ---------- acciones ----------
export function move(run, x, y) {
  if (run.ended) return { ok: false, reason: 'ended', events: [] };
  if (run.pending) return { ok: false, reason: 'pending', events: [] };
  const c = cellAt(run, x, y);
  if (!c || Math.abs(x - run.pos[0]) + Math.abs(y - run.pos[1]) !== 1) return { ok: false, reason: 'far', events: [] };
  const cost = stepCost(run, c);
  if (cost > run.prov) return { ok: false, reason: 'prov', events: [] };
  const events = [];
  if (!c.done && (c.content === 'peligro' || c.content === 'ruina')) {
    const hz = c.content === 'ruina' ? 'ruina' : c.sub;
    run.pending = { kind: c.content, hazard: hz, x, y, from: run.pos.slice(), at: 'enter', step: cost, options: buildOptions(run, hz, cost) };
    events.push({ type: 'decision', pending: run.pending });
    return { ok: true, events };
  }
  doStep(run, x, y, cost, events);
  if (!run.ended) enterCell(run, events);
  checkMorale(run, events);
  return { ok: true, events };
}

export function choose(run, optionId) {
  const pd = run.pending;
  if (!pd || run.ended) return { ok: false, reason: 'nopending', events: [] };
  const events = [];
  if (optionId === 'retroceder' || optionId === 'back') {
    if (pd.at !== 'enter') return { ok: false, reason: 'here', events };
    run.pending = null;
    events.push({ type: 'back' });
    return { ok: true, outcome: null, events };
  }
  const opt = pd.options.find(o => o.id === optionId);
  if (!opt) return { ok: false, reason: 'option', events };

  if (pd.at === 'enter') {
    // peligro o ruina: se paga el paso + el costo de la opción y se tira la suerte
    const def = HAZARDS[pd.hazard].options.find(o => o.id === optionId);
    const cost = optionCost(run, def);
    if (!cost.can) return { ok: false, reason: 'cant', why: cost.why, events };
    if (pd.step + cost.prov > run.prov) return { ok: false, reason: 'prov', events };
    const ch = optionChance(run, HAZARDS[pd.hazard], def);
    const outcome = ch.sure || rand(run) * 100 < ch.p ? 'ok' : 'fail';
    if (!ch.sure) run.care = outcome === 'fail' ? EXP.care : 0;   // tras un tropiezo, el grupo va con más cuidado
    run.pending = null;
    doStep(run, pd.x, pd.y, pd.step, events);
    const c = cellAt(run, pd.x, pd.y);
    c.done = true;
    if (cost.prov) addProv(run, -cost.prov, optionId, events);
    if (cost.mats) { spendMats(run, cost.mats); events.push({ type: 'spend', mats: cost.mats }); }
    const fx = outcome === 'ok' ? def.ok : def.fail;
    events.push({ type: 'outcome', hazard: pd.hazard, option: optionId, p: ch.p, outcome, text: outcome === 'ok' ? def.okText || '' : def.failText || '' });
    run.decisions.push({ hazard: pd.hazard, option: optionId, p: ch.p, outcome });
    if (fx) {
      if (fx.morale) {
        let m = fx.morale;
        if (outcome === 'fail' && run.shield && pd.kind === 'peligro') { m += 1; run.shield = false; }
        addMorale(run, m, 'peligro', events);
      }
      if (fx.prov) addProv(run, fx.prov, 'peligro', events);
      if (fx.loseMat) loseRandomMat(run, fx.loseMat, events);
      if (fx.loot) ruinLoot(run, c, fx.loot === 'full', events);
      else if (fx.mats) giveMats(run, fx.mats, events, 'peligro');
    }
    if (!run.ended) { pickup(run, events); checkMorale(run, events); }
    return { ok: true, outcome, p: ch.p, events };
  }

  // campamento / aldea: estás en la casilla
  if (!opt.can) return { ok: false, reason: 'cant', why: opt.why, events };
  const c = cellAt(run, pd.x, pd.y);
  run.pending = null;
  if (opt.keep) { events.push({ type: 'skip', kind: pd.kind }); pickup(run, events); return { ok: true, outcome: null, events }; }
  c.done = true;
  if (pd.kind === 'campamento') {
    addMorale(run, opt.ok.morale, 'campamento', events);
    events.push({ type: 'camp', x: pd.x, y: pd.y });
  } else if (pd.kind === 'aldea') {
    if (optionId === 'comerciar') {
      // se dan los 2 materiales de los que más hay
      const give = {};
      for (let i = 0; i < 2; i++) {
        const m = MAT_IDS.filter(k => (run.cargo[k] || 0) - (give[k] || 0) > 0).sort((a, b) => (run.cargo[b] - (give[b] || 0)) - (run.cargo[a] - (give[a] || 0)))[0];
        give[m] = (give[m] || 0) + 1;
      }
      spendMats(run, give);
      events.push({ type: 'spend', mats: give });
      addProv(run, opt.ok.prov, 'comercio', events);
    } else if (optionId === 'colonos') {
      run.colonos += opt.ok.colonos;
      events.push({ type: 'loot', mats: {}, colonos: opt.ok.colonos, reason: 'aldea' });
    } else if (optionId === 'indicaciones') {
      if (run.objective.cell) {
        run.objective.known = true;
        const oc = cellAt(run, run.objective.cell[0], run.objective.cell[1]);
        if (!oc.seen) { oc.seen = true; events.push({ type: 'reveal', cells: [run.objective.cell] }); }
      } else reveal(run, pd.x, pd.y, 3, events);   // objetivo de juntar: te cuentan qué hay alrededor
      events.push({ type: 'hint', cell: run.objective.cell || null });
      addMorale(run, 1, 'aldea', events);
    }
    events.push({ type: 'village', option: optionId });
  }
  pickup(run, events);
  return { ok: true, outcome: 'ok', events };
}

export function useItem(run, id) {
  if (run.ended) return { ok: false, events: [] };
  const events = [];
  if (id === 'botiquin') {
    if (!hasEquip(run, 'botiquin') || run.used.botiquin) return { ok: false, events };
    run.used.botiquin = true;
    addMorale(run, EXP.botiquin, 'botiquin', events);
    return { ok: true, events };
  }
  if (id === 'atender') {
    if (roleLevel(run, 'sanidad') < 3 || run.used.atender) return { ok: false, events };
    run.used.atender = true;
    addMorale(run, EXP.atender, 'atender', events);
    return { ok: true, events };
  }
  if (id.startsWith('soltar:')) {
    const m = id.slice(7);
    if (!(run.cargo[m] > 0)) return { ok: false, events };
    run.cargo[m]--; if (!run.cargo[m]) delete run.cargo[m];
    const c = cellAt(run, run.pos[0], run.pos[1]);
    c.drops = c.drops || {};
    c.drops[m] = (c.drops[m] || 0) + 1;
    events.push({ type: 'drop', mats: { [m]: 1 } });
    pickup(run, events, m);
    return { ok: true, events };
  }
  return { ok: false, events };
}

function endRun(run, reason, events) {
  run.ended = true;
  run.reason = reason;
  run.pending = null;
  if (reason !== 'volvio') for (const m of Object.keys(run.cargo)) { run.cargo[m] = Math.floor(run.cargo[m] / 2); if (!run.cargo[m]) delete run.cargo[m]; }
  if (run.objective.type === 'juntar' && (run.cargo[run.objective.mat] || 0) >= run.objective.n) { run.objectiveDone = true; run.objective.done = true; }
  const res = result(run);
  // premios extra de 3★ (los acredita la ciudad en la Fase 2)
  res.gems = res.starCount === 3 ? EXP.gemsAt3 : 0;
  res.chest = res.starCount === 3 && rand(run) < EXP.chestAt3;
  run.result = res;
  events.push({ type: 'end', result: res });
}

export function goHome(run) {
  const events = [];
  if (!run.ended) {
    run.pending = null;
    const cost = returnCost(run);
    if (run.prov >= cost) { run.prov -= cost; endRun(run, 'volvio', events); }
    else { run.prov = 0; endRun(run, 'sin_provisiones', events); }
  }
  return { result: run.result, events };
}

export function result(run) {
  if (run.result && run.ended) return run.result;
  const cargoN = cargoCount(run);
  const stars = [
    !!run.objectiveDone,
    cargoN >= Math.ceil(run.cargoMax * EXP.cargoStar),
    run.ended ? run.reason === 'volvio' && run.morale >= EXP.moraleStar : run.morale >= EXP.moraleStar,
  ];
  const starCount = stars.filter(Boolean).length;
  const loot = { mats: { ...run.cargo }, planos: run.planos, finds: run.finds.map(f => ({ ...f })), colonos: run.colonos };
  return {
    stars, starCount, loot, reason: run.reason, steps: run.steps, objectiveDone: !!run.objectiveDone,
    region: run.region, zone: run.zone, kind: run.kind,
    provLeft: run.ended && run.reason === 'volvio' ? run.prov : 0, cargoN, cargoMax: run.cargoMax, morale: run.morale,
    value: lootValue(loot, starCount),
  };
}

/** Copia profunda (para simular "qué hubiera pasado si…"). */
export const cloneRun = (run) => JSON.parse(JSON.stringify(run));
