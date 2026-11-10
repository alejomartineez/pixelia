// Simulador de la Travesía por nodos (PLAN-FOTO §A1): bots que juegan salidas enteras con los motores reales
// (src/voyage/voyage-rules.js y el combate con la IA de sim-combat.mjs) y reportan contra las metas, con ✔/✘.
//
//   node tools/sim-voyage.mjs              200 salidas repartidas entre los bots (prudente, codicioso, azar)
//   node tools/sim-voyage.mjs --n 60       cuántas salidas en total
//   node tools/sim-voyage.mjs --bot prudente
//   node tools/sim-voyage.mjs --novato     la IA no conoce la mecánica del jefe (primera vez en la isla)
//   node tools/sim-voyage.mjs --runs 12    salidas por Marea en la carrera de farmeo (la segunda tabla)
//
// Metas: salida de 10 a 15 minutos, de 3 a 5 peleas por salida completa, y con el grupo del prototipo entre 55 y
// 85 % de salidas ganadas jugando con criterio (prudente). Los minutos son una estimación: SEG.turno por turno de
// pelea (el grupo entero mueve y actúa), SEG.pelea por entrar y cobrar, SEG.nodo por cada tarjeta que no es pelea.
//
// Carrera de farmeo (A1 + A2 + A3 enganchados): una sola partida juega `--runs` salidas en Marea I, después en la II y
// en la III, equipando lo mejor que cae y gastando los puntos del árbol entre salidas; lo ya ganado con tres estrellas
// se resuelve solo. Reporta minutos y botín por salida en cada Marea.
import { pathToFileURL } from 'node:url';
import * as V from '../src/voyage/voyage-rules.js';
import * as CR from '../src/combat/combat-rules.js';
import { VOY } from '../src/voyage/voyage-data.js';
import { botTurn } from './sim-combat.mjs';
import * as L from '../src/core/loot.js';
import * as A from '../src/core/arsenal.js';
import * as T from '../src/core/tree.js';
import { TREE_NODES } from '../src/core/tree-data.js';

export const SEG = { turno: 28, pelea: 25, nodo: 25, auto: 6, equipo: 20 };
export const BOTS = ['prudente', 'codicioso', 'azar'];

function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hpFrac = (run) => { const s = Object.values(run.squad); return s.reduce((a, x) => a + x.hp, 0) / s.reduce((a, x) => a + x.maxHp, 0); };
const missing = (run) => Object.values(run.squad).reduce((a, x) => a + x.maxHp - x.hp, 0);

/** Cuánto vale un efecto para el bot (más es mejor). */
function fxScore(run, fx, bot) {
  const greed = bot === 'codicioso' ? 1 : 0.35, n = Object.keys(run.squad).length, frail = 1 + 2 * (1 - hpFrac(run));
  let v = 0;
  if (fx.healAll) v += Math.min(missing(run), fx.healAll <= 1 ? Object.values(run.squad).reduce((a, x) => a + x.maxHp * fx.healAll, 0) : fx.healAll * n) * 1.2;
  if (fx.dmgAll) v -= fx.dmgAll * n * 1.1 * frail;
  if (fx.dmgLeader) v -= fx.dmgLeader * 1.3 * frail;
  if (fx.maxHpAll) v += fx.maxHpAll * n * 1.1;
  if (fx.maxHpLeader) v += fx.maxHpLeader * 1.4;
  if (fx.atkAll) v += fx.atkAll * n * 5;
  if (fx.atkLeader) v += fx.atkLeader * 6;
  if (fx.atk) v += fx.atk.n * (fx.atk.who === 'curandero' ? 3 : 5.5);
  if (fx.armor) v += fx.armor.n * (fx.armor.who === 'lider' ? 7 : 5);
  if (fx.mats) v += Object.values(fx.mats).reduce((a, x) => a + x, 0) * greed;
  if (fx.loseMats) v -= V.matsTotal(run) * fx.loseMats * greed;
  if (fx.relic) v += 9;
  if (fx.item) v += 4;
  if (fx.useItem) v -= 3;
  if (fx.nextFoe) v -= (fx.nextFoe - 1) * 25;
  if (fx.bossHp) v -= (fx.bossHp - 1) * 30;
  return v;
}
const NODE_PREF = {
  prudente: (t, hp) => ({ pelea: 2, elite: hp > 0.85 ? 2.5 : -4, evento: 3, campamento: hp < 0.75 ? 6 : 2.5, jefe: 0 })[t],
  codicioso: (t, hp) => ({ pelea: 3, elite: hp > 0.5 ? 6 : 1, evento: 2, campamento: hp < 0.45 ? 5 : 1, jefe: 0 })[t],
};

