// Kit de herramientas para modelar edificios vóxel (usado por models-*.js).
// Convenciones: coordenadas enteras de vóxel en el "footprint" [0,W)×[0,D); y = arriba; frente = +Z.
import { Voxels, shade } from '../core/voxel.js';
import { PALETTE } from '../core/data.js';

export const P = PALETTE;
export { Voxels, shade };

export const C = {
  glass: '#bfe8ff', glassD: '#93d0f2', glassHi: '#ffffff',
  frame: '#ffffff', trim: '#fffaf1',
  stoneL: '#f4efe8', stone: P.stone, stoneD: P.stoneD,
  roofClay: '#eb794b', roofSlate: '#698cdc', roofMint: '#45c9a2', roofSky: '#5fb4ea',
  leaf: P.leaf, leafD: P.leafD, leafL: '#8ee08a',
  trunk: P.wood, trunkD: P.woodD,
  red: '#ff5a6e', yellow: '#ffe066', orange: '#ffa64d', white: '#ffffff', cream: P.cream,
  waffle: '#e8b062', waffleD: '#c98d45', choco: '#8a5a3a',
  gold: P.gold, goldD: P.goldD, goldL: P.goldL,
  water: '#8fe0ff', waterD: '#5cc6f0', waterL: '#d6f5ff',
};

export const FLOWER_COLORS = [P.clay, '#ffffff', P.slate, C.yellow, C.red, P.sky, P.peach];

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
    const fl = o.flowers || [P.clay, '#ffffff', C.red];
    for (let i = 0; i < w; i++) fset(v, face, plane, u + i, y, 1, i % 2 ? C.leaf : fl[i % fl.length]);
  } else if (o.sill !== false) {
    fbox(v, face, plane, u, y - 1, w, 1, 1, o.sill || C.frame);
  }
  if (o.awning) awning(v, face, plane, u - 1, y + h + 1, w + 2, o.awning, '#ffffff', { depth: 1 });
}

