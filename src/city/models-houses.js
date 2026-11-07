// Casas: casa, cabaña, chalet, torre y casona, con arte por época (DESIGN-CORE.md §4.2).
// Un mismo armador (eraHouse) dibuja cada casa en Madera, Piedra, Ladrillo, Hierro o Vidrio y acero, y cada nivel
// cambia la estructura:
//   1 volumen base con el techo de la época · 2 anexo lateral (o galería) · 3 un piso más y otro techo
//   4 el elemento vertical de la época y aberturas más grandes · 5 remate arriba y cerco de la época alrededor del lote
// La identidad de cada casa va en sus proporciones, su techo, su porche o balcón y un color de acento.
import {
  P, C, shade, bush, smallTree, flowerBed, fbox, fset, eraStyle, eraWall, eraRoof, eraOpening, eraVertical, eraFence,
  eraGround, eraCrown, addSmoke,
} from './models-kit.js';

// techo por época: niveles 1–2 y desde el 3
const ROOF_LOW = ['paja', 'dos_aguas', 'cuatro_aguas', 'plano', 'plano'];
const ROOF_HIGH = ['alto', 'alto', 'mansarda', 'mansarda', 'terraza'];
const FLAT = new Set(['plano', 'terraza', 'mansarda']);

/** Ventanas de un piso en una cara, salteando el hueco [skip0, skip1]. */
function windowsRow(m, face, plane, u0, u1, y, era, o = {}) {
  const s = eraStyle(era);
  if (s.id === 'vidrio' && !o.force) return;          // el muro cortina ya es vidriado
  const probe = s.id === 'hierro' ? 3 : s.id === 'vidrio' ? 4 : 2;
  const w = probe + (o.big && s.id !== 'hierro' ? 1 : 0);
  const step = w + 2;
  const span = u1 - u0 + 1;
  const n = Math.max(1, Math.floor((span + 2) / step));
  const start = u0 + Math.floor((span - (n * step - 2)) / 2);
  for (let i = 0; i < n; i++) {
    const u = start + i * step;
    if (o.skip && u + w > o.skip[0] && u < o.skip[1] + 1) continue;
    eraOpening(m, face, plane, u, y, era, 'ventana', { big: o.big, box: o.box, flowers: o.flowers });
  }
}

/**
 * Armador de casas. spec: { x0, x1, z0, z1, floors: [por época], axis, door: [u, w], accent, porch, balcony, tall,
 *   annex: [x0, x1, z0, z1], seed, chimney: [x, z] }
 * Devuelve { top, roofTop }.
 */
