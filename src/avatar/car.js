// Autos vóxel adorables. API (ver DESIGN.md):
//   carModel(car, opts) -> THREE.Group  (largo ≈ 1 unidad en Z, frente a +Z, base y=0)
//     car = store.state.car = { body, color, wheels, topper }
//     opts.driver: look del personaje (cualquier tipo) para sentarlo al volante (cabeza + torso)
//     opts.scale: escala uniforme opcional
//     group.userData.size = {w, l, h}  (sin contar a la conductora)
//     group.userData.wheels = mallas de ruedas (giran); userData.frontWheels = pivotes que doblan
//     group.userData.update(dt, speed, steer) — speed en unidades/seg (signo = sentido), steer -1..1 (+ = hacia +X)
//   carStats(car) -> {speed, handling} 1..5
import * as THREE from 'three';
import { Voxels, voxelMaterial, shade, hexToInt } from '../core/voxel.js';
import { OUTFIT_COLORS, CAR_BODIES, CAR_WHEELS, CAR_TOPPERS } from '../core/data.js';
import { avatarModel, AVATAR_VOXEL } from './avatar.js';

/** Tamaño de un vóxel de auto en unidades de mundo (16 vóxeles = 1 unidad). */
export const CAR_VOXEL = 1 / 16;
const S = CAR_VOXEL;

const CHROME = 0xf1ecf8, CHROME_D = 0xc9c0da;
const GOLD = 0xffd166, GOLD_D = 0xe8a93a, GOLD_L = 0xfff0c2;
const GLASS = 0xcdeeff, GLASS_D = 0xa8dcff;
const SEAT = 0xfff0f6, SEAT_D = 0xf2d2e2;
const LIGHT = 0xfff6c8, TAIL = 0xcf5f5f;
const DARK = 0x4a3a55;
const WHITE = 0xffffff;

const byId = (list, id) => list.find(i => i.id === id) || list[0];

/** Completa/corrige la config del auto. */
export function normalizeCar(car = {}) {
  const ok = (list, id) => (list.some(i => i.id === id) ? id : list[0].id);
  return { body: ok(CAR_BODIES, car.body), color: ok(OUTFIT_COLORS, car.color), wheels: ok(CAR_WHEELS, car.wheels), topper: ok(CAR_TOPPERS, car.topper) };
}
/** Stats de manejo 1..5 del modelo. */
export function carStats(car = {}) {
  const b = byId(CAR_BODIES, car.body);
  return { speed: b.speed, handling: b.handling };
}

