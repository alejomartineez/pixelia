// Negocios: cada uno con su "firma" bien reconocible en el techo o la fachada.
import {
  P, C, shade, lot, path, win, door, awning, gable, hip, cone, flowerBed, bush, smallTree, tulip, flower,
  fbox, fset, pattern, HEART3, HEART5, STAR5, addSmoke, spinStar, sparkle, wavingFlag, crown, rng, pick, uid, doorLamps,
  FLOWER_COLORS, eraStyle, eraWall, eraRoof, eraOpening, eraVertical, eraFence, eraGround,
} from './models-kit.js';
import { BIG_SHOP_BUILDERS } from './models-shops3.js';   // Cine, Baños Termales, Rueda y Teatro (3×3)

const S = 1 / 8;

// ---------- piezas compartidas ----------
// Negocios de 2×2 con arte por época: shopBody y sidewalk leen la época del modelo en curso (ERA, la pone withEra) y
// arman la estructura por nivel; cada negocio conserva su firma (cartel, vidriera, toldo) encima.
//   1 local de la época · 2 galería con postes bajo el toldo y depósito al costado · 3 un piso más y alero del techo
//   4 elemento vertical de la época y ventanas más grandes · 5 letrero iluminado alrededor del techo y cerco o vereda
let ERA = 1;
const withEra = (fn) => (m, L, o = {}) => { ERA = o.era || 1; try { fn(m, L, o); } finally { ERA = 1; } };

/** Edificio base de negocio 2x2. Devuelve medidas útiles. */
function shopBody(m, L, o) {
  const v = m.v, era = ERA, s = eraStyle(era);
  eraGround(m, era);
  const x0 = 2, x1 = m.W - 3, z0 = 2, z1 = o.z1 ?? 9;
  const GF = o.gf ?? 9, UF = 6;
  const floors = (o.floors ?? 1) + (era >= 4 ? 1 : 0) + (L >= 3 ? 1 : 0);
  const top = 1 + GF + (floors - 1) * UF;
  eraWall(m, x0, 1, z0, x1 - x0 + 1, top - 1, z1 - z0 + 1, era, { FH: GF, seed: o.seed || 5 });
  // cornisa entre pisos
  for (let f = 1; f < floors; f++) { const y = 1 + GF + (f - 1) * UF; for (let x = x0; x <= x1; x++) v.set(x, y - 1, z1 + 1, s.trim); }
  // techo plano de la época con parapeto; Madera: fachada falsa de tablas al frente
  eraRoof(m, x0, x1, z0, z1, top, era, { kind: 'plano', oh: 1 });
  if (s.id === 'madera') for (let x = x0 - 1; x <= x1 + 1; x++) {
    const hh = 2 + (Math.abs(x - (x0 + x1) / 2) < 3 ? 2 : Math.abs(x - (x0 + x1) / 2) < 5 ? 1 : 0);
    for (let j = 1; j <= hh; j++) v.set(x, top + j, z1 + 1, j === hh ? s.trim : (j % 3 === 0 ? s.wallD : s.wall));
  }
  // nivel 3+: alero inclinado alrededor del techo (otro perfil de techo)
  if (L >= 3) for (let st = 1; st <= 2; st++) for (let x = x0 - st; x <= x1 + st; x++) for (let z = z0 - st; z <= z1 + st; z++) {
    if (x > x0 - st && x < x1 + st && z > z0 - st && z < z1 + st) continue;
    if (s.id === 'madera' && z === z1 + st) continue;
    v.set(x, top + 1 - st, z, s.id === 'vidrio' ? (st === 1 ? s.light : null) : st === 1 ? s.roof2 || s.roof : s.roofD);
  }
  // ventanas: pisos altos al frente y los costados
  const big = L >= 4;
  for (let f = 1; f < floors; f++) {
    const wy = 2 + GF + (f - 1) * UF;
    if (o.upperWins !== false && s.id !== 'vidrio') for (const u of [3, 7, 11]) eraOpening(m, 'pz', z1, u - (s.id === 'hierro' ? 1 : 0), wy, era, 'ventana', { big: big && s.id !== 'hierro', box: L >= 2 && s.id !== 'hierro' ? (o.box || P.clayD) : undefined, flowers: o.flowers });
    eraOpening(m, 'px', x1, 3, wy, era, 'ventana', { big });
    eraOpening(m, 'nx', x0, 3, wy, era, 'ventana');
  }
  if (s.id === 'vidrio') for (let f = 1; f < floors; f++) fbox(v, 'pz', z1, x0 + 1, 2 + GF + (f - 1) * UF, x1 - x0 - 1, 2, 0, (i, j) => (i % 3 === 2 ? s.trim : j ? C.glass : C.glassD));
  eraOpening(m, 'px', x1, 3, 4, era, 'ventana', { big });
  eraOpening(m, 'nx', x0, 3, 4, era, 'ventana');
  return { x0, x1, z0, z1, top, GF, floors, trim: s.trim };
}

