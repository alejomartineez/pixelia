// Defensas contra las amenazas (DESIGN-CORE.md §5.2) con arte por época (§4.2). Cada una tiene una firma que se
// reconoce de lejos en cualquier época y que no se confunde con los edificios del ciclo:
//   Dique: muro largo con el arroyo al frente y compuerta · Granero: depósito elevado sobre pilares (hórreo; en Hierro y
//   Vidrio y acero, tolva sobre patas) y bolsas de grano · Cuartel de Bomberos: fachada roja con portón ancho, campana y
//   torre de mangueras · Pararrayos: mástil altísimo con punta de cobre · Refugio: techo a dos aguas hasta el piso (en
//   Hierro y Vidrio y acero, bóveda), chimenea grande con humo y ventanas encendidas · Hospital: bloque blanco con alas,
//   marquesina y el cartel azul con la H sobre el techo.
// Regla de niveles: 1 base · 2 un agregado al costado · 3 más alto (un piso más) · 4 la torre, chimenea o elemento
// vertical de la época, aberturas más grandes · 5 remate y cerco de la época.
import { P, C, shade, gable, hip, cone, fbox, fset, pattern, addSmoke, wavingFlag,
  eraStyle, eraWall, eraWallColor, eraRoof, eraOpening, eraVertical, eraFence, eraGround } from './models-kit.js';
import { ERA_PALETTES as EP } from '../core/palette.js';
import { cycleBody, eraTower } from './models-cycle.js';

const WATER = '#6fb7d6', WATERL = '#9fd3e6', WATERD = '#4f97b8';
const FIRE = '#b8453a', FIRED = '#94352c';
const COPPER = '#d9a441', COPPERD = '#b8862e';
const WARM = '#ffc46b', WARML = '#ffe2a8';
const SNOW = '#f4f2ec';
const WHITE = '#efebe3';
const HBLUE = '#3e6fa8';
const GRAIN = '#d8b56a', GRAIND = '#b8913f';
const INK = '#2f2b2a';
const hexInt = (c) => parseInt(c.slice(1), 16);
const H5 = ['X...X', 'X...X', 'XXXXX', 'X...X', 'X...X'];
const hashc = (a, b) => (((a * 73856093) ^ (b * 19349663)) >>> 0) % 7;
const stoneMix = (x, y, z) => (hashc(x * 5 + z, y) < 2 ? EP.madera.stoneD : EP.madera.stone);
const postOf = (s) => (s.id === 'madera' ? EP.madera.post : s.trim);
const earth = (x, y, z) => ((x + y * 3 + z) % 5 ? '#8a6a48' : '#74583a');

/** Ventana encendida (luz cálida, sin sombra): marco en el muro y el vidrio en m.light. */
function warmWin(m, face, plane, u, y, w, h, frame) {
  fbox(m.v, face, plane, u - 1, y - 1, w + 2, h + 2, 0, frame);
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
    fset(m.v, face, plane, u + i, y + j, 0, null);
    fset(m.light, face, plane, u + i, y + j, 0, (i + j) % 3 ? WARM : WARML);
  }
}
/** Farol encendido sobre un poste. */
function lamp(m, x, z, h, pole, c = EP.hierro.lamp) {
  m.v.box(x, 1, z, 1, h, 1, pole);
  m.light.set(x, h + 1, z, c);
  m.v.set(x, h + 2, z, pole);
}
/** Ruedas de un carro o camión (a los dos lados, mirando a +x). */
function wheels(v, xs, z0, z1) { for (const x of xs) for (const z of [z0, z1]) { v.box(x, 1, z, 2, 2, 1, INK); v.set(x, 2, z, '#50555b'); } }

