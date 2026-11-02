// Joyas Reales — sprites pixel-art dibujados por código (con volumen: bisel claro arriba-izquierda,
// sombra abajo-derecha, brillo especular y contorno). Todo se genera una vez y se cachea.
import { ROWS, COLS, RAINBOW } from './match3-engine.js';

export const CELL = 18;          // px de arte por celda
export const MARGIN = 8;         // marco alrededor del tablero
export const ART = COLS * CELL + MARGIN * 2; // 160

// rampas de color: [más oscuro, oscuro, medio, claro, brillo] + contorno
export const GEMS = [
  { name: 'corazón', ramp: ['#b8286e', '#e8509a', '#ff7eb6', '#ffc2dc', '#fff4f9'], line: '#6e1440', fx: '#ff7eb6' },
  { name: 'corona', ramp: ['#c27a1c', '#eba33a', '#ffd166', '#ffeaa6', '#fffbea'], line: '#7a4a10', fx: '#ffd166' },
  { name: 'diamante', ramp: ['#2f7fc4', '#56aeea', '#8fd3ff', '#cdeeff', '#ffffff'], line: '#1d4b80', fx: '#8fd3ff' },
  { name: 'estrella', ramp: ['#6a3fc0', '#9268ee', '#b58cff', '#ddcbff', '#fbf7ff'], line: '#3c2178', fx: '#b58cff' },
  { name: 'flor', ramp: ['#25987a', '#40c49c', '#6fe3c1', '#bdf5e4', '#f3fffb'], line: '#155e4b', fx: '#6fe3c1' },
  { name: 'moño', ramp: ['#c8462a', '#ee6d45', '#ff9a6b', '#ffcfb3', '#fff6ef'], line: '#7c2614', fx: '#ff9a6b' },
];
const GOLD_RAMP = ['#c27a1c', '#eba33a', '#ffd166', '#ffeaa6', '#fffbea'];
const INK = '#3b2340';

// ---------- utilidades de geometría ----------
function inPoly(x, y, pts) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
const circ = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const mirror = pts => pts.map(([x, y]) => [-x, y]);

