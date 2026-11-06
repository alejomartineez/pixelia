// Mundo de la ciudad: isla flotante, pasto pixelado, naturaleza fuera del terreno,
// carteles de expansión, islotes, nubes y grilla de colocación.
import * as THREE from 'three';
import { Voxels, voxelMaterial } from '../core/voxel.js';
import { natureModel, cloudModel } from '../city/models.js';
import { themeOf, themeHex } from '../city/themes.js';
import { MAP, HALF, hash2, mulberry, rgb, mergeStatic, disposeGeometries } from './city-common.js';

const PAD = 3;                    // tiles de borde de isla alrededor del mapa
const PX = 8;                     // pixeles de textura por tile
const S = (MAP + PAD * 2) * PX;   // lado del canvas del suelo
const VS = 0.25;                  // tamaño de vóxel de los acantilados
const NC = (MAP + PAD * 2) / VS;  // columnas por lado
const OFF = -HALF - PAD;          // coordenada de mundo del borde de la isla

// Colores del pasto (según el tema de la ciudad)
function groundColors(T) {
  const g = T.ground, C = {};
  for (const k of Object.keys(g)) C[k] = k === 'flowers' ? g.flowers.map(rgb) : rgb(g[k]);
  return C;
}

const DIRS = [
  { d: [1, 0], n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { d: [-1, 0], n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { d: [0, 1], n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { d: [0, -1], n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

// ---------- Forma de la isla (por columna de 1/4 de tile) ----------
function buildShape() {
  const inIsland = new Uint8Array(NC * NC);
  const depth = new Uint8Array(NC * NC);
  for (let i = 0; i < NC; i++) for (let k = 0; k < NC; k++) {
    const u = OFF + (i + 0.5) * VS, w = OFF + (k + 0.5) * VS;
    const ax = Math.abs(u), aw = Math.abs(w);
    const dx = Math.max(0, ax - HALF), dz = Math.max(0, aw - HALF);
    const e = Math.hypot(dx, dz);
    const ang = Math.atan2(w, u);
    const margin = 1.75 + 0.5 * Math.sin(ang * 3 + 1.3) + 0.3 * Math.sin(ang * 8 + 0.4) + 0.45 * (hash2(i >> 2, k >> 2, 11) - 0.5);
    if (e > margin) continue;
    const idx = i * NC + k;
    inIsland[idx] = 1;
    const edgeDist = e > 0 ? margin - e : margin + (HALF - Math.max(ax, aw));
    if (edgeDist > 1.4) depth[idx] = 22;
    else {
      const h = hash2(i, k, 7);
      let d = 9 + Math.floor(hash2(i >> 1, k >> 1, 5) * 5) + (h < 0.08 ? 4 + Math.floor(h * 90) : 0);
      d += Math.round(Math.sin(i * 0.37) * 1.5 + Math.cos(k * 0.29) * 1.5);
      depth[idx] = Math.max(6, Math.min(22, d));
    }
  }
  return { inIsland, depth };
}

function layerColor(L, i, k, cl) {
  const wave = Math.round(Math.sin(i * 0.31) * 1.2 + Math.sin(k * 0.27) * 1.1);
  const h = hash2(i, k, L + 31);
  if (L === 0) return cl.top;
  if (L === 1) return h < 0.55 ? cl.grass : cl.dirt;
  const band = L + wave, B = cl.bands;
  if (band < 5) return B[0][band & 1];
  if (band < 9) return B[1][band & 1];
  if (band < 13) return B[2][band & 1];
  if (h < 0.025) return h < 0.012 ? cl.gems[0] : cl.gems[1];
  if (band < 17) return B[3][band & 1];
  return B[4][band & 1];
}

function buildCliffs(shape, cl) {
  const { inIsland, depth } = shape;
  const pos = [], nor = [], col = [], idx = [];
  const tmp = new THREE.Color();
  const D = (i, k) => (i < 0 || k < 0 || i >= NC || k >= NC || !inIsland[i * NC + k]) ? 0 : depth[i * NC + k];
  for (let i = 0; i < NC; i++) for (let k = 0; k < NC; k++) {
    const d = D(i, k);
    if (!d) continue;
    for (const dir of DIRS) {
      const dn = D(i + dir.d[0], k + dir.d[1]);
      for (let L = dn; L < d; L++) {
        const hj = hash2(i * 3 + dir.d[0], k * 3 + dir.d[1], L);
        tmp.set(layerColor(L, i, k, cl));
        const j = (hj - 0.5) * 0.07;
        tmp.r = Math.max(0, tmp.r * (1 + j)); tmp.g = Math.max(0, tmp.g * (1 + j)); tmp.b = Math.max(0, tmp.b * (1 + j));
        const base = pos.length / 3;
        for (const c of dir.c) {
          pos.push(OFF + (i + c[0]) * VS, -(L + 1 - c[1]) * VS, OFF + (k + c[2]) * VS);
          nor.push(...dir.n);
          col.push(tmp.r, tmp.g, tmp.b);
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    // fondo de la columna (se ve desde abajo en vistas muy alejadas; barato)
    const base = pos.length / 3;
    const y = -d * VS;
    tmp.set(layerColor(30, i, k, cl));
    for (const c of [[0, 0], [1, 0], [1, 1], [0, 1]]) { pos.push(OFF + (i + c[0]) * VS, y, OFF + (k + c[1]) * VS); nor.push(0, -1, 0); col.push(tmp.r, tmp.g, tmp.b); }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, voxelMaterial());
  m.position.y = -0.01;
  m.receiveShadow = true;
  m.castShadow = false;
  return m;
}

// ---------- Cartel "¡Expandir!" ----------
function signModel(th) {
  const v = new Voxels();
  const [wood, woodD, pink, pinkD, gold, white] = ['#b07a52', '#8a5a3a', '#ee8a5c', '#c8673d', '#ffd166', '#ffffff'].map(c => themeHex(th, c));
  v.box(7, 0, 7, 2, 9, 2, wood);
  v.box(6, 0, 6, 4, 1, 4, woodD);
  // tablero (doble cara)
  v.box(1, 7, 7, 14, 9, 2, (x, y) => (x === 1 || x === 14 || y === 7 || y === 15) ? gold : pink);
  // signo + en ambas caras
  for (const z of [6, 9]) {
    v.box(7, 9, z, 2, 6, 1, white);
    v.box(5, 11, z, 6, 2, 1, white);
  }
  v.box(2, 16, 7, 12, 1, 2, pinkD);
  const g = new THREE.Group();
  g.add(v.toMesh({ scale: 1 / 16, center: 'xz' }));
  return g;
}

// ---------- Islotes flotantes ----------
function isletModel(seed, T) {
  const r = mulberry(seed * 977 + 13);
  const v = new Voxels();
  const R = 6 + Math.floor(r() * 4);
  const cl = T.cliff, top = cl.isletTop, B = cl.bands;
  const strata = [B[0][0], B[0][1], B[1][0], B[2][1], B[3][0], B[4][0]];
  for (let j = 0; j < R + 4; j++) {
    const rr = j === 0 ? R : Math.max(0.6, R - j * 0.75 + (r() - 0.5));
    const y = -j;
    v.cylinder(0, y, 0, rr, 1, (x, yy, z) => j === 0 ? (hash2(x, z, seed) < 0.06 ? T.ground.flowers[1] : top) : j === 1 ? (hash2(x, z, 3) < 0.5 ? cl.top : strata[0]) : strata[Math.min(strata.length - 1, Math.floor(j / 2))]);
  }
  const g = new THREE.Group();
  const m = v.toMesh({ scale: 1 / 8 });
  m.position.y = -1 / 8;
  g.add(m);
  g.userData.own = m.geometry;
  const kinds = T.nature.map(k => k[0]).filter(k => k !== 'rock').slice(0, 5);
  const n = 1 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const nat = natureModel(kinds[Math.floor(r() * kinds.length)], seed * 10 + i, T.id);
    nat.position.set((r() - 0.5) * R / 8, 0, (r() - 0.5) * R / 8);
    g.add(nat);
  }
  return g;
}

/**
 * Crea el mundo. hooks: { onPoof(x,z) } para partículas cuando desaparece naturaleza.
 * theme: id de tema de la ciudad (city/themes.js).
 */
export function createWorld(r, { bounds, hooks = {}, theme }) {
  const T = themeOf(theme);
  const C = groundColors(T);
  const group = new THREE.Group();
  group.name = 'world';
  r.scene.add(group);
  const shape = buildShape();
  const islandPx = (px, py) => shape.inIsland[(px >> 1) * NC + (py >> 1)];

  // ----- Textura del suelo -----
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g2 = cv.getContext('2d');
  const img = g2.createImageData(S, S);
  const noise = new Int8Array(S * S);
  const deco = new Uint8Array(S * S);
  const rnd = mulberry(4242);
  for (let i = 0; i < S * S; i++) {
    // ruido suave: con pixeles de render chicos, el ruido fuerte se ve como estática
    noise[i] = Math.round((rnd() - 0.5) * 4);
    const q = rnd();
    deco[i] = q < 0.022 ? 1 : q < 0.032 ? 2 : q < 0.0352 ? 3 + Math.floor(rnd() * 5) : 0;
  }
  let land = { ...bounds };
  const inLand = (tx, tz, b = land) => tx >= b.min && tx < b.max && tz >= b.min && tz < b.max;
  const tileState = new Uint8Array((MAP + PAD * 2) ** 2); // 1 = adentro del terreno (para animación)

  function paintPixel(px, py) {
    const o = (py * S + px) * 4;
    const D = img.data;
    if (!islandPx(px, py)) { D[o + 3] = 0; return; }
    const tx = Math.floor(px / PX) - PAD, tz = Math.floor(py / PX) - PAD;
    const T = (tx + PAD) * (MAP + PAD * 2) + (tz + PAD);
    const inside = tileState[T] === 1;
    const lx = px % PX, ly = py % PX;
    const checker = (tx + tz) & 1;
    let c = inside ? (checker ? C.inA : C.inB) : (checker ? C.outA : C.outB);
    const dd = deco[py * S + px];
    if (dd === 1) c = inside ? C.tuftIn : C.tuftOut;
    else if (dd === 2) c = inside ? C.lightIn : C.lightOut;
    else if (dd >= 3 && (!inside || dd <= 4)) c = C.flowers[dd - 3];
    let add = noise[py * S + px] + Math.round((hash2(tx, tz, 3) - 0.5) * 3);
    // bordes del terreno
    if (inside) {
      if ((lx === 0 && !isIn(tx - 1, tz)) || (lx === PX - 1 && !isIn(tx + 1, tz)) || (ly === 0 && !isIn(tx, tz - 1)) || (ly === PX - 1 && !isIn(tx, tz + 1))) { c = C.rim; add = 0; }
    } else if ((lx === PX - 1 && isIn(tx + 1, tz)) || (lx === 0 && isIn(tx - 1, tz)) || (ly === PX - 1 && isIn(tx, tz + 1)) || (ly === 0 && isIn(tx, tz - 1))) { c = C.shadowOut; add = 0; }
    // labio del borde de la isla
    if (!inside && ((px > 0 && !islandPx(px - 1, py)) || (px < S - 1 && !islandPx(px + 1, py)) || (py > 0 && !islandPx(px, py - 1)) || (py < S - 1 && !islandPx(px, py + 1)))) { c = C.lip; add = 0; }
    D[o] = Math.max(0, Math.min(255, c[0] + add));
    D[o + 1] = Math.max(0, Math.min(255, c[1] + add));
    D[o + 2] = Math.max(0, Math.min(255, c[2] + add));
    D[o + 3] = 255;
  }
  function isIn(tx, tz) {
    if (tx < -PAD || tz < -PAD || tx >= MAP + PAD || tz >= MAP + PAD) return false;
    return tileState[(tx + PAD) * (MAP + PAD * 2) + (tz + PAD)] === 1;
  }
  function setTiles(b) {
    for (let tx = -PAD; tx < MAP + PAD; tx++) for (let tz = -PAD; tz < MAP + PAD; tz++)
      tileState[(tx + PAD) * (MAP + PAD * 2) + (tz + PAD)] = inLand(tx, tz, b) ? 1 : 0;
  }
  function paintTiles(x0, z0, x1, z1) {
    const px0 = Math.max(0, (x0 + PAD) * PX), px1 = Math.min(S, (x1 + PAD) * PX);
    const py0 = Math.max(0, (z0 + PAD) * PX), py1 = Math.min(S, (z1 + PAD) * PX);
    for (let py = py0; py < py1; py++) for (let px = px0; px < px1; px++) paintPixel(px, py);
  }
  setTiles(land);
  paintTiles(-PAD, -PAD, MAP + PAD, MAP + PAD);
  g2.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false;
  const groundMat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP + PAD * 2, MAP + PAD * 2), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  group.add(ground);

  const cliffs = buildCliffs(shape, T.cliff);
  group.add(cliffs);

  // ----- Grilla para modo colocación -----
  const gcv = document.createElement('canvas');
  gcv.width = gcv.height = MAP * PX;
  const gctx = gcv.getContext('2d');
  const gtex = new THREE.CanvasTexture(gcv);
  gtex.magFilter = THREE.NearestFilter; gtex.minFilter = THREE.NearestFilter; gtex.colorSpace = THREE.SRGBColorSpace; gtex.generateMipmaps = false;
  const gridMesh = new THREE.Mesh(new THREE.PlaneGeometry(MAP, MAP), new THREE.MeshBasicMaterial({ map: gtex, transparent: true, depthWrite: false, opacity: 0.9 }));
  gridMesh.rotation.x = -Math.PI / 2;
  gridMesh.position.y = 0.012;
  gridMesh.visible = false;
  gridMesh.renderOrder = 2;
  group.add(gridMesh);
  function paintGrid() {
    gctx.clearRect(0, 0, gcv.width, gcv.height);
    gctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let tx = land.min; tx < land.max; tx++) for (let tz = land.min; tz < land.max; tz++) {
      const x = tx * PX, y = tz * PX;
      gctx.fillRect(x, y, PX, 1); gctx.fillRect(x, y, 1, PX);
    }
    gctx.fillRect(land.max * PX - 1, land.min * PX, 1, (land.max - land.min) * PX);
    gctx.fillRect(land.min * PX, land.max * PX - 1, (land.max - land.min) * PX, 1);
    gtex.needsUpdate = true;
  }
  paintGrid();

  // ----- Naturaleza fuera del terreno -----
  let natureGroup = null;
  let natureTiles = [];
  const KINDS = T.nature;
  function pickKind(h) { let a = 0; for (const [k, p] of KINDS) { a += p; if (h < a) return k; } return KINDS[0][0]; }
  function natureCandidates() {
    const list = [];
    for (let tx = -PAD; tx < MAP + PAD; tx++) for (let tz = -PAD; tz < MAP + PAD; tz++) {
      const h = hash2(tx, tz, 99);
      const outsideMap = tx < 0 || tz < 0 || tx >= MAP || tz >= MAP;
      if (h > (outsideMap ? 0.2 : 0.3)) continue;
      // tiene que haber isla firme debajo (toda la baldosa)
      const cx = (tx + PAD) * PX + 4, cz = (tz + PAD) * PX + 4;
      if (!islandPx(cx - 3, cz - 3) || !islandPx(cx + 3, cz + 3) || !islandPx(cx - 3, cz + 3) || !islandPx(cx + 3, cz - 3)) continue;
      list.push({ tx, tz, kind: outsideMap && h > 0.12 ? (hash2(tx, tz, 5) < 0.5 ? 'flowers' : 'bush') : pickKind(hash2(tx, tz, 17)), seed: Math.floor(hash2(tx, tz, 23) * 100000) });
    }
    return list;
  }
  const allNature = natureCandidates();
  let signTiles = new Set();
  function rebuildNature() {
    if (natureGroup) { group.remove(natureGroup); disposeGeometries(natureGroup); }
    natureTiles = allNature.filter(n => !inLand(n.tx, n.tz) && !signTiles.has(n.tx + ',' + n.tz));
    const objs = natureTiles.map(n => {
      const o = natureModel(n.kind, n.seed, T.id);
      const h1 = hash2(n.tx, n.tz, 41), h2 = hash2(n.tx, n.tz, 43);
      o.position.set(n.tx + 0.5 - HALF + (h1 - 0.5) * 0.3, 0, n.tz + 0.5 - HALF + (h2 - 0.5) * 0.3);
      o.rotation.y = Math.floor(hash2(n.tx, n.tz, 47) * 4) * Math.PI / 2;
      const s = 0.85 + hash2(n.tx, n.tz, 53) * 0.3;
      o.scale.setScalar(s);
      return o;
    });
    natureGroup = mergeStatic(objs);
    natureGroup.name = 'nature';
    group.add(natureGroup);
  }

  // ----- Carteles de expansión -----
  const signs = [];
  const signProto = signModel(T.id);
  function placeSigns(canExpand) {
    for (const s of signs) group.remove(s.obj);
    signs.length = 0;
    signTiles = new Set();
    if (!canExpand) return;
    const mid = Math.floor((land.min + land.max) / 2);
    const spots = [[mid, land.min - 1], [mid - 1, land.max], [land.min - 1, mid - 1], [land.max, mid]];
    for (const [tx, tz] of spots) {
      if (tx < 0 || tz < 0 || tx >= MAP || tz >= MAP) continue;
      const obj = signProto.clone();
      obj.position.set(tx + 0.5 - HALF, 0, tz + 0.5 - HALF);
      obj.userData.base = obj.position.clone();
      group.add(obj);
      signs.push({ tx, tz, obj, pos: new THREE.Vector3(tx + 0.5 - HALF, 1.25, tz + 0.5 - HALF) });
      signTiles.add(tx + ',' + tz);
    }
  }

  // ----- Islotes -----
  const islets = [];
  const ISLETS = [[-HALF - 9, -6, -1.5], [HALF + 7, -HALF + 2, -3.2], [-HALF + 4, HALF + 8, -4], [HALF + 10, HALF - 3, 0.6], [-6, -HALF - 10, 1.2]];
  ISLETS.forEach(([x, z, y], i) => {
    const o = isletModel(i + 1, T);
    o.position.set(x, y, z);
    o.userData.baseY = y;
    o.userData.phase = i * 1.7;
    group.add(o);
    islets.push(o);
  });

  // ----- Nubes -----
  const clouds = [];
  const crnd = mulberry(777);
  for (let i = 0; i < 11; i++) {
    const c = cloudModel(i + 3, T.id);
    c.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    const rad = 24 + crnd() * 12, ang = (i / 11) * Math.PI * 2 + crnd() * 0.4;
    const y = -12 + crnd() * 11;
    c.userData = { ...c.userData, rad, ang, y, speed: 0.008 + crnd() * 0.012, bob: crnd() * 6 };
    const s = 0.9 + crnd() * 0.9;
    c.scale.setScalar(s);
    group.add(c);
    clouds.push(c);
  }

  // ----- Animación de expansión -----
  let expandAnim = null;
  function animateExpand(newBounds, canExpand) {
    const old = land;
    land = { ...newBounds };
    const ring = [];
    for (let tx = land.min; tx < land.max; tx++) for (let tz = land.min; tz < land.max; tz++)
      if (!inLand(tx, tz, old)) ring.push({ tx, tz, a: Math.atan2(tz + 0.5 - HALF, tx + 0.5 - HALF) });
    ring.sort((p, q) => p.a - q.a);
    ring.forEach((p, i) => { p.t = (i / ring.length) * 1.1; p.done = false; });
    // la naturaleza que queda adentro desaparece con un "puf"
    for (const n of natureTiles) if (inLand(n.tx, n.tz)) hooks.onPoof?.(n.tx + 0.5 - HALF, n.tz + 0.5 - HALF);
    placeSigns(canExpand);
    rebuildNature();
    paintGrid();
    expandAnim = { ring, t: 0 };
  }

  setTiles(land);
  placeSigns(bounds.canExpand);
  rebuildNature();
  tex.needsUpdate = true;

  let camAngle = Math.PI / 4;
  function update(dt, t) {
    for (const c of clouds) {
      const u = c.userData;
      u.ang += u.speed * dt;
      c.position.set(Math.cos(u.ang) * u.rad, u.y + Math.sin(t * 0.3 + u.bob) * 0.4, Math.sin(u.ang) * u.rad);
      u.update?.(dt, t);
    }
    for (const o of islets) {
      o.position.y = o.userData.baseY + Math.sin(t * 0.6 + o.userData.phase) * 0.25;
      o.rotation.y = Math.sin(t * 0.15 + o.userData.phase) * 0.15;
    }
    for (const s of signs) {
      s.obj.rotation.y = camAngle;
      s.obj.position.y = Math.abs(Math.sin(t * 2.2 + s.tx)) * 0.06;
    }
    if (expandAnim) {
      expandAnim.t += dt;
      let changed = false;
      for (const p of expandAnim.ring) {
        if (p.done || p.t > expandAnim.t) continue;
        p.done = true; changed = true;
        tileState[(p.tx + PAD) * (MAP + PAD * 2) + (p.tz + PAD)] = 1;
        paintTiles(p.tx - 1, p.tz - 1, p.tx + 2, p.tz + 2);
        hooks.onTileReveal?.(p.tx + 0.5 - HALF, p.tz + 0.5 - HALF);
      }
      if (changed) { g2.putImageData(img, 0, 0); tex.needsUpdate = true; }
      if (expandAnim.ring.every(p => p.done)) expandAnim = null;
    }
  }

  return {
    group, ground, gridMesh, signs, theme: T.id,
    get bounds() { return land; },
    setCamAngle(a) { camAngle = a; },
    showGrid(v) { gridMesh.visible = v; },
    animateExpand,
    refreshSigns(canExpand) { placeSigns(canExpand); rebuildNature(); },
    update,
    dispose() {
      tex.dispose(); gtex.dispose(); groundMat.dispose(); gridMesh.material.dispose();
      if (natureGroup) disposeGeometries(natureGroup);
      disposeGeometries(cliffs);
      disposeGeometries(signProto);
      for (const o of islets) o.userData.own?.dispose();
      r.scene.remove(group);
    },
  };
}

