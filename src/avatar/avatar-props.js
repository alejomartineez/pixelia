// Piezas para la cabeza (coronas, gorras, sombreros) y accesorios de los personajes. Lo usa avatar.js.
// Cabeza: coordenadas de cabeza; las coronas apoyan en y=12 (arriba del pelo), los gorros (HATS) en y=10.
import {
  INK, GOLD, GOLD_D, GOLD_L, SILVER, SILVER_D, SILVER_L, BOOT, BOOT_L, mix, hash3, shade, hexToInt,
} from './avatar-kit.js';

// =====================================================================
//                                 CORONAS
// =====================================================================
export const CROWN_BUILD = {
  tiara(v) {
    for (let x = -3; x <= 2; x++) v.set(x, 12, 2, x === -3 || x === 2 ? GOLD_D : GOLD);
    for (const x of [-3, 2]) v.set(x, 13, 2, GOLD);
    v.set(-1, 13, 2, GOLD); v.set(0, 13, 2, GOLD);
    v.set(-1, 14, 2, 0xff5a9e); v.set(0, 14, 2, 0xff5a9e);
    v.set(-1, 15, 2, GOLD_L); v.set(0, 15, 2, GOLD);
    v.set(-2, 12, 3, 0x8fd3ff); v.set(1, 12, 3, 0x8fd3ff);
    v.set(-1, 13, 3, 0xffffff);
  },
  corona(v) {
    for (let x = -4; x <= 3; x++) for (let z = -3; z <= 2; z++) {
      const edge = x === -4 || x === 3 || z === -3 || z === 2;
      if (edge) { v.set(x, 12, z, GOLD_D); v.set(x, 13, z, GOLD); }
      else v.set(x, 12, z, 0xc4678e);
    }
    for (const [x, z] of [[-4, -3], [3, -3], [-4, 2], [3, 2], [-1, 2], [0, 2], [-4, -1], [3, -1], [-1, -3], [0, -3]]) {
      v.set(x, 14, z, GOLD); if ((x === -1 || x === 0)) v.set(x, 15, z, GOLD_L);
    }
    v.set(-1, 13, 2, 0xcf5f5f); v.set(0, 13, 2, 0xcf5f5f);
    v.set(-4, 13, 0, 0x4f7ce0); v.set(3, 13, 0, 0x4f7ce0);
    v.set(-1, 13, -3, 0x6fe3c1); v.set(0, 13, -3, 0x6fe3c1);
    v.set(-1, 13, 0, 0xffd166); v.set(0, 13, -1, 0xffd166);
  },
  flores(v) {
    const flowers = [0xe392b0, 0xffffff, 0xb58cff, 0xffd166, 0x8fd3ff, 0xff9cc8];
    const ring = [];
    for (let x = -5; x <= 4; x++) ring.push([x, 4], [x, -5]);
    for (let z = -4; z <= 3; z++) ring.push([-6, z], [5, z]);
    let i = 0;
    for (const [x, z] of ring) {
      const k = ((x * 2 + z * 3) % 4 + 4) % 4;
      v.set(x, 11, z, k === 1 ? 0x3e9e52 : 0x5fc46a);
      if (k === 0) {
        const c = flowers[i++ % flowers.length];
        v.set(x, 12, z, 0xffe066);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Z = z + dz;
          const onRing = X === -6 || X === 5 || Z === -5 || Z === 4;
          if (onRing && X >= -6 && X <= 5 && Z >= -5 && Z <= 4) v.set(X, 12, Z, c);
        }
        v.set(x, 11, z, c);
      }
    }
    v.set(-6, 13, 3, 0xe392b0); v.set(-6, 12, 3, 0xffe066); v.set(-6, 12, 2, 0xe392b0); v.set(-6, 11, 3, 0xe392b0); v.set(-6, 12, 4, 0xe392b0);
  },
  'moño'(v, c) {
    // moño chico y prolijo (antes era gigante): nudo de 2×2 y dos alas de 3×3
    const b = hexToInt(c), d = shade(c, -0.22), l = shade(c, 0.3);
    v.box(-1, 12, 0, 2, 1, 2, d);
    for (const s of [-1, 1]) {
      const X = (x) => (s < 0 ? x : -1 - x);
      for (let y = 11; y <= 13; y++) for (let x = -4; x <= -2; x++) {
        if ((y === 11 || y === 13) && x === -4) continue;
        v.set(X(x), y, 0, b);
        v.set(X(x), y, 1, y === 13 && x === -3 ? l : b);
      }
      v.set(X(-3), 12, 1, d);
    }
  },
  estrella(v) {
    for (let x = -3; x <= 2; x++) v.set(x, 12, 2, GOLD_D);
    const star = ['..#..', '..#..', '#####', '.###.', '.#.#.'];
    star.forEach((row, i) => [...row].forEach((ch, j) => {
      if (ch === '#') v.set(j - 3, 17 - i, 2, (i === 2 && j === 2) ? 0xffffff : (j < 2 ? GOLD_L : GOLD));
    }));
    v.set(-1, 15, 3, 0xe392b0);
    v.set(-4, 13, 2, 0xfff0c2); v.set(3, 13, 2, 0xfff0c2);
  },
  orejitas(v, c, hair) {
    const b = hexToInt(hair), d = shade(hair, -0.15), pink = 0xffa3c4;
    for (const s of [-1, 1]) {
      const X = (x) => (s < 0 ? x : -1 - x);
      for (let x = -5; x <= -2; x++) for (let z = -1; z <= 0; z++) v.set(X(x), 12, z, z === 0 && x > -5 && x < -2 ? pink : b);
      for (let x = -5; x <= -3; x++) for (let z = -1; z <= 0; z++) v.set(X(x), 13, z, z === 0 && x === -4 ? pink : d === b ? b : (x === -5 ? d : b));
      v.set(X(-5), 14, 0, b); v.set(X(-5), 14, -1, b); v.set(X(-4), 14, -1, b);
    }
  },
};


