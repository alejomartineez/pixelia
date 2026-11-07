// Edificios del ciclo de la expedición (DESIGN-CORE.md §5.2, §4.2) con arte por época: Casa de Expediciones, Huerta,
// Taller, Establo, Dispensario, Tambo, Molino y Conservera. Cada uno tiene una silueta propia que se reconoce de lejos
// en cualquier época:
//   Casa de Expediciones: atalaya con banderín verde · Taller: techo de una sola caída, portón y chimenea de la fragua
//   Dispensario: casa blanca con cruz verde e invernadero · Conservera: galpón de dientes de sierra, chimenea y tanques
//   Establo: granero rojo con el hastial al frente y portón en cruz · Tambo: silo alto y corral con vacas
//   Molino: torre con aspas (en Hierro, molino de chapa; en Vidrio y acero, aerogenerador) · Huerta: canteros y galpón
// Regla de niveles (§4.2): 1 volumen base · 2 anexo o galería · 3 un piso más y otro techo · 4 el elemento vertical de la
// época y aberturas más grandes · 5 remate y cerco de la época alrededor del lote.
import {
  P, C, shade, gable, hip, cone, picket, bush, fbox, fset, pattern, addSmoke, wavingFlag, PLUS3,
  eraStyle, eraWall, eraRoof, eraOpening, eraVertical, eraFence, eraGround, eraCrown,
} from './models-kit.js';
import { ERA_PALETTES as EP } from '../core/palette.js';

const ROOF_LOW = ['paja', 'dos_aguas', 'cuatro_aguas', 'plano', 'plano'];
const ROOF_HIGH = ['alto', 'alto', 'mansarda', 'diente', 'terraza'];
const FLATS = new Set(['plano', 'terraza', 'mansarda', 'diente']);
const MOSS = EP.madera.moss, CREAM = '#efe3cc', INK = '#4b4f55';

/**
 * Volumen base del ciclo con la regla de niveles. o: { x0, x1, z0, z1 (inclusive), floors (por época, default 1),
 * door: [u, w], doorColor, wins (ventanas al frente), roof: (L, id) => kind, axis, tint, seed, noVertical, vert: [x, z],
 * noCrown, gaps (entrada del cerco), annex: { x0, x1, z0, z1 } }. Devuelve { top, roofTop, peak, kind, FH }.
 */
function body(m, L, era, o) {
  const v = m.v, s = eraStyle(era), e = era - 1;
  const { x0, x1, z0, z1 } = o;
  const FH = o.FH || Math.min(s.FH, 6);
  const floors = (o.floors ? o.floors[e] : 1) + (L >= 3 ? 1 : 0);
  const H = floors * FH + 1;
  const top = eraWall(m, x0, 1, z0, x1 - x0 + 1, H, z1 - z0 + 1, era, { FH, seed: o.seed || 3, tint: o.tint });
  if (o.door) eraOpening(m, 'pz', z1, o.door[0], 1, era, 'puerta', { w: o.door[1], color: o.doorColor });
  const big = L >= 4;
  if (o.wins !== false) for (let f = 0; f < floors; f++) {
    const wy = 3 + f * FH;
    for (const u of o.wins || []) eraOpening(m, 'pz', z1, u, wy, era, 'ventana', { big });
    if (f > 0 && o.door) eraOpening(m, 'pz', z1, o.door[0], wy, era, 'ventana', { big });
    eraOpening(m, 'px', x1, Math.floor((z0 + z1) / 2) - 1, wy, era, 'ventana', { big });
  }
  const kind = o.roof ? o.roof(L, s.id) : (L >= 3 ? ROOF_HIGH : ROOF_LOW)[e];
  const roofTop = kind === 'una_caida' ? shed(m, x0, x1, z0, z1, top, era) : eraRoof(m, x0, x1, z0, z1, top, era, { kind, axis: o.axis || 'x', oh: 1, dormers: false, color: o.roofColor });
  let peak = roofTop;
  // nivel 2: anexo con techo plano o de la época
  if (L >= 2 && o.annex) {
    const a = o.annex, ah = Math.min(FH + 1, H - 1);
    const at = eraWall(m, a.x0, 1, a.z0, a.x1 - a.x0 + 1, ah, a.z1 - a.z0 + 1, era, { FH, seed: (o.seed || 3) + 5, tint: o.tint });
    eraRoof(m, a.x0, a.x1, a.z0, a.z1, at, era, { kind: FLATS.has(ROOF_LOW[e]) || s.id === 'ladrillo' ? 'plano' : 'dos_aguas', axis: 'z', oh: 0 });
    if (a.door !== false) eraOpening(m, 'pz', a.z1, a.x0 + 1, 1, era, 'puerta', { w: 2, h: 4, color: o.doorColor });
  }
  // nivel 4: elemento vertical de la época
  if (L >= 4 && !o.noVertical) {
    const [vx, vz] = o.vert || [x1 - 1, z0 + 1];
    if (s.id === 'piedra') peak = Math.max(peak, eraVertical(m, vx - 2, top - 1, vz - 1, era, { w: 3, h: roofTop - top + 5 }));
    else if (s.id === 'hierro') peak = Math.max(peak, eraVertical(m, vx - 3, roofTop, vz, era, { w: 4, h: 3 }));
    else if (s.id === 'vidrio') peak = Math.max(peak, eraVertical(m, vx, roofTop, vz, era, { h: 8 }));
    else peak = Math.max(peak, eraVertical(m, vx - 1, top - 1, vz, era, { h: roofTop - top + (s.id === 'ladrillo' ? 7 : 4) }));
  }
  // nivel 5: remate arriba y cerco
  if (L >= 5) {
    if (!o.noCrown) peak = Math.max(peak, eraCrown(m, Math.floor((x0 + x1) / 2), FLATS.has(kind) || kind === 'una_caida' ? roofTop : roofTop + 1, Math.floor((z0 + z1) / 2), era, { flag: MOSS, w: Math.min(9, x1 - x0 - 1), sign: o.sign || MOSS }));
    eraFence(m, era, { gaps: o.gaps || [] });
  }
  return { top, roofTop, peak, kind, FH, H };
}

