// Monumentos (categoría 'monumento'): obras grandes que se construyen por etapas con materiales de los minijuegos.
// El nivel del edificio ES la etapa: 1 = cimientos … N = terminado (N = MONUMENTS[id].stages.length).
// Cada builder dibuja el monumento TERMINADO; `staged` lo recorta a la altura de la etapa y le pone andamios,
// grúa, pilas de materiales y un cartel con la etapa. Así cada etapa se ve bien distinta: andamio → mitad → terminado.
import {
  P, C, shade, lot, win, door, gable, cone, flowerBed, bush, smallTree, fset, pattern,
  sparkle, wavingFlag, spinStar, rng, pick, FLOWER_COLORS, lampPost,
} from './models-kit.js';
import { MONUMENTS } from '../core/data.js';

const RED = '#e8564f', WHITE = '#ffffff', CREAM = '#f8eedc', CREAM_B = '#efe1c8';
const GLASS = '#bfe8ff', GLASS_G = '#bfeccf', COPPER = '#6fc9b0';
const MAT_COLORS = { cristal: '#c08cff', ladrillo: '#e0764a', tuerca: '#a9b4c2', mapa: '#f6d9a8' };

// ======================= ETAPAS =======================
/** Envuelve un builder: dibuja el terminado y, si la obra no terminó, lo recorta y le pone andamios. */
function staged(id, draw) {
  return (m, L, opts = {}) => {
    const N = MONUMENTS[id]?.stages.length || 4;
    const lv = Math.max(1, Math.min(N, L));
    draw(m, lv >= N, opts);
    if (lv >= N) celebrate(m);
    else underConstruction(m, id, lv, N);
  };
}

/** Terminado: borde dorado en el lote y brillitos (que se note que está completo). */
function celebrate(m) {
  const { v, W, D } = m;
  for (let x = 0; x < W; x++) for (const z of [0, D - 1]) if (v.has(x, 0, z) && !v.has(x, 1, z)) v.set(x, 0, z, (x + z) % 2 ? P.gold : P.goldD);
  for (let z = 0; z < D; z++) for (const x of [0, W - 1]) if (v.has(x, 0, z) && !v.has(x, 1, z)) v.set(x, 0, z, (x + z) % 2 ? P.gold : P.goldD);
}