export function eraHouse(m, L, era, spec) {
  const v = m.v, s = eraStyle(era), e = era - 1;
  const { x0, x1, z0, z1 } = spec;
  const FH = s.FH;
  const floors = spec.floors[e] + (L >= 3 ? 1 : 0);
  const H = floors * FH + 1;
  const big = L >= 4;
  const [du, dw] = spec.door;
  eraGround(m, era, { path: [du, du + dw - 1], pathZ: z1 + 1 });
  // ---- cuerpo principal ----
  const wallTop = eraWall(m, x0, 1, z0, x1 - x0 + 1, H, z1 - z0 + 1, era, { FH, seed: spec.seed });
  eraOpening(m, 'pz', z1, du, 1, era, 'puerta', { w: dw, color: spec.accent });
  for (let f = 0; f < floors; f++) {
    const wy = 3 + f * FH;
    const box = spec.flowerBoxes && L >= 2 ? spec.accent : undefined;
    windowsRow(m, 'pz', z1, x0 + 1, x1 - 1, wy, era, { big, skip: f === 0 ? [du - 1, du + dw] : null, box, flowers: [P.clay, '#ffffff'] });
    windowsRow(m, 'px', x1, z0 + 1, z1 - 1, wy, era, { big });
    windowsRow(m, 'nx', x0, z0 + 1, z1 - 1, wy, era, {});
  }
  // vidrio: una franja de vidrio "real" (se prende de noche) en cada piso
  if (s.id === 'vidrio') for (let f = 0; f < floors; f++) fbox(v, 'pz', z1, x0 + 2, 3 + f * FH, x1 - x0 - 3, 2, 0, (i, j) => (i % 3 === 2 ? s.trim : j ? C.glass : C.glassD));
  // ---- balcón (chalet, torre): en cada piso alto ----
  if (spec.balcony && floors > 1) for (let f = 1; f < floors; f += spec.tall ? 2 : 1) {
    const by = 1 + f * FH;
    for (let x = x0 + 1; x <= x1 - 1; x++) { v.set(x, by, z1 + 1, s.id === 'madera' ? s.wallD : s.trim); v.set(x, by + 2, z1 + 1, s.id === 'ladrillo' ? s.accent : s.trim); if (x % 2 === 0) v.set(x, by + 1, z1 + 1, s.id === 'ladrillo' ? s.accent : s.trim); }
    if (s.id === 'vidrio') for (let x = x0 + 1; x <= x1 - 1; x++) v.set(x, by + 1, z1 + 1, C.glass);
  }
  // ---- techo ----
  const kind = spec.tall ? (L >= 3 ? (s.id === 'madera' || s.id === 'piedra' ? 'alto' : 'terraza') : (s.id === 'madera' ? 'paja' : s.id === 'piedra' ? 'dos_aguas' : 'plano')) : (L >= 3 ? ROOF_HIGH : ROOF_LOW)[e];
  const roofTop = eraRoof(m, x0, x1, z0, z1, wallTop, era, { kind, axis: spec.axis || 'z', oh: spec.oh ?? 1, dormers: !spec.tall });
  let peak = roofTop;
  // ---- nivel 2: anexo lateral con su techito (o galería si la casa tiene porche) ----
  if (L >= 2 && spec.annex) {
    const [ax0, ax1, az0, az1] = spec.annex;
    const ah = FH + 1;
    const at = eraWall(m, ax0, 1, az0, ax1 - ax0 + 1, ah, az1 - az0 + 1, era, { FH, seed: spec.seed + 3 });
    const akind = FLAT.has(ROOF_LOW[e]) || s.id === 'ladrillo' ? 'plano' : ROOF_LOW[e];
    eraRoof(m, ax0, ax1, az0, az1, at, era, { kind: akind, axis: 'x', oh: 0 });
    eraOpening(m, 'pz', az1, ax0 + 1, 3, era, 'ventana', { box: spec.accent, flowers: [P.clay, C.yellow] });
    if (s.id === 'vidrio') fbox(v, 'pz', az1, ax0 + 1, 3, ax1 - ax0 - 1, 2, 0, (i, j) => (j ? C.glass : C.glassD));
  }
  if (spec.porch) {
    // galería al frente: piso, postes y alero de la época
    const pz0 = z1 + 1, pz1 = Math.min(m.D - 2, z1 + 3);
    for (let x = x0; x <= x1; x++) for (let z = pz0; z <= pz1; z++) v.set(x, 1, z, s.id === 'madera' ? s.wallD : s.trim);
    for (const x of [x0, x1]) v.box(x, 2, pz1, 1, FH - 2, 1, s.trim);
    for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = pz0; z <= pz1 + 1; z++) v.set(x, FH, z, z === pz1 + 1 ? (s.roofD || s.trim) : (s.id === 'vidrio' || s.id === 'hierro' ? s.trim : s.roof));
  }
  // ---- nivel 4: elemento vertical de la época ----
  if (L >= 4) {
    const [cx, cz] = spec.chimney || [x0 + 1, z0 + 1];
    if (s.id === 'piedra') { const [tx, tz] = spec.tower || [x1 + 1, z0 - 1]; peak = Math.max(peak, eraVertical(m, tx, 1, tz, era, { w: 4, h: H + 5 })); }
    else if (s.id === 'hierro') peak = Math.max(peak, eraVertical(m, x1 - 4, roofTop, z0 + 1, era, { w: 4, h: 3 }));
    else if (s.id === 'vidrio') peak = Math.max(peak, eraVertical(m, x1 - 2, roofTop, z0 + 1, era, { h: 8 }));
    else peak = Math.max(peak, eraVertical(m, cx, wallTop - 1, cz, era, { h: roofTop - wallTop + (s.id === 'ladrillo' ? 7 : 4) }));
  }
  // ---- nivel 5: remate arriba y cerco de la época ----
  if (L >= 5) {
    const cx = Math.floor((x0 + x1) / 2), cz = Math.floor((z0 + z1) / 2) + (FLAT.has(kind) ? 0 : 0);
    peak = Math.max(peak, eraCrown(m, cx, roofTop + (FLAT.has(kind) ? 0 : 1), cz, era, { flag: spec.accent, w: Math.min(9, x1 - x0 - 1), sign: spec.accent }));
    const gaps = []; for (let x = du - 1; x <= du + dw; x++) gaps.push(x);
    eraFence(m, era, { gaps });
  }
  return { top: wallTop, roofTop, peak };
}