/** Techo de una sola caída (sube hacia atrás). Devuelve la y del tope. */
function shed(m, x0, x1, z0, z1, y, era, rise = 1) {
  const v = m.v, s = eraStyle(era);
  const rc = s.id === 'hierro' ? s.sheet : s.id === 'vidrio' ? s.light : s.id === 'madera' ? s.roof2 : s.roof;
  const rd = s.id === 'hierro' ? s.sheetD : s.roofD;
  let top = y;
  for (let z = z1 + 1; z >= z0 - 1; z--) {
    const st = Math.floor((z1 + 1 - z) / 2) * rise;
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      for (let j = 0; j < st; j++) if (x >= x0 && x <= x1 && z >= z0 && z <= z1) v.set(x, y + j, z, s.id === 'madera' ? s.wallD : s.trim);
      v.set(x, y + st, z, z === z1 + 1 || x === x0 - 1 || x === x1 + 1 ? rd : (x % 3 === 0 && s.id === 'hierro' ? rd : rc));
    }
    top = Math.max(top, y + st);
  }
  return top;
}

/** Torre de la época (atalaya, silo cuadrado): tronco macizo o reticulado. (x, z) esquina; devuelve la y del tope. */
function tower(m, era, x, z, w, h) {
  const v = m.v, s = eraStyle(era);
  if (s.id === 'madera' || s.id === 'hierro') {
    const c = s.id === 'madera' ? EP.madera.post : s.trim, c2 = s.id === 'madera' ? s.wall : s.joint;
    for (const [a, b] of [[0, 0], [w - 1, 0], [0, w - 1], [w - 1, w - 1]]) v.box(x + a, 1, z + b, 1, h, 1, c);
    for (let j = 3; j < h; j += 4) for (let a = 0; a < w; a++) { v.set(x + a, j, z, c2); v.set(x + a, j, z + w - 1, c2); v.set(x, j, z + a, c2); v.set(x + w - 1, j, z + a, c2); }
    for (let j = 1; j < h; j++) { const a = (j % (w - 1)); v.set(x + a, j, z + w - 1, c2); v.set(x + w - 1, j, z + (w - 1 - a), c2); }   // cruces
  } else eraWall(m, x, 1, z, w, h, w, era, { noBase: s.id === 'vidrio', FH: 5, seed: x });
  return 1 + h;
}

// ---------- utilería (igual en todas las épocas) ----------
/** Carreta con lona (la de la expedición). (x,z) = esquina; mira a +x. */
function cart(v, x, z, cover = CREAM) {
  const wood = EP.madera.plank, woodD = EP.madera.plankD;
  v.box(x, 2, z, 6, 1, 3, woodD);
  v.box(x, 3, z, 6, 1, 3, wood);
  for (let i = 0; i < 6; i++) { v.set(x + i, 4, z, cover); v.set(x + i, 5, z + 1, cover); v.set(x + i, 4, z + 2, cover); v.set(x + i, 5, z, shade(cover, -0.06)); v.set(x + i, 5, z + 2, shade(cover, -0.06)); }
  for (const wx of [x + 1, x + 4]) for (const wz of [z - 1, z + 3]) { v.box(wx, 1, wz, 2, 2, 1, P.ink); v.set(wx, 2, wz, woodD); }
  v.box(x + 6, 2, z + 1, 2, 1, 1, woodD);
}
const bale = (v, x, z, y = 1) => v.box(x, y, z, 3, 2, 2, (xx, yy) => (yy % 2 ? EP.madera.thatch : EP.madera.thatchD));
function logs(v, x, z, n = 3) {
  for (let i = 0; i < n; i++) { v.box(x, 1 + Math.floor(i / 2), z + (i % 2) * 2, 5, 1, 2, i % 2 ? EP.madera.plankD : EP.madera.plank); v.set(x + 5, 1 + Math.floor(i / 2), z + (i % 2) * 2, '#d8b98a'); }
}
function animal(v, x, z, bodyC, spot = null, head = null) {
  v.box(x, 2, z, 4, 2, 2, bodyC);
  if (spot) { v.set(x + 1, 3, z, spot); v.set(x + 2, 2, z + 1, spot); }
  v.box(x + 4, 3, z, 2, 2, 2, head || bodyC);
  for (const lx of [x, x + 3]) for (const lz of [z, z + 1]) v.set(lx, 1, lz, shade(bodyC, -0.3));
}
function signBoard(v, u, y, z, w, c, art, frame) {
  fbox(v, 'pz', z, u, y, w, 3, 1, c);
  if (frame) { fbox(v, 'pz', z, u - 1, y - 1, w + 2, 1, 1, frame); fbox(v, 'pz', z, u - 1, y + 3, w + 2, 1, 1, frame); }
  if (art) pattern(v, 'pz', z + 1, u + Math.floor((w - 3) / 2), y + 2, art.rows, art.c, 0);
}
/** Corral de la época: palo (Madera), pirca (Piedra), tablas pintadas (Ladrillo) o reja (Hierro, Vidrio). */
function corral(v, era, x0, x1, z0, z1, gaps = []) {
  const s = eraStyle(era);
  const c = s.id === 'madera' ? EP.madera.post : s.id === 'piedra' ? s.wallD : s.id === 'ladrillo' ? CREAM : s.fence;
  picket(v, 'x', x0, x1, 1, z1, c, gaps);
  picket(v, 'z', z0, z1 - 1, 1, x0, c);
  picket(v, 'z', z0, z1 - 1, 1, x1, c);
}

