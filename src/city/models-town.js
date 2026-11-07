// Municipalidad (id 'castillo'): 8 niveles, uno por rango, atados a las épocas (DESIGN-CORE.md §4.3):
//   1–2 Madera (salón comunal → galería y campanario) · 3–4 Piedra (torre del reloj → soportales y fuentes)
//   5 Ladrillo (dos pisos, balcón y cúpula de tejas) · 6–7 Hierro (cúpula de hierro y vidrio → torre de hierro)
//   8 Vidrio y acero (torre de vidrio sobre un basamento con terraza verde).
// Lote de 32×32 vóxeles; frente a +Z. Dibuja con la capa de época de models-kit.js.
import {
  P, C, shade, win, door, gable, hip, cone, bush, smallTree, flowerBed, fbox, fset, pattern, addSmoke, spinStar, sparkle,
  wavingFlag, eraStyle, eraWall, eraRoof, eraOpening, eraVertical, eraFence, eraCrown, eraSlab,
} from './models-kit.js';
import { eraOfRank } from '../core/data.js';

const N = 32;

// ---------- piezas ----------
/** Plaza del lote: piso de la época, borde de pasto y el paseo hasta la puerta. */
function plaza(m, era, L) {
  const v = m.v, s = eraStyle(era);
  for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) {
    const rim = x < 1 || z < 1 || x > N - 2 || z > N - 2;
    let c;
    switch (s.id) {
      case 'madera': {
        const yard = x >= 5 && x <= 26 && z >= 19;
        c = rim || !yard ? ((x * 3 + z * 5) % 11 === 0 ? P.grassD : P.grass) : ((x * 7 + z * 3) % 9 === 0 ? '#b8966a' : '#c9a878');
        break;
      }
      case 'piedra': c = rim ? P.grass : (Math.floor(x / 2) + Math.floor(z / 2)) % 2 ? '#c4bba9' : '#b3aa98'; break;
      case 'ladrillo': c = rim ? P.grass : ((Math.floor(x / 2) + Math.floor(z / 2)) % 2 ? '#c58d70' : '#dccbab'); break;
      case 'hierro': c = rim ? P.grassD : (((z % 2 ? x + 1 : x) >> 1) % 2 ? '#8e8a84' : '#76726c'); break;
      default: c = rim ? P.grass : (x % 4 === 0 || z % 4 === 0) ? '#c9c5bb' : '#e4e1d9';
    }
    v.set(x, 0, z, c);
  }
  // paseo central
  for (let z = 20; z < N; z++) for (let x = 14; x <= 17; x++) v.set(x, 0, z, (x === 14 || x === 17) ? s.groundD === s.ground ? s.trim : shade(s.path, -0.14) : s.path);
}
/**
 * Salón con muros de la época, ventanas en el frente y los costados, y puerta centrada. Devuelve la y libre arriba.
 * b: {x0, x1, z0, z1, floors, FH}; o: {door: [u, w, h], big, sheet (galpón de chapa en Hierro), sideWins}
 */
