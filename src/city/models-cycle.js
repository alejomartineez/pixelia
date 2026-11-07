// Edificios del ciclo de la expedición (DESIGN-CORE.md §5.2, §4.2): Casa de Expediciones, Huerta, Taller, Establo,
// Dispensario, Tambo, Molino y Conservera. Época Madera (tablas con juntas oscuras, base de piedra suelta, paja y
// tejuela); la capa de época de la Fase 4 los re-pinta encima (eraRecolor). Cada nivel cambia la estructura, para que se
// note de lejos (regla del §4.2):
//   1 volumen base de 1 piso · 2 anexo al costado · 3 un piso más y techo de tejuela · 4 chimenea de piedra y aberturas
//   más grandes · 5 remate (mirador, letrero) y cerco de palo alrededor del lote
// Todo con las funciones del kit (lot, win, door, gable, picket, addSmoke…).
import { P, C, shade, lot, path, win, door, gable, hip, cone, picket, bush, flower, fbox, pattern, addSmoke, wavingFlag, PLUS3 } from './models-kit.js';

// Paleta de la época Madera (§4.2)
const W = { wood: '#a8774a', woodD: '#8a5d36', joint: '#6e4a2c', straw: '#d9b46a', strawD: '#bf9a52', shingle: '#7a5a3a', shingleD: '#5f452c',
  stone: '#9b9286', stoneD: '#857c70', moss: '#6f8a4f', door: '#5a4632', cream: '#efe3cc', grass: '#9fcf7a', grassD: '#8fc26c', dirt: '#b08a62', dirtD: '#9a7652' };
const grass = (x, z) => ((x * 3 + z * 5) % 7 === 0 ? W.grassD : W.grass);
const plank = (y, k) => (y % 3 === 0 ? W.joint : k % 7 === 0 ? W.woodD : W.wood);

/**
 * Casa base del ciclo con la regla de niveles. o: { x0, x1, z0, z1 (paredes, inclusive), fh (alto de piso), doorU, doorW,
 * wins: [u…] (ventanas del frente), annex: 'px'|'nx', wall, trim }. Devuelve { top (alero), rt (cumbrera), floors, ax }.
 */