// ======================= DIQUE (3×1) =======================
function dique(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id, post = postOf(s);
  eraGround(m, era);
  const h = 3 + [0, 1, 2, 2, 3][L - 1];
  // el arroyo al frente: lo que el dique contiene (de lejos dice "dique" en cualquier época)
  for (let x = 0; x < 24; x++) for (let z = 6; z < 8; z++) { v.set(x, 0, z, WATERD); v.set(x, 1, z, (x * 3 + z) % 7 ? WATER : WATERL); }
  // terraplén de tierra con pasto por detrás, sube hacia el muro
  for (let x = 0; x < 24; x++) for (let z = 0; z <= 3; z++) {
    const top = Math.max(1, Math.round(h * (0.45 + z * 0.17)));
    for (let y = 1; y <= top; y++) v.set(x, y, z, y === top ? ((x + z) % 4 ? P.grass : P.grassD) : earth(x, y, z));
  }
  // muro de contención del material de la época (z 4..5)
  const wallC = (x, y, z) => {
    const k = y - 1, end = x === 0 || x === 23;
    switch (e) {
      case 'madera': return z === 5 ? (x % 2 === 0 ? post : k % 3 === 0 ? s.wallD : s.wall) : earth(x, y, z);
      case 'piedra': return eraWallColor(era, x, k + 1, end, { seed: 5 });
      case 'ladrillo': return eraWallColor(era, x, k + 1, end, { floorLines: false, seed: 5 });
      case 'hierro': return eraWallColor(era, x, k + 1, end, { sheet: true, floorLines: false });
      default: return x % 6 === 0 || k % 4 === 3 ? EP.vidrio.steelD : EP.vidrio.white;   // hormigón en paños
    }
  };
  for (let x = 0; x < 24; x++) for (let z = 4; z <= 5; z++) for (let y = 1; y <= h; y++) v.set(x, y, z, wallC(x, y, z));
  // coronamiento
  const cap = e === 'madera' ? s.wallD : e === 'hierro' ? s.joint : e === 'vidrio' ? EP.vidrio.steel : s.trim;
  for (let x = 0; x < 24; x++) for (let z = 3; z <= 5; z++) v.set(x, h + 1, z, z === 3 && e === 'madera' ? P.grassD : cap);
  if (e === 'madera') for (let x = 0; x < 24; x += 2) { v.set(x, h + 2, 5, post); if (x % 4 === 0) v.set(x, h + 3, 5, s.wallD); }   // puntas de las estacas
  if (e === 'ladrillo') for (let x = 2; x < 24; x += 6) { v.box(x, 1, 6, 2, h - 1, 1, s.wallD); v.box(x, h, 6, 2, 1, 1, s.trim); }   // contrafuertes
  if (e === 'vidrio') for (let x = 0; x < 24; x++) v.set(x, h + 2, 5, x % 3 === 0 ? EP.vidrio.steel : C.glassD);                       // baranda de vidrio
  // nivel 2: compuerta en el medio, con pilares, puente y volante
  const gx = 10;
  if (L >= 2) {
    const gh = h + 3;
    const pil = e === 'madera' ? post : e === 'piedra' || e === 'ladrillo' ? s.wallD : s.trim;
    for (const px of [gx - 1, gx + 4]) v.box(px, 1, 4, 1, gh, 3, pil);
    v.box(gx - 1, gh + 1, 3, 6, 1, 4, e === 'madera' ? s.wallD : e === 'vidrio' ? EP.vidrio.white : s.trim);
    const leaf = e === 'madera' ? s.wallD : e === 'piedra' ? EP.piedra.beam : e === 'ladrillo' ? s.accent : e === 'hierro' ? s.accent : EP.vidrio.panel;
    v.box(gx, 1, 6, 4, gh, 1, (x, y) => (y % 2 ? leaf : shade(leaf, -0.12)));
    // volante
    const wc = e === 'madera' || e === 'piedra' ? EP.madera.post : e === 'hierro' ? s.joint : INK;
    for (const [a, b] of [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]]) v.set(gx + 1 + a, gh + 2 + b, 5, wc);
    v.set(gx + 2, gh + 3, 5, COPPER);
    // espuma donde sale el agua
    for (let x = gx; x < gx + 4; x++) v.set(x, 1, 7, WATERL);
  }
  // nivel 3: camino de ronda con baranda
  if (L >= 3) {
    const rc = e === 'madera' ? EP.madera.post : e === 'piedra' ? s.trim : e === 'ladrillo' ? s.accent : e === 'hierro' ? s.fence : EP.vidrio.steel;
    for (let x = 0; x < 24; x++) {
      if (x >= gx - 1 && x <= gx + 4) continue;
      if (e === 'vidrio') continue;    // ya tiene baranda de vidrio
      if (x % 3 === 0) v.box(x, h + 2, 4, 1, 2, 1, rc); else v.set(x, h + 3, 4, rc);
    }
  }
  // nivel 4: casilla del cuidador sobre el terraplén
  let top = h + 6;
  if (L >= 4) {
    for (let x = 17; x <= 21; x++) for (let z = 0; z <= 3; z++) for (let y = 1; y <= h; y++) v.set(x, y, z, earth(x, y, z));
    const wt = eraWall(m, 17, h + 1, 0, 5, 5, 4, era, { seed: 9, FH: 6 });
    eraOpening(m, 'pz', 3, 18, h + 2, era, 'ventana');
    top = eraRoof(m, 17, 21, 0, 3, wt, era, { kind: ['paja', 'dos_aguas', 'cuatro_aguas', 'plano', 'plano'][era - 1], axis: 'x', oh: 1, dormers: false });
    if (e === 'vidrio' || e === 'hierro') top = Math.max(top, eraVertical(m, 20, top, 1, era, e === 'hierro' ? { w: 2, h: 2 } : { h: 6 }));
    else if (e === 'madera') addSmoke(m, 20, top + 1, 1);
  }
  // nivel 5: escala de crecida en el agua, faroles y bandera celeste
  if (L >= 5) {
    for (let y = 1; y <= h + 3; y++) v.set(6, y, 7, y % 2 ? '#f2ece2' : '#b8553f');
    for (const x of [3, 15, 22]) { v.box(x, h + 2, 5, 1, 3, 1, e === 'madera' ? post : INK); m.light.set(x, h + 5, 5, EP.hierro.lamp); v.set(x, h + 6, 5, e === 'madera' ? post : INK); }
    v.box(1, h + 1, 2, 1, 9, 1, post);
    wavingFlag(m, 1, h + 6, 2, 4, 3, WATER);
    top = Math.max(top, h + 10);
  }
  m.height = top + 2;
}

