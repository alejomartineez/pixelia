// Gente de El Quiebre en vóxel detallado (plan §M1 y §M2). Primero la silueta: manos, botas y hombros grandes, cada
// pueblo con su forma (enanos anchos y bajos, orcos de torso enorme y piernas cortas, anuros achaparrados con ojos
// arriba y boca ancha, gente-zorro con orejas grandes, hocico largo y cola). Materiales planos de 2 o 3 tonos (luz,
// base, sombra) sin ruido; caras con volumen (ceño, nariz y barba son formas). Lo arma avatar.js; acá están las piezas:
//   PEOPLE[type][build]  medidas de cada pueblo (en vóxeles de S = 1/48)
//   OUTFITS[id]          cómo se pinta cada ropa en torso, brazos, piernas, falda y capa
//   buildHead(v, look, D, pal)  cabeza con cara, pelo, barba o cicatrices y lo que lleve puesto
//   GEAR[id]             equipo en la mano, el cuerpo o el hombro (las clases de M3 lo cambian con classLook)
// Ejes: +Z es el frente, y = 0 el piso. Cada parte se dibuja en su grilla local con el pivote en el origen.
import { MAT, mix, shade, ramp, hsl, hash3, hexToInt, skinHex, hairHex, clothHex, keepFlat, headMode } from './avatar-kit.js';

// ---------------- Medidas por pueblo ----------------
// leg: alto/ancho/profundidad y separación de la cadera; boot: alto de la bota; H/W/D: torso; sh: hombros que salen
// (vóxeles por lado en las filas de arriba); armL/armW: brazo; hand: lado del puño; hw/hh/hd: cabeza; neck: cuello;
// headY: cuánto se hunde la cabeza entre los hombros; hunch: inclinación hacia adelante; headZ: cabeza adelantada.
const base = (o) => ({ neck: 1, hunch: 0, headZ: 0, headY: 0, sh: 1, boot: 6, ...o });
export const PEOPLE = {
  humano: {
    recio: base({ legH: 20, legW: 6, legD: 6, hip: 3.5, H: 17, W: 18, D: 9, sh: 2, armL: 18, armW: 5, hand: 6, hw: 10, hh: 12, hd: 10 }),
    esbelto: base({ legH: 21, legW: 5, legD: 5, hip: 3, H: 16, W: 14, D: 8, sh: 1, armL: 17, armW: 4, hand: 5, hw: 10, hh: 12, hd: 10, slim: true }),
  },
  enano: {
    // ~3 cabezas, como la referencia del usuario: cabeza de 14 × 13, manos de 9 y botas con la punta larga (toe)
    recio: base({ legH: 11, legW: 8, legD: 8, hip: 4.5, H: 16, W: 24, D: 12, sh: 2, armL: 15, armW: 7, hand: 9, hw: 14, hh: 13, hd: 12, neck: 0, headY: 1, boot: 5, toe: 3 }),
    esbelto: base({ legH: 12, legW: 7, legD: 7, hip: 4, H: 15, W: 20, D: 11, sh: 1, armL: 14, armW: 6, hand: 8, hw: 14, hh: 13, hd: 11, neck: 0, headY: 1, boot: 5, toe: 3, slim: true }),
  },
  orco: {
    recio: base({ legH: 14, legW: 8, legD: 8, hip: 5, H: 19, W: 26, D: 13, sh: 3, armL: 20, armW: 8, hand: 9, hw: 12, hh: 12, hd: 12, neck: 0, headY: 1, hunch: 0.12, headZ: 3, boot: 5 }),
    esbelto: base({ legH: 15, legW: 7, legD: 7, hip: 4.5, H: 18, W: 22, D: 12, sh: 2, armL: 19, armW: 7, hand: 8, hw: 12, hh: 12, hd: 12, neck: 0, headY: 0, hunch: 0.1, headZ: 2, boot: 5, slim: true }),
  },
  anuro: {
    recio: base({ legH: 10, legW: 8, legD: 8, hip: 5, H: 14, W: 22, D: 14, sh: 1, armL: 15, armW: 5, hand: 7, hw: 18, hh: 8, hd: 14, neck: 0, headY: 1, hunch: 0.06, headZ: 1, boot: 0 }),
    esbelto: base({ legH: 11, legW: 7, legD: 7, hip: 4.5, H: 14, W: 20, D: 12, sh: 1, armL: 15, armW: 5, hand: 6, hw: 16, hh: 8, hd: 13, neck: 0, headY: 1, hunch: 0.05, headZ: 1, boot: 0, slim: true }),
  },
  zorro: {
    recio: base({ legH: 18, legW: 5, legD: 6, hip: 3.5, H: 15, W: 16, D: 8, sh: 1, armL: 15, armW: 4, hand: 5, hw: 10, hh: 11, hd: 10 }),
    esbelto: base({ legH: 18, legW: 5, legD: 5, hip: 3, H: 14, W: 14, D: 7, sh: 1, armL: 15, armW: 4, hand: 5, hw: 10, hh: 11, hd: 10, slim: true }),
  },
  vaciado: {
    recio: base({ legH: 18, legW: 5, legD: 5, hip: 3, H: 15, W: 14, D: 7, armL: 17, armW: 4, hand: 5, hw: 10, hh: 12, hd: 10, hunch: 0.2, headZ: 2, slim: true }),
    esbelto: base({ legH: 18, legW: 5, legD: 5, hip: 3, H: 15, W: 13, D: 7, armL: 17, armW: 4, hand: 5, hw: 10, hh: 12, hd: 10, hunch: 0.22, headZ: 2, slim: true }),
  },
};
// Cabeza grande (§8, el modo por defecto): la cabeza crece y el cuerpo se acorta un poco (piernas dl, torso dH), así hay
// lugar para ojos de 2 × 3, cejas, nariz y orejas grandes. Por pueblo; recio y esbelto comparten la cabeza.
const BIG_HEAD = {
  humano: { hw: 12, hh: 14, hd: 12, dl: -3, dH: -1 },
  enano: { hw: 16, hh: 15, hd: 14, dl: 0, dH: -1 },
  orco: { hw: 14, hh: 14, hd: 14, dl: -2, dH: -1 },
  anuro: { hw: 20, hh: 10, hd: 16, dl: 0, dH: 0 },
  zorro: { hw: 12, hh: 13, hd: 12, dl: -3, dH: -1 },
  vaciado: { hw: 12, hh: 14, hd: 12, dl: -3, dH: -1 },
};
export const bigHead = () => headMode() === 'grande';
export const dimsOf = (type, build) => {
  let D = (PEOPLE[type] || PEOPLE.humano)[build === 'esbelto' ? 'esbelto' : 'recio'];
  const B = bigHead() && BIG_HEAD[type];
  if (B) D = { ...D, hw: B.hw - (build === 'esbelto' && type === 'anuro' ? 2 : 0), hh: B.hh, hd: B.hd - (build === 'esbelto' && type !== 'humano' ? 1 : 0), legH: D.legH + B.dl, H: D.H + B.dH };
  // el brazo se mete 1 vóxel en el hombro: con la pose en A no queda una rendija entre brazo y torso. Siempre en
  // vóxel entero respecto del torso (con armW impar caía en medio vóxel y el brazo pisaba media columna)
  return { ...D, armX: D.W / 2 + D.sh - 1 + Math.floor(D.armW / 2) };
};
// Capas de la grilla (tools/test-gear-fit.mjs): lo que se pinta después de lay(v, 'armor' | 'gear' | 'outfit') no es
// cuerpo, y la prueba revisa que no se meta en la piel. Sin la prueba, v.layer no hace nada.
const lay = (v, name) => { v.layer = name; };
/** Celdas x del brazo derecho en la grilla del torso: [x0, x1). El izquierdo es el espejo (x → -1 - x). */
const armSpan = (D) => { const x0 = D.armX - Math.floor(D.armW / 2); return [x0, x0 + D.armW]; };