// =====================================================================
//                               ACCESORIOS
// =====================================================================
export function buildWand(v) {
  // en coords del brazo derecho (mano en y=-5, exterior +x). Sale de la mano hacia adelante y afuera:
  // con el brazo levantado la estrella queda al costado de la cara (antes quedaba enterrada en la cabeza).
  [[0, -5, 1], [0, -5, 2], [1, -5, 3], [1, -4, 4], [2, -4, 5], [2, -4, 6]].forEach(([x, y, z], i) => v.set(x, y, z, (i & 1) ? 0xffffff : 0xff9cc8));
  const star = ['..#..', '.###.', '#####', '.###.', '.#.#.'];
  star.forEach((row, i) => [...row].forEach((ch, j) => {
    if (ch === '#') v.set(j + 1, -1 - i, 7, (i === 2 && j === 2) ? 0xfff7c2 : (j < 2 && i < 3 ? GOLD_L : GOLD));
  }));
  v.set(3, -3, 8, 0xffffff); v.set(3, -3, 6, GOLD_D);
}
export function buildBag(v, p) {
  const bc = shade(p.c, -0.1);
  // en coords del brazo izquierdo (espejado: exterior = +x)
  for (let y = -8; y <= -6; y++) for (let x = 1; x <= 2; x++) for (let z = -1; z <= 1; z++) v.set(x, y, z, y === -6 ? shade(bc, 0.2) : bc);
  v.set(2, -7, 0, GOLD); v.set(2, -6, 0, GOLD);
  v.set(1, -5, -1, GOLD_D); v.set(1, -5, 1, GOLD_D); v.set(1, -4, 0, GOLD_D);
  v.set(2, -8, -1, shade(bc, -0.15)); v.set(2, -8, 1, shade(bc, -0.15));
}
export function buildGlasses(v) {
  const heart = ['##.##', '#####', '.###.', '..#..'];
  const lens = 0xff4f9a, glint = 0xffffff, frame = 0xd63d84;
  for (const x0 of [-6, 1]) heart.forEach((row, i) => [...row].forEach((ch, j) => {
    if (ch !== '#') return;
    const y = 5 - i;
    const edge = i === 0 || j === 0 || j === 4 || row[j - 1] !== '#' || row[j + 1] !== '#';
    v.set(x0 + j, y, 0, (i === 1 && j === 1) ? glint : edge ? frame : lens);
  }));
  v.set(-1, 5, 0, frame); v.set(0, 5, 0, frame);
}
export function buildWing(v) {
  // ala derecha en el plano XY (z=0), sale hacia +x desde el pivote
  const inside = (x, y) => {
    const ux = (x + 0.5 - 5.2) / 5.2, uy = (y + 0.5 - 4.6) / 5.4;
    const lx = (x + 0.5 - 3.4) / 3.3, ly = (y + 0.5 + 2.2) / 3.2;
    return (ux * ux + uy * uy <= 1 && y >= -1) || (lx * lx + ly * ly <= 1 && y <= 0);
  };
  for (let x = 0; x <= 10; x++) for (let y = -6; y <= 10; y++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
    const vein = x > 0 && (x === y || x === y + 1 || (y < 0 && x === -y * 1.5 + 1));
    v.set(x, y, 0, edge ? 0xb58cff : vein ? 0xeee4ff : (y > 2 ? 0xd4efff : 0xffd6ec));
  }
}
export function buildCat(v) {
  const fur = 0xffb36b, furL = 0xffe0b8, furD = 0xe08a4a;
  // cuerpito (en coords del cuerpo, adelante del torso)
  for (let x = -2; x <= 1; x++) for (let y = 5; y <= 7; y++) for (let z = 2; z <= 3; z++) v.set(x, y, z, fur);
  v.box(-1, 5, 4, 2, 2, 1, furL);
  // cabeza
  for (let x = -2; x <= 1; x++) for (let y = 8; y <= 10; y++) for (let z = 3; z <= 5; z++) v.set(x, y, z, fur);
  v.set(-2, 11, 4, fur); v.set(1, 11, 4, fur); v.set(-2, 11, 5, 0xffa3c4); v.set(1, 11, 5, 0xffa3c4);
  v.set(-2, 9, 6, INK); v.set(1, 9, 6, INK);
  v.set(-1, 8, 6, 0xe392b0); v.set(0, 8, 6, 0xe392b0);
  v.set(-1, 9, 6, furL); v.set(0, 9, 6, furL); v.set(-2, 8, 6, furL); v.set(1, 8, 6, furL);
  v.set(-1, 10, 6, furD); v.set(0, 10, 6, fur);
  // colita
  v.set(2, 5, 3, fur); v.set(3, 5, 3, fur); v.set(3, 6, 3, furD); v.set(3, 7, 3, fur);
}