/** Vereda: la estructura por nivel (galería, depósito, elemento vertical, letrero y cerco) + macetas. */
function sidewalk(m, L, b, o = {}) {
  const v = m.v, era = ERA, s = eraStyle(era);
  const zF = m.D - 2;
  // 2+: galería con postes bajo el toldo y depósito al costado derecho
  if (L >= 2) {
    const pz = b.z1 + 3;
    for (let x = b.x0 - 1; x <= b.x1 + 1; x++) for (let z = b.z1 + 1; z <= pz; z++) if (!v.has(x, 1, z)) v.set(x, 1, z, s.id === 'madera' ? s.wallD : s.trim);
    for (const x of [b.x0 - 1, b.x1 + 1]) {
      v.box(x, 2, pz, 1, b.GF - 3, 1, s.id === 'madera' ? s.trim : s.id === 'piedra' ? s.trim : s.trim);
      if (s.id === 'piedra') v.set(x, b.GF - 1, pz, s.wall);
    }
    const sx = b.x1 + 1, sh = Math.min(b.GF - 1, 7);
    eraWall(m, sx, 1, b.z0 + 1, 2, sh, 5, era, { FH: 9 });
    for (let z = b.z0; z <= b.z0 + 6; z++) for (const x of [sx, sx + 1]) v.set(x, sh + 1, z, s.id === 'vidrio' ? s.light : s.id === 'hierro' ? s.sheet : s.roof);
  }
  if (L >= 2) {
    for (const x of o.pots || [1, m.W - 2]) { v.set(x, 1, zF, P.coral); v.set(x, 2, zF, shade(P.coral, -0.15)); bush(v, x, 3, zF, 1, C.leaf, [pick(rng(x), FLOWER_COLORS)], x); }
  }
  // 4+: elemento vertical de la época sobre el techo, atrás a la derecha
  if (L >= 4) {
    if (s.id === 'piedra') eraVertical(m, b.x1 - 2, b.top + 1, b.z0, era, { w: 3, h: 6 });
    else if (s.id === 'hierro') eraVertical(m, b.x1 - 3, b.top + 1, b.z0, era, { w: 4, h: 3 });
    else if (s.id === 'vidrio') eraVertical(m, b.x1 - 1, b.top + 1, b.z0 + 1, era, { h: 9 });
    else eraVertical(m, b.x1 - 1, b.top - 1, b.z0, era, { h: s.id === 'ladrillo' ? 10 : 6 });
    doorLamps(m, 'pz', b.z1, o.lampU ?? b.x0 + 1, o.lampU2 ?? b.x1 - 1, 3);
  }
  // 5: letrero iluminado (lamparitas por todo el borde del techo) y cerco de la época
  if (L >= 5) {
    for (let x = b.x0 - 1; x <= b.x1 + 1; x++) for (const z of [b.z0 - 1, b.z1 + 1]) if (x % 2 === 0 && !v.has(x, b.top + 2, z)) m.light.set(x, b.top + 2, z, x % 4 ? '#fff3cf' : C.yellow);
    for (let z = b.z0; z <= b.z1; z++) for (const x of [b.x0 - 1, b.x1 + 1]) if (z % 2 === 0 && !v.has(x, b.top + 2, z)) m.light.set(x, b.top + 2, z, z % 4 ? '#fff3cf' : C.yellow);
    eraFence(m, era, { gaps: o.gaps || [8, 9, 10, 11, 12] });
  }
}

