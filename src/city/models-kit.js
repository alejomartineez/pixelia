// Kit de herramientas para modelar edificios vóxel (usado por models-*.js).
// Convenciones: coordenadas enteras de vóxel en el "footprint" [0,W)×[0,D); y = arriba; frente = +Z.
import { Voxels, shade } from '../core/voxel.js';
import { PALETTE } from '../core/data.js';

export const P = PALETTE;
export { Voxels, shade };

export const C = {
  glass: '#bfe8ff', glassD: '#93d0f2', glassHi: '#ffffff',
  frame: '#ffffff', trim: '#fff7fb',
  stoneL: '#ece8f4', stone: P.stone, stoneD: P.stoneD,
  roofPink: '#f2679f', roofLilac: '#9b72e8', roofMint: '#45c9a2', roofSky: '#5fb4ea',
  leaf: P.leaf, leafD: P.leafD, leafL: '#8ee08a',
  trunk: P.wood, trunkD: P.woodD,
  red: '#ff5a6e', yellow: '#ffe066', orange: '#ffa64d', white: '#ffffff', cream: P.cream,
  waffle: '#e8b062', waffleD: '#c98d45', choco: '#8a5a3a',
  gold: P.gold, goldD: P.goldD, goldL: P.goldL,
  water: '#8fe0ff', waterD: '#5cc6f0', waterL: '#d6f5ff',
};

export const FLOWER_COLORS = [P.pink, '#ffffff', P.lilac, C.yellow, C.red, P.sky, P.peach];

// ---------- RNG determinista ----------
export function rng(seed = 1) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

// ---------- Caras ----------
// face: 'pz' (frente) | 'nz' (atrás) | 'px' (derecha) | 'nx' (izquierda)
// plane = coordenada del plano de la pared; u = coordenada a lo largo de la pared; out = vóxeles hacia afuera
export function fp(face, plane, u, y, out = 0) {
  switch (face) {
    case 'pz': return [u, y, plane + out];
    case 'nz': return [u, y, plane - out];
    case 'px': return [plane + out, y, u];
    default: return [plane - out, y, u];
  }
}
export function fset(v, face, plane, u, y, out, c) {
  const p = fp(face, plane, u, y, out);
  v.set(p[0], p[1], p[2], c);
}
export function fbox(v, face, plane, u, y, w, h, out, c) {
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++)
    fset(v, face, plane, u + i, y + j, out, typeof c === 'function' ? c(i, j) : c);
}

/** Dibuja un patrón de texto (fila 0 = arriba) sobre una cara. map: {char: color} o un color para 'X'. */
export function pattern(v, face, plane, u, y, rows, map, out = 0) {
  const n = rows.length;
  for (let r = 0; r < n; r++) {
    const row = rows[r];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.' || ch === ' ') continue;
      const c = typeof map === 'string' || typeof map === 'number' ? map : map[ch];
      if (c == null) continue;
      fset(v, face, plane, u + i, y + (n - 1 - r), out, c);
    }
  }
}
/** Patrón horizontal (vista desde arriba): filas a lo largo de z, columnas a lo largo de x. */
export function patternTop(v, x, y, z, rows, map) {
  for (let r = 0; r < rows.length; r++) for (let i = 0; i < rows[r].length; i++) {
    const ch = rows[r][i];
    if (ch === '.' || ch === ' ') continue;
    const c = typeof map === 'string' || typeof map === 'number' ? map : map[ch];
    if (c != null) v.set(x + i, y, z + r, c);
  }
}

export const HEART3 = ['X.X', 'XXX', '.X.'];
export const HEART5 = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'];
export const STAR5 = ['..X..', '.XXX.', 'XXXXX', '.XXX.', '.X.X.'];
export const PLUS3 = ['.X.', 'XXX', '.X.'];

