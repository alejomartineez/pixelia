// Simulador de las Amenazas (DESIGN-CORE.md §3, §8 "Amenazas"): arma ciudades de muestra por rango, prepara defensas como
// lo haría alguien que juega normal, y juega la escena de defensa con el bot del motor real (src/threats/threat-rules.js).
// Reporta preparación, % salvado jugando y automático, y dañados, con ✔/✘ contra las metas.
//
//   node tools/sim-threats.mjs              reporte completo (200 ciudades por tipo y perfil)
//   node tools/sim-threats.mjs --n 500      ciudades por combinación
//   node tools/sim-threats.mjs --type crecida
//
// Perfiles de preparación:
//   media   una defensa del tipo junto a lo que está en riesgo (nivel ⌈rango/2⌉) y las reservas que pide
//   floja   sin defensa del tipo y la mitad de las reservas
//   nada    sin defensas ni reservas (jugando igual)
import * as R from '../src/threats/threat-rules.js';
import { THREAT_TYPES, crewsFor } from '../src/threats/threat-data.js';
import { BUILDING_BY_ID, DEFENSES, eraOfRank } from '../src/core/data.js';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const N = Number(opt('n', 200));
const ONLY = opt('type', null);
const QUIET = args.includes('--quiet');
const SLIP = Number(opt('slip', 0.25));   // chance de que el bot ponga una cuadrilla en cualquier lado (persona apurada)

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Ciudad de muestra para un rango: terreno, Municipalidad, casas, negocios, productores, caminos y árboles. */
function makeCity(rank, seed) {
  const r = mulberry(seed);
  const side = Math.min(26, 12 + 2 * Math.min(7, rank - 1 + Math.floor(r() * 2)));
  const min = 14 - side / 2, max = min + side;
  const occ = new Set();
  const buildings = [];
  let uid = 1;
  const free = (x, z, w, d) => { if (x < min || z < min || x + w > max || z + d > max) return false; for (let i = x; i < x + w; i++) for (let j = z; j < z + d; j++) if (occ.has(i + ',' + j)) return false; return true; };
  const put = (id, x, z, extra = {}) => {
    const def = BUILDING_BY_ID[id];
    const [w, d] = def.size;
    if (!free(x, z, w, d)) return null;
    for (let i = x; i < x + w; i++) for (let j = z; j < z + d; j++) occ.add(i + ',' + j);
    const level = extra.level || (def.cat === 'deco' || def.cat === 'camino' ? 1 : 1 + Math.floor(r() * Math.min(5, 1 + rank / 2)));
    const era = def.cat === 'deco' || def.cat === 'camino' ? 1 : (r() < 0.55 ? eraOfRank(rank) : Math.max(1, eraOfRank(rank) - 1));
    const b = { uid: uid++, id, x, z, w, d, level, era, cat: def.cat, prov: !!def.prod?.prov, wood: era === 1, tree: id === 'arbol' || id === 'cerezo',
      height: id === 'castillo' ? 3 + rank * 0.4 : (def.cat === 'casa' || def.cat === 'negocio' ? 0.9 + level * 0.35 + (w > 2 ? 0.6 : 0) : 0.8 + level * 0.2) };
    buildings.push(b);
    return b;
  };
  const c = 12;
  put('castillo', c, c, { level: rank });
  // caminos en cruz
  for (let a = min; a < max; a++) { put('camino', a, c - 1); put('camino', c - 1, a); }
  const pool = ['casita', 'casita', 'cabana', 'chalet', 'panaderia', 'heladeria', 'floreria', 'huerta', 'huerta', 'tambo', 'molino', 'cafeteria'];
  const want = 8 + rank * 4;
  for (let k = 0, tries = 0; k < want && tries < 800; tries++) {
    const id = pool[Math.floor(r() * pool.length)];
    const x = min + Math.floor(r() * side), z = min + Math.floor(r() * side);
    if (put(id, x, z)) k++;
  }
  for (let k = 0; k < 6 + rank; k++) put(r() < 0.7 ? 'arbol' : 'cerezo', min + Math.floor(r() * side), min + Math.floor(r() * side));
  return { bounds: { min, max }, buildings, occ, put, r };
}

