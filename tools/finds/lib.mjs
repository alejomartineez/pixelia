// Lápiz de las láminas de Hallazgos (32×32). Cada lámina se dibuja con formas (elipses, polígonos, trazos) y pixeles
// puestos a mano; el lápiz les pone la misma luz a todas (claro arriba a la izquierda, oscuro abajo a la derecha) y
// las vuelca a grillas de texto con la paleta de src/core/icons/palette.js. El juego solo lee las grillas
// (src/core/icons/finds/<set>.js); esto es la herramienta de dibujo. Uso: tools/finds.mjs.
import { PAL, RAMPS } from '../../src/core/icons/palette.js';

export const N = 32;
const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

/** Máscara de pixeles: se arma sumando y restando formas, y se pinta de una vez (una sola luz para toda la pieza). */
export class Mask {
  constructor() { this.m = new Uint8Array(N * N); this._v = 1; }
  /** Las formas que siguen a .cut restan en vez de sumar: M().ellipse(...).cut.ellipse(...) */
  get cut() { this._v = 0; return this; }
  get add() { this._v = 1; return this; }
  has(x, y) { return inb(x, y) && this.m[y * N + x] === 1; }
  set(x, y) { x = Math.round(x); y = Math.round(y); if (inb(x, y)) this.m[y * N + x] = this._v; return this; }
  each(fn) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (this.m[y * N + x]) fn(x, y); }
  _where(test) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (test(x, y)) this.m[y * N + x] = this._v; return this; }
  /** Rectángulo desde (x, y), de w × h pixeles. r redondea las esquinas (1 saca el pixel de la esquina, 2 un poco más). */
  rect(x, y, w, h, r = 0) {
    return this._where((px, py) => {
      if (px < x || py < y || px >= x + w || py >= y + h) return false;
      if (!r) return true;
      const dx = Math.max(x + r - px, px - (x + w - 1 - r), 0), dy = Math.max(y + r - py, py - (y + h - 1 - r), 0);
      return dx * dx + dy * dy <= r * r + 0.5 * r;
    });
  }
  /** Elipse con centro (cx, cy) y radios rx, ry (pueden llevar decimales: 4.5 da un diámetro de 10). */
  ellipse(cx, cy, rx, ry = rx) {
    return this._where((px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1);
  }
  /** Anillo: elipse de afuera menos otra más chica (t = grosor). */
  ring(cx, cy, rx, ry, t = 1) {
    return this._where((px, py) => {
      const a = ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2;
      const b = rx - t > 0 && ry - t > 0 ? ((px - cx) / (rx - t)) ** 2 + ((py - cy) / (ry - t)) ** 2 : 2;
      return a <= 1 && b > 1;
    });
  }
  /** Polígono relleno: lista de puntos [[x, y], ...] (se cierra solo). Los bordes se incluyen. */
  poly(pts) {
    const v = this._v;
    for (let y = 0; y < N; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(x0 + (y - y0) / (y1 - y0) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] + 0.5); x++) if (inb(x, y)) this.m[y * N + x] = v;
    }
    for (let i = 0; i < pts.length; i++) this.line(...pts[i], ...pts[(i + 1) % pts.length], 1);
    return this;
  }
  /** Trazo recto de (x0, y0) a (x1, y1), de w pixeles de grosor. */
  line(x0, y0, x1, y1, w = 1) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let i = 0; i <= steps; i++) this._dot(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps, w);
    return this;
  }
  _dot(x, y, w) {
    if (w <= 1) return this.set(x, y);
    if (w === 2) { const X = Math.floor(x), Y = Math.floor(y); for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (inb(X + a, Y + b)) this.m[(Y + b) * N + X + a] = this._v; return this; }
    const r = (w - 1) / 2;
    for (let py = Math.floor(y - r); py <= Math.ceil(y + r); py++) for (let px = Math.floor(x - r); px <= Math.ceil(x + r); px++) {
      if (inb(px, py) && (px - x) ** 2 + (py - y) ** 2 <= r * r + 0.3) this.m[py * N + px] = this._v;
    }
    return this;
  }
  /** Trazo curvo que pasa por los puntos (suavizado). w = grosor. */
  curve(pts, w = 1) {
    if (pts.length < 3) return this.line(...pts[0], ...pts[pts.length - 1], w);
    const P = [pts[0], ...pts, pts[pts.length - 1]];
    for (let i = 1; i + 2 < P.length; i++) {
      const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
      const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 2));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        this._dot(f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), w);
      }
    }
    return this;
  }
  /** Suma (o resta, después de .cut) otra máscara. */
  mask(o) { for (let i = 0; i < N * N; i++) if (o.m[i]) this.m[i] = this._v; return this; }
}
export const M = () => new Mask();