/** Mesita con sombrilla */
function cafeTable(v, x, z, c1 = P.clay, c2 = '#ffffff') {
  v.box(x, 1, z, 1, 2, 1, '#ffffff');
  v.box(x - 1, 3, z - 1, 3, 1, 3, '#ffffff');
  v.set(x - 2, 1, z, P.woodD); v.set(x - 2, 2, z, P.wood); v.set(x + 2, 1, z, P.woodD); v.set(x + 2, 2, z, P.wood);
  v.box(x, 4, z, 1, 3, 1, '#ffffff');
  for (let i = -2; i <= 2; i++) for (let k = -2; k <= 2; k++) {
    const d = Math.abs(i) + Math.abs(k);
    if (d <= 3) v.set(x + i, 7, z + k, (i + k + 10) % 2 ? c1 : c2);
    if (d <= 1) v.set(x + i, 8, z + k, c1);
  }
}

// ======================= PANADERÍA =======================
function croissant(v, cx, cy, cz, R = 5) {
  // medialuna: círculo grande menos uno corrido hacia abajo => puntas finitas
  const icy = cy - R * 0.55, ir = R * 0.8;
  for (let x = Math.floor(cx - R - 1); x <= Math.ceil(cx + R + 1); x++) for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) {
    const px = x + 0.5, py = y + 0.5;
    const dO = Math.hypot(px - cx, py - cy), dI = Math.hypot(px - cx, py - icy);
    if (dO > R || dI < ir) continue;
    const t = Math.min(R - dO, dI - ir);
    const depth = t > 0.9 ? 1 : 0;
    const a = Math.atan2(py - cy, px - cx);
    const band = Math.floor((a + Math.PI) / (Math.PI / 5)) % 2;
    for (let dz = -depth; dz <= depth; dz++) {
      const edge = Math.abs(dz) === depth && depth > 0;
      const c = band ? (edge ? C.waffleD : C.waffle) : (edge ? '#e9a957' : '#ffd88a');
      v.set(x, y, cz + dz, py > cy + R * 0.55 && !edge ? '#ffe3a8' : c);
    }
  }
}
function panaderia(m, L) {
  const v = m.v;
  const b = shopBody(m, L, { wall: '#ffe2c4', shutters: '#c98d45', box: P.wood, flowers: [P.clay, '#ffffff'], roof: '#f0d0b0' });
  const { x0, x1, z1, top, GF } = b;
  // vidriera con tortas y medialunas pintadas
  fbox(v, 'pz', z1, 3, 3, 6, 4, 0, (i, j) => (j === 3 ? C.glass : C.glassD));
  fbox(v, 'pz', z1, 2, 2, 8, 1, 1, P.wood);
  pattern(v, 'pz', z1, 3, 3, ['.ooo..', 'oo.oo.', '..pp..', '.pwwp.'], { o: C.waffle, p: P.clay, w: '#ffffff' });
  door(v, 'pz', z1, 10, 2, 2, 5, P.woodD, { glass: true, frame: '#ffffff' });
  awning(v, 'pz', z1, x0, GF, 12, P.peach, '#ffffff', { depth: 3 });
  // cartel blanco con borde rosa y medialuna gigante adelante
  for (let x = 2; x <= 11; x++) for (let y = top + 1; y <= top + 9; y++) {
    const edge = x === 2 || x === 11 || y === top + 1 || y === top + 9;
    v.set(x, y, 5, edge ? P.peach : '#ffffff');
    v.set(x, y, 4, edge ? shade(P.peach, -0.1) : '#f4ede6');
  }
  for (const x of [3, 10]) v.set(x, top + 10, 5, P.peach);
  croissant(v, 7, top + 3, 7, 5.2);
  // chimenea del horno
  v.box(12, top + 1, 2, 2, 10, 2, (x, y) => (y % 2 ? C.stoneL : shade(C.stoneL, -0.08))); v.box(12, top + 11, 2, 2, 1, 2, C.stoneD);
  addSmoke(m, 12, top + 12, 2, "#fff8f0");
  // pizarrón y mesita
  v.box(1, 1, 13, 1, 3, 2, P.ink); v.set(1, 2, 14, '#ffffff'); v.set(1, 3, 13, P.clay);
  if (L >= 2) { cafeTable(v, 12, 13, P.peach, '#ffffff'); }
  if (L >= 3) { v.box(4, 1, 12, 3, 1, 2, P.wood); v.set(5, 2, 12, P.clay); v.set(5, 3, 12, '#ffffff'); v.set(5, 4, 12, C.red); }
  sidewalk(m, L, b, { pots: [1, 8] });
}

