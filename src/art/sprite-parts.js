// Piezas de los sprites 2D de personajes (paso 1d de La Travesía, docs/PLAN-TRAVESIA.md "Sprites 2D de personajes").
// Todo dibujado a mano en grillas de caracteres; sprite2d.js las arma por capas sobre un cuadro de 32 × 32.
// Cada carácter es un material y un tono (tabla CH): minúscula = tono base (se sombrea solo: luz a la izquierda,
// sombra a la derecha y abajo), mayúscula = luz fija, y un signo = sombra fija. '.' es vacío.
//   s S 1 0  piel (base, luz, sombra, sombra honda)      h H 2 @  pelo        c C 3 #  tela       u U $  tela 2 (más clara)
//   l L 4    cuero      m M 5 %  metal     w W 6  madera     t T 7  pantalón    b B 8  bronce    n N 9  lino
//   f F ~    piel de abrigo   x X &  paja   q Q ?  crema (hocico, panza)   r R ^  hueso   v V *  veta (brilla)
//   o O      bota       k  tinta   e E  ojo (arriba y abajo)   =  ceja   p  labio   z  cicatriz   !  pintura
//   ;        pelo rapado (pelo mezclado con piel)   a  manga   g  mano   i  puño de la manga   y  fuego (fx)
//   +        empuñadura (cuero) y punto de agarre de las armas
// Coordenadas: las cabezas, pelos, barbas y sombreros van en coordenadas del cráneo (x = 0 es su columna izquierda,
// y = 0 su fila de arriba); ox/oy dicen dónde cae la esquina de la grilla.

export const CH = {
  s: ['skin', 1], S: ['skin', 0], 1: ['skin', 2], 0: ['skin', 3],
  h: ['hair', 1], H: ['hair', 0], 2: ['hair', 2], '@': ['hair', 3],
  c: ['cloth', 1], C: ['cloth', 0], 3: ['cloth', 2], '#': ['cloth', 3],
  u: ['cloth2', 1], U: ['cloth2', 0], $: ['cloth2', 2],
  l: ['leather', 1], L: ['leather', 0], 4: ['leather', 2], '+': ['leather', 2],
  m: ['metal', 1], M: ['metal', 0], 5: ['metal', 2], '%': ['metal', 3],
  w: ['wood', 1], W: ['wood', 0], 6: ['wood', 2],
  t: ['trouser', 1], T: ['trouser', 0], 7: ['trouser', 2],
  b: ['brass', 1], B: ['brass', 0], 8: ['brass', 2],
  n: ['linen', 1], N: ['linen', 0], 9: ['linen', 2],
  f: ['fur', 1], F: ['fur', 0], '~': ['fur', 2],
  x: ['straw', 1], X: ['straw', 0], '&': ['straw', 2],
  q: ['cream', 1], Q: ['cream', 0], '?': ['cream', 2],
  r: ['bone', 1], R: ['bone', 0], '^': ['bone', 2],
  v: ['vein', 1], V: ['vein', 0], '*': ['vein', 2],
  o: ['boot', 1], O: ['boot', 0],
  k: ['ink', 1], e: ['eyeT', 1], E: ['eyeB', 1], '=': ['hair', 3], p: ['lip', 1], z: ['scar', 1], '!': ['paint', 1],
  ';': ['stub', 1], y: ['fire', 1], Y: ['fire', 0], j: ['fire', 2],
};