// ======================= CASA DE EXPEDICIONES (3×3) =======================
function casa_exp(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id;
  eraGround(m, era, { path: [8, 10], pathZ: 15 });
  const b = body(m, L, era, { x0: 2, x1: 14, z0: 5, z1: 14, door: [8, 3], doorColor: EP.madera.joint, wins: [4, 12], seed: 7, vert: [4, 6], gaps: [8, 9, 10], noCrown: true });
  // cartel con un mapa sobre la puerta
  signBoard(v, 7, b.FH + 1, 14, 5, CREAM, { rows: ['X.X', '.X.', 'X..'], c: P.ink }, e === 'madera' ? EP.madera.post : s.trim);
  // atalaya (la firma): sube con el nivel; arriba, plataforma con techito de la época y banderín verde
  const th = 12 + (L >= 3 ? 5 : 0) + (L >= 5 ? 3 : 0);
  const tt = tower(m, era, 17, 4, 4, th);
  v.box(16, tt, 3, 6, 1, 6, e === 'madera' ? s.wallD : s.trim);
  for (const [a, c] of [[16, 3], [21, 3], [16, 8], [21, 8]]) v.box(a, tt + 1, c, 1, 3, 1, e === 'madera' ? EP.madera.post : s.trim);
  for (let a = 16; a <= 21; a++) { v.set(a, tt + 1, 8, s.id === 'vidrio' ? C.glass : e === 'madera' ? s.wall : s.trim); v.set(a, tt + 1, 3, e === 'madera' ? s.wall : s.trim); }
  const rk = e === 'madera' ? 'paja' : e === 'piedra' ? 'cuatro_aguas' : e === 'ladrillo' ? 'cuatro_aguas' : 'plano';
  const rt = rk === 'paja' ? hip(v, 16, 21, 3, 8, tt + 4, s.roof, { oh: 1, trim: s.roofD }) : eraRoof(m, 16, 21, 3, 8, tt + 4, era, { kind: rk, oh: 1 });
  v.box(19, rt + 1, 5, 1, 6, 1, e === 'madera' ? EP.madera.post : '#ffffff');
  wavingFlag(m, 19, rt + 3, 5, 5, 3, MOSS);
  let peak = rt + 8;
  if (L >= 5) { m.light.box(18, tt + 1, 5, 2, 1, 2, EP.hierro.lamp); peak = Math.max(peak, rt + 8); }
  // carreta (la de la expedición) y, en el 2, la galería con fardos y troncos
  cart(v, 14, 18, L >= 3 ? '#d9cfae' : CREAM);
  if (L >= 2) {
    for (let x = 2; x <= 14; x++) for (let z = 15; z <= 16; z++) v.set(x, 1, z, e === 'madera' ? s.wallD : s.trim);
    for (const x of [2, 7, 11, 14]) v.box(x, 2, 16, 1, b.FH - 1, 1, e === 'madera' ? EP.madera.post : s.trim);
    for (let x = 1; x <= 15; x++) for (let z = 15; z <= 17; z++) v.set(x, b.FH + 1, z, z === 17 ? s.roofD : (e === 'hierro' ? s.sheet : e === 'vidrio' ? s.light : s.roof));
    bale(v, 3, 19); logs(v, 3, 21, 2);
  }
  if (L >= 4) cart(v, 14, 21, '#c9b48a');
  m.height = Math.max(peak, b.peak) + 1;
}