/** Juega una pelea con la IA sobre la pelea ya armada de la salida. */
function fight(run, seed, opt) {
  const b = V.activeBattle(run);
  const rnd = mulberry(seed * 7919 + 13);
  const o = { noise: 1.2, ...opt };
  for (let k = 0; k < 60 && !b.ended; k++) {
    botTurn(b, o, rnd);
    if (b.ended) break;
    CR.endTurn(b);
    CR.enemyTurn(b);
  }
  return b.ended ? CR.result(b) : null;
}

/** Gasta los puntos libres del árbol en lo primero que se pueda tomar. */
export function spendTree(state) {
  let n = 0;
  for (let g = 0; g < 40 && T.treeInfo(state).free > 0; g++) {
    const node = TREE_NODES.find(x => T.canTake(state, x.id).ok);
    if (!node) break;
    T.takeNode(state, node.id); n++;
  }
  return n;
}

/**
 * Una salida entera. opt: { marea, state (la partida: botín y árbol siguen de una salida a otra), auto (resuelve solo
 * lo ya ganado con 3 estrellas), novato }. Devuelve { run, summary, seconds, state }.
 */
export function playVoyage(seed, bot = 'prudente', opt = {}) {
  const state = opt.state || {}, env = { state };
  const run = V.newRun({ seed, marea: opt.marea || 1 });
  const r = mulberry(seed ^ 0xabcdef);
  let seconds = 0;
  for (let guard = 0; guard < 80 && !run.ended; guard++) {
    const pd = run.pending;
    if (!pd) {
      const ch = V.choices(run);
      let go = ch[Math.floor(r() * ch.length)];
      if (bot !== 'azar') {
        const hp = hpFrac(run);
        let best = -Infinity;
        for (const id of ch) { const s = NODE_PREF[bot](V.nodeOf(run, id).type, hp) + r() * 0.5; if (s > best) { best = s; go = id; } }
      }
      V.enter(run, go, env);
    } else if (pd.kind === 'combate') {
      const node = V.nodeOf(run, pd.node);
      if (opt.auto && V.canAuto(run, env)) { V.autoFight(run, env); seconds += SEG.auto; continue; }
      const res = fight(run, seed + run.fights.length * 101, { knows: node.type === 'jefe' && !opt.novato });
      seconds += SEG.pelea + SEG.turno * (res?.turns || 0);
      const n0 = A.arsenalState(state).items.length;
      V.endCombat(run, res, [], env);
      // cayó un arma: se mira y se equipa lo mejor
      if (A.arsenalState(state).items.length > n0) { L.equipBest(state, run.party, null); seconds += SEG.equipo; }
    } else {
      const os = V.options(run).filter(o => o.can);
      let o = os[Math.floor(r() * os.length)];
      if (bot !== 'azar') o = os.reduce((a, x) => (fxScore(run, x.fx, bot) > fxScore(run, a.fx, bot) ? x : a), os[0]);
      V.choose(run, o.id);
      seconds += pd.kind === 'recompensa' ? 10 : SEG.nodo;
    }
  }
  return { run, summary: V.summary(run), seconds, state };
}