// ---------------- Cuerpos por pueblo ----------------
// tw/th: torso; lw: ancho de cada pierna, gap: separación; lh: alto de las piernas; arm: largo del brazo (con la mano);
// head: cabeza; hdy: cuánto se mete la cabeza en el torso; hdx: cabeza adelantada (a la derecha); feet: forma del pie
export const BODIES = {
  humano: {
    recio: { tw: 12, th: 8, lw: 4, gap: 2, lh: 5, arm: 7, head: 'humano', hdy: 1 },
    esbelto: { tw: 10, th: 8, lw: 3, gap: 2, lh: 5, arm: 7, head: 'humano', hdy: 1, slim: true },
  },
  enano: {
    recio: { tw: 14, th: 7, lw: 5, gap: 2, lh: 3, arm: 6, head: 'enano', hdy: 2, toe: 2 },
    esbelto: { tw: 12, th: 7, lw: 4, gap: 2, lh: 3, arm: 6, head: 'enano', hdy: 2, toe: 2, slim: true },
  },
  orco: {
    recio: { tw: 16, th: 9, lw: 5, gap: 2, lh: 4, arm: 9, head: 'orco', hdy: 3, hdx: 1, thick: true },
    esbelto: { tw: 14, th: 9, lw: 4, gap: 2, lh: 4, arm: 8, head: 'orco', hdy: 3, hdx: 1 },
  },
  anuro: {
    recio: { tw: 14, th: 6, lw: 4, gap: 3, lh: 3, arm: 6, head: 'anuro', hdy: 1, feet: 'flipper' },
    esbelto: { tw: 12, th: 6, lw: 4, gap: 2, lh: 3, arm: 6, head: 'anuro', hdy: 1, feet: 'flipper', slim: true },
  },
  zorro: {
    recio: { tw: 10, th: 7, lw: 3, gap: 2, lh: 6, arm: 6, head: 'zorro', hdy: 1, tail: true },
    esbelto: { tw: 9, th: 7, lw: 3, gap: 1, lh: 6, arm: 6, head: 'zorro', hdy: 1, tail: true, slim: true },
  },
  vaciado: {
    recio: { tw: 10, th: 8, lw: 3, gap: 2, lh: 5, arm: 8, head: 'vaciado', hdy: 2, hdx: 1, slim: true },
    esbelto: { tw: 10, th: 8, lw: 3, gap: 2, lh: 5, arm: 8, head: 'vaciado', hdy: 2, hdx: 1, slim: true },
  },
};

