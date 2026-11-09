// Gente de El Quiebre en vóxel detallado (plan §M1 y §M2). Primero la silueta: manos, botas y hombros grandes, cada
// pueblo con su forma (enanos anchos y bajos, orcos de torso enorme y piernas cortas, anuros achaparrados con ojos
// arriba y boca ancha, gente-zorro con orejas grandes, hocico largo y cola). Materiales planos de 2 o 3 tonos (luz,
// base, sombra) sin ruido; caras con volumen (ceño, nariz y barba son formas). Lo arma avatar.js; acá están las piezas:
//   PEOPLE[type][build]  medidas de cada pueblo (en vóxeles de S = 1/48)
//   OUTFITS[id]          cómo se pinta cada ropa en torso, brazos, piernas, falda y capa
//   buildHead(v, look, D, pal)  cabeza con cara, pelo, barba o cicatrices y lo que lleve puesto
//   GEAR[id]             equipo en la mano, el cuerpo o el hombro (las clases de M3 lo cambian con classLook)
// Ejes: +Z es el frente, y = 0 el piso. Cada parte se dibuja en su grilla local con el pivote en el origen.
import { MAT, mix, shade, ramp, hsl, hexToInt, skinHex, hairHex, clothHex } from './avatar-kit.js';

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
    recio: base({ legH: 11, legW: 8, legD: 8, hip: 4.5, H: 16, W: 24, D: 12, sh: 2, armL: 15, armW: 7, hand: 8, hw: 12, hh: 12, hd: 12, neck: 0, headY: 1, boot: 5 }),
    esbelto: base({ legH: 12, legW: 7, legD: 7, hip: 4, H: 15, W: 20, D: 11, sh: 1, armL: 14, armW: 6, hand: 7, hw: 12, hh: 12, hd: 11, neck: 0, headY: 1, boot: 5, slim: true }),
  },
  orco: {
    recio: base({ legH: 14, legW: 8, legD: 8, hip: 5, H: 19, W: 26, D: 13, sh: 3, armL: 20, armW: 8, hand: 9, hw: 12, hh: 12, hd: 12, neck: 0, headY: 3, hunch: 0.12, headZ: 3, boot: 5 }),
    esbelto: base({ legH: 15, legW: 7, legD: 7, hip: 4.5, H: 18, W: 22, D: 12, sh: 2, armL: 19, armW: 7, hand: 8, hw: 12, hh: 12, hd: 12, neck: 0, headY: 2, hunch: 0.1, headZ: 2, boot: 5, slim: true }),
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
export const dimsOf = (type, build) => {
  const D = (PEOPLE[type] || PEOPLE.humano)[build === 'esbelto' ? 'esbelto' : 'recio'];
  return { ...D, armX: D.W / 2 + D.sh + D.armW / 2 };
};

// ---------------- Paleta de un look ----------------
const IRIS = { humano: 0x2a2220, enano: 0x2a2220, orco: 0x7a3a14, anuro: 0xc8a032, zorro: 0xc07a22, vaciado: 0x5fd0c4 };
export function paletteOf(look) {
  const t = look.type;
  const skin = hexToInt(skinHex(t, look.skin));
  const hair = hexToInt(hairHex(look.hairColor));
  const cloth = hexToInt(clothHex(look.dressColor));
  // rampas con cambio de matiz (docs/ARTE-PERSONAJES.md §3): la piel oscurece hacia el rojo (nunca al gris) y aclara
  // hacia el durazno; la tela y el pelo oscurecen hacia el violeta frío y aclaran hacia el ocre
  const SK = { hue: 7, val: 0.085, cool: t === 'anuro' || t === 'orco' ? 200 : 350, warm: 42 };
  const CL = { hue: 8, val: 0.08 };
  return {
    ...MAT, type: t,
    skin, skinL: ramp(skin, 1, SK), skinD: ramp(skin, -1, SK), skinDD: ramp(skin, -2.4, SK),
    hair, hairD: ramp(hair, -1.3, CL), hairL: ramp(hair, 1.2, CL), hairDD: ramp(hair, -2.4, CL),
    // pecho y hocico claros: la gente-zorro tiene el pelaje crema; los anuros, la panza pálida
    cream: t === 'zorro' ? mix(skin, 0xe6dcc6, 0.8) : t === 'anuro' ? mix(skin, 0xd8d0a0, 0.55) : ramp(skin, 1, SK),
    cloth, clothD: ramp(cloth, -1.2, CL), clothDD: ramp(cloth, -2.2, CL), clothL: ramp(cloth, 1.2, CL),
    iris: IRIS[t] || IRIS.humano, sclera: t === 'orco' ? 0xa09a70 : mix(ramp(skin, 1.5, SK), 0xc8bca6, 0.6),
    lid: ramp(skin, -1.6, SK), lip: mix(ramp(skin, -1.4, SK), 0x8a3a34, 0.25),
    scar: mix(skin, 0xc8988a, 0.6),
  };
}
// tono por altura: luz arriba, sombra abajo (los 3 tonos de cada material)
const lit = (c, k) => (k > 0 ? ramp(c, 0.8) : k < 0 ? ramp(c, -0.9) : c);

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
const chain = (x, y, z, P) => ((x + y) % 2 ? P.metal : P.metalD);
const boots = (h, P) => (y) => (y < h - 1 ? P.boot : y === h - 1 ? P.bootL : null);

export const OUTFITS = {
  viajero: {
    torso: (c, P) => belt(c, P) || (strap(c) ? P.leatherD : collar(c) ? P.linen : P.cloth),
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
    leg: (y, P) => (y === 0 ? P.leather : y < 3 ? 'skin' : P.trouserD),
    skirt: { long: true, gap: 4, flare: 8, col: (y, len, P) => (y === 0 ? P.clothDD : P.cloth) },
    hood: true,
    extra: (v, D, P) => { const hd = Math.floor(D.D / 2); v.box(1, -1, hd, 1, 1, 1, P.linenD); v.box(1, -6, hd + 1, 1, 6, 1, P.linen); v.box(0, -7, hd + 1, 3, 1, 1, P.linenD); },   // cordón que cuelga
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
    torso: (c, P) => belt(c, P) || (c.side && c.y < c.H - 3 ? P.cloth : c.front && Math.abs(c.x + 0.5) < 1 && c.y > BELT_Y ? P.leatherD
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
    sleeve: (r, L, P) => chain(r, 0, 1, P),
    glove: true,
    leg: (y, P) => boots(8, P)(y) ?? P.trouserD,
    skirt: { len: 7, col: (y, len, P, c) => ((c.front || c.back) && Math.abs(c.x + 0.5) <= c.hw - 3 ? (y === 0 ? P.clothD : P.cloth) : y >= len - 3 ? chain(c.x, y, c.z, P) : null) },
  },
  capa_viaje: {
    torso: (c, P) => belt(c, P) || (strap(c) ? P.leatherD : P.trouser),
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
    sleeve: (r, L, P) => (r >= L - 3 ? P.clothD : P.cloth),
    glove: true,
    leg: (y, P) => boots(10, P)(y) ?? P.trouser,
    skirt: { len: 13, flare: 8, col: (y, len, P, c) => (c.front && Math.abs(c.x + 0.5) <= 2 ? null : y === 0 ? P.clothDD : P.cloth) },
  },
  cota: {
    torso: (c, P) => belt(c, P) || (collar(c, 4) ? P.metalD : chain(c.x, c.y, c.z, P)),
    pauldron: (P) => P.metal,
    sleeve: (r, L, P) => chain(r, 1, 0, P),
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
      if (look.type === 'vaciado' && (x + y * 2) % 11 === 0 && c.front) col = P.veinD;   // la veta les come la ropa
      v.set(x, y, z, lit(col, y >= H - 2 ? 1 : y <= 1 ? -1 : 0));
    }
  }
  for (let y = H; y < H + D.neck; y++) v.box(-2, y, -2, 4, 1, 4, P.skinD);
  if (look.type === 'zorro' && !o.mantle) v.box(-2, H - 4, hd, 4, 4, 1, (x, y) => (y === H - 4 ? null : P.cream));   // pechera de pelo
  if (o.mantle) {
    const fur = o.mantle === 'fur';
    for (let y = H - 3; y < H + (fur ? 2 : 1); y++) for (let x = -hw - D.sh - 1; x < hw + D.sh + 1; x++) for (let z = -hd - 1; z < hd + 1; z++) {
      const edge = x === -hw - D.sh - 1 || x === hw + D.sh || z === -hd - 1 || z === hd || y >= H;
      const hole = y >= H && Math.abs(x + 0.5) < 3 && Math.abs(z + 0.5) < 3;
      if (!edge || hole || (z === hd && Math.abs(x + 0.5) < 2 && y < H)) continue;
      v.set(x, y, z, fur ? (y === H + 1 ? P.furL : (x + z + 99) % 3 === 0 ? P.furD : P.fur) : y === H - 3 ? P.clothDD : P.clothD);
    }
    if (!fur) { v.set(-1, H - 2, hd + 1, P.brass); v.set(0, H - 2, hd + 1, P.brass); }   // broche
  }
  if (o.hood) {   // capucha caída: un cuello de tela alrededor de la nuca y un pliegue en la espalda
    for (let x = -5; x < 5; x++) for (let z = -hd - 1; z < 2; z++) if (x === -5 || x === 4 || z === -hd - 1) v.set(x, H, z, z === -hd - 1 ? P.clothD : P.cloth);
    v.box(-4, H - 4, -hd - 1, 8, 4, 1, (x, y) => (y === H - 4 ? P.clothDD : P.clothD));
  }
  if (o.highCollar) v.box(-hw + 2, H, -hd - 1, 2 * hw - 4, 4, 2, (x, y) => (y === H + 3 ? P.brass : P.clothDD));
  // bolsos del cinturón: casi todos llevan algo colgado
  const pouch = (s) => { const x0 = s > 0 ? hw - 4 : -hw + 1; v.box(x0, -1, hd, 3, 4, 2, (x, y) => (y === 2 ? P.leatherL : y === -1 ? P.leatherD : P.leather)); v.set(x0 + 1, 1, hd + 2, P.brassD); };
  if (o.pouch === 'right' || o.pouch === 'both') pouch(1);
  if (o.pouch === 'left' || o.pouch === 'both') pouch(-1);
  o.extra?.(v, D, P);
  gear?.body?.(v, D, P, look);
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
      continue;
    }
    let col = o.sleeve(r, L - 4, P);
    if (col === 'skin') col = P.skin;
    const wide = o.wide && r >= L - 4 - o.wide ? 1 : 0;
    for (let x = a0 - wide; x < a1 + wide; x++) for (let z = a0 - wide; z < a1 + wide; z++) {
      if (bevel(x, z, a0 - wide, a1 + wide, a0 - wide, a1 + wide) && D.armW > 3) continue;
      v.set(x, y, z, lit(col, r <= 1 ? 1 : wide && r === L - 5 ? -1 : 0));
    }
  }
  const pd = o.pauldron?.(P);
  if (pd) {   // hombrera: cubre el hombro y sale hacia afuera
    // pegada al hombro: una capa sobre el brazo y el borde más oscuro (las grandes, un vóxel más)
    const big = o.bigPauldron || o.furPauldron ? 1 : 0;
    for (let y = -3 - big; y < 1 + big; y++) for (let x = a0; x < a1 + 1; x++) for (let z = a0 - 1; z < a1 + 1; z++) {
      const shell = x === a1 || z === a0 - 1 || z === a1 || y === big;
      if (!shell) continue;
      v.set(x, y, z, y === -3 - big ? shade(pd, -0.2) : y === big ? shade(pd, 0.1) : o.bigPauldron && y === -1 ? P.brassD : pd);
    }
  }
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
    for (let x = l0 - e; x < l1 + e; x++) for (let z = d0 - e; z < d1 + e; z++) {
      if (bevel(x, z, l0 - e, l1 + e, d0 - e, d1 + e) && y > 1) continue;
      v.set(x, y - L, z, col);
    }
    if (look.type === 'vaciado' && y > 6 && y % 5 === 0) v.set(l0, y - L, d1 - 1, P.veinD);
  }
  if (bare) {   // pie ancho y palmeado, con tres dedos
    v.box(l0 - 2, -L, d0, D.legW + 4, 2, D.legD + 1, P.skin);
    for (const x of [l0 - 2, l0 + Math.floor(D.legW / 2), l1 + 1]) v.box(x, -L, d1 + 1, 1, 1, 2, P.skinD);
    v.box(l0 - 1, -L, d1 + 1, D.legW + 2, 1, 1, P.skin);
  } else {
    const t0 = o.leg(0, P), toe = t0 === 'skin' ? P.skin : t0;
    v.box(l0 - 1, -L, d1 + 1, D.legW + 2, 2, 2, (x, y) => (y === -L + 1 ? shade(toe, 0.08) : toe));   // punta de la bota
  }
}

