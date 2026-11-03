// Herramientas compartidas de los modelos de personaje (avatar.js y sus piezas):
// colores, caché de geometrías, pivotes y la pintura de pelaje de los animalitos.
import * as THREE from 'three';
import { Voxels, voxelMaterial, shade, hexToInt } from '../core/voxel.js';
import { SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS } from '../core/data.js';

/** Tamaño de un vóxel del personaje en unidades de mundo (la cara usa medio vóxel). */
export const AVATAR_VOXEL = 1 / 24;
export const S = AVATAR_VOXEL;

export const INK = 0x3b2340;
export const WHITE = 0xfff7fb;
export const GOLD = 0xffd166, GOLD_D = 0xe8a93a, GOLD_L = 0xfff0c2;
export const SILVER = 0xe3dff0, SILVER_D = 0xa99fbf, SILVER_L = 0xf8f6ff;
export const TIE = 0xff6fae;
export const DENIM = 0x5f86d6, DENIM_D = 0x4a6bb8, DENIM_L = 0x8fb0ee;
export const BOOT = 0x6a4256, BOOT_L = 0x8a5a70;
export { shade, hexToInt };

export function mix(a, b, t) {
  a = hexToInt(a); b = hexToInt(b);
  const r = ((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t;
  const g = ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t;
  const bl = (a & 255) * (1 - t) + (b & 255) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}
export const hash3 = (x, y, z) => {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const byId = (list, id) => list.find(i => i.id === id) || list[0];
export const hairHex = (id) => byId(HAIR_COLORS, id).hex;
export const outfitHex = (id) => byId(OUTFIT_COLORS, id).hex;
export const skinHex = (i) => SKIN_TONES[Math.max(0, Math.min(SKIN_TONES.length - 1, i | 0))] || SKIN_TONES[0];

export function hairPal(hex) {
  return { b: hexToInt(hex), m: shade(hex, -0.09), d: shade(hex, -0.2), l: shade(hex, 0.22), ll: shade(hex, 0.4) };
}

// ---------------- Caché de geometrías ----------------
const geoCache = new Map();
export function cacheGet(key) { return geoCache.get(key); }
export function cacheSet(key, g) { geoCache.set(key, g); }
/** Geometría cacheada por clave. build(v) dibuja en una grilla; after(g) la ajusta. scale: tamaño del vóxel. */
export function cachedGeo(key, build, after, scale = S) {
  if (geoCache.has(key)) return geoCache.get(key);
  const v = new Voxels();
  build(v);
  let g = null;
  if (v.size) {
    g = v.toGeometry({ scale, jitter: 0.012 }); // poco ruido: con píxeles chicos el jitter se ve como estática
    after?.(g);
  }
  geoCache.set(key, g);
  return g;
}
export function meshOf(geo) {
  const m = new THREE.Mesh(geo, voxelMaterial());
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
export function pivot(x, y, z) { const g = new THREE.Group(); g.position.set(x * S, y * S, z * S); return g; }

// ---------------- Pelaje de animalitos ----------------
/**
 * Paleta de pelaje. Las piezas del cuerpo se dibujan con el color "piel" (p.skin) y después se repintan
 * con el diseño elegido (pancita, manchas, rayas...). Ver paintFur.
 */
export function furPal(look) {
  const b = hexToInt(hairHex(look.hairColor));
  const lum = (((b >> 16) & 255) * 0.3 + ((b >> 8) & 255) * 0.59 + (b & 255) * 0.11) / 255;
  return {
    b,
    d: shade(b, lum > 0.8 ? -0.16 : -0.24),
    l: shade(b, 0.18),
    cream: lum > 0.85 ? 0xfff0f6 : mix(b, 0xfff6ec, 0.72),
    pink: 0xffa3c4,
    pattern: look.hair,
  };
}
/**
 * Repinta en v los vóxeles de color `skin` con el pelaje. part: 'torso' | 'arm' | 'leg' | 'head'.
 * Coordenadas: torso x[-3,3) y[4,10); brazo y[-5,0) (mano y=-5); pierna y[-4,0); cabeza x[-6,6) y[0,10).
 */
export function paintFur(v, skin, f, part) {
  skin = hexToInt(skin);
  const pat = f.pattern;
  for (const [k, c] of v.map) {
    if (c !== skin) continue;
    const [x, y, z] = k.split(',').map(Number);
    let col = f.b;
    const r = hash3(x + 31, y * 3 + (part === 'head' ? 70 : 0), z);
    const belly = pat !== 'liso';
    if (part === 'torso') {
      if (belly && z >= 1 && x >= -2 && x <= 1 && y >= 4 && y <= 8) col = f.cream;
      else if (pat === 'rayas' && ((y >> 1) & 1) === 0 && z <= 0) col = f.d;
    } else if (part === 'arm') {
      if (y <= -5) col = pat === 'medias' ? 0xfff7fb : f.l;
      else if (pat === 'rayas' && (((y + 8) >> 1) & 1)) col = f.d;
    } else if (part === 'leg') {
      if (y <= -4 || (pat === 'medias' && y <= -3)) col = pat === 'medias' ? 0xfff7fb : f.l;
      else if (pat === 'rayas' && !(((y + 8) >> 1) & 1)) col = f.d;
    } else if (part === 'head') {
      if (pat === 'rayas' && y >= 7 && z <= 3 && (x === -3 || x === -1 || x === 0 || x === 2) && y <= 9) col = f.d;
    }
    // manchas de 2×2×2 (las de 1 vóxel se ven como ruido con píxeles chicos)
    const blob = hash3(((x + 40) >> 1) + 7, ((y + 40) >> 1) + (part === 'head' ? 50 : part === 'leg' ? 90 : 0), (z + 40) >> 1);
    if (pat === 'manchas' && col === f.b && blob < 0.24) col = f.d;
    if (pat === 'brillitos' && col !== f.cream && r < 0.04) col = GOLD;
    v.map.set(k, col);
  }
}
