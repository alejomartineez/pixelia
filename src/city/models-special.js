// Edificios especiales: joyería, torre de bloques, garaje, pista y boutique.
import {
  P, C, shade, lot, path, win, door, awning, gable, hip, cone, battlements, roundBattlements, flowerBed, bush, smallTree,
  tulip, flower, fbox, fset, pattern, HEART3, HEART5, STAR5, addSmoke, spinStar, sparkle, wavingFlag, crown, rng, pick,
  uid, doorLamps, flagCloth, FLOWER_COLORS,
} from './models-kit.js';

const S = 1 / 8;
const RAINBOW = ['#ff7a8a', '#ffb38a', '#ffe066', '#7fe3a8', '#8fd3ff', '#9fb5e9'];

// La Municipalidad (id 'castillo') está en models-town.js: un modelo por rango atado a las épocas.

// ======================= JOYERÍA MÁGICA =======================
function joyeria(m, L) {
  const v = m.v;
  lot(v, 16, 16, (x, z) => ((x + z) % 2 ? '#fcf8f2' : '#f8f0e4'));
  const wall = '#f8f0e3', x0 = 2, x1 = 13, z0 = 2, z1 = 9, top = 10;
  v.box(x0, 1, z0, 12, top - 1, 8, (x, y) => (y === 1 ? C.stoneL : (x === x0 || x === x1) ? '#ffffff' : wall));
  for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = z0 - 1; z <= z1 + 1; z++) v.set(x, top, z, (x === x0 - 1 || x === x1 + 1 || z === z0 - 1 || z === z1 + 1) ? P.gold : '#ced9f3');
  // vidriera con joyas
  fbox(v, 'pz', z1, 3, 3, 6, 4, 0, (i, j) => (j === 3 ? C.glass : '#6b8bd3'));
  pattern(v, 'pz', z1, 3, 3, ['.g..p.', 'g.g.pp', '.g..s.'], { g: P.gold, p: P.clay, s: P.sky });
  fbox(v, 'pz', z1, 2, 2, 8, 1, 1, P.gold);
  door(v, 'pz', z1, 10, 2, 2, 5, P.slateD, { glass: true, frame: P.gold });
  awning(v, 'pz', z1, x0, 8, 12, P.slate, '#ffffff', { depth: 2 });
  win(v, 'px', x1, 4, 4, 3, 3, { frame: P.gold, sill: false });
  win(v, 'nx', x0, 4, 4, 3, 3, { frame: P.gold, sill: false });
  // pedestal dorado (columna fina)
  v.box(6, top + 1, 4, 4, 1, 4, P.goldD);
  v.box(7, top + 2, 5, 2, 3, 2, P.gold);
  v.box(6, top + 5, 4, 4, 1, 4, P.goldD);
  // gema gigante tallada (perfil de joya clásico extruido con bisel; se mece y flota)
  const gy = top + 7, gz = 5;
  const g = m.part('gem', [8.5, gy + 4, gz + 1.5], { mat: 'glow' });
  const prof = [ // fila 0 = arriba
    '..aaaaaaa..',
    '.abbabbabb.',
    'ccccccccccc',
    '.ddeddeddd.',
    '..ddeddedd.',
    '...dedded..',
    '....ddd....',
    '.....d.....',
  ];
  const col = { a: '#f9f3e9', b: '#fbd7b7', c: '#ffffff', d: P.clay, e: P.clayD };
  for (let dz = 0; dz < 3; dz++) {
    const shrink = dz === 1 ? 0 : 1; // bisel en las capas de adelante/atrás
    for (let r = 0; r < prof.length; r++) {
      const row = prof[r];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]; if (ch === '.') continue;
        const left = row.slice(0, i).split('').every(c => c === '.'), right = row.slice(i + 1).split('').every(c => c === '.');
        if (shrink && (left || right) && r !== 2) continue;
        let c = col[ch];
        if (dz !== 1) c = shade(c, dz === 0 ? -0.06 : 0.1);
        g.set(3 + i, gy + (prof.length - 1 - r), gz + dz, c);
      }
    }
  }
  g.set(5, gy + 6, gz + 3, '#ffffff'); g.set(6, gy + 6, gz + 3, '#ffffff'); g.set(5, gy + 4, gz + 3, '#ffffff');
  m.animate((parts, ph) => { const o = parts.gem[0], by = o.position.y; return (dt, t) => { o.rotation.y = Math.sin((t + ph) * 0.9) * 0.7; o.position.y = by + Math.sin((t + ph) * 1.8) * 0.06; }; });
  sparkle(m, 3, top + 10, 4, '#ffffff', 2.2); sparkle(m, 12, top + 8, 7, P.clayL, 2.9); sparkle(m, 9, top + 17, 8, P.goldL, 2.5);
  // vereda: alfombra y macetas
  for (let z = 10; z <= 15; z++) for (let x = 10; x <= 11; x++) v.set(x, 0, z, P.slate);
  for (const x of [1, 14]) { v.box(x, 1, 13, 1, 2, 1, P.gold); bush(v, x, 3, 13, 1, C.leaf, [P.clay], x); }
  v.box(3, 1, 12, 4, 2, 2, '#ffffff'); v.set(4, 3, 12, P.clay); v.set(5, 3, 13, P.sky); // vitrinita exterior
}