// ======================= GRANERO (2×2) =======================
// Depósito elevado sobre pilares con "muelas" de piedra (que no suban los ratones): de lejos, una caja que flota.
function granero(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id, post = postOf(s);
  eraGround(m, era, { path: [5, 8], pathZ: 12 });
  const ph = L >= 3 ? 5 : 4;
  const x0 = 2, x1 = 11, z0 = 3, z1 = 10;
  const bin = e === 'hierro' || e === 'vidrio';
  if (!bin) {
    // pilares con muela
    for (const px of [x0, 6, x1]) for (const pz of [z0, z1]) {
      const pc = e === 'ladrillo' ? (y => (y % 4 === 2 ? s.joint : s.wall)) : ((x, y, z) => stoneMix(x, y, z));
      v.box(px, 1, pz, 1, ph - 1, 1, e === 'ladrillo' ? (x, y) => pc(y) : pc);
      v.box(px - 1, ph, pz - 1, 3, 1, 3, e === 'ladrillo' ? s.trim : EP.madera.stoneD);
    }
    for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = z0 - 1; z <= z1 + 1; z++) v.set(x, ph + 1, z, e === 'madera' ? EP.madera.joint : e === 'piedra' ? EP.piedra.beam : s.frame);
  } else {
    // patas y tolva (embudo) debajo del depósito
    for (const [px, pz] of [[3, 3], [10, 3], [3, 10], [10, 10]]) v.box(px, 1, pz, 1, ph + 2, 1, s.trim);
    for (let a = 3; a <= 10; a++) for (const b of [3, 10]) { v.set(a, 3, b, s.joint); v.set(b, 3, a, s.joint); }
    const tc = e === 'hierro' ? s.sheetD : EP.vidrio.steel;
    for (let j = 0; j < 4; j++) v.cylinder(6.5, ph + 1 - j, 6.5, 3.6 - j * 0.85, 1, j % 2 ? shade(tc, -0.08) : tc);
    v.box(6, ph - 3, 6, 2, 1, 2, INK);
  }
  // el depósito
  const y0 = ph + 2, wh = 5 + (L >= 3 ? 3 : 0);
  if (e === 'madera') {
    v.box(x0, y0, z0, x1 - x0 + 1, wh, z1 - z0 + 1, (x, y, z) => {
      const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
      if (corner || y === y0 || y === y0 + wh - 1) return post;
      return (x + z) % 2 ? s.wall : s.wallD;                       // tablas verticales con rendijas
    });
  } else if (bin) {
    v.cylinder(6.5, y0, 6.5, 4.1, wh, (x, y) => (e === 'hierro' ? ((y - y0) % 3 === 2 ? s.trim : (x + y) % 2 ? s.sheet : s.sheetD) : (y === y0 + wh - 2 ? C.glassD : (y - y0) % 3 === 0 ? EP.vidrio.steel : EP.vidrio.white)));
    for (let j = 0; j < 3; j++) v.set(6 + (j % 2), y0 + 1 + j, 10, INK);   // escotilla
  } else eraWall(m, x0, y0, z0, x1 - x0 + 1, wh, z1 - z0 + 1, era, { noBase: true, sheet: e === 'hierro', floorLines: false, seed: 11 });
  // respiraderos (rendijas oscuras) en la fachada
  if (e === 'piedra' || e === 'ladrillo') for (const u of [3, 9]) fbox(v, 'pz', z1, u, y0 + 1, 1, 3, 0, INK);
  if (!bin) eraOpening(m, 'pz', z1, 6, y0, era, 'puerta', { w: 2, h: 3 });
  // escalera de mano hasta la puerta
  for (const lx of [5, 8]) v.box(lx, 1, z1 + 1, 1, y0, 1, post);
  for (let y = 2; y < y0; y += 2) for (const lx of [6, 7]) v.set(lx, y, z1 + 1, post);
  const roofTop = y0 + wh;
  const rk = L >= 3 ? 'alto' : e === 'madera' ? 'paja' : 'dos_aguas';
  const rt = bin ? cone(v, 6.5, roofTop, 6.5, 4.6, L >= 3 ? 4 : 3, e === 'hierro' ? s.sheet : EP.vidrio.white, { trim: e === 'hierro' ? s.trim : EP.vidrio.steel })
    : eraRoof(m, x0, x1, z0, z1, roofTop, era, { kind: rk, axis: 'x', oh: 1, color: e === 'hierro' ? s.sheet : undefined, dormers: false });
  if (bin) { v.box(6, rt, 6, 2, 1, 2, INK); if (e === 'vidrio' && L >= 3) v.cylinder(6.5, rt + 1, 6.5, 0.8, 1, EP.vidrio.steel); }
  let peak = rt;
  // bolsas de grano (siempre) y, con el nivel, más
  const sack = (x, y, z, c = GRAIN) => { v.box(x, y, z, 2, 2, 2, c); v.set(x, y + 2, z, GRAIND); };
  sack(1, 1, 12); sack(3, 1, 13, GRAIND); if (L >= 3) { sack(1, 1, 14); sack(2, 3, 12); }
  // nivel 2: agua guardada al costado (barriles, aljibe, cisterna, tanque remachado o tanque blanco)
  if (L >= 2) {
    if (e === 'madera') for (const z of [4, 8]) { v.cylinder(13.5, 1, z + 0.5, 1.4, 3, (x, y) => (y === 2 ? EP.madera.joint : EP.madera.plankD)); v.cylinder(13.5, 4, z + 0.5, 1, 1, WATER); }
    else if (e === 'piedra') { v.cylinder(13.5, 1, 6.5, 2.3, 3, (x, y, z) => stoneMix(x, y, z)); v.cylinder(13.5, 3, 6.5, 1.3, 1, WATER); for (const z of [4, 9]) v.box(13, 4, z, 1, 4, 1, EP.piedra.beam); v.box(13, 8, 4, 1, 1, 6, EP.piedra.beam); v.box(13, 5, 6, 1, 2, 1, INK); }
    else if (e === 'ladrillo') { v.box(12, 1, 3, 4, 4, 7, (x, y) => (y === 4 ? s.trim : y % 4 === 2 ? s.joint : s.wall)); v.box(13, 5, 4, 2, 1, 5, WATER); v.box(14, 5, 9, 1, 3, 1, s.accent); v.box(13, 7, 9, 2, 1, 1, s.accent); }
    else if (e === 'hierro') { v.cylinder(13.5, 1, 6.5, 2.4, 6, (x, y) => (y === 2 || y === 5 ? s.trim : s.accent)); cone(v, 13.5, 7, 6.5, 2.6, 2, s.sheetD); }
    else { v.cylinder(13.5, 1, 6.5, 2.4, 7, (x, y) => (y === 3 ? WATER : y === 6 ? EP.vidrio.steel : EP.vidrio.white)); v.cylinder(13.5, 8, 6.5, 2.6, 1, EP.vidrio.steel); }
  }
  // nivel 4: torre de la noria (elevador de grano) con su techo
  if (L >= 4) {
    const Ht = roofTop + 3;
    let tt;
    if (e === 'madera' || e === 'hierro') tt = eraTower(m, era, 12, 11, 3, Ht);
    else tt = eraWall(m, 12, 1, 11, 3, Ht, 3, era, { FH: 5, seed: 4, noBase: e === 'vidrio', tint: e === 'vidrio' ? EP.vidrio.white : undefined });
    v.box(11, tt, 10, 5, 1, 5, e === 'madera' ? s.wallD : s.trim);
    const rc = e === 'hierro' ? s.sheet : e === 'vidrio' ? EP.vidrio.steel : s.roof;
    peak = Math.max(peak, hip(v, 12, 14, 11, 13, tt + 1, rc, { oh: 1 }));
    for (let i = 0; i < 3; i++) v.set(11 - i, tt - 1 - i, 11, e === 'madera' ? post : s.joint);   // canaleta al depósito
  }
  // nivel 5: cerco y bandera dorada en la cumbrera
  if (L >= 5) {
    eraFence(m, era, { gaps: [5, 6, 7, 8] });
    v.box(7, rt, 6, 1, 6, 1, post);
    wavingFlag(m, 7, rt + 3, 6, 4, 3, COPPER);
    peak = Math.max(peak, rt + 7);
  }
  m.height = peak + 1;
}

