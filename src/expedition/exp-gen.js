// Expedición: generador de mapas puro y determinista (DESIGN-CORE.md §2.5). Sin DOM ni three.js.
//   rng(seed) → () => [0,1) (mulberry32; .state es el entero serializable)
//   hashSeed(...parts) → entero de 32 bits estable
//   generateMap({ region, zone, kind, seed }) → { w, h, base, cells, objective }
import { EXP, REGIONS, TERRAIN, ringOf, MAT_IDS, HAZARD_IDS } from './exp-data.js';

/** mulberry32. El estado (entero) se puede leer y escribir con f.state para guardar y retomar. */
export function rng(seed) {
  let a = seed | 0;
  const f = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Object.defineProperty(f, 'state', { get: () => a | 0, set: (v) => { a = v | 0; } });
  return f;
}

/** FNV-1a de las partes unidas con '|': mismo texto, misma semilla en cualquier máquina. */
export function hashSeed(...parts) {
  const s = parts.map(p => String(p)).join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Elige una clave de {clave: peso} (pesos 0 nunca salen). */
export function weighted(r, table) {
  let total = 0;
  for (const k in table) total += Math.max(0, table[k]);
  let x = r() * total;
  for (const k in table) { const w = Math.max(0, table[k]); if (x < w) return k; x -= w; }
  return Object.keys(table).find(k => table[k] > 0);
}

export const depthOf = (kindCfg, x, y) => Math.abs(x - kindCfg.base[0]) + (kindCfg.base[1] - y);

/** Camino más barato (Dijkstra) por costo de terreno. cost(i) → costo de entrar a la casilla i (Infinity = no pasa). */
export function cheapestPath(w, h, from, to, cost) {
  const N = w * h, dist = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), done = new Array(N).fill(false);
  const s = from[1] * w + from[0], t = to[1] * w + to[0];
  dist[s] = 0;
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < N; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0 || u === t) break;
    done[u] = true;
    const ux = u % w, uy = (u / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = ux + dx, ny = uy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const v = ny * w + nx, c = cost(v);
      if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = u; }
    }
  }
  if (dist[t] === Infinity) return null;
  const path = [];
  for (let i = t; i >= 0 && i !== s; i = prev[i]) path.unshift(i);
  return { cost: dist[t], path };
}