// ======================= HELADERÍA =======================
function heladeria(m, L) {
  const v = m.v;
  const b = shopBody(m, L, { wall: P.mintL, pave: ['#ffffff', '#faf3e9'], shutters: P.clay, roof: '#a8eed8', box: P.clay, flowers: [P.slate, '#ffffff'] });
  const { x0, x1, z1, top, GF } = b;
  // mostrador con baldes de helado de colores
  fbox(v, 'pz', z1, 3, 3, 6, 4, 0, (i, j) => (j === 3 ? C.glass : C.glassD));
  pattern(v, 'pz', z1, 3, 3, ['pmlyp.', 'wwwwww'], { p: P.clay, m: P.mint, l: P.slate, y: C.yellow, w: '#ffffff' });
  door(v, 'pz', z1, 10, 2, 2, 5, P.clay, { glass: true, frame: '#ffffff', heart: '#ffffff' });
  awning(v, 'pz', z1, x0, GF, 12, P.clay, '#ffffff', { depth: 3 });
  // cucurucho gigante girando en el techo
  const cx = 8, cz = 6, y0 = top + 1;
  v.cylinder(cx - 0.5, y0, cz - 0.5, 2.2, 1, P.clayD);
  const ic = m.part('cone', [cx, y0, cz]);
  const H = 7;
  for (let j = 0; j < H; j++) {
    const r = 0.6 + j * 0.42;
    ic.cylinder(cx - 0.5, y0 + 1 + j, cz - 0.5, r, 1, (x, y, z) => ((x + y + z) % 3 === 0 ? C.waffleD : C.waffle));
  }
  const sy = y0 + 1 + H;
  ic.sphere(cx - 0.5, sy + 1, cz - 0.5, 3.3, 2.4, 3.3, (x, y, z) => (y <= sy && (x + z) % 3 === 0 ? shade(P.clay, -0.12) : P.clay));
  ic.sphere(cx - 0.5, sy + 4, cz - 0.5, 2.7, 2.1, 2.7, P.mint);
  ic.sphere(cx - 0.5, sy + 6.5, cz - 0.5, 2.0, 1.7, 2.0, P.slateL);
  // chispitas de colores
  const r = rng(7);
  for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, yy = sy + 1 + Math.floor(r() * 7); const rr = yy > sy + 5 ? 2 : 3; ic.set(Math.round(cx - 0.5 + Math.cos(a) * rr), yy, Math.round(cz - 0.5 + Math.sin(a) * rr), pick(r, [C.yellow, P.sky, '#ffffff', C.red])); }
  ic.set(cx, sy + 9, cz, C.red); ic.set(cx - 1, sy + 9, cz, C.red); ic.set(cx, sy + 10, cz - 1, C.leafD);
  m.animate((parts, ph) => { const o = parts.cone[0]; return (dt, t) => { o.rotation.y = (t + ph) * 0.6; }; });
  // mesitas
  cafeTable(v, 3, 13, P.mint, '#ffffff');
  if (L >= 2) cafeTable(v, 12, 13, P.clay, '#ffffff');
  // carrito de helados (nivel 3+)
  if (L >= 3) { v.box(7, 1, 13, 3, 2, 2, '#ffffff'); v.box(7, 3, 13, 3, 1, 2, P.sky); v.set(7, 1, 15, P.ink); v.set(9, 1, 15, P.ink); v.set(8, 4, 13, P.clay); }
  sidewalk(m, L, b, { pots: [15] });
}

