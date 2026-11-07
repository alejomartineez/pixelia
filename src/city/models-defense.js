// Defensas contra las amenazas (DESIGN-CORE.md §5.2): Dique, Granero, Cuartel de Bomberos, Pararrayos, Refugio y
// Hospital. Modelos simples del kit en época Madera; la capa de época (eraRecolor, Fase 4) los re-pinta encima.
// Regla de niveles (§4.2): 1 base · 2 un agregado al costado · 3 más alto o más ancho · 4 chimenea, campana o torre ·
// 5 remate (bandera, cerco).
import { C, lot, path, win, door, gable, hip, picket, fbox, addSmoke, wavingFlag } from './models-kit.js';

const W = { wood: '#a8774a', woodD: '#8a5d36', joint: '#6e4a2c', straw: '#d9b46a', strawD: '#bf9a52', shingle: '#7a5a3a', shingleD: '#5f452c',
  stone: '#9b9286', stoneD: '#857c70', earth: '#8a6a48', earthD: '#74583a', door: '#5a4632', cream: '#efe3cc', grass: '#9fcf7a', grassD: '#8fc26c',
  iron: '#5b6068', ironD: '#43474d', red: '#b8553f', redD: '#94412f', white: '#f2ece2', whiteD: '#ddd5c8', water: '#6fb7d6' };
const grass = (x, z) => ((x * 3 + z * 5) % 7 === 0 ? W.grassD : W.grass);
const plank = (y, k) => (y % 3 === 0 ? W.joint : k % 7 === 0 ? W.woodD : W.wood);
const stoneC = (x, y, z) => ((x + y * 2 + z) % 4 ? W.stone : W.stoneD);

function fence(v, w, d) {
  picket(v, 'x', 0, w - 1, 1, 0, W.woodD);
  picket(v, 'z', 0, d - 1, 1, 0, W.woodD);
  picket(v, 'z', 0, d - 1, 1, w - 1, W.woodD);
}

// ======================= DIQUE (3×1) =======================
function dique(m, L) {
  const v = m.v;
  lot(v, 24, 8, grass);
  // terraplén de tierra apisonada, frente de estacas (más alto con el nivel)
  const h = 2 + Math.min(3, Math.floor(L / 2) + 1);
  for (let x = 0; x < 24; x++) for (let y = 1; y <= h; y++) for (let z = 1; z <= 6; z++) {
    const top = h - Math.abs(z - 3.5) * 0.7;
    if (y <= top) v.set(x, y, z, y === Math.floor(top) ? W.grassD : (x + y + z) % 5 ? W.earth : W.earthD);
  }
  // estacas del lado del arroyo (+x en el mundo queda a la derecha; acá las ponemos al frente, z alto)
  for (let x = 1; x < 24; x += 2) v.box(x, 1, 7, 1, h + 1, 1, x % 4 === 1 ? W.woodD : W.wood);
  // nivel 3+: frente de piedra
  if (L >= 3) for (let x = 0; x < 24; x++) for (let y = 1; y <= h - 1; y++) v.set(x, y, 6, stoneC(x, y, 6));
  // nivel 2+: compuerta de madera en el medio
  if (L >= 2) { v.box(10, 1, 0, 4, h + 1, 1, W.woodD); v.box(10, h + 2, 0, 4, 1, 1, W.ironD); v.box(11, 1, 0, 2, 1, 1, W.water); }
  // nivel 4: casilla del cuidador
  if (L >= 4) { v.box(18, h + 1, 2, 4, 4, 3, (x, y, z) => plank(y, x + z)); gable(v, 'x', 18, 21, 2, 4, h + 5, W.shingle, { wall: W.wood, trim: W.shingleD }); }
  // nivel 5: bandera
  if (L >= 5) { v.box(2, h + 1, 3, 1, 7, 1, W.woodD); wavingFlag(m, 2, h + 5, 3, 4, 3, '#6fb7d6'); }
}

