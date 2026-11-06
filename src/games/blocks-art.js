// Bloques Pixel — sprites pixel-art dibujados por código (bloques con volumen, marco del tablero, bandeja).

// Colores de piezas (pasteles de la paleta) con tonos para el bisel.
export const COLORS = [
  { id: 'pink',  out: '#b8417a', dark: '#e0659f', base: '#ff8fc3', light: '#ffc8e1', shine: '#fff2f8' },
  { id: 'lilac', out: '#6c47b8', dark: '#9370e6', base: '#bb9bff', light: '#e0d2ff', shine: '#f8f3ff' },
  { id: 'mint',  out: '#2b8f72', dark: '#46bf98', base: '#79e3c3', light: '#c4f6e6', shine: '#f1fffa' },
  { id: 'sky',   out: '#3a7fb8', dark: '#5ea9e3', base: '#94d2ff', light: '#d2edff', shine: '#f4fbff' },
  { id: 'gold',  out: '#b97c1f', dark: '#e6a73c', base: '#ffd36e', light: '#ffeeb8', shine: '#fffbea' },
  { id: 'peach', out: '#b8613a', dark: '#ec8c5e', base: '#ffb48e', light: '#ffdcc8', shine: '#fff5ef' },
];
export const STAR_COLOR = 4; // dorado: las piezas regalo de 1 bloque

const GRAY = { out: '#8c7f99', dark: '#b3a8bf', base: '#d3cadb', light: '#e9e3ee', shine: '#f7f4f9' };
const WHITE = { out: '#ffffff', dark: '#fff6fb', base: '#ffffff', light: '#ffffff', shine: '#ffffff' };

const cache = new Map();

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const STAR5 = ['..#..', '.###.', '#####', '.#.#.', '#...#'];

/** Bloque de tamaño s (px de arte). variant: 'n' normal, 'g' gris, 'w' blanco (destello), 's' con estrellita. */
export function blockSprite(color, s, variant = 'n') {
  const key = color + ':' + s + ':' + variant;
  let c = cache.get(key);
  if (c) return c;
  c = makeCanvas(s, s);
  const g = c.getContext('2d');
  const p = variant === 'g' ? GRAY : variant === 'w' ? WHITE : COLORS[color] || COLORS[0];
  const b = s >= 10 ? 2 : 1;
  // contorno (esquinas redondeadas: sin el pixel de la esquina)
  g.fillStyle = p.out;
  g.fillRect(1, 0, s - 2, s); g.fillRect(0, 1, s, s - 2);
  // cara
  g.fillStyle = p.base; g.fillRect(1, 1, s - 2, s - 2);
  // sombra abajo-derecha
  g.fillStyle = p.dark;
  g.fillRect(1, s - 1 - b, s - 2, b); g.fillRect(s - 1 - b, 1, b, s - 2);
  // bisel claro arriba-izquierda
  g.fillStyle = p.light;
  g.fillRect(1, 1, s - 2 - b, b); g.fillRect(1, 1, b, s - 2 - b);
  // brillo
  if (s >= 8) {
    g.fillStyle = p.shine;
    g.fillRect(1 + b, 1 + b, 2, 1); g.fillRect(1 + b, 2 + b, 1, 1);
    if (s >= 12) { g.fillRect(1, 1, 2, 1); g.fillRect(1, 2, 1, 1); }
  } else {
    g.fillStyle = p.shine; g.fillRect(1, 1, 1, 1);
  }
  if (variant === 's' && s >= 10) {
    const o = Math.floor((s - 5) / 2);
    const pts = [];
    STAR5.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') pts.push([o + x, o + y]); }));
    // sombra corrida abajo-derecha (un contorno completo la empastaba y no se leía como estrella)
    g.fillStyle = p.dark;
    for (const [x, y] of pts) g.fillRect(x + 1, y + 1, 1, 1);
    g.fillStyle = '#ffffff';
    for (const [x, y] of pts) g.fillRect(x, y, 1, 1);
  } else if (variant === 's' && s >= 5) {
    // en la bandeja (bloques chicos): crucecita blanca para que se note que es regalo
    const m = Math.floor(s / 2);
    g.fillStyle = '#ffffff';
    g.fillRect(m - 1, m, 3, 1); g.fillRect(m, m - 1, 1, 3);
  }
  cache.set(key, c);
  return c;
}

/** Destello animado de 7x7 (frame 0..3). */
export function sparkleSprite(frame) {
  const key = 'spark:' + frame;
  let c = cache.get(key);
  if (c) return c;
  c = makeCanvas(7, 7);
  const g = c.getContext('2d');
  const len = [1, 2, 3, 2][frame] || 1;
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.fillRect(3, 3 - len, 1, len * 2 + 1);
  g.fillRect(3 - len, 3, len * 2 + 1, 1);
  if (frame === 2) { g.fillStyle = '#fff6c8'; g.fillRect(3, 3, 1, 1); }
  cache.set(key, c);
  return c;
}

/** Corazoncito 7x6 para decorar (también usado como partícula de fondo). */
const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
const HEART_SHADE = ['.ll.ll.', 'lw.....', 'l......', '.......', '.......', '.......'];
export function heartSprite(fill = '#ff8fc3', outline = '#b8417a', light = '#ffd0e6') {
  const key = 'heart:' + fill;
  let c = cache.get(key);
  if (c) return c;
  c = makeCanvas(9, 8);
  const g = c.getContext('2d');
  // contorno: dibujar el corazón desplazado en 4 direcciones
  g.fillStyle = outline;
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) HEART.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') g.fillRect(x + dx, y + dy, 1, 1); }));
  g.fillStyle = fill;
  HEART.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') g.fillRect(x + 1, y + 1, 1, 1); }));
  HEART_SHADE.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === 'l') { g.fillStyle = light; g.fillRect(x + 1, y + 1, 1, 1); }
    if (ch === 'w') { g.fillStyle = '#ffffff'; g.fillRect(x + 1, y + 1, 1, 1); }
  }));
  cache.set(key, c);
  return c;
}