function shell(m, L, o) {
  const v = m.v;
  const { x0, x1, z0, z1 } = o;
  const FH = o.fh || 6, floors = L >= 3 ? 2 : 1;
  const top = 1 + FH * floors;
  const wallFn = o.wall || ((x, y, z) => plank(y, x + z));
  v.box(x0, 1, z0, x1 - x0 + 1, 1, z1 - z0 + 1, (x, y, z) => ((x + z) % 3 ? W.stone : W.stoneD));
  v.box(x0, 2, z0, x1 - x0 + 1, top - 2, z1 - z0 + 1, wallFn);
  for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) for (let y = 2; y < top; y++) v.set(cx, y, cz, W.woodD);   // esquineros
  if (floors > 1) for (let x = x0; x <= x1; x++) v.set(x, 1 + FH, z1, o.trim || W.woodD);
  const big = L >= 4;   // nivel 4: aberturas más grandes
  for (let f = 0; f < floors; f++) {
    const wy = 3 + f * FH;
    for (const u of o.wins || []) win(v, 'pz', z1, u, wy, big ? 3 : 2, big ? 3 : 2, { frame: o.trim || W.cream, shutters: f ? undefined : W.woodD });
    if (f > 0 && o.doorU != null) win(v, 'pz', z1, o.doorU, wy, big ? 3 : 2, 2, { frame: o.trim || W.cream });
    win(v, 'px', x1, Math.floor((z0 + z1) / 2) - 1, wy, 2, 2, { frame: W.cream });
    win(v, 'nx', x0, Math.floor((z0 + z1) / 2) - 1, wy, 2, 2, { frame: W.cream });
  }
  if (o.doorU != null) door(v, 'pz', z1, o.doorU, 2, o.doorW || 3, 4, W.door, { frame: W.woodD, step: W.stone });
  // techo: paja (1–2) o tejuela (3+), siempre a dos aguas con la cumbrera a lo largo de x
  const roofC = L >= 3 ? W.shingle : W.straw, roofD = L >= 3 ? W.shingleD : W.strawD;
  const rt = gable(v, 'x', x0, x1, z0, z1, top, roofC, { wall: W.wood, trim: roofD, ridge: roofD });
  // nivel 2+: anexo con techo propio al costado
  let ax = null;
  if (L >= 2 && o.annex) {
    const aw = o.annexW || 4, ad = Math.max(4, Math.floor((z1 - z0) * 0.7));
    const a0 = o.annex === 'px' ? x1 + 1 : x0 - aw, a1 = a0 + aw - 1, az0 = z1 - ad + 1;
    const ah = Math.min(top - 1, FH);
    v.box(a0, 1, az0, aw, 1, ad, W.stone);
    v.box(a0, 2, az0, aw, ah - 1, ad, (x, y, z) => plank(y, x * 2 + z));
    door(v, 'pz', z1, a0 + Math.floor((aw - 2) / 2), 2, 2, 3, W.door, {});
    gable(v, 'z', a0, a1, az0, z1, 1 + ah, L >= 3 ? W.shingle : W.straw, { wall: W.wood, trim: L >= 3 ? W.shingleD : W.strawD, oh: 0 });
    ax = { a0, a1, az0 };
  }
  // nivel 4: chimenea de piedra con humo
  if (L >= 4) {
    const cx = o.chimX ?? x1 - 2, cz = o.chimZ ?? z0 + 1;
    v.box(cx, top, cz, 2, rt - top + 3, 2, (x, y) => (y % 2 ? W.stone : W.stoneD));
    v.box(cx, rt + 3, cz, 2, 1, 2, W.stoneD);
    addSmoke(m, cx, rt + 4, cz);
  }
  // nivel 5: mirador sobre la cumbrera (si el edificio no tiene su propio remate) y cerco de palo
  if (L >= 5 && o.mirador !== false) {
    const mx = Math.floor((x0 + x1) / 2) - 1, mz = Math.floor((z0 + z1) / 2) - 1;
    v.box(mx, rt - 1, mz, 4, 1, 4, W.woodD);
    for (const [px, pz] of [[mx, mz], [mx + 3, mz], [mx, mz + 3], [mx + 3, mz + 3]]) v.box(px, rt, pz, 1, 3, 1, W.woodD);
    v.box(mx + 1, rt, mz + 1, 2, 1, 2, W.cream);
    hip(v, mx, mx + 3, mz, mz + 3, rt + 3, W.shingle, { oh: 1 });
  }
  if (L >= 5 && o.fence !== false) fenceLot(v, m.W, m.D, o.gate || [Math.floor(m.W / 2) - 1, Math.floor(m.W / 2)]);
  return { top, rt, floors, ax };
}
/** Cerco de palo alrededor del lote, con un hueco de entrada al frente. */
function fenceLot(v, Wd, Dd, gate) {
  picket(v, 'x', 0, Wd - 1, 1, Dd - 1, W.woodD, gate);
  picket(v, 'x', 0, Wd - 1, 1, 0, W.woodD);
  picket(v, 'z', 1, Dd - 2, 1, 0, W.woodD);
  picket(v, 'z', 1, Dd - 2, 1, Wd - 1, W.woodD);
}
/** Carreta con lona (la de la expedición). (x,z) = esquina; mira a +x. */
function cart(v, x, z, cover = W.cream) {
  v.box(x, 2, z, 6, 1, 3, W.woodD);
  v.box(x, 3, z, 6, 1, 3, W.wood);
  for (let i = 0; i < 6; i++) { v.set(x + i, 4, z, cover); v.set(x + i, 5, z + 1, cover); v.set(x + i, 4, z + 2, cover); v.set(x + i, 5, z, shade(cover, -0.06)); v.set(x + i, 5, z + 2, shade(cover, -0.06)); }
  for (const wx of [x + 1, x + 4]) for (const wz of [z - 1, z + 3]) { v.box(wx, 1, wz, 2, 2, 1, P.ink); v.set(wx, 2, wz, W.woodD); }
  v.box(x + 6, 2, z + 1, 2, 1, 1, W.woodD);   // lanza
}
/** Pila de troncos. */
function logs(v, x, z, n = 3) {
  for (let i = 0; i < n; i++) { v.box(x, 1 + Math.floor(i / 2), z + (i % 2) * 2 + (Math.floor(i / 2) ? 1 : 0), 5, 1, 2, i % 2 ? W.woodD : W.wood); v.set(x + 5, 1 + Math.floor(i / 2), z + (i % 2) * 2, '#d8b98a'); }
}
/** Fardo de paja. */
const bale = (v, x, z, y = 1) => v.box(x, y, z, 3, 2, 2, (xx, yy) => (yy % 2 ? W.straw : W.strawD));
/** Animal simple (mula, vaca). */
function animal(v, x, z, body, spot = null, head = null) {
  v.box(x, 2, z, 4, 2, 2, body);
  if (spot) { v.set(x + 1, 3, z, spot); v.set(x + 2, 2, z + 1, spot); }
  v.box(x + 4, 3, z, 2, 2, 2, head || body);
  for (const lx of [x, x + 3]) for (const lz of [z, z + 1]) v.set(lx, 1, lz, shade(body, -0.3));
}
/** Cartel colgado sobre la puerta. */
function signBoard(v, u, y, z, w, c, art) {
  fbox(v, 'pz', z, u, y, w, 3, 1, c);
  if (art) pattern(v, 'pz', z, u + Math.floor((w - 3) / 2), y + 2, art.rows, art.c, 2);
}

