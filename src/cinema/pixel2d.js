// Viñetas en pixel art 2D animado (PLAN-TRAVESIA §3a): momentos de las cinemáticas contados como crónica ilustrada que
// se mueve, alternados con los planos 3D. Canvas de baja resolución sin suavizado (CLAUDE.md: el 2D va así) que el
// reproductor estira con image-rendering: pixelated.
//
//   const v = createVignette('forcejeo')            → { canvas, update(dt, t), draw(), seek(t), dispose(), dur, state }
//   VIGNETTES: { forcejeo }                          · defineVignette(id, build)
//
// Piezas:
//   - capas con paralaje (cielo, lejos, medio, piso, frente): cada una se pinta una vez en su canvas y se corre con la
//     cámara según su factor;
//   - actores con los sprites de src/art/sprite2d.js (caminar, golpear, caer, señalar, levantar, entregar), con
//     posición, giro (flip) y animación por cuadros;
//   - utilería suelta (el cristal, una carta) y partículas (chispas, polvo, brillo);
//   - tweens con ease sobre cualquier número (posición de un actor, zoom, paneo);
//   - cámara 2D: paneo, zoom entero (1×, 2×, 3×: el píxel sigue nítido) y temblor de píxeles enteros.
// Un guion es una lista de pasos en el tiempo (`v.at(t, fn)`), así `seek(t)` rearma cualquier instante igual (sirve
// para las capturas y las pruebas).
import { spriteFrame, FW, FH } from '../art/sprite2d.js';
import { EASE } from './timeline.js';

export const W2D = 320, H2D = 180;

// ---------- ayudas de color y azar ----------
const hex = (n) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
/** Tramado ordenado: ¿el píxel (x, y) va con el color b para una mezcla u (0..1)? */
export const dither = (x, y, u) => (BAYER[y & 3][x & 3] + 0.5) / 16 < u;

function canvas(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined' && !globalThis.document ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c, g };
}

// ---------- sprites de personajes ----------
const frameCache = new Map();
/** Canvas de un cuadro (con caché por look, animación, cuadro, giro y objeto). */
function frameOf(look, opts, anim, i, flip) {
  const key = JSON.stringify(look) + '|' + (opts.cls || '') + '|' + (opts.item || '') + '|' + anim + '|' + i + '|' + (flip ? 1 : 0);
  let c = frameCache.get(key);
  if (c) return c;
  const s = spriteFrame(look, anim, i, opts);
  const { c: cv, g } = canvas(FW, FH);
  const img = g.createImageData(FW, FH);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const v = s.px[y * FW + (flip ? FW - 1 - x : x)];
    if (!v) continue;
    const k = (y * FW + x) * 4;
    img.data[k] = (v >> 16) & 255; img.data[k + 1] = (v >> 8) & 255; img.data[k + 2] = v & 255; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  frameCache.set(key, cv);
  if (frameCache.size > 600) frameCache.delete(frameCache.keys().next().value);
  return cv;
}
// cuadros por animación (los de sprite2d.ANIMS) y su ritmo
const FPS = { idle: 2, walk: 8, attack: 9, hurt: 2, fall: 3, point: 3, lift: 3, give: 3 };
const FRAMES = { idle: 2, walk: 4, attack: 3, hurt: 1, fall: 2, point: 2, lift: 2, give: 2 };

// ---------- motor ----------
/**
 * Arma una viñeta vacía. build(v) le agrega capas, actores, utilería y el guion. o = { w, h, seed }.
 * El mundo se mide en píxeles; la cámara mira el punto (cam.x, cam.y) en el centro de la pantalla.
 */
