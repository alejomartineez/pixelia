// Gente de El Quiebre en vóxel detallado (plan §M1 y §M2): proporciones robustas de 3 a 4 cabezas, caras serias,
// ropa con cinturones, correas y armaduras, y paleta terrosa. Lo arma avatar.js; acá están las piezas:
//   PEOPLE[type][build]  medidas de cada pueblo (en vóxeles de S = 1/48)
//   OUTFITS[id]          cómo se pinta cada ropa en torso, brazos, piernas, falda y capa
//   buildHead(v, look, D, pal)  cabeza con cara, pelo, barba o cicatrices y lo que lleve puesto
//   GEAR[id]             equipo en la mano, el cuerpo o el hombro (las clases de M3 lo cambian con classLook)
// Ejes: +Z es el frente, y = 0 el piso. Cada parte se dibuja en su grilla local con el pivote en el origen.
import { MAT, mix, shade, hexToInt, hash3, skinHex, hairHex, clothHex } from './avatar-kit.js';

// ---------------- Medidas por pueblo ----------------
// leg: alto/ancho/profundidad y separación de la cadera; torso: alto/ancho/profundidad; arm: largo y ancho;
// head: ancho/alto/profundidad; neck: cuello; hunch: inclinación hacia adelante.
const base = (o) => ({ neck: 1, hunch: 0, headZ: 0, ...o });
export const PEOPLE = {
  humano: {
    recio: base({ legH: 18, legW: 6, legD: 6, hip: 3.5, H: 15, W: 16, D: 8, armL: 15, armW: 4, hw: 10, hh: 12, hd: 10 }),
    esbelto: base({ legH: 18, legW: 5, legD: 5, hip: 3, H: 15, W: 14, D: 7, armL: 15, armW: 4, hw: 10, hh: 12, hd: 10, slim: true }),
  },
  enano: {
    recio: base({ legH: 11, legW: 7, legD: 7, hip: 4, H: 14, W: 20, D: 10, armL: 13, armW: 5, hw: 12, hh: 12, hd: 11, neck: 0 }),
    esbelto: base({ legH: 11, legW: 6, legD: 6, hip: 3.5, H: 14, W: 18, D: 9, armL: 13, armW: 4, hw: 12, hh: 12, hd: 11, neck: 0, slim: true }),
  },
  orco: {
    recio: base({ legH: 19, legW: 7, legD: 7, hip: 4.5, H: 17, W: 22, D: 11, armL: 18, armW: 6, hw: 12, hh: 12, hd: 11, neck: 0, hunch: 0.08, headZ: 2 }),
    esbelto: base({ legH: 19, legW: 6, legD: 6, hip: 4, H: 16, W: 19, D: 10, armL: 17, armW: 5, hw: 12, hh: 12, hd: 11, neck: 0, hunch: 0.06, headZ: 1, slim: true }),
  },
  anuro: {
    recio: base({ legH: 14, legW: 7, legD: 7, hip: 4, H: 15, W: 18, D: 10, armL: 15, armW: 5, hw: 14, hh: 9, hd: 12, neck: 0, hunch: 0.05, headZ: 1 }),
    esbelto: base({ legH: 14, legW: 6, legD: 6, hip: 3.5, H: 15, W: 16, D: 9, armL: 15, armW: 4, hw: 14, hh: 9, hd: 12, neck: 0, hunch: 0.04, headZ: 1, slim: true }),
  },
  zorro: {
    recio: base({ legH: 18, legW: 5, legD: 6, hip: 3, H: 15, W: 15, D: 8, armL: 15, armW: 4, hw: 10, hh: 10, hd: 10 }),
    esbelto: base({ legH: 18, legW: 5, legD: 5, hip: 3, H: 15, W: 13, D: 7, armL: 15, armW: 4, hw: 10, hh: 10, hd: 10, slim: true }),
  },
  vaciado: {
    recio: base({ legH: 18, legW: 5, legD: 5, hip: 3, H: 15, W: 14, D: 7, armL: 16, armW: 4, hw: 10, hh: 12, hd: 10, hunch: 0.18, headZ: 2, slim: true }),
    esbelto: base({ legH: 18, legW: 5, legD: 5, hip: 3, H: 15, W: 13, D: 7, armL: 16, armW: 3, hw: 10, hh: 12, hd: 10, hunch: 0.2, headZ: 2, slim: true }),
  },
};
export const dimsOf = (type, build) => (PEOPLE[type] || PEOPLE.humano)[build === 'esbelto' ? 'esbelto' : 'recio'];

// ---------------- Paleta de un look ----------------
const IRIS = { humano: 0x2a2220, enano: 0x2a2220, orco: 0x5c3e16, anuro: 0xa8892c, zorro: 0xa86c26, vaciado: 0x5fd0c4 };
export function paletteOf(look) {
  const t = look.type;
  const skin = hexToInt(skinHex(t, look.skin));
  const hair = hexToInt(hairHex(look.hairColor));
  const cloth = hexToInt(clothHex(look.dressColor));
  return {
    ...MAT, type: t,
    skin, skinL: shade(skin, 0.08), skinD: shade(skin, -0.12), skinDD: shade(skin, -0.3),
    hair, hairD: shade(hair, -0.18), hairL: shade(hair, 0.14),
    // en la gente-zorro el hocico, el pecho y la punta de la cola van claros
    cream: t === 'zorro' ? mix(skin, 0xd8cdb8, 0.72) : shade(skin, 0.1),
    cloth, clothD: shade(cloth, -0.16), clothDD: shade(cloth, -0.3), clothL: shade(cloth, 0.12),
    iris: IRIS[t] || IRIS.humano, sclera: t === 'orco' ? 0x9c9468 : 0xb6ab98,
    scar: mix(skin, 0xc08a7c, 0.55),
  };
}

// ---------------- Ropa ----------------
// ctx de torso: { x, y, z, hw, hd, H, front, back, side } (x en [-hw, hw), y en [0, H), z en [-hd, hd)).
const BELT_Y = 3;
function belt(c, P, y0 = BELT_Y) {
  if (c.y !== y0 && c.y !== y0 - 1) return null;
  if (c.front && (c.x === -1 || c.x === 0)) return c.y === y0 ? P.brass : P.brassD;
  return P.leather;
}
const fold = (c, P, col, d) => (hash3(c.x + 9, c.y * 3, c.z + 5) < 0.12 ? (d ?? shade(col, -0.08)) : col);
const collar = (c, n = 3) => c.y >= c.H - 1 && Math.abs(c.x + 0.5) <= n;
/** Correa cruzada del hombro izquierdo a la cadera derecha (adelante y atrás). */
function strap(c, from = 4) {
  if (!(c.front || c.back) || c.y < from) return false;
  const t = (c.H - 1 - c.y) / Math.max(1, c.H - 1 - from);
  const xs = Math.round(-c.hw + 2 + t * (2 * c.hw - 6));
  return c.x === xs || c.x === xs + 1;
}
const chain = (x, y, z, P) => ((x + y + z) % 2 ? mix(P.metal, P.metalD, 0.4) : ((x * 3 + y) % 7 === 0 ? P.metal : P.metalD));
const boots = (h, P, cuff = P.bootL) => (y) => (y < h - 1 ? P.boot : y === h - 1 ? cuff : null);

