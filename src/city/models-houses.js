// Casas: casita, cabaña, chalet, torre de cristal, mansión. Niveles 1..5 agregan detalles.
import {
  P, C, shade, lot, path, win, door, awning, gable, hip, cone, flowerBed, bush, smallTree, picket, tulip, flower,
  fbox, fset, pattern, doorLamps, HEART3, HEART5, addSmoke, spinStar, sparkle, wavingFlag, crown, rng, pick, FLOWER_COLORS,
} from './models-kit.js';

const grassLot = (x, z) => ((x * 3 + z * 5) % 7 === 0 ? '#a9e98f' : (x + z) % 2 ? '#a2e589' : '#9ce082');

/** Chimenea con humo. Devuelve tope. */
function chimney(m, x, z, y0, y1, c = C.stoneL) {
  const v = m.v;
  v.box(x, y0, z, 2, y1 - y0, 2, (xx, y) => (y % 2 ? c : shade(c, -0.08)));
  v.box(x - 0, y1, z, 2, 1, 2, shade(c, -0.25));
  addSmoke(m, x, y1 + 1, z);
  return y1;
}
/** Buzón */
function mailbox(v, x, y, z, c = P.pink) {
  v.box(x, y, z, 1, 2, 1, P.woodD);
  v.box(x, y + 2, z - 1, 1, 1, 2, c);
  v.set(x, y + 3, z - 1, c); v.set(x + 1, y + 3, z - 1, P.coral);
}
/** Faroles a los lados de una puerta (luz sin sombra). */
// ======================= CASITA ROSA =======================
function casita(m, L) {
  const v = m.v;
  lot(v, 16, 16, grassLot);
  const wall = P.pinkL, trimC = L >= 4 ? P.gold : '#ffffff';
  const floors = L >= 3 ? 2 : 1, FH = 7;
  const x0 = 2, x1 = 13, z0 = 3, z1 = 11;
  const top = 1 + FH * floors;
  v.box(x0, 1, z0, 12, top - 1, 9, (x, y, z) => (y === 1 ? C.stoneL : ((x + y) % 5 === 0 ? shade(wall, -0.04) : wall)));
  // franja entre pisos
  if (floors > 1) for (let x = x0; x <= x1; x++) { v.set(x, 1 + FH, z1, '#ffffff'); }
  // frente: ventanas + puerta
  for (let f = 0; f < floors; f++) {
    const wy = 3 + f * FH;
    const o = { shutters: P.pink, sill: '#ffffff' };
    if (L >= 2) Object.assign(o, { box: P.pinkD, flowers: [C.red, '#ffffff', C.yellow] });
    win(v, 'pz', z1, 3, wy, 2, 3, o);
    win(v, 'pz', z1, 11, wy, 2, 3, o);
    if (f === 0) door(v, 'pz', z1, 7, 2, 2, 4, P.lilac, { frame: '#ffffff', step: C.stoneL, heart: P.pink });
    else win(v, 'pz', z1, 7, wy, 2, 3, { frame: '#ffffff', sill: false, box: L >= 2 ? P.pinkD : undefined, flowers: [P.pink, C.leaf] });
    // laterales
    win(v, 'px', x1, 6, wy, 3, 2, { shutters: P.pink, box: L >= 2 ? P.pinkD : undefined });
    win(v, 'nx', x0, 6, wy, 3, 2, { shutters: P.pink });
    win(v, 'nz', z0, 6, wy, 4, 2, {});
  }
  // techo a dos aguas con hastial al frente
  const rt = gable(v, 'z', x0, x1, z0, z1, top, C.roofPink, { wall, trim: trimC, ridge: L >= 4 ? P.gold : shade(C.roofPink, -0.18) });
  // ventanita redonda en el hastial
  win(v, 'pz', z1, 7, top + 1, 2, 2, { frame: '#ffffff', sill: false });
  chimney(m, 10, 5, top + 1, rt + 1);
  // farolitos / corazón dorado
  if (L >= 4) {
    doorLamps(m, 'pz', z1, 5, 10, 3);
    pattern(v, 'pz', z1, 6, 7, ['X..X'], P.gold);
  }
  // jardín delantero
  path(v, 7, 8, 12, 15, 0);
  flowerBed(v, 2, 1, 13, 4, 2, 11 + L);
  flowerBed(v, 10, 1, 13, 4, 2, 17 + L);
  const fenceC = L >= 5 ? P.gold : '#ffffff';
  picket(v, 'x', 0, 15, 1, 15, fenceC, [7, 8]);
  if (L >= 2) mailbox(v, 10, 1, 14, P.pink);
  if (L >= 3) { bush(v, 1, 1, 6, 1.6, C.leaf, [P.pink], 4); bush(v, 14.5, 1, 6, 1.6, C.leaf, [C.yellow], 5); }
  if (L >= 5) {
    // arco de rosas sobre la entrada
    for (let y = 1; y <= 5; y++) { v.set(6, y, 15, y % 2 ? C.leaf : P.pink); v.set(9, y, 15, y % 2 ? C.leafD : C.red); }
    for (let x = 6; x <= 9; x++) v.set(x, 6, 15, x % 2 ? P.pink : C.leaf);
    spinStar(m, 7, rt + 2, 7, P.gold);
  }
}

