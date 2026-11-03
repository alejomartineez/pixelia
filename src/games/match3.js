// Joyas Reales — juego de combinar 3 (escena 'match3').
// Tablero 8x8 en canvas de baja resolución escalado pixelado (escala entera en pixeles del dispositivo).
// Motor de reglas en match3-engine.js, niveles en match3-levels.js, sprites en match3-sprites.js.
import { icon } from '../core/icons.js';
import { Engine, ROWS, COLS, RAINBOW } from './match3-engine.js';
import { levelConfig, calibrateStars, GEM_NAMES } from './match3-levels.js';
import { sprites, gemSprite, buildBoard, gemIconUrl, CELL, MARGIN, ART, GEMS } from './match3-sprites.js';
import { M3_CSS } from './match3-style.js';
import { boosterRow, consumeSelected, eventChipHtml, itemCount, boosterIcon } from './boosters.js';

const BOOSTERS = ['m3_moves', 'm3_bomb'];
const EXTRA_MOVES = 5, BOMBS = 2;

const COMBO_TEXT = ['', '', '¡Genial!', '¡Divino!', '¡Increíble!'];
const HINT_DELAY = 5000;
const fmt = n => Math.round(n).toLocaleString('es-AR');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOutBack = t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; };
const easeOut = t => 1 - (1 - t) ** 3;
function fallEase(t) {
  if (t < 0.7) { const k = t / 0.7; return k * k; }
  const k = (t - 0.7) / 0.3;
  return 1 - Math.sin(k * Math.PI) * 0.1 * (1 - k * 0.4);
}

