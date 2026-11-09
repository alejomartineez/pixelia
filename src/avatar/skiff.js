// El esquife volador (plan §M5): un bote chico de madera que flota con un cristal de Céfiro abajo del casco. Reemplaza
// al auto del Pixelia de antes, en el estilo de M1: serio, de madera trabajada, con tonos en bloques y sin nada de
// juguete. API (la misma que tenía car.js, que ahora lo reexporta):
//   skiffModel(car, opts) -> THREE.Group  (largo ≈ 1,6 unidades en Z, proa a +Z, quilla en y = 0)
//     car = store.state.car = { body: casco, color: pintura, wheels: vela o globo, topper: proa }
//     opts.driver: look de quien lo lleva, sentado en el banco de popa
//     group.userData.size = { w, l, h } · userData.sail (malla del aparejo, para la miniatura) · userData.wheels = [sail]
//     group.userData.update(dt, speed, steer): se mece, escora al doblar y la vela flamea
//   normalizeCar(car) · carStats(car) -> { speed, handling } 1..5
import * as THREE from 'three';
import { Voxels, voxelMaterial, shade, hexToInt } from '../core/voxel.js';
import { OUTFIT_COLORS, CAR_BODIES, CAR_WHEELS, CAR_TOPPERS, V5_CAR } from '../core/data.js';
import { avatarModel, AVATAR_VOXEL } from './avatar.js';
import { MAT, ramp, clothHex, lightMat } from './avatar-kit.js';

/** Vóxel del esquife en unidades de mundo. */
export const SKIFF_VOXEL = 1 / 24;
const S = SKIFF_VOXEL;

const byId = (list, id) => list.find(i => i.id === id) || list[0];
/** Completa y corrige la config. Las piezas del auto de antes (perfiles de contactos viejos) pasan a las del esquife. */
export function normalizeCar(car = {}) {
  car = car && typeof car === 'object' ? car : {};
  const ok = (list, kind, id) => { id = V5_CAR[kind]?.[id] || id; return list.some(i => i.id === id) ? id : list[0].id; };
  return { body: ok(CAR_BODIES, 'body', car.body), color: ok(OUTFIT_COLORS, 'color', car.color), wheels: ok(CAR_WHEELS, 'wheels', car.wheels), topper: ok(CAR_TOPPERS, 'topper', car.topper) };
}
export function carStats(car = {}) {
  const b = byId(CAR_BODIES, car.body);
  return { speed: b.speed, handling: b.handling };
}

// ---------------- materiales ----------------
// madera del casco en 4 tonos (tablas que alternan, la sombra de la quilla y la luz de la borda); la pintura es la
// tela del vestuario apagada (clothHex), así combina con la ropa
const WOOD = 0x7a5c3a, WOOD_D = ramp(WOOD, -1.1), WOOD_DD = ramp(WOOD, -2.2), WOOD_L = ramp(WOOD, 1);
const ROPE = 0xa08a62, CANVAS = 0xc8bb9c, CANVAS_D = ramp(CANVAS, -1), CANVAS_L = ramp(CANVAS, 0.8);
const CRYSTAL = 0x5fd8c8, CRYSTAL_D = 0x2e8f86, CRYSTAL_L = 0xb8f4ea;
function paintOf(id) {
  const c = hexToInt(clothHex(id));
  return { p: c, pD: ramp(c, -1.1), pL: ramp(c, 1) };
}

// ---------------- cascos ----------------
// L: eslora, W: manga, H: puntal, sheer: cuánto sube la proa, stern: ancho de la popa (0..1), y lo propio de cada uno
const HULLS = {
  bote: { L: 36, W: 16, H: 7, sheer: 3, stern: 0.7 },
  chalupa: { L: 36, W: 18, H: 8, sheer: 2, stern: 0.8, awning: true },
  balandra: { L: 42, W: 17, H: 8, sheer: 3, stern: 0.75, cabin: true },
  cuter: { L: 44, W: 14, H: 7, sheer: 5, stern: 0.55, fin: true },
  barcaza: { L: 46, W: 20, H: 7, sheer: 1, stern: 0.9, cargo: true },
  ceremonia: { L: 44, W: 18, H: 9, sheer: 4, stern: 0.8, trim: true, castle: true },
};
const hullOf = (id) => HULLS[id] || HULLS.bote;