// ======================= CABAÑA DE FLORES =======================
function cabana(m, L) {
  const v = m.v;
  lot(v, 16, 16, grassLot);
  const logA = '#dca57a', logB = '#c98f62';
  const x0 = 2, x1 = 13, z0 = 2, z1 = 10;
  const H = L >= 3 ? 10 : 8;
  // troncos horizontales
  v.box(x0, 1, z0, 12, H, 9, (x, y, z) => (y === 1 ? C.stoneD : y % 2 ? logA : logB));
  // puntas de troncos en las esquinas
  for (let y = 2; y <= H; y += 2) for (const [x, z] of [[x0 - 1, z0], [x1 + 1, z0], [x0 - 1, z1], [x1 + 1, z1], [x0, z1 + 1], [x1, z1 + 1], [x0, z0 - 1], [x1, z0 - 1]]) v.set(x, y, z, '#efc9a3');
  // puerta de madera con ventanita
  door(v, 'pz', z1, 7, 2, 2, 5, P.woodD, { glass: true, step: P.wood });
  const fl = [P.pink, C.yellow, P.lilac, '#ffffff'];
  win(v, 'pz', z1, 3, 4, 2, 2, { frame: '#fff4e6', box: P.wood, flowers: fl, wide: true });
  win(v, 'pz', z1, 11, 4, 2, 2, { frame: '#fff4e6', box: P.wood, flowers: fl, wide: true });
  win(v, 'px', x1, 5, 4, 2, 2, { frame: '#fff4e6', box: P.wood, flowers: fl });
  win(v, 'nx', x0, 5, 4, 2, 2, { frame: '#fff4e6', box: P.wood, flowers: fl });
  if (L >= 3) { win(v, 'pz', z1, 3, 8, 2, 1, { sill: false }); win(v, 'pz', z1, 11, 8, 2, 1, { sill: false }); }
  // techo de pasto con flores (cumbrera a lo largo de x)
  const roofC = '#7fd36e';
  const rt = gable(v, 'x', x0, x1, z0, z1, H + 1, roofC, { wall: logB, trim: '#5fb85a', oh: 1 });
  const r = rng(40 + L);
  const nFlowers = 6 + L * 5;
  for (let i = 0; i < nFlowers; i++) {
    const x = x0 - 1 + Math.floor(r() * 14), z = z0 - 1 + Math.floor(r() * 11);
    // buscar la superficie del techo
    for (let y = rt + 1; y > H; y--) if (v.has(x, y, z)) { v.set(x, y + 1, z, pick(r, [P.pink, '#ffffff', C.yellow, P.lilac, C.red])); break; }
  }
  // chimenea de piedra
  chimney(m, 4, 4, H + 1, rt + 2, P.stone);
  // porche con postes y alero rosado
  v.box(x0, 1, z1 + 1, 12, 1, 2, P.wood);
  for (const x of [x0, x1]) v.box(x, 2, z1 + 2, 1, 5, 1, P.woodD);
  awning(v, 'pz', z1, x0, 7, 12, P.pink, '#ffffff', { depth: 2 });
  // jardín: canteros y senderito
  path(v, 7, 8, 13, 15, 0, '#e9d9c4');
  flowerBed(v, 1, 1, 13, 5, 2, 21 + L);
  flowerBed(v, 10, 1, 13, 5, 2, 29 + L);
  if (L >= 2) { // macetas colgantes
    v.set(x0 + 1, 6, z1 + 2, P.woodD); v.set(x0 + 1, 5, z1 + 2, P.pink); v.set(x1 - 1, 6, z1 + 2, P.woodD); v.set(x1 - 1, 5, z1 + 2, P.lilac);
    tulip(v, 0, 1, 11, C.red); tulip(v, 15, 1, 11, C.yellow); tulip(v, 15, 1, 9, P.pink);
  }
  if (L >= 3) { bush(v, 14.5, 1, 4, 1.7, C.leaf, [P.pink, '#ffffff'], 8); bush(v, 0.8, 1, 4, 1.5, C.leaf, [C.yellow], 9); }
  if (L >= 4) { doorLamps(m, 'pz', z1, 5, 10, 3); for (let x = x0 - 1; x <= x1 + 1; x++) v.set(x, H + 1, z1 + 1, P.gold); }
  if (L >= 5) {
    // regadera dorada y mariposas brillantes
    sparkle(m, 3, 12, 14, P.pinkL); sparkle(m, 12, 13, 14, '#ffffff');
    spinStar(m, 7, rt + 2, 6);
  }
}

