// Bots de la Expedición (DESIGN-CORE.md §8): juegan una salida con el motor real (src/expedition/exp-rules.js).
// Los usan tools/sim-expedition.mjs (distribuciones por bot) y tools/sim-economy.mjs (salidas dentro de la economía).
//   play(run, bot, seed, opts) → R.result(run)   bot: prudente | medio | codicioso | azar
import { EXP } from '../src/expedition/exp-data.js';
import { rng, hashSeed } from '../src/expedition/exp-gen.js';
import * as R from '../src/expedition/exp-rules.js';
import { ENCOUNTERS, COMBAT } from '../src/combat/combat-data.js';

// Peleas (casilla `enemigo`): el bot no juega la pelea táctica (eso lo mide sim-combat.mjs). Usa lo que da ese
// simulador con el grupo esperado: ~90 % de las comunes ganadas, y peor con el grupo cansado. Las estrellas siguen la
// misma proporción que en sim-combat (1 por ganar y ~50 % cada desafío).
export const FIGHT_WIN = { prudente: 0.9, medio: 0.88, codicioso: 0.86, azar: 0.65 };
export function simFight(run, bot) {
  const pd = run.pending, enc = ENCOUNTERS[pd.encounter];
  // su propia suerte: la pelea no corre la del bot (lo demás de la salida sigue igual)
  const r = rng(hashSeed(run.seed, pd.x, pd.y, (run.fights || []).length, 'simFight'));
  const pWin = FIGHT_WIN[bot] - (run.battle?.tired ? 0.15 : 0);
  const outcome = r() < pWin ? 'win' : r() < 0.25 ? 'retreat' : 'lose';
  const stars = outcome === 'win' ? 1 + (r() < 0.55) + (r() < 0.4) : 0;
  const mats = {};
  if (outcome === 'win') for (const [k, n] of Object.entries(enc.reward.mats || {})) mats[k] = Math.max(1, Math.round(n * COMBAT.lootByStars[stars]));
  return {
    enc: enc.id, kind: enc.kind, outcome, reason: outcome === 'win' ? 'derrota' : outcome === 'lose' ? 'lider' : 'retirada',
    turns: 6 + Math.floor(r() * 4), stars, loot: { mats },
    xp: Math.round((enc.reward.xp || 0) * (outcome === 'win' ? 1 : outcome === 'lose' ? 0.3 : 0.2)),
    morale: outcome === 'lose' ? COMBAT.morale.lose : outcome === 'retreat' ? COMBAT.morale.retreat : 0,
    combos: [], comboCount: 0, downs: 0, page: null, flag: null, attempt: 1,
  };
}

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function cellsOf(v) { return v.cells; }
const at = (v, x, y) => v.cells[y * v.w + x];

