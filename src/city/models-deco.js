// Decoración y caminos.
import {
  P, C, shade, lot, path, fbox, fset, pattern, HEART3, HEART5, STAR5, bush, smallTree, tulip, flower, flowerBed,
  sparkle, spinStar, crown, cone, rng, pick, uid, FLOWER_COLORS,
} from './models-kit.js';

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
function macetas(m) {
  const v = m.v;
  // jardinera rosa baja, repleta de tulipanes de colores
  v.box(0, 0, 2, 8, 2, 4, (x, y, z) => (y === 1 && (z === 2 || z === 5 || x === 0 || x === 7) ? '#ffffff' : (x + y) % 4 === 0 ? P.clayL : '#fde8d5'));
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
  v.box(5, 0, 6, 2, 2, 1, P.mint); v.set(7, 1, 6, P.mintD); v.set(4, 2, 6, P.mintD);
}

// ---------- mobiliario ----------
function farol(m) {
  const v = m.v;
  v.box(2, 0, 2, 4, 1, 4, C.stoneL);
  v.box(3, 1, 3, 2, 1, 2, '#6076aa');
  v.box(3, 2, 3, 2, 7, 2, (x, y) => (y % 3 === 0 ? P.gold : '#6076aa'));
  // linterna
  v.box(2, 9, 2, 4, 1, 4, P.goldD);
  for (const [x, z] of [[2, 2], [5, 2], [2, 5], [5, 5]]) v.box(x, 10, z, 1, 3, 1, P.gold);
  v.box(2, 13, 2, 4, 1, 4, '#6076aa'); v.box(3, 14, 3, 2, 1, 2, '#6076aa'); v.set(3, 15, 3, P.gold); v.set(4, 15, 4, P.gold);
  const lamp = m.part('lamp', [4, 11.5, 4], { mat: 'light', cast: false });
  lamp.box(3, 10, 3, 2, 3, 2, '#fff2a8');
  lamp.box(3, 10, 2, 2, 3, 1, '#ffe066'); lamp.box(3, 10, 5, 2, 3, 1, '#ffe066'); lamp.box(2, 10, 3, 1, 3, 2, '#ffe066'); lamp.box(5, 10, 3, 1, 3, 2, '#ffe066');
  // canasta de flores colgando
  v.box(5, 8, 3, 2, 1, 1, P.gold); v.box(6, 6, 3, 1, 2, 1, P.goldD);
  v.box(6, 5, 2, 2, 1, 2, P.wood); v.set(6, 6, 2, P.clay); v.set(7, 6, 3, C.leaf); v.set(7, 6, 2, '#ffffff');
  m.animate((parts, ph) => { const o = parts.lamp[0]; return (dt, t) => { o.scale.setScalar(1 + Math.sin((t + ph) * 3) * 0.04); }; });
}
function banco(m) {
  const v = m.v;
  // patas y respaldo
  for (const x of [1, 6]) { v.box(x, 0, 3, 1, 3, 1, P.inkL); v.box(x, 0, 5, 1, 2, 1, P.inkL); v.box(x, 3, 3, 1, 3, 1, P.inkL); v.box(x, 2, 3, 1, 1, 3, P.inkL); }
  v.box(0, 2, 3, 8, 1, 3, (x, y, z) => (z % 2 ? P.clay : P.clayL)); // asiento
  v.box(0, 4, 3, 8, 1, 1, P.clay); v.box(0, 5, 3, 8, 1, 1, P.clayL); // respaldo
  v.set(0, 6, 3, P.gold); v.set(7, 6, 3, P.gold);
  // almohadón y florcitas
  v.box(2, 3, 4, 2, 1, 1, P.slateL); v.set(2, 3, 3, P.slate);
}

