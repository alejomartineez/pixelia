// Jefes del Acto 1 en low-poly facetado (plan §M1 y §M2; paso 6b): la bestia del Bañado y la capitana pirata, gente-zorro
// del Céfiro. Caras planas en ángulo para que se distingan de inmediato de las unidades vóxel y se sientan pesados. Usan
// el mismo material que los vóxeles (voxelMaterial: luz plana y colores por vértice), así el contorno tinta de
// createPixelRenderer sale solo. Los ojos y las vetas de Marea brillan (MeshBasicMaterial).
//
//   bossModel(type, { phase }) -> THREE.Group | null   (null si el tipo no es jefe: la escena usa enemyModel)
//     origen en el centro de la casilla, base en y = 0, mira a +Z (mismo contrato que enemy-models.js)
//     group.userData.update(dt, moving, t)   respira y mueve la cabeza
//     group.userData.setPhase(k)             fase 2 del jefe (≤ 50 % de vida): la bestia se enciende, la capitana alza el sable
//     group.userData.height / .scale
//
// Se arma en "vóxeles" (8 por casilla, como el resto) y se escala al final. El kit (Facets) es chico y propio: cuando se
// integre la sesión de personajes (4a), puede pasar a src/avatar/lowpoly.js sin cambiar el contrato.
import * as THREE from 'three';
import { voxelMaterial } from '../core/voxel.js';