// Cada forma: (u, v) en [-1,1] (v hacia abajo) -> región (-1 afuera). regions: {id: {ramp, off, group}}
const SHAPES = [
  // 0 corazón
  {
    fn(u, v) {
      if (circ(u, v, -0.46, -0.34, 0.52) || circ(u, v, 0.46, -0.34, 0.52)) return 0;
      return inPoly(u, v, [[-0.95, -0.16], [0.95, -0.16], [0.1, 0.86], [0, 0.94], [-0.1, 0.86]]) ? 0 : -1;
    },
  },
  // 1 corona
  {
    fn(u, v) {
      if (circ(u, v, -0.8, -0.62, 0.2) || circ(u, v, 0, -0.84, 0.2) || circ(u, v, 0.8, -0.62, 0.2)) return 1;
      if (v >= 0.2 && v <= 0.82 && Math.abs(u) <= 0.88) {
        if (circ(u, v, 0, 0.5, 0.2)) return 2;
        if (circ(u, v, -0.52, 0.5, 0.15) || circ(u, v, 0.52, 0.5, 0.15)) return 3;
        return 0;
      }
      if (inPoly(u, v, [[-0.88, 0.25], [-0.88, -0.52], [-0.42, -0.06], [0, -0.72], [0.42, -0.06], [0.88, -0.52], [0.88, 0.25]])) return 0;
      return -1;
    },
    regions: { 1: { off: 0.5, group: 1 }, 2: { ramp: GEMS[0].ramp, off: 0.2, group: 2 }, 3: { ramp: GEMS[2].ramp, off: 0.2, group: 3 } },
  },
  // 2 diamante (con facetas)
  {
    fn(u, v) {
      const pts = [[-0.56, -0.72], [0.56, -0.72], [0.98, -0.2], [0, 0.98], [-0.98, -0.2]];
      if (!inPoly(u, v, pts)) return -1;
      if (v < -0.2) return Math.abs(u) < 0.34 ? 1 : 2; // mesa y corona
      // pabellón: faceta central
      const k = (v + 0.2) / 1.18; // 0 en cinturón, 1 en punta
      return Math.abs(u) < 0.42 * (1 - k) ? 3 : 0;
    },
    regions: { 1: { off: 0.45, group: 0 }, 2: { off: 0.2, group: 0 }, 3: { off: 0.12, group: 0 } },
  },
  // 3 estrella
  {
    fn(u, v) {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.56 : 1.1;
        pts.push([Math.cos(a) * r, Math.sin(a) * r + 0.12]);
      }
      return inPoly(u, v, pts) ? 0 : -1;
    },
  },
  // 4 flor
  {
    fn(u, v) {
      if (circ(u, v, 0, 0.06, 0.3)) return 1;
      let best = -1, bd = 9;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const px = Math.cos(a) * 0.6, py = Math.sin(a) * 0.6 + 0.06;
        const d = (u - px) ** 2 + (v - py) ** 2;
        if (d <= 0.45 * 0.45 && d < bd) { bd = d; best = i === 0 ? 0 : 10 + i; }
      }
      return best;
    },
    regions: { 1: { ramp: GOLD_RAMP, off: 0.15, group: 1, edge: true }, 11: { group: 11 }, 12: { group: 12 }, 13: { group: 13 }, 14: { group: 14 } },
  },
  // 5 moño
  {
    fn(u, v) {
      if (Math.abs(u) <= 0.24 && Math.abs(v + 0.08) <= 0.3) return 1;
      const loopR = [[0.1, -0.08], [0.55, -0.72], [0.92, -0.6], [1.0, -0.1], [0.92, 0.42], [0.55, 0.52]];
      if (inPoly(u, v, loopR) || inPoly(u, v, mirror(loopR))) return 0;
      const tailR = [[0.05, 0.1], [0.42, 0.95], [0.68, 0.78], [0.22, 0.05]];
      if (inPoly(u, v, tailR) || inPoly(u, v, mirror(tailR))) return 2;
      return -1;
    },
    regions: { 1: { off: 0.3, group: 1 }, 2: { off: -0.1, group: 2 } },
  },
];

/**
 * Rasteriza una forma con sombreado. Devuelve un canvas size×size.
 * opts: { size, cx, cy, rad, stripes: 'h'|'v'|null, shadow }
 */