// ---------- Aberturas ----------
/** Ventana: vidrio w×h con brillo, alféizar, postigos y jardinera opcionales. */
export function win(v, face, plane, u, y, w = 2, h = 2, o = {}) {
  if (o.frame) fbox(v, face, plane, u - 1, y - 1, w + 2, h + 2, 0, o.frame);
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
    let c = j === h - 1 ? C.glass : C.glassD;
    if ((i === 0 && j === h - 1) || (w > 2 && h > 2 && i === 1 && j === h - 2)) c = C.glassHi;
    if (o.cross && ((w >= 3 && i === Math.floor(w / 2)) || (h >= 3 && j === Math.floor(h / 2)))) c = o.cross;
    if (o.tint) c = shade(o.tint, j === h - 1 ? 0.35 : 0.15);
    fset(v, face, plane, u + i, y + j, 0, c);
  }
  if (o.arch) { // esquinas superiores redondeadas
    fset(v, face, plane, u - 1, y + h, 0, o.arch); fset(v, face, plane, u + w, y + h, 0, o.arch);
    fbox(v, face, plane, u, y + h, w, 1, 0, o.archTop || C.frame);
  }
  if (o.shutters) {
    fbox(v, face, plane, u - 1, y, 1, h, 0, o.shutters);
    fbox(v, face, plane, u + w, y, 1, h, 0, o.shutters);
  }
  if (o.box) {
    fbox(v, face, plane, u - (o.wide ? 1 : 0), y - 1, w + (o.wide ? 2 : 0), 1, 1, o.box);
    const fl = o.flowers || [P.pink, '#ffffff', C.red];
    for (let i = 0; i < w; i++) fset(v, face, plane, u + i, y, 1, i % 2 ? C.leaf : fl[i % fl.length]);
  } else if (o.sill !== false) {
    fbox(v, face, plane, u, y - 1, w, 1, 1, o.sill || C.frame);
  }
  if (o.awning) awning(v, face, plane, u - 1, y + h + 1, w + 2, o.awning, '#ffffff', { depth: 1 });
}

/** Puerta w×h con panel, picaporte dorado, arco y escalón opcionales. y = base de la puerta. */
export function door(v, face, plane, u, y, w = 3, h = 4, c = P.pinkD, o = {}) {
  fbox(v, face, plane, u, y, w, h, 0, c);
  if (w >= 3 && h >= 4) fbox(v, face, plane, u + 1, y + 1, w - 2, h - 2, 0, shade(c, -0.14));
  if (o.glass) fbox(v, face, plane, u + 1, y + h - 2, Math.max(1, w - 2), 1, 0, C.glass);
  if (o.frame) {
    fbox(v, face, plane, u - 1, y, 1, h + 1, 0, o.frame);
    fbox(v, face, plane, u + w, y, 1, h + 1, 0, o.frame);
    fbox(v, face, plane, u, y + h, w, 1, 0, o.frame);
  }
  if (o.arch) { fset(v, face, plane, u, y + h - 1, 0, o.arch); fset(v, face, plane, u + w - 1, y + h - 1, 0, o.arch); }
  fset(v, face, plane, u + w - 1 - (w >= 3 ? 0 : 0), y + Math.floor(h / 2) - (h > 3 ? 1 : 0), 0, o.knob || P.gold);
  if (o.step) fbox(v, face, plane, u - 1, y - 1, w + 2, 1, 1, o.step);
  if (o.heart) fset(v, face, plane, u + Math.floor(w / 2), y + h - 2, 0, o.heart);
}

/** Toldo a rayas que sale de la pared. y = fila superior (pegada a la pared). */
export function awning(v, face, plane, u, y, w, c1, c2 = '#ffffff', o = {}) {
  const depth = o.depth ?? 2, stripe = o.stripe ?? 1;
  for (let i = 0; i < w; i++) {
    const c = Math.floor(i / stripe) % 2 ? c2 : c1;
    for (let d = 1; d <= depth; d++) fset(v, face, plane, u + i, y - (d - 1), d, c);
    if (o.scallop !== false && i % 2 === 0) fset(v, face, plane, u + i, y - depth, depth, c1);
  }
}

