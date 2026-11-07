// Ropa de los personajes: torso, mangas, piernas y capas de cada conjunto (vestidos, chaquetas, buzos,
// túnicas, ropa de animalitos). Lo usa avatar.js.
// Coordenadas del cuerpo: torso x [-3,3), y [4,10), z [-2,2). Piernas debajo de y=4.
import {
  INK, WHITE, GOLD, GOLD_D, GOLD_L, SILVER, SILVER_D, SILVER_L, DENIM, DENIM_D, DENIM_L, BOOT, BOOT_L,
  mix, hash3, shade, hexToInt, outfitHex, skinHex,
} from './avatar-kit.js';

export function skirt(v, y0, y1, rBot, rTop, col, rz = 0.86) {
  for (let y = y0; y <= y1; y++) {
    const t = y1 === y0 ? 1 : (y - y0) / (y1 - y0);
    const r = rBot + (rTop - rBot) * t;
    const R = Math.ceil(r) + 1;
    for (let x = -R; x < R; x++) for (let z = -R; z < R; z++) {
      const cx = x + 0.5, cz = z + 0.5;
      if ((cx / r) ** 2 + (cz / (r * rz)) ** 2 <= 1) v.set(x, y, z, col(x, y, z, r));
    }
  }
}
const isFront = (z) => z >= 1;
/** Paleta de la ropa. En animalitos p.skin es un color marcador que después se repinta con el pelaje. */
export const FUR_MARK = 0xfe00fe;
export function dressPal(look, animal = false) {
  const c = hexToInt(outfitHex(look.dressColor));
  return { c, d: shade(c, -0.18), dd: shade(c, -0.32), l: shade(c, 0.35), ll: shade(c, 0.6), skin: animal ? FUR_MARK : hexToInt(skinHex(look.skin)), colorId: look.dressColor };
}