function rasterGem(type, opts = {}) {
  const size = opts.size || CELL;
  const cx = opts.cx ?? size / 2, cy = opts.cy ?? size / 2 - 0.5, rad = opts.rad ?? 7.1;
  const gem = GEMS[type], shape = SHAPES[type];
  const W = size;
  const reg = new Int8Array(W * W).fill(-1);
  // 1) muestreo 4x4 por pixel, mayoría
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const counts = {};
    let inside = 0;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const u = (x + (sx + 0.5) / 4 - cx) / rad, v = (y + (sy + 0.5) / 4 - cy) / rad;
      const r = shape.fn(u, v);
      if (r >= 0) { inside++; counts[r] = (counts[r] || 0) + 1; }
    }
    if (inside >= 8) {
      let best = -1, bc = -1;
      for (const k in counts) if (counts[k] > bc) { bc = counts[k]; best = +k; }
      reg[y * W + x] = best;
    }
  }
  const info = r => ({ ramp: gem.ramp, off: 0, group: 0, ...(shape.regions?.[r] || {}) });
  const groupOf = i => (reg[i] < 0 ? -1 : info(reg[i]).group);
  // 2) distancia al borde del propio grupo
  const dist = new Float32Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (reg[i] < 0) continue;
    const g = groupOf(i);
    let best = 5;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const xx = x + dx, yy = y + dy;
      const out = xx < 0 || yy < 0 || xx >= W || yy >= W || groupOf(yy * W + xx) !== g;
      if (out) { const d = Math.hypot(dx, dy); if (d < best) best = d; }
    }
    dist[i] = best;
  }
  const H = i => Math.min(dist[i], 2.6) / 2.6;
  // 3) colorear
  const cv = document.createElement('canvas');
  cv.width = cv.height = W;
  const g = cv.getContext('2d');
  const img = g.createImageData(W, W);
  const put = (i, hex, a = 255) => {
    const n = parseInt(hex.slice(1), 16);
    img.data[i * 4] = n >> 16; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = a;
  };
  const L = [-0.62, -0.78]; // luz desde arriba-izquierda
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (reg[i] < 0) continue;
    const inf = info(reg[i]);
    const hx = (x + 1 < W && reg[i + 1] >= 0 && groupOf(i + 1) === groupOf(i) ? H(i + 1) : 0) - (x > 0 && reg[i - 1] >= 0 && groupOf(i - 1) === groupOf(i) ? H(i - 1) : 0);
    const hy = (y + 1 < W && reg[i + W] >= 0 && groupOf(i + W) === groupOf(i) ? H(i + W) : 0) - (y > 0 && reg[i - W] >= 0 && groupOf(i - W) === groupOf(i) ? H(i - W) : 0);
    // normal ~ (-hx, -hy, k)
    const nx = -hx, ny = -hy, nz = 0.9;
    const nl = Math.hypot(nx, ny, nz);
    const lam = (nx * L[0] + ny * L[1]) / nl; // -1..1 aprox
    const u = (x + 0.5 - cx) / rad, v = (y + 0.5 - cy) / rad;
    let t = 0.5 + lam * 0.75 - (u + v) * 0.14 + inf.off * 0.6;
    let idx = t > 0.98 ? 4 : t > 0.68 ? 3 : t > 0.36 ? 2 : t > 0.12 ? 1 : 0;
    // brillo especular: un par de pixeles arriba-izquierda
    if (inf.group === 0 && dist[i] >= 1.5 && dist[i] < 2.6 && u + v < -0.95 && u > -0.85 && v > -0.85) idx = 4;
    let col = inf.ramp[idx];
    if (opts.stripes) {
      const k = opts.stripes === 'h' ? y : x;
      if (dist[i] >= 1 && (((k - Math.round(cy)) % 3) + 3) % 3 === 0) col = idx >= 3 ? '#ffffff' : inf.ramp[Math.min(4, idx + 2)];
    }
    put(i, col);
  }
  // 3b) línea entre regiones marcadas con edge (p.ej. centro de la flor)
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (reg[i] < 0 || info(reg[i]).edge) continue;
    const isEdge = j => reg[j] >= 0 && info(reg[j]).edge;
    if ((x > 0 && isEdge(i - 1)) || (x < W - 1 && isEdge(i + 1)) || (y > 0 && isEdge(i - W)) || (y < W - 1 && isEdge(i + W))) put(i, gem.ramp[0]);
  }
  // 4) contorno (4-vecinos) + sombra abajo
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (reg[i] >= 0) continue;
    const n = (x > 0 && reg[i - 1] >= 0) || (x < W - 1 && reg[i + 1] >= 0) || (y > 0 && reg[i - W] >= 0) || (y < W - 1 && reg[i + W] >= 0);
    if (n) put(i, gem.line);
  }
  if (opts.shadow !== false) {
    for (let y = W - 1; y >= 1; y--) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (img.data[i * 4 + 3] === 0 && img.data[(i - W) * 4 + 3] === 255) put(i, INK, 60);
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

// ---------- orbe arcoíris (animado) ----------
function rasterRainbow(phase) {
  const W = CELL, cx = W / 2, cy = W / 2 - 0.5, rad = 7.6;
  const cv = document.createElement('canvas');
  cv.width = cv.height = W;
  const g = cv.getContext('2d');
  const img = g.createImageData(W, W);
  const inside = new Uint8Array(W * W);
  const put = (i, hex, a = 255) => {
    const n = parseInt(hex.slice(1), 16);
    img.data[i * 4] = n >> 16; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = a;
  };
  const order = [0, 5, 1, 4, 2, 3];
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const u = (x + 0.5 - cx) / rad, v = (y + 0.5 - cy) / rad;
    const rr = u * u + v * v;
    if (rr > 1) continue;
    const i = y * W + x;
    inside[i] = 1;
    const z = Math.sqrt(1 - rr);
    const lam = -0.55 * u - 0.65 * v + 0.55 * z;
    // bandas diagonales que giran
    const band = Math.floor(((u * 0.8 + v * 1.0 + 2) * 2.2 + phase * 6) % 6 + 6) % 6;
    const ramp = GEMS[order[band]].ramp;
    let idx = lam > 0.78 ? 4 : lam > 0.45 ? 3 : lam > 0.1 ? 2 : lam > -0.2 ? 1 : 0;
    if (u < -0.2 && u > -0.62 && v < -0.25 && v > -0.62) idx = 4;
    put(i, ramp[idx]);
  }
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (inside[i]) continue;
    const n = (x > 0 && inside[i - 1]) || (x < W - 1 && inside[i + 1]) || (y > 0 && inside[i - W]) || (y < W - 1 && inside[i + W]);
    if (n) put(i, INK);
  }
  for (let y = W - 1; y >= 1; y--) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (img.data[i * 4 + 3] === 0 && img.data[(i - W) * 4 + 3] === 255) put(i, INK, 60);
  }
  g.putImageData(img, 0, 0);
  return cv;
}