// ======================= CHALET LILA =======================
function chalet(m, L) {
  const v = m.v;
  lot(v, 16, 16, grassLot);
  const wall = P.lilacL, beam = '#ffffff';
  const x0 = 2, x1 = 13, z0 = 2, z1 = 10;
  const floors = L >= 3 ? 3 : 2, FH = 6;
  const top = 1 + FH * floors;
  v.box(x0, 1, z0, 12, top - 1, 9, (x, y, z) => (y === 1 ? C.stoneL : ((y - 1) % FH === 0 ? beam : wall)));
  // vigas verticales en esquinas (estilo entramado)
  for (const x of [x0, x1]) for (const z of [z0, z1]) v.box(x, 2, z, 1, top - 2, 1, beam);
  for (let f = 0; f < floors; f++) {
    const wy = 3 + f * FH;
    if (f === 0) {
      door(v, 'pz', z1, 7, 2, 2, 4, P.lilacD, { frame: beam, step: C.stoneL, glass: false });
      win(v, 'pz', z1, 3, wy, 2, 2, { shutters: P.lilacD });
      win(v, 'pz', z1, 11, wy, 2, 2, { shutters: P.lilacD });
    } else {
      // puerta balcón + ventanas
      fbox(v, 'pz', z1, 7, wy - 1, 2, 4, 0, C.glassD); fbox(v, 'pz', z1, 7, wy + 2, 2, 1, 0, C.glass); fset(v, 'pz', z1, 7, wy + 2, 0, '#ffffff');
      win(v, 'pz', z1, 3, wy, 2, 2, { shutters: P.lilacD, box: L >= 2 ? P.lilacD : undefined, flowers: [P.pink, '#ffffff'] });
      win(v, 'pz', z1, 11, wy, 2, 2, { shutters: P.lilacD, box: L >= 2 ? P.lilacD : undefined, flowers: [C.yellow, P.pink] });
      // balcón con baranda
      const by = 1 + f * FH;
      v.box(x0 + 1, by, z1 + 1, 10, 1, 2, P.wood);
      for (let x = x0 + 1; x <= x1 - 1; x++) { v.set(x, by + 1, z1 + 2, x % 2 ? beam : shade(beam, -0.06)); v.set(x, by + 2, z1 + 2, beam); }
      for (const x of [x0 + 1, x1 - 1]) { v.set(x, by + 1, z1 + 1, beam); v.set(x, by + 2, z1 + 1, beam); }
      if (L >= 2) { v.set(x0 + 2, by + 3, z1 + 2, P.pink); v.set(x1 - 2, by + 3, z1 + 2, C.red); v.set(x0 + 4, by + 3, z1 + 2, C.yellow); }
    }
    win(v, 'px', x1, 5, wy, 2, 2, { shutters: P.lilacD });
    win(v, 'nx', x0, 5, wy, 2, 2, { shutters: P.lilacD });
  }
  // techo empinado violeta con hastial al frente
  const rt = gable(v, 'z', x0, x1, z0, z1, top, C.roofLilac, { wall, trim: L >= 4 ? P.gold : '#ffffff', rise: 1, oh: 2, ridge: L >= 4 ? P.gold : undefined });
  // corazón en el hastial
  pattern(v, 'pz', z1, 6, top + 1, ['.X.X.', 'XXXXX', '.XXX.', '..X..'], P.pink);
  chimney(m, 4, 4, top + 1, rt, C.stoneL);
  // jardín
  path(v, 7, 8, 13, 15, 0);
  flowerBed(v, 1, 1, 14, 5, 2, 33 + L);
  flowerBed(v, 10, 1, 14, 5, 2, 37 + L);
  smallTree(v, 14, 1, 13, 4, 1.8, C.leaf, 7, L >= 3 ? [P.pink] : null);
  if (L >= 4) doorLamps(m, 'pz', z1, 5, 10, 3);
  if (L >= 5) { spinStar(m, 7, rt + 2, 7); sparkle(m, 2, top + 3, 12, '#ffffff'); }
}