// ======================= FLORERÍA =======================
function floreria(m, L) {
  const v = m.v;
  const b = shopBody(m, L, { wall: '#fdfdf6', pave: ['#e9f7e3', '#dff2d8'], shutters: P.mintD, roof: '#d8f2e6', parapet: false, box: P.mintD, flowers: [P.clay, C.yellow] });
  const { x0, x1, z0, z1, top, GF } = b;
  // invernadero de vidrio en el techo
  const gtop = gable(v, 'x', x0 + 1, x1 - 1, z0 + 1, z1 - 1, top + 1, '#ffffff', { wall: C.glass, oh: 0, stripes: false });
  for (let x = x0 + 1; x <= x1 - 1; x++) for (let y = top + 1; y <= gtop; y++) for (let z = z0; z <= z1; z++) {
    const c = v.get(x, y, z);
    if (c != null && (x - x0) % 3 !== 0) v.set(x, y, z, (y + z) % 4 === 0 ? 0xffffff : 0xbfe8ff);
  }
  for (let x = x0 + 2; x <= x1 - 2; x += 3) v.set(x, top + 2, z0 + 3, P.clay);
  // vidriera con ramos
  fbox(v, 'pz', z1, 3, 3, 6, 4, 0, (i, j) => (j === 3 ? C.glass : C.glassD));
  pattern(v, 'pz', z1, 3, 3, ['p.y.l.', 'g.g.g.', 'gggggg'], { p: P.clay, y: C.yellow, l: P.slate, g: C.leaf });
  door(v, 'pz', z1, 10, 2, 2, 5, P.mintD, { glass: true, frame: '#ffffff' });
  awning(v, 'pz', z1, x0, GF, 12, P.mint, '#ffffff', { depth: 2 });
  // flor gigante sobre la marquesina
  const fx = 7, fy = GF + 2, fz = z1 + 1;
  pattern(v, 'pz', fz, fx - 2, fy, ['.p.p.', 'ppypp', '.ppp.', '..g..', '.gg..'], { p: P.clay, y: C.yellow, g: C.leaf });
  // gradas con macetas
  const cols = [P.clay, C.red, C.yellow, P.slate, '#ffffff', P.peach];
  for (let i = 0; i < 3; i++) {
    v.box(1, 1 + i, 11 + i, 6, 1, 1, P.wood);
    for (let x = 1; x <= 6; x += 2) { v.set(x, 2 + i, 11 + i, P.coral); flower(v, x, 3 + i, 11 + i, cols[(x + i) % cols.length], 0); v.set(x + 1, 3 + i, 11 + i, C.leaf); }
  }
  for (let x = 10; x <= 14; x += 2) { v.box(x, 1, 13, 1, 2, 1, P.coral); bush(v, x, 3, 13, 1, C.leaf, [cols[x % cols.length]], x); }
  // macetas colgantes
  for (const x of [x0, x1]) { v.set(x, GF - 1, z1 + 2, P.goldD); v.set(x, GF - 2, z1 + 2, P.coral); v.set(x, GF - 3, z1 + 2, C.leaf); v.set(x, GF - 2, z1 + 3, P.clay); }
  if (L >= 2) { tulip(v, 15, 1, 10, C.red); tulip(v, 15, 1, 7, P.clay); tulip(v, 0, 1, 7, C.yellow); }
  if (L >= 3) for (let x = x0; x <= x1; x += 2) v.set(x, GF + 1 + 6, z1 + 1, x % 4 === 0 ? P.clay : C.yellow);
  sidewalk(m, L, b, { pots: [] });
}