function hall(m, era, b, o = {}) {
  const s = eraStyle(era), { x0, x1, z0, z1, floors, FH } = b;
  const H = floors * FH + 1;
  const top = eraWall(m, x0, 1, z0, x1 - x0 + 1, H, z1 - z0 + 1, era, { FH, sheet: o.sheet });
  if (s.id === 'vidrio') { if (o.door) eraOpening(m, 'pz', z1, o.door[0], 1, era, 'puerta', { w: o.door[1], h: o.door[2] }); return top; }
  const step = s.id === 'hierro' ? 5 : o.big ? 5 : 4;
  const [du, dw] = o.door || [0, 0];
  for (let f = 0; f < floors; f++) {
    const wy = 3 + f * FH;
    const start = s.id === 'hierro' ? x0 + 1 + ((5 - ((x0 + 1) % 5)) % 5) + 1 : x0 + 2;
    for (let u = start; u + 2 <= x1 - 1; u += step) {
      if (f === 0 && o.door && u + 3 > du - 1 && u < du + dw + 1) continue;
      eraOpening(m, 'pz', z1, u, wy, era, 'ventana', { big: o.big });
    }
    if (o.sideWins !== false) {
      const zs = s.id === 'hierro' ? z0 + 1 + ((5 - ((z0 + 1) % 5)) % 5) + 1 : z0 + 2;
      for (let u = zs; u + 2 <= z1 - 1; u += step) { eraOpening(m, 'px', x1, u, wy, era, 'ventana', { big: o.big }); eraOpening(m, 'nx', x0, u, wy, era, 'ventana'); }
    }
  }
  if (o.door) eraOpening(m, 'pz', z1, du, 1, era, 'puerta', { w: dw, h: o.door[2] || 5 });
  return top;
}
const CLOCK6 = ['.GGGG.', 'GWWKWG', 'GWWKWG', 'GWKKWG', 'GWWWWG', '.GGGG.'];
function clock(m, face, plane, u, y, ring) {
  pattern(m.v, face, plane, u, y, CLOCK6, { G: ring, W: '#f6efe0', K: P.ink }, 1);
}
/** Mástil con bandera ondeando. Devuelve el tope. */
function flagMast(m, x, z, h, flag, pole = '#ffffff', w = 4, fh = 3) {
  m.v.box(x, 1, z, 1, h, 1, pole);
  m.v.set(x, h + 1, z, P.gold);
  wavingFlag(m, x, h - fh, z, w, fh, flag);
  return h + 2;
}
function lamp(m, x, z, era, h = 5) {
  const s = eraStyle(era);
  const pole = s.id === 'madera' || s.id === 'vidrio' || s.id === 'hierro' ? s.trim : P.ink;
  m.v.box(x, 1, z, 1, h, 1, pole);
  m.light.set(x, h + 1, z, s.id === 'hierro' ? s.light : C.yellow);
  m.v.set(x, h + 2, z, pole);
}
function fountain(m, fx, fz, rim, r = 2.6) {
  const v = m.v;
  v.cylinder(fx, 1, fz, r, 2, rim);
  v.cylinder(fx, 2, fz, r - 0.9, 1, C.water);
  v.box(Math.floor(fx), 2, Math.floor(fz), 1, 3, 1, rim);
  m.light.set(Math.floor(fx), 5, Math.floor(fz), C.waterL);
}