export function vignette(build, o = {}) {
  const w = o.w || W2D, h = o.h || H2D;
  const { c, g } = canvas(w, h);
  const layers = [], actors = [], props = [], parts = [], cues = [], tweens = [];
  const cam = { x: w / 2, y: h / 2, zoom: 1, shake: 0 };
  let t = 0, rand = rng(o.seed || 7), cueIx = 0;
  const base = { cam: { ...cam } };

  const v = {
    canvas: c, w, h, cam, dur: o.dur || 8,
    get t() { return t; },
    /** Capa con paralaje: paint(g, W, H) se llama una vez sobre un canvas de W × H. k: 0 quieta … 1 con el mundo. */
    layer(k, paint, { width = w * 2, height = h, y = 0 } = {}) {
      const L = canvas(width, height);
      paint(L.g, width, height);
      layers.push({ k, cv: L.c, y, front: false });
      return v;
    },
    /** Capa de adelante (se dibuja sobre los actores). */
    front(k, paint, o2 = {}) { v.layer(k, paint, o2); layers[layers.length - 1].front = true; return v; },
    /** Capa animada: draw(g, t, cam) en cada cuadro, en coordenadas del mundo (sobre el piso, debajo de los actores). */
    live(draw, { front = false } = {}) { layers.push({ live: draw, front, k: 1 }); return v; },
    /** Actor con sprite: { look, opts, x, y (pies), flip, anim }. */
    actor(look, a = {}) {
      const A = { look, opts: a.opts || {}, x: a.x || 0, y: a.y || h - 30, flip: !!a.flip, anim: a.anim || 'idle', t0: 0, loop: a.loop ?? true, hold: null, visible: true, z: a.z || 0, dy: 0 };
      A.play = (anim, { loop = true, hold = null } = {}) => { A.anim = anim; A.t0 = t; A.loop = loop; A.hold = hold; return A; };
      actors.push(A);
      return A;
    },
    /** Utilería: draw(g, x, y, t) en el mundo; { x, y, visible, z }. */
    prop(draw, p = {}) { const P = { draw, x: p.x || 0, y: p.y || 0, visible: p.visible ?? true, z: p.z ?? 1, glow: p.glow || null }; props.push(P); return P; },
    /** Partículas: n de una vez en (x, y). kind: 'chispa' | 'polvo' | 'brillo'. */
    burst(kind, x, y, n = 10, o2 = {}) {
      for (let i = 0; i < n; i++) {
        const a = o2.angle ?? -Math.PI / 2, spread = o2.spread ?? Math.PI;
        const ang = a + (rand() - 0.5) * spread, sp = (o2.speed ?? 40) * (0.4 + rand() * 0.8);
        parts.push({ kind, x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: (o2.life ?? 0.7) * (0.6 + rand() * 0.6), age: 0, color: o2.color ?? (kind === 'polvo' ? 0x6a5a4c : kind === 'brillo' ? 0xbfefff : 0xffd27a), grav: o2.grav ?? (kind === 'polvo' ? -10 : kind === 'brillo' ? -14 : 120) });
      }
    },
    /** Tween de números de un objeto: v.tween(actor, { x: 120 }, { at, dur, ease }). */
    tween(obj, to, { at = t, dur = 1, ease = 'smooth' } = {}) {
      tweens.push({ obj, to, from: null, at, dur, ease: EASE[ease] || EASE.smooth });
      return v;
    },
    /** Paso del guion en el segundo `at`. */
    at(time, fn) { cues.push({ at: time, fn }); cues.sort((a, b) => a.at - b.at); return v; },
    shake(px = 2) { cam.shake = Math.max(cam.shake, px); },
    rand: () => rand(),
  };

  function step(dt) {
    t += dt;
    while (cueIx < cues.length && cues[cueIx].at <= t) { try { cues[cueIx].fn(v, t); } catch (e) { console.warn('[viñeta]', e); } cueIx++; }
    for (const tw of tweens) {
      if (t < tw.at) continue;
      if (!tw.from) tw.from = Object.fromEntries(Object.keys(tw.to).map(k => [k, tw.obj[k]]));
      const u = tw.ease(Math.min(1, (t - tw.at) / Math.max(1e-6, tw.dur)));
      for (const k in tw.to) tw.obj[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * u;
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age > p.life) { parts.splice(i, 1); continue; }
      p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - Math.min(1, dt * 2);
    }
    cam.shake = Math.max(0, cam.shake - dt * 10);
  }
  function reset() {
    t = 0; cueIx = 0; rand = rng(o.seed || 7);
    parts.length = 0;
    for (const tw of tweens) tw.from = null;
    Object.assign(cam, base.cam);
    for (const A of actors) Object.assign(A, A._base);
    for (const P of props) Object.assign(P, P._base);
  }

  function draw() {
    const z = Math.max(1, Math.round(cam.zoom));
    // temblor en píxeles enteros (en pantalla); sin él si el sistema pide menos movimiento
    const reduce = typeof document !== 'undefined' && document.documentElement.classList.contains('reduce-motion');
    const sh = reduce ? 0 : Math.round(cam.shake);
    const jx = sh ? Math.round((rand() - 0.5) * 2 * sh) : 0, jy = sh ? Math.round((rand() - 0.5) * 2 * sh) : 0;
    // origen: el punto de cámara al centro, en píxeles enteros
    const ox = Math.round(w / 2 - cam.x * z) + jx, oy = Math.round(h / 2 - cam.y * z) + jy;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#050506'; g.fillRect(0, 0, w, h);
    const drawLayers = (front) => {
      for (const L of layers) {
        if (L.front !== front) continue;
        if (L.live) { g.setTransform(z, 0, 0, z, ox, oy); L.live(g, t, cam); continue; }
        // paralaje: la capa se corre una fracción k de lo que se movió la cámara desde el centro
        const px = Math.round(w / 2 - (cam.x * L.k + (w / 2) * (1 - L.k)) * z) + jx;
        const py = Math.round(h / 2 - (cam.y * L.k + (h / 2) * (1 - L.k)) * z) + jy + L.y * z;
        g.setTransform(z, 0, 0, z, px, py);
        g.drawImage(L.cv, 0, 0);
      }
    };
    drawLayers(false);
    g.setTransform(z, 0, 0, z, ox, oy);
    // brillos de la utilería por detrás de todo lo que está en el piso
    for (const P of props) if (P.visible && P.glow) P.glow(g, Math.round(P.x), Math.round(P.y), t);
    const items = [...actors.filter(a => a.visible).map(a => ({ y: a.y + a.z, a })), ...props.filter(p => p.visible).map(p => ({ y: p.y + p.z, p }))].sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.a) {
        const A = it.a, n = FRAMES[A.anim] || 1, fps = FPS[A.anim] || 4;
        let i = Math.floor((t - A.t0) * fps);
        i = A.hold != null && i >= n ? A.hold : A.loop ? ((i % n) + n) % n : Math.min(n - 1, i);
        const cv = frameOf(A.look, A.opts, A.anim, i, A.flip);
        g.drawImage(cv, Math.round(A.x - FW / 2), Math.round(A.y - FH + 2 + A.dy));
      } else it.p.draw(g, Math.round(it.p.x), Math.round(it.p.y), t);
    }
    for (const p of parts) {
      const a = 1 - p.age / p.life;
      if (p.kind === 'polvo' && !dither(Math.round(p.x), Math.round(p.y), a)) continue;
      g.fillStyle = hex(p.kind === 'chispa' && a < 0.4 ? 0xc0602a : p.color);
      g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    drawLayers(true);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  build(v);
  v.dur = o.dur || v.dur;
  // estado de partida de cada actor y objeto, para seek()
  for (const A of actors) A._base = { x: A.x, y: A.y, flip: A.flip, anim: A.anim, t0: 0, loop: A.loop, hold: A.hold, visible: A.visible, dy: A.dy };
  for (const P of props) P._base = { x: P.x, y: P.y, visible: P.visible };
  base.cam = { ...cam };

  // (defineProperties y no Object.assign: assign leería el getter una sola vez)
  return Object.defineProperties(v, Object.getOwnPropertyDescriptors({
    update(dt) { step(Math.min(dt, 0.05)); },
    draw,
    /** Rearma el instante s (pasos de 1/30 desde el principio; en 0 corre lo que arranca en 0). */
    seek(s) { reset(); step(0); while (t < s - 1e-6) step(Math.min(1 / 30, s - t)); },
    get state() { return { t, cam: { ...cam }, actors: actors.map(a => ({ x: Math.round(a.x), y: Math.round(a.y), anim: a.anim, flip: a.flip })), props: props.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), visible: p.visible })), parts: parts.length }; },
    dispose() { layers.length = 0; actors.length = 0; props.length = 0; parts.length = 0; },
  }));
}