/** Carrera de farmeo: `runs` salidas por Marea con la misma partida. → [{ marea, … por salida }] */
export function career({ runs = 12, seed0 = 5000, bot = 'prudente' } = {}) {
  const state = {};
  const out = [];
  for (const marea of [1, 2, 3]) {
    const rows = [];
    for (let i = 0; i < runs; i++) {
      spendTree(state);
      L.equipBest(state, VOY.party, null);
      const n0 = A.arsenalState(state).items.length, uid0 = A.arsenalState(state).nextUid;
      const r = playVoyage(seed0 + marea * 1000 + i * 13, bot, { marea, state, auto: true });
      const got = A.arsenalState(state).items.filter(w => w.uid >= uid0);
      rows.push({ ...r, items: r.run.drops.length, rare: got.filter(w => w.rarity >= 2).length, power: avg(got.map(w => L.itemPower(w))),
        auto: r.run.fights.filter(f => f.auto).length, kept: A.arsenalState(state).items.length - n0 });
    }
    const done = rows.filter(x => x.summary.outcome === 'win');
    out.push({
      marea, n: runs, win: done.length / runs,
      minutes: avg(rows.map(x => x.seconds)) / 60, minutesWin: avg(done.map(x => x.seconds)) / 60,
      fights: avg(rows.map(x => x.run.fights.length)), auto: avg(rows.map(x => x.auto)),
      turns: avg(rows.flatMap(x => x.run.fights.filter(f => !f.auto).map(f => f.turns))),
      items: avg(rows.map(x => x.items)), rare: avg(rows.map(x => x.rare)), power: avg(rows.filter(x => x.items).map(x => x.power)),
      veta: avg(rows.map(x => x.run.veta)), mats: avg(rows.map(x => Object.values(x.summary.haul.mats).reduce((a, y) => a + y, 0))),
      relics: avg(rows.map(x => x.run.relics.length)),
      points: T.treeInfo(state).points, worn: avg(['lider', ...VOY.party].map(w => L.itemPower(A.equippedOn(state, w)))),
    });
  }
  return out;
}

function avg(a) { return a.reduce((x, y) => x + y, 0) / Math.max(1, a.length); }
const pct = (x) => (100 * x).toFixed(0).padStart(3) + ' %';
const mark = (c) => (c ? '✔' : '✘');