/** Valor de ir a cada casilla vista según el bot (0 = no interesa). */
function targetValue(v, c, bot, mem) {
  if (!c.seen) return 0;
  const room = v.cargoMax - v.cargoN;
  const key = c.x + ',' + c.y;
  if (mem.blocked.has(key)) return 0;
  let val = 0;
  if (c.drops && room > 0) val += Math.min(room, Object.values(c.drops).reduce((a, n) => a + n, 0));
  if (c.done) return val;
  switch (c.content) {
    case 'objetivo': val += 60; break;
    case 'recurso': {
      if (room <= 0) break;
      const amt = EXP.ringAmount[c.depth <= 3 ? 0 : c.depth <= 6 ? 1 : 2];
      const want = v.objective.type === 'juntar' && !v.objective.done && c.sub === v.objective.mat ? 3 : 1;
      val += Math.min(room, amt) * want;
      break;
    }
    case 'ruina': val += bot === 'codicioso' ? 6 : 4; break;
    case 'aldea': val += !v.objective.cell && v.objective.type !== 'juntar' && !v.objective.done ? 8 : 2.5; break;
    case 'campamento': val += v.morale <= v.moraleMax - 4 ? 5 : 0; break;
    case 'mirador': val += 2; break;
    case 'enemigo': {
      // botín de la pelea (va a la carga) contra el riesgo: el prudente casi no las busca
      const loot = Object.values(ENCOUNTERS[c.sub]?.reward.mats || {}).reduce((a, n) => a + n, 0);
      val += Math.min(room, loot) * (bot === 'prudente' ? 0.2 : bot === 'codicioso' ? 0.8 : 0.3);
      break;
    }
    default: break;
  }
  return val;
}
/** Dijkstra desde la posición por casillas vistas; los peligros sin resolver cuestan un extra estimado. */
function paths(v, mem) {
  const N = v.w * v.h, dist = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), done = new Array(N).fill(false);
  const s = v.pos[1] * v.w + v.pos[0];
  dist[s] = 0;
  const TC = { llano: 1, bosque: 1, colina: 2, pantano: 2, roca: 3 };
  const guia = mem.party.includes('guia');
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < N; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0) break;
    done[u] = true;
    const ux = u % v.w, uy = (u / v.w) | 0;
    // no se atraviesa una casilla con decisión pendiente (aldea/campamento) ni un objetivo: se llega y se para
    for (const [dx, dy] of DIRS) {
      const nx = ux + dx, ny = uy + dy;
      if (nx < 0 || ny < 0 || nx >= v.w || ny >= v.h) continue;
      const i = ny * v.w + nx, c = v.cells[i];
      if (!c.seen) continue;
      if (mem.blocked.has(nx + ',' + ny)) continue;
      let cost = guia ? (c.terrain === 'roca' ? 2 : 1) : TC[c.terrain];
      if (!c.done && c.content === 'peligro') cost += mem.bot === 'codicioso' ? 0.5 : 1.2;
      if (!c.done && c.content === 'enemigo') cost += mem.bot === 'codicioso' ? 1 : 2;
      if (dist[u] + cost < dist[i]) { dist[i] = dist[u] + cost; prev[i] = u; }
    }
  }
  return { dist, prev };
}
function firstStep(v, prev, target) {
  const s = v.pos[1] * v.w + v.pos[0];
  let i = target, last = -1;
  while (i !== s && i >= 0) { last = i; i = prev[i]; }
  return last < 0 ? null : [last % v.w, (last / v.w) | 0];
}
/** Valor de explorar casillas sin ver al lado de lo visto (empuja hacia lejos y hacia la zona del objetivo). */
function frontierValue(v, c) {
  let unseen = 0;
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [0, -2], [2, 0], [-2, 0]]) {
    const x = c.x + dx, y = c.y + dy;
    if (x < 0 || y < 0 || x >= v.w || y >= v.h) continue;
    if (!at(v, x, y).seen) unseen++;
  }
  if (!unseen) return 0;
  let val = 0.6 + unseen * 0.35 + c.depth * 0.08;
  const o = v.objective;
  if (!o.done && o.type !== 'juntar' && !o.cell && o.hint) {
    const d = Math.abs(c.x - o.hint[0]) + Math.abs(c.y - o.hint[1]);
    val += Math.max(0, 6 - d) * 4;
  }
  return val;
}

function margin(bot, ret) {
  if (bot === 'prudente') return Math.ceil(1.5 * ret);
  if (bot === 'medio') return ret + 1;
  return ret;
}