// ======================= TORRE DE BLOQUES =======================
function block(v, x, y, z, n, c) {
  v.box(x, y, z, n, n, n, (xx, yy, zz) => {
    const ex = xx === x || xx === x + n - 1, ez = zz === z || zz === z + n - 1, ey = yy === y + n - 1, eb = yy === y;
    if (ey && (ex || ez)) return shade(c, 0.3);
    if (ey) return shade(c, 0.15);
    if (eb) return shade(c, -0.18);
    if (ex && ez) return shade(c, -0.08);
    return c;
  });
}
function torreBloques(m, L) {
  const v = m.v;
  lot(v, 16, 16, (x, z) => ((Math.floor(x / 2) + Math.floor(z / 2)) % 2 ? '#fdf6e3' : '#fbf5ed'));
  const cols = [P.clay, P.sky, C.yellow, P.mint, P.slate, P.peach, C.red];
  // planta baja con puerta
  block(v, 3, 1, 3, 4, P.clay); block(v, 7, 1, 3, 4, P.sky); block(v, 3, 1, 7, 4, C.yellow); block(v, 7, 1, 7, 4, P.mint);
  block(v, 11, 1, 5, 4, P.slate); block(v, 1, 1, 9, 2, P.peach);
  door(v, 'pz', 10, 6, 1, 3, 4, P.slateD, { frame: '#ffffff', glass: true });
  v.box(5, 1, 11, 5, 1, 2, '#ffffff');
  // pila de bloques grandes, un poquito corridos (torre firme pero juguetona)
  const layers = 4;
  let y = 5;
  const offs = [[5, 5], [4, 5], [5, 4], [6, 5]];
  for (let i = 0; i < layers; i++) {
    const [ox, oz] = offs[i];
    block(v, ox, y, oz, 6, cols[(i + 1) % cols.length]);
    // ventanita con marco en el frente de cada bloque
    v.set(ox + 2, y + 2, oz + 6, '#ffffff'); v.set(ox + 3, y + 2, oz + 6, '#ffffff');
    v.set(ox + 2, y + 3, oz + 5, C.glass); v.set(ox + 3, y + 3, oz + 5, C.glassD);
    v.set(ox + 2, y + 3, oz + 6, null); v.set(ox + 3, y + 3, oz + 6, null);
    // bloquecitos que asoman a los costados
    if (i % 2 === 0) block(v, ox + 6, y + 1, oz + 2, 3, cols[(i + 4) % cols.length]);
    else block(v, ox - 3, y + 2, oz + 1, 3, cols[(i + 5) % cols.length]);
    y += 6;
  }
  // bloque que flota y gira arriba de todo
  const fb = m.part('float', [8, y + 4, 8]);
  block(fb, 6, y + 2, 6, 4, C.yellow);
  sparkle(m, 8, y + 9, 8, '#ffffff', 2);
  fb.set(7, y + 4, 10, '#ffffff'); fb.set(8, y + 4, 10, '#ffffff'); fb.set(7, y + 3, 10, '#ffffff'); fb.set(8, y + 3, 10, '#ffffff');
  m.animate((parts, ph) => { const o = parts.float[0], by = o.position.y; return (dt, t) => { o.rotation.y = (t + ph) * 0.8; o.position.y = by + Math.sin((t + ph) * 2) * 0.1; }; });
  m.height = y + 7;
  // bloquecitos sueltos en el piso
  block(v, 12, 1, 12, 2, P.sky); block(v, 13, 3, 12, 2, C.yellow); block(v, 1, 1, 13, 2, P.mint);
  block(v, 12, 1, 1, 3, C.red);
  for (let x = 0; x < 16; x += 3) v.set(x, 1, 15, cols[x % cols.length]);
  sparkle(m, 2, y, 4, '#ffffff'); sparkle(m, 13, y - 6, 10, P.goldL);
}