export const OUTFITS = {
  viajero: {
    torso: (c, P) => belt(c, P) || (strap(c) ? P.leather : collar(c) ? P.linen : fold(c, P, P.cloth)),
    sleeve: (r, L, P) => (r >= L - 4 ? P.leather : r === 0 ? P.clothD : P.cloth),
    leg: (y, P) => boots(6, P)(y) ?? (y === 10 ? P.trouserD : P.trouser),
    skirt: { len: 4, col: (y, len, P) => (y === 0 ? P.clothD : P.cloth) },
    extra: (v, D, P) => v.box(D.W / 2 - 4, 0, D.D / 2, 3, 3, 2, (x, y) => (y === 2 ? P.leatherD : P.leather)),
  },
  jubon: {
    torso: (c, P) => belt(c, P) || (c.front && (c.x === -1 || c.x === 0) && c.y > BELT_Y ? (c.y % 2 ? P.brass : P.clothD)
      : c.y >= c.H - 2 && (c.side || c.y === c.H - 1) ? P.clothD : (c.x % 3 === 0 && c.y % 3 === 0) ? P.clothD : P.cloth),
    sleeve: (r, L, P) => (r >= L - 2 ? P.linen : r <= 2 ? P.clothL : P.cloth),
    leg: (y, P) => boots(8, P)(y) ?? P.clothDD,
    skirt: { len: 2, col: (y, len, P) => (y === 0 ? P.clothDD : P.clothD) },
  },
  vestido: {
    torso: (c, P) => belt(c, P, 4) || (c.front && (c.x === -1 || c.x === 0) && c.y > 4 && c.y < c.H - 2 ? (c.y % 2 ? P.linen : P.clothDD)
      : c.y >= c.H - 2 && Math.abs(c.x + 0.5) <= 3 && c.front ? P.linen : fold(c, P, P.cloth)),
    sleeve: (r, L, P) => (r >= L - 1 ? P.linenD : P.linen),
    leg: (y, P) => boots(4, P)(y) ?? P.trouserD,
    skirt: { long: true, flare: 4, col: (y, len, P, c) => (y <= 1 ? P.clothDD : c.front && Math.abs(c.x + 0.5) < c.hw - 3 && y > 2 ? P.linen : fold(c, P, P.clothD)) },
  },
  minero: {
    torso: (c, P) => belt(c, P) || ((c.front || c.back) && Math.abs(c.x + 0.5) === c.hw - 3.5 ? P.leather : collar(c, 2) && c.front ? P.skinD : fold(c, P, 0x6a6458)),
    sleeve: (r, L, P) => (r < Math.floor(L / 2) - 1 ? 0x6a6458 : r === Math.floor(L / 2) - 1 ? P.linenD : 'skin'),
    hand: (P) => P.leather,
    leg: (y, P) => boots(6, P)(y) ?? (y >= 8 && y <= 9 ? P.leatherD : 0x4a3f33),
    extra: (v, D, P) => { for (const s of [-1, 1]) v.box(s > 0 ? D.W / 2 - 1 : -D.W / 2 - 2, 0, -1, 3, 3, 3, P.leatherD); },
  },
  tunica: {
    torso: (c, P) => (c.y === BELT_Y ? (c.front && c.x === 0 ? P.linenD : P.linen) : c.front && (c.x === -1 || c.x === 0) ? P.brassD
      : c.y >= c.H - 2 ? P.clothD : fold(c, P, P.cloth)),
    sleeve: (r, L, P) => (r >= L - 1 ? P.brassD : P.cloth),
    wide: 5,
    leg: (y, P) => boots(3, P)(y) ?? P.trouserD,
    skirt: { long: true, flare: 5, col: (y, len, P, c) => (y === 0 ? P.brassD : c.front && (c.x === -1 || c.x === 0) ? P.brassD : fold(c, P, P.cloth)) },
  },
  habito: {
    torso: (c, P) => (c.y === BELT_Y ? P.linen : (c.front || c.back) && Math.abs(c.x + 0.5) <= 3 ? P.clothD : fold(c, P, P.cloth)),
    sleeve: (r, L, P) => (r >= L - 1 ? P.clothD : P.cloth),
    wide: 4,
    leg: (y, P) => (y === 0 ? P.leather : y < 3 ? 'skin' : P.trouserD),
    skirt: { long: true, flare: 6, col: (y, len, P, c) => (y === 0 ? P.clothDD : fold(c, P, P.cloth)) },
    extra: (v, D, P) => {
      v.box(-4, D.H - 3, -D.D / 2 - 2, 8, 4, 2, P.clothD);   // capucha caída en la espalda
      v.box(0, 0, D.D / 2, 1, 1, 1, P.linenD); v.box(0, -4, D.D / 2 + 1, 1, 4, 1, P.linen);   // cordón que cuelga
    },
  },
  delantal: {
    torso: (c, P) => ((c.front && Math.abs(c.x + 0.5) <= c.hw - 2 && c.y < c.H - 2) || (c.front && c.y >= c.H - 2 && Math.abs(Math.abs(c.x + 0.5) - 3.5) < 1)
      ? (c.y === 7 && Math.abs(c.x + 0.5) < 3 ? P.leatherD : P.leather) : c.y === 4 ? P.leatherD : fold(c, P, P.linen, P.linenD)),
    sleeve: (r, L, P) => (r < 5 ? P.linen : r === 5 ? P.linenD : 'skin'),
    hand: (P) => P.leatherD,
    leg: (y, P) => boots(6, P)(y) ?? P.trouser,
    skirt: { len: 9, col: (y, len, P, c) => (c.front && Math.abs(c.x + 0.5) <= c.hw - 2 ? (y === 0 ? P.leatherD : P.leather) : null) },
  },
  cuero: {
    torso: (c, P) => belt(c, P) || (c.side && c.y < c.H - 3 ? P.cloth : c.front && (c.x === -1 || c.x === 0) && c.y > BELT_Y ? (c.y % 2 ? P.leatherD : P.leather)
      : c.y % 4 === 0 ? P.leatherD : collar(c) ? P.clothD : P.leather),
    pauldron: (P) => P.leather,
    sleeve: (r, L, P) => (r >= L - 6 ? (r === L - 6 ? P.leatherD : P.leather) : P.cloth),
    leg: (y, P) => boots(7, P)(y) ?? (y === 9 ? P.leatherD : P.trouser),
    skirt: { len: 4, col: (y, len, P, c) => ((c.x + 99) % 3 === 0 ? null : y === 0 ? P.leatherD : P.leather) },
  },
  vestido_noble: {
    torso: (c, P) => (c.y === BELT_Y ? ((c.x + 99) % 2 ? P.brass : P.brassD) : c.front && (c.x === -1 || c.x === 0) && c.y > BELT_Y ? (c.y % 2 ? P.brass : P.clothD)
      : c.y >= c.H - 1 ? P.brassD : c.side ? P.clothD : P.cloth),
    sleeve: (r, L, P) => (r >= L - 1 ? P.brass : r <= 2 ? P.clothL : P.cloth),
    leg: (y, P) => boots(3, P)(y) ?? P.trouserD,
    skirt: { long: true, flare: 4, col: (y, len, P, c) => (y === 1 ? P.brassD : y === 0 ? P.clothDD : c.front && Math.abs(c.x + 0.5) <= 2 ? P.clothDD : P.cloth) },
  },
  tabardo: {
    torso: (c, P) => {
      const b = belt(c, P); if (b) return b;
      const panel = (c.front || c.back) && Math.abs(c.x + 0.5) <= c.hw - 3;
      if (panel && c.front && c.y >= c.H - 7 && c.y <= c.H - 3 && Math.abs(c.x + 0.5) + Math.abs(c.y - (c.H - 5)) <= 2) return P.brass;
      return panel ? (c.y >= c.H - 1 ? P.clothD : P.cloth) : chain(c.x, c.y, c.z, P);
    },
    sleeve: (r, L, P) => (r <= 1 ? P.cloth : chain(r, 0, 1, P)),
    hand: (P) => P.leather,
    leg: (y, P) => boots(7, P)(y) ?? P.trouserD,
    skirt: { len: 6, col: (y, len, P, c) => ((c.front || c.back) && Math.abs(c.x + 0.5) <= c.hw - 3 ? (y === 0 ? P.clothD : P.cloth) : y >= len - 3 ? chain(c.x, y, c.z, P) : null) },
  },
  capa_viaje: {
    torso: (c, P) => belt(c, P) || (strap(c) ? P.leather : fold(c, P, P.trouser)),
    sleeve: (r, L, P) => (r >= L - 4 ? P.leather : P.trouser),
    leg: (y, P) => boots(7, P)(y) ?? P.trouserD,
    skirt: { len: 3, col: (y, len, P) => P.trouser },
    cape: true, mantle: true,
  },
  pieles: {
    torso: (c, P) => (c.y === BELT_Y || c.y === BELT_Y - 1 ? (c.front && c.x === 2 ? P.clothD : P.cloth) : c.front && (c.x === -1 || c.x === 0) ? P.leatherD
      : c.y % 5 === 0 ? P.leatherD : P.leather),
    pauldron: (P) => P.fur,
    sleeve: (r, L, P) => (r % 3 === 2 ? P.leather : P.linenD),
    leg: (y, P) => (y < 5 ? P.leather : y < 7 ? P.fur : y % 3 === 0 ? P.leatherD : P.cloth),
    skirt: { len: 4, col: (y, len, P) => (y === 0 ? P.fur : P.leather) },
    mantle: 'fur',
  },
  abrigo: {
    torso: (c, P) => {
      if (c.y === BELT_Y || c.y === BELT_Y + 1) return c.front && (c.x === -1 || c.x === 0) ? P.brass : P.leather;
      if (c.front && c.y >= c.H - 5 && Math.abs(c.x + 0.5) >= 1 && Math.abs(c.x + 0.5) <= 3) return P.clothD;
      if (c.front && (c.x === -4 || c.x === 3) && c.y % 3 === 1 && c.y < c.H - 5) return P.brass;
      if (c.front && (c.x === -1 || c.x === 0)) return P.linenD;
      return fold(c, P, P.cloth);
    },
    sleeve: (r, L, P) => (r >= L - 2 ? P.clothD : P.cloth),
    leg: (y, P) => boots(8, P)(y) ?? P.trouser,
    skirt: { len: 11, flare: 6, col: (y, len, P, c) => (c.front && Math.abs(c.x + 0.5) <= 1.5 ? null : y === 0 ? P.clothDD : fold(c, P, P.cloth)) },
  },
  cota: {
    torso: (c, P) => belt(c, P) || (collar(c, 4) ? P.metalD : chain(c.x, c.y, c.z, P)),
    sleeve: (r, L, P) => chain(r, 1, 0, P),
    hand: (P) => P.leather,
    leg: (y, P) => boots(6, P)(y) ?? P.trouserD,
    skirt: { len: 5, col: (y, len, P, c) => chain(c.x, y, c.z, P) },
  },
  placas: {
    torso: (c, P) => {
      const b = belt(c, P); if (b) return b;
      if (c.front && (c.x === -1 || c.x === 0) && c.y > BELT_Y) return P.metalL;
      if (c.y % 4 === 0) return (c.front || c.back) && Math.abs(c.x + 0.5) === c.hw - 1.5 ? P.brass : P.metalD;
      return P.metal;
    },
    pauldron: (P) => P.metal, bigPauldron: true,
    sleeve: (r, L, P) => (r % 3 === 2 ? P.metalD : P.metal),
    hand: (P) => P.metalD,
    leg: (y, P) => (y < 2 ? P.metalD : y < 9 ? P.metal : y < 11 ? P.metalL : P.trouserD),
    skirt: { len: 5, col: (y, len, P, c) => (c.side ? null : y % 2 ? P.metal : P.metalD) },
  },
  archimago: {
    torso: (c, P) => (c.y === BELT_Y ? P.brassD : c.front && (c.x === -1 || c.x === 0 || c.x === -2 || c.x === 1) ? (Math.abs(c.x + 0.5) > 1 ? P.brassD : P.clothDD)
      : fold(c, P, P.clothD)),
    sleeve: (r, L, P) => (r >= L - 1 ? P.brass : P.clothD),
    wide: 6,
    leg: (y, P) => boots(3, P)(y) ?? P.trouserD,
    skirt: { long: true, flare: 4, col: (y, len, P, c) => (y === 0 ? P.brass : c.front && Math.abs(c.x + 0.5) <= 2 ? P.clothDD : fold(c, P, P.clothD)) },
    cape: true, mantle: true, highCollar: true,
  },
};
export const outfitOf = (id) => OUTFITS[id] || OUTFITS.viajero;