function underConstruction(m, id, L, N) {
  const { v, W, D } = m;
  // altura del monumento terminado (sin contar el piso)
  let top = 1, x0 = W, x1 = 0, z0 = D, z1 = 0;
  for (const k of v.map.keys()) {
    const [x, y, z] = k.split(',').map(Number);
    if (y < 1) continue;
    if (y > top) top = y;
    if (y >= 2) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  }
  const f = (L - 0.6) / N;                         // N=4: 10% → 35% → 60%
  const cut = Math.max(2, Math.round(1 + (top - 1) * f));
  const trim = (g) => { for (const k of [...g.map.keys()]) if (+k.split(',')[1] > cut) g.map.delete(k); };
  trim(v); trim(m.glow); trim(m.light);
  m.parts = []; m.anims = [];
  // la última hilera queda "a medio poner": ladrillo crudo a cuadros
  for (const [k, c] of [...v.map]) {
    const [x, y, z] = k.split(',').map(Number);
    if (y === cut && (x + z) % 3 === 0) v.set(x, y, z, shade(c, -0.12));
  }
  // andamio al frente y a la derecha (atrás e izquierda quedan abiertos: se ve la obra)
  x0 = Math.max(1, x0 - 1); x1 = Math.min(W - 2, x1 + 1); z0 = Math.max(1, z0 - 1); z1 = Math.min(D - 2, z1 + 1);
  const H = cut + 3;
  const poles = (a0, a1) => { const out = []; for (let a = a0; a <= a1; a += 5) out.push(a); if (out[out.length - 1] !== a1) out.push(a1); return out; };
  for (const x of poles(x0, x1)) v.box(x, 1, z1, 1, H, 1, P.wood);
  for (const z of poles(z0, z1)) v.box(x1, 1, z, 1, H, 1, P.wood);
  for (let y = 4; y <= H; y += 4) {
    for (let x = x0; x <= x1; x++) v.set(x, y, z1, (x % 2 ? P.gold : P.goldD));
    for (let z = z0; z <= z1; z++) v.set(x1, y, z, (z % 2 ? P.gold : P.goldD));
  }
  // lona celeste colgando del andamio (en las etapas del medio)
  if (L >= 2) for (let x = x0 + 1; x < Math.min(x1, x0 + 6); x++) for (let y = Math.max(2, cut - 5); y <= cut; y++) v.set(x, y, z1, (y + x) % 4 ? P.sky : P.skyD);
  // grúa amarilla atrás a la izquierda, con el brazo girando
  const cx = 1, cz = 1, CH = H + 6;
  v.box(cx, 1, cz, 1, CH, 1, (x, y) => (y % 2 ? C.yellow : P.goldD));
  v.box(cx, 1, cz, 2, 1, 2, P.stoneD);
  const arm = m.part('crane', [cx + 0.5, CH, cz + 0.5]);
  const len = Math.min(W - 4, 14);
  for (let i = -3; i <= len; i++) arm.set(cx + i, CH, cz, i % 2 ? C.yellow : P.goldD);
  arm.box(cx - 3, CH - 1, cz, 2, 2, 1, P.stoneD);
  arm.box(cx + len - 1, CH - 5, cz, 1, 5, 1, P.inkL);
  const id0 = MONUMENTS[id]?.stages[L]?.cost?.mats || MONUMENTS[id]?.stages[0]?.cost?.mats || {};
  const hang = MAT_COLORS[Object.keys(id0)[0]] || P.clay;
  arm.box(cx + len - 2, CH - 7, cz - 1, 3, 2, 3, (x, y, z) => ((x + y + z) % 2 ? hang : shade(hang, -0.15)));
  m.animate((parts, ph) => {
    const a = parts.crane[0];
    return (dt, t) => { a.rotation.y = Math.sin((t + ph) * 0.5) * 0.8 - 0.9; };
  });
  // pilas de materiales del monumento (los colores de cristales, ladrillos, tuercas y mapas)
  const mats = Object.keys(MONUMENTS[id]?.stages.reduce((o, s) => Object.assign(o, s.cost?.mats || {}), {}) || {});
  const spots = [[2, D - 4], [W - 6, D - 3], [2, D - 8], [W - 4, 3]];
  mats.slice(0, 4).forEach((mat, i) => {
    const [px, pz] = spots[i];
    const c = MAT_COLORS[mat] || P.clay;
    for (let dx = 0; dx < 3; dx++) for (let dz = 0; dz < 2; dz++) {
      if (v.has(px + dx, 1, pz + dz)) continue;
      v.set(px + dx, 1, pz + dz, (dx + dz) % 2 ? c : shade(c, -0.14));
      if (dx < 2) v.set(px + dx, 2, pz + dz, shade(c, 0.12));
    }
    if (mat === 'cristal') m.glow.set(px + 1, 3, pz, '#e4cfff');
  });
  // cinta rayada alrededor (donde hay lugar)
  for (let x = 0; x < W; x++) for (const z of [0, D - 1]) if (!v.has(x, 1, z) && !v.has(x, 2, z)) v.set(x, 2, z, Math.floor(x / 2) % 2 ? WHITE : P.clay);
  for (let z = 0; z < D; z++) for (const x of [0, W - 1]) if (!v.has(x, 1, z) && !v.has(x, 2, z)) v.set(x, 2, z, Math.floor(z / 2) % 2 ? WHITE : P.clay);
  // cartel de obra al frente: una pelotita por etapa (doradas las hechas)
  const sw = N * 2 + 1, sx = Math.max(1, Math.floor(W / 2 - sw / 2) - 4), sz = D - 2;
  v.box(sx, 1, sz, 1, 4, 1, P.woodD); v.box(sx + sw - 1, 1, sz, 1, 4, 1, P.woodD);
  v.box(sx, 4, sz, sw, 3, 1, P.cream);
  for (let i = 0; i < N; i++) v.set(sx + 1 + i * 2, 5, sz + 1, i < L ? P.gold : P.stoneD);
  m.height = Math.max(cut + 4, CH + 1);
}