// ======================= GARAJE REAL =======================
/** Autito de carrera chiquito: 3 de ancho, 5 de largo, frente a +z. */
function tinyCar(v, x, y, z, body) {
  v.box(x, y + 1, z, 3, 1, 5, body);
  v.box(x, y + 2, z + 1, 3, 1, 2, '#ffffff'); v.box(x, y + 2, z + 3, 3, 1, 1, C.glass);
  v.set(x + 1, y + 3, z + 1, body);
  for (const [dx, dz] of [[-1, 0], [3, 0], [-1, 4], [3, 4]]) v.set(x + dx, y + 1, z + dz, P.ink);
  v.set(x, y + 1, z + 5, C.yellow); v.set(x + 2, y + 1, z + 5, C.yellow);
}
export function miniCar(v, x, y, z, body = P.clay, o = {}) {
  // auto chiquito: largo en z (7), ancho 5, frente a +z
  const w = 5, l = 8;
  v.box(x, y + 1, z, w, 2, l, body);
  v.box(x, y + 1, z + l - 1, w, 1, 1, shade(body, -0.12));
  v.box(x + 1, y + 3, z + 2, w - 2, 2, 4, '#ffffff');
  v.box(x, y + 3, z + 2, w, 1, 4, C.glass);
  v.box(x + 1, y + 3, z + 5, w - 2, 1, 1, C.glassD);
  v.box(x + 1, y + 5, z + 2, w - 2, 1, 4, body);
  for (const [dx, dz] of [[-1, 1], [w, 1], [-1, l - 2], [w, l - 2]]) { v.set(x + dx, y + 1, z + dz, P.ink); v.set(x + dx, y + 2, z + dz, '#6e5a4f'); v.set(x + dx, y + 1, z + dz + 1, P.ink); }
  v.set(x, y + 2, z + l, C.yellow); v.set(x + w - 1, y + 2, z + l, C.yellow);
  v.set(x, y + 2, z - 1, C.red); v.set(x + w - 1, y + 2, z - 1, C.red);
  if (o.crown) { v.set(x + 2, y + 6, z + 3, P.gold); v.set(x + 1, y + 6, z + 4, P.gold); v.set(x + 3, y + 6, z + 4, P.gold); v.set(x + 2, y + 6, z + 4, P.gold); }
}
function garaje(m, L) {
  L = Math.max(L, 4); // edificio especial sin mejoras: se muestra completo
  const v = m.v;
  lot(v, 24, 24, (x, z) => (z > 14 ? ((x + z) % 2 ? '#f2ece4' : '#ece4d9') : ((x + z) % 2 ? '#fdf6e3' : '#faf4ea')));
  const wall = '#d9f0ff', x0 = 2, x1 = 21, z0 = 2, z1 = 13;
  const H = L >= 3 ? 16 : 11;
  v.box(x0, 1, z0, 20, H - 1, 12, (x, y) => (y === 1 ? C.stoneL : y % 4 === 0 ? '#c9e7fb' : wall));
  for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = z0 - 1; z <= z1 + 1; z++) v.set(x, H, z, (x === x0 - 1 || x === x1 + 1 || z === z0 - 1 || z === z1 + 1) ? (L >= 4 ? P.gold : P.skyD) : '#bfe0f5');
  // dos portones: uno cerrado (rayado), otro medio abierto
  for (const [u, open] of [[3, false], [12, true]]) {
    fbox(v, 'pz', z1, u - 1, 1, 9, 9, 0, '#ffffff');
    fbox(v, 'pz', z1, u, 1, 7, 8, 0, (i, j) => (open && j < 4 ? '#665945' : (j % 2 ? P.clayL : '#ffffff')));
    fbox(v, 'pz', z1, u, open ? 5 : 1, 7, 1, 1, open ? P.clay : P.clayD);
  }
  // auto rosa saliendo del garaje + auto lila adentro
  miniCar(v, 14, 0, 14, P.clay, {});
  // cartel con llave inglesa y estrella
  v.box(8, H + 1, 9, 8, 5, 1, '#ffffff');
  v.box(9, H + 2, 10, 6, 3, 1, P.clay);
  pattern(v, 'pz', 11, 10, H + 2, ['g...g', '.ggg.', 'g...g'], { g: '#ffffff' });
  v.box(9, H + 1, 9, 1, 1, 1, P.skyD); v.box(14, H + 1, 9, 1, 1, 1, P.skyD);
  // ventanas
  win(v, 'px', x1, 5, 4, 4, 3, { frame: '#ffffff' }); win(v, 'nx', x0, 5, 4, 4, 3, { frame: '#ffffff' });
  if (L >= 3) for (const u of [3, 8, 13, 17]) win(v, 'pz', z1, u, 11, 3, 3, { shutters: P.skyD, box: P.skyD, flowers: [P.clay, '#ffffff'] });
  // surtidor de nafta rosa y pila de cubiertas
  v.box(4, 1, 17, 3, 6, 2, P.clay); v.box(4, 7, 17, 3, 1, 2, '#ffffff'); fset(v, 'pz', 18, 5, 4, 1, C.glass); v.set(7, 3, 18, P.ink); v.set(7, 4, 18, P.ink);
  v.box(4, 1, 21, 6, 1, 1, '#ffffff'); // isla
  for (let i = 0; i < 3; i++) v.cylinder(20, 1 + i * 2, 20, 1.6, 2, (x, y) => (y % 2 ? '#635746' : '#847763'));
  // líneas de estacionamiento
  for (let z = 15; z <= 23; z++) { v.set(12, 0, z, '#ffffff'); v.set(21, 0, z, '#ffffff'); }
  // conos
  for (const x of [1, 10]) { v.set(x, 1, 22, C.orange); v.set(x, 2, 22, '#ffffff'); v.set(x, 3, 22, C.orange); }
  if (L >= 2) { for (const [x, c] of [[1, P.mint], [22, P.slate]]) { v.box(x, 1, 3, 1, 3, 6, c); v.box(x, 4, 3, 1, 1, 6, shade(c, -0.2)); } }
  if (L >= 4) doorLamps(m, 'pz', z1, 2, 21, 4);
  if (L >= 5) { spinStar(m, 11, H + 7, 9); miniCar(v, 4, 1, 3, P.slate); }
}

