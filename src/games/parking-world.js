// Estacionamiento Real — construcción del mundo 3D vóxel de cada nivel (playa, autos, conos, lugar objetivo, efectos).
import * as THREE from 'three';
import { Voxels, shade, glowMaterial, disposeObject } from '../core/voxel.js';
import * as carLib from '../avatar/car.js';
import { natureModel } from '../city/models.js';
import { OUTFIT_COLORS, CAR_BODIES, CAR_WHEELS, CAR_TOPPERS } from '../core/data.js';
import { makeBox, CAR_HW, CAR_HL, DEG } from './parking-physics.js';

export const BORDER_T = 0.3;            // grosor de colisión del cordón perimetral

/** RNG con semilla (mulberry32). */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

function shadowAll(obj, cast = true, receive = true) {
  obj.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}

/** Auto normalizado a 1 unidad de largo, envuelto en un pivote (rotación/posición van en el pivote). */
const bodySizes = new Map();
/** Tamaño de la carrocería sola (sin adornos como alitas, que ensanchan la caja). */
function bodySize(car) {
  if (!bodySizes.has(car.body)) {
    const probe = carLib.carModel({ ...car, topper: 'ninguno' });
    bodySizes.set(car.body, probe.userData.size || { w: 0.6, l: 1, h: 0.5 });
  }
  return bodySizes.get(car.body);
}
export function makeCarPivot(car, opts = {}) {
  const model = carLib.carModel(car, opts);
  const size = bodySize(car);
  const s = Math.min(1 / (size.l || 1), 0.7 / (size.w || 0.6));
  model.scale.multiplyScalar(s);
  const pivot = new THREE.Group();
  const wobble = new THREE.Group();
  wobble.add(model);
  pivot.add(wobble);
  pivot.userData.model = model;
  pivot.userData.wobble = wobble;
  shadowAll(pivot);
  return pivot;
}

function randomCar(rng) {
  const bodies = CAR_BODIES.filter(b => b.id !== 'limusina');
  return {
    body: pick(rng, bodies).id,
    color: pick(rng, OUTFIT_COLORS).id,
    wheels: rng() < 0.7 ? 'clasica' : pick(rng, CAR_WHEELS).id,
    topper: rng() < 0.75 ? 'ninguno' : pick(rng, CAR_TOPPERS).id,
  };
}

// ---------- Piezas vóxel propias ----------
function coneGeometry() {
  const v = new Voxels();
  const C = '#ff8a7a', W = '#fff4fa', D = '#e0645a';
  v.box(0, 0, 0, 6, 1, 6, D);
  v.box(1, 1, 1, 4, 2, 4, C);
  v.box(1, 3, 1, 4, 1, 4, W);
  v.box(2, 4, 2, 2, 2, 2, C);
  v.box(2, 6, 2, 2, 1, 2, W);
  v.box(2, 7, 2, 2, 2, 2, C);
  return v.toGeometry({ scale: 1 / 17, center: 'xz', jitter: 0.012 });
}

function lampModel() {
  const v = new Voxels();
  const post = '#b58cff', dark = '#8a5ee0';
  v.box(1, 0, 1, 3, 1, 3, dark);
  v.box(2, 1, 2, 1, 11, 1, post);
  v.box(1, 12, 1, 3, 1, 3, dark);
  const g = new THREE.Group();
  g.add(v.toMesh({ scale: 1 / 12, center: 'xz' }));
  const head = new Voxels();
  head.box(0, 0, 0, 3, 2, 3, '#fff0c2');
  head.box(1, 2, 1, 1, 1, 1, '#ffd166');
  const hm = head.toMesh({ scale: 1 / 12, center: 'xz', material: glowMaterial(), castShadow: false });
  hm.position.y = 13 / 12;
  g.add(hm);
  return shadowAll(g);
}

function signModel() {
  const v = new Voxels();
  const P = [
    '.......', '.####..', '.#...#.', '.#...#.', '.####..', '.#.....', '.#.....', '.......',
  ];
  v.box(4, 0, 0, 1, 10, 1, '#8a5ee0');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 9; x++) {
    const ch = x >= 1 && x <= 7 ? P[7 - y][x - 1] : '.';
    v.set(x, 9 + y, 0, ch === '#' ? '#ffffff' : (x === 0 || x === 8 || y === 0 || y === 7) ? '#e0528f' : '#ff7eb6');
  }
  return shadowAll(v.toMesh({ scale: 1 / 12, center: 'xz' }));
}