// ---------------- Paleta de un look ----------------
const luma = (c) => (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;
const IRIS = { humano: 0x2a2220, enano: 0x2a2220, orco: 0xd0842c, anuro: 0xc8a032, zorro: 0xc07a22, vaciado: 0x5fd0c4 };
export function paletteOf(look) {
  const t = look.type;
  const skin = hexToInt(skinHex(t, look.skin));
  const hair = hexToInt(hairHex(look.hairColor));
  // la ropa contrasta con la piel en valor, no solo en matiz (docs/ARTE-PERSONAJES.md §3, regla 3): si quedan a
  // menos de un escalón, la tela baja hasta separarse (la piel es lo más claro cerca de la cara); con la piel muy
  // oscura, la tela sube
  let cloth = hexToInt(clothHex(look.dressColor));
  const up = luma(skin) < 0.33 ? 0.8 : -0.7;
  for (let i = 0; i < 3 && Math.abs(luma(cloth) - luma(skin)) < 0.1; i++) cloth = ramp(cloth, up);
  // rampas con cambio de matiz (docs/ARTE-PERSONAJES.md §3): la piel oscurece hacia el rojo (nunca al gris) y aclara
  // hacia el durazno; la tela y el pelo oscurecen hacia el violeta frío y aclaran hacia el ocre
  const SK = { hue: 7, val: 0.085, cool: t === 'anuro' || t === 'orco' ? 200 : 350, warm: 42, sat: 0.16 };
  const CL = { hue: 8, val: 0.08 };
  return {
    ...MAT, type: t,
    skin, skinL: ramp(skin, 1, SK), skinD: ramp(skin, -1, SK), skinDD: ramp(skin, -2.4, SK),
    hair, hairD: ramp(hair, -1.3, CL), hairL: ramp(hair, 1.2, CL), hairDD: ramp(hair, -2.4, CL), hairLL: ramp(hair, 2.3, CL),
    // pecho y hocico claros: la gente-zorro tiene el pelaje crema; los anuros, la panza pálida
    cream: t === 'zorro' ? mix(skin, 0xe6dcc6, 0.8) : t === 'anuro' ? mix(skin, 0xd8d0a0, 0.55) : ramp(skin, 1, SK),
    cloth, clothD: ramp(cloth, -1.2, CL), clothDD: ramp(cloth, -2.2, CL), clothL: ramp(cloth, 1.2, CL),
    iris: IRIS[t] || IRIS.humano, sclera: t === 'orco' ? 0xa09a70 : mix(ramp(skin, 1.5, SK), 0xc8bca6, 0.6),
    // párpado: sombra honda y apagada (casi tinta con un poco de piel). Con la rampa de la piel salía rojo saturado y
    // el ojo se leía colorado
    lid: mix(ramp(skin, -2.4, SK), 0x2a2428, 0.6), lip: mix(ramp(skin, -1.4, SK), 0x8a3a34, 0.25),
    scar: mix(skin, 0xc8988a, 0.6),
  };
}
// tono por altura: luz arriba, sombra abajo (los 3 tonos de cada material); k = 2 es el borde de luz de las aristas
// de arriba (hombros, mangas, botas), pintado en bloque como en el pixel art
const lit = (c, k) => (k > 1 ? ramp(c, 1.5) : k > 0 ? ramp(c, 0.8) : k < 0 ? ramp(c, -0.9) : c);

// ---------------- Ropa ----------------
// ctx de torso: { x, y, z, hw, hd, H, front, back, side } (x en [-hw, hw), y en [0, H), z en [-hd, hd)).
const BELT_Y = 3;
function belt(c, P, y0 = BELT_Y) {
  if (c.y !== y0 && c.y !== y0 - 1) return null;
  if (c.front && Math.abs(c.x + 0.5) < 1.5) return c.y === y0 ? P.brass : P.brassD;
  return c.y === y0 ? P.leatherL : P.leather;
}
const collar = (c, n = 3) => c.y >= c.H - 1 && Math.abs(c.x + 0.5) <= n;
/** Correa cruzada del hombro izquierdo a la cadera derecha (adelante y atrás). */
function strap(c, from = 4) {
  if (!(c.front || c.back) || c.y < from) return false;
  const t = (c.H - 1 - c.y) / Math.max(1, c.H - 1 - from);
  const xs = Math.round(-c.hw + 2 + t * (2 * c.hw - 6));
  return c.x === xs || c.x === xs + 1;
}
/** Correa cruzada con su hebilla de bronce a la altura del pecho (pasada de detalle: piezas chicas). */
const strapCol = (c, P, from = 4) => (!strap(c, from) ? null : c.front && (c.y === c.H - 7 || c.y === c.H - 8) ? (c.y === c.H - 7 ? P.brass : P.brassD) : P.leatherD);
// cota de malla en bandas de 3 (no damero: a esta distancia el damero es ruido)
const chain = (x, y, z, P) => ((y + 99) % 3 === 0 ? P.metalD : P.metal);
const boots = (h, P) => (y) => (y < h - 1 ? P.boot : y === h - 1 ? P.bootL : null);

export const OUTFITS = {
  viajero: {
    torso: (c, P) => belt(c, P) || strapCol(c, P) || (collar(c) ? P.linen : P.cloth),
    sleeve: (r, L, P) => (r >= L - 4 ? P.leather : P.cloth),
    glove: true,
    leg: (y, P) => boots(7, P)(y) ?? P.trouser,
    skirt: { len: 5, col: (y, len, P) => (y === 0 ? P.clothD : P.cloth) },
    pouch: 'right',
  },
  jubon: {
    torso: (c, P) => belt(c, P) || (c.front && Math.abs(c.x + 0.5) < 1 && c.y > BELT_Y ? (c.y % 2 ? P.brass : P.clothD) : collar(c, 4) ? P.clothD : P.cloth),
    sleeve: (r, L, P) => (r >= L - 2 ? P.linen : r <= 3 ? P.clothL : P.cloth),
    leg: (y, P) => boots(9, P)(y) ?? P.clothDD,
    skirt: { len: 3, col: (y, len, P) => (y === 0 ? P.clothDD : P.clothD) },
    pouch: 'left',
  },
  vestido: {
    torso: (c, P) => belt(c, P, 5) || (c.front && Math.abs(c.x + 0.5) < 1 && c.y > 5 && c.y < c.H - 2 ? (c.y % 2 ? P.linen : P.clothDD)
      : c.y >= c.H - 2 && Math.abs(c.x + 0.5) <= 3 && c.front ? P.linen : P.cloth),
    sleeve: (r, L, P) => (r >= L - 2 ? P.clothD : P.linen),
    leg: (y, P) => boots(4, P)(y) ?? P.trouserD,
    skirt: { len: 11, flare: 6, col: (y, len, P) => (y <= 1 ? P.clothDD : P.clothD) },
  },
  minero: {
    torso: (c, P) => belt(c, P) || ((c.front || c.back) && Math.abs(Math.abs(c.x + 0.5) - (c.hw - 3.5)) < 1 ? P.leatherD : collar(c, 2) && c.front ? P.skinD : 0x6a6458),
    sleeve: (r, L, P) => (r < 5 ? 0x6a6458 : r === 5 ? P.linenD : 'skin'),
    glove: true,
    leg: (y, P) => boots(7, P)(y) ?? (y >= 9 && y <= 10 ? P.leatherD : 0x4a3f33),
    pouch: 'both',
  },
  tunica: {
    torso: (c, P) => (c.y === BELT_Y ? P.linen : c.front && Math.abs(c.x + 0.5) < 1 ? P.brassD : c.y >= c.H - 2 ? P.clothD : P.cloth),
    sleeve: (r, L, P) => (r >= L - 1 ? P.brassD : P.cloth),
    wide: 5,
    leg: (y, P) => boots(3, P)(y) ?? P.trouserD,
    skirt: { long: true, flare: 7, col: (y, len, P, c) => (y === 0 ? P.brassD : c.front && Math.abs(c.x + 0.5) < 1 ? P.brassD : P.cloth) },
  },
  habito: {
    torso: (c, P) => (c.y === BELT_Y || c.y === BELT_Y - 1 ? (c.y === BELT_Y ? P.linen : P.linenD) : (c.front || c.back) && Math.abs(c.x + 0.5) <= 3 ? P.clothD : P.cloth),
    sleeve: (r, L, P) => (r >= L - 1 ? P.clothD : P.cloth),
    wide: 5,
    leg: (y, P) => (y === 0 ? P.leather : y === 2 ? P.leatherD : y < 3 ? 'skin' : P.trouserD),   // sandalias: suela y tira
    skirt: { long: true, gap: 4, flare: 8, col: (y, len, P) => (y === 0 ? P.clothDD : P.cloth) },
    hood: true, pouch: 'left',
    extra: (v, D, P) => {
      const hd = Math.floor(D.D / 2), H = D.H;
      // faja de lino con nudo al costado y dos puntas que cuelgan
      v.box(2, BELT_Y - 1, hd, 3, 2, 1, P.linenD); v.box(2, BELT_Y - 8, hd + 1, 1, 7, 1, P.linen); v.box(4, BELT_Y - 6, hd + 1, 1, 5, 1, P.linenD);
      // cuentas de madera al cuello: una V de cuentas claras con una más grande abajo
      for (let i = 0; i < 5; i++) for (const s of [-1, 1]) v.set(s < 0 ? -1 - i : i, H - 1 - i, hd, i % 2 ? P.woodD : P.straw);
      v.box(-1, H - 7, hd, 2, 2, 1, P.wood);
    },
  },
  delantal: {
    torso: (c, P) => ((c.front && Math.abs(c.x + 0.5) <= c.hw - 2 && c.y < c.H - 2) || (c.front && c.y >= c.H - 2 && Math.abs(Math.abs(c.x + 0.5) - 3.5) < 1)
      ? P.leather : c.y === 4 ? P.leatherD : P.linen),
    sleeve: (r, L, P) => (r < 5 ? P.linen : r === 5 ? P.linenD : 'skin'),
    glove: true,
    leg: (y, P) => boots(7, P)(y) ?? P.trouser,
    skirt: { len: 10, col: (y, len, P, c) => (c.front && Math.abs(c.x + 0.5) <= c.hw - 2 ? (y === 0 ? P.leatherD : P.leather) : null) },
  },
  cuero: {
    torso: (c, P) => belt(c, P) || strapCol(c, P, 5) || (c.side && c.y < c.H - 3 ? P.cloth : c.front && Math.abs(c.x + 0.5) < 1 && c.y > BELT_Y ? P.leatherD
      : c.y === 8 ? P.leatherD : collar(c) ? P.clothD : P.leather),
    pauldron: (P) => P.leather,
    sleeve: (r, L, P) => (r >= L - 6 ? P.leather : P.cloth),
    glove: true,
    leg: (y, P) => boots(8, P)(y) ?? (y === 10 ? P.leatherD : P.trouser),
    skirt: { len: 5, col: (y, len, P, c) => ((c.x + 99) % 4 === 0 ? null : y === 0 ? P.leatherD : P.leather) },
    pouch: 'both',
  },
  vestido_noble: {
    torso: (c, P) => (c.y === BELT_Y ? P.brass : c.front && Math.abs(c.x + 0.5) < 1 && c.y > BELT_Y ? (c.y % 2 ? P.brass : P.clothD) : c.y >= c.H - 1 ? P.brassD : c.side ? P.clothD : P.cloth),
    sleeve: (r, L, P) => (r >= L - 1 ? P.brass : r <= 2 ? P.clothL : P.cloth),
    leg: (y, P) => boots(3, P)(y) ?? P.trouserD,
    skirt: { long: true, flare: 7, col: (y, len, P, c) => (y === 1 ? P.brassD : y === 0 ? P.clothDD : c.front && Math.abs(c.x + 0.5) <= 2 ? P.clothDD : P.cloth) },
  },
  tabardo: {
    torso: (c, P) => {
      const b = belt(c, P); if (b) return b;
      const panel = (c.front || c.back) && Math.abs(c.x + 0.5) <= c.hw - 3;
      if (panel && c.front && c.y >= c.H - 8 && c.y <= c.H - 3 && Math.abs(c.x + 0.5) + Math.abs(c.y - (c.H - 5.5)) <= 2.5) return P.brass;
      return panel ? P.cloth : chain(c.x, c.y, c.z, P);
    },
    pauldron: (P) => P.metal,
    sleeve: (r, L, P) => chain(0, r, 0, P),
    glove: true,
    leg: (y, P) => boots(8, P)(y) ?? P.trouserD,
    skirt: { len: 7, col: (y, len, P, c) => ((c.front || c.back) && Math.abs(c.x + 0.5) <= c.hw - 3 ? (y === 0 ? P.clothD : P.cloth) : y >= len - 3 ? chain(c.x, y, c.z, P) : null) },
  },
  capa_viaje: {
    torso: (c, P) => belt(c, P) || strapCol(c, P) || P.trouser,
    sleeve: (r, L, P) => (r >= L - 4 ? P.leather : P.trouser),
    glove: true,
    leg: (y, P) => boots(8, P)(y) ?? P.trouserD,
    skirt: { len: 4, col: (y, len, P) => P.trouser },
    cape: true, mantle: true, pouch: 'right',
  },
  pieles: {
    torso: (c, P) => (c.y === BELT_Y || c.y === BELT_Y - 1 ? P.cloth : c.front && Math.abs(c.x + 0.5) < 1 ? P.leatherD : c.y === 7 ? P.leatherD : P.leather),
    pauldron: (P) => P.fur, furPauldron: true,
    sleeve: (r, L, P) => (r % 4 === 3 ? P.leather : P.linenD),
    glove: true,
    leg: (y, P) => (y < 5 ? P.leather : y < 7 ? P.fur : y % 4 === 0 ? P.leatherD : P.cloth),
    skirt: { len: 5, col: (y, len, P) => (y === 0 ? P.fur : P.leather) },
    mantle: 'fur', pouch: 'left',
  },
  abrigo: {
    torso: (c, P) => {
      if (c.y === BELT_Y || c.y === BELT_Y + 1) return c.front && Math.abs(c.x + 0.5) < 1.5 ? P.brass : P.leather;
      if (c.front && c.y >= c.H - 5 && Math.abs(c.x + 0.5) >= 1 && Math.abs(c.x + 0.5) <= 3.5) return P.clothD;
      if (c.front && (c.x === -5 || c.x === 4) && c.y % 3 === 1 && c.y < c.H - 5) return P.brass;
      if (c.front && Math.abs(c.x + 0.5) < 1) return P.linenD;
      return P.cloth;
    },
    pauldron: (P) => P.clothD,   // charreteras con remaches
    sleeve: (r, L, P) => (r >= L - 3 ? P.clothD : P.cloth),
    glove: true,
    leg: (y, P) => boots(10, P)(y) ?? P.trouser,
    skirt: { len: 13, flare: 8, col: (y, len, P, c) => (c.front && Math.abs(c.x + 0.5) <= 3 ? null : y === 0 ? P.clothDD : P.cloth) },
  },
  cota: {
    torso: (c, P) => belt(c, P) || (collar(c, 4) ? P.metalD : chain(c.x, c.y, c.z, P)),
    pauldron: (P) => P.metal,
    sleeve: (r, L, P) => chain(0, r, 0, P),
    glove: true,
    leg: (y, P) => boots(7, P)(y) ?? P.trouserD,
    skirt: { len: 6, col: (y, len, P, c) => (y === 0 ? P.metalD : chain(c.x, y, c.z, P)) },
    pouch: 'left',
  },
  placas: {
    torso: (c, P) => {
      const b = belt(c, P); if (b) return b;
      if (c.front && Math.abs(c.x + 0.5) < 1 && c.y > BELT_Y) return P.metalL;
      if (c.y % 4 === 0) return P.metalD;
      return P.metal;
    },
    pauldron: (P) => P.metal, bigPauldron: true,
    sleeve: (r, L, P) => (r % 4 === 3 ? P.metalD : P.metal),
    glove: 'metal',
    leg: (y, P) => (y < 2 ? P.metalD : y < 10 ? P.metal : y < 12 ? P.metalL : P.trouserD),
    skirt: { len: 6, col: (y, len, P, c) => (c.side ? null : y % 3 === 0 ? P.metalD : P.metal) },
  },
  archimago: {
    torso: (c, P) => (c.y === BELT_Y ? P.brassD : c.front && Math.abs(c.x + 0.5) < 2 ? (Math.abs(c.x + 0.5) > 1 ? P.brassD : P.clothDD) : P.clothD),
    sleeve: (r, L, P) => (r >= L - 1 ? P.brass : P.clothD),
    wide: 6,
    leg: (y, P) => boots(3, P)(y) ?? P.trouserD,
    skirt: { long: true, flare: 6, col: (y, len, P, c) => (y === 0 ? P.brass : c.front && Math.abs(c.x + 0.5) <= 2 ? P.clothDD : P.clothD) },
    cape: true, mantle: true, highCollar: true,
  },
};
export const outfitOf = (id) => OUTFITS[id] || OUTFITS.viajero;

// ---------------- Cuerpo: torso, brazos, piernas, falda y capa ----------------
const bevel = (x, z, x0, x1, z0, z1) => (x === x0 || x === x1 - 1) && (z === z0 || z === z1 - 1);

/** Torso (con cuello y lo que cuelgue del cinturón). La cadera está en y = 0. */
export function drawTorso(v, look, D, P, gear) {
  const o = outfitOf(look.dress);
  const hw = D.W / 2, hd = Math.floor(D.D / 2), H = D.H;
  for (let y = 0; y < H; y++) {
    // hombros que salen en las filas de arriba; cintura apenas más angosta en los esbeltos; panza en los anuros
    const top = y >= H - 4 ? D.sh : 0;
    const w = hw + top - (D.slim && y >= 2 && y <= 6 ? 1 : 0);
    const dz = look.type === 'anuro' && y >= 2 && y <= 8 ? 1 : 0;
    for (let x = -w; x < w; x++) for (let z = -hd; z < hd + dz; z++) {
      if (bevel(x, z, -w, w, -hd, hd + dz)) continue;
      if (y === H - 1 && (x === -w || x === w - 1)) continue;
      const c = { x, y, z, hw: w, hd: hd + dz, H, front: z === hd + dz - 1, back: z === -hd, side: x === -w || x === w - 1 };
      let col = gear?.paint?.(c, P, look) ?? o.torso(c, P);
      if (col === 'skin') col = P.skin;
      if (look.type === 'vaciado' && c.front && y > BELT_Y && y < H - 1 && x === -2 + [0, 1, 1, 0, -1, -1][y % 6]) col = y > H - 5 ? P.vein : P.veinD;   // la grieta de veta
      // borde de luz en la arista de arriba de los hombros, luz debajo y sombra en la cadera; bajo el cinturón, la
      // tela hace un pliegue en sombra (pasada de detalle: tonos pintados en bloques, no ruido)
      const k = y === H - 1 && (Math.abs(x + 0.5) >= w - 3 || c.front) ? 2 : y >= H - 2 ? 1 : y <= 1 || y === BELT_Y - 2 ? -1 : 0;
      v.set(x, y, z, lit(col, k));
    }
  }
  // hebilla con relieve: si el cinturón lleva la placa de bronce adelante, sale 1 con un marco y el cuero que pasa
  const fzB = hd - 1 + (look.type === 'anuro' ? 1 : 0);
  if (v.get(0, BELT_Y, fzB) === P.brass || v.get(-1, BELT_Y, fzB) === P.brass) {
    v.box(-2, BELT_Y - 2, fzB + 1, 4, 4, 1, (x, y) => (Math.abs(x + 0.5) < 1 && (y === BELT_Y - 1 || y === BELT_Y) ? P.leatherD : y === BELT_Y + 1 ? ramp(P.brass, 1) : P.brass));
    v.set(0, BELT_Y, fzB + 2, P.brassD);   // la lengüeta
    // remaches del cinturón, cada 4 columnas
    for (let x = -hw + 2; x < hw - 1; x += 4) if (Math.abs(x + 0.5) > 3) v.set(x, BELT_Y, fzB, ramp(P.brass, 0.6));
  }
  for (let y = H; y < H + D.neck; y++) v.box(-2, y, -2, 4, 1, 4, P.skinD);
  if (look.type === 'zorro' && !o.mantle) v.box(-2, H - 4, hd, 4, 4, 1, (x, y) => (y === H - 4 ? null : P.cream));   // pechera de pelo
  // dónde cae la cabeza en la grilla del torso (enanos, orcos y anuros la tienen hundida entre los hombros): lo que
  // va alrededor del cuello deja 1 vóxel de luz, porque la cabeza gira un poco al respirar
  const hb = H + D.neck - D.headY, HW = D.hw / 2, hz0 = -Math.floor(D.hd / 2) + D.headZ, hz1 = Math.ceil(D.hd / 2) + D.headZ;
  // (las orejas salen 1 por cada lado: en x la luz es de 2)
  const inHead = (x, y, z) => y >= hb && x >= -HW - 2 && x < HW + 2 && z >= hz0 - 1 && z < hz1 + 1;
  const [ax0, ax1] = armSpan(D);
  lay(v, 'armor');
  if (o.mantle) {
    // manto corto: una tapa sobre hombros y brazos, 1 vóxel por encima de la camisa, con los paños de adelante y
    // atrás colgando 3 filas a 1 vóxel de la tela y los costados cerrados sobre la cabeza del brazo (no la pisa)
    const fur = o.mantle === 'fur', X = ax1 + 1;
    for (let y = H - 3; y < H + (fur ? 2 : 1); y++) for (let x = -X; x < X; x++) for (let z = -hd - 1; z < hd + 1; z++) {
      const top = y >= H, wall = z === -hd - 1 || z === hd, side = (x === -X || x === X - 1) && y >= H - 2;
      if (!top && !wall && !side) continue;
      if (inHead(x, y, z) || (top && y >= hb - 1 && Math.abs(x + 0.5) < 3 && Math.abs(z + 0.5) < 3)) continue;   // el cuello
      if (z >= 0 && Math.abs(x + 0.5) < HW + 2) continue;   // abierto adelante del ancho de la cabeza (la barba cae por ahí)
      if (fur && y === H + 1 && !(wall || x === -X || x === X - 1)) continue;   // el pelo hace un ruedo arriba
      v.set(x, y, z, fur ? (y === H + 1 ? P.furL : (x + z + 99) % 3 === 0 ? P.furD : P.fur) : y === H - 3 ? P.clothDD : P.clothD);
    }
    if (!fur) for (const s of [-1, 1]) v.set(s < 0 ? -HW - 3 : HW + 2, H - 1, hd + 1, P.brass);   // broches
  }
  if (o.hood) {   // capucha caída: un cuello de tela alrededor de la nuca y un pliegue en la espalda
    if (hb > H) { for (let x = -5; x < 5; x++) for (let z = -hd - 1; z < 2; z++) if (x === -5 || x === 4 || z === -hd - 1) v.set(x, H, z, z === -hd - 1 ? P.clothD : P.cloth); }
    else {   // con la cabeza hundida, el cuello de tela rodea la cabeza (no se mete en ella)
      const X0 = -HW - 2, X1 = HW + 1, Z0 = Math.min(-hd - 1, hz0 - 2);
      for (let x = X0; x <= X1; x++) for (let z = Z0; z < 2; z++) if (x === X0 || x === X1 || z === Z0) v.set(x, H, z, z === Z0 ? P.clothD : P.cloth);
    }
    const zF = hb > H ? -hd - 1 : Math.min(-hd - 1, hz0 - 2);
    v.box(-4, H - 4, zF, 8, 4, 1, (x, y) => (y === H - 4 ? P.clothDD : P.clothD));
    if (zF < -hd - 1) v.box(-4, H - 4, zF + 1, 8, 1, -hd - 1 - zF, P.clothDD);   // se apoya en la espalda
  }
  if (o.highCollar) {   // cuello alto del archimago: detrás de la nuca, apoyado en la espalda
    const z0 = Math.min(-hd - 2, hz0 - 3);
    for (let y = H - 3; y < H + 4; y++) for (let x = -hw + 2; x < hw - 2; x++) for (let z = z0; z < -hd; z++) {
      if (inHead(x, y, z)) continue;
      v.set(x, y, z, y === H + 3 ? P.brass : P.clothDD);
    }
  }
  const pd = o.pauldron?.(P);
  if (pd) {
    // hombrera en la grilla del torso (no rota con el brazo): una tapa 1 vóxel por encima de la camisa, la placa de
    // afuera pegada a la cabeza del brazo y dos labios adelante y atrás, todo por fuera de lo que barre el brazo al
    // caminar. Las grandes (y las de los enanos, de hombros altos) suben una fila más.
    const big = o.bigPauldron || o.furPauldron || look.type === 'enano' ? 1 : 0;
    const z0 = -Math.floor(D.armW / 2) - 1, z1 = z0 + D.armW + 1;   // de un labio al otro (inclusive)
    for (const s of [-1, 1]) for (let y = H - 4; y <= H + big; y++) for (let x = ax0 - 1; x <= ax1; x++) for (let z = z0; z <= z1; z++) {
      const cap = y >= H, plate = x === ax1;
      if (!cap && !plate) continue;
      const rivet = !o.furPauldron && plate && y === H - 2 && (z - z0) % 2 === 1;
      const col = rivet ? ramp(P.brass, 0.8) : y === H - 4 ? ramp(pd, -1) : y === H + big ? ramp(pd, plate || z === z0 || z === z1 ? 1.5 : 0.8)
        : o.bigPauldron && y === H - 3 ? P.brassD : o.furPauldron && (x + y + z + 99) % 3 === 0 ? P.furD : pd;
      v.set(s > 0 ? x : -1 - x, y, z, col);
    }
  }
  // bolsos del cinturón: casi todos llevan algo colgado
  // bolso con tapa: el cuerpo, la tapa que sale 1 y cae sobre el frente, y el botón de bronce
  lay(v, 'outfit');
  const fzP = hd + (look.type === 'anuro' ? 1 : 0);
  const pouch = (s) => {
    const pw = hw >= 11 ? 4 : 3, x0 = s > 0 ? hw - pw - 1 : -hw + 1;
    v.box(x0, -2, fzP, pw, 5, 2, (x, y) => (y === -2 ? P.leatherD : y === 2 ? P.leatherL : P.leather));
    v.box(x0, 0, fzP + 2, pw, 3, 1, (x, y) => (y === 2 ? P.leatherL : y === 0 ? P.leatherD : P.leather));
    v.set(x0 + (pw >> 1), 0, fzP + 3, P.brass);
  };
  if (gear?.noPouch !== 'right' && (o.pouch === 'right' || o.pouch === 'both')) pouch(1);
  if (o.pouch === 'left' || o.pouch === 'both') pouch(-1);
  o.extra?.(v, D, P);
  lay(v, 'gear');
  gear?.body?.(v, D, P, look);
  lay(v, 'body');
}

/** Brazo (pivote en el hombro, cuelga hacia -Y). Mano grande: las 4 filas de abajo. */
export function drawArm(v, look, D, P) {
  const o = outfitOf(look.dress);
  const L = D.armL, a0 = -Math.floor(D.armW / 2), a1 = a0 + D.armW;
  const hand = o.glove === 'metal' ? P.metalD : o.glove ? P.leatherD : P.skin;
  const h0 = -Math.floor(D.hand / 2), h1 = h0 + D.hand;
  for (let r = 0; r < L; r++) {
    const y = -1 - r;
    if (r >= L - 4) {   // mano: un puño grande, con nudillos más oscuros adelante
      for (let x = h0; x < h1; x++) for (let z = h0; z < h1; z++) {
        if (bevel(x, z, h0, h1, h0, h1) && (r === L - 1 || r === L - 4)) continue;
        v.set(x, y, z, z === h1 - 1 && r === L - 3 ? shade(hand, -0.12) : r === L - 4 ? shade(hand, 0.06) : hand);
      }
      if (r === L - 3) v.box(h0 - 1, y, h1 - 3, 1, 2, 2, (x, yy) => (yy === y ? hand : shade(hand, -0.1)));   // pulgar, del lado del cuerpo
      continue;
    }
    if (o.glove && r === L - 5) {   // puño del guante: un aro más ancho que el brazo, con la luz arriba
      for (let x = a0 - 1; x < a1 + 1; x++) for (let z = a0 - 1; z < a1 + 1; z++) {
        if (bevel(x, z, a0 - 1, a1 + 1, a0 - 1, a1 + 1)) continue;
        v.set(x, y, z, o.glove === 'metal' ? P.metal : P.leather);
      }
      continue;
    }
    let col = o.sleeve(r, L - 4, P);
    if (col === 'skin') col = P.skin;
    // marca pintada (§8): una raya de 1 vóxel en la manga de tela, a 2 filas del puño, un tono más oscuro
    if (col === P.cloth && r === L - 4 - (o.glove ? 3 : 2)) col = P.clothD;
    const wide = o.wide && r >= L - 4 - o.wide ? 1 : 0;
    for (let x = a0 - wide; x < a1 + wide; x++) for (let z = a0 - wide; z < a1 + wide; z++) {
      if (bevel(x, z, a0 - wide, a1 + wide, a0 - wide, a1 + wide) && D.armW > 3) continue;
      v.set(x, y, z, lit(col, r === 0 ? 2 : r <= 2 ? 1 : wide && r === L - 5 ? -1 : 0));
    }
  }
  // la hombrera va en la grilla del torso (drawTorso): así no rota con el brazo ni queda debajo del hombro
}

/** Pierna (pivote en la cadera, hacia -Y). Bota ancha y con punta; los anuros, pie palmeado. */
export function drawLeg(v, look, D, P) {
  const o = outfitOf(look.dress);
  const L = D.legH, l0 = -Math.floor(D.legW / 2), l1 = l0 + D.legW, d0 = -Math.floor(D.legD / 2), d1 = d0 + D.legD;
  const bare = look.type === 'anuro';
  for (let y = 0; y < L; y++) {
    let col = o.leg(y, P);
    if (bare && y < 3) col = P.skin;
    if (col === 'skin') col = P.skin;
    const e = !bare && (col === P.boot || col === P.bootL) ? 1 : 0;   // la bota es más ancha que la pierna
    // la caña de la bota termina en un doblez de cuero que sale un vóxel más (afuera, adelante y atrás) con la luz arriba
    const cuff = e && col === P.bootL ? 1 : 0;
    for (let x = l0 - e; x < l1 + e + cuff; x++) for (let z = d0 - e - cuff; z < d1 + e + cuff; z++) {
      if (bevel(x, z, l0 - e, l1 + e + cuff, d0 - e - cuff, d1 + e + cuff) && y > 1) continue;
      v.set(x, y - L, z, cuff ? (z === d1 + e || x === l1 + e ? ramp(P.leather, 1) : P.leather) : col);
    }    if (look.type === 'vaciado' && y > 9 && y < 14) v.set(l1 - 1, y - L, d1 - 1, P.veinD);
  }
  if (bare) {   // pie ancho y palmeado, con tres dedos
    v.box(l0 - 2, -L, d0, D.legW + 4, 2, D.legD + 1, P.skin);
    for (const x of [l0 - 2, l0 + Math.floor(D.legW / 2), l1 + 1]) v.box(x, -L, d1 + 1, 1, 1, 2, P.skinD);
    v.box(l0 - 1, -L, d1 + 1, D.legW + 2, 1, 1, P.skin);
  } else {
    const t0 = o.leg(0, P), toe = t0 === 'skin' ? P.skin : t0, tl = D.toe || 2;
    // punta de la bota (los enanos, más larga), con la luz arriba y la suela más oscura que asoma
    v.box(l0 - 1, -L, d1 + 1, D.legW + 2, 2, tl, (x, y, z) => (y === -L + 1 ? (z === d1 + tl ? shade(toe, 0.04) : shade(toe, 0.1)) : toe));
    if (t0 === P.boot) v.box(l0 - 1, -L, d0 - 1, D.legW + 2, 1, D.legD + 2 + tl, (x, y, z) => (v.has(x, y, z) ? 0x1e1a1c : null));
  }
}

/**
 * Faldón: el panel de la pierna derecha (el izquierdo es el espejo). Va colgado del pivote de la pierna y gira con
 * ella, así la pierna nunca lo atraviesa al caminar; queda abierto adelante y atrás, entre los dos paneles. Se dibuja
 * centrado en la cadera (x = 0 es el medio del cuerpo, x ≥ 0 este lado) y arriba en y = 0.
 */
export function drawSkirt(v, look, D, P) {
  const o = outfitOf(look.dress);
  const sk = o.skirt;
  if (!sk) return;
  lay(v, 'armor');
  const len = sk.long ? D.legH - (sk.gap || 2) : Math.min(sk.len, D.legH - 3);
  const hw = D.W / 2, hd = Math.floor(D.D / 2) + (look.type === 'anuro' ? 1 : 0);
  const armIn = D.armX - Math.floor(D.armW / 2) - (o.wide ? 1 : 0), handY = handUp(D) + 3;
  for (let i = 0; i < len; i++) {
    const y = -1 - i, fy = len - 1 - i;   // fy: alto desde el ruedo
    const f = sk.flare ? Math.floor(i / sk.flare) : 0;
    const [lx, lz] = legReach(look, D, P, D.legH - 1 - i);
    let w = hw + f - (D.slim && !sk.long ? 1 : 0);
    if (D.legH - 1 - i < handY) w = Math.min(w, armIn - 1);
    w = Math.max(w, lx + 1);
    const d = Math.max(hd + f, lz + 1);
    for (let x = look.type === 'anuro' ? 1 : 0; x < w; x++) for (let z = -d; z < d; z++) {
      const edge = x === w - 1 || z === -d || z === d - 1;
      if (!edge || bevel(x, z, -w, w, -d, d)) continue;
      const c = { x, y: fy, z, hw: w, hd: d, front: z === d - 1, back: z === -d, side: x === w - 1 };
      const col = sk.col(fy, len, P, c);
      // arriba, la sombra que tira el cinturón; en las faldas largas, pliegues verticales de 1 en sombra cada 4
      // columnas que se abren hacia el ruedo (tonos en bloque: no hay ruido)
      const fold = len >= 8 && (c.front || c.back) && i >= 2 && fy >= 1 && (x + 99 + (i > len / 2 ? 1 : 0)) % 4 === 1;
      if (col != null) v.set(x, y, z, fold ? ramp(col, -0.7) : lit(col, i === 0 ? -1 : 0));
    }
  }
}

/** Hasta dónde llega la pierna derecha (con la bota y su doblez) en la fila yy desde el piso: [x, z] de la primera celda libre. */
function legReach(look, D, P, yy) {
  const o = outfitOf(look.dress), col = o.leg(yy, P);
  const e = look.type !== 'anuro' && (col === P.boot || col === P.bootL) ? 1 : 0, cuff = e && col === P.bootL ? 1 : 0;
  return [Math.ceil(D.hip + D.legW - Math.floor(D.legW / 2) + e + cuff), D.legD - Math.floor(D.legD / 2) + e + cuff];
}

/** Capa (pivote arriba de la espalda): dos tonos, con pliegues verticales. */
export function drawCape(v, look, D, P) {
  const hw = D.W / 2 + D.sh - 1, len = D.legH + D.H - 4;
  for (let i = 0; i < len; i++) for (let x = -hw - Math.floor(i / 10); x < hw + Math.floor(i / 10); x++) {
    if (i === len - 1 && (x + 99) % 3 === 0) continue;   // ruedo gastado
    const pleat = (x + 99) % 4 === 0;
    v.set(x, -1 - i, pleat ? -2 : -1, i >= len - 2 || pleat ? P.clothDD : P.clothD);
  }
}

/** Cola de la gente-zorro (pivote en la base, hacia atrás y abajo): grande, con la punta clara. */
export function drawTail(v, look, D, P) {
  // un cilindro grueso que baja hacia atrás y sube en curva al final (no una pila de rodajas): radio que crece hasta el
  // medio y se afina en la punta, lomo un tono más claro que los costados y el último cuarto crema
  const N = 28;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const z = -t * 14, y = -8 * t + 13 * t * t * t, x = 6 * t * t;   // se abre hacia un costado: entra en la silueta
    const r = 1.8 + Math.sin(Math.min(1, t * 1.25) * Math.PI) * 2.1 + (t > 0.8 ? -(t - 0.8) * 4 : 0);
    const tip = t > 0.74;
    v.sphere(x - 0.5, y, z, r, r, r, (xx, yy) => (tip ? (yy > y + r * 0.4 ? P.cream : ramp(P.cream, -0.6)) : yy > y + r * 0.35 ? P.skinL : yy < y - r * 0.5 ? P.skinD : P.skin));
  }
}