// ---------- bomba: medallón brillante con la joya más chica encima ----------
function rasterBomb(type, frame) {
  const W = CELL;
  const cv = document.createElement('canvas');
  cv.width = cv.height = W;
  const g = cv.getContext('2d');
  const gem = GEMS[type];
  const img = g.createImageData(W, W);
  const put = (i, hex, a = 255) => {
    const n = parseInt(hex.slice(1), 16);
    img.data[i * 4] = n >> 16; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = a;
  };
  const cx = W / 2, cy = W / 2 - 0.5, R = 8.3;
  const inside = new Uint8Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    if (d > R) continue;
    const i = y * W + x;
    inside[i] = 1;
    const ang = Math.atan2(dy, dx);
    if (d > R - 1.6) {
      // aro de puntitos que giran
      const k = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 16 + frame) % 2;
      put(i, k ? '#ffffff' : gem.ramp[3]);
    } else {
      const lam = (-dx * 0.6 - dy * 0.75) / R;
      put(i, lam > 0.25 ? gem.ramp[3] : lam > -0.3 ? gem.ramp[2] : gem.ramp[1]);
    }
  }
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (inside[i]) continue;
    const n = (x > 0 && inside[i - 1]) || (x < W - 1 && inside[i + 1]) || (y > 0 && inside[i - W]) || (y < W - 1 && inside[i + W]);
    if (n) put(i, gem.line);
  }
  g.putImageData(img, 0, 0);
  const small = rasterGem(type, { size: W, rad: 5.0, cy: W / 2 - 0.5, shadow: false });
  // sombrita debajo de la joya
  const sh = document.createElement('canvas');
  sh.width = sh.height = W;
  const sg = sh.getContext('2d');
  sg.drawImage(small, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = gem.ramp[0];
  sg.fillRect(0, 0, W, W);
  g.globalAlpha = 0.6; g.drawImage(sh, 0, 1); g.globalAlpha = 1;
  g.drawImage(small, 0, 0);
  return cv;
}