/** Puerta w×h con panel, picaporte dorado, arco y escalón opcionales. y = base de la puerta. */
export function door(v, face, plane, u, y, w = 3, h = 4, c = P.clayD, o = {}) {
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
    // pocas flores: muchas pintitas sueltas se ven como ruido con pixeles de render chicos
    for (const p of pts) if (R() < 0.2) v.set(p[0], p[1], p[2], typeof flowers === 'function' ? flowers(R) : (Array.isArray(flowers) ? pick(R, flowers) : flowers));
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
export function crown(v, x0, y, z0, s = 5, c = P.gold, gem = P.clay) {
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
export function addSmoke(m, x, y, z, col = '#fbf7f2') {
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

// =====================================================================
// Capa de época (DESIGN-CORE.md §4.4)
// =====================================================================
// Cada edificio se dibuja con "ranuras" de material (muro, techo, base, abertura, cerco, elemento vertical) y la
// época las resuelve: el mismo builder sirve para Madera, Piedra, Ladrillo, Hierro y Vidrio y acero.
//   eraStyle(era)                                    paleta + formas de la época
//   eraWall(m, x, y, z, w, h, d, era, o)             volumen con el patrón del material
//   eraRoof(m, x0, x1, z0, z1, y, era, o)            techo (o.kind: paja | dos_aguas | alto | cuatro_aguas | plano | mansarda | diente | terraza)
//   eraOpening(m, face, plane, u, y, era, kind, o)   puerta | ventana | vidriera
//   eraVertical(m, x, y, z, era, o)                  chimenea de piedra / torre / chimenea alta / tanque / antena
//   eraCrown(m, cx, y, cz, era, o)                   remate del nivel 5
//   eraFence(m, era, o) · eraGround(m, era, o)       cerco del lote (nivel 5) y piso del lote
//   eraRecolor(m, era)                               respaldo para builders sin arte por época
import { ERA_PALETTES as EP } from '../core/palette.js';

export const ERA_COUNT = 5;
export const clampEra = (e) => Math.max(1, Math.min(ERA_COUNT, Math.round(Number(e)) || 1));
const hash2 = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export const ERA_STYLE = {
  1: { id: 'madera', name: 'Madera',
    wall: EP.madera.plank, wallD: EP.madera.plankD, joint: EP.madera.joint, trim: EP.madera.post, roof: EP.madera.thatch,
    roofD: EP.madera.thatchD, roof2: EP.madera.shingle, base: EP.madera.stone, baseD: EP.madera.stoneD,
    frame: EP.madera.post, accent: EP.madera.moss, door: EP.madera.joint, fence: EP.madera.post, light: EP.madera.light,
    ground: P.grass, groundD: P.grassD, path: '#c9a878', roofKind: 'paja', roofKind3: 'alto', floors: 1, FH: 7 },
  2: { id: 'piedra', name: 'Piedra',
    wall: EP.piedra.stone, wallD: EP.piedra.stoneD, joint: EP.piedra.joint, trim: EP.piedra.stoneL, roof: EP.piedra.slate,
    roofD: EP.piedra.slateD, roof2: EP.piedra.slate, base: EP.piedra.stoneD, baseD: EP.piedra.joint,
    frame: EP.piedra.beam, accent: EP.piedra.beam, door: EP.piedra.beam, fence: EP.piedra.stoneD, light: EP.piedra.light,
    ground: P.grass, groundD: P.grassD, path: EP.piedra.stoneL, roofKind: 'dos_aguas', roofKind3: 'alto', floors: 1, FH: 7 },
  3: { id: 'ladrillo', name: 'Ladrillo',
    wall: EP.ladrillo.brick, wallD: EP.ladrillo.brickD, joint: EP.ladrillo.joint, trim: EP.ladrillo.cream, roof: EP.ladrillo.tile,
    roofD: EP.ladrillo.tileD, roof2: EP.ladrillo.tile, base: EP.ladrillo.creamD, baseD: EP.ladrillo.creamD,
    frame: EP.ladrillo.frame, accent: EP.ladrillo.iron, door: EP.ladrillo.frame, fence: EP.ladrillo.iron, light: EP.ladrillo.cream,
    ground: '#dccbab', groundD: '#c4b69d', path: '#e8d9bb', roofKind: 'cuatro_aguas', roofKind3: 'mansarda', floors: 2, FH: 6 },
  4: { id: 'hierro', name: 'Hierro',
    wall: EP.hierro.brick, wallD: '#734536', sheet: EP.hierro.sheet, sheetD: EP.hierro.sheetD, joint: EP.hierro.ironD, trim: EP.hierro.iron, roof: EP.hierro.sheet,
    roofD: EP.hierro.sheetD, roof2: EP.hierro.rust, base: EP.hierro.black, baseD: EP.hierro.black,
    frame: EP.hierro.ironD, accent: EP.hierro.rust, door: EP.hierro.black, fence: EP.hierro.iron, light: EP.hierro.lamp,
    brick: EP.hierro.brick, ground: '#8e8a84', groundD: '#76726c', path: '#a8a39b', roofKind: 'plano', roofKind3: 'diente', floors: 2, FH: 6 },
  5: { id: 'vidrio', name: 'Vidrio y acero',
    wall: EP.vidrio.glass, wallD: EP.vidrio.glassD, joint: EP.vidrio.steelD, trim: EP.vidrio.steel, roof: EP.vidrio.white,
    roofD: EP.vidrio.steelD, roof2: EP.vidrio.terrace, base: EP.vidrio.white, baseD: EP.vidrio.steelD,
    frame: EP.vidrio.steel, accent: EP.vidrio.terrace, door: EP.vidrio.glassD, fence: EP.vidrio.steel, light: EP.vidrio.white,
    panel: EP.vidrio.panel, ground: '#dedbd3', groundD: '#c9c5bb', path: '#f2f0ea', roofKind: 'plano', roofKind3: 'terraza', floors: 3, FH: 5 },
};
export const eraStyle = (era) => ERA_STYLE[clampEra(era)];

/**
 * Color del muro de la época en un vóxel de superficie. u = coordenada a lo largo de la cara; k = alto desde la base del muro.
 * corner = esquina del volumen. o.tint reemplaza el material principal (fachada pintada) y conserva la estructura.
 */
export function eraWallColor(era, u, k, corner, o = {}) {
  const s = eraStyle(era), e = s.id, FH = o.FH || s.FH;
  const main = o.tint || s.wall, mainD = o.tint ? shade(o.tint, -0.16) : s.wallD;
  if (k === 0 && !o.noBase) {
    if (e === 'madera' || e === 'piedra') return Math.floor(u / 2) % 2 ? s.base : s.baseD;
    return s.base;
  }
  switch (e) {
    case 'madera':
      if (corner) return s.trim;
      return k % 3 === 0 ? mainD : main;                                  // tablas con junta oscura cada 3
    case 'piedra': {
      if (corner) return Math.floor(k / 2) % 2 ? s.trim : s.wall;           // sillares en las esquinas
      const c = Math.floor(k / 2), st = Math.floor((u + (c % 2) * 2) / 4);
      const h = hash2(st * 7 + (o.seed || 0), c);
      return h < 0.28 ? mainD : h > 0.86 ? s.trim : main;                   // hiladas irregulares
    }
    case 'ladrillo': {
      if (o.floorLines !== false && k > 1 && (k - 1) % FH === 0) return s.trim; // cornisa crema entre pisos
      if (corner) return mainD;
      if (k % 4 === 2) return s.joint;                                     // junta clara
      const off = (Math.floor(k / 4) % 2) * 2;
      return hash2(Math.floor((u + off) / 4) + (o.seed || 0), Math.floor(k / 4)) < 0.22 ? mainD : main;
    }
    case 'hierro': {
      if (corner || u % 5 === 0) return s.trim;                            // pilares remachados
      if (o.floorLines !== false && k > 1 && (k - 1) % FH === 0) return s.trim; // viga entre pisos
      if (o.sheet) return u % 5 === 3 ? s.sheetD : s.sheet;               // galpón de chapa acanalada
      return k % 3 === 0 ? mainD : main;                                   // paño de ladrillo industrial
    }
    default: {                                                              // vidrio y acero: muro cortina
      if (corner) return s.trim;
      if ((k - 1) % FH === 0) return s.light;                               // losa blanca de cada piso
      if (u % 3 === 0) return s.trim;                                      // montantes
      return (k - 1) % FH === FH - 1 ? s.wall : s.wallD;
    }
  }
}

/**
 * Volumen macizo [x..x+w)×[y..y+h)×[z..z+d) con el patrón del material de la época en las caras. Es macizo a propósito:
 * una cáscara hueca le haría emitir al mallado también las caras de adentro (el doble de triángulos).
 */
export function eraWall(m, x, y, z, w, h, d, era, o = {}) {
  const v = m.v || m;
  const inner = eraStyle(era).wallD;
  for (let i = 0; i < w; i++) for (let k = 0; k < d; k++) {
    const onX = i === 0 || i === w - 1, onZ = k === 0 || k === d - 1;
    if (!onX && !onZ) { for (let j = 0; j < h; j++) v.set(x + i, y + j, z + k, inner); continue; }
    const corner = onX && onZ;
    const u = onZ ? x + i : z + k;
    for (let j = 0; j < h; j++) v.set(x + i, y + j, z + k, eraWallColor(era, u, j + (o.k0 || 0), corner, o));
  }
  // tapa (si no le va techo encima, que no quede hueco)
  if (o.cap !== false) for (let i = 1; i < w - 1; i++) for (let k = 1; k < d - 1; k++) v.set(x + i, y + h - 1, z + k, o.capColor || eraStyle(era).wallD);
  return y + h;
}

/** Losa/cornisa saliente alrededor de un rectángulo (borde del techo plano, balcón corrido). */
export function eraSlab(m, x0, x1, z0, z1, y, c, oh = 1) {
  const v = m.v || m;
  for (let x = x0 - oh; x <= x1 + oh; x++) for (let z = z0 - oh; z <= z1 + oh; z++) v.set(x, y, z, c);
}

/** Techo de la época. o: kind, axis ('x' | 'z'), oh, color, wall (color del hastial). Devuelve la y del tope. */
export function eraRoof(m, x0, x1, z0, z1, y, era, o = {}) {
  const v = m.v, s = eraStyle(era);
  const kind = o.kind || s.roofKind;
  const axis = o.axis || 'z';
  const roofC = o.color || (kind === 'alto' ? s.roof2 : s.roof);
  const wall = o.wall || (s.id === 'madera' ? s.wallD : s.id === 'ladrillo' ? s.wall : s.trim);
  switch (kind) {
    case 'paja':        // paja gruesa con alero y cumbrera oscura
      return gable(v, axis, x0, x1, z0, z1, y, roofC, { wall, oh: o.oh ?? 1, trim: s.roofD, ridge: s.roof2 });
    case 'dos_aguas':
      return gable(v, axis, x0, x1, z0, z1, y, roofC, { wall, oh: o.oh ?? 1, trim: s.id === 'piedra' ? s.frame : s.roofD, ridge: s.roofD });
    case 'alto':        // más pendiente: sube 2 por escalón
      return gable(v, axis, x0, x1, z0, z1, y, roofC, { wall, oh: o.oh ?? 1, rise: 2, trim: s.roofD, ridge: s.id === 'madera' ? s.joint : s.roofD });
    case 'cuatro_aguas':
      return hip(v, x0, x1, z0, z1, y, roofC, { oh: o.oh ?? 1, trim: s.trim });
    case 'mansarda': {  // faldón empinado + tapa con cresta de hierro y buhardillas al frente
      const oh = o.oh ?? 1;
      for (let x = x0 - oh; x <= x1 + oh; x++) for (let z = z0 - oh; z <= z1 + oh; z++) v.set(x, y, z, s.trim);
      let top = y;
      for (let st = 0; st < 2; st++) for (let r = 0; r < 2; r++) {
        const yy = y + 1 + st * 2 + r;
        v.box(x0 + st, yy, z0 + st, x1 - x0 + 1 - st * 2, 1, z1 - z0 + 1 - st * 2, r === 0 ? s.roofD : roofC);
        top = yy;
      }
      if (x1 - x0 >= 12) for (let x = x0 + 2; x <= x1 - 2; x++) for (const z of [z0 + 2, z1 - 2]) v.set(x, top + 1, z, s.trim);  // cresta
      if (o.dormers !== false) for (let u = x0 + 2; u + 1 <= x1 - 2; u += 5) {
        v.box(u, y + 1, z1 + 1, 2, 2, 1, s.trim); v.set(u, y + 1, z1 + 1, C.glass); v.set(u + 1, y + 1, z1 + 1, C.glassD);
        v.box(u, y + 3, z1 + 1, 2, 1, 1, s.roofD);
      }
      return top + 1;
    }
    case 'diente': {    // galpón en diente de sierra: pendiente de chapa y cara vidriada
      const oh = o.oh ?? 0, T = 4;
      for (let x = x0 - oh; x <= x1 + oh; x++) for (let z = z0 - oh; z <= z1 + oh; z++) v.set(x, y, z, s.trim);
      for (let z = z0; z <= z1; z++) {
        const p = (z1 - z) % T;                  // 0 = punta baja de cada diente (hacia el frente)
        const hh = 1 + p;
        for (let x = x0; x <= x1; x++) {
          for (let j = 1; j <= hh; j++) v.set(x, y + j, z, j === hh ? (x % 2 ? roofC : s.roofD) : s.trim);
          if (p === T - 1) for (let j = 1; j <= hh; j++) v.set(x, y + j, z - 1 >= z0 ? z : z, j === hh ? s.roofD : (x % 3 === 0 ? s.frame : C.glassD));
        }
      }
      return y + T;
    }
    case 'terraza': {   // techo plano con terraza verde, baranda fina y alero
      eraSlab(m, x0, x1, z0, z1, y, s.light, o.oh ?? 1);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const edge = x === x0 || x === x1 || z === z0 || z === z1;
        v.set(x, y + 1, z, edge ? s.trim : ((x * 3 + z) % 7 === 0 ? EP.vidrio.terraceD : s.roof2));
      }
      // baranda de vidrio corrida (nada de almenas)
      for (let x = x0; x <= x1; x++) for (const z of [z0, z1]) v.set(x, y + 2, z, C.glassD);
      for (let z = z0; z <= z1; z++) for (const x of [x0, x1]) v.set(x, y + 2, z, C.glassD);
      return y + 2;
    }
    default: {          // plano con parapeto de la época
      const oh = o.oh ?? (s.id === 'vidrio' ? 1 : 0);
      eraSlab(m, x0, x1, z0, z1, y, s.id === 'vidrio' ? s.light : s.id === 'hierro' ? s.sheet : s.trim, oh);
      for (let x = x0 - oh; x <= x1 + oh; x++) for (let z = z0 - oh; z <= z1 + oh; z++) {
        const edge = x === x0 - oh || x === x1 + oh || z === z0 - oh || z === z1 + oh;
        if (!edge) continue;
        v.set(x, y + 1, z, s.id === 'madera' ? s.wallD : s.trim);           // parapeto corrido (sin almenas)
      }
      return y + 1;
    }
  }
}

/**
 * Abertura de la época en una cara. kind: 'puerta' | 'ventana' | 'vidriera'. o.big = aberturas del nivel 4 (más grandes).
 * y = base de la abertura. Devuelve el ancho usado.
 */
export function eraOpening(m, face, plane, u, y, era, kind = 'ventana', o = {}) {
  const v = m.v || m, s = eraStyle(era), e = s.id;
  if (kind === 'puerta') {
    const w = o.w || (e === 'piedra' || e === 'hierro' || e === 'vidrio' || o.big ? 3 : 2), h = o.h || 4;
    if (e === 'vidrio') {
      fbox(v, face, plane, u, y, w, h, 0, (i, j) => (i === 0 || i === w - 1 || j === h - 1 ? s.trim : j === h - 2 ? C.glass : C.glassD));
      fbox(v, face, plane, u - 1, y + h, w + 2, 1, 1, s.trim);
    } else {
      door(v, face, plane, u, y, w, h, o.color || s.door, { frame: s.trim, glass: e !== 'madera', knob: e === 'hierro' ? s.light : P.goldD });
      if (e === 'piedra') { fset(v, face, plane, u - 1, y + h + 1, 0, s.trim); fbox(v, face, plane, u, y + h + 1, w, 1, 0, s.trim); fset(v, face, plane, u + w, y + h + 1, 0, s.trim); }
      if (e === 'ladrillo') fbox(v, face, plane, u - 1, y + h + 1, w + 2, 1, 0, s.trim);          // dintel crema
      if (e === 'hierro') fbox(v, face, plane, u - 1, y + h + 1, w + 2, 1, 1, s.trim);            // marquesina de hierro
    }
    return w;
  }
  if (kind === 'vidriera') {
    const w = o.w || 6, h = o.h || 4;
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
      let c = j === h - 1 ? C.glass : C.glassD;
      if (e === 'hierro' && (i % 3 === 0 || j === Math.floor(h / 2))) c = s.frame;
      if (e === 'piedra' && (i === 0 || i === w - 1)) c = s.trim;
      fset(v, face, plane, u + i, y + j, 0, c);
    }
    fbox(v, face, plane, u - 1, y - 1, w + 2, 1, 1, s.trim);                                      // mostrador
    if (e !== 'vidrio') fbox(v, face, plane, u - 1, y + h, w + 2, 1, 0, e === 'ladrillo' ? s.trim : s.frame);
    return w;
  }
  // ventana
  const big = !!o.big;
  switch (e) {
    case 'madera': {
      const w = big ? 3 : 2, h = 2;
      win(v, face, plane, u, y, w, h, { shutters: s.trim, sill: s.wallD, cross: big ? s.trim : null, box: o.box, flowers: o.flowers });
      return w;
    }
    case 'piedra': {
      const w = big ? 3 : 2, h = 3;
      win(v, face, plane, u, y, w, h, { arch: s.trim, archTop: s.trim, sill: s.trim, cross: big ? s.frame : null, box: o.box, flowers: o.flowers });
      return w;
    }
    case 'ladrillo': {
      const w = big ? 3 : 2, h = big ? 4 : 3;
      win(v, face, plane, u, y, w, h, { sill: s.trim, shutters: big ? null : s.frame, cross: big ? s.frame : null, box: o.box, flowers: o.flowers });
      fbox(v, face, plane, u - 1, y + h, w + 2, 1, 0, s.trim);                                  // dintel
      return w;
    }
    case 'hierro': {
      const w = big ? 4 : 3, h = big ? 4 : 3;
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) fset(v, face, plane, u + i, y + j, 0, (i === Math.floor(w / 2) && w > 3) || j === Math.floor(h / 2) ? s.frame : j === h - 1 ? C.glass : C.glassD);
      fbox(v, face, plane, u, y - 1, w, 1, 1, s.trim);
      return w;
    }
    default: {
      const w = big ? 5 : 4, h = 3;
      fbox(v, face, plane, u, y, w, h, 0, (i, j) => (j === h - 1 ? C.glass : C.glassD));
      return w;
    }
  }
}