// ---------------- Cabeza ----------------
// Grilla: x en [-W, W), y en [0, hh), z en [zb, fz]. La cara mira a +Z (capa z = fz); lo que sale va en fz+1, fz+2...
function headBox(v, D, P, look) {
  const W = D.hw / 2, Dz = Math.ceil(D.hd / 2), zb = -Math.floor(D.hd / 2), hh = D.hh;
  const t = look.type;
  for (let y = 0; y < hh; y++) for (let x = -W; x < W; x++) for (let z = zb; z < Dz; z++) {
    const cx = x === -W || x === W - 1, cz = z === zb || z === Dz - 1;
    if (cx && cz) continue;
    if (y === hh - 1 && (cx || cz)) continue;
    if (y === hh - 1 && (x === -W + 1 || x === W - 2) && (z === zb + 1 || z === Dz - 2)) continue;   // cráneo redondeado, no una caja
    if (y === 0 && cx && (D.slim || t === 'zorro')) continue;
    if (t === 'anuro' && (y === hh - 1 || y === 0) && (x <= -W + 1 || x >= W - 2 || z <= zb + 1)) continue;
    let col = P.skin;
    if (t === 'anuro' && y <= 1) col = P.cream;   // garganta clara
    // máscara de la gente-zorro: mejillas y quijada crema, que suben por los costados hasta debajo del ojo
    if (t === 'zorro' && ((y <= 2) || (y <= 4 && Math.abs(x + 0.5) >= W - 2)) && z >= zb + 3) col = P.cream;
    v.set(x, y, z, y >= hh - 2 ? shade(col, 0.06) : col);
  }
  return { W, fz: Dz - 1, zb };
}
const EYE_S = { humano: 5, enano: 6, orco: 5, zorro: 6, vaciado: 5, anuro: 9 };
const EYE_B = { humano: 6, enano: 7, orco: 6, zorro: 7, vaciado: 6, anuro: 11 };
/** Fila de arriba del ojo (desde el mentón) y alto del ojo: con la cabeza grande, el ojo negro pasa a 2 × 3. */
const eyeRow = (t) => (bigHead() ? EYE_B : EYE_S)[t] ?? 6;
const eyeTall = (t) => (bigHead() && t !== 'anuro' ? 3 : 2);
const EYE = new Proxy({}, { get: (o, t) => eyeRow(t) });
const EYE_INK = keepFlat(0x141114);   // ojos negros (nada más oscuro que ~#101010); no varían por vóxel
const BEARDS = new Set(['barba_corta', 'barba_larga', 'barba_trenzada', 'bigote']);