// ---------------- Cabezas ----------------
// rows: ancho de cada fila del cráneo (centrado); px: piezas sueltas [x, y, ch]; eyes: [[x, y], [x, y]] (ojo de 1 × 2,
// arriba 'e' y abajo 'E'); el resto son rasgos. Los ojos van medio paso a la derecha: mira apenas hacia adelante.
const span = (y, x0, x1, ch) => { const o = []; for (let x = x0; x <= x1; x++) o.push([x, y, ch]); return o; };
export const HEADS = {
  humano: {
    w: 12, rows: [6, 10, 12, 12, 12, 12, 12, 12, 10, 8, 6],
    px: [[-1, 6, 's'], [-1, 7, 's'], [12, 6, '1'], [12, 7, '1'], [3, 4, '='], [4, 4, '='], [8, 4, '='], [9, 4, '='],
      [7, 7, '1'], [6, 8, 'p'], [7, 8, 'p'], [11, 5, '1'], [11, 6, '1'], [11, 7, '1'], [10, 8, '1']],
    eyes: [[4, 5], [8, 5]], mouth: [6, 8],
  },
  enano: {
    w: 12, rows: [6, 10, 12, 12, 12, 12, 12, 12, 12, 10, 8],
    px: [[-1, 6, 's'], [-1, 7, 's'], [12, 6, '1'], [12, 7, '1'], ...span(4, 2, 4, '='), ...span(4, 8, 10, '='),
      [6, 7, 'S'], [7, 7, '1'], [6, 8, '1'], [7, 8, '0'], [5, 9, 'p'], [6, 9, 'p'], [11, 5, '1'], [11, 6, '1'], [11, 7, '1'], [11, 8, '1']],
    eyes: [[4, 5], [8, 5]], mouth: [5, 9],
  },
  orco: {
    w: 12, rows: [6, 10, 12, 12, 12, 12, 14, 14, 14, 12, 10],
    earPx: [[-1, 3, 's'], [-2, 2, 'S'], [-3, 1, 's'], [-1, 4, 's'], [-2, 3, '1'], [-4, 0, 's'], [12, 3, '1'], [13, 2, '1'], [14, 1, '1'], [12, 4, '1'], [13, 3, '0'], [15, 0, '1']],
    px: [...span(3, 2, 4, '0'), ...span(3, 7, 9, '0'), [6, 6, '1'], [7, 6, '1'], [6, 5, 'S'], ...span(8, 3, 8, '0'), [3, 7, 'r'], [8, 7, 'r'], [3, 6, 'R'], [8, 6, 'R'],
      [11, 4, '1'], [11, 5, '1'], [12, 6, '1'], [12, 7, '1'], [12, 8, '1'], [10, 9, '1']],
    eyes: [[3, 4], [8, 4]], eye1: true, mouth: [5, 8],
  },
  anuro: {
    w: 16, rows: [12, 16, 16, 16, 16, 16, 14, 12],
    px: [...span(-2, 2, 4, 's'), ...span(-1, 1, 5, 's'), ...span(-2, 11, 13, 's'), ...span(-1, 10, 14, '1'), [13, -2, '1'], [14, 0, '1'],
      [7, 3, '1'], [9, 3, '1'], ...span(5, 2, 13, '0'), [1, 4, '0'], [14, 4, '0'], ...span(6, 3, 12, 'q'), ...span(7, 4, 11, 'q'),
      [15, 1, '1'], [15, 2, '1'], [15, 3, '1'], [15, 4, '1'], [14, 1, '1']],
    eyes: [[3, -1], [12, -1]], mouth: [7, 5], noBrow: true,
  },
  zorro: {
    w: 12, rows: [8, 10, 12, 12, 12, 12, 12, 10, 8, 6],
    px: [...span(6, 3, 8, 'q'), ...span(7, 2, 9, 'q'), ...span(8, 2, 9, 'q'), ...span(9, 3, 8, 'q'), [1, 5, 'q'], [10, 5, 'q'], [2, 6, 'q'], [9, 6, 'q'],
      [5, 6, 'k'], [6, 6, 'k'], [5, 8, '?'], [6, 8, '?'], [11, 3, '1'], [11, 4, '1'], [11, 5, '1'], [9, 8, '?'], [8, 9, '?']],
    ears: { l: ['.s..', 'ss..', 's0s.', 's00s'], x: 0, y: -4, dark: '0' },
    eyes: [[3, 4], [8, 4]], eye1: false, mouth: [5, 8], amber: true,
  },
  vaciado: {
    w: 12, rows: [6, 10, 12, 12, 12, 12, 12, 12, 10, 8, 6],
    px: [[-1, 6, 's'], [12, 6, '1'], ...span(4, 3, 4, '0'), ...span(4, 8, 9, '0'), [3, 6, '0'], [9, 6, '0'], [7, 7, '1'], ...span(8, 5, 8, '0'),
      [3, 1, '0'], [4, 2, '0'], [4, 3, '0'], [9, 9, '0'], [11, 5, '1'], [11, 6, '1'], [11, 7, '1']],
    eyes: [[4, 5], [8, 5]], mouth: [5, 8], glow: true,
  },
};

