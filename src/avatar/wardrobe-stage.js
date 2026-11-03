// Escenarios 3D del vestidor (boutique rosa y taller) + miniaturas offscreen de prendas/autos.
// Lo usa src/scenes/wardrobe.js. Todo lo que crea acá se libera con disposeObject / dispose().
import * as THREE from 'three';
import { Voxels, voxelMaterial, glowMaterial, shade, addLights } from '../core/voxel.js';
import { avatarModel } from './avatar.js';
import { carModel } from './car.js';

const E = 1 / 8;   // vóxeles grandes (piso, paredes)
const F = 1 / 16;  // vóxeles finos (muebles, tarima)

function mesh(v, scale, { shadow = true, receive = true, material } = {}) {
  const m = new THREE.Mesh(v.toGeometry({ scale, jitter: 0.03 }), material || voxelMaterial());
  m.castShadow = shadow; m.receiveShadow = receive;
  return m;
}

// =====================================================================
//                         TARIMA / PLATAFORMA GIRATORIA
// =====================================================================
/** Tarima redonda con lucecitas que titilan. kind: 'boutique' | 'garage'. Alto: userData.top */
export function buildPlatform(kind = 'boutique') {
  const g = new THREE.Group();
  const R = kind === 'garage' ? 12.5 : 10.5;
  const v = new Voxels();
  const top = kind === 'garage' ? [0xf3eefa, 0xe4dcf2] : [0xfff4fa, 0xffe3f1];
  const rim = kind === 'garage' ? 0xb58cff : 0xff9cc8;
  for (let x = -Math.ceil(R); x < Math.ceil(R); x++) for (let z = -Math.ceil(R); z < Math.ceil(R); z++) {
    const d = Math.hypot(x + 0.5, z + 0.5);
    if (d > R) continue;
    v.set(x, 0, z, 0xe8a93a);
    const edge = d > R - 1.3;
    let c;
    if (edge) c = rim;
    else if (kind === 'garage') c = (Math.floor(Math.atan2(z + 0.5, x + 0.5) / (Math.PI / 8)) & 1) ? top[0] : top[1];
    else c = d < 3 ? 0xffd6e8 : (Math.floor(d / 2.5) & 1) ? top[0] : top[1];
    v.set(x, 1, z, edge ? rim : 0xffffff);
    v.set(x, 2, z, c);
  }
  // estrellita/corazón al centro
  if (kind !== 'garage') for (const [x, z] of [[-1, 0], [0, 0], [-1, -1], [0, -1], [-2, 0], [1, 0], [-1, 1], [0, 1], [-2, 1], [1, 1], [-1, 2], [0, 2]]) v.set(x, 2, z - 1, 0xff9cc8);
  g.add(mesh(v, F));
  // lucecitas: dos grupos que se alternan
  const bulbs = [new Voxels(), new Voxels()];
  const n = kind === 'garage' ? 22 : 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.round(Math.cos(a) * (R + 0.2) - 0.5), z = Math.round(Math.sin(a) * (R + 0.2) - 0.5);
    bulbs[i & 1].set(x, 1, z, i % 4 < 2 ? 0xfff0a8 : 0xffd1ea);
  }
  const bm = bulbs.map(b => { const m = mesh(b, F, { shadow: false, material: glowMaterial() }); m.position.y = 0.002; m.scale.set(1.02, 1, 1.02); g.add(m); return m; });
  g.userData.top = 3 * F;
  let acc = 0, on = 0;
  g.userData.update = (dt) => {
    acc += dt;
    if (acc > 0.45) { acc = 0; on ^= 1; bm[0].visible = !!on; bm[1].visible = !on; }
  };
  bm[1].visible = false;
  return g;
}