// ======================= HUERTA (2×2) =======================
function huerta(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id;
  eraGround(m, era);
  // canteros: más con cada nivel
  const beds = Math.min(5, 1 + L);
  const crops = [[C.leaf, C.orange], [C.leafD, C.red], [C.leaf, C.yellow], ['#7fbf5a', P.clay], [C.leafD, '#f2e2a0']];
  const edge = e === 'madera' ? EP.madera.plankD : e === 'piedra' ? s.wallD : e === 'ladrillo' ? s.wall : s.trim;
  for (let i = 0; i < beds; i++) {
    const z = 14 - i * 2;
    for (let x = 1; x <= 14; x++) {
      v.set(x, 1, z, x === 1 || x === 14 ? edge : (x + i) % 2 ? '#b08a62' : '#9a7652');
      const [lf, fr] = crops[i];
      if (x % 2 && x > 1 && x < 14) { v.set(x, 2, z, lf); if ((x + i) % 4 === 1) v.set(x, 3, z, fr); }
    }
  }
  // galpón de herramientas al fondo
  const b = body(m, L, era, { x0: 1, x1: 6, z0: 1, z1: 4, FH: 4, door: [3, 2], wins: [], seed: 13, roof: (Lv, id) => (id === 'madera' ? (Lv >= 3 ? 'alto' : 'paja') : Lv >= 3 ? ROOF_HIGH[era - 1] : 'una_caida'),
    vert: [5, 1], noCrown: true, gaps: [7, 8] });
  // agua: barril (Madera), aljibe (Piedra), bomba de ladrillo (Ladrillo), tanque de chapa (Hierro), invernadero (Vidrio)
  if (e === 'madera') { v.box(11, 1, 2, 2, 3, 2, EP.madera.plankD); v.box(11, 4, 2, 2, 1, 2, C.waterD); }
  else if (e === 'piedra') { v.cylinder(11.5, 1, 2.5, 1.8, 3, s.wall); v.cylinder(11.5, 3, 2.5, 1, 1, C.waterD); for (const x of [10, 13]) v.box(x, 4, 2, 1, 3, 1, s.frame); v.box(10, 7, 2, 4, 1, 1, s.frame); }
  else if (e === 'ladrillo') { v.box(10, 1, 1, 4, 3, 3, (x, y) => (y === 3 ? s.trim : s.wall)); v.box(11, 4, 2, 1, 3, 1, s.accent); v.box(11, 6, 2, 3, 1, 1, s.accent); }
  else if (e === 'hierro') { for (const [a, c] of [[10, 1], [13, 1], [10, 4], [13, 4]]) v.box(a, 1, c, 1, 4, 1, s.trim); v.cylinder(11.5, 5, 2.5, 2.2, 3, s.accent); }
  else { v.box(9, 1, 1, 6, 4, 4, (x, y, z) => (x === 9 || x === 14 || y === 4 ? s.trim : C.glass)); v.box(10, 1, 2, 4, 2, 2, C.leaf); }
  // nivel 3: parral sobre los canteros
  if (L >= 3) {
    for (const x of [8, 14]) for (const z of [7, 11]) v.box(x, 1, z, 1, 5, 1, e === 'madera' ? EP.madera.post : s.trim);
    for (let x = 8; x <= 14; x++) for (let z = 7; z <= 11; z++) if ((x + z) % 2 === 0) v.set(x, 6, z, (x * 3 + z) % 5 ? C.leaf : C.leafD);
  }
  // nivel 5: espantapájaros
  if (L >= 5) {
    v.box(4, 1, 9, 1, 6, 1, EP.madera.post); v.box(2, 5, 9, 5, 1, 1, EP.madera.post);
    v.box(3, 4, 9, 3, 2, 1, '#c96d4a'); v.box(3, 7, 9, 3, 2, 1, EP.madera.thatch); v.box(3, 9, 9, 3, 1, 1, EP.madera.thatchD);
  }
  m.height = Math.max(b.peak, 10) + 1;
}

// ======================= TALLER (2×2) =======================
function taller(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id;
  eraGround(m, era, { path: [4, 8], pathZ: 11 });
  const b = body(m, L, era, { x0: 1, x1: 9, z0: 2, z1: 10, FH: 5, wins: [], seed: 19, roof: () => 'una_caida', noVertical: true, noCrown: true, gaps: [4, 5, 6, 7, 8] });
  // portón ancho de dos hojas (la firma: lo distingue de una casa)
  const gc = e === 'madera' ? EP.madera.joint : e === 'piedra' ? EP.piedra.beam : e === 'ladrillo' ? s.frame : e === 'hierro' ? s.sheetD : s.trim;
  fbox(v, 'pz', 10, 2, 1, 7, 6, 0, (i, j) => (i === 0 || i === 6 || j === 5 ? (e === 'madera' ? EP.madera.post : s.trim) : i === 3 ? shade(gc, -0.25) : e === 'vidrio' ? (j > 1 ? C.glassD : s.trim) : (j % 2 ? gc : shade(gc, 0.1))));
  for (let i = 0; i < 2; i++) { fset(v, 'pz', 10, 4, 3 + i, 1, INK); fset(v, 'pz', 10, 6, 3 + i, 1, INK); }   // tiradores
  // chimenea de la fragua (siempre), más alta y con el material de la época desde el nivel 4
  const fh = b.roofTop - b.top + (L >= 4 ? 8 : 4);
  const fc = e === 'madera' || e === 'piedra' ? (x, y) => (y % 2 ? EP.madera.stone : EP.madera.stoneD) : e === 'ladrillo' || e === 'hierro' ? (x, y) => (y % 4 === 2 ? EP.ladrillo.joint : EP.ladrillo.brick) : s.trim;
  v.box(2, b.top - 1, 3, 2, fh, 2, fc);
  v.box(2, b.top - 1 + fh, 3, 2, 1, 2, e === 'vidrio' ? s.joint : P.ink);
  addSmoke(m, 2, b.top + fh, 3, '#e8e2da');
  let peak = b.top + fh + 4;
  // yunque y caballete adelante
  v.box(11, 1, 12, 2, 1, 2, EP.madera.stoneD); v.box(11, 2, 12, 3, 1, 1, INK); v.set(11, 3, 12, INK);
  // nivel 2: alero abierto al costado con el banco de trabajo
  if (L >= 2) {
    const ay = b.FH + 1;
    for (const [x, z] of [[14, 3], [14, 9]]) v.box(x, 1, z, 1, ay, 1, e === 'madera' ? EP.madera.post : s.trim);
    for (let x = 10; x <= 14; x++) for (let z = 2; z <= 10; z++) v.set(x, ay + 1 - Math.floor((x - 10) / 3), z, e === 'hierro' ? s.sheet : e === 'vidrio' ? s.light : e === 'madera' ? s.roof2 : s.roof);
    v.box(11, 1, 5, 3, 2, 1, EP.madera.plankD); v.box(11, 3, 5, 3, 1, 2, EP.madera.plank); v.set(12, 4, 5, INK);
    v.box(11, 1, 8, 1, 2, 2, '#c8a46a'); v.set(11, 3, 8, '#7d8a99');
  }
  if (L >= 3) for (let i = 0; i < 2; i++) v.box(11 + i * 2, 1, 13, 1, 2 + i, 1, EP.madera.plank);
  // nivel 4: elemento vertical de la época en el techo alto (atrás)
  if (L >= 4) {
    if (e === 'piedra') peak = Math.max(peak, eraVertical(m, 6, b.top - 1, 2, era, { w: 3, h: b.roofTop - b.top + 5 }));
    else if (e === 'hierro') peak = Math.max(peak, eraVertical(m, 5, b.roofTop, 2, era, { w: 4, h: 3 }));
    else if (e === 'vidrio') peak = Math.max(peak, eraVertical(m, 8, b.roofTop, 2, era, { h: 8 }));
  }
  // nivel 5: letrero con una llave y cerco (lo pone body)
  if (L >= 5) signBoard(v, 3, 7 + (L >= 3 ? 5 : 0), 10, 5, CREAM, { rows: ['XX.', '.X.', '.XX'], c: INK }, e === 'madera' ? EP.madera.post : s.trim);
  m.height = Math.max(peak, b.peak) + 1;
}