// ---------- fuente de corazones ----------
function fuente(m) {
  const v = m.v;
  const cx = 7.5, cz = 7.5;
  // piso de piedra
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    const d = Math.hypot(x - cx, z - cz);
    if (d <= 7.9) v.set(x, 0, z, (x + z) % 2 ? '#fbf7f0' : '#f4ede2');
  }
  // pileta con borde
  v.cylinder(cx, 1, cz, 6.6, 2, (x, y, z) => (Math.hypot(x - cx, z - cz) > 5.4 ? (y === 2 ? '#ffffff' : C.stoneL) : C.waterD));
  for (const [k] of [...v.map]) { const [x, y, z] = k.split(',').map(Number); if (y === 2 && Math.hypot(x - cx, z - cz) <= 5.4) v.remove(x, y, z); }
  // agua (superficie animada)
  const water = m.part('water', [8, 2.5, 8], { cast: false });
  water.cylinder(cx, 2, cz, 5.4, 1, (x, y, z) => ((x * 3 + z) % 7 === 0 ? C.waterL : (x + z) % 2 ? C.water : '#9fe6ff'));
  // columna y plato superior
  v.cylinder(cx, 1, cz, 1.2, 6, (x, y) => (y % 2 ? '#ffffff' : P.clayL));
  v.cylinder(cx, 6, cz, 2.8, 1, '#ffffff');
  v.cylinder(cx, 7, cz, 2.8, 1, (x, y, z) => (Math.hypot(x - cx, z - cz) > 1.8 ? '#ffffff' : C.water));
  // corazón rosa arriba de todo
  const heart = m.part('heart', [7.5, 10, 8], { mat: 'glow' });
  for (const z of [7, 8]) pattern(heart, 'pz', z, 5, 8, HEART5, P.clay);
  pattern(heart, 'pz', 8, 6, 11, ['X'], '#ffffff');
  // chorritos de agua
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const x = Math.round(cx + Math.cos(a) * 2.5), z = Math.round(cz + Math.sin(a) * 2.5);
    const d = m.part('jet', [x + 0.5, 7, z + 0.5], { cast: false });
    d.set(x, 7, z, C.waterL); d.set(x, 8, z, '#ffffff');
  }
  // corazoncitos en el borde
  for (const [x, z] of [[1, 7], [14, 8], [7, 1], [8, 14]]) v.set(x, 3, z, P.clay);
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
function estatua(m) {
  const v = m.v;
  const marble = '#fcf9f5', marbleD = '#f2e9dc';
  // plaza circular con canteros
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    const d = Math.hypot(x - 7.5, z - 7.5);
    if (d <= 7.9) v.set(x, 0, z, d > 6.2 ? P.grassL : (x + z) % 2 ? '#fdf6e3' : '#f6e7d6');
  }
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; flower(v, Math.round(7.5 + Math.cos(a) * 6.8), 1, Math.round(7.5 + Math.sin(a) * 6.8), FLOWER_COLORS[i % 5], 0); }
  // pedestal escalonado
  v.box(3, 1, 3, 10, 1, 10, C.stoneL);
  v.box(4, 2, 4, 8, 3, 8, marbleD);
  v.box(4, 5, 4, 8, 1, 8, P.gold);
  fbox(v, 'pz', 11, 6, 3, 4, 2, 1, P.gold); // placa
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
function glorieta(m) {
  const v = m.v;
  const cx = 7.5, cz = 7.5;
  // piso octogonal elevado con escalón
  v.cylinder(cx, 0, cz, 7.4, 1, (x, y, z) => ((x + z) % 2 ? '#ffffff' : '#faf5ee'));
  v.cylinder(cx, 1, cz, 6.4, 1, (x, y, z) => (Math.hypot(x - cx, z - cz) > 5.4 ? '#ffffff' : (x + z) % 2 ? '#f8f0e4' : '#fbf6ee'));
  for (let x = 6; x <= 9; x++) v.set(x, 1, 14, '#ffffff');
  // postes con enredaderas
  const posts = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; posts.push([Math.round(cx + Math.cos(a) * 5.2), Math.round(cz + Math.sin(a) * 5.2)]); }
  for (const [x, z] of posts) {
    v.box(x, 2, z, 1, 8, 1, '#ffffff');
    for (let y = 2; y < 10; y += 2) v.set(x + (y % 4 ? 1 : 0), y, z + (y % 4 ? 0 : 1), C.leaf);
    v.set(x, 5, z + 1, P.clay); v.set(x + 1, 7, z, '#ffffff'); v.set(x, 3, z + 1, C.red);
  }
  // baranda baja entre postes (dejando la entrada)
  for (let i = 0; i < 6; i++) {
    const [ax, az] = posts[i], [bx, bz] = posts[(i + 1) % 6];
    if ((az + bz) / 2 > 11) continue; // frente abierto
    for (let k = 1; k < 6; k++) { const x = Math.round(ax + (bx - ax) * k / 6), z = Math.round(az + (bz - az) * k / 6); v.set(x, 4, z, '#ffffff'); if (k % 2) v.set(x, 3, z, '#ffffff'); }
  }
  // techo cebolla lila con borde blanco
  v.cylinder(cx, 10, cz, 6.8, 1, '#ffffff');
  for (let j = 0; j < 7; j++) v.cylinder(cx, 11 + j, cz, Math.max(0.6, 6.2 - j * 0.85 - (j > 4 ? 0.6 : 0)), 1, j % 2 ? P.slate : P.slateL);
  v.box(7, 18, 7, 2, 2, 2, P.gold); v.set(7, 20, 7, P.clay);
  // banco interior y farolito colgante
  v.box(4, 2, 4, 8, 1, 2, P.wood); v.box(4, 3, 4, 8, 2, 1, P.clayL);
  v.box(7, 9, 7, 1, 1, 1, P.gold); m.light.set(7, 8, 7, C.yellow);
  for (const [x, z] of [[1, 14], [14, 14]]) bush(v, x, 1, z, 1.2, C.leaf, [P.clay, '#ffffff'], x);
  m.height = 21;
}