/** Medio ancho del casco en la estación z (de -L/2 popa a L/2 proa) y la fila y (0 quilla .. H-1 borda). */
function halfW(h, z, y) {
  const t = (z + h.L / 2) / h.L;   // 0 popa .. 1 proa
  let k = t > 0.6 ? Math.cos(((t - 0.6) / 0.4) * Math.PI / 2) : t < 0.12 ? h.stern + (1 - h.stern) * (t / 0.12) : 1;
  k = Math.max(0, k);
  const belly = 0.42 + 0.58 * Math.sqrt(y / (h.H - 1));   // fondo redondeado: angosto en la quilla
  return (h.W / 2) * k * belly;
}
/** Alto de la borda en la estación z: sube hacia la proa (y un poco en la popa). */
const topAt = (h, z) => {
  const t = (z + h.L / 2) / h.L;
  return h.H + Math.round(t > 0.65 ? ((t - 0.65) / 0.35) ** 2 * h.sheer : t < 0.08 ? 1 : 0);
};

function drawHull(v, h, P) {
  const z0 = -Math.floor(h.L / 2), z1 = z0 + h.L;
  for (let z = z0; z < z1; z++) {
    const top = topAt(h, z);
    for (let y = 0; y < top; y++) {
      const hw = halfW(h, z, Math.min(y, h.H - 1));
      if (hw < 0.5 && z < z1 - 2) continue;
      if (z > z1 - 1 - Math.round((h.H - 1 - Math.min(y, h.H - 1)) * 0.55)) continue;   // proa lanzada: abajo termina antes
      const xr = Math.max(1, Math.round(hw));
      for (let x = -xr; x < xr; x++) {
        const shell = x === -xr || x === xr - 1 || y === 0 || z === z0 || (Math.abs(x + 0.5) > halfW(h, z + 1, Math.min(y, h.H - 1)) - 0.5) || (Math.abs(x + 0.5) > halfW(h, z - 1, Math.min(y, h.H - 1)) - 0.5);
        if (!shell && y > 1) continue;   // por dentro hueco: piso en y = 1
        // tablas: la borda pintada con su luz, una franja pintada (la cinta) y las tablas de madera que alternan
        let c;
        if (y >= top - 1) c = h.trim ? MAT.brass : P.pL;
        else if (y === top - 2) c = P.p;
        else if (y === top - 4 && h.H >= 7) c = P.pD;
        else if (y === 0) c = WOOD_DD;
        else c = (y >> 1) % 2 ? WOOD : WOOD_D;
        if (!shell) c = y === 1 ? ((z + 99) % 3 === 0 ? WOOD_D : WOOD) : c;   // las tablas del piso
        v.set(x, y, z, c);
      }
    }
  }
  // quilla: una tira oscura de popa a proa, que sube en la roda
  for (let z = z0 + 2; z < z1; z++) v.set(-1, -1, z, WOOD_DD), v.set(0, -1, z, WOOD_DD);
  // roda: sube inclinada hacia adelante desde la quilla (no una tabla parada), con la punta clara
  const tip = z1 - 1, rt = topAt(h, tip) + 2;
  for (let y = -1; y < rt; y++) { const z = tip - 3 + Math.round(((y + 1) / rt) ** 1.6 * 4); v.set(-1, y, z, WOOD_DD); v.set(0, y, z, WOOD_DD); }
  v.box(-1, rt, tip, 2, 1, 2, WOOD_L);
  // costillas por dentro y bancos
  for (let z = z0 + 4; z < z1 - 6; z += 5) {
    const xr = Math.round(halfW(h, z, h.H - 2));
    for (let y = 2; y < h.H - 1; y++) { v.set(-xr + 1, y, z, WOOD_D); v.set(xr - 2, y, z, WOOD_D); }
  }
  const bench = (zb) => { const xr = Math.round(halfW(h, zb, h.H - 3)) - 1; v.box(-xr, h.H - 3, zb, 2 * xr, 1, 3, (x) => ((x + 99) % 4 === 0 ? WOOD_D : WOOD_L)); };
  bench(z0 + 6); bench(Math.round(z0 + h.L * 0.55));
  // timón: la pala en la popa y la caña que entra al bote
  v.box(-1, -2, z0 - 2, 2, h.H, 2, (x, y) => (y === h.H - 3 ? MAT.metalD : WOOD_D));
  v.box(-1, h.H - 2, z0 - 1, 2, 1, 6, WOOD);
  // cornamusas de bronce en la borda
  for (const zz of [z0 + 3, z1 - 10]) for (const s of [-1, 1]) {
    const xr = Math.round(halfW(h, zz, h.H - 1));
    v.set(s < 0 ? -xr - 1 : xr, topAt(h, zz) - 2, zz, MAT.brass);
  }
  // lo de cada casco
  if (h.awning) {   // toldo de lona sobre la popa, con cuatro parantes
    const za = z0 + 3, zb = z0 + 13, xr = Math.round(halfW(h, za + 4, h.H - 1)) - 1;
    for (const x of [-xr, xr - 1]) for (const z of [za, zb]) v.box(x, h.H, z, 1, 17, 1, WOOD_D);   // alto: quien lleva el timón va sentado abajo
    for (let x = -xr - 1; x <= xr; x++) for (let z = za - 1; z <= zb + 1; z++) {
      const sag = Math.abs(x + 0.5) < xr - 2 ? 1 : 0;
      v.set(x, h.H + 17 - sag, z, (x + 99) % 4 < 2 ? P.p : CANVAS);
    }
  }
  if (h.cabin) {   // cabina chica de popa: techo pintado y dos ventanitas
    const za = z0 + 2, d = 10, xr = Math.round(halfW(h, za + 5, h.H - 1)) - 2;
    v.box(-xr, h.H - 2, za, 2 * xr, 7, d, (x, y, z) => (y === h.H + 4 ? P.pL : y === h.H + 3 ? P.p : (z === za + d - 1 && y === h.H + 1 && Math.abs(x + 0.5) > 1 && Math.abs(x + 0.5) < xr - 1) ? 0x2a3038 : (x + 99) % 3 === 0 ? WOOD_D : WOOD));
  }
  if (h.castle) {   // popa alzada con baranda tallada y faroles
    const za = z0 + 1, d = 9, xr = Math.round(halfW(h, za + 4, h.H - 1));
    v.box(-xr, h.H, za, 2 * xr, 2, d, (x, y) => (y === h.H + 1 ? WOOD_L : WOOD));
    for (let x = -xr; x < xr; x += 2) v.box(x, h.H + 2, za, 1, 3, 1, MAT.brassD);
    v.box(-xr, h.H + 5, za, 2 * xr, 1, 1, MAT.brass);
  }
  if (h.fin) {   // quilla alta de corte: una aleta oscura debajo, larga
    for (let z = z0 + 8; z < z1 - 8; z++) { const d = Math.round(3 - Math.abs(z - (z0 + z1) / 2) / 8); for (let y = -1 - Math.max(1, d); y < -1; y++) v.set(-1, y, z, WOOD_DD), v.set(0, y, z, WOOD_DD); }
  }
  if (h.cargo) {   // cajones de carga atados en el medio
    const zc = Math.round(z0 + h.L * 0.38);
    v.box(-6, 2, zc, 5, 5, 5, (x, y) => (y === 6 ? WOOD_L : x === -6 ? WOOD_D : WOOD)); v.box(1, 2, zc + 1, 5, 4, 4, (x, y) => (y === 5 ? WOOD_L : WOOD_D));
    v.box(-7, 7, zc + 2, 14, 1, 1, ROPE);
  }
}

