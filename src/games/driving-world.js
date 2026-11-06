// Ruta Pixel — mundo vóxel: biomas, piso de la ruta, decorados, ítems y obstáculos.
// Todas las geometrías se generan una sola vez y quedan cacheadas a nivel de módulo
// (si el renderer las libera, three.js las vuelve a subir a la GPU solo).
import * as THREE from 'three';
import { Voxels, shade } from '../core/voxel.js';
import { PALETTE as P } from '../core/data.js';

// ---------- Medidas de la ruta ----------
export const CELL = 0.25;           // tamaño de celda del piso
export const LANE_W = 1.25;
export const LANES = [-LANE_W, 0, LANE_W];
export const CHUNK_LEN = 20;        // largo de cada tramo reciclable
export const BIOME_LEN = 500;       // metros por bioma
const ROWS = CHUNK_LEN / CELL;      // 80 filas por tramo
const HALF_CELLS = 56;              // el piso cubre x ∈ [-14, 14]

// ---------- Biomas ----------
export const BIOMES = [
  {
    id: 'ciudad', name: 'Ciudad Centro', icon: 'castle',
    skyTop: '#86cdfb', skyBot: '#f9f2e8', fog: '#f9f2e8', sun: '#fff6d8',
    hemiSky: '#ffffff', hemiGround: '#c9d5f2',
    road: '#909dba', line: '#fff6ea', curbA: '#ee8a5c', curbB: '#ffffff',
    walkA: '#fdf6e3', walkB: '#fde9d8', grass: '#9be38a', outerL: '#9be38a', outerR: '#9be38a',
  },
  {
    id: 'flores', name: 'Campo de Flores', icon: '🌷',
    skyTop: '#7fd0ff', skyBot: '#fff3c9', fog: '#fff3c9', sun: '#fffbe0',
    hemiSky: '#ffffff', hemiGround: '#d8e8b0',
    road: '#bfb29f', line: '#fffbe8', curbA: '#fdf6e3', curbB: '#ffe9a8',
    walkA: '#e8c99a', walkB: '#dfbd8b', grass: '#8edb78', outerL: '#8edb78', outerR: '#8edb78',
    flowers: ['#ee8a5c', '#ffd166', '#ffffff', '#7f9ee8', '#ff8f8f'],
  },
  {
    id: 'playa', name: 'Playa Dorada', icon: '🏖️',
    skyTop: '#f1a283', skyBot: '#ffe0b8', fog: '#ffe0bf', sun: '#ffe3b0',
    hemiSky: '#fff1e0', hemiGround: '#f7c9b0',
    road: '#baae9c', line: '#fff6ea', curbA: '#ffffff', curbB: '#ffe3a8',
    walkA: '#c99566', walkB: '#b9855a', grass: '#ffe6ad', outerL: '#ffe6ad', outerR: '#78cdf5',
    sand: '#ffe6ad', sea: '#78cdf5', foam: '#f4fbff',
  },
  {
    id: 'cerezos', name: 'Bosque de Cerezos', icon: '🌸',
    skyTop: '#a9bceb', skyBot: '#f9f1e6', fog: '#f9f1e6', sun: '#fcf8f3',
    hemiSky: '#fdfaf6', hemiGround: '#c3d0ef',
    road: '#b5a895', line: '#fcf8f3', curbA: '#ddd5c8', curbB: '#d6c9b6',
    walkA: '#ddd5c8', walkB: '#dcd1c1', grass: '#b4dd94', outerL: '#b4dd94', outerR: '#b4dd94',
    petals: ['#fbd7b7', '#f1a181', '#fde9d8'],
  },
];
export const biomeIndexAt = (m) => ((Math.floor(Math.max(0, m) / BIOME_LEN) % BIOMES.length) + BIOMES.length) % BIOMES.length;

// ---------- Utilidades ----------
export function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  next.int = (n) => Math.floor(next() * n);
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.range = (a, b) => a + next() * (b - a);
  return next;
}

/** Hace que un material "curve" el mundo (efecto planetita): desplaza vértices según la distancia a cámara. */
export function applyBend(mat, uniform) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBend = uniform;
    sh.vertexShader = 'uniform vec2 uBend;\n' + sh.vertexShader.replace('#include <project_vertex>',
      `#include <project_vertex>
      {
        float bz = min(mvPosition.z, 0.0);
        mvPosition.x += uBend.x * bz * bz;
        mvPosition.y -= uBend.y * bz * bz;
        gl_Position = projectionMatrix * mvPosition;
      }`);
  };
  mat.customProgramCacheKey = () => 'pxbend1';
  return mat;
}

export function makeMaterials(bendUniform) {
  const base = applyBend(new THREE.MeshLambertMaterial({ vertexColors: true }), bendUniform);
  const glow = applyBend(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x4a3a33 }), bendUniform);
  const bright = applyBend(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x6a5048 }), bendUniform);
  const coin = applyBend(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x7a5a18 }), bendUniform);
  const plain = applyBend(new THREE.MeshLambertMaterial({ color: 0xffffff }), bendUniform);
  const outerL = applyBend(new THREE.MeshLambertMaterial({ color: 0x9be38a }), bendUniform);
  const outerR = applyBend(new THREE.MeshLambertMaterial({ color: 0x9be38a }), bendUniform);
  const shield = new THREE.MeshLambertMaterial({ color: 0x9ff5dc, emissive: 0x2e8f78, transparent: true, opacity: 0.38, depthWrite: false, flatShading: true });
  return { base, glow, bright, coin, plain, outerL, outerR, shield };
}

const geoCache = new Map();
function cached(key, fn) {
  if (!geoCache.has(key)) geoCache.set(key, fn());
  return geoCache.get(key);
}
/**
 * Mallado "greedy": junta caras vecinas coplanares del mismo color en un solo quad.
 * Mismo look que Voxels.toGeometry pero con muchísimos menos triángulos (clave para 60fps en iPhone).
 */