/** Falda / faldón (va fija en el cuerpo, las piernas se mueven adentro). Arriba en y = 0. */
export function drawSkirt(v, look, D, P) {
  const o = outfitOf(look.dress);
  const sk = o.skirt;
  if (!sk) return;
  const len = sk.long ? D.legH - (sk.gap || 2) : Math.min(sk.len, D.legH - 3);
  const hw = D.W / 2, hd = Math.floor(D.D / 2) + (look.type === 'anuro' ? 1 : 0);
  for (let i = 0; i < len; i++) {
    const y = -1 - i, fy = len - 1 - i;   // fy: alto desde el ruedo
    const f = sk.flare ? Math.floor(i / sk.flare) : 0;
    const w = hw + f - (D.slim && !sk.long ? 1 : 0), d = hd + f;
    for (let x = -w; x < w; x++) for (let z = -d; z < d; z++) {
      const edge = x === -w || x === w - 1 || z === -d || z === d - 1;
      if (!edge || bevel(x, z, -w, w, -d, d)) continue;
      const c = { x, y: fy, z, hw: w, hd: d, front: z === d - 1, back: z === -d, side: x === -w || x === w - 1 };
      const col = sk.col(fy, len, P, c);
      if (col != null) v.set(x, y, z, lit(col, i === 0 ? 1 : 0));
    }
  }
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
const EYE = { humano: 5, enano: 5, orco: 5, zorro: 6, vaciado: 5, anuro: 9 };
const BEARDS = new Set(['barba_corta', 'barba_larga', 'barba_trenzada', 'bigote']);

/** Ojos (malla aparte para parpadear): lista de [x, y, z, color]. */
export function eyeVoxels(look, D, P) {
  const t = look.type, W = D.hw / 2, fz = Math.ceil(D.hd / 2) - 1;
  const ey = EYE[t] ?? 6;
  const out = [];
  if (t === 'anuro') {   // en el frente de los ojos saltones: iris dorado con pupila horizontal
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -W + 1 : W - 5;
      for (let x = x0; x < x0 + 4; x++) for (const y of [ey, ey + 1]) out.push([x, y, fz - 1, y === ey && x > x0 && x < x0 + 3 ? 0x1a1410 : P.iris]);
    }
    return out;
  }
  // plantilla de cara (docs/ARTE-PERSONAJES.md §2): ojo de 2 × 1 sin blanco (pupila oscura adentro, sombra del párpado
  // afuera), bajo el ceño que sale y le hace sombra. Separados por el puente de la nariz (2 vóxeles).
  const inner = t === 'orco' ? 2 : 1;
  for (const s of [-1, 1]) {
    const xi = s < 0 ? -inner - 1 : inner, xo = s < 0 ? xi - 1 : xi + 1;
    if ((look.face === 'cicatriz_ojo' || look.face === 'parche') && s < 0) continue;
    if (t === 'zorro') { out.push([xi, ey, fz, P.ink], [xo, ey, fz, P.iris]); continue; }   // ojo ámbar con la pupila adentro
    out.push([xi, ey, fz, P.iris], [xo, ey, fz, t === 'vaciado' ? P.iris : P.lid]);
  }
  return out;
}

