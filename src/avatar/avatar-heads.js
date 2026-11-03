// Cabezas de los personajes: peinados, cara en alta resolución (ojos con brillo, boca, cachetes)
// y cabezas de animalitos (orejas, hocico, colas). Lo usa avatar.js.
// Coordenadas locales de la cabeza: x [-6,6), y [0,10), z [-5,5). Cara en la capa z=4.
import {
  S, INK, TIE, mix, hash3, shade, hexToInt, hairHex, skinHex, hairPal, cachedGeo, furPal, paintFur,
} from './avatar-kit.js';

// Color con mechones verticales suaves
const strand = (h) => (x, y, z) => (((x * 7 + z * 3) & 3) === 0 ? h.m : h.b);

function capTop(v, h) {
  for (let x = -6; x <= 5; x++) for (let z = -5; z <= 4; z++) {
    const ex = x === -6 || x === 5, ez = z === -5 || z === 4;
    if (ex && ez) continue;
    v.set(x, 10, z, h.b);
  }
  for (let x = -5; x <= 4; x++) for (let z = -4; z <= 3; z++) {
    const ex = x === -5 || x === 4, ez = z === -4 || z === 3;
    if (ex && ez) continue;
    v.set(x, 11, z, h.b);
  }
  // brillo del pelo
  for (const [x, z] of [[-3, 1], [-2, 1], [-2, 2], [-1, 2], [-3, 0], [0, 3], [-4, 2]]) v.set(x, 11, z, h.l);
  v.set(-1, 11, 3, h.ll); v.set(-2, 11, 3, h.l);
}
function sides(v, h, yMin, zMin = -5, zMax = 3, wave = null) {
  const col = strand(h);
  for (let y = yMin; y <= 10; y++) for (let z = zMin; z <= zMax; z++) {
    const o = wave ? wave(y) : 0;
    v.set(-7 - Math.max(0, -o), y, z, col(-7, y, z));
    v.set(6 + Math.max(0, o), y, z, col(6, y, z));
  }
}
function back(v, h, yMin, wave = null, tip = null) {
  const col = strand(h);
  for (let y = yMin; y <= 10; y++) {
    const o = wave ? wave(y) : 0;
    const x0 = (y === yMin ? -5 : -6) + o, x1 = (y === yMin ? 4 : 5) + o;
    for (let x = x0; x <= x1; x++) {
      const c = tip && y < tip.y ? tip.c : col(x, y, -6);
      v.set(x, y, -6, c);
      if (y < 0) v.set(x, y, -5, c);
    }
    if (y < 0 && y > yMin) { // relleno lateral detrás de los hombros
      v.set(-7 + o, y, -6, col(-7, y, -6)); v.set(6 + o, y, -6, col(6, y, -6));
    }
  }
}
// Flequillos (después de dibujar la cara)
function bangsFull(v, h) {
  for (let x = -5; x <= 4; x++) { v.set(x, 9, 4, h.b); v.set(x, 8, 4, h.b); }
  for (const x of [-5, -4, -3, -1, 0, 2, 3, 4]) v.set(x, 7, 4, h.b);
  for (let x = -4; x <= 3; x++) { v.set(x, 9, 5, h.b); v.set(x, 10, 5, x > -3 && x < 2 ? h.l : h.b); }
  for (const x of [-4, -3, 0, -1, 2, 3]) v.set(x, 8, 5, h.d);
  for (let y = 3; y <= 9; y++) { v.set(-6, y, 4, h.b); v.set(5, y, 4, h.b); }
}
function bangsSide(v, h, flip = false) {
  const X = (x) => (flip ? -1 - x : x);
  for (let x = -5; x <= 4; x++) { v.set(x, 9, 4, h.b); v.set(x, 8, 4, h.b); }
  for (let x = -5; x <= 1; x++) v.set(X(x), 7, 4, h.b);
  for (let x = -5; x <= -3; x++) v.set(X(x), 6, 4, h.d);
  for (let x = -5; x <= 2; x++) v.set(X(x), 9, 5, h.b);
  for (let x = -5; x <= 0; x++) v.set(X(x), 8, 5, x > -4 ? h.d : h.b);
  for (let x = -4; x <= 3; x++) v.set(X(x), 10, 5, x > -3 && x < 1 ? h.l : h.b);
  for (let y = 3; y <= 9; y++) { v.set(-6, y, 4, h.b); v.set(5, y, 4, h.b); }
}
function bangsPart(v, h) {
  for (const s of [-1, 1]) {
    const X = (x) => (s < 0 ? x : -1 - x);
    for (let x = -5; x <= -2; x++) { v.set(X(x), 9, 4, h.b); v.set(X(x), 8, 4, h.b); v.set(X(x), 9, 5, h.b); v.set(X(x), 10, 5, h.b); }
    for (let x = -5; x <= -3; x++) v.set(X(x), 7, 4, h.b);
    v.set(X(-5), 6, 4, h.d);
    v.set(X(-3), 8, 5, h.d);
  }
  v.set(-1, 10, 5, h.d); v.set(0, 10, 5, h.d);
  for (let y = 3; y <= 9; y++) { v.set(-6, y, 4, h.b); v.set(5, y, 4, h.b); }
}