/** Rampa: nombre ('oro', 'madera'…), tres caracteres de la paleta ('PpG' = claro·base·oscuro) o uno solo (plano). */
function rampOf(r) {
  const s = RAMPS[r] || r;
  if (typeof s !== 'string' || (s.length !== 3 && s.length !== 1)) throw new Error(`rampa inválida: ${r}`);
  for (const ch of s) if (ch !== '.' && !(ch in PAL)) throw new Error(`"${ch}" no está en la paleta (rampa ${r})`);
  return s;
}

export class G {
  constructor(id = '') {
    this.id = id;
    this.c = Array.from({ length: N }, () => Array(N).fill('.'));
    this.t = Array.from({ length: N }, () => Array(N).fill(''));
    this.warn = new Set();
  }
  /**
   * Pinta una máscara. ramp: 'oro' | 'Yyo' | 'y' | '.' (borra).
   * o.tag: nombre de la pieza (para o.in de otras) · o.in: 'tag' o ['a','b']: solo sobre esas piezas ·
   * o.on: solo sobre lo ya pintado · o.behind: solo donde está vacío (queda detrás) ·
   * o.sep: línea de tinta ('k' o el carácter que se pase) donde la pieza toca otra ya pintada ·
   * o.flat: sin luz ni sombra · o.lite / o.shade: ancho en pixeles del borde claro y del oscuro (1 por defecto, 0 lo saca) ·
   * o.hi: [[x, y], ...] brillos 'w' encima.
   */
  fill(mask, ramp, o = {}) {
    const R = rampOf(ramp), m = new Uint8Array(mask.m);
    const tags = o.in ? [].concat(o.in) : null;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (!m[i]) continue;
      if (x < 1 || y < 1 || x > N - 2 || y > N - 2) { m[i] = 0; this.warn.add('se salía del borde (la fila y la columna de afuera van vacías)'); continue; }
      if (tags && !tags.includes(this.t[y][x])) m[i] = 0;
      else if (o.on && this.c[y][x] === '.') m[i] = 0;
      else if (o.behind && this.c[y][x] !== '.') m[i] = 0;
    }
    const has = (x, y) => inb(x, y) && m[y * N + x] === 1;
    if (o.sep) {
      const ch = o.sep === true ? 'k' : o.sep;
      for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
        if (m[y * N + x] || this.c[y][x] === '.') continue;
        if (has(x - 1, y) || has(x + 1, y) || has(x, y - 1) || has(x, y + 1)) this.c[y][x] = ch;
      }
    }
    const lite = o.flat ? 0 : o.lite ?? 1, shade = o.flat ? 0 : o.shade ?? 1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!m[y * N + x]) continue;
      let ch = R.length === 1 ? R : R[1];
      if (R.length === 3) {
        let L = false, D = false;
        for (let k = 1; k <= lite; k++) if (!has(x - k, y) || !has(x, y - k) || (k > 1 && !has(x - k + 1, y - k + 1))) L = true;
        for (let k = 1; k <= shade; k++) if (!has(x + k, y) || !has(x, y + k) || (k > 1 && !has(x + k - 1, y + k - 1))) D = true;
        // un borde fino (claro y oscuro a la vez) queda en el tono base; si la sombra es ancha, gana la luz en su borde
        if (L && D) { const l1 = !has(x - 1, y) || !has(x, y - 1), d1 = !has(x + 1, y) || !has(x, y + 1); ch = l1 && !d1 ? R[0] : d1 && !l1 ? R[2] : R[1]; }
        else if (L) ch = R[0]; else if (D) ch = R[2];
      }
      this.c[y][x] = ch;
      this.t[y][x] = ch === '.' ? '' : (o.tag ?? '');
    }
    for (const [x, y] of o.hi || []) if (has(x, y)) this.c[y][x] = 'w';
    return this;
  }
  rect(x, y, w, h, ramp, o = {}) { return this.fill(M().rect(x, y, w, h, o.r || 0), ramp, o); }
  ellipse(cx, cy, rx, ry, ramp, o = {}) { return this.fill(M().ellipse(cx, cy, rx, ry), ramp, o); }
  ring(cx, cy, rx, ry, t, ramp, o = {}) { return this.fill(M().ring(cx, cy, rx, ry, t), ramp, o); }
  poly(pts, ramp, o = {}) { return this.fill(M().poly(pts), ramp, o); }
  line(x0, y0, x1, y1, ramp, o = {}) { return this.fill(M().line(x0, y0, x1, y1, o.w || 1), ramp, o); }
  curve(pts, ramp, o = {}) { return this.fill(M().curve(pts, o.w || 1), ramp, o); }
  /** Pixeles sueltos de un carácter: g.px('k', [10, 12], [11, 12]). */
  px(ch, ...pts) {
    if (ch !== '.' && !(ch in PAL)) throw new Error(`"${ch}" no está en la paleta`);
    for (const [x, y] of pts) {
      if (x < 1 || y < 1 || x > N - 2 || y > N - 2) { this.warn.add('px fuera del área (1..30)'); continue; }
      this.c[y][x] = ch; if (ch === '.') this.t[y][x] = '';
    }
    return this;
  }
  /** Pedazo dibujado a mano, con la esquina de arriba a la izquierda en (x, y). ' ' no toca, '.' borra. */
  art(x, y, rows, o = {}) {
    rows.forEach((r, j) => [...r].forEach((ch, i) => {
      if (ch === ' ') return;
      const X = x + i, Y = y + j;
      if (ch !== '.' && !(ch in PAL)) throw new Error(`"${ch}" no está en la paleta`);
      if (X < 1 || Y < 1 || X > N - 2 || Y > N - 2) { if (ch !== '.') this.warn.add('art fuera del área (1..30)'); return; }
      this.c[Y][X] = ch; this.t[Y][X] = ch === '.' ? '' : (o.tag ?? this.t[Y][X]);
    }));
    return this;
  }
  /** Carácter pintado en (x, y) ('.' si está vacío). */
  at(x, y) { return inb(x, y) ? this.c[y][x] : '.'; }
  rows() { return this.c.map(r => r.join('')); }
}