// ---------------- Pelo ----------------
// front: encima de la cabeza; back: detrás de la cabeza (y del cuerpo, si es largo). ox = -1, oy = -3 salvo que diga
// otra cosa: la columna 1 de la grilla es la x = 0 del cráneo y la fila 3 es su y = 0.
const H = (front, back, o = {}) => ({ front, back, ox: -1, oy: -3, bx: -1, by: -3, ...o });
export const HAIR = {
  rapado: H([
    '..............',
    '..............',
    '..............',
    '....;;;;;;....',
    '..;;;;;;;;;;..',
    '.;;;;;;;;;;;;.',
    '.;;........;;.',
  ]),
  cortito: H([
    '..............',
    '.....hhhh.....',
    '...hHHhhhh2...',
    '..hHhhhhhhhh2.',
    '.hHhhhhhhhhh2.',
    '.hhhhhhhhhhhh2',
    '.hhh2hhhh2hh2.',
    '.hh........h2.',
    '.h..........2.',
  ]),
  despeinado: H([
    '...h...h.h....',
    '...hh.hhhh.h..',
    '..hhHHhhhhhh..',
    '.hHHhhhhhhhh2.',
    'hhHhhhhhhhhhh2',
    '.hhhhhhhhhhhh2',
    '.hh2hh2hhh2h2.',
    '.hh..h.....h2.',
    '.h.........h..',
  ]),
  coleta: H([
    '..............',
    '.....hhhh.....',
    '...hHHhhhh2...',
    '..hHhhhhhhhh2.',
    '.hHhhhhhhhhh2.',
    '.hhhhhhhhhhhh2',
    '.hhhhhh2hhhh2.',
    '.hh........h2.',
    '.h..........2.',
  ], [
    '..............', '..............', '..............', '..............', '..............', '..............',
    '..............', '..............', '..............', '.............2', '............h2', '............h2',
    '............h2', '.............2',
  ], { bx: 0 }),
  largo: H([
    '..............',
    '.....hhhh.....',
    '...hHHhhhh2...',
    '..hHhhhhhhhh2.',
    '.hHhhhh2hhhh2.',
    '.hhhhh2hhhhhh2',
    '.hhhh2..2hhhh2',
    '.hhh......hhh2',
    '.hh........hh2',
    '.h..........h2',
  ], [
    '..............', '..............', '..............', '..............', '..............', '..............',
    '..............', '..............', '..............', '..............',
    'hh..........h2', 'hh..........h2', 'hh..........h2', 'hh..........h2', 'hh..........22', 'h2..........2.', '.2............',
  ]),
  corto: H([
    '..............',
    '.....hhhh.....',
    '...hHHhhhh2...',
    '..hHhhhhhhhh2.',
    '.hHhhhhhhhhh2.',
    '.hhhhhhhhhhhh2',
    '.hhhhhhhhhhhh2',
    '.hhh2h2h2h2hh2',
    '.hh........hh2',
    '.hh........hh2',
    '.h2........h2.',
    '.h..........2.',
  ]),
  flequillo: H([
    '..............',
    '.....hhhh.....',
    '...hHHhhhh2...',
    '..hHhhhhhhhh2.',
    '.hHhhhhhhhhh2.',
    '.hhhhhhhhhhhh2',
    '.hhhhhhhhh2hh2',
    '.hhhhhh2...h2.',
    '.hhhh2......2.',
    '.h2...........',
  ]),
  rodete: H([
    '.....hHh2.....',
    '....hHhhh2....',
    '.....h2h2.....',
    '...hHhhhhh2...',
    '..hHhhhhhhhh2.',
    '.hhhhhhhhhhhh2',
    '.hhhhh2hhhhh2.',
    '.h2........h2.',
  ], null, { oy: -4 }),
  jopo: H([
    '......hH2.....',
    '.....hHhh2....',
    '.....hHhh2....',
    '....;hHhh2;...',
    '..;;hhhhhh2;..',
    '.;;;hhhhhh2;;.',
    '.;;..h2hh2..;.',
  ], null, { oy: -5 }),
  trenzas: H([
    '..............',
    '.....hhhh.....',
    '...hHHhhhh2...',
    '..hHhhhhhhhh2.',
    '.hHhhhh2hhhh2.',
    '.hhhhh2hhhhhh2',
    '.hhhh2..2hhhh2',
    '.hhh......hhh2',
    '.hh........hh2',
  ], [
    '..............', '..............', '..............', '..............', '..............', '..............',
    '..............', '..............', '..............', '..............',
    'hh..........h2', 'h2..........22', 'hh..........h2', 'h2..........22', 'bb..........b8', '.h...........2', '.2............',
  ]),
  rizos: H([
    '...hH.hH.h....',
    '..hHhhHhhh2h..',
    '.hHhh2hh2hhh2.',
    'hHhh2hhh2hh2h2',
    'hhHhhhh2hhhhh2',
    'hh2hh2hhh2hh22',
    'hhhh2hh2hh2hh2',
    'h2hh......hh2.',
    'hh2........h22',
    '.h2.........2.',
  ], null, { oy: -3 }),
  colitas: H([
    '..............',
    '.....hhhh.....',
    '...hHHhhhh2...',
    '..hHhhhhhhhh2.',
    '.hHhhhh2hhhh2.',
    '.hhhhh2hhhhhh2',
    '.hhh2....2hhh2',
    '.hh........hh2',
    '.h..........2.',
  ], [
    '................', '................', '................', '................', '................', '................',
    '................', '................', '................', '................', '.l............4.',
    'hh............h2', 'hh............h2', '.h2...........2.', '..2.............',
  ], { bx: -2 }),
  ondas: H([
    '..............',
    '.....hhhh.....',
    '...hHHhhhh2...',
    '..hHhhhhhhhh2.',
    '.hHhhhh2hhhh2.',
    '.hhhhh2hhhhhh2',
    '.hhhh2..2hhhh2',
    '.hh2......2hh2',
    '.hh........hh2',
    '..h........h2.',
  ], [
    '..............', '..............', '..............', '..............', '..............', '..............',
    '..............', '..............', '..............', '..............',
    'hh..........h2', '.hh........h2.', 'hh..........h2', '.hh........h2.', 'hh..........22', '.2...........2',
  ]),
  // anuros: el "pelo" son las marcas del lomo y la cresta (en coordenadas del cráneo de 16)
  lomo: H([
    '..................',
    '..................',
    '..................',
    '.......hh..hh.....',
    '.....h..hh.....h..',
    '...hh.......hh....',
  ]),
  cresta_piel: H([
    '..................',
    '.......1111.......',
    '......1S1111......',
    '.....1S11111......',
  ]),
};