// =====================================================================
//                                BOUTIQUE
// =====================================================================
function floor(v, x0, x1, z0, z1, colFn) {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) v.set(x, -1, z, colFn(x, z));
}
function miniDress(v, x0, y0, z, c) {
  // percha
  v.set(x0, y0 + 9, z, 0xc9c0da); v.set(x0, y0 + 8, z, 0xc9c0da);
  for (let x = x0 - 2; x <= x0 + 2; x++) v.set(x, y0 + 7, z, 0xe8e2f2);
  // vestidito
  const d = shade(c, -0.15), l = shade(c, 0.3);
  for (let y = 0; y <= 6; y++) {
    const w = y >= 5 ? 1 : y >= 3 ? 1 : 2 + (y < 1 ? 1 : 0);
    for (let x = x0 - w; x <= x0 + w; x++) for (let dz = 0; dz <= 1; dz++) v.set(x, y0 + y, z + dz, y === 0 ? l : y === 4 ? 0xffffff : ((x + y) & 1 ? c : d));
  }
}
export function buildBoutique() {
  const g = new THREE.Group();
  // piso + pasarela
  const fv = new Voxels();
  floor(fv, -32, 31, -24, 20, (x, z) => {
    const run = x >= -6 && x <= 5 && z >= -2;
    if (run) return (x === -6 || x === 5) ? 0xffd166 : ((z >> 1) & 1 ? 0xff9cc8 : 0xffb3d1);
    return (((x >> 1) + (z >> 1)) & 1) ? 0xffd6e8 : 0xfff4fa;
  });
  g.add(mesh(fv, E, { shadow: false }));

  // pared del fondo
  const w = new Voxels();
  for (let x = -32; x <= 31; x++) for (let y = 0; y <= 31; y++) for (let z = -26; z <= -25; z++) {
    let c;
    if (y <= 5) c = (x % 6 === 0 || y === 0) ? 0xffe3f1 : 0xfff7fb;
    else if (y === 6) c = 0xff9cc8;
    else if (y >= 30) c = 0xfff7fb;
    else {
      c = ((x + 64) >> 1) & 1 ? 0xffc9e0 : 0xffdcec;
      if ((x + 64) % 8 === 3 && (y % 6 === 3)) c = 0xffffff; // brillitos
    }
    w.set(x, y, z, c);
  }
  // espejo ovalado con marco dorado (detrás del personaje = aureola)
  for (let x = -7; x <= 6; x++) for (let y = 2; y <= 19; y++) {
    const d = Math.hypot((x + 0.5) / 6.6, (y + 0.5 - 11) / 8.8);
    if (d > 1) continue;
    const frame = d > 0.84;
    const shine = !frame && (x - y + 30) % 9 < 2 && x > -4;
    w.set(x, y, -24, frame ? ((x + y) & 1 ? 0xffd166 : 0xe8a93a) : shine ? 0xffffff : (y > 11 ? 0xd4efff : 0xc4e6fb));
  }
  for (const [x, y] of [[-1, 20], [0, 20], [-2, 21], [1, 21], [-1, 21], [0, 21], [-1, 22], [0, 22]]) w.set(x, y, -24, x === -1 && y === 22 ? 0xff7eb6 : 0xffd166);
  // banderines
  for (let x = -30; x <= 29; x++) {
    const sag = Math.round(Math.abs(Math.sin((x + 30) / 60 * Math.PI * 2)) * -3);
    const y = 26 + sag;
    w.set(x, y, -24, 0xfff0c2);
    if ((x + 64) % 5 === 0) {
      const cols = [0xff7eb6, 0xb58cff, 0x6fe3c1, 0x8fd3ff, 0xffd166];
      const c = cols[((x + 64) / 5) % cols.length | 0];
      for (let k = 0; k < 3; k++) for (let dx = -1 + Math.ceil(k / 2); dx <= 1 - Math.ceil(k / 2); dx++) w.set(x + dx, y - 1 - k, -24, c);
    }
  }
  g.add(mesh(w, E, { shadow: false }));

  // muebles con vóxel fino
  const m = new Voxels();
  // perchero con vestiditos (izquierda)
  const rx0 = -44, rx1 = -24, rz = -36;
  for (const x of [rx0, rx1]) { for (let y = 0; y <= 22; y++) m.set(x, y, rz, 0xffd166); m.box(x - 2, 0, rz - 2, 5, 1, 5, 0xe8a93a); }
  for (let x = rx0; x <= rx1; x++) m.set(x, 22, rz, x === rx0 || x === rx1 ? 0xfff0c2 : 0xffd166);
  [[0xff7eb6, rx0 + 4], [0xb58cff, rx0 + 9], [0x6fe3c1, rx0 + 14], [0x8fd3ff, rx0 + 18]].forEach(([c, x]) => miniDress(m, x, 12, rz - 1, c));
  // estante blanco con cajas y zapatos (derecha)
  const sx0 = 26, sx1 = 44, sz0 = -46, sz1 = -38;
  for (let x = sx0; x <= sx1; x++) for (let y = 0; y <= 26; y++) for (let z = sz0; z <= sz1; z++) {
    const side = x === sx0 || x === sx1, shelf = y === 0 || y === 9 || y === 18 || y === 26, backW = z === sz0;
    if (side || shelf || backW) m.set(x, y, z, shelf && z === sz1 ? 0xffc2dc : 0xfff7fb);
  }
  // caja de sombrero, zapatitos, cartera, plantita
  m.cylinder(31, 10, -42, 3, 4, (x, y) => (y === 12 ? 0xffffff : 0xff9cc8)); m.cylinder(31, 14, -42, 3.3, 1, 0xff7eb6);
  m.box(36, 10, -41, 2, 2, 3, 0xb58cff); m.box(39, 10, -41, 2, 2, 3, 0xb58cff); m.set(36, 12, -41, 0xffd166);
  m.box(29, 19, -42, 5, 4, 3, 0x6fe3c1); m.box(30, 23, -41, 3, 1, 1, 0x3cbf9a); m.set(31, 21, -39, 0xffd166);
  m.cylinder(39, 19, -42, 2, 3, 0xffb38a); m.sphere(39, 24, -42, 3, 3, 3, (x, y) => (y > 24 ? 0x8fdc7a : 0x5fc46a));
  m.set(38, 26, -40, 0xff7eb6); m.set(41, 24, -41, 0xffffff);
  m.box(29, 1, -42, 3, 3, 3, 0xffd166); m.box(35, 1, -43, 6, 5, 4, 0xff7eb6); m.box(35, 6, -43, 6, 1, 4, 0xffc2dc); m.set(37, 3, -39, 0xffffff); m.set(38, 3, -39, 0xffffff);
  // macetas con flores a los costados de la pasarela
  for (const x of [-16, 15]) {
    m.cylinder(x, 0, 12, 3, 4, 0xffffff); m.cylinder(x, 4, 12, 3.3, 1, 0xff9cc8);
    m.sphere(x, 7.5, 12, 3.5, 3, 3.5, (X, Y, Z) => ((X + Y + Z) % 4 === 0 ? 0xff7eb6 : (X * 3 + Z) % 7 === 0 ? 0xffffff : 0x6cc35d));
  }
  // puf redondo
  m.cylinder(-30, 0, 0, 4.5, 5, (x, y) => (y === 4 ? 0xdcc9ff : 0xb58cff));
  m.set(-30, 5, 0, 0xffd166);
  g.add(mesh(m, F));

  g.userData.update = () => {};
  return g;
}

