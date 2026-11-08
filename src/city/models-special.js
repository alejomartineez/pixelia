// Edificios especiales que no son del ciclo ni de la ciudad común: hoy solo la Boutique de moda (vestidor).
// Los de los minijuegos retirados (joyería, torre de bloques, garaje, pista) se borraron en la Fase 5b.
import {
  P, C, shade, lot, win, door, hip, bush, pattern, spinStar, sparkle,
} from './models-kit.js';

// La Municipalidad (id 'castillo') está en models-town.js: un modelo por rango atado a las épocas.

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

export const SPECIAL_BUILDERS = { boutique_real: boutiqueReal };