// ======================= MADERA (1–2) =======================
function townMadera(m, L, flag) {
  const era = 1, v = m.v, s = eraStyle(era);
  let peak = 0;
  if (L === 1) {
    // salón comunal bajo, de troncos, con techo de paja
    const b = { x0: 9, x1: 22, z0: 10, z1: 18, floors: 1, FH: 7 };
    const y = hall(m, era, b, { door: [14, 3, 5] });
    peak = eraRoof(m, b.x0, b.x1, b.z0, b.z1, y, era, { kind: 'paja', axis: 'x' });
    // campana en un pórtico de palos
    v.box(25, 1, 13, 1, 9, 1, s.trim); v.box(28, 1, 13, 1, 9, 1, s.trim); v.box(25, 10, 13, 4, 1, 1, s.wallD);
    v.box(26, 7, 13, 2, 2, 1, P.goldD); v.set(26, 9, 13, s.joint);
    // leña apilada y un tronco con hacha
    for (let x = 24; x <= 28; x++) for (let y2 = 1; y2 <= 2; y2++) { v.set(x, y2, 17, (x + y2) % 2 ? s.wall : s.wallD); v.set(x, y2, 18, s.light); }
    v.box(5, 1, 22, 2, 1, 2, s.wallD); v.set(6, 2, 22, P.inkL);
    // cerco de palo a medias y dos árboles
    for (let x = 2; x <= 29; x++) if (x < 12 || x > 19) { if (x % 3 === 0) v.box(x, 1, 30, 1, 3, 1, s.fence); else v.set(x, 2, 30, s.wall); }
    smallTree(v, 4, 1, 12, 5, 2.4, P.leaf, 9); smallTree(v, 27, 1, 5, 4, 2.2, P.leaf, 10);
    peak = Math.max(peak, flagMast(m, 7, 25, 13, flag, s.trim));
    lamp(m, 12, 25, era, 4); lamp(m, 19, 25, era, 4);
  } else {
    // salón grande + anexo + galería al frente + campanario de madera
    const b = { x0: 7, x1: 24, z0: 9, z1: 18, floors: 1, FH: 8 };
    const y = hall(m, era, b, { door: [14, 4, 5] });
    peak = eraRoof(m, b.x0, b.x1, b.z0, b.z1, y, era, { kind: 'paja', axis: 'x' });
    const ya = hall(m, era, { x0: 1, x1: 6, z0: 11, z1: 18, floors: 1, FH: 6 }, { sideWins: false });
    eraRoof(m, 1, 6, 11, 18, ya, era, { kind: 'paja', axis: 'z' });
    eraOpening(m, 'pz', 18, 2, 3, era, 'ventana');
    // galería de troncos
    for (let x = 6; x <= 25; x++) for (let z = 19; z <= 21; z++) v.set(x, 1, z, s.wallD);
    for (const x of [7, 11, 20, 24]) v.box(x, 2, 21, 1, 6, 1, s.trim);
    for (let x = 6; x <= 25; x++) for (let z = 19; z <= 22; z++) v.set(x, 8 - Math.max(0, z - 20), z, z === 22 ? s.roofD : s.roof);
    // campanario de madera detrás de la entrada
    const tx = 14, tz = 11, TH = 24;
    eraWall(m, tx, 1, tz, 4, TH, 4, era, { noBase: true });
    fbox(v, 'pz', tz + 3, tx + 1, TH - 5, 2, 3, 0, P.ink); fbox(v, 'px', tx + 3, tz + 1, TH - 5, 2, 3, 0, P.ink);
    v.box(tx + 1, TH - 4, tz + 1, 2, 2, 2, P.goldD);
    const tt = hip(v, tx, tx + 3, tz, tz + 3, TH + 1, s.roof2, { oh: 1, trim: s.trim });
    v.box(tx + 1, tt + 1, tz + 1, 1, 4, 1, s.trim);
    wavingFlag(m, tx + 1, tt + 2, tz + 1, 4, 3, flag);
    peak = Math.max(peak, tt + 6);
    // chimenea de piedra del anexo
    eraVertical(m, 3, ya, 13, era, { h: 6 });
    // cerco completo, faroles, árboles y leña
    eraFence(m, era, { gaps: [13, 14, 15, 16, 17, 18] });
    for (const x of [11, 20]) lamp(m, x, 25, era, 5);
    smallTree(v, 28, 1, 7, 5, 2.4, P.leaf, 12); smallTree(v, 27, 1, 26, 4, 2, P.leaf, 13, [P.clay]);
    flowerBed(v, 4, 1, 22, 4, 2, 12);
    for (let x = 25; x <= 29; x++) for (let y2 = 1; y2 <= 2; y2++) { v.set(x, y2, 15, (x + y2) % 2 ? s.wall : s.wallD); v.set(x, y2, 16, s.light); }
  }
  m.height = peak + 1;
}