// ---------- pinceles para fondos ----------
/** Bandas de cielo con tramado entre colores (arriba → abajo). */
export function skyBands(g, W, H, colors) {
  const n = colors.length - 1;
  for (let y = 0; y < H; y++) {
    const f = (y / (H - 1)) * n, i = Math.min(n - 1, Math.floor(f)), u = f - i;
    for (let x = 0; x < W; x++) { g.fillStyle = hex(dither(x, y, u) ? colors[i + 1] : colors[i]); g.fillRect(x, y, 1, 1); }
  }
}
/** Siluetas de techos: alturas por tramos, ventanas encendidas al azar. */
export function rooftops(g, W, H, { base, color, lit = 0xe8b860, seed = 3, min = 20, max = 50, windows = 0.06 }) {
  const r = rng(seed);
  let x = 0;
  while (x < W) {
    const bw = 14 + Math.floor(r() * 26), bh = min + Math.floor(r() * (max - min));
    const top = base - bh;
    g.fillStyle = hex(color);
    g.fillRect(x, top, bw, H - top);
    // techo a dos aguas o chimenea
    if (r() < 0.5) for (let k = 0; k < bw / 2; k++) g.fillRect(x + k, top - Math.floor(k / 2), bw - 2 * k, 1);
    else g.fillRect(x + 3 + Math.floor(r() * (bw - 6)), top - 5, 3, 5);
    for (let wy = top + 4; wy < base - 4; wy += 6) for (let wx = x + 3; wx < x + bw - 3; wx += 5) if (r() < windows) { g.fillStyle = hex(lit); g.fillRect(wx, wy, 2, 2); }
    x += bw + Math.floor(r() * 3);
  }
}
/** Empedrado: filas de piedras de 6–9 px con junta oscura. */
export function cobbles(g, x0, y0, W, H, { stone = [0x3a3836, 0x42403d, 0x4a4744], joint = 0x24221f, seed = 5 } = {}) {
  const r = rng(seed);
  g.fillStyle = hex(joint); g.fillRect(x0, y0, W, H);
  for (let y = y0; y < y0 + H; y += 4) {
    let x = x0 - Math.floor(r() * 6);
    while (x < x0 + W) {
      const sw = 5 + Math.floor(r() * 4);
      g.fillStyle = hex(stone[Math.floor(r() * stone.length)]);
      g.fillRect(x + 1, y + 1, sw - 1, 3);
      g.fillStyle = hex(0x5a5650); g.fillRect(x + 1, y + 1, sw - 2, 1);
      x += sw;
    }
  }
}
/** Halo tramado alrededor de un punto (brillo del cristal, un farol). */
export function halo(g, x, y, r, color, strength = 1) {
  g.fillStyle = hex(color);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const d = Math.hypot(dx, dy) / r;
    if (d > 1) continue;
    if (dither(x + dx, y + dy, (1 - d) * (1 - d) * 0.7 * strength)) g.fillRect(x + dx, y + dy, 1, 1);
  }
}
/** Dibuja filas de caracteres con una paleta { ch: 0xRRGGBB }. */
export function pixels(g, x, y, rowsIn, pal) {
  rowsIn.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c == null) continue; g.fillStyle = hex(c); g.fillRect(x + i, y + j, 1, 1); } });
}