// ======================= ESTABLO (3×3) =======================
function establo(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id;
  eraGround(m, era, { path: [6, 10], pathZ: 13 });
  // granero rojo (Madera y Hierro pintados; Piedra y Ladrillo con su material), hastial al frente
  const tint = e === 'madera' ? '#8f5a3c' : e === 'hierro' ? '#8a4a3a' : e === 'vidrio' ? '#b85a48' : undefined;
  const b = body(m, L, era, { x0: 2, x1: 14, z0: 2, z1: 12, wins: [], seed: 23, tint, axis: 'z', roof: (Lv) => (Lv >= 3 ? 'alto' : 'dos_aguas'),
    roofColor: e === 'madera' ? EP.madera.shingle : e === 'vidrio' ? '#b85a48' : undefined, vert: [13, 3], noCrown: true, gaps: [6, 7, 8, 9, 10] });
  // portón de granero en cruz (la firma)
  const dc = '#6e3a28';
  fbox(v, 'pz', 12, 6, 1, 5, 6, 0, dc);
  for (let i = 0; i < 5; i++) { fset(v, 'pz', 12, 6 + i, 1 + i, 1, CREAM); fset(v, 'pz', 12, 10 - i, 1 + i, 1, CREAM); }
  fbox(v, 'pz', 12, 5, 7, 7, 1, 1, CREAM);
  // ventanita del pajar arriba del portón
  if (e !== 'vidrio') fbox(v, 'pz', 12, 7, b.top - 1, 3, 2, 0, (i, j) => (j ? CREAM : P.ink));
  // corral con mulas y fardos
  corral(v, era, 15, 22, 2, 21, [17, 18]);
  animal(v, 16, 5, '#8a6a52', null, '#6e5240');
  if (L >= 2) animal(v, 16, 10, '#9c7c60', null, '#7a5c44');
  bale(v, 18, 16); if (L >= 2) bale(v, 18, 18);
  if (L >= 3) { bale(v, 18, 16, 3); animal(v, 16, 14, '#6e5240', '#efe3cc', '#5a4230'); }
  // nivel 2: cobertizo bajo al frente con el carro
  if (L >= 2) {
    for (const x of [2, 5]) v.box(x, 1, 19, 1, 4, 1, e === 'madera' ? EP.madera.post : s.trim);
    for (let x = 1; x <= 6; x++) for (let z = 15; z <= 20; z++) v.set(x, 5, z, e === 'hierro' ? s.sheet : e === 'vidrio' ? s.light : e === 'madera' ? EP.madera.shingle : s.roof);
    bale(v, 2, 16);
  }
  // nivel 5: veleta con caballo sobre la cumbrera
  if (L >= 5) {
    v.box(8, b.roofTop + 1, 7, 1, 4, 1, INK);
    pattern(v, 'pz', 7, 6, b.roofTop + 6, ['.XX..', 'XXXXX', 'X...X'], INK);
  }
  m.height = Math.max(b.peak, b.roofTop + 7) + 1;
}