/** Cabeza completa: cráneo, cara con volumen, orejas, pelo (lo quieto), barba o marcas y lo que lleva en la cabeza. */
export function buildHead(v, look, D, P) {
  const t = look.type;
  const { W, fz, zb } = headBox(v, D, P, look);
  const hh = D.hh, ey = EYE[t] ?? 6;
  const browC = t === 'vaciado' ? P.skinDD : P.hairD;   // cejas del color del pelo aunque esté rapado
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
      v.set(xi, ey + 1, fz + 1, P.skinD);
      v.set(s < 0 ? -3 : 2, ey + 1, fz, P.lid);
      v.set(xi, ey - 1, fz, P.skinDD);   // lágrima oscura hacia el hocico
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
        v.set(x, ey + 1 + (gruff && outer ? 1 : 0), fz + 1, browC);
        if (gruff && outer) v.set(x, ey + 1, fz + 1, P.skinD);
        if (big && i < n - 1) v.set(x, ey + 2, fz + 1, i === 0 ? P.hairD : browC);   // cejas tupidas
      }
    }
    v.box(-1, 3, fz + 1, 2, ey - 2, 1, P.skin);   // puente y cuerpo de la nariz
    v.box(-1 - big, 3 - big, fz + 2, 2 + 2 * big, 1 + big, 1, P.skin);   // punta (la luz la pone la escena)
    if (big) v.box(-2, 2, fz + 1, 4, 2, 1, P.skin);
    v.set(-2 - big, 3 - big, fz, P.skinD); v.set(1 + big, 3 - big, fz, P.skinD);   // aletas: sombra al costado
    if (!BEARDS.has(look.face)) for (let x = -1; x < 1; x++) v.set(x, 1, fz, P.lip);   // boca: una línea corta
    v.box(-2, 0, fz + 1, 4, 1, 1, P.skin);   // mentón
    if (t === 'vaciado') { v.set(-W + 1, 3, fz, P.skinDD); v.set(W - 2, 3, fz, P.skinDD); for (let y = 2; y < ey; y++) v.set(W - 3, y, fz, P.veinD); }
    for (const s of [-1, 1]) {
      const xe = s < 0 ? -W - 1 : W;
      if (t === 'orco') { v.box(xe, 5, -2, 1, 3, 3, P.skin); for (let i = 1; i <= 3; i++) v.box(xe + s * i, 6 + (i >> 1), -2, 1, 2, 2, i === 3 ? P.skinD : P.skin); }
      else { v.box(xe, 3, -1, 1, 4, 3, P.skin); v.set(xe, 4, 0, P.skinD); v.set(xe, 5, 0, P.skinD); }
    }
    if (t === 'orco') {   // frente pesada, mandíbula adelantada y colmillos que suben
      v.box(-W + 1, ey + 1, fz + 1, 2 * W - 2, 2, 2, (x, y) => (y === ey + 2 ? P.skin : P.skinD));
      v.box(-W + 1, 0, fz + 1, 2 * W - 2, 3, 2, (x, y) => (y === 2 ? P.skinD : P.skin));
      v.box(-2, 4, fz + 1, 4, 2, 2, (x, y) => (y === 5 ? P.skin : P.skinD));
      for (const x of [-4, 3]) v.box(x, 2, fz + 3, 1, 4, 1, (xx, y) => (y === 5 ? P.bone : ramp(P.bone, -1)));
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
  // mechones en bandas (sin ruido): base, sombra cada 3 columnas y luz arriba
  const hc = (x, y) => (y >= hh + (h.cap || 0) - 1 ? P.hairL : (x + 99) % 3 === 0 ? P.hairD : P.hair);
  const skinish = (c) => c === P.skin || c === shade(P.skin, 0.06);
  if (t === 'anuro') {
    if (h.spots) for (const [k, c] of v.map) {
      const [x, y, z] = k.split(',').map(Number);
      if (skinish(c) && y >= 4 && ((x >> 2) + (z >> 2)) % 3 === 0 && ((x + z) & 3) < 2) v.map.set(k, P.hair);
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
  if (h.spikes) for (const [x, z] of [[-3, -1], [1, 1], [-1, -4], [3, -3], [0, 2], [-4, 2]]) v.box(x, hh + 2, z, 2, 2 - ((x + z) & 1), 1, P.hairL);
  for (const s of [-1, 1]) {
    const x = s < 0 ? -W - 1 : W;
    for (let y = h.side; y < hh + 1; y++) for (let z = zb - 1; z < (h.long ? fz - 1 : fz - 2); z++) {
      if (!h.long && y < 7 && z > -3) continue;   // deja ver la oreja
      const wave = h.wavy && (y + 99) % 4 < 2 ? 1 : 0;
      v.set(x + s * wave, y, z, hc(z, y));
    }
  }
  for (let y = h.back; y < hh + 1; y++) for (let x = -W + (y < 0 ? 1 : 0); x < W - (y < 0 ? 1 : 0); x++) v.set(x, y, zb - 1, hc(x, y));
  if (h.long) for (let y = h.back; y < 4; y++) for (let x = -W + 1; x < W - 1; x++) v.set(x, y, zb - 2, (x + 99) % 3 === 0 ? P.hairD : P.hair);
  for (let i = 0; i < (h.fringe || 0); i++) {
    const y = hh - 1 - i;
    for (let x = -W; x < W; x++) {
      if (h.sweep && x > 1 - i * 2) continue;
      if (!h.sweep && i > 0 && Math.abs(x + 0.5) < W - 1) continue;
      v.set(x, y, fz + 1, hc(x, y));
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
  const groove = (x) => (x + 99) % 3 === 1 && Math.abs(x + 0.5) > 1;
  const bc = (x, y, z, len) => {
    const tip = y <= -len + 1, top = y >= 2;
    const c = top ? P.hairL : tip ? P.hairD : P.hair;
    return len > 3 && z >= fz + 2 && groove(x) && !top ? ramp(c, -0.8) : c;   // surcos solo en las barbas largas
  };
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
    for (let x = -3; x < 3; x++) { v.set(x, 2, fz + 2, Math.abs(x + 0.5) < 1 ? P.hair : P.hairL); v.set(x, 2, fz + 1, P.hairD); }
    for (const x of [-3, 2]) { v.set(x, 1, fz + 2, P.hair); v.set(x, 0, fz + 3, P.hairD); }
    v.set(-1, 1, fz + 1, P.hairD); v.set(0, 1, fz + 1, P.hairD);   // la boca queda tapada: con barba no se dibuja
    // largo: se angosta de a poco y sale hacia adelante (no es una caja colgada)
    for (let i = 0; i < len; i++) {
      const y = -1 - i, w = Math.max(2, W - Math.floor(i / 3) - (i === len - 1 ? 1 : 0));
      const z0 = fz - 3 + Math.min(2, i >> 2), z1 = fz + 2 - (i >= len - 2 ? 1 : 0);
      for (let x = -w; x < w; x++) for (let z = z0; z <= z1; z++) v.set(x, y, z, bc(x, y, z, len));
    }
    if (braid) for (let i = 0; i < 6; i++) v.box(-1, -1 - len - i, fz, 2, 1, 2, i === 1 || i === 4 ? P.brass : i === 5 ? P.hairD : P.hair);
  };
  if (f === 'barba_corta') beard(2);
  else if (f === 'barba_larga') beard(look.type === 'enano' ? 11 : 7);
  else if (f === 'barba_trenzada') beard(look.type === 'enano' ? 8 : 5, true);
  else if (f === 'bigote') { for (let x = -3; x < 3; x++) v.set(x, 2, fz + 2, bc(x, 3)); for (const x of [-4, 3]) { v.set(x, 1, fz + 1, P.hair); v.set(x, 0, fz + 1, P.hairD); } }
  else if (f === 'cicatriz') { for (let i = 0; i < 5; i++) v.set(W - 2 - (i >> 1), 1 + i, fz + (i === 2 ? 1 : 0), P.scar); }
  else if (f === 'cicatriz_ojo') { const x = look.type === 'orco' ? -3 : -2; for (let y = ey - 3; y <= ey + 3; y++) v.set(x, y, fz + (y === ey + 1 || y === ey + 2 ? 2 : 0), P.scar); v.set(x - 1, ey, fz, P.skinDD); v.set(x + 1, ey, fz, P.skinDD); }
  else if (f === 'pintura') { for (const x of [-3, -2, 1, 2]) for (let y = ey - 3; y < ey; y++) v.set(x, y, fz, 0x2a2224); for (let x = -W + 1; x < W - 1; x++) if (!v.has(x, ey + 3, fz + 1)) v.set(x, ey + 3, fz, 0x5a2a22); }
  else if (f === 'parche') {
    const x = look.type === 'orco' ? -3 : -2;
    v.box(x - 1, ey, fz + 1, 2, 2, 1, P.ink); v.set(x - 1, ey - 1, fz + 1, P.leatherD);   // parche chico sobre el ojo
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
      for (let y = 1; y < hh + 3; y++) for (let x = -W - 2; x < W + 2; x++) for (let z = zc0 - 1; z <= zc1; z++) {
        const out = x === -W - 2 || x === W + 1 || z === zc0 - 1 || y === hh + 2 || (z === zc1 && (Math.abs(x + 0.5) >= W - 1 || y >= hh));
        if (out && !((x === -W - 2 || x === W + 1) && z === zc0 - 1)) v.set(x, y, z, z === zc1 ? P.clothDD : y >= hh + 1 ? P.cloth : P.clothD);
      }
      v.box(-W, -3, zc0 - 1, 2 * W, 5, 2, P.clothD);
      v.box(-1, hh + 2, zc0, 2, 1, 3, P.clothD);   // punta de la capucha
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
        const red = hsl(P.cloth)[0] < 25 || hsl(P.cloth)[0] > 340, B = red ? 0x34302e : 0x7c3226;
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
// Coordenadas de la mano: brazo de largo L, el puño en y = -L .. -L+4 (centro y = -L+2), ancho D.hand.
const HY = (D) => -D.armL + 2;
const front = (D) => Math.ceil(D.hand / 2);
function blade(v, D, len) {
  const y = HY(D), z0 = front(D);
  v.box(-1, y - 1, -z0 - 2, 2, 2, 2, MAT.brassD);   // pomo
  v.box(-3, y - 1, z0, 6, 2, 1, MAT.brass);   // guarda
  for (let i = 0; i < len; i++) v.box(-1, y - 1, z0 + 1 + i, 2, 3 - (i === len - 1 ? 1 : 0), 1, (x, yy) => (yy === y + 1 ? MAT.metalL : x === 0 ? MAT.metal : MAT.metalD));
}
const haft = (v, D, z0, z1) => { const y = HY(D); for (let z = z0; z < z1; z++) v.box(-1, y - 1, z, 2, 2, 1, (z + 99) % 5 === 0 ? MAT.leatherD : MAT.wood); };
export const GEAR = {
  espada: { hand: (v, D) => blade(v, D, 16), pose: { rx: -0.5, rz: 0.12 } },
  hacha: { hand: (v, D) => {   // hacha grande: mango largo y hoja ancha
    const y = HY(D), z0 = front(D);
    haft(v, D, -z0 - 7, z0 + 24);
    // hoja ancha en forma de medialuna: crece hacia el filo, que es más claro
    for (let i = 0; i < 15; i++) {
      const d = Math.abs(i - 7), zA = z0 + 14 + Math.max(0, d - 4), zB = z0 + 23 + (d < 5 ? 1 : 0) - (d > 6 ? 1 : 0);
      for (let z = zA; z < zB; z++) v.box(-1, y - 6 + i, z, 2, 1, 1, z >= zB - 2 ? MAT.metalL : d === 7 ? MAT.metalD : MAT.metal);
    }
    v.box(-2, y - 2, z0 + 12, 4, 4, 3, MAT.metalD);   // ojo del hacha
    v.box(-1, y - 1, z0 + 24, 2, 2, 1, MAT.metalD);
  }, pose: { rx: -0.45, rz: 0.14 } },
  martillo: { hand: (v, D) => {
    const y = HY(D), z0 = front(D);
    haft(v, D, -z0 - 3, z0 + 13);
    v.box(-3, y - 4, z0 + 11, 6, 7, 6, (x, yy, z) => (yy === y + 2 ? MAT.metalL : z === z0 + 11 || z === z0 + 16 ? MAT.metalD : MAT.metal));
    v.box(-2, y - 3, z0 + 10, 4, 5, 1, MAT.brassD);
  }, pose: { rx: -0.4, rz: 0.14 } },
  lanza: { hand: (v, D) => {
    const y = HY(D);
    for (let yy = y - 18; yy < y + 32; yy++) v.box(-1, yy, 0, 2, 1, 2, (yy + 99) % 6 === 0 ? MAT.leatherD : MAT.wood);
    for (let i = 0; i < 7; i++) v.box(-1 - (i < 3 ? 1 : 0), y + 32 + i, 0, i < 3 ? 4 : 2, 1, 2, i === 6 ? MAT.metalL : MAT.metal);
    v.box(-2, y + 30, -1, 4, 2, 4, MAT.leatherD);
  }, pose: { rx: 0, rz: 0.1 }, still: true },
  baston: { hand: (v, D) => {   // bastón alto con un nudo y la piedra de veta arriba
    const y = HY(D);
    for (let yy = y - 18; yy < y + 26; yy++) v.box(-1, yy, 0, 2, 1, 2, (yy + 99) % 7 === 0 ? MAT.woodD : MAT.wood);
    v.box(-2, y + 26, -1, 4, 3, 4, MAT.woodD); v.box(-1, y + 29, 0, 2, 3, 2, MAT.vein); v.box(-2, y + 28, 0, 1, 2, 1, MAT.woodD); v.box(1, y + 28, 1, 1, 3, 1, MAT.woodD);
  }, pose: { rx: 0, rz: 0.1 }, still: true },
  libro: { off: (v, D) => {
    const y = HY(D), z0 = front(D);
    v.box(-4, y - 3, z0, 8, 7, 3, (x, yy, z) => (z === z0 + 1 && x > -4 && x < 3 && yy > y - 3 && yy < y + 3 ? MAT.linen : yy === y + 3 ? MAT.leatherL : MAT.leatherD));
  }, pose: { lx: -0.75, lz: 0.1 } },
  escudo: { off: (v, D) => {   // escudo redondo de tablas con aro y umbo de metal
    const z0 = front(D), cy = HY(D) + 3;
    for (let x = -9; x <= 8; x++) for (let y = cy - 9; y <= cy + 8; y++) {
      const dx = x + 0.5, dy = y - cy + 0.5, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 8.8) continue;
      v.set(x, y, z0 + 1, d > 7.6 ? MAT.metalD : d < 2.2 ? MAT.metalL : (x + 99) % 4 === 0 ? MAT.woodD : MAT.wood);
      if (d < 2.2) v.set(x, y, z0 + 2, MAT.metal);
    }
  }, pose: { lz: -0.2 } },
  arco: { off: (v, D) => {
    const y0 = HY(D);
    for (let i = -16; i <= 16; i++) {
      const z = 2 + Math.round(Math.cos((i / 16) * Math.PI / 2) * 4);
      v.box(-1, y0 + i, z, 2, 1, 1, Math.abs(i) < 2 ? MAT.leatherD : MAT.wood);
      if (Math.abs(i) < 16 && i !== 0) v.set(0, y0 + i, 1, MAT.linenD);
    }
  }, pose: { lz: -0.16 } },
  farolito: { hand: (v, D) => {
    const y = HY(D) - 2;
    v.box(-1, y - 1, -1, 2, 2, 2, MAT.metalD);
    v.box(-3, y - 9, -3, 6, 8, 6, (x, yy, z) => (((x === -3 || x === 2) && (z === -3 || z === 2)) || yy === y - 9 || yy === y - 2 ? MAT.metalD : null));
    v.box(-2, y - 1, -2, 4, 1, 4, MAT.metal);
  }, light: (v, D) => { const y = HY(D) - 2; v.box(-2, y - 8, -2, 4, 6, 4, (x, yy) => (yy >= y - 4 ? 0xe8b866 : 0xd08a3a)); }, pose: { rz: 0.14 } },
  orbe: { off: (v, D) => { const y = HY(D), z0 = front(D); v.box(-2, y + 2, z0 - 2, 4, 1, 4, MAT.leatherD); },
    offLight: (v, D) => { const y = HY(D) + 3, z0 = front(D) - 1; v.box(-1, y, z0, 2, 5, 2, MAT.vein); v.box(-2, y, z0 - 1, 1, 3, 1, MAT.veinD); v.box(1, y, z0 + 1, 1, 4, 1, MAT.veinD); },
    pose: { lx: -0.65, lz: 0.08 } },
  catalejo: { body: (v, D) => { const hw = D.W / 2; v.box(-hw - 2, -1, -4, 2, 2, 9, (x, y, z) => (z === 4 || z === -4 ? MAT.brassD : MAT.brass)); } },
  mochila: {
    body: (v, D) => {   // mochila de lona con la manta enrollada arriba
      const hw = D.W / 2, hd = Math.floor(D.D / 2), H = D.H;
      v.box(-hw + 2, H - 13, -hd - 5, 2 * hw - 4, 11, 5, (x, y, z) => (y === H - 8 ? MAT.leatherD : z === -hd - 5 && Math.abs(x + 0.5) < 2.5 && y < H - 8 ? MAT.leather : 0x5e5442));
      v.box(-hw + 1, H - 2, -hd - 4, 2 * hw - 2, 3, 3, (x) => ((x + 99) % 5 === 0 ? MAT.leatherD : 0x6e5f4a));
    },
    paint: (c) => ((c.front && Math.abs(Math.abs(c.x + 0.5) - (c.hw - 3.5)) < 1 && c.y > 4) ? MAT.leatherD : undefined),
  },
  bolso: {
    body: (v, D) => { const hw = D.W / 2; v.box(hw + D.sh - 1, -4, -2, 4, 7, 6, (x, y, z) => (y === 2 ? MAT.leatherD : z === 3 && y === 0 ? MAT.brass : MAT.leather)); },
    paint: (c) => (strap(c, 2) ? MAT.leatherD : undefined),
  },
  collar: { paint: (c) => (c.front && c.y === c.H - 6 && Math.abs(c.x + 0.5) < 1 ? MAT.vein
    : c.front && ((c.y === c.H - 5 && Math.abs(c.x + 0.5) === 1.5) || (c.y === c.H - 4 && Math.abs(c.x + 0.5) === 2.5) || (c.y === c.H - 3 && Math.abs(c.x + 0.5) === 3.5)) ? MAT.brassD : undefined) },
  buho: { body: (v, D) => {   // un cuervo en el hombro izquierdo
    const hw = D.W / 2 + D.sh, H = D.H, x0 = -hw - 4;
    v.box(x0, H + 1, -3, 4, 4, 6, MAT.crow); v.box(x0, H + 5, 1, 4, 4, 4, MAT.crow);
    v.box(x0 + 1, H + 6, 5, 2, 1, 2, 0x4a4238); v.set(x0, H + 7, 4, 0x9a8a48); v.set(x0 + 3, H + 7, 4, 0x9a8a48);
    v.box(x0, H + 2, -6, 4, 1, 3, MAT.crow);
  } },
  trabuco: { hand: (v, D) => {   // solo para los piratas del combate (no está en el catálogo)
    const y = HY(D), z0 = front(D);
    v.box(-1, y - 3, -z0 - 3, 2, 4, 5, MAT.wood);
    for (let z = -z0 + 2; z < z0 + 12; z++) v.box(-1, y, z, 2, 2, 1, z > z0 + 9 ? MAT.metalL : MAT.metal);
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