// ---------- viñetas ----------
export const VIGNETTES = {};
export function defineVignette(id, build, o = {}) { VIGNETTES[id] = { build, o }; }
/** Crea la viñeta id (VIGNETTES). */
export function createVignette(id, o = {}) {
  const V = VIGNETTES[id];
  if (!V) throw new Error('No hay viñeta ' + id);
  return vignette(V.build, { ...V.o, ...o });
}

// Cristal de veta (Céfiro): rombo que late, con halo. Lo usa la demostración del forcejeo.
const CRYSTAL = ['..a..', '.abA.', 'abbcA', '.bcA.', '..A..'];
const CRYSTAL_PAL = { a: 0xeaffff, b: 0xa8e4f4, c: 0x6cc0dc, A: 0x3e8aa8 };
export function crystalProp(v, x, y) {
  return v.prop((g, X, Y, t) => pixels(g, X - 2, Y - 4 + Math.round(Math.sin(t * 5) * 0.6), CRYSTAL, CRYSTAL_PAL), {
    x, y, z: 6, glow: (g, X, Y, t) => halo(g, X, Y - 2, 12, 0x5fb4d0, 0.8 + 0.2 * Math.sin(t * 4)),
  });
}


/** Fondo de noche frente al depósito de las Casas (cielo con luna, techos, muro, portón roto, farol). Lo usan el
 * forcejeo y el robo de El Quiebre (src/cinema/vignettes-intro.js). */