/** Detalles del jardín según la época (no tapan la puerta ni el cerco). */
function yard(m, L, era, spec, seed) {
  const v = m.v, s = eraStyle(era);
  const D = m.D;
  if (s.id === 'madera') { // leña y barril
    for (let z = 2; z <= 4; z++) { v.set(m.W - 3, 1, z, s.wall); v.set(m.W - 3, 2, z, z % 2 ? s.wallD : s.light); }
  } else if (s.id === 'piedra') bush(v, m.W - 3, 1, 3, 1.4, P.leafD, null, seed);
  else if (s.id === 'ladrillo') { v.box(m.W - 3, 1, 2, 1, 4, 1, P.ink); m.light.set(m.W - 3, 5, 2, C.yellow); }
  else if (s.id === 'hierro') { v.box(m.W - 4, 1, 2, 2, 2, 2, s.accent); v.set(m.W - 4, 3, 2, s.trim); }
  else { v.box(m.W - 4, 1, 2, 2, 1, 2, s.trim); bush(v, m.W - 3, 2, 3, 1.2, P.leaf, null, seed); }
  if (!spec.noBeds) {
    flowerBed(v, 1, 1, D - 3, 3, 1, seed + L, { colors: [P.clay, '#ffffff', C.yellow] });
  }
}

// ======================= CASA =======================
function casita(m, L, o = {}) {
  const era = o.era || 1;
  const spec = { x0: 2, x1: 10, z0: 3, z1: 11, floors: [1, 1, 2, 2, 2], axis: 'z', door: [5, 2], accent: P.clayD, flowerBoxes: true,
    annex: [11, 14, 6, 11], seed: 3, chimney: [8, 5] };
  if (eraStyle(era).id === 'piedra' || eraStyle(era).id === 'hierro' || eraStyle(era).id === 'vidrio') spec.door = [5, 3];
  eraHouse(m, L, era, spec);
  yard(m, L, era, spec, 11);
  if (L < 2) { smallTree(m.v, 13, 1, 9, 4, 1.8, P.leaf, 5); }
}

// ======================= CABAÑA =======================
function cabana(m, L, o = {}) {
  const era = o.era || 1;
  const spec = { x0: 1, x1: 11, z0: 2, z1: 9, floors: [1, 1, 1, 2, 2], axis: 'x', door: [5, 2], accent: P.mintD, porch: true,
    annex: [12, 14, 3, 9], seed: 7, chimney: [2, 4], noBeds: true };
  if (eraStyle(era).id !== 'madera' && eraStyle(era).id !== 'ladrillo') spec.door = [5, 3];
  eraHouse(m, L, era, spec);
  yard(m, L, era, spec, 17);
  bush(m.v, 13.5, 1, 12.5, 1.5, P.leaf, L >= 2 ? [P.clay, '#ffffff'] : null, 9);
}

// ======================= CHALET =======================
function chalet(m, L, o = {}) {
  const era = o.era || 1;
  const spec = { x0: 2, x1: 11, z0: 2, z1: 10, floors: [2, 2, 2, 3, 3], axis: 'z', door: [6, 2], accent: P.slateD, balcony: true,
    annex: [12, 14, 4, 10], seed: 13, chimney: [3, 4], oh: 1 };
  if (eraStyle(era).id === 'piedra' || eraStyle(era).id === 'hierro' || eraStyle(era).id === 'vidrio') spec.door = [6, 3];
  eraHouse(m, L, era, spec);
  yard(m, L, era, spec, 23);
  smallTree(m.v, 14, 1, 13, 4, 1.7, P.leaf, 7, L >= 3 ? [P.clay] : null);
}

