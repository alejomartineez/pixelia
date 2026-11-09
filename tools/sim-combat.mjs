// Simulador de combate (DESIGN-COMBAT.md §8): una IA de jugador razonable juega miles de peleas con el motor real
// (src/combat/combat-rules.js) y reporta contra las metas de balance, con ✔/✘.
//
//   node tools/sim-combat.mjs                 reporte completo
//   node tools/sim-combat.mjs --n 20          peleas por combinación de grupo (default 20; hay 20 combinaciones de 3 clases)
//   node tools/sim-combat.mjs --noclass       el líder sin clase (como antes del paso 5b)
//   node tools/sim-combat.mjs --only banado_bestia
//   node tools/sim-combat.mjs --tools         suma una tabla con el efecto de cada herramienta (nivel 3)
//   node tools/sim-combat.mjs --no-real       sin la sección "En la partida" (los jefes con el grupo que da sim:economy)
//
// La IA (botTurn) es golosa con un paso de mirada: para cada integrante prueba cada casilla a la que llega y cada
// acción posible sobre una copia de la pelea, y se queda con la que mejor deja el tablero según evalState. Solo usa lo
// que el jugador ve (las intenciones a la vista, no las ocultas). Tiene un poco de ruido para no jugar perfecto.
// Con `knows` (del segundo intento contra un jefe en adelante) sabe la mecánica: busca lo alto y va por la pasarela.
import { pathToFileURL } from 'node:url';
import { COMBAT, ENCOUNTERS, ENEMIES, ACT1, CLASS_IDS, TUTORIAL_PARTY } from '../src/combat/combat-data.js';
import * as R from '../src/combat/combat-rules.js';

const man = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const RANGED = new Set(['cazador']);
const SUPPORT = new Set(['curandero']);

function mulberry(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- evaluación del tablero
const BLOCK = new Set(['arbol', 'roca', 'vacio']);
/** Pasos hasta la salida más cercana, por casillas que se pueden pisar (sin contar unidades). */
function exitDistance(b, sx, sy) {
  const seen = new Map([[sy * b.w + sx, 0]]);
  const q = [[sx, sy]];
  const exits = new Set(b.exits.map(([x, y]) => y * b.w + x));
  while (q.length) {
    const [x, y] = q.shift();
    const d = seen.get(y * b.w + x);
    if (exits.has(y * b.w + x)) return d;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy, i = ny * b.w + nx;
      if (nx < 0 || ny < 0 || nx >= b.w || ny >= b.h || seen.has(i) || BLOCK.has(b.tiles[i])) continue;
      if (b.walls.some(w => w.x === nx && w.y === ny)) continue;
      seen.set(i, d + 1); q.push([nx, ny]);
    }
  }
  return 20;
}
export function evalState(b, opt = {}) {
  if (b.ended) return b.outcome === 'win' ? 10000 - b.turn : b.outcome === 'lose' ? -10000 : -5000;
  const enc = ENCOUNTERS[b.enc];
  const al = R.allies(b), fo = R.foes(b);
  const danger = R.dangerMap(b);
  const vis = R.visibleIntentIds(b);
  let s = 0;
  // enemigos: menos vida y menos enemigos es mejor
  for (const e of fo) {
    const d = ENEMIES[e.type];
    s -= e.hp * (d.boss ? 1.3 : 1) + (d.boss ? 0 : 6);
    if (e.marked) s += 1.2;
    if (e.root) s += 0.8;
    if (!vis.has(e.id) && e.intent) {
      // lo que no se ve: se supone que pega alrededor
      for (const a of al) if (man(a, e) <= 1) s -= e.intent.dmg * 0.5;
    }
    if (e.intent && vis.has(e.id)) {
      // golpes que les van a caer a ellos mismos (fuego amigo)
      for (const [x, y] of R.intentTiles(b, e)) {
        const t = R.unitAt(b, x, y);
        if (t && t.side === 'enemy' && t !== e) s += e.intent.dmg * 0.6;
      }
    }
  }
  // el grupo
  for (const u of b.units) {
    if (u.side !== 'ally') continue;
    const lead = u.type === 'lider';
    if (u.safe) { s += 40; continue; }
    if (!u.alive) { s -= u.captive ? 400 : 18; continue; }
    s += u.hp * (lead ? 1.6 : u.captive ? 2 : 1);
    if (u.hp <= 3) s -= lead ? 4 : 1.5;
    // peligro de quedarse donde está
    const dg = danger[u.y * b.w + u.x];
    if (dg > 0) {
      const fixed = u.moved || u.acted || (u.captive && !u.freed);
      const w = fixed ? 1 : 0.3;
      s -= w * dg * (lead ? 2.2 : u.captive ? 2.5 : 1.2);
      if (dg >= u.hp) s -= w * (lead ? 60 : u.captive ? 80 : 8);
    }
    if (u.captive) continue;
    const near = fo.length ? Math.min(...fo.map(e => man(u, e))) : 0;
    if (fo.length) {
      const cls = u.cls || u.type;
      if (RANGED.has(cls)) s -= 0.35 * Math.abs(near - 3);
      else if (SUPPORT.has(cls) && !lead) {
        if (near <= 1) s -= 1.2;
        const hurt = al.filter(a => !a.captive && a !== u).sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
        if (hurt) s -= 0.25 * Math.max(0, man(u, hurt) - 2);
      } else s -= (lead ? 0.25 : 0.4) * near;
      const crowd = fo.filter(e => man(u, e) <= 1).length;
      if (crowd >= 2) s -= (lead ? 1.5 : 0.6) * (crowd - 1);
    }
    const tile = b.tiles[u.y * b.w + u.x];
    if (tile === 'alto') s += opt.knows && enc.id === 'banado_bestia' ? 2.5 : 0.5;
  }
  // objetivo
  if (b.objective.type === 'rescue') {
    const c = b.units.find(u => u.captive);
    if (c && c.alive && !c.safe) {
      const exitD = exitDistance(b, c.x, c.y);
      s -= 2 * exitD;
      if (!c.freed) s -= 12 + 1.2 * Math.min(...al.filter(a => !a.captive).map(a => man(a, c)));
    }
  }
  if (b.bridge && !b.bridge.cut) s -= b.bridge.hp * (opt.knows ? 1.5 : 0.6);
  if (b.bridge && b.bridge.cut) s += opt.knows ? 14 : 6;
  for (const t of b.traps) if (fo.some(e => Math.abs(e.x - t.x) + Math.abs(e.y - t.y) <= 3)) s += 0.7;
  // guardar las recargas y los consumibles para cuando hagan falta
  for (const u of al) for (const v of Object.values(u.cd)) s -= 0.12 * v;
  for (const n of Object.values(b.items)) s += 1.2 * n;
  s += 0.3 * b.stats.combos.length;
  return s;
}

