// Joyas Reales — motor de reglas (sin DOM). Muta su propio tablero y devuelve "fases"
// que la escena anima en orden: swap, clear, fall, convert, shuffle.
//
// Gema: { id, type (0..5, 6 = arcoíris), special: null | 'h' | 'v' | 'bomb' | 'rainbow' }
//   'h' = rayada horizontal (limpia la fila), 'v' = rayada vertical (limpia la columna)

export const ROWS = 8, COLS = 8;
export const RAINBOW = 6;
const PTS_GEM = 20, PTS_ICE = 40, PTS_BONUS_MOVE = 150;
const SPECIAL_PTS = { h: 60, v: 60, bomb: 100, rainbow: 200 };

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const key = (r, c) => r * COLS + c;

export class Engine {
  /** cfg: { mask: bool[8][8], ice: int[8][8], types, moves, goals } */
  constructor(cfg, random = Math.random) {
    this.cfg = cfg;
    this.rand = random;
    this.mask = cfg.mask.map(r => r.slice());
    this.ice = cfg.ice.map((row, r) => row.map((v, c) => (this.mask[r][c] ? v : 0)));
    this.ntypes = cfg.types;
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.nextId = 1;
    this.score = 0;
    this.moves = cfg.moves;
    this.collected = Array(7).fill(0);
    this.iceTotal = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.ice[r][c] > 0) this.iceTotal++;
    this.iceLeft = this.iceTotal;
    this.fill();
  }

  active(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS && this.mask[r][c]; }
  gem(r, c) { return this.active(r, c) ? this.grid[r][c] : null; }
  newGem(type, special = null) { return { id: this.nextId++, type, special }; }
  randType() { return Math.floor(this.rand() * this.ntypes); }
  /** tipo "combinable" de una celda: -1 si vacía, hueco o arcoíris */
  tc(r, c) { const g = this.gem(r, c); return g && g.special !== 'rainbow' ? g.type : -1; }

  forEachActive(fn) { for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.mask[r][c]) fn(r, c); }

  // ---------- Relleno inicial ----------
  fill() {
    for (let tries = 0; tries < 200; tries++) {
      this.forEachActive((r, c) => {
        let t, guard = 0;
        do {
          t = this.randType();
          guard++;
        } while (guard < 30 && ((this.tc(r, c - 1) === t && this.tc(r, c - 2) === t) || (this.tc(r - 1, c) === t && this.tc(r - 2, c) === t)));
        this.grid[r][c] = this.newGem(t);
      });
      if (!this.findMatches().length && this.findMoves().length) return;
      this.forEachActive((r, c) => { this.grid[r][c] = null; });
    }
  }

  // ---------- Búsqueda de combinaciones ----------
  findMatches() {
    const runs = [];
    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        const t = this.tc(r, c);
        if (t < 0) { c++; continue; }
        let e = c + 1;
        while (e < COLS && this.tc(r, e) === t) e++;
        if (e - c >= 3) { const cells = []; for (let i = c; i < e; i++) cells.push([r, i]); runs.push({ dir: 'h', type: t, cells }); }
        c = e;
      }
    }
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS) {
        const t = this.tc(r, c);
        if (t < 0) { r++; continue; }
        let e = r + 1;
        while (e < ROWS && this.tc(e, c) === t) e++;
        if (e - r >= 3) { const cells = []; for (let i = r; i < e; i++) cells.push([i, c]); runs.push({ dir: 'v', type: t, cells }); }
        r = e;
      }
    }
    if (!runs.length) return [];
    // unir corridas que comparten celdas (L / T / cruces)
    const parent = runs.map((_, i) => i);
    const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const owner = new Map();
    runs.forEach((run, i) => run.cells.forEach(([r, c]) => {
      const k = key(r, c);
      if (owner.has(k)) parent[find(i)] = find(owner.get(k)); else owner.set(k, i);
    }));
    const groups = new Map();
    runs.forEach((run, i) => {
      const root = find(i);
      if (!groups.has(root)) groups.set(root, { type: run.type, runs: [], cells: new Map() });
      const g = groups.get(root);
      g.runs.push(run);
      run.cells.forEach(([r, c]) => g.cells.set(key(r, c), [r, c]));
    });
    return [...groups.values()].map(g => {
      const hs = g.runs.filter(x => x.dir === 'h'), vs = g.runs.filter(x => x.dir === 'v');
      let inter = null;
      if (hs.length && vs.length) {
        const hk = new Set(hs.flatMap(x => x.cells.map(([r, c]) => key(r, c))));
        for (const x of vs) for (const [r, c] of x.cells) if (hk.has(key(r, c))) { inter = [r, c]; break; }
      }
      const longest = g.runs.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
      return { type: g.type, cells: [...g.cells.values()], runs: g.runs, hasH: hs.length > 0, hasV: vs.length > 0, inter, longest, maxLen: longest.cells.length };
    });
  }

  static specialFor(g) {
    if (g.maxLen >= 5) return 'rainbow';
    if (g.hasH && g.hasV) return 'bomb';
    if (g.maxLen === 4) return g.longest.dir === 'h' ? 'v' : 'h';
    return null;
  }

  /** largo de combinación que se formaría en (r,c) (suma h+v si ≥3) */
  matchLenAt(r, c) {
    const t = this.tc(r, c);
    if (t < 0) return 0;
    let a = c, b = c; while (this.tc(r, a - 1) === t) a--; while (this.tc(r, b + 1) === t) b++;
    let u = r, d = r; while (this.tc(u - 1, c) === t) u--; while (this.tc(d + 1, c) === t) d++;
    const h = b - a + 1, v = d - u + 1;
    return (h >= 3 ? h : 0) + (v >= 3 ? v : 0);
  }

  isComboSwap(A, B) { return A.special === 'rainbow' || B.special === 'rainbow' || (A.special && B.special); }

  /** Lista de jugadas válidas [{a:[r,c], b:[r,c], score}] */
  findMoves() {
    const res = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const A = this.gem(r, c);
      if (!A) continue;
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = r + dr, c2 = c + dc;
        const B = this.gem(r2, c2);
        if (!B) continue;
        if (this.isComboSwap(A, B)) { res.push({ a: [r, c], b: [r2, c2], score: 12 }); continue; }
        this.grid[r][c] = B; this.grid[r2][c2] = A;
        const s = this.matchLenAt(r, c) + this.matchLenAt(r2, c2);
        this.grid[r][c] = A; this.grid[r2][c2] = B;
        if (s > 0) res.push({ a: [r, c], b: [r2, c2], score: s + (A.special || B.special ? 2 : 0) });
      }
    }
    return res;
  }
  bestMove() {
    const m = this.findMoves();
    if (!m.length) return null;
    const top = Math.max(...m.map(x => x.score));
    const best = m.filter(x => x.score === top);
    return best[Math.floor(this.rand() * best.length)];
  }

  // ---------- Jugada ----------
  /** a = celda arrastrada, b = destino. Devuelve {valid, phases} */
  play(a, b) {
    const [ar, ac] = a, [br, bc] = b;
    if (Math.abs(ar - br) + Math.abs(ac - bc) !== 1) return { valid: false, phases: [] };
    const A = this.gem(ar, ac), B = this.gem(br, bc);
    if (!A || !B || this.moves <= 0) return { valid: false, phases: [] };
    const phases = [];
    if (this.isComboSwap(A, B)) {
      this.grid[ar][ac] = B; this.grid[br][bc] = A;
      phases.push({ kind: 'swap', a, b, idA: A.id, idB: B.id });
      this.moves--;
      phases.push(this.comboPhase(A, B, a, b, phases));
      phases.push(this.gravity());
      this.cascade(phases, 1, null);
      return { valid: true, phases };
    }
    this.grid[ar][ac] = B; this.grid[br][bc] = A;
    if (!this.matchLenAt(ar, ac) && !this.matchLenAt(br, bc)) {
      this.grid[ar][ac] = A; this.grid[br][bc] = B;
      return { valid: false, phases: [{ kind: 'swap', a, b, idA: A.id, idB: B.id, back: true }] };
    }
    phases.push({ kind: 'swap', a, b, idA: A.id, idB: B.id });
    this.moves--;
    this.cascade(phases, 0, [b, a]);
    return { valid: true, phases };
  }

  /** resuelve combinaciones en cadena; agrega fases. */
  cascade(phases, combo, swapCells) {
    for (let guard = 0; guard < 60; guard++) {
      const groups = this.findMatches();
      if (!groups.length) break;
      combo++;
      phases.push(this.clearGroups(groups, combo, swapCells));
      swapCells = null;
      phases.push(this.gravity());
    }
    if (!this.findMoves().length) phases.push(this.shuffle());
    return combo;
  }

  newClearPhase(combo) { return { kind: 'clear', combo, cleared: [], blasts: [], created: [], ice: [], points: 0, at: null }; }

  clearGroups(groups, combo, swapCells) {
    const phase = this.newClearPhase(combo);
    const marks = [];
    const creates = [];
    let sumR = 0, sumC = 0, n = 0;
    for (const g of groups) {
      const sp = Engine.specialFor(g);
      let pos = null;
      if (sp) {
        if (swapCells) for (const p of swapCells) if (g.cells.some(([r, c]) => r === p[0] && c === p[1])) { pos = p; break; }
        if (!pos && sp === 'bomb') pos = g.inter;
        if (!pos) pos = g.longest.cells[Math.floor((g.longest.cells.length - 1) / 2)];
        creates.push({ r: pos[0], c: pos[1], type: sp === 'rainbow' ? RAINBOW : g.type, special: sp });
      }
      for (const [r, c] of g.cells) { marks.push({ r, c, delay: 0, merge: pos }); sumR += r; sumC += c; n++; }
    }
    phase.at = [sumR / n, sumC / n];
    this.runClear(marks, phase, new Set());
    for (const cr of creates) {
      const gem = this.newGem(cr.type, cr.special);
      this.grid[cr.r][cr.c] = gem;
      phase.created.push({ r: cr.r, c: cr.c, gem: { ...gem } });
      phase.points += SPECIAL_PTS[cr.special];
    }
    phase.points *= combo;
    this.score += phase.points;
    return this.snap(phase);
  }

  /** Limpia celdas marcadas, activando especiales en cadena. */
  runClear(marks, phase, noActivate) {
    const queue = marks.slice();
    const done = new Set();
    while (queue.length) {
      let bi = 0;
      for (let i = 1; i < queue.length; i++) if (queue[i].delay < queue[bi].delay) bi = i;
      const m = queue.splice(bi, 1)[0];
      if (!this.active(m.r, m.c)) continue;
      const k = key(m.r, m.c);
      if (done.has(k)) continue;
      done.add(k);
      if (this.ice[m.r][m.c] > 0) {
        this.ice[m.r][m.c]--;
        if (this.ice[m.r][m.c] === 0) this.iceLeft--;
        phase.ice.push({ r: m.r, c: m.c, level: this.ice[m.r][m.c], delay: m.delay });
        phase.points += PTS_ICE;
      }
      const g = this.grid[m.r][m.c];
      if (!g) continue;
      this.grid[m.r][m.c] = null;
      phase.cleared.push({ r: m.r, c: m.c, id: g.id, type: g.type, special: g.special, delay: m.delay, merge: m.merge || null });
      phase.points += PTS_GEM;
      if (g.special !== 'rainbow') this.collected[g.type]++;
      if (g.special && !noActivate.has(g.id)) this.activate(g, m.r, m.c, m.delay, queue, phase);
    }
  }

  activate(g, r, c, delay, queue, phase) {
    const add = (rr, cc, d) => { if (this.active(rr, cc)) queue.push({ r: rr, c: cc, delay: d }); };
    if (g.special === 'h') {
      phase.blasts.push({ kind: 'h', r, c, delay, type: g.type });
      for (let cc = 0; cc < COLS; cc++) add(r, cc, delay + Math.abs(cc - c) * 28);
    } else if (g.special === 'v') {
      phase.blasts.push({ kind: 'v', r, c, delay, type: g.type });
      for (let rr = 0; rr < ROWS; rr++) add(rr, c, delay + Math.abs(rr - r) * 28);
    } else if (g.special === 'bomb') {
      phase.blasts.push({ kind: 'bomb', r, c, delay, radius: 1, type: g.type });
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) add(r + dr, c + dc, delay + 60);
    } else if (g.special === 'rainbow') {
      const t = this.mostCommonType();
      const targets = this.cellsOfType(t);
      phase.blasts.push({ kind: 'rainbow', r, c, delay, type: t, targets });
      targets.forEach(([rr, cc], i) => add(rr, cc, delay + 160 + i * 18));
    }
  }

  mostCommonType() {
    const cnt = Array(7).fill(0);
    this.forEachActive((r, c) => { const t = this.tc(r, c); if (t >= 0) cnt[t]++; });
    let best = 0;
    for (let t = 1; t < 6; t++) if (cnt[t] > cnt[best]) best = t;
    return best;
  }
  cellsOfType(t) {
    const out = [];
    this.forEachActive((r, c) => { if (this.tc(r, c) === t) out.push([r, c]); });
    return out;
  }

  /** Intercambio de especiales (o arcoíris con cualquier joya). A quedó en b, B quedó en a. */
  comboPhase(A, B, a, b, phases) {
    const phase = this.newClearPhase(1);
    const noAct = new Set([A.id, B.id]);
    const marks = [];
    const [cr, cc] = b;
    phase.at = [cr, cc];
    const add = (r, c, d) => { if (this.active(r, c)) marks.push({ r, c, delay: d }); };
    const sA = A.special, sB = B.special;
    const isStripe = s => s === 'h' || s === 'v';
    if (sA === 'rainbow' && sB === 'rainbow') {
      phase.blasts.push({ kind: 'all', r: cr, c: cc, delay: 0 });
      this.forEachActive((r, c) => add(r, c, 80 + (Math.abs(r - cr) + Math.abs(c - cc)) * 45));
    } else if (sA === 'rainbow' || sB === 'rainbow') {
      const R = sA === 'rainbow' ? A : B, O = R === A ? B : A;
      const rPos = R === A ? b : a;
      const t = O.type;
      add(rPos[0], rPos[1], 0);
      if (!O.special) {
        const targets = this.cellsOfType(t);
        phase.blasts.push({ kind: 'rainbow', r: rPos[0], c: rPos[1], delay: 0, type: t, targets });
        targets.forEach(([r, c], i) => add(r, c, 160 + i * 22));
      } else {
        const targets = this.cellsOfType(t);
        const conv = targets.map(([r, c]) => {
          const g = this.grid[r][c];
          g.special = O.special === 'bomb' ? 'bomb' : (this.rand() < 0.5 ? 'h' : 'v');
          return { r, c, id: g.id, special: g.special };
        });
        phases.push({ kind: 'convert', from: rPos, cells: conv });
        noAct.delete(O.id);
        phase.blasts.push({ kind: 'rainbow', r: rPos[0], c: rPos[1], delay: 0, type: t, targets });
        targets.forEach(([r, c], i) => add(r, c, 120 + i * 70));
      }
    } else if (isStripe(sA) && isStripe(sB)) {
      phase.blasts.push({ kind: 'h', r: cr, c: cc, delay: 0, type: A.type }, { kind: 'v', r: cr, c: cc, delay: 0, type: B.type });
      for (let c = 0; c < COLS; c++) add(cr, c, Math.abs(c - cc) * 28);
      for (let r = 0; r < ROWS; r++) add(r, cc, Math.abs(r - cr) * 28);
    } else if (sA === 'bomb' && sB === 'bomb') {
      phase.blasts.push({ kind: 'bomb', r: cr, c: cc, delay: 0, radius: 2, type: A.type });
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) add(cr + dr, cc + dc, 40 + (Math.abs(dr) + Math.abs(dc)) * 30);
    } else {
      // rayada + bomba: 3 filas + 3 columnas
      const S = isStripe(sA) ? A : B;
      phase.blasts.push({ kind: 'big', r: cr, c: cc, delay: 0, type: S.type });
      for (let d = -1; d <= 1; d++) {
        for (let c = 0; c < COLS; c++) add(cr + d, c, 40 + Math.abs(c - cc) * 28);
        for (let r = 0; r < ROWS; r++) add(r, cc + d, 40 + Math.abs(r - cr) * 28);
      }
    }
    this.runClear(marks, phase, noAct);
    this.score += phase.points;
    return this.snap(phase);
  }

  // ---------- Gravedad ----------
  gravity() {
    const phase = { kind: 'fall', falls: [], spawns: [] };
    for (let c = 0; c < COLS; c++) {
      const rows = [];
      for (let r = 0; r < ROWS; r++) if (this.mask[r][c]) rows.push(r);
      if (!rows.length) continue;
      const present = [];
      for (const r of rows) if (this.grid[r][c]) present.push([r, this.grid[r][c]]);
      let gi = present.length - 1;
      const missing = rows.length - present.length;
      for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        if (gi >= 0) {
          const [or, g] = present[gi--];
          this.grid[r][c] = g;
          if (or !== r) phase.falls.push({ id: g.id, c, fromR: or, toR: r });
        } else {
          const g = this.newGem(this.randType());
          this.grid[r][c] = g;
          phase.spawns.push({ gem: { ...g }, c, fromR: rows[0] - (missing - i), toR: r });
        }
      }
    }
    return phase;
  }

  // ---------- Mezclar ----------
  shuffle() {
    const cells = [];
    this.forEachActive((r, c) => { if (this.grid[r][c]) cells.push([r, c]); });
    const gems = cells.map(([r, c]) => this.grid[r][c]);
    let ok = false;
    for (let tries = 0; tries < 300 && !ok; tries++) {
      for (let i = gems.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); [gems[i], gems[j]] = [gems[j], gems[i]]; }
      cells.forEach(([r, c], i) => { this.grid[r][c] = gems[i]; });
      ok = !this.findMatches().length && this.findMoves().length > 0;
    }
    if (!ok) {
      // último recurso: re-sortear colores de las joyas comunes
      for (let tries = 0; tries < 300 && !ok; tries++) {
        for (const [r, c] of cells) {
          const g = this.grid[r][c];
          if (g.special) continue;
          let guard = 0;
          do { g.type = this.randType(); guard++; } while (guard < 20 && ((this.tc(r, c - 1) === g.type && this.tc(r, c - 2) === g.type) || (this.tc(r - 1, c) === g.type && this.tc(r - 2, c) === g.type)));
        }
        ok = !this.findMatches().length && this.findMoves().length > 0;
      }
    }
    return { kind: 'shuffle', moves: cells.map(([r, c]) => ({ id: this.grid[r][c].id, type: this.grid[r][c].type, r, c })) };
  }

  /** guarda en la fase el estado de objetivos al terminarla (para animar el HUD de a poco) */
  snap(phase) {
    phase.snap = { score: this.score, collected: this.collected.slice(), iceLeft: this.iceLeft, moves: this.moves };
    return phase;
  }

  // ---------- Objetivos ----------
  /** progreso de un objetivo; s = snapshot opcional {score, collected, iceLeft} */
  goalProgress(g, s = this) {
    if (g.kind === 'score') return { have: Math.min(s.score, g.target), need: g.target, left: Math.max(0, g.target - s.score), done: s.score >= g.target };
    if (g.kind === 'collect') { const have = Math.min(s.collected[g.type], g.count); return { have, need: g.count, left: g.count - have, done: have >= g.count }; }
    if (g.kind === 'ice') { const have = this.iceTotal - s.iceLeft; return { have, need: this.iceTotal, left: s.iceLeft, done: s.iceLeft <= 0 }; }
    return { have: 0, need: 1, left: 1, done: false };
  }
  goalsDone() { return this.cfg.goals.every(g => this.goalProgress(g).done); }
  starsFor(score = this.score) {
    const [, t2, t3] = this.cfg.stars;
    return 1 + (score >= t2 ? 1 : 0) + (score >= t3 ? 1 : 0);
  }

  // ---------- Bonus final ----------
  /** convierte un movimiento sobrante en una rayada. Devuelve fase convert o null. */
  bonusConvert() {
    if (this.moves <= 0) return null;
    const cand = [];
    this.forEachActive((r, c) => { const g = this.grid[r][c]; if (g && !g.special) cand.push([r, c]); });
    this.moves--;
    this.score += PTS_BONUS_MOVE;
    if (!cand.length) return this.snap({ kind: 'convert', cells: [], bonus: true, points: PTS_BONUS_MOVE });
    const [r, c] = cand[Math.floor(this.rand() * cand.length)];
    const g = this.grid[r][c];
    g.special = this.rand() < 0.5 ? 'h' : 'v';
    return this.snap({ kind: 'convert', cells: [{ r, c, id: g.id, special: g.special }], bonus: true, points: PTS_BONUS_MOVE });
  }
  hasSpecials() {
    let any = false;
    this.forEachActive((r, c) => { if (this.grid[r][c]?.special) any = true; });
    return any;
  }
  /** detona todas las especiales del tablero (bonus). Devuelve fases. */
  bonusDetonate() {
    const phases = [];
    const phase = this.newClearPhase(1);
    const marks = [];
    let i = 0;
    this.forEachActive((r, c) => { if (this.grid[r][c]?.special) marks.push({ r, c, delay: (i++) * 55 }); });
    if (!marks.length) return phases;
    phase.at = [3.5, 3.5];
    this.runClear(marks, phase, new Set());
    this.score += phase.points;
    phases.push(this.snap(phase), this.gravity());
    this.cascade(phases, 1, null);
    return phases;
  }
}