// ======================= CUARTEL DE BOMBEROS (2×2) =======================
function garageDoor(m, era, u, w, h, z) {
  const v = m.v, s = eraStyle(era), e = s.id, post = postOf(s);
  switch (e) {
    case 'madera':
      fbox(v, 'pz', z, u, 1, w, h, 0, (i, j) => (j === h - 1 || i === 0 || i === w - 1 || i === Math.floor(w / 2) ? post : FIRE));
      for (let j = 0; j < h - 1; j++) { const a = Math.round(j * (Math.floor(w / 2) - 1) / (h - 2)); fset(v, 'pz', z, u + 1 + a, j, 1, '#f2ece2'); }
      break;
    case 'piedra': case 'ladrillo': {
      fbox(v, 'pz', z, u, 1, w, h, 0, (i, j) => (i === Math.floor(w / 2) ? FIRED : j === h - 2 ? C.glassD : FIRE));
      // arco de dovelas
      fbox(v, 'pz', z, u - 1, 1, 1, h, 0, s.trim); fbox(v, 'pz', z, u + w, 1, 1, h, 0, s.trim);
      fbox(v, 'pz', z, u, h + 1, w, 1, 0, s.trim);
      fset(v, 'pz', z, u, h, 0, s.trim); fset(v, 'pz', z, u + w - 1, h, 0, s.trim);
      break;
    }
    case 'hierro':
      fbox(v, 'pz', z, u, 1, w, h, 0, (i, j) => (j % 2 ? FIRE : FIRED));                    // cortina de enrollar
      fbox(v, 'pz', z, u - 1, h + 1, w + 2, 1, 1, s.trim);
      fbox(v, 'pz', z, u - 1, 1, 1, h, 0, s.trim); fbox(v, 'pz', z, u + w, 1, 1, h, 0, s.trim);
      break;
    default:
      fbox(v, 'pz', z, u, 1, w, h, 0, (i, j) => (i === 0 || i === w - 1 || j === h - 1 ? FIRE : j % 2 ? C.glass : C.glassD));
      fbox(v, 'pz', z, u - 1, h + 1, w + 2, 1, 1, FIRE);
  }
}
function bomberos(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id, post = postOf(s);
  eraGround(m, era, { path: [2, 9], pathZ: 12 });
  const tint = e === 'madera' || e === 'hierro' ? FIRE : undefined;   // tablas pintadas o paños de rojo
  const b = cycleBody(m, L, era, { x0: 1, x1: 11, z0: 2, z1: 11, wins: [], tint, seed: 21, noVertical: true, noCrown: true, gaps: [2, 3, 4, 5, 6, 7, 8, 9],
    annex: { x0: 12, x1: 15, z0: 4, z1: 11, door: false } });
  if (e === 'vidrio') {   // muro cortina con montantes rojos
    for (const [k, c] of v.map) {
      const [x, y, z] = k.split(',').map(Number);
      if (y >= 1 && x >= 1 && x <= 15 && z >= 2 && z <= 11 && (c === hexInt(s.trim))) v.map.set(k, hexInt(FIRE));
    }
  }
  garageDoor(m, era, 3, 6, 5, 11);
  if (L >= 2) garageDoor(m, era, 13, 2, 4, 11);
  // franja roja con el escudo sobre el portón (en Piedra, la única nota roja de la fachada)
  fbox(v, 'pz', 11, 2, 7, 8, 1, 0, e === 'ladrillo' ? s.trim : FIRE);
  fbox(v, 'pz', 11, 5, 7, 2, 1, 1, COPPER);
  if (L >= 3) for (const u of [2, 5, 8]) eraOpening(m, 'pz', 11, u, 3 + b.FH, era, 'ventana', { big: L >= 4, w: e === 'vidrio' ? 2 : undefined });
  let peak = b.peak;
  // campana en el techo (hasta que llega la torre)
  if (L < 4) {
    const y = b.roofTop + 1;
    for (const x of [5, 7]) v.box(x, y, 6, 1, 3, 1, post);
    v.box(5, y + 3, 6, 3, 1, 1, post);
    v.box(6, y + 1, 6, 1, 2, 1, COPPER);
    peak = Math.max(peak, y + 4);
  }
  // nivel 2: el carro (bomba de mano, bomba a vapor o autobomba)
  if (L >= 2) {
    if (e === 'madera' || e === 'piedra') {
      v.box(3, 2, 13, 5, 2, 2, FIRE); v.box(3, 4, 13, 5, 1, 2, FIRED);
      v.cylinder(5, 5, 14, 0.8, 2, COPPER); v.box(8, 2, 13, 2, 1, 1, EP.madera.post);
      wheels(v, [3, 6], 12, 15);
    } else if (e === 'ladrillo') {
      v.box(3, 2, 12, 6, 2, 3, FIRE);
      v.cylinder(4.5, 4, 13.5, 1.2, 3, COPPER); v.box(4, 7, 13, 1, 2, 1, INK);
      wheels(v, [3, 7], 12, 14);
    } else {
      v.box(2, 2, 12, 7, 3, 3, FIRE); v.box(2, 2, 12, 7, 1, 3, FIRED);
      v.box(9, 2, 12, 2, 3, 3, FIRE); fbox(v, 'px', 10, 12, 3, 3, 1, 0, C.glassD);   // cabina
      for (let x = 2; x <= 8; x++) v.set(x, 5, 13, x % 2 ? EP.vidrio.steel : EP.vidrio.steelD);     // escalera
      m.light.set(9, 5, 12, '#ff5a4a'); m.light.set(9, 5, 14, '#5a8aff');
      wheels(v, [3, 8], 12, 14);
    }
  }
  // nivel 4: torre de mangueras con campana (o sirena)
  if (L >= 4) {
    const Ht = b.roofTop + 6;
    let tt;
    if (e === 'madera' || e === 'hierro') tt = eraTower(m, era, 12, 0, 4, Ht);
    else tt = eraWall(m, 12, 1, 0, 4, Ht, 4, era, { FH: 6, seed: 2, tint: e === 'vidrio' ? FIRE : undefined });
    // mangueras colgando
    for (let j = 0; j < 6; j++) { v.set(13, tt - 2 - j, 4, '#f2ece2'); v.set(14, tt - 3 - j, 4, '#f2ece2'); }
    if (e === 'hierro' || e === 'vidrio') {
      v.box(12, tt, 0, 4, 1, 4, s.trim);
      v.box(13, tt + 1, 1, 2, 2, 2, e === 'hierro' ? s.joint : EP.vidrio.steel);   // sirena
      m.light.set(13, tt + 3, 1, '#ff5a4a');
      peak = Math.max(peak, tt + 4);
    } else {
      for (const [a, c] of [[12, 0], [15, 0], [12, 3], [15, 3]]) v.box(a, tt, c, 1, 3, 1, post);
      v.box(13, tt + 1, 1, 2, 2, 2, COPPER);
      peak = Math.max(peak, hip(v, 12, 15, 0, 3, tt + 3, s.roof, { oh: 1 }));
    }
  }
  // nivel 5: bandera roja y boca de incendio en la vereda
  if (L >= 5) {
    const fy = L >= 4 ? peak + 1 : b.roofTop + 1;
    v.box(14, fy, 2, 1, 5, 1, post);
    wavingFlag(m, 14, fy + 2, 2, 4, 3, FIRE);
    peak = Math.max(peak, fy + 6);
  }
  if (L >= 3) { v.box(11, 1, 14, 1, 2, 1, FIRE); v.set(11, 3, 14, COPPER); }
  m.height = peak + 1;
}

