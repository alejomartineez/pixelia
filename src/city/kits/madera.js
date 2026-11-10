// Kit de la época Madera (PLAN-FOTO, paso M2; piloto): cómo encastran los módulos de assets/models/madera/ y la
// receta de la casa de prueba. Los `.vox` los escribe tools/kits/madera.mjs. Se arma con src/core/vox-kit.js.
//
// Medidas en vóxeles de 16 por tile, en coordenadas del juego: x a la derecha, y arriba y el frente hacia +z.
// `size` es la huella nominal de la pieza [ancho, fondo]: lo que cuenta para encastrar. `pad` es lo que el dibujo
// sobresale de esa huella: l (izquierda, -x), r (derecha), b (atrás, -z), f (frente, +z) y d (abajo de la base).

export const MADERA_BASE = 'assets/models/madera/';

export const MADERA_PARTS = {
  'pared-a':          { size: [16, 8], pad: { f: 1 } },
  'pared-ventana-a':  { size: [16, 8], pad: { f: 2 } },
  'pared-puerta-a':   { size: [16, 8], pad: { f: 3 } },
  'esquina-a':        { size: [4, 4], pad: { l: 1, f: 1 } },       // poste: pisa el encuentro de dos paredes
  'techo-tramo-a':    { size: [16, 16], pad: { f: 3, d: 3 } },     // el alero vuela 3 y cuelga 3 bajo el alto de la pared
  'techo-remate-a':   { size: [8, 16], pad: { l: 2, f: 3, d: 3 } }, // remate izquierdo; el derecho es este espejado
  'techo-cumbrera-a': { size: [16, 4], pad: { l: 2 } },
  'chimenea-a':       { size: [8, 8] },
};

const WALL = 24; // alto de la pared: ahí arranca el techo
/**
 * Casa de Madera de 2 × 2 tiles (32 × 32, 42 a la cumbrera). El frente es z = 31.
 * Cada paso: { part, at: [x, y, z] de la esquina mínima de la huella ya girada, rot: cuartos de vuelta (1 lleva el
 * frente a +x, 2 atrás, 3 a -x), mirror: espeja en x antes de girar } o { fill: [x, y, z, ancho, alto, fondo], index }.
 * Los pasos se aplican en orden y el último pisa.
 */
export const CASA_MADERA_A = [
  // paredes: dos módulos al frente, dos atrás y uno por costado; macizo al medio
  { part: 'pared-puerta-a', at: [0, 0, 24] },
  { part: 'pared-ventana-a', at: [16, 0, 24] },
  { part: 'pared-a', at: [0, 0, 0], rot: 2 },
  { part: 'pared-a', at: [16, 0, 0], rot: 2 },
  { part: 'pared-ventana-a', at: [0, 0, 8], rot: 3 },
  { part: 'pared-ventana-a', at: [24, 0, 8], rot: 1 },
  { fill: [8, 0, 8, 16, WALL, 16], index: 11 },
  { part: 'esquina-a', at: [0, 0, 28] },
  { part: 'esquina-a', at: [28, 0, 28], rot: 1 },
  { part: 'esquina-a', at: [28, 0, 0], rot: 2 },
  { part: 'esquina-a', at: [0, 0, 0], rot: 3 },
  // techo a dos aguas con la cumbrera a lo ancho
  { part: 'techo-remate-a', at: [0, WALL, 16] },
  { part: 'techo-tramo-a', at: [8, WALL, 16] },
  { part: 'techo-remate-a', at: [24, WALL, 16], mirror: true },
  { part: 'techo-remate-a', at: [24, WALL, 0], rot: 2 },
  { part: 'techo-tramo-a', at: [8, WALL, 0], rot: 2 },
  { part: 'techo-remate-a', at: [0, WALL, 0], rot: 2, mirror: true },
  { part: 'techo-cumbrera-a', at: [0, WALL + 16, 14] },
  { part: 'techo-cumbrera-a', at: [16, WALL + 16, 14], mirror: true },
  { part: 'chimenea-a', at: [20, WALL + 7, 6] },
];