// ======================= DISPENSARIO (2×2) =======================
function dispensario(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id;
  eraGround(m, era, { path: [5, 6], pathZ: 10 });
  // casa blanca (encalada) en todas las épocas: es la que se distingue de las otras
  const tint = e === 'madera' ? '#e3d2ac' : e === 'piedra' ? '#ddd5c4' : e === 'ladrillo' ? '#f0e4cc' : e === 'hierro' ? '#d8d4cc' : undefined;
  const b = body(m, L, era, { x0: 1, x1: 9, z0: 2, z1: 9, FH: 5, door: [5, 2], doorColor: MOSS, wins: [8], seed: 29, tint,
    roof: (Lv, id) => (id === 'vidrio' ? (Lv >= 3 ? 'terraza' : 'plano') : Lv >= 3 ? (id === 'ladrillo' || id === 'hierro' ? 'mansarda' : 'alto') : 'cuatro_aguas'),
    vert: [2, 3], noCrown: true, gaps: [5, 6] });
  // cruz verde (la firma): sobre la puerta y en un cartel alto que se ve de lejos
  pattern(v, 'pz', 10, 5, 8, PLUS3, MOSS);
  const ph = b.roofTop + 3;
  v.box(10, 1, 11, 1, ph, 1, e === 'madera' ? EP.madera.post : s.trim);
  fbox(v, 'pz', 11, 9, ph, 5, 5, 0, '#ffffff');
  pattern(v, 'pz', 12, 10, ph + 3, PLUS3, MOSS);
  if (L >= 5) for (const [x, y] of [[11, ph + 1], [11, ph + 3], [10, ph + 2], [12, ph + 2], [11, ph + 2]]) m.light.set(x, y, 13, '#8fd07a');
  let peak = ph + 5;
  // macetas de hierbas
  for (const x of [1, 3]) { v.box(x, 1, 12, 2, 1, 1, '#b5603f'); v.set(x, 2, 12, MOSS); v.set(x + 1, 2, 12, '#8fb06a'); }
  // nivel 2: invernadero de hierbas al costado (vidrio con la estructura de la época)
  if (L >= 2) {
    const fc = e === 'madera' ? EP.madera.post : s.trim;
    v.box(10, 1, 2, 5, 5, 6, (x, y, z) => (x === 10 || x === 14 || z === 2 || z === 7 ? ((x + z) % 3 === 0 || y === 1 ? fc : C.glass) : C.leaf));
    for (let z = 2; z <= 7; z++) for (let x = 10; x <= 14; x++) v.set(x, 6 + (x === 12 ? 1 : 0), z, (x + z) % 3 === 0 ? fc : C.glassD);
    bush(v, 13, 1, 13, 1.5, MOSS, ['#c9a3d9'], 7);
  }
  m.height = Math.max(peak, b.peak) + 1;
}

// ======================= TAMBO (3×3) =======================
function tambo(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id;
  eraGround(m, era);
  const b = body(m, L, era, { x0: 2, x1: 13, z0: 2, z1: 10, door: [6, 3], wins: [3, 11], seed: 31, vert: [12, 3], noCrown: true, gaps: [16, 17, 18, 19] });
  // silo (la firma): sube con el nivel; madera con flejes, piedra, ladrillo, chapa remachada, acero
  const sh = 10 + L * 2;
  const sc = e === 'madera' ? (x, y) => (y % 3 === 0 ? EP.madera.joint : x % 2 ? EP.madera.plank : EP.madera.plankD)
    : e === 'piedra' ? (x, y, z) => ((Math.floor(y / 2) + x + z) % 3 ? s.wall : s.wallD)
    : e === 'ladrillo' ? (x, y) => (y % 4 === 2 ? s.joint : y % 9 === 0 ? s.trim : s.wall)
    : e === 'hierro' ? (x, y) => (y % 4 === 0 ? s.trim : s.accent)
    : (x, y) => (y % 5 === 0 ? s.trim : s.light);
  v.cylinder(19.5, 1, 5.5, 2.8, sh, sc);
  const capC = e === 'madera' ? EP.madera.shingle : e === 'piedra' ? s.roof : e === 'ladrillo' ? s.roof : e === 'hierro' ? s.sheet : s.trim;
  cone(v, 19.5, sh + 1, 5.5, 3.2, e === 'vidrio' ? 2 : 4, capC);
  let peak = sh + 6;
  if (L >= 3) { v.cylinder(16, 1, 4, 1.6, sh - 4, sc); cone(v, 16, sh - 3, 4, 2, 3, capC); }
  // vacas en el corral
  corral(v, era, 1, 22, 14, 22, [17, 18]);
  animal(v, 4, 16, '#f4efe8', P.ink, '#e9e2d6');
  if (L >= 2) animal(v, 11, 18, '#f4efe8', '#6e4a2c', '#e9e2d6');
  if (L >= 4) animal(v, 15, 15, '#c98f62', null, '#a8774a');
  // tachos de leche y, en el 2, el anexo de la quesería
  v.box(14, 1, 12, 1, 2, 1, '#c7ccd1'); v.box(16, 1, 12, 1, 2, 1, '#c7ccd1');
  if (L >= 2) {
    const at = eraWall(m, 2, 1, 11, 6, 5, 2, era, { seed: 3 });
    for (let x = 1; x <= 8; x++) v.set(x, at, 12, e === 'hierro' ? s.sheet : e === 'vidrio' ? s.light : s.roofD);
    for (let x = 1; x <= 8; x++) v.set(x, at, 11, e === 'hierro' ? s.sheet : e === 'vidrio' ? s.light : s.roof);
  }
  // nivel 5: veleta sobre el silo
  if (L >= 5) { v.box(19, peak - 1, 5, 1, 3, 1, INK); v.box(19, peak + 1, 5, 3, 1, 1, INK); peak += 3; }
  m.height = Math.max(peak, b.peak) + 1;
}