// ---------------------------------------------------------------- turno del jugador
function candidateTargets(b, u, ab) {
  const ts = R.targets(b, u.id, ab.id);
  const kind = ab.def.kind;
  if (kind === 'trap' || kind === 'wall') {
    // trampas y paredes: solo cerca de enemigos o del grupo (para no probar las 64 casillas)
    const fo = R.foes(b);
    return ts.filter(t => fo.some(e => Math.abs(e.x - t.x) + Math.abs(e.y - t.y) <= 2)).slice(0, 8);
  }
  if (kind === 'heal') return ts.filter(t => { const o = R.unitAt(b, t.x, t.y); return o && o.hp < o.maxHp; });
  if (kind === 'healArea') return R.allies(b).some(a => !a.captive && a.hp < a.maxHp && man(a, u) <= 2) ? ts : [];
  if (kind === 'swap') return ts.filter(t => R.dangerMap(b)[t.y * b.w + t.x] > 0 || R.unitAt(b, t.x, t.y)?.captive);
  return ts;
}

function bestPlan(b, u, opt, rnd) {
  let best = null;
  const consider = (score, tile, ab, t) => {
    const sc = score + (opt.noise ? (rnd() - 0.5) * opt.noise : 0);
    if (!best || sc > best.score) best = { score: sc, tile, ab, t };
  };
  for (const tile of R.reachable(b, u.id)) {
    const p = R.preview(b, u.id, null, 0, 0, [tile.x, tile.y]);
    const c = p.after;
    consider(evalState(c, opt) - tile.cost * 0.01, tile, null, null);
    if (u.captive) continue;
    for (const ab of R.abilitiesOf(c, u.id)) {
      if (!ab.ready) continue;
      for (const t of candidateTargets(c, R.unitById(c, u.id), ab)) {
        const q = R.preview(c, u.id, ab.id, t.x, t.y);
        if (!q.ok) continue;
        consider(evalState(q.after, opt) - tile.cost * 0.01, tile, ab.id, t);
      }
    }
  }
  return best;
}