// ---------------- Cuerpo: torso, brazos, piernas, falda y capa ----------------
const bevel = (x, z, hw, hd) => (x === -hw || x === hw - 1) && (z === -hd || z === hd - 1);

/** Torso (con cuello y lo que cuelgue del cinturón). La cadera está en y = 0. */
export function drawTorso(v, look, D, P, gear) {
  const o = outfitOf(look.dress);
  const hw = D.W / 2, hd = Math.floor(D.D / 2), H = D.H;
  for (let y = 0; y < H; y++) {
    // cintura apenas más angosta en los esbeltos; hombros caídos en la fila de arriba
    const w = hw - (D.slim && y >= 2 && y <= 6 ? 1 : 0);
    for (let x = -w; x < w; x++) for (let z = -hd; z < hd; z++) {
      if (bevel(x, z, w, hd)) continue;
      if (y === H - 1 && (x === -w || x === w - 1)) continue;
      const c = { x, y, z, hw: w, hd, H, front: z === hd - 1, back: z === -hd, side: x === -w || x === w - 1 };
      let col = gear?.paint?.(c, P, look) ?? o.torso(c, P);
      if (look.type === 'vaciado' && hash3(x, y, z) < 0.08) col = P.veinD;   // la veta les come la ropa
      v.set(x, y, z, col === 'skin' ? P.skin : col);
    }
  }
  // cuello
  for (let y = H; y < H + D.neck; y++) v.box(-2, y, -2, 4, 1, 4, P.skinD);
  if (look.type === 'zorro') v.box(-3, H - 4, hd - 1, 6, 4, 1, (x, y) => (y === H - 1 || (x > -2 && x < 1) ? P.cream : null));   // pechera clara
  if (o.mantle) {
    const col = o.mantle === 'fur' ? (x, y, z) => (hash3(x, y, z) < 0.3 ? P.furD : hash3(x + 1, y, z) < 0.3 ? P.furL : P.fur) : (x, y) => (y === H - 3 ? P.clothDD : P.clothD);
    for (let y = H - 3; y < H + (o.mantle === 'fur' ? 1 : 0); y++) for (let x = -hw - 1; x < hw + 1; x++) for (let z = -hd - 1; z < hd + 1; z++) {
      const edge = x === -hw - 1 || x === hw || z === -hd - 1 || z === hd;
      if (edge && !(z === hd && Math.abs(x + 0.5) < 2 && y < H - 1)) v.set(x, y, z, col(x, y, z));
    }
    if (o.mantle !== 'fur') { v.set(-1, H - 2, hd, P.brass); v.set(0, H - 2, hd, P.brass); }   // broche
  }
  if (o.highCollar) v.box(-hw + 2, H, -hd - 1, 2 * hw - 4, 4, 2, (x, y) => (y === H + 3 ? P.brass : P.clothDD));
  o.extra?.(v, D, P);
  gear?.body?.(v, D, P, look);
}