/** Elige la próxima acción: { move: [x,y] } | { home: true, voluntary } */
export function decide(run, bot, mem, r) {
  const v = R.view(run);
  if (bot === 'prudente' && v.morale <= 4) return { home: true, voluntary: true };
  if (bot === 'medio' && v.morale <= 3) return { home: true, voluntary: true };
  const objOk = v.objective.done || (v.objective.type === 'juntar' && (v.cargo[v.objective.mat] || 0) >= v.objective.n);
  const cargoOk = v.cargoN >= Math.ceil(v.cargoMax * EXP.cargoStar);
  if ((bot === 'prudente' || bot === 'medio') && objOk && cargoOk) return { home: true, voluntary: true };
  if (bot === 'azar') {
    if ((objOk || v.steps > 10) && r() < 0.1) return { home: true, voluntary: true };
    const ok = v.moves.filter(m => m.ok && v.prov - m.cost >= m.returnAfter && !mem.blocked.has(m.x + ',' + m.y));
    if (!ok.length) return { home: true, voluntary: false };
    const m = ok[Math.floor(r() * ok.length)];
    return { move: [m.x, m.y] };
  }
  const { dist, prev } = paths(v, mem);
  let best = null, bestU = 0;
  const top = [];
  for (const c of v.cells) {
    const i = c.y * v.w + c.x;
    if (dist[i] === Infinity || dist[i] === 0) continue;
    let val = targetValue(v, c, bot, mem) + (c.seen ? frontierValue(v, c) * (bot === 'prudente' ? 0.7 : 1) : 0);
    // el prudente va primero al objetivo: lo demás le interesa poco hasta cumplirlo
    if (bot === 'prudente' && !v.objective.done && v.objective.type !== 'juntar' && c.content !== 'objetivo') val *= 0.35;
    if (val <= 0) continue;
    const u = val / (dist[i] + 0.5);
    top.push([u, i]);
    if (u > bestU) { bestU = u; best = i; }
  }
  // el medio juega como una persona: a veces no elige lo mejor sino algo de lo que tiene a la vista
  if (bot === 'medio' && top.length > 1 && r() < 0.3) { top.sort((a, b) => b[0] - a[0]); best = top[1 + Math.floor(r() * Math.min(2, top.length - 1))][1]; }
  if (best === null) return { home: true, voluntary: !(bot === 'codicioso') };
  const step = firstStep(v, prev, best);
  const mv = step && v.moves.find(m => m.x === step[0] && m.y === step[1]);
  if (!mv || !mv.ok) return { home: true, voluntary: false };
  // ¿alcanza para dar el paso y seguir pudiendo volver con la reserva del bot?
  const target = at(v, step[0], step[1]);
  let extra = 0;
  if (!target.done && target.content === 'peligro' && bot !== 'codicioso') extra = 1;
  if (!target.done && target.content === 'enemigo') extra = EXP.enemy.fightProv;
  if (v.prov - mv.cost - extra < margin(bot, mv.returnAfter)) {
    // otro vecino que sí deje volver (el codicioso lo intenta todo antes de volver)
    if (bot === 'codicioso') {
      // sigue por casillas nuevas (lo nuevo es lo que puede traer algo) mientras el regreso le alcance justo
      const alt = v.moves.filter(m => m.ok && v.prov - m.cost >= m.returnAfter && !mem.blocked.has(m.x + ',' + m.y))
        .sort((a, b) => (at(v, a.x, a.y).visited - at(v, b.x, b.y).visited) || (at(v, b.x, b.y).depth - at(v, a.x, a.y).depth));
      if (alt.length && mem.wander++ < 6) return { move: [alt[0].x, alt[0].y] };
    }
    return { home: true, voluntary: bot !== 'codicioso' };
  }
  return { move: step };
}

