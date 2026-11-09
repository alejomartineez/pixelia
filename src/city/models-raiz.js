// Invernadero de Raíz (PLAN-QUIEBRE L1, DESIGN-STORY §5): el edificio que da el Núcleo de Raíz a la isla.
// Oscuro y serio (J7): zócalo de basalto, armazón de hierro negro, vidrio ahumado verde y raíces gruesas que salen del
// piso y abrazan una esquina, con vetas que brillan (capa `light`, sin sombra). Es igual en todas las épocas: viene de
// abajo, no de la ciudad. Lote de 2×2 (12×12 vóxeles).
// Regla de niveles (§4.2): 1 nave de vidrio · 2 cisterna al costado · 3 una bóveda más alta · 4 la aguja de raíz ·
// 5 cerco de piedra con faroles de veta.
import { shade } from './models-kit.js';

const BASALT = '#2c2b2e', BASALT_L = '#3a383c', BASALT_D = '#1f1e21';
const IRON = '#1b1d1f', IRON_L = '#34373a';
const GLASS = '#2e4a3f', GLASS_L = '#3c5e50', GLASS_D = '#22382f';
const ROOT = '#4a3a2c', ROOT_D = '#33281f', ROOT_L = '#5d4a37';
const LEAF = '#2f4a2a', LEAF_D = '#233a21';
const VEIN = '#ffb347', VEIN_D = '#e08a2c', SOIL = '#2a241f';