// Estilos: back() se dibuja antes de la cabeza, front() después (flequillo encima de la piel).
// swings: piezas que se balancean (colitas/trenzas), con pivote en coords de cabeza.
// top: y donde apoya la corona; crownZ: corrimiento de la corona; long: pelo largo en la espalda.
export const HAIR = {
  largo: {
    top: 12, long: true,
    back(v, h) {
      sides(v, h, -5, -5, 3); back(v, h, -7);
      for (let y = -4; y <= 9; y++) { v.set(-7, y, 4, h.b); v.set(6, y, 4, h.b); }
      for (let y = -4; y <= 2; y++) { v.set(-7, y, 5, y < -2 ? h.l : h.b); v.set(6, y, 5, y < -2 ? h.l : h.b); }
    },
    front(v, h) { capTop(v, h); bangsSide(v, h); },
  },
  coleta: {
    top: 12,
    back(v, h) { sides(v, h, 3, -5, 2); back(v, h, 2); },
    front(v, h) { capTop(v, h); bangsFull(v, h); },
    swings: [{
      at: [0, 10, -6],
      build(v, h) {
        v.box(-1, -1, -1, 2, 2, 1, TIE);
        v.box(-2, -1, -3, 4, 3, 2, h.b);
        v.box(-1, 2, -3, 2, 1, 2, h.l);
        for (let y = -9; y <= -2; y++) {
          const w = y < -7 ? 1 : 2;
          for (let x = -w; x < w; x++) for (let z = -5; z <= -3; z++) {
            if (z === -3 && y < -3) continue;
            v.set(x, y, z, ((x + y) & 3) === 0 ? h.d : (y < -7 ? h.l : h.b));
          }
        }
      },
      sway: 1,
    }],
  },
  corto: {
    top: 12,
    back(v, h) {
      sides(v, h, 1, -5, 4); back(v, h, 1);
      for (let z = -5; z <= 3; z++) { v.set(-8, 1, z, h.d); v.set(7, 1, z, h.d); }
      for (let x = -6; x <= 5; x++) v.set(x, 1, -7, h.d);
      for (let x = -6; x <= 5; x++) for (let y = 2; y <= 9; y++) v.set(x, y, -7, y > 6 ? h.b : null);
    },
    front(v, h) {
      capTop(v, h);
      for (let x = -5; x <= 4; x++) { v.set(x, 9, 4, h.b); v.set(x, 8, 4, h.b); v.set(x, 7, 4, h.b); v.set(x, 9, 5, h.b); v.set(x, 10, 5, h.b); }
      for (let x = -4; x <= 3; x++) v.set(x, 8, 5, (((x + 8) >> 1) & 1) ? h.m : h.b);
      for (let y = 2; y <= 9; y++) { v.set(-6, y, 4, h.b); v.set(5, y, 4, h.b); }
      // hebillita
      v.set(3, 9, 6, 0xffe066); v.set(4, 9, 6, 0xffe066); v.set(3, 10, 6, 0xffb0d0);
    },
  },
  rodete: {
    top: 12, crownZ: 2,
    back(v, h) { sides(v, h, 4, -5, 2); back(v, h, 3); },
    front(v, h) {
      capTop(v, h); bangsSide(v, h, true);
      v.sphere(-0.5, 14.5, -4, 3, 2.8, 2.6, (x, y) => (y > 15 && x < 0 ? h.l : y < 13 ? h.m : h.b));
      for (let x = -3; x <= 2; x++) for (let z = -6; z <= -2; z++) {
        const edge = x === -3 || x === 2 || z === -6 || z === -2;
        if (edge && !((x === -3 || x === 2) && (z === -6 || z === -2))) v.set(x, 12, z, TIE);
      }
    },
  },
  trenzas: {
    top: 12,
    back(v, h) { sides(v, h, 3, -5, 2); back(v, h, 1); },
    front(v, h) { capTop(v, h); bangsPart(v, h); v.set(-1, 11, 2, h.d); v.set(0, 11, 2, h.d); v.set(-1, 11, 1, h.d); v.set(0, 11, 1, h.d); },
    swings: [
      { at: [-7, 3, 0], build: braid, sway: 0.7 },
      { at: [7, 3, 0], build: braid, sway: 0.7, mirror: true },
    ],
  },
  rizos: {
    top: 14, long: true,
    back(v, h) {
      const curl = (x, y, z) => {
        const r = hash3(x, y, z);
        const blob = (((x + 20) >> 1) + ((y + 20) >> 1) + ((z + 20) >> 1)) & 1;
        return blob ? h.b : (r < 0.5 ? h.l : h.m);
      };
      v.sphere(-0.5, 6, -1, 8.2, 8, 6.8, (x, y, z) => {
        // hueco de la cara y del cuerpo
        if (z >= 3 && y <= 7 && x >= -6 && x <= 5) return null;
        if (y < 0 && x >= -6 && x <= 5 && z >= -3) return null;
        if (y < -1 && z > -4 && (x < -6 || x > 5) && z > 1) return null;
        return curl(x, y, z);
      });
      // copete achatado: base firme para coronas/flores (si no, flotan sobre la bola de rulos)
      for (let y = 11; y <= 13; y++) {
        const i = y === 13 ? 1 : 0;
        for (let x = -6 + i; x <= 5 - i; x++) for (let z = -5 + i; z <= 4 - i; z++) {
          const ex = x === -6 + i || x === 5 - i, ez = z === -5 + i || z === 4 - i;
          if ((ex && ez) || v.has(x, y, z)) continue;
          v.set(x, y, z, curl(x, y, z));
        }
      }
    },
    front(v, h) {
      for (let x = -5; x <= 4; x++) { v.set(x, 9, 4, h.b); v.set(x, 8, 4, (((x + 8) >> 1) & 1) ? h.l : h.b); }
      for (const x of [-5, -4, -2, -1, 1, 2, 4]) v.set(x, 7, 4, h.b);
      for (let x = -5; x <= 4; x++) { v.set(x, 9, 5, (((x + 8) >> 1) & 1) ? h.b : h.l); v.set(x, 10, 5, h.b); if (!(((x + 8) >> 1) & 1)) v.set(x, 8, 5, h.b); }
      for (let y = 2; y <= 9; y++) { v.set(-6, y, 4, h.b); v.set(5, y, 4, h.b); v.set(-7, y, 4, (((y + 8) >> 1) & 1) ? h.l : h.b); v.set(6, y, 4, (((y + 8) >> 1) & 1) ? h.b : h.l); }
    },
  },
  colitas: {
    top: 12,
    back(v, h) { sides(v, h, 4, -5, 2); back(v, h, 3); },
    front(v, h) { capTop(v, h); bangsFull(v, h); },
    swings: [
      { at: [-7, 9, -2], build: pigtail, sway: 1 },
      { at: [7, 9, -2], build: pigtail, sway: 1, mirror: true },
    ],
  },
  ondas: {
    top: 12, long: true,
    back(v, h) {
      const wave = (y) => [0, 1, 1, 0, -1, -1][((y % 6) + 60) % 6] * (y < 4 ? 1 : 0);
      const tipC = mix(h.ll, 0xd9a8ff, 0.5); // puntas lila pastel (con celeste el castaño quedaba gris)
      sides(v, h, -9, -5, 3, wave);
      back(v, h, -11, wave, { y: -7, c: tipC });
      for (let y = -9; y <= -7; y++) for (let z = -5; z <= 3; z++) {
        const o = wave(y);
        v.set(-7 - Math.max(0, -o), y, z, tipC); v.set(6 + Math.max(0, o), y, z, tipC);
      }
      for (let y = -6; y <= 9; y++) { v.set(-7, y, 4, y < -3 ? h.l : h.b); v.set(6, y, 4, y < -3 ? h.l : h.b); }
    },
    front(v, h) {
      capTop(v, h); bangsSide(v, h, true);
      // broche de caracol
      v.set(6, 8, 5, 0xffb3c8); v.set(6, 9, 5, 0xfff7fb); v.set(6, 8, 6, 0xff8fb0); v.set(6, 7, 5, 0xffb3c8);
    },
  },
};
function braid(v, h) {
  for (let i = 1; i <= 9; i++) {
    const c = (i & 1) ? h.b : h.d;
    const o = (i & 1) ? 0 : -1;
    v.box(-1, -i, -1, 2, 1, 2, c);
    v.set(o === 0 ? -1 : 0, -i, 0, (i & 1) ? h.l : h.b);
  }
  v.box(-1, -10, -1, 2, 1, 2, TIE);
  v.box(-1, -12, -1, 2, 2, 2, h.b);
  v.set(-1, -12, 0, h.l);
}
function pigtail(v, h) {
  v.box(-1, -1, -1, 1, 2, 2, TIE);
  for (let y = -2; y <= 1; y++) for (let x = -4; x <= -2; x++) for (let z = -2; z <= 1; z++) {
    if ((y === 1 || y === -2) && (z === -2 || z === 1) && x !== -3) continue;
    v.set(x, y, z, y === 1 ? h.l : h.b);
  }
  for (let y = -8; y <= -3; y++) {
    const x0 = y < -6 ? -4 : -5;
    for (let x = x0; x <= -3; x++) for (let z = -1; z <= 0; z++) v.set(x, y, z, (((y + 20) >> 1) & 1) ? h.b : h.m);
  }
  v.set(-4, -9, 0, h.l); v.set(-4, -9, -1, h.l);
}