/** Brazo (pivote en el hombro, cuelga hacia -Y). La mano son las 3 filas de abajo. */
export function drawArm(v, look, D, P) {
  const o = outfitOf(look.dress);
  const L = D.armL, a0 = -Math.floor(D.armW / 2), a1 = a0 + D.armW;
  const hand = o.hand ? o.hand(P) : P.skin;
  for (let r = 0; r < L; r++) {
    const y = -1 - r;
    const isHand = r >= L - 3;
    let col = isHand ? hand : o.sleeve(r, L - 3, P);
    if (col === 'skin') col = P.skin;
    const wide = o.wide && !isHand && r >= L - 3 - o.wide ? 1 : 0;
    for (let x = a0 - wide; x < a1 + wide; x++) for (let z = a0 - wide; z < a1 + wide; z++) {
      if (bevel(x, z, a1 + wide, -(a0 - wide)) && D.armW > 3) continue;
      v.set(x, y, z, wide && (x < a0 || x >= a1 || z < a0 || z >= a1) ? shade(col, -0.06) : col);
    }
    if (isHand && r === L - 3) v.set(0, y, a1, look.type === 'vaciado' ? P.skinD : hand);   // pulgar
    if (look.type === 'anuro' && r === L - 1) { v.set(a0 - 1, y, a1 - 1, P.skin); v.set(a1, y, a1 - 1, P.skin); }   // dedos largos
  }
  const pd = o.pauldron?.(P);
  if (pd) {
    const big = o.bigPauldron ? 1 : 0;
    for (let y = -3 - big; y < 1; y++) for (let x = a0 - 1; x < a1 + 1 + big; x++) for (let z = a0 - 1; z < a1 + 1; z++) {
      const shell = x === a0 - 1 || x >= a1 || z === a0 - 1 || z === a1 || y === 0;
      if (shell && !(x === a0 - 1 && y < 0)) v.set(x, y, z, y === -3 - big ? shade(pd, -0.15) : pd);
    }
  }
}

/** Pierna (pivote en la cadera, hacia -Y). leg(y) recibe la altura desde el piso. */
export function drawLeg(v, look, D, P) {
  const o = outfitOf(look.dress);
  const L = D.legH, l0 = -Math.floor(D.legW / 2), l1 = l0 + D.legW, d0 = -Math.floor(D.legD / 2), d1 = d0 + D.legD;
  const bare = look.type === 'anuro';
  for (let y = 0; y < L; y++) {
    let col = o.leg(y, P);
    if (bare && y < 3) col = P.skin;
    if (col === 'skin') col = P.skin;
    for (let x = l0; x < l1; x++) for (let z = d0; z < d1; z++) {
      if (bevel(x, z, l1, -d0) && y > 1) continue;
      v.set(x, y - L, z, col);
    }
    if (look.type === 'vaciado' && y > 6 && hash3(y, 3, 1) < 0.2) v.set(l0, y - L, d1 - 1, P.veinD);
  }
  // pie: la punta sale adelante (los anuros, pie ancho y palmeado)
  const foot = bare ? P.skinD : o.leg(0, P);
  if (bare) { v.box(l0 - 1, -L, d1, D.legW + 2, 1, 3, (x) => ((x - l0) % 2 ? P.skin : foot)); v.box(l0, -L + 1, d1, D.legW, 1, 1, P.skin); }
  else v.box(l0, -L, d1, D.legW, 2, 1, (x, y) => (y === -L + 1 ? shade(foot === 'skin' ? P.skin : foot, 0.06) : foot === 'skin' ? P.skin : foot));
}

/** Falda / faldón (va fija en el cuerpo, las piernas se mueven adentro). Arriba en y = 0. null si la ropa no tiene. */
export function drawSkirt(v, look, D, P) {
  const o = outfitOf(look.dress);
  const sk = o.skirt;
  if (!sk) return;
  const len = sk.long ? D.legH - 2 : Math.min(sk.len, D.legH - 3);
  const hw = D.W / 2, hd = Math.floor(D.D / 2);
  for (let i = 0; i < len; i++) {
    const y = -1 - i, fy = len - 1 - i;   // fy: alto desde el ruedo
    const f = sk.flare ? Math.floor(i / sk.flare) : 0;
    const w = hw + f - (D.slim && !sk.long ? 1 : 0), d = hd + f;
    for (let x = -w; x < w; x++) for (let z = -d; z < d; z++) {
      const edge = x === -w || x === w - 1 || z === -d || z === d - 1;
      if (!edge || bevel(x, z, w, d)) continue;
      const c = { x, y: fy, z, hw: w, hd: d, front: z === d - 1, back: z === -d, side: x === -w || x === w - 1 };
      const col = sk.col(fy, len, P, c);
      if (col != null) v.set(x, y, z, col);
    }
  }
}

/** Capa (pivote arriba de la espalda). */
export function drawCape(v, look, D, P) {
  const hw = D.W / 2 - 1, len = D.legH + D.H - 5;
  for (let i = 0; i < len; i++) for (let x = -hw; x < hw; x++) {
    const ragged = i === len - 1 && hash3(x, 7, 7) < 0.35;
    if (ragged) continue;
    v.set(x, -1 - i, -1, i === len - 1 || i === len - 2 ? P.clothDD : (x + i) % 9 === 0 ? P.clothDD : P.clothD);
  }
}

/** Cola de la gente-zorro (pivote en la base, hacia atrás y abajo). */
export function drawTail(v, look, D, P) {
  for (let i = 0; i < 13; i++) {
    const r = i < 2 ? 1.6 : i < 10 ? 2.6 : 2.2 - (i - 10) * 0.5;
    const cy = -i * 0.55 + (i > 8 ? (i - 8) * 0.9 : 0);
    const col = i >= 10 ? P.cream : (hash3(i, 1, 2) < 0.2 ? P.skinD : P.skin);
    v.sphere(0, cy, -i, r, r, 0.7, col);
  }
}

// ---------------- Cabeza ----------------
// Grilla: x en [-hw/2, hw/2), y en [0, hh), z en [-hd/2, hd/2). La cara mira a +Z (capa z = fz).
function headBox(v, D, P, look) {
  const W = D.hw / 2, Dz = Math.ceil(D.hd / 2), zb = -Math.floor(D.hd / 2), hh = D.hh;
  const t = look.type;
  for (let y = 0; y < hh; y++) for (let x = -W; x < W; x++) for (let z = zb; z < Dz; z++) {
    const cx = x === -W || x === W - 1, cz = z === zb || z === Dz - 1;
    if (cx && cz) continue;   // esquinas biseladas
    if ((y === hh - 1) && (cx || cz)) continue;   // cráneo redondeado
    if (y === 0 && cx && (D.slim || t === 'zorro')) continue;   // mandíbula
    if (t === 'anuro' && y >= hh - 2 && (cx || cz || x === -W + 1 || x === W - 2)) continue;   // cabeza chata
    let col = P.skin;
    if (t === 'anuro' && y === 0) col = P.skinL;   // garganta clara
    if (t === 'zorro' && z >= Dz - 2 && y <= 3 && Math.abs(x + 0.5) < W - 1) col = P.cream;
    if (t === 'vaciado' && hash3(x * 3, y, z) < 0.07) col = P.veinD;
    v.set(x, y, z, col);
  }
  return { W, fz: Dz - 1, zb };
}
const EYE = { humano: 6, enano: 6, orco: 7, zorro: 6, vaciado: 6, anuro: 7 };

/** Ojos (malla aparte para parpadear): devuelve la lista de [x, y, z, color]. */
export function eyeVoxels(look, D, P) {
  const t = look.type, W = D.hw / 2, fz = Math.ceil(D.hd / 2) - 1;
  const ey = EYE[t] ?? 6;
  const out = [];
  if (t === 'anuro') {
    for (const s of [-1, 1]) { const x0 = s < 0 ? -W + 1 : W - 4; out.push([x0, ey + 1, fz - 1, P.iris], [x0 + 1, ey + 1, fz - 1, 0x1a1410], [x0 + 2, ey + 1, fz - 1, P.iris], [x0, ey, fz - 1, shade(P.iris, -0.25)], [x0 + 1, ey, fz - 1, shade(P.iris, -0.25)], [x0 + 2, ey, fz - 1, shade(P.iris, -0.25)]); }
    return out;
  }
  const inner = t === 'enano' || t === 'orco' ? 2 : 1;
  for (const s of [-1, 1]) {
    const xi = s < 0 ? -inner - 1 : inner, xo = s < 0 ? xi - 1 : xi + 1;
    if (look.face === 'cicatriz_ojo' && s < 0) continue;
    if (look.face === 'parche' && s < 0) continue;
    out.push([xi, ey, fz, P.iris], [xo, ey, fz, t === 'zorro' || t === 'vaciado' ? P.iris : P.sclera]);
  }
  return out;
}