// ---------- Cabeza: piezas nuevas ----------
// Las de HATS son gorros/sombreros: van a la altura fija de la cabeza (base y=10) y recortan el pelo de arriba.
export const HATS = new Set(['casco', 'gorra', 'gorro', 'piluso', 'capucha', 'sombrero_mago', 'sombrero_luna', 'sombrero_estrellas', 'galera']);
function dome(v, col, y0 = 10, wide = true) {
  // casquete redondeado que cubre el pelo (y0..y0+3)
  const rows = wide ? [[-7, 6, -6, 5], [-7, 6, -6, 5], [-6, 5, -5, 4], [-5, 4, -4, 3]] : [[-6, 5, -5, 4], [-6, 5, -5, 4], [-5, 4, -4, 3]];
  rows.forEach(([x0, x1, z0, z1], i) => {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if ((x === x0 || x === x1) && (z === z0 || z === z1)) continue;
      v.set(x, y0 + i, z, typeof col === 'function' ? col(x, y0 + i, z) : col);
    }
  });
}
function cone(v, y0, y1, r0, r1, col, bend = 0) {
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / Math.max(1, y1 - y0);
    const r = r0 + (r1 - r0) * t, cz = -bend * t * t;
    for (let x = -7; x <= 6; x++) for (let z = -9; z <= 6; z++) {
      const dx = x + 0.5, dz = z + 0.5 - cz;
      if (dx * dx + dz * dz <= r * r) v.set(x, y, z, col(x, y, z, t));
    }
  }
}
function brim(v, y, r, col) {
  for (let x = -9; x <= 8; x++) for (let z = -9; z <= 8; z++) {
    const dx = x + 0.5, dz = z + 0.5;
    if (dx * dx + dz * dz <= r * r) v.set(x, y, z, col);
  }
}
function wizardHat(v, base, band, star, opts = {}) {
  brim(v, 10, 7.6, shade(base, -0.12));
  brim(v, 11, 6.2, base);
  cone(v, 11, 20, 5.6, 1, (x, y, z, t) => {
    if (y === 12) return band;
    const r = hash3(x, y, z);
    if (opts.stars && r < 0.03) return GOLD;
    return base;
  }, 5);
  if (star) {
    const s = ['.#.', '###', '.#.'];
    s.forEach((row, i) => [...row].forEach((ch, j) => { if (ch === '#') v.set(j - 2, 16 - i, 4, i === 1 && j === 1 ? 0xffffff : star); }));
  }
}
Object.assign(CROWN_BUILD, {
  vincha(v, c) {
    const b = hexToInt(c);
    for (let x = -5; x <= 4; x++) { v.set(x, 12, 1, b); if (!(x & 1)) v.set(x, 13, 1, 0xfffaff); }
    for (let y = 8; y <= 11; y++) { v.set(-8, y, 1, b); v.set(7, y, 1, b); }
    v.set(-7, 12, 1, b); v.set(6, 12, 1, b);
    v.set(3, 13, 2, 0xffb3d1); v.set(4, 13, 2, 0xffe066); v.set(4, 14, 1, 0xffb3d1);
  },
  corona_p(v) {
    const velvet = 0xc23a5a;
    for (let x = -4; x <= 3; x++) for (let z = -3; z <= 2; z++) {
      const edge = x === -4 || x === 3 || z === -3 || z === 2;
      if (edge) { v.set(x, 12, z, GOLD_D); v.set(x, 13, z, GOLD); if ((x + z) & 1) v.set(x, 14, z, GOLD); }
      else { v.set(x, 12, z, velvet); v.set(x, 13, z, shade(velvet, 0.15)); }
    }
    v.set(-1, 14, -1, GOLD); v.set(0, 14, 0, GOLD); v.set(-1, 15, -1, GOLD_L); v.set(0, 15, 0, GOLD_L);
    v.set(-1, 13, 2, 0x4f7ce0); v.set(0, 13, 2, 0x4f7ce0); v.set(-1, 13, 3, 0x8fd3ff);
    v.set(-4, 13, -1, 0xcf5f5f); v.set(3, 13, 0, 0xcf5f5f);
  },
  laurel(v) {
    const ring = [];
    for (let x = -6; x <= 5; x++) ring.push([x, -5]);
    for (let z = -4; z <= 3; z++) ring.push([-6, z], [5, z]);
    for (const x of [-5, -4, -3, 2, 3, 4]) ring.push([x, 4]);
    for (const [x, z] of ring) {
      v.set(x, 11, z, GOLD);
      if (((x * 3 + z) & 1) === 0) v.set(x, 12, z, GOLD_L);
    }
    v.set(-3, 12, 5, GOLD); v.set(2, 12, 5, GOLD);
  },
  casco(v, c) {
    const pl = hexToInt(c);
    dome(v, (x, y, z) => ((x + z) % 5 === 0 && y === 11 ? SILVER_D : SILVER));
    for (let y = 4; y <= 10; y++) {
      for (let z = -6; z <= 2; z++) { v.set(-8, y, z, SILVER); v.set(7, y, z, SILVER); }
      for (let x = -7; x <= 6; x++) v.set(x, y, -7, SILVER);
    }
    for (const y of [5, 8]) { v.set(-8, y, 1, SILVER_D); v.set(7, y, 1, SILVER_D); }
    for (let x = -7; x <= 6; x++) v.set(x, 10, 6, x === -1 || x === 0 ? GOLD : SILVER_D);
    for (let z = -5; z <= 3; z++) { v.set(-1, 14, z, pl); v.set(0, 14, z, shade(pl, -0.12)); }
    for (let z = -4; z <= 1; z++) { v.set(-1, 15, z, shade(pl, 0.2)); v.set(0, 15, z, pl); }
    v.set(-1, 16, -2, pl); v.set(0, 16, -3, pl);
  },
  corona_rey(v) {
    const velvet = 0xc23a5a;
    for (let x = -4; x <= 3; x++) for (let z = -3; z <= 2; z++) {
      const edge = x === -4 || x === 3 || z === -3 || z === 2;
      if (edge) { v.set(x, 12, z, GOLD_D); v.set(x, 13, z, GOLD); }
      else { v.set(x, 12, z, velvet); v.set(x, 13, z, velvet); v.set(x, 14, z, shade(velvet, 0.15)); }
    }
    for (const [x, z] of [[-4, -3], [3, -3], [-4, 2], [3, 2], [-1, 2], [0, 2], [-1, -3], [0, -3], [-4, 0], [3, -1]]) {
      v.set(x, 14, z, GOLD); v.set(x, 15, z, GOLD);
      if ((x === -1 || x === 0) || ((x === -4 || x === 3) && (z === -3 || z === 2))) v.set(x, 16, z, GOLD_L);
    }
    for (let y = 15; y <= 17; y++) v.set(-1, y, -1, GOLD);
    v.set(-2, 16, -1, GOLD); v.set(0, 16, -1, GOLD);
    v.set(-1, 13, 3, 0xcf5f5f); v.set(0, 13, 3, 0x4f7ce0);
    for (const x of [-3, 2]) v.set(x, 12, 3, 0xffffff);
  },
  gorra(v, c) {
    const b = hexToInt(c), d = shade(c, -0.18), l = shade(c, 0.3);
    dome(v, (x, y) => (y === 13 ? d : b));
    v.set(-1, 14, -1, d); v.set(0, 14, -1, d); v.set(-1, 14, 0, d); v.set(0, 14, 0, d);
    for (let x = -5; x <= 4; x++) for (let z = 6; z <= 8; z++) {
      if ((x === -5 || x === 4) && z === 8) continue;
      v.set(x, 10, z, z === 8 ? d : l);
    }
    v.set(-1, 11, 5, 0xffffff); v.set(0, 11, 5, 0xffffff); v.set(-1, 12, 4, 0xffffff);
  },
  gorro(v, c) {
    const b = hexToInt(c), l = shade(c, 0.35);
    dome(v, (x, y) => (y === 12 ? l : b));
    for (let x = -7; x <= 6; x++) for (let z = -6; z <= 5; z++) {
      const edge = x === -7 || x === 6 || z === -6 || z === 5;
      if (edge && !((x === -7 || x === 6) && (z === -6 || z === 5))) v.set(x, 9, z, l);
    }
    v.sphere(-0.5, 15.2, -0.5, 1.9, 1.7, 1.9, (x, y) => (y < 15 ? 0xf1e6f5 : 0xffffff));
  },
  auris(v, c) {
    const band = 0x5a4a6a, cup = hexToInt(c);
    for (let x = -5; x <= 4; x++) v.set(x, 12, 0, band);
    for (const x of [-6, 5]) v.set(x, 11, 0, band);
    for (const x of [-7, 6]) { v.set(x, 10, 0, band); v.set(x, 9, 0, band); }
    for (const x0 of [-9, 7]) for (let y = 4; y <= 8; y++) for (let z = -1; z <= 1; z++) {
      if ((y === 4 || y === 8) && z !== 0) continue;
      v.set(x0, y, z, cup); v.set(x0 + 1, y, z, y === 6 && z === 0 ? 0xffffff : shade(cup, -0.2));
    }
  },
  piluso(v, c) {
    const b = hexToInt(c), d = shade(c, -0.2);
    brim(v, 10, 8.4, shade(c, 0.15));
    dome(v, (x, y) => (y === 11 ? d : b), 11, false);
    v.set(4, 12, 4, 0xffe066); v.set(5, 12, 3, 0xff9cc8);
  },
  diadema(v, c) {
    const flower = hexToInt(c);
    for (let x = -5; x <= 4; x++) {
      const z = Math.abs(x + 0.5) > 3 ? 1 : 2;
      v.set(x, 12, z, 0x4c9e4f);
      if ((x & 1) === 0) { v.set(x, 13, z, 0x6cc35d); v.set(x, 14, z, 0xa6e38f); }
    }
    v.set(-1, 13, 3, flower); v.set(0, 13, 3, flower); v.set(-1, 14, 3, flower); v.set(0, 14, 3, 0xffe066);
    v.set(-6, 12, 0, 0x4c9e4f); v.set(5, 12, 0, 0x4c9e4f);
  },
  antenitas(v, c) {
    const stalk = 0x5a4a6a, ball = hexToInt(c);
    for (const s of [-1, 1]) {
      const X = (x) => (s < 0 ? x : -1 - x);
      for (const [x, y] of [[-3, 12], [-3, 13], [-4, 14], [-4, 15]]) v.set(X(x), y, 1, stalk);
      for (const [x, y] of [[-5, 16], [-4, 16], [-5, 17], [-4, 17]]) v.set(X(x), y, 1, ball);
      v.set(X(-5), 17, 2, 0xffffff);
    }
  },
  corona_cristal(v) {
    const ice = [0xbfe4ff, 0xe3d6ff, 0xd8f6ff];
    for (let x = -4; x <= 3; x++) for (let z = -3; z <= 2; z++) {
      if (x === -4 || x === 3 || z === -3 || z === 2) v.set(x, 12, z, z === 2 || z === -3 ? 0xa9d4f5 : 0xc9b8ff);
    }
    const spikes = [[-1, 2, 4], [0, 2, 4], [-3, 2, 2], [2, 2, 2], [-4, 0, 2], [3, -1, 2], [-2, -3, 1], [1, -3, 1]];
    spikes.forEach(([x, z, h], i) => { for (let y = 13; y < 13 + h; y++) v.set(x, y, z, y === 12 + h ? 0xffffff : ice[(i + y) % 3]); });
  },
  sombrero_mago(v, c) { wizardHat(v, hexToInt(c), GOLD, GOLD, { stars: true }); },
  sombrero_luna(v, c) {
    const n = mix(c, 0x22205a, 0.55);
    wizardHat(v, n, SILVER, null);
    for (const [x, y] of [[-2, 17], [-3, 16], [-3, 15], [-3, 14], [-2, 13], [-1, 17], [-1, 13]]) v.set(x, y, 4 - (y > 16 ? 1 : 0), SILVER_L);
    v.set(1, 15, 3, 0xffffff); v.set(-1, 18, 1, 0xffffff);
  },
  sombrero_estrellas(v, c) { wizardHat(v, hexToInt(c), GOLD_L, GOLD, { stars: true }); v.set(-1, 21, -4, GOLD); v.set(0, 21, -4, GOLD_L); },
  capucha(v, c) {
    const b = shade(c, -0.15), rim = shade(c, 0.2);
    dome(v, b);
    for (let y = 2; y <= 9; y++) {
      for (let z = -6; z <= 4; z++) { v.set(-8, y, z, b); v.set(7, y, z, b); }
      for (let x = -7; x <= 6; x++) v.set(x, y, -7, b);
      v.set(-8, y, 5, rim); v.set(7, y, 5, rim);
    }
    for (let x = -7; x <= 6; x++) v.set(x, 10, 6, rim);
    v.set(-1, 14, -4, b); v.set(0, 14, -4, b); v.set(-1, 14, -5, b); v.set(-1, 15, -5, b);
  },
  lacito(v, c) {
    const b = hexToInt(c), d = shade(c, -0.22), l = shade(c, 0.3);
    v.set(3, 12, 2, d); v.set(3, 13, 2, d);
    for (const s of [-1, 1]) for (let i = 1; i <= 2; i++) for (let y = 11; y <= 14; y++) {
      if (i === 1 && (y === 11 || y === 14)) continue;
      v.set(3 + s * i, y, 2, y === 14 ? l : b);
    }
  },
  gorrito(v, c) {
    const b = hexToInt(c);
    // corrido hacia adelante: entre las orejas de los animalitos
    for (let y = 11; y <= 16; y++) {
      const r = 2.7 - (y - 11) * 0.45;
      for (let x = -3; x <= 2; x++) for (let z = -1; z <= 4; z++) if ((x + 0.5) ** 2 + (z - 1.5) ** 2 <= r * r) v.set(x, y, z, ((y + 1) >> 1) & 1 ? b : 0xffffff);
    }
    // punta del cono (con r < 0.5 no sale ningún vóxel): así el pompón queda apoyado y no flotando
    for (let x = -1; x <= 0; x++) for (let z = 1; z <= 2; z++) v.set(x, 16, z, 0xffffff);
    v.sphere(-0.5, 17.2, 1.5, 1.1, 1.1, 1.1, () => GOLD);
  },
  galera(v, c) {
    const hat = 0x3b2340, band = hexToInt(c);
    brim(v, 10, 7.2, hat);
    cone(v, 11, 17, 4.6, 4.6, (x, y, z) => (y <= 12 ? band : (z > 2 && x === -2 ? 0x5a4a6a : hat)));
    brim(v, 18, 4.6, 0x4a3a52);
    v.set(3, 12, 4, 0xffffff);
  },
});