// =====================================================================
//                                 TALLER
// =====================================================================
export function buildGarage() {
  const g = new THREE.Group();
  const fv = new Voxels();
  floor(fv, -32, 31, -24, 20, (x, z) => {
    if ((x === -10 || x === 9) && z > -4 && z % 3 !== 0) return 0xffd166;
    return (((x >> 2) + (z >> 2)) & 1) ? 0xdcd5ea : 0xe8e2f2;
  });
  g.add(mesh(fv, E, { shadow: false }));

  const w = new Voxels();
  for (let x = -32; x <= 31; x++) for (let y = 0; y <= 31; y++) for (let z = -26; z <= -25; z++) {
    const row = y >> 1, brickX = (x + (row & 1) * 2 + 64) % 4;
    let c = (y & 1) === 1 && brickX !== 0 ? 0xc9b8ff : (brickX === 0 || (y & 1) === 0 ? 0xe9dcff : 0xc9b8ff);
    if ((y & 1) === 1 && brickX !== 0 && ((x * 7 + y * 3) % 11 === 0)) c = 0xbaa6f5;
    if (y <= 3) c = 0x9d83a6;
    w.set(x, y, z, c);
  }
  // panel de herramientas
  for (let x = -26; x <= -12; x++) for (let y = 8; y <= 20; y++) w.set(x, y, -24, (x + y) % 3 === 0 ? 0xe8dcc8 : 0xf6ecd8);
  // cartel de neón con corazón
  const heart = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  heart.forEach((row, i) => [...row].forEach((ch, j) => { if (ch === '#') w.set(16 + j, 20 - i, -24, i === 1 && j === 1 ? 0xffffff : 0xff7eb6); }));
  for (let x = 12; x <= 26; x++) { w.set(x, 12, -24, 0x3b2340); w.set(x, 23, -24, 0x3b2340); }
  for (let y = 12; y <= 23; y++) { w.set(12, y, -24, 0x3b2340); w.set(26, y, -24, 0x3b2340); }
  // banderines
  for (let x = -30; x <= 29; x++) {
    const y = 27 + Math.round(Math.abs(Math.sin((x + 30) / 60 * Math.PI * 2)) * -2);
    w.set(x, y, -24, 0xfff0c2);
    if ((x + 64) % 6 === 0) { const c = [0xffd166, 0x6fe3c1, 0xff7eb6][((x + 64) / 6) % 3 | 0]; w.set(x, y - 1, -24, c); w.set(x - 1, y - 1, -24, c); w.set(x + 1, y - 1, -24, c); w.set(x, y - 2, -24, c); }
  }
  g.add(mesh(w, E, { shadow: false }));
  // neón brillante (aparte para el material que brilla)
  const nv = new Voxels();
  heart.forEach((row, i) => [...row].forEach((ch, j) => { if (ch === '#') nv.set(16 + j, 20 - i, -23, i === 1 && j === 1 ? 0xffffff : 0xff9cc8); }));
  const neon = mesh(nv, E, { shadow: false, material: glowMaterial() });
  neon.scale.z = 0.4; neon.position.z = -0.06;
  g.add(neon);

  const m = new Voxels();
  // herramientas en el panel (llaves y martillo, en vóxel fino)
  for (let i = 0; i < 3; i++) {
    const x = -46 + i * 8;
    for (let y = 22; y <= 34; y++) m.set(x, y, -47, 0xa99fbf);
    m.box(x - 1, 34, -47, 3, 3, 1, 0xa99fbf); m.set(x, 36, -47, null);
    m.box(x - 1, 21, -47, 3, 2, 1, i === 1 ? 0xff7eb6 : 0x8fd3ff);
  }
  for (let y = 22; y <= 34; y++) m.set(-26, y, -47, 0xb07a52);
  m.box(-29, 33, -47, 7, 3, 1, 0x8a7f9c);
  // pila de neumáticos (izquierda)
  for (let k = 0; k < 3; k++) m.cylinder(-38, k * 4, -30, 5, 4, (x, y, z) => {
    const d = Math.hypot(x + 38, z + 30);
    if (d < 2.2) return null;
    return y === k * 4 + 3 ? 0x5b4a66 : 0x4a3a55;
  });
  m.cylinder(-38, 12, -30, 5.3, 1, (x, y, z) => (Math.hypot(x + 38, z + 30) < 2.2 ? null : 0xff9cc8));
  // caja de herramientas (derecha)
  m.box(28, 0, -44, 14, 14, 8, (x, y) => (y % 5 === 4 ? 0xe0528f : 0xff7eb6));
  for (let y = 2; y <= 12; y += 5) m.box(33, y, -36, 4, 1, 1, 0xfff0c2);
  m.box(29, 14, -43, 12, 1, 6, 0x3b2340);
  // conos
  for (const [x, z] of [[-20, 10], [20, 14]]) for (let y = 0; y <= 8; y++) {
    const r = Math.max(0.6, 3 - y * 0.32);
    m.cylinder(x, y, z, r, 1, y === 0 ? 0x9d83a6 : (y === 3 || y === 4) ? 0xffffff : 0xffb38a);
  }
  // bidón de "nafta" mágica
  m.box(18, 0, -30, 5, 7, 4, 0x6fe3c1); m.box(19, 7, -29, 2, 2, 2, 0x3cbf9a); m.set(20, 4, -26, 0xffffff); m.set(20, 3, -26, 0xffffff);
  g.add(mesh(m, F));
  g.userData.update = () => {};
  return g;
}

