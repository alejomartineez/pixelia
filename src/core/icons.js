// Íconos pixel-art nítidos a cualquier tamaño.
// Los principales están dibujados como capas (paths SVG en una grilla de 24): se pintan a N×N pixeles de
// arte con alfa binario (sin suavizado), se les pone bisel (claro arriba-izquierda, oscuro abajo-derecha)
// y contorno tinta de 1px, y se agrandan k veces (entero) hasta los pixeles físicos exactos del <img>.
// Así nunca hay interpolación ni pixeles deformados. Si el CSS muestra un ícono a otro tamaño que el
// pedido, un ResizeObserver lo regenera a ese tamaño. El resto sale de un emoji "pixelado" igual.
// Uso: icon('coin', 20) -> '<img class="pi" ...>'  |  iconUrl('gem', 32) -> dataURL

const INK = '#3d2f2a';
const C = {
  y: '#ffd166', Y: '#e8a93a', w: '#ffffff', p: '#ee8a5c', P: '#c8673d', s: '#8fd3ff', S: '#4fa8e0',
  l: '#7f9ee8', L: '#5a78c4', m: '#6fe3c1', M: '#3cbf9a', c: '#fdf6e3', g: '#ddd5c8', G: '#ada190',
  wood: '#c98a52', skin: '#ffd9b8', red: '#ff6b8a', paper: '#f6d9a8',
};

