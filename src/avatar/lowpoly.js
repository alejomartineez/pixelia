// Kit low-poly facetado (plan §M1): criaturas grandes, gólems y jefes se arman con caras planas en ángulo para que se
// distingan de la gente vóxel y se sientan pesados. Usa el mismo material que los vóxeles (voxelMaterial: luz plana y
// colores por vértice) y el contorno tinta de createPixelRenderer sale solo (salta la profundidad).
//   const f = new Facets(); f.blob(...); f.box(...); f.limb(...); f.spike(...); mesh = f.mesh()
// Cada triángulo lleva una variación chica de tono (se ven las facetas) y una oclusión falsa: más oscuro abajo.
import * as THREE from 'three';
import { voxelMaterial } from '../core/voxel.js';
import { lightMat } from './avatar-kit.js';

const hash = (a, b, c) => {
  let h = (Math.round(a * 997) * 374761393 + Math.round(b * 997) * 668265263 + Math.round(c * 997) * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _c = new THREE.Color();
const ico = new Map();
function icoVerts(detail) {
  if (!ico.has(detail)) ico.set(detail, new THREE.IcosahedronGeometry(1, detail).attributes.position.array);
  return ico.get(detail);
}

export class Facets {
  constructor({ ao = true, vary = 0.07 } = {}) { this.pos = []; this.col = []; this.ao = ao; this.vary = vary; }
  tri(a, b, c, color) {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    const k = 1 + (hash(a.x + b.x + c.x, a.y + b.y + c.y, a.z + b.z + c.z) - 0.5) * 2 * this.vary;
    _c.set(typeof color === 'function' ? color((a.y + b.y + c.y) / 3, (a.x + b.x + c.x) / 3, (a.z + b.z + c.z) / 3) : color);
    for (let i = 0; i < 3; i++) this.col.push(_c.r * k, _c.g * k, _c.b * k);
    return this;
  }
  quad(a, b, c, d, color) { return this.tri(a, b, c, color).tri(a, c, d, color); }
  /** Bulto irregular (icosaedro deformado). o: { seed, detail (0|1), jit, rot: [x,y,z] } */
  blob(cx, cy, cz, rx, ry, rz, color, o = {}) {
    const p = icoVerts(o.detail ?? 1), jit = o.jit ?? 0.14, seed = o.seed ?? 1;
    const e = new THREE.Euler(...(o.rot || [0, 0, 0]));
    const vs = [];
    for (let i = 0; i < p.length; i += 3) {
      const n = 1 + (hash(p[i] + seed, p[i + 1] * 1.3, p[i + 2] - seed) - 0.5) * 2 * jit;
      const v = V(p[i] * rx * n, p[i + 1] * ry * n, p[i + 2] * rz * n).applyEuler(e);
      if (o.flat != null && v.y < -ry * o.flat) v.y = -ry * o.flat;   // base plana
      vs.push(v.add(V(cx, cy, cz)));
    }
    for (let i = 0; i < vs.length; i += 3) this.tri(vs[i], vs[i + 1], vs[i + 2], color);
    return this;
  }
  /** Caja facetada centrada en (cx, cy, cz); taper achica la tapa de arriba, skew corre la tapa en z. */
  box(cx, cy, cz, w, h, d, color, o = {}) {
    const t = o.taper ?? 1, sk = o.skew ?? 0, j = o.jit ?? 0, s = o.seed ?? 3;
    const e = new THREE.Euler(...(o.rot || [0, 0, 0]));
    const c = [];
    for (let i = 0; i < 8; i++) {
      const top = i & 2 ? 1 : 0, k = top ? t : 1;
      const v = V((i & 1 ? 0.5 : -0.5) * w * k, (top - 0.5) * h, ((i & 4 ? 0.5 : -0.5) * d * k) + top * sk);
      if (j) v.addScalar((hash(i + s, s, i) - 0.5) * j);
      c.push(v.applyEuler(e).add(V(cx, cy, cz)));
    }
    const F = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
    for (const [a, b, cc, dd] of F) this.quad(c[a], c[b], c[cc], c[dd], color);
    return this;
  }
  /** Prisma ahusado entre dos puntos (patas, brazos, colas). */
  limb(p0, p1, r0, r1, color, sides = 5) {
    const a = V(...p0), b = V(...p1), dir = b.clone().sub(a).normalize();
    const up = Math.abs(dir.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(dir, up).normalize(), w = new THREE.Vector3().crossVectors(dir, u).normalize();
    const ring = (c, r) => Array.from({ length: sides }, (_, i) => { const t = (i / sides) * Math.PI * 2 + 0.3; return c.clone().addScaledVector(u, Math.cos(t) * r).addScaledVector(w, Math.sin(t) * r); });
    const A = ring(a, r0), B = ring(b, r1);
    for (let i = 0; i < sides; i++) { const n = (i + 1) % sides; this.quad(A[i], A[n], B[n], B[i], color); }
    for (let i = 1; i < sides - 1; i++) { this.tri(A[0], A[i + 1], A[i], color); this.tri(B[0], B[i], B[i + 1], color); }
    return this;
  }
  /** Púa (cuernos, dientes, cristales, juncos): base de `sides` lados y punta. */
  spike(p0, p1, r, color, sides = 4) {
    const a = V(...p0), b = V(...p1), dir = b.clone().sub(a).normalize();
    const up = Math.abs(dir.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(dir, up).normalize(), w = new THREE.Vector3().crossVectors(dir, u).normalize();
    const R = Array.from({ length: sides }, (_, i) => { const t = (i / sides) * Math.PI * 2 + 0.4; return a.clone().addScaledVector(u, Math.cos(t) * r).addScaledVector(w, Math.sin(t) * r); });
    for (let i = 0; i < sides; i++) this.tri(R[i], R[(i + 1) % sides], b, color);
    for (let i = 1; i < sides - 1; i++) this.tri(R[0], R[i], R[i + 1], color);
    return this;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(this.pos), col = new Float32Array(this.col);
    if (this.ao && pos.length) {   // oclusión falsa: el tercio de abajo, más oscuro
      let y0 = Infinity, y1 = -Infinity;
      for (let i = 1; i < pos.length; i += 3) { y0 = Math.min(y0, pos[i]); y1 = Math.max(y1, pos[i]); }
      const h = Math.max(1e-3, y1 - y0);
      for (let i = 0; i < pos.length; i += 3) { const k = 0.68 + 0.32 * Math.min(1, (pos[i + 1] - y0) / (h * 0.45)); col[i] *= k; col[i + 1] *= k; col[i + 2] *= k; }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();   // sin índices: cada cara queda plana (facetado)
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
  mesh({ glow = false, shadow = true } = {}) {
    const m = new THREE.Mesh(this.geometry(), glow ? lightMat() : voxelMaterial());
    m.castShadow = shadow && !glow; m.receiveShadow = !glow;
    return m;
  }
}