// ---------- caché ----------
let cache = null;
export function sprites() {
  if (cache) return cache;
  cache = {
    gem: GEMS.map((_, t) => rasterGem(t)),
    h: GEMS.map((_, t) => rasterGem(t, { stripes: 'h' })),
    v: GEMS.map((_, t) => rasterGem(t, { stripes: 'v' })),
    bomb: GEMS.map((_, t) => [rasterBomb(t, 0), rasterBomb(t, 1)]),
    rainbow: Array.from({ length: 12 }, (_, i) => rasterRainbow(i / 12)),
    ice: [null, iceTile(1), iceTile(2)],
    white: GEMS.map((_, t) => whiteOf(rasterGem(t))),
  };
  return cache;
}
/** sprite para una gema {type, special}; t = tiempo en segundos (anima arcoíris y bombas) */
export function gemSprite(gem, t = 0) {
  const s = sprites();
  if (gem.special === 'rainbow' || gem.type === RAINBOW) return s.rainbow[Math.floor(t * 10) % 12];
  if (gem.special === 'bomb') return s.bomb[gem.type][Math.floor(t * 6) % 2];
  if (gem.special === 'h') return s.h[gem.type];
  if (gem.special === 'v') return s.v[gem.type];
  return s.gem[gem.type];
}
function whiteOf(src) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const g = cv.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, cv.width, cv.height);
  return cv;
}

function iceTile(level) {
  const W = CELL;
  const cv = document.createElement('canvas');
  cv.width = cv.height = W;
  const g = cv.getContext('2d');
  g.fillStyle = level === 2 ? 'rgba(170,224,255,0.62)' : 'rgba(205,238,255,0.42)';
  g.fillRect(1, 1, W - 2, W - 2);
  // bordes con volumen
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.fillRect(1, 1, W - 2, 1); g.fillRect(1, 1, 1, W - 2);
  g.fillStyle = level === 2 ? '#5aa7e0' : '#86c5ef';
  g.fillRect(1, W - 2, W - 2, 1); g.fillRect(W - 2, 1, 1, W - 2);
  // reflejos
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillRect(3, 3, 3, 1); g.fillRect(3, 4, 1, 2); g.fillRect(W - 6, W - 4, 2, 1);
  g.fillRect(W - 5, 4, 1, 1); g.fillRect(4, W - 5, 1, 1);
  if (level === 2) {
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.fillRect(2, 2, W - 4, 1); g.fillRect(2, 2, 1, W - 4);
    // copitos
    for (const [x, y] of [[12, 5], [6, 12], [11, 11]]) { g.fillRect(x, y - 1, 1, 3); g.fillRect(x - 1, y, 3, 1); }
    g.fillStyle = '#3f86c4';
    g.fillRect(0, 0, W, 1); g.fillRect(0, W - 1, W, 1); g.fillRect(0, 0, 1, W); g.fillRect(W - 1, 0, 1, W);
  } else {
    g.fillStyle = '#9fd3f5';
    g.fillRect(1, 0, W - 2, 1); g.fillRect(1, W - 1, W - 2, 1); g.fillRect(0, 1, 1, W - 2); g.fillRect(W - 1, 1, 1, W - 2);
  }
  return cv;
}

/** Ícono (dataURL) de una gema para la UI, escalado sin suavizado. */
const iconCache = new Map();
export function gemIconUrl(type, px = 36) {
  const k = type + ':' + px;
  if (iconCache.has(k)) return iconCache.get(k);
  const src = type === 'ice' ? iceIconCanvas() : (type === RAINBOW ? sprites().rainbow[0] : sprites().gem[type]);
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, px, px);
  const url = cv.toDataURL();
  iconCache.set(k, url);
  return url;
}
function iceIconCanvas() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = CELL;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff8fd'; g.fillRect(1, 1, CELL - 2, CELL - 2);
  g.drawImage(sprites().gem[2], 0, 0);
  g.drawImage(sprites().ice[2], 0, 0);
  return cv;
}

