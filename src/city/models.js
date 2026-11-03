// Modelos vóxel de Pixelia: edificios, obras, naturaleza, nubes y miniaturas.
// API (ver DESIGN.md):
//   buildingModel(id, level, opts) -> THREE.Group   (origen centro del footprint, base y=0, frente +Z)
//   constructionModel(w, d) / natureModel(kind, seed) / cloudModel(seed) / thumbnail(id, level)
// Las geometrías se construyen una sola vez por id+nivel y se reusan en cada Group nuevo.
import * as THREE from 'three';
import { voxelMaterial, glowMaterial, addLights, setIsoCamera, Voxels, shade } from '../core/voxel.js';
import { BUILDING_BY_ID, OUTFIT_COLORS } from '../core/data.js';
import { Model, P, C, rng, pick, bush, cone, flower, FLOWER_COLORS } from './models-kit.js';
import { SPECIAL_BUILDERS } from './models-special.js';
import { HOUSE_BUILDERS } from './models-houses.js';
import { SHOP_BUILDERS } from './models-shops.js';
import { DECO_BUILDERS } from './models-deco.js';

export const VOXELS_PER_TILE = 8;
const S = 1 / VOXELS_PER_TILE;
const BUILDERS = { ...SPECIAL_BUILDERS, ...HOUSE_BUILDERS, ...SHOP_BUILDERS, ...DECO_BUILDERS };

// ---------- Materiales ----------
let _light = null, _ghost = null;
function lightMaterial() { return _light || (_light = new THREE.MeshBasicMaterial({ vertexColors: true })); }
function ghostMaterial() {
  return _ghost || (_ghost = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false }));
}
function matFor(kind, opts) {
  if (opts.ghost) return ghostMaterial();
  if (kind === 'light') return lightMaterial();
  if (kind === 'glow') return glowMaterial();
  return voxelMaterial();
}

// ---------- Compilación y caché ----------
function compile(model) {
  const ox = model.W / 2, oz = model.D / 2;
  const parts = [];
  let maxY = 0;
  const add = (v, name, pivot, mat, cast) => {
    if (!v.size) return;
    const b = v.bounds();
    maxY = Math.max(maxY, b.max[1]);
    const g = v.toGeometry({ scale: S });
    const px = pivot ? pivot[0] : ox, py = pivot ? pivot[1] : 0, pz = pivot ? pivot[2] : oz;
    g.translate(-px * S, -py * S, -pz * S);
    g.computeBoundingSphere(); g.computeBoundingBox();
    parts.push({ geo: g, name, mat, cast, pos: new THREE.Vector3((px - ox) * S, py * S, (pz - oz) * S) });
  };
  add(model.v, null, null, 'std', true);
  add(model.glow, null, null, 'glow', true);
  add(model.light, null, null, 'light', false);
  for (const p of model.parts) add(p.v, p.name, p.pivot, p.mat, p.cast);
  return { parts, anims: model.anims, height: (model.height ?? maxY) * S, size: [model.W * S, model.D * S] };
}

function instantiate(tpl, opts = {}, extra = {}) {
  const g = new THREE.Group();
  const named = {};
  for (const p of tpl.parts) {
    const m = new THREE.Mesh(p.geo, matFor(p.mat, opts));
    m.position.copy(p.pos);
    m.castShadow = opts.ghost ? false : p.cast;
    m.receiveShadow = !opts.ghost;
    // las partes sin nombre no se animan: la ciudad puede dibujarlas instanciadas (pocas llamadas de dibujo)
    m.userData.static = !p.name;
    if (p.name) (named[p.name] || (named[p.name] = [])).push(m);
    g.add(m);
  }
  g.userData.height = tpl.height;
  Object.assign(g.userData, extra);
  if (tpl.anims.length) {
    const phase = (instanceCounter++ * 2.399) % 12;
    const fns = tpl.anims.map(fn => fn(named, phase)).filter(Boolean);
    g.userData.update = fns.length === 1 ? fns[0] : (dt, t) => { for (const f of fns) f(dt, t); };
  }
  return g;
}
let instanceCounter = 0;

const tplCache = new Map();
function flagHex(c) {
  if (!c) return P.pink;
  if (typeof c === 'number') return c;
  if (c[0] === '#') return c;
  return OUTFIT_COLORS.find(o => o.id === c)?.hex || P.pink;
}

