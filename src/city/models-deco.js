// Decoración y caminos. Las plantas se ven igual siempre; el mobiliario, las fuentes, los pedestales, la glorieta, las
// orillas y los caminos cambian de material con la época de la ciudad (DESIGN-CORE.md §4, tanda 3): el builder recibe
// (m, nivel, { era }) y toma los materiales de DS[era].
import {
  P, C, shade, lot, path, fbox, fset, pattern, HEART3, HEART5, STAR5, bush, smallTree, tulip, flower, flowerBed,
  sparkle, spinStar, crown, cone, rng, pick, uid, FLOWER_COLORS, clampEra,
} from './models-kit.js';
import { ERA_PALETTES as EP } from '../core/palette.js';

/** Materiales de la deco por época: madera, piedra, metal, piso de plaza, techo y luz. */
const DS = {
  1: { wood: EP.madera.plank, woodD: EP.madera.plankD, post: EP.madera.post, stone: EP.madera.stone, stoneD: EP.madera.stoneD, cap: '#b8afa2',
    metal: EP.madera.post, metalD: EP.madera.joint, floor: '#d3b78a', floorD: '#bf9f70', roof: EP.madera.thatch, roofD: EP.madera.thatchD, lamp: '#ffd27a', band: EP.madera.post },
  2: { wood: EP.madera.plankD, woodD: EP.piedra.beam, post: EP.piedra.stoneD, stone: EP.piedra.stone, stoneD: EP.piedra.stoneD, cap: EP.piedra.stoneL,
    metal: '#3b3634', metalD: '#2a2625', floor: EP.piedra.stoneL, floorD: '#b3aa98', roof: EP.piedra.slate, roofD: EP.piedra.slateD, lamp: '#ffe08a', band: EP.piedra.joint },
  3: { wood: '#9a6a40', woodD: '#7a5030', post: EP.ladrillo.frame, stone: EP.ladrillo.brick, stoneD: EP.ladrillo.brickD, cap: EP.ladrillo.cream,
    metal: EP.ladrillo.frame, metalD: '#2e4637', floor: '#ecdcbc', floorD: '#d9c6a3', roof: EP.ladrillo.tile, roofD: EP.ladrillo.tileD, lamp: '#fff0a8', band: EP.ladrillo.creamD },
  4: { wood: '#8a6440', woodD: '#6b4b2e', post: EP.hierro.black, stone: '#8e8a84', stoneD: '#76726c', cap: EP.hierro.iron,
    metal: EP.hierro.black, metalD: '#1f1c1b', floor: '#aaa59d', floorD: '#918c85', roof: EP.hierro.sheet, roofD: EP.hierro.sheetD, lamp: EP.hierro.lamp, band: P.goldD },
  5: { wood: '#b88a5e', woodD: '#9a7048', post: EP.vidrio.steel, stone: EP.vidrio.white, stoneD: '#dcd8cf', cap: EP.vidrio.steel,
    metal: EP.vidrio.steel, metalD: EP.vidrio.steelD, floor: '#ebe8e1', floorD: '#d8d4cb', roof: EP.vidrio.glass, roofD: EP.vidrio.glassD, lamp: '#ffffff', band: EP.vidrio.steelD },
};
const ds = (o) => DS[clampEra(o?.era)];

const S = 1 / 8;