// ======================= GRANERO (2×2) =======================
function granero(m, L) {
  const v = m.v;
  lot(v, 16, 16, grass);
  path(v, 5, 9, 12, 15, 0, '#b08a62');
  const top = L >= 3 ? 9 : 7;
  v.box(1, 1, 2, 10, 1, 9, W.stone);
  v.box(1, 2, 2, 10, top - 2, 9, (x, y, z) => (y % 3 === 0 ? '#5f3a26' : (x + z) % 7 === 0 ? '#7a4a32' : '#8f5a3c'));
  for (const [cx, cz] of [[1, 2], [10, 2], [1, 10], [10, 10]]) for (let y = 2; y < top; y++) v.set(cx, y, cz, W.woodD);
  // portón con cruz
  fbox(v, 'pz', 10, 4, 2, 4, 5, 0, '#7a4a32');
  for (let i = 0; i < 4; i++) { v.set(4 + i, 2 + i, 11, W.cream); v.set(7 - i, 2 + i, 11, W.cream); }
  win(v, 'pz', 10, 4, top - 2, 2, 2, { frame: W.cream });
  gable(v, 'x', 1, 10, 2, 10, top, W.shingle, { wall: '#8f5a3c', trim: W.shingleD, ridge: W.shingleD });
  // nivel 2+: silo de piedra
  if (L >= 2) {
    const sh = 8 + L;
    for (let y = 1; y < sh; y++) for (let x = 11; x <= 14; x++) for (let z = 3; z <= 6; z++) if (!((x === 11 || x === 14) && (z === 3 || z === 6))) v.set(x, y, z, y % 3 ? W.stone : W.stoneD);
    hip(v, 11, 14, 3, 6, sh, W.shingle, { oh: 0 });
  }
  // nivel 4: tinajas al frente
  if (L >= 4) for (const x of [12, 14]) { v.box(x, 1, 10, 2, 2, 2, W.earth); v.box(x, 3, 10, 2, 1, 2, W.water); }
  if (L >= 5) fence(v, 16, 16);
  // fardos de paja
  v.box(1, 1, 13, 3, 2, 2, W.straw); if (L >= 3) v.box(1, 3, 13, 2, 1, 2, W.strawD);
}

// ======================= CUARTEL DE BOMBEROS (2×2) =======================
function bomberos(m, L) {
  const v = m.v;
  lot(v, 16, 16, grass);
  path(v, 3, 9, 11, 15, 0, C.stoneL);
  const top = L >= 3 ? 10 : 8;
  v.box(1, 1, 2, 12, 1, 9, W.stone);
  v.box(1, 2, 2, 12, top - 2, 9, (x, y, z) => (y % 3 === 0 ? W.redD : W.red));
  // portón ancho del carro
  fbox(v, 'pz', 10, 3, 2, 6, 5, 0, W.door);
  for (let y = 2; y < 7; y++) v.set(6, y, 11, W.woodD);
  v.box(3, 7, 11, 6, 1, 1, W.cream);
  win(v, 'pz', 10, 10, 3, 2, 2, { frame: W.cream });
  if (L >= 3) for (const u of [3, 7]) win(v, 'pz', 10, u, 8, 2, 2, { frame: W.cream });
  gable(v, 'x', 1, 12, 2, 10, top, W.shingle, { wall: W.red, trim: W.shingleD, ridge: W.shingleD });
  // nivel 2+: carro con bomba de mano y baldes
  if (L >= 2) { v.box(10, 1, 12, 4, 2, 3, W.redD); v.box(10, 1, 12, 1, 1, 1, W.ironD); v.box(13, 1, 14, 1, 1, 1, W.ironD); v.box(11, 3, 13, 2, 1, 1, W.iron); }
  // nivel 4: torre de la campana
  if (L >= 4) {
    v.box(2, top, 3, 3, 5, 3, (x, y) => (y % 2 ? W.wood : W.woodD));
    v.box(3, top + 2, 4, 1, 2, 1, '#d9a441');
    hip(v, 2, 4, 3, 5, top + 5, W.shingle, { oh: 1 });
  }
  if (L >= 5) { v.box(14, 1, 2, 1, 10, 1, W.woodD); wavingFlag(m, 14, 8, 2, 3, 2, W.red); }
}