// ======================= FARO =======================
// 3×3. Torre a rayas rojas y blancas sobre una roca, linterna encendida con un haz que gira, casita del farero y laguna.
function faro(m, done) {
  const v = m.v, W = 24, D = 24, cx = 11.5, cz = 11.5;
  lot(v, W, D, (x, z) => {
    const d = Math.hypot(x - cx, z - cz);
    if (d < 7.5) return (x + z) % 3 ? '#efe2c6' : '#e6d6b6';            // arena
    return (x * 3 + z * 5) % 7 === 0 ? P.grassD : P.grass;
  });
  // laguna adelante a la izquierda con un botecito
  for (let x = 0; x < 9; x++) for (let z = 15; z < D; z++) {
    const d = Math.hypot(x - 2, z - 22);
    if (d < 6.5) v.set(x, 1, z, d < 5 ? ((x + z) % 3 ? C.water : C.waterL) : (d < 5.8 ? P.stone : P.stoneD));
  }
  v.box(3, 2, 19, 3, 1, 2, P.wood); v.set(4, 3, 19, P.woodD); v.set(3, 2, 18, P.woodD);
  // roca/base de piedra
  v.cylinder(cx, 1, cz, 6.4, 1, P.stoneD);
  v.cylinder(cx, 2, cz, 5.6, 1, P.stone);
  const rr = rng(7);
  for (let i = 0; i < 10; i++) { const a = rr() * Math.PI * 2, d = 6 + rr() * 1.4; v.set(Math.round(cx + Math.cos(a) * d), 1, Math.round(cz + Math.sin(a) * d), rr() < 0.5 ? P.stoneD : '#c9bfb0'); }
  // torre que se afina, con franjas
  const T0 = 3, T1 = 30;
  for (let y = T0; y <= T1; y++) {
    const r = 4.7 - (y - T0) * 0.055;
    v.cylinder(cx, y, cz, r, 1, Math.floor((y - T0) / 4) % 2 ? WHITE : RED);
  }
  // puerta y ventanitas al frente
  const fz = Math.floor(cz + 4.6);
  for (let y = T0; y < T0 + 4; y++) for (const x of [11, 12]) v.set(x, y, fz, y === T0 + 3 ? P.woodD : P.wood);
  v.set(12, T0 + 1, fz + 1, P.gold);
  for (const y of [11, 19, 26]) { const z = Math.floor(cz + 4.7 - (y - T0) * 0.055); v.set(11, y, z, C.glassD); v.set(12, y, z, C.glassD); v.set(11, y + 1, z, GLASS); v.set(12, y + 1, z, GLASS); }
  // balcón con baranda
  v.cylinder(cx, 31, cz, 5.4, 1, '#5b6b7a');
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2, x = Math.round(cx + Math.cos(a) * 5), z = Math.round(cz + Math.sin(a) * 5);
    v.set(x, 32, z, i % 2 ? WHITE : '#5b6b7a');
  }
  // linterna: vidrio que se ve encendido de día y de noche
  for (let y = 32; y <= 35; y++) {
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2, x = Math.round(cx + Math.cos(a) * 2.6), z = Math.round(cz + Math.sin(a) * 2.6);
      if (i % 5 === 0) v.set(x, y, z, P.ink); else m.light.set(x, y, z, done ? '#fff3b0' : '#e8f4ff');
    }
  }
  // cúpula roja con bolita dorada
  cone(v, cx, 36, cz, 3.8, 4, RED, { trim: '#5b6b7a' });
  v.set(11, 40, 11, P.gold); v.set(12, 40, 12, P.gold); v.set(11, 41, 12, P.goldL);
  // casita del farero atrás a la derecha
  v.box(16, 1, 2, 6, 5, 5, CREAM);
  gable(v, 'x', 16, 21, 2, 6, 6, C.roofSky, { oh: 1, wall: CREAM, trim: WHITE });
  door(v, 'pz', 6, 17, 1, 2, 3, P.woodD);
  win(v, 'pz', 6, 20, 3, 1, 1, { sill: WHITE });
  v.box(20, 7, 4, 1, 3, 1, P.stoneD);
  // salvavidas y faroles
  for (const [x, z] of [[19, 19], [5, 4]]) lampPost(v, x, 1, z, 4, P.ink, m.light);
  if (done) {
    // haz de luz que gira
    const beam = m.part('beam', [cx + 0.5 - 0.5, 34.5, cz + 0.5 - 0.5], { mat: 'light', cast: false });
    for (let i = 3; i <= 11; i++) { beam.set(Math.floor(cx) + i, 34, 11, '#fff6c8'); beam.set(Math.floor(cx) - i + 1, 34, 12, '#fff6c8'); if (i > 6) { beam.set(Math.floor(cx) + i, 35, 11, '#fffbe2'); beam.set(Math.floor(cx) - i + 1, 35, 12, '#fffbe2'); } }
    m.animate((parts, ph) => { const b = parts.beam[0]; return (dt, t) => { b.rotation.y = (t + ph) * 0.9; }; });
    wavingFlag(m, 20, 9, 4, 3, 2, P.sky);
    sparkle(m, 4, 8, 20, '#ffffff', 2);
  }
}

