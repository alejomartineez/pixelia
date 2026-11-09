// Escenarios 3D del Equipaje (la Sastrería y el muelle del esquife) + miniaturas offscreen de prendas y del esquife.
// Los modelos están pintados con la paleta clara de antes: al armarlos se re-mapean a madera oscura, cuero y bronce
// (tailor, interfaz oscura y fuera lo tierno: PLAN-QUIEBRE §J6/J7). Las lucecitas (glowMaterial) no se tocan.
// Lo usa src/scenes/wardrobe.js. Todo lo que crea acá se libera con disposeObject / dispose().
import * as THREE from 'three';
import { Voxels, voxelMaterial, glowMaterial, shade, addLights, outlineCanvas } from '../core/voxel.js';
import { avatarModel } from './avatar.js';
import { toHsl, fromHsl } from '../city/themes.js';
import { carModel } from './car.js';

const E = 1 / 8;   // vóxeles grandes (piso, paredes)
const F = 1 / 16;  // vóxeles finos (muebles, tarima)

/** Color de la Sastrería: lo dorado pasa a bronce, los azules a pizarra, lo claro a madera oscura, rosas a cuero. */
function tailor(c) {
  const [h, s, l, d] = toHsl(c);
  if (d > 0.2 && h >= 34 && h < 62) return fromHsl(36, s * 0.7, l * 0.72);
  if (d > 0.12 && h >= 185 && h < 255) return fromHsl(212, s * 0.35, l * 0.5);
  if (l > 0.74) return fromHsl(26, 0.26 + d * 0.3, 0.2 + (l - 0.74) * 0.36);
  if (d > 0.2 && (h < 34 || h >= 320)) return fromHsl(356, s * 0.5, l * 0.48);
  if (d > 0.2 && h >= 62 && h < 185) return fromHsl(150, s * 0.4, l * 0.56);
  return fromHsl(h, s * 0.6, l * 0.62);
}
let remap = null;
const withTailor = (build) => (...args) => { remap = tailor; try { return build(...args); } finally { remap = null; } };

function mesh(v, scale, { shadow = true, receive = true, material } = {}) {
  if (remap && !material) for (const [k, c] of v.map) v.map.set(k, remap(c));
  const m = new THREE.Mesh(v.toGeometry({ scale, jitter: 0.03 }), material || voxelMaterial());
  m.castShadow = shadow; m.receiveShadow = receive;
  return m;
}

// =====================================================================
//                         TARIMA / PLATAFORMA GIRATORIA
// =====================================================================
/** Tarima redonda con lucecitas que titilan. kind: 'boutique' | 'garage'. Alto: userData.top */
export const buildPlatform = withTailor(function buildPlatform(kind = 'boutique') {
  const g = new THREE.Group();
  const R = kind === 'garage' ? 12.5 : 10.5;
  const v = new Voxels();
  const top = kind === 'garage' ? [0xfaf5ee, 0xf2e9dc] : [0xfdfaf6, 0xf9f3e9];
  const rim = kind === 'garage' ? 0x7f9ee8 : 0xf1a181;
  for (let x = -Math.ceil(R); x < Math.ceil(R); x++) for (let z = -Math.ceil(R); z < Math.ceil(R); z++) {
    const d = Math.hypot(x + 0.5, z + 0.5);
    if (d > R) continue;
    v.set(x, 0, z, 0xe8a93a);
    const edge = d > R - 1.3;
    let c;
    if (edge) c = rim;
    else if (kind === 'garage') c = (Math.floor(Math.atan2(z + 0.5, x + 0.5) / (Math.PI / 8)) & 1) ? top[0] : top[1];
    else c = d < 3 ? 0xfde9d8 : (Math.floor(d / 2.5) & 1) ? top[0] : top[1];
    v.set(x, 1, z, edge ? rim : 0xffffff);
    v.set(x, 2, z, c);
  }
  // estrellita/corazón al centro
  if (kind !== 'garage') for (const [x, z] of [[-1, 0], [0, 0], [-1, -1], [0, -1], [-2, 0], [1, 0], [-1, 1], [0, 1], [-2, 1], [1, 1], [-1, 2], [0, 2]]) v.set(x, 2, z - 1, 0xf1a181);
  g.add(mesh(v, F));
  // lucecitas: dos grupos que se alternan
  const bulbs = [new Voxels(), new Voxels()];
  const n = kind === 'garage' ? 22 : 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.round(Math.cos(a) * (R + 0.2) - 0.5), z = Math.round(Math.sin(a) * (R + 0.2) - 0.5);
    bulbs[i & 1].set(x, 1, z, i % 4 < 2 ? 0xfff0a8 : 0xfde7d3);
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
});