// ---------------- Barbas y marcas de la cara ----------------
// En coordenadas del cráneo de 12 (humanos, enanos y orcos), ox = -1: la columna 1 es la x = 0. oy = fila de arriba.
export const BEARDS = {
  barba_corta: { oy: 6, rows: [
    '.h..........h.',
    '.hh.......hhh.',
    '.hhhhhh..hhhh.',
    '..hhhhhhhhhh2.',
    '...hhhhhhhh2..',
    '....hh2hh2....',
  ] },
  barba_larga: { oy: 6, rows: [
    '.h..........h.',
    '.hh.......hhh.',
    '.hhhhhh..hhhh.',
    '.hhhhhhhhhhhh.',
    '.hHhhhhhhhhh2.',
    '..hHhh2hhhh2..',
    '..hhhhhhhhh2..',
    '...hh2hhhh2...',
    '....hhhhh2....',
    '.....hhh2.....',
  ] },
  bigote: { oy: 8, rows: [
    '.....hhh2h....',
    '....h2...h2...',
  ] },
  barba_trenzada: { oy: 6, rows: [
    '.h..........h.',
    '.hh.......hhh.',
    '.hhhhhh..hhhh.',
    '..hhhhhhhhhh2.',
    '...hhhhhhhh2..',
    '....hh2hh2....',
    '.....h2hh.....',
    '......hh......',
    '......b8......',
    '......h2......',
  ] },
};