// ---------- árboles y plantas ----------
function arbol(m) {
  const v = m.v;
  v.box(3, 0, 3, 2, 5, 2, C.trunk);
  v.set(5, 3, 4, C.trunk); v.set(2, 4, 3, C.trunk);
  v.set(2, 0, 3, C.trunkD); v.set(5, 0, 4, C.trunkD);
  const leaf = C.leaf;
  const col = (x, y, z) => (y >= 10 ? shade(leaf, 0.2) : y >= 8 ? ((x + z) % 3 === 0 ? shade(leaf, 0.2) : shade(leaf, 0.08)) : (x + y * 2 + z) % 5 === 0 ? C.leafD : leaf);
  v.sphere(3.5, 7, 3.5, 3.9, 2.8, 3.9, col);
  v.sphere(2, 8.5, 2.5, 2.3, 2, 2.3, col);
  v.sphere(5.5, 8.5, 5, 2.3, 2, 2.3, col);
  v.sphere(3.5, 10, 3.5, 2.4, 1.8, 2.4, col);
  v.sphere(5, 6, 1.5, 1.8, 1.5, 1.8, col);
  // manzanitas
  for (const [x, y, z] of [[7, 7, 4], [4, 6, 7], [0, 7, 3], [6, 9, 6], [2, 9, 5]]) if (v.has(x, y, z)) v.set(x, y, z, C.red);
  // pajarito que salta en la copa
  const b = m.part('bird', [4.5, 12, 4.5]);
  b.set(4, 12, 4, P.sky); b.set(4, 13, 4, P.sky); b.set(4, 12, 5, P.sky); b.set(4, 13, 5, C.orange); b.set(4, 12, 3, P.skyD); b.set(4, 14, 4, P.skyD);
  m.animate((parts, ph) => { const o = parts.bird[0], by = o.position.y; return (dt, t) => { const k = (t + ph) % 2.4; o.position.y = by + (k < 0.3 ? Math.sin(k / 0.3 * Math.PI) * 0.08 : 0); o.rotation.y = k < 1.2 ? 0.4 : -0.6; }; });
}
function arbusto(m) {
  const v = m.v;
  bush(v, 3.5, 0, 3.5, 3.1, C.leaf, null, 21);
  const r = rng(5);
  for (const [k, c] of [...v.map]) {
    const [x, y, z] = k.split(',').map(Number);
    const exposed = !v.has(x, y + 1, z) || !v.has(x + 1, y, z) || !v.has(x, y, z + 1) || !v.has(x - 1, y, z) || !v.has(x, y, z - 1);
    if (exposed && r() < 0.28) v.set(x, y, z, r() < 0.6 ? P.clay : (r() < 0.5 ? '#ffffff' : P.clayL));
  }
}
function cerezo(m) {
  const v = m.v;
  const bark = '#8a5a5a';
  v.box(3, 0, 3, 2, 4, 2, bark);
  v.set(5, 4, 4, bark); v.set(6, 5, 4, bark); v.set(2, 4, 3, bark); v.set(1, 5, 3, bark); v.set(3, 4, 5, bark);
  const pinks = [P.clayL, '#fde9d8', P.clay, '#ffffff'];
  const r = rng(9);
  const blob = (cx, cy, cz, rx, ry) => v.sphere(cx, cy, cz, rx, ry, rx, () => (r() < 0.12 ? '#ffffff' : r() < 0.35 ? P.clay : r() < 0.6 ? '#fde9d8' : P.clayL));
  blob(4, 7, 4, 3.4, 2.6); blob(6, 8, 3, 2.2, 1.8); blob(2, 8, 5, 2.3, 1.8); blob(4, 10, 4, 2.4, 1.6);
  // pétalos en el piso
  for (const [x, z] of [[2, 2], [5, 5], [2, 5], [5, 2]]) v.set(x, 0, z, '#fde9d8');
  // pétalos que caen
  for (let i = 0; i < 3; i++) {
    const p = m.part('petal', [2 + i * 2 + 0.5, 6, 6.5], { cast: false });
    p.set(2 + i * 2, 6, 6, i % 2 ? P.clayL : '#fde9d8');
  }
  m.animate((parts, ph) => {
    const arr = parts.petal, base = arr.map(o => o.position.clone());
    return (dt, t) => {
      for (let i = 0; i < arr.length; i++) {
        const k = ((t + ph) * 0.22 + i * 0.37) % 1, o = arr[i];
        o.position.set(base[i].x + Math.sin((t + i) * 2.2) * 0.12, base[i].y - k * 0.72, base[i].z + k * 0.15 * (i - 1));
        o.rotation.z = t * 2 + i;
        o.scale.setScalar(k > 0.9 ? (1 - k) * 10 : 1);
      }
    };
  });
}
function macetas(m, L, o) {
  const v = m.v, d = ds(o), e = clampEra(o?.era);
  // jardinera baja de la época (tablas, piedra, terracota, granito, hormigón), repleta de tulipanes
  const mat = e === 1 ? ((x, top) => (top ? d.post : x % 3 ? d.wood : d.woodD))
    : e === 3 ? ((x, top) => (top ? d.cap : x % 4 === 0 ? '#b86a48' : '#c97b55'))
    : ((x, top) => (top ? d.cap : x % 4 === 0 ? d.stoneD : d.stone));
  v.box(0, 0, 2, 8, 2, 4, (x, y, z) => mat(x, y === 1 && (z === 2 || z === 5 || x === 0 || x === 7)));
  v.box(1, 1, 3, 6, 1, 2, '#8a5a3a');
  const cols = [C.red, P.clay, C.yellow, P.slate, '#ffffff', P.peach, P.clay];
  let k = 0;
  for (const z of [3, 4]) for (let x = 1; x <= 6; x++) {
    const h = 2 + ((x + z) % 2);
    for (let j = 0; j < h; j++) v.set(x, 2 + j, z, j === 0 ? C.leafD : C.leaf);
    const c = cols[k++ % cols.length];
    v.set(x, 2 + h, z, c);
    if ((x + z) % 3 === 0) v.set(x, 3 + h, z, shade(c, 0.3));
  }
  // hojas que asoman por los costados
  v.set(0, 2, 3, C.leaf); v.set(7, 2, 4, C.leaf);
  // regadera menta
  v.box(5, 0, 6, 2, 2, 1, e >= 4 ? d.metal : P.mint); v.set(7, 1, 6, e >= 4 ? d.metalD : P.mintD); v.set(4, 2, 6, e >= 4 ? d.metalD : P.mintD);
}