export function simulate({ n = 200, bots = BOTS, novato = false, seed0 = 1000 } = {}) {
  const out = {};
  bots.forEach((bot, bi) => {
    const N = Math.round(n / bots.length), rows = [];
    for (let i = 0; i < N; i++) rows.push(playVoyage(seed0 + i * 7 + bi, bot, { novato }));
    const done = rows.filter(x => x.summary.outcome === 'win');
    out[bot] = {
      n: N, win: done.length / N,
      nodes: avg(rows.map(x => x.summary.nodes)), nodesWin: avg(done.map(x => x.summary.nodes)),
      fights: avg(rows.map(x => x.run.fights.length)), fightsWin: avg(done.map(x => x.summary.fights)),
      fightsMin: Math.min(...done.map(x => x.summary.fights)), fightsMax: Math.max(...done.map(x => x.summary.fights)),
      turns: avg(rows.flatMap(x => x.run.fights.map(f => f.turns))),
      minutes: avg(rows.map(x => x.seconds)) / 60, minutesWin: avg(done.map(x => x.seconds)) / 60,
      atBoss: rows.filter(x => x.summary.outcome === 'lose' && x.run.fights.at(-1)?.type === 'jefe').length / N,
      before: rows.filter(x => x.summary.outcome === 'lose' && x.run.fights.at(-1)?.type !== 'jefe').length / N,
      relics: avg(rows.map(x => x.run.relics.length)),
      mats: avg(rows.map(x => Object.values(x.summary.haul.mats).reduce((a, y) => a + y, 0))),
    };
  });
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
  const n = Number(opt('n', 200)), only = opt('bot', null), novato = !!opt('novato', false), runs = Number(opt('runs', 12));
  const bots = only ? [only] : BOTS;
  const t0 = Date.now();
  const res = simulate({ n, bots, novato });
  console.log(`Travesía por nodos: ${n} salidas${novato ? ' (primera vez contra el jefe)' : ''} · grupo nivel ${VOY.level}, clases nivel ${VOY.classLevel}\n`);
  console.log('bot         salidas  ganadas  cae antes  cae en jefe  nodos  peleas  turnos/pelea  minutos  reliquias  botín');
  for (const [bot, s] of Object.entries(res)) {
    console.log(`${bot.padEnd(11)} ${String(s.n).padStart(7)}  ${pct(s.win).padStart(7)}  ${pct(s.before).padStart(9)}  ${pct(s.atBoss).padStart(11)}  ${s.nodes.toFixed(1).padStart(5)}  ${s.fights.toFixed(1).padStart(6)}  ${s.turns.toFixed(1).padStart(12)}  ${s.minutes.toFixed(1).padStart(7)}  ${s.relics.toFixed(1).padStart(9)}  ${s.mats.toFixed(0).padStart(5)}`);
  }
  const p = res.prudente || Object.values(res)[0];
  const all = Object.values(res);
  const fMin = Math.min(...all.map(s => s.fightsMin)), fMax = Math.max(...all.map(s => s.fightsMax));
  console.log('\nSalidas completas (hasta vencer al jefe):');
  for (const [bot, s] of Object.entries(res)) console.log(`  ${bot.padEnd(10)} ${s.nodesWin.toFixed(1)} nodos · ${s.fightsWin.toFixed(1)} peleas (${s.fightsMin} a ${s.fightsMax}) · ${s.minutesWin.toFixed(1)} min`);
  const car = career({ runs });
  console.log(`\nCarrera de farmeo (una partida, ${runs} salidas por Marea, bot prudente; equipa lo mejor y gasta el árbol entre salidas):`);
  console.log('marea  ganadas  min/salida  peleas  solas  turnos/pelea  armas  raras+  fuerza  veta  materiales  reliquias  puntos árbol  fuerza puesta');
  for (const s of car) {
    console.log(`${['', 'I', 'II', 'III'][s.marea].padEnd(5)}  ${pct(s.win).padStart(7)}  ${s.minutes.toFixed(1).padStart(10)}  ${s.fights.toFixed(1).padStart(6)}  ${s.auto.toFixed(1).padStart(5)}  ${s.turns.toFixed(1).padStart(12)}  ${s.items.toFixed(1).padStart(5)}  ${s.rare.toFixed(1).padStart(6)}  ${s.power.toFixed(0).padStart(6)}  ${s.veta.toFixed(0).padStart(4)}  ${s.mats.toFixed(0).padStart(10)}  ${s.relics.toFixed(1).padStart(9)}  ${String(s.points).padStart(12)}  ${s.worn.toFixed(0).padStart(13)}`);
  }
  const checks = [
    [fMin >= VOY.fights[0] && fMax <= VOY.fights[1], `de ${VOY.fights[0]} a ${VOY.fights[1]} peleas por salida completa (${fMin} a ${fMax})`],
    [p.minutesWin >= 10 && p.minutesWin <= 15, `salida completa de 10 a 15 min (${p.minutesWin.toFixed(1)} min estimados: ${SEG.turno} s por turno)`],
    [p.win >= 0.85, `en Marea I, sin equipo, se gana seguido jugando con criterio (≥ 85 %: ${pct(p.win).trim()})`],
    [car[2].items > car[0].items && car[2].veta > car[0].veta && car[2].power > car[0].power, `mejor botín en mareas altas (armas ${car[0].items.toFixed(1)} → ${car[2].items.toFixed(1)}, fuerza ${car[0].power.toFixed(0)} → ${car[2].power.toFixed(0)}, veta ${car[0].veta.toFixed(0)} → ${car[2].veta.toFixed(0)})`],
    [car.every(s => s.minutes <= 15), `ninguna salida pasa de 15 min en las tres Mareas (${car.map(s => s.minutes.toFixed(1)).join(' · ')})`],
    [!res.azar || res.azar.win < p.win, `elegir al azar rinde menos que elegir bien (${res.azar ? pct(res.azar.win).trim() : 's/d'})`],
  ];
  console.log('\nMetas:');
  for (const [c, m] of checks) console.log(`  ${mark(c)} ${m}`);
  // avisos: no cortan (son para ajustar el balance después de la prueba con jugadores)
  const warns = [
    [car[2].win >= 0.45 && car[2].win <= 0.9, `la Marea III aprieta sin ser una pared, ya con equipo y árbol (45 a 90 %: ${pct(car[2].win).trim()})`],
    [car.every(s => s.turns >= 3), `con equipo las peleas siguen durando 3 turnos o más (${car.map(s => s.turns.toFixed(1)).join(' · ')})`],
  ];
  console.log('\nAvisos de balance:');
  for (const [c, m] of warns) console.log(`  ${c ? '✔' : '⚠'} ${m}`);
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exitCode = checks.every(([c]) => c) ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
