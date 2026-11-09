// Set «Fauna de la Isla» (id 'mascotas'). Familia: animales del lugar, naturales y de cuerpo entero, de perfil y
// mirando a la izquierda, sin piso ni paisaje. Tonos de tierra: madera, brasa y oro, con piedra y hueso; hoja, cielo
// e índigo solo de acento (piel de la tortuga, cabeza del pato, el pez).
import { M } from '../lib.mjs';

/** Pata recta de 2 de ancho, de y0 a y1. */
const pata = (g, x, y0, y1, ramp, o = {}) => g.rect(x, y0, 2, y1 - y0 + 1, ramp, o);

export default {
  id: 'mascotas', name: 'Fauna de la Isla', light: '#d4f7ec',
  laminas: [
    ['hz-erizo', 'Erizo del Monte', (g) => {
      pata(g, 9, 23, 26, 'z'); pata(g, 22, 23, 26, 'z');
      // el lomo de púas: un zigzag sobre un medio óvalo
      const pts = [], cx = 18, cy = 23, n = 15;
      for (let i = 0; i <= n; i++) {
        const a = Math.PI * (0.97 - 0.97 * i / n), r = i % 2 ? 1 : 0.78;
        pts.push([cx + Math.cos(a) * 11.6 * r, cy - Math.sin(a) * 16 * r]);
      }
      pts.push([28, 24], [8, 24]);
      g.poly(pts, 'Ouz', { tag: 'puas', shade: 2 });
      for (let i = 1; i < n; i += 2) {
        const a = Math.PI * (0.97 - 0.97 * i / n);
        g.line(cx + Math.cos(a) * 5, cy - Math.sin(a) * 6.4, cx + Math.cos(a) * 10, cy - Math.sin(a) * 12.8, 'z', { in: 'puas' });
      }
      // la cara: hocico largo hacia la izquierda
      g.fill(M().ellipse(9, 19.5, 4.6, 4.4).poly([[2, 21], [7, 16], [9, 23]]), 'hueso', { sep: true, shade: 2 });
      g.px('K', [2, 21], [2, 20]); g.px('k', [7, 18]);
      g.fill(M().ellipse(10.5, 13.6, 1.6, 1.6), 'p', { sep: true });
    }],
    ['hz-pez', 'Pez del Arroyo', (g) => {
      g.poly([[23, 16], [30, 8], [28, 16], [30, 24]], 'piedra', { tag: 'cola' });                    // la cola
      g.poly([[11, 11], [15, 5], [21, 11]], 'piedra');                                            // aleta de arriba
      g.poly([[13, 21], [17, 26], [19, 21]], 'piedra');                                           // aleta de abajo
      g.fill(M().ellipse(14, 16, 12, 6.4).ellipse(23, 16, 3, 3), 'cielo', { tag: 'pez', sep: true, shade: 2 });
      g.fill(M().ellipse(14, 20.5, 11, 3.4), 'Ppq', { in: 'pez', lite: 0 });                      // panza
      g.line(4, 16, 24, 16, 'R', { in: 'pez', w: 2 });                                             // franja
      for (const [x, y] of [[12, 12], [16, 13], [20, 12], [23, 14], [18, 11], [14, 11]]) g.px('d', [x, y]);
      g.curve([[8, 12], [9, 15], [8, 19]], 'd', { in: 'pez' });                                   // agalla
      g.px('k', [5, 14]); g.px('w', [5, 13]); g.px('d', [2, 17], [3, 17]);
    }],
    ['hz-tortuga', 'Tortuga sin Apuro', (g) => {
      pata(g, 8, 19, 24, 'Llv'); pata(g, 23, 19, 24, 'Llv');
      g.rect(7, 24, 3, 1, 'l'); g.rect(22, 24, 3, 1, 'l');
      g.fill(M().ellipse(4.5, 16, 3.6, 3).rect(4, 15, 5, 4), 'hoja', { tag: 'cabeza' });           // cuello y cabeza
      g.px('k', [3, 15]); g.px('v', [1, 17]);
      g.poly([[27, 18], [30, 20], [27, 21]], 'l');                                                // la cola
      // el caparazón: domo con placas y un borde
      g.fill(M().ellipse(16.5, 18, 11, 11).cut.rect(0, 18, 32, 14), 'oro', { tag: 'capa', shade: 2, sep: true });
      g.curve([[11, 17], [11, 12], [15, 9]], 'o', { in: 'capa' }); g.curve([[22, 17], [22, 12], [18, 9]], 'o', { in: 'capa' });
      g.line(11, 12, 22, 12, 'o', { in: 'capa' }); g.line(15, 12, 15, 17, 'o', { in: 'capa' }); g.line(18, 12, 18, 17, 'o', { in: 'capa' });
      g.rect(5, 18, 23, 2, 'Ouz', { sep: true });
    }],
    ['hz-liebre', 'Liebre Veloz', (g) => {
      // a la carrera: manos adelante, la pata larga atrás y las orejas echadas
      g.line(11, 19, 5, 25, 'f', { w: 2 });                                                        // la mano de atrás
      g.line(21, 20, 25, 27, 'f', { w: 2 });                                                       // la pata de atrás
      g.fill(M().line(7, 8, 13, 3, 2), 'f');                                                       // la oreja de atrás
      const cuerpo = M().ellipse(16, 15, 9, 5.4).ellipse(22, 14.5, 5.6, 6.4).line(8, 12, 12, 15, 5)
        .ellipse(6.5, 10.5, 4, 3.4).poly([[3, 10], [1, 12], [4, 13]]);
      g.fill(cuerpo, 'brasa', { tag: 'liebre', shade: 2 });
      g.fill(M().line(9, 8, 17, 3, 3).line(16, 3, 19, 2, 2), 'Eef', { sep: 'f' });                  // la oreja de adelante
      g.px('z', [18, 2], [19, 2], [19, 3]);
      g.ellipse(9, 15, 3, 3, 'Ppq', { in: 'liebre', lite: 0 });                                    // pecho claro
      g.line(10, 19, 3, 22, 'Eef', { w: 2, sep: 'f' });                                             // la mano de adelante
      g.line(24, 19, 29, 24, 'Eef', { w: 2, sep: 'f' });                                            // la pata de adelante
      g.ellipse(28, 12, 2, 2, 'hueso', { sep: true });                                             // el rabo blanco
      g.px('k', [6, 10]); g.px('K', [1, 12]);
    }],
    ['hz-pato', 'Pato del Bañado', (g) => {
      pata(g, 14, 24, 28, 'e', { flat: true }); pata(g, 19, 24, 28, 'e', { flat: true });
      g.rect(12, 28, 4, 1, 'e'); g.rect(17, 28, 4, 1, 'e');
      const cuerpo = M().ellipse(18, 19, 10, 6.4).poly([[24, 15], [30, 11], [29, 19], [26, 21]]);
      g.fill(cuerpo, 'piedra', { tag: 'cuerpo', shade: 2 });
      g.ellipse(11, 19, 5.4, 5.6, 'Ouz', { in: 'cuerpo' });                                         // pecho
      g.ellipse(20, 17.5, 6.6, 3.6, 'Ggh', { sep: 'h', tag: 'ala' });                               // ala
      g.rect(20, 18, 4, 2, 'b', { in: 'ala' });
      g.rect(9, 9, 4, 8, 'hoja');                                                                  // cuello
      g.ellipse(9.5, 8, 4.4, 4, 'hoja');                                                           // cabeza
      g.rect(8, 13, 5, 1, 'P');                                                                    // collar
      g.fill(M().rect(1, 8, 5, 2).rect(2, 10, 3, 1), 'Yyo', { sep: true });                        // pico
      g.px('k', [9, 7]); g.px('w', [10, 6]);
    }],
    ['hz-gato', 'Gato de Granero', (g) => {
      // sentado de perfil, con la cola parada atrás
      g.curve([[24, 27], [28, 22], [28, 15], [26, 11]], 'Yyo', { w: 3 });
      const cuerpo = M().ellipse(18, 22, 8, 7.6).ellipse(14, 15, 5, 6.4).cut.rect(0, 29, 32, 3);
      g.fill(cuerpo, 'oro', { tag: 'cuerpo', shade: 2, sep: true });
      for (const [x, y] of [[19, 16], [22, 18], [24, 21]]) g.line(x, y, x - 2, y + 3, 'o', { in: 'cuerpo' });
      g.rect(11, 19, 3, 10, 'oro', { sep: 'o' });                                                  // la mano
      g.rect(10, 28, 4, 1, 'y');
      // cabeza con orejas
      g.poly([[8, 7], [9, 1], [12, 5]], 'oro'); g.poly([[13, 5], [16, 1], [17, 7]], 'oro');
      g.fill(M().ellipse(12.5, 8.6, 5.4, 4.6).ellipse(7.4, 10.4, 2.2, 2), 'oro', { tag: 'cabeza', sep: 'o' });
      g.px('R', [10, 4], [15, 4]);
      g.line(13, 4, 14, 7, 'o', { in: 'cabeza' }); g.line(16, 6, 17, 9, 'o', { in: 'cabeza' });
      g.px('k', [9, 8], [9, 9]); g.px('x', [5, 10]); g.px('P', [6, 12], [7, 12]);
    }],
    ['hz-perro', 'Perro Pastor', (g) => {
      // collie sentado y de frente: melena blanca, orejas dobladas en la punta y la cola peluda al costado
      g.curve([[23, 28], [27, 26], [29, 21], [28, 16]], 'madera', { w: 4, tag: 'cola' });
      g.fill(M().ellipse(28, 16.5, 2, 2.4), 'Ppq', { in: 'cola' });
      g.fill(M().ellipse(16, 23, 9, 7).cut.rect(0, 30, 32, 2), 'madera', { tag: 'cuerpo', shade: 2, sep: true });
      g.fill(M().ellipse(16, 19, 6, 7.4), 'Ppq', { in: 'cuerpo', lite: 0, shade: 2 });             // la melena del pecho
      g.rect(11, 22, 4, 8, 'Ppq', { sep: 'q' }); g.rect(17, 22, 4, 8, 'Ppq', { sep: 'q' });        // las manos
      g.px('q', [13, 29], [19, 29]);
      // la cabeza con las orejas dobladas
      g.poly([[9, 8], [11, 3], [14, 6]], 'madera'); g.poly([[18, 6], [21, 3], [23, 8]], 'madera');
      g.poly([[11, 3], [7, 4], [8, 7]], 'Ouz', { sep: 'z' }); g.poly([[21, 3], [25, 4], [24, 7]], 'Ouz', { sep: 'z' });   // las puntas dobladas
      g.fill(M().ellipse(16, 10.5, 6.6, 5.4).ellipse(16, 14, 3.4, 2.6), 'madera', { tag: 'cara', sep: 'z' });
      g.fill(M().rect(15, 5, 2, 8).ellipse(16, 14, 3.2, 2.4), 'Ppq', { in: 'cara', lite: 0 });        // la franja y el hocico
      g.px('k', [12, 10], [20, 10]); g.px('K', [15, 13], [16, 13], [17, 13]);
    }],
    ['hz-zorro', 'Zorro Gris', (g) => {
      // bajo y alargado, con la cola enorme alzada atrás
      pata(g, 9, 21, 26, 'f'); pata(g, 19, 21, 26, 'f');
      g.fill(M().curve([[19, 19], [24, 18], [27.5, 13], [27, 6]], 6).ellipse(27, 6, 2.6, 3), 'piedra', { tag: 'cola', shade: 2 });
      g.fill(M().ellipse(27, 4.6, 3, 2.6), 'h', { in: 'cola' });                                     // la punta oscura
      g.fill(M().ellipse(14, 18.5, 9.6, 3.8).line(8, 17, 6.5, 14, 4), 'piedra', { tag: 'cuerpo', shade: 2, sep: true });
      g.fill(M().ellipse(14, 21.4, 8, 1.6), 'e', { in: 'cuerpo' });                                  // costado rojizo
      g.ellipse(6.5, 18, 2.2, 2.4, 'hueso', { in: 'cuerpo' });
      pata(g, 11, 21, 26, 'Eef', { sep: true }); pata(g, 21, 21, 26, 'Eef', { sep: true });
      g.px('h', [11, 26], [12, 26], [21, 26], [22, 26]);
      // cabeza con orejas grandes y hocico largo y fino
      g.poly([[3, 12], [3, 7], [6, 11]], 'piedra'); g.poly([[6, 11], [8, 7], [9, 12]], 'piedra');
      g.fill(M().ellipse(5.6, 14, 3.4, 2.6).poly([[3, 13], [1, 16], [6, 16]]), 'piedra', { sep: 'h' });
      g.px('P', [2, 16], [3, 16], [4, 16]); g.px('K', [1, 16]); g.px('k', [4, 13]);
    }],
    ['hz-ciervo', 'Ciervo Blanco', (g) => {
      // las astas
      const astas = M().curve([[7, 6], [6, 3], [8, 1]], 2).line(6, 3, 3, 2, 2)
        .curve([[10, 6], [13, 4], [17, 3]], 2).line(13, 4, 13, 1, 2).line(16, 3, 18, 1, 1);
      g.fill(astas, 'Ouz');
      pata(g, 10, 20, 29, 'q'); pata(g, 22, 20, 29, 'q');                                          // las de atrás
      g.fill(M().ellipse(18, 16.5, 8.6, 5).line(10, 15, 8, 9, 4), 'Ppq', { tag: 'cuerpo', shade: 2, sep: 'q' });
      g.px('P', [27, 14], [27, 15]);
      pata(g, 12, 20, 29, 'Ppq', { sep: 'q' }); pata(g, 24, 20, 29, 'Ppq', { sep: 'q' });
      g.px('h', [12, 29], [13, 29], [24, 29], [25, 29]);
      g.fill(M().ellipse(7.6, 8.4, 3.2, 2.6).poly([[6, 8], [2, 10], [3, 11], [8, 10]]), 'Ppq', { sep: 'q' });
      g.px('K', [2, 10]); g.px('k', [7, 8]); g.px('q', [10, 7]);
    }],
  ],
};