// ---------- mobiliario ----------
function farol(m, L, o) {
  const v = m.v, d = ds(o), e = clampEra(o?.era);
  const lamp = m.part('lamp', [4, 11.5, 4], { mat: 'light', cast: false });
  if (e === 1) {          // poste de madera con farol de aceite colgado de un brazo
    v.box(2, 0, 2, 4, 1, 4, d.stone);
    v.box(3, 1, 3, 2, 12, 2, (x, y) => (y % 4 === 0 ? d.woodD : d.post));
    v.box(3, 13, 3, 4, 1, 2, d.post); v.box(6, 12, 3, 1, 1, 2, d.post);
    v.box(5, 9, 3, 3, 1, 2, d.metalD); v.box(5, 12, 3, 1, 1, 2, d.metalD);
    lamp.box(5, 10, 3, 3, 2, 2, d.lamp);
  } else if (e === 2) {   // base de piedra, columna de hierro y linterna
    v.box(1, 0, 1, 6, 1, 6, d.stoneD); v.box(2, 1, 2, 4, 2, 4, d.stone); v.box(2, 3, 2, 4, 1, 4, d.cap);
    v.box(3, 4, 3, 2, 6, 2, d.metal);
    v.box(2, 10, 2, 4, 1, 4, d.metalD);
    for (const [x, z] of [[2, 2], [5, 2], [2, 5], [5, 5]]) v.box(x, 11, z, 1, 3, 1, d.metal);
    v.box(2, 14, 2, 4, 1, 4, d.metal); v.box(3, 15, 3, 2, 1, 2, d.metalD);
    lamp.box(3, 11, 3, 2, 3, 2, d.lamp);
  } else if (e === 3) {   // farola de hierro forjado verde con canasta de flores
    v.box(2, 0, 2, 4, 1, 4, d.cap);
    v.box(3, 1, 3, 2, 1, 2, d.metal);
    v.box(3, 2, 3, 2, 7, 2, (x, y) => (y % 3 === 0 ? P.goldD : d.metal));
    v.box(2, 9, 2, 4, 1, 4, d.metalD);
    for (const [x, z] of [[2, 2], [5, 2], [2, 5], [5, 5]]) v.box(x, 10, z, 1, 3, 1, d.metal);
    v.box(2, 13, 2, 4, 1, 4, d.metal); v.box(3, 14, 3, 2, 1, 2, d.metal); v.set(3, 15, 3, P.goldD);
    lamp.box(3, 10, 3, 2, 3, 2, d.lamp);
    v.box(5, 8, 3, 2, 1, 1, d.metal); v.box(6, 6, 3, 1, 2, 1, d.metalD);
    v.box(6, 5, 2, 2, 1, 2, '#c97b55'); v.set(6, 6, 2, P.clay); v.set(7, 6, 3, C.leaf); v.set(7, 6, 2, '#ffffff');
  } else if (e === 4) {   // farol a gas de dos brazos
    v.box(2, 0, 2, 4, 1, 4, d.stone); v.box(3, 1, 3, 2, 2, 2, d.metalD);
    v.box(3, 3, 3, 2, 10, 2, d.metal);
    v.box(0, 12, 3, 8, 1, 2, d.metal);
    for (const x of [0, 6]) { v.box(x, 13, 3, 2, 1, 2, d.metalD); lamp.box(x, 10, 3, 2, 2, 2, d.lamp); v.box(x, 9, 3, 2, 1, 2, d.metalD); }
    v.set(3, 13, 3, P.goldD); v.set(4, 14, 4, d.metal);
  } else {                // columna fina de acero con cabezal de luz
    v.box(3, 0, 3, 2, 1, 2, d.stoneD);
    v.box(3, 1, 3, 2, 14, 2, (x, y) => (y === 3 ? d.metalD : d.metal));
    v.box(3, 15, 1, 2, 1, 6, d.metal);
    lamp.box(3, 14, 1, 2, 1, 2, d.lamp); lamp.box(3, 14, 5, 2, 1, 2, d.lamp);
  }
  m.animate((parts, ph) => { const p = parts.lamp[0]; return (dt, t) => { p.scale.setScalar(1 + Math.sin((t + ph) * 3) * 0.04); }; });
}
function banco(m, L, o) {
  const v = m.v, d = ds(o), e = clampEra(o?.era);
  if (e === 1) {          // medio tronco sobre dos tocones
    for (const x of [1, 5]) v.box(x, 0, 3, 2, 2, 2, (xx, y) => (y === 1 ? '#d8b98a' : d.woodD));
    v.box(0, 2, 3, 8, 1, 3, (x, y, z) => (z === 4 ? d.wood : d.woodD));
    v.box(0, 3, 4, 8, 1, 1, '#d8b98a');
    return;
  }
  if (e === 2) {          // losa de piedra sobre dos bloques
    for (const x of [1, 5]) v.box(x, 0, 3, 2, 2, 3, d.stoneD);
    v.box(0, 2, 3, 8, 1, 3, d.cap);
    v.box(0, 3, 3, 8, 2, 1, d.stone);
    return;
  }
  if (e === 5) {          // banco de hormigón con listones de madera
    v.box(0, 0, 3, 8, 2, 3, (x, y) => (y === 0 ? d.stoneD : d.stone));
    v.box(0, 2, 3, 8, 1, 3, (x) => (x % 2 ? d.wood : d.woodD));
    return;
  }
  // Ladrillo y Hierro: listones de madera con estructura de hierro (verde o negra)
  for (const x of [1, 6]) { v.box(x, 0, 3, 1, 3, 1, d.metal); v.box(x, 0, 5, 1, 2, 1, d.metal); v.box(x, 3, 3, 1, 3, 1, d.metal); v.box(x, 2, 3, 1, 1, 3, d.metal); }
  v.box(0, 2, 3, 8, 1, 3, (x, y, z) => (z % 2 ? d.wood : d.woodD));
  v.box(0, 4, 3, 8, 1, 1, d.wood); v.box(0, 5, 3, 8, 1, 1, d.woodD);
  if (e === 4) { v.set(0, 6, 3, P.goldD); v.set(7, 6, 3, P.goldD); }
}