// ---------- Techos ----------
/**
 * Techo a dos aguas. axis 'x' = cumbrera a lo largo de x (caídas hacia ±z); 'z' = cumbrera a lo largo de z
 * (triángulo mirando al frente). Rectángulo de paredes [x0..x1]×[z0..z1] inclusive; arranca en y.
 * o: oh (alero), rise (alto por escalón), wall (color del hastial), trim (borde del alero), ridge, stripes
 * Devuelve la y del tope.
 */
export function gable(v, axis, x0, x1, z0, z1, y, roofC, o = {}) {
  const oh = o.oh ?? 1, rise = o.rise ?? 1, wall = o.wall ?? roofC;
  const set = axis === 'x' ? (a, b, yy, c) => v.set(a, yy, b, c) : (a, b, yy, c) => v.set(b, yy, a, c);
  const [A0, A1, B0, B1] = axis === 'x' ? [x0, x1, z0, z1] : [z0, z1, x0, x1];
  let s = 0, top = y;
  for (; ; s++) {
    const bA = B0 - oh + s, bB = B1 + oh - s;
    if (bA > bB) break;
    const last = bA + 1 >= bB;
    let rc = o.stripes === false ? roofC : (s % 2 ? shade(roofC, -0.09) : roofC);
    if (s === 0 && o.trim) rc = o.trim;
    if (last && o.ridge) rc = o.ridge;
    for (let r = 0; r < rise; r++) {
      const yy = y + s * rise + r;
      top = yy;
      for (let a = A0 - oh; a <= A1 + oh; a++) { set(a, bA, yy, rc); set(a, bB, yy, rc); }
      for (let b = bA + 1; b <= bB - 1; b++) for (let a = A0; a <= A1; a++) set(a, b, yy, wall);
      if (o.ends) for (let b = bA + 1; b <= bB - 1; b++) { set(A0 - oh, b, yy, wall); set(A1 + oh, b, yy, wall); }
    }
  }
  return top;
}

/** Techo a cuatro aguas / piramidal con alero. Devuelve y del tope. */
export function hip(v, x0, x1, z0, z1, y, c, o = {}) {
  const oh = o.oh ?? 1, rise = o.rise ?? 1;
  let s = 0, top = y;
  while (true) {
    const ax = x0 - oh + s, bx = x1 + oh - s, az = z0 - oh + s, bz = z1 + oh - s;
    if (ax > bx || az > bz) break;
    let rc = s % 2 ? shade(c, -0.09) : c;
    if (s === 0 && o.trim) rc = o.trim;
    for (let r = 0; r < rise; r++) { v.box(ax, y + s * rise + r, az, bx - ax + 1, 1, bz - az + 1, rc); top = y + s * rise + r; }
    if (o.flat && (bx - ax) <= o.flat) break;
    s++;
  }
  return top;
}

/** Techo cónico (torres redondas). cx,cz pueden ser .5 para centrar en grillas pares. */
export function cone(v, cx, y, cz, r, h, c, o = {}) {
  for (let j = 0; j < h; j++) {
    const rr = Math.max(0.5, r * (1 - j / h));
    const cc = o.bands ? (Math.floor(j / o.bands) % 2 ? shade(c, -0.1) : c) : (j % 2 ? shade(c, -0.07) : c);
    v.cylinder(cx, y + j, cz, rr, 1, j === 0 && o.trim ? o.trim : cc);
  }
  return y + h;
}

