// Modelos vóxel de los muebles de Mi Casa (8 vóxeles por tile, como la ciudad). Frente = +Z, base y = 0.
// Los de pared se dibujan pegados al fondo (z = 0..1) y la escena los gira para la pared izquierda.
// API: furnitureModel(id) -> THREE.Group (cacheado por id) · el mismo `voxelModel` de models.js.
import { voxelModel } from '../city/models.js';
import { P, C, bush, sparkle, pattern, STAR5 } from '../city/models-kit.js';
import { FURNITURE_BY_ID } from './furniture.js';

const W8 = (id) => (FURNITURE_BY_ID[id]?.size || [1, 1]).map(n => n * 8);
const WOOD = '#c98a52', WOOD_D = '#9a6438', WOOD_L = '#e0ac72', WHITE = '#ffffff', CREAM = '#fbefd9';

const BUILD = {
  cama(m) {
    const v = m.v;   // 8 × 16 (cabecera al fondo)
    v.box(0, 0, 0, 8, 6, 2, WOOD_D); v.box(1, 6, 0, 6, 1, 2, WOOD);                       // cabecera
    v.box(0, 0, 2, 8, 3, 14, WOOD); v.box(0, 0, 15, 8, 4, 1, WOOD_D);                      // base y pie
    v.box(1, 3, 2, 6, 1, 13, WHITE);                                                        // colchón
    v.box(1, 4, 2, 6, 1, 3, '#fff6e6'); v.box(2, 5, 2, 4, 1, 2, '#fff6e6');                // almohada
    v.box(0, 4, 6, 8, 1, 9, P.berry); v.box(0, 3, 6, 1, 1, 9, P.berry); v.box(7, 3, 6, 1, 1, 9, P.berry);   // acolchado
    for (let z = 7; z < 15; z += 3) v.set(3, 5, z, P.berryL);
  },
  mesa(m) {
    const v = m.v;   // 16 × 8
    v.box(0, 5, 0, 16, 1, 8, WOOD_L); v.box(0, 4, 0, 16, 1, 8, WOOD);
    for (const [x, z] of [[1, 1], [14, 1], [1, 6], [14, 6]]) v.box(x, 0, z, 1, 4, 1, WOOD_D);
    v.box(6, 6, 3, 2, 2, 2, WHITE); v.set(6, 8, 3, P.berry); v.set(7, 8, 4, P.gold);         // florerito
    v.box(10, 6, 2, 3, 1, 3, '#f2ece2'); v.set(11, 7, 3, P.clay);                           // plato con fruta
  },
  silla(m) {
    const v = m.v;
    v.box(1, 3, 1, 6, 1, 6, WOOD_L); v.box(1, 4, 1, 6, 1, 6, P.clay);
    v.box(1, 4, 1, 6, 6, 1, WOOD); v.box(2, 8, 1, 4, 1, 1, WOOD_L);
    for (const [x, z] of [[1, 1], [6, 1], [1, 6], [6, 6]]) v.box(x, 0, z, 1, 3, 1, WOOD_D);
  },
  ropero(m) {
    const v = m.v;   // 16 × 8
    v.box(0, 0, 1, 16, 15, 7, WOOD); v.box(0, 15, 1, 16, 1, 7, WOOD_D);
    v.box(1, 1, 7, 7, 13, 1, WOOD_L); v.box(8, 1, 7, 7, 13, 1, WOOD_L);
    v.set(7, 7, 8, P.gold); v.set(8, 7, 8, P.gold);
    v.box(2, 9, 8, 4, 4, 0 + 1, '#cfe9ff'); v.box(10, 9, 8, 4, 4, 1, '#cfe9ff');            // espejitos
    v.box(4, 16, 3, 3, 2, 3, P.sky); v.box(9, 16, 3, 4, 3, 3, P.peach);                     // cajas arriba
  },
  lampara(m) {
    const v = m.v;
    v.box(2, 0, 2, 4, 1, 4, P.ink); v.box(3, 1, 3, 2, 10, 2, P.inkL);
    v.box(1, 11, 1, 6, 4, 6, '#fff3c4'); v.box(2, 15, 2, 4, 1, 4, '#ffe9a6');
    m.light.set(3, 11, 3, '#fff6c8'); m.light.set(4, 11, 4, '#fff6c8');
  },
  planta(m) {
    const v = m.v;
    v.box(2, 0, 2, 4, 4, 4, P.clay); v.box(2, 4, 2, 4, 1, 4, P.clayD);
    bush(v, 3.5, 5, 3.5, 2.6, C.leaf, null, 4);
    v.box(3, 4, 3, 2, 4, 2, C.leafD);
  },
  alfombra(m) {
    const v = m.v;   // 16 × 16 redonda
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
      const d = Math.hypot(x - 7.5, z - 7.5);
      if (d < 7.6) v.set(x, 0, z, d < 3 ? P.gold : d < 5.2 ? P.berry : d < 6.4 ? CREAM : P.berryD);
    }
  },
  sillon(m) {
    const v = m.v;   // 16 × 8
    const c = '#7f9ee8', cd = '#5a78c4';
    v.box(0, 0, 0, 16, 2, 8, WOOD_D); v.box(0, 2, 1, 16, 2, 7, cd);
    v.box(1, 4, 2, 14, 1, 5, c); v.box(0, 2, 0, 16, 8, 2, cd);
    v.box(0, 2, 0, 2, 5, 8, cd); v.box(14, 2, 0, 2, 5, 8, cd);
    v.box(3, 5, 2, 4, 3, 1, P.gold); v.box(9, 5, 2, 4, 3, 1, P.berry);                      // almohadones
  },
  puff(m) {
    const v = m.v;
    v.cylinder(3.5, 0, 3.5, 3.3, 4, (x, y) => (y === 3 ? P.mintL : P.mint));
    v.set(3, 4, 3, P.mintD);
  },
  mesita(m) {
    const v = m.v;
    v.box(0, 3, 0, 8, 1, 8, WOOD_L); for (const [x, z] of [[1, 1], [6, 1], [1, 6], [6, 6]]) v.box(x, 0, z, 1, 3, 1, WOOD_D);
    v.box(2, 4, 3, 3, 1, 2, P.slate); v.box(5, 4, 4, 1, 2, 1, WHITE);                        // libro y taza
  },
  tele(m) {
    const v = m.v;   // 16 × 8
    v.box(1, 0, 2, 14, 4, 5, WOOD); v.box(2, 1, 6, 5, 2, 1, WOOD_D); v.box(9, 1, 6, 5, 2, 1, WOOD_D);
    v.box(3, 4, 3, 10, 1, 2, P.ink); v.box(2, 5, 3, 12, 8, 1, P.ink);
    m.light.box(3, 6, 4, 10, 6, 1, '#8fd3ff');
    pattern(m.light, 'pz', 4, 6, 7, ['.XX...', 'XXXX..', '.XX..X'], '#ffd166', 1);
  },
  biblioteca(m) {
    const v = m.v;   // 16 × 8
    v.box(0, 0, 1, 16, 16, 6, WOOD_D);
    const BOOK = [P.berry, P.slate, P.mint, P.gold, P.clay, P.sky, '#b58cff'];
    for (const y of [1, 6, 11]) { v.box(1, y, 2, 14, 4, 5, null); for (let x = 1; x < 15; x++) { const h = 2 + ((x * 7 + y) % 3); v.box(x, y, 3, 1, h, 3, BOOK[(x + y) % BOOK.length]); } }
    v.box(0, 16, 1, 16, 1, 6, WOOD);
  },
  alfombra_larga(m) {
    const v = m.v;   // 24 × 16
    for (let x = 0; x < 24; x++) for (let z = 1; z < 15; z++) v.set(x, 0, z, x < 1 || x > 22 ? WHITE : Math.floor(x / 3) % 2 ? P.sky : CREAM);
  },
  chimenea(m) {
    const v = m.v;   // 16 × 8
    v.box(0, 0, 0, 16, 14, 4, '#d98f6a'); v.box(1, 0, 4, 14, 1, 3, '#c27a56');
    for (let x = 0; x < 16; x++) for (let y = 0; y < 14; y++) if ((x + Math.floor(y / 2) * 2) % 4 === 0 && y % 2 === 0) v.set(x, y, 3, '#c27a56');
    v.box(4, 1, 3, 8, 7, 1, null); v.box(4, 1, 1, 8, 7, 2, P.ink);
    v.box(0, 14, 0, 16, 1, 5, CREAM);
    v.box(5, 1, 2, 6, 1, 1, WOOD_D);
    const fire = m.part('fire', [8, 2, 2.5], { mat: 'light', cast: false });
    fire.box(6, 2, 2, 4, 2, 1, '#ffa64d'); fire.box(7, 4, 2, 2, 2, 1, '#ffd166'); fire.set(7, 6, 2, '#fff1b8');
    m.animate((parts, ph) => { const f = parts.fire[0]; return (dt, t) => { f.scale.y = 0.85 + Math.sin((t + ph) * 9) * 0.15; }; });
    v.box(2, 15, 1, 2, 3, 2, P.gold); v.box(12, 15, 1, 2, 2, 2, P.berry);                   // adornos
  },
  cocina(m) {
    const v = m.v;   // 16 × 8
    v.box(0, 0, 1, 16, 8, 7, WHITE); v.box(0, 8, 1, 16, 1, 7, '#ddd5c8');
    v.box(1, 1, 7, 6, 5, 1, '#e8eef6'); v.set(6, 4, 8, P.ink);                              // horno
    m.light.box(2, 2, 8, 4, 2, 1, '#ffb38a');
    v.box(9, 1, 7, 6, 6, 1, P.mintL); v.set(9, 4, 8, P.ink);
    for (const x of [2, 5]) { v.box(x, 9, 3, 2, 1, 2, P.ink); }
    v.box(10, 9, 3, 4, 1, 3, '#c9d2df'); v.set(11, 10, 4, '#8fd3ff');                       // pileta
    v.box(2, 9, 3, 3, 2, 3, '#e05a4f'); v.set(3, 11, 4, P.ink);                             // olla
  },
  heladera(m) {
    const v = m.v;
    v.box(0, 0, 1, 8, 16, 7, '#e8f4ff'); v.box(0, 10, 7, 8, 1, 1, '#c9d2df');
    v.box(6, 3, 8, 1, 5, 1, '#a9b4c2'); v.box(6, 12, 8, 1, 3, 1, '#a9b4c2');
    v.set(2, 13, 8, P.berry); v.set(3, 12, 8, P.gold); v.set(2, 6, 8, P.sky);               // imanes
  },
  escritorio(m) {
    const v = m.v;   // 16 × 8
    v.box(0, 6, 0, 16, 1, 8, WOOD_L); v.box(0, 0, 0, 1, 6, 8, WOOD); v.box(15, 0, 0, 1, 6, 8, WOOD);
    v.box(10, 1, 0, 5, 5, 7, WOOD); v.set(12, 4, 7, P.gold);
    v.box(3, 7, 1, 6, 5, 1, P.ink); m.light.box(4, 8, 2, 4, 3, 1, '#c4f7e8');               // compu
    v.box(4, 7, 3, 4, 1, 2, '#ddd5c8');
    v.box(12, 7, 2, 2, 3, 2, P.berry); v.set(12, 10, 2, C.leaf);                             // maceta
  },
  consola(m) {
    const v = m.v;
    v.box(0, 0, 1, 8, 4, 6, WOOD); v.box(1, 4, 2, 6, 2, 4, '#e8e0ef');
    v.box(2, 5, 6, 4, 1, 1, '#b58cff'); v.set(2, 6, 3, P.berry); v.set(5, 6, 3, P.sky);
    v.box(1, 4, 6, 2, 1, 2, P.ink); v.box(5, 4, 6, 2, 1, 2, P.ink);                         // joysticks
  },
  acuario(m) {
    const v = m.v;   // 16 × 8
    v.box(0, 0, 1, 16, 4, 6, WOOD_D);
    m.glow.box(1, 4, 2, 14, 7, 4, '#8fe0ff');
    v.box(0, 11, 1, 16, 1, 6, P.ink);
    v.box(3, 4, 4, 2, 3, 1, C.leaf); v.box(11, 4, 3, 1, 4, 1, C.leafD);
    const fish = m.part('fish', [8, 7, 4], { cast: false });
    fish.box(5, 7, 5, 2, 1, 1, P.clay); fish.set(4, 7, 5, P.gold); fish.box(9, 8, 5, 2, 1, 1, P.gold); fish.set(11, 8, 5, P.clay);
    m.animate((parts, ph) => { const f = parts.fish[0]; return (dt, t) => { f.position.x = Math.sin((t + ph) * 0.8) * 0.25; }; });
  },
  piano(m) {
    const v = m.v;   // 16 × 8
    v.box(0, 0, 0, 16, 12, 4, P.ink); v.box(0, 5, 4, 16, 2, 3, P.ink);
    for (let x = 1; x < 15; x++) v.set(x, 6, 6, x % 3 === 0 ? P.ink : WHITE);
    for (let x = 1; x < 15; x++) v.set(x, 6, 5, WHITE);
    v.box(1, 0, 5, 1, 5, 1, P.ink); v.box(14, 0, 5, 1, 5, 1, P.ink);
    v.box(3, 12, 1, 3, 1, 2, P.gold); v.box(10, 12, 1, 2, 3, 2, P.berry);                   // velita y florero
  },
  cama_gato(m) {
    const v = m.v;
    v.cylinder(3.5, 0, 3.5, 3.6, 3, P.berry); v.cylinder(3.5, 1, 3.5, 2.4, 2, null); v.cylinder(3.5, 1, 3.5, 2.4, 1, P.berryL);
    v.box(2, 2, 2, 4, 2, 3, '#f4a261'); v.box(5, 3, 2, 2, 2, 2, '#f4a261'); v.set(6, 5, 2, '#f4a261'); v.set(5, 5, 3, '#f4a261');   // gatito
    v.set(6, 4, 3, P.ink);
  },
  // ----- pared (al fondo, z = 0..1) -----
  cuadro(m) {
    const v = m.v;
    v.box(0, 12, 0, 8, 7, 1, WOOD_D);
    v.box(1, 13, 1, 6, 5, 1, '#cfe9ff'); v.box(1, 13, 1, 6, 2, 1, '#9fdc8a'); v.box(4, 15, 1, 2, 2, 1, P.gold);   // paisaje con sol
  },
  estante(m) {
    const v = m.v;   // 16
    v.box(0, 13, 0, 16, 1, 3, WOOD); v.box(1, 11, 0, 1, 2, 2, WOOD_D); v.box(14, 11, 0, 1, 2, 2, WOOD_D);
    const BOOK = [P.berry, P.slate, P.mint, P.gold, P.clay];
    for (let x = 2; x < 9; x++) v.box(x, 14, 0, 1, 3 + (x % 2), 2, BOOK[x % BOOK.length]);
    v.box(11, 14, 0, 3, 3, 2, P.clay); v.set(12, 17, 1, C.leaf);
  },
  reloj(m) {
    const v = m.v;
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) { const d = Math.hypot(x - 3.5, y - 3.5); if (d < 3.8) v.set(x, 12 + y, 0, d > 2.8 ? P.gold : WHITE); }
    v.box(3, 16, 1, 1, 3, 1, P.ink); v.box(4, 16, 1, 2, 1, 1, P.ink);
  },
  poster(m) {
    const v = m.v;
    v.box(1, 11, 0, 6, 8, 1, P.slate);
    pattern(v, 'pz', 0, 2, 13, ['..X..', '.XXX.', 'XXXXX', '.X.X.'], P.gold, 1);
    v.box(2, 17, 1, 4, 1, 1, WHITE);
  },
  guirnalda(m) {
    const COLS = ['#ff7a8a', '#ffd166', '#7fe3a8', '#8fd3ff', '#b58cff'];
    for (let x = 0; x < 24; x++) { const y = 19 - Math.round(Math.sin((x / 23) * Math.PI) * 3); m.v.set(x, y, 0, P.ink); if (x % 3 === 1) m.light.set(x, y - 1, 1, COLS[(x / 3 | 0) % COLS.length]); }
  },
  // ----- especiales -----
  arcoiris(m) {
    const v = m.v;
    v.box(2, 0, 2, 4, 1, 4, WHITE); v.box(3, 1, 3, 2, 6, 2, '#e8e0ef');
    const RB = ['#ff7a8a', '#ffb38a', '#ffe066', '#7fe3a8', '#8fd3ff', '#b58cff'];
    RB.forEach((c, i) => m.light.box(1, 7 + i, 1, 6, 1, 6, c));
    sparkle(m, 4, 15, 4, WHITE, 2);
  },
  trono(m) {
    const v = m.v;   // 16 × 8
    const c = '#b58cff', cd = '#8e66d6';
    v.box(0, 0, 0, 16, 2, 8, P.gold); v.box(0, 2, 1, 16, 2, 7, cd); v.box(1, 4, 2, 14, 1, 5, c);
    v.box(0, 2, 0, 16, 10, 2, cd); v.box(0, 2, 0, 2, 6, 8, P.gold); v.box(14, 2, 0, 2, 6, 8, P.gold);
    for (let x = 2; x < 14; x += 3) v.set(x, 12, 0, P.gold);
    v.box(5, 5, 2, 6, 3, 1, P.berryL);
  },
  globo(m) {
    const v = m.v;
    v.box(2, 0, 2, 4, 1, 4, WOOD_D); v.box(3, 1, 3, 2, 3, 2, P.gold);
    v.sphere(3.5, 7, 3.5, 3, 3, 3, (x, y, z) => (((x * 3 + y * 5 + z) % 7 < 3) ? '#7fe3a8' : '#8fd3ff'));
  },
  telescopio(m) {
    const v = m.v;
    for (const [x, z] of [[1, 1], [6, 1], [3, 6]]) v.box(x, 0, z, 1, 6, 1, WOOD_D);
    for (let i = 0; i < 7; i++) v.box(2 + Math.floor(i * 0.4), 6 + i, 2 + Math.floor(i * 0.5), 2, 2, 2, i > 4 ? P.gold : P.slateD);
  },
  // ----- trofeos -----
  trofeo_rango(m) { trophy(m, P.gold, (v) => { pattern(v, 'pz', 4, 2, 13, ['XXXX', 'X..X', 'XXXX'], P.goldL, 1); }); },
  trofeo_obra(m) {
    const v = m.v;
    v.box(1, 0, 1, 6, 3, 6, WOOD_D); v.box(1, 3, 1, 6, 1, 6, P.gold);
    for (let y = 4; y < 13; y++) v.box(3, y, 3, 2, 1, 2, Math.floor((y - 4) / 2) % 2 ? WHITE : '#e8564f');
    m.light.box(3, 13, 3, 2, 1, 2, '#fff3b0'); v.box(3, 14, 3, 2, 1, 2, '#e8564f');
  },
  trofeo_joyas(m) { trophy(m, '#c08cff', (v) => { v.box(3, 13, 3, 2, 2, 2, '#e0c4ff'); }); },
  trofeo_album(m) {
    const v = m.v;
    v.box(1, 0, 1, 6, 3, 6, WOOD_D); v.box(3, 3, 3, 2, 5, 2, P.slate);
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) { const d = Math.hypot(x - 3.5, y - 3.5); if (d < 3.6) v.set(x, 8 + y, 3, d > 2.6 ? P.goldD : P.gold); }
    pattern(v, 'pz', 3, 2, 10, STAR5, WHITE, 1);
  },
};
function trophy(m, cup, extra) {
  const v = m.v;
  v.box(1, 0, 1, 6, 3, 6, WOOD_D); v.box(3, 3, 3, 2, 3, 2, P.goldD);
  v.box(2, 6, 2, 4, 1, 4, cup); v.box(1, 7, 1, 6, 5, 6, cup); v.box(2, 7, 2, 4, 5, 4, null);
  v.box(0, 9, 3, 1, 2, 2, cup); v.box(7, 9, 3, 1, 2, 2, cup);
  extra?.(v);
}

/** Modelo de un mueble (o una cajita si el id no existe). */
export function furnitureModel(id) {
  const [W, D] = W8(id);
  const fn = BUILD[id];
  return voxelModel('furn:' + id, W, D, (m) => {
    if (fn) fn(m);
    else { m.v.box(1, 0, 1, W - 2, 6, D - 2, P.clayL); }
  });
}
export const FURNITURE_MODEL_IDS = Object.keys(BUILD);