// ======================= TORRE =======================
function torreCristal(m, L, o = {}) {
  const era = o.era || 1;
  const spec = { x0: 3, x1: 11, z0: 3, z1: 11, floors: [2, 3, 3, 4, 5], axis: 'z', door: [6, 3], accent: P.skyD, balcony: true, tall: true,
    annex: [12, 14, 6, 11], seed: 19, chimney: [4, 4], noBeds: false };
  eraHouse(m, L, era, spec);
  yard(m, L, era, spec, 29);
}

// ======================= CASONA (3×3) =======================
function mansion(m, L, o = {}) {
  const era = o.era || 1, v = m.v, s = eraStyle(era);
  const spec = { x0: 6, x1: 17, z0: 4, z1: 13, floors: [1, 2, 2, 2, 3], axis: 'x', door: [10, 4], accent: P.clayD, flowerBoxes: true,
    seed: 31, chimney: [7, 6] };
  const r = eraHouse(m, L, era, spec);
  const FH = s.FH;
  // alas a los dos lados (la izquierda desde el nivel 1, la derecha desde el 2)
  const wings = L >= 2 ? [[1, 5], [18, 22]] : [[1, 5]];
  for (const [a, b] of wings) {
    const wf = L >= 3 ? 2 : 1, wh = wf * FH + 1;
    const wt = eraWall(m, a, 1, 6, b - a + 1, wh, 8, era, { FH, seed: a });
    for (let f = 0; f < wf; f++) windowsRow(m, 'pz', 13, a + 1, b - 1, 3 + f * FH, era, { big: L >= 4, box: L >= 2 ? spec.accent : undefined, flowers: [P.clay, '#ffffff'], force: s.id === 'vidrio' });
    if (b === 22) for (let f = 0; f < wf; f++) windowsRow(m, 'px', 22, 7, 12, 3 + f * FH, era, {});
    eraRoof(m, a, b, 6, 13, wt, era, { kind: FLAT.has(ROOF_LOW[era - 1]) ? 'plano' : 'cuatro_aguas', oh: 1 });
  }
  // pórtico con columnas y frontón de la época
  const ph = FH + 2;
  for (let x = 9; x <= 14; x++) for (let z = 14; z <= 16; z++) v.set(x, 1, z, s.trim);
  for (const x of [9, 14]) v.box(x, 2, 16, 1, ph - 1, 1, s.id === 'madera' ? s.trim : s.light === s.trim ? s.trim : s.trim);
  for (let x = 8; x <= 15; x++) for (let z = 14; z <= 17; z++) v.set(x, ph + 1, z, s.id === 'vidrio' ? s.light : s.roofD || s.trim);
  if (!FLAT.has(ROOF_LOW[era - 1])) for (let st = 0; st < 3; st++) for (let x = 8 + st; x <= 15 - st; x++) v.set(x, ph + 2 + st, 17, st === 2 ? s.roofD : s.roof);
  // fuente y jardín
  if (L >= 3) {
    v.cylinder(4, 1, 19, 2.4, 2, s.trim); v.cylinder(4, 2, 19, 1.5, 1, C.water); v.box(4, 2, 19, 1, 3, 1, s.trim); m.light.set(4, 5, 19, C.waterL);
  } else smallTree(v, 4, 1, 19, 5, 2.2, P.leaf, 21);
  flowerBed(v, 17, 1, 18, 5, 3, 61 + L, { colors: [P.clay, '#ffffff', C.yellow] });
  if (L >= 2) smallTree(v, 21, 1, 3, 5, 2, P.leaf, 22);
  m.height = r.peak + 1;
}

export const HOUSE_BUILDERS = { casita, cabana, chalet, torre_cristal: torreCristal, mansion };