function greedyGeometry(v, { scale = 1 / 8, center = 'xz', jitter = 0.015 } = {}) {
  const b = v.bounds();
  const mn = b.min, D = [b.max[0] - mn[0], b.max[1] - mn[1], b.max[2] - mn[2]];
  const vol = new Int32Array(D[0] * D[1] * D[2]);
  const at = (x, y, z) => (x * D[1] + y) * D[2] + z;
  for (const [k, c] of v.map) {
    const [x, y, z] = k.split(',').map(Number);
    vol[at(x - mn[0], y - mn[1], z - mn[2])] = c + 1;
  }
  let off = [0, 0, 0];
  if (center) off = [-D[0] / 2, center === 'xyz' ? -D[1] / 2 : 0, -D[2] / 2];
  const pos = [], nor = [], col = [], idx = [];
  const tmp = new THREE.Color();
  const p = [0, 0, 0];
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3, w = (d + 2) % 3;
    const mask = new Int32Array(D[u] * D[w]);
    for (const dir of [1, -1]) {
      for (let i = 0; i < D[d]; i++) {
        mask.fill(0);
        for (let a = 0; a < D[u]; a++) for (let c = 0; c < D[w]; c++) {
          p[d] = i; p[u] = a; p[w] = c;
          const cv = vol[at(p[0], p[1], p[2])];
          if (!cv) continue;
          const ni = i + dir;
          if (ni >= 0 && ni < D[d]) { p[d] = ni; if (vol[at(p[0], p[1], p[2])]) continue; }
          mask[a * D[w] + c] = cv;
        }
        for (let a = 0; a < D[u]; a++) for (let c = 0; c < D[w]; ) {
          const cv = mask[a * D[w] + c];
          if (!cv) { c++; continue; }
          let hw = 1;
          while (c + hw < D[w] && mask[a * D[w] + c + hw] === cv) hw++;
          let hu = 1;
          grow: while (a + hu < D[u]) {
            for (let k = 0; k < hw; k++) if (mask[(a + hu) * D[w] + c + k] !== cv) break grow;
            hu++;
          }
          for (let s = 0; s < hu; s++) for (let k = 0; k < hw; k++) mask[(a + s) * D[w] + c + k] = 0;
          // quad
          const plane = i + (dir > 0 ? 1 : 0);
          const corner = (da, dc) => { const q = [0, 0, 0]; q[d] = plane; q[u] = a + da; q[w] = c + dc; return q; };
          const quad = dir > 0 ? [corner(0, 0), corner(hu, 0), corner(hu, hw), corner(0, hw)] : [corner(0, 0), corner(0, hw), corner(hu, hw), corner(hu, 0)];
          let h = ((a + mn[u]) * 73856093) ^ ((c + mn[w]) * 19349663) ^ ((i + d * 7) * 83492791);
          h = ((h >>> 0) % 1000) / 1000;
          tmp.setHex(jitter ? shade(cv - 1, (h - 0.5) * 2 * jitter) : cv - 1);
          const base = pos.length / 3;
          for (const q of quad) {
            pos.push((q[0] + off[0]) * scale, (q[1] + off[1]) * scale, (q[2] + off[2]) * scale);
            nor.push(d === 0 ? dir : 0, d === 1 ? dir : 0, d === 2 ? dir : 0);
            col.push(tmp.r, tmp.g, tmp.b);
          }
          idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          c += hw;
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
const vgeo = (v, scale = 1 / 8, center = 'xz', jitter = 0.015) => greedyGeometry(v, { scale, center, jitter });

// =====================================================================
// PISO DE LA RUTA (greedy meshing, solo caras visibles)
// =====================================================================
function groundCell(b, i, k, R) {
  const a = Math.abs(i);
  const right = i > 0;
  // asfalto
  if (a <= 8) {
    if (a === 8) return [b.line, 0];
    if (a === 3 && (k % 10) < 5) return [b.line, 0];
    const r = R();
    return [r < 0.05 ? shade(b.road, 0.07) : r < 0.1 ? shade(b.road, -0.05) : b.road, 0];
  }
  if (b.id === 'playa' && right) {
    if (a === 9) return [b.curbA, 1];
    if (a <= 15) { const r = R(); return [r < 0.12 ? shade(b.sand, -0.06) : r < 0.2 ? '#fff4d6' : b.sand, 0]; }
    if (a === 16 || (a === 17 && ((k + i) % 6) < 3)) return [b.foam, 0];
    const r = R();
    return [r < 0.08 ? '#a9e4ff' : r < 0.14 ? shade(b.sea, -0.06) : b.sea, 0];
  }
  if (a === 9) return [(k % 4) < 2 ? b.curbA : b.curbB, 1];
  if (a <= 12) {
    if (b.id === 'ciudad') return [((k >> 1) + (i >> 1)) % 2 ? b.walkA : b.walkB, 1];
    if (b.id === 'playa') return [(k % 6) === 0 ? shade(b.walkA, -0.18) : (k % 3 === 0 ? b.walkB : b.walkA), 1];
    if (b.id === 'cerezos') return [((k >> 1) + (i >> 1)) % 2 ? b.walkA : b.walkB, 1];
    const r = R();
    return [r < 0.15 ? b.walkB : b.walkA, 0];
  }
  // pasto / arena
  const r = R();
  if (b.flowers && r < 0.075) return [b.flowers[Math.floor(R() * b.flowers.length)], 0];
  if (b.petals && r < 0.06) return [b.petals[Math.floor(R() * b.petals.length)], 0];
  if (b.id === 'playa') return [r < 0.12 ? shade(b.sand, -0.06) : r < 0.18 ? '#fff4d6' : b.grass, 0];
  return [r < 0.18 ? shade(b.grass, -0.07) : r < 0.3 ? shade(b.grass, 0.06) : b.grass, 0];
}

function buildGround(bi, variant) {
  const b = BIOMES[bi];
  const NX = HALF_CELLS * 2 + 1, NZ = ROWS;
  const R = rng(1000 + bi * 17 + variant * 131);
  const col = new Int32Array(NX * NZ), hgt = new Int8Array(NX * NZ), used = new Uint8Array(NX * NZ);
  for (let k = 0; k < NZ; k++) for (let ix = 0; ix < NX; ix++) {
    const [c, h] = groundCell(b, ix - HALF_CELLS, k, R);
    col[k * NX + ix] = typeof c === 'number' ? c : parseInt(c.slice(1), 16);
    hgt[k * NX + ix] = h;
  }
  const pos = [], nor = [], cols = [], idx = [];
  const tmp = new THREE.Color();
  const H = 0.125;
  const quad = (verts, n, c) => {
    const base = pos.length / 3;
    tmp.setHex(c);
    for (const v of verts) { pos.push(v[0], v[1], v[2]); nor.push(n[0], n[1], n[2]); cols.push(tmp.r, tmp.g, tmp.b); }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const x0Of = (ix) => (ix - HALF_CELLS) * CELL - CELL / 2;
  for (let k = 0; k < NZ; k++) for (let ix = 0; ix < NX; ix++) {
    const id0 = k * NX + ix;
    if (used[id0]) continue;
    const c = col[id0], h = hgt[id0];
    let w = 1;
    while (ix + w < NX && !used[id0 + w] && col[id0 + w] === c && hgt[id0 + w] === h) w++;
    let d = 1;
    outer: while (k + d < NZ && d < 8) {
      for (let j = 0; j < w; j++) { const q = (k + d) * NX + ix + j; if (used[q] || col[q] !== c || hgt[q] !== h) break outer; }
      d++;
    }
    for (let dd = 0; dd < d; dd++) for (let j = 0; j < w; j++) used[(k + dd) * NX + ix + j] = 1;
    const x0 = x0Of(ix), x1 = x0 + w * CELL, z0 = -k * CELL, z1 = -(k + d) * CELL, y = h * H;
    quad([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [0, 1, 0], c);
  }
  // caras laterales donde cambia la altura (cordones / veredas)
  for (let k = 0; k < NZ; k++) for (let ix = 0; ix < NX - 1; ix++) {
    const a = k * NX + ix, b2 = a + 1;
    const ha = hgt[a], hb = hgt[b2];
    if (ha === hb) continue;
    const xb = x0Of(ix + 1), z0 = -k * CELL, z1 = -(k + 1) * CELL;
    if (ha > hb) quad([[xb, hb * H, z0], [xb, hb * H, z1], [xb, ha * H, z1], [xb, ha * H, z0]], [1, 0, 0], shade(col[a], -0.15));
    else quad([[xb, ha * H, z1], [xb, ha * H, z0], [xb, hb * H, z0], [xb, hb * H, z1]], [-1, 0, 0], shade(col[b2], -0.15));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
export const groundGeo = (bi, variant) => cached(`ground:${bi}:${variant}`, () => buildGround(bi, variant));

/** Plano lateral grande (más allá del piso detallado), subdividido para que se curve bien. */
export function outerGeo() {
  return cached('outer', () => {
    const g = new THREE.PlaneGeometry(240, 330, 2, 110);
    g.rotateX(-Math.PI / 2);
    g.translate(120, -0.02, -140);
    return g;
  });
}

// =====================================================================
// DECORADOS (8 vóxeles por unidad; el frente mira a +Z)
// =====================================================================
const WALLS = ['#fdebdb', '#f8f0e3', '#d4f5ea', '#d9efff', '#fff0c2', '#ffe0cc'];
const ROOFS = ['#ee8a5c', '#7f9ee8', '#4fa8e0', '#ff8f9a', '#3cbf9a', '#e8a93a'];
const GLASS = '#bfe6ff';

function windowAt(v, x, y, z, w, h, axis, out) {
  // ventana en el plano de una pared. axis 'z' => pared frontal (normal +Z), 'x' => pared lateral
  for (let a = -1; a <= w; a++) for (let b = -1; b <= h; b++) {
    const frame = a === -1 || a === w || b === -1 || b === h;
    const c = frame ? '#ffffff' : (a === 0 && b === h - 1 ? '#ffffff' : (b === Math.floor(h / 2) ? '#a8d8f5' : GLASS));
    if (axis === 'z') v.set(x + a, y + b, frame ? z + out : z, c);
    else v.set(frame ? x + out : x, y + b, z + a, c);
  }
}

function houseVox(seed) {
  const R = rng(seed + 11);
  const v = new Voxels();
  const wc = WALLS[seed % WALLS.length], rc = ROOFS[(seed * 5 + 2) % ROOFS.length];
  const W = 18 + 2 * R.int(3), D = 14, H = R() < 0.5 ? 12 : 17;
  v.box(-1, 0, -1, W + 2, 1, D + 2, '#ddd5c8');
  v.box(0, 1, 0, W, H, D, (x, y) => (y <= 2 ? shade(wc, -0.1) : wc));
  for (const [cx, cz] of [[0, 0], [W - 1, 0], [0, D - 1], [W - 1, D - 1]]) v.box(cx, 1, cz, 1, H, 1, '#ffffff');
  // puerta
  const dx = Math.floor(W / 2) - 2;
  v.box(dx - 1, 1, D, 6, 9, 1, '#ffffff');
  v.box(dx, 1, D - 1, 4, 8, 1, P.wood);
  v.box(dx, 1, D, 4, 8, 1, null);
  v.set(dx + 3, 4, D, P.gold);
  v.box(dx - 1, 9, D, 6, 1, 2, rc); // alerito
  // ventanas frente
  windowAt(v, 2, 4, D - 1, 3, 3, 'z', 1);
  windowAt(v, W - 5, 4, D - 1, 3, 3, 'z', 1);
  v.box(1, 3, D, 5, 1, 2, '#c58a5c'); v.box(W - 6, 3, D, 5, 1, 2, '#c58a5c');
  for (let i = 0; i < 5; i++) { v.set(1 + i, 4, D + 1, i % 2 ? P.clay : '#ff5a8a'); v.set(W - 6 + i, 4, D + 1, i % 2 ? '#ffd166' : P.clay); }
  if (H > 14) { windowAt(v, 3, 12, D - 1, 3, 3, 'z', 1); windowAt(v, W - 6, 12, D - 1, 3, 3, 'z', 1); }
  // ventanas laterales (se ven desde la ruta)
  for (const sx of [0, W - 1]) {
    const out = sx === 0 ? -1 : 1;
    windowAt(v, sx, 5, 5, 3, 3, 'x', out);
    if (H > 14) windowAt(v, sx, 12, 5, 3, 3, 'x', out);
  }
  // techo a dos aguas + chimenea
  v.roofX(-1, H + 1, -1, W + 2, D + 2, rc, 0);
  v.box(W - 6, H + 3, 3, 2, 6, 2, '#f7f1e7'); v.box(W - 6, H + 9, 3, 2, 1, 2, '#ada190');
  // arbustitos
  v.sphere(-1, 2, D + 1, 1.6, 1.6, 1.6, P.leaf); v.set(-1, 3, D + 2, P.clay);
  v.sphere(W, 2, D + 1, 1.6, 1.6, 1.6, P.leaf); v.set(W, 3, D + 2, '#ffd166');
  return v;
}

function shopVox(seed) {
  const R = rng(seed + 77);
  const v = new Voxels();
  const kind = seed % 3;
  const wc = ['#fdf6e3', '#f8f0e3', '#d4f5ea'][kind];
  const stripe = ['#ee8a5c', '#7f9ee8', '#3cbf9a'][kind];
  const W = 20, D = 14, H = 14;
  v.box(-1, 0, -1, W + 2, 1, D + 2, '#ddd5c8');
  v.box(0, 1, 0, W, H, D, wc);
  v.box(0, H + 1, 0, W, 1, D, shade(wc, -0.12));
  for (let x = 0; x < W; x += 2) v.set(x, H + 2, 0, wc), v.set(x, H + 2, D - 1, wc);
  // vidriera
  v.box(2, 2, D - 1, 8, 6, 1, GLASS); v.box(3, 6, D - 1, 2, 1, 1, '#ffffff');
  v.box(1, 1, D, 10, 1, 1, '#ffffff');
  v.box(12, 1, D - 1, 5, 8, 1, P.wood); v.set(13, 4, D, P.gold);
  // toldo a rayas
  for (let x = -1; x <= W; x++) for (let s = 0; s < 3; s++) v.set(x, 10 - s, D + s, (x >> 1) % 2 ? stripe : '#ffffff');
  for (let x = -1; x <= W; x += 2) v.set(x, 7, D + 2, stripe);
  // cartel + decoración del techo según tipo
  v.box(4, H + 2, D - 2, 12, 4, 1, '#ffffff'); v.box(5, H + 3, D - 1, 10, 2, 1, stripe);
  if (kind === 0) { // pastelería: torta gigante
    v.cylinder(10, H + 2, 6, 5, 3, '#fcf8f3'); v.cylinder(10, H + 5, 6, 4, 3, '#ffd8c4'); v.cylinder(10, H + 8, 6, 3, 2, '#fcf8f3');
    for (let a = 0; a < 8; a++) v.set(10 + Math.round(Math.cos(a) * 5), H + 4, 6 + Math.round(Math.sin(a) * 5), '#ee8a5c');
    v.box(10, H + 10, 6, 1, 2, 1, '#ff5a6e');
  } else if (kind === 1) { // heladería: cucurucho
    for (let y = 0; y < 7; y++) { const r = 0.6 + y * 0.45; v.cylinder(10, H + 2 + y, 6, r, 1, y % 2 ? '#e8b878' : '#d9a066'); }
    v.sphere(10, H + 11, 6, 3.4, 3, 3.4, '#ffd8c4'); v.sphere(10, H + 14, 6, 2.6, 2.4, 2.6, '#c4f7e8');
    v.set(10, H + 17, 6, '#ff5a6e');
  } else { // florería: macetas y flores
    for (let i = 0; i < 4; i++) { v.box(2 + i * 5, H + 2, 5, 3, 2, 3, '#c58a5c'); v.sphere(3 + i * 5, H + 5, 6, 1.8, 1.6, 1.8, P.leaf); v.set(3 + i * 5, H + 7, 6, R.pick(['#ee8a5c', '#ffd166', '#7f9ee8', '#ffffff'])); }
  }
  for (const sx of [0, W - 1]) windowAt(v, sx, 5, 5, 3, 3, 'x', sx === 0 ? -1 : 1);
  return v;
}

function lampVox() {
  const v = new Voxels();
  v.box(-1, 0, -1, 3, 1, 3, '#6e5a4f');
  v.box(0, 1, 0, 1, 12, 1, '#846a5f');
  v.box(-1, 12, -1, 3, 1, 3, '#6e5a4f');
  v.box(-1, 13, -1, 3, 3, 3, '#fff0c2'); v.set(0, 14, 0, '#ffe08a');
  v.pyramid(-2, 16, -2, 5, 5, P.clay); v.set(0, 19, 0, P.gold);
  v.box(-1, 8, 1, 1, 2, 1, P.clay); v.box(1, 8, 1, 1, 2, 1, P.clay); // moñito
  return v;
}

function treeVox(seed, kind = 'round') {
  const R = rng(seed + 300);
  const v = new Voxels();
  if (kind === 'pine') {
    v.box(3, 0, 3, 2, 4, 2, P.woodD);
    for (let i = 0; i < 4; i++) { const r = 4.6 - i * 1.1; v.cylinder(3.5, 3 + i * 3, 3.5, r, 3, (x, y) => (y % 3 === 2 ? '#4fb06a' : '#3e9e52')); }
    v.set(3, 16, 3, '#ffffff');
    return v;
  }
  if (kind === 'cherry' || kind === 'cherryS') {
    const big = kind === 'cherry';
    const th = big ? 8 : 5;
    v.box(4, 0, 4, 2, th, 2, '#7a4a3a'); v.box(6, th - 2, 4, 2, 1, 1, '#7a4a3a'); v.box(3, th - 1, 5, 1, 1, 1, '#7a4a3a');
    const rr = big ? 5 : 3.6;
    const cols = ['#fbd7b7', '#f1a181', '#fde9d8', '#ffd8c4'];
    const pc = (x, y, z) => { const n = (x * 7 + y * 13 + z * 5 + seed) % 11; return n < 2 ? '#ffffff' : n < 5 ? cols[1] : y > th + rr ? cols[2] : cols[0]; };
    v.sphere(5, th + rr * 0.8, 5, rr, rr * 0.8, rr, pc);
    v.sphere(5 + rr * 0.7, th + rr * 0.6, 5, rr * 0.7, rr * 0.6, rr * 0.7, pc);
    v.sphere(5 - rr * 0.6, th + rr * 0.7, 5 + 1, rr * 0.7, rr * 0.6, rr * 0.7, pc);
    for (let i = 0; i < 6; i++) v.set(R.int(12) - 1, 0, R.int(12) - 1, cols[R.int(3)]);
    return v;
  }
  if (kind === 'palm') {
    let tx = 0;
    for (let i = 0; i < 18; i++) { tx = Math.floor((i * i) / 55); v.box(tx, i, 0, 2, 1, 2, i % 3 === 0 ? '#b07a52' : '#c9935f'); }
    const cx = tx + 0.5, cy = 18;
    v.box(tx - 1, cy - 1, -1, 4, 2, 4, '#3e9e52');
    v.set(tx, cy - 2, 2, '#7a4a2a'); v.set(tx + 1, cy - 2, -1, '#7a4a2a');
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    for (const [dx, dz] of dirs) for (let s = 1; s <= 7; s++) {
      const y = cy + 1 - Math.floor((s * s) / 12);
      v.set(Math.round(cx + dx * s), y, Math.round(0.5 + dz * s), s % 2 ? '#5fc46a' : '#4cb35c');
    }
    return v;
  }
  // árbol redondo
  const leaf = R() < 0.5 ? '#6fd07a' : '#5fc46a';
  v.box(3, 0, 3, 2, 6, 2, P.wood);
  const fruit = kind === 'apple' ? '#ff5a6e' : kind === 'orange' ? '#ffb347' : null;
  v.sphere(3.5, 9, 3.5, 4.4, 3.8, 4.4, (x, y, z) => {
    if (fruit && ((x * 5 + y * 3 + z * 7) % 13) === 0) return fruit;
    return y > 10 ? shade(leaf, 0.12) : (y < 7 ? shade(leaf, -0.1) : leaf);
  });
  return v;
}

function bushVox(seed) {
  const v = new Voxels();
  const R = rng(seed + 9);
  v.sphere(3, 2, 3, 3.4, 2.4, 3, (x, y) => (y > 2 ? '#7fd67a' : '#5fc46a'));
  const fc = ['#ee8a5c', '#ffffff', '#ffd166', '#7f9ee8'][seed % 4];
  for (let i = 0; i < 7; i++) v.set(R.int(7), 2 + R.int(3), R.int(7), fc);
  return v;
}

function planterVox(seed) {
  const v = new Voxels();
  v.box(0, 0, 0, 10, 3, 4, '#f7f1e7'); v.box(0, 3, 0, 10, 1, 4, '#ddd5c8');
  const cols = ['#ee8a5c', '#ffd166', '#7f9ee8', '#ffffff', '#ff8f8f'];
  for (let i = 0; i < 9; i++) { v.set(1 + i, 4, 1 + (i % 2), P.leaf); v.set(1 + i, 5, 1 + (i % 2), cols[(i + seed) % cols.length]); }
  return v;
}

function benchVox() {
  const v = new Voxels();
  v.box(0, 0, 0, 1, 3, 4, '#6e5a4f'); v.box(11, 0, 0, 1, 3, 4, '#6e5a4f');
  v.box(0, 3, 0, 12, 1, 4, '#f1a181'); v.box(0, 4, 3, 12, 3, 1, '#f1a181');
  v.box(0, 5, 3, 12, 1, 1, '#ffd8c4');
  return v;
}

function flowerPatchVox(seed) {
  const R = rng(seed + 500);
  const v = new Voxels();
  const cols = ['#ee8a5c', '#ffd166', '#ffffff', '#7f9ee8', '#ff8f8f', '#8fd3ff'];
  for (let i = 0; i < 18; i++) {
    const x = R.int(12), z = R.int(12), h = 1 + R.int(3), c = R.pick(cols);
    for (let y = 0; y < h; y++) v.set(x, y, z, P.leaf);
    v.set(x, h, z, c);
    if (R() < 0.6) { v.set(x + 1, h, z, c); v.set(x - 1, h, z, c); v.set(x, h, z + 1, c); v.set(x, h, z - 1, c); v.set(x, h, z, '#ffd166'); }
  }
  return v;
}

function tulipFieldVox(seed) {
  const v = new Voxels();
  const rows = [['#ee8a5c', '#ffd8c4'], ['#ffd166', '#fff0c2'], ['#7f9ee8', '#dbe4fa'], ['#ff5a6e', '#ff9ca8'], ['#ffffff', '#fbf7f0']];
  for (let r = 0; r < 6; r++) {
    const [c1, c2] = rows[(r + seed) % rows.length];
    for (let x = 0; x < 20; x++) {
      v.set(x, 0, r * 3, '#7a5a3a'); v.set(x, 0, r * 3 + 1, '#5fc46a');
      if (x % 2 === 0) { v.set(x, 1, r * 3 + 1, '#4cb35c'); v.set(x, 2, r * 3 + 1, (x / 2 + r) % 3 ? c1 : c2); }
    }
  }
  return v;
}

function sunflowerVox(seed) {
  const R = rng(seed + 41);
  const v = new Voxels();
  for (let i = 0; i < 3; i++) {
    const x = i * 4, z = R.int(3), h = 9 + R.int(5);
    v.box(x, 0, z, 1, h, 1, '#4cb35c'); v.set(x + 1, 4, z, '#5fc46a'); v.set(x - 1, 6, z, '#5fc46a');
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) v.set(x + a, h + b, z + 1, a === 0 && b === 0 ? '#7a4a2a' : '#ffd166');
    v.set(x - 2, h, z + 1, '#ffbf3c'); v.set(x + 2, h, z + 1, '#ffbf3c'); v.set(x, h + 2, z + 1, '#ffbf3c'); v.set(x, h - 2, z + 1, '#ffbf3c');
  }
  return v;
}

function fenceVox() {
  const v = new Voxels();
  for (let z = 0; z < 22; z++) { v.set(0, 3, z, '#ffffff'); v.set(0, 5, z, '#ffffff'); }
  for (let z = 0; z < 22; z += 4) { v.box(0, 0, z, 1, 7, 1, '#fdf6e3'); v.set(0, 7, z, '#ffd8c4'); }
  return v;
}

function windmillVox() {
  const v = new Voxels();
  for (let y = 0; y < 24; y++) {
    const r = 6 - y * 0.12;
    v.cylinder(0, y, 0, r, 1, (y >> 2) % 2 ? '#fdf6e3' : '#fbefdc');
  }
  v.box(-2, 0, 4, 4, 7, 2, P.wood); v.box(-2, 7, 5, 4, 1, 1, '#ffffff');
  windowAt(v, -1, 13, 4, 2, 2, 'z', 1);
  for (let s = 0; s < 6; s++) v.cylinder(0, 24 + s, 0, 5.4 - s, 1, s % 2 ? '#f1a181' : P.clay);
  v.box(-1, 18, 3, 3, 3, 3, '#ada190');
  return v;
}
function windmillBladesVox() {
  const v = new Voxels();
  for (let s = 0; s < 4; s++) {
    for (let l = 2; l < 15; l++) for (let w = 0; w < 3; w++) {
      const c = l > 11 ? P.clay : ((l + w) % 2 ? '#ffffff' : '#faf4eb');
      const [x, y] = s === 0 ? [w - 1, l] : s === 1 ? [l, -w + 1] : s === 2 ? [-w + 1, -l] : [-l, w - 1];
      v.set(x, y, 0, c);
    }
  }
  v.box(-1, -1, 0, 3, 3, 2, '#846a5f');
  return v;
}

function barnVox() {
  const v = new Voxels();
  const W = 20, D = 16, H = 13, wc = '#ff8f9a';
  v.box(0, 0, 0, W, H, D, (x, y, z) => ((x + z) % 3 === 0 ? shade(wc, -0.06) : wc));
  for (const [cx, cz] of [[0, 0], [W - 1, 0], [0, D - 1], [W - 1, D - 1]]) v.box(cx, 0, cz, 1, H, 1, '#ffffff');
  v.box(6, 0, D, 8, 9, 1, '#ffffff');
  for (let i = 0; i < 7; i++) { v.set(7 + i, 1 + i, D, '#ffffff'); v.set(13 - i, 1 + i, D, '#ffffff'); }
  v.box(7, 1, D - 1, 6, 7, 1, '#e86a7a');
  v.roofX(-1, H, -1, W + 2, D + 2, '#5a78c4', 0);
  v.box(8, H + 2, D - 1, 4, 3, 2, '#ffffff'); v.box(9, H + 3, D, 2, 1, 1, '#fff0c2');
  return v;
}

function umbrellaVox(seed) {
  const v = new Voxels();
  const c = ['#ee8a5c', '#8fd3ff', '#ffd166', '#7f9ee8'][seed % 4];
  v.box(0, 0, 0, 1, 13, 1, '#ffffff');
  for (let s = 0; s < 4; s++) {
    const r = 7 - s * 1.7;
    for (let x = -7; x <= 7; x++) for (let z = -7; z <= 7; z++) {
      if (x * x + z * z > r * r) continue;
      const sector = Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI / 4)) % 2;
      v.set(x, 12 + s, z, sector ? c : '#ffffff');
    }
  }
  v.set(0, 16, 0, c);
  // toallón
  for (let x = 2; x < 6; x++) for (let z = -4; z < 6; z++) v.set(x, 0, z, (z & 1) ? c : '#ffffff');
  return v;
}

function hutVox(seed) {
  const v = new Voxels();
  const c = ['#8fd3ff', '#f1a181', '#6fe3c1', '#ffd166'][seed % 4];
  const W = 12, D = 12, H = 12;
  v.box(-1, 0, -1, W + 2, 1, D + 2, '#c99566');
  v.box(0, 1, 0, W, H, D, (x, y, z) => ((x + z) % 4 < 2 ? c : '#ffffff'));
  v.box(4, 1, D - 1, 4, 7, 1, P.wood); v.box(4, 1, D, 4, 7, 1, null);
  v.roofX(-1, H + 1, -1, W + 2, D + 2, shade(c, -0.25), 0);
  v.box(W + 1, 1, 3, 1, 8, 2, '#ee8a5c'); // tabla de surf apoyada
  return v;
}

function lifeguardVox() {
  const v = new Voxels();
  for (const [x, z] of [[0, 0], [9, 0], [0, 9], [9, 9]]) v.box(x, 0, z, 1, 12, 1, '#ffffff');
  v.box(-1, 12, -1, 12, 1, 12, '#c99566');
  v.box(1, 13, 1, 8, 7, 8, (x, y, z) => ((y >> 1) % 2 ? '#ff6f6f' : '#ffffff'));
  v.box(2, 15, 9, 6, 3, 1, GLASS);
  v.pyramid(0, 20, 0, 10, 10, '#ff6f6f');
  v.box(5, 25, 5, 1, 6, 1, '#ffffff'); v.box(6, 28, 5, 4, 3, 1, '#ffd166');
  for (let y = 0; y < 12; y += 2) v.box(3, y, 11, 4, 1, 1, '#ffffff');
  return v;
}

function sandcastleVox() {
  const v = new Voxels();
  const s = '#f7d79a', sd = '#e8c27a';
  v.box(0, 0, 0, 12, 3, 12, s);
  for (const [x, z] of [[0, 0], [9, 0], [0, 9], [9, 9]]) { v.box(x, 3, z, 3, 3, 3, sd); v.set(x + 1, 6, z + 1, s); }
  v.box(4, 3, 4, 4, 6, 4, s); v.set(5, 9, 5, sd); v.set(6, 9, 6, sd);
  v.box(6, 10, 5, 1, 4, 1, '#ffffff'); v.box(7, 12, 5, 3, 2, 1, P.clay);
  v.set(2, 0, 13, '#ff6f6f'); v.set(3, 0, 13, '#ff6f6f'); // estrellita de mar
  return v;
}

function rockVox(seed) {
  const v = new Voxels();
  v.sphere(3, 1.5, 3, 3 + (seed % 2), 2.2, 2.6, (x, y) => (y > 2 ? '#efe7dc' : '#d8ccba'));
  return v;
}

function buoyVox(seed) {
  const v = new Voxels();
  const c = seed % 2 ? '#ff6f6f' : '#ee8a5c';
  v.cylinder(2, 0, 2, 2.4, 2, '#ffffff'); v.cylinder(2, 2, 2, 2, 2, c); v.cylinder(2, 4, 2, 1.4, 2, '#ffffff');
  v.box(2, 6, 2, 1, 3, 1, '#6e5a4f'); v.box(2, 9, 2, 1, 1, 1, '#ffd166');
  return v;
}

function sailboatVox(seed) {
  const v = new Voxels();
  const sail = ['#ffffff', '#ffd8c4', '#dbe4fa'][seed % 3];
  for (let z = 0; z < 18; z++) { const w = z < 3 ? 1 + z : z > 14 ? 1 + (17 - z) : 4; v.box(-w, 0, z, w * 2, 3, 1, z % 2 ? '#ffffff' : '#fcf8f3'); }
  v.box(-4, 3, 2, 8, 1, 14, '#c99566');
  v.box(0, 3, 8, 1, 22, 1, '#846a5f');
  for (let y = 0; y < 18; y++) for (let z = 0; z < Math.floor((18 - y) * 0.45); z++) v.set(0, 6 + y, 9 + z, (y >> 2) % 2 ? sail : '#ffffff');
  for (let y = 0; y < 14; y++) for (let z = 0; z < Math.floor((14 - y) * 0.35); z++) v.set(0, 6 + y, 7 - z, sail);
  v.box(0, 25, 8, 1, 2, 3, P.clay);
  return v;
}

function stoneLanternVox() {
  const v = new Voxels();
  v.box(-2, 0, -2, 5, 1, 5, '#ada190'); v.box(-1, 1, -1, 3, 5, 3, '#d8ccba');
  v.box(-2, 6, -2, 5, 1, 5, '#ada190');
  v.box(-1, 7, -1, 3, 3, 3, '#ffe9a8'); v.box(0, 8, -1, 1, 1, 3, '#fff7d6');
  v.pyramid(-3, 10, -3, 7, 7, '#a89a86'); v.set(0, 13, 0, '#f1a181');
  return v;
}

function mushroomVox(seed) {
  const v = new Voxels();
  const cap = ['#ff6f8f', '#7f9ee8', '#ffb347'][seed % 3];
  v.cylinder(3, 0, 3, 1.4, 4, '#fdf6e3');
  for (let y = 0; y < 3; y++) v.cylinder(3, 4 + y, 3, 4 - y * 1.2, 1, (x, yy, z) => ((x * 3 + z * 5 + yy) % 5 === 0 ? '#ffffff' : cap));
  v.cylinder(7, 0, 6, 0.8, 2, '#fdf6e3'); v.cylinder(7, 2, 6, 1.8, 1, cap); v.set(7, 3, 6, cap);
  return v;
}

// Edificios lejanos (antes castillos): 0 = municipalidad con torre de reloj, 1 = faro a rayas.
function castleVox(seed) {
  const v = new Voxels();
  if (seed % 2) {
    // faro
    v.cylinder(18, 0, 14, 9, 3, '#ddd5c8');
    for (let y = 3; y < 38; y++) v.cylinder(18, y, 14, 6 - y * 0.06, 1, Math.floor(y / 6) % 2 ? '#ee6b5a' : '#fdf6e3');
    v.cylinder(18, 38, 14, 5.4, 1, '#3d2f2a');
    v.cylinder(18, 39, 14, 3.6, 4, '#ffe066');
    for (let s = 0; s < 5; s++) v.cylinder(18, 43 + s, 14, 4.6 - s, 1, '#ee8a5c');
    v.box(18, 48, 14, 1, 3, 1, '#ffd166');
    windowAt(v, 17, 14, 19, 2, 3, 'z', 1); windowAt(v, 17, 26, 19, 2, 3, 'z', 1);
    return v;
  }
  const wall = '#f8eedc', roof = '#ee8a5c';
  v.box(4, 0, 6, 28, 16, 16, (x, y) => (y < 3 ? '#d98f6a' : (y % 5) === 0 ? shade(wall, -0.06) : wall));
  for (let s = 0; s < 9; s++) v.box(4 - 1 + s, 16 + s, 5 + s, 30 - 2 * s, 1, 18 - 2 * s, s % 2 ? shade(roof, -0.08) : roof);
  for (const x of [8, 13, 23, 28]) windowAt(v, x, 7, 22, 2, 4, 'z', 1);
  v.box(16, 0, 22, 4, 8, 1, '#8a5a3a');
  // torre del reloj
  v.box(14, 16, 10, 8, 22, 8, (x, y) => ((y % 6) === 0 ? shade(wall, -0.06) : wall));
  v.cylinder(18, 30, 18, 3.2, 1, '#ffd166');
  v.box(16, 28, 18, 4, 4, 1, '#fffaf0'); v.box(17, 30, 19, 1, 2, 1, '#3d2f2a'); v.box(17, 30, 19, 2, 1, 1, '#3d2f2a');
  for (let s = 0; s < 6; s++) v.box(14 + s * 0.7 | 0, 38 + s, 10 + s * 0.7 | 0, 8 - 2 * (s * 0.7 | 0), 1, 8 - 2 * (s * 0.7 | 0), '#7f9ee8');
  v.box(18, 44, 14, 1, 5, 1, '#ffffff'); v.box(19, 47, 14, 4, 2, 1, P.sky);
  return v;
}

function bridgeVox(seed) {
  const v = new Voxels();
  const stone = seed % 2 ? '#faf4ec' : '#fbefdc';
  const rail = seed % 2 ? '#7f9ee8' : '#ee8a5c';
  const HW = 40, top = 34;
  for (let x = -HW; x < HW; x++) {
    const ax = Math.abs(x + 0.5);
    const under = ax >= 30 ? 0 : Math.floor(23 + Math.sqrt(1 - (ax / 30) ** 2) * 7);
    for (let y = under; y < top; y++) for (let z = 0; z < 14; z++) {
      v.set(x, y, z, (y % 4 === 0 || (x + y) % 9 === 0) ? shade(stone, -0.06) : stone);
    }
  }
  for (let x = -HW; x < HW; x++) {
    v.set(x, top, 0, rail); v.set(x, top, 13, rail);
    if (x % 4 === 0) { v.set(x, top + 1, 0, rail); v.set(x, top + 2, 0, rail); v.set(x, top + 1, 13, rail); v.set(x, top + 2, 13, rail); }
    v.set(x, top + 3, 0, rail); v.set(x, top + 3, 13, rail);
  }
  // corazones en el frente del arco
  for (const hx of [-18, 0, 18]) {
    const pat = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
    pat.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') v.set(hx - 3 + i, top - 1 - j, 14, '#ee8a5c'); }));
  }
  // faroles arriba
  for (const lx of [-36, 36]) { v.box(lx, top + 4, 6, 1, 6, 1, '#6e5a4f'); v.box(lx - 1, top + 10, 5, 3, 3, 3, '#fff0c2'); v.pyramid(lx - 2, top + 13, 4, 5, 5, rail); }
  return v;
}

function rainbowVox() {
  const v = new Voxels();
  const bands = ['#ff6f8f', '#ffb347', '#ffd166', '#6fe3c1', '#8fd3ff', '#7f9ee8'];
  const R0 = 31, BW = 2;
  for (let x = -44; x <= 44; x++) for (let y = 0; y <= 44; y++) {
    const r = Math.sqrt(x * x + y * y);
    const b = Math.floor((r - R0) / BW);
    if (b < 0 || b >= bands.length) continue;
    v.set(x, y, 0, bands[bands.length - 1 - b]); v.set(x, y, 1, bands[bands.length - 1 - b]);
  }
  // nubes en las patas
  for (const cx of [-37, 37]) {
    v.sphere(cx, 3, 0.5, 7, 4, 4, '#ffffff'); v.sphere(cx - 4, 2, 2, 4, 3, 3, '#fcf8f3'); v.sphere(cx + 4, 2, 1, 4, 3, 3, '#ffffff');
  }
  return v;
}

function recordArchVox() {
  const v = new Voxels();
  const HW = 34, top = 36;
  for (const x of [-HW, HW - 2]) { v.box(x, 0, 0, 3, top, 3, (xx, y) => ((y >> 2) % 2 ? '#ffd166' : '#ffffff')); v.sphere(x + 1, top + 1, 1, 2.4, 2.4, 2.4, '#ffd166'); }
  for (let x = -HW + 3; x < HW - 2; x++) for (let y = top - 7; y < top; y++) v.set(x, y, 1, ((x >> 1) + (y >> 1)) % 2 ? '#ffd166' : '#fff8e0');
  // coronita al centro
  const pat = ['X..XX..X', 'XX.XX.XX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX'];
  pat.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') { v.set(-4 + i, top + 5 - j, 1, j > 2 ? '#e8a93a' : '#ffd166'); v.set(-4 + i, top + 5 - j, 2, '#ffd166'); } }));
  v.set(-1, top + 2, 3, '#ee8a5c'); v.set(2, top + 2, 3, '#8fd3ff');
  return v;
}

// --------- registro de decorados ---------
// orient: 'face' = el frente (+Z) mira a la ruta | 'along' = queda paralelo a la ruta | 'any' = rotación libre
// w: ancho aproximado (unidades) para ubicarlo sin pisar la vereda. glow: usa material brillante.
const DECO = {
  house0: { fn: () => houseVox(0), orient: 'face', w: 2.6 }, house1: { fn: () => houseVox(1), orient: 'face', w: 2.6 },
  house2: { fn: () => houseVox(2), orient: 'face', w: 2.6 }, house3: { fn: () => houseVox(3), orient: 'face', w: 2.6 },
  house4: { fn: () => houseVox(4), orient: 'face', w: 2.6 }, house5: { fn: () => houseVox(5), orient: 'face', w: 2.6 },
  shop0: { fn: () => shopVox(0), orient: 'face', w: 2.6 }, shop1: { fn: () => shopVox(1), orient: 'face', w: 2.6 }, shop2: { fn: () => shopVox(2), orient: 'face', w: 2.6 },
  lamp: { fn: lampVox, orient: 'any', w: 0.3, glow: true },
  tree0: { fn: () => treeVox(0), orient: 'any', w: 1.1 }, tree1: { fn: () => treeVox(1, 'apple'), orient: 'any', w: 1.1 },
  tree2: { fn: () => treeVox(2, 'orange'), orient: 'any', w: 1.1 }, pine: { fn: () => treeVox(3, 'pine'), orient: 'any', w: 1.1 },
  cherry0: { fn: () => treeVox(4, 'cherry'), orient: 'any', w: 1.6 }, cherry1: { fn: () => treeVox(5, 'cherry'), orient: 'any', w: 1.6 },
  cherryS: { fn: () => treeVox(6, 'cherryS'), orient: 'any', w: 1 },
  palm0: { fn: () => treeVox(7, 'palm'), orient: 'any', w: 1.2 }, palm1: { fn: () => treeVox(8, 'palm'), orient: 'any', w: 1.2 },
  bush0: { fn: () => bushVox(0), orient: 'any', w: 0.8 }, bush1: { fn: () => bushVox(1), orient: 'any', w: 0.8 }, bush2: { fn: () => bushVox(2), orient: 'any', w: 0.8 },
  planter0: { fn: () => planterVox(0), orient: 'along', w: 0.5 }, planter1: { fn: () => planterVox(2), orient: 'along', w: 0.5 },
  bench: { fn: benchVox, orient: 'face', w: 0.6 },
  flowers0: { fn: () => flowerPatchVox(0), orient: 'any', w: 1.5 }, flowers1: { fn: () => flowerPatchVox(1), orient: 'any', w: 1.5 },
  flowers2: { fn: () => flowerPatchVox(2), orient: 'any', w: 1.5 },
  tulips0: { fn: () => tulipFieldVox(0), orient: 'along', w: 2.4 }, tulips1: { fn: () => tulipFieldVox(2), orient: 'along', w: 2.4 },
  sunflowers0: { fn: () => sunflowerVox(0), orient: 'face', w: 1.4 }, sunflowers1: { fn: () => sunflowerVox(1), orient: 'face', w: 1.4 },
  fence: { fn: fenceVox, orient: 'none', w: 0.2 },
  windmill: { fn: windmillVox, orient: 'face', w: 1.6, extra: { fn: windmillBladesVox, pos: [0, 19.5 / 8, 6 / 8], scale: 1 / 8 } },
  barn: { fn: barnVox, orient: 'face', w: 2.6 },
  umbrella0: { fn: () => umbrellaVox(0), orient: 'any', w: 1.6 }, umbrella1: { fn: () => umbrellaVox(1), orient: 'any', w: 1.6 },
  umbrella2: { fn: () => umbrellaVox(2), orient: 'any', w: 1.6 }, umbrella3: { fn: () => umbrellaVox(3), orient: 'any', w: 1.6 },
  hut0: { fn: () => hutVox(0), orient: 'face', w: 1.8 }, hut1: { fn: () => hutVox(1), orient: 'face', w: 1.8 }, hut2: { fn: () => hutVox(2), orient: 'face', w: 1.8 },
  lifeguard: { fn: lifeguardVox, orient: 'face', w: 1.5 },
  sandcastle: { fn: sandcastleVox, orient: 'face', w: 1.2 },
  rock0: { fn: () => rockVox(0), orient: 'any', w: 0.8 }, rock1: { fn: () => rockVox(1), orient: 'any', w: 0.8 },
  buoy0: { fn: () => buoyVox(0), orient: 'any', w: 0.5 }, buoy1: { fn: () => buoyVox(1), orient: 'any', w: 0.5 },
  sail0: { fn: () => sailboatVox(0), orient: 'none', w: 1.2 }, sail1: { fn: () => sailboatVox(1), orient: 'none', w: 1.2 }, sail2: { fn: () => sailboatVox(2), orient: 'none', w: 1.2 },
  slantern: { fn: stoneLanternVox, orient: 'any', w: 0.6, glow: true },
  mush0: { fn: () => mushroomVox(0), orient: 'any', w: 1 }, mush1: { fn: () => mushroomVox(1), orient: 'any', w: 1 }, mush2: { fn: () => mushroomVox(2), orient: 'any', w: 1 },
  castle0: { fn: () => castleVox(0), orient: 'face', w: 4.5, scale: 1.5 }, castle1: { fn: () => castleVox(1), orient: 'face', w: 4.5, scale: 1.5 },
  bridge0: { fn: () => bridgeVox(0), orient: 'none', w: 10 }, bridge1: { fn: () => bridgeVox(1), orient: 'none', w: 10 },
  rainbow: { fn: rainbowVox, orient: 'none', w: 11, glow: true },
  recordArch: { fn: recordArchVox, orient: 'none', w: 9, glow: true },
};
export const DECO_INFO = DECO;
export function decoGeo(kind) {
  return cached('deco:' + kind, () => vgeo(DECO[kind].fn()));
}
export function decoExtraGeo(kind) {
  const ex = DECO[kind]?.extra;
  if (!ex) return null;
  return cached('decoX:' + kind, () => greedyGeometry(ex.fn(), { scale: ex.scale, center: 'xyz', jitter: 0.015 }));
}

// Qué aparece en cada franja según bioma. Listas [tipo, peso]; null = vacío.
const L = (...pairs) => pairs;
export const BIOME_DECO = {
  ciudad: {
    lampChance: 0.55,
    near: { L: L(['tree0', 3], ['tree1', 1], ['bush0', 2], ['bush1', 2], ['planter0', 1], ['planter1', 1], ['bench', 1.2], [null, 1]), R: null },
    mid: { L: L(['house0', 2], ['house1', 2], ['house2', 2], ['house3', 2], ['house4', 2], ['house5', 2], ['shop0', 1.4], ['shop1', 1.4], ['shop2', 1.4]), R: null },
    far: { L: L(['tree0', 3], ['tree2', 1], ['house1', 1], ['house3', 1], ['castle0', 0.5], ['castle1', 0.5], ['pine', 1]), R: null },
    over: L(['bridge0', 1], ['bridge1', 1], ['rainbow', 0.5]), overChance: 0.14,
  },
  flores: {
    lampChance: 0,
    near: { L: L(['flowers0', 2], ['flowers1', 2], ['flowers2', 2], ['fence', 2.5], ['bush2', 1], ['sunflowers0', 1], [null, 1]), R: null },
    mid: { L: L(['tulips0', 2], ['tulips1', 2], ['windmill', 1.4], ['barn', 1], ['tree1', 1.4], ['tree0', 1], ['sunflowers1', 1.2]), R: null },
    far: { L: L(['tree0', 2], ['tree1', 1], ['windmill', 1], ['castle0', 0.4], ['tulips0', 1], [null, 1]), R: null },
    over: L(['rainbow', 1]), overChance: 0.2,
  },
  playa: {
    lampChance: 0,
    near: {
      L: L(['palm0', 2], ['palm1', 2], ['umbrella0', 1.4], ['umbrella1', 1.4], ['umbrella2', 1.4], ['umbrella3', 1.4], ['sandcastle', 1.2], [null, 0.6]),
      R: L(['umbrella0', 1], ['umbrella2', 1], ['sandcastle', 1], ['rock0', 1], ['palm1', 1], [null, 1.5]),
    },
    mid: { L: L(['hut0', 1.4], ['hut1', 1.4], ['hut2', 1.4], ['lifeguard', 1], ['palm0', 1.5], ['palm1', 1.5]), R: L(['buoy0', 1], ['buoy1', 1], ['rock1', 1], [null, 2]) },
    far: { L: L(['palm0', 2], ['palm1', 2], ['hut1', 1], ['castle1', 0.4]), R: L(['sail0', 1], ['sail1', 1], ['sail2', 1], ['buoy0', 0.6], [null, 1.5]) },
    over: L(['rainbow', 1]), overChance: 0.05,
  },
  cerezos: {
    lampChance: 0,
    near: { L: L(['slantern', 2], ['mush0', 1.2], ['mush1', 1.2], ['mush2', 1], ['cherryS', 2.5], ['bush1', 1], [null, 0.8]), R: null },
    mid: { L: L(['cherry0', 3], ['cherry1', 3], ['cherryS', 1], ['pine', 0.8], ['slantern', 0.6]), R: null },
    far: { L: L(['cherry0', 3], ['cherry1', 3], ['pine', 1], ['castle0', 0.4], ['castle1', 0.4]), R: null },
    over: L(['bridge0', 1], ['bridge1', 1]), overChance: 0.12,
  },
};
export function pickWeighted(list, R) {
  let tot = 0;
  for (const [, w] of list) tot += w;
  let r = R() * tot;
  for (const [k, w] of list) { r -= w; if (r <= 0) return k; }
  return list[list.length - 1][0];
}

// =====================================================================
// ÍTEMS (sprites vóxel extruidos que giran) y OBSTÁCULOS
// =====================================================================
function patternVox(rows, colorOf, depth = 2) {
  const v = new Voxels();
  const H = rows.length;
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    for (let z = 0; z < depth; z++) v.set(i, H - 1 - j, z, colorOf(ch, i, j, z));
  }));
  return v;
}
const ITEM_FN = {
  coin: () => {
    const v = new Voxels();
    const star = ['..X..', '.XXX.', 'XXXXX', '.XXX.', '.X.X.'];
    for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) {
      const dx = x - 5.5, dy = y - 5.5, r2 = dx * dx + dy * dy;
      if (r2 > 36) continue;
      const rim = r2 > 20;
      let c = rim ? (dx + dy > 2 ? '#f0a92a' : '#ffc93c') : '#ffdc4a';
      if (!rim && dx < -1.5 && dy > 1.5) c = '#fff7c4';
      const sx = x - 3, sy = 8 - y;
      const isStar = sx >= 0 && sx < 5 && sy >= 0 && sy < 5 && star[sy][sx] === 'X';
      if (isStar) c = '#fff3a8';
      for (let z = 0; z < 3; z++) {
        if (!rim && !isStar && z !== 1) continue;
        v.set(x, y, z, z === 1 || rim ? c : '#fff3a8');
      }
    }
    return v;
  },
  gem: () => {
    const v = new Voxels();
    for (let y = -5; y <= 3; y++) {
      const r = y >= 0 ? 4 - Math.max(0, y - 1) * 1.2 : 4 + y * 0.8;
      for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) {
        if (Math.abs(x) + Math.abs(z) > r) continue;
        const c = y >= 2 ? '#d4efff' : y >= 0 ? ((x + z) % 2 ? '#8fd3ff' : '#b8e6ff') : (x > 0 ? '#4fa8e0' : '#6fbcf0');
        v.set(x, y, z, c);
      }
    }
    return v;
  },
  heart: () => patternVox(['.XX.XX.', 'XWXXXXX', 'XWXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
    (ch, i, j) => (ch === 'W' ? '#ffffff' : (i > 4 && j > 2 ? '#c8673d' : '#ee8a5c')), 2),
  magnet: () => patternVox(['SS...SS', 'SS...SS', 'RR...RR', 'RR...RR', 'RRR.RRR', '.RRRRR.', '..RRR..'],
    (ch, i) => (ch === 'S' ? (i % 2 ? '#ffffff' : '#ddd5c8') : (i > 3 ? '#e04a6a' : '#ff5a7e')), 2),
  shield: () => patternVox(['XXXXXXX', 'XXHXHXX', 'XHHHHHX', 'XHHHHHX', '.XHHHX.', '.XXHXX.', '..XXX..', '...X...'],
    (ch, i) => (ch === 'H' ? '#ffffff' : (i > 3 ? '#3cbf9a' : '#6fe3c1')), 2),
  turbo: () => patternVox(['...YYY', '..YYY.', '.YYY..', 'YYYYYY', '..YYY.', '.YYY..', 'YYY...', 'Y.....'],
    (ch, i, j) => (j > 3 ? '#ffb347' : '#ffd166'), 2),
};
const ITEM_SCALE = { coin: 1 / 19, gem: 1 / 18, heart: 1 / 12, magnet: 1 / 12, shield: 1 / 12, turbo: 1 / 12 };
export function itemGeo(kind) {
  return cached('item:' + kind, () => greedyGeometry(ITEM_FN[kind](), { scale: ITEM_SCALE[kind], center: 'xyz', jitter: 0.012 }));
}

function coneVox(v, ox, oz) {
  v.box(ox - 2, 0, oz - 2, 5, 1, 5, '#6e5a4f');
  for (let y = 1; y < 7; y++) {
    const r = y < 3 ? 1 : y < 5 ? 1 : 0;
    const c = y === 3 || y === 4 ? '#ffffff' : '#ff8f6f';
    v.box(ox - r, y, oz - r, r * 2 + 1, 1, r * 2 + 1, c);
  }
}
const OBST_FN = {
  barrier: () => {
    const v = new Voxels();
    for (const x of [0, 9]) { v.box(x, 0, -1, 1, 1, 3, '#6e5a4f'); v.box(x, 1, 0, 1, 6, 1, '#846a5f'); }
    for (let x = 0; x < 10; x++) for (let y = 4; y < 7; y++) v.set(x, y, 1, ((x + y) >> 1) % 2 ? '#ee8a5c' : '#ffffff');
    v.box(4, 7, 1, 2, 1, 1, '#ffd166');
    return v;
  },
  cones: () => { const v = new Voxels(); coneVox(v, -4, 0); coneVox(v, 4, 0); coneVox(v, 0, 3); return v; },
  puddle: () => {
    const v = new Voxels();
    for (let x = -5; x <= 5; x++) for (let z = -8; z <= 8; z++) {
      const e = (x * x) / 27 + (z * z) / 64 + 0.12 * Math.sin(x * 1.3 + z * 0.7);
      if (e > 1) continue;
      const c = (x === -2 && z > -4 && z < 0) || (x === 2 && z > 2 && z < 5) ? '#ffffff' : e > 0.75 ? '#7cc6f0' : '#a9dcff';
      v.set(x, 0, z, c);
    }
    return v;
  },
};
const OBST_SCALE = { barrier: 1 / 8, cones: 1 / 9, puddle: 1 / 8 };
export function obstacleGeo(kind) {
  return cached('obst:' + kind, () => greedyGeometry(OBST_FN[kind](), { scale: OBST_SCALE[kind], center: 'xz', jitter: 0.015 }));
}

/** Burbuja del escudo */
export function shieldGeo() {
  return cached('shieldBubble', () => new THREE.IcosahedronGeometry(0.82, 1));
}
/** Cubito para partículas (con color de vértice blanco: el color va por instancia) */
export function particleGeo() {
  return cached('particle', () => {
    const g = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    const n = g.attributes.position.count;
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3));
    return g;
  });
}
/** Precalienta todas las geometrías (para que el primer frame no tironee). */
export function warmup() {
  for (let b = 0; b < BIOMES.length; b++) { groundGeo(b, 0); groundGeo(b, 1); }
  for (const k of Object.keys(DECO)) { decoGeo(k); decoExtraGeo(k); }
  for (const k of Object.keys(ITEM_FN)) itemGeo(k);
  for (const k of Object.keys(OBST_FN)) obstacleGeo(k);
}