function buildTemplate(id, level, opts) {
  const def = BUILDING_BY_ID[id];
  const W = (def ? def.size[0] : 1) * VOXELS_PER_TILE, D = (def ? def.size[1] : 1) * VOXELS_PER_TILE;
  const m = new Model(W, D);
  const fn = BUILDERS[id];
  if (fn) fn(m, level, opts);
  else { // id desconocido: cajita neutra (no debería pasar)
    m.v.box(1, 0, 1, W - 2, 6, D - 2, P.pinkL);
    m.v.box(1, 6, 1, W - 2, 1, D - 2, P.pink);
  }
  const tpl = compile(m);
  // caminos: baldosa de 1 vóxel, su sombra no se ve y cuesta una pasada extra por baldosa
  if (def?.cat === 'camino') for (const p of tpl.parts) p.cast = false;
  return tpl;
}

/** Modelo de un edificio del catálogo. opts: { flagColor (id de OUTFIT_COLORS o hex), ghost } */
export function buildingModel(id, level = 1, opts = {}) {
  const lv = Math.max(1, Math.min(5, Math.round(level) || 1));
  const def = BUILDING_BY_ID[id];
  const flag = id === 'castillo' ? flagHex(opts.flagColor) : null;
  const key = id + '|' + lv + (flag ? '|' + flag : '');
  let tpl = tplCache.get(key);
  if (!tpl) { tpl = buildTemplate(id, lv, { flag }); tplCache.set(key, tpl); }
  const g = instantiate(tpl, opts, { id, level: lv, size: def ? def.size.slice() : [1, 1] });
  g.name = 'building:' + id;
  return g;
}