// ---------------- Sombreros y cascos ----------------
// hide: 'all' tapa todo el pelo; un número tapa el pelo de adelante por encima de esa fila del cráneo
export const HATS = {
  capucha: { ox: -2, oy: -3, hide: 'all', hood: true, rows: [
    '......ccc.......',
    '....cccccc3.....',
    '...cCcccccccc3..',
    '..cCcccccccccc3.',
    '.cCcccccccccccc3',
    '.cCccccccccccc3.',
    '.cCc33333333cc3.',
    '.cc3........3cc.',
    '.cc3........3cc.',
    '.cc3........3cc.',
    '.cc3........3cc.',
    '.cc3........3cc.',
    '.cc3........3cc.',
    '.ccc3......3ccc.',
    '..cccccccccccc..',
  ] },
  gorro: { ox: -1, oy: -4, hide: 2, rows: [
    '......uU......',
    '.....uuu$.....',
    '...uuUuuuu$...',
    '..uUuuuuuuuu$.',
    '.uUuuuuuuuuu$.',
    '.uuuuuuuuuuuu$',
    '.UUUUUUUUUUUU$',
    '.u$u$u$u$u$u$.',
  ] },
  vincha: { ox: -1, oy: 3, hide: null, rows: ['.Llllllllllll4'] },
  gorra: { ox: -2, oy: -3, hide: 1, rows: [
    '...ccccccc......',
    '.cCCcccccccc3...',
    'cCccccccccccc3..',
    '.33cccccccccc3..',
    '..333333333333..',
  ] },
  sombrero_mago: { ox: -3, oy: -6, hide: 2, rows: [
    '.........cC3......',
    '.......cCccc3.....',
    '......cCcccc3.....',
    '.....cCccccc33....',
    '....cCccccccc3....',
    '....bbbbBbbbb8....',
    '.cCcccccccccccccc3',
    '..333333333333333.',
  ] },
  bandana: { ox: -2, oy: -2, hide: 3, rows: [
    '.....uuuuuu.....',
    '...uUuuuuuuu$...',
    '..uUuuuuuuuuu$..',
    '.uuUuuuuuuuuuu$.',
    'uu$$$$$$$$$$$$$.',
    'u$..............',
    '.u..............',
  ] },
  piluso: { ox: -3, oy: -3, hide: 1, rows: [
    '......xxxxxx......',
    '.....xXxxxxx&.....',
    '.....llllllll.....',
    '..xXxxxxxxxxxxx&..',
    '.&&&&&&&&&&&&&&&&.',
  ] },
  casco: { ox: -2, oy: -5, hide: 'all', rows: [
    '.......k........',
    '.....mmmmmm.....',
    '...mMMmmmmmm5...',
    '..mMmmmmmmmmm5..',
    '.mMmmmmmmmmmmm5.',
    '.mMmmmmmmmmmmm5.',
    '.8bbbbBbbbbbb88.',
    '.m5..........m5.',
    '.m5..........m5.',
  ] },
  galera: { ox: -3, oy: -3, hide: 1, rows: [
    '......llllll......',
    '.....lLllllll4....',
    '.....lLllllll4....',
    '.....33333333.....',
    'lLLllllllllllllll4',
    '.444444444444444..',
  ] },
  yelmo: { ox: -2, oy: -6, hide: 'all', rows: [
    'R..............R',
    'rR............r^',
    '.rr..mmmmmm..r^.',
    '..rmMMmmmmmm5^..',
    '..mMmmmmmmmmm5..',
    '.mMmmmmmmmmmmm5.',
    '.mMmmmmmmmmmmm5.',
    '.8bbbbBbbbbbb88.',
    '.m5..........m5.',
    '.m5..........m5.',
  ] },
};

