// Edificios especiales: municipalidad (id castillo, 8 niveles: uno por rango de ciudad), joyería, torre de bloques, garaje, pista y boutique.
import {
  P, C, shade, lot, path, win, door, awning, gable, hip, cone, battlements, roundBattlements, flowerBed, bush, smallTree,
  tulip, flower, fbox, fset, pattern, HEART3, HEART5, STAR5, addSmoke, spinStar, sparkle, wavingFlag, crown, rng, pick,
  uid, doorLamps, flagCloth, FLOWER_COLORS,
} from './models-kit.js';

const S = 1 / 8;
const RAINBOW = ['#ff7a8a', '#ffb38a', '#ffe066', '#7fe3a8', '#8fd3ff', '#9fb5e9'];

// ======================= MUNICIPALIDAD =======================
// (id 'castillo' por compatibilidad). 5 niveles: casona con torre de reloj → alas, pórtico con columnas,
// fuente en la plaza y cúpula dorada.
function castillo(m, L, opts) {
  const v = m.v;
  const flag = opts.flag || P.sky;
  const cream = '#f8eedc', creamB = '#f1e3cb', brick = '#d98f6a', brickD = '#c27a56', white = '#ffffff';
  // desde Gran Ciudad el techo pasa a pizarra azul (cambio que se nota de lejos)
  const roofC = L >= 6 ? C.roofSlate : C.roofClay, gold = P.gold;
  const trim = L >= 5 ? gold : white;
  const wall = (x, y, z) => (y <= 2 ? ((x + z + y) % 3 === 0 ? brickD : brick) : (y % 4 === 0 ? creamB : cream));
  // plaza de baldosas con borde de pasto
  lot(v, 32, 32, (x, z) => {
    if (x < 1 || z < 1 || x > 30 || z > 30) return '#9ee385';
    return (Math.floor(x / 2) + Math.floor(z / 2)) % 2 ? '#f4ede2' : '#ece2d2';
  });
  const WH = [9, 10, 11, 12, 13, 13, 14, 14][L - 1];
  const TH = WH + 14 + 2 * L;             // alto de la torre del reloj (bien por encima del techo)
  // --- cuerpo principal ---
  const x0 = 7, x1 = 24, z0 = 8, z1 = 19;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = 1; y <= WH; y++) v.set(x, y, z, wall(x, y, z));
  for (const [x, z] of [[x0, z1], [x1, z1], [x0, z0], [x1, z0]]) v.box(x, 1, z, 1, WH, 1, white);   // pilastras
  for (let x = x0; x <= x1; x++) { v.set(x, WH, z1, trim); v.set(x, WH, z0, trim); }
  for (let z = z0; z <= z1; z++) { v.set(x0, WH, z, trim); v.set(x1, WH, z, trim); }
  // puerta y ventanas del frente
  door(v, 'pz', z1, 14, 1, 4, 5, P.woodD, { frame: white, glass: true });
  const rows = WH >= 11 ? [4, 8] : [4];
  for (const y of rows) {
    for (const u of [8, 11, 19, 22]) win(v, 'pz', z1, u, y, 2, 3, { arch: cream, archTop: white, shutters: L >= 3 ? P.mintD : null });
    for (const u of [10, 14, 18]) { win(v, 'px', x1, u, y, 2, 3, { sill: white }); win(v, 'nx', x0, u, y, 2, 3, { sill: white }); }
  }
  let peak = hip(v, x0, x1, z0, z1, WH + 1, roofC, { oh: 1, trim: white });
  // --- pórtico con columnas y frontón (nivel 2+) ---
  if (L >= 2) {
    v.box(11, 1, 20, 10, 1, 3, '#efe6d8');                 // escalinata
    v.box(12, 0, 23, 8, 1, 1, '#e4d8c4');
    for (const x of [11, 13, 18, 20]) v.box(x, 2, 21, 1, WH - 2, 1, white);
    v.box(10, WH, 20, 12, 1, 3, trim);
    gable(v, 'z', 10, 21, 20, 22, WH + 1, roofC, { oh: 0, wall: cream, trim: white });
    pattern(v, 'pz', 22, 15, WH + 2, ['XX', 'XX'], L >= 4 ? gold : P.slate);  // escudito
  } else {
    awning(v, 'pz', z1, 13, 7, 6, P.clay, white, { depth: 1 });
  }
  // --- torre del reloj ---
  const tx0 = 12, tx1 = 19, tz0 = 9, tz1 = 16;
  for (let x = tx0; x <= tx1; x++) for (let z = tz0; z <= tz1; z++) for (let y = WH + 1; y <= TH; y++) {
    const corner = (x === tx0 || x === tx1) && (z === tz0 || z === tz1);
    v.set(x, y, z, corner ? white : (y % 4 === 0 ? creamB : cream));
  }
  for (let x = tx0 - 1; x <= tx1 + 1; x++) for (let z = tz0 - 1; z <= tz1 + 1; z++)
    if (x === tx0 - 1 || x === tx1 + 1 || z === tz0 - 1 || z === tz1 + 1) v.set(x, TH, z, trim);
  const ring = L >= 3 ? gold : white;
  const CLOCK = ['..GGGG..', '.GWWWWG.', 'GWWWKWWG', 'GWWWKWWG', 'GWWWKKKG', 'GWWWWWWG', '.GWWWWG.', '..GGGG..'];
  const cmap = { G: ring, W: '#fffaf0', K: P.ink };
  pattern(v, 'pz', tz1, tx0, TH - 9, CLOCK, cmap, 1);
  // costados: ventanales del campanario (un reloj por cara en la esquina parece una cara con ojos)
  for (const [f, pl] of [['px', tx1], ['nx', tx0]]) {
    win(v, f, pl, tz0 + 1, TH - 8, 2, 5, { arch: cream, archTop: ring, sill: white });
    win(v, f, pl, tz0 + 5, TH - 8, 2, 5, { arch: cream, archTop: ring, sill: white });
  }
  for (const u of [13, 17]) win(v, 'pz', tz1, u, TH - 13, 2, 2, { sill: white });
  // techo de la torre
  let top;
  if (L <= 2) top = hip(v, tx0, tx1, tz0, tz1, TH + 1, roofC, { oh: 1, trim: white });
  else if (L >= 7) {
    // Metrópolis: mirador con columnas sobre el reloj y una gran cúpula dorada con bandas
    v.box(tx0, TH + 1, tz0, 8, 1, 8, gold);
    for (const [cx, cz] of [[tx0, tz0], [tx1, tz0], [tx0, tz1], [tx1, tz1], [tx0, 12], [tx1, 12], [15, tz1], [15, tz0]]) v.box(cx, TH + 2, cz, 1, 4, 1, white);
    v.box(tx0, TH + 6, tz0, 8, 1, 8, white);
    m.light.set(15, TH + 3, 12, C.yellow); m.light.set(16, TH + 3, 13, C.yellow);   // farol encendido adentro
    top = cone(v, 15.5, TH + 7, 12.5, 5.4, 10, gold, { trim: white, bands: 3 });
  } else {
    v.box(tx0, TH + 1, tz0, 8, 2, 8, white);
    top = cone(v, 15.5, TH + 3, 12.5, 4.9, L >= 4 ? 7 : 6, L >= 5 ? gold : L >= 4 ? P.slate : roofC, { trim: gold, bands: L >= 4 ? 2 : 0 });
  }
  if (L >= 8) { v.box(15, top, 12, 1, 3, 1, gold); spinStar(m, 15, top + 5, 12, gold, 0.9); spinStar(m, 15, top + 5, 12, '#ffffff', -1.4); top += 9; }
  else if (L >= 5) { v.set(15, top, 12, gold); spinStar(m, 15, top + 3, 12, gold, 1.1); top += 6; }
  else { v.box(15, top + 1, 12, 1, 4, 1, white); v.set(15, top + 5, 12, gold); wavingFlag(m, 15, top + 2, 12, 4, 3, flag); top += 6; }
  peak = Math.max(peak, top);
  // --- alas laterales (nivel 3+) ---
  if (L >= 3) for (const [ax0, ax1] of [[1, 6], [25, 30]]) {
    const AH = L >= 6 ? WH - 1 : WH - 3;
    for (let x = ax0; x <= ax1; x++) for (let z = 11; z <= 19; z++) for (let y = 1; y <= AH; y++) v.set(x, y, z, wall(x, y, z));
    gable(v, 'z', ax0, ax1, 11, 19, AH + 1, roofC, { oh: 0, wall: cream, trim: white });
    win(v, 'pz', 19, ax0 + 2, 4, 2, 3, { box: P.woodD, flowers: [P.berry, C.yellow, '#ffffff'] });
    if (L >= 6) win(v, 'pz', 19, ax0 + 2, 8, 2, 2, { sill: gold });   // segundo piso en las alas
  }
  // --- plaza: sendero, canteros, faroles y fuente ---
  for (let z = 23; z <= 31; z++) for (let x = 14; x <= 17; x++) v.set(x, 0, z, (x === 14 || x === 17) ? (L >= 4 ? gold : '#ddd5c8') : (x + z) % 2 ? '#fdf6e3' : '#efe4d0');
  bush(v, 4, 1, 25, 1.6, C.leaf, [P.berry, '#ffffff'], 3);
  bush(v, 27, 1, 25, 1.6, C.leaf, [P.clay, C.yellow], 4);
  if (L <= 2) { smallTree(v, 3, 1, 14, 5, 2.2, C.leaf, 9, [P.berry]); smallTree(v, 28, 1, 14, 5, 2.2, C.leaf, 10, ['#ffffff']); }
  flowerBed(v, 8, 1, 21, 2, 1, 12 + L); flowerBed(v, 22, 1, 21, 2, 1, 18 + L);
  if (L >= 2) for (const x of [11, 20]) { v.box(x, 1, 26, 1, 4, 1, P.ink); m.light.set(x, 5, 26, C.yellow); v.set(x, 6, 26, P.ink); }
  if (L >= 4) {
    // fuente redonda en la plaza (a los costados del sendero)
    for (const fx of [6.5, 25.5]) {
      v.cylinder(fx, 1, 28, 2.6, 1, '#ddd5c8');
      v.cylinder(fx, 1, 28, 1.7, 1, C.water);
      v.box(Math.floor(fx), 2, 28, 1, 2, 1, '#ddd5c8');
      v.set(Math.floor(fx), 4, 28, C.waterL);
    }
  }
  if (L >= 5) {
    for (let i = 0; i < 6; i++) sparkle(m, 4 + i * 5, WH + 4 + (i % 3) * 3, 22 - (i % 2) * 12, i % 2 ? P.goldL : '#ffffff', 2 + i * 0.3);
    for (let x = 1; x <= 30; x++) if (x < 10 || x > 21) v.set(x, WH - 1, 20, RAINBOW[x % RAINBOW.length]);   // banderines
  }
  // Gran Ciudad (6+): torrecitas con cúpula dorada en las cuatro esquinas del techo y setos recortados en la plaza
  if (L >= 6) {
    for (const [cx, cz] of [[x0 + 0.5, z1 - 0.5], [x1 - 0.5, z1 - 0.5], [x0 + 0.5, z0 + 0.5], [x1 - 0.5, z0 + 0.5]]) {
      v.cylinder(cx, WH + 1, cz, 1.9, 6, (x, y) => (y === WH + 4 ? gold : white));
      const tt = cone(v, cx, WH + 7, cz, 2.7, 5, gold, { trim: white, bands: 1 });
      v.set(Math.floor(cx), tt, Math.floor(cz), '#ffffff');
      peak = Math.max(peak, tt);
    }
    for (const hx of [3, 9, 22, 28]) { v.box(hx - 1, 1, 22, 3, 2, 2, C.leafD); v.box(hx - 1, 3, 22, 3, 1, 2, C.leaf); v.set(hx, 4, 22, P.berry); }
  }
  // Metrópolis (7+): alfombra roja, faroles a lo largo del paseo y mástiles altos con banderas grandes
  if (L >= 7) {
    for (let z = 20; z <= 31; z++) for (const x of [15, 16]) v.set(x, z >= 23 ? 0 : 1, z, (z % 3) ? C.red : '#e04a5e');
    for (const z of [24, 28]) for (const x of [12, 19]) { v.box(x, 1, z, 1, 5, 1, P.ink); v.set(x, 6, z, gold); m.light.set(x, 7, z, C.yellow); }
    for (const fx of [2, 29]) {
      v.box(fx, 1, 29, 1, 18, 1, white); v.set(fx, 19, 29, gold);
      wavingFlag(m, fx, 14, 29, 6, 4, flag);
    }
  }
  // Capital (8): arco dorado de entrada, ribete de luces en el techo y fuegos artificiales de brillitos
  if (L >= 8) {
    for (const ax of [11, 20]) { v.box(ax, 1, 30, 2, 10, 1, gold); v.box(ax, 0, 30, 2, 1, 1, P.goldD); }
    v.box(11, 11, 30, 11, 2, 1, gold);
    pattern(v, 'pz', 30, 14, 13, ['..X..', '.XXX.', 'XXXXX', '.X.X.'], '#ffffff');
    m.light.set(16, 14, 31, C.yellow);
    for (let x = x0; x <= x1; x += 3) { m.light.set(x, WH + 1, z1 + 1, C.yellow); m.light.set(x, WH + 1, z0 - 1, C.yellow); }
    const FW = [P.goldL, P.berryL, '#ffffff', C.waterL, P.goldL, P.berryL, '#ffffff', C.yellow, P.slateL, P.goldL];
    for (let i = 0; i < FW.length; i++) sparkle(m, 3 + (i * 7) % 27, TH + 4 + (i % 4) * 4, 4 + (i * 5) % 22, FW[i], 1.4 + i * 0.22);
  }
  m.height = peak + 1;
}

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

export const SPECIAL_BUILDERS = { castillo, joyeria, torre_bloques: torreBloques, garaje, pista, boutique_real: boutiqueReal };
