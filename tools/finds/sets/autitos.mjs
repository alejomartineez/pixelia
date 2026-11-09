// Set «Navegación» (id 'autitos'). Familia: cosas de navegar por agua y por aire, enteras y de costado, sin agua ni
// cielo dibujados. Tonos: madera y hueso (cascos, lona, velas), coral de acento; oro en bronces y cuerdas, piedra
// en los herrajes.
import { M } from '../lib.mjs';

export default {
  id: 'autitos', name: 'Navegación', light: '#daf2ff',
  laminas: [
    ['hz-soga', 'Soga de Amarre', (g) => {
      // rollo visto de arriba: tres vueltas, cada una con su luz, y la punta que se escapa
      g.ellipse(15, 18, 13, 10, 'o', { flat: true });
      g.ring(15, 18, 13, 10, 3, 'oro', { tag: 'v1' });
      g.ring(15, 18, 9.6, 7.3, 2.8, 'oro', { tag: 'v2', sep: 'o' });
      g.ring(15, 18, 6.4, 4.9, 2.6, 'oro', { tag: 'v3', sep: 'o' });
      g.ellipse(15, 18, 3, 2, 'K');
      // trenzado, pocas marcas
      for (const [x, y] of [[6, 13], [10, 10], [15, 9], [20, 10], [24, 13], [26, 19], [23, 25], [17, 27], [11, 27], [6, 24], [3, 19]]) g.px('o', [x, y]);
      // la punta, con un nudo
      g.curve([[24, 12], [26, 7], [29, 4]], 'oro', { w: 3, sep: true });
      g.px('o', [26, 9], [27, 7]); g.px('Y', [28, 3]);
    }],
    ['hz-canoa', 'Canoa de Corteza', (g) => {
      // de costado, larga y baja, con las puntas que suben; el remo acostado abajo, aparte
      const borda = [[2, 6], [5, 11], [10, 13], [16, 13.5], [22, 13], [27, 11], [29, 6]];
      g.curve([[4, 9], [10, 11.5], [16, 12], [22, 11.5], [27, 9]], 'z');                 // la borda de atrás
      const casco = M().poly([...borda, [28, 12], [25, 17], [16, 19], [7, 17], [3, 12]]);
      g.fill(casco, 'hueso', { tag: 'c', shade: 2 });
      g.curve(borda, 'madera', { w: 2, in: 'c' });
      for (const [x, y] of [[8, 16], [14, 17], [20, 16], [12, 15], [23, 15]]) g.rect(x, y, 3, 1, 'q', { in: 'c' });
      g.line(5, 12, 7, 16, 'z', { in: 'c' }); g.line(26, 12, 24, 16, 'z', { in: 'c' });
      // el remo
      g.rect(5, 24, 16, 2, 'madera'); g.rect(3, 23, 3, 4, 'madera', { r: 1 });
      g.ellipse(24, 24.5, 5, 2.5, 'madera', { sep: true });
    }],
    ['hz-brujula', 'Brújula de Céfiro', (g) => {
      // la tapa abierta, atrás
      g.ellipse(16, 8, 10, 6, 'oro', { shade: 2 });
      g.ellipse(16, 8, 7.5, 4, 'o', { flat: true });
      g.ellipse(16, 1.8, 1.6, 1, 'oro');
      // la caja y la esfera
      g.ellipse(16, 20, 13, 9, 'oro', { shade: 2, sep: true });
      g.ellipse(16, 20, 10, 6.6, 'hueso', { tag: 'esfera', sep: 'o' });
      for (const [x, y] of [[16, 14], [16, 26], [7, 20], [25, 20]]) g.px('q', [x, y]);
      // la aguja
      g.poly([[15, 19], [24, 16], [17, 21]], 'coral', { flat: true });
      g.poly([[17, 21], [8, 24], [15, 19]], 'indigo', { flat: true });
      g.px('y', [16, 20]);
    }],
    ['hz-farol-proa', 'Farol de Proa', (g) => {
      g.ring(16, 5, 4, 3.5, 1, 'piedra');                                             // argolla
      g.poly([[8, 10], [16, 5], [24, 10]], 'piedra', { sep: true });                   // techo
      g.rect(6, 10, 20, 2, 'piedra');
      g.rect(10, 12, 12, 13, 'oro', { tag: 'vidrio' });                                // el vidrio encendido
      g.ellipse(16, 18, 3.5, 4.5, 'Y', { in: 'vidrio', flat: true });
      g.ellipse(16, 19, 1.2, 2, 'w', { in: 'vidrio', flat: true });
      g.rect(9, 12, 2, 13, 'piedra'); g.rect(21, 12, 2, 13, 'piedra'); g.rect(15, 12, 2, 13, 'h');
      g.rect(7, 25, 18, 2, 'piedra'); g.rect(9, 27, 14, 2, 'piedra', { sep: true });
    }],
    ['hz-barrilete', 'Barrilete de Señales', (g) => {
      // hexagonal, con tres varillas y gajos de colores
      const hex = [[11, 2], [21, 2], [26, 10], [21, 18], [11, 18], [6, 10]];
      g.poly(hex, 'hueso', { tag: 'h', shade: 2 });
      g.poly([[16, 10], [11, 2], [21, 2]], 'coral', { in: 'h' });
      g.poly([[16, 10], [26, 10], [21, 18]], 'coral', { in: 'h' });
      g.poly([[16, 10], [11, 18], [6, 10]], 'coral', { in: 'h' });
      g.line(11, 2, 21, 18, 'madera', { in: 'h' }); g.line(21, 2, 11, 18, 'madera', { in: 'h' }); g.line(6, 10, 26, 10, 'madera', { in: 'h' });
      // la cola con moños
      g.curve([[16, 18], [14, 22], [17, 26], [14, 30]], 'q');
      g.poly([[12, 22], [16, 23], [12, 24]], 'indigo'); g.poly([[19, 25], [15, 26], [19, 27]], 'indigo');
      // el hilo
      g.curve([[24, 15], [27, 21], [29, 29]], 'q');
    }],
    ['hz-globo-lona', 'Globo de Lona', (g) => {
      g.fill(M().ellipse(16, 11, 11, 10).poly([[6, 14], [26, 14], [19, 22], [13, 22]]), 'hueso', { tag: 'lona', shade: 2 });
      g.fill(M().ellipse(16, 11, 6.5, 10.5).cut.ellipse(16, 11, 3.5, 11), 'coral', { in: 'lona' });
      g.fill(M().ring(16, 11, 11, 10, 1.5), 'coral', { in: 'lona' });
      g.rect(12, 21, 9, 2, 'madera');                                                 // aro
      // cuerdas y canasta
      g.line(13, 23, 13, 25, 'z'); g.line(19, 23, 19, 25, 'z');
      g.rect(11, 25, 11, 5, 'madera', { sep: true, tag: 'c' });
      g.rect(11, 27, 11, 1, 'z', { in: 'c' });
    }],
    ['hz-balandra', 'Balandra del Puerto', (g) => {
      g.rect(15, 2, 2, 21, 'madera');                                                  // mástil
      g.poly([[17, 3], [17, 21], [28, 21]], 'hueso', { shade: 2 });                    // vela mayor
      g.poly([[14, 5], [14, 21], [5, 21]], 'hueso', { shade: 2 });                     // foque
      g.line(18, 8, 21, 21, 'q'); g.line(18, 14, 24, 21, 'q');
      g.poly([[17, 2], [21, 3], [17, 4]], 'coral', { flat: true });                     // gallardete
      const casco = M().poly([[2, 22], [30, 22], [26, 28], [6, 28]]);
      g.fill(casco, 'madera', { tag: 'c', sep: true, shade: 2 });
      g.rect(2, 22, 29, 2, 'coral', { in: 'c' });
    }],
    ['hz-ancla-piedra', 'Ancla de Piedra', (g) => {
      g.ring(16, 5, 4, 3.5, 1.6, 'piedra');                                             // argolla, atrás
      const a = M().rect(14, 8, 4, 18).ring(16, 15, 12, 12, 4).cut.rect(0, 0, 32, 17)
        .add.poly([[2, 13], [9, 17], [5, 21]]).poly([[30, 13], [23, 17], [27, 21]]).ellipse(16, 26, 3, 2);
      g.fill(a, 'piedra', { shade: 2, tag: 'a', sep: true });
      g.px('h', [15, 15], [16, 20], [9, 23], [22, 24]); g.px('G', [6, 18], [25, 18]);
      g.rect(7, 10, 18, 3, 'madera', { r: 1, sep: true });                              // cepo
    }],
    ['hz-galeon', 'Maqueta de Galeón', (g) => {
      // pie de la maqueta
      g.rect(5, 28, 22, 2, 'madera'); g.rect(10, 24, 2, 4, 'z'); g.rect(20, 24, 2, 4, 'z');
      // mástiles y velas cuadradas
      for (const x of [9, 16, 23]) g.rect(x, 3, 1, 19, 'z');
      for (const [x, y, w, h] of [[6, 7, 7, 5], [6, 13, 7, 5], [12, 4, 9, 6], [12, 11, 9, 7], [20, 8, 7, 4], [20, 13, 7, 5]]) g.rect(x, y, w, h, 'hueso', { sep: 'q', r: 1 });
      g.poly([[16, 2], [20, 3], [16, 4]], 'coral', { flat: true });
      // casco con el castillo de popa alto
      const casco = M().poly([[2, 19], [8, 20], [22, 20], [23, 16], [29, 16], [29, 20], [26, 25], [6, 25]]);
      g.fill(casco, 'madera', { tag: 'c', sep: true, shade: 2 });
      g.rect(2, 21, 28, 1, 'oro', { in: 'c' });
      for (const x of [9, 13, 17, 21]) g.px('K', [x, 23]);
    }],
  ],
};