// ---------- Obra en construcción ----------
const consCache = new Map();
export function constructionModel(w = 2, d = 2) {
  w = Math.max(1, w | 0); d = Math.max(1, d | 0);
  const key = w + 'x' + d;
  let tpl = consCache.get(key);
  if (!tpl) {
    const W = w * 8, D = d * 8;
    const m = new Model(W, D);
    const v = m.v;
    // terreno de obra
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) v.set(x, 0, z, (x * 7 + z * 3) % 5 === 0 ? shade(P.dirt, -0.1) : (x + z) % 2 ? P.dirt : shade(P.dirt, 0.05));
    const H = Math.min(16, 6 + Math.max(w, d) * 3);
    const x0 = 1, x1 = W - 2, z0 = 1, z1 = D - 2;
    // paredes a medio construir (altura irregular, ladrillo rosado)
    const bw = (x, y, z) => ((y + Math.floor((x + z) / 2)) % 2 ? P.pinkL : '#f7b3d0');
    for (let x = x0 + 2; x <= x1 - 2; x++) for (let z = z0 + 2; z <= z1 - 2; z++) {
      const edge = x === x0 + 2 || x === x1 - 2 || z === z0 + 2 || z === z1 - 2;
      if (!edge) continue;
      const h = 1 + Math.max(1, Math.floor(H / 2.4 - ((x * 3 + z * 5) % 4)));
      for (let y = 1; y <= h; y++) v.set(x, y, z, bw(x, y, z));
    }
    // andamio sólo al frente y a la derecha (se ve la obra adentro)
    const step = Math.max(3, Math.min(5, Math.floor((x1 - x0) / 2)));
    const polesF = [], polesR = [];
    for (let x = x0; x <= x1; x += step) polesF.push(x);
    if (polesF[polesF.length - 1] !== x1) polesF.push(x1);
    for (let z = z0; z <= z1; z += step) polesR.push(z);
    if (polesR[polesR.length - 1] !== z1) polesR.push(z1);
    for (const x of polesF) v.box(x, 1, z1, 1, H, 1, P.wood);
    for (const z of polesR) v.box(x1, 1, z, 1, H, 1, P.wood);
    for (let y = 5; y < H; y += 5) {
      for (let x = x0; x <= x1; x++) { v.set(x, y, z1, P.gold); v.set(x, y, z1 - 1, P.goldD); }
      for (let z = z0; z <= z1; z++) { v.set(x1, y, z, P.gold); v.set(x1 - 1, y, z, P.goldD); }
    }
    // escalerita
    for (let y = 1; y < Math.min(H, 10); y++) if (y % 2) v.set(x0 + 1, y, z1 + 1 > D - 1 ? z1 : z1, P.woodD);
    // cinta rayada rosa/blanca alrededor, con postes dorados
    for (let x = 0; x < W; x++) { v.set(x, 2, D - 1, Math.floor(x / 2) % 2 ? '#ffffff' : P.pink); v.set(x, 2, 0, Math.floor(x / 2) % 2 ? '#ffffff' : P.pink); }
    for (let z = 0; z < D; z++) { v.set(0, 2, z, Math.floor(z / 2) % 2 ? '#ffffff' : P.pink); v.set(W - 1, 2, z, Math.floor(z / 2) % 2 ? '#ffffff' : P.pink); }
    for (const [x, z] of [[0, D - 1], [W - 1, D - 1], [0, 0], [W - 1, 0]]) { v.box(x, 1, z, 1, 2, 1, P.gold); v.set(x, 3, z, P.goldL); }
    // pila de ladrillos, caja de herramientas y conito
    if (W >= 16) { v.box(W - 6, 1, D - 5, 3, 2, 2, P.wood); v.box(W - 6, 3, D - 5, 3, 1, 2, P.woodD); v.set(W - 5, 3, D - 4, P.gold); }
    v.box(3, 1, D - 4, 2, 1, 2, P.coral); v.set(3, 2, D - 4, P.coral); v.set(4, 2, D - 3, shade(P.coral, -0.1));
    v.set(W - 2, 1, D - 3, C.orange); v.set(W - 2, 2, D - 3, '#ffffff'); v.set(W - 2, 3, D - 3, C.orange);
    // grúa amarilla con brazo que gira
    const cx = x0 + 1, cz = z0 + 1;
    const CH = H + 3;
    v.box(cx, 1, cz, 1, CH, 1, (x, y) => (y % 2 ? C.yellow : P.goldD));
    v.box(cx - 1, 1, cz - 1, 3, 1, 3, P.stoneD);
    const arm = m.part('crane', [cx + 0.5, CH, cz + 0.5]);
    const L = Math.max(4, Math.min(W - 4, 11));
    for (let i = -2; i <= L; i++) arm.set(cx + i, CH, cz, i % 2 ? C.yellow : P.goldD);
    arm.set(cx, CH + 1, cz, C.yellow); arm.set(cx, CH + 2, cz, P.pink);
    arm.box(cx - 3, CH - 1, cz, 2, 2, 1, P.stoneD); // contrapeso
    arm.box(cx + L - 1, CH - 4, cz, 1, 4, 1, P.inkL); // cable
    arm.set(cx + L - 1, CH - 5, cz, P.gold); // gancho
    arm.box(cx + L - 2, CH - 7, cz - 1, 3, 2, 3, (x, y, z) => ((x + y + z) % 2 ? P.pink : P.pinkL)); // ladrillos colgando
    m.animate((parts, ph) => {
      const a = parts.crane[0];
      return (dt, t) => { a.rotation.y = Math.sin((t + ph) * 0.6) * 0.9 - 0.6; };
    });
    tpl = compile(m);
    consCache.set(key, tpl);
  }
  const g = instantiate(tpl, {});
  g.name = 'construction';
  return g;
}