// ---------- Peinados nuevos (cortos, despeinado, jopo, barba) ----------
function shortBack(v, h, yMin = 4) {
  sides(v, h, yMin + 1, -5, 2); back(v, h, yMin);
  for (let z = -4; z <= 2; z++) { v.set(-7, yMin + 1, z, h.d); v.set(6, yMin + 1, z, h.d); }
}
function shortBangs(v, h, ragged = false) {
  for (let x = -5; x <= 4; x++) { v.set(x, 9, 4, h.b); v.set(x, 9, 5, h.b); v.set(x, 10, 5, (x > -3 && x < 2) ? h.l : h.b); }
  for (let x = -5; x <= 4; x++) if (!ragged || (x & 1)) v.set(x, 8, 4, x === -5 || x === 4 ? h.d : h.b);
  if (ragged) for (const x of [-4, 0, 3]) v.set(x, 7, 4, h.d);
  for (let y = 5; y <= 9; y++) { v.set(-6, y, 4, h.b); v.set(5, y, 4, h.b); }
  v.set(-6, 5, 3, h.d); v.set(5, 5, 3, h.d);
}
Object.assign(HAIR, {
  cortito: {
    top: 12,
    back(v, h) { shortBack(v, h, 4); },
    front(v, h) {
      capTop(v, h); shortBangs(v, h);
      for (let x = -5; x <= -1; x++) v.set(x, 8, 5, h.d); // raya al costado
    },
  },
  despeinado: {
    top: 13,
    back(v, h) {
      shortBack(v, h, 3);
      for (const [x, y, z] of [[-8, 8, -2], [7, 8, -1], [-8, 6, 0], [7, 6, -3], [-2, 6, -7], [2, 8, -7]]) v.set(x, y, z, h.b);
    },
    front(v, h) {
      capTop(v, h); shortBangs(v, h, true);
      // mechones parados arriba
      const tufts = [[-4, 0], [-1, -2], [2, 1], [0, 3], [-3, -3], [3, -2], [-5, 2]];
      for (const [x, z] of tufts) {
        v.set(x, 12, z, h.b); v.set(x, 13, z, h.l);
        v.set(x + 1, 12, z, h.d);
      }
      v.set(-1, 14, 0, h.l); v.set(1, 13, 3, h.l);
    },
  },
  flequillo: {
    top: 12,
    back(v, h) { sides(v, h, 2, -5, 3); back(v, h, 1); },
    front(v, h) {
      capTop(v, h);
      // flequillo largo barrido hacia un costado (tapa media frente)
      for (let x = -5; x <= 4; x++) { v.set(x, 9, 4, h.b); v.set(x, 9, 5, h.b); v.set(x, 10, 5, h.b); }
      for (let y = 6; y <= 8; y++) for (let x = -5; x <= 4 - (8 - y) * 3; x++) v.set(x, y, 4, (x + y) % 4 === 0 ? h.d : h.b);
      for (let x = -4; x <= 2; x++) v.set(x, 8, 5, (((x + 8) >> 1) & 1) ? h.l : h.b);
      for (let y = 2; y <= 9; y++) { v.set(-6, y, 4, h.b); v.set(5, y, 4, h.b); }
      v.set(-6, 1, 3, h.d); v.set(5, 1, 3, h.d);
    },
  },
  jopo: {
    top: 14,
    back(v, h) { shortBack(v, h, 4); },
    front(v, h) {
      capTop(v, h);
      for (let x = -5; x <= 4; x++) { v.set(x, 9, 4, h.b); v.set(x, 9, 5, h.b); }
      // jopo: onda alta que sale hacia adelante
      for (let x = -4; x <= 3; x++) {
        const k = x + 4;
        v.set(x, 12, 1, h.b); v.set(x, 12, 2, h.b); v.set(x, 12, 3, h.l);
        v.set(x, 12, 4, h.b); v.set(x, 11, 5, h.b); v.set(x, 10, 5, h.b);
        v.set(x, 13, 2, k > 1 && k < 7 ? h.l : h.b); v.set(x, 13, 3, h.b);
        v.set(x, 11, 6, h.d);
      }
      for (let y = 5; y <= 9; y++) { v.set(-6, y, 4, h.d); v.set(5, y, 4, h.d); }
    },
  },
  barba: {
    top: 12,
    back(v, h) { shortBack(v, h, 4); },
    front(v, h) {
      capTop(v, h); shortBangs(v, h);
      // barba larga de sabio: rodea la cara y cae sobre el pecho (deja ver la boca)
      for (let y = 0; y <= 4; y++) {
        for (const x of [-6, 5]) v.set(x, y, 4, h.b);
        if (y <= 3) for (const x of [-5, 4]) v.set(x, y, 5, h.b);
      }
      for (let x = -5; x <= 4; x++) {
        v.set(x, 0, 5, (((x + 8) >> 1) & 1) ? h.b : h.l);
        if (x < -2 || x > 1) v.set(x, 1, 5, h.b);
      }
      for (let y = -6; y <= -1; y++) {
        const w = y > -3 ? 5 : y > -5 ? 4 : 2;
        for (let x = -w; x < w; x++) for (let z = 2; z <= 5; z++) {
          if (z === 2 && y > -2) continue;
          v.set(x, y, z, ((x * 3 + y) & 3) === 0 ? h.l : (z === 5 ? h.b : h.d));
        }
      }
      v.set(-1, -7, 4, h.l); v.set(0, -7, 4, h.b);
      // bigote
      for (const [x, y] of [[-3, 2], [-2, 2], [-1, 3], [0, 3], [1, 2], [2, 2]]) v.set(x, y, 5, h.l);
    },
  },
});

