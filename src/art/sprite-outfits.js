// Ropa de los sprites 2D (paso 1d): cada estilo de DRESS_STYLES (src/core/data.js) pinta el torso, las mangas, las
// piernas y lo que cuelga (falda, capa). Mismos ids y mismos materiales que OUTFITS de src/avatar/figure.js, para que
// el 2D y el 3D sean la misma ropa. Los caracteres son los de CH (sprite-parts.js).
//   torso(x, y, W, H) → carácter (x en [0, W), y en [0, H), y = 0 arriba)
//   sleeve / cuff / hand: manga, puño y mano ('s' es la mano desnuda)
//   leg(y, L) → carácter de la pierna (y = 0 arriba, L = alto); boot: filas de bota abajo
//   hem: filas de la prenda que bajan sobre las piernas; robe: la falda llega hasta los pies (deja ver 1 fila)
//   flare: cuánto se abre la falda por fila; cape: capa detrás; pads: hombreras que salen 1 vóxel
const mid = (x, W) => Math.abs(x - (W - 1) / 2) < 1;
const belt = (x, y, W, H, row = H - 2) => (y === row ? (mid(x, W) ? 'b' : 'l') : null);
const collar = (x, y, W, n = 1) => y === 0 && Math.abs(x - (W - 1) / 2) <= n;
// correa cruzada del hombro izquierdo de la imagen a la cadera derecha
const strap = (x, y, W, H) => { const t = y / Math.max(1, H - 2); const xs = Math.round(1 + t * (W - 4)); return y < H - 2 && (x === xs || x === xs + 1); };
const vee = (x, y, W, d = 2) => Math.abs(x - (W - 1) / 2) < d - y && y < d;
const boots = (n) => (y, L) => (y >= L - n ? 'o' : null);