// ---------- Naturaleza fuera del terreno ----------
const natCache = new Map();
const NAT_VARIANTS = 6;
export function natureModel(kind = 'tree', seed = 0) {
  const s = Math.abs(Math.floor(seed)) % NAT_VARIANTS;
  const key = kind + '|' + s;
  let tpl = natCache.get(key);
  if (!tpl) {
    const m = new Model(8, 8);
    const v = m.v, r = rng(s * 31 + kind.length * 7 + 1);
    switch (kind) {
      case 'pine': {
        const h = 2 + Math.floor(r() * 2);
        v.box(3, 0, 3, 2, h, 2, C.trunkD);
        const layers = 4 + Math.floor(r() * 2);
        let y = h;
        for (let i = 0; i < layers; i++) {
          const rad = 3.6 - i * 0.7;
          const col = i % 2 ? '#3fae6a' : '#52c27a';
          v.cylinder(3.5, y, 3.5, rad, 2, (x, yy, z) => (yy === y + 1 && (x + z) % 3 === 0 ? shade(col, 0.15) : col));
          y += 2;
        }
        v.set(3, y, 3, '#52c27a'); v.set(4, y, 4, '#52c27a');
        if (r() < 0.5) { v.set(3, y + 1, 3, '#ffffff'); }
        break;
      }
      case 'bush': {
        bush(v, 3.5, 0, 3.5, 2.6 + r() * 0.6, pick(r, [C.leaf, '#6dcf74', C.leafD]), r() < 0.6 ? pick(r, [[P.pink, '#ffffff'], [C.yellow], [P.lilac, P.pinkL]]) : null, s + 11);
        break;
      }
      case 'rock': {
        const col = pick(r, [P.stone, '#cfc8de', '#e2dcef']);
        v.sphere(3.5, 1, 3.5, 2.6 + r(), 1.8 + r() * 0.6, 2.2 + r() * 0.5, (x, y, z) => (y >= 2 ? shade(col, 0.1) : (x + z + y) % 4 === 0 ? shade(col, -0.12) : col));
        v.clear(0, -3, 0, 8, 3, 8);
        if (r() < 0.6) { v.set(1, 0, 6, C.leaf); v.set(6, 0, 1, C.leaf); v.set(6, 1, 1, P.pink); }
        break;
      }
      case 'flowers': {
        for (let i = 0; i < 18; i++) {
          const x = 1 + Math.floor(r() * 6), z = 1 + Math.floor(r() * 6);
          v.set(x, 0, z, C.leaf);
          flower(v, x, 1, z, pick(r, FLOWER_COLORS), r() < 0.5 ? 1 : 0);
        }
        break;
      }
      case 'mushroom': {
        const cap = pick(r, [P.coral, P.pink, P.lilac]);
        const mk = (x, z, h, rad) => {
          v.box(x, 0, z, 1, h, 1, P.cream);
          v.sphere(x, h + 0.2, z, rad, 1.2, rad, (xx, y, zz) => (y >= h + 1 && (xx + zz) % 2 === 0 ? '#ffffff' : cap));
          v.clear(x - 3, h - 2, z - 3, 7, 2, 7); v.box(x, 0, z, 1, h, 1, P.cream);
        };
        mk(3, 3, 3, 2.2); mk(6, 5, 2, 1.4);
        v.set(1, 0, 6, C.leaf); v.set(2, 0, 6, C.leaf);
        break;
      }
      default: { // tree
        const h = 2 + Math.floor(r() * 2);
        v.box(3, 0, 3, 2, h + 1, 2, C.trunk);
        v.set(5, 1, 3, C.trunk);
        const leaf = pick(r, [C.leaf, '#6dcf74', '#58bf73']);
        const fruit = r() < 0.4 ? [P.pink, C.red] : r() < 0.5 ? ['#ffffff', P.pinkL] : null;
        bush(v, 3.5, h, 3.5, 3.1 + r() * 0.5, leaf, fruit, s + 3);
        if (r() < 0.5) bush(v, 2, h + 3, 4.5, 1.8, shade(leaf, 0.08), null, s + 9);
      }
    }
    tpl = compile(m);
    natCache.set(key, tpl);
  }
  const g = instantiate(tpl, {});
  g.name = 'nature:' + kind;
  return g;
}

// ---------- Nubes ----------
const cloudCache = new Map();
export function cloudModel(seed = 0) {
  const s = Math.abs(Math.floor(seed)) % 5;
  let geo = cloudCache.get(s);
  if (!geo) {
    const r = rng(s * 13 + 5);
    const v = new Voxels();
    const n = 3 + Math.floor(r() * 3);
    let x = 0;
    for (let i = 0; i < n; i++) {
      const rad = 1.8 + r() * 1.8;
      v.sphere(x, rad * 0.6, (r() - 0.5) * 2, rad, rad * 0.75, rad * 0.9, (xx, y) => (y <= 0 ? '#e6ecff' : y >= rad ? '#ffffff' : '#f7f9ff'));
      x += rad * 1.1 + r();
    }
    v.clear(-10, -10, -10, 40, 10, 30);
    geo = v.toGeometry({ scale: 1 / 4, center: 'xyz', jitter: 0.015 });
    cloudCache.set(s, geo);
  }
  const m = new THREE.Mesh(geo, voxelMaterial());
  m.castShadow = false; m.receiveShadow = false;
  const g = new THREE.Group();
  g.add(m);
  g.name = 'cloud';
  return g;
}