// =====================================================================
//                          CABEZA (persona)
// =====================================================================
/**
 * Cabeza de persona. hatCut: con gorros/sombreros se saca el pelo de arriba (y >= 11) para que no lo atraviese.
 */
export function buildHead(v, look, hatCut = false) {
  const skin = hexToInt(skinHex(look.skin));
  const st = HAIR[look.hair] || HAIR.largo;
  const h = hairPal(hairHex(look.hairColor));
  st.back(v, h);
  // cabeza redondeada
  for (let x = -6; x <= 5; x++) for (let y = 0; y <= 9; y++) for (let z = -5; z <= 4; z++) {
    const ex = x === -6 || x === 5, ey = y === 0 || y === 9, ez = z === -5 || z === 4;
    if ((ex && ey) || (ex && ez) || (ey && ez)) continue;
    v.set(x, y, z, skin);
  }
  // orejitas
  v.set(-7, 4, 0, shade(skin, -0.06)); v.set(6, 4, 0, shade(skin, -0.06));
  v.set(-7, 4, -1, shade(skin, -0.1)); v.set(6, 4, -1, shade(skin, -0.1));
  // pera apenas más oscura (da volumen a la cara)
  for (let x = -4; x <= 3; x++) v.set(x, 0, 3, shade(skin, -0.05));
  st.front(v, h);
  if (hatCut) {
    for (const k of [...v.map.keys()]) {
      const [x, y, z] = k.split(',').map(Number);
      if (y >= 11 && x >= -8 && x <= 7 && z >= -8 && z <= 6) v.map.delete(k);
    }
  }
}

