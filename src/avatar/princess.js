// Modelo vóxel de la princesa, estilo chibi (cabeza grande, ojitos con brillo, cachetes rosas).
// API (ver DESIGN.md):
//   princessModel(look, opts) -> THREE.Group  (altura ≈ 1 unidad, mira a +Z, base en y=0)
//     group.userData.update(dt, moving)  — camina (piernas/brazos/rebote) o idle (respira, parpadea)
//     opts.seated: true  -> solo torso/cabeza/brazos (para sentarla en el auto), brazos al volante
//   randomLook(seed) -> look válido determinista (vecinas NPC)
// Las geometrías se cachean por pieza+colores: crear muchas princesas es barato.
import * as THREE from 'three';
import { Voxels, voxelMaterial, shade, hexToInt } from '../core/voxel.js';
import {
  SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS, HAIR_STYLES, DRESS_STYLES, CROWNS, ACCESSORIES,
} from '../core/data.js';

/** Tamaño de un vóxel de la princesa en unidades de mundo. */
export const PRINCESS_VOXEL = 1 / 24;
const S = PRINCESS_VOXEL;

const INK = 0x3b2340;
const WHITE = 0xfff7fb;
const GOLD = 0xffd166, GOLD_D = 0xe8a93a, GOLD_L = 0xfff0c2;
const TIE = 0xff6fae;