// ======================= PISTA ARCOÍRIS =======================
function pista(m, L) {
  L = Math.max(L, 4);
  const v = m.v;
  lot(v, 24, 24, (x, z) => ((x + z) % 2 ? '#a2e589' : '#99e07f'));
  const cx = 11.5, cz = 11.5, TW = 3.2;
  for (let x = 0; x < 24; x++) for (let z = 0; z < 24; z++) {
    const dx = x - cx, dz = z - cz;
    // óvalo "estadio": rectángulo con puntas redondeadas
    const ax = Math.max(0, Math.abs(dx) - 4.5), d = Math.hypot(ax, dz);
    const R = 10.6;
    if (d <= R && d >= R - TW - 0.3) {
      const k = (R - d) / TW;
      const curve = Math.abs(dx) > 4.5;
      let c;
      if (curve) c = RAINBOW[Math.min(5, Math.floor(k * 6))];
      else c = (Math.abs(k - 0.5) < 0.18 && x % 3 !== 0) ? '#ffffff' : ((x + z) % 2 ? '#eae0d2' : '#e2d7c7');
      v.set(x, 0, z, c);
      if (d > R - 0.7) v.set(x, 1, z, Math.floor((x + z) / 2) % 2 ? '#ffffff' : P.clay); // cordón exterior
      else if (d < R - TW + 0.2) v.set(x, 0, z, '#ffffff');
    }
  }
  // línea de largada/llegada a cuadros
  for (let z = 18; z <= 23; z++) for (let x = 11; x <= 12; x++) { v.set(x, 0, z, (x + z) % 2 ? '#6e5a4f' : '#ffffff'); v.remove(x, 1, z); }
  // arcoíris gigante en el centro, con nubes en las patas
  const az = 11, acx = 12, R0 = 6.5;
  for (let x = 0; x < 24; x++) for (let y = 1; y < 12; y++) {
    const d = Math.hypot(x + 0.5 - acx, y - 1);
    const band = Math.floor(R0 - d);
    if (d <= R0 && band >= 0 && band < 6) { v.set(x, y, az, RAINBOW[band]); v.set(x, y, az + 1, RAINBOW[band]); }
  }
  for (const fx of [acx - 4.8, acx + 4.3]) v.sphere(fx, 2, az + 0.5, 2.4, 1.8, 2, (x, y) => (y > 2 ? '#ffffff' : '#eef3ff'));
  // banderas a cuadros en postes
  for (const [x, z] of [[10, 22], [13, 22]]) { v.box(x, 1, z, 1, 6, 1, '#ffffff'); }
  const fl = m.part('flag1', [10.5, 6, 22.5]);
  pattern(fl, 'pz', 22, 11, 5, ['kwk', 'wkw'], { k: P.clay, w: '#ffffff' });
  const fl2 = m.part('flag1', [13.5, 6, 22.5]);
  pattern(fl2, 'pz', 22, 14, 5, ['kwk', 'wkw'], { k: P.clay, w: '#ffffff' });
  // autito que da vueltas
  const car = m.part('car', [12.5, 0, 12.5]);
  tinyCar(car, 11, 0, 10, P.clay);
  m.animate((parts, ph) => {
    const flags = parts.flag1, c = parts.car[0];
    return (dt, t) => {
      for (const f of flags) f.rotation.y = Math.sin((t + ph) * 3) * 0.3;
      // recorrido del estadio: rectas + semicírculos
      const Rm = (10.6 - TW / 2) * S, half = 4.5 * S;
      const per = 4 * half + 2 * Math.PI * Rm;
      let s = ((t + ph) * 0.9) % per;
      let x, z, hd;
      if (s < 2 * half) { x = -half + s; z = Rm; hd = Math.PI / 2; }
      else if ((s -= 2 * half) < Math.PI * Rm) { const a = s / Rm; x = half + Math.sin(a) * Rm; z = Math.cos(a) * Rm; hd = Math.PI / 2 + a; }
      else if ((s -= Math.PI * Rm) < 2 * half) { x = half - s; z = -Rm; hd = -Math.PI / 2; }
      else { s -= 2 * half; const a = s / Rm; x = -half - Math.sin(a) * Rm; z = -Math.cos(a) * Rm; hd = -Math.PI / 2 + a; }
      c.position.set(x, 0, z);
      c.rotation.y = hd;
    };
  });
  // conitos
  for (const [x, z] of [[20, 4], [3, 21]]) { v.set(x, 1, z, C.orange); v.set(x, 2, z, '#ffffff'); }
  if (L >= 2) { bush(v, 22, 1, 1, 1.2, C.leaf, [P.clay], 2); bush(v, 1, 1, 1, 1.2, C.leaf, [C.yellow], 3); }
  if (L >= 4) for (let x = 7; x <= 16; x += 3) m.light.set(x, 1, 13, C.yellow);
  if (L >= 5) { spinStar(m, 11, 10, 11); sparkle(m, 4, 9, 11, '#ffffff'); sparkle(m, 19, 8, 12, P.goldL); }
  m.height = 10;
}

