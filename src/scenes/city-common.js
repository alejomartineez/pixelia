// Utilidades compartidas por los módulos de la escena de ciudad.
import * as THREE from 'three';
import { MAP_SIZE } from '../core/data.js';
import { footprint } from '../core/economy.js';

export const MAP = MAP_SIZE;
export const HALF = MAP_SIZE / 2;
/** Alto de un camino (1 vóxel de 1/8). */
export const ROAD_H = 1 / 8;

/** PRNG determinístico (mulberry32). */
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Hash estable de enteros -> [0,1). */
export function hash2(x, z, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Centro de un tile en coordenadas de mundo. */
export function tileCenter(x, z, out = new THREE.Vector3()) {
  return out.set(x + 0.5 - HALF, 0, z + 0.5 - HALF);
}
/** Tile bajo un punto de mundo. */
export function worldToTile(wx, wz) {
  return { x: Math.floor(wx + HALF), z: Math.floor(wz + HALF) };
}
/** Centro del footprint de un edificio en mundo + tamaño rotado. */
export function footCenter(id, x, z, rot) {
  const [w, d] = footprint(id, rot);
  return { x: x + w / 2 - HALF, z: z + d / 2 - HALF, w, d };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function easeOutBack(t, s = 1.9) { const u = t - 1; return 1 + (s + 1) * u * u * u + s * u * u; }
export function easeOutElastic(t) {
  if (t <= 0) return 0; if (t >= 1) return 1;
  return Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
}
/** Ángulo más corto entre a y b. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function rgb(hex) { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

/** Cambia los materiales de un objeto por clones semitransparentes (para el fantasma). Devuelve los clones para liberar. */
export function makeGhost(obj, opacity = 0.62) {
  const clones = new Map();
  obj.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = false; o.receiveShadow = false;
    const swap = (m) => {
      if (!clones.has(m)) {
        const c = m.clone();
        c.transparent = true; c.opacity = opacity; c.depthWrite = false;
        if (c.emissive) c.emissive = new THREE.Color(0x4a2a4a);
        clones.set(m, c);
      }
      return clones.get(m);
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    o.renderOrder = 4;
  });
  return [...clones.values()];
}

/**
 * Fusiona objetos estáticos (decoración) en pocas mallas, agrupando por material.
 * Mallas incompatibles quedan como clones sueltos. Devuelve un Group.
 */
export function mergeStatic(objects) {
  const out = new THREE.Group();
  const groups = new Map();
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const obj of objects) {
    obj.updateMatrixWorld(true);
    obj.traverse(o => {
      if (!o.isMesh || Array.isArray(o.material) || o.isInstancedMesh || o.isSkinnedMesh) return;
      const g = o.geometry;
      const pos = g.attributes.position, nor = g.attributes.normal, col = g.attributes.color;
      if (!pos || !nor) { const c = o.clone(); c.matrixAutoUpdate = false; c.matrix.copy(o.matrixWorld); out.add(c); return; }
      const sig = o.material.uuid + (col ? '|c' + col.itemSize : '') + '|' + (o.castShadow ? 1 : 0);
      let G = groups.get(sig);
      if (!G) { G = { material: o.material, pos: [], nor: [], col: col ? [] : null, idx: [], cast: o.castShadow, cs: col ? col.itemSize : 0 }; groups.set(sig, G); }
      const base = G.pos.length / 3;
      nm.getNormalMatrix(o.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
        G.pos.push(v.x, v.y, v.z); G.nor.push(n.x, n.y, n.z);
        if (G.col) for (let c = 0; c < G.cs; c++) G.col.push(col.array[i * G.cs + c]);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) G.idx.push(base + g.index.array[i]);
      else for (let i = 0; i < pos.count; i++) G.idx.push(base + i);
    });
  }
  for (const G of groups.values()) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(G.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(G.nor, 3));
    if (G.col) geo.setAttribute('color', new THREE.Float32BufferAttribute(G.col, G.cs));
    geo.setIndex(G.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(G.idx, 1) : new THREE.Uint16BufferAttribute(G.idx, 1));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, G.material);
    m.castShadow = G.cast; m.receiveShadow = true;
    out.add(m);
  }
  return out;
}

/** Libera solo geometrías propias (no toca materiales compartidos ni cacheados). */
export function disposeGeometries(obj) {
  obj.traverse(o => { if (o.geometry) o.geometry.dispose(); });
}