// ======================= TORRE DE CRISTAL =======================
function torreCristal(m, L) {
  const v = m.v;
  lot(v, 16, 16, (x, z) => ((x + z) % 2 ? '#e8f4ff' : '#dcecfb'));
  const floors = 3 + L, FH = 5;
  const x0 = 3, x1 = 12, z0 = 3, z1 = 12;
  const frame = L >= 4 ? P.goldL : '#ffffff', band = L >= 4 ? P.gold : P.mintD;
  // lobby
  v.box(x0, 1, z0, 10, FH, 10, '#f4f0fb');
  for (let f = 0; f < floors; f++) {
    const y = 1 + FH * f;
    if (f === 0) continue;
    v.box(x0, y, z0, 10, FH, 10, (x, yy, z) => {
      const onX = x === x0 || x === x1, onZ = z === z0 || z === z1;
      const u = onZ ? x - x0 : z - z0;
      if (yy === y) return band; // losa
      if ((onX && onZ)) return frame;
      return (u % 3 === 0) ? frame : (yy === y + FH - 1 ? C.glass : (u + yy) % 5 === 0 ? '#ffffff' : C.glassD);
    });
    // balconcitos alternados
    if (f % 2 === 0) for (let x = x0 + 2; x <= x1 - 2; x++) { v.set(x, y, z1 + 1, '#ffffff'); v.set(x, y + 1, z1 + 1, x % 2 ? C.glass : '#ffffff'); }
  }
  // entrada
  door(v, 'pz', z1, 6, 1, 4, 4, C.glassD, { frame: P.mintD, step: '#ffffff' });
  fbox(v, 'pz', z1, 6, 1, 4, 4, 0, (i, j) => (j === 3 ? C.glass : i === 1 || i === 2 ? C.glassD : P.mintD));
  awning(v, 'pz', z1, 4, FH, 8, P.mint, '#ffffff', { depth: 2 });
  win(v, 'px', x1, 5, 2, 6, 3, { sill: false });
  win(v, 'nx', x0, 5, 2, 6, 3, { sill: false });
  win(v, 'pz', z1, 4, 2, 1, 3, { sill: false }); win(v, 'pz', z1, 11, 2, 1, 3, { sill: false });
  const roofY = 1 + FH * floors;
  // terraza + corona de cristal
  v.box(x0 - 1, roofY, z0 - 1, 12, 1, 12, band);
  v.box(x0 + 1, roofY + 1, z0 + 1, 8, 2, 8, '#ffffff');
  const cy = roofY + 3;
  const gem = m.glow;
  for (let j = 0; j < 6; j++) { const r = 4 - j * 0.7; gem.cylinder(7.5, cy + j, 7.5, Math.max(0.6, r), 1, j % 2 ? P.skyL : '#e6f6ff'); }
  for (let j = 0; j < 2; j++) gem.cylinder(7.5, cy - 1 + j, 7.5, 3, 1, P.sky);
  v.box(7, cy + 6, 7, 2, 4, 2, frame);
  v.set(7, cy + 10, 7, L >= 3 ? P.pink : C.red);
  // plantas en macetas y bancos en la vereda
  for (const x of [1, 14]) { v.set(x, 1, 14, P.mintD); bush(v, x, 2, 14, 1.1, C.leaf, null, x); }
  bush(v, 1, 1, 2, 1.3, C.leaf, [P.pink], 2); bush(v, 14, 1, 2, 1.3, C.leaf, [C.yellow], 3);
  if (L >= 2) for (let x = 3; x <= 12; x += 3) tulip(v, x, 1, 15, x % 2 ? P.pink : P.lilac);
  if (L >= 5) { spinStar(m, 7, cy + 12, 7, P.gold); sparkle(m, 2, roofY - 4, 13); sparkle(m, 13, roofY - 10, 13, P.skyL); }
}