// Cada vestido: torso(v,p,seated), arm: estilo de manga, leg(v,p): pierna local x[-1,1) y[-4,0) z[-1,1)
export const DRESS = {
  clasico: {
    torso(v, p, seated) {
      v.box(-3, 6, -2, 6, 4, 4, p.c);
      v.box(-3, 5, -2, 6, 1, 4, p.ll);
      v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
      v.set(-2, 9, 1, p.l); v.set(1, 9, 1, p.l);
      v.set(-2, 5, 2, p.ll); v.set(1, 5, 2, p.ll); v.set(-1, 5, 2, p.l); v.set(0, 5, 2, p.l);
      v.set(-2, 6, 2, p.ll); v.set(1, 6, 2, p.ll);
      if (seated) { v.box(-3, 4, -2, 6, 1, 4, p.c); return; }
      skirt(v, 1, 4, 5.3, 3.8, (x, y) => (y === 1 ? p.l : y === 2 ? shade(p.c, -0.06) : p.c));
    },
    arm: 'puff', leg: (v, p) => { legBase(v, p.skin, p.skin, p.dd); },
  },
  corto: {
    torso(v, p, seated) {
      v.box(-3, 5, -2, 6, 5, 4, p.c);
      v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
      v.box(-3, 5, -2, 6, 1, 4, WHITE);
      v.set(-1, 5, 1, GOLD); v.set(0, 5, 1, GOLD);
      for (const x of [-2, 1]) v.set(x, 7, 1, p.ll);
      if (seated) { v.box(-3, 4, -2, 6, 1, 4, p.c); return; }
      skirt(v, 3, 4, 4.7, 3.9, (x, y) => (y === 3 ? WHITE : p.c));
    },
    arm: 'short', leg: (v, p) => { legBase(v, p.skin, WHITE, p.dd, true); },
  },
  gala: {
    torso(v, p, seated) {
      v.box(-3, 5, -2, 6, 4, 4, p.c);
      v.box(-3, 9, -2, 6, 1, 4, p.skin);
      for (let x = -3; x <= 2; x++) { v.set(x, 8, 2, p.l); v.set(x, 8, -3, p.l); }
      for (let z = -2; z <= 1; z++) { v.set(-4, 8, z, p.l); v.set(3, 8, z, p.l); }
      v.set(-1, 9, 2, GOLD); v.set(0, 9, 2, GOLD); v.set(-1, 8, 2, 0x8fd3ff); v.set(0, 8, 2, 0x8fd3ff);
      v.box(-3, 5, -2, 6, 1, 4, GOLD_D);
      v.set(-1, 5, 2, GOLD_L); v.set(0, 5, 2, GOLD_L);
      if (seated) { v.box(-3, 4, -2, 6, 1, 4, p.c); return; }
      skirt(v, 0, 4, 6.4, 3.8, (x, y, z) => {
        if (y === 0) return GOLD;
        return y <= 1 ? shade(p.c, 0.14) : p.c;
      });
    },
    arm: 'glove', leg: (v, p) => { legBase(v, p.skin, p.skin, p.dd); },
  },
  overol: {
    torso(v, p, seated) {
      v.box(-3, 6, -2, 6, 4, 4, WHITE);
      for (let x = -3; x <= 2; x++) for (let z = -2; z <= 1; z++) v.set(x, 7, z, 0xf0d2dc);
      v.box(-2, 5, 1, 4, 4, 1, p.c);
      v.box(-1, 6, 2, 2, 2, 1, p.d);
      v.set(-2, 8, 2, GOLD); v.set(1, 8, 2, GOLD);
      for (const x of [-2, 1]) { v.set(x, 9, 1, p.c); for (let y = 5; y <= 9; y++) v.set(x, y, -2, p.c); }
      v.box(-3, 4, -2, 6, 2, 4, p.c);
      v.box(-2, 5, 1, 4, 1, 1, p.c);
      v.set(-1, 4, 1, p.d); v.set(0, 4, 1, p.d);
      if (seated) return;
    },
    arm: 'tee', leg: (v, p) => {
      v.box(-1, -3, -1, 2, 3, 2, p.c);
      v.box(-1, -3, -1, 2, 1, 2, p.l);
      shoes(v, WHITE, p.c, true);
    },
  },
  sirena: {
    torso(v, p, seated) {
      v.box(-3, 4, -2, 6, 5, 4, p.c);
      v.box(-3, 9, -2, 6, 1, 4, p.skin);
      v.set(-2, 8, 1, p.ll); v.set(-1, 8, 1, p.l); v.set(0, 8, 1, p.l); v.set(1, 8, 1, p.ll);
      v.set(-2, 7, 1, p.l); v.set(1, 7, 1, p.l);
      for (const x of [-2, 0]) v.set(x, 9, 1, WHITE);
      for (const x of [-1, 1]) v.set(x, 9, 1, 0xf4e8ec);
      v.set(-3, 9, 0, p.c); v.set(2, 9, 0, p.c);
      if (seated) return;
      skirt(v, 2, 3, 3.6, 3.5, () => p.c);
      skirt(v, 0, 1, 5.2, 4.2, (x, y, z, r) => {
        const d = Math.hypot(x + 0.5, (z + 0.5) / 0.86);
        return d > r - 1.2 ? (y === 0 ? p.ll : p.l) : p.c;
      });
    },
    arm: 'bare', leg: (v, p) => { legBase(v, p.c, p.c, p.c); },
  },
  deportivo: {
    torso(v, p, seated) {
      v.box(-3, 5, -2, 6, 5, 4, p.c);
      v.box(-3, 4, -2, 6, 1, 4, p.d);
      v.box(-2, 7, -3, 4, 3, 1, p.d);
      v.set(-1, 9, -3, p.c); v.set(0, 9, -3, p.c);
      v.set(-1, 9, 1, p.d); v.set(0, 9, 1, p.d);
      for (const x of [-2, 1]) { v.set(x, 8, 2, WHITE); v.set(x, 7, 2, WHITE); }
      v.box(-2, 5, 2, 4, 1, 1, p.d);
      v.set(-1, 7, 1, WHITE); v.set(0, 7, 1, WHITE); v.set(-1, 6, 1, WHITE); v.set(0, 6, 1, WHITE);
      if (seated) return;
      // calzas
      v.box(-3, 4, -2, 6, 1, 4, mix(p.c, INK, 0.55));
    },
    arm: 'sport', leg: (v, p) => {
      const leg = mix(p.c, INK, 0.55);
      v.box(-1, -3, -1, 2, 3, 2, leg);
      for (let y = -3; y <= -1; y++) v.set(0, y, 0, WHITE);
      shoes(v, WHITE, p.c, true);
    },
  },
  capa: {
    torso(v, p, seated) {
      v.box(-3, 5, -2, 6, 5, 4, p.l);
      v.box(-3, 9, -2, 6, 1, 4, p.l);
      v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
      v.box(-3, 5, -2, 6, 1, 4, GOLD);
      for (let y = 6; y <= 8; y++) { v.set(-1, y, 1, p.ll); v.set(0, y, 1, p.ll); }
      v.set(-1, 7, 2, GOLD); v.set(0, 7, 2, GOLD);
      if (seated) { v.box(-3, 4, -2, 6, 1, 4, p.l); return; }
      skirt(v, 1, 4, 4.8, 3.7, (x, y, z) => {
        if (y === 1) return GOLD;
        if (z >= 1 && (x === -1 || x === 0)) return p.ll;
        return p.l;
      });
    },
    arm: 'puffD', leg: (v, p) => { legBase(v, p.skin, p.skin, p.dd); },
    cape: (p) => ({ main: shade(p.c, -0.25), lining: p.ll, hem: GOLD, collar: WHITE }),
  },
  estrellas: {
    torso(v, p, seated) {
      const n = mix(p.c, 0x2b2160, 0.45), nl = shade(n, 0.22);
      v.box(-3, 6, -2, 6, 4, 4, n);
      v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
      v.box(-3, 5, -2, 6, 1, 4, GOLD);
      v.set(-2, 8, 1, GOLD_L); v.set(1, 7, 1, 0xffffff); v.set(-1, 6, -2, GOLD_L);
      v.set(-1, 5, 2, GOLD_L); v.set(0, 5, 2, GOLD); v.set(0, 6, 2, GOLD);
      if (seated) { v.box(-3, 4, -2, 6, 1, 4, n); return; }
      skirt(v, 0, 4, 5.9, 3.8, (x, y, z) => {
        const r = hash3(x, y, z);
        if (y === 0) return nl;
        if (r < 0.045) return GOLD;
        return n;
      });
    },
    arm: 'puffStar', leg: (v, p) => { legBase(v, p.skin, p.skin, GOLD_D); },
  },
};
export function shoes(v, c, accent, sneaker = false) {
  v.box(-1, -4, -1, 2, 1, 2, c);
  v.box(-1, -4, 1, 2, 1, 1, sneaker ? accent : c);
  if (sneaker) { v.set(-1, -3, 0, c); v.set(0, -3, 0, c); }
}
export function legBase(v, upper, lower, shoe, socks = false) {
  v.box(-1, -3, -1, 2, 3, 2, upper);
  if (socks) v.box(-1, -3, -1, 2, 1, 2, lower);
  shoes(v, shoe, shade(shoe, 0.15));
  v.set(-1, -3, 1, null);
}