// ======================= PIEDRA (3–4) =======================
function townPiedra(m, L, flag) {
  const era = 2, v = m.v, s = eraStyle(era);
  const b = { x0: 7, x1: 24, z0: 9, z1: 19, floors: 1, FH: 9 };
  const y = hall(m, era, b, { door: [14, 4, 6], big: L >= 4 });
  let peak = eraRoof(m, b.x0, b.x1, b.z0, b.z1, y, era, { kind: 'dos_aguas', axis: 'x' });
  // torre del reloj cuadrada
  const tx = 13, tz = 10, TW = 6, TH = L >= 4 ? 30 : 25;
  eraWall(m, tx, 1, tz, TW, TH, TW, era, { noBase: true });
  clock(m, 'pz', tz + TW - 1, tx, TH - 8, L >= 4 ? P.gold : s.trim);
  for (const [f, pl] of [['px', tx + TW - 1], ['nx', tx]]) win(v, f, pl, tz + 2, TH - 7, 2, 4, { arch: s.trim, archTop: s.trim, sill: s.trim });
  fbox(v, 'pz', tz + TW - 1, tx + 2, TH - 2, 2, 1, 0, s.frame);
  for (let x = tx - 1; x <= tx + TW; x++) for (let z = tz - 1; z <= tz + TW; z++) if (x === tx - 1 || x === tx + TW || z === tz - 1 || z === tz + TW) v.set(x, TH, z, s.trim);
  let tt;
  if (L >= 4) {
    // campanario abierto con arcos y techo de pizarra más alto
    for (const [a, c] of [[0, 0], [TW - 1, 0], [0, TW - 1], [TW - 1, TW - 1]]) v.box(tx + a, TH + 1, tz + c, 1, 5, 1, s.trim);
    v.box(tx + 2, TH + 2, tz + 2, 2, 2, 2, P.goldD);
    v.box(tx, TH + 6, tz, TW, 1, TW, s.trim);
    tt = hip(v, tx, tx + TW - 1, tz, tz + TW - 1, TH + 7, s.roof, { oh: 1, rise: 2, trim: s.frame });
  } else tt = hip(v, tx, tx + TW - 1, tz, tz + TW - 1, TH + 1, s.roof, { oh: 1, trim: s.frame });
  v.box(tx + 2, tt + 1, tz + 2, 1, 4, 1, s.frame);
  wavingFlag(m, tx + 2, tt + 2, tz + 2, 4, 3, flag);
  peak = Math.max(peak, tt + 6);
  // escalinata de piedra
  v.box(12, 1, 20, 8, 1, 2, s.trim); v.box(13, 1, 22, 6, 1, 1, s.wall);
  if (L >= 4) {
    // alas con soportales (arcos al frente)
    for (const [ax0, ax1] of [[1, 6], [25, 30]]) {
      const wy = hall(m, era, { x0: ax0, x1: ax1, z0: 11, z1: 17, floors: 1, FH: 8 }, { sideWins: false });
      eraRoof(m, ax0, ax1, 11, 20, wy, era, { kind: 'dos_aguas', axis: 'z', oh: 0 });
      for (let x = ax0; x <= ax1; x++) for (let z = 18; z <= 20; z++) v.set(x, 1, z, s.trim);
      for (let x = ax0; x <= ax1; x++) v.box(x, 7, 20, 1, 2, 1, s.wall);
      for (const x of [ax0, ax0 + 2, ax0 + 3, ax1]) if (x === ax0 || x === ax1 || x === ax0 + 3) v.box(x, 2, 20, 1, 5, 1, s.trim);
      for (let x = ax0 + 1; x < ax1; x++) if (x !== ax0 + 3) v.set(x, 6, 20, s.trim);   // arcos
      for (let x = ax0 + 1; x < ax1; x++) for (let z = 18; z <= 19; z++) v.set(x, 8, z, s.wallD);
    }
    fountain(m, 6.5, 26.5, s.trim); fountain(m, 25.5, 26.5, s.trim);
    eraFence(m, era, { gaps: [13, 14, 15, 16, 17, 18] });
    for (const x of [11, 20]) { lamp(m, x, 24, era, 5); lamp(m, x, 29, era, 5); }
    // estandartes en la fachada
    for (const x of [9, 22]) { fbox(v, 'pz', b.z1, x, 5, 1, 4, 1, flag); fset(v, 'pz', b.z1, x, 9, 1, P.gold); }
  } else {
    smallTree(v, 3, 1, 14, 5, 2.4, P.leaf, 21); smallTree(v, 28, 1, 14, 5, 2.4, P.leaf, 22);
    for (const x of [4, 27]) { v.cylinder(x + 0.5, 1, 26.5, 1.8, 1, s.wall); bush(v, x + 0.5, 2, 26.5, 1.4, P.leaf, [P.clay], x); }
    v.box(11, 1, 25, 1, 1, 3, s.frame); v.box(20, 1, 25, 1, 1, 3, s.frame);   // bancos
    lamp(m, 12, 28, era, 5); lamp(m, 19, 28, era, 5);
  }
  m.height = peak + 1;
}

