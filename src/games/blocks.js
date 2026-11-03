// Bloques Mágicos — puzzle de encastrar piezas en un tablero 8x8.
// Canvas pixelado (arte a baja resolución escalado sin suavizado) + barra DOM.
import { store } from '../core/state.js';
import { icon } from '../core/icons.js';
import {
  N, EMPTY, SHAPES, newGrid, idx, fits, canPlaceAnywhere, wouldComplete, findFullLines, clearLines,
  generateTray, linePoints, filledCount,
} from './blocks-logic.js';
import { COLORS, STAR_COLOR, BOARD_PAD, blockSprite, sparkleSprite, heartSprite, boardCanvas, trayCanvas } from './blocks-art.js';

const CELL = 12;                    // px de arte por celda del tablero
const FRAME = 6;                    // grosor del marco
const BOARD_ART = N * CELL + FRAME * 2;
const MAX_BOARD_CSS = 660;          // tope de tamaño en PC
const GRACE = 3;                    // jugadas sin limpiar antes de perder la racha
const CLEAN_BONUS = 500;            // tablero limpio
const CONTINUE_COST = 3;            // gemas para seguir
const TOUCH_LIFT = 64;              // px CSS que la pieza se dibuja por encima del dedo
const STYLE_ID = 'blocks-scene-style';

const CSS = `
.scene-blocks { overflow: hidden; touch-action: none; }
.scene-blocks .bk-canvas { position: absolute; left: 0; top: 0; display: block; image-rendering: pixelated; image-rendering: crisp-edges; touch-action: none; }
.scene-blocks .game-stat { min-width: 78px; }
.scene-blocks .game-stat b { font-variant-numeric: tabular-nums; }
.scene-blocks .bk-score.bump { animation: bk-bump .22s; }
.scene-blocks .bk-best b { color: var(--lilac-d); display: inline-flex; align-items: center; gap: 3px; }
.scene-blocks .bk-best.new { background: var(--gold-l); animation: bk-pulse 1s steps(2) infinite; }
.scene-blocks .bk-best.new b { color: var(--ink); }
.scene-blocks .bk-help-btn { font-size: 22px; font-weight: 700; }
.scene-blocks .bk-title { display: none; }
.scene-blocks .bk-streak { display: flex; flex-direction: column; align-items: center; padding: 2px 8px 3px; background: var(--pink-l); border: var(--line) solid var(--ink);
  border-radius: 12px; box-shadow: 0 3px 0 var(--ink); transition: transform .15s; }
.scene-blocks .bk-streak.off { visibility: hidden; }
.scene-blocks .bk-streak b { font-size: 17px; line-height: 1.1; display: flex; align-items: center; gap: 2px; }
.scene-blocks .bk-pips { display: flex; gap: 3px; margin-top: 1px; }
.scene-blocks .bk-pips i { display: block; width: 10px; height: 10px; background: #fff; border: 2px solid var(--ink); border-radius: 2px; }
.scene-blocks .bk-pips i.on { background: var(--pink-d); box-shadow: inset 2px 2px 0 var(--pink-l); }
.scene-blocks .bk-banner { position: absolute; left: 50%; transform: translate(-50%, -50%); z-index: 6; pointer-events: none; white-space: nowrap;
  font-size: 38px; font-weight: 700; color: #fff; letter-spacing: 1px;
  text-shadow: 3px 0 var(--ink), -3px 0 var(--ink), 0 3px var(--ink), 0 -3px var(--ink), 3px 3px var(--ink), -3px 3px var(--ink), 3px -3px var(--ink), -3px -3px var(--ink), 0 7px 0 var(--pink-d);
  animation: bk-banner 1.25s cubic-bezier(.2,.9,.3,1) forwards; }
.scene-blocks .bk-banner.gold { color: var(--gold); text-shadow: 3px 0 var(--ink), -3px 0 var(--ink), 0 3px var(--ink), 0 -3px var(--ink), 3px 3px var(--ink), -3px 3px var(--ink), 3px -3px var(--ink), -3px -3px var(--ink), 0 7px 0 var(--gold-d); }
.scene-blocks .bk-banner.sad { color: var(--lilac-l); text-shadow: 3px 0 var(--ink), -3px 0 var(--ink), 0 3px var(--ink), 0 -3px var(--ink), 3px 3px var(--ink), -3px 3px var(--ink), 3px -3px var(--ink), -3px -3px var(--ink), 0 7px 0 var(--lilac-d);
  animation-duration: 1.6s; }
.scene-blocks .bk-banner small { display: block; font-size: 18px; text-align: center; margin-top: 6px; color: #fff; letter-spacing: .5px;
  text-shadow: 2px 0 var(--ink), -2px 0 var(--ink), 0 2px var(--ink), 0 -2px var(--ink), 2px 2px var(--ink), -2px 2px var(--ink), 2px -2px var(--ink), -2px -2px var(--ink), 0 4px 0 var(--ink); }
.scene-blocks .bk-shake { animation: bk-shake .38s; }
@keyframes bk-banner { 0% { transform: translate(-50%, -50%) scale(.2); opacity: 0; } 14% { transform: translate(-50%, -50%) scale(1.18); opacity: 1; }
  24% { transform: translate(-50%, -50%) scale(1); } 78% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(-50%, -110%) scale(.95); opacity: 0; } }
@keyframes bk-shake { 20% { transform: translate(-5px, 2px); } 40% { transform: translate(5px, -2px); } 60% { transform: translate(-3px, 1px); } 80% { transform: translate(3px, 0); } }
@keyframes bk-bump { 45% { transform: scale(1.14); } }
@keyframes bk-pulse { 50% { transform: scale(1.06); } }
.scene-blocks .bk-goal { position: absolute; z-index: 5; width: min(290px, 78%); transform: translateX(-50%); pointer-events: none; }
.scene-blocks .bk-goal.hide { display: none; }
.scene-blocks .game-bar .bk-goal { position: relative; left: auto !important; top: auto !important; transform: none; width: 280px; margin: 0 6px; }
.scene-blocks .bk-goal-track { position: relative; height: 16px; margin: 0 12px 0 4px; border: var(--line) solid var(--ink); border-radius: 8px; background: #fff; box-shadow: 0 3px 0 var(--ink); }
.scene-blocks .bk-goal-track > i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 5px 0 0 5px; background: repeating-linear-gradient(90deg, var(--gold) 0 6px, var(--gold-d) 6px 8px); transition: width .35s steps(10); }
.scene-blocks .bk-goal-star { position: absolute; top: 50%; transform: translate(-50%, -50%); display: grid; }
.scene-blocks .bk-goal-star.pop { animation: bk-starpop .5s cubic-bezier(.3,1.8,.6,1); }
.scene-blocks .bk-goal small { display: block; text-align: center; font-size: 13px; font-weight: 700; margin-top: 7px; color: var(--ink);
  text-shadow: 2px 0 #fff, -2px 0 #fff, 0 2px #fff, 0 -2px #fff; }
.scene-blocks .game-bar .bk-goal small { margin-top: 4px; font-size: 12px; }
@keyframes bk-starpop { 40% { transform: translate(-50%, -50%) scale(1.6) rotate(15deg); } }
@media (min-width: 760px) { .scene-blocks .game-stat { min-width: 92px; } }
@media (min-width: 1100px) { .scene-blocks .bk-title { display: block; margin-left: 6px; } }
.bk-help { display: flex; flex-direction: column; gap: 10px; }
.bk-help-step { display: flex; align-items: center; gap: 12px; background: #fff; border: var(--line) solid var(--ink); border-radius: 12px; padding: 8px 10px; box-shadow: 0 3px 0 var(--ink); }
.bk-help-step .bk-help-ill { width: 64px; height: 48px; flex: none; display: grid; place-items: center; background: var(--panel-2); border-radius: 8px; }
.bk-help-step .bk-help-ill img { image-rendering: pixelated; image-rendering: crisp-edges; }
.bk-help-step p { margin: 0; font-size: 16px; line-height: 1.25; }
.bk-help-tip { text-align: center; font-size: 14px; color: var(--ink-l); margin: 2px 0 0; }
.bk-cont { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.bk-cont p { margin: 0; font-size: 17px; }
.bk-cont .bk-cont-ill { display: flex; gap: 10px; align-items: center; justify-content: center; }
.bk-cont .bk-cont-ill img { image-rendering: pixelated; }
.bk-cont .chip { font-size: 15px; }
`;