export function generateMap({ region = 'bosque', zone = 1, kind = 'normal', seed = 1 } = {}) {
  const R = REGIONS[region] || REGIONS.bosque;
  const K = EXP.kinds[kind] || EXP.kinds.normal;
  const { w, h, base } = K;
  const r = rng(seed);
  const N = w * h;
  const depth = (i) => depthOf(K, i % w, (i / w) | 0);
  const bi = base[1] * w + base[0];

  // objetivo
  const objType = weighted(r, EXP.objectiveWeights);
  // a más zona, el objetivo puede quedar un poco más lejos (objDepthZone casillas por zona)
  const objMax = K.objDepth[1] + Math.floor((zone - 1) * (K.objDepthZone || 0));
  const objCands = [];
  for (let i = 0; i < N; i++) { const d = depth(i); if (d >= K.objDepth[0] && d <= objMax) objCands.push(i); }
  const objCell = objCands[Math.floor(r() * objCands.length)];

  // 1. terreno (re-tirado hasta 20 veces si el objetivo queda muy caro; después se allana el camino)
  let terrain;
  for (let tries = 0; tries <= 20; tries++) {
    terrain = [];
    for (let i = 0; i < N; i++) terrain.push(depth(i) <= 1 ? 'llano' : weighted(r, R.terrain));
    const p = cheapestPath(w, h, base, [objCell % w, (objCell / w) | 0], (v) => TERRAIN[terrain[v]].cost);
    if (p.cost <= K.validCost) break;
    if (tries === 20) for (const v of p.path) if (TERRAIN[terrain[v]].cost > 1) terrain[v] = 'llano';
  }

  // 2. lugares garantizados
  const content = new Array(N).fill(null);
  content[bi] = 'vacio';
  if (objType !== 'juntar') content[objCell] = 'objetivo';
  // 2b. barrera: un río (o un derrumbe largo) que cruza todo el mapa entre la base y el objetivo, con un solo vado.
  // Hace que casi toda salida tenga al menos una decisión con número, o un rodeo que se paga en pasos.
  const band = new Array(N).fill(false);
  if (R.barrier && K.barrier !== false && r() < R.barrier.chance) {
    const objY = (objCell / w) | 0;
    const lo = Math.max(objY + 1, kind === 'corta' ? 2 : 3), hi = kind === 'corta' ? 3 : 5;
    if (lo <= hi) {
      const by = lo + Math.floor(r() * (hi - lo + 1));
      const ford = Math.floor(r() * w);
      for (let x = 0; x < w; x++) {
        const i = by * w + x;
        if (content[i] !== null) continue;
        band[i] = true;
        content[i] = x === ford ? 'vacio' : 'peligro';
      }
    }
  }
  const freeAt = (lo, hi) => { const out = []; for (let i = 0; i < N; i++) if (content[i] === null && depth(i) >= lo && depth(i) <= hi) out.push(i); return out; };
  const put = (id, lo, hi) => { const c = freeAt(lo, hi); if (c.length) content[c[Math.floor(r() * c.length)]] = id; };
  if (kind === 'corta') { put('campamento', 2, 4); put('mirador', 2, 3); }
  else { put('campamento', 4, 6); put('mirador', 3, 6); }

  // 3. el resto con la tabla de la región y el anillo
  for (let i = 0; i < N; i++) {
    if (content[i] !== null) continue;
    const d = depth(i), ring = ringOf(d);
    const t = { ...R.content };
    const ph = t.peligro * EXP.ringHazard[ring], pr = t.ruina * EXP.ringRuin[ring];
    t.vacio = Math.max(0, t.vacio + (t.peligro - ph) + (t.ruina - pr));
    t.peligro = ph; t.ruina = pr;
    let c = weighted(r, t);
    if (d <= 1 && c !== 'recurso') c = 'vacio';
    content[i] = c;
  }

  const cells = [];
  for (let i = 0; i < N; i++) {
    const c = { terrain: terrain[i], content: content[i], sub: null, depth: depth(i) };
    if (band[i]) { c.band = R.barrier.hazard; if (R.barrier.hazard === 'rio') c.terrain = c.content === 'vacio' ? 'llano' : c.terrain; }
    if (c.content === 'recurso') c.sub = weighted(r, R.mats);
    else if (c.content === 'peligro') c.sub = band[i] ? R.barrier.hazard : weighted(r, R.hazards);
    else if (c.content === 'objetivo') c.sub = objType;
    cells.push(c);
  }

  // objetivo
  const objective = { type: objType };
  if (objType === 'juntar') {
    // uno de los materiales fuertes de la región (peso ≥ 30, o los más pesados si ninguno llega)
    const top = Math.min(30, Math.max(...Object.values(R.mats)));
    const strong = Object.fromEntries(Object.entries(R.mats).filter(([, w]) => w >= top));
    objective.mat = weighted(r, strong);
    objective.n = EXP.juntarBase[kind === 'corta' ? 'corta' : 'normal'] + Math.ceil(zone / 2);
    // que haya de dónde sacarlo: al menos ⌈n/2⌉ + 1 casillas de ese material (casillas vacías del medio y lo lejos)
    const want = Math.ceil(objective.n / 2) + 1;
    let have = cells.filter(c => c.content === 'recurso' && c.sub === objective.mat).length;
    const spots = cells.map((c, i) => i).filter(i => cells[i].content === 'vacio' && !cells[i].band && cells[i].depth >= 2 && i !== bi);
    while (have < want && spots.length) {
      const i = spots.splice(Math.floor(r() * spots.length), 1)[0];
      cells[i].content = 'recurso'; cells[i].sub = objective.mat; have++;
    }
  } else {
    objective.cell = [objCell % w, (objCell / w) | 0];
    objective.name = objType === 'aldea' ? 'la aldea perdida' : R.places[Math.floor(r() * R.places.length)];
    // zona aproximada (3×3 que contiene al objetivo): se ve desde el principio; "Pedir indicaciones" da la casilla exacta
    const ox = objective.cell[0] + Math.floor(r() * 3) - 1, oy = objective.cell[1] + Math.floor(r() * 3) - 1;
    objective.hint = [Math.max(1, Math.min(w - 2, ox)), Math.max(1, Math.min(h - 2, oy))];
    if (Math.abs(objective.hint[0] - objective.cell[0]) > 1) objective.hint[0] = objective.cell[0];
    if (Math.abs(objective.hint[1] - objective.cell[1]) > 1) objective.hint[1] = objective.cell[1];
  }
  return { w, h, base: base.slice(), cells, objective, region: R.id, zone, kind, seed };
}

export { MAT_IDS, HAZARD_IDS };