/** Juega el turno del grupo (no termina el turno). */
export function botTurn(b, opt = {}, rnd = Math.random) {
  const done = new Set();
  for (let guard = 0; guard < 8 && !b.ended; guard++) {
    const list = R.allies(b).filter(u => !done.has(u.id) && (u.captive ? u.freed && !u.moved : !u.acted));
    if (!list.length) break;
    // primero quien está en peligro, después quien puede liquidar algo; la sanidad al final
    let pick = null;
    for (const u of list) {
      const plan = bestPlan(b, u, opt, rnd);
      if (!plan) continue;
      const gain = plan.score - evalState(b, opt);
      if (!pick || gain > pick.gain) pick = { u, plan, gain };
    }
    if (!pick) break;
    const { u, plan } = pick;
    if (plan.tile.x !== u.x || plan.tile.y !== u.y) R.move(b, u.id, plan.tile.x, plan.tile.y);
    if (plan.ab) R.act(b, u.id, plan.ab, plan.t.x, plan.t.y);
    done.add(u.id);
  }
}

/** Una pelea entera con la IA. Devuelve el resultado del motor más la pelea final. */
export function playBattle(cfg, opt = {}) {
  const b = R.newBattle(cfg);
  const rnd = mulberry((cfg.seed || 1) * 7919 + 13);
  const o = { noise: 1.2, ...opt };
  for (let k = 0; k < 60 && !b.ended; k++) {
    botTurn(b, o, rnd);
    if (b.ended) break;
    R.endTurn(b);
    R.enemyTurn(b);
    if (o.onTurn) o.onTurn(b);
  }
  return { res: R.result(b), b };
}

// ---------------------------------------------------------------- reporte
export function combos3() {
  const out = [];
  for (let i = 0; i < CLASS_IDS.length; i++) for (let j = i + 1; j < CLASS_IDS.length; j++) for (let k = j + 1; k < CLASS_IDS.length; k++)
    out.push([CLASS_IDS[i], CLASS_IDS[j], CLASS_IDS[k]]);
  return out;
}
const pct = (x) => (100 * x).toFixed(1).padStart(5) + ' %';
const ok = (c) => (c ? '✔' : '✘');

/** Grupo esperado: nivel del líder y de clase de `expected`, el elemento, y el líder de la clase `lead` (null: sin clase). */
export function expectedCfg(id, party, seed, extra = {}, lead = null) {
  const ex = ENCOUNTERS[id].expected || {};
  // classLevel: un número (todos iguales) o una lista del mejor al peor integrante (el abordaje, con la gente de la ciudad)
  const cl = ex.classLevel || 1;
  return { encounter: id, seed, party, level: ex.level || 1, element: ex.element || null, leader: lead ? { cls: lead } : null,
    classLevel: Object.fromEntries(party.map((c, i) => [c, Array.isArray(cl) ? cl[i] || 1 : cl])), tools: { ...(ex.tools || {}) }, equip: (ex.equip || []).slice(), ...extra };
}
let LEAD_CLASSES = CLASS_IDS;

function runEncounter(id, N, extra = {}, opt = {}) {
  const st = { n: 0, wins: 0, turns: 0, winTurns: 0, stars: 0, dmg: {}, kills: {}, share: {}, shareN: {}, killShare: {}, roleWin: {}, roleN: {}, reasons: {} };
  let seed = 1000;
  for (const party of combos3()) {
    for (let k = 0; k < N; k++) {
      const lead = LEAD_CLASSES[seed % LEAD_CLASSES.length] || null;
      const { res } = playBattle(expectedCfg(id, party, ++seed, extra, lead), opt);
      st.n++;
      const win = res.outcome === 'win';
      st.wins += win;
      st.turns += res.turns;
      if (win) { st.winTurns += res.turns; st.stars += res.stars; }
      st.reasons[res.reason] = (st.reasons[res.reason] || 0) + 1;
      const tot = Object.values(res.dmg).reduce((a, n) => a + n, 0) || 1;
      const ktot = Object.values(res.kills).reduce((a, n) => a + n, 0) || 1;
      const keys = [['lider', 'lider'], ...party.map(c => [c, c])];
      if (lead) keys.push(['lider', 'líder ' + lead]);
      for (const [t, name] of keys) {
        st.share[name] = (st.share[name] || 0) + (res.dmg[t] || 0) / tot;
        st.killShare[name] = (st.killShare[name] || 0) + (res.kills[t] || 0) / ktot;
        st.shareN[name] = (st.shareN[name] || 0) + 1;
      }
      for (const r of CLASS_IDS) {
        const has = party.includes(r) ? 'con' : 'sin';
        st.roleN[r + has] = (st.roleN[r + has] || 0) + 1;
        st.roleWin[r + has] = (st.roleWin[r + has] || 0) + win;
      }
    }
  }
  return st;
}

