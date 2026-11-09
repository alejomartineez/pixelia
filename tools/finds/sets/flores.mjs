// Set «Flores» (id 'flores'). Familia: cada flor entera y parada, con su tallo y sus hojas en verde hoja; la forma de
// la corola dice cuál es (rayos, copa, espiral, cinco pétalos, ramita, ramo). Tonos: hoja de base común, coral y oro
// de acento, hueso para lo blanco. Encuadre vertical, de la flor al pie del tallo.
import { M } from '../lib.mjs';

const rad = (d) => d * Math.PI / 180;
/** Gira una lista de puntos alrededor de (cx, cy), en grados (positivo = horario). */
const rot = (pts, cx, cy, deg) => pts.map(([x, y]) => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)), dx = x - cx, dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
});
/** Hoja en punta: de la base (x0, y0) a la punta (x1, y1), ancho w en el medio. */
function leafPts(x0, y0, x1, y1, w) {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, len = Math.hypot(x1 - x0, y1 - y0);
  const nx = -(y1 - y0) / len * w / 2, ny = (x1 - x0) / len * w / 2;
  return [[x0, y0], [mx + nx, my + ny], [x1, y1], [mx - nx, my - ny]];
}

export default {
  id: 'flores', name: 'Flores', light: '#e3f7d2',
  laminas: [
    ['hz-margarita', 'Margarita Me Quiere', (g) => {
      const cx = 15, cy = 11;
      g.curve([[15, 16], [16, 23], [18, 29]], 'hoja', { w: 2 });
      g.poly(leafPts(17, 24, 25, 19, 5), 'hoja', { sep: true });
      // los pétalos, con dos que ya se fueron abajo a la derecha
      const pet = M();
      for (let i = 0; i < 14; i++) {
        if (i === 2 || i === 3) continue;
        const a = rad(i * 360 / 14);
        pet.line(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3, cx + Math.cos(a) * 9, cy + Math.sin(a) * 8.6, 3);
      }
      g.fill(pet, 'hueso', { tag: 'pet' });
      g.ellipse(cx, cy, 3.4, 3.4, 'oro', { sep: 'q', hi: [[cx - 1, cy - 2]] });
      // el pétalo que cae
      g.line(25, 26, 28, 24, 'hueso', { w: 2 });
    }],
    ['hz-brote', 'Brote Valiente', (g) => {
      // dos baldosas con la rajadura en el medio
      g.rect(2, 21, 13, 9, 'piedra', { r: 1 });
      g.rect(17, 21, 13, 9, 'piedra', { r: 1 });
      g.rect(15, 23, 2, 7, 'z');
      g.curve([[16, 25], [15, 17], [16, 10], [17, 7]], 'hoja', { w: 2, sep: true });
      g.poly([[15, 13], [10, 8], [4, 8], [6, 12], [11, 14]], 'hoja', { sep: true });
      g.poly([[17, 11], [21, 5], [28, 4], [26, 9], [21, 12]], 'hoja', { sep: true });
      g.curve([[11, 12], [7, 10]], 'v'); g.curve([[21, 10], [26, 6]], 'v');
    }],
    ['hz-trebol', 'Trébol (de Tres, Igual)', (g) => {
      const cx = 16, cy = 12, hoja = M(), cortes = M();
      for (const deg of [-90, 30, 150]) {
        const a = rad(deg), ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
        const ex = cx + ux * 7, ey = cy + uy * 7;
        hoja.ellipse(ex + px * 2.6 + ux, ey + py * 2.6 + uy, 3.9, 3.9).ellipse(ex - px * 2.6 + ux, ey - py * 2.6 + uy, 3.9, 3.9)
          .poly([[cx + ux * 2, cy + uy * 2], [ex + px * 5.8, ey + py * 5.8], [ex - px * 5.8, ey - py * 5.8]]);
        // la muesca de punta y el corte que la separa de la vecina
        cortes.poly([[ex + ux * 2, ey + uy * 2], [ex + ux * 6 + px * 2, ey + uy * 6 + py * 2], [ex + ux * 6 - px * 2, ey + uy * 6 - py * 2]]);
        const b = rad(deg + 60);
        cortes.line(cx + Math.cos(b) * 2, cy + Math.sin(b) * 2, cx + Math.cos(b) * 14, cy + Math.sin(b) * 14, 2);
      }
      g.curve([[16, 13], [17, 22], [20, 29]], 'hoja', { w: 2 });
      g.fill(hoja.cut.mask(cortes), 'hoja', { tag: 'hoja' });
      // la marca clara en V de cada hoja
      for (const deg of [-90, 30, 150]) {
        const a = rad(deg), ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux, ex = cx + ux * 6, ey = cy + uy * 6;
        g.line(ex + px * 3 + ux, ey + py * 3 + uy, ex - ux * 0.5, ey - uy * 0.5, 'L', { in: 'hoja' });
        g.line(ex - px * 3 + ux, ey - py * 3 + uy, ex - ux * 0.5, ey - uy * 0.5, 'L', { in: 'hoja' });
      }
      g.ellipse(cx, cy, 1.5, 1.5, 'v', { flat: true });
      g.ellipse(22.5, 15.5, 1.6, 2, 'cielo', { in: 'hoja', hi: [[22, 15]] });   // una gota de rocío
    }],
    ['hz-tulipan', 'Tulipán Tímido', (g) => {
      // el tallo se inclina y la flor mira para abajo
      g.curve([[16, 29], [16, 22], [18, 15], [20, 12]], 'hoja', { w: 2 });
      g.poly(leafPts(15, 30, 7, 13, 6), 'hoja', { sep: true });
      g.poly(leafPts(17, 30, 25, 19, 5), 'hoja', { sep: true });
      const c = [20, 10], tilt = 25;
      const cup = M().poly(rot([[13, 10], [13, 4], [16, 7], [20, 2], [24, 7], [27, 4], [27, 10], [26, 14], [22, 17], [18, 17], [14, 14]], 20, 10, tilt));
      g.fill(cup, 'coral', { tag: 'cup', shade: 2, sep: true });
      g.curve(rot([[20, 3], [21, 9], [20, 16]], c[0], c[1], tilt), 'x', { in: 'cup' });
    }],
    ['hz-girasol', 'Girasol Chusma', (g) => {
      g.line(16, 18, 16, 29, 'hoja', { w: 3 });
      g.poly(leafPts(16, 25, 5, 20, 7), 'hoja', { sep: true });
      g.poly(leafPts(16, 22, 27, 18, 7), 'hoja', { sep: true });
      const cx = 16, cy = 11, pet = M();
      for (let i = 0; i < 16; i++) {
        const a = rad(i * 360 / 16 + 11);
        pet.line(cx + Math.cos(a) * 5, cy + Math.sin(a) * 4.2, cx + Math.cos(a) * 12, cy + Math.sin(a) * 8.6, 3);
      }
      g.fill(pet, 'oro', { tag: 'pet', sep: true });
      // la cara (el disco) corrida a la derecha: está mirando al costado
      g.ellipse(18, 11, 5.5, 5, 'madera', { tag: 'disco', sep: 'o', shade: 2 });
      for (let y = 8; y <= 14; y += 2) for (let x = 15; x <= 21; x += 2) g.px('z', [x + (y % 4 === 2 ? 1 : 0), y]);
      g.fill(M().ellipse(18, 11, 5.5, 5).cut.ellipse(18, 11, 4.5, 4), 'u', { in: 'disco' });
    }],
    ['hz-rosa', 'Rosa con Carácter', (g) => {
      g.line(16, 17, 15, 29, 'hoja', { w: 2 });
      g.px('v', [17, 21], [14, 24], [17, 27]);
      g.poly(leafPts(15, 24, 5, 21, 6), 'hoja', { sep: true });
      g.poly(leafPts(16, 21, 26, 22, 6), 'hoja', { sep: true });
      // la flor: copa redonda, pétalos de afuera abiertos y espiral en el centro
      g.fill(M().ellipse(16, 10, 8.5, 7.5).poly([[6, 6], [9, 3], [12, 6]]).poly([[20, 6], [23, 3], [26, 6]]), 'coral', { tag: 'rosa', shade: 2 });
      g.curve([[16, 9], [18, 8], [18, 6], [15, 5], [12, 7], [12, 11], [16, 14], [21, 12], [22, 8]], 'x', { in: 'rosa' });
      g.curve([[9, 9], [10, 14], [16, 17]], 'x', { in: 'rosa' });
      g.poly([[11, 16], [16, 19], [21, 16], [16, 17]], 'hoja');
    }],
    ['hz-hibisco', 'Hibisco Fiestero', (g) => {
      g.poly(leafPts(10, 22, 2, 29, 7), 'hoja');
      g.poly(leafPts(22, 22, 29, 28, 6), 'hoja');
      const cx = 15, cy = 14, flor = M(), cortes = M();
      for (let i = 0; i < 5; i++) {
        const a = rad(i * 72 - 54), b = rad(i * 72 - 18);
        flor.ellipse(cx + Math.cos(a) * 7.5, cy + Math.sin(a) * 7.5, 5.8, 5.8);
        cortes.line(cx + Math.cos(b) * 4, cy + Math.sin(b) * 4, cx + Math.cos(b) * 15, cy + Math.sin(b) * 15, 1);
      }
      g.fill(flor.cut.mask(cortes), 'violeta', { tag: 'p', shade: 2 });
      for (let i = 0; i < 5; i++) {
        const a = rad(i * 72 - 54);
        g.line(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3, cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 'j', { in: 'p' });
      }
      g.ellipse(cx, cy, 4, 4, 'j', { flat: true });
      // el estambre largo, con el polen en la punta
      g.line(cx, cy, 25, 4, 'P', { w: 2 });
      g.px('y', [25, 2], [27, 3], [26, 5], [24, 3], [27, 5]); g.px('Y', [26, 3], [25, 4]);
    }],
    ['hz-cerezo', 'Cerezo en Flor', (g) => {
      g.fill(M().line(2, 28, 28, 6, 3).line(15, 18, 12, 6, 2).line(22, 12, 28, 14, 2), 'madera');
      const flor = (x, y) => {
        const m = M();
        for (let i = 0; i < 5; i++) { const a = rad(i * 72 - 90); m.ellipse(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2, 2); }
        g.fill(m, 'PRr', { sep: true });
        g.px('y', [x, y]); g.px('r', [x - 1, y], [x + 1, y], [x, y - 1]);
      };
      flor(11, 6); flor(7, 22); flor(19, 15); flor(26, 6); flor(26, 19);
      g.ellipse(4, 15, 1.6, 1.6, 'Rrx'); g.ellipse(22, 25, 1.6, 1.6, 'Rrx');
    }],
    ['hz-ramo', 'Ramo para Vos', (g) => {
      g.poly(leafPts(10, 16, 3, 9, 4), 'hoja'); g.poly(leafPts(22, 16, 29, 9, 4), 'hoja');
      g.ellipse(9, 10, 4.5, 4.5, 'coral', { sep: true, tag: 'a' });
      g.curve([[9, 10], [10, 9], [9, 8], [7, 9], [7, 11], [9, 12], [11, 11]], 'x', { in: 'a' });
      g.ellipse(23, 10, 4.5, 4.5, 'violeta', { sep: true, tag: 'b' });
      g.ellipse(23, 10, 1.5, 1.5, 'j', { flat: true, in: 'b' });
      g.ellipse(16, 7, 5, 5, 'oro', { sep: true, tag: 'c' });
      g.ring(16, 7, 2.5, 2.5, 1, 'o', { in: 'c' }); g.px('u', [16, 7]);
      // el papel, en cono, y la cinta
      g.poly([[5, 14], [27, 14], [18, 30], [14, 30]], 'hueso', { tag: 'papel', sep: true, shade: 2 });
      g.line(16, 15, 16, 29, 'q', { in: 'papel' });
      g.rect(10, 22, 12, 2, 'coral', { in: 'papel' });
      g.poly([[16, 23], [11, 20], [11, 26]], 'coral', { sep: true }); g.poly([[16, 23], [21, 20], [21, 26]], 'coral', { sep: true });
      g.rect(15, 22, 2, 2, 'x');
    }],
  ],
};