function wallMesh(w, kind) {
  const v = new Voxels();
  const S = 8;                       // vóxeles por unidad
  const nx = Math.max(1, Math.round(w.w * S)), nz = Math.max(1, Math.round(w.d * S));
  if (kind === 'garage') {
    const h = 5;
    v.box(0, 0, 0, nx, h, nz, (x, y, z) => y === h - 1 ? '#fff4fa' : ((x + z + y) % 4 === 0 ? '#c9adff' : '#dcc9ff'));
    // remate con almenas
    for (let i = 0; i < Math.max(nx, nz); i += 2) {
      if (nx >= nz) v.set(i, h, 0, '#ff7eb6'); else v.set(0, h, i, '#ff7eb6');
    }
  } else {
    // cordón: rayas rosa/blanco; si es ancho, vereda de baldosas un vóxel más alta
    v.box(0, 0, 0, nx, 1, nz, (x, y, z) => (Math.floor((nx >= nz ? x : z) / 2) % 2 ? '#ff7eb6' : '#fff4fa'));
    if (Math.min(nx, nz) >= 3) {
      for (let x = 1; x < nx - 1; x++) for (let z = 1; z < nz - 1; z++)
        v.set(x, 1, z, ((Math.floor(x / 2) + Math.floor(z / 2)) % 2) ? '#fff4e6' : '#f6e6f2');
    }
  }
  const m = v.toMesh({ scale: 1 / S, center: 'xz' });
  return m;
}

/** Canvas pixelado con una flecha (o doble flecha) para el piso del lugar. */
function arrowTexture(double) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 16;
  const g = cv.getContext('2d');
  const rows = double ? [
    '.......##.......', '......####......', '.....######.....', '....########....', '.......##.......', '.......##.......', '.......##.......', '.......##.......',
    '.......##.......', '.......##.......', '.......##.......', '.......##.......', '....########....', '.....######.....', '......####......', '.......##.......',
  ] : [
    '.......##.......', '......####......', '.....######.....', '....########....', '...##########...', '..#####..#####..', '.......##.......', '.......##.......',
    '.......##.......', '.......##.......', '.......##.......', '.......##.......', '.......##.......', '.......##.......', '................', '................',
  ];
  g.fillStyle = '#ffffff';
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') g.fillRect(x, y, 1, 1); }));
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function markerModel() {
  // flecha gorda que apunta hacia abajo, con borde rosa
  const rows = [
    '...#####...',
    '...#ooo#...',
    '...#ooo#...',
    '...#ooo#...',
    '####ooo####',
    '#ooooooooo#',
    '.#ooooooo#.',
    '..#ooooo#..',
    '...#ooo#...',
    '....#o#....',
    '.....#.....',
  ];
  const v = new Voxels();
  rows.forEach((r, i) => [...r].forEach((c, x) => {
    if (c === '.') return;
    const y = rows.length - 1 - i;
    const col = c === '#' ? '#e0528f' : (i < 5 ? '#ffe08a' : '#ffd166');
    for (let z = 0; z < 3; z++) v.set(x, y, z, col);
  }));
  return v.toMesh({ scale: 1 / 12, center: 'xyz', material: glowMaterial(), castShadow: true });
}

// ---------- Mundo ----------
/**
 * Construye el nivel. Devuelve objetos para el loop del juego.
 * player: { car, princess }  (del estado)
 */
