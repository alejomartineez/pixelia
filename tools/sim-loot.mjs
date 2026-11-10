// Simulador del botín (PLAN-FOTO, paso A3): 10 salidas seguidas por el Bosque del Arroyo con el bot de sim-combat,
// para ver que el botín mejora de forma perceptible. Cada salida: 4 peleas comunes, 2 reliquias a elegir y un élite.
// Después de cada pelea se guarda el botín, cada uno se pone la mejor arma y se gastan los puntos del árbol. Una pelea
// ya ganada con 3 estrellas en esa Marea se resuelve sola (botín completo). La Marea sube cuando la salida sale bien.
// El nivel del grupo queda fijo (el de la Marea I): lo que mejora es lo que lleva puesto. Al final, las mismas peleas
// con el grupo "pelado" (sin armas, árbol ni reliquias) para comparar.
//   node tools/sim-loot.mjs [--seed 1] [--runs 10] [--keys] [--check]
//   --keys: el bot también toma los nodos clave. --check: sale con error si el botín no mejora (para npm test).
import { pathToFileURL } from 'node:url';
import { playBattle } from './sim-combat.mjs';
import * as L from '../src/core/loot.js';
import * as A from '../src/core/arsenal.js';
import * as T from '../src/core/tree.js';
import { TREE_NODES } from '../src/core/tree-data.js';
import * as R from '../src/combat/combat-rules.js';
import { COMBAT, MAREA_MAX } from '../src/combat/combat-data.js';

const PARTY = ['guerrero', 'cazador', 'curandero'];
const LEAD = 'guerrero';
const WHO = ['lider', ...PARTY];
const EX = COMBAT.marea[1].expected;
const avg = (a) => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : 0);

/** Gasta los puntos libres: recorre las ramas en ronda y toma lo primero que esté a mano. */
function spendTree(st, keys) {
  for (let guard = 0; guard < 40 && T.treeInfo(st).free > 0; guard++) {
    const open = TREE_NODES.filter(n => (keys || !n.key) && T.canTake(st, n.id).ok);
    if (!open.length) break;
    const count = (b) => st.tree.nodes.filter(id => id.startsWith(b)).length;
    open.sort((a, b) => count(a.branch) - count(b.branch) || a.y - b.y);
    T.takeNode(st, open[0].id);
  }
}
const cfgOf = (enc, seed, marea, lo) => ({ encounter: enc, seed, party: PARTY, leader: { cls: LEAD }, level: EX.level,
  classLevel: Object.fromEntries(PARTY.map(c => [c, EX.classLevel])), marea, ...(lo ? { gear: lo.gear, rules: lo.rules } : {}) });

export function simulate({ seed = 1, runs = 10, keys = false } = {}) {
  const st = {};
  const best = {};          // mejores estrellas por encuentro y Marea (lo guarda la Travesía): abre la resolución automática
  let marea = 1;
  const rows = [], fights = [];
  for (let r = 1; r <= runs; r++) {
    const run = L.newRun({ seed: R.hashSeed('salida', seed, r), marea });
    const row = { run: r, marea, wins: 0, fights: 0, auto: 0, turns: [], stars: [], items: 0, rar: [0, 0, 0, 0, 0], veta: 0, mats: 0 };
    const seen = [];
    const steps = ['pelea', 'reliquia', 'pelea', 'pelea', 'reliquia', 'pelea', 'elite'];
    steps.forEach((step, i) => {
      if (step === 'reliquia') { const o = L.relicOffer(run); if (o.length) L.takeRelic(run, o[0]); return; }
      const elite = step === 'elite';
      const enc = R.pickEncounter({ island: 'arroyo', seed: R.hashSeed(run.seed, i), elite, avoid: seen });
      seen.push(enc);
      const fseed = R.hashSeed(run.seed, enc, i);
      L.equipBest(st, PARTY, LEAD);
      const lo = L.loadout(st, { party: PARTY, leaderCls: LEAD, run });
      const key = enc + '@' + marea;
      let res;
      if (R.canAutoResolve(enc, best[key] || 0)) { res = R.autoResolve({ encounter: enc, best: best[key], marea }); row.auto++; }
      else { res = playBattle(cfgOf(enc, fseed, marea, lo)).res; fights.push({ enc, seed: fseed, marea }); row.turns.push(res.turns); }
      row.fights++;
      if (res.outcome !== 'win') return;
      row.wins++; row.stars.push(res.stars);
      best[key] = Math.max(best[key] || 0, res.stars);
      const loot = L.battleLoot({ result: res, source: step, marea, seed: fseed, mods: lo.loot, luck: A.arsenalState(st).luck, wins: run.wins });
      L.noteWin(run, res);
      L.applyLoot(st, loot);
      row.items += loot.items.length; row.veta += loot.veta;
      row.mats += Object.values(loot.mats).reduce((s, n) => s + n, 0);
      for (const w of loot.items) row.rar[w.rarity]++;
      // la maestría del arma que usa cada uno (como en el juego: cada pelea suma al tipo que se lleva)
      for (const who of WHO) { const type = A.wieldType(st, who, LEAD); if (type) A.addMastery(st, type, 40 * (1 + (lo.loot.mastery || 0) / 100)); }
      spendTree(st, keys);
    });
    L.equipBest(st, PARTY, LEAD);
    const eq = WHO.map(w => A.equippedOn(st, w)).filter(Boolean);
    Object.assign(row, {
      power: Math.round(avg(WHO.map(w => L.itemPower(A.equippedOn(st, w))))), affixes: +avg(eq.map(w => L.affixesOf(w).length)).toFixed(1),
      rarity: +avg(eq.map(w => w.rarity)).toFixed(1), points: T.treeInfo(st).points, nodes: st.tree?.nodes.length || 0, relics: run.relics.length,
      avgTurns: +avg(row.turns).toFixed(1), avgStars: +avg(row.stars).toFixed(1),
    });
    rows.push(row);
    if (row.wins >= row.fights - 1 && marea < MAREA_MAX) marea++;
    else if (row.wins <= 2 && marea > 1) marea--;
  }
  // el control: las mismas peleas jugadas, sin nada puesto
  const bare = fights.map(f => playBattle(cfgOf(f.enc, f.seed, f.marea, null)).res);
  const byM = [1, 2, 3].map(m => { const x = bare.filter((_, i) => fights[i].marea === m); return { marea: m, n: x.length, wins: x.filter(r => r.outcome === 'win').length }; });
  return { rows, state: st, control: { n: bare.length, wins: bare.filter(r => r.outcome === 'win').length, turns: +avg(bare.filter(r => r.outcome === 'win').map(r => r.turns)).toFixed(1), byMarea: byM } };
}

