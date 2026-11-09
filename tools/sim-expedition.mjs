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
import { play } from './exp-bots.mjs';   // los bots viven en exp-bots.mjs (también los usa sim-economy.mjs)

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const N = Number(opt('n', 500));
const ONLY = opt('only', null);
const KIND = opt('kind', 'normal');
const CF = Number(opt('cf', 6));          // muestras del contrafáctico por decisión de volver
const BOTS = ['prudente', 'medio', 'codicioso', 'azar'];

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
    mods: { tier: Object.fromEntries(profile.party.map(p => [p, profile.level])), cargoMax: profile.cargoMax, encantoStars: profile.encanto || 0 },
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
    const party = T >= 3 ? ['cazador', 'forjador', 'monje'] : ['cazador', 'forjador'];
    for (const zone of [1, 3, 5]) {
      report(`${REGIONS[region].name} · zona ${zone}`, { region, zone, kind: KIND, party, level: T, prov: KIND === 'corta' ? 10 : EXP.provMax[Math.min(4, T)], cargoMax: 6 + 3 * Math.min(5, T + 1) }, { checks: zone === 1 });
    }
  }
  console.log('\n=== Grupo y nivel de roles (Bosque, zona 1, mismas provisiones y carga que el prototipo) ===');
  for (const party of [[], ['cazador'], ['forjador', 'curandero'], ['monje', 'saqueador'], ['cazador', 'forjador', 'curandero'], ['guerrero', 'forjador']]) {
    for (const level of party.length ? [1, 3, 5] : [1]) report(`grupo ${party.join('+') || 'solo'} nv ${level}`, { ...PROTO, party, level }, { checks: false });
  }
}