// ======================= MOLINO (2×2) =======================
function molino(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id;
  eraGround(m, era);
  const th = 9 + (L >= 3 ? 4 : 0) + (L >= 5 ? 2 : 0);
  let hubX = 7, hubY, hubZ = 11, capY;
  if (e === 'vidrio') {
    // aerogenerador: mástil blanco fino y góndola; abajo, la sala de máquinas vidriada
    eraWall(m, 3, 1, 4, 8, 5, 6, era, { FH: 5, seed: 2 });
    eraRoof(m, 3, 10, 4, 9, 6, era, { kind: L >= 3 ? 'terraza' : 'plano', oh: 1 });
    v.cylinder(7, 6, 6.5, 1, th + 8, s.light);
    capY = th + 14; v.box(6, capY, 5, 3, 2, 5, s.light);
    hubY = capY; hubZ = 10;
  } else {
    // torre: base de piedra; el resto, con el material de la época (tablas, piedra, ladrillo, chapa)
    v.box(3, 1, 3, 8, 3, 8, (x, y, z) => ((x + y + z) % 3 ? EP.madera.stone : EP.madera.stoneD));
    if (e === 'hierro') {
      for (const [a, c] of [[4, 4], [9, 4], [4, 9], [9, 9]]) v.box(a, 4, c, 1, th - 3, 1, s.trim);
      for (let j = 5; j < th; j += 3) for (let a = 4; a <= 9; a++) { v.set(a, j, 4, s.joint); v.set(a, j, 9, s.joint); v.set(4, j, a, s.joint); v.set(9, j, a, s.joint); }
      v.box(5, 4, 5, 4, 4, 4, s.accent);
    } else eraWall(m, 4, 4, 4, 6, th - 3, 6, era, { noBase: true, seed: 5, FH: 6 });
    eraOpening(m, 'pz', 10, 6, 1, era, 'puerta', { w: 2, h: 3 });
    if (e !== 'hierro') { eraOpening(m, 'pz', 9, 6, 7, era, 'ventana'); if (L >= 3) eraOpening(m, 'pz', 9, 6, 11, era, 'ventana'); }
    capY = 1 + th;
    const capC = e === 'madera' ? (L >= 3 ? EP.madera.shingle : EP.madera.thatch) : e === 'hierro' ? s.sheet : s.roof;
    if (e === 'hierro') { v.box(5, capY, 5, 4, 2, 4, s.sheetD); v.box(6, capY + 2, 7, 1, 1, 6, s.trim); }   // cola de la veleta
    else hip(v, 4, 9, 4, 9, capY, capC, { oh: 1, trim: s.roofD });
    hubY = capY + 1;
  }
  // nivel 2: depósito de bolsas al costado
  if (L >= 2) {
    const at = eraWall(m, 11, 1, 6, 4, 4, 5, era, { seed: 7 });
    eraRoof(m, 11, 14, 6, 10, at, era, { kind: e === 'madera' ? 'paja' : e === 'piedra' ? 'dos_aguas' : 'plano', axis: 'z', oh: 0 });
    v.box(12, 1, 11, 2, 1, 2, CREAM);
  }
  // nivel 4: galería del molinero alrededor de la torre (el molino de dos piedras)
  if (L >= 4 && e !== 'vidrio') {
    const gc = e === 'madera' ? EP.madera.plankD : s.trim;
    for (let x = 2; x <= 11; x++) for (const z of [2, 11]) { v.set(x, 7, z, gc); if (x % 3 === 2) v.box(x, 4, z, 1, 3, 1, gc); }
    for (let z = 3; z <= 10; z++) for (const x of [2, 11]) v.set(x, 7, z, gc);
    v.cylinder(13, 1, 13, 1.6, 1, EP.madera.stone); v.cylinder(13, 2, 13, 1.6, 1, EP.madera.stoneD);   // las dos piedras
  }
  // aspas que giran (frente): lona (Madera a Ladrillo), rueda de chapa (Hierro), tres palas (Vidrio)
  const sails = m.part('sails', [hubX + 0.5, hubY + 0.5, hubZ + 0.5]);
  const len = 5 + (L >= 3 ? 1 : 0) + (L >= 5 ? 1 : 0);
  if (e === 'vidrio') {
    for (let k = 0; k < 3; k++) {
      const a = k / 3 * Math.PI * 2 + Math.PI / 2;
      for (let r = 1; r <= len + 3; r += 0.5) sails.set(Math.round(hubX + Math.cos(a) * r), Math.round(hubY + Math.sin(a) * r), hubZ, s.light);
    }
    sails.set(hubX, hubY, hubZ, s.trim);
  } else if (e === 'hierro') {
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2;
      for (let r = 1.5; r <= len - 1; r += 0.5) sails.set(Math.round(hubX + Math.cos(a) * r), Math.round(hubY + Math.sin(a) * r), hubZ, r > len - 3 ? s.sheet : s.trim);
    }
    sails.set(hubX, hubY, hubZ, s.accent);
  } else {
    const arm = e === 'madera' ? EP.madera.plankD : e === 'piedra' ? EP.piedra.beam : s.frame;
    const cloth = e === 'ladrillo' ? s.trim : CREAM;
    sails.set(hubX, hubY, hubZ, arm);
    for (let i = 1; i <= len; i++) {
      sails.set(hubX + i, hubY, hubZ, arm); sails.set(hubX - i, hubY, hubZ, arm);
      sails.set(hubX, hubY + i, hubZ, arm); sails.set(hubX, hubY - i, hubZ, arm);
      if (i >= 2) { sails.set(hubX + i, hubY + 1, hubZ, cloth); sails.set(hubX - i, hubY - 1, hubZ, cloth); sails.set(hubX - 1, hubY + i, hubZ, cloth); sails.set(hubX + 1, hubY - i, hubZ, cloth); }
    }
  }
  v.box(hubX, hubY, hubZ - 2, 1, 1, 2, e === 'vidrio' ? s.light : EP.madera.plankD);   // eje
  m.animate((parts, ph) => { const q = parts.sails[0]; const sp = e === 'vidrio' ? 1.4 : e === 'hierro' ? 1.6 : 0.9; return (dt, t) => { q.rotation.z = -(t + ph) * sp; }; });
  let peak = hubY + len + (e === 'vidrio' ? 4 : 1);
  if (L >= 5) {
    if (e !== 'vidrio') { v.box(6, capY + 5, 6, 1, 3, 1, EP.madera.post); wavingFlag(m, 6, capY + 6, 6, 3, 2, MOSS); }
    else m.light.set(7, capY + 2, 7, '#ff6a5a');
    eraFence(m, era, { gaps: [6, 7, 8] });
  }
  m.height = peak + 1;
}