/** El cristal de Céfiro que hace flotar el esquife: colgado debajo del casco, en el medio (se dibuja aparte, brilla). */
function drawCrystal(v) {
  for (let y = 0; y < 7; y++) {
    const r = y < 2 ? 1 : y < 5 ? 2 : 1;
    for (let x = -r; x < r; x++) for (let z = -r; z < r; z++) v.set(x, -y, z, y === 0 ? CRYSTAL_L : (x + z + 99) % 2 ? CRYSTAL : CRYSTAL_D);
  }
  v.set(-1, -7, 0, CRYSTAL_D); v.set(0, -7, -1, CRYSTAL);
}

// ---------------- aparejo (la "vela": el slot que antes eran las ruedas) ----------------
const MAST_Z = (h) => Math.round(-h.L / 2 + h.L * 0.56);
function mast(v, h, z, tall) {
  for (let y = 1; y < h.H + tall; y++) v.box(-1, y, z, 2, 1, 2, (y + 99) % 9 === 0 ? MAT.metalD : WOOD_D);
  v.box(-1, h.H + tall, z, 2, 1, 2, MAT.brassD);
}
const RIGS = {
  vela(v, h, P) {   // vela de cuchillo (de proa a popa) con botavara: de frente se ve fina, de costado muestra el paño
    const zm = MAST_Z(h), tall = 30;
    mast(v, h, zm, tall);
    for (let i = 0; i < tall - 4; i++) {
      const y = h.H + 3 + i, len = Math.round((1 - i / (tall - 4)) * (h.L * 0.42)) + 1;
      for (let k = 0; k < len; k++) v.set(0, y, zm - 1 - k, i % 7 === 0 ? CANVAS_D : k === len - 1 ? CANVAS_L : (k >> 2) % 2 ? CANVAS : CANVAS_L);
    }
    v.box(0, h.H + 2, zm - Math.round(h.L * 0.44), 1, 1, Math.round(h.L * 0.44), WOOD);   // botavara
    for (let k = 0; k < 6; k++) v.set(0, h.H + 4 + k * 2, zm - 2, P.p);   // franja pintada junto al mástil
  },
  vela_cuadra(v, h, P) {   // vela cuadra en una verga, inflada hacia adelante, con la franja de la pintura
    const zm = MAST_Z(h), tall = 30, half = Math.round(h.W * 0.7);
    mast(v, h, zm, tall);
    v.box(-half - 1, h.H + tall - 2, zm + 2, 2 * half + 2, 1, 1, WOOD);   // verga
    for (let y = h.H + 7; y < h.H + tall - 2; y++) for (let x = -half; x < half; x++) {
      const bulge = Math.round(2.2 * Math.sin(((x + half) / (2 * half)) * Math.PI) * Math.sin(((y - h.H - 7) / (tall - 9)) * Math.PI));
      const band = Math.abs(y - (h.H + 7 + (tall - 9) / 2)) < 2;
      v.set(x, y, zm + 3 + bulge, band ? P.p : (x + 99) % 6 === 0 ? CANVAS_D : y === h.H + tall - 3 ? CANVAS_L : CANVAS);
    }
    for (const s of [-1, 1]) for (let i = 0; i < 8; i++) v.set(s < 0 ? -half : half - 1, h.H + 6 - i * 0.6 | 0, zm + 3 + i, ROPE);   // escotas
  },
  globo(v, h, P) {   // globo chico de gajos (pintura y lona) atado a la borda con cuatro cabos, sin mástil
    const cy = h.H + 30, rx = Math.round(h.W * 0.62), ry = 11, rz = Math.round(h.L * 0.3), zc = 0;
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) for (let z = -rz; z <= rz; z++) {
      const d = (x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2;
      if (d > 1 || d < 0.72) continue;
      const gore = ((Math.atan2(z, x) + Math.PI) / (Math.PI / 4) | 0) % 2;
      v.set(x, cy + y, zc + z, y > ry * 0.6 ? (gore ? P.pL : CANVAS_L) : y < -ry * 0.55 ? (gore ? P.pD : CANVAS_D) : gore ? P.p : CANVAS);
    }
    v.box(-3, cy - ry - 2, zc - 3, 6, 2, 6, MAT.leatherD);   // aro de la boca
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x0 = sx * Math.round(h.W * 0.38), z0 = sz * Math.round(h.L * 0.25);
      for (let i = 0; i <= 18; i++) { const t = i / 18; v.set(Math.round(x0 + (sx * 3 - x0) * t), Math.round(h.H + (cy - ry - 2 - h.H) * t), Math.round(z0 + (sz * 3 - z0) * t), ROPE); }
    }
  },
  vela_doble(v, h, P) {   // dos palos con velas cuadras chicas: la de proa más baja
    for (const [zf, tall, half] of [[MAST_Z(h) + 5, 22, Math.round(h.W * 0.5)], [MAST_Z(h) - 9, 30, Math.round(h.W * 0.62)]]) {
      mast(v, h, zf, tall);
      v.box(-half - 1, h.H + tall - 2, zf + 2, 2 * half + 2, 1, 1, WOOD);
      for (let y = h.H + 6; y < h.H + tall - 2; y++) for (let x = -half; x < half; x++) {
        const bulge = Math.round(1.6 * Math.sin(((x + half) / (2 * half)) * Math.PI));
        v.set(x, y, zf + 3 + bulge, (y - h.H) % 6 === 0 ? P.p : (x + 99) % 5 === 0 ? CANVAS_D : CANVAS);
      }
    }
  },
};