/** Prepara la ciudad según el perfil: devuelve las reservas que tiene. */
function prepare(city, type, f, profile) {
  const info = R.prepInfo(type, city, 0, f);
  const need = info.need;
  if (profile === 'nada') return 0;
  if (profile === 'floja') return Math.floor(need / 2);
  // media: 1 defensa del tipo (2 si hay 6+ en riesgo) en el lugar libre que más edificios en riesgo cubre
  const defId = Object.keys(DEFENSES).find(k => DEFENSES[k].threat === type);
  const lv = Math.max(1, Math.min(5, Math.ceil(f / 2)));
  const nDef = info.enRiesgo >= 6 ? 2 : 1;
  for (let k = 0; k < nDef; k++) {
    const [w, d] = BUILDING_BY_ID[defId].size;
    let best = null, bs = -1;
    const cur = R.prepInfo(type, city, 0, f);
    const uncovered = cur.list.filter(x => !x.covered).map(x => city.buildings.find(b => b.uid === x.uid));
    for (let x = city.bounds.min; x <= city.bounds.max - w; x++) for (let z = city.bounds.min; z <= city.bounds.max - d; z++) {
      let ok = true;
      for (let i = x; i < x + w && ok; i++) for (let j = z; j < z + d; j++) if (city.occ.has(i + ',' + j)) { ok = false; break; }
      if (!ok) continue;
      const rect = { x, z, w, d };
      const R0 = (DEFENSES[defId].radius[lv - 1]);
      const s = uncovered.filter(b => R.covers(rect, R0, b)).length;
      if (s > bs) { bs = s; best = [x, z]; }
    }
    if (best) city.put(defId, best[0], best[1], { level: lv });
  }
  return need;
}

function run(type, profile, rank) {
  let prepSum = 0, playSum = 0, autoSum = 0, dmgPlay = 0, dmgAuto = 0, n = 0, play90 = 0, risk = 0;
  for (let k = 0; k < N; k++) {
    const city = makeCity(rank, 1000 * rank + k * 7 + type.length);
    const f = rank;
    const have = prepare(city, type, f, profile);
    const info = R.prepInfo(type, city, have, f);
    if (!info.enRiesgo) continue;
    n++;
    risk += info.enRiesgo;
    prepSum += info.prep;
    const auto = R.autoResolve(info.prep, f, info.enRiesgo, Math.random, have);
    autoSum += auto.pct; dmgAuto += auto.damaged;
    const d = R.newDefense({ type, f, city, reserves: have, K: crewsFor(rank * 2), seed: k + 1 });
    const res = R.finishWithBot(d, { slip: SLIP });
    playSum += res.pct; dmgPlay += res.damaged.length;
    if (res.pct >= 90) play90++;
  }
  return { type, profile, rank, n, risk: risk / n, prep: prepSum / n, play: playSum / n, auto: autoSum / n, dmgPlay: dmgPlay / n, dmgAuto: dmgAuto / n, play90: play90 / n };
}

const types = ONLY ? [ONLY] : Object.keys(THREAT_TYPES);
const rows = [];
for (const type of types) for (const profile of ['media', 'floja', 'nada']) for (const rank of [2, 4, 6, 8]) {
  if (THREAT_TYPES[type].rank > rank) continue;
  rows.push(run(type, profile, rank));
}
const f1 = (v) => v.toFixed(1).padStart(5), p0 = (v) => (v * 100).toFixed(0).padStart(4) + '%';
if (!QUIET) {
  console.log('tipo       perfil rango  enRiesgo  prep  jugada  ≥90%   auto  dañ.jug dañ.auto');
  for (const x of rows) if (x.n) console.log(`${x.type.padEnd(10)} ${x.profile.padEnd(6)} ${String(x.rank).padStart(4)}   ${f1(x.risk)}   ${p0(x.prep)} ${f1(x.play)}%  ${p0(x.play90)} ${f1(x.auto)}%   ${f1(x.dmgPlay)}   ${f1(x.dmgAuto)}`);
}
// metas (§8): preparación media ≥ 70%; con prep ≥ 0,7 jugando ≥ 90%; automática 75–95%; ≤ 2 dañados en promedio
const media = rows.filter(x => x.profile === 'media');
const avg = (a, k) => { a = a.filter(x => x.n > 0); return a.reduce((s, x) => s + x[k], 0) / a.length; };
const checks = [
  ['preparación media ≥ 70%', avg(media, 'prep') >= 0.7, p0(avg(media, 'prep'))],
  ['jugando con preparación media ≥ 90% salvado', avg(media, 'play') >= 90, f1(avg(media, 'play')) + '%'],
  ['automática con preparación media entre 75% y 95%', avg(media, 'auto') >= 75 && avg(media, 'auto') <= 95, f1(avg(media, 'auto')) + '%'],
  ['≤ 2 dañados en promedio (automática, media)', avg(media, 'dmgAuto') <= 2, f1(avg(media, 'dmgAuto'))],
  ['jugar rinde más que la automática (media)', avg(media, 'play') > avg(media, 'auto'), `${f1(avg(media, 'play'))} vs ${f1(avg(media, 'auto'))}`],
  ['sin preparar se nota (nada < media jugando)', avg(rows.filter(x => x.profile === 'nada'), 'play') < avg(media, 'play'), f1(avg(rows.filter(x => x.profile === 'nada'), 'play')) + '%'],
];
console.log('\nMetas');
let fail = 0;
for (const [txt, ok, val] of checks) { console.log(`${ok ? '✔' : '✘'} ${txt}: ${val}`); if (!ok) fail++; }
process.exitCode = fail ? 1 : 0;