/** Elige opción para la decisión pendiente. */
export function pickOption(run, bot, mem, r) {
  const pd = run.pending;
  const v = R.view(run);
  if (pd.kind === 'campamento') {
    if (bot === 'azar') return r() < 0.5 ? 'descansar' : 'seguir';
    return v.morale <= v.moraleMax - (bot === 'codicioso' ? 1 : 3) ? 'descansar' : 'seguir';
  }
  if (pd.kind === 'aldea') {
    const can = (id) => pd.options.find(o => o.id === id)?.can;
    if (bot === 'azar') { const ok = pd.options.filter(o => o.can); return ok[Math.floor(r() * ok.length)].id; }
    if (!v.objective.cell && v.objective.type !== 'juntar' && !v.objective.done) return 'indicaciones';
    if (v.prov < v.returnCost + 4 && can('comerciar')) return 'comerciar';
    if (bot === 'codicioso' && can('comerciar') && v.cargoN >= v.cargoMax - 1) return 'comerciar';
    return 'colonos';
  }
  if (pd.kind === 'enemigo') {
    const ret = R.returnCostFrom(run, pd.x, pd.y, pd.y * run.w + pd.x);
    const opts = pd.options.filter(o => o.can && run.prov - pd.step - o.prov >= (bot === 'codicioso' || bot === 'azar' ? ret : margin(bot, ret)));
    const back = () => { mem.blocked.add(pd.x + ',' + pd.y); return 'retroceder'; };
    if (!opts.length) return back();
    if (bot === 'azar') return r() < 0.3 ? back() : opts[Math.floor(r() * opts.length)].id;
    if (bot !== 'codicioso' && opts.some(o => o.quick)) return 'resolver';
    if (mem.maxFights != null && mem.fights >= mem.maxFights) return back();   // sin tiempo para otra pelea en el rato
    const minMorale = bot === 'prudente' ? 6 : bot === 'medio' ? 4 : 2;
    return v.morale >= minMorale ? 'pelear' : back();
  }
  // peligro o ruina: cada opción con su costo; las que no dejan volver con la reserva quedan afuera
  const ret = R.returnCostFrom(run, pd.x, pd.y, pd.y * run.w + pd.x);
  const opts = pd.options.filter(o => o.can && run.prov - pd.step - o.prov >= (bot === 'codicioso' || bot === 'azar' ? ret : margin(bot, ret)));
  if (!opts.length) { mem.blocked.add(pd.x + ',' + pd.y); return 'retroceder'; }
  if (bot === 'azar') return opts[Math.floor(r() * opts.length)].id;
  const sure = opts.find(o => o.sure), risky = opts.filter(o => !o.sure).sort((a, b) => b.p - a.p)[0];
  if (pd.kind === 'ruina') {
    if (!risky) return sure.id;
    if (bot === 'prudente') return risky.p >= 60 && v.morale > 5 ? risky.id : sure.id;
    if (bot === 'medio') return risky.p >= 55 && v.morale > 3 ? risky.id : sure.id;
    return risky.id;
  }
  const failM = (o) => -(o.fail?.morale || 0);
  if (bot === 'prudente') return risky && (risky.p >= 80 || !sure) && v.morale > failM(risky) + 3 ? risky.id : (sure || risky).id;
  if (bot === 'medio') return risky && (risky.p >= 65 || !sure) && v.morale > failM(risky) + 2 ? risky.id : (sure || risky).id;
  return risky && (risky.p >= 40 || !sure) ? risky.id : (sure || risky).id;
}

export function play(run, bot, seed, opts = {}) {
  const r = rng(seed ^ 0x5bd1e995);
  const mem = { blocked: new Set(), party: run.party, wander: 0, bot, fights: 0, maxFights: opts.maxFights ?? null };
  let guard = 0, homeAt = null;
  while (!run.ended && guard++ < 400) {
    if (run.pending?.kind === 'combate') { const pd = run.pending, res = simFight(run, bot); mem.fights++; R.endCombat(run, res); if (res.outcome !== 'win') mem.blocked.add(pd.x + ',' + pd.y); continue; }
    if (run.pending) { R.choose(run, pickOption(run, bot, mem, r)); continue; }
    const a = decide(run, bot, mem, r);
    if (a.home) {
      if (a.voluntary && opts.onVoluntaryHome && homeAt === null) { homeAt = run.steps; opts.onVoluntaryHome(run); }
      R.goHome(run);
      break;
    }
    const before = run.steps;
    const res = R.move(run, a.move[0], a.move[1]);
    if (!res.ok) { mem.blocked.add(a.move.join(',')); if (mem.blocked.size > 30) { R.goHome(run); break; } }
    else if (run.steps === before && !run.pending) mem.blocked.add(a.move.join(','));
  }
  if (!run.ended) R.goHome(run);
  return R.result(run);
}