/** Almenas sobre un rectángulo [x0..x1]×[z0..z1] a altura y. */
export function battlements(v, x0, x1, z0, z1, y, c, o = {}) {
  const ring = (x, z, i) => { if (i % 2 === 0) v.set(x, y, z, c); };
  let i = 0;
  for (let x = x0; x <= x1; x++) { ring(x, z0, i); ring(x, z1, i); i++; }
  i = 0;
  for (let z = z0; z <= z1; z++) { ring(x0, z, i); ring(x1, z, i); i++; }
  if (o.cap) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (x === x0 || x === x1 || z === z0 || z === z1) v.set(x, y - 1, z, o.cap);
}
/** Almenas en anillo para torre redonda */
export function roundBattlements(v, cx, y, cz, r, c) {
  for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++) for (let k = Math.floor(cz - r); k <= Math.ceil(cz + r); k++) {
    const d = Math.hypot(i - cx, k - cz);
    if (d <= r && d > r - 1.2 && (i + k) % 2 === 0) v.set(i, y, k, c);
  }
}

// ---------- Naturaleza chica ----------
export function flower(v, x, y, z, c, stem = 1) {
  for (let j = 0; j < stem; j++) v.set(x, y + j, z, C.leaf);
  v.set(x, y + stem, z, c);
}
export function tulip(v, x, y, z, c) {
  v.set(x, y, z, C.leafD); v.set(x, y + 1, z, C.leaf); v.set(x, y + 2, z, c); v.set(x, y + 3, z, shade(c, 0.25));
}
/** Cantero con flores de colores. */
export function flowerBed(v, x, y, z, w, d, seed = 1, o = {}) {
  const r = rng(seed);
  v.box(x, y, z, w, 1, d, o.soil || P.grassD);
  const cols = o.colors || FLOWER_COLORS;
  for (let i = 0; i < w; i++) for (let k = 0; k < d; k++) {
    if ((i + k) % 2 === 0 || r() < 0.25) {
      if (r() < 0.3) v.set(x + i, y + 1, z + k, C.leaf);
      else flower(v, x + i, y + 1, z + k, pick(r, cols), r() < 0.5 ? 1 : 0);
    }
  }
}
/** Arbusto redondo con flores opcionales. */
export function bush(v, cx, y, cz, r, c = C.leaf, flowers = null, seed = 3) {
  const R = rng(seed);
  v.sphere(cx, y + r * 0.8, cz, r, r * 0.85, r, (x, yy, z) => (yy > y + r ? shade(c, 0.12) : (R() < 0.3 ? shade(c, -0.1) : c)));
  if (flowers) {
    const pts = [];
    for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++) for (let k = Math.floor(cz - r); k <= Math.ceil(cz + r); k++) for (let j = y; j <= y + r * 2; j++) {
      if (v.has(i, j, k) && !v.has(i, j + 1, k)) pts.push([i, j, k]);
      else if (v.has(i, j, k) && (!v.has(i + 1, j, k) || !v.has(i, j, k + 1)) && R() < 0.3) pts.push([i, j, k]);
    }
    for (const p of pts) if (R() < 0.38) v.set(p[0], p[1], p[2], typeof flowers === 'function' ? flowers(R) : (Array.isArray(flowers) ? pick(R, flowers) : flowers));
  }
}
/** Arbolito redondo (copa esférica). */
export function smallTree(v, x, y, z, h = 4, r = 2.5, leaf = C.leaf, seed = 5, fruits = null) {
  v.box(x, y, z, 1, h, 1, C.trunk);
  bush(v, x, y + h - 1, z, r, leaf, fruits, seed);
}
/** Cerco de estacas blancas a lo largo de x (o z). */
export function picket(v, axis, a0, a1, y, b, c = '#ffffff', gaps = []) {
  for (let a = a0; a <= a1; a++) {
    if (gaps.includes(a)) continue;
    const [x, z] = axis === 'x' ? [a, b] : [b, a];
    v.set(x, y, z, c);
    if (a % 2 === 0) v.set(x, y + 1, z, c); else v.set(x, y + 1, z, c);
    if (a % 2 === 0) v.set(x, y + 2, z, shade(c, -0.05));
  }
}
/** Farolito chico (para jardines). Devuelve la posición de la luz. */
export function lampPost(v, x, y, z, h = 5, pole = P.ink, light = null) {
  v.box(x, y, z, 1, h, 1, pole);
  (light || v).set(x, y + h, z, C.yellow);
  v.set(x, y + h + 1, z, pole);
  return [x, y + h, z];
}