// ---------- formas ----------
const f = n => +n.toFixed(2);
const circ = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}a${r} ${r} 0 1 0 ${f(2 * r)} 0a${r} ${r} 0 1 0 ${f(-2 * r)} 0z`;
function starPath(cx, cy, ro, ri, n = 5) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? ri : ro;
    d += (i ? 'L' : 'M') + f(cx + Math.cos(a) * r) + ' ' + f(cy + Math.sin(a) * r);
  }
  return d + 'z';
}
function sparklePath(cx, cy, r) {
  const q = r * 0.16;
  return `M${cx} ${cy - r}Q${cx + q} ${cy - q} ${cx + r} ${cy}Q${cx + q} ${cy + q} ${cx} ${cy + r}Q${cx - q} ${cy + q} ${cx - r} ${cy}Q${cx - q} ${cy - q} ${cx} ${cy - r}z`;
}
function gearPath() {
  let d = circ(12, 12, 8.6);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
    const p = (r, w) => `${f(12 + ux * r + vx * w)} ${f(12 + uy * r + vy * w)}`;
    d += `M${p(6, -2.7)}L${p(11.6, -2.1)}L${p(11.6, 2.1)}L${p(6, 2.7)}z`;
  }
  return d;
}

// capa: { d, c, stroke?: ancho, bevel?: bool (default: sí en rellenos), cut?: borra, rule?: 'evenodd' }
const ly = (d, c, o = {}) => ({ d, c, ...o });
const flat = (d, c, o = {}) => ({ d, c, bevel: false, ...o });

/** Capas de un cofre con sus colores (lo usan los cofres de temporada/premios). */
export function chestLayers(base = C.wood, trim = C.g, lock = C.y) {
  return [
    ly('M2 11.5V8c0-3.3 2.2-5.3 5.5-5.3h9c3.3 0 5.5 2 5.5 5.3v3.5z', mix(base, '#ffffff', 0.18)),
    ly('M2 11h20v11H2z', base),
    flat('M2 11.4h20', INK, { stroke: 1.1 }),
    ly('M5 2.9h2.6V22H5zM16.4 2.9H19V22h-2.6z', trim),
    ly('M9.4 8.8h5.2v6.4H9.4z', lock),
    flat('M11.3 10.9h1.4v2.6h-1.4z', INK),
  ];
}

const DEFS = {
  coin: [ly(circ(12, 12, 10.6), C.y), flat(circ(12, 12, 7.2), C.Y, { stroke: 1.3 }), flat('M10.8 7.8h2.4v8.4h-2.4z', C.Y), flat('M6.4 7.2h1.6v3.2H6.4z', C.w)],
  gem: [
    ly('M6 3.5h12l5 6.5H1z', '#c4ecff'), ly('M1 10h22L12 22.5z', C.s),
    flat('M8.6 10.2L12 22M15.4 10.2L12 22M9 3.8l-1.4 6M15 3.8l1.4 6', C.S, { stroke: 1 }),
    flat('M4.6 9.2l3-4.4h2l-2.4 4.4z', C.w),
  ],
  star: [ly(starPath(12, 13, 11.6, 5.3), C.y), flat('M10.9 6.2h1.5v3.4h-1.5z', C.w)],
  starOff: [ly(starPath(12, 13, 11.6, 5.3), C.g), flat('M10.9 6.2h1.5v3.4h-1.5z', C.w)],
  heart: [ly('M12 21.8C6 17.4 1.4 13.4 1.4 8.2 1.4 4.6 3.9 2.4 7 2.4c2.2 0 4 1.3 5 3 1-1.7 2.8-3 5-3 3.1 0 5.6 2.2 5.6 5.8 0 5.2-4.6 9.2-10.6 13.6z', C.red), flat('M4.5 6h1.9v3.2H4.5z', C.w)],
  // 'crown' quedó como id histórico: ahora es una medalla con cinta (premios, récords, títulos)
  crown: [
    ly('M5.6 1.2h5l3.2 8.4H8.8z', C.s), ly('M18.4 1.2h-5l-3.2 8.4h5z', C.l),
    ly(circ(12, 14.8, 8.2), C.y), flat(circ(12, 14.8, 5.8), C.Y, { stroke: 1.2 }),
    flat(starPath(12, 15.1, 3.7, 1.7), C.w),
  ],
  xp: [ly('M12 1.5L22.5 12H16v10.5H8V12H1.5z', C.l), flat('M11 5h1.6v3.4H11z', C.w)],
  gear: [ly(gearPath(), C.g), flat(circ(12, 12, 5.2), C.G, { stroke: 1.2 }), ly(circ(12, 12, 3), null, { cut: true })],
  hammer: [ly('M8.8 10.2l2.4-2.4 10.9 10.9a1.7 1.7 0 0 1-2.4 2.4z', C.wood), ly('M1.6 8.4L8.4 1.6l4.6 4.6-6.8 6.8z', '#dad0c2'), flat('M3.4 8.2l4.8-4.8', C.w, { stroke: 1 })],
  quest: [
    ly('M5 4h13v15H5z', C.c),
    ly('M3.5 1.8h15a2.3 2.3 0 0 1 0 4.6h-15a2.3 2.3 0 0 1 0-4.6z', C.paper),
    ly('M5.5 17.6h15a2.3 2.3 0 0 1 0 4.6h-15a2.3 2.3 0 0 1 0-4.6z', C.paper),
    flat('M8 9.6h7.4M8 12.6h7.4M8 15.4h4.6', C.G, { stroke: 1.3 }),
  ],
  games: [
    ly('M6.5 6.5h11c3.6 0 5.5 3 5.5 7.5 0 4-1.4 6.5-3.6 6.5-2.2 0-3-3-5-3h-5c-2 0-2.8 3-5 3S1 18 1 14c0-4.5 1.9-7.5 5.5-7.5z', C.l),
    flat('M5.4 11.2h2V9.2h2.2v2h2v2.2h-2v2H7.4v-2h-2z', INK),
    flat(circ(16.4, 11.4, 1.5), C.p), flat(circ(19, 14.1, 1.5), C.m),
  ],
  people: [
    ly('M1.4 22.4v-3.6c0-3.7 3-6.2 6.6-6.2s6.6 2.5 6.6 6.2v3.6z', C.p), ly(circ(8, 7.6, 3.8), C.skin), flat('M4.2 7.2a3.8 3.8 0 0 1 7.6 0c-2-1-5.6-1-7.6 0z', '#9a6440'),
    ly('M9.4 22.4v-3c0-3.7 3-6.2 6.6-6.2s6.6 2.5 6.6 6.2v3z', C.s), ly(circ(16, 8.8, 3.8), C.skin), flat('M12.2 8.4a3.8 3.8 0 0 1 7.6 0c-2-1-5.6-1-7.6 0z', C.Y),
  ],
  album: [
    ly('M4 18h16v4.4H5.6A1.6 1.6 0 0 1 4 20.8z', C.c), ly('M4 1.8h16v17H4z', C.p), flat('M4 1.8h2.4v17H4z', C.P),
    ly(starPath(13.4, 10.6, 5.4, 2.5), C.y),
  ],
  pass: [
    ly('M1.6 5.4h20.8v4.3a2.3 2.3 0 0 0 0 4.6v4.3H1.6v-4.3a2.3 2.3 0 0 0 0-4.6z', C.p),
    flat('M15.4 7h1.3v2.2h-1.3zM15.4 10.9h1.3v2.2h-1.3zM15.4 14.8h1.3V17h-1.3z', C.w),
    ly(starPath(8.6, 12.2, 4.6, 2.1), C.y),
  ],
  wardrobe: [
    flat('M12 5.4V3.8a1.6 1.6 0 1 1 1.6-1.6', '#ada190', { stroke: 1.3 }),
    ly('M8.2 5.4L1.8 8.6l2 5 3.1-1.3v9.9h10.2v-9.9l3.1 1.3 2-5-6.4-3.2c-.6 1.8-2 2.8-3.8 2.8s-3.2-1-3.8-2.8z', C.s),
    flat('M9 15h6', C.S, { stroke: 1.2 }),
  ],
  dress: [ly('M9 1.5h6l-.8 4 2 3.2-1.2 2.3L21 22.4H3l6-11.4-1.2-2.3 2-3.2z', C.l), flat('M8 10.2h8v1.6H8z', C.p)],
  lock: [
    flat('M7.2 10.5V7.4a4.8 4.8 0 0 1 9.6 0v3.1', '#ccc1b0', { stroke: 2.6 }),
    ly('M3.4 10h17.2v12.2H3.4z', C.y),
    flat(circ(12, 14.6, 1.8) + 'M11.1 15h1.8v3.8h-1.8z', INK),
  ],
  clock: [
    ly(circ(4.8, 4.6, 2.9) + circ(19.2, 4.6, 2.9), C.p),
    flat('M5.4 19.8l-2 2.6M18.6 19.8l2 2.6', C.P, { stroke: 1.8 }),
    ly(circ(12, 13, 9.4), C.w), flat(circ(12, 13, 9.4), C.p, { stroke: 1.6 }),
    flat('M12 7.8v5.6h3.8', INK, { stroke: 1.7 }),
  ],
  home: [
    ly('M16.4 2.6h3.2v6.6h-3.2z', C.P), ly('M.8 11.6L12 2.2l11.2 9.4z', C.p), ly('M3.8 11h16.4v11.2H3.8z', C.c),
    ly('M9.8 14.4h4.4v7.8H9.8z', C.wood), ly('M15.8 13.4h3v3h-3z', C.s),
  ],
  trophy: [
    flat('M6.4 4.6H3.2v1.9A4.2 4.2 0 0 0 7.4 10.7M17.6 4.6h3.2v1.9a4.2 4.2 0 0 1-4.2 4.2', C.Y, { stroke: 1.9 }),
    ly('M5.8 1.8h12.4v6.6a6.2 6.2 0 0 1-12.4 0z', C.y), ly('M10.5 14h3v3.8h-3z', C.Y), ly('M6.4 17.4h11.2v4.8H6.4z', C.wood),
    flat(starPath(12, 7.4, 3, 1.4), C.w),
  ],
  sparkle: [ly(sparklePath(10.5, 13, 10.5), C.y), ly(sparklePath(19.6, 4.6, 4), C.p)],
  check: [ly('M3.5 12.5l5.5 5.5L20.5 6.5', C.m, { stroke: 4.6 })],
  close: [ly('M5 5l14 14M19 5L5 19', C.red, { stroke: 4.6 })],
  calendar: [
    ly('M2 5h20v17H2z', C.w), ly('M2 5h20v5.6H2z', C.p), ly('M6 1.8h2.4v5.6H6zM15.6 1.8H18v5.6h-2.4z', '#dad0c2'),
    flat('M5.4 13h2.6v2.6H5.4zM10.7 13h2.6v2.6h-2.6zM16 13h2.6v2.6H16zM5.4 17.6h2.6v2.6H5.4zM10.7 17.6h2.6v2.6h-2.6z', C.s),
  ],
  info: [ly(circ(12, 12, 10.6), C.s), flat('M10.7 4.8h2.6v2.6h-2.6zM10.7 9.4h2.6v9.6h-2.6z', C.w)],
  smile: [
    ly(circ(12, 12, 10.6), C.y), flat('M7.6 7.4h2.2v3.4H7.6zM14.2 7.4h2.2v3.4h-2.2z', INK),
    flat('M6.8 14c2.4 3.2 8 3.2 10.4 0', INK, { stroke: 1.7 }), flat(circ(5.4, 13.4, 1.4) + circ(18.6, 13.4, 1.4), C.p),
  ],
  bolt: [ly('M14.6 1L3.4 14h7.6l-2 9.2L20.6 10H13z', C.y)],
  back: [ly('M1.5 12L11 2.5v5.7h11.5v7.6H11v5.7z', C.s)],
  plus: [ly('M9 2.5h6V9h6.5v6H15v6.5H9V15H2.5V9H9z', C.m)],
  play: [ly('M5.5 2.5L21.5 12 5.5 21.5z', C.m)],
  gift: [
    ly('M3 11h18v11.2H3z', C.p), ly('M1.4 6.8h21.2v5.2H1.4z', '#f1a181'), ly('M10.4 6.8h3.2v15.4h-3.2z', C.y),
    ly('M12 7C10.2 3 6.5 1.6 5.6 4c-.8 2.2 2.6 3 6.4 3zM12 7c1.8-4 5.5-5.4 6.4-3 .8 2.2-2.6 3-6.4 3z', C.y),
  ],
  chest: chestLayers(),
  // mochila/bolso (antes salía del emoji 👜, con degradés que no van con el resto)
  bag: [
    flat('M7.6 8.4V6.4a4.4 4.4 0 0 1 8.8 0v2', C.Y, { stroke: 2.2 }),
    ly('M3.6 8h16.8l1.2 14.4H2.4z', C.p),
    ly('M3.6 8h16.8v5.2c-2.6 1.7-5.4 2.4-8.4 2.4s-5.8-.7-8.4-2.4z', '#f1a181'),
    flat(circ(12, 14.6, 1.7), C.y), flat('M5.6 9.6h1.6v2.4H5.6z', C.w),
  ],
  // personajes con ícono dibujado (los emoji 🧚/🧙 se veían como manchas)
  fairy: [
    ly('M12 11C8.4 3.4 1.6 3.4 2 8.4c.3 3.6 5 4.4 10 2.6zM12 11c3.6-7.6 10.4-7.6 10-2.6-.3 3.6-5 4.4-10 2.6z', '#c4ecff'),
    ly('M12 12c-4 .6-8 3.2-6.6 6.2 1.2 2.4 4.6.2 6.6-6.2zM12 12c4 .6 8 3.2 6.6 6.2-1.2 2.4-4.6.2-6.6-6.2z', '#c4ecff'),
    ly('M9.8 11.4h4.4l3 11H6.8z', C.m),
    ly(circ(12, 7.4, 3.4), C.skin), flat('M8.6 7.2a3.4 3.4 0 0 1 6.8 0c-1.8-1.3-5-1.3-6.8 0z', C.p),
    ly(sparklePath(20.2, 3.6, 3.2), C.y),
  ],
  wizard: [
    ly('M13.4 1.2L18.4 10.6H5.6z', C.l), flat(starPath(12.2, 7.2, 1.9, .85), C.y),
    ly('M2.6 10.2h18.8v2.6H2.6z', C.L),
    ly('M8.2 12.8h7.6v3.4a3.8 3.8 0 0 1-7.6 0z', C.skin),
    ly('M8.2 15.6c0 4.2 1.7 7 3.8 7s3.8-2.8 3.8-7c-1.2.9-2.5 1.3-3.8 1.3s-2.6-.4-3.8-1.3z', '#fcf8f3'),
    flat('M9.8 13.6h1.2v1.2H9.8zM13 13.6h1.2v1.2H13z', INK),
  ],
  pack: [
    ly('M4 2.4h16l-1 2 1 2v11.2l-1 2 1 2H4l1-2-1-2V6.4l1-2z', C.l), ly('M4 9h16v6.2H4z', C.p),
    ly(starPath(12, 12.2, 3.8, 1.7), C.y),
  ],
  // faro: ícono de las Obras (monumentos)
  monument: [
    ly('M8.2 8.6h7.6l2.4 13.6H5.8z', C.w),
    flat('M7.6 12.2h8.8l.5 3H7.1zM6.5 18.4h11l.5 3.2H6z', '#e8564f'),
    ly('M8.4 4.4h7.2v4.4H8.4z', C.y), flat('M10.6 5.2h1.4v2.8h-1.4z', C.w),
    ly('M7.4 4.8L12 .8l4.6 4z', '#e8564f'),
    flat('M1.2 4.8l5.4 1.6M22.8 4.8l-5.4 1.6', C.y, { stroke: 1.4 }),
  ],
};

const EMOJI = {
  map: '🗺️', music: '🎵', sound: '🔊', mute: '🔇', car: '🚗', rotate: '🔄', move: '✋', trash: '🗑️', up: '⬆️', shop: '🛍️',
  castle: '🏛️', build: '🏗️', cake: '🍰', flower: '🌸', rocket: '🚀', fire: '🔥',
  pause: '⏸️', camera: '📷', save: '💾', palette: '🎨', key: '🔑', ice: '🍦',
  diamond: '💎', ring: '💍', ribbon: '🎀', wand: '🪄', bear: '🧸', paw: '🐾', sun: '☀️', moon: '🌙',
};
const ALIAS = { '👜': 'bag', '🧚': 'fairy', '🧙': 'wizard', '📒': 'album', '🎁': 'gift', '⭐': 'star', '❤️': 'heart', '🔒': 'lock', '⏰': 'clock', '🏆': 'trophy', '✨': 'sparkle', '⚡': 'bolt', '🔨': 'hammer', '📜': 'quest', '🎮': 'games', '🏠': 'home', '📅': 'calendar', '⚙️': 'gear', '👑': 'crown', '✅': 'check', '❌': 'close', 'ℹ️': 'info', '➕': 'plus', '▶️': 'play', '⬅️': 'back' };

/**
 * Registra (o reemplaza) un ícono: capas como las de DEFS, o un canvas/imagen ya pixelado (p.ej. una
 * miniatura 3D), que se agranda con bloques enteros y se ajusta al tamaño exacto sin deformar pixeles.
 */
export function registerIcon(name, layers) {
  DEFS[name] = layers;
  if (!ICON_NAMES.includes(name)) ICON_NAMES.push(name);
  for (const k of [...cache.keys()]) if (k.startsWith(name + '|')) cache.delete(k);
}

// ---------- color ----------
function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) {
  const x = rgb(a), y = rgb(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const INK_RGB = rgb(INK);

// ---------- rasterizado ----------
function canvas(n) { const cv = document.createElement('canvas'); cv.width = cv.height = n; return cv; }

/** Pinta las capas a N×N pixeles de arte (alfa binario) y devuelve ImageData con bisel y contorno. */
function drawLayers(layers, N) {
  const cv = canvas(N), g = cv.getContext('2d', { willReadFrequently: true });
  const grid = new Int16Array(N * N).fill(-1);
  const s = (N - 2) / 24;
  layers.forEach((L, li) => {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, N, N);
    g.setTransform(s, 0, 0, s, 1, 1);
    const p = new Path2D(L.d);
    if (L.stroke) {
      g.lineWidth = Math.max(L.stroke, 1.15 / s); g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#000'; g.stroke(p);
    } else { g.fillStyle = '#000'; g.fill(p, L.rule || 'nonzero'); }
    const a = g.getImageData(0, 0, N, N).data;
    // los detalles (sin bisel) se marcan con umbral más bajo para que no desaparezcan en tamaños chicos
    const th = L.bevel === false || L.stroke ? 90 : 128;
    for (let i = 0; i < N * N; i++) if (a[i * 4 + 3] >= th) grid[i] = L.cut ? -1 : li;
  });
  const img = new ImageData(N, N), d = img.data;
  const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N) ? -1 : grid[y * N + x];
  const cols = layers.map(L => L.c ? { base: rgb(L.c), hi: rgb(mix(L.c, '#ffffff', 0.38)), lo: rgb(mix(L.c, INK, 0.24)) } : null);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, li = grid[i];
    if (li < 0) {
      // contorno tinta de 1px alrededor de la silueta
      if (at(x - 1, y) >= 0 || at(x + 1, y) >= 0 || at(x, y - 1) >= 0 || at(x, y + 1) >= 0) {
        d.set(INK_RGB, i * 4); d[i * 4 + 3] = 255;
      }
      continue;
    }
    const L = layers[li], cc = cols[li];
    let col = cc.base;
    if (L.bevel ?? !L.stroke) {
      // borde de la forma = vecino vacío o de una capa de abajo
      const edge = (n) => n < li;
      if (edge(at(x, y + 1)) || edge(at(x + 1, y))) col = cc.lo;
      else if (edge(at(x, y - 1)) || edge(at(x - 1, y))) col = cc.hi;
    }
    d.set(col, i * 4); d[i * 4 + 3] = 255;
  }
  return img;
}

/** Emoji "pixelado": se dibuja a N×N, se binariza el alfa y se le pone contorno. */
function drawEmoji(em, N) {
  const cv = canvas(N), g = cv.getContext('2d', { willReadFrequently: true });
  const s = N - 2;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${Math.round(s * 0.92)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  g.fillText(em, N / 2, N / 2 + s * 0.06);
  const img = g.getImageData(0, 0, N, N), d = img.data;
  const solid = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const a = d[i * 4 + 3];
    if (a > 110) {
      solid[i] = 1;
      const k = Math.min(255 / a, 1.6);
      for (let c = 0; c < 3; c++) d[i * 4 + c] = Math.min(255, Math.round(d[i * 4 + c] * k));
      d[i * 4 + 3] = 255;
    } else d[i * 4 + 3] = 0;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    if (solid[i]) continue;
    if ((x > 0 && solid[i - 1]) || (x < N - 1 && solid[i + 1]) || (y > 0 && solid[i - N]) || (y < N - 1 && solid[i + N])) {
      d.set(INK_RGB, i * 4); d[i * 4 + 3] = 255;
    }
  }
  return img;
}

const dpr = () => Math.min(4, Math.max(1, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1));
/**
 * Resolución de arte para un ícono de `dev` pixeles físicos: ~1.2 px CSS por pixel de arte (más fino
 * en íconos grandes, tope 40), y un factor entero k para que N*k llene el <img> sin deformar.
 */
function artSize(dev) {
  const css = dev / dpr();
  const target = Math.min(40, Math.max(12, Math.round(css / 1.2)));
  const k1 = Math.max(1, Math.floor(dev / target)), k2 = k1 + 1;
  const n1 = Math.floor(dev / k1), n2 = Math.floor(dev / k2);
  const k = (n2 >= 10 && target / n2 < n1 / target) ? k2 : k1;
  return { N: Math.floor(dev / k), k };
}

const cache = new Map();
function resolve(name) { return DEFS[name] ? name : ALIAS[name] || name; }
function urlFor(name, dev) {
  name = resolve(name);
  const key = name + '|' + dev;
  if (cache.has(key)) return cache.get(key);
  const def = DEFS[name];
  if (def && !Array.isArray(def)) return cacheSet(key, rasterUrl(def, dev));
  const { N, k } = artSize(dev);
  const img = def ? drawLayers(def, N) : drawEmoji(EMOJI[name] || name, N);
  const art = canvas(N);
  art.getContext('2d').putImageData(img, 0, 0);
  const out = canvas(dev), g = out.getContext('2d');
  g.imageSmoothingEnabled = false;
  const off = Math.floor((dev - N * k) / 2);
  g.drawImage(art, off, off, N * k, N * k);
  return cacheSet(key, out.toDataURL());
}
function cacheSet(key, url) { cache.set(key, url); return url; }
/**
 * Imagen pixelada a dev×dev. Si un factor entero llena casi todo (≥ 78%), bloques enteros nítidos centrados
 * (sin tonos intermedios en los bordes); si no, bloques enteros hasta pasarse y una sola reducción suave.
 */
function rasterUrl(src, dev) {
  const W = src.width, H = src.height;
  let s = dev / Math.max(W, H);
  if (s >= 1 && !Number.isInteger(s) && Math.floor(s) / s >= 0.78) s = Math.floor(s);
  const out = canvas(dev), g = out.getContext('2d');
  const w = Math.round(W * s), hh = Math.round(H * s), x = (dev - w) >> 1, y = (dev - hh) >> 1;
  if (Number.isInteger(s)) {
    g.imageSmoothingEnabled = false;
    g.drawImage(src, x, y, w, hh);
  } else {
    const k = Math.ceil(s), big = document.createElement('canvas');
    big.width = W * k; big.height = H * k;
    const bg = big.getContext('2d');
    bg.imageSmoothingEnabled = false;
    bg.drawImage(src, 0, 0, big.width, big.height);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(big, x, y, w, hh);
  }
  return out.toDataURL();
}

/** dataURL del ícono para mostrarlo a `size` px CSS. name: clave de DEFS/EMOJI o directamente un emoji. */
export function iconUrl(name, size = 24) {
  return urlFor(name, Math.max(8, Math.round(size * dpr())));
}
const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
/** HTML de un ícono a `size` px CSS (se adapta solo si el CSS lo muestra a otro tamaño). */
export function icon(name, size = 20, cls = '') {
  return `<img class="pi ${cls}" data-pi="${escAttr(name)}" src="${iconUrl(name, size)}" width="${size}" height="${size}" alt="" draggable="false">`;
}
export const ICON_NAMES = [...Object.keys(DEFS), ...Object.keys(EMOJI)];
/** Empieza a ajustar un <img data-pi> que ya estaba en la página (si se le puso data-pi después). */
export let watchIcon = () => {};

// ---------- ajuste automático al tamaño real ----------
// Cualquier <img data-pi="nombre"> se regenera a sus pixeles físicos exactos cuando cambia de tamaño.
if (typeof ResizeObserver === 'function' && typeof document !== 'undefined') {
  const ro = new ResizeObserver(entries => {
    for (const e of entries) {
      const img = e.target;
      if (!img.isConnected) { ro.unobserve(img); continue; }
      // mismo cálculo que iconUrl() (contentRect × devicePixelRatio) para que coincidan
      const dev = Math.round(e.contentRect.width * dpr());
      if (dev < 8 || img._piDev === dev) continue;
      img._piDev = dev;
      const url = urlFor(img.dataset.pi, dev);
      if (img.getAttribute('src') !== url) img.src = url;
    }
  });
  watchIcon = (img) => ro.observe(img);
  const watch = (n) => {
    if (n.nodeType !== 1) return;
    if (n.dataset.pi) ro.observe(n);
    if (n.firstElementChild) for (const el of n.querySelectorAll('img[data-pi]')) ro.observe(el);
  };
  new MutationObserver(recs => { for (const r of recs) for (const n of r.addedNodes) watch(n); })
    .observe(document.documentElement, { childList: true, subtree: true });
  watch(document.documentElement);
}