// ======================= LADRILLO (5) =======================
function townLadrillo(m, L, flag) {
  const era = 3, v = m.v, s = eraStyle(era);
  const b = { x0: 6, x1: 25, z0: 8, z1: 18, floors: 2, FH: 6 };
  const y = hall(m, era, b, { door: [14, 4, 5] });
  let peak = eraRoof(m, b.x0, b.x1, b.z0, b.z1, y, era, { kind: 'mansarda', dormers: true });
  // pabellón central de tres pisos que sale al frente
  const p = { x0: 11, x1: 20, z0: 9, z1: 21, floors: 3, FH: 6 };
  const yp = hall(m, era, p, { door: [14, 4, 5], sideWins: false });
  const pr = hip(v, p.x0, p.x1, p.z0, p.z1, yp, s.roof, { oh: 1, trim: s.trim, flat: 3 });
  // balcón de hierro forjado en el segundo piso
  for (let x = p.x0 - 1; x <= p.x1 + 1; x++) { v.set(x, 7, p.z1 + 1, s.trim); v.set(x, 7, p.z1 + 2, s.trim); if (x % 2 === 0) v.set(x, 8, p.z1 + 2, s.accent); v.set(x, 9, p.z1 + 2, s.accent); }
  for (const z of [p.z1 + 1, p.z1 + 2]) { v.set(p.x0 - 1, 8, z, s.accent); v.set(p.x1 + 1, 8, z, s.accent); v.set(p.x0 - 1, 9, z, s.accent); v.set(p.x1 + 1, 9, z, s.accent); }
  fbox(v, 'pz', p.z1, 14, 8, 4, 4, 0, (i, j) => (j === 3 ? C.glass : i === 0 || i === 3 ? s.frame : C.glassD));
  clock(m, 'pz', p.z1, 13, 14, s.trim);
  // cúpula de tejas con linterna
  const ct = eraCrown(m, 15, pr + 1, 14, era);
  v.box(15, ct, 14, 1, 3, 1, s.accent); wavingFlag(m, 15, ct + 1, 14, 4, 3, flag);
  peak = Math.max(peak, ct + 4);
  // chimeneas altas
  eraVertical(m, 7, y, 10, era, { h: 9 }); eraVertical(m, 23, y, 10, era, { h: 9 });
  // alas de un piso
  for (const [ax0, ax1] of [[1, 5], [26, 30]]) {
    const wy = hall(m, era, { x0: ax0, x1: ax1, z0: 10, z1: 18, floors: 1, FH: 6 }, { sideWins: false });
    eraRoof(m, ax0, ax1, 10, 18, wy, era, { kind: 'cuatro_aguas' });
    eraOpening(m, 'pz', 18, ax0 + 1, 3, era, 'ventana', { box: s.frame, flowers: [P.clay, '#ffffff'] });
  }
  // plaza: canteros, faroles de hierro, banderines y bancos
  flowerBed(v, 3, 1, 22, 5, 2, 31, { colors: [P.clay, '#ffffff', C.yellow] }); flowerBed(v, 24, 1, 22, 5, 2, 37, { colors: [P.clay, '#ffffff', C.yellow] });
  for (const x of [11, 20]) for (const z of [24, 29]) lamp(m, x, z, era, 6);
  for (const x of [5, 26]) { v.cylinder(x + 0.5, 1, 27.5, 2, 1, s.trim); smallTree(v, x, 2, 27, 4, 2.2, P.leaf, x); }
  for (let x = 1; x <= 30; x++) if (x < 11 || x > 20) v.set(x, 12, 19, [P.clay, P.gold, P.slate][x % 3]);   // banderines
  eraFence(m, era, { gaps: [13, 14, 15, 16, 17, 18] });
  m.height = peak + 1;
}