/**
 * "En la partida" (paso 7): los jefes con el grupo que tiene la ciudad cuando llegan, según sim:economy (semilla 1, con
 * la gente y sus herramientas; la línea "(info) en cada rango"). classLevel va del mejor al peor integrante: con cada
 * combinación de 3 clases, la primera tiene el nivel más alto.
 */
export const REAL = [
  { id: 'bestia_r3', enc: 'banado_bestia', name: 'Bestia, rango 3', level: 2, classLevel: [2, 1, 1], element: null,
    tools: { catalejo: 1, martillo: 1, cuerda: 3, botiquin: 1 } },
  // dato, sin meta: quien espera al rango 4 para ir a la poza la encuentra más fácil (la meta es la del capítulo, el rango 3)
  { id: 'bestia_r4', enc: 'banado_bestia', name: 'Bestia, rango 4 (dato)', level: 4, classLevel: [6, 5, 1], element: null, info: true,
    tools: { catalejo: 4, martillo: 2, cuerda: 4, botiquin: 3 } },
];
// la capitana se pelea solo en el abordaje: su grupo esperado (combat-data) ya es el de la ciudad en el rango 6
function runReal(sc, N, attempt) {
  const st = { n: 0, wins: 0, winTurns: 0 };
  let seed = 5000;
  for (const party of combos3()) {
    for (let k = 0; k < N; k++) {
      const lead = LEAD_CLASSES[seed % LEAD_CLASSES.length] || null;
      const cfg = { encounter: sc.enc, seed: ++seed, party, level: sc.level, element: sc.element, leader: lead ? { cls: lead } : null,
        classLevel: Object.fromEntries(party.map((c, i) => [c, sc.classLevel[i] || 1])), tools: sc.tools || {}, equip: sc.equip || [], attempt };
      const { res } = playBattle(cfg, { knows: attempt >= 2 });
      st.n++;
      if (res.outcome === 'win') { st.wins++; st.winTurns += res.turns; }
    }
  }
  return st;
}