// Brazo local: x [-1,1) (exterior +x), y [-5,0), z [-1,1). Mano en y=-5.
export function buildArm(v, style, p) {
  const sk = p.skin;
  v.box(-1, -5, -1, 2, 5, 2, sk);
  if (buildArmExtra(v, style, p)) return;
  switch (style) {
    case 'puff': case 'puffD': case 'puffStar': {
      const pc = style === 'puffD' ? p.d : style === 'puffStar' ? shade(mix(p.c, 0x2b2160, 0.45), 0.3) : p.c;
      for (let x = -1; x <= 1; x++) for (let y = -2; y <= -1; y++) for (let z = -2; z <= 1; z++) {
        if (x === 1 && (z === -2 || z === 1)) continue;
        v.set(x, y, z, pc);
      }
      for (let z = -1; z <= 0; z++) v.set(1, 0, z, pc);
      v.set(0, 0, -1, pc); v.set(0, 0, 0, pc);
      for (let x = -1; x <= 1; x++) for (let z = -2; z <= 1; z++) if (!(x === 1 && (z === -2 || z === 1))) v.set(x, -3, z, null);
      v.box(-1, -3, -1, 2, 1, 2, style === 'puffD' ? p.l : p.ll);
      if (style === 'puffStar') { v.set(1, -1, 0, GOLD); v.set(0, -2, 1, 0xffffff); }
      break;
    }
    case 'short': v.box(-1, -2, -1, 2, 2, 2, p.c); v.box(-1, -2, -1, 2, 1, 2, p.l); break;
    case 'tee': v.box(-1, -2, -1, 2, 2, 2, WHITE); v.set(0, -2, 0, 0xf0d2dc); v.set(-1, -2, 0, 0xf0d2dc); break;
    case 'glove': v.box(-1, -5, -1, 2, 3, 2, WHITE); v.set(0, -3, 0, 0xffe6f2); break;
    case 'sport':
      v.box(-1, -4, -1, 2, 4, 2, p.c);
      for (let y = -4; y <= -1; y++) v.set(0, y, 0, WHITE), v.set(0, y, -1, WHITE);
      v.box(-1, -4, -1, 2, 1, 2, WHITE);
      break;
    case 'bare': v.set(0, -4, 0, GOLD); v.set(-1, -4, 0, GOLD); v.set(0, -4, -1, GOLD); v.set(-1, -4, -1, GOLD); break;
  }
}


// ---------- Capa genérica: cc = { main, lining, hem, collar, dot? } ----------
export function buildCapeC(v, cc, overHair = false) {
  const cd = cc.main;
  for (let y = -10; y <= 0; y++) {
    const w = 4 + Math.floor((-y) / 4);
    for (let x = -w; x < w; x++) {
      const c = y === -10 ? cc.hem : (x === -w || x === w - 1) ? cc.lining : cd;
      v.set(x, y, -1, c);
    }
  }
  const col = (x) => (cc.dot && (x + 9) % 3 === 0 ? cc.dot : cc.collar);
  for (let x = -4; x <= 3; x++) { v.set(x, 1, -1, col(x)); if (!overHair) v.set(x, 0, 0, x === -4 || x === 3 ? cc.collar : null); }
  if (!overHair) { v.set(-4, 1, 0, cc.collar); v.set(3, 1, 0, cc.collar); }
}