// ---------- fuente de corazones ----------
function fuente(m, L, o) {
  const v = m.v, d = ds(o), e = clampEra(o?.era);
  const cx = 7.5, cz = 7.5;
  // piso de la plaza
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    const r = Math.hypot(x - cx, z - cz);
    if (r <= 7.9) v.set(x, 0, z, (x + z) % 2 ? d.floor : d.floorD);
  }
  // pileta con borde
  v.cylinder(cx, 1, cz, 6.6, 2, (x, y, z) => (Math.hypot(x - cx, z - cz) > 5.4 ? (y === 2 ? d.cap : d.stone) : C.waterD));
  for (const [k] of [...v.map]) { const [x, y, z] = k.split(',').map(Number); if (y === 2 && Math.hypot(x - cx, z - cz) <= 5.4) v.remove(x, y, z); }
  // agua (superficie animada)
  const water = m.part('water', [8, 2.5, 8], { cast: false });
  water.cylinder(cx, 2, cz, 5.4, 1, (x, y, z) => ((x * 3 + z) % 7 === 0 ? C.waterL : (x + z) % 2 ? C.water : '#9fe6ff'));
  // columna y plato superior
  v.cylinder(cx, 1, cz, 1.2, 6, (x, y) => (y % 2 ? d.cap : d.stoneD));
  v.cylinder(cx, 6, cz, 2.8, 1, d.cap);
  v.cylinder(cx, 7, cz, 2.8, 1, (x, y, z) => (Math.hypot(x - cx, z - cz) > 1.8 ? d.cap : C.water));
  // remate de la época: piña de madera, bola de piedra, jarrón con flores, pájaro de bronce, esfera de vidrio
  const heart = m.part('heart', [7.5, 10, 8], { mat: e === 5 ? 'glow' : 'std' });
  if (e === 1) { heart.box(7, 8, 7, 2, 3, 2, d.woodD); heart.box(6, 9, 6, 4, 1, 4, d.wood); heart.set(7, 11, 7, d.post); }
  else if (e === 2) heart.sphere(7.5, 9.5, 7.5, 1.6, 1.6, 1.6, d.cap);
  else if (e === 3) { heart.box(7, 8, 7, 2, 1, 2, d.cap); heart.box(6, 9, 6, 4, 2, 4, d.stone); heart.box(6, 11, 6, 4, 1, 4, d.cap); heart.set(7, 12, 7, C.leaf); heart.set(8, 12, 8, P.clay); }
  else if (e === 4) { heart.box(7, 8, 7, 2, 2, 2, P.goldD); heart.box(6, 10, 7, 4, 1, 2, P.gold); heart.box(7, 11, 7, 1, 1, 1, P.goldD); }
  else heart.sphere(7.5, 9.5, 7.5, 1.8, 1.8, 1.8, C.glass);
  // chorritos de agua
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const x = Math.round(cx + Math.cos(a) * 2.5), z = Math.round(cz + Math.sin(a) * 2.5);
    const d = m.part('jet', [x + 0.5, 7, z + 0.5], { cast: false });
    d.set(x, 7, z, C.waterL); d.set(x, 8, z, '#ffffff');
  }
  // corazoncitos en el borde
  for (const [x, z] of [[1, 7], [14, 8], [7, 1], [8, 14]]) v.set(x, 3, z, e >= 4 ? d.metal : d.band);
  // flores alrededor
  for (const [x, z] of [[0, 3], [15, 3], [0, 12], [15, 12], [3, 0], [12, 15]]) flower(v, x, 0, z, pick(rng(x * 7 + z), [P.clay, '#ffffff', C.yellow]), 1);
  m.animate((parts, ph) => {
    const w = parts.water[0], h = parts.heart[0], jets = parts.jet;
    const wy = w.position.y, hy = h.position.y, base = jets.map(j => j.position.clone());
    return (dt, t) => {
      const T = t + ph;
      w.position.y = wy + Math.sin(T * 2) * 0.012;
      w.rotation.y = T * 0.15;
      h.rotation.y = Math.sin(T * 0.8) * 0.6;
      h.position.y = hy + Math.sin(T * 1.6) * 0.04;
      for (let i = 0; i < jets.length; i++) {
        const k = (T * 0.9 + i * 0.25) % 1, j = jets[i];
        const dir = i * Math.PI / 2 + Math.PI / 4;
        j.position.set(base[i].x + Math.cos(dir) * k * 0.35, base[i].y + Math.sin(k * Math.PI) * 0.35 - k * 0.55, base[i].z + Math.sin(dir) * k * 0.35);
        j.scale.setScalar(k > 0.85 ? (1 - k) * 6 : 1);
      }
    };
  });
  m.height = 12;
}