// ---------- Superficies ----------
/** Placa de terreno de 1 vóxel; color puede ser función (x,z)=>color */
export function lot(v, W, D, c, y = 0, h = 1) {
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++)
    for (let j = 0; j < h; j++) v.set(x, y + j, z, typeof c === 'function' ? c(x, z) : c);
}
/** Damero */
export const checker = (a, b, n = 2) => (x, z) => ((Math.floor(x / n) + Math.floor(z / n)) % 2 ? a : b);

/** Sendero de piedras de x0..x1 en z0..z1 */
export function path(v, x0, x1, z0, z1, y, c = C.stoneL) {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) v.set(x, y, z, (x + z) % 3 === 0 ? shade(c, -0.08) : c);
}

/** Estrella 3D plana (patrón 5x5 extruido 1) en el plano z, centrada en cx. */
export function star(v, cx, y, z, c = P.gold, face = 'pz') {
  pattern(v, face, z, cx - 2, y, STAR5, c);
}
/** Corona dorada chica (5 de ancho) sobre (x0,y,z0) — anillo con puntas. */
export function crown(v, x0, y, z0, s = 5, c = P.gold, gem = P.pink) {
  for (let i = 0; i < s; i++) for (let k = 0; k < s; k++) {
    const edge = i === 0 || k === 0 || i === s - 1 || k === s - 1;
    if (!edge) continue;
    v.set(x0 + i, y, z0 + k, c);
    if ((i + k) % 2 === 0) v.set(x0 + i, y + 1, z0 + k, c);
    if ((i === 0 || i === s - 1) && (k === 0 || k === s - 1)) v.set(x0 + i, y + 2, z0 + k, c);
  }
  const m = Math.floor(s / 2);
  v.set(x0 + m, y + 2, z0 + s - 1, gem);
  v.set(x0 + m, y + 1, z0 + s - 1, gem);
}

/** Banderín: mástil + bandera (la bandera puede ir a otra grilla para animarla). */
export function flagPole(v, x, y, z, h, poleC = '#ffffff', ballC = P.gold) {
  v.box(x, y, z, 1, h, 1, poleC);
  v.set(x, y + h, z, ballC);
}
export function flagCloth(v, x, y, z, w, h, c, o = {}) {
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
    if (o.pennant && Math.abs(j - (h - 1) / 2) > (w - i) * (h / 2) / w + 0.01) continue;
    v.set(x + i, y + j, z, (o.stripe && j === Math.floor(h / 2)) ? o.stripe : (i === w - 1 && !o.pennant ? shade(c, -0.08) : c));
  }
}

// ---------- Modelo en construcción (lo compila models.js) ----------
/**
 * m.v      grilla principal (material compartido, con sombra)
 * m.glow   grilla con material que brilla un poco (gemas, vitrinas)
 * m.light  grilla sin iluminación (lamparitas, luces): siempre brillante
 * m.part(name, pivot, {mat, cast}) grilla aparte para animar; pivot = [x,y,z] en coords de vóxel
 * m.animate(fn)  fn(parts, phase) => (dt, t) => void   ;  parts[name] = [mesh, ...]
 */
export class Model {
  constructor(W, D) {
    this.W = W; this.D = D;
    this.v = new Voxels(); this.glow = new Voxels(); this.light = new Voxels();
    this.parts = []; this.anims = []; this.height = null;
  }
  part(name, pivot = null, o = {}) {
    const v = new Voxels();
    this.parts.push({ name, v, pivot, mat: o.mat || 'std', cast: o.cast ?? true });
    return v;
  }
  animate(fn) { this.anims.push(fn); return this; }
}

// ---------- Partes animadas comunes ----------
export function uid(m, prefix) { m._uid = (m._uid || 0) + 1; return prefix + m._uid; }

