// Simulador del farmeo (PLAN-FOTO, paso A2): juega los encuentros de 6×6 de la isla del Bosque del Arroyo con el bot
// de sim-combat.mjs, en Marea I a III, y chequea las metas del paso:
//   · una pelea común dura de 3 a 5 turnos (promedio de las ganadas) y de 1 a 2 minutos
//   · se gana seguido en Marea I (≥ 85 %) y la III aprieta sin ser una pared (≥ 45 %)
//   · las reacciones de elementos no pasan del 35 % del daño (PLAN-TRAVESIA, "Los elementos")
//   node sim-farm.mjs [N] [--json]
// El tiempo es una estimación: por cada acción del grupo, lo que tarda una persona en decidir y hacer clic (THINK) más
// la animación; por cada evento del turno enemigo, su animación (los mismos milisegundos que usa combat-scene.js),
// dividido por la velocidad. test-combat-farm.mjs mide lo mismo en la escena de verdad.
import { pathToFileURL } from 'node:url';
import { playBattle, expectedCfg } from './sim-combat.mjs';
import { ENCOUNTERS, FARM, COMBAT } from '../src/combat/combat-data.js';

export const THINK = 3.0;        // segundos por acción de una persona que ya conoce el juego (elegir, mover y pegar)
// animación por evento, en ms a velocidad ×1 (de playOne en combat-scene.js, redondeado)
const ANIM = { move: 400, enemyMove: 450, act: 380, strike: 520, dmg: 260, down: 320, heal: 160, push: 220, charge: 320, spawn: 300, combo: 420, react: 300,
  enemyPhase: 500, turn: 350, explode: 160, trapHit: 120, fire: 120, steam: 120, drift: 220, flood: 380 };
export function secondsOf(log, speed = 1) {
  let ms = 0, acts = 0;
  for (const e of log) { ms += ANIM[e.type] || 0; if (e.type === 'act' || (e.type === 'move' && e.solo)) acts++; }
  return acts * THINK + ms / 1000 / speed;
}

const PARTIES = [['cazador', 'forjador', 'curandero'], ['guerrero', 'cazador', 'curandero'], ['monje', 'saqueador', 'cazador'], ['guerrero', 'forjador', 'monje']];
const FRAGS = [[], ['brasa'], ['marea'], ['cefiro']];

export function runFarm(id, marea, N) {
  const st = { n: 0, wins: 0, turns: 0, stars3: 0, secs: 0, secs2: 0, dmg: 0, react: 0, reacts: 0, turnHist: {} };
  for (let k = 0; k < N; k++) {
    const party = PARTIES[k % PARTIES.length];
    const ex = COMBAT.marea[marea].expected;
    const cfg = expectedCfg(id, party, 1000 + k * 37, { marea, fragments: FRAGS[(k >> 2) % FRAGS.length], level: ex.level, classLevel: Object.fromEntries(party.map(c => [c, ex.classLevel])) });
    const { res, b } = playBattle(cfg, { noise: 1.2 });
    st.n++;
    // acciones del grupo: una por integrante vivo y turno, como mucho (el bot no deja a nadie sin jugar si puede)
    const acts = res.turns * b.units.filter(u => u.side === 'ally' && !u.captive).length * 0.85;
    const foePhase = res.turns * (0.5 + b.units.filter(u => u.side === 'enemy').length * 0.75);
    const total = Object.values(res.dmg).reduce((a, n) => a + n, 0);
    st.dmg += total; st.react += res.reactDmg || 0; st.reacts += res.reacts || 0;
    if (res.outcome !== 'win') continue;
    st.wins++; st.turns += res.turns; st.turnHist[res.turns] = (st.turnHist[res.turns] || 0) + 1;
    if (res.stars === 3) st.stars3++;
    st.secs += acts * (THINK + 0.8) + foePhase;
    st.secs2 += acts * (THINK + 0.4) + foePhase / 2;
  }
  return st;
}

function main() {
  const N = Number(process.argv.find(a => /^\d+$/.test(a))) || 40;
  const t0 = Date.now();
  let fails = 0;
  const check = (c, msg) => { if (!c) { fails++; console.log('    ✘ ' + msg); } };
  const all = { secs: 0, turns: 0, wins: 0 };
  for (const marea of [1, 2, 3]) {
    console.log(`\nMarea ${'I'.repeat(marea)}  (vida ×${COMBAT.marea[marea].hp}, golpe +${COMBAT.marea[marea].dmg}, botín ×${COMBAT.marea[marea].loot})`);
    console.log('  encuentro                    gana   turnos  3★     ×1      ×2     reacción');
    const tot = { n: 0, wins: 0, turns: 0, secs: 0, secs2: 0, dmg: 0, react: 0 };
    for (const id of [...FARM.arroyo.comunes, ...FARM.arroyo.elites]) {
      const s = runFarm(id, marea, N);
      const w = Math.max(1, s.wins), enc = ENCOUNTERS[id];
      const turns = s.turns / w, secs = s.secs / w, secs2 = s.secs2 / w;
      console.log(`  ${(enc.name + (enc.elite ? ' (élite)' : '')).slice(0, 28).padEnd(28)} ${(100 * s.wins / s.n).toFixed(0).padStart(4)} %  ${turns.toFixed(1).padStart(5)}  ${(100 * s.stars3 / w).toFixed(0).padStart(3)} %  ${secs.toFixed(0).padStart(4)} s  ${secs2.toFixed(0).padStart(4)} s  ${(100 * s.react / Math.max(1, s.dmg)).toFixed(0).padStart(3)} %`);
      if (!enc.elite) {
        for (const k of ['n', 'wins', 'turns', 'secs', 'secs2', 'dmg', 'react']) tot[k] += s[k];
        if (enc.objective.type === 'defeat') check(turns >= 2.5 && turns <= (marea === 3 ? 6 : 5.5), `${enc.name}: ${turns.toFixed(1)} turnos (meta 3 a 5)`);
        check(s.wins / s.n >= (marea === 1 ? 0.8 : marea === 2 ? 0.6 : 0.4), `${enc.name}: gana ${(100 * s.wins / s.n).toFixed(0)} %`);
      }
    }
    const w = Math.max(1, tot.wins);
    console.log(`  — comunes: gana ${(100 * tot.wins / tot.n).toFixed(0)} %, ${(tot.turns / w).toFixed(1)} turnos, ${(tot.secs / w).toFixed(0)} s a ×1 y ${(tot.secs2 / w).toFixed(0)} s a ×2, reacciones ${(100 * tot.react / Math.max(1, tot.dmg)).toFixed(0)} % del daño`);
    check(tot.turns / w >= 3 && tot.turns / w <= 5, `Marea ${marea}: promedio de ${(tot.turns / w).toFixed(1)} turnos (meta 3 a 5)`);
    check(tot.secs / w >= 55 && tot.secs / w <= 125, `Marea ${marea}: ${(tot.secs / w).toFixed(0)} s por pelea a ×1 (meta 60 a 120)`);
    check(tot.react / Math.max(1, tot.dmg) <= 0.35, `Marea ${marea}: las reacciones hacen ${(100 * tot.react / tot.dmg).toFixed(0)} % del daño (tope 35 %)`);
    check(tot.wins / tot.n >= (marea === 1 ? 0.85 : marea === 2 ? 0.7 : 0.45), `Marea ${marea}: gana ${(100 * tot.wins / tot.n).toFixed(0)} %`);
    if (marea === 1) Object.assign(all, tot);
  }
  console.log(`\n${fails ? '✘ ' + fails + ' meta(s) sin cumplir' : '✔ todas las metas'} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exitCode = fails ? 1 : 0;
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