/** Cabeza completa: cráneo, cara, orejas, pelo (lo que no se balancea), barba o marcas y lo que lleva en la cabeza. */
export function buildHead(v, look, D, P) {
  const t = look.type;
  const { W, fz, zb } = headBox(v, D, P, look);
  const hh = D.hh, ey = EYE[t] ?? 6;
  const eyes = eyeVoxels(look, D, P);
  const browC = look.hair === 'rapado' || t === 'anuro' || t === 'vaciado' ? P.skinDD : P.hairD;
  if (t === 'anuro') {
    // ojos saltones arriba, boca ancha que cae en las puntas, dos fosas
    for (const s of [-1, 1]) { const x0 = s < 0 ? -W + 1 : W - 4; v.box(x0 - 1, ey - 1, fz - 4, 5, 4, 4, P.skin); v.box(x0 - 1, ey + 2, fz - 1, 5, 1, 1, P.skinD); v.box(x0 - 1, ey + 3, fz - 3, 5, 1, 2, P.skinD); }
    for (let x = -W + 1; x < W - 1; x++) v.set(x, 2, fz, P.skinDD);
    v.set(-W + 1, 1, fz, P.skinDD); v.set(W - 2, 1, fz, P.skinDD);
    v.set(-1, 5, fz + 1, P.skinD); v.set(0, 5, fz + 1, P.skinD); v.set(-1, 5, fz, P.skinDD); v.set(0, 5, fz, P.skinDD);
    for (let x = -2; x < 2; x++) v.set(x, 3, fz + 1, P.skin);   // labio
  } else if (t === 'zorro') {
    v.box(-2, 1, fz + 1, 4, 4, 2, (x, y, z) => (y <= 2 ? P.cream : P.skin));   // hocico que se afina
    v.box(-1, 1, fz + 3, 2, 3, 2, (x, y, z) => (y <= 1 ? P.cream : P.skin));
    v.set(-1, 3, fz + 5, P.ink); v.set(0, 3, fz + 5, P.ink);   // nariz
    v.set(-2, 1, fz + 2, P.skinDD); v.set(1, 1, fz + 2, P.skinDD);   // comisuras
    for (const s of [-1, 1]) {   // cachetes y orejas
      const xe = s < 0 ? -W - 1 : W;
      v.box(xe, 1, fz - 3, 1, 3, 3, P.cream);
      for (let r = 0; r < 5; r++) {
        const w = [3, 3, 2, 2, 1][r], x0 = s < 0 ? -W + 1 : W - 1 - w;
        for (let x = x0; x < x0 + w; x++) { v.set(x, hh + r, -1, P.skinD); v.set(x, hh + r, 0, r < 3 && w === 3 && x === x0 + 1 ? P.skinDD : P.skin); }
      }
    }
    for (const s of [-1, 1]) { const x0 = s < 0 ? -4 : 2; v.box(x0, ey + 1, fz + 1, 2, 1, 1, P.skinDD); }   // ceño
  } else {
    // nariz, boca, pómulos, orejas
    const big = t === 'enano' ? 1 : 0;
    v.box(-1, 4 - big, fz + 1, 2, 2 + big, 1 + big, P.skin); v.set(-1, 4 - big, fz + 1, P.skinD); v.set(0, 4 - big, fz + 1, P.skinD);
    if (big) v.box(-1, 3, fz + 2, 2, 1, 1, P.skinD);
    for (let x = -2; x < 2; x++) v.set(x, 2, fz, P.skinDD);
    v.set(-1, 1, fz, P.skinD); v.set(0, 1, fz, P.skinD);
    v.set(-W + 1, 4, fz, P.skinD); v.set(W - 2, 4, fz, P.skinD);
    if (t === 'vaciado') { v.set(-W + 1, 3, fz, P.skinDD); v.set(W - 2, 3, fz, P.skinDD); }
    for (const s of [-1, 1]) {
      const xe = s < 0 ? -W - 1 : W;
      if (t === 'orco') { v.box(xe, 6, -2, 1, 2, 2, P.skin); v.set(xe + s, 7, -2, P.skin); v.set(xe + s, 8, -2, P.skin); v.set(xe + 2 * s, 9, -2, P.skinD); }
      else { v.box(xe, 4, -1, 1, 3, 2, P.skin); v.set(xe, 5, -1, P.skinD); }
    }
    // ceño: cejas que salen y el entrecejo marcado (orcos: frente pesada)
    if (t === 'orco') { v.box(-W + 1, ey + 1, fz + 1, 2 * W - 2, 1, 1, P.skinD); v.box(-3, 0, fz + 1, 6, 3, 1, P.skin); for (const x of [-4, 3]) { v.set(x, 3, fz + 2, P.bone); v.set(x, 4, fz + 2, P.bone); } }
    else {
      for (const s of [-1, 1]) { const x0 = s < 0 ? -W + 1 : 1; for (let i = 0; i < W - 1; i++) v.set(x0 + i, ey + 1, fz + 1, browC); }
      v.set(-1, ey + 1, fz + 1, P.skinD); v.set(0, ey + 1, fz + 1, P.skinD);
    }
  }
  for (const [x, y, z] of eyes) { v.remove(x, y, z); v.set(x, y, z - 1, P.skinDD); }   // cuencas (los ojos van aparte)
  drawHair(v, look, D, P, { W, fz, zb });
  drawFace(v, look, D, P, { W, fz, zb, ey });
  drawHat(v, look, D, P, { W, fz, zb });
}

// ---------------- Pelo ----------------
const HAIR_SHAPES = {
  rapado: { stubble: true },
  cortito: { cap: 1, side: 8, back: 4, fringe: 1 },
  despeinado: { cap: 1, side: 7, back: 4, fringe: 2, spikes: true },
  coleta: { cap: 1, side: 8, back: 4, fringe: 1, swing: 'coleta' },
  largo: { cap: 1, side: 0, back: -5, fringe: 2, long: true },
  corto: { cap: 1, side: 3, back: 2, fringe: 2 },
  flequillo: { cap: 1, side: 7, back: 4, fringe: 3, sweep: true },
  rodete: { cap: 1, side: 8, back: 5, fringe: 1, bun: true },
  jopo: { stubble: true, crest: true },
  trenzas: { cap: 1, side: 4, back: 0, fringe: 1, swing: 'trenzas' },
  rizos: { cap: 2, side: 4, back: 2, fringe: 2, curls: true },
  colitas: { cap: 1, side: 6, back: 3, fringe: 1, swing: 'colitas' },
  ondas: { cap: 1, side: -1, back: -6, fringe: 2, long: true, wavy: true },
  lomo: { spots: true }, cresta_piel: { ridge: true },
};
export const hairShape = (id) => HAIR_SHAPES[id] || HAIR_SHAPES.cortito;
/** Alto del pelo sobre el cráneo (para apoyar sombreros). */
export function hairTop(look, D) { const h = hairShape(look.hair); return D.hh + (h.cap || 0) + (h.crest ? 3 : 0); }