export function depotNight(v, GROUND = 150) {
  // cielo con luna
  v.layer(0, (g, W, H) => {
    skyBands(g, W, H, [0x05070d, 0x0a0f1d, 0x141c33, 0x223050, 0x2e3a58]);
    const r = rng(11);
    for (let i = 0; i < 70; i++) { g.fillStyle = r() < 0.2 ? '#cfd8ee' : '#6a7896'; g.fillRect(Math.floor(r() * W), Math.floor(r() * H * 0.6), 1, 1); }
    halo(g, 253, 21, 16, 0x2c3854, 1);
    pixels(g, 250, 18, ['..aaa..', '.abbba.', 'abbbbca', 'abbbcca', 'abbbcca', '.abcca.', '..aaa..'], { a: 0x8a93a8, b: 0xe8e4d4, c: 0xb8b4a8 });
  }, { width: 320 });
  // techos lejanos
  v.layer(0.3, (g, W, H) => rooftops(g, W, H, { base: 120, color: 0x182036, seed: 4, min: 30, max: 62, windows: 0.05 }), { width: 480, height: 220 });
  v.layer(0.55, (g, W, H) => rooftops(g, W, H, { base: 120, color: 0x222a40, seed: 9, min: 12, max: 34, windows: 0.08 }), { width: 560, height: 220 });
  // el depósito: muro de piedra, portón roto y un farol en la pared
  v.layer(1, (g, W, H) => {
    const r = rng(21);
    const TOP = 96;
    for (let y = TOP; y < GROUND; y++) for (let x = 0; x < W; x++) {
      const row = Math.floor((y - TOP) / 6), off = row % 2 ? 6 : 0, joint = (y - TOP) % 6 === 0 || (x + off) % 12 === 0;
      g.fillStyle = joint ? '#24262c' : r() < 0.12 ? '#3c3e46' : '#33353c';
      g.fillRect(x, y, 1, 1);
    }
    g.fillStyle = '#2a2c33'; g.fillRect(0, TOP - 4, W, 4); g.fillStyle = '#3c3e46'; g.fillRect(0, TOP - 4, W, 1);   // coronamiento
    for (let x = 0; x < W; x += 10) { g.fillStyle = '#2a2c33'; g.fillRect(x, TOP - 8, 5, 4); }   // almenas
    // portón de madera abierto (hueco oscuro con una hoja caída)
    g.fillStyle = '#0c0b0d'; g.fillRect(110, 108, 40, GROUND - 108);
    g.fillStyle = '#4a3624'; g.fillRect(106, 104, 48, 4); g.fillRect(106, 104, 4, GROUND - 104); g.fillRect(150, 104, 4, GROUND - 104);
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#5a4430' : '#4a3624'; g.fillRect(114 + k * 5, 132 + Math.floor(k / 2), 5, 18 - Math.floor(k / 2)); }
    // cajones con cristales que se cayeron
    pixels(g, 200, 136, ['wwwwwwww', 'wWWwwWWw', 'w.cc..cw', 'wWWwwWWw', 'wwwwwwww'], { w: 0x4a3624, W: 0x5a4430, c: 0x6cc0dc });
    pixels(g, 80, 140, ['wwwwww', 'wWWWWw', 'w.cc.w', 'wwwwww'], { w: 0x4a3624, W: 0x5a4430, c: 0x6cc0dc });
    // estandarte de una Casa
    for (const bx of [62, 252]) {
      g.fillStyle = '#4a1a18'; g.fillRect(bx, 98, 12, 26); g.fillStyle = '#7a2e2a'; g.fillRect(bx + 1, 98, 10, 24);
      g.fillStyle = '#4a1a18'; g.fillRect(bx + 1, 122, 4, 2); g.fillRect(bx + 7, 122, 4, 2);
      pixels(g, bx + 3, 105, ['..b..', '.bbb.', 'bb.bb', '.bbb.', '..b..'], { b: 0xb8923e });
    }
    cobbles(g, 0, GROUND, W, H - GROUND, { seed: 6 });
  }, { width: 400, height: 230 });
  // farol de pared que titila (encima del muro, debajo de los actores)
  v.live((g, t) => {
    const k = 0.75 + 0.25 * Math.sin(t * 13) * Math.sin(t * 7.3);
    halo(g, 90, 112, 11, 0x9a6a30, k * 0.8);
    pixels(g, 87, 106, ['.k.', 'kyk', 'yjy', 'kkk'], { k: 0x1a1614, y: 0xf3d58a, j: 0xe0a040 });
  });
  // frente: un poste y un barril en las puntas, oscuros
  v.front(1.25, (g, W, H) => {
    g.fillStyle = '#08080a';
    g.fillRect(8, 40, 7, H); g.fillRect(4, 40, 15, 4);
    g.fillRect(W - 60, 148, 22, 32); g.fillRect(W - 62, 152, 26, 4); g.fillRect(W - 62, 166, 26, 3);
  }, { width: 460 });

}