// ======================= CASA DE EXPEDICIONES (3×3) =======================
function casa_exp(m, L) {
  const v = m.v;
  lot(v, 24, 24, grass);
  path(v, 9, 12, 16, 23, 0, W.dirt);
  const s = shell(m, L, { x0: 3, x1: 16, z0: 4, z1: 15, fh: 6, doorU: 9, doorW: 3, wins: [5, 13], annex: 'px', annexW: 5 });
  // cartel con un mapa
  signBoard(v, 8, 7, 15, 5, W.cream, { rows: ['X.X', '.X.', 'X..'], c: P.ink });
  // mástil con banderín verde
  v.box(1, 1, 18, 1, 13 + (L >= 3 ? 4 : 0), 1, W.woodD);
  wavingFlag(m, 1, 11 + (L >= 3 ? 4 : 0), 18, 5, 3, W.moss);
  cart(v, 14, 18, L >= 3 ? '#d9cfae' : W.cream);
  if (L >= 2) { bale(v, 3, 19); logs(v, 3, 21 - 0, 2); }
  if (L >= 4) cart(v, 14, 21, '#c9b48a');
  // nivel 5: farol en el mirador (la luz que se ve de lejos)
  if (L >= 5) { const lt = m.light; lt.box(9, s.rt + 1, 9, 2, 1, 2, '#f2c45a'); }
}