function drawHair(v, look, D, P, g) {
  const t = look.type, h = hairShape(look.hair), hh = D.hh, { W, fz, zb } = g;
  const hc = (x, y, z) => (hash3(x, y * 5, z) < 0.18 ? P.hairD : hash3(x + 3, y, z) < 0.1 ? P.hairL : P.hair);
  if (t === 'anuro') {
    if (h.spots) for (const [k, c] of v.map) { const [x, y, z] = k.split(',').map(Number); if (c === P.skin && y >= 3 && hash3((x + 40) >> 1, (y + 40) >> 1, (z + 40) >> 1) < 0.22) v.map.set(k, P.hair); }
    if (h.ridge) for (let z = zb; z < fz - 1; z++) { v.set(-1, hh, z, P.hair); v.set(0, hh, z, P.hair); if (z < zb + 4) { v.set(-1, hh + 1, z, P.hairD); v.set(0, hh + 1, z, P.hairD); } }
    return;
  }
  if (h.stubble) {   // rapado o cresta: el cuero cabelludo apenas oscuro
    const st = mix(P.skin, P.hair, 0.45);
    for (const [k, c] of v.map) { const [x, y, z] = k.split(',').map(Number); if (c === P.skin && y >= hh - 3 && z < fz - 1) v.map.set(k, st); }
    if (h.crest) for (let z = zb; z < fz + 1; z++) for (let y = hh; y < hh + 3 - (z === fz ? 1 : 0); y++) { v.set(-1, y, z, hc(-1, y, z)); v.set(0, y, z, hc(0, y, z)); }
    return;
  }
  if (t === 'zorro') {   // la gente-zorro lleva el pelo como melena corta entre las orejas
    for (let z = zb; z < fz; z++) for (let x = -2; x < 2; x++) v.set(x, hh, z, hc(x, hh, z));
    for (let y = 2; y < hh; y++) for (let x = -W + 1; x < W - 1; x++) v.set(x, y, zb - 1, hc(x, y, zb - 1));
    if (h.long) for (let y = -6; y < 2; y++) for (let x = -W + 2; x < W - 2; x++) v.set(x, y, zb - 1, hc(x, y, zb - 1));
    return;
  }
  // gorro de pelo arriba
  for (let c = 0; c < (h.cap || 0); c++) for (let x = -W; x < W; x++) for (let z = zb - 1; z < fz + 1; z++) {
    if ((x === -W || x === W - 1) && (z === zb - 1 || z === fz)) continue;
    if (c === 1 && (x === -W || x === W - 1 || z === zb - 1 || z === fz)) continue;
    v.set(x, hh + c, z, hc(x, hh + c, z));
  }
  if (h.curls) for (let x = -W; x < W; x++) for (let z = zb - 1; z < fz; z++) if (hash3(x, 2, z) < 0.35) v.set(x, hh + 2, z, P.hairD);
  if (h.spikes) for (let x = -W + 1; x < W - 1; x++) for (let z = zb; z < fz; z++) if (hash3(x, 9, z) < 0.3) v.set(x, hh + 1, z, hc(x, hh + 1, z));
  // costados (arriba de las orejas o hasta abajo si es largo), nuca y flequillo
  const sideFrom = h.long ? (h.side ?? 0) : Math.max(h.side, 0);
  for (const s of [-1, 1]) {
    const x = s < 0 ? -W - 1 : W;
    for (let y = sideFrom; y < hh; y++) for (let z = zb; z < (h.long ? fz - 1 : fz - 2); z++) {
      if (!h.long && y < 7 && z > -2) continue;   // deja ver la oreja
      const wave = h.wavy && (y + z) % 3 === 0 ? 1 : 0;
      v.set(x + s * wave, y, z, hc(x, y, z));
    }
  }
  for (let y = h.back; y < hh; y++) for (let x = -W + (y < 0 ? 1 : 0); x < W - (y < 0 ? 1 : 0); x++) v.set(x, y, zb - 1, hc(x, y, zb - 1));
  for (let i = 0; i < (h.fringe || 0); i++) {
    const y = hh - 1 - i;
    for (let x = -W; x < W; x++) {
      if (h.sweep && x > 1 - i * 2) continue;
      if (!h.sweep && i > 0 && Math.abs(x + 0.5) < W - 1) continue;
      v.set(x, y, fz + 1 - (i > 0 && !h.sweep ? 1 : 0), hc(x, y, fz));
    }
  }
  if (h.bun) v.sphere(-0.5, hh - 1, zb - 3, 2.6, 2.4, 2, hc);
}

/** Pelo que se balancea: [{ at:[x,y,z], build(v), mirror, sway }] en coordenadas de la cabeza. */
export function hairSwings(look, D, P) {
  const h = hairShape(look.hair), W = D.hw / 2, zb = -Math.floor(D.hd / 2);
  if (!h.swing || look.type === 'anuro') return [];
  const hc = (y) => (y % 3 === 0 ? P.hairD : P.hair);
  if (h.swing === 'coleta') return [{ at: [0, D.hh - 2, zb - 1], sway: 1, build: (v) => { v.box(-1, -1, -2, 2, 2, 2, P.leatherD); for (let i = 0; i < 9; i++) v.box(-1, -2 - i, -2 - (i < 3 ? 1 : 0), 2, 1, 2, hc(i)); } }];
  if (h.swing === 'colitas') return [-1, 1].map(s => ({ at: [s * (W - 1), 4, zb], mirror: s < 0, sway: 0.8, build: (v) => { v.box(0, -1, -2, 2, 2, 2, P.leatherD); for (let i = 0; i < 8; i++) v.box(0, -2 - i, -2, 2, 1, 2, hc(i)); } }));
  // trenzas: caen adelante de los hombros
  return [-1, 1].map(s => ({ at: [s * W, 3, -1], mirror: s < 0, sway: 0.6, build: (v) => {
    for (let i = 0; i < 12; i++) v.box(0, -1 - i, (i % 2), 2, 1, 2, i === 10 ? P.leatherD : hc(i));
  } }));
}