const VOX = 1 / 8;
const hash = (a, b, c) => {
  let h = (Math.round(a * 97) * 374761393 + Math.round(b * 97) * 668265263 + Math.round(c * 97) * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _c = new THREE.Color(), _n = new THREE.Vector3(), _m = new THREE.Vector3();
const icoCache = new Map();
function icoVerts(detail) {
  if (!icoCache.has(detail)) icoCache.set(detail, new THREE.IcosahedronGeometry(1, detail).toNonIndexed().attributes.position.array);
  return icoCache.get(detail);
}
const lift = (hex, k) => { _c.set(hex); const hsl = {}; _c.getHSL(hsl); _c.setHSL(hsl.h + (k > 0 ? 0.012 : -0.01), hsl.s, Math.max(0, Math.min(1, hsl.l + k * 0.07))); return '#' + _c.getHexString(); };

/** Mallas facetadas: triángulos sueltos con color por cara, un poco de variación y oclusión falsa abajo. */
class Facets {
  constructor({ vary = 0.06, base = 0 } = {}) { this.pos = []; this.col = []; this.vary = vary; this.base = base; }
  tri(a, b, c, color) {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    const my = (a.y + b.y + c.y) / 3;
    let col = typeof color === 'function' ? color(my, (a.x + b.x + c.x) / 3, (a.z + b.z + c.z) / 3) : color;
    _n.subVectors(b, a).cross(_m.subVectors(c, a));
    const ny = _n.y / (_n.length() || 1);
    if (ny > 0.55) col = lift(col, 1); else if (ny < -0.35) col = lift(col, -0.8);
    const k = (1 + (hash(a.x + b.x + c.x, a.y + b.y + c.y, a.z + b.z + c.z) - 0.5) * 2 * this.vary) * (my < this.base + 1.2 ? 0.78 + 0.18 * Math.max(0, my - this.base) / 1.2 : 1);
    _c.set(col);
    for (let i = 0; i < 3; i++) this.col.push(_c.r * k, _c.g * k, _c.b * k);
    return this;
  }
  quad(a, b, c, d, color) { return this.tri(a, b, c, color).tri(a, c, d, color); }
  /** Bulto irregular (icosaedro deformado). o: { seed, detail, jit, flat (corta la base), rot } */
  blob(cx, cy, cz, rx, ry, rz, color, o = {}) {
    const p = icoVerts(o.detail ?? 1), jit = o.jit ?? 0.12, seed = o.seed ?? 1;
    const e = new THREE.Euler(...(o.rot || [0, 0, 0]));
    const vs = [];
    for (let i = 0; i < p.length; i += 3) {
      const n = 1 + (hash(p[i] + seed, p[i + 1] * 1.3, p[i + 2] - seed) - 0.5) * 2 * jit;
      const v = V(p[i] * rx * n, p[i + 1] * ry * n, p[i + 2] * rz * n);
      if (o.flat != null && v.y < -ry * o.flat) v.y = -ry * o.flat;
      vs.push(v.applyEuler(e).add(V(cx, cy, cz)));
    }
    for (let i = 0; i < vs.length; i += 3) this.tri(vs[i], vs[i + 1], vs[i + 2], color);
    return this;
  }
  /** Caja facetada centrada; taper achica la tapa de arriba, skew corre la tapa en z, rot la gira. */
  box(cx, cy, cz, w, h, d, color, o = {}) {
    const t = o.taper ?? 1, sk = o.skew ?? 0;
    const e = new THREE.Euler(...(o.rot || [0, 0, 0]));
    const c = [];
    for (let i = 0; i < 8; i++) {
      const top = i & 2 ? 1 : 0, k = top ? t : 1;
      c.push(V((i & 1 ? 0.5 : -0.5) * w * k, (top - 0.5) * h, (i & 4 ? 0.5 : -0.5) * d * k + top * sk).applyEuler(e).add(V(cx, cy, cz)));
    }
    for (const [a, b, cc, dd] of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) this.quad(c[a], c[b], c[cc], c[dd], color);
    return this;
  }
  /** Prisma ahusado entre dos puntos (patas, brazos, colas, juncos). */
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
  /** Púa: pirámide de base triangular (colmillos, garras, orejas). */
  spike(p0, p1, r, color) {
    const a = V(...p0), tip = V(...p1), dir = tip.clone().sub(a).normalize();
    const up = Math.abs(dir.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(dir, up).normalize(), w = new THREE.Vector3().crossVectors(dir, u).normalize();
    const B = [0, 1, 2].map(i => { const t = (i / 3) * Math.PI * 2; return a.clone().addScaledVector(u, Math.cos(t) * r).addScaledVector(w, Math.sin(t) * r); });
    for (let i = 0; i < 3; i++) this.tri(B[i], B[(i + 1) % 3], tip, color);
    this.tri(B[0], B[2], B[1], color);
    return this;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  mesh(mat = voxelMaterial()) {
    const m = new THREE.Mesh(this.geometry(), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
}
// sombreado plano: los triángulos van sueltos, así computeVertexNormals da una normal por cara (no suaviza)

// ---------- paletas (terrosas y apagadas, M1; un acento por jefe) ----------
const P = {
  ink: '#16110e', bone: '#d8cfb8', bone_d: '#a89e86',
  moss: '#3d5236', moss_d: '#2b3a27', moss_l: '#55703f', mud: '#4a3b2a', mud_d: '#33281c', reed: '#7c7440', reed_l: '#9a8e52',
  marea: '#7fe8d8', marea_hot: '#c8fff4', beast_eye: '#d8ff7a',
  fox: '#a8562c', fox_d: '#7d3d1f', fox_l: '#c47a45', cream: '#e2d6bd', coat: '#5a1c22', coat_d: '#3d1217', gold: '#c9a04a', gold_d: '#94732f',
  brass: '#a98a45', iron: '#7c8086', iron_d: '#4f5257', leather: '#3a2a20', boot: '#1f1814', shirt: '#2c2529', hat: '#231b1c',
  feather: '#d6cec0', fox_eye: '#ffc35a',
};

// ---------- la bestia del Bañado ----------
// La Madre del Agua de los Anuros: lomo encorvado de barro y musgo, juncos en la espalda, cuatro ojos y vetas de Marea
// suelta que le corren por el lomo (en la fase 2 se encienden y le brilla la boca).
function beast() {
  const g = new THREE.Group();
  const body = new Facets({ base: 0 });
  const skin = (y, x, z) => (y < 2.2 ? P.mud : (Math.abs(x) * 3 + z * 2 + y) % 7 < 1.4 ? P.moss_l : (Math.abs(x) + z) % 5 < 1.6 ? P.moss_d : P.moss);
  body.blob(0, 4.4, -0.2, 5.4, 3.8, 6, skin, { seed: 3, flat: 0.95, jit: 0.16 });
  body.blob(0, 6.9, -1.8, 4.2, 2.9, 4.2, skin, { seed: 7, jit: 0.18 });
  // patas: adelante con garras de hueso, atrás más cortas
  for (const s of [-1, 1]) {
    body.limb([s * 3.9, 3.4, 3.2], [s * 4.9, 0.4, 5.4], 1.5, 1.0, P.moss_d, 6);
    body.blob(s * 4.9, 0.6, 5.6, 1.3, 0.7, 1.4, P.mud_d, { seed: 11 + s, detail: 0 });
    for (const k of [-1, 0, 1]) body.spike([s * 4.9 + k * 0.6, 0.5, 6.4], [s * 4.9 + k * 0.8, 0.1, 7.6], 0.28, P.bone);
    body.limb([s * 3.6, 3.0, -3.6], [s * 4.3, 0.3, -4.2], 1.6, 1.1, P.moss_d, 6);
  }
  // cola gruesa que se arrastra
  body.limb([0, 3.0, -5.6], [0.6, 1.4, -8.6], 1.9, 1.0, P.moss_d, 6);
  body.limb([0.6, 1.4, -8.6], [1.6, 0.6, -10.4], 1.0, 0.3, P.mud, 5);
  // juncos que le crecen en el lomo
  for (const [x, z, h, lean] of [[-1.8, -2.6, 4.2, -0.6], [0.6, -3.4, 5.0, 0.4], [2.2, -1.4, 3.4, 0.9], [-0.6, -0.2, 3.0, -0.3], [1.4, -4.6, 3.6, 0.2]]) {
    body.limb([x, 8.4, z], [x + lean, 8.4 + h, z - 0.4], 0.2, 0.08, P.reed, 4);
    body.spike([x + lean, 8.4 + h - 0.2, z - 0.4], [x + lean * 1.1, 8.4 + h + 0.9, z - 0.5], 0.26, P.reed_l);
  }
  const bodyMesh = body.mesh();
  g.add(bodyMesh);
  // vetas de Marea suelta sobre el lomo (brillan; en la fase 2, más)
  const veins = new Facets({ vary: 0 });
  for (const [x, y, z, r] of [[-1.2, 9.2, -1.2, 0.42], [0.9, 9.4, -2.4, 0.5], [-0.4, 9.0, -3.8, 0.38], [2.6, 7.8, 0.2, 0.36], [-2.8, 7.6, -0.6, 0.34], [0.2, 8.4, 0.8, 0.3]])
    veins.blob(x, y, z, r, r * 0.6, r * 1.6, '#ffffff', { detail: 0, seed: x * 3 + z, jit: 0.2 });
  const veinMesh = new THREE.Mesh(veins.geometry(), new THREE.MeshBasicMaterial({ color: P.marea, transparent: true, opacity: 0.85 }));
  g.add(veinMesh);
  // cabeza: parte animada con la boca abierta y cuatro ojos
  const head = new THREE.Group();
  head.position.set(0, 4.6, 4.6);
  const hf = new Facets({ base: -4 });
  hf.blob(0, 0.2, 1.8, 3.3, 2.2, 2.9, (y, x, z) => (y > 1.2 ? P.moss_d : P.moss), { seed: 5, jit: 0.14 });
  hf.box(0, -1.6, 2.9, 5.0, 1.0, 3.2, P.moss_d, { rot: [0.32, 0, 0] });   // mandíbula, abierta
  hf.box(0, -0.75, 3.4, 4.2, 0.6, 2.4, P.ink, { rot: [0.16, 0, 0] });      // boca
  for (const x of [-1.6, -0.6, 0.6, 1.6]) hf.spike([x, -0.4, 4.2], [x * 1.05, -1.4, 4.5], 0.26, P.bone);
  for (const x of [-1.2, 1.2]) hf.spike([x, -1.4, 4.0], [x, -0.5, 4.3], 0.22, P.bone_d);
  // ceño pesado sobre los ojos
  hf.box(0, 1.5, 3.4, 4.8, 0.8, 1.2, P.moss_d, { rot: [-0.25, 0, 0] });
  head.add(hf.mesh());
  const eyes = new Facets({ vary: 0 });
  for (const [x, y, z] of [[-1.3, 0.95, 4.3], [1.3, 0.95, 4.3], [-2.2, 0.35, 3.8], [2.2, 0.35, 3.8]]) eyes.blob(x, y, z, 0.36, 0.3, 0.2, '#ffffff', { detail: 0, jit: 0 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: P.beast_eye });
  head.add(new THREE.Mesh(eyes.geometry(), eyeMat));
  // brillo de la boca en la fase 2
  const maw = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 1.6), new THREE.MeshBasicMaterial({ color: P.marea, transparent: true, opacity: 0 }));
  maw.position.set(0, -0.6, 3.6); maw.rotation.x = 0.16;
  head.add(maw);
  g.add(head);
  let phase = 0;
  g.userData.setPhase = (k) => { phase = k; };
  g.userData.update = (dt, moving, t) => {
    const br = Math.sin(t * 1.1) * 0.025;
    bodyMesh.scale.y = 1 + br;
    head.rotation.x = -0.05 + Math.sin(t * 0.9) * 0.07 + (phase ? Math.sin(t * 3.2) * 0.04 : 0);
    head.rotation.y = Math.sin(t * 0.5) * 0.1;
    const glow = phase ? 0.75 + Math.sin(t * 4.0) * 0.25 : 0.55 + Math.sin(t * 1.6) * 0.15;
    veinMesh.material.opacity = glow;
    veinMesh.material.color.set(phase ? P.marea_hot : P.marea);
    maw.material.opacity = phase ? 0.55 + Math.sin(t * 4.0) * 0.3 : 0;
  };
  return { g, height: 12.5, footprint: 13 };
}

// ---------- la capitana ----------
// Gente-zorro del Céfiro (M2): saco largo rojo oscuro con dorado, tricornio con pluma, brazo de bronce con la pistola y el
// sable en la otra mano. En la fase 2 (el abordaje) alza el sable y se le encienden los ojos.
function captain() {
  const g = new THREE.Group();
  const f = new Facets({ base: 0 });
  // piernas y botas
  for (const s of [-1, 1]) {
    f.limb([s * 0.95, 4.4, 0], [s * 1.0, 1.4, 0.1], 0.75, 0.62, P.shirt, 5);
    f.box(s * 1.0, 0.75, 0.35, 1.5, 1.5, 2.2, P.boot, { taper: 0.9 });
    f.box(s * 1.0, 1.75, 0.15, 1.6, 0.5, 1.7, P.leather);
  }
  // saco largo: falda abierta adelante, torso, solapas y ruedo dorado
  f.box(0, 4.0, -0.1, 4.6, 3.4, 2.8, (y) => (y < 2.6 ? P.coat_d : P.coat), { taper: 0.82 });
  f.box(0, 2.45, -0.1, 4.9, 0.4, 3.0, P.gold_d);
  f.box(0, 7.3, 0, 4.0, 3.6, 2.4, P.coat, { taper: 0.92 });
  f.box(0, 7.1, 1.15, 1.5, 3.0, 0.3, P.shirt);
  for (const s of [-1, 1]) f.box(s * 0.95, 7.6, 1.2, 0.5, 2.6, 0.32, P.gold, { rot: [0, 0, s * 0.18] });
  f.box(0, 5.6, 0.05, 4.2, 0.6, 2.6, P.leather);
  f.box(0, 5.6, 1.35, 0.8, 0.7, 0.2, P.gold);
  // charreteras
  for (const s of [-1, 1]) f.blob(s * 2.15, 9.0, 0, 0.95, 0.42, 0.95, P.gold, { detail: 0, seed: 4 + s });
  g.add(f.mesh());
  // brazo izquierdo de bronce con la pistola (fijo)
  const left = new Facets({ base: 3 });
  left.limb([2.35, 8.6, 0], [2.7, 6.0, 0.6], 0.62, 0.5, P.brass, 5);
  left.limb([2.7, 6.0, 0.6], [2.6, 5.6, 2.3], 0.5, 0.42, P.brass, 5);
  left.box(2.6, 5.7, 3.2, 0.5, 0.6, 1.8, P.iron_d);
  left.box(2.6, 5.15, 2.6, 0.42, 0.9, 0.5, P.leather);
  g.add(left.mesh());
  // brazo derecho con el sable: parte animada (lo alza en la fase 2)
  const arm = new THREE.Group();
  arm.position.set(-2.35, 8.6, 0);
  const af = new Facets({ base: -6 });
  af.limb([0, 0, 0], [-0.3, -2.6, 0.6], 0.66, 0.52, P.coat, 5);
  af.box(-0.3, -2.75, 0.6, 1.0, 0.5, 1.0, P.gold_d);
  af.limb([-0.3, -2.9, 0.6], [-0.35, -3.7, 1.2], 0.46, 0.4, P.fox_d, 5);
  af.box(-0.35, -3.85, 1.4, 1.2, 0.3, 0.5, P.gold);                       // guarda
  af.box(-0.35, -3.85, 4.0, 0.16, 0.5, 4.8, P.iron, { rot: [0.18, 0, 0] }); // hoja
  arm.add(af.mesh());
  g.add(arm);
  // cabeza de zorro: parte animada
  const head = new THREE.Group();
  head.position.set(0, 10.1, 0.1);
  const hf = new Facets({ base: -12 });
  hf.blob(0, 0.9, 0, 1.75, 1.6, 1.6, (y) => (y < 10.4 ? P.fox_d : P.fox), { seed: 9, detail: 1, jit: 0.08 });
  hf.limb([0, 0.55, 1.0], [0, 0.25, 3.0], 0.95, 0.26, P.fox_l, 5);            // hocico
  hf.blob(0, 0.05, 1.7, 1.15, 0.6, 1.0, P.cream, { detail: 0, seed: 2 });     // quijada clara
  hf.blob(0, 0.42, 3.05, 0.26, 0.22, 0.22, P.ink, { detail: 0 });             // nariz
  for (const s of [-1, 1]) {
    hf.spike([s * 1.0, 2.0, -0.1], [s * 1.35, 3.6, -0.3], 0.55, P.fox_d);     // orejas
    hf.box(s * 1.1, 1.3, 1.15, 0.9, 0.24, 0.4, P.fox_d, { rot: [0, 0, s * -0.25] });   // ceño
  }
  // cicatriz en el hocico
  hf.box(0.45, 0.75, 2.2, 0.12, 0.12, 1.1, P.cream, { rot: [0, 0.35, 0] });
  // tricornio con pluma
  hf.box(0, 2.6, 0, 4.0, 0.42, 3.6, P.hat, { taper: 0.92 });
  hf.box(0, 3.2, -0.1, 2.3, 1.1, 2.1, P.hat, { taper: 0.8 });
  hf.box(0, 2.85, 0, 2.4, 0.22, 2.2, P.gold_d);
  hf.limb([0.9, 3.1, -0.4], [2.4, 4.6, -1.6], 0.28, 0.08, P.feather, 4);
  head.add(hf.mesh());
  const eyes = new Facets({ vary: 0 });
  for (const s of [-1, 1]) eyes.blob(s * 0.72, 1.0, 1.35, 0.22, 0.16, 0.1, '#ffffff', { detail: 0, jit: 0 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: P.fox_eye });
  head.add(new THREE.Mesh(eyes.geometry(), eyeMat));
  g.add(head);
  // cola de zorro que asoma bajo el saco
  const tail = new Facets({ base: 0 });
  tail.limb([0, 3.4, -1.4], [0.4, 1.8, -3.2], 0.9, 0.7, P.fox, 6);
  tail.limb([0.4, 1.8, -3.2], [0.9, 1.4, -4.2], 0.7, 0.2, P.cream, 6);
  const tailMesh = tail.mesh();
  g.add(tailMesh);
  let phase = 0, raise = 0;
  g.userData.setPhase = (k) => { phase = k; };
  g.userData.update = (dt, moving, t) => {
    raise += ((phase ? 1 : 0) - raise) * Math.min(1, (dt || 0.016) * 3);
    arm.rotation.x = -raise * 1.6 + Math.sin(t * 1.4) * 0.05;
    arm.rotation.z = -raise * 0.25;
    head.rotation.y = Math.sin(t * 0.6) * 0.16;
    head.rotation.x = Math.sin(t * 1.3) * 0.03;
    tailMesh.rotation.y = Math.sin(t * 1.8) * 0.12;
    eyeMat.color.set(phase ? '#ffe08a' : P.fox_eye);
  };
  return { g, height: 15, footprint: 8 };
}

const BUILD = { bestia: beast, capitana: captain };
/** Escala por jefe: la bestia ocupa más que su casilla (se sale un poco), la capitana como una persona alta. */
const SCALE = { bestia: 1.12, capitana: 0.98 };
export const BOSS_TYPES = Object.keys(BUILD);

/** Modelo low-poly de un jefe, o null si `type` no es uno. */
export function bossModel(type, { phase = 0 } = {}) {
  const build = BUILD[type];
  if (!build) return null;
  const { g: inner, height } = build();
  const g = new THREE.Group();
  inner.scale.setScalar(VOX);
  g.add(inner);
  const s = SCALE[type] || 1;
  g.scale.setScalar(s);
  g.userData.scale = s;
  g.userData.height = height * VOX * s;
  g.userData.type = type;
  g.userData.lowpoly = true;
  g.userData.update = (dt, moving, t) => inner.userData.update?.(dt, moving, t ?? performance.now() / 1000);
  g.userData.setPhase = (k) => inner.userData.setPhase?.(k);
  if (phase) inner.userData.setPhase(phase);
  g.name = 'boss:' + type;
  return g;
}