// ======================= CONSERVERA (3×3) =======================
function conservera(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id;
  eraGround(m, era, { path: [8, 11], pathZ: 13 });
  // galpón con techo en diente de sierra en todas las épocas (la firma de la fábrica)
  const b = body(m, L, era, { x0: 2, x1: 15, z0: 3, z1: 12, door: [8, 4], doorColor: '#c96d4a', wins: [4, 12], seed: 37,
    roof: (Lv, id) => (id === 'vidrio' && Lv >= 3 ? 'terraza' : 'diente'), roofColor: e === 'madera' ? EP.madera.shingle : e === 'piedra' ? s.roof : undefined,
    vert: [5, 4], noCrown: true, gaps: [8, 9, 10, 11] });
  // chimenea de la fábrica (siempre), más alta desde el nivel 3
  const ch = b.roofTop + (L >= 3 ? 8 : 4);
  const cc = e === 'madera' || e === 'piedra' ? (x, y) => (y % 2 ? EP.madera.stone : EP.madera.stoneD)
    : e === 'vidrio' ? (x, y) => (y % 6 === 0 ? '#e04a3a' : s.light) : (x, y) => (y % 4 === 2 ? EP.ladrillo.joint : y === ch - 3 ? s.trim : EP.ladrillo.brick);
  v.box(18, 1, 3, 3, ch, 3, cc);
  v.box(18, ch + 1, 3, 3, 1, 3, P.ink);
  addSmoke(m, 18, ch + 2, 4);
  let peak = ch + 6;
  // tanques de conserva: toneles (Madera), cisternas (Piedra), tinas de ladrillo, tanques remachados, silos de acero
  const tc = e === 'madera' ? (x, y) => (y % 2 ? EP.madera.plankD : EP.madera.plank) : e === 'piedra' ? s.wall : e === 'ladrillo' ? s.trim : e === 'hierro' ? (x, y) => (y % 3 === 0 ? s.trim : s.accent) : s.light;
  const tN = 1 + Math.min(2, L - 1), tH = 4 + (L >= 3 ? 3 : 0);
  for (let i = 0; i < tN; i++) { const tx = 18 + (i % 2) * 3.5, tz = 10.5 + Math.floor(i / 2) * 4 + (i % 2) * 0; v.cylinder(tx, 1, tz + (i === 1 ? 0 : 0), 1.5, tH, tc); v.cylinder(tx, 1 + tH, tz, 1, 1, e === 'vidrio' ? s.trim : INK); }
  // frascos y cajones en el patio
  for (let i = 0; i < 2 + L; i++) { const x = 13 + (i % 4) * 2, z = 18 + Math.floor(i / 4) * 2; v.box(x, 1, z, 1, 2, 1, i % 2 ? '#8fc1d0' : '#c96d4a'); v.set(x, 3, z, '#c7ccd1'); }
  // nivel 2: muelle de carga con cajones a la izquierda
  if (L >= 2) {
    v.box(2, 1, 14, 6, 1, 3, e === 'madera' ? EP.madera.plankD : s.trim);
    v.box(3, 2, 15, 2, 2, 2, '#c8a46a'); v.box(5, 2, 15, 2, 1, 2, '#b8945a'); v.box(3, 4, 15, 2, 1, 2, '#b8945a');
  }
  // nivel 5: letrero de la fábrica con un frasco
  if (L >= 5) signBoard(v, 6, b.H - 3, 12, 8, CREAM, { rows: ['.X.', 'XXX', 'XXX'], c: '#c96d4a' }, e === 'madera' ? EP.madera.post : s.trim);
  m.height = Math.max(peak, b.peak) + 1;
}

export const CYCLE_BUILDERS = { casa_exp, huerta, taller, establo, dispensario, tambo, molino, conservera };