const STAR_SCORES = [400, 1200, 2500];
const STAR_AT = [1 / 3, 2 / 3, 1];
const starsFor = (s) => (s >= STAR_SCORES[2] ? 3 : s >= STAR_SCORES[1] ? 2 : s >= STAR_SCORES[0] ? 1 : 0);
function goalFraction(s) {
  let prev = 0;
  for (let i = 0; i < 3; i++) {
    if (s < STAR_SCORES[i]) return (i + (s - prev) / (STAR_SCORES[i] - prev)) / 3;
    prev = STAR_SCORES[i];
  }
  return 1;
}
const fmt = (n) => Math.round(n).toLocaleString('es-AR');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Imagen (dataURL) de una pieza, para la ayuda. */
function pieceImage(cells, color, cs, variant = 'n') {
  const w = Math.max(...cells.map(c => c[0])) + 1, h = Math.max(...cells.map(c => c[1])) + 1;
  const cv = document.createElement('canvas');
  cv.width = w * cs; cv.height = h * cs;
  const g = cv.getContext('2d');
  for (const [x, y] of cells) g.drawImage(blockSprite(color, cs, variant), x * cs, y * cs);
  return { url: cv.toDataURL(), w: cv.width, h: cv.height };
}

export default function create(ctx) {
  const { ui, audio } = ctx;

  let root = null, canvas = null, g = null;
  const els = {};
  let alive = false, raf = 0, lastT = 0;
  const timers = new Set();
  const offs = [];

  let L = null;          // layout
  let G = null;          // partida
  let dispScore = 0;
  let drag = null;       // pieza arrastrada
  const returning = [];  // piezas volviendo a la bandeja
  let busy = false;      // input bloqueado (sin lugar / fin)
  let stuckT = 0;
  let hoverSlot = -1;
  const trayIn = [0, 0, 0];  // momento en que apareció cada pieza de la bandeja
  const pops = [];       // destellos de celdas recién puestas {i, t0}
  const clears = [];     // bloques que se están limpiando {x, y, c, t0, spawned}
  const parts = [];      // partículas
  const deco = [];       // adornos del fondo

  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms);
    timers.add(id);
    return id;
  };
  const wait = (ms) => new Promise(r => later(r, ms));
  const listen = (target, ev, fn, opts) => { target.addEventListener(ev, fn, opts); offs.push(() => target.removeEventListener(ev, fn, opts)); };

  const bstate = () => {
    const s = ctx.state;
    if (!s.games.blocks) s.games.blocks = { best: 0 };
    return s.games.blocks;
  };

  // ---------------- Partida ----------------
  function newTray() {
    const d = Math.min(1, G.placed / 110);
    const ids = generateTray(G.grid, d);
    const cols = shuffle([0, 1, 2, 3, 4, 5]);
    return ids.map((shape, i) => ({ shape, color: cols[i] }));
  }

  function newGame() {
    G = {
      grid: newGrid(), spark: new Uint8Array(N * N), tray: [null, null, null],
      score: 0, lines: 0, streak: 0, grace: 0, placed: 0, continueUsed: false, over: false,
    };
    dispScore = 0;
    busy = false; stuckT = 0;
    clears.length = 0; pops.length = 0; returning.length = 0;
    G.tray = newTray();
    animateTrayIn();
    updateBar(true);
  }

  function loadSaved() {
    const sv = bstate().saved;
    if (!sv || !Array.isArray(sv.grid) || sv.grid.length !== N * N || !Array.isArray(sv.tray) || sv.tray.length !== 3) return false;
    if (!sv.tray.every(p => p === null || (p && SHAPES[p.shape] && COLORS[p.color]))) return false;
    G = {
      grid: Int8Array.from(sv.grid.map(v => (v >= 0 && v < COLORS.length ? v : EMPTY))),
      spark: Uint8Array.from(Array.isArray(sv.spark) && sv.spark.length === N * N ? sv.spark : new Array(N * N).fill(0)),
      tray: sv.tray.map(p => (p ? { shape: p.shape, color: p.color, star: !!p.star } : null)),
      score: sv.score | 0, lines: sv.lines | 0, streak: sv.streak | 0, grace: sv.grace | 0, placed: sv.placed | 0,
      continueUsed: !!sv.continueUsed, over: false,
    };
    if (G.tray.every(p => !p)) G.tray = newTray();
    dispScore = G.score;
    animateTrayIn();
    updateBar(true);
    return true;
  }

  function saveGame() {
    if (!G || G.over) return;
    const st = bstate();
    if (G.placed === 0) { if (st.saved) { delete st.saved; store.markDirty(); } return; }
    st.saved = {
      grid: Array.from(G.grid), spark: Array.from(G.spark), tray: G.tray.map(p => (p ? { ...p } : null)),
      score: G.score, lines: G.lines, streak: G.streak, grace: G.grace, placed: G.placed, continueUsed: G.continueUsed,
    };
    store.markDirty();
  }

  function animateTrayIn() {
    const now = performance.now();
    for (let i = 0; i < 3; i++) trayIn[i] = now + i * 80;
  }

  // ---------------- Layout ----------------
  function readSafe() {
    const pr = document.createElement('div');
    pr.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;top:0;left:0;padding-top:var(--safe-t);padding-bottom:var(--safe-b);';
    root.append(pr);
    const cs = getComputedStyle(pr);
    const t = parseFloat(cs.paddingTop) || 0, b = parseFloat(cs.paddingBottom) || 0;
    pr.remove();
    return { t, b };
  }

  function layout() {
    if (!root) return;
    const cw = root.clientWidth || innerWidth, ch = root.clientHeight || innerHeight;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const safe = readSafe();
    const topCss = safe.t + 68, botCss = safe.b + 14, sideCss = 10;
    const landscape = cw > ch * 1.08 && cw >= 600;
    const availW = cw - sideCss * 2, availH = ch - topCss - botCss;
    const TRAY_COL = 46, GAP = 10, TRAY_ROW_MIN = 46;
    let needW, needH;
    if (landscape) { needW = BOARD_ART + GAP + TRAY_COL; needH = BOARD_ART + 4; }
    else { needW = BOARD_ART + 2; needH = BOARD_ART + GAP + TRAY_ROW_MIN + 4; }
    let P = Math.min(availW / needW, availH / needH, MAX_BOARD_CSS / BOARD_ART);
    let k = Math.max(1, Math.floor(P * dpr));
    P = k / dpr;
    const W = Math.ceil(cw / P), H = Math.ceil(ch / P);
    canvas.width = W; canvas.height = H;
    canvas.style.width = (W * P) + 'px'; canvas.style.height = (H * P) + 'px';
    g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;

    const top = topCss / P, avH = availH / P;
    let bx, by, tray;
    if (landscape) {
      const groupW = BOARD_ART + GAP + TRAY_COL;
      bx = Math.round((W - groupW) / 2);
      by = Math.round(top + Math.max(0, (avH - BOARD_ART) / 2));
      const tx = bx + BOARD_ART + GAP, th = BOARD_ART;
      const slotH = Math.floor(th / 3);
      const slots = [0, 1, 2].map(i => ({ x: 0, y: i * slotH, w: TRAY_COL, h: i === 2 ? th - slotH * 2 : slotH }));
      tray = { x: tx, y: by, w: TRAY_COL, h: th, vertical: true, slots };
    } else {
      const trayW = Math.min(W - 4, BOARD_ART + 6);
      const free = avH - BOARD_ART - GAP;
      const trayH = Math.round(clamp(free, TRAY_ROW_MIN, 52));
      const groupH = BOARD_ART + GAP + trayH;
      bx = Math.round((W - BOARD_ART) / 2);
      by = Math.round(top + Math.max(0, (avH - groupH) / 2));
      const tx = Math.round((W - trayW) / 2), ty = by + BOARD_ART + GAP;
      const slotW = Math.floor(trayW / 3);
      const slots = [0, 1, 2].map(i => ({ x: i * slotW, y: 0, w: i === 2 ? trayW - slotW * 2 : slotW, h: trayH }));
      tray = { x: tx, y: ty, w: trayW, h: trayH, vertical: false, slots };
    }
    const minSlot = Math.min(...tray.slots.map(s => Math.min(s.w, s.h)));
    tray.cell = clamp(Math.floor((minSlot - 5) / 4), 5, 8);
    L = {
      P, W, H, landscape, bx, by, gx: bx + FRAME, gy: by + FRAME, tray,
      boardImg: boardCanvas(N, CELL, FRAME),
      trayImg: trayCanvas(tray.w, tray.h, tray.slots, tray.vertical),
    };
    // cuánto se levanta la pieza sobre el dedo: si abajo del tablero no hay lugar (celular apaisado),
    // se levanta menos para que la última fila siga siendo alcanzable con el dedo dentro de la pantalla
    L.lift = clamp(ch - (L.gy + N * CELL) * P - 12, 20, TOUCH_LIFT);
    placeGoal(cw, safe);
    // adornos de fondo
    deco.length = 0;
    const cols = ['#ffb3d6', '#d6c2ff', '#b9f0de', '#bfe4ff', '#ffe3a3'];
    for (let i = 0; i < 14; i++) {
      deco.push({ x: Math.random() * W, y: Math.random() * H, v: 2 + Math.random() * 4, ph: Math.random() * 6.28, heart: i % 3 === 0, col: cols[i % cols.length] });
    }
  }

  function placeGoal(cw, safe) {
    const el = els.goal;
    if (!el) return;
    const wide = cw >= 760;
    if (wide) {
      if (el.parentNode !== els.bar) els.bar.insertBefore(el, els.bar.querySelector('.spacer'));
      el.classList.remove('hide');
      return;
    }
    if (el.parentNode !== root) root.append(el);
    const barBottom = safe.t + 62;
    const boardTop = (L.by - BOARD_PAD) * L.P;
    const gap = boardTop - barBottom;
    el.classList.toggle('hide', gap < 50);
    el.style.left = ((L.bx + BOARD_ART / 2) * L.P) + 'px';
    el.style.top = (barBottom + Math.max(4, (gap - 44) / 2)) + 'px';
  }

  /** Tamaño de celda de una pieza en la bandeja (las de 5 se achican un poco si no entran). */
  function trayCellFor(i, piece) {
    const s = L.tray.slots[i], sh = SHAPES[piece.shape];
    return Math.max(4, Math.min(L.tray.cell, Math.floor((s.w - 5) / sh.w), Math.floor((s.h - 5) / sh.h)));
  }

  const slotCenter = (i) => {
    const s = L.tray.slots[i];
    return { x: L.tray.x + s.x + s.w / 2, y: L.tray.y + s.y + s.h / 2 - 1 };
  };

  function toArt(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / L.P, y: (e.clientY - r.top) / L.P };
  }
  function artToScreen(x, y) {
    const r = canvas.getBoundingClientRect();
    return { x: r.left + x * L.P, y: r.top + y * L.P };
  }

  function hitSlot(p) {
    const t = L.tray;
    // zona generosa: el slot + un margen
    const m = 6;
    if (p.x < t.x - m || p.x > t.x + t.w + m || p.y < t.y - m || p.y > t.y + t.h + m) return -1;
    let best = -1, bd = 1e9;
    for (let i = 0; i < 3; i++) {
      if (!G.tray[i]) continue;
      const c = slotCenter(i);
      const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // ---------------- Arrastre ----------------
  function dragTarget() {
    const sh = SHAPES[drag.piece.shape];
    const lift = drag.touch ? L.lift / L.P + (sh.h * CELL) / 2 : 0;
    return { x: drag.px, y: drag.py - lift };
  }

  function computeGhost() {
    const sh = SHAPES[drag.piece.shape];
    const t = dragTarget();
    const fx = (t.x - (sh.w * CELL) / 2 - L.gx) / CELL;
    const fy = (t.y - (sh.h * CELL) / 2 - L.gy) / CELL;
    const cands = [
      [Math.round(fx), Math.round(fy)], [Math.floor(fx), Math.floor(fy)], [Math.ceil(fx), Math.floor(fy)],
      [Math.floor(fx), Math.ceil(fy)], [Math.ceil(fx), Math.ceil(fy)],
    ];
    let best = null, bd = 0.9;
    for (const [x, y] of cands) {
      const d = (x - fx) ** 2 + (y - fy) ** 2;
      if (d < bd && fits(G.grid, sh, x, y)) { bd = d; best = { gx: x, gy: y }; }
    }
    if (best) {
      const r = wouldComplete(G.grid, sh, best.gx, best.gy);
      best.rows = r.rows; best.cols = r.cols;
      const set = new Set();
      for (const row of r.rows) for (let x = 0; x < N; x++) set.add(idx(x, row));
      for (const col of r.cols) for (let y = 0; y < N; y++) set.add(idx(col, y));
      best.hl = set;
      best.cells = new Set(sh.cells.map(([x, y]) => idx(best.gx + x, best.gy + y)));
    }
    const prev = drag.ghost;
    if (best && (!prev || prev.gx !== best.gx || prev.gy !== best.gy)) {
      if (best.hl.size) audio.sfx('select');
    }
    drag.ghost = best;
  }

  function onDown(e) {
    if (!G || busy || drag || G.over || !L) return;
    if (e.button !== undefined && e.button > 0) return;
    const p = toArt(e);
    const slot = hitSlot(p);
    if (slot < 0) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    const piece = G.tray[slot];
    const c = slotCenter(slot);
    // si estaba volviendo, cancelar esa animación
    for (let i = returning.length - 1; i >= 0; i--) if (returning[i].slot === slot) returning.splice(i, 1);
    const cs0 = trayCellFor(slot, piece);
    drag = { slot, piece, id: e.pointerId, touch: e.pointerType !== 'mouse', px: p.x, py: p.y, cx: c.x, cy: c.y, cs0, cs: cs0, t0: performance.now(), ghost: null };
    computeGhost();
    hoverSlot = -1;
    canvas.style.cursor = 'grabbing';
    audio.sfx('tap');
  }

  function onMove(e) {
    if (drag && e.pointerId === drag.id) {
      const p = toArt(e);
      drag.px = p.x; drag.py = p.y;
      computeGhost();
      return;
    }
    if (!drag && e.pointerType === 'mouse' && L && G) {
      const s = busy || G.over ? -1 : hitSlot(toArt(e));
      if (s !== hoverSlot) { hoverSlot = s; canvas.style.cursor = s >= 0 ? 'grab' : 'default'; }
    }
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    if (d.ghost && G.tray[d.slot] === d.piece) placePiece(d.slot, d.ghost.gx, d.ghost.gy);
    else sendBack(d);
    hoverSlot = e.pointerType === 'mouse' && G && !busy && !G.over ? hitSlot(toArt(e)) : -1;
    canvas.style.cursor = hoverSlot >= 0 ? 'grab' : 'default';
  }

  function onCancel(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag;
    drag = null;
    sendBack(d);
  }

  function sendBack(d) {
    const moved = Math.hypot(d.cx - slotCenter(d.slot).x, d.cy - slotCenter(d.slot).y);
    if (moved > 4) audio.sfx('swoosh');
    returning.push({ slot: d.slot, piece: d.piece, x0: d.cx, y0: d.cy, cs0: d.cs, t0: performance.now(), dur: 230 });
  }

  // ---------------- Jugadas ----------------
  function placePiece(slot, gx, gy) {
    const piece = G.tray[slot];
    const sh = SHAPES[piece.shape];
    const now = performance.now();
    for (const [x, y] of sh.cells) {
      const i = idx(gx + x, gy + y);
      G.grid[i] = piece.color;
      G.spark[i] = piece.star || Math.random() < 0.16 ? 1 : 0;
      pops.push({ i, t0: now });
    }
    G.tray[slot] = null;
    G.placed++;
    let gained = sh.cells.length;
    audio.sfx('place');

    const cx = L.gx + (gx + sh.w / 2) * CELL, cy = L.gy + (gy + sh.h / 2) * CELL;
    const { rows, cols } = findFullLines(G.grid);
    const n = rows.length + cols.length;
    if (n) {
      G.streak++;
      G.grace = GRACE;
      const combo = G.streak;
      gained += linePoints(n, combo);
      const cleared = clearLines(G.grid, rows, cols);
      const pcx = gx + sh.w / 2 - 0.5, pcy = gy + sh.h / 2 - 0.5;
      for (const c of cleared) {
        const i = idx(c.x, c.y);
        G.spark[i] = 0;
        const dist = Math.hypot(c.x - pcx, c.y - pcy);
        clears.push({ x: c.x, y: c.y, c: c.c, t0: now + 40 + dist * 26, spawned: false });
      }
      G.lines += n;
      audio.sfx('clear');
      if (n >= 2 || combo >= 2) later(() => audio.sfx('combo', n + combo), 140);
      if (navigator.vibrate) { try { navigator.vibrate(n >= 2 ? [12, 30, 12] : 12); } catch {} }
      const clean = filledCount(G.grid) === 0;
      if (combo >= 2) banner(`¡Combo x${combo}!`, n >= 2 ? `${n} líneas` : '', 'gold');
      else if (n >= 2) banner(['', '', '¡Doble!', '¡Triple!', '¡Increíble!'][Math.min(4, n)] || '¡Increíble!', `${n} líneas`);
      else if (Math.random() < 0.35) banner(['¡Bien!', '¡Lindo!', '¡Genial!', '¡Bravo!'][Math.floor(Math.random() * 4)]);
      if (n >= 2) shake();
      if (clean) {
        gained += CLEAN_BONUS;
        later(() => {
          banner('¡Tablero limpio!', `+${CLEAN_BONUS}`, 'gold');
          audio.sfx('star');
          ui.confetti(60);
        }, combo >= 2 || n >= 2 ? 900 : 350);
      }
    } else if (G.grace > 0) {
      G.grace--;
      if (G.grace === 0) G.streak = 0;
    }
    G.score += gained;
    // dentro del tablero: en los bordes el texto quedaba medio afuera / sobre el marco
    const sp = artToScreen(clamp(cx, L.gx + CELL * 1.5, L.gx + CELL * (N - 1.5)), Math.max(L.gy + CELL, cy - CELL));
    ui.floatText(sp.x, sp.y, `+${fmt(gained)}`, '');
    updateBar();

    if (G.tray.every(p => !p)) {
      G.tray = newTray();
      animateTrayIn();
      later(() => audio.sfx('pop'), 60);
    }
    saveGame();
    checkStuck();
  }

  function checkStuck() {
    const left = G.tray.filter(Boolean);
    if (!left.length) return;
    if (left.some(p => canPlaceAnywhere(G.grid, SHAPES[p.shape]))) return;
    busy = true;
    later(onStuck, 650);
  }

  async function onStuck() {
    stuckT = performance.now();
    audio.sfx('error');
    banner('¡Sin lugar!', 'Ninguna pieza entra', 'sad');
    shake();
    await wait(1700);
    // si hay otro modal abierto (ayuda, "¿volver?"), esperar a que se cierre para no apilarlos
    while (ui.hasModal()) await wait(300);
    if (!G || G.over) return;
    if (!G.continueUsed) {
      const yes = await offerContinue();
      if (!alive) return;
      if (yes) { doContinue(); return; }
    }
    await finish();
  }

  function offerContinue() {
    return new Promise(res => {
      let val = false;
      const gems = ctx.state.gems;
      const can = gems >= CONTINUE_COST;
      const st = pieceImage([[0, 0]], STAR_COLOR, 12, 's');
      const content = ui.h('div.bk-cont', {
        html: `<p>¡Te puedo hacer lugar!</p>
          <div class="bk-cont-ill">${icon('wand', 44)}
          <b>+</b><img src="${st.url}" width="36" height="36" alt=""><img src="${st.url}" width="36" height="36" alt=""><img src="${st.url}" width="36" height="36" alt=""></div>
          <p class="small muted">Limpio el centro del tablero y te doy 3 estrellitas de un bloque.</p>
          <span class="chip ${can ? 'sky' : ''}">Tenés ${icon('gem', 16)} ${fmt(gems)}</span>
          ${can ? '' : '<p class="small muted">Te faltan gemas. ¡Las ganás jugando y con misiones!</p>'}`,
      });
      ui.modal({
        title: '¿Seguir jugando?', icon: 'sparkle', content, closable: false, onClose: () => res(val),
        actions: [
          { label: 'Terminar', cls: 'ghost' },
          { html: `Seguir ${icon('gem', 20)} ${CONTINUE_COST}`, cls: 'mint', disabled: !can, onClick: () => { val = true; } },
        ],
      });
    });
  }

  function doContinue() {
    if (!store.spend({ gems: CONTINUE_COST }, 'blocks:continue')) { finish(); return; }
    audio.sfx('gem');
    G.continueUsed = true;
    stuckT = 0;
    // el área 3x3 central más cargada
    let best = { x: 2, y: 2, n: -1 };
    for (const y0 of [2, 3]) for (const x0 of [2, 3]) {
      let n = 0;
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (G.grid[idx(x0 + x, y0 + y)] !== EMPTY) n++;
      if (n > best.n) best = { x: x0, y: y0, n };
    }
    const now = performance.now();
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const i = idx(best.x + x, best.y + y);
      if (G.grid[i] !== EMPTY) clears.push({ x: best.x + x, y: best.y + y, c: G.grid[i], t0: now + (x + y) * 50, spawned: false });
      G.grid[i] = EMPTY; G.spark[i] = 0;
    }
    G.tray = [0, 1, 2].map(() => ({ shape: 'dot_0', color: STAR_COLOR, star: true }));
    animateTrayIn();
    audio.sfx('clear');
    banner('¡Seguimos!', '', 'gold');
    busy = false;
    updateBar();
    saveGame();
  }

  async function finish() {
    if (!G || G.over) return;
    G.over = true;
    busy = true;
    const score = G.score, lines = G.lines;
    const st = bstate();
    const newBest = score > (st.best || 0) && score > 0;
    if (newBest) st.best = score;
    delete st.saved;
    store.markDirty();
    if (lines > 0) store.inc('blocksLines', lines);
    const stars = starsFor(score);
    const choice = await ctx.endGame({
      game: 'blocks', score, stars, won: true,
      coins: Math.min(300, 5 + Math.floor(score / 25)),
      gems: newBest && score >= 1000 ? 1 : 0,
      xp: 10 + Math.floor(lines / 2),
      newBest,
      // el "¡Nuevo récord!" ya lo agrega endGame como línea: el título no lo repite
      title: stars >= 3 ? '¡Partidón!' : stars >= 2 ? '¡Qué partida!' : newBest ? '¡Te superaste!' : '¡Muy bien!',
      lines: [`${icon('sparkle', 18)} Líneas limpiadas: <b>${fmt(lines)}</b>`],
      againLabel: 'Otra partida',
    });
    if (choice === 'again' && alive) newGame();
  }

  // ---------------- Barra / textos ----------------
  function buildBar() {
    const bar = ui.h('div.game-bar');
    els.back = ui.h('button.icon-btn', { 'aria-label': 'Volver', html: icon('back', 24), onclick: onBack });
    els.title = ui.h('div.game-title.bk-title', {}, 'Bloques Mágicos');
    els.scoreBox = ui.h('div.game-stat.bk-score', { html: '<small>Puntos</small><b>0</b>' });
    els.score = els.scoreBox.querySelector('b');
    els.bestBox = ui.h('div.game-stat.bk-best', { html: `<small>Récord</small><b>${icon('crown', 16)}<span>0</span></b>` });
    els.best = els.bestBox.querySelector('span');
    els.streak = ui.h('div.bk-streak.off', { html: `<b>${icon('fire', 18)}<span>1</span></b><div class="bk-pips"><i></i><i></i><i></i></div>` });
    els.streakN = els.streak.querySelector('span');
    els.pips = [...els.streak.querySelectorAll('i')];
    els.help = ui.h('button.icon-btn.bk-help-btn', { 'aria-label': 'Ayuda', onclick: () => { audio.sfx('tap'); showHelp(false); } }, '?');
    bar.append(els.back, els.title, els.scoreBox, els.bestBox, ui.h('div.spacer'), els.streak, els.help);
    els.bar = bar;
    els.goal = ui.h('div.bk-goal', {
      html: `<div class="bk-goal-track"><i></i>${STAR_AT.map((p, i) => `<span class="bk-goal-star" style="left:${p * 100}%">${icon('starOff', 24)}</span>`).join('')}</div><small></small>`,
    });
    els.goalFill = els.goal.querySelector('.bk-goal-track > i');
    els.goalStars = [...els.goal.querySelectorAll('.bk-goal-star')];
    els.goalText = els.goal.querySelector('small');
    return bar;
  }

  let shownScore = -1, lastBestShown = -1, lastStreakKey = '';
  function updateBar(force = false) {
    if (!G) return;
    const best = bstate().best || 0;
    const shownBest = Math.max(best, G.score);
    if (force || shownBest !== lastBestShown) {
      lastBestShown = shownBest;
      els.best.textContent = fmt(shownBest);
      els.bestBox.classList.toggle('new', best > 0 && G.score > best);
    }
    const key = G.streak + ':' + G.grace;
    if (force || key !== lastStreakKey) {
      lastStreakKey = key;
      const on = G.streak >= 1;
      els.streak.classList.toggle('off', !on);
      els.streakN.textContent = 'x' + Math.max(1, G.streak);
      els.streak.title = 'Racha: limpiá antes de que se apaguen los cuadritos';
      els.pips.forEach((p, i) => p.classList.toggle('on', i < G.grace));
    }
    if (force) { dispScore = G.score; shownScore = -1; }
    updateGoal(force);
  }

  let goalStars = -1, goalFrac = -1;
  function updateGoal(force) {
    const st = starsFor(G.score);
    const fr = Math.round(goalFraction(G.score) * 200) / 200;
    if (force || fr !== goalFrac) { goalFrac = fr; els.goalFill.style.width = (fr * 100) + '%'; }
    if (force || st !== goalStars) {
      const gained = !force && goalStars >= 0 && st > goalStars;
      goalStars = st;
      els.goalStars.forEach((el, i) => {
        el.innerHTML = icon(i < st ? 'star' : 'starOff', 24);
        if (gained && i === st - 1) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
      });
      els.goalText.textContent = st >= 3 ? '¡Tres estrellas! ¡Sos una genia!' : `Próxima estrella: ${fmt(STAR_SCORES[st])} puntos`;
      if (gained) later(() => audio.sfx('star'), 250);
    }
  }

  function tickScore(dt) {
    if (!G) return;
    if (dispScore < G.score) {
      const step = Math.max(1, (G.score - dispScore) * Math.min(1, dt * 9));
      dispScore = Math.min(G.score, dispScore + step);
    } else dispScore = G.score;
    const v = Math.round(dispScore);
    if (v !== shownScore) {
      if (shownScore >= 0 && v > shownScore && !els.scoreBox.classList.contains('bump')) {
        els.scoreBox.classList.add('bump');
        later(() => els.scoreBox.classList.remove('bump'), 230);
      }
      shownScore = v;
      els.score.textContent = fmt(v);
    }
  }

  function banner(text, sub = '', cls = '') {
    if (!L) return;
    const el = ui.h('div.bk-banner' + (cls ? '.' + cls : ''), { html: ui.esc(text) + (sub ? `<small>${ui.esc(sub)}</small>` : '') });
    el.style.top = ((L.by + BOARD_ART * 0.45) * L.P) + 'px';
    el.style.left = ((L.bx + BOARD_ART / 2) * L.P) + 'px';
    root.querySelectorAll('.bk-banner').forEach(b => b.remove());
    root.append(el);
    later(() => el.remove(), cls === 'sad' ? 1650 : 1300);
  }

  function shake() {
    canvas.classList.remove('bk-shake');
    void canvas.offsetWidth;
    canvas.classList.add('bk-shake');
    later(() => canvas.classList.remove('bk-shake'), 400);
  }

  async function onBack() {
    audio.sfx('tap');
    if (drag) onCancel();
    if (!G || G.placed === 0 || G.over) { ctx.router.go('city'); return; }
    const ok = await ui.confirm('¿Volver a la ciudad?', 'Tu partida queda guardada para que sigas después.', 'Volver', 'Seguir jugando');
    if (ok && alive) { saveGame(); store.save(); ctx.router.go('city'); }
  }

  function showHelp(first) {
    const L4 = pieceImage(SHAPES.L4_0.cells, 0, 8);
    const row = pieceImage([0, 1, 2, 3, 4].map(x => [x, 0]), 2, 8);
    const sq = pieceImage(SHAPES.sq2_0.cells, 4, 8);
    const pc = ctx.state && matchMedia('(hover: hover) and (pointer: fine)').matches;
    const step = (ill, text) => `<div class="bk-help-step"><div class="bk-help-ill">${ill}</div><p>${text}</p></div>`;
    const img = (o, s = 2) => `<img src="${o.url}" width="${Math.min(60, o.w * s)}" height="${Math.round(Math.min(60, o.w * s) * o.h / o.w)}" alt="">`;
    const content = ui.h('div.bk-help', {
      html:
        step(img(L4, 2.2), `<b>${pc ? 'Agarrá con el mouse' : 'Arrastrá'}</b> una pieza de la bandeja y soltala en el tablero.`) +
        step(img(row, 1.5), 'Completá una <b>fila</b> o una <b>columna</b> entera y… ¡puf, se limpia!') +
        step(icon('fire', 36), 'Limpiá <b>varias juntas</b> o <b>seguidas</b> para hacer combos. La racha sigue si limpiás al menos una vez cada 3 piezas.') +
        step(img(sq, 2.5), 'Si ninguna pieza entra, termina la partida. ¡Pensá bien dónde va cada una!') +
        `<p class="bk-help-tip">Tu partida se guarda sola si salís.</p>`,
    });
    ui.modal({
      title: 'Bloques Mágicos', icon: 'sparkle', content, closable: !first,
      actions: [{ label: first ? '¡A jugar!' : 'Entendido', cls: 'pink' }],
      onClose: () => {
        if (first) { ctx.state.tutorial.blocks = true; store.markDirty(); }
      },
    });
  }

  // ---------------- Dibujo ----------------
  function drawPiece(piece, cx, cy, cs, variant, alpha = 1) {
    const sh = SHAPES[piece.shape];
    const x0 = Math.round(cx - (sh.w * cs) / 2), y0 = Math.round(cy - (sh.h * cs) / 2);
    const v = variant === 'n' && piece.star ? 's' : variant;
    const spr = blockSprite(piece.color, cs, v);
    if (alpha !== 1) g.globalAlpha = alpha;
    for (const [x, y] of sh.cells) g.drawImage(spr, x0 + x * cs, y0 + y * cs);
    if (alpha !== 1) g.globalAlpha = 1;
  }
  function drawShadow(piece, cx, cy, cs, off) {
    const sh = SHAPES[piece.shape];
    const x0 = Math.round(cx - (sh.w * cs) / 2), y0 = Math.round(cy - (sh.h * cs) / 2);
    g.fillStyle = 'rgba(59,35,64,0.22)';
    for (const [x, y] of sh.cells) g.fillRect(x0 + x * cs + off, y0 + y * cs + off + 1, cs, cs);
  }

  const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  function spawnParticles(c) {
    const col = COLORS[c.c] || COLORS[0];
    const px = L.gx + c.x * CELL + CELL / 2, py = L.gy + c.y * CELL + CELL / 2;
    const palette = [col.base, col.light, col.shine, '#ffffff'];
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 55;
      parts.push({ x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 35, life: 0, max: 0.45 + Math.random() * 0.4, col: palette[k % palette.length], s: Math.random() < 0.35 ? 2 : 1 });
    }
  }

  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (lastT || now)) / 1000);
    lastT = now;
    tickScore(dt);
    if (!L || !G) return;
    const { gx, gy } = L;
    g.clearRect(0, 0, L.W, L.H);

    // fondo: corazoncitos y destellos flotando
    for (const d of deco) {
      d.y -= d.v * dt;
      if (d.y < -10) { d.y = L.H + 8; d.x = Math.random() * L.W; }
      const x = Math.round(d.x + Math.sin(now / 1400 + d.ph) * 3), y = Math.round(d.y);
      g.globalAlpha = 0.55;
      if (d.heart) g.drawImage(heartSprite(d.col, d.col, '#ffffff'), x, y);
      else g.drawImage(sparkleSprite(Math.floor(now / 260 + d.ph * 3) % 4), x, y);
    }
    g.globalAlpha = 1;

    // tablero
    g.drawImage(L.boardImg, L.bx, L.by - BOARD_PAD);
    const ghost = drag?.ghost;
    const hl = ghost?.hl;
    const pulse = 0.28 + 0.18 * Math.sin(now / 90);
    const sweepRow = stuckT ? (now - stuckT) / 70 : -1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = idx(x, y);
      const c = G.grid[i];
      if (c === EMPTY) continue;
      const sx = gx + x * CELL, sy = gy + y * CELL;
      const gray = stuckT && y + x * 0.35 < sweepRow;
      const inHl = hl && hl.has(i);
      g.drawImage(blockSprite(inHl ? drag.piece.color : c, CELL, gray ? 'g' : 'n'), sx, sy);
      if (inHl) { g.globalAlpha = pulse; g.drawImage(blockSprite(0, CELL, 'w'), sx, sy); g.globalAlpha = 1; }
      if (G.spark[i] && !gray) {
        const ph = (now / 110 + i * 7.3) % 26;
        if (ph < 4) g.drawImage(sparkleSprite(Math.floor(ph)), sx + 1, sy + 1);
      }
    }
    // fantasma
    if (ghost) {
      const sh = SHAPES[drag.piece.shape];
      for (const [x, y] of sh.cells) {
        const i = idx(ghost.gx + x, ghost.gy + y);
        const sx = gx + (ghost.gx + x) * CELL, sy = gy + (ghost.gy + y) * CELL;
        g.globalAlpha = hl.has(i) ? 0.9 : 0.5;
        g.drawImage(blockSprite(drag.piece.color, CELL, drag.piece.star ? 's' : 'n'), sx, sy);
        if (hl.has(i)) { g.globalAlpha = pulse; g.drawImage(blockSprite(0, CELL, 'w'), sx, sy); }
      }
      g.globalAlpha = 1;
      // marco brillante en las líneas que se completan
      if (hl.size) {
        g.fillStyle = `rgba(255,255,255,${0.55 + 0.35 * Math.sin(now / 90)})`;
        for (const r of ghost.rows) { g.fillRect(gx - 1, gy + r * CELL - 1, N * CELL + 2, 1); g.fillRect(gx - 1, gy + (r + 1) * CELL, N * CELL + 2, 1); }
        for (const c of ghost.cols) { g.fillRect(gx + c * CELL - 1, gy - 1, 1, N * CELL + 2); g.fillRect(gx + (c + 1) * CELL, gy - 1, 1, N * CELL + 2); }
      }
    }
    // destello al apoyar
    for (let k = pops.length - 1; k >= 0; k--) {
      const p = pops[k];
      const a = 1 - (now - p.t0) / 200;
      if (a <= 0 || G.grid[p.i] === EMPTY) { pops.splice(k, 1); continue; }
      g.globalAlpha = a * 0.85;
      g.drawImage(blockSprite(0, CELL, 'w'), gx + (p.i % N) * CELL, gy + Math.floor(p.i / N) * CELL);
      g.globalAlpha = 1;
    }
    // bloques limpiándose
    for (let k = clears.length - 1; k >= 0; k--) {
      const c = clears[k];
      const el = now - c.t0;
      const sx = gx + c.x * CELL, sy = gy + c.y * CELL;
      if (el < 0) { g.drawImage(blockSprite(c.c, CELL, 'n'), sx, sy); continue; }
      if (!c.spawned) { c.spawned = true; spawnParticles(c); }
      if (el < 90) { g.drawImage(blockSprite(c.c, CELL, 'w'), sx, sy); continue; }
      const t = (el - 90) / 200;
      if (t >= 1) { clears.splice(k, 1); continue; }
      const s = Math.max(2, Math.round(CELL * (1 - t)));
      const o = Math.floor((CELL - s) / 2);
      g.drawImage(blockSprite(c.c, s, 'n'), sx + o, sy + o);
    }

    // bandeja
    g.drawImage(L.trayImg, L.tray.x, L.tray.y);
    for (let i = 0; i < 3; i++) {
      const p = G.tray[i];
      if (!p) continue;
      if (drag && drag.slot === i) continue;
      if (returning.some(r => r.slot === i)) continue;
      const c = slotCenter(i);
      const at = (now - trayIn[i]) / 280;
      if (at < 0) continue;
      const fit = canPlaceAnywhere(G.grid, SHAPES[p.shape]);
      const sc = at >= 1 ? 1 : Math.max(0.05, easeOutBack(at));
      const cs = Math.max(2, Math.round(trayCellFor(i, p) * sc));
      const bob = fit && !busy ? Math.round(Math.sin(now / 420 + i * 2.1) * 0.6) : 0;
      if (hoverSlot === i && fit && !busy) drawShadow(p, c.x, c.y + bob - 1, cs, 1);
      drawPiece(p, c.x, c.y + bob - (hoverSlot === i && fit && !busy ? 1 : 0), cs, fit ? 'n' : 'g', fit ? 1 : 0.85);
    }
    // piezas volviendo
    for (let k = returning.length - 1; k >= 0; k--) {
      const r = returning[k];
      let t = (now - r.t0) / r.dur;
      if (t >= 1 || !G.tray[r.slot]) { returning.splice(k, 1); continue; }
      t = 1 - Math.pow(1 - t, 3);
      const c = slotCenter(r.slot);
      const tc = trayCellFor(r.slot, r.piece);
      const cs = Math.round(r.cs0 + (tc - r.cs0) * t);
      drawPiece(r.piece, r.x0 + (c.x - r.x0) * t, r.y0 + (c.y - r.y0) * t, cs, 'n');
    }
    // pieza arrastrada
    if (drag) {
      const tg = dragTarget();
      const k = Math.min(1, dt * 28);
      drag.cx += (tg.x - drag.cx) * k; drag.cy += (tg.y - drag.cy) * k;
      const e = Math.min(1, (now - drag.t0) / 110);
      drag.cs = Math.round(drag.cs0 + (CELL - drag.cs0) * e);
      drawShadow(drag.piece, drag.cx, drag.cy, drag.cs, 3);
      drawPiece(drag.piece, drag.cx, drag.cy, drag.cs, 'n');
    }
    // partículas
    for (let k = parts.length - 1; k >= 0; k--) {
      const p = parts[k];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(k, 1); continue; }
      p.vy += 150 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.spark) { g.drawImage(sparkleSprite(Math.min(3, Math.floor((p.life / p.max) * 4))), Math.round(p.x - 3), Math.round(p.y - 3)); continue; }
      g.globalAlpha = p.life > p.max * 0.6 ? 0.6 : 1;
      g.fillStyle = p.col;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
      g.globalAlpha = 1;
    }
  }

  // ---------------- Ciclo de vida ----------------
  function onKey(e) {
    if (e.key !== 'Escape') return;
    if (drag) { onCancel(); return; }
    if (ui.hasModal()) return;
    onBack();
  }

  return {
    hud: false,
    music: 'game',
    async mount(container) {
      alive = true;
      root = container;
      if (!document.getElementById(STYLE_ID)) {
        const st = document.createElement('style');
        st.id = STYLE_ID; st.textContent = CSS;
        document.head.append(st);
      }
      root.append(ui.h('div.game-bg.pattern'));
      canvas = ui.h('canvas.bk-canvas.pixel-canvas');
      root.append(canvas);
      root.append(buildBar());
      layout();

      listen(canvas, 'pointerdown', onDown);
      listen(canvas, 'pointermove', onMove);
      listen(canvas, 'pointerup', onUp);
      listen(canvas, 'pointercancel', onCancel);
      listen(canvas, 'lostpointercapture', onCancel);
      listen(canvas, 'pointerleave', () => { if (!drag && hoverSlot >= 0) { hoverSlot = -1; canvas.style.cursor = 'default'; } });
      listen(canvas, 'contextmenu', e => e.preventDefault());
      let rzT = 0;
      const onResize = () => { clearTimeout(rzT); rzT = setTimeout(() => { if (!alive) return; if (drag) onCancel(); layout(); }, 80); };
      listen(window, 'resize', onResize);
      listen(window, 'orientationchange', onResize);
      offs.push(() => clearTimeout(rzT));
      listen(document, 'keydown', onKey);
      listen(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') saveGame(); });

      // acceso de depuración para pruebas automáticas
      root.__blocks = { get G() { return G; }, get L() { return L; }, place: (slot, x, y) => placePiece(slot, x, y), check: () => checkStuck() };
      const resumed = loadSaved();
      if (!resumed) newGame();
      raf = requestAnimationFrame(frame);
      if (resumed) {
        later(() => ui.toast('¡Seguimos tu partida!', { icon: 'sparkle', type: 'good' }), 350);
        later(checkStuck, 500);
      }
      if (!ctx.state.tutorial.blocks) later(() => showHelp(true), 300);
    },
    unmount() {
      if (G && !G.over) saveGame();
      alive = false;
      cancelAnimationFrame(raf);
      for (const id of timers) clearTimeout(id);
      timers.clear();
      offs.forEach(f => f());
      offs.length = 0;
      document.getElementById(STYLE_ID)?.remove();
      root?.querySelectorAll('.bk-banner').forEach(b => b.remove());
      if (canvas) { canvas.width = 0; canvas.height = 0; }
      drag = null; G = null; L = null; root = null; canvas = null; g = null;
      parts.length = 0; clears.length = 0; pops.length = 0; returning.length = 0; deco.length = 0;
    },
  };
}