// ---------------- Utilidades de color ----------------
function mix(a, b, t) {
  a = hexToInt(a); b = hexToInt(b);
  const r = ((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t;
  const g = ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t;
  const bl = (a & 255) * (1 - t) + (b & 255) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}
const hash3 = (x, y, z) => {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const byId = (list, id) => list.find(i => i.id === id) || list[0];
const hairHex = (id) => byId(HAIR_COLORS, id).hex;
const outfitHex = (id) => byId(OUTFIT_COLORS, id).hex;
const skinHex = (i) => SKIN_TONES[Math.max(0, Math.min(SKIN_TONES.length - 1, i | 0))] || SKIN_TONES[0];

/** Completa/corrige un look (ids inválidos -> primer valor). */
export function normalizeLook(look = {}) {
  const ok = (list, id) => (list.some(i => i.id === id) ? id : list[0].id);
  const skin = Number.isFinite(+look.skin) ? Math.max(0, Math.min(SKIN_TONES.length - 1, Math.round(+look.skin))) : 0;
  return {
    skin,
    hair: ok(HAIR_STYLES, look.hair),
    hairColor: ok(HAIR_COLORS, look.hairColor),
    dress: ok(DRESS_STYLES, look.dress),
    dressColor: ok(OUTFIT_COLORS, look.dressColor),
    crown: ok(CROWNS, look.crown),
    acc: ok(ACCESSORIES, look.acc),
  };
}

// ---------------- Caché de geometrías ----------------
const geoCache = new Map();
function cachedGeo(key, build, after) {
  if (geoCache.has(key)) return geoCache.get(key);
  const v = new Voxels();
  build(v);
  let g = null;
  if (v.size) {
    g = v.toGeometry({ scale: S, jitter: 0.03 });
    after?.(g);
  }
  geoCache.set(key, g);
  return g;
}
function meshOf(geo) {
  const m = new THREE.Mesh(geo, voxelMaterial());
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function pivot(x, y, z) { const g = new THREE.Group(); g.position.set(x * S, y * S, z * S); return g; }

// =====================================================================
//                              CABEZA + PELO
// Coordenadas locales de la cabeza: x [-6,6), y [0,10), z [-5,5). Cara en la capa z=4.
// =====================================================================
function hairPal(hex) {
  return { b: hexToInt(hex), d: shade(hex, -0.2), l: shade(hex, 0.22), ll: shade(hex, 0.4) };
}
// Color con mechones verticales suaves
const strand = (h) => (x, y, z) => (((x * 7 + z * 3) & 3) === 0 ? h.d : h.b);

function capTop(v, h) {
  for (let x = -6; x <= 5; x++) for (let z = -5; z <= 4; z++) {
    const ex = x === -6 || x === 5, ez = z === -5 || z === 4;
    if (ex && ez) continue;
    v.set(x, 10, z, h.b);
  }
  for (let x = -5; x <= 4; x++) for (let z = -4; z <= 3; z++) {
    const ex = x === -5 || x === 4, ez = z === -4 || z === 3;
    if (ex && ez) continue;
    v.set(x, 11, z, h.b);
  }
  // brillo del pelo
  for (const [x, z] of [[-3, 1], [-2, 1], [-2, 2], [-1, 2], [-3, 0], [0, 3], [-4, 2]]) v.set(x, 11, z, h.l);
  v.set(-1, 11, 3, h.ll); v.set(-2, 11, 3, h.l);
}
function sides(v, h, yMin, zMin = -5, zMax = 3, wave = null) {
  const col = strand(h);
  for (let y = yMin; y <= 10; y++) for (let z = zMin; z <= zMax; z++) {
    const o = wave ? wave(y) : 0;
    v.set(-7 - Math.max(0, -o), y, z, col(-7, y, z));
    v.set(6 + Math.max(0, o), y, z, col(6, y, z));
  }
}
function back(v, h, yMin, wave = null, tip = null) {
  const col = strand(h);
  for (let y = yMin; y <= 10; y++) {
    const o = wave ? wave(y) : 0;
    const x0 = (y === yMin ? -5 : -6) + o, x1 = (y === yMin ? 4 : 5) + o;
    for (let x = x0; x <= x1; x++) {
      const c = tip && y < tip.y ? tip.c : col(x, y, -6);
      v.set(x, y, -6, c);
      if (y < 0) v.set(x, y, -5, c);
    }
    if (y < 0 && y > yMin) { // relleno lateral detrás de los hombros
      v.set(-7 + o, y, -6, col(-7, y, -6)); v.set(6 + o, y, -6, col(6, y, -6));
    }
  }
}
// Flequillos (después de dibujar la cara)
function bangsFull(v, h) {
  for (let x = -5; x <= 4; x++) { v.set(x, 9, 4, h.b); v.set(x, 8, 4, h.b); }
  for (const x of [-5, -4, -3, -1, 0, 2, 3, 4]) v.set(x, 7, 4, h.b);
  for (let x = -4; x <= 3; x++) { v.set(x, 9, 5, h.b); v.set(x, 10, 5, x > -3 && x < 2 ? h.l : h.b); }
  for (const x of [-4, -3, 0, -1, 2, 3]) v.set(x, 8, 5, h.d);
  for (let y = 3; y <= 9; y++) { v.set(-6, y, 4, h.b); v.set(5, y, 4, h.b); }
}
function bangsSide(v, h, flip = false) {
  const X = (x) => (flip ? -1 - x : x);
  for (let x = -5; x <= 4; x++) { v.set(x, 9, 4, h.b); v.set(x, 8, 4, h.b); }
  for (let x = -5; x <= 1; x++) v.set(X(x), 7, 4, h.b);
  for (let x = -5; x <= -3; x++) v.set(X(x), 6, 4, h.d);
  for (let x = -5; x <= 2; x++) v.set(X(x), 9, 5, h.b);
  for (let x = -5; x <= 0; x++) v.set(X(x), 8, 5, x > -4 ? h.d : h.b);
  for (let x = -4; x <= 3; x++) v.set(X(x), 10, 5, x > -3 && x < 1 ? h.l : h.b);
  for (let y = 3; y <= 9; y++) { v.set(-6, y, 4, h.b); v.set(5, y, 4, h.b); }
}
function bangsPart(v, h) {
  for (const s of [-1, 1]) {
    const X = (x) => (s < 0 ? x : -1 - x);
    for (let x = -5; x <= -2; x++) { v.set(X(x), 9, 4, h.b); v.set(X(x), 8, 4, h.b); v.set(X(x), 9, 5, h.b); v.set(X(x), 10, 5, h.b); }
    for (let x = -5; x <= -3; x++) v.set(X(x), 7, 4, h.b);
    v.set(X(-5), 6, 4, h.d);
    v.set(X(-3), 8, 5, h.d);
  }
  v.set(-1, 10, 5, h.d); v.set(0, 10, 5, h.d);
  for (let y = 3; y <= 9; y++) { v.set(-6, y, 4, h.b); v.set(5, y, 4, h.b); }
}

// Estilos: back() se dibuja antes de la cabeza, front() después (flequillo encima de la piel).
// swings: piezas que se balancean (colitas/trenzas), con pivote en coords de cabeza.
// top: y donde apoya la corona; crownZ: corrimiento de la corona; long: pelo largo en la espalda.
const HAIR = {
  largo: {
    top: 12, long: true,
    back(v, h) {
      sides(v, h, -5, -5, 3); back(v, h, -7);
      for (let y = -4; y <= 9; y++) { v.set(-7, y, 4, h.b); v.set(6, y, 4, h.b); }
      for (let y = -4; y <= 2; y++) { v.set(-7, y, 5, y < -2 ? h.l : h.b); v.set(6, y, 5, y < -2 ? h.l : h.b); }
    },
    front(v, h) { capTop(v, h); bangsSide(v, h); },
  },
  coleta: {
    top: 12,
    back(v, h) { sides(v, h, 3, -5, 2); back(v, h, 2); },
    front(v, h) { capTop(v, h); bangsFull(v, h); },
    swings: [{
      at: [0, 10, -6],
      build(v, h) {
        v.box(-1, -1, -1, 2, 2, 1, TIE);
        v.box(-2, -1, -3, 4, 3, 2, h.b);
        v.box(-1, 2, -3, 2, 1, 2, h.l);
        for (let y = -9; y <= -2; y++) {
          const w = y < -7 ? 1 : 2;
          for (let x = -w; x < w; x++) for (let z = -5; z <= -3; z++) {
            if (z === -3 && y < -3) continue;
            v.set(x, y, z, ((x + y) & 3) === 0 ? h.d : (y < -7 ? h.l : h.b));
          }
        }
      },
      sway: 1,
    }],
  },
  corto: {
    top: 12,
    back(v, h) {
      sides(v, h, 1, -5, 4); back(v, h, 1);
      for (let z = -5; z <= 3; z++) { v.set(-8, 1, z, h.d); v.set(7, 1, z, h.d); }
      for (let x = -6; x <= 5; x++) v.set(x, 1, -7, h.d);
      for (let x = -6; x <= 5; x++) for (let y = 2; y <= 9; y++) v.set(x, y, -7, y > 6 ? h.b : null);
    },
    front(v, h) {
      capTop(v, h);
      for (let x = -5; x <= 4; x++) { v.set(x, 9, 4, h.b); v.set(x, 8, 4, h.b); v.set(x, 7, 4, h.b); v.set(x, 9, 5, h.b); v.set(x, 10, 5, h.b); }
      for (let x = -4; x <= 3; x++) v.set(x, 8, 5, (x & 1) ? h.d : h.b);
      for (let y = 2; y <= 9; y++) { v.set(-6, y, 4, h.b); v.set(5, y, 4, h.b); }
      // hebillita
      v.set(3, 9, 6, 0xffe066); v.set(4, 9, 6, 0xffe066); v.set(3, 10, 6, 0xffb0d0);
    },
  },
  rodete: {
    top: 12, crownZ: 2,
    back(v, h) { sides(v, h, 4, -5, 2); back(v, h, 3); },
    front(v, h) {
      capTop(v, h); bangsSide(v, h, true);
      v.sphere(-0.5, 14.5, -4, 3, 2.8, 2.6, (x, y, z) => (hash3(x, y, z) < 0.25 ? h.d : (y > 15 && x < 0 ? h.l : h.b)));
      for (let x = -3; x <= 2; x++) for (let z = -6; z <= -2; z++) {
        const edge = x === -3 || x === 2 || z === -6 || z === -2;
        if (edge && !((x === -3 || x === 2) && (z === -6 || z === -2))) v.set(x, 12, z, TIE);
      }
    },
  },
  trenzas: {
    top: 12,
    back(v, h) { sides(v, h, 3, -5, 2); back(v, h, 1); },
    front(v, h) { capTop(v, h); bangsPart(v, h); v.set(-1, 11, 2, h.d); v.set(0, 11, 2, h.d); v.set(-1, 11, 1, h.d); v.set(0, 11, 1, h.d); },
    swings: [
      { at: [-7, 3, 0], build: braid, sway: 0.7 },
      { at: [7, 3, 0], build: braid, sway: 0.7, mirror: true },
    ],
  },
  rizos: {
    top: 14, long: true,
    back(v, h) {
      v.sphere(-0.5, 6, -1, 8.2, 8, 6.8, (x, y, z) => {
        // hueco de la cara y del cuerpo
        if (z >= 3 && y <= 7 && x >= -6 && x <= 5) return null;
        if (y < 0 && x >= -6 && x <= 5 && z >= -3) return null;
        if (y < -1 && z > -4 && (x < -6 || x > 5) && z > 1) return null;
        const r = hash3(x, y, z);
        if (r < 0.1) return null;
        const blob = (((x + 20) >> 1) + ((y + 20) >> 1) + ((z + 20) >> 1)) & 1;
        return blob ? h.b : (r < 0.55 ? h.l : h.d);
      });
    },
    front(v, h) {
      for (let x = -5; x <= 4; x++) { v.set(x, 9, 4, h.b); v.set(x, 8, 4, (x & 1) ? h.l : h.b); }
      for (const x of [-5, -4, -2, -1, 1, 2, 4]) v.set(x, 7, 4, h.b);
      for (let x = -5; x <= 4; x++) { v.set(x, 9, 5, (x & 1) ? h.b : h.l); v.set(x, 10, 5, h.b); if (!(x & 1)) v.set(x, 8, 5, h.b); }
      for (let y = 2; y <= 9; y++) { v.set(-6, y, 4, h.b); v.set(5, y, 4, h.b); v.set(-7, y, 4, (y & 1) ? h.l : h.b); v.set(6, y, 4, (y & 1) ? h.b : h.l); }
    },
  },
  colitas: {
    top: 12,
    back(v, h) { sides(v, h, 4, -5, 2); back(v, h, 3); },
    front(v, h) { capTop(v, h); bangsFull(v, h); },
    swings: [
      { at: [-7, 9, -2], build: pigtail, sway: 1 },
      { at: [7, 9, -2], build: pigtail, sway: 1, mirror: true },
    ],
  },
  ondas: {
    top: 12, long: true,
    back(v, h) {
      const wave = (y) => [0, 1, 1, 0, -1, -1][((y % 6) + 60) % 6] * (y < 4 ? 1 : 0);
      const tipC = mix(h.l, 0x9ff0ff, 0.45);
      sides(v, h, -9, -5, 3, wave);
      back(v, h, -11, wave, { y: -7, c: tipC });
      for (let y = -9; y <= -7; y++) for (let z = -5; z <= 3; z++) {
        const o = wave(y);
        v.set(-7 - Math.max(0, -o), y, z, tipC); v.set(6 + Math.max(0, o), y, z, tipC);
      }
      for (let y = -6; y <= 9; y++) { v.set(-7, y, 4, y < -3 ? h.l : h.b); v.set(6, y, 4, y < -3 ? h.l : h.b); }
    },
    front(v, h) {
      capTop(v, h); bangsSide(v, h, true);
      // broche de caracol
      v.set(6, 8, 5, 0xffb3c8); v.set(6, 9, 5, 0xfff7fb); v.set(6, 8, 6, 0xff8fb0); v.set(6, 7, 5, 0xffb3c8);
    },
  },
};
function braid(v, h) {
  for (let i = 1; i <= 9; i++) {
    const c = (i & 1) ? h.b : h.d;
    const o = (i & 1) ? 0 : -1;
    v.box(-1, -i, -1, 2, 1, 2, c);
    v.set(o === 0 ? -1 : 0, -i, 0, (i & 1) ? h.l : h.b);
  }
  v.box(-1, -10, -1, 2, 1, 2, TIE);
  v.box(-1, -12, -1, 2, 2, 2, h.b);
  v.set(-1, -12, 0, h.l);
}
function pigtail(v, h) {
  v.box(-1, -1, -1, 1, 2, 2, TIE);
  for (let y = -2; y <= 1; y++) for (let x = -4; x <= -2; x++) for (let z = -2; z <= 1; z++) {
    if ((y === 1 || y === -2) && (z === -2 || z === 1) && x !== -3) continue;
    v.set(x, y, z, y === 1 ? h.l : h.b);
  }
  for (let y = -8; y <= -3; y++) {
    const x0 = y < -6 ? -4 : -5;
    for (let x = x0; x <= -3; x++) for (let z = -1; z <= 0; z++) v.set(x, y, z, ((x + y) & 1) ? h.b : h.d);
  }
  v.set(-4, -9, 0, h.l); v.set(-4, -9, -1, h.l);
}

function buildHead(v, look) {
  const skin = hexToInt(skinHex(look.skin));
  const st = HAIR[look.hair] || HAIR.largo;
  const h = hairPal(hairHex(look.hairColor));
  st.back(v, h);
  // cabeza redondeada
  for (let x = -6; x <= 5; x++) for (let y = 0; y <= 9; y++) for (let z = -5; z <= 4; z++) {
    const ex = x === -6 || x === 5, ey = y === 0 || y === 9, ez = z === -5 || z === 4;
    if ((ex && ey) || (ex && ez) || (ey && ez)) continue;
    v.set(x, y, z, skin);
  }
  // orejitas
  v.set(-7, 4, 0, shade(skin, -0.06)); v.set(6, 4, 0, shade(skin, -0.06));
  // cachetes y boca (capa z=4)
  const cheek = mix(skin, 0xff6f9c, 0.42);
  for (const x of [-5, -4, 3, 4]) v.set(x, 2, 4, cheek);
  v.set(-1, 2, 4, mix(skin, 0xb83a66, 0.7)); v.set(0, 2, 4, mix(skin, 0xb83a66, 0.7));
  st.front(v, h);
}

// Ojos: malla aparte (para parpadear). Geometría centrada en y=0.
function eyesGeo() {
  return cachedGeo('eyes', (v) => {
    const iris = 0x6a4fb0;
    for (const [x0, hl, lash] of [[-4, -4, -5], [2, 2, 4]]) {
      for (let x = x0; x <= x0 + 1; x++) {
        v.set(x, 0, 0, iris); v.set(x, 1, 0, INK); v.set(x, 2, 0, INK);
      }
      v.set(hl, 2, 0, 0xffffff);
      v.set(hl === x0 ? x0 + 1 : x0, 0, 0, shade(iris, 0.25));
      v.set(lash, 2, 0, INK);
    }
  }, (g) => g.translate(0, -1.5 * S, 0));
}

// =====================================================================
//                                 CORONAS
// Coordenadas de cabeza, apoyan en y=12.
// =====================================================================
const CROWN_BUILD = {
  tiara(v) {
    for (let x = -3; x <= 2; x++) v.set(x, 12, 2, x === -3 || x === 2 ? GOLD_D : GOLD);
    for (const x of [-3, 2]) v.set(x, 13, 2, GOLD);
    v.set(-1, 13, 2, GOLD); v.set(0, 13, 2, GOLD);
    v.set(-1, 14, 2, 0xff5a9e); v.set(0, 14, 2, 0xff5a9e);
    v.set(-1, 15, 2, GOLD_L); v.set(0, 15, 2, GOLD);
    v.set(-2, 12, 3, 0x8fd3ff); v.set(1, 12, 3, 0x8fd3ff);
    v.set(-1, 13, 3, 0xffffff);
  },
  corona(v) {
    for (let x = -4; x <= 3; x++) for (let z = -3; z <= 2; z++) {
      const edge = x === -4 || x === 3 || z === -3 || z === 2;
      if (edge) { v.set(x, 12, z, GOLD_D); v.set(x, 13, z, GOLD); }
      else v.set(x, 12, z, 0xe0528f);
    }
    for (const [x, z] of [[-4, -3], [3, -3], [-4, 2], [3, 2], [-1, 2], [0, 2], [-4, -1], [3, -1], [-1, -3], [0, -3]]) {
      v.set(x, 14, z, GOLD); if ((x === -1 || x === 0)) v.set(x, 15, z, GOLD_L);
    }
    v.set(-1, 13, 2, 0xff5a6e); v.set(0, 13, 2, 0xff5a6e);
    v.set(-4, 13, 0, 0x4f7ce0); v.set(3, 13, 0, 0x4f7ce0);
    v.set(-1, 13, -3, 0x6fe3c1); v.set(0, 13, -3, 0x6fe3c1);
    v.set(-1, 13, 0, 0xffd166); v.set(0, 13, -1, 0xffd166);
  },
  flores(v) {
    const flowers = [0xff7eb6, 0xffffff, 0xb58cff, 0xffd166, 0x8fd3ff, 0xff9cc8];
    const ring = [];
    for (let x = -5; x <= 4; x++) ring.push([x, 4], [x, -5]);
    for (let z = -4; z <= 3; z++) ring.push([-6, z], [5, z]);
    let i = 0;
    for (const [x, z] of ring) {
      const k = ((x * 2 + z * 3) % 4 + 4) % 4;
      v.set(x, 11, z, k === 1 ? 0x3e9e52 : 0x5fc46a);
      if (k === 0) {
        const c = flowers[i++ % flowers.length];
        v.set(x, 12, z, 0xffe066);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Z = z + dz;
          const onRing = X === -6 || X === 5 || Z === -5 || Z === 4;
          if (onRing && X >= -6 && X <= 5 && Z >= -5 && Z <= 4) v.set(X, 12, Z, c);
        }
        v.set(x, 11, z, c);
      }
    }
    v.set(-6, 13, 3, 0xff7eb6); v.set(-6, 12, 3, 0xffe066); v.set(-6, 12, 2, 0xff7eb6); v.set(-6, 11, 3, 0xff7eb6); v.set(-6, 12, 4, 0xff7eb6);
  },
  'moño'(v, c) {
    const b = hexToInt(c), d = shade(c, -0.22), l = shade(c, 0.3);
    v.box(-1, 12, 0, 2, 2, 2, d);
    for (const s of [-1, 1]) {
      const X = (x) => (s < 0 ? x : -1 - x);
      for (let y = 11; y <= 15; y++) for (let x = -5; x <= -2; x++) {
        const w = x - -2; // 0..-3
        if (y === 11 && x < -3) continue;
        if (y === 15 && x > -4) continue;
        if (y === 15 && x === -5) continue;
        v.set(X(x), y, 0, (y === 14 && x === -4) ? l : b);
        v.set(X(x), y, 1, y >= 14 && w < -1 ? l : b);
      }
      v.set(X(-3), 13, 1, d); v.set(X(-4), 12, 1, d);
      v.set(X(-2), 11, 1, d); v.set(X(-3), 10, 1, b);
    }
  },
  estrella(v) {
    for (let x = -3; x <= 2; x++) v.set(x, 12, 2, GOLD_D);
    const star = ['..#..', '..#..', '#####', '.###.', '.#.#.'];
    star.forEach((row, i) => [...row].forEach((ch, j) => {
      if (ch === '#') v.set(j - 3, 17 - i, 2, (i === 2 && j === 2) ? 0xffffff : (j < 2 ? GOLD_L : GOLD));
    }));
    v.set(-1, 15, 3, 0xff7eb6);
    v.set(-4, 13, 2, 0xfff0c2); v.set(3, 13, 2, 0xfff0c2);
  },
  orejitas(v, c, hair) {
    const b = hexToInt(hair), d = shade(hair, -0.15), pink = 0xffa3c4;
    for (const s of [-1, 1]) {
      const X = (x) => (s < 0 ? x : -1 - x);
      for (let x = -5; x <= -2; x++) for (let z = -1; z <= 0; z++) v.set(X(x), 12, z, z === 0 && x > -5 && x < -2 ? pink : b);
      for (let x = -5; x <= -3; x++) for (let z = -1; z <= 0; z++) v.set(X(x), 13, z, z === 0 && x === -4 ? pink : d === b ? b : (x === -5 ? d : b));
      v.set(X(-5), 14, 0, b); v.set(X(-5), 14, -1, b); v.set(X(-4), 14, -1, b);
    }
  },
};

// =====================================================================
//                         TORSO / VESTIDOS / BRAZOS / PIERNAS
// Coordenadas del cuerpo: torso x [-3,3), y [4,10), z [-2,2). Piernas debajo de y=4.
// =====================================================================
function skirt(v, y0, y1, rBot, rTop, col, rz = 0.86) {
  for (let y = y0; y <= y1; y++) {
    const t = y1 === y0 ? 1 : (y - y0) / (y1 - y0);
    const r = rBot + (rTop - rBot) * t;
    const R = Math.ceil(r) + 1;
    for (let x = -R; x < R; x++) for (let z = -R; z < R; z++) {
      const cx = x + 0.5, cz = z + 0.5;
      if ((cx / r) ** 2 + (cz / (r * rz)) ** 2 <= 1) v.set(x, y, z, col(x, y, z, r));
    }
  }
}
const isFront = (z) => z >= 1;
function dressPal(look) {
  const c = hexToInt(outfitHex(look.dressColor));
  return { c, d: shade(c, -0.18), dd: shade(c, -0.32), l: shade(c, 0.35), ll: shade(c, 0.6), skin: hexToInt(skinHex(look.skin)) };
}

// Cada vestido: torso(v,p,seated), arm: estilo de manga, leg(v,p): pierna local x[-1,1) y[-4,0) z[-1,1)
const DRESS = {
  clasico: {
    torso(v, p, seated) {
      v.box(-3, 6, -2, 6, 4, 4, p.c);
      v.box(-3, 5, -2, 6, 1, 4, p.ll);
      v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
      v.set(-2, 9, 1, p.l); v.set(1, 9, 1, p.l);
      v.set(-2, 5, 2, p.ll); v.set(1, 5, 2, p.ll); v.set(-1, 5, 2, p.l); v.set(0, 5, 2, p.l);
      v.set(-2, 6, 2, p.ll); v.set(1, 6, 2, p.ll);
      if (seated) { v.box(-3, 4, -2, 6, 1, 4, p.c); return; }
      skirt(v, 1, 4, 5.3, 3.8, (x, y, z) => (y === 1 ? (((x + z) & 1) ? p.ll : p.l) : (((x + z * 2) % 3 === 0 && y < 4) ? p.d : p.c)));
    },
    arm: 'puff', leg: (v, p) => { legBase(v, p.skin, p.skin, p.dd); },
  },
  corto: {
    torso(v, p, seated) {
      v.box(-3, 5, -2, 6, 5, 4, p.c);
      v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
      v.box(-3, 5, -2, 6, 1, 4, WHITE);
      v.set(-1, 5, 1, GOLD); v.set(0, 5, 1, GOLD);
      for (const x of [-2, 1]) v.set(x, 7, 1, p.ll);
      if (seated) { v.box(-3, 4, -2, 6, 1, 4, p.c); return; }
      skirt(v, 3, 4, 4.7, 3.9, (x, y, z) => (y === 3 ? (((x + z) & 1) ? WHITE : p.l) : (((x + z) & 1) ? p.c : p.d)));
    },
    arm: 'short', leg: (v, p) => { legBase(v, p.skin, WHITE, p.dd, true); },
  },
  gala: {
    torso(v, p, seated) {
      v.box(-3, 5, -2, 6, 4, 4, p.c);
      v.box(-3, 9, -2, 6, 1, 4, p.skin);
      for (let x = -3; x <= 2; x++) { v.set(x, 8, 2, p.l); v.set(x, 8, -3, p.l); }
      for (let z = -2; z <= 1; z++) { v.set(-4, 8, z, p.l); v.set(3, 8, z, p.l); }
      v.set(-1, 9, 2, GOLD); v.set(0, 9, 2, GOLD); v.set(-1, 8, 2, 0x8fd3ff); v.set(0, 8, 2, 0x8fd3ff);
      v.box(-3, 5, -2, 6, 1, 4, GOLD_D);
      v.set(-1, 5, 2, GOLD_L); v.set(0, 5, 2, GOLD_L);
      if (seated) { v.box(-3, 4, -2, 6, 1, 4, p.c); return; }
      skirt(v, 0, 4, 6.4, 3.8, (x, y, z) => {
        if (y === 0) return ((x + z) & 1) ? GOLD : p.l;
        if (hash3(x, y, z) < 0.07) return 0xffffff;
        return (y & 1) ? p.c : shade(p.c, 0.14);
      });
    },
    arm: 'glove', leg: (v, p) => { legBase(v, p.skin, p.skin, p.dd); },
  },
  overol: {
    torso(v, p, seated) {
      v.box(-3, 6, -2, 6, 4, 4, WHITE);
      for (let x = -3; x <= 2; x++) for (let z = -2; z <= 1; z++) v.set(x, 7, z, 0xffc2dc);
      v.box(-2, 5, 1, 4, 4, 1, p.c);
      v.box(-1, 6, 2, 2, 2, 1, p.d);
      v.set(-2, 8, 2, GOLD); v.set(1, 8, 2, GOLD);
      for (const x of [-2, 1]) { v.set(x, 9, 1, p.c); for (let y = 5; y <= 9; y++) v.set(x, y, -2, p.c); }
      v.box(-3, 4, -2, 6, 2, 4, p.c);
      v.box(-2, 5, 1, 4, 1, 1, p.c);
      v.set(-1, 4, 1, p.d); v.set(0, 4, 1, p.d);
      if (seated) return;
    },
    arm: 'tee', leg: (v, p) => {
      v.box(-1, -3, -1, 2, 3, 2, p.c);
      v.box(-1, -3, -1, 2, 1, 2, p.l);
      shoes(v, WHITE, p.c, true);
    },
  },
  sirena: {
    torso(v, p, seated) {
      v.box(-3, 4, -2, 6, 5, 4, p.c);
      v.box(-3, 9, -2, 6, 1, 4, p.skin);
      v.set(-2, 8, 1, p.ll); v.set(-1, 8, 1, p.l); v.set(0, 8, 1, p.l); v.set(1, 8, 1, p.ll);
      v.set(-2, 7, 1, p.l); v.set(1, 7, 1, p.l);
      for (const x of [-2, 0]) v.set(x, 9, 1, WHITE);
      for (const x of [-1, 1]) v.set(x, 9, 1, 0xffe0ee);
      v.set(-3, 9, 0, p.c); v.set(2, 9, 0, p.c);
      if (seated) return;
      skirt(v, 2, 3, 3.6, 3.5, (x, y, z) => (((x + y + z) & 1) ? p.c : shade(p.c, 0.16)));
      skirt(v, 0, 1, 5.2, 4.2, (x, y, z, r) => {
        const d = Math.hypot(x + 0.5, (z + 0.5) / 0.86);
        return d > r - 1.2 ? (y === 0 ? p.ll : p.l) : p.c;
      });
    },
    arm: 'bare', leg: (v, p) => { legBase(v, p.c, p.c, p.c); },
  },
  deportivo: {
    torso(v, p, seated) {
      v.box(-3, 5, -2, 6, 5, 4, p.c);
      v.box(-3, 4, -2, 6, 1, 4, p.d);
      v.box(-2, 7, -3, 4, 3, 1, p.d);
      v.set(-1, 9, -3, p.c); v.set(0, 9, -3, p.c);
      v.set(-1, 9, 1, p.d); v.set(0, 9, 1, p.d);
      for (const x of [-2, 1]) { v.set(x, 8, 2, WHITE); v.set(x, 7, 2, WHITE); }
      v.box(-2, 5, 2, 4, 1, 1, p.d);
      v.set(-1, 7, 1, WHITE); v.set(0, 7, 1, WHITE); v.set(-1, 6, 1, WHITE); v.set(0, 6, 1, WHITE);
      if (seated) return;
      // calzas
      v.box(-3, 4, -2, 6, 1, 4, mix(p.c, INK, 0.55));
    },
    arm: 'sport', leg: (v, p) => {
      const leg = mix(p.c, INK, 0.55);
      v.box(-1, -3, -1, 2, 3, 2, leg);
      for (let y = -3; y <= -1; y++) v.set(0, y, 0, WHITE);
      shoes(v, WHITE, p.c, true);
    },
  },
  capa: {
    torso(v, p, seated) {
      v.box(-3, 5, -2, 6, 5, 4, p.l);
      v.box(-3, 9, -2, 6, 1, 4, p.l);
      v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
      v.box(-3, 5, -2, 6, 1, 4, GOLD);
      for (let y = 6; y <= 8; y++) { v.set(-1, y, 1, p.ll); v.set(0, y, 1, p.ll); }
      v.set(-1, 7, 2, GOLD); v.set(0, 7, 2, GOLD);
      if (seated) { v.box(-3, 4, -2, 6, 1, 4, p.l); return; }
      skirt(v, 1, 4, 4.8, 3.7, (x, y, z) => {
        if (y === 1) return GOLD;
        if (z >= 1 && (x === -1 || x === 0)) return p.ll;
        return p.l;
      });
    },
    arm: 'puffD', leg: (v, p) => { legBase(v, p.skin, p.skin, p.dd); },
    cape: true,
  },
  estrellas: {
    torso(v, p, seated) {
      const n = mix(p.c, 0x2b2160, 0.45), nl = shade(n, 0.22);
      v.box(-3, 6, -2, 6, 4, 4, n);
      v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
      v.box(-3, 5, -2, 6, 1, 4, GOLD);
      v.set(-2, 8, 1, GOLD_L); v.set(1, 7, 1, 0xffffff); v.set(-1, 6, -2, GOLD_L);
      v.set(-1, 5, 2, GOLD_L); v.set(0, 5, 2, GOLD); v.set(0, 6, 2, GOLD);
      if (seated) { v.box(-3, 4, -2, 6, 1, 4, n); return; }
      skirt(v, 0, 4, 5.9, 3.8, (x, y, z) => {
        const r = hash3(x, y, z);
        if (r < 0.1) return GOLD;
        if (r < 0.16) return 0xffffff;
        if (y === 0) return nl;
        return ((x + z) & 1) && y < 3 ? shade(n, 0.08) : n;
      });
    },
    arm: 'puffStar', leg: (v, p) => { legBase(v, p.skin, p.skin, GOLD_D); },
  },
};
function shoes(v, c, accent, sneaker = false) {
  v.box(-1, -4, -1, 2, 1, 2, c);
  v.box(-1, -4, 1, 2, 1, 1, sneaker ? accent : c);
  if (sneaker) { v.set(-1, -3, 0, c); v.set(0, -3, 0, c); }
}
function legBase(v, upper, lower, shoe, socks = false) {
  v.box(-1, -3, -1, 2, 3, 2, upper);
  if (socks) v.box(-1, -3, -1, 2, 1, 2, lower);
  shoes(v, shoe, shade(shoe, 0.15));
  v.set(-1, -3, 1, null);
}

// Brazo local: x [-1,1) (exterior +x), y [-5,0), z [-1,1). Mano en y=-5.
function buildArm(v, style, p) {
  const sk = p.skin;
  v.box(-1, -5, -1, 2, 5, 2, sk);
  switch (style) {
    case 'puff': case 'puffD': case 'puffStar': {
      const pc = style === 'puffD' ? p.d : style === 'puffStar' ? shade(mix(p.c, 0x2b2160, 0.45), 0.3) : p.c;
      for (let x = -1; x <= 1; x++) for (let y = -2; y <= -1; y++) for (let z = -2; z <= 1; z++) {
        if (x === 1 && (z === -2 || z === 1)) continue;
        v.set(x, y, z, pc);
      }
      for (let z = -1; z <= 0; z++) v.set(1, 0, z, pc);
      v.set(0, 0, -1, pc); v.set(0, 0, 0, pc);
      for (let x = -1; x <= 1; x++) for (let z = -2; z <= 1; z++) if (!(x === 1 && (z === -2 || z === 1))) v.set(x, -3, z, null);
      v.box(-1, -3, -1, 2, 1, 2, style === 'puffD' ? p.l : p.ll);
      if (style === 'puffStar') { v.set(1, -1, 0, GOLD); v.set(0, -2, 1, 0xffffff); }
      break;
    }
    case 'short': v.box(-1, -2, -1, 2, 2, 2, p.c); v.box(-1, -2, -1, 2, 1, 2, p.l); break;
    case 'tee': v.box(-1, -2, -1, 2, 2, 2, WHITE); v.set(0, -2, 0, 0xffc2dc); v.set(-1, -2, 0, 0xffc2dc); break;
    case 'glove': v.box(-1, -5, -1, 2, 3, 2, WHITE); v.set(0, -3, 0, 0xffe6f2); break;
    case 'sport':
      v.box(-1, -4, -1, 2, 4, 2, p.c);
      for (let y = -4; y <= -1; y++) v.set(0, y, 0, WHITE), v.set(0, y, -1, WHITE);
      v.box(-1, -4, -1, 2, 1, 2, WHITE);
      break;
    case 'bare': v.set(0, -4, 0, GOLD); v.set(-1, -4, 0, GOLD); v.set(0, -4, -1, GOLD); v.set(-1, -4, -1, GOLD); break;
  }
}

function buildCape(v, p) {
  const cd = shade(p.c, -0.25), lining = p.ll;
  for (let y = -10; y <= 0; y++) {
    const w = 4 + Math.floor((-y) / 4);
    for (let x = -w; x < w; x++) {
      const c = y === -10 ? GOLD : (x === -w || x === w - 1) ? lining : cd;
      v.set(x, y, -1, ((x + y) & 3) === 0 && y < -1 && y > -10 ? shade(cd, -0.06) : c);
    }
  }
  for (let x = -4; x <= 3; x++) { v.set(x, 1, -1, WHITE); v.set(x, 0, 0, x === -4 || x === 3 ? WHITE : null); }
  v.set(-4, 1, 0, WHITE); v.set(3, 1, 0, WHITE);
}

// =====================================================================
//                               ACCESORIOS
// =====================================================================
function buildWand(v) {
  // en coords de la mano derecha (brazo local), apuntando hacia adelante/arriba
  for (let y = -6; y <= -1; y++) v.set(0, y, 1, (y & 1) ? 0xffffff : 0xff9cc8);
  const star = [[0, 0], [0, 1], [0, 2], [-1, 1], [1, 1], [-1, 0], [1, 0]];
  for (const [x, dy] of star) v.set(x, dy, 1, GOLD);
  v.set(0, 1, 1, 0xfff7c2); v.set(0, 3, 1, GOLD_L);
  v.set(-2, 1, 1, GOLD); v.set(1, 1, 1, GOLD);
  v.set(0, 1, 2, 0xffffff);
}
function buildBag(v, p) {
  const bc = shade(p.c, -0.1);
  // en coords del brazo izquierdo (espejado: exterior = +x)
  for (let y = -8; y <= -6; y++) for (let x = 1; x <= 2; x++) for (let z = -1; z <= 1; z++) v.set(x, y, z, y === -6 ? shade(bc, 0.2) : bc);
  v.set(2, -7, 0, GOLD); v.set(2, -6, 0, GOLD);
  v.set(1, -5, -1, GOLD_D); v.set(1, -5, 1, GOLD_D); v.set(1, -4, 0, GOLD_D);
  v.set(2, -8, -1, shade(bc, -0.15)); v.set(2, -8, 1, shade(bc, -0.15));
}
function buildGlasses(v) {
  const heart = ['##.##', '#####', '.###.', '..#..'];
  const lens = 0xff4f9a, glint = 0xffffff, frame = 0xd63d84;
  for (const x0 of [-6, 1]) heart.forEach((row, i) => [...row].forEach((ch, j) => {
    if (ch !== '#') return;
    const y = 5 - i;
    const edge = i === 0 || j === 0 || j === 4 || row[j - 1] !== '#' || row[j + 1] !== '#';
    v.set(x0 + j, y, 0, (i === 1 && j === 1) ? glint : edge ? frame : lens);
  }));
  v.set(-1, 5, 0, frame); v.set(0, 5, 0, frame);
}
function buildWing(v) {
  // ala derecha en el plano XY (z=0), sale hacia +x desde el pivote
  const inside = (x, y) => {
    const ux = (x + 0.5 - 5.2) / 5.2, uy = (y + 0.5 - 4.6) / 5.4;
    const lx = (x + 0.5 - 3.4) / 3.3, ly = (y + 0.5 + 2.2) / 3.2;
    return (ux * ux + uy * uy <= 1 && y >= -1) || (lx * lx + ly * ly <= 1 && y <= 0);
  };
  for (let x = 0; x <= 10; x++) for (let y = -6; y <= 10; y++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
    const vein = x > 0 && (x === y || x === y + 1 || (y < 0 && x === -y * 1.5 + 1));
    const sparkle = !edge && (x * 5 + y * 3) % 13 === 0;
    v.set(x, y, 0, edge ? 0xb58cff : sparkle ? 0xffffff : vein ? 0xeee4ff : (y > 2 ? ((x + y) & 1 ? 0xd4efff : 0xdcd0ff) : ((x + y) & 1 ? 0xffd6ec : 0xdcd0ff)));
  }
}
function buildCat(v) {
  const fur = 0xffb36b, furL = 0xffe0b8, furD = 0xe08a4a;
  // cuerpito (en coords del cuerpo, adelante del torso)
  for (let x = -2; x <= 1; x++) for (let y = 5; y <= 7; y++) for (let z = 2; z <= 3; z++) v.set(x, y, z, (x + y) & 1 ? fur : furD);
  v.box(-1, 5, 4, 2, 2, 1, furL);
  // cabeza
  for (let x = -2; x <= 1; x++) for (let y = 8; y <= 10; y++) for (let z = 3; z <= 5; z++) v.set(x, y, z, fur);
  v.set(-2, 11, 4, fur); v.set(1, 11, 4, fur); v.set(-2, 11, 5, 0xffa3c4); v.set(1, 11, 5, 0xffa3c4);
  v.set(-2, 9, 6, INK); v.set(1, 9, 6, INK);
  v.set(-1, 8, 6, 0xff7eb6); v.set(0, 8, 6, 0xff7eb6);
  v.set(-1, 9, 6, furL); v.set(0, 9, 6, furL); v.set(-2, 8, 6, furL); v.set(1, 8, 6, furL);
  v.set(-1, 10, 6, furD); v.set(0, 10, 6, fur);
  // colita
  v.set(2, 5, 3, fur); v.set(3, 5, 3, fur); v.set(3, 6, 3, furD); v.set(3, 7, 3, fur);
}

// =====================================================================
//                                 MODELO
// =====================================================================
/**
 * Princesa vóxel. look = store.state.princess (o randomLook()).
 * opts.seated: sin piernas ni falda, brazos al frente (para manejar).
 */
export function princessModel(lookIn = {}, opts = {}) {
  const look = normalizeLook(lookIn);
  const seated = !!opts.seated;
  const p = dressPal(look);
  const hairDef = HAIR[look.hair] || HAIR.largo;
  const dress = DRESS[look.dress] || DRESS.clasico;
  const ck = `${look.dressColor}|${look.skin}`;

  const root = new THREE.Group();
  root.name = 'princess';
  const body = new THREE.Group();
  root.add(body);

  // --- torso
  const torsoGeo = cachedGeo(`t|${look.dress}|${ck}|${seated ? 1 : 0}`, (v) => dress.torso(v, p, seated));
  const torso = meshOf(torsoGeo);
  body.add(torso);

  // --- piernas
  const legs = [];
  if (!seated) {
    const legGeo = cachedGeo(`l|${look.dress}|${ck}`, (v) => dress.leg(v, p));
    for (const s of [-1, 1]) {
      const pv = pivot(s, 4, 0);
      const m = meshOf(legGeo);
      if (s < 0) m.scale.x = -1;
      pv.add(m); body.add(pv); legs.push(pv);
    }
  }

  // --- brazos
  const armGeo = cachedGeo(`a|${look.dress}|${ck}`, (v) => buildArm(v, dress.arm, p));
  const arms = [];
  for (const s of [-1, 1]) {
    const pv = pivot(s * 4, 10, 0);
    const m = meshOf(armGeo);
    if (s < 0) m.scale.x = -1;
    pv.add(m); body.add(pv); arms.push(pv);
  }
  const [armL, armR] = arms;
  const pose = { lx: 0, rx: 0, lz: -0.12, rz: 0.12, swing: 1 };
  if (seated) Object.assign(pose, { lx: -1.15, rx: -1.15, lz: 0.12, rz: -0.12, swing: 0 });

  // --- cabeza
  const head = pivot(0, 10, 0);
  body.add(head);
  head.add(meshOf(cachedGeo(`h|${look.skin}|${look.hair}|${look.hairColor}`, (v) => buildHead(v, look))));
  const eyes = meshOf(eyesGeo());
  eyes.position.set(0, 4.5 * S, 5 * S);
  eyes.scale.z = 0.3;
  eyes.castShadow = false;
  head.add(eyes);

  // pelo que se balancea
  const swings = [];
  (hairDef.swings || []).forEach((sw, i) => {
    const g = cachedGeo(`s|${look.hair}|${look.hairColor}|${i}`, (v) => sw.build(v, hairPal(hairHex(look.hairColor))));
    if (!g) return;
    const pv = pivot(sw.at[0], sw.at[1], sw.at[2]);
    const m = meshOf(g);
    if (sw.mirror) m.scale.x = -1;
    pv.add(m); head.add(pv);
    swings.push({ pv, amp: sw.sway, side: sw.mirror ? 1 : -1 });
  });

  // corona
  if (look.crown !== 'ninguna' && CROWN_BUILD[look.crown]) {
    const g = cachedGeo(`c|${look.crown}|${look.dressColor}|${look.hairColor}`, (v) => CROWN_BUILD[look.crown](v, outfitHex(look.dressColor), hairHex(look.hairColor)));
    if (g) {
      const m = meshOf(g);
      m.position.set(0, (hairDef.top - 12) * S, (hairDef.crownZ || 0) * S);
      head.add(m);
    }
  }

  // capa
  let cape = null;
  if (dress.cape) {
    cape = pivot(0, 9.5, -2);
    cape.add(meshOf(cachedGeo(`cape|${look.dressColor}`, (v) => buildCape(v, p))));
    body.add(cape);
  }

  // accesorios
  const wings = [];
  let cat = null;
  switch (look.acc) {
    case 'varita': {
      armR.add(meshOf(cachedGeo('x|varita', buildWand)));
      if (!seated) Object.assign(pose, { rx: -0.55, rz: 0.05 });
      break;
    }
    case 'bolso': {
      const m = meshOf(cachedGeo(`x|bolso|${look.dressColor}`, (v) => buildBag(v, p)));
      m.scale.x = -1;
      armL.add(m);
      if (!seated) pose.lz = -0.28;
      break;
    }
    case 'anteojos': {
      const m = meshOf(cachedGeo('x|anteojos', buildGlasses));
      m.position.z = 5 * S;
      m.scale.z = 0.6;
      head.add(m);
      eyes.visible = false;
      break;
    }
    case 'alas': {
      const g = cachedGeo('x|ala', buildWing);
      const z = hairDef.long ? -7.3 : -2.3;
      for (const s of [-1, 1]) {
        const pv = pivot(s * 0.5, 6.5, z);
        const m = meshOf(g);
        m.castShadow = false;
        if (s < 0) m.scale.x = -1;
        pv.add(m); body.add(pv); wings.push({ pv, s });
      }
      break;
    }
    case 'gatito': {
      if (!seated) {
        cat = new THREE.Group();
        cat.add(meshOf(cachedGeo('x|gatito', buildCat)));
        body.add(cat);
        Object.assign(pose, { lx: -0.95, rx: -0.95, lz: 0.32, rz: -0.32, swing: 0 });
      }
      break;
    }
  }

  // pose base
  armL.rotation.set(pose.lx, 0, pose.lz);
  armR.rotation.set(pose.rx, 0, pose.rz);

  if (opts.scale) root.scale.setScalar(opts.scale);

  // ---------------- animación ----------------
  let t = Math.random() * 10, walk = 0, phase = 0;
  let blinkIn = 1.5 + Math.random() * 3, blinkLeft = 0, doubleBlink = false;
  root.userData.look = look;
  root.userData.height = (21 + (hairDef.top - 12)) * S * (opts.scale || 1);
  root.userData.parts = { body, torso, head, eyes, armL, armR, legs, cape, wings, swings, cat };
  root.userData.update = (dt = 0.016, moving = false) => {
    dt = Math.min(dt, 0.1);
    t += dt;
    walk += ((moving ? 1 : 0) - walk) * Math.min(1, dt * 9);
    if (walk > 0.01) phase += dt * 11;
    const sw = Math.sin(phase) * walk;
    const idle = 1 - walk;
    const breath = Math.sin(t * 2.4);

    for (let i = 0; i < legs.length; i++) legs[i].rotation.x = (i ? -sw : sw) * 0.75;
    armL.rotation.x = pose.lx - sw * 0.7 * pose.swing;
    armR.rotation.x = pose.rx + sw * 0.7 * pose.swing + (look.acc === 'varita' ? Math.sin(t * 3) * 0.08 * idle : 0);
    armL.rotation.z = pose.lz - breath * 0.035 * idle * pose.swing;
    armR.rotation.z = pose.rz + breath * 0.035 * idle * pose.swing;

    body.position.y = Math.abs(Math.sin(phase)) * 0.045 * walk + (seated ? 0 : breath * 0.004 * idle);
    body.rotation.z = Math.sin(phase) * 0.04 * walk;
    torso.scale.y = 1 + breath * 0.012 * idle;
    head.position.y = 10 * S + breath * 0.005 * idle;
    head.rotation.z = Math.sin(t * 0.9) * 0.05 * idle;
    head.rotation.x = Math.sin(t * 0.7 + 1) * 0.03 * idle;

    for (const s of swings) {
      s.pv.rotation.x = 0.12 * walk + Math.sin(phase * 2) * 0.12 * walk * s.amp + Math.sin(t * 1.7) * 0.04 * idle;
      s.pv.rotation.z = (Math.sin(phase) * 0.18 * walk + Math.sin(t * 1.3) * 0.05 * idle) * s.amp;
    }
    if (cape) cape.rotation.x = 0.08 + walk * 0.35 + Math.sin(t * 3 + phase) * (0.03 + walk * 0.06);
    for (const w of wings) w.pv.rotation.y = w.s * (0.3 + Math.sin(t * (moving ? 14 : 4.5)) * (moving ? 0.35 : 0.18));
    if (cat) cat.position.y = Math.max(0, Math.sin(t * 2.2)) * 0.008;

    // parpadeo
    blinkIn -= dt;
    if (blinkIn <= 0) {
      blinkLeft = 0.12;
      if (doubleBlink) { doubleBlink = false; blinkIn = 2.2 + Math.random() * 3.2; }
      else { doubleBlink = Math.random() < 0.25; blinkIn = doubleBlink ? 0.25 : 2.2 + Math.random() * 3.2; }
    }
    if (blinkLeft > 0) blinkLeft -= dt;
    eyes.scale.y = blinkLeft > 0 ? 0.18 : 1;
  };
  root.userData.update(0, false);
  return root;
}

// ---------------- Looks aleatorios (vecinas) ----------------
function rng(seed) {
  let a = (seed | 0) ^ 0x9e3779b9;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Look aleatorio válido y determinista (misma semilla = mismo look). */
export function randomLook(seed = 0) {
  const r = rng(Math.floor(seed * 7919) + 17);
  const pick = (list) => list[Math.floor(r() * list.length) % list.length];
  const crownPool = ['ninguna', 'ninguna', 'ninguna', 'tiara', 'flores', 'moño', 'orejitas', 'corona', 'estrella'];
  const accPool = ['ninguno', 'ninguno', 'ninguno', 'ninguno', 'bolso', 'anteojos', 'varita', 'gatito', 'alas'];
  return {
    skin: Math.floor(r() * SKIN_TONES.length) % SKIN_TONES.length,
    hair: pick(HAIR_STYLES).id,
    hairColor: pick(HAIR_COLORS).id,
    dress: pick(DRESS_STYLES).id,
    dressColor: pick(OUTFIT_COLORS).id,
    crown: crownPool[Math.floor(r() * crownPool.length) % crownPool.length],
    acc: accPool[Math.floor(r() * accPool.length) % accPool.length],
  };
}