// =====================================================================
//                          ACCESORIOS NUEVOS
// Coordenadas: los de mano en coords del brazo (mano en y=-5, exterior +x); los de cuerpo en coords del cuerpo.
// =====================================================================
export function buildNecklace(v) {
  const pearls = [[-3, 9], [-2, 8], [-1, 8], [0, 8], [1, 8], [2, 9]];
  pearls.forEach(([x, y], i) => v.set(x, y, 2, i & 1 ? 0xf3ecff : 0xffffff));
  v.set(-1, 7, 2, 0xe392b0); v.set(0, 7, 2, 0xff9cc8);
}
export function buildBouquet(v, c) {
  const wrap = hexToInt(c);
  for (let y = 4; y <= 7; y++) for (let x = -2 + (7 - y > 2 ? 1 : 0); x <= 1 - (7 - y > 2 ? 1 : 0); x++) v.set(x, y, 4, y === 7 ? shade(wrap, 0.3) : wrap);
  v.set(-1, 6, 5, shade(wrap, -0.2)); v.set(0, 6, 5, shade(wrap, -0.2));
  const fl = [0xe392b0, 0xffffff, 0xffd166, 0xb58cff, 0xff9cc8];
  let i = 0;
  for (let x = -3; x <= 2; x++) for (let y = 8; y <= 10; y++) {
    if ((x === -3 || x === 2) && y === 10) continue;
    v.set(x, y, 4, (x + y) % 3 === 0 ? 0x5fc46a : fl[i++ % fl.length]);
    if (y < 10 && x > -3 && x < 2) v.set(x, y, 5, fl[(i + 2) % fl.length]);
  }
}
export function buildSword(v) {
  const wood = 0xe0b07e, woodD = 0xb07a52;
  v.set(0, -5, 0, BOOT); v.set(0, -5, 1, BOOT); v.set(0, -5, 2, BOOT_L);
  for (let x = -1; x <= 1; x++) v.set(x, -5, 3, GOLD);
  v.set(0, -4, 3, GOLD_D); v.set(0, -6, 3, GOLD_D);
  for (let z = 4; z <= 11; z++) { v.set(0, -5, z, z === 11 ? woodD : wood); if (z < 10) v.set(0, -4, z, woodD); }
}
export function buildShield(v, c) {
  const b = hexToInt(c);
  for (let y = -8; y <= -1; y++) for (let z = -2; z <= 2; z++) {
    const w = y < -6 ? 1 : 2;
    if (Math.abs(z) > w) continue;
    const edge = Math.abs(z) === w || y === -1 || y === -8;
    v.set(2, y, z, edge ? GOLD : b);
  }
  for (const [y, z] of [[-3, -1], [-3, 1], [-4, 0], [-4, -1], [-4, 1], [-5, 0]]) v.set(3, y, z, 0xffffff);
}
export function buildScepter(v) {
  [[0, -5, 1], [0, -5, 2], [0, -4, 3], [0, -4, 4], [0, -3, 5], [0, -3, 6]].forEach(([x, y, z]) => v.set(x, y, z, GOLD));
  v.sphere(0, -2, 7.5, 1.3, 1.3, 1.3, () => 0xcf5f5f);
  v.set(0, -1, 8, 0xffffff);
  for (const [x, z] of [[-1, 7], [1, 7], [0, 6], [0, 9]]) v.set(x, -3, z, GOLD_D);
  v.set(0, 0, 7, GOLD); v.set(0, 1, 7, GOLD_L);
}
export function buildBackpack(v, c, zOff = 0) {
  const b = hexToInt(c), d = shade(c, -0.2);
  for (let x = -3; x <= 2; x++) for (let y = 4; y <= 9; y++) for (let z = -4; z <= -3; z++) {
    if (y === 9 && (x === -3 || x === 2)) continue;
    v.set(x, y, z + zOff, y === 9 ? shade(c, 0.2) : b);
  }
  for (let x = -2; x <= 1; x++) for (let y = 4; y <= 6; y++) v.set(x, y, -5 + zOff, y === 6 ? d : shade(c, -0.08));
  v.set(-1, 6, -6 + zOff, GOLD); v.set(0, 6, -6 + zOff, GOLD);
  for (const x of [-3, 2]) for (let y = 7; y <= 9; y++) v.set(x, y, 2, d);
}
export function buildBall(v) {
  // pelota playera de gajos de colores
  const cols = [0xe392b0, 0xffffff, 0xffd166, 0x8fd3ff, 0xffffff, 0x6fe3c1];
  v.sphere(0.5, -7, 2.5, 2.8, 2.8, 2.8, (x, y, z) => {
    if (y >= -5 && Math.abs(x - 0.5) < 1 && Math.abs(z - 2.5) < 1) return 0xffffff;
    return cols[Math.floor(((Math.atan2(z - 2.5, x - 0.5) + Math.PI) / (Math.PI * 2)) * 6) % 6];
  });
}
export function buildBalloon(v, c) {
  const b = hexToInt(c);
  for (let y = 0; y <= 17; y++) v.set(0, y, 0, 0xf2eaf2);
  v.sphere(0, 21.5, 0, 3.3, 3.8, 3.3, (x, y, z) => ((x === -2 && y >= 22 && y <= 23 && z >= 0) ? 0xffffff : (y < 20 ? shade(b, -0.1) : b)));
  v.set(0, 17, 0, shade(b, -0.25));
}
export function buildSkateboard(v, c) {
  const b = hexToInt(c);
  for (let y = -10; y <= -1; y++) for (let z = -1; z <= 1; z++) {
    if ((y === -10 || y === -1) && Math.abs(z) === 1) continue;
    v.set(2, y, z, b); v.set(3, y, z, INK);
  }
  for (const y of [-8, -3]) { v.set(1, y, -1, 0xffe066); v.set(1, y, 1, 0xffe066); }
}
export function buildFlowerWand(v) {
  [[0, -5, 1], [0, -5, 2], [1, -5, 3], [1, -4, 4], [2, -4, 5]].forEach(([x, y, z]) => v.set(x, y, z, 0x5fc46a));
  v.set(1, -4, 3, 0x8fdc7a);
  const cx = 2, cy = -3, cz = 7;
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) v.set(cx + dx, cy + dy, cz, (dx && dy) ? 0xf0d2dc : 0xe392b0);
  v.set(cx, cy, cz, 0xffe066); v.set(cx, cy, cz + 1, 0xfff0a8);
  v.set(cx + 2, cy + 2, cz, 0xffffff); v.set(cx - 2, cy + 1, cz - 1, 0xfff0a8);
}
export function buildLantern(v) {
  v.set(0, -6, 0, GOLD_D); v.set(0, -7, 0, GOLD_D);
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) { v.set(x, -8, z, GOLD_D); v.set(x, -12, z, GOLD_D); }
  for (let y = -11; y <= -9; y++) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
    const corner = Math.abs(x) === 1 && Math.abs(z) === 1;
    v.set(x, y, z, corner ? GOLD : (y === -10 && x === 0 && z === 0 ? 0xffffff : 0xfff0a8));
  }
  for (const [x, y, z] of [[2, -9, 1], [-2, -11, 0], [1, -7, -2]]) v.set(x, y, z, 0xfff59a);
}
export function buildBook(v) {
  const cover = 0x7d4fd6;
  for (let x = -1; x <= 1; x++) for (let z = 1; z <= 4; z++) {
    v.set(x, -6, z, cover);
    v.set(x, -5, z, z === 1 ? cover : (x === 1 ? 0xfff7fb : 0xf3e8d8));
  }
  v.set(0, -7, 2, GOLD); v.set(0, -7, 3, GOLD); v.set(-1, -7, 2, GOLD_L);
}
export function buildOrb(v) {
  v.sphere(-0.5, 8, 4.5, 2.3, 2.3, 2.3, (x, y) => (x === -2 && y === 9 ? 0xffffff : y < 8 ? 0xb9a6ff : 0xdcd0ff));
  for (let x = -2; x <= 1; x++) for (let z = 3; z <= 6; z++) if (!((x === -2 || x === 1) && (z === 3 || z === 6))) v.set(x, 5, z, GOLD_D);
}
export function buildStaff(v) {
  const wood = 0xb07a52, woodL = 0xd09a6a;
  for (let y = -15; y <= 3; y++) v.set(0, y, 1, (y & 3) === 0 ? woodL : wood);
  for (const [x, z] of [[-1, 1], [1, 1], [0, 0], [0, 2]]) { v.set(x, 4, z, GOLD_D); v.set(x, 5, z, GOLD); }
  v.sphere(0, 6.6, 1, 1.3, 1.4, 1.3, () => 0x8fe8ff);
  v.set(0, 7, 2, 0xffffff); v.set(-1, 6, 1, 0xd4f6ff);
}
export function buildOwl(v) {
  const b = 0xb07a52, belly = 0xf3dfc3, d = 0x8a5a3a;
  for (let x = -9; x <= -6; x++) for (let y = 10; y <= 14; y++) for (let z = -1; z <= 1; z++) {
    if ((x === -9 || x === -6) && (y === 10 || y === 14)) continue;
    v.set(x, y, z, z === 1 && y < 13 && x > -9 && x < -6 ? belly : b);
  }
  v.set(-9, 15, 0, d); v.set(-6, 15, 0, d);
  v.set(-9, 13, 2, 0xffffff); v.set(-6, 13, 2, 0xffffff); v.set(-8, 13, 2, INK); v.set(-7, 13, 2, INK);
  v.set(-8, 12, 2, GOLD); v.set(-7, 12, 2, GOLD_D);
  v.set(-10, 12, 0, d); v.set(-5, 12, 0, d); v.set(-10, 11, 0, d); v.set(-5, 11, 0, d);
}
/** Alas de mariposa (plano XY, salen hacia +x). */
export function buildButterflyWing(v, c) {
  const b = hexToInt(c), dk = mix(c, INK, 0.55), l = shade(c, 0.4);
  const up = (x, y) => { const ux = (x + 0.5 - 4.8) / 5, uy = (y + 0.5 - 5) / 5.2; return ux * ux + uy * uy <= 1 && y >= 0; };
  const lo = (x, y) => { const ux = (x + 0.5 - 3.6) / 3.6, uy = (y + 0.5 + 2.6) / 3.4; return ux * ux + uy * uy <= 1 && y < 1; };
  const inside = (x, y) => up(x, y) || lo(x, y);
  for (let x = 0; x <= 10; x++) for (let y = -7; y <= 10; y++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x + 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
    const spot = (x === 6 && y === 6) || (x === 3 && y === -3);
    v.set(x, y, 0, edge ? dk : spot ? 0xffffff : (x + y) % 4 === 0 ? l : b);
  }
}
/** Alas de hada teñidas con un color (las de alas_hada). */
export function buildTintWing(v, c) {
  const e = shade(c, -0.12), a = mix(c, 0xffffff, 0.55), b2 = mix(c, 0xffffff, 0.78);
  const inside = (x, y) => {
    const ux = (x + 0.5 - 5.2) / 5.2, uy = (y + 0.5 - 4.6) / 5.4;
    const lx = (x + 0.5 - 3.4) / 3.3, ly = (y + 0.5 + 2.2) / 3.2;
    return (ux * ux + uy * uy <= 1 && y >= -1) || (lx * lx + ly * ly <= 1 && y <= 0);
  };
  for (let x = 0; x <= 10; x++) for (let y = -6; y <= 10; y++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
    v.set(x, y, 0, edge ? e : (y > 2 ? a : b2));
  }
}