// ======================= PARARRAYOS (1×1) =======================
function pararrayos(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id;
  eraGround(m, era);
  const ph = 14 + L * 3;
  const bh = L >= 3 ? 3 : 2;
  const IRON = EP.hierro.ironD;
  let rod0;   // y donde empieza la varilla de hierro
  switch (e) {
    case 'madera':
      v.box(2, 1, 2, 4, bh, 4, stoneMix);
      v.box(3, bh + 1, 3, 2, ph - bh - 4, 2, (x, y) => (y % 5 === 0 ? EP.madera.joint : EP.madera.post));
      rod0 = ph - 3;
      break;
    case 'piedra': {
      v.box(1, 1, 1, 6, 1, 6, s.wallD);
      eraWall(m, 2, 2, 2, 4, bh, 4, era, { noBase: true, seed: 3 });
      const oh = Math.round(ph * 0.5);
      eraWall(m, 3, bh + 2, 3, 2, oh - bh - 2, 2, era, { noBase: true, seed: 8 });
      v.box(3, oh, 3, 2, 1, 2, s.trim);
      rod0 = oh + 1;
      break;
    }
    case 'ladrillo': {
      v.box(2, 1, 2, 4, bh, 4, (x, y) => (y === bh ? s.trim : s.wall));
      const oh = Math.round(ph * 0.55);
      v.box(3, bh + 1, 3, 2, oh - bh, 2, (x, y) => ((y - bh) % 5 === 0 ? s.trim : y % 4 === 2 ? s.joint : s.wall));
      v.box(3, oh + 1, 3, 2, 1, 2, s.accent);
      rod0 = oh + 2;
      break;
    }
    case 'hierro': {
      v.box(1, 1, 1, 6, 1, 6, s.ground);
      const yl = ph - 5;
      for (let y = 2; y <= yl; y++) {
        const k = (y - 2) / (yl - 2), off = Math.round(2 * (1 - k));
        const a = 3 - off, b = 4 + off;
        for (const [x, z] of [[a, a], [b, a], [a, b], [b, b]]) v.set(x, y, z, s.trim);
        if (y % 4 === 0) for (let i = a; i <= b; i++) { v.set(i, y, a, s.joint); v.set(i, y, b, s.joint); v.set(a, y, i, s.joint); v.set(b, y, i, s.joint); }
      }
      rod0 = yl + 1;
      break;
    }
    default: {
      v.box(2, 1, 2, 4, bh, 4, (x, y) => (y === bh ? EP.vidrio.steel : EP.vidrio.white));
      v.box(3, bh + 1, 3, 2, ph - bh - 4, 2, (x, y) => (y % 6 === 0 ? EP.vidrio.steelD : EP.vidrio.steel));
      for (let y = bh + 6; y < ph - 3; y += 6) m.light.set(5, y, 4, '#ff6a5a');
      // panel solar en la base
      v.box(5, 1, 5, 3, 1, 2, EP.vidrio.steelD); v.box(5, 2, 5, 3, 1, 2, EP.vidrio.panel);
      rod0 = ph - 3;
    }
  }
  v.box(3, rod0, 3, 1, ph - rod0 + 1, 1, IRON);
  v.box(3, ph + 1, 3, 1, 2, 1, COPPER);
  v.set(3, ph + 3, 3, COPPERD);
  // bajada de cobre a tierra por el frente
  for (let y = 1; y <= bh; y++) v.set(4, y, 6, COPPERD);
  // nivel 2: vientos (Madera y Vidrio y acero) o mojones de las esquinas
  if (L >= 2) {
    const bc = e === 'madera' ? EP.madera.post : e === 'hierro' ? s.fence : s.trim;
    for (const [x, z] of [[0, 0], [7, 0], [0, 7], [7, 7]]) { v.box(x, 1, z, 1, 2, 1, bc); v.set(x, 3, z, COPPERD); }
    v.box(6, 1, 1, 1, 2, 2, e === 'madera' ? EP.madera.plankD : INK); v.set(6, 2, 3, COPPER);   // caja de la puesta a tierra
  }
  // nivel 3: chapa de aviso con el rayo en la base
  if (L >= 3) {
    fbox(v, 'pz', 5, 2, 1, 2, 3, 1, '#f2d24a');
    pattern(v, 'pz', 5, 2, 1, ['.X', 'XX', 'X.'], INK, 1);
  }
  // nivel 4: corona de puntas en cruz
  if (L >= 4) {
    const y = ph - 3;
    for (let i = 1; i <= 6; i++) { v.set(i, y, 3, IRON); v.set(3, y, i, IRON); }
    for (const [x, z] of [[1, 3], [6, 3], [3, 1], [3, 6]]) v.box(x, y + 1, z, 1, 2, 1, COPPER);
  }
  // nivel 5: bola de cobre, baliza y cerco
  if (L >= 5) {
    v.box(2, ph - 1, 2, 3, 2, 3, COPPER); v.box(3, ph - 2, 3, 1, 4, 1, COPPERD);
    m.light.set(3, ph + 4, 3, '#ff6a5a');
    eraFence(m, era, { gaps: [3, 4] });
  }
  m.height = ph + 5;
}