// ---------------- caché ----------------
const geoCache = new Map();
function cachedGeo(key, build, after) {
  if (geoCache.has(key)) return geoCache.get(key);
  const v = new Voxels();
  build(v);
  let g = null;
  if (v.size) { g = v.toGeometry({ scale: S, jitter: 0.03 }); after?.(g); }
  geoCache.set(key, g);
  return g;
}
function meshOf(g) {
  const m = new THREE.Mesh(g, voxelMaterial());
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---------------- helpers de dibujo ----------------
/** Caja con aristas verticales redondeadas (sin las 4 columnas de las esquinas). */
function rbox(v, x0, y0, z0, w, h, d, col) {
  for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + h; y++) for (let z = z0; z < z0 + d; z++) {
    const ex = x === x0 || x === x0 + w - 1, ez = z === z0 || z === z0 + d - 1;
    if (ex && ez) continue;
    v.set(x, y, z, typeof col === 'function' ? col(x, y, z) : col);
  }
}
/** Recorta los huecos de las ruedas (centro en y=r, z=wz+0.5) y pinta el interior oscuro. */
function wells(v, W, wzs, r) {
  const outer = W / 2 - 2;
  for (const wz of wzs) {
    const cz = wz + 0.5;
    for (let x = -W / 2 - 1; x <= W / 2; x++) for (let y = 0; y <= r * 2 + 1; y++) for (let z = Math.floor(cz - r - 2); z <= cz + r + 2; z++) {
      const d = Math.hypot(y + 0.5 - r, z + 0.5 - cz);
      if (d > r + 0.8) continue;
      if (x >= outer || x < -outer) v.remove(x, y, z);
      else if ((x === outer - 1 || x === -outer) && v.has(x, y, z)) v.set(x, y, z, DARK);
    }
  }
}
/** Guardabarros: arco del color del auto sobre cada rueda. */
function fenders(v, W, wzs, r, col, y) {
  for (const wz of wzs) for (let z = wz - Math.floor(r); z <= wz + Math.floor(r); z++) for (const x of [-W / 2, -W / 2 + 1, W / 2 - 2, W / 2 - 1]) v.set(x, y, z, col);
}
function headlight(v, x, y, z, ring = false) {
  v.set(x, y, z, LIGHT); v.set(x + 1, y, z, LIGHT); v.set(x, y + 1, z, WHITE); v.set(x + 1, y + 1, z, LIGHT);
  if (ring) for (const [dx, dy] of [[-1, 0], [2, 0], [-1, 1], [2, 1], [0, -1], [1, -1], [0, 2], [1, 2]]) v.set(x + dx, y + dy, z, CHROME);
}
function pal(colorId) {
  const c = hexToInt(byId(OUTFIT_COLORS, colorId).hex);
  return { c, d: shade(c, -0.16), dd: shade(c, -0.3), l: shade(c, 0.28), ll: shade(c, 0.55) };
}
function windshield(v, x0, x1, y0, y1, z, frame = CHROME) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const edge = x === x0 || x === x1 || y === y1;
    v.set(x, y, z, edge ? frame : ((x - y + 40) % 5 === 0 ? WHITE : GLASS));
  }
}

