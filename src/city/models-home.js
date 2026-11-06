// "Mi Casa" (id mi_casa, 2×2): tu casa en la ciudad. El nivel es el de la casa por dentro (home/furniture.js →
// HOME_LEVELS) y cada ampliación se nota de afuera:
//   1 casita de madera · 2 ventanal con jardineras · 3 cocina al costado con chimenea humeante
//   4 segundo piso con balcón · 5 altillo con claraboya, veleta, cerco dorado y farolitos.
import {
  P, C, shade, lot, win, door, gable, flowerBed, picket, smallTree, pattern, addSmoke, doorLamps, wavingFlag, HEART3,
} from './models-kit.js';

const WOOD = '#d9a06b', WOOD_D = '#b57d4c', WHITE = '#ffffff';
const grassLot = (x, z) => ((x * 3 + z * 5) % 7 === 0 ? P.grassD : P.grass);

function mi_casa(m, L) {
  const v = m.v;
  lot(v, 16, 16, grassLot);
  // sendero y cerco
  for (let z = 12; z < 16; z++) for (const x of [6, 7]) v.set(x, 0, z, (x + z) % 2 ? C.stoneL : P.stone);
  picket(v, 'x', 0, 15, 1, 15, L >= 5 ? P.gold : WHITE, [6, 7]);
  // planta baja (tablas de madera horizontales)
  const x0 = 2, x1 = L >= 3 ? 13 : 11, z0 = 3, z1 = 10, FH = 6;
  const floors = L >= 4 ? 2 : 1;
  const wall = (x, y) => (y % 2 ? WOOD : shade(WOOD, -0.05));
  v.box(x0, 1, z0, x1 - x0 + 1, FH * floors, z1 - z0 + 1, (x, y, z) => (y === 1 ? C.stoneL : wall(x, y)));
  for (const x of [x0, x1]) for (const z of [z0, z1]) v.box(x, 1, z, 1, FH * floors, 1, WOOD_D);
  // puerta con corazón y ventanas
  door(v, 'pz', z1, 6, 2, 2, 4, P.berry, { frame: WHITE, step: C.stoneL, heart: P.gold });
  if (L >= 2) win(v, 'pz', z1, 2, 3, 3, 3, { frame: WHITE, box: P.clayD, wide: true, flowers: [P.berry, C.yellow, WHITE] });  // ventanal
  else win(v, 'pz', z1, 3, 3, 2, 2, { shutters: P.mint, sill: WHITE });
  win(v, 'pz', z1, 9, 3, 2, 2, { shutters: P.mint, sill: WHITE, box: L >= 2 ? P.clayD : undefined });
  win(v, 'px', x1, 5, 3, 2, 2, { shutters: P.mint });
  // 3+: cocina al costado (techito más bajo) con chimenea humeante
  if (L >= 3) {
    for (let z = z0 + 1; z <= z1 - 1; z++) v.set(x1, FH + 1 + (floors - 1) * FH, z, WHITE);
    v.box(12, 1, z1 + 1, 2, 3, 2, '#c9d2df'); v.set(12, 4, z1 + 1, P.ink);   // garrafa y tacho: rincón de cocina
    v.box(11, 1, 4, 2, FH * floors + 6, 2, '#d98f6a');
    addSmoke(m, 11, FH * floors + 7, 4);
  }
  // 4+: segundo piso con balcón y baranda
  if (L >= 4) {
    for (let x = x0; x <= x1; x++) v.set(x, FH + 1, z1, WHITE);
    win(v, 'pz', z1, 3, FH + 3, 2, 2, { shutters: P.sky, sill: WHITE });
    door(v, 'pz', z1, 7, FH + 2, 2, 3, P.sky, { frame: WHITE });
    v.box(5, FH + 1, z1 + 1, 6, 1, 2, WOOD_D);
    for (let x = 5; x <= 10; x++) v.set(x, FH + 2, z1 + 2, WHITE);
    v.set(5, FH + 3, z1 + 2, P.berry); v.set(10, FH + 3, z1 + 2, C.leaf);
  }
  // techo a dos aguas (azul), con hastial al frente
  const top = 1 + FH * floors;
  const rt = gable(v, 'z', x0, x1, z0, z1, top, L >= 5 ? C.roofSlate : C.roofClay, { wall: WOOD, trim: WHITE, ridge: L >= 4 ? P.gold : undefined });
  pattern(v, 'pz', z1, Math.floor((x0 + x1) / 2) - 1, top + 1, HEART3, P.berry);
  // 5: altillo con buhardilla y claraboya, veleta
  if (L >= 5) {
    const bx = Math.floor((x0 + x1) / 2) - 1;
    v.box(bx, top + 3, z1 - 2, 4, 3, 3, WOOD); gable(v, 'z', bx, bx + 3, z1 - 2, z1, top + 6, C.roofClay, { oh: 0, wall: WOOD, trim: WHITE });
    win(v, 'pz', z1, bx + 1, top + 3, 2, 2, { frame: WHITE, sill: false });
    m.glow.box(bx - 2, rt - 1, z0 + 2, 2, 1, 2, '#bfe8ff');                    // claraboya
    v.box(x0 + 1, rt, z0 + 3, 1, 4, 1, P.ink); wavingFlag(m, x0 + 1, rt + 2, z0 + 3, 3, 2, P.berry);
    doorLamps(m, 'pz', z1, 5, 8, 2);
  }
  // jardín: canteros y arbolito (crece con la casa)
  flowerBed(v, 1, 1, 12, 4, 2, 3 + L);
  flowerBed(v, 9, 1, 12, 5, 2, 9 + L);
  if (L >= 2) smallTree(v, 14, 1, 2, 3 + L, 2 + L * 0.15, L >= 4 ? '#f4a6c0' : C.leaf, 21 + L);
  v.box(13, 1, 13, 1, 3, 1, WOOD_D); v.box(13, 4, 12, 1, 2, 2, L >= 3 ? P.sky : P.clay);   // buzón
}

export const HOME_BUILDERS = { mi_casa };