// ======================= PARARRAYOS (1×1) =======================
function pararrayos(m, L) {
  const v = m.v;
  lot(v, 8, 8, grass);
  // base de piedra y mástil de hierro (más alto con el nivel)
  v.box(2, 1, 2, 4, 2 + (L >= 3 ? 1 : 0), 4, stoneC);
  const ph = 14 + L * 3;
  v.box(3, 3, 3, 2, ph - 3, 2, (x, y) => (y % 4 === 0 ? W.ironD : W.iron));
  v.box(3, ph, 3, 2, 1, 2, W.ironD);
  v.box(3, ph + 1, 3, 1, 2, 1, '#d9a441');   // punta de cobre
  if (L >= 2) for (const [x, z] of [[1, 1], [6, 1], [1, 6], [6, 6]]) v.set(x, 1, z, W.ironD);   // vientos
  if (L >= 4) { v.box(2, ph - 4, 3, 4, 1, 2, W.ironD); v.box(3, ph - 4, 2, 2, 1, 4, W.ironD); }   // cruz
  if (L >= 5) { v.set(4, ph + 3, 3, '#d9a441'); }
}

// ======================= REFUGIO (2×2) =======================
function refugio(m, L) {
  const v = m.v;
  lot(v, 16, 16, grass);
  path(v, 6, 9, 11, 15, 0, '#b08a62');
  const top = L >= 3 ? 9 : 7;
  v.box(1, 1, 2, 12, top - 1, 9, stoneC);
  door(v, 'pz', 10, 6, 2, 3, 4, W.door, { frame: W.woodD, step: W.stone });
  for (const u of [2, 10]) win(v, 'pz', 10, u, 3, 2, 2, { frame: W.cream, shutters: W.woodD });
  gable(v, 'x', 1, 12, 2, 10, top, W.shingle, { wall: W.stone, trim: W.shingleD, ridge: W.shingleD });
  // chimenea con humo (siempre: es lo que se ve de lejos)
  const rt = top + 5;
  v.box(10, top, 4, 2, rt - top + 2, 2, (x, y) => (y % 2 ? W.stone : W.stoneD));
  addSmoke(m, 10, rt + 2, 4);
  // nivel 2+: pila de leña al costado
  if (L >= 2) for (let i = 0; i < 3 + L; i++) v.box(13, 1 + Math.floor(i / 2), 3 + (i % 2) * 3, 2, 1, 2, i % 2 ? W.woodD : W.wood);
  // nivel 4: segunda chimenea y bancos
  if (L >= 4) { v.box(2, top, 4, 2, 6, 2, W.stoneD); v.box(1, 1, 12, 4, 1, 1, W.wood); }
  if (L >= 5) fence(v, 16, 16);
}

// ======================= HOSPITAL (3×3) =======================
function hospital(m, L) {
  const v = m.v;
  lot(v, 24, 24, grass);
  path(v, 9, 14, 17, 23, 0, C.stoneL);
  const floors = L >= 3 ? 2 : 1, FH = 6, top = 1 + FH * floors;
  v.box(2, 1, 3, 20, 1, 14, W.stone);
  v.box(2, 2, 3, 20, top - 2, 14, (x, y) => (y === 1 + FH ? W.whiteD : W.white));
  for (let f = 0; f < floors; f++) for (const u of [4, 7, 15, 18]) win(v, 'pz', 16, u, 3 + f * FH, 2, 2, { frame: W.whiteD });
  door(v, 'pz', 16, 10, 2, 4, 4, '#6f8a9c', { frame: W.whiteD, step: W.stone });
  // cruz verde sobre la puerta
  v.box(11, 7, 17, 2, 4, 1, '#5c9a6a'); v.box(10, 8, 17, 4, 2, 1, '#5c9a6a');
  gable(v, 'x', 2, 21, 3, 16, top, '#8a6a5a', { wall: W.white, trim: '#6f5446', ridge: '#6f5446' });
  // nivel 2+: ala al costado
  if (L >= 2) { v.box(18, 1, 17, 4, 5, 5, W.white); hip(v, 18, 21, 17, 21, 6, '#8a6a5a', { oh: 0 }); }
  // nivel 4: torre del reloj chica
  if (L >= 4) { v.box(10, top + 2, 8, 4, 5, 4, W.white); hip(v, 10, 13, 8, 11, top + 7, '#8a6a5a', { oh: 1 }); }
  // nivel 5: bandera y canteros
  if (L >= 5) { v.box(3, 1, 19, 1, 12, 1, W.woodD); wavingFlag(m, 3, 9, 19, 4, 3, '#5c9a6a'); }
  for (const x of [3, 6]) v.box(x, 1, 19, 2, 1, 2, '#6f8a4f');
}

export const DEFENSE_BUILDERS = { dique, granero, bomberos, pararrayos, refugio, hospital };