/**
 * Demostración: el forcejeo del robo. De noche, frente al depósito de las Casas: alguien sale con un cristal de veta,
 * un guardia le cierra el paso, forcejean, el cristal cambia de mano y quien robaba cae. ~8 s.
 */
defineVignette('forcejeo', (v) => {
  const GROUND = 150;
  depotNight(v, GROUND);

  // quien roba (capucha, con el cristal) y un guardia de las Casas (casco y tabardo rojo; sin espada: así no aparece y
  // desaparece un arma entre los gestos)
  const thief = v.actor({ type: 'zorro', build: 'esbelto', skin: 0, hair: 'coleta', hairColor: 'blanco', face: 'ninguna', dress: 'cuero', dressColor: 'negro', crown: 'capucha', acc: 'ninguno' },
    { x: 130, y: GROUND + 2, opts: { item: 'veta' } });
  const guard = v.actor({ type: 'humano', build: 'recio', skin: 2, hair: 'corto', hairColor: 'negro', face: 'ninguna', dress: 'tabardo', dressColor: 'rojo', crown: 'casco', acc: 'ninguno' },
    { x: 300, y: GROUND + 2, flip: true });
  // el cristal suelto se dibuja encima de las manos (z alto)
  const crystal = crystalProp(v, 158, GROUND - 14);
  crystal.visible = false; crystal.z = 40;

  v.cam.x = 156; v.cam.y = 116; v.cam.zoom = 2;
  // 0 s: sale del portón con el cristal en alto; el guardia llega por la derecha y la señala
  v.at(0, () => { thief.play('lift', { loop: false, hold: 1 }); guard.play('walk'); });
  v.tween(guard, { x: 214 }, { at: 0, dur: 1.6, ease: 'out' });
  v.tween(v.cam, { x: 192 }, { at: 0.3, dur: 1.5, ease: 'inOut' });
  v.at(1.6, () => { guard.play('point', { loop: false, hold: 1 }); });
  // 2,1 s: quien roba baja el cristal a la mano y avanza; el guardia le sale al cruce; la cámara se acerca
  v.at(2.1, () => { thief.play('walk'); crystal.visible = true; crystal.x = thief.x + 12; crystal.y = GROUND - 15; });
  v.tween(thief, { x: 172 }, { at: 2.1, dur: 0.7, ease: 'out' });
  v.tween(crystal, { x: 184 }, { at: 2.1, dur: 0.7, ease: 'out' });
  v.tween(guard, { x: 196 }, { at: 2.2, dur: 0.6, ease: 'out' });
  v.tween(v.cam, { x: 184, y: 126, zoom: 3 }, { at: 2.2, dur: 0.6, ease: 'inOut' });
  // 2,8–4,5 s: el tironeo. Los dos con el brazo estirado sobre el cristal (24 px entre uno y otro: no se pisan) y van
  // juntos de un lado al otro; en cada tirón, chispas y un temblor
  v.at(2.8, () => { thief.play('point', { loop: false, hold: 1 }); guard.play('point', { loop: false, hold: 1 }); });
  [[3.0, -4], [3.35, 5], [3.7, -4], [4.05, 4], [4.4, -1]].forEach(([at, d], i) => {
    const base = [172, 196, 184];
    v.tween(thief, { x: base[0] + d }, { at, dur: 0.25, ease: 'inOut' });
    v.tween(guard, { x: base[1] + d }, { at, dur: 0.25, ease: 'inOut' });
    v.tween(crystal, { x: base[2] + d, y: GROUND - 15 - (i % 2) }, { at, dur: 0.25, ease: 'inOut' });
    v.at(at + 0.2, (vv) => { vv.shake(1); vv.burst('chispa', base[2] + d, GROUND - 17, 4, { speed: 30, life: 0.4 }); });
  });
  // 4,6 s: el guardia la empuja; el cristal salta por encima de las cabezas y cae en su mano; quien robaba cae
  v.at(4.6, (vv) => { guard.play('attack', { loop: false, hold: 2 }); thief.play('hurt'); vv.shake(3); vv.burst('brillo', 183, GROUND - 18, 12, { speed: 30, life: 0.9 }); });
  v.tween(crystal, { x: 186, y: GROUND - 46 }, { at: 4.65, dur: 0.35, ease: 'out' });
  v.tween(crystal, { x: 184, y: GROUND - 17 }, { at: 5.0, dur: 0.35, ease: 'in' });
  v.tween(thief, { x: 158 }, { at: 4.7, dur: 0.5, ease: 'out' });
  v.at(5.15, (vv) => { thief.play('fall', { loop: false, hold: 1 }); vv.burst('polvo', 154, GROUND + 1, 16, { speed: 22, spread: Math.PI * 0.9, life: 1.1 }); vv.shake(2); });
  v.at(5.35, (vv) => { guard.play('point', { loop: false, hold: 1 }); vv.burst('brillo', 184, GROUND - 18, 6, { speed: 12, life: 0.5 }); });
  // 5,7 s: lo levanta; la cámara se abre
  v.at(5.7, () => { crystal.visible = false; guard.opts = { item: 'veta' }; guard.play('lift', { loop: false, hold: 1 }); });
  v.tween(v.cam, { x: 182, y: 118, zoom: 2 }, { at: 5.9, dur: 1.2, ease: 'inOut' });
  v.at(6.5, (vv) => vv.burst('brillo', 199, GROUND - 36, 10, { speed: 14, life: 1.4 }));
}, { dur: 8, seed: 12 });