// ---------- Miniaturas (un solo renderer WebGL para todas) ----------
const THUMB = 96;
const thumbCache = new Map();
let thumbQueue = Promise.resolve();
let T = null;
function thumbRig() {
  if (T) return T;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = THUMB;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.setSize(THUMB, THUMB, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const { sun } = addLights(scene, { shadowSize: 8, shadowRes: 512 });
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const out = document.createElement('canvas');
  out.width = out.height = THUMB;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); }, false);
  T = { renderer, scene, camera, sun, canvas, out, ctx: out.getContext('2d', { willReadFrequently: true }) };
  return T;
}
const _box = new THREE.Box3(), _v = new THREE.Vector3();
function renderThumb(id, level) {
  const t = thumbRig();
  const g = buildingModel(id, level);
  g.userData.update?.(0, 0.8);
  t.scene.add(g);
  g.updateMatrixWorld(true);
  _box.setFromObject(g);
  const center = _box.getCenter(new THREE.Vector3());
  setIsoCamera(t.camera, center, Math.PI / 4, 40, 0.62);
  t.camera.updateMatrixWorld(true);
  const inv = t.camera.matrixWorldInverse;
  let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
  for (let i = 0; i < 8; i++) {
    _v.set(i & 1 ? _box.max.x : _box.min.x, i & 2 ? _box.max.y : _box.min.y, i & 4 ? _box.max.z : _box.min.z).applyMatrix4(inv);
    mnx = Math.min(mnx, _v.x); mxx = Math.max(mxx, _v.x); mny = Math.min(mny, _v.y); mxy = Math.max(mxy, _v.y);
  }
  const half = Math.max(mxx - mnx, mxy - mny) / 2 * 1.06 + 0.02;
  const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
  Object.assign(t.camera, { left: cx - half, right: cx + half, top: cy + half, bottom: cy - half });
  t.camera.updateProjectionMatrix();
  const span = Math.max(_box.max.x - _box.min.x, _box.max.z - _box.min.z, _box.max.y - _box.min.y) + 2;
  t.sun.position.set(center.x + 12, center.y + 22, center.z + 8);
  t.sun.target.position.copy(center);
  t.sun.target.updateMatrixWorld();
  const sc = t.sun.shadow.camera;
  Object.assign(sc, { left: -span, right: span, top: span, bottom: -span });
  sc.updateProjectionMatrix();
  t.renderer.render(t.scene, t.camera);
  // contorno tinta de 1px alrededor de la silueta (combina con la UI)
  const ctx = t.ctx;
  ctx.clearRect(0, 0, THUMB, THUMB);
  ctx.drawImage(t.canvas, 0, 0);
  const img = ctx.getImageData(0, 0, THUMB, THUMB), d = img.data;
  const a = new Uint8Array(THUMB * THUMB);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] > 40 ? 1 : 0;
  for (let y = 0; y < THUMB; y++) for (let x = 0; x < THUMB; x++) {
    const i = y * THUMB + x;
    if (a[i]) continue;
    if ((x > 0 && a[i - 1]) || (x < THUMB - 1 && a[i + 1]) || (y > 0 && a[i - THUMB]) || (y < THUMB - 1 && a[i + THUMB])) {
      d[i * 4] = 0x3b; d[i * 4 + 1] = 0x23; d[i * 4 + 2] = 0x40; d[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  t.scene.remove(g);
  return t.out.toDataURL('image/png');
}
function fallbackThumb(id) {
  const cv = document.createElement('canvas'); cv.width = cv.height = THUMB;
  const g = cv.getContext('2d');
  g.fillStyle = BUILDING_BY_ID[id]?.cat === 'camino' ? '#d8d2e6' : '#ff7eb6';
  g.fillRect(20, 30, 56, 46); g.fillStyle = '#3b2340'; g.fillRect(20, 26, 56, 4);
  return cv.toDataURL();
}
/** Ícono 96x96 del edificio (dataURL), cacheado. */
export function thumbnail(id, level = 1) {
  const lv = Math.max(1, Math.min(5, Math.round(level) || 1));
  const k = id + '|' + lv;
  let p = thumbCache.get(k);
  if (p) return p;
  p = thumbQueue = thumbQueue.then(() => new Promise(res => {
    // cederle el hilo al juego entre miniaturas
    const run = () => { try { res(renderThumb(id, lv)); } catch (e) { console.warn('miniatura', id, e); res(fallbackThumb(id)); } };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 120 }); else setTimeout(run, 0);
  }));
  thumbCache.set(k, p);
  return p;
}
