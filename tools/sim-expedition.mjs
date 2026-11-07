// Simulador de la Expedición (DESIGN-CORE.md §8): bots que juegan cientos o miles de salidas con el motor real
// (src/expedition/exp-rules.js) y reportan distribuciones contra las metas de balance, con ✔/✘.
//
//   node tools/sim-expedition.mjs                    reporte completo (prototipo + regiones + niveles de roles)
//   node tools/sim-expedition.mjs --n 1000           salidas por combinación (default 500)
//   node tools/sim-expedition.mjs --only proto       solo el prototipo (Bosque, zona 1, 3 roles en nivel 1)
//   node tools/sim-expedition.mjs --kind corta       salida corta
//   node tools/sim-expedition.mjs --cf 0             sin el contrafáctico "seguir vs. volver" (más rápido)
//
// Bots:
//   prudente  vuelve con reserva ≥ 1,5 × el regreso (y con ánimo ≤ 4); elige lo seguro salvo que lo arriesgado sea ≥ 80%
//   medio     reserva = regreso + 1; arriesga desde 65% si el ánimo aguanta; vuelve con objetivo + 75% de carga
//   codicioso reserva = el regreso justo; siempre lo arriesgado (salvo < 40%); vuelve recién cuando no le alcanza otro paso
//   azar      pasos al azar entre los que le dejan volver; opciones al azar; a veces vuelve sin motivo
import { EXP, REGIONS, REGION_IDS, HAZARDS, lootValue } from '../src/expedition/exp-data.js';
import { rng, hashSeed } from '../src/expedition/exp-gen.js';
import * as R from '../src/expedition/exp-rules.js';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const N = Number(opt('n', 500));
const ONLY = opt('only', null);
const KIND = opt('kind', 'normal');
const CF = Number(opt('cf', 6));          // muestras del contrafáctico por decisión de volver
const BOTS = ['prudente', 'medio', 'codicioso', 'azar'];