// =====================================================================
//                               CARROCERÍAS
// x [-W/2, W/2), frente +Z. r = radio de rueda, wz = índice z del centro de cada eje (centro real wz+0.5),
// seat = {y: altura de la cadera de la conductora, z}, ds = escala de la conductora,
// top = anclaje del adorno {y, z}, wing = anclaje de alitas {y, z}
// =====================================================================
const BODIES = {
  convertible: {
    W: 10, r: 2.5, wz: [4, -5], seat: { y: 4, z: -2.5 }, ds: 0.62, top: { y: 6, z: -6.5 }, wing: { y: 5, z: -2 },
    build(v, p) {
      rbox(v, -5, 1, -8, 10, 5, 16, (x, y) => (y === 1 ? p.d : y === 3 ? p.l : p.c));
      // capó redondeado y cola
      for (let x = -5; x <= 4; x++) { v.remove(x, 5, 7); v.remove(x, 5, -8); }
      v.clear(-3, 4, -5, 6, 2, 7);
      wells(v, 10, this.wz, this.r);
      fenders(v, 10, this.wz, this.r, p.c, 5);
      for (const wz of this.wz) for (const x of [-5, 4]) { v.set(x, 4, wz - 2, p.d); v.set(x, 4, wz + 3, p.d); }
      // asiento acolchado
      v.box(-3, 3, -5, 6, 1, 4, SEAT_D);
      v.box(-3, 4, -4, 6, 1, 3, SEAT);
      for (let x = -3; x <= 2; x++) for (let y = 5; y <= 7; y++) v.set(x, y, -5, (y === 7 && (x === -3 || x === 2)) ? null : ((x + y) & 1 ? SEAT : SEAT_D));
      // volante
      v.set(-1, 5, 1, DARK); v.set(0, 5, 1, DARK); v.set(-1, 6, 1, DARK); v.set(0, 6, 1, DARK);
      windshield(v, -4, 3, 6, 7, 2);
      // trompa: faros + parrilla sonriente
      headlight(v, -4, 3, 7); headlight(v, 2, 3, 7);
      for (let x = -2; x <= 1; x++) v.set(x, 2, 8, CHROME);
      v.set(-3, 3, 8, CHROME); v.set(2, 3, 8, CHROME);
      for (let x = -4; x <= 3; x++) v.set(x, 1, 8, CHROME_D);
      // cola
      for (const x of [-4, -3, 2, 3]) v.set(x, 4, -8, TAIL);
      for (let x = -4; x <= 3; x++) v.set(x, 1, -9, CHROME_D);
      v.set(-6, 6, 2, CHROME); v.set(5, 6, 2, CHROME); v.set(-6, 5, 2, DARK); v.set(5, 5, 2, DARK);
      // corazón en la puerta
      for (const sx of [-6, 5]) { v.set(sx, 4, -2, p.ll); v.set(sx, 4, 0, p.ll); v.set(sx, 3, -2, p.ll); v.set(sx, 3, -1, p.ll); v.set(sx, 3, 0, p.ll); v.set(sx, 2, -1, p.ll); }
    },
  },
  mini: {
    W: 10, r: 2.5, wz: [3, -5], seat: { y: 5, z: -2 }, ds: 0.55, top: { y: 13, z: -2.5 }, wing: { y: 6, z: -2 },
    build(v, p) {
      rbox(v, -5, 1, -7, 10, 6, 13, (x, y) => (y === 1 ? p.d : y === 4 ? p.l : p.c));
      v.clear(-4, 5, -5, 8, 2, 6);
      wells(v, 10, this.wz, this.r);
      fenders(v, 10, this.wz, this.r, p.c, 5);
      for (const wz of this.wz) for (const x of [-5, -4, 3, 4]) v.set(x, 6, wz, p.c);
      // cabina: parantes blancos + techo con techo solar
      for (const [x, z] of [[-5, -6], [4, -6], [-5, 1], [4, 1]]) for (let y = 7; y <= 11; y++) v.set(x, y, z, WHITE);
      for (let x = -5; x <= 4; x++) for (let z = -6; z <= 1; z++) if (x === -5 || x === 4 || z === -6 || z === 1) v.set(x, 12, z, WHITE);
      for (let x = -4; x <= 3; x++) for (let y = 7; y <= 11; y++) v.set(x, y, -6, y === 11 ? WHITE : y >= 8 ? GLASS_D : WHITE);
      windshield(v, -4, 3, 7, 11, 1, WHITE);
      // asiento
      v.box(-3, 5, -5, 6, 1, 3, SEAT);
      v.box(-3, 6, -5, 6, 3, 1, SEAT_D);
      v.set(-1, 7, 0, DARK); v.set(0, 7, 0, DARK);
      // carita: faros grandes + sonrisa
      headlight(v, -4, 3, 6, true); headlight(v, 2, 3, 6, true);
      v.set(-1, 2, 6, CHROME); v.set(0, 2, 6, CHROME); v.set(-2, 3, 6, CHROME); v.set(1, 3, 6, CHROME);
      for (let x = -5; x <= 4; x++) v.set(x, 1, 6, CHROME_D);
      // franjas en el capó
      for (let z = 2; z <= 5; z++) { v.set(-2, 6, z, WHITE); v.set(1, 6, z, WHITE); }
      for (const x of [-4, 3]) { v.set(x, 4, -7, TAIL); v.set(x, 5, -7, TAIL); }
      for (let x = -5; x <= 4; x++) v.set(x, 1, -8, CHROME_D);
      v.set(-6, 7, 1, WHITE); v.set(5, 7, 1, WHITE);
    },
  },
  jeep: {
    W: 10, r: 3.5, wz: [5, -6], seat: { y: 7, z: -3 }, ds: 0.6, top: { y: 13, z: -7 }, wing: { y: 8, z: -2 },
    build(v, p) {
      rbox(v, -5, 3, -8, 10, 5, 17, (x, y) => (y === 3 ? p.dd : y === 4 ? p.d : p.c));
      v.clear(-4, 6, -6, 8, 2, 8);
      wells(v, 10, this.wz, this.r);
      // guardabarros anchos
      for (const wz of this.wz) for (let z = wz - 3; z <= wz + 4; z++) for (const x of [-6, 5]) {
        v.set(x, 7, z, p.dd);
        if (z === wz - 3 || z === wz + 4) v.set(x, 6, z, p.dd);
      }
      for (const wz of this.wz) for (let z = wz - 2; z <= wz + 3; z++) for (const x of [-5, -4, 3, 4]) v.set(x, 7, z, p.c);
      // asiento + barra antivuelco
      v.box(-4, 6, -5, 8, 1, 4, SEAT);
      v.box(-4, 7, -6, 8, 3, 1, SEAT_D);
      for (const x of [-5, 4]) for (let y = 8; y <= 12; y++) v.set(x, y, -7, DARK);
      for (let x = -5; x <= 4; x++) v.set(x, 12, -7, DARK);
      v.set(-3, 12, -6, 0xffb36b); v.set(-2, 12, -6, LIGHT); v.set(1, 12, -6, LIGHT); v.set(2, 12, -6, 0xffb36b);
      windshield(v, -5, 4, 8, 9, 2, DARK);
      v.set(-1, 8, 1, DARK); v.set(0, 8, 1, DARK); v.set(-1, 7, 1, DARK);
      // frente: parrilla de barrotes + faros redondos
      for (let x = -2; x <= 1; x++) for (let y = 4; y <= 6; y++) v.set(x, y, 9, (x & 1) ? DARK : p.dd);
      headlight(v, -4, 5, 9, true); headlight(v, 2, 5, 9, true);
      for (let x = -5; x <= 4; x++) v.set(x, 3, 10, DARK);
      // rueda de auxilio
      for (let x = -3; x <= 2; x++) for (let y = 3; y <= 8; y++) {
        const d = Math.hypot(x + 0.5, y + 0.5 - 6);
        if (d <= 3) v.set(x, y, -9, d > 2 ? DARK : d < 1 ? CHROME_D : CHROME);
      }
      for (const x of [-5, 4]) { v.set(x, 5, -9, TAIL); v.set(x, 6, -9, TAIL); }
      v.set(-6, 9, 2, DARK); v.set(5, 9, 2, DARK);
    },
  },
  deportivo: {
    W: 10, r: 2.5, wz: [5, -6], seat: { y: 3, z: -2.5 }, ds: 0.6, top: { y: 8, z: -8.5 }, wing: { y: 4, z: -2 },
    build(v, p) {
      rbox(v, -5, 1, -8, 10, 3, 17, (x, y) => (y === 1 ? p.dd : p.c));
      rbox(v, -5, 4, 2, 10, 1, 5, p.c);
      for (let z = -8; z <= 1; z++) for (const x of [-5, -4, 3, 4]) v.set(x, 4, z, p.c);
      for (let x = -5; x <= 4; x++) for (let z = -8; z <= -5; z++) v.set(x, 4, z, p.c);
      v.clear(-3, 3, -4, 6, 1, 5);
      wells(v, 10, this.wz, this.r);
      fenders(v, 10, this.wz, this.r, p.c, 4);
      for (const wz of this.wz) for (const x of [-5, 4]) for (let z = wz - 1; z <= wz + 1; z++) v.set(x, 5, z, p.c);
      // asiento bajito
      v.box(-3, 2, -4, 6, 1, 4, SEAT_D);
      v.box(-3, 3, -4, 6, 1, 3, SEAT);
      v.box(-3, 4, -4, 6, 2, 1, SEAT_D);
      v.set(-1, 4, 1, DARK); v.set(0, 4, 1, DARK);
      // parabrisas inclinado
      for (let x = -4; x <= 3; x++) { v.set(x, 5, 2, GLASS); v.set(x, 6, 1, x === -4 || x === 3 ? DARK : GLASS_D); }
      // franjas de carrera
      for (let z = -8; z <= 8; z++) for (const x of [-2, 1]) if (v.has(x, 4, z)) v.set(x, 4, z, WHITE);
      // nariz en cuña
      v.clear(-5, 3, 8, 10, 2, 1);
      for (let x = -4; x <= 3; x++) v.set(x, 2, 9, x === -4 || x === 3 ? LIGHT : DARK);
      for (const x of [-4, -3, 2, 3]) v.set(x, 3, 8, x === -3 || x === 2 ? WHITE : LIGHT);
      for (const x of [-2, 1]) { v.set(x, 3, 8, WHITE); v.set(x, 2, 8, WHITE); }
      // alerón
      for (const x of [-4, 3]) for (let y = 5; y <= 6; y++) v.set(x, y, -8, DARK);
      for (let x = -5; x <= 4; x++) { v.set(x, 7, -8, p.dd); v.set(x, 7, -9, (x === -2 || x === 1) ? WHITE : p.dd); }
      for (let x = -4; x <= -2; x++) v.set(x, 3, -9, TAIL);
      for (let x = 1; x <= 3; x++) v.set(x, 3, -9, TAIL);
      for (const sx of [-6, 5]) { v.set(sx, 3, -1, DARK); v.set(sx, 3, 0, DARK); v.set(sx, 2, 0, p.dd); }
    },
  },
  limusina: {
    W: 10, r: 2.5, wz: [7, -9], seat: { y: 6, z: 0.5 }, ds: 0.58, top: { y: 11, z: -6 }, wing: { y: 6, z: -4 },
    build(v, p) {
      rbox(v, -5, 1, -11, 10, 5, 22, (x, y) => (y === 1 ? p.dd : y === 3 ? CHROME : p.c));
      for (let x = -5; x <= 4; x++) v.remove(x, 5, 10);
      v.clear(-3, 5, -1, 6, 1, 4);
      wells(v, 10, this.wz, this.r);
      fenders(v, 10, this.wz, this.r, p.c, 5);
      // cabina trasera con vidrios polarizados
      for (let x = -5; x <= 4; x++) for (let y = 6; y <= 9; y++) for (let z = -10; z <= -2; z++) {
        const edgeX = x === -5 || x === 4, edgeZ = z === -10 || z === -2;
        if (!edgeX && !edgeZ) continue;
        const win = y >= 7 && y <= 8 && !(edgeZ && (x < -3 || x > 2)) && z !== -6;
        v.set(x, y, z, win ? ((x + y + z) % 5 === 0 ? 0xc9b8ff : 0x6c5a9c) : p.c);
      }
      rbox(v, -5, 10, -10, 10, 1, 9, p.l);
      for (let z = -9; z <= -3; z++) v.set(-1, 10, z, p.ll), v.set(0, 10, z, p.ll);
      // asiento conductora
      v.box(-3, 5, 0, 6, 1, 2, SEAT);
      v.box(-3, 6, -1, 6, 2, 1, SEAT_D);
      v.set(-1, 7, 3, DARK); v.set(0, 7, 3, DARK);
      windshield(v, -4, 3, 6, 7, 4);
      // trompa
      headlight(v, -4, 3, 10); headlight(v, 2, 3, 10);
      for (let x = -2; x <= 1; x++) for (let y = 2; y <= 4; y++) v.set(x, y, 11, (y & 1) ? CHROME : CHROME_D);
      for (let x = -5; x <= 4; x++) v.set(x, 1, 11, CHROME_D);
      v.set(-1, 5, 9, GOLD); v.set(0, 5, 9, GOLD); v.set(-1, 6, 9, GOLD_L); v.set(0, 6, 9, GOLD);
      // banderines
      for (const x of [-5, 4]) { v.set(x, 6, 8, CHROME_D); v.set(x, 7, 8, CHROME_D); v.set(x, 8, 8, CHROME_D); v.set(x, 8, 7, 0xe392b0); v.set(x, 7, 7, 0xe392b0); v.set(x, 8, 6, 0xe392b0); }
      for (const x of [-4, -3, 2, 3]) v.set(x, 4, -11, TAIL);
      for (let x = -5; x <= 4; x++) v.set(x, 1, -12, CHROME_D);
    },
  },
  carruaje: {
    W: 12, r: 3.5, wz: [5, -6], seat: { y: 6, z: -0.5 }, ds: 0.55, top: { y: 16, z: 1.5 }, wing: { y: 9, z: -2 },
    build(v, p) {
      const rib = (x, y, z) => {
        const a = Math.atan2(x + 0.5, z + 0.5);
        const seg = Math.floor((a + Math.PI) / (Math.PI * 2) * 12);
        const base = (seg & 1) ? p.c : shade(p.c, -0.13);
        return y > 13 ? shade(base, 0.1) : base;
      };
      v.sphere(-0.5, 10, -0.5, 5.8, 5.6, 6.6, rib);
      v.sphere(-0.5, 10.2, -0.5, 4.6, 4.4, 5.4, null);
      // ventanas redondas a los lados
      for (let x = -7; x <= 6; x++) for (let y = 7; y <= 14; y++) for (let z = -4; z <= 3; z++) {
        if (!v.has(x, y, z) || (x > -3 && x < 2)) continue;
        const d = Math.hypot(y + 0.5 - 10.5, z + 0.5);
        if (d < 2.3) v.remove(x, y, z);
        else if (d < 3.0) v.set(x, y, z, GOLD);
      }
      // ventana del frente (con forma de arco)
      for (let x = -4; x <= 3; x++) for (let y = 7; y <= 14; y++) for (let z = 2; z <= 7; z++) {
        if (!v.has(x, y, z)) continue;
        const d = Math.hypot(x + 0.5, (y + 0.5 - 10.5) * 0.85);
        if (d < 2.6) v.remove(x, y, z); else if (d < 3.3) v.set(x, y, z, GOLD);
      }
      // base dorada fina con rulos
      rbox(v, -3, 3, -7, 6, 2, 14, (x, y) => (y === 3 ? GOLD_D : GOLD));
      for (let z = -7; z <= 6; z++) for (const x of [-5, 4]) v.set(x, 4, z, (z & 1) ? GOLD : GOLD_D);
      for (const s of [-1, 1]) {
        const z0 = s > 0 ? 7 : -8;
        v.set(-1, 4, z0, GOLD); v.set(0, 4, z0, GOLD); v.set(-1, 5, z0 + s, GOLD); v.set(0, 5, z0 + s, GOLD);
        v.set(-1, 6, z0, GOLD_L); v.set(0, 6, z0, GOLD);
      }
      wells(v, 12, this.wz, this.r);
      // asiento de terciopelo
      v.box(-3, 5, -2, 6, 1, 3, 0xff9cc8);
      v.box(-3, 6, -3, 6, 4, 1, 0xe392b0);
      // tallo y hojita
      v.box(-1, 15, -2, 2, 2, 2, 0x5fc46a);
      v.set(-1, 17, -2, 0x3e9e52); v.set(-2, 17, -2, 0x3e9e52); v.set(-3, 18, -2, 0x3e9e52);
      v.set(1, 16, -1, 0x8fdc7a); v.set(2, 16, -1, 0x8fdc7a); v.set(2, 16, 0, 0x8fdc7a); v.set(3, 16, -1, 0x6cc35d);
      // faroles
      for (const x of [-5, 4]) {
        v.set(x, 5, 7, GOLD_D); v.set(x, 6, 7, GOLD_D);
        v.set(x, 7, 7, LIGHT); v.set(x, 8, 7, WHITE); v.set(x, 9, 7, GOLD);
      }
    },
  },
};