// ---------- Piezas de ropa comunes ----------
const PANTS_W = 0xf3eefc, DARK_PANTS = 0x4d4560;
const LEAF = 0x6cc35d, LEAF_D = 0x4c9e4f, LEAF_L = 0xa6e38f;
function jeans(v, c = DENIM, shoe = WHITE, accent = 0xe392b0) {
  v.box(-1, -3, -1, 2, 3, 2, c);
  v.set(0, -2, 1, shade(c, 0.12)); v.set(0, -3, 0, shade(c, -0.12));
  shoes(v, shoe, accent, true);
}
function boots(v, pants, boot = BOOT) {
  v.box(-1, -3, -1, 2, 3, 2, pants);
  v.box(-1, -4, -1, 2, 2, 2, boot);
  v.box(-1, -4, 1, 2, 1, 1, boot);
  v.set(-1, -3, 1, shade(boot, 0.18)); v.set(0, -3, 1, shade(boot, 0.18));
}
function furLeg(v, p) { v.box(-1, -4, -1, 2, 4, 2, p.skin); v.box(-1, -4, 1, 2, 1, 1, p.skin); }
const plaid = (p) => (x, y) => {
  const vx = ((x + 30) % 3) === 0, hy = (y % 3) === 0;
  return vx && hy ? p.dd : (vx || hy) ? p.d : p.c;
};
const sector = (x, z, n) => Math.floor(((Math.atan2(z + 0.5, x + 0.5) + Math.PI) / (Math.PI * 2)) * n) % n;
function jacketTorso(v, p, c, opts = {}) {
  v.box(-3, 4, -2, 6, 1, 4, opts.pants ?? PANTS_W);
  v.box(-3, 5, -2, 6, 5, 4, c);
  v.box(-3, 5, -2, 6, 1, 4, opts.belt ?? p.dd);
  v.set(-1, 5, 2, GOLD); v.set(0, 5, 2, GOLD_D);
  for (let y = 6; y <= 9; y++) { v.set(-1, y, 1, WHITE); v.set(0, y, 1, WHITE); }
  v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
  v.set(-2, 9, 2, opts.trim ?? GOLD); v.set(1, 9, 2, opts.trim ?? GOLD);
  for (const y of [6, 8]) { v.set(-2, y, 2, GOLD); v.set(1, y, 2, GOLD); }
  for (const x of [-3, 2]) for (let z = -2; z <= 1; z++) v.set(x, 9, z, z === -2 || z === 1 ? GOLD_D : GOLD);
  // faldón de la chaqueta (atrás, no choca con las piernas)
  v.box(-2, 2, -3, 4, 3, 1, c); v.set(-1, 2, -3, shade(c, -0.15)); v.set(0, 2, -3, shade(c, -0.15));
}
function robeTorso(v, p, c, trim, opts = {}) {
  v.box(-3, 4, -2, 6, 6, 4, c);
  v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin); v.set(-1, 8, 1, trim); v.set(0, 8, 1, trim);
  v.set(-2, 9, 1, trim); v.set(1, 9, 1, trim);
  v.box(-3, 5, -2, 6, 1, 4, opts.belt ?? GOLD);
  if (opts.tassel !== false) { v.set(1, 4, 2, opts.belt ?? GOLD); v.set(1, 3, 2, opts.belt ?? GOLD_D); }
}
function robeSkirt(v, c, hem, spark, y0 = 0, rb = 4.7) {
  skirt(v, y0, 4, rb, 3.9, (x, y, z) => {
    if (y === y0) return hem;
    const r = hash3(x, y, z);
    if (spark && r < 0.035) return GOLD;
    return y === y0 + 1 ? shade(c, -0.07) : c;
  });
}