// ======================= MANSIÓN DORADA =======================
function mansion(m, L) {
  const v = m.v;
  lot(v, 24, 24, (x, z) => ((Math.floor(x / 2) + Math.floor(z / 2)) % 2 ? '#a6e68d' : '#98df80'));
  const wall = '#fff2d6', trim = '#ffffff', gold = P.gold, roofC = C.roofPink;
  const cx0 = 6, cx1 = 17, z0 = 3, z1 = 12;
  const cf = L >= 3 ? 3 : 2, FH = 6;
  const ctop = 1 + FH * cf;
  // cuerpo central
  v.box(cx0, 1, z0, 12, ctop - 1, 10, (x, y) => (y === 1 ? C.stoneL : (y - 1) % FH === 0 ? gold : wall));
  // alas
  const wf = L >= 2 ? 2 : 1, wtop = 1 + FH * wf;
  for (const [a, b] of [[1, 5], [18, 22]]) {
    v.box(a, 1, z0 + 2, b - a + 1, wtop - 1, 8, (x, y) => (y === 1 ? C.stoneL : (y - 1) % FH === 0 ? gold : wall));
    for (let f = 0; f < wf; f++) {
      win(v, 'pz', z0 + 9, a + 1, 3 + f * FH, 3, 3, { arch: wall, archTop: gold, sill: '#ffffff', box: L >= 2 ? P.pinkD : undefined, flowers: [P.pink, '#ffffff'] });
      win(v, a === 1 ? 'nx' : 'px', a === 1 ? a : b, z0 + 4, 3 + f * FH, 3, 3, { sill: '#ffffff' });
    }
    hip(v, a, b, z0 + 2, z0 + 9, wtop, roofC, { trim: gold, oh: 1 });
  }
  // ventanas del cuerpo central
  for (let f = 0; f < cf; f++) {
    const wy = 3 + f * FH;
    for (const u of [7, 15]) win(v, 'pz', z1, u, wy, 2, 3, { arch: wall, archTop: gold, sill: '#ffffff', box: L >= 2 && f > 0 ? P.pinkD : undefined, flowers: [C.red, '#ffffff'] });
    if (f > 0) win(v, 'pz', z1, 11, wy, 2, 3, { arch: wall, archTop: gold, sill: '#ffffff' });
    win(v, 'px', cx1, 6, wy, 3, 3, { sill: '#ffffff' });
    win(v, 'nx', cx0, 6, wy, 3, 3, { sill: '#ffffff' });
  }
  // pórtico: escalinata, columnas y frontón dorado
  door(v, 'pz', z1, 10, 2, 4, 5, P.pinkD, { frame: gold, knob: gold });
  v.box(9, 1, z1 + 1, 6, 1, 4, C.stoneL);
  v.box(8, 1, z1 + 4, 8, 1, 1, '#ffffff');
  const ph = FH + 1;
  for (const x of [9, 14]) { v.box(x, 2, z1 + 3, 1, ph - 1, 1, '#ffffff'); v.set(x, ph + 1, z1 + 3, gold); v.set(x, 2, z1 + 3, C.stoneL); }
  v.box(8, ph + 1, z1 + 1, 8, 1, 3, '#ffffff');
  for (let s = 0; s < 4; s++) v.box(8 + s, ph + 2 + s, z1 + 3, 8 - s * 2, 1, 1, s === 3 ? gold : (s === 0 ? gold : '#ffffff'));
  v.box(9, ph + 2, z1 + 1, 6, 3, 2, wall);
  pattern(v, 'pz', z1 + 3, 11, ph + 2, ['XX'], P.pink);
  // techo central a cuatro aguas
  const rt = hip(v, cx0, cx1, z0, z1, ctop, roofC, { trim: gold, oh: 1 });
  // buhardillas
  for (const u of [9, 14]) {
    v.box(u, ctop, z1 - 1, 2, 3, 2, wall);
    v.set(u, ctop + 1, z1, C.glass); v.set(u + 1, ctop + 1, z1, C.glassD); v.set(u, ctop + 2, z1, '#ffffff'); v.set(u + 1, ctop + 2, z1, '#ffffff');
    v.box(u - 1, ctop + 3, z1 - 1, 4, 1, 3, roofC); v.box(u, ctop + 4, z1 - 1, 2, 1, 3, shade(roofC, -0.08));
  }
  chimney(m, 7, 5, ctop, rt + 2, C.stoneL);
  // cúpula dorada (nivel 4+)
  let peak = rt;
  if (L >= 4) {
    v.box(10, rt - 1, 6, 4, 3, 4, wall);
    for (let j = 0; j < 4; j++) v.cylinder(11.5, rt + 2 + j, 7.5, 3 - j * 0.7, 1, j % 2 ? P.goldD : gold);
    v.box(11, rt + 6, 7, 1, 2, 1, gold);
    peak = rt + 8;
  }
  // fuente privada al frente
  const fx = 4, fz = 18;
  v.cylinder(fx, 1, fz, 2.6, 1, C.stoneL);
  v.cylinder(fx, 2, fz, 2.6, 1, C.stoneL);
  v.cylinder(fx, 2, fz, 1.8, 1, C.water);
  v.box(fx, 2, fz, 1, 3, 1, '#ffffff');
  const drop = m.part('drop', [fx + 0.5, 5, fz + 0.5], { cast: false });
  drop.set(fx, 5, fz, C.waterL); drop.set(fx - 1, 5, fz, C.water); drop.set(fx + 1, 5, fz, C.water); drop.set(fx, 5, fz - 1, C.water); drop.set(fx, 5, fz + 1, C.water); drop.set(fx, 6, fz, '#ffffff');
  m.animate((parts, ph0) => { const d = parts.drop[0], by = d.position.y; return (dt, t) => { const k = (t * 1.4 + ph0) % 1; d.position.y = by + Math.sin(k * Math.PI) * 0.12; d.scale.setScalar(0.8 + Math.sin(k * Math.PI) * 0.3); }; });
  // jardín formal
  path(v, 10, 13, 17, 23, 0, '#f3ead6');
  for (const x of [8, 15]) for (let z = 17; z <= 22; z += 2) bush(v, x, 1, z, 1, C.leafD, null, z);
  flowerBed(v, 17, 1, 17, 5, 5, 61 + L, { colors: [P.pink, '#ffffff', C.red, P.peach] });
  const fenceC = L >= 3 ? gold : '#ffffff';
  for (let x = 0; x < 24; x++) { if (x >= 10 && x <= 13) continue; v.set(x, 1, 23, fenceC); if (x % 2 === 0) v.set(x, 2, 23, fenceC); if (x % 4 === 0) v.set(x, 3, 23, gold); }
  for (const x of [9, 14]) { v.box(x, 1, 23, 1, 4, 1, '#ffffff'); v.set(x, 5, 23, gold); }
  if (L >= 2) { smallTree(v, 1, 1, 13, 5, 2, C.leaf, 21, [P.pink]); smallTree(v, 22, 1, 13, 5, 2, C.leaf, 22, ['#ffffff']); }
  if (L >= 4) doorLamps(m, 'pz', z1 + 3, 8, 15, 2);
  if (L >= 3) { wavingFlag(m, 3, wtop + 2, z0 + 5, 3, 2, P.pink); m.v.box(3, wtop, z0 + 5, 1, 5, 1, '#ffffff'); }
  if (L >= 5) {
    wavingFlag(m, 20, wtop + 2, z0 + 5, 3, 2, P.lilac); m.v.box(20, wtop, z0 + 5, 1, 5, 1, '#ffffff');
    crown(v, 9, peak, 5, 5, gold, P.pink); v.box(10, peak - 1, 6, 3, 1, 3, gold);
    spinStar(m, 11, peak + 3, 7);
    sparkle(m, 4, 9, 18, '#ffffff'); sparkle(m, 20, 14, 15, P.goldL);
  }
}

export const HOUSE_BUILDERS = { casita, cabana, chalet, torre_cristal: torreCristal, mansion };