// ======================= REFUGIO (2×2) =======================
function refugio(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id, post = postOf(s);
  eraGround(m, era, { path: [6, 8], pathZ: 12 });
  const x0 = 2, x1 = 12, z0 = 2, z1 = 11, cx = 7;
  const wh = L >= 3 ? 6 : 3;
  const vault = e === 'hierro' || e === 'vidrio';
  let peak;
  const frame = e === 'madera' ? EP.madera.post : e === 'ladrillo' ? s.trim : e === 'vidrio' ? EP.vidrio.steel : s.trim;
  if (vault) {
    // bóveda de chapa acanalada (Hierro) o de paneles blancos con lucernario (Vidrio y acero)
    const R = 5.6;
    peak = 0;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, hh = Math.round(Math.sqrt(Math.max(0, R * R - dx * dx)));
      const hc = wh - 1 + hh;
      peak = Math.max(peak, hc);
      v.box(x, 1, z0, 1, hc, z1 - z0 + 1, (xx, yy, zz) => {
        if (zz === z1 || zz === z0) return e === 'hierro' ? (yy === 1 ? s.base : s.trim) : (yy === 1 ? EP.vidrio.steelD : EP.vidrio.white);
        if (e === 'hierro') return zz % 3 === 0 ? s.joint : xx % 2 ? s.sheet : s.sheetD;
        return yy === hc && Math.abs(dx) <= 1 ? C.glass : zz % 3 === 0 ? EP.vidrio.steel : EP.vidrio.white;
      });
    }
    // escarcha sobre la cumbrera
    for (let z = z0; z <= z1; z++) for (let x = cx - 1; x <= cx + 1; x++) if (e === 'hierro') v.set(x, peak + 1, z, SNOW);
    if (e === 'hierro') peak += 1;
  } else {
    eraWall(m, x0, 1, z0, x1 - x0 + 1, wh, z1 - z0 + 1, era, { seed: 17, FH: 6 });
    const roofC = e === 'madera' ? s.roof : s.roof;
    peak = gable(v, 'z', x0, x1, z0, z1, wh + 1, roofC, { wall: e === 'piedra' ? s.wall : e === 'ladrillo' ? s.wall : s.wallD, oh: 1, rise: 2, trim: s.roofD, ridge: SNOW });
  }
  // puerta y ventanas encendidas (la firma de la helada: adentro hay fuego)
  eraOpening(m, 'pz', z1, 6, 1, era, 'puerta', { w: 3, h: 4 });
  for (const u of [3, 10]) warmWin(m, 'pz', z1, u, 2, 2, 2, frame);
  const big = L >= 4;
  if (!vault) warmWin(m, 'pz', z1, big ? 5 : 6, wh + 4, big ? 5 : 3, big ? 3 : 2, frame);
  else if (L >= 3) warmWin(m, 'pz', z1, 6, wh + 2, 3, 2, frame);
  if (L >= 3) for (const u of [3, 10]) warmWin(m, 'pz', z1, u, 5, 2, 2, frame);
  warmWin(m, 'px', x1, 6, 2, 2, 2, frame);
  // chimenea grande con humo (siempre)
  const ct = peak + 3;
  if (e === 'madera' || e === 'piedra') { v.box(9, 1, 5, 3, ct, 3, stoneMix); v.box(9, ct + 1, 5, 3, 1, 3, EP.madera.stoneD); addSmoke(m, 9, ct + 2, 5); }
  else if (e === 'ladrillo') { v.box(9, 1, 5, 3, ct, 3, (x, y) => (y === ct - 2 ? s.trim : y % 4 === 2 ? s.joint : s.wall)); v.box(9, ct + 1, 5, 3, 1, 3, s.trim); addSmoke(m, 9, ct + 2, 5, '#ece6dc'); }
  else { v.box(10, 1, 6, 1, ct + 1, 1, e === 'hierro' ? INK : EP.vidrio.steelD); v.box(9, ct + 2, 5, 3, 1, 3, e === 'hierro' ? INK : EP.vidrio.steel); addSmoke(m, 9, ct + 3, 5, '#ece6dc'); }
  peak = Math.max(peak, ct + 2);
  // nivel 2: leñera con techito al costado
  if (L >= 2) {
    v.box(13, 1, 3, 2, 3, 7, (x, y, z) => (z === 9 ? '#d8b98a' : (y + z) % 2 ? EP.madera.plank : EP.madera.plankD));
    const rc = e === 'hierro' ? s.sheet : e === 'vidrio' ? EP.vidrio.white : e === 'madera' ? s.roof2 : s.roof;
    for (const z of [2, 10]) v.box(15, 1, z, 1, 4, 1, post);
    for (let x = 13; x <= 15; x++) for (let z = 2; z <= 10; z++) v.set(x, x === 15 ? 5 : 6 - (x - 13) % 2, z, rc);
    v.box(13, 1, 11, 1, 1, 2, EP.madera.plankD);   // tronco para partir
    v.set(13, 2, 12, '#9aa1a8');
  }
  // nivel 4: segunda chimenea (el elemento vertical de la época)
  if (L >= 4) {
    if (vault) peak = Math.max(peak, eraVertical(m, 3, wh + 3, 4, era, e === 'hierro' ? { w: 3, h: 3 } : { h: 7 }));
    else { v.box(3, 1, 7, 2, ct - 2, 2, e === 'ladrillo' ? s.wall : stoneMix); addSmoke(m, 3, ct, 7); }
  }
  // nivel 5: faroles en el camino, banco y cerco
  if (L >= 5) {
    for (const x of [5, 9]) lamp(m, x, 13, 3, e === 'madera' ? post : INK, WARM);
    v.box(1, 1, 13, 3, 1, 1, EP.madera.plankD); v.box(1, 2, 13, 3, 1, 1, EP.madera.plank);
    eraFence(m, era, { gaps: [6, 7, 8] });
  }
  m.height = peak + 2;
}