Object.assign(DRESS, {
  // ---------------- príncipe ----------------
  chaqueta: {
    torso(v, p) { jacketTorso(v, p, p.c); },
    arm: 'jacket', leg: (v) => boots(v, PANTS_W),
  },
  capa_real: {
    torso(v, p) { jacketTorso(v, p, p.c); },
    arm: 'jacket', leg: (v) => boots(v, PANTS_W),
    cape: (p) => {
      const red = ['rojo', 'rosa', 'fucsia', 'durazno'].includes(p.colorId) ? 0x4f62d6 : 0xd23c5a;
      return { main: red, lining: shade(red, 0.35), hem: GOLD, collar: 0xffffff, dot: INK };
    },
  },
  gala_p: {
    torso(v, p) {
      jacketTorso(v, p, WHITE, { pants: p.dd, belt: GOLD_D, trim: p.c });
      for (let y = 5; y <= 9; y++) { const x = y - 7; v.set(x, y, 2, p.c); v.set(x + 1, y, 2, p.d); }
      v.set(-3, 8, 2, GOLD); v.set(-3, 7, 2, 0xcf5f5f);
    },
    arm: 'jacketW', leg: (v, p) => { boots(v, p.dd); v.set(0, -2, 0, GOLD); v.set(0, -1, 0, GOLD); },
  },
  caballero: {
    torso(v, p) {
      v.box(-3, 4, -2, 6, 6, 4, (x, y) => ((y === 7 || x === -3 || x === 2) ? SILVER_D : SILVER));
      v.box(-3, 5, -2, 6, 1, 4, BOOT_L); v.set(-1, 5, 2, GOLD); v.set(0, 5, 2, GOLD);
      v.box(-2, 2, 2, 4, 7, 1, (x, y) => (y === 2 ? GOLD : (x === -2 || x === 1) && y > 2 ? p.d : p.c));
      for (const [x, y] of [[-2, 7], [1, 7], [-2, 6], [-1, 6], [0, 6], [1, 6], [-1, 5], [0, 5]]) v.set(x, y + 0, 3, GOLD);
      v.set(-1, 7, 3, GOLD_L);
      v.set(-1, 9, 1, SILVER_L); v.set(0, 9, 1, SILVER_L);
    },
    arm: 'armor', leg: (v) => {
      v.box(-1, -3, -1, 2, 3, 2, SILVER); v.set(-1, -2, 1, SILVER_D); v.set(0, -2, 1, SILVER_D);
      v.box(-1, -4, -1, 2, 1, 3, SILVER_D);
    },
  },
  estrellas_p: {
    torso(v, p) {
      const n = mix(p.c, 0x2b2160, 0.5);
      jacketTorso(v, p, n, { pants: shade(n, -0.2), belt: GOLD, trim: GOLD_L });
      for (const [x, y, z] of [[-3, 7, 1], [2, 8, -1], [1, 7, 1], [-2, 9, -2], [-1, 6, -2], [2, 6, 0]]) v.set(x, y, z, (x + y) & 1 ? GOLD_L : 0xffffff);
    },
    arm: 'jacketStar', leg: (v, p) => { const n = mix(p.c, 0x2b2160, 0.5); boots(v, shade(n, -0.2), GOLD_D); v.set(0, -2, 0, GOLD); },
  },
  // ---------------- casual ----------------
  buzo: {
    torso(v, p) {
      v.box(-3, 4, -2, 6, 6, 4, p.c);
      v.box(-3, 4, -2, 6, 1, 4, p.d);
      v.box(-2, 5, 2, 4, 2, 1, p.d); v.box(-2, 6, 2, 4, 1, 1, shade(p.c, 0.1));
      for (let y = 7; y <= 8; y++) { v.set(-1, y, 2, y === 7 ? WHITE : 0xf2e8f6); v.set(0, y, 2, y === 7 ? WHITE : 0xf2e8f6); }
      v.set(-1, 9, 1, p.dd); v.set(0, 9, 1, p.dd);
      // capucha en la espalda
      v.box(-3, 7, -3, 6, 3, 1, p.d); v.box(-2, 8, -3, 4, 1, 1, p.dd);
    },
    arm: 'hoodie', leg: (v, p) => jeans(v, DENIM, WHITE, p.c),
  },
  remera: {
    torso(v, p) {
      v.box(-3, 4, -2, 6, 1, 4, DENIM); v.set(-1, 4, 2, GOLD); v.set(0, 4, 2, GOLD_D);
      v.box(-3, 5, -2, 6, 5, 4, p.c);
      v.box(-3, 7, -2, 6, 1, 4, p.l);
      v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
      v.set(-2, 8, 2, WHITE); v.set(-2, 8, 1, WHITE);
    },
    arm: 'teeC', leg: (v, p) => jeans(v, DENIM, WHITE, p.c),
  },
  pollera: {
    torso(v, p, seated) {
      v.box(-3, 5, -2, 6, 5, 4, WHITE);
      v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
      for (const [x, y] of [[-2, 8], [1, 8], [-2, 7], [-1, 7], [0, 7], [1, 7], [-1, 6], [0, 6]]) v.set(x, y, 2, p.c);
      v.set(-2, 8, 2, p.l);
      v.box(-3, 5, -2, 6, 1, 4, p.d);
      if (seated) { v.box(-3, 4, -2, 6, 1, 4, p.c); return; }
      skirt(v, 3, 4, 4.7, 3.9, (x, y, z) => (y === 3 ? p.d : (sector(x, z, 8) & 1 ? p.l : p.c)));
    },
    arm: 'tee', leg: (v, p) => { v.box(-1, -3, -1, 2, 3, 2, p.skin); v.box(-1, -3, -1, 2, 1, 2, WHITE); shoes(v, WHITE, p.c, true); },
  },
  camisa: {
    torso(v, p) {
      v.box(-3, 4, -2, 6, 1, 4, DENIM_D); v.set(-1, 4, 2, BOOT_L); v.set(0, 4, 2, BOOT_L);
      v.box(-3, 5, -2, 6, 5, 4, plaid(p));
      for (let y = 5; y <= 8; y++) v.set(0, y, 1, p.dd);
      v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
      v.set(-2, 9, 2, p.l); v.set(1, 9, 2, p.l);
      v.set(0, 7, 2, WHITE); v.set(0, 5, 2, WHITE);
    },
    arm: 'plaid', leg: (v, p) => jeans(v, DENIM_D, BOOT_L, BOOT),
  },
  campera: {
    torso(v, p) {
      v.box(-3, 4, -2, 6, 1, 4, DARK_PANTS);
      v.box(-3, 5, -2, 6, 5, 4, DENIM);
      v.box(-3, 5, -2, 6, 1, 4, DENIM_D);
      for (let y = 6; y <= 9; y++) { v.set(-1, y, 1, p.c); v.set(0, y, 1, p.c); }
      v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
      v.set(-2, 9, 2, DENIM_L); v.set(1, 9, 2, DENIM_L); v.set(-2, 8, 2, DENIM_L); v.set(1, 8, 2, DENIM_L);
      v.set(-3, 7, 2, DENIM_D); v.set(2, 7, 2, DENIM_D); v.set(-2, 6, 2, GOLD); v.set(1, 6, 2, GOLD);
      v.set(-1, 7, 2, WHITE); // dibujito de la remera
    },
    arm: 'denim', leg: (v, p) => jeans(v, DARK_PANTS, WHITE, p.c),
  },
  futbol: {
    torso(v, p) {
      v.box(-3, 4, -2, 6, 1, 4, WHITE);
      v.box(-3, 5, -2, 6, 5, 4, (x) => (x === -3 || x === 2 ? WHITE : p.c));
      v.set(-1, 9, 1, WHITE); v.set(0, 9, 1, WHITE); v.set(-1, 8, 1, p.skin); v.set(0, 8, 1, p.skin);
      v.set(-2, 8, 2, GOLD); v.set(1, 8, 2, p.d);
      // número 10 en la espalda
      for (let y = 5; y <= 8; y++) { v.set(-2, y, -3, WHITE); v.set(0, y, -3, WHITE); v.set(2, y, -3, WHITE); }
      v.set(1, 5, -3, WHITE); v.set(1, 8, -3, WHITE); v.set(-3, 7, -3, WHITE);
    },
    arm: 'jersey', leg: (v, p) => {
      v.box(-1, -1, -1, 2, 1, 2, WHITE); v.box(-1, -2, -1, 2, 1, 2, p.skin);
      v.box(-1, -3, -1, 2, 1, 2, p.c); v.set(0, -3, 0, WHITE);
      shoes(v, INK, WHITE, true);
    },
  },
  // ---------------- hada ----------------
  petalos: {
    torso(v, p, seated) {
      v.box(-3, 5, -2, 6, 5, 4, p.c);
      for (let x = -3; x <= 2; x++) v.set(x, 9, 1, p.l);
      v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
      v.box(-3, 5, -2, 6, 1, 4, LEAF); v.set(-1, 5, 2, LEAF_D); v.set(0, 5, 2, p.ll);
      if (seated) { v.box(-3, 4, -2, 6, 1, 4, p.c); return; }
      skirt(v, 1, 4, 5.4, 3.6, (x, y, z) => {
        const k = sector(x, z, 12);
        if (y === 1 && (k & 1)) return null;
        if (y === 4) return LEAF;
        return (k & 1) ? p.c : (y <= 2 ? p.ll : p.l);
      });
    },
    arm: 'leafBand', leg: (v, p) => legBase(v, p.skin, p.skin, p.d),
  },
  hojas: {
    torso(v, p, seated) {
      v.box(-3, 5, -2, 6, 5, 4, (x, y) => (y >= 8 ? LEAF_L : LEAF));
      v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
      v.box(-3, 5, -2, 6, 1, 4, LEAF_D);
      v.set(-1, 5, 2, p.c); v.set(0, 5, 2, p.c); v.set(-1, 6, 2, 0xffe066);
      if (seated) { v.box(-3, 4, -2, 6, 1, 4, LEAF); return; }
      skirt(v, 1, 4, 5.2, 3.6, (x, y, z) => {
        const k = sector(x, z, 10);
        if (y === 1 && (k & 1)) return null;
        return k % 3 === 0 ? LEAF_D : k % 3 === 1 ? LEAF : LEAF_L;
      });
    },
    arm: 'leaf', leg: (v, p) => legBase(v, p.skin, p.skin, LEAF_D),
  },
  tutu: {
    torso(v, p, seated) {
      v.box(-3, 5, -2, 6, 4, 4, p.c);
      v.box(-3, 9, -2, 6, 1, 4, p.skin); v.set(-2, 9, 1, p.c); v.set(1, 9, 1, p.c); v.set(-2, 9, -2, p.c); v.set(1, 9, -2, p.c);
      for (const [x, y, z] of [[-2, 7, 1], [1, 6, 1], [0, 8, 1], [-3, 6, 0], [2, 7, -1]]) v.set(x, y, z, 0xffffff);
      v.box(-3, 5, -2, 6, 1, 4, p.d);
      if (seated) { v.box(-3, 4, -2, 6, 1, 4, p.l); return; }
      skirt(v, 3, 4, 6.3, 5.4, (x, y, z) => {
        return y === 3 ? p.ll : p.l;
      });
    },
    arm: 'bare', leg: (v, p) => {
      v.box(-1, -3, -1, 2, 3, 2, p.skin);
      v.box(-1, -4, -1, 2, 1, 3, p.c); v.set(-1, -3, 0, p.d); v.set(0, -3, -1, p.d);
    },
  },
  mariposa: {
    torso(v, p, seated) {
      const dk = mix(p.c, INK, 0.4);
      v.box(-3, 5, -2, 6, 5, 4, dk);
      for (let y = 6; y <= 8; y++) { v.set(-1, y, 1, p.c); v.set(0, y, 1, p.c); }
      v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
      v.box(-3, 5, -2, 6, 1, 4, GOLD);
      if (seated) { v.box(-3, 4, -2, 6, 1, 4, p.c); return; }
      skirt(v, 0, 4, 5.8, 3.8, (x, y, z) => {
        const k = sector(x, z, 8), k2 = sector(x, z, 24);
        if (k2 % 3 === 0 && y > 0) return dk;
        if (y === 1 && (k & 1)) return 0xffffff;
        if (y === 0) return dk;
        return y >= 3 ? p.c : (k & 1 ? p.l : 0xffb38a);
      });
    },
    arm: 'puff', leg: (v, p) => legBase(v, p.skin, p.skin, p.dd),
  },
  // ---------------- mago ----------------
  tunica: {
    torso(v, p, seated) {
      robeTorso(v, p, p.c, GOLD);
      v.set(-2, 7, 2, GOLD_L); v.set(1, 6, 1, 0xffffff);
      if (seated) return;
      robeSkirt(v, p.c, GOLD, true);
    },
    arm: 'wizard', leg: (v, p) => wizardShoes(v, p.dd),
  },
  aprendiz: {
    torso(v, p, seated) {
      robeTorso(v, p, p.c, p.l, { belt: BOOT_L, tassel: false });
      v.set(-1, 5, 2, GOLD); v.set(0, 5, 2, GOLD);
      v.box(2, 3, 0, 1, 2, 2, BOOT); v.set(2, 4, 2, GOLD_D);
      if (seated) return;
      skirt(v, 2, 4, 4.4, 3.8, (x, y, z) => (y === 2 ? p.l : ((x + z) % 4 === 0 ? p.d : p.c)));
    },
    arm: 'wizardS', leg: (v) => boots(v, 0x6a5a8a, BOOT),
  },
  tunica_capa: {
    torso(v, p, seated) {
      robeTorso(v, p, p.c, GOLD);
      if (seated) return;
      robeSkirt(v, p.c, GOLD, true);
    },
    arm: 'wizard', leg: (v, p) => wizardShoes(v, p.dd),
    cape: (p) => ({ main: p.dd, lining: GOLD_L, hem: GOLD, collar: GOLD }),
  },
  lunar: {
    torso(v, p, seated) {
      const n = mix(p.c, 0x22205a, 0.55);
      robeTorso(v, p, n, SILVER, { belt: SILVER });
      v.set(-2, 7, 2, SILVER_L); v.set(1, 8, 1, 0xffffff);
      if (seated) return;
      skirt(v, 0, 4, 4.8, 3.9, (x, y, z) => {
        if (y === 0) return SILVER;
        const k = sector(x, z, 6), r = hash3(x, y, z);
        if (y === 2 && k % 2 === 0) return SILVER_L; // lunitas
        return n;
      });
    },
    arm: 'wizardMoon', leg: (v, p) => wizardShoes(v, mix(p.c, 0x22205a, 0.7)),
  },
  archimago: {
    torso(v, p, seated) {
      robeTorso(v, p, p.c, GOLD);
      for (let y = 4; y <= 8; y++) { v.set(-1, y, 2, GOLD); v.set(0, y, 2, y === 7 ? p.ll : GOLD_D); }
      if (seated) return;
      robeSkirt(v, p.c, GOLD, false, 0, 5);
      for (let y = 0; y <= 3; y++) { v.set(-1, y, 4, GOLD); v.set(0, y, 4, y === 2 ? p.ll : GOLD_D); }
    },
    arm: 'wizard', leg: (v, p) => wizardShoes(v, GOLD_D),
    cape: (p) => ({ main: p.dd, lining: p.ll, hem: GOLD, collar: GOLD, dot: GOLD_L }),
  },
  // ---------------- animalitos ----------------
  pelito: {
    torso(v, p) { v.box(-3, 4, -2, 6, 6, 4, p.skin); },
    arm: 'fur', leg: furLeg,
  },
  remerita: {
    torso(v, p) {
      v.box(-3, 4, -2, 6, 6, 4, p.skin);
      v.box(-3, 6, -2, 6, 4, 4, p.c);
      v.box(-3, 6, -2, 6, 1, 4, p.l);
      v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
      for (const [x, y] of [[-2, 8], [1, 8], [-2, 7], [-1, 7], [0, 7], [1, 7], [-1, 6], [0, 6]]) v.set(x, y, 2, 0xffffff);
    },
    arm: 'teeC', leg: furLeg,
  },
  panuelo: {
    torso(v, p) {
      v.box(-3, 4, -2, 6, 6, 4, p.skin);
      const rows = [[9, -3, 2], [8, -2, 1], [7, -1, 0]];
      for (const [y, a, b] of rows) for (let x = a; x <= b; x++) v.set(x, y, 2, y === 7 ? 0xffffff : p.c);
      for (let x = -3; x <= 2; x++) { v.set(x, 9, 1, p.c); v.set(x, 9, -2, p.c); }
      for (let z = -2; z <= 1; z++) { v.set(-3, 9, z, p.c); v.set(2, 9, z, p.c); }
      v.set(-1, 9, -3, p.d); v.set(0, 9, -3, p.d); v.set(-1, 8, -3, p.d);
    },
    arm: 'fur', leg: furLeg,
  },
  vestidito: {
    torso(v, p, seated) {
      v.box(-3, 4, -2, 6, 6, 4, p.skin);
      v.box(-3, 5, -2, 6, 5, 4, p.c);
      for (let x = -2; x <= 1; x++) v.set(x, 9, 2, 0xffffff);
      v.set(-1, 9, 1, p.skin); v.set(0, 9, 1, p.skin);
      v.set(-1, 7, 2, p.ll); v.set(0, 6, 2, p.ll);
      if (seated) return;
      skirt(v, 3, 4, 4.8, 3.9, (x, y) => (y === 3 ? 0xffffff : p.c));
    },
    arm: 'short', leg: furLeg,
  },
  capita: {
    torso(v, p) {
      v.box(-3, 4, -2, 6, 6, 4, p.skin);
      v.box(-3, 5, -2, 6, 1, 4, GOLD_D);
      v.set(-1, 9, 2, GOLD); v.set(0, 9, 2, GOLD_L);
    },
    arm: 'fur', leg: furLeg,
    cape: (p) => ({ main: p.c, lining: p.ll, hem: GOLD, collar: GOLD }),
  },
  frac: {
    torso(v, p) {
      v.box(-3, 4, -2, 6, 6, 4, p.skin);
      v.box(-3, 5, -2, 6, 4, 4, p.c);
      for (let y = 5; y <= 9; y++) { v.set(-1, y, 1, 0xffffff); v.set(0, y, 1, 0xffffff); }
      v.set(-1, 6, 2, GOLD); v.set(-1, 7, 2, GOLD);
      const bow = 0xcf5f5f;
      v.set(-2, 9, 2, bow); v.set(1, 9, 2, bow); v.set(-1, 9, 2, shade(bow, -0.2)); v.set(0, 9, 2, shade(bow, -0.2));
      v.set(-3, 9, 2, bow); v.set(2, 9, 2, bow);
    },
    arm: 'fur', leg: furLeg,
  },
});
function wizardShoes(v, c) {
  v.box(-1, -3, -1, 2, 3, 2, shade(c, -0.1));
  v.box(-1, -4, -1, 2, 1, 3, c);
  v.set(-1, -4, 2, c); v.set(-1, -3, 2, shade(c, 0.25));
}