// =====================================================================
//                                 RUEDAS
// Disco en el plano YZ centrado en el origen, 2 vóxeles de ancho (x [-1,1)).
// =====================================================================
const WHEEL_STYLE = {
  //            centro     brazos(+)   diagonales  anillo extra
  clasica: { tire: DARK, c: CHROME_D, a: WHITE, g: CHROME, o: CHROME },
  dorada: { tire: 0x3b2a40, c: WHITE, a: GOLD, g: GOLD_D, o: GOLD },
  estrella: { tire: 0x5b3f78, c: GOLD_L, a: GOLD, g: WHITE, o: 0xffd1e6, oa: GOLD },
  flor: { tire: 0xc2417a, c: 0xffe066, a: WHITE, g: 0xff9cc8, o: 0xffb3d1, oa: WHITE },
};
function wheelGeo(style, r) {
  return cachedGeo(`w|${style}|${r}`, (v) => {
    const st = WHEEL_STYLE[style] || WHEEL_STYLE.clasica;
    const k = Math.floor(r);
    for (let y = -k; y <= k; y++) for (let z = -k; z <= k; z++) {
      const d = Math.hypot(y, z);
      if (d > r + 0.01) continue;
      let c;
      if (d > r - 1.05) c = ((y + z + 40) % 3 === 0) ? shade(st.tire, 0.14) : st.tire;
      else if (d < 0.5) c = st.c;
      else if (d < 1.01) c = st.a;
      else if (d < 1.5) c = st.g;
      else c = (y === 0 || z === 0) ? (st.oa || st.o) : st.o;
      v.set(-1, y, z, c); v.set(0, y, z, c);
    }
  }, (g) => g.translate(0, -0.5 * S, -0.5 * S));
}