// ======================= JARDÍN BOTÁNICO =======================
// 4×4. Gran invernadero de vidrio con nervaduras blancas, cupulita dorada, canteros, árboles y senderos.
function jardin(m, done) {
  const v = m.v, W = 32, D = 32, cx = 15.5, cz = 14.5;
  lot(v, W, D, (x, z) => ((x * 7 + z * 3) % 9 === 0 ? P.grassD : P.grass));
  // senderos de piedra en cruz
  for (let x = 0; x < W; x++) for (let z = 14; z <= 17; z++) v.set(x, 0, z, (x + z) % 3 ? C.stoneL : P.stone);
  for (let z = 0; z < D; z++) for (let x = 14; x <= 17; x++) v.set(x, 0, z, (x + z) % 3 ? C.stoneL : P.stone);
  // zócalo
  v.cylinder(cx, 1, cz, 11.6, 2, (x, y, z) => (y === 2 ? WHITE : P.stone));
  // cúpula de vidrio (cáscara) con nervaduras
  const R = 11.2;
  for (let x = 3; x <= 28; x++) for (let z = 2; z <= 27; z++) for (let y = 3; y <= 14; y++) {
    const d = Math.hypot(x - cx, (y - 3) * 1.05, z - cz);
    if (d > R || d < R - 1.4) continue;
    const rib = Math.round(x - cx) % 4 === 0 || Math.round(z - cz) % 4 === 0 || y === 3;
    v.set(x, y, z, rib ? WHITE : (y < 8 ? GLASS_G : GLASS));
  }
  // entrada: arco al frente
  const fz = Math.round(cz + R) - 1;
  for (let x = 14; x <= 17; x++) for (let y = 1; y <= 6; y++) for (let z = fz - 1; z <= fz + 2; z++) v.set(x, y, z, null);
  for (let y = 1; y <= 7; y++) { v.set(13, y, fz + 2, WHITE); v.set(18, y, fz + 2, WHITE); }
  for (let x = 13; x <= 18; x++) v.set(x, 7, fz + 2, x === 15 || x === 16 ? P.gold : WHITE);
  for (let x = 14; x <= 17; x++) for (let y = 1; y <= 5; y++) v.set(x, y, fz - 2, y === 3 && x === 16 ? P.gold : C.leafD);   // puerta verde
  // plantas que asoman adentro: palmera alta que sale por arriba
  v.box(15, 3, 13, 2, 12, 2, C.trunk);
  bush(v, 16, 14, 14, 3.4, C.leaf, null, 3);
  for (const [dx, dz] of [[-4, 0], [4, 0], [0, -4], [0, 4], [-3, 3], [3, -3]]) v.set(16 + dx, 17, 14 + dz, C.leafL);
  // cupulita dorada arriba
  v.cylinder(cx, 15, cz, 1.6, 2, P.gold);
  v.set(15, 17, 14, P.goldL); v.set(16, 18, 15, P.gold);
  // canteros con flores en las cuatro esquinas y árboles
  flowerBed(v, 1, 1, 1, 6, 4, 11);
  flowerBed(v, 25, 1, 1, 6, 4, 12);
  flowerBed(v, 1, 1, 26, 6, 5, 13);
  flowerBed(v, 25, 1, 26, 6, 5, 14);
  smallTree(v, 2, 1, 8, 5, 2.6, '#f4a6c0', 21, [WHITE]);
  smallTree(v, 29, 1, 8, 5, 2.6, C.leaf, 22, [C.red]);
  smallTree(v, 2, 1, 22, 4, 2.4, C.leaf, 23);
  smallTree(v, 29, 1, 22, 4, 2.4, '#f4a6c0', 24);
  // bancos al costado del sendero
  for (const x of [8, 22]) { v.box(x, 1, 19, 3, 1, 1, P.wood); v.box(x, 2, 20, 3, 1, 1, P.woodD); }
  for (const [x, z] of [[12, 20], [19, 20], [12, 9], [19, 9]]) lampPost(v, x, 1, z, 4, P.ink, m.light);
  if (done) {
    // mariposas y brillitos
    for (const [x, y, z, c] of [[5, 6, 4, P.berry], [27, 7, 5, C.yellow], [6, 5, 28, P.sky], [26, 6, 27, WHITE]]) sparkle(m, x, y, z, c, 2.2);
    spinStar(m, 15, 19, 14, P.gold, 1);
  }
}