// ---------- render a PNG (para mirar sin navegador) ----------
import { deflateSync, crc32 } from 'node:zlib';
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const PAL_RGB = Object.fromEntries(Object.entries(PAL).map(([c, h]) => [c, hex(h)]));
const INK = PAL_RGB.k;

/** Grilla → pixeles RGBA de 32×32 con el contorno de tinta (igual que drawGrid de icons.js). */
export function gridPixels(rows) {
  const n = rows.length, out = Array.from({ length: n }, () => Array(n).fill(null));
  const filled = (x, y) => x >= 0 && y >= 0 && x < n && y < n && rows[y][x] !== '.';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const ch = rows[y][x];
    if (ch === '.') { if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) out[y][x] = INK; }
    else out[y][x] = PAL_RGB[ch] || INK;
  }
  return out;
}

export class Img {
  constructor(w, h, bg = [27, 26, 29]) { this.w = w; this.h = h; this.d = Buffer.alloc(w * h * 3); for (let i = 0; i < w * h; i++) this.d.set(bg, i * 3); }
  rect(x, y, w, h, c) { for (let j = Math.max(0, y); j < Math.min(this.h, y + h); j++) for (let i = Math.max(0, x); i < Math.min(this.w, x + w); i++) this.d.set(c, (j * this.w + i) * 3); }
  /** Dibuja una grilla a escala k. mode: 'color' | 'gray' | 'sil'. */
  sprite(px, x, y, k, mode = 'color') {
    px.forEach((row, j) => row.forEach((c, i) => {
      if (!c) return;
      if (mode === 'sil') c = [0, 0, 0];
      else if (mode === 'gray') { const v = Math.round(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]); c = [v, v, v]; }
      this.rect(x + i * k, y + j * k, k, k, c);
    }));
  }
  /** Número chico (3×5) para rotular. */
  num(n, x, y, c = [236, 228, 214], k = 2) {
    const F = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111' };
    [...String(n)].forEach((dgt, di) => [...F[dgt]].forEach((b, i) => { if (b === '1') this.rect(x + di * 4 * k + (i % 3) * k, y + Math.floor(i / 3) * k, k, k, c); }));
  }
  png() {
    const raw = Buffer.alloc((this.w * 3 + 1) * this.h);
    for (let y = 0; y < this.h; y++) this.d.copy(raw, y * (this.w * 3 + 1) + 1, y * this.w * 3, (y + 1) * this.w * 3);
    const chunk = (type, data) => {
      const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
      const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
      return Buffer.concat([len, td, crc]);
    };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(this.w, 0); ihdr.writeUInt32BE(this.h, 4); ihdr[8] = 8; ihdr[9] = 2;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  }
}