/** Ojos (malla aparte para parpadear): lista de [x, y, z, color]. */
export function eyeVoxels(look, D, P) {
  const t = look.type, W = D.hw / 2, fz = Math.ceil(D.hd / 2) - 1;
  const ey = EYE[t] ?? 6;
  const out = [];
  if (t === 'anuro') {   // en el frente de los ojos saltones: iris dorado con pupila horizontal
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -W + 1 : W - 5;
      for (let x = x0; x < x0 + 4; x++) for (const y of [ey, ey + 1]) out.push([x, y, fz - 1, x > x0 && x < x0 + 3 ? EYE_INK : P.iris]);   // ojo negro de 2 × 2 con el aro dorado
    }
    return out;
  }
  // plantilla de cara (docs/ARTE-PERSONAJES.md §2): ojo negro de 2 × 2, bien marcado contra la piel, bajo el ceño que
  // sale y le hace sombra. Separados por el puente de la nariz (2 vóxeles; en los orcos, 4). Los Vaciados, con el
  // brillo de la veta.
  const inner = t === 'orco' ? 2 : 1;
  for (const s of [-1, 1]) {
    const xi = s < 0 ? -inner - 1 : inner, xo = s < 0 ? xi - 1 : xi + 1;
    if ((look.face === 'cicatriz_ojo' || look.face === 'parche') && s < 0) continue;
    const c = t === 'vaciado' ? P.iris : EYE_INK;
    for (let y = ey - eyeTall(t) + 1; y <= ey; y++) out.push([xi, y, fz, c], [xo, y, fz, c]);
  }
  return out;
}