// ---------------------------------------------------------------- bots
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
function decide(run, bot, mem, r) {
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
function pickOption(run, bot, mem, r) {
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

function play(run, bot, seed, opts = {}) {
  const r = rng(seed ^ 0x5bd1e995);
  const mem = { blocked: new Set(), party: run.party, wander: 0, bot };
  let guard = 0, homeAt = null;
  while (!run.ended && guard++ < 400) {
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

// ---------------------------------------------------------------- contrafáctico: ¿seguir era mejor que volver?
function continueBetter(run, seed) {
  const now = R.cloneRun(run);
  R.goHome(now);
  const vNow = R.result(now).value;
  let sum = 0;
  for (let k = 0; k < CF; k++) {
    const c = R.cloneRun(run);
    c.rs = (c.rs ^ hashSeed('cf', k, seed)) | 0;   // otra suerte para lo que viene
    sum += play(c, 'codicioso', seed + k * 7919).value;
  }
  return sum / CF > vNow + 0.25;
}

// ---------------------------------------------------------------- correr
function setup(profile, i) {
  const seed = hashSeed(profile.region, profile.zone, i, profile.kind, 'sim');
  return R.newRun({
    region: profile.region, zone: profile.zone, kind: profile.kind, seed,
    party: profile.party, equip: profile.equip || [], prov: profile.prov,
    mods: { roleLevel: Object.fromEntries(profile.party.map(p => [p, profile.level])), cargoMax: profile.cargoMax, encantoStars: profile.encanto || 0 },
  });
}
function runBatch(profile, bot) {
  const S = { n: 0, steps: [], mats: [], planos: 0, finds: 0, stars: [0, 0, 0, 0], obj: 0, reasons: {}, three: 0, cfN: 0, cfYes: 0, fail: 0, matsByType: {}, value: 0, objBy: {}, morale: [], cargoStar: 0, moraleStarN: 0, decisions: 0 };
  for (let i = 0; i < N; i++) {
    const run = setup(profile, i);
    const res = play(run, bot, i, CF && (bot === 'prudente' || bot === 'medio') ? {
      onVoluntaryHome: (r) => { S.cfN++; if (continueBetter(r, i)) S.cfYes++; },
    } : {});
    S.n++;
    const ot = run.objective.type; S.objBy[ot] = S.objBy[ot] || [0, 0]; S.objBy[ot][1]++; if (res.objectiveDone) S.objBy[ot][0]++;
    S.steps.push(res.steps);
    const m = Object.values(res.loot.mats).reduce((a, n) => a + n, 0);
    S.mats.push(m);
    for (const [k, n] of Object.entries(res.loot.mats)) S.matsByType[k] = (S.matsByType[k] || 0) + n;
    S.planos += res.loot.planos; S.finds += res.loot.finds.length;
    S.stars[res.starCount]++; if (res.starCount === 3) S.three++;
    if (res.objectiveDone) S.obj++;
    S.reasons[res.reason] = (S.reasons[res.reason] || 0) + 1;
    if (res.reason !== 'volvio') S.fail++;
    S.value += res.value;
    S.morale.push(res.morale); if (res.stars[1]) S.cargoStar++; if (res.stars[2]) S.moraleStarN++; S.decisions += run.decisions.length;
  }
  return S;
}
const pct = (a, n) => (100 * a / n);
const f1 = (x) => x.toFixed(1);
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mark = (ok) => (ok ? '✔' : '✘');
function hist(a, lo, hi, step = 1) {
  const out = [];
  for (let x = lo; x <= hi; x += step) out.push(a.filter(v => v >= x && v < x + step).length);
  const max = Math.max(...out);
  return out.map(n => ' ▁▂▃▄▅▆▇█'[Math.round(8 * n / (max || 1))]).join('');
}

function report(title, profile, { checks = true } = {}) {
  console.log(`\n■ ${title}  (${REGIONS[profile.region].name}, zona ${profile.zone}, ${profile.kind}, grupo ${profile.party.join('+') || 'solo'} nv ${profile.level}, ${profile.prov} provisiones, carga ${profile.cargoMax}; ${N} salidas por bot)`);
  console.log('  bot        pasos (p10–p50–p90)  materiales  planos  hallazgos  objetivo  ★0/★1/★2/★3          fracasa (sin prov / sin ánimo)  seguir>volver');
  const all = {};
  for (const bot of BOTS) {
    const S = runBatch(profile, bot);
    all[bot] = S;
    const sp = S.reasons.sin_provisiones || 0, sa = S.reasons.sin_animo || 0;
    console.log(`  ${bot.padEnd(10)} ${String(q(S.steps, 0.1)).padStart(3)}–${String(q(S.steps, 0.5)).padStart(2)}–${String(q(S.steps, 0.9)).padEnd(3)} ${hist(S.steps, 4, 32, 2)}  ${f1(avg(S.mats)).padStart(5)}     ${(S.planos / S.n).toFixed(2)}    ${(S.finds / S.n).toFixed(2)}     ${f1(pct(S.obj, S.n)).padStart(5)}%   ${S.stars.map(x => f1(pct(x, S.n)).padStart(4)).join('/')}%   ${f1(pct(S.fail, S.n)).padStart(5)}% (${f1(pct(sp, S.n))} / ${f1(pct(sa, S.n))})        ${S.cfN ? f1(pct(S.cfYes, S.cfN)) + '% de ' + S.cfN : '—'}`);
  }
  const mid = all.medio;
  const types = Object.entries(mid.matsByType).map(([k, n]) => `${k} ${(n / mid.n).toFixed(1)}`).join(' · ');
  console.log(`  botín por tipo (medio, por salida): ${types} · valor promedio por bot: ${BOTS.map(b => `${b} ${f1(all[b].value / all[b].n)}`).join(' · ')}`);
  console.log(`  ★ por separado (objetivo / carga / todos bien) y ánimo final, decisiones por salida: ${BOTS.map(b => `${b} ${f1(pct(all[b].obj, all[b].n))}/${f1(pct(all[b].cargoStar, all[b].n))}/${f1(pct(all[b].moraleStarN, all[b].n))}% ánimo ${f1(avg(all[b].morale))} dec ${f1(all[b].decisions / all[b].n)}`).join(' · ')}`);
  console.log(`  objetivo por tipo (prudente / medio): ${Object.keys(all.medio.objBy).map(k => `${k} ${f1(pct(...all.prudente.objBy[k] || [0, 1]))}% / ${f1(pct(...all.medio.objBy[k]))}%`).join(' · ')}`);
  if (!checks) return all;
  const P = all.prudente, G = all.codicioso, M = all.medio;
  const allSteps = [...P.steps, ...M.steps, ...G.steps];
  const allMats = [...P.mats, ...M.mats, ...G.mats];
  const cf = (P.cfYes + M.cfYes) / Math.max(1, P.cfN + M.cfN);
  const lines = [
    [pct(P.fail, P.n) <= 10, `prudente fracasa ≤ 10%: ${f1(pct(P.fail, P.n))}%`],
    // metas efectivas de la Fase 1 (DESIGN-CORE.md §8 explica por qué: 85% y 30–50% eran las de partida)
    [pct(P.obj, P.n) >= 80, `prudente cumple el objetivo ≥ 80% (partida: 85%): ${f1(pct(P.obj, P.n))}%`],
    [pct(G.fail, G.n) >= 15 && pct(G.fail, G.n) <= 55, `codicioso fracasa 15–55% (partida: 30–50%; 15–35% con Sanidad): ${f1(pct(G.fail, G.n))}%`],
    [pct(M.three, M.n) >= 25 && pct(M.three, M.n) <= 40, `medio saca 3★ en 25–40%: ${f1(pct(M.three, M.n))}%`],
    [avg(allSteps) >= 12 && avg(allSteps) <= 25, `salida de 12 a 25 pasos (promedio de los 3 bots): ${f1(avg(allSteps))}`],
    [avg(allMats) >= 8 && avg(allMats) <= 14, `botín 8–14 materiales: ${f1(avg(allMats))}`],
    [(P.planos + M.planos + G.planos) / (3 * N) >= 0.4 && (P.planos + M.planos + G.planos) / (3 * N) <= 0.8, `0,4–0,8 planos: ${((P.planos + M.planos + G.planos) / (3 * N)).toFixed(2)}`],
    [(P.finds + M.finds + G.finds) / (3 * N) >= 0.8 && (P.finds + M.finds + G.finds) / (3 * N) <= 1.5, `0,8–1,5 hallazgos: ${((P.finds + M.finds + G.finds) / (3 * N)).toFixed(2)}`],
    [cf >= 0.25 && cf <= 0.65, `"seguir" fue mejor que "volver" en 25–65% de las vueltas voluntarias (tensión): ${f1(cf * 100)}%`],
    [pct(G.obj, G.n) < 100 && pct(G.fail, G.n) > 0 && pct(P.fail, P.n) < 100, 'no se gana siempre ni se pierde siempre'],
  ];
  if (profile.kind === 'corta') lines.splice(4, 4, [avg(allSteps) >= 5 && avg(allSteps) <= 12, `salida corta de 5 a 12 pasos: ${f1(avg(allSteps))}`]);
  for (const [ok, t] of lines) console.log(`  ${mark(ok)} ${t}`);
  return all;
}

// ---------------------------------------------------------------- perfiles
const PROTO = { region: 'bosque', zone: 1, kind: KIND, party: EXP.prototype.party, level: 1, prov: KIND === 'corta' ? EXP.kinds.corta.prov : EXP.prototype.prov, cargoMax: EXP.prototype.cargoMax };
// --trace i [--bot medio]: juega la salida i y muestra el mapa final (para mirar cómo decide un bot)
if (opt('trace', null) !== null) {
  const i = Number(opt('trace')), bot = opt('bot', 'medio');
  const run = setup(PROTO, i);
  const res = play(run, bot, i);
  const ch = { vacio: '.', recurso: 'r', ruina: 'R', campamento: 'C', aldea: 'A', mirador: 'M', peligro: '!', objetivo: 'O' };
  for (let y = 0; y < run.h; y++) {
    let s = '';
    for (let x = 0; x < run.w; x++) {
      const c = run.cells[y * run.w + x];
      s += (run.base[0] === x && run.base[1] === y ? 'B' : c.visited ? '·' : ' ') + c.terrain[0] + (c.done && c.content !== 'vacio' ? 'x' : ch[c.content]) + (c.seen ? ' ' : '?') + ' ';
    }
    console.log(s);
  }
  console.log(JSON.stringify(run.objective), JSON.stringify(res), JSON.stringify(run.decisions));
  process.exit(0);
}
console.log(`Simulador de Expedición — ${N} salidas por bot y combinación${CF ? `, contrafáctico con ${CF} muestras` : ''}`);
report('Prototipo (Fase 1)', PROTO);
if (ONLY !== 'proto') {
  // ciudad "esperada" al llegar a cada región: nivel de los edificios ≈ tier, provisiones y carga acordes (§2.3, §2.4)
  console.log('\n=== Regiones con la ciudad esperada (nivel de roles = tier, provisiones = provMax de ese nivel, carga = 6 + 3 × nivel del Establo) ===');
  for (const region of REGION_IDS) {
    const T = REGIONS[region].tier;
    const party = T >= 3 ? ['exploracion', 'ingenieria', 'guia'] : ['exploracion', 'ingenieria'];
    for (const zone of [1, 3, 5]) {
      report(`${REGIONS[region].name} · zona ${zone}`, { region, zone, kind: KIND, party, level: T, prov: KIND === 'corta' ? 10 : EXP.provMax[Math.min(4, T)], cargoMax: 6 + 3 * Math.min(5, T + 1) }, { checks: zone === 1 });
    }
  }
  console.log('\n=== Grupo y nivel de roles (Bosque, zona 1, mismas provisiones y carga que el prototipo) ===');
  for (const party of [[], ['exploracion'], ['ingenieria', 'sanidad'], ['guia', 'recoleccion'], ['exploracion', 'ingenieria', 'sanidad']]) {
    for (const level of party.length ? [1, 3, 5] : [1]) report(`grupo ${party.join('+') || 'solo'} nv ${level}`, { ...PROTO, party, level }, { checks: false });
  }
}