export function buildWorld(scene, level, levelIndex, player) {
  const rng = seeded(1337 + levelIndex * 7919);
  const group = new THREE.Group();
  scene.add(group);
  const [W, D] = level.area;
  const hw = W / 2, hd = D / 2;

  // --- Suelo: pasto lejano (plano simple) ---
  const far = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshLambertMaterial({ color: 0x9fe08a }));
  far.rotation.x = -Math.PI / 2; far.position.y = -0.13; far.receiveShadow = true;
  group.add(far);

  // --- Suelo vóxel: asfalto + vereda + pasto cercano (4 vóxeles por unidad) ---
  const S = 4, M = 4.5; // margen alrededor en unidades
  const gx0 = Math.floor((-hw - M) * S), gx1 = Math.ceil((hw + M) * S);
  const gz0 = Math.floor((-hd - M) * S), gz1 = Math.ceil((hd + M) * S);
  const ground = new Voxels();
  const walk = 0.95; // ancho de vereda (incluye cordón)
  for (let x = gx0; x < gx1; x++) for (let z = gz0; z < gz1; z++) {
    const wx = (x + 0.5) / S, wz = (z + 0.5) / S;
    const ox = Math.abs(wx) - hw, oz = Math.abs(wz) - hd;
    const h = ((x * 73856093) ^ (z * 19349663)) >>> 0;
    // variación por manchas de 2×2 vóxeles y contraste bajo: con pixeles chicos, el moteado de a un vóxel
    // se ve como ruido / dientes de sierra en vez de textura
    const hc = ((Math.floor(x / 2) * 73856093) ^ (Math.floor(z / 2) * 19349663)) >>> 0;
    if (ox < 0 && oz < 0) {
      ground.set(x, 0, z, hc % 11 === 0 ? '#b3a8c7' : hc % 7 === 0 ? '#bfb5d1' : '#b9aecc');
    } else if (ox < walk && oz < walk) {
      ground.set(x, 0, z, ((Math.floor(x / 2) + Math.floor(z / 2)) % 2) ? '#fff4e6' : '#f3e2ee');
    } else {
      const c = h % 61 === 0 ? '#ffc2dc' : h % 67 === 0 ? '#fff4fa' : hc % 5 === 0 ? '#8ad876' : hc % 3 === 0 ? '#95e081' : '#8fdc7a';
      ground.set(x, 0, z, c);
    }
  }
  const gm = ground.toMesh({ scale: 1 / S, castShadow: false, jitter: 0.015 });
  gm.position.y = -1 / S;
  group.add(gm);

  // --- Cordón perimetral (rayitas rosa/blanco) ---
  const border = [];
  const addBorder = (x, z, w, d) => {
    const m = wallMesh({ w, d }, 'curb');
    m.position.set(x, 0, z);
    group.add(m);
  };
  const ct = 0.25;
  addBorder(0, -hd - ct / 2, W + ct * 2, ct); addBorder(0, hd + ct / 2, W + ct * 2, ct);
  addBorder(-hw - ct / 2, 0, ct, D); addBorder(hw + ct / 2, 0, ct, D);
  border.push(
    makeBox(0, -hd - BORDER_T / 2, (W + BORDER_T * 2) / 2, BORDER_T / 2, 0),
    makeBox(0, hd + BORDER_T / 2, (W + BORDER_T * 2) / 2, BORDER_T / 2, 0),
    makeBox(-hw - BORDER_T / 2, 0, BORDER_T / 2, (D + BORDER_T * 2) / 2, 0),
    makeBox(hw + BORDER_T / 2, 0, BORDER_T / 2, (D + BORDER_T * 2) / 2, 0),
  );

  // --- Líneas pintadas ---
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xfffaff });
  const lineGeo = new THREE.BoxGeometry(1, 0.012, 1);
  const LW = 0.07;
  const addLine = (cx, cz, lenAlong, a, widthAcross = LW) => {
    const m = new THREE.Mesh(lineGeo, lineMat);
    m.scale.set(widthAcross, 1, lenAlong);
    m.position.set(cx, 0.008, cz);
    m.rotation.y = a;
    m.receiveShadow = true;
    group.add(m);
  };
  const sp = level.spot;
  for (const st of level.stalls) {
    if (Math.abs(st.x - sp.x) < 0.01 && Math.abs(st.z - sp.z) < 0.01) continue; // el objetivo se dibuja aparte
    const a = st.a * DEG, fx = Math.sin(a), fz = Math.cos(a), rx = Math.cos(a), rz = -Math.sin(a);
    if (st.style === 'ends') {
      for (const s of [1, -1]) addLine(st.x + fx * s * st.l / 2, st.z + fz * s * st.l / 2, st.w, a + Math.PI / 2);
    } else {
      for (const s of [1, -1]) addLine(st.x + rx * s * st.w / 2, st.z + rz * s * st.w / 2, st.l, a);
      addLine(st.x + fx * st.l / 2, st.z + fz * st.l / 2, st.w + LW, a + Math.PI / 2);
    }
  }

  // --- Paredes / cordones internos ---
  const walls = [];
  for (const w of level.walls) {
    const m = wallMesh(w, w.kind);
    m.position.set(w.x, 0, w.z);
    m.rotation.y = (w.a || 0) * DEG;
    group.add(m);
    walls.push({ box: makeBox(w.x, w.z, w.w / 2, w.d / 2, (w.a || 0) * DEG), mesh: m, wob: 0, kind: w.kind });
    if (w.kind === 'curb') { // farolitas sobre la vereda
      const long = Math.max(w.w, w.d);
      for (let t = -long / 2 + 1.2; t < long / 2 - 0.6; t += 3.2) {
        const l = lampModel();
        l.position.set(w.x + (w.d > w.w ? 0.05 : t), 0.12, w.z + (w.d > w.w ? t : 0.05));
        group.add(l);
      }
    }
  }

  // --- Autos estacionados ---
  const parked = [];
  for (const c of level.cars) {
    const pv = makeCarPivot(randomCar(rng));
    const flip = rng() < 0.4 ? Math.PI : 0;
    pv.position.set(c.x, 0, c.z);
    pv.rotation.y = c.a * DEG + flip;
    group.add(pv);
    parked.push({ box: makeBox(c.x, c.z, CAR_HW, CAR_HL, c.a * DEG), mesh: pv, wob: 0 });
  }

  // --- Conos ---
  const coneGeo = coneGeometry();
  const coneMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const cones = level.cones.map(([x, z]) => {
    const m = new THREE.Mesh(coneGeo, coneMat);
    m.castShadow = true; m.receiveShadow = true;
    m.position.set(x, 0, z);
    m.rotation.y = rng() * Math.PI;
    group.add(m);
    return { x, z, y: 0, vx: 0, vy: 0, vz: 0, spinX: 0, spinZ: 0, down: false, flying: false, mesh: m };
  });

  // --- Decoración alrededor ---
  const kinds = ['tree', 'tree', 'pine', 'bush', 'flowers', 'tree', 'bush', 'mushroom'];
  for (let x = -hw - M + 0.6; x < hw + M; x += 1.25) for (let z = -hd - M + 0.6; z < hd + M; z += 1.25) {
    const jx = x + (rng() - 0.5) * 0.7, jz = z + (rng() - 0.5) * 0.7;
    const ox = Math.abs(jx) - hw, oz = Math.abs(jz) - hd;
    if (ox < walk + 0.45 && oz < walk + 0.45) continue;
    if (rng() < 0.35) continue;
    const kind = pick(rng, kinds);
    const m = natureModel(kind, Math.floor(rng() * 1000));
    m.position.set(jx, 0, jz);
    m.rotation.y = Math.floor(rng() * 4) * Math.PI / 2;
    const sc = kind === 'tree' || kind === 'pine' ? 0.9 + rng() * 0.4 : 0.8 + rng() * 0.3;
    m.scale.setScalar(sc);
    group.add(shadowAll(m));
  }
  // farolas en la vereda perimetral
  const lampPos = [];
  for (let x = -hw + 0.5; x <= hw - 0.4; x += 2.6) lampPos.push([x, -hd - 0.62], [x, hd + 0.62]);
  for (let z = -hd + 1.6; z <= hd - 1.2; z += 2.8) lampPos.push([-hw - 0.62, z], [hw + 0.62, z]);
  for (const [x, z] of lampPos) { const l = lampModel(); l.position.set(x, 0, z); group.add(l); }
  const sign = signModel();
  sign.position.set(-hw - 0.62, 0, hd + 0.62);
  group.add(sign);

  // --- Lugar objetivo ---
  const spot = { ...sp, a: sp.a * DEG };
  const spotGroup = new THREE.Group();
  spotGroup.position.set(spot.x, 0, spot.z);
  spotGroup.rotation.y = spot.a;
  group.add(spotGroup);
  const frameMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
  const barGeo = new THREE.BoxGeometry(1, 0.03, 1);
  const FW = 0.09;
  const bars = [
    [0, sp.l / 2, sp.w + FW, FW], [0, -sp.l / 2, sp.w + FW, FW],
    [sp.w / 2, 0, FW, sp.l + FW], [-sp.w / 2, 0, FW, sp.l + FW],
  ].map(([x, z, w, d]) => {
    const m = new THREE.Mesh(barGeo, frameMat);
    m.position.set(x, 0.016, z); m.scale.set(w, 1, d);
    spotGroup.add(m);
    return m;
  });
  const fillMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.25, depthWrite: false });
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(sp.w, sp.l), fillMat);
  fill.rotation.x = -Math.PI / 2; fill.position.y = 0.012;
  spotGroup.add(fill);
  const holdMat = new THREE.MeshBasicMaterial({ color: 0x6fe3c1, transparent: true, opacity: 0.55, depthWrite: false });
  const hold = new THREE.Mesh(new THREE.PlaneGeometry(sp.w, sp.l), holdMat);
  hold.rotation.x = -Math.PI / 2; hold.position.y = 0.014;
  hold.scale.y = 0.0001;
  spotGroup.add(hold);
  const arrowMat = new THREE.MeshBasicMaterial({ map: arrowTexture(!!sp.flip), transparent: true, opacity: 0.85, depthWrite: false });
  const arrow = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), arrowMat);
  arrow.rotation.x = -Math.PI / 2;
  arrow.rotation.z = Math.PI; // la flecha del canvas apunta a -Z local; el grupo ya está girado al rumbo
  arrow.position.y = 0.02;
  spotGroup.add(arrow);
  const marker = markerModel();
  marker.position.set(spot.x, 1.1, spot.z);
  marker.rotation.order = 'YXZ';
  marker.rotation.x = -0.75; // inclinada hacia la cámara para que se lea como flecha desde arriba
  group.add(marker);

  // --- Jugadora ---
  const playerPivot = makeCarPivot(player.car, { driver: player.princess });
  group.add(playerPivot);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff7eb6, transparent: true, opacity: 0.55, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 24), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
  playerPivot.add(ring);

  // --- Partículas (chispitas y humito) ---
  const fx = makeParticles(group);

  const statics = [...border.map(b => ({ box: b, mesh: null, wob: 0, kind: 'border' })), ...walls, ...parked];

  const cA = new THREE.Color(0xffd166), cB = new THREE.Color(0xff7eb6), cOk = new THREE.Color(0x6fe3c1), tmpC = new THREE.Color();
  return {
    group, playerPivot, statics, parked, cones, spot, fx, marker,
    /** Animación del lugar: status = { inside, aligned, hold (0..1) } */
    updateSpot(dt, t, status) {
      const ok = status.inside && status.aligned;
      if (ok) tmpC.copy(cOk); else tmpC.copy(cA).lerp(cB, (Math.sin(t * 5) + 1) / 2);
      frameMat.color.copy(tmpC);
      fillMat.color.copy(tmpC);
      const blink = (Math.floor(t * 4) % 2) ? 1 : 0;
      fillMat.opacity = ok ? 0.38 : 0.16 + blink * 0.12;
      for (const b of bars) b.position.y = 0.016 + (ok ? 0.01 : 0);
      hold.scale.y = Math.max(0.0001, status.hold);
      marker.position.y = 1.1 + Math.sin(t * 3.2) * 0.14 + (ok ? 0.25 : 0);
      marker.rotation.y = Math.sin(t * 2.2) * 0.35;
      marker.visible = !status.done;
    },
    dispose() {
      scene.remove(group);
      disposeObject(group);
    },
  };
}