// ---------- tablero: celdas a cuadros + marco dorado/rosa que sigue la forma ----------
export function buildBoard(mask) {
  const W = ART;
  const cv = document.createElement('canvas');
  cv.width = cv.height = W;
  const g = cv.getContext('2d');
  const img = g.createImageData(W, W);
  const region = new Uint8Array(W * W);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (!mask[r][c]) continue;
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) region[(MARGIN + r * CELL + y) * W + MARGIN + c * CELL + x] = 1;
  }
  const put = (i, hex, a = 255) => {
    const n = parseInt(hex.slice(1), 16);
    img.data[i * 4] = n >> 16; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = a;
  };
  // celdas
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (!mask[r][c]) continue;
    const base = (r + c) % 2 ? '#f6e7fb' : '#fff9fd';
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      const px = MARGIN + c * CELL + x, py = MARGIN + r * CELL + y;
      const i = py * W + px;
      let col = base;
      // sombra interior junto al marco (arriba/izquierda)
      const up = !region[(py - 1) * W + px] || (y < 2 && !region[(py - 2) * W + px]);
      const left = !region[py * W + px - 1] || (x < 2 && !region[py * W + px - 2]);
      if (up || left) col = '#e9d3f2';
      put(i, col);
    }
  }
  // marco: distancia euclídea al tablero
  const R = 7;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (region[i]) continue;
    let best = 99, bdx = 0, bdy = 0;
    for (let dy = -R; dy <= R; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= W) continue;
      for (let dx = -R; dx <= R; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= W || !region[yy * W + xx]) continue;
        const d = dx * dx + dy * dy;
        if (d < best) { best = d; bdx = dx; bdy = dy; }
      }
    }
    if (best === 99) continue;
    const d = Math.sqrt(best);
    // dirección hacia afuera del tablero (-bdx, -bdy). Luz arriba-izquierda.
    const lit = (bdx + bdy) / (Math.abs(bdx) + Math.abs(bdy) || 1); // >0 = pixel arriba/izquierda del tablero
    let col = null;
    if (d <= 1.01) col = INK;
    else if (d <= 2.01) col = lit > 0.2 ? '#e8a93a' : '#fff0c2';
    else if (d <= 4.3) col = lit > 0.2 ? '#fff0c2' : lit < -0.2 ? '#e8a93a' : '#ffd166';
    else if (d <= 5.6) col = lit > 0.2 ? '#ffc2dc' : lit < -0.2 ? '#e0528f' : '#ff7eb6';
    else if (d <= 6.8) col = INK;
    if (col) put(i, col);
    // destellos sobre el dorado
    if (col && d > 2.6 && d <= 3.4 && (x * 7 + y * 13) % 23 === 0) put(i, '#ffffff');
  }
  // sombra del marco abajo
  for (let y = W - 1; y >= 2; y--) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (img.data[i * 4 + 3] === 0 && img.data[(i - 2 * W) * 4 + 3] === 255 && !region[i - 2 * W]) put(i, INK, 50);
  }
  g.putImageData(img, 0, 0);
  // gemitas decorativas en las esquinas del contorno exterior
  const studs = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (!mask[r][c]) continue;
    const up = r === 0 || !mask[r - 1][c], dn = r === ROWS - 1 || !mask[r + 1][c];
    const lf = c === 0 || !mask[r][c - 1], rt = c === COLS - 1 || !mask[r][c + 1];
    const x0 = MARGIN + c * CELL, y0 = MARGIN + r * CELL;
    if (up && lf) studs.push([x0 - 4, y0 - 4]);
    if (up && rt) studs.push([x0 + CELL + 3, y0 - 4]);
    if (dn && lf) studs.push([x0 - 4, y0 + CELL + 3]);
    if (dn && rt) studs.push([x0 + CELL + 3, y0 + CELL + 3]);
  }
  for (const [x, y] of studs) drawStud(g, x, y);
  return cv;
}
function drawStud(g, x, y) {
  // rombo rosado 5x5 con brillo
  const P = [[0, -2, INK], [-1, -1, INK], [0, -1, '#ffc2dc'], [1, -1, INK], [-2, 0, INK], [-1, 0, '#ffc2dc'], [0, 0, '#ff7eb6'], [1, 0, '#e0528f'], [2, 0, INK],
    [-1, 1, INK], [0, 1, '#e0528f'], [1, 1, INK], [0, 2, INK]];
  for (const [dx, dy, c] of P) { g.fillStyle = c; g.fillRect(x + dx, y + dy, 1, 1); }
  g.fillStyle = '#ffffff'; g.fillRect(x, y - 1, 1, 1);
}