// ======================= HOSPITAL (3×3) =======================
function hospital(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era), e = s.id, post = postOf(s);
  eraGround(m, era, { path: [10, 13], pathZ: 13 });
  const tint = e === 'vidrio' ? undefined : WHITE;
  const b = cycleBody(m, L, era, { x0: 3, x1: 20, z0: 3, z1: 12, door: [10, 4], doorColor: '#6f8a9c', floors: [1, 1, 1, 2, 2],
    wins: e === 'vidrio' || e === 'hierro' ? [4, 15] : [4, 7, 15, 18], tint, seed: 31, gaps: [10, 11, 12, 13], noCrown: true, vert: [19, 4] });
  // marquesina sobre la entrada
  const my = 6;
  for (let x = 9; x <= 14; x++) for (let z = 13; z <= 15; z++) v.set(x, my, z, z === 15 ? HBLUE : e === 'vidrio' ? EP.vidrio.white : WHITE);
  for (const x of [9, 14]) v.box(x, 1, 15, 1, my - 1, 1, e === 'madera' ? post : e === 'vidrio' ? EP.vidrio.steel : s.trim);
  // nivel 2: dos alas al frente que arman el patio de entrada
  if (L >= 2) {
    const ah = b.FH + 1;
    for (const ax of [3, 16]) {
      const at = eraWall(m, ax, 1, 13, 5, ah, 5, era, { FH: b.FH, seed: ax, tint });
      eraRoof(m, ax, ax + 4, 13, 17, at, era, { kind: ['paja', 'dos_aguas', 'cuatro_aguas', 'plano', 'plano'][era - 1], axis: 'z', oh: 0, dormers: false });
      eraOpening(m, 'pz', 17, ax + 1, 3, era, 'ventana', { big: L >= 4, w: e === 'vidrio' ? 3 : undefined });
    }
  }
  // el cartel azul con la H sobre el techo (en el 1, más chico)
  const bw = L >= 3 ? 7 : 5, bu = 12 - Math.floor(bw / 2), by = b.top + 1;
  for (const x of [bu, bu + bw - 1]) v.box(x, b.top, 13, 1, 2, 1, e === 'madera' ? post : INK);
  fbox(v, 'pz', 13, bu, by + 1, bw, bw, 0, (i, j) => (i === 0 || i === bw - 1 || j === 0 || j === bw - 1 ? shade(HBLUE, -0.15) : HBLUE));
  if (bw === 7) pattern(v, 'pz', 13, bu + 1, by + 2, H5, '#ffffff', 0);
  else pattern(v, 'pz', 13, bu + 1, by + 2, ['X.X', 'XXX', 'X.X'], '#ffffff', 0);
  if (L >= 4) for (let i = 0; i < bw; i++) { m.light.set(bu + i, by + bw + 1, 13, '#fff3cf'); }
  let peak = Math.max(b.peak, by + bw + 2);
  // nivel 3: ambulancia (carro de caballos en Madera y Piedra, furgón blanco después)
  if (L >= 3) {
    if (e === 'madera' || e === 'piedra') {
      v.box(16, 2, 20, 5, 3, 3, WHITE); v.box(16, 5, 20, 5, 1, 3, shade(WHITE, -0.1));
      fbox(v, 'pz', 22, 17, 3, 3, 1, 1, HBLUE);
      wheels(v, [16, 19], 19, 23);
      v.box(21, 2, 21, 2, 1, 1, EP.madera.post);
    } else {
      v.box(15, 1, 20, 6, 4, 3, (x, y) => (y === 3 ? HBLUE : WHITE));
      v.box(21, 1, 20, 2, 3, 3, WHITE); fbox(v, 'px', 22, 20, 2, 3, 1, 0, C.glassD);
      m.light.set(21, 4, 20, '#ff5a4a'); m.light.set(21, 4, 22, '#5a8aff');
      wheels(v, [16, 20], 19, 23);
    }
  }
  // canteros a los costados del camino
  for (const x of [5, 7]) { v.box(x, 1, 19, 2, 1, 3, e === 'madera' ? EP.madera.plankD : s.trim); v.box(x, 2, 19, 2, 1, 3, C.leaf); v.set(x, 3, 20, P.clay); }
  // nivel 5: banderas (cerco lo pone body) y faroles
  if (L >= 5) {
    for (const x of [9, 14]) lamp(m, x, 21, 4, e === 'madera' ? post : INK);
    v.box(2, 1, 21, 1, 12, 1, post);
    wavingFlag(m, 2, 9, 21, 4, 3, HBLUE);
  }
  m.height = peak + 1;
}

export const DEFENSE_BUILDERS = { dique, granero, bomberos, pararrayos, refugio, hospital };