export default function create(ctx) {
  const { store, ui, audio } = ctx;
  const m3state = () => {
    const g = store.state.games;
    if (!g.match3) g.match3 = { level: 1, stars: {} };
    if (!g.match3.stars) g.match3.stars = {};
    if (!g.match3.level) g.match3.level = 1;
    return g.match3;
  };

  // ---------- estado de la escena ----------
  let alive = true;
  let root, styleEl, bar, stage, wrap, canvas, g, fxLayer, preEl, helpEl, footEl, plaque;
  let raf = 0, lastNow = 0, T = 0;
  let mode = 'menu';          // 'menu' | 'play' | 'end'
  let busy = false;
  let level = 1, cfg = null, engine = null;
  let boardCanvas = null, clipPath = null;
  let views = new Map();      // id -> vista de gema
  let iceView = null;
  let selected = null, drag = null, hint = null, lastAction = 0;
  let shakeT = 0;
  const tweens = [];
  const drawList = [];
  const byZ = (a, b) => a.z - b.z;
  const particles = [];
  const effects = [];
  const timers = new Set();
  const cleanups = [];
  const flyEls = new Set();
  let hudEls = null;
  let disp = { score: 0, shownScore: -1, moves: 0, snap: null, starsLit: 0 };
  let menuLevel = 1;
  let firstMoveDone = false;
  let frozen = false; // solo para pruebas: congela el cuadro actual
  const boostSel = new Set(); // potenciadores elegidos en la tarjeta previa
  let boostsUsed = new Set(); // potenciadores activos en el nivel en curso
  let skipBonus = false;

  // ---------- utilidades ----------
  const now = () => performance.now();
  let speed = 1; // el bonus final corre más rápido
  let bonusing = false;
  const wait = ms => new Promise(res => { const id = setTimeout(() => { timers.delete(id); res(); }, ms / speed); timers.add(id); });
  function tween(dur, fn, ease = t => t, delay = 0) {
    return new Promise(res => tweens.push({ t0: now() + delay / speed, dur: Math.max(1, dur / speed), fn, ease, res }));
  }
  function on(target, ev, fn, opts) { target.addEventListener(ev, fn, opts); cleanups.push(() => target.removeEventListener(ev, fn, opts)); }
  const cellX = c => MARGIN + c * CELL;
  const cellY = r => MARGIN + r * CELL;
  function screenOfCell(r, c) {
    const rect = canvas.getBoundingClientRect();
    const k = rect.width / ART;
    return { x: rect.left + (cellX(c) + CELL / 2) * k, y: rect.top + (cellY(r) + CELL / 2) * k };
  }

  // ---------- montaje ----------
  function buildDom(container) {
    root = container;
    styleEl = document.createElement('style');
    styleEl.textContent = M3_CSS;
    document.head.append(styleEl);
    const deco = ui.h('div.m3-deco');
    // joyitas flotando de fondo (solo transform/opacity: baratas)
    const spots = [[6, 16, 0, 34], [90, 24, 1, 26], [4, 58, 2, 30], [91, 52, 3, 36], [12, 88, 4, 28], [84, 86, 5, 32], [22, 34, 3, 22], [76, 30, 0, 24], [30, 72, 1, 20], [68, 70, 2, 22]];
    spots.forEach(([x, y, t, px], i) => deco.append(ui.h('img.pi.m3-float', { src: gemIconUrl(t, 36), width: px, height: px, alt: '',
      style: { left: x + '%', top: y + '%', animationDelay: (-i * 0.9) + 's', animationDuration: (5 + (i % 4)) + 's' } })));
    root.append(ui.h('div.game-bg.pattern'), ui.h('div.m3-glow'), deco);
    bar = ui.h('div.game-bar.m3-bar');
    stage = ui.h('div.m3-stage');
    wrap = ui.h('div.m3-board');
    canvas = ui.h('canvas.pixel-canvas.m3-canvas', { width: ART, height: ART, 'aria-label': 'Tablero de joyas' });
    g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    fxLayer = ui.h('div.m3-fx');
    wrap.append(canvas, fxLayer);
    footEl = ui.h('div.m3-foot');
    plaque = ui.h('div.m3-plaque');
    stage.append(plaque, wrap, footEl);
    root.append(stage, bar);
    root.__m3 = debugApi;
  }

  // API mínima para pruebas automáticas (smoke): no afecta el juego normal
  const debugApi = {
    get engine() { return engine; }, get mode() { return mode; }, get busy() { return busy; }, get disp() { return disp; },
    setGem(r, c, type, special = null) {
      const gm = engine?.grid[r]?.[c];
      if (!gm) return false;
      gm.type = special === 'rainbow' ? RAINBOW : type; gm.special = special;
      const v = views.get(gm.id); if (v) { v.type = gm.type; v.special = special; }
      return true;
    },
    cellCenter(r, c) { return screenOfCell(r, c); },
    fx(kind, r, c, extra = {}) { effects.push({ kind, r, c, color: GEMS[extra.type ?? 0].fx, size: 1.7, targets: [], ...extra, t0: now() - (extra.at || 0), dur: extra.dur || 400 }); },
    freeze(on) { frozen = !!on; },
    get boosts() { return [...boostsUsed]; }, get boostSel() { return [...boostSel]; }, get bonusing() { return bonusing; }, get speed() { return speed; },
    say(text, n = 2, isBanner = false) { if (isBanner) banner(text, n); else comboText(text, n); },
    finishNow(won) { if (engine && mode === 'play' && !busy) { if (won) engine.cfg.goals.forEach(gl => { if (gl.kind === 'collect') engine.collected[gl.type] = gl.count; if (gl.kind === 'score') engine.score = Math.max(engine.score, gl.target); if (gl.kind === 'ice') { engine.iceLeft = 0; } }); else engine.moves = 0; checkEnd(); } },
  };

  // ---------- tamaño del tablero (escala entera en pixeles reales) ----------
  function layout() {
    if (!root || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const rr = root.getBoundingClientRect();
    const br = bar.getBoundingClientRect();
    stage.style.top = (br.bottom - rr.top + 10) + 'px';
    plaque.classList.remove('hidden');
    const sr = stage.getBoundingClientRect();
    const availH = sr.height - footEl.offsetHeight - 14;
    const availW = Math.min(sr.width - 16, 640);
    const avail = Math.max(120, Math.min(availW, availH));
    const k = Math.max(1, Math.floor((avail * dpr) / ART));
    let css = (ART * k) / dpr;
    // en pantallas de alta densidad (celu) la escala fraccionaria no se nota: aprovechar el ancho
    if (dpr >= 2 && css < avail * 0.94) css = Math.floor(avail);
    wrap.style.width = wrap.style.height = css + 'px';
    // el cartel del nivel solo si sobra lugar (celular vertical)
    plaque.classList.toggle('hidden', availH - css < plaque.offsetHeight + 40);
    footEl.querySelector('.m3-lvchip')?.classList.toggle('hidden', !plaque.classList.contains('hidden'));
  }
  /** corta animaciones/esperas pendientes (al cambiar de nivel o salir al mapa) */
  function resetAsync() {
    tweens.length = 0;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    particles.length = 0; effects.length = 0;
    if (fxLayer) fxLayer.innerHTML = '';
    for (const el of flyEls) el.remove();
    flyEls.clear();
    shakeT = 0; if (wrap) wrap.style.transform = '';
    speed = 1; bonusing = false; skipBonus = false;
  }

  // ---------- loop ----------
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (frozen) return;
    const dt = Math.min(0.05, (t - (lastNow || t)) / 1000);
    lastNow = t;
    T += dt;
    // tweens
    const n = now();
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      const p = (n - tw.t0) / tw.dur;
      if (p < 0) continue;
      if (p >= 1) { tw.fn(1); tweens.splice(i, 1); tw.res(); } else tw.fn(tw.ease(p));
    }
    // partículas
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += p.grav * dt; p.vx *= 0.985;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = effects.length - 1; i >= 0; i--) if (n - effects[i].t0 > effects[i].dur) effects.splice(i, 1);
    // pista
    if (mode === 'play' && !busy && !hint && engine && n - lastAction > HINT_DELAY) {
      const m = engine.bestMove();
      if (m) hint = { a: m.a, b: m.b, t0: T };
    }
    updateScoreDisplay(dt);
    if (shakeT > 0) {
      shakeT -= dt;
      const a = Math.max(0, shakeT) * 14;
      wrap.style.transform = `translate(${Math.round((Math.random() - 0.5) * a)}px, ${Math.round((Math.random() - 0.5) * a)}px)`;
      if (shakeT <= 0) wrap.style.transform = '';
    }
    if (engine) draw();
  }

  // ---------- dibujo ----------
  function draw() {
    g.clearRect(0, 0, ART, ART);
    g.drawImage(boardCanvas, 0, 0);
    // celda seleccionada: brillo debajo
    if (selected) {
      const x = cellX(selected[1]), y = cellY(selected[0]);
      g.fillStyle = '#ffffff';
      g.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      g.fillStyle = 'rgba(255,126,182,0.35)';
      g.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
    }
    // gemas (recortadas a las celdas activas, así las que caen aparecen desde arriba)
    g.save();
    g.clip(clipPath);
    let h1 = -1, h2 = -1;
    if (hint) { h1 = engine.grid[hint.a[0]][hint.a[1]]?.id ?? -1; h2 = engine.grid[hint.b[0]][hint.b[1]]?.id ?? -1; }
    drawList.length = 0;
    for (const v of views.values()) drawList.push(v);
    drawList.sort(byZ);
    for (const v of drawList) drawGem(v, v.id === h1 || v.id === h2);
    g.restore();
    // cristales
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const lv = iceView[r][c];
      if (lv > 0) g.drawImage(sprites().ice[lv], cellX(c), cellY(r));
    }
    // efectos
    const n = now();
    for (const e of effects) drawEffect(e, clamp((n - e.t0) / e.dur, 0, 1));
    // partículas
    for (const p of particles) {
      const a = clamp(p.life / p.max, 0, 1);
      g.globalAlpha = a < 0.3 ? a / 0.3 : 1;
      g.fillStyle = p.color;
      const s = p.size;
      if (p.kind === 'spark') {
        const x = Math.round(p.x), y = Math.round(p.y);
        g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
      } else g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    g.globalAlpha = 1;
    // marco de selección
    if (selected) {
      const x = cellX(selected[1]), y = cellY(selected[0]);
      const o = Math.floor(T * 4) % 2;
      g.fillStyle = '#e0528f';
      const L = 4, x0 = x - o, y0 = y - o, x1 = x + CELL - 1 + o, y1 = y + CELL - 1 + o;
      g.fillRect(x0, y0, L, 1); g.fillRect(x0, y0, 1, L);
      g.fillRect(x1 - L + 1, y0, L, 1); g.fillRect(x1, y0, 1, L);
      g.fillRect(x0, y1, L, 1); g.fillRect(x0, y1 - L + 1, 1, L);
      g.fillRect(x1 - L + 1, y1, L, 1); g.fillRect(x1, y1 - L + 1, 1, L);
    }
  }

  function drawGem(v, hinted) {
    if (v.alpha <= 0 || v.scale <= 0.02) return;
    const spr = gemSprite(v, T + v.phase);
    let scale = v.scale;
    let oy = 0;
    if (hinted) { const k = Math.abs(Math.sin((T - hint.t0) * 5)); scale *= 1 + 0.12 * k; oy = -Math.round(k * 1.5); }
    if (v.idle && !busy) { /* respiración leve de especiales */ if (v.special) scale *= 1 + 0.04 * Math.sin(T * 4 + v.phase * 6); }
    const cx = cellX(0) + v.x * CELL + CELL / 2, cy = cellY(0) + v.y * CELL + CELL / 2 + oy;
    g.globalAlpha = v.alpha;
    if (Math.abs(scale - 1) < 0.01) g.drawImage(spr, Math.round(cx - CELL / 2), Math.round(cy - CELL / 2));
    else {
      const s = Math.max(1, Math.round(CELL * scale));
      g.drawImage(spr, Math.round(cx - s / 2), Math.round(cy - s / 2), s, s);
    }
    // destello blanco (al explotar / pista / brillo ocasional)
    let fl = v.flash;
    if (hinted) fl = Math.max(fl, 0.35 * Math.abs(Math.sin((T - hint.t0) * 5)));
    const glint = (T * 0.37 + v.phase * 7.3) % 6;
    if (fl > 0.02 && v.type < RAINBOW) {
      const s = Math.max(1, Math.round(CELL * scale));
      g.globalAlpha = v.alpha * fl;
      g.drawImage(sprites().white[v.type], Math.round(cx - s / 2), Math.round(cy - s / 2), s, s);
    } else if (glint < 0.35 && v.type < RAINBOW && v.alpha === 1 && scale === 1) {
      // brillo animado ocasional: un destello en cruz que aparece y se va
      const k = Math.sin((glint / 0.35) * Math.PI);
      g.globalAlpha = k;
      g.fillStyle = '#ffffff';
      const x = Math.round(cx - 3), y = Math.round(cy - 4);
      g.fillRect(x, y - 1, 1, 3); g.fillRect(x - 1, y, 3, 1);
      if (k > 0.6) { g.fillRect(x, y - 2, 1, 1); g.fillRect(x, y + 2, 1, 1); g.fillRect(x - 2, y, 1, 1); g.fillRect(x + 2, y, 1, 1); }
    }
    g.globalAlpha = 1;
  }

  function pixLine(x0, y0, x1, y1, color) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    g.fillStyle = color;
    for (let i = 0; i < 400; i++) {
      g.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function drawEffect(e, p) {
    const fade = 1 - p;
    if (e.kind === 'h' || e.kind === 'v') {
      // rayo: borde tinta, banda de color y núcleo blanco que se abre y se apaga
      const w = Math.round(2 + Math.sin(Math.min(1, p * 1.6) * Math.PI) * 6);
      const reach = easeOut(Math.min(1, p * 2.2));
      g.globalAlpha = p < 0.7 ? 1 : fade / 0.3;
      if (e.kind === 'h') {
        const y = Math.round(cellY(e.r) + CELL / 2), cx = cellX(e.c) + CELL / 2;
        const x0 = Math.round(cx - (cx - MARGIN) * reach), x1 = Math.round(cx + (MARGIN + COLS * CELL - cx) * reach);
        g.fillStyle = 'rgba(59,35,64,0.55)'; g.fillRect(x0, y - (w >> 1) - 3, x1 - x0, w + 6);
        g.fillStyle = e.color; g.fillRect(x0, y - (w >> 1) - 2, x1 - x0, w + 4);
        g.fillStyle = '#ffffff'; g.fillRect(x0, y - (w >> 1), x1 - x0, w);
      } else {
        const x = Math.round(cellX(e.c) + CELL / 2), cy = cellY(e.r) + CELL / 2;
        const y0 = Math.round(cy - (cy - MARGIN) * reach), y1 = Math.round(cy + (MARGIN + ROWS * CELL - cy) * reach);
        g.fillStyle = 'rgba(59,35,64,0.55)'; g.fillRect(x - (w >> 1) - 3, y0, w + 6, y1 - y0);
        g.fillStyle = e.color; g.fillRect(x - (w >> 1) - 2, y0, w + 4, y1 - y0);
        g.fillStyle = '#ffffff'; g.fillRect(x - (w >> 1), y0, w, y1 - y0);
      }
    } else if (e.kind === 'ring') {
      const cx = cellX(e.c) + CELL / 2, cy = cellY(e.r) + CELL / 2;
      const rad = 4 + easeOut(p) * CELL * e.size;
      g.globalAlpha = fade;
      g.strokeStyle = '#ffffff'; g.lineWidth = 3 * fade + 1;
      g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = e.color; g.lineWidth = 1;
      g.beginPath(); g.arc(cx, cy, rad + 2, 0, Math.PI * 2); g.stroke();
    } else if (e.kind === 'lines') {
      const cx = cellX(e.c) + CELL / 2, cy = cellY(e.r) + CELL / 2;
      g.globalAlpha = p < 0.2 ? p / 0.2 : fade;
      const reach = clamp(p / 0.35, 0, 1);
      for (const [r, c] of e.targets) {
        const tx = cellX(c) + CELL / 2, ty = cellY(r) + CELL / 2;
        pixLine(cx, cy, cx + (tx - cx) * reach, cy + (ty - cy) * reach, (r + c) % 2 ? '#ffffff' : e.color);
      }
    } else if (e.kind === 'flash') {
      g.globalAlpha = fade * 0.7;
      g.fillStyle = '#ffffff';
      g.fillRect(MARGIN, MARGIN, COLS * CELL, ROWS * CELL);
    }
    g.globalAlpha = 1;
  }

  // ---------- partículas ----------
  function burst(r, c, color, n = 8, speed = 70) {
    const x = cellX(c) + CELL / 2, y = cellY(r) + CELL / 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      const life = 0.35 + Math.random() * 0.35;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, grav: 220, life, max: life, color: i % 3 === 0 ? '#ffffff' : color, size: Math.random() < 0.3 ? 2 : 1, kind: 'sq' });
    }
    if (particles.length > 500) particles.splice(0, particles.length - 500);
  }
  function sparkles(r, c, n = 4, color = '#ffffff') {
    const x = cellX(c) + CELL / 2, y = cellY(r) + CELL / 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 20 + Math.random() * 30;
      const life = 0.4 + Math.random() * 0.4;
      particles.push({ x: x + Math.cos(a) * 5, y: y + Math.sin(a) * 5, vx: Math.cos(a) * s, vy: Math.sin(a) * s, grav: 0, life, max: life, color, size: 1, kind: 'spark' });
    }
  }
  function shake(s = 0.25) { shakeT = Math.max(shakeT, s); }

  // ---------- vistas ----------
  function makeView(gm, r, c) {
    const v = { id: gm.id, type: gm.type, special: gm.special, x: c, y: r, scale: 1, alpha: 1, flash: 0, z: 0, phase: Math.random(), idle: true };
    views.set(gm.id, v);
    return v;
  }
  function syncViewsFromEngine() {
    views.clear();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const gm = engine.grid[r][c]; if (gm) makeView(gm, r, c); }
  }

  // ---------- reproducción de fases ----------
  async function playPhases(phases) {
    for (const ph of phases) {
      if (!alive) return;
      if (ph.kind === 'swap') await playSwap(ph);
      else if (ph.kind === 'clear') await playClear(ph);
      else if (ph.kind === 'fall') await playFall(ph);
      else if (ph.kind === 'convert') await playConvert(ph);
      else if (ph.kind === 'shuffle') await playShuffle(ph);
    }
  }

  async function playSwap(ph) {
    const A = views.get(ph.idA), B = views.get(ph.idB);
    if (!A || !B) return;
    const [ar, ac] = ph.a, [br, bc] = ph.b;
    A.z = 2; B.z = 1;
    audio.sfx('swoosh');
    await tween(150, p => { A.x = ac + (bc - ac) * p; A.y = ar + (br - ar) * p; B.x = bc + (ac - bc) * p; B.y = br + (ar - br) * p; }, easeInOut);
    if (ph.back) {
      audio.sfx('bump');
      await tween(170, p => { A.x = bc + (ac - bc) * p; A.y = br + (ar - br) * p; B.x = ac + (bc - ac) * p; B.y = ar + (br - ar) * p; }, easeInOut, 40);
    }
    A.z = 0; B.z = 0;
  }

  async function playClear(ph) {
    let maxDelay = 0;
    const promises = [];
    // sonido + texto de combo
    if (ph.combo >= 2) {
      audio.sfx('combo', ph.combo);
      if (ph.combo >= 2) comboText(COMBO_TEXT[Math.min(4, ph.combo)], ph.combo);
    } else audio.sfx('match');
    // explosiones de especiales
    for (const b of ph.blasts) {
      maxDelay = Math.max(maxDelay, b.delay);
      promises.push(wait(b.delay).then(() => {
        if (!alive) return;
        const color = b.type != null && b.type < 6 ? GEMS[b.type].fx : '#ffd166';
        const t0 = now();
        if (b.kind === 'h' || b.kind === 'v') { effects.push({ kind: b.kind, r: b.r, c: b.c, color, t0, dur: 380 }); audio.sfx('clear'); shake(0.12); }
        else if (b.kind === 'bomb') { effects.push({ kind: 'ring', r: b.r, c: b.c, color, size: b.radius === 2 ? 2.8 : 1.7, t0, dur: 420 }); audio.sfx('bump'); audio.sfx('clear'); shake(b.radius === 2 ? 0.4 : 0.22); burst(b.r, b.c, color, 16, 120); }
        else if (b.kind === 'big') { for (let d = -1; d <= 1; d++) { effects.push({ kind: 'h', r: b.r + d, c: b.c, color, t0, dur: 420 }, { kind: 'v', r: b.r, c: b.c + d, color, t0, dur: 420 }); } audio.sfx('clear'); shake(0.4); }
        else if (b.kind === 'rainbow') { effects.push({ kind: 'lines', r: b.r, c: b.c, color, targets: b.targets, t0, dur: 600 }); audio.sfx('gem'); shake(0.2); }
        else if (b.kind === 'all') { effects.push({ kind: 'flash', t0, dur: 600 }, { kind: 'ring', r: b.r, c: b.c, color: '#b58cff', size: 6, t0, dur: 700 }); audio.sfx('levelup'); shake(0.6); }
      }));
    }
    // joyas que se van
    let goalFlies = 0;
    for (const cl of ph.cleared) {
      maxDelay = Math.max(maxDelay, cl.delay);
      const v = views.get(cl.id);
      if (!v) continue;
      v.idle = false;
      promises.push(wait(cl.delay).then(async () => {
        if (!alive) return;
        const color = cl.type < 6 ? GEMS[cl.type].fx : '#ffffff';
        if (cl.merge && !(cl.merge[0] === cl.r && cl.merge[1] === cl.c)) {
          const sx = v.x, sy = v.y, [mr, mc] = cl.merge;
          v.z = 1;
          await tween(170, p => { v.x = sx + (mc - sx) * p; v.y = sy + (mr - sy) * p; v.scale = 1 - p * 0.5; v.flash = p * 0.6; }, easeInOut);
          views.delete(cl.id);
        } else {
          burst(cl.r, cl.c, color, cl.special ? 12 : 7);
          if (cl.type < 6 && goalFlies < 5 && isGoalType(cl.type)) { goalFlies++; flyToGoal(cl.type, cl.r, cl.c); }
          await tween(70, p => { v.flash = p; v.scale = 1 + p * 0.25; });
          await tween(150, p => { v.scale = 1.25 * (1 - p); v.alpha = 1 - p * 0.5; });
          views.delete(cl.id);
        }
      }));
    }
    // cristales
    for (const ic of ph.ice) {
      maxDelay = Math.max(maxDelay, ic.delay);
      promises.push(wait(ic.delay + 40).then(() => {
        if (!alive) return;
        iceView[ic.r][ic.c] = ic.level;
        burst(ic.r, ic.c, '#cdeeff', 10, 90);
        sparkles(ic.r, ic.c, 3);
        audio.sfx('pop');
      }));
    }
    await Promise.all(promises);
    // especiales creadas
    if (ph.created.length) {
      audio.sfx('gem');
      await Promise.all(ph.created.map(cr => {
        const v = makeView(cr.gem, cr.r, cr.c);
        v.scale = 0; v.z = 3;
        sparkles(cr.r, cr.c, 6, '#fff0c2');
        return tween(260, p => { v.scale = p; v.flash = 1 - p; }, easeOutBack).then(() => { v.z = 0; });
      }));
    }
    // puntos
    if (ph.points > 0 && ph.at) {
      const s = screenOfCell(ph.at[0], ph.at[1]);
      ui.floatText(s.x, s.y, '+' + fmt(ph.points), 'm3-pts');
    }
    applySnap(ph.snap);
  }

  async function playFall(ph) {
    const ps = [];
    let maxDur = 0;
    for (const f of ph.falls) {
      const v = views.get(f.id);
      if (!v) continue;
      const d = f.toR - f.fromR, dur = Math.min(520, 150 + 50 * Math.sqrt(d) * 1.6);
      maxDur = Math.max(maxDur, dur);
      v.x = f.c;
      ps.push(tween(dur, p => { v.y = f.fromR + d * p; }, fallEase));
    }
    for (const s of ph.spawns) {
      const v = makeView(s.gem, s.fromR, s.c);
      const d = s.toR - s.fromR, dur = Math.min(560, 150 + 50 * Math.sqrt(d) * 1.6);
      maxDur = Math.max(maxDur, dur);
      ps.push(tween(dur, p => { v.y = s.fromR + d * p; }, fallEase));
    }
    if (ps.length) {
      await Promise.all(ps);
    }
    for (const v of views.values()) v.idle = true;
  }

  async function playConvert(ph) {
    if (ph.from) {
      effects.push({ kind: 'lines', r: ph.from[0], c: ph.from[1], color: '#ffffff', targets: ph.cells.map(c => [c.r, c.c]), t0: now(), dur: 500 });
      audio.sfx('gem');
      await wait(220);
    }
    for (const cell of ph.cells) {
      const v = views.get(cell.id);
      if (!v) continue;
      v.special = cell.special;
      sparkles(cell.r, cell.c, 5, '#ffffff');
      audio.sfx(ph.bonus ? 'star' : 'select');
      tween(220, p => { v.flash = 1 - p; v.scale = 1 + 0.3 * Math.sin(p * Math.PI); });
      if (!ph.bonus) await wait(45);
    }
    if (ph.snap) applySnap(ph.snap);
    await wait(ph.bonus ? 110 : 260);
  }

  async function playShuffle(ph) {
    banner('¡Mezclando!', 'lilac');
    audio.sfx('swoosh');
    await wait(450);
    const ps = [];
    for (const m of ph.moves) {
      const v = views.get(m.id);
      if (!v) continue;
      v.type = m.type;
      const sx = v.x, sy = v.y;
      const mx = 3.5 + (Math.random() - 0.5) * 2, my = 3.5 + (Math.random() - 0.5) * 2;
      ps.push(tween(300, p => { v.x = sx + (mx - sx) * p; v.y = sy + (my - sy) * p; v.scale = 1 - p * 0.3; }, easeInOut)
        .then(() => tween(340, p => { v.x = mx + (m.c - mx) * p; v.y = my + (m.r - my) * p; v.scale = 0.7 + p * 0.3; }, easeOutBack)));
    }
    await Promise.all(ps);
  }

  // ---------- textos grandes ----------
  function comboText(text, n) {
    const el = ui.h('div.m3-combo.c' + Math.min(4, n), {}, text);
    fxLayer.append(el);
    const id = setTimeout(() => { timers.delete(id); el.remove(); }, 1000);
    timers.add(id);
  }
  function banner(text, cls = 'pink', ms = 1300) {
    const el = ui.h('div.m3-banner.' + cls, {}, text);
    fxLayer.append(el);
    const id = setTimeout(() => { timers.delete(id); el.remove(); }, ms);
    timers.add(id);
  }

  // ---------- HUD de la partida ----------
  function isGoalType(t) { return engine && cfg.goals.some(gl => gl.kind === 'collect' && gl.type === t && !engine.goalProgress(gl, disp.snap || engine).done); }
  function goalIcon(gl, px = 28) {
    if (gl.kind === 'collect') return `<img class="pi m3-gi" src="${gemIconUrl(gl.type, px)}" width="${px}" height="${px}" alt="">`;
    if (gl.kind === 'ice') return `<img class="pi m3-gi" src="${gemIconUrl('ice', px)}" width="${px}" height="${px}" alt="">`;
    return icon('star', px);
  }
  function buildPlayBar() {
    bar.innerHTML = '';
    const back = ui.h('button.icon-btn.m3-back', { 'aria-label': 'Volver', html: icon('back', 22), onclick: onBack });
    const goals = ui.h('div.game-stat.m3-goals');
    const goalEls = cfg.goals.map(gl => {
      const el = ui.h('div.m3-goal', { html: goalIcon(gl, 26) + '<b></b>' });
      goals.append(el);
      return el;
    });
    const moves = ui.h('div.game-stat.m3-moves', { html: '<small>Movidas</small><b></b>' });
    const score = ui.h('div.game-stat.m3-score', { html: '<small>Puntos</small><b></b><div class="m3-starbar"><i></i><span></span><span></span><span></span></div>' });
    bar.append(back, goals, moves, score);
    hudEls = { goalEls, moves: moves.querySelector('b'), movesBox: moves, score: score.querySelector('b'), fill: score.querySelector('.m3-starbar i'), stars: [...score.querySelectorAll('.m3-starbar span')] };
    const [t1, t2, t3] = cfg.stars;
    [t1, t2, t3].forEach((t, i) => {
      const sp = hudEls.stars[i];
      sp.style.left = `calc(${(t / t3) * 100}% - 9px)`;
      sp.innerHTML = icon('starOff', 18);
    });
    disp = { score: 0, shownScore: -1, moves: engine.moves, snap: null, starsLit: 0 };
    refreshHud();
  }
  function applySnap(snap) {
    if (!snap) return;
    disp.snap = snap;
    disp.score = snap.score;
    if (snap.moves != null) disp.moves = snap.moves;
    refreshHud();
  }
  function refreshHud() {
    if (!hudEls || !engine) return;
    const src = disp.snap || engine;
    cfg.goals.forEach((gl, i) => {
      const p = engine.goalProgress(gl, src);
      const el = hudEls.goalEls[i];
      const b = el.querySelector('b');
      const txt = gl.kind === 'score' ? fmt(p.left) : String(p.left);
      if (p.done) {
        if (!el.classList.contains('done')) { el.classList.add('done'); b.innerHTML = icon('check', 18); audio.sfx('star'); }
      } else {
        el.classList.remove('done');
        if (b.textContent !== txt) { b.textContent = txt; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      }
    });
    hudEls.moves.textContent = disp.moves;
    hudEls.movesBox.classList.toggle('low', disp.moves <= 3 && mode === 'play');
  }
  function updateScoreDisplay(dt) {
    if (!hudEls || !engine || mode === 'menu') return;
    const target = disp.score;
    if (disp.shownScore === target) return;
    const cur = disp.shownScore < 0 ? 0 : disp.shownScore;
    const next = cur + Math.max(1, (target - cur) * Math.min(1, dt * 10));
    disp.shownScore = next >= target - 1 ? target : next;
    hudEls.score.textContent = fmt(disp.shownScore);
    const [, , t3] = cfg.stars;
    hudEls.fill.style.width = clamp((disp.shownScore / t3) * 100, 0, 100) + '%';
    const [, t2] = cfg.stars;
    const goalsOk = cfg.goals.every(gl => engine.goalProgress(gl, disp.snap || engine).done);
    // 1 estrella = cumplir el objetivo (igual que engine.starsFor); 2 y 3 según el puntaje
    const lit = goalsOk ? 1 + (disp.shownScore >= t2 ? 1 : 0) + (disp.shownScore >= t3 ? 1 : 0) : 0;
    if (lit !== disp.starsLit) {
      for (let i = 0; i < 3; i++) {
        const sp = hudEls.stars[i];
        const want = i < lit;
        if (want !== sp.classList.contains('on')) { sp.classList.toggle('on', want); sp.innerHTML = icon(want ? 'star' : 'starOff', 18); }
      }
      if (lit > disp.starsLit) audio.sfx('star');
      disp.starsLit = lit;
    }
  }
  function flyToGoal(type, r, c) {
    const idx = cfg.goals.findIndex(gl => gl.kind === 'collect' && gl.type === type);
    if (idx < 0 || !hudEls) return;
    const target = hudEls.goalEls[idx].querySelector('img');
    const tr = target.getBoundingClientRect();
    const s = screenOfCell(r, c);
    const el = ui.h('div.fly', { html: `<img class="pi" src="${gemIconUrl(type, 36)}" width="30" height="30" alt="">`, style: { left: s.x + 'px', top: s.y + 'px' } });
    document.getElementById('fx-root')?.append(el);
    const dx = tr.left + tr.width / 2 - s.x, dy = tr.top + tr.height / 2 - s.y;
    const anim = el.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * 0.2}px), calc(-50% + ${dy * 0.2 - 30}px)) scale(1.25)`, opacity: 1, offset: 0.25 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.6)`, opacity: 0.9 },
    ], { duration: 620, easing: 'cubic-bezier(.5,0,.6,1)' });
    flyEls.add(el);
    anim.onfinish = () => { el.remove(); flyEls.delete(el); };
  }

  // ---------- entrada ----------
  function cellAt(e) {
    const rect = canvas.getBoundingClientRect();
    const ax = ((e.clientX - rect.left) / rect.width) * ART, ay = ((e.clientY - rect.top) / rect.height) * ART;
    const c = Math.floor((ax - MARGIN) / CELL), r = Math.floor((ay - MARGIN) / CELL);
    return { r, c, ax, ay, ok: engine?.active(r, c) && !!engine.grid[r][c] };
  }
  function onDown(e) {
    if (bonusing) { e.preventDefault(); skipNow(); return; }
    if (mode !== 'play' || !engine) return;
    e.preventDefault();
    lastAction = now(); hint = null;
    if (busy) return;
    const p = cellAt(e);
    if (!p.ok) { selected = null; return; }
    drag = { r: p.r, c: p.c, ax: p.ax, ay: p.ay, id: e.pointerId, used: false };
    try { canvas.setPointerCapture(e.pointerId); } catch {}
  }
  function onMove(e) {
    if (!drag || drag.id !== e.pointerId || drag.used || busy) return;
    const p = cellAt(e);
    const dx = p.ax - drag.ax, dy = p.ay - drag.ay;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < CELL * 0.38) return;
    drag.used = true;
    const [dr, dc] = Math.abs(dx) > Math.abs(dy) ? [0, Math.sign(dx)] : [Math.sign(dy), 0];
    const to = [drag.r + dr, drag.c + dc];
    selected = null;
    trySwap([drag.r, drag.c], to);
  }
  function onUp(e) {
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag;
    drag = null;
    if (d.used || busy || mode !== 'play') return;
    // clic-clic (o toque-toque)
    if (selected) {
      const [sr, sc] = selected;
      if (sr === d.r && sc === d.c) { selected = null; return; }
      if (Math.abs(sr - d.r) + Math.abs(sc - d.c) === 1) { selected = null; trySwap([sr, sc], [d.r, d.c]); return; }
    }
    selected = [d.r, d.c];
    audio.sfx('select');
  }
  function onCancel() { drag = null; }

  async function trySwap(a, b) {
    if (busy || mode !== 'play') return;
    if (!engine.active(b[0], b[1]) || !engine.grid[b[0]][b[1]]) { audio.sfx('bump'); return; }
    busy = true; hint = null;
    const pre = { score: engine.score, collected: engine.collected.slice(), iceLeft: engine.iceLeft };
    const res = engine.play(a, b);
    if (!res.valid) {
      await playPhases(res.phases);
      busy = false; lastAction = now();
      return;
    }
    if (!firstMoveDone) { firstMoveDone = true; if (helpEl?.__chip) { helpEl.replaceWith(helpEl.__chip); layout(); } helpEl = null; }
    // el motor ya resolvió toda la cascada: el HUD avanza fase por fase desde el estado previo
    disp.snap = { ...pre, moves: engine.moves };
    disp.moves = engine.moves;
    refreshHud();
    await playPhases(res.phases);
    if (!alive) return;
    disp.snap = null; disp.score = engine.score; refreshHud();
    lastAction = now();
    busy = false;
    checkEnd();
  }

  async function checkEnd() {
    if (mode !== 'play') return;
    if (!engine.goalsDone() && engine.moves > 0) return;
    mode = 'end'; busy = true; selected = null; hint = null;
    // si quedó abierto el "¿Salir del nivel?" (tocó volver durante la última cascada), esperar a que lo cierre:
    // así nunca se apilan el cartel de premio y la confirmación
    while (ui.hasModal()) { await wait(150); if (!alive) return; }
    if (engine.goalsDone()) {
      await wait(250);
      banner('¡Objetivo cumplido!', 'gold', 1200);
      audio.sfx('done');
      await wait(1100);
      if (!alive) return;
      if (engine.moves > 0 || engine.hasSpecials()) await doBonus();
      if (!alive) return;
      finish(true);
    } else {
      await wait(300);
      banner('¡Sin movidas!', 'lilac', 1400);
      await wait(1300);
      if (!alive) return;
      finish(false);
    }
  }

  // Bonus final: cada movida sobrante se vuelve una rayada y después explotan todas.
  // Con muchas movidas va más rápido (y de a varias); tocar el tablero o "Saltear" lo resuelve al instante.
  async function doBonus() {
    bonusing = true;
    skipBonus = false;
    const left = engine.moves;
    speed = left > 12 ? 3 : left > 6 ? 2.4 : 1.8;
    footEl.innerHTML = '';
    footEl.append(ui.h('button.btn.ghost.small.m3-skip', { html: `${icon('sparkle', 16)} Tocá para saltear`, onclick: (e) => { e.stopPropagation(); skipNow(); } }));
    if (engine.moves > 0) {
      banner('¡Bonus!', 'pink', 1100);
      audio.sfx('levelup');
      await wait(800);
      while (engine.moves > 0 && alive && !skipBonus) {
        // de a 1, 2 o 3 a la vez según cuántas queden
        const per = engine.moves > 14 ? 3 : engine.moves > 7 ? 2 : 1;
        const phs = [];
        for (let i = 0; i < per && engine.moves > 0; i++) phs.push(engine.bonusConvert());
        hudEls.movesBox.classList.remove('bump'); void hudEls.movesBox.offsetWidth; hudEls.movesBox.classList.add('bump');
        await Promise.all(phs.map(ph => playConvert(ph)));
      }
      if (!skipBonus) await wait(300);
    }
    for (let k = 0; k < 4 && engine.hasSpecials() && alive && !skipBonus; k++) {
      await playPhases(engine.bonusDetonate());
      await wait(120);
    }
    if (!alive) return;
    speed = 1;
    if (skipBonus) finishBonusNow();
    bonusing = false;
    footEl.innerHTML = '';
    disp.snap = null; disp.score = engine.score; disp.moves = engine.moves; refreshHud();
    await wait(skipBonus ? 500 : 700);
  }
  function skipNow() {
    if (!bonusing || skipBonus) return;
    skipBonus = true;
    speed = 6; // lo que esté animándose termina enseguida
    audio.sfx('tap');
    footEl.innerHTML = '';
  }
  /** resuelve el resto del bonus sin animar cada paso: un flash y el tablero final */
  function finishBonusNow() {
    let guard = 0;
    while (engine.bonusConvert() && guard++ < 99);
    for (let k = 0; k < 4 && engine.hasSpecials(); k++) engine.bonusDetonate();
    syncViewsFromEngine();
    const t0 = now();
    effects.push({ kind: 'flash', t0, dur: 520 }, { kind: 'ring', r: 3.5, c: 3.5, color: '#ffd166', size: 5, t0, dur: 600 });
    for (let i = 0; i < 10; i++) burst(Math.floor(Math.random() * ROWS), Math.floor(Math.random() * COLS), GEMS[i % 6].fx, 8, 110);
    for (const v of views.values()) { v.flash = 1; tween(320, p => { v.flash = 1 - p; }); }
    audio.sfx('clear'); audio.sfx('star');
    shake(0.3);
    hint = null;
  }

  async function finish(won) {
    const n = level;
    const st = m3state();
    const score = engine.score;
    let stars = 0, gems = 0;
    if (won) {
      stars = engine.starsFor(score);
      store.inc('match3Wins');
      st.level = Math.max(st.level, n + 1);
      const prev = st.stars[n] || 0;
      if (stars === 3 && prev < 3) gems = 1;
      st.stars[n] = Math.max(prev, stars);
      store.markDirty();
    }
    const goalLines = cfg.goals.map(gl => {
      const p = engine.goalProgress(gl);
      const name = gl.kind === 'score' ? 'Puntos' : gl.kind === 'ice' ? 'Cristales' : cap(GEM_NAMES[gl.type]);
      return `${goalIcon(gl, 20)} ${name}: <b>${gl.kind === 'score' ? fmt(p.have) : p.have}/${gl.kind === 'score' ? fmt(p.need) : p.need}</b>`;
    });
    const result = won
      ? { game: 'match3', score, stars, won: true, coins: 40 + 10 * stars, gems, xp: 15, againLabel: 'Siguiente', title: `¡Nivel ${n} superado!`,
        subtitle: `Puntaje: ${fmt(score)}`, lines: gems ? ['¡Primera vez con 3 estrellas en este nivel!'] : [] }
      : { game: 'match3', score, stars: 0, won: false, coins: 5, xp: 5, againLabel: 'Reintentar', title: '¡Casi!',
        subtitle: 'Te quedaste sin movidas', lines: goalLines };
    const choice = await ctx.endGame(result);
    if (!alive) return;
    if (choice === 'again') {
      // al reintentar, si tiene potenciadores pasa por la tarjeta para poder elegirlos
      if (won || BOOSTERS.some(id => itemCount(id) > 0)) showMenu(won ? n + 1 : n); else startLevel(n);
    }
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------- volver / salir ----------
  async function onBack() {
    audio.sfx('tap');
    if (mode === 'menu') { ctx.router.go('city'); return; }
    if (mode === 'end') return;
    const ok = await ui.confirm('¿Salir del nivel?', 'Vas a perder lo que llevás de este nivel.', 'Salir', 'Seguir');
    if (ok && alive && mode === 'play') showMenu(level);
  }
  function onKey(e) {
    if (e.key === 'Escape' && !ui.hasModal()) { e.preventDefault(); onBack(); }
    else if (mode === 'menu' && (e.key === 'Enter' || e.key === ' ') && !ui.hasModal() && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); startLevel(menuLevel); }
  }

  // ---------- pantalla previa / mapa de niveles ----------
  function goalText(gl, c) {
    if (gl.kind === 'score') return `Llegá a <b>${fmt(gl.target)}</b> puntos`;
    if (gl.kind === 'collect') return `Juntá <b>${gl.count}</b> ${GEM_NAMES[gl.type]}`;
    const cells = c.ice.flat().filter(v => v > 0).length;
    const dbl = c.ice.flat().some(v => v > 1);
    return `Rompé <b>${cells}</b> cristales${dbl ? ' <small>(algunos son dobles)</small>' : ''}`;
  }
  function showMenu(n) {
    resetAsync();
    mode = 'menu'; busy = false; selected = null; hint = null; drag = null;
    engine = null; hudEls = null;
    bar.classList.remove('play');
    stage.classList.add('hidden');
    preEl?.remove();
    const st = m3state();
    menuLevel = clamp(n, 1, st.level);
    bar.innerHTML = '';
    bar.append(
      ui.h('button.icon-btn.m3-back', { 'aria-label': 'Volver a la ciudad', html: icon('back', 22), onclick: onBack }),
      ui.h('div.game-title', {}, 'Joyas Reales'),
      ui.h('div.spacer'),
      ui.h('div.game-stat.m3-total', { html: `<small>Estrellas</small><b>${icon('star', 18)} ${Object.values(st.stars).reduce((a, b) => a + b, 0)}</b>` }),
    );
    preEl = ui.h('div.m3-pre');
    const card = ui.h('div.m3-card');
    const map = ui.h('div.m3-map');
    preEl.append(card, map);
    root.append(preEl);
    renderCard(card);
    renderMap(map);
  }
  function renderCard(card) {
    const n = menuLevel;
    const c = levelConfig(n);
    const st = m3state();
    const got = st.stars[n] || 0;
    card.innerHTML = '';
    const ribbon = ui.h('div.m3-ribbon', {}, ui.h('span', {}, `Nivel ${n}`));
    const starsRow = ui.h('div.m3-prestars', { html: [0, 1, 2].map(i => icon(i < got ? 'star' : 'starOff', i === 1 ? 40 : 32)).join('') });
    const goals = ui.h('div.m3-pregoals');
    for (const gl of c.goals) goals.append(ui.h('div.m3-pregoal', { html: `<span class="m3-pgi">${goalIcon(gl, 44)}</span><span>${goalText(gl, c)}</span>` }));
    const meta = ui.h('div.m3-meta', { html: `<span class="chip pink">${icon('wand', 16)} ${c.moves} movidas</span>${c.shape !== 'lleno' ? `<span class="chip lilac">${icon('sparkle', 16)} Tablero ${shapeName(c.shape)}</span>` : ''}` });
    const tip = ui.h('p.m3-tip', { html: `${icon('info', 16)} ${c.tip}` });
    const evHtml = eventChipHtml('match3', ui.esc);
    const ev = evHtml ? ui.h('div.m3-event', { html: evHtml }) : null;
    const boosts = boosterRow(BOOSTERS, boostSel, { audio });
    const play = ui.h('button.btn.pink.block.m3-play', { html: `${icon('play', 22)} ¡Jugar!`, onclick: () => { audio.sfx('tap'); startLevel(n, consumeSelected(boostSel)); } });
    card.append(ribbon, starsRow, goals, meta, ...(ev ? [ev] : []), boosts, tip, play);
  }
  function shapeName(s) { return { esquinas: 'esquinitas', centro: 'con laguna', corazon: 'corazón', diamante: 'diamante', cruz: 'cruz', reloj: 'reloj de arena', columnas: 'columnas', castillo: 'castillo', puente: 'puente' }[s] || s; }
  function renderMap(map) {
    const st = m3state();
    const maxL = st.level;
    map.innerHTML = '';
    map.append(ui.h('div.m3-map-title', { html: `${icon('map', 18)} Tus niveles` }));
    const scroller = ui.h('div.m3-map-scroll');
    const total = maxL + 6;
    let curEl = null;
    for (let i = 1; i <= total; i++) {
      const locked = i > maxL;
      const s = st.stars[i] || 0;
      const node = ui.h('button.m3-node' + (locked ? '.locked' : '') + (i === menuLevel ? '.sel' : '') + (i === maxL ? '.cur' : ''), {
        'aria-label': `Nivel ${i}`,
        html: `<b>${locked ? icon('lock', 18) : i}</b><span class="m3-nstars">${[0, 1, 2].map(k => icon(k < s ? 'star' : 'starOff', 12)).join('')}</span>`,
      });
      node.addEventListener('click', () => {
        if (scroller.dataset.dragged === '1') return;
        if (locked) { audio.sfx('error'); ui.toast('Pasá los niveles anteriores para desbloquearlo', { icon: 'lock' }); return; }
        audio.sfx('select');
        menuLevel = i;
        scroller.querySelectorAll('.m3-node.sel').forEach(x => x.classList.remove('sel'));
        node.classList.add('sel');
        renderCard(preEl.querySelector('.m3-card'));
      });
      if (i === menuLevel) curEl = node;
      // caminito entre nodos
      if (i > 1) scroller.append(ui.h('i.m3-path' + (locked ? '.locked' : '')));
      scroller.append(node);
    }
    map.append(scroller);
    // rueda del mouse -> scroll horizontal; arrastre con mouse
    scroller.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { scroller.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    let ds = null;
    scroller.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; ds = { x: e.clientX, s: scroller.scrollLeft, moved: false }; scroller.dataset.dragged = '0'; });
    scroller.addEventListener('pointermove', e => {
      if (!ds) return;
      const dx = e.clientX - ds.x;
      if (Math.abs(dx) > 6) { ds.moved = true; scroller.dataset.dragged = '1'; }
      if (ds.moved) scroller.scrollLeft = ds.s - dx;
    });
    const end = () => { if (ds?.moved) setTimeout(() => { scroller.dataset.dragged = '0'; }, 0); ds = null; };
    scroller.addEventListener('pointerup', end);
    scroller.addEventListener('pointerleave', end);
    requestAnimationFrame(() => { if (curEl) scroller.scrollLeft = curEl.offsetLeft - scroller.clientWidth / 2 + curEl.offsetWidth / 2; });
  }

  // ---------- empezar nivel ----------
  /** boosts: Set de potenciadores ya consumidos de la mochila para este intento */
  function startLevel(n, boosts = new Set()) {
    resetAsync();
    const st = m3state();
    level = clamp(n, 1, st.level);
    cfg = levelConfig(level);
    cfg.stars = calibrateStars(cfg); // siempre con las movidas base: los potenciadores no mueven los umbrales
    engine = new Engine(cfg);
    boostsUsed = new Set(boosts);
    if (boostsUsed.has('m3_moves')) engine.moves += EXTRA_MOVES;
    const bombCells = boostsUsed.has('m3_bomb') ? placeBombs(BOMBS) : [];
    boardCanvas = buildBoard(cfg.mask);
    clipPath = new Path2D();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (cfg.mask[r][c]) clipPath.rect(cellX(c), cellY(r), CELL, CELL);
    iceView = engine.ice.map(r => r.slice());
    syncViewsFromEngine();
    preEl?.remove(); preEl = null;
    stage.classList.remove('hidden');
    mode = 'play'; busy = true; selected = null; hint = null; drag = null;
    bar.classList.add('play');
    buildPlayBar();
    const best = m3state().stars[level] || 0;
    plaque.innerHTML = `<span class="m3-pl-in">${icon('crown', 24)}<b>Nivel ${level}</b><span class="m3-pl-st">${[0, 1, 2].map(i => icon(i < best ? 'star' : 'starOff', 14)).join('')}</span></span>`;
    footEl.innerHTML = '';
    const chip = ui.h('span.chip.gold.m3-lvchip', { html: `${icon('crown', 16)} Nivel ${level}` });
    footEl.append(chip, ui.h('button.btn.ghost.small.m3-hintbtn', { html: `${icon('sparkle', 16)} Pista`, onclick: () => { if (mode === 'play' && !busy) { audio.sfx('tap'); lastAction = -1e9; hint = null; } } }));
    helpEl = null;
    firstMoveDone = false;
    if (level <= 2) {
      const fine = matchMedia('(pointer: fine)').matches;
      helpEl = ui.h('span.m3-helptext', {}, fine ? 'Arrastrá una joya o hacé clic en dos vecinas' : 'Deslizá una joya hacia una vecina');
      chip.replaceWith(helpEl);
      helpEl.__chip = chip;
    }
    layout();
    requestAnimationFrame(layout);
    // entrada: las joyas caen desde arriba
    for (const v of views.values()) { v.y0 = v.y; v.y = v.y - 9; }
    const ps = [];
    for (const v of views.values()) {
      const delay = v.x * 30 + (7 - v.y0) * 18;
      ps.push(tween(420, p => { v.y = v.y0 - 9 * (1 - p); }, fallEase, delay));
    }
    audio.sfx('swoosh');
    Promise.all(ps).then(async () => {
      if (!alive || mode !== 'play') return;
      if (boostsUsed.size) await showBoosts(bombCells);
      if (!alive || mode !== 'play') return;
      busy = false; lastAction = now();
      banner(`Nivel ${level}`, 'pink', 1000);
    });
  }
  /** pone n bombas en celdas comunes, lejos de los bordes y separadas entre sí. Devuelve [[r,c],...] */
  function placeBombs(n) {
    const cand = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const gm = engine.grid[r][c];
      if (!engine.active(r, c) || !gm || gm.special || gm.type >= RAINBOW) continue;
      const edge = Math.min(r, c, ROWS - 1 - r, COLS - 1 - c);
      cand.push({ r, c, w: (edge >= 2 ? 3 : edge === 1 ? 2 : 0.6) * (0.5 + Math.random()) });
    }
    cand.sort((a, b) => b.w - a.w);
    const out = [];
    for (const k of cand) {
      if (out.length >= n) break;
      if (out.some(([r, c]) => Math.abs(r - k.r) + Math.abs(c - k.c) < 3)) continue;
      engine.grid[k.r][k.c].special = 'bomb';
      out.push([k.r, k.c]);
    }
    return out;
  }
  /** presentación de los potenciadores al empezar */
  async function showBoosts(bombCells) {
    if (boostsUsed.has('m3_moves')) {
      banner(`¡+${EXTRA_MOVES} movidas!`, 'gold', 1100);
      audio.sfx('star');
      const r = hudEls?.movesBox.getBoundingClientRect();
      if (r) ui.floatText(r.left + r.width / 2, r.bottom + 6, `${boosterIcon('m3_moves', 22)} +${EXTRA_MOVES}`, 'm3-pts');
      hudEls?.movesBox.classList.remove('bump'); void hudEls?.movesBox.offsetWidth; hudEls?.movesBox.classList.add('bump');
      await wait(900);
    }
    if (bombCells.length) {
      if (!boostsUsed.has('m3_moves')) { banner('¡Bombas de Joyas!', 'gold', 1100); }
      audio.sfx('gem');
      for (const [r, c] of bombCells) {
        const gm = engine.grid[r][c];
        const v = gm && views.get(gm.id);
        effects.push({ kind: 'ring', r, c, color: '#ffd166', size: 1.6, t0: now(), dur: 450 });
        sparkles(r, c, 8, '#fff0c2');
        if (v) tween(360, p => { v.flash = 1 - p; v.scale = 1 + 0.35 * Math.sin(p * Math.PI); });
        await wait(160);
      }
      await wait(500);
    }
  }

  return {
    hud: false,
    music: 'game',
    async mount(container, params = {}) {
      buildDom(container);
      // calentar sprites (genera el caché)
      sprites();
      on(canvas, 'pointerdown', onDown);
      on(canvas, 'pointermove', onMove);
      on(canvas, 'pointerup', onUp);
      on(canvas, 'pointercancel', onCancel);
      on(canvas, 'contextmenu', e => e.preventDefault());
      on(window, 'resize', layout);
      on(window, 'keydown', onKey);
      const st = m3state();
      const pl = Number(params.level);
      showMenu(pl >= 1 ? Math.min(pl, st.level) : st.level);
      if (params.autoplay != null) startLevel(menuLevel);
      lastNow = 0;
      raf = requestAnimationFrame(frame);
      // la fuente puede terminar de cargar después: la barra cambia de alto y el tablero se reubica
      document.fonts?.ready.then(() => { if (alive) layout(); });
    },
    unmount() {
      alive = false;
      cancelAnimationFrame(raf);
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const fn of cleanups) { try { fn(); } catch {} }
      cleanups.length = 0;
      tweens.length = 0; particles.length = 0; effects.length = 0;
      for (const el of flyEls) el.remove();
      flyEls.clear();
      views.clear();
      styleEl?.remove();
      if (root) delete root.__m3;
      root = canvas = g = null;
    },
  };
}