// ---------- estatua real ----------
function estatua(m, L, o) {
  const v = m.v, d = ds(o), e = clampEra(o?.era);
  const marble = '#fcf9f5', marbleD = '#f2e9dc';
  // plaza circular con canteros
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    const r = Math.hypot(x - 7.5, z - 7.5);
    if (r <= 7.9) v.set(x, 0, z, r > 6.2 ? P.grassL : (x + z) % 2 ? d.floor : d.floorD);
  }
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; flower(v, Math.round(7.5 + Math.cos(a) * 6.8), 1, Math.round(7.5 + Math.sin(a) * 6.8), FLOWER_COLORS[i % 5], 0); }
  // pedestal escalonado
  // pedestal de la época: tronco labrado, piedra, ladrillo con cornisa, granito con bronce, cubo blanco
  v.box(3, 1, 3, 10, 1, 10, e === 1 ? d.stone : d.cap);
  v.box(4, 2, 4, 8, 3, 8, e === 1 ? ((x, y) => (y === 3 ? d.woodD : d.wood)) : e === 3 ? ((x, y) => (y === 3 ? EP.ladrillo.joint : d.stone)) : e === 4 ? d.stoneD : d.stone);
  v.box(4, 5, 4, 8, 1, 8, e === 4 ? P.gold : d.cap);
  fbox(v, 'pz', 11, 6, 3, 4, 2, 1, e === 1 ? d.post : P.gold); // placa
  fbox(v, 'pz', 12, 7, 3, 2, 1, 0, P.goldD);
  // fundador/a del pueblo en mármol: levanta el brazo saludando y lleva el plano de la ciudad
  const y0 = 6;
  v.box(6, y0, 7, 1, 4, 2, marbleD); v.box(9, y0, 7, 1, 4, 2, marbleD);            // piernas
  v.box(6, y0, 9, 1, 1, 1, marble); v.box(9, y0, 9, 1, 1, 1, marble);              // zapatos
  v.box(5, y0 + 3, 6, 6, 2, 4, marble);                                            // faldón del saco
  v.box(6, y0 + 5, 6, 4, 4, 3, marble);                                            // torso
  v.box(7, y0 + 5, 9, 2, 3, 1, marbleD);                                           // solapa
  v.set(7, y0 + 6, 9, P.goldL); v.set(7, y0 + 4, 9, P.goldL);                       // botones
  v.box(5, y0 + 5, 7, 1, 4, 1, marble); v.box(4, y0 + 4, 7, 2, 1, 2, P.goldL);      // brazo con el plano enrollado
  v.box(10, y0 + 8, 7, 1, 4, 1, marble); v.set(10, y0 + 12, 7, marble);             // brazo saludando
  v.box(7, y0 + 9, 7, 2, 1, 1, marbleD);                                           // cuello
  v.sphere(7.5, y0 + 11, 7.5, 2, 2, 2, marble);                                    // cabeza
  v.set(6, y0 + 11, 9, P.inkL); v.set(9, y0 + 11, 9, P.inkL);                       // ojitos
  v.box(5, y0 + 13, 5, 6, 1, 6, marbleD);                                          // ala del sombrero
  v.box(6, y0 + 14, 6, 4, 2, 4, marbleD); v.box(6, y0 + 14, 6, 4, 1, 4, P.gold);    // copa con cinta
  m.height = y0 + 17;
  sparkle(m, 3, y0 + 11, 10, '#ffffff', 2.2); sparkle(m, 11, y0 + 6, 6, P.goldL, 2.8);
}

// ---------- glorieta ----------
function glorieta(m, L, o) {
  const v = m.v, d = ds(o), e = clampEra(o?.era);
  const post = e === 3 ? '#ffffff' : e === 2 ? d.cap : d.post;
  const cx = 7.5, cz = 7.5;
  // piso octogonal elevado con escalón
  v.cylinder(cx, 0, cz, 7.4, 1, (x, y, z) => ((x + z) % 2 ? d.cap : d.floorD));
  v.cylinder(cx, 1, cz, 6.4, 1, (x, y, z) => (Math.hypot(x - cx, z - cz) > 5.4 ? d.cap : (x + z) % 2 ? d.floor : d.floorD));
  for (let x = 6; x <= 9; x++) v.set(x, 1, 14, d.cap);
  // postes con enredaderas
  const posts = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; posts.push([Math.round(cx + Math.cos(a) * 5.2), Math.round(cz + Math.sin(a) * 5.2)]); }
  for (const [x, z] of posts) {
    v.box(x, 2, z, 1, 8, 1, post);
    for (let y = 2; y < 10; y += 2) v.set(x + (y % 4 ? 1 : 0), y, z + (y % 4 ? 0 : 1), C.leaf);
    v.set(x, 5, z + 1, P.clay); v.set(x + 1, 7, z, '#ffffff'); v.set(x, 3, z + 1, C.red);
  }
  // baranda baja entre postes (dejando la entrada)
  for (let i = 0; i < 6; i++) {
    const [ax, az] = posts[i], [bx, bz] = posts[(i + 1) % 6];
    if ((az + bz) / 2 > 11) continue; // frente abierto
    for (let k = 1; k < 6; k++) { const x = Math.round(ax + (bx - ax) * k / 6), z = Math.round(az + (bz - az) * k / 6); v.set(x, 4, z, post); if (k % 2) v.set(x, 3, z, post); }
  }
  // techo cebolla lila con borde blanco
  // techo de la época: paja, pizarra, tejas, chapa (kiosco de hierro) o vidrio
  v.cylinder(cx, 10, cz, 6.8, 1, e === 3 ? '#ffffff' : d.cap);
  for (let j = 0; j < 7; j++) v.cylinder(cx, 11 + j, cz, Math.max(0.6, 6.2 - j * 0.85 - (j > 4 ? 0.6 : 0)), 1, j % 2 ? d.roofD : d.roof);
  v.box(7, 18, 7, 2, 2, 2, e === 1 ? d.post : e === 5 ? d.metal : P.gold); v.set(7, 20, 7, e === 1 ? d.roofD : e >= 4 ? d.metal : P.clay);
  // banco interior y farolito colgante
  v.box(4, 2, 4, 8, 1, 2, d.wood); v.box(4, 3, 4, 8, 2, 1, d.woodD);
  v.box(7, 9, 7, 1, 1, 1, P.gold); m.light.set(7, 8, 7, C.yellow);
  for (const [x, z] of [[1, 14], [14, 14]]) bush(v, x, 1, z, 1.2, C.leaf, [P.clay, '#ffffff'], x);
  m.height = 21;
}