// ======================= CAFÉ GATITO =======================
function cafeteria(m, L) {
  const v = m.v;
  const fur = '#ffd9b8', furD = '#f3c39a';
  const b = shopBody(m, L, { wall: fur, wallFn: (x, y, z) => ((y + Math.floor(x / 3)) % 7 === 0 ? furD : fur), pave: ['#fdf6e3', '#f9f3e9'], shutters: P.slateD, roof: furD, parapet: false, gf: 10, upperWins: false });
  const { x0, x1, z0, z1, top, GF } = b;
  // orejas de gato (triángulos con interior rosa)
  const ear = ['..XX..', '.XppX.', 'XppppX', 'XXXXXX'];
  for (const ex of [x0, x1 - 5]) {
    pattern(v, 'pz', z1 - 1, ex, top + 1, ear.map(r => r.replace(/p/g, 'X')), furD);
    pattern(v, 'pz', z1, ex, top + 1, ear, { X: fur, p: P.clayL });
  }
  // cara en la fachada (arriba de la puerta)
  const fy = top - 5;
  pattern(v, 'pz', z1, 3, fy, [
    '.kk....kk.',
    'kwkk..kwkk',
    'kkkk..kkkk',
    '.kk....kk.',
    '....pp....',
    '...k..k...',
  ], { k: P.ink, w: '#ffffff', p: P.clay }, 0);
  // cachetes rosados y bigotes
  fbox(v, 'pz', z1, 2, fy + 1, 1, 1, 0, P.clay); fbox(v, 'pz', z1, 13, fy + 1, 1, 1, 0, P.clay);
  for (const u of [x0, x1]) { fset(v, 'pz', z1, u, fy + 2, 0, P.inkL); fset(v, 'pz', z1, u, fy, 0, P.inkL); }
  // planta baja: puerta y ventana con taza
  door(v, 'pz', z1, 7, 2, 2, 4, P.slateD, { glass: true, frame: '#ffffff' });
  win(v, 'pz', z1, 3, 3, 3, 3, { frame: '#ffffff', sill: P.wood });
  win(v, 'pz', z1, 11, 3, 3, 3, { frame: '#ffffff', sill: P.wood });
  pattern(v, 'pz', z1, 11, 3, ['www', 'wwh', 'ww.'], { w: '#ffffff', h: '#ffffff' });
  // patitas sobre la cornisa
  for (const x of [5, 9]) { v.box(x, top + 1, z1, 2, 1, 2, '#ffffff'); v.set(x, top + 1, z1 + 2, P.clayL); }
  // cola que se mueve (lado derecho)
  const tail = m.part('tail', [x1 + 1, 3, 5.5]);
  for (let j = 0; j < 8; j++) tail.set(x1 + 1 + (j > 5 ? j - 5 : 0), 3 + j, 5, j > 5 ? furD : fur);
  tail.set(x1 + 3, 10, 5, furD); tail.set(x1 + 3, 11, 5, '#ffffff');
  m.animate((parts, ph) => { const o = parts.tail[0]; return (dt, t) => { o.rotation.x = Math.sin((t + ph) * 2.6) * 0.35; }; });
  // cartel taza de café humeante
  const sx = 13, sy = GF - 1;
  v.box(sx, sy, z1 + 1, 1, 1, 2, P.goldD);
  pattern(v, 'pz', z1 + 3, sx - 1, sy - 4, ['wwwh', 'wwwh', '.ww.', 'pppp'], { w: '#ffffff', h: '#ffffff', p: P.clay });
  addSmoke(m, sx - 1, sy, z1 + 3, '#ffffff');
  if (L >= 2) cafeTable(v, 2, 13, P.slate, '#ffffff');
  // tazón gigante en la vereda
  v.box(11, 1, 12, 3, 2, 3, '#ffffff'); v.box(12, 3, 13, 1, 1, 1, P.woodD); v.set(14, 2, 13, '#ffffff');
  // gatito durmiendo en la vereda (nivel 3+)
  if (L >= 3) { v.box(7, 1, 13, 3, 1, 2, '#ffffff'); v.box(8, 2, 13, 2, 1, 2, '#ffffff'); v.set(7, 2, 14, '#ffffff'); v.set(9, 3, 13, '#ffffff'); v.set(8, 3, 13, P.clayL); }
  sidewalk(m, L, b, { pots: [15], lampU: 1, lampU2: 14 });
}