// Mangas nuevas (se agregan a buildArm). Brazo local: x [-1,1) (exterior +x), y [-5,0), z [-1,1). Mano en y=-5.
export function buildArmExtra(v, style, p) {
  const n = mix(p.c, 0x2b2160, 0.5);
  switch (style) {
    case 'jacket': case 'jacketW': case 'jacketStar': {
      const c = style === 'jacketW' ? WHITE : style === 'jacketStar' ? n : p.c;
      v.box(-1, -4, -1, 2, 4, 2, c);
      v.box(-1, -4, -1, 2, 1, 2, style === 'jacketW' ? p.c : GOLD);
      for (let z = -1; z <= 0; z++) { v.set(0, 0, z, GOLD); v.set(1, 0, z, GOLD_D); v.set(1, -1, z, GOLD_D); }
      if (style === 'jacketStar') { v.set(0, -2, 0, GOLD_L); v.set(-1, -3, -1, 0xffffff); }
      return true;
    }
    case 'armor':
      v.box(-1, -4, -1, 2, 4, 2, SILVER);
      v.box(-1, -2, -1, 2, 1, 2, SILVER_D);
      for (let x = -1; x <= 1; x++) for (let z = -2; z <= 1; z++) v.set(x, -1, z, x === 1 ? SILVER_D : SILVER_L);
      v.box(-1, -5, -1, 2, 1, 2, SILVER_D);
      return true;
    case 'hoodie': v.box(-1, -4, -1, 2, 4, 2, p.c); v.box(-1, -4, -1, 2, 1, 2, p.d); return true;
    case 'teeC': v.box(-1, -2, -1, 2, 2, 2, p.c); v.box(-1, -2, -1, 2, 1, 2, p.l); return true;
    case 'plaid': v.box(-1, -3, -1, 2, 3, 2, (x, y) => (y === -2 ? p.d : p.c)); v.box(-1, -3, -1, 2, 1, 2, p.l); return true;
    case 'denim': v.box(-1, -4, -1, 2, 4, 2, DENIM); v.box(-1, -4, -1, 2, 1, 2, DENIM_D); v.set(0, -2, 0, DENIM_L); return true;
    case 'jersey': v.box(-1, -2, -1, 2, 2, 2, p.c); v.box(-1, -2, -1, 2, 1, 2, WHITE); return true;
    case 'leafBand': v.set(0, -4, 0, LEAF); v.set(-1, -4, 0, LEAF_D); v.set(0, -4, -1, LEAF); v.set(-1, -4, -1, LEAF); return true;
    case 'leaf': v.box(-1, -2, -1, 2, 2, 2, LEAF); v.set(0, -2, 0, LEAF_D); v.set(1, -1, 0, LEAF_L); v.set(1, -1, -1, LEAF); return true;
    case 'wizard': case 'wizardMoon': {
      const c = style === 'wizardMoon' ? mix(p.c, 0x22205a, 0.55) : p.c, trim = style === 'wizardMoon' ? SILVER : GOLD;
      v.box(-1, -4, -1, 2, 4, 2, c);
      for (let y = -4; y <= -3; y++) { v.set(1, y, -1, c); v.set(1, y, 0, c); v.set(0, y, 1, c); v.set(-1, y, 1, c); v.set(0, y, -2, c); v.set(-1, y, -2, c); }
      for (const [x, z] of [[-1, -1], [0, -1], [-1, 0], [0, 0], [1, -1], [1, 0], [0, 1], [-1, 1], [0, -2], [-1, -2]]) v.set(x, -4, z, trim);
      return true;
    }
    case 'wizardS': v.box(-1, -4, -1, 2, 4, 2, p.c); v.box(-1, -4, -1, 2, 1, 2, p.l); return true;
    case 'fur': return true;
  }
  return false;
}