/** Cabeza completa: cráneo, cara con volumen, orejas, pelo (lo quieto), barba o marcas y lo que lleva en la cabeza. */
export function buildHead(v, look, D, P) {
  const t = look.type;
  const { W, fz, zb } = headBox(v, D, P, look);
  const hh = D.hh, ey = EYE[t] ?? 6;
  // cejas del color del pelo aunque esté rapado, un poco más oscuras y apagadas (pegadas al ojo, un cobre vivo se
  // leía como párpado colorado)
  const browC = t === 'vaciado' ? P.skinDD : mix(P.hairD, 0x2a2224, 0.35);
  keepFlat(browC, P.lid, P.lip);   // cejas, cuencas y boca van lisas: la cara se lee por contraste
  if (t === 'anuro') {
    // ojos saltones que salen por arriba de la cabeza, boca de lado a lado con labio, fosas
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -W + 1 : W - 5;
      v.box(x0, ey - 3, fz - 5, 4, 6, 5, (x, y) => (y >= ey + 2 ? P.skinL : P.skin));
      v.box(x0 + 1, ey + 3, fz - 4, 2, 1, 3, P.skinL);
      v.box(x0, ey + 2, fz, 4, 1, 1, P.skinD);   // párpado pesado: mirada seria
    }
    for (let x = -W + 1; x < W - 1; x++) { v.set(x, 2, fz + 1, P.skin); v.set(x, 1, fz, P.skinDD); }   // labio y comisura
    v.set(-W + 1, 1, fz + 1, P.skinDD); v.set(W - 2, 1, fz + 1, P.skinDD); v.set(-W + 1, 0, fz, P.skinDD); v.set(W - 2, 0, fz, P.skinDD);
    for (const x of [-2, 1]) v.set(x, 4, fz + 1, P.skinDD);   // fosas
  } else if (t === 'zorro') {
    // Hocico de 6 que se afina en tres escalones (de frente se ven los anillos, no un agujero), lomo naranja, quijada
    // crema, nariz chica negra arriba de la punta; ceño naranja oscuro y una línea oscura del ojo al hocico.
    const MZ = [[6, 4, 2], [4, 3, 2], [2, 2, 2]];   // ancho, alto, largo de cada tramo
    let z = fz + 1;
    for (const [w, h, len] of MZ) {
      v.box(-w / 2, 1, z, w, h, len, (x, y) => (y === 1 ? P.cream : y === h ? P.skinL : P.skin));
      z += len;
    }
    v.box(-1, 2, z, 2, 1, 1, P.ink);   // nariz: 2 × 1 en la punta, arriba
    v.box(-2, 0, fz + 1, 4, 1, 3, P.cream);   // quijada
    for (let zz = fz + 1; zz < z; zz++) for (const x of [-2, 1]) if (zz < fz + 5) v.set(x < 0 ? x - (zz < fz + 3 ? 1 : 0) : x + (zz < fz + 3 ? 1 : 0), 1, zz, P.skinDD);   // boca
    for (const s of [-1, 1]) {
      const xe = s < 0 ? -W - 1 : W;
      v.box(xe, 1, fz - 4, 1, 3, 3, (x, y) => (y >= 3 ? P.skin : P.cream));   // cachetes de pelo, pegados a la cara
      v.set(xe + s, 1, fz - 3, ramp(P.cream, -0.6));
      // ceño: naranja oscuro, más bajo adentro
      const xi = s < 0 ? -2 : 1, xo = s < 0 ? -4 : 3;
      for (let x = Math.min(xi, xo); x <= Math.max(xi, xo); x++) v.set(x, ey + 2, fz + 1, P.skinD);
      v.set(xi, ey + 1, fz + 1, P.skinDD); v.set(xi, ey, fz + 1, P.skinDD); v.set(s < 0 ? -3 : 2, ey + 1, fz + 1, P.skinDD);   // ceja oscura que baja adentro sobre el ojo
      v.set(xi, ey - eyeTall(t), fz, P.skinDD);   // lágrima oscura hacia el hocico
      // oreja: triángulo grande hacia arriba y un poco afuera, el adentro oscuro y la punta negra
      for (let r = 0; r < 8; r++) {
        const w = r < 2 ? 4 : r < 4 ? 3 : r < 6 ? 2 : 1, x0 = s < 0 ? -W + (r >> 2) : W - w - (r >> 2);
        for (let x = x0; x < x0 + w; x++) {
          const edge = x === x0 || x === x0 + w - 1;
          v.set(x, hh + r, -2, r >= 6 ? P.ink : P.skinD);
          v.set(x, hh + r, -1, r >= 6 ? P.ink : !edge && r < 5 ? P.skinDD : P.skin);
        }
      }
    }
  } else {
    // Plantilla de cara (docs/ARTE-PERSONAJES.md §2). La cara se lee por planos y sombras, no por líneas pintadas:
    //   fila ey+1: ceño que sale 1 vóxel de lado a lado, con las cejas del color del pelo justo encima del ojo
    //              (sin piel entre ceja y ojo: así se ve serio). Enanos y orcos: el extremo de afuera sube (gesto duro).
    //   fila ey:   ojo de 2 × 1 sin blanco: pupila oscura adentro y la sombra del párpado afuera; entre los ojos, el
    //              puente de la nariz (2 vóxeles, que sale 1)
    //   filas 3..4: nariz que sale 1 y la punta 2, con la luz arriba; fila 1: boca corta (no va con barba); fila 0: mentón
    const big = t === 'enano' ? 1 : 0, inner = t === 'orco' ? 2 : 1, gruff = t === 'enano' || t === 'orco';
    for (let x = -W + 1; x < W - 1; x++) v.set(x, ey + 1, fz + 1, Math.abs(x + 0.5) < inner ? P.skinL : P.skin);   // arco del ceño
    for (const s of [-1, 1]) {
      const n = 3 + big;
      for (let i = 0; i < n; i++) {
        const x = s < 0 ? -inner - 1 - i : inner + i, outer = i === n - 1;
        // cejas gruesas (2 filas) que bajan adentro y le tapan al ojo negro la esquina de adentro: le dan ceño (sin
        // ceja encima, el ojo negro se ve vacío). Enanos y orcos, en V: la punta de afuera sube
        const y0 = ey + 1 - (gruff && i === 0 ? 1 : 0) + (gruff && outer ? 1 : 0);   // humanos: recta (serio sin enojo)
        v.set(x, y0, fz + 1, browC);
        if (!outer || gruff) v.set(x, y0 + 1, fz + 1, i === 0 ? browC : P.hairD);
        if (gruff && outer) v.set(x, ey + 1, fz + 1, P.skinD);
      }
    }
    v.box(-1, 3, fz + 1, 2, ey - 2, 1, P.skin);   // puente y cuerpo de la nariz
    // punta (la luz la pone la escena); los enanos, colorada y ancha
    // con la cabeza grande la punta es de 2 de alto y sale 2: la nariz se lee de frente y de perfil
    v.box(-1 - big, 3 - big, fz + 2, 2 + 2 * big, 1 + big + (bigHead() ? 1 : 0), 1, big ? mix(P.skin, 0xb04838, 0.35) : P.skin);
    if (big) v.box(-2, 2, fz + 1, 4, 2, 1, P.skin);
    v.set(-2 - big, 3 - big, fz, P.skinD); v.set(1 + big, 3 - big, fz, P.skinD);   // aletas: sombra al costado
    if (!BEARDS.has(look.face)) for (let x = -1; x < 1; x++) v.set(x, 1, fz, P.lip);   // boca: una línea corta
    v.box(-2, 0, fz + 1, 4, 1, 1, P.skin);   // mentón
    if (t === 'vaciado') { v.set(-W + 1, 3, fz, P.skinDD); v.set(W - 2, 3, fz, P.skinDD); for (let y = 2; y < ey; y++) v.set(W - 3, y, fz, P.veinD); }
    for (const s of [-1, 1]) {
      const xe = s < 0 ? -W - 1 : W;
      const eo = ey - 5;   // las orejas van de la ceja a la base de la nariz: con la cabeza grande suben con el ojo
      if (t === 'orco') { v.box(xe, 5 + eo, -2, 1, 3, 3, P.skin); for (let i = 1; i <= 3; i++) v.box(xe + s * i, 6 + eo + (i >> 1), -2, 1, 2, 2, i === 3 ? P.skinD : P.skin); }
      else if (bigHead()) {
        // oreja grande que sale 2: la de afuera de 4 × 3 con el borde claro y la hendija oscura, y un lóbulo
        v.box(xe, 2 + eo, -2, 1, 5, 4, P.skin);
        v.box(xe + s, 3 + eo, -2, 1, 4, 3, (x, y) => (y === 6 + eo ? P.skinL : P.skin));
        v.set(xe + s, 4 + eo, -1, P.skinDD); v.set(xe + s, 5 + eo, -1, P.skinD); v.set(xe, 2 + eo, 1, P.skinD);
      }
      else { v.box(xe, 3, -1, 1, 4, 3, P.skin); v.set(xe, 4, 0, P.skinD); v.set(xe, 5, 0, P.skinD); }
    }
    if (t === 'orco') {
      // frente pesada: una fila sobre las cejas que sale 1 (el ceño no sale 2: taparía el ojo desde la cámara)
      for (let x = -W + 1; x < W - 1; x++) if (!v.has(x, ey + 2, fz + 1)) v.set(x, ey + 2, fz + 1, P.skin);
      // nariz chata y ancha, con las fosas oscuras
      v.box(-2, 3, fz + 1, 4, 2, 1, (x, y) => (y === 4 ? P.skinL : P.skin)); v.box(-1, 3, fz + 2, 2, 1, 1, P.skin);
      v.set(-2, 3, fz + 1, P.skinDD); v.set(1, 3, fz + 1, P.skinDD);
      // mandíbula adelantada: sale 2 abajo, con la boca como una línea oscura
      v.box(-W + 1, 0, fz + 1, 2 * W - 2, 2, 2, (x, y, z) => (z === fz + 2 && y === 1 ? P.skinL : P.skin));
      for (let x = -3; x < 3; x++) v.set(x, 2, fz + 1, P.lip);
      v.set(-W + 1, 2, fz + 1, P.skinD); v.set(W - 2, 2, fz + 1, P.skinD);
      for (const x of [-4, 3]) v.box(x, 2, fz + 2, 1, 3, 1, (xx, y) => (y === 4 ? P.bone : ramp(P.bone, -0.8)));   // colmillos
    }
  }
  // cuencas: los ojos van en otra malla (parpadean); atrás queda el párpado cerrado
  for (const [x, y, z] of eyeVoxels(look, D, P)) { v.remove(x, y, z); v.set(x, y, z - 1, P.lid); }
  drawHair(v, look, D, P, { W, fz, zb });
  drawFace(v, look, D, P, { W, fz, zb, ey });
  drawHat(v, look, D, P, { W, fz, zb });
}

// ---------------- Pelo ----------------
const HAIR_SHAPES = {
  rapado: { stubble: true },
  cortito: { cap: 2, side: 7, back: 3, fringe: 1 },
  despeinado: { cap: 2, side: 6, back: 3, fringe: 2, spikes: true },
  coleta: { cap: 1, side: 7, back: 3, fringe: 1, swing: 'coleta' },
  largo: { cap: 2, side: -2, back: -6, fringe: 2, long: true },
  corto: { cap: 2, side: 2, back: 1, fringe: 2 },
  flequillo: { cap: 2, side: 6, back: 3, fringe: 3, sweep: true },
  rodete: { cap: 1, side: 7, back: 4, fringe: 1, bun: true },
  jopo: { stubble: true, crest: true },
  trenzas: { cap: 1, side: 4, back: 0, fringe: 1, swing: 'trenzas' },
  rizos: { cap: 3, side: 3, back: 1, fringe: 2, curls: true },
  colitas: { cap: 1, side: 5, back: 2, fringe: 1, swing: 'colitas' },
  ondas: { cap: 2, side: -3, back: -7, fringe: 2, long: true, wavy: true },
  lomo: { spots: true }, cresta_piel: { ridge: true },
};
export const hairShape = (id) => HAIR_SHAPES[id] || HAIR_SHAPES.cortito;
/** Alto del pelo sobre el cráneo (para apoyar sombreros). */
export function hairTop(look, D) { const h = hairShape(look.hair); return D.hh + (h.cap || 0) + (h.crest ? 4 : 0); }

