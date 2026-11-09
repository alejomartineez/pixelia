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
// ---------------- Rampas con cambio de matiz (docs/ARTE-PERSONAJES.md §3) ----------------
function toHsl(c) {
  c = hexToInt(c);
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return (Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255);
}
const towards = (h, target, amt) => { const d = ((target - h + 540) % 360) - 180; return h + Math.sign(d) * Math.min(Math.abs(d), amt); };
/**
 * Un paso de la rampa de un material: k > 0 aclara y calienta (el matiz va hacia el ocre de la luz), k < 0 oscurece y
 * enfría (hacia el violeta de la sombra), con un poco más de saturación en la sombra y menos en la luz. La luz sube ~8 %
 * por paso; la sombra baja ~20 % de la luminosidad por paso (relativo, para que los oscuros no se vuelvan negro). hue: grados de giro por paso (la piel gira menos hacia violeta, va al rojo).
 */
// sat: cuánto cambia la saturación por paso de sombra (negativo la sube; la piel usa positivo para apagarse al
// oscurecer, si no la sombra sale anaranjada y se lee como un rubor o un ojo colorado)
export function ramp(c, k, { hue = 9, val = 0.09, cool = 255, warm = 48, sat = -0.06 } = {}) {
  if (!k) return hexToInt(c);
  const [h, s, l] = toHsl(c);
  const H = towards(h, k > 0 ? warm : cool, Math.abs(k) * hue);
  const S = k > 0 ? s * (1 - 0.07 * k) : s * Math.max(0.2, 1 + sat * k);
  // la sombra baja en proporción a la luminosidad: un carbón no se va a negro puro (nada más oscuro que ~#1a1614)
  return fromHsl(H, S, k > 0 ? l + k * val * 0.85 : Math.max(0.07, l * (1 + k * val * 2.2)));
}
export const hsl = toHsl;
export const hslHex = fromHsl;

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

// Materiales fijos (cuero, metal, lino...). Terrosos pero separados por valor y temperatura (docs/ARTE-PERSONAJES.md §3):
// el cuero es oscuro y cálido (rojizo), la madera más amarilla, la tela del pantalón fría, el metal acero azulado con la
// luz tibia, la bota casi negra pero con color (nada más oscuro que #1a1614). Cada uno es una rampa de 3: sombra, base, luz.
const R3 = (base, o) => [ramp(base, -1.2, o), hexToInt(base), ramp(base, 1, o)];
const [leatherD, leather, leatherL] = R3(0x5e3a28);
const [metalD, metal, metalL] = R3(0x6c7682, { hue: 4, val: 0.11, warm: 45, cool: 225 });
const [brassD, brass] = R3(0x9a7a3a);
const [linenD, linen] = R3(0xb6a88a, { val: 0.07 });
const [trouserD, trouser] = R3(0x423f44);
const [furD, fur, furL] = R3(0x7a6650);
const [strawD, straw] = R3(0xae9458);
const [woodD, wood] = R3(0x6a5434);
export const MAT = {
  leather, leatherD, leatherL,
  metal, metalD, metalL,
  brass, brassD,
  linen, linenD,
  trouser, trouserD,
  boot: 0x2c2326, bootL: 0x433638,
  fur, furD, furL,
  straw, strawD,
  wood, woodD,
  bone: 0xcbc2ac, ink: 0x1a1614, crow: 0x1f1d22,
  vein: 0x4fc4b8, veinD: 0x2e7f78,
};

// ---------------- Caché de geometrías ----------------
const geoCache = new Map();
export function cacheGet(key) { return geoCache.get(key); }
export function cacheSet(key, g) { geoCache.set(key, g); }
/** Geometría cacheada por clave. build(v) dibuja en una grilla de vóxeles de tamaño S. */
// sin ruido (jitter 0): materiales planos, de 2 o 3 tonos
export function cachedGeo(key, build, scale = S) {
  if (geoCache.has(key)) return geoCache.get(key);
  const v = new Voxels();
  build(v);
  const g = v.size ? v.toGeometry({ scale, jitter: 0 }) : null;
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