function invernadero(m, L) {
  const v = m.v, lit = m.light;
  // suelo: tierra oscura con losas de basalto en el camino
  v.box(0, 0, 0, 12, 1, 12, (x, y, z) => ((x * 7 + z * 3) % 5 === 0 ? shade(SOIL, -0.08) : SOIL));
  for (let z = 9; z < 12; z++) for (let x = 5; x < 7; x++) v.set(x, 0, z, (x + z) % 2 ? BASALT_L : BASALT);
  // zócalo de basalto
  const x0 = 1, x1 = 9, z0 = 1, z1 = 8;
  v.box(x0, 1, z0, x1 - x0 + 1, 2, z1 - z0 + 1, (x, y, z) => ((x + y * 2 + z) % 4 === 0 ? BASALT_D : y === 2 ? BASALT_L : BASALT));
  // nave: armazón de hierro y paños de vidrio ahumado, más alta desde el nivel 3
  const H = L >= 3 ? 8 : 6;
  for (let y = 3; y < 3 + H; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    const edge = x === x0 || x === x1 || z === z0 || z === z1;
    if (!edge) continue;
    const post = (x - x0) % 3 === 0 || x === x1 ? (z === z0 || z === z1) : false;
    const postZ = (z - z0) % 3 === 0 || z === z1 ? (x === x0 || x === x1) : false;
    const beam = y === 3 || y === 3 + H - 1 || (y - 3) % 3 === 2;
    if (post || postZ || beam) v.set(x, y, z, IRON);
    else v.set(x, y, z, (x + y + z) % 5 === 0 ? GLASS_L : (y > 3 + H - 3 ? GLASS_D : GLASS));
  }
  // techo a dos aguas de vidrio con cumbrera de hierro (a lo largo de x)
  const ry = 3 + H;
  const half = Math.ceil((z1 - z0 + 1) / 2);
  for (let k = 0; k < half; k++) for (let x = x0; x <= x1; x++) {
    const c = x === x0 || x === x1 || (x - x0) % 3 === 0 ? IRON : (k % 2 ? GLASS_D : GLASS);
    v.set(x, ry + k, z0 + k, c);
    v.set(x, ry + k, z1 - k, c);
  }
  const ridge = ry + half - 1;
  for (let x = x0 - 1; x <= x1 + 1; x++) v.set(x, ridge + 1, Math.floor((z0 + z1) / 2), IRON_L);
  // puerta de hierro al frente (z1), con la veta en el dintel
  for (let y = 3; y < 7; y++) for (let x = 4; x < 7; x++) v.set(x, y, z1, y === 6 ? IRON_L : IRON);
  lit.set(5, 7, z1 + 1, VEIN);
  // adentro: canteros con plantas oscuras que se ven a través del vidrio
  for (const [px, pz] of [[3, 3], [6, 3], [3, 6], [7, 6]]) {
    v.box(px, 3, pz, 2, 1, 1, ROOT_D);
    v.box(px, 4, pz, 2, 2 + ((px + pz) % 2), 1, (x, y) => (y % 2 ? LEAF : LEAF_D));
  }
  // la raíz: un tronco grueso que sale del piso en la esquina de atrás y abraza la nave
  const rootPath = [[10, 1, 0], [10, 2, 0], [10, 3, 1], [10, 4, 1], [10, 5, 2], [10, 6, 3], [9, 7, 3], [9, 8, 4], [8, 9, 4]];
  const rootTop = L >= 3 ? rootPath.length : 6;
  for (let i = 0; i < rootTop; i++) {
    const [x, y, z] = rootPath[i];
    v.box(x, y, z, 2, 1, 2, (xx, yy, zz) => ((xx + zz + i) % 3 === 0 ? ROOT_D : i % 2 ? ROOT : ROOT_L));
  }
  // raíces finas que se meten en la tierra, con vetas que brillan
  const runners = [[11, 0, 2, -1, 0, 1], [11, 0, 6, -1, 0, 1], [0, 0, 10, 1, 0, -1]];
  runners.forEach(([x, , z, dx, , dz], i) => {
    for (let k = 0; k < 4 + (L >= 2 ? 2 : 0); k++) {
      const xx = x + dx * Math.floor(k / 2), zz = z + dz * k;
      if (xx < 0 || zz < 0 || xx > 11 || zz > 11) break;
      if (k % 3 === 2) lit.set(xx, 1, zz, i % 2 ? VEIN_D : VEIN);
      else v.set(xx, 1, zz, k % 3 === 1 ? ROOT_D : ROOT);
    }
  });
  lit.set(10, 4, 2, VEIN); lit.set(11, 2, 1, VEIN_D);
  let peak = ridge + 2;
  // nivel 2: cisterna de piedra al costado, con su caño de hierro
  if (L >= 2) {
    v.cylinder(1.5, 1, 10.2, 1.2, 4, (x, y) => (y % 2 ? BASALT : BASALT_D));
    v.box(1, 5, 10, 2, 1, 2, IRON);
    v.box(2, 4, 8, 1, 1, 2, IRON_L);
  }
  // nivel 4: la aguja de raíz que sube por encima del techo, con la veta viva arriba
  if (L >= 4) {
    const y0 = rootTop + 1;
    for (let j = 0; j < 7; j++) v.set(9 - (j > 3 ? 1 : 0), y0 + j, 4 + (j > 5 ? 1 : 0), j % 2 ? ROOT : ROOT_D);
    lit.set(8, y0 + 7, 5, VEIN);
    lit.set(9, y0 + 3, 5, VEIN_D);
    peak = Math.max(peak, y0 + 8);
  }
  // nivel 5: cerco de piedra con dos faroles de veta a la entrada
  if (L >= 5) {
    for (let i = 0; i < 12; i++) {
      if (i < 4 || i > 7) v.set(i, 1, 11, (i % 2) ? BASALT : BASALT_L);
      v.set(0, 1, i, (i % 2) ? BASALT : BASALT_L);
      v.set(11, 1, i, (i % 2) ? BASALT_L : BASALT);
    }
    for (const x of [4, 7]) { v.box(x, 1, 11, 1, 3, 1, IRON); lit.set(x, 4, 11, VEIN); }
  }
  // las vetas van embutidas en la raíz y la piedra: donde brilla, no hay vóxel opaco
  for (const k of lit.map.keys()) v.map.delete(k);
  m.height = peak + 1;
}

export const RAIZ_BUILDERS = { invernadero };