// =====================================================================
//                   MINIATURAS OFFSCREEN (cacheadas como dataURL)
// =====================================================================
const thumbCache = new Map();
const MAX_THUMBS = 260;
let tr = null; // { renderer, scene, camera }

function ensureThumbRenderer() {
  if (tr) return tr;
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setSize(64, 64, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const { sun } = addLights(scene, { shadowSize: 4, shadowRes: 256 });
  sun.castShadow = false;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -20, 40);
  tr = { renderer, scene, camera };
  return tr;
}
/** Libera el renderer de miniaturas (las imágenes cacheadas quedan). */
export function disposeThumbs() {
  if (!tr) return;
  tr.renderer.dispose();
  tr.renderer.forceContextLoss?.();
  tr = null;
}

const FRAMES = {
  head: { y: 0.77, view: 0.94, ang: 0.45, elev: 0.18 }, // entra la corona más alta (estrella) y el rodete
  body: { y: 0.53, view: 1.22, ang: 0.45, elev: 0.18 },
  tall: { y: 0.86, view: 1.18, ang: 0.45, elev: 0.18 }, // sombreros altos y orejas de conejito
  tallbody: { y: 0.62, view: 1.42, ang: 0.45, elev: 0.18 },
  fur: { y: 0.47, view: 0.88, ang: 0.45, elev: 0.18 },      // pelajes: animalito sin ropa, más de cerca
  furtall: { y: 0.56, view: 1.06, ang: 0.45, elev: 0.18 },  // ídem con orejas largas
  back: { y: 0.6, view: 1.3, ang: 2.55, elev: 0.18 },
  car: { y: 0.33, view: 1.0, ang: 0.85, elev: 0.5 },
  wheel: { y: 0, view: 0.4, ang: Math.PI / 2, elev: 0.05 },
};
const _box = new THREE.Box3(), _v = new THREE.Vector3();
/** Ajusta una cámara ortográfica (ya orientada) para que entre todo obj, cuadrado y centrado. */
function fitOrtho(camera, obj, margin = 0.1) {
  camera.updateMatrixWorld(true);
  obj.updateMatrixWorld(true);
  _box.setFromObject(obj);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    _v.set(i & 1 ? _box.max.x : _box.min.x, i & 2 ? _box.max.y : _box.min.y, i & 4 ? _box.max.z : _box.min.z).applyMatrix4(camera.matrixWorldInverse);
    x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y);
  }
  const half = Math.max(x1 - x0, y1 - y0) * (1 + margin) / 2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  camera.left = cx - half; camera.right = cx + half; camera.top = cy + half; camera.bottom = cy - half;
}

