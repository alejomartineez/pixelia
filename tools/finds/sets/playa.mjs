// Set «Costa» (id 'playa'). Familia: cosas y bichos de la orilla, enteros, de costado y apoyados, sin fondo de paisaje.
// Tonos: cielo (agua) y oro (arena) dominantes, coral de acento; hueso para espuma y panzas, con sombra adentro.
import { M } from '../lib.mjs';

const PIEL = 'EEe';

export default {
  id: 'playa', name: 'Costa', light: '#fff1de',
  laminas: [
    ['hz-caracol', 'Caracol Chismoso', (g) => {
      // el cuerpo, largo, con la cabeza levantada a la derecha
      const cuerpo = M().poly([[3, 27], [6, 23], [20, 23], [23, 19], [25, 15], [28, 15], [29, 19], [28, 24], [25, 28], [4, 29]]);
      g.fill(cuerpo, 'piedra', { tag: 'cuerpo' });
      g.line(4, 28, 24, 28, 'h', { in: 'cuerpo' });
      // los cuernos con los ojos, abiertos para escuchar
      g.line(25, 15, 23, 7, 'g', { w: 2 }); g.line(28, 15, 29, 8, 'g', { w: 2 });
      g.ellipse(23, 6, 1.6, 1.6, 'piedra'); g.ellipse(29, 7, 1.6, 1.6, 'piedra');
      g.px('k', [23, 6], [29, 7]);
      // la caracola, con la espiral
      g.ellipse(13, 15, 9.5, 9, 'oro', { tag: 'casa', shade: 2, sep: true });
      g.curve([[13, 15], [15, 14], [15, 17], [12, 18], [10, 15], [12, 11], [16, 11], [19, 14], [19, 19], [15, 22], [9, 21], [6, 17]], 'brasa', { in: 'casa', w: 2 });
      g.px('w', [8, 9], [9, 8]);
    }],
    ['hz-cangrejo', 'Cangrejo de Costado', (g) => {
      // patas, tres por lado, detrás
      for (const [x0, y0, x1, y1, x2, y2] of [[9, 20, 4, 21, 2, 25], [10, 22, 6, 25, 5, 28], [12, 23, 10, 26, 9, 29]]) {
        g.curve([[x0, y0], [x1, y1], [x2, y2]], 'x', { w: 2 });
        g.curve([[31 - x0, y0], [31 - x1, y1], [31 - x2, y2]], 'x', { w: 2 });
      }
      // brazos y pinzas levantadas
      g.line(10, 17, 6, 11, 'r', { w: 2 }); g.line(21, 17, 25, 11, 'r', { w: 2 });
      const pinza = (cx, s) => M().ellipse(cx, 8, 4, 4.5).cut.poly([[cx + s * 0, 7], [cx + s * 1.5, 2], [cx + s * 5, 3]]);
      g.fill(pinza(6, 1), 'coral', { shade: 2 }); g.fill(pinza(25, -1), 'coral', { shade: 2 });
      // caparazón
      g.ellipse(15.5, 19, 9.5, 6, 'coral', { shade: 2, tag: 'capa', sep: true });
      g.px('R', [11, 16], [12, 16]); g.px('x', [13, 22], [16, 23], [19, 22]);
      // ojos en palitos
      g.line(13, 13, 13, 11, 'x'); g.line(18, 13, 18, 11, 'x');
      g.px('k', [13, 10], [18, 10]);
      g.px('w', [10, 16]);
    }],
    ['hz-ojotas', 'Ojotas Perdidas', (g) => {
      const suela = (cx, cy) => M().ellipse(cx, cy - 6, 5.5, 6.5).ellipse(cx + 0.5, cy + 6, 4.5, 7).rect(cx - 4, cy - 6, 9, 12);
      const tira = (cx, cy) => { g.line(cx, cy - 9, cx - 4, cy - 2, 'coral', { w: 2 }); g.line(cx, cy - 9, cx + 4, cy - 2, 'coral', { w: 2 }); g.ellipse(cx, cy - 9.5, 1.4, 1.4, 'r'); };
      g.fill(suela(9, 14), 'cielo', { shade: 2 });
      tira(9, 14);
      g.fill(suela(22, 17), 'cielo', { shade: 2, sep: true });
      tira(22, 17);
    }],
    ['hz-ancla-oxidada', 'Ancla Oxidada', (g) => {
      const ancla = M().ring(16, 14, 12.5, 14, 3).cut.rect(0, 0, 32, 17).add
        .ring(16, 4.5, 3.4, 3.4, 1.6).rect(15, 7, 3, 21)
        .poly([[2, 13], [7, 19], [7, 15], [4, 16]]).poly([[30, 13], [25, 19], [25, 15], [28, 16]]);
      g.fill(ancla, 'piedra', { tag: 'ancla' });
      g.rect(9, 9, 15, 3, 'piedra', { r: 1, sep: true });
      // óxido
      g.rect(15, 15, 3, 3, 'e', { in: 'ancla' }); g.rect(16, 18, 2, 2, 'f', { in: 'ancla' });
      g.rect(6, 23, 3, 2, 'e', { in: 'ancla' }); g.rect(24, 25, 3, 2, 'e', { in: 'ancla' }); g.rect(18, 10, 3, 2, 'e', { on: true });
    }],
    ['hz-sandia', 'Sandía Fresca', (g) => {
      const tajada = (d) => M().poly([[2 + d, 9 + d], [30 - d, 9 + d], [16, 29]]).ellipse(16, 9 + d, 14 - d, 5 - d * 0.6);
      g.fill(tajada(0), 'hoja', { tag: 'sandia' });
      g.fill(tajada(2), 'P', { in: 'sandia', flat: true, tag: 'sandia' });
      g.fill(tajada(3), 'coral', { in: 'sandia', shade: 2, tag: 'pulpa' });
      for (const [x, y] of [[10, 12], [16, 11], [22, 12], [13, 16], [19, 16], [16, 21]]) g.px('K', [x, y], [x, y + 1]);
      g.px('w', [8, 11], [9, 11]);
    }],
    ['hz-delfin', 'Delfín de la Bahía', (g) => {
      g.poly([[8, 21], [2, 17], [4, 22], [2, 28], [9, 24]], 'cielo');                       // la cola
      g.poly([[14, 11], [17, 4], [19, 5], [20, 10]], 'cielo');                              // la aleta de arriba
      const cuerpo = M().poly([[6, 21], [9, 15], [14, 11], [20, 10], [25, 12], [30, 15], [29, 17], [25, 17], [19, 18], [13, 20], [9, 23], [7, 24]]);
      g.fill(cuerpo, 'cielo', { tag: 'delfin', sep: true });
      g.fill(M().poly([[12, 19], [18, 16], [25, 16], [29, 16], [25, 18], [19, 19], [13, 21]]), 'P', { in: 'delfin', shade: 0 });
      g.poly([[18, 17], [15, 23], [21, 18]], 'd', { sep: true });                            // la aleta del costado
      g.px('k', [24, 13]); g.line(26, 16, 29, 16, 'd');
      g.px('w', [12, 13], [13, 12]);
    }],
    ['hz-surfista', 'Surfista Valiente', (g) => {
      // la tabla, parada detrás
      g.fill(M().ellipse(24, 15, 5, 14.5), 'oro', { tag: 'tabla', shade: 2 });
      g.rect(23, 1, 2, 29, 'r', { in: 'tabla' });
      g.px('w', [21, 5], [21, 6]);
      // el surfista, de busto, con el traje
      const cx = 11, cy = 14;
      g.fill(M().ellipse(cx, 31, 10, 8.5).cut.rect(0, 31, 32, 1).rect(0, 0, 1, 32), 'indigo', { tag: 'shirt', sep: true });
      g.rect(cx - 1, cy + 7, 3, 3, 'e', { flat: true });
      g.rect(cx - 6, cy - 7, 13, 15, PIEL, { r: 4, sep: true });
      g.px('k', [cx - 3, cy + 1], [cx - 3, cy + 2], [cx + 3, cy + 1], [cx + 3, cy + 2]);
      g.px('R', [cx - 4, cy + 4], [cx + 4, cy + 4]);
      g.px('f', [cx - 1, cy + 5], [cx, cy + 5], [cx + 1, cy + 5]);
      // pelo mojado, revuelto
      g.fill(M().ellipse(cx, cy - 4, 7.4, 5).cut.rect(0, cy - 3, 32, 20).add.rect(cx - 7, cy - 4, 2, 4).rect(cx + 6, cy - 4, 2, 3), 'oro', { sep: true });
      g.px('o', [cx - 2, cy - 4], [cx + 1, cy - 4], [cx + 4, cy - 4]);
      g.line(cx - 4, 24, cx - 4, 30, 'B', { in: 'shirt' });
    }],
    ['hz-pulpo', 'Pulpo de las Rocas', (g) => {
      // la roca abajo
      g.ellipse(16, 26.5, 13, 3.6, 'piedra', { shade: 2 });
      // tentáculos que se enrulan sobre la roca
      const ten = [[[12, 16], [8, 20], [4, 22], [3, 19]], [[14, 17], [12, 23], [9, 26], [7, 24]], [[16, 18], [16, 23], [15, 27]], [[18, 17], [20, 23], [23, 26], [25, 24]], [[20, 16], [24, 20], [28, 22], [29, 19]]];
      for (const t of ten) g.curve(t, 'violeta', { w: 3, sep: true });
      // la cabeza, alta
      g.fill(M().ellipse(16, 9, 7, 8), 'violeta', { shade: 2, tag: 'cab' });
      g.px('V', [13, 4], [12, 5]);
      g.rect(11, 12, 2, 2, 'P'); g.rect(19, 12, 2, 2, 'P'); g.px('k', [12, 13], [20, 13]);
      g.px('w', [12, 4]);
    }],
    ['hz-isla', 'Isla Secreta', (g) => {
      g.ellipse(16, 25, 14.5, 4.5, 'cielo', { tag: 'mar' });
      g.curve([[5, 25], [9, 24]], 'S', { in: 'mar' }); g.curve([[22, 27], [27, 26]], 'S', { in: 'mar' });
      g.fill(M().ellipse(15, 24, 10, 4.5).cut.rect(0, 25, 32, 7), 'oro', { shade: 2 });
      // la palmera
      g.curve([[13, 22], [12, 16], [14, 11], [17, 8]], 'madera', { w: 2 });
      g.curve([[17, 8], [12, 5], [7, 6], [4, 10]], 'hoja', { w: 2 });
      g.curve([[17, 8], [14, 3], [10, 2]], 'hoja', { w: 2 });
      g.curve([[17, 8], [21, 4], [26, 4]], 'hoja', { w: 2 });
      g.curve([[17, 8], [23, 8], [27, 12]], 'hoja', { w: 2 });
      g.ellipse(17, 9.5, 1.5, 1.5, 'u');
      // el cofre, medio enterrado
      g.rect(19, 18, 7, 5, 'madera', { r: 1, sep: true }); g.rect(19, 19, 7, 1, 'o'); g.px('Y', [22, 20]);
    }],
  ],
};