// ======================= OBSERVATORIO =======================
// 3×3. Torre redonda blanca con cúpula plateada y su ranura, telescopio que se mueve, y un planeta con anillo.
function observatorio(m, done) {
  const v = m.v, W = 24, D = 24, cx = 11.5, cz = 10.5;
  lot(v, W, D, (x, z) => (Math.hypot(x - cx, z - cz) < 9.5 ? ((x + z) % 2 ? '#e4ddd2' : '#d8cfc2') : ((x * 5 + z) % 6 === 0 ? P.grassD : P.grass)));
  // escalinata al frente
  for (let i = 0; i < 3; i++) v.box(8, 1 + i, 19 - i, 8, 1, 1, i % 2 ? P.stone : C.stoneL);
  // cuerpo
  v.cylinder(cx, 1, cz, 8, 2, P.stoneD);
  v.cylinder(cx, 3, cz, 7.4, 9, (x, y, z) => (y === 11 ? P.slate : (y % 4 === 0 ? CREAM_B : WHITE)));
  // ventanas redondas en la fachada
  for (const [x, y] of [[8, 6], [15, 6], [11, 8]]) { const z = Math.round(cz + 7.1); v.set(x, y, z, C.glassD); v.set(x + 1, y, z, C.glassD); v.set(x, y + 1, z, GLASS); v.set(x + 1, y + 1, z, GLASS); }
  door(v, 'pz', 17, 10, 3, 4, 5, P.slateD, { frame: P.gold, glass: true });
  // cúpula plateada con ranura oscura de frente
  for (let x = 3; x <= 20; x++) for (let z = 2; z <= 19; z++) for (let y = 12; y <= 20; y++) {
    const d = Math.hypot(x - cx, (y - 12) * 1.1, z - cz);
    if (d > 7.9) continue;
    const slit = (x === 11 || x === 12) && z >= cz - 1;
    v.set(x, y, z, slit ? '#33405e' : ((Math.round(Math.atan2(z - cz, x - cx) * 4) % 2) ? '#dfe5ee' : '#c9d2df'));
  }
  // telescopio (se mueve despacito)
  const tel = m.part('scope', [12, 17, 11]);
  for (let i = 0; i < 9; i++) {
    const y = 17 + Math.round(i * 0.75), z = 11 + i;
    tel.box(11, y, z, 2, 2, 1, i >= 7 ? P.gold : (i % 3 === 0 ? P.goldD : '#4a5878'));
  }
  m.animate((parts, ph) => { const t0 = parts.scope[0]; return (dt, t) => { t0.rotation.y = Math.sin((t + ph) * 0.35) * 0.35; }; });
  // planeta con anillo adelante a la derecha
  v.box(19, 1, 19, 2, 2, 2, P.stoneD);
  v.sphere(19.5, 6, 19.5, 2.6, 2.6, 2.6, (x, y) => (y % 2 ? P.peach : P.clay));
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; v.set(Math.round(19.5 + Math.cos(a) * 4), 6, Math.round(19.5 + Math.sin(a) * 4), P.gold); }
  // arbustos
  for (const [x, z] of [[2, 3], [21, 3], [2, 18]]) bush(v, x, 1, z, 1.8, C.leaf, FLOWER_COLORS, x + z);
  if (done) {
    for (const [x, y, z, c] of [[4, 24, 6, P.goldL], [19, 26, 9, WHITE], [9, 28, 4, P.skyL], [16, 23, 2, P.goldL]]) sparkle(m, x, y, z, c, 1.8);
    spinStar(m, 11, 22, 10, P.gold, 0.8);
  }
}