function drawHair(v, look, D, P, g) {
  const t = look.type, h = hairShape(look.hair), hh = D.hh, { W, fz, zb } = g;
  const dy = hh - 12;   // con la cabeza grande, las filas de los costados y la nuca suben lo mismo
  // mechones en bandas (sin ruido): base, sombra cada 3 columnas y luz arriba
  const hc = (x, y) => (y >= hh + (h.cap || 0) - 1 ? P.hairL : (x + 99) % 3 === 0 ? P.hairD : P.hair);
  const skinish = (c) => c === P.skin || c === shade(P.skin, 0.06);
  if (t === 'anuro') {
    if (h.spots) for (const [k, c] of v.map) {
      const [x, y, z] = k.split(',').map(Number);
      if (skinish(c) && y >= 4 && hash3(Math.floor((x + 99) / 3), 0, Math.floor((z + 99) / 3)) < 0.28) v.map.set(k, mix(P.skin, P.hair, 0.5));
    }
    if (h.ridge) for (let z = zb + 1; z < fz - 3; z++) for (let y = hh; y < hh + (z < zb + 5 ? 2 : 1); y++) { v.set(-1, y, z, P.hair); v.set(0, y, z, P.hairD); }
    return;
  }
  if (h.stubble) {
    const st = mix(P.skin, P.hair, 0.4);
    for (const [k, c] of v.map) { const [, y, z] = k.split(',').map(Number); if (y >= hh - 3 && z < fz - 1 && skinish(c)) v.map.set(k, st); }
    if (h.crest) for (let z = zb; z < fz + 1; z++) for (let y = hh; y < hh + 4 - (z === fz ? 2 : z === zb ? 1 : 0); y++) for (const x of [-1, 0]) v.set(x, y, z, x ? P.hairD : P.hair);
    return;
  }
  if (t === 'zorro') {   // melena entre las orejas y, si es largo, por la nuca
    for (let z = zb; z < fz; z++) for (let x = -1; x < 1; x++) { v.set(x, hh, z, hc(x, hh)); if (z < zb + 4) v.set(x, hh + 1, z, P.hairL); }
    for (let y = h.long ? -6 : 3; y < hh; y++) for (let x = -W + 2; x < W - 2; x++) v.set(x, y, zb - 1, hc(x, y));
    return;
  }
  for (let c = 0; c < (h.cap || 0); c++) for (let x = -W - (c ? 0 : 1); x < W + (c ? 0 : 1); x++) for (let z = zb - 1 + c; z < fz + 1 - c; z++) {
    if ((x === -W - 1 || x === W) && (z === zb - 1 || z === fz)) continue;
    v.set(x, hh + c, z, hc(x, hh + c));
  }
  if (h.curls) for (let x = -W; x < W; x += 2) for (let z = zb; z < fz; z += 2) v.box(x, hh + 3, z, 1, 1, 1, P.hairD);
  // mechones sueltos (§8): cubos que sobresalen del casquete a distintas alturas, en dos tonos; los rulos, el doble
  if (h.cap) {
    const yt = hh + h.cap - 1, pr = h.curls ? 0.5 : 0.2;
    for (let x = -W; x < W; x++) for (let z = zb; z < fz; z++) {
      if (!v.has(x, yt, z)) continue;
      const k = hash3(x + 31, yt, z + 17);
      if (k < pr) v.set(x, yt + 1, z, k < pr / 2 ? P.hairL : P.hair);
      if (h.curls && k < pr / 3) v.set(x, yt + 2, z, P.hairD);
    }
  }
  if (h.spikes) for (const [x, z] of [[-3, -1], [1, 1], [-1, -4], [3, -3], [0, 2], [-4, 2]]) v.box(x, hh + 2, z, 2, 2 - ((x + z) & 1), 1, P.hairL);
  for (const s of [-1, 1]) {
    const x = s < 0 ? -W - 1 : W;
    for (let y = h.side + (h.side > 0 ? dy : 0); y < hh + 1; y++) for (let z = zb - 1; z < (h.long ? fz - 1 : fz - 2); z++) {
      if (!h.long && y < 7 + dy && z > -3) continue;   // deja ver la oreja
      const wave = h.wavy && (y + 99) % 4 < 2 ? 1 : 0;
      v.set(x + s * wave, y, z, hc(z, y));
    }
  }
  for (let y = h.back + (h.back > 0 ? dy : 0); y < hh + 1; y++) for (let x = -W + (y < 0 ? 1 : 0); x < W - (y < 0 ? 1 : 0); x++) v.set(x, y, zb - 1, hc(x, y));
  if (h.long) for (let y = h.back; y < 4; y++) for (let x = -W + 1; x < W - 1; x++) v.set(x, y, zb - 2, (x + 99) % 3 === 0 ? P.hairD : P.hair);
  for (let i = 0; i < (h.fringe || 0); i++) {
    const y = hh - 1 - i;
    for (let x = -W; x < W; x++) {
      if (h.sweep && x > 1 - i * 2) continue;
      if (!h.sweep && i > 0 && Math.abs(x + 0.5) < W - 1) continue;
      v.set(x, y, fz + 1, hc(x, y));
      // flequillo en escalones: algunos mechones de 2 bajan uno más, con la punta oscura
      if (i === h.fringe - 1 && !h.sweep && h.fringe >= 2 && ((x + 99) >> 1) % 3 === 0 && Math.abs(x + 0.5) < W - 1) v.set(x, y - 1, fz + 1, P.hairD);
    }
  }
  if (h.bun) { v.box(-2, hh - 2, zb - 4, 4, 4, 3, (x, y) => hc(x, y)); v.box(-1, hh - 1, zb - 5, 2, 2, 1, P.hairD); v.box(-2, hh - 3, zb - 2, 4, 1, 1, P.leatherD); }
}

/** Pelo que se balancea: [{ at:[x,y,z], build(v), mirror, sway }] en coordenadas de la cabeza. */
export function hairSwings(look, D, P) {
  const h = hairShape(look.hair), W = D.hw / 2, zb = -Math.floor(D.hd / 2);
  if (!h.swing || look.type === 'anuro') return [];
  const hc = (i) => (i % 3 === 2 ? P.hairD : P.hair);
  if (h.swing === 'coleta') return [{ at: [0, D.hh - 1, zb - 1], sway: 1, build: (v) => { v.box(-1, -1, -2, 2, 2, 2, P.leatherD); for (let i = 0; i < 11; i++) v.box(-1 - (i > 2 && i < 8 ? 1 : 0), -2 - i, -2 - (i < 4 ? 1 : 0), 2 + (i > 2 && i < 8 ? 1 : 0), 1, 2, hc(i)); } }];
  if (h.swing === 'colitas') return [-1, 1].map(s => ({ at: [s * (W - 1), 4, zb], mirror: s < 0, sway: 0.8, build: (v) => { v.box(0, -1, -2, 2, 2, 2, P.leatherD); for (let i = 0; i < 9; i++) v.box(0, -2 - i, -2, 2, 1, 2, hc(i)); } }));
  // trenzas: caen adelante de los hombros, con lazo de cuero
  return [-1, 1].map(s => ({ at: [s * W, 3, -1], mirror: s < 0, sway: 0.6, build: (v) => {
    for (let i = 0; i < 13; i++) v.box(0, -1 - i, 0, 2, 1, 2, i === 10 ? P.leatherD : i % 2 ? P.hairD : P.hair);
    v.box(0, -14, 0, 2, 2, 2, P.hair);
  } }));
}

// ---------------- Cara: barbas (con volumen), cicatrices, pintura ----------------
function drawFace(v, look, D, P, g) {
  const f = look.face, { W, fz, ey } = g;
  if (!f || f === 'ninguna') return;
  // Barba como volumen (docs/ARTE-PERSONAJES.md §1): una masa que sale de la mandíbula con 3 tonos por altura (luz
  // arriba, base, punta oscura) y surcos cada 3 columnas solo en la cara de adelante; el bigote es un alero aparte, más
  // claro, que tapa la boca y cae en las puntas.
  // Pasada de detalle: degradé por capas con 5 tonos (luz en el centro y arriba, puntas y bordes oscuros), pintado en
  // bloques: mechones de 2 columnas que alternan medio tono y las capas de atrás un tono más oscuras.
  const T5 = [P.hairDD, P.hairD, P.hair, P.hairL, P.hairLL];
  const bc = (x, y, z, len) => {
    const ax = Math.abs(x + 0.5), d = Math.max(0, Math.min(1, (2 - y) / (len + 3)));
    let k = 3.5 - d * 2.6 + (ax < 1.5 ? 0.6 : 0) - (ax > W - 1.5 ? 0.9 : 0) - (z < fz + 1 ? 0.8 : 0);
    if (len > 3 && y < 2 && ((x + 99) >> 1) % 2) k -= 0.55;   // mechones
    // la barba corta se queda con 4 tonos: el más claro, en una barba chica, se lee como una mancha amarilla
    return T5[Math.max(0, Math.min(len > 3 ? 4 : 3, Math.round(k - (len > 3 ? 0 : 0.6))))];
  };
  const LL = len => (len > 3 ? P.hairLL : P.hairL);
  // largo de cada mechón: los del centro bajan más y las puntas quedan dentadas
  const jag = (x) => (Math.abs(x + 0.5) < 2 ? 0 : [1, 2, 0, 1][((x + 99) >> 1) % 4]);
  const beard = (len, braid) => {
    // mejillas y mandíbula: cubre la cara de la boca para abajo, salvo el labio de abajo
    for (let y = 0; y < 4; y++) for (let x = -W; x < W; x++) {
      if (y >= 1 && y <= 2 && Math.abs(x + 0.5) < 2) continue;   // boca
      if (y === 3 && Math.abs(x + 0.5) < W - 1) continue;   // de la nariz para arriba solo las patillas
      v.set(x, y, fz + 1, bc(x, y, fz + 1, len));
      if (y < 2) v.set(x, y, fz + 2, bc(x, y, fz + 2, len));
    }
    for (const s of [-1, 1]) for (let y = 1; y < ey - 1; y++) for (let z = fz - 3; z <= fz; z++) v.set(s < 0 ? -W - 1 : W, y, z, z === fz - 3 ? P.hairD : P.hair);   // patillas
    // bigote: alero de 6 que sale 2, con las puntas que caen
    // el bigote es lo más claro de la cara (le da la luz de arriba), con la raya del medio y las puntas que caen
    for (let x = -3; x < 3; x++) { v.set(x, 2, fz + 2, Math.abs(x + 0.5) < 1 ? (len > 3 ? P.hairL : P.hair) : LL(len)); v.set(x, 2, fz + 1, P.hairD); }
    for (const x of [-3, 2]) { v.set(x, 1, fz + 2, len > 3 ? P.hairL : P.hair); v.set(x, 0, fz + 3, P.hair); if (len > 3) v.set(x, -1, fz + 3, P.hairD); }
    v.set(-1, 1, fz + 1, P.hairD); v.set(0, 1, fz + 1, P.hairD);   // la boca queda tapada: con barba no se dibuja
    // largo: se angosta de a poco y sale hacia adelante (no es una caja colgada); en el centro abomba 1 más y cada
    // mechón termina a su altura, con la punta oscura
    for (let i = 0; i < len; i++) {
      const y = -1 - i, w = Math.max(2, W - Math.floor(i / 3) - (i === len - 1 ? 1 : 0));
      const z0 = fz - 3 + Math.min(2, i >> 2), z1 = fz + 2 - (i >= len - 2 ? 1 : 0);
      for (let x = -w; x < w; x++) {
        if (len > 3 && i > len - 1 - jag(x)) continue;
        const tipRow = len > 3 && i === len - 1 - jag(x);
        const bulge = len > 3 && Math.abs(x + 0.5) < 2 && i >= 1 && i < len - 2 ? 1 : 0;
        for (let z = z0; z <= z1 + bulge; z++) v.set(x, y, z, tipRow ? (z >= z1 ? P.hairD : P.hairDD) : bc(x, y, z, len));
      }
    }
    if (braid) for (let i = 0; i < 6; i++) v.box(-1, -1 - len - i, fz, 2, 1, 2, i === 1 || i === 4 ? P.brass : i === 5 ? P.hairD : P.hair);
  };
  if (f === 'barba_corta') beard(2);
  else if (f === 'barba_larga') beard(look.type === 'enano' ? 11 : 7);
  else if (f === 'barba_trenzada') beard(look.type === 'enano' ? 8 : 5, true);
  else if (f === 'bigote') { for (let x = -3; x < 3; x++) { v.set(x, 2, fz + 2, Math.abs(x + 0.5) < 1 ? P.hairL : P.hairLL); v.set(x, 2, fz + 1, P.hairD); } for (const x of [-4, 3]) { v.set(x, 1, fz + 1, P.hair); v.set(x, 0, fz + 1, P.hairD); } }
  else if (f === 'cicatriz') { for (let i = 0; i < 5; i++) v.set(W - 2 - (i >> 1), 1 + i, fz + (i === 2 ? 1 : 0), P.scar); }
  else if (f === 'cicatriz_ojo') { const x = look.type === 'orco' ? -3 : -2; for (let y = ey - 3; y <= ey + 3; y++) v.set(x, y, fz + (y === ey + 1 || y === ey + 2 ? 2 : 0), P.scar); v.set(x - 1, ey, fz, P.skinDD); v.set(x + 1, ey, fz, P.skinDD); }
  else if (f === 'pintura') {
    // pintura de guerra: una franja de ocre rojo de lado a lado justo debajo de los ojos y dos rayas que bajan por las
    // mejillas (no manchas oscuras bajo el ojo, que se leen como otro par de ojos)
    const PT = look.type === 'orco' || look.type === 'anuro' ? 0xb0a58a : 0x7a2e24;
    const yp = ey - eyeTall(look.type);   // justo debajo del ojo
    for (let x = -W; x < W; x++) if (Math.abs(x + 0.5) > 1) v.set(x, yp, x === -W || x === W - 1 ? fz - 1 : fz, PT);
    for (const x of [-W + 1, W - 2]) for (let y = yp - 2; y < yp; y++) v.set(x, y, fz, ramp(PT, -0.6));
  }
  else if (f === 'parche') {
    const x = look.type === 'orco' ? -3 : -2;
    const et = eyeTall(look.type);
    v.box(x - 1, ey - et + 1, fz + 1, 2, et, 1, P.ink); v.set(x - 1, ey - et, fz + 1, P.leatherD);   // parche chico sobre el ojo
    for (let i = 0; i < W * 2 + 2; i++) { const xx = -W - 1 + i; const yy = ey + 1 + Math.round(i * 0.25); v.set(xx, yy, xx < -W || xx >= W ? 0 : fz + 1, P.leatherD); }
  }
}