// ---------- arco de rosas ----------
function arcoRosas(m) {
  const v = m.v;
  for (let z = 0; z < 8; z++) for (let x = 2; x <= 5; x++) v.set(x, 0, z, (x + z) % 3 === 0 ? '#e9d9c4' : '#f3e7d6');
  const r = rng(13);
  const rose = () => (r() < 0.45 ? P.clay : r() < 0.5 ? C.red : '#ffffff');
  for (const x of [0, 7]) {
    v.box(x, 0, 3, 1, 1, 2, P.wood);
    for (let y = 1; y <= 8; y++) for (let z = 3; z <= 4; z++) v.set(x, y, z, r() < 0.35 ? rose() : (r() < 0.5 ? C.leaf : C.leafD));
  }
  for (let x = 0; x <= 7; x++) {
    const y = 9 + (x >= 2 && x <= 5 ? 1 : 0);
    for (let z = 3; z <= 4; z++) { v.set(x, y, z, r() < 0.4 ? rose() : C.leaf); if (x >= 1 && x <= 6) v.set(x, y - 1, z, r() < 0.3 ? rose() : C.leafD); }
  }
  v.set(3, 11, 3, P.clay); v.set(4, 11, 4, C.red);
  v.box(2, 8, 3, 4, 1, 2, '#ffffff');
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
function lago(m) {
  const v = m.v;
  const cx = 11.5, cz = 11.5;
  const shape = (x, z) => { const a = Math.atan2(z - cz, x - cx); const rr = 9.4 + Math.sin(a * 3) * 0.9 + Math.cos(a * 2) * 0.6; return Math.hypot(x - cx, z - cz) / rr; };
  for (let x = 0; x < 24; x++) for (let z = 0; z < 24; z++) {
    const d = shape(x, z);
    if (d < 0.86) v.set(x, 0, z, d < 0.55 ? C.waterD : C.water);
    else if (d < 1) { v.set(x, 0, z, P.sand || '#f3e2c0'); v.set(x, 1, z, (x + z) % 3 === 0 ? '#ddd5c8' : '#a2e589'); }
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
  v.box(17, 1, 17, 4, 1, 6, (x, y, z) => (z % 2 ? P.wood : '#c98f62'));
  for (const [x, z] of [[17, 17], [20, 17]]) v.box(x, 0, z, 1, 2, 1, P.woodD);
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
function camino(m) {
  const v = m.v;
  // losas de piedra clara de 4x4 con junta, filas desplazadas
  const tones = ['#f5f1ea', '#efe9e0', '#f8f4ef', '#f2ede5'];
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) {
    const row = Math.floor(z / 4), off = row % 2 ? 2 : 0;
    const bx = (x + off) % 4, bz = z % 4;
    const id = (Math.floor((x + off) / 4) + row * 3) % 4;
    let c = bx === 3 || bz === 3 ? '#e1d9cc' : tones[id];
    if (bx === 0 && bz === 0) c = '#fbf9f5';
    v.set(x, 0, z, c);
  }
}
function caminoRosa(m) {
  const v = m.v;
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) {
    const ex = x % 4 === 3, ez = z % 4 === 3;
    const tile = (Math.floor(x / 4) + Math.floor(z / 4)) % 2;
    let c = ex || ez ? '#eea183' : tile ? '#ffd8c4' : '#fde9d8';
    if (!ex && !ez && x % 4 === 0 && z % 4 === 0) c = '#faf4eb';
    v.set(x, 0, z, c);
  }
  // corazoncitos en las baldosas
  v.set(1, 0, 1, P.clay); v.set(5, 0, 5, P.clay);
}
function caminoDorado(m) {
  const v = m.v;
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) {
    const ex = x % 4 === 3, ez = z % 4 === 3;
    const tile = (Math.floor(x / 4) + Math.floor(z / 4)) % 2;
    let c = ex || ez ? P.goldD : tile ? P.gold : '#ffdb85';
    if (!ex && !ez && x % 4 === 0 && z % 4 === 0) c = P.goldL;
    v.set(x, 0, z, c);
  }
  m.light.set(1, 0, 5, '#fff6d0'); m.light.set(5, 0, 1, '#fff6d0');
}

export const DECO_BUILDERS = {
  arbol, arbusto, farol, banco, cerezo, fuente, macetas, estatua, glorieta, arco_rosas: arcoRosas, unicornio, lago,
  camino, camino_rosa: caminoRosa, camino_dorado: caminoDorado,
};