// ======================= HUERTA (2×2) =======================
function huerta(m, L) {
  const v = m.v;
  lot(v, 16, 16, grass);
  // canteros: más con cada nivel
  const beds = Math.min(5, 1 + L);
  const crops = [[C.leaf, C.orange], [C.leafD, C.red], [C.leaf, C.yellow], ['#7fbf5a', P.clay], [C.leafD, '#f2e2a0']];
  for (let i = 0; i < beds; i++) {
    const z = 15 - i * 2 - 1;
    for (let x = 1; x <= 14; x++) {
      v.set(x, 1, z, (x + i) % 2 ? W.dirt : W.dirtD);
      const [lf, fr] = crops[i];
      if (x % 2) { v.set(x, 2, z, lf); if ((x + i) % 4 === 1) v.set(x, 3, z, fr); }
    }
  }
  // galpón de herramientas al fondo (con la regla de niveles)
  const s = shell(m, L, { x0: 1, x1: 7, z0: 1, z1: 5, fh: 4, doorU: 3, doorW: 2, wins: [], annex: 'px', annexW: 3, mirador: false, chimX: 2, chimZ: 2, fence: false });
  // tonel de agua y regadera
  v.box(12, 1, 2, 2, 3, 2, W.woodD); v.box(12, 4, 2, 2, 1, 2, C.waterD);
  if (L >= 3) v.box(14, 1, 3, 1, 1, 1, '#7d8a99');
  // nivel 5: espantapájaros y cerco
  if (L >= 5) {
    v.box(11, 1, 9, 1, 6, 1, W.woodD); v.box(9, 5, 9, 5, 1, 1, W.woodD);
    v.box(10, 4, 9, 3, 2, 1, '#c96d4a'); v.box(10, 7, 9, 3, 2, 1, W.straw); v.box(10, 9, 9, 3, 1, 1, W.strawD);
    fenceLot(v, 16, 16, [7, 8]);
  }
  void s;
}

// ======================= TALLER (2×2) =======================
function taller(m, L) {
  const v = m.v;
  lot(v, 16, 16, grass);
  path(v, 5, 8, 11, 15, 0, W.dirt);
  shell(m, L, { x0: 1, x1: 10, z0: 2, z1: 10, fh: 5, doorU: 5, doorW: 3, wins: [2], annex: 'px', annexW: 4, mirador: false });
  // portón ancho de dos hojas (lo distingue de una casa)
  fbox(v, 'pz', 10, 5, 2, 4, 5, 0, W.door);
  for (let y = 2; y < 7; y++) v.set(7, y, 11, W.woodD);
  // yunque, caballete y troncos
  v.box(1, 1, 12, 2, 1, 2, W.stoneD); v.box(1, 2, 12, 3, 1, 1, '#4b4f55'); v.set(1, 3, 12, '#4b4f55');
  v.box(11, 1, 12, 1, 2, 1, W.woodD); v.box(14, 1, 12, 1, 2, 1, W.woodD); v.box(11, 3, 12, 4, 1, 1, W.wood);
  if (L >= 2) logs(v, 10, 13, 3);
  if (L >= 3) { v.box(4, 1, 12, 1, 2, 2, '#c8a46a'); v.set(4, 3, 12, '#7d8a99'); }   // cajón con herramientas
  // nivel 5: letrero con una llave y cerco
  if (L >= 5) { signBoard(v, 1, 7, 10, 4, W.cream, { rows: ['XX.', '.X.', '.XX'], c: '#4b4f55' }); fenceLot(v, 16, 16, [6, 7]); }
}

// ======================= ESTABLO (3×3) =======================
function establo(m, L) {
  const v = m.v;
  lot(v, 24, 24, grass);
  const barn = (x, y, z) => (y % 3 === 0 ? '#5f3a26' : (x + z) % 7 === 0 ? '#7a4a32' : '#8f5a3c');   // tablas de granero
  const s = shell(m, L, { x0: 2, x1: 15, z0: 2, z1: 12, fh: 6, doorU: 7, doorW: 4, wins: [3, 13], annex: 'px', annexW: 5, wall: barn });
  // portón de granero con cruz
  fbox(v, 'pz', 12, 7, 2, 4, 5, 0, '#7a4a32');
  for (let i = 0; i < 4; i++) { v.set(7 + i, 2 + i, 13, W.cream); v.set(10 - i, 2 + i, 13, W.cream); }
  // corral con mula y fardos
  picket(v, 'x', 2, 15, 1, 21, W.woodD);
  picket(v, 'z', 15, 21, 1, 2, W.woodD);
  picket(v, 'z', 15, 21, 1, 15, W.woodD, [17, 18]);
  animal(v, 5, 17, '#8a6a52', null, '#6e5240');
  if (L >= 2) animal(v, 10, 18, '#9c7c60', null, '#7a5c44');
  bale(v, 18, 16); if (L >= 2) bale(v, 18, 19);
  if (L >= 3) bale(v, 18, 16, 3);
  void s;
}