// ---------------- Brazos ----------------
// En coordenadas del brazo de adelante (el de la derecha de la imagen): (0, 0) cae en el hombro, la esquina de arriba a
// la derecha del torso. 'a' manga, 'i' puño, 'g' mano. hand: punto de agarre. stretch: fila que se repite (o se saca)
// según el largo del brazo de cada pueblo (los dibujos son para 7). El brazo de atrás es el mismo, en espejo.
export const ARMS = {
  down: { x: 0, y: 0, stretch: 2, hand: [1, 5], rows: ['aaa', 'aaa', 'aaa', 'aaa', 'iii', 'ggg', 'ggg'] },
  hold: { x: 0, y: 0, stretch: 1, hand: [3, 4], rows: ['aaa..', 'aaaa.', '.aaa.', '..iii', '..ggg', '..ggg'] },
  out: { x: 0, y: 0, stretch: 1, hand: [3, 4], rows: ['aaa..', 'aaaa.', '.aaa.', '..iii', '..ggg', '..ggg'] },
  up: { x: 0, y: -6, hand: [2, 1], rows: ['.ggg', '.ggg', '.iii', '.aaa', 'aaa.', 'aaa.', 'aaa.'] },
  strike: { x: 0, y: 0, hand: [4, 3], rows: ['aaa...', 'aaaa..', '.aaai.', '..aiggg', '...ggg'] },
  point: { x: 0, y: 0, hand: [6, 1], rows: ['aaaaai.', 'aaaaaiggg', '.aaaaigg'] },
  give: { x: 0, y: 0, hand: [5, 3], rows: ['aaa...', 'aaa...', 'aaaai.', '.aaaiggg', '.....ggg'] },
  // al caminar: el brazo va adelante (sale del cuerpo y sube la mano) o queda atrás pegado
  swing: { x: 0, y: 0, stretch: 1, hand: [3, 3], rows: ['aaa..', '.aaa.', '..aaa', '..iii', '..ggg', '..ggg'] },
  back: { x: -1, y: 0, stretch: 2, hand: [1, 5], rows: ['aaa', 'aaa', 'aaa', 'aaa', 'iii', 'ggg', 'ggg'] },
  // brazo que tensa la cuerda: cruza el pecho hacia el centro (en espejo queda del lado de atrás)
  draw: { x: -5, y: 1, hand: [0, 0], rows: ['ggiaaaa', 'ggiaaaa'] },
};