/**
 * Elemento vertical de la época (nivel 4). (x, z) = esquina; y = base. o.h = alto; o.w = ancho (torre y tanque).
 * madera: chimenea de piedra · piedra: torre cuadrada con techo de pizarra · ladrillo: chimenea alta ·
 * hierro: tanque de agua sobre patas · vidrio: antena con luz. Devuelve la y del tope.
 */
export function eraVertical(m, x, y, z, era, o = {}) {
  const v = m.v, s = eraStyle(era);
  switch (s.id) {
    case 'madera': {
      const h = o.h || 9;
      v.box(x, y, z, 2, h, 2, (xx, yy, zz) => (hash2(xx * 5 + zz, yy) < 0.3 ? s.baseD : s.base));
      v.box(x, y + h, z, 2, 1, 2, s.baseD);
      addSmoke(m, x, y + h + 1, z);
      return y + h + 1;
    }
    case 'piedra': {
      const w = o.w || 4, h = o.h || 10;
      eraWall(m, x, y, z, w, h, w, era, { noBase: true });
      for (const [fc, pl] of [['pz', z + w - 1], ['px', x + w - 1]]) {
        const uu = fc === 'pz' ? x + 1 : z + 1;
        fbox(v, fc, pl, uu, y + h - 4, w - 2, 2, 0, P.ink);                                        // campanario
        fbox(v, fc, pl, uu, y + h - 2, w - 2, 1, 0, s.trim);
      }
      const top = hip(v, x, x + w - 1, z, z + w - 1, y + h, s.roof, { oh: 1, trim: s.frame });
      v.set(x + Math.floor(w / 2), top + 1, z + Math.floor(w / 2), s.frame);
      return top + 2;
    }
    case 'ladrillo': {
      const h = o.h || 14;
      v.box(x, y, z, 2, h, 2, (xx, yy) => (yy === y + h - 3 ? s.trim : (yy % 4 === 2 ? s.joint : s.wall)));
      v.box(x, y + h, z, 2, 1, 2, s.accent);
      addSmoke(m, x, y + h + 1, z, '#ece6dc');
      return y + h + 1;
    }
    case 'hierro': {
      const w = o.w || 4, legs = o.h || 5;
      for (const [a, b] of [[0, 0], [w - 1, 0], [0, w - 1], [w - 1, w - 1]]) v.box(x + a, y, z + b, 1, legs, 1, s.trim);
      for (let a = 0; a < w; a++) { v.set(x + a, y + 2, z, s.joint); v.set(x + a, y + 2, z + w - 1, s.joint); }
      const cx = x + (w - 1) / 2, cz = z + (w - 1) / 2;
      v.cylinder(cx, y + legs, cz, w / 2 + 0.3, 5, (xx, yy) => (yy === y + legs + 1 || yy === y + legs + 3 ? s.trim : s.accent));
      cone(v, cx, y + legs + 5, cz, w / 2 + 0.6, 3, s.sheetD || s.trim);
      return y + legs + 8;
    }
    default: {
      const h = o.h || 10;
      v.box(x, y, z, 1, h, 1, s.trim);
      for (let j = 3; j < h; j += 3) { v.set(x - 1, y + j, z, s.trim); v.set(x + 1, y + j, z, s.trim); }
      m.light.set(x, y + h, z, '#ff6a5a');
      v.box(x + 1, y, z + 1, 2, 1, 2, s.trim); v.set(x + 2, y + 1, z + 2, s.light); v.set(x + 1, y + 2, z + 2, s.light); // parabólica
      return y + h + 1;
    }
  }
}