// =====================================================================
//                      CARA EN ALTA RESOLUCIÓN
// Ojos, boca, cachetes y cejas se dibujan con medio vóxel (F = S/2) en una capa fina delante de la cara:
// así la cara se ve prolija y definida aunque el personaje se vea grande.
// =====================================================================
export const F = S / 2;
const EYE_COLORS = { princesa: 0x6a4fb0, principe: 0x3f6fc4, chica: 0x3f8f6a, chico: 0x7a4a2a, hada: 0x2f9aa6, mago: 0x6a4fb0 };
// filas de arriba hacia abajo; K tinta, W brillo, D iris oscuro, I iris, L iris claro, s brillo chico
const EYE_ART = {
  fem: ['KKKK', 'KWWD', 'DWWD', 'IIDI', 'ILIs', '.II.'],
  masc: ['KKKK', 'KWWD', 'DWWD', 'IDDI', 'ILIs', '.II.'],
  animal: ['.KK.', 'KWKK', 'KWKK', 'KKKs', '.KK.'],
};
/** Ojos (malla aparte para parpadear), centrados en y=0. style: 'fem' | 'masc' | 'animal'. */
export function eyesGeo(style, irisHex = 0x6a4fb0) {
  return cachedGeo(`eyes|${style}|${irisHex}`, (v) => {
    const iris = hexToInt(irisHex);
    const pal = { K: INK, W: 0xffffff, D: shade(iris, -0.42), I: iris, L: shade(iris, 0.32), s: 0xffffff };
    const art = EYE_ART[style] || EYE_ART.fem;
    const H = art.length;
    for (const side of [-1, 1]) {
      // ojo izquierdo: x -8..-5 / derecho: x 4..7 (en medios vóxeles). El brillo queda siempre arriba a la izquierda.
      const x0 = side < 0 ? -8 : 4;
      art.forEach((row, i) => [...row].forEach((ch, j) => {
        if (ch === '.') return;
        v.set(x0 + j, H - 1 - i, 0, pal[ch]);
      }));
      if (style === 'fem') { // pestañas hacia afuera
        const ox = side < 0 ? x0 - 1 : x0 + 4;
        v.set(ox, H - 1, 0, INK); v.set(ox + side, H, 0, INK);
      }
    }
  }, (g) => g.translate(0, -(EYE_ART[style] || EYE_ART.fem).length / 2 * F, 0), F);
}
export function eyeStyle(type, animal) { return animal ? 'animal' : (['principe', 'chico', 'mago'].includes(type) ? 'masc' : 'fem'); }
export function eyeColor(type) { return EYE_COLORS[type] || 0x6a4fb0; }