// ---------------- proa (el slot que antes era el adorno) ----------------
const PROWS = {
  farol(v, h) {   // botalón con un farol colgado: el vidrio brilla aparte
    const z1 = Math.ceil(h.L / 2), y0 = topAt(h, z1 - 1);
    for (let i = 0; i < 9; i++) v.box(-1, y0 + (i >> 1), z1 + i, 2, 1, 1, WOOD_D);
    // el farol cuelga de la punta del botalón: gancho, tapa, cuatro parantes y la base
    v.box(-1, y0 + 2, z1 + 7, 2, 2, 1, MAT.metal);
    v.box(-2, y0 + 1, z1 + 6, 4, 1, 4, MAT.metalD); v.box(-2, y0 - 4, z1 + 6, 4, 1, 4, MAT.metalD);
    for (const [x, z] of [[-2, 6], [1, 6], [-2, 9], [1, 9]]) v.box(x, y0 - 3, z1 + z, 1, 4, 1, MAT.metal);
  },
  mascaron(v, h) {   // mascarón de proa: un ave tallada en madera clara con las alas plegadas y el pico de bronce
    const z1 = Math.ceil(h.L / 2), y0 = topAt(h, z1 - 1) - 3;
    v.box(-2, y0, z1, 4, 4, 3, (x, y) => (y === y0 + 3 ? WOOD_L : WOOD));
    v.box(-2, y0 + 4, z1 + 1, 4, 3, 3, (x, y) => (y === y0 + 6 ? WOOD_L : WOOD));
    v.box(-1, y0 + 5, z1 + 4, 2, 1, 2, MAT.brass);
    v.set(-2, y0 + 5, z1 + 3, MAT.ink); v.set(1, y0 + 5, z1 + 3, MAT.ink);
    for (const s of [-1, 1]) v.box(s < 0 ? -3 : 2, y0 - 1, z1 - 3, 1, 5, 5, (x, y, z) => ((z + y) % 2 ? WOOD_D : WOOD));
  },
  cristal(v, h) {   // cristal mayor en la roda, con el engarce de bronce (el cristal brilla aparte)
    const z1 = Math.ceil(h.L / 2), y0 = topAt(h, z1 - 1);
    v.box(-2, y0, z1 - 2, 4, 2, 4, MAT.brassD);
  },
};
function prowGlow(v, h, id) {
  const z1 = Math.ceil(h.L / 2), y0 = topAt(h, z1 - 1);
  if (id === 'farol') v.box(-1, y0 - 3, z1 + 7, 2, 4, 2, (x, y) => (y >= y0 - 1 ? 0xe8b866 : 0xd08a3a));
  if (id === 'cristal') for (let y = 0; y < 9; y++) {   // prisma que se afina arriba
    const r = y < 6 ? 2 : 1;
    for (let x = -r; x < r; x++) for (let z = -r; z < r; z++) v.set(x, y0 + 2 + y, z1 + z, y > 6 ? CRYSTAL_L : (x + z + y + 99) % 3 ? CRYSTAL : CRYSTAL_D);
  }
}