// ======================= SALÓN DE BELLEZA =======================
function salon(m, L) {
  const v = m.v;
  const b = shopBody(m, L, { wall: '#fde9d8', pave: ['#ffffff', '#fbf5ed'], shutters: P.slate, roof: '#f5d8bf', box: P.slateD, flowers: [P.clay, '#ffffff'] });
  const { x0, x1, z0, z1, top, GF } = b;
  // vidriera: sillón + secador de pie
  fbox(v, 'pz', z1, 3, 3, 6, 5, 0, (i, j) => (j === 4 ? C.glass : C.glassD));
  pattern(v, 'pz', z1, 3, 3, ['.ddd..', '.d.d..', '..|...', '.pp..s', '.pp..s'], { d: P.slateD, '|': P.inkL, p: P.clay, s: '#ffffff' });
  door(v, 'pz', z1, 10, 2, 2, 5, P.slate, { glass: true, frame: '#ffffff', heart: P.clay });
  awning(v, 'pz', z1, x0, GF, 12, P.slate, '#ffffff', { depth: 2, stripe: 2 });
  // espejo de mano gigante en el techo
  const mx = 7, my = top + 2, mz = 6;
  v.box(mx, top + 1, mz, 2, 4, 1, P.goldD); // mango
  const rows = ['..ggggg..', '.gsssssg.', 'gsswsssg.', 'gswsssssg', 'gsssssssg', 'gsssssssg', '.gsssssg.', '..ggggg..'];
  for (let r = 0; r < rows.length; r++) for (let i = 0; i < rows[r].length; i++) {
    const ch = rows[r][i]; if (ch === '.') continue;
    const c = ch === 'g' ? P.gold : ch === 'w' ? '#ffffff' : '#d6ecff';
    const y = my + 4 + (rows.length - 1 - r), x = mx - 3 + i;
    if (ch === 'g') { v.set(x, y, mz, c); v.set(x, y, mz + 1, c); } else { v.set(x, y, mz, P.goldD); m.glow.set(x, y, mz + 1, c); }
  }
  pattern(v, 'pz', mz + 2, mx, my + 8, ['X'], P.clay);
  // secador de pelo colgando como cartel (lado derecho)
  const sx = x1 + 1, sy = GF - 1;
  v.box(sx, sy + 2, 3, 1, 1, 1, P.goldD);
  v.box(sx, sy - 1, 2, 2, 3, 4, P.clay); // cuerpo
  v.box(sx, sy, 6, 2, 1, 2, P.clayD); // boquilla
  v.box(sx, sy - 4, 3, 2, 3, 1, P.slate); // mango
  v.set(sx + 1, sy + 1, 3, '#ffffff'); v.set(sx + 2, sy, 3, P.clayD);
  // aire del secador (brillitos)
  sparkle(m, sx + 1, sy + 1, 9, '#ffffff', 3.2);
  // esmaltes en la vereda
  for (const [x, c] of [[2, C.red], [4, P.clay], [6, P.slate]]) { v.set(x, 1, 13, c); v.set(x, 2, 13, c); v.set(x, 3, 13, '#ffffff'); }
  if (L >= 2) { v.box(10, 1, 12, 4, 1, 2, P.clayL); v.box(10, 2, 12, 1, 2, 2, P.clayL); v.box(13, 2, 12, 1, 2, 2, P.clayL); }
  if (L >= 3) sparkle(m, 3, top + 3, 12, P.clayL, 2.7);
  sidewalk(m, L, b, { pots: [15] });
}

// ======================= PASTELERÍA NUBE =======================
function pasteleria(m, L) {
  const v = m.v;
  const b = shopBody(m, L, { wall: '#e3f3ff', wallFn: (x, y) => ((x + y) % 6 === 0 ? '#d3ecff' : '#e3f3ff'), pave: ['#ffffff', '#fbf6ee'], shutters: P.sky, roof: '#ffffff', parapet: false, box: P.skyD, flowers: [P.clay, '#ffffff'] });
  const { x0, x1, z0, z1, top, GF } = b;
  // nubes en el techo
  for (const [x, z, r] of [[x0 + 1, z0 + 1, 2.4], [x1 - 1, z0 + 1, 2.4], [x0 + 1, z1, 2.2], [x1 - 1, z1, 2.2], [7.5, z0, 2.6]]) v.sphere(x, top + 1, z, r, 1.8, r, (xx, y) => (y > top + 1 ? '#ffffff' : '#f2f8ff'));
  // cupcake gigante con cereza
  const cx = 7.5, cz = 5.5, y0 = top + 1;
  for (let j = 0; j < 4; j++) v.cylinder(cx, y0 + j, cz, 2.6 + j * 0.25, 1, (x, y, z) => ((x + z) % 2 ? P.clay : '#ffffff'));
  for (let j = 0; j < 5; j++) v.cylinder(cx, y0 + 4 + j, cz, Math.max(0.8, 3.6 - j * 0.7), 1, j % 2 ? P.clayL : '#faf4eb');
  const r = rng(3);
  for (let i = 0; i < 10; i++) { const a = r() * 6.28, yy = y0 + 4 + Math.floor(r() * 3); v.set(Math.round(cx + Math.cos(a) * 3), yy, Math.round(cz + Math.sin(a) * 3), pick(r, [P.sky, C.yellow, P.mint, P.slate])); }
  v.box(7, y0 + 9, 5, 2, 2, 2, C.red); v.set(8, y0 + 11, 5, C.leafD); // cereza
  // vidriera con tortas
  fbox(v, 'pz', z1, 3, 3, 6, 4, 0, (i, j) => (j === 3 ? C.glass : C.glassD));
  pattern(v, 'pz', z1, 3, 3, ['.y..p.', 'ppp.ww', 'www.pp'], { p: P.clay, w: '#ffffff', y: C.yellow });
  door(v, 'pz', z1, 10, 2, 2, 5, P.skyD, { glass: true, frame: '#ffffff', heart: '#ffffff' });
  // toldo en forma de nube (bolitas)
  for (let x = x0; x <= x1; x++) { v.set(x, GF, z1 + 1, '#ffffff'); if (x % 2 === 0) { v.set(x, GF - 1, z1 + 1, '#ffffff'); v.set(x, GF, z1 + 2, '#ffffff'); } }
  // torta en la vereda
  v.box(2, 1, 12, 3, 2, 3, P.clay); v.box(2, 3, 12, 3, 1, 3, '#ffffff'); v.box(3, 4, 13, 1, 1, 1, C.red);
  if (L >= 2) cafeTable(v, 12, 13, P.sky, '#ffffff');
  if (L >= 3) for (let x = x0; x <= x1; x += 3) v.set(x, GF + 7, z1 + 1, P.clayL);
  sidewalk(m, L, b, { pots: [7] });
}