/**
 * Detalles fijos de la cara (boca, cachetes, cejas; hocico de animalito) en medios vóxeles.
 * z=0 es la superficie de la cara (5 vóxeles adelante del centro). La malla se aplasta ×0.4 en z, así que el hocico
 * (1 vóxel más adelante) queda en z=5.
 */
export function faceGeo(look, type, animal) {
  const masc = eyeStyle(type, animal) === 'masc';
  const key = `face|${animal ? type : (masc ? 'm' : 'f')}|${look.skin}|${look.hairColor}|${animal ? look.hair : ''}`;
  return cachedGeo(key, (v) => {
    if (animal) return animalFace(v, look, type);
    const skin = hexToInt(skinHex(look.skin));
    const blush = mix(skin, 0xff6f9c, 0.45), blushL = mix(skin, 0xff9cbc, 0.3);
    // cachetes ovalados
    for (const x0 of [-11, 6]) {
      for (let x = 0; x < 5; x++) v.set(x0 + x, 4, 0, x === 0 || x === 4 ? blushL : blush);
      for (let x = 1; x < 4; x++) v.set(x0 + x, 3, 0, blushL);
    }
    // sonrisa
    const lip = mix(skin, 0x9a2f5a, 0.75);
    v.set(-2, 5, 0, lip); v.set(1, 5, 0, lip);
    v.set(-1, 4, 0, lip); v.set(0, 4, 0, lip);
    if (!masc) { v.set(-1, 5, 0, 0xff8fb0); v.set(0, 5, 0, 0xff8fb0); } // boquita rosa
    else {
      // cejas del color del pelo
      const brow = shade(hairHex(look.hairColor), -0.25);
      for (const x0 of [-8, 4]) for (let x = 0; x < 4; x++) v.set(x0 + x, 14, 0, brow);
    }
  }, null, F);
}
function animalFace(v, look, type) {
  const f = furPal(look);
  const nose = type === 'osito' ? 0x4a2c3a : 0xff7fa8, noseD = shade(nose, -0.25);
  const mouth = mix(f.cream, INK, 0.75);
  const z = 5; // sobre el hocico (la capa de la cara se aplasta ×0.4: 5 medios vóxeles = 1 vóxel)
  const art = type === 'osito'
    ? ['.NNNN.', 'NNNNNN', '.nNNn.', '..KK..', 'K.KK.K', '.K..K.']
    : ['.NNNN.', '..nn..', '..KK..', 'K.KK.K', '.K..K.'];
  const top = type === 'osito' || type === 'zorrito' ? 7 : 5;
  art.forEach((row, i) => [...row].forEach((ch, j) => {
    if (ch === '.') return;
    v.set(j - 3, top - i, z, ch === 'N' ? nose : ch === 'n' ? noseD : mouth);
  }));
  v.set(-2, top, z, shade(nose, 0.35)); // brillo de la nariz
  if (type === 'conejito') { v.set(-1, 2, z, 0xffffff); v.set(0, 2, z, 0xffffff); v.set(-1, 1, z, 0xf2eaf2); v.set(0, 1, z, 0xf2eaf2); }
  // cachetes
  const blush = mix(f.cream, 0xff6f9c, 0.42);
  for (const x0 of [-11, 7]) for (let x = 0; x < 4; x++) v.set(x0 + x, 5, 0, blush);
  // bigotes (gatito)
  if (type === 'gatito') {
    const wh = shade(f.b, -0.45);
    for (const s of [-1, 1]) {
      const X = (x) => (s < 0 ? -1 - x : x);
      for (let x = 6; x <= 9; x++) { v.set(X(x), 6 + (x > 7 ? 1 : 0), 1, wh); v.set(X(x), 4 - (x > 7 ? 1 : 0), 1, wh); }
    }
  }
}