function main() {
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
  const { rows, control, state } = simulate({ seed: arg('seed', 1), runs: arg('runs', 10), keys: process.argv.includes('--keys') });
  const pad = (s, n) => String(s).padStart(n);
  console.log('salida  Marea  ganadas  solas  turnos  estrellas  armas (c/pc/r/é/rel)   fuerza  rasgos  rareza  veta  puntos  reliquias');
  for (const r of rows) {
    console.log(`${pad(r.run, 5)}  ${pad('I'.repeat(r.marea), 5)}  ${pad(r.wins + '/' + r.fights, 7)}  ${pad(r.auto, 5)}  ${pad(r.avgTurns || '-', 6)}  ${pad(r.avgStars, 9)}  ${pad(r.items, 5)} (${r.rar.join('/')})`.padEnd(74)
      + `${pad(r.power, 6)}  ${pad(r.affixes, 6)}  ${pad(r.rarity, 6)}  ${pad(r.veta, 4)}  ${pad(r.points, 6)}  ${pad(r.relics, 9)}`);
  }
  const first = rows[0], mid = rows[Math.floor(rows.length / 2) - 1], last = rows[rows.length - 1];
  const played = rows.reduce((s, r) => s + r.fights - r.auto, 0), won = rows.reduce((s, r) => s + r.wins - r.auto, 0);
  console.log(`\nFuerza media del arma puesta: ${first.power} → ${mid.power} → ${last.power} (salidas 1, ${mid.run} y ${last.run}); rasgos por arma ${first.affixes} → ${last.affixes}; rareza media ${first.rarity} → ${last.rarity}.`);
  console.log(`Árbol: ${last.points} puntos y ${last.nodes} nodos tomados. Armas en total: ${rows.reduce((s, r) => s + r.items, 0)}; en el arsenal quedan ${state.arsenal.items.length}.`);
  console.log(`Peleas jugadas: ${won}/${played} ganadas con lo puesto; las mismas, sin nada puesto: ${control.wins}/${control.n} (${control.byMarea.filter(m => m.n).map(m => `Marea ${'I'.repeat(m.marea)} ${m.wins}/${m.n}`).join(', ')}).`);
  if (process.argv.includes('--check')) {
    const bad = [];
    if (!(last.power >= first.power * 1.5)) bad.push('la fuerza del arma puesta no sube 50 % en 10 salidas');
    if (!(last.affixes > first.affixes)) bad.push('no hay más rasgos por arma');
    if (!(last.points >= 8)) bad.push('menos de 8 puntos del árbol en 10 salidas');
    if (!(Math.max(...rows.map(r => r.marea)) >= 2)) bad.push('no se llegó a la Marea II');
    if (!(won >= control.wins)) bad.push('lo puesto no ayuda a ganar');
    console.log(bad.length ? '✘ ' + bad.join('; ') : '✔ el botín mejora de forma perceptible en 10 salidas');
    process.exit(bad.length ? 1 : 0);
  }
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