// ---------------- Cara: barbas, cicatrices, pintura ----------------
function drawFace(v, look, D, P, g) {
  const f = look.face, { W, fz, ey } = g;
  if (!f || f === 'ninguna') return;
  const bc = (x, y, z) => (hash3(x, y * 7, z) < 0.2 ? P.hairD : P.hair);
  const beard = (len, braid) => {
    for (let y = 0; y < 4; y++) for (let x = -W; x < W; x++) {
      if (y >= 2 && Math.abs(x + 0.5) < 2.5) continue;   // boca libre
      v.set(x, y, fz + 1, bc(x, y, fz + 1));
      if (Math.abs(x + 0.5) >= W - 1) for (let z = fz - 3; z <= fz; z++) v.set(x, y + 2, z, bc(x, y, z));   // patillas
    }
    for (let x = -3; x < 3; x++) v.set(x, 3, fz + 1, bc(x, 3, fz + 1));   // bigote
    v.set(-3, 2, fz + 1, P.hair); v.set(2, 2, fz + 1, P.hair);
    for (let i = 0; i < len; i++) {
      const w = Math.max(2, W - 1 - Math.floor(i / 2));
      for (let x = -w; x < w; x++) for (let z = fz - 2; z <= fz + 1; z++) v.set(x, -1 - i, z, bc(x, -i, z));
    }
    if (braid) { for (let i = 0; i < 5; i++) v.box(-1, -1 - len - i, fz, 2, 1, 2, i === 2 ? P.brass : bc(0, i, 0)); }
  };
  if (f === 'barba_corta') beard(2);
  else if (f === 'barba_larga') beard(look.type === 'enano' ? 9 : 6);
  else if (f === 'barba_trenzada') beard(look.type === 'enano' ? 6 : 4, true);
  else if (f === 'bigote') { for (let x = -3; x < 3; x++) v.set(x, 3, fz + 1, bc(x, 3, 0)); v.set(-4, 2, fz + 1, P.hair); v.set(3, 2, fz + 1, P.hair); v.set(-4, 1, fz + 1, P.hairD); v.set(3, 1, fz + 1, P.hairD); }
  else if (f === 'cicatriz') { for (let i = 0; i < 4; i++) v.set(W - 2 - (i >> 1), 2 + i, fz + (look.type === 'zorro' ? 0 : 0), P.scar); }
  else if (f === 'cicatriz_ojo') { const x = look.type === 'enano' || look.type === 'orco' ? -3 : -2; for (let y = ey - 3; y <= ey + 2; y++) v.set(x, y, fz + (y === ey + 1 ? 1 : 0), P.scar); v.set(x - 1, ey, fz, P.skinDD); v.set(x + 1, ey, fz, P.skinDD); }
  else if (f === 'pintura') { for (const x of [-3, -2, 1, 2]) for (let y = ey - 3; y < ey; y++) v.set(x, y, fz, 0x2a2224); for (let x = -W + 1; x < W - 1; x++) if (!v.has(x, ey + 2, fz + 1)) v.set(x, ey + 2, fz, 0x5a2a22); }
  else if (f === 'parche') {
    const x = look.type === 'enano' || look.type === 'orco' ? -3 : -2;
    v.box(x - 1, ey - 1, fz + 1, 3, 3, 1, P.ink);
    for (let i = 0; i < W * 2; i++) { const xx = -W + i; const yy = ey + 1 + Math.round(i * 0.25); if (yy < D.hh) v.set(xx, yy, fz + 1, P.leatherD); }
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
  const shell = (y0, y1, col, front = true) => {
    for (let y = y0; y < y1; y++) for (let x = -W - 1; x < W + 1; x++) for (let z = zc0; z <= zc1 - (front ? 0 : 1); z++) {
      const out = x === -W - 1 || x === W || z === zc0 || z === zc1 || y === y1 - 1;
      if (!out || ((x === -W - 1 || x === W) && (z === zc0 || z === zc1))) continue;
      v.set(x, y, z, typeof col === 'function' ? col(x, y, z) : col);
    }
  };
  const cloth = (x, y, z) => (hash3(x, y, z) < 0.15 ? P.clothDD : P.clothD);
  switch (id) {
    case 'capucha': {
      for (let y = 2; y < hh + 2; y++) for (let x = -W - 1; x < W + 1; x++) for (let z = zc0 - 1; z <= zc1; z++) {
        const out = x === -W - 1 || x === W || z === zc0 - 1 || y === hh + 1 || (z === zc1 && (Math.abs(x + 0.5) >= W - 1 || y >= hh - 1));
        if (out && !((x === -W - 1 || x === W) && z === zc0 - 1)) v.set(x, y, z, z === zc1 ? P.clothDD : cloth(x, y, z));
      }
      v.box(-W, -2, zc0 - 1, 2 * W, 4, 2, cloth);   // cae sobre la espalda
      break;
    }
    case 'gorro': shell(hh - 3, top + 3, (x, y) => (y === hh - 3 || y === hh - 2 ? P.clothDD : (x + y) % 2 ? P.clothD : P.cloth)); break;
    case 'vincha': for (let x = -W - 1; x < W + 1; x++) for (let z = zc0; z <= zc1; z++) if (x === -W - 1 || x === W || z === zc0 || z === zc1) v.set(x, hh - 3, z, P.leather);
      v.box(-1, hh - 5, zc0 - 1, 2, 3, 1, P.leatherD); break;
    case 'gorra': for (let y = top; y < top + 2; y++) ring(v, y, R + (y === top ? 1 : 0), zc0 - 1, zc1, (x) => (x > 2 ? P.clothDD : P.clothD), 0.5); v.set(1, top + 2, -1, P.clothDD); break;
    case 'bandana':
      shell(hh - 4, top + 1, (x, y, z) => ((x + z) % 4 === 0 ? P.clothL : P.cloth));
      v.box(-1, hh - 6, zc0 - 1, 2, 3, 1, P.cloth); v.box(-2, hh - 9, zc0 - 1, 1, 3, 1, P.clothD); v.box(1, hh - 9, zc0 - 1, 1, 3, 1, P.clothD);
      break;
    case 'sombrero_mago': {
      ring(v, top, R + 4, zc0 - 4, zc1 + 3, (x, y, z) => (hash3(x, 1, z) < 0.15 ? P.clothDD : P.clothD));
      ring(v, top + 1, R, zc0, zc1, P.leatherD);
      for (let i = 0; i < 10; i++) { const r = Math.max(0.6, R - i * 0.62); ring(v, top + 2 + i, r, Math.round(zc0 + i * 0.5), Math.round(zc1 - i * 0.6) - (i > 6 ? 2 : 0), P.clothD); }
      break;
    }
    case 'piluso': {
      ring(v, top, R + 5, zc0 - 5, zc1 + 5, (x, y, z) => ((x + z) % 3 === 0 ? P.strawD : P.straw));
      for (let y = top + 1; y < top + 5; y++) ring(v, y, R - (y === top + 4 ? 1 : 0), zc0, zc1, y === top + 1 ? 0x5a2a22 : P.straw);
      break;
    }
    case 'galera': {
      ring(v, top, R + 3, zc0 - 3, zc1 + 3, P.leatherD);
      for (let y = top + 1; y < top + 5; y++) ring(v, y, R - 0.5, zc0, zc1, y === top + 1 ? P.leather : P.leatherD);
      v.set(-1, top + 4, -1, null); v.set(0, top + 4, -1, null);
      break;
    }
    case 'casco': case 'yelmo': {
      shell(hh - 5, top + 2, (x, y, z) => (y === hh - 5 ? P.metalD : y === top + 1 && Math.abs(x + 0.5) < 2 ? P.metalL : P.metal));
      v.box(-1, 2, zc1 + 1, 2, hh - 6, 1, P.metalD);   // nasal
      for (const x of [-W - 1, W]) v.box(x, 1, fz - 4, 1, hh - 6, 4, P.metalD);   // carrilleras
      for (let x = -W - 1; x < W + 1; x++) for (let z = zc0; z < zc1; z++) if (v.get(x, hh - 5, z) === P.metalD && (x + z) % 3 === 0) v.set(x, hh - 4, z, P.brass);
      if (id === 'yelmo') for (const s of [-1, 1]) for (let i = 0; i < 7; i++) {
        const x = s < 0 ? -W - 2 - Math.min(i, 3) : W + 1 + Math.min(i, 3), y = hh - 2 + Math.max(0, i - 2);
        v.set(x, y, -1, i > 4 ? P.bone : mix(P.bone, 0x6a5a44, 0.3)); v.set(x, y, 0, i > 5 ? null : P.bone);
      }
      break;
    }
  }
}

// ---------------- Equipo ----------------
// Cada pieza dice dónde va: hand (mano derecha), off (mano izquierda), body (en el cuerpo), shoulder (hombro izquierdo).
// pose: brazos (rx/rz y lx/lz en radianes). Coordenadas de la mano: brazo de largo L, la mano en y = -L.. -L+3.
const blade = (v, L, aw, len, w = 1) => {
  const z0 = aw + 2;
  v.box(-2, -L + 1, z0, 4, 1, 1, MAT.brass);   // guarda
  v.box(-1, -L + 1, aw, 1, 1, 2, MAT.leatherD);   // empuñadura
  for (let i = 0; i < len; i++) v.box(-1, -L + 1, z0 + 1 + i, w, 2, 1, (x, y) => (i === len - 1 && y === -L + 2 ? null : y === -L + 2 ? MAT.metalL : MAT.metal));
  v.set(-1, -L + 1, aw - 1, MAT.brassD);
};
const haft = (v, L, aw, z0, z1) => { for (let z = z0; z < z1; z++) v.set(-1, -L + 1, z, (z % 4 === 0) ? MAT.woodD : MAT.wood); };
export const GEAR = {
  espada: { hand: (v, D) => blade(v, D.armL, Math.ceil(D.armW / 2), 11), pose: { rx: -0.55, rz: 0.05 } },
  hacha: { hand: (v, D) => {
    const L = D.armL, aw = Math.ceil(D.armW / 2);
    haft(v, L, aw, -3, aw + 12);
    for (let i = 0; i < 6; i++) for (let z = aw + 7 + (i > 3 ? -1 : 0); z < aw + 11 + (i > 3 ? 1 : 0); z++) v.set(-1, -L + 2 + i, z, i === 5 || z === aw + 10 + (i > 3 ? 1 : 0) ? MAT.metalL : MAT.metal);
  }, pose: { rx: -0.5, rz: 0.06 } },
  martillo: { hand: (v, D) => {
    const L = D.armL, aw = Math.ceil(D.armW / 2);
    haft(v, L, aw, -2, aw + 10);
    v.box(-3, -L - 1, aw + 9, 5, 5, 4, (x, y, z) => (y === -L + 3 ? MAT.metalL : x === -3 || x === 1 ? MAT.metalD : MAT.metal));
  }, pose: { rx: -0.45, rz: 0.06 } },
  lanza: { hand: (v, D) => {
    const L = D.armL;
    for (let y = -L - 14; y < -L + 30; y++) v.set(-1, y, 1, y % 5 === 0 ? MAT.woodD : MAT.wood);
    for (let i = 0; i < 5; i++) v.box(-1 - (i < 2 ? 1 : 0), -L + 30 + i, 1, i < 2 ? 3 : 1, 1, 1, i === 4 ? MAT.metalL : MAT.metal);
    v.box(-2, -L + 29, 0, 3, 1, 3, MAT.leatherD);
  }, pose: { rx: 0, rz: 0.04 }, still: true },
  baston: { hand: (v, D, P) => {
    const L = D.armL;
    for (let y = -L - 14; y < -L + 24; y++) v.set(-1, y, 1, y % 6 === 0 ? MAT.woodD : MAT.wood);
    v.box(-2, -L + 24, 0, 3, 3, 3, MAT.woodD); v.set(-1, -L + 27, 1, MAT.vein);
  }, pose: { rx: 0, rz: 0.04 }, still: true },
  libro: { off: (v, D) => {
    const L = D.armL, aw = Math.ceil(D.armW / 2);
    v.box(-3, -L - 1, aw, 6, 5, 2, (x, y, z) => (z === aw + 1 && x > -3 && x < 2 && y > -L - 1 && y < -L + 3 ? MAT.linenD : MAT.leatherD));
  }, pose: { lx: -0.75, lz: 0.1 } },
  escudo: { off: (v, D) => {
    const L = D.armL, aw = Math.ceil(D.armW / 2), cy = -L + 5;
    for (let x = -7; x <= 6; x++) for (let y = cy - 7; y <= cy + 6; y++) {
      const dx = x + 0.5, dy = y - cy + 0.5, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 6.8) continue;
      v.set(x, y, aw + 1, d > 5.8 ? MAT.metalD : d < 1.6 ? MAT.metalL : (x + 99) % 3 === 0 ? MAT.woodD : MAT.wood);
      if (d < 1.6) v.set(x, y, aw + 2, MAT.metal);
    }
  }, pose: { lz: -0.18 } },
  arco: { off: (v, D) => {
    const L = D.armL;
    for (let i = -12; i <= 12; i++) { const z = 3 + Math.round(Math.cos((i / 12) * Math.PI / 2) * 3); v.set(-1, -L + 1 + i, z, Math.abs(i) < 2 ? MAT.leatherD : MAT.wood); v.set(-1, -L + 1 + i, 2, Math.abs(i) > 11 ? null : (i === 0 ? null : MAT.linenD)); }
  }, pose: { lz: -0.12 } },
  farolito: { hand: (v, D) => {
    const L = D.armL;
    v.set(-1, -L - 1, 1, MAT.metalD);
    v.box(-3, -L - 7, -1, 5, 6, 5, (x, y, z) => ((x === -3 || x === 1) && (z === -1 || z === 3) || y === -L - 7 || y === -L - 2 ? MAT.metalD : null));
  }, light: (v, D) => v.box(-2, -D.armL - 6, 0, 3, 4, 3, (x, y) => (y === -D.armL - 3 ? 0xe8b866 : 0xd08a3a)), pose: { rz: 0.1 } },
  orbe: { off: (v, D) => { const L = D.armL, aw = Math.ceil(D.armW / 2); v.box(-2, -L - 1, aw - 1, 3, 1, 3, MAT.leatherD); },
    offLight: (v, D) => { const L = D.armL, aw = Math.ceil(D.armW / 2); v.box(-1, -L, aw, 1, 4, 1, MAT.vein); v.box(-2, -L, aw - 1, 1, 2, 1, MAT.veinD); v.box(0, -L, aw + 1, 1, 3, 1, MAT.veinD); },
    pose: { lx: -0.65, lz: 0.08 } },
  catalejo: { body: (v, D) => { const hw = D.W / 2; v.box(-hw - 2, 0, -3, 2, 2, 7, (x, y, z) => (z === 3 || z === -3 ? MAT.brassD : MAT.brass)); } },
  mochila: {
    body: (v, D, P) => {
      const hw = D.W / 2, hd = Math.floor(D.D / 2), H = D.H;
      v.box(-hw + 2, H - 12, -hd - 4, 2 * hw - 4, 10, 4, (x, y, z) => (y === H - 7 ? MAT.leatherD : z === -hd - 4 && Math.abs(x + 0.5) < 2 && y < H - 7 ? MAT.leather : 0x5e5442));
      for (let x = -hw + 1; x < hw - 1; x++) for (const [y, z] of [[H - 2, -hd - 3], [H - 2, -hd - 2], [H - 1, -hd - 3], [H - 1, -hd - 2]]) v.set(x, y, z, x % 4 === 0 ? MAT.leatherD : 0x6e5f4a);
    },
    paint: (c, P) => ((c.front && Math.abs(Math.abs(c.x + 0.5) - (c.hw - 3.5)) < 1 && c.y > 4) ? MAT.leatherD : undefined),
  },
  bolso: {
    body: (v, D) => { const hw = D.W / 2; v.box(hw - 1, -3, -1, 3, 6, 5, (x, y, z) => (y === 2 ? MAT.leatherD : z === 3 && y === 0 ? MAT.brass : MAT.leather)); },
    paint: (c, P) => (strap(c, 2) ? MAT.leatherD : undefined),
  },
  collar: { paint: (c, P) => (c.front && c.y === c.H - 5 && (c.x === -1 || c.x === 0) ? (c.x ? MAT.vein : MAT.veinD)
    : c.front && ((c.y === c.H - 4 && Math.abs(c.x + 0.5) === 1.5) || (c.y === c.H - 3 && Math.abs(c.x + 0.5) === 2.5) || (c.y === c.H - 2 && Math.abs(c.x + 0.5) === 3.5)) ? MAT.brassD : undefined) },
  buho: { body: (v, D) => {   // un cuervo en el hombro izquierdo
    const hw = D.W / 2, H = D.H, x0 = -hw - 4;
    v.box(x0, H, -2, 3, 3, 5, MAT.crow); v.box(x0, H + 3, 1, 3, 3, 3, MAT.crow);
    v.set(x0 + 1, H + 4, 4, 0x4a4238); v.set(x0 + 1, H + 3, 4, 0x3a342c); v.set(x0, H + 4, 3, 0x8a7a40); v.set(x0 + 2, H + 4, 3, 0x8a7a40);
    v.box(x0, H + 1, -4, 3, 1, 2, MAT.crow); v.set(x0 - 1, H + 1, -1, 0x2a272e); v.set(x0 + 3, H + 1, -1, 0x2a272e);
  } },
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