// =====================================================================
//                          CABEZA (animalito)
// =====================================================================
export const ANIMAL_HEAD = { top: 11 };
export function buildAnimalHead(v, look, type) {
  const f = furPal(look);
  const skin = 0xfe00fe; // marcador: se repinta con el pelaje
  for (let x = -6; x <= 5; x++) for (let y = 0; y <= 9; y++) for (let z = -5; z <= 4; z++) {
    const ex = x === -6 || x === 5, ey = y === 0 || y === 9, ez = z === -5 || z === 4;
    if ((ex && ey) || (ex && ez) || (ey && ez)) continue;
    v.set(x, y, z, skin);
  }
  for (let x = -5; x <= 4; x++) for (let z = -4; z <= 3; z++) {
    if ((x === -5 || x === 4) && (z === -4 || z === 3)) continue;
    v.set(x, 10, z, skin);
  }
  // mejillas esponjosas a los costados
  for (const x of [-7, 6]) for (let y = 1; y <= 3; y++) for (let z = 0; z <= 2; z++) if (!(y === 3 && z === 0)) v.set(x, y, z, skin);
  paintFur(v, skin, f, 'head');
  const c = f.cream;
  // parte de abajo de la cara clarita + hocico
  const lowFace = type === 'zorrito' ? 3 : 2;
  for (let x = -5; x <= 4; x++) for (let y = 0; y <= lowFace; y++) if (Math.abs(x + 0.5) <= (type === 'zorrito' ? 5 : 3.5)) v.set(x, y, 4, c);
  if (type === 'zorrito') for (const x of [-7, 6]) for (let y = 1; y <= 3; y++) for (let z = 0; z <= 2; z++) if (v.has(x, y, z)) v.set(x, y, z, c);
  const muzzle = type === 'osito' ? [-3, 2, 0, 3] : type === 'zorrito' ? [-2, 1, 1, 3] : [-2, 1, 0, 2];
  for (let x = muzzle[0]; x <= muzzle[1]; x++) for (let y = muzzle[2]; y <= muzzle[3]; y++) {
    const corner = (x === muzzle[0] || x === muzzle[1]) && (y === muzzle[2] || y === muzzle[3]);
    if (!corner || type !== 'osito') v.set(x, y, 5, c);
  }
  if (type === 'zorrito') { v.set(-1, 3, 5, f.b); v.set(0, 3, 5, f.b); }
}