function makeParticles(parent) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mats = [0xffd166, 0xff7eb6, 0xffffff, 0x6fe3c1, 0xb58cff].map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true }));
  const puffMat = new THREE.MeshBasicMaterial({ color: 0xf4eefa, transparent: true, opacity: 0.8 });
  const pool = [];
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(geo, mats[i % mats.length]);
    m.visible = false;
    parent.add(m);
    pool.push({ m, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 0.07, grav: 6, puff: false });
  }
  const puffs = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(geo, puffMat.clone());
    m.visible = false;
    parent.add(m);
    puffs.push({ m, life: 0, max: 0.6, vx: 0, vy: 0, vz: 0, size: 0.08, grav: -0.6, puff: true });
  }
  let pi = 0, qi = 0;
  return {
    /** Chispitas desde (x,y,z). n partículas, fuerza. */
    burst(x, y, z, n = 30, power = 2.2) {
      for (let k = 0; k < n; k++) {
        const p = pool[pi = (pi + 1) % pool.length];
        const ang = Math.random() * Math.PI * 2, sp = power * (0.4 + Math.random() * 0.6);
        p.vx = Math.cos(ang) * sp * 0.6; p.vz = Math.sin(ang) * sp * 0.6; p.vy = sp * (0.8 + Math.random() * 0.7);
        p.life = p.max = 0.8 + Math.random() * 0.7; p.size = 0.05 + Math.random() * 0.06; p.grav = 5;
        p.m.position.set(x, y, z); p.m.visible = true;
      }
    },
    puff(x, z) {
      const p = puffs[qi = (qi + 1) % puffs.length];
      p.vx = (Math.random() - 0.5) * 0.3; p.vz = (Math.random() - 0.5) * 0.3; p.vy = 0.4;
      p.life = p.max = 0.55; p.size = 0.06 + Math.random() * 0.04;
      p.m.position.set(x, 0.1, z); p.m.visible = true;
    },
    update(dt) {
      for (const list of [pool, puffs]) for (const p of list) {
        if (!p.m.visible) continue;
        p.life -= dt;
        if (p.life <= 0) { p.m.visible = false; continue; }
        p.vy -= p.grav * dt;
        p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
        if (p.m.position.y < 0.02) { p.m.position.y = 0.02; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
        const k = p.life / p.max;
        const s = p.puff ? p.size * (1.6 - k * 0.6) : p.size * Math.min(1, k * 2);
        p.m.scale.setScalar(s);
        if (p.puff) p.m.material.opacity = 0.75 * k;
        p.m.rotation.y += dt * 4;
      }
    },
  };
}