// ---------- arco de rosas ----------
function arcoRosas(m, L, o) {
  const v = m.v, d = ds(o);
  for (let z = 0; z < 8; z++) for (let x = 2; x <= 5; x++) v.set(x, 0, z, (x + z) % 3 === 0 ? d.floorD : d.floor);
  const r = rng(13);
  const rose = () => (r() < 0.45 ? P.clay : r() < 0.5 ? C.red : '#ffffff');
  for (const x of [0, 7]) {
    v.box(x, 0, 3, 1, 1, 2, d.post);
    for (let y = 1; y <= 8; y++) for (let z = 3; z <= 4; z++) v.set(x, y, z, r() < 0.35 ? rose() : (r() < 0.5 ? C.leaf : C.leafD));
  }
  for (let x = 0; x <= 7; x++) {
    const y = 9 + (x >= 2 && x <= 5 ? 1 : 0);
    for (let z = 3; z <= 4; z++) { v.set(x, y, z, r() < 0.4 ? rose() : C.leaf); if (x >= 1 && x <= 6) v.set(x, y - 1, z, r() < 0.3 ? rose() : C.leafD); }
  }
  v.set(3, 11, 3, P.clay); v.set(4, 11, 4, C.red);
  v.box(2, 8, 3, 4, 1, 2, d.cap);
  pattern(v, 'pz', 5, 3, 7, ['XX'], P.clay);
  m.height = 12;
}

// ---------- unicornio ----------
function unicornio(m) {
  const v = m.v;
  const body = '#fefcf9', bodyD = '#f9f2e7';
  // pedestal ovalado con nubecitas
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) { const d = Math.hypot((x - 7.5) / 7.8, (z - 7.5) / 7.8); if (d <= 1) v.set(x, 0, z, (x + z) % 2 ? '#fbf7f0' : '#f7eee0'); }
  v.cylinder(7.5, 1, 7.5, 5.5, 2, (x, y) => (y === 2 ? P.slateL : P.slate));
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; v.sphere(7.5 + Math.cos(a) * 6.4, 1.2, 7.5 + Math.sin(a) * 6.4, 1.3, 1, 1.3, '#ffffff'); }
  const y0 = 3;
  // patas (cascos dorados)
  for (const [x, z] of [[6, 4], [9, 4], [6, 9], [9, 9]]) { v.set(x, y0, z, P.gold); v.box(x, y0 + 1, z, 1, 3, 1, body); }
  // cuerpo
  v.box(5, y0 + 4, 4, 6, 4, 7, (x, y, z) => (y === y0 + 4 ? bodyD : body));
  // cuello y cabeza (mirando a +z)
  v.box(6, y0 + 8, 9, 4, 4, 2, body);
  v.box(6, y0 + 11, 10, 4, 3, 4, body);
  v.box(7, y0 + 11, 14, 2, 2, 1, P.clayL); // hocico
  v.set(6, y0 + 13, 12, P.ink); v.set(9, y0 + 13, 12, P.ink); v.set(6, y0 + 12, 12, P.clayL); v.set(9, y0 + 12, 12, P.clayL);
  v.set(6, y0 + 14, 10, body); v.set(9, y0 + 14, 10, body); // orejas
  // cuerno dorado en espiral
  for (let j = 0; j < 4; j++) v.set(7 + (j > 1 ? 1 : 0), y0 + 14 + j, 12 - (j > 2 ? 1 : 0), j % 2 ? P.goldL : P.gold);
  // crin y cola arcoíris
  const rb = ['#ff7a8a', '#ffb38a', '#ffe066', '#7fe3a8', '#8fd3ff', '#9fb5e9'];
  for (let j = 0; j < 6; j++) { v.box(7, y0 + 8 + j, 8 + (j > 2 ? 1 : 0), 2, 1, 1, rb[j]); }
  v.box(7, y0 + 14, 9, 2, 1, 2, rb[5]);
  for (let j = 0; j < 6; j++) v.box(7, y0 + 7 - Math.floor(j / 2), 3 - (j > 1 ? 1 : 0) - (j > 3 ? 1 : 0), 2, 1, 1, rb[j]);
  // brillitos que giran alrededor
  const ring = m.part('ring', [8, 12, 8], { mat: 'light', cast: false });
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const x = Math.round(8 + Math.cos(a) * 7), z = Math.round(8 + Math.sin(a) * 7); ring.set(x, 12 + i * 2, z, i === 1 ? P.clayL : '#fff6b0'); ring.set(x, 13 + i * 2, z, '#ffffff'); }
  m.animate((parts, ph) => { const o = parts.ring[0]; return (dt, t) => { o.rotation.y = (t + ph) * 0.7; }; });
  m.height = y0 + 19;
}

