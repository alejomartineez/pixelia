// Bloques Mágicos — lógica pura del tablero (sin DOM): formas, encastre, líneas y generación de piezas.

export const N = 8;              // tablero N x N
export const EMPTY = -1;

// Formas por familia. Cada string: filas separadas por '/', '#' = bloque.
// easy/hard: peso al principio de la partida y cuando ya avanzó (se interpola).
const FAMILY_DEFS = [
  { fam: 'dot',     easy: 2.4, hard: 0.7, forms: ['#'] },
  { fam: 'line2',   easy: 4.0, hard: 1.8, forms: ['##', '#/#'] },
  { fam: 'line3',   easy: 4.0, hard: 2.6, forms: ['###', '#/#/#'] },
  { fam: 'line4',   easy: 2.0, hard: 2.8, forms: ['####', '#/#/#/#'] },
  { fam: 'line5',   easy: 0.7, hard: 2.2, forms: ['#####', '#/#/#/#/#'] },
  { fam: 'sq2',     easy: 4.0, hard: 2.8, forms: ['##/##'] },
  { fam: 'sq3',     easy: 0.45, hard: 1.6, forms: ['###/###/###'] },
  { fam: 'corner3', easy: 4.0, hard: 2.4, forms: ['##/#.', '##/.#', '#./##', '.#/##'] },
  { fam: 'L4',      easy: 2.0, hard: 3.0, forms: ['#./#./##', '.#/.#/##', '##/#./#.', '##/.#/.#', '###/#..', '###/..#', '#../###', '..#/###'] },
  { fam: 'corner5', easy: 0.5, hard: 2.0, forms: ['###/#../#..', '###/..#/..#', '#../#../###', '..#/..#/###'] },
  { fam: 'T',       easy: 1.2, hard: 2.4, forms: ['###/.#.', '.#./###', '#./##/#.', '.#/##/.#'] },
  { fam: 'SZ',      easy: 0.7, hard: 2.3, forms: ['##./.##', '.##/##.', '#./##/.#', '.#/##/#.'] },
  { fam: 'rect23',  easy: 0.6, hard: 1.5, forms: ['##/##/##', '###/###'] },
];

/** SHAPES[id] = { id, fam, cells:[[x,y]], w, h } */
export const SHAPES = {};
export const FAMILIES = FAMILY_DEFS.map(f => {
  const ids = f.forms.map((form, i) => {
    const rows = form.split('/');
    const cells = [];
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') cells.push([x, y]); }));
    const id = f.fam + '_' + i;
    SHAPES[id] = { id, fam: f.fam, cells, w: Math.max(...rows.map(r => r.length)), h: rows.length };
    return id;
  });
  return { fam: f.fam, easy: f.easy, hard: f.hard, ids };
});
export const SHAPE_IDS = Object.keys(SHAPES);

export function newGrid() { return new Int8Array(N * N).fill(EMPTY); }
export const idx = (x, y) => y * N + x;

export function fits(grid, shape, gx, gy) {
  if (gx < 0 || gy < 0 || gx + shape.w > N || gy + shape.h > N) return false;
  for (const [x, y] of shape.cells) if (grid[idx(gx + x, gy + y)] !== EMPTY) return false;
  return true;
}

export function canPlaceAnywhere(grid, shape) {
  for (let gy = 0; gy <= N - shape.h; gy++) for (let gx = 0; gx <= N - shape.w; gx++) if (fits(grid, shape, gx, gy)) return true;
  return false;
}

/** Filas y columnas que quedarían completas si se coloca la forma en (gx,gy). No modifica grid. */
export function wouldComplete(grid, shape, gx, gy) {
  const add = new Set(shape.cells.map(([x, y]) => idx(gx + x, gy + y)));
  const filled = (i) => grid[i] !== EMPTY || add.has(i);
  const rows = [], cols = [];
  const rowSet = new Set(shape.cells.map(([, y]) => gy + y));
  const colSet = new Set(shape.cells.map(([x]) => gx + x));
  for (const r of rowSet) { let ok = true; for (let x = 0; x < N && ok; x++) ok = filled(idx(x, r)); if (ok) rows.push(r); }
  for (const c of colSet) { let ok = true; for (let y = 0; y < N && ok; y++) ok = filled(idx(c, y)); if (ok) cols.push(c); }
  return { rows, cols };
}

export function completesSomewhere(grid, shape) {
  for (let gy = 0; gy <= N - shape.h; gy++) for (let gx = 0; gx <= N - shape.w; gx++) {
    if (!fits(grid, shape, gx, gy)) continue;
    const r = wouldComplete(grid, shape, gx, gy);
    if (r.rows.length || r.cols.length) return true;
  }
  return false;
}

export function findFullLines(grid) {
  const rows = [], cols = [];
  for (let y = 0; y < N; y++) { let ok = true; for (let x = 0; x < N && ok; x++) ok = grid[idx(x, y)] !== EMPTY; if (ok) rows.push(y); }
  for (let x = 0; x < N; x++) { let ok = true; for (let y = 0; y < N && ok; y++) ok = grid[idx(x, y)] !== EMPTY; if (ok) cols.push(x); }
  return { rows, cols };
}

