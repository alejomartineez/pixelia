// Kit de la época Madera (PLAN-FOTO, paso M2; piloto): módulos de casa a 16 vóxeles por tile.
//   node tools/make-vox.mjs → assets/models/madera/<pieza>.vox
// Coordenadas de MagicaVoxel: x a la derecha, z arriba y el frente en y = 0 (mira a -y). Cómo encastran y cuánto
// sobresale cada pieza de su huella: src/city/kits/madera.js (tabla MADERA_PARTS y la receta CASA_MADERA_A).
//
// Paleta (Regla de modelos de DESIGN.md): un material por bloque de 8 índices, con claro, base y oscuro.
//   1-3 tablas · 9-11 estructura (vigas, postes, marcos, puerta) · 17-19 piedra · 25-27 tejuelas · 33-34 musgo
//   245 ventana (la prende el código de noche) · 248 hierro
// La variación de tono va por tabla, piedra o tejuela entera, con tablas fijas: nada al azar.
import { Lienzo, mirrorVoxels } from '../make-vox.mjs';

const T = { hi: 1, mid: 2, lo: 3 }, E = { hi: 9, mid: 10, lo: 11 }, P = { hi: 17, mid: 18, lo: 19 }, R = { hi: 25, mid: 26, lo: 27 }, M = { mid: 33, lo: 34 };
const WIN = 245, IRON = 248;
export const PALETTE = {
  1: 0xb39368, 2: 0x9d7f5c, 3: 0x806853,
  9: 0x86654a, 10: 0x70523d, 11: 0x523f38,
  17: 0x8f949b, 18: 0x787d87, 19: 0x5d6170,
  25: 0x85786a, 26: 0x74685d, 27: 0x5a5153,
  33: 0x66735e, 34: 0x4f5c52,
  245: 0x55616c, 248: 0x4a4d55,
};
export const MATERIALS = { 248: { _type: '_metal', _metal: '0.9', _rough: '0.4' } };

const H = 24, DEP = 8; // pared: 24 de alto; cada módulo es macizo, de 8 de fondo
// tablas horizontales: hiladas de 3 de alto, tablas de 8 de largo trabadas media tabla
const PLANKS = [[2, 1, 2], [2, 2, 3], [1, 2, 2], [2, 3, 2], [2, 2, 1], [3, 2, 2]];
const plank = (x, z) => { const k = Math.floor((z - 3) / 3); return PLANKS[k % 6][Math.floor((x + (k % 2) * 4) / 8) % 3]; };
// zócalo: una hilada de 2 de alto y otra de 1, piedras de 4 de largo
const STONES = [[18, 17, 18, 19, 18], [17, 18, 18, 17, 19]];
const stone = (x, z) => { const c = z < 2 ? 0 : 1; return STONES[c][Math.floor((x + c * 2) / 4) % 5]; };

/** Pared base: zócalo de piedra, tablas y solera arriba. `out` = cuánto sobresale el detalle delante del plano de la pared. */
function wall(out, w = 16) {
  const L = new Lienzo();
  L.box(0, out, 0, w, DEP, H, (x, y, z) => y >= out + 2 ? E.lo : z < 3 ? stone(x, z) : z >= 21 ? E.mid : plank(x, z));
  L.box(0, out - 1, 0, w, 1, 2, (x, y, z) => stone(x, z)); // el zócalo sobresale 1 en la hilada de abajo
  L.box(0, out - 1, 21, w, 1, 3, E.mid);                    // la solera sobresale 1
  return L;
}

function pared() {
  const L = wall(1);
  L.box(7, 0, 3, 2, 1, 18, E.mid);                          // un parante al medio
  L.box(2, 0, 0, 3, 1, 2, (x, y, z) => x === 4 && z === 1 ? null : M.mid); // mancha de musgo en el zócalo
  L.set(3, 1, 2, M.lo);
  return L.model();
}

function ventana() {
  const out = 2, L = wall(out);
  // vano de 6 × 8 con el antepecho a 8 (queda bajo el alero, a la vista de la cámara): el vidrio va hundido 1
  L.box(5, out, 9, 6, 1, 8, 0);
  L.box(5, out + 1, 9, 6, 1, 8, WIN);
  // marco de 1 que sobresale 1, con un travesaño
  L.box(4, out - 1, 8, 8, 2, 10, (x, y, z) => x === 4 || x === 11 || z === 8 || z === 17 ? E.hi : null);
  L.box(5, out, 13, 6, 1, 1, E.hi);
  L.box(3, 0, 8, 10, 2, 1, E.mid);                          // alféizar: sobresale 2 (da sombra)
  // postigos: se dibuja el izquierdo y se espeja
  const sh = new Lienzo().box(1, out - 1, 9, 3, 1, 8, (x, y, z) => z === 10 || z === 15 ? E.mid : T.lo).voxels();
  L.add(mirrorVoxels(sh, 'x', { region: { min: [0, 0, 0], max: [15, DEP + out, H] }, keep: true }));
  return L.model();
}