/**
 * Devuelve el dataURL de una miniatura. spec:
 *  { type:'avatar' (o 'princess'), look, frame:'head'|'tall'|'body'|'tallbody'|'back' }
 *  { type:'car', car, frame:'car'|'wheel', driver? }
 */
export function thumbnail(spec) {
  const key = JSON.stringify(spec);
  if (thumbCache.has(key)) return thumbCache.get(key);
  const { renderer, scene, camera } = ensureThumbRenderer();
  let obj, fr = FRAMES[spec.frame] || FRAMES.body;
  if (spec.type === 'princess' || spec.type === 'avatar') obj = avatarModel(spec.look);
  else if (spec.frame === 'wheel') {
    const c = carModel(spec.car);
    const w = c.userData.wheels[0];
    obj = new THREE.Mesh(w.geometry, w.material);
    obj.rotation.x = 0.4; obj.rotation.y = -0.35;
  } else {
    obj = carModel(spec.car, { driver: spec.driver || null });
    const s = obj.userData.size;
    fr = { ...fr, y: s.h * 0.42, fit: true };
  }
  scene.add(obj);
  const target = new THREE.Vector3(0, fr.y, 0);
  camera.position.set(Math.sin(fr.ang) * 10 * Math.cos(fr.elev), fr.y + Math.sin(fr.elev) * 10, Math.cos(fr.ang) * 10 * Math.cos(fr.elev));
  camera.lookAt(target);
  if (fr.fit) fitOrtho(camera, obj, 0.1); // autos: encuadre según la caja real (los adornos altos no se cortan)
  else { camera.left = -fr.view / 2; camera.right = fr.view / 2; camera.top = fr.view / 2; camera.bottom = -fr.view / 2; }
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(obj);
  thumbCache.set(key, url);
  if (thumbCache.size > MAX_THUMBS) thumbCache.delete(thumbCache.keys().next().value);
  return url;
}
export const hasThumb = (spec) => thumbCache.has(JSON.stringify(spec));
