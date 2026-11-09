// Set «Ropa de Viaje» (id 'vestidos'). Familia: ropa y cosas de viajar, enteras y de frente o de costado, como
// apoyadas sobre la mesa antes de armar la valija. Tonos: índigo y coral en las telas, madera en el cuero; hueso y
// oro de acento (costuras, hebillas, herrajes).
import { M } from '../lib.mjs';

export default {
  id: 'vestidos', name: 'Ropa de Viaje', light: '#f8f0e4',
  laminas: [
    ['hz-medias', 'Medias Desparejas', (g) => {
      // la de atrás: coral con talón y punta en hueso
      const b = M().rect(17, 3, 8, 19).rect(17, 17, 10, 9, 3).ellipse(26, 22.5, 3.5, 3.5);
      g.fill(b, 'coral', { tag: 'b', shade: 2 });
      g.rect(17, 3, 8, 4, 'Ppq', { in: 'b' });
      g.rect(25, 18, 6, 9, 'Ppq', { in: 'b' });
      g.rect(17, 22, 3, 4, 'Ppq', { in: 'b' });
      // la de adelante: índigo a rayas
      const a = M().rect(4, 4, 8, 19).rect(4, 19, 11, 9, 3).ellipse(14, 24.5, 3.5, 3.5);
      g.fill(a, 'indigo', { tag: 'a', shade: 2, sep: true });
      g.rect(4, 4, 8, 4, 'Ppq', { in: 'a' });
      for (const y of [10, 14, 18]) g.rect(4, y, 8, 2, 'Rrx', { in: 'a', flat: true });
      g.px('k', [5, 6], [7, 6], [9, 6], [11, 6]);
    }],
    ['hz-guantes', 'Guantes de Cuero', (g) => {
      const glove = (dx, dy) => M()
        .rect(8 + dx, 12 + dy, 11, 11, 2)
        .rect(8 + dx, 4 + dy, 2, 10, 1).rect(11 + dx, 2 + dy, 2, 12, 1).rect(14 + dx, 3 + dy, 2, 11, 1).rect(17 + dx, 6 + dy, 2, 8, 1)
        .line(9 + dx, 18 + dy, 4 + dx, 12 + dy, 3);
      // el de atrás, corrido a la derecha
      g.fill(glove(9, 2), 'Ouz', { tag: 'b' });
      g.rect(17, 25, 13, 5, 'z', { flat: true });
      // el de adelante
      g.fill(glove(0, 0), 'brasa', { sep: true, tag: 'a' });
      g.px('k', [10, 5], [10, 6], [10, 7], [10, 8], [10, 9], [10, 10], [10, 11], [13, 4], [13, 5], [13, 6], [13, 7], [13, 8], [13, 9], [13, 10], [13, 11], [16, 6], [16, 7], [16, 8], [16, 9], [16, 10], [16, 11]);
      g.rect(7, 23, 13, 6, 'Ouz', { sep: true });
      g.rect(7, 25, 13, 1, 'z'); g.px('Y', [18, 26]);
      g.line(10, 14, 16, 14, 'f'); g.line(10, 17, 16, 17, 'f');
    }],
    ['hz-capelina', 'Capelina de Verano', (g) => {
      g.ellipse(16, 18, 14.5, 8.5, 'oro', { shade: 2, tag: 'ala' });
      g.ellipse(16, 19, 9, 3.6, 'o', { in: 'ala', flat: true });
      g.fill(M().ellipse(16, 15, 8, 8).cut.rect(0, 18, 32, 14), 'oro', { sep: true, tag: 'copa' });
      g.rect(8, 14, 16, 3, 'indigo', { in: 'copa' });
      // moño al costado, con las cintas que caen sobre el ala
      g.line(23, 17, 26, 27, 'indigo', { w: 2 }); g.line(21, 17, 21, 28, 'indigo', { w: 2 });
      g.ellipse(22, 15.5, 2.5, 2.5, 'Bba', { sep: true });
      g.px('a', [22, 16]);
      g.px('w', [12, 9], [11, 10]);
    }],
    ['hz-bufanda', 'Bufanda Tejida', (g) => {
      // enrollada en un rollo flojo, acostado, y una punta con flecos que cae por delante
      g.rect(3, 5, 21, 14, 'coral', { r: 3, tag: 'rollo', shade: 2 });
      for (const x of [7, 13, 19]) g.rect(x, 5, 2, 14, 'Ppq', { in: 'rollo' });
      g.ellipse(23.5, 12, 5, 7, 'coral', { tag: 'boca', sep: 'x' });                    // la punta del rollo, con la espiral
      g.ring(23.5, 12, 3.6, 5.2, 1, 'x', { in: 'boca' });
      g.ring(23.5, 12, 1.8, 2.8, 1, 'x', { in: 'boca' });
      g.fill(M().poly([[8, 16], [15, 16], [16, 26], [9, 26]]), 'coral', { tag: 'punta', sep: true });
      for (const y of [19, 23]) g.rect(1, y, 30, 2, 'Ppq', { in: 'punta' });
      for (const x of [9, 11, 13, 15]) g.line(x, 27, x, 30, 'P', { sep: 'q' });
    }],
    ['hz-monedero', 'Monedero Gastado', (g) => {
      const body = M().poly([[6, 11], [26, 11], [29, 22], [26, 28], [6, 28], [3, 22]]).ellipse(16, 21, 13, 8).cut.rect(0, 0, 32, 11);
      g.fill(body, 'madera', { shade: 2, tag: 'cuero' });
      g.fill(M().ellipse(11, 23, 4, 3), 'O', { in: 'cuero', flat: true });           // gastado
      g.fill(M().curve([[6, 26], [16, 27], [26, 26]], 1), 'z', { in: 'cuero' });       // costura
      // el herraje de arriba
      g.fill(M().curve([[5, 12], [10, 9], [16, 8.5], [22, 9], [27, 12]], 3), 'oro', { sep: true });
      // el cierre de bolitas cruzadas
      g.rect(14, 5, 1, 4, 'o'); g.rect(17, 5, 1, 4, 'o');
      g.ellipse(13.5, 4, 2, 2, 'oro', { sep: true }); g.ellipse(18.5, 4, 2, 2, 'oro', { sep: true });
      g.px('w', [12, 3], [17, 3]);
    }],
    ['hz-vestido', 'Vestido de Domingo', (g) => {
      // el vestido
      const v = M().poly([[9, 7], [13, 6], [16, 9], [19, 6], [23, 7], [23, 12], [21, 17], [21, 18], [28, 29], [4, 29], [11, 18], [11, 17], [9, 12]]);
      g.fill(v, 'cielo', { tag: 'v', shade: 2 });
      g.fill(M().ellipse(13.5, 8.5, 3, 2.2).ellipse(18.5, 8.5, 3, 2.2), 'hueso', { in: 'v', sep: 'q' });   // cuello
      g.rect(10, 17, 12, 2, 'indigo', { in: 'v' });                                        // cinto
      g.curve([[16, 19], [16, 24], [16, 29]], 'd', { in: 'v' });
      g.curve([[13, 19], [11, 24], [9, 29]], 'd', { in: 'v' }); g.curve([[19, 19], [21, 24], [23, 29]], 'd', { in: 'v' });
      g.px('P', [16, 12], [16, 15]);
      // percha de madera, por delante de los hombros
      g.curve([[5, 9], [10, 6.5], [16, 5.5], [22, 6.5], [27, 9]], 'madera', { w: 2, sep: true });
      g.curve([[16, 5], [16, 3], [17.5, 1.5], [19, 2.5]], 'piedra');
    }],
    ['hz-tapado', 'Tapado Heredado', (g) => {
      const c = M().poly([[11, 3], [21, 3], [27, 6], [30, 25], [27, 26], [25, 14], [25, 30], [7, 30], [7, 14], [5, 26], [2, 25], [5, 6]]);
      g.fill(c, 'madera', { tag: 'c', shade: 2 });
      // mangas separadas del cuerpo
      g.line(7, 14, 6, 25, 'z', { in: 'c' }); g.line(25, 14, 26, 25, 'z', { in: 'c' });
      // solapas y cuello
      g.poly([[11, 3], [16, 12], [14, 16], [9, 7]], 'Ouz', { sep: true });
      g.poly([[21, 3], [16, 12], [18, 16], [23, 7]], 'Ouz', { sep: true });
      g.line(16, 12, 16, 30, 'z');
      g.px('K', [15, 4], [16, 4], [17, 4], [14, 4], [18, 4], [15, 5], [16, 5], [17, 5], [16, 6]);
      // botones dobles y bolsillos
      for (const y of [17, 21, 25]) g.px('y', [14, y], [19, y]);
      g.rect(9, 22, 4, 1, 'z'); g.rect(20, 22, 4, 1, 'z');
      g.rect(2, 24, 3, 2, 'z'); g.rect(27, 24, 3, 2, 'z');
    }],
    ['hz-botas', 'Botas de Caminata', (g) => {
      const boot = (dx, dy) => M().rect(5 + dx, 4 + dy, 9, 16, 1).poly([[5 + dx, 14 + dy], [14 + dx, 14 + dy], [22 + dx, 17 + dy], [24 + dx, 20 + dy], [24 + dx, 22 + dy], [5 + dx, 22 + dy]]);
      // la de atrás
      g.fill(boot(5, 2), 'Ouz', { tag: 'b' });
      g.rect(9, 24, 21, 3, 'h', { flat: true });
      // la de adelante
      g.fill(boot(0, 4), 'brasa', { tag: 'a', shade: 2, sep: true });
      g.rect(5, 8, 9, 2, 'Ouz', { in: 'a' });                                         // collarín
      g.rect(4, 26, 22, 3, 'piedra', { sep: true });                                  // suela
      g.px('h', [6, 28], [9, 28], [12, 28], [15, 28], [18, 28], [21, 28], [24, 28]);
      // cordones
      for (const y of [12, 15, 18, 21]) { g.line(10, y, 14, y - 1, 'P'); g.px('h', [14, y - 1]); }
    }],
    ['hz-valija', 'La Valija Completa', (g) => {
      g.fill(M().ring(16, 8, 5, 4, 2).cut.rect(0, 8, 32, 24), 'z');                  // manija
      g.rect(2, 8, 28, 21, 'madera', { r: 2, tag: 'v', shade: 2 });
      g.rect(2, 13, 28, 1, 'z', { in: 'v' });                                          // la tapa
      // correas con hebilla
      g.rect(9, 8, 3, 21, 'Ouz', { in: 'v' }); g.rect(20, 8, 3, 21, 'Ouz', { in: 'v' });
      g.rect(9, 17, 3, 3, 'oro'); g.rect(20, 17, 3, 3, 'oro'); g.px('o', [10, 18], [21, 18]);
      // esquineros
      for (const [x, y] of [[2, 8], [28, 8], [2, 27], [28, 27]]) g.rect(x, y, 2, 2, 'y', { in: 'v' });
      // etiquetas de viaje
      g.rect(13, 20, 6, 5, 'cielo', { sep: true }); g.rect(24, 15, 4, 6, 'coral', { sep: true });
      g.rect(14, 22, 4, 1, 'P');
    }],
  ],
};