// ---------- lago de patitos ----------
function lago(m, L, o) {
  const v = m.v, d = ds(o), e = clampEra(o?.era);
  const cx = 11.5, cz = 11.5;
  const shape = (x, z) => { const a = Math.atan2(z - cz, x - cx); const rr = 9.4 + Math.sin(a * 3) * 0.9 + Math.cos(a * 2) * 0.6; return Math.hypot(x - cx, z - cz) / rr; };
  for (let x = 0; x < 24; x++) for (let z = 0; z < 24; z++) {
    const r = shape(x, z);
    if (r < 0.86) v.set(x, 0, z, r < 0.55 ? C.waterD : C.water);
    else if (r < 1) { v.set(x, 0, z, P.sand || '#f3e2c0'); v.set(x, 1, z, e === 1 ? ((x + z) % 3 === 0 ? '#ddd5c8' : '#a2e589') : (x + z) % 3 === 0 ? d.stoneD : d.cap); }
    else v.set(x, 0, z, (x + z) % 2 ? '#a2e589' : '#99e07f');
  }
  // reflejos del agua (superficie animada)
  const shine = m.part('shine', [12, 0, 12], { mat: 'light', cast: false });
  for (const [x, z] of [[8, 8], [9, 8], [15, 13], [16, 13], [11, 16], [6, 13]]) shine.set(x, 0, z, '#e8fbff');
  // nenúfares
  for (const [x, z] of [[6, 10], [15, 7], [17, 15]]) { v.box(x, 0, z, 2, 1, 2, C.leaf); v.set(x, 1, z, P.clay); }
  // juncos
  for (const [x, z] of [[3, 15], [4, 16], [20, 6], [19, 5], [21, 8]]) { v.box(x, 1, z, 1, 3, 1, C.leafD); v.set(x, 4, z, P.woodD); }
  // muellecito de madera
  v.box(17, 1, 17, 4, 1, 6, (x, y, z) => (e === 5 ? (z % 2 ? d.stone : d.stoneD) : z % 2 ? d.wood : d.woodD));
  for (const [x, z] of [[17, 17], [20, 17]]) v.box(x, 0, z, 1, 2, 1, e >= 4 ? d.metal : d.post);
  // piedras y flores en la orilla
  for (const [x, z] of [[2, 6], [10, 2], [21, 12], [8, 21]]) { v.set(x, 2, z, '#efe7dc'); v.set(x + 1, 2, z, '#ddd5c8'); }
  flowerBed(v, 0, 1, 0, 3, 3, 4); flowerBed(v, 21, 1, 21, 3, 3, 8);
  // patitos (mamá + 3 bebés) que nadan en círculo
  const duck = (p, x, z, big) => {
    if (big) {
      p.box(x, 1, z, 3, 2, 4, '#ffffff'); p.box(x, 3, z + 3, 2, 2, 2, '#ffffff'); p.set(x + 2, 3, z + 3, '#ffffff');
      p.set(x, 4, z + 4, P.ink); p.set(x + 1, 4, z + 4, '#ffffff'); p.box(x, 3, z + 5, 2, 1, 1, C.orange); p.set(x + 1, 3, z, '#f8f3ec'); p.set(x + 1, 2, z - 1, '#ffffff');
    } else {
      p.box(x, 1, z, 2, 1, 2, C.yellow); p.box(x, 2, z + 1, 1, 1, 1, C.yellow); p.set(x, 2, z + 2, C.orange); p.set(x + 1, 2, z, '#ffe999');
    }
  };
  const mom = m.part('duck', [12, 0, 12]); duck(mom, 11, 10, true);
  for (let i = 0; i < 3; i++) { const p = m.part('duck', [12, 0, 12]); duck(p, 11, 11, false); }
  m.animate((parts, ph) => {
    const ds = parts.duck, sh = parts.shine[0];
    const RR = 5.2 * S;
    return (dt, t) => {
      const T = (t + ph) * 0.35;
      for (let i = 0; i < ds.length; i++) {
        const a = T - i * 0.55 - (i ? 0.2 : 0);
        const r = RR + (i % 2 ? 0.05 : 0);
        const d = ds[i];
        d.position.set(Math.cos(a) * r, Math.sin((t + i) * 3) * 0.012, Math.sin(a) * r);
        d.rotation.y = -a; // tangente
        d.rotation.z = Math.sin((t + i) * 2.5) * 0.06;
      }
      sh.visible = Math.sin((t + ph) * 1.7) > -0.4;
    };
  });
  m.height = 6;
}