function roundRect(g, x, y, w, h, color, r = 2) {
  g.fillStyle = color;
  if (r <= 0) { g.fillRect(x, y, w, h); return; }
  g.fillRect(x + r, y, w - r * 2, h);
  g.fillRect(x, y + r, w, h - r * 2);
  if (r >= 2) { g.fillRect(x + 1, y + 1, w - 2, h - 2); }
}

/**
 * Tablero completo (marco + celdas vacías) en un canvas.
 * cell: px de arte por celda, n: celdas por lado, frame: grosor del marco.
 */
export const BOARD_PAD = 4; // espacio arriba para el adorno del marco
export function boardCanvas(n, cell, frame) {
  const inner = n * cell;
  const W = inner + frame * 2;
  const c = makeCanvas(W, W + 3 + BOARD_PAD);
  const g = c.getContext('2d');
  g.translate(0, BOARD_PAD);
  // sombra apoyada
  roundRect(g, 1, 3, W - 2, W, 'rgba(59,35,64,0.22)', 3);
  // marco: contorno tinta + lila con bisel
  roundRect(g, 0, 0, W, W, '#3b2340', 3);
  roundRect(g, 1, 1, W - 2, W - 2, '#9c74ec', 3);
  g.fillStyle = '#e3d4ff'; g.fillRect(3, 1, W - 6, 1); g.fillRect(1, 3, 1, W - 6); g.fillRect(2, 2, 1, 1);
  g.fillStyle = '#c3a8ff'; g.fillRect(3, 2, W - 6, 1); g.fillRect(2, 3, 1, W - 6);
  g.fillStyle = '#7a52c9'; g.fillRect(3, W - 2, W - 6, 1); g.fillRect(W - 2, 3, 1, W - 6); g.fillRect(W - 3, W - 3, 1, 1);
  // borde interior tinta
  g.fillStyle = '#3b2340';
  g.fillRect(frame - 1, frame - 1, inner + 2, inner + 2);
  // celdas vacías (huecos con leve sombra interna) en damero suave
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const px = frame + x * cell, py = frame + y * cell;
    const alt = (x + y) % 2 === 0;
    g.fillStyle = alt ? '#f4eaff' : '#efe2fd';
    g.fillRect(px, py, cell, cell);
    g.fillStyle = alt ? '#e2d1f6' : '#dccaf2';
    g.fillRect(px, py, cell, 1); g.fillRect(px, py, 1, cell);
    g.fillStyle = alt ? '#fbf6ff' : '#f8f0ff';
    g.fillRect(px + 1, py + cell - 1, cell - 1, 1); g.fillRect(px + cell - 1, py + 1, 1, cell - 1);
    // puntito central para ayudar a apuntar
    g.fillStyle = alt ? '#e6d8f7' : '#e1d2f4';
    const m = Math.floor(cell / 2);
    g.fillRect(px + m - 1, py + m - 1, 2, 2);
  }
  // tachas doradas en las esquinas
  const stud = (sx, sy) => {
    g.fillStyle = '#3b2340'; g.fillRect(sx - 1, sy, 5, 3); g.fillRect(sx, sy - 1, 3, 5);
    g.fillStyle = '#ffd36e'; g.fillRect(sx, sy, 3, 3);
    g.fillStyle = '#fff6d0'; g.fillRect(sx, sy, 1, 1);
    g.fillStyle = '#e6a73c'; g.fillRect(sx + 2, sy + 2, 1, 1);
  };
  const o = Math.max(1, Math.floor((frame - 3) / 2));
  stud(o, o); stud(W - 3 - o, o); stud(o, W - 3 - o); stud(W - 3 - o, W - 3 - o);
  // corazón en el centro del marco superior
  const hs = heartSprite();
  g.drawImage(hs, Math.floor(W / 2 - hs.width / 2), -BOARD_PAD);
  return c;
}

/** Panel de bandeja (rectángulo redondeado con borde tinta). slots: rects [{x,y,w,h}] relativos. */
export function trayCanvas(w, h, slots, vertical) {
  const c = makeCanvas(w, h + 3);
  const g = c.getContext('2d');
  roundRect(g, 1, 3, w - 2, h, 'rgba(59,35,64,0.18)', 3);
  roundRect(g, 0, 0, w, h, '#3b2340', 3);
  roundRect(g, 1, 1, w - 2, h - 2, '#fff7fb', 3);
  g.fillStyle = '#ffe3f1'; g.fillRect(2, h - 3, w - 4, 2);
  g.fillStyle = '#ffffff'; g.fillRect(3, 1, w - 6, 1);
  // divisores punteados
  g.fillStyle = '#f6cfe3';
  for (let i = 1; i < slots.length; i++) {
    const s = slots[i];
    if (vertical) { for (let x = 4; x < w - 4; x += 3) g.fillRect(x, s.y, 2, 1); }
    else { for (let y = 4; y < h - 5; y += 3) g.fillRect(s.x, y, 1, 2); }
  }
  return c;
}

export function clearArtCache() { cache.clear(); }