// ======================= ESTADIO =======================
// 4×4. Óvalo con gradas de colores, cancha con líneas, torres de luz, banderas y marcador.
function estadio(m, done) {
  const v = m.v, W = 32, D = 32, cx = 15.5, cz = 15.5;
  lot(v, W, D, (x, z) => ((x + z) % 4 === 0 ? P.grassD : P.grass));
  const ai = 8.5, bi = 6, ao = 15, bo = 12.5;
  const SEATS = [P.clay, P.sky, P.gold, P.mint, P.berry, P.slate];
  const r = rng(5);
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    const dx = x - cx, dz = z - cz;
    const ein = Math.hypot(dx / ai, dz / bi), eout = Math.hypot(dx / ao, dz / bo);
    if (ein < 1) {   // cancha
      const lines = Math.abs(dx) < 0.6 || Math.abs(Math.hypot(dx, dz) - 2.5) < 0.5 || ein > 0.9;
      v.set(x, 1, z, lines ? WHITE : (Math.floor(x / 2) % 2 ? '#6fcf63' : '#5fbf55'));
      continue;
    }
    if (eout > 1) continue;
    // entrada al frente: túnel
    if (dz > 0 && Math.abs(dx) < 2.2) { v.set(x, 1, z, C.stoneL); continue; }
    const h = Math.max(1, Math.min(8, 1 + Math.floor((ein - 1) * 7.5)));
    const sector = Math.floor((Math.atan2(dz, dx) + Math.PI) / (Math.PI / 3)) % SEATS.length;
    for (let y = 1; y <= h; y++) v.set(x, y, z, y === h ? SEATS[sector] : (y % 2 ? CREAM : CREAM_B));
    if (eout > 0.93) for (let y = h + 1; y <= 10; y++) v.set(x, y, z, y === 10 ? P.gold : ((y + Math.round(Math.atan2(dz, dx) * 12)) % 5 === 0 ? CREAM_B : WHITE));
    // hinchada (cabecitas) cuando está terminado
    if (done && eout <= 0.93 && r() < 0.18) v.set(x, h + 1, z, pick(r, [P.peach, '#c98e66', '#ffe0cc', P.woodD]));
  }
  // arco del túnel
  for (let x = 13; x <= 18; x++) for (let y = 1; y <= 10; y++) { if (y <= 5 && x >= 14 && x <= 17) continue; v.set(x, y, 28, y === 10 ? P.gold : WHITE); }
  pattern(v, 'pz', 28, 13, 7, ['..XX..', '.XXXX.'], P.clay, 1);
  // arcos de fútbol
  for (const zz of [10, 21]) { v.box(14, 2, zz, 1, 2, 1, WHITE); v.box(17, 2, zz, 1, 2, 1, WHITE); v.box(14, 4, zz, 4, 1, 1, WHITE); }
  // torres de luz en las esquinas
  for (const [x, z] of [[1, 1], [30, 1], [1, 30], [30, 30]]) {
    v.box(x, 1, z, 1, 16, 1, '#8a96a8');
    v.box(x - 1, 17, z - (z > 15 ? 0 : 0), 3, 2, 1, P.ink);
    for (let i = -1; i <= 1; i++) m.light.set(x + i, 18, z + (z > 15 ? -1 : 1), done ? '#fff6c8' : '#e8eef6');
  }
  // marcador atrás
  v.box(11, 10, 2, 10, 6, 1, P.ink);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 && (i < 3 || i > 4)) (done ? m.light : v).set(12 + i, 11 + j, 3, done ? P.gold : '#55606e');
  v.box(15, 2, 2, 2, 8, 1, '#8a96a8');
  if (done) {
    for (const [x, z, c] of [[4, 6, P.clay], [27, 6, P.sky], [4, 25, P.mint], [27, 25, P.gold]]) { v.box(x, 10, z, 1, 6, 1, WHITE); wavingFlag(m, x, 13, z, 3, 2, c); }
    sparkle(m, 15, 20, 15, WHITE, 2);
  }
}