/** Piso del lote según la época (y = 0). o.path = [x0, x1] del caminito hasta la puerta (desde o.pathZ hasta el frente). */
export function eraGround(m, era, o = {}) {
  const v = m.v, s = eraStyle(era), W = m.W, D = m.D;
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    let c;
    if (s.id === 'madera' || s.id === 'piedra') c = (x * 3 + z * 5) % 11 === 0 ? s.groundD : s.ground;
    else if (s.id === 'ladrillo') c = (Math.floor(x / 2) + Math.floor(z / 2)) % 2 ? s.ground : s.groundD;
    else if (s.id === 'hierro') c = ((z % 2 ? x + 1 : x) >> 1) % 2 ? s.ground : s.groundD;    // adoquines
    else c = (x % 4 === 0 || z % 4 === 0) ? s.groundD : s.ground;                             // baldosones
    v.set(x, 0, z, c);
  }
  if (o.path) for (let x = o.path[0]; x <= o.path[1]; x++) for (let z = o.pathZ ?? D - 5; z < D; z++) v.set(x, 0, z, s.id === 'madera' ? ((x + z) % 3 ? s.path : shade(s.path, -0.12)) : s.path);
}

/** Cerco o vereda de la época alrededor del lote (nivel 5). o.gaps = columnas x libres en el frente (la entrada). */
export function eraFence(m, era, o = {}) {
  const v = m.v, s = eraStyle(era), W = m.W, D = m.D, gaps = o.gaps || [];
  const ring = [];
  for (let x = 0; x < W; x++) { ring.push([x, D - 1, 'f']); ring.push([x, 0, 'b']); }
  for (let z = 1; z < D - 1; z++) { ring.push([0, z, 'l']); ring.push([W - 1, z, 'r']); }
  for (const [x, z, side] of ring) {
    if (side === 'f' && gaps.includes(x)) continue;
    if (v.has(x, 1, z)) continue;
    const a = side === 'f' || side === 'b' ? x : z;
    switch (s.id) {
      case 'madera':   // palo a pique con travesaño
        if (a % 3 === 0) { v.box(x, 1, z, 1, 3, 1, s.fence); v.set(x, 4, z, s.wallD); } else v.set(x, 2, z, s.wall);
        break;
      case 'piedra':   // pirca baja
        v.set(x, 1, z, hash2(x, z) < 0.4 ? s.wallD : s.wall); if (a % 2 === 0) v.set(x, 2, z, s.trim);
        break;
      case 'ladrillo': // murito de ladrillo con reja de hierro arriba
        v.set(x, 1, z, s.wall); v.set(x, 2, z, s.trim); if (a % 2 === 0) v.set(x, 3, z, s.accent);
        if (a % 6 === 0) { v.box(x, 1, z, 1, 4, 1, s.wall); v.set(x, 5, z, s.trim); }
        break;
      case 'hierro':   // reja negra con puntas
        if (a % 2 === 0) { v.box(x, 1, z, 1, 3, 1, s.fence); if (a % 4 === 0) v.set(x, 4, z, s.trim); } else v.set(x, 3, z, s.fence);
        break;
      default:         // vereda moderna: canteros bajos con pasto y luces al ras
        v.set(x, 1, z, a % 5 === 0 ? s.trim : s.accent);
        if (a % 5 === 0) m.light.set(x, 2, z, '#fff3cf');
    }
  }
  if (s.id === 'hierro') for (const [x, z] of [[0, D - 1], [W - 1, D - 1]]) if (!gaps.includes(x)) {
    v.box(x, 1, z, 1, 6, 1, s.fence); m.light.set(x, 7, z, s.light); v.set(x, 8, z, s.fence);      // faroles a gas
  }
}