function main() {
  const args = process.argv.slice(2);
  const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
  const N = Number(opt('n', 20));
  if (opt('noclass', false)) LEAD_CLASSES = [null];
  const ONLY = opt('only', null);
  const TOOLS = !!opt('tools', false);
  const t0 = Date.now();
  let fails = 0;
  const check = (cond) => { if (!cond) fails++; return ok(cond); };
  const ids = ONLY ? [ONLY] : ACT1;
  const allShare = {}, allShareN = {}, allKill = {};

  const allWin = {}, allWinN = {};
  const addWins = (s) => { for (const [k, v] of Object.entries(s.roleWin)) { allWin[k] = (allWin[k] || 0) + v; allWinN[k] = (allWinN[k] || 0) + s.roleN[k]; } };
  console.log(`Simulador de combate · ${N} peleas por grupo × 20 grupos (las combinaciones de 3 clases; el líder rota de clase) · grupo esperado\n`);
  console.log('Encuentro                 tipo    ganadas   turnos (gan.)  ★ prom.  meta');
  for (const id of ids) {
    const enc = ENCOUNTERS[id];
    if (enc.kind === 'jefe') {
      const a = [1, 2, 3].map(at => runEncounter(id, N, { attempt: at }, { knows: at >= 2 }));
      const p = a.map(s => s.wins / s.n);
      const cum = 1 - (1 - p[0]) * (1 - p[1]) * (1 - p[2]);
      const turns = a[0].winTurns / Math.max(1, a[0].wins);
      console.log(`${enc.name.padEnd(25)} jefe   1.º ${pct(p[0])}  ${turns.toFixed(1).padStart(5)}          ${(a[0].stars / Math.max(1, a[0].wins)).toFixed(2)}   45–65 % ${check(p[0] >= 0.45 && p[0] <= 0.65)}`);
      console.log(`${''.padEnd(25)}        2.º ${pct(p[1])}  ${(a[1].winTurns / Math.max(1, a[1].wins)).toFixed(1).padStart(5)}`);
      console.log(`${''.padEnd(25)}        3.º ${pct(p[2])}  ${(a[2].winTurns / Math.max(1, a[2].wins)).toFixed(1).padStart(5)}                  ≥ 85 % ${check(p[2] >= 0.85)}`);
      console.log(`${''.padEnd(25)}        ganado al 3.º o antes: ${pct(cum)}`);
      console.log(`${''.padEnd(25)}        duración del jefe (ganadas, 1.º): ${turns.toFixed(1)} turnos · 6–12 ${check(turns >= 6 && turns <= 12)}`);
      console.log(`${''.padEnd(25)}        cómo terminan (1.º): ${Object.entries(a[0].reasons).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
      addWins(a[0]);
      for (const t of Object.keys(a[0].share)) { allShare[t] = (allShare[t] || 0) + a[0].share[t]; allShareN[t] = (allShareN[t] || 0) + a[0].shareN[t]; allKill[t] = (allKill[t] || 0) + a[0].killShare[t]; }
    } else {
      const s = runEncounter(id, N);
      const p = s.wins / s.n;
      console.log(`${enc.name.padEnd(25)} común       ${pct(p)}  ${(s.winTurns / Math.max(1, s.wins)).toFixed(1).padStart(5)}          ${(s.stars / Math.max(1, s.wins)).toFixed(2)}   85–95 % ${check(p >= 0.85 && p <= 0.95)}`);
      console.log(`${''.padEnd(25)}        cómo terminan: ${Object.entries(s.reasons).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
      addWins(s);
      for (const t of Object.keys(s.share)) { allShare[t] = (allShare[t] || 0) + s.share[t]; allShareN[t] = (allShareN[t] || 0) + s.shareN[t]; allKill[t] = (allKill[t] || 0) + s.killShare[t]; }
    }
  }

  console.log('\nAporte por clase (promedio por pelea en la que está; el líder está siempre)');
  console.log('Clase              daño      golpes finales   ganadas con / sin   meta ≤ 35 %');
  for (const t of ['lider', ...CLASS_IDS, ...CLASS_IDS.map(c => 'líder ' + c)]) {
    if (!allShareN[t]) continue;
    const d = allShare[t] / allShareN[t], k = allKill[t] / allShareN[t];
    const lead = t.startsWith('líder ');
    const w = allWin[t + 'con'] != null ? `${pct(allWin[t + 'con'] / allWinN[t + 'con'])} / ${pct(allWin[t + 'sin'] / allWinN[t + 'sin'])}` : ''.padEnd(17);
    console.log(`${t.padEnd(18)} ${pct(d)}   ${pct(k)}          ${w}   ${lead ? '(como líder)' : check(d <= 0.35 && k <= 0.35)}`);
  }

  if (!opt('no-real', false) && !ONLY) {
    console.log('\nEn la partida: los jefes con el grupo que tiene la ciudad cuando llegan (sim:economy, con la gente y sus herramientas)');
    console.log('Escenario                    nivel · clases     1.º        3.º        meta');
    for (const sc of REAL) {
      const n = Math.max(5, N >> 1);
      const a1 = runReal(sc, n, 1), a3 = runReal(sc, n, 3);
      const p1 = a1.wins / a1.n, p3 = a3.wins / a3.n;
      console.log(`${sc.name.padEnd(28)} ${String(sc.level).padStart(2)} · ${sc.classLevel.join('/').padEnd(9)} ${pct(p1)}  ${pct(p3)}   ${sc.info ? '(sin meta)          ' : `45–65 % ${check(p1 >= 0.45 && p1 <= 0.65)} · ≥ 85 % ${check(p3 >= 0.85)}`} · ${(a1.winTurns / Math.max(1, a1.wins)).toFixed(1)} turnos`);
    }
  }

  if (TOOLS) {
    console.log('\nHerramientas (nivel 3) y nivel del líder: % ganadas, primer intento contra los jefes');
    const variants = [['sin nada', {}], ['Catalejo 3', { tools: { catalejo: 3 } }], ['Martillo 3', { tools: { martillo: 3 } }],
      ['Cuerda 3', { tools: { cuerda: 3 } }], ['Botiquín 3', { tools: { botiquin: 3 } }], ['Farol 3', { tools: { farol: 3 } }],
      ['líder +5 niveles', { levelPlus: 5 }]];
    const pick = ids.filter(id => ['bosque_manada', 'banado_bestia', 'costa_capitana'].includes(id));
    console.log('Variante            ' + pick.map(id => ENCOUNTERS[id].name.slice(0, 18).padEnd(20)).join(''));
    for (const [name, v] of variants) {
      const row = pick.map(id => {
        const lv = (ENCOUNTERS[id].expected.level || 1) + (v.levelPlus || 0);
        const s = runEncounter(id, Math.max(10, N >> 1), { tools: v.tools || {}, level: lv });
        return pct(s.wins / s.n).padEnd(20);
      });
      console.log(name.padEnd(20) + row.join(''));
    }
  }

  console.log(`\n${fails ? '✘ ' + fails + ' meta(s) sin cumplir' : '✔ todas las metas'} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exitCode = fails ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
export { TUTORIAL_PARTY };
