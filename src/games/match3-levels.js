// Joyas Reales — niveles infinitos, generados de forma determinista a partir del número.
// Los movimientos se calculan con "costos" medidos por simulación (jugadas que necesita
// una jugadora promedio para cumplir cada objetivo) multiplicados por un margen que se achica despacio.
import { ROWS, COLS, mulberry32, Engine } from './match3-engine.js';

export const GEM_NAMES = ['corazones', 'coronas', 'diamantes', 'estrellas', 'flores', 'moños'];

const SHAPES = {
  esquinas: ['.xxxxxx.', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', '.xxxxxx.'],
  centro: ['xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxx..xxx', 'xxx..xxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx'],
  corazon: ['.xx..xx.', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', '.xxxxxx.', '..xxxx..', '...xx...'],
  diamante: ['..xxxx..', '.xxxxxx.', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', '.xxxxxx.', '..xxxx..'],
  cruz: ['..xxxx..', '..xxxx..', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', '..xxxx..', '..xxxx..'],
  reloj: ['xxxxxxxx', 'xxxxxxxx', '.xxxxxx.', '..xxxx..', '..xxxx..', '.xxxxxx.', 'xxxxxxxx', 'xxxxxxxx'],
  columnas: ['xxxxxxxx', 'xxxxxxxx', 'x.xxxx.x', 'x.xxxx.x', 'x.xxxx.x', 'x.xxxx.x', 'xxxxxxxx', 'xxxxxxxx'],
  castillo: ['x.xx.xx.', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx'],
  puente: ['xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xx....xx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx'],
};
const SHAPE_KEYS = Object.keys(SHAPES);

// patrones de cristales: [función, costo q75 para (5 colores,1 capa), (6,1), (5,2), (6,2)]
const ICE = {
  centroChico: [(r, c) => r >= 3 && r <= 4 && c >= 2 && c <= 5, [7, 9, 12, 19]],
  centro: [(r, c) => r >= 2 && r <= 5 && c >= 2 && c <= 5, [9, 15, 17, 27]],
  columnas: [(r, c) => (c === 2 || c === 5) && r >= 1 && r <= 6, [9, 15, 16, 27]],
  filas: [(r, c) => (r === 2 || r === 5) && c >= 1 && c <= 6, [9, 17, 19, 40]],
  damero: [(r, c) => r >= 2 && r <= 5 && c >= 1 && c <= 6 && (r + c) % 2 === 0, [11, 15, 20, 28]],
  corazon: [(r, c) => ['........', '..x..x..', '.xxxxxx.', '.xxxxxx.', '..xxxx..', '...xx...', '........', '........'][r][c] === 'x', [13, 17, 23, 31]],
  equis: [(r, c) => (r === c || r + c === 7) && r >= 1 && r <= 6, [13, 24, 24, 39]],
  abajo: [(r, c) => (r === 5 || r === 6) && c >= 1 && c <= 6, [13, 19, 22, 32]],
  medio: [(r, c) => r === 3 || r === 4, [15, 21, 30, 54]],
  anillo: [(r, c) => r >= 1 && r <= 6 && c >= 1 && c <= 6 && (r === 1 || r === 6 || c === 1 || c === 6), [15, 25, 26, 41]],
};
const ICE_KEYS = Object.keys(ICE);

const TIPS = {
  1: 'Deslizá una joya hacia una vecina para formar una fila de 3 iguales.',
  2: 'Combiná 4 en línea y creás una joya rayada: ¡limpia toda una fila o columna!',
  3: 'Hacé combinaciones encima de los cristales para romperlos.',
  4: 'Formá una L o una T con 5 joyas y aparece una bomba que explota alrededor.',
  5: '¡5 en línea crean un orbe arcoíris! Intercambialo con una joya para borrar todas las de ese color.',
  6: 'Probá intercambiar dos joyas especiales entre sí: ¡las combinaciones son enormes!',
};
const GENERIC_TIPS = [
  'Las cascadas multiplican tus puntos: buscá combinaciones abajo del tablero.',
  'Si te sobran movimientos, se convierten en joyas rayadas de bonus.',
  'Arcoíris + arcoíris limpia el tablero entero.',
  'Rayada + bomba limpia tres filas y tres columnas a la vez.',
  'Si no ves jugadas, esperá un ratito: una joya te va a mostrar una.',
  'Dos rayadas juntas hacen una cruz gigante.',
  'Los cristales dobles necesitan dos combinaciones encima.',
];

function grid(fn) { return Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => fn(r, c))); }
function shapeMask(name) { return grid((r, c) => SHAPES[name][r][c] === 'x'); }

// costo (q75) de juntar `count` joyas de 1 o 2 colores, y de llegar a un puntaje
const collectCost = (count, colors, types) => (types === 5 ? (colors === 1 ? 3 + 0.4 * count : 3 + 0.42 * count) : (colors === 1 ? 0.93 * count : 6 + 0.7 * count));
const collectFromCost = (cost, colors, types) => (types === 5 ? (colors === 1 ? (cost - 3) / 0.4 : (cost - 3) / 0.42) : (colors === 1 ? cost / 0.93 : (cost - 6) / 0.7));
const scoreFromCost = (cost, types) => (types === 5 ? (cost - 1.5) / 2.3 : (cost - 2.5) / 3.9) * 1000;
const ppm = types => (types === 5 ? 430 : 260); // puntos por jugada aproximados

/** Configuración del nivel n (1..∞). Siempre igual para el mismo n (cacheada). */
const cfgCache = new Map();
export function levelConfig(n) {
  n = Math.max(1, Math.floor(n));
  if (!cfgCache.has(n)) {
    // red de seguridad: si una jugadora distraída necesita más movidas que la fórmula, se las damos;
    // y si serían demasiadas, el nivel se suaviza (sin cristales dobles, con 5 colores y por último
    // con el tablero lleno)
    let cfg, fair;
    for (let ease = 0; ease <= 3; ease++) {
      cfg = baseConfig(n, ease);
      fair = fairMoves(cfg);
      if (fair <= SOFT_MAX_MOVES) break;
      if (ease === 0 && !cfg.ice.some(row => row.some(v => v > 1))) ease = 1; // sin cristales dobles: directo a 5 colores
    }
    cfg.moves = Math.max(cfg.moves, Math.min(MAX_MOVES, fair));
    cfgCache.set(n, cfg);
  }
  const c = cfgCache.get(n);
  return { ...c, stars: c.stars.slice() };
}

function baseConfig(n, ease = 0) {
  const R = mulberry32(n * 7919 + 1013);
  const pick = arr => arr[Math.floor(R() * arr.length)];
  const breather = n > 6 && n % 5 === 0;
  // margen sobre el costo: muy generoso al principio, se achica despacio (nunca baja de 1.15)
  const slack = (1.15 + 0.6 * Math.exp(-(n - 1) / 22)) * (breather ? 1.2 : 1);
  const hard = 1 - Math.exp(-Math.max(0, n - 6) / 40); // 0..1

  let shape = 'lleno', mask = grid(() => true);
  let iceGrid = grid(() => 0);
  let goals, moves, cost;
  let types = 5;

  const colorA = (n * 5 + 1) % 6, colorB = (colorA + 2 + (n % 3)) % 6;
  const fixColor = (t, avoid) => { t %= types; if (t === avoid) t = (t + 1) % types; return t; };

  if (n <= 6) {
    // primeros niveles: enseñan y son muy fáciles
    const E = {
      1: () => { goals = [{ kind: 'score', target: 1500 }]; moves = 20; cost = 5; },
      2: () => { goals = [{ kind: 'collect', type: 0, count: 15 }]; moves = 20; cost = 8; },
      3: () => { iceGrid = grid((r, c) => (ICE.centroChico[0](r, c) ? 1 : 0)); goals = [{ kind: 'ice' }]; moves = 22; cost = 7; },
      4: () => { goals = [{ kind: 'collect', type: 1, count: 16 }, { kind: 'collect', type: 2, count: 16 }]; moves = 22; cost = 10; },
      5: () => { goals = [{ kind: 'score', target: 4000 }]; moves = 22; cost = 11; },
      6: () => { iceGrid = grid((r, c) => (ICE.centro[0](r, c) ? 1 : 0)); goals = [{ kind: 'ice' }]; moves = 24; cost = 9; },
    };
    E[n]();
  } else {
    // ¿6 colores? cada vez más seguido
    types = R() < Math.min(0.8, 0.15 + hard * 0.9) ? 6 : 5;
    if (ease >= 2) types = 5;
    if (n >= 9 && (R() < 0.35 + hard * 0.4 || n % 4 === 0)) { shape = SHAPE_KEYS[(n * 3 + Math.floor(R() * 5)) % SHAPE_KEYS.length]; mask = shapeMask(shape); }
    if (ease >= 3) { shape = 'lleno'; mask = grid(() => true); }
    const cells = mask.flat().filter(Boolean).length;
    const sizeK = Math.sqrt(64 / cells);
    const kinds = ['collect', 'ice', 'score', 'collect2', 'ice', 'icecollect'];
    let kind = kinds[(n + Math.floor(R() * 3)) % kinds.length];
    if (n < 10 && kind === 'icecollect') kind = 'ice';
    const target = Math.round(19 + R() * 9); // movimientos deseados
    if (kind === 'score') {
      cost = target / slack;
      goals = [{ kind: 'score', target: Math.round(scoreFromCost(cost, types) / sizeK / 100) * 100 }];
    } else if (kind === 'collect' || kind === 'collect2') {
      const colors = kind === 'collect' ? 1 : 2;
      cost = target / slack;
      const count = Math.max(10, Math.round(collectFromCost(cost, colors, types) / sizeK));
      cost = collectCost(count, colors, types) * sizeK;
      const a = fixColor(colorA, -1);
      goals = [{ kind: 'collect', type: a, count }];
      if (colors === 2) goals.push({ kind: 'collect', type: fixColor(colorB, a), count });
    } else {
      // cristales: elegir patrón + capas que entren en un rango razonable de movimientos
      const twoLayers = n >= 12 && R() < Math.min(0.7, 0.2 + hard) && ease < 1;
      // cristales dobles + juntar joyas era demasiado largo (y chocaba con el tope de movidas): solo cristales
      if (twoLayers && kind === 'icecollect') kind = 'ice';
      // qué parte del patrón queda dentro de la forma del tablero
      const overlap = k => {
        let all = 0, inside = 0;
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (ICE[k][0](r, c)) { all++; if (mask[r][c]) inside++; }
        return { ratio: inside / all, inside };
      };
      const idx = (twoLayers ? 2 : 0) + (types === 6 ? 1 : 0);
      let opts = ICE_KEYS.filter(k => {
        const ov = overlap(k), cst = ICE[k][1][idx] * ov.ratio;
        return ov.ratio >= 0.75 && ov.inside >= 6 && cst * slack <= 30 && cst * slack >= 10;
      });
      if (!opts.length) opts = ICE_KEYS.filter(k => overlap(k).ratio >= 0.75 && overlap(k).inside >= 6);
      const pat = opts.length ? pick(opts) : 'medio';
      const ov = overlap(pat);
      const L = Math.max(6, ICE[pat][1][idx] * ov.ratio);
      iceGrid = grid((r, c) => (mask[r][c] && ICE[pat][0](r, c) ? (twoLayers ? 2 : 1) : 0));
      if (!iceGrid.flat().some(v => v > 0)) iceGrid = grid((r, c) => (mask[r][c] && (r === 3 || r === 4) ? 1 : 0));
      cost = L;
      goals = [{ kind: 'ice' }];
      if (kind === 'icecollect') {
        const count = Math.round(collectFromCost(Math.max(6, L * 0.6), 1, types));
        goals.push({ kind: 'collect', type: fixColor(colorB, -1), count: Math.max(10, count) });
        cost = L * 1.4;
      }
    }
    moves = Math.max(18, Math.min(30, Math.round(cost * slack)));
  }

  // umbrales de estrellas: 1 = ganar; 2 y 3 según puntaje esperado (incluye el bonus de movimientos sobrantes)
  const scoreGoal = goals.find(g => g.kind === 'score');
  const used = Math.min(moves, cost);
  const base = scoreGoal ? scoreGoal.target : used * ppm(types);
  const expect = base + Math.max(0, moves - used) * 380;
  const r100 = v => Math.round(v / 100) * 100;
  const t1 = scoreGoal ? scoreGoal.target : r100(base * 0.5);
  const t2 = Math.max(t1 + 300, r100(expect * 0.85));
  const t3 = Math.max(t2 + 300, r100(expect * 1.12));

  const tip = TIPS[n] || GENERIC_TIPS[n % GENERIC_TIPS.length];
  return { n, shape, mask, ice: iceGrid, types, moves, goals, stars: [t1, t2, t3], tip };
}

// ---------- Red de seguridad de dificultad ----------
// Juega partidas deterministas sin límite de movidas con una jugadora "distraída" (a veces busca el
// objetivo mirando solo la jugada inmediata, a veces hace lo primero que ve) y mide cuántas movidas
// necesita. Si el percentil 90 (con margen) supera lo que da la fórmula, el nivel recibe más movidas.
const MAX_MOVES = 36, SOFT_MAX_MOVES = 30;
function movesNeeded(cfg, seed) {
  const rnd = mulberry32(seed);
  const e = new Engine({ ...cfg, moves: 99 }, rnd);
  let used = 0;
  while (!e.goalsDone() && used < 70) {
    const ms = e.findMoves();
    let m = ms[Math.floor(rnd() * ms.length)];
    if (rnd() < 0.6) {
      const goalTypes = e.goalTypes();
      let best = -1;
      for (const x of ms) { const v = e.moveValue(x.a, x.b, goalTypes) + rnd(); if (v > best) { best = v; m = x; } }
    }
    e.play(m.a, m.b);
    used++;
  }
  return used;
}
function fairMoves(cfg, runs = 12) {
  const need = [];
  for (let i = 0; i < runs; i++) need.push(movesNeeded(cfg, cfg.n * 7907 + i * 131));
  need.sort((a, b) => a - b);
  const q = need[Math.round(0.9 * (runs - 1))];
  return Math.ceil(q * (cfg.n <= 10 ? 1.25 : 1.15));
}

// ---------- Calibración de estrellas ----------
// Simula partidas deterministas con jugadoras "virtuales" (la mitad distraídas, la mitad atentas al
// objetivo), siempre con las movidas BASE del nivel (los potenciadores no cambian los umbrales).
// Cada partida ganada corre el bonus final completo (movidas sobrantes -> rayadas -> detonación), así
// los umbrales quedan en la misma escala que el puntaje real. 2 estrellas ~ el 70% de las partidas
// ganadas, 3 estrellas ~ el 30%; entre 2 y 3 siempre hay al menos ~2 movidas sobrantes de diferencia.
// 1 estrella = cumplir el objetivo (t1 solo ubica la primera estrella en la barra de puntos).
const STAR_RUNS = 24, Q2 = 0.3, Q3 = 0.7;
const starCache = new Map();
function simWin(cfg, seed, greedy) {
  const rnd = mulberry32(seed);
  const e = new Engine(cfg, rnd);
  let guard = 0;
  while (e.moves > 0 && !e.goalsDone() && guard++ < 90) {
    const ms = e.findMoves();
    if (!ms.length) { e.shuffle(); continue; }
    let m = ms[Math.floor(rnd() * ms.length)];
    if (rnd() < greedy) {
      const gt = e.goalTypes();
      let best = -1;
      for (const x of ms) { const v = e.moveValue(x.a, x.b, gt) + rnd(); if (v > best) { best = v; m = x; } }
    }
    e.play(m.a, m.b);
  }
  if (!e.goalsDone()) return null;
  const left = e.moves, atGoal = e.score;
  while (e.bonusConvert());
  for (let k = 0; k < 4 && e.hasSpecials(); k++) e.bonusDetonate();
  return { left, atGoal, score: e.score };
}
export function calibrateStars(cfg, runs = STAR_RUNS) {
  if (starCache.has(cfg.n)) return starCache.get(cfg.n).slice();
  const wins = [];
  for (let i = 0; i < runs; i++) {
    const r = simWin(cfg, cfg.n * 101 + i, i % 2 ? 0.8 : 0.5);
    if (r) wins.push(r);
  }
  const r100 = v => Math.round(v / 100) * 100;
  const scoreGoal = cfg.goals.find(g => g.kind === 'score');
  let [t1, t2, t3] = cfg.stars;
  let perMove = 380;
  if (wins.length >= 4) {
    const leftTotal = wins.reduce((a, r) => a + r.left, 0);
    if (leftTotal > 0) perMove = wins.reduce((a, r) => a + (r.score - r.atGoal), 0) / leftTotal;
    const sc = wins.map(r => r.score).sort((a, b) => a - b);
    const q = p => sc[Math.round(p * (sc.length - 1))];
    t2 = r100(q(Q2));
    t3 = r100(q(Q3));
    if (!scoreGoal) {
      // la 1ª estrella de la barra cerca de donde suele quedar el puntaje al cumplir el objetivo
      const ag = wins.map(r => r.atGoal).sort((a, b) => a - b);
      t1 = Math.max(100, r100(ag[Math.floor(ag.length * 0.25)] * 0.8));
    }
  }
  if (scoreGoal) t1 = scoreGoal.target;
  t2 = Math.max(t2, t1 + 300);
  t3 = Math.max(t3, t2 + Math.max(400, r100(perMove * 2)));
  const res = [t1, t2, t3];
  starCache.set(cfg.n, res);
  return res.slice();
}