// ======================= MUSEO =======================
// 4×4. Fachada con columnas y frontón, cúpula de cobre, estandartes de colores y un dinosaurio de huesos en el pasto.
function museo(m, done) {
  const v = m.v, W = 32, D = 32;
  lot(v, W, D, (x, z) => (z >= 22 && x >= 5 && x <= 26 ? ((Math.floor(x / 2) + Math.floor(z / 2)) % 2 ? '#f0e8dc' : '#e4d9c7') : ((x * 3 + z * 7) % 8 === 0 ? P.grassD : P.grass)));
  // cuerpo
  const x0 = 4, x1 = 27, z0 = 5, z1 = 20, WH = 12;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = 1; y <= WH; y++) v.set(x, y, z, y <= 1 ? P.stoneD : (y % 3 === 0 ? CREAM_B : CREAM));
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) v.set(x, WH + 1, z, WHITE);
  for (const u of [6, 9, 22, 25]) win(v, 'pz', z1, u, 6, 2, 3, { arch: CREAM, archTop: WHITE });
  for (const u of [8, 12, 16]) { win(v, 'px', x1, u, 6, 2, 3, { sill: WHITE }); win(v, 'nx', x0, u, 6, 2, 3, { sill: WHITE }); }
  // escalinata
  for (let i = 0; i < 3; i++) v.box(9 - i, 1 + 0, 21 + i, 14 + i * 2, 3 - i, 1, i % 2 ? C.stoneL : P.stone);
  // pórtico: columnas y frontón
  v.box(8, 3, 21, 16, 1, 3, C.stoneL);
  for (const x of [9, 12, 15, 16, 19, 22]) for (let y = 4; y <= WH + 1; y++) v.set(x, y, 22, y === 4 || y === WH + 1 ? CREAM_B : WHITE);
  v.box(8, WH + 2, 20, 16, 1, 4, CREAM_B);
  gable(v, 'z', 8, 23, 20, 23, WH + 3, C.roofClay, { oh: 0, wall: CREAM, trim: WHITE });
  pattern(v, 'pz', 23, 14, WH + 4, ['XXXX', '.XX.'], P.gold, 1);
  door(v, 'pz', z1, 14, 2, 4, 6, P.woodD, { frame: P.gold });
  // estandartes entre columnas
  const BAN = [P.clay, P.slate, P.mint, P.berry];
  [10, 13, 18, 20].forEach((x, i) => { for (let y = 7; y <= 11; y++) v.set(x, y, 21, y === 7 ? shade(BAN[i], -0.15) : BAN[i]); v.set(x, 11, 21, P.gold); });
  // tambor y cúpula de cobre
  v.cylinder(15.5, WH + 2, 12.5, 5.2, 3, (x, y) => (y === WH + 4 ? WHITE : CREAM));
  for (let x = 9; x <= 22; x++) for (let z = 6; z <= 19; z++) for (let y = WH + 5; y <= WH + 11; y++) {
    const d = Math.hypot(x - 15.5, (y - WH - 5) * 1.05, z - 12.5);
    if (d > 5.6) continue;
    const rib = Math.round(Math.atan2(z - 12.5, x - 15.5) * 8 / Math.PI) % 2 === 0;   // nervaduras blancas: que se lea como cúpula
    v.set(x, y, z, rib ? WHITE : (y >= WH + 9 ? shade(COPPER, 0.12) : COPPER));
  }
  v.box(15, WH + 11, 12, 2, 2, 2, P.gold); v.set(15, WH + 13, 12, P.goldL);
  // dinosaurio de huesos en el pasto (adelante a la derecha)
  const B = '#f7f1e6', Bd = '#ddd3c2';
  v.box(27, 1, 26, 3, 1, 3, P.stoneD);
  for (let i = 0; i < 6; i++) v.set(25 + i, 6 - Math.abs(i - 2) * 0 + (i < 2 ? i : 0), 27, B);   // lomo
  for (let i = 0; i < 6; i++) v.set(24 + i, 6, 27, i % 2 ? Bd : B);
  for (const x of [25, 27, 29]) for (let y = 4; y <= 5; y++) v.set(x, y, 27, Bd);           // costillas
  for (const x of [25, 29]) v.box(x, 2, 27, 1, 2, 1, B);                                     // patas
  for (let i = 0; i < 4; i++) v.set(30 + (i > 1 ? 1 : 0), 6 + i, 27, B);                     // cuello
  v.box(30, 10, 27, 2, 1, 1, B); v.set(31, 10, 27, Bd);                                       // cabeza
  for (let i = 0; i < 3; i++) v.set(23 - i, 5 - i, 27, B);                                    // cola
  // arbolitos y faroles
  smallTree(v, 2, 1, 26, 4, 2.4, C.leaf, 31);
  smallTree(v, 2, 1, 2, 5, 2.6, C.leaf, 32);
  smallTree(v, 29, 1, 2, 5, 2.6, '#f4a6c0', 33);
  for (const x of [6, 25]) lampPost(v, x, 1, 25, 5, P.ink, m.light);
  if (done) {
    for (const [x, c] of [[6, P.clay], [25, P.slate]]) { v.box(x, WH + 2, 6, 1, 6, 1, WHITE); wavingFlag(m, x, WH + 5, 6, 3, 2, c); }
    sparkle(m, 15, WH + 16, 12, P.goldL, 1.8);
    sparkle(m, 26, 12, 27, WHITE, 2.4);
  }
}

