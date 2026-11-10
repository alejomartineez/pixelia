// Generador del mapa de nodos de la Travesía (PLAN-FOTO §A1). Puro y con semilla: misma semilla, mismo mapa.
//   generateMap({ seed, island }) → { seed, island, rows, nodes: [{ id, row, col, n, type, enc, event, next: [id] }], start: [id], boss: id }
// Filas de 2 a 4 nodos unidas sin cruces (los caminos se bifurcan y se juntan), la primera fila es de peleas, la
// anterior al jefe es de campamentos y la última es el jefe solo. Todo camino tiene de 3 a 5 peleas (con el jefe).
import { VOY, ISLANDS, FIGHT_TYPES } from './voyage-data.js';

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pickWeighted(r, table) {
  const e = Object.entries(table).filter(([, w]) => w > 0);
  let x = r() * e.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of e) { x -= w; if (x < 0) return k; }
  return e[e.length - 1][0];
}
const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
export const isFight = (type) => FIGHT_TYPES.includes(type);

/** Mínimo y máximo de peleas desde cada nodo hasta el jefe (contándolo). */
export function fightRange(map) {
  const lo = [], hi = [];
  for (let i = map.nodes.length - 1; i >= 0; i--) {
    const n = map.nodes[i], f = isFight(n.type) ? 1 : 0;
    lo[i] = f + (n.next.length ? Math.min(...n.next.map(j => lo[j])) : 0);
    hi[i] = f + (n.next.length ? Math.max(...n.next.map(j => hi[j])) : 0);
  }
  return { lo, hi, min: Math.min(...map.start.map(i => lo[i])), max: Math.max(...map.start.map(i => hi[i])) };
}

export function generateMap({ seed = 1, island = 'bosque' } = {}) {
  const isl = ISLANDS[island] || ISLANDS.bosque;
  const r = rng((seed >>> 0) ^ 0x9e3779b9);
  const rows = int(r, VOY.rows[0], VOY.rows[1]);
  const nodes = [], byRow = [];
  for (let y = 0; y < rows; y++) {
    const n = y === rows - 1 ? 1 : int(r, VOY.width[0], VOY.width[1]);
    byRow.push([]);
    for (let c = 0; c < n; c++) { const id = nodes.length; nodes.push({ id, row: y, col: c, n, type: 'pelea', enc: null, event: null, next: [] }); byRow[y].push(id); }
  }
  // uniones sin cruces: se recorren las dos filas a la par, avanzando una, la otra o las dos
  for (let y = 0; y < rows - 1; y++) {
    const a = byRow[y], b = byRow[y + 1];
    let i = 0, j = 0;
    for (;;) {
      if (!nodes[a[i]].next.includes(b[j])) nodes[a[i]].next.push(b[j]);
      const ai = i < a.length - 1, bj = j < b.length - 1;
      if (!ai && !bj) break;
      if (ai && bj) { const k = r(); if (k < 0.45) { i++; j++; } else if (k < 0.725) i++; else j++; }
      else if (ai) i++; else j++;
    }
  }
  // tipos
  const last = rows - 1;
  for (const n of nodes) {
    if (n.row === last) n.type = 'jefe';
    else if (n.row === 0) n.type = 'pelea';
    else if (n.row === last - 1) n.type = 'campamento';
    else {
      const w = { ...VOY.weights };
      if (n.row < VOY.eliteFromRow) w.elite = 0;
      if (n.row === 1 || n.row === last - 2) w.campamento = 0;   // ni pegado a la salida ni al campamento del final
      n.type = pickWeighted(r, w);
    }
  }
  const map = { seed: seed >>> 0, island: isl.id, rows, nodes, start: byRow[0].slice(), boss: byRow[last][0] };
  // de 3 a 5 peleas por camino: se corrige el nodo que sobra o falta en el camino que se pasa
  const mid = (n) => n.row > 0 && n.row < last - 1;
  for (let guard = 0; guard < 60; guard++) {
    const fr = fightRange(map);
    if (fr.min >= VOY.fights[0] && fr.max <= VOY.fights[1]) break;
    const few = fr.min < VOY.fights[0];
    // se camina el camino extremo y se cambia uno de sus nodos del medio
    let cur = map.start.reduce((a, i) => (few ? fr.lo[i] < fr.lo[a] : fr.hi[i] > fr.hi[a]) ? i : a, map.start[0]);
    const path = [];
    while (cur != null) { path.push(cur); const nx = nodes[cur].next; cur = nx.length ? nx.reduce((a, i) => (few ? fr.lo[i] < fr.lo[a] : fr.hi[i] > fr.hi[a]) ? i : a, nx[0]) : null; }
    const cand = path.map(i => nodes[i]).filter(n => mid(n) && (few ? !isFight(n.type) : isFight(n.type)));
    if (!cand.length) break;
    cand[Math.floor(r() * cand.length)].type = few ? 'pelea' : 'evento';
  }
  // encuentros y eventos (los eventos no se repiten hasta agotar la lista)
  let evs = [];
  for (const n of nodes) {
    if (n.type === 'pelea') n.enc = pickWeighted(r, isl.fights);
    else if (n.type === 'elite') n.enc = pickWeighted(r, isl.elites);
    else if (n.type === 'jefe') n.enc = isl.boss;
    else if (n.type === 'evento') {
      if (!evs.length) evs = isl.events.slice();
      n.event = evs.splice(Math.floor(r() * evs.length), 1)[0];
    }
  }
  return map;
}