// ---------------- Cabeza: capuchas, sombreros, cascos ----------------
function ring(v, cy, r, z0, z1, col, cx = -0.5) {
  for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) for (let z = z0; z <= z1; z++) {
    const dx = x - cx, dz = z - (z0 + z1) / 2;
    if (dx * dx + dz * dz <= r * r) v.set(x, cy, z, typeof col === 'function' ? col(x, cy, z) : col);
  }
}
function drawHat(v, look, D, P, g) {
  const id = look.crown, { W, fz, zb } = g, hh = D.hh, top = hairTop(look, D);
  if (!id || id === 'ninguna') return;
  const zc0 = zb - 1, zc1 = fz + 1, R = W + 1;
  const shell = (y0, y1, col) => {
    for (let y = y0; y < y1; y++) for (let x = -W - 1; x < W + 1; x++) for (let z = zc0; z <= zc1; z++) {
      const out = x === -W - 1 || x === W || z === zc0 || z === zc1 || y === y1 - 1;
      if (!out || ((x === -W - 1 || x === W) && (z === zc0 || z === zc1))) continue;
      v.set(x, y, z, typeof col === 'function' ? col(x, y, z) : col);
    }
  };
  switch (id) {
    case 'capucha': {
      lay(v, 'armor');
      for (let y = 1; y < hh + 3; y++) for (let x = -W - 2; x < W + 2; x++) for (let z = zc0 - 1; z <= zc1; z++) {
        const out = x === -W - 2 || x === W + 1 || z === zc0 - 1 || y === hh + 2 || (z === zc1 && (Math.abs(x + 0.5) >= W - 1 || y >= hh));
        if (out && !((x === -W - 2 || x === W + 1) && z === zc0 - 1)) v.set(x, y, z, z === zc1 ? P.clothDD : y >= hh + 1 ? P.cloth : P.clothD);
      }
      // el paño que cae sobre la espalda: detrás del torso con 1 vóxel de luz (los orcos llevan la cabeza adelantada y
      // el torso hondo: antes se les metía en la espalda)
      const zBack = -Math.floor(D.D / 2) - D.headZ, zd = Math.min(zc0 - 1, zBack - 3);
      v.box(-W, -3, zd, 2 * W, 5, 2, P.clothD);
      if (zd < zc0 - 1) v.box(-W, 1, zd + 2, 2 * W, 1, zc0 - 1 - zd - 2, P.clothD);   // lo une a la capucha
      v.box(-1, hh + 2, zc0, 2, 1, 3, P.clothD);   // punta de la capucha
      lay(v, 'body');
      break;
    }
    case 'gorro': shell(hh - 3, top + 3, (x, y) => (y <= hh - 2 ? P.clothDD : y === top + 2 ? P.clothL : P.clothD)); v.box(-1, top + 3, -1, 2, 2, 2, P.clothD); break;
    case 'vincha': for (let x = -W - 1; x < W + 1; x++) for (let z = zc0; z <= zc1; z++) if (x === -W - 1 || x === W || z === zc0 || z === zc1) { v.set(x, hh - 3, z, P.leather); v.set(x, hh - 2, z, P.leatherL); }
      v.box(-1, hh - 6, zc0 - 1, 2, 4, 1, P.leatherD); break;
    case 'gorra': for (let y = top; y < top + 3; y++) ring(v, y, R + (y === top ? 1 : y === top + 2 ? -1 : 0), zc0 - 1, zc1, y === top + 2 ? P.clothL : P.clothD, 0.5); break;
    case 'bandana':
      // pañuelo de un solo color de acento (óxido) que se apoya arriba del ceño: no tapa la cara. Ruedo de lino,
      // nudo y dos puntas atrás. Si la ropa ya es roja, el pañuelo va carbón.
      {
        const [hc0, sc0] = hsl(P.cloth), red = (hc0 < 16 || hc0 > 340) && sc0 > 0.3, B = red ? 0x34302e : 0x7c3226;
        const y0 = (EYE[look.type] ?? 6) + 3;
        const yt = hh + 1;   // pegado al cráneo: una sola fila sobre la cabeza, aunque el pelo sea más alto
        shell(y0, yt + 1, (x, y) => (y === y0 ? ramp(B, -1) : y === yt ? ramp(B, 0.8) : B));
        v.box(-1, y0, zc0 - 1, 3, 3, 1, ramp(B, -1));
        v.box(-2, y0 - 5, zc0 - 1, 2, 5, 1, ramp(B, -0.5)); v.box(1, y0 - 4, zc0 - 1, 2, 4, 1, ramp(B, -1.5));
      }
      break;
    case 'sombrero_mago': {
      ring(v, top, R + 5, zc0 - 5, zc1 + 4, P.clothD); ring(v, top + 1, R + 3, zc0 - 3, zc1 + 2, P.clothDD);
      ring(v, top + 2, R, zc0, zc1, P.leatherD);
      for (let i = 0; i < 13; i++) { const r = Math.max(0.6, R - i * 0.5); ring(v, top + 3 + i, r, Math.round(zc0 + i * 0.4) - (i > 8 ? i - 8 : 0), Math.round(zc1 - i * 0.6) - (i > 8 ? (i - 8) * 2 : 0), i > 10 ? P.clothDD : P.clothD); }
      break;
    }
    case 'piluso': {
      ring(v, top, R + 6, zc0 - 6, zc1 + 6, (x, y, z) => ((x + z + 99) % 4 === 0 ? P.strawD : P.straw));
      for (let y = top + 1; y < top + 5; y++) ring(v, y, R - (y === top + 4 ? 1 : 0), zc0, zc1, y === top + 1 ? 0x5a2a22 : y === top + 4 ? shade(P.straw, 0.1) : P.straw);
      break;
    }
    case 'galera': {
      ring(v, top, R + 4, zc0 - 4, zc1 + 4, P.leatherD); ring(v, top + 1, R + 3, zc0 - 3, zc1 + 3, P.leatherD);
      for (let y = top + 1; y < top + 6; y++) ring(v, y, R - 0.5, zc0, zc1, y === top + 2 ? P.brassD : y === top + 5 ? P.leatherL : P.leather);
      v.box(-1, top + 5, -2, 2, 1, 4, P.leatherD);
      break;
    }
    case 'casco': case 'yelmo': {
      // casco redondo: aro sobre las cejas, cúpula que se cierra arriba, nasal y una cresta
      ring(v, hh - 4, R + 0.6, zc0 - 1, zc1, P.metalD);
      for (let y = hh - 3; y < top + 4; y++) {
        const r = R + 0.3 - Math.max(0, y - top) * 1.3;
        if (r < 1) break;
        ring(v, y, r, zc0 + Math.max(0, y - top), zc1 - Math.max(0, y - top), y >= top + 1 ? P.metalL : P.metal);
      }
      v.box(-1, EYE[look.type] ?? 5, zc1 + 1, 2, hh - 4 - (EYE[look.type] ?? 5), 1, P.metalD);   // nasal corto: deja ver la nariz
      for (const x of [-W - 1, W]) v.box(x, 2, fz - 3, 1, hh - 6, 3, P.metal);   // carrilleras
      v.box(-1, top + 2, zc0 + 1, 2, 2, zc1 - zc0 - 1, P.brassD);   // cresta
      if (id === 'yelmo') for (const s of [-1, 1]) for (let i = 0; i < 9; i++) {
        const x = s < 0 ? -W - 2 - Math.min(i, 4) : W + 1 + Math.min(i, 4), y = hh - 3 + Math.max(0, i - 3);
        v.box(x, y, -1, 1, 2, 2, i > 6 ? P.bone : mix(P.bone, 0x6a5a44, 0.35));
      }
      break;
    }
  }
}

