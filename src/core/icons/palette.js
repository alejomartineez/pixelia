// Paleta y reglas de los íconos dibujados a mano (DESIGN.md, "Íconos").
//
// Cada ícono es una grilla de texto de 16×16 (HUD, botones, listas) y otra de 24×24 (paneles, premios). Un carácter
// es un pixel; '.' es transparente. El contorno exterior de tinta se agrega solo: la fila y la columna del borde de
// la grilla quedan vacías ('.') y el dibujo vive en el área de adentro (14×14 o 22×22). Adentro se puede usar 'k'
// para líneas de tinta (separar piezas, ojos, cortes).
//
// Reglas (iguales para toda la familia):
// - Luz arriba a la izquierda: el tono claro va en los bordes de arriba y de la izquierda de cada pieza, el oscuro
//   en los de abajo y de la derecha; el base llena. Un brillo 'w' de 1 a 3 pixeles, siempre arriba a la izquierda.
// - Cada pieza grande se llena con un tono base o claro: sobre el fondo oscuro de la interfaz, una mancha grande
//   de tono oscuro se pierde. Los oscuros son para sombra y detalle.
// - Una idea por ícono, con una silueta que se reconozca en negro a 16 px. Nada de copiar el emoji equivalente.
// - Sin pixeles sueltos de ruido ni degradés: tres tonos por material alcanzan.
// - La versión de 24 no es la de 16 agrandada: es el mismo dibujo con un poco más de detalle.

/** Carácter → color. Las rampas van claro · base · oscuro. */
export const PAL = {
  k: '#120f0d', // tinta (contorno y líneas)
  K: '#2b2421', // sombra profunda interior (huecos, bocas): usar poco
  w: '#fff6e4', // brillo puntual
  // oro
  Y: '#f7d98b', y: '#d9a94e', o: '#9c7432',
  // brasa (terracota, naranja)
  E: '#f3a877', e: '#c96a3e', f: '#86452a',
  // coral (rojo)
  R: '#f2a49a', r: '#dc6b61', x: '#963f39',
  // menta
  M: '#9fdcc4', m: '#5fae92', n: '#3c7a65',
  // hoja (verde)
  L: '#bcd87e', l: '#7fa64c', v: '#4d6f31',
  // cielo
  S: '#acd6f0', s: '#6fa7cc', d: '#45779b',
  // índigo
  B: '#a9b8f3', b: '#6a7fd6', a: '#40509f',
  // violeta
  V: '#cfaee8', i: '#9a70c4', j: '#614287',
  // hueso (papel, tela clara)
  P: '#f0e7d8', p: '#c9bca7', q: '#928671',
  // piedra (gris cálido, hierro)
  G: '#b7afa3', g: '#867d72', h: '#595149',
  // madera
  O: '#c48d5c', u: '#8c5c38', z: '#5c3c25',
};

/** Rampas por nombre (para teñir un ícono con registerTint). */
export const RAMPS = {
  oro: 'Yyo', brasa: 'Eef', coral: 'Rrx', menta: 'Mmn', hoja: 'Llv', cielo: 'Ssd',
  indigo: 'Bba', violeta: 'Vij', hueso: 'Ppq', piedra: 'Ggh', madera: 'Ouz',
};

export const INK = PAL.k;