export const OUTFITS2D = {
  viajero: {
    torso: (x, y, W, H) => belt(x, y, W, H) || (strap(x, y, W, H) ? '4' : vee(x, y, W) ? 'n' : 'c'),
    sleeve: 'c', cuff: 'l', hand: 's', leg: (y, L) => boots(2)(y, L) || 't', hem: 1,
  },
  jubon: {
    torso: (x, y, W, H) => belt(x, y, W, H) || (mid(x, W) && y > 0 && y < H - 2 ? (y % 2 ? 'b' : '3') : collar(x, y, W, 2) ? '3' : 'c'),
    sleeve: 'c', cuff: '3', hand: 's', leg: (y, L) => boots(2)(y, L) || '3',
  },
  vestido: {
    torso: (x, y, W, H) => (y === H - 3 ? 'l' : vee(x, y, W) ? 'n' : 'c'),
    sleeve: 'c', cuff: 'n', hand: 's', leg: (y, L) => boots(1)(y, L) || 't', robe: true, flare: 0.5, skirt: (x, y, w, L) => (y === L - 1 ? '3' : 'c'),
  },
  minero: {
    torso: (x, y, W, H) => belt(x, y, W, H) || (x === 2 || x === W - 3 ? 'l' : 'n'),
    sleeve: 'n', cuff: 's', hand: 's', leg: (y, L) => boots(2)(y, L) || 't', bare: 2,
  },
  tunica: {
    torso: (x, y, W, H) => (y === H - 3 ? 'b' : mid(x, W) && y > 0 ? 'u' : 'c'),
    sleeve: 'c', cuff: 'u', hand: 's', leg: (y, L) => boots(1)(y, L) || 'c', robe: true, flare: 0.4, wide: true,
    skirt: (x, y, w, L) => (Math.abs(x - (w - 1) / 2) < 1 ? 'u' : y === L - 1 ? '3' : 'c'),
  },
  habito: {
    torso: (x, y, W, H) => (y === H - 3 ? (mid(x, W) ? 'N' : 'n') : vee(x, y, W, 3) ? '3' : 'c'),
    sleeve: 'c', cuff: 'c', hand: 's', leg: (y, L) => boots(1)(y, L) || 'c', robe: true, flare: 0.3, wide: true,
    skirt: (x, y, w, L) => (y === 0 && Math.abs(x - (w - 1) / 2 + 1) < 1 ? 'n' : y === 1 && Math.abs(x - (w - 1) / 2 + 1) < 1 ? '9' : y === L - 1 ? '3' : 'c'),
  },
  delantal: {
    torso: (x, y, W, H) => (x >= 2 && x <= W - 3 && y >= 1 ? (y === 1 && (x === 2 || x === W - 3) ? '4' : 'l') : 'n'),
    sleeve: 'n', cuff: 's', hand: 'l', leg: (y, L) => boots(2)(y, L) || 't', bare: 2,
    apron: 3,
  },
  cuero: {
    torso: (x, y, W, H) => belt(x, y, W, H) || (y === 0 ? (Math.abs(x - (W - 1) / 2) < 2 ? 'c' : 'l') : (x === 1 || x === W - 2) && y < H - 2 ? '4' : y === 2 ? 'L' : 'l'),
    sleeve: 'c', cuff: 'l', hand: 'l', leg: (y, L) => boots(3)(y, L) || 't', bracer: 2, pads: 'l', hem: 1, hemCh: '4',
  },
  vestido_noble: {
    torso: (x, y, W, H) => (y === H - 3 ? 'b' : vee(x, y, W, 3) ? 'n' : y === 0 ? 'b' : 'c'),
    sleeve: 'c', cuff: 'b', hand: 's', leg: (y, L) => boots(1)(y, L) || 'c', robe: true, flare: 0.6,
    skirt: (x, y, w, L) => (y === L - 1 ? 'b' : y === L - 2 ? '3' : 'c'),
  },
  tabardo: {
    torso: (x, y, W, H) => belt(x, y, W, H) || (x < 2 || x > W - 3 ? (y % 2 ? '5' : 'm') : (mid(x, W) && (y === 2 || y === 3) ? 'b' : 'c')),
    sleeve: 'm', cuff: 'l', hand: 'l', leg: (y, L) => boots(2)(y, L) || 't', hem: 2, hemCh: 'c', hemNarrow: 2,
  },
  capa_viaje: {
    torso: (x, y, W, H) => belt(x, y, W, H) || (y === 0 && mid(x, W) ? 'b' : vee(x, y, W) ? 'n' : x < 2 || x > W - 3 ? 'c' : 't'),
    sleeve: 't', cuff: 'l', hand: 's', leg: (y, L) => boots(2)(y, L) || 't', cape: 'c', hem: 1, hemCh: 't',
  },
  pieles: {
    torso: (x, y, W, H) => belt(x, y, W, H) || (y < 2 ? (y === 0 ? 'F' : 'f') : 'l'),
    sleeve: 'f', cuff: 'l', hand: 's', leg: (y, L) => (y >= L - 2 ? 'f' : 't'), pads: 'f', hem: 1, hemCh: 'l',
  },
  abrigo: {
    torso: (x, y, W, H) => belt(x, y, W, H, H - 3) || (vee(x, y, W, 3) ? (y === 0 ? 'n' : '3') : mid(x, W) && y % 2 === 0 ? 'b' : 'c'),
    sleeve: 'c', cuff: '3', hand: 's', leg: (y, L) => boots(2)(y, L) || 't', hem: 3, hemCh: 'c', split: true,
  },
  cota: {
    torso: (x, y, W, H) => belt(x, y, W, H) || (y === 0 && Math.abs(x - (W - 1) / 2) < 2 ? 'c' : y % 2 ? '5' : 'm'),
    sleeve: 'm', cuff: 'l', hand: 'l', leg: (y, L) => boots(2)(y, L) || 't', hem: 2, hemCh: 'm', hemAlt: '5',
  },
  placas: {
    torso: (x, y, W, H) => belt(x, y, W, H) || (y === 0 ? 'M' : mid(x, W) ? 'M' : y === 3 ? '5' : 'm'),
    sleeve: 'm', cuff: '5', hand: 'm', leg: (y, L) => (y >= L - 2 ? 'm' : y === 0 ? '5' : 'm'), pads: 'm', hem: 1, hemCh: 'c',
  },
  archimago: {
    torso: (x, y, W, H) => (y === 0 ? 'b' : y === H - 3 ? 'b' : mid(x, W) ? (y % 2 ? 'v' : 'b') : 'c'),
    sleeve: 'c', cuff: 'b', hand: 's', leg: (y, L) => boots(1)(y, L) || 'c', robe: true, flare: 0.5, wide: true, pads: 'b',
    skirt: (x, y, w, L) => (y === L - 1 ? 'b' : Math.abs(x - (w - 1) / 2) < 1 ? (y % 3 === 1 ? 'v' : 'b') : 'c'),
  },
};
export const outfit2d = (id) => OUTFITS2D[id] || OUTFITS2D.viajero;