// ---------------- Equipo ----------------
// Cada pieza dice dónde va: hand (mano derecha), off (mano izquierda), body (en el cuerpo). pose: brazos en radianes.
// Coordenadas de la mano: brazo de largo L, el puño en y = -L .. -L+4 (centro y = HY), ancho D.hand. En las dos manos
// +x es hacia afuera del cuerpo (la izquierda se dibuja igual y se espeja).
// Regla de anclaje (plan de La Travesía, 1a): nada de lo que se sostiene pasa por el puño ni por el brazo. Lo que sale
// hacia adelante arranca en front(D), la primera celda libre delante del puño; lo largo va parado delante del puño,
// desde zf(D), que deja libre también el puño del guante y la manga ancha, y se inclina con su propia pose (grip: rx
// hacia adelante, ry gira la cara hacia afuera, rz inclina hacia afuera, en radianes, girando en el puño). Los largos salen del cuerpo (handUp, tallOf) y la
// punta de abajo nunca llega al piso.
const HY = (D) => -D.armL + 2;
const front = (D) => Math.ceil(D.hand / 2);
const back = (D) => -Math.floor(D.hand / 2) - 1;   // primera celda libre detrás del puño
export const zf = (D) => Math.max(front(D), Math.ceil(D.armW / 2) + 2);
/** Alto del centro del puño sobre el piso con el brazo colgando, y alto de la figura sin sombrero. */
export const handUp = (D) => D.legH + D.H - D.armL;
export const tallOf = (D) => D.legH + D.H + D.neck - D.headY + D.hh;
/** Dónde gira la pieza que se sostiene (centro del astil, a la altura del puño). */
export const gripAt = (D) => [0, HY(D), zf(D) + 1];
function blade(v, D, len) {
  const y = HY(D), z0 = front(D);
  v.box(-1, y - 1, back(D) - 1, 2, 2, 2, MAT.brassD);   // pomo
  v.box(-3, y - 1, z0, 6, 2, 1, MAT.brass);   // guarda
  for (let i = 0; i < len; i++) v.box(-1, y - 1, z0 + 1 + i, 2, 3 - (i === len - 1 ? 1 : 0), 1, (x, yy) => (yy === y + 1 ? MAT.metalL : x === 0 ? MAT.metal : MAT.metalD));
}
/** Mango que cruza el puño de atrás hacia adelante (martillo): lo que queda adentro del puño no se dibuja. */
const haft = (v, D, z0, z1) => { const y = HY(D); for (let z = z0; z < z1; z++) if (z <= back(D) || z >= front(D)) v.box(-1, y - 1, z, 2, 2, 1, (z + 99) % 5 === 0 ? MAT.leatherD : MAT.wood); };
/** Astil parado delante del puño, de y0 a y1, con la empuñadura de cuero que toca el puño. */
function pole(v, D, y0, y1, col) {
  const y = HY(D), z = zf(D);
  for (let yy = y0; yy < y1; yy++) v.box(-1, yy, z, 2, 1, 2, typeof col === 'function' ? col(yy) : col);
  // la mano lo agarra: la empuñadura llena la luz entre el puño y el astil en las filas del puño
  v.box(-1, y - 2, front(D), 2, 4, z - front(D), (x, yy) => ((yy + 99) % 2 ? MAT.leatherD : MAT.leather));
}
/** Cuánto baja lo largo debajo del puño sin tocar el piso (con la inclinación y el paso). */
const reach = (D, k = 0.75, gap = 3) => Math.max(4, Math.min(Math.round(D.armL * k), handUp(D) - gap));
export const GEAR = {
  espada: { hand: (v, D) => blade(v, D, Math.round(D.armL * 0.9)), pose: { rx: -0.5, rz: 0.12 } },
  hacha: { hand: (v, D) => {
    // hacha grande parada al costado: la hoja de medialuna mira hacia afuera (se lee de frente, no de canto) y del lado
    // del cuerpo no sale nada. Mango con la empuñadura de cuero, anillos de metal y un regatón abajo; la hoja con 3
    // tonos (sombra junto al ojo, base y el filo claro).
    const y = HY(D), hz = zf(D), top = y + Math.round(D.armL * 1.1), low = y - reach(D, 0.6, 4);
    pole(v, D, low, top, (yy) => (yy === top - 12 ? MAT.metalL : (yy + 99) % 6 === 0 ? MAT.woodD : MAT.wood));
    for (const ry of [y - 5, y + 5]) v.box(-2, ry, hz, 4, 1, 3, MAT.metal);   // anillos
    v.box(-2, low - 2, hz, 4, 2, 3, MAT.metalD);   // regatón
    v.box(-2, top - 8, hz - 1, 4, 8, 4, (x, yy) => (yy === top - 1 ? MAT.metalL : yy === top - 8 ? MAT.metalD : MAT.metal));   // ojo
    v.box(-1, top, hz, 2, 2, 2, MAT.metalD);
    const hl = Math.max(9, Math.round(D.armL * 0.8));   // alto de la hoja
    for (let i = 0; i < hl; i++) {   // cuello angosto junto al ojo y la hoja que se abre arriba y abajo (medialuna)
      const m = (hl - 1) / 2, d = Math.abs(i - m) / m, yy = top - 4 - Math.round(m) + i;
      const xA = 2 + (d > 0.3 ? 2 : 0) + (d > 0.75 ? 1 : 0), xB = 9 + (d < 0.5 ? 1 : 0) - (d > 0.85 ? 1 : 0);
      for (let x = xA; x < xB; x++) v.box(x, yy, hz, 1, 1, 2, x >= xB - 2 ? MAT.metalL : x === xB - 3 ? MAT.metalD : x === xA || d >= 0.99 ? MAT.metalD : MAT.metal);
    }
    v.box(2, top - 4, hz - 1, 1, 1, 1, MAT.brass); v.box(2, top - 4, hz + 2, 1, 1, 1, MAT.brass);   // remaches de la hoja
  }, pose: { rx: 0, rz: 0.1 }, grip: { rx: 0.16, rz: -0.2 }, still: true },
  martillo: { hand: (v, D) => {
    const y = HY(D), z0 = front(D);
    haft(v, D, back(D) - 2, z0 + 13);
    v.box(-3, y - 4, z0 + 11, 6, 7, 6, (x, yy, z) => (yy === y + 2 ? MAT.metalL : z === z0 + 11 || z === z0 + 16 ? MAT.metalD : MAT.metal));
    v.box(-2, y - 3, z0 + 10, 4, 5, 1, MAT.brassD);
  }, pose: { rx: -0.4, rz: 0.14 } },
  lanza: { hand: (v, D) => {   // más alta que quien la lleva, con la moharra arriba
    const y = HY(D), hz = zf(D), top = y + tallOf(D) - handUp(D) + 4;
    pole(v, D, y - reach(D, 0.9), top, (yy) => ((yy + 99) % 6 === 0 ? MAT.leatherD : MAT.wood));
    for (let i = 0; i < 7; i++) v.box(-1 - (i < 3 ? 1 : 0), top + i, hz, i < 3 ? 4 : 2, 1, 2, i === 6 ? MAT.metalL : MAT.metal);
    v.box(-2, top - 2, hz - 1, 4, 2, 4, MAT.leatherD);
  }, pose: { rx: 0, rz: 0.1 }, grip: { rx: 0.1, rz: -0.18 }, still: true },
  baston: { hand: (v, D) => {   // bastón alto con un nudo y la piedra de veta arriba, a la altura de la cabeza
    const y = HY(D), hz = zf(D), top = y + tallOf(D) - handUp(D) - 3;
    pole(v, D, y - reach(D, 0.9), top, (yy) => ((yy + 99) % 7 === 0 ? MAT.woodD : MAT.wood));
    v.box(-2, top, hz - 1, 4, 3, 4, MAT.woodD); v.box(-1, top + 3, hz, 2, 3, 2, MAT.vein);
    v.box(-2, top + 2, hz, 1, 2, 1, MAT.woodD); v.box(1, top + 2, hz + 1, 1, 3, 1, MAT.woodD);
  }, pose: { rx: 0, rz: 0.1 }, grip: { rx: 0.1, rz: -0.18 }, still: true },
  libro: { off: (v, D) => {
    const y = HY(D), z0 = zf(D) - 1;
    v.box(-4, y - 3, z0, 8, 7, 3, (x, yy, z) => (z === z0 + 1 && x > -4 && x < 3 && yy > y - 3 && yy < y + 3 ? MAT.linen : yy === y + 3 ? MAT.leatherL : MAT.leatherD));
  }, pose: { lx: -0.6, lz: -0.05 }, offStill: true },
  escudo: { off: (v, D) => {
    // escudo redondo de tablas con aro y umbo de metal, al costado de la cadera: mira hacia adelante y queda corrido
    // hacia afuera, así no tapa la riñonera ni lo pisa la pierna al caminar
    const z0 = zf(D), cy = HY(D) + 2, r = Math.max(5, Math.min(8, Math.round(D.H * 0.4))) + 0.8;
    const clear = Math.max(D.W / 2, D.hip + Math.ceil(D.legW / 2) + 2) + 1, cx = Math.max(0, Math.ceil(r - (D.armX - clear)));
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) continue;
      v.set(x, y, z0, d > r - 1.2 ? MAT.metalD : d < 2.2 ? MAT.metalL : (x + 99) % 4 === 0 ? MAT.woodD : MAT.wood);
      if (d < 2.2) v.set(x, y, z0 + 1, MAT.metal);
    }
    v.box(-1, HY(D) - 1, front(D), 2, 2, z0 - front(D), MAT.leatherD);   // la correa que agarra el puño
  }, pose: { lz: -0.2 } },
  arco: { off: (v, D) => {
    // arco parado en la mano: la empuñadura toca el puño, las palas se curvan hacia adelante y la cuerda va delante de
    // todo, con luz entre la cuerda y la madera. Gira hacia afuera (grip.ry) para que la curva se lea de frente
    const y0 = HY(D), z0 = zf(D), n = Math.min(Math.round(D.armL * 0.95), handUp(D) - 4), k = 6;
    for (let i = -n; i <= n; i++) {
      const t = Math.abs(i) / n, z = z0 + Math.round((1 - Math.cos(t * Math.PI / 2)) * k);
      v.box(-1, y0 + i, z, 2, 1, t > 0.5 ? 2 : 1, Math.abs(i) < 3 ? MAT.leatherD : t > 0.85 ? MAT.woodD : MAT.wood);
      if (Math.abs(i) < n) v.set(0, y0 + i, z0 + k + 1, MAT.linen);
    }
    v.box(-1, y0 - n, z0 + k, 2, 1, 2, MAT.woodD); v.box(-1, y0 + n, z0 + k, 2, 1, 2, MAT.woodD);   // las puntas atan la cuerda
    v.box(-1, y0 - 2, front(D), 2, 4, z0 - front(D), MAT.leatherD);
  }, pose: { lz: -0.16 }, grip: { rx: 0, ry: 0.85, rz: -0.08 } },
  farolito: { hand: (v, D) => {
    const y = HY(D) - 3, h = Math.max(4, Math.min(8, handUp(D) - 7));   // cuelga debajo del puño; en los bajos, más chico
    v.box(-1, y - 1, -1, 2, 2, 2, MAT.metalD);
    v.box(-3, y - h - 1, -3, 6, h, 6, (x, yy, z) => (((x === -3 || x === 2) && (z === -3 || z === 2)) || yy === y - h - 1 || yy === y - 2 ? MAT.metalD : null));
    v.box(-2, y - 1, -2, 4, 1, 4, MAT.metal);
  }, light: (v, D) => { const y = HY(D) - 3, h = Math.max(4, Math.min(8, handUp(D) - 7)); v.box(-2, y - h, -2, 4, h - 2, 4, (x, yy) => (yy >= y - h / 2 ? 0xe8b866 : 0xd08a3a)); }, pose: { rz: 0.14 } },
  orbe: { off: (v, D) => { const y = HY(D), z0 = front(D); v.box(-2, y - 2, z0, 4, 4, 1, MAT.leatherD); },
    offLight: (v, D) => { const y = HY(D) - 1, z0 = front(D) + 1; v.box(-1, y, z0, 2, 3, 3, MAT.vein); v.box(-2, y, z0 + 1, 1, 2, 1, MAT.veinD); v.box(1, y + 1, z0 + 2, 1, 2, 1, MAT.veinD); },
    pose: { lx: -0.6, lz: -0.05 }, offStill: true },
  catalejo: { body: (v, D) => {   // atravesado en la espalda, en el cinturón: al costado lo pisaba el brazo
    const hw = D.W / 2, hd = Math.floor(D.D / 2), n = Math.min(9, 2 * hw - 3), x0 = -hw + 1;
    v.box(x0, 1, -hd - 2, n, 2, 2, (x) => (x === x0 || x === x0 + n - 1 ? MAT.brassD : x === x0 + 3 ? MAT.leatherD : MAT.brass));
  }, cape: 2 },
  mochila: {
    body: (v, D) => {   // mochila de lona con la manta enrollada arriba
      const hw = D.W / 2, hd = Math.floor(D.D / 2), H = D.H, hz0 = -Math.floor(D.hd / 2) + D.headZ;
      const rz1 = H + D.neck - D.headY > H ? -hd - 1 : Math.min(-hd - 1, hz0 - 2);   // fin de la manta
      v.box(-hw + 2, H - 13, -hd - 5, 2 * hw - 4, 11, 5, (x, y, z) => (y === H - 8 ? MAT.leatherD : z === -hd - 5 && Math.abs(x + 0.5) < 2.5 && y < H - 8 ? MAT.leather : 0x5e5442));
      v.box(-hw + 1, H - 2, -hd - 4, 2 * hw - 2, 3, Math.max(1, rz1 + hd + 4), (x) => ((x + 99) % 5 === 0 ? MAT.leatherD : 0x6e5f4a));
    },
    paint: (c) => ((c.front && Math.abs(Math.abs(c.x + 0.5) - (c.hw - 3.5)) < 1 && c.y > 4) ? MAT.leatherD : undefined),
    cape: 5,   // la capa cae detrás de la mochila
  },
  bolso: {
    // bolso grande colgado de la correa cruzada, adelante de la cadera derecha y del lado de adentro del brazo (al
    // costado lo atravesaba el brazo al caminar)
    body: (v, D, P, look) => {
      const hw = D.W / 2, fz = Math.floor(D.D / 2) + (look?.type === 'anuro' ? 1 : 0), x0 = Math.max(3, hw - 7, D.hw / 2 - 2), w = hw - 1 - x0, y0 = D.hunch > 0.08 ? 2 : 0;   // los encorvados lo llevan más arriba
      v.box(x0, y0, fz, w, 4, 3, (x, y) => (y === y0 ? MAT.leatherD : y === y0 + 3 ? MAT.leatherL : MAT.leather));
      v.box(x0, y0 + 1, fz + 3, w, 3, 1, (x, y) => (y === y0 + 3 ? MAT.leatherL : y === y0 + 1 ? MAT.leatherD : MAT.leather));   // la tapa
      v.set(x0 + (w >> 1), y0 + 2, fz + 4, MAT.brass);
    },
    paint: (c, P) => strapCol(c, P, 2) ?? undefined,
    noPouch: 'right',
  },
  collar: { paint: (c) => (c.front && c.y === c.H - 6 && Math.abs(c.x + 0.5) < 1 ? MAT.vein
    : c.front && ((c.y === c.H - 5 && Math.abs(c.x + 0.5) === 1.5) || (c.y === c.H - 4 && Math.abs(c.x + 0.5) === 2.5) || (c.y === c.H - 3 && Math.abs(c.x + 0.5) === 3.5)) ? MAT.brassD : undefined) },
  buho: { body: (v, D) => {   // un cuervo en el hombro izquierdo, parado sobre la hombrera si la hay
    const hw = D.W / 2 + D.sh, H = D.H, x0 = -hw - 4;
    v.box(x0, H + 2, -3, 4, 4, 6, MAT.crow); v.box(x0, H + 6, 1, 4, 4, 4, MAT.crow);
    v.box(x0 + 1, H + 7, 5, 2, 1, 2, 0x4a4238); v.set(x0, H + 8, 4, 0x9a8a48); v.set(x0 + 3, H + 8, 4, 0x9a8a48);
    v.box(x0, H + 3, -6, 4, 1, 3, MAT.crow);
  } },
  trabuco: { hand: (v, D) => {   // solo para los piratas del combate (no está en el catálogo)
    const y = HY(D), z0 = front(D), b = back(D);
    v.box(-1, y - 3, b - 4, 2, 4, 5, MAT.wood);   // culata, detrás del puño
    for (let z = z0; z < z0 + 12; z++) v.box(-1, y, z, 2, 2, 1, z > z0 + 9 ? MAT.metalL : MAT.metal);
    v.box(-2, y - 1, z0 + 12, 4, 4, 1, (x, yy) => (Math.abs(x + 0.5) < 1 && yy === y ? MAT.ink : MAT.metalD));
  }, pose: { rx: -0.35, rz: 0.1 } },
};

// ---------------- Clases (M3, paso 5b) ----------------
// Las clases cambian arma y armadura sobre el look de cada uno. classLook(look, 'guerrero') devuelve el look con su kit.
export const CLASS_KIT = {
  guerrero: { dress: 'cota', acc: 'espada', crown: 'casco' },
  cazador: { dress: 'cuero', acc: 'arco', crown: 'capucha' },
  forjador: { dress: 'delantal', acc: 'martillo' },
  curandero: { dress: 'habito', acc: 'bolso' },
  monje: { dress: 'habito', acc: 'baston', crown: 'ninguna' },
  saqueador: { dress: 'cuero', acc: 'hacha', crown: 'bandana' },
};
// los roles de hoy (exp-data.js ROLES) y su clase equivalente (plan §M3)
export const ROLE_CLASS = { exploracion: 'cazador', ingenieria: 'forjador', sanidad: 'curandero', guia: 'monje', recoleccion: 'saqueador', guerrero: 'guerrero' };
export function classLook(look, cls) {
  const k = CLASS_KIT[cls] || CLASS_KIT[ROLE_CLASS[cls]];
  return k ? { ...look, ...k } : look;
}