// ======================= TIENDA BRILLO =======================
function boutique(m, L) {
  const v = m.v;
  const b = shopBody(m, L, { wall: '#dfe7f8', wallFn: (x, y, z) => ((x * 7 + y * 3 + z * 5) % 13 === 0 ? '#ffffff' : '#dfe7f8'), pave: ['#ffffff', '#fbf7f0'], shutters: P.clay, roof: '#ced9f3', box: P.clay, flowers: [P.slate, '#ffffff'] });
  const { x0, x1, z0, z1, top, GF } = b;
  // vidriera: vestido + cartera + zapatos
  fbox(v, 'pz', z1, 3, 2, 7, 6, 0, (i, j) => (j >= 5 ? C.glass : C.glassD));
  pattern(v, 'pz', z1, 3, 2, ['.k.....', '.p..ggg', 'ppp.gbg', 'ppp.bbb', 'ppp....', 'ppppsss'], { k: P.ink, p: P.clay, g: P.gold, b: P.slateD, s: C.red });
  door(v, 'pz', z1, 11, 2, 2, 5, P.clay, { glass: true, frame: P.gold });
  awning(v, 'pz', z1, x0, GF, 12, P.clay, P.slateL, { depth: 2 });
  // cartera gigante en el techo
  const bx = 4, by = top + 1, bz = 5;
  v.box(bx, by, bz, 8, 6, 3, (x, y) => (y === by ? P.clayD : (x + y) % 5 === 0 ? P.clayL : P.clay));
  v.box(bx, by + 4, bz + 3, 8, 2, 1, P.clayD); // solapa
  v.box(bx + 3, by + 3, bz + 3, 2, 2, 1, P.gold); // broche
  for (let i = 0; i <= 6; i++) { const x = bx + 1 + i, y = by + 6 + Math.round(Math.sin(i / 6 * Math.PI) * 3); v.set(x, y, bz + 1, P.gold); }
  // estrella del cartel + brillos
  pattern(v, 'pz', z1 + 1, 6, GF + 1, STAR5, P.gold);
  sparkle(m, 3, top + 3, 12, '#ffffff', 2.4); sparkle(m, 12, GF + 2, 13, P.clayL, 3);
  // percha con ropa en la vereda
  v.box(10, 1, 13, 1, 5, 1, P.gold); v.box(14, 1, 13, 1, 5, 1, P.gold); v.box(10, 6, 13, 5, 1, 1, P.gold);
  v.box(11, 3, 13, 1, 3, 1, P.mint); v.box(12, 3, 13, 1, 3, 1, P.clay); v.box(13, 3, 13, 1, 3, 1, C.yellow);
  if (L >= 2) { v.box(2, 1, 12, 3, 1, 3, P.slate); v.set(3, 2, 13, P.clay); v.set(3, 3, 13, '#ffffff'); }
  sidewalk(m, L, b, { pots: [7] });
}

export const SHOP_BUILDERS = {
  panaderia: withEra(panaderia), heladeria: withEra(heladeria), floreria: withEra(floreria), cafeteria: withEra(cafeteria),
  salon: withEra(salon), pasteleria: withEra(pasteleria), boutique: withEra(boutique), ...BIG_SHOP_BUILDERS,
};