// ======================= DISPENSARIO (2×2) =======================
function dispensario(m, L) {
  const v = m.v;
  lot(v, 16, 16, grass);
  path(v, 5, 7, 11, 15, 0, W.stone);
  const lightWall = (x, y, z) => (y % 3 === 0 ? '#c9b48a' : (x + z) % 7 === 0 ? '#d8c39a' : '#e3d2ac');   // tablas lavadas a la cal
  shell(m, L, { x0: 1, x1: 10, z0: 2, z1: 10, fh: 5, doorU: 5, doorW: 2, wins: [2, 8], annex: 'px', annexW: 4, wall: lightWall, trim: W.woodD, mirador: false });
  // cartel con una hoja en cruz (verde)
  signBoard(v, 4, 7, 10, 5, W.cream, { rows: PLUS3, c: W.moss });
  // macetas de hierbas
  for (const x of [1, 3, 9, 11]) { v.box(x, 1, 12, 2, 1, 1, '#b5603f'); v.set(x, 2, 12, W.moss); v.set(x + 1, 2, 12, '#8fb06a'); }
  if (L >= 2) bush(v, 13, 1, 13, 1.5, W.moss, ['#c9a3d9'], 7);
  if (L >= 5) { const lt = m.light; lt.box(5, 10, 11, 2, 1, 1, '#f2c45a'); fenceLot(v, 16, 16, [5, 6, 7]); }
}

// ======================= TAMBO (3×3) =======================
function tambo(m, L) {
  const v = m.v;
  lot(v, 24, 24, grass);
  const s = shell(m, L, { x0: 2, x1: 13, z0: 2, z1: 11, fh: 6, doorU: 6, doorW: 3, wins: [3, 11], annex: 'px', annexW: 4, mirador: false });
  // silo de madera con techo cónico
  const sh = 10 + L * 2;
  v.box(18, 1, 3, 4, sh, 4, (x, y) => (y % 3 === 0 ? W.joint : (x % 2 ? W.wood : W.woodD)));
  cone(v, 19.5, sh + 1, 4.5, 3, 4, W.shingle);
  // vacas en el corral
  picket(v, 'x', 1, 22, 1, 22, W.woodD);
  picket(v, 'z', 14, 22, 1, 1, W.woodD);
  picket(v, 'z', 14, 22, 1, 22, W.woodD, [17, 18]);
  animal(v, 4, 16, '#f4efe8', P.ink, '#e9e2d6');
  if (L >= 2) animal(v, 11, 18, '#f4efe8', '#6e4a2c', '#e9e2d6');
  if (L >= 4) animal(v, 16, 15, '#c98f62', null, '#a8774a');
  // tachos de leche
  v.box(14, 1, 12, 1, 2, 1, '#c7ccd1'); v.box(16, 1, 12, 1, 2, 1, '#c7ccd1');
  if (L >= 5) { v.box(17, sh + 5, 5, 1, 3, 1, W.woodD); v.box(18, sh + 7, 5, 2, 1, 1, '#4b4f55'); }   // veleta
  void s;
}