// ======================= HIERRO (6–7) =======================
/** Cúpula de hierro y vidrio (gajos vidriados entre nervios). Devuelve el tope. */
function ironDome(m, cx, y, cz, R, s) {
  const v = m.v;
  v.cylinder(cx, y, cz, R + 0.4, 3, (x, yy, z) => (yy === y + 1 && (x + z) % 3 === 0 ? C.glassD : s.trim));
  let top = y + 3;
  const H = Math.round(R * 1.1);
  for (let j = 0; j < H; j++) {
    const rr = R * Math.sqrt(Math.max(0, 1 - (j / H) ** 2)) + 0.4;
    v.cylinder(cx, top + j, cz, rr, 1, (x, yy, z) => {
      const a = Math.atan2(z - cz, x - cx);
      const rib = Math.abs(Math.sin(a * 4)) < 0.38;
      return rib || j === 0 ? s.trim : (j % 2 ? C.glass : C.glassD);
    });
  }
  top += H;
  v.box(Math.floor(cx), top, Math.floor(cz), 2, 3, 2, s.trim);
  m.light.set(Math.floor(cx), top + 1, Math.floor(cz) + 1, s.light);
  return top + 3;
}
function townHierro(m, L, flag) {
  const era = 4, v = m.v, s = eraStyle(era);
  const floors = L >= 7 ? 3 : 2;
  const b = { x0: 5, x1: 26, z0: 8, z1: 18, floors, FH: 6 };
  const y = hall(m, era, b, { door: [13, 6, 5], big: true });
  let peak = eraRoof(m, b.x0, b.x1, b.z0, b.z1, y, era, { kind: 'mansarda', color: s.sheet, dormers: true });
  // marquesina de hierro y vidrio sobre la entrada
  for (let x = 11; x <= 20; x++) for (let z = 19; z <= 22; z++) v.set(x, 7, z, z === 22 || x === 11 || x === 20 ? s.trim : C.glassD);
  for (const x of [11, 20]) v.box(x, 1, 22, 1, 6, 1, s.trim);
  // cúpula central
  let dt = ironDome(m, 15.5, peak, 13.5, 5, s);
  if (L >= 7) {
    // torre de hierro reticulada encima de la cúpula, con reloj y farol arriba
    const by = dt - 2, H = 20;
    for (let j = 0; j < H; j++) {
      const k = Math.floor((1 - j / H) * 3);
      for (const [a, c] of [[-k, -k], [k + 1, -k], [-k, k + 1], [k + 1, k + 1]]) v.set(15 + a, by + j, 13 + c, s.trim);
      if (j % 4 === 0) for (let a = -k; a <= k + 1; a++) { v.set(15 + a, by + j, 13 - k, s.joint); v.set(15 + a, by + j, 14 + k, s.joint); v.set(15 - k, by + j, 13 + a, s.joint); v.set(16 + k, by + j, 13 + a, s.joint); }
    }
    pattern(v, 'pz', 16, 13, by + 2, CLOCK6, { G: s.light, W: '#f6efe0', K: P.ink });
    m.light.set(15, by + H, 13, s.light); m.light.set(16, by + H, 14, s.light);
    v.box(15, by + H + 1, 13, 1, 4, 1, s.trim);
    dt = by + H + 5;
    // banderas grandes en mástiles altos
    for (const fx of [2, 29]) flagMast(m, fx, 29, 20, flag, s.trim, 6, 4);
    peak = Math.max(peak, 22);
  } else {
    v.box(15, dt, 13, 1, 4, 1, s.trim); wavingFlag(m, 15, dt + 1, 13, 4, 3, flag); dt += 5;
  }
  peak = Math.max(peak, dt);
  // alas: galpón de chapa en diente de sierra y tanque de agua
  for (const [ax0, ax1] of [[1, 4], [27, 30]]) {
    const wy = hall(m, era, { x0: ax0, x1: ax1, z0: 10, z1: 18, floors: 1, FH: 7 }, { sideWins: false, sheet: true });
    eraRoof(m, ax0, ax1, 10, 18, wy, era, { kind: 'diente' });
  }
  peak = Math.max(peak, eraVertical(m, 27, 13, 11, era, { w: 4, h: 4 }));
  // escalera de servicio por la derecha
  for (let j = 1; j < y; j++) if (j % 2) v.set(b.x1 + 1, j, 16, s.trim);
  // faroles a gas por el paseo y reja
  for (const z of [23, 26, 29]) { lamp(m, 12, z, era, 6); lamp(m, 19, z, era, 6); }
  for (const x of [5, 26]) { v.box(x - 1, 1, 24, 3, 1, 3, s.trim); bush(v, x, 2, 25, 1.6, P.leafD, null, x); }
  eraFence(m, era, { gaps: [13, 14, 15, 16, 17, 18] });
  m.height = peak + 1;
}