/** Remate del nivel 5 sobre un techo en (cx, y, cz): mirador, espadaña, cúpula, letrero iluminado o pérgola verde. */
export function eraCrown(m, cx, y, cz, era, o = {}) {
  const v = m.v, s = eraStyle(era);
  switch (s.id) {
    case 'madera': {   // mirador de troncos con techito de paja y banderín
      for (const [a, b] of [[0, 0], [2, 0], [0, 2], [2, 2]]) v.box(cx - 1 + a, y, cz - 1 + b, 1, 3, 1, s.trim);
      v.box(cx - 1, y, cz - 1, 3, 1, 3, s.wallD);
      const t = hip(v, cx - 1, cx + 1, cz - 1, cz + 1, y + 3, s.roof, { oh: 1 });
      v.box(cx, t + 1, cz, 1, 3, 1, s.trim);
      wavingFlag(m, cx, t + 2, cz, 3, 2, o.flag || P.clay);
      return t + 4;
    }
    case 'piedra': {   // espadaña con campana
      v.box(cx - 2, y, cz, 5, 5, 1, s.trim);
      v.box(cx - 1, y + 1, cz, 3, 3, 1, P.ink); v.box(cx, y + 2, cz, 1, 2, 1, P.goldD);
      v.box(cx - 1, y + 5, cz, 3, 1, 1, s.trim); v.set(cx, y + 6, cz, s.trim); v.set(cx, y + 7, cz, s.frame);
      return y + 8;
    }
    case 'ladrillo': { // cúpula de tejas con linterna
      v.cylinder(cx + 0.5, y, cz + 0.5, 2.6, 2, s.trim);
      for (let j = 0; j < 4; j++) v.cylinder(cx + 0.5, y + 2 + j, cz + 0.5, 2.6 - j * 0.6, 1, j % 2 ? s.roofD : s.roof);
      v.box(cx, y + 6, cz, 2, 2, 2, s.trim); v.set(cx, y + 8, cz, s.accent);
      return y + 9;
    }
    case 'hierro': {   // letrero iluminado sobre estructura de hierro
      const w = o.w || 9, x0 = cx - Math.floor(w / 2);
      for (const a of [x0, x0 + w - 1]) v.box(a, y, cz, 1, 3, 1, s.trim);
      for (let i = 0; i < w; i++) for (let j = 0; j < 3; j++) {
        const edge = i === 0 || i === w - 1 || j === 0 || j === 2;
        if (edge) m.light.set(x0 + i, y + 3 + j, cz, (i + j) % 2 ? s.light : '#fff3cf');
        else v.set(x0 + i, y + 3 + j, cz, o.sign || s.accent);
      }
      return y + 6;
    }
    default: {         // pérgola sobre la terraza verde
      for (const [a, b] of [[0, 0], [4, 0], [0, 4], [4, 4]]) v.box(cx - 2 + a, y, cz - 2 + b, 1, 3, 1, s.trim);
      for (let i = 0; i < 5; i++) { v.set(cx - 2 + i, y + 3, cz - 2, s.trim); v.set(cx - 2 + i, y + 3, cz + 2, s.trim); v.set(cx - 2 + i, y + 3, cz, s.trim); }
      bush(v, cx + 0.5, y, cz + 0.5, 1.3, P.leaf, [P.clay], cx);
      return y + 4;
    }
  }
}

