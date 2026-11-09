// Herramientas compartidas de los modelos de personaje (figure.js y avatar.js): grilla fina, colores terrosos,
// caché de geometrías y pivotes. Estilo "mezcla" de El Quiebre (plan §M1): la gente es vóxel detallado, con el doble
// de resolución que el personaje tierno de antes (1/48 de unidad por vóxel en vez de 1/24).
import * as THREE from 'three';
import { Voxels, voxelMaterial, shade, hexToInt } from '../core/voxel.js';
import { HAIR_COLORS, OUTFIT_COLORS, avatarType } from '../core/data.js';

/** Vóxel de los personajes en unidades de mundo. */
export const S = 1 / 48;
/** Unidad vieja (1/24): car.js la usa para sentar al conductor (la cadera queda a 4 × AVATAR_VOXEL del asiento). */
export const AVATAR_VOXEL = 1 / 24;
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

// Ropa: los ids de OUTFIT_COLORS (los comparte con el auto y la bandera) pasan a telas teñidas, apagadas.
export const CLOTH = {
  rosa: ['#8a5a5c', 'Rosa viejo'], fucsia: ['#6e3440', 'Granate'], lila: ['#6c6478', 'Lavanda gris'], violeta: ['#4e3e5c', 'Ciruela'],
  celeste: ['#62788a', 'Azul niebla'], azul: ['#3c4a66', 'Índigo'], menta: ['#5a7a6c', 'Verde agua'], verde: ['#4c5e3a', 'Musgo'],
  dorado: ['#9a7a3a', 'Ocre'], durazno: ['#8a5e44', 'Arcilla'], rojo: ['#7a3428', 'Óxido'], blanco: ['#b8ad96', 'Lino'], negro: ['#2e2a2c', 'Carbón'],
};
export const clothHex = (id) => (CLOTH[id] || CLOTH[OUTFIT_COLORS[0].id])[0];
export const clothName = (id) => (CLOTH[id] || [0, id])[1];
// Nombres de los colores de pelo en el estilo nuevo
export const HAIR_NAMES = {
  castano: 'Castaño', negro: 'Negro', rubio: 'Rubio ceniza', pelirrojo: 'Cobre', rosa: 'Vino', lila: 'Ceniza',
  celeste: 'Plata', menta: 'Gris verdoso', blanco: 'Blanco', chocolate: 'Chocolate', gris: 'Canas',
};

// Pueblos que no se eligen (enemigos): tonos propios
const NPC_SKINS = { vaciado: ['#7f7b72', '#6e6a62', '#8a857a', '#5e5a54', '#77736a', '#4e4a46'] };
export const skinHex = (type, i) => {
  const list = NPC_SKINS[type] || avatarType(type).skins;
  return list[Math.max(0, Math.min(list.length - 1, i | 0))] || list[0];
};

// Materiales fijos (cuero, metal, lino...). Todo terroso: nada de colores caramelo (plan §J7 y §M1).
export const MAT = {
  leather: 0x5a4030, leatherD: 0x3e2c22, leatherL: 0x6e5240,
  metal: 0x76787b, metalD: 0x505256, metalL: 0x9c9fa2,
  brass: 0x9a7a3e, brassD: 0x6e5628,
  linen: 0xb2a58a, linenD: 0x938870,
  trouser: 0x463e36, trouserD: 0x36302a,
  boot: 0x2e2420, bootL: 0x43352c,
  fur: 0x7a6650, furD: 0x5a4a3a, furL: 0x93806a,
  straw: 0xae9458, strawD: 0x86703e,
  wood: 0x5c4632, woodD: 0x40301f,
  bone: 0xcbc2ac, ink: 0x161210, crow: 0x1f1d22,
  vein: 0x4fc4b8, veinD: 0x2e7f78,
};

// ---------------- Caché de geometrías ----------------
const geoCache = new Map();
export function cacheGet(key) { return geoCache.get(key); }
export function cacheSet(key, g) { geoCache.set(key, g); }
/** Geometría cacheada por clave. build(v) dibuja en una grilla de vóxeles de tamaño S. */
export function cachedGeo(key, build, scale = S) {
  if (geoCache.has(key)) return geoCache.get(key);
  const v = new Voxels();
  build(v);
  const g = v.size ? v.toGeometry({ scale, jitter: 0.01 }) : null;
  geoCache.set(key, g);
  return g;
}
export function meshOf(geo, mat) {
  const m = new THREE.Mesh(geo, mat || voxelMaterial());
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
let _glow = null;
/** Material que no recibe luz (ojos de los Vaciados, piedras de veta, la llama del farol). */
export function lightMat() { return _glow || (_glow = new THREE.MeshBasicMaterial({ vertexColors: true })); }
export function pivot(x, y, z) { const g = new THREE.Group(); g.position.set(x * S, y * S, z * S); return g; }