// =====================================================================
//                                 ADORNOS (apoyan en y=0 del anclaje)
// =====================================================================
const TOPPER = {
  'moño'(v, p) {
    const pinkish = ['rosa', 'fucsia', 'rojo'].includes(p.id);
    const c = pinkish ? 0xfff4fa : 0xe392b0, d = pinkish ? 0xf0d0e4 : 0xc4678e, l = pinkish ? WHITE : 0xffb3d1;
    v.box(-1, 0, 0, 2, 2, 2, d);
    for (const s of [-1, 1]) {
      const X = (x) => (s < 0 ? x : -1 - x);
      for (let y = 0; y <= 3; y++) for (let x = -4; x <= -2; x++) {
        if ((y === 0 || y === 3) && x === -4) continue;
        v.set(X(x), y, 0, c); v.set(X(x), y, 1, (y === 2 && x === -3) ? l : c);
      }
      v.set(X(-3), 1, 1, d);
      v.set(X(-2), -1, 1, c);
    }
  },
  corona(v) {
    for (let x = -3; x <= 2; x++) for (let z = -2; z <= 1; z++) {
      const edge = x === -3 || x === 2 || z === -2 || z === 1;
      if (edge) { v.set(x, 0, z, GOLD_D); v.set(x, 1, z, GOLD); } else v.set(x, 0, z, 0xc4678e);
    }
    for (const [x, z] of [[-3, -2], [2, -2], [-3, 1], [2, 1], [-1, 1], [0, 1], [-1, -2], [0, -2]]) v.set(x, 2, z, GOLD);
    v.set(-1, 3, 1, GOLD_L); v.set(0, 3, -2, GOLD_L);
    v.set(-1, 1, 1, 0xcf5f5f); v.set(0, 1, 1, 0xcf5f5f);
    v.set(-3, 1, 0, 0x4f7ce0); v.set(2, 1, -1, 0x6fe3c1);
  },
  corazon(v) {
    const heart = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
    heart.forEach((row, i) => [...row].forEach((ch, j) => {
      if (ch !== '#') return;
      const y = 7 - i, x = j - 3;
      const c = (i === 1 && j === 1) || (i === 0 && j === 1) ? WHITE : (j > 4 || i > 3) ? 0xe0466f : 0xff5a8a;
      v.set(x, y, 0, c); v.set(x, y, -1, j > 4 || i > 3 ? 0xd03a62 : 0xff5a8a);
    }));
    v.set(0, 1, 0, GOLD); v.set(0, 0, 0, GOLD_D); v.set(-1, 0, 0, GOLD_D); v.set(1, 0, 0, GOLD_D);
    v.set(0, 1, -1, GOLD_D);
  },
};
function featherWing(v) {
  const rows = [[0, 1], [0, 3], [0, 4], [0, 5], [1, 5], [3, 5]]; // [xIni, xFin] por fila (y = índice)
  rows.forEach(([a, b], y) => {
    for (let x = a; x <= b; x++) {
      const tip = x === b;
      v.set(x, y, 0, tip ? (y > 2 ? GOLD_L : 0xf3eaff) : ((x + y) & 1 ? WHITE : 0xf7f0ff));
    }
  });
}