// Orejas: piezas que se mueven (como las colitas del pelo). Coordenadas de cabeza.
export function animalEars(type) {
  const ear = (build, at, sway) => [{ at: [-at[0], at[1], at[2]], build, sway, mirror: false }, { at, build, sway, mirror: true }];
  switch (type) {
    case 'gatito': return ear((v, f) => {
      const rows = [[-2, 1], [-2, 1], [-2, 0], [-1, 0], [-1, -1]];
      rows.forEach(([a, b], y) => { for (let x = a; x <= b; x++) for (let z = -1; z <= 0; z++) v.set(x, y, z, z === 0 && y < 3 && x > a && x < b ? f.pink : (y === 4 ? f.d : f.b)); });
    }, [4, 11, 0], 0.35);
    case 'zorrito': return ear((v, f) => {
      const tip = mix(f.b, INK, 0.62);
      const rows = [[-2, 2], [-2, 2], [-2, 1], [-1, 1], [-1, 0], [-1, 0]];
      rows.forEach(([a, b], y) => { for (let x = a; x <= b; x++) for (let z = -1; z <= 0; z++) v.set(x, y, z, y >= 4 ? tip : (z === 0 && y < 4 && x > a && x < b ? f.cream : f.b)); });
    }, [4, 11, 0], 0.35);
    case 'conejito': return ear((v, f) => {
      for (let y = 0; y <= 8; y++) {
        const w = y === 8 ? [-1, 0] : [-1, 1];
        for (let x = w[0]; x <= w[1]; x++) for (let z = -1; z <= 0; z++) v.set(x, y, z, z === 0 && x === 0 && y > 0 && y < 8 ? f.pink : (y > 6 ? f.l : f.b));
      }
    }, [3, 11, -1], 1.1);
    case 'osito': return ear((v, f) => {
      for (let x = -2; x <= 1; x++) for (let y = 0; y <= 2; y++) for (let z = -1; z <= 0; z++) {
        if (y === 2 && (x === -2 || x === 1)) continue;
        v.set(x, y, z, z === 0 && y < 2 && x > -2 && x < 1 ? f.cream : f.b);
      }
    }, [4, 10.5, -1], 0.2);
  }
  return [];
}

// Colas (en coordenadas del cuerpo, pivote en la cadera de atrás)
export function buildTail(v, type, f) {
  switch (type) {
    case 'gatito': {
      const path = [[0, 0, 0], [0, 0, -1], [0, 0, -2], [0, 1, -3], [0, 2, -4], [0, 3, -4], [0, 4, -5], [0, 5, -5], [0, 6, -5], [0, 7, -4]];
      path.forEach(([x, y, z], i) => { for (const dx of [-1, 0]) v.set(x + dx, y, z, i >= path.length - 2 ? f.d : ((i & 1) && f.pattern === 'rayas' ? f.d : f.b)); });
      break;
    }
    case 'zorrito':
      v.sphere(-0.5, 2.5, -3.5, 2.6, 3.6, 2.6, (x, y) => (y >= 5 ? 0xfff7fb : f.b));
      v.box(-1, 0, -1, 2, 1, 1, f.b);
      break;
    case 'conejito': v.sphere(-0.5, 0.5, -1.5, 2, 2, 1.6, () => f.cream); break;
    case 'osito': v.sphere(-0.5, 0.5, -1, 1.5, 1.5, 1.2, () => f.b); break;
  }
}