/** Humo de chimenea: 3 bocanadas que suben y se desvanecen. (x,y,z) = esquina de la bocanada 2x2x2 */
export function addSmoke(m, x, y, z, col = '#f6f2fb') {
  const name = uid(m, 'smoke');
  for (let i = 0; i < 3; i++) m.part(name, [x + 1, y + 1, z + 1], { cast: false }).box(x, y, z, 2, 2, 2, i === 1 ? '#ffffff' : col);
  m.animate((parts, ph) => {
    const arr = parts[name]; if (!arr) return null;
    const base = arr.map(o => o.position.clone());
    return (dt, t) => {
      for (let i = 0; i < arr.length; i++) {
        const k = (t * 0.32 + ph + i / arr.length) % 1, o = arr[i];
        o.position.set(base[i].x + k * 0.14 + Math.sin((t + i) * 1.7) * 0.03, base[i].y + k * 0.85, base[i].z - k * 0.05);
        o.scale.setScalar(0.25 + Math.sin(k * Math.PI) * 0.75);
      }
    };
  });
}
/** Estrella dorada que gira sobre un techo. Centro en (cx+0.5, y+2.5, cz+0.5). */
export function spinStar(m, cx, y, cz, c = P.gold, speed = 1.3) {
  const name = uid(m, 'star');
  const p = m.part(name, [cx + 0.5, y + 2.5, cz + 0.5], { mat: 'glow' });
  pattern(p, 'pz', cz, cx - 2, y, STAR5, c);
  pattern(p, 'pz', cz, cx, y + 2, ['X'], P.goldL);
  m.animate((parts, ph) => {
    const o = parts[name][0], by = o.position.y;
    return (dt, t) => { o.rotation.y = Math.sin((t + ph) * speed) * 0.85; o.position.y = by + Math.sin((t + ph) * 2.2) * 0.035; };
  });
}
/** Brillito (cruz) que titila: escala pulsante. */
export function sparkle(m, x, y, z, c = '#ffffff', speed = 2.5) {
  const name = uid(m, 'spark');
  const p = m.part(name, [x + 0.5, y + 0.5, z + 0.5], { mat: 'light', cast: false });
  p.set(x, y, z, c); p.set(x - 1, y, z, c); p.set(x + 1, y, z, c); p.set(x, y - 1, z, c); p.set(x, y + 1, z, c); p.set(x, y, z - 1, c); p.set(x, y, z + 1, c);
  m.animate((parts, ph) => {
    const o = parts[name][0];
    return (dt, t) => { const k = Math.sin((t + ph * 1.7) * speed); o.scale.setScalar(k > 0 ? 0.35 + k * 0.65 : 0.001); o.rotation.y = t; };
  });
}
/** Bandera que ondea (rotación sobre el mástil). Devuelve la grilla de la tela (dibujar ahí). pivot = mástil. */
export function wavingFlag(m, poleX, y, poleZ, w, h, c, o = {}) {
  const name = uid(m, 'flag');
  const p = m.part(name, [poleX + 0.5, y, poleZ + 0.5], { cast: true });
  flagCloth(p, poleX + 1, y, poleZ, w, h, c, o);
  m.animate((parts, ph) => {
    const f = parts[name][0];
    return (dt, t) => { f.rotation.y = Math.sin((t + ph) * 2.4) * 0.28 + (o.base || 0); f.scale.x = 0.9 + Math.sin((t + ph) * 3.1) * 0.1; };
  });
  return p;
}

/** Faroles dorados a los lados de una puerta (la luz va en m.light, sin sombra). */
export function doorLamps(m, face, plane, u0, u1, y) {
  for (const u of [u0, u1]) {
    fset(m.v, face, plane, u, y, 1, P.goldD); fset(m.light, face, plane, u, y + 1, 1, C.yellow); fset(m.v, face, plane, u, y + 2, 1, P.gold);
  }
}