function puerta() {
  const out = 3, L = wall(out);
  // vano de 10 × 20: se saca el frente de la pared y el zócalo que sobresale
  L.box(3, out - 1, 0, 10, 2, 20, 0);
  L.box(3, out, 0, 10, 2, 2, P.mid);                        // umbral
  const BOARDS = [E.hi, E.hi, E.mid, E.hi, E.hi];
  L.box(3, out + 1, 2, 10, 1, 18, (x, y, z) => z === 5 || z === 16 ? IRON : BOARDS[(x - 3) >> 1]); // hoja hundida 1, con dos flejes
  L.set(11, out, 10, IRON);                                 // picaporte
  // marco: jambas de 2 y dintel, sobresalen 1
  for (const x of [1, 13]) L.box(x, out - 1, 3, 2, 2, 18, E.mid);
  L.box(1, out - 1, 20, 14, 2, 1, E.mid);
  // escalón de piedra de dos alturas
  L.box(2, 0, 0, 12, 1, 1, (x, y, z) => stone(x + 2, 0));
  L.box(2, 1, 0, 12, 2, 2, (x, y, z) => stone(x, z + 2));
  return L.model();
}

/** Poste de esquina (delantera izquierda): pisa el encuentro de dos paredes y sobresale 1 hacia afuera. */
function esquina() {
  const L = new Lienzo();
  L.box(0, 0, 0, 5, 5, 3, (x, y, z) => stone(x + y, z));
  L.box(0, 0, 3, 5, 5, 21, (x, y, z) => x === 0 && y === 0 ? 0 : E.mid); // bisel de 1 en la arista de afuera
  return L.model();
}

// tejuelas: hiladas de 3 a lo largo de la pendiente, piezas de 4 trabadas
const SHAKES = [[26, 26, 26, 25, 26], [25, 26, 26, 26, 26], [26, 26, 25, 26, 26], [26, 25, 26, 26, 26]];
const shake = (x, j) => { const c = Math.floor(j / 3); return SHAKES[c % 4][Math.floor((x + (c % 2) * 2) / 4) % 5]; };
const EAVE = 2, RUN = EAVE + 16; // alero + 16 hasta la cumbrera; pendiente de 45°
/** Un faldón (medio techo a dos aguas): techo de 2 de espesor; macizo por debajo desde el alto de la pared si fill. */
function slope(L, x0, w, fill = true) {
  for (let j = 0; j < RUN; j++) for (let x = x0; x < x0 + w; x++) {
    L.set(x, j, j, shake(x, j)); L.set(x, j, j + 1, shake(x, j));
    if (fill) for (let z = EAVE; z < j; z++) L.set(x, j, z, E.lo);
  }
  return L;
}
function techoTramo() { return slope(new Lienzo(), 0, 16).model(); }

/** Remate izquierdo del techo: 8 sobre la casa, 2 de vuelo con la tabla de borde y el hastial de tablas con media ventana. */
function techoRemate() {
  const L = slope(new Lienzo(), 2, 8);
  slope(L, 1, 1, false);                                    // el vuelo es solo techo
  for (let j = 0; j < RUN; j++) for (let z = Math.max(0, j - 1); z <= j + 1; z++) L.set(0, j, z, E.mid); // tabla de borde
  const BOARDS = [2, 2, 1, 2, 3, 2, 2, 1, 2];
  for (let j = EAVE; j < RUN; j++) for (let z = EAVE; z < j; z++) for (const x of [2, 3]) L.set(x, j, z, BOARDS[j >> 1]);
  // media ventana del altillo (la otra mitad la pone el faldón de atrás)
  L.box(2, RUN - 3, 4, 1, 3, 6, (x, y, z) => y === RUN - 3 || z === 4 || z === 9 ? E.hi : 0);
  L.box(3, RUN - 2, 5, 1, 2, 4, WIN);
  L.box(1, RUN - 4, 4, 1, 4, 1, E.mid); // alféizar
  return L.model();
}

/** Cumbrera: tapa de 4 de ancho sobre el encuentro de los dos faldones; 16 de largo más 2 de vuelo a la izquierda. */
function cumbrera() {
  const L = new Lienzo();
  L.box(0, 0, 0, 18, 4, 1, R.lo);
  L.box(0, 1, 1, 18, 2, 1, R.lo);
  return L.model();
}

function chimenea() {
  const L = new Lienzo();
  const TONES = [18, 17, 18, 18, 17, 18, 19];
  L.box(1, 1, 0, 6, 6, 16, (x, y, z) => { const c = z >> 1; return TONES[(Math.floor((x + y + (c % 2) * 2) / 3) + c) % 7]; });
  L.box(0, 0, 16, 8, 8, 2, P.hi);                            // sombrerete de losa
  L.box(2, 2, 17, 4, 4, 1, 0);                               // la boca
  L.box(2, 2, 16, 4, 4, 1, P.lo);
  return L.model();
}

export default {
  folder: 'madera',
  palette: PALETTE,
  materials: MATERIALS,
  pieces: {
    'pared-a': pared(),
    'pared-ventana-a': ventana(),
    'pared-puerta-a': puerta(),
    'esquina-a': esquina(),
    'techo-tramo-a': techoTramo(),
    'techo-remate-a': techoRemate(),
    'techo-cumbrera-a': cumbrera(),
    'chimenea-a': chimenea(),
  },
};
