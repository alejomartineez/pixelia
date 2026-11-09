// Set «Postres» (id 'postres'). Familia: cosas dulces de mesa, enteras y vistas un poco desde arriba (tres cuartos),
// apoyadas o sueltas, sin caras. Tonos: oro y brasa (masa, caramelo) con madera (chocolate, dulce); hueso (crema,
// plato) y coral de acento.
import { M } from '../lib.mjs';

export default {
  id: 'postres', name: 'Postres', light: '#ffe3d1',
  laminas: [
    ['hz-galleta', 'Galleta Robada', (g) => {
      // la galleta con un mordiscón arriba a la derecha (tres dientes)
      const galleta = M().ellipse(15, 16, 13.8, 13.6).cut
        .ellipse(24.5, 7, 5.4, 5.4).ellipse(29, 13.5, 4, 4).ellipse(18.5, 2.5, 4, 3.6);
      g.fill(galleta, 'Yyo', { tag: 'gal', shade: 2 });
      const chip = (x, y) => g.art(x, y, [' u ', 'uzz', ' zz']);
      chip(7, 8); chip(14, 5); chip(4, 16); chip(12, 13); chip(19, 12); chip(9, 21); chip(17, 19); chip(23, 18); chip(15, 25); chip(22, 24);
    }],
    ['hz-caramelo', 'Caramelo de Miel', (g) => {
      // los dos moños del papel, detrás, con pliegues
      g.poly([[18, 13], [21, 1], [30, 10]], 'coral', { tag: 'papel' });
      g.poly([[13, 18], [1, 21], [10, 30]], 'coral', { tag: 'papel' });
      g.line(19, 12, 24, 3, 'x', { in: 'papel' }); g.line(19, 12, 28, 7, 'x', { in: 'papel' });
      g.line(12, 19, 3, 24, 'x', { in: 'papel' }); g.line(12, 19, 7, 28, 'x', { in: 'papel' });
      // el caramelo: gordo y redondo
      g.fill(M().line(12.5, 18.5, 18.5, 12.5, 13), 'Yyo', { shade: 2, sep: 'x' });
      g.line(11, 15, 15, 11, 'w');
      g.line(13, 22, 22, 13, 'o');
    }],
    ['hz-dona', 'Dona Glaseada', (g) => {
      const hueco = M().ellipse(15.5, 15, 4.2, 2.6);
      g.fill(M().ellipse(15.5, 17, 14, 11).cut.mask(hueco), 'brasa', { shade: 2 });
      const glase = M().ellipse(15.5, 15, 12.6, 8.6)
        .ellipse(6, 20, 2, 2.6).ellipse(12, 22.5, 2.2, 2.4).ellipse(20.5, 22.5, 2, 2.6).ellipse(25.5, 19, 2, 2.2)
        .cut.mask(M().ellipse(15.5, 15, 5.6, 3.8));
      g.fill(glase, 'coral', { tag: 'glase' });
      g.fill(M().ellipse(15.5, 15.6, 4.2, 2.6).cut.ellipse(15.5, 16.6, 4.2, 2.6), 'f', { flat: true });
      // granas
      g.px('P', [9, 11], [10, 11]); g.px('Y', [20, 9], [21, 10]); g.px('b', [6, 15], [6, 16]); g.px('P', [23, 15], [24, 15]);
      g.px('Y', [11, 18], [12, 19]); g.px('b', [19, 19], [20, 19]); g.px('m', [14, 8], [15, 8]); g.px('m', [24, 11], [24, 12]);
    }],
    ['hz-tarta', 'Tarta de Manzana', (g) => {
      // en tres cuartos desde arriba: el costado repulgado y la tapa con el enrejado en diagonal
      g.fill(M().rect(2, 12, 28, 9).ellipse(15.5, 21, 13.8, 6.4), 'oro', { tag: 'lado', shade: 2 });
      for (let x = 4; x <= 27; x += 3) g.line(x, 17, x, 26, 'o', { in: 'lado' });
      g.ellipse(15.5, 12, 13.8, 8.6, 'oro', { tag: 'borde', sep: 'o' });
      g.ellipse(15.5, 11.6, 11, 6.2, 'eef', { tag: 'relleno', lite: 0 });
      for (const d of [-8, 0, 8]) g.line(15.5 + d - 5, 19, 15.5 + d + 5, 4, 'Yyo', { w: 2, in: 'relleno' });
      for (const d of [-8, 0, 8]) g.line(15.5 + d + 5, 19, 15.5 + d - 5, 4, 'Yyo', { w: 2, in: 'relleno', sep: 'f' });
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.px('o', [Math.round(15.5 + Math.cos(a) * 12.6), Math.round(12 + Math.sin(a) * 7.5)]); }
    }],
    ['hz-flan', 'Flan con Dulce de Leche', (g) => {
      g.ellipse(15.5, 26, 14, 4, 'hueso', { shade: 2 });                         // el plato
      g.fill(M().poly([[8, 9], [23, 9], [26, 25], [5, 25]]).ellipse(15.5, 25, 10.6, 2.6).ellipse(15.5, 9, 7.6, 2.4),
        'Yyo', { tag: 'flan', lite: 2, sep: 'q' });
      g.ellipse(15.5, 9, 7.6, 2.4, 'Ouz', { in: 'flan' });                      // caramelo arriba
      for (const [x, h] of [[9, 5], [12, 8], [17, 4], [21, 7]]) g.rect(x, 10, 2, h, 'u', { in: 'flan' });
      // la cucharada de dulce de leche, encima
      g.fill(M().ellipse(15.5, 7, 5, 2.2).ellipse(14.5, 5.4, 2.8, 1.6), 'OOu', { sep: 'z' });
      g.px('w', [13, 5]);
    }],
    ['hz-helado', 'Helado de Tres Gustos', (g) => {
      g.poly([[7, 18], [25, 18], [16.5, 30], [15.5, 30]], 'oro', { tag: 'cono' });
      for (let i = 0; i < 5; i++) { g.line(7 + i * 4, 18, 16 + i * 2, 30, 'o', { in: 'cono' }); g.line(25 - i * 4, 18, 16 - i * 2, 30, 'o', { in: 'cono' }); }
      g.ellipse(11.5, 15.5, 5.6, 5.4, 'madera', { sep: true, hi: [[9, 12]] });
      g.ellipse(20.5, 15.5, 5.6, 5.4, 'menta', { sep: true, hi: [[18, 12]] });
      g.ellipse(16, 8, 6, 5.8, 'coral', { sep: true, shade: 2, hi: [[13, 4], [12, 5]] });
    }],
    ['hz-medialuna', 'Medialuna de Manteca', (g) => {
      // hecha de rollos: de las puntas al centro, cada uno delante del anterior
      for (const [x, y, rx, ry] of [[3, 25, 1.8, 2.2], [5, 20, 3.2, 3.4], [9.6, 14.6, 4.2, 4.4]]) {
        g.ellipse(x, y, rx, ry, 'Eef', { sep: 'f' }); g.ellipse(31 - x, y, rx, ry, 'Eef', { sep: 'f' });
      }
      g.ellipse(15.5, 12.4, 5.4, 5.4, 'Eef', { sep: 'f', shade: 2, hi: [[13, 9], [12, 10]] });
      g.px('w', [8, 12], [4, 18]);
    }],
    ['hz-chocolate', 'Chocolate Amargo', (g) => {
      // la tableta, con una esquina comida
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
        if (i === 2 && j === 0) continue;
        g.rect(8 + i * 5, 2 + j * 5, 5, 5, 'Ouz', { tag: 'choc' });
      }
      g.poly([[18, 4], [21, 3], [22, 6], [18, 6]], 'Ouz');
      g.rect(7, 15, 18, 2, 'piedra');                                         // papel plateado
      g.rect(6, 16, 20, 14, 'coral', { tag: 'envol', shade: 2, sep: true });  // el envoltorio
      g.rect(6, 21, 20, 4, 'oro', { in: 'envol' });
    }],
    ['hz-torta', 'Torta de Cumpleaños', (g) => {
      g.ellipse(15.5, 27, 14.4, 3.4, 'hueso', { shade: 2 });                     // el plato
      g.fill(M().rect(4, 13, 24, 12).ellipse(15.5, 24.5, 12, 3).ellipse(15.5, 13, 12, 3.6), 'brasa', { tag: 'torta', sep: 'q', shade: 2 });
      g.rect(4, 19, 24, 2, 'P', { in: 'torta' });
      g.fill(M().ellipse(15.5, 13, 12, 3.6).ellipse(7, 16, 1.6, 2).ellipse(12, 17, 1.6, 2.4).ellipse(19, 16.5, 1.6, 2).ellipse(24, 17, 1.6, 2.2), 'coral', { in: 'torta' });
      for (const x of [10, 15, 20]) {
        g.rect(x, 7, 2, 6, 'indigo', { sep: true });
        g.fill(M().ellipse(x + 0.5, 3.4, 1.6, 2.2), 'Yye'); g.px('k', [x, 6]);
      }
    }],
  ],
};