// ---------- caminos (1 vóxel, cubren el tile) ----------
// Camino de Piedra: tierra con lajas (Madera) · lajas irregulares (Piedra) · adoquín parejo (Ladrillo) ·
// adoquín de granito con cordón (Hierro) · baldosones de hormigón (Vidrio y acero).
const hashT = (x, z, s = 1) => (((x * 73856093) ^ (z * 19349663) ^ (s * 83492791)) >>> 0) % 97 / 97;
function camino(m, L, o) {
  const v = m.v, e = clampEra(o?.era);
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) {
    let c;
    if (e === 1) {
      const slab = (Math.floor(x / 3) + Math.floor(z / 3) * 2) % 3 === 0 && x % 3 !== 2 && z % 3 !== 2;
      c = slab ? (hashT(x, z) < 0.5 ? '#b8afa2' : '#a89f92') : hashT(x, z) < 0.2 ? '#a88a62' : '#c2a477';
    } else if (e === 2) {
      const row = Math.floor(z / 3), off = row % 2 ? 1 : 0;
      const edge = (x + off) % 4 === 3 || z % 3 === 2;
      c = edge ? '#8c8375' : ['#c4bba9', '#b8af9d', '#cfc6b4'][Math.floor((x + off) / 4 + row) % 3];
    } else if (e === 3) {
      const off = Math.floor(z / 2) % 2 ? 1 : 0;
      c = z % 2 === 1 || (x + off) % 3 === 2 ? '#c9b99c' : (Math.floor((x + off) / 3) + z) % 3 ? '#e4d6bb' : '#d9caae';
    } else if (e === 4) {
      const off = z % 2 ? 1 : 0;
      c = (x + off) % 2 ? '#7d7a76' : hashT(x, z) < 0.3 ? '#6a6763' : '#8e8a84';
    } else {
      c = x % 4 === 3 || z % 4 === 3 ? '#cfcbc2' : (Math.floor(x / 4) + Math.floor(z / 4)) % 2 ? '#ebe8e1' : '#e2ded6';
    }
    v.set(x, 0, z, c);
  }
}
// Camino de Ladrillo: ladrillo tosco a soga (Madera, Piedra) · espina de pez (Ladrillo) · ladrillo oscuro industrial
// (Hierro) · adoquín rojo de hormigón (Vidrio y acero).
function caminoRosa(m, L, o) {
  const v = m.v, e = clampEra(o?.era);
  const B = e === 4 ? ['#8f5a44', '#7a4a38', '#5e3a2c'] : e === 5 ? ['#c06a52', '#b05f48', '#e3d9cc'] : e === 3 ? ['#c4704d', '#b5603f', '#e8d6b8'] : ['#c27a55', '#ad6a48', '#d8c3a5'];
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) {
    let c;
    if (e === 3) {                                          // espina de pez
      const k = (x + z) % 4, joint = (x - z + 16) % 4 === 0;
      c = joint ? B[2] : k < 2 ? B[0] : B[1];
    } else if (e === 5) {
      c = x % 4 === 3 || z % 2 === 1 && x % 4 === 1 ? B[2] : (Math.floor(x / 4) + z) % 2 ? B[0] : B[1];
    } else {                                                // a soga
      const off = Math.floor(z / 2) % 2 ? 2 : 0;
      c = z % 2 === 1 || (x + off) % 4 === 3 ? B[2] : (Math.floor((x + off) / 4) + Math.floor(z / 2)) % 2 ? B[0] : B[1];
    }
    v.set(x, 0, z, c);
  }
}
// Camino Dorado: siempre dorado; cambian las juntas (madera, piedra, crema, bronce, acero) y en Hierro y Vidrio y acero
// lleva luces al ras.
function caminoDorado(m, L, o) {
  const v = m.v, e = clampEra(o?.era);
  const J = [EP.madera.plankD, EP.piedra.joint, EP.ladrillo.cream, P.goldD, EP.vidrio.steel][e - 1];
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) {
    const ex = x % 4 === 3, ez = z % 4 === 3;
    const tile = (Math.floor(x / 4) + Math.floor(z / 4)) % 2;
    let c = ex || ez ? J : tile ? P.gold : '#ffdb85';
    if (!ex && !ez && x % 4 === 0 && z % 4 === 0) c = P.goldL;
    v.set(x, 0, z, c);
  }
  if (e >= 4) { m.light.set(3, 0, 3, '#fff6d0'); m.light.set(7, 0, 7, '#fff6d0'); }
  else { m.light.set(1, 0, 5, '#fff6d0'); m.light.set(5, 0, 1, '#fff6d0'); }
}

export const DECO_BUILDERS = {
  arbol, arbusto, farol, banco, cerezo, fuente, macetas, estatua, glorieta, arco_rosas: arcoRosas, unicornio, lago,
  camino, camino_rosa: caminoRosa, camino_dorado: caminoDorado,
};