// ---------- Respaldo: recoloreo de época ----------
/**
 * Para los builders que todavía no tienen arte por época: lleva los muros, techos y maderas del modelo hacia la
 * paleta de la época (vidrios, plantas, agua y luces quedan). Época 1 = sin cambios.
 */
export function eraRecolor(m, era) {
  era = clampEra(era);
  if (era === 1) return;
  const s = eraStyle(era);
  const hx = (c) => (typeof c === 'number' ? c : parseInt(c.slice(1), 16));
  const tgt = { wallL: hx(s.id === 'ladrillo' || s.id === 'piedra' ? s.trim : s.light), wall: hx(s.wall), wallD: hx(s.wallD), roof: hx(s.id === 'vidrio' ? s.trim : s.roof), roofD: hx(s.roofD), wood: hx(s.frame) };
  const mix = (a, b, k) => {
    const r = (a >> 16) & 255, g = (a >> 8) & 255, bl = a & 255;
    return (Math.round(r + (((b >> 16) & 255) - r) * k) << 16) | (Math.round(g + (((b >> 8) & 255) - g) * k) << 8) | Math.round(bl + ((b & 255) - bl) * k);
  };
  const glass = new Set([C.glass, C.glassD, C.glassHi].map(hx));
  const waterSet = new Set([C.water, C.waterD, C.waterL, P.water].map(hx));
  const yOf = (k) => +k.slice(k.indexOf(',') + 1, k.lastIndexOf(','));
  let maxY = 1;
  for (const k of m.v.map.keys()) { const y = yOf(k); if (y > maxY) maxY = y; }
  const cache = new Map();
  for (const [k, c] of m.v.map) {
    const y = yOf(k);
    if (y === 0) continue;                                 // el piso del lote queda (lo maneja el tema)
    const hi = y > maxY * 0.55;
    const key = c * 2 + (hi ? 1 : 0);
    let out = cache.get(key);
    if (out === undefined) {
      out = c;
      if (!glass.has(c)) {
        const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510, sat = mx ? (mx - mn) / mx : 0;
        const plant = g > r + 10 && g >= b;                 // plantas
        const water = waterSet.has(c) || (b > r + 60 && g > r + 30 && sat > 0.4);   // agua (cian), no muros azul pizarra
        if (!plant && !water) {
          if (l > 0.82) out = mix(c, tgt.wallL, 0.55);
          else if (sat > 0.35 && hi) out = mix(c, l > 0.5 ? tgt.roof : tgt.roofD, 0.7);
          else if (l > 0.55) out = mix(c, tgt.wall, 0.6);
          else out = mix(c, l > 0.35 ? tgt.wallD : tgt.wood, 0.55);
        }
      }
      cache.set(key, out);
    }
    if (out !== c) m.v.map.set(k, out);
  }
}