// =====================================================================
//                                 MODELO
// =====================================================================
export function carModel(carIn = {}, opts = {}) {
  const car = normalizeCar(carIn);
  const def = BODIES[car.body] || BODIES.convertible;
  const p = { ...pal(car.color), id: car.color };

  const root = new THREE.Group();
  root.name = 'car';
  const body = new THREE.Group();
  root.add(body);
  body.add(meshOf(cachedGeo(`b|${car.body}|${car.color}`, (v) => def.build.call(def, v, p))));

  // ruedas: holder (dobla) -> malla (gira)
  const wheels = [], fronts = [];
  const wGeo = wheelGeo(car.wheels, def.r);
  const wx = (def.W / 2 - 1) * S;
  def.wz.forEach((wz, i) => {
    for (const sx of [-1, 1]) {
      const holder = new THREE.Group();
      holder.position.set(sx * wx, def.r * S, (wz + 0.5) * S);
      const m = meshOf(wGeo);
      holder.add(m);
      root.add(holder);
      wheels.push(m);
      if (i === 0) fronts.push(holder);
    }
  });

  // adorno
  let topper = null;
  const wings = [];
  if (car.topper === 'alas') {
    const g = cachedGeo('t|alas', featherWing);
    for (const sx of [-1, 1]) {
      const pv = new THREE.Group();
      pv.position.set(sx * (def.W / 2) * S, def.wing.y * S, def.wing.z * S);
      const m = meshOf(g);
      m.castShadow = false;
      if (sx < 0) m.scale.x = -1;
      pv.add(m);
      pv.rotation.y = sx * 0.55;
      body.add(pv);
      wings.push({ pv, sx });
    }
  } else if (TOPPER[car.topper]) {
    const g = cachedGeo(`t|${car.topper}|${car.color}`, (v) => TOPPER[car.topper](v, p));
    topper = new THREE.Group();
    topper.position.set(0, def.top.y * S, def.top.z * S);
    topper.add(meshOf(g));
    body.add(topper);
  }

  // tamaño (sin conductora)
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); bb.getSize(size);
  const sc = opts.scale || 1;
  root.userData.size = { w: size.x * sc, l: size.z * sc, h: size.y * sc };

  // conductora
  let driver = null;
  if (opts.driver) {
    driver = avatarModel(opts.driver, { seated: true, scale: def.ds });
    driver.position.set(0, def.seat.y * S - 4 * AVATAR_VOXEL * def.ds, def.seat.z * S);
    body.add(driver);
  }
  if (opts.scale) root.scale.setScalar(opts.scale);

  root.userData.wheels = wheels;
  root.userData.frontWheels = fronts;
  root.userData.driver = driver;
  root.userData.car = car;
  root.userData.stats = carStats(car);

  let t = Math.random() * 10, roll = 0;
  const radius = def.r * S * sc;
  root.userData.update = (dt = 0.016, speed = 0, steer = 0) => {
    dt = Math.min(dt, 0.1);
    t += dt;
    roll = (roll + (speed * dt) / radius) % (Math.PI * 2);
    for (const w of wheels) w.rotation.x = roll;
    const st = Math.max(-1, Math.min(1, steer || 0));
    for (const f of fronts) f.rotation.y = st * 0.5;
    const sp = Math.min(1, Math.abs(speed) / 3);
    body.position.y = Math.sin(t * 18) * 0.004 * sp + Math.sin(t * 2.5) * 0.002;
    body.rotation.z = -st * 0.05 * sp;
    if (topper) {
      if (car.topper === 'corazon') { topper.rotation.y = Math.sin(t * 1.6) * 0.5; topper.position.y = def.top.y * S + Math.abs(Math.sin(t * 3)) * 0.02; }
      else topper.position.y = def.top.y * S + Math.sin(t * 2.4) * 0.006;
    }
    for (const w of wings) w.pv.rotation.z = w.sx * (Math.sin(t * (sp > 0.1 ? 12 : 4)) * 0.25 + 0.25);
    driver?.userData.update(dt, false);
  };
  root.userData.update(0, 0, 0);
  return root;
}