// ======================= BOUTIQUE DE MODA =======================
function boutiqueReal(m, L) {
  const v = m.v;
  lot(v, 16, 16, (x, z) => ((x + z) % 2 ? '#ffffff' : '#fbf5ed'));
  const wall = '#faf3e9', x0 = 2, x1 = 13, z0 = 2, z1 = 10, top = 12;
  v.box(x0, 1, z0, 12, top - 1, 9, (x, y) => (y === 1 ? C.stoneL : (x === x0 || x === x1) ? '#ffffff' : wall));
  // techo mansarda con remate dorado
  const rt = hip(v, x0, x1, z0, z1, top, C.roofClay, { trim: P.gold, oh: 1, flat: 4 });
  v.box(6, rt, 5, 4, 1, 4, P.gold); spinStar(m, 7, rt + 3, 6, P.gold, 1.2);
  for (const u of [4, 10]) { v.box(u, top, z1 - 1, 2, 3, 2, wall); v.set(u, top + 1, z1 + 1 - 1, C.glass); v.set(u + 1, top + 1, z1, C.glassD); v.box(u, top + 3, z1 - 1, 2, 1, 3, P.gold); }
  // vidriera en nicho con un vestido de fiesta
  const ax0 = 3, ax1 = 9, ay0 = 2, ay1 = 9, depth = 3;
  for (let x = ax0; x <= ax1; x++) for (let y = ay0; y <= ay1; y++) for (let z = z1 - depth + 1; z <= z1; z++) v.remove(x, y, z);
  for (let x = ax0; x <= ax1; x++) { v.set(x, ay0 - 1, z1, P.gold); v.set(x, ay1 + 1, z1, P.gold); for (let z = z1 - depth + 1; z <= z1; z++) v.set(x, ay0 - 1, z, '#ffffff'); }
  for (let y = ay0 - 1; y <= ay1 + 1; y++) { v.set(ax0 - 1, y, z1, P.gold); v.set(ax1 + 1, y, z1, P.gold); }
  for (let x = ax0; x <= ax1; x++) for (let y = ay0; y <= ay1; y++) v.set(x, y, z1 - depth, '#fff6d6'); // fondo
  // cortinitas
  for (let y = ay0 + 3; y <= ay1; y++) { v.set(ax0, y, z1 - 1, P.slate); v.set(ax1, y, z1 - 1, P.slate); }
  v.set(ax0 + 1, ay1, z1 - 1, P.slate); v.set(ax1 - 1, ay1, z1 - 1, P.slate);
  // maniquí con vestido largo
  const mx = 6, mz = z1 - 1;
  const dress = L >= 3 ? P.slate : P.clay;
  v.box(mx - 1, ay0, mz - 1, 3, 1, 2, P.gold);
  for (let j = 0; j < 4; j++) { const r = 2.4 - j * 0.45; v.cylinder(mx, ay0 + 1 + j, mz - 0.5, r, 1, (x, y, z) => (x === mx && j < 3 ? shade(dress, 0.2) : dress)); }
  v.box(mx, ay0 + 5, mz - 1, 1, 2, 1, dress); v.set(mx, ay0 + 5, mz, P.gold);
  v.set(mx - 1, ay0 + 6, mz - 1, shade(dress, 0.2)); v.set(mx + 1, ay0 + 6, mz - 1, shade(dress, 0.2));
  v.set(mx, ay0 + 7, mz - 1, '#ffffff'); v.set(mx, ay0 + 8, mz - 1, P.gold);
  m.light.set(mx - 2, ay1, z1 - 1, C.yellow); m.light.set(mx + 2, ay1, z1 - 1, C.yellow);
  // puerta
  door(v, 'pz', z1, 11, 2, 2, 6, P.clayD, { frame: P.gold, glass: true });
  // ventanas laterales y alfombra
  win(v, 'px', x1, 4, 5, 3, 4, { arch: wall, archTop: P.gold, sill: '#ffffff' });
  win(v, 'nx', x0, 4, 5, 3, 4, { arch: wall, archTop: P.gold, sill: '#ffffff' });
  for (let z = 11; z <= 15; z++) for (let x = 3; x <= 9; x++) v.set(x, 0, z, (x === 3 || x === 9) ? P.gold : P.clay);
  for (const x of [1, 14]) { v.box(x, 1, 12, 1, 2, 1, P.gold); bush(v, x, 3, 12, 1.1, C.leafD, [P.clay, '#ffffff'], x); }
  sparkle(m, 11, top + 6, 11, '#ffffff', 2.3); sparkle(m, 3, top + 3, 12, P.goldL, 2.8);
  pattern(v, 'pz', z1, 6, ay1 + 2, ['X'], P.clay);
}

export const SPECIAL_BUILDERS = { joyeria, torre_bloques: torreBloques, garaje, pista, boutique_real: boutiqueReal };