/** Vacía filas/columnas. Devuelve las celdas limpiadas [{x,y,c}] (sin repetir). */
export function clearLines(grid, rows, cols) {
  const out = [];
  const seen = new Set();
  const take = (x, y) => {
    const i = idx(x, y);
    if (seen.has(i)) return;
    seen.add(i);
    if (grid[i] !== EMPTY) out.push({ x, y, c: grid[i] });
  };
  for (const r of rows) for (let x = 0; x < N; x++) take(x, r);
  for (const c of cols) for (let y = 0; y < N; y++) take(c, y);
  for (const i of seen) grid[i] = EMPTY;
  return out;
}

export function filledCount(grid) { let n = 0; for (let i = 0; i < grid.length; i++) if (grid[i] !== EMPTY) n++; return n; }

// ---------- Generación con sesgo amigable ----------
function weightOf(f, d) { return f.easy * (1 - d) + f.hard * d; }

function pickShape(d, rng, allow) {
  const fams = [];
  let total = 0;
  for (const f of FAMILIES) {
    const ids = allow ? f.ids.filter(allow) : f.ids;
    if (!ids.length) continue;
    const w = weightOf(f, d);
    fams.push({ w, ids });
    total += w;
  }
  if (!fams.length) return null;
  let r = rng() * total;
  for (const f of fams) { r -= f.w; if (r <= 0) return f.ids[Math.floor(rng() * f.ids.length)]; }
  const last = fams[fams.length - 1];
  return last.ids[Math.floor(rng() * last.ids.length)];
}

/**
 * ¿Se pueden colocar todas las piezas (en algún orden, limpiando líneas entre medio)?
 * Búsqueda en profundidad con presupuesto de nodos compartido ({left}): si se agota, responde false (conservador).
 */
export function solvable(grid, ids, budget = { left: 1500 }) {
  const g = Int8Array.from(grid);
  function rec(left) {
    if (!left.length) return true;
    for (let k = 0; k < left.length; k++) {
      if (left.indexOf(left[k]) !== k) continue; // misma forma ya probada
      const sh = SHAPES[left[k]];
      const rest = left.filter((_, j) => j !== k);
      for (let gy = 0; gy <= N - sh.h; gy++) for (let gx = 0; gx <= N - sh.w; gx++) {
        if (!fits(g, sh, gx, gy)) continue;
        if (--budget.left < 0) return false;
        if (rest.length === 0) return true;
        const { rows, cols } = wouldComplete(g, sh, gx, gy);
        let ok;
        if (rows.length || cols.length) {
          const snap = Int8Array.from(g);
          for (const [x, y] of sh.cells) g[idx(gx + x, gy + y)] = 0;
          clearLines(g, rows, cols);
          ok = rec(rest);
          g.set(snap);
        } else {
          for (const [x, y] of sh.cells) g[idx(gx + x, gy + y)] = 0;
          ok = rec(rest);
          for (const [x, y] of sh.cells) g[idx(gx + x, gy + y)] = EMPTY;
        }
        if (ok) return true;
        if (budget.left < 0) return false;
      }
    }
    return false;
  }
  return rec(ids);
}

/**
 * Tres piezas nuevas. d = dificultad 0..1.
 * Amable: busca primero una bandeja que se pueda colocar entera (en algún orden); si no encuentra,
 * garantiza que al menos una entre (siempre posible: un bloque suelto entra en cualquier tablero no lleno)
 * y, con el tablero cargado, a veces regala una pieza que completa una línea.
 */
export function generateTray(grid, d, rng = Math.random) {
  let tray = null;
  const budget = { left: 4000 }; // tope total de búsqueda (unos pocos ms en el peor caso)
  for (let attempt = 0; attempt < 40; attempt++) {
    const t = [pickShape(d, rng), pickShape(d, rng), pickShape(d, rng)];
    const fams = new Set(t.map(id => SHAPES[id].fam));
    if (fams.size === 1 && attempt < 35) continue; // evitar tres iguales
    if (attempt < 24 && budget.left > 0 ? solvable(grid, t, budget) : t.some(id => canPlaceAnywhere(grid, SHAPES[id]))) { tray = t; break; }
  }
  if (!tray) {
    tray = [pickShape(d, rng), pickShape(d, rng), pickShape(d, rng)];
    const ok = pickShape(d, rng, id => canPlaceAnywhere(grid, SHAPES[id]));
    if (ok) tray[Math.floor(rng() * 3)] = ok;
  }
  // Ayudita: con el tablero cargado, una pieza que complete una línea.
  const fill = filledCount(grid) / (N * N);
  const helpChance = fill > 0.4 ? 0.35 + (fill - 0.4) * 1.2 : (fill > 0.2 ? 0.2 : 0);
  if (rng() < helpChance && !tray.some(id => completesSomewhere(grid, SHAPES[id]))) {
    const helper = pickShape(d * 0.5, rng, id => completesSomewhere(grid, SHAPES[id]));
    if (helper) {
      // reemplazar preferentemente una pieza que no entra
      let k = tray.findIndex(id => !canPlaceAnywhere(grid, SHAPES[id]));
      if (k < 0) k = Math.floor(rng() * 3);
      tray[k] = helper;
    }
  }
  return tray;
}

/** Puntos por limpiar n líneas con multiplicador de combo. */
export function linePoints(n, combo) { return n * 10 * n * Math.max(1, combo); }