// =====================================================================
//                                BOUTIQUE
// =====================================================================
function floor(v, x0, x1, z0, z1, colFn) {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) v.set(x, -1, z, colFn(x, z));
}
function miniDress(v, x0, y0, z, c) {
  // percha
  v.set(x0, y0 + 9, z, 0xdad0c0); v.set(x0, y0 + 8, z, 0xdad0c0);
  for (let x = x0 - 2; x <= x0 + 2; x++) v.set(x, y0 + 7, z, 0xf2ece2);
  // vestidito
  const d = shade(c, -0.15), l = shade(c, 0.3);
  for (let y = 0; y <= 6; y++) {
    const w = y >= 5 ? 1 : y >= 3 ? 1 : 2 + (y < 1 ? 1 : 0);
    for (let x = x0 - w; x <= x0 + w; x++) for (let dz = 0; dz <= 1; dz++) v.set(x, y0 + y, z + dz, y === 0 ? l : y === 4 ? 0xffffff : ((x + y) & 1 ? c : d));
  }
}
export const buildBoutique = withTailor(function buildBoutique() {
  const g = new THREE.Group();
  // piso + pasarela
  const fv = new Voxels();
  floor(fv, -32, 31, -24, 20, (x, z) => {
    const run = x >= -6 && x <= 5 && z >= -2;
    if (run) return (x === -6 || x === 5) ? 0xffd166 : ((z >> 1) & 1 ? 0xf1a181 : 0xfbd7b7);
    return (((x >> 1) + (z >> 1)) & 1) ? 0xfde9d8 : 0xfdfaf6;
  });
  g.add(mesh(fv, E, { shadow: false }));

  // pared del fondo
  const w = new Voxels();
  for (let x = -32; x <= 31; x++) for (let y = 0; y <= 31; y++) for (let z = -26; z <= -25; z++) {
    let c;
    if (y <= 5) c = (x % 6 === 0 || y === 0) ? 0xf9f3e9 : 0xfffaf1;
    else if (y === 6) c = 0xf1a181;
    else if (y >= 30) c = 0xfffaf1;
    else {
      c = ((x + 64) >> 1) & 1 ? 0xfce2cc : 0xf8f0e3;
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
  for (const [x, y] of [[-1, 20], [0, 20], [-2, 21], [1, 21], [-1, 21], [0, 21], [-1, 22], [0, 22]]) w.set(x, y, -24, x === -1 && y === 22 ? 0xee8a5c : 0xffd166);
  // banderines
  for (let x = -30; x <= 29; x++) {
    const sag = Math.round(Math.abs(Math.sin((x + 30) / 60 * Math.PI * 2)) * -3);
    const y = 26 + sag;
    w.set(x, y, -24, 0xfff0c2);
    if ((x + 64) % 5 === 0) {
      const cols = [0xee8a5c, 0x7f9ee8, 0x6fe3c1, 0x8fd3ff, 0xffd166];
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
  [[0xee8a5c, rx0 + 4], [0x7f9ee8, rx0 + 9], [0x6fe3c1, rx0 + 14], [0x8fd3ff, rx0 + 18]].forEach(([c, x]) => miniDress(m, x, 12, rz - 1, c));
  // estante blanco con cajas y zapatos (derecha)
  const sx0 = 26, sx1 = 44, sz0 = -46, sz1 = -38;
  for (let x = sx0; x <= sx1; x++) for (let y = 0; y <= 26; y++) for (let z = sz0; z <= sz1; z++) {
    const side = x === sx0 || x === sx1, shelf = y === 0 || y === 9 || y === 18 || y === 26, backW = z === sz0;
    if (side || shelf || backW) m.set(x, y, z, shelf && z === sz1 ? 0xffd8c4 : 0xfffaf1);
  }
  // caja de sombrero, zapatitos, cartera, plantita
  m.cylinder(31, 10, -42, 3, 4, (x, y) => (y === 12 ? 0xffffff : 0xf1a181)); m.cylinder(31, 14, -42, 3.3, 1, 0xee8a5c);
  m.box(36, 10, -41, 2, 2, 3, 0x7f9ee8); m.box(39, 10, -41, 2, 2, 3, 0x7f9ee8); m.set(36, 12, -41, 0xffd166);
  m.box(29, 19, -42, 5, 4, 3, 0x6fe3c1); m.box(30, 23, -41, 3, 1, 1, 0x3cbf9a); m.set(31, 21, -39, 0xffd166);
  m.cylinder(39, 19, -42, 2, 3, 0xffb38a); m.sphere(39, 24, -42, 3, 3, 3, (x, y) => (y > 24 ? 0x8fdc7a : 0x5fc46a));
  m.set(38, 26, -40, 0xee8a5c); m.set(41, 24, -41, 0xffffff);
  m.box(29, 1, -42, 3, 3, 3, 0xffd166); m.box(35, 1, -43, 6, 5, 4, 0xee8a5c); m.box(35, 6, -43, 6, 1, 4, 0xffd8c4); m.set(37, 3, -39, 0xffffff); m.set(38, 3, -39, 0xffffff);
  // macetas con flores a los costados de la pasarela
  for (const x of [-16, 15]) {
    m.cylinder(x, 0, 12, 3, 4, 0xffffff); m.cylinder(x, 4, 12, 3.3, 1, 0xf1a181);
    m.sphere(x, 7.5, 12, 3.5, 3, 3.5, (X, Y, Z) => ((X + Y + Z) % 4 === 0 ? 0xee8a5c : (X * 3 + Z) % 7 === 0 ? 0xffffff : 0x6cc35d));
  }
  // puf redondo
  m.cylinder(-30, 0, 0, 4.5, 5, (x, y) => (y === 4 ? 0xdbe4fa : 0x7f9ee8));
  m.set(-30, 5, 0, 0xffd166);
  g.add(mesh(m, F));

  g.userData.update = () => {};
  return g;
});

// =====================================================================
//                    MUELLE DE AMARRE (ex taller del auto, plan §M5)
// =====================================================================
// Un muelle de tablas en el borde de la isla, de noche: postes con sogas, un farol, cajones y el cielo abierto atrás
// (anticipa el muelle de dirigibles del Acto 2). Paleta propia, ya oscura: no pasa por tailor.
export function buildDock() {
  const g = new THREE.Group();
  const W1 = 0x5a4430, W2 = 0x4c3926, W3 = 0x3e2e20, POST = 0x35281c, ROPE = 0x9a8460, IRON = 0x4a4e56, STONE = 0x3a3836, STONE2 = 0x312f2e;
  // piso: tablas del muelle que salen hacia el vacío y la roca de la isla atrás
  const fv = new Voxels();
  floor(fv, -32, 31, -24, 20, (x, z) => {
    if (z < -14) return ((x * 7 + z * 3) & 7) === 0 ? STONE2 : STONE;
    if (x < -14 || x > 13) return null;   // a los costados del muelle, el vacío
    const plank = (z + 99) % 3 === 0 ? W3 : ((x >> 2) + (z >> 1)) % 2 ? W1 : W2;
    return plank;
  });
  g.add(mesh(fv, E, { shadow: false }));
  // fondo: el cielo de la noche con nubes bajas y la silueta de otra isla
  const w = new Voxels();
  for (let x = -32; x <= 31; x++) for (let y = 0; y <= 31; y++) {
    const cloud = y < 8 && Math.sin(x * 0.35) * 2 + Math.sin(x * 0.13 + 1) * 2 + 4 > y;
    const isle = y >= 9 && y <= 13 && Math.abs(x - 14) < 9 - (13 - y) * 0.2 - (y - 9) * 1.6;
    const c = cloud ? (y > 5 ? 0x4a4f5c : 0x3d424e) : isle ? (y === 13 ? 0x3a4a3a : 0x2e2a2c) : y > 24 ? 0x141822 : y > 16 ? 0x1a1f2b : 0x222837;
    w.set(x, y, -25, c);
    if (!cloud && !isle && ((x * 13 + y * 7) % 37 === 0) && y > 14) w.set(x, y, -25, 0x8a90a0);   // estrellas
  }
  g.add(mesh(w, E, { shadow: false, receive: false }));
  // muebles finos: postes con soga, cornamusas, farol, cajones y un rollo de soga
  const m = new Voxels();
  for (const x of [-26, 24]) for (const z of [-20, 8]) {
    m.box(x - 1, 0, z - 1, 3, 16, 3, (xx, y) => (y === 15 ? W1 : y % 5 === 0 ? IRON : POST));
    m.box(x - 2, 12, z - 2, 5, 1, 5, ROPE);
  }
  for (const x of [-26, 24]) for (let z = -19; z < 8; z++) m.set(x, 11 - Math.round(Math.sin(((z + 19) / 27) * Math.PI) * 3), z, ROPE);   // sogas entre los postes
  // farol en un poste alto atrás a la derecha
  m.box(32, 0, -36, 3, 34, 3, POST); m.box(28, 33, -36, 6, 2, 2, POST);
  m.box(27, 25, -37, 4, 1, 4, IRON); m.box(27, 31, -37, 4, 1, 4, IRON);
  for (const [x, z] of [[27, -37], [30, -37], [27, -34], [30, -34]]) m.box(x, 26, z, 1, 5, 1, IRON);
  // cajones apilados atrás a la izquierda, con flejes
  m.box(-46, 0, -44, 12, 10, 10, (x, y) => (y === 9 ? W1 : y === 4 ? IRON : x % 4 === 0 ? W3 : W2));
  m.box(-44, 10, -42, 8, 8, 8, (x, y) => (y === 17 ? W1 : y === 13 ? IRON : x % 4 === 0 ? W3 : W2));
  // rollo de soga y un barril
  m.cylinder(-30, 0, 10, 4, 2, (x, y) => (y === 1 ? ROPE : 0x7e6a4a)); m.cylinder(-30, 2, 10, 2.5, 1, ROPE);
  m.cylinder(36, 0, 6, 4, 10, (x, y) => (y === 2 || y === 7 ? IRON : y === 9 ? W1 : W2));
  g.add(mesh(m, F));
  // el vidrio del farol brilla
  const lv = new Voxels(); lv.box(28, 26, -36, 2, 5, 2, (x, y) => (y >= 28 ? 0xe8b866 : 0xd08a3a));
  g.add(mesh(lv, F, { shadow: false, material: glowMaterial() }));
  g.userData.update = () => {};
  return g;
}
/** Compatibilidad: el escenario del esquife (antes, el taller del auto). */
export const buildGarage = buildDock;

// =====================================================================
//                   MINIATURAS OFFSCREEN (cacheadas como dataURL)
// =====================================================================
const thumbCache = new Map();
const MAX_THUMBS = 260;
const THUMB_PX = 192;
let tr = null; // { renderer, scene, camera }

function ensureThumbRenderer() {
  if (tr) return tr;
  // se muestran a 64 px CSS: 3× con antialias para que se vean nítidas en retina
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setSize(THUMB_PX, THUMB_PX, false);
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
 *  { type:'avatar' (o 'princess'), look, frame:'head'|'tall'|'bust'|'body'|'tallbody'|'back', cls?, raw? }
 *  { type:'car', car, frame:'car'|'wheel' (el aparejo), driver? } (el esquife: el id 'car' quedó del auto)
 */
export function thumbnail(spec) {
  const key = JSON.stringify(spec);
  if (!spec.raw && thumbCache.has(key)) return thumbCache.get(key);
  const { renderer, scene, camera } = ensureThumbRenderer();
  let obj, fr = FRAMES[spec.frame] || FRAMES.body;
  if (spec.type === 'princess' || spec.type === 'avatar') {
    obj = avatarModel(spec.look, spec.cls ? { cls: spec.cls } : {});
    // el encuadre sigue a la cabeza y al alto reales de cada pueblo (un enano no mide lo mismo que un orco)
    const hp = new THREE.Vector3();
    obj.updateMatrixWorld(true);
    obj.userData.parts?.head?.getWorldPosition(hp);
    const h = obj.userData.height || 1, hy = hp.y || h * 0.75;
    const AV = { head: [hy + 0.13, 0.5], tall: [hy + 0.2, 0.68], bust: [Math.max(hy + 0.07, h - 0.24), 0.58], body: [h * 0.5, h * 1.22], tallbody: [h * 0.52, h * 1.3], back: [h * 0.55, h * 1.25] };
    const a = AV[spec.frame] || AV.body;
    fr = { ...fr, y: a[0], view: a[1], ang: spec.frame === 'back' ? 2.55 : spec.frame === 'bust' ? 0.3 : 0.45, elev: spec.frame === 'bust' ? 0.08 : 0.18 };
  }
  else if (spec.frame === 'wheel') {   // el aparejo del esquife (vela o globo) solo, encuadrado a su caja
    const c = carModel(spec.car);
    const w = c.userData.sail;
    obj = new THREE.Mesh(w.geometry, w.material);
    fr = { ...fr, ang: 0.9, elev: 0.25, fit: true };
  } else {
    obj = carModel(spec.car, { driver: spec.driver || null });
    const s = obj.userData.size;
    fr = { ...fr, y: s.h * 0.42, fit: true };
  }
  scene.add(obj);
  const target = new THREE.Vector3(0, fr.y, 0);
  camera.position.set(Math.sin(fr.ang) * 10 * Math.cos(fr.elev), fr.y + Math.sin(fr.elev) * 10, Math.cos(fr.ang) * 10 * Math.cos(fr.elev));
  camera.lookAt(target);
  if (fr.fit) fitOrtho(camera, obj, 0.1); // esquife: encuadre según la caja real (el globo y los palos no se cortan)
  else { camera.left = -fr.view / 2; camera.right = fr.view / 2; camera.top = fr.view / 2; camera.bottom = -fr.view / 2; }
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const cv = outlineCanvas(renderer.domElement, 3);
  scene.remove(obj);
  if (spec.raw) return cv;   // spec.raw: devuelve el canvas (los retratos lo dibujan al toque, sin esperar una imagen)
  const url = cv.toDataURL('image/png');
  thumbCache.set(key, url);
  if (thumbCache.size > MAX_THUMBS) thumbCache.delete(thumbCache.keys().next().value);
  return url;
}
export const hasThumb = (spec) => thumbCache.has(JSON.stringify(spec));