// ---------------- Armas ----------------
// Las armas largas son una línea desde el agarre (empuñadura, guarda, hoja o asta) más una pieza en la punta dibujada
// para cada dirección. dir: up (en guardia), raise (levantada atrás), strike (después del golpe), fwd (al frente).
export const DIRS = { up: [0, -1], raise: [-1, -1], strike: [1, 1], fwd: [1, 0], down: [0, 1] };
export const WEAPONS = {
  espada: { kind: 'melee', back: [['b', 1]], shaft: [['+', 1], ['guard', 1], ['blade', 11]], tip: true },
  hacha: { kind: 'melee', back: [['6', 2]], shaft: [['w', 11]], head: {
    up: { rows: ['..MM..', '.wMmmM', '.wmmmm5', '.wmmmm5', '.wmm55', '.w55..'], ox: -1 },
    raise: { rows: ['.MM..', 'MmmM.', 'mmmm5', '.mm55', '..5.w'], ox: -2, oy: -2 },
    strike: { rows: ['w..M.', '.wmmM', '.mmmm5', '..mm55', '...55'], ox: -1, oy: -1 },
    fwd: { rows: ['.MMm.', 'wmmmm', '.mmm5', '.5555'], ox: -1, oy: -1 },
  } },
  martillo: { kind: 'melee', back: [['6', 2]], shaft: [['w', 9]], head: {
    up: { rows: ['MMMmmm5', 'Mmmmmm5', 'mmmmmm5', '5555555'], ox: -3, oy: -3 },
    raise: { rows: ['.MMm.', 'MMmm5', 'Mmmm5', 'mmmm5', '.555.'], ox: -2, oy: -2 },
    strike: { rows: ['.MMm.', 'MMmm5', 'Mmmm5', 'mmmm5', '.555.'], ox: -2, oy: -2 },
    fwd: { rows: ['MMm5', 'Mmm5', 'mmm5', 'mmm5', 'm555'], ox: 0, oy: -2 },
  } },
  lanza: { kind: 'thrust', back: [['6', 4]], shaft: [['w', 14]], head: {
    up: { rows: ['.M.', 'MM5', 'Mm5', '.m.'], ox: -1, oy: -3 },
    raise: { rows: ['MM.', 'Mm.', '..m'], ox: -1, oy: -1 },
    strike: { rows: ['m..', '.mM', '.MM'], ox: 0, oy: 0 },
    fwd: { rows: ['.MM.', 'mmMM5', '.55.'], ox: 0, oy: -1 },
  } },
  baston: { kind: 'cast', back: [['6', 5]], shaft: [['w', 13]], head: {
    up: { rows: ['.VV.', 'VvvV', 'Vv**', '.**.', '.6..'], ox: -1, oy: -4 },
    raise: { rows: ['.VV.', 'VvvV', 'Vv**', '.**.', '.6..'], ox: -1, oy: -4 },
    strike: { rows: ['.VV.', 'VvvV', 'Vv**', '.**.'], ox: -1, oy: -1 },
    fwd: { rows: ['.VV.', 'VvvV', 'Vv**', '.**.'], ox: 0, oy: -2 },
  } },
  // en la mano, dibujados enteros ('+' es el agarre)
  arco: { kind: 'bow', grid: ['.W...', '.NW..', '.N.W.', '.N..W', '.N..W', '.N..W', '.N..l', '.N..+', '.N..l', '.N..W', '.N..W', '.N..W', '.N.W.', '.NW..', '.W...'] },
  trabuco: { kind: 'gun', grid: ['......M5m', 'Wwwwwmmmm', '.w6+...5.'], up: ['.mM.', '.m5.', '.mm.', '.mm.', '.mw.', '.ww.', '.+6.', '.w..'] },
  farolito: { kind: 'none', grid: ['..+..', '..5..', '.mMm.', 'mYyjm', 'myYjm', 'mjjjm', '.555.'] },
  catalejo: { kind: 'none', grid: ['bmmmMM', '+8mm55'] },
  libro: { kind: 'cast', grid: ['4llll', 'lNnn4', 'l+nn4', 'l9994', '44444'] },
  orbe: { kind: 'cast', grid: ['.V*.', 'VVv*', 'v+v*', '.**.'] },
  escudo: { kind: 'none', off: true, grid: ['..mmm..', '.mwWwm.', 'mwWwww5', 'mwwbww5', 'mwwwww5', '.5www5.', '..555..'] },
};
// cosas del cuerpo (no van en la mano)
export const BODY_GEAR = {
  mochila: { back: ['.4llll4.', '4llLll44', '4lll8ll4'], at: 'top' },
  bolso: { strap: true, bag: ['4lll4', 'l8lll', '44444'] },
  collar: { chest: [[0, 0, 'v'], [0, -1, '4'], [-1, -2, '4'], [1, -2, '4']] },
  buho: { shoulder: ['.kk.', 'kkkk', 'kvkk', '.kk.', '.88.'] },
};

// ---------------- Cosas que se levantan o se entregan (gestos de las cinemáticas) ----------------
export const ITEMS = {
  caja: ['WWwww6', 'w6ww66', 'w8ww86', 'w6ww66', '666666'],
  veta: ['..V..', '.VvV.', 'VVv**', '.v**.', '..*..'],
  carta: ['NnnnN', 'n9999', 'nnnnn', '99999'],
  bolsa: ['.4l.', '.88.', 'lLll', 'llll', '4ll4'],
};
// efectos: flecha, fogonazo y destello de veta (no llevan contorno)
export const FX = {
  arrow: ['n.......', 'nwwwwwwM', 'n.......'],
  flash: ['.y.', 'yYy', 'Yjj', '.y.'],
  glow: ['..V..', '.....', 'V.v.V', '.....', '..V..'],
  smoke: ['.99', '9.9'],
};