// ======================= VIDRIO Y ACERO (8) =======================
function townVidrio(m, L, flag) {
  const era = 5, v = m.v, s = eraStyle(era);
  // basamento de dos pisos con terraza verde
  const pb = { x0: 3, x1: 28, z0: 7, z1: 20, floors: 2, FH: 5 };
  const yb = hall(m, era, pb, { door: [13, 6, 4] });
  eraRoof(m, pb.x0, pb.x1, pb.z0, pb.z1, yb, era, { kind: 'terraza' });
  for (const [x, z] of [[6, 18], [25, 18], [6, 9], [25, 9]]) bush(v, x, yb + 2, z, 1.5, P.leaf, null, x + z);
  // torre de vidrio
  const tb = { x0: 10, x1: 21, z0: 8, z1: 17, floors: 6, FH: 5 };
  const yt = eraWall(m, tb.x0, yb, tb.z0, tb.x1 - tb.x0 + 1, tb.floors * tb.FH + 1, tb.z1 - tb.z0 + 1, era, { noBase: true, k0: 1 });
  // aleta vertical de acero en el frente y pantalla con reloj arriba
  for (let j = yb; j < yt; j++) { v.set(15, j, tb.z1 + 1, s.trim); v.set(16, j, tb.z1 + 1, s.trim); }
  pattern(v, 'pz', tb.z1 + 1, 13, yt - 8, CLOCK6, { G: s.trim, W: '#ffffff', K: s.panel }, 0);
  const yr = eraRoof(m, tb.x0, tb.x1, tb.z0, tb.z1, yt, era, { kind: 'terraza', oh: 1 });
  const cr = eraCrown(m, 13, yr, 12, era);
  const at = eraVertical(m, 19, yr, 10, era, { h: 14 });
  // paneles solares en la terraza del basamento
  for (let x = 4; x <= 8; x++) for (let z = 8; z <= 10; z++) v.set(x, yb + 2, z, (x + z) % 2 ? s.panel : shade(s.panel, 0.18));
  // alero de acero sobre la entrada
  for (let x = 11; x <= 20; x++) for (let z = 21; z <= 23; z++) v.set(x, 6, z, s.light);
  for (const x of [11, 20]) v.box(x, 1, 23, 1, 5, 1, s.trim);
  // espejo de agua, árboles en maceteros y mástiles finos
  for (let x = 8; x <= 23; x++) for (let z = 26; z <= 28; z++) {
    if (x === 14 || x === 17) continue;
    const edge = x === 8 || x === 23 || z === 26 || z === 28;
    v.set(x, 1, z, edge ? s.trim : C.water);
  }
  for (const x of [3, 28]) for (const z of [24, 29]) { v.box(x - 1, 1, z - 1, 3, 1, 3, s.trim); smallTree(v, x, 2, z, 3, 1.8, P.leaf, x * z); }
  for (const fx of [9, 22]) flagMast(m, fx, 23, 14, flag, s.trim);
  eraFence(m, era, { gaps: [13, 14, 15, 16, 17, 18] });
  // luces de la ciudad capital
  for (let i = 0; i < 6; i++) sparkle(m, 4 + i * 5, yt - 4 - (i % 3) * 6, 4 + (i % 2) * 22, i % 2 ? P.goldL : '#ffffff', 1.6 + i * 0.3);
  m.height = Math.max(at, cr, yr) + 1;
}

function castillo(m, L, opts = {}) {
  const flag = opts.flag || P.sky;
  const era = eraOfRank(L);
  plaza(m, era, L);
  if (era === 1) townMadera(m, L, flag);
  else if (era === 2) townPiedra(m, L, flag);
  else if (era === 3) townLadrillo(m, L, flag);
  else if (era === 4) townHierro(m, L, flag);
  else townVidrio(m, L, flag);
}

export const TOWN_BUILDERS = { castillo };