// ======================= TORRE DEL RELOJ =======================
// 3×3. Torre alta de ladrillo y crema, relojes en las cuatro caras (las agujas se mueven), campanario y aguja dorada.
function torre_reloj(m, done) {
  const v = m.v, W = 24, D = 24;
  lot(v, W, D, (x, z) => {
    const d = Math.hypot(x - 11.5, z - 11.5);
    return d < 10.5 ? ((Math.floor(x / 2) + Math.floor(z / 2)) % 2 ? '#f0e8dc' : '#e4d9c7') : P.grass;
  });
  const x0 = 8, x1 = 15, z0 = 8, z1 = 15, TOP = 40;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = 1; y <= TOP; y++) {
    const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
    const brick = y <= 9;
    const clockBand = y >= 29 && y <= 38;   // franja azul detrás de los relojes: así la esfera blanca resalta
    v.set(x, y, z, corner ? WHITE : brick ? ((x + z + y) % 3 === 0 ? '#c27a56' : '#d98f6a') : clockBand ? (y === 29 || y === 38 ? P.slateD : P.slate) : (y % 4 === 0 ? CREAM_B : CREAM));
  }
  // cornisas
  for (const y of [10, 28, TOP]) for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = z0 - 1; z <= z1 + 1; z++) if (x < x0 || x > x1 || z < z0 || z > z1) v.set(x, y, z, y === TOP && done ? P.gold : WHITE);
  door(v, 'pz', z1, 10, 1, 4, 6, P.woodD, { frame: WHITE, glass: true });
  for (const y of [14, 20]) { win(v, 'pz', z1, 11, y, 2, 3, { arch: CREAM, archTop: WHITE }); win(v, 'px', x1, 11, y, 2, 3, { sill: WHITE }); win(v, 'nx', x0, 11, y, 2, 3, { sill: WHITE }); }
  // relojes en las 4 caras: esfera blanca grande con aro dorado y marcas; agujas animadas al frente y a la derecha
  const DIAL = ['..GGGG..', '.GWWWWG.', 'GWWIWWWG', 'GIWWWWIG', 'GWWWWWWG', 'GWWWWWWG', '.GWWIWG.', '..GGGG..'];
  for (const [face, plane] of [['pz', z1], ['nz', z0], ['px', x1], ['nx', x0]]) pattern(v, face, plane, 8, 30, DIAL, { G: P.gold, W: WHITE, I: P.inkL }, 1);
  for (const [face, plane, nm] of [['pz', z1, 'handF'], ['px', x1, 'handR']]) {
    const piv = face === 'pz' ? [12, 34, plane + 2.5] : [plane + 2.5, 34, 12];
    const h1 = m.part(nm, piv, { cast: false });
    for (let i = 1; i < 3; i++) fset(h1, face, plane, 11, 34 + i, 2, P.ink);          // aguja larga
    fset(h1, face, plane, 12, 34, 2, P.inkL);                                          // aguja corta
    fset(h1, face, plane, 11, 34, 2, P.goldD);                                         // eje
  }
  m.animate((parts, ph) => {
    const f = parts.handF?.[0], r = parts.handR?.[0];
    return (dt, t) => { if (f) f.rotation.z = -(t * 0.4 + ph); if (r) r.rotation.x = (t * 0.4 + ph); };
  });
  // campanario abierto con campana dorada
  for (let y = TOP + 1; y <= TOP + 6; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    const edge = x === x0 || x === x1 || z === z0 || z === z1;
    if (!edge) continue;
    const pillar = (x === x0 || x === x1 || x === 11 || x === 12) && (z === z0 || z === z1 || z === 11 || z === 12);
    if (pillar || y === TOP + 6) v.set(x, y, z, WHITE);
  }
  const bell = m.part('bell', [12, TOP + 5, 12]);
  bell.box(10, TOP + 2, 10, 4, 3, 4, P.gold); bell.box(11, TOP + 1, 11, 2, 1, 2, P.goldD); bell.set(11, TOP + 5, 11, P.goldD);
  m.animate((parts, ph) => { const b = parts.bell[0]; return (dt, t) => { b.rotation.x = Math.sin((t + ph) * 1.6) * 0.18; }; });
  // techo puntiagudo azul y aguja dorada
  v.pyramid(x0 - 1, TOP + 7, z0 - 1, 10, 10, C.roofSlate);
  v.box(11, TOP + 12, 11, 2, 4, 2, P.gold); v.set(11, TOP + 16, 11, P.goldL); v.set(12, TOP + 17, 12, P.gold);
  // bancos, faroles y canteros
  for (const [x, z] of [[3, 3], [19, 3], [3, 19], [19, 19]]) lampPost(v, x, 1, z, 5, P.ink, m.light);
  flowerBed(v, 4, 1, 7, 2, 10, 41); flowerBed(v, 18, 1, 7, 2, 10, 42);
  for (const x of [5, 16]) { v.box(x, 1, 20, 3, 1, 1, P.wood); v.box(x, 2, 21, 3, 1, 1, P.woodD); }
  if (done) {
    sparkle(m, 12, TOP + 20, 12, P.goldL, 1.6);
    for (const [x, z] of [[1, 12], [22, 12]]) { v.box(x, 1, z, 1, 9, 1, WHITE); wavingFlag(m, x, 7, z, 3, 2, x < 5 ? P.clay : P.sky); }
  }
}

export const MONUMENT_BUILDERS = {
  faro: staged('faro', faro),
  jardin: staged('jardin', jardin),
  observatorio: staged('observatorio', observatorio),
  estadio: staged('estadio', estadio),
  museo: staged('museo', museo),
  torre_reloj: staged('torre_reloj', torre_reloj),
};