// ======================= MOLINO (2×2) =======================
function molino(m, L) {
  const v = m.v;
  lot(v, 16, 16, grass);
  // torre: piedra abajo, tablas arriba; crece con el nivel
  const th = 9 + (L >= 3 ? 4 : 0);
  v.box(3, 1, 3, 8, 3, 8, (x, y, z) => ((x + y + z) % 3 ? W.stone : W.stoneD));
  v.box(4, 4, 4, 6, th - 3, 6, (x, y, z) => plank(y, x + z));
  door(v, 'pz', 10, 6, 1, 2, 3, W.door, {});
  win(v, 'pz', 9, 6, 7, 2, 2, { frame: W.cream });
  if (L >= 3) win(v, 'pz', 9, 6, 11, 2, 2, { frame: W.cream });
  const capY = 1 + th;
  hip(v, 4, 9, 4, 9, capY, L >= 3 ? W.shingle : W.straw, { oh: 1 });
  // nivel 2: depósito de bolsas al costado
  if (L >= 2) { v.box(11, 1, 6, 4, 4, 5, (x, y) => plank(y, x)); gable(v, 'z', 11, 14, 6, 10, 5, L >= 3 ? W.shingle : W.straw, { wall: W.wood, oh: 0 }); v.box(12, 1, 11, 2, 1, 2, W.cream); }
  // nivel 4: galería de piedra alrededor de la torre (balcón del molinero)
  if (L >= 4) { for (let x = 2; x <= 11; x++) for (const z of [2, 11]) v.set(x, 5, z, W.woodD); for (let z = 3; z <= 10; z++) for (const x of [2, 11]) v.set(x, 5, z, W.woodD); }
  // aspas que giran (frente)
  const hubY = capY + 1, hubX = 7, hubZ = 11;
  const sails = m.part('sails', [hubX + 0.5, hubY + 0.5, hubZ + 0.5]);
  const len = 5 + (L >= 3 ? 1 : 0);
  sails.set(hubX, hubY, hubZ, W.woodD);
  for (let i = 1; i <= len; i++) {
    sails.set(hubX + i, hubY, hubZ, W.woodD); sails.set(hubX - i, hubY, hubZ, W.woodD);
    sails.set(hubX, hubY + i, hubZ, W.woodD); sails.set(hubX, hubY - i, hubZ, W.woodD);
    if (i >= 2) { sails.set(hubX + i, hubY + 1, hubZ, W.cream); sails.set(hubX - i, hubY - 1, hubZ, W.cream); sails.set(hubX - 1, hubY + i, hubZ, W.cream); sails.set(hubX + 1, hubY - i, hubZ, W.cream); }
  }
  v.box(hubX, hubY, 9, 1, 1, 2, W.woodD);   // eje
  m.animate((parts, ph) => { const o = parts.sails[0]; return (dt, t) => { o.rotation.z = -(t + ph) * 0.9; }; });
  if (L >= 5) { v.box(6, capY + 6, 6, 1, 3, 1, W.woodD); wavingFlag(m, 6, capY + 7, 6, 3, 2, W.moss); fenceLot(v, 16, 16, [6, 7, 8]); }
}

// ======================= CONSERVERA (3×3) =======================
function conservera(m, L) {
  const v = m.v;
  lot(v, 24, 24, grass);
  path(v, 8, 11, 15, 23, 0, W.stone);
  const s = shell(m, L, { x0: 2, x1: 17, z0: 3, z1: 14, fh: 6, doorU: 8, doorW: 4, wins: [4, 13], annex: 'nx', annexW: 2, chimX: 14, chimZ: 5, mirador: false });
  // chimenea propia de la fábrica (siempre), más alta desde el nivel 3
  const ch = s.rt + (L >= 3 ? 6 : 3);
  v.box(19, 1, 4, 3, ch, 3, (x, y) => (y % 2 ? W.stone : W.stoneD));
  addSmoke(m, 19, ch + 1, 4);
  // frascos y cajones en el patio
  for (let i = 0; i < 3 + L; i++) { const x = 13 + (i % 4) * 2, z = 17 + Math.floor(i / 4) * 2; v.box(x, 1, z, 1, 2, 1, i % 2 ? '#8fc1d0' : '#c96d4a'); v.set(x, 3, z, '#c7ccd1'); }
  v.box(3, 1, 17, 3, 2, 3, '#c8a46a'); v.box(3, 3, 18, 3, 1, 2, '#b8945a');
  if (L >= 2) v.box(3, 1, 21, 3, 2, 2, '#c8a46a');
  if (L >= 5) { signBoard(v, 7, 8, 14, 6, W.cream, { rows: ['.X.', 'XXX', 'XXX'], c: '#c96d4a' }); fenceLot(v, 24, 24, [9, 10, 11]); }
}

export const CYCLE_BUILDERS = { casa_exp, huerta, taller, establo, dispensario, tambo, molino, conservera };