// ---------------- caché ----------------
const geoCache = new Map();
function cachedGeo(key, build) {
  if (geoCache.has(key)) return geoCache.get(key);
  const v = new Voxels();
  build(v);
  const g = v.size ? v.toGeometry({ scale: S, jitter: 0 }) : null;
  geoCache.set(key, g);
  return g;
}
function meshOf(g, mat) {
  const m = new THREE.Mesh(g, mat || voxelMaterial());
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** Altura a la que flota la quilla sobre el piso (el cristal queda colgando abajo). */
export const SKIFF_FLOAT = 0.38;

export function skiffModel(carIn = {}, opts = {}) {
  const car = normalizeCar(carIn);
  const h = hullOf(car.body), P = paintOf(car.color);
  const root = new THREE.Group();
  root.name = 'skiff';
  const body = new THREE.Group();   // todo lo que se mece
  body.position.y = SKIFF_FLOAT;
  root.add(body);
  body.add(meshOf(cachedGeo(`sk|${car.body}|${car.color}`, (v) => drawHull(v, h, P))));
  const crystal = meshOf(cachedGeo('sk|cristal', drawCrystal), lightMat());
  crystal.castShadow = false;
  crystal.position.set(-0.5 * S, -1 * S, 0);
  body.add(crystal);
  // aparejo
  const sail = meshOf(cachedGeo(`sk|r|${car.wheels}|${car.body}|${car.color}`, (v) => (RIGS[car.wheels] || RIGS.vela)(v, h, P)));
  body.add(sail);
  // proa
  const glow = [crystal];
  if (PROWS[car.topper]) {
    body.add(meshOf(cachedGeo(`sk|p|${car.topper}|${car.body}`, (v) => PROWS[car.topper](v, h))));
    const g = cachedGeo(`sk|pg|${car.topper}|${car.body}`, (v) => prowGlow(v, h, car.topper));
    if (g) { const m = meshOf(g, lightMat()); m.castShadow = false; body.add(m); glow.push(m); }
  }

  root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); bb.getSize(size);
  const sc = opts.scale || 1;
  root.userData.size = { w: size.x * sc, l: size.z * sc, h: (bb.max.y) * sc };

  // quien lo lleva: sentado en el banco de popa, con la mano en la caña
  let driver = null;
  if (opts.driver) {
    driver = avatarModel(opts.driver, { seated: true });
    // con cabina o popa alzada se sienta delante de ellas
    const zs = -Math.floor(h.L / 2) + (h.cabin ? 16 : h.castle ? 14 : 7);
    driver.position.set(-0.5 * S, (h.H - 2) * S - 4 * AVATAR_VOXEL, zs * S);
    body.add(driver);
  }
  if (opts.scale) root.scale.setScalar(opts.scale);

  root.userData.sail = sail;
  root.userData.wheels = [sail];   // compatibilidad: las miniaturas de "vela" usan la primera
  root.userData.frontWheels = [];
  root.userData.driver = driver;
  root.userData.car = car;
  root.userData.stats = carStats(car);

  let t = Math.random() * 10, lean = 0;
  root.userData.update = (dt = 0.016, speed = 0, steer = 0) => {
    dt = Math.min(dt, 0.1);
    t += dt;
    const sp = Math.min(1, Math.abs(speed) / 2);
    lean += ((-(steer || 0) * 0.12 * sp) - lean) * Math.min(1, dt * 3);
    body.position.y = SKIFF_FLOAT + Math.sin(t * 1.3) * 0.02;
    body.rotation.z = lean + Math.sin(t * 0.9) * 0.025;
    body.rotation.x = Math.sin(t * 1.1 + 1) * 0.02 - sp * 0.04;
    sail.scale.z = 1 + Math.sin(t * 3.1) * 0.015 * (0.4 + sp);
    crystal.scale.setScalar(1 + Math.sin(t * 2.4) * 0.04);   // el cristal late (su origen está arriba, no se corre)
    driver?.userData.update(dt, false);
  };
  root.userData.update(0, 0, 0);
  return root;
}
