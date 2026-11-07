// "Mi Casa" (id mi_casa, 2×2): tu casa en la ciudad. El nivel es el de la casa por dentro (home/furniture.js →
// HOME_LEVELS) y cada ampliación se nota de afuera:
//   1 casa de un piso · 2 ventanal con jardineras · 3 cocina al costado con chimenea humeante
//   4 segundo piso con balcón · 5 altillo con claraboya, veleta, cerco de la época y faroles.
// Los muros, el techo y las aberturas siguen a la época de la ciudad (tanda 3, DESIGN-CORE.md §4); lo que la hace tuya
// no cambia: puerta bordó, corazón en el hastial, buzón, canteros y el árbol que crece con la casa.
import {
  P, C, shade, gable, flowerBed, picket, smallTree, pattern, addSmoke, doorLamps, wavingFlag, HEART3,
  eraStyle, eraWall, eraRoof, eraOpening, eraVertical, eraFence, eraGround,
} from './models-kit.js';
import { ERA_PALETTES as EP } from '../core/palette.js';

const WHITE = '#ffffff';

function mi_casa(m, L, o = {}) {
  const v = m.v, era = o.era || 1, s = eraStyle(era), e = s.id;
  eraGround(m, era, { path: [6, 7], pathZ: 11 });
  // cerco bajo (blanco hasta el 4; en el 5, el de la época)
  if (L < 5) picket(v, 'x', 0, 15, 1, 15, e === 'hierro' ? s.fence : e === 'vidrio' ? EP.vidrio.steel : WHITE, [6, 7]);
  // planta baja (y el segundo piso en el 4)
  const x0 = 2, x1 = L >= 3 ? 13 : 11, z0 = 3, z1 = 10, FH = 6;
  const floors = L >= 4 ? 2 : 1;
  const top = eraWall(m, x0, 1, z0, x1 - x0 + 1, FH * floors, z1 - z0 + 1, era, { FH, seed: 41 });
  // puerta bordó (la de siempre) y ventanas de la época
  eraOpening(m, 'pz', z1, 6, 1, era, 'puerta', { w: 2, h: 4, color: P.berry });
  if (L >= 2) eraOpening(m, 'pz', z1, 2, 3, era, 'ventana', { big: true, box: P.clayD, flowers: [P.berry, C.yellow, WHITE] });
  else eraOpening(m, 'pz', z1, 3, 3, era, 'ventana');
  eraOpening(m, 'pz', z1, 9, 3, era, 'ventana', { box: L >= 2 ? P.clayD : undefined });
  eraOpening(m, 'px', x1, 5, 3, era, 'ventana');
  // 3+: cocina al costado con chimenea humeante
  let peak = top;
  if (L >= 3) {
    v.box(12, 1, z1 + 1, 2, 3, 2, '#c9d2df'); v.set(12, 4, z1 + 1, P.ink);   // garrafa y tacho: rincón de cocina
    if (e === 'madera' || e === 'ladrillo') peak = Math.max(peak, eraVertical(m, 11, 1, 4, era, { h: top + 5 }));
    else if (e === 'piedra') { v.box(11, 1, 4, 2, top + 5, 2, (x, y) => (y % 3 ? s.wall : s.wallD)); v.box(11, top + 6, 4, 2, 1, 2, s.trim); addSmoke(m, 11, top + 7, 4); peak = Math.max(peak, top + 8); }
    else { v.box(12, 1, 4, 1, top + 6, 1, e === 'hierro' ? EP.hierro.black : EP.vidrio.steelD); addSmoke(m, 11, top + 7, 3); peak = Math.max(peak, top + 8); }
  }
  // 4+: segundo piso con balcón y baranda
  if (L >= 4) {
    eraOpening(m, 'pz', z1, 3, FH + 3, era, 'ventana');
    eraOpening(m, 'pz', z1, 7, FH + 1, era, 'puerta', { w: 2, h: 3, color: P.berry });
    v.box(5, FH + 1, z1 + 1, 6, 1, 2, e === 'madera' ? s.wallD : s.trim);
    const rail = e === 'madera' ? EP.madera.post : e === 'vidrio' ? C.glassD : s.accent;
    for (let x = 5; x <= 10; x++) v.set(x, FH + 2, z1 + 2, rail);
    v.set(5, FH + 3, z1 + 2, P.berry); v.set(10, FH + 3, z1 + 2, C.leaf);
  }
  // techo a dos aguas con el hastial al frente (en Vidrio y acero, plano con terraza)
  let rt;
  if (e === 'vidrio') rt = eraRoof(m, x0, x1, z0, z1, top, era, { kind: 'terraza', oh: 1 });
  else {
    const roofC = e === 'madera' ? s.roof2 : e === 'hierro' ? s.sheet : s.roof;
    const wallC = e === 'madera' ? s.wall : e === 'ladrillo' ? s.wall : s.trim;
    rt = gable(v, 'z', x0, x1, z0, z1, top, roofC, { wall: wallC, trim: e === 'madera' ? s.wallD : s.trim, ridge: L >= 4 ? P.gold : undefined });
    pattern(v, 'pz', z1, Math.floor((x0 + x1) / 2) - 1, top + 1, HEART3, P.berry);
  }
  peak = Math.max(peak, rt);
  if (e === 'vidrio') pattern(v, 'pz', z1, x1 - 4, top - 3, HEART3, P.berry, 1);   // el corazón, en la fachada
  // 5: altillo con buhardilla, claraboya y veleta; faroles en la puerta y cerco de la época
  if (L >= 5) {
    const bx = Math.floor((x0 + x1) / 2) - 1;
    if (e !== 'vidrio') {
      eraWall(m, bx, top + 3, z1 - 2, 4, 3, 3, era, { noBase: true, seed: 5 });
      gable(v, 'z', bx, bx + 3, z1 - 2, z1, top + 6, e === 'hierro' ? s.sheet : s.roof, { oh: 0, wall: e === 'ladrillo' ? s.wall : s.trim, trim: s.trim });
      eraOpening(m, 'pz', z1, bx + 1, top + 3, era, 'ventana');
      m.glow.box(bx - 2, rt - 1, z0 + 2, 2, 1, 2, '#bfe8ff');                  // claraboya
    } else { v.box(bx, top + 2, z0 + 2, 4, 1, 3, C.glassD); m.glow.box(bx + 1, top + 3, z0 + 3, 2, 1, 1, '#bfe8ff'); }
    v.box(x0 + 1, rt, z0 + 3, 1, 4, 1, P.ink); wavingFlag(m, x0 + 1, rt + 2, z0 + 3, 3, 2, P.berry);
    doorLamps(m, 'pz', z1, 5, 8, 2);
    eraFence(m, era, { gaps: [6, 7] });
    peak = Math.max(peak, rt + 5);
  }
  // jardín: canteros y arbolito (crece con la casa)
  flowerBed(v, 1, 1, 12, 4, 2, 3 + L);
  flowerBed(v, 9, 1, 12, 5, 2, 9 + L);
  if (L >= 2) smallTree(v, 14, 1, 2, 3 + L, 2 + L * 0.15, L >= 4 ? '#f4a6c0' : C.leaf, 21 + L);
  v.box(13, 1, 13, 1, 3, 1, e === 'madera' ? EP.madera.post : shade(s.trim, -0.2)); v.box(13, 4, 12, 1, 2, 2, L >= 3 ? P.sky : P.clay);   // buzón
  m.height = peak + 2;
}

export const HOME_BUILDERS = { mi_casa };
